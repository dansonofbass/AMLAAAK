"""Vercel-detected entrypoint. Run from repo root: uvicorn apps.api.main:app."""
import logging
import hmac
import os
import time
import uuid
from pathlib import Path
from statistics import mean, median
from typing import Annotated, Literal
from fastapi import FastAPI, HTTPException, Query, Request, Response, Depends
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

if __package__:
    from .service import schemas as s
    from .service.analytics import Repository, city_aggregates, distributions
    from .service.inference import Inference
    from .service.huggingface import HuggingFaceDataProvider, UpstreamUnavailable
    from .service.valuation import valuate, UnavailableComparableSource
    from .service.prepared import PreparedDataProvider
else:  # Vercel imports main from apps/api as project root.
    from service import schemas as s
    from service.analytics import Repository, city_aggregates, distributions
    from service.inference import Inference
    from service.huggingface import HuggingFaceDataProvider, UpstreamUnavailable
    from service.valuation import valuate, UnavailableComparableSource
    from service.prepared import PreparedDataProvider

logging.basicConfig(level=logging.INFO, format='%(message)s')
logging.getLogger('httpx').setLevel(logging.WARNING)  # Avoid logging signed private-file redirect URLs.
logger = logging.getLogger('amlaaak.api')


def create_app(snapshot_path=None, model_dir=None, data_provider=None):
    app = FastAPI(title='AMLAAAK Analytics API', version='1.0.0',
                  description='Read-only residential sale analytics. Illustrative data is explicitly labeled.',
                  responses={422: {'model': s.ErrorResponse}, 503: {'model': s.ErrorResponse}, 404: {'model': s.ErrorResponse}})
    try:
        mode = os.getenv('AMLAAAK_DATA_MODE', 'huggingface')
        offline = (snapshot_path is not None or mode in ('illustrative', 'snapshot')
                   or (os.getenv('AMLAAAK_SNAPSHOT') and mode not in ('huggingface', 'prepared')))
        if data_provider is not None:
            repo = data_provider
        elif mode == 'prepared' and snapshot_path is None:
            repo = PreparedDataProvider()
        elif offline:
            repo = Repository(Path(snapshot_path or os.getenv('AMLAAAK_SNAPSHOT', Path(__file__).parent / 'assets' / 'sample.json')))
        else:
            repo = HuggingFaceDataProvider(max_records=os.getenv('HF_MAX_RECORDS', '300'))
    except Exception:
        logger.exception('data_provider_initialization_failed')
        repo = None
    inference = Inference(model_dir if model_dir is not None else os.getenv('AMLAAAK_MODEL_DIR'))
    app.state.repository, app.state.inference = repo, inference
    token = os.getenv('AMLAAAK_API_TOKEN')

    @app.middleware('http')
    async def access_log(request: Request, call_next):
        started = time.perf_counter()
        request_id = uuid.uuid4().hex
        if token and request.url.path not in ('/api/v1/health',) and not hmac.compare_digest(request.headers.get('authorization', ''), f'Bearer {token}'):
            return JSONResponse({'error': {'code': 'unauthorized', 'message': 'Valid API credentials required'}}, status_code=401)
        response = await call_next(request)
        response.headers['X-Request-ID'] = request_id
        response.headers['Cache-Control'] = 'no-store'
        logger.info('{"event":"request","id":"%s","method":"%s","path":"%s","status":%d,"ms":%.1f}',
                    request_id, request.method, request.url.path, response.status_code, (time.perf_counter() - started) * 1000)
        return response

    @app.exception_handler(HTTPException)
    async def http_error(request, exc):
        return JSONResponse({'error': {'code': f'http_{exc.status_code}', 'message': str(exc.detail)}}, status_code=exc.status_code)

    @app.exception_handler(UpstreamUnavailable)
    async def upstream_error(request, exc):
        return JSONResponse({'error': {'code': 'upstream_unavailable', 'message': str(exc) + '. Retry later or explicitly select offline illustrative mode.'}}, status_code=503)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        message = '; '.join(f'{".".join(str(v) for v in e["loc"])}: {e["msg"]}' for e in exc.errors())
        return JSONResponse({'error': {'code': 'validation_error', 'message': message}}, status_code=422)

    @app.exception_handler(Exception)
    async def unexpected_error(request, exc):
        logger.error('unhandled_request_error', exc_info=exc)
        return JSONResponse({'error': {'code': 'internal_error', 'message': 'Unexpected service error; see server logs'}}, status_code=500)

    def repository():
        if repo is None:
            raise HTTPException(503, 'Dataset unavailable; verify backend provider configuration and credentials')
        return repo

    F = Annotated[s.Filters, Query()]

    @app.get('/api/v1/health', response_model=s.Health)
    def health():
        remote = isinstance(repo, (HuggingFaceDataProvider, PreparedDataProvider))
        ready = repo.has_population if remote else repo is not None
        return s.Health(status='ok' if ready else 'degraded', dataset_ready=ready, model_available=inference.status.available,
                        provider='prepared' if isinstance(repo, PreparedDataProvider) or repo is None and mode=='prepared'
                        else 'huggingface' if remote or repo is None and mode=='huggingface' else 'snapshot',
                        upstream_checked=remote and repo.checked)

    @app.get('/api/v1/model/status', response_model=s.ModelStatus)
    def model_status():
        return inference.status

    @app.get('/api/v1/dashboard/summary', response_model=s.Summary)
    def summary(filters: F, store=Depends(repository)):
        if isinstance(store, PreparedDataProvider):
            prepared = store.summary(filters, inference.status)
            if prepared is not None:
                return prepared
        store = store.population(filters)
        rows = store.select(filters)
        return s.Summary(count=len(rows), median_price=median(p.price_value for p in rows) if rows else None,
                         average_price=mean(p.price_value for p in rows) if rows else None,
                         median_price_per_sqm=median(p.price_per_sqm for p in rows) if rows else None,
                         cities_count=len({p.city_slug for p in rows}), available_cities=sorted({p.city_slug for p in store.rows}),
                         provenance=store.provenance_for(rows), model=inference.status)

    @app.get('/api/v1/analytics/cities', response_model=list[s.City])
    def cities(filters: F, response: Response, store=Depends(repository)):
        if isinstance(store, PreparedDataProvider):
            prepared = store.cities(filters)
            if prepared is not None:
                provenance=store.provenance(sum(c.count for c in prepared))
                response.headers['X-Dataset-Revision']=provenance.revision
                response.headers['X-Records-Examined']='0'
                response.headers['X-Coverage-Exhaustive']='true'
                return prepared
        store = store.population(filters)
        rows=store.select(filters)
        provenance=store.provenance_for(rows)
        response.headers['X-Dataset-Revision']=provenance.revision
        response.headers['X-Records-Examined']=str(provenance.coverage.records_examined)
        response.headers['X-Coverage-Exhaustive']=str(provenance.coverage.exhaustive).lower()
        return [city.model_copy(update={'coverage':provenance.coverage,'source_revision':provenance.revision}) for city in city_aggregates(rows)]

    @app.get('/api/v1/analytics/distributions', response_model=s.Distributions)
    def distribution(filters: F, store=Depends(repository)):
        if isinstance(store, PreparedDataProvider):
            prepared = store.distribution(filters)
            if prepared is not None:
                return prepared
        store = store.population(filters)
        rows = store.select(filters)
        return distributions(rows).model_copy(update={'coverage': store.provenance_for(rows).coverage})

    @app.get('/api/v1/properties', response_model=s.PropertyPage)
    def properties(filters: Annotated[s.PropertyFilters, Query()], store=Depends(repository)):
        if isinstance(store, PreparedDataProvider):
            prepared = store.page(filters)
            if prepared is not None:
                return prepared
        store = store.population(filters)
        page, page_size = filters.page, filters.page_size
        rows = sorted(store.select(filters), key=lambda p: (getattr(p, filters.sort), p.id), reverse=filters.order == 'desc')
        provenance = store.provenance_for(rows)
        return s.PropertyPage(items=rows[(page-1)*page_size:page*page_size], total=len(rows), page=page, page_size=page_size,
                              provenance=provenance, coverage=provenance.coverage)

    @app.get('/api/v1/properties/{property_id}', response_model=s.Property)
    def property_detail(property_id: str, store=Depends(repository)):
        result = store.find(property_id) if isinstance(store, (HuggingFaceDataProvider, PreparedDataProvider)) else next((p for p in store.rows if p.id == property_id), None)
        if result is None:
            raise HTTPException(404, 'Property not found')
        return result

    @app.get('/api/v1/model/metrics', response_model=s.Metrics)
    def metrics():
        return inference.metrics()

    @app.get('/api/v1/data/facets', response_model=s.Facets)
    def facets(city: str | None = Query(default=None, max_length=80), store=Depends(repository)):
        if isinstance(store, PreparedDataProvider):
            return store.facets(city)
        filters = s.Filters(city=city)
        population = store.population(filters)
        rows = population.select(filters)
        provenance = population.provenance_for(rows)
        return s.Facets(cities=sorted({p.city_slug for p in population.rows}),
                        neighborhoods=sorted({p.neighborhood_slug for p in rows if p.neighborhood_slug}),
                        provenance=provenance, coverage=provenance.coverage)

    @app.post('/api/v1/valuation', response_model=s.Valuation)
    def valuation(body: s.PredictionInput):
        store=repo if repo is not None else UnavailableComparableSource(
            'prepared' if mode=='prepared' else 'huggingface',
            os.getenv('AMLAAAK_PREPARED_DATA_REPO','unconfigured'),
            os.getenv('AMLAAAK_PREPARED_DATA_REVISION','unavailable') if mode=='prepared' else 'unavailable')
        return valuate(body, store, inference)

    @app.post('/api/v1/predict', response_model=s.Prediction)
    def predict(body: s.PredictionInput):
        if not inference.status.available:
            raise HTTPException(503, inference.status.message)
        try:
            return inference.predict(body)
        except Exception:
            logger.exception('prediction_failed')
            raise HTTPException(503, 'Prediction failed; see server logs')

    return app


app = create_app()

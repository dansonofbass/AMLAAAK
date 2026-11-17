"""Vercel-detected entrypoint. Run from repo root: uvicorn apps.api.main:app."""
import logging
import hmac
import os
import time
import uuid
from pathlib import Path
from statistics import mean, median
from typing import Annotated, Literal
from fastapi import FastAPI, HTTPException, Query, Request, Depends
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

if __package__:
    from .service import schemas as s
    from .service.analytics import Repository, city_aggregates, distributions
    from .service.inference import Inference
else:  # Vercel imports main from apps/api as project root.
    from service import schemas as s
    from service.analytics import Repository, city_aggregates, distributions
    from service.inference import Inference

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger('amlaaak.api')


def create_app(snapshot_path=None, model_dir=None):
    app = FastAPI(title='AMLAAAK Analytics API', version='1.0.0',
                  description='Read-only residential sale analytics. Illustrative data is explicitly labeled.',
                  responses={422: {'model': s.ErrorResponse}, 503: {'model': s.ErrorResponse}, 404: {'model': s.ErrorResponse}})
    try:
        repo = Repository(Path(snapshot_path or os.getenv('AMLAAAK_SNAPSHOT', Path(__file__).parent / 'assets' / 'sample.json')))
    except Exception:
        logger.exception('snapshot_load_failed')
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
            raise HTTPException(503, 'Dataset unavailable; verify the prepared snapshot configuration')
        return repo

    F = Annotated[s.Filters, Query()]

    @app.get('/api/v1/health', response_model=s.Health)
    def health():
        return s.Health(status='ok' if repo else 'degraded', dataset_ready=repo is not None, model_available=inference.status.available)

    @app.get('/api/v1/model/status', response_model=s.ModelStatus)
    def model_status():
        return inference.status

    @app.get('/api/v1/dashboard/summary', response_model=s.Summary)
    def summary(filters: F, store=Depends(repository)):
        rows = store.select(filters)
        return s.Summary(count=len(rows), median_price=median(p.price_value for p in rows) if rows else None,
                         average_price=mean(p.price_value for p in rows) if rows else None,
                         median_price_per_sqm=median(p.price_per_sqm for p in rows) if rows else None,
                         cities_count=len({p.city_slug for p in rows}), available_cities=sorted({p.city_slug for p in store.rows}),
                         provenance=store.snapshot.provenance, model=inference.status)

    @app.get('/api/v1/analytics/cities', response_model=list[s.City])
    def cities(filters: F, store=Depends(repository)):
        return city_aggregates(store.select(filters))

    @app.get('/api/v1/analytics/distributions', response_model=s.Distributions)
    def distribution(filters: F, store=Depends(repository)):
        return distributions(store.select(filters))

    @app.get('/api/v1/properties', response_model=s.PropertyPage)
    def properties(filters: Annotated[s.PropertyFilters, Query()], store=Depends(repository)):
        page, page_size = filters.page, filters.page_size
        rows = sorted(store.select(filters), key=lambda p: (getattr(p, filters.sort), p.id), reverse=filters.order == 'desc')
        return s.PropertyPage(items=rows[(page-1)*page_size:page*page_size], total=len(rows), page=page, page_size=page_size)

    @app.get('/api/v1/properties/{property_id}', response_model=s.Property)
    def property_detail(property_id: str, store=Depends(repository)):
        result = next((p for p in store.rows if p.id == property_id), None)
        if result is None:
            raise HTTPException(404, 'Property not found')
        return result

    @app.get('/api/v1/model/metrics', response_model=s.Metrics)
    def metrics():
        return inference.metrics()

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

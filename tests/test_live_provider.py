"""Deterministic external-boundary tests; opt-in tests explicitly hit real HF."""
import os
import httpx
import pytest
from fastapi.testclient import TestClient
from apps.api.main import create_app
from apps.api.service.huggingface import HuggingFaceDataProvider, UpstreamUnavailable
from apps.api.service.normalization import normalize_sale
from apps.api.service.schemas import Filters, Property, PredictionInput
from apps.api.service.valuation import rank_comparables
from amlaaak.preprocessing import prepare
import pandas as pd

REVISION='a'*40
RAW={'cat2_slug':'residential-sell','cat3_slug':'apartment-sell','city_slug':'tehran',
     'neighborhood_slug':'gholhak','price_mode':'مقطوع','price_value':1000000000,
     'building_size':'۹۰','rooms_count':'دو','floor':'۲','total_floors_count':'۵',
     'construction_year':'۱۳۹۵','has_parking':'true','has_elevator':True,
     'has_balcony':None,'has_warehouse':False,'created_at_month':'2024-05-01 00:00:00'}


def fake_provider(total=1000, filtered=False, partial=False, revisions=None):
    calls=[]
    def handler(request):
        calls.append(request)
        if request.url.path=='/splits':
            body={'splits':[{'config':'default','split':'train'}]}
        elif request.url.path=='/filter' and not filtered:
            return httpx.Response(500,json={'error':'test upstream unavailable'})
        else:
            offset=int(request.url.params.get('offset',0))
            body={'num_rows_total':total,'partial':partial,
                  'rows':[{'row_idx':i,'row':{**RAW,'building_size':str(90+i)}} for i in range(offset,min(offset+100,total))]}
        revision=(revisions or {}).get(int(request.url.params.get('offset',0)),REVISION)
        return httpx.Response(200,json=body,headers={'x-revision':revision})
    provider=HuggingFaceDataProvider(max_records=200,client=httpx.Client(transport=httpx.MockTransport(handler)),sleep=lambda _:None)
    return provider,calls


def test_shared_normalization_and_missing_values():
    value=normalize_sale(RAW)
    assert value['building_size']==90 and value['rooms_count']==2 and value['construction_year']==1395
    assert value['has_balcony'] is None and value['created_at_month']=='2024-05'
    frame=prepare(pd.DataFrame([RAW]))
    assert frame.iloc[0].building_size==value['building_size']
    assert normalize_sale({**RAW,'cat2_slug':'residential-rent'}) is None
    assert normalize_sale({**RAW,'price_value':0}) is None
    assert normalize_sale({**RAW,'building_size':'1-2'}) is None


def test_bounded_prefix_cache_filters_and_provenance():
    provider,calls=fake_provider()
    population=provider.population(Filters(city='tehran'))
    provenance=population.provenance_for(population.select(Filters(city='tehran')))
    assert provenance.kind=='divar' and provenance.revision==REVISION
    assert provenance.coverage.records_examined==200
    assert provenance.coverage.upstream_matching_rows==1000
    assert provenance.coverage.bounded and not provenance.coverage.exhaustive
    assert not provenance.coverage.statistics_full_population
    assert not provenance.coverage.remote_filter_supported
    count=len(calls)
    assert provider.population(Filters(city='shiraz')) is population
    assert len(calls)==count
    assert population.select(Filters(city='shiraz'))==[]
    assert provider.find(population.rows[0].id).source_row_index==0
    assert provider.find('unknown') is None


def test_remote_supported_and_complete_scope():
    provider,calls=fake_provider(total=5,filtered=True)
    population=provider.population(Filters(city="o'hara"))
    assert population.snapshot.provenance.coverage.exhaustive
    assert population.snapshot.provenance.coverage.remote_filter_supported
    query=next(r.url.params['where'] for r in calls if r.url.path=='/filter')
    assert "o''hara" in query
    assert 'rooms_count' not in query and 'construction_year' not in query


def test_partial_index_is_never_exhaustive():
    provider,_=fake_provider(total=5,filtered=True,partial=True)
    assert not provider.population(Filters()).snapshot.provenance.coverage.exhaustive


def test_revision_drift_is_rejected():
    provider,_=fake_provider(revisions={100:'b'*40})
    with pytest.raises(UpstreamUnavailable,match='revision changed'):
        provider.population(Filters())


@pytest.mark.parametrize('status',[429,500,502,503,504])
def test_transient_retry_and_bounded_backoff(status):
    calls=[];delays=[]
    def handler(request):
        calls.append(request)
        return httpx.Response(status if len(calls)==1 else 200,json={'ok':True},headers={'retry-after':'1' if status==429 else '300'})
    provider=HuggingFaceDataProvider(client=httpx.Client(transport=httpx.MockTransport(handler)),sleep=delays.append)
    assert provider.request('/rows',{})[0]=={'ok':True}
    assert len(calls)==2 and delays==([1.0] if status==429 else [2.0])


def test_long_rate_limit_is_not_retried_early():
    calls=[]
    def handler(request):
        calls.append(request)
        return httpx.Response(429,headers={'retry-after':'300'})
    provider=HuggingFaceDataProvider(client=httpx.Client(transport=httpx.MockTransport(handler)),sleep=lambda _:None)
    with pytest.raises(UpstreamUnavailable,match='rate limited'):
        provider.request('/rows',{})
    assert len(calls)==1


def test_timeout_is_explicit_and_does_not_fabricate_results():
    calls=[]
    def handler(request):
        calls.append(request);raise httpx.ReadTimeout('test timeout')
    provider=HuggingFaceDataProvider(client=httpx.Client(transport=httpx.MockTransport(handler)),sleep=lambda _:None)
    with pytest.raises(UpstreamUnavailable,match='timed out'):
        provider.population(Filters())
    assert len(calls)==2


def test_permanent_error_is_not_retried():
    count=[]
    def handler(request):
        count.append(1);return httpx.Response(403)
    provider=HuggingFaceDataProvider(client=httpx.Client(transport=httpx.MockTransport(handler)),sleep=lambda _:None)
    with pytest.raises(UpstreamUnavailable,match='403'):
        provider.request('/rows',{})
    assert len(count)==1


def test_comparables_ranking_is_explainable():
    source=normalize_sale(RAW)
    one=Property(id='1'*16,**source,price_per_sqm=source['price_value']/source['building_size'])
    far=one.model_copy(update={'id':'2'*16,'building_size':300,'rooms_count':5,'neighborhood_slug':'other'})
    wrong_city=one.model_copy(update={'id':'3'*16,'city_slug':'shiraz'})
    subject=PredictionInput(city_slug='tehran',neighborhood_slug='gholhak',cat3_slug='apartment-sell',building_size=90,
        rooms_count=2,floor=2,total_floors_count=5,construction_year=1395,has_parking=True,has_elevator=True,has_balcony=False,has_warehouse=False)
    result=rank_comparables(subject,[far,wrong_city,one])
    assert len(result)==2 and result[0].property.id==one.id
    assert result[0].similarity_score>result[1].similarity_score
    assert 'Same neighborhood' in result[0].reasons
    assert result[0].similarity_score<100  # Unknown balcony is not assumed to match.


def test_valuation_with_real_adapter_mocked_external_boundary(monkeypatch):
    monkeypatch.delenv('AMLAAAK_API_TOKEN',raising=False)
    provider,_=fake_provider()
    client=TestClient(create_app(model_dir='',data_provider=provider))
    body={'city_slug':'tehran','neighborhood_slug':'gholhak','cat3_slug':'apartment-sell','building_size':90,
          'rooms_count':2,'floor':2,'total_floors_count':5,'construction_year':1395,
          'has_parking':True,'has_elevator':True,'has_balcony':False,'has_warehouse':False}
    response=client.post('/api/v1/valuation',json=body)
    assert response.status_code==200
    data=response.json()
    assert data['prediction'] is None and len(data['comparables'])==8
    assert data['comparable_median_price']==1000000000
    assert data['coverage']['bounded'] and data['prediction_vs_comparable_percent'] is None
    assert data['comparables'][0]['property']['source_identity'].startswith('hf://')
    assert client.get('/api/v1/data/facets?city=tehran').json()['neighborhoods']==['gholhak']


def test_cache_capacity_and_expiry():
    provider,calls=fake_provider(total=5,filtered=True)
    for i in range(10):
        provider.population(Filters(city=f'city-{i}'))
    assert len(provider.cache)==8
    key=next(reversed(provider.cache))
    _,old=provider.cache[key]
    provider.cache[key]=(0,old)
    count=len(calls)
    assert provider.population(Filters(city='city-9')) is not old
    assert len(calls)>count


def test_valuation_preserves_prediction_during_upstream_outage(monkeypatch):
    from apps.api.service.valuation import valuate
    from apps.api.service.schemas import ModelStatus, Prediction
    class OfflineSource:
        revision=None
        def population(self,filters):raise UpstreamUnavailable('test outage')
    class WorkingModel:
        status=ModelStatus(available=True,mode='trained',message='unit test model',version='test')
        def predict(self,subject):return Prediction(predicted_price=123,price_per_sqm=123/subject.building_size,units='test units',model=self.status,warnings=[])
    subject=PredictionInput(city_slug='tehran',cat3_slug='apartment-sell',building_size=90,rooms_count=2,
        floor=2,total_floors_count=5,construction_year=1395,has_parking=True,has_elevator=True,has_balcony=False,has_warehouse=False)
    result=valuate(subject,OfflineSource(),WorkingModel())
    assert result.prediction.predicted_price==123
    assert result.comparables==[] and result.comparable_median_price is None
    assert result.coverage.records_examined==0 and result.coverage.method=='upstream_unavailable'


@pytest.mark.live
@pytest.mark.skipif(os.getenv('AMLAAAK_RUN_LIVE_TESTS')!='1',reason='Explicit opt-in required for real HF requests')
def test_genuine_huggingface_connectivity():
    provider=HuggingFaceDataProvider(max_records=100)
    population=provider.population(Filters())
    assert len(population.rows)>0
    assert population.snapshot.provenance.coverage.records_examined==100
    assert len(population.snapshot.provenance.revision)==40
    assert all(row.source_identity.startswith('hf://datasets/divarofficial/real_estate_ads@') for row in population.rows)


@pytest.mark.live
@pytest.mark.skipif(os.getenv('AMLAAAK_RUN_LIVE_TESTS')!='1',reason='Explicit opt-in required for real HF requests')
def test_genuine_fastapi_to_huggingface(monkeypatch):
    monkeypatch.delenv('AMLAAAK_API_TOKEN',raising=False)
    client=TestClient(create_app(model_dir='',data_provider=HuggingFaceDataProvider(max_records=100)))
    response=client.get('/api/v1/dashboard/summary')
    assert response.status_code==200
    data=response.json()
    assert data['provenance']['provider']=='huggingface'
    assert data['count']>0 and not data['provenance']['coverage']['exhaustive']

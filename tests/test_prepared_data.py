"""Synthetic offline fixtures exercise the real preparation and private adapter.

No genuine source partition is downloaded, prepared or uploaded in this suite.
"""
import csv
import gzip
import json
import time
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
import pyarrow as pa
import pyarrow.parquet as pq
from fastapi.testclient import TestClient

from apps.api.main import create_app
from apps.api.service.analytics import city_aggregates, distributions
from apps.api.service.huggingface import UpstreamUnavailable
from apps.api.service.preparation import build_dataset, inspect_source, validate_output
from apps.api.service.prepared import PreparedDataProvider
from apps.api.service.prepared_format import SOURCE_REVISION, encode, file_hash, sha256
from apps.api.service.prepared_upload import upload_prepared
from apps.api.service.schemas import Filters, PropertyFilters


def raw(index):
    return dict(city_slug='tehran' if index%2==0 else 'shiraz',cat2_slug='residential-sell',
        cat3_slug='house-villa-sell' if index%3==0 else 'apartment-sell',price_mode='مقطوع',
        price_value=str(1_000_000_000+index*100_000_000),building_size=str(70+index),
        rooms_count='۲',floor='1',total_floors_count='3',construction_year='1395',
        has_parking='true',has_elevator='false',has_balcony=None,has_warehouse='true',
        neighborhood_slug='central' if index%4==0 else 'north',created_at_month='2024-06',
        title='DO NOT EXPORT',description='contact me',phone='09123456789',latitude='35.123456')


@pytest.fixture(scope='module')
def archive(tmp_path_factory):
    root=tmp_path_factory.mktemp('prepared')
    records=[raw(i) for i in range(18)]
    records += [raw(0),raw(2)|{'cat2_slug':'residential-rent','cat3_slug':'apartment-rent'},
                raw(3)|{'price_value':None},raw(4)|{'city_slug':'bad@example.com'}]
    source=root/'synthetic.parquet'
    pq.write_table(pa.Table.from_pylist(records),source)
    part=dict(path=str(source),source_path='synthetic.parquet',sha256=file_hash(source),expected_rows=len(records))
    output=root/'output'
    manifest=build_dataset([part],output,chunk_rows=3,progress=lambda message:None)
    return output,manifest,part


def provider_for(output, *, mutate=None, status=200):
    calls=[]
    def request(request):
        calls.append(request)
        assert 'datasets-server' not in str(request.url)
        assert request.headers['authorization']=='Bearer test-private-token'
        path=request.url.path.split('/prepared/',1)[1]
        content=(output/path).read_bytes()
        if mutate:
            content=mutate(path,content)
        return httpx.Response(status,content=content)
    client=httpx.Client(transport=httpx.MockTransport(request))
    provider=PreparedDataProvider(repo='thevel0per/AMLAAAK-Real-Estate-Data',revision='a'*40,
        manifest_hash=file_hash(output/'manifest.json'),token='test-private-token',client=client)
    return provider,calls


def test_complete_preparation_counts_privacy_and_parquet(archive):
    output,manifest,_=archive
    assert manifest['total_source_rows']==22 and manifest['total_prepared_rows']==18
    assert manifest['total_cities']==2 and manifest['full_source_verified']
    assert manifest['counts']['rental_rows_excluded']==1 and manifest['counts']['duplicates_removed']==1
    assert manifest['counts']['invalid_city_rows']==1
    assert validate_output(output)==manifest
    for path,info in manifest['files'].items():
        if info['kind']=='parquet':
            table=pq.read_table(output/path)
            assert not {'title','description','phone','latitude'} & set(table.column_names)
            assert all(v>0 for v in table['price_value'].to_pylist())
    assert all(p['processed_rows']==p['expected_rows'] for p in manifest['source_files'])


def test_exact_aggregates_without_listing_download(archive):
    provider,calls=provider_for(archive[0])
    client=TestClient(create_app(data_provider=provider,model_dir=''))
    summary=client.get('/api/v1/dashboard/summary').json()
    assert summary['count']==18 and summary['provenance']['provider']=='prepared'
    assert summary['provenance']['coverage']['source_processing_complete']
    assert summary['provenance']['coverage']['records_examined']==0
    cities=client.get('/api/v1/analytics/cities').json()
    assert sum(c['count'] for c in cities)==18
    dist=client.get('/api/v1/analytics/distributions').json()
    assert sum(b['count'] for b in dist['price'])==18
    assert all('/data/' not in str(r.url) and '/views/' not in str(r.url) for r in calls)
    assert len(calls)==2  # Only manifest and catalog fetched, then verified cache.


@pytest.mark.parametrize('sort',['price_value','building_size','city_slug','price_per_sqm'])
@pytest.mark.parametrize('order',['asc','desc'])
@pytest.mark.parametrize('category',[None,'apartment-sell','house-villa-sell'])
def test_indexed_pagination(archive,sort,order,category):
    provider,calls=provider_for(archive[0])
    results=[]
    for page in range(1,8):
        result=provider.page(PropertyFilters(page=page,page_size=4,sort=sort,order=order,property_type=category))
        results+=result.items
        assert result.coverage.exhaustive and not result.coverage.bounded
    assert len(results)==len({p.id for p in results})
    expected=18 if category is None else 12 if category=='apartment-sell' else 6
    assert len(results)==expected
    assert results==sorted(results,key=lambda p:(getattr(p,sort),p.id),reverse=order=='desc')
    assert all(not category or p.cat3_slug==category for p in results)
    assert not any('/data/' in str(r.url) for r in calls)


def test_city_neighborhood_numeric_filters_comparables_and_lookup(archive):
    provider,calls=provider_for(archive[0])
    client=TestClient(create_app(data_provider=provider,model_dir=''))
    facets=client.get('/api/v1/data/facets?city=tehran').json()
    assert facets['cities']==['shiraz','tehran'] and facets['neighborhoods']==['central','north']
    response=client.get('/api/v1/properties?city=tehran&neighborhood=central&area_min=74&price_max=2200000000')
    assert response.status_code==200,response.text
    data=response.json()
    assert data['total']==3
    assert all(p['city_slug']=='tehran' and p['neighborhood_slug']=='central' and p['building_size']>=74 for p in data['items'])
    first=data['items'][0]
    assert client.get('/api/v1/properties/'+first['id']).json()==first
    body=dict(city_slug='tehran',cat3_slug='apartment-sell',building_size=80,rooms_count=2,floor=1,
        total_floors_count=3,construction_year=1395,has_parking=True,has_elevator=False,has_balcony=False,
        has_warehouse=True,neighborhood_slug='central')
    valuation=client.post('/api/v1/valuation',json=body)
    assert valuation.status_code==200,valuation.text
    value=valuation.json()
    assert value['prediction'] is None and len(value['comparables'])==6
    assert value['comparables'][0]['property']['neighborhood_slug']=='central'
    assert all(c['property']['city_slug']=='tehran' and c['property']['cat3_slug']=='apartment-sell' for c in value['comparables'])
    assert value['provenance']['provider']=='prepared' and value['coverage']['exhaustive']
    # A crowded candidate set must retain the closest eight regardless of order.
    from apps.api.service.schemas import Property, PredictionInput
    from apps.api.service.valuation import rank_comparables
    base=Property.model_validate(value['comparables'][0]['property'])
    crowded=[base.model_copy(update={'id':f'{i:016x}','building_size':80+i,
        'price_per_sqm':base.price_value/(80+i)}) for i in reversed(range(50))]
    ranked=rank_comparables(PredictionInput(**body),crowded)
    assert [r.property.id for r in ranked]==[f'{i:016x}' for i in range(8)]
    assert client.get('/api/v1/health').json()['provider']=='prepared'
    unknown=client.get('/api/v1/dashboard/summary?city=unknown-city').json()
    assert unknown['count']==0 and unknown['median_price'] is None


def test_streamed_original_csv_format(tmp_path):
    source=tmp_path/'source.csv'
    rows=[raw(i) for i in range(4)]
    with source.open('w',encoding='utf-8',newline='') as stream:
        writer=csv.DictWriter(stream,fieldnames=list(rows[0]))
        writer.writeheader();writer.writerows(rows)
    assert inspect_source(source)==4
    part=dict(path=str(source),source_path='real_estate_ads.csv',sha256=file_hash(source),expected_rows=4)
    manifest=build_dataset([part],tmp_path/'result',chunk_rows=2,progress=lambda message:None)
    assert manifest['total_source_rows']==manifest['total_prepared_rows']==4


def test_bad_source_count_and_checksum_fail(archive,tmp_path):
    part=archive[2]
    with pytest.raises(ValueError,match='completely'):
        build_dataset([part|{'expected_rows':23}],tmp_path/'wrong-count',progress=lambda message:None)
    with pytest.raises(ValueError,match='hash'):
        build_dataset([part|{'sha256':'0'*64}],tmp_path/'wrong-hash',progress=lambda message:None)
    with pytest.raises(ValueError,match='duplicated'):
        build_dataset([part,part],tmp_path/'duplicate',progress=lambda message:None)


@pytest.mark.parametrize('target',['manifest.json','catalog.json','partition'])
def test_corrupt_remote_file_returns_503(archive,target):
    def corrupt(path,data):
        return bytes([data[0]^1])+data[1:] if path==target or target=='partition' and path.startswith('data/') else data
    provider,_=provider_for(archive[0],mutate=corrupt)
    client=TestClient(create_app(data_provider=provider,model_dir=''))
    response=client.get('/api/v1/properties?city=tehran&price_min=1')
    assert response.status_code==503
    assert 'integrity' in response.json()['error']['message']


def test_auth_outage_and_global_query_guard(archive):
    provider,_=provider_for(archive[0],status=401)
    client=TestClient(create_app(data_provider=provider,model_dir=''))
    assert client.get('/api/v1/dashboard/summary').status_code==503
    provider,calls=provider_for(archive[0])
    client=TestClient(create_app(data_provider=provider,model_dir=''))
    response=client.get('/api/v1/properties?price_min=10')
    assert response.status_code==503 and 'city' in response.json()['error']['message']
    assert len(calls)==0


def test_missing_prepared_settings_do_not_fall_back(monkeypatch):
    monkeypatch.setenv('AMLAAAK_DATA_MODE','prepared')
    for name in ('HF_TOKEN','AMLAAAK_PREPARED_DATA_REPO','AMLAAAK_PREPARED_DATA_REVISION','AMLAAAK_PREPARED_DATA_MANIFEST_SHA256'):
        monkeypatch.delenv(name,raising=False)
    client=TestClient(create_app(model_dir=''))
    assert client.get('/api/v1/dashboard/summary').status_code==503
    assert client.get('/api/v1/health').json()['provider']=='prepared'


def test_no_upload_without_approval_or_private_target(archive):
    class NoWrites:
        def dataset_info(self,**kwargs):
            return SimpleNamespace(id='thevel0per/AMLAAAK-Real-Estate-Data',private=False)
        def create_commit(self,**kwargs):
            pytest.fail('Upload must not happen')
    with pytest.raises(PermissionError):
        upload_prepared(archive[0],NoWrites(),confirmation='',license_acknowledged=True)
    with pytest.raises(PermissionError):
        upload_prepared(archive[0],NoWrites(),confirmation='UPLOAD PREPARED DATASET',license_acknowledged=False)
    with pytest.raises(ValueError,match='PRIVATE'):
        upload_prepared(archive[0],NoWrites(),confirmation='UPLOAD PREPARED DATASET',license_acknowledged=True)


def test_notebook_self_contained_and_synchronized():
    from scripts.build_prepared_notebook import notebook
    root=Path(__file__).resolve().parents[1]
    actual=json.loads((root/'notebooks/prepare_divar_dataset.ipynb').read_text(encoding='utf-8'))
    assert actual==notebook()
    for cell in actual['cells']:
        if cell['cell_type']=='code':
            assert not cell['outputs'] and cell['execution_count'] is None
            code='\n'.join(line for line in cell['source'].splitlines() if not line.startswith('%'))
            compile(code,'colab-cell','exec')
    assert 'UPLOAD PREPARED DATASET TO HUGGING FACE' in str(actual)


def test_notebook_embedded_processing_and_upload_stop(archive,tmp_path,monkeypatch):
    """Execute the actual notebook code against synthetic inputs; no Colab/network writes."""
    from scripts.build_prepared_notebook import notebook
    from datetime import datetime, timezone
    cells=[c['source'] for c in notebook()['cells'] if c['cell_type']=='code']
    embedded=next(c for c in cells if 'EMBEDDED_SOURCES=' in c)
    namespace={}
    embedded=embedded.replace("Path('/content/amlaaak-preparation')",'Path('+repr(str(tmp_path))+')')
    exec(compile(embedded,'embedded-notebook','exec'),namespace)
    namespace.update(source_parts=[archive[2]],expected_names={'synthetic.parquet'},datetime=datetime,timezone=timezone)
    processing=next(c for c in cells if 'run_id=datetime' in c)
    exec(compile(processing,'processing-notebook','exec'),namespace)
    assert namespace['manifest']['total_prepared_rows']==18
    monkeypatch.setattr('builtins.input',lambda prompt:'')
    upload=next(c for c in cells if 'license_ack=input' in c)
    with pytest.raises(PermissionError,match='not approved'):
        exec(compile(upload,'upload-notebook','exec'),namespace)


def test_approved_upload_transaction_and_readback_are_verified(archive,tmp_path,monkeypatch):
    from apps.api.service.prepared_upload import DATASET_CARD
    import huggingface_hub
    output=archive[0]
    writes=[]
    class FakeHub:
        token='unit-test-token'
        parent='b'*40
        def dataset_info(self,repo_id,revision=None):
            return SimpleNamespace(id=repo_id,private=True,sha=revision or self.parent)
        def create_commit(self,**kwargs):
            writes.append(kwargs)
            assert kwargs['parent_commit']==self.parent
            assert kwargs['repo_type']=='dataset'
            assert all(op.path_in_repo=='README.md' or op.path_in_repo.startswith('prepared/') for op in kwargs['operations'])
            self.parent='c'*40
            return SimpleNamespace(oid=self.parent)
        def list_repo_files(self,**kwargs):
            assert kwargs['revision']=='c'*40
            return ['prepared/'+p for p in list(archive[1]['files'])+['manifest.json']]+['README.md']
    def download(**kwargs):
        assert kwargs['revision']=='c'*40 and kwargs['token']=='unit-test-token'
        if kwargs['filename']=='README.md':
            card=tmp_path/'README.md';card.write_bytes(DATASET_CARD.encode());return str(card)
        return str(output/kwargs['filename'].removeprefix('prepared/'))
    monkeypatch.setattr(huggingface_hub,'hf_hub_download',download)
    result=upload_prepared(output,FakeHub(),confirmation='UPLOAD PREPARED DATASET',license_acknowledged=True)
    assert len(writes)==1 and result['DATASET_REVISION']=='c'*40 and result['TOTAL_CITIES']==2
    assert result['DATASET_MANIFEST_SHA256']==file_hash(output/'manifest.json')
    writes.clear()
    monkeypatch.setattr('apps.api.service.prepared_upload.BATCH_FILES',2)
    upload_prepared(output,FakeHub(),confirmation='UPLOAD PREPARED DATASET',license_acknowledged=True)
    assert len(writes)>1
    assert {op.path_in_repo for op in writes[-1]['operations']}=={'prepared/manifest.json','README.md'}
    assert all(op.path_in_repo!='prepared/manifest.json' for batch in writes[:-1] for op in batch['operations'])


def test_cache_and_safe_query_budget(archive):
    provider,calls=provider_for(archive[0])
    provider.facets(None)
    provider.facets(None)
    assert len(calls)==2
    path=provider.catalog['partitions'][0]
    provider.manifest['files'][path]['rows']=150001
    with pytest.raises(UpstreamUnavailable,match='safe request budget'):
        provider.population(Filters(city=provider.manifest['files'][path]['city']))
    assert len(calls)==2
    assert provider.cache_bytes<=24*1024*1024 and len(provider.cache)<=32


def test_private_token_is_not_forwarded_to_cdn():
    calls=[]
    def handler(request):
        calls.append(request)
        if request.url.host=='huggingface.co':
            assert request.headers['authorization']=='Bearer private-test-token'
            return httpx.Response(302,headers={'location':'https://cdn.example.test/file'})
        assert 'authorization' not in request.headers
        return httpx.Response(200,content=b'verified')
    provider=PreparedDataProvider(repo='test/private',revision='a'*40,manifest_hash='b'*64,
        token='private-test-token',client=httpx.Client(transport=httpx.MockTransport(handler)))
    assert provider._download('manifest.json',sha256(b'verified'),100)==b'verified'
    assert len(calls)==2


def test_dataset_card_identifier_does_not_change_manifest_license(archive):
    from apps.api.service.prepared_upload import DATASET_CARD
    import yaml
    metadata=yaml.safe_load(DATASET_CARD.split('---')[1])
    assert metadata['license']=='odbl'
    assert 'Open Database License 1.0' in DATASET_CARD
    assert archive[1]['license']=='odbl-1.0'


@pytest.mark.parametrize('damage',['city_total','missing_partition','missing_city_view'])
def test_contradictory_or_missing_indexes_are_rejected(archive,damage):
    from apps.api.service.prepared_format import validate_catalog
    catalog=json.loads((archive[0]/'catalog.json').read_bytes())
    if damage=='city_total':
        catalog['groups']['tehran|*']['count']+=1
    elif damage=='missing_partition':
        catalog['partitions'].pop()
    else:
        catalog['city_views']['tehran']['price_value'].pop()
    with pytest.raises((ValueError,KeyError)):
        validate_catalog(archive[1],catalog)


def test_parallel_fetch_is_bounded_and_population_reused(archive,monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    import threading
    provider,calls=provider_for(archive[0])
    provider._ensure()
    active=peak=0
    guard=threading.Lock()
    original=provider._download_verified
    def observed(*args,**kwargs):
        nonlocal active,peak
        with guard:
            active+=1;peak=max(peak,active)
        try:
            time.sleep(.015)
            return original(*args,**kwargs)
        finally:
            with guard:active-=1
    monkeypatch.setattr(provider,'_download_verified',observed)
    with ThreadPoolExecutor(max_workers=3) as executor:
        values=list(executor.map(lambda _:provider.population(Filters(city='tehran')),range(3)))
    assert 1<peak<=4 and all(p is values[0] for p in values)
    assert len(values[0].rows)==9
    assert not provider.inflight


def test_missing_dataset_config_preserves_valuation_prediction(monkeypatch):
    import apps.api.main as module
    from apps.api.service.schemas import ModelStatus,Prediction
    class Model:
        status=ModelStatus(available=True,mode='trained',version='test-model',message='mock model')
        def predict(self,body):
            return Prediction(predicted_price=123,price_per_sqm=123/body.building_size,units='test units',model=self.status,warnings=[])
    monkeypatch.setattr(module,'Inference',lambda directory:Model())
    monkeypatch.setenv('AMLAAAK_DATA_MODE','prepared')
    monkeypatch.delenv('HF_TOKEN',raising=False)
    monkeypatch.delenv('AMLAAAK_API_TOKEN',raising=False)
    client=TestClient(module.create_app(model_dir=''))
    body=dict(city_slug='tehran',cat3_slug='apartment-sell',building_size=90,rooms_count=2,floor=1,
        total_floors_count=3,construction_year=1395,has_parking=True,has_elevator=False,has_balcony=False,has_warehouse=True)
    result=client.post('/api/v1/valuation',json=body)
    assert result.status_code==200 and result.json()['prediction']['predicted_price']==123
    assert result.json()['comparables']==[] and not result.json()['coverage']['exhaustive']
    assert client.get('/api/v1/dashboard/summary').status_code==503


def test_release_verification_is_bounded_and_checks_lfs_inventory(archive):
    from scripts.verify_prepared_release import verify_release
    output,manifest,_=archive
    provider,_=provider_for(output)
    release=dict(repo=provider.repo,revision=provider.revision,manifest_sha256=provider.manifest_hash,
        expected_source_rows=22,expected_prepared_rows=18,expected_cities=2,expected_indexed_files=len(manifest['files']))
    siblings=[SimpleNamespace(rfilename='prepared/'+path,size=info['bytes'],
        lfs={'sha256':info['sha256']} if path!='catalog.json' else None) for path,info in manifest['files'].items()]
    siblings.append(SimpleNamespace(rfilename='prepared/manifest.json',size=1,lfs=None))
    class API:
        def dataset_info(self,**kwargs):
            if kwargs['repo_id']=='divarofficial/real_estate_ads':
                return SimpleNamespace(id=kwargs['repo_id'],sha=SOURCE_REVISION,siblings=[
                    SimpleNamespace(rfilename=archive[2]['source_path'],lfs={'sha256':archive[2]['sha256']})])
            return SimpleNamespace(id=provider.repo,sha=provider.revision,private=True,siblings=siblings)
    result=verify_release('test-token',release,api=API(),provider=provider)
    assert result['hub_lfs_sha256_matches']==len(manifest['files'])-1
    assert result['direct_indexed_file_body_hash_matches']==5 and not result['full_archive_body_downloaded']
    siblings[0].size+=1
    with pytest.raises(ValueError,match='size mismatch'):
        verify_release('test-token',release,api=API(),provider=provider)

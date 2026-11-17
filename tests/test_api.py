"""Serving contracts, filtering, privacy, and real artifact inference."""
import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from apps.api.main import create_app
from apps.api.service.analytics import histogram
from amlaaak.training import train
from scripts.prepare_dashboard import export

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / 'apps/api/assets/sample.json'
BODY = {'city_slug': 'tehran', 'cat3_slug': 'apartment-sell', 'building_size': 90,
        'rooms_count': 2, 'floor': 2, 'total_floors_count': 5, 'construction_year': 1395,
        'has_parking': True, 'has_elevator': True, 'has_balcony': False, 'has_warehouse': False}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv('AMLAAAK_API_TOKEN', raising=False)
    return TestClient(create_app(SNAPSHOT, model_dir=''))


@pytest.fixture(scope='module')
def bundle(tmp_path_factory):
    temp = tmp_path_factory.mktemp('api-model')
    train(ROOT / 'sample database.csv', temp / 'training')
    export(ROOT / 'sample database.csv', temp / 'sample.json', 'illustrative', 'test', temp / 'training', temp / 'model')
    return temp / 'model'


@pytest.mark.parametrize('route', ['health','model/status','dashboard/summary','analytics/cities','analytics/distributions','properties','model/metrics'])
def test_routes(client, route):
    response = client.get('/api/v1/' + route)
    assert response.status_code == 200
    assert response.headers['cache-control'] == 'no-store'
    assert response.headers.get('x-request-id')


def test_summary_and_filters(client):
    summary = client.get('/api/v1/dashboard/summary').json()
    assert summary['count'] == 8 and summary['cities_count'] == 4
    assert summary['provenance']['kind'] == 'illustrative'
    assert summary['median_price'] == 1350000000
    assert client.get('/api/v1/dashboard/summary?city=tehran').json()['count'] == 5
    assert client.get('/api/v1/dashboard/summary?property_type=house-villa-sell').json()['count'] == 2
    assert client.get('/api/v1/dashboard/summary?city=tehran&area_min=100').json()['count'] == 2
    empty = client.get('/api/v1/dashboard/summary?city=not-present').json()
    assert empty['count'] == 0 and empty['median_price'] is None


def test_distributions_are_counted(client):
    data = client.get('/api/v1/analytics/distributions').json()
    for field in ('price','area','year','property_types'):
        assert sum(row['count'] for row in data[field]) == 8
    assert len(data['price_area']) == 8
    assert data['missing_years'] == 0
    assert all(a['known'] == 8 for a in data['amenities'])
    assert histogram([]) == []
    assert histogram([2,2])[0].count == 2


def test_pagination_sort_search_and_detail(client):
    first = client.get('/api/v1/properties?city=tehran&page=1&page_size=2&sort=price_value&order=asc').json()
    second = client.get('/api/v1/properties?city=tehran&page=2&page_size=2&sort=price_value&order=asc').json()
    assert first['total'] == 5 and len(first['items']) == 2
    assert {r['id'] for r in first['items']}.isdisjoint({r['id'] for r in second['items']})
    assert first['items'][0]['price_value'] <= first['items'][1]['price_value']
    property_id = first['items'][0]['id']
    detail = client.get('/api/v1/properties/' + property_id).json()
    assert detail == first['items'][0]
    for private in ('description','title','location_latitude','location_longitude','user_type','neighborhood_slug'):
        assert private not in detail
    assert client.get('/api/v1/properties?search=shiraz').json()['total'] == 1
    assert client.get('/api/v1/properties/unknown').status_code == 404


@pytest.mark.parametrize('query', ['area_min=200&area_max=100','page=0','page_size=101','sort=description','year_min=1000','city=x&unexpected=1'])
def test_invalid_filters(client, query):
    response = client.get('/api/v1/properties?' + query)
    assert response.status_code == 422 and 'error' in response.json()


def test_unavailable_is_not_fake_prediction(client):
    assert client.get('/api/v1/model/status').json()['available'] is False
    response = client.post('/api/v1/predict', json=BODY)
    assert response.status_code == 503 and 'predicted_price' not in response.json()
    assert client.get('/api/v1/model/metrics').json()['scores'] is None


@pytest.mark.parametrize('change', [{'building_size':0},{'floor':6},{'construction_year':2024},{'cat3_slug':'apartment-rent'},{'city_slug':'../foo'},{'building_size':'NaN'},{'description':'not permitted'}])
def test_prediction_validation(client, change):
    response = client.post('/api/v1/predict', json={**BODY, **change})
    assert response.status_code == 422


def test_real_prediction_and_metrics(bundle, monkeypatch):
    monkeypatch.delenv('AMLAAAK_API_TOKEN', raising=False)
    client = TestClient(create_app(SNAPSHOT, str(bundle)))
    status = client.get('/api/v1/model/status').json()
    assert status['available'] and status['mode'] == 'illustrative'
    one = client.post('/api/v1/predict', json=BODY).json()
    two = client.post('/api/v1/predict', json=BODY).json()
    assert one == two and one['predicted_price'] > 0
    assert one['price_per_sqm'] == one['predicted_price'] / 90
    assert any('DEMO' in warning for warning in one['warnings'])
    metrics = client.get('/api/v1/model/metrics').json()
    assert metrics['train_rows'] == 6 and metrics['test_rows'] == 2
    assert metrics['scores']['random_forest']['mae'] == 174500000
    assert metrics['residuals_available'] is False


def test_bad_bundle_fails_closed(bundle, tmp_path, monkeypatch):
    import shutil
    monkeypatch.delenv('AMLAAAK_API_TOKEN', raising=False)
    shutil.copytree(bundle, tmp_path / 'bad')
    (tmp_path / 'bad' / 'model.joblib').write_bytes(b'not a model')
    client = TestClient(create_app(SNAPSHOT, str(tmp_path / 'bad')))
    assert client.get('/api/v1/model/status').json()['available'] is False
    assert client.post('/api/v1/predict', json=BODY).status_code == 503


def test_missing_snapshot_and_token(tmp_path, monkeypatch):
    monkeypatch.setenv('AMLAAAK_API_TOKEN', 'test-only-token')
    client = TestClient(create_app(tmp_path / 'missing.json', model_dir=''))
    assert client.get('/api/v1/health').json()['status'] == 'degraded'
    assert client.get('/api/v1/dashboard/summary').status_code == 401
    assert client.get('/api/v1/dashboard/summary', headers={'Authorization':'Bearer test-only-token'}).status_code == 503


def test_export_privacy_and_refusal(tmp_path):
    path = tmp_path / 'snapshot.json'
    export(ROOT / 'sample database.csv', path, 'illustrative', 'test')
    data = json.loads(path.read_text())
    assert len(data['properties']) == 8
    assert 'description' not in data['properties'][0]
    with pytest.raises(ValueError, match='already exists'):
        export(ROOT / 'sample database.csv', path, 'illustrative', 'test')
    with pytest.raises(ValueError, match='must be labeled'):
        export(ROOT / 'sample database.csv', tmp_path / 'fake.json', 'divar', 'test')

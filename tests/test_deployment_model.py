"""Deployment contracts and opt-in verification of the approved public model."""
import json
import os
from pathlib import Path
import time
import tomllib

import pytest

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / 'apps/api/vercel.json').read_text())


def test_deployment_dependencies_match_trained_model():
    versions = json.loads((ROOT / 'docs/REAL_DATA_EXPERIMENT.json').read_text())['versions']
    requirements = (ROOT / 'apps/api/requirements.txt').read_text().splitlines()
    project = tomllib.loads((ROOT / 'apps/api/pyproject.toml').read_text())['project']
    for package in ('numpy', 'pandas', 'scikit-learn', 'joblib'):
        pinned = f'{package}=={versions[package]}'
        assert pinned in requirements and pinned in project['dependencies']
    assert CONFIG['env']['AMLAAAK_DATA_MODE'] == 'huggingface'


@pytest.mark.live
@pytest.mark.skipif(os.getenv('AMLAAAK_RUN_REMOTE_MODEL_TESTS') != '1',
                    reason='Explicit opt-in required for public model download and genuine data retrieval')
def test_approved_public_model_and_real_valuation(monkeypatch):
    # Import before setting env: the module-level app must not download a second copy.
    from apps.api.main import create_app
    from apps.api.service.schemas import PredictionInput
    from fastapi.testclient import TestClient

    for key, value in CONFIG['env'].items():
        monkeypatch.setenv(key, value)
    monkeypatch.delenv('AMLAAAK_MODEL_DIR', raising=False)
    monkeypatch.delenv('AMLAAAK_API_TOKEN', raising=False)
    started = time.perf_counter()
    app = create_app()
    provision_seconds = time.perf_counter() - started
    inference = app.state.inference
    assert inference.status.available and inference.status.mode == 'trained'
    assert inference.status.version == '267eff7c36f3'
    body = dict(city_slug='tehran', cat3_slug='apartment-sell', building_size=90,
                rooms_count=2, floor=2, total_floors_count=5, construction_year=1395,
                has_parking=True, has_elevator=True, has_balcony=False, has_warehouse=False)
    direct = inference.predict(PredictionInput(**body))
    assert direct.predicted_price > 0
    client = TestClient(app)
    started = time.perf_counter()
    response = client.post('/api/v1/valuation', json=body)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result['prediction']['predicted_price'] == direct.predicted_price
    assert result['provenance']['provider'] == 'huggingface'
    assert result['coverage']['records_examined'] > 0
    assert result['comparables']
    assert all(row['property']['source_identity'].startswith('hf://datasets/')
               for row in result['comparables'])
    print(json.dumps({'provision_seconds': round(provision_seconds, 3),
                      'valuation_seconds': round(time.perf_counter() - started, 3),
                      'predicted_price': direct.predicted_price,
                      'model_version': inference.status.version,
                      'comparables': len(result['comparables']),
                      'records_examined': result['coverage']['records_examined']}))

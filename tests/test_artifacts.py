"""Remote artifact provisioning trust guards; network is mocked at the boundary."""
import hashlib
import json
import httpx
import pytest
from apps.api.service import artifacts


def test_no_remote_source_without_explicit_operator_configuration(monkeypatch):
    monkeypatch.delenv('AMLAAAK_MODEL_REPO',raising=False)
    assert artifacts.provision_model() is None
    monkeypatch.setenv('AMLAAAK_MODEL_REPO','untrusted/repo')
    monkeypatch.delenv('AMLAAAK_MODEL_REVISION',raising=False)
    with pytest.raises(ValueError,match='approved'):
        artifacts.provision_model()


def test_pinned_manifest_and_file_integrity(monkeypatch,tmp_path):
    model=b'unit-test-artifact-not-executed'
    metadata=b'{}'
    manifest=json.dumps({'kind':'divar','model_sha256':hashlib.sha256(model).hexdigest(),
                         'metadata_sha256':hashlib.sha256(metadata).hexdigest()}).encode()
    monkeypatch.setenv('AMLAAAK_MODEL_REPO','test-owner/test-repo')
    monkeypatch.setenv('AMLAAAK_MODEL_REVISION','a'*40)
    monkeypatch.setenv('AMLAAAK_MODEL_MANIFEST_SHA256',hashlib.sha256(manifest).hexdigest())
    files={'manifest.json':manifest,'metadata.json':metadata,'model.joblib':model}
    client=httpx.Client(transport=httpx.MockTransport(lambda r:httpx.Response(200,content=files[r.url.path.rsplit('/',1)[1]])))
    monkeypatch.setattr(artifacts.httpx,'Client',lambda **kwargs:client)
    monkeypatch.setattr(artifacts.tempfile,'mkdtemp',lambda **kwargs:str(tmp_path))
    assert artifacts.provision_model()==str(tmp_path)
    assert (tmp_path/'model.joblib').read_bytes()==model
    # This tests download verification only. Actual sklearn inference has separate tests.


@pytest.mark.parametrize('corrupted', ['manifest.json', 'metadata.json', 'model.joblib'])
def test_remote_corruption_is_rejected(monkeypatch, tmp_path, corrupted):
    files = {'metadata.json': b'{}', 'model.joblib': b'not-executed'}
    files['manifest.json'] = json.dumps({
        'kind': 'divar', 'model_sha256': hashlib.sha256(files['model.joblib']).hexdigest(),
        'metadata_sha256': hashlib.sha256(files['metadata.json']).hexdigest(),
    }).encode()
    monkeypatch.setenv('AMLAAAK_MODEL_REPO', 'test-owner/test-repo')
    monkeypatch.setenv('AMLAAAK_MODEL_REVISION', 'a' * 40)
    monkeypatch.setenv('AMLAAAK_MODEL_MANIFEST_SHA256', hashlib.sha256(files['manifest.json']).hexdigest())
    files[corrupted] += b'corruption'
    client = httpx.Client(transport=httpx.MockTransport(
        lambda request: httpx.Response(200, content=files[request.url.path.rsplit('/', 1)[1]])))
    monkeypatch.setattr(artifacts.httpx, 'Client', lambda **kwargs: client)
    monkeypatch.setattr(artifacts.tempfile, 'mkdtemp', lambda **kwargs: str(tmp_path))
    with pytest.raises(ValueError, match='integrity'):
        artifacts.provision_model()

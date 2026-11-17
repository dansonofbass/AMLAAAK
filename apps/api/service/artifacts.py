"""Optional operator-approved, revision-pinned Hugging Face model provisioning."""
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import httpx


def provision_model():
    repo = os.getenv('AMLAAAK_MODEL_REPO')
    if not repo:
        return None
    revision = os.getenv('AMLAAAK_MODEL_REVISION', '')
    manifest_hash = os.getenv('AMLAAAK_MODEL_MANIFEST_SHA256', '')
    if not re.fullmatch(r'[\w.-]+/[\w.-]+', repo) or not re.fullmatch(r'[a-f0-9]{40}', revision) or not re.fullmatch(r'[a-f0-9]{64}', manifest_hash):
        raise ValueError('Remote artifacts require an approved owner/repo, fixed revision and manifest SHA-256')
    directory = Path(tempfile.mkdtemp(prefix='amlaaak-model-'))
    headers = {'Authorization': 'Bearer ' + os.environ['HF_TOKEN']} if os.getenv('HF_TOKEN') else {}
    with httpx.Client(timeout=15, follow_redirects=True, headers=headers) as client:
        def download(name, expected, maximum):
            data = bytearray()
            with client.stream('GET', f'https://huggingface.co/{repo}/resolve/{revision}/{name}') as response:
                response.raise_for_status()
                for block in response.iter_bytes():
                    data.extend(block)
                    if len(data) > maximum:
                        raise ValueError('Artifact exceeds download size guard')
            if hashlib.sha256(data).hexdigest() != expected:
                raise ValueError('Artifact integrity verification failed')
            (directory/name).write_bytes(data)
            return data
        manifest = json.loads(download('manifest.json', manifest_hash, 128*1024))
        download('metadata.json', manifest['metadata_sha256'], 2*1024*1024)
        download('model.joblib', manifest['model_sha256'], 100*1024*1024)
    return str(directory)

"""Explicit Colab-only publication and read-back verification, never HTTP serving."""
import json
from pathlib import Path
import re

from .prepared_format import TARGET_REPO, file_hash, sha256
from .preparation import validate_output

BATCH_FILES = 200
BATCH_BYTES = 32 * 1024 * 1024

DATASET_CARD = '''---
license: odbl-1.0
language:
- fa
task_categories:
- tabular-regression
---
# AMLAAAK prepared historical residential sales

Derived from Divar's [official real_estate_ads dataset](https://huggingface.co/datasets/divarofficial/real_estate_ads),
revision e9446ee97b8e6eb9bd62bdfd7548f1bc8973be85, under the
[Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
Attribution: Divar / divarofficial. Preserve the original source attribution and
ODbL notices when using or redistributing this derived database. Private storage
does not remove license obligations. Review the source card and license before sharing.

Transformations: structured-field allowlist, numeral/numeric/boolean/year parsing,
fixed-price apartment/house-villa sale eligibility, rental exclusion, and exact
normalized-safe-field deduplication (which can merge distinct homes).
No descriptions, titles, contacts, advertisement tokens, listing URLs or exact
coordinates are included. Geographic fields are public city/neighborhood slugs.
Historical asking prices retain original source units; currency is unverified.
Records are not active advertisements. This archive is not new model training data.

`prepared/manifest.json` describes verified source partitions, counts, schema,
file SHA-256 hashes and processing coverage. Parquet is the research interchange;
checksummed gzip JSON chunks and indexes support bounded serverless serving.
The raw source and temporary staging database are not uploaded.
'''


def upload_prepared(output, api, *, confirmation, license_acknowledged, repo=TARGET_REPO):
    """No remote writes before exact confirmation, privacy/integrity and private-repo checks.

    Caller must display the file/record summary and proposed README before asking.
    Large uploads use bounded commits; manifest/card are published last. No
    repository creation, visibility change, deletions, or model uploads occur.
    """
    if confirmation != 'UPLOAD PREPARED DATASET' or license_acknowledged is not True:
        raise PermissionError('Upload not approved; no remote files were changed')
    if repo != TARGET_REPO:
        raise ValueError('Target dataset identity differs from the approved private repository')
    root=Path(output)
    manifest=validate_output(root)
    if not manifest['full_source_verified']:
        raise ValueError('Full pinned-source processing has not been verified; refusing upload')
    info=api.dataset_info(repo_id=repo)
    if info.id != repo or info.private is not True:
        raise ValueError('Upload requires the existing approved PRIVATE dataset repository')
    from huggingface_hub import CommitOperationAdd
    paths=sorted(manifest['files'])+['manifest.json']
    parent=info.sha
    def commit(operations):
        nonlocal parent
        result=api.create_commit(repo_id=repo,repo_type='dataset',operations=operations,
            commit_message='Prepare verified historical Divar sales archive',parent_commit=parent)
        if not re.fullmatch(r'[a-f0-9]{40}',result.oid):
            raise ValueError('Upload returned an invalid immutable revision')
        parent=result.oid
        print(f'Committed {len(operations)} prepared file operation(s); revision {parent}')
    operations=[]
    size=0
    for path in sorted(manifest['files']):
        current=manifest['files'][path]['bytes']
        if operations and (len(operations)>=BATCH_FILES or size+current>BATCH_BYTES):
            commit(operations)
            operations=[]
            size=0
        operations.append(CommitOperationAdd(path_in_repo='prepared/'+path,path_or_fileobj=str(root/path)))
        size+=current
    final=[CommitOperationAdd(path_in_repo='prepared/manifest.json',path_or_fileobj=str(root/'manifest.json')),
           CommitOperationAdd(path_in_repo='README.md',path_or_fileobj=DATASET_CARD.encode())]
    if operations and (len(operations)+2>BATCH_FILES or size+(root/'manifest.json').stat().st_size+len(DATASET_CARD.encode())>BATCH_BYTES):
        commit(operations)
        operations=[]
    commit(operations+final)  # Only this last commit publishes the new ready manifest.
    revision=parent
    remote=api.dataset_info(repo_id=repo,revision=revision)
    if remote.id != repo or remote.private is not True or remote.sha != revision:
        raise ValueError('Uploaded repository identity/revision verification failed')
    uploaded=set(api.list_repo_files(repo_id=repo,repo_type='dataset',revision=revision))
    required={'prepared/'+p for p in paths}|{'README.md'}
    if not required <= uploaded:
        raise ValueError('Uploaded file inventory is incomplete')
    # Download from the immutable commit to a new verification cache. Do not
    # accept the local upload source as proof of remote integrity.
    from huggingface_hub import hf_hub_download
    import tempfile
    cache=tempfile.mkdtemp(prefix='amlaaak-upload-verify-')
    for index,path in enumerate(paths,1):
        fetched=hf_hub_download(repo_id=repo,repo_type='dataset',revision=revision,
            filename='prepared/'+path,token=api.token,cache_dir=cache)
        expected=file_hash(root/'manifest.json') if path=='manifest.json' else manifest['files'][path]['sha256']
        if file_hash(fetched)!=expected:
            raise ValueError('Remote read-back integrity verification failed')
        if index%100==0 or index==len(paths):
            print(f'Remote integrity verified: {index}/{len(paths)} files')
    card=hf_hub_download(repo_id=repo,repo_type='dataset',revision=revision,
        filename='README.md',token=api.token,cache_dir=cache)
    if file_hash(card)!=sha256(DATASET_CARD.encode()):
        raise ValueError('Remote attribution card integrity verification failed')
    result=dict(DATASET_REPO=repo,DATASET_REVISION=revision,
        DATASET_MANIFEST_SHA256=file_hash(root/'manifest.json'),TOTAL_SOURCE_ROWS=manifest['total_source_rows'],
        TOTAL_PREPARED_ROWS=manifest['total_prepared_rows'],TOTAL_CITIES=manifest['total_cities'])
    print('\nVERIFIED UPLOAD — COPY THESE VALUES\n'+json.dumps(result,indent=2))
    return result

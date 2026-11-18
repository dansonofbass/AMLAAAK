"""Read-only verification of the pinned private release; never download the full archive.

Checks every inventory size and available Hub LFS SHA256. Directly hashes non-LFS
files and a bounded sample (at most 32 MiB additional bodies), discarding file bytes.
No writes to Hugging Face, deployment, model changes or private listing exports.
"""
import argparse
from datetime import datetime, timezone
import getpass
import json
import os
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from apps.api.service.prepared import PreparedDataProvider
from apps.api.service.prepared_format import SOURCE_REPO, SOURCE_REVISION

RELEASE=ROOT/'apps/api/prepared-release.json'


def verify_release(token, release, *, sample_files=4, api=None, provider=None):
    if not 0<=sample_files<=12:
        raise ValueError('Sample count must be between 0 and 12')
    if api is None:
        from huggingface_hub import HfApi
        api=HfApi(token=token)
    info=api.dataset_info(repo_id=release['repo'],revision=release['revision'],files_metadata=True)
    if info.id!=release['repo'] or info.sha!=release['revision'] or info.private is not True:
        raise ValueError('Private dataset identity/revision verification failed')
    provider=provider or PreparedDataProvider(repo=release['repo'],revision=release['revision'],
        manifest_hash=release['manifest_sha256'],token=token)
    provider._ensure()  # Verifies actual manifest/catalog bodies and index totals.
    manifest=provider.manifest
    for field,expected in [('total_source_rows','expected_source_rows'),('total_prepared_rows','expected_prepared_rows'),
                           ('total_cities','expected_cities')]:
        if manifest[field]!=release[expected]:
            raise ValueError('Release counts differ from the approved declaration')
    if not manifest['full_source_verified'] or len(manifest['files'])!=release['expected_indexed_files']:
        raise ValueError('Incomplete source processing claim or unexpected indexed file count')
    source=api.dataset_info(repo_id=SOURCE_REPO,revision=SOURCE_REVISION,files_metadata=True)
    expected_source={f.rfilename:f for f in source.siblings if f.rfilename.endswith(('.csv','.parquet'))}
    if (source.id!=SOURCE_REPO or source.sha!=SOURCE_REVISION
            or set(expected_source)!={p['source_path'] for p in manifest['source_files']}):
        raise ValueError('Published source inventory differs from the pinned official repository')
    for part in manifest['source_files']:
        lfs=getattr(expected_source[part['source_path']],'lfs',None)
        digest=lfs.get('sha256') if isinstance(lfs,dict) else getattr(lfs,'sha256',None)
        if digest!=part['sha256']:
            raise ValueError('Published source hash differs from the pinned official source')
    remote={f.rfilename:f for f in info.siblings}
    if 'prepared/manifest.json' not in remote:
        raise ValueError('Manifest missing from remote inventory')
    lfs_count=0
    body_count=0
    body_bytes=0
    directly_verified={'catalog.json'}  # Already byte/hash verified by _ensure.
    for path,expected in manifest['files'].items():
        actual=remote.get('prepared/'+path)
        if actual is None or actual.size!=expected['bytes']:
            raise ValueError('Missing prepared file or remote size mismatch')
        lfs=getattr(actual,'lfs',None)
        if lfs:
            digest=lfs.get('sha256') if isinstance(lfs,dict) else lfs.sha256
            if digest!=expected['sha256']:
                raise ValueError('Remote LFS content hash differs from trusted inventory')
            lfs_count+=1
        elif path not in directly_verified:
            if body_bytes+expected['bytes']>32*1024*1024:
                raise ValueError('Direct verification would exceed the bounded byte budget')
            provider._download(path,expected['sha256'],expected['bytes'],expected['bytes'])
            body_bytes+=expected['bytes']
            directly_verified.add(path)
    chosen=[]
    # Different file kinds, deterministic choices. No listing contents enter report.
    for kind in ('partition','parquet','lookup','view'):
        path=next((p for p,f in sorted(manifest['files'].items()) if f['kind']==kind and p not in directly_verified),None)
        if path:
            chosen.append(path)
    chosen += [p for p in sorted(manifest['files']) if p not in directly_verified and p not in chosen]
    for path in chosen[:sample_files]:
        expected=manifest['files'][path]
        if body_bytes+expected['bytes']>32*1024*1024:
            raise ValueError('Sample verification would exceed the bounded byte budget')
        provider._download(path,expected['sha256'],expected['bytes'],expected['bytes'])
        body_bytes+=expected['bytes']
        directly_verified.add(path)
    body_count=len(directly_verified)
    return dict(verified_at=datetime.now(timezone.utc).isoformat(),repo=release['repo'],revision=info.sha,private=True,
        manifest_sha256=release['manifest_sha256'],manifest_body_hash_verified=True,
        source_rows=manifest['total_source_rows'],prepared_sales=manifest['total_prepared_rows'],cities=manifest['total_cities'],
        indexed_files=len(manifest['files']),remote_repository_files=len(remote),missing_indexed_files=0,size_mismatches=0,
        hub_lfs_sha256_matches=lfs_count,direct_indexed_file_body_hash_matches=body_count,
        additional_sample_body_bytes=body_bytes,catalog_body_verified=True,
        published_completeness_claim_consistent=True,all_catalog_indexes_consistent=True,
        official_source_inventory_hashes_matched=len(expected_source),
        full_archive_body_downloaded=False,raw_source_reprocessed=False,production_activation_performed_by_this_command=False,
        production_status='not_checked_by_this_command',
        scope='All inventory sizes and available Hub LFS SHA256; catalog/non-LFS bodies and bounded samples. '
              'The published source completeness claim and archive index totals agree; raw source was not reprocessed.')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sample-files',type=int,default=4)
    parser.add_argument('--prompt-token',action='store_true',help='Ignore cached credentials and enter a read token privately')
    parser.add_argument('--output',type=Path,default=ROOT/'data/prepared-release-verification.json')
    args=parser.parse_args()
    token=None if args.prompt_token else os.getenv('HF_TOKEN')
    if not token and not args.prompt_token:
        try:
            from huggingface_hub import get_token
            token=get_token()
        except ImportError:
            pass
    if not token:
        token=getpass.getpass('Hugging Face dataset READ token (hidden): ').strip()
    if not token:
        raise SystemExit('A read-only token is required; no verification was performed.')
    try:
        result=verify_release(token,json.loads(RELEASE.read_text(encoding='utf-8')),sample_files=args.sample_files)
    except Exception as exc:
        # Never print request/redirect URLs or credentials in a traceback.
        raise SystemExit(f'Private verification failed ({type(exc).__name__}). Check access, release pins and artifact integrity.') from None
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,indent=2))


if __name__=='__main__':
    main()

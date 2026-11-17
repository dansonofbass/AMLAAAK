"""Regenerate the self-contained Colab notebook after editing preparation modules."""
import json
from pathlib import Path
import textwrap

ROOT=Path(__file__).resolve().parents[1]
MODULES=('normalization','schemas','prepared_format','preparation','prepared_upload')


def notebook():
    cells=[]
    def md(source):
        cells.append(dict(cell_type='markdown',id=f'cell-{len(cells):02d}',metadata={},source=textwrap.dedent(source).strip()+'\n'))
    def code(source):
        cells.append(dict(cell_type='code',id=f'cell-{len(cells):02d}',metadata={},execution_count=None,outputs=[],source=textwrap.dedent(source).strip()+'\n'))

    md('''
    # AMLAAAK — prepare the complete pinned historical Divar archive

    **Run this in Google Colab, not on your laptop.** Choose **Runtime → Run all**.
    No Python editing is needed. A CPU runtime is sufficient; keep the tab connected.
    Processing and final read-back may take a substantial time. If Colab disconnects,
    no completeness or upload success is implied; use a fresh runtime and run again.

    The pinned source currently contains real_estate_ads.csv, not Parquet. It is read with Hugging Face Datasets streaming from the Colab cache; Parquet output is generated here.

    This notebook is self-contained and embeds the reviewed repository preparation
    code. It reads every CSV/Parquet source partition at the immutable source revision, uses
    disk-backed staging and bounded batches, strips personal/free-text fields, and
    prepares residential fixed-price **sales only**. Rental rows are counted and
    excluded; their prices are never mixed with sales. It does **not** train or change
    the existing Random Forest. Source currency units remain unverified.

    Nothing is uploaded until you review the results, acknowledge the source ODbL
    license, and type the exact final confirmation. Only the existing **private**
    `thevel0per/AMLAAAK-Real-Estate-Data` repository can be targeted. You will need
    a Hugging Face write token for that dataset (never put it into a code cell).
    ''')
    code('''
    %pip -q install pyarrow==23.0.1 pydantic==2.14.3 huggingface_hub==0.36.2 datasets==4.6.1
    ''')
    sources={name:(ROOT/f'apps/api/service/{name}.py').read_text(encoding='utf-8') for name in MODULES}
    code(textwrap.dedent('''
    # Embedded source: generated from the reviewed AMLAAAK preparation modules.
    import json, sys
    from pathlib import Path
    WORK=Path('/content/amlaaak-preparation')
    WORK.mkdir(parents=True,exist_ok=True)
    PACKAGE=WORK/'amlaaak_colab'
    PACKAGE.mkdir(exist_ok=True)
    (PACKAGE/'__init__.py').write_text('',encoding='utf-8')
    ''')+'\nEMBEDDED_SOURCES='+repr(sources)+'''\nfor name, source in EMBEDDED_SOURCES.items():
    (PACKAGE/(name+'.py')).write_text(source,encoding='utf-8')
sys.path.insert(0,str(WORK))
from amlaaak_colab.prepared_format import SOURCE_REPO, SOURCE_REVISION, TARGET_REPO, file_hash
from amlaaak_colab.preparation import build_dataset, validate_output, inspect_source
from amlaaak_colab.prepared_upload import upload_prepared, DATASET_CARD
''')
    md('## 1. Check the Colab runtime and pinned source inventory')
    code('''
    import os, shutil
    import pyarrow as pa
    from huggingface_hub import HfApi, hf_hub_download, DatasetCard
    from datetime import datetime, timezone
    assert Path('/content').exists(), 'Use Google Colab for full-source processing.'
    free=shutil.disk_usage('/content').free
    ram=os.sysconf('SC_PAGE_SIZE')*os.sysconf('SC_PHYS_PAGES')
    print(f'RAM: {ram/2**30:.1f} GiB; free disk: {free/2**30:.1f} GiB; CPU count: {os.cpu_count()}')
    assert free>8*2**30, 'At least 8 GiB free Colab disk is required; choose a fresh runtime.'
    assert ram>3*2**30, 'Choose a Colab runtime with at least 3 GiB RAM.'
    pa.set_cpu_count(2)
    public_api=HfApi(token=False)
    info=public_api.dataset_info(repo_id=SOURCE_REPO,revision=SOURCE_REVISION,files_metadata=True)
    assert info.sha==SOURCE_REVISION, 'Pinned revision did not resolve exactly.'
    source_card_path=hf_hub_download(repo_id=SOURCE_REPO,repo_type='dataset',revision=SOURCE_REVISION,filename='README.md',token=False)
    source_card=DatasetCard.load(source_card_path)
    assert source_card.data.to_dict().get('license') in ('odbl','odbl-1.0'), 'Unexpected source license; stop and review.'
    print('Source attribution: Divar / divarofficial; license ODbL 1.0')
    print('Review: https://huggingface.co/datasets/divarofficial/real_estate_ads')
    print('License: https://opendatacommons.org/licenses/odbl/1-0/')
    tree=list(public_api.list_repo_tree(repo_id=SOURCE_REPO,repo_type='dataset',revision=SOURCE_REVISION,recursive=True))
    partitions=sorted([f for f in tree if getattr(f,'path','').endswith(('.csv','.parquet'))],key=lambda f:f.path)
    expected_names={f.rfilename for f in info.siblings if f.rfilename.endswith(('.csv','.parquet'))}
    assert partitions and {f.path for f in partitions}==expected_names, 'Source inventories disagree or are empty.'
    assert all(getattr(f,'lfs',None) and f.lfs.sha256 for f in partitions), 'Every source partition must have an independently pinned LFS SHA256.'
    print('EXACT SOURCE REVISION:',SOURCE_REVISION)
    print('Expected source partitions:',len(partitions))
    for f in partitions:
        print(f.path, f.size, 'bytes; SHA256',f.lfs.sha256)
    ''')
    md('''
    ## 2. Read all source partitions directly into Colab

    Downloads stay in the temporary Colab runtime. Only the structured allowlist is
    read into batches; raw descriptions/contacts are never copied into prepared files.
    Original source files remain only in the Colab cache and are **not uploaded**.
    ''')
    code('''
    import pyarrow.parquet as pq
    from tqdm.auto import tqdm
    source_parts=[]
    for part in tqdm(partitions,desc='Pinned source files'):
        local=hf_hub_download(repo_id=SOURCE_REPO,repo_type='dataset',revision=SOURCE_REVISION,
            filename=part.path,token=False,cache_dir=str(WORK/'source-cache'))
        assert Path(local).stat().st_size==part.size, 'Source size mismatch'
        assert file_hash(local)==part.lfs.sha256, 'Source integrity mismatch'
        source_parts.append(dict(path=local,source_path=part.path,sha256=part.lfs.sha256,
                                 expected_rows=inspect_source(local)))
    assert {p['source_path'] for p in source_parts}==expected_names, 'Missing source partitions'
    print('TOTAL EXPECTED SOURCE ROWS:',sum(p['expected_rows'] for p in source_parts))
    print('All pinned source files are present and hash-verified in Colab.')
    ''')
    md('''
    ## 3. Prepare, index, validate and count

    Uses batches of 1,024 source records and output chunks of at most 2,000 records.
    A temporary on-disk SQLite staging file performs deduplication and exact aggregate
    calculations. It is not a hosted database and is never uploaded. The application
    receives Parquet plus compact indexed gzip JSON serving files, including global
    sorted page indexes, exact city/category statistics, and neighborhood indexes.
    Deduplication compares normalized safe fields (including month and neighborhood);
    it may merge different homes with identical recorded specifications. The manifest
    reports this limitation and all exclusions. All represented valid source slugs
    are handled without a hardcoded city allowlist; invalid slugs are reported.
    ''')
    code('''
    run_id=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    OUTPUT=WORK/('prepared-'+run_id)
    manifest=build_dataset(source_parts,OUTPUT)
    manifest=validate_output(OUTPUT)
    assert manifest['full_source_verified']
    assert manifest['total_source_rows']==sum(p['expected_rows'] for p in source_parts)
    assert {p['source_path'] for p in manifest['source_files']}==expected_names
    print(json.dumps({k:manifest[k] for k in ['total_source_rows','expected_source_rows','total_prepared_rows','total_cities','full_source_verified','counts']},indent=2))
    print('MANIFEST SHA256:',file_hash(OUTPUT/'manifest.json'))
    print('Output files:',len(manifest['files'])+1)
    print('Output size (MiB):',round(sum(p.stat().st_size for p in OUTPUT.rglob('*') if p.is_file())/2**20,2))
    print('Privacy validation passed: no raw titles, descriptions, contact details, exact coordinates or advertisement tokens.')
    print('No upload has occurred. Current model remains unchanged.')
    ''')
    md('''
    ## UPLOAD PREPARED DATASET TO HUGGING FACE

    Review the counts above. Continue **only** if every source partition completed
    and validation succeeded. Review the attribution card below and the source
    [ODbL 1.0 license](https://opendatacommons.org/licenses/odbl/1-0/).

    This final cell will ask you to acknowledge the license, then type
    **UPLOAD PREPARED DATASET**. Any other answer stops before upload. It uploads only
    the prepared files plus an attribution README, replacing paths with the same names
    in the existing private repository; it does not delete remote files, publish the
    repository, upload raw/staging files, or touch the model.

    For authentication, add `HF_TOKEN` in Colab's **Secrets** (key icon), granting this
    notebook access. Use a fine-grained write token for this dataset. If no Secret is
    available, a hidden token prompt appears. Tokens are never printed or embedded.
    Vercel later needs a separate **read-only** token on the backend only.
    ''')
    code('''
    print(DATASET_CARD)
    print('Target existing PRIVATE dataset:',TARGET_REPO)
    print('Upload file count:',len(manifest['files'])+2,'including attribution README and manifest')
    print('Prepared records:',manifest['total_prepared_rows'],'Cities:',manifest['total_cities'])
    license_ack=input('Type I ACCEPT ODbL 1.0 after reviewing source license and attribution: ').strip()
    confirmation=input('Type UPLOAD PREPARED DATASET to approve, or press Enter to stop: ').strip()
    if license_ack!='I ACCEPT ODbL 1.0' or confirmation!='UPLOAD PREPARED DATASET':
        raise PermissionError('Upload not approved. No remote files were changed.')
    token=None
    try:
        from google.colab import userdata
        token=userdata.get('HF_TOKEN')
    except Exception:
        pass
    if not token:
        from getpass import getpass
        token=getpass('Hugging Face dataset WRITE token (hidden): ').strip()
    assert token, 'No token provided; no upload.'
    private_api=HfApi(token=token)
    result=upload_prepared(OUTPUT,private_api,confirmation=confirmation,license_acknowledged=True)
    # Output is shown only AFTER every remote file is verified at the returned commit.
    print('BACKEND VERCEL ENVIRONMENT VARIABLES — apps/api project only:')
    print('AMLAAAK_DATA_MODE=prepared')
    print('AMLAAAK_PREPARED_DATA_REPO='+result['DATASET_REPO'])
    print('AMLAAAK_PREPARED_DATA_REVISION='+result['DATASET_REVISION'])
    print('AMLAAAK_PREPARED_DATA_MANIFEST_SHA256='+result['DATASET_MANIFEST_SHA256'])
    print('HF_TOKEN=<a separate private-dataset READ token; never paste it into notebook output>')
    print('Keep all approved MODEL variables unchanged. Keep frontend API_BASE_URL unchanged.')
    ''')
    md('''
    ## Finished

    Copy the verified output values into the **backend** Vercel project's environment
    variables, add a read-only token there, and redeploy only after the reviewed code
    has been pushed. Do not change the frontend API_BASE_URL or approved model settings.
    Run the hosted checks in `docs/PREPARED_DATA_QUICKSTART.md`. More searchable records
    do not improve or retrain the existing model. If any validation fails, do not switch
    production; the original `huggingface` provider remains available for rollback.
    ''')
    return dict(nbformat=4,nbformat_minor=5,metadata=dict(
        kernelspec=dict(display_name='Python 3',language='python',name='python3'),
        language_info=dict(name='python'),colab=dict(name='prepare_divar_dataset.ipynb',provenance=[])),cells=cells)


if __name__=='__main__':
    target=ROOT/'notebooks/prepare_divar_dataset.ipynb'
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(notebook(),ensure_ascii=False,indent=1)+'\n',encoding='utf-8')
    print(target)

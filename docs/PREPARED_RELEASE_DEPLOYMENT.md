# Deploy the verified prepared release

The user completed the Colab preparation/upload. Authenticated verification of the
PRIVATE dataset at the exact release below passed. Actual local API and frontend
browser integration also passed. **Production has not been switched or deployed by
the agent.** Existing hosted checks still report the old `huggingface` provider.

There is no need to rerun Colab, upload data again, or retrain the model.

## Verified release and evidence

| Setting | Value |
| --- | --- |
| Dataset | `thevel0per/AMLAAAK-Real-Estate-Data` — private |
| Immutable dataset commit | `8cc2a942d6d5d4b7cfa22e09a39d0223ff24019a` |
| Trusted manifest SHA256 | `3f4dff6cd149c10c579371a8d33a151b64c72e11fa9aed00b132892198d72048` |
| Published source rows / prepared sales / cities | 1,000,000 / 420,813 / 417 |
| Manifest-indexed files | 5,201; all present, matching remote sizes |
| Repository files | 5,204 including manifest, README and .gitattributes |
| Integrity evidence | 5,200 Hub LFS SHA256 matches; catalog and four sample bodies directly hashed |

The manifest body matches the supplied trusted hash. Every global/city/category
partition and sort-index total agrees with the published counts. Completeness is
verified against the published manifest/indexes and the producer's source-processing
claim; the agent did **not** reprocess the raw source or download/hash every archive
body. No full dataset was downloaded locally. See
[machine-readable inventory evidence](PREPARED_RELEASE_VERIFICATION.json) and
[actual local HTTP evidence](PREPARED_LOCAL_API_VERIFICATION.json).

## 1. Verify with a separate read-only token

Create a fine-grained Hugging Face token with read access only to this private dataset.
Keep a separate write token for future Colab uploads. From the repository root:

```powershell
.\.venv\Scripts\python -m pip install -r requirements-api-dev.txt
.\.venv\Scripts\python scripts/verify_prepared_release.py --prompt-token
```

Enter the **read** token at the hidden prompt. It is not printed or saved. This command
only reads metadata, the manifest/catalog, and a bounded sample; it never uploads data
or makes the repository public. The default report goes to ignored
`data/prepared-release-verification.json`. Without `--prompt-token`, it can use the
current process HF_TOKEN or an existing Hugging Face login. A failure is not evidence
of successful access; fix the token/pins/inventory rather than weakening checks.

## 2. Backend Vercel project

Edit the project serving **https://amlaaak.vercel.app**:

- **Root Directory:** `apps/api`
- **Framework:** FastAPI, native `main:app`
- **Python:** 3.14 via `pyproject.toml`; use default install/build/output settings
- **Fluid compute:** enabled; start with the platform's 2 GB memory configuration
- **Function duration:** checked-in `main.py` maxDuration 60 seconds
- **Database/storage:** none to provision; caches and model are worker-local

In **Settings → Environment Variables**, configure the intended Preview environment
first, then Production after acceptance:

```dotenv
AMLAAAK_DATA_MODE=prepared
AMLAAAK_PREPARED_DATA_REPO=thevel0per/AMLAAAK-Real-Estate-Data
AMLAAAK_PREPARED_DATA_REVISION=8cc2a942d6d5d4b7cfa22e09a39d0223ff24019a
AMLAAAK_PREPARED_DATA_MANIFEST_SHA256=3f4dff6cd149c10c579371a8d33a151b64c72e11fa9aed00b132892198d72048
```

Add **HF_TOKEN** as a sensitive, server-only environment variable containing the new
private-dataset read token. The three non-secret dataset pins also live in
`apps/api/vercel.json`; keep dashboard values identical. For a future release, update
the three pins together in a reviewed commit. The mode is deliberately not hardcoded
there so rollback through the dashboard remains possible.

Keep these existing model settings unchanged:

```dotenv
AMLAAAK_MODEL_REPO=thevel0per/AMLAAAK-Price-Predictor
AMLAAAK_MODEL_REVISION=89de24728daecdec3731e07475ab985c1efa87ad
AMLAAAK_MODEL_MANIFEST_SHA256=a8d51e5f441b30a541b92ac33fb7838a39c0d8da1ce5b051cd3a67e55e98d3e5
OMP_NUM_THREADS=1
OPENBLAS_NUM_THREADS=1
MKL_NUM_THREADS=1
```

Keep any existing **AMLAAAK_API_TOKEN** unchanged. Keep **AMLAAAK_MODEL_DIR unset** for
remote model loading. Remove stale AMLAAAK_SNAPSHOT. HF_MAX_RECORDS is ignored in
prepared mode; leave 300 for rollback. No full source acquisition or training command
belongs in Vercel's build/start settings.

Runtime pins remain numpy 2.4.3, pandas 3.0.1, scikit-learn 1.8.0, joblib 1.5.3 in both
API manifests. Model integrity, exact package versions, feature checks and version
`267eff7c36f3` are preserved. More searchable listings are not additional training data.

## 3. Frontend Vercel project

Edit the project serving **https://amlaaak-webbapp.vercel.app**:

- **Root Directory:** `apps/web`
- **Framework:** Next.js; **Node:** 24.x
- **Install:** `npm ci`; **Build:** `npm run build`; default output settings
- **Server-only API_BASE_URL:** `https://amlaaak.vercel.app` for Production
- Keep **API_TOKEN** equal to backend AMLAAAK_API_TOKEN if enabled

Do not put HF_TOKEN or any private dataset credential in this project or in a
NEXT_PUBLIC variable. Browser requests stay same-origin through the existing Next
proxy; authenticated HF requests occur only on the backend. The proxy aborts an
upstream fetch after 55 seconds and has maxDuration 60 seconds.

For Preview, set the Preview frontend API_BASE_URL to the **Preview backend** origin,
without `/api/v1`. Check Vercel Deployment Protection permits server-to-server access;
the app bearer token is not a Vercel protection-bypass token. A Preview frontend that
still points to Production has not tested the new backend.

## 4. Manual push/deployment order

1. Review the local commits and verification evidence. The agent has not pushed them.
2. Configure Preview environment variables and Git automatic-deployment settings as
   intended **before pushing**, because your existing Git integration may auto-deploy.
   Leave Production on huggingface until you explicitly authorize the mode switch.
3. Push the reviewed commits yourself. Deploy the **backend Preview first** and wait
   for build completion; inspect exact dependency versions and actual function size.
4. Run backend acceptance below against the Preview origin. A model-only healthy
   response is insufficient; the prepared statistics/comparable checks must pass.
5. Deploy the frontend Preview pointing at that backend; run the same checks through
   its proxy and test the browser. Inspect cold and warm latency/memory under realistic
   concurrency in Vercel logs/observability.
6. When satisfied, set the Production backend mode/token/pins and deploy the backend.
   Verify it before deploying the frontend Production build. Retain the existing
   frontend origin/token connection. No automatic Production deployment is performed
   by these repository scripts.

## 5. API and browser acceptance

For an app-authenticated backend, set API_TOKEN in the current shell through a hidden
prompt (not a literal token in command history):

```powershell
$secureApiToken=Read-Host 'Existing API bearer token' -AsSecureString
$env:API_TOKEN=[Net.NetworkCredential]::new('', $secureApiToken).Password
```

Run from repository root, substituting Preview origins while testing Preview:

```powershell
.\.venv\Scripts\python scripts/smoke_prepared_api.py --base-url https://amlaaak.vercel.app
.\.venv\Scripts\python scripts/smoke_prepared_api.py --base-url https://amlaaak-webbapp.vercel.app
Remove-Item Env:API_TOKEN -ErrorAction SilentlyContinue
```

These commands only read listings/statistics and compute predictions; no remote data
or settings are written. They fail if the origin still uses the old provider, has the
wrong release, or cannot serve prepared comparables. Reports contain counts/timings,
not listing records. Expected acceptance includes:

- Health provider prepared, model available; dataset readiness becomes true after a
  successful lazy request (health alone does not download/verify data).
- Summary count 420,813; cities 417; exact dataset revision/hash; explicit historical
  coverage and source-processing flag.
- Genuine city/neighborhood data, both property pages, sort/filter results, direct
  property details, full prepared statistics and no sample fallback.
- Model version 267eff7c36f3, positive real estimate, and eight actual comparable
  records from the prepared archive. A valid estimate with zero comparable coverage
  during a data outage is graceful degradation, not a successful integration test.

In the website, select a city before combined numeric/text filters, choose a
neighborhood, page through properties, then estimate a price. Archive counts must
come from successful API responses, not hardcoded frontend values. Ads remain
historical, not active listings. A genuine live-data browser test is available:

```powershell
cd apps/web
$env:PLAYWRIGHT_BASE_URL='https://amlaaak-webbapp.vercel.app'
$env:PREPARED_LIVE_E2E='1'
npm.cmd run test:e2e -- --grep 'verified private prepared release'
```

This same test passed locally through the actual built Next proxy and authenticated
private-data API, with no successful model/data responses mocked. Hosted success
has not been claimed or recorded for this new release yet.

## Serverless constraints and readiness limits

The old sequential Tehran cold query failed at 26 seconds. The fix uses a shared
four-worker fetch pool, four download slots, per-file single flight and one city
population cache. The real 84,331-candidate Tehran apartment query completed in
20.048 seconds cold and about 0.001 seconds from the shared population cache. Actual
local POST valuation took 13.597 seconds. These are Windows observations, not hosted
SLA benchmarks. Slow HF/CDN operations can still exceed a request budget.

File cache is 24 MiB / 32 entries, TTL 120 seconds. One city/category population is
cached for 120 seconds (maximum 150,000 rows / 32 MiB compressed input). Its parsed
objects add memory beyond file-cache bytes. Population construction is serialized
and shares cached results; at most four chunks are queued per construction. Waiting,
loading and validation share its 25-second budget. Files have size/hash/schema and
decompression guards. No request loads all 420,813 sales or a million raw rows.

With the final bounded top-eight ranking, a fresh API process with approved model
and city cache measured about 594 MB working set and 598 MB peak working set locally
(approximately 567/571 MiB). Actual Vercel memory,
concurrency, cold starts, egress/rate limits and availability still require Preview
measurement. The standard Python function bundle limit is 500 MB uncompressed; the
previous Linux dependency-wheel estimate was about 252 MB, not a hosted function
build. Prepared serving adds no Datasets/PyArrow dependency to that bundle. Both large
data and model binaries stay excluded from Git/build bundles.

Current [Vercel limits](https://vercel.com/docs/functions/limitations) list 2 GB on
Hobby and up to 4 GB on Pro/Enterprise with Fluid compute. Confirm your actual plan
settings. Preserve bounded queries and inspect real build/runtime evidence rather
than treating local measurements as a Production certification.

## Rollback

Set **backend AMLAAAK_DATA_MODE=huggingface** and redeploy the backend. Keep model
pins, model dependencies, API authentication and frontend API_BASE_URL unchanged.
Prepared pins can remain configured but are unused in rollback mode. The original
bounded 300-row provider returns with its coverage warning. If the new build itself
fails, use Vercel's prior known-good deployment. Do not make the dataset public,
delete data, retrain, or disable hashes to work around an authentication error.

**Verdict:** the verified private release and local end-to-end integration are ready
for a controlled Preview rollout. Production acceptance is pending manual Vercel
configuration/deployment and successful hosted smoke/concurrency checks. The model
remains a historical asking-price research baseline, not a certified valuation service.

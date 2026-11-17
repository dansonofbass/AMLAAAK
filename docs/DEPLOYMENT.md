# Local operation and deployment

No push, hosting deployment, database provisioning, or remote deployment-setting changes were performed. The application remains two independent projects: apps/web and apps/api.

## Local Windows PowerShell setup

From the repository root, Python 3.14 and Node 24 are the verified versions:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-api-dev.txt
$env:AMLAAAK_DATA_MODE='huggingface'
$env:HF_MAX_RECORDS='300'
.\.venv\Scripts\python -m uvicorn apps.api.main:app --host 127.0.0.1 --port 8000
```

In another terminal:

```powershell
cd apps/web
npm.cmd ci
$env:API_BASE_URL='http://127.0.0.1:8000'
npm.cmd run dev -- --port 3100
```

Open http://127.0.0.1:3100. This is genuine historical-data mode, bounded to 300 examined source records by default. It does not fetch the full dataset. Models are optional and never trained in requests. The data is historical, not a live property feed. Data outages are visible; no fake fallback observations or prices are returned.

Before starting a second process, inspect `netstat -ano` for ports 8000 and 3100. Stop your existing AMLAAAK process with Ctrl+C in its terminal. Do not terminate unrelated processes or run multiple servers on the same port.

### Explicit offline illustrative mode

Stop the API, set `$env:AMLAAAK_DATA_MODE='illustrative'`, and restart the same Uvicorn command. The original ten-record fixture supplies eight eligible sales. It remains labeled illustrative. `AMLAAAK_DATA_MODE=snapshot` with `AMLAAAK_SNAPSHOT` can select a separately prepared local snapshot. Setting `huggingface` explicitly takes precedence over an old snapshot path.

### Train and activate a genuine-data model

Acquisition is an explicit operator action, bounded to 100-2,000 source records per command. It pins rows-only prefix retrieval so a recovery of remote filtering cannot silently change the training population. Use fresh paths if these already exist:

```powershell
.\.venv\Scripts\python scripts/acquire_divar.py --output data/divar-live-2000.csv --revision e9446ee97b8e6eb9bd62bdfd7548f1bc8973be85 --max-records 2000
.\.venv\Scripts\python -m amlaaak.real_training --data data/divar-live-2000.csv --output-dir artifacts/divar-temporal --revision e9446ee97b8e6eb9bd62bdfd7548f1bc8973be85
.\.venv\Scripts\python scripts/prepare_dashboard.py --source data/divar-live-2000.csv --output data/divar-dashboard.json --kind divar --revision e9446ee97b8e6eb9bd62bdfd7548f1bc8973be85 --model-source artifacts/divar-temporal --model-output apps/api/assets/divar-model
$env:AMLAAAK_MODEL_DIR=(Resolve-Path apps/api/assets/divar-model).Path
.\.venv\Scripts\python -m uvicorn apps.api.main:app --host 127.0.0.1 --port 8000
```

The dataset-server revision must match the requested revision; drift aborts acquisition. A repeated 2,000-row acquisition reproduced the exact training CSV SHA-256. The exporter checks the source hash against the trained artifact, preserves the model, and writes a checksummed manifest. Generated data and models stay ignored. The trained model loads once per worker, with exact numpy/pandas/sklearn/joblib version verification. The successfully executed experiment is documented in REAL_DATA_EXPERIMENT.json. It is a bounded-prefix research model, not a production valuation certification.

For the original illustrative model, the existing `model_training.py` and `scripts/prepare_dashboard.py --kind illustrative` workflow remains supported. Use a separate output bundle and set `AMLAAAK_MODEL_DIR` accordingly. Never label it as a genuine-data model.

## Environment variables

| App | Variable | Meaning |
| --- | --- | --- |
| Web | API_BASE_URL | Backend origin, no /api/v1 suffix; server-side only |
| Web | API_TOKEN | Optional backend bearer token, never NEXT_PUBLIC |
| API | AMLAAAK_API_TOKEN | Matching bearer token; all endpoints except health are protected |
| API | AMLAAAK_DATA_MODE | huggingface (default), illustrative, or snapshot |
| API | HF_MAX_RECORDS | 300 default, clamped to 100-2,000; bounded query window |
| API | HF_TOKEN | Optional server-only Hugging Face credential |
| API | AMLAAAK_SNAPSHOT | Local prepared snapshot path for snapshot mode |
| API | AMLAAAK_MODEL_DIR | Trusted pre-exported local bundle; unset leaves inference unavailable unless remote provisioning is configured |
| API | AMLAAAK_MODEL_REPO | Explicit operator-approved Hugging Face model owner/repo, optional |
| API | AMLAAAK_MODEL_REVISION | Exact 40-character model-repository commit, required with remote model provisioning |
| API | AMLAAAK_MODEL_MANIFEST_SHA256 | Trusted 64-character manifest hash, required with remote provisioning |
| Container | PORT | HTTP port, default 8000 |
| Tests | PLAYWRIGHT_BASE_URL | Frontend URL, default http://127.0.0.1:3100 |
| Tests | AMLAAAK_RUN_LIVE_TESTS | Set to 1 only for real-network Python integration tests |
| Tests | LIVE_E2E | Set to 1 only for browser tests against a live-mode backend |

Each app has an .env.example. Next reads apps/web/.env.local; Uvicorn does not automatically read the API example. Export API variables in your shell or configure them on the host. Do not expose origin, credentials or artifact configuration using NEXT_PUBLIC prefixes.

## Two Vercel projects

Current official documentation was verified for the [FastAPI entrypoint](https://vercel.com/docs/frameworks/backend/fastapi), [Python runtime](https://vercel.com/docs/functions/runtimes/python), and [limits](https://vercel.com/docs/functions/limitations). Python 3.14 and native main:app entrypoints are supported. The checked-in API manifests use that runtime; no legacy catch-all builds configuration is added.

1. After approving publication, create a Vercel project with Root Directory `apps/api`. Keep native FastAPI detection/default dependency installation. No data-acquisition or training build command is used. Runtime includes httpx/Pydantic/FastAPI; the default API excludes sklearn dependencies.
2. Set `AMLAAAK_DATA_MODE=huggingface`, `HF_MAX_RECORDS=300`, and optionally `AMLAAAK_API_TOKEN`/`HF_TOKEN`. No writable persistent database exists. Health may report dataset readiness false until a successful lazy query; an unavailable model does not disable analytics.
3. Deploy a second Vercel project rooted at `apps/web`, framework Next.js, Node 24, install `npm ci`, build `npm run build`, default output settings. Set server-only API_BASE_URL and optional matching API_TOKEN for every intended environment.
4. Verify the frontend proxy, source coverage, city filters and properties. Configure authorized cross-project access if Vercel Deployment Protection applies; the app bearer token is not a Vercel bypass token. Never expose bypass credentials in a browser.
5. No trained model binary is present in a Git-import deployment automatically. Either leave it honestly unavailable or provision a reviewed compatible bundle and inference dependencies as described below.

Python's standard uncompressed function limit is currently 500 MB. Exact installed ML footprint, cold-start time and memory usage must be checked in the target account. The configured API maxDuration is 30 seconds. The proxy times out at 28 seconds; dataset calls have per-request timeouts, bounded retries, bounded pages and cache. Default retrieval is intentionally small. Increase limits only after measuring the actual deployment. Google fonts are fetched by next/font at build time and served locally to browsers.

### Model provisioning

Local bundles require explicit AMLAAAK_MODEL_DIR. Optional remote provisioning requires an operator-approved Hugging Face model repository, exact revision, and independently trusted manifest SHA-256. The provider downloads only manifest.json, metadata.json and model.joblib, applies 128 KB / 2 MB / 100 MB download guards, verifies hashes, then checks package versions before trusted loading. It does not download training data. No model-repository URL was invented, no artifact was uploaded, and remote model hosting was not exercised in this session. Deterministic trust-guard tests cover provisioning; actual inference was verified with the locally exported genuine model.

Provisioned artifacts use a worker-local temporary directory. It is not persistent Vercel storage and is not a replacement for a model registry. Startup provisioning runs once per worker, not per valuation. Only load artifacts from a source you trust: integrity checks do not make arbitrary pickle/joblib safe.

On Vercel, add the exact ML package versions recorded in the metadata to the API dependency manifests only if its built function fits. Verify the bundle/cold start before enabling inference. Otherwise retain the Vercel frontend and use the container alternative. No successful hosted inference deployment is claimed.

## Render / Docker alternative

The root Dockerfile and render.yaml remain supported, without a database service or persistent SQLite requirement. The default Render blueprint deploys the lean live-data API with a generated app token. Review the hosting plan before creating resources; copy the generated token to the Vercel frontend's API_TOKEN and use Render's HTTPS origin as API_BASE_URL.

```powershell
docker build -t amlaaak-api .
docker run --rm -p 8000:8000 -e AMLAAAK_DATA_MODE=huggingface amlaaak-api
```

For a previously prepared local genuine-data bundle:

```powershell
docker build --build-arg WITH_INFERENCE=true -t amlaaak-api-inference .
docker run --rm -p 8000:8000 -e AMLAAAK_DATA_MODE=huggingface -e AMLAAAK_MODEL_DIR=/app/apps/api/assets/divar-model amlaaak-api-inference
```

The Docker context can include the explicitly prepared ignored bundle; Git cannot. An approved built image or approved remote artifact provisioning is needed on the host. A Git-only blueprint with no artifact remains model-unavailable. No image was pushed. The local Docker daemon was unavailable, so container execution and hosted deployment remain unverified.

## Checks and screenshots

From root: install requirements-api-dev.txt, then run `.\.venv\Scripts\python -m pytest -q` and `python -m pip check` through the venv. The default Python suite runs without network access; two live tests are explicitly skipped.

```powershell
$env:AMLAAAK_RUN_LIVE_TESTS='1'
.\.venv\Scripts\python -m pytest -q -m live
```

From apps/web, run `npm.cmd run test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`. With an illustrative-mode API and both servers running, run `npm.cmd run test:e2e` (12 deterministic browser tests; two live tests skipped). Playwright uses installed Microsoft Edge headless. Install an official Playwright browser/update its channel if Edge is absent.

For a live-mode API with the real trained model:

```powershell
$env:LIVE_E2E='1'
npm.cmd run test:e2e -- --grep 'live Hugging Face integration'
```

Those tests use actual Next proxy -> FastAPI -> HF calls, city neighborhoods, real comparable source identities and actual model output. No successful backend responses are mocked in production. Deterministic tests mock only external boundaries, plus an explicit browser error response to test failure UX.

Screenshots are under apps/web/test-results: desktop/mobile overview, valuation, open dropdowns without hover, selected province, live-dashboard and live-valuation. They are ignored generated QA files. Browser QA used the explicitly requested Playwright workflow because the system-browser bridge was unavailable. VALIDATION.md and PLATFORM_REPORT.md record verified results and remaining limits.

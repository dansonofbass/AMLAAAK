# Local operation and deployment

## Simplified dashboard feature branch

See [UI_REDESIGN.md](UI_REDESIGN.md) for the new protected Preview review sequence.
Deploy its additive nullable-input backend change to a new Preview before connecting
the redesigned frontend Preview. Preserve all existing model/data pins, backend HF_TOKEN,
API_TOKEN, deployment protection and Trusted Sources/OIDC configuration. The proxy route
is unchanged from verified Preview commit f13e9e5. No real environment settings, push or
hosting deployment are performed by this redesign. Local relay tests cover OIDC header
forwarding; the new branch still needs hosted Preview acceptance with genuine platform OIDC.

No push, hosting deployment, database provisioning, or remote deployment-setting changes were performed. The application remains two independent projects: apps/web and apps/api.

The uploaded private release has now passed authenticated manifest/inventory checks
and actual local API/Next browser acceptance. Follow
[the exact prepared-release deployment guide](PREPARED_RELEASE_DEPLOYMENT.md) for the
known revision/hash, backend read token, Preview-first order, hosted smoke commands
and rollback. **No production activation is claimed.** The approved model is unchanged.
The Colab notebook remains available for future preparation, not a prerequisite to
reuse the already verified upload.

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
| API | AMLAAAK_DATA_MODE | huggingface (default), prepared (explicitly verified archive), illustrative, or snapshot |
| API | AMLAAAK_PREPARED_DATA_REPO | Existing private dataset repository; required only in prepared mode |
| API | AMLAAAK_PREPARED_DATA_REVISION | Actual immutable dataset commit printed after verified Colab upload |
| API | AMLAAAK_PREPARED_DATA_MANIFEST_SHA256 | Actual trusted manifest SHA-256 printed after verified Colab upload |
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

## Two Vercel projects: approved real-model deployment

These are manual next steps; no push or deployment has been performed. The native FastAPI entrypoint is `main:app` in `apps/api`; no rewrite/catch-all build configuration or training build command is needed.

### 1. Backend project (`apps/api`)

1. Import the reviewed repository into a Vercel project with **Root Directory `apps/api`** and native **FastAPI** detection. Keep default install/build/output commands. `pyproject.toml` requires Python `>=3.14,<3.15`; both dependency manifests include the exact model-compatible packages:

   | Package | Required version |
   | --- | --- |
   | numpy | 2.4.3 |
   | pandas | 3.0.1 |
   | scikit-learn | 1.8.0 |
   | joblib | 1.5.3 |

2. Enable Fluid compute in the project. The checked-in `vercel.json` supplies the public model pins and thread/row limits below. `AMLAAAK_DATA_MODE=huggingface` is the code default, deliberately absent from that file so you can later select prepared mode through backend environment variables. Configure the intended mode explicitly in the dashboard; keep the model pins identical for Production and Preview:

   ```dotenv
   AMLAAAK_DATA_MODE=huggingface
   HF_MAX_RECORDS=300
   AMLAAAK_MODEL_REPO=thevel0per/AMLAAAK-Price-Predictor
   AMLAAAK_MODEL_REVISION=89de24728daecdec3731e07475ab985c1efa87ad
   AMLAAAK_MODEL_MANIFEST_SHA256=a8d51e5f441b30a541b92ac33fb7838a39c0d8da1ce5b051cd3a67e55e98d3e5
   OMP_NUM_THREADS=1
   OPENBLAS_NUM_THREADS=1
   MKL_NUM_THREADS=1
   ```

   **Remove `AMLAAAK_MODEL_DIR`** from hosted environments: a local path takes precedence over remote provisioning. Remove stale snapshot settings. Public model/data access succeeded without `HF_TOKEN`; add a server-only token only if needed. Optionally set a strong secret `AMLAAAK_API_TOKEN`, and later use the same value in the web project's `API_TOKEN`.

3. After you choose to publish the local commits and deploy, inspect build output for Python 3.14, all four exact ML versions, and actual function size. `vercel.json` excludes model bundles, CSV/Parquet and local development files. No model or training dataset is committed or downloaded during the build. The worker downloads the three approved model files at startup into temporary storage.
4. Visit `https://<api-domain>/api/v1/health`: expect `model_available: true` and `provider: huggingface`. Dataset readiness may be false before its first lazy request. With an app token, send `Authorization: Bearer <token>` for the remaining checks. `GET /api/v1/model/status` must return `available: true`, `mode: trained`, `version: 267eff7c36f3`. Check logs rather than accepting a model-unavailable status as success.
5. Submit the valuation request below, then repeat it to check warm latency. Confirm a positive prediction and genuine comparable source identities with explicit bounded coverage. A dataset outage may preserve a model estimate but return zero coverage; this is not successful comparable retrieval.

### 2. Frontend project (`apps/web`)

1. Create a separate Vercel project with **Root Directory `apps/web`**, framework **Next.js**, Node **24.x**, install command `npm ci`, build command `npm run build`, and default output settings.
2. Configure **server-side** `API_BASE_URL=https://<api-domain>` with no `/api/v1` suffix. If enabled on the backend, set matching `API_TOKEN`. Set them separately for Production/Preview as appropriate, then redeploy after changes. Never use `NEXT_PUBLIC_` for these values.
3. The browser calls same-origin `/api/v1/...`; the Next route reads `process.env.API_BASE_URL` at request time and forwards the optional bearer token. No direct browser-to-backend configuration or public origin variable is needed. Cross-project Vercel Deployment Protection must permit this server-to-server request: app bearer tokens do not bypass Vercel protection. Configure project access deliberately; this repository does not implement a protection-bypass credential flow.
4. Open `/predict`, select Tehran and a neighborhood, and submit. Verify the model label/version, positive estimate, genuine historical comparables, and coverage warning. Exercise city filters and inspect server logs on both projects. Run the live browser suite against the hosted frontend only after authorizing deployment.

### Model trust and lifecycle

The approved public model is [thevel0per/AMLAAAK-Price-Predictor](https://huggingface.co/thevel0per/AMLAAAK-Price-Predictor/tree/89de24728daecdec3731e07475ab985c1efa87ad). The manifest hash above was independently supplied by the operator and verified against the public response. The loader fetches only `manifest.json`, `metadata.json`, and `model.joblib`, enforcing 128 KB / 2 MB / 100 MB download guards. It verifies the manifest trust hash, metadata/model hashes, exact four package versions and the feature contract before serving predictions. Integrity checks do not make arbitrary pickle/joblib safe: retain the approved source and update revision/hash together after review.

The model is loaded once per process, not per valuation. Each new worker downloads its own copy into ephemeral temporary storage; this is not persistent storage. A failed startup provisioning leaves inference explicitly unavailable until a fresh worker/redeployment; no request-time retraining or fake prediction fallback occurs. Live Divar retrieval stays separate and lazy through the official dataset server.

### Size, memory, duration and cold starts

Official [Python runtime](https://vercel.com/docs/functions/runtimes/python) and [function limits](https://vercel.com/docs/functions/limitations) were checked for this preparation. Python 3.14 is supported. The standard Python bundle limit is **500 MB uncompressed**; Large Functions beta is not required by this configuration. Fluid compute memory is **2 GB on Hobby**, up to **4 GB on Pro/Enterprise**. Confirm the settings and limits available in your account.

A Linux x86-64 CPython 3.14 binary-only resolution of API requirements succeeded: 25 wheels, 76,418,726 compressed bytes and 251,772,240 uncompressed bytes (including SciPy). This is an estimate of dependency contents, **not an actual Vercel function build**: installed files, generated bytecode, platform dependency resolution and runtime overhead can change size. The remote model is outside the deployed bundle, but occupies temporary disk and process memory after startup. Inspect the actual function build before approving hosted readiness.

The API and Next proxy have `maxDuration=60`; the proxy aborts upstream fetches after **55 seconds**, leaving response headroom. Fluid compute permits this duration on current Hobby/Pro plans. Enable Fluid compute rather than relying on legacy limits. These settings are upper bounds, not latency guarantees. HF streaming uses per-operation timeouts, not one total startup deadline; a slow model CDN or dataset retry can still exceed the proxy budget. Do not add automatic request retries to hide timeouts.

Actual Windows verification downloaded/verified/loaded the public model in **9.487 seconds**; first genuine-data valuation took **7.840 seconds** and returned **8 comparables**, examining 300 source rows. The standalone API process had about **196 MB working set** after live browser checks. These are single local observations, not Vercel benchmarks or worst-case memory/latency. Hosted cold starts, egress, dependency imports, worker scaling, dataset rate limits and concurrent requests remain risks requiring a real Preview deployment measurement. Cache and loaded model are process-local. Google fonts require outbound access during the Next build.

### Repeat the public-model verification locally

From the repository root after installing `requirements-api-dev.txt`:

```powershell
$env:AMLAAAK_RUN_REMOTE_MODEL_TESTS='1'
.\.venv\Scripts\python -m pytest -q -s tests/test_deployment_model.py -m live
```

This opt-in test downloads the actual pinned public model through the production integrity loader, runs direct inference, and submits a real FastAPI POST with genuine HF data retrieval. It does not substitute mocked model or dataset responses.

To run the same API project-root import as Vercel:

```powershell
cd apps/api
$deployConfig=Get-Content vercel.json -Raw | ConvertFrom-Json
foreach ($setting in $deployConfig.env.PSObject.Properties) {
    [Environment]::SetEnvironmentVariable($setting.Name,[string]$setting.Value,'Process')
}
Remove-Item Env:AMLAAAK_MODEL_DIR -ErrorAction SilentlyContinue
..\..\.venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

In another PowerShell terminal, substitute the hosted origin when checking Vercel. Add an Authorization header if app authentication is enabled:

```powershell
$body=@{
    city_slug='tehran'; cat3_slug='apartment-sell'; building_size=90
    rooms_count=2; floor=2; total_floors_count=5; construction_year=1395
    has_parking=$true; has_elevator=$true; has_balcony=$false; has_warehouse=$false
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/api/v1/valuation' -ContentType 'application/json' -Body $body
```

The verified request returned `predicted_price=6076080000.0` in unverified original price units, model version `267eff7c36f3`. This is an inference check, not a new accuracy result. See REAL_DATA_EXPERIMENT.json for held-out evaluation.

## Render / Docker alternative

The root Dockerfile and render.yaml remain supported, without a database service or persistent SQLite requirement. The default Render blueprint deploys the model-capable live-data API with a generated app token. Review the hosting plan before creating resources; copy the generated token to the Vercel frontend's API_TOKEN and use Render's HTTPS origin as API_BASE_URL.

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

From root: install requirements-api-dev.txt, then run `.\.venv\Scripts\python -m pytest -q` and `python -m pip check` through the venv. The default Python suite runs without network access; three network tests are explicitly skipped (two dataset tests and one remote-model test).

```powershell
$env:AMLAAAK_RUN_LIVE_TESTS='1'
.\.venv\Scripts\python -m pytest -q -m live
```

From apps/web, run `npm.cmd run test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`. With an illustrative-mode API and both servers running, run `npm.cmd run test:e2e` (12 deterministic browser tests; two original live tests, one synthetic prepared-provider test and one real prepared-release test skipped). Playwright uses installed Microsoft Edge headless. Install an official Playwright browser/update its channel if Edge is absent.

For a live-mode API with the real trained model:

```powershell
$env:LIVE_E2E='1'
npm.cmd run test:e2e -- --grep 'live Hugging Face integration'
```

Those tests use actual Next proxy -> FastAPI -> HF calls, city neighborhoods, real comparable source identities and actual model output. No successful backend responses are mocked in production. Deterministic tests mock only external boundaries, plus an explicit browser error response to test failure UX.

Screenshots are under apps/web/test-results: desktop/mobile overview, valuation, open dropdowns without hover, selected province, live-dashboard and live-valuation. They are ignored generated QA files. Browser QA used the explicitly requested Playwright workflow because the system-browser bridge was unavailable. VALIDATION.md and PLATFORM_REPORT.md record verified results and remaining limits.

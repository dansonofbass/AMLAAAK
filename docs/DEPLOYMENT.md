# Deployment and local operation

No deployment, account changes, remote configuration changes or Git pushes were performed for this implementation. The following are operator instructions, not a claim that the app is publicly hosted.

## Local development (Windows PowerShell)

From the repository root, with Python 3.14 and Node 24:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-api-dev.txt
.\.venv\Scripts\python -m uvicorn apps.api.main:app --host 127.0.0.1 --port 8000
```

In another terminal:

```powershell
cd apps/web
npm.cmd ci
$env:API_BASE_URL='http://127.0.0.1:8000'
npm.cmd run dev -- --port 3100
```

Open `http://127.0.0.1:3100`. Port 3000 was unavailable on the verification machine, so the documented commands use 3100. On other shells use `npm` and the platform-appropriate venv path. The application needs no paid database, map key, external tiles or LLM key. The default backend uses the bundled eight-sale snapshot, derived from the ten illustrative records. Prediction and performance scores are unavailable by default; this is intentional.

For optional **real execution of an illustrative trained model**, stop the API, then from the repository root:

```powershell
.\.venv\Scripts\python model_training.py --data "sample database.csv" --output-dir artifacts/dashboard-demo
.\.venv\Scripts\python scripts/prepare_dashboard.py --source "sample database.csv" --output data/dashboard-demo.json --kind illustrative --revision da934df --model-source artifacts/dashboard-demo --model-output apps/api/assets/model
$env:AMLAAAK_MODEL_DIR=(Resolve-Path apps/api/assets/model).Path
.\.venv\Scripts\python -m uvicorn apps.api.main:app --host 127.0.0.1 --port 8000
```

Choose fresh paths if outputs already exist. The bundled sample snapshot and new model share the original fixture source hash. The generated model is not committed. The API performs actual sklearn inference, explicitly labeled illustrative; it is not a formula-based or synthetic fallback. `requirements-api-dev.txt` includes the existing ML runtime for local inference/tests. A lean API-only install uses `apps/api/requirements.txt` instead.

## Environment variables

| App | Variable | Meaning |
| --- | --- | --- |
| Web | `API_BASE_URL` | Backend origin, e.g. `https://your-api.vercel.app`; no `/api/v1` suffix |
| Web | `API_TOKEN` | Optional server-only bearer credential, matching the backend |
| API | `AMLAAAK_API_TOKEN` | Optional bearer credential; all routes except health are protected |
| API | `AMLAAAK_SNAPSHOT` | Prepared snapshot path; default is bundled `assets/sample.json` resolved relative to API source |
| API | `AMLAAAK_MODEL_DIR` | Trusted model bundle directory; unset means unavailable |
| Container | `PORT` | HTTP listen port, default 8000 |
| Tests | `PLAYWRIGHT_BASE_URL` | Running frontend URL, default `http://127.0.0.1:3100` |

Examples are in each app's `.env.example`. Next.js automatically reads `.env.local` in `apps/web`. Uvicorn does **not** automatically read the API example; export variables in your shell or configure them on the host. Never prefix tokens or backend origin with `NEXT_PUBLIC_`.

## Two Vercel projects

Configuration was checked against Vercel's [FastAPI guide](https://vercel.com/docs/frameworks/backend/fastapi), [Python runtime](https://vercel.com/docs/functions/runtimes/python), and [function limits](https://vercel.com/docs/functions/limitations) on 2026-11-17. Current documentation supports Python 3.14, `main.py` exporting `app`, and `tool.vercel.entrypoint`. The API selects `main:app` and Python 3.14 using its own manifests. It uses native framework detection rather than legacy `builds`/catch-all rewrites.

1. After reviewing and approving publication, import the repository as a Vercel project with **Root Directory `apps/api`**. Keep native FastAPI detection and its default dependency installation. No training/build command is needed. `main.py`, `service/`, the bundled sample snapshot and app manifests are self-contained in this root. Set `AMLAAAK_API_TOKEN` to a strong random secret if desired. Leave snapshot/model variables unset for the bundled demo with honest unavailable inference.
2. Verify the deployed backend's `/api/v1/health`. Check `dataset_ready: true`. Inspect `/api/v1/model/status` with the token if configured. A healthy analytics API does not require a model.
3. Import the same repository as a second project with **Root Directory `apps/web`**, Next.js framework, Node 24, install `npm ci`, build `npm run build`, default output settings. Set `API_BASE_URL` to the backend's HTTPS origin and `API_TOKEN` to the same secret. Configure these for every intended preview/production environment. Redeploy after changing environment settings.
4. Verify `/api/v1/health` through the frontend origin, then verify dashboard filters and a properties page. Requests use the Next server proxy, so no browser CORS allowance is required. The server token is never shipped to the browser.
5. If Vercel Deployment Protection blocks cross-project server requests, configure authorized server access for those two projects in Vercel; the application bearer token is not a Vercel protection bypass token. Do not disable protections blindly or paste bypass secrets into client variables.

No local writable database is used. Bundled JSON is immutable per deployment. Prepare/redeploy a permitted new snapshot for updates. The default production deployment is explicitly an **illustrative analytics demo**, not real market data or a trained market predictor.

### Optional Vercel inference and its limits

Vercel documents a 500 MB standard uncompressed Python function bundle limit (larger-function beta options exist). The dependency footprint, cold starts and runtime memory must be verified in the actual deployment. The current `maxDuration` is 30 seconds; no request trains a model. The snapshot has a separate 50 MB guard, and export has a 100 MB model guard; these do not guarantee that a combined deployment fits the platform.

The checked-in Vercel backend deliberately uses lightweight dependencies. To attempt inference there, an operator must supply the previously exported trusted model bundle, install the **exact** training versions of numpy/pandas/scikit-learn/joblib in the API project's dependency manifests, set `AMLAAAK_MODEL_DIR` and validate the built function's size and health. The generated model directory is Git-ignored and will not appear in Git-import deployments automatically. A reviewed local CLI deployment can include a prepared bundle under the API root via its `.vercelignore`; do not commit arbitrary large binaries or secrets. No full model is trained or downloaded by the configured Vercel build.

Because a Linux Vercel inference bundle has not been built or deployed in this session, prefer the container fallback below for predictable control of ML dependencies. Do not describe local inference verification as successful Vercel deployment.

## Render / Docker backend alternative

`Dockerfile` and `render.yaml` implement a separate backend deployment while retaining the Vercel frontend. The default Render blueprint deploys a read-only sample analytics API with a generated bearer token and health check. Review the chosen hosting plan and environment before creating resources; no database or persistent disk is required. Copy the generated token into the Vercel frontend's server-side `API_TOKEN` and use the Render HTTPS origin as `API_BASE_URL`.

To build a local container (Docker must be installed):

```powershell
docker build -t amlaaak-api .
docker run --rm -p 8000:8000 amlaaak-api
```

For optional inference, first export the trusted bundle into `apps/api/assets/model` with the earlier command, then:

```powershell
docker build --build-arg WITH_INFERENCE=true -t amlaaak-api-inference .
docker run --rm -p 8000:8000 -e AMLAAAK_MODEL_DIR=/app/apps/api/assets/model amlaaak-api-inference
```

The Docker context includes that explicitly prepared local bundle; Git does not. Publish an approved built image to an operator-controlled registry and select that image on Render to retain the bundle, or implement your own trusted artifact provisioning in CI. A Git-only Render blueprint deployment has no ignored model artifact and will stay in unavailable mode. The image must be built for the target host architecture. No Docker engine was available in the implementation session, so container execution and hosted deployment remain unverified.

## Real data preparation

Keep the existing local Divar CSV/SQLite ingestion workflow described in the README. Obtain the dataset manually after reviewing its ODbL terms. Then run the snapshot exporter against a documented, permitted local subset, using `--kind divar`, an actual source revision, and a fresh ignored output path such as `apps/api/assets/analytics.json`. Configure `AMLAAAK_SNAPSHOT` accordingly. Do not relabel the fixture as Divar data. For a model bundle, training and export must reference the exact same source file hash. The exporter rejects over 50,000 eligible rows instead of silently truncating them; for larger serving needs add a database adapter.

Generated real-data snapshots are ignored to avoid accidental redistribution. For deployment, deliberately provision the reviewed snapshot as an artifact inside the API root or container image, retaining provenance and respecting licensing. No external dataset URL is fetched at request time. A hosted Postgres database is unnecessary for the included demo, and writable SQLite is not used for Vercel persistence.

## Verification and screenshots

From repository root:

```powershell
.\.venv\Scripts\python -m pytest -q
.\.venv\Scripts\python -m pip check
```

From `apps/web`, with both servers running:

```powershell
npm.cmd run test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

Playwright uses installed Microsoft Edge in headless mode. If absent, install an official Playwright browser and update `channel` in `playwright.config.ts`. The eight end-to-end tests use actual frontend/backend calls for successful paths, and inject a failed response only to verify the error UI. Prediction success is exercised when the optional model is configured; otherwise that test verifies disabled/unavailable behavior. The recorded implementation run used an actual illustrative model and exercised the prediction POST.

Screenshots are generated under `apps/web/test-results/overview-desktop.png`, `overview-mobile.png`, and (with model) `prediction-desktop.png`. Review them at native scale; they are ignored generated QA artifacts. Desktop and 390px mobile screenshots were inspected against the supplied reference. The system-browser preview bridge was unavailable, so visual QA used the explicitly requested Playwright test workflow. Final results and remaining limits are recorded in `VALIDATION.md`.

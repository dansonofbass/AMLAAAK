# AMLAAAK — Real Estate Price Prediction

AMLAAAK combines a reproducible Python price-modeling pipeline with a Next.js/FastAPI real-estate analytics workspace. It validates locally supplied Divar-format data, evaluates a RandomForestRegressor against a median-price baseline, and serves privacy-conscious analytics through typed API contracts. A configured trusted model artifact enables actual inference. Nothing has been publicly deployed as part of this implementation.

## Status and scope

This is a portfolio research prototype, not a production valuation system. The included **10 illustrative records are not verified Divar observations**. Eight are sales and two are rentals; training excludes the rentals. The dashboard's bundled snapshot contains those eight eligible sales and labels them prominently. No full-dataset experiment or real-world accuracy claim is made. By default, predictions and model scores remain unavailable until a trusted model bundle is explicitly configured.

## Analytics workspace

The dark analytics interface adapts the supplied `amlak dashboard.png`: a geographic canvas, floating/resizable chart cards, compact KPIs, cyan/violet accents, and a separate contextual insights rail. On mobile the charts stack and the rail opens on demand. The rail contains rule-based numerical observations, not a simulated AI assistant.

| Page | Implemented behavior |
| --- | --- |
| Overview `/` | Verified counts/medians, interactive Iran city map, price/area/year charts, type composition and amenities |
| Market analytics `/analytics` | Shared city/type/range/search filters, chart-driven selection and reset |
| Properties `/properties` | Server-side search, sorting, pagination and accessible detail dialog; no private text or exact locations |
| Price prediction `/predict` | Validated feature form, real FastAPI/sklearn inference when configured, explicit demo/unavailable states |
| Model performance `/model` | Artifact-backed forest/baseline metrics, source/split/version metadata; no invented residuals |

All successful UI data flows through typed FastAPI/Pydantic responses, validated by Zod at the frontend boundary. The map uses bundled public-domain Natural Earth boundaries and approximate city centers; no map key or external tiles are needed. Unmapped cities remain in tables and aggregates.

For local development, install Python 3.14 and Node 24, then run from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-api-dev.txt
.\.venv\Scripts\python -m uvicorn apps.api.main:app --host 127.0.0.1 --port 8000
```

In a second terminal:

```powershell
cd apps/web
npm.cmd ci
$env:API_BASE_URL='http://127.0.0.1:8000'
npm.cmd run dev -- --port 3100
```

Open `http://127.0.0.1:3100`. This starts illustrative analytics with honest unavailable model status. The [deployment guide](docs/DEPLOYMENT.md) includes the exact optional model-training/export commands, environment variables, two independent Vercel projects, and Render/Docker fallback. It also explains how to prepare a permitted real-data snapshot. No training occurs during build or request handling, and no writable persistent SQLite database is used by the hosted API.

Further documentation: [architecture](docs/ARCHITECTURE.md), [API routes and schemas](docs/API.md), [deployment and screenshots](docs/DEPLOYMENT.md), [verified validation results](docs/VALIDATION.md). Interactive OpenAPI is available at the backend's `/docs`.

## Data source and licensing

Official attribution: [Divar real_estate_ads](https://huggingface.co/datasets/divarofficial/real_estate_ads), published by Divar. Documentation inspected on 2026-11-17:

- The [dataset card](https://huggingface.co/datasets/divarofficial/real_estate_ads/blob/main/README.md) describes one million anonymized advertisements, predominantly Persian, with CSV/Parquet data, and labels the license **ODbL**.
- The [file listing](https://huggingface.co/datasets/divarofficial/real_estate_ads/tree/main) contains `real_estate_ads.csv` (about 781 MB). No download happens during installation, ingestion, training, or testing.
- The card says 57 columns and a six-month 2024 period. The viewer exposes 60 columns and dates extending outside that period. Treat those upstream descriptions as inconsistent; inspect your downloaded revision rather than assuming a schema or date range.
- The published viewer shows `residential-sell` / `apartment-sell`, Persian room words and construction years, textual fixed-price mode `مقطوع`, and nullable amenities. The local mapping follows these representations.
- Currency units are not independently verified from the card. Outputs retain `price_value` source units; do not assume rial or toman or convert without verifying your source.

The MIT [LICENSE](LICENSE) applies to repository code. It does **not** relicense Divar data. Consult the upstream ODbL designation and [ODbL terms](https://opendatacommons.org/licenses/odbl/1-0/) before use or redistribution, including attribution and applicable database obligations. The repaired sample remains an illustrative repository fixture, not an extract attributed to Divar.

## Architecture and feature mapping

```text
local CSV ── validation ── optional SQLite staging
                    │                  │
                    └──── load ────────┘
                              │
                 sale filtering + stateless parsing
                              │
                 remove identical modeling records
                              │
                   seeded train/test split
                              │
           fit imputation + encoding on training data
                              │
             random forest / median baseline evaluation
                              │
                  joblib models + JSON metadata
```

| Source field | Role / processing |
| --- | --- |
| `cat2_slug` | Require `residential-sell`; never use rental targets |
| `cat3_slug` | Require `apartment-sell` or `house-villa-sell`; also one-hot encoded |
| `price_mode` | Require `مقطوع` (fixed price); exclude other modes |
| `price_value` | Positive finite numeric target; never imputed |
| `building_size` | Positive finite area in square meters; required for eligibility |
| `rooms_count`, `total_floors_count`, `floor` | Parse digits and supported Persian words; unknown/range labels become missing |
| `construction_year` | Numeric Solar Hijri year in 1200–1500, not age; censored or Gregorian labels become missing |
| `has_parking`, `has_elevator`, `has_balcony`, `has_warehouse` | All included; true/false and 1/0 become numeric; missing stays unknown until imputation |
| `city_slug` | One-hot encoded; unseen cities are supported |
| Other fields | Not model inputs: neighborhood, date, text, coordinates, legal details, rental/credit amounts, and remaining amenities |

Both Persian and Arabic numeral characters and conventional thousands/decimal separators are supported. Parsing rejects ambiguous numeric labels rather than concatenating their digits. Supported words include zero through twenty, no rooms, ground floor, and basement. Negative room/floor-count values become missing; floors below -5 become missing. Optional feature columns may be absent. Numeric features and amenities use training-only medians with missing indicators; entirely missing numeric columns fall back to zero. Missing categories use `unknown`. No scaling is needed for the forest. Models use 100 trees, one worker, and seed 42 by default.

## Technology and repository structure

Training uses Python, pandas, NumPy, scikit-learn, joblib, standard-library SQLite, and pytest. The serving stack adds FastAPI/Pydantic, Next.js App Router, React/TypeScript, Tailwind CSS, shadcn-style Radix UI primitives, Lucide, Recharts, React Leaflet, TanStack Query and Zod. Vitest covers frontend contracts/components and Playwright covers end-to-end integration. The default serving API does not import the heavy ML runtime. Flask, Python plotting libraries, and calendar conversion dependencies are unnecessary.

```text
amlaaak/
  data.py              CSV validation, loading, SQLite ingestion CLI
  preprocessing.py     Stateless parsing, filtering, feature definitions
  training.py          Pipelines, evaluation, persistence, training CLI
apps/
  api/                 Independently deployable FastAPI app and illustrative snapshot
  web/                 Next.js analytics workspace and server-side API proxy
scripts/
  prepare_dashboard.py Offline privacy-conscious snapshot / trusted model export
model_training.py      Compatibility training entry point
Schema.sql             60-column raw TEXT staging schema
sample database.csv    Repaired 10-row illustrative fixture
requirements.txt       Pinned direct runtime dependencies
requirements-dev.txt   Runtime dependencies plus pytest
requirements-lock.txt  Complete tested Windows/Python 3.14 environment
requirements-api-dev.txt API, training and API-test dependencies
tests/                 Preprocessing, ingestion, training and API tests
Dockerfile             Lean API or optional inference container
render.yaml            Backend deployment fallback
docs/                  Audit, architecture, API, deployment and validation
```

## Installation

Run from the repository root. Python **3.14** is the tested interpreter (3.14.7 on Windows); other Python versions and platforms have not been validated. A virtual environment is recommended. The lock file records transitive dependencies for the tested environment.

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-lock.txt
.\.venv\Scripts\python -m pip check
```

For a less strictly locked development install, use `requirements-dev.txt`; for runtime only, use `requirements.txt`. On Unix-like systems substitute `.venv/bin/python` for `.\.venv\Scripts\python`; that platform is untested.

## Smoke training and tests

```powershell
.\.venv\Scripts\python -m pytest -q
.\.venv\Scripts\python model_training.py --data "sample database.csv" --output-dir artifacts/sample
```

Optional SQLite route, using the same sample:

```powershell
.\.venv\Scripts\python -m amlaaak.data --csv "sample database.csv" --database data/smoke.db
.\.venv\Scripts\python -m amlaaak.training --data data/smoke.db --output-dir artifacts/sqlite-sample
```

Choose a **new database filename and empty output directory** for each run. Existing databases and nonempty artifact directories are refused to avoid overwriting previous work. A failed ingestion can leave an empty staging database; inspect it and choose a new filename before retrying. Invalid CSV record widths and duplicate/missing required headers are rejected.

## Prepare your own Divar data

1. Review the source license and manually obtain `real_estate_ads.csv` from the official file listing. Record its revision and keep it locally under `data/`. Do not commit the full dataset.
2. Keep original UTF-8 headers and standard CSV quoting (commas inside fields must be quoted). The required columns are `cat2_slug`, `cat3_slug`, `price_mode`, `price_value`, and `building_size`. See the mapping above for optional model features.
3. Use the same commands above, replacing the sample CSV or SQLite path with your local path and selecting new output destinations. Ingestion preserves all supplied recognized raw columns as text without changing their meaning. Unknown columns are rejected by SQLite ingestion, so review upstream schema changes explicitly.
4. Training filters out invalid/unsupported listings and reports raw input, retained distinct sales, and split counts. At least eight distinct valid records and two records in each split are required. This minimum enables smoke testing; it does not establish statistical adequacy.

CSV validation and SQLite insertion stream in chunks of 10,000 rows, after a complete structural validation pass. **Training loads the input into memory**, including raw columns; budget enough memory or manually create a documented local subset first. CSV and SQLite inputs follow the same preprocessing path.

## Evaluation and verified results

Evaluation uses a reproducible random holdout (25% test, seed 42) and reports MAE, RMSE, and R² for both models on the same test rows. Imputation and category vocabulary are fitted only on training rows. Exact duplicates over features plus target are removed before splitting.

Verified illustrative smoke run on Python 3.14.7: 10 input rows, 8 valid distinct sales, 6 training rows, **only 2 test rows**:

| Model | MAE (source units) | RMSE (source units) | R² |
| --- | ---: | ---: | ---: |
| Random forest | 174,500,000 | 220,319,086.78 | 0.603751 |
| Training-median baseline | 800,000,000 | 873,212,459.83 | -5.224490 |

These numbers verify execution only and cannot demonstrate generalization. The CSV and SQLite smoke routes produce the same metrics. Automated tests verify repeated-run reproducibility and model reload. No full Divar dataset has been downloaded or evaluated.

## Model outputs

Each output directory contains:

- `model.joblib`: fitted forest pipeline, including imputation and one-hot encoding.
- `baseline.joblib`: fitted median-baseline pipeline.
- `metadata.json`: source path/SHA-256, row counts, seed, split size, input/transformed features, estimator parameters, package versions, unit caveat, and metrics.

For direct programmatic inference on labeled records, call `prepare`, select `FEATURES`, then call the loaded pipeline's `predict`. The saved pipeline expects normalized feature frames; it does not include raw parsing. The FastAPI prediction route provides a validated unlabeled-feature contract and constructs that frame for a configured bundle. See [API documentation](docs/API.md). Only load trusted joblib files and use matching package versions. The saved forest remains fitted on the training partition used for evaluation; it is not subsequently refitted on all rows.

For serving, `scripts/prepare_dashboard.py` exports an existing model with its metadata and a checksummed manifest; it does not train or fabricate one. Generated bundles and real-data snapshots are ignored. The checked-in sample snapshot is derived solely from the illustrative fixture. Snapshot export is bounded to 50,000 eligible records; larger deployments require a database-backed adapter rather than loading the full source into a browser.

## Application checks

From the repository root after installing `requirements-api-dev.txt`, run `python -m pytest -q` through the virtual environment. In `apps/web`, run `npm.cmd run test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, and, with both servers running, `npm.cmd run test:e2e`.

Verified on Windows/Python 3.14.7/Node 24.18.0: **52 Python tests, 9 frontend tests, and 8 Playwright tests passed**; typecheck, lint and production build passed. The browser run exercised actual illustrative-model inference. Screenshots are generated in `apps/web/test-results/`; capture/review instructions and verification limits are in [deployment](docs/DEPLOYMENT.md) and [validation](docs/VALIDATION.md). Hosted deployment and Docker execution have not been verified.

## Limitations, roadmap, and responsible use

Asking prices are not completed-sale prices. Small or unrepresentative samples, duplicates beyond exact matches, geographic differences, inflation, and stale listings can distort results. Random holdouts do not establish performance on future dates or unseen neighborhoods. Solar Hijri construction years are retained directly; censored years lose information. Amenities are simplified and median imputation is only a baseline choice.

Next steps are a documented full-data experiment, temporal/geographic validation, duplicate/property grouping, stronger source-unit verification, better censored-year handling, and uncertainty/subgroup analysis. Evaluate these before relying on dashboard estimates. Production use also needs a reviewed data release, load tests, target-host bundle validation, appropriate authentication and rate limiting. Do not use this prototype as the sole basis for lending, investment, or housing decisions. Avoid republishing listing text or attempting to identify advertisers.

## Development history

The six commits present at the start of the dashboard work, including their authors/dates, are preserved. New work uses Conventional Commits without rewriting or force-pushing. See [the original audit](docs/AUDIT.md) for the earlier ML cleanup and [validation](docs/VALIDATION.md) for this application's scope and checks. No push or deployment was performed.

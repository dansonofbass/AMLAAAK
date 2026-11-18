# AMLAAAK — Real Estate Price Prediction

AMLAAAK is an Iranian real-estate research platform with direct Hugging Face historical-data retrieval, explainable comparable-property discovery, and separately trained Random Forest valuation. The Next.js workspace calls a typed FastAPI backend through a server-only proxy. It uses no managed database, PostgreSQL, MongoDB, paid map API, or generative-AI service. Nothing was pushed or deployed during this implementation.

## Verified prepared release ? deployment pending

The user's private uploaded archive at `8cc2a942d6d5d4b7cfa22e09a39d0223ff24019a`
passed authenticated manifest/inventory checks and actual local API/Next browser
acceptance: 420,813 prepared historical sales across 417 cities. The approved model
remains `267eff7c36f3`. **These counts are not claimed available in Production yet.**
Follow [the exact Vercel release instructions](docs/PREPARED_RELEASE_DEPLOYMENT.md).
No full archive/raw source was downloaded locally, no model was retrained, and no
remote settings, uploads, push or deployment were performed by the agent.

## Status and scope

This is a portfolio research prototype, not a production valuation system. The included **10 illustrative records are not verified Divar observations**. Eight are sales and two are rentals; training excludes the rentals. The bundled snapshot remains an explicit offline test mode. Live runtime prefers genuine Hugging Face records with strict retrieval limits. A bounded real-data experiment completed, described below; it is not a full-market validation. Inference remains unavailable unless a trusted artifact is explicitly configured.

## Analytics workspace

The dark analytics interface adapts the supplied `amlak dashboard.png`: a geographic canvas, floating/resizable chart cards, compact KPIs, cyan/violet accents, and a separate contextual insights rail. On mobile the charts stack and the rail opens on demand. The rail contains rule-based numerical observations, not a simulated AI assistant. Global typography uses next/font/google Roboto with Vazirmatn for Persian fallback. Accessible searchable dark pickers replace native dropdowns. An original SVG logo/favicon and licensed province outlines extend the visual system.

| Page | Implemented behavior |
| --- | --- |
| Overview `/` | Verified counts/medians, interactive Iran city map, price/area/year charts, type composition and amenities |
| Market analytics `/analytics` | Shared city/type/range/search filters, chart-driven selection and reset |
| Properties `/properties` | Server-side search, sorting, pagination and accessible detail dialog; no private text or exact locations |
| Price prediction `/predict` | City-dependent neighborhood form, real model estimate when configured, ranked historical comparables, separate comparable median and source coverage |
| Model performance `/model` | Artifact-backed forest/baseline metrics, source/split/version metadata; no invented residuals |

All successful UI data flows through typed FastAPI/Pydantic responses, validated by Zod at the frontend boundary. The map combines public-domain Natural Earth country outlines, licensed geoBoundaries/OSM province geometry, and approximate public city centers. Municipal city limits were not verified. See [map attribution](apps/web/public/ATTRIBUTION.md) for CC BY 4.0 and ODbL attribution. No map key or external tiles are needed. Unmapped cities remain in tables and aggregates.

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

Open `http://127.0.0.1:3100`. This starts genuine bounded Hugging Face analytics; inference is honestly unavailable until configured. Set AMLAAAK_DATA_MODE=illustrative in the API terminal for offline fixture analytics. The [deployment guide](docs/DEPLOYMENT.md) includes the exact optional model-training/export commands, environment variables, two independent Vercel projects, and Render/Docker fallback. It also explains how to prepare a permitted real-data snapshot. No training occurs during build or request handling, and no writable persistent SQLite database is used by the hosted API.

Further documentation: [architecture](docs/ARCHITECTURE.md), [API routes and schemas](docs/API.md), [deployment and screenshots](docs/DEPLOYMENT.md), [verified validation results](docs/VALIDATION.md). Interactive OpenAPI is available at the backend's `/docs`.

## Live historical data and comparable discovery

Official source: https://huggingface.co/datasets/divarofficial/real_estate_ads. Runtime uses the Dataset Server's `/splits`, `/rows`, and capability-probed `/filter`; `/parquet` was inspected for discovery only. The Hub metadata API verified revision `e9446ee97b8e6eb9bd62bdfd7548f1bc8973be85` and the ODbL designation.

**Remote `/filter` and `orderby` requests failed during verification** with upstream authentication-check errors/timeouts. The provider can use filtering when it recovers, but currently falls back to a bounded unfiltered source prefix, then normalizes and filters locally. Default runtime examines at most **300 of 1,000,000 source rows**; it does not silently call those records the complete market. Cache: 8 populations per worker, 120-second TTL; pages have explicit timeouts/retries and revision checks. No full download occurs at startup or build time. There is no automatic fallback to illustrative records or invented predictions.

Coverage accompanies summaries, property pages, distributions, facets and valuation: examined/normalized/eligible counts, upstream count, source revision, exhaustive/bounded flags, method, supported remote operations, source period and limitations. City responses include coverage metadata and headers. Counts, sorting and charts describe the retrieved records only. City/neighborhood options also reflect that limited population. Currency remains unverified; every price retains original `price_value` units.

`POST /api/v1/valuation` returns an optional ML estimate plus up to eight comparables from records actually retrieved. Matching requires the same city and residential sale category, then weights area, bedrooms, construction year, floor, known amenities, neighborhood and relative advertisement period. Missing features are not silently treated as matching. Scores are explainable heuristics, not probabilities. The displayed comparable median remains separate from the model estimate. Records include historical month, neighborhood and a revision/row-based source identity, not an invented active-ad URL, photograph or address.

If the model is unavailable, comparable search still works. If Hugging Face is unavailable, an available model can still return its estimate with an explicit zero-coverage comparable-search failure. Details: [data-provider contract](docs/DATA_PROVIDER.md) and [API](docs/API.md).

## Verified bounded real-data experiment

An explicit acquisition examined 2,000 source rows, yielding 862 eligible historical sales. Conservative specification grouping removed five near-duplicates, leaving 857 records. Whole-month temporal partitions used 414 training records (2024-01 through 2024-08), 323 validation records (2024-09 through 2024-11), and 120 test records (2024-12 through 2025-02). Validation selected `min_samples_leaf` from 1 and 3; preprocessing was fitted only on training rows. The test partition was held out throughout selection.

| Estimator | Test MAE (source units) | Test RMSE (source units) | Test R2 |
| --- | ---: | ---: | ---: |
| Random Forest | 3,139,678,931.81 | 7,929,988,797.03 | 0.166432 |
| Training-median baseline | 4,291,034,063.79 | 9,167,436,225.77 | -0.114016 |

These are genuine executed results from a bounded, non-random source prefix, not production accuracy or full-market coverage. Per-city evaluation requires at least 30 test records; no city met that threshold. Neighborhood was not added to the estimator without an out-of-sample ablation; it is used for comparable ranking and duplicate grouping. Exact versions, source hash and limitations are in [the experiment record](docs/REAL_DATA_EXPERIMENT.json).

Explicit acquisition and training (fresh output paths required):

```powershell
.\.venv\Scripts\python scripts/acquire_divar.py --output data/divar-live-2000.csv --revision e9446ee97b8e6eb9bd62bdfd7548f1bc8973be85 --max-records 2000
.\.venv\Scripts\python -m amlaaak.real_training --data data/divar-live-2000.csv --output-dir artifacts/divar-temporal --revision e9446ee97b8e6eb9bd62bdfd7548f1bc8973be85
.\.venv\Scripts\python scripts/prepare_dashboard.py --source data/divar-live-2000.csv --output data/divar-dashboard.json --kind divar --revision e9446ee97b8e6eb9bd62bdfd7548f1bc8973be85 --model-source artifacts/divar-temporal --model-output apps/api/assets/divar-model
```

Then set `AMLAAAK_MODEL_DIR` to that exported directory before starting FastAPI. No acquisition/training runs inside HTTP handlers. Source/model artifacts remain ignored and must be explicitly provisioned for deployment. Original fixture training commands below remain supported.

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

These numbers verify execution only and cannot demonstrate generalization. The CSV and SQLite smoke routes produce the same metrics. Automated tests verify repeated-run reproducibility and model reload. The full Divar dataset has not been downloaded or evaluated. The separately documented genuine-data experiment uses only an explicitly acquired bounded prefix.

## Model outputs

Each output directory contains:

- `model.joblib`: fitted forest pipeline, including imputation and one-hot encoding.
- `baseline.joblib`: fitted median-baseline pipeline.
- `metadata.json`: source path/SHA-256, row counts, seed, split size, input/transformed features, estimator parameters, package versions, unit caveat, and metrics.

For direct programmatic inference on labeled records, call `prepare`, select `FEATURES`, then call the loaded pipeline's `predict`. The saved pipeline expects normalized feature frames; it does not include raw parsing. The FastAPI prediction route provides a validated unlabeled-feature contract and constructs that frame for a configured bundle. See [API documentation](docs/API.md). Only load trusted joblib files and use matching package versions. The saved forest remains fitted on the training partition used for evaluation; it is not subsequently refitted on all rows.

For serving, `scripts/prepare_dashboard.py` exports an existing model with its metadata and a checksummed manifest; it does not train or fabricate one. Generated bundles and real-data snapshots are ignored. The checked-in sample snapshot is derived solely from the illustrative fixture. Snapshot export is bounded to 50,000 eligible records; larger analyses require explicit offline preparation or a deliberately expanded remote retrieval strategy with truthful coverage, never a full browser CSV download.

## Application checks

From the repository root after installing `requirements-api-dev.txt`, run `python -m pytest -q` through the virtual environment. In `apps/web`, run `npm.cmd run test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, and, with both servers running, `npm.cmd run test:e2e`.

Verified on Windows/Python 3.14.7/Node 24.18.0: **72 deterministic Python tests, 11 frontend tests, 12 offline Playwright tests, 2 genuine live Python integration tests, and 2 genuine live Playwright integration tests passed**; typecheck, lint and production build passed. Browser runs exercised both illustrative and genuine-data model inference, actual Hugging Face responses, neighborhood selection, comparables, opened dropdowns without hover, and province selection. Screenshots are generated in `apps/web/test-results/`; capture/review instructions and verification limits are in [deployment](docs/DEPLOYMENT.md) and [validation](docs/VALIDATION.md). Hosted deployment and Docker execution have not been verified.

## Limitations, roadmap, and responsible use

Asking prices are not completed-sale prices. Small or unrepresentative samples, duplicates beyond exact matches, geographic differences, inflation, and stale listings can distort results. Random holdouts do not establish performance on future dates or unseen neighborhoods. Solar Hijri construction years are retained directly; censored years lose information. Amenities are simplified and median imputation is only a baseline choice.

Next steps are a documented full-data experiment, temporal/geographic validation, duplicate/property grouping, stronger source-unit verification, better censored-year handling, and uncertainty/subgroup analysis. Evaluate these before relying on dashboard estimates. Production use also needs a reviewed data release, load tests, target-host bundle validation, appropriate authentication and rate limiting. Do not use this prototype as the sole basis for lending, investment, or housing decisions. Avoid republishing listing text or attempting to identify advertisers.

## Development history

All commits present at valuation-platform baseline f7f6f8c, including their authors and dates, are preserved. New work uses Conventional Commits without rewriting or force-pushing. See [the original audit](docs/AUDIT.md) for the earlier ML cleanup and [validation](docs/VALIDATION.md) for this application's scope and checks. No push or deployment was performed.

### Deploy the approved trained model

The public, revision-pinned Random Forest model has been downloaded and verified through the production loader, and exercised through real valuation and frontend proxy integration. Both API dependency manifests now include the exact compatible ML versions. Follow [the Vercel setup](docs/DEPLOYMENT.md#two-vercel-projects-approved-real-model-deployment) for the two project roots, pinned artifact settings, server-side API_BASE_URL and hosted acceptance checks. No hosted deployment or hosted performance verification has been performed.

## Prepare the complete historical archive in Colab

The self-contained [prepare_divar_dataset.ipynb](notebooks/prepare_divar_dataset.ipynb)
prepares all eligible sales from the pinned official source **in Google Colab**, without
downloading the original dataset onto your laptop. It creates privacy-minimized Parquet,
geographic/query indexes, exact statistics and a checksummed manifest. Upload to the
existing private Hugging Face dataset requires explicit confirmation and remote read-back
verification. The optional prepared FastAPI provider uses indexed chunks through the
existing Next proxy; the dashboard design and approved model remain unchanged.

Start with [the simple Colab → Vercel guide](docs/PREPARED_DATA_QUICKSTART.md).
The user completed the upload. The agent verified the pinned private release and local
prepared API/browser integration; hosted prepared mode has **not** been activated by the agent.
The current default provider remains the bounded Hugging Face prefix provider until
you finish that workflow and explicitly change the backend mode. More searchable
historical listings are not additional model training data. See [format and query
budgets](docs/PREPARED_DATA.md), including the city requirement for combined filters.

# Valuation platform validation - 2026-11-17

Baseline f7f6f8c and all existing commits/authors were preserved. Existing test coverage was retained; browser selectors were adapted to accessible picker controls and the combined valuation route.

## Verified execution

- Genuine HF metadata, splits, rows and Parquet discovery succeeded at revision e9446ee97b8e6eb9bd62bdfd7548f1bc8973be85. Actual filter/orderby probes failed with temporary upstream authentication-check errors/timeouts. Working runtime uses honest bounded rows-prefix fallback.
- Explicit acquisition examined 2,000 source rows, retained 862 eligible sales, and stored only safe structured fields in an ignored local file. Five near-duplicate specification groups were removed for training.
- Real-data training completed: 414 train / 323 validation / 120 later-period test records. Test forest MAE 3,139,678,931.81; RMSE 7,929,988,797.03; R2 0.166432. Baseline MAE 4,291,034,063.79; RMSE 9,167,436,225.77; R2 -0.114016. Original source units; no full-market validation claim.
- Actual browser -> Next proxy -> FastAPI -> HF retrieval and real sklearn inference executed. Comparable cards used genuine retrieved source rows, neighborhoods and historical months. Model estimate and comparable median remained separate.
- Offline mode also passed with real fixture analytics and illustrative model inference. No hardcoded successful responses substitute for production data.

## Automated checks

| Check | Verified result |
| --- | --- |
| Deterministic Python suite | 72 passed; 2 live tests skipped by default |
| Opt-in actual-network Python tests | 2 passed; not mocked |
| Frontend Vitest | 11 passed |
| Offline Playwright | 12 passed; 2 live tests skipped |
| Actual live Playwright | 2 passed; actual backend/HF/model calls |
| TypeScript | Passed |
| ESLint | Passed |
| Production build | Passed; Roboto/Vazirmatn fonts compiled |
| Existing ML/API tests | Retained and passed |

The tests cover shared parsing, invalid/missing fields, pagination, retries, long/short 429 handling, cache capacity/expiry, revision drift, unavailable models, actual serialized model predictions, temporal splitting, comparable ranking/coverage, approved artifact trust guards, provider response contracts, geographic point containment, dropdowns, map selection and responsive layouts. The Python suite emits one existing upstream Starlette TestClient httpx deprecation warning.

## Visual checks

Playwright screenshots were inspected for desktop/mobile valuation, opened city popups without mouse hover, selected province geometry, and live historical-data results. Popup background/text are explicit dark/light colors; search and keyboard selection work. Roboto is applied via next/font/google with a Persian fallback, including chart/map text. Mobile tests assert no document horizontal overflow. Geometry is province-level and clearly labeled, not fabricated city limits.

Screenshots are ignored under apps/web/test-results. The system-browser bridge was unavailable, so visual QA used the explicitly requested Playwright workflow. No accessibility-certification or measured layout-shift score is claimed.

## Environment and verification limits

Windows, Python 3.14.7, Node 24.18.0, Next.js 16.4.6, React 19.3.1. A damaged local dependency installation was preserved outside the frontend tree and replaced from the lockfile. Windows sandbox process-launch error 1909 required the host executor for later checks. Host access to the old pytest system-temp/cache directories failed; final pytest used a fresh verified workspace-local --basetemp and -o cache_dir under ignored data/. No tests were removed or skipped to hide failures. Stale verified AMLAAAK servers were restarted; unrelated applications were untouched. These environment failures were not hidden as successful tests; final checks ran against the repaired installation and current routes.

No deployment or push was attempted. Vercel entrypoint/runtime/limits were checked against official documentation, but target-host bundle footprint/cold starts and hosted inference remain unverified. The Docker daemon was unavailable; container/Render configuration is implemented and documented but execution is unverified. At the original platform validation, remote provisioning had not yet been exercised. The subsequent approved public-model verification below supersedes that limitation. No managed database was introduced.

## Approved public-model deployment preparation

The operator subsequently supplied `thevel0per/AMLAAAK-Price-Predictor` at immutable revision `89de24728daecdec3731e07475ab985c1efa87ad` and trusted manifest SHA-256 `a8d51e5f441b30a541b92ac33fb7838a39c0d8da1ce5b051cd3a67e55e98d3e5`. The production loader actually downloaded all three public files, verified integrity and exact package versions, and loaded model `267eff7c36f3`. Direct prediction and real POST `/api/v1/valuation` returned 6,076,080,000 source units for the documented Tehran input, plus eight genuine Divar comparables from 300 examined source rows. No successful external responses were mocked.

- Deterministic Python suite after deployment checks: 76 passed, 3 opt-in network tests skipped.
- Public remote-model/inference/valuation integration: 1 passed.
- Actual dataset connectivity/API integration: 2 passed.
- Frontend unit tests: 11 passed; typecheck, ESLint and production build passed.
- Live Playwright against production Next build and API imported from `apps/api`, using remote model configuration: 2 passed. Server-side `API_BASE_URL` forwarding and genuine model/comparable results worked.
- `pip check`: no broken requirements.
- Linux CPython 3.14 binary dependency resolution: 25 wheels, 251,772,240 uncompressed bytes. This is not a hosted function build.

Local provisioning took 9.487 seconds; first valuation 7.840 seconds. API working set after live browser checks was 196,136,960 bytes. These single Windows measurements are not hosted latency/memory guarantees. Hosted bundle size, cold starts, concurrency, platform protection and execution remain unverified. No model/dataset binaries were committed, no push/deployment occurred, and existing history was preserved. Exact setup and next steps are in DEPLOYMENT.md.

## Prepared-data integration — 2026-11-18

Implemented a self-contained Colab notebook, bounded streaming preparation,
private manifest-pinned data adapter, indexed statistics/pagination and truthful
frontend archive wording. The full original source was **not downloaded or processed**
on the laptop, no Colab runtime was executed by the agent, no private dataset was
uploaded, and no production mode was changed. Private-provider/network upload tests
use mocks and synthetic records; their counts are not Divar dataset results.

- Python: 116 passed, 3 opt-in network tests skipped by default.
- Actual opt-in source/model network regression: 3 passed. Approved model version
  remained `267eff7c36f3`, direct prediction `6076080000.0`; actual valuation returned
  8 genuine prefix-provider comparables. This does not verify the private adapter live.
- Frontend unit tests: 12 passed. Typecheck, lint and production build passed.
- Prepared browser integration: 1 passed against synthetic 18-record preparation
  output and a mocked private-file HTTP boundary, through the actual FastAPI/Next
  proxy. Counts, city/neighborhood filters, pagination, details and comparables worked.
- Existing offline browser regression: 12 passed; 3 opt-in browser tests skipped.
- `pip check`: no broken requirements. Preparation-only packages remain outside the
  Vercel runtime manifests; model package pins and approved artifact checks are preserved.

Actual read-only source inventory checks verified `real_estate_ads.csv` at the pinned
commit (780,721,338 bytes; LFS SHA256 documented in PREPARED_DATA.md), and source card
license `odbl`. Hub tree and dataset-file inventories agreed. The notebook's corresponding
inventory/license APIs were exercised without fetching that CSV. Code cells compile;
embedded preparation and the unapproved-upload stop executed with synthetic input.

Read-only hosted baseline checks returned HTTP 200 from backend health/model status
and frontend-proxied health. They showed provider `huggingface`, model available,
version `267eff7c36f3`; lazy dataset readiness was false before retrieval. These checks
describe the existing deployment, **not a new prepared-data production connection**.

Remaining manual acceptance: successful full Colab EOF/count/hash validation, explicit
upload approval, actual private-repository read-back, verified dataset commit/hash,
backend read-token configuration, Preview function-size/memory/cold-start checks,
and hosted prepared-mode/browser acceptance. Exact steps and rollback are in
PREPARED_DATA_QUICKSTART.md. No push or deployment was performed.

## Uploaded private release acceptance — 2026-11-18

This supersedes the earlier pre-upload limitation: the user supplied the prepared
release, and existing authenticated access allowed actual private verification.
No full raw source/archive download, uploads, model changes, push, deployment or
remote environment changes were performed by the agent.

- Exact private commit `8cc2a942d6d5d4b7cfa22e09a39d0223ff24019a` resolved; actual
  manifest body SHA256 matched `3f4dff6cd149c10c579371a8d33a151b64c72e11fa9aed00b132892198d72048`.
- All 5,201 indexed files were present with matching remote sizes. All 5,200 available
  Hub LFS SHA256 values matched; the remaining catalog body plus four bounded sample
  bodies passed direct hashing. Original source inventory/hash also matched its
  pinned official repository. All archive/city/category/partition/sort-index totals
  agree: 1,000,000 published processed source rows, 420,813 prepared sales, 417 cities.
  This is published-manifest/index and LFS identity verification, not a new raw-source
  processing run or independent body parsing of every archive row.
- Real local backend HTTP checks passed for statistics, all cities, neighborhoods,
  both property pages, sorting, numeric filtering, direct details, prediction and
  comparable valuation. Tehran has 88,145 archive sales and 344 neighborhoods;
  valuation searched 84,331 apartment candidates and returned 8 actual comparables.
- The same complete HTTP acceptance passed through the actual built Next proxy.
  A real Playwright private-release browser test passed without model/data mocks;
  it confirmed archive counts, coordinated filters, pagination, valuation and absence
  of browser-side Hugging Face requests. This is local integration, not hosted success.
- Approved model version 267eff7c36f3 and test-input prediction 6076080000.0 remained
  unchanged. Model artifact loader, integrity checks, ML package pins and experiment
  files were not modified. The larger search archive was not used for retraining.
- Python regression: 123 passed, 3 opt-in network tests skipped. Frontend unit tests:
  12 passed; typecheck, lint and production build passed. Private-release live checks
  are repeatable with the two scripts documented below, separately from pytest skips.
- Permanent notebook Dataset Card fix: YAML `license: odbl`; manifest contract remains
  `license: odbl-1.0`. Notebook cells are regenerated and checked against shared modules.

The initial sequential real Tehran query hit its 25-second guard at 26.15 seconds.
Four-way bounded fetching plus per-file single flight and one shared city-population
cache fixed the observed failure: real cold population 20.048 seconds, warm population
about 0.001 seconds; actual direct HTTP valuation 13.597 seconds and proxied valuation
13.756 seconds. The final bounded top-eight ranking retains the same scores/order without
materializing all comparable results. A fresh final Windows API process measured
598,351,872 bytes peak working set after real API/proxy acceptance. These are local measurements, not Vercel SLAs.

Evidence: PREPARED_RELEASE_VERIFICATION.json, PREPARED_LOCAL_API_VERIFICATION.json,
PREPARED_LOCAL_PROXY_VERIFICATION.json. No listing rows, record identifiers or token
values are included in those reports. Read-only hosted baseline checks still showed
the old huggingface provider and working model, so 420,813 Production availability
is **not** claimed. Follow PREPARED_RELEASE_DEPLOYMENT.md for Preview acceptance,
backend-only read token, exact pins, deployment order and rollback.

Existing offline browser regressions after the final changes: 12 passed; four opt-in
network/synthetic prepared browser tests skipped by default. The real private-release
browser test was executed separately and passed.

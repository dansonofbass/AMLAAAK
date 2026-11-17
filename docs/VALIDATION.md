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

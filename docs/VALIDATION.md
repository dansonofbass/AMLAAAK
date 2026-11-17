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

No deployment or push was attempted. Vercel entrypoint/runtime/limits were checked against official documentation, but target-host bundle footprint/cold starts and hosted inference remain unverified. The Docker daemon was unavailable; container/Render configuration is implemented and documented but execution is unverified. Remote model hosting/provisioning was not exercised with an approved real repository because none was provided; trust guards were tested with mocked external HTTP only. No managed database was introduced.

# Simplified dashboard redesign

Feature branch: `feature/simplified-dashboard-redesign`, based on the latest cached
verified Preview commit `f13e9e5` from `origin/prepared-release-preview`. That base
contains the Trusted Sources/OIDC proxy fix. The local Preview branch and main were
not overwritten. No environment files, Vercel protection settings, dataset/model
pins or remote deployments are changed by this work.

## Implemented product changes

- Full-page application: 240px desktop sidebar, restrained header, normal-flow main
  content and accessible mobile drawer. Four primary routes; methodology is secondary.
- Exact supplied AttackPath token palette, flat cards, blue chart/map styling,
  Orbitron English display text, readable Roboto body and Vazirmatn Persian text.
- Real persisted English/Persian UI switching, RTL/LTR document direction, translated
  forms/navigation/states/chart labels, and Persian/Arabic numeric parsing. Source
  location slugs without a verified translated label remain readable source names.
- Overview: four actual-response KPIs, separate lazy Leaflet map, four two-column
  charts and an estimator link. No estimator form, frame, draggable widgets, reset
  widget controls, right-side rail, decorative notifications or window chrome.
- Estimator: essential city/type/area/bedroom inputs, dependent neighborhood search,
  optional additional details, and explicit Yes/No/Unknown amenities. Results stay in
  the document flow, with model/median separated and up to eight real comparables below.
- Optional asking-price comparison is arithmetic, not a confidence/valuation claim.
  A comparable median requires at least three returned records; no unsupported price
  range or confidence interval is generated. Model scope/unknown-data warnings remain.
- Explorer: searchable city/neighborhood filters, staged range validation, sorting,
  server pagination, mobile record cards and accessible structured provenance details.
- Analytics: city comparisons, price histograms and progressively disclosed amenity/
  construction-year charts. No full archive or unbounded chart series in the browser.

## Compatibility and security

The protected server API proxy is unchanged from `f13e9e5`. It still reads API_BASE_URL
and API_TOKEN server-side and forwards Vercel's x-vercel-oidc-token as
x-vercel-trusted-oidc-idp-token only to the configured Vercel origin. No token is
returned to the browser. Unit tests cover app bearer/OIDC forwarding, non-Vercel
identity exclusion, and absence of HF_TOKEN in forwarded or returned content.
No Deployment Protection setting, Trusted Sources relationship or real auth secret
was changed. Local tests do not substitute for a new hosted OIDC acceptance run.

The prepared dataset remains private at the same `8cc2a942d6d5d4b7cfa22e09a39d0223ff24019a`
revision and trusted manifest hash. The original model artifact remains 267eff7c36f3.
No training, uploads, model replacement or full dataset download occurs.

### Optional input extension

The previous endpoint required every advanced field. To support an honest essential-
only workflow, existing Pydantic/Zod advanced fields now accept omitted/null values.
Names, numeric bounds, known-boolean semantics, endpoints and response contracts are
preserved. Existing full-detail clients remain compatible. The only newly accepted
input states are genuinely missing construction/floor/floor-count/amenity values.

Inference converts missing numeric features to NaN for the **existing fitted imputer**;
it does not fit preprocessing, train the model or invent property attributes. Explicit
false stays false. Comparable scoring omits unknown subject characteristics rather
than claiming they match missing/false attributes. For fully specified inputs the
existing feature weights and model output remain unchanged.

Deploy the updated backend Preview **before** the new frontend: an old required-only
backend will reject new null inputs. Backend bounds still apply; floor must not exceed
total floors when both are known. City/type/positive area/bedrooms remain required.

## Local verification

Use the explicit illustrative backend for deterministic UI tests; it never silently
replaces prepared-mode data. The checked-in screenshots show this labeled QA fixture,
not private source records or genuine market/model performance.

```powershell
.\.venv\Scripts\python -m pytest -q
.\.venv\Scripts\python -m pip check
```

From apps/web:

```powershell
npm.cmd run test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

New tests cover optional/null vs false inputs, real fitted inference with missing
features, both languages/numeral formats, exact palette/fonts, full-page layout,
keyboard city/map selection, filter correction, mobile/tablet/drawer focus, actual API
pagination, client comparisons, failure states and the protected proxy. Existing
training/preparation/integrity tests remain. Successful data responses are not mocked
in the real browser flows; only explicit failure cases and unit external boundaries
use mocks.

## Review a new protected Preview

1. Review `git diff origin/prepared-release-preview...feature/simplified-dashboard-redesign`
   and the focused local commits. Push the **feature branch only** when ready; never
   push it directly to main or promote Production automatically.
2. Create/review the backend Preview from this branch (`apps/api`), keeping existing
   prepared mode, immutable dataset/model pins, backend-only HF read token and app
   authentication. Do not rerun Colab or change the archive/model.
3. Build the frontend Preview (`apps/web`) with its server-side API_BASE_URL pointing
   at that compatible backend Preview, preserving API_TOKEN. Keep Deployment Protection
   enabled and retain the existing Vercel Trusted Sources relationship/OIDC integration.
   Make any needed Preview URL configuration manually; this task changes none.
4. Verify Overview count 420,813 / 417 cities, city/neighborhood selection, Explorer
   pagination and Estimator using both essential-only and fully specified inputs.
   Verify model version 267eff7c36f3, real comparables, and source coverage. Check
   English, Persian RTL, mobile menu, keyboard focus and loading/error states.
5. Run the real prepared suite against that Preview when protected access is available:

   ```powershell
   cd apps/web
   $env:PLAYWRIGHT_BASE_URL='<frontend Preview origin>'
   $env:PREPARED_LIVE_E2E='1'
   npm.cmd run test:e2e -- --grep 'verified private prepared release'
   ```

   The test runner must have legitimate access to the protected frontend. Do not
   disable protection or expose bypass/OIDC credentials to make this pass. The Next
   server's outbound OIDC token is supplied by Vercel, not by local browser code.
6. Inspect Preview function size, cold/warm latency, memory and errors before any
   separate Production decision. This redesign does not authorize Production deployment.

The earlier release guide describes artifact verification, serving limits, deployment
roots and rollback. Its historical “deployment pending” audit text describes that
earlier session, not the subsequently verified protected Preview. Current review
status and this branch's tests are recorded in the final section of VALIDATION.md.

## Simplified dashboard acceptance - 2026-11-18

Feature branch: feature/simplified-dashboard-redesign; base: f13e9e5 from
origin/prepared-release-preview. No push, deployment or real environment change.

- Backend: 124 passed, 3 opt-in tests skipped. Windows denied the shared pytest
  temporary root on the first rerun; a fresh ignored workspace --basetemp directory
  resolved it. One pytest cache warning remained; there were no test failures.
- Frontend: 17 unit tests passed, including Persian/Arabic numeral parsing and
  server-only bearer/OIDC forwarding. TypeScript, ESLint and production build passed.
- Final offline browser suite: 12 passed, 4 opt-in integration tests skipped.
  Covers full-page navigation, map keyboard selection, filtering/pagination,
  essential-only valuation, explicit false versus unknown, Persian RTL persistence,
  mobile focus, loading and failures without fabricated KPIs.
- Authenticated real prepared browser suite: 1 passed separately against the new
  local frontend and actual private dataset/approved model. No browser HF requests.
- Complete real smoke checks passed both directly on FastAPI and through Next:
  420,813 records, 417 cities, Tehran 88,145 records / 344 neighborhoods, pagination,
  filtering, sorting, statistics and record details. Returned 8 real comparables
  from 84,331 eligible candidates. Model version remained 267eff7c36f3; fully
  specified reference prediction remained 6,076,080,000 original source units.
  Essential-only prediction with unknown optional attributes also passed.
- Local valuation timings in these runs: 10.699 seconds direct and 12.438 seconds
  proxied. These are local observations, not hosted latency or memory guarantees.
- Screenshots were captured and visually inspected on desktop and Persian mobile
  using labeled illustrative QA data. No private listing screenshots are committed.
- The protected proxy is byte-unchanged from f13e9e5. Dataset/model pins, approved
  artifacts, dependency locks and legal notices are unchanged. No full archive was
  downloaded; existing indexed/bounded fetching was exercised with local secure auth.

Remaining acceptance: deploy this branch to a new protected backend Preview first,
then connect a frontend Preview and repeat acceptance with genuine Vercel OIDC.
No new hosted OIDC, cold-start, memory or request-duration claim is made. Production
was not changed. Follow UI_REDESIGN.md for exact review and Preview steps.

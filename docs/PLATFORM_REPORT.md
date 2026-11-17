# Valuation platform implementation report

## Files and functionality

- Data: canonical apps/api/service/normalization.py; HuggingFaceDataProvider, bounded cache/retry/revision checks; shared amlaaak/preprocessing.py adapter; explicit scripts/acquire_divar.py. The original local ingestion workflow remains available.
- ML: amlaaak/real_training.py; existing forest/baseline pipeline retained; train/validation/test chronology; artifact export and optional approved model provisioning. Generated source data and models remain ignored.
- Product: POST /valuation, data facets, explainable comparables, separate ML/comparable results, historical source identities, neighborhood selection and typed frontend contracts.
- UI: global Roboto/Persian fallback, Radix searchable dark pickers, uniform Lucide styles, clear coverage cards, improved typography and responsive comparable cards.
- Branding: public/brand/logo-dark.svg, logo-light.svg, symbol.svg; public/favicon.svg and app/icon.svg. Original geometric roof/data-bar motif; no copied third-party brand.
- Map: licensed lazy-loaded geoBoundaries province geometry, selected-state outline, city-linked hover/popup choices and existing approximate city markers. Municipal boundaries were not verified or claimed. Upstream file contains 32 features versus 33 metadata units; attribution preserves this discrepancy.
- Tests/docs: expanded Python/unit/browser/live tests; provider, API, deployment, architecture and experiment records; unchanged prior Git history.

## Actual source access

Successful actual requests: Hub dataset metadata, /splits, /rows, /parquet discovery. /filter/orderby probes failed; no successful remote filtering is claimed. Default runtime examines a maximum 300 source rows; explicit training acquisition examined 2,000. All statistics/comparable matches are scoped to retrieved historical records. Real observed source fields, not fake data, supplied the live comparable results.

## Executed model experiment

862 eligible sales; 857 after conservative near-duplicate grouping; 414 train / 323 validation / 120 test. Whole-month temporal separation. Genuine forest test MAE 3.140 billion, RMSE 7.930 billion, R2 0.166432 versus median-baseline MAE 4.291 billion, RMSE 9.167 billion, R2 -0.114016, all in original unverified currency units. See REAL_DATA_EXPERIMENT.json for exact evidence. These results are modest and bounded, not production or full-market accuracy. No city met the 30-test-record threshold for meaningful per-city reporting.

Actual local model inference was activated and exercised end to end. It is not enabled automatically on a fresh deployment: operators must provision a trusted artifact and compatible runtime. Comparables remain available when a model is absent; an available model can still respond when the candidate source fails, with explicit zero search coverage.

## Verification

72 deterministic Python tests, 11 frontend tests, 12 offline browser tests, 2 actual-network Python tests and 2 actual live browser tests passed. Typecheck, ESLint and production build passed. Desktop/mobile/open-dropdown/selected-map/live-valuation screenshots were inspected. Open popup readability was checked without hover, and city changes updated actual API aggregates. Detailed evidence and remaining environmental limits are in VALIDATION.md.

## Run and deploy

Exact Windows commands are in DEPLOYMENT.md. Expected URLs: backend 127.0.0.1:8000 and frontend 127.0.0.1:3100. Explicit modes: huggingface, illustrative/snapshot, model-unavailable, and model-backed inference. Vercel roots remain apps/api and apps/web. Configure server-only API_BASE_URL and optional matching app tokens. ML deployment requires a reviewed local or approved revision/hash-pinned artifact and exact dependency versions; use the implemented Render/Docker alternative if function packaging is unsuitable. No database service is required.

## Limits and Git safety

Failed upstream filtering, bounded-prefix bias, source outliers, unverified units, historical/stale advertisements, heuristic duplicate/ranking logic, incomplete mapped city coverage, no verified city-limit polygons, no calibrated confidence intervals and untested hosted ML footprint remain explicit. No fake URLs/photos, prices, market volumes or live-status claims were added.

New work is organized into descriptive local Conventional Commits; inspect git log --oneline from the baseline f7f6f8c. All previous commits/authors remain unchanged. Full dataset/source files, model binaries, credentials, recovery dependencies and QA outputs were not committed. Nothing was pushed or deployed.

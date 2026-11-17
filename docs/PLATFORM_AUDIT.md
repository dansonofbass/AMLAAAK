# Valuation-platform audit — 2026-11-17

Baseline: `f7f6f8c` on main, clean working tree, existing history and authorship preserved. All tracked source/configuration/documentation files were inventoried and read before implementation. The existing independent Next.js/FastAPI apps and Python ML modules were retained.

## Existing capabilities and gaps

The five Next.js pages, shared TanStack Query filters, typed Zod contracts, server-only API proxy, Pydantic endpoints, read-only prepared JSON repository, local CSV/SQLite ingestion, Random Forest/median-baseline training, trusted joblib loading, privacy exclusions and generated-artifact ignores already worked. The existing 52 Python and 9 frontend tests covered the illustrative workflow. Its map had Natural Earth country geometry and approximate city markers. Styling used Arial, Lucide icons and small dark chart cards. The sidebar/header mark was a generic building icon. Native selects had platform-dependent popup contrast.

There was no direct runtime Hugging Face provider, comparable ranking, combined valuation endpoint, neighborhood selection, temporal validation workflow, original logo, or province/city geometry. The configured default used the ten-row illustrative fixture (eight eligible sales); default inference was unavailable. The prior deployment manifests supported separate Vercel roots and a Docker/Render alternative. No new database service was needed or added.

## Verified source behavior

Actual HTTP requests used dataset `divarofficial/real_estate_ads`, `default/train`. Metadata returned revision `e9446ee97b8e6eb9bd62bdfd7548f1bc8973be85` and ODbL designation. `/splits`, `/rows` and `/parquet` succeeded; `/rows` reports 1,000,000 total source rows and a 100-row page maximum. Sixty source fields were observed, including mixed Persian text/numerals, null amenities, textual construction years, Gregorian advertisement months, nullable neighborhoods and float prices/areas.

Multiple real `/filter` requests (city, residential category, city + neighborhood, numeric predicates and orderby) failed with temporary HTTP 500 authentication-check errors or timeouts. Therefore successful remote filtering/sorting is **not** claimed. The implementation can use `/filter` if it recovers, with safe literal quoting and numeric-column restrictions. It otherwise explicitly reports the bounded unfiltered `/rows` prefix and applies filters locally. Per-worker cache is bounded; no startup/build full download occurs.

Explicit offline acquisition examined only 2,000 source rows, yielding 862 eligible sales. That prefix spans observed months 2024-01 through 2025-02, not a verified full-dataset period. Models/analytics from it are labeled bounded, historical and unrepresentative of the whole market. Raw descriptions, advertiser data and private coordinates were not retained in the acquired training CSV.

## Geography decision

Verified geoBoundaries gbOpen IRN ADM1 geometry represents **province-level administrative boundaries**, source OpenStreetMap/Wambacher, represented year 2017. The simplified file has 32 features while metadata reports 33 units; preserve this discrepancy rather than asserting present-day complete administrative coverage. Municipal city-limit polygons were not verified and are not claimed. Province fills/outlines, province hover labels and represented-city choices are combined with approximate city-center markers. Attribution retains geoBoundaries CC BY 4.0 and upstream OSM/ODbL details.

## Preservation

The existing simple training entry point and its reproducible fixture metrics remain available. Canonical stateless parsing was moved into a dependency-light shared module and reused by both the DataFrame training adapter and remote provider. Tests were retained; browser selectors were updated to the new accessible controls and combined valuation route as those behaviors evolved. Git history was not rewritten. Original source fixture and reference image were not deleted. Full source data and model binaries remain ignored.

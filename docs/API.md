# API v1

Interactive OpenAPI: backend /docs; schema: /openapi.json. Application routes begin /api/v1. The Next proxy exposes only allowlisted application routes. If AMLAAAK_API_TOKEN is configured, send Authorization: Bearer <token> on every backend route except health, including documentation.

| Method | Route | Contract |
| --- | --- | --- |
| GET | /health | Provider, lazy readiness, upstream-check flag, model availability |
| GET | /model/status | Available/unavailable/illustrative/trained status, model hash version, source revision |
| GET | /dashboard/summary | Filtered statistics, source provenance and coverage |
| GET | /analytics/cities | City aggregates with coverage and revision; source headers also cover empty arrays |
| GET | /analytics/distributions | Price/area/year bins, amenities, type counts and bounded scatter points, coverage |
| GET | /properties | Server-side filtering/sort/pagination within retrieved records, provenance/coverage |
| GET | /properties/{id} | Retrieved structured record; HF IDs must still exist in a worker's bounded cache |
| GET | /data/facets?city=... | Retrieved city options and city-dependent neighborhood options, provenance/coverage |
| GET | /model/metrics | Verified model metadata, test metrics, optional validation/split/city metrics |
| POST | /predict | Legacy validated model-only prediction; 503 when unavailable |
| POST | /valuation | Optional ML prediction, ranked comparables, separate medians/comparison, coverage and limitations |

Filters: city, neighborhood, property_type (apartment-sell or house-villa-sell), area_min/max, price_min/max, year_min/max, bedrooms_min/max, and search. Bounds are inclusive; records with missing bounded values are excluded. Search matches city/type/ID only. Invalid/reversed ranges or unexpected fields return 422. The list also accepts page (1-based), page_size (1-100), sort (price_value/price_per_sqm/building_size/city_slug), and order (asc/desc). Sorting is explicitly scoped to retrieved records; total is that retrieved filtered count, not the market-wide count.

Prediction/valuation input example (user specifications, not an invented observed listing):

```json
{
  "city_slug": "tehran",
  "neighborhood_slug": "gholhak",
  "cat3_slug": "apartment-sell",
  "building_size": 90,
  "rooms_count": 2,
  "floor": 2,
  "total_floors_count": 5,
  "construction_year": 1395,
  "has_parking": true,
  "has_elevator": true,
  "has_balcony": false,
  "has_warehouse": false
}
```

Neighborhood is optional and influences comparables, not the current estimator. Area must be >0 and <=10,000; rooms/bedrooms 0-20; floor -5 to 100; total floors 1-100; floor <= total floors; construction year 1200-1500 Solar Hijri. Additional JSON fields/nonfinite values are rejected. These are guardrails, not proof of model training-domain coverage.

Valuation response has model, prediction (nullable), provenance, coverage, comparables [{property, similarity_score, reasons}], comparable_median_price, comparable_median_price_per_sqm, prediction_vs_comparable_percent (nullable), limitations and label. Missing models never produce formula-based substitutes. Upstream outages can return a valid model estimate with zero examined comparable records and an explicit failed-search limitation. No model estimate is substituted for the comparable median.

Property records may include neighborhood_slug, created_at_month, source_identity, source_row_index and source_revision. Legacy fixture responses omit unknown context to preserve compatibility. HF source identities refer to historical dataset rows, not active-ad URLs. No descriptions, private coordinates or advertiser contacts are exposed. No confidence interval is claimed.

Errors use {"error":{"code":"...","message":"..."}} with appropriate status: 401 unauthorized, 404 missing, 422 validation, 503 upstream/model unavailability, or 500 unexpected failure. Normal responses use Cache-Control: no-store and X-Request-ID. Logs include method/path/status/duration, not user specifications or query values. Every price/metric uses original price_value units; currency is unverified. See DATA_PROVIDER.md for exact population and cache semantics, and openapi.json for the generated schemas.

## Prepared provider

All existing routes are preserved. With `AMLAAAK_DATA_MODE=prepared`, summary, city
statistics, distributions and facets use verified precomputed archive aggregates;
property pagination uses sorted global/city indexes. Combined numeric/neighborhood/
text queries require a city, and city partition budgets fail explicitly with 503.
`provenance.provider` is `prepared`. `coverage.source_processing_complete` is optional
and distinguishes verified source processing from archive-query exhaustiveness.
`provenance.input_rows` is original source rows processed; `eligible_rows` is all
available prepared sales; `coverage.eligible_records` is the matching query count.
Zero `records_examined` on precomputed statistics means no listings were loaded in
this request, not an empty archive. Health reports prepared mode and lazy readiness.
Private-data failures never switch to the old prefix/illustrative providers. The
valuation endpoint preserves approved model inference and labels unavailable
comparables separately. See [PREPARED_DATA.md](PREPARED_DATA.md).

### Prepared-release reliability

Prepared catalog loading now validates every global/city/category partition and
sorted-page index total before marking the data ready. Missing indexes return 503
rather than misleading empty pages. Private files use a process-wide four-worker
fetch pool, four download slots, per-file single flight and a bounded serialized
cache. One guarded city/category population is reused for 120 seconds; waiting,
loading and validation share the 25-second construction budget.

`POST /valuation` no longer depends on successful dataset initialization before
running inference. If private configuration/access fails, an available approved
model can still return its estimate with no comparables, zero/non-exhaustive search
coverage and an explicit data-unavailable limitation. Analytics still return 503;
there is no sample/prefix fallback. Model-unavailable valuation can independently
return actual prepared comparables. See the verified-release deployment guide for
exact supported query limits and hosted acceptance.

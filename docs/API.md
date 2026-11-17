# API v1

Base path: `/api/v1`. Interactive OpenAPI: backend `/docs`, schema: `/openapi.json`. When a token is configured, send `Authorization: Bearer <token>` even for documentation. The frontend proxies only the listed application endpoints, not the documentation UI.

| Method | Route | Response |
| --- | --- | --- |
| GET | `/health` | Dataset readiness and model availability; no authentication required |
| GET | `/model/status` | `available`, `mode`, name, hash-based version, explanatory message |
| GET | `/dashboard/summary` | Filtered count, median/mean price, median price/m², city counts, provenance and model status |
| GET | `/analytics/cities` | Filtered city counts, medians and approximate public city centers |
| GET | `/analytics/distributions` | Price/area/year histograms, type counts, amenity known/present percentages and bounded scatter records |
| GET | `/properties` | Server-paginated privacy-conscious property records |
| GET | `/properties/{id}` | Single structured record or 404 |
| GET | `/model/metrics` | Verified artifact scores, split details, features and versions; null scores when unavailable |
| POST | `/predict` | Model estimate, price/m², units, model status and caveats; 503 when unavailable |

Summary, cities, distributions and property list accept optional `city`, `property_type` (`apartment-sell` or `house-villa-sell`), `area_min`, `area_max`, `price_min`, `price_max`, `year_min`, `year_max`, `search`. Bounds are inclusive; year filters exclude missing years. Search matches only city slug, type slug and ID. All filters are combined with AND. Invalid/reversed ranges and unexpected query parameters return 422.

The property list also accepts `page` (starting at 1), `page_size` (1–100, default 10), `sort` (`price_value`, `price_per_sqm`, `building_size`, `city_slug`) and `order` (`asc`/`desc`, default desc). Sort ties use ID for stable pagination. Response: `{items, total, page, page_size}`.

Example prediction JSON (values are form inputs, not a claimed market observation):

```json
{
  "city_slug": "tehran",
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

Area must be >0 and ≤10,000 m²; rooms 0–20, floor -5–100, total floors 1–100, floor ≤ total floors, and Solar Hijri year 1200–1500. Additional JSON fields and nonfinite numbers are rejected. These API bounds intentionally constrain interactive submissions more than the raw-data parsing stage does.

Errors use `{ "error": { "code": "validation_error", "message": "..." } }` with the appropriate HTTP status. Service responses include `X-Request-ID` and `Cache-Control: no-store`. Logs contain method/path/status/duration, not prediction features, query values or advertiser data. No confidence interval is returned. Every price and metric remains in original `price_value` units; currency is unverified. Scatter output is limited to the first 200 eligible records in snapshot order; it is not a statistically representative sample of larger snapshots.

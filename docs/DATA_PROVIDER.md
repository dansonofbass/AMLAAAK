# Hugging Face provider and coverage contract

Official source: https://huggingface.co/datasets/divarofficial/real_estate_ads (Divar; ODbL designation). Dataset Server: https://datasets-server.huggingface.co. Revision verified during implementation: e9446ee97b8e6eb9bd62bdfd7548f1bc8973be85.

## Actual verification, not assumed capabilities

| Endpoint | Actual result | Application role |
| --- | --- | --- |
| Hub /api/datasets/divarofficial/real_estate_ads | 200, revision/card license/file metadata | Source audit; not repeatedly fetched by the browser |
| /splits | 200; default/train; revision header | Lazy split discovery |
| /rows | 200; 100-row page maximum, total 1,000,000 | Working bounded runtime retrieval and explicit offline acquisition |
| /filter | Repeated HTTP 500 authentication-check errors/timeouts | Capability-probed; not claimed successful in this session |
| /parquet | 200; two files discovered | Format/availability verification only; no Parquet download |

Actual `/filter` probes included city, residential category, city plus neighborhood, positive numeric predicates and orderby. Official docs describe filtering/sorting, but service failure means those operations cannot be presented as verified live support. The provider retries capability checks after a five-minute cooldown. If a later call succeeds, the response identifies the filtered prefix and marks remote_filter_supported true. Remote sorting remains disabled: local sorting is reliable only within the retrieved population and never described as a global market ordering.

## Runtime bounds

Default HF_MAX_RECORDS=300, clamped to 100-2,000. A first 100-row page establishes source revision and reported row count; remaining bounded pages run with three workers. Revision changes across pages fail the query. Successful normalized populations are cached per worker for 120 seconds, with eight entries and a single-flight lock. This is a bounded in-memory cache, not another database service. No complete dataset download occurs at startup, Next/Vercel builds, or valuation requests.

Each upstream request has a four-second timeout (two-second connection budget), at most two attempts for connection errors or 429/500/502/503/504, and bounded backoff. Long 429 Retry-After values fail with an explicit wait/retry message instead of retrying prematurely or blocking a function for minutes. Short retry windows are honored. A page over 8 MB is rejected. Failed filter capability checks fall back only to genuine /rows data; failed row retrieval produces an explicit error, not invented observations or an automatic demo substitution.

HF_TOKEN is optional and backend-only. Request parameters use fixed endpoint/column allowlists; SQL-style string values are correctly quoted. No browser code receives Hugging Face credentials, backend origin secrets or model repository credentials.

## Shared normalization

apps/api/service/normalization.py is the canonical dependency-light parser, reused by amlaaak/preprocessing.py for offline training. It converts Persian and Arabic digits, supported Persian room words, strict decimal/thousands notation, booleans and Solar Hijri construction years. Ambiguous ranges, censored years and unknown amenities remain missing. Eligibility requires residential-sell, apartment-sell or house-villa-sell, fixed price mode, finite positive price and building size. Rentals, commercial/land categories, invalid targets and invalid area are excluded. No target imputation occurs.

Only genuine numeric source columns (area/price) are used in optional remote numeric comparisons. Room and year source columns contain text; bedroom/year bounds are applied after normalization rather than assuming numeric ordering on Persian strings. Neighborhood/city/type filters are sent remotely when capability is available and always reapplied locally. Otherwise every filter is explicitly limited to the retrieved unfiltered prefix.

Stored/served property records exclude descriptions, titles, advertiser details and precise coordinates. A source identity uses dataset + revision + config/split + row index. It identifies a dataset record, not a verified original advertisement URL. No current listing activity or photograph is invented.

## Coverage fields

Coverage includes records_examined, normalized_records, eligible_records after active filters, upstream_matching_rows, exhaustive, bounded, sampled, statistics_full_population, remote_filter_supported, remote_sort_supported, sorting_scope, method and limitations. Provenance includes dataset revision, provider, retrieval timestamp and observed source period. The runtime has no source-file hash because it has not fetched the full source file; source_sha256 is null. Explicit acquired training subsets have their own computed file hash.

A prefix is bounded, not a random statistical sample. With /rows fallback, upstream_matching_rows refers to the unfiltered split, not the city population. Exhaustive is true only if every reported candidate row was actually examined and the upstream index is not partial. Statistics_full_population never becomes true merely because /rows reports partial=false. Local snapshots are exhaustive only within that configured snapshot, not the Divar market.

Summary, distribution, property-page, facet and valuation responses carry coverage. City aggregate objects carry it too; headers expose revision, rows examined and exhaustive status even for an empty city array. Source periods describe retrieved historical records; fetched_at is retrieval time, not advertisement freshness. Unknown/unmapped cities remain available in lists but do not receive invented map coordinates.

## Comparables

Candidate retrieval requires the same city and residential sale category. Scores weight area 30, bedrooms 15, construction year 10, floor 5, each known amenity 5, neighborhood 20 when requested, and advertisement period 5 when available. The period reference is the latest retrieved candidate month, not today's housing market. Missing attributes get no match contribution; scores are normalized over the active weights and are not probabilities. Price is excluded from ranking to avoid circularly selecting advertisements around the model estimate.

Up to eight candidates are returned, with deterministic ID tie-breaking and per-record reasons. The median uses only those returned comparables. The label is always 'Best matching properties among retrieved historical records.' There is no globally-nearest claim. Model output and comparable medians stay separate. A model can be unavailable while comparables work, or remain available when comparable retrieval is down; both cases have explicit metadata.

## Known limits

The working runtime currently cannot query an arbitrary whole-city population because /filter failed during verification. City/neighborhood options and summaries reflect the bounded window only. Prefix retrieval may be strongly biased; inflation, location granularity, duplicates and source outliers remain important. Broader coverage requires explicit offline preparation or a deliberately larger, still bounded remote strategy; no external database is required or proposed. The source card's column-count/period descriptions remain inconsistent with the viewer and observed rows. Asking prices are not completed-sale prices and currency units have not been independently established.

## Prepared archive alternative

The default prefix provider described below is preserved for rollback. After a full
Colab preparation and approved upload, `AMLAAAK_DATA_MODE=prepared` selects the private,
manifest-pinned indexed archive. It bypasses Dataset Server `/rows` entirely. No actual
full-source run, private upload or hosted prepared deployment has been performed by
the agent. Follow [the beginner guide](PREPARED_DATA_QUICKSTART.md) and
[technical format/query limits](PREPARED_DATA.md). The approved model stays unchanged.

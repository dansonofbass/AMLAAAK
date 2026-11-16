# AMLAAAK — Real Estate Price Prediction

AMLAAAK is a local Python prototype for estimating residential asking prices from structured property listings. It validates locally supplied Divar-format CSV data, optionally imports it into SQLite, and evaluates a RandomForestRegressor against a median-price baseline. It saves fitted preprocessing/model pipelines and run metadata. There is no deployed service or user interface.

## Status and scope

This is a portfolio ML prototype, not a production valuation system. The included **10 illustrative records are not verified Divar observations**. They demonstrate file formats and execution only. Eight are sales and two are rentals; training excludes the rentals. No full-dataset experiment or real-world accuracy claim is made.

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

Python, pandas, NumPy, scikit-learn, joblib, standard-library SQLite, and pytest. Flask, plotting libraries, and calendar conversion dependencies are unnecessary and have been removed.

```text
amlaaak/
  data.py              CSV validation, loading, SQLite ingestion CLI
  preprocessing.py     Stateless parsing, filtering, feature definitions
  training.py          Pipelines, evaluation, persistence, training CLI
model_training.py      Compatibility training entry point
Schema.sql             60-column raw TEXT staging schema
sample database.csv    Repaired 10-row illustrative fixture
requirements.txt       Pinned direct runtime dependencies
requirements-dev.txt   Runtime dependencies plus pytest
requirements-lock.txt  Complete tested Windows/Python 3.14 environment
tests/test_pipeline.py Parsing, ingestion, leakage boundaries, training tests
docs/AUDIT.md          Audit findings and history decisions
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

These numbers verify execution only and cannot demonstrate generalization. The CSV and SQLite smoke routes produce the same metrics. Automated tests verify repeated-run reproducibility and model reload. No full Divar dataset has been downloaded or evaluated.

## Model outputs

Each output directory contains:

- `model.joblib`: fitted forest pipeline, including imputation and one-hot encoding.
- `baseline.joblib`: fitted median-baseline pipeline.
- `metadata.json`: source path/SHA-256, row counts, seed, split size, input/transformed features, estimator parameters, package versions, unit caveat, and metrics.

For programmatic inference, call `prepare` on Divar-format labeled records, select `FEATURES`, then call the loaded pipeline's `predict`. The saved pipeline expects normalized feature frames; it does not include raw parsing. There is currently no dedicated inference CLI or unlabeled-record ingestion contract. Only load trusted joblib files and use matching package versions. The saved forest remains fitted on the training partition used for evaluation; it is not subsequently refitted on all rows.

## Limitations, roadmap, and responsible use

Asking prices are not completed-sale prices. Small or unrepresentative samples, duplicates beyond exact matches, geographic differences, inflation, and stale listings can distort results. Random holdouts do not establish performance on future dates or unseen neighborhoods. Solar Hijri construction years are retained directly; censored years lose information. Amenities are simplified and median imputation is only a baseline choice.

Next steps are a documented full-data experiment, temporal/geographic validation, duplicate/property grouping, stronger source-unit verification, better censored-year handling, and uncertainty/subgroup analysis. Evaluate these before adding model complexity or a serving interface. Do not use this prototype as the sole basis for lending, investment, or housing decisions. Avoid republishing listing text or attempting to identify advertisers.

## Development history

The original two commits and their authors/dates are preserved. New work uses Conventional Commits. See [the audit](docs/AUDIT.md) for findings and why published history was not rewritten.

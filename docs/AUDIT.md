# Repository audit — 2026-11-17

## Original state

Every tracked project file was inspected: `.gitattributes`, `LICENSE`, `README.md`, `Schema.sql`, `model_training.py`, `requirements.txt`, and `sample database.csv`. The working tree was clean. Only local `main` and cached `origin/main` were present, both at `a4f811c653570350b456fd100056ad172f4e31a0`. Origin fetch/push URL: `https://github.com/dansonofbass/AMLAAAK.git`.

The two original commits are:

- `6be1817` — Initial commit (SonofBass, 2025-05-05 15:47:01 +0330).
- `a4f811c` — project files (SonofBass, 2025-05-05 15:48:32 +0330).

Both original author and committer identities/dates remain untouched. Local backup branch `backup/original-2026-11-17` points to the original tip. No historical content or timestamps were invented. Current Git author configuration is used for new work.

## Findings and fixes

| Original issue | Resolution |
| --- | --- |
| README contained only a title and note | Documented actual capabilities, reproducibility, data, licensing, limitations |
| Unused CSV path; hardcoded nonexistent SQLite database | Explicit CSV or SQLite inputs and local ingestion command |
| Sample entire records quoted as one field, including a BOM | Repaired ordinary UTF-8 CSV quoting; retained all 10 rows and original numeric values |
| Sample category names did not match source | Mapped illustrative apartment/villa sale/rent categories to residential Divar slugs; fixed-price mode assigned only to sales |
| Raw textual fields declared INTEGER in SQLite | Staging schema uses TEXT, with parsing in Python |
| Only non-null price filter; no sale eligibility | Residential apartment/house-villa fixed-price sales only, positive finite target and area |
| Numeric extraction concatenated digits, corrupting decimals/ranges | Strict numeric parsing, Persian/Arabic digit translation, explicit word mapping |
| Censored construction year assigned an invented exact year | Treat censored/unrecognized years as missing; retain numeric Solar Hijri years |
| Missing amenities assumed false | Missing values retained, imputed in fitted pipeline with indicators |
| Whole-data median imputation before split | Fit all learned preprocessing only on training partition |
| Four amenities omitted by ColumnTransformer | Explicitly include parking, elevator, balcony, warehouse |
| No simple comparison, MAE or reproducibility metadata | Median baseline, MAE/RMSE/R², seeded holdout and saved metadata |
| No test suite or artifact ignores | Parsing/ingestion/pipeline/training tests, generated files ignored |
| Unused Flask/plotting/calendar dependencies | Minimal pinned runtime requirements plus complete tested dependency lock |

SQLite ingestion does not automatically download data or overwrite an existing database. CSV structure is checked before ingestion; SQL insert values are parameterized. All generated models, databases and environments are ignored. Training is in memory, not an out-of-core full-dataset implementation.

## Dataset verification

Sources: [official card](https://huggingface.co/datasets/divarofficial/real_estate_ads/blob/main/README.md), [viewer](https://huggingface.co/datasets/divarofficial/real_estate_ads), and [files](https://huggingface.co/datasets/divarofficial/real_estate_ads/tree/main). The README records licensing, observed formats and upstream inconsistencies. No dataset binary was downloaded. The fixture is illustrative; its amounts are not verified market observations. Price currency was not independently established.

## Remote checks and history decision

Local Git history, branches, remotes and status were inspected. Live `git ls-remote --heads origin` failed with `SEC_E_NO_CREDENTIALS`; GitHub REST requests for contributors, collaborators, main branch metadata, rulesets and branch protection failed with connection errors. Web access verified the dataset documentation, but GitHub API web access also failed. Consequently remote freshness, collaborator access and protection settings could not be established. Cached tracking refs are not proof of current remote state.

Published history was left unchanged. No push was attempted. New commits are additive. The original short titles could be clarified in a future coordinated rewrite, but such a rewrite is unnecessary for this implementation.

If a future rewrite is desired, first restore authenticated GitHub access, inspect the repository's collaborators and branch/ruleset protection settings, coordinate with contributors, and ensure a clean working tree. Then:

```powershell
git fetch origin
git status --short
git branch -avv
git log --format=fuller --all
git branch backup/before-reword main
git rebase -i --root
```

In the interactive todo list, change only the first two `pick` entries to `reword`. Use `chore: initialize AMLAAAK repository` and `feat: introduce real estate regression pipeline and database schema` respectively. Leave all other entries as `pick`. Rebase preserves original authorship and author dates; rewritten committer dates will naturally be current. Do not set artificial timestamp environment variables. Inspect `git log --format=fuller` and compare final trees before considering publication. Abort with `git rebase --abort` if review fails. **Obtain explicit user confirmation before any force-with-lease push**; no push command has been executed or preauthorized here.

## Validation

Tested on Windows with Python 3.14.7. `python -m pytest -q`: 24 passed. `python -m pip check`: no broken requirements. CSV and SQLite training routes and both command help screens executed successfully. Forest and baseline metrics agree across input formats; sample counts are 10 raw / 8 distinct eligible / 6 train / 2 test. Full dependency versions are in `requirements-lock.txt`; run-specific model metadata remains ignored under `artifacts/`.

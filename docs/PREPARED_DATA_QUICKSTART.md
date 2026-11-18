# Connect the complete prepared archive

The archive has now been prepared and uploaded by the user. Authenticated inventory,
manifest/hash and local real API/browser verification passed for release
`8cc2a942d6d5d4b7cfa22e09a39d0223ff24019a` (420,813 sales, 417 cities).
**Production has not been switched by the agent.** Model `267eff7c36f3` is unchanged.

**You do not need to rerun Colab or upload again.** Start with
[the exact verified-release Vercel instructions](PREPARED_RELEASE_DEPLOYMENT.md).
The steps below remain for future rebuilding/preparation; current deployment can
start at step 5, using the verified release values in step 6.

## 1. Open the notebook

The file already exists:

`C:\Users\EliteBook\Desktop\AMLAAAK\notebooks\prepare_divar_dataset.ipynb`

Go to [Google Colab](https://colab.research.google.com/). Click **File → Upload notebook**
(or **Upload** in the opening dialog), then **Choose file**. Select the file above.
This uploads the small notebook only, not the Divar dataset. You do not need to edit
your existing Drive notebook or copy any code.

## 2. Run it

Click **Connect** if shown, then **Runtime → Run all**. A standard CPU runtime is
enough; no GPU is needed. Approve execution of the notebook you reviewed. Keep the tab
connected. The notebook checks Colab resources, verifies the pinned source inventory
and license, downloads the source into **Colab**, streams all rows, and validates
the prepared files. Processing and remote verification can take time. A disconnected
or failed run is not a successful full preparation; restart with a fresh runtime if needed.

## 3. Approve only the final upload

Wait for **UPLOAD PREPARED DATASET TO HUGGING FACE**. Review the processed/eligible row
counts, city count, file size and attribution card. All validation must have passed.

Enter `I ACCEPT ODbL 1.0` after reviewing the license. Then enter
`UPLOAD PREPARED DATASET` to approve the upload. Pressing Enter without those exact
answers stops without uploading. The target must remain the existing **private**
`thevel0per/AMLAAAK-Real-Estate-Data` dataset. Prepared paths and its attribution
README are updated; no remote files are deleted and no model is changed.

Use a Hugging Face token with **write access to this dataset**. Store it as `HF_TOKEN`
in Colab's **Secrets** (key icon) and grant this notebook access, or enter it in the
hidden token prompt. Never paste it into a code cell or send it to anyone.

## 4. Find the verified SHA and hash

After upload, the notebook reads back and verifies **every uploaded file** at the
immutable commit. Only then does it print **VERIFIED UPLOAD — COPY THESE VALUES**:

```text
DATASET_REPO
DATASET_REVISION
DATASET_MANIFEST_SHA256
TOTAL_SOURCE_ROWS
TOTAL_PREPARED_ROWS
TOTAL_CITIES
```

Use the actual values from your run. Do not substitute the model revision/hash or
invent missing values. If verification fails after an upload, do not switch Vercel;
inspect the error and repeat verification/preparation in Colab.

## 5. Push the reviewed code

After a successful preparation/upload, review and push the local commits to GitHub
when you are ready. This is a manual action; the agent has not pushed or deployed.
Pushing may trigger your existing Vercel Git integration. Without the prepared-mode
environment settings, the backend still defaults to the original `huggingface` provider.

## 6. Set these variables in the BACKEND project

In Vercel, open the project serving **https://amlaaak.vercel.app**, whose Root Directory
is **apps/api**. Go to **Settings → Environment Variables**. Prefer a Preview rollout
first; choose the environment you intend to deploy. Add:

| Name | Value |
| --- | --- |
| `AMLAAAK_DATA_MODE` | `prepared` |
| `AMLAAAK_PREPARED_DATA_REPO` | `thevel0per/AMLAAAK-Real-Estate-Data` |
| `AMLAAAK_PREPARED_DATA_REVISION` | `8cc2a942d6d5d4b7cfa22e09a39d0223ff24019a` |
| `AMLAAAK_PREPARED_DATA_MANIFEST_SHA256` | `3f4dff6cd149c10c579371a8d33a151b64c72e11fa9aed00b132892198d72048` |
| `HF_TOKEN` | A separate Hugging Face **read-only** token for this private dataset |

Keep the approved `AMLAAAK_MODEL_REPO`, `AMLAAAK_MODEL_REVISION`, and
`AMLAAAK_MODEL_MANIFEST_SHA256` exactly as they are. Keep any existing API authentication
token. Remove stale `AMLAAAK_SNAPSHOT`; keep `AMLAAAK_MODEL_DIR` unset for remote model
loading. `HF_MAX_RECORDS` is ignored in prepared mode.

Save and **redeploy the backend** so the variables take effect. Use the verified SHA
and hash as a pair. Never put `HF_TOKEN` in the frontend, browser, repository, or any
`NEXT_PUBLIC_` variable. Dataset variables are not hardcoded into `vercel.json`.

## 7. Keep the FRONTEND connection

The project serving **https://amlaaak-webbapp.vercel.app** has Root Directory
**apps/web**. Keep its server-only `API_BASE_URL=https://amlaaak.vercel.app` and any
matching `API_TOKEN`. No dataset token belongs here. Deploy the reviewed frontend
code so it displays prepared archive coverage correctly.

For Preview testing, point the Preview frontend's `API_BASE_URL` at the Preview
backend; ensure Vercel Deployment Protection permits server-to-server access. Do not
point a Preview frontend at Production and mistake that for testing the new provider.

## 8. Test the real website

1. Open [backend health](https://amlaaak.vercel.app/api/v1/health). Expect
   `provider: "prepared"` and `model_available: true`. Dataset readiness can initially
   be false until a successful lazy request; health alone does not prove data access.
2. Open [the website](https://amlaaak-webbapp.vercel.app). Expect **Prepared historical
   Divar archive** and an available-sales count equal to **TOTAL_PREPARED_ROWS**.
   It must not still show the old 300-row retrieval label.
3. Select a city, then a neighborhood. Try price/area filters and property pagination.
   Global statistics use the complete prepared archive; select a city before combined
   numeric or text searches. Oversized city queries ask you to narrow category or
   neighborhood instead of silently truncating results.
4. Open **Predict**, select a represented city/neighborhood, and estimate. Check a real
   model estimate and historical comparable cards. The model remains **267eff7c36f3**.
5. If an error appears, inspect the backend Vercel function logs. A private-token error,
   missing file, bad hash, or query budget failure must not be treated as successful
   data integration. No fake records are substituted.

## 9. Roll back if necessary

In the **backend** project, set `AMLAAAK_DATA_MODE=huggingface` and redeploy. Leave the
model variables and frontend `API_BASE_URL` unchanged. The original bounded provider
returns; its coverage warning is expected. The private archive stays stored on Hugging
Face. Do not delete it or change repository visibility to fix an access error.

See [the technical preparation/provider design](PREPARED_DATA.md) for limits and tests.

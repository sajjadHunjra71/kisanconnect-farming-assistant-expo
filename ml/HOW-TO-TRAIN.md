# How to train the leaf model (Kaggle, free)

You only need a browser. Training takes about **30–60 minutes** on Kaggle's free GPU.
Nothing is uploaded to Kaggle except the notebook; the notebook downloads the datasets itself.

## One-time: Kaggle account

1. Go to **kaggle.com** and sign in (Google sign-in is fine).
2. Click your **profile picture (top right) → Settings**.
3. Under **Phone verification**, verify your phone number.
   *Without this, Kaggle won't give you a GPU or internet in notebooks.*

## Train

1. Download the notebook: on GitHub open `ml/train.ipynb` → **Download raw file** (or use the file from your laptop's copy of the repo).
2. On Kaggle click **Create (+ button, top left) → New Notebook**.
3. In the notebook menu: **File → Import Notebook** → choose `train.ipynb` → **Import**.
4. On the right side open **Session options** (or the **⋮ → Accelerator** menu):
   - **Accelerator:** `GPU T4 x2` (or `GPU P100`).
   - **Internet:** **On** (the switch is under Session options; it needs the phone verification above).
5. Click **Run All** (the ▶▶ button at the top).
6. Watch the first cells:
   - Cell 3 prints `OK` or `SKIP` for each dataset. A few `SKIP`s are fine: they're listed in the report.
   - Cell 6 prints how many images each class has.
7. Wait for the last cell to print `Done → …/kisanconnect_model.zip`.

## Get the result

- Right panel → **Output** (or the folder icon) → `/kaggle/working/out/` → click **⋮ → Download** on `kisanconnect_model.zip`.
- To keep the result even after the session ends: top right **Save Version → Save & Run All (Commit)**; outputs then stay on the notebook's **Output** tab.

The zip has:

| File | What it is |
|---|---|
| `leaf_model_int8.tflite` | The phone model (Phase 4E puts it in the app) |
| `leaf_model.onnx` | Same model in another format (backup / other runtimes) |
| `labels.json` | Classes, crop per class, model version, confidence threshold |
| `REPORT.md` | Accuracy per class and per dataset, confusion matrix, warnings |

Send the zip (or just `REPORT.md` first) back here and we'll check the numbers before putting the model in the app.

## Same thing on Google Colab

1. Go to **colab.research.google.com → File → Upload notebook** → `train.ipynb`.
2. **Runtime → Change runtime type → T4 GPU → Save**.
3. **Runtime → Run all**.
4. When it finishes: left side **Files (folder icon) → content → out** → right-click `kisanconnect_model.zip` → **Download**.

## Good to know

- **Free limits:** Kaggle gives about 30 GPU hours a week; one run uses about one hour. Colab's free GPU can disconnect after some time; just run again.
- **Licences:** all datasets are CC BY 4.0 (checked 2026-11-23). The notebook checks the licence again before downloading and skips a dataset if it changed.
- **Don't commit images** or the model zip to GitHub; the repo only keeps the notebook and the dataset list.
- **Read `REPORT.md` warnings**, especially "source can be guessed from the image" (the model may be learning backgrounds) and classes "not split by source" (their test score is too optimistic).

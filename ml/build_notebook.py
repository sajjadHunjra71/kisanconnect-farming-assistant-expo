"""Builds ml/train.ipynb from the cells below, embedding ml/datasets.json so the
notebook is self-contained on Kaggle / Colab.  Run:  python3 ml/build_notebook.py
(re-run after editing datasets.json or this file)."""
import json
from pathlib import Path

HERE = Path(__file__).parent
DATASETS = json.loads((HERE / "datasets.json").read_text())

cells = []


def md(text):
    cells.append({"cell_type": "markdown", "metadata": {}, "source": text.strip("\n").splitlines(True)})


def code(text):
    cells.append({"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": text.strip("\n").splitlines(True)})


md("""
# KisanConnect · leaf disease model (on-device)

Trains a small image classifier for the app's leaf scan and exports it for phones.

* **Runs on:** Kaggle (free GPU, phone-verified account, Internet ON) or Google Colab (free GPU).
* **Downloads** every dataset listed in `DATASETS.md` at run time (nothing is stored in the repo). A source that fails is skipped and reported.
* **Outputs** (in `/kaggle/working/out` or `/content/out`): `leaf_model_int8.tflite`, `leaf_model.onnx`, `labels.json`, `REPORT.md`, `kisanconnect_model.zip`.

Steps: setup → download → collect + clean + dedupe → "unclear" class → split by source → source-bias check → train → threshold + test report → export.
See `ml/HOW-TO-TRAIN.md` for click-by-click instructions.
""")

code("""
# 1. Setup
import os, sys, subprocess
IN_KAGGLE = os.path.exists('/kaggle')
WORK = '/kaggle/working' if IN_KAGGLE else '/content'
subprocess.run('pip -q install py7zr rarfile imagehash fiftyone tf2onnx onnx', shell=True, check=False)
subprocess.run('apt-get -qq install -y unrar p7zip-full > /dev/null 2>&1', shell=True, check=False)

import json, re, random, shutil, zipfile, hashlib, time, datetime
from pathlib import Path
import numpy as np
import tensorflow as tf
from PIL import Image, ImageFilter, ImageEnhance
import imagehash, requests

SEED = 42
random.seed(SEED); np.random.seed(SEED); tf.random.set_seed(SEED)
IMG = 224
RAW = Path(WORK) / 'raw'; DATA = Path(WORK) / 'data'; OUT = Path(WORK) / 'out'
for p in (RAW, DATA, OUT): p.mkdir(parents=True, exist_ok=True)
print('TensorFlow', tf.__version__, '| GPU:', tf.config.list_physical_devices('GPU'))
""")

code("# 2. Dataset list (copied from ml/datasets.json by build_notebook.py)\nDATASETS = json.loads(r'''" + json.dumps(DATASETS, indent=1) + "''')\n"
     "MODEL_CLASSES = ['wheat-yellow-rust','wheat-brown-rust','wheat-septoria','wheat-healthy',\n"
     "                 'rice-blast','rice-brown-spot','rice-bacterial-leaf-blight','rice-healthy',\n"
     "                 'cotton-leaf-curl-virus','cotton-bacterial-blight','cotton-leaf-spot','cotton-healthy','unclear']\n"
     "CROP_OF = {c: (c.split('-')[0] if c != 'unclear' else None) for c in MODEL_CLASSES}\n"
     "print(len(DATASETS['datasets']), 'datasets,', len(MODEL_CLASSES), 'classes')\n")

code("""
# 3. Download from Mendeley Data (public API). Failures are skipped and reported.
REPORT_NOTES = []

def safe_names(names, dest):
    # Refuse archives with absolute paths or '..' that would write outside dest.
    root = dest.resolve()
    for n in names:
        target = (dest / n).resolve()
        if not (target == root or root in target.parents):
            raise ValueError(f'unsafe path in archive: {n!r}')

def extract(path, dest):
    dest.mkdir(parents=True, exist_ok=True)
    name = path.name.lower()
    if name.endswith('.zip'):
        with zipfile.ZipFile(path) as z:
            safe_names(z.namelist(), dest); z.extractall(dest)
    elif name.endswith('.rar'):
        import rarfile
        with rarfile.RarFile(path) as z:
            safe_names(z.namelist(), dest); z.extractall(dest)
    elif name.endswith('.7z'):
        import py7zr
        with py7zr.SevenZipFile(path) as z:
            safe_names(z.getnames(), dest); z.extractall(dest)
    else:
        return False
    return True

downloaded = {}
for ds in DATASETS['datasets']:
    key = ds['key']
    try:
        meta = requests.get(f"https://data.mendeley.com/public-api/datasets/{ds['mendeley_id']}", timeout=60).json()
        lic = (meta.get('data_licence') or {}).get('short_name')
        if lic != ds['licence']:
            raise RuntimeError(f'licence changed: {lic!r} (expected {ds["licence"]!r}) — skipped')
        files = meta.get('files') or []
        if ds.get('only_files'):
            files = [f for f in files if f.get('filename') in ds['only_files']]
        target = RAW / key
        for f in files:
            url = (f.get('content_details') or {}).get('download_url')
            if not url: continue
            local = target / f['filename']
            local.parent.mkdir(parents=True, exist_ok=True)
            if not local.exists():
                with requests.get(url, stream=True, timeout=600) as r:
                    r.raise_for_status()
                    with open(local, 'wb') as fh:
                        for chunk in r.iter_content(1 << 20): fh.write(chunk)
            extract(local, target / 'x')
        downloaded[key] = target / 'x'
        print('OK  ', key)
    except Exception as e:
        REPORT_NOTES.append(f'- Skipped `{key}`: {e}')
        print('SKIP', key, '→', e)
""")

code("""
# 4. Collect images: map folder names to our classes with the regexes in DATASETS.
EXTS = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
records, unmatched = [], {}
for ds in DATASETS['datasets']:
    root = downloaded.get(ds['key'])
    if not root: continue
    rules = [(cls, re.compile(rx, re.I)) for cls, rx in ds['classes'].items()]
    for p in root.rglob('*'):
        if p.suffix.lower() not in EXTS: continue
        parts = [q.name for q in p.relative_to(root).parents][:-1] or ['.']
        hits = {cls for cls, rx in rules for part in parts if rx.search(part)}
        if len(hits) == 1:
            session = '/'.join(p.relative_to(root).parts[:-1]) or '.'
            records.append({'path': str(p), 'cls': hits.pop(), 'source': ds['key'], 'session': session})
        else:
            unmatched.setdefault(ds['key'], set()).add('/'.join(p.relative_to(root).parts[:-1]))
for k, v in unmatched.items():
    REPORT_NOTES.append(f'- `{k}`: folders not used (no or several class matches): ' + ', '.join(sorted(v)[:8]) + (' …' if len(v) > 8 else ''))
print(len(records), 'images matched')
""")

code("""
# 5. Clean (unreadable / tiny) and de-duplicate (perceptual hash) across ALL sources.
clean, seen, dups, cross = [], {}, 0, 0
for r in records:
    try:
        with Image.open(r['path']) as im:
            im = im.convert('RGB')
            if min(im.size) < 64: continue
            h = str(imagehash.phash(im))
    except Exception:
        continue
    if h in seen:
        dups += 1
        if seen[h]['source'] != r['source']: cross += 1
        continue
    seen[h] = r; clean.append(r)
records = clean
REPORT_NOTES.append(f'- Removed {dups} duplicate images ({cross} were duplicates across different datasets).')
print(len(records), 'after cleaning;', dups, 'duplicates removed')
""")

code("""
# 6. 'unclear' class: degraded copies of leaf images + non-leaf photos from Open Images V7.
UNCLEAR_DIR = DATA / 'unclear'; UNCLEAR_DIR.mkdir(exist_ok=True)
def degrade(src, dst, kind):
    im = Image.open(src).convert('RGB')
    if kind == 'blur': im = im.filter(ImageFilter.GaussianBlur(radius=random.uniform(6, 12)))
    elif kind == 'dark': im = ImageEnhance.Brightness(im).enhance(random.uniform(0.05, 0.2))
    elif kind == 'crop':
        w, h = im.size; s = random.uniform(0.08, 0.15)
        x, y = random.randint(0, int(w * (1 - s))), random.randint(0, int(h * (1 - s)))
        im = im.crop((x, y, x + int(w * s), y + int(h * s)))
    im.save(dst, quality=85)
leafy = [r for r in records]
for i, r in enumerate(random.sample(leafy, min(1200, len(leafy)))):
    kind = ['blur', 'dark', 'crop'][i % 3]
    dst = UNCLEAR_DIR / f'{kind}_{i}.jpg'; degrade(r['path'], dst, kind)
    records.append({'path': str(dst), 'cls': 'unclear', 'source': r['source'], 'session': 'degraded'})
try:
    import fiftyone.zoo as foz
    oi = foz.load_zoo_dataset('open-images-v7', split='validation', label_types=['classifications'],
                              classes=DATASETS['unclear']['open_images_classes'],
                              max_samples=DATASETS['unclear']['open_images_max'], seed=SEED, shuffle=True)
    for s in oi:
        records.append({'path': s.filepath, 'cls': 'unclear', 'source': 'open-images', 'session': 'open-images'})
except Exception as e:
    REPORT_NOTES.append(f'- Open Images download failed ({e}); unclear uses degraded leaf images only.')
from collections import Counter
print(Counter(r['cls'] for r in records))
""")

code("""
# 7. Split: by SOURCE when a class has ≥ 2 sources (honest test on unseen datasets),
#    otherwise by capture session / folder (flagged in the report).
from collections import defaultdict
split_of, flagged = {}, []
by_cls = defaultdict(list)
for i, r in enumerate(records): by_cls[r['cls']].append(i)
for cls, idx in by_cls.items():
    groups_key = 'source' if len({records[i]['source'] for i in idx}) >= 2 else 'session'
    if groups_key == 'session': flagged.append(cls)
    groups = defaultdict(list)
    for i in idx: groups[records[i][groups_key]].append(i)
    order = sorted(groups, key=lambda g: -len(groups[g]))
    total, acc = len(idx), {'train': 0, 'val': 0, 'test': 0}
    goal = {'test': 0.15 * total, 'val': 0.15 * total}
    for g in order:
        # largest groups to train; fill test then val with the rest
        tgt = 'train'
        if acc['test'] < goal['test'] and g != order[0]: tgt = 'test'
        elif acc['val'] < goal['val'] and g != order[0]: tgt = 'val'
        for i in groups[g]: split_of[i] = tgt
        acc[tgt] += len(groups[g])
    if len(groups) < 3:  # too few groups: fall back to a random 70/15/15 inside them, flagged
        flagged.append(cls + ' (random split: < 3 groups)')
        random.shuffle(idx)
        for j, i in enumerate(idx): split_of[i] = 'train' if j < 0.7 * total else 'val' if j < 0.85 * total else 'test'
for i, r in enumerate(records): r['split'] = split_of[i]
for s in ('train', 'val', 'test'): print(s, sum(r['split'] == s for r in records))
if flagged: REPORT_NOTES.append('- Not split by source (one source only): ' + ', '.join(sorted(set(flagged))))
""")

code("""
# 8. Data pipeline + augmentation (sun, blur, angle, partial leaf).
CLASS_INDEX = {c: i for i, c in enumerate(MODEL_CLASSES)}
def load(path, label):
    img = tf.io.decode_image(tf.io.read_file(path), channels=3, expand_animations=False)
    img = tf.image.resize(img, (IMG, IMG))
    return img, label
aug = tf.keras.Sequential([
    tf.keras.layers.RandomFlip('horizontal_and_vertical'),
    tf.keras.layers.RandomRotation(0.2),             # angle
    tf.keras.layers.RandomZoom((-0.1, 0.35)),        # partial leaf
    tf.keras.layers.RandomBrightness(0.35),          # sun / shade
    tf.keras.layers.RandomContrast(0.3),
], name='augment')
def blur(img, label):
    k = tf.random.uniform([], 0, 3, dtype=tf.int32)
    img = tf.cond(k == 0, lambda: tf.nn.avg_pool2d(img[None], 3, 1, 'SAME')[0], lambda: img)
    return img, label
def ds(split, training):
    rs = [r for r in records if r['split'] == split]
    d = tf.data.Dataset.from_tensor_slices(([r['path'] for r in rs], [CLASS_INDEX[r['cls']] for r in rs]))
    if training: d = d.shuffle(len(rs), seed=SEED)
    d = d.map(load, num_parallel_calls=tf.data.AUTOTUNE)
    if training: d = d.map(lambda x, y: (aug(x, training=True), y)).map(blur)
    return d.batch(32).prefetch(tf.data.AUTOTUNE), rs
train_ds, train_rs = ds('train', True); val_ds, val_rs = ds('val', False); test_ds, test_rs = ds('test', False)
counts = Counter(r['cls'] for r in train_rs)
class_weight = {CLASS_INDEX[c]: len(train_rs) / (len(MODEL_CLASSES) * max(1, counts.get(c, 0))) for c in MODEL_CLASSES}
""")

code("""
# 9. Source-bias check: can the DATASET be guessed from the picture? (within one class)
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
feat = tf.keras.applications.MobileNetV3Small(include_top=False, pooling='avg', input_shape=(IMG, IMG, 3), weights='imagenet')
warn = []
for cls in MODEL_CLASSES:
    rs = [r for r in records if r['cls'] == cls and r['split'] == 'train']
    if len({r['source'] for r in rs}) < 2: continue
    rs = random.sample(rs, min(300, len(rs)))
    X = feat.predict(tf.stack([load(r['path'], 0)[0] for r in rs]), verbose=0)
    y = [r['source'] for r in rs]
    acc = cross_val_score(LogisticRegression(max_iter=2000), X, y, cv=3).mean()
    if acc > 0.9: warn.append(f'{cls} ({acc:.0%})')
if warn: REPORT_NOTES.append('- ⚠️ Source can be guessed from the image for: ' + ', '.join(warn) + '. The model may learn backgrounds, not disease; trust the per-source test numbers.')
""")

code("""
# 10. Transfer learning: MobileNetV3-Small (ImageNet), head first, then fine-tune.
base = tf.keras.applications.MobileNetV3Small(include_top=False, input_shape=(IMG, IMG, 3), weights='imagenet', include_preprocessing=True)
base.trainable = False
inp = tf.keras.Input((IMG, IMG, 3))
x = base(inp, training=False)
x = tf.keras.layers.GlobalAveragePooling2D()(x)
x = tf.keras.layers.Dropout(0.3)(x)
out = tf.keras.layers.Dense(len(MODEL_CLASSES), activation='softmax')(x)
model = tf.keras.Model(inp, out)
model.compile(tf.keras.optimizers.Adam(1e-3), 'sparse_categorical_crossentropy', ['accuracy'])
cb = [tf.keras.callbacks.EarlyStopping(patience=3, restore_best_weights=True)]
model.fit(train_ds, validation_data=val_ds, epochs=8, class_weight=class_weight, callbacks=cb)
base.trainable = True
for layer in base.layers[:-40]: layer.trainable = False
model.compile(tf.keras.optimizers.Adam(1e-4), 'sparse_categorical_crossentropy', ['accuracy'])
model.fit(train_ds, validation_data=val_ds, epochs=15, class_weight=class_weight, callbacks=cb)
""")

code("""
# 11. Threshold (tuned on VALIDATION), metrics (reported on TEST). Predictions are masked
#     to the crop the farmer chose (+ unclear), like in the app.
from sklearn.metrics import confusion_matrix, classification_report
def masked_predict(d, rs):
    P = model.predict(d, verbose=0)
    out = []
    for p, r in zip(P, rs):
        crop = CROP_OF[r['cls']] or random.choice(['wheat', 'rice', 'cotton'])
        allowed = [i for i, c in enumerate(MODEL_CLASSES) if CROP_OF[c] in (crop, None)]
        q = np.zeros_like(p); q[allowed] = p[allowed]; q /= q.sum()
        out.append(q)
    return np.array(out)
Pv = masked_predict(val_ds, val_rs); yv = np.array([CLASS_INDEX[r['cls']] for r in val_rs])
best_t, best_score = 0.8, -1
for t in np.arange(0.5, 0.96, 0.01):
    conf = Pv.max(1) >= t
    if conf.sum() == 0: continue
    precision = (Pv.argmax(1)[conf] == yv[conf]).mean(); coverage = conf.mean()
    score = precision if precision >= 0.9 else precision * coverage   # aim for ≥ 90% precision when confident
    if precision >= 0.9 and coverage > 0.3: score += coverage
    if score > best_score: best_t, best_score = float(t), score
Pt = masked_predict(test_ds, test_rs); yt = np.array([CLASS_INDEX[r['cls']] for r in test_rs]); pt = Pt.argmax(1)
conf_t = Pt.max(1) >= best_t
cm = confusion_matrix(yt, pt, labels=range(len(MODEL_CLASSES)))
cls_rep = classification_report(yt, pt, labels=range(len(MODEL_CLASSES)), target_names=MODEL_CLASSES, zero_division=0)
per_source = Counter(); per_source_ok = Counter()
for r, ok in zip(test_rs, pt == yt): per_source[r['source']] += 1; per_source_ok[r['source']] += int(ok)
print('threshold', round(best_t, 2)); print(cls_rep)
""")

code("""
# 12. Export: INT8 TFLite (3–6 MB target), ONNX, labels.json, REPORT.md, zip.
VERSION = 'leaf-v1-' + datetime.date.today().strftime('%Y%m%d')
def representative():
    for r in random.sample(train_rs, min(300, len(train_rs))):
        yield [tf.expand_dims(load(r['path'], 0)[0], 0)]
conv = tf.lite.TFLiteConverter.from_keras_model(model)
conv.optimizations = [tf.lite.Optimize.DEFAULT]
conv.representative_dataset = representative
conv.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
conv.inference_input_type = tf.uint8; conv.inference_output_type = tf.uint8
tfl = conv.convert(); (OUT / 'leaf_model_int8.tflite').write_bytes(tfl)
size_mb = len(tfl) / 1e6
if not (3 <= size_mb <= 6): REPORT_NOTES.append(f'- TFLite size {size_mb:.1f} MB is outside the 3–6 MB target.')
import tf2onnx
tf2onnx.convert.from_keras(model, input_signature=[tf.TensorSpec((None, IMG, IMG, 3), tf.float32, name='image')], output_path=str(OUT / 'leaf_model.onnx'))
labels = {
    'model_version': VERSION, 'input_size': IMG, 'input': 'RGB uint8 0–255 (TFLite) / float32 0–255 (ONNX); preprocessing is inside the model',
    'threshold': round(best_t, 2), 'classes': [{'id': c, 'crop': CROP_OF[c]} for c in MODEL_CLASSES],
    'trained_on': [d['key'] for d in DATASETS['datasets'] if d['key'] in downloaded] + ['open-images'],
}
(OUT / 'labels.json').write_text(json.dumps(labels, indent=2))
lines = [f'# Leaf model report · {VERSION}', '', f'- Images: train {len(train_rs)}, val {len(val_rs)}, test {len(test_rs)}',
         f'- Confidence threshold (tuned on validation): **{best_t:.2f}**',
         f'- Test accuracy: **{(pt == yt).mean():.1%}**; when confident (≥ threshold): {(pt[conf_t] == yt[conf_t]).mean() if conf_t.any() else 0:.1%} on {conf_t.mean():.0%} of photos',
         f'- TFLite INT8 size: {size_mb:.1f} MB', '', '## Notes', *REPORT_NOTES, '', '## Per-class (test)', '```', cls_rep, '```',
         '', '## Per-source accuracy (test)', '| source | images | accuracy |', '|---|---|---|',
         *[f'| {s} | {n} | {per_source_ok[s] / n:.1%} |' for s, n in per_source.items()],
         '', '## Confusion matrix (rows = true, columns = predicted)', '| | ' + ' | '.join(MODEL_CLASSES) + ' |', '|---' * (len(MODEL_CLASSES) + 1) + '|',
         *[f'| {MODEL_CLASSES[i]} | ' + ' | '.join(str(v) for v in row) + ' |' for i, row in enumerate(cm)],
         '', '## Class × source (all splits)', *[f'- {c}: ' + ', '.join(f'{s} {n}' for s, n in Counter(r['source'] for r in records if r['cls'] == c).items()) for c in MODEL_CLASSES]]
(OUT / 'REPORT.md').write_text('\\n'.join(lines))
with zipfile.ZipFile(OUT / 'kisanconnect_model.zip', 'w') as z:
    for f in ('leaf_model_int8.tflite', 'leaf_model.onnx', 'labels.json', 'REPORT.md'): z.write(OUT / f, f)
print('Done →', OUT / 'kisanconnect_model.zip')
""")

nb = {
    "cells": cells,
    "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}, "language_info": {"name": "python"}, "accelerator": "GPU"},
    "nbformat": 4,
    "nbformat_minor": 5,
}
(HERE / "train.ipynb").write_text(json.dumps(nb, indent=1, ensure_ascii=False) + "\n")
print("wrote ml/train.ipynb with", len(cells), "cells")

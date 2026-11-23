# Training data for the on-device leaf model

**Licences were checked on 2026-11-23** through the Mendeley Data public API (`https://data.mendeley.com/public-api/datasets/<id>`).
Rules: no or unknown licence → dropped. CC BY → used with attribution (listed here, in the app under Settings → About, and in the README).
NC (non-commercial) → only while the app is free, flagged "retrain before any paid use". **Every dataset below is CC BY 4.0**, so nothing is NC-flagged right now.

No images are stored in this repository. `ml/train.ipynb` downloads them at run time from the links below (`ml/datasets.json` is the machine-readable copy).

| # | Dataset | Link | Licence | Images | Country / setting | Classes we use |
|---|---|---|---|---|---|---|
| 1 | Wheat Leaf Dataset | [wgd66f8n6h](https://data.mendeley.com/datasets/wgd66f8n6h/1) | CC BY 4.0 | 407 | Ethiopia, Holeta (real field) | yellow (stripe) rust, septoria, healthy |
| 2 | Wheat nitrogen deficiency and leaf rust | [th422bg4yd](https://data.mendeley.com/datasets/th422bg4yd/1) | CC BY 4.0 | 859 (leaf rust part) | India, IARI field 2019-20 | brown (leaf) rust, healthy (control) |
| 3 | Wheat Rust Images For Diseases Map | [25g6cm8vhb](https://data.mendeley.com/datasets/25g6cm8vhb/1) | CC BY 4.0 | not stated | not stated | rust folders as found (checked at download) |
| 4 | Rice Leaf Disease Image Samples (Sethy et al.) | [fwcj7stb8r](https://data.mendeley.com/datasets/fwcj7stb8r/2) | CC BY 4.0 | 5,932 | India, Odisha | bacterial blight, blast, brown spot |
| 5 | Rice Leaf Bacterial and Fungal Disease Dataset | [hx6f852hw4](https://data.mendeley.com/datasets/hx6f852hw4/2) | CC BY 4.0 | 1,701 originals | Bangladesh, Sirajganj & Pabna | bacterial leaf blight, brown spot, blast, healthy (if present) |
| 6 | RiceLeafBD | [kx9rx8p2mz](https://data.mendeley.com/datasets/kx9rx8p2mz/1) | CC BY 4.0 | 1,555 | Bangladesh, Sylhet & Dhaka (smartphone, field) | bacterial leaf blight, brown spot, healthy |
| 7 | RiceLeafDiseaseBD | [86s4jzj2m4](https://data.mendeley.com/datasets/86s4jzj2m4/3) | CC BY 4.0 | 9,769 | Bangladesh, Gazipur (smartphone, 2025) | blast, brown spot, healthy |
| 8 | Cotton Crop plant leaves Data set | [nmjxz73z6y](https://data.mendeley.com/datasets/nmjxz73z6y/2) | CC BY 4.0 | not stated | **Pakistan**, Shaheed Benazirabad (Sindh) | folders matched at download (leaf curl, blight, spot, healthy) |
| 9 | CoSEV cotton disease dataset | [y7544ghy3y](https://data.mendeley.com/datasets/y7544ghy3y/1) | CC BY 4.0 | 496 | not stated in summary | folders matched at download |
| U | Open Images V7 (non-leaf photos for "unclear") | [storage.googleapis.com/openimages](https://storage.googleapis.com/openimages/web/index.html) | images CC BY 2.0, labels CC BY 4.0 | ≤ 1,500 sampled | worldwide | unclear |

## Class × source (expected)

`✓` = expected from the dataset description; the notebook prints the real counts in `ml/REPORT.md` and drops any folder it can't match.

| Class | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | U | Split by |
|---|---|---|---|---|---|---|---|---|---|---|---|
| wheat-yellow-rust | ✓ |  | ✓ |  |  |  |  |  |  |  | source |
| wheat-brown-rust |  | ✓ | ✓ |  |  |  |  |  |  |  | source |
| wheat-septoria | ✓ |  |  |  |  |  |  |  |  |  | **folder (1 source only — flagged)** |
| wheat-healthy | ✓ | ✓ | ✓ |  |  |  |  |  |  |  | source |
| rice-blast |  |  |  | ✓ | ✓ |  | ✓ |  |  |  | source |
| rice-brown-spot |  |  |  | ✓ | ✓ | ✓ | ✓ |  |  |  | source |
| rice-bacterial-leaf-blight |  |  |  | ✓ | ✓ | ✓ |  |  |  |  | source |
| rice-healthy |  |  |  |  | ✓ | ✓ | ✓ |  |  |  | source |
| cotton-leaf-curl-virus |  |  |  |  |  |  |  | ✓ | ✓ |  | source |
| cotton-bacterial-blight |  |  |  |  |  |  |  | ✓ | ✓ |  | source |
| cotton-leaf-spot |  |  |  |  |  |  |  | ✓ | ✓ |  | source |
| cotton-healthy |  |  |  |  |  |  |  | ✓ | ✓ |  | source |
| unclear | made from all | | | | | | | | | ✓ | source |

## Known gaps (be honest in the app)

- **Only one cotton dataset is from Pakistan**, and none of the wheat or rice sets are. Pakistani field photos saved from real scans (with consent) are the best way to improve the model later.
- **Wheat septoria has one source**, so its test score can't show how it does on photos from somewhere else.
- **Stem rust, sugarcane and maize are not in the on-device model** (no suitable openly licensed field data found). Those crops use the cloud check only.

## Attribution text (Settings → About, README)

Leaf images used to train the on-device model come from these Mendeley Data datasets (CC BY 4.0): Wheat Leaf Dataset (Holeta, Ethiopia); Wheat nitrogen deficiency and leaf rust image dataset (Arya & Singh, IARI, India); Wheat Rust Images For Diseases Map; Rice Leaf Disease Image Samples (Sethy et al.); Rice Leaf Bacterial and Fungal Disease Dataset; RiceLeafBD; RiceLeafDiseaseBD; Cotton Crop plant leaves Data set (Shaheed Benazirabad, Pakistan); CoSEV. Non-leaf photos: Open Images V7 (CC BY 2.0).

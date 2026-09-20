"""Build the standalone browser edition of VisionTrack.

Produces a single self-contained .html file: TensorFlow.js, the COCO-SSD
wrapper and the model weights are all inlined, so the page runs from a local
file with no server, no install and no network access.

    python build.py            # writes dist/VisionTrack-Live.html
    python build.py --out X    # writes somewhere else

Downloaded pieces are cached in .cache/ so repeat builds are offline.
"""
from __future__ import annotations

import argparse
import base64
import json
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
CACHE = HERE / ".cache"
MODEL_BASE = "https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2"
# face-api bundles its own TensorFlow.js (4.22.0), which the page then shares
# with coco-ssd, so no separate tfjs copy is needed.
FACE_API = "@vladmandic/face-api@1.7.15"
PACKAGES = {
    "faceapi": (FACE_API, "package/dist/face-api.js"),
    "cocossd": ("@tensorflow-models/coco-ssd@2.2.3", "package/dist/coco-ssd.min.js"),
    "bodypix": ("@tensorflow-models/body-pix@2.2.1", "package/dist/body-pix.min.umd.js"),
}
# Person segmentation: MobileNetV1, stride 16, multiplier 0.5 - the smallest
# BodyPix variant, since this runs alongside detection on the same GPU.
SEG_BASE = ("https://storage.googleapis.com/tfjs-models/savedmodel/bodypix"
            "/mobilenet/float/050")
# The .bin files hold uint8-quantized weights, so the manifest that describes
# the scale and zero point travels with them.
FACE_WEIGHTS = {
    "faceDetector": ("package/model/tiny_face_detector_model.bin",
                     "package/model/tiny_face_detector_model-weights_manifest.json"),
    "ageGender": ("package/model/age_gender_model.bin",
                  "package/model/age_gender_model-weights_manifest.json"),
}


def fetch(url: str, dest: Path) -> Path:
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  downloading {url}")
    with urllib.request.urlopen(url, timeout=180) as response, dest.open("wb") as out:
        shutil.copyfileobj(response, out)
    return dest


def npm_files(spec: str, members: dict[str, Path]) -> None:
    """Pull several files out of one npm tarball, skipping ones already cached."""
    missing = {m: d for m, d in members.items() if not (d.exists() and d.stat().st_size > 0)}
    if not missing:
        return
    with tempfile.TemporaryDirectory() as tmp:
        print(f"  npm pack {spec}")
        subprocess.run(["npm", "pack", spec], cwd=tmp, check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        tarball = next(Path(tmp).glob("*.tgz"))
        with tarfile.open(tarball) as tf:
            for member, dest in missing.items():
                extracted = tf.extractfile(member)
                if extracted is None:
                    raise SystemExit(f"{member} is missing from {spec}")
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(extracted.read())


def npm_file(spec: str, member: str, dest: Path) -> Path:
    npm_files(spec, {member: dest})
    return dest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(HERE / "dist" / "VisionTrack-Live.html"))
    args = parser.parse_args()

    print("Collecting libraries...")
    face_members = {PACKAGES["faceapi"][1]: CACHE / "face-api.js"}
    for pair in FACE_WEIGHTS.values():
        face_members.update({m: CACHE / Path(m).name for m in pair})
    npm_files(FACE_API, face_members)
    faceapi_js = (CACHE / "face-api.js").read_text()
    coco = npm_file(*PACKAGES["cocossd"], CACHE / "coco-ssd.min.js").read_text()
    bodypix_js = npm_file(*PACKAGES["bodypix"], CACHE / "body-pix.min.umd.js").read_text()

    print("Collecting the model...")
    manifest_path = fetch(f"{MODEL_BASE}/model.json", CACHE / "model" / "model.json")
    manifest = json.loads(manifest_path.read_text())
    shards = [p for group in manifest["weightsManifest"] for p in group["paths"]]
    blob = b"".join(
        fetch(f"{MODEL_BASE}/{s}", CACHE / "model" / s).read_bytes() for s in shards
    )
    print(f"  weights: {len(blob) / 1e6:.1f} MB")

    payload = {
        "topology": manifest["modelTopology"],
        "manifest": manifest["weightsManifest"],
        "weights": base64.b64encode(blob).decode("ascii"),
    }
    for key, (bin_member, manifest_member) in FACE_WEIGHTS.items():
        raw = (CACHE / Path(bin_member).name).read_bytes()
        specs = json.loads((CACHE / Path(manifest_member).name).read_text())
        print(f"  {key}: {len(raw) / 1e3:.0f} KB, {sum(len(g['weights']) for g in specs)} tensors")
        payload[key] = {
            "weights": base64.b64encode(raw).decode("ascii"),
            "manifest": specs,
        }

    html = (HERE / "template.html").read_text()
    seg_manifest_path = fetch(f"{SEG_BASE}/model-stride16.json", CACHE / "seg" / "model.json")
    seg_manifest = json.loads(seg_manifest_path.read_text())
    seg_shards = [p for g in seg_manifest["weightsManifest"] for p in g["paths"]]
    seg_blob = b"".join(
        fetch(f"{SEG_BASE}/{sname}", CACHE / "seg" / sname).read_bytes() for sname in seg_shards
    )
    print(f"  segmentation: {len(seg_blob) / 1e6:.1f} MB")
    payload["seg"] = {
        "topology": seg_manifest["modelTopology"],
        "manifest": seg_manifest["weightsManifest"],
        "weights": base64.b64encode(seg_blob).decode("ascii"),
    }

    html = html.replace("/*__FACEAPI__*/", faceapi_js)
    html = html.replace("/*__BODYPIX__*/", bodypix_js)
    html = html.replace("/*__COCOSSD__*/", coco)
    html = html.replace("/*__MODELDATA__*/",
                        "window.__VT_MODEL__=" + json.dumps(payload, separators=(",", ":")) + ";")
    html = html.replace("/*__APP__*/", (HERE / "app.js").read_text())

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"\nWrote {out} ({out.stat().st_size / 1e6:.1f} MB)")
    print("Open it by double-clicking; no server needed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

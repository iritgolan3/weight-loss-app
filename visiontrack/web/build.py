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
PACKAGES = {
    "tfjs": ("@tensorflow/tfjs@4.22.0", "package/dist/tf.min.js"),
    "cocossd": ("@tensorflow-models/coco-ssd@2.2.3", "package/dist/coco-ssd.min.js"),
}


def fetch(url: str, dest: Path) -> Path:
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  downloading {url}")
    with urllib.request.urlopen(url, timeout=180) as response, dest.open("wb") as out:
        shutil.copyfileobj(response, out)
    return dest


def npm_file(spec: str, member: str, dest: Path) -> Path:
    """Pull one file out of an npm tarball."""
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        print(f"  npm pack {spec}")
        subprocess.run(["npm", "pack", spec], cwd=tmp, check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        tarball = next(Path(tmp).glob("*.tgz"))
        with tarfile.open(tarball) as tf:
            extracted = tf.extractfile(member)
            if extracted is None:
                raise SystemExit(f"{member} is missing from {spec}")
            dest.write_bytes(extracted.read())
    return dest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(HERE / "dist" / "VisionTrack-Live.html"))
    args = parser.parse_args()

    print("Collecting libraries...")
    tfjs = npm_file(*PACKAGES["tfjs"], CACHE / "tf.min.js").read_text()
    coco = npm_file(*PACKAGES["cocossd"], CACHE / "coco-ssd.min.js").read_text()

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

    html = (HERE / "template.html").read_text()
    html = html.replace("/*__TFJS__*/", tfjs)
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

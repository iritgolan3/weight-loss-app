"""Build the standalone browser edition of VisionTrack.

Produces a single self-contained .html file: TensorFlow.js, the COCO-SSD
wrapper and the model weights are all inlined, so the page runs from a local
file with no server, no install and no network access.

The weights are gzipped and then written in a 85-character text encoding
instead of base64. Base64 costs 33% over the raw bytes; this costs 25%, and
gzip takes another slice off first, so 26 MB of weights land in roughly 28 MB
of text instead of 35 MB. The page inflates them with DecompressionStream
during the boot screen.

    python build.py            # writes dist/VisionTrack-Live.html
    python build.py --out X    # writes somewhere else

Downloaded pieces are cached in .cache/ so repeat builds are offline.
"""
from __future__ import annotations

import argparse
import base64
import gzip
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
# face-api bundles its own TensorFlow.js (4.22.0), which the page then shares
# with coco-ssd, so no separate tfjs copy is needed.
FACE_API = "@vladmandic/face-api@1.7.15"
ORT = "onnxruntime-web@1.30.0"
# The "bundle" build has the WebAssembly glue module inlined. The plain build
# imports it as a sibling .mjs at runtime, which a file:// page cannot fetch -
# that is the one thing that makes this work offline from a double-click.
ORT_ESM = "package/dist/ort.webgpu.bundle.min.mjs"
ORT_WASM = "package/dist/ort-wasm-simd-threaded.asyncify.wasm"
PACKAGES = {
    "faceapi": (FACE_API, "package/dist/face-api.js"),
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
    # Landmarks align the crop; the recognition net turns it into a 128-D
    # descriptor. No face data ships in this file - enrolment happens on the
    # operator's own machine and stays in their browser.
    "landmarks": ("package/model/face_landmark_68_tiny_model.bin",
                  "package/model/face_landmark_68_tiny_model-weights_manifest.json"),
    "recognition": ("package/model/face_recognition_model.bin",
                    "package/model/face_recognition_model-weights_manifest.json"),
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


# 85 printable characters, leaving out the ones that would end the <script>
# element or need escaping inside it: < > & \\ " \' and the backtick.
B85 = "".join(c for c in (chr(i) for i in range(33, 127))
              if c not in '<>&\\"\'`')[:85]
assert len(B85) == 85 and len(set(B85)) == 85


# The 80 COCO classes, in the order YOLO26 emits them. The model returns a class
# index; this is the only place that turns it back into a word.
COCO_NAMES = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck",
    "boat", "traffic light", "fire hydrant", "stop sign", "parking meter", "bench",
    "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra",
    "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
    "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove",
    "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup",
    "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
    "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
    "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
    "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
    "refrigerator", "book", "clock", "vase", "scissors", "teddy bear",
    "hair drier", "toothbrush",
]


def pack(raw: bytes) -> dict:
    """gzip, then base85 - the form the page's unpack() expects."""
    blob = gzip.compress(raw, 9, mtime=0)
    pad = (-len(blob)) % 4
    padded = blob + b"\0" * pad
    out = bytearray()
    for i in range(0, len(padded), 4):
        n = int.from_bytes(padded[i:i + 4], "big")
        chunk = bytearray(5)
        for j in range(4, -1, -1):
            n, r = divmod(n, 85)
            chunk[j] = ord(B85[r])
        out += chunk
    return {"z": out.decode("ascii"), "n": len(blob)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(HERE / "dist" / "VisionTrack-Live.html"))
    parser.add_argument("--detector", default="yolo26m",
                        help="which .onnx in .cache/ to inline (see export_yolo.py)")
    args = parser.parse_args()

    print("Collecting libraries...")
    face_members = {PACKAGES["faceapi"][1]: CACHE / "face-api.js"}
    for pair in FACE_WEIGHTS.values():
        face_members.update({m: CACHE / Path(m).name for m in pair})
    npm_files(FACE_API, face_members)
    faceapi_js = (CACHE / "face-api.js").read_text()
    bodypix_js = npm_file(*PACKAGES["bodypix"], CACHE / "body-pix.min.umd.js").read_text()
    npm_files(ORT, {ORT_ESM: CACHE / "ort.webgpu.bundle.min.mjs",
                    ORT_WASM: CACHE / "ort-wasm-simd-threaded.asyncify.wasm"})
    ort_esm = (CACHE / "ort.webgpu.bundle.min.mjs").read_text()
    ort_wasm = (CACHE / "ort-wasm-simd-threaded.asyncify.wasm").read_bytes()
    print(f"  onnxruntime-web: {len(ort_wasm) / 1e6:.1f} MB wasm")

    print("Collecting the detector...")
    onnx_path = CACHE / f"{args.detector}.onnx"
    if not onnx_path.exists():
        raise SystemExit(
            f"{onnx_path} is missing. Produce it once with:  "
            f"python export_yolo.py --model {args.detector}"
        )
    onnx = onnx_path.read_bytes()
    print(f"  {onnx_path.name}: {len(onnx) / 1e6:.1f} MB")

    payload = {
        "ortWasm": pack(ort_wasm),
        "yolo": pack(onnx),
        "names": COCO_NAMES,
    }
    for key, (bin_member, manifest_member) in FACE_WEIGHTS.items():
        raw = (CACHE / Path(bin_member).name).read_bytes()
        specs = json.loads((CACHE / Path(manifest_member).name).read_text())
        print(f"  {key}: {len(raw) / 1e3:.0f} KB, {sum(len(g['weights']) for g in specs)} tensors")
        payload[key] = {
            "weights": pack(raw),
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
        "topology": pack(json.dumps(seg_manifest["modelTopology"]).encode()),
        "manifest": seg_manifest["weightsManifest"],
        "weights": pack(seg_blob),
    }

    html = html.replace("/*__FACEAPI__*/", faceapi_js)
    html = html.replace("/*__BODYPIX__*/", bodypix_js)
    html = html.replace("/*__ORTESM__*/", ort_esm)
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

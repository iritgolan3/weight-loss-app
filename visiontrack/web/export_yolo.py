"""Export YOLO26m to the ONNX file build.py inlines.

Run this once; build.py then reads .cache/yolo26m.onnx. Kept separate because
it needs torch and ultralytics, which the build itself does not.

    pip install ultralytics onnx onnxslim
    python export_yolo.py

nms=False is the flag that matters. YOLO26 has an end-to-end detection head, and
with nms=False the export keeps it: the model emits (1, 300, 6) - already
decoded x1,y1,x2,y2,score,class, sorted, no NMS to run in the browser. Leave the
flag off and the export falls back to the legacy raw (1, 84, 8400) head, which
would need NMS written in JavaScript.

fp32 is deliberate. The fp16 export is half the size and, measured on a test
frame, indistinguishable in accuracy - but a WebGPU device has to advertise the
shader-f16 feature to run it, and one that does not falls back to WASM, where
this model needs seconds per frame. fp32 runs on any WebGPU device.
"""
import argparse
from pathlib import Path

from ultralytics import YOLO

CACHE = Path(__file__).resolve().parent / ".cache"

# GFLOPs at 640x640, from the model config. The browser needs WebGPU for
# anything above the smallest of these; on the WASM CPU backend, m measures
# 0.25 frames per second.
VARIANTS = {"yolo26n": 6.1, "yolo26s": 22.8, "yolo26m": 68.4, "yolo26l": 93.8}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="yolo26m", choices=sorted(VARIANTS))
    args = ap.parse_args()

    CACHE.mkdir(exist_ok=True)
    print(f"exporting {args.model} ({VARIANTS[args.model]} GFLOPs)...")
    produced = YOLO(args.model + ".pt").export(
        format="onnx", imgsz=640, opset=17, simplify=True, dynamic=False, nms=False,
    )
    target = CACHE / (args.model + ".onnx")
    Path(produced).replace(target)
    print(f"wrote {target} ({target.stat().st_size / 1048576:.1f} MiB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

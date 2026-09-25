"""YOLO detector + multi-object tracker wrapper.

Everything model-specific lives here. To swap in a different detector, implement
the same `Detector` surface (`class_names`, `track()`, `reset()`) and return it
from `load_detector`.
"""
from __future__ import annotations

import logging
import os
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Sequence

import numpy as np

from ..config import MODELS_DIR
from ..errors import ModelUnavailableError

log = logging.getLogger("visiontrack.detector")

_TRACKER_FILES = {"bytetrack": "bytetrack.yaml", "botsort": "botsort.yaml"}


@dataclass
class Detection:
    track_id: int
    cls_id: int
    cls_name: str
    confidence: float
    bbox: np.ndarray  # [x1, y1, x2, y2] in the coordinate space of the frame passed in


def resolve_device(choice: str = "auto") -> str:
    """Pick the compute device, falling back to CPU when CUDA is unavailable."""
    try:
        import torch
    except ImportError as exc:  # pragma: no cover - torch is a hard dependency
        raise ModelUnavailableError(
            "PyTorch is not installed.",
            hint="Run: pip install -r backend/requirements.txt",
        ) from exc

    if choice == "cpu":
        return "cpu"
    if choice == "cuda":
        if not torch.cuda.is_available():
            log.warning("CUDA requested but unavailable - falling back to CPU.")
            return "cpu"
        return "cuda"
    return "cuda" if torch.cuda.is_available() else "cpu"


def device_report(choice: str = "auto") -> Dict[str, object]:
    info: Dict[str, object] = {
        "torch_version": None,
        "cuda_available": False,
        "cuda_device_name": None,
        "device_in_use": "cpu",
    }
    try:
        import torch
    except ImportError:
        return info
    info["torch_version"] = torch.__version__
    info["cuda_available"] = bool(torch.cuda.is_available())
    if info["cuda_available"]:
        try:
            info["cuda_device_name"] = torch.cuda.get_device_name(0)
        except Exception:  # pragma: no cover - driver quirks
            info["cuda_device_name"] = "CUDA device"
    info["device_in_use"] = resolve_device(choice)
    return info


def _tracker_config(tracker: str, max_lost_frames: int) -> str:
    """Write a tracker YAML derived from the installed Ultralytics defaults.

    Copying the packaged file (instead of hand-writing one) keeps us compatible
    with whatever keys the installed Ultralytics version expects.
    """
    import yaml
    from ultralytics.utils import ROOT as ULTRA_ROOT

    name = _TRACKER_FILES.get(tracker, "bytetrack.yaml")
    source = Path(ULTRA_ROOT) / "cfg" / "trackers" / name
    if not source.exists():
        raise ModelUnavailableError(
            f"Tracker config '{name}' is missing from the Ultralytics installation.",
            hint="Reinstall ultralytics: pip install --force-reinstall ultralytics",
        )
    cfg = yaml.safe_load(source.read_text()) or {}
    cfg["track_buffer"] = int(max_lost_frames)
    out = Path(tempfile.gettempdir()) / f"visiontrack_{tracker}_{max_lost_frames}.yaml"
    out.write_text(yaml.safe_dump(cfg))
    return str(out)


def ensure_weights(model_name: str) -> Path:
    """Return a local path to the weights, downloading them once if needed."""
    local = MODELS_DIR / model_name
    if local.exists():
        return local

    candidate = Path(model_name)
    if candidate.exists():  # user pointed at their own weights file
        return candidate

    prev_cwd = Path.cwd()
    try:
        os.chdir(MODELS_DIR)  # Ultralytics downloads into the working directory
        from ultralytics.utils.downloads import attempt_download_asset

        attempt_download_asset(model_name)
    except Exception as exc:
        raise ModelUnavailableError(
            f"Could not download model weights '{model_name}'.",
            hint=(
                "Check your internet connection, or place the .pt file manually in "
                f"{MODELS_DIR}"
            ),
            details=str(exc),
        ) from exc
    finally:
        os.chdir(prev_cwd)

    if local.exists():
        return local
    # Some Ultralytics versions drop the file in the CWD instead.
    fallback = prev_cwd / model_name
    if fallback.exists():
        shutil.move(str(fallback), str(local))
        return local
    raise ModelUnavailableError(
        f"Model weights '{model_name}' were not found after download.",
        hint=f"Place the .pt file manually in {MODELS_DIR}",
    )


class Detector:
    """Thin facade over an Ultralytics YOLO model with built-in tracking."""

    def __init__(
        self,
        model_name: str = "yolov8n.pt",
        device: str = "auto",
        tracker: str = "bytetrack",
        max_lost_frames: int = 30,
    ):
        self.model_name = model_name
        self.device = resolve_device(device)
        self.tracker_name = tracker
        self.max_lost_frames = max_lost_frames

        weights = ensure_weights(model_name)
        try:
            from ultralytics import YOLO
        except ImportError as exc:
            raise ModelUnavailableError(
                "Ultralytics is not installed.",
                hint="Run: pip install -r backend/requirements.txt",
            ) from exc
        try:
            self.model = YOLO(str(weights))
        except Exception as exc:
            raise ModelUnavailableError(
                f"Failed to load model '{model_name}'.",
                hint="The weights file may be corrupt; delete it and let it re-download.",
                details=str(exc),
            ) from exc

        self.tracker_cfg = _tracker_config(tracker, max_lost_frames)
        names = self.model.names
        self.class_names: Dict[int, str] = (
            {int(k): str(v) for k, v in names.items()} if isinstance(names, dict)
            else {i: str(n) for i, n in enumerate(names)}
        )

    def class_ids_for(self, wanted: Sequence[str]) -> Optional[List[int]]:
        """Map class names to model class ids. None means "keep everything"."""
        if not wanted:
            return None
        wanted_lower = {w.strip().lower() for w in wanted}
        ids = [cid for cid, name in self.class_names.items() if name.lower() in wanted_lower]
        return ids or None

    def reset(self) -> None:
        """Clear tracker state so IDs restart at 1 for a new run."""
        predictor = getattr(self.model, "predictor", None)
        trackers = getattr(predictor, "trackers", None) if predictor else None
        if trackers:
            for trk in trackers:
                if hasattr(trk, "reset"):
                    trk.reset()

    def track(
        self,
        frame: np.ndarray,
        *,
        conf: float,
        iou: float,
        imgsz: int,
        classes: Optional[List[int]] = None,
    ) -> List[Detection]:
        """Run detection + tracking on one frame and return tracked detections."""
        results = self.model.track(
            source=frame,
            persist=True,
            tracker=self.tracker_cfg,
            conf=conf,
            iou=iou,
            imgsz=imgsz,
            classes=classes,
            device=self.device,
            verbose=False,
        )
        if not results:
            return []
        boxes = results[0].boxes
        if boxes is None or boxes.id is None or len(boxes) == 0:
            return []

        xyxy = boxes.xyxy.cpu().numpy()
        ids = boxes.id.cpu().numpy().astype(int)
        clss = boxes.cls.cpu().numpy().astype(int)
        confs = boxes.conf.cpu().numpy()

        out: List[Detection] = []
        for box, tid, cid, cf in zip(xyxy, ids, clss, confs):
            out.append(
                Detection(
                    track_id=int(tid),
                    cls_id=int(cid),
                    cls_name=self.class_names.get(int(cid), str(cid)),
                    confidence=float(cf),
                    bbox=box.astype(float),
                )
            )
        return out


def load_detector(
    model_name: str, device: str, tracker: str, max_lost_frames: int
) -> Detector:
    return Detector(model_name, device=device, tracker=tracker, max_lost_frames=max_lost_frames)

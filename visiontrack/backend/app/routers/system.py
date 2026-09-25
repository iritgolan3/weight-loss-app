"""Hardware/model capability reporting and persisted app settings."""
from __future__ import annotations

from pathlib import Path

import cv2
from fastapi import APIRouter

from ..config import ANALYSIS_MODES, AVAILABLE_MODELS, DEFAULT_CLASSES, MODELS_DIR
from ..models.detector import device_report
from ..schemas import AppSettings, SystemInfo
from ..services import storage

router = APIRouter(prefix="/api", tags=["system"])

DEMO_DIR = Path(__file__).resolve().parents[3] / "data" / "demo"


def demo_file() -> Path | None:
    if not DEMO_DIR.exists():
        return None
    for candidate in sorted(DEMO_DIR.iterdir()):
        if candidate.suffix.lower() in {".mp4", ".mov", ".avi", ".mkv", ".webm"}:
            return candidate
    return None


@router.get("/system", response_model=SystemInfo)
def system_info() -> SystemInfo:
    report = device_report("auto")
    warnings: list[str] = []
    try:
        import ultralytics
        ultra_version = ultralytics.__version__
    except Exception:
        ultra_version = None
        warnings.append("Ultralytics is not installed - analysis will fail.")

    if not report["cuda_available"]:
        warnings.append("No CUDA GPU detected - running on CPU. Use the FAST mode for long videos.")

    models = [
        {**m, "downloaded": (MODELS_DIR / m["id"]).exists()}
        for m in AVAILABLE_MODELS
    ]
    return SystemInfo(
        torch_version=report["torch_version"],
        cuda_available=bool(report["cuda_available"]),
        cuda_device_name=report["cuda_device_name"],
        device_in_use=str(report["device_in_use"]),
        opencv_version=cv2.__version__,
        ultralytics_version=ultra_version,
        models=models,
        modes=ANALYSIS_MODES,
        default_classes=DEFAULT_CLASSES,
        demo_video_available=demo_file() is not None,
        backend_ready=ultra_version is not None and report["torch_version"] is not None,
        warnings=warnings,
    )


@router.get("/settings", response_model=AppSettings)
def get_settings() -> AppSettings:
    return storage.load_settings()


@router.put("/settings", response_model=AppSettings)
def put_settings(settings: AppSettings) -> AppSettings:
    return storage.save_settings(settings)

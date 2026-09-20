"""Filesystem layout and process-wide constants for VisionTrack."""
from __future__ import annotations

import os
from pathlib import Path

# <repo>/visiontrack/backend/app/config.py -> <repo>/visiontrack
PROJECT_ROOT = Path(__file__).resolve().parents[2]

DATA_DIR = Path(os.getenv("VISIONTRACK_DATA_DIR", PROJECT_ROOT / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
RESULTS_DIR = DATA_DIR / "results"
ZONES_DIR = DATA_DIR / "zones"
MODELS_DIR = DATA_DIR / "models"
EXPORT_DIR = Path(os.getenv("VISIONTRACK_EXPORT_DIR", PROJECT_ROOT / "exports"))
SETTINGS_FILE = DATA_DIR / "settings.json"

for _d in (DATA_DIR, UPLOAD_DIR, RESULTS_DIR, ZONES_DIR, MODELS_DIR, EXPORT_DIR):
    _d.mkdir(parents=True, exist_ok=True)

SUPPORTED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".m4v", ".webm"}

# COCO class names we care about by default. The detector can be pointed at any
# model; these are simply the classes enabled out of the box.
DEFAULT_CLASSES = [
    "person",
    "bicycle",
    "car",
    "motorcycle",
    "bus",
    "truck",
]

# Models that can be selected from the settings dialog. Ultralytics downloads
# the weights on first use and caches them in MODELS_DIR.
AVAILABLE_MODELS = [
    {"id": "yolov8n.pt", "label": "YOLOv8 Nano", "note": "Fastest, lowest accuracy"},
    {"id": "yolov8s.pt", "label": "YOLOv8 Small", "note": "Good speed/accuracy balance"},
    {"id": "yolov8m.pt", "label": "YOLOv8 Medium", "note": "Slower, more accurate"},
    {"id": "yolo11n.pt", "label": "YOLO11 Nano", "note": "Newer nano model"},
    {"id": "yolo11s.pt", "label": "YOLO11 Small", "note": "Newer small model"},
]

# Analysis presets. imgsz is the inference resolution (long side).
ANALYSIS_MODES = {
    "fast": {"imgsz": 480, "detect_every_n": 3, "label": "Fast"},
    "balanced": {"imgsz": 640, "detect_every_n": 2, "label": "Balanced"},
    "high_accuracy": {"imgsz": 960, "detect_every_n": 1, "label": "High accuracy"},
}

MAX_UPLOAD_BYTES = int(os.getenv("VISIONTRACK_MAX_UPLOAD_MB", "2048")) * 1024 * 1024

# Live preview sent over the websocket during analysis.
PREVIEW_WIDTH = 720
PREVIEW_JPEG_QUALITY = 72

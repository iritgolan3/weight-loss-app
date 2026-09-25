"""Live sources: local webcams and IP/RTSP streams.

A camera is registered in memory with a stable id derived from its source
string, so zones drawn on `Camera 0` are still there the next time it is
opened. Everything downstream (jobs, tracking, zones, export) treats it like
any other source; only the frame supply differs.
"""
from __future__ import annotations

import hashlib
import threading
import time
from typing import Dict, List, Optional

from ..errors import NotFoundError
from ..video import reader
from . import storage

_lock = threading.RLock()
_cameras: Dict[str, dict] = {}


def source_id(source: str) -> str:
    """Stable id for a source string, so its zones persist across sessions."""
    text = str(source).strip()
    if text.isdigit():
        return f"cam-{int(text)}"
    digest = hashlib.sha1(text.encode()).hexdigest()[:8]
    return f"cam-{digest}"


def is_camera(record_id: str) -> bool:
    return str(record_id).startswith("cam-")


def discover() -> List[dict]:
    return reader.discover_cameras()


def open_camera(source: str, label: Optional[str] = None) -> dict:
    """Probe a live source and register it. Raises a typed error if unreachable."""
    meta = reader.probe_source(source)
    cam_id = source_id(source)
    text = str(source).strip()
    if label:
        name = label
    elif text.isdigit():
        name = f"Camera {text}"
    else:
        name = text.split("@")[-1][:60] or "Live stream"

    record = {
        "id": cam_id,
        "kind": "live",
        "source": text,
        "filename": name,
        "path": None,
        "size_bytes": 0,
        "created_at": time.time(),
        "analyzed": False,
        "analysis": None,
        **meta.as_dict(),
    }
    with _lock:
        _cameras[cam_id] = record
    return record


def get_camera(cam_id: str) -> dict:
    with _lock:
        record = _cameras.get(cam_id)
    if record is None:
        raise NotFoundError(
            f"Live source '{cam_id}' is not connected.",
            hint="Connect the camera again — live sources are not remembered across restarts.",
        )
    return record


def list_cameras() -> List[dict]:
    with _lock:
        return list(_cameras.values())


def close_camera(cam_id: str) -> None:
    with _lock:
        _cameras.pop(cam_id, None)


def resolve_source(source_id: str) -> dict:
    """A source id is either a live camera (cam-...) or a video in the library."""
    if is_camera(source_id):
        return get_camera(source_id)
    return storage.get_video(source_id)

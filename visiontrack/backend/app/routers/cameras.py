"""Live sources: discover local webcams, connect a camera or an IP stream."""
from __future__ import annotations

import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..schemas import VideoInfo
from ..services import cameras
from ..services.job_manager import job_manager

log = logging.getLogger("visiontrack.cameras")
router = APIRouter(prefix="/api/cameras", tags=["cameras"])


class CameraOpen(BaseModel):
    source: str = Field(..., description="Device index ('0') or an rtsp:// / http:// URL")
    label: str | None = Field(None, max_length=60)


@router.get("/discover")
def discover():
    """Probe device indices 0-4 and report the cameras that respond.

    Nothing is opened permanently; each probe is closed straight away.
    """
    found = cameras.discover()
    return {
        "cameras": found,
        "hint": (
            "No camera responded. Check that one is connected and that no other "
            "app (Teams, Zoom, the Camera app) is using it, or type an rtsp:// URL."
        ) if not found else None,
    }


@router.get("", response_model=list[VideoInfo])
def list_cameras():
    return cameras.list_cameras()


@router.post("", response_model=VideoInfo, status_code=201)
def open_camera(payload: CameraOpen):
    """Connect a live source and report what it actually delivers."""
    record = cameras.open_camera(payload.source, payload.label)
    log.info("Live source connected: %s (%sx%s @ %.1f fps)",
             record["filename"], record["width"], record["height"], record["fps"])
    return record


@router.delete("/{camera_id}", status_code=204)
def close_camera(camera_id: str):
    job = job_manager.for_video(camera_id)
    if job and job.status in ("queued", "running"):
        job_manager.stop(job.id)
    cameras.close_camera(camera_id)
    return None

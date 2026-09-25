"""Export endpoints: annotated MP4 plus CSV/JSON detection data."""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..config import EXPORT_DIR
from ..errors import NotFoundError, VisionTrackError
from ..services.events import hub
from ..services.exporter import export_csv, export_json, video_exporter

log = logging.getLogger("visiontrack.exports")
router = APIRouter(tags=["exports"])


class VideoExportRequest(BaseModel):
    show_boxes: bool = True
    show_labels: bool = True
    show_confidence: bool = True
    show_trajectories: bool = True
    show_timers: bool = True
    show_zones: bool = True
    show_hud: bool = True
    trajectory_length: int = 60
    trajectory_thickness: int = 2
    trajectory_color: str = "#39ff14"
    selected_color: str = "#ff2bd1"
    selected_id: Optional[int] = None


@router.get("/api/videos/{video_id}/export/data")
def export_data(video_id: str, format: Literal["json", "csv"] = "json",
                dataset: Literal["detections", "tracks"] = "detections"):
    path = export_json(video_id) if format == "json" else export_csv(video_id, dataset)
    return FileResponse(
        path,
        media_type="application/json" if format == "json" else "text/csv",
        filename=path.name,
    )


@router.post("/api/videos/{video_id}/export/video")
def export_video(video_id: str, options: VideoExportRequest | None = None):
    job = video_exporter.start(video_id, (options or VideoExportRequest()).model_dump())
    return job.state()


@router.get("/api/exports/{export_id}")
def export_status(export_id: str):
    return video_exporter.get(export_id).state()


@router.get("/api/exports/{export_id}/download")
def download_export(export_id: str):
    job = video_exporter.get(export_id)
    if job.status != "completed" or not job.output:
        raise NotFoundError(
            "That export is not finished yet.",
            hint="Wait for the progress bar to reach 100%.",
        )
    path = Path(job.output)
    if not path.exists():
        raise NotFoundError(f"Exported file '{path.name}' is missing from {EXPORT_DIR}.")
    return FileResponse(path, media_type="video/mp4", filename=path.name)


@router.websocket("/ws/exports/{export_id}")
async def export_socket(websocket: WebSocket, export_id: str):
    await websocket.accept()
    try:
        job = video_exporter.get(export_id)
    except VisionTrackError as exc:
        await websocket.send_json({"type": "error", "error": exc.to_dict()})
        await websocket.close()
        return

    hub.bind_loop(asyncio.get_running_loop())
    queue = hub.subscribe(job.topic)
    await websocket.send_json({"type": "export", "job": job.state()})
    try:
        while True:
            event = await queue.get()
            await websocket.send_json(event)
            state = event.get("job", {})
            if state.get("status") in ("completed", "failed"):
                break
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # pragma: no cover
        log.debug("export socket closed: %s", exc)
    finally:
        hub.unsubscribe(job.topic, queue)
        try:
            await websocket.close()
        except Exception:
            pass

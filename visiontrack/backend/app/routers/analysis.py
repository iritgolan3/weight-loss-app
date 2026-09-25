"""Analysis job control plus the live websocket feed."""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..errors import VisionTrackError
from ..schemas import AnalysisConfig, JobState
from ..services import storage
from ..services.events import hub
from ..services.job_manager import job_manager

log = logging.getLogger("visiontrack.analysis")
router = APIRouter(tags=["analysis"])


@router.post("/api/videos/{video_id}/analyze", response_model=JobState)
def start_analysis(video_id: str, config: AnalysisConfig | None = None):
    cfg = config or AnalysisConfig(**storage.load_settings().model_dump(
        include={"model", "confidence", "iou", "tracker", "max_lost_frames",
                 "trajectory_length", "mode", "device", "classes", "imgsz",
                 "detect_every_n", "preview"}
    ))
    job = job_manager.start(video_id, cfg)
    # Only drop the previous overlay data once the new run actually started.
    storage.clear_results(video_id)
    return job.state()


@router.get("/api/jobs", response_model=list[JobState])
def list_jobs():
    return job_manager.list_jobs()


@router.get("/api/jobs/{job_id}", response_model=JobState)
def get_job(job_id: str):
    return job_manager.get(job_id).state()


@router.post("/api/jobs/{job_id}/stop", response_model=JobState)
def stop_job(job_id: str):
    return job_manager.stop(job_id).state()


@router.get("/api/videos/{video_id}/job", response_model=JobState | None)
def job_for_video(video_id: str):
    job = job_manager.for_video(video_id)
    return job.state() if job else None


@router.websocket("/ws/jobs/{job_id}")
async def job_socket(websocket: WebSocket, job_id: str):
    """Streams frame payloads, stats, zone events and lifecycle updates."""
    await websocket.accept()
    try:
        job = job_manager.get(job_id)
    except VisionTrackError as exc:
        await websocket.send_json({"type": "error", "error": exc.to_dict()})
        await websocket.close()
        return

    hub.bind_loop(asyncio.get_running_loop())
    queue = hub.subscribe(job.topic)
    await websocket.send_json({"type": "state", "job": job.state()})
    try:
        while True:
            event = await queue.get()
            await websocket.send_json(event)
            if event.get("type") == "done":
                break
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # pragma: no cover - transport level
        log.debug("job socket closed: %s", exc)
    finally:
        hub.unsubscribe(job.topic, queue)
        try:
            await websocket.close()
        except Exception:
            pass

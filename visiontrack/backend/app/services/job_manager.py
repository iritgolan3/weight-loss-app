"""The analysis pipeline.

    frame -> YOLO detection -> tracker (persistent IDs) -> trajectories ->
    zone analysis -> websocket payload + stored timeline

Runs in a worker thread so the API event loop is never blocked. Results are
persisted so the UI can replay overlays over the original video afterwards.
"""
from __future__ import annotations

import base64
import logging
import threading
import time
import traceback
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import cv2

from ..config import PREVIEW_JPEG_QUALITY, PREVIEW_WIDTH
from ..errors import JobConflictError, NotFoundError, VisionTrackError
from ..models.detector import Detector, device_report, load_detector
from ..schemas import AnalysisConfig
from ..tracking.tracks import TrackRegistry
from ..tracking.zones import Zone, zone_store
from ..video import reader
from . import storage
from .events import hub

log = logging.getLogger("visiontrack.jobs")

PREVIEW_MAX_FPS = 15.0
STATUS_CODES = {"moving": 1, "stationary": 0}


@dataclass
class JobStats:
    processing_fps: float = 0.0
    detection_fps: float = 0.0
    video_fps: float = 0.0
    frames_processed: int = 0
    frames_total: int = 0
    detections_last_frame: int = 0
    tracked_objects: int = 0
    unique_objects: int = 0
    elapsed: float = 0.0
    eta: Optional[float] = None

    def as_dict(self) -> dict:
        return {
            "processing_fps": round(self.processing_fps, 2),
            "detection_fps": round(self.detection_fps, 2),
            "video_fps": round(self.video_fps, 2),
            "frames_processed": self.frames_processed,
            "frames_total": self.frames_total,
            "detections_last_frame": self.detections_last_frame,
            "tracked_objects": self.tracked_objects,
            "unique_objects": self.unique_objects,
            "elapsed": round(self.elapsed, 2),
            "eta": round(self.eta, 1) if self.eta is not None else None,
        }


@dataclass
class AnalysisJob:
    id: str
    video_id: str
    config: AnalysisConfig
    status: str = "queued"
    progress: float = 0.0
    stats: JobStats = field(default_factory=JobStats)
    device: str = "cpu"
    model: str = ""
    error: Optional[dict] = None
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    stop_event: threading.Event = field(default_factory=threading.Event)
    thread: Optional[threading.Thread] = None

    @property
    def topic(self) -> str:
        return f"job:{self.id}"

    def state(self) -> dict:
        return {
            "id": self.id,
            "video_id": self.video_id,
            "status": self.status,
            "progress": round(self.progress, 4),
            "stats": self.stats.as_dict(),
            "config": self.config.model_dump(),
            "device": self.device,
            "model": self.model,
            "error": self.error,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
        }


class JobManager:
    def __init__(self) -> None:
        self._jobs: Dict[str, AnalysisJob] = {}
        self._by_video: Dict[str, str] = {}
        self._lock = threading.RLock()

    # ------------------------------------------------------------------ query

    def get(self, job_id: str) -> AnalysisJob:
        job = self._jobs.get(job_id)
        if job is None:
            raise NotFoundError(f"Job '{job_id}' does not exist.")
        return job

    def for_video(self, video_id: str) -> Optional[AnalysisJob]:
        job_id = self._by_video.get(video_id)
        return self._jobs.get(job_id) if job_id else None

    def list_jobs(self) -> List[dict]:
        return [job.state() for job in self._jobs.values()]

    # ------------------------------------------------------------------ start

    def start(self, video_id: str, config: AnalysisConfig) -> AnalysisJob:
        with self._lock:
            existing = self.for_video(video_id)
            if existing and existing.status in ("queued", "running", "stopping"):
                raise JobConflictError(
                    "This video is already being analysed.",
                    hint="Stop the running analysis before starting a new one.",
                    details={"job_id": existing.id},
                )
            video = storage.get_video(video_id)
            resolved = config.resolved()
            job = AnalysisJob(
                id=uuid.uuid4().hex[:12],
                video_id=video_id,
                config=resolved,
                model=resolved.model,
                device=device_report(resolved.device)["device_in_use"],
            )
            job.stats.video_fps = float(video["fps"])
            job.stats.frames_total = int(video["frame_count"])
            self._jobs[job.id] = job
            self._by_video[video_id] = job.id

        hub.clear(job.topic)
        job.thread = threading.Thread(
            target=self._run, args=(job, video), name=f"analysis-{job.id}", daemon=True
        )
        job.thread.start()
        return job

    def stop(self, job_id: str) -> AnalysisJob:
        job = self.get(job_id)
        if job.status in ("running", "queued"):
            job.status = "stopping"
            job.stop_event.set()
            self._emit_state(job)
        return job

    def stop_for_video(self, video_id: str) -> Optional[AnalysisJob]:
        job = self.for_video(video_id)
        return self.stop(job.id) if job else None

    # -------------------------------------------------------------- execution

    def _emit_state(self, job: AnalysisJob) -> None:
        hub.publish_threadsafe(job.topic, {"type": "state", "job": job.state()})

    def _run(self, job: AnalysisJob, video: dict) -> None:
        cfg = job.config
        job.status = "running"
        job.started_at = time.time()
        self._emit_state(job)

        try:
            detector = load_detector(cfg.model, cfg.device, cfg.tracker, cfg.max_lost_frames)
            job.device = detector.device
            job.model = cfg.model
            detector.reset()
            self._emit_state(job)
            self._process(job, video, detector)
        except VisionTrackError as exc:
            job.status = "failed"
            job.error = exc.to_dict()
            log.error("Job %s failed: %s", job.id, exc.message)
            hub.publish_threadsafe(job.topic, {"type": "error", "error": exc.to_dict()})
        except Exception as exc:  # unexpected - still surface something useful
            job.status = "failed"
            job.error = {
                "code": "internal_error",
                "message": f"Analysis crashed: {exc}",
                "hint": "See the backend console for the full traceback.",
                "details": traceback.format_exc(limit=4),
            }
            log.exception("Job %s crashed", job.id)
            hub.publish_threadsafe(job.topic, {"type": "error", "error": job.error})
        finally:
            job.finished_at = time.time()
            if job.status in ("running", "stopping"):
                job.status = "stopped" if job.stop_event.is_set() else "completed"
                if job.status == "completed":
                    # Containers often over-report frame_count by a frame or two.
                    job.progress = 1.0
                    job.stats.frames_total = job.stats.frames_processed
                    job.stats.eta = 0.0
            self._emit_state(job)
            hub.publish_threadsafe(job.topic, {"type": "done", "job": job.state()})

    def _process(self, job: AnalysisJob, video: dict, detector: Detector) -> None:
        cfg = job.config
        path = storage.video_path(job.video_id)
        fps = float(video["fps"]) or 25.0
        width, height = int(video["width"]), int(video["height"])
        total = int(video["frame_count"])
        detect_every_n = max(1, int(cfg.detect_every_n or 1))

        zones: List[Zone] = zone_store.load(job.video_id)
        registry = TrackRegistry(
            frame_height=height,
            trajectory_length=cfg.trajectory_length,
            stationary_speed_px=cfg.stationary_speed_px,
            lost_after_seconds=max(0.4, cfg.max_lost_frames / max(fps, 1.0)),
        )
        class_ids = detector.class_ids_for(cfg.classes)
        class_index: Dict[str, int] = {}
        samples: List[dict] = []

        start = time.perf_counter()
        last_preview = 0.0
        detections_done = 0
        decoded = 0

        with reader.open_capture(path) as cap:
            index = -1
            while not job.stop_event.is_set():
                ok = cap.grab()
                if not ok:
                    break
                index += 1
                decoded += 1

                if index % detect_every_n != 0:
                    continue

                ok, frame = cap.retrieve()
                if not ok or frame is None:
                    continue

                timestamp = index / fps
                small, scale = reader.scale_for_inference(frame, int(cfg.imgsz or 640))
                detections = detector.track(
                    small, conf=cfg.confidence, iou=cfg.iou,
                    imgsz=int(cfg.imgsz or 640), classes=class_ids,
                )
                if scale != 1.0:
                    for det in detections:
                        det.bbox = det.bbox * scale

                payloads = registry.update(detections, index, timestamp, zones, (width, height))
                detections_done += 1

                elapsed = time.perf_counter() - start
                job.stats.frames_processed = decoded
                job.stats.frames_total = total
                job.stats.elapsed = elapsed
                job.stats.processing_fps = decoded / elapsed if elapsed > 0 else 0.0
                job.stats.detection_fps = detections_done / elapsed if elapsed > 0 else 0.0
                job.stats.detections_last_frame = len(payloads)
                job.stats.tracked_objects = registry.active_count(timestamp, 1.0)
                job.stats.unique_objects = len(registry.tracks)
                job.progress = min(1.0, decoded / total) if total else 0.0
                if job.stats.processing_fps > 0 and total:
                    remaining = max(0, total - decoded)
                    job.stats.eta = remaining / job.stats.processing_fps

                samples.append(self._sample(index, timestamp, payloads, zones, class_index))

                event: Dict[str, Any] = {
                    "type": "frame",
                    "frame": index,
                    "timestamp": round(timestamp, 3),
                    "objects": payloads,
                    "stats": job.stats.as_dict(),
                    "progress": job.progress,
                }
                now = time.perf_counter()
                if cfg.preview and (now - last_preview) >= (1.0 / PREVIEW_MAX_FPS):
                    try:
                        jpeg = reader.encode_jpeg(frame, PREVIEW_WIDTH, PREVIEW_JPEG_QUALITY)
                        event["preview"] = base64.b64encode(jpeg).decode("ascii")
                        event["preview_size"] = [width, height]
                        last_preview = now
                    except Exception as exc:  # preview is best-effort only
                        log.debug("preview encode failed: %s", exc)
                hub.publish_threadsafe(job.topic, event)

                for zone_event in registry.drain_zone_events():
                    hub.publish_threadsafe(job.topic, zone_event)

        end_timestamp = (index / fps) if index >= 0 else 0.0
        registry.finalize(end_timestamp)
        for zone_event in registry.drain_zone_events():
            hub.publish_threadsafe(job.topic, zone_event)

        tracks = registry.summaries(include_trajectory=True)
        classes = sorted(class_index, key=lambda name: class_index[name])
        summary = {
            "video_id": job.video_id,
            "video_filename": video["filename"],
            "job_id": job.id,
            "completed_at": time.time(),
            "stopped_early": job.stop_event.is_set(),
            "frames_analyzed": detections_done,
            "frames_decoded": decoded,
            "duration_analyzed": round(end_timestamp, 3),
            "unique_objects": len(tracks),
            "class_counts": registry.class_counts(),
            "config": cfg.model_dump(),
            "device": job.device,
            "model": cfg.model,
            "fps": fps,
            "width": width,
            "height": height,
            "detect_every_n": detect_every_n,
            "zones": [z.as_dict() for z in zones],
            "speed_note": (
                "speed_px_per_s is image-space only; real-world speed requires camera "
                "calibration and is therefore reported as unavailable."
            ),
        }
        timeline = {
            "video_id": job.video_id,
            "fps": fps,
            "width": width,
            "height": height,
            "detect_every_n": detect_every_n,
            "classes": classes,
            "zone_ids": [z.id for z in zones],
            "samples": samples,
            "schema": "o = [id, class_idx, conf, x1, y1, x2, y2, status, zone_idx, zone_time]",
        }
        storage.save_results(job.video_id, {
            "tracks": tracks, "timeline": timeline, "summary": summary,
        })

    @staticmethod
    def _sample(index: int, timestamp: float, payloads: List[dict],
                zones: List[Zone], class_index: Dict[str, int]) -> dict:
        zone_ids = [z.id for z in zones]
        objects = []
        for obj in payloads:
            cls = obj["cls"]
            if cls not in class_index:
                class_index[cls] = len(class_index)
            zone_idx, zone_time = -1, 0.0
            for zinfo in obj.get("zones", []):
                if zinfo.get("inside"):
                    try:
                        zone_idx = zone_ids.index(zinfo["zone_id"])
                    except ValueError:
                        zone_idx = -1
                    zone_time = zinfo.get("total_time", 0.0)
                    break
            x1, y1, x2, y2 = obj["bbox"]
            objects.append([
                obj["id"], class_index[cls], round(obj["confidence"], 3),
                round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1),
                STATUS_CODES.get(obj["status"], 1), zone_idx, round(zone_time, 2),
            ])
        return {"f": index, "t": round(timestamp, 3), "o": objects}


job_manager = JobManager()

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

from pathlib import Path

from ..config import EXPORT_DIR, PREVIEW_JPEG_QUALITY, PREVIEW_WIDTH
from ..errors import CameraLostError, JobConflictError, NotFoundError, VisionTrackError
from ..models.detector import Detector, device_report, load_detector
from ..schemas import AnalysisConfig
from ..tracking.tracks import TrackRegistry
from ..tracking.zones import Zone, zone_store
from ..video import reader, renderer
from . import storage
from .cameras import resolve_source
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
    live: bool = False
    recording: Optional[str] = None
    stop_event: threading.Event = field(default_factory=threading.Event)
    thread: Optional[threading.Thread] = None

    @property
    def topic(self) -> str:
        return f"job:{self.id}"

    def state(self) -> dict:
        return {
            "id": self.id,
            "video_id": self.video_id,
            "live": self.live,
            "recording": self.recording,
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
            video = resolve_source(video_id)
            resolved = config.resolved()
            job = AnalysisJob(
                id=uuid.uuid4().hex[:12],
                video_id=video_id,
                config=resolved,
                model=resolved.model,
                device=device_report(resolved.device)["device_in_use"],
                live=video.get("kind") == "live",
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
                    job.progress = 1.0
                    job.stats.eta = 0.0
                    if not job.live:
                        # Containers over-report frame_count by a frame or two.
                        job.stats.frames_total = job.stats.frames_processed
            self._emit_state(job)
            hub.publish_threadsafe(job.topic, {"type": "done", "job": job.state()})

    # ---------------------------------------------------------------- sources

    def _process(self, job: AnalysisJob, source: dict, detector: Detector) -> None:
        if source.get("kind") == "live":
            self._process_live(job, source, detector)
        else:
            self._process_file(job, source, detector)

    def _prepare(self, job: AnalysisJob, source: dict, detector: Detector):
        """Shared per-run setup: registry, zones, class filter, sample buffer."""
        cfg = job.config
        fps = float(source["fps"]) or 25.0
        height = int(source["height"])
        zones: List[Zone] = zone_store.load(job.video_id)
        registry = TrackRegistry(
            frame_height=height,
            trajectory_length=cfg.trajectory_length,
            stationary_speed_px=cfg.stationary_speed_px,
            lost_after_seconds=max(0.4, cfg.max_lost_frames / max(fps, 1.0)),
        )
        return registry, zones, detector.class_ids_for(cfg.classes), {}, []

    def _analyze_frame(self, job, detector, registry, frame, index, timestamp,
                       zones, size, class_ids, class_index, samples):
        """Detect + track one frame and fold it into the run's state."""
        cfg = job.config
        small, scale = reader.scale_for_inference(frame, int(cfg.imgsz or 640))
        detections = detector.track(
            small, conf=cfg.confidence, iou=cfg.iou,
            imgsz=int(cfg.imgsz or 640), classes=class_ids,
        )
        if scale != 1.0:
            for det in detections:
                det.bbox = det.bbox * scale

        payloads = registry.update(detections, index, timestamp, zones, size)
        samples.append(self._sample(index, timestamp, payloads, zones, class_index))
        return payloads

    def _publish_frame(self, job, frame, index, timestamp, payloads, size,
                       last_preview: float) -> float:
        """Emit one websocket frame event, attaching a preview when due."""
        cfg = job.config
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
                event["preview_size"] = list(size)
                last_preview = now
            except Exception as exc:  # preview is best-effort only
                log.debug("preview encode failed: %s", exc)
        hub.publish_threadsafe(job.topic, event)
        return last_preview

    # ------------------------------------------------------------ file source

    def _process_file(self, job: AnalysisJob, video: dict, detector: Detector) -> None:
        cfg = job.config
        path = storage.video_path(job.video_id)
        fps = float(video["fps"]) or 25.0
        width, height = int(video["width"]), int(video["height"])
        total = int(video["frame_count"])
        detect_every_n = max(1, int(cfg.detect_every_n or 1))

        registry, zones, class_ids, class_index, samples = self._prepare(job, video, detector)
        start = time.perf_counter()
        last_preview = 0.0
        detections_done = 0
        decoded = 0
        index = -1

        with reader.open_capture(path) as cap:
            while not job.stop_event.is_set():
                ok = cap.grab()
                if not ok:
                    break
                index += 1
                decoded += 1

                timestamp = index / fps
                if cfg.max_duration is not None and timestamp > cfg.max_duration:
                    break
                if index % detect_every_n != 0:
                    continue

                ok, frame = cap.retrieve()
                if not ok or frame is None:
                    continue

                payloads = self._analyze_frame(
                    job, detector, registry, frame, index, timestamp, zones,
                    (width, height), class_ids, class_index, samples,
                )
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
                    job.stats.eta = max(0, total - decoded) / job.stats.processing_fps

                last_preview = self._publish_frame(
                    job, frame, index, timestamp, payloads, (width, height), last_preview,
                )
                for zone_event in registry.drain_zone_events():
                    hub.publish_threadsafe(job.topic, zone_event)

        end_timestamp = (index / fps) if index >= 0 else 0.0
        self._finalize(job, video, registry, zones, samples, class_index,
                       end_timestamp, detections_done, decoded, fps, detect_every_n)

    # ------------------------------------------------------------ live source

    def _process_live(self, job: AnalysisJob, camera: dict, detector: Detector) -> None:
        """Read a webcam or stream until the user stops it or the limit is hit.

        Timestamps come from the wall clock, because a live feed has no frame
        index to divide by: what matters is how long an object has really been
        in view.
        """
        cfg = job.config
        width, height = int(camera["width"]), int(camera["height"])
        fps = float(camera["fps"]) or 15.0
        detect_every_n = max(1, int(cfg.detect_every_n or 1))

        registry, zones, class_ids, class_index, samples = self._prepare(job, camera, detector)
        writer = None
        record_path: Optional[Path] = None
        if cfg.record:
            record_path = EXPORT_DIR / f"{job.video_id}_{int(time.time())}_live.mp4"
            writer = cv2.VideoWriter(
                str(record_path), cv2.VideoWriter_fourcc(*"mp4v"),
                max(1.0, fps / detect_every_n), (width, height),
            )
            if not writer.isOpened():
                log.warning("Could not open a recorder for %s; continuing without it", record_path)
                writer, record_path = None, None
            else:
                job.recording = str(record_path)

        start = time.perf_counter()
        last_preview = 0.0
        detections_done = 0
        grabbed = 0
        index = -1
        timestamp = 0.0
        empty_reads = 0

        cap = reader.open_source(camera["source"], width=width, height=height)
        try:
            while not job.stop_event.is_set():
                ok, frame = cap.read()
                if not ok or frame is None:
                    empty_reads += 1
                    # A dropped frame happens; a dead feed does not recover.
                    if empty_reads > 60:
                        raise CameraLostError(
                            f"Lost the feed from '{camera['filename']}'.",
                            hint="Check the cable, or that no other app took the camera.",
                        )
                    time.sleep(0.02)
                    continue
                empty_reads = 0
                index += 1
                grabbed += 1
                timestamp = time.perf_counter() - start

                if cfg.max_duration is not None and timestamp >= cfg.max_duration:
                    break
                if index % detect_every_n != 0:
                    continue

                payloads = self._analyze_frame(
                    job, detector, registry, frame, index, timestamp, zones,
                    (width, height), class_ids, class_index, samples,
                )
                detections_done += 1

                elapsed = max(1e-6, time.perf_counter() - start)
                job.stats.frames_processed = grabbed
                job.stats.frames_total = 0  # a live feed has no length
                job.stats.elapsed = elapsed
                job.stats.processing_fps = grabbed / elapsed
                job.stats.detection_fps = detections_done / elapsed
                job.stats.detections_last_frame = len(payloads)
                job.stats.tracked_objects = registry.active_count(timestamp, 1.0)
                job.stats.unique_objects = len(registry.tracks)
                job.stats.video_fps = fps
                job.progress = (min(1.0, timestamp / cfg.max_duration)
                                if cfg.max_duration else 0.0)
                job.stats.eta = (max(0.0, cfg.max_duration - timestamp)
                                 if cfg.max_duration else None)

                if writer is not None:
                    annotated = frame.copy()
                    renderer.draw_zones(annotated, zones)
                    renderer.draw_objects(
                        annotated, payloads,
                        trails={t.id: [(x, y) for x, y, _ in t.trajectory]
                                for t in registry.tracks.values()},
                    )
                    renderer.draw_hud(
                        annotated, timestamp=timestamp, frame_index=index,
                        tracked=len(payloads), unique=len(registry.tracks),
                        fps=job.stats.detection_fps, source_name=camera["filename"],
                    )
                    writer.write(annotated)

                last_preview = self._publish_frame(
                    job, frame, index, timestamp, payloads, (width, height), last_preview,
                )
                for zone_event in registry.drain_zone_events():
                    hub.publish_threadsafe(job.topic, zone_event)
        finally:
            cap.release()
            if writer is not None:
                writer.release()

        self._finalize(job, camera, registry, zones, samples, class_index,
                       timestamp, detections_done, grabbed, fps, detect_every_n)

    # -------------------------------------------------------------- finishing

    def _finalize(self, job, source, registry, zones, samples, class_index,
                  end_timestamp, detections_done, decoded, fps, detect_every_n) -> None:
        registry.finalize(end_timestamp)
        for zone_event in registry.drain_zone_events():
            hub.publish_threadsafe(job.topic, zone_event)

        cfg = job.config
        tracks = registry.summaries(include_trajectory=True)
        classes = sorted(class_index, key=lambda name: class_index[name])
        live = source.get("kind") == "live"
        summary = {
            "video_id": job.video_id,
            "video_filename": source["filename"],
            "kind": source.get("kind", "file"),
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
            "width": int(source["width"]),
            "height": int(source["height"]),
            "detect_every_n": detect_every_n,
            "zones": [z.as_dict() for z in zones],
            "recording": job.recording,
            "speed_note": (
                "speed_px_per_s is image-space only; real-world speed requires camera "
                "calibration and is therefore reported as unavailable."
            ),
        }
        timeline = {
            "video_id": job.video_id,
            "fps": fps,
            "width": int(source["width"]),
            "height": int(source["height"]),
            "detect_every_n": detect_every_n,
            "classes": classes,
            "zone_ids": [z.id for z in zones],
            "samples": samples,
            "live": live,
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

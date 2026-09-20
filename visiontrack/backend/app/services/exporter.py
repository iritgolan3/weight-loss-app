"""Exports: annotated MP4, detection CSV and tracking JSON.

The annotated video is re-rendered from the stored timeline, so it always
matches what the UI showed -- no second inference pass, no drift.
"""
from __future__ import annotations

import csv
import json
import logging
import threading
import time
import traceback
import uuid
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Deque, Dict, List, Optional, Tuple

import cv2

from ..config import EXPORT_DIR
from ..errors import AnalysisRequiredError, ExportError, NotFoundError
from ..tracking.zones import Zone
from ..video import reader, renderer
from . import storage
from .events import hub

log = logging.getLogger("visiontrack.export")

STATUS_NAMES = {0: "stationary", 1: "moving"}


# --------------------------------------------------------------- data exports

def export_json(video_id: str) -> Path:
    video = storage.get_video(video_id)
    tracks = storage.load_tracks(video_id)
    summary = storage.results_summary(video_id) or {}
    payload = {
        "video": video["filename"],
        "video_id": video_id,
        "width": video["width"],
        "height": video["height"],
        "fps": video["fps"],
        "duration": video["duration"],
        "exported_at": time.time(),
        "analysis": summary,
        "objects": tracks,
    }
    out = EXPORT_DIR / f"{Path(video['filename']).stem}_{video_id}_tracks.json"
    out.write_text(json.dumps(payload, indent=2))
    return out


def export_csv(video_id: str, dataset: str = "detections") -> Path:
    video = storage.get_video(video_id)
    stem = f"{Path(video['filename']).stem}_{video_id}"

    if dataset == "tracks":
        tracks = storage.load_tracks(video_id)
        out = EXPORT_DIR / f"{stem}_tracks.csv"
        with out.open("w", newline="", encoding="utf-8") as fh:
            writer = csv.writer(fh)
            writer.writerow([
                "track_id", "class", "last_confidence", "max_confidence",
                "first_seen_s", "last_seen_s", "visible_duration_s",
                "first_frame", "last_frame", "samples", "status",
                "speed_px_per_s", "speed_real_world",
                "zones_visited", "total_zone_time_s",
            ])
            for t in tracks:
                zone_names = ";".join(z["zone_name"] for z in t.get("zones", []) if z["entries"])
                zone_total = sum(z["total_time"] for z in t.get("zones", []))
                writer.writerow([
                    t["id"], t["cls"], t["confidence"], t["max_confidence"],
                    t["first_seen"], t["last_seen"], t["visible_duration"],
                    t["first_frame"], t["last_frame"], t["samples"], t["status"],
                    t.get("speed_px_per_s", ""), "unavailable",
                    zone_names, round(zone_total, 3),
                ])
        return out

    timeline = storage.load_timeline(video_id)
    classes = timeline.get("classes", [])
    zone_ids = timeline.get("zone_ids", [])
    zone_names = {z["id"]: z["name"] for z in (storage.results_summary(video_id) or {}).get("zones", [])}
    out = EXPORT_DIR / f"{stem}_detections.csv"
    with out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow([
            "frame", "timestamp_s", "track_id", "class", "confidence",
            "x1", "y1", "x2", "y2", "center_x", "center_y",
            "status", "zone", "zone_time_s",
        ])
        for sample in timeline.get("samples", []):
            for obj in sample["o"]:
                tid, cidx, conf, x1, y1, x2, y2, status, zidx, ztime = obj
                zone_label = ""
                if 0 <= zidx < len(zone_ids):
                    zone_label = zone_names.get(zone_ids[zidx], zone_ids[zidx])
                writer.writerow([
                    sample["f"], sample["t"], tid,
                    classes[cidx] if cidx < len(classes) else cidx,
                    conf, x1, y1, x2, y2,
                    round((x1 + x2) / 2, 1), round((y1 + y2) / 2, 1),
                    STATUS_NAMES.get(status, "moving"), zone_label, ztime,
                ])
    return out


# ------------------------------------------------------------- video export

@dataclass
class ExportJob:
    id: str
    video_id: str
    status: str = "running"
    progress: float = 0.0
    output: Optional[str] = None
    error: Optional[dict] = None
    started_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None
    thread: Optional[threading.Thread] = None

    @property
    def topic(self) -> str:
        return f"export:{self.id}"

    def state(self) -> dict:
        return {
            "id": self.id,
            "video_id": self.video_id,
            "status": self.status,
            "progress": round(self.progress, 4),
            "output": self.output,
            "filename": Path(self.output).name if self.output else None,
            "error": self.error,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
        }


class VideoExporter:
    def __init__(self) -> None:
        self._jobs: Dict[str, ExportJob] = {}

    def get(self, export_id: str) -> ExportJob:
        job = self._jobs.get(export_id)
        if job is None:
            raise NotFoundError(f"Export job '{export_id}' does not exist.")
        return job

    def start(self, video_id: str, options: dict) -> ExportJob:
        video = storage.get_video(video_id)
        if not video.get("analyzed"):
            raise AnalysisRequiredError(
                "Run an analysis before exporting an annotated video.",
                hint="Press START ANALYSIS, then export.",
            )
        job = ExportJob(id=uuid.uuid4().hex[:12], video_id=video_id)
        self._jobs[job.id] = job
        job.thread = threading.Thread(
            target=self._run, args=(job, video, options), daemon=True,
            name=f"export-{job.id}",
        )
        job.thread.start()
        return job

    def _run(self, job: ExportJob, video: dict, options: dict) -> None:
        try:
            output = self._render(job, video, options)
            job.output = str(output)
            job.status = "completed"
            job.progress = 1.0
        except (ExportError, NotFoundError, AnalysisRequiredError) as exc:
            job.status = "failed"
            job.error = exc.to_dict()
            log.error("Export %s failed: %s", job.id, exc.message)
        except Exception as exc:
            job.status = "failed"
            job.error = {
                "code": "export_failed",
                "message": f"Export crashed: {exc}",
                "hint": "See the backend console for details.",
                "details": traceback.format_exc(limit=4),
            }
            log.exception("Export %s crashed", job.id)
        finally:
            job.finished_at = time.time()
            hub.publish_threadsafe(job.topic, {"type": "export", "job": job.state()})

    def _render(self, job: ExportJob, video: dict, options: dict) -> Path:
        timeline = storage.load_timeline(job.video_id)
        summary = storage.results_summary(job.video_id) or {}
        samples: List[dict] = timeline.get("samples", [])
        if not samples:
            raise ExportError(
                "The stored analysis contains no frames to render.",
                hint="Re-run the analysis.",
            )

        classes: List[str] = timeline.get("classes", [])
        zone_ids: List[str] = timeline.get("zone_ids", [])
        zones = [
            Zone(id=z["id"], name=z["name"],
                 points=[(p[0], p[1]) for p in z["points"]],
                 color=z.get("color", "#39ff14"), visible=z.get("visible", True))
            for z in summary.get("zones", [])
        ]

        # first_seen per track, so the export can show the same "visible for"
        # timers the live UI does.
        first_seen = {t["id"]: t["first_seen"] for t in storage.load_tracks(job.video_id)}

        trail_len = int(options.get("trajectory_length", 60))
        selected_id = options.get("selected_id")
        path = storage.video_path(job.video_id)
        fps = float(video["fps"]) or 25.0
        width, height = int(video["width"]), int(video["height"])

        out_path = EXPORT_DIR / (
            f"{Path(video['filename']).stem}_{job.video_id}_annotated.mp4"
        )
        writer = cv2.VideoWriter(str(out_path), cv2.VideoWriter_fourcc(*"mp4v"),
                                 fps, (width, height))
        if not writer.isOpened():
            raise ExportError(
                "OpenCV could not open an MP4 writer.",
                hint="Your OpenCV build may lack the mp4v encoder. "
                     "Try `pip install --force-reinstall opencv-python`.",
            )

        trails: Dict[int, Deque[Tuple[float, float]]] = {}
        sample_idx = 0
        current = samples[0]
        frames_total = int(video["frame_count"]) or samples[-1]["f"] + 1
        written = 0

        try:
            with reader.open_capture(path) as cap:
                index = -1
                while True:
                    ok, frame = cap.read()
                    if not ok or frame is None:
                        break
                    index += 1

                    # Advance to the most recent analysed sample at/ before this frame.
                    while sample_idx + 1 < len(samples) and samples[sample_idx + 1]["f"] <= index:
                        sample_idx += 1
                        current = samples[sample_idx]
                        self._extend_trails(trails, current, trail_len)
                    if sample_idx == 0 and index == current["f"]:
                        self._extend_trails(trails, current, trail_len)

                    objects = self._objects_for(current, classes, zone_ids, zones, first_seen)
                    renderer.draw_zones(frame, zones, show=options.get("show_zones", True))
                    renderer.draw_objects(
                        frame, objects,
                        trails={tid: list(pts) for tid, pts in trails.items()},
                        selected_id=selected_id,
                        show_boxes=options.get("show_boxes", True),
                        show_labels=options.get("show_labels", True),
                        show_confidence=options.get("show_confidence", True),
                        show_trajectories=options.get("show_trajectories", True),
                        show_timers=options.get("show_timers", True),
                        trajectory_color=options.get("trajectory_color", "#39ff14"),
                        selected_color=options.get("selected_color", "#ff2bd1"),
                        thickness=int(options.get("trajectory_thickness", 2)),
                    )
                    if options.get("show_hud", True):
                        renderer.draw_hud(
                            frame,
                            timestamp=index / fps,
                            frame_index=index,
                            tracked=len(objects),
                            unique=summary.get("unique_objects", 0),
                            source_name=video["filename"],
                        )
                    writer.write(frame)
                    written += 1

                    if frames_total and written % 15 == 0:
                        job.progress = min(0.999, written / frames_total)
                        hub.publish_threadsafe(job.topic, {"type": "export", "job": job.state()})
        finally:
            writer.release()

        if written == 0 or not out_path.exists() or out_path.stat().st_size == 0:
            raise ExportError(
                "The annotated video came out empty.",
                hint="Check that the source file is still present and readable.",
            )
        return out_path

    @staticmethod
    def _extend_trails(trails: Dict[int, Deque[Tuple[float, float]]],
                       sample: dict, trail_len: int) -> None:
        present = set()
        for obj in sample["o"]:
            tid, _c, _conf, x1, y1, x2, y2 = obj[:7]
            present.add(tid)
            trail = trails.setdefault(tid, deque(maxlen=max(2, trail_len)))
            trail.append(((x1 + x2) / 2.0, (y1 + y2) / 2.0))
        for tid in list(trails):
            if tid not in present:
                trails.pop(tid, None)

    @staticmethod
    def _objects_for(sample: dict, classes: List[str], zone_ids: List[str],
                     zones: List[Zone], first_seen: Dict[int, float]) -> List[dict]:
        zone_names = {z.id: z.name for z in zones}
        out = []
        for obj in sample["o"]:
            tid, cidx, conf, x1, y1, x2, y2, status, zidx, ztime = obj
            zone_info = []
            if 0 <= zidx < len(zone_ids):
                zid = zone_ids[zidx]
                zone_info.append({
                    "zone_id": zid,
                    "zone_name": zone_names.get(zid, zid),
                    "inside": True,
                    "total_time": ztime,
                })
            out.append({
                "id": tid,
                "cls": classes[cidx] if cidx < len(classes) else str(cidx),
                "confidence": conf,
                "bbox": [x1, y1, x2, y2],
                "center": [(x1 + x2) / 2.0, (y1 + y2) / 2.0],
                "status": STATUS_NAMES.get(status, "moving"),
                "visible_duration": max(0.0, sample["t"] - first_seen.get(tid, sample["t"])),
                "zones": zone_info,
            })
        return out


video_exporter = VideoExporter()

"""Per-track state accumulated across a run.

The tracker (ByteTrack/BoT-SORT) only hands us an id per frame. Everything the
UI shows -- first/last seen, visible duration, trajectory, dwell time, movement
status -- is derived here from real frame timestamps.
"""
from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List, Optional, Sequence, Tuple

from ..models.detector import Detection
from .zones import Zone, ZoneResidency

# Upper bound on stored trajectory points per track, so a long video cannot
# exhaust memory. Older points are thinned, never fabricated.
MAX_STORED_POINTS = 4000
# Window used for the speed estimate.
SPEED_WINDOW_SECONDS = 0.6


@dataclass
class TrackState:
    id: int
    cls_name: str
    cls_id: int
    confidence: float
    max_confidence: float
    first_seen: float
    last_seen: float
    first_frame: int
    last_frame: int
    bbox: Tuple[float, float, float, float]
    samples: int = 1
    trajectory: Deque[Tuple[float, float, float]] = field(default_factory=lambda: deque(maxlen=600))
    full_trajectory: List[Tuple[float, float, float]] = field(default_factory=list)
    zone_states: Dict[str, ZoneResidency] = field(default_factory=dict)
    speed_px_per_s: Optional[float] = None
    status: str = "moving"
    _thin_stride: int = 1

    @property
    def center(self) -> Tuple[float, float]:
        x1, y1, x2, y2 = self.bbox
        return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)

    @property
    def visible_duration(self) -> float:
        return max(0.0, self.last_seen - self.first_seen)

    def record_point(self, x: float, y: float, t: float) -> None:
        self.trajectory.append((x, y, t))
        if len(self.full_trajectory) >= MAX_STORED_POINTS:
            # Halve the resolution of the stored path instead of dropping the tail.
            self.full_trajectory = self.full_trajectory[::2]
            self._thin_stride *= 2
        if self.samples % self._thin_stride == 0:
            self.full_trajectory.append((x, y, t))


class TrackRegistry:
    """Owns every TrackState for one analysis run."""

    def __init__(
        self,
        *,
        frame_height: int,
        trajectory_length: int = 60,
        stationary_speed_px: float = 18.0,
        lost_after_seconds: float = 1.0,
    ):
        self.tracks: Dict[int, TrackState] = {}
        self.frame_height = max(1, frame_height)
        self.trajectory_length = trajectory_length
        # Threshold scales with resolution so the same knob works for 480p and 4K.
        self.stationary_speed_px = stationary_speed_px * (self.frame_height / 1080.0)
        self.lost_after_seconds = lost_after_seconds
        self.last_timestamp = 0.0
        self.zone_events: List[dict] = []

    # ------------------------------------------------------------------ update

    def update(
        self,
        detections: Sequence[Detection],
        frame_index: int,
        timestamp: float,
        zones: Sequence[Zone],
        frame_size: Tuple[int, int],
    ) -> List[dict]:
        """Fold one frame of detections into the registry.

        Returns the per-object payloads for this frame (websocket + timeline).
        """
        self.last_timestamp = timestamp
        width, height = frame_size
        seen_ids = set()
        payloads: List[dict] = []

        for det in detections:
            seen_ids.add(det.track_id)
            x1, y1, x2, y2 = (float(v) for v in det.bbox)
            track = self.tracks.get(det.track_id)
            if track is None:
                track = TrackState(
                    id=det.track_id,
                    cls_name=det.cls_name,
                    cls_id=det.cls_id,
                    confidence=det.confidence,
                    max_confidence=det.confidence,
                    first_seen=timestamp,
                    last_seen=timestamp,
                    first_frame=frame_index,
                    last_frame=frame_index,
                    bbox=(x1, y1, x2, y2),
                    trajectory=deque(maxlen=max(2, self.trajectory_length)),
                )
                self.tracks[det.track_id] = track
            else:
                track.confidence = det.confidence
                track.max_confidence = max(track.max_confidence, det.confidence)
                track.last_seen = timestamp
                track.last_frame = frame_index
                track.bbox = (x1, y1, x2, y2)
                track.samples += 1
                # A tracker can re-assign a class as confidence shifts; keep the
                # most recent one but never invent a class.
                track.cls_name = det.cls_name
                track.cls_id = det.cls_id

            cx, cy = track.center
            track.record_point(cx, cy, timestamp)
            track.speed_px_per_s = self._estimate_speed(track)
            track.status = self._classify_status(track)

            self._update_zones(track, zones, cx / max(1, width), cy / max(1, height), timestamp)
            payloads.append(self.to_payload(track, timestamp))

        # Close zone residency for tracks that vanished for long enough.
        for track in self.tracks.values():
            if track.id in seen_ids:
                continue
            if timestamp - track.last_seen >= self.lost_after_seconds:
                for res in track.zone_states.values():
                    if res.inside:
                        res.close(track.last_seen)
                        self.zone_events.append({
                            "type": "zone_event",
                            "event": "exit",
                            "zone_id": res.zone_id,
                            "zone_name": res.zone_name,
                            "track_id": track.id,
                            "cls": track.cls_name,
                            "timestamp": track.last_seen,
                            "total_time": round(res.total_time(track.last_seen), 3),
                            "reason": "track_lost",
                        })
        return payloads

    def _update_zones(self, track: TrackState, zones: Sequence[Zone],
                      nx: float, ny: float, timestamp: float) -> None:
        active_ids = set()
        for zone in zones:
            active_ids.add(zone.id)
            res = track.zone_states.get(zone.id)
            if res is None:
                res = ZoneResidency(zone_id=zone.id, zone_name=zone.name)
                track.zone_states[zone.id] = res
            res.zone_name = zone.name
            changed = res.update(zone.contains(nx, ny), timestamp)
            if changed:
                self.zone_events.append({
                    "type": "zone_event",
                    "event": changed,
                    "zone_id": zone.id,
                    "zone_name": zone.name,
                    "track_id": track.id,
                    "cls": track.cls_name,
                    "timestamp": timestamp,
                    "total_time": round(res.total_time(timestamp), 3),
                })
        # Drop residency for zones the user deleted mid-run.
        for zid in list(track.zone_states):
            if zid not in active_ids:
                track.zone_states.pop(zid, None)

    # ----------------------------------------------------------------- derived

    def _estimate_speed(self, track: TrackState) -> Optional[float]:
        """Centre-point speed in source pixels/second, or None if not measurable.

        This is an image-space quantity. Converting it to km/h would require
        camera calibration we do not have, so real-world speed is reported as
        unavailable rather than guessed.
        """
        pts = track.trajectory
        if len(pts) < 2:
            return None
        newest = pts[-1]
        oldest = newest
        for point in reversed(pts):
            oldest = point
            if newest[2] - point[2] >= SPEED_WINDOW_SECONDS:
                break
        dt = newest[2] - oldest[2]
        if dt <= 1e-6:
            return None
        dist = math.hypot(newest[0] - oldest[0], newest[1] - oldest[1])
        return dist / dt

    def _classify_status(self, track: TrackState) -> str:
        if track.speed_px_per_s is None:
            return "moving" if track.samples <= 2 else "stationary"
        return "moving" if track.speed_px_per_s > self.stationary_speed_px else "stationary"

    # ---------------------------------------------------------------- payloads

    def to_payload(self, track: TrackState, now: float) -> dict:
        cx, cy = track.center
        return {
            "id": track.id,
            "cls": track.cls_name,
            "confidence": round(track.confidence, 4),
            "bbox": [round(v, 2) for v in track.bbox],
            "center": [round(cx, 2), round(cy, 2)],
            "first_seen": round(track.first_seen, 3),
            "last_seen": round(track.last_seen, 3),
            "visible_duration": round(track.visible_duration, 3),
            "status": track.status,
            "speed_px_per_s": (round(track.speed_px_per_s, 2)
                               if track.speed_px_per_s is not None else None),
            "speed_real_world": None,
            "zones": [res.as_dict(now) for res in track.zone_states.values()],
        }

    def summaries(self, include_trajectory: bool = True) -> List[dict]:
        now = self.last_timestamp
        out: List[dict] = []
        for track in sorted(self.tracks.values(), key=lambda t: t.id):
            item = {
                "id": track.id,
                "cls": track.cls_name,
                "confidence": round(track.confidence, 4),
                "max_confidence": round(track.max_confidence, 4),
                "first_seen": round(track.first_seen, 3),
                "last_seen": round(track.last_seen, 3),
                "first_frame": track.first_frame,
                "last_frame": track.last_frame,
                "visible_duration": round(track.visible_duration, 3),
                "samples": track.samples,
                "status": track.status,
                "last_bbox": [round(v, 2) for v in track.bbox],
                "speed_px_per_s": (round(track.speed_px_per_s, 2)
                                   if track.speed_px_per_s is not None else None),
                "speed_real_world": None,
                "zones": [res.as_dict(now) for res in track.zone_states.values()],
            }
            if include_trajectory:
                item["trajectory"] = [
                    {"x": round(x, 1), "y": round(y, 1), "time": round(t, 3)}
                    for x, y, t in track.full_trajectory
                ]
            out.append(item)
        return out

    def finalize(self, end_timestamp: float) -> None:
        """Close any open zone residency at the end of the run."""
        for track in self.tracks.values():
            for res in track.zone_states.values():
                res.close(min(end_timestamp, track.last_seen))

    def active_count(self, timestamp: float, window: float = 0.5) -> int:
        return sum(1 for t in self.tracks.values() if timestamp - t.last_seen <= window)

    def class_counts(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for track in self.tracks.values():
            counts[track.cls_name] = counts.get(track.cls_name, 0) + 1
        return counts

    def drain_zone_events(self) -> List[dict]:
        events, self.zone_events = self.zone_events, []
        return events

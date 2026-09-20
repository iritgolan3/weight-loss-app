"""Polygon zones and per-object dwell-time accounting.

Zone polygons are stored in normalised coordinates (0..1) so they stay valid if
the same video is re-analysed at a different processing resolution.
"""
from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

from ..config import ZONES_DIR
from ..errors import InvalidZoneError


@dataclass
class Zone:
    id: str
    name: str
    points: List[Tuple[float, float]]
    color: str = "#39ff14"
    visible: bool = True

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "color": self.color,
            "visible": self.visible,
            "points": [[float(x), float(y)] for x, y in self.points],
        }

    def contains(self, nx: float, ny: float) -> bool:
        """Ray-casting point-in-polygon on normalised coordinates."""
        pts = self.points
        n = len(pts)
        if n < 3:
            return False
        inside = False
        j = n - 1
        for i in range(n):
            xi, yi = pts[i]
            xj, yj = pts[j]
            if (yi > ny) != (yj > ny):
                denom = (yj - yi) or 1e-12
                x_cross = xi + (ny - yi) * (xj - xi) / denom
                if x_cross > nx:
                    inside = not inside
            j = i
        return inside


@dataclass
class ZoneResidency:
    """Dwell-time bookkeeping for one (track, zone) pair."""

    zone_id: str
    zone_name: str
    inside: bool = False
    entered_at: Optional[float] = None
    exited_at: Optional[float] = None
    accumulated: float = 0.0
    entries: int = 0
    history: List[Dict[str, Optional[float]]] = field(default_factory=list)

    def update(self, is_inside: bool, timestamp: float) -> Optional[str]:
        """Advance the state machine. Returns 'enter'/'exit' when it changed."""
        if is_inside and not self.inside:
            self.inside = True
            self.entered_at = timestamp
            self.entries += 1
            self.history.append({"enter": timestamp, "exit": None})
            return "enter"
        if not is_inside and self.inside:
            self.inside = False
            self.exited_at = timestamp
            if self.entered_at is not None:
                self.accumulated += max(0.0, timestamp - self.entered_at)
            if self.history:
                self.history[-1]["exit"] = timestamp
            return "exit"
        return None

    def close(self, timestamp: float) -> None:
        """Called when the track ends while still inside the zone."""
        if self.inside and self.entered_at is not None:
            self.accumulated += max(0.0, timestamp - self.entered_at)
            self.inside = False
            self.exited_at = timestamp
            if self.history:
                self.history[-1]["exit"] = timestamp

    def total_time(self, now: float) -> float:
        total = self.accumulated
        if self.inside and self.entered_at is not None:
            total += max(0.0, now - self.entered_at)
        return total

    def as_dict(self, now: float) -> dict:
        return {
            "zone_id": self.zone_id,
            "zone_name": self.zone_name,
            "inside": self.inside,
            "entered_at": self.entered_at,
            "exited_at": self.exited_at,
            "total_time": round(self.total_time(now), 3),
            "entries": self.entries,
        }


def _validate(points: Sequence[Sequence[float]]) -> List[Tuple[float, float]]:
    if len(points) < 3:
        raise InvalidZoneError(
            "A zone needs at least 3 points.",
            hint="Click at least three times on the video to close a polygon.",
        )
    cleaned: List[Tuple[float, float]] = []
    for p in points:
        if len(p) != 2:
            raise InvalidZoneError("Zone points must be [x, y] pairs in the 0..1 range.")
        x, y = float(p[0]), float(p[1])
        if not (-0.01 <= x <= 1.01 and -0.01 <= y <= 1.01):
            raise InvalidZoneError(
                "Zone points must be normalised to the 0..1 range.",
                details={"point": [x, y]},
            )
        cleaned.append((min(max(x, 0.0), 1.0), min(max(y, 0.0), 1.0)))
    return cleaned


class ZoneStore:
    """JSON-backed zone persistence, one file per video."""

    def __init__(self, base_dir: Path = ZONES_DIR):
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _path(self, video_id: str) -> Path:
        return self.base_dir / f"{video_id}.json"

    def load(self, video_id: str) -> List[Zone]:
        path = self._path(video_id)
        if not path.exists():
            return []
        try:
            payload = json.loads(path.read_text())
        except json.JSONDecodeError as exc:
            raise InvalidZoneError(
                f"Zone file for this video is corrupt: {path.name}",
                hint="Delete the file to start over.",
                details=str(exc),
            ) from exc
        zones: List[Zone] = []
        for z in payload.get("zones", []):
            zones.append(
                Zone(
                    id=z["id"],
                    name=z.get("name", "Zone"),
                    points=[(float(x), float(y)) for x, y in z.get("points", [])],
                    color=z.get("color", "#39ff14"),
                    visible=bool(z.get("visible", True)),
                )
            )
        return zones

    def save(self, video_id: str, zones: List[Zone]) -> None:
        payload = {"video_id": video_id, "zones": [z.as_dict() for z in zones]}
        self._path(video_id).write_text(json.dumps(payload, indent=2))

    def create(self, video_id: str, name: str, points: Sequence[Sequence[float]],
               color: str = "#39ff14") -> Zone:
        zones = self.load(video_id)
        zone = Zone(id=uuid.uuid4().hex[:8], name=name or f"Zone {len(zones) + 1}",
                    points=_validate(points), color=color)
        zones.append(zone)
        self.save(video_id, zones)
        return zone

    def update(self, video_id: str, zone_id: str, **changes) -> Zone:
        zones = self.load(video_id)
        for zone in zones:
            if zone.id == zone_id:
                if "name" in changes and changes["name"] is not None:
                    zone.name = str(changes["name"])
                if "color" in changes and changes["color"] is not None:
                    zone.color = str(changes["color"])
                if "visible" in changes and changes["visible"] is not None:
                    zone.visible = bool(changes["visible"])
                if changes.get("points") is not None:
                    zone.points = _validate(changes["points"])
                self.save(video_id, zones)
                return zone
        raise InvalidZoneError(f"Zone '{zone_id}' does not exist for this video.")

    def delete(self, video_id: str, zone_id: str) -> None:
        zones = self.load(video_id)
        remaining = [z for z in zones if z.id != zone_id]
        if len(remaining) == len(zones):
            raise InvalidZoneError(f"Zone '{zone_id}' does not exist for this video.")
        self.save(video_id, remaining)


zone_store = ZoneStore()

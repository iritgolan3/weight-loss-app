"""Overlay rendering for the exported annotated video.

Mirrors the canvas renderer in the frontend so an exported MP4 looks like what
the operator saw on screen: neon-green boxes, monospace ID chips, trajectory
trails, zone polygons and dwell timers.
"""
from __future__ import annotations

from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import cv2
import numpy as np

NEON = (20, 255, 57)        # BGR neon green
NEON_DIM = (40, 180, 60)
MAGENTA = (209, 43, 255)    # BGR magenta
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
ZONE_FILL_ALPHA = 0.10

FONT = cv2.FONT_HERSHEY_DUPLEX


def _hex_to_bgr(value: str) -> Tuple[int, int, int]:
    value = (value or "#39ff14").lstrip("#")
    if len(value) == 3:
        value = "".join(c * 2 for c in value)
    try:
        r, g, b = (int(value[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return NEON
    return (b, g, r)


def format_duration(seconds: float) -> str:
    """Human timer text: '37 sec', '2 min', '1 hour 15 min'."""
    seconds = max(0.0, float(seconds))
    if seconds < 60:
        return f"{int(round(seconds))} sec"
    minutes = int(seconds // 60)
    if minutes < 60:
        return f"{minutes} min"
    hours = minutes // 60
    rem = minutes % 60
    return f"{hours} hour {rem} min" if rem else f"{hours} hour"


def format_clock(seconds: float) -> str:
    seconds = max(0.0, float(seconds))
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def _scaled(frame: np.ndarray) -> float:
    """Scale factor so overlays stay legible at any resolution."""
    return max(0.4, min(1.6, frame.shape[1] / 1280.0))


def draw_label(frame: np.ndarray, text: str, x: int, y: int,
               color: Tuple[int, int, int] = NEON,
               text_color: Tuple[int, int, int] = BLACK,
               scale_mult: float = 1.0) -> None:
    """Filled chip with dark text, as in the reference annotations."""
    s = _scaled(frame) * 0.52 * scale_mult
    thickness = max(1, int(round(_scaled(frame) * 1.2)))
    (tw, th), base = cv2.getTextSize(text, FONT, s, thickness)
    pad_x, pad_y = int(6 * _scaled(frame)), int(5 * _scaled(frame))
    x = max(0, min(x, frame.shape[1] - tw - 2 * pad_x - 1))
    y = max(th + 2 * pad_y, y)
    top_left = (x, y - th - 2 * pad_y)
    bottom_right = (x + tw + 2 * pad_x, y)
    cv2.rectangle(frame, top_left, bottom_right, color, -1)
    cv2.putText(frame, text, (x + pad_x, y - pad_y + base // 2), FONT, s,
                text_color, thickness, cv2.LINE_AA)


def draw_zones(frame: np.ndarray, zones: Sequence, show: bool = True) -> None:
    if not show or not zones:
        return
    h, w = frame.shape[:2]
    overlay = frame.copy()
    for zone in zones:
        if not getattr(zone, "visible", True):
            continue
        pts = np.array([[int(x * w), int(y * h)] for x, y in zone.points], dtype=np.int32)
        if len(pts) < 3:
            continue
        color = _hex_to_bgr(getattr(zone, "color", "#39ff14"))
        cv2.fillPoly(overlay, [pts], color)
        cv2.polylines(frame, [pts], True, color, max(1, int(2 * _scaled(frame))), cv2.LINE_AA)
    cv2.addWeighted(overlay, ZONE_FILL_ALPHA, frame, 1 - ZONE_FILL_ALPHA, 0, frame)

    for zone in zones:
        if not getattr(zone, "visible", True) or len(zone.points) < 3:
            continue
        pts = np.array([[int(x * w), int(y * h)] for x, y in zone.points], dtype=np.int32)
        anchor = pts[int(np.argmin(pts[:, 1]))]
        draw_label(frame, zone.name.upper(), int(anchor[0]), int(anchor[1]) - 4,
                   color=_hex_to_bgr(getattr(zone, "color", "#39ff14")), scale_mult=0.9)


def draw_trajectory(frame: np.ndarray, points: Sequence[Tuple[float, float]],
                    color: Tuple[int, int, int], thickness: int, fade: bool = True) -> None:
    if len(points) < 2:
        return
    pts = [(int(round(x)), int(round(y))) for x, y in points]
    n = len(pts)
    for i in range(1, n):
        if fade:
            alpha = i / n
            c = tuple(int(ch * (0.35 + 0.65 * alpha)) for ch in color)
        else:
            c = color
        cv2.line(frame, pts[i - 1], pts[i], c, thickness, cv2.LINE_AA)


def draw_objects(
    frame: np.ndarray,
    objects: Iterable[dict],
    *,
    trails: Optional[Dict[int, List[Tuple[float, float]]]] = None,
    selected_id: Optional[int] = None,
    show_boxes: bool = True,
    show_labels: bool = True,
    show_confidence: bool = True,
    show_trajectories: bool = True,
    show_timers: bool = True,
    trajectory_color: str = "#39ff14",
    selected_color: str = "#ff2bd1",
    thickness: int = 2,
) -> None:
    trails = trails or {}
    base_color = _hex_to_bgr(trajectory_color)
    sel_color = _hex_to_bgr(selected_color)
    s = _scaled(frame)
    box_thickness = max(1, int(round(thickness * s)))

    if show_trajectories:
        for obj in objects:
            tid = obj["id"]
            pts = trails.get(tid, [])
            is_selected = selected_id is not None and tid == selected_id
            draw_trajectory(
                frame, pts,
                sel_color if is_selected else base_color,
                box_thickness + (1 if is_selected else 0),
                fade=not is_selected,
            )

    for obj in objects:
        tid = obj["id"]
        x1, y1, x2, y2 = (int(round(v)) for v in obj["bbox"])
        is_selected = selected_id is not None and tid == selected_id
        color = sel_color if is_selected else NEON

        if show_boxes:
            cv2.rectangle(frame, (x1, y1), (x2, y2), color,
                          box_thickness + (1 if is_selected else 0), cv2.LINE_AA)

        cx, cy = obj.get("center", ((x1 + x2) / 2, (y1 + y2) / 2))
        cv2.circle(frame, (int(cx), int(cy)), max(2, int(3 * s)),
                   sel_color if is_selected else base_color, -1, cv2.LINE_AA)

        if show_labels:
            label = f"{obj['cls']} ID:{tid}"
            if show_confidence and obj.get("confidence") is not None:
                label += f" {obj['confidence']:.2f}"
            draw_label(frame, label, x1, y1 - 2, color=color)

        if show_timers:
            timer_text = None
            zones_inside = [z for z in obj.get("zones", []) if z.get("inside")]
            if zones_inside and zones_inside[0].get("total_time", 0.0) >= 1.0:
                timer_text = format_duration(zones_inside[0]["total_time"])
            elif obj.get("visible_duration", 0) >= 1.0:
                timer_text = format_duration(obj["visible_duration"])
            if timer_text:
                draw_label(frame, timer_text, x1, min(frame.shape[0] - 2, y2 + int(26 * s)),
                           color=NEON_DIM, text_color=WHITE, scale_mult=0.85)


def draw_hud(frame: np.ndarray, *, timestamp: float, frame_index: int,
             tracked: int, unique: int, fps: Optional[float] = None,
             source_name: str = "") -> None:
    """Surveillance-style corner readouts."""
    s = _scaled(frame)
    h, w = frame.shape[:2]
    scale = 0.5 * s
    thickness = max(1, int(round(s)))

    left_lines = [f"VISIONTRACK  {source_name}"[:48], f"TRACKED: {tracked}   TOTAL: {unique}"]
    if fps is not None:
        left_lines.append(f"PROC FPS: {fps:.1f}")
    y = int(26 * s)
    for line in left_lines:
        cv2.putText(frame, line, (int(12 * s), y), FONT, scale, BLACK, thickness + 2, cv2.LINE_AA)
        cv2.putText(frame, line, (int(12 * s), y), FONT, scale, NEON, thickness, cv2.LINE_AA)
        y += int(22 * s)

    stamp = f"{format_clock(timestamp)}  F{frame_index:06d}"
    (tw, _), _ = cv2.getTextSize(stamp, FONT, scale, thickness)
    pos = (w - tw - int(14 * s), h - int(14 * s))
    cv2.putText(frame, stamp, pos, FONT, scale, BLACK, thickness + 2, cv2.LINE_AA)
    cv2.putText(frame, stamp, pos, FONT, scale, WHITE, thickness, cv2.LINE_AA)

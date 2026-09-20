"""Video probing and frame iteration built on OpenCV.

Kept deliberately small so the rest of the pipeline never touches cv2.VideoCapture
directly -- swapping in a different decoder later only means changing this file.
"""
from __future__ import annotations

import contextlib
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterator, Optional, Tuple

import cv2
import numpy as np

from ..config import SUPPORTED_EXTENSIONS
from ..errors import CorruptVideoError, EmptyVideoError, UnsupportedFormatError


@dataclass
class VideoMetadata:
    width: int
    height: int
    fps: float
    frame_count: int
    duration: float
    codec: str

    def as_dict(self) -> dict:
        return asdict(self)


def _fourcc_to_str(value: float) -> str:
    try:
        code = int(value)
    except (TypeError, ValueError):
        return "unknown"
    if code <= 0:
        return "unknown"
    chars = [chr((code >> (8 * i)) & 0xFF) for i in range(4)]
    text = "".join(c for c in chars if c.isprintable()).strip()
    return text or "unknown"


def check_extension(filename: str) -> None:
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise UnsupportedFormatError(
            f"'{ext or 'unknown'}' is not a supported video format.",
            hint="Supported formats: " + ", ".join(sorted(SUPPORTED_EXTENSIONS)),
        )


def probe(path: Path) -> VideoMetadata:
    """Read metadata, raising a typed error when the file cannot be decoded."""
    if not path.exists():
        raise CorruptVideoError(f"File not found: {path.name}")

    cap = cv2.VideoCapture(str(path))
    try:
        if not cap.isOpened():
            raise CorruptVideoError(
                f"OpenCV could not open '{path.name}'.",
                hint="The file may be corrupt or use a codec your OpenCV build does not ship.",
            )

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        codec = _fourcc_to_str(cap.get(cv2.CAP_PROP_FOURCC))

        ok, frame = cap.read()
        if not ok or frame is None:
            raise EmptyVideoError(
                f"'{path.name}' contains no readable frames.",
                hint="Try re-encoding the file, or pick a different video.",
            )
        if width <= 0 or height <= 0:
            height, width = frame.shape[:2]

        # Containers frequently lie about fps/frame count; fall back to sane values.
        if not np.isfinite(fps) or fps <= 0.1 or fps > 480:
            fps = 25.0
        if frame_count <= 0:
            frame_count = _count_frames(path)
        duration = frame_count / fps if fps > 0 else 0.0
        return VideoMetadata(width, height, fps, frame_count, duration, codec)
    finally:
        cap.release()


def _count_frames(path: Path, limit: int = 200_000) -> int:
    """Last-resort frame count for containers without an index."""
    cap = cv2.VideoCapture(str(path))
    count = 0
    try:
        while count < limit:
            ok = cap.grab()
            if not ok:
                break
            count += 1
    finally:
        cap.release()
    return count


@contextlib.contextmanager
def open_capture(path: Path):
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise CorruptVideoError(
            f"OpenCV could not open '{path.name}'.",
            hint="The file may be corrupt or use an unsupported codec.",
        )
    try:
        yield cap
    finally:
        cap.release()


def iter_frames(path: Path, fps: float) -> Iterator[Tuple[int, float, np.ndarray]]:
    """Yield (frame_index, timestamp_seconds, frame) for every frame in the file."""
    with open_capture(path) as cap:
        index = 0
        while True:
            ok, frame = cap.read()
            if not ok or frame is None:
                break
            # CAP_PROP_POS_MSEC is unreliable on some containers; derive from index.
            timestamp = index / fps if fps > 0 else 0.0
            yield index, timestamp, frame
            index += 1


def scale_for_inference(frame: np.ndarray, imgsz: int) -> Tuple[np.ndarray, float]:
    """Downscale a frame so its long side is `imgsz`. Returns (frame, scale).

    `scale` converts inference-space coordinates back to source pixels.
    """
    h, w = frame.shape[:2]
    long_side = max(h, w)
    if long_side <= imgsz:
        return frame, 1.0
    factor = imgsz / float(long_side)
    resized = cv2.resize(frame, (max(1, int(round(w * factor))), max(1, int(round(h * factor)))),
                         interpolation=cv2.INTER_AREA)
    return resized, 1.0 / factor


def encode_jpeg(frame: np.ndarray, width: Optional[int] = None, quality: int = 75) -> bytes:
    if width and frame.shape[1] > width:
        h, w = frame.shape[:2]
        new_h = max(1, int(round(h * width / w)))
        frame = cv2.resize(frame, (width, new_h), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise CorruptVideoError("Failed to JPEG-encode a frame for the live preview.")
    return buf.tobytes()

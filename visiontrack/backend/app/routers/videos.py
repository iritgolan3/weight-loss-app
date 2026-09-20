"""Video library: upload, metadata, byte-range streaming and stored results."""
from __future__ import annotations

import logging
import re
import shutil
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from ..config import MAX_UPLOAD_BYTES
from ..errors import NotFoundError, UploadTooLargeError
from ..schemas import VideoInfo
from ..services import storage
from ..video import reader
from .system import demo_file

log = logging.getLogger("visiontrack.videos")
router = APIRouter(prefix="/api/videos", tags=["videos"])

CHUNK = 1024 * 512
_RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")
MIME_TYPES = {
    ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime",
    ".avi": "video/x-msvideo", ".mkv": "video/x-matroska", ".webm": "video/webm",
}


@router.get("", response_model=list[VideoInfo])
def list_videos():
    return storage.list_videos()


@router.post("", response_model=VideoInfo, status_code=201)
async def upload_video(file: UploadFile = File(...)):
    reader.check_extension(file.filename or "")
    tmp_dir = Path(tempfile.mkdtemp(prefix="visiontrack_upload_"))
    tmp_path = tmp_dir / Path(file.filename or "upload.mp4").name
    size = 0
    try:
        with tmp_path.open("wb") as out:
            while chunk := await file.read(CHUNK):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise UploadTooLargeError(
                        f"Upload exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
                        hint="Trim the clip, or raise VISIONTRACK_MAX_UPLOAD_MB.",
                    )
                out.write(chunk)
        if size == 0:
            raise UploadTooLargeError("The uploaded file is empty.")
        return storage.register_video(tmp_path, file.filename or tmp_path.name, move=True)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        await file.close()


@router.post("/demo", response_model=VideoInfo, status_code=201)
def load_demo():
    sample = demo_file()
    if sample is None:
        raise NotFoundError(
            "No demo video is installed.",
            hint="Drop any .mp4 into visiontrack/data/demo/, or upload your own video.",
        )
    try:  # the demo always occupies a stable id so repeat clicks reuse it
        return storage.get_video("demo")
    except NotFoundError:
        pass
    return storage.register_video(sample, sample.name, move=False, video_id="demo")


@router.get("/{video_id}", response_model=VideoInfo)
def get_video(video_id: str):
    return storage.get_video(video_id)


@router.delete("/{video_id}", status_code=204)
def delete_video(video_id: str):
    storage.delete_video(video_id)
    return None


@router.get("/{video_id}/stream")
def stream_video(video_id: str, request: Request):
    """Serve the source file with HTTP Range support so <video> can seek."""
    path = storage.video_path(video_id)
    file_size = path.stat().st_size
    media_type = MIME_TYPES.get(path.suffix.lower(), "application/octet-stream")
    range_header = request.headers.get("range")

    if not range_header:
        return FileResponse(path, media_type=media_type,
                            headers={"Accept-Ranges": "bytes"})

    match = _RANGE_RE.match(range_header)
    if not match:
        return FileResponse(path, media_type=media_type,
                            headers={"Accept-Ranges": "bytes"})

    start_raw, end_raw = match.groups()
    start = int(start_raw) if start_raw else 0
    end = int(end_raw) if end_raw else file_size - 1
    start = max(0, min(start, file_size - 1))
    end = max(start, min(end, file_size - 1))
    length = end - start + 1

    def iter_range():
        with path.open("rb") as fh:
            fh.seek(start)
            remaining = length
            while remaining > 0:
                data = fh.read(min(CHUNK, remaining))
                if not data:
                    break
                remaining -= len(data)
                yield data

    return StreamingResponse(
        iter_range(), status_code=206, media_type=media_type,
        headers={
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
        },
    )


@router.get("/{video_id}/tracks")
def get_tracks(video_id: str, trajectory: bool = True):
    tracks = storage.load_tracks(video_id)
    if not trajectory:
        tracks = [{k: v for k, v in t.items() if k != "trajectory"} for t in tracks]
    return tracks


@router.get("/{video_id}/timeline")
def get_timeline(video_id: str):
    """Compact per-frame detections used to draw overlays during playback."""
    return storage.load_timeline(video_id)


@router.get("/{video_id}/results")
def get_results(video_id: str):
    summary = storage.results_summary(video_id)
    if summary is None:
        raise NotFoundError(
            "This video has not been analysed yet.",
            hint="Press START ANALYSIS first.",
        )
    return summary


@router.delete("/{video_id}/results", status_code=204)
def clear_results(video_id: str):
    storage.clear_results(video_id)
    return None

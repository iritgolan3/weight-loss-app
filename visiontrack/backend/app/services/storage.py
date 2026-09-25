"""On-disk registry of uploaded videos, analysis results and app settings."""
from __future__ import annotations

import json
import shutil
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..config import RESULTS_DIR, SETTINGS_FILE, UPLOAD_DIR
from ..errors import NotFoundError
from ..schemas import AppSettings
from ..video import reader

_INDEX_FILE = UPLOAD_DIR / "index.json"
_lock = threading.RLock()


def _read_index() -> Dict[str, dict]:
    if not _INDEX_FILE.exists():
        return {}
    try:
        return json.loads(_INDEX_FILE.read_text())
    except json.JSONDecodeError:
        backup = _INDEX_FILE.with_suffix(".corrupt.json")
        shutil.copy2(_INDEX_FILE, backup)
        return {}


def _write_index(index: Dict[str, dict]) -> None:
    tmp = _INDEX_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(index, indent=2))
    tmp.replace(_INDEX_FILE)


def list_videos() -> List[dict]:
    with _lock:
        index = _read_index()
    videos = []
    for record in index.values():
        if Path(record["path"]).exists():
            videos.append(_decorate(record))
    videos.sort(key=lambda r: r["created_at"], reverse=True)
    return videos


def get_video(video_id: str) -> dict:
    with _lock:
        index = _read_index()
    record = index.get(video_id)
    if record is None:
        raise NotFoundError(f"Video '{video_id}' is not in the library.")
    if not Path(record["path"]).exists():
        raise NotFoundError(
            f"The file for video '{record.get('filename', video_id)}' is missing from disk.",
            hint="Upload it again.",
        )
    return _decorate(record)


def video_path(video_id: str) -> Path:
    return Path(get_video(video_id)["path"])


def _decorate(record: dict) -> dict:
    out = dict(record)
    out.setdefault("kind", "file")
    summary = results_summary(record["id"])
    out["analyzed"] = summary is not None
    out["analysis"] = summary
    return out


def register_video(source: Path, original_name: str, *, move: bool = False,
                   video_id: Optional[str] = None) -> dict:
    """Add a file to the library after probing it. Raises on bad video files."""
    reader.check_extension(original_name)
    vid = video_id or uuid.uuid4().hex[:12]
    dest_dir = UPLOAD_DIR / vid
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / Path(original_name).name

    if source.resolve() != dest.resolve():
        if move:
            shutil.move(str(source), str(dest))
        else:
            shutil.copy2(str(source), str(dest))

    try:
        meta = reader.probe(dest)
    except Exception:
        shutil.rmtree(dest_dir, ignore_errors=True)
        raise

    record = {
        "id": vid,
        "filename": dest.name,
        "path": str(dest),
        "size_bytes": dest.stat().st_size,
        "created_at": time.time(),
        **meta.as_dict(),
    }
    with _lock:
        index = _read_index()
        index[vid] = record
        _write_index(index)
    return _decorate(record)


def delete_video(video_id: str) -> None:
    with _lock:
        index = _read_index()
        record = index.pop(video_id, None)
        if record is None:
            raise NotFoundError(f"Video '{video_id}' is not in the library.")
        _write_index(index)
    shutil.rmtree(UPLOAD_DIR / video_id, ignore_errors=True)
    shutil.rmtree(RESULTS_DIR / video_id, ignore_errors=True)


# ------------------------------------------------------------------- results

def results_dir(video_id: str) -> Path:
    path = RESULTS_DIR / video_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_results(video_id: str, payload: Dict[str, Any]) -> None:
    directory = results_dir(video_id)
    (directory / "tracks.json").write_text(json.dumps(payload["tracks"]))
    (directory / "timeline.json").write_text(json.dumps(payload["timeline"]))
    (directory / "summary.json").write_text(json.dumps(payload["summary"], indent=2))


def load_tracks(video_id: str) -> List[dict]:
    path = results_dir(video_id) / "tracks.json"
    if not path.exists():
        raise NotFoundError(
            "This video has not been analysed yet.",
            hint="Press START ANALYSIS first.",
        )
    return json.loads(path.read_text())


def load_timeline(video_id: str) -> dict:
    path = results_dir(video_id) / "timeline.json"
    if not path.exists():
        raise NotFoundError(
            "This video has not been analysed yet.",
            hint="Press START ANALYSIS first.",
        )
    return json.loads(path.read_text())


def results_summary(video_id: str) -> Optional[dict]:
    path = RESULTS_DIR / video_id / "summary.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return None


def clear_results(video_id: str) -> None:
    shutil.rmtree(RESULTS_DIR / video_id, ignore_errors=True)


# ------------------------------------------------------------------ settings

def load_settings() -> AppSettings:
    if not SETTINGS_FILE.exists():
        return AppSettings()
    try:
        return AppSettings(**json.loads(SETTINGS_FILE.read_text()))
    except Exception:
        return AppSettings()


def save_settings(settings: AppSettings) -> AppSettings:
    SETTINGS_FILE.write_text(json.dumps(settings.model_dump(), indent=2))
    return settings

"""Pydantic models shared by the REST API and the websocket payloads."""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from .config import ANALYSIS_MODES, DEFAULT_CLASSES

AnalysisMode = Literal["fast", "balanced", "high_accuracy"]
TrackerType = Literal["bytetrack", "botsort"]
DeviceChoice = Literal["auto", "cpu", "cuda"]


class VideoInfo(BaseModel):
    id: str
    kind: Literal["file", "live"] = "file"
    source: Optional[str] = None
    filename: str
    size_bytes: int
    width: int
    height: int
    fps: float
    frame_count: int
    duration: float
    codec: str
    created_at: float
    analyzed: bool = False
    analysis: Optional[Dict[str, Any]] = None


class AnalysisConfig(BaseModel):
    """Everything that influences a run. Sent with POST /api/videos/{id}/analyze."""

    mode: AnalysisMode = "balanced"
    model: str = "yolov8n.pt"
    confidence: float = Field(0.35, ge=0.01, le=0.99)
    iou: float = Field(0.5, ge=0.05, le=0.95)
    tracker: TrackerType = "bytetrack"
    max_lost_frames: int = Field(30, ge=1, le=300)
    trajectory_length: int = Field(60, ge=2, le=600)
    device: DeviceChoice = "auto"
    classes: List[str] = Field(default_factory=lambda: list(DEFAULT_CLASSES))
    # Overrides for the preset; None means "use the mode default".
    imgsz: Optional[int] = Field(None, ge=160, le=1920)
    detect_every_n: Optional[int] = Field(None, ge=1, le=15)
    preview: bool = True
    # Stop after this many seconds of source time. None means "the whole video";
    # for a live camera it is the only thing that ends the run besides Stop.
    max_duration: Optional[float] = Field(None, gt=0, le=86400)
    record: bool = False  # live sources only: write the annotated stream to exports/
    stationary_speed_px: float = Field(
        18.0, ge=0.0, description="Centre movement (px/s at source resolution) below which an object counts as stationary"
    )

    def resolved(self) -> "AnalysisConfig":
        preset = ANALYSIS_MODES[self.mode]
        data = self.model_dump()
        if data.get("imgsz") is None:
            data["imgsz"] = preset["imgsz"]
        if data.get("detect_every_n") is None:
            data["detect_every_n"] = preset["detect_every_n"]
        return AnalysisConfig(**data)


class ZoneModel(BaseModel):
    id: str
    name: str
    color: str = "#39ff14"
    visible: bool = True
    # Normalised polygon points (0..1) so zones survive resolution changes.
    points: List[List[float]]


class ZoneCollection(BaseModel):
    video_id: str
    zones: List[ZoneModel] = Field(default_factory=list)


class ZoneTimeInfo(BaseModel):
    zone_id: str
    zone_name: str
    inside: bool
    entered_at: Optional[float] = None
    exited_at: Optional[float] = None
    total_time: float = 0.0
    entries: int = 0


class TrackedObject(BaseModel):
    """Per-frame view of a track, streamed over the websocket."""

    id: int
    cls: str
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2] in source-video pixels
    center: List[float]
    first_seen: float
    last_seen: float
    visible_duration: float
    status: Literal["moving", "stationary"]
    speed_px_per_s: Optional[float] = None
    speed_real_world: None = None  # never estimated: no camera calibration available
    zones: List[ZoneTimeInfo] = Field(default_factory=list)


class TrackSummary(BaseModel):
    id: int
    cls: str
    confidence: float
    max_confidence: float
    first_seen: float
    last_seen: float
    first_frame: int
    last_frame: int
    visible_duration: float
    samples: int
    status: str
    last_bbox: List[float]
    speed_px_per_s: Optional[float] = None
    speed_real_world: None = None
    zones: List[ZoneTimeInfo] = Field(default_factory=list)
    trajectory: List[Dict[str, float]] = Field(default_factory=list)


class JobStats(BaseModel):
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


class JobState(BaseModel):
    id: str
    video_id: str
    live: bool = False
    recording: Optional[str] = None
    status: Literal["queued", "running", "stopping", "stopped", "completed", "failed"]
    progress: float = 0.0
    stats: JobStats = Field(default_factory=JobStats)
    config: Dict[str, Any] = Field(default_factory=dict)
    device: str = "cpu"
    model: str = ""
    error: Optional[Dict[str, Any]] = None
    started_at: Optional[float] = None
    finished_at: Optional[float] = None


class SystemInfo(BaseModel):
    torch_version: Optional[str]
    cuda_available: bool
    cuda_device_name: Optional[str]
    device_in_use: str
    opencv_version: str
    ultralytics_version: Optional[str]
    models: List[Dict[str, Any]]
    modes: Dict[str, Any]
    default_classes: List[str]
    demo_video_available: bool
    backend_ready: bool
    warnings: List[str] = Field(default_factory=list)


class AppSettings(BaseModel):
    """Persisted UI + pipeline preferences (settings dialog)."""

    model: str = "yolov8n.pt"
    confidence: float = 0.35
    iou: float = 0.5
    tracker: TrackerType = "bytetrack"
    max_lost_frames: int = 30
    trajectory_length: int = 60
    mode: AnalysisMode = "balanced"
    device: DeviceChoice = "auto"
    classes: List[str] = Field(default_factory=lambda: list(DEFAULT_CLASSES))
    imgsz: Optional[int] = None
    detect_every_n: Optional[int] = None
    show_boxes: bool = True
    show_labels: bool = True
    show_trajectories: bool = True
    show_confidence: bool = True
    show_zones: bool = True
    show_timers: bool = True
    trajectory_color: str = "#39ff14"
    selected_color: str = "#ff2bd1"
    trajectory_thickness: int = 2
    preview: bool = True

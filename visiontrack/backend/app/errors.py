"""Typed application errors that map onto useful HTTP responses.

Every failure path in VisionTrack raises one of these so the frontend can show
an actionable message instead of a generic 500.
"""
from __future__ import annotations

from typing import Any, Optional


class VisionTrackError(Exception):
    """Base class for errors that are safe to show to the user."""

    status_code = 400
    code = "error"

    def __init__(self, message: str, *, hint: Optional[str] = None, details: Any = None):
        super().__init__(message)
        self.message = message
        self.hint = hint
        self.details = details

    def to_dict(self) -> dict:
        return {
            "code": self.code,
            "message": self.message,
            "hint": self.hint,
            "details": self.details,
        }


class NotFoundError(VisionTrackError):
    status_code = 404
    code = "not_found"


class UnsupportedFormatError(VisionTrackError):
    status_code = 415
    code = "unsupported_format"


class CorruptVideoError(VisionTrackError):
    status_code = 422
    code = "corrupt_video"


class EmptyVideoError(VisionTrackError):
    status_code = 422
    code = "empty_video"


class UploadTooLargeError(VisionTrackError):
    status_code = 413
    code = "upload_too_large"


class ModelUnavailableError(VisionTrackError):
    status_code = 503
    code = "model_unavailable"


class InvalidZoneError(VisionTrackError):
    status_code = 422
    code = "invalid_zone"


class ExportError(VisionTrackError):
    status_code = 500
    code = "export_failed"


class JobConflictError(VisionTrackError):
    status_code = 409
    code = "job_conflict"


class AnalysisRequiredError(VisionTrackError):
    status_code = 409
    code = "analysis_required"

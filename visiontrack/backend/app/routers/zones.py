"""Zone CRUD. Polygons are normalised (0..1) and stored as JSON per video."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..schemas import ZoneCollection, ZoneModel
from ..services.cameras import resolve_source
from ..tracking.zones import zone_store

router = APIRouter(prefix="/api/videos/{video_id}/zones", tags=["zones"])


class ZoneCreate(BaseModel):
    name: str = Field("", max_length=60)
    points: List[List[float]]
    color: str = "#39ff14"


class ZoneUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=60)
    points: Optional[List[List[float]]] = None
    color: Optional[str] = None
    visible: Optional[bool] = None


@router.get("", response_model=ZoneCollection)
def list_zones(video_id: str):
    resolve_source(video_id)  # 404s for an unknown video or camera
    return ZoneCollection(video_id=video_id,
                          zones=[ZoneModel(**z.as_dict()) for z in zone_store.load(video_id)])


@router.post("", response_model=ZoneModel, status_code=201)
def create_zone(video_id: str, payload: ZoneCreate):
    resolve_source(video_id)
    zone = zone_store.create(video_id, payload.name, payload.points, payload.color)
    return ZoneModel(**zone.as_dict())


@router.patch("/{zone_id}", response_model=ZoneModel)
def update_zone(video_id: str, zone_id: str, payload: ZoneUpdate):
    resolve_source(video_id)
    zone = zone_store.update(video_id, zone_id, **payload.model_dump(exclude_unset=True))
    return ZoneModel(**zone.as_dict())


@router.delete("/{zone_id}", status_code=204)
def delete_zone(video_id: str, zone_id: str):
    resolve_source(video_id)
    zone_store.delete(video_id, zone_id)
    return None

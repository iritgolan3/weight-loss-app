"""VisionTrack API entry point."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import PROJECT_ROOT
from .errors import VisionTrackError
from .routers import analysis, cameras, exports, system, videos, zones
from .services.events import hub

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("visiontrack")


@asynccontextmanager
async def lifespan(app: FastAPI):
    hub.bind_loop(asyncio.get_running_loop())
    log.info("VisionTrack backend ready")
    yield


app = FastAPI(
    title="VisionTrack API",
    description="Real object detection, tracking, zone analytics and export.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local-only tool; the Vite dev server runs on another port
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(VisionTrackError)
async def visiontrack_error_handler(request: Request, exc: VisionTrackError):
    log.warning("%s %s -> %s: %s", request.method, request.url.path, exc.code, exc.message)
    return JSONResponse(status_code=exc.status_code, content={"error": exc.to_dict()})


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": {
            "code": "internal_error",
            "message": str(exc) or "Unexpected backend error.",
            "hint": "Check the backend console for the traceback.",
        }},
    )


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(system.router)
app.include_router(videos.router)
app.include_router(cameras.router)
app.include_router(analysis.router)
app.include_router(zones.router)
app.include_router(exports.router)

# Serve the built frontend when it exists, so `npm run build` + the backend is a
# single-URL deployment. During development the Vite dev server proxies here
# instead and this block simply does nothing.
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        # Unknown API/WS paths must still 404 rather than return the SPA shell.
        if full_path.startswith(("api/", "ws/")):
            return JSONResponse(
                status_code=404,
                content={"error": {"code": "not_found",
                                   "message": f"No such endpoint: /{full_path}",
                                   "hint": "See /docs for the available endpoints."}},
            )
        candidate = (FRONTEND_DIST / full_path).resolve()
        if full_path and candidate.is_file() and FRONTEND_DIST.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")

    log.info("Serving built frontend from %s", FRONTEND_DIST)
else:
    @app.get("/", include_in_schema=False)
    async def root_hint():
        return {
            "message": "VisionTrack API is running. The UI is served by the Vite dev server "
                       "(http://localhost:5173), or build it with `npm run build` in frontend/.",
            "docs": "/docs",
        }

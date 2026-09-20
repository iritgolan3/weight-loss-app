# VisionTrack — AI Video Analysis

A local, self-contained video-analysis application: upload a video, run real
object detection and multi-object tracking over it, and review the result with
live bounding boxes, persistent object IDs, movement trails, dwell-time zones
and exportable data.

Everything runs on your own machine. No cloud services, no accounts, no
telemetry. Detections come from a real YOLO model running over your actual
video frames — nothing in the UI is simulated or pre-scripted.

```
 frame ──► YOLO detection ──► ByteTrack / BoT-SORT ──► persistent IDs
                                                          │
       rendered video ◄── UI overlay ◄── zone analysis ◄── trajectories
```

---

## 1. What it does

| Area | Capability |
| --- | --- |
| **Detection** | Ultralytics YOLO (v8 / v11, nano → medium). Detects `person`, `bicycle`, `car`, `motorcycle`, `bus`, `truck` out of the box; any COCO class can be enabled in Settings. |
| **Tracking** | ByteTrack (default) or BoT-SORT. Each object keeps a persistent numeric ID for as long as the tracker believes it is the same object. |
| **Per-object data** | Class, confidence (last + peak), first seen, last seen, visible duration, detection count, trajectory, movement status, image-space speed, zone entry/exit times. |
| **Trajectories** | Configurable length, colour and thickness. The selected object gets a brighter magenta path; everything else gets a faded trail. |
| **Zones** | Draw polygons over the video. Entry/exit are detected per object and dwell time is accumulated. Zones are stored as JSON and survive restarts. |
| **Timers** | Reference-style overlays (`37 sec`, `2 min`, `1 hour 15 min`) computed from real frame timestamps. |
| **Playback** | Play / pause / restart / seek / frame-step, 0.25×–2× speed, fullscreen, and a ribbon showing when each object was on screen. |
| **Live view** | While an analysis runs, the backend streams preview frames plus detections over a websocket so you watch the pipeline work in real time. |
| **Export** | Annotated MP4 (boxes, IDs, trails, timers, zones, timestamp HUD), detections CSV, tracks CSV, and a full JSON dump including every trajectory point. |
| **Live cameras** | A webcam plugged into the PC, or an IP/RTSP stream. Same detection, tracking, zones and timers as a file, with optional recording of the annotated feed. |
| **Hardware** | CUDA is used automatically when available, otherwise CPU. The device in use is always shown in the UI. |

---

## 2. Install and run on Windows

### Requirements

1. **Python 3.10 – 3.12** — <https://www.python.org/downloads/>
   During setup, tick **“Add python.exe to PATH”**.
2. **Node.js LTS (20 or newer)** — <https://nodejs.org/>
3. ~3 GB of free disk space (PyTorch and the model weights).
4. A GPU is optional. Without one, everything runs on the CPU.

### The short version

1. Download/clone this repository.
2. Open the `visiontrack` folder.
3. Double-click **`start.bat`**.
4. Wait for the first-run setup (it downloads PyTorch — several minutes).
5. Your browser opens at <http://localhost:8000>.
6. Click **Load demo**, or **Upload video** and pick an MP4.
7. Click **START ANALYSIS**.

`start.bat` creates the Python environment, installs the dependencies, builds
the UI and starts the server. Later runs skip straight to the last step.

PowerShell users can run the same thing with:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

### Manual steps (any OS)

```bash
# 1. Backend
python -m venv backend/.venv
backend\.venv\Scripts\activate          # Windows
# source backend/.venv/bin/activate     # macOS / Linux
pip install -r backend/requirements.txt
python -m uvicorn app.main:app --port 8000 --app-dir backend

# 2. Frontend (a second terminal)
cd frontend
npm install
npm run dev        # dev server with hot reload at http://localhost:5173
# npm run build    # or build once; the backend then serves it at :8000
```

* **`npm run dev`** → open <http://localhost:5173> (proxies the API to :8000).
* **`npm run build`** → open <http://localhost:8000> (backend serves the built UI).

`start-dev.bat` / `./start.sh --dev` launch both in development mode.

---

## 3. Using it

1. **Pick a video.** Upload, drag-and-drop, or open one from the library.
   MP4, MOV, AVI, MKV and WebM are accepted.
2. **Check the metadata** in the right panel: resolution, FPS, duration, size.
3. **Choose an analysis mode** in Settings (gear icon):
   * `Fast` — 480 px inference, every 3rd frame. Good for long clips on a CPU.
   * `Balanced` — 640 px, every 2nd frame. The default.
   * `High accuracy` — 960 px, every frame. Slowest.
4. **Press START ANALYSIS.** The view switches to the live feed; the sidebar
   fills with tracked objects and the stats bar shows processing FPS,
   detection FPS and progress.
5. **When it finishes** the view switches to playback. The original video plays
   with the stored detections drawn on top, so you can scrub, step frames and
   change speed while the overlays follow.
6. **Click any object** — in the video or in the sidebar — to highlight its box,
   light up its magenta trajectory and open its statistics.
7. **Draw a zone** with *Draw zone*: click points on the video, press `Enter`
   (or double-click) to close the polygon, then name it. Re-run the analysis to
   compute dwell time for the new zone.
8. **Export** from the top bar: annotated MP4, CSV or JSON.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` / `→` | Step one frame (hold `Shift` for ten) |
| `F` | Fullscreen |
| `Enter` | Finish the zone you are drawing |
| `Backspace` | Remove the last zone point |
| `Esc` | Cancel zone drawing / close a dialog |

### Connecting a camera

Press **Connect camera** (top bar, or on the first-run screen).

1. **A webcam on this PC** — VisionTrack probes device indices 0–4 and lists whatever
   answers. Click it and the feed is live. If nothing is found, close any other app
   holding the camera (Teams, Zoom, the Camera app) and press *Scan again*.
2. **An IP or RTSP camera** — paste the full URL, including credentials if the camera
   wants them: `rtsp://user:pass@192.168.1.50:554/stream`. An `http://` MJPEG URL works too.

Then press **START ANALYSIS**, exactly as for a file.

Two things differ from a file:

* **A live feed has no end**, so it runs until you press *Stop* or until the
  **Stop after** limit in the dialog (1 / 5 / 30 minutes, or no limit). Object
  timers come from the wall clock — how long something has really been in view.
* **There is nothing to scrub**, so the player controls are inactive. Tick
  **Record the annotated feed** to write an MP4 into `exports/` as the session
  runs; that file has the boxes, IDs, trails, timers and zones burned in and can be
  reviewed afterwards.

Zones work on cameras too, and are remembered per camera: a zone drawn on `Camera 0`
is still there next time you connect it.

The camera is opened by the Python backend, so it must be attached to the machine
running VisionTrack — connecting from a phone browser will not use the phone's camera.

---

## 4. Demo mode

`Load demo` analyses the first video file found in `data/demo/`. A sample clip
ships with the project. To use your own, drop any `.mp4` in that folder — the
button picks it up on the next page load. If the folder is empty the UI says so
and asks you to upload a video instead; it never shows fabricated results.

---

## 5. Project structure

```
visiontrack/
├── start.bat / start.ps1 / start.sh    one-click launchers
├── start-dev.bat                       backend + Vite dev server
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py                     FastAPI app, error handlers, static UI
│       ├── config.py                   paths, presets, model catalogue
│       ├── errors.py                   typed errors → useful HTTP responses
│       ├── schemas.py                  request/response models
│       ├── routers/
│       │   ├── videos.py               upload, metadata, range streaming
│       │   ├── analysis.py             job control + /ws/jobs/{id}
│       │   ├── zones.py                zone CRUD
│       │   ├── exports.py              MP4/CSV/JSON export + /ws/exports/{id}
│       │   └── system.py               hardware report, settings
│       ├── services/
│       │   ├── job_manager.py          the analysis pipeline (worker thread)
│       │   ├── exporter.py             annotated video + data exports
│       │   ├── storage.py              video library, results, settings
│       │   └── events.py               websocket fan-out hub
│       ├── models/detector.py          YOLO wrapper, device selection
│       ├── tracking/
│       │   ├── tracks.py               per-track state, trails, speed, status
│       │   └── zones.py                polygons + dwell-time state machine
│       └── video/
│           ├── reader.py               probing, frame iteration, JPEG encode
│           └── renderer.py             overlay drawing for the MP4 export
├── frontend/
│   └── src/
│       ├── App.tsx, pages/Dashboard.tsx
│       ├── api/          REST client + shared types
│       ├── components/   stage, controls, panels, dialogs
│       ├── hooks/        websocket feed, element sizing
│       └── lib/          canvas overlay, timeline lookup, store, formatting
├── data/                 uploads, results, zones, demo clip, model weights
└── exports/              rendered MP4s and data exports
```

### Swapping the model

`backend/app/models/detector.py` is the only file that knows about Ultralytics.
Anything exposing `class_names`, `track(frame, …) -> list[Detection]` and
`reset()` can replace it; return it from `load_detector()` and the rest of the
pipeline is unchanged.

---

## 6. API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness probe |
| `GET` | `/api/system` | Torch/CUDA/OpenCV versions, models, presets, warnings |
| `GET` `PUT` | `/api/settings` | Persisted preferences |
| `GET` `POST` | `/api/videos` | List / upload |
| `POST` | `/api/videos/demo` | Register the bundled demo clip |
| `GET` | `/api/cameras/discover` | Probe device indices 0–4 for local webcams |
| `GET` `POST` | `/api/cameras` | List connected live sources / connect one |
| `DELETE` | `/api/cameras/{id}` | Disconnect a live source |
| `GET` | `/api/videos/{id}` | Metadata (+ last analysis summary) |
| `GET` | `/api/videos/{id}/stream` | Byte-range video stream for `<video>` |
| `POST` | `/api/videos/{id}/analyze` | Start an analysis job |
| `GET` | `/api/jobs/{id}` · `POST /api/jobs/{id}/stop` | Job status / stop |
| `WS` | `/ws/jobs/{id}` | Live frames, detections, stats, zone events |
| `GET` | `/api/videos/{id}/tracks` · `/timeline` · `/results` | Stored results |
| `GET` `POST` `PATCH` `DELETE` | `/api/videos/{id}/zones[/{zone_id}]` | Zone CRUD |
| `POST` | `/api/videos/{id}/export/video` | Render an annotated MP4 |
| `GET` | `/api/videos/{id}/export/data?format=json\|csv` | Data export |
| `WS` | `/ws/exports/{id}` | Export progress |

Interactive docs are at <http://localhost:8000/docs>.

### Websocket frame payload

```json
{
  "type": "frame",
  "frame": 1823,
  "timestamp": 60.77,
  "objects": [
    {
      "id": 1,
      "cls": "car",
      "confidence": 0.93,
      "bbox": [100, 210, 250, 370],
      "center": [175, 290],
      "first_seen": 12.4,
      "last_seen": 60.77,
      "visible_duration": 48.37,
      "status": "moving",
      "speed_px_per_s": 214.6,
      "speed_real_world": null,
      "zones": [
        { "zone_id": "a1b2c3d4", "zone_name": "Roadway", "inside": true,
          "entered_at": 58.2, "exited_at": null, "total_time": 2.57, "entries": 1 }
      ]
    }
  ],
  "stats": { "processing_fps": 28.8, "detection_fps": 14.4, "tracked_objects": 5,
             "unique_objects": 11, "frames_processed": 431, "frames_total": 645 },
  "preview": "<base64 jpeg>"
}
```

### Exported JSON

```json
{
  "video": "example.mp4",
  "objects": [
    {
      "id": 1,
      "cls": "car",
      "first_seen": 12.4,
      "last_seen": 51.8,
      "visible_duration": 39.4,
      "trajectory": [
        { "x": 420, "y": 311, "time": 12.4 },
        { "x": 430, "y": 315, "time": 12.5 }
      ]
    }
  ]
}
```

---

## 7. Performance notes

Measured on a 4-core CPU container with `yolov8n` at 640 px, no GPU:

| Mode | Processing FPS | Detection FPS |
| --- | --- | --- |
| Fast (480 px, every 3rd frame) | ~67 | ~22 |
| Balanced (640 px, every 2nd frame) | ~33 | ~17 |

A CUDA GPU is typically 5–20× faster. Tips:

* Use **Fast** mode for long clips on a CPU.
* Untick classes you do not care about in Settings.
* Turn off **Live preview stream** to save the JPEG encode and websocket traffic.
* Raise **Detect every N frames** — overlays then hold the most recent analysed
  frame between samples (the UI marks those instants as *between analysed
  frames* rather than inventing positions).

Everything heavy runs in a background worker thread, so the API and the UI stay
responsive; frame payloads bypass React state and are read directly by the
canvas render loop.

### Detection quality vs. speed

Small or distant objects need resolution. On one frame of the bundled clip:

| Inference size | Confidence | People found |
| --- | --- | --- |
| 480 px | 0.35 | 0 |
| 640 px | 0.25 | 3 |
| 960 px | 0.25 | 4 |
| 1280 px | 0.20 | 6 |

If objects are being missed, raise **Processing resolution** and lower
**Confidence threshold** in Settings before blaming the tracker.

---

## 8. Verifying the install

With the backend running, the bundled smoke test exercises the whole workflow
end to end — registering a video, creating a zone, running a real analysis, and
producing every export:

```bash
backend\.venv\Scripts\python.exe backend\smoke_test.py --url http://127.0.0.1:8000
# macOS / Linux: backend/.venv/bin/python backend/smoke_test.py
```

```
  [ok] health
  [ok] system info — torch 2.14.0+cu130 · device cpu
  [ok] video registered — sample-traffic.mp4 720x1280 @ 30fps
  [ok] zone created — cc7d408f
  [ok] analysis completed — 11 objects · 67.0 proc fps · 22.4 det fps
  [ok] tracks returned — 11 tracks
  [ok] track has a trajectory — 22 points
  [ok] real-world speed is not invented
  [ok] zone accounting present
  [ok] timeline stored — 215 samples
  [ok] JSON export — 23 KB
  [ok] CSV export — 128 detection rows
  [ok] annotated MP4 export — sample-traffic_demo_annotated.mp4
  [ok] camera discovery — 0 local camera(s) detected (none attached)
  All checks passed.
```

Add `--video path\to\your.mp4` to run it against your own footage, and
`--camera 0` to include a five-second live-camera run in the checks.

---

## 9. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| *“Cannot reach the VisionTrack backend”* | The Python server is not running. Start `start.bat` again, or check the console window for a traceback. |
| *“Could not download model weights”* | No internet on first run. Download e.g. `yolov8n.pt` from the Ultralytics assets releases manually and place it in `data/models/`. |
| *“OpenCV could not open …”* | The file is corrupt, or your OpenCV build lacks that codec. Re-encode to MP4/H.264. |
| Video is black but overlays appear | The **browser** cannot decode the file (common for MKV/AVI, and for H.264 in Chromium builds without proprietary codecs). Analysis and export are unaffected; re-encode to MP4/H.264 or WebM for in-browser playback. |
| *“No CUDA GPU detected”* | Informational. Everything runs on the CPU. For GPU support install a CUDA build of PyTorch that matches your driver. |
| Analysis is very slow | CPU inference. Switch to Fast mode, lower the resolution, or raise *detect every N frames*. |
| *“The annotated video came out empty”* | The source file moved or was deleted after analysis. Re-upload it. |
| Port 8000 already in use | Start the backend with `--port 8010` and set `VISIONTRACK_BACKEND=http://127.0.0.1:8010` for the dev server. |
| `start.ps1` refuses to run | Use `powershell -ExecutionPolicy Bypass -File .\start.ps1`. |

Backend errors always come back as `{"error": {"code", "message", "hint"}}` and
are surfaced in the UI as a toast with an actionable hint — nothing fails
silently.

---

## 10. Known limitations

* **Real-world speed is not estimated.** The app reports image-space speed in
  px/s and explicitly marks real-world speed as *unavailable*: converting it to
  km/h needs camera calibration (focal length, pose, ground plane) that a plain
  video file does not carry. Guessing would be a fabricated number.
* **IDs are tracker IDs.** If an object is occluded for longer than
  *max lost frames*, it returns with a new ID. There is no appearance-based
  re-identification across long gaps.
* **Detections are sampled.** In Fast/Balanced modes not every frame is
  analysed. Overlays hold the most recent analysed sample and the UI labels
  those instants rather than interpolating.
* **Zone dwell time is computed during analysis.** Zones added afterwards need
  a re-run to produce dwell times (the live overlay still shows the polygon).
* **Zone membership uses the box centre**, not full polygon overlap.
* **Export uses OpenCV's `mp4v` encoder**, so the annotated MP4 is not
  web-optimised. It plays fine in VLC, Windows Media Player and most editors.
* **Browser playback depends on browser codecs.** The analysis pipeline reads
  files through OpenCV and handles far more formats than `<video>` does.
* **Cameras are read by the backend**, not the browser, so the camera has to be on
  the machine running VisionTrack. Opening the UI on a phone will not use the
  phone's camera.
* **A live session cannot be replayed in-app.** There is no seekable file behind a
  camera, so review the recording the session wrote to `exports/` instead.
* **Single machine, single user.** There is no authentication; bind only to
  `127.0.0.1` unless you add your own.

## 11. Possible next steps

* Appearance-based re-identification (BoT-SORT with ReID weights) for stable
  IDs across long occlusions.
* Line-crossing counters (in/out tallies) on top of the existing zone engine.
* Per-second and per-minute aggregate counts alongside the per-frame stream.
* Heatmaps and origin–destination matrices aggregated from stored trajectories.
* Camera calibration UI (ground-plane homography) to unlock real-world speed.
* Batch/queue mode for whole folders of footage, and scheduled runs.
* ONNX Runtime / OpenVINO backends for faster CPU inference.
* Packaging as a single `.exe` with PyInstaller so Python is not required.

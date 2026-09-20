# VisionTrack Live — browser edition

A single self-contained `.html` file that detects and tracks people and vehicles
from the camera, entirely inside the browser. No Python, no install, no server,
no network. Built for machines where Windows App Control or SmartScreen refuses
to run the desktop launcher, and it works on a phone as well.

```bash
python build.py          # writes dist/VisionTrack-Live.html (~26 MB)
```

Then double-click the file. It opens in the browser, asks for camera permission
and starts tracking.

## What it does

* **Persistent ids.** Every detected object keeps its id while the tracker
  believes it is the same object, people included.
* **Tap to inspect.** Tapping an object opens a panel with everything actually
  measured about it: class, confidence, first seen, time tracked, movement
  state, image-space speed, on-screen heading, position, box size, and its share
  of the frame.
* **Age and apparent gender** for people, estimated on-device from the face crop
  and averaged over repeated measurements. The panel labels both as estimates.
* **Follow mode.** A selected object is kept centred as it moves; the view
  chases it smoothly rather than snapping.
* **Zoom** from 1x to 6x with the on-screen buttons or `+` / `-`.
* **Tamper watch.** A struck, re-aimed or covered camera changes nearly the
  whole frame at once, which object motion never does. That, a collapse in
  brightness, or an accelerometer shock on a phone starts a recording by itself.
* **Recording.** Auto-clips run 30 seconds and extend while triggers keep
  arriving; there is also a manual record button. Finished clips appear with a
  save link.

### Height, and why it needs a reference

A single uncalibrated camera cannot measure height: the same person fills twice
the pixels at half the distance. Rather than print a confident number, the panel
says a reference is needed. Type a known height for someone standing in frame
and press **כייל** — afterwards others get an estimate, valid only at roughly
the same distance from the camera. This is the same reason the desktop edition
reports image-space speed in px/s and refuses to convert it to km/h.

### What it deliberately does not do

It does not identify anyone. There is no face recognition, no matching against
a database, and no lookup of a detected person on the internet. It reports what
the camera can see about an unidentified figure, and nothing that would attach a
name to them.

## How it differs from the desktop app

|  | Desktop (`../backend`) | Browser (this) |
| --- | --- | --- |
| Detector | YOLOv8 / YOLO11 via Ultralytics | COCO-SSD (ssdlite_mobilenet_v2) |
| Age / apparent gender | No | Yes, on-device |
| Zoom, follow, tamper watch, auto-record | No | Yes |
| Tracker | ByteTrack / BoT-SORT | Greedy IoU association (`app.js`) |
| Runs on | Python + PyTorch | TensorFlow.js in the browser |
| Speed | GPU or multi-core CPU | Whatever WebGL the device offers |
| Accuracy | Higher | Lower, especially for small/distant objects |
| Zones, export, playback, file analysis | Yes | No — live camera only |
| Install required | Python (+ Node to build the UI) | None |

Both are real detection over real frames. The browser edition trades accuracy
and features for needing nothing installed.

## Files

* `template.html` — markup, styling and the script slots the build fills.
* `app.js` — camera handling, the IoU tracker, face attribute estimation, the
  tamper watch, recording, zoom/follow, canvas overlay and the panels.
* `build.py` — fetches face-api (which bundles TensorFlow.js and is shared with
  coco-ssd), the COCO-SSD wrapper, the detector weights and the two face models,
  inlines them all and writes the single file. Downloads are cached in
  `.cache/`, so rebuilds work offline.

## Notes

* Frame rate depends entirely on the device's GPU. A machine without working
  WebGL falls back to software rendering and will be slow.
* `getUserMedia` needs a secure context. A local `file://` page counts as one,
  as does `https://`; plain `http://` on a remote host does not.
* Nothing leaves the device: the models are embedded and inference is local.
  Recordings are held in memory as blobs until you save them.
* The face weights are uint8-quantized, so they are decoded through
  `tf.io.decodeWeights` with their manifest rather than read as raw floats.
* Recording captures the camera stream directly rather than a composited canvas.
  Detection already competes for the CPU, and a recording with dropped frames
  would be worse than one without the overlays drawn in.
* The tamper watch arms 2.5s after the camera starts, so auto-exposure settling
  is not mistaken for interference.

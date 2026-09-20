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

## How it differs from the desktop app

|  | Desktop (`../backend`) | Browser (this) |
| --- | --- | --- |
| Detector | YOLOv8 / YOLO11 via Ultralytics | COCO-SSD (ssdlite_mobilenet_v2) |
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
* `app.js` — camera handling, the IoU tracker, canvas overlay and sidebar.
* `build.py` — fetches TensorFlow.js, the COCO-SSD wrapper and the model
  weights, inlines all four pieces and writes the single file. Downloads are
  cached in `.cache/`, so rebuilds work offline.

## Notes

* Frame rate depends entirely on the device's GPU. A machine without working
  WebGL falls back to software rendering and will be slow.
* `getUserMedia` needs a secure context. A local `file://` page counts as one,
  as does `https://`; plain `http://` on a remote host does not.
* Nothing leaves the device: the model is embedded and inference is local.

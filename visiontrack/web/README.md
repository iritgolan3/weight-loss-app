# VisionTrack Live — browser edition

A single self-contained `.html` file that detects and tracks people and vehicles
from the camera, entirely inside the browser. No Python, no install, no server,
no network. Built for machines where Windows App Control or SmartScreen refuses
to run the desktop launcher, and it works on a phone as well.

```bash
python export_yolo.py    # once: writes .cache/yolo26m.onnx
python build.py          # writes dist/VisionTrack-Live.html (~100 MB)
```

Then double-click the file. It opens in the browser, asks for camera permission
and starts tracking.

Most of that size is 26 MB of neural-network weights. They are gzipped and
written in an 85-character encoding rather than base64 — base64 costs 33% over
the raw bytes, this costs 25%, and gzip takes a slice off first, which is the
difference between a 37 MB file and a 31 MB one. The page inflates them with
`DecompressionStream` while the boot screen runs, so it costs no visible time.
That does set a floor on the browser: Chrome, Edge, Firefox 113+ or Safari
16.4+. Anything older gets a plain message saying so rather than a stack
trace.

## The access gate

The app opens on a GDA-branded sign-in card, then starts the camera by itself as
soon as the card clears — clearing it is the user gesture that camera permission
and autoplay require, so no second click is needed.

**The gate is a demo prop, not security.** The code runs in the page, so the
expected value is readable by anyone who opens the file; `123` in all three
fields lets you through. Real access control needs a server that holds the
check. Treat this as the product shell's front door, not a lock.

### About the crest

The card's layout, palette and wording follow the reference that was supplied,
but the crest on it is an **original GDA mark drawn for this project** — a gold
ring, a navy field and a camera glyph. The reference carried the seal of a real
federal agency. Those seals identify a specific government body, their use is
restricted by law, and a sign-in screen that wears one is claiming to be that
agency. GDA is a fictional brand, so it gets a mark of its own.

## What it does

* **Persistent ids.** Every detected object keeps its id while the tracker
  believes it is the same object, people included.
* **Tap to inspect.** Tapping an object opens a panel with everything actually
  measured about it: class, confidence, first seen, time tracked, movement
  state, image-space speed, on-screen heading, position, box size, and its share
  of the frame.
* **Age and apparent gender** for people, estimated on-device from the face crop
  and averaged over repeated measurements. The panel labels both as estimates.
* **The box carries the colour.** A person's bounding box is drawn green for
  male and pink for female — not a swatch beside the label, the box itself.
  Because green and pink mean something, neither is the default: a person the
  face model has not read yet is white, and anything that is not a person is
  cyan. Selected is magenta, marked is red, a firearm class would be red, and
  the enrolled owner is black. The trail and the sidebar row take the same
  colour, and a legend in the sidebar spells it out.
* **Follow mode.** A selected object is kept centred as it moves; the view
  chases it smoothly rather than snapping.
* **Zoom** from 1x to 6x with the on-screen buttons or `+` / `-`.
* **Mark a person.** A marked track turns red and the view zooms to it whenever
  it is on screen. The mark rides the tracker, so it survives occlusion up to
  the lost-frame buffer, and ends when the tracker loses the track. It is not
  face recognition and does not re-identify anyone after that.
* **Animals.** The ten animal classes the detector can actually name (dog, cat,
  bird, horse, sheep, cow, elephant, bear, zebra, giraffe) get a factual note in
  the panel. It does not identify species beyond those ten.
* **English / Hebrew toggle**, remembered per browser. The layout does not
  mirror: the sidebar, the control cluster and the HUD keep the same side in
  both languages, so switching language changes the words and nothing else.
  Hebrew words still read right-to-left within their own run — each one is
  fenced with bidi isolates so a Hebrew label sitting among Latin numbers
  cannot reorder what follows it.
* **Silhouette mode.** The `▣` button swaps bounding boxes for a segmented green
  silhouette (BodyPix MobileNet 0.5, stride 16). It costs real frame rate, so it
  is off by default and one press turns it back off.
* **Appearance re-identification.** When the tracker drops someone behind a
  pillar or out of frame, a naive tracker returns a new id and the same shopper
  is counted twice. A coarse colour descriptor — torso band, leg band, whole box,
  build — lets a reappearing figure inherit its old id within 45 seconds.

### What re-identification here is, and is not

It reads **clothing colour and proportion**, not faces. It is scoped to the
current session, stored only in memory, and it breaks the moment someone changes
clothes. That is deliberate: it solves the double-counting problem without
building a biometric identity record. Recognising a person across a change of
clothes means storing face templates, which is biometric processing and carries
obligations — notice, lawful basis, retention limits, DPIA under GDPR, and
stricter rules again under laws like Illinois BIPA. That is a decision for the
operator and their counsel, not something to switch on by default.
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

## Owner enrolment (face recognition, opt-in)

The `☻` button enrols **one** face — the person holding the device — and marks
them on screen with a black box keylined in white and an `OWNER` chip. It is the
only face recognition in the app, and it is off until you press the button.

How it works: five 128-float descriptors are taken from the live camera
(`face_recognition` + `face_landmark_68_tiny`), averaged, and compared each
1.2 s against the largest face in frame; under a Euclidean distance of 0.52 the
enclosing track is flagged as the owner. Press the button again to erase it.

What it does **not** do, by construction:

* **No photographs are shipped in the file.** The distributed `.html` contains
  model weights only. The enrolment is made on your machine, from your camera.
* **Nothing is uploaded.** The descriptor is written to `localStorage` in your
  own browser and never leaves it. There is no server to send it to.
* **One person, not a watchlist.** There is a single slot, and the only thing
  stored is a vector of 128 numbers — no image is kept.

This is still biometric processing. If you deploy it beyond your own device,
notice, a lawful basis, retention limits and a DPIA under GDPR apply, and
stricter rules again under laws like Illinois BIPA.

### What it deliberately does not do

Beyond that single opt-in slot it does not identify anyone: no matching against
a database, no watchlist, and no lookup of a detected person on the internet.
Marking is a handle on a live track, not on a human being. For everyone who is
not the enrolled owner, it reports what the camera can see about an unidentified
figure, and nothing that would attach a name to them.

### Why it feels fast at two detections a second

Detection runs in a worker, and rendering does not wait for it.

The measurement that decided this: of a 451ms frame, inference was 444ms and
everything else — preprocessing, decoding, drawing, the face pass — was under
9ms put together. There is no fat to trim. Worse, that 444ms ran on the main
thread, so it was not slowness but a freeze: nothing repainted, no click
landed, the video itself stopped updating.

So the work moved rather than shrank:

| | before | after |
| --- | --- | --- |
| Rendering | 2.1 FPS | **62 FPS** |
| Detection | 2.1 FPS | **3.0 FPS** |
| Detection, with a zone | 1.1 FPS | **2.6 FPS** |

The model is untouched and detection is unchanged — the same weights at the
same input size finding the same objects. What changed is that the overlay now
redraws every animation frame, carrying each box forward along its measured
velocity (capped at half a second, so a stale velocity cannot invent motion)
while the worker thinks. Hit-testing and zone occupancy still use the real
detected box, never the extrapolated one.

Two constraints shaped the worker, both measured rather than assumed:

* **A `file://` page cannot construct a module worker.** That is exactly why
  onnxruntime-web's own `proxy` mode hangs here rather than failing loudly. The
  worker is a classic one.
* **A blob URL minted on the page cannot be imported from inside the worker.**
  So the worker receives the runtime as text and mints its own blob URL.

`SharedArrayBuffer` is absent on `file://`, so WASM threads are not available
and inference stays single-threaded. That is the ceiling on detection rate, and
only WebGPU or a smaller model lifts it.

Frame preparation moved into the worker as well. The page now only calls
`createImageBitmap`, which crops and scales on the GPU, and transfers the
bitmap; the letterbox and the float conversion happen in the worker on an
`OffscreenCanvas`. Main-thread time per frame fell from 6.6ms to 0.9ms, and
detection rose from 2.1 to 3.0 FPS, because the page and the worker stopped
contending for the same work. Browsers without `OffscreenCanvas` in workers
keep the old path automatically.

Two smaller fixes came out of the same profile: the input buffer round-trips to
the worker and back rather than being reallocated every frame (6ms of GC churn),
and the zone close-up pass is spaced at five times the measured inference
instead of a fixed interval, so it costs about 15% of the detection rate rather
than half of it.

### On a phone

The layout reflows below 860px: the object panel moves under the video and
scrolls as one piece, so the object list is never squeezed out by the legend.
The control column becomes a single row of finger-sized buttons along the
bottom of the video, wrapping onto two rows on 320px screens rather than
shrinking the targets. The page tracks the browser's address bar (`dvh`) so its
bottom edge is not hidden under it, and placing zone corners does not scroll or
zoom the page under your finger. Tested in emulated Pixel 7 (412px) and first
generation iPhone SE (320px) viewports with touch input.

Two things an emulator cannot show:

* **Speed.** A phone runs the same WASM backend on a slower core. Detection
  will be slower than on a desktop; rendering still runs at display rate,
  because detection is in a worker.
* **Opening the file.** A phone only exposes the camera — and WebGPU — to a
  secure page. A downloaded `.html` opened from the Files app loads as
  `content://` on Android and in a Quick Look preview on iPhone, and neither
  is secure, so the camera simply does not exist there. On a phone the app has
  to be opened from an `https` address. If it is not, it now says exactly that
  instead of blaming the browser.

On a phone served over `https`, Chrome's WebGPU is the difference that
matters: flagship Android GPUs (an S26 Ultra's Adreno among them) run it, and
the detector tries WebGPU first. The HUD shows `WEBGPU` when it is live.

### Zones

The `⬠` button starts a zone. Click or tap to place corners, then click the
first corner again (or press Enter) to close it; Escape discards a half-drawn
shape. Points are normalised 0..1 against the frame, so a zone drawn at 640x480
still lines up after the camera switches resolution.

Zones last for the current run only. Reopening the app starts with a clean
frame, and zones an earlier build had saved are cleared on the way in. While
any zone exists, a `✕` button next to `⬠` removes all of them in one tap.

A zone does three things:

* **Alerts on entry.** Occupancy is tested against the middle of a person's
  feet, not the centre of their box — a body box leans across a boundary well
  before the person does. Crossing in raises an alert naming the track id, and
  the zone counts entries.
* **Marks who is inside.** An occupant keeps their own colour and gains an
  `IN ZONE` chip and a dashed green outline, so the gender colours still mean
  what the legend says they mean.
* **Looks harder inside it.** A second detection pass runs on a crop of the
  zone alone, upscaled to the model's full 640px input. Someone forty pixels
  tall at the back of a zone becomes two hundred pixels in that crop, which is
  the difference between a miss and a detection. Hits are merged into the
  full-frame pass and dropped when they duplicate one it already had.

The close-up pass is a second inference, so it costs real frame rate. It is
capped to once every 500 ms and takes one zone per turn, round-robin, so the
cost does not grow with the number of zones.

One limit worth knowing: a person close enough that their box is clipped by the
bottom of the frame has their foot point at the very bottom edge. A zone that
does not reach the bottom of the frame will not count them, because their feet
are not in the picture to be counted.

### The detector: YOLO26m, and what it needs

Detection is YOLO26m (20.4M parameters, 68.4 GFLOPs) exported to ONNX and run by
onnxruntime-web. It replaced COCO-SSD, and on a test frame the difference is
plain: two people at 0.96 and 0.95 where COCO-SSD gave 0.85 and 0.69, with
tighter boxes, plus a `tie` COCO-SSD did not see at all.

Three things make it work as a single offline file:

* **`nms=False` on export.** YOLO26 has an end-to-end head, and that flag keeps
  it: the model emits `(1, 300, 6)` — already decoded, already sorted, no
  non-maximum suppression left to write in JavaScript. Omit the flag and the
  export falls back to the legacy raw `(1, 84, 8400)` head instead.
* **The `bundle` build of onnxruntime-web.** The ordinary build imports its
  WebAssembly glue as a sibling `.mjs` at runtime, which a `file://` page is not
  allowed to fetch. The bundle has it inlined. It is then imported from a blob
  URL, because a relative import of the same text is blocked as cross-origin.
* **fp32, not fp16.** The fp16 export is half the size and, on a test frame,
  indistinguishable — same three detections, confidences within 0.001, boxes
  within 0.1px. It is not used, because a WebGPU device must advertise the
  `shader-f16` feature to run it and one that does not falls back to the CPU.

**It needs WebGPU.** At 68 GFLOPs this is roughly seventy times the arithmetic
of the COCO-SSD it replaced. Measured on the WASM CPU backend, single-threaded:
**0.25 frames per second** — four seconds a frame, which is not a working app.
The HUD names the live backend (`WEBGPU` or `WASM`) and the app says so out loud
when it falls back, rather than looking broken. WebGPU performance has not been
measured here: this container has no GPU, so that number has to come from the
machine it actually runs on.

If WebGPU is unavailable on the target machine, the fix is a smaller model, not
a faster runtime: `export_yolo.py` takes `yolo26s` (22.8 GFLOPs) or `yolo26n`
(6.1 GFLOPs) with no other change.

### What the detector cannot name

YOLO26m is trained on COCO: the same 80 coarse classes. It reports `car`, never
a make, model or year, and it has no firearm class at all. A bigger detector is
more accurate on those 80 things; it does not add an eighty-first. Adding either means a second model; printing
a guess would be a fabricated detection.

**Vehicle make / model / year.** Public fine-grained datasets are
Stanford Cars (196 classes, nothing after 2012), CompCars (~1,700 models),
VMMRdb (~9,000 classes, 1950–2016) and BoxCars116k (surveillance viewpoints).
None covers 2025 model years, so a purely visual classifier cannot name a 2025
Audi A5 — the training data does not exist publicly. For an exact make, model
and year the practical route is the one real systems use: read the number plate
(ANPR) and look the registration up. Vendors in that space include Plate
Recognizer, Spectrico's make/model classifier and Sighthound.

**Weapons — the red box is wired, the detector is not.** A track whose class is
a firearm draws in red, and `WEAPON_CLASSES` in `app.js` is the list it checks.
Nothing fires today, because there is no COCO firearm class and no firearm model
is bundled: the hook is there so a swapped-in model lights it up, not so the app
can pretend to see guns.

There is no COCO firearm class. Public options are the UGR/Sohas
handgun-and-knife sets and the various gun datasets on Roboflow Universe, fine-
tuned into YOLOv8/YOLO11. Be aware of the failure mode before deploying in a
mall: open weapon detectors routinely fire on phones, umbrellas, power tools and
dark clothing folds, and a false gun alert is not a harmless error — it triggers
an evacuation or an armed response. The commercial vendors in this space
(ZeroEyes, Omnilert, Actuate, Evolv) exist because clearing that accuracy bar is
the hard part, not the detection itself.

Either model belongs in the **Python edition**, not this one:
`backend/app/models/detector.py` is the single swap point, it already accepts any
Ultralytics-format weights, and a GPU there will carry two models where a browser
will not.

## How it differs from the desktop app

|  | Desktop (`../backend`) | Browser (this) |
| --- | --- | --- |
| Detector | YOLOv8 / YOLO11 via Ultralytics | YOLO26m via onnxruntime-web |
| Age / apparent gender | No | Yes, on-device |
| Zoom, follow, tamper watch, auto-record | No | Yes |
| Tracker | ByteTrack / BoT-SORT | Greedy IoU association (`app.js`) |
| Runs on | Python + PyTorch | ONNX Runtime Web (detector) + TensorFlow.js (face, segmentation) |
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

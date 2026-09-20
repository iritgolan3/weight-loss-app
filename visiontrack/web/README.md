# VisionTrack Live — browser edition

A single self-contained `.html` file that detects and tracks people and vehicles
from the camera, entirely inside the browser. No Python, no install, no server,
no network. Built for machines where Windows App Control or SmartScreen refuses
to run the desktop launcher, and it works on a phone as well.

```bash
python build.py          # writes dist/VisionTrack-Live.html (~31 MB)
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

### What the detector cannot name

COCO-SSD knows 80 coarse classes. It reports `car`, never a make, model or year,
and it has no firearm class at all. Adding either means a second model; printing
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

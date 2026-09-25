# VisionTrack Live — hosted build

This branch holds only the built app, served by GitHub Pages at
https://iritgolan3.github.io/weight-loss-app/

It exists because a phone only lets a page use the camera (and WebGPU) when the
page is opened from an https address. Opening the downloaded `.html` from a
phone's Files app loads it as `content://`, and there the camera does not exist.

Source and build instructions: `visiontrack/web/` on the
`claude/practical-maxwell-duu14h` branch. Rebuild with
`python build.py --detector yolo26n --out dist/VisionTrack-yolo26n.html`
and copy the result here as `index.html`.

The sign-in gate (`123` in all three fields) is a demo prop, not security:
anyone with this address can open the app.

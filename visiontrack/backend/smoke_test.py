"""End-to-end smoke test for a running VisionTrack backend.

Exercises the whole workflow against the real API: register a video, create a
zone, run a real analysis, read back tracks/timeline, and produce every export.

    python backend/smoke_test.py                     # uses http://127.0.0.1:8000
    python backend/smoke_test.py --url http://127.0.0.1:8008 --video my.mp4
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

PASS, FAIL = "  [ok] ", "  [FAIL] "
failures: list[str] = []


def call(method: str, url: str, payload=None, raw=False):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json"} if data else {}
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=120) as response:
        body = response.read()
        return body if raw else (json.loads(body) if body else None)


def upload(url: str, path: Path):
    boundary = "----visiontrack-smoke"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
        "Content-Type: video/mp4\r\n\r\n"
    ).encode() + path.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    request = urllib.request.Request(
        f"{url}/api/videos", data=body, method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        return json.loads(response.read())


def check(label: str, condition: bool, detail: str = "") -> None:
    print((PASS if condition else FAIL) + label + (f" — {detail}" if detail else ""))
    if not condition:
        failures.append(label)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--video", help="video file to upload (defaults to the demo clip)")
    parser.add_argument("--mode", default="fast", choices=["fast", "balanced", "high_accuracy"])
    args = parser.parse_args()
    base = args.url.rstrip("/")

    print(f"\nVisionTrack smoke test against {base}\n" + "-" * 52)

    try:
        check("health", call("GET", f"{base}/api/health")["status"] == "ok")
    except urllib.error.URLError as exc:
        print(f"{FAIL}backend unreachable — {exc}")
        return 1

    system = call("GET", f"{base}/api/system")
    check("system info", system["backend_ready"],
          f"torch {system['torch_version']} · device {system['device_in_use']}")

    if args.video:
        video = upload(base, Path(args.video))
    else:
        if not system["demo_video_available"]:
            print(f"{FAIL}no demo video installed; pass --video PATH")
            return 1
        video = call("POST", f"{base}/api/videos/demo")
    vid = video["id"]
    check("video registered", video["frame_count"] > 0,
          f"{video['filename']} {video['width']}x{video['height']} @ {video['fps']:.0f}fps")

    zone = call("POST", f"{base}/api/videos/{vid}/zones", {
        "name": "Smoke Zone",
        "points": [[0.05, 0.5], [0.95, 0.5], [0.95, 0.9], [0.05, 0.9]],
        "color": "#39ff14",
    })
    check("zone created", len(zone["points"]) == 4, zone["id"])

    job = call("POST", f"{base}/api/videos/{vid}/analyze", {"mode": args.mode, "preview": False})
    print(f"  .. analysing in {args.mode} mode on {job['device']} …")
    deadline = time.time() + 900
    while time.time() < deadline:
        job = call("GET", f"{base}/api/jobs/{job['id']}")
        if job["status"] in ("completed", "failed", "stopped"):
            break
        time.sleep(2)
    check("analysis completed", job["status"] == "completed",
          f"{job['stats']['unique_objects']} objects · "
          f"{job['stats']['processing_fps']:.1f} proc fps · "
          f"{job['stats']['detection_fps']:.1f} det fps")

    tracks = call("GET", f"{base}/api/videos/{vid}/tracks")
    check("tracks returned", len(tracks) > 0, f"{len(tracks)} tracks")
    if tracks:
        first = tracks[0]
        check("track has real timing", first["last_seen"] >= first["first_seen"],
              f"id {first['id']} ({first['cls']}) visible {first['visible_duration']}s")
        check("track has a trajectory", len(first.get("trajectory", [])) >= 2,
              f"{len(first.get('trajectory', []))} points")
        check("real-world speed is not invented", first["speed_real_world"] is None)
        check("zone accounting present", any(z["zone_id"] == zone["id"] for z in first["zones"]))

    timeline = call("GET", f"{base}/api/videos/{vid}/timeline")
    check("timeline stored", len(timeline["samples"]) > 0, f"{len(timeline['samples'])} samples")

    data = call("GET", f"{base}/api/videos/{vid}/export/data?format=json", raw=True)
    check("JSON export", b'"objects"' in data, f"{len(data) // 1024} KB")
    csv = call("GET", f"{base}/api/videos/{vid}/export/data?format=csv", raw=True)
    check("CSV export", csv.startswith(b"frame,timestamp_s"),
          f"{max(0, len(csv.splitlines()) - 1)} detection rows")

    export = call("POST", f"{base}/api/videos/{vid}/export/video", {"show_hud": True})
    deadline = time.time() + 900
    while time.time() < deadline:
        export = call("GET", f"{base}/api/exports/{export['id']}")
        if export["status"] in ("completed", "failed"):
            break
        time.sleep(2)
    check("annotated MP4 export", export["status"] == "completed", export.get("filename") or "")
    if export["status"] == "completed":
        out = Path(export["output"])
        check("MP4 file on disk", out.exists() and out.stat().st_size > 0,
              f"{out.stat().st_size // 1024} KB" if out.exists() else "missing")

    call("DELETE", f"{base}/api/videos/{vid}/zones/{zone['id']}")
    check("zone deleted", all(z["id"] != zone["id"]
                              for z in call("GET", f"{base}/api/videos/{vid}/zones")["zones"]))

    print("-" * 52)
    if failures:
        print(f"{len(failures)} check(s) failed: " + ", ".join(failures))
        return 1
    print("All checks passed.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())

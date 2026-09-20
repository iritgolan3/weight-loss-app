/* VisionTrack Live - in-browser detection, tracking and inspection.
 *
 *   camera frame -> COCO-SSD detection -> IoU tracker (persistent ids)
 *                -> trails, timers -> canvas overlay
 *   selected person -> face crop -> age / apparent-gender estimate
 *
 * Everything runs on this device. Nothing is uploaded, and nothing is
 * simulated: each box comes from the model and each timer from the clock.
 * Where a quantity cannot be measured honestly (real-world height without a
 * reference) it is reported as unavailable rather than invented.
 */
(function () {
  'use strict';

  var WANTED = {
    person: 1, bicycle: 1, car: 1, motorcycle: 1, bus: 1, truck: 1,
    'traffic light': 1, 'stop sign': 1, dog: 1, cat: 1, backpack: 1,
    handbag: 1, suitcase: 1, chair: 1, 'cell phone': 1, bottle: 1
  };
  var SCORE_MIN = 0.45;
  var IOU_MATCH = 0.3;
  var MAX_LOST = 18;
  var TRAIL_MAX = 45;
  var STATIONARY_PX_S = 22;
  var FACE_EVERY_MS = 700;     // at most one face inference this often
  var FACE_REFRESH_MS = 4000;  // re-estimate a known face this often
  var ZOOM_MIN = 1, ZOOM_MAX = 6, ZOOM_STEP = 1.35;

  // Tamper watch: a struck, covered or re-aimed camera all show up as a sudden
  // whole-frame change that object motion never produces.
  var TAMPER_GRID_W = 32, TAMPER_GRID_H = 24;
  var TAMPER_DIFF = 0.22;       // mean abs luma change, 0..1, across the whole frame
  var TAMPER_DARK = 0.45;       // fraction of previous brightness that counts as covered
  var TAMPER_SHOCK = 28;        // m/s^2 total acceleration that counts as a physical hit
  var TAMPER_COOLDOWN_MS = 6000;
  var CLIP_SECONDS = 30;        // auto-clip length, extended by further triggers

  var HE = {
    person: 'אדם', bicycle: 'אופניים', car: 'רכב', motorcycle: 'אופנוע',
    bus: 'אוטובוס', truck: 'משאית', dog: 'כלב', cat: 'חתול',
    'traffic light': 'רמזור', 'stop sign': 'תמרור עצור', backpack: 'תיק גב',
    handbag: 'תיק יד', suitcase: 'מזוודה', chair: 'כיסא',
    'cell phone': 'טלפון', bottle: 'בקבוק'
  };

  var els = {};
  ['video','overlay','frame','viewport','splash','splashMsg','startBig','start','stop','flip',
   'err','bar','barFill','hud','hudState','hudRes','list','count','detail',
   'sFps','sNow','sTotal','sTime','zoombox','zoomIn','zoomOut','zoomLevel','follow',
   'recBtn','recbar','recDot','recTime','alertMsg','clips']
    .forEach(function (id) { els[id] = document.getElementById(id); });

  var model = null, faceReady = false, stream = null, running = false;
  var facing = 'environment', pending = false, faceBusy = false;
  var tracks = [], nextId = 1, startedAt = 0, lastFrame = 0, fps = 0, rafId = 0;
  var selectedId = null, lastFaceAt = 0;
  var view = { zoom: 1, cx: 0.5, cy: 0.5, follow: true };
  var calib = null;               // {px, cm} from a user-supplied reference
  var faceCanvas = document.createElement('canvas');

  var tamper = {
    canvas: document.createElement('canvas'), prev: null, prevLuma: 0,
    lastTrigger: 0, shock: 0, armed: false
  };
  var rec = { recorder: null, chunks: [], startedAt: 0, stopAt: 0, auto: false, timer: 0 };
  var clips = [];

  // ---------------------------------------------------------------- helpers

  function iou(a, b) {
    var x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]);
    var x2 = Math.min(a[0] + a[2], b[0] + b[2]), y2 = Math.min(a[1] + a[3], b[1] + b[3]);
    var w = x2 - x1, h = y2 - y1;
    if (w <= 0 || h <= 0) return 0;
    var inter = w * h;
    return inter / (a[2] * a[3] + b[2] * b[3] - inter);
  }

  function clock(s) {
    s = Math.max(0, Math.floor(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function human(s) {
    if (s < 60) return Math.round(s) + ' שנ\'';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' דק\'';
    var h = Math.floor(m / 60), r = m % 60;
    return r ? h + ' שע\' ' + r + ' דק\'' : h + ' שע\'';
  }

  function heading(trail) {
    if (trail.length < 6) return null;
    var a = trail[Math.max(0, trail.length - 6)], b = trail[trail.length - 1];
    var dx = b[0] - a[0], dy = b[1] - a[1];
    if (Math.hypot(dx, dy) < 6) return null;
    var deg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    var names = ['שמאלה', 'שמאלה-למטה', 'למטה', 'ימינה-למטה',
                 'ימינה', 'ימינה-למעלה', 'למעלה', 'שמאלה-למעלה'];
    // 0deg points right in screen space, but the camera is mirrored for selfies;
    // this is the on-screen direction, which is what the operator sees.
    var idx = Math.round(((deg + 180) % 360) / 45) % 8;
    return names[idx];
  }

  function fail(msg, detail) {
    els.err.hidden = false;
    els.err.innerHTML = '<b>' + msg + '</b>' + (detail ? '<br><br>' + detail : '');
    els.bar.hidden = true;
  }

  // ------------------------------------------------------------- the tracker

  function updateTracks(detections, now) {
    var i, j;
    for (i = 0; i < tracks.length; i++) tracks[i].matched = false;

    var pairs = [];
    for (i = 0; i < detections.length; i++) {
      for (j = 0; j < tracks.length; j++) {
        if (tracks[j].cls !== detections[i].class) continue;
        var s = iou(detections[i].bbox, tracks[j].bbox);
        if (s >= IOU_MATCH) pairs.push([s, i, j]);
      }
    }
    pairs.sort(function (a, b) { return b[0] - a[0]; });

    var usedDet = {}, usedTrack = {};
    for (i = 0; i < pairs.length; i++) {
      var di = pairs[i][1], ti = pairs[i][2];
      if (usedDet[di] || usedTrack[ti]) continue;
      usedDet[di] = usedTrack[ti] = 1;
      var t = tracks[ti], d = detections[di];
      var cx = d.bbox[0] + d.bbox[2] / 2, cy = d.bbox[1] + d.bbox[3] / 2;
      var dt = now - t.lastSeen;
      if (dt > 0.01) {
        t.speed = 0.6 * t.speed + 0.4 * (Math.hypot(cx - t.cx, cy - t.cy) / dt);
      }
      t.bbox = d.bbox; t.cx = cx; t.cy = cy; t.score = d.score;
      t.lastSeen = now; t.lost = 0; t.matched = true;
      t.trail.push([cx, cy]);
      if (t.trail.length > TRAIL_MAX) t.trail.shift();
    }

    for (i = 0; i < detections.length; i++) {
      if (usedDet[i]) continue;
      var nd = detections[i];
      var ncx = nd.bbox[0] + nd.bbox[2] / 2, ncy = nd.bbox[1] + nd.bbox[3] / 2;
      tracks.push({
        id: nextId++, cls: nd.class, bbox: nd.bbox, score: nd.score,
        cx: ncx, cy: ncy, speed: 0, firstSeen: now, lastSeen: now,
        lost: 0, matched: true, trail: [[ncx, ncy]],
        ageSum: 0, ageN: 0, gender: null, genderProb: 0, faceAt: 0, faceTried: 0
      });
    }

    var kept = [];
    for (i = 0; i < tracks.length; i++) {
      if (!tracks[i].matched) {
        tracks[i].lost++;
        if (tracks[i].lost > MAX_LOST) {
          if (tracks[i].id === selectedId) selectedId = null;
          continue;
        }
      }
      kept.push(tracks[i]);
    }
    tracks = kept;
  }

  function byId(id) {
    for (var i = 0; i < tracks.length; i++) if (tracks[i].id === id) return tracks[i];
    return null;
  }

  // -------------------------------------------------------- face attributes

  /* Crops the upper third of a person's box - where a head is if the box is a
     standing person - and runs the face detector plus the age/gender head on it.
     Runs at most once per FACE_EVERY_MS so it never starves the main loop. */
  function maybeEstimateFace(now) {
    if (!faceReady || faceBusy) return;
    var wall = performance.now();
    if (wall - lastFaceAt < FACE_EVERY_MS) return;

    var target = null;
    for (var i = 0; i < tracks.length; i++) {
      var t = tracks[i];
      if (t.cls !== 'person' || t.lost > 0) continue;
      var stale = wall - t.faceAt > FACE_REFRESH_MS;
      if (!stale) continue;
      if (t.id === selectedId) { target = t; break; }   // selected person first
      if (!target) target = t;
    }
    if (!target) return;

    lastFaceAt = wall;
    faceBusy = true;
    var t2 = target;

    try {
      var v = els.video;
      var b = t2.bbox;
      // Head region: top 40% of the body box, widened a little.
      var pad = b[2] * 0.15;
      var sx = Math.max(0, b[0] - pad);
      var sy = Math.max(0, b[1]);
      var sw = Math.min(v.videoWidth - sx, b[2] + pad * 2);
      var sh = Math.min(v.videoHeight - sy, b[3] * 0.45);
      if (sw < 24 || sh < 24) { faceBusy = false; t2.faceAt = wall; return; }

      var size = 192;
      faceCanvas.width = size;
      faceCanvas.height = Math.max(1, Math.round(size * sh / sw));
      faceCanvas.getContext('2d').drawImage(v, sx, sy, sw, sh,
                                            0, 0, faceCanvas.width, faceCanvas.height);

      var opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 192, scoreThreshold: 0.4 });
      faceapi.detectSingleFace(faceCanvas, opts).withAgeAndGender().then(function (res) {
        faceBusy = false;
        t2.faceAt = performance.now();
        t2.faceTried++;
        if (!res) return;
        t2.ageSum += res.age;
        t2.ageN++;
        t2.gender = res.gender;
        t2.genderProb = res.genderProbability;
      }).catch(function () {
        faceBusy = false;
        t2.faceAt = performance.now();
        t2.faceTried++;
      });
    } catch (e) {
      faceBusy = false;
    }
  }

  // --------------------------------------------------- tamper watch + recording

  /* Downscales the frame to a 32x24 luma grid and compares it with the previous
     one. A person walking past changes a small part of that grid; a camera that
     is knocked, re-aimed or covered changes nearly all of it at once. */
  function checkTamper() {
    if (!tamper.armed) return null;
    var v = els.video;
    if (!v.videoWidth) return null;

    var c = tamper.canvas;
    c.width = TAMPER_GRID_W; c.height = TAMPER_GRID_H;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(v, 0, 0, TAMPER_GRID_W, TAMPER_GRID_H);
    var data = ctx.getImageData(0, 0, TAMPER_GRID_W, TAMPER_GRID_H).data;

    var n = TAMPER_GRID_W * TAMPER_GRID_H;
    var luma = new Float32Array(n);
    var sum = 0;
    for (var i = 0; i < n; i++) {
      var o = i * 4;
      var y = (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) / 255;
      luma[i] = y; sum += y;
    }
    var mean = sum / n;

    var reason = null;
    if (tamper.prev) {
      var diff = 0;
      for (var j = 0; j < n; j++) diff += Math.abs(luma[j] - tamper.prev[j]);
      diff /= n;
      if (diff > TAMPER_DIFF) reason = 'תזוזה חדה של המצלמה';
      else if (tamper.prevLuma > 0.08 && mean < tamper.prevLuma * TAMPER_DARK) {
        reason = 'המצלמה כוסתה';
      }
    }
    if (tamper.shock > TAMPER_SHOCK) {
      reason = 'זוהתה פגיעה פיזית';
      tamper.shock = 0;
    }

    tamper.prev = luma;
    tamper.prevLuma = mean;

    if (!reason) return null;
    var wall = performance.now();
    if (wall - tamper.lastTrigger < TAMPER_COOLDOWN_MS) return null;
    tamper.lastTrigger = wall;
    return reason;
  }

  function showAlert(text) {
    els.alertMsg.hidden = false;
    els.alertMsg.textContent = '⚠ ' + text;
    clearTimeout(showAlert._t);
    showAlert._t = setTimeout(function () { els.alertMsg.hidden = true; }, 8000);
  }

  function recorderMime() {
    var options = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    for (var i = 0; i < options.length; i++) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(options[i])) return options[i];
    }
    return '';
  }

  /* Records the camera stream itself rather than a composited canvas: detection
     already competes for the CPU, and a dropped-frame recording is worse than
     one without overlays. */
  function startRecording(auto, reason) {
    if (rec.recorder || !stream || !window.MediaRecorder) return;
    var mime = recorderMime();
    try {
      rec.recorder = mime ? new MediaRecorder(stream, { mimeType: mime })
                          : new MediaRecorder(stream);
    } catch (e) {
      showAlert('הדפדפן לא תומך בהקלטה');
      return;
    }
    rec.chunks = [];
    rec.auto = !!auto;
    rec.reason = reason || 'הקלטה ידנית';
    rec.startedAt = performance.now();
    rec.stopAt = auto ? rec.startedAt + CLIP_SECONDS * 1000 : 0;

    rec.recorder.ondataavailable = function (e) {
      if (e.data && e.data.size) rec.chunks.push(e.data);
    };
    rec.recorder.onstop = function () {
      var blob = new Blob(rec.chunks, { type: rec.chunks.length ? rec.chunks[0].type : 'video/webm' });
      var seconds = (performance.now() - rec.startedAt) / 1000;
      clips.unshift({
        url: URL.createObjectURL(blob),
        name: 'visiontrack-' + new Date().toISOString().replace(/[:.]/g, '-') + '.webm',
        seconds: seconds, size: blob.size, reason: rec.reason,
        at: new Date().toLocaleTimeString('he-IL')
      });
      if (clips.length > 8) {
        URL.revokeObjectURL(clips.pop().url);
      }
      rec.recorder = null;
      renderClips();
      updateRecUi();
    };
    rec.recorder.start(1000);
    els.recBtn.classList.add('on');
    updateRecUi();
    if (auto) showAlert(reason + ' — מקליט');
  }

  function stopRecording() {
    if (rec.recorder && rec.recorder.state !== 'inactive') rec.recorder.stop();
    els.recBtn.classList.remove('on');
  }

  function updateRecUi() {
    var on = !!rec.recorder;
    els.recDot.hidden = !on;
    if (on) {
      els.recTime.textContent = clock((performance.now() - rec.startedAt) / 1000);
    }
  }

  function renderClips() {
    if (!clips.length) { els.clips.hidden = true; return; }
    els.clips.hidden = false;
    els.clips.innerHTML = clips.map(function (c) {
      return '<div class="clip"><div class="cl"><b>' + c.reason + '</b>' +
        c.at + ' · ' + Math.round(c.seconds) + ' שנ\' · ' +
        (c.size / 1048576).toFixed(1) + 'MB</div>' +
        '<a href="' + c.url + '" download="' + c.name + '">שמור</a></div>';
    }).join('');
  }

  // ----------------------------------------------------------------- drawing

  function draw(ctx, w, h, scale) {
    ctx.clearRect(0, 0, w, h);
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    var visible = tracks.filter(function (t) { return t.lost === 0; });

    visible.forEach(function (t) {
      if (t.trail.length < 2) return;
      var sel = t.id === selectedId;
      ctx.lineWidth = (sel ? 3 : 2) * scale;
      ctx.lineJoin = ctx.lineCap = 'round';
      for (var i = 1; i < t.trail.length; i++) {
        var a = (0.1 + 0.6 * (i / t.trail.length)).toFixed(3);
        ctx.strokeStyle = sel ? 'rgba(255,43,209,' + a + ')' : 'rgba(57,255,20,' + a + ')';
        ctx.beginPath();
        ctx.moveTo(t.trail[i - 1][0], t.trail[i - 1][1]);
        ctx.lineTo(t.trail[i][0], t.trail[i][1]);
        ctx.stroke();
      }
    });

    var fs = Math.round(13 * scale);
    visible.forEach(function (t) {
      var b = t.bbox, sel = t.id === selectedId;
      var color = sel ? '#ff2bd1' : '#39ff14';

      ctx.strokeStyle = color;
      ctx.lineWidth = (sel ? 3 : 2) * scale;
      ctx.strokeRect(b[0], b[1], b[2], b[3]);

      if (sel) {
        var len = Math.min(18 * scale, b[2] / 3, b[3] / 3);
        ctx.lineWidth = (4) * scale;
        ctx.beginPath();
        ctx.moveTo(b[0], b[1] + len); ctx.lineTo(b[0], b[1]); ctx.lineTo(b[0] + len, b[1]);
        ctx.moveTo(b[0] + b[2] - len, b[1]); ctx.lineTo(b[0] + b[2], b[1]); ctx.lineTo(b[0] + b[2], b[1] + len);
        ctx.moveTo(b[0], b[1] + b[3] - len); ctx.lineTo(b[0], b[1] + b[3]); ctx.lineTo(b[0] + len, b[1] + b[3]);
        ctx.moveTo(b[0] + b[2] - len, b[1] + b[3]); ctx.lineTo(b[0] + b[2], b[1] + b[3]); ctx.lineTo(b[0] + b[2], b[1] + b[3] - len);
        ctx.stroke();
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(t.cx, t.cy, 3 * scale, 0, Math.PI * 2);
      ctx.fill();

      var label = t.cls + ' ID:' + t.id + ' ' + t.score.toFixed(2);
      ctx.font = '600 ' + fs + 'px ui-monospace,Menlo,Consolas,monospace';
      var padX = 5 * scale, padY = 4 * scale;
      var tw = ctx.measureText(label).width;
      var lx = Math.max(0, Math.min(b[0], w - tw - padX * 2));
      var ly = Math.max(fs + padY * 2, b[1]);
      ctx.fillStyle = color;
      ctx.fillRect(lx, ly - fs - padY * 2, tw + padX * 2, fs + padY * 2);
      ctx.fillStyle = sel ? '#1a0014' : '#04160a';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lx + padX, ly - (fs + padY * 2) / 2);

      var seen = t.lastSeen - t.firstSeen;
      var lines = [];
      if (seen >= 1) lines.push(human(seen));
      if (t.ageN > 0) lines.push('~' + Math.round(t.ageSum / t.ageN) + 'y');
      if (lines.length) {
        var text = lines.join('  ');
        ctx.font = '600 ' + Math.round(fs * 0.85) + 'px ui-monospace,Menlo,Consolas,monospace';
        var tw2 = ctx.measureText(text).width;
        var ty = Math.min(h - 2, b[1] + b[3] + fs + padY);
        ctx.fillStyle = 'rgba(13,47,8,.85)';
        ctx.fillRect(lx, ty - fs, tw2 + padX * 2, fs + padY);
        ctx.fillStyle = '#d8ffd0';
        ctx.fillText(text, lx + padX, ty - fs / 2 + padY / 2);
      }
    });

    return visible;
  }

  // ------------------------------------------------------- zoom, pan, follow

  function applyView() {
    var vp = els.viewport.getBoundingClientRect();
    var fr = els.frame;
    var w = fr.offsetWidth, h = fr.offsetHeight;
    if (!w || !h) return;

    var z = view.zoom;
    // Keep the focus point inside the media so zooming never shows empty space.
    var halfW = 0.5 / z, halfH = 0.5 / z;
    var cx = Math.min(1 - halfW, Math.max(halfW, view.cx));
    var cy = Math.min(1 - halfH, Math.max(halfH, view.cy));

    var tx = vp.width / 2 - cx * w * z;
    var ty = vp.height / 2 - cy * h * z;
    // The frame is centred by the grid; offset from that natural position.
    var baseX = (vp.width - w) / 2, baseY = (vp.height - h) / 2;
    fr.style.transform = 'translate(' + (tx - baseX) + 'px,' + (ty - baseY) + 'px) scale(' + z + ')';
    els.zoomLevel.textContent = z.toFixed(1) + 'x';
  }

  function setZoom(z) {
    view.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    if (view.zoom === 1) { view.cx = 0.5; view.cy = 0.5; }
    applyView();
  }

  function followStep() {
    if (!view.follow || selectedId === null) return;
    var t = byId(selectedId);
    if (!t || t.lost > 0 || !els.overlay.width) return;
    var tx = t.cx / els.overlay.width, ty = t.cy / els.overlay.height;
    view.cx += (tx - view.cx) * 0.12;   // smooth chase, no jitter
    view.cy += (ty - view.cy) * 0.12;
    applyView();
  }

  // -------------------------------------------------------------- the detail

  function row(label, value, cls) {
    return '<div class="kv"><dt>' + label + '</dt><dd' +
      (cls ? ' class="' + cls + '"' : '') + '>' + value + '</dd></div>';
  }

  function renderDetail(now) {
    if (selectedId === null) { els.detail.hidden = true; return; }
    var t = byId(selectedId);
    if (!t) { els.detail.hidden = true; return; }
    els.detail.hidden = false;

    var seen = t.lastSeen - t.firstSeen;
    var isPerson = t.cls === 'person';
    var frameH = els.overlay.height || 1, frameW = els.overlay.width || 1;
    var html = '<div class="detail-h"><span class="t">' +
      (HE[t.cls] || t.cls) + ' · ID ' + t.id + '</span>' +
      '<button id="deselect">נקה</button></div>';

    html += row('סוג', t.cls);
    html += row('ודאות זיהוי', Math.round(t.score * 100) + '%');
    html += row('נראה לראשונה', clock(t.firstSeen));
    html += row('זמן במעקב', human(seen));
    html += row('מצב', t.speed > STATIONARY_PX_S ? 'בתנועה' : 'עומד');
    html += row('מהירות', Math.round(t.speed) + ' px/s');
    var dir = heading(t.trail);
    html += row('כיוון', dir || '—', dir ? '' : 'na');
    html += row('מיקום בפריים',
      Math.round(t.cx / frameW * 100) + '% / ' + Math.round(t.cy / frameH * 100) + '%');
    html += row('גודל תיבה', Math.round(t.bbox[2]) + '×' + Math.round(t.bbox[3]) + ' px');
    html += row('חלק מגובה הפריים', Math.round(t.bbox[3] / frameH * 100) + '%');
    html += row('נקודות מסלול', t.trail.length);

    if (isPerson) {
      if (t.ageN > 0) {
        html += row('גיל משוער', '~' + Math.round(t.ageSum / t.ageN) +
          ' (' + t.ageN + ' מדידות)', 'est');
        html += row('מגדר נראה', (t.gender === 'male' ? 'גבר' : 'אישה') +
          ' · ' + Math.round(t.genderProb * 100) + '%', 'est');
      } else if (t.faceTried > 0) {
        html += row('גיל / מגדר', 'לא נמצאו פנים', 'na');
      } else {
        html += row('גיל / מגדר', 'מחשב…', 'na');
      }

      if (calib) {
        var cm = t.bbox[3] / calib.px * calib.cm;
        html += row('גובה משוער', Math.round(cm) + ' ס״מ', 'est');
      } else {
        html += row('גובה', 'דרוש כיול', 'na');
      }
      html += '<div class="calib">' +
        '<input id="calibCm" type="number" inputmode="numeric" placeholder="גובה אמיתי בס״מ" />' +
        '<button id="calibSet">כייל</button>' +
        (calib ? '<button id="calibClear">אפס</button>' : '') +
        '</div>';
      html += '<div class="note">גיל ומגדר הם הערכה של מודל ראייה ממוחשבת מתוך תמונת הפנים — ' +
        'לא מסמך מזהה. המודל טועה, במיוחד בתאורה חלשה, בזווית, או עם מסכה ומשקפיים.<br><br>' +
        'גובה לא ניתן למדידה ממצלמה אחת בלי נקודת ייחוס. הקלד גובה אמיתי של אדם שנמצא ' +
        'עכשיו בפריים ולחץ "כייל" — אחריו יוצג גובה משוער לאנשים <b>באותו מרחק בערך</b> מהמצלמה. ' +
        'מי שרחוק או קרוב יותר יקבל מספר שגוי.</div>';
    }

    els.detail.innerHTML = html;

    var d = document.getElementById('deselect');
    if (d) d.onclick = function () { selectedId = null; renderDetail(now); };
    var cs = document.getElementById('calibSet');
    if (cs) cs.onclick = function () {
      var v = parseFloat((document.getElementById('calibCm') || {}).value);
      var tk = byId(selectedId);
      if (!v || v < 50 || v > 250 || !tk) return;
      calib = { px: tk.bbox[3], cm: v };
    };
    var cc = document.getElementById('calibClear');
    if (cc) cc.onclick = function () { calib = null; };
  }

  // -------------------------------------------------------------- the sidebar

  var lastPanel = 0;
  function renderPanel(visible, now) {
    if (performance.now() - lastPanel < 250) return;
    lastPanel = performance.now();

    els.sFps.textContent = fps ? fps.toFixed(1) : '—';
    els.sNow.textContent = visible.length;
    els.sTotal.textContent = nextId - 1;
    els.sTime.textContent = clock(now);
    els.count.textContent = visible.length;

    renderDetail(now);

    syncList(visible);
  }

  /* Rows are updated in place. Rebuilding the list markup on every tick would
     detach the row under the user's finger mid-tap, which made selection
     unreliable. */
  var rowEls = Object.create(null);

  function syncList(visible) {
    if (!visible.length) {
      if (els.list.firstChild && els.list.firstChild.className !== 'empty') els.list.innerHTML = '';
      if (!els.list.firstChild) {
        els.list.innerHTML = '<div class="empty">לא זוהה כלום כרגע.<br>נסה להתקרב או להאיר את החדר.</div>';
      }
      rowEls = Object.create(null);
      return;
    }
    var empty = els.list.querySelector('.empty');
    if (empty) { empty.remove(); }

    var present = Object.create(null);
    visible.slice().sort(function (a, b) { return a.id - b.id; }).forEach(function (t) {
      present[t.id] = 1;
      var r = rowEls[t.id];
      if (!r) {
        var el = document.createElement('div');
        el.className = 'row';
        el.dataset.id = t.id;
        el.innerHTML = '<div class="pip"></div><div><div class="n"></div><div class="m"></div></div><div class="c"></div>';
        els.list.appendChild(el);
        r = rowEls[t.id] = {
          el: el,
          name: el.querySelector('.n'),
          meta: el.querySelector('.m'),
          conf: el.querySelector('.c')
        };
        r.name.innerHTML = (HE[t.cls] || t.cls) +
          ' <span style="color:var(--muted)">ID ' + t.id + '</span>';
      }
      var seen = t.lastSeen - t.firstSeen;
      var extra = t.ageN > 0 ? ' · ~' + Math.round(t.ageSum / t.ageN) : '';
      var meta = clock(seen) + ' · ' + (t.speed > STATIONARY_PX_S ? 'בתנועה' : 'עומד') + extra;
      if (r.meta.textContent !== meta) r.meta.textContent = meta;
      var conf = Math.round(t.score * 100) + '%';
      if (r.conf.textContent !== conf) r.conf.textContent = conf;
      r.el.classList.toggle('sel', t.id === selectedId);
    });

    Object.keys(rowEls).forEach(function (id) {
      if (!present[id]) {
        rowEls[id].el.remove();
        delete rowEls[id];
      }
    });
  }

  function select(id) {
    selectedId = (selectedId === id) ? null : id;
    if (selectedId !== null && view.zoom === 1) setZoom(2);
    if (selectedId === null) { setZoom(1); }
    renderDetail((performance.now() - startedAt) / 1000);
  }

  // ------------------------------------------------------------- the main loop

  function loop() {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    followStep();

    var v = els.video;
    if (!v.videoWidth) return;

    var c = els.overlay;
    if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      els.hudRes.textContent = v.videoWidth + '×' + v.videoHeight;
      applyView();
    }

    if (pending) return;
    pending = true;

    model.detect(v, 20, SCORE_MIN).then(function (predictions) {
      pending = false;
      if (!running) return;

      var now = (performance.now() - startedAt) / 1000;
      var t0 = performance.now();
      if (lastFrame) {
        var inst = 1000 / Math.max(1, t0 - lastFrame);
        fps = fps ? fps * 0.8 + inst * 0.2 : inst;
      }
      lastFrame = t0;

      updateTracks(predictions.filter(function (p) {
        return WANTED[p.class] && p.score >= SCORE_MIN;
      }), now);

      maybeEstimateFace(now);

      var breach = checkTamper();
      if (breach) {
        if (rec.recorder && rec.auto) {
          rec.stopAt = performance.now() + CLIP_SECONDS * 1000;   // extend the clip
          showAlert(breach + ' — ממשיך להקליט');
        } else if (!rec.recorder) {
          startRecording(true, breach);
        }
      }
      if (rec.recorder && rec.auto && rec.stopAt && performance.now() > rec.stopAt) {
        stopRecording();
      }
      updateRecUi();

      var ctx = els.overlay.getContext('2d');
      var scale = Math.max(0.7, Math.min(2, els.overlay.width / 900));
      renderPanel(draw(ctx, els.overlay.width, els.overlay.height, scale), now);
    }).catch(function (e) {
      pending = false;
      console.error(e);
    });
  }

  // ------------------------------------------------------------------ startup

  function setProgress(pct, msg) {
    els.bar.hidden = false;
    els.barFill.style.width = pct + '%';
    if (msg) els.splashMsg.textContent = msg;
  }

  function b64ToBuffer(b64) {
    var bin = atob(b64);
    var buf = new ArrayBuffer(bin.length);
    var view8 = new Uint8Array(buf);
    for (var i = 0; i < bin.length; i++) view8[i] = bin.charCodeAt(i);
    return buf;
  }

  function decodeFaceWeights(entry) {
    var specs = [];
    entry.manifest.forEach(function (g) { specs = specs.concat(g.weights); });
    return tf.io.decodeWeights(b64ToBuffer(entry.weights), specs);
  }

  async function loadModels() {
    if (model) return;
    var spec = window.__VT_MODEL__;

    setProgress(15, 'טוען את מנוע הזיהוי…');
    await new Promise(function (r) { setTimeout(r, 30); });

    var specs = [];
    spec.manifest.forEach(function (g) { specs = specs.concat(g.weights); });
    var handler = tf.io.fromMemory({
      modelTopology: spec.topology,
      weightSpecs: specs,
      weightData: b64ToBuffer(spec.weights)
    });
    model = await cocoSsd.load({ base: 'lite_mobilenet_v2', modelUrl: handler });

    setProgress(60, 'טוען זיהוי פנים…');
    try {
      /* These weights are uint8-quantized, so they cannot be handed over as a
         raw Float32Array - tf.io.decodeWeights applies each tensor's scale and
         zero point from the manifest first. */
      await faceapi.nets.tinyFaceDetector.loadFromWeightMap(decodeFaceWeights(spec.faceDetector));
      await faceapi.nets.ageGenderNet.loadFromWeightMap(decodeFaceWeights(spec.ageGender));
      faceReady = true;
    } catch (e) {
      // Detection and tracking still work; only age/gender is lost.
      console.warn('face models unavailable:', e);
      faceReady = false;
    }
    setProgress(85, 'מתחבר למצלמה…');
  }

  async function startCamera() {
    els.err.hidden = true;
    els.start.disabled = els.startBig.disabled = true;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      fail('הדפדפן הזה לא תומך בגישה למצלמה.', 'נסה לפתוח את הקובץ ב-Chrome או ב-Edge.');
      els.start.disabled = els.startBig.disabled = false;
      return;
    }

    try {
      await loadModels();
    } catch (e) {
      fail('טעינת מנוע הזיהוי נכשלה.', String((e && e.message) || e));
      els.start.disabled = els.startBig.disabled = false;
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
    } catch (e) {
      var n = e && e.name;
      var hint = 'אשר את הבקשה לגישה למצלמה, וסגור תוכנות אחרות שמשתמשות בה.';
      if (n === 'NotAllowedError') hint = 'הגישה נדחתה. לחץ על סמל המצלמה בשורת הכתובת, אפשר גישה, ורענן.';
      if (n === 'NotFoundError') hint = 'לא נמצאה מצלמה מחוברת למכשיר.';
      if (n === 'NotReadableError') hint = 'תוכנה אחרת תופסת את המצלמה. סגור אותה ונסה שוב.';
      fail('לא הצלחתי לפתוח את המצלמה.', hint);
      els.start.disabled = els.startBig.disabled = false;
      return;
    }

    els.video.srcObject = stream;
    await els.video.play().catch(function () {});

    els.splash.hidden = true;
    els.hud.hidden = false;
    els.zoombox.hidden = false;
    els.recbar.hidden = false;
    tamper.prev = null; tamper.prevLuma = 0; tamper.shock = 0; tamper.lastTrigger = 0;
    // Give auto-exposure a moment to settle so the first frames do not look like tampering.
    setTimeout(function () { tamper.armed = true; }, 2500);
    armMotionSensor();
    els.stop.disabled = els.flip.disabled = false;
    els.hudState.textContent = faceReady ? 'מזהה · פנים פעיל' : 'מזהה';

    tracks = []; nextId = 1; fps = 0; lastFrame = 0; selectedId = null;
    view = { zoom: 1, cx: 0.5, cy: 0.5, follow: true };
    els.follow.classList.add('on');
    startedAt = performance.now();
    running = true;
    applyView();
    loop();
  }

  function stopCamera() {
    running = false;
    cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null;
    els.video.srcObject = null;
    els.hud.hidden = els.zoombox.hidden = els.recbar.hidden = true;
    els.detail.hidden = true;
    tamper.armed = false;
    stopRecording();
    els.splash.hidden = false;
    els.bar.hidden = true;
    els.splashMsg.textContent = 'הניתוח נעצר. ' + (nextId - 1) + ' אובייקטים זוהו בסך הכל.';
    els.startBig.disabled = els.start.disabled = false;
    els.stop.disabled = els.flip.disabled = true;
    els.frame.style.transform = '';
    var ctx = els.overlay.getContext('2d');
    ctx.clearRect(0, 0, els.overlay.width, els.overlay.height);
  }

  async function flipCamera() {
    facing = facing === 'environment' ? 'user' : 'environment';
    if (!running) return;
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
      els.video.srcObject = stream;
      await els.video.play().catch(function () {});
    } catch (e) {
      fail('לא הצלחתי להחליף מצלמה.', String((e && e.message) || e));
    }
  }

  // ------------------------------------------------------------------- events

  els.start.addEventListener('click', startCamera);
  els.startBig.addEventListener('click', startCamera);
  els.stop.addEventListener('click', stopCamera);
  els.flip.addEventListener('click', flipCamera);
  els.zoomIn.addEventListener('click', function () { setZoom(view.zoom * ZOOM_STEP); });
  els.zoomOut.addEventListener('click', function () { setZoom(view.zoom / ZOOM_STEP); });
  els.recBtn.addEventListener('click', function () {
    if (rec.recorder) stopRecording();
    else startRecording(false, 'הקלטה ידנית');
  });
  els.follow.addEventListener('click', function () {
    view.follow = !view.follow;
    els.follow.classList.toggle('on', view.follow);
  });

  els.list.addEventListener('click', function (e) {
    var row = e.target.closest ? e.target.closest('.row') : null;
    if (row && row.dataset.id) select(parseInt(row.dataset.id, 10));
  });

  els.overlay.addEventListener('click', function (e) {
    var rect = els.overlay.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width * els.overlay.width;
    var y = (e.clientY - rect.top) / rect.height * els.overlay.height;
    var best = null, bestArea = Infinity;
    tracks.forEach(function (t) {
      if (t.lost > 0) return;
      var b = t.bbox;
      if (x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3]) {
        var area = b[2] * b[3];
        if (area < bestArea) { bestArea = area; best = t; }
      }
    });
    select(best ? best.id : null);
  });

  /* A phone can feel a real knock. Desktops have no such sensor, so the frame
     comparison above stays the primary signal. iOS requires the permission be
     requested from a user gesture, which starting the camera provides. */
  function armMotionSensor() {
    if (typeof DeviceMotionEvent === 'undefined') return;
    function attach() {
      window.addEventListener('devicemotion', function (e) {
        var a = e.accelerationIncludingGravity;
        if (!a) return;
        var mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
        // Subtract gravity so only real shocks register.
        var excess = Math.abs(mag - 9.81);
        if (excess > tamper.shock) tamper.shock = excess;
      });
    }
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission().then(function (state) {
        if (state === 'granted') attach();
      }).catch(function () {});
    } else {
      attach();
    }
  }

  window.addEventListener('resize', applyView);
  window.addEventListener('keydown', function (e) {
    if (!running) return;
    if (e.key === '+' || e.key === '=') setZoom(view.zoom * ZOOM_STEP);
    if (e.key === '-' || e.key === '_') setZoom(view.zoom / ZOOM_STEP);
    if (e.key === 'Escape') select(null);
  });

  window.__VT_READY__ = true;
  window.__VT_DEBUG__ = function () {
    return {
      tracks: tracks.length, selected: selectedId, zoom: view.zoom,
      faceReady: faceReady, armed: tamper.armed,
      recording: !!rec.recorder, clips: clips.length,
      people: tracks.filter(function (t) { return t.cls === 'person'; }).map(function (t) {
        return { id: t.id, ageN: t.ageN, age: t.ageN ? Math.round(t.ageSum / t.ageN) : null,
                 gender: t.gender, tried: t.faceTried };
      })
    };
  };
})();

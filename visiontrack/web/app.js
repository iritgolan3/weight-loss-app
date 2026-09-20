/* VisionTrack Live - in-browser detection and tracking.
   Detection: COCO-SSD (TensorFlow.js), embedded in this file.
   Tracking:  greedy IoU association with a lost-frame buffer, below.
   Nothing is simulated: every box comes from the model, every timer from
   the real clock. */
(function () {
  'use strict';

  var CLASSES_OF_INTEREST = {
    person: 1, bicycle: 1, car: 1, motorcycle: 1, bus: 1, truck: 1,
    'traffic light': 1, 'stop sign': 1, dog: 1, cat: 1, backpack: 1, handbag: 1, suitcase: 1
  };
  var SCORE_MIN = 0.45;
  var IOU_MATCH = 0.3;
  var MAX_LOST = 18;        // frames a track survives without a detection
  var TRAIL_MAX = 45;       // points kept per trail
  var STATIONARY_PX_S = 22; // centre speed below which an object reads as stationary

  var els = {};
  ['video','overlay','splash','splashMsg','startBig','start','stop','flip','err','bar','barFill',
   'hud','hudState','hudRes','list','count','sFps','sNow','sTotal','sTime']
    .forEach(function (id) { els[id] = document.getElementById(id); });

  var model = null, stream = null, running = false, facing = 'environment';
  var tracks = [], nextId = 1, startedAt = 0, lastFrame = 0, fps = 0, rafId = 0;

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
    var m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  }

  function human(s) {
    if (s < 60) return Math.round(s) + ' שנ\'';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' דק\'';
    var h = Math.floor(m / 60), r = m % 60;
    return r ? h + ' שע\' ' + r + ' דק\'' : h + ' שע\'';
  }

  var HE = {
    person: 'אדם', bicycle: 'אופניים', car: 'רכב', motorcycle: 'אופנוע',
    bus: 'אוטובוס', truck: 'משאית', dog: 'כלב', cat: 'חתול',
    'traffic light': 'רמזור', 'stop sign': 'תמרור עצור',
    backpack: 'תיק גב', handbag: 'תיק יד', suitcase: 'מזוודה'
  };

  function fail(msg, detail) {
    els.err.hidden = false;
    els.err.innerHTML = '<b>' + msg + '</b>' + (detail ? '<br><br>' + detail : '');
    els.bar.hidden = true;
  }

  // ------------------------------------------------------------- the tracker

  /* Greedy IoU association. Each detection is matched to the best-overlapping
     surviving track; unmatched detections open new tracks, unmatched tracks age
     out after MAX_LOST frames. Ids are never reused. */
  function updateTracks(detections, now) {
    var i, j;
    for (i = 0; i < tracks.length; i++) tracks[i].matched = false;

    var pairs = [];
    for (i = 0; i < detections.length; i++) {
      for (j = 0; j < tracks.length; j++) {
        if (tracks[j].cls !== detections[i].class) continue;
        var score = iou(detections[i].bbox, tracks[j].bbox);
        if (score >= IOU_MATCH) pairs.push([score, i, j]);
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
        var dist = Math.hypot(cx - t.cx, cy - t.cy);
        t.speed = 0.6 * t.speed + 0.4 * (dist / dt);
      }
      t.bbox = d.bbox; t.cx = cx; t.cy = cy;
      t.score = d.score; t.lastSeen = now; t.lost = 0; t.matched = true;
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
        lost: 0, matched: true, trail: [[ncx, ncy]]
      });
    }

    var kept = [];
    for (i = 0; i < tracks.length; i++) {
      if (!tracks[i].matched) {
        tracks[i].lost++;
        if (tracks[i].lost > MAX_LOST) continue;
      }
      kept.push(tracks[i]);
    }
    tracks = kept;
  }

  // ----------------------------------------------------------------- drawing

  function draw(ctx, w, h, scale) {
    ctx.clearRect(0, 0, w, h);
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    var visible = tracks.filter(function (t) { return t.lost === 0; });

    visible.forEach(function (t) {
      if (t.trail.length < 2) return;
      ctx.lineWidth = 2 * scale; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (var i = 1; i < t.trail.length; i++) {
        ctx.strokeStyle = 'rgba(57,255,20,' + (0.1 + 0.55 * (i / t.trail.length)).toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(t.trail[i - 1][0], t.trail[i - 1][1]);
        ctx.lineTo(t.trail[i][0], t.trail[i][1]);
        ctx.stroke();
      }
    });

    var fontSize = Math.round(13 * scale);
    visible.forEach(function (t) {
      var b = t.bbox;
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(b[0], b[1], b[2], b[3]);

      ctx.fillStyle = '#39ff14';
      ctx.beginPath();
      ctx.arc(t.cx, t.cy, 3 * scale, 0, Math.PI * 2);
      ctx.fill();

      var label = t.cls + ' ID:' + t.id + ' ' + t.score.toFixed(2);
      ctx.font = '600 ' + fontSize + 'px ' + 'ui-monospace,Menlo,Consolas,monospace';
      var padX = 5 * scale, padY = 4 * scale;
      var tw = ctx.measureText(label).width;
      var lx = Math.max(0, Math.min(b[0], ctx.canvas.width - tw - padX * 2));
      var ly = Math.max(fontSize + padY * 2, b[1]);
      ctx.fillStyle = '#39ff14';
      ctx.fillRect(lx, ly - fontSize - padY * 2, tw + padX * 2, fontSize + padY * 2);
      ctx.fillStyle = '#04160a';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lx + padX, ly - (fontSize + padY * 2) / 2);

      var seen = t.lastSeen - t.firstSeen;
      if (seen >= 1) {
        var timer = human(seen);
        ctx.font = '600 ' + Math.round(fontSize * 0.85) + 'px ui-monospace,Menlo,Consolas,monospace';
        var tw2 = ctx.measureText(timer).width;
        var ty = Math.min(ctx.canvas.height - 2, b[1] + b[3] + fontSize + padY);
        ctx.fillStyle = 'rgba(13,47,8,.85)';
        ctx.fillRect(lx, ty - fontSize, tw2 + padX * 2, fontSize + padY);
        ctx.fillStyle = '#d8ffd0';
        ctx.fillText(timer, lx + padX, ty - fontSize / 2 + padY / 2);
      }
    });

    return visible;
  }

  // -------------------------------------------------------------- the sidebar

  var lastPanel = 0;
  function renderPanel(visible, now) {
    if (now - lastPanel < 0.25) return;
    lastPanel = now;

    els.sFps.textContent = fps ? fps.toFixed(1) : '—';
    els.sNow.textContent = visible.length;
    els.sTotal.textContent = nextId - 1;
    els.sTime.textContent = clock(now);
    els.count.textContent = visible.length;

    if (!visible.length) {
      els.list.innerHTML = '<div class="empty">לא זוהה כלום כרגע.<br>נסה להתקרב או להאיר את החדר.</div>';
      return;
    }
    var html = '';
    visible.slice().sort(function (a, b) { return a.id - b.id; }).forEach(function (t) {
      var seen = t.lastSeen - t.firstSeen;
      var moving = t.speed > STATIONARY_PX_S;
      html += '<div class="row">' +
        '<div class="pip"></div>' +
        '<div><div class="n">' + (HE[t.cls] || t.cls) + ' <span style="color:var(--muted)">ID ' + t.id + '</span></div>' +
        '<div class="m">נראה: ' + clock(seen) + ' · ' + (moving ? 'בתנועה' : 'עומד') + '</div></div>' +
        '<div class="c">' + Math.round(t.score * 100) + '%</div></div>';
    });
    els.list.innerHTML = html;
  }

  // ------------------------------------------------------------- the main loop

  function loop() {
    if (!running) return;
    rafId = requestAnimationFrame(loop);

    var v = els.video;
    if (!v.videoWidth) return;

    var c = els.overlay;
    if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      els.hudRes.textContent = v.videoWidth + '×' + v.videoHeight;
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

      var keep = predictions.filter(function (p) {
        return CLASSES_OF_INTEREST[p.class] && p.score >= SCORE_MIN;
      });

      updateTracks(keep, now);
      var ctx = els.overlay.getContext('2d');
      var scale = Math.max(0.7, Math.min(2, els.overlay.width / 900));
      var visible = draw(ctx, els.overlay.width, els.overlay.height, scale);
      renderPanel(visible, now);
    }).catch(function (e) {
      pending = false;
      console.error(e);
    });
  }
  var pending = false;

  // ------------------------------------------------------------------ startup

  function setProgress(pct, msg) {
    els.bar.hidden = false;
    els.barFill.style.width = pct + '%';
    if (msg) els.splashMsg.textContent = msg;
  }

  async function loadModel() {
    if (model) return model;
    setProgress(15, 'טוען את מנוע הזיהוי…');
    await new Promise(function (r) { setTimeout(r, 30); });

    var spec = window.__VT_MODEL__;
    var bin = atob(spec.weights);
    var buf = new ArrayBuffer(bin.length);
    var view = new Uint8Array(buf);
    for (var i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
    setProgress(55, 'מכין את המודל…');

    var specs = [];
    spec.manifest.forEach(function (g) { specs = specs.concat(g.weights); });

    var handler = tf.io.fromMemory({
      modelTopology: spec.topology,
      weightSpecs: specs,
      weightData: buf
    });
    model = await cocoSsd.load({ base: 'lite_mobilenet_v2', modelUrl: handler });
    setProgress(85, 'מתחבר למצלמה…');
    return model;
  }

  async function startCamera() {
    els.err.hidden = true;
    els.start.disabled = true;
    els.startBig.disabled = true;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      fail('הדפדפן הזה לא תומך בגישה למצלמה.',
           'נסה לפתוח את הקובץ ב-Chrome או ב-Edge.');
      els.start.disabled = false; els.startBig.disabled = false;
      return;
    }

    try {
      await loadModel();
    } catch (e) {
      fail('טעינת מנוע הזיהוי נכשלה.', String(e && e.message || e));
      els.start.disabled = false; els.startBig.disabled = false;
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
    } catch (e) {
      var name = e && e.name;
      var hint = 'אשר את הבקשה לגישה למצלמה בדפדפן, וסגור תוכנות אחרות שמשתמשות במצלמה (זום, טימס).';
      if (name === 'NotAllowedError') hint = 'הגישה למצלמה נדחתה. לחץ על סמל המצלמה בשורת הכתובת ואפשר גישה, ואז רענן.';
      if (name === 'NotFoundError') hint = 'לא נמצאה מצלמה מחוברת למכשיר.';
      if (name === 'NotReadableError') hint = 'תוכנה אחרת תופסת את המצלמה. סגור אותה ונסה שוב.';
      fail('לא הצלחתי לפתוח את המצלמה.', hint);
      els.start.disabled = false; els.startBig.disabled = false;
      return;
    }

    els.video.srcObject = stream;
    await els.video.play().catch(function () {});

    els.splash.hidden = true;
    els.hud.hidden = false;
    els.stop.disabled = false;
    els.flip.disabled = false;
    els.hudState.textContent = 'מזהה';

    tracks = []; nextId = 1; fps = 0; lastFrame = 0;
    startedAt = performance.now();
    running = true;
    loop();
  }

  function stopCamera() {
    running = false;
    cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null;
    els.video.srcObject = null;
    els.hud.hidden = true;
    els.splash.hidden = false;
    els.bar.hidden = true;
    els.splashMsg.textContent = 'הניתוח נעצר. ' + (nextId - 1) + ' אובייקטים זוהו בסך הכל.';
    els.startBig.disabled = false;
    els.start.disabled = false;
    els.stop.disabled = true;
    els.flip.disabled = true;
    var ctx = els.overlay.getContext('2d');
    ctx.clearRect(0, 0, els.overlay.width, els.overlay.height);
  }

  async function flipCamera() {
    facing = facing === 'environment' ? 'user' : 'environment';
    if (!running) return;
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing }, audio: false
      });
      els.video.srcObject = stream;
      await els.video.play().catch(function () {});
    } catch (e) {
      fail('לא הצלחתי להחליף מצלמה.', String(e && e.message || e));
    }
  }

  els.start.addEventListener('click', startCamera);
  els.startBig.addEventListener('click', startCamera);
  els.stop.addEventListener('click', stopCamera);
  els.flip.addEventListener('click', flipCamera);

  window.__VT_READY__ = true;
})();

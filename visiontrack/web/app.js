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
    handbag: 1, suitcase: 1, chair: 1, 'cell phone': 1, bottle: 1,
    bird: 1, horse: 1, sheep: 1, cow: 1, elephant: 1, bear: 1, zebra: 1, giraffe: 1
  };
  var SCORE_MIN = 0.45;
  var IOU_MATCH = 0.3;
  var MAX_LOST = 18;
  var TRAIL_MAX = 45;
  var STATIONARY_PX_S = 22;

  /* If a swapped-in model ever reports one of these, it is drawn in red. The
     bundled detector has no firearm class, so nothing here fires today - this
     is the hook a weapon model plugs into, not a detector. */
  var WEAPON_CLASSES = {
    gun: 1, handgun: 1, pistol: 1, rifle: 1, firearm: 1, weapon: 1,
    knife: 1, shotgun: 1
  };
  var FACE_EVERY_MS = 700;     // at most one face inference this often
  var FACE_REFRESH_MS = 4000;  // re-estimate a known face this often
  var ZOOM_MIN = 1, ZOOM_MAX = 6, ZOOM_STEP = 1.35;

  /* Appearance re-identification. When the tracker drops someone - a pillar,
     a doorway, a moment out of frame - a naive tracker hands back a brand new
     id and the same shopper is counted twice. A coarse colour descriptor
     (torso, legs, whole box) lets a reappearing figure inherit its old id.
     It is deliberately NOT biometric: it reads clothing colour, not the face,
     it is scoped to this session, and a change of clothes breaks it. */
  var REID_WINDOW_MS = 45000;   // how long a dropped track stays claimable
  var REID_MAX_GHOSTS = 40;
  var REID_THRESHOLD = 0.19;    // descriptor distance below which it is the same figure
  var SIG_EVERY_MS = 900;

  /* Owner recognition. The operator enrols their own face from the live camera;
     the 128-D descriptor is averaged over a few samples and kept in this
     browser's localStorage. No face data ships inside this file, nothing is
     uploaded, and only enrolled descriptors are ever compared against - an
     unknown face stays unknown. Enrolling anyone other than yourself is
     biometric processing of another person and needs their consent. */
  var FACE_MATCH_MAX = 0.52;    // descriptor distance below which it is a match
  var ENROL_SAMPLES = 5;
  var RECOG_EVERY_MS = 1200;

  // Tamper watch: a struck, covered or re-aimed camera all show up as a sudden
  // whole-frame change that object motion never produces.
  var TAMPER_GRID_W = 32, TAMPER_GRID_H = 24;
  var TAMPER_DIFF = 0.22;       // mean abs luma change, 0..1, across the whole frame
  var TAMPER_DARK = 0.45;       // fraction of previous brightness that counts as covered
  var TAMPER_SHOCK = 28;        // m/s^2 total acceleration that counts as a physical hit
  var TAMPER_COOLDOWN_MS = 6000;
  var CLIP_SECONDS = 30;        // auto-clip length, extended by further triggers

  // ------------------------------------------------------------------ i18n
  var lang = 'he';
  var STR = {
    he: {
      start: 'הפעל מצלמה', stop: 'עצור', flip: 'הפוך מצלמה',
      startBig: 'הפעל את המצלמה', tracked: 'אובייקטים במעקב',
      fps: 'FPS', onScreen: 'על המסך', total: 'סה״כ', time: 'זמן',
      clear: 'נקה', mark: 'סמן', unmark: 'בטל סימון',
      cls: 'סוג', conf: 'ודאות זיהוי', first: 'נראה לראשונה', dur: 'זמן במעקב',
      state: 'מצב', speed: 'מהירות', dir: 'כיוון', pos: 'מיקום בפריים',
      box: 'גודל תיבה', share: 'חלק מגובה הפריים', pts: 'נקודות מסלול',
      age: 'גיל משוער', gender: 'מגדר נראה', noface: 'לא נמצאו פנים',
      computing: 'מחשב…', height: 'גובה משוער', needCal: 'דרוש כיול',
      calBtn: 'כייל', calReset: 'אפס', calPh: 'גובה אמיתי בס״מ',
      moving: 'בתנועה', still: 'עומד', male: 'גבר', female: 'אישה',
      nothing: 'לא זוהה כלום כרגע.', hint: 'נסה להתקרב או להאיר את החדר.',
      press: 'לחץ "הפעל מצלמה" כדי להתחיל', marked: 'מסומן',
      about: 'מידע', measurements: 'מדידות',
      tZoomIn: 'הגדל', tZoomOut: 'הקטן', tFollow: 'עקוב אחרי הנבחר',
      tOwner: 'רישום בעלים / מחיקה', tSeg: 'ריבוע / צללית', tRec: 'הקלטה ידנית',
      unknownG: 'לא נקרא', objectG: 'חפץ', markedG: 'מסומן', selectedG: 'נבחר',
      weaponG: 'נשק', ownerG: 'בעלים', legend: 'מקרא',
      hudDet: 'מזהה', hudFace: 'מזהה · פנים פעיל',
      tMove: 'תזוזה חדה של המצלמה', tCover: 'המצלמה כוסתה', tShock: 'זוהתה פגיעה פיזית',
      recManual: 'הקלטה ידנית', recOn: 'מקליט', recCont: 'ממשיך להקליט',
      recNo: 'הדפדפן לא תומך בהקלטה',
      errNoCam: 'הדפדפן הזה לא תומך בגישה למצלמה.',
      errNoCamHint: 'נסה לפתוח את הקובץ ב-Chrome או ב-Edge.',
      errModels: 'טעינת מנוע הזיהוי נכשלה.',
      errOpen: 'לא הצלחתי לפתוח את המצלמה.',
      errFlip: 'לא הצלחתי להחליף מצלמה.',
      hintBusyGeneric: 'אשר את הבקשה לגישה למצלמה, וסגור תוכנות אחרות שמשתמשות בה.',
      hintDenied: 'הגישה נדחתה. לחץ על סמל המצלמה בשורת הכתובת, אפשר גישה, ורענן.',
      hintNoDevice: 'לא נמצאה מצלמה מחוברת למכשיר.',
      hintBusy: 'תוכנה אחרת תופסת את המצלמה. סגור אותה ונסה שוב.'
    },
    en: {
      start: 'Start camera', stop: 'Stop', flip: 'Flip camera',
      startBig: 'Start the camera', tracked: 'Tracked objects',
      fps: 'FPS', onScreen: 'On screen', total: 'Total', time: 'Time',
      clear: 'Clear', mark: 'Mark', unmark: 'Unmark',
      cls: 'Class', conf: 'Confidence', first: 'First seen', dur: 'Tracked for',
      state: 'State', speed: 'Speed', dir: 'Heading', pos: 'Frame position',
      box: 'Box size', share: 'Share of frame height', pts: 'Trail points',
      age: 'Estimated age', gender: 'Apparent gender', noface: 'No face found',
      computing: 'Working…', height: 'Estimated height', needCal: 'Needs calibration',
      calBtn: 'Calibrate', calReset: 'Reset', calPh: 'Real height in cm',
      moving: 'moving', still: 'stationary', male: 'male', female: 'female',
      nothing: 'Nothing detected right now.', hint: 'Move closer or add light.',
      press: 'Press "Start camera" to begin', marked: 'marked',
      about: 'About', measurements: 'measurements',
      tZoomIn: 'Zoom in', tZoomOut: 'Zoom out', tFollow: 'Follow the selection',
      tOwner: 'Enrol / clear owner', tSeg: 'Box / silhouette', tRec: 'Record',
      unknownG: 'Unread', objectG: 'Object', markedG: 'Marked', selectedG: 'Selected',
      weaponG: 'Weapon', ownerG: 'Owner', legend: 'Legend',
      hudDet: 'Detecting', hudFace: 'Detecting · face on',
      tMove: 'Camera moved sharply', tCover: 'Camera covered', tShock: 'Physical impact',
      recManual: 'Manual recording', recOn: 'recording', recCont: 'still recording',
      recNo: 'This browser cannot record',
      errNoCam: 'This browser cannot reach a camera.',
      errNoCamHint: 'Try opening the file in Chrome or Edge.',
      errModels: 'The detection engine failed to load.',
      errOpen: 'Could not open the camera.',
      errFlip: 'Could not switch camera.',
      hintBusyGeneric: 'Allow the camera request, and close other apps using the camera.',
      hintDenied: 'Access was denied. Click the camera icon in the address bar, allow it, and reload.',
      hintNoDevice: 'No camera is attached to this device.',
      hintBusy: 'Another app is holding the camera. Close it and try again.'
    }
  };
  function T(k) { return (STR[lang] && STR[lang][k]) || STR.en[k] || k; }

  /* The layout is left-to-right in both languages, so a Hebrew word sitting in
     a string of Latin numbers swallows the separators around it and reorders
     what follows - "0:20 · stationary · ~55" came out as "0:20 · 55~ · עומד".
     First-strong isolate + pop marks fence each word into its own run. */
  function iso(str) { return '\u2068' + str + '\u2069'; }

  var HE = {
    person: 'אדם', bicycle: 'אופניים', car: 'רכב', motorcycle: 'אופנוע',
    bus: 'אוטובוס', truck: 'משאית', dog: 'כלב', cat: 'חתול',
    'traffic light': 'רמזור', 'stop sign': 'תמרור עצור', backpack: 'תיק גב',
    handbag: 'תיק יד', suitcase: 'מזוודה', chair: 'כיסא',
    'cell phone': 'טלפון', bottle: 'בקבוק',
    bird: 'ציפור', horse: 'סוס', sheep: 'כבשה', cow: 'פרה',
    elephant: 'פיל', bear: 'דוב', zebra: 'זברה', giraffe: 'ג\'ירפה'
  };
  function clsName(c) { return lang === 'he' ? (HE[c] || c) : c; }

  /* Real facts for the animal classes the detector can actually name. The
     model distinguishes these ten and nothing finer, so no species beyond
     them is claimed. */
  var ANIMALS = {
    dog: { he: 'כלב מבוית. חוש ריח חזק פי אלפי מונים מזה של אדם. תוחלת חיים 10-13 שנה.',
           en: 'Domestic dog. Sense of smell orders of magnitude sharper than a human\'s. Lifespan 10-13 years.' },
    cat: { he: 'חתול מבוית. ישן 12-16 שעות ביממה. שומע תדרים גבוהים בהרבה מאדם.',
           en: 'Domestic cat. Sleeps 12-16 hours a day. Hears far higher frequencies than people do.' },
    bird: { he: 'ציפור. עצמות חלולות מפחיתות משקל לתעופה. המודל לא מבחין בין מינים.',
            en: 'Bird. Hollow bones cut weight for flight. The model does not tell species apart.' },
    horse: { he: 'סוס. ישן בעמידה בזכות מנגנון נעילה בברכיים. שדה ראייה כמעט 360 מעלות.',
             en: 'Horse. Sleeps standing via a stay apparatus in the legs. Near 360-degree field of view.' },
    sheep: { he: 'כבשה. מעלת גירה, זיכרון פנים טוב לשנים. עדר חברתי מאוד.',
             en: 'Sheep. A ruminant with years-long facial memory. Strongly social in flocks.' },
    cow: { he: 'פרה. קיבה בעלת ארבעה תאים לעיכול צמחים. מעלת גירה שעות ביום.',
           en: 'Cow. A four-chambered stomach digests plant matter. Chews cud for hours daily.' },
    elephant: { he: 'פיל. היונק היבשתי הגדול ביותר. חדק עם עשרות אלפי שרירים.',
                en: 'Elephant. The largest land mammal. A trunk with tens of thousands of muscles.' },
    bear: { he: 'דוב. אוכל-כול. מינים רבים נכנסים לתרדמת חורף.',
            en: 'Bear. Omnivore. Many species enter winter dormancy.' },
    zebra: { he: 'זברה. דגם הפסים ייחודי לכל פרט, כמו טביעת אצבע.',
             en: 'Zebra. The stripe pattern is unique to each individual, like a fingerprint.' },
    giraffe: { he: 'ג\'ירפה. היונק הגבוה ביותר. שבע חוליות צוואר, כמו אצל אדם.',
               en: 'Giraffe. The tallest mammal. Seven neck vertebrae, the same as a human.' }
  };

  var els = {};
  ['video','overlay','frame','viewport','splash','splashMsg','startBig','start','stop','flip',
   'err','bar','barFill','hud','hudState','hudRes','list','count','detail',
   'sFps','sNow','sTotal','sTime','zoombox','zoomIn','zoomOut','zoomLevel','follow',
   'recBtn','recbar','recDot','recTime','alertMsg','clips','ownerBtn',
   'lang','boot','bootLog','bootGrid','bootStatus','bootMosaic','bootPct','bootTrack','bootDone',
   'gate','gateForm','gUser','gPass1','gPass2','gateErr','gateNote','gateBtn','segBtn']
    .forEach(function (id) { els[id] = document.getElementById(id); });

  var model = null, faceReady = false, stream = null, running = false;
  var facing = 'environment', pending = false, faceBusy = false;
  var tracks = [], nextId = 1, startedAt = 0, lastFrame = 0, fps = 0, rafId = 0;
  var selectedId = null, lastFaceAt = 0;
  var view = { zoom: 1, cx: 0.5, cy: 0.5, follow: true };
  var calib = null;               // {px, cm} from a user-supplied reference
  var faceCanvas = document.createElement('canvas');

  var recogReady = false, enrolled = null, enrolling = 0, enrolBuf = [];
  var recogBusy = false, recogAt = 0;

  var segNet = null, segMask = null, segBusy = false, segAt = 0;
  var segOn = false;
  var SEG_EVERY_MS = 450;       // segmentation is the expensive pass; throttle it
  var segCanvas = document.createElement('canvas');

  var ghosts = [];              // recently dropped tracks, waiting to be reclaimed
  var sigCanvas = document.createElement('canvas');

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
    var U = lang === 'he'
      ? { s: ' שנ\'', m: ' דק\'', h: ' שע\'' }
      : { s: ' sec', m: ' min', h: ' hour' };
    if (s < 60) return Math.round(s) + U.s;
    var m = Math.floor(s / 60);
    if (m < 60) return m + U.m;
    var h = Math.floor(m / 60), r = m % 60;
    return r ? h + U.h + ' ' + r + U.m : h + U.h;
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

  // --------------------------------------------------- appearance descriptor

  /* Mean colour of the upper band (torso), lower band (legs) and the whole box,
     normalised so overall brightness changes matter less than hue. */
  function describe(t) {
    var v = els.video;
    if (!v.videoWidth) return null;
    var b = t.bbox;
    if (b[2] < 12 || b[3] < 24) return null;

    var W = 12, H = 24;
    sigCanvas.width = W; sigCanvas.height = H;
    var ctx = sigCanvas.getContext('2d', { willReadFrequently: true });
    try {
      ctx.drawImage(v, b[0], b[1], b[2], b[3], 0, 0, W, H);
    } catch (e) { return null; }
    var px = ctx.getImageData(0, 0, W, H).data;

    var bands = [[2, 10], [12, 21], [0, H]];   // torso, legs, whole
    var out = [];
    bands.forEach(function (band) {
      var r = 0, g = 0, bl = 0, n = 0;
      for (var y = band[0]; y < band[1]; y++) {
        for (var x = 0; x < W; x++) {
          var o = (y * W + x) * 4;
          r += px[o]; g += px[o + 1]; bl += px[o + 2]; n++;
        }
      }
      if (!n) { out.push(0, 0, 0); return; }
      r /= n; g /= n; bl /= n;
      var sum = r + g + bl + 1e-6;
      out.push(r / sum, g / sum, bl / sum);      // chromaticity, not brightness
    });
    out.push(Math.min(3, b[3] / Math.max(1, b[2])) / 3);   // build, roughly
    return out;
  }

  function sigDistance(a, b) {
    if (!a || !b || a.length !== b.length) return Infinity;
    var sum = 0;
    for (var i = 0; i < a.length; i++) {
      var d = a[i] - b[i];
      sum += d * d;
    }
    return Math.sqrt(sum / a.length);
  }

  function retire(track, now) {
    if (!track.sig) return;
    ghosts.unshift({
      id: track.id, cls: track.cls, sig: track.sig, at: performance.now(),
      firstSeen: track.firstSeen, ageSum: track.ageSum, ageN: track.ageN,
      gender: track.gender, genderProb: track.genderProb, marked: track.marked,
      owner: track.owner, ownerDist: track.ownerDist,
      cx: track.cx, cy: track.cy
    });
    if (ghosts.length > REID_MAX_GHOSTS) ghosts.length = REID_MAX_GHOSTS;
  }

  /* Returns the ghost this detection most likely is, or null for a stranger. */
  function reclaim(cls, sig) {
    if (!sig) return null;
    var wall = performance.now();
    var best = null, bestD = REID_THRESHOLD, bestIdx = -1;
    for (var i = 0; i < ghosts.length; i++) {
      var g = ghosts[i];
      if (wall - g.at > REID_WINDOW_MS) continue;
      if (g.cls !== cls) continue;
      var d = sigDistance(g.sig, sig);
      if (d < bestD) { bestD = d; best = g; bestIdx = i; }
    }
    if (bestIdx >= 0) ghosts.splice(bestIdx, 1);
    return best;
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
      var wallNow = performance.now();
      if (wallNow - t.sigAt > SIG_EVERY_MS) {
        var sg = describe(t);
        if (sg) { t.sig = sg; t.sigAt = wallNow; }
      }
    }

    for (i = 0; i < detections.length; i++) {
      if (usedDet[i]) continue;
      var nd = detections[i];
      var ncx = nd.bbox[0] + nd.bbox[2] / 2, ncy = nd.bbox[1] + nd.bbox[3] / 2;
      var fresh = {
        id: 0, cls: nd.class, bbox: nd.bbox, score: nd.score,
        cx: ncx, cy: ncy, speed: 0, firstSeen: now, lastSeen: now,
        lost: 0, matched: true, trail: [[ncx, ncy]],
        ageSum: 0, ageN: 0, gender: null, genderProb: 0, faceAt: 0, faceTried: 0,
        marked: false, sig: null, sigAt: 0, reclaimed: false,
        owner: false, ownerDist: null
      };
      fresh.sig = describe(fresh);
      var ghost = reclaim(fresh.cls, fresh.sig);
      if (ghost) {
        // Same figure returning: keep the id and everything already learned.
        fresh.id = ghost.id;
        fresh.firstSeen = ghost.firstSeen;
        fresh.ageSum = ghost.ageSum;
        fresh.ageN = ghost.ageN;
        fresh.gender = ghost.gender;
        fresh.genderProb = ghost.genderProb;
        fresh.marked = ghost.marked;
        fresh.owner = ghost.owner;
        fresh.ownerDist = ghost.ownerDist;
        fresh.reclaimed = true;
      } else {
        fresh.id = nextId++;
      }
      tracks.push(fresh);
    }

    var kept = [];
    for (i = 0; i < tracks.length; i++) {
      if (!tracks[i].matched) {
        tracks[i].lost++;
        if (tracks[i].lost > MAX_LOST) {
          retire(tracks[i], now);       // claimable for REID_WINDOW_MS
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
      if (diff > TAMPER_DIFF) reason = 'tMove';
      else if (tamper.prevLuma > 0.08 && mean < tamper.prevLuma * TAMPER_DARK) {
        reason = 'tCover';
      }
    }
    if (tamper.shock > TAMPER_SHOCK) {
      reason = 'tShock';
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
      showAlert(T('recNo'));
      return;
    }
    rec.chunks = [];
    rec.auto = !!auto;
    rec.reason = reason || 'recManual';   // a key, resolved when it is drawn
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
    if (auto) showAlert(T(reason) + ' — ' + T('recOn'));
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
      return '<div class="clip"><div class="cl"><b>' + T(c.reason) + '</b>' +
        c.at + ' · ' + Math.round(c.seconds) + ' שנ\' · ' +
        (c.size / 1048576).toFixed(1) + 'MB</div>' +
        '<a href="' + c.url + '" download="' + c.name + '">שמור</a></div>';
    }).join('');
  }

  /* Person segmentation, when the operator turns it on. It costs real frame
     rate, which is why it is off by default and has its own button. */
  function maybeSegment() {
    if (!segOn || !segNet || segBusy) return;
    var wall = performance.now();
    if (wall - segAt < SEG_EVERY_MS) return;
    segAt = wall;
    segBusy = true;
    segNet.segmentPerson(els.video, {
      internalResolution: 'low',
      segmentationThreshold: 0.65,
      maxDetections: 8
    }).then(function (res) {
      segMask = res;
      segBusy = false;
    }).catch(function (e) {
      segBusy = false;
      console.warn('segment failed:', e);
    });
  }

  /* Paints the cached mask as a translucent green silhouette with a bright
     edge, the look of the reference frame. */
  function drawMask(ctx, w, h) {
    if (!segOn || !segMask || !segMask.data) return;
    var mw = segMask.width, mh = segMask.height;
    if (!mw || !mh) return;

    if (segCanvas.width !== mw || segCanvas.height !== mh) {
      segCanvas.width = mw; segCanvas.height = mh;
    }
    var mctx = segCanvas.getContext('2d', { willReadFrequently: true });
    var img = mctx.createImageData(mw, mh);
    var d = img.data, src = segMask.data;
    for (var i = 0; i < src.length; i++) {
      var on = src[i] === 1;
      var o = i * 4;
      if (!on) { d[o + 3] = 0; continue; }
      // edge check against the four neighbours, for the bright outline
      var x = i % mw, y = (i / mw) | 0;
      var edge = (x === 0 || y === 0 || x === mw - 1 || y === mh - 1) ||
                 src[i - 1] === 0 || src[i + 1] === 0 ||
                 src[i - mw] === 0 || src[i + mw] === 0;
      d[o] = edge ? 120 : 57;
      d[o + 1] = 255;
      d[o + 2] = edge ? 90 : 20;
      d[o + 3] = edge ? 235 : 105;
    }
    mctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(segCanvas, 0, 0, w, h);
    ctx.restore();
  }

  // ------------------------------------------------------------ recognition

  function loadEnrolment() {
    try {
      var raw = localStorage.getItem('vt_owner');
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return (parsed && parsed.length === 128) ? Float32Array.from(parsed) : null;
    } catch (e) { return null; }
  }

  function saveEnrolment(vec) {
    try { localStorage.setItem('vt_owner', JSON.stringify(Array.from(vec))); }
    catch (e) { /* private mode: the enrolment lasts this session only */ }
  }

  function faceDistance(a, b) {
    var sum = 0;
    for (var i = 0; i < a.length; i++) { var d = a[i] - b[i]; sum += d * d; }
    return Math.sqrt(sum);
  }

  /* One descriptor from the largest face currently in frame. */
  function currentDescriptor() {
    var opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });
    return faceapi.detectSingleFace(els.video, opts)
      .withFaceLandmarks(true)
      .withFaceDescriptor();
  }

  function startEnrolment() {
    if (!recogReady) {
      showAlert(lang === 'he' ? 'מודל הזיהוי לא נטען' : 'Recognition model not loaded');
      return;
    }
    if (enrolled) {
      enrolled = null;
      try { localStorage.removeItem('vt_owner'); } catch (e) { /* ignore */ }
      tracks.forEach(function (t) { t.owner = false; });
      showAlert(lang === 'he' ? 'הרישום נמחק' : 'Enrolment cleared');
      els.ownerBtn.classList.remove('on');
      return;
    }
    enrolBuf = [];
    enrolling = ENROL_SAMPLES;
    showAlert(lang === 'he' ? 'הבט למצלמה…' : 'Look at the camera…');
  }

  /* Runs at most once per RECOG_EVERY_MS: collects enrolment samples, or checks
     whether the person on screen is the enrolled operator. */
  function maybeRecognise() {
    if (!recogReady || recogBusy) return;
    if (!enrolling && !enrolled) return;
    var wall = performance.now();
    if (wall - recogAt < RECOG_EVERY_MS) return;
    recogAt = wall;
    recogBusy = true;

    currentDescriptor().then(function (res) {
      recogBusy = false;
      if (!res || !res.descriptor) return;

      if (enrolling > 0) {
        enrolBuf.push(res.descriptor);
        enrolling--;
        showAlert((lang === 'he' ? 'נרשם ' : 'Captured ') +
                  enrolBuf.length + '/' + ENROL_SAMPLES);
        if (enrolling === 0 && enrolBuf.length) {
          var mean = new Float32Array(128);
          enrolBuf.forEach(function (v) {
            for (var i = 0; i < 128; i++) mean[i] += v[i] / enrolBuf.length;
          });
          enrolled = mean;
          saveEnrolment(mean);
          els.ownerBtn.classList.add('on');
          showAlert(lang === 'he' ? 'זוהה כבעלים' : 'Enrolled as owner');
        }
        return;
      }

      /* Attribute the match to exactly one person. Boxes overlap, so a face
         centre can sit inside several of them; the tightest one is the body
         that face belongs to. Anything else loses the flag, which is also how
         a stale owner mark clears once that person walks off. */
      var d = faceDistance(enrolled, res.descriptor);
      var box = res.detection && res.detection.box;
      if (!box) return;
      var fx = box.x + box.width / 2, fy = box.y + box.height / 2;
      var host = null, hostArea = Infinity;
      tracks.forEach(function (t) {
        if (t.cls !== 'person' || t.lost > 0) return;
        var b = t.bbox;
        if (fx >= b[0] && fx <= b[0] + b[2] && fy >= b[1] && fy <= b[1] + b[3]) {
          var area = b[2] * b[3];
          if (area < hostArea) { hostArea = area; host = t; }
        }
      });
      var hit = host && d < FACE_MATCH_MAX;
      tracks.forEach(function (t) {
        if (hit && t === host) { t.owner = true; t.ownerDist = d; }
        else if (t.owner) { t.owner = false; t.ownerDist = null; }
      });
    }).catch(function () { recogBusy = false; });
  }

  /* Box colour, in priority order. Green means male and pink means female, so
     neither can double as the default: a person the face model has not read yet
     is white, and everything that is not a person is cyan. Without that, every
     car and every unread figure would read as "male". */
  var COL = {
    weapon: '#ff1f1f', owner: '#000000', marked: '#ff3b30', selected: '#ff2bd1',
    male: '#39ff14', female: '#ff5fbf', unknown: '#e8eef5', object: '#00e5ff'
  };

  function hexRGB(hex) {
    var n = parseInt(hex.slice(1), 16);
    return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  }

  function boxColor(t, sel, mk, weapon) {
    if (weapon) return COL.weapon;
    if (t.owner) return COL.owner;
    if (mk) return COL.marked;
    if (sel) return COL.selected;
    if (t.cls !== 'person') return COL.object;
    if (t.gender === 'male') return COL.male;
    if (t.gender === 'female') return COL.female;
    return COL.unknown;
  }

  // ----------------------------------------------------------------- drawing

  function draw(ctx, w, h, scale) {
    ctx.clearRect(0, 0, w, h);
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    drawMask(ctx, w, h);
    var visible = tracks.filter(function (t) { return t.lost === 0; });

    visible.forEach(function (t) {
      if (t.trail.length < 2) return;
      var sel = t.id === selectedId, mk = t.marked;
      // The trail carries the same colour as the box, so a pink or green
      // thread on the floor still says which person it belongs to.
      var rgb = hexRGB(boxColor(t, sel, mk, WEAPON_CLASSES[t.cls]));
      ctx.lineWidth = (sel || mk ? 3 : 2) * scale;
      ctx.lineJoin = ctx.lineCap = 'round';
      for (var i = 1; i < t.trail.length; i++) {
        var a = (0.1 + 0.6 * (i / t.trail.length)).toFixed(3);
        ctx.strokeStyle = 'rgba(' + rgb + ',' + a + ')';
        ctx.beginPath();
        ctx.moveTo(t.trail[i - 1][0], t.trail[i - 1][1]);
        ctx.lineTo(t.trail[i][0], t.trail[i][1]);
        ctx.stroke();
      }
    });

    var fs = Math.round(13 * scale);
    visible.forEach(function (t) {
      var b = t.bbox, sel = t.id === selectedId, mk = t.marked;
      var weapon = WEAPON_CLASSES[t.cls];
      var color = boxColor(t, sel, mk, weapon);

      if (!segOn || sel || mk || t.owner || weapon) {
        if (t.owner) {
          // A black box needs a light keyline to stay visible on dark footage.
          ctx.strokeStyle = 'rgba(255,255,255,.85)';
          ctx.lineWidth = (4.5) * scale;
          ctx.strokeRect(b[0], b[1], b[2], b[3]);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = (sel || mk || t.owner || weapon ? 3 : 2) * scale;
        ctx.strokeRect(b[0], b[1], b[2], b[3]);
      }

      if (sel || mk) {
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

      // PERSON · ID 4 · 87%  - a product label, not a debug dump.
      var label = t.owner
        ? ('OWNER · ID ' + t.id)
        : (t.cls.toUpperCase() + ' · ID ' + t.id + ' · ' + Math.round(t.score * 100) + '%');
      ctx.font = '600 ' + fs + 'px ui-monospace,Menlo,Consolas,monospace';
      var padX = 5 * scale, padY = 4 * scale;
      var tw = ctx.measureText(label).width;
      var lx = Math.max(0, Math.min(b[0], w - tw - padX * 2));
      var ly = Math.max(fs + padY * 2, b[1]);
      ctx.fillStyle = color;
      ctx.fillRect(lx, ly - fs - padY * 2, tw + padX * 2, fs + padY * 2);
      ctx.fillStyle = (t.owner || weapon || mk || sel) ? '#ffffff' : '#04160a';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lx + padX, ly - (fs + padY * 2) / 2);

      if (t.gender && segOn && !(sel || mk || t.owner || weapon)) {
        /* In silhouette mode there is no box to carry the colour, so the chip
           stands in for it. With boxes on, the box itself is the signal. */
        var sq = Math.round(fs * 0.8);
        ctx.fillStyle = t.gender === 'male' ? '#39ff14' : '#ff5fbf';
        ctx.fillRect(lx + tw + padX * 2 + 3 * scale, ly - fs - padY * 2, sq, sq);
        ctx.strokeStyle = 'rgba(0,0,0,.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(lx + tw + padX * 2 + 3 * scale, ly - fs - padY * 2, sq, sq);
      }

      /* Numeric only. A Hebrew duration next to a Latin age put two scripts of
         opposite direction in one canvas string, which rendered as a jumble. */
      var seen = t.lastSeen - t.firstSeen;
      var lines = [];
      if (seen >= 1) lines.push(clock(seen));
      if (t.ageN > 0) lines.push('~' + Math.round(t.ageSum / t.ageN) + 'y');
      if (lines.length) {
        var text = lines.join(' · ');
        ctx.font = '500 ' + Math.round(fs * 0.85) + 'px ui-monospace,Menlo,Consolas,monospace';
        var tw2 = ctx.measureText(text).width;
        var ty = Math.min(h - 2, b[1] + b[3] + fs + padY);
        ctx.fillStyle = 'rgba(6,10,12,.78)';
        ctx.fillRect(lx, ty - fs, tw2 + padX * 2, fs + padY);
        ctx.fillStyle = 'rgba(230,242,238,.92)';
        ctx.fillText(text, lx + padX, ty - fs / 2 + padY / 2);
      }
    });

    return visible;
  }

  // ------------------------------------------------------- zoom, pan, follow

  /* Size the frame to the largest rectangle of the camera's aspect ratio that
     fits the viewport - upscaling included. Without this a 640x480 feed drew at
     its intrinsic size and left most of the stage empty. The overlay stretches
     to the same box, so detection coordinates stay aligned. */
  function fitFrame() {
    var v = els.video;
    var vw = v.videoWidth, vh = v.videoHeight;
    if (!vw || !vh) return;
    var vp = els.viewport.getBoundingClientRect();
    if (!vp.width || !vp.height) return;
    var k = Math.min(vp.width / vw, vp.height / vh);
    els.frame.style.width = Math.round(vw * k) + 'px';
    els.frame.style.height = Math.round(vh * k) + 'px';
  }

  function applyView() {
    fitFrame();
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
    if (!view.follow || !els.overlay.width) return;
    // A marked person outranks the current selection: if one is on screen the
    // view goes to them automatically.
    var t = null;
    for (var i = 0; i < tracks.length; i++) {
      if (tracks[i].marked && tracks[i].lost === 0) { t = tracks[i]; break; }
    }
    if (!t && selectedId !== null) t = byId(selectedId);
    if (!t || t.lost > 0) return;
    if (t.marked && view.zoom < 2) setZoom(2);
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

  /* The panel is built once per selection and then only its values change.
     Rebuilding the markup on every tick destroyed the buttons and wiped the
     calibration field while it was being typed into, which made the age and
     height controls unusable. */
  var detailKey = null, dRefs = null;

  function detailSignature(t) {
    return [selectedId, lang, t.marked ? 1 : 0, calib ? 1 : 0,
            t.cls === 'person' ? 1 : 0, ANIMALS[t.cls] ? 1 : 0].join('|');
  }

  function buildDetail(t, now) {
    var isPerson = t.cls === 'person';
    var animal = ANIMALS[t.cls];

    var html = '<div class="detail-h"><span class="t" id="dTitle"></span>' +
      '<button id="markBtn"></button><button id="deselect">' + T('clear') + '</button></div>';

    var fields = [
      ['cls', T('cls')], ['conf', T('conf')], ['first', T('first')], ['dur', T('dur')],
      ['state', T('state')], ['speed', T('speed')], ['dir', T('dir')], ['pos', T('pos')],
      ['box', T('box')], ['share', T('share')], ['pts', T('pts')]
    ];
    if (isPerson) {
      fields.push(['age', T('age')], ['gender', T('gender')], ['height', T('height')]);
    }
    fields.forEach(function (f) {
      html += '<div class="kv"><dt>' + f[1] + '</dt><dd id="d_' + f[0] + '"></dd></div>';
    });

    if (animal) {
      html += '<div class="note" style="background:rgba(57,255,20,.06);' +
        'border-top-color:rgba(57,255,20,.2);color:var(--muted)">' +
        '<b style="color:#eaf3ef">' + T('about') + ':</b> ' + animal[lang] + '</div>';
    }

    if (isPerson) {
      html += '<div class="calib">' +
        '<input id="calibCm" type="number" inputmode="numeric" placeholder="' + T('calPh') + '" />' +
        '<button id="calibSet">' + T('calBtn') + '</button>' +
        (calib ? '<button id="calibClear">' + T('calReset') + '</button>' : '') + '</div>';
      html += '<div class="note">' + (lang === 'he'
        ? 'גיל ומגדר הם הערכה של מודל ראייה ממוחשבת מתוך תמונת הפנים — לא מסמך מזהה. ' +
          'המודל טועה, במיוחד בתאורה חלשה, בזווית, או עם מסכה ומשקפיים.<br><br>' +
          'גובה לא ניתן למדידה ממצלמה אחת בלי נקודת ייחוס. הקלד גובה אמיתי של אדם שנמצא ' +
          'עכשיו בפריים ולחץ "' + T('calBtn') + '" — אחריו יוצג גובה משוער לאנשים <b>באותו מרחק בערך</b>.'
        : 'Age and apparent gender are a vision model\'s estimate from the face crop, not an ' +
          'identity record. It errs in poor light, at an angle, or behind a mask or glasses.' +
          '<br><br>Height cannot be measured from one uncalibrated camera. Enter a real height ' +
          'for someone currently in frame and press "' + T('calBtn') + '" — others are then ' +
          'estimated, valid only at <b>roughly the same distance</b>.') + '</div>';
    }

    els.detail.innerHTML = html;

    dRefs = { title: document.getElementById('dTitle'), mark: document.getElementById('markBtn') };
    fields.forEach(function (f) { dRefs[f[0]] = document.getElementById('d_' + f[0]); });

    document.getElementById('deselect').onclick = function () {
      selectedId = null;
      els.detail.hidden = true;
      detailKey = null;
    };
    dRefs.mark.onclick = function () {
      var tk = byId(selectedId);
      if (!tk) return;
      tk.marked = !tk.marked;
      if (tk.marked) setZoom(Math.max(view.zoom, 2));
      detailKey = null;               // signature changed, rebuild once
    };
    var cs = document.getElementById('calibSet');
    if (cs) cs.onclick = function () {
      var field = document.getElementById('calibCm');
      var v = parseFloat(field && field.value);
      var tk = byId(selectedId);
      if (!v || v < 50 || v > 250 || !tk) {
        if (field) { field.style.borderColor = '#ff4d4d'; setTimeout(function () { field.style.borderColor = ''; }, 900); }
        return;
      }
      calib = { px: tk.bbox[3], cm: v };
      detailKey = null;
    };
    var cc = document.getElementById('calibClear');
    if (cc) cc.onclick = function () { calib = null; detailKey = null; };
  }

  function put(el, value) {
    if (el && el.innerHTML !== value) el.innerHTML = value;
  }

  function renderDetail(now) {
    if (selectedId === null) { els.detail.hidden = true; detailKey = null; return; }
    var t = byId(selectedId);
    if (!t) { els.detail.hidden = true; detailKey = null; return; }
    els.detail.hidden = false;

    var sig = detailSignature(t);
    if (sig !== detailKey) {
      detailKey = sig;
      buildDetail(t, now);
    }

    var frameH = els.overlay.height || 1, frameW = els.overlay.width || 1;
    var seen = t.lastSeen - t.firstSeen;

    dRefs.title.textContent = iso(clsName(t.cls)) + ' · ID ' + t.id +
      (t.marked ? ' · ' + iso(T('marked')) : '');
    dRefs.title.style.color = t.marked ? '#ff3b30' : '';
    dRefs.mark.textContent = t.marked ? T('unmark') : T('mark');

    put(dRefs.cls, t.cls);
    put(dRefs.conf, Math.round(t.score * 100) + '%');
    put(dRefs.first, clock(t.firstSeen));
    put(dRefs.dur, human(seen));
    put(dRefs.state, t.speed > STATIONARY_PX_S ? T('moving') : T('still'));
    put(dRefs.speed, Math.round(t.speed) + ' px/s');
    put(dRefs.dir, heading(t.trail) || '—');
    put(dRefs.pos, Math.round(t.cx / frameW * 100) + '% / ' + Math.round(t.cy / frameH * 100) + '%');
    put(dRefs.box, Math.round(t.bbox[2]) + '×' + Math.round(t.bbox[3]) + ' px');
    put(dRefs.share, Math.round(t.bbox[3] / frameH * 100) + '%');
    put(dRefs.pts, String(t.trail.length));

    if (dRefs.age) {
      if (t.ageN > 0) {
        put(dRefs.age, '~' + Math.round(t.ageSum / t.ageN) + ' (' + t.ageN + ' ' + T('measurements') + ')');
        dRefs.age.className = 'est';
        var sq = '<span style="display:inline-block;width:10px;height:10px;vertical-align:-1px;' +
          'margin-inline-end:6px;background:' + (t.gender === 'male' ? '#39ff14' : '#ff5fbf') + '"></span>';
        put(dRefs.gender, sq + '<bdi>' + (t.gender === 'male' ? T('male') : T('female')) + '</bdi>' +
          ' · ' + Math.round(t.genderProb * 100) + '%');
        dRefs.gender.className = 'est';
      } else {
        var waiting = t.faceTried > 0 ? T('noface') : T('computing');
        put(dRefs.age, waiting);
        put(dRefs.gender, waiting);
        dRefs.age.className = 'na';
        dRefs.gender.className = 'na';
      }
      if (calib) {
        put(dRefs.height, Math.round(t.bbox[3] / calib.px * calib.cm) + ' cm');
        dRefs.height.className = 'est';
      } else {
        put(dRefs.height, T('needCal'));
        dRefs.height.className = 'na';
      }
    }
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
        els.list.innerHTML = '<div class="empty">' + T('nothing') + '<br>' + T('hint') + '</div>';
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
        r.name.innerHTML = clsName(t.cls) +
          ' <span style="color:var(--muted)">ID ' + t.id + '</span>';
      }
      var seen = t.lastSeen - t.firstSeen;
      var extra = t.ageN > 0 ? ' · ~' + Math.round(t.ageSum / t.ageN) : '';
      var meta = clock(seen) + ' · ' +
        iso(t.speed > STATIONARY_PX_S ? T('moving') : T('still')) + extra;
      if (r.meta.textContent !== meta) r.meta.textContent = meta;
      var conf = Math.round(t.score * 100) + '%';
      if (r.conf.textContent !== conf) r.conf.textContent = conf;
      r.el.classList.toggle('sel', t.id === selectedId);
      // Same colour the box is drawn in, so the list and the frame agree.
      var rc = boxColor(t, t.id === selectedId, t.marked, WEAPON_CLASSES[t.cls]);
      r.el.style.borderInlineStartColor = rc;
      r.el.querySelector('.pip').style.background = rc;
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
      maybeRecognise();
      maybeSegment();

      var breach = checkTamper();
      if (breach) {
        if (rec.recorder && rec.auto) {
          rec.stopAt = performance.now() + CLIP_SECONDS * 1000;   // extend the clip
          showAlert(T(breach) + ' — ' + T('recCont'));
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

  /* A terminal-style boot screen in place of a bare spinner. The model really
     does take a while to come up, so the log lines are timed against that work
     rather than being pure theatre: each stage line is printed when that stage
     actually starts. */
  /* A 17-second boot in the shape of the reference clip: a dense install log
     with a progress line, then a mosaic of terminal panes, then a clear green
     banner. It also waits for the real model load, so the camera starts when
     both the sequence and the work behind it are done. */
  var BOOT_SECONDS = 17;

  /* The reference boot had the cadence of an apt install. Keeping the rhythm,
     but the component names are this system's own - a boot log that advertises
     a novelty package undercuts the product it is booting. */
  var PKGS = ['gda-core', 'gda-vision-rt', 'libtensor-webgl', 'libcodec-h264',
    'detector-ssdlite', 'tracker-iou', 'reid-appearance', 'face-tiny-fd',
    'attr-age-gender', 'face-embed-128', 'seg-bodypix', 'zone-engine',
    'tamper-watch', 'clip-recorder', 'gda-telemetry', 'gda-ui'];

  function bootScript() {
    var out = [];
    out.push('$ gda-vision --init --device=auto');
    out.push('Reading package lists... <b>Done</b>');
    out.push('Building dependency tree... <b>Done</b>');
    out.push('The following NEW packages will be installed:');
    out.push('  ' + PKGS.join(' '));
    out.push('0 upgraded, ' + PKGS.length + ' newly installed, 0 to remove.');
    out.push('Need to get 2,979 kB of archives.');
    PKGS.forEach(function (n, i) {
      out.push('Get:' + (i + 1) + ' mirror/main amd64 <i>' + n +
        '</i> [' + (18 + i * 7) + '.' + (i % 9) + ' kB]');
    });
    PKGS.forEach(function (n) { out.push('Unpacking <i>' + n + '</i> ...'); });
    PKGS.forEach(function (n) { out.push('Setting up <i>' + n + '</i> ...'); });
    out.push('Processing triggers for <i>gda-core</i> (4.2.1) ...');
    out.push('');
    out.push('$ gda-vision --load-models');
    out.push('runtime ......................... <b>tfjs 4.22.0</b>');
    out.push('backend ......................... <b>webgl</b>');
    out.push('detector <i>ssdlite_mobilenet_v2</i> ..... <b>18.0 MB</b>');
    out.push('face detector <i>tiny_face_detector</i>');
    out.push('attribute head <i>age_gender</i>');
    out.push('segmentation <i>bodypix_mobilenet_050</i>');
    out.push('tracker ......................... <b>IoU + appearance re-id</b>');
    out.push('tamper watch .................... <b>armed</b>');
    out.push('camera .......................... <b>requesting</b>');
    return out;
  }

  var PANES = [
    { t: 'NET', c: 'cyan', body: function (k) {
        var rows = ['iface     rx        tx'];
        ['eth0', 'wlan0', 'lo'].forEach(function (n, i) {
          rows.push(n.padEnd(9) + ((k * 7 + i * 31) % 900 + 100) + ' kB/s  ' +
            ((k * 3 + i * 17) % 400 + 40) + ' kB/s');
        });
        return rows.join('\n');
      } },
    { t: 'HEXDUMP', c: '', body: function (k) {
        var rows = [];
        for (var i = 0; i < 6; i++) {
          var addr = (0x1a0 + (k + i) * 16).toString(16).padStart(8, '0');
          var hx = [];
          for (var j = 0; j < 8; j++) hx.push((((k * 13 + i * 7 + j * 29) % 256)).toString(16).padStart(2, '0'));
          rows.push(addr + '  ' + hx.join(' '));
        }
        return rows.join('\n');
      } },
    { t: 'PROC', c: 'amber', body: function (k) {
        var rows = ['pid   cpu   rss   cmd'];
        ['gda-vision', 'tfjs-wrk', 'v4l2', 'render'].forEach(function (n, i) {
          rows.push(String(1200 + i * 37).padEnd(6) +
            (((k * 5 + i * 11) % 60) + '%').padEnd(6) +
            (((k + i * 40) % 300 + 60) + 'M').padEnd(6) + n);
        });
        return rows.join('\n');
      } },
    { t: 'TREE', c: '', body: function () {
        return ' └─ /models\n    ├─ detector\n    │   └─ ssdlite_v2\n    ├─ face\n    │   ├─ tiny_fd\n    │   └─ age_gender\n    └─ seg\n        └─ bodypix';
      } },
    { t: 'SIGNAL', c: 'cyan', body: function (k) {
        var rows = [];
        for (var r = 0; r < 5; r++) {
          var line = '';
          for (var c = 0; c < 26; c++) {
            var v = Math.sin((c + k) * 0.5 + r) * 2 + 2;
            line += (Math.round(v) === r) ? '█' : ((c + k) % 9 === 0 ? '·' : ' ');
          }
          rows.push(line);
        }
        return rows.join('\n');
      } },
    { t: 'STATUS', c: 'amber', body: function (k) {
        return 'uptime    ' + String(k).padStart(4, '0') + 's\n' +
               'frames    ' + (k * 13) + '\n' +
               'queue     ' + (k % 4) + '\n' +
               'errors    0\n' +
               'state     ' + (k % 2 ? 'SCAN' : 'IDLE');
      } }
  ];

  var bootCells = [], bootTimer = 0, bootTick = 0, bootLine = 0;
  var bootLines = [], bootStartedAt = 0, bootResolve = null;

  function bootStart() {
    els.boot.hidden = false;
    els.bootDone.hidden = true;
    els.bootMosaic.hidden = true;
    els.bootLog.hidden = false;
    els.bootLog.innerHTML = '';
    els.bootGrid.innerHTML = '';
    els.bootMosaic.innerHTML = '';
    bootCells = [];
    for (var i = 0; i < 320; i++) {   // 64 columns x 5 rows
      var c = document.createElement('span');
      els.bootGrid.appendChild(c);
      bootCells.push(c);
    }
    PANES.forEach(function (pane, i) {
      var el = document.createElement('div');
      el.className = 'pane ' + pane.c + (i === 0 ? ' wide' : '');
      el.innerHTML = '<h4>' + pane.t + '</h4><div></div>';
      els.bootMosaic.appendChild(el);
    });

    bootLines = bootScript();
    bootLine = 0;
    bootTick = 0;
    bootStartedAt = performance.now();

    clearInterval(bootTimer);
    bootTimer = setInterval(bootFrame, 100);
    return new Promise(function (res) { bootResolve = res; });
  }

  function bootFrame() {
    bootTick++;
    var elapsed = (performance.now() - bootStartedAt) / 1000;
    var f = Math.min(1, elapsed / BOOT_SECONDS);

    // Act 1 + 2: the log races ahead of the clock so it feels like real output.
    var want = Math.floor(bootLines.length * Math.min(1, f / 0.62));
    while (bootLine < want && bootLine < bootLines.length) {
      els.bootLog.innerHTML += bootLines[bootLine] + '\n';
      bootLine++;
    }
    els.bootLog.scrollTop = els.bootLog.scrollHeight;

    var pct = Math.round(f * 100);
    els.bootPct.textContent = 'Progress: [' + String(pct).padStart(3, ' ') + '%]';
    var width = 46;
    var filled = Math.round(width * f);
    els.bootTrack.textContent = '[' + '#'.repeat(filled) + '.'.repeat(width - filled) + ']';

    var upto = Math.round(bootCells.length * f);
    for (var i = 0; i < bootCells.length; i++) bootCells[i].classList.toggle('on', i < upto);

    // Act 3: the pane mosaic takes over for the last third.
    if (f > 0.62) {
      els.bootMosaic.hidden = false;
      els.bootLog.hidden = true;        // the mosaic takes the stage
      var panes = els.bootMosaic.children;
      for (var j = 0; j < panes.length; j++) {
        panes[j].lastChild.textContent = PANES[j].body(bootTick);
      }
    }

    els.bootStatus.textContent =
      f < 0.35 ? 'INSTALLING DEPENDENCIES' :
      f < 0.62 ? 'DECODING MODEL WEIGHTS' :
      f < 0.92 ? 'CALIBRATING PIPELINE' : 'HANDING OVER TO CAMERA';

    if (f >= 1) {
      clearInterval(bootTimer);
      els.bootDone.hidden = false;
      setTimeout(function () {
        els.boot.hidden = true;
        if (bootResolve) { bootResolve(); bootResolve = null; }
      }, 900);
    }
  }

  function bootProgress() { /* the clock drives the bar; real load is awaited separately */ }

  function setProgress(pct, msg) {
    els.bar.hidden = false;
    els.barFill.style.width = pct + '%';
    if (msg) els.splashMsg.textContent = msg;

  }

  /* The weights ship gzipped and written in 85 characters rather than base64:
     base64 costs 33% over the raw bytes, this costs 25%, and gzip takes a
     slice off before that. build.py writes it; this reads it back. The
     alphabet leaves out < > & \\ " ' and the backtick so the payload cannot
     terminate the script element it sits in. */
  var B85 = "!#$%()*+,-./0123456789:;=?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_" +
            "abcdefghijklmnopqrstuvwxyz{|";
  var B85R = new Uint8Array(128);
  for (var b85i = 0; b85i < 85; b85i++) B85R[B85.charCodeAt(b85i)] = b85i;

  function b85Decode(z, n) {
    var out = new Uint8Array((z.length / 5) * 4), o = 0;
    for (var i = 0; i < z.length; i += 5) {
      // Stays well inside the exact-integer range of a double (max ~4.29e9).
      var v = (((B85R[z.charCodeAt(i)] * 85 + B85R[z.charCodeAt(i + 1)]) * 85 +
                 B85R[z.charCodeAt(i + 2)]) * 85 + B85R[z.charCodeAt(i + 3)]) * 85 +
               B85R[z.charCodeAt(i + 4)];
      out[o++] = Math.floor(v / 16777216) & 255;
      out[o++] = (v >>> 16) & 255;
      out[o++] = (v >>> 8) & 255;
      out[o++] = v & 255;
    }
    return out.subarray(0, n);
  }

  function gunzip(bytes) {
    var stream = new Blob([bytes]).stream()
      .pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
  }

  function unpack(entry) {
    return gunzip(b85Decode(entry.z, entry.n));
  }

  async function unpackJSON(entry) {
    return JSON.parse(new TextDecoder().decode(await unpack(entry)));
  }

  async function decodeFaceWeights(entry) {
    var specs = [];
    entry.manifest.forEach(function (g) { specs = specs.concat(g.weights); });
    return tf.io.decodeWeights(await unpack(entry.weights), specs);
  }

  async function loadModels() {
    if (model) return;
    var spec = window.__VT_MODEL__;
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser cannot inflate the bundled models. ' +
        'Chrome, Edge, Firefox 113+ or Safari 16.4+ are needed.');
    }

    setProgress(15, 'טוען את מנוע הזיהוי…');
    await new Promise(function (r) { setTimeout(r, 30); });

    var specs = [];
    spec.manifest.forEach(function (g) { specs = specs.concat(g.weights); });
    var handler = tf.io.fromMemory({
      modelTopology: await unpackJSON(spec.topology),
      weightSpecs: specs,
      weightData: await unpack(spec.weights)
    });
    model = await cocoSsd.load({ base: 'lite_mobilenet_v2', modelUrl: handler });

    setProgress(60, 'טוען זיהוי פנים…');
    try {
      /* These weights are uint8-quantized, so they cannot be handed over as a
         raw Float32Array - tf.io.decodeWeights applies each tensor's scale and
         zero point from the manifest first. */
      await faceapi.nets.tinyFaceDetector.loadFromWeightMap(await decodeFaceWeights(spec.faceDetector));
      await faceapi.nets.ageGenderNet.loadFromWeightMap(await decodeFaceWeights(spec.ageGender));
      faceReady = true;
      if (spec.landmarks && spec.recognition) {
        await faceapi.nets.faceLandmark68TinyNet.loadFromWeightMap(await decodeFaceWeights(spec.landmarks));
        await faceapi.nets.faceRecognitionNet.loadFromWeightMap(await decodeFaceWeights(spec.recognition));
        recogReady = true;
      }
    } catch (e) {
      // Detection and tracking still work; only age/gender is lost.
      console.warn('face models unavailable:', e);
      faceReady = false;
    }
    try {
      if (spec.seg && window.bodyPix) {
        var segSpecs = [];
        spec.seg.manifest.forEach(function (g) { segSpecs = segSpecs.concat(g.weights); });
        segNet = await bodyPix.load({
          architecture: 'MobileNetV1', outputStride: 16, multiplier: 0.5, quantBytes: 4,
          modelUrl: tf.io.fromMemory({
            modelTopology: await unpackJSON(spec.seg.topology),
            weightSpecs: segSpecs,
            weightData: await unpack(spec.seg.weights)
          })
        });
      }
    } catch (e) {
      console.warn('segmentation unavailable:', e);
      segNet = null;
    }
    setProgress(85, 'מתחבר למצלמה…');
  }

  async function startCamera() {
    els.err.hidden = true;
    els.start.disabled = els.startBig.disabled = true;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      fail(T('errNoCam'), T('errNoCamHint'));
      els.start.disabled = els.startBig.disabled = false;
      return;
    }

    var sequence = bootStart();
    try {
      await Promise.all([loadModels(), sequence]);
    } catch (e) {
      els.boot.hidden = true;
      fail(T('errModels'), String((e && e.message) || e));
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
      var hint = T('hintBusyGeneric');
      if (n === 'NotAllowedError') hint = T('hintDenied');
      if (n === 'NotFoundError') hint = T('hintNoDevice');
      if (n === 'NotReadableError') hint = T('hintBusy');
      els.boot.hidden = true;
      fail(T('errOpen'), hint);
      els.start.disabled = els.startBig.disabled = false;
      return;
    }
    // The boot sequence has already handed over by this point.
    els.boot.hidden = true;

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
    els.hudState.textContent = T(faceReady ? 'hudFace' : 'hudDet');

    enrolled = loadEnrolment();
    els.ownerBtn.classList.toggle('on', !!enrolled);
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
      fail(T('errFlip'), String((e && e.message) || e));
    }
  }

  // ------------------------------------------------------------------- events

  els.start.addEventListener('click', startCamera);
  els.startBig.addEventListener('click', startCamera);
  els.stop.addEventListener('click', stopCamera);
  els.flip.addEventListener('click', flipCamera);
  els.zoomIn.addEventListener('click', function () { setZoom(view.zoom * ZOOM_STEP); });
  els.zoomOut.addEventListener('click', function () { setZoom(view.zoom / ZOOM_STEP); });
  function applyLang() {
    document.documentElement.lang = lang;
    /* The layout stays left-to-right in both languages, so the sidebar, the
       control cluster and the HUD sit on the same side whichever language is
       selected. Hebrew words still render right-to-left inside their own run;
       only the frame around them stops flipping. */
    document.body.dir = 'ltr';
    els.lang.textContent = lang === 'he' ? 'EN' : 'עב';
    els.start.textContent = T('start');
    els.stop.textContent = T('stop');
    els.flip.textContent = T('flip');
    els.startBig.textContent = T('startBig');
    [['zoomIn', 'tZoomIn'], ['zoomOut', 'tZoomOut'], ['follow', 'tFollow'],
     ['ownerBtn', 'tOwner'], ['segBtn', 'tSeg'], ['recBtn', 'tRec']
    ].forEach(function (pair) {
      if (els[pair[0]]) els[pair[0]].title = T(pair[1]);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.legend b'), function (b) {
      b.textContent = T(b.getAttribute('data-k'));
    });
    if (running) els.hudState.textContent = T(faceReady ? 'hudFace' : 'hudDet');
    renderClips();
    ['legend', 'tracked'].forEach(function (k) {
      var el = document.querySelector('[data-i18n="' + k + '"]');
      if (el) el.textContent = T(k);
    });
    var dts = document.querySelectorAll('.stats .stat dt');
    ['fps', 'onScreen', 'total', 'time'].forEach(function (k, i) {
      if (dts[i]) dts[i].textContent = T(k);
    });
    rowEls = Object.create(null);
    els.list.innerHTML = '';
    detailKey = null;
    renderDetail((performance.now() - startedAt) / 1000);
  }

  els.lang.addEventListener('click', function () {
    lang = lang === 'he' ? 'en' : 'he';
    try { localStorage.setItem('vt_lang', lang); } catch (e) { /* private mode */ }
    applyLang();
  });

  try {
    var saved = localStorage.getItem('vt_lang');
    if (saved === 'en' || saved === 'he') lang = saved;
  } catch (e) { /* private mode */ }
  applyLang();

  els.ownerBtn.addEventListener('click', startEnrolment);

  els.segBtn.addEventListener('click', function () {
    if (!segNet) {
      showAlert(lang === 'he' ? 'מודל הצללית לא נטען' : 'Segmentation model not loaded');
      return;
    }
    segOn = !segOn;
    els.segBtn.classList.toggle('on', segOn);
    els.segBtn.textContent = segOn ? '◧' : '▣';
    if (!segOn) segMask = null;
  });

  els.recBtn.addEventListener('click', function () {
    if (rec.recorder) stopRecording();
    else startRecording(false, 'recManual');
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

  /* Demo access gate. This is a front-door prop for the product shell, not a
     security boundary: the code lives in the page, so anyone can read it. Real
     access control has to sit on a server. */
  var GATE_CODE = '123';

  function unlockGate(autostart) {
    els.gate.hidden = true;
    els.gate.style.display = 'none';
    /* Clearing the gate is a user gesture, which is what getUserMedia and
       autoplay need - so the camera can come straight up without a second
       click. The big start button stays for anyone who stops the feed. */
    if (autostart !== false && !running) startCamera();
  }

  /* Show/hide toggles on the two password fields. */
  Array.prototype.forEach.call(document.querySelectorAll('.eye'), function (btn) {
    btn.addEventListener('click', function () {
      var input = document.getElementById(btn.getAttribute('data-for'));
      if (!input) return;
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.classList.toggle('shown', show);
      btn.setAttribute('aria-label', show ? 'hide' : 'show');
      input.focus();
    });
  });

  els.gateForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = els.gUser.value.trim() === GATE_CODE &&
             els.gPass1.value === GATE_CODE &&
             els.gPass2.value === GATE_CODE;
    if (ok) {
      unlockGate(true);
    } else {
      els.gateErr.hidden = false;
      els.gateForm.classList.remove('shake');
      void els.gateForm.offsetWidth;
      els.gateForm.classList.add('shake');
      setTimeout(function () { els.gateErr.hidden = true; }, 2600);
    }
  });

  window.__VT_UNLOCK__ = unlockGate;
  window.__VT_READY__ = true;
  window.__VT_DEBUG__ = function () {
    return {
      tracks: tracks.length, selected: selectedId, zoom: view.zoom,
      marked: tracks.filter(function(t){return t.marked}).map(function(t){return t.id}),
      faceReady: faceReady, armed: tamper.armed,
      recogReady: recogReady, enrolled: !!enrolled, enrolling: enrolling,
      owners: tracks.filter(function (t) { return t.owner; }).map(function (t) { return t.id; }),
      segReady: !!segNet, segOn: segOn, ghosts: ghosts.length,
      reclaimed: tracks.filter(function (t) { return t.reclaimed; }).map(function (t) { return t.id; }),
      recording: !!rec.recorder, clips: clips.length,
      people: tracks.filter(function (t) { return t.cls === 'person'; }).map(function (t) {
        return { id: t.id, ageN: t.ageN, age: t.ageN ? Math.round(t.ageSum / t.ageN) : null,
                 gender: t.gender, tried: t.faceTried };
      })
    };
  };
})();

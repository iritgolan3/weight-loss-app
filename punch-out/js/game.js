/* Punch-Out!! — boot, fixed-timestep loop, touch controls. */
(function () {
  'use strict';
  var PO = window.PO, BTN = PO.BTN;

  var STEP = 1000 / 60;
  var acc = 0, last = 0, running = false;

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!last) last = now;
    var dt = now - last;
    last = now;
    if (dt > 250) dt = 250;          /* tabbed away: don't fast-forward */
    acc += dt;
    var steps = 0;
    while (acc >= STEP && steps < 4) {
      PO.Scenes.update();
      PO.Input.newFrame();
      acc -= STEP;
      steps++;
    }
    PO.Scenes.draw();
    PO.present();
  }

  /* ---------------- touch ---------------- */
  function bindTouch() {
    var pad = document.getElementById('touch');
    if (!pad) return;
    var map = {
      up: BTN.UP, down: BTN.DOWN, left: BTN.LEFT, right: BTN.RIGHT,
      a: BTN.A, b: BTN.B, start: BTN.START, select: BTN.SELECT
    };
    var active = {};          /* pointerId -> button */

    function buttonAt(x, y) {
      var el = document.elementFromPoint(x, y);
      while (el && el !== pad) {
        if (el.dataset && el.dataset.btn) return el;
        el = el.parentElement;
      }
      return null;
    }
    function release(id) {
      if (active[id] === undefined) return;
      var b = active[id];
      delete active[id];
      /* only lift the button if no other pointer is still on it */
      for (var k in active) if (active[k] === b) return;
      PO.Input.set(b, false);
      highlight(b, false);
    }
    function highlight(b, on) {
      var nodes = pad.querySelectorAll('[data-btn]');
      for (var i = 0; i < nodes.length; i++) {
        if (map[nodes[i].dataset.btn] === b) nodes[i].classList.toggle('on', on);
      }
    }
    function press(id, el) {
      var b = map[el.dataset.btn];
      if (b === undefined) return;
      if (active[id] === b) return;
      if (active[id] !== undefined) release(id);
      active[id] = b;
      PO.Input.set(b, true);
      highlight(b, true);
    }

    pad.addEventListener('pointerdown', function (e) {
      var el = buttonAt(e.clientX, e.clientY);
      if (!el) return;
      e.preventDefault();
      pad.setPointerCapture && pad.setPointerCapture(e.pointerId);
      press(e.pointerId, el);
      PO.Audio.init();
    });
    pad.addEventListener('pointermove', function (e) {
      if (active[e.pointerId] === undefined) return;
      e.preventDefault();
      var el = buttonAt(e.clientX, e.clientY);   /* let a finger slide across the d-pad */
      if (el) press(e.pointerId, el); else release(e.pointerId);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      pad.addEventListener(ev, function (e) { e.preventDefault(); release(e.pointerId); });
    });
    pad.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  /* swipe-to-dodge anywhere on the screen */
  function bindSwipe(canvas) {
    var sx = 0, sy = 0, st = 0, id = null;
    canvas.addEventListener('pointerdown', function (e) {
      id = e.pointerId; sx = e.clientX; sy = e.clientY; st = performance.now();
      PO.Audio.init();
    });
    canvas.addEventListener('pointerup', function (e) {
      if (e.pointerId !== id) return;
      id = null;
      var dx = e.clientX - sx, dy = e.clientY - sy, dt = performance.now() - st;
      if (dt > 400) return;
      var b = null;
      if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) b = dx < 0 ? BTN.LEFT : BTN.RIGHT;
      else if (dy > 30) b = BTN.DOWN;
      else if (Math.abs(dx) < 20 && Math.abs(dy) < 20) b = BTN.A;
      if (b === null) return;
      PO.Input.set(b, true);
      setTimeout(function () { PO.Input.set(b, false); }, 110);
    });
  }

  function unlockAudio() {
    PO.Audio.init();
    if (!PO.Audio.isEnabled()) PO.Audio.setEnabled(true);
    var s = PO.Scenes.current();
    if (s && s.name === 'title') PO.Audio.playMusic('title');
  }

  window.addEventListener('DOMContentLoaded', function () {
    var canvas = document.getElementById('screen');
    PO.initDisplay(canvas);
    bindTouch();
    bindSwipe(canvas);

    ['keydown', 'pointerdown'].forEach(function (ev) {
      window.addEventListener(ev, function once() {
        unlockAudio();
        window.removeEventListener(ev, once);
      }, { once: true });
    });

    PO.Scenes.boot();
    running = true;
    requestAnimationFrame(frame);

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { PO.Input.reset(); last = 0; acc = 0; }
  });

  PO.debug = {
    goto: function (n) { PO.Game.progress = n; PO.Scenes.go('vs', { index: n }); },
    scene: function (n, d) { PO.Scenes.go(n, d); }
  };
})();

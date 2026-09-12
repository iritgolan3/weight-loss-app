/* Punch-Out!! — core: framebuffer renderer, NES palette, bitmap font, input.
   Everything draws into a 256x224 pixel buffer, then gets blitted to the
   canvas with nearest-neighbour integer scaling. */
(function () {
  'use strict';
  var PO = (window.PO = window.PO || {});

  var W = (PO.W = 256), H = (PO.H = 224);

  /* ---------- NES palette (2C02) ---------- */
  var HEX = {
    black:'#000000', white:'#FCFCFC', grey:'#BCBCBC', grey2:'#7C7C7C', grey3:'#3C3C3C',
    red:'#D82800', red2:'#F83800', redL:'#FC7460', redD:'#A81000', maroon:'#6C1000',
    orange:'#FC9838', orangeD:'#E45C10', brown:'#AC7C00', brownD:'#503000', brownL:'#D0A040',
    tan:'#F0BC3C', gold:'#FCD8A8',
    skin:'#FCBCB0', skinD:'#E09080', skinDD:'#A85038', skinL:'#FCE0D8',
    tanSkin:'#F8B860', tanSkinD:'#C07020', tanSkinDD:'#803800',
    darkSkin:'#AC4400', darkSkinD:'#6C2000', darkSkinL:'#D87830',
    blue:'#0000FC', blueD:'#0000BC', blueL:'#3CBCFC', navy:'#000088', sky:'#A4E4FC',
    cyan:'#00E8D8', cyanD:'#008888', teal:'#00A090',
    green:'#00A800', greenL:'#B8F818', greenD:'#007800', greenM:'#58D854', olive:'#588800',
    yellow:'#F8D878', yellowL:'#FCFCA8',
    pink:'#F878F8', pinkL:'#FCC4FC', pinkD:'#B800B8', magenta:'#D800CC',
    purple:'#6844FC', purpleD:'#4428BC', violet:'#9878F8',
    ringBlue:'#0058F8', ringGreen:'#00A844', ringTeal:'#00C8A0', ringPurple:'#5850E0'
  };
  function pack(hex) {
    var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    return (255 << 24) | (b << 16) | (g << 8) | r; // ABGR little-endian
  }
  var C = (PO.C = {});
  for (var k in HEX) C[k] = pack(HEX[k]);
  C.none = 0;
  PO.HEX = HEX;
  PO.pack = pack;

  /* mix two packed colours, t in 0..1 */
  PO.mix = function (a, b, t) {
    var ar = a & 255, ag = (a >> 8) & 255, ab = (a >> 16) & 255;
    var br = b & 255, bg = (b >> 8) & 255, bb = (b >> 16) & 255;
    return (255 << 24) | (((ab + (bb - ab) * t) | 0) << 16) | (((ag + (bg - ag) * t) | 0) << 8) | ((ar + (br - ar) * t) | 0);
  };

  /* ---------- framebuffer ---------- */
  var buf32 = new Uint32Array(W * H);
  var imgData = null, ctx2 = null, off = null;
  PO.buf = buf32;

  PO.clear = function (col) { buf32.fill(col === undefined ? C.black : col); };

  function px(x, y, c) {
    if (c === 0) return;
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    buf32[y * W + x] = c;
  }
  PO.px = px;

  PO.fillRect = function (x, y, w, h, c) {
    if (c === 0) return;
    x |= 0; y |= 0; w |= 0; h |= 0;
    var x0 = x < 0 ? 0 : x, y0 = y < 0 ? 0 : y;
    var x1 = x + w > W ? W : x + w, y1 = y + h > H ? H : y + h;
    for (var yy = y0; yy < y1; yy++) {
      var row = yy * W;
      for (var xx = x0; xx < x1; xx++) buf32[row + xx] = c;
    }
  };

  PO.rect = function (x, y, w, h, c) {
    PO.fillRect(x, y, w, 1, c); PO.fillRect(x, y + h - 1, w, 1, c);
    PO.fillRect(x, y, 1, h, c); PO.fillRect(x + w - 1, y, 1, h, c);
  };

  PO.hline = function (x, y, w, c) { PO.fillRect(x, y, w, 1, c); };
  PO.vline = function (x, y, h, c) { PO.fillRect(x, y, 1, h, c); };

  PO.line = function (x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    var dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    var err = dx + dy;
    for (;;) {
      px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };

  /* filled ellipse (integer, pixel-art friendly) */
  PO.ellipse = function (cx, cy, rx, ry, c) {
    if (rx <= 0 || ry <= 0) return;
    for (var y = -ry; y <= ry; y++) {
      var t = 1 - (y * y) / (ry * ry);
      if (t < 0) continue;
      var w = Math.sqrt(t) * rx;
      var x0 = Math.round(cx - w), x1 = Math.round(cx + w);
      PO.fillRect(x0, cy + y, x1 - x0 + 1, 1, c);
    }
  };

  /* filled circle outline helper */
  PO.ellipseOutline = function (cx, cy, rx, ry, c) {
    for (var y = -ry; y <= ry; y++) {
      var t = 1 - (y * y) / (ry * ry);
      if (t < 0) continue;
      var w = Math.sqrt(t) * rx;
      px(Math.round(cx - w), cy + y, c);
      px(Math.round(cx + w), cy + y, c);
    }
    for (var x = -rx; x <= rx; x++) {
      var t2 = 1 - (x * x) / (rx * rx);
      if (t2 < 0) continue;
      var h = Math.sqrt(t2) * ry;
      px(cx + x, Math.round(cy - h), c);
      px(cx + x, Math.round(cy + h), c);
    }
  };

  /* thick tapered segment — used for arms and legs.
     Distance-to-segment so the edges stay smooth at any angle. */
  PO.limb = function (x0, y0, x1, y1, w0, w1, c, edge) {
    var r0 = w0 / 2, r1 = w1 / 2;
    var minx = Math.floor(Math.min(x0, x1) - Math.max(r0, r1) - 1);
    var maxx = Math.ceil(Math.max(x0, x1) + Math.max(r0, r1) + 1);
    var miny = Math.floor(Math.min(y0, y1) - Math.max(r0, r1) - 1);
    var maxy = Math.ceil(Math.max(y0, y1) + Math.max(r0, r1) + 1);
    var dx = x1 - x0, dy = y1 - y0;
    var len2 = dx * dx + dy * dy;
    if (len2 < 0.0001) len2 = 0.0001;
    for (var y = miny; y <= maxy; y++) {
      if (y < 0 || y >= H) continue;
      for (var x = minx; x <= maxx; x++) {
        if (x < 0 || x >= W) continue;
        var t = ((x - x0) * dx + (y - y0) * dy) / len2;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        var px2 = x0 + dx * t, py2 = y0 + dy * t;
        var d = Math.sqrt((x - px2) * (x - px2) + (y - py2) * (y - py2));
        var r = r0 + (r1 - r0) * t;
        if (d <= r - 0.75) buf32[y * W + x] = c;
        else if (edge && d <= r + 0.25) buf32[y * W + x] = edge;
      }
    }
  };

  /* ---------- sprites ---------- */
  /* def = { pal: {char: colorKeyOrPacked}, rows: ['..aa..', ...] }  '.'/' ' = clear */
  PO.sprite = function (def) {
    var rows = def.rows, h = rows.length, w = 0, i;
    for (i = 0; i < h; i++) if (rows[i].length > w) w = rows[i].length;
    var data = new Uint32Array(w * h);
    for (var y = 0; y < h; y++) {
      var r = rows[y];
      for (var x = 0; x < r.length; x++) {
        var ch = r.charAt(x);
        if (ch === '.' || ch === ' ') continue;
        var v = def.pal[ch];
        if (v === undefined) continue;
        data[y * w + x] = (typeof v === 'string') ? (C[v] !== undefined ? C[v] : pack(v)) : v;
      }
    }
    return { w: w, h: h, data: data };
  };

  PO.blit = function (sp, x, y, flip, tint) {
    var w = sp.w, h = sp.h, d = sp.data;
    for (var yy = 0; yy < h; yy++) {
      var ty = y + yy;
      if (ty < 0 || ty >= H) continue;
      for (var xx = 0; xx < w; xx++) {
        var c = d[yy * w + xx];
        if (!c) continue;
        var tx = x + (flip ? (w - 1 - xx) : xx);
        if (tx < 0 || tx >= W) continue;
        buf32[ty * W + tx] = tint ? tint(c) : c;
      }
    }
  };

  /* blit scaled by integer factor */
  PO.blitScaled = function (sp, x, y, s) {
    var w = sp.w, h = sp.h, d = sp.data;
    for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
      var c = d[yy * w + xx];
      if (!c) continue;
      PO.fillRect(x + xx * s, y + yy * s, s, s, c);
    }
  };

  /* ---------- 8x8 bitmap font ---------- */
  var FONT_HEX = {
    'A':'78CCCCFCCCCCCC00','B':'F8CCCCF8CCCCF800','C':'78CCC0C0C0CC7800','D':'F8CCCCCCCCCCF800',
    'E':'FCC0C0F8C0C0FC00','F':'FCC0C0F8C0C0C000','G':'78CCC0DCCCCC7800','H':'CCCCCCFCCCCCCC00',
    'I':'FC3030303030FC00','J':'1C0C0C0CCCCC7800','K':'CCD8F0F0D8CCCC00','L':'C0C0C0C0C0C0FC00',
    'M':'C3E7FFDBDBC3C300','N':'CCECFCDCCCCCCC00','O':'78CCCCCCCCCC7800','P':'F8CCCCF8C0C0C000',
    'Q':'78CCCCCCDCCC7C00','R':'F8CCCCF8D8CCCC00','S':'78CCC0780CCC7800','T':'FC30303030303000',
    'U':'CCCCCCCCCCCC7800','V':'CCCCCCCCCC783000','W':'C3C3C3DBFFE7C300','X':'CCCC783078CCCC00',
    'Y':'CCCC783030303000','Z':'FC0C183060C0FC00',
    '0':'78CCDCFCECCC7800','1':'307030303030FC00','2':'78CC0C183060FC00','3':'78CC0C380CCC7800',
    '4':'183878D8FC181800','5':'FCC0F80C0CCC7800','6':'78CCC0F8CCCC7800','7':'FC0C0C1830606000',
    '8':'78CCCC78CCCC7800','9':'78CCCC7C0C0C7800',
    ' ':'0000000000000000','.':'0000000000303000',',':'0000000000303060','!':'3030303030003000',
    '?':'78CC0C1830003000',':':'0000300000300000',"'":'3030000000000000','"':'6C6C000000000000',
    '-':'000000FC00000000','#':'6C6CFE6CFE6C6C00','(':'1830606060301800',')':'6030181818306000',
    '/':'0C0C183060C0C000','+':'003030FC30300000','=':'0000FC00FC000000','*':'00CC783078CC0000',
    '&':'70D8D870DACC7600','%':'C6CC183066CC0600','<':'0C18306030180C00','>':'C06030183060C000',
    '_':'00000000000000FC','~':'0076DC0000000000',';':'0000300000303060'
  };
  var GLYPH = {};
  (function () {
    for (var ch in FONT_HEX) {
      var hx = FONT_HEX[ch], rows = [];
      for (var i = 0; i < 8; i++) rows.push(parseInt(hx.substr(i * 2, 2), 16));
      GLYPH[ch] = rows;
    }
  })();

  /* draw text. opts: {shadow, spacing, scale} */
  PO.text = function (str, x, y, col, opts) {
    opts = opts || {};
    var sp = opts.spacing === undefined ? 8 : opts.spacing;
    var sc = opts.scale || 1;
    str = String(str).toUpperCase();
    var cx = x;
    for (var i = 0; i < str.length; i++) {
      var g = GLYPH[str.charAt(i)];
      if (g) {
        for (var r = 0; r < 8; r++) {
          var bits = g[r];
          if (!bits) continue;
          for (var b = 0; b < 8; b++) {
            if (bits & (128 >> b)) {
              if (opts.shadow) {
                if (sc === 1) px(cx + b + 1, y + r + 1, opts.shadow);
                else PO.fillRect(cx + b * sc + sc, y + r * sc + sc, sc, sc, opts.shadow);
              }
            }
          }
        }
        for (var r2 = 0; r2 < 8; r2++) {
          var bits2 = g[r2];
          if (!bits2) continue;
          for (var b2 = 0; b2 < 8; b2++) {
            if (bits2 & (128 >> b2)) {
              if (sc === 1) px(cx + b2, y + r2, col);
              else PO.fillRect(cx + b2 * sc, y + r2 * sc, sc, sc, col);
            }
          }
        }
      }
      cx += sp * sc;
    }
    return cx;
  };

  PO.textWidth = function (str, opts) {
    opts = opts || {};
    var sp = opts.spacing === undefined ? 8 : opts.spacing;
    return String(str).length * sp * (opts.scale || 1);
  };

  PO.textCenter = function (str, cx, y, col, opts) {
    PO.text(str, Math.round(cx - PO.textWidth(str, opts) / 2), y, col, opts);
  };

  /* ---------- display ---------- */
  PO.initDisplay = function (canvas) {
    off = document.createElement('canvas');
    off.width = W; off.height = H;
    ctx2 = off.getContext('2d');
    imgData = ctx2.createImageData(W, H);
    PO.canvas = canvas;
    PO.ctx = canvas.getContext('2d', { alpha: false });
    PO.ctx.imageSmoothingEnabled = false;
    PO.resize();
    window.addEventListener('resize', PO.resize);
  };

  PO.resize = function () {
    if (!PO.canvas) return;
    var host = PO.canvas.parentElement;
    var aw = host.clientWidth, ah = host.clientHeight;
    if (aw < 8 || ah < 8) return;
    var fit = Math.min(aw / W, ah / H);
    /* whole-number scaling keeps the pixel grid perfect, but on a phone a 1x
       screen wastes most of the display — fall back to filling the space. */
    var scale = Math.max(1, Math.floor(fit));
    if (scale / fit < 0.8) scale = fit;
    PO.canvas.width = Math.round(W * scale);
    PO.canvas.height = Math.round(H * scale);
    PO.canvas.style.width = PO.canvas.width + 'px';
    PO.canvas.style.height = PO.canvas.height + 'px';
    PO.ctx = PO.canvas.getContext('2d', { alpha: false });
    PO.ctx.imageSmoothingEnabled = false;
    PO.scale = scale;
  };

  PO.present = function () {
    new Uint32Array(imgData.data.buffer).set(buf32);
    ctx2.putImageData(imgData, 0, 0);
    PO.ctx.drawImage(off, 0, 0, W, H, 0, 0, PO.canvas.width, PO.canvas.height);
  };

  /* ---------- input ---------- */
  var BTN = PO.BTN = { UP: 0, DOWN: 1, LEFT: 2, RIGHT: 3, A: 4, B: 5, START: 6, SELECT: 7 };
  var held = [false, false, false, false, false, false, false, false];
  var pressed = [false, false, false, false, false, false, false, false];
  var buffered = [0, 0, 0, 0, 0, 0, 0, 0];

  var KEYMAP = {
    ArrowUp: BTN.UP, ArrowDown: BTN.DOWN, ArrowLeft: BTN.LEFT, ArrowRight: BTN.RIGHT,
    KeyW: BTN.UP, KeyS: BTN.DOWN, KeyA: BTN.LEFT, KeyD: BTN.RIGHT,
    KeyX: BTN.A, KeyK: BTN.A, Period: BTN.A,
    KeyZ: BTN.B, KeyJ: BTN.B, Comma: BTN.B,
    Enter: BTN.START, Space: BTN.START,
    ShiftRight: BTN.SELECT, ShiftLeft: BTN.SELECT, KeyQ: BTN.SELECT, Backspace: BTN.SELECT
  };

  var Input = PO.Input = {
    held: function (b) { return held[b]; },
    pressed: function (b) { return pressed[b]; },
    /* true if this button was pressed within the last few frames, clearing it
       so one press can only ever trigger one action */
    consume: function (b) {
      if (buffered[b] > 0) { buffered[b] = 0; return true; }
      return false;
    },
    anyPressed: function () {
      for (var i = 0; i < 8; i++) if (pressed[i]) return true;
      return false;
    },
    newFrame: function () {
      for (var i = 0; i < 8; i++) { pressed[i] = false; if (buffered[i] > 0) buffered[i]--; }
    },
    set: function (b, down) {
      if (down && !held[b]) { pressed[b] = true; buffered[b] = 6; }
      held[b] = down;
    },
    reset: function () {
      for (var i = 0; i < 8; i++) { held[i] = pressed[i] = false; buffered[i] = 0; }
    }
  };

  window.addEventListener('keydown', function (e) {
    var b = KEYMAP[e.code];
    if (b === undefined) return;
    e.preventDefault();
    if (!e.repeat) Input.set(b, true);
  });
  window.addEventListener('keyup', function (e) {
    var b = KEYMAP[e.code];
    if (b === undefined) return;
    e.preventDefault();
    Input.set(b, false);
  });
  window.addEventListener('blur', function () { Input.reset(); });

  /* ---------- rng ---------- */
  var seed = 0x2545F491;
  PO.rand = function () {
    seed ^= seed << 13; seed |= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5; seed |= 0;
    return ((seed >>> 0) % 100000) / 100000;
  };
  PO.randInt = function (n) { return Math.floor(PO.rand() * n); };
  PO.pick = function (a) { return a[PO.randInt(a.length)]; };
})();

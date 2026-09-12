/** Films a knockdown: the drop, the count, the rise. */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const URL = process.argv[2] ?? 'http://127.0.0.1:5173/';
const OUT = process.argv[3] ?? 'shots/kd.png';
const WHO = process.argv[4] ?? 'opponent';
const N = 12, GAP = 420, COLS = 4;
mkdirSync('shots', { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 720, height: 405 } });
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', (e) => errors.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
await p.evaluate(() => window.GLASSJAW.startFight('paco'));
await p.waitForTimeout(1200);
await p.keyboard.press('Space');           // skip the intro
await p.waitForTimeout(2600);              // past the round card
await p.evaluate((who) => {
  // Drop them exactly the way a real finishing punch does: the fighter goes
  // down AND the event fires, because it is the event the referee, the crowd
  // and the camera all listen to.
  const s = window.GLASSJAW.current;
  const f = s[who];
  f.knockDown();
  s.bus.emit('knockdown', { fighter: f, count: f.knockdowns });
}, WHO);
const frames = [], log = [];
for (let i = 0; i < N; i++) {
  frames.push((await p.screenshot({ timeout: 60000 })).toString('base64'));
  log.push(await p.evaluate(() => {
    const s = window.GLASSJAW.current;
    return { phase: s.ref?.phase, count: s.ref?.count, rise: +(s.ref?.riseProgress ?? 0).toFixed(2) };
  }));
  // Beating the count needs mashing; give it some.
  for (let k = 0; k < 5; k++) { await p.keyboard.press('Space'); await p.waitForTimeout(GAP / 5); }
}
const rows = Math.ceil(frames.length / COLS);
const sheet = await p.evaluate(async ({ imgs, cols, rows }) => {
  const W = 720, H = 405, S = 0.72;
  const c = document.createElement('canvas');
  c.width = cols * W * S; c.height = rows * H * S;
  const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < imgs.length; i++) {
    const im = new Image();
    await new Promise((r) => { im.onload = r; im.src = 'data:image/png;base64,' + imgs[i]; });
    const px = (i % cols) * W * S, py = ((i / cols) | 0) * H * S;
    x.drawImage(im, px, py, W * S, H * S);
    x.strokeStyle = '#f0f'; x.lineWidth = 2; x.strokeRect(px, py, W * S, H * S);
    x.fillStyle = '#f0f'; x.font = 'bold 18px monospace'; x.fillText(String(i + 1), px + 8, py + 22);
  }
  return c.toDataURL('image/png').split(',')[1];
}, { imgs: frames, cols: COLS, rows });
writeFileSync(OUT, Buffer.from(sheet, 'base64'));
console.log(JSON.stringify({ log, errors: [...new Set(errors)] }));
await b.close();

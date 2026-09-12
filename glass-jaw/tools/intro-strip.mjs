/** Captures the opening sequence beat by beat, without skipping it. */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const URL = process.argv[2] ?? 'http://127.0.0.1:5173/';
const OUT = process.argv[3] ?? 'shots/intro.png';
const N = +(process.argv[4] ?? 12), GAP = +(process.argv[5] ?? 620), COLS = 4;
mkdirSync('shots', { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', (e) => errors.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
await p.keyboard.press('Enter'); await p.waitForTimeout(700);
await p.keyboard.press('KeyS'); await p.waitForTimeout(250);
await p.keyboard.press('Enter');
const frames = [], log = [];
for (let i = 0; i < N; i++) {
  await p.waitForTimeout(GAP);
  frames.push((await p.screenshot({ timeout: 60000 })).toString('base64'));
  log.push(await p.evaluate(() => {
    const s = window.GLASSJAW.current;
    return { scene: s?.name, phase: s?.ref?.phase, t: s?.ref?.timer?.toFixed(2) };
  }));
}
const rows = Math.ceil(frames.length / COLS);
const sheet = await p.evaluate(async ({ imgs, cols, rows }) => {
  const W = 960, H = 540, S = 0.5;
  const c = document.createElement('canvas');
  c.width = cols * W * S; c.height = rows * H * S;
  const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < imgs.length; i++) {
    const im = new Image();
    await new Promise((r) => { im.onload = r; im.src = 'data:image/png;base64,' + imgs[i]; });
    x.drawImage(im, (i % cols) * W * S, ((i / cols) | 0) * H * S, W * S, H * S);
    x.strokeStyle = '#0ff'; x.lineWidth = 2;
    x.strokeRect((i % cols) * W * S, ((i / cols) | 0) * H * S, W * S, H * S);
    x.fillStyle = '#0ff'; x.font = 'bold 20px monospace';
    x.fillText(String(i + 1), (i % cols) * W * S + 8, ((i / cols) | 0) * H * S + 24);
  }
  return c.toDataURL('image/png').split(',')[1];
}, { imgs: frames, cols: COLS, rows });
writeFileSync(OUT, Buffer.from(sheet, 'base64'));
console.log(JSON.stringify({ log, errors: [...new Set(errors)] }));
await b.close();

/**
 * Visual QA across the whole roster.
 *
 * Puts every boxer in the ring at fight scale and tiles the result, so a
 * change to the art system can be checked against all sixteen at once instead
 * of against whoever happens to be first in the list.
 *
 *   node tools/roster-sheet.mjs [url] [out.png] [cols]
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const URL = process.argv[2] ?? 'http://127.0.0.1:5173/';
const OUT = process.argv[3] ?? 'shots/roster.png';
const COLS = +(process.argv[4] ?? 4);
mkdirSync('shots', { recursive: true });

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
// Small viewport on purpose: software rendering makes a full-size capture
// of sixteen fights take minutes, and this sheet is for silhouettes,
// colour and proportion, not for reading the HUD.
const p = await b.newPage({ viewport: { width: 560, height: 315 } });
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', (e) => errors.push(String(e.message)));

await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
const ids = await p.evaluate(() => window.GLASSJAW.roster.map((x) => x.id));

const frames = [];
for (const id of ids) {
  await p.evaluate((i) => window.GLASSJAW.startFight(i), id);
  // Past the wipe and into the opponent's own entrance beat.
  await p.waitForTimeout(1500);
  // Land on the entrance, where the boxer is performing his own animation.
  frames.push({ id, png: (await p.screenshot({ timeout: 60000 })).toString('base64') });
  console.log(`captured ${id}`);
  // Tear the fight down directly rather than through the quit path, which
  // would spend another curtain on every boxer. pop() only QUEUES a pop --
  // current does not change until the next update -- so this counts pops
  // instead of looping on current, which never terminates.
  await p.evaluate(() => {
    const g = window.GLASSJAW;
    for (let i = 0; i < 6; i++) g.pop();
  });
  await p.waitForTimeout(320);
}

const rows = Math.ceil(frames.length / COLS);
const sheet = await p.evaluate(async ({ imgs, cols, rows }) => {
  const W = 560, H = 315, S = 1;
  const c = document.createElement('canvas');
  c.width = cols * W * S; c.height = rows * H * S;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < imgs.length; i++) {
    const im = new Image();
    await new Promise((r) => { im.onload = r; im.src = 'data:image/png;base64,' + imgs[i].png; });
    const px = (i % cols) * W * S, py = ((i / cols) | 0) * H * S;
    x.drawImage(im, px, py, W * S, H * S);
    x.strokeStyle = '#0f0'; x.lineWidth = 2; x.strokeRect(px, py, W * S, H * S);
    x.fillStyle = '#0f0'; x.font = 'bold 18px monospace';
    x.fillText(imgs[i].id, px + 8, py + 22);
  }
  return c.toDataURL('image/png').split(',')[1];
}, { imgs: frames, cols: COLS, rows });

writeFileSync(OUT, Buffer.from(sheet, 'base64'));
console.log(JSON.stringify({ out: OUT, boxers: frames.length, errors: [...new Set(errors)] }));
await b.close();

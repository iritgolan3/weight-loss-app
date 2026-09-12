/**
 * Captures a fight as a contact sheet.
 *
 * Single screenshots land on whatever frame they land on — a random hit flash,
 * a random telegraph — which is a terrible way to judge how a game reads in
 * motion. This drives real input into a real fight, grabs frames on a fixed
 * cadence, and tiles them so a whole exchange can be looked at at once.
 *
 *   node tools/filmstrip.mjs [url] [out.png] [frames] [msBetween] [cols]
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = process.argv[2] ?? 'http://127.0.0.1:5173/';
const OUT = process.argv[3] ?? 'shots/strip.png';
const N = +(process.argv[4] ?? 12);
const GAP = +(process.argv[5] ?? 260);
const COLS = +(process.argv[6] ?? 4);
mkdirSync('shots', { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e.message)));

const scene = () => page.evaluate(() => window.GLASSJAW?.current?.name ?? null);
const wait = (ms) => page.waitForTimeout(ms);

await page.goto(URL, { waitUntil: 'networkidle' });
await wait(800);
await page.keyboard.press('Enter'); await wait(400);
await page.keyboard.press('KeyS'); await wait(200);   // QUICK FIGHT
await page.keyboard.press('Enter'); await wait(900);
await page.keyboard.press('Space'); await wait(1200); // through the intro

/**
 * A bot that plays the way a person does: watches for the telegraph, defends,
 * and punishes the recovery. Random mashing tells you nothing about whether
 * the timing reads.
 */
async function act() {
  const s = await page.evaluate(() => {
    const sc = window.GLASSJAW.current;
    const o = sc.opponent, p = sc.player;
    if (!o || !p) return null;
    return {
      tell: o.tellGlow ?? 0, oState: o.state, pState: p.state,
      stamina: p.stamina?.fraction ?? 1, stars: p.special?.tokens ?? 0,
      oHealth: o.health?.fraction ?? 1, pHealth: p.health?.fraction ?? 1,
      phase: sc.ref?.phase,
    };
  }).catch(() => null);
  if (!s) return s;
  if (s.tell > 0.4) {
    await page.keyboard.press(Math.random() < 0.5 ? 'KeyQ' : 'KeyE');
  } else if (s.oState === 'Recover' || s.oState === 'Stunned') {
    await page.keyboard.press(Math.random() < 0.5 ? 'KeyA' : 'KeyD');
  } else if (s.stars >= 1 && Math.random() < 0.25) {
    await page.keyboard.press('ShiftLeft');
  } else if (Math.random() < 0.35) {
    await page.keyboard.press('Space');
  }
  return s;
}

const frames = [];
const log = [];
for (let i = 0; i < N; i++) {
  const deadline = Date.now() + GAP;
  while (Date.now() < deadline) { await act(); await wait(55); }
  if ((await scene()) !== 'fight') break;
  const buf = await page.screenshot({ timeout: 60000 }).catch(() => null);
  if (!buf) break;
  frames.push(buf.toString('base64'));
  const s = await act();
  log.push(s && { p: +s.pHealth.toFixed(2), o: +s.oHealth.toFixed(2), st: +s.stamina.toFixed(2), stars: s.stars, phase: s.phase });
}

// Tile client-side; there is no image library in this container.
const rows = Math.ceil(frames.length / COLS);
const sheet = await page.evaluate(async ({ imgs, cols, rows }) => {
  const W = 960, H = 540, S = 0.5;
  const c = document.createElement('canvas');
  c.width = cols * W * S; c.height = rows * H * S;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < imgs.length; i++) {
    const im = new Image();
    await new Promise((r) => { im.onload = r; im.src = 'data:image/png;base64,' + imgs[i]; });
    x.drawImage(im, (i % cols) * W * S, Math.floor(i / cols) * H * S, W * S, H * S);
    x.strokeStyle = '#ff0'; x.lineWidth = 2;
    x.strokeRect((i % cols) * W * S, Math.floor(i / cols) * H * S, W * S, H * S);
    x.fillStyle = '#ff0'; x.font = 'bold 20px monospace';
    x.fillText(String(i + 1), (i % cols) * W * S + 8, Math.floor(i / cols) * H * S + 24);
  }
  return c.toDataURL('image/png').split(',')[1];
}, { imgs: frames, cols: COLS, rows });

writeFileSync(OUT, Buffer.from(sheet, 'base64'));
console.log(JSON.stringify({ out: OUT, frames: frames.length, log, errors: [...new Set(errors)] }, null, 1));
await browser.close();

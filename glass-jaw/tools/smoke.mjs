// Smoke-tests the PRODUCTION build: boots, plays, and checks for errors.
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
p.setDefaultTimeout(90000);
const errs = [];
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
p.on('requestfailed', (r) => errs.push(`request failed: ${r.url()}`));

await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
const booted = await p.evaluate(() => !!window.GLASSJAW && window.GLASSJAW.current?.name);

await p.keyboard.press('Enter'); await p.waitForTimeout(500);
const pick = async (text) => {
  for (let i = 0; i < 26; i++) {
    const cur = await p.evaluate(() => {
      const s = window.GLASSJAW.current; const it = s?.items?.[s.index]; return it ? it.label : null;
    });
    if (cur && cur.toUpperCase().startsWith(text)) return true;
    await p.keyboard.press('KeyS'); await p.waitForTimeout(40);
  }
  return false;
};
const found = await pick('QUICK FIGHT');
await p.keyboard.press('Enter'); await p.waitForTimeout(1200);
await p.keyboard.press('Space'); await p.waitForTimeout(1400);
const moves = ['KeyA', 'KeyD', 'KeyQ', 'KeyE', 'Space', 'KeyW', 'KeyS', 'ShiftLeft'];
for (let i = 0; i < 150; i++) await p.keyboard.press(moves[i % moves.length]);
await p.waitForTimeout(800);

const state = await p.evaluate(() => {
  const g = window.GLASSJAW;
  return {
    scene: g.current?.name,
    fps: Math.round(g.loop.stats.fps),
    updateMs: +g.loop.stats.updateMs.toFixed(2),
    renderMs: +g.loop.stats.renderMs.toFixed(2),
    playerHP: +g.current.player?.health.fraction.toFixed(2),
    oppHP: +g.current.opponent?.health.fraction.toFixed(2),
    round: g.current.ref?.round,
  };
});
await p.screenshot({ path: 'shots/smoke-production.png' });
console.log(JSON.stringify({ booted, foundQuickFight: found, state, errors: errs }, null, 2));
await b.close();
process.exit(errs.length ? 1 : 0);

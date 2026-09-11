// Verifies the single-file build actually plays when opened from the filesystem.
import { chromium } from 'playwright';
import { resolve } from 'node:path';

const file = 'file://' + resolve('dist-standalone/glass-jaw.html');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
p.setDefaultTimeout(90000);
const errs = [];
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
p.on('requestfailed', (r) => errs.push(`request: ${r.url()}`));

await p.goto(file, { waitUntil: 'load' });
await p.waitForTimeout(1500);
const booted = await p.evaluate(() => window.GLASSJAW?.current?.name ?? null);

await p.keyboard.press('Enter'); await p.waitForTimeout(600);
const menu = await p.evaluate(() => window.GLASSJAW?.current?.name ?? null);

// Walk to a fight and play it.
for (let i = 0; i < 26; i++) {
  const cur = await p.evaluate(() => {
    const s = window.GLASSJAW.current; const it = s?.items?.[s.index]; return it ? it.label : null;
  });
  if (cur && cur.startsWith('QUICK FIGHT')) break;
  await p.keyboard.press('KeyS'); await p.waitForTimeout(45);
}
await p.keyboard.press('Enter'); await p.waitForTimeout(1200);
await p.keyboard.press('Space'); await p.waitForTimeout(1500);
const moves = ['KeyA', 'KeyD', 'KeyQ', 'KeyE', 'Space', 'KeyW', 'KeyS', 'ShiftLeft'];
for (let i = 0; i < 140; i++) await p.keyboard.press(moves[i % moves.length]);
await p.waitForTimeout(800);

const state = await p.evaluate(() => {
  const g = window.GLASSJAW;
  return {
    scene: g.current?.name, round: g.current.ref?.round,
    oppHP: +g.current.opponent?.health.fraction.toFixed(2),
    playerHP: +g.current.player?.health.fraction.toFixed(2),
    renderMs: +g.loop.stats.renderMs.toFixed(2),
    savePersistent: g.save.persistent,
  };
});
await p.screenshot({ path: 'shots/standalone.png' });
console.log(JSON.stringify({ file, booted, menu, state, errors: errs }, null, 2));
await b.close();
process.exit(errs.length || state.scene !== 'fight' ? 1 : 0);

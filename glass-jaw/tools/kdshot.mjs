// Forces a knockdown and screenshots the framing at several points.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
p.setDefaultTimeout(90000);
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
await p.keyboard.press('Enter'); await p.waitForTimeout(400);
for (let i = 0; i < 26; i++) {
  const cur = await p.evaluate(() => {
    const s = window.GLASSJAW.current; const it = s?.items?.[s.index]; return it ? it.label : null;
  });
  if (cur && cur.startsWith('QUICK FIGHT')) break;
  await p.keyboard.press('KeyS'); await p.waitForTimeout(45);
}
await p.keyboard.press('Enter'); await p.waitForTimeout(1100);
await p.keyboard.press('Space'); await p.waitForTimeout(1500);
// Force the opponent onto the canvas.
await p.evaluate(() => {
  const s = window.GLASSJAW.current;
  s.opponent.knockDown();
  s.ref.onKnockdown(s.opponent);
});
for (const [ms, name] of [[500, 'kd-early'], [1400, 'kd-settled'], [3200, 'kd-count']]) {
  await p.waitForTimeout(ms);
  await p.screenshot({ path: `shots/${name}.png`, timeout: 60000 });
}
console.log(JSON.stringify({
  state: await p.evaluate(() => ({
    scene: window.GLASSJAW.current.name,
    phase: window.GLASSJAW.current.ref.phase,
    count: window.GLASSJAW.current.ref.count,
  })), errs }, null, 2));
await b.close();

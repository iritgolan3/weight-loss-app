// Screenshots the running game, optionally driving it with a key script.
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const out = process.argv[3] ?? 'shots/shot.png';
const script = process.argv[4] ? JSON.parse(process.argv[4]) : [];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

for (const step of script) {
  if (typeof step === 'number') { await page.waitForTimeout(step); continue; }
  if (typeof step === 'string') { await page.keyboard.press(step); await page.waitForTimeout(140); continue; }
  if (step.hold) { await page.keyboard.down(step.hold); await page.waitForTimeout(step.ms ?? 200); await page.keyboard.up(step.hold); continue; }
  if (step.press) { await page.keyboard.press(step.press); await page.waitForTimeout(step.ms ?? 140); continue; }
  if (step.wait) { await page.waitForTimeout(step.wait); continue; }
}

await page.screenshot({ path: out });
const health = await page.evaluate(() => {
  const g = window.GLASSJAW;
  if (!g) return { ok: false };
  return { ok: true, scene: g.current?.name ?? null, fps: Math.round(g.loop.stats.fps),
           update: +g.loop.stats.updateMs.toFixed(2), render: +g.loop.stats.renderMs.toFixed(2) };
});
console.log(JSON.stringify({ health, errors }, null, 2));
await browser.close();

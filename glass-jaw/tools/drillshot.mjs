// Verifies the training drill HUD by starting a dodge drill and screenshotting.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
await p.keyboard.press('Enter'); await p.waitForTimeout(400);

const pick = async (text) => {
  for (let i = 0; i < 26; i++) {
    const cur = await p.evaluate(() => {
      const s = window.GLASSJAW.current; const it = s?.items?.[s.index]; return it ? it.label : null;
    });
    if (cur && cur.toUpperCase().startsWith(text)) return true;
    await p.keyboard.press('KeyS'); await p.waitForTimeout(45);
  }
  return false;
};

await pick('TRAINING');
await p.keyboard.press('Enter'); await p.waitForTimeout(700);
await pick('DODGE PRACTICE');
await p.keyboard.press('Enter'); await p.waitForTimeout(300);
await pick('START DRILL');
await p.keyboard.press('Enter'); await p.waitForTimeout(1200);
await p.keyboard.press('Space'); await p.waitForTimeout(1500);
const moves = ['KeyQ', 'KeyE', 'KeyA', 'KeyD', 'Space'];
for (let i = 0; i < 260; i++) { await p.keyboard.press(moves[i % moves.length]); }
await p.waitForTimeout(900);
const state = await p.evaluate(() => {
  const s = window.GLASSJAW.current;
  return { scene: s.name, drill: s.drillProgress, complete: s.drillComplete,
           invincible: s.player.health.fraction };
});
await p.screenshot({ path: 'shots/drill.png' });
console.log(JSON.stringify({ state, errs }, null, 2));
await b.close();

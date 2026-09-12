import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
for (const k of ['Enter','KeyS','Enter']) { await p.keyboard.press(k); await p.waitForTimeout(500); }
await p.keyboard.press('Space'); await p.waitForTimeout(1200);
const out = [];
for (let i = 0; i < 14; i++) {
  for (let j = 0; j < 6; j++) { await p.keyboard.press(['KeyA','Space','KeyQ','KeyD','KeyE'][j % 5]); await p.waitForTimeout(60); }
  out.push(await p.evaluate(() => {
    const s = window.GLASSJAW.current, r = window.GLASSJAW.renderer, c = s.camera;
    return { x:+c.x.toFixed(1), y:+c.y.toFixed(1), z:+c.zoom.toFixed(4), rot:+c.rotation.toFixed(4), dw:r.dw, dh:r.dh, q:r.qualityName };
  }));
}
console.log(JSON.stringify(out));
await b.close();

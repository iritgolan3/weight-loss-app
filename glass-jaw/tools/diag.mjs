import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(500);
await p.keyboard.press('Enter'); await p.waitForTimeout(300);
await p.keyboard.press('KeyS'); await p.waitForTimeout(200);
await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
const d = await p.evaluate(() => {
  const g = window.GLASSJAW;
  const s = g.current;
  const pa = s.playerAnim ?? s['playerAnim'];
  const oa = s.oppAnim ?? s['oppAnim'];
  const dump = (a) => a ? { head: a.pose.head, hip: a.pose.hip, gloveL: a.pose.gloveL, scale: a.pose.scale, offset: a.pose.offset } : null;
  return { dw: g.renderer.dw, dh: g.renderer.dh, scene: s.name,
           player: dump(pa), opp: dump(oa),
           keys: Object.keys(s) };
});
console.log(JSON.stringify(d, null, 2));
await b.close();

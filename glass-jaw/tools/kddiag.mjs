import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.setDefaultTimeout(90000);
await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
await p.keyboard.press('Enter'); await p.waitForTimeout(400);
for (let i = 0; i < 26; i++) {
  const cur = await p.evaluate(() => { const s = window.GLASSJAW.current; const it = s?.items?.[s.index]; return it ? it.label : null; });
  if (cur && cur.startsWith('QUICK FIGHT')) break;
  await p.keyboard.press('KeyS'); await p.waitForTimeout(45);
}
await p.keyboard.press('Enter'); await p.waitForTimeout(1100);
await p.keyboard.press('Space'); await p.waitForTimeout(1500);
const snap = () => p.evaluate(() => {
  const s = window.GLASSJAW.current;
  return { state: s.opponent.state, downPose: +s.opponent.downPose.toFixed(2),
           hp: +s.opponent.health.fraction.toFixed(2), phase: s.ref.phase,
           counting: s.opponent.counting, kd: s.opponent.knockdowns,
           poseRot: +s.oppAnim.pose.rot.toFixed(2),
           poseOffY: +s.oppAnim.pose.offset.y.toFixed(2) };
});
console.log('before:', JSON.stringify(await snap()));
await p.evaluate(() => {
  const s = window.GLASSJAW.current;
  s.opponent.knockDown();
  s.ref.onKnockdown(s.opponent);
});
await p.waitForTimeout(100); console.log('t+0.1s:', JSON.stringify(await snap()));
await p.waitForTimeout(900); console.log('t+1.0s:', JSON.stringify(await snap()));
await p.waitForTimeout(1500); console.log('t+2.5s:', JSON.stringify(await snap()));
await b.close();

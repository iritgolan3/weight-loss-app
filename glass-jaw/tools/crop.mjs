import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [src, out, sx, sy, sw, sh, zoom = 2] = process.argv.slice(2);
const b64 = readFileSync(src).toString('base64');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const W = Math.round(+sw * +zoom), H = Math.round(+sh * +zoom);
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<body style="margin:0"><canvas id=c width=${W} height=${H}></canvas><script>
const i=new Image();i.onload=()=>{const x=c.getContext('2d');x.imageSmoothingEnabled=false;
x.drawImage(i,${+sx},${+sy},${+sw},${+sh},0,0,${W},${H});document.title='ok';};
i.src='data:image/png;base64,${b64}';</script></body>`);
await page.waitForFunction(() => document.title === 'ok');
await page.screenshot({ path: out });
await browser.close();
console.log('wrote', out, W, H);

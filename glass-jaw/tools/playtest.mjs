/**
 * End-to-end playtest: drives every screen in a real browser, screenshots each,
 * and fails on any console error, page exception or unexpected scene.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.argv[2] ?? 'http://127.0.0.1:5173/';
const OUT = 'shots/playtest';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

const errors = [];
const failures = [];
/** Environment limitations (e.g. software-rendering slowness), not game bugs. */
const warnings = [];
let shots = 0;
let midFight = null;
let fightResolved = false;
const perf = {};

function report() {
  console.log(JSON.stringify({
    screenshots: shots, midFight, perf, fightResolved,
    failures, warnings, errors: [...new Set(errors)],
  }, null, 2));
}

/**
 * Capturing a large software-rendered canvas can exceed any timeout on a
 * machine without a GPU. That says nothing about the game, so it is recorded
 * as a warning — the scene assertions around it still have to hold.
 */
async function capture(p, path, label) {
  try {
    await p.screenshot({ path, timeout: 60000 });
    return true;
  } catch {
    warnings.push(`${label}: screenshot timed out (software rendering)`);
    return false;
  }
}

async function newPage(width = 1600, height = 900, dpr = 1) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
  // Software rendering at high resolutions is slow; give it room.
  page.setDefaultTimeout(120000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  return page;
}

const key = async (p, k, ms = 110) => { await p.keyboard.press(k); await p.waitForTimeout(ms); };
const wait = (p, ms) => p.waitForTimeout(ms);
const scene = (p) => p.evaluate(() => window.GLASSJAW?.current?.name ?? null);
const shot = (p, name) =>
  capture(p, `${OUT}/${String(++shots).padStart(2, '0')}-${name}.png`, name);

async function expectScene(p, expected, label) {
  const got = await scene(p);
  if (got !== expected) failures.push(`${label}: expected "${expected}", got "${got}"`);
  return got === expected;
}

/** Moves the menu cursor onto the row whose label starts with `text`. */
async function selectRow(p, text) {
  const label = () => p.evaluate(() => {
    const s = window.GLASSJAW.current;
    const it = s?.items?.[s.index];
    return it ? it.label : null;
  });
  for (let i = 0; i < 26; i++) {
    const cur = await label();
    if (cur && cur.toUpperCase().startsWith(text.toUpperCase())) return true;
    await key(p, 'KeyS', 45);
  }
  failures.push(`could not find menu row "${text}" (on ${await scene(p)})`);
  return false;
}

const stats = (p) => p.evaluate(() => {
  const g = window.GLASSJAW;
  return {
    fps: Math.round(g.loop.stats.fps),
    update: +g.loop.stats.updateMs.toFixed(2),
    render: +g.loop.stats.renderMs.toFixed(2),
  };
});

const moves = ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyQ', 'KeyE', 'Space', 'ShiftLeft'];

try {
  // -------------------------------------------------------------- 1. Boot ---
  const page = await newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await wait(page, 900);
  await expectScene(page, 'title', 'boot');
  await shot(page, 'title');

  await key(page, 'Enter', 500);
  await expectScene(page, 'mainmenu', 'title->menu');
  await shot(page, 'mainmenu');

  // ----------------------------------------------------- 2. Every screen ---
  const screens = [
    { row: 'START CAREER', scene: 'career', name: 'career' },
    { row: 'ARCADE', scene: 'arcade', name: 'arcade' },
    { row: 'TRAINING', scene: 'training', name: 'training' },
    { row: 'BOXER PROFILES', scene: 'roster', name: 'roster' },
    { row: 'STATISTICS', scene: 'stats', name: 'stats' },
    { row: 'SETTINGS', scene: 'settings', name: 'settings' },
    { row: 'CREDITS', scene: 'credits', name: 'credits' },
  ];

  for (const s of screens) {
    await selectRow(page, s.row);
    await key(page, 'Enter', 600);
    await expectScene(page, s.scene, `open ${s.name}`);
    await shot(page, s.name);

    if (s.name === 'settings') {
      for (let t = 0; t < 4; t++) await key(page, 'KeyD', 240);
      await shot(page, 'settings-controls');
      for (let i = 0; i < 3; i++) await key(page, 'KeyS', 60);
      await key(page, 'KeyD', 130);
      await key(page, 'KeyA', 130);
    }
    if (s.name === 'roster') {
      for (let i = 0; i < 10; i++) await key(page, 'KeyS', 55);
      await shot(page, 'roster-scrolled');
    }
    if (s.name === 'career') {
      await key(page, 'KeyD', 300);
      await shot(page, 'career-gym');
      await key(page, 'KeyA', 300);
    }
    if (s.name === 'credits') await wait(page, 1400);

    await key(page, 'Escape', 550);
    await expectScene(page, 'mainmenu', `close ${s.name}`);
  }

  // -------------------------------------------------------- 3. Full fight ---
  await selectRow(page, 'QUICK FIGHT');
  await key(page, 'Enter', 900);
  await expectScene(page, 'fight', 'start fight');
  await shot(page, 'fight-intro');

  await key(page, 'Space', 1400);
  await shot(page, 'fight-round');

  await key(page, 'Escape', 500);
  await expectScene(page, 'pause', 'pause menu');
  await shot(page, 'fight-paused');
  await key(page, 'Escape', 400);

  for (let i = 0; i < 180; i++) {
    await page.keyboard.press(moves[i % moves.length]);
    if (i % 40 === 0) await wait(page, 50);
  }
  await wait(page, 500);
  midFight = await stats(page);
  await shot(page, 'fight-action');

  // Run the clock down so round transitions and the decision path are
  // exercised without waiting out three real rounds.
  let guard = 0;
  let sawBetweenRounds = false;
  while ((await scene(page)) === 'fight' && guard++ < 40) {
    await page.evaluate(() => {
      const s = window.GLASSJAW.current;
      if (s.ref && s.ref.phase === 'Fighting') s.ref.clock = 0.4;
    });
    // Stop mashing the moment the fight is over, or the result screen gets
    // dismissed by the very keys that were being used to fight.
    for (let i = 0; i < 24; i++) {
      if (i % 8 === 0 && (await scene(page)) !== 'fight') break;
      await page.keyboard.press(moves[i % moves.length]);
    }
    await wait(page, 700);
    if ((await scene(page)) === 'fight') {
      const ph = await page.evaluate(() => window.GLASSJAW.current.ref?.phase);
      if (ph === 'BetweenRounds' && !sawBetweenRounds) {
        sawBetweenRounds = true;
        await shot(page, 'between-rounds');
        await wait(page, 3600);
      }
      if (ph === 'Count') {
        await shot(page, 'count');
        for (let i = 0; i < 60; i++) {
          if (i % 10 === 0 && (await scene(page)) !== 'fight') break;
          await page.keyboard.press('Space');
        }
      }
    }
  }
  fightResolved = (await scene(page)) === 'result';
  if (!fightResolved) failures.push(`fight never resolved (scene ${await scene(page)})`);
  else { await wait(page, 2000); await shot(page, 'fight-result'); }

  // --------------------------------------------------- 4. Save round-trip ---
  const before = await page.evaluate(() => {
    const g = window.GLASSJAW;
    g.save.data.stats.totalFights += 7;
    g.save.data.career.money += 1234;
    g.save.unlockBoxer('kip');
    g.save.markDirty();
    g.save.flush();
    return { fights: g.save.data.stats.totalFights, money: g.save.data.career.money };
  });
  await page.reload({ waitUntil: 'networkidle' });
  await wait(page, 900);
  const after = await page.evaluate(() => ({
    fights: window.GLASSJAW.save.data.stats.totalFights,
    money: window.GLASSJAW.save.data.career.money,
    kip: window.GLASSJAW.save.isUnlocked('kip'),
  }));
  if (after.fights !== before.fights || after.money !== before.money || !after.kip) {
    failures.push(`save lost across reload: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  }
  await page.close();

  // ----------------------------------------------------- 5. Resolutions -----
  const resolutions = [
    [1280, 720, 1, '720p'], [1920, 1080, 1, '1080p'], [1600, 900, 2, 'hidpi'],
    [900, 1200, 1, 'portrait'], [430, 800, 1, 'phone'],
  ];
  for (const [w, h, dpr, label] of resolutions) {
    let p2;
    try {
      p2 = await newPage(w, h, dpr);
      await p2.goto(URL, { waitUntil: 'networkidle' });
      await wait(p2, 700);
      await key(p2, 'Enter', 350);
      await selectRow(p2, 'QUICK FIGHT');
      await key(p2, 'Enter', 1100);
      await key(p2, 'Space', 900);
      if ((await scene(p2)) !== 'fight') failures.push(`${label}: fight did not start`);
      await capture(p2, `${OUT}/res-${label}.png`, label);
    } catch (e) {
      failures.push(`${label}: ${String(e).split('\n')[0]}`);
    } finally {
      await p2?.close().catch(() => undefined);
    }
  }

  // ----------------------------------------------- 6. Graphics quality ------
  let p3;
  try {
    p3 = await newPage();
    await p3.goto(URL, { waitUntil: 'networkidle' });
    await wait(p3, 700);
    await key(p3, 'Enter', 300);
    await selectRow(p3, 'QUICK FIGHT');
    await key(p3, 'Enter', 1100);
    await key(p3, 'Space', 800);
    for (const q of ['low', 'medium', 'high', 'ultra']) {
      await p3.evaluate((quality) => window.GLASSJAW.settings.set('quality', quality), q);
      await wait(p3, 1500);
      perf[q] = await stats(p3);
      await capture(p3, `${OUT}/quality-${q}.png`, `quality-${q}`);
    }
    // Accessibility extremes must not break rendering.
    await p3.evaluate(() => window.GLASSJAW.settings.patch({
      cameraShake: 0, screenEffects: 0, flashIntensity: 0, hitStop: 0, slowMotion: 0,
      attackIndicators: true, weaknessHints: true, largeText: true, colorMode: 'deutan',
    }));
    await wait(p3, 1200);
    for (let i = 0; i < 40; i++) await p3.keyboard.press(moves[i % moves.length]);
    await wait(p3, 500);
    await capture(p3, `${OUT}/accessibility.png`, 'accessibility');
    if ((await scene(p3)) !== 'fight') failures.push('accessibility settings broke the fight');
  } catch (e) {
    failures.push(`quality sweep: ${String(e).split('\n')[0]}`);
  } finally {
    await p3?.close().catch(() => undefined);
  }
} catch (e) {
  failures.push(`fatal: ${String(e).split('\n')[0]}`);
}

report();
await browser.close().catch(() => undefined);
process.exit(failures.length || errors.length ? 1 : 0);

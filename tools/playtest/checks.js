// Targeted checks in real Chrome with the file as on disk. Fails loudly if a rule breaks.
// usage: node checks.js <outDir>
const fs = require('fs'), path = require('path');
const { launch, phonePage, openReal, CAR_RECT_PATCH, PROTO } = require('./lib');
const FRAMES = [[390, 844], [844, 390], [320, 568], [820, 1180], [1440, 900], [600, 600], [1920, 600]];
const fails = [];
const assert = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };

(async () => {
  const out = process.argv[2] || 'checks'; fs.mkdirSync(out, { recursive: true });
  const report = {};
  // The safety rule in the brief: Three.js sits on line 335, game code starts at 338,
  // so any search stays past line 337. An edit that shifts these breaks the rule.
  const src = fs.readFileSync(PROTO, 'utf8').split('\n');
  const huge = src.map((l, i) => l.length > 5000 ? i + 1 : 0).filter(Boolean);
  assert(huge.join(',') === '13,335', `long lines are only 13 and 335 (found ${huge.join(',')})`);
  assert(src[337].trim() === '<script>', 'game script still starts at line 338');
  const browser = await launch();

  // Level 1 and 2 forgive a hit from any car.
  for (const lv of [1, 2]) {
    const page = await phonePage(browser, 390, 844, 1); await openReal(page);
    await page.evaluate(n => window.__gh.setLevel(n), lv);
    const before = await page.evaluate(() => window.__gh.dropCarAhead('bus'));
    await page.waitForFunction(m => window.__gh.mass !== m || window.__gh.state !== 'playing', before.playerMass, { timeout: 15000, polling: 50 });
    const r = { before, after: await page.evaluate(() => window.__gh.mass), state: await page.evaluate(() => window.__gh.state) };
    report['level' + lv + 'Bus'] = r;
    assert(r.state === 'playing', `level ${lv}: a bus does not wreck a new player (mass ${before.playerMass} to ${r.after})`);
    await page.close();
  }

  // From level 5, far behind pace halfway through, a bus ends the run. Before the first
  // gate it is only a bump. At level 20, heavy enough to smash, it still costs real mass.
  {
    const page = await phonePage(browser, 390, 844, 1); await openReal(page);
    await page.evaluate(() => window.__gh.setLevel(5));
    await page.evaluate(() => window.__gh.dropCarAhead('bus'));
    await page.waitForFunction(() => window.__gh.mass !== 100 || window.__gh.state !== 'playing', null, { timeout: 15000, polling: 20 });
    assert((await page.evaluate(() => window.__gh.state)) === 'playing', 'level 5: before the first gate a bus is only a bump');

    await page.evaluate(() => window.__gh.setLevel(5));
    await page.waitForFunction(() => window.__gh.levelProgress > 0.5 || window.__gh.state !== 'playing', null, { timeout: 40000, polling: 100 });
    await page.evaluate(() => { window.__gh.setMass(100); window.__gh.dropCarAhead('bus'); });
    await page.waitForFunction(() => window.__gh.state !== 'playing', null, { timeout: 6000, polling: 20 }).catch(() => {});
    assert((await page.evaluate(() => window.__gh.state)) === 'over', 'level 5: halfway through and far behind, a bus wrecks you');

    await page.evaluate(() => window.__gh.setLevel(20));
    await page.waitForFunction(() => window.__gh.levelProgress > 0.5 || window.__gh.state !== 'playing', null, { timeout: 40000, polling: 100 });
    const threat = await page.evaluate(() => window.__gh.maxThreat), m = await page.evaluate(t => { const v = window.__gh.setMass(Math.round(t * 1.5)); window.__gh.dropCarAhead('bus'); return v; }, threat);
    // the largest single drop in the next 1.5 s: other small hits may come first
    const biggest = await page.evaluate(() => new Promise(res => { let prev = window.__gh.mass, top = 0; const t0 = performance.now(); (function f() { const c = window.__gh.mass; top = Math.max(top, prev - c); prev = c; if (performance.now() - t0 > 1500) return res(top); requestAnimationFrame(f); })(); }));
    const need = await page.evaluate(() => window.__gh.need);
    report.level20Bus = { threat, m, biggest, need };
    assert(biggest > need * 0.005, `level 20: smashing a bus costs real mass (largest hit ${biggest}, need ${need})`);
    await page.close();
  }
  // Every frame from rule 2: start, then left lane with a big car. Pictures are for looking at.
  report.frames = [];
  for (const [w, h] of FRAMES) {
    // CAR_RECT_PATCH adds one read-only test getter in memory; the game file on disk is not edited.
    const page = await phonePage(browser, w, h, 1); await openReal(page, '', CAR_RECT_PATCH);
    await page.evaluate(() => window.__gh.setLevel(10));
    await page.waitForFunction(() => window.__gh.gateInfo.length > 0 && window.__gh.playerZ < -20, null, { timeout: 20000 });
    await page.screenshot({ path: path.join(out, `f${w}x${h}-a-start.png`) });
    await page.evaluate(() => window.__gh.setMass(14000));
    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(() => window.__gh.playerX < -2.5, null, { timeout: 5000 }).catch(() => {});
    await page.keyboard.up('ArrowLeft');
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(out, `f${w}x${h}-b-left-big.png`) });
    const off = await page.evaluate(() => { const bad = []; for (const id of ['btnGas', 'btnBrake', 'btnPause', 'massVal', 'goalVal', 'levelVal', 'coinVal']) { const e = document.getElementById(id); if (!e) { bad.push(id + ':missing'); continue; } const r = e.getBoundingClientRect(); if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) bad.push(id); } return bad; });
    // The car must stay clear of the buttons once the camera has settled. "On screen" alone missed the
    // pause button sitting on the car in short, wide frames. Checked in the left lane at 14000 mass, then
    // in the centre lane at twice the need (the biggest car a player really gets), each after 2 s.
    const clash = {};
    const touching = () => page.evaluate(() => {
      const c = window.__gh.carRect(), hit = [];
      for (const id of ['btnPause', 'btnGas', 'btnBrake']) {
        const b = document.getElementById(id).getBoundingClientRect();
        if (Math.min(c.r, b.right) > Math.max(c.l, b.left) && Math.min(c.b, b.bottom) > Math.max(c.t, b.top)) hit.push(id);
      }
      return hit;
    });
    await new Promise(r => setTimeout(r, 2000)); clash.left = await touching();
    await page.evaluate(() => window.__gh.setMass(Math.round(window.__gh.need * 2)));
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => window.__gh.playerX > -0.5, null, { timeout: 5000 }).catch(() => {});
    await page.keyboard.up('ArrowRight');
    await new Promise(r => setTimeout(r, 2000)); clash.centre = await touching();
    report.frames.push({ w, h, offscreen: off, carTouchesButtons: clash, errors: page.errors, net: page.net });
    assert(off.length === 0, `${w}x${h}: nothing off screen`);
    assert(clash.left.length === 0 && clash.centre.length === 0, `${w}x${h}: car clear of the buttons (left: ${clash.left.join(',') || 'none'}, centre: ${clash.centre.join(',') || 'none'})`);
    assert(page.errors.length === 0, `${w}x${h}: no page errors`);
    assert(page.net.length === 0, `${w}x${h}: no outside requests`);
    await page.close();
  }

  fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(report, null, 1));
  await browser.close();
  console.log(fails.length ? `${fails.length} FAILED` : 'all passed');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

// Targeted checks in real Chrome with the file as on disk. Fails loudly if a rule breaks.
// usage: node checks.js <outDir>
const fs = require('fs'), path = require('path');
const { launch, phonePage, openReal } = require('./lib');
const FRAMES = [[390, 844], [844, 390], [320, 568], [820, 1180], [1440, 900], [600, 600], [1920, 600]];
const fails = [];
const assert = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };

(async () => {
  const out = process.argv[2] || 'checks'; fs.mkdirSync(out, { recursive: true });
  const report = {};
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

  // From level 5 a crash can still end the run; level 20 traffic still costs something.
  {
    const page = await phonePage(browser, 390, 844, 1); await openReal(page);
    await page.evaluate(() => window.__gh.setLevel(5));
    await page.evaluate(() => window.__gh.dropCarAhead('bus'));
    await page.waitForFunction(() => window.__gh.state !== 'playing', null, { timeout: 15000, polling: 50 }).catch(() => {});
    const st = await page.evaluate(() => window.__gh.state);
    assert(st === 'over', 'level 5: a bus can wreck a player at mass 100');
    await page.evaluate(() => window.__gh.setLevel(20));
    const threat = await page.evaluate(() => window.__gh.maxThreat), m = await page.evaluate(t => window.__gh.setMass(Math.round(t * 1.5)), threat);
    await page.evaluate(() => window.__gh.dropCarAhead('bus'));
    await page.waitForFunction(x => window.__gh.mass < x || window.__gh.state !== 'playing', m, { timeout: 15000, polling: 20 }).catch(() => {});
    const after = await page.evaluate(() => window.__gh.mass), need = await page.evaluate(() => window.__gh.need);
    report.level20Bus = { threat, m, after, need };
    assert(m - after > need * 0.005, `level 20: smashing a bus costs real mass (${m} to ${after}, need ${need})`);
    await page.close();
  }

  // Every frame from rule 2: start, then left lane with a big car. Pictures are for looking at.
  report.frames = [];
  for (const [w, h] of FRAMES) {
    const page = await phonePage(browser, w, h, 1); await openReal(page);
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
    report.frames.push({ w, h, offscreen: off, errors: page.errors, net: page.net });
    assert(off.length === 0, `${w}x${h}: nothing off screen`);
    assert(page.errors.length === 0, `${w}x${h}: no page errors`);
    assert(page.net.length === 0, `${w}x${h}: no outside requests`);
    await page.close();
  }

  fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(report, null, 1));
  await browser.close();
  console.log(fails.length ? `${fails.length} FAILED` : 'all passed');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

// Claude Code evidence script (Letter 017 step 3): the new look every 5 levels, and the "new road" teaser.
// 1. Theme by level: 1-5 DESERT, 6-10 MEADOW, 11-15 SNOW, 16-20 SUNSET, 21 DESERT again (20-level cycle).
// 2. Pictures of every theme at all 7 frames, in play, 2.5 s after the level starts (for Tony to judge the look).
// 3. Same layout, other colours: draw calls at level 11 (SNOW) and 21 (DESERT, same layout), averaged over 3 s
//    (colours only: the count must not grow with the theme). Renderer read through an in-memory hook.
// 4. Teaser on the win screen (through the game's own levelClear, exposed in memory only): after level 3 nothing,
//    after 4 "NEW ROAD IN 2 LEVELS: MEADOW", after 5 "NEW ROAD NEXT LEVEL: MEADOW", after 20 "... NEXT LEVEL: DESERT".
// usage: node tools/playtest/cc-look-proof.js <picture-folder>
const fs = require('fs'), path = require('path');
const { launch, phonePage, openReal } = require('./lib');
const FRAMES = [[390, 844], [844, 390], [320, 568], [820, 1180], [1440, 900], [600, 600], [1920, 600]];
const EXPOSE = [['  window.GH = { pause: pauseGame,', '  window.__lc = levelClear; window.__calls = function(){ return renderer.info.render.calls; }; window.GH = { pause: pauseGame,']];
const out = process.argv[2] || 'look-proof'; fs.mkdirSync(out, { recursive: true });
const fails = []; const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const THEME_LEVELS = [[1, 'DESERT'], [6, 'MEADOW'], [11, 'SNOW'], [16, 'SUNSET']];

(async () => {
  const b = await launch({ headless: true });
  // 1 + 2. theme names and pictures
  for (const [w, h] of FRAMES) {
    const p = await phonePage(b, w, h, 1); await openReal(p, '', EXPOSE);
    for (const [lv, name] of THEME_LEVELS) {
      await p.evaluate(n => window.__gh.setLevel(n), lv); await sleep(2500);
      const t = await p.evaluate(() => window.__gh.theme);
      if (w === 390) check(t === name, `level ${lv}: theme ${t}`);
      await p.screenshot({ path: path.join(out, `theme-${name.toLowerCase()}-${w}x${h}.png`) });
    }
    check(p.errors.length === 0, `${w}x${h}: no page errors across the four themes`);
    await p.close();
  }
  const p = await phonePage(b, 390, 844, 1); await openReal(p, '', EXPOSE);
  for (const [lv, name] of [[5, 'DESERT'], [10, 'MEADOW'], [21, 'DESERT'], [26, 'MEADOW'], [36, 'SUNSET'], [41, 'DESERT']]) {
    await p.evaluate(n => window.__gh.setLevel(n), lv); await sleep(200);
    const t = await p.evaluate(() => window.__gh.theme);
    check(t === name, `level ${lv}: theme ${t}`);
  }
  // 3. draw calls, same layout, different colours
  const calls = async lv => { await p.evaluate(n => window.__gh.setLevel(n), lv); await sleep(1500);
    return p.evaluate(() => new Promise(res => { let s = 0, n = 0; const t0 = performance.now(); (function f() { s += window.__calls(); n++; if (performance.now() - t0 > 3000) return res(Math.round(s / n)); requestAnimationFrame(f); })(); })); };
  const c11 = await calls(11), c21 = await calls(21), c16 = await calls(16), c26 = await calls(26);
  console.log(`draw calls (3 s averages, random traffic): L11 SNOW ${c11}, L21 DESERT ${c21}, L16 SUNSET ${c16}, L26 MEADOW ${c26}`);
  check(Math.abs(c11 - c21) / c21 < 0.15 && Math.abs(c16 - c26) / c26 < 0.15, 'same layout, other theme: draw calls within traffic noise (15 percent)');
  // 4. teaser
  for (const [lv, want] of [[3, ''], [4, 'NEW ROAD IN 2 LEVELS: MEADOW'], [5, 'NEW ROAD NEXT LEVEL: MEADOW'], [19, 'NEW ROAD IN 2 LEVELS: DESERT'], [20, 'NEW ROAD NEXT LEVEL: DESERT']]) {
    await p.evaluate(n => window.__gh.setLevel(n), lv); await sleep(600);
    // setLevel hides the result screen but keeps its old contents: clear them, or the last screen is read again
    await p.evaluate(() => { document.getElementById('overlay').innerHTML = ''; window.__lc(); });
    await p.waitForFunction(() => !!document.getElementById('nextBtn'), null, { timeout: 20000 });
    const t = await p.evaluate(() => { const e = document.getElementById('teaser'); return e ? e.textContent : ''; });
    check(t === want, `win screen after level ${lv}: "${t}"`);
    if (lv === 5) await p.screenshot({ path: path.join(out, 'teaser-390x844.png') });
  }
  check(p.errors.length === 0, 'no page errors' + (p.errors.length ? ': ' + p.errors.join(' | ') : ''));
  await b.close();
  console.log(fails.length ? `${fails.length} FAILED` : 'all passed');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

// Claude Code evidence script. Why does the checks.js level-20 check ("smashing a bus costs real mass") fail now and then?
// It replays that part of checks.js N times and records the game state when the measurement is taken.
// Finding (2026-11-09, 12 runs): both failures had state "over" before halfway. The unsteered mass-100 car had crashed
// in level 20 traffic, so a bus dropped on a finished game cannot hit anything. The check never asserts it is still playing.
// usage: node tools/playtest/cc-level20-diag.js [runs] [out.json]
const fs = require('fs');
const { launch, phonePage, openReal } = require('./lib');
(async () => {
  const N = Number(process.argv[2] || 12), b = await launch({ headless: true }), rows = [];
  for (let i = 0; i < N; i++) {
    const page = await phonePage(b, 390, 844, 1); await openReal(page);
    await page.evaluate(() => window.__gh.setLevel(20));
    await page.waitForFunction(() => window.__gh.levelProgress > 0.5 || window.__gh.state !== 'playing', null, { timeout: 40000, polling: 100 });
    const at = await page.evaluate(() => ({ state: window.__gh.state, progress: +window.__gh.levelProgress.toFixed(2), threat: Math.round(window.__gh.maxThreat), need: window.__gh.need }));
    const biggest = await page.evaluate(t => new Promise(res => {
      window.__gh.setMass(Math.round(t * 1.5)); window.__gh.dropCarAhead('bus');
      let prev = window.__gh.mass, top = 0; const t0 = performance.now();
      (function f() { const c = window.__gh.mass; top = Math.max(top, prev - c); prev = c; if (performance.now() - t0 > 1500) return res(top); requestAnimationFrame(f); })();
    }), at.threat);
    rows.push({ run: i + 1, ...at, biggest, verdict: biggest > at.need * 0.005 ? 'pass' : 'FAIL' });
    console.log(JSON.stringify(rows[rows.length - 1]));
    await page.close();
  }
  const f = rows.filter(r => r.verdict === 'FAIL');
  console.log('failing runs:', f.length, 'of', rows.length, '| of those, game not playing at the measurement:', f.filter(r => r.state !== 'playing').length);
  console.log('passing runs where the game was not playing:', rows.filter(r => r.verdict === 'pass' && r.state !== 'playing').length);
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(rows));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

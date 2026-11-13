// Claude Code evidence script (Letter 011 items 1 and 2, Letter 012). Replays the level-5 and level-20 bus checks of
// checks.js N times, with the NEW steps (car kept alive to halfway, then a guard), and the OLD level-5 steps for comparison.
// usage: node tools/playtest/cc-guard-proof.js [runs=12] [out.json]
const fs = require('fs');
const { launch, phonePage, openReal } = require('./lib');
const halfway = page => page.waitForFunction(() => window.__gh.levelProgress > 0.5 || window.__gh.state !== 'playing', null, { timeout: 40000, polling: 100 });
const state = page => page.evaluate(() => window.__gh.state);

async function level5(page, keepAlive) {
  await page.evaluate(k => { window.__gh.setLevel(5); if (k) window.__gh.setMass(window.__gh.need * 2); }, keepAlive);
  await halfway(page);
  const atHalf = await state(page), progress = await page.evaluate(() => +window.__gh.levelProgress.toFixed(2));
  await page.evaluate(() => { window.__gh.setMass(100); window.__gh.dropCarAhead('bus'); });
  await page.waitForFunction(() => window.__gh.state !== 'playing', null, { timeout: 6000, polling: 20 }).catch(() => {});
  const end = await state(page);
  // old check: passes when end === 'over'; it tested the bus only if the car was still playing at halfway
  return { atHalf, progress, end, guard: atHalf === 'playing', pass: end === 'over', vacuous: atHalf !== 'playing' && end === 'over' };
}
async function level20(page) {
  await page.evaluate(() => { window.__gh.setLevel(20); window.__gh.setMass(window.__gh.need * 2); });
  await halfway(page);
  const atHalf = await state(page);
  const threat = await page.evaluate(() => window.__gh.maxThreat);
  await page.evaluate(t => { window.__gh.setMass(Math.round(t * 1.5)); window.__gh.dropCarAhead('bus'); }, threat);
  const biggest = await page.evaluate(() => new Promise(res => { let prev = window.__gh.mass, top = 0; const t0 = performance.now(); (function f() { const c = window.__gh.mass; top = Math.max(top, prev - c); prev = c; if (performance.now() - t0 > 1500) return res(top); requestAnimationFrame(f); })(); }));
  const need = await page.evaluate(() => window.__gh.need);
  return { atHalf, guard: atHalf === 'playing', biggest, need, pass: atHalf === 'playing' && biggest > need * 0.005 };
}

(async () => {
  const N = Number(process.argv[2] || 12), b = await launch({ headless: true }), rows = [];
  for (let i = 0; i < N; i++) {
    const page = await phonePage(b, 390, 844, 1); await openReal(page);
    const r = { run: i + 1, l5new: await level5(page, true), l20new: await level20(page), l5old: await level5(page, false) };
    rows.push(r);
    console.log(JSON.stringify(r));
    await page.close();
  }
  const n = f => rows.filter(f).length;
  console.log(`NEW level 5:  guard ok ${n(r => r.l5new.guard)}/${N}, check passes ${n(r => r.l5new.guard && r.l5new.pass)}/${N}`);
  console.log(`NEW level 20: guard ok ${n(r => r.l20new.guard)}/${N}, check passes ${n(r => r.l20new.pass)}/${N}`);
  console.log(`OLD level 5:  passed ${n(r => r.l5old.pass)}/${N}, of which without testing the bus (car already crashed at halfway) ${n(r => r.l5old.vacuous)}`);
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(rows));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

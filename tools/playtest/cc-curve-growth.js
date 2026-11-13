// Claude Code curve round 4, the capped round agreed in Letter 011 item 5 and Letter 012.
// Levels 1-2 unchanged, level 3 = 1460 (round 3), levels 4-15 = round 2. Levels 16-20 follow ONE growth curve:
//   need(L) = 13800 * g^(L-15), rounded to 10.
// g is found by halving an interval on the average bot's mean win rate over levels 16-20 (target: the mean of their targets),
// 400 runs per level, the same seeds for every guess so guesses compare fairly. The last step is damped: g = middle of the
// final interval. Then a check run on NEW seeds, both bots, 400 runs, levels 16-20.
// usage: node tools/playtest/cc-curve-growth.js <out-prefix> [lo=1.15] [hi=1.40] [halvings=3]
const fs = require('fs'), path = require('path');
const { launch, phonePage, openFast, PROTO } = require('./lib');
const ROOT = path.resolve(__dirname, '..', '..');
const BASE = JSON.parse(fs.readFileSync(path.join(ROOT, 'sim/results/cc-curve-baseline-200runs.json'), 'utf8'));
const FIXED = [580, 660, 1460, 1810, 2190, 2560, 3020, 3690, 4600, 5580, 6530, 7430, 9870, 11600, 13800];
const needsFor = g => FIXED.concat([1, 2, 3, 4, 5].map(k => Math.round(13800 * Math.pow(g, k) / 10) * 10));
// the target line, exactly as in the earlier rounds (cc-curve-NOTES.md)
const bAvg = BASE.filter(r => r.profile === 'average').sort((a, b) => a.level - b.level);
const v2 = bAvg[1].win, late = bAvg.filter(r => r.level >= 3), mean = late.reduce((s, r) => s + r.win, 0) / late.length, slope = (mean - v2) / 9.5;
const target = L => Math.min(1, v2 + slope * (L - 2));
const TOP = [16, 17, 18, 19, 20], topTarget = TOP.reduce((s, L) => s + target(L), 0) / TOP.length;

function runLevel({ level, profile, runs, seedOff }) {
  const DT = 1 / 60, g = window.__gh, ff = window.__ff, bot = window.__botMake(profile);
  ff.reseed(seedOff + level * 1000 + profile.length * 7 + profile.charCodeAt(0));
  let wins = 0, crashes = 0, massSum = 0;
  for (let r = 0; r < runs; r++) {
    bot.reset(); g.setLevel(level); const bz = g.barricadeZ; let s = 0, m = g.mass, z = 0;
    while (g.state === 'playing' && s++ < 7200) { ff.step(DT); bot.tick(DT); m = g.mass; z = g.playerZ; }
    const near = bz !== null && Math.abs(z - bz) < 12;
    if (near && m >= g.need) wins++; if (!near) crashes++; massSum += m;
    for (let i = 0; i < 3; i++) ff.step(DT);
  }
  return { level, profile, runs, win: wins / runs, crash: crashes / runs, avgMass: Math.round(massSum / runs), need: g.need };
}
const NEEDS_RE = /const LEVEL_NEEDS\s*=\s*\[[\s\S]*?\]/;
async function measure(browser, needs, profiles, runs, seedOff, page0) {
  const src = fs.readFileSync(PROTO, 'utf8'), page = page0 || await phonePage(browser, 390, 844, 1);
  await openFast(page, 4000 + seedOff % 997, [[src.match(NEEDS_RE)[0], `const LEVEL_NEEDS  = [${needs.join(',')}]`]]);
  const rows = [];
  for (const profile of profiles) for (const level of TOP) rows.push(await page.evaluate(runLevel, { level, profile, runs, seedOff }));
  if (!page0) await page.close();
  return rows;
}

(async () => {
  const [, , prefix, loS, hiS, nS] = process.argv;
  let lo = Number(loS || 1.15), hi = Number(hiS || 1.40); const halvings = Number(nS || 3), log = [];
  const say = s => { console.log(s); log.push(s); };
  say(`target win % levels 16-20: ${TOP.map(L => (target(L) * 100).toFixed(1)).join(' ')} | mean ${(topTarget * 100).toFixed(1)}`);
  const browser = await launch({ headless: true });
  for (let h = 0; h < halvings; h++) {
    const g = (lo + hi) / 2, needs = needsFor(g);
    const rows = await measure(browser, needs, ['average'], 400, 0);
    const m = rows.reduce((s, r) => s + r.win, 0) / rows.length;
    say(`guess ${h + 1}: g=${g.toFixed(4)} needs 16-20 ${needs.slice(15).join(',')} | average win ${rows.map(r => (r.win * 100).toFixed(1)).join(' ')} | mean ${(m * 100).toFixed(1)} vs ${(topTarget * 100).toFixed(1)}`);
    if (m > topTarget) lo = g; else hi = g;   // too easy -> walls must grow faster
    fs.writeFileSync(prefix + '-search.json', JSON.stringify({ log, lo, hi }));
  }
  const gFinal = (lo + hi) / 2, needs = needsFor(gFinal);
  say(`final g (middle of [${lo.toFixed(4)}, ${hi.toFixed(4)}]) = ${gFinal.toFixed(4)} -> LEVEL_NEEDS ${JSON.stringify(needs)}`);
  const check = await measure(browser, needs, ['average', 'casual'], 400, 2468135);
  for (const r of check) say(`check ${r.profile.padEnd(7)} L${r.level} need ${r.need} win ${(r.win * 100).toFixed(1)} crash ${(r.crash * 100).toFixed(1)} avgMass ${r.avgMass}`);
  fs.writeFileSync(prefix + '-result.json', JSON.stringify({ log, g: gFinal, needs, check, targets: TOP.map(target) }, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

// Claude Code curve round 4, the capped round agreed in Letter 011 item 5 and Letter 012.
// Levels 1-2 unchanged, level 3 = 1460 (round 3), levels 4-15 = round 2. Levels 16-20 follow ONE growth curve:
//   need(L) = 13800 * g^(L-15), rounded to 10.
// g is found by halving an interval on the average bot's mean win rate over levels 16-20 (target: the mean of their targets),
// 400 runs per level, the same seeds for every guess so guesses compare fairly. The last step is damped: g = middle of the
// final interval. Then a check run on NEW seeds, both bots, 400 runs, levels 16-20.
// usage: node tools/playtest/cc-curve-growth.js <out-prefix> [lo=1.15] [hi=1.40] [halvings=3] [expected-needs-csv]
// Check only (no new guesses): halvings 0 and the interval the search ended with, e.g.
//   node tools/playtest/cc-curve-growth.js out 1.24375 1.275 0 580,660,...,43720
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
// A fresh page per batch keeps memory flat, as fast.js does. On 2026-11-13 the check run played 4,000 games in one page
// and produced nothing for 1 h 46 min. Each batch is printed and appended to `jsonl` as it finishes, so a stop keeps it.
async function measure(browser, needs, profiles, runs, seedOff, jsonl) {
  const src = fs.readFileSync(PROTO, 'utf8'), patch = [[src.match(NEEDS_RE)[0], `const LEVEL_NEEDS  = [${needs.join(',')}]`]], rows = [];
  for (const profile of profiles) for (const level of TOP) {
    const page = await phonePage(browser, 390, 844, 1); await openFast(page, 4000 + seedOff % 997, patch);
    const t = Date.now(), r = await page.evaluate(runLevel, { level, profile, runs, seedOff }); await page.close();
    r.secs = Math.round((Date.now() - t) / 1000); rows.push(r);
    console.log(`  [${new Date().toTimeString().slice(0, 8)}] ${profile} L${level}: need ${r.need} win ${(r.win * 100).toFixed(1)} crash ${(r.crash * 100).toFixed(1)} (${r.secs} s)`);
    if (jsonl) fs.appendFileSync(jsonl, JSON.stringify(r) + '\n');
  }
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
  // check-only run (0 halvings): optional 6th argument = the needs the search logged; refuse to run if they differ
  const expect = process.argv[6];
  if (expect && needs.join(',') !== expect) throw new Error('needs differ from the logged search result: ' + needs.join(',') + ' vs ' + expect);
  if (expect) say('needs match the logged search result');
  const check = await measure(browser, needs, ['average', 'casual'], 400, 2468135, prefix + '-check.jsonl');
  for (const r of check) say(`check ${r.profile.padEnd(7)} L${r.level} need ${r.need} win ${(r.win * 100).toFixed(1)} crash ${(r.crash * 100).toFixed(1)} avgMass ${r.avgMass}`);
  fs.writeFileSync(prefix + '-result.json', JSON.stringify({ log, g: gFinal, needs, check, targets: TOP.map(target) }, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

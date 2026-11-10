// Claude Code curve tuner (Letter 010, change 3). Based on sim/tune-needs.js, with three differences:
//  1. The target is not a guess. It is a straight line for the average bot's win rate, starting at level 2's MEASURED
//     win rate and falling so that the mean over levels 3-20 equals the mean measured today. So the game is not made
//     harder or easier overall; it only stops rising and falling. (Supersonic publishes no number for this: only "start
//     super easy, then steadily increase" and "incremental".)
//  2. Levels 1 and 2 are locked: they are not tuned and their needs are kept.
//  3. The baseline comes from a fast.js run (average profile), so target and measurement use the same engine.
// usage: node tools/playtest/cc-tune-curve.js <baseline.json> <out.json> [runs=150] [iterations=3] [--apply]
// --apply writes LEVEL_NEEDS into the game file named by GH_PROTO (or the repo game). Point GH_PROTO at a scratch copy.
// Needs playwright-core on NODE_PATH and Chrome (CHROME_PATH).
const fs = require('fs'), path = require('path');
const { launch, phonePage, openFast, PROTO } = require('./lib');

const base = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).filter(r => r.profile === 'average').sort((a, b) => a.level - b.level);
// LOCK_LEVELS: levels that are kept as they are (default 1,2). TARGET_OVERRIDE: JSON like {"3":0.94}, a declared
// change of one level's target (for example to bring a level's mass/need under its neighbour's).
const LOCKED = (process.env.LOCK_LEVELS || '1,2').split(',').map(Number);
const OVERRIDE = JSON.parse(process.env.TARGET_OVERRIDE || '{}');
const win = lv => base.find(r => r.level === lv).win;
const late = base.filter(r => r.level >= 3), v2 = win(2);
const meanLate = late.reduce((s, r) => s + r.win, 0) / late.length;
const slope = (meanLate - v2) / (late.reduce((s, r) => s + r.level, 0) / late.length - 2);   // mean of levels 3..20 is 11.5
const target = lv => LOCKED.includes(lv) ? win(lv) : OVERRIDE[lv] !== undefined ? OVERRIDE[lv] : Math.min(1, v2 + slope * (lv - 2));

function playLevel({ level, runs }) {
  const g = window.__gh, ff = window.__ff, DT = 1 / 60, bot = window.__botMake('average');
  ff.reseed(level * 971 + 3);
  const masses = []; let crashes = 0;
  for (let r = 0; r < runs; r++) {
    bot.reset(); g.setLevel(level); const bz = g.barricadeZ; let z = 0, m = 0, s = 0;
    while (g.state === 'playing' && s++ < 7200) { ff.step(DT); bot.tick(DT); z = g.playerZ; m = g.mass; }
    if (Math.abs(z - bz) < 12) masses.push(m); else crashes++;
    for (let i = 0; i < 3; i++) ff.step(DT);
  }
  return { masses, crashes };
}
const NEEDS_RE = /const LEVEL_NEEDS\s*=\s*\[[\s\S]*?\]/;
const readNeeds = src => src.match(/const LEVEL_NEEDS\s*=\s*\[([\s\S]*?)\]/)[1].split(',').map(Number);
const writeNeeds = (src, n) => src.replace(NEEDS_RE, `const LEVEL_NEEDS  = [${n.slice(0, 10).join(',')},\n                        ${n.slice(10).join(',')}]`);

(async () => {
  const [, , , out, runsS, itersS] = process.argv;
  const runs = Number(runsS || 150), iters = Number(itersS || 3), apply = process.argv.includes('--apply');
  let needs = readNeeds(fs.readFileSync(PROTO, 'utf8')); const original = needs.slice(), history = [];
  console.log('target win % by level:', Array.from({ length: 20 }, (_, i) => Math.round(target(i + 1) * 100)).join(' '));
  const browser = await launch({ headless: true });
  for (let it = 0; it < iters; it++) {
    const page = await phonePage(browser, 390, 844, 1); page.setDefaultTimeout(900000);
    await openFast(page, 700 + it, [[fs.readFileSync(PROTO, 'utf8').match(NEEDS_RE)[0], `const LEVEL_NEEDS  = [${needs.join(',')}]`]]);
    const next = [], rows = [];
    for (let lv = 1; lv <= 20; lv++) {
      if (LOCKED.includes(lv)) { next.push(original[lv - 1]); continue; }
      await page.reload(); await page.addScriptTag({ path: path.join(__dirname, 'bot.js') });
      await page.waitForFunction(() => !!window.__gh && !!window.__ff);
      const r = await page.evaluate(playLevel, { level: lv, runs });
      const survive = r.masses.length / runs, want = target(lv), sorted = r.masses.slice().sort((a, b) => a - b);
      // need = the mass that a share (want / survive) of the runs that reach the wall can clear
      let need = survive <= want ? Math.max(sorted[0] || 100, 100) : sorted[Math.floor(sorted.length * (1 - want / survive))];
      need = Math.round(need / 10) * 10;
      rows.push({ lv, reachWall: +survive.toFixed(3), targetWin: +want.toFixed(3), need });
      next.push(need);
    }
    for (let i = 1; i < next.length; i++) if (!LOCKED.includes(i + 1)) next[i] = Math.max(next[i], Math.round(next[i - 1] * 1.04 / 10) * 10);   // the wall never falls
    needs = it === iters - 1 ? next : needs.map((n, i) => LOCKED.includes(i + 1) ? n : Math.round((n + next[i]) / 20) * 10);   // move half way, costs follow the need
    history.push({ iteration: it, needs: needs.slice(), rows });
    console.log(`iteration ${it}: ${JSON.stringify(needs)}`);
    fs.writeFileSync(out, JSON.stringify(history));
    await page.close();
  }
  await browser.close();
  if (apply) { fs.writeFileSync(PROTO, writeNeeds(fs.readFileSync(PROTO, 'utf8'), needs)); console.log('written to', PROTO); }
})().catch(e => { console.error(e); process.exit(1); });

#!/usr/bin/env node
// Rebuilds LEVEL_NEEDS from the real game, not from a simplified copy of it.
// Each level: the average bot plays the shipped update() loop with a seeded clock.
// The need is set so that (share surviving to the wall) x (share at or above the need)
// hits the target win rate. Traffic costs and threats follow the need, so this repeats.
//
// Targets are the chat session's Build spec, interpolated: level 1 95, 2 92, 3 88,
// 5 80, 8 70, 12 62, 20 55. They are a guess about what feels right, and the players
// are bots with guessed skills. Real pass and fail data should replace both.
//
// usage: node sim/tune-needs.js <out.json> [runs] [iterations] [--apply]
// Needs playwright-core on NODE_PATH and Chrome. Output is close to, not exactly,
// repeatable: seeds are fixed, but Chrome's timing of page loads can vary the pools.
const fs = require('fs'), path = require('path');
const { launch, phonePage, openFast, PROTO } = require(path.join(__dirname, '..', 'tools', 'playtest', 'lib.js'));

const POINTS = [[1, 95], [2, 92], [3, 88], [5, 80], [8, 70], [12, 62], [20, 55]];
function target(lv) {
  for (let i = 0; i < POINTS.length - 1; i++) {
    const [a, x] = POINTS[i], [b, y] = POINTS[i + 1];
    if (lv >= a && lv <= b) return x + (y - x) * (lv - a) / (b - a);
  }
  return 55;
}
function playLevel({ level, runs, profile }) {
  const g = window.__gh, ff = window.__ff, DT = 1 / 60, bot = window.__botMake(profile || 'average');
  ff.reseed(level * 971 + 3);
  const masses = []; let crashes = 0, secs = 0;
  for (let r = 0; r < runs; r++) {
    bot.reset(); g.setLevel(level); const bz = g.barricadeZ; let z = 0, m = 0, s = 0;
    while (g.state === 'playing' && s++ < 7200) { ff.step(DT); bot.tick(DT); z = g.playerZ; m = g.mass; }
    if (Math.abs(z - bz) < 12) masses.push(m); else crashes++;
    secs += s * DT;
    for (let i = 0; i < 3; i++) ff.step(DT);
  }
  return { masses, crashes, secs: secs / runs };
}
function readNeeds(src) {
  const m = src.match(/const LEVEL_NEEDS\s*=\s*\[([\s\S]*?)\]/);
  if (!m) throw new Error('LEVEL_NEEDS not found');
  return m[1].split(',').map(Number);
}
function writeNeeds(src, needs) {
  const a = needs.slice(0, 10).join(','), b = needs.slice(10).join(',');
  return src.replace(/const LEVEL_NEEDS\s*=\s*\[[\s\S]*?\]/, `const LEVEL_NEEDS  = [${a},\n                        ${b}]`);
}

(async () => {
  const [out, runsS, itersS] = process.argv.slice(2);
  const runs = Number(runsS || 120), iters = Number(itersS || 3), apply = process.argv.includes('--apply');
  const tmp = path.join(process.env.PLAYTEST_TMP || require('os').tmpdir(), 'tune-working.html');
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  let src = fs.readFileSync(PROTO, 'utf8'), needs = readNeeds(src);
  const history = [];
  const browser = await launch({ headless: true });
  for (let it = 0; it < iters; it++) {
    const page = await phonePage(browser, 390, 844, 1); page.setDefaultTimeout(900000);
    await openFast(page, 700 + it, [[src.match(/const LEVEL_NEEDS\s*=\s*\[[\s\S]*?\]/)[0], `const LEVEL_NEEDS  = [${needs.join(',')}]`]]);
    const next = [], rows = [];
    for (let lv = 1; lv <= 20; lv++) {
      await page.reload(); await page.addScriptTag({ path: path.join(__dirname, '..', 'tools', 'playtest', 'bot.js') });
      await page.waitForFunction(() => !!window.__gh && !!window.__ff);
      const r = await page.evaluate(playLevel, { level: lv, runs });
      const survive = r.masses.length / runs, want = target(lv) / 100;
      const sorted = r.masses.slice().sort((a, b) => a - b);
      let need;
      if (survive <= want) { need = Math.max(sorted[0] || 100, 100); rows.push({ lv, survive, note: 'crashes alone are below target' }); }
      else { need = sorted[Math.floor(sorted.length * (1 - want / survive))]; }
      // Levels 1 and 2 teach, so a casual player must clear them too (at least 90%).
      if (lv <= 2) {
        const c = await page.evaluate(playLevel, { level: lv, runs, profile: 'casual' });
        const cs = c.masses.slice().sort((a, b) => a - b);
        const cSurvive = c.masses.length / runs;
        if (cSurvive > 0.9) need = Math.min(need, cs[Math.floor(cs.length * (1 - 0.9 / cSurvive))]);
      }
      need = Math.round(need / 10) * 10;
      rows.push({ lv, survive: +survive.toFixed(3), targetWin: Math.round(want * 100), secs: +r.secs.toFixed(1), median: sorted[sorted.length >> 1], need });
      next.push(need);
    }
    // the wall must rise every level, and never overshoot in one step of noise
    for (let i = 1; i < next.length; i++) next[i] = Math.max(next[i], Math.round(next[i - 1] * 1.04 / 10) * 10);
    // move part of the way each round: costs and threats scale with the need
    needs = it === iters - 1 ? next : needs.map((n, i) => Math.round((n + next[i]) / 20) * 10);
    if (it === iters - 1) needs = next;
    history.push({ iteration: it, needs: needs.slice(), rows });
    console.log(`iteration ${it}: ${JSON.stringify(needs)}`);
    fs.writeFileSync(out, JSON.stringify(history, null, 0));
    await page.close();
  }
  await browser.close();
  if (apply) { fs.writeFileSync(PROTO, writeNeeds(fs.readFileSync(PROTO, 'utf8'), needs)); console.log('written to', PROTO); }
})().catch(e => { console.error(e); process.exit(1); });

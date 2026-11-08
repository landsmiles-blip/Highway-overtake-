// Which level 3 change makes the cliff? Runs level 3 with each change put back to its
// level 2 value, one at a time, in the real game code. The game file is not edited.
// usage: node ablate.js <out.json> [runs]
const fs = require('fs'), path = require('path');
const { launch, phonePage, openFast } = require('./lib');

const CASES = {
  'as shipped': [],
  'no x2 line': [['mulLine: lv <= 2 ? -1 : Math.round(gateCount * 0.66)', 'mulLine: lv <= 3 ? -1 : Math.round(gateCount * 0.66)']],
  'no red doors': [['redChance: lv <= 2 ? 0 :', 'redChance: lv <= 3 ? 0 :']],
  'level 2 starting traffic': [['const teaching = level <= 2;', 'const teaching = level <= 3;']],
  'level 2 car limit and spawn rate': [
    ['spawnInt: lv <= 2 ? 1.5 :', 'spawnInt: lv <= 3 ? 1.5 :'], ['maxCars: lv <= 2 ? 11 :', 'maxCars: lv <= 3 ? 11 :']],
  'no double spawns': [['multiLane: lv <= 2 ? 0 :', 'multiLane: lv <= 3 ? 0 :']],
  'no barriers': [["key:'barrier',   preset:null,        weight:0.7, minLevel:3", "key:'barrier',   preset:null,        weight:0.7, minLevel:4"]],
  'need at level 2 share of best (1015)': [['const LEVEL_NEEDS  = [440,520,1100,', 'const LEVEL_NEEDS  = [440,520,1015,']],
  'all traffic changes together': [
    ['const teaching = level <= 2;', 'const teaching = level <= 3;'], ['spawnInt: lv <= 2 ? 1.5 :', 'spawnInt: lv <= 3 ? 1.5 :'],
    ['maxCars: lv <= 2 ? 11 :', 'maxCars: lv <= 3 ? 11 :'], ['multiLane: lv <= 2 ? 0 :', 'multiLane: lv <= 3 ? 0 :'],
    ["key:'barrier',   preset:null,        weight:0.7, minLevel:3", "key:'barrier',   preset:null,        weight:0.7, minLevel:4"]],
};

function run({ runs, profile }) {
  const g = window.__gh, ff = window.__ff, DT = 1 / 60, bot = window.__botMake(profile);
  ff.reseed(3003 + profile.length);
  let win = 0, crash = 0, wall = 0;
  for (let r = 0; r < runs; r++) {
    bot.reset(); g.setLevel(3); const bz = g.barricadeZ; let z = 0, m = 0, s = 0;
    while (g.state === 'playing' && s++ < 7200) { ff.step(DT); bot.tick(DT); z = g.playerZ; m = g.mass; }
    const near = Math.abs(z - bz) < 12;
    if (near && m >= g.need) win++; else if (near) wall++; else crash++;
    for (let i = 0; i < 3; i++) ff.step(DT);
  }
  return { win: +(win / runs).toFixed(3), crash: +(crash / runs).toFixed(3), wall: +(wall / runs).toFixed(3) };
}

(async () => {
  const out = process.argv[2], runs = Number(process.argv[3] || 200), res = [];
  const browser = await launch({ headless: true });
  for (const [name, patches] of Object.entries(CASES)) {
    const page = await phonePage(browser, 390, 844, 1); await openFast(page, 11, patches); page.setDefaultTimeout(600000);
    await page.addScriptTag({ path: path.join(__dirname, 'bot.js') }).catch(() => {});
    const a = await page.evaluate(run, { runs, profile: 'average' }), c = await page.evaluate(run, { runs, profile: 'casual' });
    const row = { name, runs, average: a, casual: c }; res.push(row); console.log(JSON.stringify(row));
    if (out) fs.writeFileSync(out, JSON.stringify(res, null, 0));
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

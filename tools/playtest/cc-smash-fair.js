// Claude Code evidence script (Letter 010, the smash experiment). Same experiment as chat-smash-exp.js, but the
// bot can be told which cars are deadly under the "tune decides what you can smash" rule, so the result does not
// just measure a bot that dodges by the old rule (bot.js stops dodging once mass >= maxThreat).
//   base          current rule, original bot
//   tune          tune rule, original bot                  (what chat-smash-exp.js ran)
//   tune --fair   tune rule, bot that dodges cars above its tier
// usage: node tools/playtest/cc-smash-fair.js <base|tune> <out.json> <runs> [--fair]
// Levels 3, 6, 10, 15, 20; average bot. Needs playwright-core on NODE_PATH and Chrome (CHROME_PATH).
const fs = require('fs'), path = require('path'), os = require('os');
const mode = process.argv[2], out = process.argv[3], runs = Number(process.argv[4]), fair = process.argv.includes('--fair');
const ROOT = path.resolve(__dirname, '..', '..');
let libDir = __dirname;
if (fair) {
  // A temporary copy of lib.js and bot.js; only the bot's dodge test is changed. The repo files are not touched.
  libDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-fair-'));
  fs.copyFileSync(path.join(__dirname, 'lib.js'), path.join(libDir, 'lib.js'));
  let bot = fs.readFileSync(path.join(__dirname, 'bot.js'), 'utf8');
  const rep = (a, b) => { if (!bot.includes(a)) throw new Error('bot.js changed, update this script: ' + a); bot = bot.replace(a, b); };
  rep('if (mass < (g.maxThreat !== undefined ? g.maxThreat : 800)) {', 'if (true) {');
  rep('for (const c of g.carFull) {', 'const __TN=["BANGER","FIXED","TUNED","SPORT","MUSCLE","BEAST"], __CLS={cone:0,barrier:1,hatchback:2,sedan:2,suv:3,pickup:3,van:4,bus:5}, __ti=__TN.indexOf(g.tierName);\n        for (const c of g.carFull) { if ((__CLS[c.k] ?? 3) <= __ti) continue;');
  fs.writeFileSync(path.join(libDir, 'bot.js'), bot);
  process.env.GH_PROTO = process.env.GH_PROTO || path.join(ROOT, 'gate-highway-prototype.html');
  process.env.GH_ROOT = process.env.GH_ROOT || ROOT;
}
const { launch, phonePage, openFast } = require(path.join(libDir, 'lib.js'));

const COUNT = [
  ["          showToast('SMASH!'); Snd.play('smash');", "          window.__sm=(window.__sm||0)+1; showToast('SMASH!'); Snd.play('smash');"],
  ["          showToast('BUMP!'); Snd.play('bump');",   "          window.__bp=(window.__bp||0)+1; showToast('BUMP!'); Snd.play('bump');"],
  ["    get carFull(){ return obstacles.map(function(o){ return {x:o.x, z:o.z}; }); },", "    get carFull(){ return obstacles.map(function(o){ return {x:o.x, z:o.z, k:o.kindDef.key}; }); },"],
];
const TUNE = [
  ["        if((cfg.forgiving || linesTaken === 0) && mass < threat){",
   "        const __CLS={cone:0,barrier:1,hatchback:2,sedan:2,suv:3,pickup:3,van:4,bus:5};\n" +
   "        const __can = Math.max(0, carTier) >= (__CLS[o.kindDef.key] ?? 3);\n" +
   "        if((cfg.forgiving || linesTaken === 0) && !__can){"],
  ["        if(mass >= threat){", "        if(__can){"],
];
function runBatch({ level, profile, runs }) {
  const DT = 1 / 60, MAX_STEPS = 60 * 120, g = window.__gh, ff = window.__ff, rows = [], bot = window.__botMake(profile);
  ff.reseed(level * 1000 + profile.length * 7 + profile.charCodeAt(0));
  for (let r = 0; r < runs; r++) {
    bot.reset(); g.setLevel(level); window.__sm = 0; window.__bp = 0;
    let steps = 0, lastMass = g.mass, zEnd = 0; const bz = g.barricadeZ;
    while (g.state === 'playing' && steps < MAX_STEPS) { ff.step(DT); bot.tick(DT); steps++; lastMass = g.mass; zEnd = g.playerZ; }
    const need = g.need, nearWall = bz !== null && Math.abs(zEnd - bz) < 12;
    rows.push({ win: nearWall && lastMass >= need, crash: !nearWall, sm: window.__sm, bp: window.__bp });
    for (let i = 0; i < 3; i++) ff.step(DT);
  }
  const n = rows.length, avg = k => rows.reduce((a, r) => a + (+r[k]), 0) / n;
  return { level, profile, win: +avg('win').toFixed(2), crash: +avg('crash').toFixed(2), smashes: +avg('sm').toFixed(1), bumps: +avg('bp').toFixed(1) };
}
(async () => {
  if (!['base', 'tune'].includes(mode) || !out || !runs) { console.error('usage: cc-smash-fair.js <base|tune> <out.json> <runs> [--fair]'); process.exit(2); }
  const b = await launch({ headless: true }), pg = await phonePage(b);
  await openFast(pg, 777, mode === 'tune' ? COUNT.concat(TUNE) : COUNT);
  const res = [];
  for (const level of [3, 6, 10, 15, 20]) res.push(await pg.evaluate(runBatch, { level, profile: 'average', runs }));
  fs.writeFileSync(out, JSON.stringify(res));
  console.log(mode + (fair ? ' (class-aware bot)' : ''));
  for (const r of res) console.log(' L' + r.level, 'win', r.win, 'crash', r.crash, 'smashes/run', r.smashes);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

// Chat review experiment: current smash rule vs "the tune decides what you can smash".
// Same seeds, same bots, same levels; only the hit-a-car rule differs.
// usage: node smash-exp.js <base|tune> <out.json> <runs>
const fs = require('fs');
const { launch, phonePage, openFast } = require('./lib');
const COUNT = [
  ["          showToast('SMASH!'); Snd.play('smash');", "          window.__sm=(window.__sm||0)+1; showToast('SMASH!'); Snd.play('smash');"],
  ["          showToast('BUMP!'); Snd.play('bump');",   "          window.__bp=(window.__bp||0)+1; showToast('BUMP!'); Snd.play('bump');"],
];
const TUNE = [
  ["        if((cfg.forgiving || linesTaken === 0) && mass < threat){",
   "        const __CLS={cone:0,barrier:1,hatchback:2,sedan:2,suv:3,pickup:3,van:4,bus:5};\n" +
   "        const __can = Math.max(0, carTier) >= (__CLS[o.kindDef.key] ?? 3);\n" +
   "        if((cfg.forgiving || linesTaken === 0) && !__can){"],
  ["        if(mass >= threat){", "        if(__can){"],
];
function runBatch({ level, profile, runs }) {
  const DT = 1 / 60, MAX_STEPS = 60 * 120;
  const g = window.__gh, ff = window.__ff, rows = [];
  const bot = window.__botMake(profile);
  ff.reseed(level * 1000 + profile.length * 7 + profile.charCodeAt(0));
  for (let r = 0; r < runs; r++) {
    bot.reset(); g.setLevel(level); window.__sm = 0; window.__bp = 0;
    let steps = 0, lastMass = g.mass, zEnd = 0; const bz = g.barricadeZ;
    while (g.state === 'playing' && steps < MAX_STEPS) { ff.step(DT); bot.tick(DT); steps++; lastMass = g.mass; zEnd = g.playerZ; }
    const need = g.need, nearWall = bz !== null && Math.abs(zEnd - bz) < 12;
    rows.push({ win: nearWall && lastMass >= need, crash: !nearWall, ratio: lastMass / need, sm: window.__sm, bp: window.__bp });
    for (let i = 0; i < 3; i++) ff.step(DT);
  }
  const n = rows.length, avg = k => rows.reduce((a, r) => a + (+r[k]), 0) / n;
  return { level, profile, win: avg('win'), crash: avg('crash'), ratio: avg('ratio'), smashes: avg('sm'), bumps: avg('bp') };
}
(async () => {
  const [mode, out, runsS] = process.argv.slice(2);
  const patches = mode === 'tune' ? COUNT.concat(TUNE) : COUNT;
  const b = await launch({ headless: true }); const pg = await phonePage(b);
  await openFast(pg, 777, patches);
  const res = [];
  for (const profile of ['casual', 'average'])
    for (let level = 1; level <= 20; level++)
      res.push(await pg.evaluate(runBatch, { level, profile, runs: Number(runsS) }));
  fs.writeFileSync(out, JSON.stringify(res));
  console.log(mode, 'done', res.length);
  await b.close();
})();

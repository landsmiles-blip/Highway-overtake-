// Claude Code evidence script (Letter 010, change 1). Is the x2 door really the best door at its line?
// For levels 3-20 the average bot plays 20 runs; when it passes the x2 line, its mass is compared with the
// biggest "+" door on the same line. A ratio above 1 means x2 beats the engine door.
// usage: node tools/playtest/cc-x2-check.js [out.json]
const fs = require('fs');
const { launch, phonePage, openFast } = require('./lib');

function run({ L, runs }) {
  const g = window.__gh, ff = window.__ff, bot = window.__botMake('average');
  const parse = s => { const m = /^\+([\d.]+)(k?)$/.exec(s); return m ? parseFloat(m[1]) * (m[2] ? 1000 : 1) : null; };
  const rows = [];
  ff.reseed(L * 977);
  for (let r = 0; r < runs; r++) {
    bot.reset(); g.setLevel(L);
    let lastMass = g.mass, z = null, big = null, got = null;
    for (let s = 0; s < 60 * 70 && g.state === 'playing'; s++) {
      ff.step(1 / 60); bot.tick(1 / 60);
      const gi = g.gateInfo, x2 = gi.find(q => q.l === 'x2');
      if (x2 && z === null) { z = x2.z; big = Math.max(0, ...gi.filter(q => q.z === x2.z).map(q => parse(q.l) || 0)); }
      if (z !== null && got === null && g.playerZ < z) got = lastMass;
      lastMass = g.mass;
    }
    if (got !== null) rows.push({ ratio: got / big, big });
  }
  rows.sort((a, b) => a.ratio - b.ratio);
  const n = rows.length;
  return { level: L, reached: n, big: n ? rows[0].big : null, minRatio: n ? +rows[0].ratio.toFixed(2) : null,
           medianRatio: n ? +rows[n >> 1].ratio.toFixed(2) : null, worseThanEngine: rows.filter(q => q.ratio < 1).length };
}

(async () => {
  const b = await launch({ headless: true }), pg = await phonePage(b, 390, 844, 1); await openFast(pg, 11);
  const res = [];
  console.log('lv  reached  big   min(mass/big)  median  runs where x2 < engine');
  for (let L = 3; L <= 20; L++) {
    const r = await pg.evaluate(run, { L, runs: 20 }); res.push(r);
    console.log(String(L).padStart(2), String(r.reached).padStart(7), String(r.big).padStart(6), String(r.minRatio).padStart(10), String(r.medianRatio).padStart(10), String(r.worseThanEngine).padStart(8));
  }
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(res));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

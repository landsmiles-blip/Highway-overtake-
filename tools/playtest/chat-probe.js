// Review probe (chat session). Real game + average bot. Per level:
//  cars a player can see (other cars -6..45 units from the player), sampled every 0.25 s;
//  plain gate lines where the best door has a car in its lane between player and gate, checked at 25 units.
const { launch, phonePage, openFast } = require('./lib');
(async () => {
  const b = await launch({ headless: true }); const pg = await phonePage(b);
  await openFast(pg, 4242);
  const out = await pg.evaluate(() => {
    const g = window.__gh, ff = window.__ff, bot = window.__botMake('average'), res = [];
    for (const lv of [1, 3, 6, 10, 15, 20]) {
      const seen = []; let lines = 0, blocked = 0; const checked = new Set();
      for (let run = 0; run < 12; run++) {
        bot.reset(); g.setLevel(lv); let s = 0;
        while (g.state === 'playing' && s < 60 * 90) {
          ff.step(1/60); bot.tick(1/60); s++;
          const pz = g.playerZ;
          if (s % 15 === 0) seen.push(g.carFull.filter(c => pz - c.z > -6 && pz - c.z < 45).length);
          const gi = g.gateInfo.filter(x => !x.used && x.z < pz); if (!gi.length) continue;
          const d = Math.min(...gi.map(x => pz - x.z)); if (!(d < 25 && d > 22)) continue;
          const line = gi.filter(x => Math.abs((pz - x.z) - d) < 2);
          const key = run + ':' + Math.round(line[0].z);
          if (checked.has(key) || line.length !== 3) continue; checked.add(key);
          if (line.some(x => x.l === 'x2' || x.l === '/2')) continue;
          lines++;
          const best = line.reduce((a, c) => (+c.l.slice(1) > +a.l.slice(1) ? c : a));
          if (g.carFull.some(c => Math.abs(c.x - best.x) < 1.8 && c.z < pz - 1 && c.z > best.z)) blocked++;
        }
        for (let i = 0; i < 3; i++) ff.step(1/60);
      }
      seen.sort((a, c) => a - c);
      res.push({ level: lv, visibleMean: +(seen.reduce((a, c) => a + c, 0) / seen.length).toFixed(1),
        median: seen[seen.length >> 1], zeroShare: +(seen.filter(x => x === 0).length / seen.length).toFixed(2),
        plainLines: lines, bestBlocked: blocked });
    }
    return res;
  });
  console.table(out); await b.close();
})();

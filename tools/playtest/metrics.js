// What the player actually gets, measured in the real game code with a playing bot at
// normal car size: cars near the player, duplicate doors, cars deleted near gates,
// draw calls and triangles. usage: node metrics.js <out.json> [runsPerLevel] [levels]
const fs = require('fs');
const { launch, phonePage, openFast } = require('./lib');
const CULL = ['releaseVehicle(o.kindDef, o.group);\n            obstacles.splice(i, 1);\n            break;',
              'window.__culled = (window.__culled || 0) + 1; releaseVehicle(o.kindDef, o.group);\n            obstacles.splice(i, 1);\n            break;'];

function measure({ level, runs, profile }) {
  const g = window.__gh, ff = window.__ff, DT = 1 / 60;
  const bot = window.__botMake(profile);
  ff.reseed(level * 77 + 5);
  let frames = 0, near20 = 0, near40 = 0, near80 = 0, pool = 0, lines = 0, dup = 0, red = 0, mul = 0, secs = 0, wins = 0;
  const seenZ = new Set(); let culled = 0, calls = [], tris = [], geos = 0;
  for (let r = 0; r < runs; r++) {
    bot.reset(); window.__culled = 0; g.setLevel(level); seenZ.clear();
    let steps = 0; const bz = g.barricadeZ; let z = 0, m = 0;
    while (g.state === 'playing' && steps++ < 7200) {
      ff.step(DT); bot.tick(DT);
      if (g.state !== 'playing') break;
      z = g.playerZ; m = g.mass;
      if (steps % 6 === 0) {
        frames++;
        for (const c of g.carFull) { const a = z - c.z; if (a > 2) { if (a <= 20) near20++; if (a <= 40) near40++; if (a <= 80) near80++; } }
        pool += g.obstacleCount;
        const by = new Map();
        for (const d of g.gateInfo) { if (!by.has(d.z)) by.set(d.z, []); by.get(d.z).push(d.l); }
        for (const [gz, ls] of by) if (!seenZ.has(gz) && ls.length === 3) {
          seenZ.add(gz); lines++;
          if (ls.includes('x2')) mul++; else if (ls.includes('/2')) red++;
          if (new Set(ls).size < 3) dup++;
        }
        if (r === 0 && steps % 600 === 0) {
          ff.draw = true; ff.step(0); ff.draw = false;
          const i = ff.r.info; calls.push(i.render.calls); tris.push(i.render.triangles); geos = i.memory.geometries;
        }
      }
    }
    secs += steps * DT; culled += window.__culled;
    if (bz !== null && Math.abs(z - bz) < 12 && m >= g.need) wins++;
    for (let i = 0; i < 3; i++) ff.step(DT);
  }
  const f = v => +(v / frames).toFixed(2), avg = a => a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null;
  return { level, profile, runs, win: +(wins / runs).toFixed(2), secs: +(secs / runs).toFixed(1), carsWithin20: f(near20), carsWithin40: f(near40), carsWithin80: f(near80), carsInPool: f(pool),
    lines, dupShare: +(dup / lines).toFixed(2), redShare: +(red / lines).toFixed(2), mulShare: +(mul / lines).toFixed(2), culledPerRun: +(culled / runs).toFixed(1), drawCalls: avg(calls), triangles: avg(tris), geometries: geos };
}

(async () => {
  const out = process.argv[2], runs = Number(process.argv[3] || 40);
  const levels = (process.argv[4] || '1,2,3,5,8,10,12,15,20').split(',').map(Number);
  const browser = await launch({ headless: true }); const page = await phonePage(browser, 390, 844, 2);
  await openFast(page, 4242, [CULL]); page.setDefaultTimeout(600000);
  const res = [];
  for (const level of levels) {
    await page.reload(); await page.addScriptTag({ path: require('path').join(__dirname, 'bot.js') });
    await page.waitForFunction(() => !!window.__gh && !!window.__ff);
    const r = await page.evaluate(measure, { level, runs, profile: 'average' }); res.push(r);
    console.log(JSON.stringify(r)); if (out) fs.writeFileSync(out, JSON.stringify(res, null, 0));
  }
  console.log('errors', JSON.stringify(page.errors.slice(0, 3)));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

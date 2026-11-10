// Claude Code evidence script (Letter 010, change 2). Is the pause button covered by the player's car?
// For each frame and level: the average bot plays up to 70 s in the real game code (fast mode), and every
// 6th step the car's on-screen box (CAR_RECT_PATCH, added in memory) is compared with the pause button.
// usage: node tools/playtest/cc-overlap-probe.js [out.json]
// Needs playwright-core on NODE_PATH and Chrome (CHROME_PATH). Output is a table and, if given, a JSON file.
const fs = require('fs');
const { launch, phonePage, openFast, CAR_RECT_PATCH } = require('./lib');
const FRAMES = [[390, 844], [844, 390], [320, 568], [820, 1180], [1440, 900], [600, 600], [1920, 600]];

function measure({ L }) {
  const g = window.__gh, ff = window.__ff, bot = window.__botMake('average'); bot.reset(); g.setLevel(L);
  const btn = document.getElementById('btnPause'), DT = 1 / 60;
  let n = 0, over = 0, maxArea = 0, minGapY = 1e9, carBottomMax = 0;
  for (let s = 0; s < 60 * 70 && g.state === 'playing'; s++) {
    ff.step(DT); bot.tick(DT);
    if (s % 6 !== 0) continue;
    const c = g.carRect(), b = btn.getBoundingClientRect();
    const ix = Math.min(c.r, b.right) - Math.max(c.l, b.left), iy = Math.min(c.b, b.bottom) - Math.max(c.t, b.top);
    n++; carBottomMax = Math.max(carBottomMax, c.b);
    if (ix > 0) minGapY = Math.min(minGapY, b.top - c.b);   // vertical gap while sharing a column; negative = overlap
    if (ix > 0 && iy > 0) { over++; maxArea = Math.max(maxArea, ix * iy); }
  }
  return { samples: n, overlapping: over, maxAreaPx: Math.round(maxArea), minGapY: minGapY === 1e9 ? null : Math.round(minGapY), carBottomMax: Math.round(carBottomMax) };
}

(async () => {
  const b = await launch({ headless: true }), res = [];
  for (const [w, h] of FRAMES) for (const L of [4, 6, 10]) {
    const pg = await phonePage(b, w, h, 1); await openFast(pg, 31 + L, CAR_RECT_PATCH);
    res.push({ frame: w + 'x' + h, level: L, ...(await pg.evaluate(measure, { L })) });
    await pg.close();
  }
  console.log('frame      lv samples overlap maxArea minGapY');
  for (const r of res) console.log(r.frame.padEnd(10), String(r.level).padStart(2), String(r.samples).padStart(7), String(r.overlapping).padStart(7), String(r.maxAreaPx).padStart(7), String(r.minGapY).padStart(7));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(res));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

// Takes real-time pictures of a level so a person can look at the road.
// usage: node shots.js <outDir> <level> <width> <height> [count]
const fs = require('fs'), path = require('path');
const { launch, phonePage, openReal } = require('./lib');
(async () => {
  const [out, lv, w, h, n] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await launch(); const p = await phonePage(b, Number(w), Number(h), 1); await openReal(p);
  await p.evaluate(l => {
    window.__gh.setLevel(l);
    const bot = window.__botMake('sharp'); let last = performance.now();
    (function loop() { requestAnimationFrame(loop); const now = performance.now(), dt = (now - last) / 1000; last = now; if (window.__gh.state === 'playing') bot.tick(Math.min(dt, 0.05)); })();
  }, Number(lv));
  for (let i = 0; i < Number(n || 6); i++) {
    await new Promise(r => setTimeout(r, 3000));
    await p.screenshot({ path: path.join(out, `L${lv}-${w}x${h}-${i}.png`) });
  }
  console.log(JSON.stringify({ state: await p.evaluate(() => window.__gh.state), mass: await p.evaluate(() => window.__gh.mass), errors: p.errors, net: p.net }));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });

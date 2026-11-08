// Does the game keep true speed on a slow device? Level 1 cannot be lost, so a car
// that never steers always reaches the wall. Compares real seconds to the wall at
// normal speed and with the CPU throttled. usage: node clocktest.js [throttles]
const { launch, phonePage, openReal } = require('./lib');
(async () => {
  const rates = (process.argv[2] || '1,6').split(',').map(Number), rows = [];
  const browser = await launch();
  for (const rate of rates) {
    const page = await phonePage(browser, 390, 844, 2);
    if (rate > 1) { const c = await page.context().newCDPSession(page); await c.send('Emulation.setCPUThrottlingRate', { rate }); }
    await openReal(page); page.setDefaultTimeout(240000);
    const r = await page.evaluate(() => new Promise(res => {
      const g = window.__gh; g.setLevel(1); g.setMass(100000);   // heavy, so nothing can end the run early
      const t0 = performance.now(); let n = 0, last = t0, over = 0;
      (function tick() {
        const now = performance.now(); n++; if (now - last > 100) over++; last = now;
        if (g.state !== 'playing') return res({ secs: +((now - t0) / 1000).toFixed(1), fps: +(n * 1000 / (now - t0)).toFixed(1), slowerThan10fps: over });
        requestAnimationFrame(tick);
      })();
    }));
    rows.push({ rate, ...r }); console.log(JSON.stringify({ rate, ...r }));
    await page.close();
  }
  await browser.close();
  const base = rows[0].secs;
  for (const r of rows.slice(1)) console.log(`throttle ${r.rate}: ${r.fps} fps, ${r.secs}s vs ${base}s, ${((r.secs / base - 1) * 100).toFixed(1)}% slower`);
})().catch(e => { console.error(e); process.exit(1); });

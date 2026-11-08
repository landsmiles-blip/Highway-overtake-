// Makes the three covers Playgama requires, from real gameplay, with the title on top.
// usage: node tools/ship/covers.js <outDir>
const path = require('path'), fs = require('fs');
const { launch, phonePage, openReal } = require(path.join(__dirname, '..', 'playtest', 'lib.js'));
const SIZES = { square: [800, 800], portrait: [1080, 1920], landscape: [1920, 1080] };
(async () => {
  const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
  const b = await launch();
  for (const [name, [w, h]] of Object.entries(SIZES)) {
    const p = await phonePage(b, w, h, 1); await openReal(p);
    await p.evaluate(() => {
      const g = window.__gh; g.setLevel(13); const bot = window.__botMake('sharp'); let last = performance.now();
      (function loop() { requestAnimationFrame(loop); const n = performance.now(), dt = (n - last) / 1000; last = n; if (g.state === 'playing') bot.tick(Math.min(dt, 0.05)); })();
    });
    // a good moment: a tough car, doors close, plenty of traffic in view
    await p.evaluate(() => window.__gh.setMass(Math.round(window.__gh.need * 1.15)));
    await p.waitForFunction(() => {
      const g = window.__gh, near = g.gateInfo.some(d => d.z < g.playerZ && g.playerZ - d.z < 34 && g.playerZ - d.z > 18);
      const cars = g.carFull.filter(c => g.playerZ - c.z > 4 && g.playerZ - c.z < 60).length;
      return near && cars >= 4 && g.state === 'playing';
    }, null, { timeout: 25000, polling: 40 });
    await p.addStyleTag({ content: `#pedals,#btnPause,#hud,#controlsHint,#toast,#titleSplash,#flash,.board{display:none!important}
      #coverTitle{position:fixed;left:0;right:0;top:${name === 'portrait' ? 13 : 7}%;text-align:center;font-family:'Orbitron',sans-serif;font-weight:800;
      font-size:${Math.round(Math.min(w, h) * 0.105)}px;line-height:1.05;color:#fff;letter-spacing:2px;text-shadow:0 5px 0 #c8530f,0 10px 26px rgba(0,0,0,.55)}` });
    await p.evaluate(() => { const t = document.createElement('div'); t.id = 'coverTitle'; t.innerHTML = 'GATE<br>HIGHWAY'; document.body.appendChild(t); window.GH.pause(); document.getElementById('pauseScreen').style.display = 'none'; });
    await new Promise(r => setTimeout(r, 300));
    await p.screenshot({ path: path.join(out, `cover-${name}-${w}x${h}.png`) });
    console.log(name, 'ok', JSON.stringify(p.errors));
    await p.close();
  }
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });

// Claude Code evidence script (Letter 017 step 4, Tony: yes): the PAUSED title is readable and alone.
// At all 7 frames, paused right after boot while the GATE HIGHWAY title is still on screen:
// the title is gone, PAUSED is light (cyan) with a contrast of at least 4.5 against the pause screen's darkest
// possible backdrop and 3 against its lightest, and PAUSED does not overlap the three buttons. Pictures saved.
// usage: node tools/playtest/cc-paused-proof.js <picture-folder>
const fs = require('fs'), path = require('path');
const { launch, phonePage, openReal } = require('./lib');
const FRAMES = [[390, 844], [844, 390], [320, 568], [820, 1180], [1440, 900], [600, 600], [1920, 600]];
const out = process.argv[2] || 'paused-proof'; fs.mkdirSync(out, { recursive: true });
const fails = []; const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
// WCAG relative luminance and contrast
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// the pause screen is rgba(6,7,18,.82) over the game: its backdrop ranges from that over black to that over white
const over = bg => [6, 7, 18].map((c, i) => Math.round(c * 0.82 + bg[i] * 0.18));

(async () => {
  const b = await launch({ headless: true });
  for (const [w, h] of FRAMES) {
    const p = await phonePage(b, w, h, 1); await openReal(p);
    const titleBefore = await p.evaluate(() => !!document.getElementById('titleSplash'));
    await p.evaluate(() => window.GH.pause()); await new Promise(r => setTimeout(r, 300));
    const r = await p.evaluate(() => {
      const h1 = document.querySelector('#pauseScreen h1'), hr = h1.getBoundingClientRect();
      const btns = ['btnResume', 'btnRestart', 'btnMute'].map(id => document.getElementById(id).getBoundingClientRect());
      const hit = btns.some(q => Math.min(q.right, hr.right) > Math.max(q.left, hr.left) && Math.min(q.bottom, hr.bottom) > Math.max(q.top, hr.top));
      return { color: getComputedStyle(h1).color, title: !!document.getElementById('titleSplash'), hit, onScreen: hr.top >= 0 && hr.left >= 0 && hr.right <= innerWidth };
    });
    const rgb = r.color.match(/\d+/g).slice(0, 3).map(Number);
    const cDark = contrast(rgb, over([0, 0, 0])), cLight = contrast(rgb, over([255, 255, 255]));
    await p.screenshot({ path: path.join(out, `paused-${w}x${h}.png`) });
    check(!r.title, `${w}x${h}: GATE HIGHWAY title gone when paused (it was on screen before: ${titleBefore})`);
    check(cDark >= 4.5 && cLight >= 3, `${w}x${h}: PAUSED ${r.color}, contrast ${cDark.toFixed(1)} on the darkest backdrop, ${cLight.toFixed(1)} on the lightest`);
    check(!r.hit && r.onScreen, `${w}x${h}: PAUSED on screen and clear of the buttons`);
    check(p.errors.length === 0, `${w}x${h}: no page errors`);
    await p.close();
  }
  await b.close();
  console.log(fails.length ? `${fails.length} FAILED` : 'all passed');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

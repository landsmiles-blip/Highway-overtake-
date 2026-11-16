// Claude Code evidence script (Letter 012 addendum 1, Letter 014): the player's mute button (Playgama rule 3.3.3).
// 1. The pause screen with its Sound button at all 7 frames: pictures, and a check that the three buttons are on screen and do not overlap.
// 2. The player's mute and the platform's mute are independent: either one silences, neither undoes the other.
// Reads the sound state through a getter added in memory only (the game file is not edited for the test).
// usage: node tools/playtest/cc-mute-proof.js <picture-folder>
const fs = require('fs'), path = require('path');
const { launch, phonePage, openReal } = require('./lib');
const FRAMES = [[390, 844], [844, 390], [320, 568], [820, 1180], [1440, 900], [600, 600], [1920, 600]];
const EXPOSE = [['  window.GH = { pause: pauseGame,', '  window.__snd = Snd; window.GH = { pause: pauseGame,']];
const out = process.argv[2] || 'mute-proof'; fs.mkdirSync(out, { recursive: true });
const fails = []; const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };

(async () => {
  const b = await launch({ headless: true });
  for (const [w, h] of FRAMES) {
    const p = await phonePage(b, w, h, 1); await openReal(p, '', EXPOSE);
    await p.evaluate(() => window.__gh.setLevel(1));
    await new Promise(r => setTimeout(r, 400));
    await p.evaluate(() => window.GH.pause());
    await new Promise(r => setTimeout(r, 300));
    const r = await p.evaluate(() => {
      const ids = ['btnResume', 'btnRestart', 'btnMute'], rs = ids.map(id => document.getElementById(id).getBoundingClientRect());
      const onScreen = rs.every(q => q.width > 0 && q.left >= 0 && q.top >= 0 && q.right <= innerWidth && q.bottom <= innerHeight);
      let overlap = false; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], c = rs[j]; if (Math.min(a.right, c.right) > Math.max(a.left, c.left) && Math.min(a.bottom, c.bottom) > Math.max(a.top, c.top)) overlap = true; }
      return { onScreen, overlap, text: document.getElementById('btnMute').textContent };
    });
    await p.screenshot({ path: path.join(out, `pause-${w}x${h}.png`) });
    check(r.onScreen && !r.overlap && r.text === 'Sound: on', `${w}x${h}: Resume, Restart and Sound buttons on screen, not overlapping ("${r.text}")`);
    check(p.errors.length === 0, `${w}x${h}: no page errors`);
    await p.close();
  }
  // independence of the two mutes
  const p = await phonePage(b, 390, 844, 1); await openReal(p, '', EXPOSE);
  await p.mouse.click(195, 400);   // a first touch, so the game can start its sound
  await p.evaluate(() => window.__gh.setLevel(1)); await p.evaluate(() => window.GH.pause());
  const s = () => p.evaluate(() => ({ silent: window.__snd.silent, player: window.__snd.playerMuted, label: document.getElementById('btnMute').textContent }));
  const s0 = await s(); check(!s0.silent && s0.label === 'Sound: on', 'start: sound on, button says "Sound: on"');
  await p.click('#btnMute'); const s1 = await s(); check(s1.silent && s1.player && s1.label === 'Sound: off', 'player taps Sound: silent, button says "Sound: off"');
  await p.evaluate(() => window.GH.mute(false)); const s2 = await s(); check(s2.silent, 'platform un-mutes: still silent (the platform cannot undo the player)');
  await p.click('#btnMute'); const s3 = await s(); check(!s3.silent && s3.label === 'Sound: on', 'player taps Sound again: sound back on');
  await p.evaluate(() => window.GH.mute(true)); const s4 = await s(); check(s4.silent && !s4.player && s4.label === 'Sound: on', 'platform mutes: silent, the player setting stays on');
  await p.click('#btnMute'); await p.click('#btnMute'); const s5 = await s(); check(s5.silent, 'player taps twice while the platform mutes: still silent (the player cannot undo the platform)');
  await p.evaluate(() => window.GH.mute(false)); const s6 = await s(); check(!s6.silent, 'platform un-mutes, player setting on: sound on');
  check(p.errors.length === 0, 'mute test: no page errors');
  await b.close();
  console.log(fails.length ? `${fails.length} FAILED` : 'all passed');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

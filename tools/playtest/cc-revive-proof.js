// Claude Code evidence script (Letter 017 step 5): the second chance (idea A).
// Bridge's mock mode has no rewarded ads, so this wraps Bridge's `advertisement` getter (a Proxy, as in
// cc-slow-bridge-proof.js): isRewardedSupported and showRewarded are driven by window.__adMode, and the state events go
// to the handler the game itself registered. Every outcome is played through the game's own code:
//   unsupported -> no offer, normal fail screen      rewarded -> drive on, size kept, once per attempt
//   closed early -> no reward, fail screen           failed   -> no reward, fail screen
//   silent (no answer) -> fail screen after 8 s      declined -> fail screen
//   wall loss with ads available -> no offer         revived win -> progression_completed revived true
// Telemetry: progression_failed is sent once, when the attempt really ends; second_chance records the result.
// The offer screen is pictured at all 7 frames with an overlap check. A real ad is provable only on Playgama's QA tool.
// usage: node tools/playtest/cc-revive-proof.js <picture-folder>
const fs = require('fs'), path = require('path');
const { launch, phonePage, openReal } = require('./lib');
const FRAMES = [[390, 844], [844, 390], [320, 568], [820, 1180], [1440, 900], [600, 600], [1920, 600]];
const EXPOSE = [['  window.GH = { pause: pauseGame,', '  window.__lf = levelFailed; window.__lc = levelClear; window.GH = { pause: pauseGame,']];
const out = process.argv[2] || 'revive-proof'; fs.mkdirSync(out, { recursive: true });
const fails = []; const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const INIT = () => {
  window.__ev = []; window.__adMode = 'unsupported'; window.__adCalls = 0; let real, rwHandler = null;
  Object.defineProperty(window, 'bridge', { configurable: true, get() { return real; }, set(v) {
    real = v;
    const wrap = (name, make) => {
      const desc = Object.getOwnPropertyDescriptor(v, name) || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(v), name);
      Object.defineProperty(v, name, { configurable: true, get() { return make(desc.get ? desc.get.call(v) : desc.value); } });
    };
    wrap('analytics', orig => new Proxy(orig, { get(t, k) { const val = Reflect.get(t, k);
      if (k === 'send') return (n, d) => { window.__ev.push({ name: n, data: JSON.parse(JSON.stringify(d || {})) }); return val.call(t, n, d); };
      return typeof val === 'function' ? val.bind(t) : val; } }));
    wrap('advertisement', orig => new Proxy(orig, { get(t, k) {
      if (k === 'isRewardedSupported') return window.__adMode !== 'unsupported';
      if (k === 'isInterstitialSupported') return false;
      if (k === 'on') return (ev, h) => { if (ev === v.EVENT_NAME.REWARDED_STATE_CHANGED) rwHandler = h; return orig.on(ev, h); };
      if (k === 'showRewarded') return () => { window.__adCalls++;
        const seq = { rewarded: ['loading', 'opened', 'rewarded', 'closed'], closed: ['loading', 'opened', 'closed'], failed: ['loading', 'failed'], silent: [] }[window.__adMode] || [];
        seq.forEach((st, i) => setTimeout(() => rwHandler && rwHandler(st), 300 + i * 300)); };
      const val = Reflect.get(t, k); return typeof val === 'function' ? val.bind(t) : val; } }));
  } });
};

(async () => {
  const b = await launch({ headless: true });
  const p = await phonePage(b, 390, 844, 1); await p.addInitScript(INIT); await openReal(p, '', EXPOSE);
  const screen = () => p.evaluate(() => ({ offer: !!document.getElementById('reviveBtn'), fail: !!document.getElementById('retryBtn'),
    shown: document.getElementById('overlay').style.display === 'flex', state: window.__gh.state, mass: window.__gh.mass }));
  const ev = () => p.evaluate(() => window.__ev.filter(e => e.name !== 'performance_sample').map(e => e.name + (e.data.result ? ':' + e.data.result : '') + (e.data.revived ? ':revived' : '')));
  const start = async (lv, mode) => { await p.evaluate(m => { window.__adMode = m; document.getElementById('overlay').innerHTML = ''; }, mode);
    await p.evaluate(n => window.__gh.setLevel(n), lv); await sleep(1200); await p.evaluate(() => { window.__ev.length = 0; }); };
  const crash = async () => { await p.evaluate(() => window.__lf('crash')); await sleep(700); };

  // unsupported
  await start(7, 'unsupported'); await crash(); let s = await screen(), e = await ev();
  check(!s.offer && s.fail, `no rewarded ads: no offer, normal fail screen (${JSON.stringify(s)})`);
  check(JSON.stringify(e) === '["progression_failed"]', `  events: ${e.join(', ')}`);

  // rewarded, then once per attempt
  await start(7, 'rewarded'); const m0 = await p.evaluate(() => window.__gh.mass); await crash(); s = await screen();
  check(s.offer && !s.fail && s.state === 'over', 'ads available, crash in traffic: the offer appears, the attempt is not ended yet');
  check(JSON.stringify(await ev()) === '[]', '  no progression_failed while the offer is up');
  await p.click('#reviveBtn'); await sleep(2000); s = await screen();
  check(s.state === 'playing' && !s.shown && s.mass === m0, `ad watched to the end: driving again, overlay gone, size kept (${m0} -> ${s.mass})`);
  await crash(); s = await screen(); e = await ev();
  check(!s.offer && s.fail, 'second crash in the same attempt: no second offer, fail screen');
  check(JSON.stringify(e) === '["second_chance:rewarded","progression_failed:revived"]', `  events: ${e.join(', ')}`);
  check((await p.evaluate(() => window.__adCalls)) === 1, 'one rewarded ad requested in the attempt');

  // a new attempt offers again
  await start(7, 'rewarded'); await crash(); s = await screen();
  check(s.offer, 'a new attempt (Try again / next level) can offer again');
  await p.click('#reviveBtn'); await sleep(2000);
  await p.evaluate(() => { document.getElementById('overlay').innerHTML = ''; window.__lc(); });
  await p.waitForFunction(() => !!document.getElementById('nextBtn'), null, { timeout: 20000 }); e = await ev();
  check(e.includes('progression_completed:revived'), `revived win is marked revived: ${e.join(', ')}`);

  // closed early, failed, silent, declined
  for (const [mode, wait, label] of [['closed', 2000, 'ad closed before the end'], ['failed', 1500, 'ad failed to load'], ['silent', 9500, 'no answer from the ad']]) {
    await start(7, mode); await crash(); await p.click('#reviveBtn'); await sleep(wait); s = await screen(); e = await ev();
    check(!s.offer && s.fail && s.state === 'over', `${label}: no reward, normal fail screen`);
    check(JSON.stringify(e) === '["second_chance:not_rewarded","progression_failed"]', `  events: ${e.join(', ')}`);
  }
  await start(7, 'rewarded'); await crash(); await p.click('#declineBtn'); await sleep(500); s = await screen(); e = await ev();
  check(s.fail && s.state === 'over', 'No thanks: normal fail screen');
  check(JSON.stringify(e) === '["second_chance:declined","progression_failed"]', `  events: ${e.join(', ')}`);

  // wall loss
  await start(14, 'rewarded'); await p.evaluate(() => window.__lf('barricade')); await sleep(700); s = await screen();
  check(!s.offer && s.fail, 'lost at the wall with ads available: no offer (a revive cannot add size)');
  check(p.errors.length === 0, 'no page errors' + (p.errors.length ? ': ' + p.errors.join(' | ') : ''));
  await p.close();

  // the offer screen at every frame
  for (const [w, h] of FRAMES) {
    const q = await phonePage(b, w, h, 1); await q.addInitScript(INIT); await openReal(q, '', EXPOSE);
    await q.evaluate(() => { window.__adMode = 'rewarded'; window.__gh.setLevel(7); }); await sleep(1000);
    await q.evaluate(() => window.__lf('crash')); await sleep(700);
    const r = await q.evaluate(() => {
      const els = ['#overlay h1', '#overlay .sub', '#reviveBtn', '#declineBtn'].map(sel => document.querySelector(sel).getBoundingClientRect());
      const onScreen = els.every(q => q.width > 0 && q.left >= 0 && q.top >= 0 && q.right <= innerWidth && q.bottom <= innerHeight);
      let overlap = false; for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const a = els[i], c = els[j]; if (Math.min(a.right, c.right) > Math.max(a.left, c.left) && Math.min(a.bottom, c.bottom) > Math.max(a.top, c.top)) overlap = true; }
      return { onScreen, overlap, title: !!document.getElementById('titleSplash') };
    });
    await q.screenshot({ path: path.join(out, `offer-${w}x${h}.png`) });
    check(r.onScreen && !r.overlap && !r.title && q.errors.length === 0, `${w}x${h}: offer title, text and both buttons on screen, not overlapping, boot title gone, no errors`);
    await q.close();
  }
  await b.close();
  console.log(fails.length ? `${fails.length} FAILED` : 'all passed');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

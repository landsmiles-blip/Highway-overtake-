// Claude Code evidence script (Letter 017 step 1): progression telemetry and performance_sample.
// Records every bridge.analytics.send call by wrapping Bridge's `analytics` getter (Bridge modules are Proxies
// that ignore added methods, see cc-slow-bridge-proof.js). Bridge runs in mock mode on localhost.
// 1. Level 1 played to its end with mass set high: progression_started then progression_completed, and
//    one performance_sample, taken with a 5 s pause in the middle that must not count as a frozen frame.
// 2. A crash and a wall loss through the game's own levelFailed (exposed in memory only): progression_failed
//    with reason crash / barricade.
// 3. Every event: fixed name, level_id 1-20, step_index = the real level, revived false; 0 page errors.
// usage: node tools/playtest/cc-telemetry-proof.js
const { launch, phonePage, openReal } = require('./lib');
const EXPOSE = [['  window.GH = { pause: pauseGame,', '  window.__lf = levelFailed; window.GH = { pause: pauseGame,']];
const fails = []; const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const PERF_FIELDS = ['target_fps', 'window_ms', 'active_ms', 'frame_count', 'fps_avg', 'fps_p10', 'frame_time_p50_ms', 'frame_time_p95_ms',
  'frame_time_p99_ms', 'frame_time_max_ms', 'frames_over_50ms', 'frames_over_100ms', 'frames_over_250ms', 'frames_over_500ms', 'frames_over_1000ms', 'build_version'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await launch({ headless: true });
  const p = await phonePage(b, 390, 844, 1);
  await p.addInitScript(() => {
    window.__ev = []; let real;
    Object.defineProperty(window, 'bridge', { configurable: true, get() { return real; }, set(v) {
      real = v;
      const desc = Object.getOwnPropertyDescriptor(v, 'analytics') || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(v), 'analytics');
      Object.defineProperty(v, 'analytics', { configurable: true, get() {
        const orig = desc.get ? desc.get.call(v) : desc.value;
        return new Proxy(orig, { get(t, k) { const val = Reflect.get(t, k);
          if (k === 'send') return (name, data) => { window.__ev.push({ name, data: JSON.parse(JSON.stringify(data || {})), t: Math.round(performance.now()) }); return val.call(t, name, data); };
          return typeof val === 'function' ? val.bind(t) : val; } });
      } });
    } });
  });
  await openReal(p, '', EXPOSE);
  const hasSend = await p.evaluate(() => !!(window.bridge && window.bridge.analytics && typeof window.bridge.analytics.send === 'function'));
  check(hasSend, 'Bridge (mock) exposes analytics.send');

  // 1. a full level 1 with a pause in the middle
  await p.evaluate(() => { window.__ev.length = 0; window.__gh.setLevel(1); });
  await p.evaluate(() => window.__gh.setMass(window.__gh.need * 3));
  await sleep(12000);
  await p.evaluate(() => window.GH.pause()); await sleep(5000); await p.evaluate(() => window.GH.resume());
  await p.waitForFunction(() => document.getElementById('nextBtn') || document.getElementById('retryBtn'), null, { timeout: 90000 });
  await sleep(500);
  let ev = await p.evaluate(() => window.__ev);
  console.log('events, level 1:', ev.map(e => e.name + ' ' + JSON.stringify(e.data)).join('\n  '));
  const prog = ev.filter(e => e.name.startsWith('progression_')).map(e => e.name);
  check(prog[0] === 'progression_started' && prog[1] === 'progression_completed' && prog.length === 2, `level 1: started then completed (${prog.join(', ')})`);
  const perf = ev.filter(e => e.name === 'performance_sample');
  check(perf.length === 1, `one performance_sample in a level of about 35 s of play (${perf.length})`);
  if (perf[0]) {
    const d = perf[0].data, missing = PERF_FIELDS.filter(f => !(f in d));
    check(!missing.length, 'performance_sample has every required field' + (missing.length ? ' (missing ' + missing.join(', ') + ')' : ''));
    check(d.active_ms >= 30000 && d.active_ms < 31000, `active_ms about 30 s (${d.active_ms})`);
    check(d.window_ms >= d.active_ms + 4500, `window_ms (${d.window_ms}) includes the 5 s pause, active_ms (${d.active_ms}) does not`);
    check(d.frames_over_1000ms === 0 && d.frame_time_max_ms < 1000, `the pause is not counted as a frozen frame (max frame ${d.frame_time_max_ms} ms)`);
    check(d.fps_p10 <= d.fps_avg && d.frame_time_p50_ms <= d.frame_time_p95_ms && d.frame_time_p95_ms <= d.frame_time_p99_ms, 'percentiles are in order');
  }
  // the result screen is not play: no sample is sent while it stays up
  await sleep(4000);
  check((await p.evaluate(() => window.__ev.filter(e => e.name === 'performance_sample').length)) === 1, 'no performance_sample while the result screen is up');

  // 2. crash and wall losses through the game's own levelFailed
  for (const [lv, reason] of [[7, 'crash'], [14, 'barricade']]) {
    await p.evaluate(lv => { window.__gh.setLevel(lv); }, lv); await sleep(1500);
    await p.evaluate(() => { window.__ev.length = 0; });
    await p.evaluate(r => window.__lf(r), reason); await sleep(300);
    ev = await p.evaluate(() => window.__ev);
    const f = ev.find(e => e.name === 'progression_failed');
    console.log(`events, level ${lv} ${reason}:`, JSON.stringify(ev.map(e => [e.name, e.data])));
    check(!!f && f.data.reason === reason && f.data.step_index === lv && f.data.level_id === lv && f.data.revived === false,
      `level ${lv}: progression_failed with reason ${reason}, level_id ${lv}, step_index ${lv}, revived false`);
  }

  // 3. names and bounds across the run
  const all = await p.evaluate(() => window.__ev);
  check(all.every(e => /^[a-z_]+$/.test(e.name)), 'event names are fixed snake_case, no numbers in names');
  check(all.filter(e => e.name.startsWith('progression_')).every(e => e.data.level_id >= 1 && e.data.level_id <= 20 && Number.isInteger(e.data.step_index)), 'level_id is within 1-20 and step_index is a whole number');
  check(p.errors.length === 0, 'no page errors' + (p.errors.length ? ': ' + p.errors.join(' | ') : ''));
  await b.close();
  console.log(fails.length ? `${fails.length} FAILED` : 'all passed');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

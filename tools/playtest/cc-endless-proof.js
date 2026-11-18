// Claude Code evidence script (Letter 017 step 2): endless levels and the save version.
// 1. Layout mapping: 21->11 ... 30->20, 31->11, 45->15: every level-config value equal (exposed in memory), same gate values.
// 2. Telemetry at level 23: level_id 13, step_index 23.
// 3. Winning level 20 (through the game's own levelClear, exposed in memory only): the button says "Level 21",
//    it starts level 21, and the save holds level 21 with gh_ver "1"; after a reload the game opens on level 21.
// 4. An old save without gh_ver (level 20, 1500 coins) still loads as level 20 with its coins.
// Bridge runs in mock mode on localhost; its storage is what the game reads and writes here.
// usage: node tools/playtest/cc-endless-proof.js
const { launch, phonePage, openReal } = require('./lib');
const EXPOSE = [['  window.GH = { pause: pauseGame,', '  window.__lc = levelClear; window.__cfg = function(n){ const c = levelCfg(n); const o = {}; for (const k in c) if (k !== "level") o[k] = c[k]; return JSON.stringify(o); }; window.GH = { pause: pauseGame,']];
const fails = []; const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const store = (p, keys) => p.evaluate(k => window.bridge.storage.get(k), keys);

(async () => {
  const b = await launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', e => p.errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') p.errors.push(m.text()); });
  const page = Object.assign(p, {});
  await page.addInitScript(() => {
    window.__ev = []; let real;
    Object.defineProperty(window, 'bridge', { configurable: true, get() { return real; }, set(v) {
      real = v;
      const desc = Object.getOwnPropertyDescriptor(v, 'analytics') || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(v), 'analytics');
      Object.defineProperty(v, 'analytics', { configurable: true, get() {
        const orig = desc.get ? desc.get.call(v) : desc.value;
        return new Proxy(orig, { get(t, k) { const val = Reflect.get(t, k);
          if (k === 'send') return (n, d) => { window.__ev.push({ name: n, data: JSON.parse(JSON.stringify(d || {})) }); return val.call(t, n, d); };
          return typeof val === 'function' ? val.bind(t) : val; } });
      } });
    } });
  });
  await openReal(page, '', EXPOSE);

  // 1. mapping
  const map = await page.evaluate(() => {
    const out = [];
    for (const [a, b] of [[21, 11], [25, 15], [30, 20], [31, 11], [45, 15], [100, 20]]) {
      const same = window.__cfg(a) === window.__cfg(b);
      out.push({ a, b, needA: window.__gh.needFor(a), needB: window.__gh.needFor(b), same });
    }
    const low = [1, 10, 19, 20].map(n => window.__gh.needFor(n));
    return { out, low };
  });
  map.out.forEach(r => check(r.same, `level ${r.a} uses level ${r.b}'s layout (need ${r.needA} = ${r.needB}; every config value equal)`));
  check(JSON.stringify(map.low) === JSON.stringify([580, 5580, 34710, 43720]), `levels 1-20 unchanged (needs at 1, 10, 19, 20: ${map.low.join(', ')})`);
  // gate values at 21 equal 11's (the gate table had its own cap at 20, now through the same slot)
  const gates = async lv => { await page.evaluate(n => window.__gh.setLevel(n), lv); await page.waitForFunction(() => window.__gh.gateInfo.length >= 3, null, { timeout: 15000 }); return page.evaluate(() => [...new Set(window.__gh.gateInfo.map(g => g.l))].sort()); };
  const g11 = await gates(11), g21 = await gates(21), g20 = await gates(20);
  console.log('gate labels  L11:', g11.join(' '), ' L21:', g21.join(' '), ' L20:', g20.join(' '));
  // only the + values: red /2 doors and x2 appear at random (redChance), so they say nothing about the layout
  const plus = g => g.filter(x => x[0] === '+');
  check(JSON.stringify(plus(g21)) === JSON.stringify(plus(g11)) && JSON.stringify(plus(g21)) !== JSON.stringify(plus(g20)),
    'level 21 gates show level 11 values, not level 20 values');

  // 2. telemetry at level 23
  await page.evaluate(() => { window.__ev.length = 0; window.__gh.setLevel(23); }); await sleep(300);
  const st = (await page.evaluate(() => window.__ev)).find(e => e.name === 'progression_started');
  check(!!st && st.data.level_id === 13 && st.data.step_index === 23, `level 23 telemetry: ${JSON.stringify(st && st.data)}`);

  // 3. win level 20 -> "Level 21" -> save and reload
  await page.evaluate(() => window.__gh.setLevel(20)); await sleep(800);
  await page.evaluate(() => window.__lc());
  await page.waitForFunction(() => !!document.getElementById('nextBtn'), null, { timeout: 20000 });
  const btn = await page.evaluate(() => document.getElementById('nextBtn').textContent);
  check(btn === 'Level 21', `after winning level 20 the button says "${btn}"`);
  await sleep(500);
  const saved = await store(page, ['gh_level', 'gh_ver']);
  check(String(saved[0]) === '21' && String(saved[1]) === '1', `save after the win: gh_level ${saved[0]}, gh_ver ${saved[1]}`);
  await page.click('#nextBtn'); await sleep(800);
  check((await page.evaluate(() => window.__gh.level)) === 21, 'the button starts level 21');
  await page.reload(); await page.waitForFunction(() => !!window.__gh && !!window.__ghBooted, null, { timeout: 30000 });
  check((await page.evaluate(() => window.__gh.level)) === 21, 'after a reload the game opens on level 21');

  // 4. an old save without gh_ver
  await page.evaluate(() => window.bridge.storage.delete(['gh_ver']).catch(() => {}));
  await page.evaluate(() => window.bridge.storage.set(['gh_level', 'gh_coins'], ['20', '1500']));
  const before = await store(page, ['gh_level', 'gh_coins', 'gh_ver']);
  console.log('old-format save written:', JSON.stringify(before));
  await page.reload(); await page.waitForFunction(() => !!window.__gh && !!window.__ghBooted, null, { timeout: 30000 });
  const loaded = await page.evaluate(() => ({ level: window.__gh.level, coins: document.getElementById('coinBoard') ? document.getElementById('coinBoard').textContent.replace(/\D/g, '') : null }));
  check(before[2] == null && loaded.level === 20 && loaded.coins === '1500', `old save without gh_ver loads as level ${loaded.level}, coins ${loaded.coins}`);
  check(page.errors.length === 0, 'no page errors' + (page.errors.length ? ': ' + page.errors.join(' | ') : ''));
  await b.close();
  console.log(fails.length ? `${fails.length} FAILED` : 'all passed');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

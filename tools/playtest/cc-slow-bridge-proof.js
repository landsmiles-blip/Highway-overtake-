// Claude Code evidence script (Letter 012 addendum 1, Letter 014): the slow-Bridge fix, tested on the SHIPPED build (dist/).
// Serves a dist/ folder locally, delays Bridge's initialize() by 0, 3 and 12 seconds, lets level 1 run to its end
// (which always saves), and counts storage.get and storage.set calls. Expected: 0 s and 3 s load and save normally;
// 12 s (past the shipped 10 s wait) starts the game without the save and then saves NOTHING, so a real save is never overwritten.
// usage: node tools/playtest/cc-slow-bridge-proof.js <dist-folder>
const fs = require('fs'), path = require('path'), http = require('http');
const { launch } = require('./lib');
const DIST = path.resolve(process.argv[2] || 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
const server = http.createServer((q, s) => {
  const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); } else { s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); } });
});
const fails = []; const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };

async function scenario(browser, port, delayMs) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(delay => {
    window.__calls = { get: 0, set: 0, initDone: null }; const t0 = performance.now();
    let real;
    Object.defineProperty(window, 'bridge', { configurable: true, get() { return real; }, set(v) {
      real = v; const init = v.initialize.bind(v);
      v.initialize = function () { return new Promise(r => setTimeout(r, delay)).then(() => init()).then(res => {
        window.__calls.initDone = Math.round(performance.now() - t0); return res; }); };
      // Bridge's `storage` is a Proxy that ignores methods added to it, so count calls by wrapping the getter itself.
      const desc = Object.getOwnPropertyDescriptor(v, 'storage') || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(v), 'storage');
      Object.defineProperty(v, 'storage', { configurable: true, get() {
        const orig = desc.get ? desc.get.call(v) : desc.value;
        return new Proxy(orig, { get(t, k) { const val = Reflect.get(t, k);
          if (k === 'get' || k === 'set') return (...a) => { window.__calls[k]++; return val.apply(t, a); };
          return typeof val === 'function' ? val.bind(t) : val; } });
      } });
    } });
  }, delayMs);
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  const t = Date.now();
  // the game has started when its title splash is gone (it drops 2.2 s after the load step finishes)
  await page.waitForFunction(() => !document.getElementById('titleSplash'), null, { timeout: 30000 });
  const startedAfter = ((Date.now() - t) / 1000).toFixed(1);
  // level 1 runs to its end with no input (about 35 s); the result screen means a save was attempted
  await page.waitForFunction(() => document.getElementById('nextBtn') || document.getElementById('retryBtn'), null, { timeout: 90000 });
  await new Promise(r => setTimeout(r, 1500));
  const c = await page.evaluate(() => window.__calls);
  await ctx.close();
  return { delayMs, startedAfter, ...c, errors: errors.length };
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('no index.html in ' + DIST);
  const shipped = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  console.log('shipped wait:', (shipped.match(/const LOAD_WAIT = [^;]*;/) || ['NOT FOUND'])[0]);
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
  const b = await launch({ headless: true });
  for (const d of [0, 3000, 12000]) {
    const r = await scenario(b, port, d);
    console.log(`Bridge delayed ${d / 1000} s: Bridge ready after ${r.initDone} ms, game started after ${r.startedAfter} s, storage.get ${r.get}, storage.set ${r.set}, page errors ${r.errors}`);
    if (d < 10000) check(r.get >= 1 && r.set >= 1 && r.errors === 0, `${d / 1000} s: progress loaded from Bridge and saved at the level's end`);
    else check(r.set === 0 && r.errors === 0, `${d / 1000} s: Bridge answered after the 10 s wait, game started anyway, and nothing was saved (no overwrite)`);
  }
  await b.close(); server.close();
  console.log(fails.length ? `${fails.length} FAILED` : 'all passed');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

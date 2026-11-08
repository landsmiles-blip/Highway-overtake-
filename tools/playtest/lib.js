// Shared set-up for the playtest scripts. Needs playwright-core and an installed
// Chrome. Nothing here edits gate-highway-prototype.html on disk.
//   npm i playwright-core   (outside the repo), then point NODE_PATH at it
//   CHROME_PATH overrides the browser location
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
// GH_PROTO points tests at a frozen copy, so edits to the game cannot disturb a long run.
const PROTO = process.env.GH_PROTO || path.join(ROOT, 'gate-highway-prototype.html');
const CHROME = process.env.CHROME_PATH ||
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const BOT = fs.readFileSync(path.join(__dirname, 'bot.js'), 'utf8');

// Runs between Three.js and the game script, only in fast mode: the game's clock
// and frame callback are stepped by hand, drawing is switched off, Math.random
// is seeded. update() itself is the shipped code.
const FAST_SHIM = `
<script>
(function(){
  let seed = (window.__seed || 12345) >>> 0;
  Math.random = function(){ seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ff = window.__ff = { now: 0, cbs: [] };
  performance.now = function(){ return ff.now; };
  window.requestAnimationFrame = function(cb){ ff.cbs.push(cb); return 1; };
  const Real = THREE.WebGLRenderer;
  THREE.WebGLRenderer = function(p){ const r = new Real(Object.assign({ preserveDrawingBuffer: true }, p)); const draw = r.render.bind(r); r.render = function(s, c){ if (ff.draw) draw(s, c); }; ff.r = r; return r; };
  ff.reseed = function(n){ seed = n >>> 0; };
  ff.step = function(dt){ ff.now += dt * 1000; const c = ff.cbs; ff.cbs = []; for (let i = 0; i < c.length; i++) c[i](ff.now); };
})();
</script>
`;

async function launch(opts = {}) {
  return chromium.launch({
    executablePath: CHROME,
    headless: !!opts.headless,
    args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-background-timer-throttling',
           '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  });
}

async function phonePage(browser, w = 390, h = 844, dpr = 3) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: true, isMobile: w < h,
  });
  const page = await ctx.newPage();
  page.errors = []; page.net = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text() + ' @ ' + m.location().url); });
  page.on('request', r => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith('http://127.0.0.1')) page.net.push(u); });
  return page;
}

// A tiny local web server, so sound files load the way they do online.
let server = null, serverPort = 0;
function serve() {
  if (server) return Promise.resolve(serverPort);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
  server = require('http').createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const f = u === '/gate-highway-prototype.html' ? PROTO : path.join(process.env.GH_ROOT || ROOT, u);
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(d); } });
  });
  server.unref();
  return new Promise(r => server.listen(0, '127.0.0.1', () => { serverPort = server.address().port; r(serverPort); }));
}

// Normal mode: the file exactly as it is on disk, served locally.
async function openReal(page, query = '') {
  const port = await serve();
  await page.goto(`http://127.0.0.1:${port}/gate-highway-prototype.html${query}`);
  await page.addScriptTag({ content: BOT });
  await page.waitForFunction(() => !!window.__gh && !!window.__ghBooted);
}

// Fast mode: same file, shim added in memory only.
// patches: optional [find, replace] text pairs applied to the game in memory only,
// for one-at-a-time experiments. A find that matches nothing is an error.
async function openFast(page, seed, patches = []) {
  let src = fs.readFileSync(PROTO, 'utf8');
  for (const [find, rep] of patches) {
    if (!src.includes(find)) throw new Error('patch target not found: ' + find);
    src = src.replace(find, rep);
  }
  const lines = src.split('\n');
  const idx = lines.findIndex((l, i) => i > 335 && l.trim() === '<script>');
  if (idx < 0) throw new Error('game script tag not found');
  lines.splice(idx, 0, `<script>window.__seed=${seed};</script>` + FAST_SHIM);
  const dir = process.env.PLAYTEST_TMP || path.join(require('os').tmpdir(), 'gh-playtest');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `fast-${seed}-${process.pid}.html`);
  fs.writeFileSync(f, lines.join('\n'));
  await page.goto('file:///' + f.replace(/\\/g, '/'));
  await page.addScriptTag({ content: BOT });
  await page.waitForFunction(() => !!window.__gh && !!window.__ff);
}

module.exports = { launch, phonePage, openReal, openFast, serve, ROOT, PROTO };

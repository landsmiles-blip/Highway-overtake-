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

// Applies [find, replace] text pairs to the game source in memory only. A find that matches
// nothing is an error, so a changed game cannot silently turn a test into a no-op.
function applyPatches(src, patches) {
  for (const [find, rep] of patches) {
    if (!src.includes(find)) throw new Error('patch target not found: ' + find);
    src = src.replace(find, rep);
  }
  return src;
}

// Test-only hook, added in memory (the game file is not edited): where the player's car is on
// screen, in CSS pixels, from the visible meshes only. Used to check the car stays clear of the buttons.
const CAR_RECT_PATCH = [['  window.__gh = {\n    get state(){ return state; },', `  window.__gh = {
    carRect: function(){
      const box = new THREE.Box3(); player.group.updateMatrixWorld(true);
      player.group.traverse(function(o){
        if (!o.isMesh || !o.geometry) return;
        let p = o, vis = true;
        while (p && p !== player.group.parent){ if (!p.visible){ vis = false; break; } p = p.parent; }
        if (!vis) return;
        o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
      });
      camera.updateMatrixWorld(); const el = renderer.domElement.getBoundingClientRect();
      let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
      for (let i = 0; i < 8; i++){
        const v = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
        const x = el.left + (v.x + 1) / 2 * el.width, y = el.top + (1 - v.y) / 2 * el.height;
        l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
      }
      return { l: l, t: t, r: r, b: b };
    },
    get state(){ return state; },`]];

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
const served = new Map();   // url path -> in-memory game source (patched or shimmed); anything else comes from disk
function serve() {
  if (server) return Promise.resolve(serverPort);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
  server = require('http').createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    if (served.has(u)) { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(served.get(u)); }
    const f = u === '/gate-highway-prototype.html' ? PROTO : path.join(process.env.GH_ROOT || ROOT, u);
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(d); } });
  });
  server.unref();
  return new Promise(r => server.listen(0, '127.0.0.1', () => { serverPort = server.address().port; r(serverPort); }));
}

// Normal mode: the file exactly as it is on disk, served locally.
// patches: optional [find, replace] pairs applied in memory (for example CAR_RECT_PATCH); without
// them the file is served exactly as it is on disk.
async function openReal(page, query = '', patches = []) {
  const port = await serve();
  if (patches.length) served.set('/gate-highway-prototype.html', applyPatches(fs.readFileSync(PROTO, 'utf8'), patches));
  else served.delete('/gate-highway-prototype.html');
  await page.goto(`http://127.0.0.1:${port}/gate-highway-prototype.html${query}`);
  await page.addScriptTag({ content: BOT });
  await page.waitForFunction(() => !!window.__gh && !!window.__ghBooted);
}

// Fast mode: same file, shim added in memory only.
// patches: optional [find, replace] text pairs applied to the game in memory only,
// for one-at-a-time experiments. A find that matches nothing is an error.
async function openFast(page, seed, patches = []) {
  const src = applyPatches(fs.readFileSync(PROTO, 'utf8'), patches);
  const lines = src.split('\n');
  const idx = lines.findIndex((l, i) => i > 335 && l.trim() === '<script>');
  if (idx < 0) throw new Error('game script tag not found');
  lines.splice(idx, 0, `<script>window.__seed=${seed};</script>` + FAST_SHIM);
  // Served over local HTTP like openReal, so the game finds Bridge and its config next to it
  // and Bridge's config fetch is allowed. It used to be a temp file: Bridge was left behind, and
  // every batch logged "file not found" errors, so the pause, mute and save path never ran in fast mode.
  const port = await serve(), url = `/fast-${seed}-${process.pid}.html`;
  served.set(url, lines.join('\n'));
  await page.goto(`http://127.0.0.1:${port}${url}`);
  await page.addScriptTag({ content: BOT });
  await page.waitForFunction(() => !!window.__gh && !!window.__ff);
}

module.exports = { launch, phonePage, openReal, openFast, serve, applyPatches, CAR_RECT_PATCH, ROOT, PROTO };

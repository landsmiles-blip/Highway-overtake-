#!/usr/bin/env node
// Makes the Playgama build: dist/ and gate-highway-<version>.zip, with index.html at the
// zip root. Test hooks are removed here, so the source keeps them for the test tools.
// usage: node tools/ship/build.js <version>
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..', '..'), version = process.argv[2] || '1.0.0';
const dist = path.join(root, 'dist'); fs.rmSync(dist, { recursive: true, force: true }); fs.mkdirSync(dist);
let src = fs.readFileSync(path.join(root, 'gate-highway-prototype.html'), 'utf8');

// strip test code
const before = src.length;
src = src.replace(/\/\*SHIP-STRIP-START\*\/[\s\S]*?\/\*SHIP-STRIP-END\*\//g, '');
src = src.replace("const QS = new URLSearchParams(location.search);", "const QS = new URLSearchParams('');");
src = src.replace(/^\s*if\(!window\.__lineTakes\[g\.lineId\]\)\{\n[^\n]*\n[^\n]*\n\s*\}\n/m, '');
src = src.replace(/^\s*window\.__lineTakes.*\n/gm, '').replace(/^\s*window\.__lastLine.*\n/gm, '');
src = src.replace("window.__ghBooted = true;", '');
for (const bad of ['window.__gh ', 'window.__lineTakes', 'window.__skipped', 'benchStart = ', 'fonts.googleapis']) {
  if (bad !== 'benchStart = ' && src.includes(bad)) throw new Error('left in ship build: ' + bad);
}
fs.writeFileSync(path.join(dist, 'index.html'), src);
for (const f of ['playgama-bridge.js', 'playgama-bridge-config.json']) fs.copyFileSync(path.join(root, f), path.join(dist, f));
fs.mkdirSync(path.join(dist, 'assets', 'audio'), { recursive: true });
for (const f of fs.readdirSync(path.join(root, 'assets', 'audio'))) if (/\.(ogg|mp3)$/.test(f)) fs.copyFileSync(path.join(root, 'assets', 'audio', f), path.join(dist, 'assets', 'audio', f));
fs.mkdirSync(path.join(dist, 'licenses'));
for (const f of ['fonts/OFL-Orbitron.txt', 'fonts/OFL-Rajdhani.txt', 'LICENSE-playgama-bridge.txt']) fs.copyFileSync(path.join(root, 'assets', f), path.join(dist, 'licenses', path.basename(f)));
fs.copyFileSync(path.join(root, 'assets', 'audio', 'SOURCES.md'), path.join(dist, 'licenses', 'AUDIO-SOURCES.md'));

// External calls check over every shipped text file. index.html is scanned in full, including the
// font line and the Three.js line (its only URLs are www.w3.org XML namespaces, not calls). Bridge
// names many platform hosts; its list is pinned, so a changed or swapped Bridge fails here and a
// person has to look. Other text files (licences) are listed, not pinned.
const URL_RE = /https?:\/\/[^\s"'`)<>\\]+/g;
const hostsOf = t => [...new Set((t.match(URL_RE) || []).map(u => { try { return new URL(u).host; } catch (e) { return u; } }))].sort();
const PINNED = {
  'index.html': ['www.w3.org'],
  'playgama-bridge.js': ['api.playgama.com', 'assets.msn.com', 'cdn.discordapp.com', 'cdn.xsolla.net', 'cdn.y8.com', 'connect.facebook.net',
    'discord.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'game-cdn.poki.com', 'gamepush.com', 'games.playgama.com', 'gtg.samsungapps.com',
    'html5.api.gamedistribution.com', 'jiogames.akamaized.net', 'lagged.com', 'pagead2.googlesyndication.com', 'playgama.com', 'sad.adsgram.ai',
    'sdk.crazygames.com', 'storage.googleapis.com', 'store.xsolla.com', 'telegram.org', 'unpkg.com', 'vk.com', 'www.hippoobox.com', 'www.w3.org'],
};
const urlProblems = [];
(function scan(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { scan(p); continue; }
    if (!/\.(html|js|json|md|txt)$/.test(e.name)) continue;
    const rel = path.relative(dist, p).replace(/\\/g, '/'), hosts = hostsOf(fs.readFileSync(p, 'utf8')), pinned = PINNED[rel];
    const extra = pinned ? hosts.filter(h => !pinned.includes(h)) : [];
    console.log('urls in ' + rel + ':', hosts.length ? hosts.join(', ') : 'none', pinned ? (extra.length ? '  UNEXPECTED: ' + extra.join(', ') : '  (as pinned)') : '  (not pinned)');
    if (extra.length) urlProblems.push(rel + ': ' + extra.join(', '));
  }
})(dist);
if (urlProblems.length) throw new Error('unexpected outside hosts in the ship build: ' + urlProblems.join('; '));

const zip = path.join(root, `gate-highway-${version}.zip`); fs.rmSync(zip, { force: true });
// Windows PowerShell's Compress-Archive writes backslashes in paths, which breaks on Linux
// servers. This writes every entry with forward slashes.
const ps = `Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::Open('${zip}','Create'); Get-ChildItem -Recurse -File '${dist}' | ForEach-Object { $n=$_.FullName.Substring('${dist}'.Length+1).Replace('\\','/'); [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z,$_.FullName,$n) }; $z.Dispose()`;
const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
if (r.status !== 0 || r.stderr) throw new Error(r.stderr);
let size = 0; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else size += fs.statSync(p).size; } })(dist);
console.log('dist', (size / 1048576).toFixed(2), 'MB; zip', (fs.statSync(zip).size / 1048576).toFixed(2), 'MB');
console.log('stripped', before - src.length, 'bytes of test code');

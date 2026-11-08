// Builds the game's audio from the source recordings. Every source is CC0, except
// Mumathai's two music tracks. Each output comes as .ogg and .mp3.
// usage: node build.js <sourceDir> <repoRoot>
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const [src, root] = process.argv.slice(2);
const out = path.join(root, 'assets', 'audio'); fs.mkdirSync(out, { recursive: true });
const K = d => path.join(src, 'kenney', d), FS = d => path.join(src, 'fs', d);

// name: [source file, start second, length seconds, target peak in dB]
const EFFECTS = {
  door:   [K('music-jingles/jingles_STEEL08.ogg'), 0, 0.7, -3],
  x2:     [K('music-jingles/jingles_STEEL03.ogg'), 0, 1.5, -2],
  clear:  [K('music-jingles/jingles_STEEL07.ogg'), 0, 2.5, -2],
  tier:   [K('music-jingles/jingles_STEEL11.ogg'), 0, 1.0, -4],
  red:    [K('interface-sounds/error_004.ogg'), 0, 0.5, -3],
  click:  [K('interface-sounds/click_002.ogg'), 0, 0.2, -6],
  bump:   [K('impact-sounds/impactSoft_heavy_001.ogg'), 0, 0.5, -3],
  smash:  [FS('crash/qubodup-151624.mp3'), 0, 0.54, -3],
  crash:  [FS('crash/magnuswaker-592388.mp3'), 0, 2.5, -1],
  wall:   [FS('crash/PauliusI-346299.mp3'), 3.4, 3.2, -1],
};
function pcm(file, start, len, rate = 44100) {
  const a = ['-v', 'error', '-ss', String(start || 0)]; a.push('-i', file); if (len) a.push('-t', String(len));
  a.push('-ac', '1', '-ar', String(rate), '-f', 'f32le', '-');
  const r = spawnSync('ffmpeg', a, { maxBuffer: 1 << 30 });
  if (r.status !== 0 || !r.stdout.length) throw new Error('cannot read ' + file);
  return new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.length));
}
function encode(x, name, rate = 44100) {
  const raw = path.join(src, name + '.raw'); fs.writeFileSync(raw, Buffer.from(x.buffer, x.byteOffset, x.byteLength));
  for (const [ext, q] of [['.ogg', ['-c:a', 'libvorbis', '-q:a', '3']], ['.mp3', ['-c:a', 'libmp3lame', '-b:a', '96k']]]) {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(rate), '-ac', '1', '-i', raw, ...q, path.join(out, name + ext)]);
    if (r.status !== 0) throw new Error(String(r.stderr));
  }
  fs.unlinkSync(raw);
}
function shape(x, peakDb) {
  // drop leading silence, fade the end, set the peak
  let s = 0; while (s < x.length && Math.abs(x[s]) < 0.01) s++;
  let y = x.slice(Math.max(0, s - 40));
  const f = Math.min(2205, y.length >> 2); for (let i = 0; i < f; i++) y[y.length - 1 - i] *= i / f;
  let p = 0; for (const v of y) p = Math.max(p, Math.abs(v));
  const g = Math.pow(10, peakDb / 20) / Math.max(p, 1e-6); for (let i = 0; i < y.length; i++) y[i] *= g;
  return y;
}
for (const [name, [file, st, len, peak]] of Object.entries(EFFECTS)) encode(shape(pcm(file, st, len), peak), name);

// Whoosh: the rising and falling air of a car going past, shaped from filtered noise.
{
  const n = 22050, x = new Float32Array(n); let lp = 0, seed = 7;
  for (let i = 0; i < n; i++) {
    seed = (seed * 16807) % 2147483647; const w = seed / 1073741823.5 - 1, p = i / n;
    const c = 0.05 + 0.5 * Math.sin(Math.PI * p); lp += (w - lp) * c;
    x[i] = lp * Math.pow(Math.sin(Math.PI * p), 2);
  }
  encode(shape(x, -6), 'whoosh');
}

// Engine: a real Peugeot 308 (Nox_Sound, Rode NTG4+), cut to 6 s with a crossfade so
// the loop has no click. The bright part is what a phone speaker can actually play.
{
  const a = pcm(FS('engine/Nox_Sound-522225.mp3'), 8, 6.25), xf = Math.floor(0.25 * 44100), n = a.length - xf, y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = a[i];
  for (let i = 0; i < xf; i++) { const t = i / xf; y[i] = a[i] * t + a[n + i] * (1 - t); }
  let p = 0; for (const v of y) p = Math.max(p, Math.abs(v));
  const g = Math.pow(10, -3 / 20) / p; for (let i = 0; i < n; i++) y[i] *= g;
  encode(y, 'engine');
}

// Music: Mumathai's two tracks, stereo, peak set near the top, nothing else changed.
for (const [wav, name] of [['highway-overtake-take2-steelpan-128bpm.wav', 'music-steelpan'], ['highway-overtake-song1-take1-126bpm.wav', 'music-song1']]) {
  for (const [ext, q] of [['.ogg', ['-c:a', 'libvorbis', '-q:a', '3']], ['.mp3', ['-c:a', 'libmp3lame', '-b:a', '112k']]]) {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(root, wav), '-af', 'volume=1.5dB', ...q, path.join(out, name + ext)]);
    if (r.status !== 0) throw new Error(String(r.stderr));
  }
}
let total = 0; for (const f of fs.readdirSync(out)) { const s = fs.statSync(path.join(out, f)).size; total += s; console.log(f.padEnd(24), Math.round(s / 1024) + ' KB'); }
console.log('total', (total / 1048576).toFixed(2), 'MB');

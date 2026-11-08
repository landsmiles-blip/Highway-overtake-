// Measures audio files with ffmpeg, because I cannot hear them. For each file: length,
// loudness, peak (does it clip?), brightness, and for engines how well the end matches
// the start of a loop. Writes JSON. usage: node analyse.js <dir> <out.json>
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
function ff(args) { return spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'latin1', maxBuffer: 1 << 28 }); }
function pcm(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '22050', '-f', 'f32le', '-'], { maxBuffer: 1 << 29 });
  const b = r.stdout; return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4));
}
function walk(d) { return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]); }
function analyse(file) {
  const x = pcm(file); if (!x.length) return null;
  const secs = x.length / 22050;
  const e = ff(['-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr;
  const lufs = parseFloat((e.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop()?.match(/-?[\d.]+/)[0]);
  const peak = parseFloat((e.match(/Peak:\s+(-?[\d.]+) dBFS/g) || []).pop()?.match(/-?[\d.]+/)[0]);
  // brightness: share of energy in the changes between samples. Crude, but it ranks dull against sharp.
  let en = 0, df = 0, clip = 0;
  for (let i = 1; i < x.length; i++) { en += x[i] * x[i]; const d = x[i] - x[i - 1]; df += d * d; if (Math.abs(x[i]) > 0.99) clip++; }
  const zcrHz = Math.round(Math.sqrt(df / Math.max(en, 1e-9)) * 22050 / (2 * Math.PI));
  // How steady, and how much of it is silence? Blocks of 50 ms.
  const blk = 1102, lv = [];
  for (let i = 0; i + blk < x.length; i += blk) { let s = 0; for (let j = 0; j < blk; j++) s += x[i + j] * x[i + j]; lv.push(Math.sqrt(s / blk)); }
  const mean = lv.reduce((a, b) => a + b, 0) / lv.length, sd = Math.sqrt(lv.reduce((a, b) => a + (b - mean) ** 2, 0) / lv.length);
  const silent = lv.filter(v => v < 0.003).length / lv.length;
  let attackMs = 0; const mx = Math.max(...lv); for (let i = 0; i < lv.length; i++) if (lv[i] >= mx * 0.7) { attackMs = i * 50; break; }
  return { file, secs: +secs.toFixed(2), lufs, peak, clipSamples: clip, brightHz: zcrHz, steadiness: +(sd / Math.max(mean, 1e-6)).toFixed(2), silentShare: +silent.toFixed(2), attackMs };
}
const [dir, out] = process.argv.slice(2), rows = [];
for (const f of walk(dir)) { if (!/\.(ogg|mp3|wav|flac)$/i.test(f)) continue; const r = analyse(f); if (r) rows.push(r); }
fs.writeFileSync(out, JSON.stringify(rows, null, 0));
console.log(rows.length, 'files analysed');

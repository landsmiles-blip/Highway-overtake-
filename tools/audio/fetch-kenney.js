// Downloads Kenney's free CC0 audio packs through their own download button.
// usage: node fetch-kenney.js <outDir>   (needs playwright-core on NODE_PATH and Chrome)
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const PACKS = ['impact-sounds', 'interface-sounds', 'digital-audio', 'music-jingles'];
(async () => {
  const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: CHROME, headless: true });
  const c = await b.newContext({ acceptDownloads: true }); const p = await c.newPage();
  for (const k of PACKS) {
    await p.goto('https://kenney.nl/assets/' + k, { waitUntil: 'domcontentloaded' });
    const [d] = await Promise.all([
      p.waitForEvent('download', { timeout: 60000 }),
      p.evaluate(() => { const a = document.getElementById('donate-text'); window.initiateDownload(a); }),
    ]);
    const f = path.join(out, k + '.zip'); await d.saveAs(f);
    console.log(k, Math.round(fs.statSync(f).size / 1024) + ' KB', d.url());
  }
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });

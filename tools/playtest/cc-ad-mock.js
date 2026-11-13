// Claude Code evidence script (Letter 011 addendum 1, Letter 012): interstitial ads in Bridge mock mode.
// Opens the real game over local HTTP (Bridge loads in mock mode), records every interstitial, pause and audio state
// change with a time stamp, then: loses a level (result screen -> ad), wins one (result screen -> ad, likely held back by
// Bridge's minimum delay), waits past 60 s and loses again. Also records outside requests and page errors.
// usage: node tools/playtest/cc-ad-mock.js [out.json]
const fs = require('fs');
const { launch, phonePage, openReal } = require('./lib');

(async () => {
  const b = await launch({ headless: true }), page = await phonePage(b, 390, 844, 1); await openReal(page);
  const t0 = Date.now(), stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
  // wait for Bridge, then subscribe to its events (game handlers stay in place)
  await page.waitForFunction(() => window.bridge && window.bridge.isInitialized, null, { timeout: 15000 }).catch(() => {});
  const info = await page.evaluate(() => {
    window.__adLog = []; const b = window.bridge, t0 = performance.now(), at = () => ((performance.now() - t0) / 1000).toFixed(1) + 's';
    if (!b) return { bridge: false };
    b.advertisement.on(b.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, s => window.__adLog.push(at() + ' interstitial ' + s));
    b.platform.on(b.EVENT_NAME.PAUSE_STATE_CHANGED, p => window.__adLog.push(at() + ' pause ' + p));
    b.platform.on(b.EVENT_NAME.AUDIO_STATE_CHANGED, a => window.__adLog.push(at() + ' audio ' + a));
    return { bridge: true, platform: b.platform.id, supported: b.advertisement.isInterstitialSupported, minDelay: b.advertisement.minimumDelayBetweenInterstitial, stateAtStart: b.advertisement.interstitialState };
  });
  console.log('[' + stamp() + '] bridge:', JSON.stringify(info));
  const log = async label => { const l = await page.evaluate(() => window.__adLog.splice(0)); console.log('[' + stamp() + '] ' + label + ':', l.length ? l.join(' | ') : '(no events)'); return l; };
  const lose = async () => {
    await page.evaluate(() => { window.__gh.setLevel(5); window.__gh.setMass(window.__gh.need * 2); });
    await page.waitForFunction(() => window.__gh.levelProgress > 0.5 || window.__gh.state !== 'playing', null, { timeout: 40000, polling: 100 });
    await page.evaluate(() => { window.__gh.setMass(100); window.__gh.dropCarAhead('bus'); });
    await page.waitForFunction(() => document.getElementById('retryBtn'), null, { timeout: 8000 });
    await new Promise(r => setTimeout(r, 4000));
  };
  const out = { info, steps: [] };
  await lose(); out.steps.push({ step: 'lose 1', events: await log('after losing level 5 (result screen shown)'), state: await page.evaluate(() => window.__gh.state) });
  await page.screenshot({ path: (process.argv[2] || 'cc-ad-mock') + '-lose1.png' }).catch(() => {});
  // win: jump to the wall heavy enough to smash it, wait for the result screen
  await page.evaluate(() => { window.__gh.setLevel(2); });
  await page.evaluate(() => window.__gh.jumpToBarricade(window.__gh.need * 2));
  await page.waitForFunction(() => document.getElementById('nextBtn'), null, { timeout: 20000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 4000));
  out.steps.push({ step: 'win', events: await log('after winning level 2 (result screen shown)'), nextBtn: await page.evaluate(() => !!document.getElementById('nextBtn')) });
  console.log('[' + stamp() + '] waiting 62 s for Bridge\'s minimum delay to pass');
  await new Promise(r => setTimeout(r, 62000));
  await lose(); out.steps.push({ step: 'lose 2', events: await log('after losing level 5 again, past 60 s') });
  out.pageErrors = page.errors; out.outsideRequests = page.net;
  console.log('[' + stamp() + '] page errors:', JSON.stringify(page.errors), '| outside requests:', JSON.stringify(page.net));
  if (process.argv[2]) fs.writeFileSync(process.argv[2] + '.json', JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

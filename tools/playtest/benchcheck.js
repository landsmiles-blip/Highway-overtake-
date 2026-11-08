// Runs the phone benchmark end to end on this PC, to prove it works before asking
// Mumathai to run it. Also asserts no outside requests. usage: node benchcheck.js <out.png>
const { launch, phonePage, PROTO } = require('./lib');
(async () => {
  const b = await launch(); const p = await phonePage(b, 360, 800, 2);
  await p.goto('file:///' + PROTO.replace(/\\/g, '/') + '?bench=1');
  await p.waitForFunction(() => /screenshot this/.test(document.body.innerText), null, { timeout: 240000, polling: 500 });
  await p.screenshot({ path: process.argv[2] });
  console.log(await p.evaluate(() => document.body.innerText));
  console.log('errors', JSON.stringify(p.errors), 'outside requests', JSON.stringify(p.net));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });

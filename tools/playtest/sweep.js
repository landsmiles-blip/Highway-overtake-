// Tries values of one game constant in the real game code, without editing the file.
// usage: node sweep.js <CONST_NAME> <v1,v2,...> [levels] [runs] [profile]
const path = require('path');
const { launch, phonePage, openFast } = require('./lib');

function run({ level, runs, profile }) {
  const g = window.__gh, ff = window.__ff, DT = 1 / 60, bot = window.__botMake(profile);
  ff.reseed(level * 131 + 9);
  let win = 0, crash = 0, wall = 0, mass = 0, surv = 0;
  for (let r = 0; r < runs; r++) {
    bot.reset(); g.setLevel(level); const bz = g.barricadeZ; let z = 0, m = 0, s = 0;
    while (g.state === 'playing' && s++ < 7200) { ff.step(DT); bot.tick(DT); z = g.playerZ; m = g.mass; }
    const near = Math.abs(z - bz) < 12;
    if (near && m >= g.need) win++; else if (near) wall++; else crash++;
    if (near) { mass += m / g.need; surv++; }
    for (let i = 0; i < 3; i++) ff.step(DT);
  }
  return { level, win: Math.round(win * 100 / runs), crash: Math.round(crash * 100 / runs), wall: Math.round(wall * 100 / runs), massOverNeed: surv ? +(mass / surv).toFixed(2) : null };
}

(async () => {
  const [name, vals, levelsS, runsS, profile] = process.argv.slice(2);
  const levels = (levelsS || '3,5,8,12,20').split(',').map(Number), runs = Number(runsS || 60);
  const browser = await launch({ headless: true });
  const src = require('fs').readFileSync(process.env.GH_PROTO || path.join(__dirname, '..', '..', 'gate-highway-prototype.html'), 'utf8');
  const m = src.match(new RegExp('const ' + name + ' = ([\\d.]+);'));
  if (!m) throw new Error(name + ' not found as a simple constant');
  for (const v of vals.split(',')) {
    const page = await phonePage(browser, 390, 844, 1);
    await openFast(page, 21, [[m[0], 'const ' + name + ' = ' + v + ';']]); page.setDefaultTimeout(600000);
    const out = [];
    for (const level of levels) out.push(await page.evaluate(run, { level, runs, profile: profile || 'average' }));
    console.log(name + '=' + v + '  ' + out.map(o => `L${o.level}: win ${o.win} crash ${o.crash} wall ${o.wall} mass/need ${o.massOverNeed}`).join(' | '));
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

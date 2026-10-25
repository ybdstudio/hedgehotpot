#!/usr/bin/env node
/* Economy / pacing simulator. Runs the REAL game logic (js/*.js) headless with the autoplay bot
   and reports when every task, unlock and phase is reached.
   Usage: node tools/sim.js [--seeds 5] [--minutes 60] [--skill 1] [--json out.json] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const args = process.argv.slice(2); const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const SEEDS = +arg('seeds', 5), MINUTES = +arg('minutes', 60), SKILL = +arg('skill', 1), OUT = arg('json', null), VERBOSE = args.includes('--verbose');

function makeGame(seed) {
  const ctx = { console, Math, Date, JSON, globalThis: null };
  ctx.globalThis = ctx; ctx.window = undefined; vm.createContext(ctx);
  for (const f of ['config.js', 'nav.js', 'conveyor.js', 'game.js', 'bot.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
  const CST = ctx.CST;
  const g = new CST.Game({ seed, headless: true, load: false });
  return { g, bot: new CST.Bot(g, { skill: SKILL }), CST };
}

function run(seed) {
  const { g, bot, CST } = makeGame(seed);
  const dt = 1 / (+arg('hz', 20)), end = MINUTES * 60;
  const events = []; const unlockAt = {}; const taskAt = []; const phaseAt = { 1: 0 };
  g.on('task', e => { taskAt.push({ i: g.S.taskIndex - 1, t: g.S.time, name: e.done.t }); const ph = g.phase; if (!(ph in phaseAt)) phaseAt[ph] = g.S.time; });
  g.on('unlock', u => { unlockAt[u.id] = g.S.time; });
  g.on('complete', () => events.push({ t: g.S.time, e: 'complete' }));
  let idle = 0, lastCoins = [], purchases = [];
  g.on('unlock', u => purchases.push(g.S.time)); g.on('upgrade', k => purchases.push(g.S.time));
  let maxPlates = 0, dupCheck = new Set(), dupErr = 0;
  const earnedByMin = [];
  while (g.S.time < end && !g.S.done) {
    if (g.S.time >= earnedByMin.length * 60) earnedByMin.push(g.stat('earned'));
    const v = bot.update(dt); g.movePlayer(v.x, v.y, dt); g.update(dt);
    // invariant: no plate on two belts / duplicated
    if (Math.round(g.S.time * 20) % 40 === 0) {
      const ids = g.conv.allPlates().map(p => p.id); if (new Set(ids).size !== ids.length) dupErr++;
      for (const id in g.conv.belts) { const b = g.conv.belts[id]; if (b.plates.length > b.cap) dupErr++; maxPlates = Math.max(maxPlates, b.plates.length); }
      for (const c of g.customers) if (c.plate && c.plate.state === 'ON_CONVEYOR') dupErr++;
    }
  }
  purchases.sort((a, b) => a - b);
  const gaps = purchases.map((t, i) => t - (purchases[i - 1] || 0));
  return { seed, earnedByMin, done: g.S.done, time: g.S.time, taskAt, unlockAt, phaseAt, stats: g.S.stats, coins: g.S.coins, stars: g.S.stars,
    purchases: purchases.length, maxGap: Math.max(...gaps), avgGap: purchases.length ? purchases[purchases.length - 1] / purchases.length : 0, dupErr, maxPlates };
}

const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const results = [];
for (let i = 0; i < SEEDS; i++) {
  const r = run(1000 + i * 7919); results.push(r);
  console.log(`seed ${r.seed}: ${r.done ? 'COMPLETED' : 'not completed'} at ${fmt(r.time)} | tasks ${r.taskAt.length} | purchases ${r.purchases} avg gap ${r.avgGap.toFixed(0)}s max gap ${r.maxGap.toFixed(0)}s | paid ${r.stats.paid || 0} angry ${r.stats.angry || 0} | dupErr ${r.dupErr} | chefServed ${r.stats.chefServed || 0} tableServed ${r.stats.tableServed || 0}`);
  if (VERBOSE) { const e = r.earnedByMin; let line = '   income/min by 5-min block:'; for (let m = 5; m < e.length; m += 5) line += ' ' + Math.round((e[m] - e[m - 5]) / 5); console.log(line); }
  if (VERBOSE) r.taskAt.forEach(t => console.log(`   ${fmt(t.t)}  #${t.i + 1} ${t.name}`));
}
// phase table (median)
const med = a => { a = a.filter(x => x !== undefined).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : undefined; };
console.log('\nPhase reached (median over seeds):');
for (let p = 1; p <= 8; p++) { const m = med(results.map(r => r.phaseAt[p])); console.log(`  Phase ${p}: ${m === undefined ? '—' : fmt(m)}`); }
console.log('\nTask completion (median):');
const C = require(path.join(__dirname, '..', 'js', 'config.js')).CONFIG;
C.TASKS.forEach((t, i) => { const m = med(results.map(r => (r.taskAt.find(x => x.i === i) || {}).t)); console.log(`  ${String(i + 1).padStart(2)}. ${fmt(m || 0).padStart(6)}  ${t.t}`); });
if (OUT) fs.writeFileSync(OUT, JSON.stringify(results, null, 1));

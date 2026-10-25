#!/usr/bin/env node
/* Automated browser test (Playwright + Chromium, iPhone 13 emulation).
   Usage: node tests/browser_test.js http://localhost:8765/ [outDir]
   Fast-forwards the REAL game inside the page (bot + game.update) and checks the 14 required behaviours. */
const { chromium, devices } = require(process.env.PW || 'playwright');
const fs = require('fs'), path = require('path');
const BASE = (process.argv[2] || 'http://localhost:8765/').replace(/\/?$/, '/');
const OUT = process.argv[3] || path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const results = []; const rec = (id, name, pass, detail) => { results.push({ id, name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}. ${name} — ${detail}`); };

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE + 'index.html?autostart=1&fresh=1'); await page.waitForFunction(() => window.__game, null, { timeout: 20000 });
  await page.waitForTimeout(800);
  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png') });
  // fast-forward helper: run the real game + autoplay bot inside the page
  const ff = (sec, opts = {}) => page.evaluate(([sec, opts]) => {
    const g = window.__game, CST = window.CST; window.__bot = window.__bot || new CST.Bot(g); const bot = window.__bot; const dt = 1 / 30;
    window.__chk = window.__chk || { wrongPick: 0, dup: 0, overCap: 0, picks: 0 };
    if (!g.__wrapped) {   // verify every pickup: customer must be waiting and want that recipe
      const orig = g.tryPickup.bind(g); g.__wrapped = true;
      g.tryPickup = (belt, plate, s0, s1) => { const before = plate.state; const r = orig(belt, plate, s0, s1);
        if (r) { window.__chk.picks++; const c = g.customers.find(c => c.id === plate.takenBy); if (!c || !c.wish.includes(plate.recipe) || before !== 'ON_CONVEYOR') window.__chk.wrongPick++; } return r; };
    }
    const end = g.S.time + sec; let n = 0;
    while (g.S.time < end && !(opts.untilDone && g.S.done)) {
      const v = bot.update(dt); g.movePlayer(v.x, v.y, dt); g.update(dt);
      for (const c of g.customers) if (c.kind !== 'reg' && c.state === 'SIT' && !c._vipSeen) { c._vipSeen = 1; const ch = window.__chk; ch.vip = (ch.vip || 0) + 1; if (!c.seat.vip || c.seat.kind !== c.kind) ch.vipWrong = (ch.vipWrong || 0) + 1; ch.vipFrames = ch.vipFrames || {}; ch.vipFrames[c.kind] = CST.Anim.frame(c.char, 'sit', 'front', 0).key; }
      if (++n % 30 === 0) { const ids = g.conv.allPlates().map(p => p.id); if (new Set(ids).size !== ids.length) window.__chk.dup++; for (const k in g.conv.belts) if (g.conv.belts[k].plates.length > g.conv.belts[k].cap) window.__chk.overCap++; }
    }
    return { t: g.S.time, task: g.S.taskIndex, done: g.S.done };
  }, [sec, opts]);

  // 1. no blank screen
  const px = await page.evaluate(() => { const c = document.getElementById('game'); const x = c.getContext('2d'); const d = x.getImageData(0, 0, c.width, c.height).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 97) { const v = d[i] + d[i + 1] + d[i + 2]; s += v; s2 += v * v; n++; } return Math.sqrt(s2 / n - (s / n) ** 2); });
  await shot('01_start');
  rec(1, 'Game starts without a blank screen', px > 20 && errors.length === 0, `canvas pixel std-dev ${px.toFixed(1)}, page errors ${errors.length}`);

  // 2 + 3. every character / animation / direction frame exists; walk proportions stable
  const spr = await page.evaluate(() => {
    const M = window.CST.MANIFEST; let frames = 0, missing = 0, worst = 0, worstName = '', dirsOk = 0, dirsTot = 0;
    for (const ch in M.chars) for (const an in M.chars[ch].anims) for (const d in M.chars[ch].anims[an]) {
      const fr = M.chars[ch].anims[an][d]; dirsTot++; if (fr.length) dirsOk++;
      const hs = []; for (const f of fr) { frames++; const a = M.atlases[M.chars[ch].atlas].frames[f[0]]; if (!a) missing++; else hs.push(a[3]); }
      if (an === 'walk' && hs.length) { const v = (Math.max(...hs) - Math.min(...hs)) / Math.max(...hs); if (v > worst) { worst = v; worstName = ch + '.' + d; } }
    }
    return { frames, missing, worst, worstName, dirsOk, dirsTot };
  });
  rec(2, 'Characters render correctly in all directions', spr.missing === 0 && spr.dirsOk === spr.dirsTot, `${spr.frames} frames, ${spr.missing} missing, ${spr.dirsOk}/${spr.dirsTot} direction sets populated (see sprite_sheet_check.png)`);
  rec(3, 'Walking animations preserve proportions', spr.worst < 0.12, `max frame-height variation inside one walk cycle ${(spr.worst * 100).toFixed(1)}% (${spr.worstName})`);
  // sprite contact page
  const sp = await ctx.newPage(); await sp.goto(BASE + 'tests/sprites.html'); await sp.waitForTimeout(1500); await sp.screenshot({ path: path.join(OUT, 'sprite_sheet_check.png'), fullPage: true }); await sp.close();

  // play through phase 1 + 2
  await ff(90); await page.waitForTimeout(300); await shot('02_phase1');
  // 4. conveyor plates move continuously
  let mv; for (let tries = 0; tries < 12; tries++) { mv = await page.evaluate(() => { const g = window.__game; const b = g.conv.belts.A; if (!b.plates.length) { g.conv.load('A', 'salmon'); } const before = b.plates.map(p => [p.id, p.s]); for (let i = 0; i < 30; i++) g.conv.update(1 / 30); const after = Object.fromEntries(b.plates.map(p => [p.id, p.s])); let moved = 0, total = 0; for (const [id, s] of before) if (after[id] !== undefined) { total++; if (Math.abs(after[id] - s) > 5) moved++; } return { moved, total, speed: g.conv.speed }; }); if (mv.total > 0) break; await ff(3); }   // retry when the belt happened to be empty at sample time
  rec(4, 'Conveyor plates move continuously', mv.total > 0 && mv.moved === mv.total, `${mv.moved}/${mv.total} plates advanced over 1 s at ${mv.speed} u/s`);
  await ff(420);
  await shot('03_phase2-3');
  // 7. payment cycle
  const pay = await page.evaluate(() => ({ paid: window.__game.stat('paid'), earned: window.__game.stat('earned') }));
  rec(7, 'Customers complete the payment cycle', pay.paid > 5 && pay.earned > 50, `${pay.paid} customers paid, ${pay.earned} coins earned`);
  // 10. upgrades apply
  const up = await page.evaluate(() => { const g = window.__game; g.S.coins += 5000;
    const val = { beltSpeed: () => g.conv.speed, beltCap: () => g.conv.belts.A.cap, carry: () => g.carryCap, move: () => g.moveSpeed, prod: () => g.prodMult, clean: () => -g.cleanTime, staff: () => g.staffMult };
    const out = [];
    for (const k in val) { const i = g.upgradeInfo(k); if (i.locked || i.cost === null) continue; const v0 = val[k](); const ok = g.buyUpgrade(k); out.push({ k, ok, v0, v1: val[k](), lv: g.S.up[k] }); }
    g.S.coins = Math.max(0, g.S.coins - 5000); return out; });
  rec(10, 'Upgrades apply correctly', up.length > 0 && up.every(u => u.ok && u.v1 > u.v0), up.map(u => `${u.k} Lv${u.lv}: ${u.v0}→${u.v1}`).join('; '));
  // 11. expansion order
  const ord = await page.evaluate(() => { const g = window.__game; const fut = g.C.UNLOCKS.filter(u => !g.has(u.id) && !g.padVisible(u)); g.S.coins += 99999; const bought = fut.filter(u => g.buyUnlock(u.id)).length; g.S.coins -= 99999; if (g.S.coins < 0) g.S.coins = 0; const order = g.C.UNLOCKS.map(u => u.showAfter); const sorted = order.every((v, i) => i === 0 || v >= order[i - 1]); return { fut: fut.length, bought, sorted }; });
  rec(11, 'Expansion unlocks in order', ord.bought === 0 && ord.sorted, `${ord.fut} future unlocks could not be bought early (bought ${ord.bought}); pad order monotonic: ${ord.sorted}`);

  // continue to staff phases
  await ff(600); await page.waitForTimeout(300); await shot('04_phase4-5');
  const staff = await page.evaluate(() => { const g = window.__game; return { roles: g.staff.map(s => s.role), chef: g.stat('chefLoaded'), cleaned: g.stat('cleaned'), waiter: g.stat('waiterServed'), task: g.S.taskIndex }; });
  await ff(600); await page.waitForTimeout(300); await shot('05_phase6');
  // 8. cleaner clears dirty seats
  const cl = await page.evaluate(() => { const g = window.__game; const cleaner = g.staff.find(s => s.role === 'cleaner'); if (!cleaner) return { has: false };
    const P = g.player; const saveP = { x: P.x, y: P.y }; const seat = Object.values(g.seats).find(s => !s.vip && !s.occupant) || Object.values(g.seats)[0];
    seat.dirty += 3; const d0 = Object.values(g.seats).reduce((a, s) => a + s.dirty, 0); const c0 = g.stat('cleaned');
    for (let i = 0; i < 30 * 40; i++) { g.update(1 / 30); }   // player idle, cleaner works
    const d1 = Object.values(g.seats).reduce((a, s) => a + s.dirty, 0); return { has: true, d0, d1, cleanedByCleaner: g.stat('cleaned') - c0, seatNow: seat.dirty }; });
  rec(8, 'Cleaner clears dirty seats', cl.has && cl.cleanedByCleaner >= 3, cl.has ? `dirty plates ${cl.d0}→${cl.d1}, cleaner collected ${cl.cleanedByCleaner} plates in 40 s with the player idle` : 'cleaner not hired yet');

  const staff2 = await page.evaluate(() => { const g = window.__game; return { roles: g.staff.map(s => s.role), chef: g.stat('chefLoaded'), cleaned: g.stat('cleaned'), waiter: g.stat('waiterServed'), boosts: g.stat('boosts') }; });
  rec(9, 'Employees perform assigned tasks', staff2.chef > 10 && staff2.cleaned > 5 && staff2.roles.includes('cashier'), `staff ${staff2.roles.join(', ')}; chef loaded ${staff2.chef} plates, ${staff2.cleaned} plates cleaned, waiter served ${staff2.waiter}`);
  const fin = await ff(3600, { untilDone: true }); await page.waitForTimeout(500); await shot('07_grand_opening');
  rec(14, 'Grand Opening milestone is reachable', fin.done, `completed=${fin.done} at game time ${Math.floor(fin.t / 60)}:${String(Math.floor(fin.t % 60)).padStart(2, '0')} (task ${fin.task})`);
  // 12. VIP sofas + animations (tracked during play)
  const vip = await page.evaluate(() => { const g = window.__game, ch = window.__chk; return { n: ch.vip || 0, wrong: ch.vipWrong || 0, frames: ch.vipFrames || {}, served: [g.stat('vip1Served'), g.stat('vip2Served')] }; });
  rec(12, 'VIP customers use correct sofas and animations', vip.n > 0 && vip.wrong === 0 && vip.served[0] > 0 && vip.served[1] > 0, `${vip.n} VIP seatings, ${vip.wrong} on a wrong sofa; sofa frames ${JSON.stringify(vip.frames)}; served VIP1 ${vip.served[0]}, VIP2 ${vip.served[1]}`);
  // 5 + 6 from accumulated checks
  const chk = await page.evaluate(() => window.__chk || {});
  rec(5, 'Customers take the correct sushi', chk.picks > 50 && chk.wrongPick === 0, `${chk.picks} pickups verified, ${chk.wrongPick} wrong`);
  rec(6, 'Plates are not duplicated', chk.dup === 0 && chk.overCap === 0, `duplicate-id samples ${chk.dup}, over-capacity samples ${chk.overCap}`);
  // 13. save / load
  const before = await page.evaluate(() => { const g = window.__game; g.save(); return { coins: g.S.coins, task: g.S.taskIndex, unlocked: g.S.unlocked.length, stars: g.S.stars }; });
  await page.goto(BASE + 'index.html?autostart=1'); await page.waitForFunction(() => window.__game); await page.waitForTimeout(800);
  const after = await page.evaluate(() => { const g = window.__game; return { coins: g.S.coins, task: g.S.taskIndex, unlocked: g.S.unlocked.length, stars: g.S.stars, staff: g.staff.length }; });
  await shot('06_after_reload');
  rec(13, 'Save/load works', after.task === before.task && after.unlocked === before.unlocked && Math.abs(after.coins - before.coins) < 50 && after.stars === before.stars, `before ${JSON.stringify(before)} → after reload ${JSON.stringify(after)}`);
  // UI panels render
  for (const p of ['shop', 'upgrade', 'tasks', 'map', 'settings']) { await page.evaluate(p => window.APP.ui.open(p), p); await page.waitForTimeout(250); await shot('panel_' + p); }
  await page.evaluate(() => window.APP.ui.close());
  results.sort((a, b) => a.id - b.id);
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ when: new Date().toISOString(), device: 'iPhone 13 (Chromium emulation)', results, errors }, null, 1));
  console.log(`\n${results.filter(r => r.pass).length}/${results.length} passed; page errors: ${errors.length}`); if (errors.length) console.log(errors.slice(0, 10).join('\n'));
  await browser.close();
})();

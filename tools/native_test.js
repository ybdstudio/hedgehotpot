#!/usr/bin/env node
/* Native-build test: runs dist/ (built by tools/build_native.js) in the tt.* emulator, headless.
   usage: node tools/native_test.js [outDir] [--secs 160]     (needs playwright; NODE_PATH=$(npm root -g) works) */
const { chromium } = require(process.env.PW || 'playwright');
const AD = label => (JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../native/meow-hotpot.hs-dashboard.json'), 'utf8')).iaa_config.placements.find(p => p.label === label).ads[0].id);   // ad ids from the dashboard file
const fs = require('fs'), path = require('path'), http = require('http');
const argv = process.argv.slice(2), OUT = argv[0] && !argv[0].startsWith('--') ? argv[0] : path.join(__dirname, '../tests/out_native');
const SECS0 = 0; const SECS = argv.includes('--secs') ? +argv[argv.indexOf('--secs') + 1] : 160; fs.mkdirSync(OUT, { recursive: true });
const DIST = path.join(__dirname, '../dist'), MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
const res = []; const rec = (name, ok, detail) => { res.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`); };
(async () => {
  const srv = http.createServer((q, s) => { const p = path.join(DIST, decodeURIComponent(q.url.split('?')[0])); if (!p.startsWith(DIST) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(s); }).listen(0);
  const port = srv.address().port, BASE = `http://localhost:${port}/emulator/index.html`;
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; pg.on('pageerror', e => errs.push('pageerror: ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  pg.on('response', r => { if (r.status() >= 400) errs.push(`HTTP ${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`); });
  const shot = n => pg.screenshot({ path: path.join(OUT, n + '.png') });
  const boot = async q => { await pg.goto(BASE + q); await pg.evaluate(() => localStorage.clear()); await pg.goto(BASE + q); await pg.waitForFunction(() => window.__game && window.APP && APP.ui, null, { timeout: 30000 }); await pg.waitForTimeout(700); };
  // tap the centre of the n-th-from-last hit area (popup / sheet buttons are registered last)
  const tapHit = async (pick) => { const h = await pg.evaluate(pick); if (!h) return false; await pg.mouse.click(h.x + h.w / 2, h.y + h.h / 2); await pg.waitForTimeout(250); return true; };

  await boot('?fakeads=1&hsfake=1');
  await pg.waitForFunction(() => CST.HS && CST.HS.result, null, { timeout: 10000 });
  await shot('01_start');
  rec('Boot without errors', errs.length === 0, `${errs.length} errors`);
  // joystick
  const p0 = await pg.evaluate(() => ({ x: __game.player.x, y: __game.player.y }));
  await pg.mouse.move(195, 560); await pg.mouse.down(); for (let i = 1; i <= 15; i++) { await pg.mouse.move(195 + i * 3, 560 - i * 3); await pg.waitForTimeout(40); } await pg.waitForTimeout(500); await pg.mouse.up();
  const p1 = await pg.evaluate(() => ({ x: __game.player.x, y: __game.player.y }));
  rec('Joystick moves the player', Math.hypot(p1.x - p0.x, p1.y - p0.y) > 20, `moved ${Math.hypot(p1.x - p0.x, p1.y - p0.y).toFixed(0)} units`);
  // panels via bottom nav
  for (const [i, name] of ['shop', 'upgrade', 'tasks', 'map', 'settings'].entries()) {
    await pg.mouse.click(10 + (390 - 20 - 28) / 5 * (i + 0.5) + 7 * i, 844 - 30 - 10 - 30); await pg.waitForTimeout(300);
    const open = await pg.evaluate(() => APP.ui.panel); await pg.mouse.wheel(0, 300).catch(() => { });
    await shot('02_panel_' + name); rec(`Nav opens ${name}`, open === name, `panel=${open}`);
    await pg.evaluate(() => APP.ui.close()); await pg.waitForTimeout(100);   // let a frame redraw the hit areas
  }
  // settings toggles: off -> on again (was stuck on Off: grey buttons were not tappable)
  await pg.evaluate(() => APP.ui.open('settings')); await pg.waitForTimeout(150);
  const tg = [];
  for (let k = 0; k < 2; k++) for (const which of [0, 1]) {
    const h = await pg.evaluate(w => { const b = APP.ui.sheetBox; const hs = APP.ui.hits.filter(h => b && h.y >= b.y && h.w < 200 && h.h < 70).sort((a, c) => a.y - c.y); return hs[w]; }, which);
    if (h) { await pg.mouse.click(h.x + h.w / 2, h.y + h.h / 2); await pg.waitForTimeout(150); }
    tg.push(await pg.evaluate(() => [__game.S.settings.sound, __game.S.settings.vib, CST.Audio.on]));
  }
  await shot('02b_settings'); await pg.evaluate(() => APP.ui.close()); await pg.waitForTimeout(100);
  rec('Sound / Vibration toggle off and back on', JSON.stringify(tg) === JSON.stringify([[false, true, false], [false, false, false], [true, false, true], [true, true, true]]), JSON.stringify(tg));
  const ui = await pg.evaluate(() => { const h = APP.ui.hits; const nav = h.filter(x => x.y > 700); return { navTop: Math.min(...nav.map(x => x.y)), H: APP.ui.H }; });
  rec('Bottom UI (task card + nav) is compact', ui.H - ui.navTop < 150, `task card top at ${ui.navTop.toFixed(0)} of ${ui.H}px (uses ${(ui.H - ui.navTop).toFixed(0)}px)`);
  // share popup -> share button -> reward
  const c0 = await pg.evaluate(() => { CST.Minis.popShare(); return __game.S.coins; }); await pg.waitForTimeout(300); await shot('03_share');
  await tapHit(() => { const h = APP.ui.hits; return h[h.length - 1]; }); await pg.waitForTimeout(600);
  const sh = await pg.evaluate(() => ({ called: !!window.__shared, coins: __game.S.coins, day: CST.Minis.st().shareDay }));
  rec('Share calls shareAppMessage and rewards once', sh.called && sh.coins > c0, JSON.stringify(sh));
  await pg.evaluate(() => APP.ui.closePopup && APP.ui.closePopup());
  // free coins via rewarded ad
  const c1 = await pg.evaluate(() => { CST.Ads.t = 999; window.__adUnits = []; CST.Minis.popCoins(); return __game.S.coins; }); await pg.waitForTimeout(300); await shot('04_coins');
  await tapHit(() => { const h = APP.ui.hits; return h[h.length - 1]; }); await pg.waitForTimeout(900);
  const co = await pg.evaluate(() => ({ unit: (window.__adUnits || [])[0], coins: __game.S.coins, pop: !!APP.ui.pop, paused: APP.paused }));
  rec('Free Coins (+ button) plays "Coin Purchase" via HS and grants coins', co.unit === AD('Coin Purchase') && co.coins > c1 && !co.paused, JSON.stringify(co));
  // every placement: right ad unit, effect applied exactly once
  const units = { R1_task_x2: AD('Double Task Bonus'), R2_pad: AD('Buying Pad'), R3_rush: AD('Meow Rush'), R4_vip_tip: AD('VIP tip'), R5_coins: AD('Coin Purchase'), R6_rush: AD('Grand Opening') };
  for (const [slot, unit] of Object.entries(units)) {
    const r = await pg.evaluate(async slot => {
      const A = CST.Ads; A.t += 1000; window.__adUnits = []; let n = 0; const can = A.canReward(slot, 0);
      A.reward(slot, () => n++);
      await new Promise(res => { const t0 = Date.now(); const w = () => (!A.busy || Date.now() - t0 > 4000) ? res() : setTimeout(w, 50); setTimeout(w, 50); });
      return { can, granted: n, unit: window.__adUnits[0], paused: APP.paused, label: CST.HS.cfg.places[slot.split('_')[0]] };
    }, slot);
    rec(`HS place "${r.label}" (${slot})`, r.can && r.granted === 1 && r.unit === unit && !r.paused, JSON.stringify(r));
  }
  // interstitial: game pacing decides, HS "Inter1" plays
  const it = await pg.evaluate(async () => {
    const A = CST.Ads, C = A.cfg(); A.t += 1000; A.lastInter = A.lastReward = A.lastAny = -1e9; __game.S.taskIndex = Math.max(__game.S.taskIndex, C.interFirstTask); __game.player.hold = null; window.__adUnits = [];
    const why = A.interBlocked(); const ok = A.tryInter('I6_idle');
    await new Promise(r => setTimeout(r, (C.interDelay + 1) * 1000)); return { why, ok, unit: window.__adUnits[0], count: A.interCount, paused: APP.paused };
  });
  rec('Interstitial plays "Inter1" via HS', it.ok && it.unit === AD('Inter1') && it.count >= 1 && !it.paused, JSON.stringify(it));
  // closed early -> no reward
  const sk = await pg.evaluate(async () => {
    const A = CST.Ads; A.t += 1000; let n = 0; const real = tt.createRewardedVideoAd;
    tt.createRewardedVideoAd = o => { const ad = real(o); const on = ad.onClose; ad.onClose = f => on(r => f({ isEnded: false })); return ad; };
    A.reward('R3_rush', () => n++); await new Promise(r => setTimeout(r, 1500)); tt.createRewardedVideoAd = real;
    return { granted: n, paused: APP.paused, err: CST.HS.sdk.lastAdError };
  });
  rec('Ad closed early gives no reward', sk.granted === 0 && !sk.paused, JSON.stringify(sk));
  // home-screen + revisit popups render
  for (const f of ['popAdd', 'popRevisit']) { await pg.evaluate(f => CST.Minis[f](), f); await pg.waitForTimeout(250); const ok = await pg.evaluate(() => !!APP.ui.pop); await shot('05_' + f); rec(`${f} popup opens`, ok, ''); await pg.evaluate(() => APP.ui.closePopup()); }
  // long autoplay
  await pg.evaluate(() => { APP.setAutoplay(true); APP.speed = 8; });
  const t0 = Date.now(); while (Date.now() - t0 < SECS * 1000 / 8) await pg.waitForTimeout(1000);
  const st = await pg.evaluate(() => { APP.setAutoplay(false); APP.speed = 1; return { time: Math.round(__game.S.time), task: __game.S.taskIndex, coins: Math.floor(__game.S.coins), paid: __game.stat('paid'), inter: window.__adShown || 0 }; });
  await pg.waitForTimeout(400); await shot('06_after_autoplay');
  rec(`Autoplay ${SECS}s game time progresses`, st.task > 2 && st.paid > 0, JSON.stringify(st));
  // save / reload
  const sv = await pg.evaluate(() => { __game.save(); return { coins: Math.floor(__game.S.coins), task: __game.S.taskIndex }; });
  await pg.reload(); await pg.waitForFunction(() => window.__game && APP.ui, null, { timeout: 30000 });
  const ld = await pg.evaluate(() => ({ coins: Math.floor(__game.S.coins), task: __game.S.taskIndex }));
  rec('Save/load through tt storage', ld.task === sv.task && Math.abs(ld.coins - sv.coins) <= 1, `${JSON.stringify(sv)} → ${JSON.stringify(ld)}`);
  // no ad SDK at all (fakeads off) must not break anything
  // HS backend unreachable (no tt.request): no ad is offered anywhere, the game still plays
  const eOff = errs.length; await boot('?fakeads=1'); await pg.waitForTimeout(1500);
  const off = await pg.evaluate(() => ({ coins: CST.Ads.canReward('R5', 0), inter: CST.Ads.interBlocked(), hs: CST.HS.result }));
  await pg.evaluate(() => { CST.Ads.t = 999; CST.Minis.popCoins(); }); await pg.waitForTimeout(300); await shot('07_hs_offline');
  const offErr = errs.splice(eOff).filter(e => !/HS\.TikTokSDK|ERR_TUNNEL|ERR_|Failed to load resource/.test(e));   // expected: HS server unreachable here
  rec('HS offline: no ad offered, no crash', off.coins === false && !!off.inter && offErr.length === 0, JSON.stringify(off) + (offErr.length ? ' ' + offErr.join(' | ') : ''));
  // TikTok iOS quirks seen on device: AudioParams without automation methods, capsule rect in physical px
  const e0 = errs.length;
  await boot('?ttquirks=1&hsfake=1');
  const q = await pg.evaluate(async () => {
    CST.Audio.unlock(); const names = ['coin', 'pick', 'drop', 'pop', 'ding', 'cash', 'unlock', 'task', 'star', 'angry', 'boost'];
    await new Promise(r => requestAnimationFrame(() => { for (const n of names) { CST.Audio.last = {}; CST.Audio.play(n); } r(); }));   // inside a frame, like on device
    const t0 = __game.S.time; const d = APP.renderer.draw; let thrown = 0; APP.renderer.draw = function () { if (!thrown++) throw new Error('injected frame error'); return d.apply(this, arguments); };
    await new Promise(r => setTimeout(r, 1200)); return { advanced: __game.S.time - t0, top: __SAFE.top, H: __SAFE.H };
  });
  await shot('09_tt_quirks');
  const qerr = errs.slice(e0).filter(e => !/injected frame error/.test(e)); errs.length = e0;
  rec('TikTok quirks: sound never throws', qerr.length === 0, qerr.join(' | ') || 'ok');
  rec('TikTok quirks: game loop survives a frame error', q.advanced > 0.8, `game time +${q.advanced.toFixed(2)}s`);
  rec('TikTok quirks: HUD top inset stays near the capsule', q.top > 40 && q.top <= q.H * 0.15, `top=${q.top}px of ${q.H}`);
  rec('No runtime errors overall', errs.length === 0, errs.length ? [...new Set(errs)].join(' | ') : 'clean');
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(res, null, 1));
  console.log(`\n${res.filter(r => r.ok).length}/${res.length} passed`);
  await b.close(); srv.close(); process.exit(res.every(r => r.ok) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });

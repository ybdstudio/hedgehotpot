/* Run against the unmodified HS kit's local preview server.
   Test credentials are injected into the browser only, never into the build. */
const { chromium } = require(process.env.PW || 'playwright');
const fs = require('fs'), path = require('path');
const BASE = process.argv[2] || 'http://127.0.0.1:8091/';
const OUT = path.join(__dirname, 'out_native_release');
const report = { checks: [], errors: [], externalRequests: [], blockedBrowserSecurityOrigins: [] };
const check = (ok, name, detail) => {
  report.checks.push({ name, pass: !!ok, detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + JSON.stringify(detail) : ''));
  if (!ok) throw new Error(name);
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const contexts = [];
  async function boot(simulated = true) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } }); contexts.push(context);
    await context.route('**/*', route => {
      const url=route.request().url();
      if (!/^https?:/.test(url) || url.startsWith(new URL(BASE).origin + '/')) return route.continue();
      // Host antivirus injects browser scripts; keep them out of the fixture
      // and record only the domain, never its diagnostic query data.
      const origin=new URL(url).origin;
      if (/\.kaspersky-labs\.com$/.test(new URL(url).hostname)) {
        if (!report.blockedBrowserSecurityOrigins.includes(origin)) report.blockedBrowserSecurityOrigins.push(origin);
      } else report.externalRequests.push(origin);
      return route.abort();
    });
    if (simulated) await context.addInitScript(() => {
      if (window.parent !== window) window.__HS_CHECK__ = { gameId: '7000000000000000000', sdkKey: 'sk_test_native_review' };
    });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(BASE);
    await page.waitForFunction(() => !!document.querySelector('iframe'));
    const frame = page.frames().find(f => /__hs_frame/.test(f.url()));
    await frame.waitForFunction(() => window.__game && window.APP && CST.HS.result);
    if (simulated) await frame.waitForFunction(() => HSGame.loggedIn && CST.Ads.canReward('R5'));
    return { page, frame, context };
  }
  async function tapPopupButton(frame) {
    await frame.waitForTimeout(80);
    const hit = await frame.evaluate(() => {
      const h = APP.ui.hits.filter(h => h.w > 200 && h.h === 52).at(-1);
      return h && { x: h.x + h.w/2, y: h.y + h.h/2 };
    });
    if (!hit) throw new Error('Native popup button was not drawn');
    await frame.locator('canvas').first().click({ position: hit });
  }
  try {
    const offline = await boot(false);
    check(await offline.frame.evaluate(() => CST.HS.cfg.gameId === '' && CST.HS.cfg.sdkKey === '' && !CST.Ads.canReward('R5')), 'Empty credentials: restaurant runs, production ads disabled');
    await offline.page.screenshot({ path: path.join(OUT, '01-offline-native.png') });
    await offline.context.close();

    for (const outcome of ['Closed early','No fill','Watched to the end']) {
      const { page, frame, context } = await boot();
      const before = await frame.evaluate(() => __game.S.coins);
      const tapGuard = await frame.evaluate(async () => {
        const n = HSGame.trace.filter(s => s.startsWith('showAd:')).length;
        await CST.Ads.reward('R5'); CST.Ads.update(1200); CST.Minis.update(.12);
        return n === HSGame.trace.filter(s => s.startsWith('showAd:')).length;
      });
      check(tapGuard, outcome + ': no ad from direct call, timer or idle');
      await frame.evaluate(() => CST.Minis.popCoins()); await tapPopupButton(frame);
      await frame.getByRole('button', { name: outcome, exact: true }).waitFor();
      await frame.waitForFunction(() => APP.paused && CST.Audio.muted);
      const frozen = await frame.evaluate(() => __game.S.time);
      await page.waitForTimeout(220);
      check(await frame.evaluate(t => __game.S.time === t, frozen), outcome + ': gameplay and sound paused');
      if (outcome === 'Watched to the end') await page.screenshot({ path: path.join(OUT, '02-ad-pending.png') });
      await frame.getByRole('button', { name: outcome, exact: true }).click();
      await frame.waitForFunction(() => !CST.Ads.busy && !APP.paused);
      const after = await frame.evaluate(() => __game.S.coins);
      check(after === before + (outcome === 'Watched to the end' ? 50 : 0), outcome + ': reward delivered exactly as expected', { before, after });
      if (outcome === 'Watched to the end') {
        check(await frame.evaluate(() => !HSGame.canShowAd('free_coins')), 'Rewarded 30s dashboard cooldown');
        const stored = await frame.evaluate(() => JSON.parse(localStorage.getItem(CST.CONFIG.SAVE_KEY)).coins);
        check(stored === after, 'Reward persisted synchronously before callback returns');
      }
      await context.close();
    }

    const { page, frame, context } = await boot();
    await page.screenshot({ path: path.join(OUT, '03-review-entry-buttons.png') });
    const start = await frame.evaluate(() => __game.S.coins);
    await frame.evaluate(() => CST.Minis.popAdd()); await tapPopupButton(frame);
    await frame.getByRole('button', { name: 'Add', exact: true }).click();
    await frame.waitForFunction(() => HSGame.tiktokMission.done('shortcut'));
    check(await frame.evaluate(n => __game.S.coins === n+80 && __game.S.stars === 1 && !CST.Minis.entries().some(e => e.id === 'launch'), start), 'Launch Reward verified, delivered once, button hidden');
    await frame.evaluate(() => APP.ui.closePopup());
    const afterLaunch = await frame.evaluate(() => __game.S.coins);
    await frame.evaluate(() => { HSGame.tiktokMission.start('shortcut'); });
    await frame.getByRole('button', { name:'Add', exact:true }).click();
    await frame.waitForFunction(() => !APP.paused);
    check(await frame.evaluate(n => __game.S.coins === n, afterLaunch), 'Launch Reward cannot be farmed');
    await frame.evaluate(() => CST.Minis.popRevisit()); await tapPopupButton(frame);
    await frame.getByRole('button', { name: 'Visited — come back', exact: true }).click();
    await frame.waitForFunction(() => HSGame.tiktokMission.done('profile'));
    check(await frame.evaluate(n => __game.S.coins === n+60 && !CST.Minis.entries().some(e => e.id === 'entry'), afterLaunch), 'Entry Reward verified once and button hidden');
    await frame.evaluate(() => APP.ui.closePopup());
    const beforeShare = await frame.evaluate(() => __game.S.coins);
    for (let i=0; i<2; i++) {
      await frame.evaluate(() => CST.Minis.popShare()); await tapPopupButton(frame);
      await frame.getByRole('button', { name:'Share',exact:true }).click();
      await frame.waitForTimeout(220);
      await frame.evaluate(() => APP.ui.closePopup());
    }
    check(await frame.evaluate(n => __game.S.coins === n+50 && !HSGame.available('share'), beforeShare), 'Share pays only once per day');
    const inter = await frame.evaluate(() => {
      APP.game.S.taskIndex=2; const early=CST.Ads.canContinue();
      APP.game.S.taskIndex=3; const eligible=CST.Ads.canContinue();
      return { early, eligible };
    });
    check(!inter.early && inter.eligible, 'Interstitial hidden for first three tasks', inter);
    await frame.evaluate(() => { const next=CST.CONFIG.PHASE_BY_TASK.findIndex(p => p > __game.phase); __game.S.taskIndex=Math.max(3,next); CST.Minis.update(.12); });
    await frame.waitForFunction(() => !!CST.Minis.chips.continue);
    await frame.waitForTimeout(100);
    const continueHit = await frame.evaluate(() => {
      const h=APP.ui.hits.find(h => h.w===156 && h.h===50);
      return h && { x:h.x+h.w/2,y:h.y+h.h/2 };
    });
    await frame.locator('canvas').first().click({ position:continueHit });
    await frame.getByRole('button',{name:'Close ad',exact:true}).click();
    await frame.waitForFunction(() => !CST.Ads.busy && !APP.paused);
    check(await frame.evaluate(() => !HSGame.canShowAd('phase_continue')), 'Interstitial starts on Continue tap; 90s dashboard cooldown');

    await page.getByRole('button', { name:'Android app',exact:true }).click();
    const android = await (await page.locator('iframe').elementHandle()).contentFrame();
    await android.waitForFunction(() => window.__game && window.APP && HSGame.platform === 'android' && CST.HS.result);
    check(await android.evaluate(() => !HSGame.has('tiktok_missions') && !CST.Minis.entries().some(e => ['entry','launch'].includes(e.id))), 'Android capability gates hide TikTok missions');
    await page.screenshot({ path:path.join(OUT,'04-android-capabilities.png') });
    await context.close();
    check(!report.errors.length, 'No native browser runtime errors', report.errors);
    check(!report.externalRequests.length, 'HS preview makes no requests to live services', report.externalRequests);
    report.pass = true;
  } finally {
    fs.writeFileSync(path.join(OUT,'results.json'), JSON.stringify(report,null,2));
    for (const ctx of contexts) await ctx.close().catch(() => {});
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode=1; });

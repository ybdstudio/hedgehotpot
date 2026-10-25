/* PW and CHROMIUM may point to locally installed Playwright / browser. */
const { chromium } = require(process.env.PW || 'playwright');
const { createServer } = require('../tools/serve_preview');
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(__dirname, 'out_hedgehog');
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const launchOptions = process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const report = { checks: [], errors: [] };
  try {
    browser = await chromium.launch(launchOptions);
    const page = await browser.newPage({ viewport: { width: 480, height: 850 } });
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(url + '/?autostart=1&fresh=1');
    await page.waitForFunction(() => window.__game && CST.Assets.ready);
    await page.waitForTimeout(250);
    const atlasCheck = await page.evaluate(() => {
      const M = CST.MANIFEST, errors = [], roles = Object.keys(M.chars);
      for (const [key, atlas] of Object.entries(M.atlases)) {
        const image = CST.Assets.img[key];
        if (!image) { errors.push(key); continue; }
        for (const [name, [x,y,w,h]] of Object.entries(atlas.frames))
          if (x < 0 || y < 0 || x+w > image.width || y+h > image.height) errors.push(name);
      }
      for (const role of roles) for (const logical of Object.keys(CST.Anim.MAP[role]))
        for (const dir of ['front','front_right','right','back_right','back','back_left','left','front_left']) {
          const f = CST.Anim.frame(role, logical, dir, 1.7);
          if (!f || !M.atlases[f.atlas].frames[f.key]) errors.push(`${role}/${logical}/${dir}`);
        }
      const obsolete = Object.keys(M.atlases.props.frames).filter(k => /^(dine_pair_|dine_solo_|chefst_)/.test(k));
      return { roles: roles.length, atlases: Object.keys(CST.Assets.img).length, errors, obsolete };
    });
    assert(atlasCheck.roles === 10 && atlasCheck.atlases === 11 && !atlasCheck.errors.length && !atlasCheck.obsolete.length, JSON.stringify(atlasCheck));
    report.checks.push({ name: 'All roles, logical actions, directions and atlas bounds', ...atlasCheck });
    const before = await page.evaluate(() => ({ x: __game.player.x, y: __game.player.y }));
    await page.keyboard.down('ArrowDown'); await page.waitForTimeout(240); await page.keyboard.up('ArrowDown');
    const after = await page.evaluate(() => ({ x: __game.player.x, y: __game.player.y }));
    assert(Math.hypot(after.x-before.x, after.y-before.y) > 1, 'Keyboard movement did not move the hedgehog');
    report.checks.push({ name: 'Keyboard movement', pass: true });
    await page.screenshot({ path: path.join(OUT, '01-game-mobile.png') });
    for (const panel of ['shop','upgrade','tasks','map','settings']) {
      await page.evaluate(p => APP.ui.open(p), panel);
      assert(await page.locator('#sheet').isVisible(), 'Panel missing: ' + panel);
      await page.screenshot({ path: path.join(OUT, 'panel-' + panel + '.png') });
      await page.evaluate(() => APP.ui.close());
    }
    report.checks.push({ name: 'All five UI panels', pass: true });
    // Isolated renderer scene, no save writes: every role and all chair types.
    await page.setViewportSize({ width: 1100, height: 850 });
    await page.evaluate(() => {
      APP.paused = true;
      const g = new CST.Game({ load: false, seed: 37 });
      g.S.unlocked = g.C.UNLOCKS.map(u => u.id); g.build();
      for (const seat of Object.values(g.seats)) {
        g.spawnCustomer(seat.vip ? seat.kind : 'reg', seat.vip ? seat : undefined);
        const c = g.customers[g.customers.length-1];
        c.char = seat.vip ? seat.kind : seat.id.endsWith('L') ? 'cust_gray' : 'cust_orange';
        Object.assign(c, { x: seat.x, y: seat.y, path: null, moving: false, seat, state: 'EAT', animT: .4, plate: { recipe: 'salmon' } });
        seat.occupant = c;
      }
      const r = APP.renderer; r.g = g; r.zoomMul = .52; r.resize();
      const p = r.P(355, 310); r.cam.x = p.x; r.cam.y = p.y - 35; r.draw(.016);
      window.__reviewGame = g;
    });
    await page.screenshot({ path: path.join(OUT, '02-all-areas.png') });
    // Freeze the animation loop while taking a close crop of layered tables.
    await page.evaluate(() => { const r = APP.renderer; r.draw = r.draw.bind(r); r.follow = () => {}; });
    for (const state of ['empty','one','two']) {
      await page.evaluate(state => {
        const g = window.__reviewGame, r = APP.renderer, table = Object.values(g.tables)[0];
        const left = g.seats[table.id+'L'], right = g.seats[table.id+'R'];
        window.__reviewDiners = window.__reviewDiners || [left.occupant, right.occupant];
        left.occupant = state === 'empty' ? null : window.__reviewDiners[0];
        right.occupant = state === 'two' ? window.__reviewDiners[1] : null;
        // draw directly on a dedicated review canvas, excluding HUD and camera.
        let canvas = document.getElementById('tableReview');
        if (!canvas) { canvas = document.createElement('canvas'); canvas.id='tableReview'; canvas.width=600; canvas.height=500; document.body.append(canvas); }
        const old = r.ctx; r.ctx = canvas.getContext('2d'); r.ctx.setTransform(1,0,0,1,0,0);
        r.ctx.fillStyle='#f5e8d2';r.ctx.fillRect(0,0,600,500);
        const p=r.P(table.x,table.y);r.ctx.setTransform(4,0,0,4,300-p.x*4,320-p.y*4);
        r.drawTable(table);r.ctx=old;
      }, state);
      const canvas = await page.locator('#tableReview').screenshot({ path: path.join(OUT, 'table-' + state + '.png') });
    }
    report.checks.push({ name: 'All unlocked areas, two customer identities on either chair, VIP and empty/one/two diner layers', pass: true });
    const offline = await browser.newPage({ viewport: { width: 480, height: 850 } });
    const network = [];
    offline.on('pageerror', e => report.errors.push(e.message));
    offline.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
    await offline.context().setOffline(true);
    await offline.goto(pathToFileURL(path.join(ROOT, 'dist/hedge-hotpot-preview.html')).href + '?autostart=1&fresh=1');
    await offline.waitForFunction(() => window.__game && Object.keys(CST.Assets.img).length === 11);
    assert(network.length === 0, 'Standalone preview requested network assets');
    await offline.screenshot({ path: path.join(OUT, '03-standalone-offline.png') });
    report.checks.push({ name: 'Standalone HTML opened from disk with networking offline', pass: true, networkRequests: network.length });
    const native = await browser.newPage({ viewport: { width: 480, height: 850 } });
    native.on('pageerror', e => report.errors.push('native: ' + e.message));
    await native.goto(url + '/dist/native/emulator/index.html?noads=1');
    await native.waitForFunction(() => window.__game && window.APP && APP.ui, null, { timeout: 20000 });
    assert(await native.evaluate(() => Object.keys(CST.Assets.img).length === 11), 'Native atlases did not load');
    await native.screenshot({ path: path.join(OUT, '04-native-emulator.png') });
    report.checks.push({ name: 'Native emulator boots with all hedgehog atlases', pass: true });
    assert(!report.errors.length, report.errors.join('\n'));
    report.pass = true;
  } finally {
    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2));
    if (browser) await browser.close(); await new Promise(r => server.close(r));
  }
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });

/* Native boot: loading screen -> load the 'res' subpackage (atlases) -> start the game loop. Touch -> UI or joystick. */
(function (root) {
  const CST = root.CST, T = root.__TT, SAFE = root.__SAFE;
  const screen = root.__screenCanvas, ctx = screen.getContext('2d');
  const dpr = Math.min(3, root.devicePixelRatio || 2);
  screen.width = Math.round(SAFE.W * dpr); screen.height = Math.round(SAFE.H * dpr);
  const storage = root.localStorage;

  // ---------------- loading screen
  let progress = 0, shown = 0, loadingImg = null, loading = true;
  const li = new Image(); li.onload = () => { loadingImg = li; }; li.src = CST.UIART_FILES.loading;
  const drawLoading = () => {
    const W = SAFE.W, H = SAFE.H; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#f6d9a8'; ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (loadingImg) { const s = Math.max(W / loadingImg.width, H / loadingImg.height); ctx.drawImage(loadingImg, (W - loadingImg.width * s) / 2, 0, loadingImg.width * s, loadingImg.height * s); }
    shown += (progress - shown) * 0.15 + 0.003; shown = Math.min(shown, progress);
    const bw = W * 0.8, bx = (W - bw) / 2, by = H - SAFE.bottom - H * 0.09, bh = 26;
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
    ctx.fillStyle = '#6b3a22'; rr(bx - 4, by - 4, bw + 8, bh + 8, 17); ctx.fill(); ctx.fillStyle = '#fff3dc'; rr(bx - 2, by - 2, bw + 4, bh + 4, 15); ctx.fill();
    ctx.fillStyle = '#5a2f1c'; rr(bx, by, bw, bh, 13); ctx.fill();
    if (shown > 0.02) { ctx.save(); rr(bx, by, bw * shown, bh, 13); ctx.clip(); ctx.fillStyle = '#ffb300'; ctx.fillRect(bx, by, bw, bh); ctx.fillStyle = '#ffc928'; const o = (Date.now() / 40) % 24; for (let x = bx - 30 + o; x < bx + bw; x += 24) { ctx.beginPath(); ctx.moveTo(x, by + bh); ctx.lineTo(x + 12, by + bh); ctx.lineTo(x + 24, by); ctx.lineTo(x + 12, by); ctx.closePath(); ctx.fill(); } ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(bx, by + 2, bw, 4); ctx.restore(); }
    ctx.font = 'bold 20px "PingFang SC",Arial,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = '#4a2614';
    const t = shown >= 0.999 ? 'Ready!' : `Loading... ${Math.round(shown * 100)}%`; ctx.strokeText(t, W / 2, by + bh + 26); ctx.fillStyle = '#fff'; ctx.fillText(t, W / 2, by + bh + 26);
    ctx.font = '9px "PingFang SC",Arial,sans-serif'; ctx.textAlign = 'right'; ctx.lineWidth = 1; ctx.strokeStyle = '#8b6239'; ctx.fillStyle = '#f5f5f5'; const v = `v${CST.CONFIG.VERSION}.0`; ctx.strokeText(v, W - 6, 12); ctx.fillText(v, W - 6, 12);
    if (loading) requestAnimationFrame(drawLoading);
  };
  requestAnimationFrame(drawLoading);

  // ---------------- app
  const App = root.APP = {
    speed: 1, autoplay: false, paused: false,
    setAutoplay(v) {
      this.autoplay = !!v;
      if (v && CST.Bot && (!this.bot || this.bot.g !== this.game)) this.bot = new CST.Bot(this.game);
    },
    setSpeed(v) { if (CST.NATIVE_TEST.speeds.includes(v)) this.speed = v; },
    resetGame() {
      const old = this.game; old.reset && old.reset(); old.opts.storage = null; old.listeners = {};
      try { storage.removeItem(CST.CONFIG.SAVE_KEY); } catch (e) { }
      const game = this.game = new CST.Game({ storage, seed: Date.now() & 0xffff, load: false }); game.save();
      this.renderer.g = game; this.renderer.follow(0, true); this.ui.bindGame(game); this.ui.close(); CST.Minis.bind(game);
      this.bot = null; this.setAutoplay(this.autoplay);
      this.ui.toast('New restaurant! Grab beef from the crate', 'c_box_salmon', true);
    },
    start() {
      const game = this.game = new CST.Game({ storage, seed: Date.now() & 0xffff });
      this.setAutoplay(true);
      CST.Audio.on = game.S.settings.sound;
      const r = this.renderer = new CST.Renderer(screen, game); r.resize(); r.follow(0, true);
      this.ui = new CST.UI(game, r, this);
      CST.Ads.init(this); CST.Minis.init(this); this.ui.started = true;
      CST.HS.attach(this);
      T.onHide && T.onHide(() => this.game.save());
      this.ui.toast(game.loaded ? 'Welcome back!' : 'Welcome! Grab beef from the crate', game.loaded ? 'c_fx_heart' : 'c_box_salmon', true);
      // touch: UI first, otherwise a floating joystick
      const joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0, v: { x: 0, y: 0 }, R: 50 }; let uiId = null;
      const pt = t => ({ x: t.clientX !== undefined ? t.clientX : t.pageX, y: t.clientY !== undefined ? t.clientY : t.pageY });
      T.onTouchStart(e => { try { CST.Audio.unlock(); } catch (er) { } for (const t of e.changedTouches) { const p = pt(t);
        if (uiId === null && this.ui.touchStart(p.x, p.y)) { uiId = t.identifier; continue; }
        if (joy.id === null && !this.ui.pop && !this.ui.panel) { joy.id = t.identifier; joy.ox = p.x; joy.oy = p.y; joy.dx = joy.dy = 0; joy.v = { x: 0, y: 0 }; this.ui.joy = joy; } } });
      T.onTouchMove(e => { for (const t of e.changedTouches) { const p = pt(t);
        if (t.identifier === uiId) this.ui.touchMove(p.x, p.y);
        else if (t.identifier === joy.id) { let dx = p.x - joy.ox, dy = p.y - joy.oy; const d = Math.hypot(dx, dy); if (d > joy.R) { const k = (d - joy.R) / d; joy.ox += dx * k; joy.oy += dy * k; dx = p.x - joy.ox; dy = p.y - joy.oy; } joy.dx = dx; joy.dy = dy; const m = Math.hypot(dx, dy) / joy.R; joy.v = m < 0.15 ? { x: 0, y: 0 } : { x: dx / joy.R, y: dy / joy.R }; } } });
      const end = e => { for (const t of e.changedTouches) { if (t.identifier === uiId) { uiId = null; this.ui.touchEnd(); } if (t.identifier === joy.id) { joy.id = null; joy.v = { x: 0, y: 0 }; this.ui.joy = null; } } };
      T.onTouchEnd(end); T.onTouchCancel && T.onTouchCancel(end);
      let last = Date.now(), acc = 0; const STEP = 1 / 60;
      let errN = 0;
      const loop = () => {
        requestAnimationFrame(loop);   // schedule first: an exception in this frame must not stop the game
        try { frame(); } catch (e) { if (errN++ < 5) console.error('[frame]', e && e.message, e && e.stack); }
      };
      const frame = () => {
        const now = Date.now(); let dt = Math.min(0.25, (now - last) / 1000); last = now; acc += dt * this.speed; let n = 0;
        while (acc >= STEP && n < 40) {
          if (this.paused) { acc = 0; break; }
          let v; if (this.autoplay && this.bot) v = this.bot.update(STEP); else v = r.screenToWorldDir(joy.v.x, joy.v.y);
          this.game.movePlayer(v.x, v.y, STEP); this.game.update(STEP); acc -= STEP; n++;
        }
        if (n >= 40) acc = 0;
        r.follow(this.paused ? 0 : dt); r.draw(this.paused ? 0 : dt); this.ui.update(this.paused ? 0 : dt); CST.Ads.update(this.paused ? 0 : dt);
      };
      requestAnimationFrame(loop);
      root.__game = game;
    }
  };

  // ---------------- load: UI art (main package) + atlases (subpackage 'res')
  const loadRes = () => new Promise(res => {
    if (!('loadSubpackage' in T) || typeof T.loadSubpackage !== 'function') return res();
    const task = T.loadSubpackage({ name: 'res', success: () => res(), fail: e => { console.warn('subpackage', e); res(); } });
    task && task.onProgressUpdate && task.onProgressUpdate(p => { progress = Math.max(progress, (p.progress || 0) / 100 * 0.6); });
  });
  CST.ART.load(CST.UIART_FILES).then(loadRes).then(() => { progress = Math.max(progress, 0.6); return CST.Assets.load(p => { progress = 0.6 + p * 0.38; }); })
    .then(() => { progress = 1; setTimeout(() => { loading = false; App.start(); }, 350); });
})(typeof window !== 'undefined' ? window : globalThis);

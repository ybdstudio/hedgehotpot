/* Boot: load assets, create game/renderer/UI, run the fixed-step loop, autosave. */
(function () {
  const CST = window.CST;
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  let storage = null; try { storage = window.localStorage; storage.setItem('__t', '1'); storage.removeItem('__t'); } catch (e) { storage = null; }

  const App = window.APP = {
    autoplay: params.get('autoplay') === '1',
    speed: Math.max(1, Math.min(20, +params.get('speed') || 1)),
    setAutoplay(v) { this.autoplay = v; if (v && !this.bot) this.bot = new CST.Bot(this.game); },
    // restart in place (no page reload: reloads can be blocked inside embedded viewers)
    resetGame() {
      const old = this.game; old.reset(); old.opts.storage = null; old.listeners = {};
      try { storage && storage.removeItem(CST.CONFIG.SAVE_KEY); } catch (e) { }
      const game = this.game = new CST.Game({ storage, seed: Date.now() & 0xffff, load: false });
      game.save();
      this.renderer.g = game; this.renderer.follow(0, true);
      this.ui.bindGame(game); this.ui.close && this.ui.close();
      if (this.bot) this.bot = new CST.Bot(game);
      window.__game = game; CST.Audio.on = game.S.settings.sound; CST.Minis.bind(game);
      this.ui.toast('New restaurant! Grab beef from the crate', 'c_box_salmon', true);
    },
    start(fresh) {
      if (fresh) { try { storage && storage.removeItem(CST.CONFIG.SAVE_KEY); } catch (e) { } }
      const game = this.game = new CST.Game({ storage, seed: Date.now() & 0xffff });
      CST.Audio.on = game.S.settings.sound;
      const canvas = $('game');
      const r = this.renderer = new CST.Renderer(canvas, game);
      r.zoomMul = +params.get('zoom') || 1; r.resize(); r.follow(0, true);
      this.input = new CST.Input(canvas, $('joy'));
      this.ui = new CST.UI(game, r, this);
      if (this.autoplay) this.setAutoplay(true);
      window.addEventListener('resize', () => r.resize());
      document.addEventListener('visibilitychange', () => { if (document.hidden && !this.skipSave) this.game.save(); });
      window.addEventListener('pagehide', () => { if (!this.skipSave) this.game.save(); });
      CST.Ads.init(this); CST.Minis.init(this);
      document.querySelectorAll('[data-art]').forEach(im => { im.src = (CST.UIART || {})[im.dataset.art] || ''; });
      this.ui.started = true;
      if (!game.loaded) setTimeout(() => this.ui.toast('Welcome! Grab beef from the crate', 'c_box_salmon', true), 400);
      else this.ui.toast('Welcome back!', 'c_fx_heart', true);
      let last = performance.now(), acc = 0; const STEP = 1 / 60;
      const loop = (now) => {
        let dt = Math.min(0.25, (now - last) / 1000); last = now;
        acc += dt * this.speed;
        let n = 0;
        while (acc >= STEP && n < 40) {
          if (this.paused) { acc = 0; break; }   // an ad is playing
          let v; if (this.autoplay && this.bot) v = this.bot.update(STEP); else { const s = this.input.vector(); v = r.screenToWorldDir(s.x, s.y); }
          const gm = this.game; gm.movePlayer(v.x, v.y, STEP); gm.update(STEP); acc -= STEP; n++;
        }
        if (n >= 40) acc = 0;
        r.follow(dt); r.draw(dt); this.ui.update(dt); CST.Ads.update(this.paused ? 0 : dt);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      window.__game = game;   // exposed for automated browser tests
    }
  };

  // ---------------- splash / loading ----------------
  $('splashArt').src = (CST.UIART || {}).loading || '';
  document.querySelector('link[rel="icon"]').href = (CST.UIART || {}).app_icon || 'data:,';
  let shown = 0, target = 0; const bar = () => { shown += (target - shown) * 0.18 + 0.004; shown = Math.min(shown, target); $('loadBar').style.width = Math.round(shown * 100) + '%'; $('loadTxt').textContent = shown >= 0.999 ? 'Ready!' : `Loading... ${Math.round(shown * 100)}%`; if (shown < 0.999) requestAnimationFrame(bar); };
  requestAnimationFrame(bar);
  CST.Assets.load(p => { target = p * 0.92; }).then(() => { target = 1;
    $('splashCat').src = CST.Assets.iconURL('staff_hero', 200);
    let hasSave = false; try { hasSave = !!(storage && storage.getItem(CST.CONFIG.SAVE_KEY)); } catch (e) { }
    $('btnPlay').textContent = hasSave ? 'Continue' : 'Play';
    $('btnNew').classList.toggle('hidden', !hasSave);
    const go = (fresh) => { CST.Audio.unlock(); $('splash').classList.add('hidden'); App.start(fresh); };
    $('btnPlay').onclick = () => go(false);
    $('btnNew').onclick = (e) => { if (!e.target.dataset.sure) { e.target.dataset.sure = 1; e.target.textContent = 'Tap again to erase your save'; return; } go(true); };
    // loading done -> straight into the game (Continue / Play no longer needed); sound unlocks on the first touch
    const unlock = () => { CST.Audio.unlock(); window.removeEventListener('pointerdown', unlock); }; window.addEventListener('pointerdown', unlock);
    if (params.get('autostart') === '1') go(params.get('fresh') === '1'); else setTimeout(() => { $('splash').classList.add('hidden'); App.start(false); }, 500);
  });
})();

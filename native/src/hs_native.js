/* HS TikTok SDK bridge (hs-game.js 3.x). Ads go through HSGame.showAd(<dashboard label>); the game keeps its own pacing
   (cooldowns, caps, "not while carrying") and only offers an ad when HSGame.canShowAd(label) says one is set up.
   Rewards: each rewarded place gives an item of category 'ad_effect' (the game applies that placement's effect, sized to
   the current economy); 'currency' items (coins / stars) are fixed amounts ops can add from the dashboard. Everything
   given arrives in onGive. Config (gameId, sdkKey, labels, defaults) is injected by tools/build_native.js as CST.HS_CONFIG. */
(function (root) {
  const CST = root.CST, A = CST.Ads, CFG = CST.HS_CONFIG;
  let HS = null;
  try { HS = typeof require === 'function' ? require('./hs-game.js') : null; } catch (e) { console.warn('[HS] hs-game.js not loaded', e && e.message); }
  if (!HS && root.HSGame) HS = root.HSGame;
  const H = CST.HS = { sdk: HS, cfg: CFG, started: false, pending: null, queue: [], result: null };
  if (!HS || !CFG) return;

  const place = slot => CFG.places[String(slot || '').split('_')[0]] || null;
  const category = id => { const it = HS.item(id) || (CFG.defaults.items || {})[id]; return it && it.category; };
  const hasEffect = items => !!items && Object.keys(items).some(id => category(id) === 'ad_effect');

  // ---------------------------------------------------------------- onGive: the one place HS rewards enter the game
  H.onGive = function (items, from) {
    for (const id in items) {              // validate everything first: throwing = HS records nothing, reward not lost
      const c = category(id);
      if (c === 'ad_effect') continue;
      if (c === 'currency' && (id === 'coins' || id === 'stars')) continue;
      throw new Error(`unknown item "${id}" (category ${c})`);
    }
    for (const id in items) {
      if (category(id) === 'ad_effect') { const p = H.pending; H.pending = null; if (p) p(); }   // effect of the ad being watched
      else H.queue.push([id, items[id], from]);
    }
    H.flush();
  };
  H.flush = function () {                    // currency can arrive before the restaurant is loaded (login, purchases)
    const app = root.APP, g = app && app.game; if (!g || !CST.Minis.g) return;
    while (H.queue.length) {
      const [id, n, from] = H.queue.shift();
      if (id === 'coins') CST.Minis.grant(n, 0, 'Reward');
      else { g.S.stars += n; g.save(); app.ui.toast(`Reward: +${n}★`, 'c_fx_heart', true); }
    }
  };
  H.start = function () {
    if (H.started) return; H.started = true;
    HS.start({ gameId: CFG.gameId, sdkKey: CFG.sdkKey, defaults: CFG.defaults, onGive: H.onGive, debug: !!root.__HS_DEBUG })
      .then(r => { H.result = r; console.log('[HS] start', JSON.stringify(r), 'sdk', HS.sdk ? HS.sdk.version : '-'); H.flush(); });
  };

  // ---------------------------------------------------------------- ads: same pacing, HS playback
  A.sdk = () => null;                                       // never create TikTok ad objects directly: HSGame does
  const canReward0 = A.canReward.bind(A), interBlocked0 = A.interBlocked.bind(A);
  A.canReward = function (slot, cd) { const l = place(slot); return !!l && canReward0(slot, cd) && HS.canShowAd(l); };
  A.interBlocked = function () { return interBlocked0() || (HS.canShowAd(CFG.places.inter) ? null : 'no_ad'); };
  A.reward = function (slot, grant) {
    if (this.busy) return;
    this._slot = slot; let given = false; this._grant = () => { if (!given) { given = true; grant(); } };
    this.log('ad_show', { type: 'reward', placement: slot, label: place(slot) });
    this.play('reward', ok => {
      if (!ok) { this.log('ad_fail', { type: 'reward', placement: slot, why: HS.lastAdError }); this.app.ui.toast(HS.lastAdError === 'skipped' ? 'Ad closed early – no reward' : 'Ad not available right now', 'c_fx_heart'); return; }
      this.slotT[slot.split('_')[0]] = this.t; this.lastReward = this.lastAny = this.t; this.shown.push([this.t, 'reward']);
      const d = (() => { try { return JSON.parse(localStorage.getItem('cst_rw_day')) || {}; } catch (e) { return {}; } })(), day = new Date().toISOString().slice(0, 10);
      try { localStorage.setItem('cst_rw_day', JSON.stringify({ day, n: (d.day === day ? d.n : 0) + 1 })); } catch (e) { }
      this.log('ad_complete', { type: 'reward', placement: slot });   // the effect itself ran in onGive
    });
  };
  A.play = function (type, done) {
    const label = type === 'reward' ? place(this._slot) : CFG.places.inter;
    this.busy = true; this.app.paused = true; CST.Audio && (CST.Audio.muted = true);
    let fin = false, guard = null;
    const end = ok => { if (fin) return; fin = true; clearTimeout(guard); H.pending = null; this.busy = false; this.app.paused = false; CST.Audio && (CST.Audio.muted = false); done(ok); };
    guard = setTimeout(() => end(false), 100000);            // never leave the game paused
    H.pending = type === 'reward' ? this._grant : null;
    HS.showAd(label).then(r => {
      if (r === null) { console.log('[HS] no ad at', label, '-', HS.lastAdError); return end(false); }
      if (type === 'reward' && hasEffect(r) && H.pending) { const p = H.pending; H.pending = null; p(); }   // (normally already run by onGive)
      end(true);
    }, e => { console.warn('[HS] showAd', label, e && e.message); end(false); });
  };

  H.start();   // once, at startup (before the loading screen finishes): login, dashboard config, pending orders
})(typeof window !== 'undefined' ? window : globalThis);

/* HS 3.2.4 bridge. Keep the existing 3.0 save API; the SDK owns ad delivery,
   mission verification, repeat limits and cloud transport. Vendor files stay byte-identical. */
(function (root) {
  const CST = root.CST, CFG = CST.HS_CONFIG;
  const HSGame = require('./hs-game.js');
  const H = CST.HS = { sdk: HSGame, cfg: CFG, app: null, result: null, started: false, pending: null, tapDepth: 0, pauseReasons: new Set() };
  H.tap = function (fn) { this.tapDepth++; try { return fn(); } finally { this.tapDepth--; } };
  H.pause = function (reason, value) {
    if (value) this.pauseReasons.add(reason); else this.pauseReasons.delete(reason);
    const paused = this.pauseReasons.size > 0;
    if (this.app) this.app.paused = paused;
    CST.Audio.muted = paused;
    const audio = CST.Audio.ctx;
    if (audio) { const method = paused ? 'suspend' : 'resume'; try { if (audio[method]) { const p = audio[method](); if (p && p.catch) p.catch(() => {}); } } catch (_) {} }
  };
  HSGame.on('pause', () => H.pause('sdk', true));
  HSGame.on('resume', () => H.pause('sdk', false));
  HSGame.on('otherDevice', () => {
    H.pause('account', true);
    if (!H.app) return;
    H.app.ui.popup({ title: 'Playing on another device', items: [
      { t: 'cap', text: 'Your restaurant is open on another phone. Play here to continue on this device.' },
      { t: 'btn', label: 'Play here', style: 'green', fn: () => HSGame.takeOver().then(r => {
        if (r.loggedIn) { H.pause('account', false); H.app.ui.closePopup(); }
        else H.app.ui.toast('Could not reconnect. Please try again.', 'c_fx_heart');
      }) }
    ] });
  });
  H.itemsText = function (items) {
    return Object.entries(items || {}).filter(([id,n]) => id[0] !== '$' && n > 0).map(([id,n]) => {
      const item = HSGame.item(id) || (CFG.defaults.items || {})[id] || {};
      return '+' + n + ' ' + (item.name || id);
    }).join(', ');
  };
  H.rewardText = key => {
    let items;
    switch (key) {
      case 'double_task_bonus': items = HSGame.rewards('double_task_bonus'); break;
      case 'finish_building': items = HSGame.rewards('finish_building'); break;
      case 'hedge_rush': items = HSGame.rewards('hedge_rush'); break;
      case 'vip_tip': items = HSGame.rewards('vip_tip'); break;
      case 'free_coins': items = HSGame.rewards('free_coins'); break;
      case 'rush_extend': items = HSGame.rewards('rush_extend'); break;
      case 'tiktok_profile': items = HSGame.rewards('tiktok_profile'); break;
      case 'tiktok_shortcut': items = HSGame.rewards('tiktok_shortcut'); break;
      case 'share': items = HSGame.rewards('share'); break;
      default: items = null;
    }
    return H.itemsText(items);
  };
  H.onGive = function (items) {
    const g = H.app && H.app.game;
    if (!g) throw new Error('Restaurant not ready to receive items');
    const effects = new Set(['double_task','finish_pad','hedge_rush','vip_tip','free_coins','rush_extend']);
    for (const id of Object.keys(items)) {
      const meta = HSGame.item(id) || CFG.defaults.items[id];
      if (!meta || !((meta.category === 'currency' && ['coins','stars'].includes(id)) || meta.category === 'ad_effect' && effects.has(id))) throw new Error('Unsupported reward item: ' + id);
      if (!Number.isFinite(items[id]) || items[id] < 0) throw new Error('Invalid reward amount: ' + id);
    }
    g.S.hsEffects = g.S.hsEffects || {};
    for (const [id, amount] of Object.entries(items)) {
      if (id === 'coins') g.S.coins += amount;
      else if (id === 'stars') g.S.stars += amount;
      else g.S.hsEffects[id] = (g.S.hsEffects[id] || 0) + amount;
    }
    const pending = H.pending;
    if (pending && !pending.applied && pending.item && g.S.hsEffects[pending.item] > 0) {
      pending.applied = true;
      pending.apply();
      g.S.hsEffects[pending.item]--;
    }
    // Atomic delivery for legacy games: save AFTER applying items, inside onGive.
    g.save();
    HSGame.save(g.serialize());
  };
  H.restore = function (data) {
    if (!H.app || !data || data.v !== CST.CONFIG.VERSION) return;
    const app = H.app, previous = app.game;
    const game = new CST.Game({ storage: previous.opts.storage, seed: Date.now() & 0xffff, load: false });
    const state = JSON.parse(JSON.stringify(data));
    Object.assign(game.S, state); game._pending = state;
    game.build(); game.restorePending(); game.loaded = true;
    app.game = game; app.renderer.g = game; app.renderer.follow(0, true);
    app.ui.bindGame(game); CST.Minis.bind(game);
    if (app.bot) app.bot = new CST.Bot(game);
    root.__game = game;
    // Save the SDK-selected snapshot back unchanged; do not combine wallets.
    if (game.opts.storage) game.opts.storage.setItem(game.C.SAVE_KEY, JSON.stringify(data));
    HSGame.save(data);
  };
  const originalSave = CST.Game.prototype.save;
  CST.Game.prototype.save = function () {
    originalSave.call(this);
    if (H.app && H.app.game === this) HSGame.save(this.serialize());
  };
  H.attach = function (app) {
    this.app = app;
    if (this.started) return;
    this.started = true;
    HSGame.start({ gameId: CFG.gameId || '', sdkKey: CFG.sdkKey || '', defaults: CFG.defaults,
      onGive: H.onGive, onLoad: H.restore, debug: false
    }).then(r => { H.result = r; if (!app.game.loaded) app.game.save(); }, e => {
      H.result = { loggedIn: false, reason: String(e) };
    });
  };
  HSGame.on('given', items => { if (H.app && H.app.ui) H.app.ui.toast(H.itemsText(items), 'c_fx_heart', true); });
})(typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis);

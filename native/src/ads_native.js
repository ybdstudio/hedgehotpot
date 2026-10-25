/* All native ads begin synchronously in a canvas tap. No retries, startup,
   idle, resume or timer-triggered ads. SDK/dashboard own delivery and cooldown. */
(function (root) {
  const CST = root.CST, HSGame = CST.HS.sdk;
  const label = slot => CST.HS.cfg.places[String(slot).split('_')[0]];
  const show = slot => {
    switch (String(slot).split('_')[0]) {
      case 'R1': return HSGame.showAd('double_task_bonus');
      case 'R2': return HSGame.showAd('finish_building');
      case 'R3': return HSGame.showAd('hedge_rush');
      case 'R4': return HSGame.showAd('vip_tip');
      case 'R5': return HSGame.showAd('free_coins');
      case 'R6': return HSGame.showAd('rush_extend');
      default: return Promise.resolve(null);
    }
  };
  const effect = { R1: 'double_task', R2: 'finish_pad', R3: 'hedge_rush', R4: 'vip_tip', R5: 'free_coins', R6: 'rush_extend' };
  const can = slot => {
    switch (String(slot).split('_')[0]) {
      case 'R1': return HSGame.canShowAd('double_task_bonus');
      case 'R2': return HSGame.canShowAd('finish_building');
      case 'R3': return HSGame.canShowAd('hedge_rush');
      case 'R4': return HSGame.canShowAd('vip_tip');
      case 'R5': return HSGame.canShowAd('free_coins');
      case 'R6': return HSGame.canShowAd('rush_extend');
      default: return false;
    }
  };
  const A = CST.Ads = {
    enabled: true, busy: false, t: 0, events: [], shown: [],
    sdk() { return HSGame; }, cfg() { return CST.CONFIG.ADS; },
    actionLabel(slot) {
      const id=effect[String(slot).split('_')[0]], g=this.app.game;
      return id && g.S.hsEffects && g.S.hsEffects[id]>0 ? 'Use saved reward' : 'Watch ad';
    },
    canReward(slot) {
      const id = effect[String(slot).split('_')[0]], g = this.app && this.app.game;
      const stored = id && g && g.S.hsEffects && g.S.hsEffects[id] > 0;
      return this.enabled && !this.busy && (stored || HSGame.has('ads') && can(slot));
    },
    reward(slot, apply) {
      if (!CST.HS.tapDepth || !this.canReward(slot)) return Promise.resolve(null);
      const H = CST.HS, prefix = String(slot).split('_')[0];
      const item = effect[prefix], g = this.app.game;
      if (item && g.S.hsEffects && g.S.hsEffects[item] > 0) {
        g.S.hsEffects[item]--; if (apply) apply(); g.save();
        return Promise.resolve({ [item]: 1 });
      }
      this.busy = true;
      const pending = H.pending = { item: effect[prefix], apply: apply || (() => {}), applied: false };
      // This call executes before leaving the original tap, never in a .then().
      const promise = show(slot);
      return promise.then(result => {
        if (result !== null) this.shown.push([this.t, 'reward']);
        else this.app.ui.toast('Ad unavailable or closed early. No reward.', 'c_fx_heart');
        return result;
      }, () => { this.app.ui.toast('Ad unavailable. Please try again.', 'c_fx_heart'); return null; })
        .finally(() => { if (H.pending === pending) H.pending = null; this.busy = false; });
    },
    canContinue() {
      const p = CST.HS.cfg.pacing || {};
      return p.interstitialEnabled && this.enabled && !this.busy && this.app.game.S.taskIndex >= p.interstitialAfterTasks && HSGame.has('ads') && HSGame.canShowAd('phase_continue');
    },
    continuePhase() {
      if (!CST.HS.tapDepth || !this.canContinue()) return Promise.resolve(null);
      this.busy = true;
      const result = HSGame.showAd('phase_continue');
      return result.finally(() => { this.busy = false; });
    },
    // Kept as a no-op for legacy callers; automated opportunities never show ads.
    tryInter() { return false; },
    interBlocked() { return this.canContinue() ? null : 'off'; },
    update(dt) { if (!this.app.paused) this.t += dt; },
    init(app) { this.app = app; }
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis);

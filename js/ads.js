/* Ads: rewarded + interstitial placements from 'Hedge Hotpot – Kịch bản Ads' (option B: inter cooldown 75 s).
   Uses the TikTok Minis SDK (window.TTMinis) when present; otherwise a short test-ad overlay so the flow can be played.
   Target: ~9 impressions / 10 min of play (5 inter at natural breaks + ~4 player-chosen rewarded). */
(function (root) {
  const CST = root.CST = root.CST || {};
  const $ = id => document.getElementById(id);
  const today = () => new Date().toISOString().slice(0, 10);
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };

  const Ads = CST.Ads = {
    enabled: true, busy: false, events: [], shown: [],          // shown: [sessionTime, 'inter'|'reward'] for the IPU readout
    t: 0, lastInter: -1e9, lastReward: -1e9, lastAny: 0, interCount: 0, slotT: {}, pending: null, still: 0,

    // TikTok Minis web SDK (TTMinis.*), or the native mini-game runtime (tt.* / TTMinis.game.*)
    sdk() { const M = root.TTMinis; for (const T of [M, M && M.game, root.tt]) if (T && (T.createRewardedVideoAd || T.createInterstitialAd)) return T; return null; },
    cfg() { return CST.CONFIG.ADS; },
    log(name, p) {
      const e = Object.assign({ ev: name, t: Math.round(this.t) }, p || {}); this.events.push(e); if (this.events.length > 400) this.events.shift();
      const T = root.TTMinis; if (T && T.reportEvent) try { T.reportEvent({ eventName: name, params: e }); } catch (er) { }
    },
    ipu10() { const from = this.t - 600; return this.shown.filter(s => s[0] >= from).length * (600 / Math.max(60, Math.min(600, this.t))); },

    // ---------------------------------------------------------------- rewarded
    rewardDay() { const d = ls.get('cst_rw_day', {}); return d.day === today() ? d.n : 0; },
    canReward(slot, cd) {
      if (!this.enabled || this.busy) return false;
      if (this.rewardDay() >= this.cfg().rewardCapDay) return false;
      return this.t - (this.slotT[slot.split('_')[0]] || -1e9) >= (cd === undefined ? this.cfg().rewardSlotCooldown : cd);   // slot = placement prefix (R1, R2 …)
    },
    reward(slot, grant) {
      if (this.busy) return;
      this.log('ad_show', { type: 'reward', placement: slot });
      this.play('reward', ok => {
        if (!ok) { this.log('ad_fail', { type: 'reward', placement: slot }); this.app.ui.toast('Ad not available right now', 'c_fx_heart'); return; }
        this.slotT[slot.split('_')[0]] = this.t; this.lastReward = this.lastAny = this.t; this.shown.push([this.t, 'reward']);
        const d = ls.get('cst_rw_day', {}); ls.set('cst_rw_day', { day: today(), n: (d.day === today() ? d.n : 0) + 1 });
        this.log('ad_complete', { type: 'reward', placement: slot }); grant();
      });
    },

    // ---------------------------------------------------------------- interstitial
    interBlocked() {
      const C = this.cfg(), g = this.app.game, S = g.S, P = g.player;
      if (!this.enabled || this.busy || S.noAds) return 'off';
      if (this.interCount >= C.interCapSession) return 'cap';
      if (this.t < C.interFirstDelay || S.taskIndex < C.interFirstTask) return 'early';
      if (this.t - this.lastInter < C.interCooldown) return 'cooldown';
      if (this.t - this.lastReward < C.interAfterReward) return 'after_reward';
      if (S.rushActive) return 'rush';
      if (P.hold && P.moving) return 'carrying';
      if (g.customers.some(c => c.kind !== 'reg' && (c.state === 'WAIT_ORDER' || c.state === 'EXTRA_WAIT'))) return 'vip_waiting';
      if (this.app.ui.popupOpen ? this.app.ui.popupOpen() : (!$('modal').classList.contains('hidden') || !$('minisPop').classList.contains('hidden'))) return 'popup';
      return null;
    },
    tryInter(trigger) {
      this.log('ad_opportunity', { type: 'inter', placement: trigger });
      const why = this.interBlocked(); if (why) return false;
      if (this.pending) return false;
      const go = () => {                                                        // let the reward fx finish first
        this.pending = null; if (this.interBlocked()) return;
        this.log('ad_show', { type: 'inter', placement: trigger });
        this.play('inter', ok => {
          if (!ok) { this.log('ad_fail', { type: 'inter', placement: trigger }); return; }   // a failed load does not use up the cooldown
          this.lastInter = this.lastAny = this.t; this.interCount++; this.shown.push([this.t, 'inter']);
          this.log('ad_complete', { type: 'inter', placement: trigger });
        });
      };
      if (this.cfg().interDelay <= 0) go(); else this.pending = setTimeout(go, this.cfg().interDelay * 1000);
      return true;
    },

    // ---------------------------------------------------------------- playback (SDK or test overlay); the game pauses meanwhile
    play(type, done) {
      this.busy = true; this.app.paused = true; CST.Audio && (CST.Audio.muted = true);
      const end = ok => { this.busy = false; this.app.paused = false; CST.Audio && (CST.Audio.muted = false); done(ok); };
      const T = this.sdk(), C = this.cfg();
      if (T) {
        try {
          const canR = !T.canIUse || T.canIUse(type === 'reward' ? 'createRewardedVideoAd' : 'createInterstitialAd');
          if (!canR) return end(false);
          const ad = type === 'reward' ? T.createRewardedVideoAd({ adUnitId: C.units.rewarded }) : T.createInterstitialAd({ adUnitId: C.units.inter });   // one instance per show
          let fin = false; const onErr = () => once(false), onClose = res => once(type === 'reward' ? !!(res && res.isEnded) : true);
          const once = ok => { if (fin) return; fin = true; try { ad.offClose && ad.offClose(onClose); ad.offError && ad.offError(onErr); } catch (e) { } end(ok); };
          ad.onError && ad.onError(onErr); ad.onClose && ad.onClose(onClose);
          const p = ad.show(); if (p && p.catch) p.catch(() => { const l = ad.load && ad.load(); if (l && l.then) l.then(() => ad.show()).catch(() => once(false)); else once(false); });   // native runtime: load then retry once
        } catch (e) { end(false); }
        return;
      }
      this.mock(type, end);
    },
    mock(type, end) {
      if (this.app.ui.mockAd) return this.app.ui.mockAd(type, end);
      const el = $('adMock'), sec = type === 'reward' ? 5 : 3; let left = sec;
      el.classList.remove('hidden'); el.querySelector('.ad-kind').textContent = type === 'reward' ? 'Rewarded ad' : 'Ad';
      const btn = el.querySelector('.ad-close'), cnt = el.querySelector('.ad-count'); btn.classList.add('hidden');
      const tick = () => {
        cnt.textContent = left > 0 ? (type === 'reward' ? `Reward in ${left}s` : `${left}`) : (type === 'reward' ? 'Reward earned!' : '');
        if (left <= 0) { btn.classList.remove('hidden'); return; }
        left--; this._mockT = setTimeout(tick, 1000);
      };
      btn.onclick = () => { el.classList.add('hidden'); end(true); };
      el.querySelector('.ad-skip').onclick = () => { clearTimeout(this._mockT); el.classList.add('hidden'); end(type !== 'reward'); };   // closing a rewarded ad early = no reward
      tick();
    },

    // ---------------------------------------------------------------- per-frame (from UI.update, real seconds)
    update(dt) {
      if (this.app.paused) return;
      this.t += dt; const g = this.app.game, P = g.player, C = this.cfg();
      this.still = (!P.moving && !P.hold) ? this.still + dt : 0;
      if (this.t - this.lastAny >= C.interFallback && this.still >= 2) this.tryInter('I6_idle');   // I6: nothing natural happened for a while
      // I7: the session's first interstitial comes at interFirstDelay without waiting for a natural break (checked 1x/s;
      // interBlocked still holds it while carrying / in a popup / during the rush)
      if (C.interFirstForce && this.interCount === 0 && this.t >= C.interFirstDelay && this.t - (this._firstTry || -9) >= 1) { this._firstTry = this.t; this.tryInter('I7_first'); }
    },
    init(app) {
      this.app = app;
      const p = new URLSearchParams(location.search);
      if (p.get('autostart') === '1' || p.get('noads') === '1') this.enabled = false;            // automated tests run without ads
      let hiddenAt = 0;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) hiddenAt = Date.now();
        else if (hiddenAt && Date.now() - hiddenAt >= this.cfg().resumeAfter * 1000) this.tryInter('I5_resume');
      });
      if (p.get('adsdebug') === '1') { const d = $('adDebug'); d.classList.remove('hidden'); setInterval(() => { d.textContent = `IPU/10m ${this.ipu10().toFixed(1)} · inter ${this.shown.filter(s => s[1] === 'inter').length} · reward ${this.shown.filter(s => s[1] === 'reward').length} · ${this.interBlocked() || 'inter ready'}`; }, 500); }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

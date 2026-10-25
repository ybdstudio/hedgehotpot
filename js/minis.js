/* TikTok Minis entry features (Add to home screen, Revisit gift, Share gift) + the rewarded-ad chips and
   interstitial triggers of the ads script. Rewards are a few minutes of the player's recent income, so they
   stay meaningful all game without breaking the economy. */
(function (root) {
  const CST = root.CST = root.CST || {};
  const $ = id => document.getElementById(id);
  const fmt = n => n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : String(Math.floor(n));
  const today = () => new Date().toISOString().slice(0, 10);
  const ART = k => (CST.UIART && CST.UIART[k]) || '';
  const T = () => root.TTMinis || root.tt || null;
  const TASK_ICO = '<span class="tico"><svg viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="18" rx="2.5" fill="#fff" stroke="#6b3a22" stroke-width="1.6"/><path d="M8.5 12.5l2.5 2.5 4.5-5" fill="none" stroke="#3aa856" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';   // the task card's clipboard: this chip doubles the task reward
  const G = () => { const t = root.TTMinis; return t && t.game ? t.game : (root.tt || t); };   // native runtime: tt.* (also TTMinis.game.*)            // docs show both TTMinis.game.* and TTMinis.*
  const can = (o, n) => !!(o && typeof o[n] === 'function' && (!o.canIUse || o.canIUse(n)));

  const Minis = CST.Minis = {
    chips: {}, phase: 0,
    init(app) {
      this.app = app; const ui = app.ui;
      $('mbAdd').onclick = () => this.popAdd(); $('mbRevisit').onclick = () => this.popRevisit(); $('mbShare').onclick = () => this.popShare();
      $('minisPop').addEventListener('pointerdown', e => { if (e.target.id === 'minisPop') this.closePop(); });
      document.querySelector('#hud-top .plus').onclick = e => { e.stopPropagation(); this.popCoins(); };
      const t = T(); if (t && t.on) try { t.on('minis.share', () => this.doShare(true)); } catch (e) { }   // share started from TikTok's own menu
      const close = ui.close.bind(ui); ui.close = () => { const had = this.bought; this.bought = false; close(); if (had) CST.Ads.tryInter('I4_shop_close'); };
      this.bind(app.game); this.refresh();
    },
    bind(g) {
      this.g = g; this.phase = g.phase;
      g.on('task', e => {
        const r = e.reward || {};
        if (!(r.coins || r.stars) || !CST.Ads.enabled || !CST.Ads.canReward('R1', CST.CONFIG.ADS.r1Cooldown)) { CST.Ads.tryInter('I2_task'); return; }
        this.chip('r1', `Double task reward|watch ad: ${this.app.ui.rewardText(r)} more`, TASK_ICO, 6, () => CST.Ads.reward('R1_task_x2', () => { if (r.coins) g.gain(r.coins, g.player.x, g.player.y - 70, false); if (r.stars) g.S.stars += r.stars; this.app.ui.toast(`Task reward doubled! ${this.app.ui.rewardText(r)}`, 'c_fx_heart', true); }),
          () => CST.Ads.tryInter('I2_task'));                                        // not taken -> natural break for an interstitial
      });
      g.on('unlock', u => { this.bought = true; if (u && u.id !== 'grand_open') CST.Ads.tryInter('I1_unlock'); });
      g.on('upgrade', () => { this.bought = true; });
      g.on('vipPaid', v => { if (!CST.Ads.canReward('R4', CST.CONFIG.ADS.vipTipCooldown || 150)) return; const extra = Math.round(v.bonus * (CST.CONFIG.ADS.vipTipMult - 1));
        this.chip('r4', `VIP tip x${CST.CONFIG.ADS.vipTipMult}|watch ad: +${fmt(extra)} coins`, 'armchair', 5, () => CST.Ads.reward('R4_vip_tip', () => g.gain(extra, v.x, v.y - 40))); });
      g.on('rushEnd', ok => { if (!ok && CST.Ads.enabled) this.popRush(); });
    },

    // ---------------------------------------------------------------- reward chips (right side)
    chip(id, text, icon, life, onTap, onExpire) {
      this.unchip(id);
      const d = document.createElement('button'); d.className = 'ad-chip'; d.innerHTML = `<span class="play">▶</span>${icon.startsWith('<') ? icon : `<img src="${CST.Assets.iconURL(icon, 48)}" alt="">`}<b>${text}</b>`; if (text.includes('|')) { const [a, b] = text.split('|'); d.querySelector('b').innerHTML = `${a}<small>${b}</small>`; d.classList.add('two'); }
      if (life) { const bar = document.createElement('i'); bar.style.animationDuration = life + 's'; d.appendChild(bar); }
      d.onclick = e => { e.stopPropagation(); CST.Audio.play('pop'); this.unchip(id, true); onTap(); };
      $('adChips').appendChild(d);
      this.chips[id] = { el: d, exp: life ? setTimeout(() => { this.unchip(id); onExpire && onExpire(); }, life * 1000) : null };
    },
    unchip(id) { const c = this.chips[id]; if (!c) return; clearTimeout(c.exp); c.el.remove(); delete this.chips[id]; },

    update() {
      const g = this.g, S = g.S, A = CST.Ads, C = CST.CONFIG.ADS;
      if (g.phase > this.phase) { this.phase = g.phase; A.tryInter('I3_phase'); }
      // R3 Hedge Rush
      const waiting = g.customers.filter(c => ['QUEUE', 'WAIT_FOR_SUSHI', 'WAIT_ORDER', 'EXTRA_WAIT'].includes(c.state)).length;
      if (A.enabled && S.adRushT <= 0 && waiting >= C.rushMinWaiting && A.canReward('R3', C.rushEvery) && A.t > (C.rushAfter || 60)) {
        if (!this.chips.r3) this.chip('r3', `Hedge Rush|${C.rushTime}s: staff faster, +${Math.round((C.rushPrice - 1) * 100)}% prices`, 'staff_hero', 0, () => A.reward('R3_rush', () => { S.adRushT = C.rushTime; this.app.ui.toast(`Hedge Rush! Staff work +${Math.round((C.rushStaff - 1) * 100)}% faster, prices +${Math.round((C.rushPrice - 1) * 100)}% for ${C.rushTime}s`, 'staff_hero', true); }));
      } else if (this.chips.r3 && (waiting < C.rushMinWaiting || S.adRushT > 0)) this.unchip('r3');
      $('adRush').classList.toggle('hidden', !(S.adRushT > 0)); if (S.adRushT > 0) $('adRushT').textContent = Math.ceil(S.adRushT) + 's';
      // R2 pad: standing on a build spot, out of coins, and the rest is at most 40% of its price
      const P = g.player; let pad = null;
      for (const u of g.C.UNLOCKS) { if (!g.padVisible(u) || !u.cost || Math.hypot(P.x - u.pad.x, P.y - u.pad.y) > 34) continue; const rem = u.cost - (S.padPaid[u.id] || 0); if (rem > 0 && S.coins < rem && rem <= u.cost * C.padShortMax) pad = { u, rem }; }
      if (pad && A.enabled && A.canReward('R2')) {
        if (!this.chips.r2 || this.chips.r2.id !== pad.u.id) { this.chip('r2', `Finish ${pad.u.name}`, pad.u.icon.startsWith('staff_') ? pad.u.icon : pad.u.icon, 0, () => A.reward('R2_pad', () => { const rem = pad.u.cost - (S.padPaid[pad.u.id] || 0); S.padPaid[pad.u.id] = pad.u.cost; g.addStat('earned', rem); g.completeUnlock(pad.u.id); })); this.chips.r2.id = pad.u.id; }
      } else if (this.chips.r2) this.unchip('r2');
      document.querySelector('#hud-top .plus').classList.toggle('adready', A.enabled && this.coinsWait() <= 0);
      this.refresh();
    },

    // ---------------------------------------------------------------- side buttons + state
    st() { const S = this.g.S; S.minis = S.minis || {}; return S.minis; },
    refresh() {
      const m = this.st(), d = today();
      $('mbAdd').querySelector('em').classList.toggle('hidden', !!m.addClaimed);
      $('mbRevisit').querySelector('em').classList.toggle('hidden', m.revisitDay === d);
      $('mbShare').querySelector('em').classList.toggle('hidden', m.shareDay === d);
    },
    closePop() { $('minisPop').classList.add('hidden'); },
    pop(title, hdr, body) {
      $('minisPop').innerHTML = `<div class="mp-card"><div class="mp-head"><img class="mp-hdr" src="${ART(hdr)}" alt=""><h2>${title}</h2><button class="mp-x" aria-label="Close">✕</button></div><div class="mp-body">${body}</div></div>`;
      $('minisPop').classList.remove('hidden'); $('minisPop').querySelector('.mp-x').onclick = () => this.closePop();
      CST.Audio.play('pop');
    },
    amount(min) { return this.g.rewardCoins(min); },
    grant(coins, stars, why) {
      const g = this.g; g.gain(coins, g.player.x, g.player.y - 70, false); if (stars) g.S.stars += stars;
      this.app.ui.toast(`${why}: +${fmt(coins)} coins${stars ? ` +${stars}★` : ''}`, 'c_fx_heart', true); g.save(); this.refresh();
    },
    steps(goTxt, step2, coinsN, claimable, claimTxt) {
      return `<div class="mp-step"><span class="n">1</span><b>Tap the button below.</b></div><button class="mp-btn yellow" id="mpGo">${goTxt}</button>
        <div class="mp-step"><span class="n">2</span><b>${step2.text}</b></div>${step2.art}
        <div class="mp-step"><span class="n">3</span><b>Claim rewards.</b></div>
        <div class="mp-coins"><img src="${ART('launch_coins')}" alt=""><span class="amt"><i class="cn"></i>+${fmt(coinsN)}</span></div>
        <p class="mp-note">${claimTxt}</p><button class="mp-btn ${claimable ? 'green' : 'off'}" id="mpClaim" ${claimable ? '' : 'disabled'}>${claimable ? 'Claim' : 'Claim'}</button>`;
    },
    // ---- Add to home screen: one-time reward
    popAdd() {
      const m = this.st(), M = CST.CONFIG.MINIS, n = this.amount(M.addMinutes);
      const draw = can2 => this.pop('Home Screen Gift', 'hdr_mega', this.steps(m.added ? 'Added ✓' : 'Add to Home Screen',
        { text: 'Open Hedge Hotpot Conveyor from the icon on your home screen.', art: `<img class="mp-strip" src="${ART('launch_phone')}" alt="">` }, n, can2,
        can2 ? 'Thanks for adding Hedge Hotpot Conveyor!' : 'Open the game from your home screen to claim.') + `<p class="mp-star">+${M.addStars}★ bonus</p>`);
      const wire = can2 => {
        draw(can2);
        $('mpGo').onclick = () => {
          const o = G();
          if (can(o, 'addShortcut')) o.addShortcut({ success: () => { m.added = true; this.g.save(); this.checkAdd(wire); }, fail: () => this.app.ui.toast('Could not add the shortcut', 'c_fx_heart') });
          else { m.added = true; this.g.save(); wire(true); }                     // outside TikTok (preview): treat as added
        };
        if (m.addClaimed) { const b = $('mpClaim'); b.textContent = 'Claimed ✓'; b.className = 'mp-btn off'; b.disabled = true; $('mpGo').textContent = 'Added ✓'; }
        $('mpClaim').onclick = () => { if (!can2 || m.addClaimed) return; m.addClaimed = true; this.closePop(); this.grant(n, M.addStars, 'Home screen reward'); };
      };
      this.checkAdd(wire);
    },
    checkAdd(wire) {
      const o = G(), m = this.st();
      if (can(o, 'getShortcutMissionReward')) o.getShortcutMissionReward({ success: r => wire(!!(r && r.canReceiveReward)), fail: () => wire(false) });
      else wire(!!m.added);
    },
    // ---- Revisit gift (TikTok profile sidebar): once a day
    popRevisit() {
      const m = this.st(), n = this.amount(CST.CONFIG.MINIS.revisitMinutes), done = m.revisitDay === today();
      const side = `<div class="mp-side"><div class="ph"><span>Profile</span><span class="tab">Recently played</span><div class="tile"><img src="${ART('app_icon')}" alt=""><b>Hedge Hotpot Conveyor</b></div></div><p>Find us under<br><b>Profile ▸ Recently played</b></p></div>`;
      const wire = can2 => {
        this.pop('Revisit Gift', 'hdr_mega', this.steps('Go', { text: 'Come back to Hedge Hotpot Conveyor from your TikTok profile.', art: side }, n, can2 && !done,
          done ? 'Come back tomorrow for another gift.' : 'Reopen the game from your profile to claim.'));
        $('mpGo').onclick = () => { const o = T(); if (can(o, 'startEntranceMission')) o.startEntranceMission({ complete: () => { } }); else { m.visited = today(); this.g.save(); wire(true); } };
        $('mpClaim').onclick = () => { if (!(can2 && !done)) return; m.revisitDay = today(); this.closePop(); this.grant(n, 0, 'Revisit gift'); };
      };
      const o = T();
      if (can(o, 'getEntranceMissionReward')) o.getEntranceMissionReward({ success: r => wire(!!(r && r.canReceiveReward)), fail: () => wire(false) });
      else wire(m.visited === today());
    },
    // ---- Share gift: once a day, granted only after a successful share
    popShare() {
      const m = this.st(), n = this.amount(CST.CONFIG.MINIS.shareMinutes), done = m.shareDay === today();
      this.pop('Share Rewards', 'hdr_share', `<div class="mp-art"><img src="${ART('share_art')}" alt=""><span class="amt"><i class="cn"></i>+${fmt(n)}</span></div>
        <p class="mp-cap">${done ? 'Shared today – come back tomorrow!' : 'Share to get free coins!'}</p>
        <button class="mp-btn ${done ? 'off' : 'green'}" id="mpShare" ${done ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5M5 13v6h14v-6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Share</button>`);
      $('mpShare').onclick = () => { if (!done) this.doShare(false, n); };
    },
    // Share: TikTok mini-game share = TTMinis.game.shareAppMessage, which opens the contact (friends) picker.
    // The older Minis web API (TTMinis.share) only works inside the client's own 'minis.share' event, so it is the fallback.
    doShare(fromMenu, n) {
      const m = this.st(); n = n || this.amount(CST.CONFIG.MINIS.shareMinutes);
      const ok = () => { if (m.shareDay === today()) return; m.shareDay = today(); this.closePop(); this.grant(n, 0, 'Share gift'); };
      const fail = () => this.app.ui.toast('Share cancelled – no reward this time', 'c_fx_heart');
      const query = 'from=share_gift&d=' + today();
      const t = root.TTMinis, tg = (t && t.game) || root.tt;
      if (tg && typeof tg.shareAppMessage === 'function') {
        try { tg.shareAppMessage({ query, success: () => ok(), fail: () => fail() }); } catch (e) { fail(); }
        return;
      }
      if (t && typeof t.share === 'function') {
        try { t.share(r => { if (r && r.is_success) ok(); else if (!fromMenu) fail(); }, { title: 'Hedge Hotpot Conveyor', desc: 'Run a cozy hedgehog hotpot bar with me!', query: { from: 'share_gift' } }); } catch (e) { fail(); }
        return;
      }
      if (fromMenu) return;
      // outside TikTok (browser / preview): system share sheet, else copy the link
      const copy = () => { try { navigator.clipboard.writeText(location.href).then(() => { this.app.ui.toast('Link copied – send it to a friend!', 'c_fx_heart', true); ok(); }, ok); } catch (e) { ok(); } };
      if (navigator.share) navigator.share({ title: 'Hedge Hotpot Conveyor', text: 'Run a cozy hedgehog hotpot bar with me!', url: location.href }).then(ok).catch(err => { if (err && err.name === 'AbortError') fail(); else copy(); });
      else copy();
    },
    // ---- R5: free coins from the '+' next to the coin counter
    // seconds until the free-coins video can be watched again (0 = ready)
    coinsWait() { const A = CST.Ads, C = CST.CONFIG.ADS; return Math.max(0, C.coinsAfter - A.t, C.coinsCooldown - (A.t - (A.slotT.R5 || -1e9))); },
    popCoins() {
      const A = CST.Ads, C = CST.CONFIG.ADS, n = this.amount(C.coinsMinutes);
      this.pop('Free Coins', 'hdr_mega', `<div class="mp-coins mpc-lg"><img src="${ART('launch_coins')}" alt=""><span class="amt"><i class="cn"></i>+${fmt(n)}</span></div>
        <p class="mp-cap" id="mpCap"></p><button class="mp-btn" id="mpAd"></button>`);
      const draw = () => {
        if (!$('mpAd')) return clearInterval(this._cw);
        const w = Math.ceil(this.coinsWait()), ok = A.enabled && w <= 0 && A.canReward('R5', 0);
        $('mpCap').textContent = ok ? 'Watch a short video for free coins!' : !A.enabled ? 'Ads are not available right now.' : 'Next free coins in';
        $('mpAd').className = 'mp-btn ' + (ok ? 'green' : 'off'); $('mpAd').disabled = !ok;
        $('mpAd').innerHTML = ok ? '<span class="play">▶</span>Watch' : (A.enabled ? `⏱ ${Math.floor(w / 60)}:${String(w % 60).padStart(2, '0')}` : 'Watch');
      };
      draw(); clearInterval(this._cw); this._cw = setInterval(draw, 500);
      $('mpAd').onclick = () => { if ($('mpAd').disabled) return; clearInterval(this._cw); this.closePop(); A.reward('R5_coins', () => this.grant(n, 0, 'Free coins')); };
    },
    // ---- R6: the Grand Opening rush ran out before 15 guests
    popRush() {
      const C = CST.CONFIG.ADS;
      this.pop('So Close!', 'hdr_mega', `<p class="mp-cap">The Grand Opening rush ended early.<br>Watch a video to keep it going for <b>${C.rushExtra} more seconds</b>.</p>
        <button class="mp-btn green" id="mpAd"><span class="play">▶</span>+${C.rushExtra}s Rush</button><button class="mp-link" id="mpNo">No thanks</button>`);
      $('mpNo').onclick = () => this.closePop();
      $('mpAd').onclick = () => { this.closePop(); CST.Ads.reward('R6_rush', () => this.g.continueRush(C.rushExtra)); };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

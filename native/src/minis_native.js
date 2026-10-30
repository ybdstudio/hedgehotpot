/* Canvas-only HS missions and reward offers. Amounts and limits are dashboard data. */
(function (root) {
  const CST = root.CST, HSGame = CST.HS.sdk;
  const M = CST.Minis = {
    app: null, g: null, chips: {}, chipList: [], phase: 0,
    today() { return new Date().toISOString().slice(0,10); },
    st() { return this.g.S.minis || (this.g.S.minis = {}); },
    init(app) { this.app = app; this.bind(app.game); },
    closePop() { this.app.ui.closePopup(); },
    bind(g) {
      this.chipList = []; this.chips = {}; this.g = g; this.phase = g.phase;
      g.on('task', event => {
        const reward = event.reward || {}, id = g.S.taskIndex;
        g.S.hsLastTaskReward = { id, reward };
        this.taskOffer(g.S.hsLastTaskReward);
      });
      g.on('vipPaid', vip => {
        const extra = Math.round(vip.bonus * (g.C.ADS.vipTipMult - 1));
        this.offer('r4', 'R4', 'VIP bonus tip', 'armchair', () => this.g.gain(extra, vip.x, vip.y - 40));
      });
      g.on('rushEnd', ok => { if (!ok && CST.Ads.canReward('R6')) this.popRush(); });
    },
    chip(id, text, icon, life, onTap) {
      this.unchip(id);
      const ch = { id, text, icon, life: 0, onTap, elapsed: 0, expires: life || 0 };
      this.chips[id] = ch; this.chipList.push(ch);
    },
    unchip(id) { delete this.chips[id]; this.chipList = this.chipList.filter(ch => ch.id !== id); },
    offer(id, slot, title, icon, apply, life = 8) {
      if (!CST.Ads.canReward(slot)) return;
      const key = CST.HS.cfg.places[slot];
      this.chip(id, title + '|' + CST.HS.rewardText(key), icon, life, () => CST.Ads.reward(slot, apply));
    },
    taskOffer(last) {
      if (!last || (this.g.S.hsTaskAds || {})[last.id]) return;
      const g = this.g, reward = last.reward;
      this.offer('r1', 'R1', 'Extra task reward', 'task', () => {
        const g = this.g;
        g.S.hsTaskAds = g.S.hsTaskAds || {}; if (g.S.hsTaskAds[last.id]) return;
        g.S.hsTaskAds[last.id] = true;
        if (reward.coins) g.gain(reward.coins, g.player.x, g.player.y - 70, false);
        if (reward.stars) g.S.stars += reward.stars;
      });
    },
    entries() {
      const list = [];
      if (HSGame.has('tiktok_missions')) {
        if (!HSGame.tiktokMission.done('profile')) list.push({ id: 'entry', icon:'ico_revisit', a:'Entry', b:'Reward', badge:true, tap:() => M.popRevisit() });
        if (!HSGame.tiktokMission.done('shortcut')) list.push({ id:'launch', icon:'ico_add', a:'Launch', b:'Reward', badge:true, tap:() => M.popAdd() });
      }
      if (HSGame.has('share') && HSGame.canShare()) list.push({ id:'share', icon:'ico_share', a:'Share', b:'Reward', badge:HSGame.available('share'), tap:() => M.popShare() });
      return list;
    },
    update(dt) {
      const g = this.g, A = CST.Ads, C = g.C.ADS;
      if (!g || this.app.paused) return;
      for (const ch of [...this.chipList]) { ch.elapsed += dt || .12; if (ch.expires && ch.elapsed >= ch.expires) this.unchip(ch.id); }
      // Remove stale offers as soon as dashboard/capability/cooldown changes.
      for (const [id,slot] of [['r1','R1'],['r2','R2'],['r3','R3'],['r4','R4']]) if (this.chips[id] && !A.canReward(slot)) this.unchip(id);
      if (g.phase > this.phase) {
        this.phase = g.phase;
        if (A.canContinue()) this.chip('continue', 'Continue - ad|Next restaurant phase', 'gate', 12, () => A.continuePhase());
      }
      if (this.chips.continue && !A.canContinue()) this.unchip('continue');
      if (!this.chips.r1 && g.S.hsEffects && g.S.hsEffects.double_task > 0) this.taskOffer(g.S.hsLastTaskReward);
      const waiting = g.customers.filter(c => ['QUEUE','WAIT_FOR_SUSHI','WAIT_ORDER','EXTRA_WAIT'].includes(c.state)).length;
      if (g.S.adRushT <= 0 && waiting >= C.rushMinWaiting && !this.chips.r3) this.offer('r3','R3','Hedge Rush','staff_hero', () => { this.g.S.adRushT = this.g.C.ADS.rushTime; });
      if (g.S.adRushT > 0 || waiting < C.rushMinWaiting) this.unchip('r3');
      let pad = null;
      for (const u of g.C.UNLOCKS) {
        if (!g.padVisible(u) || !u.cost || Math.hypot(g.player.x-u.pad.x,g.player.y-u.pad.y)>34) continue;
        const rem = u.cost - (g.S.padPaid[u.id] || 0);
        if (rem>0 && g.S.coins<rem && rem<=u.cost*C.padShortMax) pad = u;
      }
      if (pad && !this.chips.r2) {
        const target = pad;
        this.offer('r2','R2','Finish ' + target.name,target.icon, () => {
          const g = this.g;
          if (g.has(target.id)) return;
          g.S.padPaid[target.id] = target.cost; g.completeUnlock(target.id);
        },0);
        if (this.chips.r2) this.chips.r2.target = target.id;
      } else if (!pad || this.chips.r2 && this.chips.r2.target !== pad.id) this.unchip('r2');
    },
    coinsWait() { return CST.Ads.canReward('R5') ? 0 : Infinity; },
    popAdd() {
      if (!HSGame.has('tiktok_missions')) return;
      this.app.ui.popup({ title:'Launch Reward', hdr:'hdr_mega', items:[
        {t:'step',n:1,text:'Tap Go below.'}, {t:'step',n:2,text:'Add the game to your home screen.'},
        {t:'step',n:3,text:'Open Hedge Hotpot from the new icon.'},
        {t:'step',n:4,text:'TikTok verifies completion and sends the reward.'},
        {t:'cap',text:CST.HS.rewardText('tiktok_shortcut')},
        {t:'btn',label:'Go',style:'green',fn:() => HSGame.tiktokMission.start('shortcut')}
      ] });
    },
    popRevisit() {
      if (!HSGame.has('tiktok_missions')) return;
      this.app.ui.popup({ title:'Entry Reward', hdr:'hdr_mega', items:[
        {t:'step',n:1,text:'Go to your TikTok profile.'}, {t:'step',n:2,text:'Open TikTok Minis.'},
        {t:'step',n:3,text:'Open Hedge Hotpot from there.'},
        {t:'step',n:4,text:'Come back; TikTok verifies and sends the reward.'},
        {t:'cap',text:CST.HS.rewardText('tiktok_profile')},
        {t:'btn',label:'Go',style:'green',fn:() => HSGame.tiktokMission.start('profile')}
      ] });
    },
    popShare() {
      if (!HSGame.has('share') || !HSGame.canShare()) return;
      const available = HSGame.available('share');
      this.app.ui.popup({ title:'Share', hdr:'hdr_share', items:[
        {t:'img',art:'share_art'}, {t:'cap',text:available ? 'Share the game with friends. ' + CST.HS.rewardText('share') : 'Reward already received today.'},
        {t:'btn',label:'Share',style:'green',fn:() => HSGame.share({title:'Hedge Hotpot',subtitle:'Run a cozy hedgehog hotpot restaurant.'})}
      ] });
    },
    popCoins() {
      if (!CST.Ads.canReward('R5')) return;
      this.app.ui.popup({ title:'Free Coins', hdr:'hdr_mega', items:[
        {t:'img',art:'launch_coins'}, {t:'cap',text:CST.HS.rewardText('free_coins')},
        {t:'btn',label:CST.Ads.actionLabel('R5'),style:'green',fn:() => { this.closePop(); CST.Ads.reward('R5', () => {
          const g=this.g; g.gain(g.rewardCoins(g.C.ADS.coinsMinutes),g.player.x,g.player.y-70,false);
        }); }}
      ] });
    },
    popRush() {
      if (!CST.Ads.canReward('R6')) return;
      this.app.ui.popup({ title:'Keep the rush going?', hdr:'hdr_mega', items:[
        {t:'cap',text:CST.HS.rewardText('rush_extend')},
        {t:'btn',label:CST.Ads.actionLabel('R6'),style:'green',fn:() => { this.closePop(); CST.Ads.reward('R6', () => this.g.continueRush(this.g.C.ADS.rushExtra)); }},
        {t:'link',text:'No thanks',fn:() => this.closePop()}
      ] });
    }
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis);

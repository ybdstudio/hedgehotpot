/* DOM UI: HUD, task card, bottom nav panels (Shop / Upgrade / Task / Map / Settings), toasts, modals. */
(function (root) {
  const CST = root.CST = root.CST || {};
  const $ = id => document.getElementById(id);
  const fmt = n => { n = Math.floor(n); return n >= 100000 ? (n / 1000).toFixed(0) + 'k' : n >= 10000 ? (n / 1000).toFixed(1) + 'k' : n.toLocaleString('en-US'); };
  const UP_DESC = {
    beltSpeed: lv => `Belt speed ${CST.CONFIG.BELT.speed[lv]} → ${CST.CONFIG.BELT.speed[lv + 1] || '—'}`,
    beltCap: lv => `Belt A plates ${CST.CONFIG.BELT.capA[lv]} → ${CST.CONFIG.BELT.capA[lv + 1] || '—'}`,
    carry: lv => `Carry ${CST.CONFIG.PLAYER.carry[lv]} → ${CST.CONFIG.PLAYER.carry[lv + 1] || '—'} items`,
    move: lv => `Walk speed ${CST.CONFIG.PLAYER.speed[lv]} → ${CST.CONFIG.PLAYER.speed[lv + 1] || '—'}`,
    prod: lv => `Prep speed x${CST.CONFIG.PROD_MULT[lv]} → x${CST.CONFIG.PROD_MULT[lv + 1] || '—'}`,
    clean: lv => `Cleaning ${CST.CONFIG.CLEAN.time[lv]}s → ${CST.CONFIG.CLEAN.time[lv + 1] || '—'}s / plate`,
    staff: lv => `Staff speed x${CST.CONFIG.STAFF_MULT[lv]} → x${CST.CONFIG.STAFF_MULT[lv + 1] || '—'}`
  };

  class UI {
    constructor(game, renderer, app) {
      this.g = game; this.r = renderer; this.app = app; this.panel = null; this.t = 0;
      document.querySelectorAll('#nav button').forEach(b => b.addEventListener('click', () => { CST.Audio.unlock(); CST.Audio.play('pop'); this.open(b.dataset.panel); }));
      $('sheetClose').addEventListener('click', () => this.close());
      // AUTO: the bot plays; while it plays the speed button cycles x1 -> x2 -> x3 (back to x1 when AUTO goes off)
      // created here (not in index.html) so every build's HTML (web platforms, emulator) gets it
      if (!$('autoBtn')) {
        const row = document.querySelector('#hud-top .hud-row.sub') || document.getElementById('hud-top');
        const box = document.createElement('div'); box.className = 'auto-ctl';
        box.innerHTML = '<button id="autoBtn" class="autob" aria-pressed="false">AUTO</button><button id="spdBtn" class="autob spd hidden" aria-label="Game speed">x1</button>';
        if (row) row.appendChild(box);
      }
      const syncAuto = () => {
        const on = !!this.app.autoplay; $('autoBtn').classList.toggle('on', on); $('autoBtn').setAttribute('aria-pressed', on);
        $('spdBtn').classList.toggle('hidden', !on); $('spdBtn').textContent = 'x' + this.app.speed;
      };
      this.syncAuto = syncAuto;
      $('autoBtn').addEventListener('click', e => { e.stopPropagation(); const on = !this.app.autoplay; this.app.setAutoplay(on); if (!on) this.app.speed = 1; syncAuto(); });
      $('spdBtn').addEventListener('click', e => { e.stopPropagation(); this.app.speed = this.app.speed >= 3 ? 1 : this.app.speed + 1; syncAuto(); });
      syncAuto();
      $('sheet').addEventListener('pointerdown', e => { if (e.target.id === 'sheet') this.close(); });
      $('task').addEventListener('click', () => this.open('tasks'));
      this.bindGame(game);
    }
    bindGame(game) {
      this.g = game;
      game.on('task', e => { this.toast(`Task complete! ${this.rewardText(e.reward)}`, 'c_fx_heart', true); $('task').classList.remove('flash'); void $('task').offsetWidth; $('task').classList.add('flash'); this.vib(30); });
      game.on('unlock', u => { if (u) this.toast(`${u.name} unlocked!`, u.icon, true); this.vib(40); this.refreshPanel(); });
      game.on('upgrade', k => { this.toast(`${CST.CONFIG.UPGRADES[k].name} upgraded!`, CST.CONFIG.UPGRADES[k].icon); this.refreshPanel(); });
      game.on('bonus', b => this.toast(`Bonus: ${b.t} ${this.rewardText(b.reward)}`, 'c_fx_heart', true));
      game.on('hire', a => { if (this.started) this.toast(`${this.staffName(a.role)} joined the team!`, ({ chef: 'staff_waiter', chef2: 'staff_waiter', waiter: 'staff_server' }[a.role] || 'staff_' + a.role)); });
      game.on('boost', () => this.toast('Manager boost! Everyone works x1.5', 'staff_manager', true));
      game.on('rush', () => this.toast('GRAND OPENING RUSH! Double pay!', 'gate', true));
      game.on('rushEnd', ok => { if (!ok) this.toast('Rush ended – step on the Grand Opening pad to try again!', 'gate'); });
      game.on('complete', () => this.complete());
      game.on('sfx', s => CST.Audio.play(s));
      game.on('upgradeSpot', sp => { if (!this.panel) { CST.Audio.play('pop'); this.open('upgrade', sp); } });
    }
    staffName(r) { return { chef: 'Waiter Hedgehog', chef2: 'Waiter Hedgehog #2', cashier: 'Cashier Hedgehog', cleaner: 'Cleaner Hedgehog', waiter: 'Server Hedgehog', manager: 'Manager Hedgehog' }[r] || r; }
    vib(ms) { const ua = navigator.userActivation; if (this.g.S.settings.vib && navigator.vibrate && (!ua || ua.hasBeenActive)) try { navigator.vibrate(ms); } catch (e) { } }
    rewardText(r) { const p = []; if (r && r.coins) p.push(`+${r.coins} coins`); if (r && r.stars) p.push(`+${r.stars}★`); return p.join(' '); }
    toast(text, icon, gold) {
      const d = document.createElement('div'); d.className = 'toast' + (gold ? ' gold' : '');
      if (icon) { const im = new Image(); im.src = CST.Assets.iconURL(icon, 64); d.appendChild(im); }
      d.appendChild(document.createTextNode(text)); $('toasts').appendChild(d);
      while ($('toasts').children.length > 2) $('toasts').firstChild.remove();
      setTimeout(() => d.remove(), 2300);
    }
    update(dt) {
      this.t += dt; const g = this.g, S = g.S;
      if (this.t < 0.12) return; this.t = 0;
      if (CST.Minis && CST.Minis.g) CST.Minis.update();
      $('coins').textContent = fmt(S.coins); $('stars').textContent = S.stars;
      const pm = Math.round((g.priceMult() - 1) * 100); $('rating').textContent = pm > 0 ? `+${pm}% prices` : '';
      const tot = CST.CONFIG.TASKS.length, ph = g.phase;
      $('phaseName').textContent = S.done ? 'Complete!' : `P${ph} · ${CST.CONFIG.PHASE_NAMES[ph]}`;
      const pct = Math.round(Math.min(1, S.taskIndex / tot) * 100); $('phasePct').textContent = `${Math.min(S.taskIndex, tot)}/${tot}`; $('phaseBar').style.width = pct + '%';
      const t = g.task();
      if (t) {
        const p = g.taskProgress(); $('taskText').textContent = t.t;
        $('taskBar').style.width = (p.cur / p.n * 100) + '%';
        let cnt = `${fmt(p.cur)}/${fmt(p.n)}`;
        if (t.type === 'unlock') { const u = g.unlockDef(t.id2); const rem = u.cost - (S.padPaid[u.id] || 0); cnt = u.cost ? `${fmt(Math.min(S.coins, rem))}/${fmt(rem)} coins` : 'Walk onto the pad'; $('taskBar').style.width = (u.cost ? Math.min(1, S.coins / Math.max(1, rem)) * 100 : 100) + '%'; }
        if (t.type === 'upgrade') { const i = g.upgradeInfo(t.id2); cnt = i.cost ? `Lv ${i.lv}/${t.lv} · ${fmt(i.cost)} coins` : `Lv ${i.lv}/${t.lv}`; }
        $('taskCount').textContent = cnt; $('taskReward').textContent = this.rewardText(t.reward);
      } else { $('taskText').textContent = 'All tasks complete — keep growing your restaurant!'; $('taskBar').style.width = '100%'; $('taskCount').textContent = ''; $('taskReward').textContent = ''; }
      const b = g.bonusTask(); $('bonus').textContent = b ? `Bonus: ${b.t} (${fmt(b.cur)}/${fmt(b.n)})` : '';
      if (S.boostT > 0) { $('boost').classList.remove('hidden'); $('boostT').textContent = Math.ceil(S.boostT) + 's'; } else $('boost').classList.add('hidden');
      if (S.rushActive) { $('rush').classList.remove('hidden'); $('rush').textContent = `GRAND OPENING RUSH ${Math.ceil(S.rushT)}s · served ${g.stat('rushServed')}/${CST.CONFIG.RUSH.goal}`; } else $('rush').classList.add('hidden');
      // notification dots
      const canUp = Object.keys(CST.CONFIG.UPGRADES).some(k => { const i = g.upgradeInfo(k); return !i.locked && i.cost !== null && S.coins >= i.cost; });
      $('upDot').classList.toggle('hidden', !canUp);
      const canShop = CST.CONFIG.UNLOCKS.some(u => g.padVisible(u) && S.coins >= u.cost - (S.padPaid[u.id] || 0));
      $('shopDot').classList.toggle('hidden', !canShop);
      this.offArrow();
      if (!this.hintGone && (S.time > 25 || this.g.stat('ingPicked') > 0)) { this.hintGone = true; $('hint').classList.add('gone'); }
      if (this.panel === 'map') this.drawMap();
      else if (this.panel) { this.panelT = (this.panelT || 0) + 1; if (this.panelT % 8 === 0) this.refreshPanel(); }
    }
    offArrow() {
      const el = $('offarrow'), tg = this.r.lastTarget; el.classList.add('hidden'); return;   // Cat Pizza style: no edge circle, the ground pointer by the chef guides instead
      if (!tg || this.r.targetOnScreen) { el.classList.add('hidden'); return; }
      const s = this.r.w2s(tg.x, tg.y - 40), d = this.r.dpr; const W = this.r.cssW, H = this.r.cssH;
      const cx = W / 2, cy = H / 2; let dx = s.x / d - cx, dy = s.y / d - cy;
      const k = Math.min((W / 2 - 34) / Math.abs(dx || 1e-3), (H / 2 - 120) / Math.abs(dy || 1e-3));
      el.style.left = (cx + dx * k) + 'px'; el.style.top = (cy + dy * k + 20) + 'px'; el.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      el.classList.remove('hidden');
    }

    // ---------------------------------------------------------------- panels
    open(name, filter) { this.upFilter = filter || null; return this._open(name); }
    _open(name) { this.panel = name; $('sheet').classList.remove('hidden'); this.refreshPanel(); }
    close() { this.panel = null; $('sheet').classList.add('hidden'); }
    refreshPanel() {
      if (!this.panel) return; const fn = this['panel_' + this.panel]; if (!fn) return;
      const st = $('sheetBody').scrollTop; fn.call(this); $('sheetBody').scrollTop = st;
    }
    img(key) { return `<img src="${CST.Assets.iconURL(key, 88)}" alt="">`; }
    panel_shop() {
      const g = this.g, S = g.S; $('sheetTitle').textContent = 'Shop · Expansion & Staff';
      let h = `<div class="sec">Walk onto a price pad in the restaurant, or buy here</div>`;
      for (const u of CST.CONFIG.UNLOCKS) {
        const owned = g.has(u.id), vis = g.padVisible(u), rem = u.cost - (S.padPaid[u.id] || 0);
        let btn;
        if (owned) btn = `<button class="btn gray" disabled>Owned</button>`;
        else if (!vis) btn = `<button class="btn gray" disabled>Phase ${u.phase}</button>`;
        else if (S.coins >= rem) btn = `<button class="btn" data-buy="${u.id}">${rem ? fmt(rem) : 'Start'}</button>`;
        else btn = `<button class="btn pink" data-go="${u.id}">Need ${fmt(rem)}</button>`;
        h += `<div class="row ${owned ? 'done' : ''}">${this.img(u.icon)}<div class="meta"><b>${u.name}</b><small>${owned ? 'Unlocked' : `Phase ${u.phase} · ${fmt(u.cost)} coins`}</small></div>${btn}</div>`;
      }
      $('sheetBody').innerHTML = h;
      $('sheetBody').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { if (this.g.buyUnlock(b.dataset.buy)) this.refreshPanel(); });
      $('sheetBody').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { this.close(); this.toast('Earn more coins, then walk onto the pad', 'c_fx_heart'); });
    }
    panel_upgrade() {
      const g = this.g; $('sheetTitle').textContent = 'Upgrades';
      let h = '';
      const only = this.upFilter; $('sheetTitle').textContent = only ? only.name : 'Upgrades';
      for (const k in CST.CONFIG.UPGRADES) {
        if (only && !only.keys.includes(k)) continue;
        const U = CST.CONFIG.UPGRADES[k], i = g.upgradeInfo(k);
        const pips = Array.from({ length: i.max }, (_, n) => `<i class="${n < i.lv ? 'on' : ''}"></i>`).join('');
        let btn;
        if (i.cost === null) btn = `<button class="btn gray" disabled>MAX</button>`;
        else if (i.locked) btn = `<button class="btn gray" disabled>Phase ${i.needPhase}</button>`;
        else btn = `<button class="btn" data-up="${k}" ${g.S.coins < i.cost ? 'disabled' : ''}>${fmt(i.cost)}</button>`;
        h += `<div class="row">${this.img(U.icon)}<div class="meta"><b>${U.name}</b><small>${i.cost === null ? 'Maxed out' : UP_DESC[k](i.lv)}</small><div class="pips">${pips}</div></div>${btn}</div>`;
      }
      $('sheetBody').innerHTML = h;
      $('sheetBody').querySelectorAll('[data-up]').forEach(b => b.onclick = () => { if (this.g.buyUpgrade(b.dataset.up)) this.refreshPanel(); });
    }
    panel_tasks() {
      const g = this.g; $('sheetTitle').textContent = 'Tasks';
      let h = ''; const b = g.bonusTask();
      if (b) h += `<div class="sec">Bonus task</div><div class="row">${this.img('c_fx_heart')}<div class="meta"><b>${b.t}</b><small>${fmt(b.cur)}/${fmt(b.n)} · ${this.rewardText(b.reward)}</small></div></div>`;
      let ph = 0;
      CST.CONFIG.TASKS.forEach((t, i) => {
        if (t.ph !== ph) { ph = t.ph; h += `<div class="sec">Phase ${ph} · ${CST.CONFIG.PHASE_NAMES[ph]}</div>`; }
        const done = i < g.S.taskIndex, cur = i === g.S.taskIndex;
        const p = cur ? g.taskProgress() : null;
        h += `<div class="row ${done ? 'done' : ''} ${cur ? 'current' : ''}"><div class="meta"><b>${done ? '✓ ' : ''}${t.t}</b><small>${cur ? `In progress · ${fmt(p.cur)}/${fmt(p.n)}` : done ? 'Done' : 'Locked'} · ${this.rewardText(t.reward) || '—'}</small></div></div>`;
      });
      $('sheetBody').innerHTML = h;
    }
    panel_map() {
      $('sheetTitle').textContent = 'Restaurant Map';
      $('sheetBody').innerHTML = `<canvas id="mapCanvas" width="640" height="560"></canvas><div class="sec" id="mapInfo"></div>`;
      this.drawMap();
    }
    drawMap() {
      const cv = $('mapCanvas'); if (!cv) return; const c = cv.getContext('2d'), g = this.g, W = g.C.WORLD, K = g.C.ISO.K;
      const s = cv.width / ((W.W + W.H) * K + 40);
      c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#9fd36b'; c.fillRect(0, 0, cv.width, cv.height);
      c.setTransform(s * K, s * K / 2, -s * K, s * K / 2, (W.H * K + 20) * s, 60);
      const col = { tile: '#f3dcb5', wood: '#d9a66b', rug: '#d9535d', stone: '#cfcac4', tatami: '#d8cf8c' };
      for (const k in g.C.LAYOUT.zones) { const z = g.C.LAYOUT.zones[k]; c.globalAlpha = g.has(z.unlock) ? 1 : 0.35; c.fillStyle = col[z.floor]; c.fillRect(z.x, z.y, z.w, z.h); c.globalAlpha = 1; c.strokeStyle = 'rgba(90,50,25,.4)'; c.lineWidth = 3; c.strokeRect(z.x, z.y, z.w, z.h); }
      const b = g.conv.belts.A; c.fillStyle = '#45414a'; c.fillRect(b.x0 - b.R, b.cy - b.R, b.Ls + 2 * b.R, 2 * b.R);
      for (const k in g.stations) { const st = g.stations[k]; c.fillStyle = '#8a5a34'; c.fillRect(st.x - 38, st.y - 23, 76, 46); }
      for (const id in g.tables) { const t = g.tables[id]; c.fillStyle = '#a0612f'; c.fillRect(t.x - 22, t.y - 22, 44, 44); }
      const dot = (x, y, r, f) => { c.fillStyle = f; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
      for (const u of g.C.UNLOCKS) if (g.padVisible(u)) dot(u.pad.x, u.pad.y, 16, '#ffcf3d');
      for (const a of g.customers) dot(a.x, a.y, 9, a.kind === 'reg' ? '#ff9f43' : '#ff4fa3');
      for (const a of g.staff) dot(a.x, a.y, 11, '#3fbf5e');
      dot(g.player.x, g.player.y, 16, '#ffffff'); dot(g.player.x, g.player.y, 12, '#ff2f5e');
      const info = $('mapInfo'); if (info) info.textContent = `Stools ${Object.values(g.seats).filter(s => s.belt).length} · Table seats ${Object.values(g.seats).filter(s => s.table).length} · VIP ${Object.values(g.seats).filter(s => s.vip).length} · Staff ${g.staff.length}`;
    }
    panel_settings() {
      const g = this.g, S = g.S.settings; $('sheetTitle').textContent = 'Settings';
      const play = Math.floor(g.stat('playTime'));
      $('sheetBody').innerHTML = `
        <div class="row toggle"><div class="meta"><b>Sound</b></div><button class="btn ${S.sound ? '' : 'gray'}" id="tSound">${S.sound ? 'On' : 'Off'}</button></div>
        <div class="row toggle"><div class="meta"><b>Vibration</b></div><button class="btn ${S.vib ? '' : 'gray'}" id="tVib">${S.vib ? 'On' : 'Off'}</button></div>
        <div class="row toggle"><div class="meta"><b>Autoplay demo</b><small>Let the hedgehog play by itself (testing)</small></div><button class="btn ${this.app.autoplay ? '' : 'gray'}" id="tAuto">${this.app.autoplay ? 'On' : 'Off'}</button></div>
        <div class="row"><div class="meta"><b>Progress</b><small>Played ${Math.floor(play / 60)}m ${play % 60}s · ${g.stat('paid')} customers served · saved automatically</small></div><button class="btn" id="tSave">Save</button></div>
        <div class="row"><div class="meta"><b>Reset restaurant</b><small>Deletes your save on this device</small></div><button class="btn pink" id="tReset">Reset</button></div>
        <div class="sec">Hedge Tasco · v${CST.CONFIG.VERSION}.0</div>`;
      $('tSound').onclick = () => { S.sound = !S.sound; CST.Audio.on = S.sound; g.save(); this.refreshPanel(); };
      $('tVib').onclick = () => { S.vib = !S.vib; g.save(); this.refreshPanel(); };
      $('tAuto').onclick = () => { this.app.setAutoplay(!this.app.autoplay); if (!this.app.autoplay) this.app.speed = 1; this.syncAuto && this.syncAuto(); this.refreshPanel(); };
      $('tSave').onclick = () => { g.save(); this.toast('Saved!', 'c_fx_heart'); };
      $('tReset').onclick = () => this.confirmReset();
    }
    // confirmation lives in its own modal so the periodic settings refresh can't wipe it
    confirmReset() {
      this.close();
      $('modalCard').innerHTML = `<h2>Start over?</h2><p>This erases your restaurant, coins and tasks on this device.</p>
        <button class="big" id="mResetYes" style="background:linear-gradient(#ff8aa5,#ff5f7e);box-shadow:0 5px 0 #d23f62">Reset</button>
        <button class="link" id="mResetNo" style="color:#a8683f">Cancel</button>`;
      $('modal').classList.remove('hidden');
      $('mResetNo').onclick = () => $('modal').classList.add('hidden');
      $('mResetYes').onclick = () => { $('modal').classList.add('hidden'); this.app.resetGame(); };
    }
    complete() {
      const g = this.g;
      $('modalCard').innerHTML = `<img src="${CST.Assets.iconURL('staff_manager', 160)}" alt=""><h2>Grand Opening Complete!</h2>
        <p>Your hotpot restaurant is the talk of the town.<br>Customers served: ${g.stat('paid')} · Stars: ${g.S.stars}<br>Play time: ${Math.round(g.stat('playTime') / 60)} min</p>
        <button class="big" id="mClose">Keep playing</button>`;
      $('modal').classList.remove('hidden'); $('mClose').onclick = () => $('modal').classList.add('hidden');
      CST.Audio.play('task');
    }
  }
  CST.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);

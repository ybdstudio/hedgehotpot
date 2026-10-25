/* Canvas UI for the native mini-game runtime (no DOM): HUD, task card, bottom nav, panels (Shop / Upgrade / Task / Map /
   Settings), toasts, Minis side buttons, rewarded-ad chips, popups and the test-ad overlay. Same behaviour as js/ui.js. */
(function (root) {
  const CST = root.CST;
  const A = () => CST.Assets;
  const F = (w, s) => `${w} ${s}px "PingFang SC","Helvetica Neue",Arial,sans-serif`;
  const fmt = n => { n = Math.floor(n); if (n >= 100000) return (n / 1000).toFixed(0) + 'k'; if (n >= 10000) return (n / 1000).toFixed(1) + 'k'; return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  const BROWN = '#6b3a22', DARK = '#4a2614', CREAM = '#fffaf0';
  const UP_DESC = {
    beltSpeed: lv => `Belt speed ${CST.CONFIG.BELT.speed[lv]} → ${CST.CONFIG.BELT.speed[lv + 1] || '—'}`,
    beltCap: lv => `Belt A plates ${CST.CONFIG.BELT.capA[lv]} → ${CST.CONFIG.BELT.capA[lv + 1] || '—'}`,
    carry: lv => `Carry ${CST.CONFIG.PLAYER.carry[lv]} → ${CST.CONFIG.PLAYER.carry[lv + 1] || '—'} items`,
    move: lv => `Walk speed ${CST.CONFIG.PLAYER.speed[lv]} → ${CST.CONFIG.PLAYER.speed[lv + 1] || '—'}`,
    prod: lv => `Prep speed x${CST.CONFIG.PROD_MULT[lv]} → x${CST.CONFIG.PROD_MULT[lv + 1] || '—'}`,
    clean: lv => `Cleaning ${CST.CONFIG.CLEAN.time[lv]}s → ${CST.CONFIG.CLEAN.time[lv + 1] || '—'}s / plate`,
    staff: lv => `Staff speed x${CST.CONFIG.STAFF_MULT[lv]} → x${CST.CONFIG.STAFF_MULT[lv + 1] || '—'}`
  };
  const STAFF_ICON = { staff_chef: ['char_chef', 'chef.carry.front.0'], staff_cashier: ['char_cashier', 'cashier.walk.front.0'], staff_cleaner: ['char_cleaner', 'cleaner.walk.front.0'], staff_waiter: ['char_waiter', 'player.walk.front.0'], staff_server: ['char_server', 'waitress.idle.front.0'], staff_manager: ['char_manager', 'manager.idle.front.0'], staff_hero: ['char_chef', 'chef.idle.front.0'] };

  // ---------------------------------------------------------------- UI art (files shipped next to game.js)
  const ART = CST.ART = { img: {}, load(list) { return Promise.all(Object.keys(list).map(k => new Promise(res => { const im = new Image(); im.onload = () => { this.img[k] = im; res(); }; im.onerror = () => res(); im.src = list[k]; }))); } };

  class UI {
    constructor(game, renderer, app) {
      this.g = game; this.r = renderer; this.app = app; this.ctx = renderer.ctx; this.t = 0; this.now = 0;
      this.toasts = []; this.hits = []; this.panel = null; this.scroll = 0; this.pop = null; this.ad = null; this.joy = null;
      this.S = root.__SAFE || { top: 0, bottom: 0, W: renderer.cssW, H: renderer.cssH };
      this.bindGame(game);
    }
    bindGame(game) {
      this.g = game;
      game.on('task', e => { this.toast(`Task complete! ${this.rewardText(e.reward)}`, 'c_fx_heart', true); this.flashT = 0.7; this.vib(30); });
      game.on('unlock', u => { if (u) this.toast(`${u.name} unlocked!`, u.icon, true); this.vib(40); });
      game.on('upgrade', k => this.toast(`${CST.CONFIG.UPGRADES[k].name} upgraded!`, CST.CONFIG.UPGRADES[k].icon));
      game.on('bonus', b => this.toast(`Bonus: ${b.t} ${this.rewardText(b.reward)}`, 'c_fx_heart', true));
      game.on('hire', a => { if (this.started) this.toast(`${this.staffName(a.role)} joined the team!`, ({ chef: 'staff_waiter', chef2: 'staff_waiter', waiter: 'staff_server' }[a.role] || 'staff_' + a.role)); });
      game.on('boost', () => this.toast('Manager boost! Everyone works x1.5', 'staff_manager', true));
      game.on('rush', () => this.toast('GRAND OPENING RUSH! Double pay!', 'gate', true));
      game.on('rushEnd', ok => { if (!ok) this.toast('Rush ended – step on the Grand Opening pad to try again!', 'gate'); });
      game.on('complete', () => this.complete());
      game.on('sfx', s => CST.Audio.play(s));
      game.on('upgradeSpot', sp => { if (!this.panel && !this.pop) { CST.Audio.play('pop'); this.open('upgrade', sp); } });
    }
    staffName(r) { return { chef: 'Waiter Hedgehog', chef2: 'Waiter Hedgehog #2', cashier: 'Cashier Hedgehog', cleaner: 'Cleaner Hedgehog', waiter: 'Server Hedgehog', manager: 'Manager Hedgehog' }[r] || r; }
    vib(ms) { if (this.g.S.settings.vib) root.navigator.vibrate(ms); }
    rewardText(r) { const p = []; if (r && r.coins) p.push(`+${r.coins} coins`); if (r && r.stars) p.push(`+${r.stars}★`); return p.join(' '); }
    toast(text, icon, gold) { this.toasts.push({ text, icon, gold, t: 0 }); while (this.toasts.length > 2) this.toasts.shift(); }
    open(name, filter) { this.upFilter = filter || null; this.panel = name; this.scroll = 0; }
    close() { this.panel = null; }
    refreshPanel() { }
    popupOpen() { return !!this.pop; }
    update(dt) {
      this.now += dt; this.t += dt; if (this.flashT > 0) this.flashT -= dt;
      for (const t of this.toasts) t.t += dt; this.toasts = this.toasts.filter(t => t.t < 2.3);
      if (this.t >= 0.12) { this.t = 0; if (CST.Minis && CST.Minis.g) CST.Minis.update(); }
      if (!this.hintGone && (this.g.S.time > 25 || this.g.stat('ingPicked') > 0)) this.hintGone = true;
      this.draw();
    }

    // ---------------------------------------------------------------- drawing helpers (CSS px)
    rr(x, y, w, h, r) { const c = this.ctx; r = Math.min(r, h / 2, w / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    card(x, y, w, h, r, fill, border, drop) { const c = this.ctx; if (drop) { c.fillStyle = border || BROWN; this.rr(x, y + drop, w, h, r); c.fill(); } c.fillStyle = fill; this.rr(x, y, w, h, r); c.fill(); if (border) { c.lineWidth = 2.5; c.strokeStyle = border; c.stroke(); } }
    grad(y0, y1, a, b) { const g = this.ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
    text(s, x, y, size, color, weight = 'bold', align = 'left', outline) {
      const c = this.ctx; c.font = F(weight, size); c.textAlign = align; c.textBaseline = 'middle';
      if (outline) { c.lineJoin = 'round'; c.lineWidth = outline[1]; c.strokeStyle = outline[0]; c.strokeText(s, x, y); }
      c.fillStyle = color; c.fillText(s, x, y);
    }
    fit(s, size, maxW, weight = 'bold') { const c = this.ctx; c.font = F(weight, size); while (size > 8 && c.measureText(s).width > maxW) { size -= 0.5; c.font = F(weight, size); } return size; }
    wrap(s, size, maxW, weight = 'bold') { const c = this.ctx; c.font = F(weight, size); const out = []; let line = ''; for (const w of String(s).split(' ')) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; }
    icon(key, cx, cy, box) {
      const c = this.ctx;
      if (ART.img[key]) { const im = ART.img[key], s = Math.min(box / im.width, box / im.height); c.drawImage(im, cx - im.width * s / 2, cy - im.height * s / 2, im.width * s, im.height * s); return; }
      let atlas = 'props', fk = key; if (key && key.startsWith('staff_')) [atlas, fk] = STAFF_ICON[key] || STAFF_ICON.staff_hero;
      const f = A().frame(atlas, fk), im = A().img[atlas]; if (!f || !im) return;
      const s = Math.min(box / f[2], box / f[3]); c.drawImage(im, f[0], f[1], f[2], f[3], cx - f[2] * s / 2, cy - f[3] * s / 2, f[2] * s, f[3] * s);
    }
    coin(cx, cy, r) { const c = this.ctx, g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r); g.addColorStop(0, '#fff3a0'); g.addColorStop(0.55, '#ffc928'); g.addColorStop(1, '#d88a0a'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill(); c.lineWidth = 2; c.strokeStyle = '#a8690e'; c.stroke(); }
    star(cx, cy, r) { const c = this.ctx; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } c.closePath(); c.fillStyle = '#ffc93c'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = BROWN; c.lineJoin = 'round'; c.stroke(); }
    hit(x, y, w, h, fn) { this.hits.push({ x, y, w, h, fn }); }
    button(x, y, w, h, label, style, fn, size = 18) {
      const c = this.ctx, st = { green: ['#8ee36a', '#3fae3c', '#2a6e27', '#fff'], yellow: ['#ffe46a', '#ffbb1c', '#b4740c', DARK], pink: ['#ff9ab0', '#ff5f7e', '#d23f62', '#fff'], off: ['#e2d6c6', '#d2c3b0', '#a99a86', '#fff8ee'], toggleOff: ['#e2d6c6', '#d2c3b0', '#a99a86', '#fff8ee'], blue: ['#7cc4ff', '#3d8fe0', '#2a5f9a', '#fff'] }[style] || ['#8ee36a', '#3fae3c', '#2a6e27', '#fff'];
      c.fillStyle = st[2]; this.rr(x, y + 4, w, h, Math.min(16, h / 2.4)); c.fill();
      c.fillStyle = this.grad(y, y + h, st[0], st[1]); this.rr(x, y, w, h, Math.min(16, h / 2.4)); c.fill(); c.lineWidth = 2.5; c.strokeStyle = DARK; c.stroke();
      this.text(label, x + w / 2, y + h / 2 + 1, this.fit(label, size, w - 12), st[3], 'bold', 'center', st[3] === '#fff' ? ['rgba(74,38,20,.55)', 3] : null);
      if (fn && style !== 'off') this.hit(x, y, w, h + 4, fn);
    }

    // ---------------------------------------------------------------- frame
    draw() {
      const c = this.ctx, d = this.r.dpr, W = this.r.cssW, H = this.r.cssH, S = this.S, g = this.g, st = g.S;
      this.W = W; this.H = H; this.hits = [];
      c.save(); c.setTransform(d, 0, 0, d, 0, 0); c.globalAlpha = 1;
      const top = S.top + 6;
      // ---- top HUD
      const pw1 = Math.round(W * 0.31), pw2 = Math.round(W * 0.19), x2 = 10 + pw1 + 6, x3 = x2 + pw2 + 6, ph = 40;
      this.card(10, top, pw1, ph, 15, CREAM, BROWN, 3);
      this.coin(32, top + ph / 2, 13); this.text(fmt(st.coins), 50, top + ph / 2 + 1, this.fit(fmt(st.coins), 20, pw1 - 80), DARK);
      const px = 10 + pw1 - 30; this.card(px, top + 9, 22, 22, 6, '#4fc46a', '#2e8a44'); this.text('+', px + 11, top + 20, 18, '#fff', 'bold', 'center');
      if (CST.Minis && CST.Minis.g && CST.Ads.enabled && CST.Minis.coinsWait() <= 0) { c.fillStyle = '#ffcf3d'; c.beginPath(); c.arc(px + 22, top + 8, 7, 0, 7); c.fill(); c.strokeStyle = BROWN; c.lineWidth = 1.5; c.stroke(); this.text('▶', px + 22.5, top + 8.5, 7, BROWN, 'bold', 'center'); }
      this.hit(px - 8, top - 4, 40, ph + 8, () => CST.Minis.popCoins());
      this.card(x2, top, pw2, ph, 15, CREAM, BROWN, 3); this.star(x2 + 21, top + ph / 2, 12); this.text(String(st.stars), x2 + 40, top + ph / 2 + 1, 20, DARK);
      const pw3 = W - 10 - x3; this.card(x3, top, pw3, ph, 15, CREAM, BROWN, 3);
      const tot = CST.CONFIG.TASKS.length, tw = pw3 - 40; this.card(x3 + 6, top + 8, tw, 24, 10, '#ead6bd', BROWN);
      const fr = Math.min(1, st.taskIndex / tot); if (fr > 0) { c.save(); this.rr(x3 + 6, top + 8, tw, 24, 10); c.clip(); c.fillStyle = this.grad(top + 8, top + 32, '#8ee07a', '#4fbf5a'); c.fillRect(x3 + 6, top + 8, tw * fr, 24); c.restore(); this.rr(x3 + 6, top + 8, tw, 24, 10); c.lineWidth = 2; c.strokeStyle = BROWN; c.stroke(); }
      this.text(`${Math.min(st.taskIndex, tot)}/${tot}`, x3 + 6 + tw / 2, top + 21, 14, DARK, 'bold', 'center');
      this.pin(x3 + pw3 - 17, top + 20);
      // ---- second row: phase · rating · boosts
      let y2 = top + ph + 12, rx = 10;
      const phTxt = st.done ? 'Complete!' : `P${g.phase} · ${CST.CONFIG.PHASE_NAMES[g.phase]}`;
      c.font = F('bold', 11); const pwx = c.measureText(phTxt).width + 16; c.fillStyle = 'rgba(74,38,20,.72)'; this.rr(rx, y2 - 10, pwx, 20, 8); c.fill(); this.text(phTxt, rx + 8, y2, 11, '#fff'); rx += pwx + 6;
      const pm = Math.round((g.priceMult() - 1) * 100); if (pm > 0) { this.text(`+${pm}% prices`, rx, y2, 11, '#fff', 'bold', 'left', [DARK, 3]); c.font = F('bold', 11); rx += c.measureText(`+${pm}% prices`).width + 8; }
      if (st.boostT > 0) { this.card(rx, y2 - 12, 74, 24, 10, this.grad(y2 - 12, y2 + 12, '#ffe7b0', '#ffc562'), BROWN, 2); this.text(`x1.5 ${Math.ceil(st.boostT)}s`, rx + 37, y2, 12, '#7a3b00', 'bold', 'center'); rx += 80; }
      if (st.adRushT > 0) { this.card(rx, y2 - 12, 96, 24, 10, this.grad(y2 - 12, y2 + 12, '#ffe0ea', '#ff9fb7'), BROWN, 2); this.text(`Hedge Rush ${Math.ceil(st.adRushT)}s`, rx + 48, y2, 11.5, DARK, 'bold', 'center'); }
      let y3 = y2 + 20;
      if (st.rushActive) { const t = `GRAND OPENING RUSH ${Math.ceil(st.rushT)}s · served ${g.stat('rushServed')}/${CST.CONFIG.RUSH.goal}`; const s = this.fit(t, 13, W - 40); this.card(10, y3, W - 20, 26, 10, this.grad(y3, y3 + 26, '#ff8aa5', '#ff5f7e'), '#fff'); this.text(t, W / 2, y3 + 13, s, '#fff', 'bold', 'center'); y3 += 32; }
      this.sideButtons(y3 + 8); this.chips(y3 + 8);
      // ---- bottom: nav, task card, bonus, hint, toasts
      const navY = this.navBar();
      const ty = this.taskCard(navY);
      const b = g.bonusTask(); let by = ty - 10;
      if (b) { const s = `Bonus: ${b.t} (${fmt(b.cur)}/${fmt(b.n)})`; c.font = F('bold', 10); const w = Math.min(W - 20, c.measureText(s).width + 18); by = ty - 23; c.fillStyle = 'rgba(74,38,20,.62)'; this.rr(10, by, w, 18, 8); c.fill(); this.text(s, 19, by + 9, this.fit(s, 10, w - 18), '#fff'); }
      if (!this.hintGone) this.text('Drag anywhere to move', W / 2, by - 16, 14, '#fff', 'bold', 'center', [DARK, 4]);
      this.drawToasts(ty - 70);
      this.drawJoy();
      if (this.panel) this.drawSheet();
      if (this.pop) this.drawPopup();
      if (this.ad) this.drawAd();
      c.restore();
    }
    pin(cx, cy) { const c = this.ctx; c.beginPath(); c.arc(cx, cy - 4, 9, Math.PI * 0.85, Math.PI * 2.15); c.lineTo(cx, cy + 12); c.closePath(); c.fillStyle = '#e8463e'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = BROWN; c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy - 4, 3.5, 0, 7); c.fill(); }
    navBar() {
      const W = this.W, n = 5, gap = 7, bw = (W - 20 - gap * (n - 1)) / n, bh = Math.round(Math.min(bw * 0.72, 56)), y = this.H - this.S.bottom - 8 - bh, g = this.g, S = g.S;   // compact: leaves more map
      const items = [['shop', 'Shop', ['#ffb15a', '#f08a2c']], ['upgrade', 'Upgrade', ['#7fd36a', '#4aaa45']], ['tasks', 'Task', ['#ef7a63', '#d24c3e']], ['map', 'Map', ['#6fb2f2', '#3f86d8']], ['settings', 'Settings', ['#8a5a3c', '#6b3f27']]];
      const canUp = Object.keys(CST.CONFIG.UPGRADES).some(k => { const i = g.upgradeInfo(k); return !i.locked && i.cost !== null && S.coins >= i.cost; });
      const canShop = CST.CONFIG.UNLOCKS.some(u => g.padVisible(u) && S.coins >= u.cost - (S.padPaid[u.id] || 0));
      items.forEach(([id, label, col], i) => {
        const x = 10 + i * (bw + gap); this.card(x, y, bw, bh, 13, this.grad(y, y + bh, col[0], col[1]), DARK, 3);
        this.icon('nav_' + id, x + bw / 2, y + bh * 0.39, bh * 0.52);
        this.text(label, x + bw / 2, y + bh * 0.82, this.fit(label, 11.5, bw - 6), '#fff', 'bold', 'center', [DARK, 3]);
        if ((id === 'shop' && canShop) || (id === 'upgrade' && canUp)) { const c = this.ctx; c.fillStyle = '#e8463e'; c.beginPath(); c.arc(x + bw - 3, y + 3, 8, 0, 7); c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#fff'; c.stroke(); }
        this.hit(x, y, bw, bh + 4, () => { CST.Audio.play('pop'); this.panel === id ? this.close() : this.open(id); });
      });
      return y;
    }
    taskCard(navY) {
      const g = this.g, S = g.S, W = this.W, w = Math.min(W - 20, 380), h = 50, x = 10, y = navY - 8 - h, t = g.task();
      let txt = 'All tasks complete — keep growing your restaurant!', bar = 1, cnt = '', rew = '';
      if (t) {
        const p = g.taskProgress(); txt = t.t; bar = p.cur / p.n; cnt = `${fmt(p.cur)}/${fmt(p.n)}`;
        if (t.type === 'unlock') { const u = g.unlockDef(t.id2); const rem = u.cost - (S.padPaid[u.id] || 0); cnt = u.cost ? `${fmt(Math.min(S.coins, rem))}/${fmt(rem)} coins` : 'Walk onto the pad'; bar = u.cost ? Math.min(1, S.coins / Math.max(1, rem)) : 1; }
        if (t.type === 'upgrade') { const i = g.upgradeInfo(t.id2); cnt = i.cost ? `Lv ${i.lv}/${t.lv} · ${fmt(i.cost)} coins` : `Lv ${i.lv}/${t.lv}`; }
        rew = this.rewardText(t.reward);
      }
      const sc = this.flashT > 0 ? 1 + Math.sin(this.flashT * 9) * 0.03 : 1, c = this.ctx;
      c.save(); c.translate(x + w / 2, y + h / 2); c.scale(sc, sc); c.translate(-(x + w / 2), -(y + h / 2));
      this.card(x, y, w, h, 13, CREAM, BROWN, 3);
      this.card(x + 8, y + 8, 34, 34, 9, '#d8443f', BROWN); this.icon('task_ico', x + 25, y + 25, 23);
      const tx = x + 50; c.font = F('bold', 10); const rw = rew ? c.measureText(rew).width + 8 : 0;
      let title = txt, size = this.fit(title, 14, w - 58 - rw);
      if (size < 10.5) { size = 10.5; c.font = F('bold', size); while (title.length > 4 && c.measureText(title + '…').width > w - 58 - rw) title = title.slice(0, -1); title += '…'; }
      this.text(title, tx, y + 16, size, DARK);
      if (rew) this.text(rew, x + w - 8, y + 12, 10, '#b8650f', 'bold', 'right');
      const bw = Math.min(100, w * 0.3), byy = y + h - 14; this.card(tx, byy - 5, bw, 10, 5, '#ead6bd', BROWN); if (bar > 0) { c.fillStyle = '#4fbf5a'; this.rr(tx + 1.5, byy - 3.5, (bw - 3) * Math.min(1, bar), 7, 3.5); c.fill(); }
      this.text(cnt, tx + bw + 8, byy, this.fit(cnt, 11, w - bw - 66), BROWN);
      c.restore();
      this.hit(x, y, w, h, () => this.open('tasks'));
      return y;
    }
    drawToasts(baseY) {
      const c = this.ctx; this.toasts.forEach((t, i) => {
        const a = t.t < 0.2 ? t.t / 0.2 : t.t > 1.9 ? Math.max(0, (2.3 - t.t) / 0.4) : 1, y = baseY - (this.toasts.length - 1 - i) * 42 - (1 - a) * 10;
        c.font = F('bold', 13); const w = Math.min(this.W * 0.86, c.measureText(t.text).width + (t.icon ? 52 : 26)); const x = this.W / 2 - w / 2;
        c.globalAlpha = a; this.card(x, y - 17, w, 34, 13, t.gold ? this.grad(y - 17, y + 17, '#fff4c4', '#ffd76a') : this.grad(y - 17, y + 17, '#fff', '#fff2e6'), '#fff', 0);
        c.fillStyle = 'rgba(226,69,106,.45)'; this.rr(x, y + 15, w, 4, 2); c.fill();
        if (t.icon) this.icon(t.icon, x + 20, y, 24);
        this.text(t.text, x + (t.icon ? 38 : 13), y + 1, this.fit(t.text, 13, w - (t.icon ? 48 : 24)), BROWN); c.globalAlpha = 1;
      });
    }
    drawJoy() { const j = this.joy; if (!j) return; const c = this.ctx; c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(j.ox, j.oy, 50, 0, 7); c.fill(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.7)'; c.stroke(); c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(j.ox + j.dx, j.oy + j.dy, 22, 0, 7); c.fill(); }

    // ---------------------------------------------------------------- Minis side buttons + reward chips
    sideButtons(y) {
      const M = CST.Minis; if (!M || !M.g) return; const m = M.st(), d = M.today();
      [['add', 'ico_add', 'Add to', 'screen', !m.addClaimed, () => M.popAdd()], ['rev', 'ico_revisit', 'Revisit', 'gift', m.revisitDay !== d, () => M.popRevisit()], ['share', 'ico_share', 'Share', 'gift', m.shareDay !== d, () => M.popShare()]].forEach(([id, ic, a, b, badge, fn], i) => {
        const x = 10, yy = y + i * 62, w = 50, h = 54, c = this.ctx;
        this.card(x, yy, w, h, 13, CREAM, BROWN, 2); this.icon(ic, x + w / 2, yy + 17, 26);
        this.text(a, x + w / 2, yy + 36, 8.5, DARK, 'bold', 'center'); this.text(b, x + w / 2, yy + 46, 8.5, DARK, 'bold', 'center');
        if (badge) { c.fillStyle = '#e8323a'; c.beginPath(); c.arc(x + w - 2, yy + 2, 8, 0, 7); c.fill(); c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke(); this.text('!', x + w - 2, yy + 2.5, 11, '#fff', 'bold', 'center'); }
        this.hit(x, yy, w, h, () => { CST.Audio.play('pop'); fn(); });
      });
    }
    chips(y) {
      const M = CST.Minis; if (!M || !M.chipList) return; const c = this.ctx, W = this.W;
      M.chipList.forEach((ch, i) => {
        const two = ch.text.includes('|'), [a, b] = ch.text.split('|'), w = 156, h = two ? 50 : 36, x = W - 10 - w, yy = y; y += h + 10;
        const pulse = 1 + Math.sin(this.now * 4) * 0.025; c.save(); c.translate(x + w / 2, yy + h / 2); c.scale(pulse, pulse); c.translate(-(x + w / 2), -(yy + h / 2));
        this.card(x, yy, w, h, 13, this.grad(yy, yy + h, '#fff6c8', '#ffd658'), BROWN, 3);
        c.fillStyle = '#3fbf5e'; c.beginPath(); c.arc(x + 15, yy + h / 2, 9, 0, 7); c.fill(); c.lineWidth = 2; c.strokeStyle = '#2e7a3c'; c.stroke(); this.text('▶', x + 15.5, yy + h / 2 + 0.5, 8, '#fff', 'bold', 'center');
        if (ch.icon === 'task') { this.card(x + 30, yy + h / 2 - 11, 22, 22, 6, '#d8443f', BROWN); this.icon('task_ico', x + 41, yy + h / 2, 16); } else this.icon(ch.icon, x + 41, yy + h / 2, 22);
        this.text(a, x + 57, two ? yy + 15 : yy + h / 2 + 1, this.fit(a, 12.5, w - 64), DARK);
        if (two) { const ls = this.wrap(b, 9.5, w - 64); ls.slice(0, 2).forEach((l, k) => this.text(l, x + 57, yy + 30 + k * 11, 9.5, '#7a4a1a')); }
        if (ch.life) { const f = Math.max(0, 1 - (Date.now() - ch.t0) / (ch.life * 1000)); c.fillStyle = '#e8463e'; c.fillRect(x + 6, yy + h - 4, (w - 12) * f, 3); }
        c.restore();
        this.hit(x, yy, w, h, () => { CST.Audio.play('pop'); M.unchip(ch.id); ch.onTap(); });
      });
    }

    // ---------------------------------------------------------------- panels (bottom sheet)
    rows() {
      const g = this.g, S = g.S, R = [];
      if (this.panel === 'shop') {
        this.title = 'Shop · Expansion & Staff'; R.push({ sec: 'Walk onto a price pad in the restaurant, or buy here' });
        for (const u of CST.CONFIG.UNLOCKS) {
          const owned = g.has(u.id), vis = g.padVisible(u), rem = u.cost - (S.padPaid[u.id] || 0); let btn;
          if (owned) btn = ['Owned', 'off']; else if (!vis) btn = [`Phase ${u.phase}`, 'off'];
          else if (S.coins >= rem) btn = [rem ? fmt(rem) : 'Start', 'green', () => g.buyUnlock(u.id)];
          else btn = [`Need ${fmt(rem)}`, 'pink', () => { this.close(); this.toast('Earn more coins, then walk onto the pad', 'c_fx_heart'); }];
          R.push({ icon: u.icon, title: u.name, sub: owned ? 'Unlocked' : `Phase ${u.phase} · ${fmt(u.cost)} coins`, btn, done: owned });
        }
      } else if (this.panel === 'upgrade') {
        const only = this.upFilter; this.title = only ? only.name : 'Upgrades';
        for (const k in CST.CONFIG.UPGRADES) {
          if (only && !only.keys.includes(k)) continue;
          const U = CST.CONFIG.UPGRADES[k], i = g.upgradeInfo(k); let btn;
          if (i.cost === null) btn = ['MAX', 'off']; else if (i.locked) btn = [`Phase ${i.needPhase}`, 'off'];
          else btn = [fmt(i.cost), S.coins >= i.cost ? 'green' : 'off', () => g.buyUpgrade(k)];
          R.push({ icon: U.icon, title: U.name, sub: i.cost === null ? 'Maxed out' : UP_DESC[k](i.lv), pips: [i.lv, i.max], btn });
        }
      } else if (this.panel === 'tasks') {
        this.title = 'Tasks'; const b = g.bonusTask();
        if (b) { R.push({ sec: 'Bonus task' }); R.push({ icon: 'c_fx_heart', title: b.t, sub: `${fmt(b.cur)}/${fmt(b.n)} · ${this.rewardText(b.reward)}` }); }
        let ph = 0;
        CST.CONFIG.TASKS.forEach((t, i) => {
          if (t.ph !== ph) { ph = t.ph; R.push({ sec: `Phase ${ph} · ${CST.CONFIG.PHASE_NAMES[ph]}` }); }
          const done = i < S.taskIndex, cur = i === S.taskIndex, p = cur ? g.taskProgress() : null;
          R.push({ title: (done ? '✓ ' : '') + t.t, sub: `${cur ? `In progress · ${fmt(p.cur)}/${fmt(p.n)}` : done ? 'Done' : 'Locked'} · ${this.rewardText(t.reward) || '—'}`, done, cur });
        });
      } else if (this.panel === 'settings') {
        this.title = 'Settings'; const st = S.settings, play = Math.floor(g.stat('playTime'));
        R.push({ title: 'Sound', btn: [st.sound ? 'On' : 'Off', st.sound ? 'green' : 'toggleOff', () => { st.sound = !st.sound; CST.Audio.on = st.sound; CST.Audio.fails = 0; if (st.sound) { CST.Audio.unlock(); } g.save(); }, true] });
        R.push({ title: 'Vibration', btn: [st.vib ? 'On' : 'Off', st.vib ? 'green' : 'toggleOff', () => { st.vib = !st.vib; g.save(); }, true] });
        R.push({ title: 'Progress', sub: `Played ${Math.floor(play / 60)}m ${play % 60}s · ${g.stat('paid')} customers · auto-saved`, btn: ['Save', 'green', () => { g.save(); this.toast('Saved!', 'c_fx_heart'); }] });
        R.push({ title: 'Reset restaurant', sub: 'Deletes your save on this device', btn: ['Reset', 'pink', () => this.confirmReset()] });
        R.push({ sec: `Hedge Hotpot Conveyor · v${CST.CONFIG.VERSION}.0` });
      }
      return R;
    }
    drawSheet() {
      const c = this.ctx, W = this.W, H = this.H, y0 = Math.round(H * 0.3), bodyY = y0 + 58, bodyH = H - bodyY - this.S.bottom - 8;
      c.fillStyle = 'rgba(40,20,15,.35)'; c.fillRect(0, 0, W, H); this.hit(0, 0, W, y0, () => this.close());
      c.fillStyle = '#fff8ee'; this.rr(0, y0, W, H - y0 + 30, 24); c.fill(); c.lineWidth = 3; c.strokeStyle = BROWN; c.stroke();
      this.hit(0, y0, W, H - y0, () => { });   // swallow taps on the sheet background
      const R = this.panel === 'map' ? null : this.rows(); if (this.panel === 'map') this.title = 'Restaurant Map';
      this.text(this.title, 18, y0 + 30, this.fit(this.title, 22, W - 90), '#e2456a');
      c.fillStyle = '#ffe0e7'; c.beginPath(); c.arc(W - 32, y0 + 30, 17, 0, 7); c.fill(); this.text('✕', W - 32, y0 + 31, 16, '#e2456a', 'bold', 'center');
      this.hit(W - 54, y0 + 8, 44, 44, () => this.close());
      c.save(); c.beginPath(); c.rect(0, bodyY, W, bodyH); c.clip();
      this.sheetBox = { y: bodyY, h: bodyH };
      if (R) {
        let y = bodyY + 4 - this.scroll; const tot = R.reduce((a, r) => a + (r.sec ? 30 : (r.sub ? 70 : 56)) + 8, 0); this.maxScroll = Math.max(0, tot - bodyH + 12);
        for (const r of R) {
          if (r.sec) { this.text(r.sec, 18, y + 15, this.fit(r.sec, 12, W - 36), '#a8683f'); y += 38; continue; }
          const h = r.sub ? 70 : 56; if (y + h > bodyY - 10 && y < bodyY + bodyH + 10) this.row(r, 12, y, W - 24, h, bodyY, bodyH);
          y += h + 8;
        }
      } else { this.maxScroll = 0; this.drawMap(12, bodyY + 4, W - 24, bodyH - 40); }
      c.restore();
    }
    row(r, x, y, w, h, clipY, clipH) {
      const c = this.ctx; c.globalAlpha = r.done ? 0.6 : 1;
      this.card(x, y, w, h, 16, r.cur ? '#fff1c9' : '#ffffff', r.cur ? '#ffb43c' : '#f0e0cc');
      let tx = x + 14; if (r.icon) { this.icon(r.icon, x + 34, y + h / 2, 42); tx = x + 64; }
      const bw = r.btn ? 86 : 0;
      this.text(r.title, tx, y + (r.sub ? 22 : h / 2), this.fit(r.title, 15, w - (tx - x) - bw - 16), DARK);
      if (r.sub) { const s = this.fit(r.sub, 12, w - (tx - x) - bw - 16); this.text(r.sub, tx, y + 42, s, '#a8683f'); }
      if (r.pips) for (let i = 0; i < r.pips[1]; i++) { c.fillStyle = i < r.pips[0] ? '#ffb43c' : '#ead6bd'; this.rr(tx + i * 20, y + 55, 16, 6, 3); c.fill(); }
      c.globalAlpha = 1;
      if (r.btn) { const [label, style, fn] = r.btn, bx = x + w - bw - 10, by = y + h / 2 - 19; const inView = by > clipY && by + 38 < clipY + clipH; this.button(bx, by, bw, 38, label, style, inView && fn ? () => { if (fn() !== false) CST.Audio.play('pop'); } : null, 15); }
    }
    drawMap(x0, y0, w, h) {
      const c = this.ctx, g = this.g, W = g.C.WORLD, K = g.C.ISO.K, s = Math.min(w / ((W.W + W.H) * K + 40), h / ((W.W + W.H) * K / 2 + 60));
      c.save(); c.fillStyle = '#9fd36b'; this.rr(x0, y0, w, h, 14); c.fill();
      c.translate(x0 + w / 2 - ((W.W - W.H) * K / 2) * s, y0 + 20); c.transform(s * K, s * K / 2, -s * K, s * K / 2, 0, 0);
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
      c.restore();
      const info = `Stools ${Object.values(g.seats).filter(s => s.belt).length} · Table seats ${Object.values(g.seats).filter(s => s.table).length} · VIP ${Object.values(g.seats).filter(s => s.vip).length} · Staff ${g.staff.length}`;
      this.text(info, x0 + w / 2, y0 + h + 18, this.fit(info, 12, w), '#a8683f', 'bold', 'center');
    }

    // ---------------------------------------------------------------- popups
    // spec: { title, hdr, items: [{t:'step'|'btn'|'img'|'cap'|'note'|'side'|'link', ...}] }
    popup(spec) { this.pop = spec; CST.Audio.play('pop'); }
    closePopup() { this.pop = null; }
    itemH(it, iw) {
      if (it.t === 'step') return 34; if (it.t === 'btn') return 58; if (it.t === 'link') return 30; if (it.t === 'side') return 84;
      if (it.t === 'img') { const im = ART.img[it.art]; return im ? iw * im.height / im.width + 6 : 100; }
      if (it.t === 'cap' || it.t === 'note') return this.wrap(it.text, it.t === 'cap' ? 16 : 12, iw).length * (it.t === 'cap' ? 21 : 16) + 6;
      return 20;
    }
    drawPopup() {
      const c = this.ctx, W = this.W, H = this.H, p = this.pop, w = Math.min(W - 40, 360), iw = w - 28;
      c.fillStyle = 'rgba(40,20,15,.6)'; c.fillRect(0, 0, W, H); this.hit(0, 0, W, H, () => { });
      const bodyH = p.items.reduce((a, it) => a + this.itemH(it, iw) + 8, 0) + 12, h = 60 + bodyH, x = (W - w) / 2, y = Math.max(this.S.top + 24, (H - h) / 2);
      this.card(x, y, w, h, 22, '#fff8ee', BROWN, 6);
      c.save(); this.rr(x, y, w, h, 22); c.clip(); c.fillStyle = this.grad(y, y + 58, '#ff9fb0', '#f2788f'); c.fillRect(x, y, w, 58); c.fillStyle = '#c95a72'; c.fillRect(x, y + 57, w, 3); c.restore();
      this.rr(x, y, w, h, 22); c.lineWidth = 3.5; c.strokeStyle = BROWN; c.stroke();
      this.icon(p.hdr, x + 34, y + 18, 76);
      this.text(p.title, x + 78, y + 30, this.fit(p.title, 22, w - 120), '#fff', 'bold', 'left', ['#7a2a3a', 5]);
      const bx = x + w - 8, byy = y - 6; c.fillStyle = '#d8262f'; c.beginPath(); c.arc(bx, byy, 20, 0, 7); c.fill(); c.lineWidth = 3; c.strokeStyle = '#fff'; c.stroke(); c.lineWidth = 2.5; c.strokeStyle = BROWN; c.beginPath(); c.arc(bx, byy, 22.5, 0, 7); c.stroke(); this.text('✕', bx, byy + 1, 18, '#fff', 'bold', 'center');
      this.hit(bx - 24, byy - 24, 48, 48, () => { this.closePopup(); p.onClose && p.onClose(); });
      let yy = y + 70; const cx = x + w / 2, ix = x + 14;
      for (const it of p.items) {
        const ih = this.itemH(it, iw);
        if (it.t === 'step') { c.fillStyle = '#ef5a78'; c.beginPath(); c.arc(ix + 14, yy + 16, 14, 0, 7); c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#fff'; c.stroke(); this.text(String(it.n), ix + 14, yy + 17, 15, '#fff', 'bold', 'center'); const ls = this.wrap(it.text, 14, iw - 40); ls.slice(0, 2).forEach((l, k) => this.text(l, ix + 36, yy + 16 + (ls.length > 1 ? (k - 0.5) * 16 : 0), 14, DARK)); }
        else if (it.t === 'btn') this.button(cx - iw * 0.42, yy + 2, iw * 0.84, 48, it.label, it.style, it.fn, 22);
        else if (it.t === 'link') { this.text(it.text, cx, yy + 15, 14, '#a8683f', 'bold', 'center'); this.hit(cx - 80, yy, 160, 30, it.fn); }
        else if (it.t === 'cap' || it.t === 'note') { const sz = it.t === 'cap' ? 16 : 12; this.wrap(it.text, sz, iw).forEach((l, k) => this.text(l, cx, yy + 11 + k * (sz + 5), sz, it.color || (it.t === 'cap' ? DARK : '#a8683f'), 'bold', 'center')); }
        else if (it.t === 'img') {
          const im = ART.img[it.art]; if (im) { c.save(); this.rr(ix, yy, iw, ih - 6, 14); c.clip(); c.drawImage(im, ix, yy, iw, ih - 6); c.restore(); this.rr(ix, yy, iw, ih - 6, 14); c.lineWidth = 2; c.strokeStyle = '#f0d58a'; c.stroke(); }
          if (it.amount) { const s = it.amount; c.font = F('bold', 24); const bw = c.measureText(s).width + 50, bh = 38, bxx = it.right ? ix + iw - bw - 10 : cx - bw / 2, byy2 = yy + ih - 6 - bh - 8;
            this.card(bxx, byy2, bw, bh, 19, this.grad(byy2, byy2 + bh, '#8a4a24', '#5a2c14'), '#ffd658', 3); this.coin(bxx + 20, byy2 + bh / 2, 11); this.text(s, bxx + 36, byy2 + bh / 2 + 1, 24, '#fff'); }
        }
        else if (it.t === 'side') {
          c.fillStyle = this.grad(yy, yy + 80, '#1f4f9a', '#123672'); this.rr(ix, yy, iw, 80, 14); c.fill();
          this.card(ix + 8, yy + 8, 118, 64, 10, '#fff'); this.text('Profile', ix + 16, yy + 18, 10, '#333');
          c.fillStyle = '#fe2c55'; this.rr(ix + 14, yy + 26, 82, 13, 5); c.fill(); this.text('Recently played', ix + 18, yy + 33, 8.5, '#fff');
          this.card(ix + 14, yy + 44, 106, 24, 7, '#f2f2f2', '#ffcf3d'); this.icon('app_icon', ix + 28, yy + 56, 20); this.text('Hedge Hotpot Conveyor', ix + 42, yy + 56, 7.5, '#333');
          this.text('Find us under', ix + 136, yy + 30, 12, '#fff'); this.text('Profile ▸ Recently played', ix + 136, yy + 48, this.fit('Profile ▸ Recently played', 12, iw - 146), '#fff');
        }
        yy += ih + 8;
      }
    }
    confirmReset() {
      this.close();
      this.popup({ title: 'Start over?', hdr: 'hdr_mega', items: [{ t: 'cap', text: 'This erases your restaurant, coins and tasks on this device.' },
        { t: 'btn', label: 'Reset', style: 'pink', fn: () => { this.closePopup(); this.app.resetGame(); } }, { t: 'link', text: 'Cancel', fn: () => this.closePopup() }] });
    }
    complete() {
      const g = this.g; CST.Audio.play('task');
      this.popup({ title: 'Grand Opening!', hdr: 'hdr_mega', items: [{ t: 'cap', text: 'Your hotpot restaurant is the talk of the town.' },
        { t: 'note', text: `Customers served: ${g.stat('paid')} · Stars: ${g.S.stars} · Play time: ${Math.round(g.stat('playTime') / 60)} min` },
        { t: 'btn', label: 'Keep playing', style: 'green', fn: () => this.closePopup() }] });
    }
    // test-ad overlay, used only when the runtime has no ad API (desktop preview)
    mockAd(type, end) { this.ad = { type, end, t0: Date.now(), sec: type === 'reward' ? 5 : 3 }; }
    drawAd() {
      const a = this.ad, c = this.ctx, W = this.W, H = this.H, left = Math.max(0, a.sec - Math.floor((Date.now() - a.t0) / 1000));
      c.fillStyle = '#111'; c.fillRect(0, 0, W, H); this.hit(0, 0, W, H, () => { });
      this.text('TEST', 30, this.S.top + 20, 12, '#222', 'bold', 'left'); c.fillStyle = '#ffcf3d'; this.rr(16, this.S.top + 10, 40, 20, 4); c.fill(); this.text('TEST', 36, this.S.top + 20, 11, '#222', 'bold', 'center');
      this.text(a.type === 'reward' ? 'Rewarded ad' : 'Ad', W / 2, H / 2 - 30, 26, '#eee', 'bold', 'center');
      this.text(left > 0 ? (a.type === 'reward' ? `Reward in ${left}s` : String(left)) : (a.type === 'reward' ? 'Reward earned!' : ''), W / 2, H / 2 + 6, 18, '#7dff9a', 'bold', 'center');
      this.text('TikTok ad will play here', W / 2, H / 2 + 34, 12, '#888', 'bold', 'center');
      if (left <= 0) this.button(W / 2 - 70, H / 2 + 60, 140, 46, 'Close ✕', 'green', () => { this.ad = null; a.end(true); });
      this.text('✕', W - 26, this.S.top + 20, 16, '#aaa', 'bold', 'center'); this.hit(W - 50, this.S.top, 50, 44, () => { this.ad = null; a.end(a.type !== 'reward'); });
    }

    // ---------------------------------------------------------------- input (CSS px); returns true when the UI took the touch
    touchStart(x, y) {
      for (let i = this.hits.length - 1; i >= 0; i--) { const h = this.hits[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) { this.press = { h, x, y, s0: this.scroll, moved: false, inSheet: !!(this.panel && this.sheetBox && y >= this.sheetBox.y) }; return true; } }
      return false;
    }
    touchMove(x, y) { const p = this.press; if (!p) return; if (Math.hypot(x - p.x, y - p.y) > 8) p.moved = true; if (p.inSheet && !this.pop) this.scroll = Math.max(0, Math.min(this.maxScroll || 0, p.s0 - (y - p.y))); }
    touchEnd() { const p = this.press; this.press = null; if (p && !p.moved && p.h.fn) p.h.fn(); }
  }
  CST.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);

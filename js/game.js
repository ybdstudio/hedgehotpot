/* Core game state + systems (pure logic, no DOM): economy, stations, inventory, customers,
   staff AI, player interactions, upgrades, unlocks/expansion, tasks and save data.
   tools/sim.js runs this exact file headless to verify pacing. */
(function (root) {
  const CST = root.CST = root.CST || {};
  const PS = CST.PLATE_STATE;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  const CS = CST.CUST_STATE = { ENTER: 'ENTER', QUEUE: 'QUEUE', FIND_SEAT: 'FIND_SEAT', WALK_SEAT: 'WALK_SEAT', SIT: 'SIT',
    WAIT_FOR_SUSHI: 'WAIT_FOR_SUSHI', PICK_SUSHI: 'PICK_SUSHI', EAT: 'EAT', EXTRA_WAIT: 'EXTRA_WAIT', WAIT_ORDER: 'WAIT_ORDER',
    PAY_QUEUE: 'PAY_QUEUE', PAY: 'PAY', LEAVE: 'LEAVE', GONE: 'GONE' };

  class Agent {
    constructor(game, char, x, y) {
      this.g = game; this.char = char; this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.dir = 'front';
      this.anim = 'idle'; this.animT = 0; this.path = null; this.speed = 110; this.r = 12; this.id = game.nextAgentId++;
      this.hold = null; this.emote = null; this.emoteT = 0; this.moving = false;
    }
    goTo(x, y) {
      this.target = { x, y };
      const p = this.g.nav.findPath(this.x, this.y, x, y);
      this.path = p || [{ x, y }];
    }
    arrived(tol = 6) { return !this.path && this.target && Math.hypot(this.target.x - this.x, this.target.y - this.y) < tol + 4; }
    stepPath(dt, speed) {
      this.moving = false;
      if (!this.path || !this.path.length) { this.path = null; return true; }
      const wp = this.path[0]; const dx = wp.x - this.x, dy = wp.y - this.y, d = Math.hypot(dx, dy);
      const step = speed * dt;
      // stuck watchdog: if barely progressing, ghost through other agents for a moment
      this.prog = (this.prog || 0) + dt;
      if (this.prog > 1.2) { if (this.lastP && Math.hypot(this.x - this.lastP.x, this.y - this.lastP.y) < 6) this.ghostT = 1.5; this.lastP = { x: this.x, y: this.y }; this.prog = 0; }
      if (this.ghostT > 0) this.ghostT -= dt;
      if (d < 10 && this.path.length > 1) { this.path.shift(); return false; }
      if (d <= step) { this.x = wp.x; this.y = wp.y; this.path.shift(); if (!this.path.length) { this.path = null; return true; } }
      else { this.x += dx / d * step; this.y += dy / d * step; }
      this.vx = dx; this.vy = dy; this.moving = true; this.setDirFromVel(dx, dy);
      return false;
    }
    setDirFromVel(wx, wy) {
      if (Math.abs(wx) + Math.abs(wy) < 0.01) return;
      const dx = wx - wy, dy = (wx + wy) / 2;            // world → isometric screen direction
      const a = Math.atan2(dy, dx) * 180 / Math.PI;     // 0 right, 90 down(front)
      const dirs = ['right', 'front_right', 'front', 'front_left', 'left', 'back_left', 'back', 'back_right'];
      const i = ((Math.round(a / 45) % 8) + 8) % 8; this.dir = dirs[i];
    }
    face(x, y) { this.setDirFromVel(x - this.x, y - this.y); }
    say(e, t = 1.6) { this.emote = e; this.emoteT = t; }
  }

  class Game {
    constructor(opts = {}) {
      this.C = CST.CONFIG; this.opts = opts; this.rand = rng(opts.seed || (Date.now() & 0xffff));
      this.listeners = {}; this.nextAgentId = 1; this.fx = []; this.wash = {}; this.headless = !!opts.headless;
      this.newState();
      if (opts.load !== false && opts.storage) this.load();
      this.build();
      this.restorePending();
    }
    on(ev, f) { (this.listeners[ev] = this.listeners[ev] || []).push(f); }
    emit(ev, d) { (this.listeners[ev] || []).forEach(f => f(d)); }

    newState() {
      const C = this.C;
      this.S = { v: C.VERSION, time: 0, coins: C.START_COINS, stars: 0, unlocked: [], up: {}, taskIndex: 0, taskBase: {}, stats: {},
        bonusIdx: 0, bonusBase: 0, boostT: 0, adRushT: 0, minis: {}, earnLog: [], boostMult: 1, rushT: 0, rushActive: false, done: false, padPaid: {}, playerPos: null, settings: { sound: true, vib: true } };
      for (const k in C.UPGRADES) this.S.up[k] = 0;
    }
    has(id) { return !id || this.S.unlocked.includes(id); }
    stat(k) { return this.S.stats[k] || 0; }
    addStat(k, n = 1) { this.S.stats[k] = (this.S.stats[k] || 0) + n; }
    get phase() { return this.C.PHASE_BY_TASK[Math.min(this.S.taskIndex, this.C.PHASE_BY_TASK.length - 1)]; }

    // ------------------------------------------------------------ world construction
    build() {
      const C = this.C, L = C.LAYOUT;
      this.nav = new CST.NavGrid(C.WORLD.W, C.WORLD.H, C.WORLD.CELL);
      this.conv = this.conv || new CST.ConveyorSystem(this);
      this.stations = this.stations || {}; this.crates = this.crates || {}; this.seats = this.seats || {};
      this.customers = this.customers || []; this.staff = this.staff || []; this.piles = this.piles || [];
      this.payQueue = this.payQueue || []; this.entryQueue = this.entryQueue || []; this.staging = this.staging || []; this.stageMax = 6;
      // belts
      const B = L.belt, ext = this.has('belt_b');
      if (!this.conv.belts.A) this.conv.addBelt('A', B.cy, B.x0, B.x1);
      const bA = this.conv.belts.A, x0 = ext ? B.x0ext : B.x0, x1 = ext ? B.x1ext : B.x1;
      if (bA.x0 !== x0 || bA.x1 !== x1) bA.setShape(x0, x1);
      bA.loadS = bA.closestS(B.loader.x, B.loader.y);
      this.applyUpgrades();
      // stations
      for (const k in L.stations) {
        const s = L.stations[k];
        if (this.has(s.unlock) && !this.stations[k]) this.stations[k] = { key: k, recipe: s.recipe, x: s.x, y: s.y, prop: s.prop, input: 0, output: [], prog: 0, made: 0 };
      }
      for (const k in L.crates) { const c = L.crates[k]; if (this.has(c.unlock)) this.crates[k] = { key: k, ing: k, x: c.x, y: c.y, prop: c.prop, ap: c.ap }; }
      // seats
      const addSeat = (s, belt) => {
        if (!this.has(s.unlock) || this.seats[s.id]) return;
        const b = belt && this.conv.belts[belt];
        this.seats[s.id] = { id: s.id, x: s.x, y: s.y, face: s.face, belt, sp: b ? b.closestS(s.x, s.y) : 0, occupant: null, dirty: 0, vip: false };
      };
      L.stools.forEach(s => addSeat({ id: s.id, x: s.x, y: L.stoolY, face: 'back_right', unlock: s.unlock }, 'A'));
      this.tables = this.tables || {};
      for (const t of L.tables) {
        if (!this.has(t.unlock) || this.tables[t.id]) continue;
        this.tables[t.id] = { id: t.id, x: t.x, y: t.y };
        // chair on the -x side faces +x (screen down-right); chair on the +x side faces -x (screen up-left)
        this.seats[t.id + 'L'] = { id: t.id + 'L', x: t.x - 38, y: t.y, face: 'front_right', table: t.id, occupant: null, dirty: 0, vip: false };
        this.seats[t.id + 'R'] = { id: t.id + 'R', x: t.x + 38, y: t.y, face: 'back_left', table: t.id, occupant: null, dirty: 0, vip: false };
      }
      L.vipSeats.forEach(s => { if (this.has(s.unlock) && !this.seats[s.id]) this.seats[s.id] = { id: s.id, x: s.x, y: s.y, face: 'front', vip: true, kind: s.kind, occupant: null, dirty: 0 }; });
      // recompute pickup params if belt shape changed
      for (const id in this.seats) { const st = this.seats[id]; if (st.belt) st.sp = this.conv.belts[st.belt].closestS(st.x, st.y); }
      this.buildNav();
      this.buildStaff();
      if (!this.player) {
        const p = this.S.playerPos || { x: 190, y: 140 };
        this.player = new Agent(this, 'chef', p.x, p.y); this.player.r = C.PLAYER.radius; this.player.isPlayer = true;
      }
    }
    zoneOpen(z) { return this.has(z.unlock); }
    standPoint(seat) {
      if (seat.vip) return { x: seat.x - 50, y: seat.y + 10 };
      if (seat.belt) return { x: seat.x, y: seat.y + 32 };
      return { x: seat.x, y: seat.y + 34 };   // table chairs: stand in front of the chair
    }
    priceMult() { return Math.min(2, 1 + this.S.stars * this.C.STAR_PRICE_BONUS) * (this.S.adRushT > 0 ? this.C.ADS.rushPrice : 1); }
    // coins earned per minute over the last few minutes (rewards scale with it so they stay useful all game without breaking the economy)
    incomePerMin() { const L = this.S.earnLog || [], now = this.stat('earned'); if (!L.length) return 40; const a = L[0]; const mins = Math.max(0.5, (this.S.time - a[0]) / 60); return Math.max(40, (now - a[1]) / mins); }
    rewardCoins(minutes) { return Math.max(50, Math.round(this.incomePerMin() * minutes / 5) * 5); }
    // the whole kitchen-side edge of the conveyor counts as the drop-off counter, not just the LOAD mat
    atBelt(a) {
      const L = this.C.LAYOUT; if (this.near(a, L.belt.loader, this.C.INTERACT_R)) return true;
      const b = this.conv.belts.A; if (!b) return false;
      const dx = Math.max(b.x0, Math.min(b.x1, a.x));
      return a.y <= b.cy + 4 && Math.hypot(a.x - dx, a.y - b.cy) < b.R + 34;
    }
    // dish return auto-process (visual only): each dropped plate takes a moment to wash, then a sparkle
    queueWash(sk) { if (!sk || this.headless) return; const w = this.wash[sk.id] || (this.wash[sk.id] = { q: 0, t: 0, done: 0 }); w.q = Math.min(12, w.q + 1); }
    updateWash(dt) { for (const id in this.wash) { const w = this.wash[id]; w.done = Math.max(0, w.done - dt); if (w.q > 0) { w.t += dt; if (w.t >= 1.1) { w.t = 0; w.q--; if (!w.q) w.done = 0.7; } } } }
    sinks() { return this.C.LAYOUT.sinks.filter(s => this.has(s.unlock)); }
    sinkPt(s) { return s.x < this.C.SPLIT_X ? { x: s.x - 40, y: s.y } : { x: s.x + 40, y: s.y }; }   // wash spot is behind the dish return
    crateAp(c) { if (c.ap) return c.ap; return c.x < this.C.SPLIT_X ? { x: c.x + 36, y: c.y } : { x: c.x, y: c.y + 34 }; }
    nearestSink(a) { return this.sinks().map(s => this.sinkPt(s)).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0]; }
    buildNav() {
      const C = this.C, L = C.LAYOUT, n = this.nav, W = C.WORLD.W, H = C.WORLD.H;
      n.clear();
      n.blockRect(0, 0, W, H);                       // everything blocked, then carve open zones
      for (const k in L.zones) { const z = L.zones[k]; if (this.zoneOpen(z)) n.blockRect(z.x, z.y, z.w, z.h, 0); }
      n.blockRect(0, 0, W, 8); n.blockRect(0, 0, 8, H);                 // back walls
      n.blockRect(L.door.x - 30, H - 12, 60, 12, 0);                   // door gap
      const fp = (x, y, w, h) => n.blockRect(x - w / 2, y - h / 2, w, h);   // footprint centred on (x,y)
      for (const k in this.stations) { const s = this.stations[k]; fp(s.x, s.y, 84, 44); }
      if (this.has('rice')) fp(L.rice.x, L.rice.y, 46, 70);
      if (this.has('storage')) fp(L.storage.x, L.storage.y, 40, 60);
      for (const b of this.bins()) fp(b.x, b.y, 22, 22);
      for (const k in this.crates) { const c = this.crates[k]; fp(c.x, c.y, 28, 34); }
      for (const s of this.sinks()) fp(s.x, s.y, 44, 74);
      fp(L.cashier.x, L.cashier.y, 80, 26);
      for (const id in this.conv.belts) { const bt = this.conv.belts[id], b = bt.bounds(); n.blockRect(b.x, b.y, b.w, b.h); n.blockRect(bt.x0 - bt.R - 14, bt.cy + bt.R + 15, bt.Ls + 2 * bt.R + 28, 24); }   // belt + bar counter
      for (const id in this.tables) { const t = this.tables[id]; fp(t.x, t.y, 44, 44); }
      for (const id in this.seats) { const s = this.seats[id]; if (s.vip) fp(s.x, s.y, 56, 40); }
      if (this.has('manager')) fp(L.managerDesk.x, L.managerDesk.y, 56, 30);
      for (const d of L.decor) if (!d.wall) fp(d.x, d.y, 24, 24);
      if (this.has('final_decor')) for (const d of L.finalDecor) if (d.x < W && d.y < H) fp(d.x, d.y, 30, 30);
    }
    buildStaff() {
      const L = this.C.LAYOUT;
      const want = [];
      const Hm = L.homes;
      // the player is the sushi chef; hired 'chef' roles are Waiter Hedgehogs that run plates from the stations to the belt
      if (this.has('chef')) want.push(['chef', 'waiter', Hm.chef.x, Hm.chef.y]);
      if (this.has('chef2')) want.push(['chef2', 'waiter', Hm.chef2.x, Hm.chef2.y]);
      if (this.has('cashier')) want.push(['cashier', 'cashier', L.cashier.pad.x, L.cashier.pad.y]);
      if (this.has('cleaner')) want.push(['cleaner', 'cleaner', Hm.cleaner.x, Hm.cleaner.y]);
      if (this.has('waiter')) want.push(['waiter', 'server', Hm.waiter.x, Hm.waiter.y]);
      if (this.has('manager')) want.push(['manager', 'manager', L.managerDesk.x, L.managerDesk.y + 40]);
      for (const [role, char, x, y] of want) {
        if (this.staff.find(s => s.role === role)) continue;
        const a = new Agent(this, char, x, y); a.role = role; a.job = null; a.speed = this.C.STAFF.speed; a.wait = 0; a.say('heart', 2);
        this.staff.push(a);
        this.emit('hire', a);
      }
    }
    applyUpgrades() {
      const C = this.C, U = this.S.up;
      this.conv.speed = C.BELT.speed[U.beltSpeed];
      if (this.conv.belts.A) this.conv.belts.A.cap = C.BELT.capA[U.beltCap];
      this.carryCap = C.PLAYER.carry[U.carry];
      this.moveSpeed = C.PLAYER.speed[U.move];
      this.prodMult = C.PROD_MULT[U.prod] * (this.has('rice') ? C.RICE_MULT : 1);
      this.cleanTime = C.CLEAN.time[U.clean];
      this.staffMult = C.STAFF_MULT[U.staff];
    }

    // ------------------------------------------------------------ economy
    spend(n) { if (this.S.coins < n) return false; this.S.coins -= n; this.emit('coins'); return true; }
    gain(n, x, y, earned = true) {
      n = Math.round(n); if (n <= 0) return; this.S.coins += n; if (earned) this.addStat('earned', n);
      if (x !== undefined) this.floatText('+' + n, x, y, '#ffd34d'); this.emit('coins'); this.emit('sfx', 'coin');
    }
    floatText(t, x, y, col) { if (!this.headless) this.fx.push({ t, x, y, col, life: 1.1 }); }

    // rewarded R6: the Grand Opening rush ended short of its goal -> keep going for 45 more seconds
    continueRush(sec) { const S = this.S; if (S.rushRetry === undefined) return false; if (!S.unlocked.includes('grand_open')) S.unlocked.push('grand_open'); S.taskIndex = S.rushRetry; delete S.rushRetry; S.rushActive = true; S.rushT = sec; this.build(); this.emit('rush'); return true; }
    unlockDef(id) { return this.C.UNLOCKS.find(u => u.id === id); }
    padVisible(u) { return !this.has(u.id) && this.S.taskIndex >= u.showAfter; }
    buyUnlock(id) {
      const u = this.unlockDef(id); if (!u || this.has(id) || !this.padVisible(u)) return false;
      const paid = this.S.padPaid[id] || 0, need = u.cost - paid;
      if (!this.spend(need)) return false;
      this.completeUnlock(id); return true;
    }
    completeUnlock(id) {
      const u = this.unlockDef(id); delete this.S.padPaid[id];
      this.S.unlocked.push(id); this.build();
      this.emit('unlock', u); this.emit('sfx', 'unlock');
      if (id === 'grand_open') { this.S.rushActive = true; this.S.rushT = this.C.RUSH.duration; this.S.stats.rushServed = 0; this.emit('rush'); }
      if (u && u.pad) this.floatText(u.name + '!', u.pad.x, u.pad.y - 30, '#fff');
      this.save();
    }
    upgradeInfo(k) {
      const U = this.C.UPGRADES[k], lv = this.S.up[k];
      const max = U.costs.length; const cost = lv < max ? U.costs[lv] : null;
      const locked = lv < max && this.phase < U.minPhase[lv];
      return { lv, max, cost, locked, needPhase: lv < max ? U.minPhase[lv] : null };
    }
    buyUpgrade(k) {
      const i = this.upgradeInfo(k); if (i.cost === null || i.locked) return false;
      if (!this.spend(i.cost)) return false;
      this.S.up[k]++; this.applyUpgrades(); this.emit('upgrade', k); this.emit('sfx', 'unlock'); this.save(); return true;
    }

    // ------------------------------------------------------------ tasks
    task() { return this.C.TASKS[this.S.taskIndex] || null; }
    taskProgress() {
      const t = this.task(); if (!t) return { cur: 1, n: 1, done: true };
      if (t.type === 'stat') { const cur = this.stat(t.key) - (this.S.taskBase[t.key] || 0); return { cur: Math.min(cur, t.n), n: t.n, done: cur >= t.n }; }
      if (t.type === 'unlock') { const d = this.has(t.id2); return { cur: d ? 1 : 0, n: 1, done: d }; }
      if (t.type === 'upgrade') { const lv = this.S.up[t.id2]; return { cur: Math.min(lv, t.lv), n: t.lv, done: lv >= t.lv }; }
      return { cur: 0, n: 1, done: false };
    }
    checkTasks() {
      let guard = 0;
      while (guard++ < 5) {
        const t = this.task(); if (!t) break;
        const p = this.taskProgress(); if (!p.done) break;
        const r = t.reward || {};
        if (r.coins) this.gain(r.coins, this.player.x, this.player.y - 70, false);
        if (r.stars) { this.S.stars += r.stars; }
        this.S.taskIndex++;
        this.addStat('tasksDone');
        this.player.cheerT = 1.4;
        this.emit('task', { done: t, next: this.task(), reward: r });
        this.emit('sfx', 'task');
        // snapshot base counters for the next stat-based task
        const n = this.task(); if (n && n.type === 'stat') this.S.taskBase[n.key] = this.stat(n.key);
        if (!n && !this.S.done) { this.S.done = true; this.S.rushActive = false; this.emit('complete'); }
        this.save();
      }
      // bonus tasks run in parallel
      const B = this.C.BONUS_TASKS[this.S.bonusIdx];
      if (B && this.stat(B.key) - this.S.bonusBase >= B.n) {
        if (B.reward.coins) this.gain(B.reward.coins, this.player.x, this.player.y - 90, false);
        if (B.reward.stars) this.S.stars += B.reward.stars;
        this.emit('bonus', B); this.S.bonusIdx++;
        const nb = this.C.BONUS_TASKS[this.S.bonusIdx]; if (nb) this.S.bonusBase = this.stat(nb.key);
      }
    }
    bonusTask() { const B = this.C.BONUS_TASKS[this.S.bonusIdx]; if (!B) return null; return { ...B, cur: Math.min(B.n, this.stat(B.key) - this.S.bonusBase) }; }
    // next useful step of the core loop: crate -> station -> belt
    loopTarget() {
      const C = this.C, L = C.LAYOUT, h = this.player.hold;
      if (h && h.kind === 'sushi') return L.belt.loader;
      const ready = Object.values(this.stations).find(s => C.RECIPES[s.recipe].belt && s.output.length);
      if (h && h.kind === 'ing') { const st = Object.values(this.stations).find(s => C.RECIPES[s.recipe].ing === h.items[0]); if (st) return { x: st.x, y: st.y + 34 }; }
      if (ready) return { x: ready.x, y: ready.y + 34 };
      if (this.has('storage') || this.has('chef')) return null;
      const st = this.stations.salmon; if (st && st.input > 0) return { x: st.x, y: st.y + 34 };
      return this.crateAp(this.crates.salmon);
    }
    // world-space point the task arrow should point at
    taskTarget() {
      const t = this.task(); if (!t) return null;
      if (t.type === 'unlock') { const u = this.unlockDef(t.id2); return u && this.padVisible(u) ? u.pad : null; }
      const tg = t.target || ''; const [k, v] = tg.split(':'); const L = this.C.LAYOUT;
      if (k === 'crate' && this.crates[v]) return this.crateAp(this.crates[v]);
      if (k === 'station' && this.stations[v]) { const h = this.player.hold; if (tg === 'station:salmon' && (!h || h.kind !== 'ing')) return this.crateAp(this.crates.salmon); return { x: this.stations[v].x, y: this.stations[v].y + 34 }; }
      if (k === 'loader') { const h = this.player.hold; if (this.has('chef') || (h && h.kind === 'sushi')) return L.belt.loader; return { x: this.stations.salmon.x, y: this.stations.salmon.y + 34 }; }
      if (k === 'cashier') {
        // only send the player to the register when someone is actually there to pay; otherwise guide the sushi loop
        if (this.payQueue.length && !this.staff.some(s => s.role === 'cashier')) return L.cashier.pad;
        const pile = this.piles.find(p => p.amount > 0); if (pile) return pile;
        return this.loopTarget();
      }
      if (k === 'pile') { const p = this.piles.find(p => p.amount > 0); if (p) return p; if (this.payQueue.length && !this.staff.some(s => s.role === 'cashier')) return L.cashier.pad; return this.loopTarget(); }
      if (k === 'dirty') { const s = Object.values(this.seats).find(s => s.dirty > 0); return s ? { x: s.x, y: s.y } : null; }
      if (k === 'vip') { const s = Object.values(this.seats).find(s => s.vip && s.kind === v); return s ? { x: s.x, y: s.y } : null; }
      return null;
    }

    // ------------------------------------------------------------ main update
    update(dt) {
      dt = Math.min(dt, 0.1);
      const S = this.S; S.time += dt; this.addStat('playTime', dt);
      const boost = Math.max(S.boostT > 0 ? this.C.MANAGER.mult : 1, S.adRushT > 0 ? this.C.ADS.rushStaff : 1);
      if (S.boostT > 0) S.boostT -= dt;
      if (S.adRushT > 0) S.adRushT = Math.max(0, S.adRushT - dt);
      S.earnT = (S.earnT || 0) + dt; if (S.earnT >= 10) { S.earnT = 0; (S.earnLog = S.earnLog || []).push([S.time, this.stat('earned')]); while (S.earnLog.length > 18) S.earnLog.shift(); }   // 3-minute income window
      if (S.rushActive) {
        S.rushT -= dt;
        if (S.rushT <= 0) {
          S.rushActive = false; S.rushT = 0;
          if (this.task() && this.task().key === 'rushServed' && !this.taskProgress().done) {   // failed: allow a retry from the pad
            S.rushRetry = S.taskIndex; S.unlocked = S.unlocked.filter(x => x !== 'grand_open'); S.taskIndex = this.C.TASK_INDEX.open; this.emit('rushEnd', false);
          }
        }
      }
      this.conv.update(dt * (boost > 1 ? 1.15 : 1));
      if (this.staging.length && this.conv.canLoad('A')) {
        const it = this.staging[0];
        if (this.conv.load('A', it.r)) { this.staging.shift(); this.addStat('beltLoaded'); this.addStat('beltLoadedAll'); if (it.by === 'chef') this.addStat('chefLoaded'); }
      }
      this.updateStations(dt * boost);
      this.updateSpawns(dt);
      for (const c of this.customers) this.updateCustomer(c, dt);
      this.customers = this.customers.filter(c => c.state !== CS.GONE);
      this.updateCashier(dt * boost);
      for (const s of this.staff) this.updateStaff(s, dt * boost);
      this.separate();
      this.updatePlayerInteractions(dt);
      for (const a of this.allAgents()) { a.animT += dt; if (a.emoteT > 0) { a.emoteT -= dt; if (a.emoteT <= 0) a.emote = null; } }
      const P = this.player;
      P.idleT = P.moving || P.hold ? 0 : (P.idleT || 0) + dt;
      if (P.cheerT > 0) P.cheerT -= dt;
      if (P.workT > 0) { P.workT -= dt; if (P.workT <= 0) P.working = null; }
      for (const f of this.fx) f.life -= dt;
      this.fx = this.fx.filter(f => f.life > 0);
      this.updateWorkPoses(dt); this.updateWash(dt);
      this.checkTasks();
      this.saveT = (this.saveT || 0) + dt; if (this.saveT > 5) { this.saveT = 0; this.save(); }
    }
    // which work animation a chef-character shows when standing still at a workplace
    updateWorkPoses(dt) {
      const C = this.C, R = C.INTERACT_R;
      for (const a of [this.player, ...this.staff.filter(s => s.char === 'chef')]) {
        a.washT = Math.max(0, (a.washT || 0) - dt); a.atStation = null; a.workAt = null;
        if (a.moving) continue;
        if (a.hold) continue;
        for (const k in this.stations) {
          const st = this.stations[k], Rc = C.RECIPES[st.recipe];
          const working = (Rc.ing ? st.input > 0 : true) && st.output.length < C.STATION.outMax;
          if (working && this.near(a, { x: st.x, y: st.y + 34 }, R)) { a.atStation = 'prepare'; a.workAt = { x: st.x, y: st.y - 6, d: st.x + st.y + 19 }; break; }   // drawn behind the counter, facing the camera
        }
      }
    }
    allAgents() { return [this.player, ...this.staff, ...this.customers]; }

    // ------------------------------------------------------------ stations / production
    updateStations(dt) {
      const C = this.C;
      // fish storage auto-feeds sushi stations (pays ingredient cost)
      if (this.has('storage')) {
        this.feedT = (this.feedT || 0) + dt;
        if (this.feedT > 1.1) {
          this.feedT = 0;
          for (const k in this.stations) {
            const st = this.stations[k], R = C.RECIPES[st.recipe];
            if (!R.ing || st.input >= C.STATION.inMax - 2 || !this.crates[R.ing]) continue;
            const cost = C.INGREDIENTS[R.ing].cost; if (this.S.coins >= cost + 5) this.S.coins -= cost; else if (st.input > 0) continue; st.input++; this.addStat('autoFed');
          }
        }
      }
      for (const k in this.stations) {
        const st = this.stations[k], R = C.RECIPES[st.recipe];
        const hasIn = R.ing ? st.input > 0 : true;
        if (hasIn && st.output.length < C.STATION.outMax) {
          st.prog += dt * this.prodMult / R.prep;
          if (st.prog >= 1) {
            st.prog = 0; if (R.ing) st.input--; st.output.push(st.recipe); st.made++;
            this.addStat('made_' + st.recipe); this.addStat('made');
            if (!this.headless && st.output.length === 1) this.emit('sfx', 'ding');
          }
        } else st.prog = Math.max(0, st.prog - dt * 0.05);
      }
    }

    // ------------------------------------------------------------ customers
    seatsFree(vipKind) {
      return Object.values(this.seats).filter(s => (vipKind ? s.vip && s.kind === vipKind : !s.vip) && !s.occupant && s.dirty === 0);
    }
    regularSeatCount() { return Object.values(this.seats).filter(s => !s.vip).length; }
    menu() { return ['salmon', 'tuna', 'maki'].filter(r => Object.values(this.stations).some(s => s.recipe === r)); }
    updateSpawns(dt) {
      const C = this.C.CUSTOMER;
      const qCap = C.queueCap[this.has('queue') ? 1 : 0];
      const nSeats = this.regularSeatCount();
      let interval = clamp(C.spawnBase - nSeats * 0.55, C.spawnMin, C.spawnBase);
      if (this.S.rushActive) interval *= this.C.RUSH.spawnMult;
      this.spawnT = (this.spawnT || 2) - dt;
      const regs = this.customers.filter(c => c.kind === 'reg' && (c.state === CS.ENTER || c.state === CS.QUEUE)).length;
      if (this.spawnT <= 0) {
        this.spawnT = interval * (0.8 + this.rand() * 0.4);
        const inside = this.customers.filter(c => c.kind === 'reg').length;
        if (regs < qCap && (this.S.taskIndex >= 2 || this.stat('beltLoaded') > 0) && inside < nSeats + qCap + 4) this.spawnCustomer('reg');
      }
      // VIPs
      for (const kind of ['vip1', 'vip2']) {
        const seat = this.seatsFree(kind)[0];
        if (!seat || !this.stations.premium) continue;
        this['vipT_' + kind] = (this['vipT_' + kind] === undefined ? 6 : this['vipT_' + kind]) - dt;
        if (this['vipT_' + kind] <= 0 && !this.customers.some(c => c.kind === kind)) { this['vipT_' + kind] = this.C.VIP.spawnEvery; this.spawnCustomer(kind, seat); }
      }
    }
    spawnCustomer(kind, seat) {
      const L = this.C.LAYOUT, C = this.C.CUSTOMER;
      const skin = kind === 'reg' ? (this.rand() < 0.6 ? 'cust_orange' : 'cust_gray') : kind;
      const c = new Agent(this, skin, L.spawn.x + (this.rand() - 0.5) * 16, L.spawn.y);
      c.kind = kind; c.speed = 95 + this.rand() * 20; c.eaten = 0; c.bill = 0; c.tip = 0; c.happy = true; c.waited = 0; c.firstServed = false;
      if (kind === 'reg') {
        c.wants = C.wantsMin + Math.floor(this.rand() * (C.wantsMax - C.wantsMin + 1));
        const menu = this.menu(); c.wish = menu.slice();
        if (menu.length > 2 && this.rand() < 0.3) c.wish.splice(Math.floor(this.rand() * menu.length), 1); // picky: skips one type
        c.fav = menu[Math.floor(this.rand() * menu.length)];
        c.state = CS.ENTER; c.patience = C.patienceQueue;
      } else {
        const V = this.C.VIP[kind]; c.order = V.wants.slice(); c.state = CS.WALK_SEAT; c.seat = seat; seat.occupant = c; c.patience = V.patience;
        c.goTo(seat.x, seat.y + 4); c.speed = 90;
      }
      this.customers.push(c); this.emit('spawn', c);
      return c;
    }
    // waiting area: with the Waiting Queue unlocked the first two guests sit on the bench, the rest stand in line behind it
    queueSpot(i) {
      const Q = this.C.LAYOUT.queue;
      if (!this.has('queue')) return { x: Q.x, y: Q.y - 40 + i * 28 };
      if (i < 2) return { x: Q.x - 10 + i * 54, y: Q.y - 8, bench: true };
      return { x: Q.x - 26, y: Q.y + 22 + (i - 2) * 26 };
    }
    paySpot(i) { const P = this.C.LAYOUT.cashier.payAt; return i === 0 ? P : { x: P.x - 40, y: P.y + 28 + (i - 1) * 28 }; }
    updateCustomer(c, dt) {
      const CC = this.C.CUSTOMER;
      const walk = () => c.stepPath(dt, c.speed);
      switch (c.state) {
        case CS.ENTER: {
          if (!this.entryQueue.includes(c)) this.entryQueue.push(c);
          const i = this.entryQueue.indexOf(c); const q = this.queueSpot(i);
          if (!c.path || !c.target || dist(c.target, q) > 4) c.goTo(q.x, q.y);
          if (walk()) { c.state = CS.QUEUE; c.dir = 'back_right'; }
          break;
        }
        case CS.QUEUE: {
          const i = this.entryQueue.indexOf(c); const q = this.queueSpot(i);
          if (q.bench && dist(c, q) <= 9) { c.x = q.x; c.y = q.y; c.path = null; }   // a guest on a waiting stool stays put (not nudged off it by passers-by)
          if (dist(c, q) > 3) { c.onBench = false; if (!c.path || dist(c.target, q) > 3) c.goTo(q.x, q.y); walk(); } else { c.dir = 'back_right'; c.onBench = !!q.bench; }
          c.patience -= dt;
          if (i === 0) {
            const seat = this.pickSeat(c); if (seat) { seat.occupant = c; c.seat = seat; this.entryQueue.shift(); c.onBench = false; c.state = CS.WALK_SEAT; c.goTo(seat.x, seat.y + 2); this.emit('sfx', 'pop'); }
          }
          if (c.patience <= 0) { this.leaveAngry(c, 'queue'); }
          break;
        }
        case CS.WALK_SEAT: {
          if (walk()) {
            c.x = c.seat.x; c.y = c.seat.y; c.state = CS.SIT; c.t = 0.4;
            c.dir = c.seat.face; c.patience = c.kind === 'reg' ? CC.patienceSeat : c.patience;
          }
          break;
        }
        case CS.SIT:
          c.t -= dt;
          if (c.t <= 0) {
            if (c.kind === 'reg' && c.seat.table) {   // table guests order from the menu; the chef (or waiter) brings it over
              const menu = c.wish; c.order = []; const n = 1 + (this.rand() < 0.5 ? 1 : 0);
              for (let i = 0; i < n; i++) c.order.push(menu[Math.floor(this.rand() * menu.length)]);
              c.wants = n; c.state = CS.WAIT_ORDER; c.patience = CC.patienceSeat * CC.tablePatienceMult;
            } else { c.state = c.kind === 'reg' ? CS.WAIT_FOR_SUSHI : CS.WAIT_ORDER; if (c.kind === 'reg') this.pickWant(c); }
          }
          break;
        case CS.WAIT_FOR_SUSHI:
          c.wantT = (c.wantT || 0) + dt;
          c.patience -= dt; c.waited += dt;
          if (c.patience < 10 && !c.emote) c.say('angry_hint', 1);
          if (c.patience <= 0) this.leaveAngry(c, 'seat');
          break;
        case CS.WAIT_ORDER:
          c.patience -= dt; c.waited += dt;
          if (c.patience <= 0) this.leaveAngry(c, 'seat');
          break;
        case CS.PICK_SUSHI: c.t -= dt; if (c.t <= 0) { c.state = CS.EAT; c.t = c.kind === 'reg' ? CC.eatTime : this.C.VIP.eatTime; } break;
        case CS.EAT: {
          c.t -= dt;
          if (c.t <= 0) {
            if (c.plate) { c.plate.state = PS.DIRTY; c.plate = null; c.seat.dirty++; }
            c.eaten++;
            if (c.kind === 'reg') {
              if (c.seat.table && c.order && c.order.length) { c.state = CS.WAIT_ORDER; c.patience = Math.max(c.patience, CC.patienceSeat * CC.patienceRefill); }
              else if (c.eaten >= c.wants) {
                const extras = []; if (this.stations.drink) extras.push('drink'); if (this.stations.dessert) extras.push('dessert');
                if (extras.length && !c.extraDone && this.rand() < CC.extraOrderChance) { c.extra = extras[Math.floor(this.rand() * extras.length)]; c.state = CS.EXTRA_WAIT; c.t = CC.extraWait; c.say(c.extra, 99); }
                else this.finishMeal(c);
              } else { c.state = CS.WAIT_FOR_SUSHI; this.pickWant(c); c.patience = Math.max(c.patience, CC.patienceSeat * CC.patienceRefill); }
            } else {
              if (c.order.length) c.state = CS.WAIT_ORDER; else this.finishVip(c);
            }
          }
          break;
        }
        case CS.EXTRA_WAIT: c.t -= dt; if (c.t <= 0) { c.extra = null; c.emote = null; this.finishMeal(c); } break;
        case CS.PAY_QUEUE: {
          const i = this.payQueue.indexOf(c); const q = this.paySpot(i);
          if (dist(c, q) > 3) { if (!c.path || dist(c.target, q) > 3) c.goTo(q.x, q.y); walk(); }
          else { c.dir = 'back_right'; if (i === 0) c.state = CS.PAY; }
          break;
        }
        case CS.PAY:
          c.dir = 'back_right'; c.payWait = (c.payWait || 0) + dt;
          if (c.payWait > this.C.CUSTOMER.payWaitMax && !this.cashierPresent()) {   // nobody at the register: leave the money on the counter (no tip)
            const L = this.C.LAYOUT.cashier; this.addPile(L.pile.x, L.pile.y, c.bill); this.payQueue.shift(); this.addStat('paid');
            if (this.S.rushActive) this.addStat('rushServed');
            c.say('nocoin', 1.5); this.leave(c);
          }
          break;
        case CS.LEAVE: {
          if (walk()) {
            if (!c.exitStep) { c.exitStep = 1; c.target = { x: this.C.LAYOUT.spawn.x, y: this.C.LAYOUT.spawn.y }; c.path = [{ x: this.C.LAYOUT.spawn.x, y: this.C.LAYOUT.spawn.y }]; }
            else c.state = CS.GONE;
          }
          break;
        }
      }
    }
    pickWant(c) {
      const avail = c.wish.filter(r => Object.values(this.stations).some(s => s.recipe === r));
      const list = avail.length ? avail : c.wish;
      // mostly order something already riding the belt (keeps the loop flowing); sometimes ask for a different dish so the chef has to make it
      const onBelt = list.filter(r => this.conv.allPlates().some(p => p.recipe === r) || this.staging.some(s => s.r === r));
      if (onBelt.length && this.rand() < 0.75) c.want = onBelt[Math.floor(this.rand() * onBelt.length)];
      else c.want = list.includes(c.fav) && this.rand() < 0.5 ? c.fav : list[Math.floor(this.rand() * list.length)];
      c.wantT = 0;
    }
    pickSeat(c) {
      // Guests are independent sprites: either hedgehog can use either chair.
      const free = this.seatsFree(null); if (!free.length) return null;
      // prefer seats on the busier belt side order (A first), random among top
      free.sort((a, b) => a.y - b.y);
      return free[Math.floor(this.rand() * Math.min(2, free.length))];
    }
    finishMeal(c) {
      c.extra = null; c.emote = null;
      c.seat.occupant = null; c.seat = null;
      if (c.happy) c.say('heart', 2);
      c.state = CS.PAY_QUEUE; this.payQueue.push(c);
      c.goTo(this.paySpot(this.payQueue.length - 1).x, this.paySpot(this.payQueue.length - 1).y);
    }
    finishVip(c) {
      const V = this.C.VIP[c.kind];
      const amount = c.bill * V.pay + V.bonus;
      this.addPile(c.seat.x + 34, c.seat.y + 14, amount);
      this.S.stars += V.stars; this.addStat(c.kind + 'Served'); this.addStat('paid'); this.addStat('vipServed');
      this.floatText('★' + V.stars, c.x, c.y - 90, '#ffe14d'); this.emit('sfx', 'star'); this.emit('vipPaid', { x: c.seat.x + 34, y: c.seat.y + 14, bonus: V.bonus });
      c.say('heart', 2); c.seat.occupant = null; c.seat = null; this.leave(c);
    }
    leave(c) { c.state = CS.LEAVE; c.exitStep = 0; c.goTo(this.C.LAYOUT.door.x, this.C.LAYOUT.door.y - 14); }
    leaveAngry(c, where) {
      c.say('angry', 2.5); c.happy = false; this.addStat('angry'); this.emit('sfx', 'angry');
      const qi = this.entryQueue.indexOf(c); if (qi >= 0) this.entryQueue.splice(qi, 1);
      if (c.seat) { c.seat.occupant = null; c.seat = null; }
      if (c.eaten > 0 && c.kind === 'reg') { c.state = CS.PAY_QUEUE; this.payQueue.push(c); return; }
      this.leave(c);
    }
    // called by conveyor for every plate movement step
    tryPickup(belt, plate, s0, s1) {
      if (plate.state !== PS.ON_CONVEYOR || plate.takenBy) return false;
      for (const id in this.seats) {
        const st = this.seats[id]; if (st.belt !== belt.id || !st.occupant) continue;
        const c = st.occupant;
        if (c.state !== CS.WAIT_FOR_SUSHI || !c.wish.includes(plate.recipe)) continue;
        if (c.want && plate.recipe !== c.want && (c.wantT || 0) < 5) continue;   // takes the dish shown in its order bubble; after 5 s it accepts anything it likes
        if (!CST.crossed(s0, s1, st.sp, belt.L)) continue;
        // take it — removed from belt by caller, so it can never be taken twice
        plate.state = PS.TAKEN; plate.takenBy = c.id; c.plate = plate;
        c.bill += plate.price * this.priceMult(); c.state = CS.PICK_SUSHI; c.t = 0.35;
        if (!c.firstServed) { c.firstServed = true; if (c.waited > this.C.CUSTOMER.happyFastTime) c.happy = false; }
        this.addStat('platesTaken'); this.emit('sfx', 'pop');
        return true;
      }
      return false;
    }
    // ------------------------------------------------------------ cashier / coin piles
    addPile(x, y, amount) {
      let p = this.piles.find(p => Math.hypot(p.x - x, p.y - y) < 10);
      if (!p) { p = { x, y, amount: 0 }; this.piles.push(p); }
      p.amount += Math.round(amount);
    }
    cashierPresent() {
      const L = this.C.LAYOUT.cashier;
      const st = this.staff.find(s => s.role === 'cashier' && dist(s, L.pad) < 14);
      if (st) return st;
      if (dist(this.player, L.pad) < this.C.INTERACT_R + 6) return this.player;
      return null;
    }
    updateCashier(dt) {
      const head = this.payQueue[0];
      if (!head || head.state !== CS.PAY) { this.payT = 0; return; }
      const who = this.cashierPresent(); this.cashierBusy = !!who;
      if (!who) return;
      this.payT = (this.payT || 0) + dt;
      if (this.payT >= this.C.CUSTOMER.payTime) {
        this.payT = 0;
        const L = this.C.LAYOUT.cashier, CC = this.C.CUSTOMER;
        let amt = head.bill; if (head.happy) amt += Math.ceil(head.bill * CC.tipRate);
        if (this.S.rushActive) amt *= this.C.RUSH.payMult;
        this.addPile(L.pile.x, L.pile.y, amt);
        this.payQueue.shift(); this.addStat('paid'); if (head.happy) this.addStat('happy');
        if (this.S.rushActive) this.addStat('rushServed');
        if (head.happy && this.rand() < this.C.CUSTOMER.happyStarChance) { this.S.stars += 1; this.floatText('★1', head.x, head.y - 80, '#ffe14d'); }
        this.emit('sfx', 'cash'); this.leave(head);
        if (who.role === 'cashier') who.actT = 0.6;
      }
    }
    // ------------------------------------------------------------ inventory helpers
    canTake(agent, kind) { const h = agent.hold; return !h || (h.kind === kind && h.items.length < this.capOf(agent, kind)); }
    capOf(agent, kind) { if (kind === 'dirty') return this.C.CLEAN.dirtyCap; return agent.isPlayer ? this.carryCap : this.C.STAFF.carry; }
    give(agent, kind, item) { if (!agent.hold) agent.hold = { kind, items: [] }; agent.hold.items.push(item); }
    takeItem(agent, pred) {
      const h = agent.hold; if (!h) return null; const i = h.items.findIndex(pred); if (i < 0) return null;
      const it = h.items.splice(i, 1)[0]; if (!h.items.length) agent.hold = null; return it;
    }
    // serve a customer/VIP order item from agent's hold. returns true if delivered.
    serveFrom(agent, c) {
      if (!agent.hold || agent.hold.kind !== 'sushi') return false;
      if (c.state === CS.EXTRA_WAIT && c.extra) {
        const it = this.takeItem(agent, r => r === c.extra); if (!it) return false;
        c.bill += this.C.RECIPES[it].price * this.priceMult(); c.extraDone = true; this.addStat(it === 'drink' ? 'drinksServed' : 'dessertsServed');
        this.floatText('+' + this.C.RECIPES[it].name, c.x, c.y - 80, '#fff'); this.emit('sfx', 'pop');
        c.extra = null; c.emote = null; c.seat.dirty++; c.state = CS.EAT; c.t = 1.6; c.wants = c.eaten + 1; // drink/dessert takes a moment
        return true;
      }
      if (c.state === CS.WAIT_ORDER && c.order && c.order.length) {
        const want = c.order[0]; const it = this.takeItem(agent, r => r === want); if (!it) return false;
        c.order.shift(); c.bill += this.C.RECIPES[it].price * this.priceMult(); c.state = CS.EAT; c.t = c.kind === 'reg' ? this.C.CUSTOMER.eatTime : this.C.VIP.eatTime; c.seat.dirty++;
        if (!c.firstServed) { c.firstServed = true; if (c.waited > this.C.CUSTOMER.happyFastTime * 1.6) c.happy = false; }
        this.addStat('tableServed');
        if (it === 'drink') this.addStat('drinksServed'); if (it === 'dessert') this.addStat('dessertsServed');
        this.emit('sfx', 'pop'); return true;
      }
      return false;
    }

    // ------------------------------------------------------------ player auto-interactions
    // anywhere along the counter's front/sides counts (the v3 counter sprite is wide): front spot or close to the footprint
    atStation(a, st) { const dx = Math.max(0, Math.abs(a.x - st.x) - 42), dy = Math.max(0, Math.abs(a.y - st.y) - 22); return this.near(a, { x: st.x, y: st.y + 34 }) || Math.hypot(dx, dy) < 34; }
    bins() { const L = this.C.LAYOUT; return [L.bin].concat(L.bin2 && this.has(L.bin2.unlock) ? [L.bin2] : []); }
    nearestBin(a) { return this.bins().sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0]; }
    near(a, p, r) { return Math.hypot(a.x - p.x, a.y - p.y) < (r || this.C.INTERACT_R); }
    updatePlayerInteractions(dt) {
      const P = this.player, C = this.C, L = C.LAYOUT;
      for (const sp of L.upgradeSpots || []) {                                  // upgrade spots open their panel once per visit
        const inside = this.near(P, sp, 22);
        sp._dwell = inside && !P.moving ? (sp._dwell || 0) + dt : 0;          // stand on it briefly (walking across never opens it)
        if (sp._dwell > 0.5 && !sp._in) { sp._in = true; this.emit('upgradeSpot', sp); }
        if (!this.near(P, sp, 34)) sp._in = false;
      }
      P.actT = (P.actT || 0) - dt; if (P.actT > 0) return;
      const tick = (t) => { P.actT = t; };
      // conveyor drop-off first, so standing on a nearby build pad never blocks it: plates go onto the staging tray, which feeds the belt whenever there is space
      if (P.hold && P.hold.kind === 'sushi' && this.staging.length < this.stageMax + 12 && this.atBelt(P)) {   // the chef can always set plates down on the tray (staff stop at stageMax)
        const idx = P.hold.items.findIndex(r => C.RECIPES[r].belt);
        if (idx >= 0) {
          const r = P.hold.items.splice(idx, 1)[0]; if (!P.hold.items.length) P.hold = null;
          this.staging.push({ r, by: 'player' }); P.working = 'place'; P.workT = 0.5; this.emit('sfx', 'drop'); tick(0.12); return;
        }
      }
      if (!C.UNLOCKS.some(u => this.padVisible(u) && this.near(P, u.pad, 30))) P.padDwell = 0;
      // coin piles
      for (const p of this.piles) if (p.amount > 0 && this.near(P, p, 44)) { const a = p.amount; p.amount = 0; this.gain(a, p.x, p.y - 20); }
      this.piles = this.piles.filter(p => p.amount > 0);
      // crates
      for (const k in this.crates) {
        const c = this.crates[k]; if (!this.near(P, this.crateAp(c), 30)) continue;
        const closerSt = Object.values(this.stations).some(st => Math.hypot(P.x - st.x, P.y - st.y - 34) < Math.hypot(P.x - this.crateAp(c).x, P.y - this.crateAp(c).y));
        if (closerSt && !(P.hold && P.hold.kind === 'ing' && P.hold.items[0] === c.ing)) continue;   // standing at a station, not at this crate
        const h = P.hold;
        if (h && h.kind === 'ing' && h.items[0] !== c.ing) {                         // carrying another ingredient: put it back (refunded) and swap
          this.S.coins += h.items.length * C.INGREDIENTS[h.items[0]].cost; P.hold = null; this.emit('sfx', 'drop');
        } else if (h && h.kind !== 'ing') { if (!P.emote) P.say(h.kind === 'dirty' ? 'hands_dirty' : 'hands_full', 1.2); continue; }   // hands full of plates
        if (!this.canTake(P, 'ing')) { if (!P.emote) P.say('max', 1); continue; }
        const h2 = P.hold;
        const cost = C.INGREDIENTS[c.ing].cost; if (!this.spend(cost) && this.S.coins >= cost) continue;   // broke? the first crates are on the house (no soft-lock)
        this.give(P, 'ing', c.ing); this.addStat('ingPicked'); this.emit('sfx', 'pick'); tick(0.14); return;
      }
      // return ingredients to crate: when holding an ingredient the player can't use, stand on crate of same kind -> handled above (no-op)
      // stations: deposit ingredients / pick up output
      for (const k in this.stations) {
        const st = this.stations[k]; if (!this.atStation(P, st)) continue;
        const R = C.RECIPES[st.recipe], h = P.hold;
        if (h && h.kind === 'ing' && R.ing && h.items[0] === R.ing && st.input < C.STATION.inMax) {
          this.takeItem(P, () => true); st.input++; this.emit('sfx', 'drop'); tick(0.1); return;
        }
        if (st.output.length && this.canTake(P, 'sushi')) {
          this.give(P, 'sushi', st.output.pop()); this.emit('sfx', 'pick'); tick(0.12); return;
        }
      }
      // serve VIPs / extra orders
      for (const c of this.customers) {
        if ((c.state === CS.EXTRA_WAIT || c.state === CS.WAIT_ORDER) && this.near(P, c, 66)) { if (this.serveFrom(P, c)) { tick(0.2); return; } }
      }
      // cleaning dirty seats
      for (const id in this.seats) {
        const s = this.seats[id]; if (!s.dirty || !this.near(P, s, 56)) continue;
        if (s.occupant && s.occupant.state !== CS.EAT && s.occupant.state !== CS.WAIT_FOR_SUSHI && s.occupant.state !== CS.WAIT_ORDER) continue;
        if (!this.canTake(P, 'dirty')) continue;
        if (s.occupant && s.occupant.state === CS.EAT) continue;
        s.dirty--; this.give(P, 'dirty', 'plate'); this.addStat('cleaned'); this.emit('sfx', 'clink'); tick(this.cleanTime); return;
      }
      // dish return: dirty plates only (released from any side); the job ends there, the sink washes on its own
      if (P.hold && P.hold.kind === 'dirty' && this.sinks().some(s => this.near(P, s, 62) || this.near(P, this.sinkPt(s), C.INTERACT_R + 8))) {
        this.takeItem(P, () => true); this.addStat('washed'); this.queueWash(this.sinks().find(s => this.near(P, s, 62) || this.near(P, this.sinkPt(s), C.INTERACT_R + 8)));
        this.emit('sfx', 'splash'); tick(0.08); return;
      }
      // trash bin: anything else you are stuck holding (ingredients are refunded, sushi is lost)
      P.binDwell = P.hold && P.hold.kind !== 'dirty' && !P.moving && this.bins().some(b => this.near(P, b, 46)) ? (P.binDwell || 0) + dt : 0;   // stand still at the bin for a moment: walking past never throws food away
      if (P.binDwell > 0.45) {
        P.binDwell = 0;
        const kind = P.hold.kind, it = this.takeItem(P, () => true);
        if (kind === 'ing') this.S.coins += C.INGREDIENTS[it].cost;
        this.addStat('binned'); this.emit('sfx', 'drop'); tick(0.08); return;
      }
      // build pads last: they never block crates, stations, the belt or the dish return
      for (const u of C.UNLOCKS) {
        if (!this.padVisible(u) || !this.near(P, u.pad, 30)) continue;
        if (P.slow === false) { P.padDwell = 0; continue; } P.padDwell = (P.padDwell || 0) + dt; if (P.padDwell < 0.35) continue;   // stand on the build spot briefly; walking across doesn't pay
        const paid = this.S.padPaid[u.id] || 0, need = u.cost - paid;
        if (need <= 0) { this.completeUnlock(u.id); return; }
        if (this.S.coins <= 0) { if (!P.emote) P.say('nocoin', 1); continue; }
        const chunk = Math.min(need, this.S.coins, Math.max(1, Math.ceil(u.cost / 28)));
        this.S.coins -= chunk; this.S.padPaid[u.id] = paid + chunk; this.emit('coins');
        if (this.S.padPaid[u.id] >= u.cost) this.completeUnlock(u.id);
        tick(0.05); return;
      }
    }
    say(a, e) { if (!a.emote) a.say(e, 1); }

    // ------------------------------------------------------------ staff AI
    updateStaff(s, dt) {
      const C = this.C, L = C.LAYOUT, sp = s.speed * this.staffMult;
      s.moving = false;   // set again by stepPath only when the agent actually walks this frame (no walking-in-place)
      s.actT = (s.actT || 0) - dt;
      const go = (x, y) => { if (!s.target || Math.hypot(s.target.x - x, s.target.y - y) > 4 || (!s.path && Math.hypot(s.x - x, s.y - y) > 6)) s.goTo(x, y); return s.stepPath(dt, sp) || Math.hypot(s.x - x, s.y - y) < 6; };
      s.working = null;
      if (s.wait > 0) { s.wait -= dt; return; }
      switch (s.role) {
        case 'chef': case 'chef2': {
          if (s.asleep) {                                                    // dozing: does nothing until the player walks past
            s.moving = false; s.path = null;
            if (this.near(this.player, s, 70)) { s.asleep = false; s.awakeT = 0; s.sleepAfter = 0; s.say('heart', 1); this.emit('sfx', 'pop'); this.addStat('wokeStaff'); }
            return;
          }
          s.awakeT = (s.awakeT || 0) + dt;
          if (!s.sleepAfter) s.sleepAfter = C.STAFF.sleepMin + this.rand() * (C.STAFF.sleepMax - C.STAFF.sleepMin);
          if (s.awakeT > s.sleepAfter && !s.hold && !this.headlessNoSleep) { s.asleep = true; s.job = null; s.dir = 'front'; this.emit('sleep', s); return; }
          return this.chefAI(s, dt, go);
        }
        case 'cashier': { if (go(L.cashier.pad.x, L.cashier.pad.y)) { s.dir = 'front'; s.working = this.payQueue.length ? 'checkout' : 'counter'; } return; }
        case 'cleaner': return this.cleanerAI(s, dt, go);
        case 'waiter': return this.waiterAI(s, dt, go);
        case 'manager': return this.managerAI(s, dt, go);
      }
    }
    chefAI(s, dt, go) {
      const C = this.C, L = C.LAYOUT;
      const job = s.job;
      if (!job) {
        // 1) carry finished belt sushi to the loader
        const ready = Object.values(this.stations).filter(st => C.RECIPES[st.recipe].belt && st.output.length && !this.staff.some(o => o !== s && o.job && o.job.st === st))
          .sort((a, b) => b.output.length - a.output.length)[0];
        const clogged = this.staging.length >= this.stageMax;
        const dirtySeat = () => Object.values(this.seats).filter(x => x.dirty > 0 && (!x.occupant || x.occupant.state !== CS.EAT) && !this.staff.some(o => o !== s && o.job && o.job.seat === x)).sort((a, b) => dist(a, s) - dist(b, s))[0];
        // table / VIP orders whose dish is ready (or already in hand): the Waiter Hedgehog serves them too, not only the belt
        const order = this.tableOrders(s).find(r => (s.hold && s.hold.kind === 'sushi' && s.hold.items.includes(r.item)) || (!s.hold && this.stations[r.item].output.length));
        if (s.hold && s.hold.kind === 'dirty') s.job = { t: 'dump' };
        else if (order && !(clogged && !s.hold && dirtySeat() && order.c.kind === 'reg' && order.c.patience > 20)) s.job = { t: 'serve', c: order.c, item: order.item };
        else if (!s.hold && clogged && dirtySeat()) s.job = { t: 'clean', seat: dirtySeat() };   // belt jammed: freeing seats is what unjams it
        else if (s.hold && s.hold.kind === 'sushi') s.job = { t: 'load' };
        else if (ready && this.staging.length < this.stageMax) s.job = { t: 'pick', st: ready };
        else if (!this.has('storage')) {
          const need = Object.values(this.stations).filter(st => C.RECIPES[st.recipe].ing && st.input < 3 && this.crates[C.RECIPES[st.recipe].ing] && !this.staff.some(o => o !== s && o.job && o.job.st === st))[0];
          if (need) s.job = { t: 'fetch', st: need, ing: C.RECIPES[need.recipe].ing };
        }
        // nothing to carry (or the belt is clogged): clear dirty plates from tables/counter so customers can sit and the belt drains
        if (!s.job && !s.hold) {
          const seat = Object.values(this.seats).filter(x => x.dirty > 0 && (!x.occupant || x.occupant.state !== CS.EAT) && !this.staff.some(o => o !== s && o.job && o.job.seat === x))
            .sort((a, b) => dist(a, s) - dist(b, s))[0];
          if (seat) s.job = { t: 'clean', seat };
        }
        if (!s.job) { const home = this.C.LAYOUT.homes[s.role]; if (go(home.x, home.y)) { s.dir = 'front'; } return; }
      }
      const j = s.job;
      if (j.t === 'serve') {
        const c = j.c, still = c.state !== CS.GONE && ((c.state === CS.EXTRA_WAIT && c.extra === j.item) || (c.state === CS.WAIT_ORDER && c.order && c.order[0] === j.item));
        if (!still || this.staff.some(o => o !== s && o.role === 'waiter' && o.job && o.job.c === c)) { s.job = null; return; }
        if (!(s.hold && s.hold.kind === 'sushi' && s.hold.items.includes(j.item))) {
          const st = this.stations[j.item];
          if (go(st.x, st.y + 34)) { s.dir = 'back'; if (!st.output.length) { s.job = null; return; } if (s.actT <= 0) { if (s.hold && s.hold.kind !== 'sushi') return; this.give(s, 'sushi', st.output.pop()); s.actT = 0.2; } }
        } else {
          const sp = c.seat ? this.standPoint(c.seat) : { x: c.x, y: c.y + 14 };
          if (go(sp.x, sp.y)) { s.face(c.x, c.y); s.working = 'serve'; if (this.serveFrom(s, c)) { this.addStat('waiterServed'); this.addStat('chefServed'); s.job = null; s.wait = 0.3; } }
        }
        return;
      }
      if (j.t === 'clean' || (s.hold && s.hold.kind === 'dirty')) {
        if (s.hold && s.hold.kind === 'dirty' && (j.t !== 'clean' || s.hold.items.length >= C.STAFF.carry || !j.seat.dirty)) {   // take the stack to the dish return
          const sp = this.nearestSink(s); if (go(sp.x, sp.y)) { s.dir = 'back'; if (s.actT <= 0) { this.takeItem(s, () => true); this.addStat('washed'); this.queueWash(this.sinks().sort((a, b) => dist(a, s) - dist(b, s))[0]); s.actT = 0.1; if (!s.hold) s.job = null; } }
          return;
        }
        const seat = j.seat, sp = this.standPoint(seat);
        if (go(sp.x, sp.y)) {
          s.face(seat.x, seat.y);
          if (seat.occupant && seat.occupant.state === CS.EAT) { s.job = s.hold ? { t: 'dump' } : null; return; }
          if (seat.dirty > 0 && (!s.hold || s.hold.items.length < C.STAFF.carry)) { if (s.actT <= 0) { seat.dirty--; this.give(s, 'dirty', 'plate'); this.addStat('cleaned'); s.actT = this.cleanTime * 1.2; } }
          else s.job = s.hold ? { t: 'dump' } : null;
        }
        return;
      }
      if (j.t === 'pick') {
        if (go(j.st.x, j.st.y + 34)) {
          s.dir = 'back';
          if (j.st.output.length && (!s.hold || s.hold.items.length < C.STAFF.carry)) { if (s.actT <= 0) { this.give(s, 'sushi', j.st.output.pop()); s.actT = 0.15; } }
          else s.job = s.hold ? { t: 'load' } : null;
        }
      } else if (j.t === 'load') {
        if (go(L.belt.loader.x + (s.role === 'chef2' ? -26 : 26), L.belt.loader.y)) {
          s.dir = 'front_right'; s.working = 'place';
          if (!s.hold) { s.job = null; return; }
          if (s.actT <= 0 && this.staging.length < this.stageMax + ((j.waitT || 0) > 2.5 ? 8 : 0)) {   // belt clogged >2.5 s: stack on the tray anyway, then go clean
            const idx = s.hold.items.findIndex(r => C.RECIPES[r].belt);
            if (idx < 0) { s.hold = null; s.job = null; return; }
            const r = s.hold.items.splice(idx, 1)[0]; if (!s.hold.items.length) s.hold = null;
            this.staging.push({ r, by: 'chef' }); s.actT = 0.25;
          }
          j.waitT = (j.waitT || 0) + dt; if (j.waitT > 8 && s.hold) { /* belt full: keep holding */ j.waitT = 0; }
        }
      } else if (j.t === 'fetch') {
        const cr = this.crates[j.ing];
        if (!s.hold) { const ap = this.crateAp(cr); if (go(ap.x, ap.y)) { s.dir = 'back'; if (s.actT <= 0) { if (this.spend(C.INGREDIENTS[j.ing].cost)) this.give(s, 'ing', j.ing); s.actT = 0.2; if (!this.S.coins) s.job = null; } } }
        else if (s.hold.kind === 'ing' && s.hold.items.length < C.STAFF.carry && Math.hypot(s.x - this.crateAp(cr).x, s.y - this.crateAp(cr).y) < 8) { if (s.actT <= 0 && this.spend(C.INGREDIENTS[j.ing].cost)) { this.give(s, 'ing', j.ing); s.actT = 0.2; } }
        else if (go(j.st.x, j.st.y + 34)) {
          s.dir = 'back';
          if (s.actT <= 0 && s.hold) { this.takeItem(s, () => true); j.st.input++; s.actT = 0.12; }
          if (!s.hold) s.job = null;
        }
      }
    }
    cleanerAI(s, dt, go) {
      const L = this.C.LAYOUT;
      if (s.hold && s.hold.kind === 'dirty' && (s.hold.items.length >= this.C.CLEAN.dirtyCap - 3 || !s.job)) {
        const sp = this.nearestSink(s); if (go(sp.x, sp.y)) { s.dir = 'back'; s.working = 'wipe'; if (s.actT <= 0) { this.takeItem(s, () => true); this.addStat('washed'); this.queueWash(this.sinks().sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[0]); s.actT = 0.1; } }
        return;
      }
      if (!s.job) {
        const seat = Object.values(this.seats).filter(x => x.dirty > 0 && (!x.occupant || x.occupant.state === CS.WAIT_FOR_SUSHI || x.occupant.state === CS.WAIT_ORDER) && !this.staff.some(o => o !== s && o.job && o.job.seat === x))
          .sort((a, b) => dist(a, s) - dist(b, s))[0];
        if (seat) s.job = { seat };
        else if (s.hold && s.hold.kind === 'dirty') { s.job = null; const sp = this.nearestSink(s); if (go(sp.x, sp.y)) { s.dir = 'back'; s.working = 'wipe'; if (s.actT <= 0) { this.takeItem(s, () => true); this.addStat('washed'); this.queueWash(this.sinks().sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[0]); s.actT = 0.1; } } return; }   // nothing left to clean: drop the plates off instead of standing there walking in place
        else { s.hold = null; if (go(L.homes.cleaner.x, L.homes.cleaner.y)) { s.dir = 'front'; s.moving = false; } return; }
      }
      const seat = s.job.seat;
      const sp = this.standPoint(seat);
      if (go(sp.x, sp.y)) {
        s.face(seat.x, seat.y); s.working = 'wipe';
        if (seat.occupant && seat.occupant.state === CS.EAT) return;
        if (seat.dirty > 0 && (!s.hold || s.hold.items.length < this.C.CLEAN.dirtyCap)) { if (s.actT <= 0) { seat.dirty--; this.give(s, 'dirty', 'plate'); this.addStat('cleaned'); s.actT = this.cleanTime * 1.2; } }
        else { s.job = null; if (s.hold && s.hold.items.length < this.C.CLEAN.dirtyCap - 3 && Object.values(this.seats).some(x => x.dirty > 0 && x !== seat)) { /* keep collecting */ } }
      }
    }
    // open table / VIP orders (and drink/dessert extras) not already claimed by another staff member, most urgent first
    tableOrders(s) {
      const reqs = [];
      for (const c of this.customers) {
        if (c.state === CS.EXTRA_WAIT && c.extra) reqs.push({ c, item: c.extra });
        if (c.state === CS.WAIT_ORDER && c.order && c.order.length) reqs.push({ c, item: c.order[0] });
      }
      reqs.sort((p, q) => ((p.c.kind !== 'reg') ? -1000 : 0) + p.c.patience - (((q.c.kind !== 'reg') ? -1000 : 0) + q.c.patience));
      return reqs.filter(r => this.stations[r.item] && !this.staff.some(o => o !== s && o.job && o.job.c === r.c));
    }
    waiterAI(s, dt, go) {
      const C = this.C, L = C.LAYOUT;
      if (!s.job) {
        // find a customer needing drink/dessert/premium
        const reqs = [];
        for (const c of this.customers) {
          if (c.state === CS.EXTRA_WAIT && c.extra) reqs.push({ c, item: c.extra });
          if (c.state === CS.WAIT_ORDER && c.order && c.order.length) reqs.push({ c, item: c.order[0] });
        }
        reqs.sort((p, q) => ((p.c.kind !== 'reg') ? -1000 : 0) + p.c.patience - (((q.c.kind !== 'reg') ? -1000 : 0) + q.c.patience));   // VIPs first, then the least patient
        const r = reqs.find(r => !this.staff.some(o => o !== s && o.job && o.job.c === r.c) && this.stations[r.item] && ((s.hold && s.hold.items.includes(r.item)) || this.stations[r.item].output.length));   // only dishes that are ready: no standing at an empty station
        if (r) s.job = { c: r.c, item: r.item };
        else {
          if (s.hold) s.hold = null;
          // an order is open but its dish isn't ready yet: wait at that counter (looks busy, and is first in line when it's done)
          const pend = reqs.find(r => this.stations[r.item] && !this.staff.some(o => o !== s && o.job && o.job.c === r.c));
          if (pend) { const st = this.stations[pend.item]; if (go(st.x + 30, st.y + 40)) s.dir = 'back'; return; }
          if (go(L.homes.waiter.x, L.homes.waiter.y)) s.dir = 'front'; return;
        }
      }
      const j = s.job, c = j.c;
      const still = (c.state === CS.EXTRA_WAIT && c.extra === j.item) || (c.state === CS.WAIT_ORDER && c.order && c.order[0] === j.item);
      if (!still || c.state === CS.GONE) { s.job = null; return; }
      const has = s.hold && s.hold.items.includes(j.item);
      if (!has) {
        const st = this.stations[j.item];
        if (go(st.x, st.y + 34)) { s.dir = 'back'; if (!st.output.length) { j.waitT = (j.waitT || 0) + dt; if (j.waitT > 1.5) s.job = null; return; } if (s.actT <= 0) { if (s.hold && s.hold.kind !== 'sushi') s.hold = null; this.give(s, 'sushi', st.output.pop()); s.actT = 0.2; } }   // someone else took it: give up instead of waiting there
      } else {
        const sp = c.seat ? this.standPoint(c.seat) : { x: c.x, y: c.y + 14 };
        if (go(sp.x, sp.y)) { s.face(c.x, c.y); s.working = 'serve'; if (this.serveFrom(s, c)) { this.addStat('waiterServed'); s.job = null; s.wait = 0.3; } }
      }
    }
    managerAI(s, dt, go) {
      const M = this.C.MANAGER, L = this.C.LAYOUT;
      s.boostCd = (s.boostCd === undefined ? 8 : s.boostCd) - dt;
      if (s.boostCd <= 0) { s.boostCd = M.every; this.S.boostT = M.duration; s.say('boost', 2); this.emit('boost'); this.emit('sfx', 'boost'); this.addStat('boosts'); }
      // supports operations: collects coin piles at the VIP lounge and checks on the floor
      const pile = this.piles.find(p => p.x > 500 && p.amount > 0);
      if (pile) { if (go(pile.x - 30, pile.y + 10)) { this.gain(pile.amount, pile.x, pile.y - 20); pile.amount = 0; } return; }
      s.patrolT = (s.patrolT || 0) - dt;
      if (s.patrolT <= 0) { s.patrolT = 6; const pts = [{ x: L.managerDesk.x - 40, y: L.managerDesk.y + 30 }, { x: 450, y: 350 }, { x: 560, y: 700 }]; s.patrol = pts[Math.floor(this.rand() * pts.length)]; }
      if (s.patrol && go(s.patrol.x, s.patrol.y)) { s.dir = 'front'; s.working = 'inspect'; }
    }
    // keep agents from overlapping each other (soft separation)
    separate() {
      const movers = this.allAgents().filter(a => !(a.state === CS.QUEUE && a.onBench) && !(a.state && [CS.SIT, CS.WAIT_FOR_SUSHI, CS.PICK_SUSHI, CS.EAT, CS.EXTRA_WAIT, CS.WAIT_ORDER].includes(a.state)) && a.state !== CS.GONE);
      for (let i = 0; i < movers.length; i++) for (let j = i + 1; j < movers.length; j++) {
        const a = movers[i], b = movers[j]; if (a.ghostT > 0 || b.ghostT > 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy); const min = 18;
        if (d > 0.01 && d < min) {
          const both = a.moving && b.moving;
          let push = (min - d) / 2 * (both ? 0.25 : 0.5), nx = dx / d, ny = dy / d;
          if (both) { const rx = nx * 0.5 - ny * 0.866, ry = nx * 0.866 + ny * 0.5; nx = rx; ny = ry; }   // sidestep to pass each other
          const mv = (ag, sx, sy) => { const x = ag.x + sx, y = ag.y + sy; if (this.nav.circleFree(x, y, ag.isPlayer ? ag.r + 1 : 8)) { ag.x = x; ag.y = y; } };
          if (!a.isPlayer || true) mv(a, -nx * push, -ny * push);
          mv(b, nx * push, ny * push);
        }
      }
    }

    // ------------------------------------------------------------ player movement (input in units: -1..1)
    movePlayer(ix, iy, dt) {
      const P = this.player, sp = this.moveSpeed * (this.S.boostT > 0 ? 1.15 : 1);
      const m = Math.hypot(ix, iy);
      P.moving = m > 0.08; P.slow = m < 0.45;
      if (!P.moving) return;
      const k = Math.min(1, m); const vx = ix / m * sp * k * dt, vy = iy / m * sp * k * dt;
      const r = P.r;
      const stuck = !this.nav.circleFree(P.x, P.y, r);   // escape if pushed into an obstacle
      if (stuck || this.nav.circleFree(P.x + vx, P.y, r)) P.x += vx;
      if (stuck || this.nav.circleFree(P.x, P.y + vy, r)) P.y += vy;
      P.x = clamp(P.x, 12, this.C.WORLD.W - 12); P.y = clamp(P.y, 12, this.C.WORLD.H - 12);
      P.setDirFromVel(ix, iy);
    }

    // ------------------------------------------------------------ save / load
    serialize() {
      const S = JSON.parse(JSON.stringify(this.S));
      S.playerPos = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
      S.stationState = {}; for (const k in this.stations) S.stationState[k] = { input: this.stations[k].input, output: this.stations[k].output.length };
      S.seatDirty = {}; for (const k in this.seats) S.seatDirty[k] = this.seats[k].dirty;
      S.piles = this.piles.map(p => ({ x: p.x, y: p.y, amount: p.amount }));
      S.belt = {}; for (const id in this.conv.belts) S.belt[id] = this.conv.belts[id].plates.map(p => [p.recipe, Math.round(p.s)]);
      S.hold = this.player.hold; S.staging = this.staging;
      S.savedAt = Date.now();
      return S;
    }
    save() {
      const st = this.opts.storage; if (!st) return;
      try { st.setItem(this.C.SAVE_KEY, JSON.stringify(this.serialize())); } catch (e) { /* storage unavailable */ }
    }
    load() {
      let raw = null; try { raw = this.opts.storage.getItem(this.C.SAVE_KEY); } catch (e) { }
      if (!raw) return false;
      try {
        const S = JSON.parse(raw); if (!S || S.v !== this.C.VERSION) return false;
        this.newState(); Object.assign(this.S, S);
        this._pending = S; this.loaded = true; return true;
      } catch (e) { return false; }
    }
    restorePending() {
      const S = this._pending; if (!S) return; this._pending = null;
      if (S.stationState) for (const k in S.stationState) if (this.stations[k]) { this.stations[k].input = S.stationState[k].input; this.stations[k].output = Array(S.stationState[k].output).fill(this.stations[k].recipe); }
      if (S.seatDirty) for (const k in S.seatDirty) if (this.seats[k]) this.seats[k].dirty = S.seatDirty[k];
      if (S.piles) this.piles = S.piles;
      if (S.belt) for (const id in S.belt) if (this.conv.belts[id]) for (const [r, s] of S.belt[id]) { const p = this.conv.newPlate(r); p.belt = id; p.s = s; p.state = PS.ON_CONVEYOR; this.conv.belts[id].plates.push(p); }
      if (S.hold) this.player.hold = S.hold; if (S.staging) this.staging = S.staging;
      delete this.S.stationState; delete this.S.seatDirty; delete this.S.piles; delete this.S.belt; delete this.S.hold; delete this.S.staging;
    }
    reset() { try { this.opts.storage && this.opts.storage.removeItem(this.C.SAVE_KEY); } catch (e) { } }
  }
  CST.Game = Game; CST.Agent = Agent;
})(typeof window !== 'undefined' ? window : globalThis);

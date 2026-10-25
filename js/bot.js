/* Autoplay bot: drives the player through the same input API a human uses (joystick vector).
   Used by tools/sim.js for pacing simulation and by ?autoplay=1 for in-browser soak tests. */
(function (root) {
  const CST = root.CST = root.CST || {};
  const CS = () => CST.CUST_STATE;

  class Bot {
    constructor(game, opts = {}) { this.g = game; this.goal = null; this.path = null; this.replan = 0; this.skill = opts.skill || 1; this.log = []; this.idleT = 0; }
    setGoal(x, y, why) {
      if (this.goal && Math.hypot(this.goal.x - x, this.goal.y - y) < 4 && this.path) return;
      this.goal = { x, y, why }; this.path = this.g.nav.findPath(this.g.player.x, this.g.player.y, x, y) || [{ x, y }];
    }
    near(p, r = 30) { const P = this.g.player; return Math.hypot(P.x - p.x, P.y - p.y) < r; }
    think() {
      const g = this.g, C = g.C, P = g.player, L = C.LAYOUT, h = P.hold;
      const staff = r => g.staff.some(s => s.role === r);
      // purchases (UI taps) — upgrades
      const t = g.task();
      if (t && t.type === 'upgrade') { const i = g.upgradeInfo(t.id2); if (!i.locked && i.cost !== null && g.S.coins >= i.cost) g.buyUpgrade(t.id2); }
      const saving = t && t.type === 'unlock' ? g.unlockDef(t.id2).cost - (g.S.padPaid[t.id2] || 0) : (t && t.type === 'upgrade' ? (g.upgradeInfo(t.id2).cost || 0) : 0);
      for (const k of ['carry', 'beltSpeed', 'prod', 'move', 'beltCap', 'clean', 'staff']) {
        const i = g.upgradeInfo(k); if (i.locked || i.cost === null) continue;
        if (g.S.coins - saving > i.cost * 1.3) g.buyUpgrade(k);
      }
      // a dozing waiter cat: walk past to wake it
      { const zz = g.staff.find(s => s.asleep); if (zz) return this.setGoal(zz.x, zz.y + 20, 'wake'); }
      // pads
      for (const u of C.UNLOCKS) {
        if (!g.padVisible(u)) continue;
        const rem = u.cost - (g.S.padPaid[u.id] || 0);
        const isTask = t && t.type === 'unlock' && t.id2 === u.id;
        if ((isTask && g.S.coins >= rem) || (!isTask && g.S.coins - saving >= rem + 40)) { if (!h || h.kind !== 'dirty') return this.setGoal(u.pad.x, u.pad.y, 'pad ' + u.id); const sp = g.nearestSink(P); return this.setGoal(sp.x, sp.y, 'sink'); }
      }
      if (h && h.kind === 'dirty') { const more = !staff('cleaner') && h.items.length < 9 && Object.values(g.seats).some(s => s.dirty > 0 && (!s.occupant || s.occupant.state !== CS().EAT)); if (!more) { const sp = g.nearestSink(P); return this.setGoal(sp.x, sp.y, 'sink'); } }
      const payWaiting = g.payQueue.length && g.payQueue[0].state === CS().PAY;
      if (payWaiting && !staff('cashier') && !(h && h.kind === 'sushi' && g.staging.length < g.stageMax)) return this.setGoal(L.cashier.pad.x, L.cashier.pad.y, 'cashier');
      const pile = g.piles.find(p => p.amount > 0);
      if (pile && (pile.amount > 25 || !h)) return this.setGoal(pile.x, pile.y, 'pile');
      // orders needing direct service (VIP / drinks / desserts) when no waiter
      {
        const waiter = staff('waiter'); const reqs = [];
        for (const c of g.customers) {
          if (c.state === CS().EXTRA_WAIT && c.extra) reqs.push({ c, item: c.extra });
          if (c.state === CS().WAIT_ORDER && c.order && c.order.length && (!waiter || c.kind !== 'reg')) reqs.push({ c, item: c.order[0] });
        }
        if (waiter) for (let i = reqs.length - 1; i >= 0; i--) if (reqs[i].c.kind === 'reg') reqs.splice(i, 1);
        for (const r of reqs) {
          if (h && h.kind === 'sushi' && h.items.includes(r.item)) { const sp = g.standPoint(r.c.seat); return this.setGoal(sp.x, sp.y, 'serve'); }
        }
        const r = reqs.find(r => g.stations[r.item]);
        if (r && (!h || (h.kind === 'sushi' && h.items.length < g.carryCap))) { const st = g.stations[r.item]; return this.setGoal(st.x, st.y + 34, 'fetch ' + r.item); }
      }
      if (h && h.kind === 'sushi' && h.items.some(x => C.RECIPES[x].belt)) {
        if (g.staging.length < g.stageMax) return this.setGoal(L.belt.loader.x, L.belt.loader.y, 'load');
      }
      if (h && h.kind === 'sushi' && !h.items.some(x => C.RECIPES[x].belt) && staff('waiter')) { P.hold = null; }
      if (!staff('cleaner')) {
        const seat = Object.values(g.seats).filter(s => s.dirty > 0 && (!s.occupant || s.occupant.state !== CS().EAT)).sort((a, b) => (a.occupant ? 1 : 0) - (b.occupant ? 1 : 0))[0];
        if (seat && (!h || (h.kind === 'dirty'))) { const sp = g.standPoint(seat); return this.setGoal(sp.x, sp.y, 'clean'); }
      }
      if (!staff('chef') || g.conv.belts.A.count() < 2) {
        const st = Object.values(g.stations).filter(s => C.RECIPES[s.recipe].belt && s.output.length).sort((a, b) => b.output.length - a.output.length)[0];
        if (st && (!h || (h.kind === 'sushi' && h.items.length < g.carryCap)) && g.staging.length < g.stageMax) return this.setGoal(st.x, st.y + 34, 'pick');
      }
      if (h && h.kind !== 'dirty' && (h.kind !== 'sushi' || g.staging.length >= g.stageMax) && Object.values(g.seats).some(s => s.dirty > 0) && !staff('cleaner')) { const bn = g.nearestBin(g.player); return this.setGoal(bn.x + 30, bn.y + (bn.y < 60 ? 30 : 0), 'dump'); }
      if (h && h.kind === 'sushi') return this.setGoal(L.belt.loader.x, L.belt.loader.y, 'load-wait');
      if (!g.has('storage') && !(staff('chef') && g.S.taskIndex > 13)) {
        if (h && h.kind === 'ing') { const st = Object.values(g.stations).find(s => C.RECIPES[s.recipe].ing === h.items[0]); if (st && st.input < C.STATION.inMax) return this.setGoal(st.x, st.y + 34, 'deposit'); }
        const need = Object.values(g.stations).filter(s => C.RECIPES[s.recipe].ing && g.crates[C.RECIPES[s.recipe].ing] && s.input < 4).sort((a, b) => a.input - b.input)[0];
        if (need && g.S.coins > 3) { const cr = g.crates[C.RECIPES[need.recipe].ing]; { const ap = g.crateAp(cr); return this.setGoal(ap.x, ap.y, 'crate'); } }
      }
      if (h && h.kind === 'ing') {
        const st = Object.values(g.stations).find(s => C.RECIPES[s.recipe].ing === h.items[0]);
        if (st && st.input < C.STATION.inMax) return this.setGoal(st.x, st.y + 34, 'deposit');
        { const bn = g.nearestBin(g.player); return this.setGoal(bn.x + 30, bn.y + (bn.y < 60 ? 30 : 0), 'dump'); }   // leftovers go in the trash bin
      }
      if (pile) return this.setGoal(pile.x, pile.y, 'pile');
      return this.setGoal(L.belt.loader.x - 40, L.belt.loader.y - 10, 'idle');
    }
    // returns joystick vector
    update(dt) {
      const P = this.g.player;
      this.replan -= dt; this.goalAge = (this.goalAge || 0) + dt;
      const busy = this.path && this.path.length && this.goalAge < 9;   // commit to the current errand
      if (this.replan <= 0 && !busy) { this.replan = 0.3 / this.skill; const old = this.goal; this.think(); if (this.goal !== old) this.goalAge = 0; }
      if (!this.path || !this.path.length) return { x: 0, y: 0 };
      const wp = this.path[0]; const dx = wp.x - P.x, dy = wp.y - P.y, d = Math.hypot(dx, dy);
      if (d < 5) { this.path.shift(); return { x: 0, y: 0 }; }
      // stuck detection: no progress for 0.8s -> replan from current position
      this.stuckT = (this.stuckT || 0) + dt;
      if (!this.lastPos || Math.hypot(P.x - this.lastPos.x, P.y - this.lastPos.y) > 6) { this.lastPos = { x: P.x, y: P.y }; this.stuckT = 0; }
      if (this.stuckT > 0.8 && this.goal) { this.stuckT = 0; this.path = this.g.nav.findPath(P.x, P.y, this.goal.x, this.goal.y); if (!this.path) return { x: Math.random() - 0.5, y: Math.random() - 0.5 }; }
      return { x: dx / d * Math.min(1, d / 10), y: dy / d * Math.min(1, d / 10) };
    }
  }
  CST.Bot = Bot;
})(typeof window !== 'undefined' ? window : globalThis);

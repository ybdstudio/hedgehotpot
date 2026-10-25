/* Conveyor controller: one small looped kaiten belt in front of the kitchen.
   The loop is a stadium whose long axis runs along world x. Plates carry id, recipe, price,
   path position s, speed, occupied space (BELT.gap) and state. Capacity is finite. */
(function (root) {
  const CST = root.CST = root.CST || {};
  const PS = CST.PLATE_STATE = { PREPARING: 'PREPARING', READY: 'READY', ON_CONVEYOR: 'ON_CONVEYOR', TAKEN: 'TAKEN',
    CONSUMED: 'CONSUMED', DIRTY: 'DIRTY', CLEANED: 'CLEANED' };

  class Belt {
    constructor(id, cy, x0, x1, R) { this.id = id; this.cy = cy; this.R = R; this.plates = []; this.cap = 8; this.loadS = 0; this.setShape(x0, x1); }
    setShape(x0, x1) {
      const oldL = this.L;
      this.x0 = x0; this.x1 = x1; this.Ls = x1 - x0;
      this.L = 2 * this.Ls + 2 * Math.PI * this.R;
      if (oldL) for (const p of this.plates) p.s = p.s / oldL * this.L;   // remap on extension
    }
    // s=0 at (x0, back edge); runs +x along the back (kitchen side), around the right end, -x along the front (customer side)
    point(s) {
      const { cy, R, x0, x1, Ls } = this, arc = Math.PI * R;
      s = ((s % this.L) + this.L) % this.L;
      if (s < Ls) return { x: x0 + s, y: cy - R };
      s -= Ls;
      if (s < arc) { const a = -Math.PI / 2 + s / R; return { x: x1 + R * Math.cos(a), y: cy + R * Math.sin(a) }; }
      s -= arc;
      if (s < Ls) return { x: x1 - s, y: cy + R };
      s -= Ls;
      const a = Math.PI / 2 + s / R; return { x: x0 + R * Math.cos(a), y: cy + R * Math.sin(a) };
    }
    closestS(x, y) {
      let best = 0, bd = 1e9;
      for (let s = 0; s < this.L; s += 2) { const p = this.point(s); const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = s; } }
      return best;
    }
    dist(a, b) { const d = Math.abs(a - b) % this.L; return Math.min(d, this.L - d); }
    count() { return this.plates.length; }
    isFreeAt(s, gap) {
      if (this.count() >= this.cap) return false;
      for (const p of this.plates) if (this.dist(p.s, s) < gap) return false;
      return true;
    }
    bounds() { return { x: this.x0 - this.R - 14, y: this.cy - this.R - 14, w: this.Ls + 2 * this.R + 28, h: 2 * this.R + 28 }; }
  }

  class ConveyorSystem {
    constructor(game) { this.g = game; this.belts = {}; this.nextId = 1; this.speed = 40; this.offset = 0; }
    addBelt(id, cy, x0, x1) { const b = new Belt(id, cy, x0, x1, this.g.C.BELT.halfW); this.belts[id] = b; return b; }
    newPlate(recipe) {
      const R = this.g.C.RECIPES[recipe];
      return { id: this.nextId++, recipe, price: R.price, s: 0, belt: null, speed: this.speed, state: PS.READY, takenBy: null };
    }
    load(beltId, recipe) {
      const b = this.belts[beltId]; if (!b) return false;
      if (!b.isFreeAt(b.loadS, this.g.C.BELT.gap)) return false;
      const p = this.newPlate(recipe); p.belt = beltId; p.s = b.loadS; p.state = PS.ON_CONVEYOR; b.plates.push(p);
      return true;
    }
    canLoad(beltId) { const b = this.belts[beltId]; return !!b && b.isFreeAt(b.loadS, this.g.C.BELT.gap); }
    update(dt) {
      const sp = this.speed * dt; this.offset = (this.offset + sp) % 10000;
      for (const id in this.belts) {
        const b = this.belts[id];
        for (let i = b.plates.length - 1; i >= 0; i--) {
          const p = b.plates[i];
          const s0 = p.s; let s1 = s0 + sp; if (s1 >= b.L) s1 -= b.L;
          p.s = s1; p.speed = this.speed;
          if (this.g.tryPickup(b, p, s0, s1)) b.plates.splice(i, 1);   // removed in the same step → never taken twice
        }
      }
    }
    allPlates() { const out = []; for (const id in this.belts) out.push(...this.belts[id].plates); return out; }
  }
  function crossed(s0, s1, t) { return s1 >= s0 ? (t > s0 && t <= s1) : (t > s0 || t <= s1); }
  CST.crossed = crossed;
  CST.Belt = Belt; CST.ConveyorSystem = ConveyorSystem;
})(typeof window !== 'undefined' ? window : globalThis);

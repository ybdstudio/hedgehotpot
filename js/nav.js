/* Navigation grid + A* pathfinding shared by player collision, customers and staff. */
(function (root) {
  const CST = root.CST = root.CST || {};

  class NavGrid {
    constructor(W, H, cell) {
      this.cell = cell; this.cols = Math.ceil(W / cell); this.rows = Math.ceil(H / cell);
      this.W = W; this.H = H;
      this.block = new Uint8Array(this.cols * this.rows);
      this.version = 0;
    }
    clear() { this.block.fill(0); this.version++; }
    idx(c, r) { return r * this.cols + c; }
    inside(c, r) { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }
    blockRect(x, y, w, h, v = 1) {
      const c0 = Math.floor(x / this.cell), r0 = Math.floor(y / this.cell);
      const c1 = Math.floor((x + w - 1) / this.cell), r1 = Math.floor((y + h - 1) / this.cell);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.inside(c, r)) this.block[this.idx(c, r)] = v;
      this.version++;
    }
    blockedAt(x, y) {
      const c = Math.floor(x / this.cell), r = Math.floor(y / this.cell);
      if (!this.inside(c, r)) return true;
      return this.block[this.idx(c, r)] === 1;
    }
    // circle vs blocked cells
    circleFree(x, y, rad) {
      return !this.blockedAt(x - rad, y - rad * 0.6) && !this.blockedAt(x + rad, y - rad * 0.6) &&
             !this.blockedAt(x - rad, y + rad * 0.4) && !this.blockedAt(x + rad, y + rad * 0.4) && !this.blockedAt(x, y);
    }
    nearestFree(x, y) {
      let c = Math.floor(x / this.cell), r = Math.floor(y / this.cell);
      if (this.inside(c, r) && !this.block[this.idx(c, r)]) return { c, r };
      for (let rad = 1; rad < 12; rad++) {
        let best = null, bd = 1e9;
        for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
          const cc = c + dc, rr = r + dr;
          if (this.inside(cc, rr) && !this.block[this.idx(cc, rr)]) {
            const d = dc * dc + dr * dr; if (d < bd) { bd = d; best = { c: cc, r: rr }; }
          }
        }
        if (best) return best;
      }
      return { c, r };
    }
    lineFree(x0, y0, x1, y1) {
      const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / (this.cell * 0.4));
      for (let i = 1; i <= n; i++) {
        const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        if (!this.circleFree(x, y, 3)) return false;
      }
      return true;
    }
    // obstacles grown by one cell so path centre-lines keep agent radius clearance
    inflated() {
      if (this._infV === this.version) return this._inf;
      const C = this.cols, R = this.rows, b = this.block, o = new Uint8Array(b.length);
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        if (!b[r * C + c]) continue;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < R && cc < C) o[rr * C + cc] = 1; }
      }
      this._inf = o; this._infV = this.version; return o;
    }
    findPath(x0, y0, x1, y1) {
      const raw = this.block; this.block = this.inflated();
      try { return this._findPath(x0, y0, x1, y1); } finally { this.block = raw; }
    }
    _findPath(x0, y0, x1, y1) {
      const s = this.nearestFree(x0, y0), g = this.nearestFree(x1, y1);
      const cols = this.cols, N = cols * this.rows;
      const start = s.r * cols + s.c, goal = g.r * cols + g.c;
      if (start === goal) return [{ x: x1, y: y1 }];
      const gS = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
      const heap = [];   // binary heap of [f, idx]
      const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
      const h = (i) => { const c = i % cols, r = (i / cols) | 0; const dx = Math.abs(c - g.c), dy = Math.abs(r - g.r); return (dx + dy) + (1.414 - 2) * Math.min(dx, dy); };
      gS[start] = 0; push(h(start), start);
      const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
      let found = false, iter = 0;
      while (heap.length && iter++ < 20000) {
        const [, cur] = pop();
        if (closed[cur]) continue; closed[cur] = 1;
        if (cur === goal) { found = true; break; }
        const cc = cur % cols, cr = (cur / cols) | 0;
        for (const [dc, dr, cost] of D) {
          const nc = cc + dc, nr = cr + dr;
          if (!this.inside(nc, nr)) continue;
          const ni = nr * cols + nc;
          if (this.block[ni] || closed[ni]) continue;
          if (dc && dr && (this.block[cr * cols + nc] || this.block[nr * cols + cc])) continue; // no corner cutting
          const ng = gS[cur] + cost;
          if (ng < gS[ni]) { gS[ni] = ng; came[ni] = cur; push(ng + h(ni), ni); }
        }
      }
      if (!found) return null;
      const cells = []; let k = goal;
      while (k !== -1 && k !== start) { cells.push(k); k = came[k]; }
      cells.reverse();
      const pts = cells.map(i => ({ x: (i % cols + 0.5) * this.cell, y: (((i / cols) | 0) + 0.5) * this.cell }));
      pts[pts.length - 1] = { x: x1, y: y1 };
      // string pulling
      const out = []; let ax = x0, ay = y0, i = 0;
      while (i < pts.length) {
        let j = pts.length - 1;
        while (j > i && !this.lineFree(ax, ay, pts[j].x, pts[j].y)) j--;
        out.push(pts[j]); ax = pts[j].x; ay = pts[j].y; i = j + 1;
      }
      return out;
    }
  }
  CST.NavGrid = NavGrid;
})(typeof window !== 'undefined' ? window : globalThis);

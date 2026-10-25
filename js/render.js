/* Isometric canvas renderer (Cat Pizza Tycoon camera).
   The game world is a flat grid; it is projected with sx = (x - y)·K, sy = (x + y)·K/2.
   Floors, the conveyor and build pads are painted with the iso matrix; sprites are drawn upright
   at their projected foot point and depth-sorted by x + y. */
(function (root) {
  const CST = root.CST = root.CST || {};
  const A = () => CST.Assets;
  const CHAR_SCALE = 0.36;          // all hedgehog cutouts share a 160px canvas height
  // per-character size match so every hedgehog's head reads the same size as the chef's (source sheets differ)
  const CHAR_MUL = { server: 0.94, chef: 1, cust_orange: 0.94, cust_gray: 0.94, cashier: 0.94, cleaner: 0.94, waiter: 0.94, vip1: 1, vip2: 0.98, manager: 1 };
  const FONT = 'ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif';
  // prop draw widths in screen units
  const STOOL = { w: 27, dx: 0, dy: 12 };   // empty bar stool (same design as the stool in the counter-eat sprites)
  const PADCARD = { w: 128, h: 54, icon: 26, k: 0.74 };   // build-spot price card: one size for all
  const ICON_FIT = { c_fx_drop: 1.25 };
  const ICON_SCALE = { c_stack_blue: 0.72 };   // tall/fat icons that look bigger than the rest on the build cards    // icons whose art fills its frame edge-to-edge get drawn smaller inside bubbles
  const VIPF = { sw: 58, sx: 0, sy: 12, tw: 30, tx: 30, ty: 16, top: 15, offset: { vip1: [4, -9], vip2: [3, -3] } };   // VIP sofa / side table placement (screen px)
  const TOP = { L: [-12, -25], R: [6, -11] };   // keep food on the tabletop, clear of guest faces
  const STATION5 = { drink: { key: 'st5_drink', w: 96, dx: 4, dy: 6 }, dessert: { key: 'st5_dessert', w: 96, dx: 4, dy: 6 } };   // open-shelf counters: finished drinks/desserts wait on the lower shelf
  const STATION4 = { maki: { key: 'st4_maki_', w: 96, dx: 4, dy: 6 }, premium: { key: 'st4_ikura_', w: 96, dx: 4, dy: 6 } };
  const CT = { w: 32, up: 10 };   // belt bar counter: depth (world) and how far its top sits above the floor (px)
  const STATION2 = { salmon: 132, tuna: 132 };
  const SHELF = { salmon: { x0: 175, dx: 40, y0: 280, slope: 0.12 }, tuna: { x0: 165, dx: 50, y0: 290, slope: 0.09 } };   // lower-shelf floor of each prep counter (567x367 frame px)   // new prep-counter sprite width (world px) for these recipes
  const PW = { st_salmon: 104, st_tuna: 104, st_rice: 88, st_maki: 104, st_premium: 104, st_dessert: 86, st_drink: 86, st_storage: 62, st_sink: 56,
    c_box_salmon: 44, c_box_fish: 44, c_box_veg: 44, c_box_rice: 44, cashier: 100, mgr_desk: 70, armchair: 70, armchair2: 70,
    lantern_r: 24, lantern_w: 24, lantern_p: 24, banner: 34, plant1: 40, plant2: 42, bamboo: 34, chalkboard: 38, maneki: 30, sakura_tree: 130, koi: 76,
    gate: 120, sakura_pot: 46, bonsai: 46, stall: 104, bench_red: 60, table_long: 78, stool: 26, stool_round: 30 };
  const FLOOR = {
    tile:   ['#f4e2c6', '#e2b98f'],    // kitchen: cream / terracotta tiles
    wood:   ['#b5643f', '#a35636'],    // dining: red-brown rosewood planks
    stone:  ['#d6d2cc', '#c5bfb6'],    // entrance: grey stone + red runner
    rug:    ['#c8454f', '#b93c47'],
    tatami: ['#d65a46', '#c64c3b']   // hotpot hall: warm red carpet (was tatami straw)
  };

  class Renderer {
    constructor(canvas, game) {
      this.cv = canvas; this.ctx = canvas.getContext('2d'); this.g = game; this.t = 0;
      this.K = game.C.ISO.K; this.cam = { x: 0, y: 0, z: 1 }; this.zoomMul = 1;
    }
    P(x, y) { const K = this.K; return { x: (x - y) * K, y: (x + y) * K / 2 }; }
    resize() {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const r = this.cv.getBoundingClientRect();
      this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
      this.dpr = dpr; this.cssW = r.width; this.cssH = r.height;
      this.cam.z = (r.width / this.g.C.VIEW_W) * dpr * (this.zoomMul || 1);
    }
    // screen-space vector (joystick) -> world-space vector of the same length
    screenToWorldDir(sx, sy) {
      const m = Math.hypot(sx, sy); if (m < 1e-6) return { x: 0, y: 0 };
      const K = this.K; const x = (sx + 2 * sy) / (2 * K), y = (2 * sy - sx) / (2 * K); const n = Math.hypot(x, y);
      return { x: x / n * m, y: y / n * m };
    }
    w2s(x, y) { const p = this.P(x, y); return { x: (p.x - this.cam.x) * this.cam.z + this.cv.width / 2, y: (p.y - this.cam.y) * this.cam.z + this.cv.height / 2 }; }
    follow(dt, snap) {
      const p = this.P(this.g.player.x, this.g.player.y);
      const k = snap ? 1 : 1 - Math.pow(0.002, dt);
      this.cam.x += (p.x - this.cam.x) * k; this.cam.y += (p.y - 30 - this.cam.y) * k;
    }
    origin() { return { ox: this.cv.width / 2 - this.cam.x * this.cam.z, oy: this.cv.height / 2 - this.cam.y * this.cam.z }; }
    isoT(dy = 0) { const { ox, oy } = this.origin(), z = this.cam.z, K = this.K; this.ctx.setTransform(z * K, z * K / 2, -z * K, z * K / 2, ox, oy + dy * z); }
    scrT() { const { ox, oy } = this.origin(), z = this.cam.z; this.ctx.setTransform(z, 0, 0, z, ox, oy); }

    draw(dt) {
      const ctx = this.ctx; this.t += dt; this.dtLast = dt;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#9fd36b'; ctx.fillRect(0, 0, this.cv.width, this.cv.height);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      this.drawGrass(); this.drawFloors(); this.drawWalls(); this.drawBelt(); this.drawPads();
      this.drawRegisterMat(); this.drawTargetRing(); this.scrT(); this.drawSorted(); this.drawOverlays(); this.drawFx();
    }

    // ---------------------------------------------------------------- ground
    drawGrass() {
      const ctx = this.ctx; this.isoT();
      ctx.fillStyle = '#93c95f';
      for (let i = -12; i < 24; i++) for (let j = -12; j < 24; j++) if ((i + j) % 2 === 0) ctx.fillRect(i * 60, j * 60, 60, 60);
      ctx.fillStyle = 'rgba(70,140,50,0.35)';
      for (let i = 0; i < 90; i++) { const x = ((i * 137) % 1600) - 500, y = ((i * 251) % 1600) - 500; ctx.fillRect(x, y, 7, 2); }
    }
    drawFloors() {
      const ctx = this.ctx, g = this.g, Z = g.C.LAYOUT.zones;
      this.isoT(10); ctx.fillStyle = '#8a5a35';                 // floor slab edge
      for (const k in Z) { const z = Z[k]; if (g.has(z.unlock)) ctx.fillRect(z.x, z.y, z.w, z.h); }
      this.isoT();
      for (const k in Z) { const z = Z[k]; if (g.has(z.unlock)) this.paintFloor(z); }
      for (const k in Z) {                                       // locked: grass with a dashed build outline
        const z = Z[k]; if (g.has(z.unlock)) continue;
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(z.x + 6, z.y + 6, z.w - 12, z.h - 12);
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.setLineDash([12, 9]); ctx.strokeRect(z.x + 8, z.y + 8, z.w - 16, z.h - 16); ctx.setLineDash([]);
      }
    }
    paintFloor(z) {
      const ctx = this.ctx, [a, b] = FLOOR[z.floor] || FLOOR.wood;
      ctx.fillStyle = a; ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.save(); ctx.beginPath(); ctx.rect(z.x, z.y, z.w, z.h); ctx.clip();
      if (z.floor === 'tile') {
        // kitchen: cream / terracotta checker with small red diamonds at the tile corners
        const s = 40; ctx.fillStyle = b;
        for (let x = z.x; x < z.x + z.w; x += s) for (let y = z.y; y < z.y + z.h; y += s) if ((Math.round(x / s) + Math.round(y / s)) % 2 === 0) ctx.fillRect(x, y, s, s);
        ctx.fillStyle = '#c9433a';
        for (let x = z.x + s; x < z.x + z.w; x += s * 2) for (let y = z.y + s; y < z.y + z.h; y += s * 2) { ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 6, y); ctx.closePath(); ctx.fill(); }
      } else if (z.floor === 'stone') {
        // entrance: grey stone slabs, red runner with gold edges from the door
        const s = 40; ctx.fillStyle = b;
        for (let x = z.x; x < z.x + z.w; x += s) for (let y = z.y; y < z.y + z.h; y += s) if ((Math.round(x / s) + Math.round(y / s)) % 2 === 0) ctx.fillRect(x, y, s, s);
        ctx.strokeStyle = 'rgba(120,110,100,.35)'; ctx.lineWidth = 1.5;
        for (let x = z.x; x < z.x + z.w; x += s) for (let y = z.y; y < z.y + z.h; y += s) ctx.strokeRect(x, y, s, s);
        const d = this.g.C.LAYOUT.door, rx = d.x - 26;
        ctx.fillStyle = '#a8262c'; ctx.fillRect(rx, z.y, 52, z.h); ctx.fillStyle = '#e2a83a'; ctx.fillRect(rx + 3, z.y, 3, z.h); ctx.fillRect(rx + 46, z.y, 3, z.h);
        ctx.fillStyle = 'rgba(226,168,58,.55)'; for (let y = z.y + 20; y < z.y + z.h; y += 40) { ctx.beginPath(); ctx.arc(d.x, y, 6, 0, Math.PI * 2); ctx.fill(); }
      } else if (z.floor === 'wood') {
        // dining: rosewood planks, dark seams, faint grain
        ctx.fillStyle = b;
        for (let y = z.y, r = 0; y < z.y + z.h; y += 22, r++) { if (r % 2) ctx.fillRect(z.x, y, z.w, 20); }
        ctx.fillStyle = '#7d3a26';
        for (let y = z.y, r = 0; y < z.y + z.h; y += 22, r++) { ctx.fillRect(z.x, y + 20, z.w, 2); for (let x = z.x + (r % 2) * 50; x < z.x + z.w; x += 100) ctx.fillRect(x, y, 2, 22); }
        ctx.fillStyle = 'rgba(255,220,180,.10)'; for (let y = z.y + 6; y < z.y + z.h; y += 22) ctx.fillRect(z.x, y, z.w, 2);
      } else if (z.floor === 'tatami') {
        // Hotpot Hall: red carpet, gold fret (回) border, round gold medallions
        const x0 = z.x + 8, y0 = z.y + 8, w = z.w - 16, hh = z.h - 16;
        ctx.fillStyle = '#7a1c22'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, hh + 4);
        ctx.fillStyle = a; ctx.fillRect(x0, y0, w, hh);
        ctx.strokeStyle = '#e8b14a'; ctx.lineWidth = 3; ctx.strokeRect(x0 + 8, y0 + 8, w - 16, hh - 16); ctx.lineWidth = 1.5; ctx.strokeRect(x0 + 14, y0 + 14, w - 28, hh - 28);
        ctx.lineWidth = 2; for (let x = x0 + 22; x < x0 + w - 30; x += 24) { for (const yy of [y0 + 4, y0 + hh - 12]) { ctx.strokeRect(x, yy, 8, 8); ctx.strokeRect(x + 2.5, yy + 2.5, 3, 3); } }
        for (let x = x0 + 40; x < x0 + w - 20; x += 64) for (let y = y0 + 44; y < y0 + hh - 30; y += 64) {
          ctx.strokeStyle = '#e8b14a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = 'rgba(232,177,74,.85)'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
          for (let k = 0; k < 4; k++) { const an = k * Math.PI / 2 + Math.PI / 4; ctx.beginPath(); ctx.arc(x + Math.cos(an) * 10, y + Math.sin(an) * 10, 2.2, 0, Math.PI * 2); ctx.fill(); }
        }
      } else if (z.floor === 'rug') {
        // VIP rug (vector, after the rug sprite's design so it stays sharp at any size): red field, gold double border, corner frets
        const x0 = z.x + 10, y0 = z.y + 10, w = z.w - 20, hh = z.h - 20;
        ctx.fillStyle = '#7a1c22'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, hh + 4);
        ctx.fillStyle = '#c3333b'; ctx.fillRect(x0, y0, w, hh);
        ctx.fillStyle = '#b02b33'; for (let yy = y0 + 6; yy < y0 + hh; yy += 12) ctx.fillRect(x0, yy, w, 1.2);   // subtle weave
        ctx.strokeStyle = '#f2b84b'; ctx.lineWidth = 3; ctx.strokeRect(x0 + 12, y0 + 12, w - 24, hh - 24);
        ctx.lineWidth = 1.5; ctx.strokeRect(x0 + 19, y0 + 19, w - 38, hh - 38);
        const fret = (cx, cy, sx, sy) => { ctx.beginPath(); ctx.moveTo(cx, cy + 16 * sy); ctx.lineTo(cx, cy); ctx.lineTo(cx + 16 * sx, cy); ctx.moveTo(cx + 6 * sx, cy + 10 * sy); ctx.lineTo(cx + 6 * sx, cy + 6 * sy); ctx.lineTo(cx + 10 * sx, cy + 6 * sy); ctx.lineWidth = 2.5; ctx.stroke(); };
        fret(x0 + 26, y0 + 26, 1, 1); fret(x0 + w - 26, y0 + 26, -1, 1); fret(x0 + 26, y0 + hh - 26, 1, -1); fret(x0 + w - 26, y0 + hh - 26, -1, -1);
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(90,50,25,0.22)'; ctx.lineWidth = 2; ctx.strokeRect(z.x, z.y, z.w, z.h);
    }
    drawWalls() {
      const ctx = this.ctx, C = this.g.C, H = C.LAYOUT.wallH, K = this.K, z = this.cam.z;
      const { ox, oy } = this.origin();
      // walls are drawn as vectors so they stay sharp at any zoom / device pixel ratio
      const wall = (dirx, len) => {   // u runs along the wall (world units), v is screen height
        ctx.setTransform(z * K * dirx, z * K / 2, 0, z, ox, oy);
        ctx.fillStyle = '#f6e3c6'; ctx.fillRect(0, -H, len, H);                       // warm plaster
        const seg = 64, top = -H + 12, bot = -46;
        const gold = '#e2a83a', goldD = '#a8701c', red = '#b8282f', redD = '#7e1a1f';
        const paw = (cx, cy, r, col) => {
          ctx.fillStyle = col; ctx.beginPath();
          for (let i = 0; i < 20; i++) { const a = i * Math.PI / 10, rr = r * (i % 2 ? .66 : 1); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; if (!i) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
          ctx.closePath(); ctx.fill();
        };
        const lantern = (cx, cy, r) => {
          ctx.strokeStyle = '#5a1f16'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, cy - r * 1.1); ctx.stroke();
          const lg = ctx.createLinearGradient(cx - r, 0, cx + r, 0); lg.addColorStop(0, '#c92a2a'); lg.addColorStop(0.45, '#ff5a3c'); lg.addColorStop(1, '#a51d22');
          ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 1.15, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(120,20,20,.55)'; ctx.lineWidth = 1; for (const k of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.ellipse(cx, cy, r * Math.abs(k) || 0.5, r * 1.15, 0, 0, Math.PI * 2); ctx.stroke(); }
          ctx.fillStyle = gold; ctx.fillRect(cx - r * 0.55, cy - r * 1.3, r * 1.1, r * 0.3); ctx.fillRect(cx - r * 0.55, cy + r * 1.05, r * 1.1, r * 0.3);
          ctx.strokeStyle = gold; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx, cy + r * 1.35); ctx.lineTo(cx, cy + r * 2.1); ctx.stroke();
          paw(cx, cy + r * 0.05, r * 0.42, 'rgba(255,224,150,.9)');
        };
        for (let u = 0, i = 0; u < len - 8; u += seg, i++) {
          const w = Math.min(seg, len - u), x = u + 7, pw = w - 14, ph = bot - top;
          const kind = (i + (dirx > 0 ? 1 : 0)) % 3;
          if (kind === 0) {                                                             // Chinese lattice window, warm glow
            const gr = ctx.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, '#fff1c9'); gr.addColorStop(1, '#ffc46e');
            ctx.fillStyle = gr; ctx.fillRect(x, top, pw, ph);
            const ix = x + pw * 0.2, iy = top + ph * 0.2, iw = pw * 0.6, ih = ph * 0.6;     // 回 fret: inner frame tied to the outer one
            ctx.strokeStyle = gold; ctx.lineWidth = 2.4; ctx.strokeRect(x + 4, top + 4, pw - 8, ph - 8); ctx.strokeRect(ix, iy, iw, ih);
            ctx.beginPath();
            ctx.moveTo(x + pw / 2, top + 4); ctx.lineTo(x + pw / 2, iy); ctx.moveTo(x + pw / 2, iy + ih); ctx.lineTo(x + pw / 2, bot - 4);
            ctx.moveTo(x + 4, top + ph / 2); ctx.lineTo(ix, top + ph / 2); ctx.moveTo(ix + iw, top + ph / 2); ctx.lineTo(x + pw - 4, top + ph / 2);
            ctx.moveTo(ix, iy + ih * 0.35); ctx.lineTo(ix + iw, iy + ih * 0.35); ctx.moveTo(ix, iy + ih * 0.65); ctx.lineTo(ix + iw, iy + ih * 0.65); ctx.stroke();
            ctx.strokeStyle = red; ctx.lineWidth = 4; ctx.strokeRect(x, top, pw, ph);
          } else if (kind === 1) {                                                      // red lacquer panel, gold quill medallion
            const gr = ctx.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, '#c9333a'); gr.addColorStop(1, '#9c2028');
            ctx.fillStyle = gr; ctx.fillRect(x, top, pw, ph);
            const cx = x + pw / 2, cy = top + ph * 0.48, r = Math.min(pw, ph) * 0.3;
            ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = goldD; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2); ctx.stroke();
            paw(cx, cy, r * 0.62, '#b8282f');
            ctx.strokeStyle = gold; ctx.lineWidth = 2;
            for (const [cx2, cy2, sx, sy] of [[x + 4, top + 4, 1, 1], [x + pw - 4, top + 4, -1, 1], [x + 4, bot - 4, 1, -1], [x + pw - 4, bot - 4, -1, -1]]) {
              ctx.beginPath(); ctx.moveTo(cx2, cy2 + sy * 9); ctx.lineTo(cx2, cy2); ctx.lineTo(cx2 + sx * 9, cy2); ctx.moveTo(cx2 + sx * 4, cy2 + sy * 9); ctx.lineTo(cx2 + sx * 4, cy2 + sy * 4); ctx.lineTo(cx2 + sx * 9, cy2 + sy * 4); ctx.stroke(); }
            ctx.strokeStyle = redD; ctx.lineWidth = 3; ctx.strokeRect(x, top, pw, ph);
          } else {                                                                      // pair of red lanterns on cream
            ctx.fillStyle = '#fff4dc'; ctx.fillRect(x, top, pw, ph);
            const r = Math.min(pw * 0.17, ph * 0.13);
            lantern(x + pw * 0.3, top + ph * 0.38, r); lantern(x + pw * 0.7, top + ph * 0.5, r);
            ctx.fillStyle = '#5a1f16'; ctx.fillRect(x - 2, top - 3, pw + 4, 4);
          }
          ctx.fillStyle = '#6e2a1e'; ctx.fillRect(u, -H, 6, H);                       // lacquered post
          ctx.fillStyle = '#8e3a28'; ctx.fillRect(u + 1, -H, 2, H);
        }
        ctx.fillStyle = '#7a2a22'; ctx.fillRect(0, -42, len, 28);                      // red-brown wainscot
        ctx.fillStyle = '#682219'; for (let u = 0; u < len; u += 16) ctx.fillRect(u, -42, 1.5, 28);
        ctx.fillStyle = gold; ctx.fillRect(0, -43, len, 2.5);                          // gold rail
        ctx.fillStyle = '#4a1a12'; ctx.fillRect(0, -14, len, 14);
        ctx.fillStyle = gold; ctx.fillRect(0, -H, len, 6);                             // gold frieze
        ctx.fillStyle = '#5a1f16'; ctx.fillRect(0, -H - 8, len, 10);
      };
      // walls only span the built part of the restaurant
      const Z = Object.values(C.LAYOUT.zones).filter(zn => this.g.has(zn.unlock));
      wall(-1, Math.max(...Z.filter(zn => zn.x === 0).map(zn => zn.y + zn.h)));   // left back wall along x = 0
      wall(1, Math.max(...Z.filter(zn => zn.y === 0).map(zn => zn.x + zn.w)));    // right back wall along y = 0
      this.scrT();
      for (const d of C.LAYOUT.decor) if (d.wall) { const p = this.P(d.x, d.y); A().prop(ctx, d.p, p.x, p.y - d.h + 30, PW[d.p] || 30); }
    }

    // ---------------------------------------------------------------- conveyor (painted flat in iso space)
    stadium(b, r) {
      const ctx = this.ctx; ctx.beginPath();
      ctx.moveTo(b.x0, b.cy - r); ctx.lineTo(b.x1, b.cy - r); ctx.arc(b.x1, b.cy, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(b.x0, b.cy + r); ctx.arc(b.x0, b.cy, r, Math.PI / 2, Math.PI * 1.5); ctx.closePath();
    }
    drawBelt() {
      const ctx = this.ctx, g = this.g, conv = g.conv;
      for (const id in conv.belts) {
        const b = conv.belts[id], R = b.R;
        this.isoT(14); this.stadium(b, R + 16); ctx.fillStyle = '#5a1f16'; ctx.fill();
        this.isoT(); this.stadium(b, R + 16); ctx.fillStyle = '#a8322a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#4a1a12'; ctx.stroke();   // red lacquer
        this.stadium(b, R + 12); ctx.fillStyle = '#e7b24c'; ctx.fill();
        this.stadium(b, R + 10); ctx.fillStyle = '#45414a'; ctx.fill();
        this.stadium(b, R); ctx.lineWidth = 18; ctx.setLineDash([3, 9]); ctx.lineDashOffset = -conv.offset; ctx.strokeStyle = '#5d5964'; ctx.stroke(); ctx.setLineDash([]);
        this.stadium(b, R - 10); ctx.fillStyle = '#e7b24c'; ctx.fill();
        this.stadium(b, R - 12); ctx.fillStyle = '#f1d6a8'; ctx.fill();
      }
      for (const id in conv.belts) {          // built-in bar counter on the dining side (customers eat here)
        const b = conv.belts[id], R = b.R, cx0 = b.x0 - R - 14, cw = b.Ls + 2 * R + 28, cy0 = b.cy + R + 16, ch = CT.w, up = CT.up;
        ctx.fillStyle = '#5e1f18'; for (let dy = 16; dy > -up; dy -= 1.5) { this.isoT(dy); ctx.fillRect(cx0, cy0, cw, ch); }   // solid counter body, top raised above the belt
        this.isoT(-up); ctx.fillStyle = '#b8392e'; ctx.fillRect(cx0, cy0, cw, ch);
        ctx.fillStyle = '#a2302a'; for (let x = cx0 + 22; x < cx0 + cw; x += 22) ctx.fillRect(x, cy0, 1.5, ch);
        ctx.strokeStyle = '#4a1a12'; ctx.lineWidth = 2; ctx.strokeRect(cx0, cy0, cw, ch);
        ctx.fillStyle = '#e2a83a'; ctx.fillRect(cx0, cy0 + ch - 4, cw, 4); ctx.fillRect(cx0, cy0, cw, 3);   // gold trim
      }
      const Ld = g.C.LAYOUT.belt.loader; this.isoT();
      ctx.fillStyle = '#5a1f16'; ctx.fillRect(Ld.x - 22, Ld.y - 9, 44, 18); ctx.fillStyle = '#e2a83a'; ctx.fillRect(Ld.x - 19, Ld.y - 6, 38, 12); ctx.fillStyle = '#b8392e'; ctx.fillRect(Ld.x - 15, Ld.y - 3, 30, 6);
      const P = g.player;
      if (P.hold && P.hold.kind === 'sushi' && Math.hypot(P.x - Ld.x, P.y - Ld.y) < 120) {
        ctx.strokeStyle = `rgba(255,240,140,${0.55 + 0.4 * Math.sin(this.t * 6)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(Ld.x, Ld.y, 30, 0, Math.PI * 2); ctx.stroke();
      }
    }
    roundRect(x, y, w, h, r) { const c = this.ctx; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    plateAt(recipe, x, y, w = 26) {
      const R = this.g.C.RECIPES[recipe]; const ctx = this.ctx;
      if (R.ownPlate) { A().prop(ctx, R.icon, x, y + w * 0.3, w); return; }   // hotpot art: the dish sprite carries its own coloured plate
      if (R.plate) A().prop(ctx, R.plate, x, y + w * 0.28, w);
      A().prop(ctx, R.icon, x, y + (R.plate ? 2 : w * 0.3), w * (R.plate ? 0.78 : 0.9));
    }
    // floor mat where the player (or Cashier Hedgehog) stands to take payments
    drawRegisterMat() {
      const g = this.g, ctx = this.ctx, p = g.C.LAYOUT.cashier.pad; if (g.staff.some(s => s.role === 'cashier')) return;
      this.isoT(); const busy = g.payQueue.length > 0;
      ctx.fillStyle = busy ? 'rgba(255,214,90,0.55)' : 'rgba(255,255,255,0.22)'; ctx.fillRect(p.x - 16, p.y - 16, 32, 32);
      ctx.strokeStyle = busy ? '#ffffff' : 'rgba(120,80,50,0.6)'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 5]); ctx.strokeRect(p.x - 16, p.y - 16, 32, 32); ctx.setLineDash([]);
    }
    // ---------------------------------------------------------------- build pads (dashed iso spots like Cat Pizza)
    drawPads() {
      const ctx = this.ctx, g = this.g;
      this.isoT();
      for (const sp of g.C.LAYOUT.upgradeSpots || []) {                       // dashed circle + yellow up arrow on the floor
        ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.arc(sp.x, sp.y, 22, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#5a3420'; ctx.lineWidth = 3; ctx.setLineDash([7, 6]); ctx.stroke(); ctx.setLineDash([]);
        const can = sp.keys.some(k => { const i = g.upgradeInfo(k); return !i.locked && i.cost !== null && g.S.coins >= i.cost; });
        ctx.save(); ctx.translate(sp.x, sp.y); ctx.rotate(-Math.PI / 4);           // arrow points "up" on screen
        ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(-11, -1); ctx.lineTo(-4.5, -1); ctx.lineTo(-4.5, 11); ctx.lineTo(4.5, 11); ctx.lineTo(4.5, -1); ctx.lineTo(11, -1); ctx.closePath();
        ctx.fillStyle = can ? '#ffd23f' : '#f3e2b0'; ctx.fill(); ctx.strokeStyle = '#5a3420'; ctx.lineWidth = 2.2; ctx.stroke(); ctx.restore();
      }
      for (const u of g.C.UNLOCKS) {
        if (!g.padVisible(u)) continue;
        const p = u.pad, paid = g.S.padPaid[u.id] || 0, frac = u.cost ? paid / u.cost : 1;
        const isTask = g.task() && g.task().id2 === u.id; const r = 30 * (isTask ? 1 + 0.06 * Math.sin(this.t * 5) : 1);
        ctx.fillStyle = g.S.coins + paid >= u.cost ? 'rgba(120,230,120,0.35)' : 'rgba(255,255,255,0.28)';
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = isTask ? '#ffffff' : 'rgba(110,70,40,0.75)'; ctx.lineWidth = 3.5; ctx.setLineDash([9, 7]); ctx.stroke(); ctx.setLineDash([]);
        if (frac > 0) { ctx.strokeStyle = '#ffcf3d'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(p.x, p.y, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke(); }
      }
    }
    // pizza-style price card above each build spot: white card, thick brown outline, tail pointing to the spot
    padLabels() {
      const ctx = this.ctx, g = this.g, tk = g.task();
      for (const u of g.C.UNLOCKS) {
        if (!g.padVisible(u)) continue;
        const q = this.P(u.pad.x, u.pad.y), paid = g.S.padPaid[u.id] || 0, rem = u.cost - paid;
        const afford = g.S.coins >= rem, isTask = tk && tk.id2 === u.id;
        const cy = q.y - 62, txt = u.cost ? this.fmt(rem) : 'FREE';
        // every card has the same size: long names shrink their font instead of widening the card
        const w = PADCARD.w, h = PADCARD.h, x0 = q.x - w / 2, y0 = cy - h / 2;
        let fs = 13; ctx.font = `900 ${fs}px ${FONT}`; while (fs > 10 && ctx.measureText(u.name).width > w - 30) { fs -= 0.5; ctx.font = `900 ${fs}px ${FONT}`; }
        ctx.font = `900 22px ${FONT}`; const pw = ctx.measureText(txt).width + 30;
        ctx.save();
        const tipY = y0 + h + 10; ctx.translate(q.x, tipY); ctx.scale(PADCARD.k, PADCARD.k); ctx.translate(-q.x, -tipY);   // smaller card, same pointer tip
        if (Math.hypot(g.player.x - u.pad.x, g.player.y - u.pad.y) < 70) ctx.globalAlpha = 0.35;          // fade so it never hides the chef standing under it
        ctx.fillStyle = '#4a2614'; this.roundRect(x0, y0 + 4, w, h, 14); ctx.fill();                       // drop edge
        ctx.beginPath(); ctx.moveTo(q.x - 9, y0 + h + 2); ctx.lineTo(q.x, y0 + h + 14); ctx.lineTo(q.x + 9, y0 + h + 2); ctx.fill();
        ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = '#4a2614'; ctx.lineWidth = 3;
        this.roundRect(x0, y0, w, h, 14); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(q.x - 9, y0 + h - 1); ctx.lineTo(q.x, y0 + h + 10); ctx.lineTo(q.x + 9, y0 + h - 1); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(q.x - 9, y0 + h); ctx.lineTo(q.x, y0 + h + 10); ctx.lineTo(q.x + 9, y0 + h); ctx.stroke();
        ctx.textAlign = 'center'; ctx.fillStyle = '#6b3a22'; ctx.font = `900 ${fs}px ${FONT}`; ctx.fillText(u.name, q.x - 6, y0 + 18);
        this.coin(q.x - pw / 2 + 10, y0 + 38, 9);
        ctx.font = `900 22px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = afford ? '#2f9a46' : '#3a1d0e'; ctx.fillText(txt, q.x - pw / 2 + 24, y0 + 46);
        if (u.cost && paid > 0) { ctx.fillStyle = '#ead6bd'; this.roundRect(x0 + 10, y0 + h - 7, w - 20, 4, 2); ctx.fill(); ctx.fillStyle = '#ffc93c'; this.roundRect(x0 + 10, y0 + h - 7, (w - 20) * paid / u.cost, 4, 2); ctx.fill(); }
        const ik = u.icon.startsWith('staff_') ? null : u.icon;
        if (ik) this.iconFit(ik, x0 + w - 6, y0 + 4, PADCARD.icon); else this.drawCharIcon(u.icon, x0 + w - 2, y0 + 16);   // same icon box on every card
        ctx.restore();
        u._cardTop = tipY - (h + 10) * PADCARD.k;                                                          // the task arrow sits on top of this card
        // only the current task gets the big arrow, so there is always exactly one guide on screen
      }
    }
    // draw a prop icon scaled to fit a box x box square centred on (cx, cy), whatever its aspect ratio
    iconFit(key, cx, cy, box) { box *= ICON_SCALE[key] || 1; const a = A().propAspect(key), w = a > 1 ? box / a : box; A().propCentered(this.ctx, key, cx, cy, w); }
    // big green guide arrow (Cat Pizza style), tip at (x, y)
    bigArrow(x, y, s = 1) {
      const c = this.ctx; c.save(); c.translate(x, y); c.scale(s, s);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(-30, -30); c.lineTo(-13, -30); c.lineTo(-13, -62); c.lineTo(13, -62); c.lineTo(13, -30); c.lineTo(30, -30); c.closePath();
      c.lineJoin = 'round'; c.lineWidth = 9; c.strokeStyle = '#ffffff'; c.stroke(); c.lineWidth = 4; c.strokeStyle = '#2e7a3c'; c.stroke();
      const gr = c.createLinearGradient(0, -62, 0, 0); gr.addColorStop(0, '#8ee87a'); gr.addColorStop(1, '#3fb54f'); c.fillStyle = gr; c.fill();
      c.restore();
    }
    drawCharIcon(icon, x, y) {
      const map = { staff_chef: 'chef', staff_cashier: 'cashier', staff_cleaner: 'cleaner', staff_waiter: 'waiter', staff_server: 'server', staff_manager: 'manager' };
      const m = map[icon]; if (!m) return;
      this.blit(CST.Anim.frame(m, 'idle', 'front', 0), x, y, 0.18 * (CHAR_MUL[m] || 1));
    }
    fmt(n) { n = Math.round(n); return n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
    blit(fr, x, y, s = CHAR_SCALE) {
      if (!fr) return; const f = A().frame(fr.atlas, fr.key), im = A().img[fr.atlas]; if (!f || !im) return;
      this.ctx.drawImage(im, f[0], f[1], f[2], f[3], x - fr.ax * s, y - fr.ay * s, f[2] * s, f[3] * s);
    }
    // prop drawn upright with its base at the front corner of its world footprint
    propAt(key, x, y, fw = 40, fh = 40, w, dy = 0, flip = false) {
      const p = this.P(x, y), by = p.y + (fw + fh) * this.K / 4 + dy;
      if (!flip) { A().prop(this.ctx, key, p.x, by, w || PW[key] || 50); return; }
      const c = this.ctx; c.save(); c.translate(p.x, 0); c.scale(-1, 1); A().prop(c, key, 0, by, w || PW[key] || 50); c.restore();   // mirrored: faces front-right
    }

    // ---------------------------------------------------------------- depth-sorted scene
    drawSorted() {
      const g = this.g, L = g.C.LAYOUT, list = [];
      const push = (d, fn) => list.push({ d, fn });
      for (const k in g.stations) { const s = g.stations[k]; push(s.x + s.y + 20, () => this.drawStation(s)); }
      if (g.has('rice')) push(L.rice.x + L.rice.y + 20, () => { this.propAt(L.rice.prop, L.rice.x, L.rice.y, 46, 70, 84, 0, true); this.tagW(L.rice.x, L.rice.y, 70, `Broth x${g.C.RICE_MULT}`); });
      for (const bn of g.bins()) push(bn.x + bn.y + 8, () => { const q = this.P(bn.x, bn.y); A().prop(this.ctx, 'trash_bin', q.x, q.y + 12, 30); const h = g.player.hold;
        if (h && h.kind !== 'dirty' && Math.hypot(g.player.x - bn.x, g.player.y - bn.y) < 160) this.tagW(bn.x, bn.y, 46, 'Trash'); });
      if (g.has('storage')) push(L.storage.x + L.storage.y + 20, () => { this.propAt(L.storage.prop, L.storage.x, L.storage.y, 40, 60, 62); this.tagW(L.storage.x, L.storage.y, 60, 'Auto-feed'); });
      for (const k in g.crates) { const c = g.crates[k]; push(c.x + c.y + 10, () => this.drawCrate(c)); }
      for (const s of g.sinks()) push(s.x + s.y + 15, () => {
        // auto-wash states: 0 idle · 1 bubbles · 2 sponge · 3 sparkle when the backlog is done; mirrored on the west wall so its front faces down-right
        const w = g.wash[s.id], fi = w && w.q > 0 ? 1 + (Math.floor(this.t * 3) % 2) : w && w.done > 0 ? 3 : 0;
        this.propAt('sink2_' + fi, s.x, s.y, 44, 74, 108, 4, s.x < g.C.SPLIT_X); this.tagW(s.x, s.y, 76, w && w.q > 0 ? `Washing ×${w.q}` : 'Dish Return'); });
      push(L.cashier.x + L.cashier.y + 15, () => this.propAt(L.cashier.prop, L.cashier.x, L.cashier.y, 80, 26, 100));
      if (g.has('manager')) push(L.managerDesk.x + L.managerDesk.y + 10, () => this.propAt(L.managerDesk.prop, L.managerDesk.x, L.managerDesk.y, 56, 30, 70));
      for (const d of L.decor) if (!d.wall) push(d.x + d.y + 5, () => this.propAt(d.p, d.x, d.y, 24, 24));
      if (g.has('final_decor')) for (const d of L.finalDecor) push(d.x + d.y + 10, () => this.propAt(d.p, d.x, d.y, 30, 30));
      if (g.has('queue')) for (let i = 0; i < 2; i++) {   // two waiting stools; a seated guest's sprite carries its own stool
        const sp = g.queueSpot(i);
        push(sp.x + sp.y - 1, () => { const q = this.P(sp.x, sp.y); A().prop(this.ctx, 'stool_bar', q.x + STOOL.dx, q.y + STOOL.dy, STOOL.w); });   // same stool whether a guest sits on it or not
      }
      for (const id in g.tables) { const t = g.tables[id]; push(t.x + t.y, () => this.drawTable(t)); }
      for (const id in g.seats) { const s = g.seats[id]; push(s.x + s.y - 1, () => this.drawSeat(s));
        if (s.vip) push(s.x + s.y + 2.5, () => { const q = this.P(s.x, s.y); A().prop(this.ctx, 'vip_sofa_front', q.x + VIPF.sx, q.y + VIPF.sy, VIPF.sw); });   // armrest + seat front over the seated VIP
        if (s.vip) push(s.x + s.y + 3, () => { const q = this.P(s.x, s.y); A().prop(this.ctx, 'vip_table', q.x + VIPF.tx, q.y + VIPF.ty, VIPF.tw);
          for (let i = 0; i < Math.min(6, s.dirty); i++) A().prop(this.ctx, 'c_plate_pink', q.x + VIPF.tx, q.y + VIPF.ty - VIPF.top - i * 2.5, 14, 0.95);   // finished plates stay on the VIP table
          if (s.dirty > 0 && !(s.occupant && s.occupant.state === 'EAT')) this.bubbleIcon(q.x + VIPF.tx, q.y + VIPF.ty - VIPF.top - 26 - Math.min(6, s.dirty) * 3, 'c_fx_drop', 0.7); }); }   // round side table, in front of the seated VIP
      for (const p of g.conv.allPlates()) { const pt = g.conv.belts[p.belt].point(p.s); push(pt.x + pt.y, () => { const q = this.P(pt.x, pt.y); this.plateAt(p.recipe, q.x, q.y - 2, 26); }); }
      const Ld = L.belt.loader;
      push(Ld.x + Ld.y, () => g.staging.forEach((it, i) => { const j = i % 6, layer = Math.floor(i / 6); const q = this.P(Ld.x - 12 + (j % 3) * 12, Ld.y - 4 + Math.floor(j / 3) * 8); this.plateAt(it.r, q.x, q.y - 4 - layer * 6, 18); })   /* extra plates stack in layers */);
      for (const p of g.piles) push(p.x + p.y, () => this.drawPile(p));
      for (const a of g.allAgents()) push(a.atStation && a.workAt && !a.moving ? a.workAt.d : (a.seat && a.seat.table && a.x === a.seat.x && a.y === a.seat.y) ? g.tables[a.seat.table].x + g.tables[a.seat.table].y + 1 : a.x + a.y + (a.seat && a.x === a.seat.x && a.y === a.seat.y ? 2 : 0), () => this.drawAgent(a));   // table guests draw just after their table
      list.sort((a, b) => a.d - b.d);
      for (const it of list) it.fn();
      this.padLabels();
    }
    tagW(x, y, h, t) { const p = this.P(x, y); this.tag(p.x, p.y - h, t); }
    tag(x, y, t) { const c = this.ctx; c.font = `800 11px ${FONT}`; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(70,35,20,0.85)'; c.strokeText(t, x, y); c.fillStyle = '#fff6d8'; c.fillText(t, x, y); }
    // the chef standing at this station in the 'prepare' pose (drawn as part of the counter sprite)
    stationWorker(s) { for (const a of this.g.allAgents()) if (a.atStation === 'prepare' && a.workAt && !a.moving && a.workAt.x === s.x && a.workAt.y === s.y - 6) return a; return null; }
    drawStation(s) {
      const ctx = this.ctx, g = this.g, R = g.C.RECIPES[s.recipe];
      const p = this.P(s.x, s.y);
      const hasIn = R.ing ? s.input > 0 : true, full = s.output.length >= g.C.STATION.outMax;
      if (STATION2[s.recipe]) {
        // new prep counters: 0 ready · 1-2 knife cutting · 3 done; with the chef working, the chef-at-counter overlay plays instead
        if (s._made !== s.made) { if (s._made !== undefined) s._flashT = 0.45; s._made = s.made; }
        s._flashT = Math.max(0, (s._flashT || 0) - this.dtLast);
        // v3 counters (empty lower shelf): 0 ready · 1 knife cutting · 2 slices done (sparkle) · 3 empty board (no fish)
        const worker = this.stationWorker(s), key = 'st3_' + s.recipe + '_';
        // the counter only animates while a chef works at it; otherwise it stays still and finished plates just appear on the shelf
        const fi = worker ? 0 : (R.ing && s.input <= 0) ? 3 : 0;
        const W = STATION2[s.recipe], by = p.y + (84 + 50) * this.K / 4 + 4, DW = W * 567 / 520, k = DW / 567;
        A().prop(ctx, key + fi, p.x + 6, by, DW);
        // The actual worker is drawn behind this counter by drawAgent; no
        // oversized chef baked into a station-sized overlay.
        // finished plates sit on the lower shelf (hotpot counter art: shelf floor runs from (150,272) to (370,244) on the 567x367 frame)
        const x0 = p.x + 6 - DW / 2, y0 = by - 367 * k;
        const SH = SHELF[s.recipe] || SHELF.salmon;
        s.output.forEach((r, i) => { const cx = SH.x0 + i * SH.dx, cy = SH.y0 - (cx - SH.x0) * SH.slope; this.plateAt(r, x0 + cx * k, y0 + cy * k - 4, 16); });
      } else if (STATION4[s.recipe]) {
        // cucumber & nori / ikura counters: 0 empty · 1 ingredients ready (working) · 2 rolls placed (finished plates waiting) · 3 completed flash
        if (s._made !== s.made) { if (s._made !== undefined) s._flashT = 0.5; s._made = s.made; }
        s._flashT = Math.max(0, (s._flashT || 0) - this.dtLast);
        const fi = s._flashT > 0 ? 3 : s.output.length ? 2 : hasIn ? 1 : 0, S4 = STATION4[s.recipe];
        A().prop(ctx, S4.key + fi, p.x + S4.dx, p.y + (84 + 50) * this.K / 4 + S4.dy, S4.w);
      } else if (STATION5[s.recipe]) {
        const S5 = STATION5[s.recipe], by = p.y + (84 + 50) * this.K / 4 + S5.dy, h = A().prop(ctx, S5.key, p.x + S5.dx, by, S5.w);
        // lower shelf of the counter (sprite fractions): items stand on its floor, back row first
        const x0 = p.x + S5.dx - S5.w / 2, y0 = by - h;
        s.output.forEach((r, i) => { const row = i < 3 ? 0 : 1, col = i % 3; const fx = 0.44 + col * 0.085 - row * 0.03, fy = 0.80 + row * 0.05 - col * 0.035;
          A().prop(ctx, g.C.RECIPES[r].icon, x0 + fx * S5.w, y0 + fy * h, 9); });
      } else {
        this.propAt(s.prop, s.x, s.y, 84, 50, PW[s.prop] || 104);
        s.output.forEach((r, i) => this.plateAt(r, p.x - 18 + (i % 3) * 14, p.y - 6 - Math.floor(i / 3) * 6, 16));
      }
      const low = !STATION2[s.recipe], LX = p.x + (low ? 26 : 34), LY = p.y - (low ? 70 : 92);   // smaller counters: keep the tag close to them                                   // label sits up and to the right of the chef working behind the counter
      ctx.save(); ctx.translate(LX, LY);
      if (R.ing) {
        this.roundRect(-34, -10, 68, 20, 10); ctx.fillStyle = 'rgba(255,255,255,0.93)'; ctx.fill();
        this.iconFit(R.icon, -24, 0, 15);
        ctx.font = `800 9px ${FONT}`; ctx.textAlign = 'left';
        ctx.fillStyle = '#7a3b2a'; ctx.fillText(`${s.input}`, -14, 3);
        this.iconFit(g.C.INGREDIENTS[R.ing].icon, 1, 0, 12);
        ctx.fillStyle = full ? '#e0464f' : '#3aa856'; ctx.fillText(full ? 'FULL' : `${s.output.length}/${g.C.STATION.outMax}`, 9, 3);
      } else {   // no ingredient needed (drink / dessert): compact pill — recipe icon + count
        this.roundRect(-22, -10, 44, 20, 10); ctx.fillStyle = 'rgba(255,255,255,0.93)'; ctx.fill();
        this.iconFit(R.icon, -12, 0, 15);
        ctx.font = `800 9px ${FONT}`; ctx.textAlign = 'left';
        ctx.fillStyle = full ? '#e0464f' : '#3aa856'; ctx.fillText(full ? 'FULL' : `${s.output.length}/${g.C.STATION.outMax}`, -3, 3);
      }
      ctx.restore();
      if (hasIn && !full) {
        // processing badge: white disc, thick green progress ring, recipe icon in the middle, gentle pulse
        const bx = LX + (R.ing ? 48 : 36), byy = LY, rr = 13 + Math.sin(this.t * 6) * 0.8;
        ctx.beginPath(); ctx.arc(bx, byy, rr + 4, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#6b3a22'; ctx.stroke();
        ctx.beginPath(); ctx.lineWidth = 5; ctx.strokeStyle = '#d9f2d4'; ctx.arc(bx, byy, rr, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.lineCap = 'round'; ctx.strokeStyle = '#3fbf5e'; ctx.arc(bx, byy, rr, -Math.PI / 2, -Math.PI / 2 + Math.max(0.05, s.prog) * Math.PI * 2); ctx.stroke(); ctx.lineCap = 'butt';
        A().propCentered(ctx, R.icon, bx, byy, 15);
      } else if (R.ing && !hasIn) this.bubbleIcon(LX + 44, LY, g.C.INGREDIENTS[R.ing].icon, 0.8);
    }
    drawCrate(c) {
      const g = this.g; this.propAt(c.prop, c.x, c.y, 34, 34, 44);
      this.tagW(c.x, c.y, 26, `${g.C.INGREDIENTS[c.ing].name} · ${g.C.INGREDIENTS[c.ing].cost}c`);
    }
    tableGuest(t, side) {
      const seat = this.g.seats[t.id + side], guest = seat && seat.occupant;
      return guest && guest.x === seat.x && guest.y === seat.y ? guest : null;
    }
    drawTable(t) { this.drawTableBody(t); this.tablePlates(t); }
    // finished plates of each guest sit on their half of the table top (drawn after the table sprite, so never under it)
    tablePlates(t) {
      const p = this.P(t.x, t.y); let drop = null;
      for (const side of ['L', 'R']) {
        const s = this.g.seats[t.id + side]; if (!s || !(s.dirty > 0)) continue;
        const c = s.occupant, n = Math.min(6, s.dirty), x = p.x + TOP[side][0], y = p.y + TOP[side][1];
        for (let i = 0; i < n; i++) A().prop(this.ctx, 'c_plate_pink', x, y - i * 2.5, 14, 0.95);
        if ((!c || c.state !== 'EAT') && !drop) drop = { x: p.x - 8, y: y - 30 - n * 2.5 };
      }
      if (drop) this.bubbleIcon(drop.x, drop.y, 'c_fx_drop', 0.7);   // one 'needs cleaning' bubble per table
    }
    drawTableBody(t) {
      const p = this.P(t.x, t.y), ctx = this.ctx;
      const left = this.tableGuest(t, 'L'), right = this.tableGuest(t, 'R');
      ctx.fillStyle = 'rgba(60,30,15,0.16)'; ctx.beginPath();
      ctx.ellipse(p.x, p.y + 12, 47, 16, 0, 0, Math.PI * 2); ctx.fill();
      const diner = (guest, side) => {
        if (!guest) return;
        const eating = this.logical(guest) === 'eat';
        const fr = CST.Anim.frame(guest.char, eating ? 'eat' : 'sit', side === 'L' ? 'right' : 'left', guest.animT);
        const x = p.x + (side === 'L' ? -28 : 28), y = p.y + (side === 'L' ? -4 : 6);
        this.blit(fr, x, y + (eating ? Math.sin(this.t * 5) * .65 : 0), .32);
      };
      // Chair backs begin behind the guests. Only the tabletop covers the
      // far guest's lap; the far chair back must never cover their face.
      A().prop(ctx, 'dine_table', p.x, p.y + 24, 100);
      diner(left, 'L');
      if (left) {
        ctx.save(); ctx.beginPath(); ctx.moveTo(p.x - 39, p.y - 19);
        ctx.lineTo(p.x - 1, p.y - 39); ctx.lineTo(p.x + 35, p.y - 20);
        ctx.lineTo(p.x - 3, p.y + 5); ctx.lineTo(p.x - 39, p.y - 13); ctx.closePath(); ctx.clip();
        A().prop(ctx, 'dine_table', p.x, p.y + 24, 100); ctx.restore();
      }
      diner(right, 'R');
      if (right) {
        ctx.save(); ctx.beginPath(); ctx.rect(p.x + 13, p.y + 1, 42, 30); ctx.clip();
        A().prop(ctx, 'dine_table', p.x, p.y + 24, 100); ctx.restore();
      }
      if (left || right) A().prop(ctx, 'hp_pot', p.x, p.y - 20, 21);
      for (const [side, guest] of [['L', left], ['R', right]]) {
        if (!guest || !(guest.plate || this.logical(guest) === 'eat')) continue;
        const [dx, dy] = TOP[side];
        this.plateAt(guest.plate ? guest.plate.recipe : 'salmon', p.x + dx, p.y + dy, 15);
      }
    }
    // screen point on the bar counter top in front of a belt stool (counter strip = belt.cy + R + 15 … +39)
    counterPt(seat, dx) { const b = this.g.conv.belts[seat.belt] || Object.values(this.g.conv.belts)[0]; const q = this.P(seat.x + 14 + dx, b.cy + b.R + 16 + CT.w * 0.55); q.y -= CT.up; return q; }
    drawSeat(s) {
      const ctx = this.ctx, g = this.g, c = s.occupant;
      const seated = c && c.x === s.x && c.y === s.y;
      const p = this.P(s.x, s.y);
      if (s.vip) { A().prop(ctx, 'vip_sofa', p.x + VIPF.sx, p.y + VIPF.sy, VIPF.sw); }   // same sofa whether the VIP sits in it or not (the side table is drawn in front, see drawVipTable)
      else if (!s.table) { if (s.belt) A().prop(ctx, 'stool_bar', p.x + STOOL.dx, p.y + STOOL.dy, STOOL.w); else A().prop(ctx, 'stool', p.x, p.y + 10, 26); }
      if (s.dirty > 0 && !s.vip && !s.table) {
        let q;
        if (s.belt) q = this.counterPt(s, 0);                 // on the bar counter top in front of the customer, never on the moving belt
        else if (s.table) { const t = g.tables[s.table]; q = this.P(t.x + (s.x < t.x ? -10 : 10), t.y); }
        else { q = this.P(s.x, s.y); q.x += VIPF.tx; q.y += VIPF.ty - 22; }   // VIP: on the round side table
        const lift = s.belt ? 0 : 12;                          // counter plates sit flat on the counter top
        for (let i = 0; i < Math.min(8, s.dirty); i++) A().prop(ctx, 'c_plate_pink', q.x, q.y + 4 - lift - i * 3, 18, 0.9);
        if (!c || c.state !== 'EAT') this.bubbleIcon(q.x, q.y - 38 - Math.min(8, s.dirty) * 3, 'c_fx_drop', 0.7);
      }
    }
    drawPile(p) {
      const q = this.P(p.x, p.y), n = Math.min(8, 2 + Math.floor(p.amount / 15));
      for (let i = 0; i < n; i++) this.coin(q.x + ((i * 7) % 15) - 7, q.y - i * 3, 7);
      this.tag(q.x, q.y - n * 3 - 12, this.fmt(p.amount));
    }
    coin(x, y, r) { const c = this.ctx; c.fillStyle = '#c98a12'; c.beginPath(); c.ellipse(x, y + 1.5, r, r * 0.55, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffd34d'; c.beginPath(); c.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#e6a91c'; c.lineWidth = 1.2; c.stroke(); }
    logical(a) {
      const CS = CST.CUST_STATE;
      if (a.kind) {
        if ([CS.SIT, CS.WAIT_FOR_SUSHI, CS.EXTRA_WAIT, CS.WAIT_ORDER].includes(a.state) && a.seat) return 'sit';
        if ([CS.PICK_SUSHI, CS.EAT].includes(a.state)) return 'eat';
        if (a.moving) return 'walk';
        if (a.char === 'cust_orange' && a.emote === 'heart') return 'happy';
        return 'idle';
      }
      if (a.char === 'chef') {
        if (a.cheerT > 0) return 'cheer';
        if (a.working === 'place' && !a.moving) return 'place';
        if (!a.moving && a.atStation) return a.atStation;          // 'prepare' at a sushi station, 'wash' at the dish return
        if (a.hold && a.hold.kind !== 'dirty') return a.moving ? 'carry' : 'carry_idle';
        if (a.moving) return 'walk';
        return (a.idleT || 0) > 8 ? 'sleep' : 'idle';
      }
      if (a.asleep) return 'sleep';
      if (a.char === 'waiter' && a.hold && !a.moving) return 'carry_idle';
      if (a.working === 'wipe' && a.char === 'cleaner') return 'wipe';
      if (a.moving) return a.hold ? (a.char === 'waiter' && a.hold.kind === 'dirty' ? 'carry_dirty' : 'carry') : 'walk';
      if (a.working === 'inspect') return 'inspect';
      if (a.char === 'server' && a.working === 'serve') return 'serve';
      return 'idle';
    }
    drawAgent(a) {
      if (a.seat && a.seat.table && a.x === a.seat.x && a.y === a.seat.y) {
        this.drawAgentOverlay(a, this.P(a.x, a.y), true); return;
      }
      const ctx = this.ctx, lg = this.logical(a), working = (lg === 'prepare' || lg === 'wash') && a.workAt; let q = working ? this.P(a.workAt.x, a.workAt.y) : this.P(a.x, a.y);
      const seated = lg === 'sit' || lg === 'eat';
      if (!seated && !working) { const sw = a.char === 'chef' ? 22 : 17; const sg = ctx.createRadialGradient(q.x, q.y + 2, 1, q.x, q.y + 2, sw); sg.addColorStop(0, 'rgba(60,30,15,0.42)'); sg.addColorStop(0.7, 'rgba(60,30,15,0.28)'); sg.addColorStop(1, 'rgba(60,30,15,0)'); ctx.save(); ctx.translate(q.x, q.y + 2); ctx.scale(1, 0.42); ctx.translate(-q.x, -(q.y + 2)); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(q.x, q.y + 2, sw, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      // (no ring under the player — the green ground pointer guides instead, as in Cat Pizza)
      const dir = working ? 'front' : seated && a.seat ? (a.seat.vip ? 'front' : a.seat.face) : a.dir;
      const onBench = a.onBench && a.state === CST.CUST_STATE.QUEUE;   // game clears onBench as soon as the guest leaves the stool spot
      const atCounter = (seated && a.seat && a.seat.belt && a.kind === 'reg') || onBench;
      if (atCounter && a.seat && a.seat.belt && seated && !(a.seat.dirty > 0)) { const pt = this.counterPt(a.seat, 6); A().prop(ctx, 'hp_pot', pt.x, pt.y + 2, 17); }   // hotpot: every seated guest has a mini pot on the bar
      if (atCounter && a.seat && a.seat.belt && (a.plate || lg === 'eat')) { const pp = this.counterPt(a.seat, -14); this.plateAt(a.plate ? a.plate.recipe : 'salmon', pp.x, pp.y - 4, 22); }
      const onStool = atCounter;   // counter stools and the two waiting stools: seated sprite with its own stool
      if (seated && a.seat && a.seat.vip && VIPF.offset[a.char]) { q = { x: q.x + VIPF.offset[a.char][0], y: q.y + VIPF.offset[a.char][1] }; }
      const fr = CST.Anim.frame(a.char, onBench && !onStool ? 'bench_sit' : atCounter ? (lg === 'eat' ? 'counter_eat' : 'counter_sit') : lg, onBench ? 'back_right' : dir, a.animT);
      const behind = a.hold && a.dir.startsWith('back');          // walking away: the tray is in front of the body, hidden behind it
      if (behind) this.drawHold(a, q);
      const footY = q.y + (working ? (lg === 'prepare' ? -30 : -24) : onStool ? -1 : seated ? 3 : 2);
      this.blitAnimated(fr, q.x, footY, CHAR_SCALE * (CHAR_MUL[a.char] || 1), a, lg, dir);
      if (a.hold && !behind) this.drawHold(a, q);
      this.drawAgentOverlay(a, q, seated);
      if (a.isPlayer && lg === 'sleep') this.bubbleIcon(q.x + 22, q.y - 80, 'c_fx_zzz', 0.8);
      if (a.asleep) { const bob = Math.sin(this.t * 3) * 3; this.bubbleIcon(q.x + 20, q.y - 82 + bob, 'c_fx_zzz', 0.95, false, null, null); this.tag(q.x, q.y + 18, 'Walk by to wake!'); }
    }
    blitAnimated(fr, x, y, scale, agent, logical, direction) {
      const ctx = this.ctx, phase = (agent.animT || this.t) * 8;
      const walk = ['walk', 'carry', 'carry_dirty'].includes(logical);
      const procedural = walk && (CST.MANIFEST.chars[agent.char].proceduralWalkDirections || []).includes(direction);
      const work = ['prepare', 'wash', 'wipe', 'serve', 'place'].includes(logical);
      const bob = procedural ? Math.abs(Math.sin(phase)) * 1.5 : work ? Math.sin(phase) * .65 : 0;
      const tilt = procedural ? Math.sin(phase) * .025 : work ? Math.sin(phase) * .018 : logical === 'cheer' ? Math.sin(phase) * .06 : 0;
      ctx.save(); ctx.translate(x, y - bob); ctx.rotate(tilt);
      this.blit(fr, 0, 0, scale); ctx.restore();
      if (logical === 'wipe') {
        // A separate mop makes the cleaning action legible without replacing
        // the approved character drawing with an unrelated pose.
        const handX = x + (direction.includes('left') ? -13 : 13), sweep = Math.sin(phase) * 8;
        ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#89552e';
        ctx.beginPath(); ctx.moveTo(handX, y - 24); ctx.lineTo(handX + sweep, y + 4); ctx.stroke();
        ctx.strokeStyle = '#d8e9e0'; ctx.lineWidth = 7; ctx.beginPath();
        ctx.moveTo(handX + sweep - 7, y + 4); ctx.lineTo(handX + sweep + 7, y + 4); ctx.stroke(); ctx.restore();
      }
    }
    ring(q) { const c = this.ctx; c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(q.x, q.y + 2, 18, 8, 0, 0, Math.PI * 2); c.stroke(); }
    drawHold(a, q) {
      const h = a.hold, n = h.items.length, ctx = this.ctx;
      // stack rests on the tray/hands at chest height (not on the head), nudged toward the facing side
      const chef = a.char === 'chef', HC = { chef: [14, 15], waiter: [12, 13], server: [12, 14], cleaner: [12, 14], cashier: [12, 14], manager: [12, 16] }[a.char] || [10, 16];   // [side offset, chest height] per character
      const side = a.dir.includes('right') ? HC[0] : a.dir.includes('left') ? -HC[0] : 0;
      const bx = q.x + side, by = q.y - HC[1], step = h.kind === 'dirty' ? 3 : (HC[1] < 25 ? 4.5 : 7);
      for (let i = 0; i < n; i++) {
        const it = h.items[i], y = by - i * step;
        if (h.kind === 'ing') A().prop(ctx, this.g.C.INGREDIENTS[it].icon, bx, y + 8, 22);
        else if (h.kind === 'dirty') A().prop(ctx, 'c_plate_pink', bx, y + 6, 22, 0.9);
        else if (!this.g.C.RECIPES[it].plate) A().prop(ctx, this.g.C.RECIPES[it].icon, bx, y + 8, 13);   // drinks / desserts: hand-sized, not plate-sized
        else this.plateAt(it, bx, y, 22);
      }
      if (a.isPlayer && n >= this.g.capOf(a, h.kind)) this.tag(bx, by - n * step - 14, 'MAX');
    }
    drawAgentOverlay(a, q, seated) {
      const C = this.g.C, CS = CST.CUST_STATE, ctx = this.ctx;
      const top = q.y - (a.char === 'chef' ? 82 : seated ? 54 : 62);
      if (a.kind) {
        if ([CS.WAIT_FOR_SUSHI, CS.WAIT_ORDER, CS.QUEUE].includes(a.state)) {
          const max = a.kind === 'reg' ? (a.state === CS.QUEUE ? C.CUSTOMER.patienceQueue : C.CUSTOMER.patienceSeat) : C.VIP[a.kind].patience;
          const f = Math.max(0, Math.min(1, a.patience / max));
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; this.roundRect(q.x - 16, top - 4, 32, 6, 3); ctx.fill();
          ctx.fillStyle = f > 0.5 ? '#5fd06a' : f > 0.25 ? '#ffc23d' : '#f04f4f'; this.roundRect(q.x - 16, top - 4, 32 * f, 6, 3); ctx.fill();
        }
        if (a.state === CS.WAIT_FOR_SUSHI && a.want) this.bubbleIcon(q.x, top - 22, C.RECIPES[a.want].icon, 1.15);   // what this customer is waiting for
        if (a.state === CS.WAIT_ORDER && a.order && a.order.length) { this.bubbleIcon(q.x, top - 22, C.RECIPES[a.order[0]].icon, 1.1, a.kind !== 'reg'); if (a.order.length > 1) this.tag(q.x + 16, top - 30, 'x' + a.order.length); }
        if (a.state === CS.EXTRA_WAIT && a.extra) this.bubbleIcon(q.x, top - 22, C.RECIPES[a.extra].icon, 1);
        if (a.state === CS.PAY) this.bubbleIcon(q.x, top - 18, null, 0.9, false, '$');
        if (a.kind !== 'reg' && a.state !== CS.LEAVE) { ctx.font = `800 10px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#4a1630'; ctx.strokeText('VIP', q.x, top + 14); ctx.fillStyle = '#ffd34d'; ctx.fillText('VIP', q.x, top + 14); }
      }
      if (a.emote === 'heart') this.bubbleIcon(q.x + 14, top - 10, 'c_fx_heart', 0.8);
      if (a.emote === 'angry' || a.emote === 'angry_hint') this.bubbleIcon(q.x + 14, top - 10, null, 0.8, false, '!', '#f04f4f');
      if (a.emote === 'hands_full') this.bubbleIcon(q.x, top - 14, null, 0.9, false, 'Full!', '#e0464f');
      if (a.emote === 'hands_dirty') this.bubbleIcon(q.x, top - 14, 'c_stack_pink', 0.9);
      if (a.emote === 'nocoin') this.bubbleIcon(q.x, top - 14, null, 0.9, false, '0¢', '#e0464f');
      if (a.emote === 'max') this.bubbleIcon(q.x, top - 14, null, 0.9, false, 'MAX', '#e0464f');
      if (a.emote === 'boost') this.bubbleIcon(q.x, top - 14, null, 1, true, 'x1.5', '#ff8a00');
      if (a.role === 'cashier' && this.g.payQueue.length && !a.moving) this.bubbleIcon(q.x + 16, top + 4, null, 0.7, false, '$', '#3aa856');
    }
    bubbleIcon(x, y, icon, s = 1, gold, text, col) {
      const ctx = this.ctx; const r = 13 * s;
      ctx.fillStyle = gold ? '#fff2c2' : '#ffffff'; ctx.strokeStyle = gold ? '#e6a91c' : 'rgba(90,50,30,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.moveTo(x - 4 * s, y + r - 2); ctx.lineTo(x, y + r + 6 * s); ctx.lineTo(x + 4 * s, y + r - 2); ctx.fill(); ctx.stroke();
      if (icon) this.iconFit(icon, x, y, r * (ICON_FIT[icon] || 1.5));   // fit inside the bubble whatever the aspect (tall drinks no longer overflow)
      if (text) { ctx.fillStyle = col || '#3aa856'; ctx.font = `800 ${Math.round(12 * s)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(text, x, y + 4 * s); }
    }
    // pulsing green circle on the floor where the current task wants the chef to stand (drawn under everything)
    drawTargetRing() {
      const g = this.g, tg = g.taskTarget(); if (!tg) return;
      const tk = g.task(); if (tk && tk.type === 'unlock') { const pad = g.unlockDef(tk.id2); if (pad && g.padVisible(pad)) return; }   // build pads already have their own dashed spot
      const ctx = this.ctx, here = Math.hypot(g.player.x - tg.x, g.player.y - tg.y) < 40;
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 4), r = 24 + pulse * 3;
      this.isoT();
      ctx.beginPath(); ctx.arc(tg.x, tg.y, r, 0, Math.PI * 2);
      ctx.fillStyle = here ? 'rgba(120,230,110,0.45)' : 'rgba(120,230,110,0.25)'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(tg.x, tg.y, r + 3, 0, Math.PI * 2); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(46,122,60,0.9)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(tg.x, tg.y, r * 0.45 * (0.6 + 0.4 * pulse), 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
    }
    drawOverlays() {
      const g = this.g, ctx = this.ctx;
      for (const k in g.C.LAYOUT.zones) {
        const z = g.C.LAYOUT.zones[k]; if (g.has(z.unlock)) continue;
        const q = this.P(z.x + z.w / 2, z.y + z.h / 2); this.tag(q.x, q.y, z.label + ' (locked)');
      }
      const tg = g.taskTarget();
      if (tg) {
        const q = this.P(tg.x, tg.y), bob = Math.abs(Math.sin(this.t * 4)) * 10;
        const tk = g.task(), pad = tk && tk.type === 'unlock' ? g.unlockDef(tk.id2) : null;
        const vipT = g.customers.some(c => c.seat && c.seat.vip && Math.hypot(c.x - tg.x, c.y - tg.y) < 30);   // a VIP's order bubble sits there: lift the arrow above it
        const top = pad && pad._cardTop !== undefined && g.padVisible(pad) ? pad._cardTop - 6 : q.y - (vipT ? 132 : 84);
        if (Math.hypot(g.player.x - tg.x, g.player.y - tg.y) > 40) this.bigArrow(q.x, top - bob * 0.7, 0.68);   // hide once the chef is standing on it
        const ctx2 = this.ctx;
        // small green pointer on the ground next to the chef, aimed at the target
        const pp = this.P(g.player.x, g.player.y), dx = q.x - pp.x, dy = (q.y - pp.y) * 2, d = Math.hypot(dx, dy);
        if (d > 70) {
          const ang = Math.atan2(dy, dx), rx = pp.x + Math.cos(ang) * 30, ry = pp.y + Math.sin(ang) * 15;   // small pointer hugging the chef's feet
          ctx2.save(); ctx2.translate(rx, ry); ctx2.scale(1, 0.55); ctx2.rotate(ang);
          ctx2.beginPath(); ctx2.moveTo(8, 0); ctx2.lineTo(-5, -6.5); ctx2.lineTo(-5, 6.5); ctx2.closePath();
          ctx2.lineJoin = 'round'; ctx2.lineWidth = 3.5; ctx2.strokeStyle = '#2e7a3c'; ctx2.stroke(); ctx2.fillStyle = '#6fdc6a'; ctx2.fill(); ctx2.restore();
        }
        this.targetOnScreen = this.onScreen(tg.x, tg.y); this.lastTarget = tg;
      } else this.lastTarget = null;
    }
    onScreen(x, y) { const p = this.w2s(x, y); return p.x > 0 && p.y > 0 && p.x < this.cv.width && p.y < this.cv.height; }
    drawFx() {
      const ctx = this.ctx;
      for (const f of this.g.fx) {
        const q = this.P(f.x, f.y), rise = (1.1 - f.life) * 40;
        ctx.globalAlpha = Math.min(1, f.life * 2); ctx.font = `900 20px ${FONT}`; ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(70,30,10,0.9)'; ctx.strokeText(f.t, q.x, q.y - 60 - rise); ctx.fillStyle = f.col || '#fff'; ctx.fillText(f.t, q.x, q.y - 60 - rise);
      }
      ctx.globalAlpha = 1;
    }
  }
  CST.Renderer = Renderer; CST.PROP_W = PW;
})(typeof window !== 'undefined' ? window : globalThis);

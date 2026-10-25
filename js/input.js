/* Floating virtual joystick (touch / mouse) + keyboard (WASD / arrows). */
(function (root) {
  const CST = root.CST = root.CST || {};
  CST.Input = class {
    constructor(surface, joyEl) {
      this.v = { x: 0, y: 0 }; this.keys = {}; this.el = joyEl; this.knob = joyEl.querySelector('.knob'); this.id = null; this.R = 50;
      const app = surface.parentElement;
      surface.addEventListener('pointerdown', e => this.down(e, app));
      window.addEventListener('pointermove', e => this.move(e, app));
      window.addEventListener('pointerup', e => this.up(e)); window.addEventListener('pointercancel', e => this.up(e));
      window.addEventListener('keydown', e => { this.keys[e.key.toLowerCase()] = true; });
      window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
      window.addEventListener('blur', () => { this.keys = {}; this.up({ pointerId: this.id }); });
    }
    rel(e, app) { const r = app.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    down(e, app) {
      if (this.id !== null) return; this.id = e.pointerId; CST.Audio.unlock();
      const p = this.rel(e, app); this.ox = p.x; this.oy = p.y;
      this.el.style.left = p.x + 'px'; this.el.style.top = p.y + 'px'; this.el.classList.remove('hidden');
      this.knob.style.transform = ''; e.preventDefault();
    }
    move(e, app) {
      if (e.pointerId !== this.id) return;
      const p = this.rel(e, app); let dx = p.x - this.ox, dy = p.y - this.oy; const d = Math.hypot(dx, dy);
      if (d > this.R) { // drag the base along so direction changes stay responsive
        const k = (d - this.R) / d; this.ox += dx * k; this.oy += dy * k; dx = p.x - this.ox; dy = p.y - this.oy;
        this.el.style.left = this.ox + 'px'; this.el.style.top = this.oy + 'px';
      }
      this.knob.style.transform = `translate(${dx}px,${dy}px)`;
      const m = Math.hypot(dx, dy) / this.R; this.v = m < 0.15 ? { x: 0, y: 0 } : { x: dx / this.R, y: dy / this.R };
    }
    up(e) { if (e.pointerId !== this.id) return; this.id = null; this.v = { x: 0, y: 0 }; this.el.classList.add('hidden'); }
    vector() {
      const k = this.keys; let x = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0), y = (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0);
      if (x || y) { const m = Math.hypot(x, y); return { x: x / m, y: y / m }; }
      return this.v;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

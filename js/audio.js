/* Tiny WebAudio synth for UI/game feedback (no audio files needed). */
(function (root) {
  const CST = root.CST = root.CST || {};
  const SFX = {
    coin: [[880, 0.05, 'square', 0.05], [1320, 0.08, 'square', 0.04]], pick: [[520, 0.05, 'triangle', 0.08]], drop: [[380, 0.06, 'triangle', 0.08]],
    pop: [[660, 0.05, 'sine', 0.1], [990, 0.05, 'sine', 0.06]], ding: [[1200, 0.12, 'sine', 0.05]], clink: [[1500, 0.04, 'triangle', 0.05]],
    splash: [[300, 0.08, 'sawtooth', 0.03]], cash: [[700, 0.05, 'square', 0.05], [1050, 0.05, 'square', 0.05], [1400, 0.1, 'square', 0.04]],
    unlock: [[523, 0.08, 'triangle', 0.12], [659, 0.08, 'triangle', 0.12], [784, 0.16, 'triangle', 0.12]],
    task: [[784, 0.08, 'sine', 0.12], [988, 0.08, 'sine', 0.12], [1319, 0.2, 'sine', 0.1]], star: [[1046, 0.1, 'sine', 0.1], [1568, 0.18, 'sine', 0.08]],
    angry: [[220, 0.12, 'sawtooth', 0.05], [180, 0.15, 'sawtooth', 0.05]], boost: [[440, 0.08, 'square', 0.05], [880, 0.15, 'square', 0.05]]
  };
  // set an AudioParam (or a plain-number property on runtimes that use numbers)
  const setP = (p, v, t, owner, key) => { if (p && typeof p === 'object') { if ('value' in p) p.value = v; else if (typeof p.setValueAtTime === 'function') p.setValueAtTime(v, t); } else if (owner && key) owner[key] = v; };
  CST.Audio = {
    fails: 0,
    ctx: null, on: true, last: {},
    unlock() { try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) { } },
    play(name) { if (this.muted) return;
      if (!this.on || !this.ctx || !SFX[name]) return;
      const now = this.ctx.currentTime; if (this.last[name] && now - this.last[name] < 0.06) return; this.last[name] = now;
      let t = now;
      try {
        for (const [f, d, type, v] of SFX[name]) {
          const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type;
          setP(o.frequency, f, t);
          const gp = g.gain;   // some mini-game runtimes (TikTok) expose AudioParams without the automation methods
          if (gp && typeof gp.setValueAtTime === 'function') { gp.setValueAtTime(v, t); if (typeof gp.exponentialRampToValueAtTime === 'function') gp.exponentialRampToValueAtTime(0.0001, t + d); }
          else setP(gp, v, t, g, 'gain');
          o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + d + 0.02); t += d * 0.8;
        }
        this.fails = 0;
      } catch (e) { if (++this.fails >= 3) this.on = false; console.warn('[audio] sfx failed', name, e && e.message); }   // sound must never break the game loop
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

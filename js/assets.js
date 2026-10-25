/* Asset loader + atlas frame drawing + character animation controller. */
(function (root) {
  const CST = root.CST = root.CST || {};
  const M = () => CST.MANIFEST;

  const Assets = CST.Assets = {
    img: {}, ready: false,
    load(onProgress) {
      const atl = M().atlases, keys = Object.keys(atl); let done = 0;
      return Promise.all(keys.map(k => new Promise((res) => {
        const im = new Image(); im.decoding = 'async';
        im.onload = () => { this.img[k] = im; done++; onProgress && onProgress(done / keys.length); res(); };
        im.onerror = () => { console.warn('asset failed', k); done++; onProgress && onProgress(done / keys.length); res(); };
        im.src = atl[k].file;
      }))).then(() => { this.ready = true; });
    },
    frame(atlas, key) { const a = M().atlases[atlas]; return a && a.frames[key]; },
    // draw prop by key at bottom-centre (x,y) with given width in world units
    prop(ctx, key, x, y, w, alpha) {
      const f = this.frame('props', key); const im = this.img.props; if (!f || !im) return 0;
      const h = w * f[3] / f[2];
      if (alpha !== undefined) ctx.globalAlpha = alpha;
      ctx.drawImage(im, f[0], f[1], f[2], f[3], x - w / 2, y - h, w, h);
      if (alpha !== undefined) ctx.globalAlpha = 1;
      return h;
    },
    propCentered(ctx, key, x, y, w) {
      const f = this.frame('props', key); const im = this.img.props; if (!f || !im) return;
      const h = w * f[3] / f[2]; ctx.drawImage(im, f[0], f[1], f[2], f[3], x - w / 2, y - h / 2, w, h);
    },
    propAspect(key) { const f = this.frame('props', key); return f ? f[3] / f[2] : 1; },
    // icon as data URL for DOM UI
    iconURL(key, size = 64) {
      this._icons = this._icons || {};
      if (this._icons[key]) return this._icons[key];
      if (CST.UP_ICONS && CST.UP_ICONS[key]) return (this._icons[key] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(CST.UP_ICONS[key]));   // vector upgrade icons
      let atlas = 'props', fk = key;
      if (key.startsWith('staff_')) {
        const roles = { staff_chef: 'waiter', staff_cashier: 'cashier', staff_cleaner: 'cleaner', staff_waiter: 'server', staff_server: 'server', staff_manager: 'manager', staff_hero: 'chef' };
        const frame = CST.Anim.frame(roles[key] || 'chef', 'idle', 'front', 0);
        atlas = frame.atlas; fk = frame.key;
      }
      const f = this.frame(atlas, fk), im = this.img[atlas]; if (!f || !im) return '';
      size = Math.round(size * 2);   // DOM icons are shown at CSS size on 2-3x screens: rasterise at 2x so they stay crisp
      const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
      const s = Math.min(size / f[2], size / f[3]); const w = f[2] * s, h = f[3] * s;
      x.drawImage(im, f[0], f[1], f[2], f[3], (size - w) / 2, (size - h) / 2, w, h);
      return (this._icons[key] = c.toDataURL());
    }
  };

  // ---------------- animation controller ----------------
  // logical anim name -> per-character atlas anim, fps
  // carrying uses the empty-handed walk: the actual carried plates are drawn in front of the body by the renderer
  const MAP = {
    chef:       { idle: ['idle', 0], walk: ['walk', 8], carry: ['carry', 8], carry_idle: ['carry', 0], place: ['carry', 0], prepare: ['idle', 0], wash: ['idle', 0], sleep: ['idle', 0], cheer: ['idle', 0] },
    waiter:     { idle: ['idle', 0], walk: ['walk', 8], carry: ['carry', 8], carry_idle: ['carry', 0], carry_dirty: ['carry', 8], place: ['carry', 0], sleep: ['idle', 0] },
    server:     { idle: ['idle', 0], walk: ['walk', 8], carry: ['walk', 8], carry_idle: ['idle', 0], serve: ['idle', 0] },   // one steady face while standing; the serve sheet has its own table baked in
    cleaner:    { idle: ['walk', 0], walk: ['walk', 8], carry: ['walk', 8], wipe: ['mop', 6] },
    cashier:    { idle: ['walk', 0], walk: ['walk', 8], carry: ['walk', 8] },
    manager:    { idle: ['idle', 0], walk: ['walk', 8], carry: ['carry', 8], inspect: ['inspect', 4] },
    cust_orange:{ bench_sit: ['bench_sit', 0], counter_sit: ['counter_sit', 0], counter_eat: ['counter_eat', 4], idle: ['idle', 4], walk: ['walk', 8], sit: ['sit', 3], eat: ['eat', 6], happy: ['happy', 7] },
    cust_gray:  { bench_sit: ['bench_sit', 0], counter_sit: ['counter_sit', 0], counter_eat: ['counter_eat', 4], idle: ['walk', 0], walk: ['walk', 8], sit: ['eat', 0], eat: ['eat', 6], drink: ['drink', 6] },
    vip1:       { idle: ['idle', 0], walk: ['walk', 7], sit: ['sit_cat', 0], eat: ['drink_cat', 5] },   // seated frames with the baked couch removed; the sofa + table are drawn as props
    vip2:       { idle: ['idle', 0], walk: ['walk', 7], sit: ['sit_cat', 0], eat: ['drink_cat', 5] }
  };
  // single-frame picks from the chef's emotion sheet (front-facing)
  const PICK = {};
  const FALLBACK = {
    front_right: ['front_right', 'right', 'front'], front_left: ['front_left', 'left', 'front'],
    back_right: ['back_right', 'right', 'back'], back_left: ['back_left', 'left', 'back'],
    right: ['right', 'front_right', 'front'], left: ['left', 'front_left', 'front'], front: ['front'], back: ['back', 'front']
  };
  CST.Anim = {
    MAP,
    // returns {atlas, key, ax, ay} for an agent at time t
    frame(char, logical, dir, t) {
      const ch = M().chars[char]; if (!ch) return null;
      const pk = PICK[char + '.' + logical + '.' + dir] || PICK[char + '.' + logical];
      if (pk && ch.anims[pk[0]] && ch.anims[pk[0]].all) { const fr = ch.anims[pk[0]].all[pk[1]]; return { atlas: ch.atlas, key: fr[0], ax: fr[1], ay: fr[2] }; }
      const mp = (MAP[char] || {})[logical] || (MAP[char] || {}).idle || ['idle', 0];
      let an = ch.anims[mp[0]] || ch.anims.walk || ch.anims[Object.keys(ch.anims)[0]];
      let frames = null;
      if (an.all) frames = an.all;
      else for (const d of (FALLBACK[dir] || [dir])) if (an[d] && an[d].length) { frames = an[d]; break; }
      if (!frames) frames = an.front || an[Object.keys(an)[0]];
      const fps = mp[1];
      const i = fps ? Math.floor(t * fps) % frames.length : 0;
      const fr = frames[i];
      return { atlas: ch.atlas, key: fr[0], ax: fr[1], ay: fr[2] };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
(function () {
  // ---- vector upgrade icons (crisp at any size); same outline style as the nav buttons
  const O = 'stroke="#4a2614" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"';
  const tile = (c1, c2) => `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect x="3" y="3" width="58" height="58" rx="16" fill="url(#g)" ${O}/>`;
  const plate = (x, y, c) => `<ellipse cx="${x}" cy="${y}" rx="8" ry="3.6" fill="#fff" ${O.replace('2.6', '2')}/><ellipse cx="${x}" cy="${y - 2}" rx="4.6" ry="2.2" fill="${c}"/>`;
  CST.UP_ICONS = {
    up_beltSpeed: tile('#ffb15a', '#f08a2c') + `<rect x="10" y="30" width="40" height="15" rx="7.5" fill="#3a3d4a" ${O}/><path d="M16 37.5h28" stroke="#6b7080" stroke-width="2" stroke-dasharray="3 4"/>` + plate(22, 32, '#ff7a45') + plate(38, 32, '#e8463e') + `<path d="M12 20h14M18 14h16M10 26h8" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M44 12l9 8-9 8z" fill="#fff" ${O}/>`,
    up_beltCap: tile('#7cc4ff', '#3d8fe0') + `<rect x="9" y="38" width="46" height="14" rx="7" fill="#3a3d4a" ${O}/>` + plate(22, 39, '#ff7a45') + plate(22, 33, '#ffd23f') + plate(22, 27, '#5cc36a') + plate(40, 39, '#e8463e') + plate(40, 33, '#ff7a45') + `<circle cx="47" cy="17" r="9" fill="#3fbf5e" ${O}/><path d="M47 12.5v9M42.5 17h9" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>`,
    up_carry: tile('#b5e07a', '#6fbf4a') + `<path d="M9 40h46l-5 9H14z" fill="#c98a4a" ${O}/>` + plate(22, 37, '#ff7a45') + plate(22, 31, '#e8463e') + plate(22, 25, '#ffd23f') + plate(40, 37, '#5cc36a') + plate(40, 31, '#ff7a45') + `<path d="M49 22V10M44 15l5-5 5 5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    up_move: tile('#ffe27a', '#f5b631') + `<path d="M22 21c3-3 9-3 12 1l4 6 9 3c3 1 4 4 3 7l-1 2H17c-3 0-4-3-3-5z" fill="#e8463e" ${O}/><path d="M16 40h35v4H16z" fill="#fff" ${O}/><path d="M28 25l3 4M33 23l3 4" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M6 24h8M4 31h9M7 38h6" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>`,
    up_prod: tile('#ffd0e0', '#ff8fb1') + `<circle cx="30" cy="35" r="16" fill="#fff" ${O}/><path d="M30 25v10l7 5" fill="none" stroke="#4a2614" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M46 8l-7 12h6l-4 11 10-14h-6l4-9z" fill="#ffd23f" ${O.replace('2.6', '2.2')}/>`,
    up_clean: tile('#9ee8f0', '#3fbcd0') + `<ellipse cx="29" cy="40" rx="18" ry="8" fill="#fff" ${O}/><ellipse cx="29" cy="38" rx="10" ry="4" fill="#e7f6ff"/><circle cx="18" cy="20" r="6" fill="#fff" fill-opacity=".9" ${O.replace('2.6', '2')}/><circle cx="30" cy="14" r="4" fill="#fff" fill-opacity=".9" ${O.replace('2.6', '2')}/><circle cx="27" cy="25" r="3" fill="#fff" fill-opacity=".9" ${O.replace('2.6', '2')}/><path d="M47 14l2.2 5.8 5.8 2.2-5.8 2.2-2.2 5.8-2.2-5.8-5.8-2.2 5.8-2.2z" fill="#fff" ${O.replace('2.6', '1.8')}/>`,
    up_staff: tile('#d9b8ff', '#9a6be0') + `<path d="M18 32a8 8 0 0 1 2-14 9 9 0 0 1 16-4 8 8 0 0 1 10 9 7 7 0 0 1-2 9z" fill="#fff" ${O}/><path d="M20 32h24v10H20z" fill="#fff" ${O}/><path d="M24 36h16" stroke="#e8463e" stroke-width="2.6"/><path d="M45 35l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.3 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="#ffd23f" ${O.replace('2.6', '2')}/>`
  };
  for (const k in CST.UP_ICONS) CST.UP_ICONS[k] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${CST.UP_ICONS[k]}</svg>`;
})();

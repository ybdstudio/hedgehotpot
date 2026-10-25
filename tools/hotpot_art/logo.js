const { chromium } = require('playwright'); const fs = require('fs');
const src = 'data:image/webp;base64,' + fs.readFileSync('loading.webp').toString('base64');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.setContent('<canvas id=c width=720 height=1087></canvas>');
  const out = await p.evaluate(async (src) => {
    const c = document.getElementById('c').getContext('2d'); const im = new Image(); im.src = src; await im.decode(); c.drawImage(im, 0, 0);
    const OUT = '#4a2614';
    const rr = (x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
    // leaves behind the sign
    const leaf = (x, y, r, a) => { c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.ellipse(0, 0, r, r * 0.45, 0, 0, 7); c.fillStyle = '#4caf50'; c.fill(); c.lineWidth = 5; c.strokeStyle = '#2e6b2f'; c.stroke(); c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.lineWidth = 3; c.stroke(); c.restore(); };
    [[150, 170, 46, -0.6], [140, 250, 44, 0.4], [575, 175, 46, 0.6], [585, 255, 44, -0.4], [175, 135, 36, -1.1], [548, 135, 36, 1.1]].forEach(l => leaf(...l));
    // wooden sign
    rr(148, 128, 424, 300, 46); c.fillStyle = '#6b3a1e'; c.fill(); c.lineWidth = 10; c.strokeStyle = OUT; c.stroke();
    rr(166, 144, 388, 268, 36); const g = c.createLinearGradient(0, 144, 0, 412); g.addColorStop(0, '#b97a43'); g.addColorStop(1, '#8a5229'); c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(74,38,20,.35)'; c.lineWidth = 3; for (let y = 190; y < 400; y += 46) { c.beginPath(); c.moveTo(176, y); c.lineTo(544, y); c.stroke(); }
    // chili + steam accents
    const chili = (x, y, a) => { c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.moveTo(0, -26); c.quadraticCurveTo(16, 0, 2, 30); c.quadraticCurveTo(-12, 0, 0, -26); c.fillStyle = '#e53935'; c.fill(); c.lineWidth = 4; c.strokeStyle = OUT; c.stroke(); c.fillStyle = '#43a047'; c.fillRect(-5, -34, 10, 10); c.restore(); };
    chili(520, 160, 0.5); chili(200, 395, -0.4);
    const word = (txt, x, y, size, top, bot) => {
      c.font = `900 ${size}px "Inter Display", Inter, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      c.lineWidth = size * 0.26; c.strokeStyle = OUT; c.strokeText(txt, x, y + size * 0.06);
      c.lineWidth = size * 0.12; c.strokeStyle = '#fff6e0'; c.strokeText(txt, x, y);
      const gg = c.createLinearGradient(0, y - size / 2, 0, y + size / 2); gg.addColorStop(0, top); gg.addColorStop(1, bot); c.fillStyle = gg; c.fillText(txt, x, y);
    };
    word('Meow', 360, 205, 92, '#ffd54a', '#ff8f1f');
    word('Hotpot', 360, 300, 104, '#ff7a45', '#d7261e');
    // Conveyor plank
    rr(232, 352, 256, 64, 22); c.fillStyle = '#2e7d32'; c.fill(); c.lineWidth = 7; c.strokeStyle = OUT; c.stroke();
    c.font = '900 44px "Inter Display", Inter, sans-serif'; c.lineWidth = 9; c.strokeStyle = OUT; c.strokeText('Conveyor', 360, 386); c.fillStyle = '#e9ffd8'; c.fillText('Conveyor', 360, 384);
    return document.getElementById('c').toDataURL('image/png');
  }, src);
  fs.writeFileSync('loading_hotpot.png', Buffer.from(out.split(',')[1], 'base64')); await b.close(); })();

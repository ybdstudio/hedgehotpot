#!/usr/bin/env node
/* Turns tests/out/results.json into docs/browser_test_report.md */
const fs = require('fs'), path = require('path');
const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', 'results.json'), 'utf8'));
const sim = fs.existsSync(path.join(__dirname, '..', 'docs', 'sim_results.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'sim_results.json'), 'utf8')) : null;
let md = `# Browser Test Report\n\n* Executed: ${R.when}\n* Browser: Chromium (Playwright), device emulation **${R.device}**, 390×844 CSS px @3x, touch enabled\n* Method: the real game ran in the page. Long stretches were fast-forwarded *inside the page* by stepping the same \`game.update()\` the render loop uses, driven by the autoplay bot through the joystick API. Screenshots were taken from the live canvas.\n* Result: **${R.results.filter(r => r.pass).length}/${R.results.length} checks passed**, page errors: ${R.errors.length}\n\n| # | Check | Result | Evidence |\n|---|---|---|---|\n`;
for (const r of R.results) md += `| ${r.id} | ${r.name} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.detail.replace(/\|/g, '/')} |\n`;
md += `\nScreenshots: \`tests/out/*.png\` (start, each phase, the Grand Opening, every UI panel, and the sprite sheet check).\n`;
if (sim) {
  const done = sim.filter(r => r.done);
  md += `\n## Headless pacing simulation (Node, same game code)\n\n${sim.length} seeds; ${done.length} reached the Grand Opening; completion ${done.map(r => Math.round(r.time / 60) + 'm').join(', ')}. Duplicate-plate or over-capacity violations: ${sim.reduce((a, r) => a + r.dupErr, 0)}.\n`;
}
md += `\n## Not covered by automation\n\n* Real iPhone Safari / iPhone Chrome and Android Chrome hardware were **not** tested. Only Chromium mobile emulation was used. Things to check on real devices: safe-area insets, audio unlock after the first tap, and frame rate on older phones.\n* The playtime estimate comes from a bot that plays reasonably well. A first-time human player may be slower early on, while learning the loop, and faster later, by multitasking better.\n`;
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'browser_test_report.md'), md);
console.log(md);

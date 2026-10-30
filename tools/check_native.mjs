#!/usr/bin/env node
/* Run the supplied checker unchanged; save an auditable local review report. */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(process.argv[2] || join(root, 'dist/tiktok-native/hedgehotpot'));
const kit = join(root,'vendor/hs-sdk-1.1.3');
const result = spawnSync(process.execPath,[join(kit,'hs-check.mjs'),dir,'--json'],{encoding:'utf8',timeout:45000});
if (result.error) throw result.error;
let report;
try { report=JSON.parse(result.stdout); } catch { throw new Error(result.stderr || result.stdout || 'No checker output'); }
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
report.sdkFiles = {};
for (const name of ['hs-game.js','hs-sdk.min.js']) {
  const original=sha(join(kit,name)), source=sha(join(root,'native/hs-sdk',name)), packaged=sha(join(dir,name));
  report.sdkFiles[name]={original,source,packaged,unchanged:original===source && source===packaged};
}
const project=JSON.parse(readFileSync(join(dir,'project.config.json'),'utf8'));
const dashboard=JSON.parse(readFileSync(dir+'.hs-dashboard.json','utf8'));
const code=readFileSync(join(dir,'game.js'),'utf8');
const config=JSON.parse(code.match(/window\.CST\.HS_CONFIG = (\{[^\n]+\});/)[1]);
const missing=[];
if (!/^\d+$/.test(project.appid || '')) missing.push('TikTok App ID');
if (!/^\d+$/.test(config.gameId || '')) missing.push('HS Game ID');
if (!config.sdkKey) missing.push('HS SDK key');
if (dashboard.iaa_config.placements.some(p=>p.ads.some(a=>!/^ad[a-zA-Z0-9]+$/.test(a.id)))) missing.push('7 ad unit IDs');
report.releaseGate={ready:report.ok && !missing.length,missing,uploaded:false};
report.scope='Offline HS checker and browser fixtures only; not a TikTok approval or live-device acceptance test.';
const out=join(root,'docs/qa');mkdirSync(out,{recursive:true});
writeFileSync(join(out,'hs-sdk-1.1.3.json'),JSON.stringify(report,null,2)+'\n');
console.log(`${report.fails} FAIL, ${report.warns} WARN; release gate: ${report.releaseGate.ready?'ready':'waiting for '+missing.join(', ')}`);
if (!Object.values(report.sdkFiles).every(f=>f.unchanged)) throw new Error('The SDK files do not match the original kit');
if (result.status || !report.ok) process.exit(1);

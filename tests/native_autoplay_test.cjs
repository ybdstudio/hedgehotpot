const {chromium}=require(process.env.PW || 'playwright');
const assert=require('node:assert/strict');const fs=require('fs');
(async()=>{const browser=await chromium.launch({headless:true, executablePath:process.env.CHROMIUM});const page=await browser.newPage({viewport:{width:900,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://127.0.0.1:8097/');await page.waitForSelector('iframe');const frame=page.frames().find(f=>/__hs_frame/.test(f.url()));await frame.waitForFunction(()=>window.APP&&APP.game&&CST.HS.result);
 assert(await frame.evaluate(()=>APP.autoplay&&APP.bot.g===APP.game));
 assert(await frame.evaluate(()=>CST.CONFIG.SAVE_KEY.endsWith('_native_autoplay_test')));
 const rates=[];
 for(const speed of [1,1.5,2,4]){
  const before=await frame.evaluate(s=>{APP.setSpeed(s);return {t:APP.game.S.time,wall:Date.now()};},speed);
  await page.waitForTimeout(800);
  const after=await frame.evaluate(()=>({t:APP.game.S.time,wall:Date.now()}));const measured=(after.t-before.t)/((after.wall-before.wall)/1000);rates.push({speed,measured});assert(Math.abs(measured-speed)<speed*.3,JSON.stringify(rates));
 }
 await frame.evaluate(()=>{APP.setSpeed(3);});assert.equal(await frame.evaluate(()=>APP.speed),4);
 const frozen=await frame.evaluate(()=>{CST.HS.pause('qa',true);return APP.game.S.time;});await page.waitForTimeout(250);assert.equal(await frame.evaluate(()=>APP.game.S.time),frozen);
 await frame.evaluate(()=>CST.HS.pause('qa',false));await page.waitForTimeout(250);assert(await frame.evaluate(t=>APP.game.S.time>t,frozen));
 assert(await frame.evaluate(()=>{APP.resetGame();return APP.bot.g===APP.game&&APP.autoplay;}));
 await frame.evaluate(()=>{APP.ui.panel='settings';APP.ui.scroll=0;});await page.waitForTimeout(100);
 const rows=await frame.evaluate(()=>APP.ui.rows().map(r=>r.title).filter(Boolean));for(const s of [1,1.5,2,4])assert(rows.includes(`Simulation speed ${s}x`));
 assert(await frame.evaluate(()=>{APP.ui.rows().find(r=>r.title==='Autoplay').btn[2]();return !APP.autoplay;}));
 await frame.evaluate(()=>APP.ui.rows().find(r=>r.title==='Simulation speed 1.5x').btn[2]());assert.equal(await frame.evaluate(()=>APP.speed),1.5);
 fs.mkdirSync('tests/out_autoplay',{recursive:true});await page.screenshot({path:'tests/out_autoplay/settings.png'});
 await page.getByRole('button',{name:'Android app',exact:true}).click();const android=await (await page.locator('iframe').elementHandle()).contentFrame();await android.waitForFunction(()=>window.APP&&APP.game&&CST.HS.result);assert(await android.evaluate(()=>APP.autoplay&&APP.bot.g===APP.game));
 assert.deepEqual(errors,[]);const report={pass:true,rates,checks:['autoplay on boot','separate device save','all speed rates','invalid speed rejected','pause freezes','resume continues','reset retargets bot','settings toggle and speed selection','Android boot'],errors};fs.writeFileSync('tests/out_autoplay/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

const fs=require('fs'),path=require('path'),vm=require('vm');
const ctx={console,Math,Date,JSON};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['config.js','nav.js','conveyor.js','game.js','bot.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',f),'utf8'),ctx,{filename:f});
const g=new ctx.CST.Game({seed:+(process.env.SEED||1),headless:true,load:false});const bot=new ctx.CST.Bot(g);
const T=+(process.argv[2]||60), every=+(process.argv[3]||2);let next=0;
while(g.S.time<T){const v=bot.update(0.05);g.movePlayer(v.x,v.y,0.05);g.update(0.05);
 if(g.S.time>=next){next+=every;const P=g.player;console.log(g.S.time.toFixed(1),'task',g.S.taskIndex,'coins',g.S.coins,'P',P.x.toFixed(0),P.y.toFixed(0),'hold',JSON.stringify(P.hold),'goal',bot.goal&&bot.goal.why,bot.goal&&[bot.goal.x,bot.goal.y],'path',bot.path&&bot.path.length,'st',JSON.stringify(Object.values(g.stations).map(s=>[s.key,s.input,s.output.length])),'beltA',g.conv.belts.A.plates.length,'cust',g.customers.map(c=>c.state).join(','),'pq',g.payQueue.length, 'piles',g.piles.map(p=>p.amount).join(','));}}

const fs=require('fs'),path=require('path'),vm=require('vm');
const ctx={console,Math,Date,JSON};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['config.js','nav.js','conveyor.js','game.js','bot.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',f),'utf8'),ctx,{filename:f});
const g=new ctx.CST.Game({seed:+(process.argv[3]||1000),headless:true,load:false});const bot=new ctx.CST.Bot(g);
const T=+(process.argv[2]||2400);let acc={},n=0,goals={};
let next=60;
while(g.S.time<T){const DT=+(process.env.DT||0.05);const v=bot.update(DT);g.movePlayer(v.x,v.y,DT);g.update(DT);
 const seats=Object.values(g.seats).filter(s=>!s.vip);n++;
 const add=(k,v)=>acc[k]=(acc[k]||0)+v;
 add('seats',seats.length);add('occ',seats.filter(s=>s.occupant).length);add('dirtyFree',seats.filter(s=>!s.occupant&&s.dirty).length);add('free',seats.filter(s=>!s.occupant&&!s.dirty).length);
 add('waitSushi',g.customers.filter(c=>c.state==='WAIT_FOR_SUSHI').length);add('queue',g.entryQueue.length);add('payq',g.payQueue.length);
 add('beltA',g.conv.belts.A.plates.length);add('staging',g.staging.length);add('stOut',Object.values(g.stations).reduce((a,s)=>a+s.output.length,0));
 if(bot.goal)goals[bot.goal.why.split(' ')[0]]=(goals[bot.goal.why.split(' ')[0]]||0)+1;
 if(g.S.time>=next){next+=300;const o={};for(const k in acc)o[k]=(acc[k]/n).toFixed(1);console.log(Math.round(g.S.time/60)+'m task',g.S.taskIndex,JSON.stringify(o),'angry',g.stat('angry'),'goals',JSON.stringify(goals));acc={};n=0;goals={};}
}

#!/usr/bin/env node
/** Focused public phone screenshots and Final visual regression. Uses an archived original-source fixture, never the ready lobby. Air only. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { finalLayout } from './cox-final-layout.mjs';
const moduleName=process.env.COX_PLAYWRIGHT_MODULE??process.env.PLAYWRIGHT_MODULE??'playwright-core';
const {chromium,devices}=await import(moduleName.startsWith('/')?pathToFileURL(moduleName).href:moduleName);
const BASE=(process.env.COX_BASE_URL??'https://jeopardy.192-241-145-6.sslip.io').replace(/\/$/,'');
const OUT=resolve(process.env.COX_EVIDENCE_DIR??'../evidence-public-verified');
const prior=JSON.parse(await readFile(resolve(OUT,'report.json'),'utf8'));
if(prior.failure||prior.checks.some(c=>!c.ok))throw new Error('Complete passing public rehearsal is required.');
const fixture=prior.rooms.find(r=>r.kind==='separate-dd-final-rehearsal').boardId;
const report={checks:[],screenshots:[],errors:[]};
const browser=await chromium.launch({headless:true,executablePath:process.env.COX_CHROMIUM_EXECUTABLE,args:['--mute-audio']});
const check=(ok,label,data)=>{report.checks.push({ok:!!ok,label,...(data?{layout:data}:{})});console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)throw new Error(label);};
async function api(ctx,method,path,data){const r=await ctx.request.fetch(BASE+path,{method,data});if(!r.ok())throw new Error(`API ${method} ${path}:${r.status()}`);return r.json();}
async function shot(page,name,delay=250){await page.waitForTimeout(delay);await page.screenshot({path:resolve(OUT,name+'.png'),fullPage:false});report.screenshots.push(name+'.png');}
let host,display,phone;
try{
 const hostContext=await browser.newContext({viewport:{width:1180,height:900}});
 await api(hostContext,'POST','/api/auth/login',{email:process.env.COX_HOST_EMAIL??'andrew@cox-classroom.invalid',password:process.env.COX_ANDREW_PASSWORD});
 const board=await api(hostContext,'GET','/api/boards/'+fixture);
 const clues=board.content.rounds[0].categories.flatMap(c=>c.clues);
 const game=await api(hostContext,'POST','/api/games',{boardId:fixture,settings:{classroomTeams:true,teamCount:6,mode:'team',dailyDoublePlacement:'author',startCountdownSec:0,answerTimerSec:0,allPlayTimerSec:90,finalTimerSec:90,lobbyGame:false,autoUnlock:false,fairBuzz:false}});
 report.room={id:game.id,code:game.code,fixtureBoardId:fixture};
 host=await hostContext.newPage();await host.goto(`${BASE}/host/${game.code}`);await host.addScriptTag({url:BASE+'/socket.io/socket.io.js'});
 await host.evaluate(code=>{window.cx={};window.cx.s=window.io({transports:['websocket'],auth:{role:'host',code}});window.cx.s.on('state',v=>window.cx.v=v);},game.code);
 await host.waitForFunction(()=>window.cx?.v?.phase==='lobby');
 const act=async action=>{const a=await host.evaluate(action=>new Promise(resolve=>window.cx.s.timeout(10000).emit('host:action',{action},(e,a)=>resolve(e?{ok:false,error:'timeout'}:a))),action);if(!a.ok)throw new Error(action.type+':'+a.error);};
 for(const [i,name]of['Moss','Maple','Clover','Fern','Willow','Cedar'].entries())await act({type:'team/rename',teamId:`classroom_${i+1}`,name});
 const displayContext=await browser.newContext({viewport:{width:1280,height:720}});display=await displayContext.newPage();await display.goto(`${BASE}/display/${game.code}`);
 const{defaultBrowserType:_type,...mobile}=devices['iPhone 13'];const phoneContext=await browser.newContext(mobile);phone=await phoneContext.newPage();await phone.goto(`${BASE}/join?code=${game.code}`);
 await phone.getByRole('button',{name:/Cedar.*Available/i}).click();await phone.getByRole('textbox',{name:/^Team name/}).fill('Cedar');await phone.getByRole('button',{name:'Join as this team',exact:true}).click();
 await host.waitForFunction(()=>window.cx.v.players.length===1);
 for(const [name,page]of[['host',host],['display',display],['phone',phone]])page.on('pageerror',e=>report.errors.push({page:name,url:page.url(),message:e.message}));
 await act({type:'game/start'});await host.waitForFunction(()=>window.cx.v.phase==='board');await shot(display,'final-board-1280x720',3200);await display.setViewportSize({width:1920,height:1080});await shot(display,'final-board-1920x1080',3200);
 await act({type:'clue/open',clueId:clues[1].id});await act({type:'buzzers/unlock'});await phone.getByRole('button',{name:'BUZZ!',exact:true}).waitFor();await shot(phone,'phone-buzz-ready');
 await phone.getByRole('button',{name:'BUZZ!',exact:true}).dispatchEvent('pointerdown',{pointerType:'touch',button:0,isPrimary:true});await host.waitForFunction(()=>!!window.cx.v.clue?.answering);await shot(phone,'phone-buzz-winner');
 await host.getByRole('button',{name:'✓ Correct',exact:true}).waitFor();
 await host.getByRole('button',{name:/Sound muted/}).click();await host.waitForFunction(()=>window.cx.v.settings.sound.muted===false);await host.getByRole('button',{name:/Mute sound/}).click();await host.waitForFunction(()=>window.cx.v.settings.sound.muted===true);await host.getByRole('button',{name:/Sound muted/}).waitFor();check(true,'always-visible host quick mute toggles on and back to muted');
 for(const size of[{width:1280,height:720},{width:1920,height:1080}]){await host.setViewportSize(size);await host.waitForTimeout(150);const controls=await host.getByRole('button').evaluateAll(buttons=>buttons.filter(b=>/Sound muted|Save score backup|✓ Correct|Reveal answer/.test(b.textContent)).map(b=>{const r=b.getBoundingClientRect();return{label:b.textContent.trim(),top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,visible:r.width>0&&r.height>0&&r.top>=0&&r.left>=0&&r.bottom<=innerHeight&&r.right<=innerWidth};}));check(controls.length===4&&controls.every(b=>b.visible),`host mute backup judging and reveal controls visible ${size.width}x${size.height}`,{controls});await shot(host,`host-controls-verified-${size.width}x${size.height}`);}

 await act({type:'clue/judge',correct:true});await act({type:'clue/close'});
 await act({type:'clue/open',clueId:clues[20].id,allPlay:true});await phone.getByPlaceholder('Or type it (optional)',{exact:true}).fill(clues[20].answer);await shot(phone,'phone-typed-all-play');await phone.getByRole('button',{name:/Lock in answer|Answer saved/}).click();await host.waitForFunction(()=>window.cx.v.clue?.allPlay?.hasAnswer?.classroom_6);await act({type:'allPlay/close'});await act({type:'clue/reveal'});await act({type:'clue/close'});
 for(let i=1;i<=6;i++)await act({type:'score/set',contestantId:`classroom_${i}`,score:500});
 await act({type:'final/start'});await phone.getByPlaceholder('0',{exact:true}).fill('100');await shot(phone,'phone-final-wager');await phone.getByRole('button',{name:'Lock in wager',exact:true}).click();
 await act({type:'final/showClue'});await act({type:'final/startTimer'});await phone.getByPlaceholder('Or type it (optional)',{exact:true}).fill(board.content.final.answer);await shot(phone,'phone-typed-final');await phone.getByRole('button',{name:/Lock in answer|Answer saved/}).click();await host.waitForFunction(()=>window.cx.v.final?.hasAnswer?.classroom_6);
 await act({type:'final/close'});await act({type:'final/reveal',contestantId:'classroom_6'});await act({type:'final/judge',contestantId:'classroom_6',correct:true});await act({type:'final/showWager',contestantId:'classroom_6'});
 for(const size of[{width:1280,height:720},{width:1920,height:1080}]){await display.setViewportSize(size);const measured=await finalLayout(display);check(measured.ok,`Final Cedar reveal and prompt fit above six-team score strip ${size.width}x${size.height}`,measured);await shot(display,`final-layout-verified-${size.width}x${size.height}`,1200);}
 await act({type:'game/end'});await host.waitForFunction(()=>window.cx.v.phase==='finished');for(const size of[{width:1280,height:720},{width:1920,height:1080}]){await display.setViewportSize(size);await shot(display,`final-awards-verified-${size.width}x${size.height}`,5000);}
 check(report.errors.length===0,'focused host/display/phone have no browser errors');check(report.screenshots.length===13,'thirteen public phone, host, board, Final and settled awards screenshots captured');
}catch(error){report.failure=error.message;console.error(error.message);process.exitCode=1;for(const[name,page]of[['host',host],['display',display],['phone',phone]])if(page)await page.screenshot({path:resolve(OUT,'focused-failure-'+name+'.png')}).catch(()=>{});
}finally{await writeFile(resolve(OUT,'final-layout-report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}

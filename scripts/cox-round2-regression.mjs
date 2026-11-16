#!/usr/bin/env node
/** Air-only public projector regression. Creates a separate canonical-board rehearsal. */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {displayLayout,beginScoreTrace,finishScoreTrace} from './cox-display-regression.mjs';
const moduleName=process.env.COX_PLAYWRIGHT_MODULE??process.env.PLAYWRIGHT_MODULE??'playwright-core';
const {chromium}=await import(moduleName.startsWith('/')?pathToFileURL(moduleName).href:moduleName);
const BASE=(process.env.COX_BASE_URL??'https://jeopardy.192-241-145-6.sslip.io').replace(/\/$/,'');
const OUT=resolve(process.env.COX_EVIDENCE_DIR??'../evidence-public-verified/round2');
if(!process.env.COX_ANDREW_PASSWORD)throw new Error('Established scoped password injection required');
await mkdir(OUT,{recursive:true});
const report={startedAt:new Date().toISOString(),checks:[],screenshots:[],errors:[]};
const browser=await chromium.launch({headless:true,executablePath:process.env.COX_CHROMIUM_EXECUTABLE,args:['--mute-audio']});
const check=(ok,label,data)=>{report.checks.push({ok:!!ok,label,...(data?{measurement:data}:{})});console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)throw new Error(label);};
async function api(ctx,method,path,data){const r=await ctx.request.fetch(BASE+path,{method,data});if(!r.ok())throw new Error(`API ${method} ${path}:${r.status()}`);return r.json();}
async function shot(page,name,delay=0){if(delay)await page.waitForTimeout(delay);await page.screenshot({path:resolve(OUT,name+'.png'),fullPage:false});report.screenshots.push(name+'.png');}
let host,display;
try{
 const hc=await browser.newContext({viewport:{width:1180,height:900}});
 await api(hc,'POST','/api/auth/login',{email:process.env.COX_HOST_EMAIL??'andrew@cox-classroom.invalid',password:process.env.COX_ANDREW_PASSWORD});
 const board=await api(hc,'GET','/api/boards/cox-plant-pathology-2026');
 const game=await api(hc,'POST','/api/games',{boardId:board.id,settings:{classroomTeams:true,teamCount:6,mode:'team',dailyDoublePlacement:'author',startCountdownSec:0,answerTimerSec:0,autoUnlock:false,fairBuzz:false,lobbyGame:false}});
 report.room={id:game.id,code:game.code};
 host=await hc.newPage();await host.goto(`${BASE}/host/${game.code}`);await host.addScriptTag({url:BASE+'/socket.io/socket.io.js'});
 await host.evaluate(code=>{window.cx={};window.cx.s=window.io({transports:['websocket'],auth:{role:'host',code}});window.cx.s.on('state',v=>window.cx.v=v);},game.code);
 await host.waitForFunction(()=>window.cx?.v?.phase==='lobby');
 const act=async action=>{const a=await host.evaluate(action=>new Promise(resolve=>window.cx.s.timeout(10000).emit('host:action',{action},(e,a)=>resolve(e?{ok:false,error:'timeout'}:a))),action);if(!a.ok)throw new Error(action.type+':'+a.error);};
 const dc=await browser.newContext({viewport:{width:1280,height:720},reducedMotion:'no-preference'});display=await dc.newPage();
 for(const [name,page]of [['host',host],['display',display]])page.on('pageerror',e=>report.errors.push({page:name,message:e.message}));
 await display.goto(`${BASE}/display/${game.code}`);await act({type:'game/start'});await display.getByTestId('display-score-strip').waitFor();
 const figure=board.content.rounds.flatMap(r=>r.categories.flatMap(c=>c.clues)).find(c=>c.media);
 for(const size of[{width:1280,height:720},{width:1920,height:1080}]){
   await display.setViewportSize(size);
   for(const phase of['board','clue']){
     if(phase==='clue')await act({type:'clue/open',clueId:figure.id});
     await display.waitForTimeout(3200);
     for(const fullscreen of[false,true]){
       if(fullscreen){await display.getByTestId('display-fullscreen').click();await display.waitForFunction(()=>!!document.fullscreenElement);}
       const m=await displayLayout(display);
       check(m.ok&&m.fullscreen===fullscreen&&m.viewport.right===size.width&&m.viewport.bottom===size.height,`fullscreen control, ${phase} content and six scores remain disjoint ${size.width}x${size.height} ${fullscreen?'fullscreen':'windowed'}`,m);
       await shot(display,`display-${phase}-${size.width}x${size.height}-${fullscreen?'fullscreen':'windowed'}`);
       if(fullscreen){await display.getByTestId('display-fullscreen').click();await display.waitForFunction(()=>!document.fullscreenElement);}
     }
     await act({type:'score/set',contestantId:'classroom_1',score:1250});
     await display.waitForFunction(()=>document.querySelector('[data-contestant-id="classroom_1"] [data-testid="podium-score-value"]')?.textContent==='$1,250');
     await display.waitForTimeout(2100);
     for(const [label,delta,expected]of[['positive',400,1650],['negative',-2000,-350]]){
       await beginScoreTrace(display,'classroom_1');
       await act({type:'score/adjust',contestantId:'classroom_1',delta});
       await shot(display,`score-${label}-${phase}-${size.width}x${size.height}-transition`,150);
       const trace=await finishScoreTrace(display,expected);
       check(trace.ok,`one readable score every animation frame during ${label} change on ${phase} ${size.width}x${size.height}`,trace);
       await shot(display,`score-${label}-${phase}-${size.width}x${size.height}-settled`);
       await display.waitForTimeout(700);
     }
     if(phase==='clue')await act({type:'clue/close'});
   }
 }
 await act({type:'game/end'});await host.waitForFunction(()=>window.cx.v.phase==='finished');
 check(report.errors.length===0,'projector and host have no browser errors');
}catch(error){report.failure=error.message;console.error(error.message);process.exitCode=1;for(const[name,page]of[['host',host],['display',display]])if(page)await page.screenshot({path:resolve(OUT,'round2-failure-'+name+'.png')}).catch(()=>{});
}finally{report.finishedAt=new Date().toISOString();await writeFile(resolve(OUT,'display-regression-report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();console.log(`Evidence: ${OUT}`);}

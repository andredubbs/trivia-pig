/** Geometry and frame sampling against the rendered projector, never a mocked score. */
export async function displayLayout(page) {
  await page.getByTestId('display-score-strip').waitFor();
  return page.evaluate(() => {
    const get = id => document.querySelector(`[data-testid="${id}"]`);
    const box = e => { const r=e.getBoundingClientRect(); return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
    const inside=(a,b)=>a.left>=b.left-2&&a.top>=b.top-2&&a.right<=b.right+2&&a.bottom<=b.bottom+2;
    const overlaps=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1;
    const viewport={left:0,top:0,right:innerWidth,bottom:innerHeight};
    const controls=get('display-controls'),button=get('display-fullscreen'),content=get('display-content'),strip=get('display-score-strip');
    if(!controls||!button||!content||!strip)return {ok:false,problem:'Missing display layout surface'};
    const rects={controls:box(controls),button:box(button),content:box(content),strip:box(strip)};
    const podiums=[...document.querySelectorAll('[data-testid="display-podium"]')].map(box);
    const foreground=[...content.querySelectorAll('.board-cell,.clue-text,img')].map(e=>({rect:box(e),text:e.classList.contains('clue-text')}));
    const ok=Object.values(rects).every(r=>inside(r,viewport))&&inside(rects.button,rects.controls)&&
      rects.controls.bottom<=rects.content.top+1&&podiums.length===6&&podiums.every(r=>!overlaps(r,rects.controls))&&
      foreground.every(e=>inside(e.rect,rects.content)&&e.rect.bottom<=rects.strip.top+2&&!overlaps(e.rect,rects.button));
    return {ok,fullscreen:!!document.fullscreenElement,viewport,rects,podiums,foreground};
  });
}

/** Start before the host's action so every browser animation frame is measured. */
export async function beginScoreTrace(page, contestantId, durationMs=1500) {
  await page.evaluate(({contestantId,durationMs}) => {
    const frames=[];const start=performance.now();
    const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};};
    const inside=(a,b)=>a.left>=b.left-1&&a.top>=b.top-1&&a.right<=b.right+1&&a.bottom<=b.bottom+1;
    const overlap=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left)+0.5&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+0.5;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    // Tailwind may return oklch(), not rgb(). Let the browser resolve any CSS color.
    const luminance=c=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=c;ctx.fillRect(0,0,1,1);const v=[...ctx.getImageData(0,0,1,1).data].slice(0,3).map(x=>{x/=255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4;});return .2126*v[0]+.7152*v[1]+.0722*v[2];};
    window.__coxScoreTrace={done:false,frames};
    function sample(now){
      const card=document.querySelector(`[data-testid="display-podium"][data-contestant-id="${contestantId}"]`);
      const score=card?.querySelector('[data-testid="podium-score"]');
      const values=score?[...score.querySelectorAll('[data-testid="podium-score-value"]')]:[];
      const value=values[0],delta=score?.querySelector('[data-testid="podium-score-delta"]');
      const problems=[];const f={at:Math.round(now-start),target:score?.getAttribute('data-target-score'),value:value?.textContent??null,problems};
      if(values.length!==1||!value||!score)problems.push('Exactly one total score node required');
      else {
        const textNodes=[...value.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
        f.textNodes=textNodes.length;f.rect=box(value);f.delta=delta?box(delta):null;
        const style=getComputedStyle(value);f.fontSize=parseFloat(style.fontSize);
        let bg=score;while(bg&&getComputedStyle(bg).backgroundColor==='rgba(0, 0, 0, 0)')bg=bg.parentElement;
        const a=luminance(style.color),b=luminance(bg?getComputedStyle(bg).backgroundColor:'rgb(0,0,0)');
        f.contrast=a===null||b===null?0:(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
        const range=document.createRange();range.selectNodeContents(value);const lines=[...range.getClientRects()];
        if(textNodes.length!==1||value.children.length||!/^\-?\$[\d,]+$/.test(f.value))problems.push('Total must be one formatted number in one text node');
        if(lines.length!==1||!inside(f.rect,box(score))||!inside(f.rect,box(card)))problems.push('Total score clipped or split across lines');
        if(f.delta&&overlap(f.rect,f.delta))problems.push('Score change overlaps total');
        // Deliberate projector target: >=24px and >=4.5 contrast, beyond large-text AA.
        if(f.fontSize<24||f.contrast<4.5||parseFloat(style.opacity)<1||style.visibility==='hidden')problems.push('Total score misses projector readability target');
        const at=document.elementFromPoint((f.rect.left+f.rect.right)/2,(f.rect.top+f.rect.bottom)/2);
        if(at!==value&&!value.contains(at))problems.push('Total score obscured by another element');
      }
      frames.push(f);
      if(now-start<durationMs)requestAnimationFrame(sample);else window.__coxScoreTrace.done=true;
    }
    requestAnimationFrame(sample);
  },{contestantId,durationMs});
}

export async function finishScoreTrace(page, expected) {
  await page.waitForFunction(()=>window.__coxScoreTrace?.done);
  const frames=await page.evaluate(()=>window.__coxScoreTrace.frames);
  const values=new Set(frames.map(f=>f.value));
  const final=frames.at(-1);
  return {ok:frames.length>=20&&values.size>=5&&frames.every(f=>!f.problems.length)&&final.target===String(expected)&&Number(final.value.replace(/[^\d-]/g,''))===expected,
    sampleCount:frames.length,distinctValues:values.size,frames};
}

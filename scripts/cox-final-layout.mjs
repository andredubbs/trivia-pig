/** Assert Final's actual rendered content fits above the six-team score strip. */
export async function finalLayout(page) {
  await page.getByTestId('final-reveal-screen').waitFor();
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const get = id => document.querySelector(`[data-testid="${id}"]`);
    const box = e => { const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
    const screen=get('final-reveal-screen'), content=get('final-reveal-content'), prompt=get('final-reveal-prompt'), strip=get('final-score-strip');
    if (!screen || !content || !prompt || !strip) return {ok:false,problem:'Missing required Final layout surface'};
    const header=screen.querySelector('header');
    const rects={screen:box(screen),content:box(content),prompt:box(prompt),strip:box(strip),header:box(header)};
    const inside=(a,b)=>a.left>=b.left-2&&a.top>=b.top-2&&a.right<=b.right+2&&a.bottom<=b.bottom+2;
    const viewport={left:0,top:0,right:innerWidth,bottom:innerHeight};
    const text=[...content.querySelectorAll('.clue-text')].map(e=>({rect:box(e),overflow:e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2}));
    const ok=inside(rects.screen,viewport)&&inside(rects.header,viewport)&&inside(rects.prompt,rects.content)&&
      rects.content.bottom<=rects.strip.top+2&&rects.header.top>=-1&&rects.strip.bottom<=innerHeight+2&&
      text.every(t=>inside(t.rect,rects.content)&&!t.overflow)&&prompt.scrollHeight<=prompt.clientHeight+2;
    return {ok,viewport,rects,text};
  });
}

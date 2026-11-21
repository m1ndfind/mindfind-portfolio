const clamp = n => Math.max(0,Math.min(1,n));
function ease(start,end,p) {
  const t=clamp((p-start)/(end-start));
  return t*t*(3-2*t);
}

export function setupStudio() {
  const story=document.querySelector('#mindfind-story');
  const stage=story.querySelector('.studio-stage');
  const art=stage.querySelector('figure');
  const poster=document.querySelector('.brief-poster');
  const brief=poster.closest('.studio-brief');
  const mini=brief.querySelector('.brief-mini');
  let host=art;
  const canvas=art.querySelector('canvas');
  let posterVisible=false,inFinale=false,pending='',inAbout=false;
  const acts=[...stage.querySelectorAll('article')];
  const progressBar=stage.querySelector('.studio-meter i');
  const anchors=acts.map(act=>act.querySelector('.studio-anchor'));
  const starts=[0,.49,.9];
  const nav=document.querySelector('.site-head');
  const trigger=nav.querySelector('.studio-menu');
  const menu=document.querySelector('#studio-menu');
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const words=acts.map(act=>{
    const heading=act.querySelector('h2');
    return heading.textContent.split(' ').map((word,i)=>{
      if (!i) heading.replaceChildren();
      const mask=document.createElement('span');
      mask.className='mask';
      const inner=document.createElement('b');
      inner.textContent=word;
      mask.append(inner);
      heading.append(mask,' ');
      return inner;
    });
  });
  let arrival=1;
  const prose=acts[1].querySelector('.studio-prose');
  const proseWords=prose.textContent.split(' ').map(text=>{
    const word=document.createElement('span');
    word.textContent=text+' ';
    return word;
  });
  prose.replaceChildren(...proseWords);
  const panelState=[];
  const serviceRows=acts[0].querySelectorAll('li');
  let baked=false;
  let cinematic=false,compact=false,visible=false,artVisible=false;
  let frame=0,last=0,p=0,target=0,renderAvatar,loading=false,painted=NaN;
  function configure() {
    const eligible=!reduced.matches && innerWidth>=900 && innerHeight>=690;
    story.classList.toggle('studio-cinema',eligible);
    cinematic=eligible && acts.every(act=>act.offsetHeight < innerHeight-100);
    story.classList.toggle('studio-cinema',cinematic);
    anchors.forEach((anchor,i)=>{
      if (cinematic) {
        story.append(anchor);
        anchor.style.top=starts[i]*(story.offsetHeight-stage.offsetHeight)+'px';
      } else {
        acts[i].prepend(anchor);anchor.style.top='';
      }
    });
    painted=NaN; panelState.length=0; measure();
  }
  function measure() {
    const top=story.getBoundingClientRect().top;
    const briefTop=brief.getBoundingClientRect().top;
    const exit=ease(.02,.85,1-briefTop/innerHeight);
    stage.style.setProperty('--studio-exit',exit);
    const formBounds=brief.querySelector('form').getBoundingClientRect();
    const useMini=innerWidth<=850 && formBounds.top<Math.min(300,innerHeight*.46) && formBounds.bottom>96;
    const dock=useMini || posterVisible && briefTop<innerHeight*(inFinale?.70:.62);
    const nextHost=useMini?mini:dock?poster:art;
    if(nextHost!==host){
      if(dock && !inFinale)react('welcome');
      inFinale=dock;
      host=nextHost;
      mini.classList.toggle('active',useMini);
      if(!baked && renderAvatar)moveCanvas();
    }
    const reveal=ease(.12,.86,1-top/innerHeight);
    if (arrival!==reveal) painted=NaN;
    arrival=reveal;
    const next=top<innerHeight*(compact?.34:.25);
    if (next!==compact) {
      compact=next;
      nav.classList.toggle('compact',compact);
      for (const el of nav.querySelectorAll('nav,.identity,.head-role')) el.inert=compact;
      trigger.inert=!compact;
    }
    target=clamp(-top/Math.max(1,story.offsetHeight-innerHeight));
    if(host===mini && !loading)loadFigure();
    schedule();
  }
  function react(name){
    pending=name;
    schedule();
  }
  function moveCanvas(){
    art.classList.remove('live');
    poster.classList.remove('live');
    art.querySelector('.studio-still').src='assets/studio/'+Math.round(p*30)+'.webp';
    mini.classList.remove('live');
    host.append(canvas);
  }
  brief.addEventListener('focusin',e=>{
    if(e.target.matches('input,textarea'))react(e.target.name==='name'?'listen':'turn');
    if(e.target.id==='copy-brief')react('point');
  });
  brief.querySelector('#copy-brief').addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')react('point');});
  brief.addEventListener('brief-copied',()=>react('approve'));
  const entrance=new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){
      entry.target.classList.add('arrived');
      entrance.unobserve(entry.target);
    }
  });
  entrance.observe(brief);
  entrance.observe(brief.querySelector('form'));
  new IntersectionObserver(([entry])=>{
    posterVisible=entry.isIntersecting;measure();loadFigure();
  }).observe(poster);
  function schedule() {
    if (!frame && !document.hidden) frame=requestAnimationFrame(update);
  }
  function update(time) {
    frame=0;
    const dt=last?Math.min(.06,(time-last)/1000):1/60;
    last=time;
    p+= (target-p)*(1-Math.exp(-12*dt));
    if (Math.abs(target-p)<.0001) p=target;
    if (painted!==p || Number.isNaN(painted)) {
      stage.style.setProperty('--wine',cinematic?ease(.24,.38,p):0);
      stage.style.setProperty('--scarlet',cinematic?ease(.61,.74,p):0);
      const left=ease(.245,.43,p)*(1-ease(.60,.78,p));
      art.style.transform=cinematic?'translate3d('+(104-104*left)+'%,0,0)':'';
      progressBar.style.transform='scaleX('+p+')';
      acts.forEach((act,i)=>{
        const enter=[arrival,ease(.34,.45,p),ease(.70,.81,p)][i];
        const leave=[ease(.23,.31,p),ease(.58,.66,p),0][i];
        // Hold settled panels without rewriting every word on every camera frame.
        const state=cinematic?enter-leave:1;
        if (panelState[i]===state && (i!==0 || p>.33 || p<.2)) return;
        panelState[i]=state;
        const alpha=cinematic?enter*(1-leave):1;
        act.style.opacity=alpha;
        act.style.visibility=alpha===0?'hidden':'visible';
        act.inert=alpha<.5;
        words[i].forEach((word,j)=>{
          const reveal=cinematic?clamp(enter*1.24-j*.055)*(1-leave):1;
          word.style.filter=reveal>0 && reveal<1?'blur('+((1-reveal)*6)+'px)':'';
          word.style.transform='translateY('+((1-reveal)*94)+'%)';
        });
        if (i===1) proseWords.forEach((word,j)=>{
          word.style.opacity=cinematic?.25+.75*clamp(enter*2-j/proseWords.length):1;
        });
        if (!i) serviceRows.forEach((row,j)=>{
          const reveal=cinematic?clamp(arrival*1.45-j*.09)*(1-ease(.20+j*.011,.28+j*.011,p)):1;
          row.style.transform='translateY('+((1-reveal)*-14)+'px)';
          row.style.opacity=reveal;
        });
      });
      painted=p;
    }
    const about=p>.38 && p<.60;
    if(about && !inAbout && !inFinale)react('present');
    inAbout=about;
    const drawing=inFinale ? (posterVisible || host===mini) && !baked : artVisible;
    if(drawing && renderAvatar && !reduced.matches){
      if(pending){renderAvatar.react?.(pending);pending='';}
      renderAvatar(p,dt,p===target,inFinale);
    }
    if (visible && cinematic && p!==target || drawing && renderAvatar && !reduced.matches && (!baked || p!==target)) schedule();
    else last=0;
  }
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;schedule();}).observe(story);
  async function loadFigure() {
    if ((!artVisible && !posterVisible && host!==mini) || loading || reduced.matches) return;
    loading=true;
    try {

      const module=await import('./avatar.js');
      renderAvatar=await module.mountAvatar(art);
      if(inFinale)moveCanvas();
    } catch {

      const module=await import('./avatar-sequence.js');
      baked=true;
      renderAvatar=module.mountSequence(art,schedule);
    }
    schedule();
  }
  new IntersectionObserver(([entry])=>{artVisible=entry.isIntersecting;loadFigure();schedule();}).observe(art);
  canvas.addEventListener('webglcontextlost',()=>{art.classList.remove('live');poster.classList.remove('live');mini.classList.remove('live');});
  canvas.addEventListener('webglcontextrestored',schedule);
  trigger.onclick=()=>{menu.showModal();trigger.setAttribute('aria-expanded','true');};
  menu.querySelector('button').onclick=()=>menu.close();
  menu.addEventListener('close',()=>trigger.setAttribute('aria-expanded','false'));
  menu.querySelector('nav').addEventListener('click',event=>{if(event.target.closest('a')) menu.close();});
  addEventListener('scroll',measure,{passive:true});
  addEventListener('resize',()=>{configure();loadFigure();});
  reduced.addEventListener('change',()=>{art.classList.remove('live');poster.classList.remove('live');mini.classList.remove('live');configure();loadFigure();});
  document.addEventListener('visibilitychange',()=>{last=0;if(!document.hidden) schedule();});
  configure();
  // Browser may resolve the incoming hash before the desktop anchor is moved.
  if (anchors.some(a=>'#'+a.id===location.hash)) document.getElementById(location.hash.slice(1)).scrollIntoView({behavior:'instant'});
}

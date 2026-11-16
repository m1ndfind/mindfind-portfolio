'use strict';
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const scenes = Array.from(document.querySelectorAll('[data-demo3d]'));
  const visibleScenes = new Set();
  const pointer = new WeakMap();
  const anchor = document.querySelector('.hero-character');
  const hero = document.getElementById('studio');
  if (!anchor || !hero) return;
  const companion = document.createElement('div');
  companion.className = 'scroll-companion';
  companion.setAttribute('aria-hidden', 'true');
  const character = document.createElement('img');
  character.src = anchor.currentSrc || anchor.src;
  character.alt = '';
  character.decoding = 'async';
  companion.append(character);
  const marker = document.createElement('div');
  marker.className = 'companion-marker';
  marker.setAttribute('aria-hidden', 'true');
  const trail = document.createElement('div');
  trail.className = 'companion-trail';
  trail.setAttribute('aria-hidden', 'true');
  document.body.append(trail, companion, marker);
  let ready = false, scheduled = false;
  let geometry = null;
  const clamp = (n, a=0, b=1) => Math.min(b, Math.max(a, n));
  const lerp = (a,b,t) => a+(b-a)*t;
  const smooth = t => {t=clamp(t); return t*t*(3-2*t);};
  function measure() {
    const r = anchor.getBoundingClientRect();
    const h = hero.getBoundingClientRect();
    const points = Array.from(document.querySelectorAll('#projects,#process,[data-phase-step],#about,.outro')).map(el=>({top:el.getBoundingClientRect().top+scrollY, phase:el.dataset.phaseStep || (el.id==='process'?'task':el.id) || 'outro'}));
    geometry = {x:r.left,y:r.top+scrollY,width:r.width,height:r.height,heroBottom:h.bottom+scrollY,points};
    schedule();
  }
  function phaseLabel(y) {
    let phase='studio';
    const readingPoint=y+innerHeight*.42;
    geometry.points.forEach(p=>{if(readingPoint>=p.top)phase=p.phase;});
    return ({studio:'Mindfind',projects:'Проекты',task:'Задача',sketch:'Характер',launch:'Запуск',about:'Автор',outro:'На связи'})[phase] || 'Mindfind';
  }
  function update() {
    scheduled=false;
    if (document.hidden || !geometry) return;
    const W=document.documentElement.clientWidth,H=innerHeight,Y=scrollY;
    if (!reduced.matches) {
      visibleScenes.forEach((scene) => {
        const r=scene.getBoundingClientRect();
        const p=clamp((H*.58-(r.top+r.height*.5))/(H*.9),-1,1);
        const i=scenes.indexOf(scene);
        const aim=pointer.get(scene)||{x:0,y:0};
        const object=scene.querySelector('.demo3d-object');
        const mobile=W<=600;
        const rx=p*(mobile?5:10)-aim.y*4;
        const ry=(i-1)*(mobile?5:13)+p*(mobile?8:15)+aim.x*8;
        object.style.setProperty('--rx',rx.toFixed(2)+'deg');
        object.style.setProperty('--ry',ry.toFixed(2)+'deg');
        object.style.setProperty('--rz',((i-1)*.7+p*.7).toFixed(2)+'deg');
        object.style.setProperty('--lift',(-p*(mobile?9:16)).toFixed(2)+'px');
        object.style.setProperty('--depth',(mobile?8:15+10*(1-Math.abs(p))).toFixed(2)+'px');
      });
    }
    if (!ready || reduced.matches) {
      companion.style.opacity='0';marker.style.opacity='0';trail.classList.remove('visible');return;
    }
    const start=Math.max(0,geometry.heroBottom-H*.95);
    const end=Math.max(start+250,geometry.heroBottom-H*.12);
    const t=smooth((Y-start)/(end-start));
    const railW=W<=600?48:W<=850?64:W<=1100?74:W>=1700?140:120;
    const railH=railW*1.5;
    const rightGap=W<=600?1:5;
    const railX=W-railW-rightGap;
    const pageHeight=Math.max(1,document.documentElement.scrollHeight-H);
    const route=Y/pageHeight;
    const railY=H*.55-railH*.5+Math.sin(route*Math.PI*3)*H*.075;
    const x=lerp(geometry.x,railX,t);
    const y=lerp(geometry.y-Y,railY,t);
    const scale=lerp(geometry.width/600,railW/600,t);
    const angle=Math.sin(route*Math.PI*4)*3*t;
    companion.style.transform=`translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${scale.toFixed(5)}) rotate(${angle.toFixed(2)}deg)`;
    companion.style.opacity='1';
    marker.style.width=(railW+4)+'px';
    marker.style.transform=`translate3d(${(railX-2).toFixed(2)}px,${(railY+railH*.94).toFixed(2)}px,0)`;
    marker.style.opacity=String(clamp((t-.82)/.18));
    const label=phaseLabel(Y);if(marker.textContent!==label)marker.textContent=label;
    trail.classList.toggle('visible',t>.85);
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(update);}
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{entry.target.classList.toggle('is-in-view',entry.isIntersecting);if(entry.isIntersecting)visibleScenes.add(entry.target);else visibleScenes.delete(entry.target);});schedule();},{rootMargin:'80px 0px',threshold:0});
    scenes.forEach(s=>observer.observe(s));
  }else scenes.forEach(s=>visibleScenes.add(s));
  scenes.forEach(scene=>{
    scene.addEventListener('pointermove',e=>{if(!finePointer.matches||reduced.matches)return;const r=scene.getBoundingClientRect();pointer.set(scene,{x:clamp((e.clientX-r.left)/r.width*2-1,-1,1),y:clamp((e.clientY-r.top)/r.height*2-1,-1,1)});schedule();},{passive:true});
    scene.addEventListener('pointerleave',()=>{pointer.delete(scene);schedule();},{passive:true});
  });
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',measure,{passive:true});
  window.addEventListener('load',measure,{once:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  reduced.addEventListener('change',()=>{
    if(reduced.matches)document.documentElement.classList.remove('has-scroll-companion');
    else if(ready)document.documentElement.classList.add('has-scroll-companion');
    measure();
  });
  async function revealCompanion(){
    try{await character.decode();}catch{}
    if(!character.naturalWidth)return;
    ready=true;measure();update();
    if(!reduced.matches)document.documentElement.classList.add('has-scroll-companion');
  }
  if(character.complete&&character.naturalWidth)revealCompanion();
  else character.addEventListener('load',revealCompanion,{once:true});
  measure();
  if(document.fonts)document.fonts.ready.then(measure);
})();

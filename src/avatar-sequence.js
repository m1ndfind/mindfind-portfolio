// Reuse decoded WebP frames as image layers. Compositing their opacity avoids
// copying the entire transparent stage into a new 2D bitmap on each scroll tick.
export function mountSequence(art,wake) {
  const layer=document.createElement('div');
  layer.className='studio-sequence';
  layer.setAttribute('aria-hidden','true');
  art.querySelector('canvas').replaceWith(layer);
  const cache=new Map();
  let first=null,second=null;

  function request(index) {
    if(cache.has(index)) return;
    const image=new Image();
    cache.set(index,image);
    image.src='assets/studio/'+index+'.webp';
    image.decode().then(wake,()=>{});
  }

  return (progress,dt,settled)=>{
    const position=settled?Math.round(progress*30):Math.round(progress*300)/10;
    const lo=Math.floor(position),hi=Math.ceil(position);
    for(const key of cache.keys()) if(Math.abs(key-position)>3) cache.delete(key);
    for(const key of [lo,hi,lo-1,hi+1]) if(key>=0 && key<=30) request(key);
    const a=cache.get(lo),b=cache.get(hi);
    if(!a?.complete || !a.naturalWidth || !b?.complete || !b.naturalWidth) return;
    if(first!==a || second!==b) {
      layer.replaceChildren(...(a===b?[a]:[a,b]));
      first=a;second=b;
    }
    a.style.opacity='1';
    if(a!==b)b.style.opacity=String(position-lo);
    art.classList.add('live','baked');
  };
}

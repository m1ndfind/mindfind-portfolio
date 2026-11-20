// Baked from the same studio camera. Decode only adjacent local WebP frames.
export function mountSequence(art, wake) {
  const canvas=document.createElement('canvas');
  canvas.setAttribute('aria-hidden','true');
  art.querySelector('canvas').replaceWith(canvas);
  const context=canvas.getContext('2d');
  canvas.width=710;
  canvas.height=780;
  canvas.style.objectFit='contain';
  const cache=new Map();
  let painted=-1;
  function request(index) {
    if (cache.has(index)) return;
    const image=new Image();
    image.src='assets/studio/'+index+'.webp';
    cache.set(index,image);
    image.decode().then(wake,()=>{});
  }
  return progress=>{
    const position=Math.round(progress*300)/10;
    const lo=Math.floor(position), hi=Math.ceil(position);
    for (const key of cache.keys()) if (Math.abs(key-position)>3) cache.delete(key);
    for (const key of [lo,hi,lo-1,hi+1]) if (key>=0 && key<=30) request(key);
    if (painted===position && art.classList.contains('live')) return;
    const a=cache.get(lo),b=cache.get(hi);
    if (!a?.complete || !a.naturalWidth || !b?.complete || !b.naturalWidth) return;
    context.clearRect(0,0,710,780);
    const mix=position-lo;
    context.globalAlpha=1-mix;
    context.drawImage(a,0,0);
    if (mix) {
      context.globalCompositeOperation='lighter';
      context.globalAlpha=mix;
      context.drawImage(b,0,0);
      context.globalCompositeOperation='source-over';
    }
    context.globalAlpha=1;
    painted=position;
    art.classList.add('live','baked');
  };
}

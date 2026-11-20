// Accessible reveal choreography, deliberately larger and slower than the
// original tiny 12px/520ms motion. Each element reveals only once.
export function setupChoreography() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const running = new Set();
  const elements = document.querySelectorAll('.section-title,.about-photo,.lab-notes li,.service,.showcase-head p');
  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      reveal.unobserve(entry.target);
      if (reduced.matches) continue;
      const element = entry.target;
      const stagger = element.matches('.service') ?
        [...element.parentElement.children].indexOf(element) * 95 :
        element.matches('.lab-notes li') ? [...element.parentElement.children].indexOf(element) * 95 : 0;
      const animation = element.animate([
        {opacity:.08, transform:'translate3d(0,48px,0)'},
        {opacity:1, transform:'translate3d(0,0,0)'}
      ], {duration:960, delay:Math.min(stagger,350), easing:'cubic-bezier(.19,1,.22,1)', fill:'backwards'});
      running.add(animation);
      animation.finished.then(() => running.delete(animation), () => running.delete(animation));
    }
  }, {threshold:.08, rootMargin:'0px 0px -9% 0px'});
  elements.forEach(element => reveal.observe(element));

  // Creator-reference idea: scroll-driven prose, split into words rather
  // than hundreds of individually animated characters (cheaper to paint).
  const paragraph = document.querySelector('.about-reveal');
  let words = [];
  if (paragraph) {
    const chunks = paragraph.textContent.match(/\S+\s*/g) || [];
    paragraph.replaceChildren(...chunks.map(chunk => {
      const span = document.createElement('span');
      span.className = 'revealed-word';
      span.textContent = chunk;
      return span;
    }));
    words = [...paragraph.children];
  }
  let request = 0;
  function paint() {
    request = 0;
    if (reduced.matches || !paragraph) return;
    const rect = paragraph.getBoundingClientRect();
    if (rect.top > innerHeight * 1.15 || rect.bottom < -100) return;
    const progress = Math.max(0, Math.min(1, (innerHeight * .84 - rect.top) / (innerHeight * .56 + rect.height)));
    words.forEach((word, index) => {
      const local = Math.max(0, Math.min(1, (progress - index / words.length * .83) * 6));
      word.style.setProperty('--word-alpha', (.28 + .72 * local).toFixed(3));
    });
  }
  function schedule() {if (!request && !document.hidden) request = requestAnimationFrame(paint);}
  addEventListener('scroll', schedule, {passive:true});
  addEventListener('resize', schedule);
  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      for (const animation of running) animation.cancel();
      running.clear();
      for (const word of words) word.style.removeProperty('--word-alpha');
    }
    schedule();
  });
  schedule();

  const progress = document.querySelector('.reading-progress');
  progress.hidden = !CSS.supports('animation-timeline:scroll()');
}

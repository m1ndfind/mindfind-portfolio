// Accessible reveal choreography, deliberately larger and slower than the
// original tiny 12px/520ms motion. Each element reveals only once.
export function setupChoreography() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const running = new Set();
  const elements = document.querySelectorAll('.section-title');
  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      reveal.unobserve(entry.target);
      if (reduced.matches) continue;
      const element = entry.target;
      const animation = element.animate([
        {opacity:.08, transform:'translate3d(0,48px,0)'},
        {opacity:1, transform:'translate3d(0,0,0)'}
      ], {duration:960, easing:'cubic-bezier(.19,1,.22,1)', fill:'backwards'});
      running.add(animation);
      animation.finished.then(() => running.delete(animation), () => running.delete(animation));
    }
  }, {threshold:.08, rootMargin:'0px 0px -9% 0px'});
  elements.forEach(element => reveal.observe(element));

  reduced.addEventListener('change', () => {
    if (reduced.matches) for (const animation of running) animation.cancel();
  });


  const progress = document.querySelector('.reading-progress');
  progress.hidden = !CSS.supports('animation-timeline:scroll()');
}

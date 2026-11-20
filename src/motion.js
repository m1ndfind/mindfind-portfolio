export function setupMotion() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  for (const button of document.querySelectorAll('[data-magnetic]')) {
    const clear = () => {
      button.style.removeProperty('--mx');
      button.style.removeProperty('--my');
    };
    button.addEventListener('pointermove', (event) => {
      if (!pointer.matches || reduced.matches) return;
      const rect = button.getBoundingClientRect();
      const offsetX = parseFloat(button.style.getPropertyValue('--mx')) || 0;
      const offsetY = parseFloat(button.style.getPropertyValue('--my')) || 0;
      button.style.setProperty('--mx', ((event.clientX - rect.left + offsetX) / rect.width - .5) * 9 + 'px');
      button.style.setProperty('--my', ((event.clientY - rect.top + offsetY) / rect.height - .5) * 7 + 'px');
    });
    button.addEventListener('pointerleave', clear);
    reduced.addEventListener('change', clear);
    pointer.addEventListener('change', clear);
  }

  const measures = new Map();
  let frame = 0;
  function update() {
    frame = 0;
    if (reduced.matches) return;
    for (const [element, apply] of measures) {
      const rect = element.getBoundingClientRect();
      const progress = Math.max(-1, Math.min(1, (innerHeight / 2 - rect.top - rect.height / 2) / (innerHeight / 2)));
      apply(progress);
    }
  }
  function schedule() {
    if (!frame && !reduced.matches && measures.size) frame = requestAnimationFrame(update);
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  reduced.addEventListener('change', schedule);

  const scenes = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const stage = entry.target;
      scenes.unobserve(stage);
      import('./scenes.js').then(({ mountScene }) => {
        const updateScroll = mountScene(stage, reduced, pointer);
        const intro = stage.closest('.intro');
        if (intro) {
          intro.addEventListener('studio-travel', event => updateScroll(event.detail));
          updateScroll(Number(intro.querySelector('.hero').style.getPropertyValue('--fly')));
          return;
        }
        const track = stage.closest('.scene-track') || stage;
        const active = new IntersectionObserver(([visibility]) => {
          if (visibility.isIntersecting) measures.set(track, updateScroll);
          else measures.delete(track);
          schedule();
        });
        active.observe(track);
      }).catch((error) => console.warn('Static sculpture preview is available.', error.message));
    }
  });
  document.querySelectorAll('[data-scene]').forEach((stage) => scenes.observe(stage));
}

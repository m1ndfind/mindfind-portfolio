// Lightweight, compositor-only scroll choreography.
// The old project iframe-resizing, per-scroll video seeking and snapshot morph
// were removed: these caused dropped frames and distracted from the actual work.
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const smooth = t => t * t * (3 - 2 * t);

export function setupWorkScroll() {
  const section = document.querySelector('#work');
  section.classList.add('motion-ready');
  const boundary = document.querySelector('.work-boundary');
  const marquee = [...section.querySelectorAll('.marquee-row')];
  const cards = [...section.querySelectorAll('.project')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 1050px), (max-height: 819px)');
  let viewable = false;
  let ticking = 0;
  let previous = 0;
  let easedScroll;

  const revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('case-revealed');
      revealObserver.unobserve(entry.target);
    }
  }, {rootMargin: '0px 0px -8% 0px', threshold: .08});
  cards.forEach(card => revealObserver.observe(card));

  const resetTilts = () => {
    for (const gallery of section.querySelectorAll('.case-gallery')) {
      gallery.style.removeProperty('--tilt-x');
      gallery.style.removeProperty('--tilt-y');
    }
  };
  reduced.addEventListener('change', resetTilts);
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)');
  for (const gallery of section.querySelectorAll('.case-gallery')) {
    gallery.addEventListener('pointermove', event => {
      if (reduced.matches || !finePointer.matches) return;
      const rect = gallery.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / Math.max(1, rect.width));
      const y = clamp((event.clientY - rect.top) / Math.max(1, rect.height));
      gallery.style.setProperty('--tilt-x', ((.5-y)*3.5).toFixed(2) + 'deg');
      gallery.style.setProperty('--tilt-y', ((x-.5)*4.2).toFixed(2) + 'deg');
    }, {passive:true});
    gallery.addEventListener('pointerleave', () => {
      gallery.style.removeProperty('--tilt-x');
      gallery.style.removeProperty('--tilt-y');
    });
  }

  function paint(time) {
    ticking = 0;
    if (document.hidden || !viewable) return;
    if (reduced.matches) return;
    const dt = Math.min(64, previous ? Math.max(1, time - previous) : 16.7);
    previous = time;
    const scroll = scrollY;
    if (easedScroll === undefined || Math.abs(scroll - easedScroll) > innerHeight * 1.6 || reduced.matches) easedScroll = scroll;
    // Time-based damping works consistently on 60/120/144 Hz panels.
    easedScroll += (scroll - easedScroll) * (1 - Math.exp(-dt / 115));
    if (Math.abs(scroll - easedScroll) < .12) easedScroll = scroll;

    const seamTop = boundary.getBoundingClientRect().top + scroll - easedScroll;
    const seam = smooth(clamp((innerHeight * .9 - seamTop) / (innerHeight * .65 + boundary.offsetHeight * .25)));
    boundary.style.setProperty('--seam', (100 * (1-seam)).toFixed(3) + '%');

    const marqueeTop = section.querySelector('.project-marquee').getBoundingClientRect().top + scroll;
    const marqueeProgress = clamp((easedScroll - marqueeTop + innerHeight) / (innerHeight * 1.5));
    for (let i = 0; i < marquee.length; i++) {
      const distance = (marqueeProgress - .5) * 340;
      const direction = Number(marquee[i].dataset.direction) || 1;
      marquee[i].style.setProperty('--travel', `${(distance * direction).toFixed(2)}px`);
    }

    // Stack on desktop. Later cards cover earlier cards with a soft reduction
    // of scale and depth, instead of abrupt camera jumps or reflow.
    if (!compact.matches && !reduced.matches) {
      cards.forEach((card, i) => {
        const next = cards[i + 1];
        const frame = card.querySelector('.story-frame');
        if (!next) {
          frame.style.setProperty('--stack-scale', '1');
          frame.style.setProperty('--stack-shade', '0');
          return;
        }
        const pinTop = parseFloat(getComputedStyle(card).top) || 110;
        const nextTop = next.getBoundingClientRect().top + scroll - easedScroll;
        const start = innerHeight * .98;
        const end = pinTop + 30;
        const t = smooth(clamp((start - nextTop) / Math.max(1, start - end)));
        frame.style.setProperty('--stack-scale', (1 - t * .042).toFixed(5));
        frame.style.setProperty('--stack-shade', (t * .16).toFixed(4));
      });
    }
    if (scroll !== easedScroll) requestPaint();
  }

  function requestPaint() {
    if (!ticking && viewable && !document.hidden) ticking = requestAnimationFrame(paint);
  }
  const observer = new IntersectionObserver(([entry]) => {
    viewable = entry.isIntersecting;
    if (!viewable) {easedScroll = undefined; previous = 0;}
    requestPaint();
  }, {rootMargin: '400px 0px 400px 0px'});
  observer.observe(section);
  function fitCards() {
    if (!section.classList.contains('is-stacking')) return;
    const headroom = document.querySelector('.site-head').offsetHeight;
    for (const card of cards) {
      const frame = card.querySelector('.story-frame');
      const padding = parseFloat(getComputedStyle(frame).paddingTop) * 2 + 4;
      const head = card.querySelector('.case-head').offsetHeight;
      const footer = card.querySelector('.case-bottom').offsetHeight;
      const available = innerHeight - headroom - 36 - padding - head - footer;
      card.style.setProperty('--case-gallery-height', Math.max(220, Math.min(580, available)) + 'px');
    }
  }
  const resize = new ResizeObserver(fitCards);
  for (const card of cards) resize.observe(card.querySelector('.case-head'));
  document.fonts.ready.then(fitCards);
  const reset = () => {
    previous = 0;
    easedScroll = undefined;
    section.classList.toggle('is-stacking', !reduced.matches && !compact.matches);
    if (reduced.matches || compact.matches) {
      cards.forEach(card => {
        card.querySelector('.story-frame').style.removeProperty('--stack-scale');
        card.querySelector('.story-frame').style.removeProperty('--stack-shade');
      });
    }
    fitCards();
    requestPaint();
  };
  addEventListener('scroll', requestPaint, {passive: true});
  addEventListener('resize', reset);
  document.addEventListener('visibilitychange', requestPaint);
  reduced.addEventListener('change', reset);
  compact.addEventListener('change', reset);
  reset();
}

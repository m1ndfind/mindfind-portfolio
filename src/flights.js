export function setupFlights() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  for (const track of document.querySelectorAll('[data-flight]')) {
    const stage = track.querySelector('.flight-stage');
    const film = track.querySelector('video');
    const source = track.dataset.film || 'assets/flights/' + track.dataset.flight + '.mp4';
    let nearby = false;
    let requested = false;
    let loaded = false;
    let failed = false;
    let target = 0;
    let request = 0;
    function seek() {
      if (film.seeking || !loaded || reduced.matches || !nearby) return;
      if (Math.abs(film.currentTime - target) > .022) film.currentTime = target;
    }
    function update() {
      request = 0;
      const active = !failed && !reduced.matches && Boolean(film.canPlayType('video/mp4'));
      track.classList.toggle('is-scrubbable', active);
      const distance = Math.max(1, track.offsetHeight - stage.offsetHeight);
      const pin = parseFloat(getComputedStyle(stage).top) || 0;
      const progress = Math.min(1, Math.max(0, (pin - track.getBoundingClientRect().top) / distance));
      const finished = active && progress >= .997;
      track.classList.toggle('is-playing-frame', active && loaded && !finished);
      if (!nearby || !active) return;
      if (!requested) {
        requested = true;
        // Blob URLs allow random access even on static hosts without byte ranges.
        fetch(source).then(response => {
          if (!response.ok) throw Error('Video unavailable');
          return response.blob();
        }).then(blob => {
          film.preload = 'auto';
          film.src = URL.createObjectURL(blob);
        }).catch(() => { failed = true; schedule(); });
      }
      if (loaded) {
        target = progress * Math.max(0, film.duration - .04);
        seek();
      }
    }
    function schedule() {
      if (!request) request = requestAnimationFrame(update);
    }
    film.addEventListener('loadeddata', () => { loaded = true; schedule(); });
    film.addEventListener('seeked', seek);
    film.addEventListener('error', () => { failed = true; schedule(); });
    const observer = new IntersectionObserver(([entry]) => {
      nearby = entry.isIntersecting;
      if (nearby) window.addEventListener('scroll', schedule, { passive:true });
      else window.removeEventListener('scroll', schedule);
      schedule();
    }, { rootMargin:'300px 0px' });
    observer.observe(track);
    new ResizeObserver(schedule).observe(stage);
    window.addEventListener('resize', schedule);
    reduced.addEventListener('change', schedule);
    update();
  }
}

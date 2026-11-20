// The document scrolls normally. Hero, camera and typography share this playhead.
export function setupIntro() {
  const track = document.querySelector('.intro');
  const stage = track.querySelector('.hero');
  const copy = stage.querySelector('.hero-copy');
  const title = copy.querySelector('h1');
  const layout = stage.querySelector('.hero-layout');
  const front = document.createElement('div');
  front.className = 'type-front display';
  front.setAttribute('aria-hidden', 'true');
  front.inert = true;
  for (const line of title.children) front.append(line.cloneNode(true));
  layout.append(front);
  const staticMode = matchMedia('(prefers-reduced-motion: reduce), (max-height:530px)');
  const manifesto = track.querySelector('.manifesto');
  let frame = 0, visible = true, playhead, lastTime = 0;
  function smooth(value) {
    const t = Math.max(0, Math.min(1, value));
    return t*t*(3-2*t);
  }
  function draw(time) {
    frame = 0;
    if (document.hidden || !visible) return;
    const pin = parseFloat(getComputedStyle(stage).top) || 0;
    const run = track.offsetHeight - stage.offsetHeight;
    const target = run > 0 && !staticMode.matches ? smooth((pin-track.getBoundingClientRect().top)/run) : 0;
    const dt = Math.min(64, lastTime ? Math.max(1, time - lastTime) : 16.7);
    lastTime = time;
    if (playhead === undefined || staticMode.matches || Math.abs(target - playhead) > .65) playhead = target;
    playhead += (target - playhead) * (1 - Math.exp(-dt / 140));
    if (Math.abs(target - playhead) < .0003) playhead = target;
    const t = playhead;
    const exit = smooth((t-.065)/.45);
    const enter = smooth((t-.35)/.39);
    stage.style.setProperty('--fly',t);
    stage.style.setProperty('--leave',exit);
    stage.style.setProperty('--arrive',enter);
    copy.inert = exit > .97;
    track.dispatchEvent(new CustomEvent('studio-travel',{detail:t}));
    if (Math.abs(target - playhead) > .0003) schedule();
  }
  function schedule() {
    if (!frame && visible && !document.hidden) frame=requestAnimationFrame(draw);
  }
  function mode() {
    if (staticMode.matches) layout.after(manifesto);
    else layout.append(manifesto);
    track.classList.toggle('cinematic', !staticMode.matches);
    playhead = undefined;
    lastTime = 0;
    schedule();
  }
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if (!visible) {playhead=undefined;lastTime=0;} schedule();},{rootMargin:'120px'}).observe(track);
  const header = document.querySelector('.site-head');
  const resize = new ResizeObserver(() => {
    // Both ink planes use exactly the same line boxes. A diagonal mask lets
    // the near bend of the ribbon cover only the foot of the final line.
    front.style.left = copy.offsetLeft + title.offsetLeft + 'px';
    front.style.top = copy.offsetTop + title.offsetTop + 'px';
    front.style.fontSize = getComputedStyle(title).fontSize;
    front.style.width = title.offsetWidth + 'px';
    document.documentElement.style.setProperty('--headroom', header.offsetHeight + 'px');
    schedule();
  });
  resize.observe(stage);
  resize.observe(title);
  resize.observe(header);
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule);
  document.addEventListener('visibilitychange',schedule);
  staticMode.addEventListener('change',mode);
  mode();
}

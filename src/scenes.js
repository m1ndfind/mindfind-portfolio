import { ribbonMesh, vertexShader, fragmentShader, scenePose } from './chrome.js';

function createRenderer(gl, variant) {
  const attach = (program, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  };
  const program = gl.createProgram();
  attach(program, gl.VERTEX_SHADER, vertexShader);
  attach(program, gl.FRAGMENT_SHADER, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);

  const { vertices, indices } = ribbonMesh(variant);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  for (const [name, size, offset] of [['position', 3, 0], ['normal', 3, 12], ['edge', 1, 24]]) {
    const attribute = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 28, offset);
  }
  const fit = gl.getUniformLocation(program, 'fit');
  const rotation = gl.getUniformLocation(program, 'rotation');
  const phase = gl.getUniformLocation(program, 'phase');
  const placement = gl.getUniformLocation(program, 'placement');
  const dolly = gl.getUniformLocation(program, 'dolly');
  const pose = scenePose[variant];
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);
  return (width, height, x, y, time, travel) => {
    const shorter = Math.min(width, height);
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform2f(fit, pose.scale * shorter / width, pose.scale * shorter / height);
    gl.uniform2f(rotation, pose.x + x, pose.y + y);
    gl.uniform1f(phase, time);
    gl.uniform1f(dolly, travel);
    gl.uniform3f(placement, 0, 0, 1);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

  };
}

export function mountScene(stage, motion, finePointer) {
  const canvas = stage.querySelector('canvas');
  const control = stage.querySelector('.scene-control');
  const range = control?.querySelector('input');
  let gl;
  let draw;
  let visible = false;
  let frame = 0;
  let elapsed = 0;
  let previous = 0;
  let mouseX = 0;
  let mouseY = 0;
  let x = 0;
  let y = 0;
  let angle = 0;
  let scroll = 0;
  let canAnimate = false;
  let slowFrames = 0;
  let onDemand = false;

  function schedule(force = false) {
    if (onDemand && !force) return;
    if (draw && visible && !document.hidden && !frame) frame = requestAnimationFrame(render);
  }

  function updateScroll(progress) {
    const changed = Math.abs(progress - scroll) > .008;
    scroll = progress;
    // Slow devices render on scroll changes rather than freezing the scene.
    schedule(changed);
  }

  function render(time) {
    frame = 0;
    if (!visible || document.hidden || !draw) return;
    // Explicit 30 fps cap: the browser has time for scroll and CSS input.
    // A 15 fps continuous WebGL pass previously starved the compositor.
    const interval = previous ? time - previous : 0;
    if (interval && interval < 29) {schedule(true); return;}
    if (interval > 59 && interval < 250) {slowFrames++;}
    else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames >= 4 && !onDemand) {
      // Keep the last rendered frame on slow GPUs. The lens still travels via
      // compositing; resizing and manual camera controls can request a redraw.
      onDemand = true;
      stage.closest('.hero-layout')?.classList.add('light-lens');
    }
    const area = Math.max(1, canvas.clientWidth * canvas.clientHeight);
    // Preserve edge definition on the displayed canvas. Slow GPUs reduce
    // animation frequency through onDemand, while the image stays sharp.
    const ratio = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(1500000 / area));
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (!width || !height) return;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const dt = previous ? Math.min(time - previous, 50) : 16;
    elapsed += dt;
    previous = time;
    const t = elapsed / 1000;
    const targetX = canAnimate ? mouseY * .23 + scroll * .38 : 0;
    const targetY = angle + (canAnimate ? scroll * (stage.dataset.scene === 'hero' ? 1.15 : 2.6) + mouseX * .28 + Math.sin(t * .55) * .08 : 0);
    const follow = onDemand ? 1 : 1 - Math.exp(-dt / 130);
    x = canAnimate ? x + (targetX - x) * follow : targetX;
    y = canAnimate ? y + (targetY - y) * follow : targetY;
    draw(width, height, x, y, canAnimate ? t * .8 : 0, canAnimate && stage.dataset.scene === 'hero' ? scroll : 0);
    stage.classList.add('scene-ready');
    if (canAnimate) schedule();
  }

  function initialize() {
    if (gl?.isContextLost()) return;
    try {
      gl ??= canvas.getContext('webgl', { alpha: true, antialias: true, failIfMajorPerformanceCaveat: true });
      if (!gl) return;
      draw = createRenderer(gl, stage.dataset.scene);
      if (control) control.hidden = false;
      schedule(true);
    } catch (error) {
      console.warn('WebGL preview uses its static image.', error.message);
    }
  }

  const resize = new ResizeObserver(() => schedule(true));
  resize.observe(canvas);
  function updateMotion() {
    canAnimate = !motion.matches;
    previous = 0;
    schedule(true);
  }
  updateMotion();
  motion.addEventListener('change', updateMotion);
  document.addEventListener('visibilitychange', () => {
    previous = 0;
    schedule();
  });
  const pointerSurface = stage.closest('.hero-layout') || stage;
  pointerSurface.addEventListener('pointermove', (event) => {
    if (!finePointer.matches || motion.matches) return;
    const rect = pointerSurface.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) / rect.width - .5;
    mouseY = (event.clientY - rect.top) / rect.height - .5;
  });
  pointerSurface.addEventListener('pointerleave', () => { mouseX = 0; mouseY = 0; });
  for (const preset of stage.querySelectorAll('[data-angle]')) {
    preset.addEventListener('click', () => {
      range.value = preset.dataset.angle;
      range.dispatchEvent(new Event('input'));
    });
  }
  range?.addEventListener('input', () => {
    angle = Number(range.value) * Math.PI / 180;
    schedule(true);
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    draw = null;
    stage.classList.remove('scene-ready');
    if (control) control.hidden = true;
  });
  canvas.addEventListener('webglcontextrestored', initialize);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    previous = 0;
    if (visible && !gl) initialize();
    schedule();
  });
  observer.observe(stage);
  return updateScroll;
}

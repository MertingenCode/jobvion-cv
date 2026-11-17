// Hallmark Refract water caustics. See the accompanying MIT license.
// Source: https://github.com/Nutlope/hallmark/blob/04977e15f3dfd6ee4b74c887dac3eb52665d6c92/site/themes/refract/scene.js
/** @param {HTMLCanvasElement} canvas */
export function mountRefractWater(canvas) {
  const root = getComputedStyle(document.documentElement);

  // oklch() token to sRGB 0..1
  function oklch(str) {
    const m = str.match(/oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)/);
    if (!m) return [1, 1, 1];
    const L = +m[1] / 100, C = +m[2], h = (+m[3] * Math.PI) / 180;
    const a = C * Math.cos(h), b = C * Math.sin(h);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ ** 3, mm = m_ ** 3, s = s_ ** 3;
    const lin = [
      4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
    ];
    return lin.map((v) => {
      v = Math.min(1, Math.max(0, v));
      return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    });
  }
  const tok = (n) => oklch(root.getPropertyValue(n).trim());

  const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uDpr; uniform float uTime;
uniform vec3 uShade; uniform vec3 uDeep; uniform vec3 uLight; uniform vec3 uGrout;
uniform float uStrength; uniform float uTile; uniform float uCell; uniform float uSplit; uniform float uMode;
uniform float uBars[15]; uniform float uGap; uniform float uRad; uniform float uTop;
uniform vec3 uRip[4]; uniform float uClock;

float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 h2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i), h1(i + vec2(1.0, 0.0)), u.x), mix(h1(i + vec2(0.0, 1.0)), h1(i + vec2(1.0, 1.0)), u.x), u.y);
}
// distance to the nearest seam between moving cells: the bright lines of a caustic sit on the seams
float seam(vec2 p, float t){
  vec2 n = floor(p), f = fract(p); float f1 = 8.0, f2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j)); vec2 o = h2(n + g);
    o = 0.5 + 0.42 * sin(t + 6.2831 * o);
    float d = length(g + o - f);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
  }
  return f2 - f1;
}
vec2 warp(vec2 p, float t){
  return vec2(vnoise(p * 0.32 + vec2(t * 0.05, 0.0)), vnoise(p * 0.32 + vec2(5.2, t * 0.043))) - 0.5;
}
// sun through a moving surface: the light folds into a fine web, brightest where the folds cross
float web(vec2 p, float t){
  vec2 q = p * 1.7 - 250.0; vec2 i = q; float c = 1.0; float inten = 0.0048;
  for (int n = 0; n < 5; n++) {
    float tt = t * (1.0 - 3.5 / float(n + 1));
    i = q + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(q.x / (sin(i.x + tt) / inten), q.y / (cos(i.y + tt) / inten)));
  }
  c /= 5.0; c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 9.0);
}
float caustic(vec2 p, float t){
  p += warp(p, t) * 0.6;
  float lit = 0.55 + 0.6 * smoothstep(0.1, 0.9, vnoise(p * 0.8 + vec2(t * 0.05, -t * 0.04)));
  return min(web(p, t * 0.42 + 23.0) * 1.5, 1.7) * lit;
}
float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }

void main(){
  vec2 px = gl_FragCoord.xy / uDpr;
  vec2 size = uRes / uDpr;
  float t = uTime;
  // ripples from the pointer: a ring that runs out and fades, bending the light it crosses
  vec2 bend = vec2(0.0); float glint = 0.0;
  for (int i = 0; i < 4; i++) {
    vec3 r = uRip[i];
    float age = uClock - r.z;
    if (r.z > 0.0 && age < 3.5) {
      vec2 dv = px - r.xy; float d = length(dv) + 0.001;
      float front = d - age * 210.0;
      float ring = sin(front * 0.07) * exp(-front * front / 12000.0) * exp(-age * 0.9) * exp(-d / 700.0);
      bend += dv / d * ring; glint += ring;
    }
  }
  vec2 p = (px + bend * 30.0) / uCell;
  vec2 sun = vec2(0.62, 0.38) * uSplit;
  vec3 c = vec3(caustic(p + sun, t), caustic(p, t), caustic(p - sun, t));
  // the floor: tiles seen through the moving surface
  vec2 q = px + warp(p * 1.6, t) * 9.0;
  vec2 g = abs(fract(q / uTile) - 0.5);
  float grout = smoothstep(0.465, 0.492, max(g.x, g.y));
  float depth = vnoise(px / 420.0 + vec2(t * 0.006, 0.0));
  vec3 base = mix(uDeep, uShade, 0.55 + 0.45 * depth);
  base = mix(base, uGrout, grout * 0.28);
  // sunlit toward the top right, the light taken from the dark between seams
  float sunlit = 0.82 + 0.28 * (px.x / size.x) * 0.5 + 0.28 * (px.y / size.y) * 0.5;
  vec3 col = base * (0.94 + 0.06 * c.g + glint * 0.07) + uLight * c * uStrength * sunlit;
  float a = 1.0;
  if (uMode > 0.5) {
    float n = 15.0;
    float bw = (size.x - (n - 1.0) * uGap) / n;
    float idx = floor(px.x / (bw + uGap));
    float h = 0.0;
    for (int i = 0; i < 15; i++) { if (float(i) == idx) h = uBars[i]; }
    h = max(h * (size.y - uTop), 6.0);
    vec2 centre = vec2(idx * (bw + uGap) + bw * 0.5, (h - uRad) * 0.5);
    float d = sdBox(px - centre, vec2(bw * 0.5, (h + uRad) * 0.5), uRad);
    a = 1.0 - smoothstep(-0.6, 0.6, d);
    if (idx < 0.0 || idx > n - 1.0) a = 0.0;
    // the water's surface: a bright line at the top of each column
    float surf = smoothstep(2.4, 0.0, abs(px.y - (h - 1.4)));
    col = mix(col, uLight, surf * 0.85);
  }
  gl_FragColor = vec4(min(col, vec3(1.0)) * a, a);
}`;

  function make(canvas, kind) {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true, failIfMajorPerformanceCaveat: true });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
    const prog = gl.createProgram();
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(prog, n);
    const u = {}; ['uRes', 'uDpr', 'uTime', 'uShade', 'uDeep', 'uLight', 'uGrout', 'uStrength', 'uTile', 'uCell', 'uSplit', 'uMode', 'uBars', 'uGap', 'uRad', 'uTop', 'uRip', 'uClock'].forEach((n) => (u[n] = U(n)));

    const shade = tok('--color-shade'), deep = tok('--color-shade-2'), light = [1, 1, 1];
    const cfg = {
      ground: { shade, deep, grout: [0.9, 0.97, 0.99], strength: 0.72, tile: 30, cell: 118, split: 0.045 },
      row: { shade: shade.map((v) => v * 0.55 + 0.45), deep: shade, grout: [0.94, 0.98, 1], strength: 0.42, tile: 26, cell: 96, split: 0.03 },
      bars: { shade, deep, grout: [0.9, 0.97, 0.99], strength: 0.58, tile: 18, cell: 74, split: 0.04 },
    }[kind];
    gl.uniform3fv(u.uShade, cfg.shade); gl.uniform3fv(u.uDeep, cfg.deep); gl.uniform3fv(u.uLight, light); gl.uniform3fv(u.uGrout, cfg.grout);
    gl.uniform1f(u.uStrength, cfg.strength); gl.uniform1f(u.uTile, cfg.tile); gl.uniform1f(u.uCell, cfg.cell); gl.uniform1f(u.uSplit, cfg.split);
    gl.uniform1f(u.uMode, kind === 'bars' ? 1 : 0); gl.uniform1f(u.uRad, 10); gl.uniform1f(u.uTop, 64);

    const s = { canvas, gl, u, kind, rip: new Float32Array(12), ripN: 0, visible: false, bars: new Float32Array(15), target: new Float32Array(15), dpr: 1, w: 0, h: 0, drawn: false };
    s.resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, kind === 'ground' ? 1.5 : 2);
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (w !== s.w || h !== s.h) { canvas.width = w; canvas.height = h; s.w = w; s.h = h; s.dpr = dpr; gl.viewport(0, 0, w, h); s.drawn = false; }
      if (kind === 'bars') { gl.uniform1f(u.uGap, r.width < 640 ? 8 : 16); gl.uniform1f(u.uRad, r.width < 640 ? 5 : 10); }
    };
    s.draw = (time) => {
      gl.uniform2f(u.uRes, s.w, s.h); gl.uniform1f(u.uDpr, s.dpr); gl.uniform1f(u.uTime, time);
      if (kind === 'bars') gl.uniform1fv(u.uBars, s.bars);
      gl.uniform1f(u.uClock, performance.now() / 1000); gl.uniform3fv(u.uRip, s.rip);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!s.drawn) { s.drawn = true; canvas.classList.add('is-on'); }
    };
    s.resize();
    return s;
  }

  const ground = make(canvas, 'ground');
  if (!ground) return () => {};
  const hero = canvas.closest('section');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const start = performance.now();
  let frame = 0;
  let visible = false;
  let lastRip = 0;
  let paintedAt = -Infinity;

  const draw = () => {
    frame = 0;
    if (!visible || document.hidden) return;
    const now = performance.now();
    if (motion.matches || now - paintedAt >= 32) {
      paintedAt = now;
      ground.draw(motion.matches ? 14 : 14 + (now - start) / 1000 * 0.42);
    }
    if (!motion.matches) frame = requestAnimationFrame(draw);
  };
  const refresh = () => {
    cancelAnimationFrame(frame);
    paintedAt = -Infinity;
    draw();
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    refresh();
  });
  observer.observe(canvas);
  const resize = new ResizeObserver(() => {
    ground.resize();
    refresh();
  });
  resize.observe(canvas);
  function drop(event) {
    if (motion.matches) return;
    const now = performance.now();
    if (event.type === 'pointermove' && now - lastRip < 520) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = rect.bottom - event.clientY;
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;
    lastRip = now;
    const offset = (ground.ripN++ % 4) * 3;
    ground.rip.set([x, y, now / 1000], offset);
  }
  hero?.addEventListener('pointermove', drop);
  hero?.addEventListener('pointerdown', drop);
  document.addEventListener('visibilitychange', refresh);
  motion.addEventListener('change', refresh);
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    resize.disconnect();
    hero?.removeEventListener('pointermove', drop);
    hero?.removeEventListener('pointerdown', drop);
    document.removeEventListener('visibilitychange', refresh);
    motion.removeEventListener('change', refresh);
  };
}

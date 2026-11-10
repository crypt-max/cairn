/* CAIRN hero: a topographic map whose ridge IS the price path.
   Contours are computed with marching squares from a heightfield that rises
   along the route; the route is walked live and only the travelled part is drawn
   (the future is never shown). Three demo trades loop: a full win, a TP1 +
   break-even, and a stop-loss. */
(function () {
  const C = {
    ground: [236, 238, 232],
    contour: 'rgba(160, 84, 40, ALPHA)',
    ink: '#16201B',
    yellow: '#F2C200',
    green: '#1E7A49',
    red: '#C4301C',
    blue: '#2D6E95'
  };

  /* ---------- deterministic noise ---------- */
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function makeNoise(seed) {
    const r = mulberry(seed), p = new Uint8Array(512), g = [];
    for (let i = 0; i < 256; i++) { p[i] = i; const a = r() * Math.PI * 2; g.push([Math.cos(a), Math.sin(a)]); }
    for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 256; i++) p[i + 256] = p[i];
    const f = t => t * t * t * (t * (t * 6 - 15) + 10);
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const X = xi & 255, Y = yi & 255;
      const d = (h, dx, dy) => { const v = g[h & 255]; return v[0] * dx + v[1] * dy; };
      const aa = d(p[p[X] + Y], xf, yf), ba = d(p[p[X + 1] + Y], xf - 1, yf);
      const ab = d(p[p[X] + Y + 1], xf, yf - 1), bb = d(p[p[X + 1] + Y + 1], xf - 1, yf - 1);
      const u = f(xf), v = f(yf);
      return (aa + u * (ba - aa)) + v * ((ab + u * (bb - ab)) - (aa + u * (ba - aa)));
    };
  }

  /* ---------- demo scenarios ---------- */
  const SCEN = [
    { pair: 'BTC/USDT', side: 'long', entry: [64200, 64800], tp: [65900, 67300, 68900], sl: 62900, lev: 3, seed: 11,
      keys: [[0, 65350], [0.12, 64900], [0.2, 64450], [0.3, 64700], [0.42, 65600], [0.5, 66100], [0.58, 65700], [0.7, 67000], [0.78, 67500], [0.86, 67900], [0.95, 68800], [1, 69050]] },
    { pair: 'ETH/USDT', side: 'short', entry: [3420, 3460], tp: [3360, 3290, 3200], sl: 3525, lev: 3, seed: 29,
      keys: [[0, 3385], [0.1, 3410], [0.2, 3445], [0.3, 3430], [0.42, 3385], [0.52, 3352], [0.6, 3370], [0.72, 3400], [0.82, 3428], [0.9, 3446], [1, 3452]] },
    { pair: 'SOL/USDT', side: 'long', entry: [148.0, 149.5], tp: [152.8, 156.0, 160.0], sl: 145.6, lev: 2, seed: 47,
      keys: [[0, 150.6], [0.12, 150.1], [0.22, 149.2], [0.32, 150.4], [0.44, 151.4], [0.54, 149.8], [0.64, 148.1], [0.74, 147.2], [0.86, 146.3], [0.94, 145.4], [1, 145.0]] }
  ];

  function buildPath(s) {
    const r = mulberry(s.seed * 97), N = 240, out = [];
    const span = (s.tp[2] - s.sl);
    let n1 = 0, n2 = 0;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      let k = 0; while (k < s.keys.length - 2 && s.keys[k + 1][0] < t) k++;
      const [t0, p0] = s.keys[k], [t1, p1] = s.keys[k + 1];
      let u = (t - t0) / (t1 - t0); u = u * u * (3 - 2 * u);
      n1 = n1 * 0.82 + (r() - 0.5) * 0.9; n2 = n2 * 0.6 + n1 * 0.4;
      out.push({ t, p: p0 + (p1 - p0) * u + n2 * Math.abs(span) * 0.012 });
    }
    // events from the actual path
    const L = s.side === 'long';
    const above = (a, b) => L ? a >= b : a <= b;
    const ev = []; let inTrade = false, hit = 0, stop = s.sl, done = false;
    const entryEdge = L ? s.entry[1] : s.entry[0];
    const entryMid = (s.entry[0] + s.entry[1]) / 2;
    out.forEach((pt, i) => {
      if (done) return;
      if (!inTrade) { if (L ? pt.p <= entryEdge : pt.p >= entryEdge) { inTrade = true; ev.push({ i, type: 'in', p: pt.p }); } return; }
      if (hit < 3 && above(pt.p, s.tp[hit])) { hit++; ev.push({ i, type: 'tp' + hit, p: s.tp[hit - 1] }); if (hit === 1) stop = entryMid; if (hit === 3) done = true; return; }
      if (!above(pt.p, stop) && (L ? pt.p <= stop : pt.p >= stop)) { ev.push({ i, type: hit ? 'be' : 'sl', p: stop }); done = true; }
    });
    const end = done ? ev[ev.length - 1].i : N;
    return { pts: out, ev, end };
  }

  /* ---------- renderer (seekable: drawAt(t) is a pure function of t) ---------- */
  function createMap(canvas, opts) {
  opts = opts || {};
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  const layers = [];
  let current = -1, scen = null, path = null, pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const DUR = opts.dur || 12500, WALK0 = opts.walk0 || 1300, WALK1 = opts.walk1 || 10000, FADE = 900;
  const reduce = !!opts.reduce;
  const K = opts.scale || 1, KC = opts.contourScale || 1;
  const listeners = [];
  function geom() {
    if (opts.geom) return opts.geom(W, H);
    const mobile = W < 760;
    return { x0: W * (mobile ? 0.06 : 0.45), x1: W * (mobile ? 0.50 : 0.84), y0: H * (mobile ? 0.10 : 0.14), y1: H * (mobile ? 0.90 : 0.68) };
  }
  function priceY(p) {
    const g = geom(), s = scen;
    const lo = Math.min(s.sl, s.tp[2]), hi = Math.max(s.sl, s.tp[2]), pad = (hi - lo) * 0.08;
    return g.y1 - (p - (lo - pad)) / ((hi + pad) - (lo - pad)) * (g.y1 - g.y0);
  }
  function ptXY(pt) { const g = geom(); return [g.x0 + pt.t * (g.x1 - g.x0), priceY(pt.p)]; }
  function renderBase(s, P) {
    const off = document.createElement('canvas');
    off.width = Math.round(W * DPR); off.height = Math.round(H * DPR);
    const o = off.getContext('2d'); o.scale(DPR, DPR);
    const cell = W < 760 ? 6 : 7, nx = Math.ceil(W / cell) + 2, ny = Math.ceil(H / cell) + 2;
    const noise = makeNoise(s.seed), noise2 = makeNoise(s.seed + 5);
    const g = geom();
    // route y lookup per column
    const ry = new Float32Array(nx);
    for (let i = 0; i < nx; i++) {
      const x = i * cell, t = Math.min(1, Math.max(0, (x - g.x0) / (g.x1 - g.x0)));
      const idx = Math.round(t * (P.pts.length - 1));
      ry[i] = priceY(P.pts[idx].p);
    }
    const h = new Float32Array(nx * ny);
    const sig = H * 0.16;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = i * cell, y = j * cell;
      let n = 0, a = 0.55, f = 0.0042;
      for (let o2 = 0; o2 < 4; o2++) { n += a * noise(x * f, y * f); a *= 0.5; f *= 2.05; }
      const warp = noise2(x * 0.002, y * 0.002) * 0.25;
      const d = (y - ry[i]) / sig;
      const xf = Math.min(1, Math.max(0, Math.min((x - g.x0 + W * 0.1) / (W * 0.12), (g.x1 + W * 0.18 - x) / (W * 0.12))));
      const ridge = Math.exp(-d * d) * (0.55 + 0.35 * (1 - ry[i] / H)) * (0.35 + 0.65 * xf);
      h[j * nx + i] = 0.42 + n * 0.75 + warp + ridge;
    }
    // hillshade, at grid resolution then upscaled
    const sh = document.createElement('canvas'); sh.width = nx; sh.height = ny;
    const sc = sh.getContext('2d'), id = sc.createImageData(nx, ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const dx = (h[k + (i < nx - 1 ? 1 : 0)] - h[k - (i > 0 ? 1 : 0)]);
      const dy = (h[k + (j < ny - 1 ? nx : 0)] - h[k - (j > 0 ? nx : 0)]);
      const shade = Math.max(-1, Math.min(1, (-dx * 0.7 + -dy * 0.7) * 9));
      const elev = Math.max(0, Math.min(1, (h[k] - 0.3) / 1.1));
      // hypsometric tint: valley sage -> rock grey-warm
      const r = 226 + elev * 10, gg = 232 - elev * 6, b = 222 - elev * 8;
      const l = shade * 16;
      id.data[k * 4] = r + l; id.data[k * 4 + 1] = gg + l; id.data[k * 4 + 2] = b + l; id.data[k * 4 + 3] = 255;
    }
    sc.putImageData(id, 0, 0);
    o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high';
    o.drawImage(sh, -cell, -cell, nx * cell, ny * cell);
    // contours
    const levels = 26, lo = 0.0, hi = 1.9;
    for (let L = 0; L < levels; L++) {
      const v = lo + (hi - lo) * L / levels, index = L % 5 === 0;
      o.beginPath();
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = h[j * nx + i], b = h[j * nx + i + 1], c2 = h[(j + 1) * nx + i + 1], d2 = h[(j + 1) * nx + i];
        const code = (a > v ? 8 : 0) | (b > v ? 4 : 0) | (c2 > v ? 2 : 0) | (d2 > v ? 1 : 0);
        if (code === 0 || code === 15) continue;
        const x = (i - 1) * cell, y = (j - 1) * cell;
        const T = [x + cell * (v - a) / (b - a), y], R = [x + cell, y + cell * (v - b) / (c2 - b)];
        const B = [x + cell * (v - d2) / (c2 - d2), y + cell], Lf = [x, y + cell * (v - a) / (d2 - a)];
        const seg = (p, q) => { o.moveTo(p[0], p[1]); o.lineTo(q[0], q[1]); };
        switch (code) {
          case 1: case 14: seg(Lf, B); break; case 2: case 13: seg(B, R); break;
          case 3: case 12: seg(Lf, R); break; case 4: case 11: seg(T, R); break;
          case 5: seg(Lf, T); seg(B, R); break; case 6: case 9: seg(T, B); break;
          case 7: case 8: seg(Lf, T); break; case 10: seg(T, R); seg(Lf, B); break;
        }
      }
      o.strokeStyle = C.contour.replace('ALPHA', index ? 0.55 : 0.26);
      o.lineWidth = (index ? 1.1 : 0.6) * KC;
      o.stroke();
    }
    // map grid ticks (survey graticule)
    o.strokeStyle = 'rgba(22,32,27,0.07)'; o.lineWidth = 1;
    for (let x = 0; x < W; x += 120) { o.beginPath(); o.moveTo(x + 0.5, 0); o.lineTo(x + 0.5, H); o.stroke(); }
    for (let y = 0; y < H; y += 120) { o.beginPath(); o.moveTo(0, y + 0.5); o.lineTo(W, y + 0.5); o.stroke(); }
    return off;
  }

  function fmt(p) {
    const d = p < 1000 ? (p < 10 ? 3 : 1) : 0;
    return p.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/,/g, ' ');
  }

  function cairnIcon(x, y, s, col) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.strokeStyle = 'rgba(236,238,232,0.95)'; ctx.lineWidth = 2 * s;
    [[0, 0, 7, 2.8], [-0.6, -5, 5.2, 2.3], [0.6, -9.2, 3.6, 1.9], [0, -12.6, 2.2, 1.4]].forEach(([dx, dy, rx, ryy]) => {
      ctx.beginPath(); ctx.ellipse(dx * s, dy * s, rx * s, ryy * s, 0, 0, Math.PI * 2); ctx.stroke(); ctx.fill();
    });
    ctx.restore();
  }

  function drawAt(t, fadeT) {
    const now = t;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    pointer.x += (pointer.tx - pointer.x) * 0.06; pointer.y += (pointer.ty - pointer.y) * 0.06;
    // base layers with crossfade
    layers.forEach(L => {
      const a = fadeT == null ? 1 : Math.min(1, (fadeT - L.born) / FADE);
      ctx.globalAlpha = a;
      ctx.drawImage(L.img, pointer.x * 6, pointer.y * 4, W, H);
    });
    ctx.globalAlpha = 1;
    while (layers.length > 1 && (fadeT == null || fadeT - layers[1].born > FADE)) layers.shift();

    const s = scen, P = path, g = geom(), L = s.side === 'long';
    const walk = reduce ? 1 : Math.max(0, Math.min(1, (t - WALK0) / (WALK1 - WALK0)));
    const head = Math.min(P.end, Math.round(walk * (P.pts.length - 1)));
    const intro = reduce ? 1 : Math.min(1, t / 900);
    const e = 1 - Math.pow(1 - intro, 3);

    // level lines
    const xr = g.x0 + (g.x1 - g.x0) * e;
    const zoneA = priceY(s.entry[0]), zoneB = priceY(s.entry[1]);
    ctx.fillStyle = 'rgba(242,194,0,0.30)';
    ctx.fillRect(g.x0, Math.min(zoneA, zoneB), xr - g.x0, Math.abs(zoneA - zoneB) || 2);
    const passed = P.ev.filter(v => v.i <= head);
    const tpHit = passed.filter(v => v.type.startsWith('tp')).length;
    const beActive = tpHit >= 1;
    let stopP = s.sl;
    if (beActive) {
      const tp1i = P.ev.find(v => v.type === 'tp1').i;
      const k = Math.min(1, (head - tp1i) / 10);
      stopP = s.sl + ((s.entry[0] + s.entry[1]) / 2 - s.sl) * (1 - Math.pow(1 - k, 3));
    }
    const lines = [
      ...s.tp.map((p, i) => ({ p, col: C.green, lab: 'TP' + (i + 1), dash: [6, 5], hit: i < tpHit })),
      { p: stopP, col: C.red, lab: rt('sl'), dash: [3, 4] }
    ];
    ctx.font = '500 ' + (11 * K) + 'px "Martian Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    const ezY = (priceY(s.entry[0]) + priceY(s.entry[1])) / 2;
    lines.forEach(l => {
      const y = Math.round(priceY(l.p)) + 0.5;
      const ly = (l.lab === rt('sl') && Math.abs(y - ezY) < 20 * K) ? ezY + 22 * K : y;
      ctx.strokeStyle = l.col; ctx.globalAlpha = l.hit ? 0.9 : 0.6; ctx.lineWidth = (l.hit ? 1.5 : 1) * K;
      ctx.setLineDash(l.dash.map(v => v * K)); ctx.beginPath(); ctx.moveTo(g.x0, y); ctx.lineTo(xr, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = e;
      const txt = l.lab + '  ' + fmt(l.p), tw = ctx.measureText(txt).width;
      ctx.fillStyle = 'rgba(236,238,232,0.92)'; ctx.fillRect(xr + 8 * K, ly - 9 * K, tw + 12 * K, 18 * K);
      ctx.fillStyle = l.col; ctx.fillText(txt, xr + 14 * K, ly + 0.5);
    });
    ctx.globalAlpha = e;
    const ez = (zoneA + zoneB) / 2;
    const etxt = rt('entry') + '  ' + fmt(s.entry[0]) + '–' + fmt(s.entry[1]), etw = ctx.measureText(etxt).width;
    ctx.fillStyle = C.yellow; ctx.fillRect(xr + 8 * K, ez - 9 * K, etw + 12 * K, 18 * K);
    ctx.fillStyle = C.ink; ctx.fillText(etxt, xr + 14 * K, ez + 0.5);
    ctx.globalAlpha = 1;

    // travelled trail
    if (head > 0) {
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const trace = () => { ctx.beginPath(); for (let i = 0; i <= head; i++) { const [x, y] = ptXY(P.pts[i]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } };
      trace(); ctx.strokeStyle = 'rgba(236,238,232,0.95)'; ctx.lineWidth = 6 * K; ctx.stroke();
      trace(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.2 * K; ctx.stroke();
      // trailhead
      const [sx, sy] = ptXY(P.pts[0]);
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(sx, sy, 3.2 * K, 0, Math.PI * 2); ctx.fill();
      // markers
      passed.forEach(v => {
        const [x] = ptXY(P.pts[v.i]), y = priceY(v.p);
        if (v.type === 'in') { ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(x, y - 11 * K); ctx.lineTo(x + 8 * K, y - 7 * K); ctx.lineTo(x, y - 3 * K); ctx.fill(); ctx.fillRect(x - K, y - 11 * K, 2 * K, 12 * K); }
        if (v.type.startsWith('tp')) cairnIcon(x, y - 3 * K, 1.05 * K, C.green);
        if (v.type === 'sl' || v.type === 'be') {
          ctx.strokeStyle = v.type === 'sl' ? C.red : C.ink; ctx.lineWidth = 2.4 * K; const q = 6 * K;
          ctx.beginPath(); ctx.moveTo(x - q, y - q); ctx.lineTo(x + q, y + q); ctx.moveTo(x + q, y - q); ctx.lineTo(x - q, y + q); ctx.stroke();
        }
      });
      // walker
      if (head < P.end || walk < 1) {
        const [hx, hy] = ptXY(P.pts[head]);
        const pulse = (Math.sin(t / 260) + 1) / 2;
        ctx.fillStyle = 'rgba(22,32,27,' + (0.18 * (1 - pulse)) + ')'; ctx.beginPath(); ctx.arc(hx, hy, (6 + pulse * 10) * K, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.yellow; ctx.strokeStyle = C.ink; ctx.lineWidth = 2 * K; ctx.beginPath(); ctx.arc(hx, hy, 5.5 * K, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }

    // state for the signpost
    let state = 'post';
    if (passed.length) state = passed[passed.length - 1].type;
    emit(state, tpHit, stopP);
    return state;
  }

  let lastState = '';
  function emit(state, tpHit, stopP) {
    const key = current + state;
    if (key === lastState) return;
    lastState = key;
    listeners.forEach(fn => fn({ scen, state, tpHit, stopP }));
  }
  function rt(k) { const lang = (opts.lang && opts.lang()) || (document.documentElement.lang === 'ru' ? 'ru' : 'en'); return window.CAIRN_I18N.rt[lang][k]; }
  function setScenario(i, bornAt) {
    current = i % SCEN.length; scen = SCEN[current]; path = buildPath(scen);
    layers.push({ img: renderBase(scen, path), born: bornAt == null ? -1e9 : bornAt });
    lastState = '';
  }
  function resize(w, h, dpr) {
    W = Math.max(320, w); H = Math.max(320, h); DPR = dpr || Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    if (scen) { layers.length = 0; layers.push({ img: renderBase(scen, path), born: -1e9 }); }
  }
  return { drawAt, setScenario, resize, events: () => path.ev.map(e => ({ type: e.type, t: WALK0 + e.i / (path.pts.length - 1) * (WALK1 - WALK0) })), on: fn => listeners.push(fn), get index() { return current; }, pointer, DUR, WALK0, WALK1, count: SCEN.length, rt };
  }
  window.CAIRNMap = createMap;

  /* ---------- live hero on the site ---------- */
  const canvas = document.getElementById('terrain');
  if (!canvas) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const map = createMap(canvas, { reduce });
  const fit = () => { const r = canvas.getBoundingClientRect(); map.resize(r.width, r.height); };
  fit();
  window.CAIRN_TERRAIN = { on: map.on, rt: map.rt };
  let startT = 0, frame = null, running = false, pausedAt = 0, idx = -1;
  function loop(now) {
    if (idx < 0 || now - startT > map.DUR) { idx = (idx + 1) % map.count; map.setScenario(idx, now); startT = now; }
    map.pointer.x += (map.pointer.tx - map.pointer.x) * 0.06; map.pointer.y += (map.pointer.ty - map.pointer.y) * 0.06;
    map.drawAt(now - startT, now);
    frame = requestAnimationFrame(loop);
  }
  function start() { if (running) return; running = true; frame = requestAnimationFrame(n => { if (pausedAt) startT += n - pausedAt; loop(n); }); }
  function stop() { if (!running) return; running = false; cancelAnimationFrame(frame); pausedAt = performance.now(); }
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(fit, 150); });
  addEventListener('pointermove', e => { map.pointer.tx = (e.clientX / innerWidth - 0.5) * -1; map.pointer.ty = (e.clientY / innerHeight - 0.5) * -1; }, { passive: true });
  if (reduce) { map.setScenario(0); map.drawAt(map.WALK1 + 50); }
  else new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? start() : stop()), { threshold: 0.02 }).observe(canvas);
})();

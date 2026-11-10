/* CAIRN — page behaviour */
(function () {
  document.documentElement.classList.add('js');
  const TG_URL = ''; // ← paste the real Telegram link here, e.g. https://t.me/your_channel
  const I = window.CAIRN_I18N;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- Telegram links ---------- */
  $$('[data-tg]').forEach(a => {
    if (TG_URL) { a.href = TG_URL; a.target = '_blank'; a.rel = 'noopener'; }
    else a.href = '#plans';
  });

  /* ---------- i18n ---------- */
  const EN = {};
  $$('[data-i18n]').forEach(el => { EN[el.dataset.i18n] = el.textContent; });
  let lang = localStorage.getItem('cairn-lang') || ((navigator.language || '').toLowerCase().startsWith('ru') || (navigator.language || '').toLowerCase().startsWith('uk') ? 'ru' : 'en');
  function rt(k) { return I.rt[lang][k]; }
  function applyLang(l) {
    lang = l; document.documentElement.lang = l; localStorage.setItem('cairn-lang', l);
    $$('[data-i18n]').forEach(el => { const k = el.dataset.i18n; const v = l === 'en' ? EN[k] : I.ru[k]; if (v != null) el.textContent = v; });
    $$('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
    document.title = l === 'ru' ? 'CAIRN — крипто-сигналы, размеченные как тропа' : 'CAIRN — crypto signals, marked like a trail';
    renderJournal(); renderPost(lastPost); drawRouteFig(); setVideoSources(); requestAnimationFrame(layoutTrail);
  }
  $$('.lang button').forEach(b => b.addEventListener('click', () => applyLang(b.dataset.lang)));

  /* ---------- journal (DEMO data) ---------- */
  const J = [
    ['2026-11-10', 'ETH/USDT', 'long', '3 395', '3 318', 'open', null],
    ['2026-11-08', 'BTC/USDT', 'long', '64 500', '62 900', 'tp3', 1.92],
    ['2026-11-06', 'SOL/USDT', 'long', '148.7', '145.6', 'sl', -1],
    ['2026-11-05', 'ETH/USDT', 'short', '3 440', '3 525', 'tp1', 0.31],
    ['2026-11-03', 'LINK/USDT', 'long', '14.62', '14.05', 'tp2', 1.12],
    ['2026-11-01', 'XRP/USDT', 'short', '0.6420', '0.6610', 'sl', -1],
    ['2026-10-30', 'BNB/USDT', 'long', '598.5', '584.0', 'tp3', 2.05],
    ['2026-10-28', 'AVAX/USDT', 'long', '27.40', '26.35', 'sl', -1],
    ['2026-10-27', 'BTC/USDT', 'short', '66 900', '68 100', 'tp1', 0.28],
    ['2026-10-24', 'DOGE/USDT', 'long', '0.1385', '0.1322', 'tp2', 1.04],
    ['2026-10-22', 'ETH/USDT', 'long', '3 310', '3 228', 'sl', -1],
    ['2026-10-20', 'TON/USDT', 'long', '5.42', '5.18', 'tp1', 0.33],
    ['2026-10-17', 'ADA/USDT', 'short', '0.3610', '0.3720', 'tp3', 1.88],
    ['2026-10-15', 'SOL/USDT', 'long', '141.2', '137.9', 'tp2', 1.09],
    ['2026-10-13', 'ARB/USDT', 'long', '0.712', '0.684', 'sl', -1]
  ];
  const outCls = o => o === 'sl' ? 'loss' : o === 'open' ? 'open' : o === 'tp1' ? 'be' : 'win';
  const rCls = r => r == null ? '' : r > 0 ? 'r-pos' : r < 0 ? 'r-neg' : 'r-be';
  const fmtR = r => r == null ? '—' : (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(2);
  function fmtDate(d) { const [y, m, dd] = d.split('-'); return lang === 'ru' ? `${dd}.${m}.${y}` : `${dd} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]} ${y}`; }
  function renderJournal() {
    $('#jbody').innerHTML = J.map(([d, p, s, e, st, o, r]) => `<tr>
      <td>${fmtDate(d)}</td><td><b>${p}</b></td><td>${rt(s)}</td><td class="num">${e}</td><td class="num">${st}</td>
      <td><span class="out out--${outCls(o)}"><i></i>${rt('o_' + o)}</span></td><td class="num ${rCls(r)}">${fmtR(r)}</td></tr>`).join('');
    const closed = J.filter(x => x[5] !== 'open').reverse();
    const wins = closed.filter(x => x[5] !== 'sl').length, losses = closed.length - wins;
    const avg = closed.reduce((a, x) => a + x[6], 0) / closed.length;
    let streak = 0, worst = 0; closed.forEach(x => { streak = x[5] === 'sl' ? streak + 1 : 0; worst = Math.max(worst, streak); });
    const stats = [[J.length, rt('st_n'), ''], [wins + ' / ' + closed.length, rt('st_w'), 'pos'], [losses + ' / ' + closed.length, rt('st_l'), 'neg'], [fmtR(avg) + ' R', rt('st_r'), ''], [worst, rt('st_dd'), '']];
    $('#jstats').innerHTML = stats.map(([v, l, c]) => `<div class="jstat"><b class="${c}">${v}</b><span>${l}</span></div>`).join('');
    // tape
    const items = J.filter(x => x[5] !== 'open').map(([d, p, s, e, st, o, r]) => `<span class="tape-item"><b>${p}</b><em>${rt(s)}</em>${rt('o_' + o)}<span class="${rCls(r)}">${fmtR(r)} R</span><em>${fmtDate(d)}</em></span>`).join('');
    $('#tape').innerHTML = items + items;
  }

  /* ---------- hero signpost ---------- */
  let lastPost = null;
  const fmtP = p => { const d = p < 1000 ? (p < 10 ? 3 : 1) : 0; return p.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/,/g, ' '); };
  function renderPost(ev) {
    if (!ev) return;
    lastPost = ev;
    const s = ev.scen;
    $('#post-pair').textContent = s.pair;
    $('#post-side').textContent = rt(s.side) + ' ×' + s.lev;
    const beMoved = ev.tpHit >= 1;
    $('#post-levels').innerHTML =
      `<div><dt>${rt('entry')}</dt><dd>${fmtP(s.entry[0])}–${fmtP(s.entry[1])}</dd></div>` +
      s.tp.map((p, i) => `<div><dt>TP${i + 1}</dt><dd class="${i < ev.tpHit ? 'hit' : ''}">${fmtP(p)}</dd></div>`).join('') +
      `<div class="sl"><dt>${rt('sl')}</dt><dd class="${beMoved ? 'moved' : ''}">${fmtP(beMoved ? (s.entry[0] + s.entry[1]) / 2 : s.sl)}</dd></div>`;
    const st = ev.state === 'in' ? 'in' : ev.state;
    const el = $('#post-state');
    el.textContent = rt('s_' + st); $('#post-note').textContent = rt('n_' + st);
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }
  if (window.CAIRN_TERRAIN) window.CAIRN_TERRAIN.on(renderPost);

  /* ---------- anatomy figure ---------- */
  function drawRouteFig() {
    const svg = $('#route-fig'); if (!svg) return;
    const W = 560, H = 300, y = p => 270 - (p - 62400) / (69400 - 62400) * 240;
    const pts = [65350, 64900, 64450, 64700, 65600, 66100, 65700, 67000, 67500, 67900, 68800, 69050];
    const xs = i => 20 + i * (300 / (pts.length - 1));
    let d = ''; pts.forEach((p, i) => { d += (i ? ' L' : 'M') + xs(i).toFixed(1) + ' ' + y(p).toFixed(1); });
    const lab = (txt, yy, col) => `<text x="412" y="${yy + 3.5}" fill="${col}">${txt}</text>`;
    svg.innerHTML = `
      <g class="lvl" data-k="entry"><rect x="20" y="${y(64800)}" width="300" height="${y(64200) - y(64800)}" fill="rgba(242,194,0,.38)"/>${lab(rt('entry') + ' 64 200–800', (y(64800) + y(64200)) / 2, '#16201B')}</g>
      <g class="lvl" data-k="tp">${[65900, 67300, 68900].map((p, i) => `<line x1="20" x2="320" y1="${y(p)}" y2="${y(p)}" stroke="#1E7A49" stroke-dasharray="6 5"/>${lab('TP' + (i + 1) + ' ' + fmtP(p), y(p), '#1E7A49')}`).join('')}</g>
      <g class="lvl" data-k="sl"><line x1="20" x2="320" y1="${y(62900)}" y2="${y(62900)}" stroke="#C4301C" stroke-dasharray="3 4"/>${lab(rt('sl') + ' 62 900', y(62900), '#C4301C')}</g>
      <g class="lvl" data-k="risk"><line x1="370" x2="370" y1="${y(64500)}" y2="${y(62900)}" stroke="#16201B"/><line x1="364" x2="376" y1="${y(64500)}" y2="${y(64500)}" stroke="#16201B"/><line x1="364" x2="376" y1="${y(62900)}" y2="${y(62900)}" stroke="#16201B"/><text x="382" y="${(y(64500) + y(62900)) / 2 + 3}" fill="#16201B">1 R</text></g>
      <g class="lvl" data-k="pair"><path d="${d}" fill="none" stroke="#ECEEE8" stroke-width="6" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#16201B" stroke-width="2.2" stroke-linejoin="round"/></g>
      <g class="lvl" data-k="lev"><text x="20" y="22" fill="#16201B">×3 · 1% → 3%</text></g>`;
    setFig(currentK);
  }
  let currentK = 'pair';
  function setFig(k) {
    currentK = k;
    $$('#route-fig .lvl').forEach(g => { g.style.opacity = (g.dataset.k === k || g.dataset.k === 'pair') ? 1 : 0.22; });
    $$('.sample-lines li').forEach(li => li.classList.toggle('on', li.dataset.k === k));
  }
  const stepObs = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { $$('.step').forEach(s => s.classList.remove('on')); e.target.classList.add('on'); setFig(e.target.dataset.k); }
  }), { rootMargin: '-45% 0px -45% 0px' });
  $$('.step').forEach(s => stepObs.observe(s));
  $('.step') && $('.step').classList.add('on');

  /* ---------- videos (language + device aware) ---------- */
  const mobileQ = matchMedia('(max-width: 860px)');
  function videoName(v) { const base = (mobileQ.matches && v.dataset.baseM) || v.dataset.base; return 'media/' + base + (lang === 'ru' ? '-ru' : ''); }
  function setVideoSources() {
    $$('video[data-base]').forEach(v => {
      const n = videoName(v);
      v.poster = n + '.jpg';
      const was = v.dataset.film;
      v.dataset.film = n + '.mp4';
      if (v.dataset.loaded && was !== v.dataset.film) { v.src = v.dataset.film; if (v.dataset.visible && !reduce) v.play().catch(() => {}); }
      const fr = v.closest('.film-frame'); if (fr) fr.classList.toggle('is-vertical', mobileQ.matches);
    });
  }
  const vidObs = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) {
      v.dataset.visible = '1';
      if (!v.dataset.loaded) { v.src = v.dataset.film; v.dataset.loaded = '1'; }
      if (!reduce) v.play().catch(() => {});
    } else { delete v.dataset.visible; v.pause(); }
  }), { threshold: 0.35 });
  $$('video[data-base]').forEach(v => vidObs.observe(v));
  mobileQ.addEventListener('change', setVideoSources);
  const film = $('#film-video'), soundBtn = $('#film-sound');
  soundBtn && soundBtn.addEventListener('click', () => {
    if (film.muted) { film.muted = false; film.currentTime = 0; film.loop = false; film.play(); soundBtn.querySelector('span').textContent = lang === 'ru' ? 'Выключить звук' : 'Mute'; }
    else { film.muted = true; film.loop = true; soundBtn.querySelector('span').textContent = lang === 'ru' ? I.ru['f.sound'] : EN['f.sound']; }
  });

  /* ---------- page trail ---------- */
  const trailWrap = $('.trail'), tp = $('#trail-path'), td = $('#trail-done');
  let trailLen = 0, trailTop = 0, trailH = 0;
  function layoutTrail() {
    if (!trailWrap || getComputedStyle(trailWrap).display === 'none') return;
    const hero = $('.hero'), foot = $('.foot');
    trailTop = hero.offsetHeight + 0; trailH = foot.offsetTop - trailTop;
    trailWrap.style.top = trailTop + 'px'; trailWrap.style.height = trailH + 'px';
    $('#trail-svg').setAttribute('height', trailH);
    let d = 'M 28 0'; const step = 160;
    for (let y = step; y <= trailH; y += step) { const x = 28 + Math.sin(y / 310) * 9 + Math.sin(y / 97) * 4; d += ` Q ${(28 + x) / 2 + 6} ${y - step / 2} ${x.toFixed(1)} ${y}`; }
    tp.setAttribute('d', d); td.setAttribute('d', d);
    trailLen = td.getTotalLength(); td.style.strokeDasharray = trailLen; updateTrail();
  }
  function updateTrail() {
    if (!trailLen) return;
    const prog = Math.max(0, Math.min(1, (scrollY + innerHeight * 0.6 - trailTop) / trailH));
    td.style.strokeDashoffset = trailLen * (1 - prog);
  }

  /* ---------- nav state ---------- */
  const nav = $('.nav');
  function onScroll() { nav.classList.toggle('is-scrolled', scrollY > 20); updateTrail(); }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => requestAnimationFrame(layoutTrail));
  addEventListener('load', layoutTrail);

  /* ---------- smooth scroll + reveals ---------- */
  if (!reduce && window.Lenis && window.gsap) {
    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.95 });
    lenis.on('scroll', () => { ScrollTrigger.update(); onScroll(); });
    gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
    $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      const id = a.getAttribute('href'); if (id.length < 2) return; const t = $(id); if (!t) return;
      e.preventDefault(); lenis.scrollTo(t, { offset: id === '#top' ? 0 : -76, duration: 1.4 });
    }));
    window.CAIRN_LENIS = lenis;

    // hero entrance: lettering settles like ink on a map
    gsap.from('.hero h1', { y: 28, filter: 'blur(8px)', opacity: 0, duration: 1.3, ease: 'expo.out', delay: .1 });
    gsap.from(['.hero-sub', '.hero-actions', '.risk-line'], { y: 18, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: .09, delay: .35 });
    gsap.from('.post', { y: 24, opacity: 0, duration: 1.1, ease: 'expo.out', delay: .7 });

    // section titles: clip upward from their baseline
    $$('.sec-title, .what h2, .close h2').forEach(h => {
      gsap.from(h, { clipPath: 'inset(0 0 100% 0)', y: 30, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 85%' } });
    });
    // journal rows reveal like a ledger being written
    ScrollTrigger.create({ trigger: '.jtable', start: 'top 80%', once: true, onEnter: () => gsap.from('#jbody tr', { opacity: 0, x: -12, duration: .6, ease: 'expo.out', stagger: .04 }) });
    gsap.from('.jstat b', { y: 16, opacity: 0, duration: .9, ease: 'expo.out', stagger: .08, scrollTrigger: { trigger: '.journal-stats', start: 'top 85%' } });
    // plans: plates slide in from the post
    gsap.from('.plan', { y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: .1, scrollTrigger: { trigger: '.plans-row', start: 'top 80%' } });
    gsap.from('.clip', { y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: .12, scrollTrigger: { trigger: '.steps-row', start: 'top 80%' } });
    // film frame zooms out of the night map
    gsap.fromTo('.film-frame', { scale: .9, opacity: .4 }, { scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: '.film', start: 'top 85%', end: 'center 55%', scrub: true } });
    // footer wordmark rises like a ridge
    gsap.fromTo('.wordmark', { yPercent: 40 }, { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  }

  applyLang(lang);
})();

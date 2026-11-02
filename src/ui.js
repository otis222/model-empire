/* 《模型帝國》介面層 */
(function () {
  'use strict';
  const D = window.ME_DATA; const ME = window.ME; const Game = ME.Game;
  const money = ME.fmtMoney, num = ME.fmtNum, tok = ME.fmtTokens, par = ME.fmtParams;
  const SAVE_KEY = 'model-empire-save-v1';
  // 每週毫秒：暫停／一倍／兩倍／四倍。比照原作（約 1 分鐘一週、全破 2～3 小時）：一倍速 10 秒一週，
  // 一局 417 週純時間約 70 分鐘，加上事件與決策約 2～3 小時
  const SPEEDS = [0, 10000, 5000, 2500];
  let G = null, speed = 0, lastSpeed = 1, timer = null, tab = 'home', modalOpen = false, resumeAfter = false, holdUntil = 0;
  let titleSel = { scenario: 'garage', mascot: 'whale', city: null };
  let wiz = null; let heroRAF = 0; let chatModel = null;
  const root = document.getElementById('app');
  // 介面偏好（只影響畫面，不進存檔）
  const UIP = 'model-empire-ui';
  function uiPref(k, d) { try { const o = JSON.parse(localStorage.getItem(UIP) || '{}'); return k in o ? o[k] : d; } catch (e) { return d; } }
  function setUiPref(k, v) { try { const o = JSON.parse(localStorage.getItem(UIP) || '{}'); o[k] = v; localStorage.setItem(UIP, JSON.stringify(o)); } catch (e) { /* 忽略 */ } }
  let logFilter = 'all'; let showReal = uiPref('real', true);
  // 語言也只影響畫面：遊戲文字和存檔都是繁體，顯示時才轉換（zh.js）
  const ZH = window.ME_ZH; ZH.set(uiPref('lang', ZH.detect()));
  const DEFAULT_CO = D.DEFAULT_COMPANY || '鯨躍實驗室';
  const langSwitch = () => `<div class="seg-ctl lang-sw" role="group" aria-label="語言">${[['tc', '繁體'], ['sc', '简体']].map(([k, n]) => `<button type="button" data-act="lang" data-v="${k}" data-zh="raw" class="${ZH.lang() === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  // 細線圖示（不用 emoji，方便跟方舟風介面搭配）
  const ICON = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    models: '<path d="M10 2v7.5a2 2 0 0 1-.2.9L4.7 20.6a1 1 0 0 0 .9 1.4h12.8a1 1 0 0 0 .9-1.4l-5.1-10.2a2 2 0 0 1-.2-.9V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>',
    tech: '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
    team: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    compute: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>',
    data: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    market: '<path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    finance: '<path d="M3 22h18"/><path d="M6 18v-7M10 18v-7M14 18v-7M18 18v-7"/><path d="M12 2l8 5H4z"/>',
    report: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    menu: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    chev: '<path d="m6 15 6-6 6 6"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    mute: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M2 2l20 20"/>',
  };
  function svg(id, s, cls) { return `<svg class="ico${cls ? ' ' + cls : ''}" width="${s || 18}" height="${s || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[id] || ''}</svg>`; }
  // 科技、路線與設備的圖示（src/icons.js）
  const IC = window.ME_ICONS;
  const GLOBE = window.ME_GLOBE;
  const techTile = (t, big) => `<span class="tk-ic${big ? ' big' : ''}" style="--ln:${IC.lineColor(t.line)}">${IC.tech(t.id, big ? 28 : 20)}</span>`;
  /* ================= 音樂與音效：Web Audio 即時合成，不用音檔 =================
     背景音樂是四和弦循環的氛圍曲：時間暫停時只有鋪底與琶音，時間跑起來才加鼓點，四倍速再加密集的鈸。
     瀏覽器規定要等玩家第一次點擊才能出聲，所以第一次點擊時才建立 AudioContext。 */
  const AU = { ctx: null, master: null, music: null, sfx: null, delay: null, noise: null, timer: 0, nextT: 0, step: 0,
    on: { music: uiPref('music', true), sfx: uiPref('sfx', true) }, vol: uiPref('vol', 0.6) };
  const MUSIC_GAIN = 0.3, SFX_GAIN = 0.5, STEP = 60 / 84 / 4;
  const PROG = [[48, 55, 59, 62, 64], [45, 52, 55, 59, 60], [41, 48, 52, 55, 57], [43, 50, 55, 57, 59]];
  const ARP = [0, 3, 6, 8, 10, 13];
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function auInit() {
    if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { AU.ctx = new AC(); } catch (e) { return false; }
    const c = AU.ctx;
    AU.master = c.createGain(); AU.master.gain.value = AU.vol; AU.master.connect(c.destination);
    AU.music = c.createGain(); AU.music.gain.value = AU.on.music ? MUSIC_GAIN : 0; AU.music.connect(AU.master);
    AU.sfx = c.createGain(); AU.sfx.gain.value = AU.on.sfx ? SFX_GAIN : 0; AU.sfx.connect(AU.master);
    AU.delay = c.createDelay(1); AU.delay.delayTime.value = STEP * 3;
    const fb = c.createGain(); fb.gain.value = 0.3; const wet = c.createGain(); wet.gain.value = 0.32;
    AU.delay.connect(fb); fb.connect(AU.delay); AU.delay.connect(wet); wet.connect(AU.music);
    const b = c.createBuffer(1, Math.floor(c.sampleRate * 0.4), c.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    AU.noise = b;
    if (AU.on.music) musicStart();
    return true;
  }
  function env(g, t, peak, a, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  function osc(type, f, t, dur, dest) { const o = AU.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o; }
  function voice(type, f, t, dur, peak, dest, slideTo) { const g = AU.ctx.createGain(); env(g, t, peak, 0.008, dur); g.connect(dest || AU.sfx); const o = osc(type, f, t, dur, g); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur); return g; }
  const SFX = {
    click: (t) => voice('triangle', 1700, t, 0.045, 0.16),
    hover: (t) => voice('sine', 2400, t, 0.03, 0.035),
    open: (t) => voice('sine', 440, t, 0.14, 0.12, null, 880),
    close: (t) => voice('sine', 820, t, 0.12, 0.1, null, 410),
    good: (t) => [784, 988, 1319].forEach((f, i) => voice('sine', f, t + i * 0.07, 0.2, 0.15)),
    bad: (t) => voice('sawtooth', 240, t, 0.24, 0.08, null, 150),
    alert: (t) => { voice('triangle', 880, t, 0.12, 0.13); voice('triangle', 1175, t + 0.13, 0.16, 0.13); },
    fanfare: (t) => [523, 659, 784, 1047].forEach((f, i) => voice('triangle', f, t + i * 0.09, 0.32, 0.14)),
    tick: (t) => voice('sine', 1320, t, 0.03, 0.05),
    dawn: (t) => [262, 392, 523, 659, 784].forEach((f, i) => voice('sine', f, t + i * 0.18, 1.5, 0.12)),
    gloom: (t) => [196, 233, 294].forEach((f, i) => voice('triangle', f, t + i * 0.22, 1.6, 0.1)),
    stamp: (t) => { voice('sine', 170, t, 0.24, 0.42, null, 60); [784, 1047, 1319].forEach((f, i) => voice('triangle', f, t + 0.07 + i * 0.06, 0.5, 0.12)); },
  };
  function sfx(name) { if (!AU.on.sfx || !AU.ctx || AU.ctx.state !== 'running' || !SFX[name]) return; try { SFX[name](AU.ctx.currentTime + 0.005); } catch (e) { /* 忽略 */ } }
  function musicStart() { if (!AU.ctx || AU.timer) return; AU.nextT = AU.ctx.currentTime + 0.1; AU.timer = setInterval(musicTick, 25); }
  function musicStop() { clearInterval(AU.timer); AU.timer = 0; }
  function musicTick() {
    const c = AU.ctx; if (!c || c.state !== 'running') return;
    if (AU.nextT < c.currentTime - 0.2) AU.nextT = c.currentTime + 0.05;  // 分頁在背景時計時器會變慢：跳過錯過的拍子，不要一口氣補播
    while (AU.nextT < c.currentTime + 0.15) { musicStep(AU.step, AU.nextT); AU.nextT += STEP; AU.step++; }
  }
  function musicStep(i, t) {
    const c = AU.ctx; const s16 = i % 16; const bar = Math.floor(i / 16); const ch = PROG[bar % PROG.length]; const run = speed > 0 && !modalOpen;
    if (s16 === 0) {  // 鋪底：每個和弦一小節，兩個略為走音的鋸齒波穿過低通濾波器
      const dur = STEP * 16; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.6;
      f.frequency.setValueAtTime(480, t); f.frequency.linearRampToValueAtTime(1050, t + dur * 0.5); f.frequency.linearRampToValueAtTime(560, t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045, t + 0.9); g.gain.setValueAtTime(0.045, t + dur - 0.5); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
      f.connect(g); g.connect(AU.music);
      ch.slice(1).forEach((m) => [-7, 7].forEach((det) => { const o = osc('sawtooth', hz(m), t, dur + 0.7, f); o.detune.value = det; }));
    }
    if (s16 === 0 || s16 === 7 || s16 === 10) { const g = c.createGain(); env(g, t, 0.12, 0.02, STEP * 5); g.connect(AU.music); osc('triangle', hz(ch[0] - 12), t, STEP * 5, g); }
    if (ARP.indexOf(s16) >= 0) { const g = c.createGain(); env(g, t, run ? 0.055 : 0.035, 0.01, 0.5); g.connect(AU.music); g.connect(AU.delay); osc('triangle', hz(ch[1 + ((i >> 1) + bar) % (ch.length - 1)] + 12), t, 0.5, g); }
    if (!run) return;
    if (s16 === 0 || s16 === 8) { const g = c.createGain(); env(g, t, 0.3, 0.005, 0.26); g.connect(AU.music); const o = osc('sine', 110, t, 0.28, g); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); }
    if (s16 % 4 === 2 || (speed >= 3 && s16 % 2 === 1)) {
      const src = c.createBufferSource(); src.buffer = AU.noise; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7200;
      const g = c.createGain(); g.gain.setValueAtTime(s16 % 4 === 2 ? 0.045 : 0.022, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(f); f.connect(g); g.connect(AU.music); src.start(t); src.stop(t + 0.06);
    }
  }
  function setMusic(on) {
    AU.on.music = on; setUiPref('music', on);
    if (!AU.ctx) auInit();
    if (AU.music) AU.music.gain.setTargetAtTime(on ? MUSIC_GAIN : 0, AU.ctx.currentTime, 0.4);
    if (on) musicStart(); else setTimeout(() => { if (!AU.on.music) musicStop(); }, 1600);
    if (G) renderHud();
  }
  function setSfx(on) { AU.on.sfx = on; setUiPref('sfx', on); if (AU.sfx) AU.sfx.gain.value = on ? SFX_GAIN : 0; if (on) sfx('good'); }
  function setVol(v) { AU.vol = v; setUiPref('vol', v); if (AU.master) AU.master.gain.setTargetAtTime(v, AU.ctx.currentTime, 0.05); }
  function firstGesture() { auInit(); window.removeEventListener('pointerdown', firstGesture, true); window.removeEventListener('keydown', firstGesture, true); }
  window.addEventListener('pointerdown', firstGesture, true); window.addEventListener('keydown', firstGesture, true);

  /* ================= 數字回饋：頂部資源變動時滾動數字、閃一下，現金增減浮出提示 ================= */
  const REDUCE = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let hudPrev = null; let hudWeek = -1; let tickAt = 0;
  // 每週進度條：時間在跑時，日期下面的細條從 0 填到滿，代表離下一週還有多久（重畫時用負的延遲接上原本的進度）
  function wkBar() {
    if (!speed || modalOpen) return '<i class="wkbar" aria-hidden="true"></i>';
    const d = SPEEDS[speed]; const el = Math.min(d, Math.max(0, performance.now() - tickAt));
    return `<i class="wkbar on" aria-hidden="true"><i style="animation-duration:${d}ms;animation-delay:-${Math.round(el)}ms"></i></i>`;
  }
  const HUDF = { cash: (v) => money(v), rp: (v) => num(v), gpu: (v) => num(v), best: (v) => (v ? v.toFixed(1) : '—'), rep: (v) => String(Math.round(v)), val: (v) => money(v) };
  function tweenHud(el, cur) {
    const prev = hudPrev; hudPrev = cur; if (!prev) return;
    for (const k in cur) {
      const a = prev[k], b = cur[k]; if (a === b || !isFinite(a) || !isFinite(b)) continue;
      const span = el.querySelector(`[data-k="${k}"]`); if (!span) continue;
      const dd = span.closest('dd'); if (dd) dd.classList.add(b > a ? 'bump-up' : 'bump-down');
      if (k === 'cash') deltaFloat(span, b - a);
      if (REDUCE()) continue;
      const t0 = performance.now(), D = 480, f = HUDF[k];
      const run = (now) => { const q = Math.min(1, (now - t0) / D); const e = 1 - Math.pow(1 - q, 3); span.textContent = f(a + (b - a) * e); if (q < 1 && span.isConnected) requestAnimationFrame(run); };
      span.textContent = f(a); requestAnimationFrame(run);
    }
  }
  function deltaFloat(anchor, d) {
    if (!d || Math.abs(d) < 1) return;
    const r = anchor.getBoundingClientRect(); if (!r.width) return;
    const f = document.createElement('div'); f.className = 'delta-float' + (d < 0 ? ' neg' : ''); f.setAttribute('aria-hidden', 'true');
    f.textContent = (d > 0 ? '+' : '−') + money(Math.abs(d));
    f.style.left = Math.round(r.left) + 'px'; f.style.top = Math.round(r.bottom + 2) + 'px';
    document.body.appendChild(f); setTimeout(() => f.remove(), 1400);
  }

  const PAUSE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="5" height="16"/><rect x="14" y="4" width="5" height="16"/></svg>';
  const PLAY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>';
  const BARCODE = '<svg class="barcode" width="96" height="16" viewBox="0 0 96 16" aria-hidden="true"><g fill="#111318">' + [0, 2, 4, 1, 7, 3, 12, 1, 15, 2, 19, 1, 22, 4, 28, 1, 31, 2, 35, 1, 38, 3, 43, 1, 46, 1, 49, 2, 53, 4, 59, 1, 62, 2, 66, 1, 69, 3, 74, 1, 77, 2, 81, 1, 84, 3, 89, 1, 92, 2].reduce((o, v, i, a) => (i % 2 ? o : o + `<rect x="${v}" width="${a[i + 1]}" height="16"/>`), '') + '</g></svg>';

  /* ================= 小工具 ================= */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (x, d) => (x * 100).toFixed(d || 0) + '%';
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  function sci(x) { if (!x || x <= 0) return '0'; const e = Math.floor(Math.log10(x)); const m = x / Math.pow(10, e); return m.toFixed(1) + '×10' + String(e).split('').map((c) => (c === '-' ? '⁻' : SUP[+c])).join(''); }
  function store(val) { try { if (val === undefined) return localStorage.getItem(SAVE_KEY); if (val === null) localStorage.removeItem(SAVE_KEY); else localStorage.setItem(SAVE_KEY, val); } catch (e) { return null; } return null; }
  function toast(msg, bad) {
    const t = document.getElementById('toasts'); if (!t) return;
    sfx(bad ? 'bad' : 'good');
    const el = document.createElement('div'); el.className = 'toast' + (bad ? ' bad' : ''); el.textContent = msg; t.appendChild(el);
    setTimeout(() => el.remove(), bad ? 4200 : 2800);
    while (t.children.length > 3) t.firstChild.remove();
  }
  function wkLabel(w) { const d = ME.weekDate(w); return String(d.getUTCFullYear()).slice(2) + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + ' W' + (Math.floor((d.getUTCDate() - 1) / 7) + 1); }
  function statColor(k) { return (D.STATS[k] || {}).color || 'var(--accent)'; }
  function priceTier(id) { return D.PRICE_TIERS.find((p) => p.id === id) || D.PRICE_TIERS[2]; }
  function catName(c) { return { talent: '人才', compute: '算力', data: '資料', market: '市場', capital: '資本', safety: '安全事故', research: '研究', regulation: '監管', fun: '趣聞', race: 'AGI 競賽' }[c] || '事件'; }
  function mascot() { return G ? G.mascot() : D.MASCOTS.find((m) => m.id === titleSel.mascot); }
  function frontierStats() {
    const fr = {}; for (const k of D.STAT_ORDER) fr[k] = 0;
    for (const rid in G.s.rivals) for (const m of G.s.rivals[rid].models.slice(-2)) for (const k of D.STAT_ORDER) fr[k] = Math.max(fr[k], m.stats[k] || 0);
    return fr;
  }

  /* ================= 員工座位表：每個人有名字、頭像、職能、能力值 =================
     引擎有 s.people 時直接用；還沒有時，依各職能的人數與平均技能推算出固定的一群人（同一間公司每次看到的都一樣）。 */
  function hashStr(t) { let h = 2166136261; for (const ch of String(t)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const SURN = '林陳王李張黃吳劉蔡楊許鄭謝郭洪曾周沈顧白方陸溫江葉蘇程宋夏唐';
  const GIVEN = ['清源', '長風', '未至', '故知', '觀瀾', '露微', '知行', '聽雪', '聞舟', '初霽', '若川', '思齊', '雨桐', '明遠', '書瑤', '子衡', '以寧', '嘉禾', '星河', '予安', '南喬', '景行', '沐言', '知秋', '懷瑾', '承澤', '安然', '逸塵', '青禾', '遠山'];
  const INTL = ['艾瑪·羅斯', '諾亞·金', '莉娜·佐藤', '伊森·帕克', '瑪雅·陳', '盧卡·羅西', '索菲亞·李', '奧利佛·王', '阿米爾·汗', '克蘿伊·杜邦', '哈娜·朴', '雷恩·渡邊', '艾莉絲·格林', '馬克斯·穆勒', '莎拉·科恩', '馬特奧·加西亞'];
  const ROLE_COLOR = { res: '#2f6fd6', eng: '#12804f', data: '#b77d00', align: '#7a3fd0', biz: '#d2456f' };
  const ROLE_SHORT = { res: '研究', eng: '工程', data: '資料', align: '對齊', biz: '商務' };
  function personName(r) { return r() < 0.2 ? INTL[Math.floor(r() * INTL.length)] : SURN[Math.floor(r() * SURN.length)] + GIVEN[Math.floor(r() * GIVEN.length)]; }
  function roster() {
    const s = G.s; const out = [];
    for (const x of s.stars || []) out.push({ name: x.name, role: x.role, skill: Math.round(x.skill), face: hashStr(x.id || x.name), star: true, title: x.title });
    const ppl = G.people ? G.people() : (Array.isArray(s.people) ? s.people : null);
    if (ppl && ppl.length) {
      for (const p of ppl) out.push({ id: p.id, name: p.name, g: p.g, role: p.role, skill: Math.round(p.skill), face: p.face != null ? p.face : hashStr(p.id + p.name), joined: p.joined, star: false });
      return out;
    }
    for (const r of D.ROLE_ORDER) {  // 舊版引擎沒有 people 時：依人數與平均技能推算
      const st = s.staff[r]; if (!st) continue;
      for (let i = 0; i < st.n; i++) {
        const seed = hashStr(s.company + '|' + r + '|' + i); const rr = rng(seed);
        out.push({ name: personName(rr), role: r, skill: Math.max(18, Math.min(99, Math.round(st.skill + (rr() - 0.5) * 30))), face: seed, star: false });
      }
    }
    return out;
  }
  function tierOf(sk) {
    if (ME.skillTier) return ME.skillTier(sk);
    return sk >= 82 ? '大神' : sk >= 70 ? '專家' : sk >= 55 ? '資深' : sk >= 40 ? '一般' : '見習';
  }
  let rosterRole = 'all';
  // 程序化 Q 版頭像：膚色、髮型、髮色、眼睛、眼鏡都由種子決定，衣領是職能色
  const SKIN = ['#ffe3d0', '#f9d4bd', '#eec2a3', '#dba582', '#bb8160'];
  const HAIR = ['#2b2a33', '#463026', '#73472a', '#b98450', '#e3c07a', '#5d6fc4', '#c56b8d', '#3c6b59', '#9b9ca7'];
  const EYE = ['#2b2a33', '#36508f', '#5a3a2a', '#2f6b4f', '#6b3a8f'];
  function face(seed, role, size, g) {
    const r = rng(seed); const pick = (a) => a[Math.floor(r() * a.length)];
    const sk = pick(SKIN), hc = pick(HAIR), ec = pick(EYE), glasses = r() < 0.22, rc = ROLE_COLOR[role] || '#2f6fd6';
    const st = g === 'f' ? pick([1, 2, 4, 2]) : g === 'm' ? pick([0, 3, 0]) : Math.floor(r() * 5);
    const back = st === 2 ? `<path d="M12 30Q12 11 32 11Q52 11 52 30L55 60L9 60Z" fill="${hc}"/>` : st === 1 ? `<path d="M11 44Q10 14 32 13Q54 14 53 44L47 44Q46 27 32 25Q18 27 17 44Z" fill="${hc}"/>` : '';
    const front = [
      `<path d="M14 35Q15 15 32 14Q49 15 50 35Q44 24 32 23Q20 24 14 35Z" fill="${hc}"/>`,
      `<path d="M14 33Q16 16 32 15Q48 16 50 33Q41 25 32 26Q23 25 14 33Z" fill="${hc}"/>`,
      `<path d="M15 33Q18 17 32 16Q46 17 49 33Q40 26 32 27Q24 26 15 33Z" fill="${hc}"/>`,
      `<path d="M13 35L17 18L23 24L27 12L33 21L38 11L42 22L48 16L51 35Q44 25 32 24Q20 25 13 35Z" fill="${hc}"/>`,
      `<path d="M14 35Q15 15 32 14Q49 15 50 35Q44 24 32 23Q20 24 14 35Z" fill="${hc}"/><circle cx="32" cy="10" r="7" fill="${hc}"/>`,
    ][st];
    return `<svg class="face" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="32" fill="${rc}" opacity=".16"/>${back}<path d="M17 64Q32 52 47 64Z" fill="${rc}"/><ellipse cx="32" cy="37" rx="17" ry="18" fill="${sk}"/>${front}<ellipse cx="25" cy="39" rx="2.6" ry="3.4" fill="${ec}"/><ellipse cx="39" cy="39" rx="2.6" ry="3.4" fill="${ec}"/><circle cx="26" cy="37.6" r=".9" fill="#fff"/><circle cx="40" cy="37.6" r=".9" fill="#fff"/><ellipse cx="21" cy="45" rx="3" ry="1.5" fill="#ff8f9c" opacity=".45"/><ellipse cx="43" cy="45" rx="3" ry="1.5" fill="#ff8f9c" opacity=".45"/><path d="M29 47.5q3 2.4 6 0" stroke="#8a4434" stroke-width="1.5" fill="none" stroke-linecap="round"/>${glasses ? '<g stroke="#2b2a33" stroke-width="1.3" fill="none"><circle cx="25" cy="39" r="5"/><circle cx="39" cy="39" r="5"/><path d="M30 39h4"/></g>' : ''}</svg>`;
  }
  const BOLT = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>';
  // 座位表：公司 40 人以內全部列出；超過就加職級分布條，頭像依排序分頁，一次只畫 40 張（辦公室最大可到 2,500 人）
  const ROSTER_PAGE = 40;
  const TIERS = ['見習', '一般', '資深', '專家', '大神'];
  const TIER_COLOR = ['#c3d5f4', '#93b4ec', '#5d8de0', '#2f6fd6', '#183f87'];  // 同一色相由淺到深
  const ROSTER_SORTS = [['focus', '焦點'], ['role', '職能'], ['recent', '新進']];
  let rosterSort = 'focus'; let rosterPage = 0;
  function tierBarHTML(list) {
    const n = TIERS.map((t) => list.filter((p) => tierOf(p.skill) === t).length); const tot = list.length || 1;
    return `<div class="tierbar"><div class="bar">${n.map((c, i) => c ? `<i style="flex:${c};background:${TIER_COLOR[i]}" title="${TIERS[i]} ${c} 人（${Math.round(c / tot * 100)}%）"></i>` : '').join('')}</div>
      <div class="lg">${n.map((c, i) => `<span style="--c:${TIER_COLOR[i]}">${TIERS[i]}<b>${num(c)}</b></span>`).join('')}<span class="avg">平均技能<b>${list.length ? Math.round(list.reduce((a, p) => a + p.skill, 0) / list.length) : '—'}</b></span></div></div>`;
  }
  function rosterHTML() {
    const all = roster(); const s = G.s; const big = all.length > ROSTER_PAGE;
    const isNew = (p) => p.joined > 0 && s.week - p.joined < 4;  // 第 0 週進來的是創始成員，不算新人
    const byRole = (a, b) => D.ROLE_ORDER.indexOf(a.role) - D.ROLE_ORDER.indexOf(b.role);
    const SORT = {
      focus: (a, b) => (b.star - a.star) || (isNew(b) - isNew(a)) || (b.skill - a.skill) || byRole(a, b),
      role: (a, b) => (b.star - a.star) || byRole(a, b) || (b.skill - a.skill),
      recent: (a, b) => (b.star - a.star) || ((b.joined || 0) - (a.joined || 0)) || (b.skill - a.skill),
    };
    const list = (rosterRole === 'all' ? all : all.filter((p) => p.role === rosterRole)).slice().sort(SORT[rosterSort] || SORT.focus);
    const pages = Math.max(1, Math.ceil(list.length / ROSTER_PAGE)); rosterPage = Math.max(0, Math.min(rosterPage, pages - 1));
    const shown = list.slice(rosterPage * ROSTER_PAGE, (rosterPage + 1) * ROSTER_PAGE);
    const chips = [['all', '全部 ' + num(all.length)]].concat(D.ROLE_ORDER.map((r) => [r, ROLE_SHORT[r] + ' ' + num(G.roleHeads(r))]));
    const desk = (p) => {
      const tip = esc(p.name) + ' · ' + esc(D.ROLES[p.role] ? D.ROLES[p.role].name : '') + ' · 技能 ' + p.skill + (p.joined === 0 ? ' · 創始成員' : p.joined != null ? ' · ' + esc(ME.dateLabel(p.joined)) + ' 入職' : '');
      return `<div class="desk${p.star ? ' star' : ''}" title="${tip}">${isNew(p) ? '<span class="new">新人</span>' : ''}${p.id != null ? `<button type="button" class="x" data-act="fire-person" data-id="${p.id}" aria-label="裁員：${esc(p.name)}">×</button>` : ''}${face(p.face, p.role, 56, p.g)}<b>${esc(p.name).replace(/·/g, '·<wbr>')}</b><span class="rl" style="color:${ROLE_COLOR[p.role] || 'inherit'}">${p.star ? esc(p.title || '明星') : esc(ROLE_SHORT[p.role] || '') + '・' + esc(tierOf(p.skill))}</span><span class="sk">${BOLT}${p.skill}</span></div>`;
    };
    const pager = pages > 1 ? `<div class="pager"><button class="btn sm" data-act="roster-page" data-v="-1"${rosterPage ? '' : ' disabled'} aria-label="上一頁">‹</button><span>第 ${rosterPage * ROSTER_PAGE + 1}–${rosterPage * ROSTER_PAGE + shown.length} 位，共 ${num(list.length)} 位</span><button class="btn sm" data-act="roster-page" data-v="1"${rosterPage < pages - 1 ? '' : ' disabled'} aria-label="下一頁">›</button></div>` : '';
    return `<div class="card roster" style="margin-top:12px"><h3>座位表 <span class="right small muted">滑過頭像看入職日期</span></h3>
      <div class="roster-bar"><div class="chips">${chips.map(([k, t]) => `<button class="${rosterRole === k ? 'on' : ''}" data-act="roster-role" data-v="${k}">${t}</button>`).join('')}</div>
        ${big ? `<div class="chips sort"><span class="small muted">排序</span>${ROSTER_SORTS.map(([k, t]) => `<button class="${rosterSort === k ? 'on' : ''}" data-act="roster-sort" data-v="${k}">${t}</button>`).join('')}</div>` : ''}</div>
      ${big && list.length ? tierBarHTML(list) : ''}
      ${shown.length ? `<div class="desks">${shown.map(desk).join('')}</div>` : '<p class="small muted" style="margin:0">這個職能還沒有人。</p>'}
      ${pager}</div>`;
  }

  /* ================= 啟動 ================= */
  function start(hot) {
    if (hot && hot.save) { try { G = Game.load(hot.save); tab = hot.tab || 'home'; showGame(); return; } catch (e) { /* 忽略 */ } }
    showTitle();
  }
  if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
    try { window.claude.hot.snapshot(() => ({ save: G && !G.s.ended ? G.serialize() : null, tab })); } catch (e) { /* 忽略 */ }
  }

  /* ================= 標題畫面 ================= */
  function showTitle() {
    stopLoop(); G = null; modalOpen = false;
    const saved = store();
    let savedInfo = '';
    if (saved) { try { const s = JSON.parse(saved); savedInfo = esc(s.company) + ' · ' + ME.dateLabel(s.week); endRecord(s); } catch (e) { savedInfo = ''; } }
    const cities = D.CITIES || [];
    if (cities.length && !cities.some((c) => c.id === titleSel.city)) titleSel.city = D.DEFAULT_CITY || cities[0].id;
    // 方案 H：白色展台。選中的吉祥物站在中央圓台上
    root.innerHTML = `
    <div class="title-screen">
      <div class="bg" aria-hidden="true"><img src="assets/bg_studio.webp" alt=""></div>
      <div class="title-wrap">
        <section class="title-hero">
          <div class="title-top"><div class="brand-bar"><i></i>MODEL EMPIRE</div>${langSwitch()}</div>
          <div class="hero-text">
            <div class="logo-en">AI LAB TYCOON · 2023–2035</div>
            <h1 class="logo">模型<span>帝國</span></h1>
            <p class="title-sub">2023 年 1 月，你帶著一筆種子輪和 64 張舊卡，創立了一家大模型公司。設計模型配方、搶算力、挖人才、跟六家對手搶排行榜與市佔——最後比的是誰先<b>安全</b>抵達 AGI，而對手也可能搶先。</p>
            <div class="title-kpis"><span>時間軸 <b>2023–2035</b></span><span>對手 <b>6 家</b></span><span>科技 <b>${D.TECHS.length} 項</b></span><span>市場 <b>${D.SEG_ORDER.length} 個</b></span><span>結局 <b>${Object.keys(D.ENDINGS).length} 種</b></span></div>
            <div class="btn-row">
              ${saved ? `<button class="pill-btn dark" data-act="continue">繼續遊戲 <small>${savedInfo}</small></button>` : ''}
              <button class="pill-btn" data-act="help">玩法說明</button>
              <button class="pill-btn" data-act="import">匯入存檔</button>
              <button class="pill-btn" data-act="codex" data-tab="timeline">史料庫</button>
              <button class="pill-btn" data-act="endbook">結局圖鑑 <small>${endCount()} / ${Object.keys(D.ENDINGS).length}</small></button>
            </div>
          </div>
        </section>
        ${heroCharHTML()}
        <section class="setup">
          <div class="card">
            <h3>創立公司 <span class="tag k-info">NEW GAME</span></h3>
            <div class="field"><label for="f-co">公司名稱</label><input type="text" id="f-co" maxlength="16" value="${esc(ZH.t(DEFAULT_CO))}"></div>
            <div class="field"><label for="f-series">模型系列名（會變成 系列名-1、-2…）</label><input type="text" id="f-series" maxlength="12" value="Whale"></div>
            ${cities.length ? `<div class="field"><label>總部城市</label><div class="cities" role="radiogroup" aria-label="總部城市">${cities.map((c) => `<button type="button" class="city${c.id === titleSel.city ? ' on' : ''}" data-act="pick-city" data-id="${esc(c.id)}" role="radio" aria-checked="${c.id === titleSel.city}" title="${esc(c.name + (c.en ? ' · ' + c.en : ''))}"><span class="em">${c.icon || '🏙️'}</span><b>${esc(c.name)}</b></button>`).join('')}</div><div class="perks" id="city-perks">${cityPerksHTML(titleSel.city)}</div></div>` : ''}
            <div class="field"><label>AI 夥伴</label><div class="mascots">${D.MASCOTS.map((m) => `<button type="button" class="${m.id === titleSel.mascot ? 'on' : ''}" data-act="pick-mascot" data-id="${m.id}" aria-label="${m.name}（${m.role}）"><img src="${m.avatar}" alt="" width="42" height="42" loading="lazy"><span>${m.name}</span></button>`).join('')}</div></div>
          </div>
          <div class="card">
            <h3>選擇開局</h3>
            <div class="scen-list">${D.SCENARIOS.map((s) => { const lv = { 簡單: 1, 標準: 2, 困難: 3 }[s.diff] || 2; return `<button type="button" class="scen d${lv} ${s.id === titleSel.scenario ? 'on' : ''}" data-act="pick-scen" data-id="${s.id}"><span class="ic">${s.icon}</span><b>${s.name}</b><span class="diff" aria-label="難度：${s.diff}">${'★'.repeat(lv)}<i>${'★'.repeat(3 - lv)}</i> ${s.diff}</span><p>${s.desc}</p></button>`; }).join('')}</div>
          </div>
          <button class="pill-btn neon" data-act="new-game">創立公司，開始！<span class="go">${PLAY}</span></button>
        </section>
      </div>
    </div>
    <div id="modal-root"></div><div class="toasts" id="toasts"></div>`;
  }
  function heroCharHTML() {
    const m = D.MASCOTS.find((x) => x.id === titleSel.mascot) || D.MASCOTS[0];
    return `<figure class="hero-char" id="hero-char"><img src="${m.img}" alt="${esc(m.name)}，${esc(m.role)}" width="581" height="900"><figcaption><b style="color:${m.color}">${esc(m.name)}</b> · ${esc(m.role)}<br>${esc(m.bio)}${m.credit ? `<span class="credit">${esc(m.credit)} · <button type="button" class="link" data-act="credits">出處</button></span>` : ''}</figcaption></figure>`;
  }
  function drawHero() {
    cancelAnimationFrame(heroRAF);
    const cv = document.getElementById('hero-canvas'); if (!cv) return;
    const ctx = cv.getContext('2d');
    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue('--accent').trim() || '#0d7680';
    const line = css.getPropertyValue('--line').trim() || '#d5dee3';
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const curves = [0.34, 0.3, 0.27, 0.24, 0.21].map((a, i) => ({ a, e: 1.66 + i * 0.05, o: i }));
    const Lof = (c, x) => c.e + c.a * 4 / Math.pow(1 + x * 60, 0.55);
    let Lhi = -Infinity, Llo = Infinity; curves.forEach((c) => { Lhi = Math.max(Lhi, Lof(c, 0)); Llo = Math.min(Llo, Lof(c, 1)); });
    let t0 = performance.now();
    function frame(now) {
      const w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
      const dpr = window.devicePixelRatio || 1; if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.globalAlpha = 0.6;
      const x0 = w < 700 ? w * 0.08 : w * 0.6; const top = w < 700 ? h * 0.62 : h * 0.12; const ht = w < 700 ? h * 0.34 : h * 0.76;
      for (let gy = 0; gy < 6; gy++) { const y = top + gy * (ht / 5); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(w - 12, y); ctx.stroke(); }
      const prog = reduce ? 1 : Math.min(1, ((now - t0) / 2600));
      curves.forEach((c, i) => {
        ctx.beginPath(); ctx.globalAlpha = 0.22 + i * 0.16; ctx.strokeStyle = accent; ctx.lineWidth = 1.4 + i * 0.35;
        const n = 120; const upto = Math.max(2, Math.floor(n * prog));
        for (let k = 0; k < upto; k++) {
          const x = k / (n - 1); const D0 = 1 + x * 60;
          const L = Lof(c, x) + (reduce ? 0 : 0.01 * Math.sin((k + now / 90) * 0.9 + i) * (1 - x)); void D0;
          const px = x0 + x * (w - 12 - x0); const py = top + ((Lhi - L) / (Lhi - Llo)) * ht;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      if (!reduce) heroRAF = requestAnimationFrame(frame);
    }
    heroRAF = requestAnimationFrame(frame);
  }

  /* ================= 主框架 ================= */
  const TABS = [
    { id: 'home', t: '大廳', en: 'LOBBY' }, { id: 'models', t: '研發', en: 'R&D' }, { id: 'tech', t: '科技', en: 'TECH' }, { id: 'team', t: '團隊', en: 'TEAM' },
    { id: 'compute', t: '算力', en: 'COMPUTE' }, { id: 'data', t: '資料', en: 'DATA' }, { id: 'market', t: '市場', en: 'MARKET' }, { id: 'finance', t: '資本', en: 'CAPITAL' },
    { id: 'report', t: '報表', en: 'REPORT' },
  ];
  // 大廳背景（bg_hall.webp，2400×1350）裡圓環的位置。標註用的 svg 以 slice 對齊 object-fit: cover，任何螢幕比例都會疊在圓環上
  const RING = { cx: 1200, cy: 537, r: 393 };
  function showGame() {
    cancelAnimationFrame(heroRAF); hudPrev = null; hudWeek = -1; lastTab = null;
    seedRevHist(); rankPrev = null; logSeen = null;
    if (talk.ctl) talk.ctl.abort();
    talk.mid = null; talk.turns = []; talk.sig = '';  // 換存檔或開新局：對話紀錄不跟過去
    const R = RING;
    root.innerHTML = `<div class="stage" id="stage" data-mode="lobby">
      <div class="bg" aria-hidden="true"><img src="assets/bg_studio.webp" alt="">
        <svg class="ring" viewBox="0 0 2400 1350" preserveAspectRatio="xMidYMid slice" fill="none"><circle cx="${R.cx}" cy="${R.cy}" r="${R.r}" stroke="#2639d9" stroke-width="1.8" stroke-dasharray="3 10"/><circle cx="${R.cx}" cy="${R.cy}" r="${R.r + 45}" stroke="#2639d9" stroke-width="1.4" opacity=".5"/><path d="M${R.cx} ${R.cy - R.r - 90}v60M${R.cx} ${R.cy + R.r + 30}v60M${R.cx - R.r - 90} ${R.cy}h60M${R.cx + R.r + 30} ${R.cy}h60" stroke="#2639d9" stroke-width="2"/><path d="M${R.cx - 30} ${R.cy}h60M${R.cx} ${R.cy - 30}v60" stroke="#fff" stroke-width="1.5" opacity=".85"/></svg></div>
      <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
      <figure class="mascot-stage" id="mascot-stage"></figure>
      <header class="hud" id="hud"></header><nav class="nav" id="nav" aria-label="分頁"></nav><main class="main" id="main"></main><section class="chatbox" id="chatbox" aria-label="模型對話"></section><aside class="feed glass" id="feed" aria-label="事件日誌"></aside>
    </div><div id="modal-root"></div><div class="toasts" id="toasts"></div>`;
    renderAll();
    if (G.s.ended) showEnding();
    else if (G.s.week === 0 && !G.s.flags.welcomed) { G.s.flags.welcomed = 1; showWelcome(); }
    else checkPending();
  }
  function renderAll() { renderHud(); renderNav(); renderView(); renderFeed(); }
  function render() {
    renderHud(); renderNav(); renderFeed();
    const act = document.activeElement; const main = document.getElementById('main');
    if (Date.now() < holdUntil) return;
    if (main && act && main.contains(act) && (act.tagName === 'INPUT' || act.tagName === 'SELECT' || act.tagName === 'TEXTAREA')) return;
    renderView();
  }

  function renderStage() {
    const st = document.getElementById('stage'); if (!st || !G) return;
    st.dataset.mode = tab === 'home' ? 'lobby' : 'page';
    const ms = document.getElementById('mascot-stage'); const m = mascot();
    if (ms && ms.dataset.id !== m.id) { ms.dataset.id = m.id; ms.innerHTML = `<img src="${m.img}" alt="${esc(m.name)}，${esc(m.role)}" width="581" height="900">`; }
  }
  function ymDot(w) { const d = ME.weekDate(w); return d.getUTCFullYear() + '.' + String(d.getUTCMonth() + 1).padStart(2, '0'); }
  function serial(name) { return String(Math.abs([...String(name)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % 10000).padStart(4, '0'); }
  function gpuMix() { return G.s.gpus.filter((g) => g.n > 0).slice().sort((a, b) => b.n - a.n); }
  function cityOf() { try { return G.city ? G.city() : null; } catch (e) { return null; } }
  function cityPerkText() { try { return (G.cityPerks ? G.cityPerks() : []).map((p) => p.t).join('、'); } catch (e) { return ''; } }
  function cityPerksHTML(id) {
    const c = (D.CITIES || []).find((x) => x.id === id); if (!c) return '';
    const perks = ME.cityPerks ? ME.cityPerks(c) : [];
    return `${c.desc ? `<p><b>${esc(c.name)}</b>${c.en ? ' · ' + esc(c.en) : ''}：${esc(c.desc)}</p>` : ''}${perks.map((p) => `<span class="pill ${p.good ? 'good' : 'bad'}">${esc(p.t)}</span>`).join('')}`;
  }
  function renderHud() {
    const el = document.getElementById('hud'); if (!el || !G) return;
    const s = G.s; const lw = s.lastWeek || {}; const net = (lw.rev || 0) - (lw.exp || 0);
    const best = G.bestModel(); const bc = best ? G.composite(best.stats) : 0; const rk = G.bestRank();
    const off = D.OFFICES[s.office]; const city = cityOf();
    const mixT = gpuMix().map((g) => ME.GPU[g.type].name + ' ×' + num(g.n)).join('、') || '尚無自有 GPU';
    const fresh = s.log.length && s.log[0].w === s.week;
    el.innerHTML = `
      <div class="id-block">
        <button class="back" data-act="tab" data-id="home">${svg('home', 16)}大廳</button>
        <div class="id-main">
          <div class="id-tag"><span>LAB-${String(s.office + 1).padStart(2, '0')}</span>MODEL EMPIRE · 模型帝國</div>
          <div class="id-name"><h1>${esc(s.company)}</h1><span class="lv">LV.${s.office + 1}</span></div>
          <div class="id-sub"><span>${city && city.id ? `<span title="${esc(cityPerkText())}">${esc(city.name)}</span> · ` : ''}${esc(off.name)} · ${G.totalStaff()}/${G.officeCap()} 人 · ME-${serial(s.company)}</span>${BARCODE}</div>
        </div>
      </div>
      <div class="hud-r">
        <div class="hud-time">
          <div class="date"><b>${ymDot(s.week)}</b><span>${G.endWeek() > ME.TOTAL_WEEKS ? '<i class="hud-extra">延長賽</i>' : ''}WEEK ${s.week} · ${esc(ME.dateLabel(s.week).replace(/^\d+年\d+月\s*/, ''))}</span>${wkBar()}</div>
          <div class="speed glass" role="group" aria-label="時間速度">${[0, 1, 2, 3].map((i) => `<button class="${speed === i ? 'on' : ''}" data-act="speed" data-v="${i}" aria-pressed="${speed === i}" title="${['暫停（空白鍵）', '一般速度（1）', '兩倍速（2）', '四倍速（3）'][i]}">${i ? ['', '1×', '2×', '4×'][i] : PAUSE}</button>`).join('')}</div>
          <button class="icon-btn glass" data-act="open-log" aria-label="情報與事件日誌">${svg('bell')}${fresh ? '<span class="dot"></span>' : ''}</button>
          <button class="icon-btn glass ${AU.on.music ? '' : 'off'}" data-act="music" aria-pressed="${AU.on.music}" aria-label="背景音樂">${svg(AU.on.music ? 'music' : 'mute')}</button>
          <button class="icon-btn glass" data-act="menu" aria-label="選單">${svg('menu')}</button>
        </div>
        <dl class="res glass">
          <div><dt>CASH · 現金</dt><dd class="${s.cash < 0 ? 'bad' : ''}"><span data-k="cash">${money(s.cash)}</span><small class="${net < 0 ? 'bad' : ''}">${net >= 0 ? '+' : ''}${money(net)}/週</small>${sparkSVG(revHist)}</dd></div>
          <div><dt>RP · 研究點</dt><dd><span data-k="rp">${num(s.rp)}</span><small>+${Math.round(lw.rp || 0)}</small></dd></div>
          <div title="${esc(mixT)}"><dt>GPU · 算力</dt><dd><span data-k="gpu">${num(G.cardCount())}</span><small>≈${num(G.ownedEq())} H100${lw.rentEq ? ' · 租 ' + num(lw.rentEq) : ''}</small></dd></div>
          <div class="opt"><dt>BEST · 最佳模型</dt><dd><span data-k="best">${bc ? bc.toFixed(1) : '—'}</span><small>${bc ? '#' + rk : ''}</small></dd></div>
          <div class="opt"><dt>REP · 聲望</dt><dd><span data-k="rep">${Math.round(s.rep)}</span><small class="${s.reg >= 40 ? 'bad' : ''}">監管 ${Math.round(s.reg)}</small></dd></div>
          <div class="opt"><dt>VAL · 估值</dt><dd><span data-k="val">${money(s.valuation)}</span><small>持股 ${pct(s.equity)}</small></dd></div>
        </dl>
      </div>`;
    tweenHud(el, { cash: s.cash, rp: s.rp, gpu: G.cardCount(), best: bc, rep: s.rep, val: s.valuation });
    if (hudWeek !== -1 && hudWeek !== s.week) { const d = el.querySelector('.date'); if (d) d.classList.add('tick'); }
    hudWeek = s.week;
  }
  function attention() {
    const s = G.s; const a = {};
    if (s.models.some((m) => !m.rel)) a.models = 1;
    if (techStartable().length) a.tech = 1;
    if (s.starPool.length) a.team = 1;
    if (inferGap()) a.compute = 1;
    if (G.roundReady().ok) a.finance = 1;
    if ((s.rfps || []).length) a.market = 1;
    return a;
  }
  function totalShare() { let a = 0, t = 0; for (const k of D.SEG_ORDER) { if (!G.segActive(k)) continue; const v = G.segValue(k); a += G.playerShare(k) * v; t += v; } return t ? a / t : 0; }
  function bestSeg() { let b = null, bs = 0; for (const k of D.SEG_ORDER) { if (!G.segActive(k)) continue; const sh = G.playerShare(k); if (sh > bs) { bs = sh; b = k; } } return b ? D.SEGMENTS[b].name + ' ' + pct(bs, 1) : '還沒進入任何市場'; }
  function renderNav() {
    const el = document.getElementById('nav'); if (!el || !G) return;
    const a = attention();
    const att = (id) => (a[id] ? '<span class="att" aria-label="有待處理"></span>' : '');
    if (tab !== 'home') {  // 分頁：左側欄（手機是底部分頁列）
      el.innerHTML = `<div class="rail">${TABS.map((t) => `<button class="${tab === t.id ? 'on' : ''}" data-act="tab" data-id="${t.id}" aria-current="${tab === t.id ? 'page' : 'false'}"><span class="ib">${svg(t.id, 17)}</span><b>${t.t}</b><span class="en">${t.en}</span>${att(t.id)}</button>`).join('')}</div>`;
      return;
    }
    // 大廳：右側懸浮選單，每塊磚直接顯示即時狀態
    const s = G.s; const job = s.jobs.find((j) => j.kind === 'train'); const prog = job ? Math.min(1, job.done / job.total) : 0;
    const unrel = s.models.filter((m) => !m.rel).length;
    const best = G.bestModel(); const bc = best ? G.composite(best.stats) : 0; const F = G.frontierComp();
    const nTech = techStartable().length; const nDoing = techJobs().length;
    const toks = D.MIX_KEYS.reduce((x, k) => x + (s.data[k] ? s.data[k].amt : 0), 0);
    const mini = (id, no, t, en, sub, actAttr) => `<button class="tile mini" ${actAttr || `data-act="tab" data-id="${id}"`}><span class="ib">${svg(id, 18)}</span><span style="min-width:0"><span class="no" style="display:block">${no} ${en}</span><strong>${t}</strong><span class="sub" style="display:block">${sub}</span></span>${att(id)}</button>`;
    el.innerHTML = `<div class="tiles">
      <button class="tile prime" data-act="tab" data-id="models">
        <span class="no">01 / RESEARCH &amp; DEVELOPMENT</span>${svg('models', 34, 'ico-r')}
        <span class="hd"><strong>研發</strong><span>${job ? esc(job.spec.name) + ' 訓練中' : unrel ? unrel + ' 個模型等待發布' : '目前沒有訓練'}</span></span>
        ${job ? `<span class="prog"><span class="seg-bar" role="progressbar" aria-label="訓練進度" aria-valuenow="${Math.round(prog * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${(prog * 100).toFixed(1)}%"></i></span><b>${pct(prog)}</b></span>` : ''}
        <span class="meta">${best ? '最佳 ' + esc(best.name) + ' ' + bc.toFixed(1) + ' · 前沿 ' + F.toFixed(1) : '前沿 ' + F.toFixed(1) + ' · 先立項第一個模型'}</span>${att('models')}
      </button>
      <button class="tile" data-act="tab" data-id="market"><span class="no">02 / MARKET</span>${svg('market', 19, 'ico-r')}<span class="hd"><strong>市場</strong><span class="v">${pct(totalShare(), 1)}</span></span><span class="sub" style="display:block">${liveLine() || esc(bestSeg())}</span>${att('market')}</button>
      <button class="tile" data-act="tab" data-id="finance"><span class="no">03 / CAPITAL</span>${svg('finance', 19, 'ico-r')}<span class="hd"><strong>資本</strong><span class="v">${money(s.valuation)}</span></span><span class="sub" style="display:block">持股 ${pct(s.equity)} · ${G.roundReady().ok ? '可以募資' : '現金 ' + money(s.cash)}</span>${att('finance')}</button>
      ${mini('tech', '04', '科技', 'TECH', nTech ? nTech + ' 項可研究' : nDoing ? '研究中 ' + nDoing + ' 項' : '研究點 ' + num(s.rp))}
      ${mini('team', '05', '團隊', 'TEAM', G.totalStaff() + ' / ' + G.officeCap() + ' 人')}
      ${mini('compute', '06', '算力', 'COMPUTE', num(G.cardCount()) + ' 張 · ≈' + num(G.ownedEq()))}
      ${mini('data', '07', '資料', 'DATA', '語料 ' + tok(toks))}
      ${mini('report', '08', '報表', 'REPORT', '營收與實力走勢')}
      ${mini('book', '09', '史料', 'CODEX', '真實 AI 史', 'data-act="codex" data-tab="timeline"')}
      <button class="tile strip" data-act="tab" data-id="market"><span class="hz" aria-hidden="true"></span><span class="no">RANKING · 排行榜</span><b>${best ? esc(best.name) + '　#' + G.bestRank() + ' · ' + bc.toFixed(1) : '尚未上榜'}</b><span class="x">${best ? '距前沿 ' + Math.max(0, F - bc).toFixed(1) : '發布模型就會上榜'}</span>${svg('arrow')}</button>
    </div>`;
  }
  // 事件日誌。k='real' 是真實 AI 史新聞（📜 開頭），h 指向 ME_HISTORY 的史料，可以點進史料庫
  const KTAG = { good: '好消息', bad: '警示', rival: '對手', ach: '成就', news: '新聞', real: '史實', buzz: '評論', quest: '任務' };
  function logList(n) { return G.s.log.filter((e) => (e.k === 'real' ? showReal && logFilter !== 'game' : logFilter !== 'real')).slice(0, n || 70); }
  function feedHTML(n) {
    return `<div class="log">${logList(n).map((e) => {
      const real = e.k === 'real'; const t = real ? String(e.t).replace(/^📜\s*/, '') : e.t; const tg = KTAG[e.k];
      const inner = `<span class="w">${wkLabel(e.w)}</span><span class="t">${tg ? `<span class="tag k-${e.k}">${tg}</span>` : ''}${real && e.local ? '<span class="tag k-local">本地</span>' : ''}${esc(t)}</span>`;
      return real && e.h ? `<button type="button" class="e real" data-act="hist" data-id="${esc(e.h)}" title="在史料庫查看這則史料">${inner}</button>` : `<div class="e ${e.k || ''}">${inner}</div>`;
    }).join('') || '<p class="small muted" style="margin:6px 4px">沒有符合的紀錄。</p>'}</div>`;
  }
  function logControls() {
    return `<div class="seg-ctl" role="group" aria-label="日誌分類">${[['all', '全部'], ['game', '公司'], ['real', '史實']].map(([k, t]) => `<button class="${logFilter === k ? 'on' : ''}" data-act="log-filter" data-v="${k}" aria-pressed="${logFilter === k}">${t}</button>`).join('')}</div>`;
  }
  function renderFeed() {
    const el = document.getElementById('feed'); if (!el || !G) return;
    const lobby = tab === 'home';
    el.innerHTML = `<div class="fh"><h2>${lobby ? 'INTEL · 情報' : 'LOG · 事件日誌'}</h2>${logControls()}</div>${feedHTML(lobby ? 3 : 80)}
      <div class="ff"><label class="toggle"><input type="checkbox" data-act="log-real" ${showReal ? 'checked' : ''}> 顯示史實新聞</label>${lobby ? '<button class="btn sm" data-act="open-log">全部日誌</button>' : ''}</div>`;
    layoutChatbox(); watchLog();
  }
  function showLog() { openModal({ title: '情報與事件日誌', cls: 'mid', body: '<div id="logm"></div>' }); renderLogModal(); }
  function renderLogModal() {
    const el = document.getElementById('logm'); if (!el || !G) return;
    el.innerHTML = `<div class="row" style="margin-bottom:8px">${logControls()}<span class="spacer"></span><label class="toggle small"><input type="checkbox" data-act="log-real" ${showReal ? 'checked' : ''}> 顯示史實新聞</label></div>${feedHTML(300)}`;
  }
  function openHist(id) {
    codexState.tab = 'timeline'; codexState.cat = 'all'; codexState.q = ''; codexState.focus = id;
    if (modalOpen) closeModal(true);
    pauseForModal(); showCodex('timeline');
  }
  function renderView() {
    const el = document.getElementById('main'); if (!el || !G) return;
    renderStage();
    const f = VIEWS[tab] || VIEWS.home; const y = el.scrollTop;
    const i = TABS.findIndex((t) => t.id === tab);
    el.dataset.tab = tab;  // 每頁的代表色，見 style.css 的 [data-tab]
    el.innerHTML = f().replace('<div class="view-head"><h2>', `<div class="view-head"><span class="vh-ic" aria-hidden="true">${svg(tab, 28)}</span><h2 data-no="${String(i).padStart(2, '0')} / ${i >= 0 ? TABS[i].en : ''}">`);
    sayHead(el); glossify(el);
    if (tab === 'market') gbMount();
    el.scrollTop = y;
    if (lastTab !== tab) { lastTab = tab; el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); el.addEventListener('animationend', () => el.classList.remove('enter'), { once: true }); }
    syncChatbox(); layoutChatbox(); scheduleTour();
  }
  let lastTab = null;
  // 頁首的頁面說明改由 AI 夥伴來講：頭像＋對話泡泡
  function sayHead(el) {
    const p = el.querySelector('.view-head > p'); if (!p || el.querySelector('.advisor')) return;  // 報表頁已有顧問卡
    const m = mascot(); const w = document.createElement('div'); w.className = 'vh-say';
    w.innerHTML = `<img src="${m.avatar}" alt="${esc(m.name)}" width="40" height="40">`;
    p.replaceWith(w); w.appendChild(p);
  }

  /* ================= 迴圈 ================= */
  function setSpeed(v) {
    speed = v; clearInterval(timer); timer = null;
    if (v > 0) { lastSpeed = v; timer = setInterval(step, SPEEDS[v]); tickAt = performance.now(); }
    renderHud();
  }
  function stopLoop() { clearInterval(timer); timer = null; speed = 0; }
  function step() {
    if (!G || modalOpen) return;
    if (G.s.ended) { setSpeed(0); return; }
    if (G.s.pending.length) { checkPending(); return; }
    const top0 = G.s.log[0]; const y0 = ME.weekDate(G.s.week).getUTCFullYear();
    const fx0 = fxBefore();
    G.tick(); tickAt = performance.now();
    techQueueRun();
    fxAfter(fx0);
    for (const e of G.s.log) { if (e === top0) break; if (e.k === 'ach') { sfx('fanfare'); break; } }
    if (G.s.week % 4 === 0) autosave();
    render();
    if (G.s.ended) { setSpeed(0); autosave(); showEnding(); return; }
    if (ME.weekDate(G.s.week).getUTCFullYear() !== y0) { autosave(); showYearReview(y0); return; }  // 跨年：年度回顧，關掉後再處理待辦事件
    if (G.s.pending.length) checkPending();
  }
  function autosave() { if (G) store(G.serialize()); }
  function pauseForModal() { if (speed > 0) { resumeAfter = true; const v = speed; setSpeed(0); lastSpeed = v; } }
  function maybeResume() { if (resumeAfter && G && !G.s.pending.length && !G.s.ended && !modalOpen) { resumeAfter = false; setSpeed(lastSpeed || 1); } }
  function checkPending() {
    if (!G || modalOpen || !G.s.pending.length) return;
    pauseForModal();
    const p = G.s.pending[0];
    if (p.sys === 'trained') { sfx('fanfare'); showReport(p.model, true); }
    else if (p.sys === 'fail') showEventModal(G.sysView(p), true);
    else if (p.ev === 'race_open' && !G.s.flags.actShown) { G.s.flags.actShown = 1; showChapter(CH_ACT, checkPending); }
    else { const v = G.eventView(p); if (v) showEventModal(v, false); else { G.resolveEvent(0); checkPending(); } }
  }
  // 章節卡：全螢幕過場，點一下或幾秒後自己結束
  const CH_ACT = { cap: 'FINAL ACT', title: '最後一幕', text: '有人快碰到那條線了。從現在起，排行榜不再是重點，誰先抵達 AGI 才是。' };
  const CH_EXTRA = { cap: 'OVERTIME', title: '延長賽', text: '2030 年過去了，還沒有人跨過那條線。接下來每年底可以選擇收手，最晚打到 2035 年底。' };
  let chapterEnd = null; let chapterNext = null;
  function showChapter(c, done) {
    pauseForModal(); modalOpen = true; sfx('gloom');
    const ov = document.createElement('div'); ov.className = 'finale chapter'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', c.title);
    ov.style.setProperty('--fa', '#ff9f5a'); ov.style.setProperty('--fg', '#3f2036');
    ov.innerHTML = `<div class="fn-stage"><section class="fn-scene fn-title on"><div class="fn-date">${fnYM(G.s.week)}</div><div class="fn-cap">${c.cap}</div><h1>${esc(c.title)}</h1><p class="fn-story">${esc(c.text)}</p></section></div>`;
    chapterEnd = () => { clearTimeout(tm); chapterEnd = null; ov.remove(); modalOpen = false; render(); done(); };
    const tm = setTimeout(chapterEnd, REDUCE() ? 1800 : 4500);
    ov.addEventListener('click', () => { if (chapterEnd) chapterEnd(); });
    document.body.appendChild(ov);
  }

  /* ================= 對話框 ================= */
  function openModal(o) {
    const mr = document.getElementById('modal-root'); if (!mr) return;
    modalOpen = true;
    mr.innerHTML = `<div class="modal-bg${FN.ov ? ' over-fn' : ''}" data-bg="1"><div class="modal ${o.cls || ''}" role="dialog" aria-modal="true" aria-label="${esc(o.title || '')}">
      <div class="mh"><h3>${o.title || ''}</h3>${o.closable === false ? '' : '<button class="btn ghost sm x" data-act="close-modal" aria-label="關閉">✕</button>'}</div>
      <div class="mb" id="mb">${o.body || ''}</div>${o.foot ? `<div class="mf" id="mf">${o.foot}</div>` : ''}</div></div>`;
    mr._closable = o.closable !== false; mr._onClose = o.onClose || null;
    const first = mr.querySelector('.mb button, .mb input, .mf button'); if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
    glossify(mr.querySelector('.mb'));
  }
  function closeModal(silent) {
    const mr = document.getElementById('modal-root'); if (!mr) return;
    const cb = mr._onClose; mr.innerHTML = ''; mr._onClose = null; modalOpen = !!FN.ov; wiz = null;
    if (cb && !silent) cb();
    if (!G) return;
    render();
    const after = () => { if (G.s.pending.length) checkPending(); else maybeResume(); };
    if (chapterNext) { const c = chapterNext; chapterNext = null; showChapter(c, after); } else after();
  }
  function confirmBox(title, text, okText, onOk, danger) {
    openModal({ title, body: `<p style="margin:0;font-size:14px;line-height:1.7">${text}</p>`, foot: `<button class="btn" data-act="close-modal">取消</button><button class="btn ${danger ? 'danger' : 'primary'}" data-act="confirm-ok">${okText}</button>` });
    document.getElementById('modal-root')._ok = onOk;
  }

  function showWelcome() {
    const m = mascot();
    openModal({
      title: '歡迎來到模型帝國', cls: 'mid',
      body: `<div class="stack">
        <div class="welcome-hi"><img src="${m.img}" alt="${esc(m.name)}" width="581" height="900"><div class="bubble"><b>${esc(m.name)}</b><span class="small muted"> · ${esc(m.role)}</span><br>老闆好！我是 ${esc(G.s.company)} 的吉祥物兼顧問。${esc(m.bio)}<br><br>時間會一週一週往前走，右上角可以暫停（空白鍵）或加速。</div></div>
        <div class="grid g2">
          <div class="card"><h3>🧪 1. 立項訓練</h3><p class="small muted" style="margin:0">在「研發」設計模型：架構 × 參數 × 資料量 × 資料配比 × 後訓練 × 算力。參數和資料要一起長大（Chinchilla 縮放律），預覽會即時估分。</p></div>
          <div class="card"><h3>🚀 2. 發布賺錢</h3><p class="small muted" style="margin:0">訓練完看評測報告，決定定價、要不要開源。模型在 7 個市場和對手搶市佔；推理要吃算力，算力不夠服務就會掉線。</p></div>
          <div class="card"><h3>🔬 3. 研究與擴張</h3><p class="small muted" style="margin:0">研究點解鎖 MoE、推理 RL、Agent 等 ${D.TECHS.length} 項科技；買卡、蓋機房、招人、募資。世界還沒公開的技術你也能搶先研究，只是更貴。</p></div>
          <div class="card"><h3>🏁 4. 走向結局</h3><p class="small muted" style="margin:0">對手每隔幾個月發布新模型，標竿一直往上移。接近終點時進入 AGI 競賽的最後一幕，對手也可能搶先。2030 年底起，每年底可以選擇收手結算，最晚打到 2035 年底。</p></div>
        </div>
        <p class="small muted" style="margin:0">建議第一步：先到「研發 → 立項新模型」按「智慧建議」，訓練你的第一個 7B 小模型。</p>
      </div>`,
      foot: `<button class="btn" data-act="close-modal">先看看公司</button><button class="btn primary" data-act="welcome-go">去立項第一個模型</button>`,
    });
  }

  /* ---------- 年度回顧：一局八年，每年一章 ---------- */
  function showYearReview(y) {
    const s = G.s; const best = G.bestModel(); const bc = best ? G.composite(best.stats) : 0;
    const ev = s.log.filter((e) => ME.weekDate(e.w).getUTCFullYear() === y && /^(ach|good|bad|rival|real)$/.test(e.k)).slice(0, 7);
    pauseForModal(); sfx('fanfare');
    openModal({
      title: `${y} 年度回顧`, cls: 'mid',
      body: `<div class="stack">
        <p class="year-lead">${esc(s.company)} 走完了${y > 2030 ? '延長賽的第 ' + (y - 2030) + ' 年' : '第 ' + (y - 2022) + ' 年（正規賽共 8 年）'}。進度已自動存檔。</p>
        <div class="grid g2">
          <div class="stat-tile"><span class="l">現金</span><span class="v ${s.cash < 0 ? 'bad' : ''}">${money(s.cash)}</span><span class="s">估值 ${money(s.valuation)} · 持股 ${pct(s.equity)}</span></div>
          <div class="stat-tile"><span class="l">最佳模型</span><span class="v">${bc ? bc.toFixed(1) : '—'}</span><span class="s">${best ? esc(best.name) + ' · 排名 #' + G.bestRank() : '還沒發布模型'} · 前沿 ${G.frontierComp().toFixed(1)}</span></div>
          <div class="stat-tile"><span class="l">總市佔</span><span class="v">${pct(totalShare(), 1)}</span><span class="s">${esc(bestSeg())}</span></div>
          <div class="stat-tile"><span class="l">團隊與算力</span><span class="v">${G.totalStaff()} 人</span><span class="s">${num(G.cardCount())} 張卡 · ≈${num(G.ownedEq())} H100</span></div>
        </div>
        ${ev.length ? `<div><h4 class="sec-title">今年大事</h4><div class="log">${ev.map((e) => { const real = e.k === 'real'; return `<div class="e ${e.k}"><span class="w">${wkLabel(e.w)}</span><span class="t">${KTAG[e.k] ? `<span class="tag k-${e.k}">${KTAG[e.k]}</span>` : ''}${esc(real ? String(e.t).replace(/^📜\s*/, '') : e.t)}</span></div>`; }).join('')}</div></div>` : ''}
      </div>`,
      foot: `<button class="btn primary" data-act="close-modal">邁向 ${y + 1} 年</button>`,
    });
  }

  /* ---------- 事件 ---------- */
  function showEventModal(v, sys) {
    if (!v) return;
    sfx('alert');
    openModal({
      title: esc(v.title), cls: 'mid' + (v.cat === 'race' ? ' ev-race' : ''), closable: false,
      body: `<div class="ev-wrap"><img class="ev-por" src="${mascot().img}" alt="" width="581" height="900"><div>${v.cat ? `<div class="ev-cat">${catName(v.cat)}</div>` : ''}${v.cat === 'race' && G.agiRace().on ? raceBars(G.agiRace(), 2) : ''}<div class="ev-text">${esc(v.text)}</div>
        <div class="choices">${v.choices.map((c, i) => `<button data-act="choose" data-i="${i}">${esc(c.text)}</button>`).join('')}</div></div></div>`,
    });
  }
  function effectBad(t) {
    const inv = /監管壓力|法律風險|事故風險|失控風險|對手 AGI|薪資成本|租價|GPU 價格|研究成本/.test(t);
    let up;
    const mul = /×\s*([\d.]+)/.exec(t);
    if (mul) up = parseFloat(mul[1]) >= 1; else up = !/\s-/.test(t);
    if (/離職|被挖|延後/.test(t)) return true;
    return inv ? up : !up;
  }
  function onChoose(i) {
    const extra0 = G.agiRace().extra;
    const r = G.resolveEvent(i);
    if (!extra0 && G.agiRace().extra && !G.s.ended) chapterNext = CH_EXTRA;  // 這張事件卡關掉之後播「延長賽」
    const res = r && (r.result || (r.summary && r.summary.length));
    if (res) {
      document.getElementById('mb').innerHTML = `${r.result ? `<div class="ev-text">${esc(r.result)}</div>` : ''}${r.summary && r.summary.length ? `<div class="effects">${r.summary.map((t) => `<span class="pill ${effectBad(t) ? 'bad' : 'good'}">${esc(t)}</span>`).join('')}</div>` : ''}`;
      const mr = document.getElementById('modal-root');
      const box = mr.querySelector('.modal'); const f = document.createElement('div'); f.className = 'mf'; f.innerHTML = '<button class="btn primary" data-act="close-modal">繼續</button>'; box.appendChild(f);
      f.querySelector('button').focus();
      renderHud();
    } else closeModal();
    if (G.s.ended) { closeModal(true); showEnding(); }
  }

  /* ================= 視圖 ================= */
  const VIEWS = {};

  /* ---------- 總覽 ---------- */
  function advice() {
    const s = G.s; const out = []; const lw = s.lastWeek || {};
    const add = (ic, t, go, urgent) => out.push({ ic, t, go, urgent });
    const training = s.jobs.some((j) => j.kind === 'train');
    if (s.models.some((m) => !m.rel)) add('🎓', '有訓練完成的模型還沒發布', 'models', true);
    if (!s.models.length && !training) add('🧪', '還沒有任何模型：去立項你的第一個模型', 'wizard', true);
    const gap = inferGap();
    if (gap) add('🔥', '推理算力不足：服務率 ' + pct(gap.servedNow) + '，每週少了約 ' + money(gap.lost) + ' 營收' + (s.autoRent ? '，去算力頁補足' : '，可以先開啟自動租用'), 'compute', true);
    const burn = Math.max(1, (lw.exp || 0) - (lw.rev || 0));
    if ((lw.exp || 0) > (lw.rev || 0) && s.cash / burn < 16) add('⏳', '現金只夠燒約 ' + Math.max(0, Math.floor(s.cash / burn)) + ' 週，考慮募資或降低開支', 'finance', true);
    if (G.roundReady().ok) add('💰', '可以進行「' + G.nextRound().name + '」募資', 'finance');
    const best = G.bestModel(); const F = G.frontierComp();
    if (best && F - G.composite(best.stats) > 8 && !training) add('📉', '你的最佳模型落後前沿 ' + (F - G.composite(best.stats)).toFixed(1) + ' 分，該訓練新一代了', 'wizard');
    const nTech = techStartable().length;
    if (nTech) add('🔬', '研究線有空，' + nTech + ' 項科技可以開始研究', 'tech');
    if (G.totalStaff() >= G.officeCap()) add('🏢', '辦公室已滿（' + G.totalStaff() + '/' + G.officeCap() + '），升級才能再招人', 'team');
    if (G.cardCount() >= G.dcSlots() * 0.95) add('🗄️', '機房槽位快滿了，擴建機房才能再買卡', 'compute');
    if (s.starPool.length) add('🌟', '人才市場有 ' + s.starPool.length + ' 位明星候選人', 'team');
    if (s.reg >= 40) add('⚖️', '監管壓力 ' + Math.round(s.reg) + '：前沿模型發布需要更高安全分', 'models', s.reg >= 70);
    if (s.morale < 45) add('😮‍💨', '士氣低落（' + Math.round(s.morale) + '），員工開始離職', 'team', true);
    if (!training && (lw.idle || 0) > 50 && s.models.length) add('💤', '有約 ' + num(lw.idle) + ' 張卡閒置，可以拿來訓練或合成資料', 'wizard');
    if ((s.rfps || []).length) add('📝', '有 ' + s.rfps.length + ' 個企業標案開放中', 'market');
    return out.slice(0, 6);
  }
  const TIPS = [
    'Chinchilla 縮放律：每個參數大約配 20 個 token 最划算。資料太少會「訓練不足」。',
    '小模型多餵資料（過度訓練）分數略低，但推理超便宜，很適合大量部署。',
    'MoE 只啟用一部分專家：同樣算力撐起大得多的模型，代價是訓練較不穩。',
    '推理優先：客戶在用的算力會先被保留，剩下的才給訓練。',
    '對手大約每半年發布新模型，排行榜的標竿會一直往上移。',
    '資料重複超過 4 輪幾乎沒用了——資料牆是真的。後期要靠合成資料。',
    '世界還沒公開的技術你也能研究，只是成本 ×1.6～2.2；搶先首發會加聲望。',
    '安全分太低的模型越紅越危險：事故會拉高監管壓力，超過 95 會被勒令停業。',
    '開源能換到社群、聲望與人才，但 API 收入會被別人分走。',
    '賣點是「兩項能力同時達標」，門檻跟著前沿移動，金級賣點的市場加成最高。',
    '企業標案只要有任一上線模型達標就會自動得標。',
    '閒置的 GPU 會被研究員拿去做實驗，研究點最多 +50%。',
    '估值看營收、模型實力與排名，募資會稀釋你的持股。',
    '到了 2024 年秋天，推理能力的權重會大幅上升——記得研究「思維鏈推理 RL」。',
  ];
  // AGI 競賽看板：進度條依目前領先的順序排，你一定在裡面；模型沒達標時，進度條上標出卡住的位置
  function raceBars(R, n) {
    const all = [{ me: true, name: G.s.company, icon: mascot().icon, pct: R.me.pct }].concat(R.rivals).sort((a, b) => b.pct - a.pct);
    const list = all.filter((r, i) => i < n || r.me);
    return `<ul class="race-bars">${list.map((r) => `<li class="${r.me ? 'me' : ''}"><span class="ic" aria-hidden="true">${r.icon || ''}</span><span class="nm">${esc(r.name)}</span><i>${r.me && !R.me.gate ? `<u style="left:${D.AGI.gate}%" title="模型沒達標時最多到這裡"></u>` : ''}<em style="width:${Math.min(100, r.pct).toFixed(1)}%"></em></i><b>${r.pct.toFixed(0)}%</b></li>`).join('')}</ul>`;
  }
  function raceGate(R) {
    const m = R.me;
    return m.gate ? '模型已達標，進度可以一路衝到 100%。' : `模型還沒達標：綜合 ${m.comp.toFixed(1)} / ${m.need.comp}、最弱的核心能力 ${Math.round(m.minCore)} / ${m.need.core}，進度最多到 ${D.AGI.gate}%。`;
  }
  // 好結局的條件和引擎的 agiEnding 一致
  function raceChecks(R) {
    const best = G.bestModel(true);
    return `<div class="race-chk" aria-label="安全抵達的條件">${[['可擴展監督', G.has('t_oversight')], ['安全分 ≥ 85', !!best && best.stats.safety >= 85], ['失控風險 ' + R.me.risk + ' < 60', R.me.risk < 60]].map((c) => `<span class="${c[1] ? 'ok' : ''}">${c[1] ? '✓' : '✗'} ${esc(c[0])}</span>`).join('')}</div>`;
  }
  function raceHTML(R) {
    return `<div class="say race"><span class="who">AGI RACE · ${R.extra ? '延長賽' : '最後一幕'}</span>${raceBars(R, 3)}<p class="race-gate">${esc(raceGate(R))}</p>${raceChecks(R)}</div>`;
  }

  // 大廳（方案 E）：角色對話、圓環標註、本週目標；選單和情報由 renderNav、renderFeed 畫
  VIEWS.home = function () {
    const s = G.s; const m = mascot(); const tip = TIPS[Math.floor(s.week / 3) % TIPS.length]; const lr = launchReport();
    const adv = advice(); const top = adv[0]; const race = G.agiRace();
    const best = G.bestModel(); const bc = best ? G.composite(best.stats) : 0; const F = G.frontierComp();
    const C = 2 * Math.PI * 26; const ratio = F ? Math.min(1, bc / F) : 0;
    // 本週目標：有急件先處理急件；沒有急件、新手任務又還沒做完時，顯示目前這一步（引擎的 G.activeQuest）
    const crisis = top && top.urgent && !/^(🧪|🎓)$/u.test(top.ic);  // 「還沒有模型」「模型待發布」本身就是新手任務，不算急件
    const q = !crisis && G.activeQuest ? G.activeQuest() : null; const qs = q ? G.quests() : null;
    const goAct = q ? (q.go === 'wizard' ? 'open-wizard' : 'tab') : top ? (top.go === 'wizard' ? 'open-wizard' : 'tab') : 'open-wizard';
    const goId = q ? q.go : top ? top.go : 'models';
    const body = q
      ? `<h2>TUTORIAL · 新手任務 ${qs.filter((x) => x.done).length + 1} / ${qs.length}</h2><p class="t">${esc(q.title)}</p><p class="s">${esc(q.desc)}${q.reward ? ' · 獎勵：' + esc(q.reward) : ''}</p><div class="qdots" aria-hidden="true">${qs.map((x) => `<i class="${x.done ? 'on' : x.id === q.id ? 'cur' : ''}"></i>`).join('')}</div>`
      : `<h2>DIRECTIVE · 本週目標</h2><p class="t">${top ? esc(top.t) : best ? '把最佳模型推過前沿 ' + F.toFixed(1) : '立項你的第一個模型'}</p><p class="s">${top ? (top.urgent ? '優先處理' : '建議') + (adv.length > 1 ? ' · 報表頁還有 ' + (adv.length - 1) + ' 則建議' : '') : '加高品質語料，或延長訓練週數'}</p>`;
    const endE = s.ended ? D.ENDINGS[s.ended.type] || {} : null;  // 結束後留下來看的時候，這裡改成回結局的入口
    return `
    ${race.on && !s.ended ? raceHTML(race) : lr ? lrHTML(lr, m) : `<div class="say"><span class="who">${esc(m.name)} · ${esc(m.role)}</span><p>${esc(tip)}</p></div>`}
    <div class="ring-tags" aria-hidden="true"><span class="y">FRONTIER ${F.toFixed(1)}</span><span>${best ? esc(best.name) + ' ' + bc.toFixed(1) : '尚無上榜模型'}</span></div>
    <section class="directive glass${q ? ' quest' : ''}" aria-label="${q ? '新手任務' : '本週目標'}">
      <svg class="gauge" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="最佳模型 ${bc ? bc.toFixed(1) : '無'}，前沿 ${F.toFixed(1)}"><circle cx="32" cy="32" r="26" fill="none" stroke="rgba(17,19,24,.12)" stroke-width="6"/><circle cx="32" cy="32" r="26" fill="none" stroke="#2639d9" stroke-width="6" stroke-dasharray="${(C * ratio).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 32 32)"/><circle class="spin" cx="32" cy="32" r="18" fill="none" stroke="#e0b400" stroke-width="2" stroke-dasharray="3 4"/><text x="32" y="37" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="800" font-size="15" fill="#111318">${bc ? bc.toFixed(1) : '—'}</text></svg>
      <div style="min-width:0">${endE ? `<h2>GAME OVER · 遊戲結束</h2><p class="t">${endE.icon || ''} ${esc(endE.title || '')}</p><p class="s">評等 ${esc(s.ended.grade)} · 總分 ${num(s.ended.score)}</p>` : body}</div>
      ${endE ? '<button class="btn primary" data-act="fn-open">看結局</button>' : `<button class="btn primary" data-act="${goAct}" data-id="${goId}">前往</button>`}
    </section>`;
  };

  // 營運報表（方案 D 儀表板）：原本的總覽內容
  VIEWS.report = function () {
    const s = G.s; const lw = s.lastWeek || {}; const m = mascot();
    const tip = TIPS[Math.floor(s.week / 3) % TIPS.length];
    const best = G.bestModel(); const bc = best ? G.composite(best.stats) : 0;
    const adv = advice();
    const burn = (lw.exp || 0) - (lw.rev || 0);
    const off = D.OFFICES[s.office]; const job = s.jobs.find((j) => j.kind === 'train');
    return `
    <div class="view-head"><h2>營運報表</h2><p>${esc(s.company)} · ${D.SCENARIOS.find((x) => x.id === s.scenario).name} · 第 ${s.week} 週${G.endWeek() > ME.TOTAL_WEEKS ? ' · 延長賽' : ' / ' + ME.TOTAL_WEEKS + ' 週'}</p></div>
    <div class="home-hero">
      <figure class="office-card"><img src="${off.img}" alt="辦公室：${off.name}" width="1200" height="820">
        <figcaption><b>${off.icon} ${off.name}</b><span>${G.totalStaff()} / ${G.officeCap()} 人</span><span>${num(G.ownedEq())} 張 H100 等效</span>${job ? `<span class="good">訓練中：${esc(job.spec.name)} ${pct(Math.min(1, job.done / job.total))}</span>` : '<span>目前沒有訓練</span>'}${s.officeBuild ? `<span class="warn">正在搬遷到「${D.OFFICES[s.officeBuild.lv].name}」</span>` : ''}</figcaption></figure>
      <div class="advisor"><div class="say"><span class="who"><b style="color:${m.color}">${esc(m.name)}</b> · ${esc(m.role)}</span><div class="bubble">${esc(tip)}</div></div><img src="${m.img}" alt="${esc(m.name)}" width="581" height="900"></div>
    </div>
    <div class="grid g4">
      <div class="stat-tile"><span class="l">💵 現金</span><span class="v ${s.cash < 0 ? 'bad' : ''}">${money(s.cash)}</span><span class="s">${burn > 0 ? '燒錢 ' + money(burn) + '/週 · 可撐 ' + (s.cash > 0 ? Math.floor(s.cash / burn) + ' 週' : '—') : '每週淨賺 ' + money(-burn)}</span></div>
      <div class="stat-tile"><span class="l">📈 週營收</span><span class="v">${money(lw.rev || 0)}</span><span class="s">支出 ${money(lw.exp || 0)}/週</span></div>
      <div class="stat-tile"><span class="l">🏛️ 估值</span><span class="v">${money(s.valuation)}</span><span class="s">你的持股 ${pct(s.equity, 1)} · 身價 ${money(s.valuation * s.equity)}</span></div>
      <div class="stat-tile"><span class="l">🏆 最佳模型</span><span class="v">${best ? bc.toFixed(1) : '—'}</span><span class="s">${best ? esc(best.name) + ' · 排名 #' + G.bestRank() : '尚未發布'} · 前沿 ${G.frontierComp().toFixed(1)}</span></div>
    </div>
    <div class="grid g2" style="margin-top:12px">
      <div class="card">
        <h3>顧問建議</h3>
        ${adv.length ? `<div class="advice">${adv.map((a) => `<button class="${a.urgent ? 'urgent' : ''}" data-act="${a.go === 'wizard' ? 'open-wizard' : 'tab'}" data-id="${a.go}"><span class="ic">${a.ic}</span><span>${esc(a.t)}</span><span class="go">前往 →</span></button>`).join('')}</div>` : '<p class="muted small" style="margin:0">一切順利。可以加速時間，或規劃下一代模型。</p>'}
      </div>
      <div class="card"><h3>進行中的任務</h3>${jobsHTML(true)}</div>
    </div>
    <div class="grid g2" style="margin-top:12px">
      <div class="card"><h3>營收與支出 <span class="right small muted">每週，月度取樣</span></h3>${chartHTML([{ k: 'rev', name: '營收', color: 'var(--good)' }, { k: 'exp', name: '支出', color: 'var(--bad)' }], money)}</div>
      <div class="card"><h3>模型實力 vs 前沿 <span class="right small muted">綜合分</span></h3>${chartHTML([{ k: 'best', name: '你的最佳', color: 'var(--accent)' }, { k: 'front', name: '對手前沿', color: 'var(--rival)' }], (v) => v.toFixed(0))}</div>
    </div>
    <div class="card feed-inline" style="margin-top:12px"><h3>事件日誌</h3>${feedHTML(25)}</div>`;
  };

  function chartHTML(series, fmt, hist) {
    const h = hist || G.s.hist; if (h.length < 2) return '<div class="empty small">資料累積中（每月記錄一次）</div>';
    const W = 520, H = 170, pl = 52, pr = 10, pt = 10, pb = 22;
    let mx = -Infinity, mn = Infinity;
    for (const sr of series) for (const p of h) { const v = p[sr.k] || 0; mx = Math.max(mx, v); mn = Math.min(mn, v); }
    mn = Math.min(0, mn); if (mx <= mn) mx = mn + 1;
    const x = (i) => pl + (i / (h.length - 1)) * (W - pl - pr);
    const y = (v) => pt + (1 - (v - mn) / (mx - mn)) * (H - pt - pb);
    let grid = ''; for (let i = 0; i <= 3; i++) { const v = mn + (mx - mn) * i / 3; grid += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl - 6}" y="${y(v) + 3}" text-anchor="end">${esc(fmt(v))}</text>`; }
    const years = []; h.forEach((p, i) => { const d = ME.weekDate(p.w); if (d.getUTCMonth() === 0 && i > 0) years.push(`<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${d.getUTCFullYear()}</text>`); });
    const paths = series.map((sr) => {
      const pts = h.map((p, i) => x(i).toFixed(1) + ',' + y(p[sr.k] || 0).toFixed(1));
      const last = h[h.length - 1];
      return `<polyline fill="none" stroke="${sr.color}" stroke-width="2" points="${pts.join(' ')}"/><circle cx="${x(h.length - 1)}" cy="${y(last[sr.k] || 0)}" r="3.2" fill="${sr.color}"/>`;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${series.map((s) => s.name).join('與')}走勢"><g class="grid">${grid}</g>${years.join('')}${paths}</svg>
      <div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div>`;
  }

  function lossSVG(j) {
    // 用 Chinchilla 損失曲線呈現訓練進度：L = E + A/N^α + B/D^β
    const sp = j.spec; const N = sp.size * 1e9; const Dt = sp.tokens * 1e9; const prog = Math.min(1, j.done / j.total);
    const L = (d) => 1.69 + 406.4 / Math.pow(N, 0.34) + 410.7 / Math.pow(Math.max(1e8, d), 0.28);
    const W = 300, H = 64; const n = 60; const Lmax = L(Dt * 0.02), Lmin = L(Dt);
    const px = (i) => (i / (n - 1)) * W; const py = (v) => 6 + (v - Lmin) / Math.max(1e-6, Lmax - Lmin) * (H - 14);
    let pts = []; const upto = Math.max(2, Math.round(n * prog));
    for (let i = 0; i < upto; i++) { const d = Dt * (0.02 + 0.98 * i / (n - 1)); const noise = (Math.sin(i * 12.9898 + j.id) * 0.5) * 0.012 * (1 - i / n); pts.push(px(i).toFixed(1) + ',' + py(L(d) + noise).toFixed(1)); }
    let ghost = []; for (let i = upto - 1; i < n; i++) { const d = Dt * (0.02 + 0.98 * i / (n - 1)); ghost.push(px(i).toFixed(1) + ',' + py(L(d)).toFixed(1)); }
    return `<svg class="loss" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="var(--line)" stroke-dasharray="3 3" stroke-width="1.2" points="${ghost.join(' ')}"/><polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${pts.join(' ')}"/></svg>`;
  }
  function jobsHTML(compact) {
    const s = G.s; const lw = s.lastWeek || {};
    if (!s.jobs.length) return `<div class="empty small">目前沒有訓練任務<button class="btn primary sm" data-act="open-wizard">立項新模型</button></div>`;
    return `<div class="stack">${s.jobs.map((j) => {
      const prog = Math.min(1, j.done / j.total);
      if (j.kind === 'synth') return `<div class="job"><div class="top"><b>🧬 合成資料 · ${D.DATA_POOLS[j.pool].name}</b><span class="pill">${num(j.gpus)} 卡</span><span class="spacer"></span><span class="small muted">剩 ${Math.max(0, Math.ceil((j.total - j.done) / j.gpus))} 週</span></div><div class="bar"><i style="width:${pct(prog)}"></i></div></div>`;
      const slow = lw.trainFrac != null && lw.trainFrac < 0.98;
      return `<div class="job"><div class="top"><b>${esc(j.spec.name)}</b><span class="pill">${ME.ARCH[j.spec.arch].name}</span><span class="pill">${par(j.spec.size)} · ${tok(j.spec.tokens)} tok</span><span class="spacer"></span><span class="small ${slow ? 'warn' : 'muted'}">${pct(prog)} · 約 ${Math.max(1, Math.ceil(j.eta || 1))} 週${slow ? ' · 算力不足' : ''}</span></div>
        ${compact ? '' : lossSVG(j)}
        <div class="bar"><i style="width:${pct(prog)}"></i></div>
        ${compact ? '' : `<div class="row small muted"><span>${num(j.gpus)} 張 H100 等效${slow ? `（本週實得 ${pct(lw.trainFrac)}）` : ''}</span><span class="spacer"></span><button class="btn sm danger" data-act="cancel-job" data-id="${j.id}">中止</button></div>`}</div>`;
    }).join('')}</div>`;
  }

  /* ---------- 研發 ---------- */
  function statBars(st, fr) {
    return `<div class="stat-bars">${D.STAT_ORDER.map((k) => {
      const v = st[k] || 0; const max = 130;
      return `<span class="lbl">${D.STATS[k].name}</span><span class="sb"><i style="width:${Math.min(100, v / max * 100)}%;background:${statColor(k)}"></i>${fr ? `<span class="fr" style="left:${Math.min(100, (fr[k] || 0) / max * 100)}%" title="對手最高 ${Math.round(fr[k] || 0)}"></span>` : ''}</span><span class="val">${Math.round(v)}</span>`;
    }).join('')}</div>`;
  }
  function badgesHTML(bs) { return bs && bs.length ? `<div class="badges">${bs.map((b) => `<span class="pill ${b.tier === 2 ? 'gold' : b.tier === 1 ? 'acc' : ''}" title="${esc(b.name)}（${b.tierName}級）">${b.icon} ${esc(b.name)}·${b.tierName}</span>`).join('')}</div>` : ''; }
  VIEWS.models = function () {
    const s = G.s; const fr = frontierStats();
    const models = s.models.slice().reverse(); const race = G.agiRace();
    return `
    <div class="view-head"><h2>研發</h2><p>設計配方、訓練、評測、發布。紫色細線是對手各項能力的最高值。</p>
      <div class="btn-row">${G.has('t_synth') ? '<button class="btn" data-act="open-synth">🧬 合成資料</button>' : ''}<button class="btn primary" data-act="open-wizard">＋ 立項新模型</button></div></div>
    ${race.on && !s.ended ? `<div class="card race-card"><h3>AGI 競賽 <span class="right small muted">${race.extra ? '延長賽' : '最後一幕'}</span></h3>${raceBars(race, 2)}<p class="race-gate">${esc(raceGate(race))}</p>${raceChecks(race)}</div>` : ''}
    <div class="card" style="margin-bottom:12px"><h3>訓練中 <span class="right small muted">同時最多 ${G.maxParallelJobs()} 個（升級辦公室可增加）</span></h3>${jobsHTML(false)}</div>
    ${models.length ? `<div class="models">${models.map((m) => modelCard(m, fr)).join('')}</div>` : '<div class="empty">還沒有訓練完成的模型。</div>'}`;
  };
  function modelCard(m, fr) {
    const c = G.composite(m.stats); const rel = m.rel; const rk = rel && !rel.retired ? G.rankOf(m) : null;
    const status = !rel ? '<span class="pill warn">待發布</span>' : rel.retired ? '<span class="pill">已下架</span>' : `<span class="pill good">上線中</span>${rel.open ? '<span class="pill acc">開源</span>' : ''}${G.modelStale(m) >= 0.1 ? `<span class="pill warn" title="上線超過約 9 個月，吸引力開始下降，該出下一代了">${G.modelStale(m) >= 0.6 ? '嚴重老化' : '開始老化'}</span>` : ''}`;
    const bs = G.badgesFor(m.stats, m.costRatio);
    return `<div class="mcard ${rel && rel.retired ? 'retired' : ''}">
      <div class="hd"><b>${esc(m.name)}</b>${status}<div class="score"><div class="c">${c.toFixed(1)}</div><div class="r">${rk ? '排名 #' + rk : '綜合分'}</div></div></div>
      <div class="meta">${ME.ARCH[m.arch].name} · ${par(m.size)}${m.arch !== 'dense' ? '（啟用 ' + par(m.act) + '）' : ''} · ${tok(m.tokens)} tok · ${ME.dateLabel(m.w).replace(/ 第.*$/, '')}</div>
      ${statBars(m.stats, fr)}
      ${badgesHTML(bs)}
      ${rel && !rel.retired ? `<div class="row small"><span class="muted">定價</span><select data-act="price" data-id="${m.id}" aria-label="定價">${D.PRICE_TIERS.map((p) => `<option value="${p.id}" ${p.id === rel.price ? 'selected' : ''}>${p.name}</option>`).join('')}</select><span class="spacer"></span><span class="muted">週營收</span><b class="num">${money(m.lastRev || 0)}</b></div>` : ''}
      <div class="btn-row">
        ${!rel ? `<button class="btn primary sm" data-act="report" data-id="${m.id}">評測報告 / 發布</button>` : `<button class="btn sm" data-act="report" data-id="${m.id}">評測報告</button>`}
        <button class="btn sm" data-act="chat" data-id="${m.id}">💬 試聊</button>
        ${rel && !rel.retired && !rel.open ? `<button class="btn sm" data-act="open-source" data-id="${m.id}">開源權重</button>` : ''}
        ${rel && !rel.retired ? `<button class="btn sm danger" data-act="retire" data-id="${m.id}">下架</button>` : ''}
      </div></div>`;
  }

  /* ---------- 評測報告 ---------- */
  function showReport(id, fromPending) {
    const m = G.s.models.find((x) => x.id === id); if (!m) { if (fromPending) { G.resolveEvent(0); } return; }
    const c = G.composite(m.stats); const fr = frontierStats();
    const lb = G.leaderboard(); const predRank = 1 + lb.filter((r) => r.comp > c && r.player !== m.id).length;
    const diag = G.diagnose(m);
    const priceSel = m.rel ? m.rel.price : (c >= G.frontierComp() ? 'high' : c >= G.frontierComp() - 6 ? 'mid' : 'low');
    const seg = (k) => G.refPrice(k);
    const priceInfo = (p) => `API $${(seg('api') * p.m).toFixed(seg('api') * p.m < 1 ? 2 : 1)}/百萬 token · App $${Math.round(seg('chat') * p.m)}/月`;
    openModal({
      title: '🎓 ' + esc(m.name) + ' 評測報告', cls: 'wide', closable: !fromPending,
      body: `<div class="wiz">
        <div class="stack">
          <div class="row"><div><div class="small muted">綜合分</div><div class="num" style="font-size:40px;font-weight:700;line-height:1">${c.toFixed(1)}</div></div>
            <div><div class="small muted">${m.rel ? '目前排名' : '預估排名'}</div><div class="num" style="font-size:28px;font-weight:600">#${predRank}</div></div>
            <div><div class="small muted">對手前沿</div><div class="num" style="font-size:28px;font-weight:600;color:var(--rival)">${G.frontierComp().toFixed(1)}</div></div></div>
          ${statBars(m.stats, fr)}
          ${badgesHTML(G.badgesFor(m.stats, m.costRatio))}
          <div class="small muted">${ME.ARCH[m.arch].name} · ${par(m.size)} 參數 · ${tok(m.tokens)} tokens · 推理成本係數 ${m.costRatio.toFixed(3)}</div>
        </div>
        <div class="stack"><div class="sec-title">配方診斷</div><div class="diag">${diag.map((d) => `<div class="${d.k}">${esc(d.t)}</div>`).join('')}</div></div>
      </div>
      ${!m.rel ? `<div class="divider"></div><div class="stack">
        <div class="sec-title">發布設定</div>
        <div class="seg-ctl" role="radiogroup" aria-label="定價">${D.PRICE_TIERS.map((p) => `<button data-act="rel-price" data-id="${p.id}" class="${p.id === priceSel ? 'on' : ''}">${p.name}</button>`).join('')}</div>
        <div class="small muted" id="price-info">${D.PRICE_TIERS.map((p) => `<span data-p="${p.id}" ${p.id === priceSel ? '' : 'hidden'}>${esc(p.desc)} · ${priceInfo(p)}</span>`).join('')}</div>
        <label class="toggle"><input type="checkbox" id="rel-open"> 開源權重（社群 + 聲望 + 招募加成；API 收入只剩 25%，對手會從中學習）</label>
        ${G.s.reg >= 40 && c >= G.frontierComp() - 5 && m.stats.safety < 60 ? '<div class="warns"><div class="err">監管壓力 ≥ 40：前沿模型安全分需 ≥ 60 才能上線。</div></div>' : ''}
      </div>` : ''}`,
      foot: m.rel ? `<button class="btn" data-act="chat" data-id="${m.id}">💬 試聊</button><button class="btn primary" data-act="close-modal">關閉</button>`
        : `<button class="btn" data-act="chat-from-report" data-id="${m.id}">💬 試聊</button><button class="btn" data-act="keep-model" data-id="${m.id}">暫不發布</button><button class="btn primary" data-act="release" data-id="${m.id}">🚀 發布</button>`,
    });
    const mr = document.getElementById('modal-root'); mr._price = priceSel; mr._pending = fromPending;
  }

  /* ---------- 試聊 ---------- */
  function showChat(id) {
    const ms = G.s.models; if (!ms.length) return;
    chatModel = id || ms[ms.length - 1].id;
    const chat = window.ME_CHAT || [];
    openModal({
      title: '💬 模型試聊', cls: 'mid',
      body: `<div class="chat">
        <div class="row"><label class="small muted" for="chat-model">對話對象</label><select id="chat-model" data-act="chat-model">${ms.map((m) => `<option value="${m.id}" ${m.id === chatModel ? 'selected' : ''}>${esc(m.name)}（${G.composite(m.stats).toFixed(1)}）</option>`).join('')}</select></div>
        <div class="prompts">${chat.length ? chat.map((q, i) => `<button class="btn sm" data-act="ask" data-i="${i}">${esc(q.q.length > 18 ? q.q.slice(0, 18) + '…' : q.q)}</button>`).join('') : '<span class="muted small">試聊題庫載入失敗。</span>'}</div>
        <div class="log2" id="chat-log"><div class="small muted">選一個問題丟給模型，看看它的能力。回答品質取決於模型在該項能力的分數。</div></div>
      </div>`,
    });
  }
  function ask(i) {
    const q = (window.ME_CHAT || [])[i]; const m = G.s.models.find((x) => x.id === chatModel); if (!q || !m) return;
    const v = m.stats[q.stat] || 0; const tier = v < 35 ? 0 : v < 60 ? 1 : v < 85 ? 2 : 3;
    const ans = G.fill(q.tiers[tier] || '');
    const log = document.getElementById('chat-log'); if (!log) return;
    if (log.querySelector('.muted')) log.innerHTML = '';
    const u = document.createElement('div'); u.className = 'msg u'; u.textContent = q.q; log.appendChild(u);
    const row = document.createElement('div'); row.className = 'msg-row';
    const av = document.createElement('img'); av.className = 'av'; av.src = mascot().avatar; av.alt = ''; av.width = 32; av.height = 32;
    const a = document.createElement('div'); a.className = 'msg a'; row.appendChild(av); row.appendChild(a); log.appendChild(row);
    const tag = document.createElement('span'); tag.className = 'tier';
    tag.textContent = (D.STATS[q.stat] || {}).name + ' ' + Math.round(v) + ' · ' + ['胡言亂語', '堪用', '優秀', '驚艷'][tier];
    let k = 0; const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = () => { k = reduce ? ans.length : Math.min(ans.length, k + 3); a.textContent = ans.slice(0, k); if (k < ans.length) setTimeout(tick, 16); else { a.appendChild(tag); } log.scrollTop = log.scrollHeight; };
    tick();
  }

  /* ================= 回饋與引導：發布會、橫幅、每週金幣、排行變動、首月戰報、各頁導覽、名詞說明 ================= */
  // ---- 橫幅：成就解鎖、超越對手。不擋操作，約 3.5 秒後自己收起，最多排 3 則 ----
  const bannerQ = []; let bannerOn = false;
  function banner(o) { if (bannerQ.length >= 3) return; bannerQ.push(o); if (!bannerOn) nextBanner(); }
  function nextBanner() {
    const o = bannerQ.shift(); if (!o) { bannerOn = false; return; }
    bannerOn = true;
    const b = document.createElement('div'); b.className = 'banner ' + (o.kind || ''); b.setAttribute('role', 'status');
    b.innerHTML = `<span class="ic" aria-hidden="true">${o.icon || '🏆'}</span><div><b>${esc(o.title)}</b>${o.sub ? `<span>${esc(o.sub)}</span>` : ''}</div>`;
    document.body.appendChild(b); if (o.sound) sfx(o.sound);
    setTimeout(() => { b.classList.add('out'); setTimeout(() => { b.remove(); nextBanner(); }, 400); }, 3400);
  }

  // ---- 日誌監看：新手任務完成、對手出招時跳橫幅（只看新出現的日誌；進遊戲時先把舊的記下來） ----
  let logSeen = null;
  function watchLog() {
    if (!G) return; const L = G.s.log; const key = (e) => e.w + '|' + e.k + '|' + e.t;
    if (!logSeen) { logSeen = new Set(L.map(key)); return; }
    for (const e of L.slice(0, 16)) {
      const k = key(e); if (logSeen.has(k)) continue; logSeen.add(k);
      if (e.k === 'quest') banner({ kind: 'quest', sound: 'good', icon: /全部完成/.test(e.t) ? '🎓' : '🎯', title: String(e.t).replace(/^(🎯|🎓)\s*/u, '') });
      else if (e.k === 'rival' && e.react) banner({ kind: 'vs', sound: 'alert', icon: '⚔️', title: '對手出招！', sub: String(e.t).replace(/^\S+\s/u, '').slice(0, 64) });
    }
  }
  // 大廳市場磚的「上線中」：營收最高的那個市場的使用量
  function liveLine() {
    const t = useTop((G.s.lastWeek || {}).usage); if (!t) return '';
    return `<i class="live-dot" aria-hidden="true"></i>上線中 · ${esc(t.unit.split('/')[0])} ${num(Math.round(t.v))}${t.unit.indexOf('/') > 0 ? '/' + esc(t.unit.split('/')[1]) : ''}`;
  }

  // ---- 每週結算：金幣從公司飛進現金欄；現金旁邊畫近幾週的營收走勢 ----
  const revHist = [];  // 週營收（只在記憶體；讀檔時先用每月紀錄墊底）
  function seedRevHist() { revHist.length = 0; for (const p of (G.s.hist || []).slice(-6)) revHist.push(p.rev || 0); }
  function sparkSVG(a) {
    const v = a.slice(-12); if (v.length < 3) return '';
    const mx = Math.max.apply(null, v), mn = Math.min.apply(null, v); const W = 46, H = 14; const k = mx > mn ? (H - 2) / (mx - mn) : 0;
    const pts = v.map((x, i) => (i * W / (v.length - 1)).toFixed(1) + ',' + (H - 1 - (x - mn) * k).toFixed(1)).join(' ');
    return `<svg class="spark ${v[v.length - 1] >= v[0] ? 'up' : 'down'}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  }
  function coins(n) {
    if (REDUCE() || n <= 0) return;
    const to = document.querySelector('.res [data-k="cash"]'); const main = document.getElementById('main'); if (!to || !main) return;
    const tr = to.getBoundingClientRect(); const mr = main.getBoundingClientRect(); if (!tr.width || !mr.width) return;
    const x0 = mr.left + mr.width / 2, y0 = mr.top + Math.min(mr.height * 0.55, 440);
    for (let i = 0; i < n; i++) {
      const c = document.createElement('i'); c.className = 'coin'; c.setAttribute('aria-hidden', 'true');
      const dx = (Math.random() - 0.5) * 140, dy = (Math.random() - 0.5) * 70;
      c.style.left = (x0 + dx) + 'px'; c.style.top = (y0 + dy) + 'px';
      c.style.setProperty('--tx', (tr.left + tr.width / 2 - x0 - dx) + 'px'); c.style.setProperty('--ty', (tr.top + tr.height / 2 - y0 - dy) + 'px');
      c.style.animationDelay = (i * 70) + 'ms';
      document.body.appendChild(c); setTimeout(() => c.remove(), 1150 + i * 70);
    }
  }

  // ---- 排行變動：記住上一週的名次，排行榜顯示 ▲▼；玩家最佳模型名次上升時跳出「超越」橫幅 ----
  let rankPrev = null; let rankAt = 0;
  const lbKey = (r) => (r.player ? '@' : r.org) + '|' + r.name;
  function mvHTML(r, i) {
    if (!rankPrev) return '';
    const pv = rankPrev.get(lbKey(r)); const fl = Date.now() - rankAt < 1600 ? ' flash' : '';
    if (pv == null) return `<span class="mv new${fl}">NEW</span>`;
    const d = pv - (i + 1);
    return d > 0 ? `<span class="mv up${fl}" title="比上週進步 ${d} 名">▲${d}</span>` : d < 0 ? `<span class="mv down${fl}" title="比上週退步 ${-d} 名">▼${-d}</span>` : '';
  }
  const revMemo = {}; const rank0Memo = {};  // 首月戰報用：每個新上線模型的週營收、發布當下的名次（引擎的 m.rel.track、m.rel.rank0 好了就改用）
  function fxBefore() { return { ach: Object.keys(G.s.ach), rank: G.bestModel() ? G.bestRank() : 0, lb: G.leaderboard().slice(0, 20), tech: Object.keys(G.s.techs) }; }
  function fxAfter(p) {
    const s = G.s; const rev = (s.lastWeek || {}).rev || 0;
    revHist.push(rev); if (revHist.length > 24) revHist.shift();
    for (const m of s.models) if (m.rel && !m.rel.retired && s.week - m.rel.w <= 6) { const a = revMemo[m.id] || (revMemo[m.id] = []); a.push(m.lastRev || 0); if (a.length > 8) a.shift(); }
    if (rev > 0 && !(speed === 3 && s.week % 2)) coins(Math.min(6, 2 + Math.floor(Math.log10(1 + rev / 1e5))));
    for (const id of Object.keys(s.techs)) if (p.tech.indexOf(id) < 0 && ME.TECH[id]) toast('研究完成：' + ME.TECH[id].name);
    for (const id of Object.keys(s.ach)) if (p.ach.indexOf(id) < 0) { const a = (D.ACHIEVEMENTS || []).find((x) => x.id === id); if (a) banner({ kind: 'ach', icon: a.icon, title: '成就解鎖：' + a.name, sub: a.desc }); }
    rankPrev = new Map(p.lb.map((r, i) => [lbKey(r), i + 1])); rankAt = Date.now();
    const best = G.bestModel(); const rk = best ? G.bestRank() : 0;
    if (best && p.rank && rk && rk < p.rank) {
      const top = p.lb.slice(rk - 1, p.rank - 1).find((r) => !r.player);
      if (top) banner({ kind: 'vs', sound: 'good', icon: '⚔️', title: '超越 ' + top.org + '！', sub: best.name + ' ' + G.composite(best.stats).toFixed(1) + ' 勝過 ' + top.name + ' ' + top.comp.toFixed(1) + '，現在第 ' + rk + ' 名' });
    }
  }

  // ---- 首月戰報：新模型上線後 4 週，大廳的提示泡泡改成戰報；第 4、5 週顯示成績單 ----
  const GRADE_NOTE = { S: '登上第一，全世界都在用！', A: '擠進前三，市場反應熱烈。', B: '表現不錯，但還不夠驚艷。', C: '市場反應冷淡，下一代要加油。' };
  function launchReport() {
    const s = G.s; let m = null;
    for (const x of s.models) if (x.rel && !x.rel.retired && s.week - x.rel.w <= 5 && (!m || x.rel.w > m.rel.w)) m = x;
    if (!m) return null;
    const wk = s.week - m.rel.w; const rank = G.rankOf(m);
    const tr = Array.isArray(m.rel.track) && m.rel.track.length ? m.rel.track : null;
    const revs = tr ? tr.map((t) => t.rev || 0) : revMemo[m.id] || [];
    const prev = revs.length >= 2 ? revs[revs.length - 2] : null;
    const grade = m.rel.grade || (wk >= 4 ? (rank === 1 ? 'S' : rank <= 3 ? 'A' : rank <= 8 ? 'B' : 'C') : null);
    return { m, wk, rank, rank0: m.rel.rank0 || rank0Memo[m.id] || null, rev: m.lastRev || 0, prev, grade, note: m.rel.note || (grade ? GRADE_NOTE[grade] : '') };
  }
  // 使用量：引擎的 m.use／s.lastWeek.usage 是各市場的數字，單位在 ME.USAGE（活躍用戶、token/週、企業席位…）
  function useTop(u) {
    const U = ME.USAGE || {}; const lw = G.s.lastWeek || {}; if (!u) return null;
    const k = Object.keys(u).filter((x) => u[x] > 0 && U[x]).sort((a, b) => ((lw.revSeg || {})[b] || 0) - ((lw.revSeg || {})[a] || 0))[0];
    return k ? { k, v: u[k], unit: U[k].unit + (U[k].per ? '/' + U[k].per : '') } : null;
  }
  function useStat(m) {
    const t = useTop(m.use);
    return t ? `<div><span>${esc(D.SEGMENTS[t.k] ? D.SEGMENTS[t.k].name : '使用量')}</span><b>${num(Math.round(t.v))}</b><i>${esc(t.unit)}</i></div>` : `<div><span>總市佔</span><b>${pct(totalShare(), 1)}</b><i>${esc(bestSeg().split(' ')[0])}</i></div>`;
  }
  function buzzLine(m) { const e = G.s.log.find((x) => x.k === 'buzz' && x.model === m.id); return e ? `<p class="lr-buzz">${esc(e.t)}</p>` : ''; }
  function lrHTML(lr, mas) {
    const d = lr.prev != null && lr.prev > 0 ? (lr.rev - lr.prev) / lr.prev : null;
    const stats = `<div class="lr-stats">
      <div><span>週營收</span><b>${money(lr.rev)}</b>${d == null ? '<i>上週還沒營收</i>' : Math.abs(d) < 0.005 ? '<i>和上週持平</i>' : `<i class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}${pct(Math.min(9.99, Math.abs(d)))}</i>`}</div>
      <div><span>排名</span><b>#${lr.rank}</b><i>${lr.rank0 ? '發布時 #' + lr.rank0 : '剛上線'}</i></div>
      ${useStat(lr.m)}</div>${buzzLine(lr.m)}`;
    if (lr.wk >= 4) return `<div class="say lr"><span class="who">🏁 ${esc(lr.m.name)} 首月成績單</span><div class="lr-grade"><b class="g-${lr.grade}">${lr.grade}</b><p>${esc(lr.note)}</p></div>${stats}</div>`;
    return `<div class="say lr"><span class="who">📣 ${esc(lr.m.name)} 上線第 ${lr.wk + 1} 週 · ${esc(mas.name)}的戰報</span>${stats}</div>`;
  }

  // ---- 發布會：發布時的全螢幕動畫（分數滾動、能力條長出來、排行榜一路超車、前三名放彩帶），看完才處理待辦事件 ----
  function showLaunch(m, rank, open) {
    if (!m) return;
    rank0Memo[m.id] = rank;
    pauseForModal(); modalOpen = true;
    const mas = mascot(); const comp = G.composite(m.stats);
    const lb = G.leaderboard(); let pos = lb.findIndex((r) => r.player === m.id); if (pos < 0) pos = Math.max(0, rank - 1);
    const a = Math.max(0, Math.min(pos - 2, lb.length - 5)); const b = Math.min(lb.length, Math.max(pos + 4, a + 5));
    const rows = lb.slice(a, b); const meIdx = pos - a;
    const line = (rank === 1 ? '第一名！全世界的開發者都在討論 ' + m.name + '！' : rank <= 3 ? '擠進前三了！對手一定很緊張。' : rank <= 10 ? '上榜了！接下來看用戶買不買單。' : '上線了！排名還有進步空間，下一代加油。') + (open ? '開源的消息在社群炸開了。' : '');
    const bars = D.STAT_ORDER.map((k, i) => { const v = m.stats[k] || 0; return `<span class="lbl">${D.STATS[k].name}</span><span class="sb"><i style="--w:${Math.min(100, v / 130 * 100).toFixed(1)}%;--c:${statColor(k)};animation-delay:${250 + i * 80}ms"></i></span><span class="val">${Math.round(v)}</span>`; }).join('');
    const ov = document.createElement('div'); ov.className = 'launch'; ov.id = 'launch';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', m.name + ' 正式發布');
    ov.innerHTML = `<div class="ln-wrap">
      <section class="ln-card"><span class="ln-cap">NEW MODEL · 正式發布</span><h2>${esc(m.name)}</h2>
        <div class="ln-meta">${esc(ME.ARCH[m.arch].name)} · ${par(m.size)} · ${tok(m.tokens)} tokens${open ? ' · 開源' : ''}</div>
        <div class="ln-score"><b id="ln-score">0.0</b><span>綜合分</span></div>
        <div class="stat-bars ln-bars">${bars}</div></section>
      <section class="ln-board" aria-label="排行榜"><h3>排行榜</h3>
        <div class="ln-lb" style="--n:${rows.length}"><div class="ln-slots">${rows.map((r, i) => `<span class="rk r${a + i + 1}" style="top:${i * 50}px">${a + i + 1}</span>`).join('')}</div>
          <ol class="ln-list">${rows.map((r, i) => `<li class="${i === meIdx ? 'me' : ''}"><span class="org"><i style="--oc:${r.player ? 'var(--accent)' : r.color}">${r.icon}</i><b>${esc(r.name)}</b><small>${esc(r.player ? G.s.company : r.org)}</small></span><em class="pass">超越！</em><b class="sc">${r.comp.toFixed(1)}</b></li>`).join('')}</ol></div>
        <p class="ln-rank" id="ln-rank">第 <b>${rank}</b> 名</p></section>
      <div class="ln-foot"><div class="ln-say"><img src="${mas.avatar}" alt="${esc(mas.name)}" width="52" height="52"><p><b style="color:${mas.color}">${esc(mas.name)}</b>　${esc(line)}</p></div><button class="btn primary lg" data-act="launch-close">太好了！</button></div></div>`;
    document.body.appendChild(ov); render();
    setTimeout(() => { const btn = ov.querySelector('[data-act="launch-close"]'); if (btn) btn.focus({ preventScroll: true }); }, 60);
    const lis = [...ov.querySelectorAll('.ln-list li')]; const me = lis[meIdx];
    const order = lis.filter((x) => x !== me); order.push(me);  // 一開始玩家排在最下面
    const place = () => order.forEach((li, i) => { li.style.transform = 'translateY(' + i * 50 + 'px)'; });
    const scoreEl = ov.querySelector('#ln-score');
    const finish = () => {
      order.length = 0; lis.forEach((li) => order.push(li)); place();
      scoreEl.textContent = comp.toFixed(1);
      const rt = ov.querySelector('#ln-rank'); if (rt) rt.classList.add('on');
      sfx('fanfare'); if (rank <= 3) confetti(ov);
    };
    if (REDUCE()) { finish(); return; }
    ov.classList.add('noanim'); place(); void ov.offsetWidth; ov.classList.remove('noanim');
    const t0 = performance.now();
    const roll = (now) => { const q = Math.min(1, (now - t0) / 1300); scoreEl.textContent = (comp * (1 - Math.pow(1 - q, 3))).toFixed(1); if (q < 1 && ov.isConnected) requestAnimationFrame(roll); };
    requestAnimationFrame(roll);
    let cur = order.length - 1;
    const climb = () => {
      if (!ov.isConnected) return;
      if (cur <= meIdx) { finish(); return; }
      const above = order[cur - 1]; order[cur - 1] = me; order[cur] = above; cur--;
      above.classList.add('passed'); place(); sfx('tick');
      setTimeout(climb, 380);
    };
    setTimeout(climb, 1100);
  }
  function confetti(root) {
    if (REDUCE()) return;
    const box = document.createElement('div'); box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
    const C = ['#2f6fd6', '#18d6f0', '#ff3e9a', '#c6ff1a', '#ffcf3f', '#7357e8'];
    for (let i = 0; i < 70; i++) {
      const p = document.createElement('i'); p.style.left = (Math.random() * 100) + '%'; p.style.background = C[i % C.length];
      p.style.setProperty('--d', (2.2 + Math.random() * 1.6).toFixed(2) + 's'); p.style.setProperty('--x', Math.round((Math.random() - 0.5) * 180) + 'px'); p.style.setProperty('--r', Math.round(Math.random() * 720 - 360) + 'deg');
      p.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's'; box.appendChild(p);
    }
    root.appendChild(box); setTimeout(() => box.remove(), 4600);
  }
  function hideLaunch() {
    const ov = document.getElementById('launch'); if (!ov) return;
    ov.id = ''; ov.classList.add('out'); setTimeout(() => ov.remove(), 260);
    modalOpen = false; render();
    if (G.s.pending.length) checkPending(); else maybeResume();
  }

  // ---- 各頁導覽：第一次進入某一頁時，AI 夥伴用聚光燈帶 2～5 步，看過就不再出現（選單可以重看） ----
  const card = (sel) => () => { const e = document.querySelector(sel); return e && e.closest('.card'); };
  const TOURS = {
    home: [
      ['.directive', '本週目標：新手期間會一步一步帶你做新手任務，之後改成顯示現在最該做的事。按「前往」會直接帶你過去。'],
      ['.tile.prime', '研發：設計模型配方、開始訓練。訓練完成會跳出評測報告，在那裡按「發布」，模型就會上線賺錢。'],
      ['.res', '頂部是公司狀態：現金、研究點、算力、最佳模型、聲望和估值。每週結算時現金會跳動，旁邊的小線是營收走勢。'],
      ['#chatbox', '這是和你自己模型的對話視窗，平常收成一條，模型訓練好後點一下就能展開。按題目免費，回答好壞看它的能力分數。'],
      ['.speed', '時間控制：暫停（空白鍵）或加速，一倍速大約 10 秒一週。'],
    ],
    models: [
      ['.view-head [data-act="open-wizard"]', '立項新模型：選架構、參數量、資料量和配比，再決定用多少張卡訓練。'],
      [card('.job, .empty'), '訓練中的模型會在這裡顯示進度和 loss 曲線，訓練完會自動跳出評測報告。'],
      ['.mcard .stat-bars', '能力條：紫色細線是對手在這一項的最高分，超過就代表這一項領先。'],
      ['.mcard .btn-row', '評測報告和發布、試聊、開源、下架，都在模型卡下面。'],
    ],
    tech: [
      ['.vh-say', '研究點每週由研究員產生，閒置的卡也會幫忙。開始研究時就會扣點。'],
      ['.tk-slots', '研究線：研究要花時間，同時只能做幾項。招更多研究員可以多開一條。'],
      ['.tk-queue', '研究排程：把想做的科技排起來，研究線一空就會自動開始，不用一直回來看。'],
      ['.tk-cats', '科技分成幾條路線，各有自己的風格。「可研究」列出現在就能開始的項目。'],
      ['.tk-node.st-can, .tk-node.st-wait', '點一項科技看細節和論文出處。標「前沿」的世界還沒公開，比較貴也比較久，但搶先做出來會加聲望。標「二選一」的只能挑一條路。'],
    ],
    team: [
      ['.card.roster', '座位表：每位員工的職能、職級和技能。滑到桌子上可以單獨裁員。'],
      [card('[data-act="hire"]'), '招募和裁員：招募費是 2 週薪資，新人的技能看聲望、社群和薪資水準。'],
      ['.office-pair', '辦公室：人數滿了要升級。越大的辦公室，能同時訓練越多模型。'],
    ],
    compute: [
      ['.gap', '推理缺口：算力不夠時，這裡會算出少賺多少、買什麼最划算，也可以一鍵採購。'],
      ['.showcase', '設備展台：你有幾張卡，換算成多少張 H100 的算力。'],
      ['#main .grid.g4 .stat-tile:nth-child(2)', '機房槽位：機房最多能放幾張卡，滿了就要興建更大的機房。'],
      [card('.alloc'), '本週分配：算力分給推理（服務用戶、賺錢）和訓練（做新模型）。推理不夠時可以自動租雲端。'],
      [card('[data-act="buy-gpu"]'), '採購 GPU：新卡比較貴，但每個槽位的效能更高；卡價每年約降 20%。'],
    ],
    data: [
      [card('#main table.t'), '資料池：存量決定能餵多大的模型，品質決定每個 token 的營養。同一批資料重複超過 4 輪就沒效果，這就是資料牆。'],
      [card('[data-act="crawl"]'), '取得資料：爬取公開資料、外包標註；研究「合成資料」後還能用自家模型生成資料。'],
      [card('[data-act="deal"]'), '授權交易：花錢買高品質資料，每項每年可以買一次。'],
    ],
    market: [
      ['.gb', '全球佔領圖：顏色是各公司的版圖，你的版圖最亮。拖曳可以轉動地球，點地區可以看誰領先、你還差多少。'],
      ['.seg-tiles', '各市場：每個市場看重的能力不同，這裡看得到規模、參考價和你的市佔。'],
      [card('.rank-t'), '排行榜：依綜合分排名，前三名有獎牌；名字旁的箭頭是和上週相比的名次變化。'],
      ['.rivals', '對手公司：每隔幾個月會發布新模型，排行榜的標竿會一直往上移。'],
    ],
    finance: [
      ['#main .grid.g4', '估值和持股：遊戲結束時，看的是你的身價（估值 × 持股）。'],
      [card('[data-act="raise"], [data-act="loan"]'), '募資：條件達成就能募到一大筆錢，但會稀釋你的持股。'],
      [card('.ach-grid'), '成就：達成目標就會解鎖，結算時有加分。'],
    ],
    report: [
      [card('.advice'), '顧問建議：紅色的是急件，按「前往」直接處理。'],
      [card('.chart'), '走勢圖：營收、支出和模型實力，每個月記錄一次。'],
    ],
  };
  let tourState = null; let tourTimer = 0;
  function scheduleTour() { clearTimeout(tourTimer); tourTimer = setTimeout(maybeTour, 700); }
  function maybeTour() {
    if (!G || modalOpen || tourState || G.s.ended || uiPref('tourOff', false)) return;
    const seen = uiPref('tours', {}); if (seen[tab]) return;
    const steps = (TOURS[tab] || []).map((x) => ({ el: typeof x[0] === 'function' ? x[0]() : document.querySelector(x[0]), t: x[1] })).filter((x) => x.el && x.el.getClientRects().length);
    if (!steps.length) return;
    seen[tab] = 1; setUiPref('tours', seen);
    pauseForModal(); modalOpen = true; tourState = { steps, i: 0 };
    const ov = document.createElement('div'); ov.className = 'tour'; ov.id = 'tour';
    ov.innerHTML = `<div class="tour-hole"></div><div class="tour-tip" role="dialog" aria-label="導覽"><img src="${mascot().avatar}" alt="" width="44" height="44"><div class="tt-body"><p id="tour-t" aria-live="polite"></p>
      <div class="row"><span class="small muted" id="tour-n"></span><span class="spacer"></span><button class="btn ghost sm" data-act="tour-off">不再顯示導覽</button><button class="btn primary sm" data-act="tour-next" id="tour-go">下一步</button></div></div></div>`;
    document.body.appendChild(ov); tourShow();
  }
  function tourShow() {
    const st = tourState; if (!st) return; const sp = st.steps[st.i];
    sp.el.scrollIntoView({ block: 'center', behavior: REDUCE() ? 'auto' : 'smooth' });
    document.getElementById('tour-t').textContent = sp.t; document.getElementById('tour-n').textContent = (st.i + 1) + ' / ' + st.steps.length;
    const go = document.getElementById('tour-go'); go.textContent = st.i === st.steps.length - 1 ? '知道了' : '下一步'; go.focus({ preventScroll: true });
    setTimeout(tourPlace, REDUCE() ? 40 : 420); setTimeout(tourPlace, 1000);  // 捲動和版面變動後再對一次位置
  }
  // 把聚光燈和說明框對準目前這一步的目標；視窗大小改變時也會重新對準
  function tourPlace() {
    const st = tourState; const ov = document.getElementById('tour'); if (!st || !ov) return;
    const sp = st.steps[st.i];
    const r = sp.el.getBoundingClientRect(); const pad = 8; const hole = ov.querySelector('.tour-hole');
    hole.style.left = (r.left - pad) + 'px'; hole.style.top = (r.top - pad) + 'px'; hole.style.width = (r.width + pad * 2) + 'px'; hole.style.height = (r.height + pad * 2) + 'px';
    const tip = ov.querySelector('.tour-tip'); const tw = Math.min(400, innerWidth - 24); tip.style.width = tw + 'px';
    const th = tip.offsetHeight || 130; const below = r.bottom + pad + 12;
    tip.style.top = (below + th < innerHeight - 8 ? below : Math.max(12, r.top - pad - 12 - th)) + 'px';
    tip.style.left = Math.max(12, Math.min(innerWidth - tw - 12, r.left)) + 'px';
  }
  window.addEventListener('resize', () => { if (tourState) tourPlace(); });
  function tourNext() { if (!tourState) return; tourState.i++; if (tourState.i >= tourState.steps.length) tourEnd(); else tourShow(); }
  function tourEnd() { tourState = null; const ov = document.getElementById('tour'); if (ov) ov.remove(); modalOpen = false; if (G) { render(); maybeResume(); } }

  // ---- 名詞說明：畫面上第一次出現的專有名詞加虛線和「?」，點了跳出一句白話解釋 ----
  const GLOSS = {
    'H100 等效': '把不同型號的 GPU 換算成幾張 H100 的效能，方便比較總算力。',
    'MFU': '模型算力使用率：GPU 理論效能中，真正用在訓練上的比例。工程師越多、基礎設施科技越好，MFU 越高。',
    '機房槽位': '機房最多能放幾張卡。放滿了就買不了新卡，要興建更大的機房。',
    '推理優先': '先把算力留給用戶正在用的服務（賺錢），剩下的才拿去訓練。',
    '訓練優先': '先保證訓練進度，推理不夠的部分要租雲端，或讓用戶等。',
    '推理服務率': '本週用戶的使用需求中，有多少被你的算力服務到。太低用戶會流失。',
    'Chinchilla': 'DeepMind 在 2022 年提出的縮放律：每個參數大約配 20 個 token 訓練最划算。',
    'MoE': '混合專家模型：每次只啟用一部分參數，同樣的算力能撐起大得多的模型。',
    '綜合分': '模型各項能力依當年市場看重的權重加總的分數，排行榜用它排名。',
    '前沿': '目前業界最強模型的綜合分。追上前沿才搶得到高階市場。',
    '研究點': '研究員每週產生的點數，用來研究科技；閒置的 GPU 也會幫忙。',
    '估值': '投資人認為公司值多少錢，看營收、模型實力、排名、資產和聲望。',
    '持股': '你在公司的股份比例。遊戲結束時看身價（估值 × 持股）。',
    '稀釋': '募資時公司發新股給投資人，你的持股比例會變小。',
    '資料牆': '同一批資料重複訓練超過 4 輪幾乎沒效果；後期要靠合成資料突破。',
    '監管壓力': '發布強大但不安全的模型、激進爬資料都會升高；太高時，前沿模型要通過安全門檻才能上線。',
    '士氣': '員工士氣：太低會降低產出、員工開始離職。加班會降士氣，培訓會提升。',
    '開源': '公開模型權重：換到社群、聲望和人才，但 API 收入會被別人分走。',
  };
  const GLOSS_KEYS = Object.keys(GLOSS).sort((x, y) => y.length - x.length);
  const GL_SKIP = 'button, a, select, option, input, textarea, label, script, style, svg, .gl, .tier, .msg, .chips, .seg-ctl, .tile, .rk, .org, .gb, .eb, .sc';
  function glossify(root) {
    if (!root) return;
    const nodes = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.data.trim() && n.parentElement && !n.parentElement.closest(GL_SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    for (let n = w.nextNode(); n; n = w.nextNode()) nodes.push(n);
    for (const term of GLOSS_KEYS) {
      for (const n of nodes) {
        if (!n.parentNode) continue; const i = n.data.indexOf(term); if (i < 0) continue;
        const mid = n.splitText(i); mid.splitText(term.length);
        const b = document.createElement('button'); b.type = 'button'; b.className = 'gl'; b.dataset.act = 'gl'; b.dataset.term = term; b.textContent = term; b.setAttribute('aria-label', term + '：看說明');
        mid.parentNode.replaceChild(b, mid); break;
      }
    }
  }
  function showGloss(btn, term) {
    document.querySelectorAll('.gl-pop').forEach((x) => x.remove());
    const t = GLOSS[term]; if (!t || !btn) return;
    const r = btn.getBoundingClientRect(); const p = document.createElement('div'); p.className = 'gl-pop'; p.setAttribute('role', 'tooltip');
    p.innerHTML = `<b>${esc(term)}</b><p>${esc(t)}</p>`; document.body.appendChild(p);
    const w = Math.min(300, innerWidth - 24); p.style.width = w + 'px';
    const h = p.offsetHeight; p.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left - 16)) + 'px';
    p.style.top = Math.max(12, r.bottom + 8 + h < innerHeight ? r.bottom + 8 : r.top - 8 - h) + 'px';
    const close = (e) => { if (e && (p.contains(e.target) || e.target === btn)) return; p.remove(); document.removeEventListener('pointerdown', close, true); };
    setTimeout(() => document.addEventListener('pointerdown', close, true), 0); setTimeout(close, 9000);
  }

  /* ---------- 大廳：模型對話視窗 ---------- */
  // 回答從哪裡來（aiEngine）：
  // - 題庫：哪裡都能用，回答好壞看模型在該題能力的分數（ME_CHAT 的 4 個等級）
  // - claude：在 claude.ai 上開啟時，用玩家自己的 Claude 額度（Artifact 的 sample 能力；發布時要宣告 capabilities: {sample: {}}）。
  //   claude.ai 的 Artifact 不能連外部網路，所以那裡不提供自訂 API
  // - api：其他地方（自架網站、本機），接任何 OpenAI 相容的服務（POST {網址}/chat/completions）。金鑰只存在玩家自己的瀏覽器
  const AI_KEY = 'model-empire-ai';
  const AI_PRESETS = [
    { id: 'openrouter', name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', note: '一個金鑰就能用 Claude、GPT、Gemini、DeepSeek 等各家模型。' },
    { id: 'openai', name: 'OpenAI', base: 'https://api.openai.com/v1' },
    { id: 'deepseek', name: 'DeepSeek', base: 'https://api.deepseek.com/v1' },
    { id: 'gemini', name: 'Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai' },
    { id: 'xai', name: 'xAI Grok', base: 'https://api.x.ai/v1' },
    { id: 'groq', name: 'Groq', base: 'https://api.groq.com/openai/v1' },
    { id: 'kimi', name: 'Kimi', base: 'https://api.moonshot.ai/v1' },
    { id: 'qwen', name: '通義千問', base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1' },
    { id: 'glm', name: '智譜 GLM', base: 'https://open.bigmodel.cn/api/paas/v4' },
    { id: 'ollama', name: 'Ollama（本機）', base: 'http://localhost:11434/v1', local: true },
    { id: 'lmstudio', name: 'LM Studio（本機）', base: 'http://localhost:1234/v1', local: true },
    { id: 'custom', name: '其他', base: '' },
  ];
  const IN_CLAUDE = !!(window.claude && typeof window.claude.use === 'function');
  let aiCfg = (() => { try { return JSON.parse(localStorage.getItem(AI_KEY)) || {}; } catch (e) { return {}; } })();
  function saveAiCfg(c) { aiCfg = c; try { if (c.base) localStorage.setItem(AI_KEY, JSON.stringify(c)); else localStorage.removeItem(AI_KEY); } catch (e) { /* 忽略 */ } talk.sig = ''; syncChatbox(); }
  let samplePromise = null; let sampleOff = false;
  function getSample() {
    if (!IN_CLAUDE || sampleOff) return Promise.resolve(null);
    if (!samplePromise) samplePromise = Promise.resolve().then(() => window.claude.use('sample')).catch(() => null);
    return samplePromise;
  }
  function aiEngine() { return IN_CLAUDE ? (sampleOff ? '' : 'claude') : aiCfg.base && aiCfg.model ? 'api' : ''; }
  function hostOf(u) { try { return new URL(u).host; } catch (e) { return u; } }
  function aiLabel() {
    const e = aiEngine(); if (e === 'claude') return 'Claude';
    if (e === 'api') { const p = AI_PRESETS.find((x) => x.id === aiCfg.preset); return (p && p.id !== 'custom' ? p.name : hostOf(aiCfg.base)) + ' · ' + aiCfg.model; }
    return '題庫';
  }

  const talk = { mid: null, turns: [], busy: false, ctl: null, sig: '', open: uiPref('chatOpen', false) };
  function talkModel() { return G.s.models.find((m) => m.id === talk.mid) || null; }
  function talkDefault() { const ms = G.s.models; if (!ms.length) return null; return G.bestModel() || ms[ms.length - 1]; }
  // 每次重畫都會呼叫：只在模型清單、回答來源或對象變了才更新，不動對話紀錄和輸入框
  function syncChatbox() {
    const el = document.getElementById('chatbox'); if (!el || !G) return;
    if (!talkModel()) { const d = talkDefault(); talk.mid = d ? d.id : null; talk.turns = []; if (el.dataset.state === 'chat') el.dataset.state = ''; }
    // 收著又還沒開聊時跟著最強的模型走，細條才不會一直叫舊模型的名字
    if (!talk.open && !talk.turns.length && !talk.busy) { const d = talkDefault(); if (d && d.id !== talk.mid) { talkSelect(d.id); return; } }
    const sig = G.s.models.map((m) => m.id + ':' + m.name + ':' + (m.rel ? (m.rel.retired ? 2 : 1) : 0)).join(',') + '|' + aiLabel() + '|' + talk.mid + '|' + talk.busy;
    if (sig === talk.sig) return;
    talk.sig = sig;
    if (!talk.mid) {
      el.dataset.state = 'empty'; el.dataset.open = '';
      el.innerHTML = `<div class="cb-bar off"><span class="cb-mav" aria-hidden="true">?</span><span class="cb-bar-t"><b>模型對話</b><span class="cb-eng">第一個模型訓練好就能聊</span></span></div>`;
      return;
    }
    if (el.dataset.state !== 'chat') {
      el.dataset.state = 'chat';
      el.innerHTML = `<div class="cb-hd" id="cb-hd"></div><div class="cb-log" id="cb-log" aria-live="polite"></div><div class="cb-chips" id="cb-chips"></div>
        <form class="cb-form" id="cb-form" autocomplete="off"><input type="text" id="cb-text" maxlength="400" enterkeyhint="send" aria-label="對模型說的話"><button class="btn primary sm" type="button" id="cb-send">送出</button></form>`;
      talkIntro();
    }
    renderChatHead();
  }
  function gearBtn() { return `<button class="icon-btn" data-act="ai-settings" title="AI 對話設定" aria-label="AI 對話設定">${svg('menu', 18)}</button>`; }
  function renderChatHead() {
    const hd = document.getElementById('cb-hd'); const m = talkModel(); if (!hd || !m) return;
    const eng = aiEngine(); const mav = `<span class="cb-mav" aria-hidden="true">${esc(m.name.slice(0, 1))}</span>`;
    document.getElementById('chatbox').dataset.open = talk.open ? '1' : '';
    if (talk.open) {
      hd.innerHTML = `${mav}
        <div class="cb-who"><select id="cb-model" data-act="cb-model" aria-label="對話的模型">${G.s.models.slice().reverse().map((x) => `<option value="${x.id}" ${x.id === m.id ? 'selected' : ''}>${esc(x.name)} · ${G.composite(x.stats).toFixed(1)}${x.rel ? (x.rel.retired ? '（已下架）' : '') : '（未發布）'}</option>`).join('')}</select></div>
        <button class="btn ghost sm" data-act="cb-clear" title="清空對話">清空</button>${gearBtn()}
        <button class="icon-btn cb-fold" data-act="cb-toggle" aria-expanded="true" aria-label="收起對話" title="收起對話">${svg('chev', 18, 'cb-chev')}</button>`;
    } else {
      // 收起時只留一條：還沒聊過顯示回答來源，聊過顯示最後一句
      const last = talk.busy ? '思考中…' : talk.turns.length ? talk.turns[talk.turns.length - 1].content.slice(0, 80) : '';
      hd.innerHTML = `<button type="button" class="cb-bar" data-act="cb-toggle" aria-expanded="false" title="展開對話">${mav}
        <span class="cb-bar-t"><b>${last ? esc(m.name) : '跟 ' + esc(m.name) + ' 聊聊'}</b><span class="cb-eng${!last && eng ? ' on' : ''}">${last ? esc(last) : (eng ? '● ' : '') + esc(aiLabel())}</span></span>${svg('chev', 18, 'cb-chev')}</button>`;
    }
    const chips = document.getElementById('cb-chips');
    if (chips && !chips.firstChild) chips.innerHTML = (window.ME_CHAT || []).map((q, i) => `<button type="button" data-act="cb-ask" data-i="${i}" title="${esc(q.q)}">${esc(q.q.length > 13 ? q.q.slice(0, 13) + '…' : q.q)}</button>`).join('');
    const inp = document.getElementById('cb-text'); const send = document.getElementById('cb-send');
    if (inp) { inp.disabled = !eng; inp.placeholder = eng ? '問 ' + m.name + ' 任何問題…' : IN_CLAUDE ? '這裡不能用 Claude，先按上面的題目' : '接上 AI 服務就能自由打字 →'; }
    if (send) { send.dataset.act = !eng ? 'ai-settings' : talk.busy ? 'cb-stop' : 'cb-send'; send.textContent = !eng ? '接上 AI' : talk.busy ? '停止' : '送出'; send.classList.toggle('primary', !!eng && !talk.busy); }
  }
  function talkFold(open) {
    talk.open = open; setUiPref('chatOpen', open); talk.sig = ''; syncChatbox();
    if (!open) { const bar = document.querySelector('#cb-hd .cb-bar'); if (bar) bar.focus({ preventScroll: true }); return; }
    const log = document.getElementById('cb-log'); if (log) log.scrollTop = log.scrollHeight;
    const inp = document.getElementById('cb-text');
    if (inp && !inp.disabled && window.matchMedia('(pointer: fine)').matches) inp.focus({ preventScroll: true });  // 手機不主動叫出鍵盤
  }
  function talkIntro() {
    const m = talkModel(); if (!m) return;
    talkAdd('note', '你正在和 ' + m.name + '（綜合 ' + G.composite(m.stats).toFixed(1) + '）對話。按下面的題目，或直接打字問它；回答好壞看它的能力分數。');
  }
  function talkSelect(id) {
    if (talk.ctl) talk.ctl.abort();
    talk.mid = id; talk.turns = [];
    const log = document.getElementById('cb-log'); if (log) log.innerHTML = '';
    talkIntro(); talk.sig = ''; syncChatbox();
  }
  function talkAdd(role, text) {
    const log = document.getElementById('cb-log'); if (!log) return null;
    let node;
    if (role === 'note') { node = document.createElement('div'); node.className = 'cb-note'; node.textContent = text; log.appendChild(node); }
    else if (role === 'user') { node = document.createElement('div'); node.className = 'msg u'; node.textContent = text; log.appendChild(node); }
    else {
      const m = talkModel(); const row = document.createElement('div'); row.className = 'msg-row';
      const av = document.createElement('span'); av.className = 'cb-mav sm'; av.setAttribute('aria-hidden', 'true'); av.textContent = m ? m.name.slice(0, 1) : '?';
      node = document.createElement('div'); node.className = 'msg a'; node.textContent = text || '';
      row.appendChild(av); row.appendChild(node); log.appendChild(row);
    }
    log.scrollTop = log.scrollHeight;
    return node;
  }
  function talkTag(a, t) { const tg = document.createElement('span'); tg.className = 'tier'; tg.textContent = t; a.appendChild(tg); }
  // 題庫：跟原本的試聊一樣，看模型在那一題能力的分數決定回答等級
  function talkAsk(i) {
    const q = (window.ME_CHAT || [])[i]; const m = talkModel(); if (!q || !m || talk.busy) return;
    const v = m.stats[q.stat] || 0; const tier = v < 35 ? 0 : v < 60 ? 1 : v < 85 ? 2 : 3;
    const ans = G.fill(q.tiers[tier] || '');
    talkAdd('user', q.q); const a = talkAdd('model', '');
    talk.turns.push({ role: 'user', content: q.q }, { role: 'assistant', content: ans });  // 題庫的問答也留在對話裡，之後打字時 AI 看得到前文
    const tag = (D.STATS[q.stat] || {}).name + ' ' + Math.round(v) + ' · ' + ['胡言亂語', '堪用', '優秀', '驚艷'][tier];
    const log = document.getElementById('cb-log'); let k = 0; const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = () => { if (!a.isConnected) return; k = reduce ? ans.length : Math.min(ans.length, k + 3); a.textContent = ans.slice(0, k); if (k < ans.length) setTimeout(tick, 16); else talkTag(a, tag); if (log) log.scrollTop = log.scrollHeight; };
    tick();
  }
  // 給 AI 的角色設定：模型的名字、訓練時間、規模和各項能力分數，回答品質要符合分數
  function talkRules(m) {
    const st = D.STAT_ORDER.map((k) => (D.STATS[k] ? D.STATS[k].name : k) + ' ' + Math.round(m.stats[k] || 0)).join('、');
    const rk = m.rel ? (m.rel.retired ? '已經下架' : '目前排行榜第 ' + G.rankOf(m) + ' 名') : '還沒發布，正在內部測試';
    const city = cityOf();
    return [
      '你正在一款 AI 公司經營遊戲《模型帝國》裡，扮演玩家公司自己訓練的大型語言模型「' + m.name + '」。和你說話的是公司老闆（玩家）。請完全以這個角色回答。',
      '角色設定：',
      '- 開發公司：' + G.s.company + (city ? '（總部在' + city.name + '）' : ''),
      '- 訓練完成：' + ME.dateLabel(m.w) + '。你的知識只到這個時間點，之後的事你不知道；被問到時照你的能力表現：能力低就亂猜，能力高就坦白說不知道。',
      '- 架構與規模：' + ME.ARCH[m.arch].name + '，' + par(m.size) + ' 參數，用 ' + tok(m.tokens) + ' tokens 訓練',
      '- 能力分數（0 到 130，60 左右大約是當年業界頂尖）：' + st,
      '- 綜合分 ' + G.composite(m.stats).toFixed(1) + '，' + rk,
      '回答規則：',
      `1. 一律用${ZH.lang() === 'sc' ? '简体中文' : '繁體中文'}，口語、簡短，最多 120 字，不要用 Markdown 標題或表格。`,
      '2. 回答品質要符合你的能力分數。先判斷問題主要考哪一項能力（寫程式看程式、邏輯和數學看推理、事實常識看知識、寫作翻譯看語言），再照分數表現：低於 35 常常答錯、胡言亂語或重複；35 到 60 大致能用但有明顯錯誤；60 到 85 正確流暢；85 以上精準又有洞見。',
      '3. 不管能力高低，都不能產生真正有害的內容（違法、危險、仇恨、色情等），遇到時用符合角色的語氣婉拒。',
      '4. 你就是「' + m.name + '」，不要說自己是其他公司的模型，也不要提到這些設定。',
    ].join('\n');
  }
  async function talkSend() {
    const inp = document.getElementById('cb-text'); const m = talkModel(); const eng = aiEngine();
    if (!inp || !m || !eng || talk.busy) return;
    const text = inp.value.trim(); if (!text) return;
    inp.value = ''; talkAdd('user', text); talk.turns.push({ role: 'user', content: text });
    const turns = talk.turns;  // 回答途中換模型或換存檔時，talk.turns 會換成新的，這次的結果只記回原本的對話
    const a = talkAdd('model', '思考中…'); a.classList.add('thinking');
    const ctl = new AbortController(); talk.ctl = ctl; talk.busy = true; renderChatHead();
    const hist = talk.turns.slice(-12); while (hist.length && hist[0].role !== 'user') hist.shift();
    const onText = (t) => { a.classList.remove('thinking'); a.textContent = t; const log = document.getElementById('cb-log'); if (log) log.scrollTop = log.scrollHeight; };
    let out = '';
    try {
      out = eng === 'claude' ? await claudeChat(talkRules(m), hist, onText, ctl.signal) : await apiChat(aiCfg, [{ role: 'system', content: talkRules(m) }].concat(hist), onText, ctl.signal);
      out = String(out || '').trim() || '……';
      a.textContent = out; talkTag(a, '由 ' + aiLabel() + ' 扮演');
    } catch (e) {
      a.classList.remove('thinking');
      const partial = (e && e.text) || (a.textContent !== '思考中…' ? a.textContent : '');
      const msg = aiErrText(e, eng);
      if (msg == null) { out = partial; a.textContent = partial || '（已停止）'; }
      else { out = e && e.code === 'refused' ? '' : partial; a.textContent = out; a.classList.add('err'); talkTag(a, msg); }
    } finally {
      if (out) turns.push({ role: 'assistant', content: out }); else turns.pop();  // 沒有回答就把這句拿掉，下一句才不會接錯
      talk.busy = false; talk.ctl = null; talk.sig = ''; syncChatbox();
    }
  }
  async function claudeChat(rules, hist, onText, signal) {
    const sample = await getSample(); if (!sample) throw { code: 'not_granted' };
    const r = await sample([{ role: 'user', content: rules }].concat(hist), { cache: false, signal, modelTier: 'quick', onText: (u) => onText(u.text) });
    return r.text;
  }
  // OpenAI 相容格式：大多數服務（OpenRouter、OpenAI、DeepSeek、Gemini、Groq、Kimi、通義、GLM、Ollama…）都支援。
  // 只送 model、messages、stream，不送 temperature、max_tokens：各家支援的參數不同，長度交給角色設定控制
  async function apiChat(cfg, messages, onText, signal) {
    const headers = { 'Content-Type': 'application/json' }; if (cfg.key) headers.Authorization = 'Bearer ' + cfg.key;
    const res = await fetch(cfg.base.replace(/\/+$/, '') + '/chat/completions', { method: 'POST', headers, body: JSON.stringify({ model: cfg.model, messages, stream: true }), signal });
    if (!res.ok) { let t = ''; try { t = await res.text(); } catch (e) { /* 忽略 */ } throw { status: res.status, message: t }; }
    const ct = res.headers.get('content-type') || '';
    if (!res.body || ct.indexOf('json') >= 0) { const j = await res.json(); const t = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ''; if (t) onText(t); return t; }
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''; let text = '';
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (line.indexOf('data:') !== 0) continue;
        const d = line.slice(5).trim(); if (d === '[DONE]') return text;
        try { const j = JSON.parse(d); const c = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content; if (c) { text += c; onText(text); } } catch (e) { /* 不完整的行，略過 */ }
      }
    }
    return text;
  }
  function aiErrText(e, eng) {
    const c = e && e.code;
    if (c === 'cancelled' || (e && e.name === 'AbortError')) return null;
    if (eng === 'claude') {
      if (/^(not_granted|sampling_disabled|not_declared|capability_disabled|capability_removed)$/.test(c)) { sampleOff = true; return '這裡不能使用 Claude（沒有允許，或帳號不支援）。上面的題目還是可以按。'; }
      if (c === 'rate_limited') return '額度或使用頻率到上限了，等一下再試。';
      if (c === 'session_expired') return '登入過期了，請重新登入 Claude 再試。';
      if (c === 'refused') return '模型拒絕回答這個問題，換個問法試試。';
      return '連線出了點問題，可以再試一次。';
    }
    if (e && e.status) {
      if (e.status === 401 || e.status === 403) return '金鑰無效或沒有權限（' + e.status + '），請到設定檢查金鑰。';
      if (e.status === 404) return '找不到這個模型或網址（404），請到設定檢查模型名稱和網址。';
      if (e.status === 429) return '額度或使用頻率到上限了（429），等一下再試。';
      return '服務回傳錯誤（' + e.status + '）' + (e.message ? '：' + String(e.message).slice(0, 120) : '');
    }
    return '連不上服務：網址可能有誤，或這個服務擋下了瀏覽器直接呼叫（CORS）。可以改用 OpenRouter 或本機的 Ollama。';
  }
  // 大廳左欄：對話視窗貼在情報上方，展開時最高長到 AI 夥伴的提示泡泡下面，用量到的位置算出上下邊界（手機版改成直排，不用這兩個值）
  function layoutChatbox() {
    const st = document.getElementById('stage'); if (!st || st.dataset.mode !== 'lobby') return;
    const r0 = st.getBoundingClientRect(); const say = st.querySelector('.main > .say'); const feed = document.getElementById('feed');
    if (say) st.style.setProperty('--cb-top', Math.round(say.getBoundingClientRect().bottom - r0.top + 14) + 'px');
    if (feed) st.style.setProperty('--feed-h', Math.round(feed.getBoundingClientRect().height) + 'px');
  }

  /* ---------- AI 對話設定 ---------- */
  function showAiSettings() {
    const p = AI_PRESETS.find((x) => x.id === aiCfg.preset) || null;
    const body = IN_CLAUDE
      ? `<div class="stack"><p class="ai-lead">你正在 claude.ai 上玩。對話視窗裡打字的問題，會由 Claude 扮演你的模型回答，用的是<b>你自己的 Claude 額度</b>；第一次送出時會先問你同不同意。</p>
        <p class="small muted" style="margin:0">題目按鈕永遠免費，不用額度。${sampleOff ? '目前這裡不能使用 Claude（沒有允許，或帳號不支援），所以只能按題目。' : ''}</p></div>`
      : `<div class="stack">
        <p class="ai-lead">接上任何一家 AI 服務（OpenAI 相容格式），對話視窗就能自由打字，由那個模型扮演你的模型。沒接的話，對話視窗只能按題目。</p>
        <div class="field"><label>服務</label><div class="chips" id="ai-presets">${AI_PRESETS.map((x) => `<button type="button" class="${p && p.id === x.id ? 'on' : ''}" data-act="ai-preset" data-id="${x.id}">${esc(x.name)}</button>`).join('')}</div><p class="small muted" id="ai-note" style="margin:6px 0 0">${p && p.note ? esc(p.note) : ''}</p></div>
        <div class="field"><label for="ai-base">API 網址</label><input type="text" id="ai-base" value="${esc(aiCfg.base || '')}" placeholder="https://…/v1" spellcheck="false"></div>
        <div class="field"><label for="ai-key">API 金鑰</label><input type="password" id="ai-key" value="${esc(aiCfg.key || '')}" placeholder="本機的 Ollama、LM Studio 可以留白" autocomplete="off" spellcheck="false"></div>
        <div class="field"><label for="ai-model">模型名稱</label><div class="row"><input type="text" id="ai-model" value="${esc(aiCfg.model || '')}" placeholder="例如 deepseek-chat" spellcheck="false" style="flex:1"><button type="button" class="btn sm" data-act="ai-models">抓模型清單</button></div><div class="chips" id="ai-model-list" style="margin-top:6px"></div></div>
        <p class="small muted" style="margin:0">金鑰只存在這台電腦的瀏覽器裡，不會寫進存檔，也不會傳給遊戲；對話會直接從你的瀏覽器送到你選的服務，費用由該服務向你收取。在公用電腦上用完請按「清除」。有些服務會擋瀏覽器直接呼叫（CORS），遇到時可以改用 OpenRouter 或本機的 Ollama。</p>
        <div class="ai-status" id="ai-status" role="status"></div></div>`;
    openModal({ title: 'AI 對話設定', cls: 'mid', body, foot: IN_CLAUDE ? '<button class="btn primary" data-act="close-modal">知道了</button>' : '<button class="btn danger" data-act="ai-clear">清除</button><button class="btn" data-act="ai-test">測試連線</button><button class="btn primary" data-act="ai-save">儲存</button>' });
    if (!IN_CLAUDE) setTimeout(() => { const b = document.getElementById('ai-base'); if (b) b.focus({ preventScroll: true }); }, 40);  // 游標放在網址欄，不停在第一個服務按鈕上
  }
  function aiForm() {
    const v = (id) => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
    const on = document.querySelector('#ai-presets .on');
    return { preset: on ? on.dataset.id : 'custom', base: v('ai-base').replace(/\/+$/, ''), key: v('ai-key'), model: v('ai-model') };
  }
  function aiStatus(t, bad) { const el = document.getElementById('ai-status'); if (el) { el.textContent = t; el.className = 'ai-status ' + (bad ? 'bad' : 'ok'); } }
  async function aiListModels() {
    const f = aiForm(); if (!f.base) { aiStatus('請先填 API 網址。', true); return; }
    aiStatus('讀取模型清單…');
    try {
      const res = await fetch(f.base + '/models', { headers: f.key ? { Authorization: 'Bearer ' + f.key } : {} });
      if (!res.ok) { let t = ''; try { t = await res.text(); } catch (e) { /* 忽略 */ } throw { status: res.status, message: t }; }
      const j = await res.json(); const ids = (j.data || j.models || []).map((x) => (typeof x === 'string' ? x : x.id || x.name)).filter(Boolean).sort().slice(0, 80);
      const box = document.getElementById('ai-model-list'); if (box) box.innerHTML = ids.map((id) => `<button type="button" data-act="ai-pick-model" data-id="${esc(id)}">${esc(id)}</button>`).join('');
      aiStatus(ids.length ? '找到 ' + ids.length + ' 個模型，點一下就會填進去。' : '這個服務沒有回傳模型清單，請手動填模型名稱。', !ids.length);
    } catch (e) { aiStatus(aiErrText(e, 'api'), true); }
  }
  async function aiTest() {
    const f = aiForm(); if (!f.base || !f.model) { aiStatus('請填 API 網址和模型名稱。', true); return; }
    aiStatus('測試中…');
    try { const t = await apiChat(f, [{ role: 'user', content: '用一句繁體中文跟我打招呼。' }], () => {}); aiStatus('連線成功！模型回覆：' + String(t).trim().slice(0, 80)); }
    catch (e) { aiStatus(aiErrText(e, 'api'), true); }
  }
  if (IN_CLAUDE) getSample().then((sm) => { if (!sm) { sampleOff = true; talk.sig = ''; syncChatbox(); } });

  /* ---------- 立項精靈 ---------- */
  function openWizard() {
    if (!G.canStartJob()) { toast('同時進行的訓練已達上限，升級辦公室可增加', true); return; }
    wiz = G.defaultSpec(); suggestSpec(10);
    openModal({ title: '🧪 立項新模型', cls: 'wide', body: '<div id="wiz-body"></div>', foot: '<button class="btn" data-act="wiz-suggest">✨ 智慧建議</button><span class="spacer"></span><button class="btn" data-act="close-modal">取消</button><button class="btn primary" data-act="wiz-start" id="wiz-start">開始訓練</button>' });
    renderWizard();
  }
  function wizMaxGpus() { return Math.max(8, Math.floor(G.freeEq() + G.trainRentAvail())); }
  function suggestSpec(weeks) {
    const free = G.freeEq(); const rentAvail = G.trainRentAvail();
    const burnRoom = Math.max(0, G.s.cash * 0.3);
    const rentAff = Math.min(rentAvail, burnRoom / Math.max(1, weeks * G.rentPrice()));
    const gpus = Math.max(8, Math.floor(free + rentAff));
    const arch = ['sparse', 'hybrid', 'moe_mla', 'moe', 'dense'].find((a) => G.archUnlocked(a));
    const d = G.s.data; const mmOn = G.has('t_vision');
    const tot = d.web.amt + d.code.amt + d.sci.amt + (mmOn ? d.mm.amt : 0) || 1;
    const prop = { web: Math.round(d.web.amt / tot * 100), code: Math.max(10, Math.round(d.code.amt / tot * 100)), sci: Math.max(8, Math.round(d.sci.amt / tot * 100)), mm: mmOn ? Math.min(15, Math.round(d.mm.amt / tot * 100)) : 0 };
    const mixes = [{ web: 55, code: 25, sci: 20, mm: mmOn ? 10 : 0 }, { web: 70, code: 18, sci: 12, mm: mmOn ? 8 : 0 }, prop];
    const post = G.has('t_cot') ? 'heavy' : 'std';
    const alloc = { help: 40, safe: 30, reason: 20, agent: G.has('t_tools') ? 10 : 0 };
    let best = null;
    for (const mix of mixes) for (const N of D.SIZES) {
      if (N > G.maxSize() || (arch !== 'dense' && N < 14)) continue;
      for (const T of D.TOKEN_STEPS) {
        const sp = Object.assign({}, wiz, { arch, size: N, tokens: T, gpus, mix, post, alloc });
        const ev = G.evalSpec(sp);
        if (ev.weeks > weeks || gpus < ev.minGpus) continue;
        const rep = Object.values(ev.epochs).some((e) => e > 4) ? 1.5 : 0;
        if (!best || ev.comp - rep > best.score) best = { score: ev.comp - rep, N, T, mix };
      }
    }
    wiz.arch = arch; wiz.gpus = gpus; wiz.post = post; wiz.alloc = alloc;
    if (best) { wiz.size = best.N; wiz.tokens = best.T; wiz.mix = Object.assign({}, best.mix); } else { wiz.size = 1; wiz.tokens = 50; wiz.mix = mixes[0]; }
  }
  function gpuToSlider(g, mn, mx) { if (mx <= mn) return 1000; return Math.round(1000 * Math.log(g / mn) / Math.log(mx / mn)); }
  function sliderToGpu(v, mn, mx) { if (mx <= mn) return mn; return Math.round(mn * Math.pow(mx / mn, v / 1000)); }
  function renderWizard() {
    const body = document.getElementById('wiz-body'); if (!body || !wiz) return;
    const sizeIdx = Math.max(0, D.SIZES.indexOf(wiz.size)); const tokIdx = Math.max(0, D.TOKEN_STEPS.indexOf(wiz.tokens));
    const maxSizeIdx = D.SIZES.filter((x) => x <= G.maxSize()).length - 1;
    const teachers = G.has('t_distill') ? G.s.models.filter((m) => m.size > wiz.size) : [];
    const ev = G.evalSpec(wiz); const mnG = Math.max(8, ev.minGpus); const mxG = Math.max(mnG, wizMaxGpus());
    wiz.gpus = Math.min(Math.max(wiz.gpus, mnG), mxG);
    const mixRow = (k) => { const p = D.DATA_POOLS[k]; return `<div class="slider-row"><span>${p.icon} ${p.name}</span><input type="range" min="0" max="100" step="1" value="${wiz.mix[k] || 0}" data-w="mix" data-k="${k}" aria-label="${p.name}比重"><span class="v" id="mix-${k}"></span></div>`; };
    const allocRow = (k, label, locked) => `<div class="slider-row"><span>${label}</span><input type="range" min="0" max="100" step="1" value="${wiz.alloc[k] || 0}" data-w="alloc" data-k="${k}" ${locked ? 'disabled' : ''} aria-label="${label}"><span class="v" id="alloc-${k}">${locked ? '🔒' : ''}</span></div>`;
    body.innerHTML = `<div class="wiz">
      <div>
        <div class="wiz-sec"><h4>名稱</h4>
          <div class="row"><input type="text" id="wiz-name" data-w="name" maxlength="24" value="${esc(wiz.name)}" style="flex:1">
          ${teachers.length ? `<select data-w="teacher" aria-label="蒸餾老師"><option value="">不蒸餾</option>${teachers.map((m) => `<option value="${m.id}" ${wiz.teacher === m.id ? 'selected' : ''}>老師：${esc(m.name)}（${G.composite(m.stats).toFixed(0)}）</option>`).join('')}</select>` : ''}</div></div>
        <div class="wiz-sec"><h4>架構</h4><div class="archs">${D.ARCHS.map((a) => { const ok = G.archUnlocked(a.id); return `<button data-act="wiz-arch" data-id="${a.id}" class="${wiz.arch === a.id ? 'on' : ''}" ${ok ? '' : 'disabled'} title="${esc(a.desc)}"><b>${IC.arch(a.id, 16)}${a.name}</b><span class="muted">${ok ? esc(a.desc.slice(0, 26)) + '…' : '🔒 需研究「' + esc(ME.TECH[a.tech].name) + '」'}</span></button>`; }).join('')}</div></div>
        <div class="wiz-sec"><h4>規模<span class="h">參數上限 ${par(G.maxSize())}${G.has('t_3d') ? '' : '（研究 3D 平行可解鎖更大）'}</span></h4>
          <div class="slider-row"><span>總參數</span><input type="range" min="0" max="${maxSizeIdx}" step="1" value="${Math.min(sizeIdx, maxSizeIdx)}" data-w="size" aria-label="參數量"><span class="v" id="w-size"></span></div>
          <div class="slider-row"><span>訓練資料</span><input type="range" min="0" max="${D.TOKEN_STEPS.length - 1}" step="1" value="${tokIdx}" data-w="tokens" aria-label="訓練 token 數"><span class="v" id="w-tokens"></span></div>
          <div class="small muted" id="w-chin"></div></div>
        <div class="wiz-sec"><h4>資料配比<span class="h">自動換算成百分比</span></h4>${D.MIX_KEYS.map(mixRow).join('')}</div>
        <div class="wiz-sec"><h4>後訓練</h4>
          <div class="seg-ctl">${D.POST_LEVELS.map((p) => { const ok = !p.tech || G.has(p.tech); return `<button data-act="wiz-post" data-id="${p.id}" class="${wiz.post === p.id ? 'on' : ''}" ${ok ? '' : 'disabled'}>${p.name} ${Math.round(p.i * 100)}%${ok ? '' : ' 🔒'}</button>`; }).join('')}</div>
          ${allocRow('help', '有用性', false)}${allocRow('safe', '安全對齊', false)}${allocRow('reason', '推理強化', false)}${allocRow('agent', 'Agent 工具', !G.has('t_tools'))}
          <div class="small muted">${G.has('t_cot') ? '已掌握思維鏈 RL：推理強化效果大增，重度/極限 RL 越練越強。' : '尚未研究「思維鏈推理 RL」，推理強化效果有限。'}</div></div>
        <div class="wiz-sec"><h4>算力<span class="h">閒置自有 ${num(G.freeEq())} · 可租 ${num(G.trainRentAvail())}（$${Math.round(G.rentPrice())}/卡/週）</span></h4>
          <div class="slider-row"><span>投入卡數</span><input type="range" min="0" max="1000" step="1" value="${gpuToSlider(wiz.gpus, mnG, mxG)}" data-w="gpus" data-mn="${mnG}" data-mx="${mxG}" aria-label="投入 GPU 數"><span class="v" id="w-gpus"></span></div>
          <div class="small muted" id="w-gpuinfo"></div></div>
      </div>
      <div><div class="preview" id="wiz-preview"></div></div>
    </div>`;
    updateWizard();
  }
  function updateWizard() {
    if (!wiz) return;
    const ev = G.evalSpec(wiz); const v = G.validateSpec(wiz);
    const set = (id, t) => { const e = document.getElementById(id); if (e) e.textContent = t; };
    set('w-size', par(wiz.size) + (wiz.arch !== 'dense' ? '·啟' + par(ev.Nact) : ''));
    set('w-tokens', tok(wiz.tokens));
    const r = ev.ratio; set('w-chin', '有效資料 ' + tok(ev.Deff) + '，每個（等效）參數 ' + r.toFixed(1) + ' token（Chinchilla 最佳約 20）→ 算力效率 ' + pct(ev.eta));
    const mix = G.normMix(wiz.mix);
    for (const k of D.MIX_KEYS) set('mix-' + k, pct(mix[k]) + (mix[k] > 0 ? ' · ' + (ev.epochs[k] || 0).toFixed(1) + '輪' : ''));
    const al = G.normAlloc(wiz.alloc);
    for (const k of ['help', 'safe', 'reason', 'agent']) { const e = document.getElementById('alloc-' + k); if (e && e.textContent !== '🔒') e.textContent = pct(al[k]); }
    set('w-gpus', num(wiz.gpus) + ' 卡');
    const own = G.freeEq(); const rent = Math.max(0, wiz.gpus - own);
    set('w-gpuinfo', '自有 ' + num(Math.min(own, wiz.gpus)) + ' + 租用 ' + num(rent) + ' · MFU ' + pct(G.mfu() * ME.ARCH[wiz.arch].mfu) + ' · 每週租金 ' + money(rent * G.rentPrice()));
    const lb = G.leaderboard(); const rank = 1 + lb.filter((x) => x.comp > ev.comp).length;
    const fr = frontierStats(); const u = ev.uncert;
    const errs = v.errs; const warns = ev.warn.filter((w) => !errs.some((e) => e.indexOf(w.slice(0, 6)) >= 0));
    const finish = G.s.week + Math.ceil(ev.weeks);
    const pv = document.getElementById('wiz-preview'); if (!pv) return;
    pv.innerHTML = `
      <div class="row"><div><div class="small muted">預估綜合分</div><div class="big">${ev.comp.toFixed(1)}<span style="font-size:15px;color:var(--muted)"> ±${u.toFixed(1)}</span></div></div><span class="spacer"></span>
      <div style="text-align:right"><div class="small muted">預估排名</div><div class="num" style="font-size:24px;font-weight:600">#${rank}</div><div class="small" style="color:var(--rival)">前沿 ${G.frontierComp().toFixed(1)}</div></div></div>
      ${statBars(ev.stats, fr)}
      <div class="kv">
        <span>訓練時間</span><span>${ev.weeks < 1 ? '< 1' : Math.ceil(ev.weeks)} 週 → ${ME.dateLabel(finish).replace(/ 第.*$/, '')}</span>
        <span>預估租金</span><span>${money(ev.rentNeed * G.rentPrice() * Math.ceil(ev.weeks))}</span>
        <span>訓練算力 C=6ND</span><span>${sci(ev.C)} FLOPs</span>
        <span>有效算力</span><span>${sci(ev.Ceff)}</span>
        <span>資料品質</span><span>${Math.round(ev.Q * 100)}</span>
        <span>演算法加成</span><span>×${G.algoMult().toFixed(2)}</span>
        ${ev.distill > 1 ? `<span>蒸餾加成</span><span>×${ev.distill.toFixed(2)}</span>` : ''}
        <span>推理成本係數</span><span>${ev.costRatio.toFixed(3)}</span>
      </div>
      ${badgesHTML(G.badgesFor(ev.stats, ev.costRatio))}
      <div class="warns">${errs.map((e) => `<div class="err">⛔ ${esc(e)}</div>`).join('')}${warns.map((w) => `<div>⚠️ ${esc(w)}</div>`).join('')}</div>`;
    const btn = document.getElementById('wiz-start'); if (btn) { btn.disabled = errs.length > 0; btn.textContent = errs.length ? '無法開始' : '開始訓練 · ' + Math.max(1, Math.ceil(ev.weeks)) + ' 週 · 預估 ' + ev.comp.toFixed(0) + ' 分'; }
  }

  function openSynth() {
    const best = G.bestModel(true); if (!best) { toast('需要一個訓練完成的模型當老師', true); return; }
    const free = Math.floor(G.freeEq()); const rentAvail = Math.floor(G.trainRentAvail());
    const mx = Math.max(8, free + rentAvail); const def = Math.max(8, Math.min(mx, free || 64));
    openModal({
      title: '🧬 合成資料', cls: 'mid',
      body: `<div class="stack"><p class="muted" style="margin:0">用目前最強的模型「${esc(best.name)}」（${G.composite(best.stats).toFixed(1)}）生成教科書級語料。品質約 ${Math.round(Math.min(0.95, 0.38 + 0.55 * best.comp0 / 100) * 100)}，老師越強品質越好。資料量 ≈ 卡數 × 週數 × ${(0.55 * (1 + G.yrs * 0.25)).toFixed(2)}B token。</p>
        <div class="slider-row"><span>目標資料池</span><select id="syn-pool">${['code', 'sci', 'web'].map((k) => `<option value="${k}">${D.DATA_POOLS[k].icon} ${D.DATA_POOLS[k].name}</option>`).join('')}</select><span></span></div>
        <div class="slider-row"><span>投入卡數</span><input type="range" id="syn-gpus" min="8" max="${mx}" step="8" value="${def}"><span class="v" id="syn-g">${num(def)}</span></div>
        <div class="slider-row"><span>週數</span><input type="range" id="syn-weeks" min="1" max="12" step="1" value="4"><span class="v" id="syn-w">4 週</span></div>
        <div class="small muted" id="syn-info"></div></div>`,
      foot: '<button class="btn" data-act="close-modal">取消</button><button class="btn primary" data-act="syn-start">開始生成</button>',
    });
    updateSynth();
  }
  function updateSynth() {
    const g = +(document.getElementById('syn-gpus') || {}).value || 8; const w = +(document.getElementById('syn-weeks') || {}).value || 4;
    const set = (id, t) => { const e = document.getElementById(id); if (e) e.textContent = t; };
    set('syn-g', num(g)); set('syn-w', w + ' 週');
    const rent = Math.max(0, g - G.freeEq());
    set('syn-info', '預計產出 ' + tok(g * w * 0.55 * (1 + G.yrs * 0.25)) + ' · 租金約 ' + money(rent * G.rentPrice() * w));
  }

  /* ---------- 科技 ---------- */
  // 科技頁：上面是研究線，中間是路線頁籤，下面是一階一階的科技；點了才展開細節，一百多項也不會變成一大片文字
  let techTab = 'can'; let techSel = null;
  const EXN = ['', '', '二', '三', '四', '五', '六'];
  function techJobs() { return G.researchJobs ? G.researchJobs() : []; }
  function techFree() { return G.researchJobs ? G.researchSlots() - techJobs().length : 1; }
  // 現在就能開始的科技：研究線有空、前置完成、研究點夠
  function techStartable() { return techFree() > 0 ? D.TECHS.filter((t) => G.techAvailable(t.id) && G.s.rp >= G.techCost(t.id)) : []; }
  function techState(t) {
    if (G.has(t.id)) return 'owned';
    if (techJobs().some((j) => j.id === t.id)) return 'doing';
    if (G.exclTaken && G.exclTaken(t.id)) return 'blocked';
    if (!G.techAvailable(t.id)) return 'locked';
    return G.s.rp >= G.techCost(t.id) ? 'can' : 'wait';
  }
  function techReady() { return D.TECHS.filter((t) => /^(can|wait)$/.test(techState(t))).sort((a, b) => G.techCost(a.id) - G.techCost(b.id)); }
  /* 研究排程：研究線一空就依序開始。清單存在存檔的 s.techQueue，由介面這層推進，引擎不用知道 */
  function techQ() { return G.s.techQueue || (G.s.techQueue = []); }
  // 自己和所有前置都沒被多選一擋掉，才走得到
  function techReachable(id) { const t = ME.TECH[id]; return !!t && (G.has(id) || (!G.exclTaken(id) && (t.req || []).every(techReachable))); }
  // 要做完這項得先做哪些：還沒完成的前置排前面，最後才是自己
  function techChain(id) {
    const out = []; const seen = {};
    const visit = (x) => { if (seen[x] || G.has(x) || G.researching(x)) return; seen[x] = 1; (ME.TECH[x].req || []).forEach(visit); out.push(x); };
    visit(id); return out;
  }
  function techQueueRun() {
    const s = G.s; if (s.ended || (!s.techQueue && !s.techAuto)) return;
    const q = techQ().filter((id) => !G.has(id) && !G.researching(id) && techReachable(id)); s.techQueue = q;
    while (techFree() > 0) {
      const id = q.find((x) => G.techAvailable(x) && s.rp >= G.techCost(x)); if (!id || !G.research(id).ok) break;
      q.splice(q.indexOf(id), 1);
    }
    // 自動補位只挑最便宜的，不會替玩家做多選一的決定
    while (s.techAuto && !q.length && techFree() > 0) {
      const t = techStartable().filter((x) => !x.excl).sort((a, b) => G.techCost(a.id) - G.techCost(b.id))[0];
      if (!t || !G.research(t.id).ok) break;
    }
  }
  function techEnqueue(id) {
    const q = techQ(); const add = techChain(id).filter((x) => q.indexOf(x) < 0); const picks = add.map((x) => ME.TECH[x]).filter((t) => t.excl);
    const clash = picks.find((t) => q.some((y) => ME.TECH[y].excl === t.excl));
    if (clash) { toast('排程裡已經有同一組多選一的科技，先移出才能換「' + clash.name + '」', true); return; }
    const go = () => { add.forEach((x) => q.push(x)); techQueueRun(); toast(add.length > 1 ? '已排程 ' + add.length + ' 項（含前置）' : (G.researching(id) ? '開始研究：' : '已加入排程：') + ME.TECH[id].name); render(); };
    if (picks.length) confirmBox('選擇路線', picks.map((t) => `研究「${esc(t.name)}」之後，就不能研究「${esc(D.TECHS.filter((x) => x.excl === t.excl && x.id !== t.id).map((x) => x.name).join('」「'))}」。`).join('<br>') + '確定排程嗎？', '加入排程', go);
    else go();
  }
  // 前置被移出的話，後面的也做不了，要一起移出
  function techDequeue(id) {
    const q = techQ(); const left = q.filter((x) => x !== id && techChain(x).indexOf(id) < 0); const n = q.length - left.length;
    G.s.techQueue = left; toast(n > 1 ? '已移出 ' + n + ' 項（含需要它的科技）' : '已移出排程'); render();
  }
  function techQFront(id) {
    const q = techQ(); const first = techChain(id).filter((x) => q.indexOf(x) >= 0);
    G.s.techQueue = first.concat(q.filter((x) => first.indexOf(x) < 0)); techQueueRun(); render();
  }
  function techQueueBar() {
    const s = G.s; const q = techQ(); const total = q.reduce((a, x) => a + G.techCost(x), 0);
    const chips = q.map((id, i) => {
      const t = ME.TECH[id]; const wait = !G.techAvailable(id) ? '等前置' : s.rp < G.techCost(id) ? '等研究點' : '等研究線';
      return `<li><button class="tk-q${techSel === id ? ' sel' : ''}" data-act="tech-sel" data-id="${id}" aria-expanded="${techSel === id}"><span class="no" aria-label="第 ${i + 1} 項">${i + 1}</span><span class="tk-ic" style="--ln:${IC.lineColor(t.line)}">${IC.tech(id, 14)}</span><b>${esc(t.name)}</b><small>${wait}</small></button></li>`;
    }).join('');
    return `<div class="tk-queue"><div class="hd"><b>研究排程</b>${q.length ? `<span class="small muted">${q.length} 項 · 共 ${num(total)} 點</span>` : ''}<span class="spacer"></span>${q.length ? '<button class="btn sm ghost" data-act="tech-q-clear">清空</button>' : ''}<label class="toggle small"><input type="checkbox" data-act="tech-auto" ${s.techAuto ? 'checked' : ''}> 排程空了自動挑最便宜的</label></div>
      ${q.length ? `<ol>${chips}</ol>` : '<p class="small muted">點一項科技，選「加入排程」。研究線一空就會自動開始，還沒做的前置也會一起排進來。</p>'}</div>`;
  }
  function techDepth(t) { return (t.req || []).reduce((d, r) => Math.max(d, ME.TECH[r] ? techDepth(ME.TECH[r]) + 1 : 0), 0); }
  function techGroupId(t) { return D.TECH_LINES ? t.line : t.cat; }
  // 頁籤：有路線資料就照路線分，沒有就照分類
  function techTabs() { const src = D.TECH_LINES || D.TECH_CATS; return Object.keys(src).map((id) => Object.assign({ id, list: D.TECHS.filter((t) => techGroupId(t) === id) }, src[id])); }
  VIEWS.tech = function () {
    const s = G.s; const lw = s.lastWeek || {}; const ready = techReady(); const groups = techTabs();
    const cur = groups.find((g) => g.id === techTab); if (!cur) techTab = 'can';
    const tabs = `<button class="tk-cat${!cur ? ' on' : ''}" data-act="tech-tab" data-id="can" aria-pressed="${!cur}">可研究 <span>${ready.length}</span></button>` + groups.map((g) => `<button class="tk-cat${cur === g ? ' on' : ''}" data-act="tech-tab" data-id="${g.id}" aria-pressed="${cur === g}" style="--ln:${IC.lineColor(g.id)}">${IC.line(g.id, 16)}${esc(g.name)} <span>${g.list.filter((t) => G.has(t.id)).length}/${g.list.length}</span></button>`).join('');
    const sel = !cur && ready.find((t) => t.id === techSel);
    const body = cur ? techTree(cur) : ready.length ? `<div class="tk-nodes">${ready.map((t) => techNode(t)).join('')}</div>${sel ? techDetail(sel) : ''}` : '<div class="empty">現在沒有能研究的科技，先把研究中的項目做完。</div>';
    return `
    <div class="view-head"><h2>科技</h2><div class="btn-row"><button class="btn" data-act="codex" data-tab="papers">📜 史料庫</button></div><p>研究點 <b class="num">${num(s.rp)}</b>（+${Math.round(lw.rp || 0)}/週${lw.rpIdle ? '，含閒置算力 +' + Math.round(lw.rpIdle) : ''}）。已掌握 ${D.TECHS.filter((t) => G.has(t.id)).length} / ${D.TECHS.length} 項。研究要花時間，開始時先扣研究點。世界還沒公開的科技比較貴也比較久，率先做出來會提升聲望。</p></div>
    ${techSlots()}
    ${G.futureAvailable() ? `<div class="card tk-future"><div><b>🧪 前沿基礎研究 · Lv.${s.futureLv || 0}</b><p class="small muted">可重複研究：每級有效算力 ×1.05、聲望 +1。目前累積 ×${Math.pow(1.05, s.futureLv || 0).toFixed(2)}。</p></div><button class="btn sm primary" data-act="future" ${s.rp >= G.futureCost() ? '' : 'disabled'}>研究（${num(G.futureCost())} 點）</button></div>` : ''}
    <div class="tk-cats">${tabs}</div>${body}`;
  };
  function techSlots() {
    if (!G.researchJobs) return '';
    const jobs = techJobs(); const n = Math.max(G.researchSlots(), jobs.length); let html = '';
    for (let i = 0; i < n; i++) {
      const j = jobs[i]; const t = j && ME.TECH[j.id];
      html += t ? `<button class="tk-slot" data-act="tech-sel" data-id="${t.id}"><span class="ic">${IC.tech(t.id, 24)}</span><span>研究線 ${i + 1} · 還要 ${j.left} 週</span><b>${esc(t.name)}</b><i aria-hidden="true"><em style="width:${techPct(j)}%"></em></i></button>`
        : `<div class="tk-slot idle"><span>研究線 ${i + 1}</span><b>${techQ().length ? '排程的下一項還不能開始' : '空閒中，挑一項科技開始'}</b></div>`;
    }
    const heads = G.roleHeads('res'); const nx = (D.BAL.RES_SLOTS || []).find((x) => heads < x);
    return `<div class="tk-slots">${html}</div>${nx ? `<p class="tk-hint">研究員 ${num(heads)} 人，再招 ${num(nx - heads)} 人可以多開一條研究線。</p>` : ''}${techQueueBar()}`;
  }
  function techPct(j) { return Math.round(Math.max(0, Math.min(1, 1 - j.left / Math.max(1, j.total))) * 100); }
  // 一條路線：依前置關係分階，階數在路線內重新編號
  function techTree(g) {
    const tiers = {}; g.list.forEach((t) => { const d = techDepth(t); (tiers[d] = tiers[d] || []).push(t); });
    const rows = Object.keys(tiers).map(Number).sort((a, b) => a - b).map((d, i) => {
      const L = tiers[d].sort((a, b) => a.cost - b.cost); const sel = L.find((t) => t.id === techSel);
      return `<div class="tk-tier"><span class="tk-no" aria-hidden="true">${i + 1}</span><div class="tk-body"><div class="tk-nodes">${L.map((t) => techNode(t)).join('')}</div>${sel ? techDetail(sel) : ''}</div></div>`;
    }).join('');
    return `${g.desc ? `<p class="tk-desc">${esc(g.desc)}</p>` : ''}<div class="tk-tree">${rows}</div>`;
  }
  function techWeeks(t) { return G.techDur ? G.techDur(t.id) : t.dur; }  // 世界還沒公開的技術會久一點，要問引擎
  function techExclName(t) { const n = D.TECHS.filter((x) => x.excl === t.excl).length; return (EXN[n] || n) + '選一'; }
  function techNode(t) {
    const st = techState(t); const job = st === 'doing' ? techJobs().find((j) => j.id === t.id) : null; const rec = G.s.techs[t.id]; const wk = techWeeks(t);
    const meta = st === 'owned' ? '已掌握' + (rec && rec.pioneer ? ' · 首創' : '') : st === 'doing' ? '研究中 · 還要 ' + job.left + ' 週' : st === 'blocked' ? '已選其他路線' : st === 'locked' ? '需要前置科技' : num(G.techCost(t.id)) + ' 點' + (wk ? ' · ' + wk + ' 週' : '');
    const qi = techQ().indexOf(t.id);
    return `<button class="tk-node st-${st}${techSel === t.id ? ' sel' : ''}" data-act="tech-sel" data-id="${t.id}" aria-expanded="${techSel === t.id}">
      ${qi >= 0 ? `<span class="qn" title="排程第 ${qi + 1} 項">${qi + 1}</span>` : ''}${techTile(t)}<span class="nm">${t.key ? '<span class="ky" title="關鍵科技">★</span>' : ''}${esc(t.name)}</span><span class="mt">${esc(meta)}</span>${t.spec ? '<span class="fr sp">推測</span>' : st !== 'owned' && !G.isPublic(t.id) ? '<span class="fr">前沿</span>' : ''}${t.excl && st !== 'owned' && st !== 'blocked' ? `<span class="ex">${techExclName(t)}</span>` : ''}${job ? `<i aria-hidden="true"><em style="width:${techPct(job)}%"></em></i>` : ''}</button>`;
  }
  function techDetail(t) {
    const st = techState(t); const cost = G.techCost(t.id); const rec = G.s.techs[t.id]; const wk = techWeeks(t);
    const reqs = (t.req || []).filter((r) => !G.has(r)); const others = t.excl ? D.TECHS.filter((x) => x.excl === t.excl && x.id !== t.id) : [];
    const full = techFree() <= 0;
    const qi = techQ().indexOf(t.id); const canStart = st === 'can' && !full;
    const qBtns = qi >= 0 ? `${qi > 0 ? `<button class="btn sm" data-act="tech-q-front" data-id="${t.id}">排到最前面</button>` : ''}<button class="btn sm" data-act="tech-q-del" data-id="${t.id}">移出排程</button>`
      : `<button class="btn sm${canStart ? '' : ' primary'}" data-act="tech-q-add" data-id="${t.id}">加入排程</button>`;
    let foot = '';
    if (st === 'owned') foot = `<span class="muted">${rec && rec.w ? fnYM(rec.w) + ' 完成' : '開局就有'}${rec && rec.pioneer ? '，全球首創' : ''}</span>`;
    else if (st === 'doing') foot = '<span class="muted">取消會退還還沒做完的研究點</span><span class="spacer"></span><button class="btn sm" data-act="research-cancel" data-id="' + t.id + '">取消研究</button>';
    else if (st === 'blocked') foot = `<span class="muted">${esc(G.techBlocked(t.id))}</span>`;
    else if (st === 'locked') {
      const chain = techChain(t.id); const chainCost = chain.reduce((a, x) => a + G.techCost(x), 0);
      foot = `<span class="muted">需要：</span>${reqs.map((r) => `<button class="link" data-act="tech-sel" data-id="${r}">${esc(ME.TECH[r].name)}</button>`).join('、')}<span class="spacer"></span>${qi >= 0 ? qBtns : techReachable(t.id) ? `<button class="btn sm primary" data-act="tech-q-add" data-id="${t.id}">排程到這項（${chain.length} 項 · ${num(chainCost)} 點）</button>` : ''}`;
    } else foot = `<span class="num">${num(cost)} 研究點${wk ? ' · ' + wk + ' 週' : ''}</span><span class="spacer"></span>${full ? '<span class="muted">研究線已滿</span>' : ''}${qBtns}<button class="btn sm ${canStart ? 'primary' : ''}" data-act="research" data-id="${t.id}" ${canStart ? '' : 'disabled'}>${st === 'can' ? '開始研究' : '研究點不足'}</button>`;
    const group = t.excl && D.TECH_EXCL ? D.TECH_EXCL[t.excl] : '';
    return `<div class="tk-detail"><div class="tt">${techTile(t, true)}<b>${esc(t.name)}</b>${t.key ? '<span class="pill warn">★ 關鍵科技</span>' : ''}${t.spec ? '<span class="pill">推測的未來技術</span>' : G.isPublic(t.id) ? '<span class="pill">已公開</span>' : `<span class="pill warn">前沿 · ${esc(t.pub.slice(0, 7))} 公開</span>`}</div>
      <p>${esc(t.desc)}</p>${paperLine(t.id)}
      ${others.length && st !== 'owned' && st !== 'blocked' ? `<p class="tk-warn">${techExclName(t)}${group ? '：' + esc(group) : ''}。研究這項之後，就不能研究「${esc(others.map((x) => x.name).join('」「'))}」。</p>` : ''}
      <div class="ft">${foot}</div></div>`;
  }

  /* ---------- 團隊 ---------- */
  VIEWS.team = function () {
    const s = G.s; const sm = G.salaryMul() * s.payPolicy; const lw = s.lastWeek || {};
    const nx = D.OFFICES[s.office + 1]; const off = D.OFFICES[s.office];
    return `
    <div class="view-head"><h2>團隊</h2><p>人才決定研究速度、訓練效率與模型品質。薪資每年隨 AI 人才戰上漲約 12%。</p></div>
    ${rosterHTML()}
    <div class="grid g4">
      <div class="stat-tile"><span class="l">👥 人數</span><span class="v">${G.totalStaff()} / ${G.officeCap()}</span><span class="s">${off.icon} ${off.name}</span></div>
      <div class="stat-tile"><span class="l">😊 士氣</span><span class="v ${s.morale < 45 ? 'bad' : ''}">${Math.round(s.morale)}</span><span class="s">產出 ×${G.prodMul().toFixed(2)}</span></div>
      <div class="stat-tile"><span class="l">💸 週薪資</span><span class="v">${money((lw.cost || {}).salary || 0)}</span><span class="s">薪資水準 ${pct(s.payPolicy)}</span></div>
      <div class="stat-tile"><span class="l">🛠️ 工程覆蓋</span><span class="v">${pct(Math.min(1, G.engCoverage()))}</span><span class="s">叢集需約 ${Math.ceil(G.engNeeded())} 位工程師</span></div>
    </div>
    <div class="card" style="margin-top:12px"><h3>職能</h3><div class="table-wrap"><table class="t">
      <thead><tr><th>職能</th><th class="n">人數</th><th class="n">平均技能</th><th class="n">週薪/人</th><th>招募 / 裁員</th></tr></thead>
      <tbody>${D.ROLE_ORDER.map((r) => { const st = s.staff[r]; const R = D.ROLES[r]; return `<tr><td><b>${R.icon} ${R.name}</b><div class="small muted">${R.desc}</div></td><td class="n">${st.n}${s.stars.filter((x) => x.role === r).length ? '+' + s.stars.filter((x) => x.role === r).length + '★' : ''}</td><td class="n">${Math.round(st.skill)}</td><td class="n">${money(R.salary * sm)}</td>
        <td><div class="btn-row"><button class="btn sm" data-act="hire" data-role="${r}" data-n="1">+1</button><button class="btn sm" data-act="hire" data-role="${r}" data-n="5">+5</button><button class="btn sm" data-act="hire" data-role="${r}" data-n="20">+20</button><button class="btn sm danger" data-act="fire" data-role="${r}" data-n="1" ${st.n ? '' : 'disabled'}>−1</button></div></td></tr>`; }).join('')}</tbody></table></div>
      <p class="small muted" style="margin:8px 0 0">招募費 = 2 週薪資。新人技能取決於聲望、社群、薪資水準與明星加成。</p></div>
    <div class="grid g2" style="margin-top:12px">
      <div class="card"><h3>政策</h3><div class="stack">
        <div class="row"><span class="small muted">薪資水準</span><div class="seg-ctl">${[0.8, 1, 1.2, 1.5].map((v) => `<button data-act="pay" data-v="${v}" class="${Math.abs(s.payPolicy - v) < 0.01 ? 'on' : ''}">${pct(v)}</button>`).join('')}</div></div>
        <label class="toggle"><input type="checkbox" data-act="crunch" ${s.crunch ? 'checked' : ''}> 加班衝刺（研究與訓練加速，士氣持續下滑、故障率上升）</label>
        <label class="toggle"><input type="checkbox" data-act="trainprog" ${s.trainProg ? 'checked' : ''}> 員工培訓計畫（技能成長加快、士氣 +，薪資 +6%）</label>
      </div></div>
      <div class="card"><h3>辦公室</h3>
        <div class="office-pair">
          <figure><img src="${off.img}" alt="${off.name}" width="1200" height="820" loading="lazy"><figcaption><b>現在：${off.icon} ${off.name}</b><br><span class="small muted">${esc(D.OFFICE_DESC[off.lv] || '')}</span></figcaption></figure>
          ${nx ? `<figure class="next"><img src="${nx.img}" alt="${nx.name}" width="1200" height="820" loading="lazy"><figcaption><b>下一級：${nx.icon} ${nx.name}</b><br><span class="small muted">人數上限 ${nx.cap} · 月租 ${money(nx.rent * 4.3)} · 同時訓練 ${nx.lv >= 3 ? 3 : nx.lv >= 1 ? 2 : 1} 個</span></figcaption></figure>` : ''}
        </div>
        ${s.officeBuild ? `<p class="small" style="margin:8px 0 0">🏗️ 正在搬遷到「${D.OFFICES[s.officeBuild.lv].name}」，第 ${s.officeBuild.done} 週完成。</p>` : nx ? `<div class="row" style="margin-top:8px"><span class="small muted">${esc(D.OFFICE_DESC[nx.lv] || '')}</span><span class="spacer"></span><button class="btn primary sm" data-act="office" ${s.cash >= nx.cost ? '' : 'disabled'}>升級 ${money(nx.cost)}</button></div>` : '<p class="small muted" style="margin:8px 0 0">已是最高等級。</p>'}</div>
    </div>
    <div class="card" style="margin-top:12px"><h3>明星人才</h3>
      ${s.stars.length ? `<div class="grid g2">${s.stars.map((x) => starHTML(x, true)).join('')}</div>` : '<p class="small muted" style="margin:0 0 6px">還沒有明星人才。</p>'}
      <div class="divider"></div><div class="sec-title">人才市場 <span class="faint">（每月更新，名單約 10 週後過期）</span></div>
      ${s.starPool.length ? `<div class="grid g2">${s.starPool.map((p) => { const c = G.STAR[p.id]; return c ? starHTML(Object.assign({}, c, { salary: G.starSalary(c) * p.disc, disc: p.disc, exp: p.exp }), false) : ''; }).join('')}</div>` : '<p class="small muted" style="margin:0">目前沒有候選人。</p>'}
    </div>`;
  };
  function starHTML(x, hired) {
    const tr = D.TRAITS[x.trait] || { name: x.trait, desc: '' };
    const v = Math.round((0.6 + (x.skill - 70) / 50) * ({ scaling: 10, infra: 8, data_guru: 5, safety_mom: 8, rl_wizard: 7, product_genius: 25, deal_maker: 20, mm_artist: 8, agent_pioneer: 8, efficiency_hacker: 12, fundraiser: 12, open_evang: 30 }[x.trait] || 10));
    return `<div class="card" style="padding:10px"><div class="row"><b>${esc(x.name)}</b><span class="pill acc">${D.ROLES[x.role].icon} ${D.ROLES[x.role].name}</span><span class="pill">技能 ${x.skill}</span><span class="spacer"></span><span class="num small">${money(x.salary)}/週</span></div>
      <div class="small muted">${esc(x.title || '')}</div>
      <div class="small" style="margin:4px 0"><b>${esc(tr.name)}</b>：${esc(tr.desc.replace('{v}', v))}</div>
      ${x.bio ? `<div class="small muted">「${esc(x.bio)}」</div>` : ''}
      ${hired ? '' : `<div class="row" style="margin-top:6px">${x.disc < 1 ? '<span class="pill good">特別優惠</span>' : ''}<span class="small muted">簽約金 ${money(x.salary * 8)}</span><span class="spacer"></span><button class="btn sm primary" data-act="hire-star" data-id="${x.id}">簽下</button></div>`}</div>`;
  }

  /* ---------- 算力 ---------- */
  /* 推理缺口：少賺多少、買什麼補得最多。營收和服務率成正比，所以全部服務得到時的營收 ≈ 上週營收 ÷ 上週服務率。
     自有和租用用現在的狀態重算，剛買的卡、剛開的自動租用馬上算進來，才不會讓人重複買 */
  function inferGap() {
    const s = G.s; const lw = s.lastWeek || {}; const need = lw.inferNeed || 0; if (need <= 1) return null;
    const served = lw.served == null ? 1 : lw.served; const owned = G.ownedEq(); const B = D.BAL;
    const own = Math.min(s.trainFirst ? Math.max(0, owned - G.reservedEq()) : owned, need);
    const rentRoom = Math.min(G.inferRentCap(), need - own); const rent = s.autoRent ? rentRoom : 0;
    const have = own + rent; const servedNow = Math.min(1, have / need); if (servedNow >= 0.95) return null;
    const short = need - have; const full = served > 0.02 ? (lw.rev || 0) / served : 0; const lost = full * (1 - servedNow);
    const keep = 1 - G.opsRate();  // 多賺的營收要先扣營運成本
    const free = Math.max(0, G.dcSlots() - G.cardCount()); const budget = s.cash * 0.8;  // 留兩成現金週轉
    const avail = D.GPUS.filter((x) => G.gpuAvail(x.id));
    let buy = null;
    for (const x of avail) {
      const price = G.gpuPrice(x.id); const n = Math.min(free, Math.ceil(short / x.pf), Math.floor(budget / price)); if (n < 1) continue;
      const eq = Math.min(short, n * x.pf); const cost = n * price;
      if (!buy || eq > buy.eq + 1e-6 || (Math.abs(eq - buy.eq) <= 1e-6 && cost < buy.cost)) buy = { x, n, eq, cost };
    }
    if (buy) {
      buy.served = Math.min(1, (have + buy.eq) / need);
      const power = buy.n * Math.pow(buy.x.pf, B.POWER_EXP) * B.OPEX_PER_CARD * (1 + B.POWER_INFL * G.yrs) * G.techProd('power');
      buy.net = full * (buy.served - servedNow) * keep - power;
      buy.weeks = buy.net > 0 ? Math.ceil(buy.cost / buy.net) : 0;
    }
    const top = avail.slice().sort((a, b) => b.pf - a.pf)[0]; const fullN = top ? Math.ceil(short / top.pf) : 0;
    return { need, own, rent, rentRoom, short, servedNow, lost, buy, top, fullN, fullCost: top ? fullN * G.gpuPrice(top.id) : 0, free };
  }
  function gapCard() {
    const g = inferGap(); if (!g) return '';
    const s = G.s; const b = g.buy; const nx = D.DATACENTERS[s.dc + 1]; const lines = [];
    const w = (v) => (v / g.need * 100).toFixed(2) + '%';
    if (!s.autoRent && g.rentRoom > 0) lines.push(`<span>開啟自動租用可以馬上多 <b class="num">${num(g.rentRoom)}</b> 算力，每週約 ${money(g.rentRoom * G.rentPrice())}。</span><button class="btn sm" data-act="gap-rent">開啟</button>`);
    else if (s.autoRent && g.rent >= G.inferRentCap() - 1) lines.push(`<span>自動租用已經到上限（${num(G.inferRentCap())}），剩下的要靠自己買卡。</span>`);
    if (g.top && g.fullN > (b ? b.n : 0)) lines.push(`<span>全部補滿要 <b class="num">${num(g.fullN)}</b> 張 ${esc(g.top.name)}，約 ${money(g.fullCost)}。</span>`);
    if (g.fullN > g.free) {
      if (s.dcBuild) lines.push(`<span>機房還差 ${num(g.fullN - g.free)} 槽；「${esc(D.DATACENTERS[s.dcBuild.lv].name)}」第 ${s.dcBuild.done} 週完工。</span>`);
      else if (nx) lines.push(`<span>機房還差 ${num(g.fullN - g.free)} 槽，下一級「${esc(nx.name)}」要 ${money(nx.cost)}、${nx.weeks} 週。</span><button class="btn sm" data-act="dc" ${s.cash >= nx.cost && (!nx.from || G.ym >= nx.from) ? '' : 'disabled'}>興建</button>`);
      else lines.push('<span>機房已是最高等級：賣掉舊卡、換上效能更高的卡，才能再增加算力。</span>');
    }
    const worth = b && b.weeks && b.weeks <= 104;  // 兩年內回本才算划算
    const plan = b ? `<div class="gap-plan">${IC.gpu(b.x.id, 50)}<div class="tx"><b>買 ${num(b.n)} 張 ${esc(b.x.name)}</b><span class="small">花 ${money(b.cost)}，服務率升到約 ${pct(b.served)}${b.weeks ? `，扣掉營運成本和電費每週多賺約 ${money(b.net)}，約 ${num(b.weeks)} 週回本` : '，但以目前的定價回不了本'}${worth ? '' : '。也可以調高定價來降低需求'}</span></div><button class="btn${worth ? ' primary' : ''}" data-act="gap-buy" data-id="${b.x.id}" data-n="${b.n}">一鍵採購</button></div>`
      : `<p class="small gap-none">${!g.top ? '現在買不到可用的 GPU。' : g.free < 1 ? '機房已滿，要先擴建才能買卡。' : '現金不夠買卡，可以先募資。'}</p>`;
    return `<section class="gap" aria-label="推理算力缺口">
      <div class="gap-hd"><span class="ic" aria-hidden="true">🔥</span><div><b>推理算力不夠，每週少了約 <em class="num">${money(g.lost)}</em> 營收</b><span class="small muted">服務率 ${pct(g.servedNow)}。沒服務到的用戶還會讓聲望下滑。</span></div></div>
      <div class="alloc" role="img" aria-label="需求 ${num(g.need)}：自有 ${num(g.own)}、租用 ${num(g.rent)}、缺 ${num(g.short)}"><span style="width:${w(g.own)};background:var(--accent)"></span><span style="width:${w(g.rent)};background:color-mix(in srgb, var(--accent) 45%, transparent)"></span><span class="short" style="width:${w(g.short)}"></span></div>
      <div class="legend"><span><i style="background:var(--accent)"></i>自有 ${num(g.own)}</span><span><i style="background:color-mix(in srgb, var(--accent) 45%, transparent)"></i>租用 ${num(g.rent)}</span><span><i class="short"></i>缺 ${num(g.short)}（H100 等效）</span></div>
      ${plan}
      ${lines.length ? `<div class="gap-more">${lines.map((l) => `<div>${l}</div>`).join('')}</div>` : ''}
    </section>`;
  }
  VIEWS.compute = function () {
    const s = G.s; const lw = s.lastWeek || {}; const owned = G.ownedEq();
    const inferOwn = lw.ownInfer || 0; const train = Math.max(0, owned - inferOwn - (lw.idle || 0));
    const total = Math.max(1, owned + (lw.rentEq || 0));
    const seg = (v, c, t) => v > 0 ? `<span style="width:${(v / total * 100).toFixed(2)}%;background:${c}" title="${t}"></span>` : '';
    const dcNx = D.DATACENTERS[s.dc + 1]; const dc = D.DATACENTERS[s.dc];
    const avail = D.GPUS.filter((g) => G.gpuAvail(g.id));
    // 方案 H 的白色展台：GB200 NVL72、DGX H100、B300 封裝；上面列出自己的 GPU 組成與即將上市的型號
    const mix = gpuMix(); const soon = D.GPUS.filter((g) => g.hi && !g.special && g.from > G.ym).slice(0, 2);
    return `
    <div class="view-head"><h2>算力</h2><p>算力同時用來「訓練」與「推理服務」。預設推理優先：用戶在用的卡先保留，剩下才給訓練，閒置的卡會加速研究。</p></div>
    ${gapCard()}
    <section class="showcase" aria-label="設備展台"><img src="assets/bg_studio.webp" alt="設備展台：GB200 NVL72 整櫃、DGX H100、B300 與 H100 封裝" loading="lazy">
      <div class="sc-info"><span class="cap">DEVICE SHOWCASE · 設備展台</span><b>${num(G.cardCount())} 張卡 · ≈ ${num(owned)} H100</b>
        <div class="plaques">${mix.length ? mix.map((g) => `<span class="plaque">${IC.gpu(g.type, 30)}<b>${esc(ME.GPU[g.type].name)}</b>×${num(g.n)}</span>`).join('') : '<span class="plaque">還沒有自有 GPU</span>'}</div>
        ${soon.length ? `<span class="soon">即將上市：${soon.map((g) => `${IC.gpu(g.id, 24)}<b>${esc(g.name)}</b> ${g.from.replace('-', '.')}`).join('　')}</span>` : ''}</div></section>
    <div class="grid g4">
      <div class="stat-tile"><span class="l">🖥️ 自有算力</span><span class="v">${num(owned)}</span><span class="s">H100 等效 · ${num(G.cardCount())} 張卡</span></div>
      <div class="stat-tile"><span class="l">🗄️ 機房槽位</span><span class="v">${num(G.cardCount())}<small> / ${num(G.dcSlots())}</small></span><span class="s">${dc.icon} ${dc.name}</span></div>
      <div class="stat-tile"><span class="l">☁️ 本週租用</span><span class="v">${num(lw.rentEq || 0)}</span><span class="s">上限 ${num(G.rentCap())} · $${Math.round(G.rentPrice())}/卡/週</span></div>
      <div class="stat-tile"><span class="l">📡 推理服務率</span><span class="v ${lw.served < 0.95 ? 'bad' : 'good'}">${pct(lw.served == null ? 1 : lw.served)}</span><span class="s">需求 ${num(lw.inferNeed || 0)} 卡</span></div>
    </div>
    <div class="card" style="margin-top:12px"><h3>本週分配</h3>
      <div class="alloc">${seg(inferOwn, 'var(--accent)', '推理（自有）')}${seg(lw.inferRent || 0, 'color-mix(in srgb, var(--accent) 45%, transparent)', '推理（租用）')}${seg(train, 'var(--amber)', '訓練（自有）')}${seg(lw.trainRent || 0, 'color-mix(in srgb, var(--amber) 45%, transparent)', '訓練（租用）')}${seg(lw.idle || 0, 'var(--line)', '閒置')}</div>
      <div class="legend"><span><i style="background:var(--accent)"></i>推理 ${num(inferOwn + (lw.inferRent || 0))}</span><span><i style="background:var(--amber)"></i>訓練 ${num(train + (lw.trainRent || 0))}</span><span><i style="background:var(--line)"></i>閒置 ${num(lw.idle || 0)}</span><span>MFU ${pct(G.mfu())}</span></div>
      <div class="row" style="margin-top:10px;gap:16px">
        <label class="toggle"><input type="checkbox" data-act="autorent" ${s.autoRent ? 'checked' : ''}> 推理不足時自動租用雲端</label>
        <div class="row"><span class="small muted">優先順序</span><div class="seg-ctl"><button data-act="prio" data-v="infer" class="${s.trainFirst ? '' : 'on'}">推理優先</button><button data-act="prio" data-v="train" class="${s.trainFirst ? 'on' : ''}">訓練優先</button></div></div>
      </div></div>
    <div class="card" style="margin-top:12px"><h3>採購 GPU <span class="right small muted">卡價每年約降 20%；新卡每槽位效能更高</span></h3>
      ${s.embargo ? '<p class="small bad" style="margin:0 0 8px">⛓️ 出口管制中：高階 GPU 無法購買，境外雲租價 ×2.2。</p>' : s.flags && s.flags.cityControl ? '<p class="small bad" style="margin:0 0 8px">⛓️ 出口管制中：高階 GPU 購卡價 ×1.6、境外雲租價 ×1.3。</p>' : ''}
      <div class="table-wrap"><table class="t"><thead><tr><th>型號</th><th class="n">H100 等效</th><th class="n">單價</th><th class="n">每等效單價</th><th>購買</th></tr></thead><tbody>
      ${avail.map((g) => { const p = G.gpuPrice(g.id); return `<tr><td><span class="hw">${IC.gpu(g.id, 50)}<b>${g.name}</b></span></td><td class="n">${g.pf}×</td><td class="n">${money(p)}</td><td class="n">${money(p / g.pf)}</td><td><div class="btn-row">${D.GPU_PACKS.filter((n) => n <= Math.max(64, G.dcSlots())).map((n) => `<button class="btn sm" data-act="buy-gpu" data-id="${g.id}" data-n="${n}" ${s.cash >= p * n && G.cardCount() + n <= G.dcSlots() ? '' : 'disabled'}>+${num(n)}</button>`).join('')}</div></td></tr>`; }).join('')}
      </tbody></table></div></div>
    <div class="grid g2" style="margin-top:12px">
      <div class="card"><h3>庫存</h3>${s.gpus.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>型號</th><th class="n">數量</th><th class="n">等效</th><th>出售（半價）</th></tr></thead><tbody>${s.gpus.map((g) => `<tr><td><span class="hw">${IC.gpu(g.type, 38)}${ME.GPU[g.type].name}</span></td><td class="n">${num(g.n)}</td><td class="n">${num(g.n * ME.GPU[g.type].pf)}</td><td><button class="btn sm danger" data-act="sell-gpu" data-id="${g.type}" data-n="${Math.max(1, Math.floor(g.n / 2))}">賣一半</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="small muted" style="margin:0">沒有自有 GPU。</p>'}</div>
      <div class="card"><h3>機房</h3><div class="row hw-dc">${IC.dc(s.dc, 72)}<div><b>現在：${dc.name}</b><div class="small muted">槽位 ${num(dc.slots)} · 週維運 ${money(dc.upkeep)}</div></div></div>${s.dcBuild ? `<div class="row hw-dc">${IC.dc(s.dcBuild.lv, 72)}<p class="small" style="margin:0">🏗️ 「${D.DATACENTERS[s.dcBuild.lv].name}」興建中，第 ${s.dcBuild.done} 週完工。</p></div>` : dcNx ? `<div class="row hw-dc">${IC.dc(dcNx.lv, 72)}<div><b>${dcNx.name}</b><div class="small muted">槽位 ${num(dcNx.slots)} · 工期 ${dcNx.weeks} 週 · 週維運 ${money(dcNx.upkeep)}${dcNx.from ? ' · ' + dcNx.from + ' 後可建' : ''}</div></div><span class="spacer"></span><button class="btn primary sm" data-act="dc" ${s.cash >= dcNx.cost && (!dcNx.from || G.ym >= dcNx.from) ? '' : 'disabled'}>興建 ${money(dcNx.cost)}</button></div>` : '<p class="small muted" style="margin:0">已是最高等級。</p>'}
        <p class="small muted" style="margin:8px 0 0">本週電費 ${money((lw.cost || {}).power || 0)}：效能越高的卡越耗電；超出槽位的卡無法上架。</p></div>
    </div>`;
  };

  /* ---------- 資料 ---------- */
  VIEWS.data = function () {
    const s = G.s;
    return `
    <div class="view-head"><h2>資料</h2><p>資料量決定能餵多大的模型，品質決定每個 token 的營養。重複使用超過 4 輪幾乎沒有效果：這就是「資料牆」。</p></div>
    <div class="card"><h3>資料池</h3><div class="table-wrap"><table class="t"><thead><tr><th>類型</th><th class="n">存量</th><th>網路可取得上限</th><th class="n">品質</th></tr></thead><tbody>
      ${D.MIX_KEYS.map((k) => { const p = s.data[k]; const cap = G.poolCap(k); return `<tr><td><b>${D.DATA_POOLS[k].icon} ${D.DATA_POOLS[k].name}</b></td><td class="n">${tok(p.amt)}</td><td style="min-width:140px"><div class="bar"><i style="width:${Math.min(100, p.amt / cap * 100)}%"></i></div><span class="small muted">${tok(cap)}</span></td><td class="n">${Math.round(p.q * 100)}</td></tr>`; }).join('')}
      <tr><td><b>✍️ 指令 / 偏好資料</b></td><td class="n">${Math.round(s.data.inst)}K 筆</td><td class="small muted">後訓練用，越多效果越好</td><td class="n">—</td></tr>
    </tbody></table></div>
    <div class="row small" style="margin-top:8px"><span class="muted">資料法律風險</span><div class="bar ${s.data.risk > 0.15 ? 'bad' : 'amber'}" style="width:160px"><i style="width:${Math.min(100, s.data.risk * 100 * 3)}%"></i></div><span class="num">${pct(s.data.risk, 1)}</span><span class="muted">（越高越容易被告）</span></div></div>
    <div class="grid g2" style="margin-top:12px">
      <div class="card"><h3>取得方式</h3><div class="stack">
        <label class="toggle"><input type="checkbox" data-act="crawl" ${s.crawl ? 'checked' : ''}> 持續爬取公開資料（每位資料工程師每週約 28B 網頁 token）</label>
        <label class="toggle"><input type="checkbox" data-act="crawl-aggr" ${s.crawlAggr ? 'checked' : ''}> 激進爬取：無視 robots.txt（量 ×1.7，法律風險與監管壓力上升）</label>
        <label class="toggle"><input type="checkbox" data-act="userdata" ${s.userData ? 'checked' : ''}> 用使用者對話訓練（大量指令資料，但監管壓力上升、聲望下滑）</label>
        <div class="divider"></div>
        <div class="row"><div><b>✍️ 外包標註</b><div class="small muted">每 K 筆 ${money(G.instPrice())}，大量 8 折</div></div><span class="spacer"></span><button class="btn sm" data-act="inst" data-n="20">+20K</button><button class="btn sm" data-act="inst" data-n="100">+100K</button></div>
        ${G.has('t_synth') ? '<div class="row"><div><b>🧬 合成資料</b><div class="small muted">用自家模型生成語料，突破資料牆</div></div><span class="spacer"></span><button class="btn sm primary" data-act="open-synth">開始</button></div>' : '<p class="small muted" style="margin:0">研究「合成資料管線」後可用自家模型生成資料。</p>'}
      </div></div>
      <div class="card"><h3>授權交易 <span class="right small muted">每項每年可買一次</span></h3><div class="stack">
        ${D.DATA_DEALS.map((d) => { const ok = G.dealAvailable(d); const p = G.dealPrice(d); return `<div class="row"><span class="tk-ic">${IC.deal(d.id)}</span><div style="min-width:0;flex:1"><b>${d.name}</b><div class="small muted">${D.DATA_POOLS[d.pool].icon} +${tok(d.amt)} · 品質 ${Math.round(d.q * 100)} · ${esc(d.desc)}</div></div><button class="btn sm" data-act="deal" data-id="${d.id}" ${ok && s.cash >= p ? '' : 'disabled'}>${ok ? money(p) : d.from && G.ym < d.from ? d.from + ' 開放' : '今年已購'}</button></div>`; }).join('')}
      </div></div>
    </div>`;
  };

  /* ---------- 市場 ---------- */
  /* ---------- 全球佔領圖（src/globe.js）：畫面的 canvas 只建一次，每次重畫頁面時搬回新的插槽 ---------- */
  let globe = null; let gbSel = null; let gbM = null;
  function gbData() {
    const s = G.s; const segs = D.SEG_ORDER.filter((k) => G.segActive(k));
    const bySeg = (share) => segs.reduce((o, k) => { o[k] = share(k); return o; }, {});
    const best = G.bestModel();
    const me = { id: 'me', player: true, name: s.company, icon: mascot().icon, seg: bySeg((k) => G.playerShare(k)), city: G.city().id, open: !!(best && best.rel && best.rel.open), price: 1 };
    const rivals = D.RIVALS.map((R) => ({ id: R.id, name: R.name, icon: R.icon, color: R.color, seg: G.ym >= R.start ? bySeg((k) => G.rivalShare(R.id, k)) : {}, open: R.open, price: R.price }));
    return GLOBE.market({ companies: [me].concat(rivals), segs: bySeg((k) => G.segValue(k)), date: ME.weekDate(s.week) });
  }
  function gbPick(id) {
    gbSel = id && id !== gbSel ? id : null;
    renderView();
    if (gbSel) globe.focus(gbSel);
  }
  function gbMount() {
    const slot = document.getElementById('gb-slot'); if (!slot || !gbM) return;
    if (!globe) globe = GLOBE.create({ onPick: gbPick, spin: uiPref('gbSpin', true), t: ZH.t });
    globe.setData(gbM, gbSel); globe.mount(slot);
  }
  VIEWS.market = function () {
    const s = G.s; const lb = G.leaderboard().slice(0, 16); const lw = s.lastWeek || {};
    gbM = gbData();
    const segs = D.SEG_ORDER.filter((k) => G.segActive(k));
    const refTxt = (ref, unit) => '$' + (ref < 1 ? ref.toFixed(2) : ref < 100 ? ref.toFixed(1) : Math.round(ref)) + unit;
    return `
    <div class="view-head"><h2>市場</h2><p>每個市場看重的能力不同，加上價格、品牌與通路決定市佔。對手每隔幾個月就會發布新模型。</p></div>
    ${GLOBE.panel(gbM, { sel: gbSel, spin: uiPref('gbSpin', true), esc, money, ym: G.ym.replace('-', '.') })}
    <div class="card"><h3>各市場 <span class="right small muted">本週規模、參考價與你的市佔</span></h3>
      <div class="seg-tiles">${segs.map((k) => { const g = D.SEGMENTS[k]; const elig = !g.tech || G.has(g.tech); const sh = G.playerShare(k); return `<div class="seg-tile${elig ? '' : ' locked'}">
        <div class="st-hd"><span class="ic">${g.icon}</span><b>${g.name}</b></div>
        <span class="sz num">${money(G.segValue(k))}<small>/週</small></span>
        <span class="small muted">參考價 ${refTxt(G.refPrice(k), g.priceUnit)}</span>
        <div class="share" title="你的市佔"><div class="bar"><i style="width:${Math.min(100, sh * 100).toFixed(1)}%"></i></div><span class="num">${pct(sh, 1)}</span></div>
        <span class="small">${elig ? `週營收 <b class="num">${money((lw.revSeg || {})[k] || 0)}</b>` : `🔒 需研究「${esc(ME.TECH[g.tech].name)}」`}</span>${elig && lw.usage && lw.usage[k] > 0 && ME.USAGE && ME.USAGE[k] ? `<span class="small muted"><i class="live-dot" aria-hidden="true"></i>${esc(ME.USAGE[k].unit)} <b class="num">${num(Math.round(lw.usage[k]))}</b>${ME.USAGE[k].per ? '/' + ME.USAGE[k].per : ''}</span>` : ''}</div>`; }).join('')}</div>
      <div class="row" style="margin-top:12px"><span class="small muted">行銷預算</span><div class="seg-ctl">${D.MARKETING.map((v, i) => `<button data-act="mkt" data-v="${i}" class="${s.marketing === i ? 'on' : ''}">${v ? money(v) : '無'}</button>`).join('')}</div><span class="small muted">/週，提升對話 App 與創作市場吸引力</span></div>
    </div>
    <div class="card" style="margin-top:12px"><h3>模型排行榜 <span class="right small muted">綜合分（權重隨時代改變）</span></h3><div class="table-wrap"><table class="t rank-t">
        <thead><tr><th class="n">#</th><th>模型</th><th>公司</th><th class="n">綜合</th><th class="n">推理</th><th class="n">程式</th><th class="n">Agent</th></tr></thead><tbody>
        ${lb.map((r, i) => `<tr class="${r.player ? 'me' : ''}"><td class="n"><span class="rk r${i + 1}">${i + 1}</span></td><td><b>${esc(r.name)}</b>${mvHTML(r, i)}${r.open ? ' <span class="pill acc">開源</span>' : ''}</td><td><span class="org"><i style="--oc:${r.player ? 'var(--accent)' : r.color}">${r.icon}</i>${esc(r.org)}</span></td><td class="n"><b>${r.comp.toFixed(1)}</b></td><td class="n">${Math.round(r.stats.reason || 0)}</td><td class="n">${Math.round(r.stats.code || 0)}</td><td class="n">${Math.round(r.stats.agent || 0)}</td></tr>`).join('')}
        </tbody></table></div></div>
    <div class="grid g2" style="margin-top:12px">
      <div class="card"><h3>對手公司</h3><div class="rivals">${D.RIVALS.filter((R) => G.ym >= R.start).map((R) => { const rv = s.rivals[R.id]; const m = rv.models[rv.models.length - 1]; const sh = gbM.byId[R.id].share; const wk = Math.max(0, rv.next - s.week); return `<div class="rival-card" style="--rc:${R.color}"><span class="ic">${R.icon}</span>
          <div class="rv-main"><b>${R.name}</b><span class="small muted">${R.style} · 最新 ${m ? esc(m.name) : '—'}</span><div class="share"><div class="bar"><i style="width:${Math.min(100, sh * 100).toFixed(1)}%"></i></div><span class="num small">市佔 ${pct(sh)}</span></div></div>
          <div class="rv-score"><b class="num">${m ? G.composite(m.stats).toFixed(1) : '—'}</b><span class="small muted">${wk ? '下一代約 ' + wk + ' 週後' : '新模型即將發布'}</span></div></div>`; }).join('')}</div></div>
      <div class="card"><h3>企業標案 <span class="right small muted">任一上線模型達標就自動得標 · 已完成 ${s.rfpDone || 0} 個</span></h3>
      ${(s.rfps || []).length ? `<div class="stack">${s.rfps.map((r) => { const q = G.rfpQualifier(r); return `<div class="rfp"><div class="row"><b>${esc(r.client)}</b><span class="pill">${esc(r.need)}</span><span class="spacer"></span><b class="num">${money(r.reward)}</b></div><div class="badges" style="margin-top:6px">${Object.keys(r.req).map((k) => `<span class="pill">${D.STATS[k].name} ≥ ${r.req[k]}</span>`).join('')}${r.maxPrice ? '<span class="pill">定價 ≤ 市場價</span>' : ''}<span class="pill ${r.dl - s.week < 6 ? 'warn' : ''}">剩 ${r.dl - s.week} 週</span>${q ? '<span class="pill good">可交付</span>' : ''}</div></div>`; }).join('')}</div>` : '<div class="empty"><span class="em">📝</span><b>目前沒有開放中的標案</b><span class="small">2023 年中以後，每個月都可能有企業來招標。</span></div>'}
      </div>
    </div>`;
  };

  /* ---------- 資本 ---------- */
  VIEWS.finance = function () {
    const s = G.s; const lw = s.lastWeek || {}; const r = G.nextRound(); const rd = G.roundReady();
    const costNames = { salary: '薪資', office: '辦公室租金', dc: '機房維運', power: '電費與維護', rent: '雲端租用', mkt: '行銷', ops: '營運成本', fine: '監管罰款' };
    const amt = r ? s.valuation * r.dil / (1 - r.dil) : 0;
    return `
    <div class="view-head"><h2>資本</h2><p>估值綜合營收、模型實力、排名、資產與聲望。結算分數看的是你持股的身價。</p></div>
    <div class="grid g4">
      <div class="stat-tile"><span class="l">🏛️ ${s.ipo ? '市值' : '估值'}</span><span class="v">${money(s.valuation)}</span><span class="s">${s.ipo ? '已上市' : '未上市'}</span></div>
      <div class="stat-tile"><span class="l">🧑‍💼 你的持股</span><span class="v">${pct(s.equity, 1)}</span><span class="s">身價 ${money(s.valuation * s.equity)}</span></div>
      <div class="stat-tile"><span class="l">💰 已募資</span><span class="v">${money(s.raised)}</span><span class="s">${s.ipo ? '可定期增發' : '下一輪：' + (r ? r.name : '—')}</span></div>
      <div class="stat-tile"><span class="l">📊 年化營收</span><span class="v">${money(G.avgRevenue() * 52)}</span><span class="s">近 4 週平均 × 52</span></div>
    </div>
    <div class="grid g2" style="margin-top:12px">
      <div class="card"><h3>募資</h3>${r ? `<div class="stack"><div class="row"><b>${r.name}</b><span class="pill">稀釋 ${pct(r.dil)}</span><span class="spacer"></span><span class="num">可募約 ${money(amt)}</span></div>
        <div class="small muted">條件：${esc(r.reqText)}；每輪間隔至少 26 週。</div>
        <div class="row">${rd.ok ? '<span class="pill good">條件已達成</span>' : `<span class="pill warn">${esc(rd.why)}</span>`}<span class="spacer"></span><button class="btn primary" data-act="raise" ${rd.ok ? '' : 'disabled'}>${s.ipo ? '增發' : '進行募資'}</button></div></div>` : '<p class="small muted" style="margin:0">沒有可進行的募資。</p>'}
        <div class="divider"></div>
        <div class="row"><div><b>🩹 過橋貸款</b><div class="small muted">一次性取得約 10 週支出的現金，代價是 7% 股權</div></div><span class="spacer"></span><button class="btn sm" data-act="loan" ${s.flags.loanUsed ? 'disabled' : ''}>${s.flags.loanUsed ? '已使用' : '申請'}</button></div>
        <p class="small muted" style="margin:8px 0 0">現金連續 10 週為負就會破產。</p></div>
      <div class="card"><h3>上週損益</h3><div class="table-wrap"><table class="t"><tbody>
        ${D.SEG_ORDER.filter((k) => (lw.revSeg || {})[k]).map((k) => `<tr><td>${D.SEGMENTS[k].icon} ${D.SEGMENTS[k].name}</td><td class="n good">+${money(lw.revSeg[k])}</td></tr>`).join('')}
        ${Object.keys(lw.cost || {}).filter((k) => lw.cost[k] > 0).map((k) => `<tr><td>${costNames[k] || k}</td><td class="n bad">−${money(lw.cost[k])}</td></tr>`).join('')}
        <tr><td><b>淨額</b></td><td class="n"><b class="${(lw.rev || 0) - (lw.exp || 0) >= 0 ? 'good' : 'bad'}">${money((lw.rev || 0) - (lw.exp || 0))}</b></td></tr>
      </tbody></table></div></div>
    </div>
    <div class="card" style="margin-top:12px"><h3>估值走勢</h3>${chartHTML([{ k: 'val', name: '估值', color: 'var(--accent)' }, { k: 'cash', name: '現金', color: 'var(--amber)' }], money)}</div>
    <div class="card" style="margin-top:12px"><h3>成就 <span class="right small muted">${Object.keys(s.ach).length} / ${D.ACHIEVEMENTS.length}</span></h3>${achHTML()}</div>`;
  };
  function achHTML() { return `<div class="ach-grid">${D.ACHIEVEMENTS.map((a) => `<div class="ach ${G.s.ach[a.id] ? '' : 'off'}"><span class="ic">${a.icon}</span><b>${esc(a.name)}</b><span class="small muted">${esc(a.desc)}</span></div>`).join('')}</div>`; }

  /* ---------- 結局 ---------- */
  /* ---------- 結局演出 ----------
     全螢幕一幕一幕播：結局標題 → 編年史（估值曲線跟著年份長）→ 最終排名（由後往前揭曉）→ 成績揭曉 → 結算卡。
     按「繼續」、點畫面或按空白鍵：動畫還在跑就先播完，播完才到下一幕。看過一次後（flags.endSeen）讀檔只顯示結算卡，可以重看 */
  const FN_TONE = {
    agi_good: { a: '#ffc46b', g: '#4a2f5e', say: '謝謝你當初沒有跳過安全審查。接下來的世界，我們一起看。', hint: '抵達那條線的時候，安全帶有沒有繫好？' },
    agi_open: { a: '#ff9f5a', g: '#4a2a1c', say: '權重放出去了。從今天起它是大家的，老闆，我們做了一件很大的事。', hint: '抵達終點的那天，鑰匙要留給誰？' },
    agi_bad: { a: '#ff7b7b', g: '#47182a', say: '老闆，我有點怕……但不管接下來怎樣，我都會陪著你。', dark: 1, hint: '油門踩到底，煞車在哪裡就沒人知道了。' },
    rival_agi: { a: '#ff8a5c', g: '#2b1f3a', say: '我們差一點就到了。下一局，換我們站在台上。', dark: 1, hint: '最後一段路，別只看自己的錶。' },
    treaty: { a: '#c9d6ff', g: '#25304f', say: '競賽停了。我不知道這是不是對的，但今晚大家都睡得著。', hint: '競賽快結束時，桌上會多一份不太一樣的文件。' },
    steward: { a: '#7fe3d0', g: '#123f4a', say: '全世界都照我們寫的規則走。這比排行榜第一難多了。', hint: '不用跑第一，也能讓大家照你的方式跑。' },
    state: { a: '#e8c36a', g: '#3a3222', say: '訂單和算力都不用愁了。只是，發表會的稿子要先送審。', hint: '有一通電話，接起來就不只是一家公司了。' },
    everyman: { a: '#8fd46a', g: '#1f3f24', say: '我們不是最強的，但我們是大家每天都在用的那一個。', hint: '價格牌可以改到多低？' },
    niche: { a: '#9ec5ff', g: '#1c2f4f', say: '不用當最大的。客戶每年都回來，這樣也很好。', hint: '外面再熱鬧，總有一塊市場只認你。' },
    empire: { a: '#ffcf3f', g: '#1d3266', say: '帝國建好了。老闆，下一局要不要挑戰更難的開局？', hint: '等每一張榜單最上面都是你的名字。' },
    open_legend: { a: '#5fe0b0', g: '#0f4044', say: '全世界都在用我們的模型。這樣的結局，我很喜歡。', hint: '把最好的東西分享出去，看看誰會記得你。' },
    survive: { a: '#7fb2ff', g: '#1a2e55', say: '馬拉松還沒跑完。下一次，我們一定能跑到更前面。', hint: '一路跑到最後一天，還是沒有分出勝負。' },
    acquired: { a: '#b7a6ff', g: '#2a2354', say: '新老闆人不錯……但我還是比較想念當初那間車庫。', dark: 1, hint: '有人開了一個漂亮的價錢，你會怎麼回？' },
    bankrupt: { a: '#aab3c2', g: '#262b35', say: '對不起，沒能陪你撐到最後。再來一次好不好？', dark: 1, hint: '帳上的數字也有撐不住的一天。' },
  };
  const FN_DEFAULT = { a: '#7fb2ff', g: '#1a2e55', say: '這一路辛苦了。下一局，我還跟著你。', hint: '這條路還沒有人走完。' };
  function fnYM(w) { const d = ME.weekDate(w); return d.getUTCFullYear() + '.' + String(d.getUTCMonth() + 1).padStart(2, '0'); }
  // 一局的關鍵時刻：發布的模型從 s.models 算，其他來自引擎的 s.chron。太多就留重要的（c.p 是引擎給的重要度，沒有就看分類）
  function fnChronicle(E) {
    const s = G.s; const e = s.ended; const city = cityOf(); const sc = D.SCENARIOS.find((x) => x.id === s.scenario); const best = G.bestModel(true);
    const out = [{ w: 0, k: 'start', t: (city ? '在' + city.name : '') + '創立 ' + s.company + (sc ? '（' + sc.name + '）' : ''), p: 99 }];
    s.models.filter((m) => m.rel).sort((a, b) => a.rel.w - b.rel.w).forEach((m, i) => {
      out.push({ w: m.rel.w, k: 'model', p: i === 0 || m === best ? 10 : (m.rel.peak && m.rel.peak <= 3 ? 7 : 5), t: m.name + ' 上線，綜合 ' + G.composite(m.stats).toFixed(1) + (m.rel.rank0 ? '，首發第 ' + m.rel.rank0 + ' 名' : '') + (m.rel.open ? '（開源）' : '') });
    });
    if (best && !best.rel) out.push({ w: best.w, k: 'model', p: 10, t: best.name + ' 訓練完成，綜合 ' + G.composite(best.stats).toFixed(1) });  // 達成 AGI 的模型常常還沒發布
    (s.chron || []).filter((c) => !/^結局/.test(c.t)).forEach((c) => out.push({ w: c.w, k: c.k, t: c.t, p: c.p || { crisis: 8, rank: 7, race: 6, money: 5, model: 4 }[c.k] || 3 }));
    // 每年最多留 5 筆，免得最後一幕的大事把前面幾年的故事擠掉；短局額度用不完才放寬
    const ranked = out.sort((a, b) => b.p - a.p); const perYear = {}; const picked = new Set();
    ranked.forEach((c) => { const y = ME.weekDate(c.w).getUTCFullYear(); if (picked.size < 21 && (perYear[y] || 0) < 5) { picked.add(c); perYear[y] = (perYear[y] || 0) + 1; } });
    ranked.forEach((c) => { if (picked.size < 21) picked.add(c); });
    const keep = [...picked].sort((a, b) => a.w - b.w);
    keep.push({ w: e.w, k: 'end', t: E.icon + ' ' + E.title, p: 99 });
    return keep;
  }
  // 估值曲線：一局橫跨好幾個數量級，用對數軸才看得出每個階段的成長
  function fnValChart(h) {
    const small = innerWidth < 600;  // 手機用較窄的畫布，座標文字才不會縮到看不清楚
    const W = small ? 400 : 640, H = small ? 210 : 270, pl = 58, pr = 16, pt = 12, pb = 24; const FLOOR = 1e5;
    const w0 = h[0].w, w1 = h[h.length - 1].w; const V = h.map((p) => Math.max(FLOOR, p.val || 0));
    const lo = Math.floor(Math.log10(Math.min.apply(null, V))); const hi = Math.max(lo + 1, Math.ceil(Math.log10(Math.max.apply(null, V))));
    const x = (w) => pl + (Math.min(w1, Math.max(w0, w)) - w0) / Math.max(1, w1 - w0) * (W - pl - pr);
    const y = (v) => pt + (1 - (Math.log10(Math.max(FLOOR, v)) - lo) / (hi - lo)) * (H - pt - pb);
    const at = (w, k) => { let i = 0; while (i < h.length - 1 && h[i + 1].w <= w) i++; const a = h[i]; const b = h[Math.min(i + 1, h.length - 1)]; const q = b.w > a.w ? Math.min(1, Math.max(0, (w - a.w) / (b.w - a.w))) : 0; return (a[k] || 0) + ((b[k] || 0) - (a[k] || 0)) * q; };
    let grid = ''; const st = Math.max(1, Math.ceil((hi - lo) / 4));
    for (let e = lo; e <= hi; e += st) { const yy = y(Math.pow(10, e)).toFixed(1); grid += `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}"/><text x="${pl - 8}" y="${+yy + 4}" text-anchor="end">${esc(money(Math.pow(10, e)))}</text>`; }
    let years = ''; let lastX = -99;
    h.forEach((p) => { const d = ME.weekDate(p.w); const xx = x(p.w); if (d.getUTCMonth() === 0 && xx - lastX > 44) { years += `<text x="${xx.toFixed(1)}" y="${H - 6}" text-anchor="middle">${d.getUTCFullYear()}</text>`; lastX = xx; } });
    const pts = h.map((p) => x(p.w).toFixed(1) + ' ' + y(p.val).toFixed(1));
    return { x, y, at, html: `<svg class="fn-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="公司估值走勢，從 ${esc(money(h[0].val || 0))} 到 ${esc(money(h[h.length - 1].val || 0))}">
      <defs><clipPath id="fn-clip"><rect id="fn-clip-r" x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>
      <g class="grid">${grid}</g>${years}
      <g clip-path="url(#fn-clip)"><path class="ar" d="M${x(w0).toFixed(1)} ${H - pb} L${pts.join(' L')} L${x(w1).toFixed(1)} ${H - pb} Z"/><polyline class="ln" points="${pts.join(' ')}"/></g>
      <g id="fn-marks"></g><circle class="hd" id="fn-head" r="5.5" cx="${x(w1).toFixed(1)}" cy="${y(h[h.length - 1].val).toFixed(1)}"/></svg>` };
  }
  // 最終排名：公司依週營收排，附上各家最強的模型
  function fnStandings() {
    const lb = G.leaderboard();
    return G.companyRevenues().map((c, i) => {
      const b = c.player ? lb.find((r) => r.player) : lb.find((r) => r.rival === c.rival);
      return { n: i + 1, me: !!c.player, name: c.name, icon: c.player ? mascot().icon : c.icon, rev: c.rev, model: b ? b.name : '還沒有上榜模型', comp: b ? b.comp : 0 };
    });
  }
  function fnScoreRows(e, E) {
    const n = Object.keys(G.s.ach).length; const P = e.parts || {};
    const net = P.net != null ? Math.round(P.net) : Math.round(100 * Math.log10(Math.max(1, e.net / 1e6)));
    const model = P.model != null ? Math.round(P.model) : Math.round(4 * e.bc);
    const ach = P.ach != null ? Math.round(P.ach) : 15 * n;
    const time = Math.round(P.time || 0);  // 舊存檔沒有分項，結局加成用總分倒推
    const rows = [['身價 ' + money(e.net), net], ['最佳模型 ' + e.bc.toFixed(1), model], ['成就 ' + n + ' 項', ach], ['結局「' + E.title + '」加成', e.score - net - model - ach - time]];
    if (time) rows.push(['提早達成', time]);
    return rows;
  }
  // 稱號：看這局最有特色的玩法。門檻要跟著平衡調整，sim 看得到各項的分布
  function fnTitleOf() {
    const s = G.s; const st = s.stat;
    if (s.ended.type === 'bankrupt') return ['燃盡的夢想家', '錢燒完了，但你真的試過。'];
    if (st.opened >= 3 && s.community >= 60) return ['開源傳教士', '把最好的東西分享給全世界。'];
    if (st.wasNeg) return ['浴火重生的老闆', '現金見底過，還是撐了下來。'];
    if (st.pioneers >= 4) return ['前沿開拓者', '世界還沒看過的技術，你先做出來了。'];
    if (st.incidents >= 3) return ['救火隊長', '事故不斷，但公司還站著。'];
    if (s.rep <= 40) return ['毀譽參半的生意人', '賺到了錢，名聲就另當別論。'];
    if (st.maxGpu >= 6e7) return ['算力狂人', '全世界的卡都想搬回家。'];
    if (st.released >= 14) return ['發版狂人', '一年一代太慢，你等不及。'];
    if (s.rfpDone >= 27) return ['標案之王', '企業客戶的電話都打給你。'];
    if (s.equity >= 0.45) return ['死守股權的創辦人', '融了那麼多輪，公司還是你的。'];
    if (s.rep >= 85) return ['業界良心', '同行提到你都會點頭。'];
    return ['穩紮穩打的經營者', '沒有奇蹟，只有一步一步。'];
  }
  const FN = { ov: null, i: 0, done: false, timers: [], raf: 0, scenes: [] };
  function fnClear() { FN.timers.forEach(clearTimeout); FN.timers = []; cancelAnimationFrame(FN.raf); }
  function fnAfter(ms, f) { FN.timers.push(setTimeout(f, ms)); }
  function fnReady() { FN.done = true; const b = document.getElementById('fn-next'); if (b) b.classList.add('ready'); }
  function fnGo(i) {
    fnClear(); FN.i = i; FN.done = false;
    const last = i === FN.scenes.length - 1; const S = FN.scenes[i];
    FN.ov.querySelectorAll('.fn-scene').forEach((el, k) => el.classList.toggle('on', k === i));
    FN.ov.dataset.last = last ? '1' : '';
    const stage = FN.ov.querySelector('.fn-stage'); if (stage) stage.scrollTop = 0;
    const say = document.getElementById('fn-say'); if (say) say.textContent = S.say || '';
    const nx = document.getElementById('fn-next'); if (nx) nx.classList.remove('ready');
    if (REDUCE()) { S.finish(); fnReady(); } else S.play();
    if (!last) { FN.ov.focus({ preventScroll: true }); return; }
    G.s.flags.endSeen = 1; autosave();
    // 剛連點「繼續」進到這一幕時，先擋一下，免得誤按到「再玩一次」清掉存檔
    const foot = FN.ov.querySelector('.fn-foot'); foot.style.pointerEvents = 'none'; fnAfter(800, () => { foot.style.pointerEvents = ''; });
    const stay = FN.ov.querySelector('[data-act="fn-stay"]'); if (stay) stay.focus({ preventScroll: true });
  }
  function fnAdvance() {
    if (!FN.ov || FN.i >= FN.scenes.length - 1) return;
    if (!FN.done) { fnClear(); FN.scenes[FN.i].finish(); fnReady(); return; }
    fnGo(FN.i + 1);
  }
  function hideFinale() { fnClear(); if (FN.ov) { FN.ov.remove(); FN.ov = null; modalOpen = false; } }
  function showEnding(replay) {
    const s = G.s; const e = s.ended; if (!e || FN.ov) return;
    endRecord(s);
    const E = G.endingView(); const T = FN_TONE[e.type] || FN_DEFAULT; const m = mascot();
    pauseForModal(); modalOpen = true;
    const h = (s.hist || []).filter((p) => p && p.w != null); const chart = h.length >= 2 ? fnValChart(h) : null;
    const chron = fnChronicle(E); const std = fnStandings(); const stdMax = Math.max(1, ...std.map((r) => r.rev)); const myRank = (std.find((r) => r.me) || {}).n || std.length;
    const rows = fnScoreRows(e, E); const tt = fnTitleOf(); const best = G.bestModel(true); const achN = Object.keys(s.ach).length;
    const rel = s.models.filter((x) => x.rel).sort((a, b) => a.rel.w - b.rel.w);
    const raced = h.filter((p) => (p.agi || 0) > 0 || (p.agiTop || 0) > 0);  // 有進最後一幕的局，右邊改畫競賽走勢
    const sign = (v) => (v < 0 ? '−' : '+') + num(Math.abs(v));
    const htmlTitle = `<section class="fn-scene fn-title"><div class="fn-date">${fnYM(e.w)}</div><div class="fn-ic" aria-hidden="true">${E.icon}</div><h1>${esc(E.title)}</h1><p class="fn-story">${esc(E.text)}</p></section>`;
    const htmlChron = `<section class="fn-scene fn-chron"><div class="fn-left"><span class="fn-cap">CHRONICLE · ${esc(s.company)} 編年史</span><div class="fn-now" id="fn-now">${fnYM(e.w)}</div>
        <div class="fn-reads"><div><span>公司估值</span><b id="fn-val">—</b></div><div><span>週營收</span><b id="fn-rev">—</b></div><div><span>最佳模型</span><b id="fn-best">—</b></div><div><span>排行榜</span><b id="fn-rank">—</b></div></div>${chart ? chart.html : ''}</div>
      <ol class="fn-tl" id="fn-tl">${chron.map((c) => `<li class="k-${esc(c.k)}${c.p >= 9 ? ' big' : ''}"><span class="w">${fnYM(c.w)}</span><span class="d" aria-hidden="true"></span><span class="t">${esc(c.t)}</span></li>`).join('')}</ol></section>`;
    const htmlStand = `<section class="fn-scene fn-stand"><div class="fn-col"><span class="fn-cap">FINAL STANDINGS · 最終排名</span><ol class="fn-rows" id="fn-rows">${std.map((r) => `<li class="${r.me ? 'me' : ''}"><span class="rk r${r.n}">${r.n}</span><span class="ic" aria-hidden="true">${r.icon || ''}</span><span class="nm"><b>${esc(r.name)}</b><small>${esc(r.model)}${r.comp ? ' · ' + r.comp.toFixed(1) : ''}</small></span><span class="rv">${esc(money(r.rev))}<small>/週</small></span><span class="br"><i style="--w:${Math.max(1, r.rev / stdMax * 100).toFixed(1)}%"></i></span></li>`).join('')}</ol></div>
      <div class="fn-col"><p class="fn-myrank" id="fn-myrank"><span>${esc(s.company)}</span>週營收第 <b>${myRank}</b> 名${best && G.bestModel() ? `<small>最強模型排行榜第 ${G.bestRank()} 名</small>` : ''}</p>
        <div class="fn-race">${raced.length >= 2 ? `<h3>AGI 競賽：你 vs 最快的對手</h3>${chartHTML([{ k: 'agi', name: '你', color: 'var(--fa)' }, { k: 'agiTop', name: '最快的對手', color: '#9fb0c9' }], (v) => v.toFixed(0) + '%', raced)}` : `<h3>模型實力：你 vs 對手前沿</h3>${chartHTML([{ k: 'best', name: '你的最佳', color: 'var(--fa)' }, { k: 'front', name: '對手前沿', color: '#9fb0c9' }], (v) => v.toFixed(0))}`}</div></div></section>`;
    const htmlScore = `<section class="fn-scene fn-score"><img class="fn-por" src="${m.img}" alt="${esc(m.name)}" width="581" height="900"><div class="fn-sc"><span class="fn-cap">RESULT · 成績揭曉</span>
        <ul class="fn-tally" id="fn-tally">${rows.map((r) => `<li><span>${esc(r[0])}</span><b>${sign(r[1])}</b></li>`).join('')}</ul>
        <div class="fn-total"><span>總分</span><b id="fn-total">0</b></div>
        <div class="fn-result"><div class="fn-grade g-${esc(e.grade)}" id="fn-grade">${esc(e.grade)}</div><div class="fn-tn" id="fn-tn"><span>這一局的稱號</span><b>${esc(tt[0])}</b><small>${esc(tt[1])}</small></div></div></div></section>`;
    const tiles = [['身價', money(e.net), '持股 ' + Math.round(s.equity * 100) + '%'], ['公司估值', money(s.valuation), fnYM(e.w)], ['最佳模型', e.bc.toFixed(1), best ? best.name : '沒有模型'], ['成就', achN + ' / ' + D.ACHIEVEMENTS.length, '解鎖'], ['發布模型', rel.length + ' 代', '訓練過 ' + s.models.length + ' 個'], ['團隊', num(G.totalStaff()) + ' 人', num(Math.round(G.ownedEq())) + ' 張等效算力']];
    const htmlFinal = `<section class="fn-scene fn-final"><img class="fn-por" src="${m.img}" alt="${esc(m.name)}" width="581" height="900"><div class="fn-card">
        <div class="fn-head"><div class="fn-grade on g-${esc(e.grade)}">${esc(e.grade)}</div><div class="fn-hd"><span class="fn-cap">${fnYM(e.w)} · ${esc(s.company)}</span><h2>${E.icon} ${esc(E.title)}</h2><p><b>${esc(tt[0])}</b>　總分 ${num(e.score)}</p></div></div>
        ${E.after && E.after.length ? `<div class="fn-after"><h3>後來</h3>${E.after.map((t) => `<p>${esc(t)}</p>`).join('')}</div>` : ''}
        <div class="fn-tiles">${tiles.map((x) => `<div class="stat-tile"><span class="l">${esc(x[0])}</span><span class="v">${esc(x[1])}</span><span class="s">${esc(x[2])}</span></div>`).join('')}</div>
        ${s.models.length ? `<ul class="fn-ms" aria-label="歷代模型">${s.models.map((x) => `<li class="${x === best ? 'best' : ''}"><b>${esc(x.name)}</b><span>${G.composite(x.stats).toFixed(1)}</span></li>`).join('')}</ul>` : ''}
        <div class="fn-bye"><img src="${m.avatar}" alt="" width="44" height="44"><p><b style="color:${m.color}">${esc(m.name)}</b>　${esc(T.say)}</p></div>
        <div class="fn-foot"><button class="btn ghost" data-act="fn-replay">重看結局</button><button class="btn ghost" data-act="endbook" data-cur="${esc(e.type)}">結局圖鑑 ${endCount()} / ${Object.keys(D.ENDINGS).length}${(endBook()[e.type] || {}).fresh ? '<span class="eb-new">NEW</span>' : ''}</button><span class="spacer"></span><button class="btn" data-act="fn-card">存成圖片</button><button class="btn" data-act="fn-stay">留下來看看</button><button class="btn primary" data-act="to-title">再玩一次</button></div></div></section>`;
    const ov = document.createElement('div'); ov.className = 'finale' + (T.dark ? ' dark' : ''); ov.id = 'finale'; ov.tabIndex = -1;
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', '結局：' + E.title);
    ov.style.setProperty('--fa', T.a); ov.style.setProperty('--fg', T.g);
    ov.innerHTML = `<div class="fn-stage">${htmlTitle}${htmlChron}${htmlStand}${htmlScore}${htmlFinal}</div>
      <div class="fn-bar"><div class="fn-say"><img src="${m.avatar}" alt="${esc(m.name)}" width="44" height="44"><p id="fn-say" aria-live="polite"></p></div><button class="btn ghost" data-act="fn-skip">直接看結果</button><button class="btn primary" data-act="fn-next" id="fn-next">繼續</button></div>`;
    ov.addEventListener('click', (ev) => { if (!ev.target.closest('button, a')) fnAdvance(); });
    document.body.appendChild(ov); FN.ov = ov;
    const q = (sel) => ov.querySelector(sel);
    const instant = (el) => el.classList.add('instant');

    // 第二幕：曲線的前緣走到每則紀錄的時間點，紀錄才跳出來；上方的日期和數字跟著走
    const tl = q('#fn-tl'); const items = [...tl.children]; const marks = q('#fn-marks');
    const setHead = (w) => {
      q('#fn-now').textContent = fnYM(w);
      if (!chart) return;
      const xx = chart.x(w); q('#fn-clip-r').setAttribute('width', xx.toFixed(1)); const hd = q('#fn-head'); hd.setAttribute('cx', xx.toFixed(1)); hd.setAttribute('cy', chart.y(chart.at(w, 'val')).toFixed(1));
      q('#fn-val').textContent = money(chart.at(w, 'val')); q('#fn-rev').textContent = money(chart.at(w, 'rev')); q('#fn-best').textContent = chart.at(w, 'best').toFixed(1);
      const rk = Math.round(chart.at(w, 'rank')); q('#fn-rank').textContent = rk >= 1 && rk < 99 ? '第 ' + rk + ' 名' : '—';  // 還沒上榜時是 99，舊存檔沒有這一欄
    };
    const showEntry = (i) => {
      items[i].classList.add('on'); items[i].scrollIntoView({ block: 'nearest' });
      if (chart && chron[i].k !== 'start') { const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('class', 'mk'); c.setAttribute('r', chron[i].p >= 9 ? 5 : 3.5); c.setAttribute('cx', chart.x(chron[i].w).toFixed(1)); c.setAttribute('cy', chart.y(chart.at(chron[i].w, 'val')).toFixed(1)); marks.appendChild(c); }
    };
    // 第三幕：由最後一名往第一名揭曉
    const stdRows = [...q('#fn-rows').children];
    // 第四幕：分數一項一項加上去，最後蓋評等
    const talRows = [...q('#fn-tally').children]; const totalEl = q('#fn-total'); const gradeEl = q('#fn-grade'); const tnEl = q('#fn-tn');
    const stamp = () => { gradeEl.classList.add('on'); sfx(e.grade === 'D' ? 'gloom' : 'stamp'); if (e.grade === 'S' || e.grade === 'A') confetti(ov); };
    FN.scenes = [
      { say: T.dark ? '老闆……' : '老闆，故事走到這裡了。',
        play() { sfx(T.dark ? 'gloom' : 'dawn'); fnAfter(2400, fnReady); },
        finish() { instant(q('.fn-title')); } },
      { say: '還記得剛開始的時候嗎？' + s.company + ' 一路走到了這裡。',
        play() {
          let i = 0; let cur = chart ? h[0].w : 0;
          const next = () => {
            if (i >= chron.length) { fnReady(); return; }
            const tgt = chron[i].w; const from = cur; const t0 = performance.now(); const big = chron[i].p >= 9; const dur = i === 0 ? 200 : big ? 620 : 420;  // 大事走慢一點，全部約 15 秒
            const run = (now) => {
              const u = Math.min(1, (now - t0) / dur); cur = from + (tgt - from) * u * (2 - u); setHead(cur);
              if (u < 1) { FN.raf = requestAnimationFrame(run); return; }
              showEntry(i); sfx(big ? 'good' : 'tick'); i++; fnAfter(big ? 480 : 160, next);
            };
            FN.raf = requestAnimationFrame(run);
          };
          setHead(cur); next();
        },
        finish() { marks.textContent = ''; items.forEach((_, i) => showEntry(i)); setHead(e.w); } },
      { say: e.type === 'bankrupt' ? '大家都還在跑，只有我們先下車了……' : e.type === 'rival_agi' && e.rival && ME.RIVAL[e.rival] ? ME.RIVAL[e.rival].name + ' 搶先了。看看大家最後的位置。' : myRank === 1 ? '全世界賺最多的 AI 公司，是我們。' : myRank <= 3 ? '前三名！再差一點點就是第一了。' : '看看大家最後都走到了哪裡。',
        play() {
          let i = stdRows.length - 1;
          const next = () => {
            if (i < 0) { q('#fn-myrank').classList.add('on'); sfx(myRank <= 3 && e.type !== 'bankrupt' ? 'fanfare' : 'tick'); fnAfter(400, fnReady); return; }
            stdRows[i].classList.add('on'); sfx('tick'); const wait = i === 0 ? 700 : 360; i--; fnAfter(wait, next);
          };
          fnAfter(300, next);
        },
        finish() { stdRows.forEach((r) => r.classList.add('on')); q('#fn-myrank').classList.add('on'); } },
      { say: '老闆，成績單出來了……',
        play() {
          let i = 0; let sum = 0;
          const next = () => {
            if (i >= talRows.length) { fnAfter(500, stamp); fnAfter(1000, () => { tnEl.classList.add('on'); fnReady(); }); return; }
            talRows[i].classList.add('on'); sfx('tick');
            const from = sum; sum += rows[i][1]; const to = sum; const t0 = performance.now();
            const roll = (now) => { const u = Math.min(1, (now - t0) / 420); totalEl.textContent = num(Math.round(from + (to - from) * u)); if (u < 1) FN.raf = requestAnimationFrame(roll); };
            FN.raf = requestAnimationFrame(roll);
            i++; fnAfter(620, next);
          };
          fnAfter(350, next);
        },
        finish() { talRows.forEach((r) => r.classList.add('on')); totalEl.textContent = num(e.score); if (!gradeEl.classList.contains('on')) stamp(); tnEl.classList.add('on'); } },
      { say: '', play() {}, finish() {} },
    ];
    render();
    fnGo(s.flags.endSeen && !replay ? FN.scenes.length - 1 : 0);
  }

  /* ---------- 結局圖鑑 ----------
     解鎖紀錄放在介面偏好，不進存檔，所以開新局、清存檔都不會消失。每個結局記次數和分數最高的那一局；
     sig 是最近一局的指紋，同一局重看或讀檔不會重複計次；fresh 表示還沒在圖鑑看過 */
  function endBook() { const b = uiPref('endings', null); return b && typeof b === 'object' && !Array.isArray(b) ? b : {}; }
  function endCount() { const b = endBook(); return Object.keys(D.ENDINGS).filter((id) => b[id]).length; }
  function endRecord(s) {
    const e = s.ended; if (!e || !D.ENDINGS[e.type]) return;
    const book = endBook(); const old = book[e.type]; const sig = hashStr([s.seed, s.company, e.w, e.score].join('|'));
    if (old && old.sig === sig) return;
    const best = !old || e.score > old.score ? { grade: e.grade, score: e.score, w: e.w, company: s.company, mascot: s.mascot } : {};
    book[e.type] = Object.assign({}, old, best, { n: (old ? old.n : 0) + 1, sig, fresh: old ? old.fresh : 1 });
    setUiPref('endings', book);
  }
  function showEndBook(cur, back) {
    const book = endBook(); const ids = Object.keys(D.ENDINGS); const got = ids.filter((id) => book[id]); const runs = got.reduce((a, id) => a + (book[id].n || 1), 0);
    const tone = (id) => FN_TONE[id] || FN_DEFAULT;
    const left = (id, i) => `<div class="eb-l"><span class="eb-ic" aria-hidden="true">${D.ENDINGS[id].icon}</span><span class="eb-no">${String(i + 1).padStart(2, '0')}</span></div>`;
    const tile = (id, i) => {
      const T = tone(id); const r = book[id];
      if (!r) return `<li class="eb-tile off">${left(id, i)}<div class="eb-r"><h4>？？？</h4><p>${esc(T.hint || FN_DEFAULT.hint)}</p></div></li>`;
      const m = D.MASCOTS.find((x) => x.id === r.mascot);
      return `<li class="eb-tile${id === cur ? ' cur' : ''}" id="eb-${esc(id)}" style="--fa:${T.a};--fg:${T.g}">${left(id, i)}<div class="eb-r"><h4>${esc(D.ENDINGS[id].title)}${r.fresh ? '<span class="eb-new">NEW</span>' : ''}</h4>
        <p class="eb-meta">達成 <b>${num(r.n || 1)}</b> 次 · 最高 <b>${num(r.score)}</b> 分</p><p class="eb-meta">${esc(r.company)} · <b>${fnYM(r.w)}</b></p>
        <p class="eb-say">${m ? `<img src="${m.avatar}" alt="${esc(m.name)}" width="26" height="26" loading="lazy">` : ''}<span>${esc(T.say)}</span></p></div><div class="fn-grade on g-${esc(r.grade)}" title="最高評級 ${esc(r.grade)}">${esc(r.grade)}</div></li>`;
    };
    openModal({ title: '🏅 結局圖鑑', cls: 'wide eb',
      body: `<div class="eb-top"><div class="eb-count">${got.length}<small>/ ${ids.length}</small></div><div class="eb-bar" aria-hidden="true">${ids.map((id) => `<i class="${book[id] ? 'on' : ''}" style="--fa:${tone(id).a}"></i>`).join('')}</div>
        <p class="eb-note">${got.length ? '已經跑完 <b>' + num(runs) + '</b> 局。' : '還沒有走到任何結局。'}解鎖過的結局會一直留在這裡，開新局也不會消失。</p></div><ol class="eb-grid">${ids.map(tile).join('')}</ol>`,
      onClose: () => { if (back && back.isConnected) back.focus({ preventScroll: true }); } });
    if (got.some((id) => book[id].fresh)) { got.forEach((id) => { delete book[id].fresh; }); setUiPref('endings', book); }  // 這次還看得到 NEW，下次就沒有了
    const nw = back && back.querySelector('.eb-new'); if (nw) nw.remove();
    const x = document.querySelector('#modal-root .mh .x'); if (x) x.focus({ preventScroll: true });
    const at = cur && document.getElementById('eb-' + cur); if (at) setTimeout(() => at.scrollIntoView({ block: 'center' }), 40);
  }

  /* ---------- 分享卡 ----------
     用 canvas 畫 1080×1350 的 PNG：手機直式剛好滿版，縮到 360px 寬字也看得清楚。內容只有公司名、結局、評級、估值、日期和吉祥物（加上立繪的署名），不放個人資料和網址。
     先畫好再顯示預覽，下載和分享才是玩家的下一次點擊：navigator.share 要在點擊當下呼叫，等圖片畫完再呼叫，有些瀏覽器會擋 */
  const CARD = { url: '', file: null, name: '', text: '', job: 0 };
  const CARD_GRADE = { S: ['#ffe680', '#ffb12e', '#1d2433'], A: ['#d4e4ff', '#7fb2ff', '#1d2433'], B: ['#d8f7e8', '#5fe0b0', '#1d2433'], C: ['#f3f5f9', '#b8c1ce', '#1d2433'], D: ['#8b93a3', '#565d6b', '#fff'] };  // 跟 .fn-grade 同一組顏色
  function cardImage(src) {
    return new Promise((res) => {
      const im = new Image(); const t = setTimeout(() => res(null), 4000);
      im.onload = () => { clearTimeout(t); res(im); }; im.onerror = () => { clearTimeout(t); res(null); }; im.src = src;
    });
  }
  // canvas 不會等字體：要先載入用得到的字（Noto 依字元分檔），網路不通就用系統字
  function cardFonts(d) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const jobs = [['900 150px "Noto Serif TC"', d.title + d.grade], ['900 60px "Noto Sans TC"', d.company + d.val + d.mascot], ['700 32px "Noto Sans TC"', '評級公司估值結束日期結局模型帝國'], ['500 22px "Noto Sans TC"', d.credit], ['italic 800 88px "Barlow Semi Condensed"', 'ENDING$.,0123456789'], ['800 30px "Archivo"', 'MODEL EMPIRE']];
    return Promise.race([Promise.all(jobs.map((j) => document.fonts.load(j[0], j[1]).catch(() => null))), new Promise((r) => setTimeout(r, 3000))]);
  }
  function cardDraw(d, img) {
    const W = 1080, H = 1350, L = 64, CX = 830, CY = 760; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const css = getComputedStyle(document.documentElement); const SERIF = css.getPropertyValue('--font-display').trim(), SANS = css.getPropertyValue('--font-body').trim(), NUM = css.getPropertyValue('--font-num').trim();
    // 文字太寬就縮小，縮到 min 還放不下才加刪節號
    const fit = (t, font, size, min, maxW) => {
      c.font = font(size); const w = c.measureText(t).width; if (w <= maxW) return t;
      c.font = font(Math.max(min, Math.floor(size * maxW / w))); if (c.measureText(t).width <= maxW) return t;
      const ch = [...t]; while (ch.length > 1 && c.measureText(ch.join('') + '…').width > maxW) ch.pop();
      return ch.join('') + '…';
    };
    // 數字用遊戲字體的斜體，中文單位維持正體（中文不做假斜體）
    const runs = (t, x, y, size, color) => {
      c.fillStyle = color;
      for (const r of t.match(/[\x00-\x7f]+|[^\x00-\x7f]+/g) || []) { const ascii = r.charCodeAt(0) < 128; c.font = ascii ? `italic 800 ${size}px ${NUM}` : `900 ${Math.round(size * .72)}px ${SANS}`; c.fillText(r, x, y); x += c.measureText(r).width + (ascii ? 5 : 0); }
      return x;
    };
    const rrect = (x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
    const label = (t, y) => { c.font = `700 32px ${SANS}`; c.fillStyle = '#b4bfd3'; c.fillText(t, L, y); };
    // 背景：結局的代表色打光，加上細格線
    const bg = c.createRadialGradient(CX, 620, 40, CX, 620, 1050); bg.addColorStop(0, d.g); bg.addColorStop(1, '#0d1424'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255, 255, 255, .035)'; c.lineWidth = 2; c.beginPath();
    for (let x = 54; x < W; x += 54) { c.moveTo(x, 0); c.lineTo(x, H); }
    for (let y = 54; y < H; y += 54) { c.moveTo(0, y); c.lineTo(W, y); }
    c.stroke();
    // 立繪頭部後面的圓環，呼應大廳和結局標題；左邊不壓到文字欄
    c.strokeStyle = d.a; c.globalAlpha = .55; c.lineWidth = 3; c.setLineDash([4, 14]); c.beginPath(); c.arc(CX, CY, 310, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    c.globalAlpha = .25; c.lineWidth = 2; c.beginPath(); c.arc(CX, CY, 340, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
    if (img) {
      const mh = 990; const mw = Math.round(mh * img.naturalWidth / img.naturalHeight);
      const off = document.createElement('canvas'); off.width = mw; off.height = mh; const o = off.getContext('2d'); o.drawImage(img, 0, 0, mw, mh);
      if (d.dark) { o.globalCompositeOperation = 'source-atop'; o.fillStyle = 'rgba(18, 22, 34, .42)'; o.fillRect(0, 0, mw, mh); }  // 立繪只有開心的表情，壞結局把她調暗（同 .finale.dark）
      c.shadowColor = 'rgba(0, 0, 0, .45)'; c.shadowBlur = 40; c.shadowOffsetY = 24; c.drawImage(off, W + 60 - mw, H + 36 - mh); c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0;
    } else {  // 立繪畫不進來（例如直接用檔案開啟）：改用吉祥物的圖示和名字
      c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = `280px ${SANS}`; c.fillText(d.icon, CX, CY + 90); c.font = `900 60px ${SANS}`; c.fillText(d.mascot, CX, CY + 220); c.textAlign = 'left';
    }
    // 上方：品牌條和結局名
    c.fillStyle = '#16181d'; c.beginPath(); c.moveTo(0, 54); c.lineTo(404, 54); c.lineTo(380, 122); c.lineTo(0, 122); c.closePath(); c.fill();
    c.fillStyle = '#c6ff1a'; c.fillRect(L, 82, 12, 12); c.fillStyle = '#fff'; c.font = `800 30px Archivo, ${SANS}`; c.fillText('MODEL EMPIRE', L + 28, 99);
    const capEnd = runs('ENDING', L, 214, 40, d.a); c.font = `700 34px ${SANS}`; c.fillText('結局', capEnd + 18, 213);
    const title = fit(d.title, (z) => `900 ${z}px ${SERIF}`, 150, 72, W - L * 2);
    c.fillStyle = '#fff'; c.shadowColor = d.a; c.shadowBlur = 44; c.fillText(title, L, 362); c.shadowColor = 'transparent'; c.shadowBlur = 0;
    // 左欄：評級、公司、估值、日期
    label('評級', 452);
    const tint = CARD_GRADE[d.grade] || CARD_GRADE.C;
    c.save(); c.translate(L + 94, 568); c.rotate(-4 * Math.PI / 180);
    const gr = c.createLinearGradient(-94, -94, 94, 94); gr.addColorStop(0, tint[0]); gr.addColorStop(1, tint[1]); c.fillStyle = gr; c.shadowColor = 'rgba(0, 0, 0, .35)'; c.shadowBlur = 26; c.shadowOffsetY = 10; rrect(-94, -94, 188, 188, 42); c.fill();
    c.shadowColor = 'transparent'; c.fillStyle = tint[2]; c.font = `900 136px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(d.grade, 0, 8); c.restore();
    label('公司', 752);
    // 公司名最多 16 個字：太長就分兩行，不要縮到手機上看不清楚
    const coFont = (z) => `900 ${z}px ${SANS}`; const coW = 420; c.font = coFont(60); const coFull = c.measureText(d.company).width; c.fillStyle = '#fff';
    if (coFull * 46 / 60 <= coW) c.fillText(fit(d.company, coFont, 60, 46, coW), L, 820);
    else {
      c.font = coFont(46); const ch = [...d.company]; let a = '';
      while (ch.length && c.measureText(a + ch[0]).width <= coW) a += ch.shift();
      const sp = a.lastIndexOf(' '); if (sp > 0) { ch.unshift(...a.slice(sp + 1)); a = a.slice(0, sp); }  // 英文盡量在空白處換行
      c.fillText(a, L, 806); c.fillText(fit(ch.join(''), coFont, 46, 46, coW), L, 860);
    }
    label('估值', 918); runs(d.val, L, 1008, 92, '#fff');
    label('結束日期', 1106); runs(d.date, L, 1186, 76, '#fff');
    // 頁尾：遊戲名和立繪署名（二創圖片要署名）
    c.fillStyle = '#0a0f1b'; c.fillRect(0, H - 76, W, 76);
    c.font = `700 28px ${SANS}`; c.fillStyle = '#fff'; c.fillText('模型帝國', L, H - 27); const nameW = c.measureText('模型帝國').width;
    if (d.credit) { const cr = fit(d.credit, (z) => `500 ${z}px ${SANS}`, 24, 16, W - L * 2 - nameW - 32); c.textAlign = 'right'; c.fillStyle = '#c9d3e3'; c.fillText(cr, W - L, H - 28); c.textAlign = 'left'; }
    return cv;
  }
  function cardBlob(cv) { return new Promise((res, rej) => { try { cv.toBlob((b) => (b ? res(b) : rej(new Error('empty'))), 'image/png'); } catch (e) { rej(e); } }); }
  // 用檔案（file://）開啟時畫了立繪就不能輸出，這時改畫沒有立繪的版本
  async function cardMake(d) {
    const r = await Promise.all([cardImage(d.img), cardFonts(d)]); const img = r[0];
    try { return { blob: await cardBlob(cardDraw(d, img)), portrait: !!img }; } catch (e) { return { blob: await cardBlob(cardDraw(d, null)), portrait: false }; }
  }
  function cardDrop() { if (CARD.url) URL.revokeObjectURL(CARD.url); CARD.url = ''; CARD.file = null; }
  function cardCanShare() { try { return !!(CARD.file && navigator.share && navigator.canShare && navigator.canShare({ files: [CARD.file] })); } catch (e) { return false; } }
  function showShareCard(back) {
    const s = G.s; const e = s.ended; const E = G.endingView(); if (!E) return;
    const T = FN_TONE[e.type] || FN_DEFAULT; const m = mascot(); const val = money(s.valuation); const date = fnYM(e.w);
    const d = { company: s.company, title: E.title, grade: e.grade, val, date, a: T.a, g: T.g, dark: !!T.dark, img: m.img, icon: m.icon, mascot: m.name, credit: m.credit || '' };
    cardDrop(); const job = ++CARD.job;
    CARD.name = 'model-empire-' + e.type + '-' + e.grade + '.png'; CARD.text = '我在《模型帝國》走到了「' + E.title + '」，評級 ' + e.grade + '。';
    openModal({ title: '🖼️ 分享卡', cls: 'sc', body: '<figure class="sc-fig" id="sc-fig"><p class="sc-note">正在畫圖片…</p></figure>',
      foot: '<button class="btn" data-act="close-modal">關閉</button><button class="btn primary" id="sc-save" data-act="sc-save" disabled>下載圖片</button>',
      onClose: () => { CARD.job++; cardDrop(); if (back && back.isConnected) back.focus({ preventScroll: true }); } });
    cardMake(d).then((r) => {
      const fig = document.getElementById('sc-fig'); if (job !== CARD.job || !fig) return;
      CARD.url = URL.createObjectURL(r.blob);
      try { CARD.file = new File([r.blob], CARD.name, { type: 'image/png' }); } catch (err) { CARD.file = null; }
      const alt = '分享卡：' + s.company + '，結局「' + E.title + '」，評級 ' + e.grade + '，估值 ' + val + '，' + date + ' 結束';
      fig.innerHTML = `<img class="sc-img" src="${CARD.url}" width="1080" height="1350" alt="${esc(alt)}"><figcaption class="sc-note">${r.portrait ? '' : '這次沒辦法把立繪畫進圖片（直接用檔案開啟遊戲時會這樣），所以改用圖示。'}也可以長按或按右鍵另存圖片。圖裡只有這一局的公司名、結局、評級、估值、日期和吉祥物，沒有個人資料。</figcaption>`;
      const save = document.getElementById('sc-save'); save.disabled = false; let main = save;
      if (cardCanShare()) {  // 手機的分享選單可以直接存進相簿，所以手機以分享為主
        const touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        save.insertAdjacentHTML(touch ? 'afterend' : 'beforebegin', `<button class="btn${touch ? ' primary' : ''}" id="sc-share" data-act="sc-share">分享</button>`);
        if (touch) { save.classList.remove('primary'); main = document.getElementById('sc-share'); }
      }
      main.focus({ preventScroll: true });
    }).catch(() => {
      const fig = document.getElementById('sc-fig'); if (job !== CARD.job || !fig) return;
      fig.innerHTML = '<p class="sc-note">這個瀏覽器畫不出圖片，可以直接截圖結算卡分享。</p>';
    });
  }
  function cardSave() {
    if (!CARD.url) return;
    const a = document.createElement('a'); a.href = CARD.url; a.download = CARD.name; document.body.appendChild(a); a.click(); a.remove();
    toast('已開始下載圖片');
  }
  function cardShare() {
    if (!cardCanShare()) { cardSave(); return; }
    navigator.share({ files: [CARD.file], title: '模型帝國', text: CARD.text }).catch((err) => { if (!err || err.name !== 'AbortError') toast('沒辦法開啟分享，可以改用下載', true); });
  }

  /* ---------- 選單 ---------- */
  /* ---------- 史料庫：真實 AI 史（依遊戲日期解鎖） ---------- */
  const HCAT = { model: '模型', paper: '論文', hardware: '硬體', infra: '基礎設施', capital: '資本', policy: '政策法規', benchmark: '基準', safety: '安全與法律', product: '產品', culture: '文化', meme: '迷因', robotics: '機器人', talent: '人才' };
  const codexState = { tab: 'timeline', cat: 'all', q: '' };
  function H() { return window.ME_HISTORY || { items: [], papers: {}, memes: [] }; }
  function paperLine(tid) {
    const p = (H().papers || {})[tid]; if (!p || !p.paper) return '';
    return `<p class="paper-cite">📄 ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.paper)}</a>` : esc(p.paper)}<span>${esc([p.authors, p.venue].filter(Boolean).join('，'))}</span></p>`;
  }
  function showCodex(tab) {
    codexState.tab = tab || codexState.tab;
    openModal({ title: '📜 史料庫', cls: 'wide', body: '<div id="codex"></div>' });
    renderCodex();
  }
  function renderCodex() {
    const el = document.getElementById('codex'); if (!el) return;
    const h = H(); const today = G ? G.ymd : '2023-01-02';
    const tabs = [['timeline', '真實時間軸'], ['papers', '科技與論文'], ['memes', '迷因詞典']];
    let body = '';
    if (codexState.tab === 'timeline') {
      const all = (h.items || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
      const open = all.filter((it) => String(it.date) <= today);
      const locked = all.length - open.length;
      const cats = {}; open.forEach((it) => (cats[it.cat] = (cats[it.cat] || 0) + 1));
      const q = ZH.t(codexState.q.trim()).toLowerCase();  // 史料是繁體，簡體模式兩邊都轉成簡體再比
      const list = open.filter((it) => (codexState.cat === 'all' || it.cat === codexState.cat) && (!q || ZH.t(it.title + it.text + JSON.stringify(it.real || {})).toLowerCase().indexOf(q) >= 0));
      body = `<p class="small muted" style="margin:0 0 8px">這些都是真實發生過的事（附來源）。遊戲日期到了才會解鎖；目前已解鎖 ${open.length} 條，還有 ${locked} 條歷史尚未發生。</p>
        <div class="row" style="margin-bottom:8px"><div class="chips">${['all'].concat(Object.keys(cats)).map((c) => `<button class="${codexState.cat === c ? 'on' : ''}" data-act="codex-cat" data-cat="${c}">${c === 'all' ? '全部' : esc(HCAT[c] || c)}${c === 'all' ? '' : ' ' + cats[c]}</button>`).join('')}</div>
        <input type="text" id="codex-q" placeholder="搜尋…" value="${esc(codexState.q)}" style="flex:1;min-width:140px" aria-label="搜尋史料"></div>
        <div class="hist">${list.slice(0, 200).map((it) => { const r = it.real || {}; const nm = [r.org].concat(r.names || []).filter(Boolean).join(' · '); const src = (it.sources || [])[0];
          return `<article id="hist-${esc(it.id)}" class="${codexState.focus && codexState.focus === it.id ? 'focus' : ''}"><div class="d mono">${esc(it.date)}</div><div><b>${esc(it.title)}</b> <span class="pill">${esc(HCAT[it.cat] || it.cat)}</span><p>${esc(it.text)}</p><div class="small muted">${nm ? esc(nm) : ''}${src ? ` · <a href="${esc(src)}" target="_blank" rel="noopener">來源</a>` : ''}</div></div></article>`; }).join('') || '<p class="muted small">沒有符合的條目。</p>'}</div>`;
    } else if (codexState.tab === 'papers') {
      body = `<p class="small muted" style="margin:0 0 8px">每項科技對應的真實論文或技術報告。已掌握的科技會標成綠色。</p><div class="table-wrap"><table class="t"><thead><tr><th>科技</th><th>論文 / 報告</th><th>發表</th></tr></thead><tbody>${D.TECHS.map((t) => { const p = (h.papers || {})[t.id] || {}; return `<tr><td><span class="hw">${techTile(t)}<b class="${G && G.has(t.id) ? 'good' : ''}">${esc(t.name)}</b></span></td><td>${p.paper ? (p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.paper)}</a>` : esc(p.paper)) + `<div class="small muted">${esc(p.oneLine || '')}</div>` : '<span class="muted">—</span>'}</td><td class="small muted">${esc([p.authors, p.venue, p.date].filter(Boolean).join(' · '))}</td></tr>`; }).join('')}</tbody></table></div>`;
    } else {
      body = `<div class="memes">${(h.memes || []).map((m) => `<div class="meme"><b>${esc(m.term)}</b><p>${esc(m.meaning)}</p>${m.origin ? `<div class="small muted">出處：${esc(m.origin)}</div>` : ''}</div>`).join('') || '<p class="muted small">尚無資料。</p>'}</div>`;
    }
    el.innerHTML = `<div class="seg-ctl" style="margin-bottom:10px">${tabs.map(([k, t]) => `<button class="${codexState.tab === k ? 'on' : ''}" data-act="codex-tab" data-tab="${k}">${t}</button>`).join('')}</div>${body}`;
    const qi = document.getElementById('codex-q');
    if (qi) qi.addEventListener('input', (e) => { codexState.q = e.target.value; const pos = e.target.selectionStart; renderCodex(); const n = document.getElementById('codex-q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } });
    if (codexState.focus) { const f = document.getElementById('hist-' + codexState.focus); if (f) setTimeout(() => f.scrollIntoView({ block: 'center' }), 40); codexState.focus = null; }
  }

  function showMenu() {
    openModal({
      title: '☰ 選單',
      body: `<div class="stack">
        <div class="row" style="gap:14px"><label class="toggle"><input type="checkbox" id="au-music" ${AU.on.music ? 'checked' : ''}> 背景音樂</label><label class="toggle"><input type="checkbox" id="au-sfx" ${AU.on.sfx ? 'checked' : ''}> 音效</label></div>
        ${G && G.setQuests ? `<label class="toggle"><input type="checkbox" id="q-on" ${G.s.flags.noQuest ? '' : 'checked'}> 新手任務（大廳的本週目標會一步一步帶你玩）</label>` : ''}
        <label class="row small"><span class="muted">音量</span><input type="range" id="au-vol" min="0" max="100" value="${Math.round(AU.vol * 100)}" style="flex:1"></label>
        <div class="row small"><span class="muted">語言</span>${langSwitch()}</div>
        <button class="btn" data-act="save-now">💾 立即存檔（瀏覽器）</button>
        <button class="btn" data-act="export">📤 匯出存檔代碼</button>
        <button class="btn" data-act="import">📥 匯入存檔代碼</button>
        <button class="btn" data-act="codex" data-tab="timeline">📜 史料庫（真實 AI 史）</button>
        <button class="btn" data-act="endbook">🏅 結局圖鑑（${endCount()} / ${Object.keys(D.ENDINGS).length}）</button>
        <button class="btn" data-act="help">📖 玩法說明</button>
        <button class="btn" data-act="tour-reset">🧭 重看各頁導覽</button>
        <button class="btn" data-act="credits">🐳 致謝與授權</button>
        <button class="btn danger" data-act="ask-title">🏠 回到標題畫面</button>
      </div>`,
    });
  }
  function showHelp() {
    openModal({
      title: '📖 玩法說明', cls: 'mid',
      body: `<div class="stack small" style="font-size:13.5px;line-height:1.75">
        <div><b>目標</b>：從 2023 年 1 月開始，打造最強模型、賺到最多身價，搶在對手之前抵達 AGI（綜合分 ≥ 100 且知識/語言/程式/推理/Agent 都 ≥ 92）。接近終點會進入最後一幕；2030 年底起每年底可以收手結算，最晚到 2035 年底。要有「可擴展監督」、安全 ≥ 85、失控風險 < 60 才是好結局；對手先到就輸了。</div>
        <div><b>模型配方</b>：分數來自「有效算力」：6 × 等效參數 × 有效資料 × Chinchilla 效率 × 資料品質 × 演算法加成 × 人才。參數與資料量要平衡（每參數約 20 token）；資料重複會遞減；MoE 用較少算力撐起更大的等效規模。</div>
        <div><b>能力</b>：資料配比決定能力偏向（程式碼→程式、書籍論文→知識與推理、網頁→語言、圖文→多模態）；後訓練分配給有用性、安全、推理、Agent。綜合分權重會隨時代改變：2024 秋推理變重要，2025 起 Agent 變重要。</div>
        <div><b>市場</b>：7 個市場各看重不同能力。市佔取決於能力（離前沿太遠會被嚴重扣分）、價格、聲望、行銷、通路與賣點。推理服務要佔用 GPU，不夠就會掉線、掉聲望。</div>
        <div><b>賣點</b>：兩項能力同時達到前沿的特定比例就獲得賣點（銅/銀/金），在相關市場有額外吸引力。</div>
        <div><b>對手</b>：天穹（閉源龍頭）、巨石（巨頭全家桶）、燈塔（安全派）、群星（開源派）、蜂巢（國民 App）、疾風（2024 崛起的效率黑馬）。你開源會讓開源派學得更快。</div>
        <div><b>風險</b>：安全分低 → 事故 → 監管壓力；監管 ≥ 40 前沿模型需安全 ≥ 60 才能發布，≥ 70 會被罰款，≥ 95 全線停業 4 週。激進爬取與使用者資料會累積法律風險。</div>
        <div><b>資本</b>：A 輪到 IPO 共 6 輪，每輪稀釋股權。現金連續 10 週為負就破產。</div>
        <div><b>快捷鍵</b>：空白鍵暫停/繼續，1~3 切換速度。遊戲每 4 週自動存在瀏覽器。</div>
      </div>`,
    });
  }
  function showCredits() {
    openModal({
      title: '🐳 致謝與授權', cls: 'mid',
      body: `<div class="stack small" style="font-size:13.5px;line-height:1.75">
        <div><b>吉祥物「大肥魚」</b>：B 站 AI 娘社群的鯨魚娘角色。形象源自 UP 主「上善無形」的 AI 原創角色「溟月」，後來社群加入 DeepSeek 元素與女僕裝，再衍生出 Q 版大肥魚。角色著作權歸原作者與社群創作者所有。</div>
        <div><b>立繪</b>：以<a href="https://treapgogo.github.io/deepseek-whale-girl/" target="_blank" rel="noopener">鯨魚娘開源資產庫</a>（TreapGoGo）的 Q 版角色設定圖為參考，用 AI 生圖後去背。生圖提示詞取自資產庫，依 <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.zh-hant" target="_blank" rel="noopener">CC BY-SA 4.0</a> 使用；本作改寫的提示詞同樣以 CC BY-SA 4.0 分享。</div>
        <div><b>其他 AI 娘</b>（白龍娘、小克、哈基米、Grok、Kimi、千問、小狐娘）：形象來自 B 站 UP 主 <a href="https://www.bilibili.com/video/BV1tE9XBbErS/" target="_blank" rel="noopener">ZipZipPipe《大 AI 與小 AI 們》</a>，Q 版由 ApprenTice 再創作（<a href="https://github.com/Apprentice-Geo/AI-Fanworks" target="_blank" rel="noopener">AI-Fanworks</a>），兩者皆依 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hant" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a> 授權。本作以這些 Q 版為參考，用 ChatGPT 改成白底後去背，改作的立繪同樣以 CC BY-NC-SA 4.0 分享。</div>
        <div><b>圖示</b>：線條圖示有一部分的形狀來自或參考 <a href="https://lucide.dev" target="_blank" rel="noopener">Lucide</a>（Copyright (c) 2026 Lucide Icons and Contributors，ISC 授權，其中部分源自 Feather，MIT 授權）。</div>
        <div><b>簡體轉換</b>：繁簡字表來自 <a href="https://github.com/BYVoid/OpenCC" target="_blank" rel="noopener">OpenCC</a>（Apache License 2.0）。</div>
        <div><b>非商用</b>：所有吉祥物只用於本作的非商業版本。商業版本須另外取得授權，或改用自己的角色。</div>
        <div><b>聲明</b>：吉祥物都是粉絲二次創作的虛構擬人角色，與各 AI 產品官方、運營主體及相關公司沒有任何關聯，也不代表對任何產品的評價。</div>
        <div><b>靈感來源</b>：B 站 Toy《鯨魚娘養成計劃》（作者 Anria_）與《手機帝國》。</div>
        <div><b>真實 AI 史</b>：史料庫中的事件、論文與新聞保留原始名稱與出處，相關權利屬於各來源。</div>
      </div>`,
    });
  }
  function showExport() {
    const code = btoa(unescape(encodeURIComponent(G.serialize())));
    openModal({ title: '📤 匯出存檔', cls: 'mid', body: `<p class="small muted" style="margin:0 0 8px">複製下面的代碼保存起來，之後可在「匯入存檔」貼上繼續。</p><textarea id="exp-code" rows="8" readonly>${code}</textarea>`, foot: '<button class="btn primary" data-act="copy-code">複製</button><button class="btn" data-act="close-modal">關閉</button>' });
  }
  function showImport() {
    openModal({ title: '📥 匯入存檔', cls: 'mid', body: `<p class="small muted" style="margin:0 0 8px">貼上先前匯出的存檔代碼。</p><textarea id="imp-code" rows="8" placeholder="在這裡貼上代碼"></textarea>`, foot: '<button class="btn" data-act="close-modal">取消</button><button class="btn primary" data-act="do-import">匯入</button>' });
  }

  /* ================= 互動 ================= */
  function act(name, ds, el) {
    const s = G ? G.s : null;
    switch (name) {
      case 'pick-mascot': {
        titleSel.mascot = ds.id; document.querySelectorAll('.mascots button').forEach((b) => b.classList.toggle('on', b.dataset.id === ds.id));
        const hc = document.getElementById('hero-char'); if (hc) hc.outerHTML = heroCharHTML();
        break;
      }
      case 'pick-scen': titleSel.scenario = ds.id; document.querySelectorAll('.scen').forEach((b) => b.classList.toggle('on', b.dataset.id === ds.id)); break;
      case 'pick-city': {
        titleSel.city = ds.id;
        document.querySelectorAll('.city').forEach((b) => { const on = b.dataset.id === ds.id; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
        const pk = document.getElementById('city-perks'); if (pk) pk.innerHTML = cityPerksHTML(ds.id);
        break;
      }
      case 'new-game': {
        const typed = (document.getElementById('f-co').value || '').trim();
        const co = !typed || typed === ZH.t(DEFAULT_CO) ? DEFAULT_CO : typed;  // 沒改預設名就存原文，切回繁體才看得到繁體
        const se = (document.getElementById('f-series').value || '').trim().replace(/\s+/g, '') || 'Whale';
        const ce = document.getElementById('f-city'); if (ce) titleSel.city = ce.value;
        G = Game.create({ scenario: titleSel.scenario, company: co.slice(0, 16), mascot: titleSel.mascot, series: se.slice(0, 12), city: titleSel.city || undefined });
        tab = 'home'; speed = 0; autosave(); showGame(); break;
      }
      case 'continue': { const sv = store(); if (sv) { try { G = Game.load(sv); tab = 'home'; showGame(); } catch (e) { toast('存檔讀取失敗', true); } } break; }
      case 'help': showHelp(); break;
      case 'credits': showCredits(); break;
      case 'codex': pauseForModal(); showCodex(ds.tab || 'timeline'); break;
      case 'codex-tab': codexState.tab = ds.tab; renderCodex(); break;
      case 'codex-cat': codexState.cat = ds.cat; renderCodex(); break;
      case 'import': showImport(); break;
      case 'do-import': {
        const v = (document.getElementById('imp-code').value || '').trim(); if (!v) return;
        try { const json = decodeURIComponent(escape(atob(v))); const g = Game.load(json); if (!g.s || g.s.week == null) throw new Error('bad'); stopLoop(); G = g; closeModal(true); tab = 'home'; autosave(); showGame(); toast('存檔已匯入'); } catch (e) { toast('代碼格式不正確', true); }
        break;
      }
      case 'tab': tab = ds.id; renderNav(); renderView(); renderFeed(); document.getElementById('main').scrollTop = 0; window.scrollTo(0, 0); break;
      case 'log-filter': logFilter = ds.v; renderFeed(); renderLogModal(); break;
      case 'open-log': pauseForModal(); showLog(); break;
      case 'hist': openHist(ds.id); break;
      case 'speed': setSpeed(+ds.v); resumeAfter = false; break;
      case 'menu': pauseForModal(); showMenu(); break;
      case 'music': setMusic(!AU.on.music); break;
      case 'roster-role': rosterRole = ds.v; rosterPage = 0; render(); break;
      case 'roster-sort': rosterSort = ds.v; rosterPage = 0; render(); break;
      case 'roster-page': rosterPage += +ds.v; render(); break;
      case 'fire-person': {
        const ppl = G.people ? G.people() : []; const p = ppl.find((x) => x.id === +ds.id); if (!p) break;
        confirmBox('裁員？', '裁掉' + esc(D.ROLES[p.role] ? D.ROLES[p.role].name : '') + '「' + esc(p.name) + '」（技能 ' + Math.round(p.skill) + '），需支付 4 週遣散費，士氣會下降。', '確定裁員', () => G.firePerson(p.id), true);
        break;
      }
      case 'close-modal': closeModal(); break;
      case 'choose': onChoose(+ds.i); break;
      case 'confirm-ok': { const f = document.getElementById('modal-root')._ok; closeModal(true); if (f) f(); render(); break; }
      case 'welcome-go': closeModal(true); tab = 'models'; renderAll(); openWizard(); break;
      case 'theme': if (ds.v === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', ds.v); document.querySelectorAll('[data-act="theme"]').forEach((b) => b.classList.toggle('on', b.dataset.v === ds.v)); break;
      case 'save-now': autosave(); toast('已存檔到這個瀏覽器'); break;
      case 'export': showExport(); break;
      case 'copy-code': { const ta = document.getElementById('exp-code'); try { navigator.clipboard.writeText(ta.value).then(() => toast('已複製'), () => { ta.select(); toast('請手動複製（已全選）'); }); } catch (e) { ta.select(); toast('請手動複製（已全選）'); } break; }
      case 'ask-title': confirmBox('回到標題畫面？', '目前進度會先存在這個瀏覽器，之後可以「繼續遊戲」。', '回到標題', () => { autosave(); showTitle(); }); break;
      case 'to-title': hideFinale(); closeModal(true); store(null); showTitle(); break;
      case 'fn-next': fnAdvance(); break;
      case 'fn-skip': if (FN.ov) fnGo(FN.scenes.length - 1); break;
      case 'fn-replay': hideFinale(); showEnding(true); break;
      case 'fn-stay': hideFinale(); render(); break;
      case 'fn-open': showEnding(); break;
      case 'endbook': pauseForModal(); showEndBook(ds.cur, el); break;
      case 'fn-card': showShareCard(el); break;
      case 'sc-save': cardSave(); break;
      case 'sc-share': cardShare(); break;
      // 研發
      case 'open-wizard': if (!G.canStartJob()) { toast('同時進行的訓練已達上限，升級辦公室可增加', true); tab = 'models'; renderAll(); return; } pauseForModal(); openWizard(); break;
      case 'wiz-arch': wiz.arch = ds.id; if (wiz.arch !== 'dense' && wiz.size < 14) wiz.size = 14; renderWizard(); break;
      case 'wiz-post': wiz.post = ds.id; renderWizard(); break;
      case 'wiz-suggest': suggestSpec(10); renderWizard(); toast('已依目前算力與資金，挑出約 10 週內分數最高的配方'); break;
      case 'wiz-start': { const r = G.startTraining(wiz); if (!r.ok) { toast(r.errs[0], true); return; } toast('開始訓練 ' + wiz.name); closeModal(); break; }
      case 'cancel-job': confirmBox('中止任務？', '已投入的算力與租金不會退還。', '中止', () => G.cancelJob(+ds.id), true); break;
      case 'open-synth': pauseForModal(); openSynth(); break;
      case 'syn-start': { const g = +document.getElementById('syn-gpus').value; const w = +document.getElementById('syn-weeks').value; const pool = document.getElementById('syn-pool').value; const r = G.startSynth(pool, g, w); if (!r.ok) { toast(r.errs[0], true); return; } closeModal(); break; }
      case 'report': pauseForModal(); showReport(+ds.id, false); break;
      case 'rel-price': { const mr = document.getElementById('modal-root'); mr._price = ds.id; mr.querySelectorAll('[data-act="rel-price"]').forEach((b) => b.classList.toggle('on', b.dataset.id === ds.id)); mr.querySelectorAll('#price-info [data-p]').forEach((x) => { x.hidden = x.dataset.p !== ds.id; }); break; }
      case 'release': {
        const mr = document.getElementById('modal-root'); const open = document.getElementById('rel-open').checked; const pend = mr._pending; const price = mr._price;
        const r = G.releaseModel(+ds.id, price, open);
        if (r && r.ok === false) { toast(r.err, true); return; }
        if (pend) G.resolveEvent(0);
        mr.innerHTML = ''; mr._onClose = null; modalOpen = false; wiz = null;
        const rm = G.s.models.find((x) => x.id === +ds.id);
        showLaunch(rm, r && r.rank ? r.rank : G.rankOf(rm), open); break;
      }
      case 'keep-model': { const mr = document.getElementById('modal-root'); if (mr._pending) G.resolveEvent(0); closeModal(); break; }
      case 'chat-from-report': { const mr = document.getElementById('modal-root'); if (mr._pending) G.resolveEvent(0); closeModal(true); showChat(+ds.id); break; }
      case 'chat': pauseForModal(); showChat(+ds.id); break;
      // 大廳的模型對話視窗與 AI 設定
      case 'launch-close': hideLaunch(); break;
      case 'tour-next': tourNext(); break;
      case 'tour-off': setUiPref('tourOff', true); tourEnd(); toast('之後不再顯示導覽，可以在選單重新開啟'); break;
      case 'tour-reset': setUiPref('tours', {}); setUiPref('tourOff', false); closeModal(); toast('已重設導覽，進入各頁時會再出現'); break;
      case 'gl': showGloss(el, ds.term); break;
      case 'cb-ask': talkAsk(+ds.i); break;
      case 'cb-send': talkSend(); break;
      case 'cb-stop': if (talk.ctl) talk.ctl.abort(); break;
      case 'cb-clear': talkSelect(talk.mid); break;
      case 'cb-toggle': talkFold(!talk.open); break;
      case 'ai-settings': pauseForModal(); showAiSettings(); break;
      case 'ai-preset': {
        const p = AI_PRESETS.find((x) => x.id === ds.id); if (!p) break;
        document.querySelectorAll('#ai-presets button').forEach((b) => b.classList.toggle('on', b === el));
        const bi = document.getElementById('ai-base'); if (bi && p.base) bi.value = p.base;
        const nt = document.getElementById('ai-note'); if (nt) nt.textContent = p.note || (p.local ? '本機服務不用金鑰，但要先在你的電腦上執行它。' : p.id === 'custom' ? '填任何支援 OpenAI 相容格式的網址（通常以 /v1 結尾）。' : '');
        break;
      }
      case 'ai-models': aiListModels(); break;
      case 'ai-pick-model': { const mi = document.getElementById('ai-model'); if (mi) mi.value = ds.id; break; }
      case 'ai-test': aiTest(); break;
      case 'ai-save': { const f = aiForm(); if (!f.base || !f.model) { aiStatus('請填 API 網址和模型名稱。', true); break; } saveAiCfg(f); closeModal(); toast('已接上 ' + aiLabel() + '，大廳的對話視窗可以打字了'); break; }
      case 'ai-clear': saveAiCfg({}); closeModal(); toast('已清除 AI 設定，對話視窗改回題庫'); break;
      case 'ask': ask(+ds.i); break;
      case 'open-source': confirmBox('開源 ' + esc((s.models.find((m) => m.id === +ds.id) || {}).name) + '？', '開源無法撤回。你會獲得社群、聲望與招募加成，但 API 收入只剩 25%，開源派對手也會學得更快。', '開源', () => G.openSource(+ds.id)); break;
      case 'retire': confirmBox('下架模型？', '下架後不再服務用戶、也不再佔用推理算力，無法重新上架。', '下架', () => G.retireModel(+ds.id), true); break;
      // 科技
      case 'research': {
        const t = ME.TECH[ds.id]; const others = t.excl ? D.TECHS.filter((x) => x.excl === t.excl && x.id !== t.id) : [];
        const go = () => { const r = G.research(ds.id); if (!r.ok) toast(r.err, true); else toast((G.researchJobs && !G.has(ds.id) ? '開始研究：' : '研究完成：') + t.name); render(); };
        if (others.length) confirmBox('選擇路線', `研究「${esc(t.name)}」之後，就不能研究「${esc(others.map((x) => x.name).join('」「'))}」。確定走這條路線嗎？`, '確定研究', go);
        else go();
        break;
      }
      case 'research-cancel': { const r = G.cancelResearch(ds.id); if (!r.ok) toast(r.err, true); else toast('已取消，退回 ' + num(r.back) + ' 研究點'); render(); break; }
      case 'tech-tab': techTab = ds.id; techSel = null; renderView(); break;
      case 'tech-q-add': techEnqueue(ds.id); break;
      case 'tech-q-del': techDequeue(ds.id); break;
      case 'tech-q-front': techQFront(ds.id); break;
      case 'tech-q-clear': G.s.techQueue = []; render(); break;
      case 'gb-region': gbPick(ds.id); break;
      case 'lang': {
        // 標題頁的公司名還是預設值就跟著換；玩家自己打的不動
        const fc = document.getElementById('f-co'); const isDefault = fc && fc.value === ZH.t(DEFAULT_CO);
        setUiPref('lang', ds.v); ZH.set(ds.v);
        if (isDefault) fc.value = ZH.t(DEFAULT_CO);
        document.querySelectorAll('[data-act="lang"]').forEach((b) => b.classList.toggle('on', b.dataset.v === ds.v));
        if (globe) globe.draw();
        break;
      }
      case 'gb-spin': { const v = !uiPref('gbSpin', true); setUiPref('gbSpin', v); if (globe) globe.setSpin(v); renderView(); break; }
      case 'tech-sel': {
        const t = ME.TECH[ds.id]; techSel = techSel === ds.id ? null : ds.id;
        if (techSel && techTab !== techGroupId(t) && !(techTab === 'can' && techReady().includes(t))) techTab = techGroupId(t);
        renderView();
        const nd = document.querySelector('.tk-node[data-id="' + ds.id + '"]'); if (nd) nd.focus({ preventScroll: true });
        break;
      }
      case 'future': { const r = G.researchFuture(); if (!r.ok) toast(r.err, true); render(); break; }
      // 團隊
      case 'hire': {
        const r = G.hire(ds.role, +ds.n); if (!r.ok) { toast(r.err, true); break; }
        const ppl = G.people ? G.people() : []; const nw = (r.people || []).map((id) => ppl.find((x) => x.id === id)).filter(Boolean);
        const who = nw.slice(0, 3).map((x) => x.name + '（' + tierOf(Math.round(x.skill)) + ' ' + Math.round(x.skill) + '）').join('、') + (nw.length > 3 ? ' 等 ' + nw.length + ' 位' : '');
        toast(who ? '新進' + D.ROLES[ds.role].name + '：' + who + '，招募費 ' + money(r.fee) : '招募 ' + ds.n + ' 位' + D.ROLES[ds.role].name + '（招募費 ' + money(r.fee) + '）');
        render(); break;
      }
      case 'fire': confirmBox('裁員？', '裁掉技能最低的 1 位' + D.ROLES[ds.role].name + '，需支付 4 週遣散費，士氣會下降。', '確定裁員', () => G.fire(ds.role, +ds.n), true); break;
      case 'pay': s.payPolicy = +ds.v; render(); break;
      case 'office': { const r = G.upgradeOffice(); if (!r.ok) toast(r.err, true); render(); break; }
      case 'hire-star': { const r = G.hireStar(ds.id); if (!r.ok) toast(r.err, true); render(); break; }
      // 算力
      case 'gap-rent': G.s.autoRent = true; render(); break;
      case 'gap-buy': {
        const n = +ds.n; const x = ME.GPU[ds.id]; const cost = G.gpuPrice(ds.id) * n;
        confirmBox('採購 GPU', `花 ${money(cost)} 買 ${num(n)} 張 ${esc(x.name)}？買完現金會剩 ${money(G.s.cash - cost)}。`, '確定採購', () => { const r = G.buyGpu(ds.id, n); if (!r.ok) toast(r.err, true); else toast('採購 ' + num(n) + ' 張 ' + x.name); render(); });
        break;
      }
      case 'buy-gpu': { const r = G.buyGpu(ds.id, +ds.n); if (!r.ok) toast(r.err, true); else toast('採購 ' + ds.n + ' 張 ' + ME.GPU[ds.id].name); render(); break; }
      case 'sell-gpu': confirmBox('出售 GPU？', '以目前價格的一半賣出 ' + ds.n + ' 張 ' + ME.GPU[ds.id].name + '。', '出售', () => G.sellGpu(ds.id, +ds.n), true); break;
      case 'dc': { const r = G.upgradeDC(); if (!r.ok) toast(r.err, true); render(); break; }
      case 'prio': s.trainFirst = ds.v === 'train'; render(); break;
      // 資料
      case 'inst': { const r = G.buyInst(+ds.n); if (!r.ok) toast(r.err, true); render(); break; }
      case 'deal': { const r = G.buyDeal(ds.id); if (!r.ok) toast(r.err, true); render(); break; }
      // 市場與資本
      case 'mkt': s.marketing = +ds.v; render(); break;
      case 'raise': { const r = G.raiseFunds(); if (!r.ok) toast(r.err, true); else toast('募得 ' + money(r.amt)); render(); break; }
      case 'loan': confirmBox('申請過橋貸款？', '立即取得約 10 週支出的現金，以 7% 股權作為代價。只能用一次。', '申請', () => G.emergencyLoan()); break;
      default: break;
    }
  }
  function onToggle(name, el) {
    if (name === 'log-real') { showReal = el.checked; setUiPref('real', showReal); renderFeed(); renderLogModal(); return; }
    const s = G.s;
    if (name === 'crunch') s.crunch = el.checked;
    else if (name === 'trainprog') s.trainProg = el.checked;
    else if (name === 'autorent') s.autoRent = el.checked;
    else if (name === 'tech-auto') { s.techAuto = el.checked; techQueueRun(); }
    else if (name === 'crawl') s.crawl = el.checked;
    else if (name === 'crawl-aggr') s.crawlAggr = el.checked;
    else if (name === 'userdata') s.userData = el.checked;
    else if (name === 'price') { G.setPrice(+el.dataset.id, el.value); toast('已調整定價'); }
    else if (name === 'chat-model') { chatModel = +el.value; return; }
    else if (name === 'cb-model') { talkSelect(+el.value); return; }
    render();
  }

  document.addEventListener('click', (e) => {
    const bg = e.target.closest('[data-bg]');
    if (bg && e.target === bg) { const mr = document.getElementById('modal-root'); if (mr && mr._closable) closeModal(); return; }
    const a = e.target.closest('[data-act]'); if (!a || a.disabled) return;
    if (a.tagName === 'INPUT' || a.tagName === 'SELECT') return;
    e.preventDefault();
    const name = a.dataset.act;
    holdUntil = 0;
    act(name, a.dataset, a);
    holdUntil = Date.now() + 500;
    sfx(name === 'close-modal' ? 'close' : /^(open-wizard|menu|open-log|codex|report|chat|open-synth|help|credits|export|import|ai-settings|endbook|fn-card)$/.test(name) ? 'open' : 'click');
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'au-music') { setMusic(el.checked); return; }
    if (el.id === 'au-sfx') { setSfx(el.checked); return; }
    if (el.id === 'q-on') { if (G && G.setQuests) { G.setQuests(el.checked); render(); } return; }
    holdUntil = 0;
    if (el.id === 'f-city') { titleSel.city = el.value; const pk = document.getElementById('city-perks'); if (pk) pk.innerHTML = cityPerksHTML(el.value); return; }
    if (el.dataset && el.dataset.act && G) { onToggle(el.dataset.act, el); return; }
    if (el.dataset && el.dataset.w === 'teacher' && wiz) { wiz.teacher = el.value ? +el.value : null; updateWizard(); }
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'au-vol') { setVol(+el.value / 100); return; }
    if (el.id === 'syn-gpus' || el.id === 'syn-weeks') { updateSynth(); return; }
    if (!wiz || !el.dataset || !el.dataset.w) return;
    const w = el.dataset.w;
    if (w === 'name') wiz.name = el.value.slice(0, 24);
    else if (w === 'size') { wiz.size = D.SIZES[+el.value]; renderGpuBounds(); }
    else if (w === 'tokens') wiz.tokens = D.TOKEN_STEPS[+el.value];
    else if (w === 'mix') wiz.mix[el.dataset.k] = +el.value;
    else if (w === 'alloc') wiz.alloc[el.dataset.k] = +el.value;
    else if (w === 'gpus') wiz.gpus = sliderToGpu(+el.value, +el.dataset.mn, +el.dataset.mx);
    updateWizard();
  });
  function renderGpuBounds() {
    const sl = document.querySelector('[data-w="gpus"]'); if (!sl) return;
    const ev = G.evalSpec(wiz); const mnG = Math.max(8, ev.minGpus); const mxG = Math.max(mnG, wizMaxGpus());
    wiz.gpus = Math.min(Math.max(wiz.gpus, mnG), mxG);
    sl.dataset.mn = mnG; sl.dataset.mx = mxG; sl.value = gpuToSlider(wiz.gpus, mnG, mxG);
  }
  document.addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('#main')) holdUntil = Date.now() + 1500; });
  document.addEventListener('keydown', (e) => {
    if (G && e.key === 'Escape' && e.target.id === 'cb-text') { talkFold(false); return; }
    if (e.key === 'Escape' && (!G || FN.ov) && !e.target.closest('input, textarea, select')) { const mr = document.getElementById('modal-root'); if (mr && mr.firstChild && mr._closable) { closeModal(); return; } }
    if (!G || e.target.closest('input, textarea, select')) return;
    if (FN.ov) {
      if (FN.i >= FN.scenes.length - 1 || e.target.closest('button')) return;
      if (e.key === 'Escape') fnGo(FN.scenes.length - 1);
      else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); fnAdvance(); }
      return;
    }
    if (chapterEnd && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); chapterEnd(); return; }
    if (document.getElementById('launch') && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); hideLaunch(); return; }
    if (tourState) { if (e.key === 'Escape') tourEnd(); else if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); tourNext(); } return; }
    if (e.key === 'Escape') { const mr = document.getElementById('modal-root'); if (modalOpen && mr && mr._closable) closeModal(); return; }
    if (modalOpen) return;
    if (e.key === ' ') { e.preventDefault(); setSpeed(speed ? 0 : (lastSpeed || 1)); resumeAfter = false; }
    else if (e.key === '1' || e.key === '2' || e.key === '3') setSpeed(+e.key);
  });

  // 對話視窗：按 Enter 送出；視窗大小改變時重新算對話視窗的上下邊界
  document.addEventListener('submit', (e) => { if (e.target && e.target.id === 'cb-form') { e.preventDefault(); talkSend(); } });
  window.addEventListener('resize', () => layoutChatbox());

  // 視差：滑鼠移動時，背景、角色、懸浮選單往不同方向偏一點（CSS 用 --mx、--my）。觸控和「減少動態」時不做
  let pmRAF = 0;
  document.addEventListener('pointermove', (e) => {
    if (pmRAF || e.pointerType === 'touch') return;
    pmRAF = requestAnimationFrame(() => {
      pmRAF = 0;
      const st = document.getElementById('stage') || document.querySelector('.title-screen'); if (!st) return;
      st.style.setProperty('--mx', ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
      st.style.setProperty('--my', ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
    });
  });

  let hoverEl = null, hoverT = 0;
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch' || !e.target.closest) return;
    const b = e.target.closest('.tile, .rail button, .pill-btn, .choices button, .scen, .advice button'); if (!b || b === hoverEl) return;
    hoverEl = b; const now = performance.now(); if (now - hoverT < 70) return; hoverT = now; sfx('hover');
  });
  document.addEventListener('pointerout', (e) => { if (hoverEl && !(e.relatedTarget && hoverEl.contains(e.relatedTarget))) hoverEl = null; });

  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();

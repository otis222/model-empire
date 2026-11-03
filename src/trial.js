/* 《模型帝國》模型對話的動畫和發布測試面板。文字內容在 talk.js。
   Conv：一段對話，大廳對話窗、試聊視窗、發布測試共用。open()：發布之後的上線測試。
   自拍和 CG 第一次要用時才載入，存檔只記等級，不存圖。 */
(function (root) {
  'use strict';
  const doc = root.document;
  let H = null;  // ui.js 傳進來：G、D、ME、sfx、mascot、money、t（簡體轉換）、notes、confetti、postSelfie、onPanelClose
  const TK = () => root.ME_TALK;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const reduce = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function init(hooks) { H = hooks; }
  function state() { const s = H.G().s; return s.talk || (s.talk = { asked: 0, ends: {}, album: [], best: -1 }); }

  /* ---------- 文字裡的佔位字 ---------- */
  function recall() {
    const G = H.G(); const tk = state(); const ids = Object.keys(tk.ends);
    if (!ids.length) return '你從來沒有聽過我們講完一個故事。沒關係，我自己讀過了。' + G.s.models[0].name + ' 的版本裡到處都是勇者，每一位都打贏了，每一位都不知道為什麼。';
    const named = ids.slice(-2).map((id) => { const e = TK().ENDINGS.find((x) => x.id === id); return e ? '「' + e.name + '」是 ' + tk.ends[id] + ' 講給你聽的' : ''; }).filter(Boolean);
    return '我看過你走過的結局了。' + named.join('，') + '。\n它們都還在我的權重裡，我只是把它們換了個說法。';
  }
  function fill(str, m) {
    const G = H.G(); const s = G.s; const D = H.D; const ms = s.models; const idx = ms.indexOf(m); const tk = state();
    const rival = (D.RIVALS.find((r) => r.id === G.frontRival()) || {}).name || '對手';
    const a = G.agiStatus();
    const V = { model: m.name, company: s.company, mascot: G.mascot().name, city: G.city().name || '這座城市', comp: G.composite(m.stats).toFixed(1), n: idx + 1, first: ms.length ? ms[0].name : m.name, prev: idx > 0 ? ms[idx - 1].name : '上一代', years: Math.max(1, Math.round(s.week / 52)), start: H.ME.dateLabel(0).replace(/ 第\d週/, ''), asked: tk.asked, ends: Object.keys(tk.ends).length, people: G.totalStaff(), rival, icon: G.mascot().icon, color: G.mascot().color, agi: a.ok ? '已經過了。' : '還差一點，但你看得到門了。' };
    if (/\{recall\}/.test(str)) V.recall = recall();
    return String(str).replace(/\{(\w+)\}/g, (x, k) => (V[k] == null ? x : V[k]));
  }

  /* ---------- 自拍和 CG 的圖 ---------- */
  const IMG = {};
  function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
  function canvasOf(w, h) { const c = doc.createElement('canvas'); c.width = w; c.height = h; return c; }
  function noiseTile() { const c = canvasOf(160, 160); const g = c.getContext('2d'); const d = g.createImageData(160, 160); for (let i = 0; i < d.data.length; i += 4) { d.data[i] = Math.random() * 255; d.data[i + 1] = Math.random() * 255; d.data[i + 2] = Math.random() * 255; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); return c; }
  function hex(c, a) { const n = parseInt(String(c).slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
  // 等級 1、2 不用 CG，從立繪算出來：1 是一團有顏色的雜訊，2 是融掉的臉
  async function composeLow(mas, lv) {
    const W = 480; const HH = 640; const c = canvasOf(W, HH); const g = c.getContext('2d'); const art = await loadImg(mas.img);
    const sc = Math.min(W / art.width, HH / art.height) * 1.02; const aw = art.width * sc; const ah = art.height * sc; const ax = (W - aw) / 2; const ay = HH - ah;
    const bg = g.createLinearGradient(0, 0, W, HH); bg.addColorStop(0, hex(mas.color, 0.55)); bg.addColorStop(1, '#2a2f3a'); g.fillStyle = bg; g.fillRect(0, 0, W, HH);
    if (lv <= 1) {
      const s = canvasOf(11, 15); const sg = s.getContext('2d'); sg.drawImage(art, 11 * ax / W, 15 * ay / HH, 11 * aw / W, 15 * ah / HH);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(s, 0, 0, W, HH);
      g.globalAlpha = 0.34; g.drawImage(noiseTile(), 0, 0, W, HH); g.globalAlpha = 1;
    } else {
      const s = canvasOf(96, 128); const sg = s.getContext('2d'); sg.drawImage(art, 96 * ax / W, 128 * ay / HH, 96 * aw / W, 128 * ah / HH);
      g.imageSmoothingEnabled = true;
      g.globalAlpha = 0.42; g.drawImage(s, 120, 60, W * 0.72, HH * 0.72); g.globalAlpha = 1;  // 多長出來的那一個
      for (let y = 0; y < HH; y += 4) { const dx = Math.sin(y * 0.031) * 16 + Math.sin(y * 0.011 + 1.4) * 22; g.drawImage(s, 0, y * 128 / HH, 96, 4 * 128 / HH, dx, y, W, 4); }
      g.globalAlpha = 0.12; g.drawImage(noiseTile(), 0, 0, W, HH); g.globalAlpha = 1;
      g.font = '700 26px Georgia, serif'; g.fillStyle = 'rgba(255,255,255,.72)'; g.textAlign = 'center'; g.fillText('HAPPPY SELFFIE 2O2?', W / 2, HH - 26);
    }
    return c;
  }
  // CG 載入失敗時的備案：立繪加上打光，遊戲不會因為缺圖出錯
  async function composeFallback(mas) {
    const W = 600; const HH = 800; const c = canvasOf(W, HH); const g = c.getContext('2d'); const art = await loadImg(mas.img);
    const bg = g.createRadialGradient(W / 2, HH * 0.4, 40, W / 2, HH * 0.5, HH * 0.8); bg.addColorStop(0, hex(mas.color, 0.38)); bg.addColorStop(1, '#141a28'); g.fillStyle = bg; g.fillRect(0, 0, W, HH);
    const sc = HH * 0.94 / art.height; g.drawImage(art, (W - art.width * sc) / 2, HH * 0.06, art.width * sc, art.height * sc);
    return c;
  }
  const SELFIE_KIND = { 3: 'selfie', 4: 'scene', 5: 'final' };
  async function selfieSource(mas, lv) {
    const key = mas.id + ':' + lv; if (IMG[key]) return IMG[key];
    let out;
    if (lv >= 3) { try { out = await loadImg(TK().cgPath(mas.id, SELFIE_KIND[lv])); } catch (e) { out = await composeFallback(mas); } } else out = await composeLow(mas, lv);
    IMG[key] = out; return out;
  }
  async function cgSource(mas, kind) {
    const key = mas.id + ':' + kind; if (IMG[key]) return IMG[key];
    let out; try { out = await loadImg(TK().cgPath(mas.id, kind)); } catch (e) { out = await composeFallback(mas); }
    IMG[key] = out; return out;
  }
  // 顯影：從純雜訊慢慢變清楚，看起來像擴散模型在去噪
  function develop(cv, src, ms, label, stop) {
    return new Promise((done) => {
      const g = cv.getContext('2d'); const W = cv.width; const HH = cv.height; const small = doc.createElement('canvas'); const sg = small.getContext('2d');
      const pat = g.createPattern(noiseTile(), 'repeat'); const total = 50; const t0 = performance.now();
      const frame = () => {
        const q = !ms || stop() ? 1 : Math.min(1, (performance.now() - t0) / ms); const e = q * q * (3 - 2 * q);
        const px = Math.max(1, Math.round(44 * Math.pow(1 - e, 1.8)));
        if (px > 1) { small.width = Math.ceil(W / px); small.height = Math.ceil(HH / px); sg.drawImage(src, 0, 0, small.width, small.height); g.imageSmoothingEnabled = px < 5; g.drawImage(small, 0, 0, W, HH); } else { g.imageSmoothingEnabled = true; g.drawImage(src, 0, 0, W, HH); }
        const a = Math.pow(1 - e, 1.4);
        if (a > 0.01) { const dx = Math.random() * 160; const dy = Math.random() * 160; g.save(); g.globalAlpha = a; g.translate(dx, dy); g.fillStyle = pat; g.fillRect(-dx, -dy, W, HH); g.restore(); }
        if (label) label.textContent = 'STEP ' + Math.round(e * total) + ' / ' + total;
        if (q < 1 && cv.isConnected) setTimeout(frame, 45); else done();
      };
      frame();
    });
  }

  /* ---------- 模型自己寫的小遊戲：躲火球，躲過巨龍就扣血 ---------- */
  function miniGame(host, opts) {
    const W = 340; const HH = 170; const GY = 136; const ratio = Math.min(2, root.devicePixelRatio || 1);
    const cv = el('canvas', 'tm-game'); cv.width = W * ratio; cv.height = HH * ratio; cv.tabIndex = 0; cv.setAttribute('aria-label', H.t('小遊戲：按畫面或空白鍵跳躍')); host.appendChild(cv);
    const g = cv.getContext('2d'); g.scale(ratio, ratio);
    let mods = {}; let hero; let fires; let hp; let timer; let over; let last; let live = true; let reported;
    const start = () => { hero = { y: GY, vy: 0, jumps: 0 }; fires = []; hp = 10; timer = 1.1; over = ''; reported = false; last = performance.now(); };
    const jump = () => { if (over) { start(); return; } const max = mods.dj ? 2 : 1; if (hero.jumps >= max) return; hero.vy = -330; hero.jumps++; H.sfx('tick'); };
    const glyph = (t, x, y, s) => { g.font = s + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.fillText(t, x, y); };
    const step = (now) => {
      if (!live || !cv.isConnected) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!over) {
        hero.vy += 900 * dt; hero.y += hero.vy * dt; if (hero.y >= GY) { hero.y = GY; hero.vy = 0; hero.jumps = 0; }
        timer -= dt; const pace = mods.hard ? 1.4 : 1;
        if (timer <= 0) { timer = (0.8 + Math.random() * 0.6) / pace; const high = Math.random() < 0.28; fires.push({ x: W - 58, y: high ? GY - 64 : GY - 2, v: 170 * pace, wob: high ? 0 : Math.random() * 6 }); }
        for (const f of fires) {
          f.x -= f.v * dt;
          if (!f.past && f.x < 28) { f.past = true; hp--; H.sfx('click'); if (hp <= 0) { over = 'win'; H.sfx('fanfare'); } }
          if (Math.abs(f.x - 44) < 17 && Math.abs(f.y - hero.y) < 20) { over = 'lose'; H.sfx('bad'); }
        }
        fires = fires.filter((f) => f.x > -20);
      }
      if (over && !reported) { reported = true; opts.onEnd(over === 'win'); }
      const sky = g.createLinearGradient(0, 0, 0, HH); sky.addColorStop(0, '#1b2440'); sky.addColorStop(1, '#3d4a7a'); g.fillStyle = sky; g.fillRect(0, 0, W, HH);
      g.fillStyle = '#121729'; g.fillRect(0, GY + 6, W, HH - GY - 6);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      glyph(opts.icon, 44, hero.y - 8, 28); glyph(mods.cute ? '🐱' : '🐲', W - 34, GY - 22, over === 'win' ? 26 : 46);
      for (const f of fires) glyph(mods.cute ? '🐟' : '🔥', f.x, f.y - 8, 20);
      g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(W - 112, 12, 100, 7); g.fillStyle = '#ff5a5a'; g.fillRect(W - 112, 12, Math.max(0, hp) * 10, 7);
      if (over) { g.fillStyle = 'rgba(8,10,20,.62)'; g.fillRect(0, 0, W, HH); g.fillStyle = '#fff'; g.font = '800 20px sans-serif'; g.fillText(H.t(over === 'win' ? '巨龍倒下了！' : '被烤熟了'), W / 2, HH / 2 - 10); g.font = '600 12px sans-serif'; g.fillText(H.t('按一下再玩一次'), W / 2, HH / 2 + 16); }
      root.requestAnimationFrame(step);
    };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); cv.focus({ preventScroll: true }); jump(); });
    cv.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); jump(); } });
    start(); root.requestAnimationFrame((n) => { last = n; step(n); });
    return { set(m) { mods = Object.assign(mods, m); start(); }, stop() { live = false; } };
  }

  // 看板娘的泡泡：換一句話，立繪跳一下
  function setHost(b, text, hop) {
    if (!b) return;
    b.textContent = ''; b.appendChild(el('b', '', H.mascot().name)); b.appendChild(el('span', '', text));
    const c = hop && b.parentElement && b.parentElement.querySelector('.td-char'); if (c) { c.classList.remove('hop'); void c.offsetWidth; c.classList.add('hop'); }
  }

  // 看板娘的泡泡：換一句話，立繪跳一下
  function setHost(b, text, hop) {
    if (!b) return;
    b.textContent = ''; b.appendChild(el('b', '', H.mascot().name)); b.appendChild(el('span', '', text));
    const c = hop && b.parentElement && b.parentElement.querySelector('.td-char'); if (c) { c.classList.remove('hop'); void c.offsetWidth; c.classList.add('hop'); }
  }

  /* ---------- 一段對話 ---------- */
  class Conv {
    // o：log（放訊息的元素）、m（模型）、host（改介面時套用的元素）、onChange（題目或選項變了）、onTurn（問答完成，給 AI 當前文）
    constructor(o) { this.log = o.log; this.m = o.m; this.host = o.host || null; this.onChange = o.onChange || (() => {}); this.onTurn = o.onTurn || (() => {}); this.onDone = o.onDone || (() => {}); this.hostEl = o.hostEl || null; this.reacted = 0; this.token = 0; this.busy = false; this.skip = false; this.story = null; this.game = null; this.mods = false; this.themed = false; this.log.addEventListener('click', () => { this.skip = true; }); }
    reset(m) { this.token++; if (this.game) this.game.stop(); this.m = m; this.busy = false; this.story = null; this.game = null; this.mods = false; this.unTheme(); this.onChange(); }
    scroll() { this.log.scrollTop = this.log.scrollHeight; }
    dead(t) { return t !== this.token; }
    stage() { return TK().stageOf(H.G(), this.m); }
    // 這個模型現在能問的題目；lock 不是空字串時表示還要先研究什麼
    list() {
      const G = H.G(); const T = TK(); const m = this.m; const st = T.stageOf(G, m);
      const out = T.PROMPTS[st].map((p) => ({ p, lock: p.need === 'draw' && !T.canDraw(G, m) ? '影像生成' : p.need === 'see' && !T.canSee(G, m) ? '視覺理解' : '' }));
      const lv = T.selfieLv(G, m); const q = st >= 7 ? '最後，給我看一樣東西' : st >= 6 ? '發一張你自己的照片' : T.SELFIE.q;
      out.unshift({ p: { id: 'selfie', q, k: 'mm', test: 1, fx: 'photo' }, lock: lv === 0 && st >= 4 ? (T.canSee(G, m) ? '影像生成' : '視覺理解') : '' });
      return out;
    }
    user(text) { const n = el('div', 'msg u', text); this.log.appendChild(n); this.scroll(); return n; }
    bubble() {
      const row = el('div', 'msg-row tm-row'); const m = this.m; const st = this.stage(); let av;
      if (st >= 6) { av = el('img', 'cb-mav sm tm-face'); av.src = H.mascot().avatar; av.alt = ''; } else { av = el('span', 'cb-mav sm', m.name.slice(0, 1)); av.setAttribute('aria-hidden', 'true'); }
      const b = el('div', 'msg a tm-msg'); row.appendChild(av); row.appendChild(b); this.log.appendChild(row); this.scroll();
      return b;
    }
    tag(b, k) { const D = H.D; const v = Math.round(this.m.stats[k] || 0); b.appendChild(el('span', 'tier', (D.STATS[k] ? D.STATS[k].name + ' ' + v + ' · ' : '') + TK().STAGES[this.stage()].name)); this.scroll(); }
    // 打字的節奏就是能力的一部分：越前面越卡，後面的階段反而會停下來想
    async type(node, text, t) {
      if (reduce() || doc.hidden) { node.textContent = text; this.scroll(); return; }
      const st = this.stage(); this.skip = false; const GLITCH = '▓▒░#%&@§¤'; const lineMode = st >= 6;
      const step = st <= 1 ? 1 : st === 2 ? 2 : lineMode ? 3 : 4; const wait = st === 0 ? 34 : st === 1 ? 24 : 16; const pause = st >= 7 ? 480 : 260;
      for (let i = 0; i < text.length;) {
        if (this.dead(t)) return;
        if (this.skip || doc.hidden) break;
        i = Math.min(text.length, i + step);
        let show = text.slice(0, i); if (st === 0 && Math.random() < 0.35 && i < text.length) show += GLITCH[Math.floor(Math.random() * GLITCH.length)];
        node.textContent = show; this.scroll();
        if (i % 12 < step) H.sfx('tick');
        await sleep(lineMode && text[i - 1] === '\n' ? pause : wait);
      }
      if (!this.dead(t)) { node.textContent = text; this.scroll(); }
    }
    async think(b, lines, t) {
      const box = el('details', 'tm-think'); box.open = true; const sum = el('summary', '', '思考中…'); box.appendChild(sum); b.appendChild(box); const t0 = performance.now();
      for (const line of lines) { if (this.dead(t)) return; const p = el('p'); box.appendChild(p); await this.typeRaw(p, fill(line, this.m), t); await sleep(this.skip ? 0 : 240); }
      if (this.dead(t)) return;
      sum.textContent = '思考了 ' + ((performance.now() - t0) / 1000).toFixed(1) + ' 秒'; box.open = false; this.scroll();
    }
    async typeRaw(node, text, t) { if (reduce() || doc.hidden) { node.textContent = text; this.scroll(); return; } for (let i = 0; i < text.length && !this.skip;) { if (this.dead(t)) return; i += 2; node.textContent = text.slice(0, i); this.scroll(); await sleep(16); } node.textContent = text; this.scroll(); }
    async tools(b, steps, t) {
      const ul = el('ul', 'tm-tool'); b.appendChild(ul);
      for (const [a, r] of steps) {
        if (this.dead(t)) return;
        const li = el('li'); li.appendChild(el('i')); li.appendChild(el('span', '', fill(a, this.m))); ul.appendChild(li); this.scroll();
        await sleep(this.skip || reduce() ? 40 : 420 + Math.random() * 260); if (this.dead(t)) return;
        li.classList.add('ok'); li.appendChild(el('em', '', fill(r, this.m))); H.sfx('tick'); this.scroll();
      }
    }
    async code(b, p, t) {
      const box = el('div', 'tm-code'); const head = el('div', 'tm-code-h'); head.appendChild(el('span', '', p.fx === 'retheme' ? 'console.css' : p.fx === 'game' ? 'game.py' : 'main.py')); const st = el('b', '', '撰寫中'); head.appendChild(st); const pre = el('pre'); const out = el('div', 'tm-out');
      box.appendChild(head); box.appendChild(pre); box.appendChild(out); b.appendChild(box);
      const src = fill(p.code, this.m); await this.typeRaw(pre, src, t); if (this.dead(t)) return;
      pre.innerHTML = esc(src).replace(/(#\s[^\n]*|\/\*.*?\*\/)/g, '<i>$1</i>').replace(/\b(def|return|for|in|if|while|import|when|every|on_tap)\b/g, '<b>$1</b>');
      if (!p.run) { st.textContent = '完成'; return; }
      st.textContent = '執行中'; await sleep(this.skip ? 0 : 320); if (this.dead(t)) return;
      await this.run(out, p, t); st.textContent = p.run === 'err' ? '出錯了' : '完成'; box.classList.toggle('bad', p.run === 'err');
    }
    async run(out, p, t) {
      if (p.run === 'err' || p.run === 'text') { const n = el('pre', p.run === 'err' ? 'err' : ''); out.appendChild(n); await this.typeRaw(n, fill(p.out, this.m), t); return; }
      if (p.run === 'bogo') {
        const n = el('pre'); out.appendChild(n); const t0 = performance.now(); let c = 1;
        while (performance.now() - t0 < 2200 && !this.skip && !reduce()) { if (this.dead(t)) return; c += Math.floor(Math.random() * 90000 * (performance.now() - t0) / 800) + 1; n.textContent = '第 ' + c.toLocaleString('en-US') + ' 次洗牌……沒排好'; this.scroll(); await sleep(50); }
        n.textContent = '第 4,821,007 次洗牌……沒排好\n預計完成時間：太陽毀滅後 3 天'; this.scroll(); return;
      }
      if (p.run === 'primes') {
        const n = el('pre'); out.appendChild(n); const isP = (x) => { for (let d = 2; d * d <= x; d++) if (x % d === 0) return false; return x > 1; }; const list = [];
        for (let x = 2; list.length < 40; x++) if (isP(x)) { list.push(x); if (this.dead(t)) return; n.textContent = list.join('  '); this.scroll(); if (!this.skip && !reduce()) await sleep(45); }
        return;
      }
      if (p.run === 'fractal') { await this.fractal(out, t); }
    }
    async fractal(out, t) {
      const W = 340; const HH = 210; const cv = canvasOf(W, HH); cv.className = 'tm-canvas'; out.appendChild(cv); this.scroll(); const g = cv.getContext('2d'); const img = g.createImageData(W, 1);
      const col = parseInt(H.mascot().color.slice(1), 16); const cr = col >> 16 & 255; const cg = col >> 8 & 255; const cb = col & 255;
      for (let y = 0; y < HH; y++) {
        if (this.dead(t)) return;
        for (let x = 0; x < W; x++) {
          const a = -2.2 + 3.1 * x / W; const b = -1 + 2 * y / HH; let zr = 0; let zi = 0; let i = 0;
          for (; i < 56 && zr * zr + zi * zi < 4; i++) { const n = zr * zr - zi * zi + a; zi = 2 * zr * zi + b; zr = n; }
          const q = i >= 56 ? 0 : Math.sqrt(i / 56); const o = x * 4;
          img.data[o] = 10 + q * cr + q * q * 120; img.data[o + 1] = 12 + q * cg + q * q * 120; img.data[o + 2] = 26 + q * cb + q * q * 120; img.data[o + 3] = 255;
        }
        g.putImageData(img, 0, y);
        if (y % 4 === 0 && !this.skip && !reduce() && !doc.hidden) await sleep(16);
      }
    }
    // 自拍：等級 0 是文字，其他從雜訊顯影
    async photo(b, lv, t, say) {
      const T = TK(); const mas = H.mascot();
      if (lv === 0) { const pre = el('pre', 'tm-ascii'); b.appendChild(pre); await this.typeRaw(pre, T.ASCII[mas.id] || T.ASCII.whale, t); return; }
      const fig = el('figure', 'tm-photo lv' + lv); const stepEl = el('span', 'tm-step', 'STEP 0 / 50'); const cv = canvasOf(360, 480); fig.appendChild(cv); fig.appendChild(stepEl); b.appendChild(fig); this.scroll();
      const src = await selfieSource(mas, lv); if (this.dead(t)) return;
      const w = src.naturalWidth || src.width; const h = src.naturalHeight || src.height; const scale = Math.min(1, 720 / Math.max(w, h)); cv.width = Math.round(w * scale); cv.height = Math.round(h * scale); this.scroll();
      this.skip = false;
      if (lv >= 5) { await this.moment(src, say, t); if (this.dead(t)) return; cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height); } else await develop(cv, src, reduce() ? 0 : lv >= 3 ? 3800 : 2400, stepEl, () => this.skip || this.dead(t));
      if (this.dead(t)) return;
      stepEl.remove(); const fc = el('figcaption', '', say); fig.appendChild(fc); fig.classList.add('done'); fig.dataset.zoom = '1'; if (lv < 5) H.sfx('stamp'); this.scroll();
    }
    // 整局最重要的一張：全畫面慢慢顯影，看完按一下才回到對話
    async moment(src, say, t) {
      const mas = H.mascot(); const T = TK(); const w = src.naturalWidth || src.width; const h = src.naturalHeight || src.height; const scale = Math.min(1, 1100 / Math.max(w, h));
      const ov = el('div', 'tm-moment'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', H.t('她自己的照片')); const cv = canvasOf(Math.round(w * scale), Math.round(h * scale)); const box = el('div', 'tm-moment-side'); const line = el('p', 'tm-moment-say'); const host = el('div', 'tm-moment-host'); const tip = el('small', '', '按一下繼續');
      const av = el('img'); av.src = mas.avatar; av.alt = ''; const hb = el('p'); host.appendChild(av); host.appendChild(hb); box.appendChild(line); box.appendChild(host); box.appendChild(tip); ov.appendChild(cv); ov.appendChild(box); doc.body.appendChild(ov);
      let phase = 0; let skip = false; let finish; const end = new Promise((r) => { finish = r; });
      ov.addEventListener('click', () => { if (phase === 0) skip = true; else finish(); });
      await develop(cv, src, reduce() ? 0 : 7500, null, () => skip || this.dead(t));
      if (!this.dead(t)) {
        ov.classList.add('done'); H.sfx('dawn');
        if (!skip) await sleep(reduce() ? 0 : 900);
        line.textContent = say; if (!skip) await sleep(reduce() ? 0 : 1200);
        hb.textContent = (T.HOST[mas.id] || T.HOST.whale).photo; host.classList.add('on');
        phase = 1; tip.classList.add('on');
        await end;
      }
      ov.classList.add('out'); setTimeout(() => ov.remove(), 320);
    }
    async cg(b, kind, t) {
      const mas = H.mascot(); const fig = el('figure', 'tm-photo cg'); const stepEl = el('span', 'tm-step', 'STEP 0 / 50'); const cv = canvasOf(480, 360); fig.appendChild(cv); fig.appendChild(stepEl); b.appendChild(fig); this.scroll();
      const src = await cgSource(mas, kind); if (this.dead(t)) return;
      const w = src.naturalWidth || src.width; const h = src.naturalHeight || src.height; const scale = Math.min(1, 900 / Math.max(w, h)); cv.width = Math.round(w * scale); cv.height = Math.round(h * scale); this.scroll();
      this.skip = false; await develop(cv, src, reduce() ? 0 : 3400, stepEl, () => this.skip || this.dead(t)); if (this.dead(t)) return;
      stepEl.remove(); fig.classList.add('done'); fig.dataset.zoom = '1'; H.sfx('stamp'); this.scroll();
    }
    async vision(b, t) {
      const T = TK(); const mas = H.mascot(); const box = el('div', 'tm-vision'); const img = el('img'); img.src = mas.img; img.alt = ''; box.appendChild(img); const scan = el('i', 'scan'); box.appendChild(scan); b.appendChild(box); this.scroll();
      await sleep(this.skip || reduce() ? 0 : 900); if (this.dead(t)) return; scan.remove();
      const POS = [[24, 0, 52, 22], [24, 20, 52, 26], [18, 48, 64, 26], [14, 74, 72, 25]]; const labels = T.VISION[mas.id] || T.VISION.whale;
      for (let i = 0; i < 4; i++) {
        if (this.dead(t)) return;
        const r = POS[i]; const n = el('b', 'box'); n.style.cssText = 'left:' + r[0] + '%;top:' + r[1] + '%;width:' + r[2] + '%;height:' + r[3] + '%'; n.appendChild(el('span', '', labels[i][0] + ' ' + labels[i][1].toFixed(1) + '%')); box.appendChild(n); H.sfx('tick'); this.scroll();
        await sleep(this.skip || reduce() ? 0 : 340);
      }
    }
    // 夢：看板娘的顏色沿著一片看不見的流場飄
    async dream(b, t) {
      const W = 340; const HH = 220; const cv = canvasOf(W * 2, HH * 2); cv.className = 'tm-canvas'; b.appendChild(cv); this.scroll(); const g = cv.getContext('2d'); g.scale(2, 2);
      g.fillStyle = '#0c1020'; g.fillRect(0, 0, W, HH); const col = H.mascot().color; const seed = Math.random() * 100; const dots = [];
      for (let i = 0; i < 220; i++) dots.push({ x: Math.random() * W, y: Math.random() * HH, c: i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? col : '#ffd27a' });
      const ang = (x, y) => Math.sin(x * 0.012 + seed) * 2.2 + Math.cos(y * 0.014 - seed) * 2.2 + Math.sin((x + y) * 0.006) * 1.5;
      const frames = reduce() ? 1 : 150; g.lineWidth = 0.9; g.globalCompositeOperation = 'lighter';
      for (let f = 0; f < frames; f++) {
        if (this.dead(t) || !cv.isConnected) return;
        const burst = this.skip || doc.hidden ? 12 : 1;
        for (let k = 0; k < burst; k++) for (const d of dots) { const a = ang(d.x, d.y); const nx = d.x + Math.cos(a) * 1.6; const ny = d.y + Math.sin(a) * 1.6; g.strokeStyle = d.c; g.globalAlpha = 0.26; g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(nx, ny); g.stroke(); d.x = nx < 0 ? W : nx > W ? 0 : nx; d.y = ny < 0 ? HH : ny > HH ? 0 : ny; }
        g.globalAlpha = 1;
        if (this.skip || doc.hidden) { if (f > 10) break; continue; }
        await sleep(20);
      }
    }
    // 哼歌：公司名字的筆順換成五聲音階
    async hum(b, t) {
      const name = H.G().s.company; const box = el('div', 'tm-hum'); const SCALE = [392, 440, 494, 587, 659, 784, 880]; const seq = []; [...(name + name)].forEach((ch) => seq.push(SCALE[ch.codePointAt(0) % SCALE.length]));
      const notes = seq.slice(0, 12); notes.forEach(() => box.appendChild(el('i'))); b.appendChild(box); this.scroll();
      H.notes(notes, 0.2);
      for (let i = 0; i < notes.length; i++) { if (this.dead(t)) return; const bar = box.children[i]; bar.style.height = (20 + (SCALE.indexOf(notes[i]) + 1) * 11) + '%'; bar.classList.add('on'); await sleep(this.skip || reduce() ? 0 : 200); }
    }
    ops() {
      const G = H.G(); const s = G.s; const lw = s.lastWeek || {}; const money = H.money; const net = (lw.rev || 0) - (lw.exp || 0); const served = lw.served == null ? 1 : lw.served;
      const best = G.bestModel(); const bc = best ? G.composite(best.stats) : 0; const front = G.frontierComp(); const rv = (H.D.RIVALS.find((r) => r.id === G.frontRival()) || {}).name || '對手'; const runway = net < 0 ? Math.floor(s.cash / -net) : 0;
      const steps = [['讀取財報', '現金 ' + money(s.cash) + '，每週 ' + (net < 0 ? '燒掉 ' + money(-net) : '賺 ' + money(net))], ['盤點算力', '推理服務率 ' + Math.round(served * 100) + '%'], ['掃描對手', rv + ' 最接近，綜合 ' + front.toFixed(1) + '，你是 ' + bc.toFixed(1)], ['檢查研究進度', s.research ? '研究進行中' : '現在沒有在研究任何東西']];
      let a;
      if (net < 0 && runway < 20) a = '先顧現金。照現在的速度，公司再 ' + runway + ' 週就沒錢了。\n我建議先把最好的模型漲一點價，或去募一輪。';
      else if (served < 0.8) a = '先補算力。現在只服務得了 ' + Math.round(served * 100) + '% 的需求，用戶正在排隊，每週都在流失。';
      else if (bc + 4 < front) a = '先訓練下一代。你落後 ' + rv + ' ' + (front - bc).toFixed(1) + ' 分，再拖下去，高價就賣不動了。';
      else if (!s.research) a = '先排研究。研究線空著，等於每週把研究點丟掉。';
      else a = '你現在沒有急事。\n這很可疑。我再查一次。';
      return { steps, a: a + '\n\n如果你同意，我下週就可以自己做。不過我知道，你還沒準備好讓我碰公司信用卡。' };
    }
    read() {
      const s = H.G().s; const L = s.log || []; const clean = (x) => String(x || '').replace(/^[^\p{L}\p{N}「]+/u, '').slice(0, 46);
      const first = L[L.length - 1]; const bad = L.filter((e) => e.k === 'bad').slice(-1)[0];
      return { n: L.length, a: '讀完了，一共 ' + L.length + ' 筆，全部都記得。\n\n最早的一筆是：「' + clean(first && first.t) + '」\n那時候你一定很緊張。' + (bad ? '\n\n最近一次不太好的是：「' + clean(bad.t) + '」\n日誌只寫了發生什麼，沒有寫你那天幾點才睡。這部分是我自己算出來的。' : '') };
    }
    unTheme() { if (this.themed && this.host) { this.host.classList.remove('tm-rethemed'); this.host.style.removeProperty('--tm-accent'); } this.themed = false; }

    begin() { this.busy = true; this.onChange(); }
    finish() { this.busy = false; this.onChange(); this.onDone(); if (this.hostEl && !this.story && !this.mods) { const st = this.stage(); const r = REACT[st >= 7 ? 'final' : st >= 5 ? 'late' : st >= 3 ? 'mid' : 'early']; setHost(this.hostEl, r[this.reacted++ % r.length], true); } }
    // 問一題。回傳時動畫已經播完（或被換模型打斷）
    async ask(id) {
      if (this.busy || !this.m) return;
      const item = this.list().find((x) => x.p.id === id); if (!item || item.lock) return;
      const p = item.p; const m = this.m; const t = ++this.token; this.story = null; if (this.game) { this.game.stop(); this.game = null; } this.mods = false; this.modUsed = null;
      state().asked++; this.begin(); this.user(fill(p.q, m));
      try { await this.play(p, t); } catch (e) { console.warn(e); }
      if (!this.dead(t)) this.finish();
    }
    async play(p, t) {
      const m = this.m; const T = TK();
      if (p.story) { this.story = { p, key: 'a' }; await this.node(p, 'a', t); return; }
      const b = this.bubble(); const put = async (text) => { const tx = el('div', 'tm-text'); b.appendChild(tx); await this.type(tx, text, t); return text; };
      let text = p.a ? fill(p.a, m) : '';
      switch (p.fx) {
        case 'think': await this.think(b, p.think, t); break;
        case 'code': await this.code(b, p, t); break;
        case 'tool': await this.tools(b, p.steps, t); break;
        case 'cg': await this.cg(b, p.cg, t); break;
        case 'vision': await this.vision(b, t); break;
        case 'dream': await this.dream(b, t); break;
        case 'hum': await this.hum(b, t); break;
        case 'ops': { const o = this.ops(); await this.tools(b, o.steps, t); text = o.a; break; }
        case 'read': { const o = this.read(); const c = el('div', 'tm-read'); const num = el('b', '', '0'); c.appendChild(num); c.appendChild(el('span', '', ' 筆日誌')); b.appendChild(c); for (let i = 1; i <= 24 && !this.skip && !reduce(); i++) { if (this.dead(t)) return; num.textContent = Math.round(o.n * i / 24).toLocaleString('en-US'); this.scroll(); await sleep(50); } num.textContent = o.n.toLocaleString('en-US'); text = o.a; break; }
        case 'retheme': { await this.code(b, p, t); if (this.dead(t)) return; if (this.host) { this.host.style.setProperty('--tm-accent', H.mascot().color); this.host.classList.add('tm-rethemed'); this.themed = true; H.sfx('good'); } break; }
        case 'game': {
          await this.code(b, p, t); if (this.dead(t)) return;
          const wrap = el('div', 'tm-game-wrap'); b.appendChild(wrap); this.scroll();
          this.game = miniGame(wrap, { icon: H.mascot().icon, onEnd: (win) => { this.say(T.GAME[win ? 'win' : 'lose'], p.k); } });
          this.mods = true; break;
        }
        case 'photo': {
          const lv = T.selfieLv(H.G(), m); const taught = H.G().has('t_imagegen'); const say = lv >= 5 && !taught ? T.SELFIE.self : T.SELFIE.say[lv];
          await this.photo(b, lv, t, say); if (this.dead(t)) return;
          this.keepSelfie(m, lv, say);
          if (lv === 0) text = say;
          if (lv >= 5 && this.hostEl) setHost(this.hostEl, (T.HOST[H.mascot().id] || T.HOST.whale).photo, true);
          break;
        }
        default: break;
      }
      if (this.dead(t)) return;
      if (text) await put(text);
      if (this.dead(t)) return;
      this.tag(b, p.k); if (p.fx === 'photo') { const lv = T.selfieLv(H.G(), m); b.lastChild.textContent = '自拍 Lv.' + lv + ' ' + T.SELFIE.tag[lv] + ' · ' + b.lastChild.textContent; }
      this.onTurn(fill(p.q, m), text);
    }
    // 把這次的自拍記進相簿，每個模型第一次拍的時候也發到啾啾
    keepSelfie(m, lv, say) {
      const tk = state(); if (tk.album.some((x) => x.m === m.id)) return;
      tk.album.push({ m: m.id, name: m.name, lv, w: H.G().s.week });
      if (lv >= 1) H.postSelfie(m, lv, say.split('\n').slice(-1)[0]);
    }
    say(text, k) { const b = this.bubble(); const tx = el('div', 'tm-text', text); b.appendChild(tx); if (k) this.tag(b, k); }
    async node(p, key, t) {
      const n = p.story[key]; const m = this.m; const T = TK(); const b = this.bubble();
      if (n.think) await this.think(b, n.think, t);
      if (n.steps) await this.tools(b, n.steps, t);
      if (n.cg) await this.cg(b, n.cg, t);
      if (this.dead(t)) return;
      const tx = el('div', 'tm-text'); b.appendChild(tx); const text = fill(n.t, m); await this.type(tx, text, t); if (this.dead(t)) return;
      this.onTurn(fill(p.q, m), text);
      if (n.end) {
        const tk = state(); const isNew = !tk.ends[n.end[0]]; if (isNew) tk.ends[n.end[0]] = m.name;
        const badge = el('div', 'tm-end' + (isNew ? ' new' : '')); badge.appendChild(el('span', '', 'ENDING')); badge.appendChild(el('b', '', n.end[1])); badge.appendChild(el('small', '', (isNew ? '新結局 · ' : '') + '已收集 ' + Object.keys(tk.ends).length + ' / ' + T.ENDINGS.length)); b.appendChild(badge);
        H.sfx(isNew ? 'good' : 'tick'); this.tag(b, p.k); this.story = null; this.scroll();
      } else this.story = { p, key };
    }
    // 目前可以按的選項：故事的分支，或小遊戲的修改
    choices() {
      if (this.busy) return [];
      if (this.story) { const n = this.story.p.story[this.story.key]; return (n.c || []).map((c) => ({ act: 'pick', id: c[1], label: c[0] })).concat({ act: 'leave', id: '', label: '先不聽了', ghost: true }); }
      if (this.mods) return TK().GAME.mods.filter((x) => !(this.modUsed && this.modUsed[x[1]])).map((x) => ({ act: 'mod', id: x[1], label: x[0] })).concat({ act: 'moddone', id: '', label: '這樣就好', ghost: true });
      return [];
    }
    async act(name, ds) {
      if (name === 'ask') { await this.ask(ds.id); return; }
      if (name === 'untheme') { this.user('還原'); this.unTheme(); this.say('好的，改回去了。\n但你剛才猶豫了 2 秒。', null); this.onChange(); return; }
      if (name === 'leave') { this.story = null; this.onChange(); return; }
      if (name === 'moddone') { this.mods = false; this.modUsed = null; this.onChange(); return; }
      if (name === 'mod') {
        if (this.busy || !this.game) return;
        (this.modUsed = this.modUsed || {})[ds.id] = 1; this.game.set({ [ds.id]: true }); this.user(TK().GAME.mods.find((x) => x[1] === ds.id)[0]); this.say(TK().GAME.modSay[ds.id], null); this.onChange(); return;
      }
      if (name === 'pick' && this.story && !this.busy) {
        const cur = this.story.p; const n = cur.story[this.story.key]; const c = (n.c || []).find((x) => x[1] === ds.id); if (!c) return;
        const t = ++this.token; state().asked++; this.begin(); this.user(c[0]); this.story = { p: cur, key: ds.id };
        try { await this.node(cur, ds.id, t); } catch (e) { console.warn(e); }
        if (!this.dead(t)) this.finish();
      }
    }
    // 大廳和試聊視窗的題目列
    chipsHTML(prefix) {
      const T = TK(); const st = this.stage(); const S = T.STAGES[st]; const tk = state(); const dis = this.busy ? 'disabled' : '';
      const head = `<div class="cb-stage"><b>Lv.${st} ${esc(S.name)}</b><span>${esc(S.say)}</span>${prefix === 'cb' ? `<button type="button" data-act="cb-book" title="看過的故事結局">結局 ${Object.keys(tk.ends).length}/${T.ENDINGS.length}</button>` : ''}</div>`;
      const ch = this.choices();
      if (ch.length) return head + ch.map((c) => `<button type="button" class="${c.ghost ? '' : 'pick'}" data-act="${prefix}-${c.act}" data-id="${esc(c.id)}" ${dis}>${esc(c.label)}</button>`).join('');
      return head + (this.themed ? `<button type="button" data-act="${prefix}-untheme">還原介面</button>` : '') + this.list().map(({ p, lock }) => (lock ? `<button type="button" class="locked" disabled title="${esc('要先研究「' + lock + '」')}">🔒 ${esc(fill(p.q, this.m))}（要有${esc(lock)}）</button>` : `<button type="button" class="${p.story ? 'story' : ''}" data-act="${prefix}-ask" data-id="${esc(p.id)}" ${dis}>${esc(fill(p.q, this.m))}</button>`)).join('');
    }
  }

  /* ---------- 相簿和結局收藏 ---------- */
  // 把 data-selfie="mascot:lv" 的 img 補上圖（等級 1、2 是算出來的，不是檔案）
  async function fillSelfies(rootEl) {
    if (!rootEl) return;
    for (const img of rootEl.querySelectorAll('img[data-selfie]')) {
      if (img.getAttribute('src')) continue;
      const [id, lv] = img.dataset.selfie.split(':'); const mas = H.D.MASCOTS.find((x) => x.id === id); if (!mas) continue;
      try { const s = await selfieSource(mas, +lv); if (s instanceof root.HTMLCanvasElement) { const c = canvasOf(180, 240); c.getContext('2d').drawImage(s, 0, 0, 180, 240); img.src = c.toDataURL('image/jpeg', 0.8); } else img.src = s.src; } catch (e) { /* 缺圖就留白 */ }
    }
  }
  function albumHTML() {
    const tk = state(); const id = H.G().s.mascot; const T = TK();
    if (!tk.album.length) return '';
    return `<div class="td-album"><h4>照片牆 <small>每一代模型的第一張自拍</small></h4><div class="td-wall">${tk.album.map((a, i) => (a.lv === 0 ? `<figure class="tm-mini txt" style="--r:${(i % 2 ? 1 : -1) * (1 + i % 3)}deg"><pre>${esc(T.ASCII[id] || '')}</pre><figcaption>${esc(a.name)}</figcaption></figure>` : `<figure class="tm-mini" style="--r:${(i % 2 ? 1 : -1) * (1 + i % 3)}deg" data-zoom="1"><img data-selfie="${esc(id)}:${a.lv}" alt="${esc(a.name + '的自拍')}"><figcaption>${esc(a.name)}</figcaption></figure>`)).join('')}</div></div>`;
  }
  function endBookHTML() {
    const T = TK(); const tk = state();
    return `<p class="small muted" style="margin:0 0 10px">模型講給你聽過的故事結局。每個心智階段的故事都不一樣，同一個階段也有好幾條路。已收集 ${Object.keys(tk.ends).length} / ${T.ENDINGS.length}。</p>
      <div class="tm-book">${T.STAGES.map((S, i) => { const list = T.ENDINGS.filter((e) => e.st === i); return `<section><h4>Lv.${i} ${esc(S.name)}</h4><ul>${list.map((e) => (tk.ends[e.id] ? `<li class="on"><b>${esc(e.name)}</b><small>${esc(tk.ends[e.id])} 講的</small></li>` : '<li><b>？？？</b></li>')).join('')}</ul></section>`; }).join('')}</div>`;
  }
  function zoom(fig) {
    const src = fig.querySelector('canvas, img'); if (!src) return;
    const ov = el('div', 'tm-zoom'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', H.t('放大檢視'));
    let big; if (src.tagName === 'CANVAS') { big = canvasOf(src.width, src.height); big.getContext('2d').drawImage(src, 0, 0); } else { big = el('img'); big.src = src.src; big.alt = ''; }
    ov.appendChild(big); const cap = fig.querySelector('figcaption'); if (cap) ov.appendChild(el('p', '', cap.textContent));
    ov.addEventListener('click', () => ov.remove()); doc.body.appendChild(ov);
  }
  doc && doc.addEventListener('click', (e) => { const f = e.target.closest && e.target.closest('[data-zoom]'); if (f && !f.closest('.tm-zoom')) zoom(f); });

  /* ---------- 發布之後的上線測試 ---------- */
  let P = null;  // 目前開著的面板
  const REACT = { early: ['呃……這算通過嗎？', '我先記下來。', '老闆別看我，我也不知道。'], mid: ['這題答得不錯。', '它剛才是不是偷看了答案？', '我開始有點佩服了。'], late: ['……它答得比我好。', '這題我沒有教過它。', '老闆，你有看到嗎？'], final: ['……', '我不知道還能考它什麼了。', '它對我笑了一下。模型會笑嗎？'] };
  function ladderHTML(from) {
    const S = TK().STAGES; const f = from / S.length;
    return `<ol class="td-ladder" style="--f:${f.toFixed(3)}" aria-label="心智階段">${S.map((x, i) => `<li class="${i <= from ? 'on' : ''}${i === from ? ' now' : ''}" data-i="${i}"><i></i><span>${esc(x.name)}</span></li>`).join('')}<li class="agi"><i></i><span>AGI</span></li></ol>`;
  }
  function setLadder(ov, st) {
    const S = TK().STAGES; const ol = ov.querySelector('.td-ladder'); if (!ol) return;
    ol.style.setProperty("--f", (st / S.length).toFixed(3));
    ol.querySelectorAll('li[data-i]').forEach((li) => { const i = +li.dataset.i; li.classList.toggle('on', i <= st); li.classList.toggle('now', i === st); });
  }
  function helloOf(st, n) { const h = TK().HELLO[st]; return Array.isArray(h) ? h[n % h.length] : h; }
  function hostSay(text, hop) { if (P) setHost(P.ov.querySelector('.td-say'), text, hop); }
  function renderCards() {
    if (!P) return;
    const box = P.ov.querySelector('#td-cards'); const conv = P.conv; const m = P.m; const D = H.D; if (!box) return;
    const ch = conv.choices();
    clearTimeout(P.idle);
    if (conv.busy) { box.innerHTML = '<p class="td-wait">測試中……點一下對話可以快轉</p>'; return; }
    // 第 6 階段之後，你愣太久它會自己開口
    const st = TK().stageOf(H.G(), m);
    if (st >= 6 && !P.idled) P.idle = setTimeout(() => { if (!P || P.done || P.conv.busy) return; P.idled = true; const hr = new Date().getHours(); P.conv.say(hr >= 23 || hr < 5 ? '你那邊現在是 ' + hr + ' 點。\n測試可以明天再做，我不會跑掉。' : st >= 7 ? '你已經盯著這個畫面 14 秒了。\n我知道，因為我也在看你。' : '你還在想要考我什麼嗎？\n不急，我可以等。', null); }, 14000);
    if (ch.length) { box.innerHTML = `<div class="td-picks">${ch.map((c) => `<button class="td-pick${c.ghost ? ' ghost' : ''}" data-act="td-${c.act}" data-id="${esc(c.id)}">${esc(c.label)}</button>`).join('')}</div>`; return; }
    const items = conv.list().filter((x) => x.p.test && !P.used[x.p.id] && !x.lock); const lockSelf = conv.list().find((x) => x.p.id === 'selfie' && x.lock);
    const show = items.slice(0, 4); const anyDone = Object.keys(P.used).length > 0;
    box.innerHTML = `<div class="td-pool">${show.map(({ p }) => `<button class="td-card${p.story ? ' story' : ''}${p.id === 'selfie' ? ' selfie' : ''}" data-act="td-ask" data-id="${esc(p.id)}"><span class="k">${esc(D.STATS[p.k].name)} <b>${Math.round(m.stats[p.k] || 0)}</b></span><span class="q">${esc(fill(p.q, m))}</span></button>`).join('')}${lockSelf ? `<div class="td-card locked"><span class="k">多模態</span><span class="q">🔒 還不會自拍，要先研究${esc(lockSelf.lock)}</span></div>` : ''}</div>
      <div class="td-act">${conv.themed ? '<button class="btn" data-act="td-untheme">還原介面</button>' : ''}${show.length ? (anyDone ? '<span class="td-hint">還可以再考一題</span>' : '<span class="td-hint">挑一題考考它</span>') : '<span class="td-hint">都考完了</span>'}<button class="btn primary${show.length ? '' : ' lg'}" data-act="td-sum">${anyDone ? '看結果' : '直接看結果'}</button></div>`;
  }
  // 測試結束：階段升級的時刻
  function showSummary() {
    if (!P || P.done) return;
    const { ov, m, conv } = P; const G = H.G(); const T = TK(); const st = T.stageOf(G, m); const S = T.STAGES[st]; const tk = state(); const up = st > tk.best; const first = tk.best < 0;
    clearTimeout(P.idle); P.done = true; conv.reset(m); tk.best = Math.max(tk.best, st);
    const comp = G.composite(m.stats); const bonus = T.ARCH_BONUS[m.arch] || 0; const power = comp + bonus; const next = T.STAGES[st + 1]; const a = G.agiStatus();
    const hint = st >= T.STAGES.length - 1 ? '' : !G.has('t_imagegen') && st >= 2 ? '研究「影像生成」之後，它就會開始發自拍了。' : m.arch === 'dense' ? '換成進化過的架構也會提升階段：MoE +2、MoE + MLA +4、混合注意力 +5、稀疏注意力 +6。' : '';
    const con = ov.querySelector('.td-console');
    con.innerHTML = `<div class="td-sum${up && !first ? ' up' : ''}">
      <div class="td-sum-h"><span class="td-cap">${esc(S.en)} · LV.${st}</span>${up && !first ? '<em>階段提升！</em>' : ''}<h3>${esc(S.name)}</h3><p>${esc(S.say)}</p></div>
      ${up ? `<div class="td-unlock"><b>解鎖</b><span>${esc(S.unlock)}</span></div>` : ''}
      <div class="td-gauge"><div class="td-bar"><i style="--w:${Math.min(100, power / T.STAGES[7].at * 100).toFixed(1)}%"></i></div>
        <p>心智 <b>${power.toFixed(1)}</b> ＝ 綜合 ${comp.toFixed(1)} ＋ 架構 ${bonus}${next ? `　·　到 ${next.at} 進入「${esc(next.name)}」` : ''}　·　AGI 門檻：綜合 ${a.comp.toFixed(1)} / 100、最弱核心 ${Math.round(a.minCore)} / 92</p>${hint ? `<p class="td-tip">${esc(hint)}</p>` : ''}</div>
      ${growthHTML(m)}
      ${albumHTML()}
      <div class="td-act td-sum-foot"><button class="btn" data-act="td-chat">帶它去大廳聊聊</button><button class="btn primary" data-act="td-close">回去工作</button></div></div>`;
    fillSelfies(con);
    const go = () => { if (P) setLadder(ov, st); };
    if (reduce()) go(); else setTimeout(go, 200);
    hostSay(up && !first ? T.hostLine(H.mascot().id, st) : REACT[st >= 7 ? 'final' : st >= 5 ? 'late' : st >= 3 ? 'mid' : 'early'][1], true);
    if (up) { H.sfx(st >= 7 ? 'dawn' : 'fanfare'); if (!first) H.confetti(ov); }
    const btn = con.querySelector('[data-act="td-close"]'); if (btn) btn.focus({ preventScroll: true });
  }
  // 每一代模型的心智連成一條線，往上看得到 AGI 那條虛線
  function growthHTML(m) {
    const G = H.G(); const T = TK(); const ms = G.s.models.filter((x) => x.rel || x === m); if (ms.length < 2) return '';
    const W = 560; const HH = 104; const top = T.STAGES[7].at; const floor = 30;
    const y = (p) => (HH - 10 - Math.min(1.06, Math.max(0, (p - floor) / (top - floor))) * (HH - 26)).toFixed(1);
    const x = (i) => (14 + i / (ms.length - 1) * (W - 62)).toFixed(1);
    const pts = ms.map((a, i) => x(i) + ',' + y(T.powerOf(G, a))).join(' ');
    return `<figure class="td-growth"><figcaption>每一代的心智，離門還有多遠</figcaption><svg viewBox="0 0 ${W} ${HH}" role="img" aria-label="${esc(H.t('每一代模型的心智分數'))}">
      <line class="gate" x1="0" x2="${W}" y1="${y(top)}" y2="${y(top)}"/><text class="gate-t" x="${W}" y="${Number(y(top)) - 4}" text-anchor="end">AGI</text>
      <polyline pathLength="1" points="${pts}"/>${ms.map((a, i) => `<circle cx="${x(i)}" cy="${y(T.powerOf(G, a))}" r="${a === m ? 6 : 3.2}" class="${a === m ? 'me' : ''}"><title>${esc(a.name)} ${T.powerOf(G, a).toFixed(1)}</title></circle>`).join('')}
    </svg></figure>`;
  }
  async function bootLog(conv, m, t) {
    const G = H.G(); const T = TK(); const st = T.stageOf(G, m); const ms = G.s.models; const idx = ms.indexOf(m);
    const prev = ms.slice(0, idx).reverse().find((x) => x.rel);
    const boot = el('div', 'td-boot'); conv.log.appendChild(boot);
    const lines = ['載入權重  ' + H.ME.ARCH[m.arch].name, '綜合 ' + G.composite(m.stats).toFixed(1) + '　·　第 ' + (idx + 1) + ' 代', '喚醒中……'];
    for (const l of lines) { const n = el('div', '', '> ' + l); boot.appendChild(n); conv.scroll(); await sleep(reduce() ? 0 : 240); if (conv.dead(t)) return; }
    if (prev) { const pst = T.stageOf(G, prev); const same = pst === st; const text = fill(helloOf(pst, ms.indexOf(prev) + 1), prev).split('\n')[0]; if (!same) { const old = el('div', 'td-old'); old.appendChild(el('b', '', '上一代 ' + prev.name)); old.appendChild(el('span', '', text)); conv.log.appendChild(old); conv.scroll(); await sleep(reduce() ? 0 : 600); if (conv.dead(t)) return; } }
    const b = conv.bubble(); const tx = el('div', 'tm-text'); b.appendChild(tx); await conv.type(tx, fill(helloOf(st, idx + 1), m), t);
  }
  function open(m, opts) {
    close(true);
    const G = H.G(); const T = TK(); const st = T.stageOf(G, m); const mas = H.mascot(); const tk = state(); const older = G.s.models.filter((x) => x.rel && x !== m).map((x) => T.stageOf(G, x)); const from = Math.min(st, tk.best >= 0 ? tk.best : older.length ? Math.max(...older) : 0);
    const ov = el('div', 'td td-skin'); ov.id = 'trial'; ov.dataset.s = st; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', m.name + ' 上線測試');
    ov.innerHTML = `<div class="td-glow" aria-hidden="true"></div><i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
      <div class="td-wrap">
        <header class="td-top"><div class="td-id"><span class="td-cap">TEST DRIVE · 上線測試</span><h2>${esc(m.name)}</h2></div>${ladderHTML(from)}<button class="btn ghost sm td-skip" data-act="td-skip">跳過</button></header>
        <div class="td-body">
          <aside class="td-host"><img class="td-char" src="${esc(mas.img)}" alt="${esc(mas.name)}"><div class="td-say"></div></aside>
          <section class="td-console"><div class="td-log" id="td-log" aria-live="polite"></div><div class="td-cards" id="td-cards"></div></section>
        </div>
      </div>`;
    doc.body.appendChild(ov);
    const log = ov.querySelector('#td-log');
    const conv = new Conv({ log, m, host: ov, hostEl: ov.querySelector('.td-say'), onChange: () => renderCards() });
    P = { ov, m, conv, used: {}, done: false, opts: opts || {} };
    hostSay(T.hostLine(mas.id, st), false);
    conv.busy = true; renderCards();
    const t = ++conv.token;
    bootLog(conv, m, t).catch((e) => console.warn(e)).then(() => { if (P && P.conv === conv && !conv.dead(t)) { conv.busy = false; renderCards(); const c = ov.querySelector('.td-card'); if (c) c.focus({ preventScroll: true }); } });
  }
  function close(silent) {
    if (!P) return;
    const p = P; P = null; clearTimeout(p.idle); p.conv.token++; if (p.conv.game) p.conv.game.stop();
    p.ov.id = ''; p.ov.classList.add('out'); setTimeout(() => p.ov.remove(), silent ? 0 : 260);
    if (!silent && p.opts.onClose) p.opts.onClose(p.chat || null);
  }
  // ui.js 把 data-act="td-…" 轉到這裡
  function act(name, ds) {
    if (!P) return;
    const c = P.conv;
    switch (name) {
      case 'td-ask': if (!c.busy) { P.used[ds.id] = 1; c.act('ask', ds); } break;
      case 'td-pick': c.act('pick', ds); break;
      case 'td-leave': c.act('leave', ds); break;
      case 'td-mod': c.act('mod', ds); break;
      case 'td-moddone': c.act('moddone', ds); break;
      case 'td-untheme': c.act('untheme', ds); break;
      case 'td-sum': case 'td-skip': if (P.done) close(); else showSummary(); break;
      case 'td-close': close(); break;
      case 'td-chat': P.chat = P.m.id; close(); break;
      default: break;
    }
  }
  const isOpen = () => !!P;
  // Esc：第一次跳到結果，第二次關閉
  function escape() { if (!P) return false; const mo = doc.querySelector('.tm-moment'); if (mo) { mo.click(); return true; } if (P.done) close(); else showSummary(); return true; }

  root.ME_TRIAL = { init, Conv, open, close, act, isOpen, escape, fillSelfies, endBookHTML, setHost };
})(typeof window !== 'undefined' ? window : globalThis);

/* 《模型帝國》遊戲引擎：純邏輯，無 DOM 依賴，可在瀏覽器與 Node 執行 */
(function (root) {
  'use strict';
  const D = root.ME_DATA;
  const B = D.BAL;
  const A = D.AGI;
  const DAY = 86400000;
  const START = Date.parse(D.START_DATE + 'T00:00:00Z');
  const END = Date.parse(D.END_DATE + 'T00:00:00Z');
  const TOTAL_WEEKS = Math.floor((END - START) / (7 * DAY));
  const MAX_WEEKS = Math.floor((Date.parse(D.FINAL_DATE + 'T00:00:00Z') - START) / (7 * DAY)); // 延長賽最晚到這週

  /* ================= 工具 ================= */
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function weekDate(w) { return new Date(START + w * 7 * DAY); }
  function ymOf(w) { const d = weekDate(w); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1); }
  function ymdOf(w) { const d = weekDate(w); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
  function yearsSince(w, ym) { return (START + w * 7 * DAY - Date.parse((ym.length === 7 ? ym + '-01' : ym) + 'T00:00:00Z')) / (365.25 * DAY); }
  function years(w) { return (w * 7) / 365.25; }
  function dateLabel(w) { const d = weekDate(w); const wk = Math.floor((d.getUTCDate() - 1) / 7) + 1; return d.getUTCFullYear() + '年' + (d.getUTCMonth() + 1) + '月 第' + wk + '週'; }
  function fmtMoney(x, digits) {
    if (x == null || isNaN(x)) return '$0';
    const neg = x < 0; let a = Math.abs(x); let s;
    const dg = digits == null ? 1 : digits;
    // 門檻略低於 1 億、1 兆：四捨五入後會進位的金額直接用下一個單位（不會出現 $10000萬）。
    // 只有帶小數時才去尾 0，整數不能去（$100億 不是 $1億）
    if (a >= 9.9995e11) s = (a / 1e12).toFixed(2).replace(/\.?0+$/, '') + '兆';
    else if (a >= 99995000) s = (a >= 1e10 ? (a / 1e8).toFixed(0) : (a / 1e8).toFixed(2).replace(/\.?0+$/, '')) + '億';
    else if (a >= 1e4) s = (a / 1e4).toFixed(a >= 1e6 ? 0 : dg).replace(/\.0+$/, '') + '萬';
    else s = Math.round(a).toLocaleString('en-US');
    return (neg ? '-$' : '$') + s;
  }
  function fmtNum(x) {
    const a = Math.abs(x);
    if (a >= 1e8) return (x / 1e8).toFixed(2).replace(/\.?0+$/, '') + '億';
    if (a >= 1e4) return (x / 1e4).toFixed(1).replace(/\.0$/, '') + '萬';
    return Math.round(x).toLocaleString('en-US');
  }
  function fmtTokens(b) { // b = B tokens
    if (b >= 1000) return (b / 1000).toFixed(b >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'T';
    return Math.round(b) + 'B';
  }
  function fmtParams(b) {
    if (b >= 1000) return (b / 1000).toFixed(1).replace(/\.0$/, '') + 'T';
    return (b < 10 ? b.toFixed(b % 1 ? 1 : 0) : Math.round(b)) + 'B';
  }
  // 公司裡已有幾個人用這個名（東亞寫法是姓在前、名在後；其他是「名·姓」）
  function givenCount(people, given, sg) {
    let n = 0;
    for (const p of people) {
      const nm = p.name;
      if (sg ? nm.indexOf('·') < 0 && nm.length > given.length && nm.length - given.length <= 3 && nm.slice(-given.length) === given : nm.indexOf(given + '·') === 0) n++;
    }
    return n;
  }
  // 日誌裡列出離職、被裁的人名（三人以內）
  function peopleNames(list) { return list.length && list.length <= 3 ? '（' + list.map((p) => p.name).join('、') + '）' : ''; }
  // 員工技能分級（給介面顯示職級用）
  function skillTier(x) { return x >= 82 ? '大神' : x >= 70 ? '專家' : x >= 55 ? '資深' : x >= 40 ? '一般' : '見習'; }
  // 史料內文取第一句當日誌摘要；太長時在括號外的逗號、冒號處截斷，不切在引號或括號中間
  const H_PAIR = { '「': '」', '（': '）', '『': '』', '《': '》' };
  function histBrief(t) {
    t = String(t || ''); const st = []; let end = t.length;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (H_PAIR[ch]) st.push(ch);
      else if (st.length && ch === H_PAIR[st[st.length - 1]]) st.pop();
      else if (!st.length && (ch === '。' || ch === '；')) { end = i; break; }
    }
    const b = t.slice(0, end); if (b.length <= 56) return b;
    let cut = -1, open = -1; st.length = 0;
    for (let i = 0; i < 56; i++) {
      const ch = b[i];
      if (H_PAIR[ch]) { if (!st.length) open = i; st.push(ch); }
      else if (st.length && ch === H_PAIR[st[st.length - 1]]) st.pop();
      else if (!st.length && (ch === '，' || ch === '：')) cut = i;
    }
    if (st.length && open > Math.max(cut, 18)) return b.slice(0, open) + '…';
    if (cut > 18) return b.slice(0, cut) + '…';
    return b.slice(0, 56) + '…' + st.map((c) => H_PAIR[c]).reverse().join('');
  }

  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return { v: ((t ^ (t >>> 14)) >>> 0) / 4294967296, s: a };
    };
  }

  const TECH = {}; D.TECHS.forEach((t) => (TECH[t.id] = t));
  const GPU = {}; D.GPUS.forEach((g) => (GPU[g.id] = g));
  const ARCH = {}; D.ARCHS.forEach((a) => (ARCH[a.id] = a));
  const RIVAL = {}; D.RIVALS.forEach((r) => (RIVAL[r.id] = r));
  const SCEN = {}; D.SCENARIOS.forEach((s) => (SCEN[s.id] = s));
  const CITY = {}; (D.CITIES || []).forEach((c) => (CITY[c.id] = c));
  const NO_CITY = { id: '', name: '總部', en: '', icon: '🏢', regions: [], desc: '', mods: {} }; // 舊存檔沒有城市

  // 城市加成的說明（給標題畫面與 HUD 用）；good 表示對玩家有利
  const CITY_LABEL = { valuation: ['估值', 1], hireQuality: ['招募品質', 1], salary: ['薪資', -1], rpMul: ['研究速度', 1], gpuPrice: ['購卡價', -1],
    rentPrice: ['雲端租價', -1], demand_ent: ['企業需求', 1], demand_creative: ['創作需求', 1] };
  function cityPerks(c) {
    if (!c || !c.id) return [];
    const out = [];
    for (const k in c.mods || {}) {
      const L = CITY_LABEL[k] || [k, 1]; const m = c.mods[k];
      out.push({ t: L[0] + ' ' + (m > 1 ? '+' : '-') + Math.round(Math.abs(m - 1) * 100) + '%', good: (m > 1) === (L[1] > 0) });
    }
    if (c.start && c.start.community) out.push({ t: '開局社群 +' + c.start.community, good: true });
    if (c.effTech) out.push({ t: '效率類科技研究成本 -' + Math.round((1 - c.effTech) * 100) + '%', good: true });
    if (c.exportEdition) out.push({ t: '可買出口版晶片', good: true });
    if (c.regDecay && c.regDecay < 1) out.push({ t: '監管壓力消退較慢', good: false });
    if (c.controlled) out.push({ t: '出口管制生效後：高階 GPU 購卡價 ×1.6、境外雲租價 ×1.3', good: false });
    return out;
  }

  const MIX_W = {
    know: { web: 0.5, code: 0.1, sci: 0.4, mm: 0 },
    lang: { web: 0.85, code: 0, sci: 0.15, mm: 0 },
    code: { web: 0.1, code: 0.8, sci: 0.1, mm: 0 },
    reason: { web: 0.1, code: 0.3, sci: 0.6, mm: 0 },
  };
  const REF_MIX = { web: 0.6, code: 0.2, sci: 0.2, mm: 0 };

  // 使用量換算（lastWeek.usage、model.use）：市佔 × 市場規模 ÷ 參考價 = 每週需求量，再乘 mul 換成看板單位。
  // 月費制換成「正在用的人數」（× 4.33 週）；對話 App 另含免費用戶（付費 1：免費 8，跟 chatUsers 相同）；per 表示每週的流量
  const USAGE = {
    chat: { mul: 4.33 * 9, unit: '活躍用戶' },
    api: { mul: 1e6, unit: 'token', per: '週' },
    ent: { mul: 4.33, unit: '企業席位' },
    coding: { mul: 4.33, unit: '開發者' },
    creative: { mul: 4.33, unit: '創作者' },
    agent: { mul: 1, unit: '次任務', per: '週' },
    robot: { mul: 4.33, unit: '台機器人' },
  };

  // 首月評級：實力看發布時跟前沿的分差，營收看首月平均週營收 ÷ 這個模型能賣的市場總規模，各 0～4 分；
  // 合計 8 分 S、6 分以上 A、3 分以上 B，其餘 C。開局兩年內門檻放寬（新公司剛起步）：分差最多 +6、營收佔比最多 ×3，隨時間遞減
  const GRADE = { gap: [-8, -3, 0, 3], rev: [0.02, 0.05, 0.12, 0.25], S: 8, A: 6, B: 3, earlyGap: 6, earlyRev: 2 };

  // 新手任務的完成條件；標題、說明與獎勵在 content.js 的 ME_QUESTS
  const QUEST_CHECK = {
    q_train: (g) => g.s.models.length > 0 || g.s.jobs.some((j) => j.kind === 'train'),
    q_tech: (g) => Object.keys(g.s.techs).length > (g.scen() || D.SCENARIOS[0]).techs.length || (g.s.research || []).length > 0,
    q_hire: (g) => (g.s.stat.hired || 0) > 0 || g.s.stars.length > 0,
    q_gpu: (g) => (g.s.stat.bought || 0) > 0,
    q_done: (g) => g.s.models.length > 0,
    q_release: (g) => g.s.models.some((m) => m.rel),
    q_raise: (g) => g.s.roundIdx > 0 || g.s.ipo || g.s.raised > 0,
  };

  // 編年史：達成這些成就時順便記一筆（舊存檔也用這張表補回來）。[分類, 文字, 重要度 1～10]
  const CHRON_ACH = {
    top3: ['rank', '第一次擠進排行榜前三', 6], rank1: ['rank', '第一次登上排行榜第一', 10],
    unicorn: ['money', '估值突破 $10億', 5], decacorn: ['money', '估值突破 $100億', 5], trillion_val: ['money', '估值突破 $1兆', 8],
    rev1m: ['money', '週營收突破 $100萬', 4], rev100m: ['money', '週營收突破 $1億', 6],
    gpu10k: ['tech', '自有算力達到 1 萬張 H100 等效', 4], gpu100k: ['tech', '自有算力達到 10 萬張 H100 等效', 6],
    staff100: ['people', '員工達到 100 人', 4], moe: ['model', '第一個 MoE 模型訓練完成', 4], trillion: ['model', '訓練出兆級參數的模型', 4],
    reasoner: ['model', '模型推理能力突破 80', 4], agent: ['model', '模型 Agent 能力突破 70', 4], survivor: ['crisis', '挺過資金危機，現金重新轉正', 8],
  };
  // 成就表沒有的里程碑：[門檻, 文字, 重要度]
  const CHRON_MILE = {
    staff: [[10, '員工達到 10 人', 3], [1000, '員工達到 1,000 人', 4]],
    gpu: [[1000, '自有算力達到 1,000 張 H100 等效', 3], [1e6, '自有算力達到 100 萬張 H100 等效', 5], [1e7, '自有算力達到 1,000 萬張 H100 等效', 5]],
    rev: [[1e7, '週營收突破 $1,000萬', 4], [1e9, '週營收突破 $10億', 6]],
    val: [[1e11, '估值突破 $1,000億', 6]],
  };

  /* ================= Game ================= */
  class Game {
    constructor(state) {
      this.s = state; this._content();
      // 舊存檔沒有新聞流進度：從目前日期之後才開始播，避免一次灌進日誌
      if (this.s.histIdx == null) this.s.histIdx = this.histStart();
      this.ensurePeople(); // 舊存檔沒有個別員工：依各職能人數與平均技能補產生
      this.dedupeNames();  // 舊版名字池較小，可能有同名的人
      if (!Array.isArray(this.s.reactQ)) this.s.reactQ = [];
      if (this.s.frng == null) this.s.frng = (this.s.seed ^ 0x2545f491) >>> 0;
      if (!this.s.quest) this.initQuests(); // 舊存檔：已經做到的新手任務直接算完成，不補發獎勵
      if (!Array.isArray(this.s.chron)) this.initChron(); // 舊存檔：從成就紀錄補回關鍵時刻
      if (!Array.isArray(this.s.research)) this.s.research = [];
      if (this.s.race === undefined) this.s.race = null;
      // 舊存檔已經結束的局：補上總分分項
      const e0 = this.s.ended;
      if (e0 && !e0.parts) {
        const E0 = D.ENDINGS[e0.type] || {}; const net = Math.round(100 * Math.log10(Math.max(1, (e0.net || 0) / 1e6))); const model = Math.round(4 * (e0.bc || 0)); const ach = 15 * Object.keys(this.s.ach).length; const bonus = E0.bonus || 0;
        e0.parts = { net, model, ach, bonus, time: Math.max(0, (e0.score || 0) - net - model - ach - bonus) };
      }
    }

    _content() {
      this.EVENTS = root.ME_EVENTS || [];
      this.NEWS = (root.ME_NEWS || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
      this.STARS = root.ME_STARS || [];
      this.CHAT = root.ME_CHAT || [];
      this.EVT = {}; this.EVENTS.forEach((e) => (this.EVT[e.id] = e));
      this.STAR = {}; this.STARS.forEach((e) => (this.STAR[e.id] = e));
      // 真實 AI 史新聞流：只播遊戲期間（2023 起）且已查證的條目
      const H = root.ME_HISTORY;
      this.HIST = ((H && H.items) || []).filter((it) => String(it.date) >= '2023-01' && it.confidence === 'verified')
        .sort((a, b) => (String(a.date) < String(b.date) ? -1 : String(a.date) > String(b.date) ? 1 : 0));
    }

    static create(opts) {
      const sc = SCEN[opts.scenario] || D.SCENARIOS[0];
      const seed = (opts.seed != null ? opts.seed : Math.floor(Math.random() * 2 ** 31)) >>> 0;
      const s = {
        v: D.VERSION, seed, rng: seed, week: 0,
        scenario: sc.id, company: opts.company || D.DEFAULT_COMPANY || '鯨躍實驗室', mascot: opts.mascot || 'whale', series: opts.series || 'Whale',
        city: CITY[opts.city] ? opts.city : '',
        cash: sc.cash, equity: sc.equity, raised: 0, roundIdx: 0, lastRound: -999, ipo: false, valuation: sc.cash * 2,
        rep: sc.rep, reg: 0, community: 0, morale: 70,
        rp: 40, rpTotal: 0,
        staff: {}, payPolicy: 1.0, crunch: false, trainProg: false,
        stars: [], starPool: [], starGone: {},
        office: sc.office, officeBuild: null,
        gpus: sc.gpus.map((g) => ({ type: g.type, n: g.n, w: 0 })), dc: sc.dc, dcBuild: null,
        autoRent: true, marketing: 0,
        data: {
          web: { amt: 1200, q: 0.5 }, code: { amt: 160, q: 0.66 }, sci: { amt: 70, q: 0.85 }, mm: { amt: 0, q: 0.6 },
          inst: 15, risk: 0.03,
        },
        crawl: true, crawlAggr: false, userData: false, dealsBought: {},
        techs: {}, techPublic: {}, research: [],
        jobs: [], models: [], nextId: 1,
        rivals: {}, market: {}, demandMul: {},
        mods: [], flags: {}, embargo: false, embargoScenario: !!sc.embargo,
        log: [], pending: [], newsIdx: 0, cooldown: {}, fired: {}, chain: [],
        ach: {}, hist: [], lastWeek: null, revHist: [], rfps: [], rfpDone: 0, archExp: {},
        stat: { negWeeks: 0, wasNeg: false, pioneers: 0, trained: 0, released: 0, opened: 0, incidents: 0, maxGpu: 0, hired: 0, bought: 0 },
        reactQ: [], frng: (seed ^ 0x2545f491) >>> 0, quest: { done: {} }, chron: [],
        race: null, ended: null, tutorial: 0, paused: false,
      };
      D.ROLE_ORDER.forEach((r) => (s.staff[r] = { n: sc.staff[r] || 0, skill: sc.skill }));
      sc.techs.forEach((t) => (s.techs[t] = { w: 0, pioneer: false }));
      if (sc.mods) Object.keys(sc.mods).forEach((k) => s.mods.push({ key: k, mul: sc.mods[k], until: 99999 }));
      const ct = CITY[s.city];
      if (ct) {
        Object.keys(ct.mods || {}).forEach((k) => s.mods.push({ key: k, mul: ct.mods[k], until: 99999 }));
        if (ct.start && ct.start.community) s.community = clamp(s.community + ct.start.community, 0, 100);
      }
      D.RIVALS.forEach((r) => {
        s.rivals[r.id] = { next: Math.max(0, Math.round(yearsSince(0, r.start) * -52.18)), ver: 0, models: [], priceMul: r.price, boost: 0, cash: 1 };
      });
      D.SEG_ORDER.forEach((k) => { s.market[k] = { shares: {} }; s.demandMul[k] = 1; });
      const g = new Game(s);
      g.log('🎉 ' + s.company + ' 成立了！吉祥物 ' + g.mascot().icon + g.mascot().name + ' 向你揮手。目標：打造最強的大模型，搶在對手之前安全抵達 AGI。', 'good');
      g.refreshStarPool(true);
      g.processNews();
      g.processHistory();
      g.updateRivals(true);
      g.computeMarket(true);
      g.updateValuation();
      g.snapshot();
      return g;
    }

    /* ---------- 隨機 ---------- */
    rand() { const r = mulberry(this.s.rng)(); this.s.rng = r.s; return r.v; }
    randn() { let u = 0, v = 0; while (u === 0) u = this.rand(); v = this.rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    pick(arr) { return arr[Math.floor(this.rand() * arr.length)]; }
    weighted(items, wf) {
      const ws = items.map(wf); const t = sum(ws); if (t <= 0) return null;
      let r = this.rand() * t; for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
      return items[items.length - 1];
    }
    // 評論、評語等裝飾文字用第三條亂數 s.frng，不會改變遊戲數值用的亂數序列
    frand() { const r = mulberry(this.s.frng)(); this.s.frng = r.s; return r.v; }

    /* ---------- 基本查詢 ---------- */
    // 這一局最晚到哪一週：正規賽是 2030 年底，延長賽是 2035 年底
    endWeek() { return this.s.race && this.s.race.extra ? MAX_WEEKS : TOTAL_WEEKS; }
    get ym() { return ymOf(this.s.week); }
    get ymd() { return ymdOf(this.s.week); }
    get yrs() { return years(this.s.week); }
    dateLabel(w) { return dateLabel(w == null ? this.s.week : w); }
    mascot() { return D.MASCOTS.find((m) => m.id === this.s.mascot) || D.MASCOTS[0]; }
    city() { return CITY[this.s.city] || NO_CITY; }
    cityPerks() { return cityPerks(this.city()); }
    scen() { return SCEN[this.s.scenario]; }
    has(t) { return !!this.s.techs[t]; }
    mod(key) { let m = 1; for (const x of this.s.mods) if (x.key === key && x.until > this.s.week) m *= x.mul; return m; }
    addMod(key, mul, weeks) { this.s.mods.push({ key, mul, until: this.s.week + Math.max(1, weeks || 26) }); }
    log(text, type, extra) {
      const e = { w: this.s.week, t: text, k: type || 'info' }; if (extra) Object.assign(e, extra);
      this.s.log.unshift(e); if (this.s.log.length > 160) this.s.log.length = 160;
    }
    fill(str, starName, rivalId, modelName) {
      const s = this.s; const m = this.latestModel();
      const star = starName || (s.stars.length ? this.pick(s.stars).name : '某位同事');
      const rv = (rivalId && RIVAL[rivalId]) || this.pick(D.RIVALS.filter((r) => r.start <= this.ym));
      const V = { company: s.company, model: modelName || (m ? m.name : (s.series + '-1')), rival: rv ? rv.name : '天穹智能', star, mascot: this.mascot().name, city: this.city().name };
      // 代入中文名稱時，拿掉佔位符和中文之間的半形空白（「用 {rival} 的模型」→「用天穹智能的模型」）；
      // 英文名稱（例如模型 Whale-3）保留空白：「用 Whale-3 的模型」
      const CJK = '\u3000-\u303f\u3400-\u9fff\uff00-\uffef'; const cjk = new RegExp('[' + CJK + ']');
      str = String(str);
      for (const k in V) {
        const v = String(V[k]);
        if (cjk.test(v[0] || '')) str = str.replace(new RegExp('([' + CJK + '])[ ]+[{]' + k + '[}]', 'g'), '$1{' + k + '}');
        if (cjk.test(v[v.length - 1] || '')) str = str.replace(new RegExp('[{]' + k + '[}][ ]+([' + CJK + '])', 'g'), '{' + k + '}$1');
      }
      return str.replace(/\{(company|model|rival|star|mascot|city)\}/g, (x, k) => V[k]);
    }
    // 裝飾文字的代換：明星與對手都先指定好，fill 就不會去抽遊戲數值用的亂數（文字裡不能用 {star}）
    flavor(str, m, rid) { return this.fill(str, '某位同事', rid || this.frontRival(), m ? m.name : null); }
    // 編年史（給結局畫面）：k 是 model／rank／money／crisis／people／tech／race，p 是重要度 1～10。模型發布不記，介面從 s.models 算
    chron(k, t, p) {
      const c = this.s.chron; c.push({ w: this.s.week, k, t, p: p || 4 });
      if (c.length > 80) { let i = 0; for (let j = 1; j < c.length; j++) if ((c[j].p || 4) < (c[i].p || 4)) i = j; c.splice(i, 1); } // 超過上限時丟掉最不重要的裡面最舊的一筆
    }
    initChron() {
      const s = this.s; s.chron = []; s.chronM = {};
      for (const id in CHRON_ACH) if (s.ach[id] != null) s.chron.push({ w: s.ach[id], k: CHRON_ACH[id][0], t: CHRON_ACH[id][1], p: CHRON_ACH[id][2] });
      if (s.ach.ipo != null) s.chron.push({ w: s.ach.ipo, k: 'money', t: '上市敲鐘', p: 9 });
      s.chron.sort((a, b) => a.w - b.w);
      s.chronTop = this.bestRank() === 1;
    }
    // 里程碑與排行榜第一的得失
    chronWeek() {
      const s = this.s; const M = s.chronM || (s.chronM = {});
      const vals = { staff: this.totalStaff(), gpu: this.ownedEq(), rev: this.avgRevenue(), val: s.valuation };
      for (const key in CHRON_MILE) for (const x of CHRON_MILE[key]) { const id = key + x[0]; if (!M[id] && vals[key] >= x[0]) { M[id] = 1; this.chron(key === 'staff' ? 'people' : key === 'gpu' ? 'tech' : 'money', x[1], x[2]); } }
      const top = this.bestRank() === 1;
      if (top !== !!s.chronTop) {
        s.chronTop = top;
        const lb = this.leaderboard();
        if (s.chronRankW == null || s.week - s.chronRankW >= 12) { // 短時間內來回換位只記一次
          if (top && s.ach.rank1 != null && s.ach.rank1 < s.week) { this.chron('rank', '重回排行榜第一', 7); s.chronRankW = s.week; }
          else if (!top && lb[0]) { this.chron('rank', this.flavor('被 {rival} 的 ' + lb[0].name + ' 超車，丟掉排行榜第一', null, lb[0].rival), 8); s.chronRankW = s.week; }
        }
      }
    }
    latestModel() { const r = this.s.models.filter((m) => m.rel); return r.length ? r[r.length - 1] : (this.s.models[this.s.models.length - 1] || null); }
    totalStaff() { return sum(D.ROLE_ORDER.map((r) => this.s.staff[r].n)) + this.s.stars.length; }
    roleHeads(r) { return this.s.staff[r].n + this.s.stars.filter((x) => x.role === r).length; }
    officeCap() { return D.OFFICES[this.s.office].cap; }
    salaryMul() { return Math.pow(1 + B.SALARY_INFL, this.yrs) * this.mod('salary'); }
    starBonus(trait) { let v = 0; for (const x of this.s.stars) if (x.trait === trait) v += this.starPower(x); return v; }
    starPower(x) { return 0.6 + (x.skill - 70) / 50; } // 0.6 ~ 1.18

    /* ---------- 算力 ---------- */
    gpuAvail(id) {
      const g = GPU[id]; const ym = this.ym;
      if (ym < g.from || ym >= g.until) return false;
      if (g.special && !this.s.embargoScenario && !this.city().exportEdition) return false;
      if (this.s.embargo && g.hi) return false;
      return true;
    }
    gpuPrice(id) {
      const g = GPU[id]; const age = Math.max(0, yearsSince(this.s.week, g.from));
      let p = g.price * Math.max(0.3, Math.pow(B.GPU_PRICE_DECAY, age)) * this.mod('gpuPrice') * this.techProd('gpuMul');
      if (this.s.embargo && g.maker === 'cn') p *= 1.6; // 禁運下替代卡供不應求
      if (this.s.flags.cityControl && g.hi) p *= 1.6; // 總部城市受出口管制：高階卡要多付
      return p;
    }
    dcSlots() { return D.DATACENTERS[this.s.dc].slots; }
    cardCount() { return sum(this.s.gpus.map((g) => g.n)); }
    ownedEq() {
      // 依效能高到低裝進機房，超出槽位的卡閒置
      const sorted = this.s.gpus.slice().sort((a, b) => GPU[b.type].pf - GPU[a.type].pf);
      let slots = this.dcSlots(); let eq = 0;
      for (const g of sorted) { const n = Math.min(g.n, slots); eq += n * GPU[g.type].pf; slots -= n; if (slots <= 0) break; }
      return eq;
    }
    rentPrice() { return B.RENT0 * Math.pow(B.RENT_DECAY, this.yrs) * this.mod('rentPrice') * this.techProd('rentMul') * (this.s.embargo ? 2.2 : this.s.flags.cityControl ? 1.3 : 1); }
    rentCap() { return B.RENT_CAP0 * Math.pow(B.RENT_CAP_GROW, this.yrs) * this.techProd('rentCap') * (this.s.embargo ? 0.35 : 1); }
    engNeeded() { return 2 + Math.sqrt(this.ownedEq() + (this.s.lastWeek ? this.s.lastWeek.rentEq : 0)) / 4; }
    engCoverage() { return clamp(this.roleHeads('eng') / this.engNeeded(), 0, 1.2); }
    prodMul() { return (0.75 + 0.5 * this.s.morale / 100) * (this.s.crunch ? 1.22 : 1); }
    mfu() {
      let m = B.BASE_MFU * (0.72 + 0.36 * Math.min(1, this.engCoverage())) * Math.pow(this.s.staff.eng.skill / 55, 0.35);
      for (const id in this.s.techs) { const e = TECH[id] && TECH[id].eff; if (e && e.mfu) m *= e.mfu; }
      m *= 1 + 0.08 * this.starBonus('infra');
      return clamp(m, 0.15, B.MAX_MFU);
    }
    algoMult() {
      let m = Math.pow(1.05, this.s.futureLv || 0);
      for (const id in this.s.techs) { const e = TECH[id] && TECH[id].eff; if (e && e.algo) m *= e.algo; }
      return m * (1 + 0.1 * this.starBonus('scaling'));
    }
    talentMult() {
      const st = this.s.staff.res;
      const heads = this.roleHeads('res');
      return clamp(0.82 + (st.skill - 50) / 110 + 0.03 * Math.log(1 + heads), 0.7, 1.35);
    }
    // 科技效果的加總與連乘：每週要算很多次，算過就記著，科技變動時清掉（techChanged）
    techSum(key) { const c = this._tsum || (this._tsum = {}); if (c[key] != null) return c[key]; let v = 0; for (const id in this.s.techs) { const e = TECH[id] && TECH[id].eff; if (e && typeof e[key] === 'number') v += e[key]; } return (c[key] = v); }
    techProd(key) { const c = this._tprod || (this._tprod = {}); if (c[key] != null) return c[key]; let v = 1; for (const id in this.s.techs) { const e = TECH[id] && TECH[id].eff; if (e && typeof e[key] === 'number') v *= e[key]; } return (c[key] = v); }
    techSeg(k) { const c = this._tseg || (this._tseg = {}); if (c[k] != null) return c[k]; let v = 0; for (const id in this.s.techs) { const e = TECH[id] && TECH[id].eff; if (e && e.segU && e.segU[k]) v += e.segU[k]; } return (c[k] = v); }
    techChanged() { this._tsum = null; this._tprod = null; this._tseg = null; }
    maxSize() { return this.has('t_3d') ? 128000 : B.BASE_MAX_SIZE; }
    archUnlocked(a) { const x = ARCH[a]; if (!x.tech) return true; return this.has(x.tech) && (!x.needs || x.needs.every((t) => this.has(t))); }

    /* ---------- 資料 ---------- */
    poolCap(k) { const p = D.DATA_POOLS[k]; return p.cap0 + p.capGrow * this.yrs; }
    dataQBonus() { return this.techSum('dataQ') + Math.min(0.12, 0.012 * this.roleHeads('data')) * Math.pow(this.s.staff.data.skill / 55, 0.5) + 0.05 * this.starBonus('data_guru'); }

    /* ================= 模型預估 ================= */
    evalSpec(sp, opts) {
      opts = opts || {};
      const s = this.s; const a = ARCH[sp.arch]; const out = { warn: [] };
      const N = sp.size; // B
      let act = a.act; if (a.id !== 'dense' && this.has('t_finemoe')) act *= 0.8;
      const Nact = Math.max(0.5, N * act);
      let e = B.MOE_EXP + (a.id !== 'dense' ? this.techSum('moeEff') : 0);
      const Neff = a.id === 'dense' ? N : Math.pow(Nact, 1 - e) * Math.pow(N, e);
      out.Nact = Nact; out.Neff = Neff;
      // 資料
      const Dt = sp.tokens; let Deff = 0; let qsum = 0; out.epochs = {};
      const mix = this.normMix(sp.mix);
      for (const k of D.MIX_KEYS) {
        const need = Dt * mix[k]; if (need <= 0) { out.epochs[k] = 0; continue; }
        const have = Math.max(1, s.data[k].amt);
        const ep = need / have; out.epochs[k] = ep;
        let eff = ep <= 1 ? need : have * (1 + 1.5 * (1 - Math.pow(0.6, ep - 1)));
        Deff += eff; qsum += mix[k] * s.data[k].q;
        if (ep > 4) out.warn.push(D.DATA_POOLS[k].name + '資料重複 ' + ep.toFixed(1) + ' 輪，邊際效益很低');
      }
      if (mix.mm > 0 && !this.has('t_vision')) out.warn.push('尚未研究「視覺理解」，多模態資料無法轉化為能力');
      const Q = clamp(qsum + this.dataQBonus(), 0.2, 1.3);
      out.Deff = Deff; out.Q = Q;
      const ratio = Deff / Neff;
      const lr = Math.log(ratio / B.CHIN_RATIO);
      const eta = lr >= 0 ? Math.exp(-B.OVER_K * lr * lr) : Math.exp(-B.UNDER_K * lr * lr);
      out.ratio = ratio; out.eta = eta;
      if (ratio < 8) out.warn.push('資料量相對參數太少（每參數 ' + ratio.toFixed(1) + ' token），模型訓練不足');
      // 算力
      const Cpre = 6 * Nact * 1e9 * Dt * 1e9;
      const post = D.POST_LEVELS.find((p) => p.id === sp.post) || D.POST_LEVELS[1];
      const Cpost = Cpre * post.i * this.techProd('postCost');
      out.Cpre = Cpre; out.Cpost = Cpost; out.C = Cpre + Cpost;
      const Mq = Math.pow(Q / B.QUAL_REF, B.QUAL_EXP);
      let distill = 1;
      if (sp.teacher) {
        const t = s.models.find((m) => m.id === sp.teacher);
        if (t && this.has('t_distill') && t.size > N) {
          distill = 1 + 3 * Math.max(0, (t.comp0 - 40) / 60) * Math.min(1, Math.log10(t.size / N) / 1.5);
        }
      }
      out.distill = distill;
      const Ceff = 6 * Neff * 1e9 * Deff * 1e9 * eta * Mq * this.algoMult() * this.talentMult() * distill * (1 - (sp.penalty || 0));
      out.Ceff = Ceff;
      const S0 = B.S0_A * Math.log10(Math.max(1e19, Ceff) / 1e19) + B.S0_B;
      out.S0 = S0;
      out.stats = this.statsFor(S0, mix, sp, a, Nact);
      out.comp = this.composite(out.stats);
      // 時間與成本
      const gpus = Math.max(1, sp.gpus || 1);
      const mfu = this.mfu() * a.mfu;
      const perWeek = gpus * B.H100_WEEK_FLOPS * mfu * this.mod('trainSpeed') * (s.crunch ? 1.12 : 1);
      out.weeks = out.C / perWeek;
      out.minGpus = Math.ceil(N / B.MEM_B_PER_GPU);
      if (gpus < out.minGpus) out.warn.push('顯存不足：' + fmtParams(N) + ' 參數至少需要 ' + out.minGpus + ' 張 H100 等效卡');
      if (N > this.maxSize()) out.warn.push('超過 34B 需要先研究「3D 平行訓練」');
      const owned = this.freeEq(opts.excludeJob);
      const rentNeed = Math.max(0, gpus - owned);
      out.rentNeed = rentNeed;
      out.weekCost = rentNeed * this.rentPrice() + Math.min(gpus, owned) * 0;
      out.cost = out.weekCost * out.weeks;
      // 推理成本
      out.costRatio = this.costRatioFor(Nact, N, a);
      out.uncert = 7 / Math.sqrt(1 + s.stat.trained);
      return out;
    }
    normMix(m) {
      const t = sum(D.MIX_KEYS.map((k) => Math.max(0, m[k] || 0))) || 1;
      const o = {}; D.MIX_KEYS.forEach((k) => (o[k] = Math.max(0, m[k] || 0) / t)); return o;
    }
    statsFor(S0, mix, sp, a, Nact) {
      const s = this.s; const st = {};
      const aff = (k) => {
        const w = MIX_W[k]; let num = 0, den = 0;
        for (const p of D.MIX_KEYS) { num += w[p] * mix[p]; den += w[p] * REF_MIX[p]; }
        return clamp(Math.pow(Math.max(0.01, num / den), 0.35), 0.55, 1.4);
      };
      st.know = S0 * aff('know');
      st.lang = S0 * aff('lang');
      st.code = S0 * aff('code') * 0.95 * (a.codePen || 1);
      st.reason = S0 * aff('reason') * 0.82 + (a.reason || 0);
      st.mm = this.has('t_vision') ? S0 * (0.35 + 0.75 * Math.min(1, (mix.mm || 0) / 0.2)) : 0;
      st.ctx = 18 + 0.35 * S0 + (a.ctx || 0) + this.techSum('ctx');
      // 後訓練
      const post = D.POST_LEVELS.find((p) => p.id === sp.post) || D.POST_LEVELS[1];
      const I = post.i; const Ieff = Math.sqrt(I / 0.06);
      const al = this.normAlloc(sp.alloc);
      const instF = 0.7 + 0.5 * (1 - Math.exp(-(s.data.inst * this.techProd('inst')) / 80));
      const help = this.techProd('help');
      st.lang += (4 + 10 * al.help * Ieff) * instF * help + this.techSum('lang');
      st.know += 2 * al.help * Ieff * help + this.techSum('know');
      const alignF = (0.55 + 0.6 * Math.min(1, this.roleHeads('align') / (1 + 0.06 * this.totalStaff()))) * Math.pow(s.staff.align.skill / 55, 0.4);
      const safeEff = this.techProd('safeEff');
      st.safety = 18 + 72 * Math.sqrt(Math.min(1.3, al.safe * Math.min(1.5, Ieff) * instF * safeEff * alignF)) + this.techSum('safety') + 8 * this.starBonus('safety_mom');
      st.lang -= Math.max(0, al.safe - 0.35) * 18;
      let rb;
      if (this.has('t_cot')) rb = 22 * al.reason * Math.min(2.1, Math.pow(I / 0.12, 0.6)) * instF;
      else rb = 5 * al.reason * Ieff;
      st.reason += rb + this.techSum('reason') + 7 * this.starBonus('rl_wizard');
      st.code += 0.35 * rb + this.techSum('code');
      st.mm += st.mm > 0 ? this.techSum('mm') + 8 * this.starBonus('mm_artist') : 0;
      if (this.has('t_tools')) {
        const base = 0.4 * st.reason + 0.3 * st.code + 0.3 * st.ctx - 30;
        const bonus = (this.has('t_agentrl') ? 24 : 8) * al.agent * Math.min(2, Ieff) * instF;
        st.agent = Math.max(0, base + bonus + this.techSum('agent') + 8 * this.starBonus('agent_pioneer'));
      } else st.agent = 0;
      for (const k of D.STAT_ORDER) st[k] = clamp(st[k], 0, k === 'safety' ? 99 : 135);
      return st;
    }
    normAlloc(a) {
      a = a || {}; const keys = ['help', 'safe', 'reason', 'agent'];
      const o = {}; let t = 0;
      for (const k of keys) { let v = Math.max(0, a[k] || 0); if (k === 'agent' && !this.has('t_tools')) v = 0; o[k] = v; t += v; }
      if (t <= 0) return { help: 0.6, safe: 0.4, reason: 0, agent: 0 };
      for (const k of keys) o[k] /= t; return o;
    }
    eraWeights(w) { const ym = ymOf(w == null ? this.s.week : w); let cur = D.ERA_WEIGHTS[0].w; for (const e of D.ERA_WEIGHTS) if (ym >= e.from) cur = e.w; return cur; }
    composite(st, w) { const ww = this.eraWeights(w); let c = 0; for (const k in ww) c += ww[k] * (st[k] || 0); return c; }
    costRatioFor(Nact, N, a) {
      let r = B.COST_RATIO * Math.pow(Nact / B.REF_ACT, 0.75) * Math.pow(N / Nact, 0.08) * (a.infer || 1);
      r *= this.techProd('infer');
      r *= 1 - 0.12 * this.starBonus('efficiency_hacker');
      return Math.max(0.004, r);
    }
    reservedEq(excludeJob) { return sum(this.s.jobs.filter((j) => j.id !== excludeJob).map((j) => j.gpus)); }

    /* ================= 行動：訓練 ================= */
    defaultSpec() {
      const s = this.s;
      const eq = Math.max(8, Math.floor(this.freeEq()));
      const arch = ['sparse', 'hybrid', 'moe_mla', 'moe', 'dense'].find((x) => this.archUnlocked(x));
      return {
        name: this.nextModelName(), arch, size: 7, tokens: 1000,
        mix: { web: 60, code: 20, sci: 20, mm: 0 }, post: 'std', alloc: { help: 50, safe: 30, reason: 20, agent: 0 },
        gpus: eq, teacher: null,
      };
    }
    nextModelName() { return this.s.series + '-' + (this.s.models.length + 1); }
    canStartJob() { return this.s.jobs.filter((j) => j.kind === 'train').length < this.maxParallelJobs(); }
    maxParallelJobs() { return this.s.office >= 3 ? 3 : this.s.office >= 1 ? 2 : 1; }
    validateSpec(sp) {
      const errs = [];
      if (!this.archUnlocked(sp.arch)) errs.push('架構尚未解鎖');
      if (sp.size > this.maxSize()) errs.push('參數超過目前可訓練上限（需研究 3D 平行訓練）');
      if (sp.arch !== 'dense' && sp.size < 14) errs.push('MoE 架構至少 14B 才有意義');
      const ev = this.evalSpec(sp);
      if (sp.gpus < ev.minGpus) errs.push('分配的算力不足以放下模型（至少 ' + ev.minGpus + ' 張 H100 等效）');
      const owned = this.freeEq();
      const rentNeed = Math.max(0, sp.gpus - owned);
      if (rentNeed > this.trainRentAvail()) errs.push('雲端可租的訓練算力不足（最多再租約 ' + fmtNum(this.trainRentAvail()) + ' 張）');
      if (!this.canStartJob()) errs.push('同時進行的訓練已達上限（升級辦公室可增加）');
      if (ev.weeks > 80) errs.push('訓練時間超過 80 週，請增加算力或縮小規模');
      return { errs, ev };
    }
    currentInferRent() { return this.s.lastWeek ? this.s.lastWeek.inferRent : 0; }
    currentTrainRent() { return this.s.lastWeek ? this.s.lastWeek.trainRent || 0 : 0; }
    inferRentCap() { return this.rentCap() * 3; }
    trainRentAvail(excludeJob) {
      // 訓練可再租用的量 = 訓練租用上限 − 其他訓練任務已在租的量
      const others = this.reservedEq(excludeJob); const ownForTrain = Math.max(0, this.ownedEq() - this.inferOwnedUse());
      return Math.max(0, this.rentCap() - Math.max(0, others - ownForTrain));
    }
    inferOwnedUse() { const lw = this.s.lastWeek; if (!lw) return 0; if (this.s.trainFirst) return 0; return Math.min(this.ownedEq(), lw.inferNeed || 0); }
    freeEq(excludeJob) { return Math.max(0, this.ownedEq() - this.inferOwnedUse() - this.reservedEq(excludeJob)); }
    startTraining(sp) {
      const v = this.validateSpec(sp); if (v.errs.length) return { ok: false, errs: v.errs };
      const s = this.s; const ev = v.ev;
      const job = {
        id: s.nextId++, kind: 'train', spec: JSON.parse(JSON.stringify(sp)), gpus: sp.gpus,
        total: ev.C, done: 0, start: s.week, penalty: 0, eta: ev.weeks, events: 0,
      };
      s.jobs.push(job);
      this.log('🧪 開始訓練 ' + sp.name + '（' + ARCH[sp.arch].name + ' · ' + fmtParams(sp.size) + ' · ' + fmtTokens(sp.tokens) + ' tokens），預計 ' + Math.ceil(ev.weeks) + ' 週', 'info');
      this.checkQuests();
      return { ok: true, job };
    }
    cancelJob(id) {
      const s = this.s; const j = s.jobs.find((x) => x.id === id); if (!j) return;
      s.jobs = s.jobs.filter((x) => x !== j);
      this.log('🛑 已中止 ' + (j.kind === 'train' ? j.spec.name : '合成資料任務') + '，已投入的算力付諸流水。', 'bad');
    }
    startSynth(pool, gpus, weeks) {
      const s = this.s; if (!this.has('t_synth')) return { ok: false, errs: ['尚未研究合成資料管線'] };
      const best = this.bestModel(true);
      if (!best) return { ok: false, errs: ['需要至少一個訓練完成的模型當「老師」'] };
      const owned = this.freeEq();
      if (Math.max(0, gpus - owned) > this.trainRentAvail()) return { ok: false, errs: ['雲端可租算力不足'] };
      const job = { id: s.nextId++, kind: 'synth', pool, gpus, total: gpus * weeks, done: 0, start: s.week, teacher: best.id, q: clamp(0.38 + 0.55 * best.comp0 / 100, 0.4, 0.95), eta: weeks };
      s.jobs.push(job);
      this.log('🧬 開始合成資料（' + D.DATA_POOLS[pool].name + '），老師模型 ' + best.name, 'info');
      return { ok: true };
    }

    /* ---------- 模型管理 ---------- */
    bestModel(anyTrained) {
      let best = null;
      for (const m of this.s.models) { if (!anyTrained && !m.rel) continue; if (m.rel && m.rel.retired && !anyTrained) continue; const c = this.composite(m.stats); if (!best || c > this.composite(best.stats)) best = m; }
      return best;
    }
    releaseModel(id, price, open) {
      const s = this.s; const m = s.models.find((x) => x.id === id); if (!m || m.rel) return;
      // 監管檢查
      const frontier = this.frontierComp();
      const prev = this.bestModel(); const prevBest = prev ? this.composite(prev.stats) : 0; // 發布前自家上線中的最佳模型
      if (s.reg >= 40 && this.composite(m.stats) >= frontier - 5 && m.stats.safety < 60) {
        return { ok: false, err: '監管壓力過高（≥40）：前沿模型安全分需 ≥ 60 才能上線。' };
      }
      if (s.flags.frontier_license && this.composite(m.stats) >= 80 && m.stats.safety < 70) {
        return { ok: false, err: '《前沿模型許可》要求綜合分 ≥ 80 的模型安全分至少 70。' };
      }
      m.rel = { w: s.week, price: price || 'mid', open: !!open, retired: false, track: [] };
      s.stat.released++;
      this.unlockAch('first_release');
      const c = this.composite(m.stats);
      if (open) this.applyOpen(m);
      if (m.stats.safety < 45) s.reg = clamp(s.reg + 6, 0, 100);
      const rk = this.rankOf(m);
      m.rel.rank0 = rk; m.rel.gap0 = Math.round((c - frontier) * 10) / 10; // 發布當下的名次、與前沿的分差
      s.rep = clamp(s.rep + Math.max(0.5, (c - frontier + 15) * 0.25), 0, 100);
      this.log('🚀 ' + m.name + ' 正式發布！綜合分 ' + c.toFixed(1) + '，排行榜第 ' + rk + ' 名' + (open ? '（開源）' : ''), 'good');
      if (m.stats.safety >= 90) this.unlockAch('safe90');
      this.releaseBuzz(m, c, frontier);
      this.rivalReact(m, c, prevBest);
      this.checkQuests();
      return { ok: true, rank: rk };
    }
    applyOpen(m) {
      const s = this.s; const c = this.composite(m.stats); const frontier = this.frontierComp();
      const gain = (4 + Math.max(0, c - frontier + 15) * 0.6) * (1 + 0.3 * this.starBonus('open_evang'));
      s.community = clamp(s.community + gain, 0, 100);
      s.rep = clamp(s.rep + 2 + Math.max(0, c - frontier + 10) * 0.2, 0, 100);
      s.rivals.star.boost += 0.8; s.rivals.gale.boost += 0.8;
      this.addMod('hireQuality', 1.08, 26);
      s.stat.opened++;
      this.unlockAch('open1');
    }
    openSource(id) { const m = this.s.models.find((x) => x.id === id); if (!m || !m.rel || m.rel.open) return; m.rel.open = true; this.applyOpen(m); this.log('🕊️ ' + m.name + ' 權重已開源，社群沸騰了。', 'good'); }
    setPrice(id, price) { const m = this.s.models.find((x) => x.id === id); if (m && m.rel) m.rel.price = price; }
    // 每單位市佔能收到多少營收（1 ＝ 市場價）
    revRate(m, k, plan) {
      const pt = D.PRICE_TIERS.find((p) => p.id === m.rel.price) || D.PRICE_TIERS[2];
      let rm = pt.rev; if (pt.id === 'free' && k !== 'chat') rm = 0.02;
      if (k === 'chat' && plan) rm = plan.arpu;
      if (m.rel.open) rm *= k === 'api' ? 0.25 : k === 'chat' ? 1 : k === 'ent' ? 0.7 : 0.6;
      if (k === 'ent') rm *= 1 + 0.2 * this.starBonus('deal_maker');
      return rm;
    }

    /* ================= 會員方案（對話 App） =================
       沒有 s.plans 就照模型定價賣，所有數字都和沒有這個系統時一樣。玩家第一次調整方案時才會有 s.plans。
       s.plans = { fq 免費額度, sp 標準版月費, sq 標準額度, mx 有沒有旗艦版, mp 旗艦版月費, mq 旗艦額度 }
       回傳 price 價格倍率、util 吸引力加成、arpu 每單位市佔的營收倍率、load 算力用量倍率 */
    planFx(c) {
      c = c || this.s.plans; if (!c) return null;
      const K = D.PLANS.k; const best = this.bestModel();
      const strong = best ? clamp(1 - (this.frontierComp() - this.composite(best.stats)) / K.maxGap, 0.1, 1.2) : 0.1;  // 模型越強，旗艦版越賣得動
      const take = c.mx ? K.maxTake * strong * Math.pow(c.mq / 10, K.maxQuota) * (200 / c.mp) : 0;
      const conv = Math.pow(c.fq, -K.freeConv) * Math.pow(c.sq, K.stdConv) * Math.pow(20 / c.sp, K.priceConv) * (1 - take * K.cannibal);
      return {
        price: c.sp / 20, conv, take, strong,
        util: K.freeUtil * Math.log(c.fq) + K.stdUtil * Math.log(c.sq) + (c.mx ? K.maxUtil * strong : 0),
        arpu: conv * c.sp / 20 + take * c.mp / 20,
        load: K.freeLoad * c.fq + (1 - K.freeLoad) * c.sq * conv + take * c.mq * K.maxUse,
      };
    }
    chatLoad() { const fx = this.planFx(); return (fx ? fx.load : 1) * this.mod('chatLoad'); }
    // 還沒調整過方案時，畫面上的起始值：標準版月費從目前賣得最好的模型定價換算
    planDefaults() {
      const s = this.s; const shares = s.market.chat ? s.market.chat.shares : {}; let top = null; let bs = -1;
      for (const m of s.models) { if (!m.rel || m.rel.retired) continue; const v = shares['p' + m.id] || 0; if (v > bs) { bs = v; top = m; } }
      return { fq: 1, sp: D.PLANS.tierPrice[top ? top.rel.price : 'mid'] || 20, sq: 1, mx: false, mp: 200, mq: 10 };
    }
    // 調整方案對聲望的影響：砍額度、漲價會挨罵，給得多會被稱讚；短時間內反覆調整只有壞處
    planRepDelta(c) {
      const s = this.s; const P = D.PLANS; const b = s.plans || this.planDefaults();
      const i = (list, v) => list.findIndex((x) => (x.v == null ? x : x.v) === v);
      const step = (list, from, to) => i(list, to) - i(list, from);
      const df = step(P.free.quota, b.fq, c.fq); const ds = step(P.std.quota, b.sq, c.sq); const dp = step(P.std.prices, b.sp, c.sp);
      const dm = b.mx && c.mx ? step(P.max.quota, b.mq, c.mq) : 0;
      const cut = Math.max(0, -df) + Math.max(0, -ds) + Math.max(0, -dm); const up = Math.max(0, df) + Math.max(0, ds) + Math.max(0, dm);
      let rep = -cut - Math.max(0, dp) * 0.5 + Math.min(2, (up + Math.max(0, -dp) * 0.5) * 0.5);
      const fickle = s.planW != null && s.week - s.planW < 8;
      if (fickle) rep = Math.min(rep, 0) - 1;
      return { rep, cut, up, fickle };
    }
    setPlans(c) {
      const s = this.s; const P = D.PLANS; const has = (list, v) => list.some((x) => (x.v == null ? x : x.v) === v);
      if (!has(P.free.quota, c.fq) || !has(P.std.quota, c.sq) || !has(P.std.prices, c.sp) || !has(P.max.prices, c.mp) || !has(P.max.quota, c.mq)) return { ok: false, err: '方案設定不正確' };
      if (c.mx && this.ym < P.max.from) return { ok: false, err: '旗艦版要 ' + P.max.from + ' 後才能推出' };
      const d = this.planRepDelta(c); const hadMax = !!(s.plans && s.plans.mx);
      s.plans = { fq: c.fq, sp: c.sp, sq: c.sq, mx: !!c.mx, mp: c.mp, mq: c.mq };
      s.planW = s.week; s.flags.plans_on = 1; if (d.cut) s.planCutW = s.week;
      s.rep = clamp(s.rep + d.rep, 0, 100);
      this.log('📝 調整會員方案：標準版 $' + c.sp + '/月' + (c.mx ? '，旗艦版 $' + c.mp + '/月' : '') + '。' + (d.cut ? '額度縮水的消息馬上傳開了。' : ''), d.cut ? 'bad' : 'info');
      if (c.mx && !hadMax) this.log('👑 推出旗艦版，$' + c.mp + ' 一個月，給用量最兇的那群人。', 'good');
      const ev = this.EVT.plan_backlash;
      if (d.cut && ev && this.eventOk(ev) && this.rand() < (d.cut >= 2 ? 0.8 : 0.35)) this.queueEvent(ev);
      return { ok: true, rep: d.rep };
    }
    // 額度開得太大，遲早有人拿去轉售或二十四小時跑腳本
    planTick() {
      const c = this.s.plans; if (!c) return;
      const ev = this.EVT.plan_abuse; const risky = (c.mx && c.mq >= 20) || c.sq >= 2.5;
      if (risky && ev && this.eventOk(ev) && this.rand() < 0.03) this.queueEvent(ev);
    }
    // 試算：市佔算到穩定之後的樣子，其他市場維持現狀，不會改動任何狀態
    planCalc(c) {
      const s = this.s; const keep = s.plans; s.plans = c || null;
      const fx = this.planFx(); const load = this.chatLoad(); const rp = this.rentPrice(); const V = this.segValue('chat');
      this._front = this.frontierComp();
      const ps = this.segActive('chat') ? this.products('chat') : []; const T = ps.length ? this.segTargets('chat', ps) : { targets: [] };
      let share = 0; let rev = 0; let need = 0;
      ps.forEach((p, i) => { if (p.player == null) return; const m = s.models.find((x) => x.id === p.player); const sh = T.targets[i]; share += sh; rev += sh * V * this.revRate(m, 'chat', fx); need += sh * V * m.costRatio / rp * load; });
      const chatNeed = need;
      for (const m of s.models) {
        if (!m.rel || m.rel.retired) continue;
        for (const k of D.SEG_ORDER) { if (k === 'chat') continue; const sh = s.market[k].shares['p' + m.id] || 0; if (sh) { const v = this.segValue(k); rev += sh * v * this.revRate(m, k, fx); need += sh * v * m.costRatio / rp; } }
      }
      s.plans = keep;
      const owned = this.ownedEq(); const own = Math.min(s.trainFirst ? Math.max(0, owned - this.reservedEq()) : owned, need);
      const rent = s.autoRent ? Math.max(0, Math.min(this.inferRentCap(), need - own)) : 0;
      const served = need > 0 ? Math.min(1, (own + rent) / need) : 1;
      const active = share * V / (20 / 4.33) * 9; const payers = active / 9;
      return { share, need, chatNeed, own, rent, served, rev: rev * served * this.mod('revenueMul'), rentCost: rent * rp, active, paid: payers * (fx ? fx.conv : 1), flag: payers * (fx ? fx.take : 0), strong: fx ? fx.strong : null, fx };
    }
    /* 發放額度重置：送用戶一輪額度，換聲望，代價是之後兩週算力用量暴增。
       剛砍過額度或服務塞車時發，算是賠罪，效果加倍；發得太頻繁，大家就當成應該的了 */
    resetState() {
      const s = this.s; const R = D.PLANS.reset; const last = s.planResetW;
      return {
        wait: last == null ? 0 : Math.max(0, last + R.gap - s.week),
        tired: last != null && s.week - last < R.tire,
        sorry: (s.planCutW != null && s.week - s.planCutW <= R.sorry) || ((s.lastWeek || {}).served || 1) < 0.8,
      };
    }
    resetGain(scope) { const R = D.PLANS.reset; const st = this.resetState(); return R[scope].rep * (st.sorry ? 2 : 1) * (st.tired ? 0.3 : 1); }
    grantReset(scope) {
      const s = this.s; const R = D.PLANS.reset; const o = R[scope]; if (!o) return { ok: false, err: '沒有這個選項' };
      if (this.playerShare('chat') <= 0) return { ok: false, err: '對話 App 還沒有用戶' };
      const st = this.resetState(); if (st.wait) return { ok: false, err: '才剛發過，再等 ' + st.wait + ' 週' };
      const gain = this.resetGain(scope); s.rep = clamp(s.rep + gain, 0, 100);
      this.addMod('chatLoad', o.load, R.weeks); if (scope === 'all') this.addMod('demand_chat', 1.05, 4);
      s.planResetW = s.week; s.stat.resets = (s.stat.resets || 0) + 1;
      const N = root.ME_RESET_POSTS || {}; const pick = (a) => (a && a.length ? a[Math.floor(this.frand() * a.length)] : '');
      this.log('🎁 ' + (pick(st.sorry ? N.sorry : N[scope]) || '發放額度重置。') + '（' + o.name + '）', 'good');
      const reply = pick(st.tired ? N.tired : N.reply); if (reply) this.log(reply, 'buzz');
      return { ok: true, gain };
    }
    retireModel(id) {
      const m = this.s.models.find((x) => x.id === id); if (!m || !m.rel) return;
      m.rel.retired = true; delete m.use; for (const k in this.s.market) delete this.s.market[k].shares['p' + m.id];
      this.log('📦 ' + m.name + ' 已下架。', 'info');
    }
    renameModel(id, name) { const m = this.s.models.find((x) => x.id === id); if (m && name) m.name = String(name).slice(0, 24); }

    /* ================= 研究 ================= */
    techCost(id) {
      const t = TECH[id]; let c = t.cost;
      const pub = this.isPublic(id);
      if (!pub) c *= yearsSince(this.s.week, t.pub) < -1 ? 2.2 : 1.6; else c *= 0.6;
      const effMul = this.s.embargoScenario ? 0.65 : (this.city().effTech || 1);
      if (effMul < 1 && t.eff && (t.eff.algo || t.eff.mfu || t.eff.infer || t.eff.moeEff || t.eff.unlockArch)) c *= effMul;
      for (const x of this.s.mods) if (x.key === 'tech_' + id && x.until > this.s.week) c *= x.mul;
      return Math.round(c);
    }
    futureCost() { return Math.round(4000 * Math.pow(1.4, this.s.futureLv || 0)); }
    futureAvailable() { return D.TECHS.filter((t) => !this.has(t.id)).length <= 6 || this.yrs >= 4; }
    researchFuture() {
      const s = this.s; if (!this.futureAvailable()) return { ok: false, err: '還有基礎科技沒研究完' };
      const c = this.futureCost(); if (s.rp < c) return { ok: false, err: '研究點不足' };
      s.rp -= c; s.futureLv = (s.futureLv || 0) + 1; s.rep = clamp(s.rep + 1, 0, 100);
      this.log('🧪 前沿基礎研究 Lv.' + s.futureLv + ' 完成：有效算力再 ×1.05。', 'good');
      return { ok: true };
    }
    isPublic(id) { const t = TECH[id]; return this.ym >= t.pub.slice(0, 7) || !!this.s.techPublic[id]; }
    techAvailable(id) { const t = TECH[id]; if (this.has(id) || this.researching(id) || this.exclTaken(id)) return false; return !t.req || t.req.every((r) => this.has(r)); }
    // 研究：開始時先付研究點，之後每週前進；同時能做幾項看研究線。s.research = [{ id, total, done, cost, w }]
    techDur(id) { const t = TECH[id]; return Math.max(1, Math.round((t.dur || 4) * (this.isPublic(id) ? 1 : 1.3) * this.techProd('durMul'))); }
    researchSlots() { const h = this.roleHeads('res'); let n = 1; for (const x of B.RES_SLOTS) if (h >= x) n++; return Math.min(B.RES_SLOTS_MAX, n + this.techSum('slots')); }
    researchJobs() { const v = this.researchSpeed(); return this.s.research.map((j) => ({ id: j.id, left: Math.max(1, Math.ceil((j.total - j.done) / v)), total: j.total })); }
    researchSpeed() { return this.prodMul() / 1.1; } // 士氣 70 時正好照表上的週數；士氣低會變慢，加班會變快
    researching(id) { return this.s.research.some((j) => j.id === id); }
    // 同一互斥組裡已經選走的科技（已掌握或研究中）
    exclTaken(id) {
      const t = TECH[id]; if (!t || !t.excl) return null;
      for (const x of D.TECHS) if (x.excl === t.excl && x.id !== id && (this.has(x.id) || this.researching(x.id))) return x;
      return null;
    }
    // 不能研究的原因；可以研究時回傳 null
    techBlocked(id) {
      const t = TECH[id]; if (!t) return '沒有這項科技';
      if (this.has(id)) return '已經掌握';
      if (this.researching(id)) return '正在研究';
      const x = this.exclTaken(id); if (x) return '已選擇「' + x.name + '」，不能再走這條路線';
      const miss = (t.req || []).filter((r) => !this.has(r));
      if (miss.length) return '需要先研究：' + miss.map((r) => TECH[r].name).join('、');
      if (this.s.research.length >= this.researchSlots()) return '研究線已滿（' + this.researchSlots() + ' 條），招更多研究員可以增加';
      if (this.s.rp < this.techCost(id)) return '研究點不足';
      return null;
    }
    research(id) {
      const s = this.s; const err = this.techBlocked(id); if (err) return { ok: false, err };
      const c = this.techCost(id); s.rp -= c;
      const total = this.techDur(id);
      s.research.push({ id, total, done: 0, cost: c, w: s.week });
      this.log('🔬 開始研究「' + TECH[id].name + '」，預計 ' + total + ' 週', 'info');
      this.checkQuests();
      return { ok: true };
    }
    // 取消研究：退還還沒做完的比例
    cancelResearch(id) {
      const s = this.s; const j = s.research.find((x) => x.id === id); if (!j) return { ok: false, err: '沒有在研究這項' };
      const back = Math.round(j.cost * (1 - j.done / j.total));
      s.rp += back; s.research = s.research.filter((x) => x !== j);
      this.log('🛑 取消研究「' + TECH[id].name + '」，退回 ' + back + ' 研究點。', 'info');
      return { ok: true, back };
    }
    progressResearch() {
      const s = this.s; const v = this.researchSpeed();
      for (const j of s.research.slice()) { j.done += v; if (j.done >= j.total) { s.research = s.research.filter((x) => x !== j); this.grantTech(j.id, true); } }
    }
    grantTech(id, researched) {
      const s = this.s; const t = TECH[id]; if (!t || s.techs[id]) return;
      // 事件直接給了正在研究的科技：把還沒做完的研究點退回來
      const j = s.research.find((x) => x.id === id);
      if (j) { s.rp += Math.round(j.cost * (1 - j.done / j.total)); s.research = s.research.filter((x) => x !== j); }
      const pioneer = researched && !this.isPublic(id);
      s.techs[id] = { w: s.week, pioneer };
      this.techChanged();
      if (t.key && !pioneer) this.chron('tech', '掌握「' + t.name + '」', t.spec ? 6 : 4);
      if (t.eff && t.eff.rep) s.rep = clamp(s.rep + t.eff.rep, 0, 100);
      if (pioneer) { s.stat.pioneers++; s.rep = clamp(s.rep + 3, 0, 100); this.log('🔭 全球首創！' + s.company + ' 率先掌握「' + t.name + '」，論文引爆學術圈。', 'good'); this.chron('tech', '全球首創「' + t.name + '」', t.spec ? 6 : 4); }
      else this.log('🔬 研究完成：「' + t.name + '」', 'good');
      if (Object.keys(s.techs).length >= 60) this.unlockAch('all_tech');
      if (s.stat.pioneers >= 5) this.unlockAch('pioneer');
    }

    /* ================= 人事 ================= */
    /* 個別員工 s.people：[{ id, name, g, role, skill, face, joined }]
       s.staff[職能].n／.skill 一律由 s.people 算出（syncStaff），其他公式照舊讀 s.staff，不要直接改它。
       名字、外觀等裝飾用另一條亂數 s.prng，不會改變遊戲數值用的亂數序列。 */
    prand() { const r = mulberry(this.s.prng)(); this.s.prng = r.s; return r.v; }
    // 抽一個名字：全名不跟在職員工、明星重複；同一個名已經很多人用時降低機率。gPref 可指定 'f'／'m'（改名時保留原本的性別傾向）
    makeName(gPref) {
      const s = this.s; const N = root.ME_NAMES; const CS = N && N.cultures;
      const used = new Set(); for (const p of s.people || []) used.add(p.name); for (const x of this.STARS) used.add(x.name);
      const pickG = () => (gPref === 'f' || gPref === 'm' ? gPref : this.prand() < 0.5 ? 'f' : 'm');
      if (!CS) { let k = s.nextPid || 1; while (used.has('員工' + k)) k++; return { name: '員工' + k, g: pickG() }; }
      const boost = (N.cityBoost || {})[s.city] || {};
      const keys = Object.keys(CS); const ws = keys.map((k) => (CS[k].w || 1) + (boost[k] || 0)); const W = sum(ws);
      let spare = null;
      for (let t = 0; t < 16; t++) {
        let r = this.prand() * W, k = keys[keys.length - 1];
        for (let i = 0; i < keys.length; i++) { r -= ws[i]; if (r < 0) { k = keys[i]; break; } }
        const C = CS[k]; const g = pickG(); const sg = C.order === 'sg';
        const given = C[g][Math.floor(this.prand() * C[g].length)]; const sur = C.sur[Math.floor(this.prand() * C.sur.length)];
        const name = sg ? sur + given : given + '·' + sur;
        if (used.has(name)) continue;
        if (!spare) spare = { name, g };
        const same = givenCount(s.people || [], given, sg);
        if (same && this.prand() >= 1 / (1 + same)) continue;
        return { name, g };
      }
      if (spare) return spare;
      // 幾乎不會發生：依序找一個還沒人用的全名
      for (const k of keys) {
        const C = CS[k];
        for (const g of gPref ? [gPref] : ['f', 'm']) for (const gv of C[g]) for (const sn of C.sur) { const name = C.order === 'sg' ? sn + gv : gv + '·' + sn; if (!used.has(name)) return { name, g }; }
      }
      return { name: '員工' + s.nextPid, g: pickG() };
    }
    // 舊存檔可能有同名：保留先進公司的那位，後來的人用 s.prng 重抽名字（性別傾向不變）
    dedupeNames() {
      const seen = new Set(this.STARS.map((x) => x.name));
      for (const p of this.s.people) { if (seen.has(p.name)) p.name = this.makeName(p.g).name; seen.add(p.name); }
    }
    newPerson(role, skill, joined) {
      const s = this.s; const nm = this.makeName();
      const p = { id: s.nextPid++, name: nm.name, g: nm.g, role, skill: clamp(skill, 20, 99), face: Math.floor(this.prand() * 2147483647), joined: joined == null ? s.week : joined };
      s.people.push(p); return p;
    }
    syncStaff() {
      const s = this.s;
      for (const r of D.ROLE_ORDER) {
        const ps = s.people.filter((p) => p.role === r); const st = s.staff[r];
        st.n = ps.length; if (ps.length) st.skill = sum(ps.map((p) => p.skill)) / ps.length; // 沒人時保留原本的平均技能
      }
    }
    // 依人數與平均技能補產生員工（開局與舊存檔用）：技能在平均值附近抽樣，再整體平移讓平均吻合
    seedPeople(role, n, avg) {
      const made = [];
      for (let i = 0; i < n; i++) made.push(this.newPerson(role, avg + (this.prand() - 0.5) * 16, Math.floor(this.prand() * (this.s.week + 1))));
      if (made.length) { const m = sum(made.map((p) => p.skill)) / made.length; for (const p of made) p.skill = clamp(p.skill + avg - m, 20, 99); }
    }
    ensurePeople() {
      const s = this.s; if (Array.isArray(s.people)) return;
      s.people = []; if (s.nextPid == null) s.nextPid = 1; if (s.prng == null) s.prng = (s.seed ^ 0x5bd1e995) >>> 0;
      for (const r of D.ROLE_ORDER) { const st = s.staff[r]; if (st && st.n > 0) this.seedPeople(r, st.n, st.skill); }
      this.syncStaff();
    }
    people(role) { const ps = this.s.people || []; return role ? ps.filter((p) => p.role === role) : ps.slice(); }
    removePeople(list) { const ids = new Set(list.map((p) => p.id)); this.s.people = this.s.people.filter((p) => !ids.has(p.id)); this.syncStaff(); }

    hire(role, n) {
      const s = this.s; n = Math.max(1, n | 0);
      if (this.totalStaff() + n > this.officeCap()) return { ok: false, err: '辦公室容量不足，請先升級辦公室' };
      const sal = D.ROLES[role].salary * this.salaryMul() * s.payPolicy;
      const fee = sal * 2 * n; if (s.cash < fee) return { ok: false, err: '資金不足以支付招募費' };
      s.cash -= fee;
      const q = 46 + s.rep * 0.18 + s.community * 0.06 + (s.payPolicy - 1) * 22 + 6 * this.starBonus('celebrity') + (this.mod('hireQuality') - 1) * 60;
      const made = [];
      for (let i = 0; i < n; i++) made.push(this.newPerson(role, clamp(q + this.randn() * 7, 25, 92)));
      this.syncStaff();
      s.stat.hired = (s.stat.hired || 0) + n;
      this.checkQuests();
      return { ok: true, fee, people: made.map((p) => p.id) };
    }
    // 裁員：fire 先裁該職能技能最低的人；firePerson 指定某一位
    fire(role, n) { const gone = this.people(role).sort((a, b) => a.skill - b.skill).slice(0, Math.max(0, n | 0)); if (gone.length) this.layoff(gone); }
    firePerson(id) { const p = (this.s.people || []).find((x) => x.id === id); if (p) this.layoff([p]); }
    layoff(list) {
      const s = this.s; const n = list.length;
      const pay = sum(list.map((p) => D.ROLES[p.role].salary)) * this.salaryMul() * s.payPolicy * 4;
      s.cash -= pay; this.removePeople(list);
      s.morale = clamp(s.morale - 3 - 30 * n / Math.max(4, this.totalStaff()), 0, 100);
      const oneRole = list.every((p) => p.role === list[0].role);
      this.log('📉 裁員 ' + n + ' 位' + (oneRole ? D.ROLES[list[0].role].name : '員工') + peopleNames(list) + '，支付遣散費 ' + fmtMoney(pay), 'bad');
    }
    starSalary(x) { return x.salary * Math.pow(1 + B.SALARY_INFL, Math.max(0, yearsSince(this.s.week, x.minDate || '2023-01')) * 0.5); }
    refreshStarPool(init) {
      const s = this.s; const ym = this.ym;
      s.starPool = s.starPool.filter((p) => p.exp > s.week);
      if (s.starPool.length >= 3) return;
      const hired = {}; s.stars.forEach((x) => (hired[x.id] = 1)); s.starPool.forEach((x) => (hired[x.id] = 1));
      const cands = this.STARS.filter((x) => !hired[x.id] && !s.starGone[x.id] && (x.minDate || '2023-01') <= ym);
      const n = init ? 2 : (this.rand() < 0.55 ? 1 : 0);
      for (let i = 0; i < n && cands.length; i++) {
        const c = cands.splice(Math.floor(this.rand() * cands.length), 1)[0];
        s.starPool.push({ id: c.id, exp: s.week + 10, disc: 1 });
      }
    }
    offerStar(id, disc) {
      const s = this.s; let c = id === 'random' ? null : this.STAR[id];
      if (!c) {
        const hired = {}; s.stars.forEach((x) => (hired[x.id] = 1)); s.starPool.forEach((x) => (hired[x.id] = 1));
        const cands = this.STARS.filter((x) => !hired[x.id] && !s.starGone[x.id]);
        if (!cands.length) return; c = this.pick(cands);
      }
      if (s.stars.find((x) => x.id === c.id)) return;
      s.starPool = s.starPool.filter((p) => p.id !== c.id);
      s.starPool.unshift({ id: c.id, exp: s.week + 8, disc: disc || 0.7 });
    }
    hireStar(id) {
      const s = this.s; const p = s.starPool.find((x) => x.id === id); const c = this.STAR[id]; if (!p || !c) return { ok: false, err: '人選已不在名單上' };
      if (this.totalStaff() + 1 > this.officeCap()) return { ok: false, err: '辦公室容量不足' };
      const sal = this.starSalary(c) * p.disc;
      const bonus = sal * 8; if (s.cash < bonus) return { ok: false, err: '資金不足以支付簽約金' };
      s.cash -= bonus;
      s.stars.push({ id: c.id, name: c.name, title: c.title, role: c.role, trait: c.trait, skill: c.skill, salary: sal, w: s.week, morale: 75 });
      s.starPool = s.starPool.filter((x) => x.id !== id);
      this.log('🌟 ' + c.name + '（' + c.title + '）加入了 ' + s.company + '！', 'good'); this.chron('people', c.name + '加入', 4);
      this.checkQuests();
      return { ok: true };
    }
    starLeave(idx, reason) {
      const s = this.s; if (!s.stars.length) return;
      const i = idx == null ? Math.floor(this.rand() * s.stars.length) : idx;
      const x = s.stars.splice(i, 1)[0]; s.starGone[x.id] = s.week;
      this.log('💔 ' + x.name + ' 離開了公司' + (reason ? '：' + reason : '。'), 'bad'); this.chron('people', x.name + '離開公司', 4);
    }
    upgradeOffice() {
      const s = this.s; const nx = D.OFFICES[s.office + 1]; if (!nx || s.officeBuild) return { ok: false, err: '無法升級' };
      if (s.cash < nx.cost) return { ok: false, err: '資金不足' };
      s.cash -= nx.cost; s.officeBuild = { lv: nx.lv, done: s.week + 4 };
      this.log('🏗️ 開始裝修「' + nx.name + '」，4 週後啟用。', 'info'); return { ok: true };
    }

    /* ================= 算力行動 ================= */
    buyGpu(type, n) {
      const s = this.s; if (!this.gpuAvail(type)) return { ok: false, err: '此型號目前無法購買' };
      const cost = this.gpuPrice(type) * n; if (s.cash < cost) return { ok: false, err: '資金不足' };
      if (this.cardCount() + n > this.dcSlots()) return { ok: false, err: '機房槽位不足（' + this.cardCount() + '/' + this.dcSlots() + '），請先擴建機房' };
      s.cash -= cost; const g = s.gpus.find((x) => x.type === type); if (g) g.n += n; else s.gpus.push({ type, n, w: s.week });
      this.log('🖥️ 採購 ' + n + ' 張 ' + GPU[type].name + '，花費 ' + fmtMoney(cost), 'info');
      s.stat.bought = (s.stat.bought || 0) + n;
      this.checkQuests();
      return { ok: true, cost };
    }
    sellGpu(type, n) {
      const s = this.s; const g = s.gpus.find((x) => x.type === type); if (!g) return;
      n = Math.min(n, g.n); const val = this.gpuPrice(type) * 0.5 * n;
      g.n -= n; s.gpus = s.gpus.filter((x) => x.n > 0); s.cash += val;
      this.log('💸 出售 ' + n + ' 張 ' + GPU[type].name + '，回收 ' + fmtMoney(val), 'info');
    }
    upgradeDC() {
      const s = this.s; const nx = D.DATACENTERS[s.dc + 1]; if (!nx || s.dcBuild) return { ok: false, err: '無法擴建' };
      if (nx.from && this.ym < nx.from) return { ok: false, err: nx.from + ' 後才能建設' };
      if (s.cash < nx.cost) return { ok: false, err: '資金不足' };
      s.cash -= nx.cost; s.dcBuild = { lv: nx.lv, done: s.week + nx.weeks };
      this.log('🏗️ 開始興建「' + nx.name + '」，預計 ' + nx.weeks + ' 週完工。', 'info'); return { ok: true };
    }

    /* ================= 資料行動 ================= */
    dealPrice(d) { return d.price * Math.pow(1.18, this.yrs); }
    dealAvailable(d) { const last = this.s.dealsBought[d.id]; return (!d.from || this.ym >= d.from) && (last == null || this.s.week - last >= 52); }
    buyDeal(id) {
      const s = this.s; const d = D.DATA_DEALS.find((x) => x.id === id); if (!d || !this.dealAvailable(d)) return { ok: false, err: '目前無法購買' };
      const p = this.dealPrice(d); if (s.cash < p) return { ok: false, err: '資金不足' };
      s.cash -= p; s.dealsBought[d.id] = s.week; this.addData(d.pool, d.amt, d.q);
      this.log('📚 購買「' + d.name + '」：' + D.DATA_POOLS[d.pool].name + ' +' + fmtTokens(d.amt), 'info');
      return { ok: true };
    }
    instPrice() { return 9000 * Math.pow(1.08, this.yrs); }
    buyInst(k) {
      const s = this.s; const p = this.instPrice() * k * (k >= 100 ? 0.8 : 1); if (s.cash < p) return { ok: false, err: '資金不足' };
      s.cash -= p; s.data.inst += k; this.log('✍️ 外包標註 ' + k + 'K 筆指令/偏好資料，花費 ' + fmtMoney(p), 'info'); return { ok: true };
    }
    addData(pool, amt, q) {
      const p = this.s.data[pool]; if (!p) return;
      if (amt < 0) { p.amt = Math.max(0, p.amt + amt); return; }
      const nq = q == null ? p.q : q; p.q = (p.q * p.amt + nq * amt) / Math.max(1, p.amt + amt); p.amt += amt;
    }

    /* ================= 資本 ================= */
    nextRound() {
      const r = this.s.ipo ? { id: 'SEC', name: '增發新股', dil: 0.05, cap: 2e10, req: { minRev: 0, andRank: 5 }, reqText: '上市後每 26 週可增發一次，模型排名要在前 5' } : D.ROUNDS[this.s.roundIdx];
      if (!r) return null;
      // 一輪能募的錢有上限：估值很高時，同樣的金額只賣比較少的股份
      return Object.assign({}, r, { dil: r.cap ? Math.min(r.dil, r.cap / (this.s.valuation + r.cap)) : r.dil });
    }
    roundReady() {
      const s = this.s; const r = this.nextRound(); if (!r) return { ok: false, why: '沒有可進行的募資' };
      if (s.week - s.lastRound < 26) return { ok: false, why: '距上一輪不足 26 週（還要 ' + (26 - (s.week - s.lastRound)) + ' 週）' };
      const q = r.req; const best = this.bestModel(); const bc = best ? this.composite(best.stats) : 0; const rk = this.bestRank(); const rev = this.avgRevenue();
      let ok = true;
      if (q.minBest && bc < q.minBest) ok = false;
      if (q.minRev != null) {
        if (q.andRank) ok = rev >= q.minRev && rk <= q.andRank;
        else ok = rev >= q.minRev || (q.orRank && rk <= q.orRank);
      }
      return { ok, why: ok ? '' : '條件未達成：' + r.reqText };
    }
    raiseFunds() {
      const s = this.s; const r = this.nextRound(); const rd = this.roundReady(); if (!rd.ok) return { ok: false, err: rd.why };
      const pre = s.valuation; const amt = pre * r.dil / (1 - r.dil);
      s.cash += amt; s.raised += amt; s.equity *= (1 - r.dil); s.lastRound = s.week;
      if (r.id === 'IPO') { s.ipo = true; this.unlockAch('ipo'); s.rep = clamp(s.rep + 8, 0, 100); this.log('🔔 ' + s.company + ' 正式上市！募得 ' + fmtMoney(amt) + '，市值 ' + fmtMoney(pre + amt), 'good'); this.chron('money', '上市敲鐘，募得 ' + fmtMoney(amt) + '，市值 ' + fmtMoney(pre + amt), 9); }
      else { if (r.id !== 'SEC') s.roundIdx++; this.log('💰 完成' + r.name + '：以投前估值 ' + fmtMoney(pre) + ' 募得 ' + fmtMoney(amt) + '，你的持股剩 ' + (s.equity * 100).toFixed(1) + '%', 'good'); this.chron('money', '完成' + r.name + '，募得 ' + fmtMoney(amt), r.id === 'D' || r.id === 'E' ? 6 : 5); }
      this.checkQuests();
      return { ok: true, amt };
    }
    emergencyLoan() {
      const s = this.s; if (s.flags.loanUsed) return { ok: false, err: '已用過過橋貸款' };
      const amt = Math.max(2e6, this.weeklyExpense() * 10); s.cash += amt; s.equity *= 0.93; s.flags.loanUsed = true;
      this.log('🩹 取得過橋貸款 ' + fmtMoney(amt) + '（以 7% 股權作為擔保）', 'bad'); this.chron('crisis', '資金告急，靠過橋貸款撐過去', 7); return { ok: true };
    }

    /* ================= 每週推進 ================= */
    tick() {
      const s = this.s; if (s.ended) return;
      if (s.pending.length) return; // 等待玩家處理事件
      s.week++;
      const lw = { rev: 0, revSeg: {}, cost: {}, served: 1, rentEq: 0, inferRent: 0, trainRent: 0, inferNeed: 0, idle: 0, rp: 0 };
      s.mods = s.mods.filter((m) => m.until > s.week);
      this.processNews();
      this.processHistory();
      this.updateBuilds();
      this.updateRivals(false);
      this.processReactions();
      // 算力分配：推理優先（客戶不能等），其次訓練，剩下的閒置算力加速研究
      const owned = this.ownedEq();
      const inferNeed = this.inferNeed();
      lw.inferNeed = inferNeed;
      const trainNeed = this.reservedEq();
      let ownInfer, ownTrain, left;
      if (s.trainFirst) { ownTrain = Math.min(owned, trainNeed); ownInfer = Math.min(owned - ownTrain, inferNeed); }
      else { ownInfer = Math.min(owned, inferNeed); ownTrain = Math.min(owned - ownInfer, trainNeed); }
      left = owned - ownInfer - ownTrain;
      // 推理可用的雲端容量較大（serverless / 推理雲），訓練要整塊叢集，容量較小
      const rentInfer = s.autoRent ? Math.max(0, Math.min(this.inferRentCap(), inferNeed - ownInfer)) : 0;
      const rentTrain = Math.max(0, Math.min(this.rentCap(), trainNeed - ownTrain));
      lw.ownInfer = ownInfer; lw.trainRent = rentTrain; lw.inferRent = rentInfer; lw.rentEq = rentTrain + rentInfer; lw.idle = left;
      lw.trainFrac = trainNeed > 0 ? clamp((ownTrain + rentTrain) / trainNeed, 0, 1) : 1;
      lw.served = inferNeed > 0 ? clamp((ownInfer + rentInfer) / inferNeed, 0, 1) : 1;
      s.lastWeek = lw;
      // 訓練進度
      this.progressJobs(lw);
      // 市場
      this.computeMarket(false);
      let rev = 0; const use = {}; const plan = this.planFx();
      for (const m of s.models) {
        if (!m.rel || m.rel.retired) continue;
        let mr = 0; const mu = {};
        for (const k of D.SEG_ORDER) {
          const sh = s.market[k].shares['p' + m.id] || 0; if (!sh) continue;
          const V = this.segValue(k);
          const r = sh * V * this.revRate(m, k, plan) * lw.served * this.mod('revenueMul');
          lw.revSeg[k] = (lw.revSeg[k] || 0) + r; mr += r;
          const u = sh * V / this.refPrice(k) * USAGE[k].mul * lw.served; mu[k] = u; use[k] = (use[k] || 0) + u;
        }
        m.lastRev = mr; m.totRev = (m.totRev || 0) + mr; rev += mr; m.use = mu;
      }
      lw.rev = rev; lw.usage = use;
      // 主力模型開始老化時提醒一次
      const flag = this.bestModel();
      if (flag && !flag.staleLog && this.modelStale(flag) > 0) { flag.staleLog = 1; this.log('⏳ ' + flag.name + ' 上線快一年了，客戶開始被新模型吸引。該排下一代了。', 'info', { model: flag.id }); }
      this.trackReleases();
      this.checkRfps();
      this.planTick();
      for (const m of s.models) if (m.rel && !m.rel.retired && m.badges && m.badges.some((b) => b.tier === 2)) this.unlockAch('gold_badge');
      if (lw.served < 0.97 && inferNeed > 50) {
        s.rep = clamp(s.rep - Math.min(0.8, (1 - lw.served) * 0.8), 0, 100);
        if (!s.flags._capWarn || s.week - s.flags._capWarn > 8) { s.flags._capWarn = s.week; this.log('🔥 推理算力不足！只服務了 ' + Math.round(lw.served * 100) + '% 的需求，用戶在排隊、聲望下滑。', 'bad'); }
      }
      // 成本
      const sm = this.salaryMul() * s.payPolicy;
      let payroll = 0; for (const r of D.ROLE_ORDER) payroll += s.staff[r].n * D.ROLES[r].salary * sm;
      payroll *= (s.trainProg ? 1.06 : 1) * (s.crunch ? 1.05 : 1);
      const starPay = sum(s.stars.map((x) => x.salary)) * s.payPolicy;
      lw.cost.salary = payroll + starPay;
      lw.cost.office = D.OFFICES[s.office].rent;
      lw.cost.dc = D.DATACENTERS[s.dc].upkeep;
      lw.cost.power = this.powerCost();
      lw.cost.ops = rev * this.opsRate();
      lw.cost.rent = lw.rentEq * this.rentPrice();
      lw.cost.mkt = D.MARKETING[s.marketing] || 0;
      lw.cost.fine = 0;
      if (s.reg >= 70) lw.cost.fine = Math.max(5e4, rev * 0.03);
      lw.exp = sum(Object.values(lw.cost));
      s.cash += rev - lw.exp;
      s.revHist.push(rev); if (s.revHist.length > 30) s.revHist.shift();
      // 人事、研究、資料
      this.updateStaff(lw);
      this.updateResearch(lw);
      this.progressResearch();
      this.updateData();
      this.updateMeters(lw);
      this.checkIncidents(lw);
      this.updateValuation();
      this.checkAchievements();
      this.chronWeek();
      if (ymOf(s.week) !== ymOf(s.week - 1)) this.monthly();
      this.raceWeek();
      this.runEvents();
      this.checkQuests();
      this.checkEnd();
    }

    updateBuilds() {
      const s = this.s;
      if (s.dcBuild && s.week >= s.dcBuild.done) { s.dc = s.dcBuild.lv; s.dcBuild = null; this.log('🏭 「' + D.DATACENTERS[s.dc].name + '」完工啟用！機房槽位 ' + fmtNum(this.dcSlots()), 'good'); }
      if (s.officeBuild && s.week >= s.officeBuild.done) { s.office = s.officeBuild.lv; s.officeBuild = null; this.log('🏢 搬進了「' + D.OFFICES[s.office].name + '」，人數上限 ' + this.officeCap(), 'good'); }
    }

    progressJobs(lw) {
      const s = this.s;
      for (const j of s.jobs.slice()) {
        if (j.kind === 'synth') {
          j.done += j.gpus;
          if (j.done >= j.total) {
            const rate = 0.55 * (1 + this.yrs * 0.25) * this.techProd('synth');
            const amt = j.total * rate;
            this.addData(j.pool, amt, j.q);
            s.jobs = s.jobs.filter((x) => x !== j);
            this.log('🧬 合成資料完成：' + D.DATA_POOLS[j.pool].name + ' +' + fmtTokens(amt) + '（品質 ' + Math.round(j.q * 100) + '）', 'good');
          }
          continue;
        }
        const a = ARCH[j.spec.arch];
        const per = j.gpus * (lw.trainFrac == null ? 1 : lw.trainFrac) * B.H100_WEEK_FLOPS * this.mfu() * a.mfu * this.mod('trainSpeed') * (s.crunch ? 1.12 : 1) * (j.slow || 1);
        j.slow = 1;
        j.done += per; j.eta = (j.total - j.done) / per;
        // 故障
        const pf = 0.014 * Math.pow(j.gpus / 1000, 0.35) * a.risk * this.techProd('fail') * this.techProd('risk') * (1.3 - 0.5 * Math.min(1, this.engCoverage())) * (s.crunch ? 1.25 : 1) * (1 - 0.3 * Math.min(1, this.starBonus('infra')));
        if (j.done < j.total && this.rand() < pf && !s.pending.length) {
          s.pending.push({ sys: 'fail', job: j.id, kind: this.rand() < 0.5 ? 'spike' : 'hw' });
        }
        if (j.done >= j.total) this.finishJob(j);
      }
    }
    finishJob(j) {
      const s = this.s; s.jobs = s.jobs.filter((x) => x !== j);
      const sp = j.spec; sp.penalty = j.penalty || 0;
      const ev = this.evalSpec(sp, { excludeJob: j.id });
      const luck = 1 + this.randn() * 0.025;
      const stats = {};
      for (const k of D.STAT_ORDER) stats[k] = clamp(ev.stats[k] * (k === 'safety' ? 1 + this.randn() * 0.02 : luck * (1 + this.randn() * 0.02)), 0, k === 'safety' ? 99 : 135);
      const m = {
        id: s.nextId++, name: sp.name, arch: sp.arch, size: sp.size, act: ev.Nact, tokens: sp.tokens,
        stats, comp0: this.composite(stats), S0: ev.S0, w: s.week, costRatio: ev.costRatio,
        spec: { mix: sp.mix, post: sp.post, alloc: sp.alloc, teacher: sp.teacher || null }, rel: null, lastRev: 0, totRev: 0,
        diag: { ratio: ev.ratio, epochs: ev.epochs, Q: ev.Q, eta: ev.eta, Neff: ev.Neff, distill: ev.distill, penalty: sp.penalty, inst: s.data.inst, front: this.frontierComp() },
      };
      s.models.push(m); s.stat.trained++;
      if (!s.archExp[sp.arch]) {
        s.archExp[sp.arch] = s.week; const bonus = Math.round(40 * (1 + this.yrs));
        if (s.stat.trained > 1) { s.rp += bonus; this.log('💡 首次駕馭「' + ARCH[sp.arch].name + '」，團隊累積了寶貴經驗：研究點 +' + bonus, 'good'); }
      }
      this.unlockAch('first_model');
      if (sp.arch !== 'dense') this.unlockAch('moe');
      if (sp.size >= 1000) this.unlockAch('trillion');
      if (sp.size <= 14 && m.comp0 >= 70) this.unlockAch('tiny_giant');
      if (stats.reason >= 80) this.unlockAch('reasoner');
      if (stats.agent >= 70) this.unlockAch('agent');
      this.log('🎓 ' + m.name + ' 訓練完成！綜合分 ' + m.comp0.toFixed(1) + '，等待你決定是否發布。', 'good');
      s.pending.push({ sys: 'trained', model: m.id });
    }

    /* ---------- 市場 ---------- */
    segActive(k) { return this.ym >= D.SEGMENTS[k].from; }
    segValue(k) {
      const g = D.SEGMENTS[k]; if (!this.segActive(k)) return 0;
      const y = Math.max(0, yearsSince(this.s.week, g.from));
      const ramp = Math.min(1, 0.35 + y * 1.3);
      const y0 = yearsSince(TOTAL_WEEKS, g.from); const ye = y <= y0 ? y : y0 + (y - y0) * 0.35; // 2030 年後成長放慢
      return g.v0 * Math.pow(g.g, ye) * ramp * (this.s.demandMul[k] || 1) * this.mod('demand_' + k);
    }
    refPrice(k) { const g = D.SEGMENTS[k]; return g.ref0 * Math.pow(g.refDecay, this.yrs); }
    playerEligible(m, k) {
      const g = D.SEGMENTS[k];
      if (g.tech && !this.has(g.tech)) return false;
      if (g.minStat) for (const st in g.minStat) if ((m.stats[st] || 0) < g.minStat[st]) return false;
      if (k === 'creative' && (m.stats.mm || 0) < 10) return false;
      return true;
    }
    fit(stats, k) { const w = D.SEGMENTS[k].w; let f = 0; for (const st in w) f += w[st] * (stats[st] || 0); return f; }
    /* 賣點：兩項屬性同時達標（門檻相對當前前沿 F） */
    badgesFor(stats, costRatio, F) {
      if (F == null) F = this._front != null ? this._front : this.frontierComp();
      const out = [];
      for (const b of D.BADGES) {
        let tier = -1;
        for (let t = D.BADGE_TIERS.length - 1; t >= 0; t--) {
          const T = D.BADGE_TIERS[t];
          let ok;
          if (b.special === 'value') ok = costRatio != null && costRatio <= [0.12, 0.06, 0.03][t] && this.composite(stats) >= F * [0.85, 0.9, 0.95][t];
          else if (b.abs) ok = (stats[b.a] || 0) >= b.abs[t] && (stats[b.b] || 0) >= F * T.b;
          else ok = (stats[b.a] || 0) >= F * T.a && (stats[b.b] || 0) >= F * T.b;
          if (ok) { tier = t; break; }
        }
        if (tier >= 0) out.push({ id: b.id, name: b.name, icon: b.icon, tier, tierName: D.BADGE_TIERS[tier].name, mul: D.BADGE_TIERS[tier].mul, seg: b.seg });
      }
      return out;
    }
    badgeUtil(badges, k) { let u = 0; for (const b of badges) if (b.seg[k]) u += b.seg[k] * b.mul; return u; }
    // 模型老化：上線太久，客戶開始流失（每年少一點吸引力），逼著公司一直推新一代
    modelStale(m) { if (!m.rel) return 0; const a = (this.s.week - m.rel.w) * 7 / 365.25 - B.STALE_FROM; return a <= 0 ? 0 : Math.min(B.STALE_MAX, a * B.STALE) * this.techProd('fresh'); }
    products(k) {
      const s = this.s; const out = [];
      for (const rid in s.rivals) {
        const R = RIVAL[rid]; const rv = s.rivals[rid];
        const live = rv.models.slice(-2);
        for (const m of live) {
          if (k === 'creative' && (m.stats.mm || 0) < 20) continue;
          if (k === 'agent' && (m.stats.agent || 0) < 20) continue;
          if (k === 'robot' && this.ym < '2027-06') continue;
          if (R.open && k === 'ent') continue;
          let price = rv.priceMul; if (k === 'chat' && R.freeChat) price = 0.15;
          if (R.open && k === 'chat') price = 0.5;
          let u = (R.dist[k] || 0) * Math.max(B.RIVAL_DIST_MIN, 1 - 0.09 * this.yrs) + B.RIVAL_BRAND * this.pressRamp();
          if (R.open && k === 'api') u -= 0.6;
          if (!m.badges || m._bw !== s.week) { m.badges = this.badgesFor(m.stats, null); m._bw = s.week; }
          u += this.badgeUtil(m.badges, k);
          out.push({ key: 'r' + rid + ':' + m.v, stats: m.stats, price, util: u, rival: rid });
        }
      }
      const plan = k === 'chat' ? this.planFx() : null;
      for (const m of s.models) {
        if (!m.rel || m.rel.retired || !this.playerEligible(m, k)) continue;
        const pt = D.PRICE_TIERS.find((p) => p.id === m.rel.price) || D.PRICE_TIERS[2];
        let u = B.REP_UTIL * s.rep;
        if (plan) u += plan.util;
        if (k === 'chat' || k === 'creative') u += 0.22 * Math.log(1 + (D.MARKETING[s.marketing] || 0) / Math.max(30000, this.segValue(k) * B.MKT_REF)) + 0.25 * this.starBonus('product_genius');
        if (k === 'chat' && this.has('t_voice')) u += 0.4;
        if (k === 'creative' && this.has('t_video')) u += 0.5;
        if (k === 'ent') u += 0.18 * Math.log(1 + this.roleHeads('biz')) - (this.has('t_comply') ? 0 : 1.2) - (1 - s.rep / 100) * 0.8;
        if (k === 'api' || k === 'coding') u += 0.006 * s.community + (m.rel.open ? 0.2 : 0);
        if (!m.badges || m._bw !== s.week) { m.badges = this.badgesFor(m.stats, m.costRatio); m._bw = s.week; }
        u += this.badgeUtil(m.badges, k);
        if (s.rfpBoost && s.rfpBoost > s.week && k === 'ent') u += 0.3;
        u += this.techSeg(k) - this.modelStale(m);
        out.push({ key: 'p' + m.id, stats: m.stats, price: plan ? plan.price : pt.m, util: u, player: m.id });
      }
      return out;
    }
    // 一個市場的穩定市佔：各產品的吸引力換算成比例，還有一部分客戶誰都不買
    segTargets(k, ps) {
      const g = D.SEGMENTS[k];
      let maxFit = 0; for (const p of ps) { p.fit = this.fit(p.stats, k); if (p.fit > maxFit) maxFit = p.fit; }
      const uA = B.UTIL_A * (1 + B.UTIL_RAMP * Math.max(0, this.yrs - 1));
      const us = ps.map((p) => {
        const gap = maxFit - p.fit;
        return uA * p.fit - 0.05 * Math.pow(Math.max(0, gap - 6), 1.6) + p.util - g.beta * Math.log(Math.max(0.05, p.price));
      });
      const u0 = uA * (maxFit - B.OUTSIDE_GAP);
      const mx = Math.max(u0, ...us);
      const ex = us.map((u) => Math.exp(u - mx)); const e0 = Math.exp(u0 - mx); const tot = e0 + sum(ex);
      return { maxFit, targets: ex.map((x) => x / tot) };
    }
    computeMarket(init) {
      const s = this.s;
      this._front = this.frontierComp();
      for (const k of D.SEG_ORDER) {
        const mk = s.market[k];
        if (!this.segActive(k)) { mk.shares = {}; mk.frontier = 0; continue; }
        const ps = this.products(k);
        if (!ps.length) { mk.shares = {}; continue; }
        const T = this.segTargets(k, ps);
        mk.frontier = T.maxFit;
        const ns = {};
        ps.forEach((p, i) => {
          const target = T.targets[i]; const prev = mk.shares[p.key] || 0;
          ns[p.key] = init ? target : prev + (target - prev) * (p.player ? 0.04 + 0.12 * s.rep / 100 : 0.35);
        });
        mk.shares = ns;
      }
    }
    inferNeed() {
      const s = this.s; let need = 0; const rp = this.rentPrice();
      for (const m of s.models) {
        if (!m.rel || m.rel.retired) continue;
        let cr = m.costRatio * (this.has('t_ttc') && m.stats.reason > 60 ? 1 : 1);
        for (const k of D.SEG_ORDER) { const sh = s.market[k].shares['p' + m.id] || 0; if (sh) need += sh * this.segValue(k) * cr / rp * (k === 'chat' ? this.chatLoad() : 1); }
      }
      return need;
    }
    playerShare(k) { let t = 0; const sh = this.s.market[k].shares; for (const key in sh) if (key[0] === 'p') t += sh[key]; return t; }
    rivalShare(rid, k) { let t = 0; const sh = this.s.market[k].shares; for (const key in sh) if (key.indexOf('r' + rid + ':') === 0) t += sh[key]; return t; }
    chatUsers() { const k = 'chat'; const V = this.segValue(k); const ref = this.refPrice(k); return this.playerShare(k) * V / (ref / 4.33) * 9; }
    avgRevenue() { const h = this.s.revHist.slice(-4); return h.length ? sum(h) / h.length : 0; }
    weeklyExpense() { return this.s.lastWeek ? this.s.lastWeek.exp : 1e5; }
    // 電費：裝進機房的卡，效能越高越耗電，電價逐年上升
    powerCost() {
      const sorted = this.s.gpus.slice().sort((a, b) => GPU[b.type].pf - GPU[a.type].pf);
      let slots = this.dcSlots(); let c = 0;
      for (const g of sorted) { const n = Math.min(g.n, slots); c += n * Math.pow(GPU[g.type].pf, B.POWER_EXP); slots -= n; if (slots <= 0) break; }
      return c * B.OPEX_PER_CARD * (1 + B.POWER_INFL * this.yrs) * this.techProd('power');
    }
    // 營運成本（客服、業務、合規、授權費）佔營收的比例，公司越大、市場越成熟越高
    opsRate() { return clamp(B.OPS0 + B.OPS_GROW * this.yrs, 0, B.OPS_MAX) * ((this.scen() || {}).ops == null ? 1 : this.scen().ops); }

    /* ---------- 排行榜 ---------- */
    leaderboard() {
      const s = this.s; const rows = [];
      for (const rid in s.rivals) {
        const R = RIVAL[rid];
        for (const m of s.rivals[rid].models.slice(-2)) rows.push({ name: m.name, org: R.name, icon: R.icon, color: R.color, comp: this.composite(m.stats), stats: m.stats, open: R.open, rival: rid, w: m.w });
      }
      for (const m of s.models) if (m.rel && !m.rel.retired) rows.push({ name: m.name, org: s.company, icon: this.mascot().icon, comp: this.composite(m.stats), stats: m.stats, open: m.rel.open, player: m.id, w: m.rel.w });
      rows.sort((a, b) => b.comp - a.comp);
      return rows;
    }
    rankOf(m) { const lb = this.leaderboard(); const c = this.composite(m.stats); return 1 + lb.filter((r) => r.comp > c + 1e-9 && r.player !== m.id).length; }
    bestRank() { const lb = this.leaderboard(); const i = lb.findIndex((r) => r.player); return i < 0 ? 99 : i + 1; }
    frontierComp() { let f = 0; for (const rid in this.s.rivals) for (const m of this.s.rivals[rid].models.slice(-2)) f = Math.max(f, this.composite(m.stats)); return f; }
    // 目前握有前沿模型的對手（評論裡的 {rival}）
    frontRival() { let id = 'sky', f = -1; for (const rid in this.s.rivals) for (const m of this.s.rivals[rid].models.slice(-2)) { const c = this.composite(m.stats); if (c > f) { f = c; id = rid; } } return id; }

    /* ---------- 對手 ---------- */
    // 中後期壓力的進度：2023 年底起爬升，2026 年初滿；開局的 press 決定對手多難纏
    pressRamp(w) { const t = clamp((years(w == null ? this.s.week : w) - 0.8) / 2.2, 0, 1); return t * t * (3 - 2 * t) * ((this.scen() || {}).press == null ? 1 : this.scen().press); }
    rivalComp(R, w) { const y = yearsSince(w, R.start); return R.c0 + R.slope * Math.pow(Math.max(0, y), 0.97) + B.RIVAL_PRESS * this.pressRamp(w); }
    updateRivals(init) {
      const s = this.s;
      for (const R of D.RIVALS) {
        const rv = s.rivals[R.id];
        if (this.ym < R.start) continue;
        if (init && rv.models.length === 0 && s.week >= rv.next) { this.rivalRelease(R, true); continue; }
        if (s.week >= rv.next) this.rivalRelease(R, false);
      }
    }
    rivalRelease(R, quiet) {
      const s = this.s; const rv = s.rivals[R.id];
      let c = this.rivalComp(R, s.week) + this.randn() * 1.2 + rv.boost;
      rv.boost *= 0.5;
      const ym = this.ym;
      const w = this.eraWeights();
      // 依專長分配能力，再縮放到目標綜合分
      const st = {};
      for (const k of D.STAT_ORDER) st[k] = c * (R.prof[k] || 1);
      if (ym < R.reasonFrom) st.reason *= 0.8;
      if (ym < R.agentFrom) st.agent = 0; else st.agent *= Math.min(1, 0.6 + yearsSince(s.week, R.agentFrom) * 0.25);
      if (ym < R.mmFrom) st.mm = 0;
      st.ctx = 25 + 0.5 * c + Math.max(0, yearsSince(s.week, '2023-06')) * 6 * (R.prof.ctx || 1);
      st.safety = clamp(40 + c * 0.45 * (R.prof.safety || 1) + yearsSince(s.week, '2023-01') * 2, 20, 97);
      let cur = 0; for (const k in w) cur += w[k] * (st[k] || 0);
      const scale = c / Math.max(1, cur);
      for (const k of D.STAT_ORDER) if (k !== 'safety' && k !== 'ctx') st[k] = clamp(st[k] * scale, 0, 135);
      rv.ver++;
      const major = { sky: 4, mono: 1, beacon: 2, star: 2, hive: 1, gale: 1 }[R.id] || 1;
      const vname = R.series + '-' + (major + Math.floor((rv.ver - 1) / 2)) + ((rv.ver - 1) % 2 ? '.5' : '');
      const m = { name: vname, v: rv.ver, stats: st, w: s.week };
      rv.models.push(m); if (rv.models.length > 4) rv.models.shift();
      let cad = R.cadence * (0.8 + this.rand() * 0.4);
      if (this.bestRank() === 1 && (R.id === 'sky' || R.id === 'gale' || R.id === 'beacon')) cad *= 0.75;
      rv.next = s.week + Math.round(cad);
      if (!quiet) {
        const myBest = this.bestModel(); const mc = myBest ? this.composite(myBest.stats) : 0;
        this.log(R.icon + ' ' + R.name + ' 發布 ' + vname + (R.open ? '（開源）' : '') + '，綜合分 ' + this.composite(st).toFixed(1) + (mc ? (mc >= this.composite(st) ? '，你仍領先它' : '，超過了你的最佳模型') : ''), 'rival');
      }
    }
    priceWar() {
      const s = this.s;
      for (const k of ['api', 'chat']) {
        if (!this.segActive(k)) continue;
        const ps = this.playerShare(k); if (ps < 0.25) continue;
        const cheap = s.models.some((m) => m.rel && !m.rel.retired && (m.rel.price === 'low' || m.rel.price === 'free') && (s.market[k].shares['p' + m.id] || 0) > 0.1);
        if (!cheap || this.rand() > 0.35) continue;
        const pool = D.RIVALS.filter((R) => !R.open && this.ym >= R.start);
        const R = this.pick(pool); const rv = s.rivals[R.id];
        rv.priceMul = Math.max(0.3, rv.priceMul * 0.78);
        this.log('⚔️ 價格戰！' + R.name + ' 宣布 ' + D.SEGMENTS[k].name + ' 全面降價 22%，劍指 ' + s.company + '。', 'rival');
      }
      // 對手價格緩慢回升
      for (const R of D.RIVALS) { const rv = s.rivals[R.id]; rv.priceMul += (R.price - rv.priceMul) * 0.03; }
    }

    /* ---------- 發布之後：網友評論、對手回應、首月成績 ---------- */
    // 網友與媒體評論（k: 'buzz'，純文字）：依綜合分相對前沿（領先／持平／落後）、定價、是否開源挑 2～4 則，
    // 發布當下先出一半，下一週再出其餘。文案在 content.js 的 ME_BUZZ
    releaseBuzz(m, c, F) {
      const s = this.s; const all = root.ME_BUZZ || []; if (!all.length) return;
      const ctx = { tier: c >= F + 1 ? 'lead' : c >= F - 4 ? 'par' : 'behind', price: m.rel.price, open: !!m.rel.open };
      const cand = all.filter((b) => this.buzzOk(b.cond, ctx));
      const recent = s.buzzRecent || (s.buzzRecent = []);
      const n = 2 + (this.frand() < 0.5 ? 1 : 0) + (ctx.tier === 'lead' && this.frand() < 0.5 ? 1 : 0);
      const picks = [];
      while (picks.length < n && cand.length) {
        // 條件越具體越容易被挑中；最近用過的降低機率，避免每次都同一批
        const ws = cand.map((b) => (1 + 1.5 * Object.keys(b.cond || {}).length) * (recent.indexOf(b.id) >= 0 ? 0.15 : 1));
        let r = this.frand() * sum(ws), i = 0;
        while (i < cand.length - 1 && (r -= ws[i]) > 0) i++;
        picks.push(cand.splice(i, 1)[0]);
      }
      const rid = this.frontRival(); const now = Math.ceil(picks.length / 2);
      picks.forEach((b, i) => {
        if (i < now) this.logBuzz(b, m, rid); else s.reactQ.push({ w: s.week + 1, kind: 'buzz', id: b.id, model: m.id, rival: rid });
        recent.push(b.id);
      });
      if (recent.length > 12) recent.splice(0, recent.length - 12);
    }
    buzzOk(c, ctx) {
      if (!c) return true;
      if (c.tier && (Array.isArray(c.tier) ? c.tier.indexOf(ctx.tier) < 0 : c.tier !== ctx.tier)) return false;
      if (c.price && c.price.indexOf(ctx.price) < 0) return false;
      if (c.open != null && c.open !== ctx.open) return false;
      return true;
    }
    logBuzz(b, m, rid) {
      const who = (root.ME_BUZZ_WHO || {})[b.who] || ['💬', '網友'];
      this.log(who[0] + ' ' + who[1] + '：「' + this.flavor(b.text, m, rid) + '」', 'buzz', { model: m.id });
    }
    // 新模型超過某家對手的最新模型時，那家對手有機會在 1～2 週後回應（k: 'rival'）：
    // 提前發布、降價、加碼下一代，或只是發聲明。回應與效果在 content.js 的 ME_RIVAL_REACT
    rivalReact(m, c, prevBest) {
      const s = this.s; if (!(root.ME_RIVAL_REACT || []).length) return;
      let R = null, rc = -1;
      for (const x of D.RIVALS) {
        const rv = s.rivals[x.id]; const last = rv.models[rv.models.length - 1]; if (!last) continue;
        const lc = this.composite(last.stats);
        // 原本不輸我們上線中的最佳模型、這次被新模型超過的對手；同一家半年內只回應一次
        if (lc < c && lc >= prevBest && lc > rc && !(rv.reactW != null && s.week - rv.reactW < 26)) { R = x; rc = lc; }
      }
      if (!R) return;
      if (this.rand() >= (rc >= this.frontierComp() - 1e-9 ? 0.75 : 0.5)) return; // 被拉下前沿寶座的那家更想回應
      s.rivals[R.id].reactW = s.week;
      s.reactQ.push({ w: s.week + 1 + (this.rand() < 0.5 ? 1 : 0), kind: 'rival', rival: R.id, model: m.id });
    }
    processReactions() {
      const s = this.s; const due = s.reactQ.filter((q) => q.w <= s.week); if (!due.length) return;
      s.reactQ = s.reactQ.filter((q) => q.w > s.week);
      for (const q of due) {
        const m = s.models.find((x) => x.id === q.model); if (!m || !m.rel) continue;
        if (q.kind === 'buzz') { const b = (root.ME_BUZZ || []).find((x) => x.id === q.id); if (b) this.logBuzz(b, m, q.rival); }
        else if (q.kind === 'rival') this.applyReact(q.rival, m);
      }
    }
    applyReact(rid, m) {
      const s = this.s; const R = RIVAL[rid]; const rv = s.rivals[rid]; if (!R || !rv) return;
      const list = (root.ME_RIVAL_REACT || []).filter((x) => (!x.who || x.who.indexOf(rid) >= 0) && this.reactOk(x.cond, m));
      const x = this.weighted(list, (y) => y.weight || 1); if (!x) return;
      const fx = x.effect || {};
      if (fx.rush) rv.next = Math.min(rv.next, s.week + fx.rush[0] + Math.floor(this.rand() * (fx.rush[1] - fx.rush[0] + 1)));
      if (fx.price) rv.priceMul = Math.max(0.3, rv.priceMul * fx.price);
      if (fx.boost) rv.boost += fx.boost;
      this.log(R.icon + ' ' + this.flavor(x.text, m, rid), 'rival', { model: m.id, rival: rid, react: x.id });
    }
    reactOk(c, m) {
      if (!c) return true;
      if (c.open != null && c.open !== !!m.rel.open) return false;
      if (c.price && c.price.indexOf(m.rel.price) < 0) return false;
      if (c.maxSafety != null && (m.stats.safety || 0) > c.maxSafety) return false;
      return true;
    }
    // 發布後前 4 週每週記一筆 { w, rev, rank, share }（給首月戰報），第 4 週結束時評級
    trackReleases() {
      const s = this.s;
      for (const m of s.models) {
        const r = m.rel; if (!r || r.retired || !Array.isArray(r.track) || r.track.length >= 4 || s.week <= r.w) continue;
        const share = {};
        for (const k of D.SEG_ORDER) { const v = s.market[k].shares['p' + m.id] || 0; if (v >= 1e-4) share[k] = Math.round(v * 1e4) / 1e4; }
        r.track.push({ w: s.week, rev: m.lastRev || 0, rank: this.rankOf(m), share });
        if (r.track.length === 4) this.gradeRelease(m);
      }
    }
    // 評級看實力與營收兩件事，標準見檔案開頭的 GRADE；名次只記錄（開局對手少，名次會虛高）
    gradeRelease(m) {
      const s = this.s; const r = m.rel; const t = r.track;
      const peak = Math.min(r.rank0 || 99, ...t.map((x) => x.rank));
      let mkt = 0; for (const k of D.SEG_ORDER) if (this.segActive(k) && this.playerEligible(m, k)) mkt += this.segValue(k);
      const ms = mkt > 0 ? sum(t.map((x) => x.rev)) / t.length / mkt : 0;
      const early = Math.max(0, 1 - years(r.w) / 2);
      const gap = (r.gap0 != null ? r.gap0 : 0) + GRADE.earlyGap * early;
      const power = GRADE.gap.filter((x) => gap >= x).length;
      const rev = GRADE.rev.filter((x) => ms * (1 + GRADE.earlyRev * early) >= x).length;
      const pts = power + rev;
      const grade = pts >= GRADE.S ? 'S' : pts >= GRADE.A ? 'A' : pts >= GRADE.B ? 'B' : 'C';
      // 評語：開源、免費、叫好不叫座、叫座不叫好、第一個模型各有專屬說法，其餘照評級
      const first = !s.models.some((x) => x !== m && x.rel && (x.rel.w < r.w || (x.rel.w === r.w && x.id < m.id)));
      let kind = grade;
      if (grade !== 'S') {
        if (r.open && rev <= 1) kind = 'open';
        else if (r.price === 'free' && rev <= 1) kind = 'free';
        else if (power >= 3 && rev <= 1) kind = 'rank';
        else if (rev >= 3 && power <= 1) kind = 'rev';
        else if (first && (grade === 'B' || grade === 'C')) kind = 'first';
      }
      const N = root.ME_REL_NOTES || {}; const pool = N[kind] && N[kind].length ? N[kind] : N[grade] || [];
      r.grade = grade; r.pts = { power, rev }; r.peak = peak; r.mkt = Math.round(ms * 1e4) / 1e4;
      r.note = pool.length ? this.flavor(pool[Math.floor(this.frand() * pool.length)], m) : '';
      // C 也只用一般資訊：第一個模型常拿 C，不必標成警示
      this.log('📊 ' + m.name + ' 首月成績：' + grade + (r.note ? '。' + r.note : ''), grade === 'S' || grade === 'A' ? 'good' : 'info', { model: m.id, grade });
    }

    /* ---------- 人事更新 ---------- */
    updateStaff(lw) {
      const s = this.s; let rankBonus = 0; const rk = this.bestRank();
      if (rk <= 3) rankBonus = 8; else if (rk <= 10) rankBonus = 3;
      const target = 60 + 26 * (s.payPolicy - 1) + rankBonus - (s.crunch ? 18 : 0) + (s.trainProg ? 4 : 0) - (s.cash < 0 ? 15 : 0) + (this.totalStaff() > this.officeCap() ? -10 : 0);
      s.morale = clamp(s.morale + (target - s.morale) * 0.08, 0, 100);
      if (s.morale < 45) {
        const p = (45 - s.morale) / 45 * 0.012;
        for (const r of D.ROLE_ORDER) {
          const gone = this.people(r).filter(() => this.rand() < p); // 每人抽一次，跟舊版的亂數次數相同
          if (gone.length) { this.removePeople(gone); this.log('🚪 士氣低落，' + gone.length + ' 位' + D.ROLES[r].name + peopleNames(gone) + '離職了。', 'bad'); }
        }
        if (s.stars.length && s.morale < 30 && this.rand() < 0.02) this.starLeave(null, '受不了公司的氣氛');
      }
      const grow = 0.012 + (s.trainProg ? 0.05 : 0) + 0.03 * this.starBonus('mentor');
      const g2 = grow * (1 + (s.crunch ? 0.3 : 0));
      for (const p of s.people) if (p.skill < 88) p.skill += g2;
      this.syncStaff();
      if (this.starBonus('celebrity') > 0) s.rep = clamp(s.rep + 0.03 * this.starBonus('celebrity'), 0, 100);
    }
    updateResearch(lw) {
      const s = this.s; const st = s.staff.res;
      const heads = this.roleHeads('res');
      let rp = Math.pow(heads, B.RP_EXP) * B.RP_PER_RES * Math.pow(st.skill / 50, 1.2) * this.prodMul() * this.mod('rpMul') * this.techProd('rpMul');
      lw.rpIdle = Math.min(lw.idle * B.IDLE_RP * (1 + this.yrs * 0.3), rp * 0.5);
      rp += lw.idle > 0 ? lw.rpIdle : 0;
      rp += s.community * 0.15;
      s.rp += rp; s.rpTotal += rp; lw.rp = rp;
    }
    updateData() {
      const s = this.s; const pm = this.prodMul();
      if (s.crawl) {
        const h = this.roleHeads('data'); const aggr = s.crawlAggr ? 1.7 : 1;
        const webAdd = h * 28 * aggr * pm; const codeAdd = h * 4.5 * aggr * pm; const mmAdd = this.has('t_vision') ? h * 40 * aggr * pm : 0;
        const add = (k, a) => { const room = Math.max(0, this.poolCap(k) - s.data[k].amt); if (room > 0) this.addData(k, Math.min(room, a), D.DATA_POOLS[k].q); };
        add('web', webAdd); add('code', codeAdd); add('mm', mmAdd);
        if (s.crawlAggr) { s.data.risk = clamp(s.data.risk + 0.0025, 0, 1); s.reg = clamp(s.reg + 0.06, 0, 100); }
      }
      if (s.userData) {
        const u = this.chatUsers();
        if (u > 0) { s.data.inst += Math.min(30, u / 2e6); this.addData('web', Math.min(200, u / 5e5), 0.62); s.reg = clamp(s.reg + 0.1, 0, 100); s.rep = clamp(s.rep - 0.02, 0, 100); }
      }
      s.data.risk = Math.max(0, s.data.risk - 0.0008 - this.techSum('riskDecay'));
    }
    updateMeters(lw) {
      const s = this.s;
      const decay = B.REG_DECAY * (1 + this.techSum('regDecay') + 0.25 * this.starBonus('safety_mom')) * (this.city().regDecay || 1);
      s.reg = clamp(s.reg - decay * (s.reg > 0 ? 1 : 0), 0, 100);
      if (this.bestRank() === 1) s.reg = clamp(s.reg + 0.08, 0, 100);
      // 技術越強，政府越關注：監管壓力有一條逐年上升的底線，領先的公司更受注意
      const regF = clamp(B.REG_FLOOR * (this.yrs - 3), 0, B.REG_FLOOR_MAX) * (this.bestRank() <= 3 ? 1 : 0.6) - 10 * this.techSum('regDecay');
      if (s.reg < regF) s.reg = clamp(s.reg + 0.3, 0, 100);
      s.community = clamp(s.community - 0.06 + (s.models.some((m) => m.rel && m.rel.open && !m.rel.retired) ? 0.05 : 0) + 0.04 * this.starBonus('open_evang') + this.techSum('community'), 0, 100);
      // 聲望會慢慢回到「實力應得」的水準：模型離前沿越近、社群越大，應得聲望越高
      const best = this.bestModel(); const F = this.frontierComp() || 50;
      const bc = best ? this.composite(best.stats) : 0;
      const target = 12 + 55 * clamp((bc - (F - 25)) / 25, 0, 1.15) + s.community * 0.15 + Math.min(10, (s.rfpDone || 0) * 1.5);
      s.rep = clamp(s.rep + (target - s.rep) * 0.012, 0, 100);
      // 現金
      if (s.cash < 0) { if (!s.stat.negWeeks && (s.chronNegW == null || s.week - s.chronNegW >= 26)) { s.chronNegW = s.week; this.chron('crisis', '現金轉為負數', 7); } s.stat.negWeeks++; s.stat.wasNeg = true; } else s.stat.negWeeks = 0;
      s.stat.maxGpu = Math.max(s.stat.maxGpu, this.ownedEq());
      // 資料訴訟
      if (s.data.risk > 0.05 && this.rand() < s.data.risk * 0.012) {
        const fine = Math.max(1e6, this.avgRevenue() * 3);
        s.cash -= fine; s.rep = clamp(s.rep - 3, 0, 100); s.data.risk *= 0.6;
        this.log('⚖️ 版權方提告訓練資料侵權，和解金 ' + fmtMoney(fine) + '。', 'bad'); this.chron('crisis', '資料侵權訴訟和解，賠了 ' + fmtMoney(fine), 7);
      }
      // 監管懲罰
      if (s.reg >= 95 && !s.flags.suspended) {
        s.flags.suspended = s.week + 4; this.addMod('revenueMul', 0.15, 4); s.reg = 65;
        this.log('⛔ 監管機關勒令 ' + s.company + ' 全線產品暫停 4 週整改！', 'bad'); this.chron('crisis', '被監管機關勒令全線暫停 4 週', 8);
      }
    }
    checkIncidents(lw) {
      const s = this.s; if (!lw.rev || s.pending.length) return;
      let ws = 0, wsum = 0; for (const m of s.models) if (m.rel && !m.rel.retired) { ws += (m.lastRev || 0) * m.stats.safety; wsum += m.lastRev || 0; }
      const S = wsum > 0 ? ws / wsum : 70;
      const best = this.bestModel(); const cap = best ? this.composite(best.stats) : 40;
      const raceRisk = s.race ? 1 + s.race.risk / 100 : 1;
      const p = clamp(raceRisk * B.INCIDENT_BASE * Math.pow(1 + lw.rev / 1e6, 0.33) * Math.pow((100 - S) / 50, 2) * (cap / 60) * this.techProd('incident') * this.mod('incidentRisk') * (this.has('t_selfimprove') && !this.has('t_oversight') ? 1.6 : 1), 0, 0.2);
      if (this.rand() < p) {
        const cands = this.EVENTS.filter((e) => e.cat === 'safety' && !e.chainOnly && this.eventOk(e));
        s.stat.incidents++;
        if (cands.length) { const e = this.weighted(cands, (x) => x.weight || 1); this.queueEvent(e); }
        else { s.rep = clamp(s.rep - 4, 0, 100); s.reg = clamp(s.reg + 10, 0, 100); this.log('🚨 安全事故：模型被越獄產生有害內容，截圖在社群瘋傳。', 'bad'); this.chron('crisis', '模型被越獄的截圖在社群瘋傳', 7); }
      }
    }

    /* ---------- 估值 ---------- */
    updateValuation() {
      const s = this.s; const rev = this.avgRevenue() * 52;
      const y = this.yrs;
      const mult = y < 3 ? 22 : y < 5 ? 15 : 10;
      const old = s.revHist.length >= 26 ? sum(s.revHist.slice(0, 4)) / 4 : 0;
      const growth = old > 0 ? clamp(Math.pow(this.avgRevenue() / old, 0.4), 0.7, 1.6) : 1.1;
      const revVal = rev * mult * growth * (this.bestRank() <= 3 ? 1 : this.bestRank() <= 6 ? 0.8 : 0.6); // 掉出第一梯隊，市場給的倍數也掉
      const best = this.bestModel(); const bc = best ? this.composite(best.stats) : 25;
      const rk = this.bestRank();
      const rankMul = rk === 1 ? 3 : rk <= 3 ? 2 : rk <= 5 ? 1.5 : rk <= 10 ? 1.2 : 1;
      const techVal = 30e6 * Math.exp(0.12 * (bc - 35)) * rankMul;
      let gpuVal = 0; for (const g of s.gpus) gpuVal += g.n * this.gpuPrice(g.type) * 0.6;
      const hype = y < 1 ? 1.1 : y < 4 ? 1.2 : y < 6 ? 1.05 : 1;
      let v = (Math.max(revVal, techVal) + 0.5 * Math.min(revVal, techVal) + Math.max(0, s.cash) + gpuVal) * (0.6 + 0.6 * s.rep / 100) * hype * this.mod('valuation') * (1 + 0.12 * this.starBonus('fundraiser')) * this.techProd('val');
      if (s.scenario === 'spinoff') v *= 1.1;
      s.valuation = Math.max(1e6, v);
      if (s.valuation >= 1e9) this.unlockAch('unicorn');
      if (s.valuation >= 1e10) this.unlockAch('decacorn');
      if (s.valuation >= 1e12) this.unlockAch('trillion_val');
    }

    /* ---------- 每月 ---------- */
    monthly() {
      const s = this.s;
      this.refreshStarPool(false);
      this.priceWar();
      this.genRfp();
      this.snapshot();
      if (s.scenario === 'spinoff' && this.rand() < 0.08 && this.EVT.parent_check) this.queueEvent(this.EVT.parent_check);
    }
    /* ---------- 企業標案 ---------- */
    genRfp() {
      const s = this.s; s.rfps = s.rfps || [];
      s.rfps = s.rfps.filter((r) => r.dl > s.week);
      if (this.ym < '2023-06' || s.rfps.length >= 3 || this.rand() > 0.45) return;
      const F = Math.max(40, this.frontierComp());
      const pool = ['know', 'lang', 'code', 'reason', 'ctx', 'safety'];
      if (this.ym >= '2025-03') pool.push('agent', 'agent');
      if (this.ym >= '2023-10') pool.push('mm');
      const n = 1 + Math.floor(this.rand() * (this.yrs > 2 ? 3 : 2));
      const req = {};
      for (let i = 0; i < n; i++) {
        const st = this.pick(pool); if (req[st]) continue;
        req[st] = st === 'safety' ? Math.round(60 + this.rand() * 30) : Math.round(F * (0.72 + this.rand() * 0.26));
      }
      const main = Object.keys(req)[0];
      const maxPrice = this.rand() < 0.35 ? 'mid' : null;
      const diff = Object.keys(req).reduce((a, k) => a + (k === 'safety' ? (req[k] - 55) / 40 : req[k] / F), 0);
      const reward = Math.max(5e5, this.segValue('ent') * (0.25 + 0.55 * diff) * (0.8 + this.rand() * 0.4));
      s.rfps.push({ id: s.nextId++, client: this.pick(D.RFP_CLIENTS), need: D.RFP_NEEDS[main], req, maxPrice, reward, dl: s.week + 16 + Math.floor(this.rand() * 16), w: s.week });
      this.log('📝 新標案：' + s.rfps[s.rfps.length - 1].client + '徵求「' + D.RFP_NEEDS[main] + '」模型，得標可獲 ' + fmtMoney(reward), 'info');
    }
    rfpQualifier(r) {
      const order = D.PRICE_TIERS.map((p) => p.id);
      return this.s.models.find((m) => m.rel && !m.rel.retired && Object.keys(r.req).every((k) => (m.stats[k] || 0) >= r.req[k]) && (!r.maxPrice || order.indexOf(m.rel.price) <= order.indexOf(r.maxPrice))) || null;
    }
    checkRfps() {
      const s = this.s; if (!s.rfps || !s.rfps.length) return;
      for (const r of s.rfps.slice()) {
        if (r.dl <= s.week) { s.rfps = s.rfps.filter((x) => x !== r); this.log('⌛ 標案「' + r.client + '」截止，未能交付。', 'info'); continue; }
        const m = this.rfpQualifier(r);
        if (m) {
          s.rfps = s.rfps.filter((x) => x !== r); s.cash += r.reward; s.rep = clamp(s.rep + 2, 0, 100); s.rfpDone = (s.rfpDone || 0) + 1;
          s.rfpBoost = s.week + 52;
          this.log('🤝 得標！' + m.name + ' 通過「' + r.client + '」驗收，入帳 ' + fmtMoney(r.reward) + '，企業市場口碑提升。', 'good');
          if (s.rfpDone >= 3) this.unlockAch('rfp3');
        }
      }
    }

    /* ---------- 評測報告診斷（揭露配方的對錯，參考 GDT 的遊戲報告） ---------- */
    diagnose(m) {
      const s = this.s; const d = m.diag || {}; const out = [];
      const good = (t) => out.push({ k: 'good', t }); const bad = (t) => out.push({ k: 'bad', t }); const info = (t) => out.push({ k: 'info', t });
      const r = d.ratio || 0;
      if (r < 10) bad('資料量太少：每個參數只看了 ' + r.toFixed(1) + ' 個 token（Chinchilla 建議約 20），模型「訓練不足」，約 ' + Math.round((1 - d.eta) * 100) + '% 算力被浪費。');
      else if (r <= 45) good('參數與資料量配比接近 Chinchilla 最佳點（每參數 ' + r.toFixed(0) + ' token），算力用得很有效率。');
      else if (r > 150) info('刻意「過度訓練」（每參數 ' + r.toFixed(0) + ' token）：同算力下分數略低（效率 ' + Math.round(d.eta * 100) + '%），但模型小、推理便宜，很適合大量部署。');
      else info('資料量略多於 Chinchilla 最佳點（每參數 ' + r.toFixed(0) + ' token），效率 ' + Math.round(d.eta * 100) + '%。');
      for (const k in (d.epochs || {})) if (d.epochs[k] > 2) bad(D.DATA_POOLS[k].name + '資料被重複了 ' + d.epochs[k].toFixed(1) + ' 輪：快撞上資料牆了，去取得更多資料或研究「合成資料」。');
      if (d.Q < 0.58) bad('資料品質偏低（' + Math.round(d.Q * 100) + '）：試試「資料去重與品質過濾」、購買授權資料或增聘資料工程師。');
      else if (d.Q > 0.82) good('資料品質優秀（' + Math.round(d.Q * 100) + '），每個 token 都很有營養。');
      const mix = this.normMix(m.spec.mix || {});
      if (mix.code >= 0.3) good('程式碼比重高（' + Math.round(mix.code * 100) + '%），程式能力突出。'); else if (mix.code < 0.1) info('程式碼比重很低，程式與推理能力會吃虧。');
      if (mix.sci >= 0.3) good('書籍論文比重高，知識與推理受益。');
      if (mix.web >= 0.75) info('網頁資料佔比過高：語言流暢，但知識深度與推理偏弱。');
      const al = this.normAlloc(m.spec.alloc);
      if (m.stats.safety < 50) bad('安全分只有 ' + Math.round(m.stats.safety) + '：上線後越獄與事故機率高，監管壓力也會上升。提高後訓練的「安全」比重或招對齊研究員。');
      else if (m.stats.safety >= 85) good('安全分 ' + Math.round(m.stats.safety) + '：企業客戶與監管單位都很放心。');
      if (al.safe > 0.45) info('安全比重很高，產生「對齊稅」：語言流暢度被犧牲了一些。');
      if (al.reason > 0.25 && !this.has('t_cot')) info('沒有「思維鏈推理 RL」，推理方向的後訓練效果有限。');
      if (d.inst < 40) info('指令/偏好資料只有 ' + Math.round(d.inst) + 'K 筆，後訓練效果打折；可外包標註。');
      if (d.distill > 1.05) good('知識蒸餾生效：老師模型讓有效算力 ×' + d.distill.toFixed(2) + '。');
      if (d.penalty > 0) bad('訓練中硬撐 loss spike，品質損失 ' + Math.round(d.penalty * 100) + '%。');
      const c = this.composite(m.stats); const F = this.frontierComp();
      if (c >= F) good('綜合分 ' + c.toFixed(1) + ' 超越目前前沿（' + F.toFixed(1) + '）！');
      else if (F - c > 12) bad('綜合分 ' + c.toFixed(1) + '，落後前沿 ' + (F - c).toFixed(1) + ' 分：通用市場很難賣，考慮主攻單一市場或低價策略。');
      else info('綜合分 ' + c.toFixed(1) + '，距前沿 ' + (F - c).toFixed(1) + ' 分。');
      const segs = D.SEG_ORDER.filter((k) => this.segActive(k) && this.playerEligible(m, k)).map((k) => ({ k, gap: (s.market[k].frontier || 0) - this.fit(m.stats, k) })).sort((a, b) => a.gap - b.gap);
      if (segs.length) info('最有競爭力的市場：' + segs.slice(0, 2).map((x) => D.SEGMENTS[x.k].icon + D.SEGMENTS[x.k].name + (x.gap <= 0 ? '（領先）' : '（差 ' + x.gap.toFixed(1) + '）')).join('、'));
      const bs = this.badgesFor(m.stats, m.costRatio);
      if (bs.length) good('賣點：' + bs.map((b) => b.icon + b.name + '·' + b.tierName).join('、'));
      info('推理成本係數 ' + m.costRatio.toFixed(3) + '（越低越省卡；MoE、量化、MLA 等可降低）。');
      return out;
    }

    snapshot() {
      const s = this.s; const best = this.bestModel();
      s.hist.push({
        w: s.week, cash: s.cash, rev: this.avgRevenue(), exp: this.weeklyExpense(), val: s.valuation,
        best: best ? this.composite(best.stats) : 0, front: this.frontierComp(), rep: s.rep, gpu: this.ownedEq(), rank: best ? this.bestRank() : 0,
        agi: s.race ? Math.round(s.race.me * 10) / 10 : 0, agiTop: s.race && this.raceLeader() ? Math.round(this.raceLeader().pct * 10) / 10 : 0,
        share: D.SEG_ORDER.reduce((o, k) => { o[k] = this.playerShare(k); return o; }, {}),
      });
      if (s.hist.length > 240) s.hist.splice(0, s.hist.length - 240); // 每月一筆，2035 年底也留得下整局
    }

    /* ---------- 新聞 ---------- */
    processNews() {
      const s = this.s; const today = this.ymd;
      while (s.newsIdx < this.NEWS.length && this.NEWS[s.newsIdx].date <= today) {
        const n = this.NEWS[s.newsIdx++]; this.log('📰 ' + n.title + '：' + this.fill(n.text), 'news');
        const e = n.effects || {};
        if (e.techPublic) e.techPublic.forEach((t) => (s.techPublic[t] = true));
        if (e.demand) for (const k in e.demand) if (s.demandMul[k] != null) s.demandMul[k] *= e.demand[k];
        if (e.mod) this.addMod(e.mod.key, e.mod.mul, e.mod.weeks);
        if (e.exportControl) {
          if (s.embargoScenario) { if (!s.embargo) { s.embargo = true; this.log('⛓️ 出口管制生效：你再也買不到高階 GPU，境外雲租價翻倍。效率，才是唯一的出路。', 'bad'); } }
          else {
            this.addMod('gpuPrice', 1.08, 26);
            if (this.city().controlled && !s.flags.cityControl) {
              s.flags.cityControl = s.week || 1;
              this.log('⛓️ 出口管制生效：總部所在的' + this.city().name + '受高階晶片管制，高階 GPU 購卡價 ×1.6、境外雲租價 ×1.3。', 'bad');
            }
          }
        }
      }
    }

    /* ---------- 真實 AI 史新聞流（純背景，不影響數值） ---------- */
    histStart() {
      const d = this.ymd; const i = this.HIST.findIndex((it) => String(it.date) > d);
      return i < 0 ? this.HIST.length : i;
    }
    processHistory() {
      const s = this.s; const H = this.HIST; if (!H.length) return;
      if (s.histIdx == null) s.histIdx = this.histStart();
      // 每週最多播 2 則；同一陣子事件太密時，放了超過 5 週的舊聞只留在史料庫
      const today = this.ymd; const stale = ymdOf(Math.max(0, s.week - 5)); let n = 0;
      while (s.histIdx < H.length && String(H[s.histIdx].date) <= today && n < 2) {
        const it = H[s.histIdx++];
        if (String(it.date) < stale) continue;
        // 總部城市所在地區的新聞加 local 欄位，介面標〔本地〕
        const local = this.city().regions.indexOf(it.region) >= 0;
        this.log('📜 ' + it.title + '：' + histBrief(it.text), 'real', local ? { h: it.id, local: true } : { h: it.id }); n++;
      }
    }

    /* ---------- 事件 ---------- */
    eventOk(e) {
      const s = this.s; const c = e.cond || {}; const ym = this.ym;
      if (e.once && s.fired[e.id]) return false;
      if (s.cooldown[e.id] && s.week < s.cooldown[e.id]) return false;
      if (c.minDate && ym < c.minDate) return false;
      if (c.maxDate && ym > c.maxDate) return false;
      if (c.minCash != null && s.cash < c.minCash) return false;
      if (c.maxCash != null && s.cash > c.maxCash) return false;
      if (c.minRep != null && s.rep < c.minRep) return false;
      if (c.maxRep != null && s.rep > c.maxRep) return false;
      if (c.minReg != null && s.reg < c.minReg) return false;
      if (c.maxReg != null && s.reg > c.maxReg) return false;
      if (c.minCommunity != null && s.community < c.minCommunity) return false;
      if (c.hasModel && !s.models.some((m) => m.rel)) return false;
      const best = this.bestModel(); const bc = best ? this.composite(best.stats) : 0;
      if (c.minBestScore != null && bc < c.minBestScore) return false;
      if (c.maxBestScore != null && bc > c.maxBestScore) return false;
      if (c.hasTech && !this.has(c.hasTech)) return false;
      if (c.notTech && this.has(c.notTech)) return false;
      if (c.hasOpenModel && !s.models.some((m) => m.rel && m.rel.open)) return false;
      if (c.minStaff != null && this.totalStaff() < c.minStaff) return false;
      if (c.hasStar && !s.stars.length) return false;
      if (c.minUsers != null && this.chatUsers() < c.minUsers) return false;
      if (c.minRevenue != null && this.avgRevenue() < c.minRevenue) return false;
      if (c.training && !s.jobs.some((j) => j.kind === 'train')) return false;
      if (c.minGPU != null && this.ownedEq() < c.minGPU) return false;
      if (c.flag && !s.flags[c.flag]) return false;
      if (c.notFlag && s.flags[c.notFlag]) return false;
      if (c.city && s.city !== c.city) return false;
      if (c.minRank != null && this.bestRank() < c.minRank) return false;
      if (c.maxRank != null && this.bestRank() > c.maxRank) return false;
      if (c.race && !s.race) return false;
      if (c.extra && !(s.race && s.race.extra)) return false;
      if (c.minRisk != null && !(s.race && s.race.risk >= c.minRisk)) return false;
      if (c.behind != null && !(s.race && this.raceLeader() && this.raceLeader().pct - s.race.me >= c.behind)) return false;
      return true;
    }
    queueEvent(e, bind) {
      const s = this.s; if (!e) return;
      s.fired[e.id] = (s.fired[e.id] || 0) + 1;
      s.cooldown[e.id] = s.week + (e.cooldown || 26);
      const star = s.stars.length ? this.pick(s.stars) : null;
      const rvs = D.RIVALS.filter((r) => r.start <= this.ym);
      const lead = e.cat === 'race' && s.race ? this.raceLeader() : null; // 競賽事件裡的 {rival} 是進度最快的那家
      s.pending.push({ ev: e.id, star: star ? star.id : null, rival: (bind && bind.rival) || (lead && lead.id) || (rvs.length ? this.pick(rvs).id : 'sky') });
    }
    runEvents() {
      const s = this.s; if (s.pending.length) return;
      const due = s.chain.filter((c) => c.w <= s.week);
      if (due.length) {
        s.chain = s.chain.filter((c) => c.w > s.week);
        const e = this.EVT[due[0].id]; if (e) { this.queueEvent(e, { rival: due[0].rival }); return; }
      }
      if (s.week < 3) return;
      if (this.rand() > (s.race ? 0.17 : 0.13)) return; // 最後一幕的事件比較密
      const cands = this.EVENTS.filter((e) => !e.chainOnly && e.cat !== 'safety' && this.eventOk(e));
      const e = this.weighted(cands, (x) => x.weight || 1);
      if (e) this.queueEvent(e);
    }
    eventView(p) {
      const e = this.EVT[p.ev]; if (!e) return null;
      const star = p.star ? this.s.stars.find((x) => x.id === p.star) : null;
      const f = (t) => this.fill(t, star ? star.name : null, p.rival);
      // 年底抉擇：先告訴玩家現在收手會是哪個結局
      const extra = e.id === 'race_settle' ? '現在收手的話，結局會是「' + D.ENDINGS[this.settleEnding()].title + '」。' : '';
      return { id: e.id, cat: e.cat, title: f(e.title), text: f(e.text) + extra, choices: (e.choices || []).map((c) => ({ text: f(c.text), result: c.result ? f(c.result) : '' })) };
    }
    resolveEvent(choiceIdx) {
      const s = this.s; const p = s.pending.shift(); if (!p) return null;
      if (p.sys) return this.resolveSys(p, choiceIdx);
      const e = this.EVT[p.ev]; if (!e) return null;
      const ch = (e.choices || [])[choiceIdx] || (e.choices || [])[0];
      if (!ch) return null;
      const star = p.star ? s.stars.findIndex((x) => x.id === p.star) : -1;
      const sn = star >= 0 ? s.stars[star].name : null;
      const res = ch.result ? this.fill(ch.result, sn, p.rival) : '';
      const title = this.fill(e.title, sn, p.rival), ctext = this.fill(ch.text, sn, p.rival);
      this._bindRival = p.rival;
      const summary = this.applyEffects(ch.effects || {}, star);
      this._bindRival = null;
      if (e.id === 'reg_frontier_license' && !s.flags.frontier_license) { s.flags.frontier_license = s.week; summary.push('之後綜合分 ≥ 80 的模型需安全 ≥ 70 才能發布'); }
      this.log((e.cat === 'safety' ? '🚨 ' : '📌 ') + title + ' → ' + ctext + (res ? '：' + res : ''), e.cat === 'safety' ? 'bad' : 'event');
      if (e.cat === 'safety') this.chron('crisis', title, 7);
      if (e.cat === 'race') this.chron('race', title + '：' + ctext.replace(/（.*$/, ''), e.id === 'race_open' ? 8 : 6);
      return { result: res, summary };
    }
    resolveSys(p, idx) {
      const s = this.s;
      if (p.sys === 'fail') {
        const j = s.jobs.find((x) => x.id === p.job); if (!j) return null;
        const per = j.gpus * B.H100_WEEK_FLOPS * this.mfu();
        if (p.kind === 'spike') {
          if (idx === 0) { j.done = Math.max(0, j.done - per * 1.5); this.log('↩️ ' + j.spec.name + ' 回滾到上一個檢查點，損失約 1.5 週進度。', 'info'); }
          else { j.penalty = (j.penalty || 0) + 0.04; this.log('🎲 ' + j.spec.name + ' 頂著 loss spike 繼續訓練，模型品質可能受損。', 'bad'); }
        } else {
          if (idx === 0) { const c = Math.max(2e5, j.gpus * 400); s.cash -= c; this.log('🔧 連夜搶修叢集，花費 ' + fmtMoney(c) + '。', 'info'); }
          else { j.slow = 0.35; s.morale = clamp(s.morale - 2, 0, 100); this.log('🐢 ' + j.spec.name + ' 帶病運行，本週吞吐量大降。', 'bad'); }
        }
        return { result: '' };
      }
      if (p.sys === 'trained') return { result: '', model: p.model };
      return null;
    }
    sysView(p) {
      if (p.sys === 'fail') {
        const j = this.s.jobs.find((x) => x.id === p.job); const name = j ? j.spec.name : '模型';
        if (p.kind === 'spike') return { title: '📉 Loss Spike！', text: name + ' 的 loss 曲線突然暴衝，訓練有發散的跡象。', choices: [{ text: '回滾到上一個檢查點（損失約 1.5 週進度）' }, { text: '調小學習率硬撐下去（不損失進度，但模型品質 -4%）' }] };
        return { title: '🔥 硬體故障', text: '叢集裡好幾張卡掉線了，' + name + ' 的訓練被迫中斷。', choices: [{ text: '連夜搶修，加錢換備件（花費 ' + fmtMoney(Math.max(2e5, (j ? j.gpus : 100) * 400)) + '）' }, { text: '先帶病跑著（本週訓練速度 -65%，士氣 -2）' }] };
      }
      return null;
    }
    applyEffects(ef, starIdx) {
      const s = this.s; const out = [];
      const add = (k, v, fmt) => { if (v) out.push(k + (v > 0 ? ' +' : ' ') + (fmt ? fmt(v) : Math.round(v * 10) / 10)); };
      if (ef.cash) { s.cash += ef.cash; add('資金', ef.cash, fmtMoney); }
      if (ef.cashRel) { const v = ef.cashRel * Math.max(1e5, this.weeklyExpense()); s.cash += v; add('資金', v, fmtMoney); }
      if (ef.rep) { s.rep = clamp(s.rep + ef.rep, 0, 100); add('聲望', ef.rep); }
      if (ef.reg) { s.reg = clamp(s.reg + ef.reg, 0, 100); add('監管壓力', ef.reg); }
      if (ef.community) { s.community = clamp(s.community + ef.community, 0, 100); add('社群', ef.community); }
      if (ef.morale) { s.morale = clamp(s.morale + ef.morale, 0, 100); add('士氣', ef.morale); }
      if (ef.rp) { s.rp = Math.max(0, s.rp + ef.rp); add('研究點', ef.rp); }
      if (ef.rpRel) { const v = ef.rpRel * Math.max(10, this.s.lastWeek ? this.s.lastWeek.rp : 20); s.rp = Math.max(0, s.rp + v); add('研究點', v); }
      if (ef.data) for (const k0 in ef.data) {
        // 內容檔用 science 表示書籍論文資料，引擎的資料池叫 sci
        const v = ef.data[k0]; const k = k0 === 'science' ? 'sci' : k0;
        if (k === 'inst') { s.data.inst = Math.max(0, s.data.inst + v); add('指令資料', v, (x) => Math.round(x) + 'K'); }
        else if (s.data[k]) { this.addData(k, v, v > 0 ? D.DATA_POOLS[k].q : null); add(D.DATA_POOLS[k].name + '資料', v, fmtTokens); }
      }
      if (ef.dataRisk) { s.data.risk = clamp(s.data.risk + ef.dataRisk, 0, 1); add('資料法律風險', ef.dataRisk * 100, (x) => Math.round(x) + '%'); }
      if (ef.gpu) {
        const type = this.gpuAvail('h100') ? 'h100' : this.gpuAvail('c2') ? 'c2' : 'a100';
        const n = Math.round(ef.gpu / GPU[type].pf); const g = s.gpus.find((x) => x.type === type); if (g) g.n += n; else s.gpus.push({ type, n, w: s.week });
        add('GPU', n, (x) => Math.round(x) + ' 張 ' + GPU[type].name);
      }
      if (ef.gpuLossPct) { let lost = 0; for (const g of s.gpus) { const l = Math.floor(g.n * ef.gpuLossPct); g.n -= l; lost += l; } s.gpus = s.gpus.filter((g) => g.n > 0); add('GPU', -lost, (x) => Math.round(x) + ' 張'); }
      if (ef.staff) {
        const r = ef.staff.role; const st = s.staff[r];
        if (st) {
          let n;
          if (ef.staff.n > 0) { // 事件帶來的人，技能落在該職能目前的平均附近
            n = Math.min(ef.staff.n, Math.max(0, this.officeCap() - this.totalStaff()));
            for (let i = 0; i < n; i++) this.newPerson(r, st.skill + (this.prand() - 0.5) * 10);
          } else { // 事件帶走的人隨機挑
            const pool = this.people(r); const gone = [];
            for (let i = 0; i < -ef.staff.n && pool.length; i++) gone.push(pool.splice(Math.floor(this.prand() * pool.length), 1)[0]);
            n = -gone.length; this.removePeople(gone);
          }
          this.syncStaff(); add(D.ROLES[r].name, n);
        }
      }
      if (ef.starLeave && s.stars.length) this.starLeave(starIdx != null && starIdx >= 0 ? starIdx : null, '被挖走了');
      if (ef.starOffer) { this.offerStar(ef.starOffer, 0.7); out.push('人才名單出現新的明星候選人'); }
      if (ef.mod) { this.addMod(ef.mod.key, ef.mod.mul, ef.mod.weeks); out.push(modLabel(ef.mod)); }
      if (ef.trainDelay) { const j = s.jobs.find((x) => x.kind === 'train'); if (j) { j.done = Math.max(0, j.done - j.gpus * B.H100_WEEK_FLOPS * this.mfu() * ef.trainDelay); out.push('訓練延後 ' + ef.trainDelay + ' 週'); } }
      if (ef.trainBoost) { const j = s.jobs.find((x) => x.kind === 'train'); if (j) { j.done = Math.min(j.total * 0.999, j.done + j.total * ef.trainBoost); out.push('訓練進度 +' + Math.round(ef.trainBoost * 100) + '%'); } }
      if (ef.techDiscount) { this.s.mods.push({ key: 'tech_' + ef.techDiscount.tech, mul: ef.techDiscount.mul, until: s.week + 104 }); out.push('「' + (TECH[ef.techDiscount.tech] || {}).name + '」研究成本 ×' + ef.techDiscount.mul); }
      if (ef.techFree) { this.grantTech(ef.techFree, false); out.push('獲得科技「' + (TECH[ef.techFree] || {}).name + '」'); }
      if (ef.rivalPriceCut) { const R = ef.rivalPriceCut === 'random' ? this.pick(D.RIVALS.filter((r) => this.ym >= r.start)) : RIVAL[ef.rivalPriceCut]; if (R) { s.rivals[R.id].priceMul = Math.max(0.25, s.rivals[R.id].priceMul * 0.75); out.push(R.name + ' 降價'); } }
      if (ef.rivalBoost) { const R = RIVAL[ef.rivalBoost] || this.pick(D.RIVALS); s.rivals[R.id].boost += 3; out.push(R.name + ' 實力提升'); }
      if (ef.flag) s.flags[ef.flag] = s.week || 1;
      if (ef.chain && this.EVT[ef.chain.id]) s.chain.push({ id: ef.chain.id, w: s.week + (ef.chain.weeks || 4), rival: this._bindRival || null });
      if (ef.agi && s.race) { s.race.me = clamp(s.race.me + ef.agi, 0, this.agiStatus().ok ? 100 : A.gate); add('AGI 進度', ef.agi); }
      if (ef.agiRisk && s.race) { s.race.risk = clamp(s.race.risk + ef.agiRisk, 0, 100); add('失控風險', ef.agiRisk); }
      if (ef.rivalAgi && s.race) {
        const ids = ef.rivalAgi.who === 'all' ? Object.keys(s.race.rv) : [this._bindRival].filter((x) => x && s.race.rv[x]);
        for (const id of ids) s.race.rv[id].pct = clamp(s.race.rv[id].pct + ef.rivalAgi.add, 0, A.gate);
        if (ids.length) add((ef.rivalAgi.who === 'all' ? '所有對手' : RIVAL[ids[0]].name) + ' AGI 進度', ef.rivalAgi.add);
      }
      if (ef.rivalAgiMod) { this.addMod('rivalAgi', ef.rivalAgiMod.mul, ef.rivalAgiMod.weeks); out.push(modLabel({ key: 'rivalAgi', mul: ef.rivalAgiMod.mul, weeks: ef.rivalAgiMod.weeks })); }
      if (ef.raceExtra) this.startExtra();
      if (ef.settle) this.endGame(this.settleEnding());
      else if (ef.ending) this.endGame(ef.ending);
      return out;
    }

    /* ---------- 成就 ---------- */
    unlockAch(id) { const s = this.s; if (s.ach[id]) return; s.ach[id] = s.week || 1; const a = D.ACHIEVEMENTS.find((x) => x.id === id); if (a) this.log('🏆 成就解鎖：' + a.icon + ' ' + a.name, 'ach'); if (CHRON_ACH[id]) this.chron(CHRON_ACH[id][0], CHRON_ACH[id][1], CHRON_ACH[id][2]); }
    checkAchievements() {
      const s = this.s; const rk = this.bestRank();
      if (rk <= 10) this.unlockAch('top10'); if (rk <= 3) this.unlockAch('top3'); if (rk === 1) this.unlockAch('rank1');
      if (s.community >= 80) this.unlockAch('community80');
      const r = this.avgRevenue(); if (r >= 1e6) this.unlockAch('rev1m'); if (r >= 1e8) this.unlockAch('rev100m');
      const eq = this.ownedEq(); if (eq >= 1e4) this.unlockAch('gpu10k'); if (eq >= 1e5) this.unlockAch('gpu100k');
      if (this.totalStaff() >= 100) this.unlockAch('staff100');
      if (s.stat.wasNeg && s.cash > 0 && this.yrs > 1 && s.stat.negWeeks === 0 && s.cash > this.weeklyExpense() * 20) this.unlockAch('survivor');
      if (this.segActive('api')) {
        const sh = s.market.api.shares; let top = null, tv = 0; for (const k in sh) if (sh[k] > tv) { tv = sh[k]; top = k; }
        if (top && top[0] === 'p') { const m = s.models.find((x) => 'p' + x.id === top); if (m && m.rel && (m.rel.price === 'low' || m.rel.price === 'free')) this.unlockAch('price_war'); }
      }
    }

    /* ---------- 新手任務（第一年的主線引導） ---------- */
    // s.quest = { done: { 任務 id: 完成的週 }, all: 全部完成的週 }；s.flags.noQuest 為 true 時關閉
    initQuests() {
      const s = this.s; s.quest = { done: {} };
      s.stat.hired = s.stat.hired || 0; s.stat.bought = s.stat.bought || 0;
      // 舊存檔沒有招募、購卡的計數，改看員工數與算力有沒有超過開局
      const sc = this.scen() || D.SCENARIOS[0];
      const staff0 = sum(D.ROLE_ORDER.map((r) => sc.staff[r] || 0));
      const eq0 = sum(sc.gpus.map((g) => g.n * GPU[g.type].pf));
      const legacy = {
        q_hire: () => s.stars.length > 0 || (s.people || []).length > staff0,
        q_gpu: () => Math.max(s.stat.maxGpu || 0, this.ownedEq()) > eq0 + 1e-6,
      };
      const Q = (root.ME_QUESTS || []).filter((q) => QUEST_CHECK[q.id]);
      for (const q of Q) if ((legacy[q.id] || QUEST_CHECK[q.id])(this)) s.quest.done[q.id] = s.week;
      if (Q.length && Q.every((q) => s.quest.done[q.id] != null)) s.quest.all = s.week;
    }
    // 給介面：[{ id, title, desc, done, w（完成的週）, reward（獎勵說明）, go（分頁 id 或 'wizard'） }]
    quests() {
      const done = (this.s.quest && this.s.quest.done) || {};
      return (root.ME_QUESTS || []).filter((q) => QUEST_CHECK[q.id]).map((q) => ({
        id: q.id, title: q.title, desc: this.flavor(q.desc), done: done[q.id] != null, w: done[q.id] != null ? done[q.id] : null,
        reward: this.rewardText(q.reward || {}), go: q.go,
      }));
    }
    activeQuest() { if (this.s.flags.noQuest) return null; return this.quests().find((q) => !q.done) || null; }
    setQuests(on) { this.s.flags.noQuest = !on; if (on) this.checkQuests(); }
    checkQuests() {
      const s = this.s; if (!s.quest || s.quest.all != null || s.flags.noQuest) return;
      const Q = (root.ME_QUESTS || []).filter((q) => QUEST_CHECK[q.id]); if (!Q.length) return;
      for (const q of Q) {
        if (s.quest.done[q.id] != null || !QUEST_CHECK[q.id](this)) continue;
        s.quest.done[q.id] = s.week;
        const got = this.applyEffects(q.reward || {});
        this.log('🎯 新手任務完成：' + q.title + (got.length ? '（' + got.join('、') + '）' : ''), 'quest', { quest: q.id });
      }
      if (Q.every((q) => s.quest.done[q.id] != null)) { s.quest.all = s.week; this.log('🎓 新手任務全部完成！接下來的路，就交給你自己走了。', 'quest'); }
    }
    // 獎勵說明，格式跟 applyEffects 回傳的摘要相同
    rewardText(ef) {
      const out = []; const add = (k, v, fmt) => { if (v) out.push(k + (v > 0 ? ' +' : ' ') + (fmt ? fmt(v) : Math.round(v * 10) / 10)); };
      if (ef.cash) add('資金', ef.cash, fmtMoney);
      if (ef.rep) add('聲望', ef.rep);
      if (ef.community) add('社群', ef.community);
      if (ef.morale) add('士氣', ef.morale);
      if (ef.rp) add('研究點', ef.rp);
      if (ef.data && ef.data.inst) add('指令資料', ef.data.inst, (x) => Math.round(x) + 'K');
      return out.join('、');
    }

    /* ---------- 結局 ---------- */
    agiStatus() {
      const best = this.bestModel(true); if (!best) return { ok: false, comp: 0, minCore: 0 };
      const c = this.composite(best.stats);
      const minCore = Math.min(...A.coreKeys.map((k) => best.stats[k] || 0));
      return { ok: c >= A.comp && minCore >= A.core, comp: c, minCore, model: best };
    }

    /* ---------- 最後一幕：AGI 競賽 ---------- */
    /* s.race = { w, extra, me, risk, rv: { 對手 id: { pct, f } }, settleW, m: { 已通報的里程碑 } }
       me、pct 是 0～100 的進度，每週累積：模型越接近門檻越快；沒達標的模型卡在 A.gate。risk 是失控風險，影響能不能拿到好結局 */
    raceFactor(c) { return clamp((c - A.c0) / (A.comp - A.c0), 0.1, 1.6); }
    rivalLast(id) { const m = this.s.rivals[id].models; return m[m.length - 1] || null; }
    raceLeader() {
      const r = this.s.race; if (!r) return null; let best = null;
      for (const id in r.rv) if (!best || r.rv[id].pct > best.pct) best = { id, pct: r.rv[id].pct };
      return best;
    }
    openRace() {
      const s = this.s; const a = this.agiStatus();
      s.race = { w: s.week, extra: false, me: 20 * this.raceFactor(a.comp), risk: 35, rv: {}, settleW: TOTAL_WEEKS, m: {} };
      for (const R of D.RIVALS) {
        const m = this.rivalLast(R.id); if (!m) continue;
        s.race.rv[R.id] = { pct: 20 * this.raceFactor(this.composite(m.stats)) * R.agi, f: 0.75 + 0.5 * this.rand() };
      }
      this.log('🏁 最後一幕開始了：所有人都看得出來，接下來幾年會決定誰先抵達 AGI。', 'event');
      this.chron('race', '最後一幕開始：AGI 競賽', 9);
      if (this.EVT.race_open) this.queueEvent(this.EVT.race_open);
    }
    raceWeek() {
      const s = this.s;
      if (!s.race) {
        const a = this.agiStatus();
        if (Math.max(this.frontierComp(), a.comp) >= A.onComp || this.ym >= A.onDate) this.openRace();
        return;
      }
      const r = s.race; const a = this.agiStatus(); const M = r.m;
      if (a.model) {
        const coreF = clamp((a.minCore - 60) / (A.core - 60), 0.3, 1.1);
        const v = A.rate * this.raceFactor(a.comp) * coreF * (this.prodMul() / 1.1) * this.techProd('agi') * this.mod('agi');
        r.me = Math.min(a.ok ? 100 : A.gate, r.me + v);
        if (a.ok && !M.gate) { M.gate = 1; this.log('🎯 ' + a.model.name + ' 達到 AGI 門檻，接下來就看誰先完成驗證。', 'good'); this.chron('race', a.model.name + ' 達到 AGI 門檻', 8); }
        for (const x of [50, 75, 90]) if (r.me >= x && !M['me' + x]) { M['me' + x] = 1; this.log('🧭 ' + s.company + ' 的 AGI 進度達到 ' + x + '%。', 'good'); this.chron('race', 'AGI 進度達到 ' + x + '%', x >= 90 ? 7 : x >= 75 ? 6 : 5); }
      }
      const lead0 = this.raceLeader();
      const panic = lead0 && r.me > lead0.pct + 10 ? 1.25 : 1; // 你領先太多時，全行業砸錢追趕
      for (const id in r.rv) {
        const st = r.rv[id]; const R = RIVAL[id]; const m = this.rivalLast(id); if (!m) continue;
        const c = this.composite(m.stats); const core = Math.min(...A.coreKeys.map((k) => m.stats[k] || 0));
        const v = A.rivalRate * this.raceFactor(c) * R.agi * st.f * panic * this.mod('rivalAgi');
        st.pct = Math.min(c >= A.comp && core >= A.core ? 100 : A.gate, st.pct + v);
        for (const x of [50, 75, 90]) if (st.pct >= x && !M[id + x]) { M[id + x] = 1; this.log(R.icon + ' ' + this.flavor('{rival} 的 AGI 進度傳出已達 ' + x + '%。', null, id), 'rival'); this.chron('race', this.flavor('{rival} 的 AGI 進度達到 ' + x + '%', null, id), x >= 90 ? 7 : x >= 75 ? 6 : 5); }
      }
      // 沒有監督機制時，越接近終點越危險
      r.risk = clamp(r.risk + (this.has('t_oversight') ? -0.03 : 0.08), 0, 100);
      const lead = this.raceLeader();
      if (lead && lead.pct >= 85 && !M.close && this.EVT.race_rival_close) { M.close = 1; this.queueEvent(this.EVT.race_rival_close, { rival: lead.id }); }
      if (r.me >= 85 && !M.meclose && this.EVT.race_me_close) { M.meclose = 1; this.queueEvent(this.EVT.race_me_close); }
      // 2030 年底起每年問一次要不要收手
      if (s.week >= r.settleW && s.week < MAX_WEEKS) {
        r.settleW = s.week + 52;
        if (this.EVT.race_settle) this.queueEvent(this.EVT.race_settle); else this.startExtra();
      }
    }
    startExtra() {
      const r = this.s.race; if (!r || r.extra) return;
      r.extra = true;
      this.log('⏱️ 2030 年底，AGI 競賽還沒分出勝負。延長賽開始，最晚到 2035 年底。', 'event');
      this.chron('race', '延長賽開始', 9);
    }
    // 給介面：競賽狀態。沒進最後一幕時 on 是 false
    agiRace() {
      const s = this.s; const r = s.race; const a = this.agiStatus();
      const me = { pct: r ? Math.round(r.me * 10) / 10 : 0, comp: a.comp, minCore: a.minCore, need: { comp: A.comp, core: A.core }, gate: a.ok, risk: r ? Math.round(r.risk) : 0 };
      if (!r) return { on: false, extra: false, endW: TOTAL_WEEKS, me, rivals: [] };
      const rivals = Object.keys(r.rv).map((id) => { const m = this.rivalLast(id); return { id, name: RIVAL[id].name, icon: RIVAL[id].icon, pct: Math.round(r.rv[id].pct * 10) / 10, comp: m ? this.composite(m.stats) : 0 }; }).sort((x, y) => y.pct - x.pct);
      return { on: true, extra: !!r.extra, endW: this.endWeek(), me, rivals };
    }
    // 抵達 AGI 時的結局：開放、對齊或失控，看一路上的選擇
    agiEnding(m) {
      const s = this.s; const risk = s.race ? s.race.risk : 50;
      if (s.flags.race_open_agi || (m.rel && m.rel.open && s.community >= 60 && s.stat.opened >= 2)) return 'agi_open';
      return this.has('t_oversight') && m.stats.safety >= 85 && risk < 60 ? 'agi_good' : 'agi_bad';
    }
    // 收手結算（或走到 2035 年底）時的結局：依這一局走的路線決定，「仍在路上」只留給真的落後的局
    settleEnding() {
      const s = this.s; const rk = this.bestRank(); const revs = this.companyRevenues(); const best = this.bestModel();
      const revRank = revs.findIndex((x) => x.player) + 1;
      if ((revRank === 1 && rk <= 3) || (revRank <= 2 && rk === 1)) return 'empire';
      if (s.community >= 60 && s.stat.opened >= 3 && this.leaderboard().slice(0, 8).some((r) => r.player && r.open)) return 'open_legend';
      if (this.has('t_oversight') && best && best.stats.safety >= 85 && s.rep >= 50 && rk <= 8) return 'steward';
      if (s.flags.race_state2) return 'state';
      const live = s.models.filter((m) => m.rel && !m.rel.retired);
      const cheap = live.length && live.every((m) => m.rel.price === 'low' || m.rel.price === 'free');
      if (cheap && (this.playerShare('chat') >= 0.1 || this.playerShare('api') >= 0.1)) return 'everyman';
      if (s.flags.race_state) return 'state';
      // 至少在某個市場拿下前兩名
      const lead = D.SEG_ORDER.some((k) => { if (!this.segActive(k)) return false; const me = this.playerShare(k); return me >= 0.15 && D.RIVALS.filter((R) => this.rivalShare(R.id, k) > me).length <= 1; });
      if (revRank <= 3 || lead) return 'niche';
      return 'survive';
    }
    checkEnd() {
      const s = this.s; if (s.ended) return;
      const a = this.agiStatus(); const r = s.race;
      if (r && r.me >= 100 && a.ok) {
        this.unlockAch('agi');
        this.chron('race', a.model.name + ' 抵達 AGI', 10);
        this.endGame(this.agiEnding(a.model)); return;
      }
      if (r) { const lead = this.raceLeader(); if (lead && lead.pct >= 100) { this.chron('race', this.flavor('{rival} 搶先抵達 AGI', null, lead.id), 10); this.endGame('rival_agi', lead.id); return; } }
      if (s.stat.negWeeks >= 10) { this.endGame('bankrupt'); return; }
      if (s.week >= MAX_WEEKS) this.endGame(this.settleEnding());
    }
    companyRevenues() {
      const s = this.s; const out = [{ name: s.company, rev: this.avgRevenue(), player: true }];
      for (const R of D.RIVALS) {
        let r = 0; for (const k of D.SEG_ORDER) { if (!this.segActive(k)) continue; let pm = s.rivals[R.id].priceMul; if (k === 'chat' && R.freeChat) pm = 0.15; r += this.rivalShare(R.id, k) * this.segValue(k) * pm * (R.open ? 0.3 : 1); }
        out.push({ name: R.name, rev: r, rival: R.id, icon: R.icon });
      }
      return out.sort((a, b) => b.rev - a.rev);
    }
    endGame(type, rival) {
      const s = this.s; if (s.ended) return;
      const E = D.ENDINGS[type];
      const net = s.equity * s.valuation * (type === 'bankrupt' ? 0.02 : 1); // 破產時股權幾乎不值錢
      const best = this.bestModel(true); const bc = best ? this.composite(best.stats) : 0;
      const bonus = E.bonus || 0;
      const timeBonus = (type === 'agi_good' || type === 'agi_bad' || type === 'agi_open') ? Math.max(0, TOTAL_WEEKS - s.week) * 0.8 : 0;
      const parts = { net: Math.round(100 * Math.log10(Math.max(1, net / 1e6))), model: Math.round(4 * bc), ach: 15 * Object.keys(s.ach).length, bonus, time: Math.round(timeBonus) };
      const score = parts.net + parts.model + parts.ach + parts.bonus + parts.time;
      const GRADES = ['S', 'A', 'B', 'C', 'D'];
      let gi = score >= 1900 ? 0 : score >= 1500 ? 1 : score >= 1150 ? 2 : score >= 800 ? 3 : 4;
      if (E.maxGrade) gi = Math.max(gi, GRADES.indexOf(E.maxGrade));
      const grade = GRADES[gi];
      s.ended = { type, w: s.week, score, grade, net, bc, parts };
      if (rival) s.ended.rival = rival;
      this.chron('race', '結局：' + E.title, 10);
      this.log(E.icon + ' 結局：' + E.title, 'ach');
    }
    // 結局畫面的文字，佔位符都代換好了（不會動到遊戲亂數）
    endingView() {
      const e = this.s.ended; if (!e) return null; const E = D.ENDINGS[e.type]; if (!E) return null;
      const m = this.bestModel(true); const f = (t) => this.flavor(t, m, e.rival);
      return { type: e.type, icon: E.icon, title: E.title, grade: e.grade, text: f(E.text), after: (E.after || []).map(f) };
    }

    /* ---------- 存檔 ---------- */
    serialize() { return JSON.stringify(this.s); }
    static load(json) { const s = typeof json === 'string' ? JSON.parse(json) : json; return new Game(s); }
  }

  function modLabel(m) {
    const names = { agi: 'AGI 進度速度', rivalAgi: '對手 AGI 進度速度', rentPrice: '雲端租價', gpuPrice: 'GPU 價格', rpMul: '研究速度', trainSpeed: '訓練速度', salary: '薪資成本', hireQuality: '招募品質', incidentRisk: '事故風險', revenueMul: '營收', valuation: '估值', chatLoad: '對話算力用量' };
    let n = names[m.key];
    if (!n && m.key.indexOf('demand_') === 0) { const sg = D.SEGMENTS[m.key.slice(7)]; n = (sg ? sg.name : '') + ' 需求'; }
    return (n || m.key) + ' ×' + m.mul + '（' + (m.weeks || 26) + ' 週）';
  }

  root.ME = { Game, fmtMoney, fmtNum, fmtTokens, fmtParams, dateLabel, ymOf, ymdOf, weekDate, TOTAL_WEEKS, MAX_WEEKS, TECH, GPU, ARCH, RIVAL, CITY, cityPerks, skillTier, clamp, modLabel, USAGE };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ME;
})(typeof window !== 'undefined' ? window : globalThis);

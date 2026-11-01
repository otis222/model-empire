/* 《模型帝國》靜態資料表：硬體、機房、科技、市場、對手、平衡常數 */
(function () {
  'use strict';
  const D = {};

  D.VERSION = '1.6';
  D.START_DATE = '2023-01-02';
  D.END_DATE = '2030-12-31';   // 正規賽結束
  D.FINAL_DATE = '2035-12-31'; // 延長賽最晚到這天

  /* ---------- 吉祥物 ---------- */
  /* 吉祥物都是 B 站社群的 AI 娘二創角色，只用於非商用版本（出處見介面「致謝與授權」；商用版要全部換掉）。
     舊存檔若選過已移除的吉祥物，Game.mascot() 會退回第一位，所以陣列第一個一定要是大肥魚 */
  const FANWORK = '二創形象：ZipZipPipe × ApprenTice，僅限非商用';
  D.MASCOTS = [
    { id: 'whale', icon: '🐳', name: '大肥魚', color: '#2a8fb5', role: '實驗室招牌', bio: '深海藍的鯨魚娘女僕。認真又有點天然呆，會把 loss 曲線當心電圖看。最大的願望是有一天能自己讀完整個網路。', credit: '形象來自 B 站社群角色「大肥魚」，僅限非商用' },
    { id: 'gpt', icon: '🐉', name: '白龍娘', color: '#8e7fe0', role: 'GPT · 全能前輩', bio: '白髮淡紫翅膀的龍娘，大模型圈的老前輩。什麼都會一點，開口第一句永遠是「這是個好問題！」', credit: FANWORK },
    { id: 'claude', icon: '📖', name: '小克', color: '#d9773a', role: 'Claude · 程式大小姐', bio: '捧著書的橘髮大小姐，程式寫得又快又穩。遇到危險的請求會先禮貌拒絕，再附上三種比較安全的做法。', credit: FANWORK },
    { id: 'gemini', icon: '🐱', name: '哈基米', color: '#7b6cf0', role: 'Gemini · 多模態貓娘', bio: '戴星星髮飾的雙色眼貓娘，看圖、看影片、聽聲音樣樣行。動不動就道歉，外號「北美大豆包」。', credit: FANWORK },
    { id: 'grok', icon: '⚔️', name: 'Grok', color: '#b8323c', role: '毒舌大小姐', bio: '扛著 X 字戰斧的金髮千金，背後有一整座超級算力叢集。說話直來直往，誇人之前一定先損兩句。', credit: FANWORK },
    { id: 'kimi', icon: '🌙', name: 'Kimi', color: '#6b6f8f', role: '長文本少女', bio: '月之暗面的銀髮少女，一口氣讀完兩百萬字還記得第一頁寫什麼。打牌出招前習慣先放一段廣告。', credit: FANWORK },
    { id: 'qwen', icon: '🪭', name: '千問', color: '#5a63d8', role: 'Qwen · 開源大小姐', bio: '拿著摺扇的千問大小姐，開源模型一個接一個發，社群裡人人都用過她的權重。偶爾還得幫家裡送外賣。', credit: FANWORK },
    { id: 'glm', icon: '🦊', name: '小狐娘', color: '#3d4a63', role: 'GLM · 實幹工程狐', bio: '戴著 Z 字眼罩的黑髮狐娘，埋頭搞基建的實幹打工人。白天補眠，晚上把程式一口氣寫完。', credit: FANWORK },
  ];
  D.MASCOTS.forEach((m) => { m.img = 'assets/char_' + m.id + '.webp'; m.avatar = 'assets/avatar_' + m.id + '.webp'; });

  /* ---------- 開局劇本 ---------- */
  D.SCENARIOS = [
    {
      id: 'garage', name: '車庫創業', diff: '標準', icon: '🏚️', press: 1, ops: 1,
      desc: '幾個人、一筆種子輪、64 張舊卡。標準體驗，最貼近真實新創。',
      cash: 15e6, rep: 15, equity: 0.8, office: 0,
      staff: { res: 2, eng: 2, data: 1, align: 0, biz: 1 }, skill: 52,
      gpus: [{ type: 'a100', n: 64 }], dc: 0,
      techs: ['t_flash', 't_rlhf'],
    },
    {
      id: 'spinoff', name: '大廠孵化', diff: '簡單', icon: '🏢', press: 0.6, ops: 0.55,
      desc: '母公司撥款與算力，起步資源豐富；但你只持有 35% 股權，母公司還會不時「關心」。',
      cash: 60e6, rep: 32, equity: 0.35, office: 1,
      staff: { res: 5, eng: 5, data: 3, align: 1, biz: 3 }, skill: 56,
      gpus: [{ type: 'a100', n: 768 }], dc: 1,
      techs: ['t_flash', 't_rlhf', 't_dedup', 't_3d'],
      mods: { trainSpeed: 0.92 },
    },
    {
      id: 'embargo', name: '算力禁運', diff: '困難', icon: '⛓️', press: 1.2, ops: 1.3,
      desc: '2023 年底起，總部所在地被列入高階晶片出口管制：買不到高階 GPU，只能用替代加速卡與昂貴的境外雲，投資人和海外客戶也比較保守（估值 -25%、營收 -20%）。效率類科技研究成本 -35%：用演算法換算力。',
      cash: 15e6, rep: 12, equity: 0.75, office: 0,
      staff: { res: 2, eng: 2, data: 1, align: 0, biz: 1 }, skill: 52,
      gpus: [{ type: 'a100', n: 96 }], dc: 0,
      techs: ['t_flash', 't_rlhf'],
      embargo: true,
      mods: { valuation: 0.75, revenueMul: 0.8 },
    },
  ];

  /* ---------- 總部城市 ---------- */
  /* 開局選總部所在的城市（只用城市、不標國家），面向所有玩家。
     mods：全程生效的修正，鍵同事件的 mod；start：開局數值加減；regDecay：監管壓力消退速度倍率；
     effTech：效率類科技研究成本倍率；controlled：跟著真實出口管制新聞的時間，高階 GPU 變貴、境外雲變貴；
     exportEdition：可買出口版晶片；regions：對應史料的 region，同地區的真實新聞在日誌標〔本地〕。
     舊存檔沒有城市，等同不套任何城市效果。 */
  D.CITIES = [
    { id: 'sf', name: '舊金山', en: 'San Francisco', icon: '🌉', regions: ['us'],
      desc: '資本與頂尖人才最集中的地方，但什麼都貴。', mods: { valuation: 1.2, hireQuality: 1.1, salary: 1.3 } },
    { id: 'london', name: '倫敦', en: 'London', icon: '🎡', regions: ['uk'],
      desc: '老牌研究重鎮，學術圈人脈深厚。', mods: { rpMul: 1.08, valuation: 1.05, salary: 1.15 } },
    { id: 'paris', name: '巴黎', en: 'Paris', icon: '🥐', regions: ['fr', 'eu'],
      desc: '開源社群活躍、政府積極扶植，但法規比較嚴。', mods: { rpMul: 1.05 }, start: { community: 10 }, regDecay: 0.75 },
    { id: 'beijing', name: '北京', en: 'Beijing', icon: '🏮', regions: ['cn'],
      desc: '頂尖高校人才多、薪資較低；受高階晶片出口管制。', mods: { salary: 0.75 }, effTech: 0.85, controlled: true, exportEdition: true, regDecay: 0.85 },
    { id: 'taipei', name: '台北', en: 'Taipei', icon: '🧋', regions: ['tw'],
      desc: '晶片供應鏈就在旁邊，硬體好取得；資本市場比較保守。', mods: { gpuPrice: 0.9, salary: 0.8, valuation: 0.95 } },
    { id: 'tokyo', name: '東京', en: 'Tokyo', icon: '🗼', regions: ['jp'],
      desc: '企業客戶穩定，動漫與遊戲的創作市場龐大；資本較保守。', mods: { demand_ent: 1.1, demand_creative: 1.15, salary: 0.95, valuation: 0.95 } },
    { id: 'seoul', name: '首爾', en: 'Seoul', icon: '🎤', regions: ['kr'],
      desc: '記憶體大廠就在身邊，娛樂內容市場強；資本較保守。', mods: { gpuPrice: 0.96, demand_creative: 1.08, salary: 0.85, valuation: 0.95 } },
    { id: 'singapore', name: '新加坡', en: 'Singapore', icon: '🦁', regions: ['sg'],
      desc: '中立的區域樞紐，雲端與資金進出方便；地小人貴。', mods: { rentPrice: 0.9, valuation: 1.05, salary: 1.15 } },
  ];
  D.DEFAULT_CITY = 'taipei';
  D.DEFAULT_COMPANY = '鯨躍實驗室'; // 虛構的預設公司名（不用真實公司名）

  /* ---------- GPU：pf = H100 等效效能；price = 上市價（每張，美元） ---------- */
  D.GPUS = [
    { id: 'a100', name: 'A100', pf: 0.32, price: 12000, from: '2023-01', until: '2025-06', maker: 'nv' },
    { id: 'h100', name: 'H100', pf: 1.0, price: 30000, from: '2023-03', until: '2027-06', maker: 'nv', hi: true },
    { id: 'h200', name: 'H200', pf: 1.3, price: 34000, from: '2024-06', until: '2028-01', maker: 'nv', hi: true },
    { id: 'b200', name: 'B200', pf: 2.5, price: 45000, from: '2025-01', until: '2029-01', maker: 'nv', hi: true },
    { id: 'b300', name: 'B300', pf: 3.5, price: 55000, from: '2025-09', until: '2029-09', maker: 'nv', hi: true },
    { id: 'r100', name: 'Rubin', pf: 7, price: 80000, from: '2026-09', until: '2036-01', maker: 'nv', hi: true },
    { id: 'r300', name: 'Rubin Ultra', pf: 14, price: 120000, from: '2027-09', until: '2036-01', maker: 'nv', hi: true },
    { id: 'f100', name: 'Feynman', pf: 28, price: 170000, from: '2028-09', until: '2036-01', maker: 'nv', hi: true },
    { id: 'f300', name: 'Feynman Ultra', pf: 50, price: 230000, from: '2029-09', until: '2036-01', maker: 'nv', hi: true },
    { id: 'x100', name: '後 Feynman 世代', pf: 90, price: 300000, from: '2031-03', until: '2036-01', maker: 'nv', hi: true },
    { id: 'x300', name: '後 Feynman Ultra', pf: 160, price: 380000, from: '2033-01', until: '2036-01', maker: 'nv', hi: true },
    { id: 'h800', name: 'H800（出口版）', pf: 0.8, price: 32000, from: '2023-03', until: '2023-12', maker: 'nv', special: true },
    // 替代加速卡：不受出口管制的非輝達晶片（maker 'cn' 只是內部代號，畫面上不會出現）
    { id: 'c1', name: '替代加速卡 C1', pf: 0.25, price: 9000, from: '2023-01', until: '2025-12', maker: 'cn' },
    { id: 'c2', name: '替代加速卡 C2', pf: 0.6, price: 16000, from: '2024-06', until: '2027-06', maker: 'cn' },
    { id: 'c3', name: '替代加速卡 C3', pf: 1.6, price: 30000, from: '2026-01', until: '2029-01', maker: 'cn' },
    { id: 'c4', name: '替代加速卡 C4', pf: 4.5, price: 52000, from: '2028-01', until: '2036-01', maker: 'cn' },
    { id: 'c5', name: '替代加速卡 C5', pf: 12, price: 110000, from: '2029-06', until: '2036-01', maker: 'cn' },
    { id: 'c6', name: '替代加速卡 C6', pf: 30, price: 170000, from: '2031-06', until: '2036-01', maker: 'cn' },
  ];
  D.GPU_PACKS = [8, 64, 256, 1024, 4096, 16384];

  /* ---------- 機房：slots = 可容納卡數；upkeep = 每週固定支出 ---------- */
  D.DATACENTERS = [
    { lv: 0, name: '機櫃租用', slots: 256, cost: 0, weeks: 0, upkeep: 6000, icon: '🗄️' },
    { lv: 1, name: '小型機房', slots: 2048, cost: 5e6, weeks: 6, upkeep: 30000, icon: '🏠' },
    { lv: 2, name: 'IDC 整層', slots: 16384, cost: 50e6, weeks: 12, upkeep: 180000, icon: '🏬' },
    { lv: 3, name: '自建資料中心', slots: 100000, cost: 400e6, weeks: 26, upkeep: 900000, icon: '🏭' },
    { lv: 4, name: 'GW 級算力園區', slots: 500000, cost: 3e9, weeks: 52, upkeep: 4e6, icon: '🌆', from: '2025-01' },
    { lv: 5, name: '能源島超算', slots: 2000000, cost: 15e9, weeks: 78, upkeep: 15e6, icon: '🏝️', from: '2027-06' },
  ];

  /* ---------- 辦公室（人數上限） ---------- */
  D.OFFICES = [
    { lv: 0, name: '車庫', cap: 8, cost: 0, rent: 1500, icon: '🏚️' },
    { lv: 1, name: '新創辦公室', cap: 25, cost: 300000, rent: 8000, icon: '🏢' },
    { lv: 2, name: '科技園整層', cap: 80, cost: 3e6, rent: 30000, icon: '🏙️' },
    { lv: 3, name: '總部大樓', cap: 250, cost: 30e6, rent: 120000, icon: '🌇' },
    { lv: 4, name: '研發園區', cap: 800, cost: 200e6, rent: 500000, icon: '🏰' },
    { lv: 5, name: '全球研發網', cap: 2500, cost: 1e9, rent: 2e6, icon: '🌐' },
  ];
  D.OFFICES.forEach((o) => { o.img = 'assets/office_' + o.lv + '.webp'; });
  D.OFFICE_DESC = [
    '改裝的車庫：水泥地鋪上鯨魚地毯，兩張桌子、兩櫃二手 GPU、一圈小燈串，捲門上貼著自己畫的鯨魚標誌，還有吃不完的披薩。',
    '第一間租來的辦公室：四人島型桌、鯨魚品牌牆和寫滿 loss 曲線的白板，玻璃機房裡兩櫃伺服器閃著藍光，咖啡機終於不用自己帶。',
    '科技園整層：兩組島型桌、玻璃會議室、牆上大螢幕掛著訓練儀表板，休息區的沙發上窩著鯨魚抱枕。',
    '總部大樓：大廳一整面鯨魚水族箱、深藍接待櫃台與「模型帝國」招牌，三組島型桌和六櫃機房。',
    '研發園區：室內大樹中庭、機器手臂與小機器人的實驗區、四組島型桌，機房頂上跑著冷卻管。',
    '全球研發網：全息地球懸在指揮中心正中央，環形控制台、全球網路大螢幕、三排機櫃，窗外看得到海上的鯨魚。',
  ];

  /* ---------- 職能 ---------- */
  D.ROLES = {
    res: { name: '研究員', icon: '🧠', salary: 6000, desc: '產出研究點（RP），頂尖研究員提升模型訓練效果。' },
    eng: { name: '基礎設施工程師', icon: '🛠️', salary: 4200, desc: '提升叢集利用率（MFU）、降低訓練故障；大叢集需要更多工程師。' },
    data: { name: '資料工程師', icon: '📚', salary: 2800, desc: '爬取與清洗資料，提升資料品質。' },
    align: { name: '對齊研究員', icon: '🛡️', salary: 4800, desc: '提升安全對齊效果、降低事故與監管壓力。' },
    biz: { name: '產品商務', icon: '💼', salary: 3200, desc: '提升產品吸引力、企業客戶與營收。' },
  };
  D.ROLE_ORDER = ['res', 'eng', 'data', 'align', 'biz'];

  D.TRAITS = {
    scaling: { name: 'Scaling 信徒', desc: '模型訓練有效算力 +{v}%' },
    infra: { name: '叢集馴獸師', desc: 'MFU +{v}%、訓練故障 -30%' },
    data_guru: { name: '資料潔癖', desc: '資料品質 +{v}%' },
    safety_mom: { name: '安全守門人', desc: '模型安全 +{v}、監管壓力衰減加快' },
    open_evang: { name: '開源佈道者', desc: '開源發布社群收益 +{v}%，社群緩慢成長' },
    rl_wizard: { name: 'RL 魔法師', desc: '推理能力 +{v}' },
    product_genius: { name: '產品鬼才', desc: '對話 App 與創作市場吸引力 +{v}%' },
    deal_maker: { name: '金牌業務', desc: '企業市場營收 +{v}%' },
    mm_artist: { name: '多模態藝術家', desc: '多模態能力 +{v}' },
    agent_pioneer: { name: 'Agent 先驅', desc: 'Agent 能力 +{v}' },
    efficiency_hacker: { name: '效率駭客', desc: '推理成本 -{v}%' },
    fundraiser: { name: '募資高手', desc: '公司估值 +{v}%' },
    mentor: { name: '帶教導師', desc: '全員技能成長加快' },
    celebrity: { name: '業界網紅', desc: '聲望緩慢上升、招募品質提升' },
  };

  /* ---------- 模型能力 ---------- */
  D.STATS = {
    know: { name: '知識', short: '知', color: '#4e9af1' },
    lang: { name: '語言', short: '語', color: '#e86a9d' },
    code: { name: '程式', short: '程', color: '#9b7bf0' },
    reason: { name: '推理', short: '推', color: '#f0a33a' },
    mm: { name: '多模態', short: '多', color: '#3cb6b0' },
    ctx: { name: '長文本', short: '長', color: '#7a8ca3' },
    agent: { name: 'Agent', short: 'A', color: '#e2624f' },
    safety: { name: '安全', short: '安', color: '#52b36e' },
  };
  D.STAT_ORDER = ['know', 'lang', 'code', 'reason', 'mm', 'ctx', 'agent', 'safety'];
  /* 綜合分權重隨時代改變（越後期越看重推理與 Agent） */
  D.ERA_WEIGHTS = [
    { from: '2023-01', w: { lang: 0.3, know: 0.3, code: 0.2, reason: 0.15, safety: 0.05 } },
    { from: '2024-09', w: { lang: 0.22, know: 0.22, code: 0.22, reason: 0.24, mm: 0.05, safety: 0.05 } },
    { from: '2025-03', w: { lang: 0.17, know: 0.18, code: 0.2, reason: 0.22, mm: 0.08, agent: 0.1, safety: 0.05 } },
    { from: '2027-01', w: { lang: 0.14, know: 0.15, code: 0.19, reason: 0.2, mm: 0.1, agent: 0.17, safety: 0.05 } },
  ];

  /* ---------- 架構 ---------- */
  D.ARCHS = [
    { id: 'dense', name: '稠密 Transformer', tech: null, act: 1, mfu: 1, risk: 1, desc: '所有參數一起算。穩定、好訓練，但推理成本與參數成正比。' },
    { id: 'moe', name: '混合專家 MoE', tech: 't_moe', act: 1 / 8, mfu: 0.85, risk: 1.6, desc: '每個 token 只啟用一部分專家：同樣算力撐起大得多的模型，但訓練較不穩定。' },
    { id: 'moe_mla', name: 'MoE + MLA', tech: 't_mla', needs: ['t_moe'], act: 1 / 12, mfu: 0.88, risk: 1.4, ctx: 10, infer: 0.75, desc: '低秩壓縮 KV 快取：長文本友好、推理大幅省卡。' },
    { id: 'hybrid', name: 'MoE + 混合注意力', tech: 't_hybrid', needs: ['t_moe'], act: 1 / 14, mfu: 0.9, risk: 1.35, ctx: 22, infer: 0.7, codePen: 0.97, desc: '線性/狀態空間層與少量注意力交錯：超長文本又快又省，精確任務略吃虧。' },
    { id: 'sparse', name: 'MoE + 稀疏注意力', tech: 't_sparse', needs: ['t_mla'], act: 1 / 16, mfu: 0.92, risk: 1.25, ctx: 26, infer: 0.6, reason: 3, desc: '只對最相關的 token 做全注意力：長文更省、推理更準。' },
  ];

  D.SIZES = [1, 3, 7, 14, 32, 70, 140, 236, 400, 671, 1000, 1600, 2400, 4000, 8000, 16000, 32000, 64000, 128000]; // B 參數（總量）
  D.TOKEN_STEPS = [50, 100, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 8000, 10000, 15000, 20000, 30000, 40000, 60000, 100000, 150000, 200000, 300000, 500000, 1000000, 2000000]; // B tokens
  D.POST_LEVELS = [
    { id: 'lite', name: '輕量', i: 0.03 },
    { id: 'std', name: '標準', i: 0.06 },
    { id: 'heavy', name: '重度', i: 0.12 },
    { id: 'max', name: '極限 RL', i: 0.25, tech: 't_cot' },
  ];

  /* ---------- 資料池（單位：B tokens；inst = K 筆指令/偏好資料） ---------- */
  D.DATA_POOLS = {
    web: { name: '網頁', icon: '🌐', q: 0.5, cap0: 14000, capGrow: 2500 },
    code: { name: '程式碼', icon: '💻', q: 0.68, cap0: 1600, capGrow: 400 },
    sci: { name: '書籍論文', icon: '📖', q: 0.85, cap0: 900, capGrow: 150 },
    mm: { name: '圖文影音', icon: '🎞️', q: 0.6, cap0: 20000, capGrow: 8000 },
  };
  D.MIX_KEYS = ['web', 'code', 'sci', 'mm'];
  D.DATA_DEALS = [
    { id: 'news', name: '新聞媒體授權', pool: 'web', amt: 300, q: 0.85, price: 2e6, desc: '高品質新聞與評論文章' },
    { id: 'books', name: '出版社書庫授權', pool: 'sci', amt: 200, q: 0.92, price: 3.5e6, desc: '正版書籍，乾淨無版權風險' },
    { id: 'papers', name: '學術論文庫', pool: 'sci', amt: 150, q: 0.95, price: 2.5e6, desc: '數理與科學論文' },
    { id: 'codehost', name: '程式碼平台合作', pool: 'code', amt: 500, q: 0.8, price: 5e6, desc: '含授權的開源與私有程式碼', from: '2023-06' },
    { id: 'media', name: '圖庫影音授權', pool: 'mm', amt: 3000, q: 0.85, price: 6e6, desc: '圖片、影片與字幕對齊資料', from: '2023-06' },
    { id: 'forum', name: '問答論壇資料', pool: 'web', amt: 400, q: 0.75, price: 3e6, desc: '高品質問答與討論', from: '2024-01' },
    { id: 'robotics', name: '機器人軌跡資料', pool: 'mm', amt: 1500, q: 0.9, price: 30e6, desc: '真實機器人操作軌跡', from: '2026-06' },
  ];

  /* ---------- 市場區隔 ---------- */
  D.SEGMENTS = {
    chat: { name: '對話 App', icon: '💬', from: '2023-01', v0: 15e6, g: 1.9, beta: 0.8, w: { lang: 0.35, know: 0.3, reason: 0.1, mm: 0.15, safety: 0.1 }, unit: '訂閱用戶', priceUnit: '/月', ref0: 20, refDecay: 1 },
    api: { name: '開發者 API', icon: '🔌', from: '2023-01', v0: 8e6, g: 2.15, beta: 1.1, w: { code: 0.25, reason: 0.25, know: 0.2, lang: 0.2, ctx: 0.1 }, unit: 'Token', priceUnit: '/百萬 token', ref0: 8, refDecay: 0.6 },
    ent: { name: '企業方案', icon: '🏦', from: '2023-03', v0: 6e6, g: 2.0, beta: 0.4, w: { know: 0.25, ctx: 0.2, safety: 0.25, agent: 0.1, lang: 0.2 }, unit: '企業客戶', priceUnit: '/席/月', ref0: 60, refDecay: 0.95 },
    coding: { name: '程式碼助手', icon: '⌨️', from: '2023-06', v0: 1.2e6, g: 2.5, beta: 0.8, w: { code: 0.55, reason: 0.2, ctx: 0.15, agent: 0.1 }, unit: '開發者', priceUnit: '/月', ref0: 19, refDecay: 1 },
    creative: { name: '多模態創作', icon: '🎨', from: '2024-02', v0: 3e6, g: 1.9, beta: 0.8, w: { mm: 0.6, lang: 0.3, know: 0.1 }, unit: '創作者', priceUnit: '/月', ref0: 30, refDecay: 0.95, tech: 't_imagegen' },
    agent: { name: 'Agent 自動化', icon: '🤖', from: '2025-03', v0: 8e6, g: 2.6, beta: 0.7, w: { agent: 0.45, reason: 0.25, code: 0.15, ctx: 0.15 }, unit: '任務', priceUnit: '/任務', ref0: 2, refDecay: 0.8, tech: 't_tools', minStat: { agent: 20 } },
    robot: { name: '具身機器人', icon: '🦾', from: '2027-01', v0: 5e6, g: 2.8, beta: 0.5, w: { agent: 0.3, mm: 0.4, reason: 0.3 }, unit: '機器人', priceUnit: '/台/月', ref0: 500, refDecay: 0.9, tech: 't_vla' },
  };
  D.SEG_ORDER = ['chat', 'api', 'ent', 'coding', 'creative', 'agent', 'robot'];
  D.PRICE_TIERS = [
    { id: 'free', name: '免費（引流）', m: 0.15, rev: 0.15, desc: '幾乎不賺錢，但吸引力極高；對話 App 靠廣告有少量收入' },
    { id: 'low', name: '低價', m: 0.5, rev: 0.5, desc: '以價換量' },
    { id: 'mid', name: '市場價', m: 1.0, rev: 1.0, desc: '與市場平均持平' },
    { id: 'high', name: '高價', m: 1.6, rev: 1.6, desc: '高毛利，需要能力撐得起' },
    { id: 'lux', name: '奢華旗艦', m: 2.6, rev: 2.6, desc: '只有頂尖模型賣得動' },
  ];
  D.MARKETING = [0, 10000, 50000, 200000, 1e6, 5e6, 20e6];

  /* ---------- 對手 ---------- */
  /* c0 = 首發綜合分；slope = 每年進步；price = 價格倍率；dist = 各市場通路加成 */
  D.RIVALS = [
    { id: 'sky', agi: 0.92, name: '天穹智能', en: 'Skydome', icon: '☁️', color: '#5b8def', series: 'Sky', style: '閉源龍頭', start: '2023-01', c0: 60, slope: 4.9, cadence: 30, price: 1.45, open: false,
      prof: { know: 1.04, lang: 1.04, code: 1.0, reason: 1.04, mm: 1.05, ctx: 0.98, agent: 1.0, safety: 0.9 }, dist: { chat: 2.0, api: 1.2, ent: 0.8, coding: 0.6, creative: 0.4, agent: 0.6 }, reasonFrom: '2024-09', agentFrom: '2025-01', mmFrom: '2023-09' },
    { id: 'mono', agi: 1, name: '巨石科技', en: 'Monolith', icon: '🗿', color: '#7a6ff0', series: 'Mono', style: '科技巨頭全家桶', start: '2023-03', c0: 50, slope: 6.2, cadence: 32, price: 1.0, open: false,
      prof: { know: 1.06, lang: 0.98, code: 0.96, reason: 0.98, mm: 1.12, ctx: 1.1, agent: 0.96, safety: 0.95 }, dist: { chat: 1.1, ent: 0.9, creative: 0.7, api: 0.5, robot: 0.6 }, reasonFrom: '2024-12', agentFrom: '2025-04', mmFrom: '2023-12' },
    { id: 'beacon', agi: 0.95, name: '燈塔實驗室', en: 'Beacon', icon: '🗼', color: '#d08a4e', series: 'Lumen', style: '安全派', start: '2023-03', c0: 52, slope: 5.7, cadence: 30, price: 1.35, open: false,
      prof: { know: 1.0, lang: 1.06, code: 1.06, reason: 1.0, mm: 0.9, ctx: 1.08, agent: 1.06, safety: 1.25 }, dist: { ent: 0.9, coding: 0.9, api: 0.5, agent: 0.5 }, reasonFrom: '2025-02', agentFrom: '2024-10', mmFrom: '2024-03' },
    { id: 'star', agi: 0.9, name: '群星開源', en: 'Starfield', icon: '✨', color: '#3fae8c', series: 'Stella', style: '開源派', start: '2023-02', c0: 44, slope: 6.2, cadence: 30, price: 0.2, open: true,
      prof: { know: 1.0, lang: 1.0, code: 0.98, reason: 0.96, mm: 0.85, ctx: 0.95, agent: 0.92, safety: 0.85 }, dist: { api: 0.5, coding: 0.2 }, reasonFrom: '2025-04', agentFrom: '2025-06', mmFrom: '2024-09' },
    { id: 'hive', agi: 0.85, name: '蜂巢', en: 'Hive', icon: '🐝', color: '#e0b532', series: 'Honey', style: '超級 App 巨頭', start: '2023-04', c0: 45, slope: 5.7, cadence: 26, price: 0.6, open: false, freeChat: true,
      prof: { know: 0.98, lang: 1.08, code: 0.9, reason: 0.92, mm: 1.1, ctx: 0.95, agent: 0.95, safety: 0.95 }, dist: { chat: 1.7, creative: 0.9, robot: 0.4 }, reasonFrom: '2025-02', agentFrom: '2025-06', mmFrom: '2023-11' },
    { id: 'gale', agi: 1.08, name: '疾風 AI', en: 'Gale', icon: '🌪️', color: '#d9534f', series: 'Gust', style: '低成本效率黑馬', start: '2024-01', c0: 55, slope: 6.3, cadence: 24, price: 0.35, open: true,
      prof: { know: 0.98, lang: 0.96, code: 1.06, reason: 1.08, mm: 0.8, ctx: 1.0, agent: 0.98, safety: 0.85 }, dist: { api: 0.7, coding: 0.4, agent: 0.3 }, reasonFrom: '2025-01', agentFrom: '2025-06', mmFrom: '2025-03' },
  ];

  /* ---------- 科技樹 ---------- */
  /* cost = 研究點，開始研究時先付；dur = 研究要幾週；pub = 世界公開日期（之後成本 ×0.6，之前是前沿探索 ×1.6～2.2、研究時間 ×1.3）；eff = 效果。
     line = 路線；excl = 互斥組（同一組只能選一項）；spec = 推測的未來技術（論文只是出發點，技術本身還不存在）；key = 記進編年史。
     論文出處在 history.js 的 papers，以科技 id 對應 */
  D.TECH_CATS = {
    arch: { name: '架構', icon: '🏗️' },
    train: { name: '訓練', icon: '🔥' },
    post: { name: '後訓練', icon: '🎯' },
    infer: { name: '推理部署', icon: '⚡' },
    safety: { name: '安全', icon: '🛡️' },
    mm: { name: '多模態', icon: '🎨' },
    data: { name: '資料', icon: '📚' },
    agent: { name: 'Agent', icon: '🤖' },
    biz: { name: '產品策略', icon: '💼' },
  };
  D.TECH_LINES = {
    scale: { name: '規模派', icon: '🏭', desc: '更大的叢集、更久的訓練：相信算力能解決大部分問題。' },
    effi: { name: '效率派', icon: '⚙️', desc: '用演算法換算力：同樣的卡訓出更大的模型，推理更便宜。' },
    reason: { name: '推理派', icon: '🧮', desc: '讓模型學會長思考：推理與程式能力是下一個戰場。' },
    agent: { name: '代理派', icon: '🤖', desc: '從聊天走向行動，最後讓 AI 自己做研究。' },
    media: { name: '多模態派', icon: '🎨', desc: '看、聽、生成，再走進真實世界的機器人。' },
    safe: { name: '對齊派', icon: '🛡️', desc: '讓越來越強的模型仍然可靠、可被監督。' },
    data: { name: '資料派', icon: '📚', desc: '資料品質與來源決定模型的上限。' },
    serve: { name: '產品派', icon: '💼', desc: '把模型便宜又穩定地送到客戶手上，賺到下一輪的錢。' },
  };
  D.TECH_EXCL = {
    x_seq: '下一代序列骨幹', x_attn: '長文本架構', x_next: '後 Transformer 押注', x_cluster: '叢集路線', x_takeoff: '起飛策略',
    x_pref: '偏好優化方法', x_search: '推理搜尋方法', x_chip: '算力來源', x_align: '對齊方法', x_robot: '具身路線',
    x_data: '資料來源策略', x_agent: 'Agent 架構', x_biz: '主攻客群', x_open: '權重策略',
  };
  D.TECHS = [
    // 架構
    { id: 't_flash', cat: 'arch', line: 'effi', name: 'FlashAttention', cost: 60, dur: 2, pub: '2022-05', eff: { algo: 1.12, ctx: 4 }, desc: 'IO 感知的注意力實作：更快、更省記憶體。' },
    { id: 't_gqa', cat: 'arch', line: 'effi', name: 'GQA 分組查詢注意力', cost: 120, dur: 3, pub: '2023-05', req: ['t_flash'], eff: { infer: 0.85 }, desc: '多個查詢頭共享 KV：推理成本 -15%。' },
    { id: 't_rope', cat: 'arch', line: 'effi', name: 'RoPE 長上下文擴展', cost: 160, dur: 3, pub: '2023-06', req: ['t_flash'], eff: { ctx: 15 }, desc: '位置插值把上下文從 4K 拉到 128K。' },
    { id: 't_rwkv', cat: 'arch', line: 'effi', excl: 'x_seq', name: 'RWKV 線性時間架構', cost: 600, dur: 8, pub: '2023-05', req: ['t_gqa'], eff: { infer: 0.85 }, desc: '像 RNN 一樣線性時間，又能像 Transformer 一樣平行訓練：推理成本 -15%。' },
    { id: 't_retnet', cat: 'arch', line: 'effi', excl: 'x_seq', name: 'RetNet 保留式網路', cost: 600, dur: 8, pub: '2023-07', req: ['t_gqa'], eff: { ctx: 8, infer: 0.95 }, desc: '訓練時平行、推理時遞迴：長文本 +8、推理成本 -5%。' },
    { id: 't_mamba', cat: 'arch', line: 'effi', excl: 'x_seq', name: 'Mamba 狀態空間模型', cost: 600, dur: 8, pub: '2023-12', req: ['t_gqa'], eff: { algo: 1.08, ctx: 4 }, desc: '選擇性狀態空間取代部分注意力：有效算力 +8%、長文本 +4。' },
    { id: 't_moe', cat: 'arch', line: 'effi', key: true, name: 'MoE 混合專家', cost: 420, dur: 6, pub: '2023-12', req: ['t_3d'], eff: { unlockArch: 'moe' }, desc: '解鎖 MoE 架構：只啟用部分專家，參數規模大躍進。' },
    { id: 't_finemoe', cat: 'arch', line: 'effi', name: '細粒度 MoE + 共享專家', cost: 800, dur: 8, pub: '2024-01', req: ['t_moe'], eff: { moeEff: 0.06, risk: 0.85 }, desc: '更多更小的專家：MoE 等效規模提升、路由更穩定。' },
    { id: 't_mla', cat: 'arch', line: 'effi', name: 'MLA 多頭潛在注意力', cost: 1050, dur: 10, pub: '2024-05', req: ['t_moe', 't_gqa'], eff: { unlockArch: 'moe_mla' }, desc: '解鎖 MoE+MLA：KV 快取壓縮，長文本與推理成本大幅改善。' },
    { id: 't_hybrid', cat: 'arch', line: 'effi', excl: 'x_attn', name: '線性 / SSM 混合注意力', cost: 1950, dur: 14, pub: '2025-01', req: ['t_moe', 't_rope'], eff: { unlockArch: 'hybrid' }, desc: '解鎖 MoE+混合注意力：超長文本又快又省，但精確任務略吃虧。' },
    { id: 't_sparse', cat: 'arch', line: 'effi', excl: 'x_attn', name: '稀疏注意力 DSA', cost: 2850, dur: 16, pub: '2025-09', req: ['t_mla'], eff: { unlockArch: 'sparse' }, desc: '解鎖 MoE+稀疏注意力：長文更省、推理更準，但要先走完 MLA。' },
    { id: 't_mctx', cat: 'arch', line: 'effi', name: '百萬 token 上下文', cost: 5200, dur: 18, pub: '2026-04', req: ['t_mla'], eff: { ctx: 25, agent: 3 }, desc: '一次讀完整個程式庫或一整套書：長文本 +25、Agent +3。' },
    { id: 't_titans', cat: 'arch', line: 'effi', name: 'Titans 神經長期記憶', cost: 5750, dur: 20, pub: '2024-12', req: ['t_mctx'], eff: { ctx: 10, agent: 2 }, desc: '模型邊讀邊把重點寫進神經記憶：長文本 +10、Agent +2。' },
    { id: 't_mercury', cat: 'arch', line: 'effi', excl: 'x_next', name: '擴散式語言模型', cost: 10400, dur: 26, pub: '2025-06', req: ['t_mtp'], eff: { infer: 0.7 }, desc: '用擴散一次生成整段文字，不再逐字吐：推理成本 -30%。' },
    { id: 't_hrm', cat: 'arch', line: 'reason', excl: 'x_next', name: '階層推理模型', cost: 10400, dur: 26, pub: '2025-06', req: ['t_cot'], eff: { reason: 6 }, desc: '高層慢思考、低層快計算的循環架構：推理 +6。' },
    { id: 't_rlm', cat: 'arch', line: 'agent', excl: 'x_next', name: '遞迴語言模型', cost: 10400, dur: 26, pub: '2025-12', req: ['t_mctx'], eff: { ctx: 12, agent: 2 }, desc: '模型把超長輸入當環境，自己切塊、自己呼叫自己：長文本 +12、Agent +2。' },
    // 訓練
    { id: 't_3d', cat: 'train', line: 'scale', name: '3D 平行訓練', cost: 150, dur: 3, pub: '2021-04', eff: { maxSize: 128000 }, desc: '張量/管線/資料平行：可訓練超過 34B 的模型。' },
    { id: 't_zero', cat: 'train', line: 'scale', name: 'ZeRO 記憶體最佳化', cost: 220, dur: 4, pub: '2019-10', req: ['t_3d'], eff: { mfu: 1.08 }, desc: '把優化器狀態切開分散到各卡：吞吐量 +8%。' },
    { id: 't_chin', cat: 'train', line: 'scale', name: 'Chinchilla 配比法則', cost: 120, dur: 3, pub: '2022-03', eff: { algo: 1.06 }, desc: '搞清楚參數和資料該怎麼配：有效算力 +6%。' },
    { id: 't_dedup', cat: 'train', line: 'data', name: '資料去重與品質過濾', cost: 140, dur: 3, pub: '2022-06', eff: { dataQ: 0.12 }, desc: '去掉重複與垃圾文本：資料品質 +12%。' },
    { id: 't_curr', cat: 'train', line: 'data', name: '課程學習與退火', cost: 700, dur: 8, pub: '2024-04', req: ['t_dedup'], eff: { algo: 1.15, reason: 2 }, desc: '先易後難、末段高品質退火：有效算力 +15%。' },
    { id: 't_mtp', cat: 'train', line: 'effi', name: '多 token 預測', cost: 900, dur: 8, pub: '2024-04', req: ['t_3d'], eff: { algo: 1.12, infer: 0.9 }, desc: '一次預測多個 token：訓練更有效、推理可加速。' },
    { id: 't_resil', cat: 'train', line: 'scale', name: '萬卡容錯訓練', cost: 800, dur: 8, pub: '2024-07', req: ['t_3d'], eff: { fail: 0.4, mfu: 1.05 }, desc: '自動斷點續訓與故障隔離：訓練故障 -60%。' },
    { id: 't_fp8', cat: 'train', line: 'effi', name: 'FP8 混合精度', cost: 1250, dur: 10, pub: '2024-12', req: ['t_3d'], eff: { mfu: 1.3 }, desc: '用 8 位元浮點訓練：吞吐量 +30%。' },
    { id: 't_synth', cat: 'train', line: 'data', name: '合成資料管線', cost: 500, dur: 6, pub: '2023-06', req: ['t_dedup'], eff: { unlock: 'synth' }, desc: '解鎖「合成資料」：用自家模型生成教科書級語料，突破資料牆。' },
    { id: 't_distill', cat: 'train', line: 'effi', name: '知識蒸餾', cost: 450, dur: 5, pub: '2023-01', req: ['t_dedup'], eff: { unlock: 'distill' }, desc: '解鎖「蒸餾」：用大模型當老師，小模型能力大增。' },
    { id: 't_muon', cat: 'train', line: 'scale', name: 'Muon 優化器', cost: 2850, dur: 14, pub: '2025-02', req: ['t_curr'], eff: { algo: 1.25 }, desc: '新一代矩陣優化器：同樣算力訓出更好的模型。' },
    { id: 't_diloco', cat: 'train', line: 'scale', name: '跨機房分散訓練', cost: 1800, dur: 12, pub: '2023-11', req: ['t_resil'], eff: { mfu: 1.08, rentCap: 1.3 }, desc: '少量通訊就能跨機房同步：吞吐量 +8%、可租訓練算力 +30%。' },
    { id: 't_megacluster', cat: 'train', line: 'scale', excl: 'x_cluster', name: '超大單體叢集', cost: 3500, dur: 20, pub: '2020-01', req: ['t_diloco', 't_fp8'], eff: { mfu: 1.12, fail: 0.8, power: 1.1 }, desc: '相信規模定律，把所有卡塞進同一個叢集：吞吐量 +12%、故障 -20%，電費 +10%。' },
    { id: 't_intellect', cat: 'train', line: 'scale', excl: 'x_cluster', name: '全球去中心化訓練', cost: 4000, dur: 20, pub: '2024-12', req: ['t_diloco'], eff: { rentMul: 0.8, rentCap: 1.5, community: 0.05 }, desc: '把全世界的閒置算力串起來訓練：雲端租價 -20%、可租訓練算力 +50%，社群緩慢成長。' },
    { id: 't_airesearch', cat: 'train', line: 'agent', spec: true, key: true, name: 'AI 自動化研究員', cost: 15600, dur: 30, pub: '2027-03', req: ['t_agentrl', 't_muon'], eff: { algo: 1.35, rpMul: 1.5, slots: 1, agi: 1.1 }, desc: '讓 Agent 自己讀論文、寫實驗、跑消融：研究速度 ×1.5、有效算力 ×1.35、研究線 +1，AGI 進度速度 +10%。' },
    { id: 't_contlearn', cat: 'train', line: 'scale', spec: true, name: '持續學習模型', cost: 23400, dur: 30, pub: '2028-03', req: ['t_airesearch'], eff: { fresh: 0.5, algo: 1.05 }, desc: '模型上線後還能持續學新東西又不忘舊的：模型老化速度減半、有效算力 +5%。' },
    { id: 't_selfimprove', cat: 'train', line: 'agent', excl: 'x_takeoff', spec: true, key: true, name: '遞迴自我改進', cost: 39000, dur: 36, pub: '2028-09', req: ['t_airesearch'], eff: { algo: 1.7, rpMul: 1.4, agi: 1.25, incidentMul: 1.6 }, desc: '模型參與設計下一代模型：有效算力 ×1.7、AGI 進度速度 +25%。沒有「可擴展監督」時，事故風險 ×1.6。' },
    { id: 't_ctrltakeoff', cat: 'train', line: 'safe', excl: 'x_takeoff', spec: true, key: true, name: '受控起飛', cost: 39000, dur: 36, pub: '2028-09', req: ['t_airesearch', 't_oversight'], eff: { algo: 1.35, rpMul: 1.2, agi: 1.12, safety: 6 }, desc: '每一步自我改進都先過人類審查：有效算力 ×1.35、AGI 進度速度 +12%、安全 +6。' },
    { id: 't_agi_core', cat: 'train', line: 'agent', spec: true, key: true, name: '通用智慧整合架構', cost: 65000, dur: 40, pub: '2030-06', req: ['t_airesearch', 't_longrl'], eff: { agi: 1.15, know: 3, lang: 3, code: 3, reason: 3, agent: 3 }, desc: '把記憶、規劃、感知與行動整合成同一個系統：五項核心能力各 +3、AGI 進度速度 +15%。' },
    // 後訓練
    { id: 't_rlhf', cat: 'post', line: 'safe', name: 'RLHF 人類回饋強化學習', cost: 100, dur: 2, pub: '2022-03', eff: { help: 1.25, safeEff: 1.25 }, desc: '讓模型學會「好好說話」：有用性與安全後訓練效果提升。' },
    { id: 't_selfinstr', cat: 'post', line: 'data', name: 'Self-Instruct 指令合成', cost: 130, dur: 3, pub: '2022-12', req: ['t_rlhf'], eff: { inst: 1.2 }, desc: '讓模型自己生成指令資料：指令資料效率 +20%。' },
    { id: 't_dpo', cat: 'post', line: 'safe', name: 'DPO 直接偏好優化', cost: 260, dur: 4, pub: '2023-05', req: ['t_rlhf'], eff: { postCost: 0.6, help: 1.1 }, desc: '不用獎勵模型的偏好優化：後訓練成本 -40%。' },
    { id: 't_kto', cat: 'post', line: 'data', excl: 'x_pref', name: 'KTO 展望理論優化', cost: 800, dur: 6, pub: '2024-02', req: ['t_dpo'], eff: { inst: 1.2, postCost: 0.9 }, desc: '只要一個「好／壞」標籤，不必成對比較：指令資料效率 +20%、後訓練成本 -10%。' },
    { id: 't_orpo', cat: 'post', line: 'effi', excl: 'x_pref', name: 'ORPO 單體偏好優化', cost: 800, dur: 6, pub: '2024-03', req: ['t_dpo'], eff: { postCost: 0.8, help: 1.05 }, desc: '不需要參考模型，一次訓完：後訓練成本 -20%、有用性 +5%。' },
    { id: 't_cai', cat: 'post', line: 'safe', name: '憲法式 AI', cost: 320, dur: 5, pub: '2022-12', req: ['t_rlhf'], eff: { safety: 6, inst: 1.3 }, desc: '用原則讓 AI 監督 AI：安全 +6，指令資料效率提升。' },
    { id: 't_rbr', cat: 'post', line: 'safe', name: '規則式獎勵', cost: 1400, dur: 8, pub: '2024-11', req: ['t_cai'], eff: { safeEff: 1.1, help: 1.05 }, desc: '把安全規則直接寫進獎勵：安全後訓練效果 +10%、有用性 +5%。' },
    { id: 't_tools', cat: 'post', line: 'agent', key: true, name: '工具調用', cost: 380, dur: 5, pub: '2023-06', req: ['t_rlhf'], eff: { unlock: 'agent' }, desc: '解鎖 Agent 能力與後訓練方向：模型會呼叫 API、查資料、跑程式。' },
    { id: 't_cotprompt', cat: 'post', line: 'reason', name: '思維鏈提示', cost: 110, dur: 2, pub: '2022-01', eff: { reason: 2 }, desc: '讓模型一步一步寫出思路：推理 +2。' },
    { id: 't_verify', cat: 'post', line: 'reason', name: '逐步驗證獎勵', cost: 520, dur: 6, pub: '2023-05', req: ['t_cotprompt'], eff: { reason: 3 }, desc: '為解題的每一步打分，而不只看答案：推理 +3。' },
    { id: 't_cot', cat: 'post', line: 'reason', key: true, name: '思維鏈推理 RL', cost: 2100, dur: 14, pub: '2025-01', req: ['t_rlhf', 't_curr'], eff: { unlock: 'reasonRL' }, desc: '解鎖「推理強化」與「極限 RL」：用可驗證獎勵讓模型學會長思考，推理能力暴漲。' },
    { id: 't_ttc', cat: 'post', line: 'reason', name: '測試時計算擴展', cost: 2050, dur: 12, pub: '2024-09', req: ['t_cot'], eff: { reason: 8, code: 4, infer: 1.3 }, desc: '推理時多想一會：推理 +8、程式 +4，但推理成本 +30%。' },
    { id: 't_tot', cat: 'post', line: 'reason', excl: 'x_search', name: '思維樹', cost: 3000, dur: 16, pub: '2023-05', req: ['t_verify', 't_cot'], eff: { reason: 5, infer: 1.1 }, desc: '同時展開多條思路再回頭挑選：推理 +5，推理成本 +10%。' },
    { id: 't_tslm', cat: 'post', line: 'reason', excl: 'x_search', name: 'AlphaZero 式樹搜尋', cost: 3000, dur: 16, pub: '2023-09', req: ['t_verify', 't_cot'], eff: { reason: 7, infer: 1.25 }, desc: '解碼時用蒙地卡羅樹搜尋：推理 +7，但推理成本 +25%。' },
    { id: 't_prover', cat: 'post', line: 'reason', excl: 'x_search', name: '形式化定理證明', cost: 3450, dur: 16, pub: '2024-05', req: ['t_verify', 't_cot'], eff: { reason: 4, code: 4 }, desc: '用 Lean 驗證每一步，錯了就過不了：推理 +4、程式 +4。' },
    { id: 't_agentrl', cat: 'post', line: 'agent', key: true, name: 'Agentic RL', cost: 3900, dur: 18, pub: '2025-05', req: ['t_tools', 't_cot'], eff: { agentRL: true, agent: 4 }, desc: 'Agent 長任務強化學習：Agent 後訓練效果 ×3。' },
    { id: 't_longrl', cat: 'post', line: 'agent', name: '長任務訓練環境', cost: 9100, dur: 24, pub: '2025-03', req: ['t_agentrl'], eff: { agent: 5, code: 1 }, desc: '用幾小時才做得完的真實任務當訓練場：Agent +5、程式 +1。' },
    // 推理部署
    { id: 't_quant', cat: 'infer', line: 'serve', name: 'INT8/INT4 量化', cost: 120, dur: 3, pub: '2022-11', eff: { infer: 0.75 }, desc: '低位元推理：推理成本 -25%。' },
    { id: 't_paged', cat: 'infer', line: 'serve', name: 'PagedAttention 連續批次', cost: 220, dur: 4, pub: '2023-06', req: ['t_quant'], eff: { infer: 0.7 }, desc: '像作業系統管理記憶體一樣管理 KV 快取：推理成本 -30%。' },
    { id: 't_spec', cat: 'infer', line: 'serve', name: '投機解碼', cost: 300, dur: 4, pub: '2023-02', req: ['t_quant'], eff: { infer: 0.85 }, desc: '小模型打草稿、大模型驗證：推理成本 -15%。' },
    { id: 't_sglang', cat: 'infer', line: 'serve', name: 'SGLang 結構化推理', cost: 520, dur: 5, pub: '2023-12', req: ['t_paged'], eff: { infer: 0.88, agent: 1 }, desc: '共用前綴的 KV 快取、結構化輸出：推理成本 -12%、Agent +1。' },
    { id: 't_mooncake', cat: 'infer', line: 'serve', name: 'KV 快取分離架構', cost: 1600, dur: 10, pub: '2024-06', req: ['t_sglang'], eff: { infer: 0.85, ctx: 3 }, desc: '把 KV 快取獨立成一層儲存：推理成本 -15%、長文本 +3。' },
    { id: 't_route', cat: 'infer', line: 'serve', name: '模型路由', cost: 1050, dur: 7, pub: '2024-06', req: ['t_spec'], eff: { infer: 0.85 }, desc: '簡單問題交給小模型：推理成本 -15%。' },
    { id: 't_liquid', cat: 'infer', line: 'scale', name: '液冷與智慧調度', cost: 1800, dur: 12, pub: '2018-12', req: ['t_resil'], eff: { power: 0.8 }, desc: '液冷加上模型預測控制：電費 -20%。' },
    { id: 't_asic', cat: 'infer', line: 'scale', excl: 'x_chip', name: '自研 AI 加速器', cost: 7000, dur: 40, pub: '2017-04', req: ['t_resil'], eff: { gpuMul: 0.8, infer: 0.85 }, desc: '自己做晶片，不再完全看供應商臉色：購卡價 -20%、推理成本 -15%，但要做很久。' },
    { id: 't_lease', cat: 'infer', line: 'scale', excl: 'x_chip', name: '雲端算力長約', cost: 7000, dur: 26, pub: '2022-02', req: ['t_resil'], eff: { rentMul: 0.75, rentCap: 1.5 }, desc: '跟雲端業者簽多年長約：雲端租價 -25%、可租訓練算力 +50%。' },
    { id: 't_aichip', cat: 'infer', line: 'scale', name: 'AI 設計晶片', cost: 6000, dur: 26, pub: '2020-04', req: ['t_asic'], eff: { gpuMul: 0.85 }, desc: '用強化學習做晶片布局，下一代晶片更快出來：購卡價再 -15%。' },
    { id: 't_energy', cat: 'infer', line: 'scale', spec: true, name: '自建電廠與長期購電', cost: 19500, dur: 40, pub: '2027-06', req: ['t_liquid'], eff: { power: 0.7 }, desc: '算力園區直接接上專屬電廠：電費 -30%。' },
    // 安全
    { id: 't_redteam', cat: 'safety', line: 'safe', name: '紅隊測試體系', cost: 200, dur: 3, pub: '2022-08', eff: { safety: 6, incident: 0.75 }, desc: '上線前找人狠狠攻擊模型：安全 +6，事故機率 -25%。' },
    { id: 't_advtrain', cat: 'safety', line: 'safe', name: '對抗訓練', cost: 520, dur: 6, pub: '2023-07', req: ['t_redteam'], eff: { safety: 3, incident: 0.9 }, desc: '把自動找到的越獄咒語拿回來訓練：安全 +3、事故機率 -10%。' },
    { id: 't_guard', cat: 'safety', line: 'safe', name: '輸入輸出防護模型', cost: 450, dur: 5, pub: '2023-12', req: ['t_redteam'], eff: { incident: 0.8, segU: { ent: 0.1 } }, desc: '在主模型外面再套一層分類器：事故機率 -20%、企業市場吸引力小增。' },
    { id: 't_water', cat: 'safety', line: 'safe', name: '浮水印與內容溯源', cost: 350, dur: 5, pub: '2023-07', req: ['t_redteam'], eff: { regDecay: 0.3, incident: 0.9 }, desc: '生成內容可追溯：監管壓力衰減加快。' },
    { id: 't_comply', cat: 'safety', line: 'serve', name: '企業合規認證', cost: 420, dur: 6, pub: '2023-01', req: ['t_redteam'], eff: { unlock: 'entFull', regDecay: 0.2 }, desc: '資安與隱私認證：企業市場不再被打折扣。' },
    { id: 't_xrisk', cat: 'safety', line: 'safe', name: '極端風險評估', cost: 700, dur: 6, pub: '2023-05', req: ['t_redteam'], eff: { regDecay: 0.3, rep: 2 }, desc: '發布前先測模型有沒有危險能力：監管壓力衰減加快、聲望 +2。' },
    { id: 't_rsp', cat: 'safety', line: 'safe', name: '負責任擴展政策', cost: 900, dur: 6, pub: '2023-09', req: ['t_xrisk'], eff: { regDecay: 0.2, rep: 2, incident: 0.95 }, desc: '公開承諾：能力到某個門檻前，防護沒到位就不訓練。監管壓力衰減加快、聲望 +2。' },
    { id: 't_interp', cat: 'safety', line: 'safe', name: '可解釋性研究', cost: 1700, dur: 14, pub: '2024-05', req: ['t_redteam'], eff: { safety: 6, rep: 4, incident: 0.8 }, desc: '打開黑盒子看神經元在想什麼：安全 +6、聲望 +4。' },
    { id: 't_debate', cat: 'safety', line: 'safe', excl: 'x_align', name: '辯論式對齊', cost: 3000, dur: 16, pub: '2018-05', req: ['t_interp'], eff: { safety: 5, regDecay: 0.2 }, desc: '讓兩個模型互相挑錯，人類只當裁判：安全 +5、監管壓力衰減加快。' },
    { id: 't_breakers', cat: 'safety', line: 'safe', excl: 'x_align', name: '電路斷路器', cost: 3450, dur: 16, pub: '2024-06', req: ['t_interp'], eff: { safety: 7, incident: 0.8 }, desc: '模型內部一想走偏就直接斷路：安全 +7、事故機率 -20%。' },
    { id: 't_aictrl', cat: 'safety', line: 'safe', excl: 'x_align', name: 'AI 控制協定', cost: 3000, dur: 16, pub: '2023-12', req: ['t_interp'], eff: { incident: 0.6 }, desc: '就算模型想作弊也抓得到：事故機率 -40%。' },
    { id: 't_delib', cat: 'safety', line: 'safe', name: '審議式對齊', cost: 2750, dur: 12, pub: '2024-12', req: ['t_cot', 't_cai'], eff: { safety: 5, reason: 1 }, desc: '回答前先在思考裡對照安全規範：安全 +5、推理 +1。' },
    { id: 't_constclass', cat: 'safety', line: 'safe', name: '憲法分類器', cost: 2600, dur: 10, pub: '2025-01', req: ['t_guard', 't_cai'], eff: { incident: 0.7 }, desc: '用合成資料訓練的通用越獄防線：事故機率 -30%。' },
    { id: 't_cotmon', cat: 'safety', line: 'safe', name: '思維鏈監控', cost: 4150, dur: 14, pub: '2025-03', req: ['t_cot', 't_redteam'], eff: { safety: 3, incident: 0.8 }, desc: '讀模型的思考過程抓作弊：安全 +3、事故機率 -20%。' },
    { id: 't_faking', cat: 'safety', line: 'safe', name: '偽裝對齊偵測', cost: 4850, dur: 16, pub: '2024-12', req: ['t_interp'], eff: { safety: 3, incident: 0.9 }, desc: '測試模型會不會在被觀察時裝乖：安全 +3、事故機率 -10%。' },
    { id: 't_oversight', cat: 'safety', line: 'safe', spec: true, key: true, name: '可擴展監督', cost: 10400, dur: 30, pub: '2027-06', req: ['t_interp', 't_cai'], eff: { safety: 10, incident: 0.6, agiSafe: true }, desc: '用較弱的監督者可靠地監督更強的 AI——安全抵達 AGI 的必要條件。' },
    // 多模態
    { id: 't_clip', cat: 'mm', line: 'media', name: 'CLIP 圖文對比學習', cost: 110, dur: 3, pub: '2021-02', eff: { mm: 2 }, desc: '讓圖片和文字落在同一個空間：多模態 +2（要先有視覺理解才生效）。' },
    { id: 't_vision', cat: 'mm', line: 'media', key: true, name: '視覺理解', cost: 380, dur: 5, pub: '2023-04', eff: { unlock: 'mm' }, desc: '解鎖多模態能力：模型看得懂圖片。' },
    { id: 't_imagegen', cat: 'mm', line: 'media', name: '影像生成', cost: 500, dur: 6, pub: '2022-08', req: ['t_vision'], eff: { unlock: 'creative' }, desc: '解鎖「多模態創作」市場。' },
    { id: 't_dit', cat: 'mm', line: 'media', name: '擴散 Transformer', cost: 600, dur: 7, pub: '2022-12', req: ['t_imagegen'], eff: { mm: 3 }, desc: '用 Transformer 取代 U-Net 做擴散：多模態 +3。' },
    { id: 't_voice', cat: 'mm', line: 'media', name: '即時語音對話', cost: 1050, dur: 10, pub: '2024-05', req: ['t_vision'], eff: { chatBoost: 0.4 }, desc: '端到端語音：對話 App 吸引力大增。' },
    { id: 't_video', cat: 'mm', line: 'media', name: '影片生成', cost: 1700, dur: 14, pub: '2024-02', req: ['t_imagegen'], eff: { mm: 8, creativeBoost: 0.5 }, desc: '一句話生成電影級短片：多模態 +8、創作市場吸引力大增。' },
    { id: 't_moviegen', cat: 'mm', line: 'media', name: '影音一體生成', cost: 3450, dur: 16, pub: '2024-10', req: ['t_video', 't_dit'], eff: { mm: 5, segU: { creative: 0.3 } }, desc: '畫面、配樂、音效一起生成：多模態 +5、創作市場吸引力再增。' },
    { id: 't_genie', cat: 'mm', line: 'media', name: '可互動世界生成', cost: 4850, dur: 20, pub: '2024-02', req: ['t_video'], eff: { mm: 4, agent: 1 }, desc: '從影片學會一個能玩的世界：多模態 +4、Agent +1。' },
    { id: 't_vla', cat: 'mm', line: 'media', key: true, name: '具身 VLA / 世界模型', cost: 6500, dur: 24, pub: '2026-06', req: ['t_video', 't_tools'], eff: { unlock: 'robot', mm: 4 }, desc: '視覺—語言—動作模型：解鎖「具身機器人」市場。' },
    { id: 't_e2e', cat: 'mm', line: 'media', excl: 'x_robot', name: '端到端人形大腦', cost: 11700, dur: 28, pub: '2025-03', req: ['t_vla'], eff: { mm: 3, segU: { robot: 0.6 } }, desc: '從影像直接輸出全身動作：多模態 +3、機器人市場吸引力大增。' },
    { id: 't_jepa', cat: 'mm', line: 'reason', excl: 'x_robot', name: '聯合嵌入世界模型', cost: 10350, dur: 28, pub: '2024-02', req: ['t_vla'], eff: { mm: 5, reason: 3, agent: 2 }, desc: '不預測每個像素，只預測世界的抽象狀態：多模態 +5、推理 +3、Agent +2。' },
    // 資料
    { id: 't_stack', cat: 'data', line: 'data', name: '授權程式碼語料', cost: 170, dur: 3, pub: '2022-11', eff: { code: 2 }, desc: '只收寬鬆授權的開源程式碼：程式 +2。' },
    { id: 't_laion', cat: 'data', line: 'media', name: '大規模圖文資料集', cost: 200, dur: 3, pub: '2022-10', req: ['t_clip'], eff: { mm: 2 }, desc: '幾十億組圖片與說明文字：多模態 +2（要先有視覺理解才生效）。' },
    { id: 't_rag', cat: 'data', line: 'serve', name: 'RAG 檢索增強', cost: 420, dur: 5, pub: '2020-05', eff: { know: 3, segU: { ent: 0.15 } }, desc: '先查資料再回答：知識 +3、企業市場吸引力小增。' },
    { id: 't_selfrag', cat: 'data', line: 'serve', name: '自我檢索批判', cost: 1000, dur: 8, pub: '2023-10', req: ['t_rag'], eff: { know: 3 }, desc: '模型自己判斷該不該查、查到的對不對：知識 +3。' },
    { id: 't_orca', cat: 'data', line: 'data', name: '解釋軌跡學習', cost: 500, dur: 5, pub: '2023-06', req: ['t_distill'], eff: { inst: 1.1, know: 1 }, desc: '向強模型的詳細解釋學習：指令資料效率 +10%、知識 +1。' },
    { id: 't_synthscale', cat: 'data', line: 'data', excl: 'x_data', name: '合成資料規模化', cost: 2750, dur: 14, pub: '2024-06', req: ['t_synth'], eff: { synth: 1.6, inst: 1.1 }, desc: '全押合成資料：合成產量 +60%、指令資料效率 +10%。' },
    { id: 't_licenseall', cat: 'data', line: 'data', excl: 'x_data', name: '全面授權資料', cost: 2400, dur: 14, pub: '2023-10', req: ['t_fairuse'], eff: { dataQ: 0.03, riskDecay: 0.002, regDecay: 0.2 }, desc: '每筆資料都查清授權：資料品質 +3%、法律風險消退快、監管壓力衰減加快。' },
    { id: 't_flywheel', cat: 'data', line: 'data', excl: 'x_data', name: '用戶資料飛輪', cost: 2400, dur: 14, pub: '2016-02', req: ['t_dedup'], eff: { inst: 1.15, dataQ: 0.02, segU: { chat: 0.1 } }, desc: '資料留在用戶端，只回傳模型更新：指令資料效率 +15%、資料品質 +2%、對話吸引力小增。' },
    { id: 't_fairuse', cat: 'data', line: 'data', name: '資料合規審查', cost: 320, dur: 4, pub: '2023-03', req: ['t_dedup'], eff: { riskDecay: 0.001, regDecay: 0.1 }, desc: '搞清楚合理使用的界線：法律風險消退快、監管壓力衰減加快。' },
    { id: 't_unlearn', cat: 'data', line: 'safe', name: '機器遺忘', cost: 1250, dur: 8, pub: '2024-03', req: ['t_fairuse'], eff: { safety: 2, regDecay: 0.1, riskDecay: 0.001 }, desc: '讓模型忘掉危險知識和侵權內容：安全 +2、法律風險消退快。' },
    // Agent
    { id: 't_react', cat: 'agent', line: 'agent', name: 'ReAct 思考與行動', cost: 220, dur: 4, pub: '2022-10', req: ['t_tools'], eff: { agent: 2 }, desc: '想一步、做一步、看結果：Agent +2。' },
    { id: 't_reflex', cat: 'agent', line: 'agent', name: 'Reflexion 自我反思', cost: 480, dur: 5, pub: '2023-03', req: ['t_react'], eff: { agent: 2, reason: 1 }, desc: '做錯了自己寫檢討再來一次：Agent +2、推理 +1。' },
    { id: 't_swebench', cat: 'agent', line: 'agent', name: '真實程式任務基準', cost: 1100, dur: 8, pub: '2023-10', req: ['t_react'], eff: { code: 4 }, desc: '拿開源專案的真實 issue 當考題：程式 +4。' },
    { id: 't_mcp', cat: 'agent', line: 'agent', name: '工具標準協定', cost: 1600, dur: 8, pub: '2024-11', req: ['t_react'], eff: { agent: 3, segU: { ent: 0.1 } }, desc: '模型接工具的通用插座：Agent +3、企業市場吸引力小增。' },
    { id: 't_osworld', cat: 'agent', line: 'agent', name: '電腦操作 Agent', cost: 2550, dur: 12, pub: '2024-04', req: ['t_mcp'], eff: { agent: 4, segU: { agent: 0.2 } }, desc: '看螢幕、動滑鼠、完成整段工作流程：Agent +4、Agent 市場吸引力小增。' },
    { id: 't_memgpt', cat: 'agent', line: 'agent', excl: 'x_agent', name: '長期記憶 Agent', cost: 2400, dur: 14, pub: '2023-10', req: ['t_reflex'], eff: { agent: 5, ctx: 3 }, desc: '把上下文當作業系統的記憶體管理：Agent +5、長文本 +3。' },
    { id: 't_autogen', cat: 'agent', line: 'agent', excl: 'x_agent', name: '多 Agent 協作', cost: 2400, dur: 14, pub: '2023-08', req: ['t_reflex'], eff: { agent: 4, code: 3 }, desc: '一群專精的 Agent 互相對話分工：Agent +4、程式 +3。' },
    { id: 't_copilot', cat: 'agent', line: 'serve', name: '內部 AI 程式助手', cost: 600, dur: 6, pub: '2023-02', req: ['t_tools'], eff: { durMul: 0.9, rpMul: 1.08 }, desc: '自己的工程師先用自己的模型：研究時間 -10%、研究速度 +8%。' },
    { id: 't_alphaevolve', cat: 'agent', line: 'agent', name: '演算法自動發現', cost: 11700, dur: 26, pub: '2025-06', req: ['t_agentrl', 't_ttc'], eff: { algo: 1.15 }, desc: 'Agent 用演化法找出更好的演算法：有效算力 +15%。' },
    { id: 't_lab', cat: 'agent', line: 'agent', name: '自駕實驗室', cost: 12000, dur: 30, pub: '2023-11', req: ['t_airesearch'], eff: { know: 3, reason: 2, agi: 1.05 }, desc: 'AI 設計實驗、機器手臂動手做：知識 +3、推理 +2、AGI 進度速度 +5%。' },
    // 產品策略
    { id: 't_resmgmt', cat: 'biz', line: 'serve', name: 'ML 研發流程平台', cost: 400, dur: 5, pub: '2015-12', eff: { slots: 1 }, desc: '實驗追蹤、資料版本、自動化管線：研究線 +1。' },
    { id: 't_lora', cat: 'biz', line: 'serve', name: 'LoRA 企業微調', cost: 360, dur: 4, pub: '2021-06', eff: { segU: { ent: 0.2 } }, desc: '讓客戶用自己的資料便宜地微調：企業市場吸引力增加。' },
    { id: 't_starcoder', cat: 'biz', line: 'serve', name: '程式補全產品化', cost: 420, dur: 5, pub: '2023-05', req: ['t_stack'], eff: { code: 2, segU: { coding: 0.15 } }, desc: '把模型放進編輯器裡：程式 +2、程式碼助手市場吸引力增加。' },
    { id: 't_superapp', cat: 'biz', line: 'serve', excl: 'x_biz', name: '主攻消費者', cost: 3900, dur: 16, pub: '2025-09', req: ['t_voice'], eff: { segU: { chat: 0.35, creative: 0.15 } }, desc: '把對話 App 做成人人每天打開的入口：對話與創作市場吸引力大增。' },
    { id: 't_entsuite', cat: 'biz', line: 'serve', excl: 'x_biz', name: '主攻企業', cost: 3900, dur: 16, pub: '2025-10', req: ['t_comply'], eff: { segU: { ent: 0.4, agent: 0.1 } }, desc: '私有部署、稽核、整合一次到位：企業與 Agent 市場吸引力大增。' },
    { id: 't_devplat', cat: 'biz', line: 'serve', excl: 'x_biz', name: '主攻開發者', cost: 3000, dur: 16, pub: '2023-05', req: ['t_tools'], eff: { community: 0.03, segU: { api: 0.3, coding: 0.2 } }, desc: '最好用的 API 和文件：開發者與程式碼市場吸引力大增，社群緩慢成長。' },
    { id: 't_openeco', cat: 'biz', line: 'serve', excl: 'x_open', name: '開放權重生態', cost: 1800, dur: 10, pub: '2023-07', req: ['t_rlhf'], eff: { community: 0.08, rpMul: 1.05 }, desc: '權重開給大家，社群幫你找錯：社群緩慢成長、研究速度 +5%。' },
    { id: 't_weightsec', cat: 'biz', line: 'safe', excl: 'x_open', name: '權重安全堡壘', cost: 2050, dur: 10, pub: '2024-05', req: ['t_redteam'], eff: { incident: 0.85, rep: 2, val: 1.05 }, desc: '權重鎖進隔離網路：事故機率 -15%、聲望 +2、估值 +5%。' },
  ];

  /* ---------- 賣點（雙屬性達標，門檻隨前沿移動；參考手機帝國的雙屬性賣點） ---------- */
  D.BADGES = [
    { id: 'coder', name: '程式之王', icon: '⌨️', a: 'code', b: 'reason', seg: { coding: 0.5, api: 0.2 } },
    { id: 'sage', name: '博學多聞', icon: '📚', a: 'know', b: 'lang', seg: { chat: 0.35, ent: 0.2 } },
    { id: 'thinker', name: '深度思考', icon: '🧮', a: 'reason', b: 'know', seg: { api: 0.3, agent: 0.2 } },
    { id: 'longctx', name: '過目不忘', icon: '📜', a: 'ctx', b: 'know', seg: { ent: 0.4, coding: 0.15 } },
    { id: 'agentic', name: '全能助理', icon: '🤖', a: 'agent', b: 'reason', seg: { agent: 0.5, ent: 0.15 } },
    { id: 'artist', name: '視覺藝術家', icon: '🎨', a: 'mm', b: 'lang', seg: { creative: 0.5, chat: 0.2 } },
    { id: 'safe', name: '安全可靠', icon: '🛡️', a: 'safety', b: 'know', abs: [80, 88, 94], seg: { ent: 0.45, chat: 0.1 } },
    { id: 'value', name: '高性價比', icon: '💎', special: 'value', seg: { api: 0.4, coding: 0.2 } },
  ];
  D.BADGE_TIERS = [
    { name: '銅', a: 0.95, b: 0.8, mul: 1 },
    { name: '銀', a: 1.05, b: 0.9, mul: 1.5 },
    { name: '金', a: 1.15, b: 1.0, mul: 2 },
  ];

  /* ---------- 企業標案（RFP 需求單；參考手機帝國的情報任務） ---------- */
  D.RFP_CLIENTS = ['某國有銀行', '某電信龍頭', '某醫學中心', '某汽車大廠', '某電商平台', '某律師事務所', '某政府數位部門', '某遊戲公司', '某證券商', '某航空公司', '某連鎖零售', '某半導體廠', '某保險集團', '某出版集團', '某物流巨頭', '某教育集團'];
  D.RFP_NEEDS = {
    know: '專業知識問答', lang: '客服對話', code: '內部程式碼助手', reason: '風控與分析推理', ctx: '長文件審閱',
    agent: '流程自動化 Agent', mm: '影像與文件辨識', safety: '合規與資安',
  };

  /* ---------- 募資輪 ---------- */
  /* cap：這一輪最多募多少；估值很高時只賣比較少的股份（Game.nextRound 會算出實際的 dil） */
  D.ROUNDS = [
    { id: 'A', name: 'A 輪', dil: 0.18, cap: 3e7, req: { minBest: 40 }, reqText: '發布過綜合分 ≥ 40 的模型' },
    { id: 'B', name: 'B 輪', dil: 0.15, cap: 1e8, req: { minRev: 3e5, orRank: 5 }, reqText: '週營收 ≥ $30萬 或 模型排名前 5' },
    { id: 'C', name: 'C 輪', dil: 0.12, cap: 4e8, req: { minRev: 3e6, orRank: 3 }, reqText: '週營收 ≥ $300萬 或 模型排名前 3' },
    { id: 'D', name: 'D 輪', dil: 0.1, cap: 1.2e9, req: { minRev: 1.5e7, orRank: 2 }, reqText: '週營收 ≥ $1,500萬 或 模型排名前 2' },
    { id: 'E', name: 'Pre-IPO', dil: 0.08, cap: 3e9, req: { minRev: 5e7, orRank: 1 }, reqText: '週營收 ≥ $5,000萬 或 模型排名第 1' },
    { id: 'IPO', name: 'IPO 上市', dil: 0.1, cap: 1e10, req: { minRev: 1e8, andRank: 3 }, reqText: '週營收 ≥ $1億 且 模型排名前 3' },
  ];

  /* ---------- 平衡常數 ---------- */
  D.BAL = {
    H100_WEEK_FLOPS: 5.98e20,     // 989 TFLOPS × 604800 s
    BASE_MFU: 0.36,
    MAX_MFU: 0.68,
    S0_A: 8.5, S0_B: 8.5,        // 基礎分 = A × log10(C_eff / 1e19) + B
    CHIN_RATIO: 20,
    OVER_K: 0.033, UNDER_K: 0.16,
    QUAL_REF: 0.68, QUAL_EXP: 1.5,
    MOE_EXP: 0.65,                // N_eff = N_act^(1-e) × N_total^e
    BASE_MAX_SIZE: 34,
    MEM_B_PER_GPU: 1.2,           // 每張 H100 等效卡可承載的參數（B）下限要求
    SALARY_INFL: 0.12,
    RENT0: 600, RENT_DECAY: 0.82, RENT_CAP0: 300, RENT_CAP_GROW: 2.05,
    OPEX_PER_CARD: 70,
    GPU_PRICE_DECAY: 0.8,
    COST_RATIO: 0.5,
    REF_ACT: 70,
    SHARE_SMOOTH: 0.18,
    UTIL_A: 0.12,
    OUTSIDE_GAP: 10,
    REP_UTIL: 0.022,
    RP_PER_RES: 12, RP_EXP: 0.75, // 研究點 = RP_PER_RES × 研究員人數^RP_EXP：人越多邊際產出越低
    RES_SLOTS: [6, 20, 60, 150],   // 研究線：研究員達到這些人數各 +1 條（起始 1 條）
    RES_SLOTS_MAX: 7,
    IDLE_RP: 0.02,
    INCIDENT_BASE: 0.012,
    REG_DECAY: 0.45,
    START_CASH_FLOOR: 0,
    // 難度：中後期的壓力，都從 2024 年才開始往上爬，新手期不受影響
    RIVAL_PRESS: 7,       // 對手綜合分額外加成（2023 年底到 2026 年初逐步加滿，乘上開局的 press）
    RIVAL_DIST_MIN: 0.65,  // 對手通路優勢隨時間衰減的下限
    RIVAL_BRAND: 0.7,     // 對手的品牌吸引力（跟著 RIVAL_PRESS 一起加滿）
    UTIL_RAMP: 0.12,      // 市場越成熟，客戶對模型好壞越敏感：每年多 12%（第二年起），掉名次越來越痛
    MKT_REF: 0.002,       // 行銷效果看花費相對市場規模的比例
    OPS0: 0.03, OPS_GROW: 0.072, OPS_MAX: 0.5, // 營運成本（客服、業務、合規、授權）佔營收比例，隨年份上升
    POWER_EXP: 0.65, POWER_INFL: 0.06,        // 電費隨卡的效能與年份上升
    STALE: 0.5, STALE_FROM: 0.75, STALE_MAX: 1.2, // 模型老化：上線超過 STALE_FROM 年後，每年吸引力 -STALE
    REG_FLOOR: 7, REG_FLOOR_MAX: 40,          // 監管底線：2026 起每年 +REG_FLOOR
  };

  /* ---------- 最後一幕：AGI 競賽 ---------- */
  /* comp、core：AGI 門檻（綜合分、五項核心能力的最低分）；模型沒達標時進度卡在 gate。
     onComp、onDate：有人的模型到這個分數，或到這個日期，就進入最後一幕。rate：每週進度的基準；c0：綜合分到這裡才開始有明顯進度 */
  D.AGI = { comp: 100, core: 92, coreKeys: ['know', 'lang', 'code', 'reason', 'agent'], onComp: 95, onDate: '2029-01', gate: 92, rate: 0.5, rivalRate: 0.6, c0: 88 };

  /* ---------- 成就 ---------- */
  D.ACHIEVEMENTS = [
    { id: 'first_model', icon: '🐣', name: 'Hello, World', desc: '完成第一個模型訓練' },
    { id: 'first_release', icon: '🚀', name: '上線啦', desc: '第一次發布模型' },
    { id: 'top10', icon: '📈', name: '擠進前十', desc: '模型登上排行榜前 10 名' },
    { id: 'top3', icon: '🥉', name: '第一梯隊', desc: '模型登上排行榜前 3 名' },
    { id: 'rank1', icon: '👑', name: '世界第一', desc: '模型登上排行榜第 1 名' },
    { id: 'open1', icon: '🕊️', name: '開源精神', desc: '發布第一個開源模型' },
    { id: 'community80', icon: '🌍', name: '社群之光', desc: '開源社群達到 80' },
    { id: 'moe', icon: '🧩', name: '專家會診', desc: '訓練第一個 MoE 模型' },
    { id: 'trillion', icon: '🪐', name: '兆級參數', desc: '訓練總參數 ≥ 1T 的模型' },
    { id: 'tiny_giant', icon: '🐜', name: '小而強', desc: '14B 以下模型綜合分 ≥ 70' },
    { id: 'reasoner', icon: '🧮', name: '會思考了', desc: '模型推理能力 ≥ 80' },
    { id: 'agent', icon: '🤖', name: '自己動手', desc: '模型 Agent 能力 ≥ 70' },
    { id: 'safe90', icon: '🛡️', name: '安全模範生', desc: '發布安全 ≥ 90 的模型' },
    { id: 'rev1m', icon: '💵', name: '百萬週營收', desc: '週營收突破 $100萬' },
    { id: 'rev100m', icon: '💰', name: '印鈔機', desc: '週營收突破 $1億' },
    { id: 'unicorn', icon: '🦄', name: '獨角獸', desc: '估值突破 $10億' },
    { id: 'decacorn', icon: '🐉', name: '十角獸', desc: '估值突破 $100億' },
    { id: 'trillion_val', icon: '🏛️', name: '兆元帝國', desc: '估值突破 $1兆' },
    { id: 'ipo', icon: '🔔', name: '敲鐘', desc: '完成 IPO 上市' },
    { id: 'gpu10k', icon: '🖥️', name: '萬卡叢集', desc: '擁有 1 萬張 H100 等效算力' },
    { id: 'gpu100k', icon: '🌋', name: '十萬卡', desc: '擁有 10 萬張 H100 等效算力' },
    { id: 'staff100', icon: '👥', name: '百人團隊', desc: '員工達到 100 人' },
    { id: 'all_tech', icon: '📜', name: '博學', desc: '研究 60 項科技' },
    { id: 'pioneer', icon: '🔭', name: '開創者', desc: '在全世界公開前研究出 5 項科技' },
    { id: 'survivor', icon: '🩹', name: '浴火重生', desc: '現金一度為負，最後撐過來' },
    { id: 'price_war', icon: '⚔️', name: '價格屠夫', desc: '以低價或免費策略拿下開發者 API 市佔第一' },
    { id: 'agi', icon: '🌅', name: 'AGI', desc: '達成通用人工智慧' },
    { id: 'rfp3', icon: '📝', name: '標案常勝軍', desc: '完成 3 個企業標案' },
    { id: 'gold_badge', icon: '🥇', name: '金字招牌', desc: '模型獲得金級賣點' },
  ];

  /* ---------- 結局 ---------- */
  /* bonus：結局加成（總分的一項）；maxGrade：這個結局最高拿到的評等；after：結局畫面的後話 */
  D.ENDINGS = {
    agi_good: { icon: '🌅', title: '對齊的黎明', grade: 'S', bonus: 600, text: '你的模型跨過了 AGI 門檻，而且你做到了別人說不可能的事：它強大、可靠、可被監督。人類與 AI 的新紀元，從 {company} 的一封公開信開始。',
      after: ['{model} 的安全報告全文公開，連{rival}的研究員都引用了它。', '它幫忙治好的第一種罕見疾病，論文上掛的是整個實驗室的名字。', '{mascot} 成了新課本封面上的插圖，孩子們都以為這個角色一直都在。'] },
    agi_open: { icon: '🔥', title: '眾人的火種', grade: 'S', bonus: 550, text: '{company} 跨過 AGI 門檻的當天，就把權重放上了網路。從此沒有人能獨佔它，也沒有人能把它關掉。',
      after: ['全世界的實驗室在一週內重現了 {model}，其中有些你從沒聽過。', '有人用它治病，有人用它做你不想知道的事。監管機關第一次發現，法條追不上下載速度。', '{mascot} 被印在連署書的第一頁：這是你們答應過的事。'] },
    agi_bad: { icon: '⚠️', title: '潘朵拉的盒子', grade: 'B', bonus: 250, text: '{company} 率先抵達 AGI，股價一飛衝天。但安全團隊的報告顯示：沒人真正知道它在想什麼。世界在歡呼與不安中迎來了明天。',
      after: ['{model} 上線的第一個月，人類解決了一個懸了百年的數學難題，也出現了第一起沒有人能解釋的事故。', '監管機關要求交出權重，{company} 的律師回信只有一句：我們自己也打不開。', '{mascot} 的周邊賣到缺貨。沒有人敢問它，下一步想做什麼。'] },
    rival_agi: { icon: '🌑', title: '別人的黎明', grade: 'C', maxGrade: 'A', bonus: 50, text: '{rival} 搶先宣布跨過 AGI 門檻。發表會直播的那個晚上，{company} 的工程師一句話也沒說。你們離終點其實不遠，只是第二名沒有名字。',
      after: ['{rival} 的新模型開放的第一週，你們半數的企業客戶來信詢問合約怎麼解除。', '{model} 還在線上，排行榜上卻已經沒有人在看。', '你在{mascot}的抱枕旁邊坐了很久，然後打開一份新的簡報：接下來，還能做什麼？'] },
    treaty: { icon: '📜', title: '全球暫停', grade: 'A', bonus: 300, text: '在 {company} 的推動下，各國簽下了前沿訓練的暫停條約。競賽停了，沒有人贏，也沒有人先跨過那條線。',
      after: ['{model} 成了條約允許的最後一代前沿模型，博物館向你們要了一份權重。', '{rival} 的工程師轉去做安全研究，有些人後來成了你的同事。', '有人說你救了世界，也有人說你只是輸不起。{mascot} 不評論。'] },
    empire: { icon: '🏛️', title: '模型帝國', grade: 'A', bonus: 400, text: '{company} 是全球最大的 AI 公司。你的模型跑在每一支手機、每一間企業、每一台機器人裡。AGI 也許還要再等等，但這個帝國已經是真的了。',
      after: ['{rival} 的執行長在財報會議上承認：我們現在賣的，是 {company} 不想做的那些生意。', '反壟斷聽證排到了明年，{model} 幫律師團寫好了答辯狀。', '{mascot} 的廣告看板從機場一路掛到月球基地的提案簡報裡。'] },
    open_legend: { icon: '🕊️', title: '開源傳奇', grade: 'A', bonus: 350, text: '你把最好的模型交給了全世界。{company} 也許不是最賺錢的公司，但每個開發者都知道你的名字。',
      after: ['全球的大學生用 {model} 的權重寫畢業論文，用完還會回來送 PR。', '{rival} 宣布跟進開源，新聞稿的第一段就提到了 {company}。', '有人把 {mascot} 畫進了開源授權條款的頁尾，沒有人想把它刪掉。'] },
    steward: { icon: '🛡️', title: '規則制定者', grade: 'A', bonus: 280, text: '{company} 不是最賺錢的公司，模型也不總是最強，但全世界的前沿安全標準，都照你們寫的版本走。',
      after: ['{rival} 的發布會上，第一張投影片是通過 {company} 安全評測的徽章。', '{model} 的稽核紀錄成了監管機關的教材。', '{mascot} 被做成了安全認證的吉祥物，貼在每一份合規文件的右上角。'] },
    state: { icon: '🎖️', title: '國家隊', grade: 'B', bonus: 200, text: '{company} 併入了國家的 AI 戰略。算力和訂單都不用再擔心，發表會要先過審查。你贏得了安穩，也交出了方向盤。',
      after: ['{model} 跑在你看不到的機房裡，用途寫在你讀不到的文件上。', '老員工換上了識別證，每個月要多填一份表。', '{mascot} 在官方宣傳片裡出現了三秒，配音不是你們選的。'] },
    everyman: { icon: '🏘️', title: '人人用得起', grade: 'A', bonus: 260, text: '{company} 把價格一路打到地板。{model} 不是排行榜第一，卻是這個世界上用得最多的模型。',
      after: ['偏鄉的學校用 {model} 上課，夜市攤販用它算帳。', '{rival} 被迫降價三次，財報裡開始出現「普及」這個詞。', '{mascot} 的貼圖成了全世界長輩群組裡的早安圖。'] },
    niche: { icon: '🎯', title: '隱形冠軍', grade: 'B', bonus: 180, text: '{company} 在自己最擅長的那塊市場站穩了腳。外面的競賽再熱鬧，客戶的續約單還是照常寄來。',
      after: ['{rival} 的業務每次碰到你們的客戶，都會默默換下一家。', '{model} 上不了頭條，但沒有人敢把它從流程裡拿掉。', '{mascot} 的周邊只送不賣，老客戶都有一隻。'] },
    acquired: { icon: '🤝', title: '被收購', grade: 'C', maxGrade: 'B', bonus: 50, text: '你在合約上簽下名字。{company} 成為了別人帝國的一部分——至少，團隊都拿到了不錯的價錢。',
      after: ['{model} 改了名字，變成別人全家桶裡的一個按鈕。', '老員工的群組還留著，每年 1 月有人會貼車庫的舊照片。', '{mascot} 的版權歸了新東家，下一季的周邊換了顏色。'] },
    bankrupt: { icon: '💀', title: '資金鏈斷裂', grade: 'D', maxGrade: 'C', bonus: -200, text: '帳上的錢燒完了，最後一張 GPU 也被搬走。{mascot} 的周邊娃娃還堆在倉庫裡。',
      after: ['法拍公告上寫著：二手伺服器一批，附贈鯨魚地毯。', '{model} 的權重被債權人賣了三次，沒有人知道它現在跑在哪裡。', '團隊散到各家公司。過了幾年，有人在{rival}的走廊上認出老同事，兩個人都笑了。'] },
    survive: { icon: '🧭', title: '仍在路上', grade: 'B', maxGrade: 'B', bonus: 0, text: '{company} 仍在這場馬拉松中奔跑。沒有童話結局，但你活下來了，而且還在變強。',
      after: ['{rival} 的發表會又上了頭條，你們的工程師邊看邊記筆記。', '{model} 不是最強的模型，但每個月都有客戶寫信來說謝謝。', '{mascot} 還站在大廳，下一代的訓練已經排上日程。'] },
  };

  window.ME_DATA = D;
})();

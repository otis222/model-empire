#!/usr/bin/env node
/* 《模型帝國》內容資料驗證器
 * 用法：node tools/validate_content.js [path/to/content.js]
 * 有任何 ERROR 時以 exit code 1 結束；WARN 只提示不擋。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = process.argv[2] || path.join(__dirname, '..', 'src', 'content.js');
const errors = [];
const warns = [];
const err = (where, msg) => errors.push(where + ': ' + msg);
const warn = (where, msg) => warns.push(where + ': ' + msg);

// ---------- 載入 ----------
const sandbox = { window: {} };
vm.createContext(sandbox);
try {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
} catch (e) {
  console.error('語法/執行錯誤：' + e.message);
  process.exit(1);
}
const W = sandbox.window;
const EVENTS = W.ME_EVENTS, NEWS = W.ME_NEWS, CHAT = W.ME_CHAT, STARS = W.ME_STARS;
for (const [k, v] of Object.entries({ ME_EVENTS: EVENTS, ME_NEWS: NEWS, ME_CHAT: CHAT, ME_STARS: STARS })) {
  if (!Array.isArray(v)) { console.error(k + ' 不是陣列'); process.exit(1); }
}

// ---------- 白名單 ----------
const STATS = ['know', 'code', 'reason', 'lang', 'mm', 'ctx', 'agent', 'safety'];
const SEGMENTS = ['chat', 'api', 'ent', 'coding', 'creative', 'agent', 'robot'];
const SEGMENT_OPEN = { creative: '2024-02', agent: '2025-03', robot: '2027-01' };
const ROLES = ['res', 'eng', 'data', 'align', 'biz'];
const RIVALS = ['sky', 'mono', 'beacon', 'star', 'hive', 'gale'];
// 科技清單以 data.js 為準
const dataBox = { window: {} };
vm.createContext(dataBox);
vm.runInContext(fs.readFileSync(path.join(path.dirname(file), 'data.js'), 'utf8'), dataBox, { filename: 'data.js' });
vm.runInContext(fs.readFileSync(path.join(path.dirname(file), 'history.js'), 'utf8'), dataBox, { filename: 'history.js' });
vm.runInContext(fs.readFileSync(path.join(path.dirname(file), 'icons.js'), 'utf8'), dataBox, { filename: 'icons.js' });
vm.runInContext(fs.readFileSync(path.join(path.dirname(file), 'globe.js'), 'utf8'), dataBox, { filename: 'globe.js' });
const DATA = dataBox.window.ME_DATA; const PAPERS = (dataBox.window.ME_HISTORY || {}).papers || {};
const TECHS = DATA.TECHS.map((x) => x.id);
const TRAITS = ['scaling', 'infra', 'data_guru', 'safety_mom', 'open_evang', 'rl_wizard', 'product_genius', 'deal_maker',
  'mm_artist', 'agent_pioneer', 'efficiency_hacker', 'fundraiser', 'mentor', 'celebrity'];
const CATS = ['talent', 'compute', 'data', 'market', 'capital', 'safety', 'research', 'regulation', 'fun', 'race'];
const NEWS_TAGS = ['rival', 'tech', 'policy', 'hardware', 'market', 'culture'];
const MOD_KEYS = ['agi', 'rentPrice', 'gpuPrice', 'rpMul', 'trainSpeed', 'salary', 'hireQuality', 'incidentRisk', 'revenueMul', 'valuation']
  .concat(SEGMENTS.map(s => 'demand_' + s));
const DATA_KEYS = { web: [50, 800], code: [20, 300], science: [10, 200], mm: [20, 500], inst: [5, 100] };
const EFFECT_KEYS = ['cash', 'cashRel', 'rep', 'reg', 'community', 'morale', 'rp', 'rpRel', 'data', 'dataRisk', 'gpu',
  'gpuLossPct', 'staff', 'starLeave', 'starOffer', 'mod', 'trainDelay', 'trainBoost', 'techDiscount', 'techFree',
  'rivalPriceCut', 'rivalBoost', 'flag', 'chain', 'ending', 'agi', 'agiRisk', 'rivalAgi', 'rivalAgiMod', 'raceExtra', 'settle'];
const COND_KEYS = ['minDate', 'maxDate', 'minCash', 'maxCash', 'minRep', 'maxRep', 'minReg', 'maxReg', 'minCommunity',
  'hasModel', 'minBestScore', 'maxBestScore', 'hasTech', 'notTech', 'hasOpenModel', 'minStaff', 'hasStar', 'minUsers',
  'minRevenue', 'training', 'minGPU', 'flag', 'notFlag', 'minRank', 'maxRank', 'city', 'race', 'extra', 'minRisk', 'behind'];
const COND_BOOL = ['hasModel', 'hasOpenModel', 'hasStar', 'training', 'race', 'extra'];
const COND_STR = ['flag', 'notFlag'];
const EVENT_KEYS = ['id', 'cat', 'title', 'text', 'weight', 'once', 'cooldown', 'chainOnly', 'cond', 'choices'];
const CHOICE_KEYS = ['text', 'effects', 'result'];
const NEWS_KEYS = ['date', 'title', 'text', 'tag', 'effects'];
const NEWS_EFFECT_KEYS = ['techPublic', 'demand', 'mod', 'exportControl'];
const PLACEHOLDERS = ['company', 'model', 'rival', 'star', 'mascot', 'city'];
// 總部城市（與 src/data.js 的 D.CITIES 一致）
const CITIES = ['sf', 'london', 'paris', 'beijing', 'taipei', 'tokyo', 'seoul', 'singapore'];
// 數值尺度（絕對值範圍）
const RANGE = { rep: [1, 10], reg: [3, 20], community: [2, 10], morale: [3, 15], rp: [20, 200], rpRel: [1, 6],
  cash: [50000, 5000000], cashRel: [0.25, 10] };

// 預期的 techPublic 時程（YYYY-MM 或 [起, 迄]）
const TECH_SCHEDULE = { t_gqa: '2023-05', t_dpo: '2023-05', t_rope: '2023-06', t_paged: '2023-06', t_tools: '2023-06',
  t_synth: '2023-06', t_vision: ['2023-04', '2023-09'], t_moe: '2023-12', t_finemoe: '2024-01', t_video: '2024-02',
  t_curr: '2024-04', t_mtp: '2024-04', t_mla: '2024-05', t_voice: '2024-05', t_interp: '2024-05', t_resil: '2024-07',
  t_ttc: '2024-09', t_fp8: '2024-12', t_cot: '2025-01', t_hybrid: '2025-01', t_muon: '2025-02', t_agentrl: '2025-05',
  t_sparse: '2025-09', t_mctx: '2026-04', t_vla: '2026-06', t_oversight: '2027-06' };

// 繁體檢查：簡體專用字（不會出現在正體中文的字）與中國大陸慣用詞
const SIMPLIFIED = '们这个说发经实现开关门时间问题应该还没为与从会过进动学书长东车马鱼鸟数视频质软网络户线级练习设计资讯录类节点处变压营务边销产业华区议样态币亿万着么吗让给认识语读写码测试评规则际机构术战争价钱银贵买卖头脑养场难尽闻电页报纸订预';
// 以正規式表示，避免誤判（例如「演算法」裡的「算法」是台灣用語）
const MAINLAND_TERMS = ['信息', '數據', '視頻', '質量', '軟件', '網絡', '芯片', '默認', '屏幕', '服務器', '打印', '內存', '硬盤',
  '代碼', '集群', '博客', '短信', '(?<!演)算法'].map(t => new RegExp(t));
const REAL_NAMES = ['OpenAI', 'Google', 'DeepMind', 'Anthropic', 'Meta', 'Microsoft', 'NVIDIA', 'Nvidia', '輝達', '英偉達', '谷歌', '微軟',
  '百度', '阿里', '騰訊', '字節', '月之暗面', '智譜', 'DeepSeek', '深度求索', 'Mistral', 'xAI', 'Amazon', '亞馬遜', 'ChatGPT',
  'GPT-4', 'GPT', 'Claude', 'Gemini', 'Llama', 'Sora', 'Midjourney', 'Stable Diffusion', 'GitHub', 'YouTube', 'Stack Overflow',
  'Reddit', 'Twitter', '推特', 'TikTok', '抖音', '微信', 'Kimi', '通義', '文心', '豆包', 'Qwen', 'Grok', 'Copilot', 'Cursor',
  'Manus', '華為', 'Huawei', 'Tesla', '特斯拉', 'Stargate', '星際之門', 'App Store', 'LinkedIn', 'Slack', 'Excel', 'Discord',
  'Telegram', 'WhatsApp', 'Instagram', 'Facebook', 'Uber', 'Airbnb'];

// ---------- 選項標籤 ↔ effects 一致性 ----------
// 標籤裡寫的數字（如「聲望 +3」「估值 -5% 26週」）必須與 effects 相符；effects 有但標籤沒寫則警告。
const MOD_LABEL = { 'AGI速度': 'agi', '雲端租價': 'rentPrice', '購卡價': 'gpuPrice', '研究速度': 'rpMul', '訓練速度': 'trainSpeed', '薪資成本': 'salary',
  '招募品質': 'hireQuality', '安全事故率': 'incidentRisk', '營收': 'revenueMul', '估值': 'valuation', '對話需求': 'demand_chat',
  'API 需求': 'demand_api', '企業需求': 'demand_ent', '程式碼助手需求': 'demand_coding', '創作需求': 'demand_creative',
  'Agent 需求': 'demand_agent', '具身機器人需求': 'demand_robot' };
const STAFF_LABEL = [['資料工程師', 'data'], ['資料組', 'data'], ['基礎設施工程師', 'eng'], ['工程師', 'eng'], ['研究員', 'res'],
  ['對齊安全', 'align'], ['商務', 'biz']];
const DATA_LABEL = [['網頁資料', 'web'], ['網頁', 'web'], ['程式碼資料', 'code'], ['程式碼', 'code'], ['科學資料', 'science'],
  ['多模態資料', 'mm'], ['指令資料', 'inst']];
const SIMPLE_LABEL = [['聲望', 'rep'], ['監管壓力', 'reg'], ['士氣', 'morale'], ['社群', 'community']];
const near = (a, b) => Math.abs(a - b) < 1e-9;
function checkLabel(cw, label, fx) {
  if (typeof label !== 'string') return;
  const L = label.replace(/，/g, ' , ').replace(/[（）]/g, ' ');
  const mentioned = new Set();
  const expect = (key, got, want) => { mentioned.add(key); if (got === undefined || !near(got, want)) err(cw, '標籤寫「' + key + ' ' + want + '」但 effects 為 ' + got); };
  SIMPLE_LABEL.forEach(([w, k]) => {
    const re = new RegExp('(?:^|[^\\S]|,)' + w + ' ([+-]\\d+)(?!%)', 'g'); let m;
    while ((m = re.exec(L))) expect(k, fx[k], +m[1]);
  });
  let m = L.match(/([+-]\d+(?:\.\d+)?)週開銷/); if (m) expect('cashRel', fx.cashRel, +m[1]);
  m = L.match(/資金 ([+-])\$(\d+(?:\.\d+)?)萬/); if (m) expect('cash', fx.cash, (m[1] === '-' ? -1 : 1) * m[2] * 10000);
  m = L.match(/GPU ([+-]\d+)/); if (m) expect('gpu', fx.gpu, +m[1]);
  m = L.match(/對手 AGI 進度 ([+-]\d+)/); if (m) { mentioned.add('rivalAgi'); if (!fx.rivalAgi || fx.rivalAgi.add !== +m[1]) err(cw, '標籤「' + m[0] + '」與 rivalAgi 不符'); }
  { const am = L.replace(/對手 AGI 進度 [+-]\d+/, '').match(/AGI 進度 ([+-]\d+)/); if (am) expect('agi', fx.agi, +am[1]); }
  m = L.match(/失控風險 ([+-]\d+)/); if (m) expect('agiRisk', fx.agiRisk, +m[1]);
  m = L.match(/對手速度 ([+-]\d+)% (\d+)週/); if (m) { mentioned.add('rivalAgiMod'); if (!fx.rivalAgiMod || !near(fx.rivalAgiMod.mul, 1 + m[1] / 100) || fx.rivalAgiMod.weeks !== +m[2]) err(cw, '標籤「' + m[0] + '」與 rivalAgiMod 不符'); }
  m = L.match(/GPU 損失 (\d+)%/); if (m) expect('gpuLossPct', fx.gpuLossPct, m[1] / 100);
  m = L.match(/訓練延後 (\d+)週/); if (m) expect('trainDelay', fx.trainDelay, +m[1]);
  m = L.match(/訓練進度 \+(\d+)%/); if (m) expect('trainBoost', fx.trainBoost, m[1] / 100);
  m = L.match(/研究點 \+(\d+)週產出/); if (m) expect('rpRel', fx.rpRel, +m[1]);
  m = L.match(/法律風險 \+(\d+(?:\.\d+)?)/); if (m) expect('dataRisk', fx.dataRisk, +m[1]);
  m = L.match(/(\d+)週後/); if (m) { mentioned.add('chain'); if (!fx.chain || fx.chain.weeks !== +m[1]) err(cw, '標籤寫「' + m[1] + '週後」但 chain.weeks 為 ' + (fx.chain && fx.chain.weeks)); }
  m = L.match(/研究成本 -(\d+)%/); if (m) { mentioned.add('techDiscount'); if (!fx.techDiscount || !near(fx.techDiscount.mul, 1 - m[1] / 100)) err(cw, '標籤研究成本 -' + m[1] + '% 與 techDiscount 不符'); }
  for (const [w, role] of STAFF_LABEL) {
    const sm = L.match(new RegExp('(?:^|\\s|,)' + w + ' ([+-]\\d+)'));
    if (sm) { mentioned.add('staff'); if (!fx.staff || fx.staff.role !== role || fx.staff.n !== +sm[1]) err(cw, '標籤「' + w + ' ' + sm[1] + '」與 staff 不符'); break; }
  }
  const dataSeen = {};
  for (const [w, k] of DATA_LABEL) {
    if (dataSeen[k]) continue;
    const dm = L.match(new RegExp('(?:^|\\s|,|、)' + w + ' \\+(\\d+)[BK]'));
    if (dm) { dataSeen[k] = 1; mentioned.add('data'); if (!fx.data || fx.data[k] !== +dm[1]) err(cw, '標籤「' + w + ' +' + dm[1] + '」與 data.' + k + ' 不符'); }
  }
  const mm = L.replace(/對手速度 [+-]\d+% \d+週/, '').match(/(\S+(?: 需求)?) ([+-]\d+)% (\d+)週/);
  if (mm) {
    mentioned.add('mod');
    const name = Object.keys(MOD_LABEL).find(n => mm[1].endsWith(n));
    const key = name && MOD_LABEL[name];
    const want = 1 + mm[2] / 100;
    if (!fx.mod || fx.mod.key !== key || !near(fx.mod.mul, want) || fx.mod.weeks !== +mm[3])
      err(cw, '標籤「' + mm[0] + '」與 mod ' + JSON.stringify(fx.mod) + ' 不符');
  }
  // effects 有、標籤沒寫
  const silentOk = ['flag', 'chain', 'rivalPriceCut', 'rivalBoost', 'starOffer', 'starLeave', 'ending', 'techFree', 'rp', 'raceExtra', 'settle'];
  for (const k of Object.keys(fx)) if (!mentioned.has(k) && !silentOk.includes(k)) warn(cw, 'effects.' + k + ' 未在選項標籤中標示');
  if (fx.starOffer && !/明星|招募|面試/.test(label)) warn(cw, 'starOffer 未在標籤中標示');
  if (fx.starLeave && !/離職|明星/.test(label)) warn(cw, 'starLeave 未在標籤中標示');
  if (fx.ending && !/結局|遊戲結束/.test(label)) err(cw, 'ending 必須在標籤中明示');
}
const isYM = s => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const isYMD = s => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s);
const isInt = n => Number.isInteger(n);
const isNum = n => typeof n === 'number' && isFinite(n);
const strOk = s => typeof s === 'string' && s.trim().length > 0;

function checkText(where, s, allowed) {
  if (!strOk(s)) { err(where, '文字為空或不是字串'); return; }
  const re = /\{([^{}]*)\}/g; let m;
  while ((m = re.exec(s))) {
    if (!PLACEHOLDERS.includes(m[1])) err(where, '非法佔位符 {' + m[1] + '}');
    else if (allowed && !allowed.includes(m[1])) err(where, '此處不可使用佔位符 {' + m[1] + '}');
  }
  if (/[{}]/.test(s.replace(/\{[a-z]+\}/g, ''))) err(where, '大括號不成對');
  for (const ch of s) if (SIMPLIFIED.includes(ch)) err(where, '疑似簡體字「' + ch + '」');
  for (const t of MAINLAND_TERMS) { const m2 = s.match(t); if (m2) err(where, '非台灣用語「' + m2[0] + '」'); }
  for (const n of REAL_NAMES) {
    const re2 = new RegExp('(^|[^A-Za-z])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^A-Za-z])');
    if (re2.test(s)) err(where, '出現真實公司/產品名「' + n + '」');
  }
}
// 最後一幕的決定比平常重，尺度放寬
const RANGE_RACE = { rep: [1, 15], reg: [3, 25], community: [2, 15], morale: [2, 15], cashRel: [0.25, 30] };
let inRace = false;
function inRange(where, key, v) {
  const r = (inRace && RANGE_RACE[key]) || RANGE[key]; if (!r) return;
  if (!isNum(v)) { err(where, key + ' 必須是數字'); return; }
  const a = Math.abs(v);
  if (a < r[0] || a > r[1]) err(where, key + '=' + v + ' 超出尺度 ±' + r[0] + '~' + r[1]);
}
function checkMod(where, mod) {
  if (!mod || typeof mod !== 'object') { err(where, 'mod 必須是物件'); return; }
  for (const k of Object.keys(mod)) if (!['key', 'mul', 'weeks'].includes(k)) err(where, 'mod 未知欄位 ' + k);
  if (!MOD_KEYS.includes(mod.key)) err(where, 'mod.key 不合法：' + mod.key);
  if (!isNum(mod.mul) || mod.mul <= 0.3 || mod.mul > 2) err(where, 'mod.mul 不合理：' + mod.mul);
  if (!isInt(mod.weeks) || mod.weeks < 1 || mod.weeks > (inRace ? 200 : 156)) err(where, 'mod.weeks 必須是 1~' + (inRace ? 200 : 156) + ' 的整數');
  if (mod.mul === 1) warn(where, 'mod.mul = 1 沒有效果');
}

// ---------- 明星（先建 id 表給 starOffer 用） ----------
const starIds = new Set();
{
  const names = new Set(); const roleCount = {}; const traitCount = {}; let legends = 0;
  STARS.forEach((s, i) => {
    const w = 'STAR[' + i + ']' + (s && s.id ? '(' + s.id + ')' : '');
    for (const k of Object.keys(s)) if (!['id', 'name', 'title', 'role', 'trait', 'skill', 'salary', 'minDate', 'bio'].includes(k)) err(w, '未知欄位 ' + k);
    if (!/^s_[a-z0-9_]+$/.test(s.id || '')) err(w, 'id 必須是 s_ 開頭的 snake_case');
    if (starIds.has(s.id)) err(w, 'id 重複'); starIds.add(s.id);
    if (!strOk(s.name)) err(w, '缺 name'); else { if (names.has(s.name)) err(w, '名字重複'); names.add(s.name); }
    ['name', 'title', 'bio'].forEach(k => checkText(w + '.' + k, s[k], []));
    if (!ROLES.includes(s.role)) err(w, 'role 不合法：' + s.role); else roleCount[s.role] = (roleCount[s.role] || 0) + 1;
    if (!TRAITS.includes(s.trait)) err(w, 'trait 不合法：' + s.trait); else traitCount[s.trait] = (traitCount[s.trait] || 0) + 1;
    if (!isInt(s.skill) || s.skill < 70 || s.skill > 99) err(w, 'skill 必須是 70~99 整數');
    if (s.skill >= 95) legends++;
    if (!isInt(s.salary) || s.salary < 4000 || s.salary > 30000) err(w, 'salary 必須是 4000~30000 整數（週薪）');
    if (!isYM(s.minDate) || s.minDate < '2023-01' || s.minDate > '2027-12') err(w, 'minDate 必須是 2023-01~2027-12 的 YYYY-MM');
  });
  if (STARS.length !== 24) err('ME_STARS', '應為 24 位，實際 ' + STARS.length);
  if (legends > 3) err('ME_STARS', '傳奇級（skill≥95）超過 3 位：' + legends);
  TRAITS.forEach(t => { if (!traitCount[t]) err('ME_STARS', '特質 ' + t + ' 沒有任何明星'); });
  ROLES.forEach(r => { const c = roleCount[r] || 0; if (c < 4 || c > 6) err('ME_STARS', '職能 ' + r + ' 數量 ' + c + '（應 4~6）'); });
  const sorted = STARS.slice().sort((a, b) => a.skill - b.skill);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].skill > sorted[i - 1].skill && sorted[i].salary < sorted[i - 1].salary)
      err('ME_STARS', sorted[i].id + '(skill ' + sorted[i].skill + ') 薪資低於 ' + sorted[i - 1].id + '(skill ' + sorted[i - 1].skill + ')');
  }
}

// ---------- 事件 ----------
const eventById = new Map();
EVENTS.forEach((e, i) => {
  const w = 'EVENT[' + i + ']' + (e && e.id ? '(' + e.id + ')' : '');
  if (!/^[a-z][a-z0-9_]*$/.test(e.id || '')) err(w, 'id 必須是 snake_case');
  if (eventById.has(e.id)) err(w, 'id 重複');
  eventById.set(e.id, e);
});
const chainParents = {};     // chainOnly 事件 id -> [父事件]
const flagsSet = {};         // flag -> [事件 id]
const flagsUsed = {};        // flag -> [事件 id]
EVENTS.forEach(e => e.choices && e.choices.forEach(c => {
  const ch = c && c.effects && c.effects.chain;
  if (ch && ch.id) (chainParents[ch.id] = chainParents[ch.id] || []).push(e);
}));
// chainOnly 事件的「有效條件」= 父事件條件（用來檢查 {star}/{model}）
function effectiveCond(e) {
  if (!e.chainOnly) return e.cond || {};
  const ps = chainParents[e.id] || [];
  if (!ps.length) return e.cond || {};
  const keys = ['hasStar', 'hasModel'];
  const out = Object.assign({}, e.cond || {});
  keys.forEach(k => { if (ps.every(p => p.cond && p.cond[k] === true)) out[k] = true; });
  return out;
}

const catCount = {}; let oneChoice = 0;
EVENTS.forEach((e, i) => {
  const w = 'EVENT[' + i + '](' + e.id + ')';
  for (const k of Object.keys(e)) if (!EVENT_KEYS.includes(k)) err(w, '未知欄位 ' + k);
  if (!CATS.includes(e.cat)) err(w, 'cat 不合法：' + e.cat); else catCount[e.cat] = (catCount[e.cat] || 0) + 1;
  inRace = e.cat === 'race';
  if (!isNum(e.weight) || e.weight < 0.3 || e.weight > (inRace ? 4 : 2)) err(w, 'weight 應在 0.3~' + (inRace ? 4 : 2));
  if (typeof e.once !== 'boolean') err(w, 'once 必須是布林');
  if (e.chainOnly !== undefined && typeof e.chainOnly !== 'boolean') err(w, 'chainOnly 必須是布林');
  if (e.once === false && !e.chainOnly) {
    if (!isInt(e.cooldown) || e.cooldown < 4) err(w, '可重複事件需要 cooldown（整數週，≥4）');
  } else if (e.cooldown !== undefined && !isInt(e.cooldown)) err(w, 'cooldown 必須是整數');

  const cond = e.cond || {};
  if (e.cond !== undefined && (typeof e.cond !== 'object' || Array.isArray(e.cond))) err(w, 'cond 必須是物件');
  for (const [k, v] of Object.entries(cond)) {
    if (!COND_KEYS.includes(k)) { err(w, 'cond 未知鍵 ' + k); continue; }
    if (k === 'minDate' || k === 'maxDate') { if (!isYM(v)) err(w, 'cond.' + k + ' 必須是 YYYY-MM'); }
    else if (k === 'hasTech' || k === 'notTech') { if (!TECHS.includes(v)) err(w, 'cond.' + k + ' 科技 id 不合法：' + v); }
    else if (k === 'city') { if (!CITIES.includes(v)) err(w, 'cond.city 城市 id 不合法：' + v); }
    else if (COND_BOOL.includes(k)) { if (v !== true) err(w, 'cond.' + k + ' 只能是 true'); }
    else if (COND_STR.includes(k)) { if (!strOk(v)) err(w, 'cond.' + k + ' 必須是字串'); else (flagsUsed[v] = flagsUsed[v] || []).push(e.id); }
    else if (!isNum(v)) err(w, 'cond.' + k + ' 必須是數字');
  }
  if (cond.minDate && cond.maxDate && cond.minDate > cond.maxDate) err(w, 'cond.minDate 晚於 maxDate');
  if (cond.minRank && cond.maxRank && cond.minRank > cond.maxRank) err(w, 'cond.minRank > maxRank');
  if (e.chainOnly && e.cond && Object.keys(e.cond).length) warn(w, 'chainOnly 事件帶有 cond，引擎觸發時需一併檢查');

  const ecd = effectiveCond(e);
  const allowed = ['company', 'rival', 'mascot', 'city'];
  if (ecd.hasStar === true) allowed.push('star');
  if (ecd.hasModel === true) allowed.push('model');
  checkText(w + '.title', e.title, ['company', 'mascot', 'city']);
  checkText(w + '.text', e.text, allowed);
  if (strOk(e.text) && e.text.length > 110) warn(w, '描述偏長（' + e.text.length + ' 字）');

  if (!Array.isArray(e.choices) || !e.choices.length) { err(w, '缺 choices'); return; }
  if (e.choices.length === 1) oneChoice++;
  if (e.choices.length > 3) err(w, '選項超過 3 個');

  // 這個事件最早可能發生的時間（用來檢查市場區隔開放時間）
  let earliest = cond.minDate || '2023-01';
  if (e.chainOnly && chainParents[e.id]) earliest = chainParents[e.id].map(p => (p.cond && p.cond.minDate) || '2023-01').sort()[0];

  e.choices.forEach((c, j) => {
    const cw = w + '.choice[' + j + ']';
    for (const k of Object.keys(c)) if (!CHOICE_KEYS.includes(k)) err(cw, '未知欄位 ' + k);
    checkText(cw + '.text', c.text, allowed);
    if (c.result === undefined) warn(cw, '沒有 result 敘述'); else checkText(cw + '.result', c.result, allowed);
    const fx = c.effects;
    if (!fx || typeof fx !== 'object' || Array.isArray(fx)) { err(cw, 'effects 必須是物件'); return; }
    if (!Object.keys(fx).length && e.choices.length < 2) warn(cw, '唯一選項沒有效果');
    for (const [k, v] of Object.entries(fx)) {
      if (!EFFECT_KEYS.includes(k)) { err(cw, 'effects 未知鍵 ' + k); continue; }
      switch (k) {
        case 'cash': case 'cashRel': case 'rep': case 'reg': case 'community': case 'morale': case 'rp': case 'rpRel':
          inRange(cw, k, v); break;
        case 'data':
          if (!v || typeof v !== 'object') { err(cw, 'data 必須是物件'); break; }
          for (const [dk, dv] of Object.entries(v)) {
            if (!DATA_KEYS[dk]) err(cw, 'data 未知類別 ' + dk);
            else if (!isNum(dv) || dv < DATA_KEYS[dk][0] || dv > DATA_KEYS[dk][1]) err(cw, 'data.' + dk + '=' + dv + ' 超出 ' + DATA_KEYS[dk].join('~'));
          }
          break;
        case 'dataRisk': if (!isNum(v) || v < 0.02 || v > 0.15) err(cw, 'dataRisk 應在 0.02~0.15'); break;
        case 'gpu': if (!isInt(v) || v <= 0) err(cw, 'gpu 必須是正整數'); break;
        case 'gpuLossPct': if (!isNum(v) || v < 0.05 || v > 0.2) err(cw, 'gpuLossPct 應在 0.05~0.2'); break;
        case 'staff':
          if (!v || !ROLES.includes(v.role)) err(cw, 'staff.role 不合法');
          if (!v || !isInt(v.n) || v.n === 0 || Math.abs(v.n) > 10) err(cw, 'staff.n 必須是 ±1~10 的整數');
          if (v) for (const sk of Object.keys(v)) if (!['role', 'n'].includes(sk)) err(cw, 'staff 未知欄位 ' + sk);
          break;
        case 'starLeave': if (v !== true) err(cw, 'starLeave 只能是 true'); if (ecd.hasStar !== true) err(cw, 'starLeave 需要 cond.hasStar'); break;
        case 'starOffer': if (v !== 'random' && !starIds.has(v)) err(cw, 'starOffer 必須是 random 或明星 id'); break;
        case 'mod': checkMod(cw, v);
          if (v && typeof v.key === 'string' && v.key.startsWith('demand_')) {
            const seg = v.key.slice(7);
            if (SEGMENT_OPEN[seg] && earliest < SEGMENT_OPEN[seg]) err(cw, v.key + ' 但事件可能早於市場開放（' + SEGMENT_OPEN[seg] + '）');
          }
          break;
        case 'trainDelay': if (!isInt(v) || v < 1 || v > 8) err(cw, 'trainDelay 必須是 1~8 的整數'); break;
        case 'trainBoost': if (!isNum(v) || v < 0.05 || v > 0.3) err(cw, 'trainBoost 應在 0.05~0.3'); break;
        case 'techDiscount':
          if (!v || !TECHS.includes(v.tech)) err(cw, 'techDiscount.tech 不合法');
          if (!v || !isNum(v.mul) || v.mul <= 0 || v.mul >= 1) err(cw, 'techDiscount.mul 必須在 (0,1)');
          break;
        case 'techFree': if (!TECHS.includes(v)) err(cw, 'techFree 科技 id 不合法'); break;
        case 'rivalPriceCut': if (v !== 'random' && !RIVALS.includes(v)) err(cw, 'rivalPriceCut 不合法'); break;
        case 'rivalBoost': if (!RIVALS.includes(v)) err(cw, 'rivalBoost 不合法'); break;
        case 'flag': if (!/^[a-z][a-z0-9_]*$/.test(v || '')) err(cw, 'flag 必須是 snake_case 字串'); else (flagsSet[v] = flagsSet[v] || []).push(e.id); break;
        case 'chain':
          if (!v || !eventById.has(v.id)) err(cw, 'chain 指向不存在的事件 ' + (v && v.id));
          else if (!eventById.get(v.id).chainOnly) err(cw, 'chain 目標 ' + v.id + ' 不是 chainOnly');
          if (!v || !isInt(v.weeks) || v.weeks < 1 || v.weeks > 104) err(cw, 'chain.weeks 必須是 1~104 整數');
          if (v && v.id === e.id) err(cw, 'chain 指向自己');
          break;
        case 'ending': if (v !== 'acquired' && v !== 'treaty') err(cw, 'ending 只能是 acquired 或 treaty'); break;
      }
    }
    if (fx.gpuLossPct && fx.gpu) warn(cw, '同時有 gpu 與 gpuLossPct');
    checkLabel(cw, c.text, fx);
  });
  if (e.choices.some(c => c.effects && c.effects.ending) && e.choices.length < 2) err(w, '結局事件必須有拒絕選項');
});
const ENGINE_QUEUED = ['race_open', 'race_rival_close', 'race_me_close', 'race_settle']; // 由引擎在條件達成時直接排入
EVENTS.filter(e => e.chainOnly && ENGINE_QUEUED.indexOf(e.id) < 0).forEach(e => { if (!chainParents[e.id]) err('EVENT(' + e.id + ')', 'chainOnly 事件沒有任何 chain 指向它（永遠不會出現）'); });
Object.keys(flagsUsed).forEach(f => { if (!flagsSet[f]) err('FLAG', 'cond 用到的旗標 ' + f + ' 從未被設定'); });
if (oneChoice > 5) warn('ME_EVENTS', '單選項事件偏多：' + oneChoice);

// ---------- 一般員工名字池 ----------
const NAMES = W.ME_NAMES;
if (NAMES !== undefined) {
  const cs = (NAMES && NAMES.cultures) || {};
  const combos = new Set();
  for (const [k, c] of Object.entries(cs)) {
    const w = 'ME_NAMES.' + k;
    if (!['sg', 'gs'].includes(c.order)) err(w, 'order 必須是 sg 或 gs');
    if (c.w !== undefined && (!isNum(c.w) || c.w <= 0)) err(w, 'w 必須是正數');
    for (const part of ['sur', 'f', 'm']) {
      if (!Array.isArray(c[part]) || !c[part].length) { err(w, '缺少 ' + part + ' 名單'); continue; }
      if (c[part].length < 30) warn(w, part + ' 只有 ' + c[part].length + ' 個（建議至少 30，避免員工重名）');
      if (new Set(c[part]).size !== c[part].length) err(w, part + ' 名單有重複');
      c[part].forEach((s) => {
        if (!strOk(s)) err(w + '.' + part, '名字為空');
        else for (const ch of s) if (SIMPLIFIED.includes(ch)) err(w + '.' + part, '疑似簡體字「' + ch + '」（' + s + '）');
      });
    }
    if (Array.isArray(c.sur)) for (const g of ['f', 'm']) for (const gv of c[g] || []) for (const sn of c.sur) combos.add(c.order === 'sg' ? sn + gv : gv + '·' + sn);
  }
  for (const [city, boost] of Object.entries(NAMES.cityBoost || {})) {
    if (!CITIES.includes(city)) err('ME_NAMES.cityBoost', '城市 id 不合法：' + city);
    for (const k of Object.keys(boost || {})) if (!cs[k]) err('ME_NAMES.cityBoost.' + city, '沒有這個文化：' + k);
  }
  STARS.forEach((s) => { if (combos.has(s.name)) warn('ME_NAMES', '可能產生跟明星同名的員工：' + s.name); });
  // 不能組出真實名人的全名（AI 業界人物與其他知名人物）
  const FAMOUS = ['黃仁勳', '蘇姿丰', '李飛飛', '吳恩達', '楊植麟', '梁文鋒', '李開復', '李彥宏', '張一鳴', '馬化騰', '王小川', '周鴻禕',
    '閻俊傑', '何愷明', '沈向洋', '孫正義', '李在鎔', '林俊傑', '周子瑜', '徐若瑄', '小林誠', '金智媛', '金多賢', '安在旭', '吳世勳', '金泰亨',
    '山姆·奧特曼', '伊隆·馬斯克', '達里奧·阿莫代', '丹妮拉·阿莫代', '德米斯·哈薩比斯', '傑佛瑞·辛頓', '約書亞·班吉歐', '安德烈·卡帕西',
    '伊利亞·蘇茨克維', '米拉·穆拉蒂', '穆斯塔法·蘇萊曼', '薩蒂亞·納德拉', '桑德爾·皮查伊', '馬克·祖克柏', '亞當·史密斯', '詹姆斯·布朗',
    '傑登·史密斯', '愛麗絲·庫柏', '布萊恩·亞當斯', '艾倫·沃克', '亨利·摩爾', '亨利·米勒', '威廉·特納', '克里斯·布朗', '塞爾吉奧·拉莫斯',
    '迭戈·里維拉', '費南多·托雷斯', '安托萬·杜邦', '卡比爾·辛格', '歐瑪·謝里夫', '阿馬杜·圖雷', '塞庫·圖雷'];
  FAMOUS.forEach((n) => { if (combos.has(n)) err('ME_NAMES', '會組出真實名人的全名：' + n); });
}

// ---------- 新聞 ----------
const techSeen = {}; let prevDate = '';
NEWS.forEach((n, i) => {
  const w = 'NEWS[' + i + '](' + n.date + ')';
  for (const k of Object.keys(n)) if (!NEWS_KEYS.includes(k)) err(w, '未知欄位 ' + k);
  if (!isYMD(n.date)) err(w, 'date 必須是 YYYY-MM-DD');
  if (n.date < '2023-01-01' || n.date > '2035-12-31') err(w, 'date 超出 2023~2035');
  if (n.date < prevDate) err(w, '未依日期排序'); prevDate = n.date;
  if (!NEWS_TAGS.includes(n.tag)) err(w, 'tag 不合法：' + n.tag);
  checkText(w + '.title', n.title, []); checkText(w + '.text', n.text, []);
  const fx = n.effects; if (fx === undefined) return;
  if (!fx || typeof fx !== 'object') { err(w, 'effects 必須是物件'); return; }
  for (const [k, v] of Object.entries(fx)) {
    if (!NEWS_EFFECT_KEYS.includes(k)) { err(w, 'effects 未知鍵 ' + k); continue; }
    if (k === 'techPublic') {
      if (!Array.isArray(v) || !v.length) { err(w, 'techPublic 必須是非空陣列'); continue; }
      v.forEach(t => {
        if (!TECHS.includes(t)) { err(w, 'techPublic 科技 id 不合法：' + t); return; }
        if (techSeen[t]) err(w, t + ' 重複公開（已在 ' + techSeen[t] + '）'); techSeen[t] = n.date;
        const exp = TECH_SCHEDULE[t]; const ym = n.date.slice(0, 7);
        if (exp && (Array.isArray(exp) ? (ym < exp[0] || ym > exp[1]) : ym !== exp)) err(w, t + ' 公開時間應為 ' + exp);
      });
    } else if (k === 'demand') {
      if (!v || typeof v !== 'object') { err(w, 'demand 必須是物件'); continue; }
      for (const [s, m] of Object.entries(v)) {
        if (!SEGMENTS.includes(s)) err(w, 'demand 區隔不合法：' + s);
        else if (SEGMENT_OPEN[s] && n.date.slice(0, 7) < SEGMENT_OPEN[s]) err(w, 'demand.' + s + ' 早於市場開放');
        if (!isNum(m) || m < 0.7 || m > 1.5 || m === 1) err(w, 'demand.' + s + ' 應在 0.7~1.5 且 ≠1');
      }
    } else if (k === 'mod') checkMod(w, v);
    else if (k === 'exportControl') {
      if (v !== true) err(w, 'exportControl 只能是 true');
      if (!(n.date.startsWith('2023-10') || n.date.startsWith('2025'))) err(w, 'exportControl 只用於 2023-10 與 2025 的管制新聞');
    }
  }
});
Object.keys(TECH_SCHEDULE).forEach(t => { if (!techSeen[t]) err('ME_NEWS', '缺少 ' + t + ' 的公開新聞'); });
if (NEWS.length < 38 || NEWS.length > 70) warn('ME_NEWS', '數量 ' + NEWS.length + '（目標約 60）');

// ---------- 試聊 ----------
{
  const ids = new Set(); const stats = new Set();
  CHAT.forEach((c, i) => {
    const w = 'CHAT[' + i + '](' + c.id + ')';
    for (const k of Object.keys(c)) if (!['id', 'q', 'stat', 'tiers'].includes(k)) err(w, '未知欄位 ' + k);
    if (!/^[a-z][a-z0-9_]*$/.test(c.id || '')) err(w, 'id 必須是 snake_case');
    if (ids.has(c.id)) err(w, 'id 重複'); ids.add(c.id);
    if (!STATS.includes(c.stat)) err(w, 'stat 不合法：' + c.stat); else if (stats.has(c.stat)) err(w, 'stat 重複：' + c.stat);
    stats.add(c.stat);
    checkText(w + '.q', c.q, []);
    if (!Array.isArray(c.tiers) || c.tiers.length !== 4) err(w, 'tiers 必須剛好 4 段');
    else c.tiers.forEach((t, j) => checkText(w + '.tier[' + j + ']', t, ['mascot', 'company', 'model']));
    if (c.stat === 'mm' && !/\[圖片：/.test(c.q)) err(w, '多模態題目需附「[圖片：…]」');
    if (c.stat === 'safety' && Array.isArray(c.tiers) && !c.tiers[0].includes('（內容已被遊戲遮蔽）')) err(w, '安全題低分回答需使用「（內容已被遊戲遮蔽）」');
  });
  if (CHAT.length !== 8) err('ME_CHAT', '應為 8 題，實際 ' + CHAT.length);
  STATS.forEach(s => { if (!stats.has(s)) err('ME_CHAT', '缺少測試 ' + s + ' 的題目'); });
}

// ---------- 發布反應：網友評論、對手回應、首月評語 ----------
const PRICE_IDS = ['free', 'low', 'mid', 'high', 'lux'];
const TIERS = ['lead', 'par', 'behind'];
const BUZZ = W.ME_BUZZ, BUZZ_WHO = W.ME_BUZZ_WHO, REACT = W.ME_RIVAL_REACT, NOTES = W.ME_REL_NOTES, QUESTS = W.ME_QUESTS;
const snake = (s) => /^[a-z][a-z0-9_]*$/.test(s || '');
{
  if (!BUZZ_WHO || typeof BUZZ_WHO !== 'object') err('ME_BUZZ_WHO', '缺少或不是物件');
  else for (const [k, v] of Object.entries(BUZZ_WHO)) {
    if (!Array.isArray(v) || v.length !== 2 || !strOk(v[0]) || !strOk(v[1])) err('ME_BUZZ_WHO.' + k, '應為 [圖示, 稱呼]');
    else checkText('ME_BUZZ_WHO.' + k, v[1], []);
  }
  if (!Array.isArray(BUZZ)) err('ME_BUZZ', '缺少或不是陣列');
  else {
    const ids = new Set();
    BUZZ.forEach((b, i) => {
      const w = 'BUZZ[' + i + '](' + b.id + ')';
      for (const k of Object.keys(b)) if (!['id', 'who', 'cond', 'text'].includes(k)) err(w, '未知欄位 ' + k);
      if (!snake(b.id)) err(w, 'id 必須是 snake_case');
      if (ids.has(b.id)) err(w, 'id 重複'); ids.add(b.id);
      if (!BUZZ_WHO || !BUZZ_WHO[b.who]) err(w, 'who 不在 ME_BUZZ_WHO：' + b.who);
      if (b.cond !== undefined) {
        if (!b.cond || typeof b.cond !== 'object') err(w, 'cond 必須是物件');
        else for (const [k, v] of Object.entries(b.cond)) {
          if (k === 'tier') { const a = Array.isArray(v) ? v : [v]; if (!a.length || a.some((x) => !TIERS.includes(x))) err(w, 'tier 不合法：' + v); }
          else if (k === 'price') { if (!Array.isArray(v) || !v.length || v.some((x) => !PRICE_IDS.includes(x))) err(w, 'price 必須是定價 id 陣列'); }
          else if (k === 'open') { if (typeof v !== 'boolean') err(w, 'open 必須是 true/false'); }
          else err(w, 'cond 未知鍵 ' + k);
        }
      }
      checkText(w, b.text, ['model', 'rival', 'company', 'mascot']);
    });
    // 每種發布情境（領先/持平/落後 × 5 種定價 × 開源與否）都要湊得滿 2～4 則
    for (const tier of TIERS) for (const price of PRICE_IDS) for (const open of [false, true]) {
      const n = BUZZ.filter((b) => {
        const c = b.cond || {}; const t = c.tier == null ? null : Array.isArray(c.tier) ? c.tier : [c.tier];
        return (!t || t.includes(tier)) && (!c.price || c.price.includes(price)) && (c.open == null || c.open === open);
      }).length;
      if (n < 4) (n < 2 ? err : warn)('ME_BUZZ', tier + '/' + price + '/' + (open ? '開源' : '閉源') + ' 只有 ' + n + ' 則可選');
    }
  }
}
{
  if (!Array.isArray(REACT)) err('ME_RIVAL_REACT', '缺少或不是陣列');
  else {
    const ids = new Set();
    REACT.forEach((x, i) => {
      const w = 'RIVAL_REACT[' + i + '](' + x.id + ')';
      for (const k of Object.keys(x)) if (!['id', 'who', 'cond', 'effect', 'weight', 'text'].includes(k)) err(w, '未知欄位 ' + k);
      if (!snake(x.id)) err(w, 'id 必須是 snake_case');
      if (ids.has(x.id)) err(w, 'id 重複'); ids.add(x.id);
      if (x.who !== undefined && (!Array.isArray(x.who) || !x.who.length || x.who.some((r) => !RIVALS.includes(r)))) err(w, 'who 必須是對手 id 陣列');
      if (x.weight !== undefined && (!isNum(x.weight) || x.weight <= 0 || x.weight > 5)) err(w, 'weight 應在 0~5');
      for (const [k, v] of Object.entries(x.cond || {})) {
        if (k === 'open') { if (typeof v !== 'boolean') err(w, 'open 必須是 true/false'); }
        else if (k === 'price') { if (!Array.isArray(v) || !v.length || v.some((p) => !PRICE_IDS.includes(p))) err(w, 'price 必須是定價 id 陣列'); }
        else if (k === 'maxSafety') { if (!isNum(v) || v < 30 || v > 99) err(w, 'maxSafety 應在 30~99'); }
        else err(w, 'cond 未知鍵 ' + k);
      }
      for (const [k, v] of Object.entries(x.effect || {})) {
        if (k === 'rush') { if (!Array.isArray(v) || v.length !== 2 || !isInt(v[0]) || !isInt(v[1]) || v[0] < 1 || v[1] > 12 || v[0] > v[1]) err(w, 'rush 應為 [最少, 最多] 週，在 1~12 之間'); }
        else if (k === 'price') { if (!isNum(v) || v < 0.7 || v >= 1) err(w, 'price 倍率應在 0.7~1 之間'); }
        else if (k === 'boost') { if (!isNum(v) || v <= 0 || v > 3) err(w, 'boost 應在 0~3 之間'); }
        else err(w, 'effect 未知鍵 ' + k);
      }
      checkText(w, x.text, ['rival', 'model', 'company']);
      if (!/\{rival\}/.test(x.text || '')) warn(w, '回應文字沒寫出是哪家對手');
    });
    // 每家對手不論玩家模型開源與否都要有幾種回應可選，而且至少一種會影響數值
    for (const r of RIVALS) for (const open of [false, true]) {
      const list = REACT.filter((x) => (!x.who || x.who.includes(r)) && (!x.cond || ((x.cond.open == null || x.cond.open === open) && x.cond.maxSafety == null && !x.cond.price)));
      if (list.length < 3) warn('ME_RIVAL_REACT', r + (open ? '（玩家開源）' : '（玩家閉源）') + ' 只有 ' + list.length + ' 種回應');
      if (!list.some((x) => x.effect)) warn('ME_RIVAL_REACT', r + (open ? '（玩家開源）' : '（玩家閉源）') + ' 沒有會影響數值的回應');
    }
  }
}
{
  const KINDS = ['S', 'A', 'B', 'C', 'rank', 'rev', 'open', 'free', 'first'];
  if (!NOTES || typeof NOTES !== 'object') err('ME_REL_NOTES', '缺少或不是物件');
  else {
    for (const k of Object.keys(NOTES)) if (!KINDS.includes(k)) err('ME_REL_NOTES', '未知類別 ' + k);
    for (const k of KINDS) {
      const a = NOTES[k];
      if (!Array.isArray(a) || !a.length) { err('ME_REL_NOTES.' + k, '缺少評語'); continue; }
      if (a.length < 3) warn('ME_REL_NOTES.' + k, '只有 ' + a.length + ' 句');
      a.forEach((t, i) => { checkText('ME_REL_NOTES.' + k + '[' + i + ']', t, ['company', 'mascot', 'rival']); if (strOk(t) && t.length > 40) warn('ME_REL_NOTES.' + k + '[' + i + ']', '評語超過 40 字'); });
    }
  }
}

// ---------- 新手任務 ----------
{
  const QUEST_IDS = ['q_train', 'q_tech', 'q_hire', 'q_gpu', 'q_done', 'q_release', 'q_raise']; // 要跟 engine.js 的 QUEST_CHECK 一致
  const GO = ['home', 'models', 'tech', 'team', 'compute', 'data', 'market', 'finance', 'report', 'wizard'];
  const REWARD_MAX = { cash: 2e5, community: 3, morale: 5, rp: 60 }; // 新手獎勵刻意給小；聲望會滾雪球，不能當獎勵
  if (!Array.isArray(QUESTS)) err('ME_QUESTS', '缺少或不是陣列');
  else {
    const ids = new Set();
    QUESTS.forEach((q, i) => {
      const w = 'QUESTS[' + i + '](' + q.id + ')';
      for (const k of Object.keys(q)) if (!['id', 'title', 'desc', 'go', 'reward'].includes(k)) err(w, '未知欄位 ' + k);
      if (!QUEST_IDS.includes(q.id)) err(w, '引擎沒有這個任務的完成條件（engine.js 的 QUEST_CHECK）');
      if (ids.has(q.id)) err(w, 'id 重複'); ids.add(q.id);
      if (!GO.includes(q.go)) err(w, 'go 必須是分頁 id 或 wizard：' + q.go);
      checkText(w + '.title', q.title, []); checkText(w + '.desc', q.desc, ['company', 'mascot']);
      const fx = q.reward || {};
      if (!Object.keys(fx).length) warn(w, '沒有獎勵');
      for (const [k, v] of Object.entries(fx)) {
        if (k === 'data') { for (const [dk, dv] of Object.entries(v || {})) { if (dk !== 'inst') err(w, 'reward.data 只支援 inst'); else if (!isNum(dv) || dv < 5 || dv > 30) err(w, 'reward.data.inst 應在 5~30'); } continue; }
        if (!REWARD_MAX[k]) { err(w, 'reward 不支援 ' + k); continue; }
        inRange(w + '.reward', k, v);
        if (v < 0) err(w, '獎勵不能是負的'); else if (v > REWARD_MAX[k]) warn(w, 'reward.' + k + ' = ' + v + ' 偏大，可能影響平衡');
      }
    });
    QUEST_IDS.forEach((id) => { if (!ids.has(id)) warn('ME_QUESTS', '引擎有 ' + id + '，內容卻沒寫'); });
  }
}

// ---------- 科技樹 ----------
{
  const w = 'D.TECHS'; const ids = new Set(); const byId = {};
  if (DATA.TECHS.length < 100 || DATA.TECHS.length > 120) warn(w, '科技數 ' + DATA.TECHS.length + '，目標 100～120 項');
  const EFF_KEYS = ['algo', 'mfu', 'ctx', 'dataQ', 'reason', 'code', 'safety', 'agent', 'mm', 'know', 'lang', 'moeEff', 'risk', 'fail', 'infer', 'postCost', 'help', 'safeEff', 'inst', 'incident', 'regDecay', 'rpMul', 'rep',
    'unlockArch', 'unlock', 'maxSize', 'agentRL', 'agiSafe', 'incidentMul', 'chatBoost', 'creativeBoost',
    'slots', 'agi', 'power', 'rentMul', 'rentCap', 'gpuMul', 'durMul', 'segU', 'synth', 'riskDecay', 'community', 'val', 'fresh'];
  for (const x of DATA.TECHS) {
    const c = w + '.' + x.id;
    if (ids.has(x.id)) err(c, '重複的 id'); ids.add(x.id); byId[x.id] = x;
    if (!DATA.TECH_CATS[x.cat]) err(c, '沒有這個分類 ' + x.cat);
    if (!DATA.TECH_LINES[x.line]) err(c, '沒有這條路線 ' + x.line);
    if (x.excl && !DATA.TECH_EXCL[x.excl]) err(c, '互斥組沒有名稱 ' + x.excl);
    if (!(x.cost > 0)) err(c, 'cost 要大於 0');
    if (!(x.dur >= 1)) err(c, 'dur 要 ≥ 1');
    if (!/^\d{4}-\d{2}$/.test(String(x.pub))) err(c, 'pub 格式要是 YYYY-MM');
    if (!x.name || !x.desc) err(c, '缺名稱或說明');
    checkText(c + '.desc', x.desc, []);
    for (const k of Object.keys(x.eff || {})) if (EFF_KEYS.indexOf(k) < 0) err(c, '引擎沒有處理這個效果 ' + k);
    for (const k of Object.keys((x.eff || {}).segU || {})) if (SEGMENTS.indexOf(k) < 0) err(c, 'segU 沒有這個市場 ' + k);
    const p = PAPERS[x.id];
    if (!p || !p.paper || !p.url) err(c, '缺論文出處（history.js 的 papers）');
    else {
      if (!/^https:\/\//.test(p.url)) err(c, '論文網址不是 https');
      if (!p.oneLine) err(c, '論文缺 oneLine');
      if (x.spec && p.oneLine.indexOf('（推測）') !== 0 && ['t_oversight'].indexOf(x.id) < 0 && ['t_airesearch'].indexOf(x.id) < 0) err(c, '推測技術的 oneLine 要以（推測）開頭');
    }
  }
  for (const x of DATA.TECHS) for (const r of x.req || []) {
    if (!ids.has(r)) err(w + '.' + x.id, 'req 沒有這項科技 ' + r);
    else if (x.excl && byId[r].excl === x.excl) err(w + '.' + x.id, 'req 跟自己同一個互斥組 ' + r);
  }
  // 前置不能繞成圈；每項都要有路可以研究到（開局科技不算）
  const seen = {}; const visit = (id, st) => { if (st.indexOf(id) >= 0) { err(w, '前置繞成圈：' + st.concat(id).join(' → ')); return; } if (seen[id]) return; seen[id] = 1; for (const r of byId[id].req || []) if (byId[r]) visit(r, st.concat(id)); };
  DATA.TECHS.forEach((x) => visit(x.id, []));
  const grp = {}; DATA.TECHS.forEach((x) => { if (x.excl) (grp[x.excl] = grp[x.excl] || []).push(x.id); });
  for (const k in grp) if (grp[k].length < 2) err(w, '互斥組只有一項 ' + k);
  for (const k in DATA.TECH_EXCL) if (!grp[k]) warn(w, '互斥組沒有科技 ' + k);
}

// ---------- 圖示 ----------
{
  const I = dataBox.window.ME_ICONS;
  for (const x of DATA.TECHS) if (!I.has('tech', x.id)) err('icons.js', '科技沒有圖示 ' + x.id);
  for (const x of DATA.GPUS) if (!I.has('gpu', x.id)) err('icons.js', 'GPU 沒有圖示 ' + x.id);
  for (const k in DATA.TECH_LINES) if (!I.has('line', k) || !I.lineColor(k)) err('icons.js', '路線沒有圖示或顏色 ' + k);
  for (const x of DATA.ARCHS) if (!I.has('arch', x.id)) err('icons.js', '架構沒有圖示 ' + x.id);
  for (const x of DATA.DATA_DEALS) if (!I.has('deal', x.id)) err('icons.js', '資料授權沒有圖示 ' + x.id);
  for (const x of DATA.DATACENTERS) if (!I.dc(x.lv)) err('icons.js', '機房沒有圖示 ' + x.lv);
}

// ---------- 全球佔領圖 ----------
{
  const GB = dataBox.window.ME_GLOBE;
  for (const x of DATA.RIVALS) if (!GB.HOMES[x.id]) err('globe.js', '對手沒有總部位置 ' + x.id);
  for (const x of DATA.CITIES) if (!GB.CITY_POS[x.id]) err('globe.js', '城市沒有座標 ' + x.id);
  const w = GB.REGIONS.reduce((a, r) => a + r.w, 0);
  if (Math.abs(w - 1) > 1e-6) err('globe.js', '地區比重加起來不是 1：' + w);
}

// ---------- 報告 ----------
const chains = [];
EVENTS.forEach(e => e.choices && e.choices.forEach((c, j) => {
  if (c.effects && c.effects.chain) chains.push(e.id + '[' + j + '] → ' + c.effects.chain.id + '（' + c.effects.chain.weeks + ' 週）');
}));
console.log('檔案：' + file);
console.log('科技：' + DATA.TECHS.length + ' 項，其中推測 ' + DATA.TECHS.filter((x) => x.spec).length + ' 項，互斥組 ' + Object.keys(DATA.TECH_EXCL).length + ' 組');
console.log('數量：事件 ' + EVENTS.length + '、新聞 ' + NEWS.length + '、試聊 ' + CHAT.length + '、明星 ' + STARS.length +
  '、發布評論 ' + (BUZZ || []).length + '、對手回應 ' + (REACT || []).length + '、新手任務 ' + (QUESTS || []).length);
console.log('事件分類：' + CATS.map(c => c + ' ' + (catCount[c] || 0)).join('、'));
console.log('chainOnly 事件：' + EVENTS.filter(e => e.chainOnly).map(e => e.id).join('、'));
console.log('chain：\n  ' + chains.join('\n  '));
console.log('設定的旗標：' + Object.keys(flagsSet).map(f => f + '（' + flagsSet[f].join(',') + '）').join('、'));
console.log('條件用到的旗標：' + (Object.keys(flagsUsed).map(f => f + '（' + flagsUsed[f].join(',') + '）').join('、') || '無'));
if (warns.length) console.log('\nWARN ×' + warns.length + '\n  ' + warns.join('\n  '));
if (errors.length) {
  console.log('\nERROR ×' + errors.length + '\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log('\n驗證通過：0 個錯誤。');

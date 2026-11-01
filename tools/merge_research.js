/* 合併研究資料：research/*.json → src/history.js（遊戲史料庫）與 docs/bible.html（設定集）
   用法：node tools/merge_research.js */
const fs = require('fs');
const path = require('path');
global.window = globalThis;
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'src', 'data.js'));
const D = window.ME_DATA;

const read = (f) => { const p = path.join(ROOT, 'research', f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
const glob = read('global_timeline.json') || { items: [], tech_papers: {} };
const sino = read('sinosphere_timeline.json') || { items: [], memes: [] };

// 兩份研究重複收錄的同一事件（id 不同），保留全球版
const DUP = new Set(['2025-01-nvidia-589b-drop', '2024-06-tw-jensen-ntu', '2025-09-deepseek-v32-exp']);
const seen = new Set(); const items = [];
for (const it of [...(glob.items || []), ...(sino.items || [])]) {
  if (it && DUP.has(it.id)) continue;
  if (!it || !it.id || !it.date || !it.title) continue;
  if (seen.has(it.id)) continue; seen.add(it.id);
  items.push(it);
}
items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

// 遊戲內史料庫：只收查證過的條目（查不到可靠來源的只留在設定集），只保留顯示需要的欄位
const slim = items.filter((it) => it.confidence !== 'unverified').map((it) => ({
  id: it.id, date: String(it.date), cat: it.cat, region: it.region, title: it.title, text: it.text,
  real: it.real ? { org: it.real.org, names: it.real.names } : undefined,
  sources: (it.sources || []).slice(0, 2), confidence: it.confidence,
}));
const papers = {};
for (const k in (glob.tech_papers || {})) {
  const p = glob.tech_papers[k];
  papers[k] = { paper: p.paper, authors: p.authors, venue: p.venue, date: p.date, url: p.url, oneLine: p.oneLine };
}
const memes = (sino.memes || []).map((m) => ({ term: m.term, meaning: m.meaning, origin: m.origin, game_use: m.game_use }));
const hist = { items: slim, papers, memes };
fs.writeFileSync(path.join(ROOT, 'src', 'history.js'), '/* 真實 AI 史料（由 tools/merge_research.js 從 research/*.json 產生，請勿手改） */\nwindow.ME_HISTORY = ' + JSON.stringify(hist) + ';\n');

// 設定集頁面
const techNames = {}; D.TECHS.forEach((t) => (techNames[t.id] = t.name));
Object.assign(techNames, { scaling_kaplan: 'Scaling Law（Kaplan）', scaling_chinchilla: 'Chinchilla 最佳配比', attention: 'Transformer 注意力' });
const mapping = [
  ['2022-11 ChatGPT 上線、兩個月破億用戶', '2023 年開局時「對話 App」與「開發者 API」市場已存在，規模每年約 ×2'],
  ['2023-03 第四代旗艦模型與 GPU 搶購潮', '天穹智能以 60 分左右的實力開局；H100 於 2023-03 開賣、租卡容量吃緊'],
  ['2023-07 開源可商用大模型', '群星開源（開源派）登場，壓低 API 價格；開源權重成為玩家的策略選項'],
  ['2023-10 / 2024-12 / 2025-01 美國晶片出口管制', '「算力禁運」劇本：2023-10 起買不到高階 GPU，只能用國產卡與高價海外雲'],
  ['2024-05 中國大模型價格戰（DeepSeek-V2、豆包等）', '價格戰事件與對手降價機制；「低價」與「免費」定價檔'],
  ['2024-09 推理模型（o1）', '綜合分權重從 2024-09 起向推理傾斜；「思維鏈推理 RL」可搶先研究'],
  ['2025-01 DeepSeek-R1 與 NVIDIA 單日大跌', '「思維鏈推理 RL」於 2025-01 公開、成本減半；效率黑馬「疾風 AI」快速崛起'],
  ['2025 Agent 與程式碼代理', '2025-03 開放「Agent 自動化」市場，綜合分加入 Agent 權重'],
  ['EU AI Act 分階段生效、各國前沿模型規範', '監管壓力、前沿模型許可事件（發布門檻：安全 ≥ 70）'],
  ['具身智慧與人形機器人熱潮', '2027 起開放「具身機器人」市場，需研究具身 VLA'],
  ['台積電 CoWoS 產能、Computex 台北發表新架構', 'GPU 世代表（H100 → H200 → B200 → B300 → Rubin …）與卡價走勢'],
];
const bg = { items, tech_papers: glob.tech_papers || {}, memes: sino.memes || [], mapping, techNames };
const tplPath = path.join(ROOT, 'docs', 'bible.template.html');
let tpl = fs.readFileSync(tplPath, 'utf8');
const json = JSON.stringify(bg).replace(/</g, '\\u003c');
tpl = tpl.replace('/*__BG_DATA__*/null', json);
const urls = fs.existsSync(path.join(ROOT, 'docs', 'urls.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'urls.json'), 'utf8')) : {};
tpl = tpl.replace('GAME_URL', urls.game || '#').replace('REPORT_URL', urls.report || '#');
fs.writeFileSync(path.join(ROOT, 'docs', 'bible.html'), tpl);
const cats = {}; items.forEach((it) => (cats[it.cat] = (cats[it.cat] || 0) + 1));
console.log('items', items.length, 'papers', Object.keys(papers).length, 'memes', memes.length, 'cats', JSON.stringify(cats));
console.log('history.js', (fs.statSync(path.join(ROOT, 'src', 'history.js')).size / 1024).toFixed(1) + ' KB');

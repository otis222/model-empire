/* 檢查簡體轉換：把遊戲所有文字跑一次轉換，列出還留著的繁體字。有殘留時結束碼是 1。用法：node tools/zh_check.js
   新增文字後跑一次。列在「不在 GB2312」的字不一定有錯（人名、日文字），要人工看。
   要加新的大陸用語前，先看它在遊戲裡的上下文：node tools/zh_check.js 詞 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = path.join(__dirname, '..', 'src');
const FILES = fs.readdirSync(SRC).filter((f) => f.endsWith('.js') && !f.startsWith('zh'));  // 新增的原始檔會自動納入檢查
const sandbox = {}; sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['zh_table.js', 'zh.js']) vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), sandbox, { filename: f });
const { conv } = sandbox.ME_ZH; const dict = sandbox.ME_ZH.dict();

const trad = new Set([...dict.keys()].filter((k) => k.length === 1 && dict.get(k) !== k));
// 詞表刻意留下來的寫法（著名、昇腾）不算殘留
const kept = [...new Set(dict.values())].filter((v) => [...v].some((c) => trad.has(c)));

const gbk = new TextDecoder('gbk'); const gb = new Set();
for (let b1 = 0xb0; b1 <= 0xf7; b1++) for (let b2 = 0xa1; b2 <= 0xfe; b2++) { const c = gbk.decode(new Uint8Array([b1, b2])); if (c.length === 1) gb.add(c); }

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[\s;{}(),])\/\/[^\n]*/g, '$1');
const term = process.argv[2];
if (term) {
  const seen = new Set();
  for (const f of FILES) {
    const s = strip(fs.readFileSync(path.join(SRC, f), 'utf8'));
    for (let i = s.indexOf(term); i >= 0; i = s.indexOf(term, i + 1)) seen.add(s.slice(Math.max(0, i - 8), i + term.length + 8).replace(/\s+/g, ' '));
  }
  console.log(`「${term}」出現在 ${seen.size} 種上下文：\n` + [...seen].map((c) => `  ${c}  →  ${conv(c)}`).join('\n'));
  process.exit(0);
}
const left = new Map(); const review = new Map();
for (const f of FILES) {
  let out = conv(strip(fs.readFileSync(path.join(SRC, f), 'utf8')));
  for (const k of kept) out = out.split(k).join(' ');
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    const box = trad.has(c) ? left : /[㐀-鿿豈-﫿]/.test(c) && !gb.has(c) ? review : null;
    if (box && !box.has(c)) box.set(c, f + '：' + out.slice(Math.max(0, i - 8), i + 8).replace(/\s+/g, ' '));
  }
}
const show = (m) => [...m].map(([c, v]) => `  ${c}  ${v}`).join('\n');
if (review.size) console.log(`不在 GB2312，要人工看（${review.size}）：\n${show(review)}`);
if (left.size) { console.log(`還有繁體字（${left.size}）：\n${show(left)}`); process.exit(1); }
console.log(`簡體轉換檢查通過：字 ${trad.size}、詞 ${dict.size - trad.size}，沒有殘留繁體。`);

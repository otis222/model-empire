/* 從 OpenCC 的字典產生 src/zh_table.js。用法：node tools/zh_table.js <字典資料夾> <OpenCC commit>
   字典資料夾要有 https://github.com/BYVoid/OpenCC 的 data/dictionary/TSCharacters.txt 和 TSPhrases.txt。原檔不進 repo。
   只留 Big5 範圍的字和遊戲用到的字，一字多轉時取第一個，表會小很多。 */
const fs = require('fs');
const path = require('path');
const [dir, commit] = process.argv.slice(2);
if (!dir || !commit) { console.error('用法：node tools/zh_table.js <字典資料夾> <OpenCC commit>'); process.exit(1); }
const SRC = path.join(__dirname, '..', 'src');
const GAME = ['data.js', 'content.js', 'history.js', 'engine.js', 'icons.js', 'globe.js', 'ui.js'].map((f) => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');

const keep = new Set(GAME.match(/[㐀-鿿豈-﫿]/g));
const big5 = new TextDecoder('big5');
for (let b1 = 0xa4; b1 <= 0xf9; b1++) {
  for (let b2 = 0x40; b2 <= 0xfe; b2++) {
    if (b2 > 0x7e && b2 < 0xa1) continue;
    const c = big5.decode(new Uint8Array([b1, b2]));
    if (c.length === 1 && c.charCodeAt(0) >= 0x4e00 && c.charCodeAt(0) <= 0x9fff) keep.add(c);
  }
}
const lines = (f) => fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t'));

let chars = ''; let n = 0;
for (const [t, s] of lines('TSCharacters.txt')) {
  const first = s.split(' ')[0];
  if (t.length !== 1 || first.length !== 1 || t === first || !keep.has(t)) continue;
  chars += t + first; n++;
}
// 例外詞只留遊戲文字用得到的（整份詞表多半是罕見字和人名）。常用的另外寫在 zh.js 的 TERMS
const phrases = [];
for (const [t, s] of lines('TSPhrases.txt')) {
  const first = s.split(' ')[0];
  if (GAME.includes(t)) phrases.push(t + '=' + first);
}
const out = `/* 繁轉簡字表，由 tools/zh_table.js 產生，不要手動改。
   資料來自 OpenCC（https://github.com/BYVoid/OpenCC，commit ${commit}）的 TSCharacters.txt 和 TSPhrases.txt，Apache License 2.0。
   這裡只保留部分字詞，授權全文見 THIRD_PARTY_NOTICES.md。 */
window.ME_ZH_TABLE = ${JSON.stringify({ chars, phrases: phrases.join(' ') })};
`;
fs.writeFileSync(path.join(SRC, 'zh_table.js'), out);
console.log('字', n, '詞', phrases.length, '大小', Buffer.byteLength(out), 'bytes');

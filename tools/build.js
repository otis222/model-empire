/* 建置：把 src/ 內的 CSS 與 JS 內嵌成單一 HTML
   產出 dist/model-empire.html（完整文件，可直接用瀏覽器開啟）與 dist/artifact.html（給 Artifact 發布用，無 html/head/body 外殼） */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const DIST = path.join(__dirname, '..', 'dist');
fs.mkdirSync(DIST, { recursive: true });

const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
const safe = (js) => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const css = read('style.css');
const scripts = ['zh_table.js', 'zh.js', 'data.js', 'content.js', 'history.js', 'engine.js', 'icons.js', 'globe.js', 'social.js', 'talk.js', 'trial.js', 'ui.js'].filter((f) => fs.existsSync(path.join(SRC, f)));
if (scripts.indexOf('content.js') < 0) console.warn('⚠️ 找不到 content.js，事件與新聞將為空');

// 字型先用 media="print" 載入，好了才切成 all：連不上 Google Fonts 時畫面不會卡住，直接用備用字型
const FONTS = 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&family=Noto+Serif+TC:wght@900&family=Archivo:wdth,wght@62..125,400..900&family=Barlow+Semi+Condensed:ital,wght@0,500;0,600;0,700;0,800;1,600;1,800&display=swap';
const head = `<title>模型帝國</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="大模型創業經營策略遊戲：設計模型配方、搶算力、挖人才、跟六家對手競爭，2030 年前打造最強 AI。">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="${FONTS}"></noscript>
<style>
${css}
</style>`;
const body = `<div id="app"></div>
${scripts.map((f) => `<script>\n/* ${f} */\n${safe(read(f))}\n</script>`).join('\n')}`;

const full = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover">
${head}
</head>
<body>
${body}
</body>
</html>
`;
const artifact = `${head}
${body}
`;
// 美術資產：複製到 dist/assets（HTML 以相對路徑 assets/… 引用）
const ASSETS = path.join(SRC, 'assets');
if (fs.existsSync(ASSETS)) {
  fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
  for (const f of fs.readdirSync(ASSETS)) fs.copyFileSync(path.join(ASSETS, f), path.join(DIST, 'assets', f));
  fs.writeFileSync(path.join(DIST, 'assets.json'), JSON.stringify(fs.readdirSync(ASSETS).reduce((o, f) => { o['assets/' + f] = 'dist/assets/' + f; return o; }, {}), null, 1));
}
fs.writeFileSync(path.join(DIST, 'model-empire.html'), full);
fs.writeFileSync(path.join(DIST, 'artifact.html'), artifact);
console.log('built', (full.length / 1024).toFixed(1) + ' KB', 'scripts:', scripts.join(', '));

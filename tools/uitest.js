/* 介面煙霧測試：node tools/uitest.js <outdir> [width] [height] [dark] */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2]; const W = +(process.argv[3] || 1366), H = +(process.argv[4] || 860); const dark = process.argv[5] === 'dark';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  async function clearModals() {
    for (let k = 0; k < 12; k++) {
      const modal = await page.$('.modal'); if (!modal) return;
      const rel = await page.$('[data-act="release"]'); if (rel) { await rel.click(); await page.waitForTimeout(120); continue; }
      const ch = await page.$('[data-act="choose"]'); if (ch) { await ch.click(); await page.waitForTimeout(120); continue; }
      const c = await page.$('[data-act="close-modal"]'); if (c) { await c.click(); await page.waitForTimeout(120); continue; }
      await page.keyboard.press('Escape');
    }
  }

  await page.goto('file://' + path.resolve(__dirname, '../dist/model-empire.html'));
  await page.waitForTimeout(600);
  const tag = (W < 600 ? 'm' : 'd') + (dark ? 'k' : '');
  await page.screenshot({ path: `${out}/${tag}_01_title.png`, fullPage: false });
  await page.click('[data-act="new-game"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${tag}_02_welcome.png` });
  await page.click('[data-act="welcome-go"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${tag}_03_wizard.png` });
  const btnText = await page.textContent('#wiz-start');
  console.log('wizard start button:', btnText);
  await page.click('#wiz-start');
  await page.waitForTimeout(300);
  await clearModals();
  // 跑時間，處理彈窗
  await page.click('[data-act="speed"][data-v="3"]');
  const t0 = Date.now(); let handled = 0;
  while (Date.now() - t0 < 40000) {
    await page.waitForTimeout(400);
    const modal = await page.$('.modal');
    if (modal) {
      const rel = await page.$('[data-act="release"]');
      if (rel) { await page.screenshot({ path: `${out}/${tag}_04_report.png` }); await rel.click(); handled++; continue; }
      const ch = await page.$('[data-act="choose"]');
      if (ch && !global.__evShot) { global.__evShot = 1; await page.screenshot({ path: `${out}/${tag}_05_event.png` }); }
      if (ch) { await ch.click(); await page.waitForTimeout(120); if (global.__evShot === 1) { global.__evShot = 2; await page.screenshot({ path: `${out}/${tag}_06_event_result.png` }); } await page.waitForTimeout(150); const c = await page.$('.mf [data-act="close-modal"]'); if (c) await c.click(); handled++; continue; }
      const c = await page.$('[data-act="close-modal"]'); if (c) { await c.click(); handled++; continue; }
    }
    const wk = await page.evaluate(() => document.querySelector('.date') && document.querySelector('.date').textContent);
    if (wk && /2025年3月/.test(wk)) break;
  }
  await clearModals();
  await page.click('[data-act="speed"][data-v="0"]').catch(() => {});
  await clearModals();
  console.log('modals handled:', handled, 'date:', await page.textContent('.date'));
  const tabs = ['home', 'models', 'tech', 'team', 'compute', 'data', 'market', 'finance'];
  for (let i = 0; i < tabs.length; i++) {
    await clearModals();
    await page.click(`[data-act="tab"][data-id="${tabs[i]}"]`);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/${tag}_1${i}_${tabs[i]}.png`, fullPage: W >= 600 });
    const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    if (ov.sw > ov.cw + 1) errs.push(`horizontal overflow on ${tabs[i]}: ${ov.sw} > ${ov.cw}`);
  }
  // 試聊與選單
  await clearModals();
  await page.click('[data-act="tab"][data-id="models"]');
  const chatBtn = await page.$('[data-act="chat"]');
  if (chatBtn) { await chatBtn.click(); await page.waitForTimeout(200); const q = await page.$('[data-act="ask"]'); if (q) { await q.click(); await page.waitForTimeout(900); } await page.screenshot({ path: `${out}/${tag}_20_chat.png` }); await page.click('[data-act="close-modal"]'); }
  await page.click('[data-act="menu"]'); await page.waitForTimeout(150); await page.screenshot({ path: `${out}/${tag}_21_menu.png` });
  console.log('ERRORS:', errs.length ? '\n' + errs.join('\n') : 'none');
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });

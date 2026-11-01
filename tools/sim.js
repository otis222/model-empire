/* 無頭平衡模擬：node tools/sim.js [seed] [strategy] [scenario] [city]
   strategy: balanced | open | cheap | frontier | idle */
const path = require('path');
const fs = require('fs');
global.window = globalThis;
const SRC = path.join(__dirname, '..', 'src');
require(path.join(SRC, 'data.js'));
if (fs.existsSync(path.join(SRC, 'content.js'))) require(path.join(SRC, 'content.js'));
if (fs.existsSync(path.join(SRC, 'history.js'))) require(path.join(SRC, 'history.js'));
const ME = require(path.join(SRC, 'engine.js'));
const D = window.ME_DATA;

const seed = +(process.argv[2] || 1);
const strategy = process.argv[3] || 'balanced';
const scenario = process.argv[4] || 'garage';
const city = process.argv[5] && process.argv[5].indexOf('--') !== 0 ? process.argv[5] : ''; // 總部城市（不給就不套城市效果）
const quiet = process.argv.includes('--quiet');
const pacing = process.argv.includes('--pacing');
// 統計日誌類型（日誌只留 160 則，結束時再數會不準）
const logKinds = {};
const origLog = ME.Game.prototype.log;
ME.Game.prototype.log = function (t, k, x) { logKinds[k || 'info'] = (logKinds[k || 'info'] || 0) + 1; return origLog.call(this, t, k, x); };
const g = process.env.LOAD ? ME.Game.load(fs.readFileSync(process.env.LOAD, 'utf8')) : ME.Game.create({ scenario, company: '測試實驗室', mascot: 'whale', series: 'Test', seed, city }); // LOAD：從存檔接著跑
const s = g.s;

const PRIO = ['t_3d', 't_dedup', 't_quant', 't_paged', 't_tools', 't_redteam', 't_cotprompt', 't_chin', 't_comply', 't_moe', 't_resmgmt', 't_gqa', 't_rope', 't_vision', 't_dpo', 't_cai', 't_spec', 't_finemoe', 't_curr', 't_mtp', 't_resil', 't_mla', 't_synth', 't_distill', 't_imagegen', 't_fp8', 't_cot', 't_ttc', 't_voice', 't_hybrid', 't_muon', 't_agentrl', 't_sparse', 't_water', 't_interp', 't_video', 't_mctx', 't_vla', 't_oversight', 't_airesearch', 't_selfimprove', 't_ctrltakeoff', 't_agi_core'];
// 其餘科技照公開日期排在後面；互斥組依策略與亂數種子選路線，讓各局走不同的分支
// 衝前沿和削價的策略不想花時間在監督機制上
if (strategy === 'frontier' || strategy === 'cheap') PRIO.splice(PRIO.indexOf('t_oversight'), 1);
const ORDER = PRIO.concat(D.TECHS.filter((t) => PRIO.indexOf(t.id) < 0).sort((a, b) => (a.pub < b.pub ? -1 : a.pub > b.pub ? 1 : a.cost - b.cost)).map((t) => t.id)).filter((id) => !((strategy === 'frontier' || strategy === 'cheap') && id === 't_oversight'));
const PICK = { open: { x_open: 't_openeco', x_cluster: 't_intellect' }, frontier: { x_takeoff: 't_selfimprove', x_open: 't_weightsec', x_cluster: 't_megacluster' }, cheap: { x_next: 't_mercury', x_chip: 't_lease', x_biz: 't_devplat' }, balanced: { x_takeoff: 't_ctrltakeoff', x_open: 't_weightsec', x_align: 't_breakers' } };
function exclOK(id) {
  const t = ME.TECH[id]; if (!t.excl) return true;
  const pick = (PICK[strategy] || {})[t.excl]; if (pick) return pick === id;
  const list = D.TECHS.filter((x) => x.excl === t.excl);
  return list[seed % list.length].id === id;
}
function botResearch() {
  const income = (s.lastWeek && s.lastWeek.rp) || 20;
  while (g.researchJobs().length < g.researchSlots()) {
    let started = false;
    for (const id of ORDER) {
      if (!exclOK(id) || !g.techAvailable(id)) continue;
      const c = g.techCost(id);
      if (s.rp >= c) { g.research(id); started = true; break; }
      if (c <= s.rp + income * 10) break; // 快存夠了就等，不要一直挑便宜的
    }
    if (!started) break;
  }
  if (g.futureAvailable() && s.rp >= g.futureCost() * 1.5) g.researchFuture();
}

function bestGpuType() {
  const av = D.GPUS.filter((x) => g.gpuAvail(x.id));
  av.sort((a, b) => b.pf / g.gpuPrice(b.id) - a.pf / g.gpuPrice(a.id) + (b.pf - a.pf) * 0.000001);
  // 偏好每槽位效能：取 pf 最高中性價比合理者
  av.sort((a, b) => b.pf - a.pf);
  return av[0];
}

// 後訓練比重：有 Agentic RL 之後加重 Agent；最後一幕要把五項核心能力都拉上門檻
function botAlloc() {
  const safe = strategy === 'cheap' ? 15 : strategy === 'frontier' ? 20 : 30;
  if (s.race) return { help: 30, safe, reason: 25, agent: g.has('t_tools') ? 25 : 0 };
  return { help: 40, safe, reason: 20, agent: g.has('t_tools') ? (g.has('t_agentrl') ? 20 : 10) : 0 };
}
function designModel() {
  const freeOwned = g.freeEq();
  const rentBudgetWeeks = strategy === 'idle' ? 0 : 1;
  const burn = Math.max(1e5, g.weeklyExpense());
  // 可負擔的租卡量：讓 12 週租金不超過現金的 35%
  const rentPrice = g.rentPrice();
  let rentAff = Math.max(0, (s.cash * (strategy === 'frontier' ? 0.5 : 0.35)) / (12 * rentPrice));
  rentAff = Math.max(0, Math.min(rentAff, g.rentCap() * 0.8 - g.currentInferRent() - g.currentTrainRent()));
  let G = Math.floor(freeOwned + rentAff * rentBudgetWeeks);
  if (G < 8) return null;
  const arch = ['sparse', 'hybrid', 'moe_mla', 'moe', 'dense'].find((a) => g.archUnlocked(a));
  const mfu = g.mfu() * ME.ARCH[arch].mfu;
  const weeks = 10;
  const C = G * D.BAL.H100_WEEK_FLOPS * mfu * weeks / 1.08;
  // C = 6 * Nact * Dt ; 目標 tokens/Neff ≈ 30
  let best = null;
  for (const N of D.SIZES) {
    if (N > g.maxSize()) continue;
    if (arch !== 'dense' && N < 14) continue;
    for (const T of D.TOKEN_STEPS) {
      const sp = { name: g.nextModelName(), arch, size: N, tokens: T, mix: { web: 55, code: 25, sci: 20, mm: g.has('t_vision') ? 10 : 0 }, post: g.has('t_cot') ? 'heavy' : 'std', alloc: botAlloc(), gpus: G };
      const ev = g.evalSpec(sp);
      if (ev.C > C) continue;
      if (G < ev.minGpus) continue;
      if (!best || ev.comp > best.ev.comp) best = { sp, ev };
    }
  }
  return best;
}

function rev0() { return g.avgRevenue(); }
function botWeek() {
  // 事件
  let guard = 0;
  while (s.pending.length && guard++ < 10) {
    const p = s.pending[0];
    if (p.sys === 'trained') {
      g.resolveEvent(0);
      const m = s.models.find((x) => x.id === p.model);
      const prev = g.bestModel();
      const c = g.composite(m.stats); const F = g.frontierComp();
      if (!prev || c >= g.composite(prev.stats) - 4) {
        const price = strategy === 'cheap' ? 'low' : c >= F ? 'high' : c >= F - 6 ? 'mid' : 'low';
        const r = g.releaseModel(m.id, price, strategy === 'open');
        if (r && r.ok === false) { m.stats.safety = m.stats.safety; }
        // 下架太舊的模型
        const rel = s.models.filter((x) => x.rel && !x.rel.retired);
        if (rel.length > 3) g.retireModel(rel[0].id);
      }
    } else {
      // 年底抉擇：明顯落後就收手（衝前沿的策略比較不甘心）
      if (p.ev === 'race_settle' && ['empire', 'open_legend'].indexOf(g.settleEnding()) >= 0 && seed % 2 === 0) { g.resolveEvent(1); continue; } // 經營結局到手，一半的局見好就收
      if (p.ev === 'race_settle') { const R = g.agiRace(); const lead = R.rivals[0]; g.resolveEvent(g.bestRank() > 1 && lead && lead.pct - R.me.pct > ({ frontier: 50, balanced: 35, open: 25, cheap: 20 }[strategy] || 30) ? 1 : 0); continue; }
      const chs = p.sys ? [{}, {}] : ((g.EVT[p.ev] || {}).choices || [{}]);
      const ok = chs.map((c, i) => i).filter((i) => !(chs[i].effects && chs[i].effects.ending));
      // 穩健策略平常選第一個；最後一幕的決定各局不同
      const race = g.EVT[p.ev] && g.EVT[p.ev].cat === 'race';
      if (ok.length) g.resolveEvent(strategy === 'balanced' ? (race ? ok[(seed + s.week) % ok.length] : ok[0]) : ok[Math.floor(g.rand() * ok.length)]);
      else g.resolveEvent(0);
    }
  }
  // 研究
  botResearch();
  if (g.has('t_synth') && !s.jobs.some((j) => j.kind === 'synth') && g.yrs > 3 && s.week % 8 === 0) {
    const free = Math.floor(g.freeEq() * 0.25); if (free > 200) g.startSynth(g.pick(['web', 'code', 'sci']), free, 3);
  }
  // 募資
  if (g.roundReady().ok && (s.cash < g.weeklyExpense() * 80 || s.roundIdx < 2)) g.raiseFunds();
  const burn = Math.max(5e4, g.weeklyExpense());
  // 招人
  const cap = g.officeCap(); const tot = g.totalStaff();
  if (s.cash > burn * 40 && tot < cap) {
    const need = Math.ceil(g.engNeeded());
    if (g.roleHeads('eng') < need) g.hire('eng', 1);
    else {
      const ratio = { res: 0.36, eng: 0.22, data: 0.14, align: 0.12, biz: 0.16 };
      let worst = null, wv = 1e9;
      for (const r in ratio) { const v = g.roleHeads(r) / (tot * ratio[r] + 1); if (v < wv) { wv = v; worst = r; } }
      g.hire(worst, Math.max(1, Math.floor(tot / 12)));
    }
  }
  if (g.totalStaff() >= cap - 1 && D.OFFICES[s.office + 1] && s.cash > D.OFFICES[s.office + 1].cost * 4 + burn * 20) g.upgradeOffice();
  // 算力
  const gt = bestGpuType();
  const lw0 = s.lastWeek || {};
  if (gt && lw0.served < 0.95 && s.cash > burn * 8) {
    const short = Math.max(0, (lw0.inferNeed || 0) - g.ownedEq() * 0.8);
    let n = Math.min(g.dcSlots() - g.cardCount(), Math.ceil(short / gt.pf), Math.floor(s.cash * 0.3 / g.gpuPrice(gt.id)));
    if (n >= 8) g.buyGpu(gt.id, n);
  }
  // 電費已經吃掉太多營收時先不加卡
  if (gt && s.cash > burn * 30 && g.powerCost() < Math.max(2e5, rev0() * 0.25)) {
    const budget = s.cash * (strategy === 'frontier' ? 0.35 : 0.22);
    const slots = g.dcSlots() - g.cardCount();
    let n = Math.min(slots, Math.floor(budget / g.gpuPrice(gt.id)));
    if (n >= 8) g.buyGpu(gt.id, n);
  }
  const nx = D.DATACENTERS[s.dc + 1];
  if (nx && !s.dcBuild && g.cardCount() > g.dcSlots() * 0.8 && s.cash > nx.cost * 2.5 && (!nx.from || g.ym >= nx.from)) g.upgradeDC();
  // 資料
  for (const d of D.DATA_DEALS) if (g.dealAvailable(d) && s.cash > g.dealPrice(d) * 15) g.buyDeal(d.id);
  if (s.data.inst < 120 && s.cash > burn * 30) g.buyInst(20);
  // 合成資料
  if (g.has('t_synth') && !s.jobs.some((j) => j.kind === 'synth') && s.data.code.amt < g.poolCap('code') * 0.9 && s.week % 26 === 0) {
    const free = Math.floor(Math.max(0, g.ownedEq() - g.reservedEq()) * 0.3);
    if (free > 50) g.startSynth('code', free, 4);
  }
  // 行銷
  const rev = g.avgRevenue();
  s.marketing = rev > 5e7 ? 6 : rev > 1e7 ? 5 : rev > 2e6 ? 4 : rev > 3e5 ? 3 : rev > 5e4 ? 2 : rev > 1e4 ? 1 : 0;
  // 資金緊張：先砍行銷，再借過橋貸款
  if (s.cash < burn * 6) s.marketing = 0;
  if (s.cash < burn * 3 && !s.flags.loanUsed) g.emergencyLoan();
  // 一直賠錢又快沒錢了：把上線模型的價格調高一級
  if (s.cash < burn * 12 && rev < burn * 0.9 && s.week % 8 === 0) {
    const tiers = D.PRICE_TIERS.map((p) => p.id);
    for (const x of s.models) if (x.rel && !x.rel.retired) { const i = tiers.indexOf(x.rel.price); if (i >= 0 && i < 3) g.setPrice(x.id, tiers[i + 1]); }
  }
  // 訓練
  if (strategy !== 'idle' && g.canStartJob() && !s.jobs.some((j) => j.kind === 'train')) {
    const d = designModel();
    if (d) {
      const prev = g.bestModel(true);
      // 分數夠高，或最佳模型上線太久開始老化，就訓練下一代
      const rel = g.bestModel(); const stale = rel && rel.rel && s.week - rel.rel.w >= 40;
      if (!prev || d.ev.comp > g.composite(prev.stats) + 1.5 || (stale && d.ev.comp >= g.composite(prev.stats) - 1)) {
        const r = g.startTraining(d.sp);
        if (!r.ok && !quiet) console.log('  start fail', r.errs.join('; '));
      }
    }
  }
}

function line() {
  const best = g.bestModel(); const bc = best ? g.composite(best.stats) : 0;
  const lw = s.lastWeek || {};
  return [g.ym, 'cash ' + ME.fmtMoney(s.cash), 'rev ' + ME.fmtMoney(g.avgRevenue()) + '/w', 'exp ' + ME.fmtMoney(lw.exp || 0) + '/w',
    'val ' + ME.fmtMoney(s.valuation), 'eq ' + (s.equity * 100).toFixed(0) + '%', 'best ' + bc.toFixed(1) + ' (#' + g.bestRank() + ')', 'front ' + g.frontierComp().toFixed(1),
    'staff ' + g.totalStaff(), 'gpu ' + Math.round(g.ownedEq()) + '+' + Math.round(lw.rentEq || 0) + 'r', 'served ' + Math.round((lw.served || 1) * 100) + '%', 'rp ' + Math.round(s.rp) + ' (+' + Math.round(lw.rp || 0) + ')',
    'rep ' + s.rep.toFixed(0), 'reg ' + s.reg.toFixed(0), 'mor ' + s.morale.toFixed(0), 'tech ' + Object.keys(s.techs).length, 'models ' + s.models.length,
    'share api ' + (g.playerShare('api') * 100).toFixed(1) + '% chat ' + (g.playerShare('chat') * 100).toFixed(1) + '%'].join(' | ');
}

// 節奏統計（tools/pacing.js 用）：每週記錄，結束時印一行 JSON
const M = { yr: {}, firstRel: null, lastNeg: 0, rank1: null, minRunway: Infinity };
function track() {
  const lw = s.lastWeek || {}; const rev = lw.rev || 0; const exp = lw.exp || 0; const techN = Object.keys(s.techs).length; const best = g.bestModel();
  if (!M.firstRel && s.models.some((m) => m.rel)) M.firstRel = s.week;
  if (rev < exp) M.lastNeg = s.week;
  if (!M.rank1 && best && g.bestRank() === 1) M.rank1 = s.week;
  if (exp > 0 && s.week > 30) M.minRunway = Math.min(M.minRunway, s.cash / exp);
  if (s.week % 52 === 0) M.yr[2023 + s.week / 52] = { cash: Math.round(s.cash / 1e6), rev: Math.round(rev / 1e4) / 100, exp: Math.round(exp / 1e4) / 100, rp: Math.round(s.rp), rpw: Math.round(lw.rp || 0), tech: techN, rank: best ? g.bestRank() : 0, models: s.models.length, best: best ? Math.round(g.composite(best.stats)) : 0, front: Math.round(g.frontierComp()), staff: g.totalStaff(), share: Math.round(g.playerShare('chat') * 100), gpu: Math.round(g.ownedEq()) };
  M.models = s.models.length; M.ended = s.ended; M.week = s.week; M.rpLeft = Math.round(s.rp); M.techN = techN; M.techPct = Math.round(100 * techN / D.TECHS.length); M.questAll = s.quest ? s.quest.all : null; M.best = best ? Math.round(g.composite(best.stats)) : 0;
}
let lastPrint = -99;
while (!s.ended) {
  botWeek();
  g.tick();
  track();
  if (s.pending.length && s.pending.length > 5) { console.log('pending stuck', s.pending); break; }
  if ((!quiet && s.week - lastPrint >= 26) || (process.env.EARLY && s.week <= 120 && s.week % 6 === 0)) { lastPrint = s.week; console.log(line()); }
  if (s.week > 800) break;
}
if (pacing) { console.log('PACING ' + JSON.stringify(M)); process.exit(0); }
if (process.env.CHRON) for (const e of s.chron) console.log('C', e.w, ME.ymOf(e.w), e.k, 'p' + e.p, e.t);
console.log('END', JSON.stringify(s.ended), '\n' + line());
console.log('ach', Object.keys(s.ach).join(','));
console.log('log', JSON.stringify(logKinds), '| meme events', Object.keys(s.fired).filter((k) => k.indexOf('meme_') === 0).map((k) => k.slice(5) + '×' + s.fired[k]).join(' ') || '—');
// 首月評級與新手任務（GRADES=1 時逐一列出每次發布的名次與營收佔比，用來校準評級門檻）
const graded = s.models.filter((m) => m.rel && m.rel.grade); const gd = {};
graded.forEach((m) => (gd[m.rel.grade] = (gd[m.rel.grade] || 0) + 1));
console.log('grades', ['S', 'A', 'B', 'C'].map((k) => k + '×' + (gd[k] || 0)).join(' '), '| quests', s.quest ? Object.keys(s.quest.done).map((k) => k.slice(2) + '@' + s.quest.done[k]).join(' ') : '—');
if (process.env.GRADES) graded.forEach((m) => console.log('G', m.name, m.rel.grade, 'peak', m.rel.peak, 'gap', m.rel.gap0, 'mkt', m.rel.mkt, m.rel.price, m.rel.open ? 'open' : 'closed', 'w', m.rel.w, m.rel.note));
const lb = g.leaderboard().slice(0, 8).map((r) => r.org + ':' + r.name + ' ' + r.comp.toFixed(1)).join(' / ');
console.log('LB', lb);
if (!quiet) {
  const lastModels = s.models.slice(-3).map((m) => m.name + ' ' + m.arch + ' ' + ME.fmtParams(m.size) + ' ' + ME.fmtTokens(m.tokens) + ' comp ' + m.comp0.toFixed(1) + ' ' + JSON.stringify(Object.fromEntries(Object.entries(m.stats).map(([k, v]) => [k, Math.round(v)]))));
  console.log(lastModels.join('\n'));
  console.log('companies', g.companyRevenues().map((c) => c.name + ' ' + ME.fmtMoney(c.rev)).join(' / '));
}

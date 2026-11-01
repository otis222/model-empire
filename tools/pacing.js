/* 節奏與難度對照：node tools/pacing.js [每組局數=12] [--detail]
   跑 garage／spinoff／embargo × balanced／frontier／cheap／open，統計結局、評等、第一次登頂、破產率等。會讀 src，不寫專案 */
const { spawn } = require('child_process'); const path = require('path'); const os = require('os');
const N = +(process.argv[2] || 12); const detail = process.argv.includes('--detail');
const SC = (process.env.SC || 'garage,spinoff,embargo').split(','); const ST = (process.env.ST || 'balanced,frontier,cheap,open').split(',');
const jobs = []; for (const sc of SC) for (const st of ST) for (let seed = 1; seed <= N; seed++) jobs.push({ sc, st, seed });
const med = (a) => { const b = a.filter((x) => x != null && isFinite(x)).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
const res = {}; let next = 0, running = 0; const POOL = Math.max(2, os.cpus().length - 4);
function pump(done) {
  while (running < POOL && next < jobs.length) {
    const j = jobs[next++]; running++;
    const p = spawn(process.execPath, [path.join(__dirname, 'sim.js'), String(j.seed), j.st, j.sc, '--quiet', '--pacing']); let out = '';
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));
    p.on('close', () => { running--; const m = out.split(/\r?\n/).find((l) => l.startsWith('PACING ')); const k = j.sc + '/' + j.st; (res[k] = res[k] || []); if (m) res[k].push(Object.assign(JSON.parse(m.slice(7)), { seed: j.seed })); else console.log('FAIL', j, out.slice(-400)); if (next >= jobs.length && !running) done(); else pump(done); });
  }
}
function count(R, f) { const o = {}; R.forEach((x) => { const v = f(x); o[v] = (o[v] || 0) + 1; }); return o; }
pump(() => {
  for (const k in res) res[k].sort((a, b) => a.seed - b.seed); // 程序結束的順序不固定，排好輸出才穩定
  const all = []; const lines = [];
  for (const sc of SC) for (const st of ST) {
    const k = sc + '/' + st; const R = res[k] || []; all.push(...R);
    lines.push(k.padEnd(18) + ' ' + JSON.stringify({ ends: count(R, (x) => x.ended && x.ended.type), gr: count(R, (x) => x.ended && x.ended.grade), endW: med(R.map((x) => x.week)), rel: med(R.map((x) => x.firstRel)), lastNeg: med(R.map((x) => x.lastNeg)), rank1: med(R.map((x) => x.rank1)), tech: med(R.map((x) => x.techN)), models: med(R.map((x) => x.models)), rpLeft: med(R.map((x) => x.rpLeft)), run: med(R.map((x) => Math.round(x.minRunway * 10) / 10)), best: med(R.map((x) => x.best)) }));
  }
  console.log(lines.join('\n'));
  for (const sc of SC) {
    const R = []; ST.forEach((st) => R.push(...(res[sc + '/' + st] || [])));
    const e = count(R, (x) => x.ended && x.ended.type); const g = count(R, (x) => x.ended && x.ended.grade);
    console.log('== ' + sc + ' n=' + R.length, 'bankrupt ' + Math.round(100 * (e.bankrupt || 0) / R.length) + '%', 'survive ' + Math.round(100 * (e.survive || 0) / R.length) + '%', 'S ' + Math.round(100 * (g.S || 0) / R.length) + '%', 'rank1 med', med(R.map((x) => x.rank1)), 'techPct', med(R.map((x) => x.techPct)), 'ends', JSON.stringify(e), 'grades', JSON.stringify(g));
  }
  const e = count(all, (x) => x.ended && x.ended.type); const g = count(all, (x) => x.ended && x.ended.grade);
  console.log('== ALL n=' + all.length, JSON.stringify(e), JSON.stringify(g), 'quests all done', all.filter((x) => x.questAll != null).length, 'median', med(all.map((x) => x.questAll)), 'first bankrupt w', Math.min(...all.filter((x) => x.ended && x.ended.type === 'bankrupt').map((x) => x.week)), 'rival wins', JSON.stringify(count(all.filter((x) => x.ended && x.ended.rival), (x) => x.ended.rival)));
  const pct = (a, q) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length * q)] : null; };
  const scores = all.map((x) => x.ended && x.ended.score);
  console.log('進延長賽 ' + Math.round(100 * all.filter((x) => x.week > 417).length / all.length) + '%，結束週 p50', pct(all.map((x) => x.week), 0.5), 'p90', pct(all.map((x) => x.week), 0.9), 'max', Math.max(...all.map((x) => x.week)));
  console.log('score p50', pct(scores, 0.5), 'p75', pct(scores, 0.75), 'p90', pct(scores, 0.9), 'p95', pct(scores, 0.95), '| by ending', JSON.stringify(Object.keys(e).reduce((o, k) => { const R = all.filter((x) => x.ended && x.ended.type === k); o[k] = { w: med(R.map((x) => x.week)), score: med(R.map((x) => x.ended.score)) }; return o; }, {})));
  if (detail) { const yrs = {}; for (const x of (res[process.env.DETAIL || 'garage/balanced'] || [])) for (const y in x.yr) (yrs[y] = yrs[y] || []).push(x.yr[y]); for (const y of Object.keys(yrs).sort()) { const f = (key) => med(yrs[y].map((v) => v[key])); console.log(y, 'n', yrs[y].length, 'cash', f('cash'), 'M rev', f('rev'), 'M exp', f('exp'), 'M best', f('best'), 'front', f('front'), 'rank', f('rank'), 'staff', f('staff'), 'rp+', f('rpw'), 'rpLeft', f('rp'), 'tech', f('tech'), 'models', f('models'), 'share', f('share'), 'gpu', f('gpu')); } }
});

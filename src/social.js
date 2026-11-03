/* 《模型帝國》社交媒體「啾啾」：把遊戲日誌變成貼文，再加上網友的閒聊。這個檔案只讀遊戲狀態，不改任何數值。
   貼文存在存檔的 s.social，由介面層在每次畫面更新時同步，所以引擎和機器人模擬都不知道它的存在。
   平台、帳號和人物全部是虛構的。 */
(function (root) {
  'use strict';
  const MAX_POSTS = 220; // 存檔裡最多留幾則（含回覆）

  /* ---------- 帳號 ---------- */
  const NET = {
    gpu_poor: ['算力窮人', '🥲'], prompt_lin: ['提示詞工程師小林', '✍️'], backend_zhou: ['後端老周', '🧑‍💻'], bench_addict: ['跑分狂', '📊'],
    open_or_die: ['開源教信徒', '🕊️'], doom_clock: ['末日倒數中', '⏳'], pm_afk: ['摸魚的 PM', '🐟'], wang_finance: ['財經老王', '💹'],
    phd_kai: ['研究生阿凱', '🎓'], mika_draws: ['插畫家 Mika', '🎨'], out_of_quota: ['額度又用完了', '🚫'], indie_hacker: ['一人公司阿豪', '🛠️'],
    night_shift: ['凌晨三點還在改 bug', '🌙'], meme_factory: ['迷因製造機', '🤡'],
  };
  const NET_KEYS = Object.keys(NET);
  const FIXED = {
    news: { n: 'AI 快訊', h: 'ai_flash', i: '🗞️', v: 1 },
    weekly: { n: '矽島週報', h: 'silicon_weekly', i: '📰', v: 1 },
    lab: { n: '算力研究室', h: 'compute_lab', i: '🔬', v: 1 },
    review: { n: '三分鐘評測', h: 'three_min_review', i: '🎬', v: 1 },
  };
  // 日誌裡的留言來源對應到哪些帳號
  const WHO_MAP = { 網友: null, 科技媒體: 'weekly', 開發者社群: ['backend_zhou', 'prompt_lin', 'indie_hacker', 'night_shift'], 產業分析師: ['wang_finance', 'lab'], 評測頻道: 'review' };
  function slug(t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'lab'; }
  // 回傳 { n 名稱, h 帳號, i 圖示, img 頭像, c 底色, v 認證 }
  function account(key, G, D) {
    const s = G.s; const m = D.MASCOTS.find((x) => x.id === s.mascot) || D.MASCOTS[0];
    if (key === 'me') return { n: s.company, h: slug(s.series || 'official') + '_ai', img: m.avatar, i: m.icon, v: 1, own: 1 };
    if (key === 'eng') return { n: '阿提｜' + s.company + ' 工程', h: 'ati_ships', i: '🧑‍🔧', v: 1, own: 1 };
    if (key === 'mascot') return { n: m.name, h: slug(m.id) + '_chan', img: m.avatar, i: m.icon, own: 1 };
    if (key.slice(0, 2) === 'r:') { const R = D.RIVALS.find((x) => x.id === key.slice(2)); if (R) return { n: R.name, h: slug(R.en), i: R.icon, c: R.color, v: 1 }; }
    if (FIXED[key]) return FIXED[key];
    const k = key.slice(0, 2) === 'n:' ? key.slice(2) : key;
    return NET[k] ? { n: NET[k][0], h: k, i: NET[k][1] } : { n: '匿名網友', h: 'anon', i: '💬' };
  }

  /* ---------- 文案 ---------- */
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const netKey = () => 'n:' + pick(NET_KEYS);
  const RELEASE = {
    top: ['{model} 今天上線，排行榜第 {rank}。我們自己也很驚訝。', '{model} 正式發布。這次不只是跑分，歡迎來試。', '第 {rank} 名。{model} 現在可以用了。'],
    mid: ['{model} 上線了，第 {rank} 名。我們還在往上爬。', '今天放出 {model}。不是最強，但比上一代好很多。', '{model} 發布，感謝每一位回報問題的人。'],
    low: ['{model} 今天上線。排名還不好看，下一代見。', '發布 {model}。我們知道還差得遠，先用看看。'],
  };
  const ENG_RELEASE = ['連續三週睡公司，{model} 終於放出去了。我要回家了。', '{model} 的訓練曲線我看到會背。今晚大家盡量用，伺服器我顧著。', '如果 {model} 掛了，先怪我。'];
  const OPEN_POST = ['{model} 的權重放出來了，拿去玩。', '今天把 {model} 開源。期待你們做出我們想不到的東西。'];
  const OPEN_REPLY = ['已經在自己的顯卡上跑起來了，風扇聲音像起飛。', '真的放了？我以為只是嘴上說說。', '感謝開源，我的畢業論文救回來了。'];
  const ACH_POST = ['老闆老闆！我們解鎖了「{name}」！可以放假嗎？', '「{name}」達成！我已經截圖發給所有人了。', '今天的好消息：「{name}」。今天的壞消息：還是要上班。'];
  const RIVAL_REPLY = ['{rival} 這次看起來有點東西。', '才剛學會上一代，又要換了。', '等第三方跑分再說。', '{company} 要怎麼接招？'];
  const OUTAGE = ['{company} 又在排隊了，我按了三次重試。', '「伺服器繁忙」已經是我這週看過最多次的中文。', '繳了月費還要排隊，{company} 你解釋一下。', '{company} 是不是又缺卡了？'];
  const EVENT_REPLY = { safety: ['這種事發生一次就夠了。', '公關部今晚不用睡了。'], regulation: ['法務應該已經在加班了。', '監管的信比新模型來得還快。'], capital: ['這條新聞財經版會寫三天。', '錢的事永遠最有戲。'], talent: ['矽島挖角大戰又開始了。', '人才市場比排行榜還熱鬧。'], compute: ['卡的問題，最後都是錢的問題。', '黃金都沒有顯卡保值。'], market: ['用戶永遠是最誠實的。', '這波操作我給及格。'], data: ['資料這件事早晚要算帳。'], research: ['論文還沒看完，又有新的。'], fun: ['這也能上新聞？', '笑死，已存圖。'], race: ['AGI 倒數計時又往前撥了一點。', '這真的是我們這輩子會看到的事嗎？'] };
  const PLAN_REPLY = { cut: ['我付的錢呢？', '額度越來越少，月費倒是沒變。', '已經在看隔壁家的方案了。'], cutRise: ['額度少了，月費還漲，真有你的。', '我付的錢呢？', '已經在看隔壁家的方案了。'], cutFall: ['便宜是便宜了，額度也跟著縮水。', '這不叫降價，這叫縮水。', '已經在看隔壁家的方案了。'], rise: ['又漲？', '月費又漲了，我的薪水倒是沒有。', '這個價錢，額度最好真的夠用。'], riseMore: ['漲是漲了，額度倒是真的有給。', '多付一點換多一點，還算老實。'], fall: ['降價了？先續一年再說。', '財務長今晚應該睡不著。'], up: ['這額度是認真的嗎？感恩。', '財務長今晚應該睡不著。'], max: ['{price} 一個月，比我的房租還有存在感。', '我算了一下，用得完就算賺。', '有錢真好。'] };
  // 閒聊：cond 回傳 true 才會被挑中；越具體的條件排越前面，會優先出現
  const CHATTER = [
    { w: 3, c: (x) => x.served < 0.7, t: ['{company} 現在開一次對話要等多久？我賭三分鐘。', '排隊的時間夠我自己寫完了。'] },
    { w: 3, c: (x) => x.plan && x.plan.fq < 1, t: ['{company} 的免費額度縮水成這樣，連問一題都要想很久。', '免費版現在大概只夠打招呼。'] },
    { w: 3, c: (x) => x.plan && x.plan.fq > 1.5, t: ['{company} 的免費額度大到有點不真實，老闆還好嗎？', '白嫖 {company} 第三個月，心裡有點過意不去，一點點。'] },
    { w: 3, c: (x) => x.plan && x.plan.sp >= 30, t: ['標準版漲到這個價，{company} 真的很有自信。', '我把訂閱清單翻出來，{company} 排第一貴。'] },
    { w: 3, c: (x) => x.plan && x.plan.sp <= 10, t: ['{company} 這個價格，便當都比它貴。', '這麼便宜，{company} 到底怎麼賺錢？'] },
    { w: 3, c: (x) => x.plan && x.plan.mx, t: ['同事偷偷訂了 {company} 的旗艦版，現在什麼都丟給它跑。', '旗艦版用戶的日常：怎麼把額度用完。'] },
    { w: 3, c: (x) => x.resetAgo != null && x.resetAgo <= 4, t: ['上次額度重置之後我就沒睡好。', '重置的好處是可以繼續用，壞處是可以繼續用。'] },
    { w: 2, c: (x) => x.rank === 1, t: ['{model} 穩坐第一，其他家壓力山大。', '現在問「哪個模型最好」，大家都回 {model}。'] },
    { w: 2, c: (x) => x.rank > 6, t: ['{company} 最近是不是沒什麼聲音了？', '還記得 {company} 嗎？我是說真的在問。'] },
    { w: 2, c: (x) => x.stale, t: ['{model} 用起來開始有點舊了，什麼時候出下一代？', '等 {company} 的新模型等到我都會寫 Transformer 了。'] },
    { w: 2, c: (x) => x.open, t: ['{company} 的權重養活了半個開源社群。', '週末又用 {company} 的開源模型微調了一個貓咪翻譯機。'] },
    { w: 2, c: (x) => x.reg >= 40, t: ['監管的信大概又寄到 {company} 了。', '現在發新模型，法務比工程師還忙。'] },
    { w: 2, c: (x) => x.race, t: ['AGI 倒數計時又往前撥了一點。', '大家都在問誰會先到，沒有人問到了之後要做什麼。', '我把這週的進度條截圖留著，以後可以給孫子看。'] },
    { w: 1, c: (x) => x.y >= 2027, t: ['現在連我媽都用 Agent 訂高鐵票了。', '公司開會只剩人類在遲到。', '我的 Agent 幫我回信，對方的 Agent 回我的 Agent，大家都很忙。'] },
    { w: 1, c: (x) => x.y <= 2024, t: ['這週又有新模型了，我連上週的都還沒試。', '今天又有人說提示詞工程師是未來最熱門的工作。', '大模型到底是泡沫還是工業革命？我賭我的年終。'] },
    { w: 1, c: () => true, t: ['模型每週都在進步，我的薪水沒有。', '我的工作還在，但我已經不太確定是誰在做了。', '顯卡漲價的速度，比我學東西的速度快。', '今天請 AI 幫我寫週報，主管說這是我寫過最好的一次。', '誰能告訴我這些排行榜到底在比什麼。', '有沒有人跟我一樣，開了五個模型比價，最後還是自己寫。', '「只是個簡單的問題」——然後額度就沒了。', '半夜三點，模型還在幫我改 bug，我們的關係比我和同事還深。'] },
  ];
  const fill = (t, o) => String(t).replace(/\{(\w+)\}/g, (a, k) => (o[k] == null ? a : o[k]));

  /* ---------- 同步：把新的日誌變成貼文 ---------- */
  function state(G) { const s = G.s; return s.social || (s.social = { posts: [], n: 0, seen: 0, lk: '', cw: s.week, gap: 4 }); }
  function fame(G) { let u = 0; try { u = G.chatUsers(); } catch (e) { u = 0; } return 1 + Math.log10(1 + u) * 1.4; }
  const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
  function counts(kind, f) {
    if (kind === 'own') return { l: Math.round(rnd(60, 320) * f * f), b: Math.round(rnd(5, 40) * f * f) };
    if (kind === 'big') return { l: Math.round(rnd(30, 220) * f), b: Math.round(rnd(3, 30) * f) };
    return { l: Math.round(rnd(1, 40) * f), b: rnd(0, 5) };
  }
  let logWeek = null;  // 正在處理的日誌是哪一週；補舊貼文時時間才會對
  function add(G, st, p, kind) {
    const c = counts(kind || 'net', fame(G)); st.n++;
    const post = Object.assign({ i: st.n, w: logWeek == null ? G.s.week : logWeek, l: c.l, b: c.b }, p); st.posts.push(post); return post;
  }
  // 從最新往回找一則符合條件的貼文（回覆要接在它底下）
  function lastPost(st, fn) { for (let i = st.posts.length - 1; i >= 0; i--) if (fn(st.posts[i])) return st.posts[i]; return null; }
  function replyTo(G, st, parent, text, who) { return add(G, st, { a: who || netKey(), t: text, r: parent ? parent.i : 0, m: parent ? parent.m : 0 }); }
  // 留言要對得上這次改了什麼。日誌只看得出有沒有砍額度，價格和額度的升降要跟調整前的方案比
  function planReplies(was, now, cut) {
    const both = was.mx && now.mx;  // 旗艦版剛推出或剛下架時不算漲跌
    const rose = now.sp > was.sp || (both && now.mp > was.mp);
    const fell = now.sp < was.sp || (both && now.mp < was.mp);
    const more = now.fq > was.fq || now.sq > was.sq || (both && now.mq > was.mq);
    const kind = cut ? (rose ? 'cutRise' : fell ? 'cutFall' : 'cut') : rose ? (more ? 'riseMore' : 'rise') : fell ? 'fall' : more ? 'up' : null;
    if (!kind) return [];  // 只推出或下架旗艦版：推出有自己的貼文，這則不用留言
    const pool = PLAN_REPLY[kind]; const first = pick(pool);
    return cut ? [first, pick(pool.filter((x) => x !== first))] : [first];
  }
  function fromLog(G, D, st, e) {
    const t = String(e.t); const s = G.s; let m; const o = { company: s.company };
    if (e.k === 'buzz') {
      if ((m = /^熱門留言：「(.*)」$/.exec(t))) { replyTo(G, st, lastPost(st, (p) => p.reset), m[1]); return; }
      if ((m = /^\S+ (.+?)：「(.*)」$/.exec(t))) {
        const map = WHO_MAP[m[1]]; const who = map == null ? netKey() : Array.isArray(map) ? pick(map).replace(/^(?!lab$)/, 'n:') : map;
        const parent = e.model != null ? lastPost(st, (p) => p.mid === e.model) : null;
        add(G, st, { a: who, t: m[2], r: parent ? parent.i : 0, m: 1 }, who === 'weekly' || who === 'review' || who === 'lab' ? 'big' : 'net');
      }
      return;
    }
    if (e.k === 'real') {
      if (!e.local && (Math.abs(hash(e.h || t)) % 100) >= 45) return;  // 史實新聞很多，只留一部分，時間軸才不會被洗掉
      add(G, st, { a: 'news', t: t.replace(/^📜\s*/u, ''), h: e.h, news: 1 }, 'big'); return;
    }
    if (e.k === 'news') { add(G, st, { a: 'news', t: t.replace(/^📰\s*/u, ''), news: 1 }, 'big'); return; }
    if (e.k === 'ach') {
      if ((m = /成就解鎖：\S+ (.+)$/.exec(t))) { add(G, st, { a: 'mascot', t: fill(pick(ACH_POST), { name: m[1] }), m: 1 }, 'big'); return; }
      if ((m = /結局：(.+)$/.exec(t))) add(G, st, { a: 'me', t: '謝謝大家一路陪我們走到這裡。' + m[1] + '。', g: ['結局'], m: 1 }, 'own');
      return;
    }
    if (e.k === 'rival') {
      const R = e.rival ? D.RIVALS.find((x) => x.id === e.rival) : null;
      if (e.react && R) { const parent = lastPost(st, (p) => p.mid === e.model); add(G, st, { a: 'r:' + R.id, t: t.replace(/^\S+\s/u, ''), m: 1, q: parent ? parent.i : 0 }, 'big'); return; }
      if ((m = /^\S+ (.+?) 發布 (.+?)(（開源）)?，綜合分 ([\d.]+)(，(.+))?$/.exec(t))) {
        const Q = D.RIVALS.find((x) => x.name === m[1]); if (!Q) return;
        const post = add(G, st, { a: 'r:' + Q.id, t: m[2] + ' 正式發布。' + (m[3] ? '權重同步開源。' : '') + '今天起全面開放。', c: { k: 'model', name: m[2], score: m[4], who: Q.name, open: !!m[3] }, g: [m[2]], m: /超過了你/.test(t) ? 1 : 0 }, 'big');
        if (Math.random() < 0.6) replyTo(G, st, post, fill(pick(RIVAL_REPLY), { rival: Q.name, company: s.company }));
        return;
      }
      if (/AGI 進度/.test(t)) add(G, st, { a: 'weekly', t: t.replace(/^\S+\s/u, ''), g: ['AGI'] }, 'big');
      return;
    }
    if (e.k === 'event') {
      if ((m = /^📌 (.+?) → .*?：(.*)$/.exec(t))) {
        const ev = (root.ME_EVENTS || []).find((x) => x.title === m[1]); const cat = ev ? ev.cat : '';
        const meme = ev && /^meme_/.test(ev.id);
        const post = add(G, st, { a: meme ? 'n:meme_factory' : 'weekly', t: '【' + m[1] + '】' + m[2], g: [m[1]], m: 1 }, 'big');
        if (EVENT_REPLY[cat] && Math.random() < 0.5) replyTo(G, st, post, pick(EVENT_REPLY[cat]));
      } else if (/^(🏁|⏱️)/u.test(t)) add(G, st, { a: 'news', t: t.replace(/^\S+\s/u, ''), g: ['AGI'], news: 1 }, 'big');
      return;
    }
    if (e.k === 'good' || e.k === 'bad' || e.k === 'info') {
      if ((m = /^🚀 (.+?) 正式發布！綜合分 ([\d.]+)，排行榜第 (\d+) 名(（開源）)?/u.exec(t))) {
        const rank = +m[3]; const mdl = s.models.filter((x) => x.rel).slice().reverse().find((x) => x.name === m[1]);
        const post = add(G, st, { a: 'me', t: fill(pick(RELEASE[rank <= 3 ? 'top' : rank <= 8 ? 'mid' : 'low']), { model: m[1], rank }), c: { k: 'model', name: m[1], score: m[2], rank, open: !!m[4] }, mid: mdl ? mdl.id : null, g: [m[1]], m: 1 }, 'own');
        if (Math.random() < 0.5) replyTo(G, st, post, fill(pick(ENG_RELEASE), { model: m[1] }), 'eng');
        return;
      }
      if ((m = /^🕊️ (.+?) 權重已開源/u.exec(t))) { const post = add(G, st, { a: 'me', t: fill(pick(OPEN_POST), { model: m[1] }), g: ['開源'], m: 1 }, 'own'); replyTo(G, st, post, pick(OPEN_REPLY), 'n:open_or_die'); return; }
      if (/^🎁/u.test(t)) {
        const q = /「(.*)」/.exec(t); const post = add(G, st, { a: /^🎁 工程負責人/u.test(t) ? 'eng' : 'me', t: q ? q[1] : t.replace(/^🎁\s*/u, ''), g: ['額度重置'], reset: 1, m: 1 }, 'own'); post.scope = /全部用戶/.test(t) ? 'all' : 'paid'; return;
      }
      if (/^👑/u.test(t)) { const post = add(G, st, { a: 'me', t: t.replace(/^👑\s*/u, ''), g: ['旗艦版'], plan: 1, m: 1 }, 'own'); replyTo(G, st, post, fill(pick(PLAN_REPLY.max), { price: (/\$\d+/.exec(t) || [''])[0] })); return; }
      if (/^📝 調整會員方案/u.test(t)) {
        const cut = /額度縮水/.test(t); const post = add(G, st, { a: 'me', t: t.replace(/^📝 調整會員方案：/u, '會員方案調整：').replace('額度縮水的消息馬上傳開了。', ''), g: ['會員方案'], plan: 1, m: 1 }, 'own');
        const was = st.pl || G.planDefaults(); planReplies(was, G.s.plans || was, cut).forEach((x) => replyTo(G, st, post, x)); return;
      }
      if (/^🔥 推理算力不足/u.test(t)) { if (!lastPost(st, (p) => p.outage && G.s.week - p.w < 8)) { const post = add(G, st, { a: netKey(), t: fill(pick(OUTAGE), o), g: ['伺服器繁忙'], outage: 1, m: 1 }); if (Math.random() < 0.6) replyTo(G, st, post, fill(pick(OUTAGE), o)); } return; }
      if (/^🚨/u.test(t)) { const x = t.replace(/^🚨\s*/u, '').replace(/^(.+?) → .*?：/, '【$1】'); const post = add(G, st, { a: 'weekly', t: x, g: ['安全事故'], m: 1 }, 'big'); replyTo(G, st, post, pick(EVENT_REPLY.safety)); return; }
      if (/^(⛔|⚖️)/u.test(t)) { const post = add(G, st, { a: 'weekly', t: t.replace(/^\S+\s/u, ''), g: ['監管'], m: 1 }, 'big'); replyTo(G, st, post, pick(EVENT_REPLY.regulation)); return; }
      if (/^🔔/u.test(t)) { add(G, st, { a: 'weekly', t: t.replace(/^🔔\s*/u, ''), g: ['IPO'], m: 1 }, 'big'); return; }
      if (/^🔭/u.test(t)) { add(G, st, { a: 'lab', t: t.replace(/^🔭\s*/u, ''), m: 1 }, 'big'); return; }
      if (/^🌟/u.test(t)) { add(G, st, { a: 'weekly', t: t.replace(/^🌟\s*/u, ''), m: 1 }, 'big'); return; }
      if (/^💔/u.test(t)) { add(G, st, { a: 'weekly', t: t.replace(/^💔\s*/u, ''), m: 1 }, 'big'); return; }
      if (/^🏭/u.test(t)) { add(G, st, { a: 'eng', t: t.replace(/^🏭\s*/u, '') + ' 大家可以少排一點隊了。', m: 1 }, 'big'); return; }
      if (/^🎯/u.test(t)) add(G, st, { a: 'news', t: t.replace(/^🎯\s*/u, ''), g: ['AGI'], m: 1, news: 1 }, 'big');
    }
  }
  function hash(t) { let h = 2166136261; for (const ch of String(t)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h | 0; }
  function chatter(G, D, st) {
    const s = G.s; const best = G.bestModel(); const lw = s.lastWeek || {}; const d = root.ME.weekDate(s.week);
    let rv = null; const live = D.RIVALS.filter((R) => G.ym >= R.start); if (live.length) rv = pick(live);
    const x = { served: lw.served == null ? 1 : lw.served, plan: s.plans, resetAgo: s.planResetW == null ? null : s.week - s.planResetW, rank: best ? G.bestRank() : 0, stale: best ? G.modelStale(best) > 0.2 : false, open: s.models.some((m) => m.rel && m.rel.open && !m.rel.retired), reg: s.reg, race: !!s.race, y: d.getUTCFullYear() };
    const ok = CHATTER.filter((c) => { try { return c.c(x); } catch (e) { return false; } });
    let tot = 0; ok.forEach((c) => { tot += c.w; }); let r = Math.random() * tot; let hit = ok[0];
    for (const c of ok) { r -= c.w; if (r <= 0) { hit = c; break; } }
    if (!hit) return;
    const about = /\{company\}|\{model\}/.test(hit.t[0]);
    add(G, st, { a: netKey(), t: fill(pick(hit.t), { company: s.company, model: best ? best.name : s.company, rival: rv ? rv.name : '' }), m: about ? 1 : 0 });
  }
  // 回傳新增了幾則頂層貼文。第一次同步會用最近的日誌補一些內容，舊存檔打開才不會空空的
  function sync(G, D) {
    const first = !G.s.social; const st = state(G); const L = G.s.log || []; const key = (e) => e.w + '|' + e.k + '|' + e.t; const fresh = [];
    for (const e of L) { if (key(e) === st.lk) break; fresh.push(e); if (fresh.length >= (st.lk ? 80 : 40)) break; }
    const before = st.n;
    for (let i = fresh.length - 1; i >= 0; i--) { logWeek = fresh[i].w; fromLog(G, D, st, fresh[i]); }
    logWeek = null;
    if (G.s.plans) st.pl = G.s.plans;  // 引擎調整方案時會換一個新物件，這裡留著的就是調整前的方案
    if (L.length) st.lk = key(L[0]);
    if (G.s.week - st.cw >= st.gap) { st.cw = G.s.week; st.gap = rnd(2, 5); chatter(G, D, st); }
    if (st.posts.length > MAX_POSTS) { const drop = st.posts.length - MAX_POSTS; st.posts.splice(0, drop); }
    if (first) st.seen = st.n;  // 第一次補的內容不算未讀
    return st.n - before;
  }
  // 模型第一次自拍時發一則，圖只記看板娘和等級，不存進存檔
  function selfie(G, o) {
    const st = state(G); const R = (root.ME_TALK ? root.ME_TALK.SELFIE.reply[o.lv] : null) || []; const post = add(G, st, { a: 'me', t: o.name + '：' + o.say, g: ['自拍', o.name], sf: o.id + ':' + o.lv, m: 1 }, 'own');
    const a = pick(R); if (a) replyTo(G, st, post, a); const rest = R.filter((x) => x !== a); if (rest.length && Math.random() < 0.7) replyTo(G, st, post, pick(rest));
    return post;
  }
  function unread(G) { const st = G.s.social; if (!st) return 0; let n = 0; for (let i = st.posts.length - 1; i >= 0; i--) { const p = st.posts[i]; if (p.i <= st.seen) break; if (!p.r) n++; } return n; }

  /* ---------- 畫面 ---------- */
  const I = {
    logo: '<path d="M16 7h.01"/><path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"/><path d="m20 7 2 .5-2 .5"/><path d="M10 18v3"/><path d="M14 17.75V21"/><path d="M7 18a6 6 0 0 0 3.84-10.61"/>',
    reply: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>', repost: '<path d="m2 9 3-3 3 3"/><path d="M13 18H7a2 2 0 0 1-2-2V6"/><path d="m22 15-3 3-3-3"/><path d="M11 6h6a2 2 0 0 1 2 2v10"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    check: '<path fill="currentColor" stroke="none" d="M12 1.5l2.6 2 3.3-.3 1.1 3.1 2.8 1.8-1 3.1 1 3.2-2.8 1.7-1.1 3.2-3.3-.4-2.6 2-2.6-2-3.3.4L5 16.1l-2.8-1.7 1-3.2-1-3.1L5 6.3l1.1-3.1 3.3.3z"/><path d="M8.5 12l2.5 2.5 4.5-5" stroke="#fff" stroke-width="2.2" fill="none"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  };
  const ico = (id, s) => `<svg class="ico" width="${s || 16}" height="${s || 16}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[id]}</svg>`;
  function ago(G, w) { const d = G.s.week - w; return d <= 0 ? '本週' : d < 52 ? d + ' 週前' : Math.floor(d / 52) + ' 年前'; }
  function avatar(a) { return a.img ? `<span class="av"><img src="${a.img}" alt="" width="40" height="40" loading="lazy"></span>` : `<span class="av" style="${a.c ? '--ac:' + a.c : ''}" aria-hidden="true">${a.i}</span>`; }
  function postHTML(G, D, h, st, p, kids, open) {
    const e = h.esc; const a = account(p.a, G, D); const liked = !!p.lk; const shown = open ? kids : kids.slice(0, 2);
    const card = !p.c ? '' : `<button class="ch-card" data-act="tab" data-id="${p.c.who ? 'market' : 'models'}"><b>${e(p.c.name)}</b><span class="num">綜合分 ${e(p.c.score)}</span>${p.c.rank ? `<span class="num">排行榜 #${p.c.rank}</span>` : ''}${p.c.who ? `<span>${e(p.c.who)}</span>` : ''}${p.c.open ? '<span>開源</span>' : ''}</button>`;
    const hist = p.h ? `<button class="ch-card link" data-act="hist" data-id="${e(p.h)}"><span>在史料庫查看這則新聞</span></button>` : '';
    const quote = p.q ? st.posts.find((x) => x.i === p.q) : null;
    const quoteHTML = quote ? `<div class="ch-quote"><b>${e(account(quote.a, G, D).n)}</b><span>${e(quote.t)}</span></div>` : '';
    return `<article class="ch-p${p.r ? ' re' : ''}">${avatar(a)}<div class="bd">
      <div class="who"><b>${e(a.n)}</b>${a.v ? `<span class="v" title="已認證">${ico('check', 15)}</span>` : ''}<span class="h">@${e(a.h)} · ${ago(G, p.w)}</span></div>
      <p>${e(p.t)}</p>${p.sf ? `<figure class="ch-photo" data-zoom="1"><img data-selfie="${e(p.sf)}" alt="${e(a.n)} 的自拍"></figure>` : ''}${card}${hist}${quoteHTML}
      ${(p.g || []).length ? `<div class="tags">${p.g.map((x) => `<span>#${e(x)}</span>`).join('')}</div>` : ''}
      <div class="ac"><button data-act="chirp-thread" data-id="${p.i}" aria-label="回覆 ${kids.length} 則" aria-expanded="${!!open}" ${kids.length > 2 ? '' : 'disabled'}>${ico('reply')}<span class="num">${h.num((p.rc || 0) + kids.length)}</span></button><span class="st">${ico('repost')}<span class="num">${h.num(p.b || 0)}</span></span><button class="${liked ? 'on' : ''}" data-act="chirp-like" data-id="${p.i}" aria-pressed="${liked}" aria-label="按讚">${ico('heart')}<span class="num">${h.num((p.l || 0) + (liked ? 1 : 0))}</span></button></div>
      ${shown.map((k) => postHTML(G, D, h, st, k, [], false)).join('')}${!open && kids.length > 2 ? `<button class="ch-more" data-act="chirp-thread" data-id="${p.i}">顯示另外 ${kids.length - 2} 則回覆</button>` : ''}
    </div></article>`;
  }
  // h：{ esc, num, tab, open: {貼文 id: true}, reset: { wait, noUser } }
  function panel(G, D, h) {
    const st = state(G); const e = h.esc; const kids = {}; const tops = [];
    for (const p of st.posts) { if (p.r) (kids[p.r] = kids[p.r] || []).push(p); else tops.push(p); }
    const keep = tops.filter((p) => (h.tab === 'me' ? p.m : h.tab === 'news' ? p.news : true)).reverse().slice(0, 60);
    const tags = {}; tops.slice(-30).forEach((p) => (p.g || []).forEach((x) => { tags[x] = (tags[x] || 0) + 1; }));
    const trend = Object.keys(tags).sort((a, b) => tags[b] - tags[a]).slice(0, 4);
    const me = account('me', G, D); const R = h.reset;
    const tab = (id, t) => `<button class="${h.tab === id ? 'on' : ''}" data-act="chirp-tab" data-id="${id}" aria-pressed="${h.tab === id}">${t}</button>`;
    return `<header class="ch-hd"><span class="logo">${ico('logo', 18)}</span><b>啾啾</b><small>Chirp</small><span class="spacer"></span><button class="x" data-act="chirp" aria-label="關閉啾啾">${ico('close', 16)}</button></header>
      <div class="ch-tabs" role="group" aria-label="篩選貼文">${tab('all', '全部')}${tab('me', '關於你')}${tab('news', '新聞')}</div>
      <div class="ch-scroll">
        <div class="ch-compose">${avatar(me)}<div class="bd"><span class="small muted">以 ${e(me.n)} 的身分發文</span><div class="row"><button class="btn sm" data-act="pl-reset" data-id="paid" ${R.wait || R.noUser ? 'disabled' : ''}>🎁 重置付費額度</button><button class="btn sm" data-act="pl-reset" data-id="all" ${R.wait || R.noUser ? 'disabled' : ''}>🎁 重置全部額度</button></div>${R.noUser ? '<span class="small muted">對話 App 有用戶之後才能發。</span>' : R.wait ? `<span class="small muted">才剛發過，再等 ${R.wait} 週。</span>` : ''}</div></div>
        ${trend.length ? `<div class="ch-trend"><span class="small muted">熱門話題</span>${trend.map((x) => `<span class="t">#${e(x)}</span>`).join('')}</div>` : ''}
        <div class="ch-list">${keep.map((p) => postHTML(G, D, h, st, p, kids[p.i] || [], !!h.open[p.i])).join('') || '<p class="ch-empty small muted">還沒有貼文。發布模型之後，這裡就會熱鬧起來。</p>'}</div>
      </div>`;
  }

  root.ME_SOCIAL = { sync, selfie, unread, panel, state, account, NET, FIXED, CHATTER };
})(typeof window !== 'undefined' ? window : globalThis);

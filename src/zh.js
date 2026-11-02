/* 《模型帝國》簡體中文：內容原始檔和存檔都維持繁體，文字顯示時才轉換。
   - 畫面文字：MutationObserver 在畫面更新前改寫文字節點和幾個屬性，不會先閃繁體
   - 畫面以外的文字：地球標籤（globe.js）和分享卡的圖片、分享文字（ui.js）要自己呼叫 t()
   - 不轉換 textarea（存檔代碼）和輸入框裡玩家打的字；data-zh="raw" 底下也不轉換（語言切換鈕）
   - 繁體模式不建表也不監看，沒有額外負擔
   字表在 zh_table.js（由 tools/zh_table.js 從 OpenCC 產生），大陸用語寫在下面的 TERMS。檢查殘留用 tools/zh_check.js */
(function (root) {
  'use strict';
  // 台灣和大陸說法不同的詞，寫法是「繁=簡」，空白用 _ 表示，比對時長詞優先。
  // 比對不管詞的邊界，所以很容易誤傷：「業者」會傷到「創業者」，「多工」會傷到「更多工程師」。
  // 新增前先用 node tools/zh_check.js 詞 看遊戲裡的上下文；同一個詞意思不同時，用更長的詞分開（例如「資料」和「查資料」）
  const TERMS = `
    資料=数据 查資料=查资料 補充資料=补充资料 資料夾=文件夹 尚無資料=暂无数据 個人資料=个人信息 資訊=信息 訊息=消息 音訊=音频 品質=质量 語意=语义 取得資料=获取数据 取得方式=获取方式 取得管道=获取渠道 可取得=可获取 好取得=好获取
    程式=编程 程式碼=代码 寫程式=写代码 程式寫得=代码写得 把程式=把代码 跑程式=跑代码 程式庫=代码库 程式倉庫=代码仓库 程式補全=代码补全 程式編輯器=代码编辑器
    惡意程式=恶意程序 程式漏洞=代码漏洞 程式設計=编程 程式設計師=程序员 應用程式=应用程序 課程式=课程式 方程式=方程式 程式代理=编程智能体 演算法=算法 遞迴=递归 蒙地卡羅=蒙特卡洛 最佳化=优化 注意力實作=注意力实现
    軟體=软件 硬體=硬件 韌體=固件 晶片=芯片 伺服器=服务器 記憶體=内存 硬碟=硬盘 顯示卡=显卡 叢集=集群 快取=缓存 電晶體=晶体管 積體電路=集成电路 智慧=智能 即時=实时 擷取=提取 浮水印=水印
    奈米=纳米 矽谷=硅谷 矽=硅 頻寬=带宽 位元=位 低位元=低比特 位元組=字节 平行=并行 平行世界=平行世界 平行宇宙=平行宇宙 分散式=分布式 分散式儲存=分布式存储 作業系統=操作系统 回傳=返回 外掛=插件 系統整合=系统集成 遠端=远程
    螢幕=屏幕 滑鼠=鼠标 筆電=笔记本 筆記型電腦=笔记本电脑 超級電腦=超级计算机 電腦視覺=计算机视觉 電腦介面=计算机接口 電腦上執行=电脑上运行 當機=宕机 效能=性能 運算=计算 尖峰=高峰 損失尖峰=损失尖峰 離峰=低谷 暴衝=飙升
    網路=网络 類神經網路=神经网络 連結=链接 連線=连接 部落格=博客 貼文=帖子 按讚=点赞 比讚=点赞 洗版=刷屏 登入=登录 帳=账 帳篷=帐篷 搜尋=搜索 群組=群 通訊=通信 通訊群組=聊天群 私訊=私信 信箱=邮箱 使用者=用户
    資安=网络安全 資安長=首席安全官 資安業者=网络安全厂商 駭客=黑客 金鑰=密钥 影片=视频 電影片=电影片 視訊=视频 影音=音视频 影像=图像 錄影=录像 貼圖=表情包 迷因=梗 深偽=深度伪造 釣魚信=钓鱼邮件
    社群=社区 在社群=在社交媒体 發社群=发社交媒体 刷爆社群=刷爆社交媒体 全球社群=全球社交媒体 海外社群=海外社交媒体 社群上站不住=社交媒体上站不住 社群媒體=社交媒体
    預設=默认 設定=设置 角色設定=角色设定 一行設定=一行配置 介面=界面 資料源的介面=数据源的接口 儲存=保存 層儲存=层存储 式儲存=式存储 用儲存=用存储 部儲存=部存储 留白=留空
    匯入=导入 匯出=导出 貼上=粘贴 貼上了=贴上了 重設=重置 導覽=引导 選單=菜单 空白鍵=空格键 拖曳=拖动 圖示=图标 視窗=窗口 送出=发送 本機=本地 載入=加载 去背=抠图 倒數計時=倒计时
    檔案=文件 報紙檔案=报纸档案 和文件=和文档 長文件=长文档 與文件辨識=与文档识别 技術文件=技术文档 命令列=命令行 字串=字符串 字元=字符 函式=函数 模組=模块 相容=兼容
    存取=访问 開放存取=开放获取 呼叫=调用 呼叫計算機=调用计算器 辨識=识别 支援=支持 水準=水平 回饋=反馈 協定=协议 專案=项目 高階=高端 低階=低端 回覆=回复 答覆=答复 反覆=反复 機率=概率 查核=核查 限縮=收紧
    排程=队列 已排程=已排队 確定排程=确定排队 排程到=排到 學習率排程=学习率调度 訓練排程=训练排期 的排程已經=的排期已经
    募資=融资 新創=初创 家新創=家初创公司 AI_新創=AI_初创公司 科技新創=科技初创公司 模型新創=模型初创公司 機器人新創=机器人初创公司 套殼新創=套壳初创公司 倒閉新創=倒闭初创公司 等新創=等初创公司 真實新創=真实创业
    重新創=重新创 全新創=全新创 新創作=新创作 新創造=新创造 新創立=新创立 行銷=营销 通路=渠道 招募=招聘 徵才=招聘 履歷=简历 產生器=生成器 創辦人=创始人 共同創辦人=联合创始人 正職=全职 加年終=加年终奖
    財務長=财务总监 法務長=法务总监 執行長=首席执行官 技術長=首席技术官 營運長=首席运营官 數位長=首席数字官 營運=运营 維運=运维 法說會=业绩说明会 頂大實驗室=顶尖大学实验室
    合約=合同 業者=厂商 創業者=创业者 從業者=从业者 貨櫃=集装箱 稽核=审计 標案=招标 得標=中标 下修=下调 上修=上调 選擇權=期权 年增=同比增长 季增=环比增长 投影片=幻灯片 簡報=PPT 八場簡報=八场路演 簡報講到=路演讲到 的簡報能讓=的路演能让
    主管機關=主管部门 中央主管機關=中央主管机关 監管機關=监管机构 計畫=计划 數位=数字 數位發展部=数位发展部 線上安全法=在线安全法 指標案=标志性案件 個資=个人信息 個資保護=个人数据保护 自駕=自动驾驶 自駕實驗室=自动化实验室
    著=着 著名=著名 著作=著作 著稱=著称 著述=著述 著書=著书 著者=著者 顯著=显著 原著=原著 名著=名著 巨著=巨著 專著=专著 論著=论著 編著=编著 譯著=译著 合著=合著 土著=土著 卓著=卓著 昭著=昭著
    瞭解=了解 明瞭=明了 憑藉=凭借 藉口=借口 彷彿=仿佛 傢俱=家具 內建=内置 檢視=查看 聯絡=联系 遮蔽=屏蔽 可互動=可交互 互動式=交互式 優先順序=优先级 寬頻=宽带 連續批次=连续批处理 訊號=信号 裝置=设备 元件=组件 印表機=打印机 檔名=文件名 頁尾=页脚 強制登出=强制退出 暱=昵
    揭弊=揭黑 吹哨者=吹哨人 硬拗=强辩 房仲=房产中介 開出紅盤=开门红 上線時程=上线时间表 聲量=热度 頻道主=博主 調漲=上调 布條=横幅 轉貼=转发 談話節目=访谈节目 語助詞=语气词
    史考特=斯科特 聖地牙哥=圣地亚哥 尼可拉斯=尼古拉斯
    紀錄=记录 破紀錄=破纪录 世界紀錄=世界纪录 公尺紀錄=米纪录 損失紀錄=损失纪录 外洩=泄露
    報導=报道 認列=计提 連署=联署 作夢=做梦 開放取用=开放获取 偵測=检测 保固=保修 行事曆=日程表 整合商=集成商 策略投資=战略投资 了一支專抓=了一个专抓
    提告=起诉 撤告=撤诉 求償=索赔 法拍=司法拍卖 即將上路=即将实施 許可制上路=许可制实施 規定上路=规定实施 辦法上路=办法实施 義務上路=义务生效
    發表=发布 發表會=发布会 發表長文=发表长文 發表聲明=发表声明 發表論文=发表论文 論文發表=论文发表 釋出=发布 透過=通过 藉由=通过 推論=推理 正規賽=常规赛 延長賽=加时赛 評等=评级 標竿=标杆 出包=翻车 支出包=支出包
    兆=万亿 兆元帝國=万亿帝国 兆元晶片=万亿美元芯片 徵兆=征兆 前兆=前兆 預兆=预兆 兆瓦=兆瓦 兆赫=兆赫
    輝達=英伟达 川普=特朗普 普丁=普京 祖克柏=扎克伯格 布萊德彼特=布拉德·皮特 湯姆克魯斯=汤姆·克鲁斯 泰勒絲=泰勒·斯威夫特 義大利=意大利 紐西蘭=新西兰 杜拜=迪拜 沙烏地=沙特 那斯達克=纳斯达克 史丹佛=斯坦福 五角大廈=五角大楼 潘朵拉=潘多拉 昇騰=昇腾
    捷運=地铁 便當=盒饭 宵夜=夜宵 公尺=米 計程車=出租车 外送=外卖 冷氣=空调 煞車=刹车 展場=展会 偏鄉=偏远地区 一支手機=一部手机 客服罐頭=客服话术 在地供應鏈=本土供应链 在地招聘=本地招聘 在地知識=本土知识
    「=“ 」=” 『=‘ 』=’`;
  // 只在簡體模式才向 Google Fonts 要簡體字型；連不上時用系統字型（見 style.css 的 html:lang(zh-Hans)）
  const FONT_SC = 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&family=Noto+Serif+SC:wght@900&display=swap';
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'data-t', 'data-no'];
  const SKIP = 'script, style, textarea, [data-zh="raw"]';
  const doc = root.document;
  const TITLE = doc ? doc.title : '';
  // 切回繁體時要還原，所以記住每個節點的原文
  const rawText = new WeakMap(); const rawAttr = new WeakMap();
  let on = false; let dict = null; let re = null; let mo = null; let fontAdded = false;

  function build() {
    if (re) return;
    const T = root.ME_ZH_TABLE || { chars: '', phrases: '' };
    dict = new Map();
    for (let i = 0; i + 1 < T.chars.length; i += 2) dict.set(T.chars[i], T.chars[i + 1]);
    (T.phrases + ' ' + TERMS).trim().split(/\s+/).forEach((p) => { const k = p.indexOf('='); dict.set(p.slice(0, k).replace(/_/g, ' '), p.slice(k + 1).replace(/_/g, ' ')); });
    const keys = [...dict.keys()];
    const longer = keys.filter((k) => k.length > 1).sort((a, b) => b.length - a.length);
    re = new RegExp(longer.concat('[' + keys.filter((k) => k.length === 1).join('') + ']').join('|'), 'g');
  }
  function conv(s) { build(); return String(s).replace(re, (m) => dict.get(m)); }
  function t(s) { return on ? conv(s) : s; }

  function fixText(n) { const v = n.data; const o = conv(v); if (o !== v) { rawText.set(n, v); n.data = o; } }
  function fixAttrs(el) {
    if (!el.attributes.length) return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a); if (!v) continue;
      const o = conv(v); if (o === v) continue;
      let m = rawAttr.get(el); if (!m) { m = {}; rawAttr.set(el, m); }
      m[a] = v; el.setAttribute(a, o);
    }
  }
  function walker(n) { return doc.createTreeWalker(n, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: (x) => (x.nodeType === 1 && x.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) }); }
  function fixTree(n) {
    if (n.nodeType === 3) { if (!n.parentElement || !n.parentElement.closest(SKIP)) fixText(n); return; }
    if (n.nodeType !== 1 || n.closest(SKIP)) return;
    fixAttrs(n);
    const w = walker(n);
    for (let x = w.nextNode(); x; x = w.nextNode()) { if (x.nodeType === 3) fixText(x); else fixAttrs(x); }
  }
  function restore() {
    const w = walker(doc.body);
    for (let x = w.nextNode(); x; x = w.nextNode()) {
      if (x.nodeType === 3) { const r = rawText.get(x); if (r !== undefined && conv(r) === x.data) x.data = r; continue; }
      const m = rawAttr.get(x); if (m) for (const a in m) { if (conv(m[a]) === x.getAttribute(a)) x.setAttribute(a, m[a]); }
    }
  }
  function onMutate(recs) {
    for (const r of recs) {
      if (r.type === 'characterData') fixTree(r.target);
      else if (r.type === 'attributes') { if (!r.target.closest(SKIP)) fixAttrs(r.target); }
      else r.addedNodes.forEach(fixTree);
    }
    mo.takeRecords();  // 剩下的都是上面自己改出來的，不用再處理
  }
  function addFont() {
    if (fontAdded) return; fontAdded = true;
    const l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = FONT_SC; l.media = 'print'; l.onload = () => { l.media = 'all'; };
    doc.head.appendChild(l);
  }
  // 'tc' 或 'sc'。還沒進遊戲畫面時也可以呼叫，之後加進來的節點會自動轉換
  function set(lang) {
    const sc = lang === 'sc';
    doc.documentElement.lang = sc ? 'zh-Hans' : 'zh-Hant';
    if (sc === on) return;
    on = sc; doc.title = sc ? conv(TITLE) : TITLE;
    if (sc) {
      addFont(); fixTree(doc.body);
      if (!mo) mo = new MutationObserver(onMutate);
      mo.observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    } else { mo.disconnect(); restore(); }
  }
  // 玩家沒選過時看瀏覽器語言：第一個中文是 zh-CN、zh-SG、zh-Hans 或只寫 zh 就用簡體，其他都用繁體
  function detect() {
    const nav = root.navigator || {};
    const zh = (nav.languages && nav.languages.length ? nav.languages : [nav.language]).find((l) => /^zh\b/i.test(l || ''));
    if (!zh) return 'tc';
    return /hans/i.test(zh) || !/-(hant|tw|hk|mo)\b/i.test(zh) ? 'sc' : 'tc';
  }
  root.ME_ZH = { t, conv, set, detect, lang: () => (on ? 'sc' : 'tc'), dict: () => { build(); return dict; } };
})(typeof window !== 'undefined' ? window : globalThis);

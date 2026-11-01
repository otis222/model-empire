/* 《模型帝國》圖示：科技與路線的線條圖示、GPU 與機房的物件圖示。全部是 SVG 字串，不依賴 DOM，也不用外部圖檔
   線條圖示的格式：24×24，用 | 分隔的圖形。M 開頭是路徑，c x y r 是圓，r x y w h rx 是圓角矩形；
   前綴 * 是加上淡淡的填色，# 是實心（小圓點用）。

   這裡和 ui.js 的線條圖示有一部分的形狀來自或參考 Lucide（https://lucide.dev）：
   Copyright (c) 2026 Lucide Icons and Contributors
   Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee
   is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
   其中部分源自 Feather（Copyright (c) Cole Bemis，MIT 授權）。免責條款和全文見 THIRD_PARTY_NOTICES.md。 */
(function (root) {
  'use strict';
  const SHIELD = 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z';
  const BRAIN = 'M11.5 4.5a2.5 2.5 0 0 0-4.8-.9A3 3 0 0 0 4 7c0 .6.2 1.2.5 1.7A3 3 0 0 0 4 14a3 3 0 0 0 2.4 3 3 3 0 0 0 5.1 1.6z|M12.5 4.5a2.5 2.5 0 0 1 4.8-.9A3 3 0 0 1 20 7c0 .6-.2 1.2-.5 1.7A3 3 0 0 1 20 14a3 3 0 0 1-2.4 3 3 3 0 0 1-5.1 1.6z';
  const ROBOT = 'r5 9 14 11 2.5|M12 9V5|c12 3.5 1.5|#c9 14 1.2|#c15 14 1.2|M9.5 17.5h5|M2.5 13v3|M21.5 13v3';
  const CODE = 'M8 7l-5 5 5 5|M16 7l5 5-5 5|M14 4l-4 16';
  const FILM = 'r3 3 18 18 2|M7.5 3v18|M16.5 3v18|M3 8h4.5|M3 16h4.5|M16.5 8H21|M16.5 16H21|M3 12h18';
  const CHAT2 = 'M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z|M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1';
  const BOOK = 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z|M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5|M8 7h8|M8 11h5';
  const ARM = 'r3.5 19 9 2.5 1|M8 19v-3l-3-5 6-5.5 6 4|M17 9.5l3.5-2|M17 9.5l3.5 3|*c5 11 1.5|*c11 5.5 1.5';
  const GLYPH = {
    // 架構
    t_flash: '*M13 2 4 14h7l-1 8 9-12h-7z',
    t_gqa: 'c5 5.5 2|c5 12 2|c5 18.5 2|*r14 7 7 10 1.5|M7 6l7 3.5|M7 12h7|M7 18l7-3.5',
    t_rope: 'M20.5 12a8.5 8.5 0 1 1-2.6-6.1|M21 3v5h-5|*c12 12 2.5',
    t_rwkv: 'r2 11 5 6 1|*r9.5 11 5 6 1|r17 11 5 6 1|M7 14h2.5|M14.5 14H17|M19.5 11V7H4.5v4',
    t_retnet: 'M3 21h18|*r4 6 3.5 15 .8|r10.2 10 3.5 11 .8|r16.5 14 3.5 7 .8',
    t_mamba: 'M3 17c3 0 3-6 6-6s3 6 6 6 3-8 5.5-8|#c20.5 9 1.6',
    t_moe: 'c5 12 2.5|*c18.5 5 2.5|c18.5 12 2.5|c18.5 19 2.5|M7.5 12H16|M7.2 10.7l9-4.5|M7.2 13.3l9 4.5',
    t_finemoe: 'r3.5 3.5 4.5 4.5 1|*r9.75 3.5 4.5 4.5 1|r16 3.5 4.5 4.5 1|*r3.5 9.75 4.5 4.5 1|r9.75 9.75 4.5 4.5 1|r16 9.75 4.5 4.5 1|r3.5 16 4.5 4.5 1|r9.75 16 4.5 4.5 1|*r16 16 4.5 4.5 1',
    t_mla: '*M3 4h18l-7 8.5V19l-4 2v-8.5z',
    t_hybrid: 'c12 12 9|*M12 3a9 9 0 0 1 0 18z|M3 12h3.5l1.5-3 2 6 1.5-3',
    t_sparse: '#c5 6 1.4|#c12 4 1.4|#c19 7 1.4|#c7 14 1.4|#c16 12 1.4|#c11 20 1.4|#c20 18 1.4|M5 6l11 6|M16 12l4 6',
    t_mctx: 'M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4|M19 17V5a2 2 0 0 0-2-2H4|M15 8h-5|M15 12h-5',
    t_titans: 'r4 7 16 10 2|M8 17v3|M12 17v3|M16 17v3|M8 7V4|M12 7V4|M16 7V4|M7 12h2.5l1.5-2.5 2.5 5 1.5-2.5H17',
    t_mercury: '#c4.5 7 1.1|#c8 5 1.1|#c4 12 1.1|#c8 11 1.1|#c5 17 1.1|#c8.5 17.5 1.1|M13 7h8|M13 12h8|M13 17h8',
    t_hrm: '*r9 3 6 5 1|r3 16 6 5 1|r15 16 6 5 1|M12 8v4|M6 16v-4h12v4',
    t_rlm: 'r3 3 18 18 2.5|r7 7 10 10 2|*r10.5 10.5 3 3 .7',
    // 訓練
    t_3d: '*M12 12 3 7l9-5 9 5z|M3 7v10l9 5 9-5V7|M12 12v10',
    t_zero: 'r3 7 18 9 1.5|*r3 7 4.5 9 1|M7.5 7v9|M12 7v9|M16.5 7v9|M6 16v3|M12 16v3|M18 16v3',
    t_chin: 'M12 3v18|M8 21h8|M5 6h14|M5 6l-3 7a3.2 3.2 0 0 0 6 0z|*M19 6l-3 7a3.2 3.2 0 0 0 6 0z',
    t_dedup: 'r9 9 12 12 2|M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1|M12 15h6',
    t_curr: '*M3 21v-5h5v-5h5V6h5V3h3v18z',
    t_mtp: 'M3 7h11|M11 4l3 3-3 3|M3 12h15|M15 9l3 3-3 3|M3 17h11|M11 14l3 3-3 3',
    t_resil: 'r3 3 18 7 1.5|r3 14 18 7 1.5|#c7 6.5 1|#c7 17.5 1|M12 6.5h5|M12 17.5l1.8 1.8 3.7-3.6',
    t_fp8: 'c12 8 4|c12 16.5 4.5|M3 4v16|M21 4v16',
    t_synth: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|*M12 11l1 3 3 1-3 1-1 3-1-3-3-1 3-1z',
    t_distill: 'r2 5 10 14 2|M13.5 12h3|M15 10l2 2-2 2|*r18 8.5 4.5 7 1',
    t_muon: 'M3 4c1.5 9 4.5 15 9 15s7.5-6 9-15|*c12 19 2|M6.5 9l2 .5|M17.5 9l-2 .5',
    t_diloco: 'r2 4 7 16 1.5|r15 4 7 16 1.5|M4.5 8h2|M4.5 12h2|M17.5 8h2|M17.5 12h2|M10.5 12h.6|M13 12h.6',
    t_megacluster: 'r3 3 18 18 2|*r9 9 6 6 0|M3 9h18|M3 15h18|M9 3v18|M15 3v18',
    t_intellect: 'c12 12 9|M3 12h18|M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9s1.3-6.4 3.8-9z',
    t_airesearch: ROBOT,
    t_contlearn: 'M6.5 8a4 4 0 1 0 0 8c4 0 7-8 11-8a4 4 0 1 1 0 8c-4 0-7-8-11-8z',
    t_selfimprove: 'M20.5 12a8.5 8.5 0 1 1-2.6-6.1|M21 3v5h-5|M12 16.5V9|M9 12l3-3 3 3',
    t_ctrltakeoff: 'M12 2c3.2 2.4 5 6.2 5 10.5L15 17H9l-2-4.5C7 8.2 8.8 4.4 12 2z|*c12 9.5 1.8|M9 17l-3 3.5h3.5|M15 17l3 3.5h-3.5|M12 19v3',
    t_agi_core: '*M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z|c12 12 1.6',
    // 後訓練
    t_rlhf: 'M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z|M8 10l3 3 5-5',
    t_selfinstr: 'M4 6h12|M4 11h12|M4 16h7|M18 14v7|M14.5 17.5h7',
    t_dpo: 'r3 5 7.5 14 1.5|*r13.5 5 7.5 14 1.5|M15.5 12l1.5 1.5 2.5-3',
    t_kto: 'c7 12 5|*c17 12 5|M5 12h4|M7 10v4|M15 12h4',
    t_orpo: 'M4 4c0 8 8 6 8 13v4|M20 4c0 8-8 6-8 13|M9 18l3 3 3-3',
    t_cai: 'M4 5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2z|M4 20a2 2 0 0 0 2 2h14v-4|M9 10l2 2 4-4',
    t_rbr: 'M10 6h11|M10 12h11|M10 18h11|M3.5 6l1.2 1.2L7 5|M3.5 12l1.2 1.2L7 11|M3.5 18l1.2 1.2L7 17',
    t_tools: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.7 2.7-2.4-.6-.6-2.4z',
    t_cotprompt: 'c5 18.5 2.5|c12 12 2.5|*c19 5.5 2.5|M7 16.7l3-2.9|M14 10.2l3-2.9',
    t_verify: 'c5 5 2|c5 12 2|*c5 19 2|M5 7v3|M5 14v3|M10 5h10|M10 12h10|M10 19h7',
    t_cot: BRAIN,
    t_ttc: 'c12 14 8|M12 10v4l2.5 2|M9.5 2.5h5|M12 2.5V6|M19 6l1.5 1.5',
    t_tot: 'c12 4.5 2|c5.5 12 2|c18.5 12 2|c12 12 2|*c5.5 19.5 2|c12 19.5 2|M11 6.2l-4.5 4.1|M13 6.2l4.5 4.1|M12 6.5V10|M5.5 14v3.5|M12 14v3.5',
    t_tslm: 'c12 4 2|c6 12 2|*c18 12 2|c3 20 1.5|c9 20 1.5|*c15 20 1.5|c21 20 1.5|M10.6 5.4l-3.2 5.2|M13.4 5.4l3.2 5.2|M5 13.6l-1.5 5|M7 13.6l1.5 5|M17 13.6l-1.5 5|M19 13.6l1.5 5',
    t_prover: 'M6 4v16|M6 12h11|M13 18l2.5 2.5L20 16',
    t_agentrl: 'c12 12 9|c12 12 5|#c12 12 1.8|M12 12l8-8|M17 3.5h3.5V7',
    t_longrl: 'M5 21V4|*M5 4h13l-2.5 4 2.5 4H5|M2 21h8',
    // 推理部署
    t_quant: 'M4 14h6v6|M20 10h-6V4|M14 10l7-7|M3 21l7-7',
    t_paged: 'r3 3 8 8 1.5|r13 3 8 8 1.5|*r3 13 8 8 1.5|r13 13 8 8 1.5',
    t_spec: 'M3 12h2|M8 12h2|M13 12h2|M18 7l4 5-4 5',
    t_sglang: 'M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1|M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1|#c12 12 1.4',
    t_mooncake: '*M20.5 14A9 9 0 1 1 10 3.5a7 7 0 0 0 10.5 10.5z|#c16 6 1|#c20 9 .8',
    t_route: 'M6 3v12|c6 18 3|c18 6 3|M18 9a9 9 0 0 1-9 9',
    t_liquid: '*M12 2.7c3.5 3.7 7 7.3 7 11.3a7 7 0 0 1-14 0c0-4 3.5-7.6 7-11.3z|M8.5 14.5c1.2 1 2.4 1 3.5 0s2.3-1 3.5 0',
    t_asic: 'r5 5 14 14 2|*r9 9 6 6 1|M9 2v3|M15 2v3|M9 19v3|M15 19v3|M2 9h3|M2 15h3|M19 9h3|M19 15h3',
    t_lease: 'M17.5 19H8a6 6 0 1 1 1.4-11.8A5.5 5.5 0 0 1 19.5 9a5 5 0 0 1-2 10z|M9.5 13l2 2 3.5-3.5',
    t_aichip: 'r3 9 12 12 2|*r6.5 12.5 5 5 .8|M7 6.5V9|M11 6.5V9|M7 21v2|M11 21v2|M.5 13H3|M.5 17H3|M15 13h2|M15 17h2|*M19 1.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z',
    t_energy: '*M3 21V11l6 4v-4l6 4V5h6v16z|M7 18h1.5|M12 18h1.5|M17 18h1.5',
    // 安全
    t_redteam: 'M14.5 17.5 3 6V3h3l11.5 11.5|M13 19l6-6|M16 16l4 4|M19 21l2-2|M14.5 6.5 18 3h3v3l-3.5 3.5|M5 14l4 4|M7 17l-3 3|M3 19l2 2',
    t_advtrain: SHIELD + '|M13 7l-3.5 5.5h4L10 17',
    t_guard: SHIELD + '|M8 10h8|M9.5 13.5h5',
    t_water: 'M5 22h14|M19 14H5a2 2 0 0 0-2 2v2h18v-2a2 2 0 0 0-2-2z|M15 14v-3.5a3 3 0 1 0-6 0V14',
    t_comply: 'c12 9 6.5|M8.2 14.5 7 22l5-3 5 3-1.2-7.5|M9.5 9l1.8 1.8 3.2-3.2',
    t_xrisk: '*M12 3 2 20.5h20z|M12 9.5v5|#c12 17.5 1',
    t_rsp: 'M3.5 18a9.5 9.5 0 1 1 17 0|M12 15l4-5.5|c12 15.5 1.6|M7 19.5h10',
    t_interp: 'c10.5 10.5 7.5|M21 21l-5-5|*c10.5 10.5 2.2|M10.5 5.8v2.5|M10.5 12.7v2.5|M5.8 10.5h2.5|M12.7 10.5h2.5',
    t_debate: CHAT2,
    t_breakers: 'M2 15h5|M17 15h5|c8.5 15 1.5|c15.5 15 1.5|M9.5 13.8l6-7.3',
    t_aictrl: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z|*c12 12 3',
    t_delib: 'M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5z|M8.5 11.5l2.5 2.5 4.5-4.5',
    t_constclass: 'M3 6h18|M6.5 12h11|M10 18h4',
    t_cotmon: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7|M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
    t_faking: '*M3 5c6-2 12-2 18 0v7c0 5-4 9-9 9s-9-4-9-9z|M7.5 10c1-.8 2-.8 3 0|M13.5 10c1-.8 2-.8 3 0|M9 15c2 1.5 4 1.5 6 0',
    t_oversight: SHIELD + '|M7.5 11s1.7-2.8 4.5-2.8 4.5 2.8 4.5 2.8-1.7 2.8-4.5 2.8-4.5-2.8-4.5-2.8z|#c12 11 1',
    // 多模態
    t_clip: 'r2 5 10 14 1.5|c7 10 1.4|M2 16l3.5-3 3 2.5 3.5-3|M15 8h7|M15 12h7|M15 16h5',
    t_vision: 'r3 3 18 18 2.5|*c8.5 8.5 1.7|M21 15l-5-5L5 21',
    t_imagegen: 'M3 21 14 10|M12.5 8.5l3 3|*M18 2l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z|M7 4.5v3|M5.5 6h3|M19.5 14.5v3|M18 16h3',
    t_dit: 'r3 3 18 18 2.5|M12 3v18|#c6 8 .9|#c9 12 .9|#c6 16 .9|#c9 6.5 .9|M12 16l3-4 2.5 2.5L21 11',
    t_voice: 'r9 2 6 12 3|M5 10.5v1.5a7 7 0 0 0 14 0v-1.5|M12 19v3',
    t_video: 'r2 6 14 12 2|*M16 10.5l6-3.5v10l-6-3.5z',
    t_moviegen: FILM,
    t_genie: 'M6 8h12a4 4 0 0 1 4 4v3a3 3 0 0 1-5.4 1.8L15 15H9l-1.6 1.8A3 3 0 0 1 2 15v-3a4 4 0 0 1 4-4z|M6.5 11.5h3|M8 10v3|#c15.5 11 1|#c18 13 1',
    t_vla: ARM,
    t_e2e: 'c12 5 2.8|M12 8v7|M5 11.5c2.5-1.2 4.5-1.8 7-1.8s4.5.6 7 1.8|M12 15l-3 7|M12 15l3 7',
    t_jepa: 'c12 12 9.5|*M12 6.5l4.8 2.7v5.6L12 17.5l-4.8-2.7V9.2z|M7.2 9.2l4.8 2.8 4.8-2.8|M12 12v5.5',
    // 資料
    t_stack: CODE,
    t_laion: 'r7 3 14 14 2|M3 7.5V19a2 2 0 0 0 2 2h11.5|*c11.5 7.5 1.5|M21 12.5 17.5 9 10 17',
    t_rag: 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h4|M13 2l6 6v2|M13 2v6h6|c15.5 16 4|M18.5 19l3 3',
    t_selfrag: 'c11 11 7.5|M21 21l-4.7-4.7|M8 11a3 3 0 0 1 5.2-2l.8.8|M14 7.5v2.3h-2.3|M14 11a3 3 0 0 1-5.2 2l-.8-.8',
    t_orca: '*M2 12c3-5 9-7 14-5l6-3-2 8 2 8-6-3c-5 2-11 0-14-5z|#c7 10.5 1',
    t_synthscale: 'M12 3 3 8l9 5 9-5z|M3 13l9 5 3.5-2|M3 17.5l9 4.5 2-1|M19 14v7|M15.5 17.5h7',
    t_licenseall: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M8.5 14.5l2.5 2.5 4.5-4.5',
    t_flywheel: 'c12 12 9.5|*c12 12 3|M12 2.5V9|M12 15v6.5|M2.5 12H9|M15 12h6.5',
    t_fairuse: 'M14 13l-7.5 7.5a2 2 0 0 1-3-3L11 10|M16 16l6-6|M8 8l6-6|M9 7l8 8|M21 11l-8-8',
    t_unlearn: 'M7 21h13|M5.4 13.6l8.2-8.2a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L12 19l-3 2-3.6-3.6a2.7 2.7 0 0 1 0-3.8z|M9 10l6 6',
    // Agent
    t_react: 'M3 12a9 9 0 0 1 15-6.7L21 8|M21 3v5h-5|M21 12a9 9 0 0 1-15 6.7L3 16|M3 21v-5h5',
    t_reflex: 'M3 12a9 9 0 1 0 3-6.7L3 8|M3 3v5h5|M12 7.5V12l3 2',
    t_swebench: 'r2 4 20 16 2|M6 9l3.5 3L6 15|M12 15h6',
    t_mcp: 'M9 2v6|M15 2v6|*M6 8h12v4a6 6 0 0 1-12 0z|M12 18v4',
    t_osworld: 'r2 3 20 14 2|M8 21h8|M12 17v4|*M9.5 7l6 3-2.5 1-1 2.5z',
    t_memgpt: BOOK,
    t_autogen: '*M12 2l4 2.3v4.5L12 11 8 8.8V4.3z|M7 12l4 2.3v4.5L7 21l-4-2.2v-4.5z|M17 12l4 2.3v4.5L17 21l-4-2.2v-4.5z',
    t_copilot: 'M8 9l-5 4 5 4|M13 18h8|*M17 2.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L13.5 6 16 5z',
    t_alphaevolve: 'M7 3c0 7 10 11 10 18|M17 3c0 7-10 11-10 18|M8.5 6.5h7|M9 17.5h6|M10 12h4',
    t_lab: 'M9 3h6|M10 3v6.5L4.6 19a1.5 1.5 0 0 0 1.3 2.2h12.2a1.5 1.5 0 0 0 1.3-2.2L14 9.5V3|*M7.2 15h9.6l2.2 4.5a.8.8 0 0 1-.7 1.2H5.7a.8.8 0 0 1-.7-1.2z',
    // 產品策略
    t_resmgmt: 'c5 6 2.5|c5 18 2.5|*c19 12 2.5|M7.5 6H10a4 4 0 0 1 4 4v2h2.5|M7.5 18H10a4 4 0 0 0 4-4v-2',
    t_lora: 'M4 21v-7|M4 10V3|M12 21v-9|M12 8V3|M20 21v-5|M20 12V3|M1.5 14h5|M9.5 8h5|M17.5 16h5',
    t_starcoder: 'r3 4 18 16 2|M3 9h18|M9 12.5 6.5 15 9 17.5|M15 12.5l2.5 2.5-2.5 2.5|#c6 6.5 .8|#c9 6.5 .8',
    t_superapp: 'r6 2 12 20 2.5|M11 18.5h2|M9 7h6|M9 10.5h6|M9 14h3',
    t_entsuite: 'r2 7 20 14 2|M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2|M2 13h20|M12 11.5v3',
    t_devplat: 'c12 5.5 3|c5.5 18 3|c18.5 18 3|M10.6 8.2l-3.7 7.1|M13.4 8.2l3.7 7.1|M8.5 18h7',
    t_openeco: 'r4 11 16 10 2|M8 11V7a4 4 0 0 1 7.5-2|M12 15v2',
    t_weightsec: 'r4 11 16 10 2|M8 11V7a4 4 0 0 1 8 0v4|#c12 16 1.3',
  };
  // 研究路線：圖示與代表色
  const LINE = {
    scale: { c: '#3f7de0', g: 'r4 3 16 18 2|M4 9h16|M4 15h16|#c8 6 1|#c8 12 1|#c8 18 1' },
    effi: { c: '#0f9d8a', g: 'c12 12 3|M12 2v3|M12 19v3|M2 12h3|M19 12h3|M4.9 4.9 7 7|M17 17l2.1 2.1|M4.9 19.1 7 17|M17 7l2.1-2.1' },
    reason: { c: '#d98a00', g: BRAIN },
    agent: { c: '#e0563f', g: ROBOT },
    media: { c: '#8a63e6', g: GLYPH.t_vision },
    safe: { c: '#2f9e5b', g: SHIELD + '|M8.5 12l2.5 2.5 4.5-5' },
    data: { c: '#1c8fb8', g: 'M3 5a9 3 0 1 0 18 0a9 3 0 1 0-18 0|M3 5v14a9 3 0 0 0 18 0V5|M3 12a9 3 0 0 0 18 0' },
    serve: { c: '#c76a2b', g: GLYPH.t_entsuite },
  };
  // 模型架構與資料授權
  const ARCH = { dense: 'M12 2 2 7l10 5 10-5z|M2 12l10 5 10-5|M2 17l10 5 10-5', moe: GLYPH.t_moe, moe_mla: GLYPH.t_mla, hybrid: GLYPH.t_hybrid, sparse: GLYPH.t_sparse };
  const DEAL = {
    news: 'M4 5h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z|M17 9h3v10a1.5 1.5 0 0 1-3 0|M7.5 9h6|M7.5 13h6|M7.5 17h4',
    books: BOOK, papers: 'M12 4 1.5 9.5 12 15l10.5-5.5z|M6 12v5c3 2.5 9 2.5 12 0v-5', codehost: CODE, media: FILM, forum: CHAT2, robotics: ARM,
  };

  function inner(src) {
    return src.split('|').map((tok) => {
      let attr = '';
      if (tok[0] === '*') { attr = ' fill="currentColor" fill-opacity=".22"'; tok = tok.slice(1); }
      else if (tok[0] === '#') { attr = ' fill="currentColor" stroke="none"'; tok = tok.slice(1); }
      if (tok[0] === 'c') { const p = tok.slice(1).split(' '); return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + p[2] + '"' + attr + '/>'; }
      if (tok[0] === 'r') { const p = tok.slice(1).split(' '); return '<rect x="' + p[0] + '" y="' + p[1] + '" width="' + p[2] + '" height="' + p[3] + '"' + (p[4] ? ' rx="' + p[4] + '"' : '') + attr + '/>'; }
      return '<path d="' + tok + '"' + attr + '/>';
    }).join('');
  }
  function glyph(src, size) {
    if (!src) return '';
    const s = size || 20;
    return '<svg class="gly" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner(src) + '</svg>';
  }

  /* ---------- GPU：封裝俯視圖 ----------
     看得出世代差異的是晶粒數和 HBM 數：A100／H100／H200 是單晶粒 6 組 HBM，B200／B300／Rubin 是雙晶粒 8 組，Rubin Ultra 是四晶粒 16 組。
     更後面的世代和替代加速卡的規格是遊戲設定。plus 表示同代的加強版（HBM 較高），stack 表示 3D 堆疊，cut 是出口版。 */
  const GEN = { ampere: ['#a3b96f', '#73893f'], hopper: ['#8fd14f', '#5c9e28'], blackwell: ['#57c7f2', '#2a8fc2'], rubin: ['#f0708f', '#bd3c60'], feynman: ['#f7bd4f', '#c68510'], next: ['#b79bff', '#7a56dc'], alt: ['#3fd0b4', '#14937a'] };
  const CHIP = {
    a100: { g: 'ampere', d: 1, h: 6 }, h100: { g: 'hopper', d: 1, h: 6 }, h800: { g: 'hopper', d: 1, h: 6, cut: 1 }, h200: { g: 'hopper', d: 1, h: 6, plus: 1 },
    b200: { g: 'blackwell', d: 2, h: 8 }, b300: { g: 'blackwell', d: 2, h: 8, plus: 1 },
    r100: { g: 'rubin', d: 2, h: 8 }, r300: { g: 'rubin', d: 4, h: 16 },
    f100: { g: 'feynman', d: 4, h: 16, stack: 1 }, f300: { g: 'feynman', d: 4, h: 16, stack: 1, plus: 1 },
    x100: { g: 'next', d: 6, h: 16, stack: 1 }, x300: { g: 'next', d: 6, h: 16, stack: 1, plus: 1 },
    c1: { g: 'alt', d: 1, h: 4 }, c2: { g: 'alt', d: 1, h: 6 }, c3: { g: 'alt', d: 2, h: 6 }, c4: { g: 'alt', d: 2, h: 8 }, c5: { g: 'alt', d: 4, h: 12 }, c6: { g: 'alt', d: 4, h: 16 },
  };
  const R = (x, y, w, h, rx, fill, extra) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"' + (rx ? ' rx="' + rx + '"' : '') + ' fill="' + fill + '"' + (extra || '') + '/>';
  function chipBody(c) {
    const col = GEN[c.g] || GEN.hopper; const alt = c.g === 'alt';
    let out = R(1, 4, 62, 39, 5, '#141922') + R(1, 1, 62, 39, 5, alt ? '#27343a' : '#2a323e') + '<path d="M6 2.2h52" stroke="#5a6779" stroke-width="1" stroke-linecap="round"/>' + R(5, 5, 54, 31, 2.5, alt ? '#35484c' : '#3a4452');
    // HBM：兩側各一半，太多時排成兩欄
    const side = c.h / 2; const cols = side > 4 ? 2 : 1; const perCol = Math.ceil(side / cols); const top = 8; const span = 25; const gap = perCol > 3 ? 1.4 : 2;
    const hh = (span - gap * (perCol - 1)) / perCol; const hw = cols > 1 ? 5.2 : 9;
    const stack = (x) => { for (let i = 0; i < perCol; i++) { const y = top + i * (hh + gap); out += R(x, y, hw, hh, 1, c.plus ? '#dfe5ec' : '#aeb9c6') + R(x, y, hw, Math.max(1.2, hh * 0.32), 1, c.plus ? '#ffffff' : '#d3dae3'); } };
    if (cols > 1) { stack(7); stack(13); stack(45.8); stack(51.8); } else { stack(8); stack(47); }
    // 晶粒
    const W = cols > 1 ? 22 : 26; const X0 = (64 - W) / 2; const Y0 = 8; const H0 = 25; const rows = c.d >= 4 ? 2 : 1; const per = c.d / rows; const dg = 1.2;
    const dw = (W - dg * (per - 1)) / per; const dh = (H0 - dg * (rows - 1)) / rows;
    for (let j = 0; j < rows; j++) for (let i = 0; i < per; i++) {
      const x = X0 + i * (dw + dg); const y = Y0 + j * (dh + dg);
      out += R(x, y + 0.9, dw, dh, alt ? 2 : 1, col[1]) + R(x, y, dw, dh - 0.4, alt ? 2 : 1, col[0]);
      if (c.stack) { const sw = (dw - 3) / 2; const sh = (dh - 3) / 2; for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) out += R(x + 1 + a * (sw + 1), y + 1 + b * (sh + 1), sw, sh, 0.5, '#ffffff', ' fill-opacity=".32"'); }
      else out += R(x + 1.6, y + 1.6, Math.max(1, dw - 3.2), Math.max(1, dh * 0.34), 0.6, '#ffffff', ' fill-opacity=".28"');
    }
    if (c.cut) out += '<path d="M46 1h12a5 5 0 0 1 5 5v12z" fill="#f2a93b"/>'; // 出口版：角落的琥珀色標記
    return out;
  }

  /* ---------- 機房：六個等級的小建築 ---------- */
  const DARK = '#2f3947'; const MID = '#465366'; const WALL = '#e6ebf2'; const WALL2 = '#cdd6e2'; const ROOF = '#9aa7b8'; const LED = '#4fd1e8'; const ACC = '#3d5fd9'; const GROUND = '#b8c2cf';
  const dot = (x, y, r, f) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + f + '"/>';
  function rack(x, y, w, h) {
    let o = R(x, y, w, h, 1, DARK); const u = Math.floor((h - 2) / 4);
    for (let i = 0; i < u; i++) o += R(x + 1, y + 1.5 + i * 4, w - 2, 2.6, 0.5, MID) + dot(x + w - 2, y + 2.8 + i * 4, 0.6, LED);
    return o;
  }
  const DC = [
    () => R(8, 40, 48, 2, 1, GROUND) + rack(21, 5, 22, 35),
    () => R(3, 40, 58, 2, 1, GROUND) + R(6, 10, 52, 30, 2, WALL) + R(4, 7, 56, 4, 1, ROOF) + rack(11, 16, 8, 24) + rack(21, 16, 8, 24) + rack(31, 16, 8, 24) + R(45, 22, 9, 18, 1, WALL2) + dot(47.2, 31, 0.8, DARK),
    () => R(3, 5, 58, 4, 1, ROOF) + R(4, 9, 56, 28, 0, WALL) + R(3, 37, 58, 4, 1, ROOF) + [8, 16, 24, 32, 40, 48].map((x) => rack(x, 13, 7, 24)).join('') + R(4, 9, 56, 2, 0, WALL2),
    () => R(1, 40, 62, 2, 1, GROUND) + [7, 19, 31, 43].map((x) => R(x, 11, 10, 7, 1, ROOF) + dot(x + 5, 14.5, 2.2, DARK) + dot(x + 5, 14.5, 0.8, WALL)).join('') + R(3, 18, 58, 22, 2, WALL) + R(3, 29, 58, 3, 0, ACC) + [8, 16, 24, 32].map((x) => R(x, 21.5, 5, 5, 0.6, MID)).join('') + R(46, 33, 10, 7, 0.6, WALL2),
    () => R(1, 40, 62, 2, 1, GROUND) + R(7, 13, 22, 27, 2, WALL2) + R(20, 19, 26, 21, 2, WALL) + R(20, 30, 26, 3, 0, ACC) + R(2, 26, 15, 14, 2, WALL) + R(2, 33, 15, 2.4, 0, ACC) + [24, 31, 38].map((x) => R(x, 22.5, 4.6, 4.6, 0.6, MID)).join('') + '<path d="M54 4 49 40M54 4l5 36M50 12h8M48.5 21h11M51 12l6.5 9M57 12l-6.5 9M47 26h14" stroke="#5b6878" stroke-width="1.2" fill="none" stroke-linecap="round"/>',
    () => R(0, 34, 64, 10, 3, '#8ed1ee') + '<path d="M4 39c2-1.4 4-1.4 6 0s4 1.4 6 0 4-1.4 6 0M38 41c2-1.4 4-1.4 6 0s4 1.4 6 0 4-1.4 6 0" stroke="#ffffff" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-opacity=".8"/>' + '<path d="M4 35c7-8 16-9 27-9s22 1 29 9z" fill="#a9c58c"/>' + R(15, 17, 26, 12, 1.5, WALL) + R(15, 23, 26, 2.4, 0, ACC) + [18, 25, 32].map((x) => R(x, 19, 4.4, 3, 0.5, MID)).join('') + R(6, 27.5, 7, 2.6, 0.5, ACC) + '<path d="M51 30V10M51 10V2.5M51 10l-6.5 3.8M51 10l6.5 3.8" stroke="#5b6878" stroke-width="1.4" fill="none" stroke-linecap="round"/>' + dot(51, 10, 1.2, DARK),
  ];
  const dev = (body, w, cls) => { const W = w || 46; return '<svg class="dev' + (cls ? ' ' + cls : '') + '" width="' + W + '" height="' + Math.round(W * 44 / 64 * 10) / 10 + '" viewBox="0 0 64 44" aria-hidden="true">' + body + '</svg>'; };

  // 算過的字串留著，一個畫面可能同時有上百個圖示
  const memo = {};
  const once = (key, fn) => (memo[key] != null ? memo[key] : (memo[key] = fn()));
  root.ME_ICONS = {
    tech: (id, size) => once('t' + id + (size || ''), () => glyph(GLYPH[id], size)),
    line: (id, size) => once('l' + id + (size || ''), () => glyph(LINE[id] && LINE[id].g, size)),
    lineColor: (id) => (LINE[id] && LINE[id].c) || '',
    arch: (id, size) => once('a' + id + (size || ''), () => glyph(ARCH[id], size)),
    deal: (id, size) => once('d' + id + (size || ''), () => glyph(DEAL[id], size)),
    gpu: (id, w) => once('g' + id + (w || ''), () => (CHIP[id] ? dev(chipBody(CHIP[id]), w) : '')),
    dc: (lv, w) => once('c' + lv + (w || ''), () => (DC[lv] ? dev(DC[lv](), w, 'dc') : '')),
    has: (kind, id) => !!({ tech: GLYPH, line: LINE, arch: ARCH, deal: DEAL, gpu: CHIP }[kind] || {})[id],
  };
})(typeof window !== 'undefined' ? window : globalThis);

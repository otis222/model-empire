/* 《模型帝國》全球佔領圖：六角格地球、各地區市佔和面板。這個檔案不碰遊戲狀態，資料由 ui.js 傳進來
   海岸線和地區邊界是本專案手繪的示意圖，不是第三方地圖資料。座標都是攤平的 [經度, 緯度, ...]。
   引擎還沒有地區市場，所以各地區的市佔是從全球市佔和主場優勢推算的，算法見 market()。 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2; const RAD = Math.PI / 180;

  /* ---------- 地區 ---------- */
  // w：佔全球市場的比重；mid：AI 普及到一半的年份；at：標籤位置（緯度, 經度）；hubs：開發從這些地方往外擴散；
  // tilt：各陣營在當地的難易度；near：總部在這些地區的公司有地緣優勢；mix：當地各市場的需求倍率，順序同 SEG
  const SEG = ['chat', 'api', 'ent', 'coding', 'creative', 'agent', 'robot'];
  const REGIONS = [
    { id: 'na', name: '北美', en: 'NORTH AMERICA', w: 0.30, mid: 2023.4, at: [46, -100], hubs: [[38, -77], [37, -122], [43, -80]], tilt: { west: 1.4, cn: 0.2, mid: 1 }, mix: [1, 1.2, 1.3, 1.4, 0.9, 1.3, 1] },
    { id: 'la', name: '拉丁美洲', en: 'LATIN AMERICA', w: 0.05, mid: 2025.6, at: [-10, -58], hubs: [[-23.5, -46.6], [19.4, -99.1], [-34.6, -58.4]], tilt: { west: 1, cn: 1, mid: 1.1 }, emerging: true, near: ['na'], mix: [1.5, 0.7, 0.6, 0.7, 1.2, 0.6, 0.4] },
    { id: 'eu', name: '歐洲', en: 'EUROPE', w: 0.20, mid: 2024, at: [50, 10], hubs: [[51, 0], [50, 8], [48, 2]], tilt: { west: 1.3, cn: 0.45, mid: 1 }, mix: [0.9, 1, 1.4, 1.1, 1, 1, 1.1] },
    { id: 'ru', name: '俄羅斯與中亞', en: 'RUSSIA · C.ASIA', w: 0.02, mid: 2026.2, at: [60, 90], hubs: [[55.7, 37.6], [43, 76]], tilt: { west: 0.5, cn: 1.5, mid: 1 }, near: ['eu', 'cn'], mix: [1.2, 1, 0.8, 1.3, 0.8, 0.7, 0.5] },
    { id: 'mea', name: '中東與非洲', en: 'MIDEAST · AFRICA', w: 0.05, mid: 2026.8, at: [6, 22], hubs: [[25, 55], [30, 31], [6.5, 3.4], [-26, 28]], tilt: { west: 1, cn: 1, mid: 1.1 }, emerging: true, near: ['eu'], mix: [1.6, 0.7, 0.8, 0.6, 0.9, 0.5, 0.4] },
    { id: 'sa', name: '南亞', en: 'SOUTH ASIA', w: 0.05, mid: 2025.4, at: [22, 78], hubs: [[19, 73], [28.6, 77.2], [13, 77.6]], tilt: { west: 1, cn: 1, mid: 1.1 }, emerging: true, near: ['sea'], mix: [1.4, 1.1, 0.7, 1.5, 0.8, 0.7, 0.3] },
    { id: 'cn', name: '中國大陸', en: 'CHINA', w: 0.16, mid: 2023.9, at: [33, 104], hubs: [[31.2, 121.5], [39.9, 116.4], [22.5, 114]], tilt: { west: 0.16, cn: 1.4, mid: 0.5 }, mix: [1.2, 1, 0.9, 1, 1.1, 1, 1.6] },
    { id: 'ea', name: '日韓台', en: 'JP · KR · TW', w: 0.09, mid: 2024, at: [33, 149], hubs: [[35.7, 139.7], [37.5, 127], [25, 121.5]], tilt: { west: 1.3, cn: 0.6, mid: 1 }, mix: [0.9, 0.8, 1.2, 0.9, 1.6, 0.9, 1.5] },
    { id: 'sea', name: '東南亞', en: 'SOUTHEAST ASIA', w: 0.05, mid: 2025.2, at: [3, 112], hubs: [[1.35, 103.8], [13.7, 100.5], [-6.2, 106.8]], tilt: { west: 1, cn: 1, mid: 1.1 }, emerging: true, near: ['ea', 'cn'], mix: [1.6, 0.8, 0.7, 0.8, 1.2, 0.6, 0.5] },
    { id: 'oc', name: '大洋洲', en: 'OCEANIA', w: 0.03, mid: 2024.2, at: [-25, 134], hubs: [[-33.9, 151.2], [-37.8, 145]], tilt: { west: 1.4, cn: 0.5, mid: 1 }, near: ['ea', 'na'], mix: [1, 1.1, 1.2, 1.2, 0.9, 1.1, 0.8] },
  ];
  const REGION_IDX = {}; REGIONS.forEach((r, i) => { REGION_IDX[r.id] = i; });

  // 對手的虛構總部（只用來決定主場和版圖的方向，不會顯示）。顏色為了在深色地球上分得開，比 data.js 的稍微拉開
  const HOMES = {
    sky: { pos: [37.8, -122.4], home: 'na', bloc: 'west', color: '#3f9df5' },
    mono: { pos: [47.6, -122.3], home: 'na', bloc: 'west', color: '#a06df2' },
    beacon: { pos: [42.4, -71.1], home: 'na', bloc: 'west', color: '#d98a45' },
    star: { pos: [48.9, 2.3], home: 'eu', bloc: 'west', color: '#2fb98c' },
    hive: { pos: [22.5, 114.1], home: 'cn', bloc: 'cn', color: '#e6bd2c' },
    gale: { pos: [30.3, 120.2], home: 'cn', bloc: 'cn', color: '#e4504c' },
  };
  const CITY_POS = {
    sf: { pos: [37.8, -122.4], home: 'na', bloc: 'west' },
    london: { pos: [51.5, -0.1], home: 'eu', bloc: 'west' },
    paris: { pos: [48.9, 2.3], home: 'eu', bloc: 'west' },
    beijing: { pos: [39.9, 116.4], home: 'cn', bloc: 'cn' },
    taipei: { pos: [25, 121.5], home: 'ea', bloc: 'west' },
    tokyo: { pos: [35.7, 139.7], home: 'ea', bloc: 'west' },
    seoul: { pos: [37.6, 127], home: 'ea', bloc: 'west' },
    singapore: { pos: [1.35, 103.8], home: 'sea', bloc: 'mid' },
  };
  const PLAYER_COLOR = '#c8f51e'; // 同介面的 --lime，亮度最高，色弱也分得開
  const OPEN_LAND = '#44547c'; // 還沒開發的陸地

  /* ---------- 陸地 ---------- */
  // [地區, 多邊形]。am＝美洲大陸、ea2＝歐亞大陸，這兩塊要再用下面的邊界切成地區
  const LAND = [
    ['am', [-168, 65.6, -166.5, 68.3, -163, 69.5, -156.5, 71.3, -148, 70.4, -141, 69.7, -135, 69.3, -128, 70.2, -122, 69.8, -115, 68.4, -108, 67.8, -101, 67.8, -97, 68.5, -95, 71.9, -92, 70.5, -90, 68.8, -85.5, 69.8, -81.5, 69, -82, 66.4, -86.3, 66.2, -87.5, 64.6, -93, 62, -94.6, 58.8, -92.5, 57, -88, 56.5, -82.3, 55.2, -82, 52.9, -80.5, 51.3, -78.8, 51.6, -79, 54.6, -76.8, 56.6, -78.3, 58.7, -77.6, 62.4, -73, 62.1, -70, 61, -69.5, 58.8, -66.2, 58.8, -64.6, 60.3, -61.6, 57, -58, 54.8, -55.7, 52.5, -58.6, 51.4, -60, 50.2, -66.4, 50.2, -69.8, 47.9, -71, 46.9, -67, 49.1, -64.4, 48.9, -65, 47, -64, 46.1, -60.5, 47, -60, 45.9, -64, 44.2, -66, 43.5, -65.9, 45.2, -67, 44.7, -70.2, 43.6, -70, 41.7, -74, 40.6, -75.2, 38.4, -75.6, 35.3, -78, 33.9, -81, 32, -81.4, 30.4, -80, 26.8, -80.4, 25.2, -81.8, 26, -82.8, 28, -84, 30, -86, 30.4, -89, 30.3, -89.4, 29.1, -91.5, 29.5, -94, 29.6, -97, 27.9, -97.4, 25, -97.8, 22.4, -96.4, 19.3, -94.5, 18.2, -92, 18.6, -90.7, 19.4, -90.3, 21, -87, 21.5, -87.6, 19, -88.2, 16.3, -86, 15.9, -83.4, 15.2, -83.6, 11, -81.8, 9, -79.5, 9.6, -77.4, 8.7, -78, 7.4, -80.4, 7.4, -82.8, 8.2, -85.7, 10, -87.6, 13, -91.5, 14, -94, 16, -97, 15.9, -101, 17.3, -105.5, 20, -105.6, 22, -109, 25.6, -112.8, 30, -114.7, 31.7, -114.4, 29.5, -112.4, 27, -110.4, 24.4, -109.5, 23, -112, 24.7, -115, 28, -116.8, 31.5, -117.3, 33, -120.6, 34.5, -122.5, 37.7, -124.3, 40.4, -124.1, 44, -124.6, 48.4, -122.7, 49, -125, 50.5, -128, 52.5, -130.5, 54.7, -133, 57, -137, 58.5, -140, 59.8, -146, 60.7, -151.5, 59.3, -152, 61, -154, 58.5, -158, 56.5, -164, 54.7, -160, 58.7, -162, 60, -166, 61.7, -164.5, 63.2, -161, 64.2, -165, 64.5]],
    ['na', [-89, 73.2, -80, 73.8, -72, 71.6, -68, 69.5, -62, 66.5, -66, 62.3, -71.5, 63.6, -78, 64.6, -73.5, 67.6, -78, 70, -85, 70.2]], // 巴芬島
    ['na', [-118, 72, -112, 73, -105, 73, -101, 69.6, -108, 68.7, -115, 69]], // 維多利亞島
    ['na', [-125, 73.8, -118, 74.3, -115.5, 73.3, -120, 71.5, -125, 72]],
    ['na', [-92, 76.6, -80, 76.2, -76, 78, -65, 81.5, -62, 82.6, -75, 83.2, -90, 81.8, -95, 79]], // 埃爾斯米爾島
    ['na', [-117, 76.2, -105, 76.6, -102, 75.3, -115, 74.6]],
    ['na', [-97, 75.2, -80, 75.2, -80, 74.4, -96, 74.3]],
    ['na', [-87, 65.3, -80.5, 64, -83, 62.8]],
    ['na', [-59.3, 47.7, -56, 51.5, -53, 47.5, -53.2, 46.7, -56, 47]], // 紐芬蘭
    ['na', [-128.4, 50.7, -125, 50.2, -123.4, 48.4, -125.3, 48.7]],
    ['na', [-73, 78.2, -67, 80.7, -58, 82.2, -38, 83.5, -22, 82.2, -17, 80, -19, 76, -21, 72, -27, 68.5, -33, 66.8, -40, 65, -43, 60, -48, 61, -52, 65, -54, 69, -55, 72, -60, 76, -68, 76.2]], // 格陵蘭
    ['la', [-84.9, 21.9, -82, 23.1, -79, 22.7, -75, 20.8, -74.2, 20.2, -77.7, 19.9, -78.5, 21, -81.5, 22.1]], // 古巴
    ['la', [-74.4, 18.4, -73, 19.9, -69.9, 19.8, -68.4, 18.6, -71.5, 17.8]],
    ['la', [-77.4, 8.7, -75.5, 10.7, -72, 12.2, -68, 11.2, -64, 10.6, -61.8, 10.7, -60, 8.5, -57, 6, -52, 4.7, -50, 0.8, -48, -0.7, -44, -2.7, -40, -2.8, -37, -4.8, -35, -5.5, -34.8, -7.5, -37, -11, -39, -14, -39, -17.7, -40.8, -21.5, -42, -23, -46, -24, -48.5, -26, -48.7, -28.5, -52, -32.5, -54, -34.5, -57, -34.7, -58.4, -34, -57, -36.5, -57.7, -38.2, -62, -39, -62.3, -41, -65, -41, -63.7, -42.7, -65.5, -45, -67.5, -46.3, -65.8, -47.8, -69, -50.5, -68.4, -52.5, -65.2, -54.8, -69, -55.5, -72, -54, -75, -51.5, -75.5, -48, -74, -44, -73.7, -41, -73.5, -37.3, -71.5, -32, -70.5, -26, -70.2, -19, -72, -17, -76.3, -13.9, -79, -8, -81.3, -6, -81.3, -4.3, -80, -2.5, -81, -1, -80, 1, -78.5, 2, -77.2, 4, -77.5, 7]],
    ['ea2', [-5.5, 36, -6.3, 36.7, -9, 37, -9.5, 38.7, -8.9, 41, -9.2, 43, -8, 43.7, -4, 43.5, -1.7, 43.4, -1.2, 45.5, -2.2, 47, -4.5, 47.9, -4.7, 48.5, -1.6, 48.7, -1.7, 49.7, 0.2, 49.6, 1.6, 50.9, 3.5, 51.4, 4.7, 53, 7, 53.6, 8.7, 53.9, 8.2, 55.5, 8.2, 57, 10.6, 57.7, 10.3, 56, 10, 54.7, 11, 54, 14.2, 53.9, 18.5, 54.7, 21, 55.2, 21, 57, 24, 57.1, 23.7, 59.2, 28, 59.6, 30.2, 59.9, 28.5, 60.6, 23, 60, 21.3, 61, 21.3, 63, 25.4, 65, 24, 65.9, 21.5, 64.7, 17.5, 62.2, 17, 60.7, 18.8, 59.7, 16.5, 57.5, 16.3, 56.2, 14.3, 55.5, 12.8, 55.6, 12, 58, 11, 59, 8, 58.1, 5.5, 59, 5, 61, 6.5, 62.7, 11, 64.7, 14, 67.5, 19, 69.8, 25.7, 71.1, 31, 70.3, 33, 69.4, 41, 67.2, 40, 66.2, 34, 66.7, 35, 64.3, 37.5, 63.9, 40.5, 64.6, 44, 66.2, 44, 68, 54, 68.5, 60, 69, 67, 68.8, 66.7, 71, 69, 73, 72.8, 73, 72.5, 68, 75, 67.5, 74.5, 72.5, 80, 73.5, 87, 75.2, 100, 76.5, 104, 77.7, 113, 74, 120, 73, 130, 71, 140, 72.7, 150, 71.5, 160, 69.7, 170, 69.7, 180, 68.9, 190, 66.2, 186, 64.5, 179, 62.5, 172, 60.5, 165, 60, 163, 58, 162, 56, 160, 53, 156.7, 51, 155.5, 55, 156, 57.5, 160, 60.5, 164, 62.5, 156, 61.5, 152, 59, 143, 59.3, 137, 54.5, 141, 53, 140, 48.5, 135.5, 44, 132, 43.2, 130.6, 42.4, 129.7, 41, 127.5, 39.7, 128.5, 38.3, 129.4, 36, 129, 35.1, 126.5, 34.3, 126.5, 37, 125, 37.8, 125, 39.5, 124.3, 40, 121.5, 39, 122, 40.7, 118, 39, 117.8, 38, 119, 37.3, 122.5, 37.2, 119.3, 35, 121, 32.5, 122, 31, 121, 28, 119.5, 25.5, 116.7, 23, 113.5, 22.2, 110.5, 21.2, 108.3, 21.6, 106, 19.5, 108.9, 15.5, 109.3, 12, 106.8, 10.4, 105, 8.7, 105, 10.3, 102.9, 11.6, 100.9, 12.8, 100.5, 13.5, 99.8, 12, 99.3, 9.5, 100.6, 7, 103.3, 4.5, 104.2, 1.4, 101.4, 2.8, 100.3, 5.5, 98.3, 8, 98.6, 12, 97.6, 16.5, 95.5, 15.8, 94.3, 16, 94.2, 18.5, 92, 21, 90.5, 22.5, 87.5, 21.7, 86.7, 20.2, 82, 16.4, 80.2, 15, 80.2, 13, 79.8, 10.3, 78, 8.9, 77.5, 8.1, 76.3, 10, 74.8, 13, 73.5, 16, 72.8, 19, 72.7, 21, 70.5, 20.8, 69, 22.3, 70, 23, 67, 24.8, 66.5, 25.4, 61.7, 25.2, 57.2, 25.7, 56.6, 27, 54, 26.7, 51.5, 27.9, 50, 30.1, 48.5, 30.3, 47.8, 29, 48.7, 28, 50, 26.3, 51.2, 26, 51.5, 25, 51.6, 24, 54, 24.2, 56.3, 26.2, 56.5, 24.5, 59.8, 22.4, 57.7, 19, 55, 17, 52, 15.7, 45, 12.8, 43.5, 12.7, 42.8, 15, 39.2, 20.9, 37.2, 24.5, 35, 28, 35, 29.5, 34.3, 27.9, 32.6, 29.9, 32.4, 31.2, 34.3, 31.3, 35, 32.8, 36, 35.8, 36, 36.7, 32.8, 36.1, 30.6, 36.8, 27.4, 36.9, 26.3, 38.5, 26.3, 40, 26, 40.7, 23.5, 40.4, 22.8, 39.3, 24, 38, 23, 36.5, 21.7, 36.8, 20.5, 39.5, 19.4, 41, 19.3, 42, 16, 43.5, 13.6, 45.6, 12.3, 45.4, 12.4, 44.2, 13.6, 43.5, 16, 41.8, 18.5, 40.2, 16.9, 40.4, 17, 39, 16, 38, 15.7, 40, 12.3, 41.7, 10.4, 43, 8.8, 44.4, 6.2, 43.1, 3.5, 43.3, 3.2, 41.9, 0.3, 40.5, -0.4, 38.6, -2, 36.8, -4.5, 36.7]],
    ['eu', [-5.6, 50.1, 1.4, 51.2, 1.7, 52.7, 0, 53.5, -1.6, 55.2, -2, 57.6, -3.5, 58.6, -5, 58.6, -6, 56.7, -5, 55, -3.2, 54, -4.7, 53.3, -5, 52, -3, 51.4]], // 大不列顛
    ['eu', [-10, 51.7, -6.3, 52.2, -6, 53.7, -5.7, 54.7, -7.3, 55.3, -8.7, 54.4, -10, 53.5]],
    ['eu', [-24, 65.5, -18, 66.4, -14, 65, -18, 63.5, -22.5, 63.9]], // 冰島
    ['eu', [11, 79, 16, 80, 27, 80, 22, 77.5, 15, 76.7]], // 斯瓦巴
    ['ru', [52, 71, 56, 74, 68, 77, 69, 76, 58, 71, 55, 70.6]], // 新地島
    ['ru', [137, 75, 150, 75.5, 145, 73.5]],
    ['ru', [142, 54.3, 143.5, 52, 143.5, 49, 142.8, 46, 142, 46.5, 142, 50, 141.8, 53]], // 庫頁島
    ['ea', [140, 41.5, 141.5, 45.4, 145.3, 43.9, 143.2, 42, 141, 42.4]], // 北海道
    ['ea', [131, 34.2, 132.8, 35.5, 136, 36.2, 137.2, 37.4, 139.5, 38.7, 140, 40.5, 141.4, 41.3, 142, 39.6, 141, 37.5, 140.8, 35.7, 138.5, 34.7, 136.8, 34.4, 135.5, 33.5, 135, 34.6, 132.5, 34.2]], // 本州
    ['ea', [129.7, 33.3, 131, 33.9, 131.9, 33, 131.3, 31.4, 130.3, 31.3]], // 九州
    ['ea', [132.2, 33.5, 134.6, 34.2, 134.2, 33.3, 133, 32.8]], // 四國
    ['ea', [121.6, 25.3, 122, 25, 121, 22.5, 120.8, 21.9, 120.1, 23, 120.9, 24.9]], // 台灣
    ['sea', [95.3, 5.6, 98, 4, 103.5, 0, 106, -3, 105.8, -5.9, 104.5, -5.8, 101, -2.8, 98.7, 1.5, 96.5, 3.7]], // 蘇門答臘
    ['sea', [105.2, -6.8, 106.8, -6, 110.8, -6.4, 114.5, -7.8, 114.4, -8.7, 110, -8.1, 106.5, -7.4]], // 爪哇
    ['sea', [109, 1.6, 111.4, 2.6, 113, 3.2, 115.2, 5.2, 117, 7, 119, 5.3, 118, 4.2, 117.6, 1.2, 116.2, -1.7, 116, -4, 114.6, -4.1, 111.6, -3.3, 110.2, -2.9, 109.1, -0.3]], // 婆羅洲
    ['sea', [119.4, -3.4, 119.8, 0.5, 121, 1.1, 125, 1.6, 124, 0.4, 120.4, 0.4, 121.5, -1, 123.4, -1, 122, -2, 122.8, -4.5, 121.5, -4.7, 120.9, -2.7, 120.4, -5.5, 119.5, -5.6]], // 蘇拉威西
    ['sea', [120.6, 18.5, 122.2, 18.5, 121.9, 16, 124, 13, 122.5, 13.6, 120.6, 14, 120, 16]], // 呂宋
    ['sea', [122, 7, 123.6, 8.6, 125.5, 9.8, 126.5, 7.5, 125.5, 5.7, 124, 6.5]], // 民答那峨
    ['oc', [131, -0.8, 134, -0.8, 135, -3.3, 138, -1.6, 141, -2.6, 145, -4.3, 147.7, -6, 146.9, -6.9, 150.7, -10.5, 147, -9.5, 143.5, -8.5, 143, -9.2, 141, -9.1, 138, -8.4, 138, -6, 134, -4, 132.5, -2.8, 131, -1.5]], // 新幾內亞
    ['oc', [113.7, -22.5, 114.2, -26.3, 115, -30, 115, -34.3, 118, -35, 123.5, -33.9, 129, -31.7, 133, -32, 135.5, -34.8, 138, -35.6, 140, -38, 143.5, -38.8, 146.4, -39.1, 150, -37.4, 151.2, -33.8, 153.1, -30.5, 153.2, -26, 150.8, -23.3, 146.3, -19, 145.5, -15, 143.6, -14.2, 142.6, -10.8, 141.7, -13, 141, -17, 139, -17.4, 135.6, -15, 136.7, -12.2, 132.6, -11.3, 130.8, -12.4, 129.6, -14.9, 127, -14, 125, -15.5, 122.3, -17.2, 121, -19.5, 116.8, -20.6]], // 澳洲
    ['oc', [144.7, -40.8, 148.3, -40.9, 147.9, -43.2, 146, -43.6, 145.2, -42.3]], // 塔斯馬尼亞
    ['oc', [172.7, -34.5, 175.5, -36.5, 178.4, -37.7, 177, -39.6, 175.3, -41.6, 174, -39.4, 174.7, -37.5]], // 紐西蘭北島
    ['oc', [172.7, -40.5, 174.2, -41.6, 171, -45, 169, -46.6, 166.5, -46, 168.3, -44]], // 紐西蘭南島
    ['mea', [-5.9, 35.8, -2, 35.2, 3, 36.9, 10, 37.3, 11, 36.9, 10.2, 34, 11.5, 33.1, 15.3, 32.3, 19.8, 31, 20, 32.7, 23, 32.6, 29, 30.9, 32.4, 31.2, 32.6, 29.9, 33.5, 28, 35.5, 24, 37.2, 21, 37.4, 18.7, 39.5, 15.5, 43.2, 12.4, 44, 10.5, 51.2, 11.8, 50.8, 9, 47.5, 4, 42, -1, 39.3, -4.7, 39, -6.7, 40.5, -10.5, 40.7, -15, 37, -17.8, 34.8, -20, 35.5, -23.9, 32.8, -25.9, 32.5, -28.5, 28, -33, 25.7, -34, 20, -34.8, 18.4, -34, 17, -30, 15, -26.5, 14.4, -22.5, 11.8, -17.5, 13.7, -11, 12, -6, 9, -1, 9.5, 3.8, 8.5, 4.5, 6, 4.3, 4.5, 6.2, 1, 5.9, -2, 4.8, -4.5, 5.2, -7.5, 4.4, -11, 6.5, -13.2, 8.9, -15, 10.9, -16.7, 12.5, -17.4, 14.7, -16.4, 19, -17, 21, -14.5, 26, -13, 27.8, -10, 29.5, -9.7, 31.5, -6.8, 34]], // 非洲
    ['mea', [49.3, -12, 50.4, -15.6, 47.2, -24.9, 45, -25.5, 43.5, -22, 44.4, -17, 46.5, -15.5, 48, -13.5]], // 馬達加斯加
  ];
  // 內海和大湖，從陸地扣掉
  const SEAS = [
    [28, 43, 28.5, 41.4, 31.5, 41.3, 35, 42, 38, 41, 41.5, 41.6, 39.5, 43.7, 38.5, 46, 39, 47.2, 35, 46.3, 33, 45.9, 30.7, 46.5, 29, 45], // 黑海和亞速海
    [47, 45, 51.5, 47, 53, 45, 51, 44.5, 53, 41, 54, 37, 51, 36.8, 49, 37.7, 49.5, 40.5, 47.5, 43], // 裏海
    [-92, 46.7, -88, 48.7, -84.5, 46.7, -87, 46.5], // 蘇必略湖
    [-87.7, 41.7, -87.8, 45, -85, 46, -81, 46, -80, 44.6, -82, 43, -84, 44, -85.5, 42.5], // 密西根湖和休倫湖
  ];
  // 太小、格子中心可能剛好踩不到的小島，直接指定最近的一格是陸地
  const DOTS = [[121, 23.7, 'ea'], [127.8, 26.4, 'ea'], [109.8, 19.2, 'cn'], [80.7, 7.8, 'sa'], [14, 37.5, 'eu'], [9, 40, 'eu'], [25, 35.2, 'eu'], [33.2, 35, 'mea'], [-77.3, 18.1, 'la'], [-66.5, 18.2, 'la'], [-59, -51.7, 'la'], [-155.5, 19.6, 'na'], [-176, 52, 'na'], [-170, 53, 'na'], [115.5, -8.4, 'sea'], [124.5, -9.3, 'sea'], [127.8, 0.8, 'sea'], [123, 10.5, 'sea'], [118.7, 9.7, 'sea'], [178, -17.8, 'oc'], [165.5, -21.3, 'oc'], [160, -9.5, 'oc'], [151, -5.5, 'oc'], [-15.5, 28.2, 'mea'], [57.5, -20.6, 'mea']];
  // 地區邊界：只切地區，不是國界，畫得很粗略
  const B_NA = [-175, 50, -175, 76, -60, 86, -10, 86, -10, 70, -40, 57, -50, 44, -65, 30, -80, 24.6, -97.2, 25.9, -101.5, 29.7, -106.5, 31.8, -117.1, 32.5, -125, 32, -140, 50];
  const SPLIT = [
    ['eu', [-12, 34, -12, 73, 33, 73, 30.5, 62, 28, 58, 31.5, 53, 40, 50, 40, 47, 36, 45, 30, 43, 28.2, 41.8, 26.2, 41.5, 26.2, 36, 14, 34]],
    ['ea', [124, 33, 124.4, 40, 128, 41.5, 131, 42.6, 132, 38, 130, 33]],
    ['cn', [74, 39.5, 80, 42, 80, 45, 83, 47, 87, 49, 96, 42.8, 105, 41.6, 112, 43.5, 119, 46.7, 116, 49.8, 120, 53.2, 127, 50, 131, 48, 135, 48.4, 131, 45, 131, 42.6, 128, 41.5, 124.4, 40, 126, 33, 122, 24, 116, 20, 108, 18, 108, 21.6, 106, 22.5, 101.5, 21.2, 97.5, 23.9, 98, 25, 97, 28.5, 92, 28, 86, 28, 81, 30, 79, 32.5]],
    ['sa', [60.8, 25, 61, 30, 61, 35.5, 66, 37, 74, 37, 74, 39.5, 79, 32.5, 81, 30, 86, 28, 92, 28, 97, 28.5, 94, 24, 92.5, 21, 90, 19, 78, 5, 70, 10, 65, 24]],
    ['ru', [33, 73, 30.5, 62, 28, 58, 31.5, 53, 40, 50, 40, 47, 38.5, 44.5, 40, 43, 46, 41.5, 50, 38, 54, 37.5, 61, 35.5, 66, 37, 74, 37, 74, 39.5, 80, 42, 80, 45, 83, 47, 87, 49, 96, 42.8, 105, 41.6, 112, 43.5, 119, 46.7, 116, 49.8, 120, 53.2, 127, 50, 131, 48, 135, 48.4, 131, 45, 131, 42.6, 145, 44, 170, 50, 200, 60, 200, 80, 30, 85]],
  ];
  function inPoly(p, lon, lat) {
    let hit = false;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      const yi = p[i + 1]; const yj = p[j + 1];
      if ((yi > lat) !== (yj > lat) && lon < (p[j] - p[i]) * (lat - yi) / (yj - yi) + p[i]) hit = !hit;
    }
    return hit;
  }
  const inPolyW = (p, lon, lat) => inPoly(p, lon, lat) || (lon < 0 && inPoly(p, lon + 360, lat)); // 楚科奇跨過 180 度經線
  const bbox = (p) => { let a = 1e9; let b = -1e9; let c = 1e9; let d = -1e9; for (let i = 0; i < p.length; i += 2) { a = Math.min(a, p[i]); b = Math.max(b, p[i]); c = Math.min(c, p[i + 1]); d = Math.max(d, p[i + 1]); } return [a, b, c, d]; };
  const LAND_BOX = LAND.map((x) => bbox(x[1]));
  function landTag(lon, lat) {
    if (lat < -71 - 2.5 * Math.sin(lon * 2 * RAD) || (lat < -63 && lon > -68 && lon < -55)) return 'ice';  // 南極不是市場
    for (const s of SEAS) if (inPoly(s, lon, lat)) return '';
    for (let i = 0; i < LAND.length; i++) {
      const b = LAND_BOX[i];
      if (lat < b[2] || lat > b[3]) continue;
      if (((lon >= b[0] && lon <= b[1]) || (lon + 360 >= b[0] && lon + 360 <= b[1])) && inPolyW(LAND[i][1], lon, lat)) return LAND[i][0];
    }
    return '';
  }
  function regionOf(tag, lon, lat) {
    if (tag === 'am') return inPoly(B_NA, lon, lat) ? 'na' : 'la';
    if (tag !== 'ea2') return tag;
    for (const s of SPLIT) if (inPolyW(s[1], lon, lat)) return s[0];
    return lat < 29 && lon > 92 ? 'sea' : 'mea';
  }

  /* ---------- 六角格：正二十面體細分後取對偶 ---------- */
  const FREQ = 38; // 10 × 38² + 2 ≈ 一萬四千格，每格約 1.9 度
  const vec = (lat, lon) => { const a = lat * RAD; const b = lon * RAD; const c = Math.cos(a); return [c * Math.sin(b), Math.sin(a), c * Math.cos(b)]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const unit = (a) => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
  const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  let GEO = null;
  function buildGeo() {
    if (GEO) return GEO;
    const t = (1 + Math.sqrt(5)) / 2;
    const V0 = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(unit);
    const F0 = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    const vs = []; const seen = new Map();
    const vid = (p) => { const k = Math.round(p[0] * 2e4) + ',' + Math.round(p[1] * 2e4) + ',' + Math.round(p[2] * 2e4); let id = seen.get(k); if (id === undefined) { id = vs.length; vs.push(p); seen.set(k, id); } return id; };
    const tris = []; const f = FREQ;
    for (const [ia, ib, ic] of F0) {
      const A = V0[ia]; const B = V0[ib]; const C = V0[ic]; const g = [];
      for (let i = 0; i <= f; i++) { g[i] = []; for (let j = 0; j <= f - i; j++) { const a = (f - i - j) / f; const b = i / f; const c = j / f; g[i][j] = vid(unit([A[0] * a + B[0] * b + C[0] * c, A[1] * a + B[1] * b + C[1] * c, A[2] * a + B[2] * b + C[2] * c])); } }
      for (let i = 0; i < f; i++) for (let j = 0; j < f - i; j++) { tris.push([g[i][j], g[i + 1][j], g[i][j + 1]]); if (i + j < f - 1) tris.push([g[i + 1][j], g[i + 1][j + 1], g[i][j + 1]]); }
    }
    const tc = tris.map((x) => unit([vs[x[0]][0] + vs[x[1]][0] + vs[x[2]][0], vs[x[0]][1] + vs[x[1]][1] + vs[x[2]][1], vs[x[0]][2] + vs[x[1]][2] + vs[x[2]][2]]));
    const around = vs.map(() => []); tris.forEach((x, i) => { around[x[0]].push(i); around[x[1]].push(i); around[x[2]].push(i); });
    // 分類：每格一個標籤，再把小島補上
    const tag = vs.map((p) => { const lat = Math.asin(p[1]) / RAD; const lon = Math.atan2(p[0], p[2]) / RAD; return landTag(lon, lat); });
    const near = (lat, lon) => { const q = vec(lat, lon); let b = 0; let bd = -2; for (let i = 0; i < vs.length; i++) { const d = dot(vs[i], q); if (d > bd) { bd = d; b = i; } } return b; };
    const forced = {}; DOTS.forEach(([lon, lat, id]) => { forced[near(lat, lon)] = id; });
    // 陸地格：中心、角、鄰居都攤平成陣列，畫的時候才快
    const landOf = new Int32Array(vs.length).fill(-1); const cells = []; const ocean = [];
    vs.forEach((p, i) => {
      const lat = Math.asin(p[1]) / RAD; const lon = Math.atan2(p[0], p[2]) / RAD;
      const tg = forced[i] || tag[i]; if (!tg) { ocean.push(p[0], p[1], p[2]); return; }
      const reg = tg === 'ice' ? -1 : REGION_IDX[regionOf(tg, lon, lat)];
      landOf[i] = cells.length; cells.push({ v: i, r: reg === undefined ? -1 : reg, p });
    });
    const n = cells.length; const cen = new Float32Array(n * 3); const reg = new Int8Array(n); const start = new Int32Array(n + 1);
    const base = []; const inset = []; const nbr = [];
    cells.forEach((c, i) => {
      const P = c.p; cen[i * 3] = P[0]; cen[i * 3 + 1] = P[1]; cen[i * 3 + 2] = P[2]; reg[i] = c.r; start[i] = base.length / 3;
      const u = unit(Math.abs(P[1]) < 0.9 ? [P[2], 0, -P[0]] : [1, 0, 0]); const w = [P[1] * u[2] - P[2] * u[1], P[2] * u[0] - P[0] * u[2], P[0] * u[1] - P[1] * u[0]];
      const ts = around[c.v].slice().sort((a, b) => Math.atan2(dot(tc[a], w), dot(tc[a], u)) - Math.atan2(dot(tc[b], w), dot(tc[b], u)));
      ts.forEach((ti, k) => {
        const q = tc[ti]; base.push(q[0], q[1], q[2]);
        const m = unit([P[0] + (q[0] - P[0]) * 0.88, P[1] + (q[1] - P[1]) * 0.88, P[2] + (q[2] - P[2]) * 0.88]); inset.push(m[0], m[1], m[2]);
        const nx = tris[ts[(k + 1) % ts.length]]; const shared = tris[ti].find((x) => x !== c.v && nx.indexOf(x) >= 0); // 這條邊另一側的格子
        nbr.push(shared === undefined ? -1 : landOf[shared]);
      });
    });
    start[n] = base.length / 3;
    const byRegion = REGIONS.map(() => []); for (let i = 0; i < n; i++) if (reg[i] >= 0) byRegion[reg[i]].push(i);
    // 各地區的輪廓線（選取時描邊）
    const edges = REGIONS.map(() => []);
    for (let i = 0; i < n; i++) {
      if (reg[i] < 0) continue;
      const s = start[i]; const e = start[i + 1];
      for (let k = s; k < e; k++) { const o = nbr[k]; if (o < 0 || reg[o] !== reg[i]) { const m = k + 1 < e ? k + 1 : s; edges[reg[i]].push(base[k * 3], base[k * 3 + 1], base[k * 3 + 2], base[m * 3], base[m * 3 + 1], base[m * 3 + 2]); } }
    }
    GEO = { n, cen, reg, start, base: new Float32Array(base), inset: new Float32Array(inset), nbr: new Int32Array(nbr), ocean: new Float32Array(ocean), byRegion, edges: edges.map((x) => new Float32Array(x)) };
    return GEO;
  }

  /* ---------- 市佔推算 ---------- */
  function affinity(c, R) {
    let a = R.tilt[c.bloc] || 1;
    if (c.home === R.id) a *= 3.2;
    else if (R.near && R.near.indexOf(c.home) >= 0) a *= 1.3;
    if (R.emerging) a *= c.cheap ? 1.45 : c.premium ? 0.75 : 1; // 新興市場偏好便宜和開源的模型
    return a;
  }
  /* 輸入 segs：{ 市場: 每週規模 }、date（Date）、companies：[{ id, name, icon, seg: { 市場: 市佔 }, player, city, open, price }]
     每區的比例＝各市場的市佔 × 當地需求 × 當地親和度，所以你主攻哪個市場，地圖上就會反映在需求相符的地區。
     最後反覆校正，讓各區加權後剛好等於全球市佔 */
  function market(inp) {
    const list = inp.companies.map((c) => {
      const h = c.player ? (CITY_POS[c.city] || { pos: null, home: '', bloc: 'mid' }) : (HOMES[c.id] || { pos: null, home: '', bloc: 'mid' });
      return Object.assign({}, c, { pos: h.pos, home: h.home, bloc: h.bloc, color: c.player ? PLAYER_COLOR : (h.color || c.color), cheap: !!c.open || c.price < 0.6, premium: c.price > 1.2 });
    });
    const size = SEG.map((k) => inp.segs[k] || 0); const total = size.reduce((a, x) => a + x, 0);
    list.forEach((c) => { c.value = SEG.reduce((a, k, i) => a + size[i] * ((c.seg && c.seg[k]) || 0), 0); });
    const tot = list.reduce((a, c) => a + c.value, 0);
    list.forEach((c) => { c.share = tot > 0 ? c.value / tot : 0; });
    const rows = REGIONS.map((R) => {
      const v = list.map((c) => SEG.reduce((a, k, i) => a + R.mix[i] * size[i] * ((c.seg && c.seg[k]) || 0), 0) * affinity(c, R)); const t = v.reduce((a, x) => a + x, 0) || 1;
      return v.map((x) => x / t);
    });
    for (let it = 0; it < 12; it++) {
      list.forEach((c, j) => {
        const got = REGIONS.reduce((a, R, i) => a + R.w * rows[i][j], 0);
        if (got > 0 && c.share > 0) { const k = c.share / got; rows.forEach((r) => { r[j] *= k; }); }
      });
      rows.forEach((r) => { const t = r.reduce((a, x) => a + x, 0) || 1; r.forEach((x, j) => { r[j] = x / t; }); });
    }
    const d = inp.date; const year = d.getUTCFullYear() + d.getUTCMonth() / 12;
    const regions = REGIONS.map((R, i) => {
      const ranked = list.map((c, j) => ({ id: c.id, share: rows[i][j] })).filter((x) => x.share > 0.0005).sort((a, b) => b.share - a.share);
      const ad = 0.06 + 0.94 / (1 + Math.exp(-(year - R.mid) / 1.05));
      return { id: R.id, name: R.name, en: R.en, w: R.w, value: total * R.w, adoption: ad > 0.985 ? 1 : ad, ranked, shares: rows[i], leader: ranked[0] ? ranked[0].id : null };
    });
    const byId = {}; list.forEach((c) => { c.leads = regions.filter((r) => r.leader === c.id).length; byId[c.id] = c; });
    const world = list.slice().sort((a, b) => b.share - a.share);
    return { companies: list, regions, world, byId, key: list.map((c) => c.id + (c.pos ? c.pos.join() : '')).join('|'), date: d };
  }

  /* ---------- 地球 ---------- */
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c) => 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';
  const BANDS = 7;
  const bandRamp = (h, floor) => { const c = hex(h); const dark = [8, 13, 32]; const out = []; for (let b = 0; b < BANDS; b++) { const k = b / (BANDS - 1); let x = mix(dark, c, floor + (1 - floor) * k); if (k > 0.8) x = mix(x, [255, 255, 255], (k - 0.8) * 0.45); out.push(css(x)); } return out; };

  function create(opts) {
    const G = buildGeo(); const N = G.n;
    const el = document.createElement('div'); el.className = 'gb-globe';
    const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
    const tip = document.createElement('div'); tip.className = 'gb-tip'; tip.hidden = true;
    el.append(cv, tip);
    const ctx = cv.getContext('2d');
    const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const tr = opts.t || ((s) => s);  // 畫布文字不經過畫面的簡體轉換，要自己轉
    // 畫布文字用和畫面相同的字型和備用字型，語言換了才重讀 CSS 變數
    let fontLang = null; let fontBody = ''; let fontNum = '';
    const readFonts = () => { const h = root.document.documentElement; if (h.lang === fontLang) return; fontLang = h.lang; const cs = root.getComputedStyle(h); fontBody = cs.getPropertyValue('--font-body').trim(); fontNum = cs.getPropertyValue('--font-num').trim(); };
    const owner = new Int16Array(N).fill(-1);
    let data = null; let compKey = ''; let pal = []; let anchorD = []; let regionState = []; let hq = null; let hqRing = [];
    let yaw = 121 * RAD; let pitch = 18 * RAD; let spin = opts.spin !== false; let sel = -1; let hover = -1;
    let W = 0; let H = 0; let dpr = 1; let cx = 0; let cy = 0; let RR = 0; let grads = null;
    let inside = false; let drag = null; let vy = 0; let vp = 0; let anim = null; let idleUntil = 0; let raf = 0; let lastDraw = 0; let lastT = 0; let visible = true; let frameGap = 31;
    const flips = []; const labelA = REGIONS.map(() => 0); const labelAt = REGIONS.map((R) => vec(R.at[0], R.at[1])); let labelT = 0; let drawnLabels = false; let myEdges = new Float32Array(0);
    const buckets = []; const oceanA = []; const oceanB = [];

    function setPalette() {
      pal = [bandRamp('#3c4966', 0.32), bandRamp(OPEN_LAND, 0.46)].concat(data.companies.map((c) => bandRamp(c.color, 0.3)));
      buckets.length = 0; for (let i = 0; i < pal.length * BANDS; i++) buckets.push([]);
    }
    // 每家公司在每個地區有一個據點，版圖從據點往外長；公司總部在當地就用總部，其他的挑一個方向最接近總部的點
    function setCompanies() {
      const cs = data.companies; const me = cs.find((c) => c.player);
      hq = me && me.pos ? unit(vec(me.pos[0], me.pos[1])) : null;
      hqRing = []; if (hq) { const u = unit(Math.abs(hq[1]) < 0.9 ? [hq[2], 0, -hq[0]] : [1, 0, 0]); const w = [hq[1] * u[2] - hq[2] * u[1], hq[2] * u[0] - hq[0] * u[2], hq[0] * u[1] - hq[1] * u[0]]; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; hqRing.push([u[0] * Math.cos(a) + w[0] * Math.sin(a), u[1] * Math.cos(a) + w[1] * Math.sin(a), u[2] * Math.cos(a) + w[2] * Math.sin(a)]); } }
      anchorD = REGIONS.map((R, ri) => {
        const cells = G.byRegion[ri]; const pts = cells.map((i) => [G.cen[i * 3], G.cen[i * 3 + 1], G.cen[i * 3 + 2]]);
        const hub = vec(R.hubs[0][0], R.hubs[0][1]); let first = 0; let best = -2;
        pts.forEach((p, k) => { const d = dot(p, hub); if (d > best) { best = d; first = k; } });
        const seeds = [first]; const far = pts.map((p) => angle(p, pts[first]));
        while (seeds.length < cs.length) { let b = 0; let bd = -1; far.forEach((d, k) => { if (d > bd) { bd = d; b = k; } }); seeds.push(b); pts.forEach((p, k) => { far[k] = Math.min(far[k], angle(p, pts[b])); }); }
        const used = {}; const pick = {};
        const home = (c) => (c.pos ? unit(vec(c.pos[0], c.pos[1])) : null);
        cs.filter((c) => c.home === R.id && c.pos).forEach((c) => { const q = home(c); let k0 = 0; let bd = -2; pts.forEach((p, k) => { const d = dot(p, q); if (d > bd) { bd = d; k0 = k; } }); pick[c.id] = k0; used[seeds.reduce((a, s, si) => (angle(pts[s], q) < angle(pts[seeds[a]], q) ? si : a), 0)] = 1; });
        cs.forEach((c, ci) => {
          if (pick[c.id] !== undefined) return;
          const q = home(c); let bs = -1; let bd = -3;
          seeds.forEach((s, si) => { if (used[si]) return; const d = q ? dot(pts[s], q) : -si; if (d > bd) { bd = d; bs = si; } });
          if (bs < 0) bs = ci % seeds.length; used[bs] = 1; pick[c.id] = seeds[bs];
        });
        const radius = Math.max(0.12, Math.max.apply(null, pts.map((p) => angle(p, pts[first]))) / 2);
        const amp = radius * 0.14 + 0.02;
        return cs.map((c, ci) => {
          const a = pts[pick[c.id]]; const out = new Float32Array(cells.length); const k1 = 5.5 + ci * 0.7; const k2 = 9.1 - ci * 0.5;
          pts.forEach((p, k) => { const nz = Math.sin(p[0] * k1 + ci * 1.7 + p[1] * 3) + 0.6 * Math.sin(p[1] * k2 + ci * 2.9 - p[2] * 4) + 0.4 * Math.sin(p[2] * 13 + p[0] * 7 + ci); out[k] = angle(p, a) + amp * nz; });
          return out;
        });
      });
      // 開發順序：離樞紐近的格子先開發
      regionState = REGIONS.map((R, ri) => {
        const cells = G.byRegion[ri]; const hubs = R.hubs.map((h) => vec(h[0], h[1]));
        const rank = cells.map((c, k) => { const p = [G.cen[c * 3], G.cen[c * 3 + 1], G.cen[c * 3 + 2]]; let m = 9; hubs.forEach((h) => { m = Math.min(m, angle(p, h)); }); return { k, d: m + 0.05 * Math.sin(p[0] * 17 + p[1] * 11) + 0.05 * Math.sin(p[2] * 23 - p[0] * 9) }; }).sort((a, b) => a.d - b.d).map((x) => x.k);
        const radius = Math.max(0.12, cells.length ? Math.sqrt(cells.length) * 0.03 : 0.2);
        return { rank, wt: new Float64Array(data.companies.length), key: '', radius };
      });
    }
    // 把一個地區的格子分給各公司：帶權重的 Voronoi，調權重讓每家分到的格數符合市佔，國界才會是連續的一片
    function solveRegion(ri, m, animate) {
      const cells = G.byRegion[ri]; const st = regionState[ri]; const info = m.regions[ri]; const D = anchorD[ri]; const nc = m.companies.length;
      const claim = info.ranked.length ? Math.round(cells.length * info.adoption) : 0;
      const target = new Int32Array(nc); let left = claim; const rem = [];
      for (let j = 0; j < nc; j++) { const x = info.shares[j] * claim; target[j] = Math.floor(x); left -= target[j]; rem.push([x - target[j], j]); }
      rem.sort((a, b) => b[0] - a[0]); for (let i = 0; i < left && i < nc; i++) target[rem[i][1]]++;
      const key = claim + ':' + target.join(','); if (key === st.key) return false; st.key = key;
      const active = []; for (let j = 0; j < nc; j++) if (target[j] > 0) active.push(j);
      const taken = st.rank.slice(0, claim); const next = new Int16Array(cells.length).fill(-1);
      if (active.length) {
        const w = st.wt; const count = new Int32Array(nc); let step = st.radius * 0.8;
        for (let it = 0; it < 32; it++) {
          count.fill(0);
          for (const k of taken) { let b = active[0]; let bs = 1e9; for (const j of active) { const v = D[j][k] - w[j]; if (v < bs) { bs = v; b = j; } } next[k] = b; count[b]++; }
          let off = 0; for (const j of active) { off += Math.abs(target[j] - count[j]); w[j] += step * (target[j] - count[j]) / claim; }
          if (off <= 1) break;
          step *= 0.94;
        }
        // 權重調不到剛好時，把超額公司最不想要的格子讓給還缺格子的公司
        for (let guard = 0; guard < 500; guard++) {
          const u = active.find((j) => count[j] < target[j]); if (u === undefined) break;
          let bc = -1; let bv = 1e9;
          for (const k of taken) { const o = next[k]; if (count[o] > target[o]) { const v = (D[u][k] - w[u]) - (D[o][k] - w[o]); if (v < bv) { bv = v; bc = k; } } }
          if (bc < 0) break;
          count[next[bc]]--; next[bc] = u; count[u]++;
        }
      }
      const now = performance.now(); const flash = animate && !reduced();
      cells.forEach((c, k) => {
        const o = next[k];
        if (owner[c] !== o) { if (flash && flips.length < 400) flips.push({ c, t: now + Math.random() * 500 }); owner[c] = o; }
      });
      return true;
    }
    function rebuildMyEdges(m) {
      const me = m.companies.findIndex((c) => c.player); const out = [];
      for (let i = 0; i < N; i++) {
        if (owner[i] !== me) continue;
        const s = G.start[i]; const e = G.start[i + 1];
        for (let k = s; k < e; k++) { const o = G.nbr[k]; if (o < 0 || owner[o] !== me) { const q = k + 1 < e ? k + 1 : s; out.push(G.base[k * 3], G.base[k * 3 + 1], G.base[k * 3 + 2], G.base[q * 3], G.base[q * 3 + 1], G.base[q * 3 + 2]); } }
      }
      myEdges = new Float32Array(out);
    }

    function resize() {
      const w = el.clientWidth; const h = el.clientHeight; if (!w || !h) return false;
      const d = Math.min(2, root.devicePixelRatio || 1);
      if (w === W && h === H && d === dpr) return true;
      W = w; H = h; dpr = d; cv.width = Math.round(w * d); cv.height = Math.round(h * d); cx = cv.width / 2; cy = cv.height / 2; RR = Math.min(cv.width, cv.height) / 2 * 0.84; grads = null;
      return true;
    }
    function gradients() {
      const atm = ctx.createRadialGradient(cx, cy, RR * 0.94, cx, cy, RR * 1.17); atm.addColorStop(0, 'rgba(112,178,255,.40)'); atm.addColorStop(0.3, 'rgba(92,150,255,.14)'); atm.addColorStop(1, 'rgba(80,130,255,0)');
      const sea = ctx.createRadialGradient(cx - RR * 0.34, cy - RR * 0.42, RR * 0.1, cx, cy, RR); sea.addColorStop(0, '#1c3468'); sea.addColorStop(0.55, '#101f47'); sea.addColorStop(1, '#090f27');
      const gloss = ctx.createRadialGradient(cx - RR * 0.36, cy - RR * 0.44, 0, cx - RR * 0.36, cy - RR * 0.44, RR * 1.05); gloss.addColorStop(0, 'rgba(190,220,255,.13)'); gloss.addColorStop(0.5, 'rgba(160,200,255,.03)'); gloss.addColorStop(1, 'rgba(160,200,255,0)');
      const limb = ctx.createRadialGradient(cx, cy, RR * 0.72, cx, cy, RR); limb.addColorStop(0, 'rgba(6,10,26,0)'); limb.addColorStop(1, 'rgba(6,10,26,.46)');
      grads = { atm, sea, gloss, limb };
    }
    function draw(now) {
      if (!W || !data) return;
      if (!grads) gradients();
      readFonts();
      const sy = Math.sin(yaw); const cyw = Math.cos(yaw); const sp = Math.sin(pitch); const cp = Math.cos(pitch); const R = RR; const X = cx; const Y = cy;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = grads.atm; ctx.beginPath(); ctx.arc(X, Y, R * 1.18, 0, TAU); ctx.fill();
      ringTicks();
      ctx.fillStyle = grads.sea; ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU); ctx.fill();
      // 海面的點陣
      oceanA.length = 0; oceanB.length = 0; const O = G.ocean; const dotS = Math.max(1, R * 0.0052);
      for (let i = 0; i < O.length; i += 3) {
        const x = O[i]; const y = O[i + 1]; const z = O[i + 2]; const z1 = x * sy + z * cyw; const z2 = y * sp + z1 * cp; if (z2 < 0.12) continue;
        const x1 = x * cyw - z * sy; const y2 = y * cp - z1 * sp; (z2 > 0.55 ? oceanA : oceanB).push(X + R * x1, Y - R * y2);
      }
      ctx.fillStyle = 'rgba(150,190,255,.20)'; ctx.beginPath(); for (let i = 0; i < oceanA.length; i += 2) ctx.rect(oceanA[i] - dotS / 2, oceanA[i + 1] - dotS / 2, dotS, dotS); ctx.fill();
      ctx.fillStyle = 'rgba(150,190,255,.10)'; ctx.beginPath(); for (let i = 0; i < oceanB.length; i += 2) ctx.rect(oceanB[i] - dotS / 2, oceanB[i + 1] - dotS / 2, dotS, dotS); ctx.fill();
      // 陸地：依公司和明暗分批，同一批一次填滿
      for (const b of buckets) b.length = 0;
      const C = G.cen; const reg = G.reg; const dimOthers = sel >= 0;
      for (let i = 0; i < N; i++) {
        const x = C[i * 3]; const y = C[i * 3 + 1]; const z = C[i * 3 + 2]; const z1 = x * sy + z * cyw; const z2 = y * sp + z1 * cp; if (z2 < 0.015) continue;
        const x1 = x * cyw - z * sy; const y2 = y * cp - z1 * sp;
        const lit = Math.max(0, -0.46 * x1 + 0.56 * y2 + 0.69 * z2); let b = 0.46 + 0.54 * Math.pow(lit, 0.8); b *= 0.7 + 0.3 * Math.min(1, z2 / 0.3);
        let band = Math.min(BANDS - 1, Math.floor(b * BANDS));
        const r = reg[i]; if (dimOthers && r !== sel) band = Math.max(0, band - 3); else if (r === hover && r >= 0) band = Math.min(BANDS - 1, band + 1);
        const pi = r < 0 ? 0 : owner[i] < 0 ? 1 : owner[i] + 2;
        buckets[pi * BANDS + band].push(i);
      }
      const P = G.inset; const S = G.start;
      for (let bi = 0; bi < buckets.length; bi++) {
        const list = buckets[bi]; if (!list.length) continue;
        ctx.fillStyle = pal[Math.floor(bi / BANDS)][bi % BANDS]; ctx.beginPath();
        for (let q = 0; q < list.length; q++) {
          const i = list[q]; const s = S[i]; const e = S[i + 1];
          for (let k = s; k < e; k++) {
            const x = P[k * 3]; const y = P[k * 3 + 1]; const z = P[k * 3 + 2]; const z1 = x * sy + z * cyw;
            const px = X + R * (x * cyw - z * sy); const py = Y - R * (y * cp - z1 * sp);
            if (k === s) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
        }
        ctx.fill();
      }
      // 地區的細線，再疊上我方版圖的發光邊
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); for (let r = 0; r < REGIONS.length; r++) edgePath(G.edges[r], sy, cyw, sp, cp);
      ctx.strokeStyle = 'rgba(10,16,40,.75)'; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
      if (myEdges.length) {
        ctx.beginPath(); edgePath(myEdges, sy, cyw, sp, cp);
        ctx.strokeStyle = 'rgba(200,245,30,.30)'; ctx.lineWidth = 3.6 * dpr; ctx.stroke();
        ctx.strokeStyle = 'rgba(240,255,190,.95)'; ctx.lineWidth = 1.05 * dpr; ctx.stroke();
      }
      const outline = sel >= 0 ? sel : hover;
      if (outline >= 0) { ctx.beginPath(); edgePath(G.edges[outline], sy, cyw, sp, cp); ctx.strokeStyle = sel >= 0 ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.3 * dpr; ctx.lineJoin = 'round'; ctx.stroke(); }
      // 換手的格子閃一下
      if (flips.length) {
        for (let f = flips.length - 1; f >= 0; f--) {
          const fl = flips[f]; const t = (now - fl.t) / 520; if (t >= 1) { flips.splice(f, 1); continue; } if (t < 0) continue;
          const i = fl.c; const x = C[i * 3]; const y = C[i * 3 + 1]; const z = C[i * 3 + 2]; const z1 = x * sy + z * cyw; if (y * sp + z1 * cp < 0.02) continue;
          ctx.fillStyle = 'rgba(255,255,255,' + ((1 - t) * (1 - t) * 0.85).toFixed(3) + ')'; ctx.beginPath();
          for (let k = S[i]; k < S[i + 1]; k++) { const a = P[k * 3]; const b = P[k * 3 + 1]; const c = P[k * 3 + 2]; const q1 = a * sy + c * cyw; const px = X + R * (a * cyw - c * sy); const py = Y - R * (b * cp - q1 * sp); if (k === S[i]) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
          ctx.closePath(); ctx.fill();
        }
      }
      ctx.fillStyle = grads.limb; ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU); ctx.fill();
      ctx.fillStyle = grads.gloss; ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU); ctx.fill();
      hqMark(now, sy, cyw, sp, cp);
      labels(now, sy, cyw, sp, cp);
      readout();
    }
    function edgePath(E, sy, cyw, sp, cp) {
      const R = RR;
      for (let i = 0; i < E.length; i += 6) {
        const x = E[i]; const y = E[i + 1]; const z = E[i + 2]; const z1 = x * sy + z * cyw; if (y * sp + z1 * cp < 0.02) continue;
        const a = E[i + 3]; const b = E[i + 4]; const c = E[i + 5]; const q1 = a * sy + c * cyw; if (b * sp + q1 * cp < 0.02) continue;
        ctx.moveTo(cx + R * (x * cyw - z * sy), cy - R * (y * cp - z1 * sp)); ctx.lineTo(cx + R * (a * cyw - c * sy), cy - R * (b * cp - q1 * sp));
      }
    }
    // 外圈刻度跟著經度轉，像儀器的讀數環
    function ringTicks() {
      const r0 = RR * 1.075; const deg = yaw / RAD;
      ctx.lineWidth = dpr; ctx.strokeStyle = 'rgba(170,205,255,.16)'; ctx.beginPath(); ctx.arc(cx, cy, r0, 0, TAU); ctx.stroke();
      ctx.beginPath();
      for (let a = 0; a < 360; a += 5) { if (a % 30 === 0) continue; const t = (a - deg) * RAD - Math.PI / 2; const c = Math.cos(t); const s = Math.sin(t); ctx.moveTo(cx + c * r0, cy + s * r0); ctx.lineTo(cx + c * (r0 + 3 * dpr), cy + s * (r0 + 3 * dpr)); }
      ctx.strokeStyle = 'rgba(170,205,255,.22)'; ctx.stroke();
      ctx.beginPath();
      for (let a = 0; a < 360; a += 30) { const t = (a - deg) * RAD - Math.PI / 2; const c = Math.cos(t); const s = Math.sin(t); ctx.moveTo(cx + c * r0, cy + s * r0); ctx.lineTo(cx + c * (r0 + 7 * dpr), cy + s * (r0 + 7 * dpr)); }
      ctx.strokeStyle = 'rgba(190,220,255,.55)'; ctx.stroke();
      if (W > 420) {
        ctx.font = '600 ' + 9.5 * dpr + 'px ' + fontNum; ctx.fillStyle = 'rgba(190,215,255,.5)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let a = 0; a < 360; a += 60) { const t = (a - deg) * RAD - Math.PI / 2; const lon = a > 180 ? 360 - a : a; ctx.fillText(lon + (a === 0 || a === 180 ? '°' : a > 180 ? '°W' : '°E'), cx + Math.cos(t) * (r0 + 16 * dpr), cy + Math.sin(t) * (r0 + 16 * dpr)); }
      }
      // 兩段較亮的弧線
      ctx.lineWidth = 1.6 * dpr; ctx.strokeStyle = 'rgba(150,225,255,.7)'; const r1 = RR * 1.075;
      ctx.beginPath(); ctx.arc(cx, cy, r1, -2.5, -2.05); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, r1, 0.62, 1.07); ctx.stroke();
    }
    function hqMark(now, sy, cyw, sp, cp) {
      if (!hq) return;
      const pr = (p) => { const z1 = p[0] * sy + p[2] * cyw; return [cx + RR * (p[0] * cyw - p[2] * sy), cy - RR * (p[1] * cp - z1 * sp), p[1] * sp + z1 * cp]; };
      const c = pr(hq); if (c[2] < 0.05) return;
      const fade = Math.min(1, (c[2] - 0.05) / 0.2); const moving = spin && !reduced();
      for (let n = 0; n < (moving ? 2 : 1); n++) {
        const ph = moving ? ((now / 2600 + n * 0.5) % 1) : 0.45; const size = 0.022 + ph * 0.06;
        ctx.beginPath(); hqRing.forEach((v, i) => { const q = [hq[0] + v[0] * size, hq[1] + v[1] * size, hq[2] + v[2] * size]; const s = pr(unit(q)); if (i) ctx.lineTo(s[0], s[1]); else ctx.moveTo(s[0], s[1]); }); ctx.closePath();
        ctx.strokeStyle = 'rgba(255,255,255,' + ((1 - ph) * 0.8 * fade).toFixed(3) + ')'; ctx.lineWidth = 1.2 * dpr; ctx.stroke();
      }
      const d = 4.2 * dpr; ctx.globalAlpha = fade; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0b1230'; ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath(); ctx.moveTo(c[0], c[1] - d); ctx.lineTo(c[0] + d, c[1]); ctx.lineTo(c[0], c[1] + d); ctx.lineTo(c[0] - d, c[1]); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    function labels(now, sy, cyw, sp, cp) {
      const dt = Math.min(0.1, (now - (labelT || now)) / 1000); labelT = now;
      const small = W < 340; const fs = (small ? 10.5 : 12) * dpr; const placed = []; const items = [];
      labelAt.forEach((p, i) => { const z1 = p[0] * sy + p[2] * cyw; const z = p[1] * sp + z1 * cp; items.push({ i, z, x: cx + RR * (p[0] * cyw - p[2] * sy), y: cy - RR * (p[1] * cp - z1 * sp) }); });
      items.sort((a, b) => (b.i === sel) - (a.i === sel) || (b.i === hover) - (a.i === hover) || b.z * (0.5 + REGIONS[b.i].w) - a.z * (0.5 + REGIONS[a.i].w));
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      for (const it of items) {
        const info = data.regions[it.i]; const top = info.ranked[0]; let want = 0; let box = null;
        if (top && it.z > 0.18) {
          const co = data.byId[top.id]; const name = tr(small ? info.name.replace('與', '·').slice(0, 5) : info.name); const pct = Math.round(top.share * 100) + '%';
          ctx.font = '700 ' + fs + 'px ' + fontBody; const w1 = ctx.measureText(name).width;
          ctx.font = 'italic 800 ' + (fs * 1.08) + 'px ' + fontNum; const w2 = ctx.measureText(pct).width;
          const pad = 7 * dpr; const ic = fs * 1.25; const w = pad + ic + 3 * dpr + w1 + 5 * dpr + w2 + pad; const h = fs * 1.9;
          box = { x: it.x - w / 2, y: it.y - h / 2, w, h, name, pct, co, w1, ic, pad };
          const hit = placed.some((b) => box.x < b.x + b.w + 3 * dpr && b.x < box.x + box.w + 3 * dpr && box.y < b.y + b.h + 2 * dpr && b.y < box.y + box.h + 2 * dpr);
          if (!hit) { want = Math.min(1, (it.z - 0.18) / 0.22); placed.push(box); }
        }
        labelA[it.i] += (want - labelA[it.i]) * (reduced() || !drawnLabels ? 1 : Math.min(1, dt * 9));
        const a = labelA[it.i]; if (a < 0.02 || !box) continue;
        ctx.globalAlpha = a * (sel >= 0 && sel !== it.i ? 0.45 : 1);
        ctx.fillStyle = 'rgba(8,12,28,.80)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(box.x, box.y, box.w, box.h, box.h / 2.4); else ctx.rect(box.x, box.y, box.w, box.h); ctx.fill();
        ctx.strokeStyle = it.i === sel ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.18)'; ctx.lineWidth = dpr; ctx.stroke();
        ctx.font = fs * 1.02 + 'px "Noto Color Emoji", "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(box.co.icon, box.x + box.pad, it.y + dpr * 0.5);
        ctx.fillStyle = '#eef3ff'; ctx.font = '700 ' + fs + 'px ' + fontBody; ctx.fillText(box.name, box.x + box.pad + box.ic + 3 * dpr, it.y + dpr * 0.5);
        ctx.fillStyle = '#fff'; ctx.font = 'italic 800 ' + (fs * 1.08) + 'px ' + fontNum; ctx.fillText(box.pct, box.x + box.pad + box.ic + 3 * dpr + box.w1 + 5 * dpr, it.y + dpr * 0.5);
        ctx.globalAlpha = 1;
      }
      drawnLabels = true;
    }
    // 左下角的座標讀數
    function readout() {
      if (W < 300) return;
      const lat = pitch / RAD; const lon = ((yaw / RAD + 540) % 360) - 180; const t = Math.abs(lat).toFixed(0).padStart(2, '0') + '°' + (lat >= 0 ? 'N' : 'S') + '  ' + Math.abs(lon).toFixed(0).padStart(3, '0') + '°' + (lon >= 0 ? 'E' : 'W');
      ctx.font = '600 ' + 10.5 * dpr + 'px ' + fontNum; ctx.fillStyle = 'rgba(190,215,255,.55)'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(t, cv.width - 6 * dpr, cv.height - 6 * dpr);
    }

    /* ---------- 迴圈和互動 ---------- */
    const autoTurn = (now) => spin && !reduced() && sel < 0 && !inside && now >= idleUntil;
    function busy(now) { return !!(drag || anim || flips.length || Math.abs(vy) > 1e-4 || Math.abs(vp) > 1e-4 || autoTurn(now) || (spin && !inside && sel < 0 && now < idleUntil)); }
    function frame(now) {
      raf = 0;
      if (!el.isConnected || !visible || (root.document && root.document.hidden)) return;
      const dt = Math.min(0.05, (now - (lastT || now)) / 1000); lastT = now;
      if (anim) {
        const t = Math.min(1, (now - anim.t0) / anim.ms); const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        yaw = anim.y0 + anim.dy * e; pitch = anim.p0 + anim.dp * e; if (t >= 1) anim = null;
      } else if (!drag) {
        if (Math.abs(vy) > 1e-4 || Math.abs(vp) > 1e-4) { yaw += vy * dt; pitch = clampP(pitch + vp * dt); const k = Math.pow(0.05, dt); vy *= k; vp *= k; }
        else if (autoTurn(now)) yaw -= 3.2 * RAD * dt;
      }
      const smooth = drag || anim || flips.length;
      if (smooth || now - lastDraw >= frameGap) {
        lastDraw = now; const t0 = performance.now(); draw(now);
        frameGap = Math.max(31, Math.min(120, frameGap * 0.9 + (performance.now() - t0) * 2.4 * 0.1)); // 慢的裝置自動降低更新率
      }
      if (busy(now)) raf = root.requestAnimationFrame(frame);
    }
    function kick() { if (!raf && el.isConnected) { lastT = 0; raf = root.requestAnimationFrame(frame); } }
    const clampP = (p) => Math.max(-62 * RAD, Math.min(68 * RAD, p));
    function pickAt(e) {
      const rc = cv.getBoundingClientRect(); const sx = ((e.clientX - rc.left) / rc.width * cv.width - cx) / RR; const sv = -((e.clientY - rc.top) / rc.height * cv.height - cy) / RR;
      const q = sx * sx + sv * sv; if (q >= 1) return -1;
      const z2 = Math.sqrt(1 - q); const sp = Math.sin(pitch); const cp = Math.cos(pitch); const sy = Math.sin(yaw); const cyw = Math.cos(yaw);
      const y = sv * cp + z2 * sp; const z1 = -sv * sp + z2 * cp; const x = sx * cyw + z1 * sy; const z = -sx * sy + z1 * cyw;
      let bi = -1; let bd = 0.9985; for (let i = 0; i < N; i++) { const d = x * G.cen[i * 3] + y * G.cen[i * 3 + 1] + z * G.cen[i * 3 + 2]; if (d > bd) { bd = d; bi = i; } }
      return bi >= 0 ? G.reg[bi] : -1;
    }
    function showTip(e) {
      if (hover < 0 || !data) { tip.hidden = true; return; }
      const info = data.regions[hover]; const me = data.companies.find((c) => c.player); const rows = info.ranked.slice(0, 3);
      if (me && !rows.some((x) => x.id === me.id)) { const mine = info.ranked.find((x) => x.id === me.id); rows.push(mine || { id: me.id, share: 0 }); }
      tip.innerHTML = '<b>' + info.name + '</b><span class="ad">已開發 ' + Math.round(info.adoption * 100) + '%</span>' + rows.map((x) => { const c = data.byId[x.id]; return '<div class="' + (c.player ? 'me' : '') + '"><i style="background:' + c.color + '"></i>' + c.icon + ' ' + (c.player ? '你' : c.name) + '<span>' + fmtPct(x.share) + '</span></div>'; }).join('');
      tip.hidden = false;
      const rc = el.getBoundingClientRect(); const tw = tip.offsetWidth; const th = tip.offsetHeight;
      let x = e.clientX - rc.left + 14; let y = e.clientY - rc.top + 14; if (x + tw > rc.width) x -= tw + 28; if (y + th > rc.height) y -= th + 28;
      tip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    }
    cv.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      drag = { x: e.clientX, y: e.clientY, moved: false, lx: e.clientX, ly: e.clientY, lt: performance.now(), touch: e.pointerType !== 'mouse' }; vy = 0; vp = 0; anim = null; hover = -1; tip.hidden = true;
      root.addEventListener('pointermove', onDrag); root.addEventListener('pointerup', onUp); root.addEventListener('pointercancel', onUp); kick();
    });
    function onDrag(e) {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
      drag.moved = true;
      const rc = cv.getBoundingClientRect(); const k = 1 / (RR / cv.width * rc.width); const now = performance.now(); const dx = e.clientX - drag.lx; const dy = e.clientY - drag.ly; const dt = Math.max(1, now - drag.lt) / 1000;
      yaw -= dx * k; if (!drag.touch) pitch = clampP(pitch + dy * k);
      vy = -dx * k / dt * 0.6; vp = drag.touch ? 0 : dy * k / dt * 0.6; drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now; kick();
    }
    function onUp(e) {
      root.removeEventListener('pointermove', onDrag); root.removeEventListener('pointerup', onUp); root.removeEventListener('pointercancel', onUp);
      const d = drag; drag = null; idleUntil = performance.now() + 2600;
      if (d && !d.moved && e.type === 'pointerup') { vy = 0; vp = 0; const r = pickAt(e); if (opts.onPick) opts.onPick(r >= 0 ? REGIONS[r].id : null); }
      if (performance.now() - (d ? d.lt : 0) > 90) { vy = 0; vp = 0; }
      kick();
    }
    cv.addEventListener('pointermove', (e) => {
      if (drag || e.pointerType !== 'mouse') return;
      inside = true;
      const r = pickAt(e); if (r !== hover) { hover = r; draw(performance.now()); } showTip(e);
    });
    cv.addEventListener('pointerleave', () => { inside = false; hover = -1; tip.hidden = true; draw(performance.now()); kick(); });
    if (root.IntersectionObserver) { const io = new root.IntersectionObserver((en) => { visible = en[en.length - 1].isIntersecting; if (visible) kick(); }); io.observe(el); }
    if (root.ResizeObserver) { const ro = new root.ResizeObserver(() => { if (resize()) { draw(performance.now()); } }); ro.observe(el); }
    if (root.document) root.document.addEventListener('visibilitychange', () => { if (!root.document.hidden) kick(); });
    // 字型晚到時重畫一次，地球沒在轉也會換上正確的字
    if (root.document && root.document.fonts && root.document.fonts.addEventListener) root.document.fonts.addEventListener('loadingdone', () => { if (el.isConnected) draw(performance.now()); });

    return {
      el,
      mount(slot) { if (el.parentNode !== slot) { slot.appendChild(el); } resize(); draw(performance.now()); kick(); },
      setData(m, selId) {
        const fresh = !data || m.key !== compKey; data = m;
        if (fresh) {
          setCompanies(); setPalette(); owner.fill(-1); flips.length = 0;
          if (hq) { pitch = clampP(Math.asin(hq[1]) * 0.55 + 6 * RAD); yaw = Math.atan2(hq[0], hq[2]); }
          compKey = m.key;
        }
        let changed = false; for (let i = 0; i < REGIONS.length; i++) if (solveRegion(i, m, !fresh)) changed = true;
        if (changed) rebuildMyEdges(m);
        sel = selId && REGION_IDX[selId] !== undefined ? REGION_IDX[selId] : -1;
        if (W) draw(performance.now());
        kick();
      },
      focus(id) {
        const i = REGION_IDX[id]; if (i === undefined) return; const a = REGIONS[i].at; const ty = a[1] * RAD; const tp = clampP(a[0] * 0.8 * RAD); let dy = (ty - yaw) % TAU; if (dy > Math.PI) dy -= TAU; if (dy < -Math.PI) dy += TAU;
        vy = 0; vp = 0;
        if (reduced()) { yaw += dy; pitch = tp; draw(performance.now()); return; }
        anim = { t0: performance.now(), ms: 850, y0: yaw, dy, p0: pitch, dp: tp - pitch }; kick();
      },
      setSpin(v) { spin = v; idleUntil = 0; kick(); },
      draw: () => draw(performance.now()),
      // 測試用：直接跑到指定視角
      view(lat, lon) { pitch = clampP(lat * RAD); yaw = lon * RAD; anim = null; vy = 0; vp = 0; draw(performance.now()); },
    };
  }

  /* ---------- 面板 ---------- */
  function fmtPct(x) { const p = x * 100; return (p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)) + '%'; }
  // o：{ sel, spin, esc, money, ym }
  function panel(m, o) {
    const e = o.esc; const me = m.companies.find((c) => c.player);
    const rank = m.world.indexOf(me) + 1; const anyOpen = m.regions.some((r) => r.adoption < 1);
    const bar = m.world.filter((c) => c.share > 0.001).map((c) => `<i class="${c.share < 0.13 ? 'sm' : ''}" style="flex:${c.share.toFixed(4)} 1 0;--c:${c.color}"${c.share > 0.075 ? ` data-t="${c.icon} ${fmtPct(c.share)}"` : ''}></i>`).join('');
    const chips = m.world.filter((c) => c.player || c.share > 0).map((c) => `<span class="gb-chip${c.player ? ' me' : ''}"><i style="--c:${c.color}"></i>${c.icon} ${e(c.player ? '你' : c.name)} <b class="num">${fmtPct(c.share)}</b></span>`).join('') + (anyOpen ? '<span class="gb-chip open"><i></i>尚未開發</span>' : '') + (me.pos ? '<span class="gb-chip hq"><i></i>你的總部</span>' : '');
    const rows = m.regions.slice().sort((a, b) => b.w - a.w).map((r) => {
      const top = r.ranked[0]; const co = top && m.byId[top.id]; const on = o.sel === r.id; const mineLead = co && co.player;
      const stack = r.ranked.filter((x) => x.share > 0.01).map((x) => `<i style="flex:${x.share.toFixed(3)} 1 0;background:${m.byId[x.id].color}"></i>`).join('');
      let more = '';
      if (on) {
        const mine = r.ranked.find((x) => x.id === me.id); const gap = top ? top.share - (mine ? mine.share : 0) : 0;
        more = `<div class="gb-rd"><div class="meta"><span>本週規模 <b class="num">${o.money(r.value)}</b></span><span>已開發 <b class="num">${Math.round(r.adoption * 100)}%</b></span></div>
          ${r.ranked.slice(0, 5).map((x) => { const c = m.byId[x.id]; return `<div class="ln${c.player ? ' me' : ''}"><i style="background:${c.color}"></i><span>${c.icon} ${e(c.player ? '你' : c.name)}</span><b class="num">${fmtPct(x.share)}</b></div>`; }).join('')}
          ${mineLead ? '<p>你是這裡的第一名。</p>' : mine ? `<p>再拿 <b class="num">${(gap * 100).toFixed(1)}</b> 個百分點就能領先。</p>` : '<p>你還沒有打進這個市場。</p>'}</div>`;
      }
      return `<li class="${on ? 'on' : ''}${mineLead ? ' mine' : ''}"><button class="gb-r" data-act="gb-region" data-id="${r.id}" aria-pressed="${on}"><span class="nm">${r.name}</span><span class="st" aria-hidden="true">${stack}</span><span class="ld">${co ? co.icon : ''}<b class="num">${top ? fmtPct(top.share) : '—'}</b></span></button>${more}</li>`;
    }).join('');
    // 前線：我方最有機會翻盤的地區
    let front = '';
    const chase = m.regions.filter((r) => r.leader && r.leader !== me.id && r.ranked.some((x) => x.id === me.id)).map((r) => ({ r, gap: r.ranked[0].share - r.ranked.find((x) => x.id === me.id).share })).sort((a, b) => a.gap - b.gap)[0];
    if (me.share <= 0) front = '發布第一個模型，你的版圖才會出現在地球上。';
    else if (me.leads >= m.regions.length) front = '全球十個地區，你全都領先。';
    else if (chase) front = `最接近翻盤：<b>${chase.r.name}</b>，差 <b class="num">${(chase.gap * 100).toFixed(1)}</b> 個百分點追上${e(m.byId[chase.r.leader].name)}。`;
    const summary = m.regions.map((r) => r.name + (r.leader ? '由' + (m.byId[r.leader].player ? '你' : m.byId[r.leader].name) + '領先' : '尚未開發')).join('，');
    return `<section class="gb" aria-label="全球佔領圖">
      <header class="gb-hd"><div class="tt"><span class="cap">GLOBAL MARKET</span><h3>全球佔領圖</h3></div><div class="gb-bar" role="img" aria-label="全球市佔：${m.world.map((c) => e(c.player ? '你' : c.name) + ' ' + fmtPct(c.share)).join('、')}">${bar}</div><span class="dt num">${e(o.ym || '')}</span></header>
      <div class="gb-body">
        <div class="gb-stage">
          <div id="gb-slot" class="gb-slot" role="img" aria-label="地球佔領圖。${e(summary)}。"></div>
          <div class="gb-me"><span class="l">你的全球市佔</span><b class="num">${(me.share * 100).toFixed(1)}<small>%</small></b><span class="s">${me.share > 0 ? `世界第 ${rank} · 領先 ${me.leads} 區` : '還沒有模型上市'}</span></div>
          <button class="gb-spin" data-act="gb-spin" aria-pressed="${!!o.spin}" title="${o.spin ? '停止自動旋轉' : '開始自動旋轉'}" aria-label="自動旋轉">${o.spin ? '❚❚' : '▶'}</button>
        </div>
        <div class="gb-side">
          <div class="gb-chips">${chips}</div>
          <ol class="gb-list">${rows}</ol>
          ${front ? `<p class="gb-front">${front}</p>` : ''}
        </div>
      </div>
      <p class="gb-note">拖曳可以轉動地球，點地區看細節。各地區市佔由各市場的市佔、當地需求和主場優勢推算；地圖為示意，不代表實際疆界。</p>
    </section>`;
  }

  root.ME_GLOBE = { REGIONS, HOMES, CITY_POS, market, create, panel, buildGeo };
})(typeof window !== 'undefined' ? window : globalThis);

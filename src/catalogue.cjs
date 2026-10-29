'use strict';

// Every venue and cultural score here is invented solely to exercise the workflow.
const catalogue = Object.freeze({
  source: 'synthetic',
  label: '合成演示数据；未接通 Qloo、天气或地图服务',
  city: '虚构街区',
  start: { x: 30, y: 70 },
  original: ['A0', 'B0', 'C0'],
  themes: [
    { id: 'city-memory', name: '城市记忆', seed: '虚构影片《北岸来信》' },
    { id: 'indie-music', name: '独立音乐', seed: '虚构艺人“慢速列车”' },
    { id: 'screen-story', name: '影像叙事', seed: '虚构影片《街角之后》' }
  ],
  venues: [
    { id: 'A0', stage: 0, name: '光影庭院', kind: '露天影像展', tags: ['旧城影像', '城市记忆'], indoor: false, cost: 25, duration: 40, open: 720, close: 960, x: 110, y: 150, affinity: [94, 60, 96] },
    { id: 'A1', stage: 0, name: '城市记忆室', kind: '室内微型展', tags: ['地方档案', '城市记忆'], indoor: true, cost: 10, duration: 30, open: 780, close: 1020, x: 140, y: 270, affinity: [90, 55, 80] },
    { id: 'A2', stage: 0, name: '唱片回声屋', kind: '室内声音展', tags: ['独立唱片', '地方声音'], indoor: true, cost: 20, duration: 35, open: 810, close: 1050, x: 60, y: 370, affinity: [76, 96, 65] },
    { id: 'B0', stage: 1, name: '胶片小馆', kind: '室内影像体验', tags: ['城市纪录', '影像叙事'], indoor: true, cost: 35, duration: 50, open: 780, close: 960, x: 340, y: 140, affinity: [92, 62, 95] },
    { id: 'B1', stage: 1, name: '听觉档案室', kind: '室内听觉体验', tags: ['城市声景', '声音档案'], indoor: true, cost: 15, duration: 35, open: 780, close: 1050, x: 320, y: 290, affinity: [89, 94, 72] },
    { id: 'B2', stage: 1, name: '街区放映间', kind: '室内短片展', tags: ['地方短片', '影像叙事'], indoor: true, cost: 20, duration: 30, open: 840, close: 1020, x: 390, y: 390, affinity: [84, 57, 98] },
    { id: 'C0', stage: 2, name: '河岸声场', kind: '露天声音装置', tags: ['河岸记忆', '城市声景'], indoor: false, cost: 30, duration: 40, open: 780, close: 1080, x: 560, y: 170, affinity: [93, 92, 77] },
    { id: 'C1', stage: 2, name: '街角阅读间', kind: '室内主题阅读', tags: ['街区口述史', '地方文本'], indoor: true, cost: 0, duration: 25, open: 780, close: 1080, x: 570, y: 310, affinity: [86, 52, 75] },
    { id: 'C2', stage: 2, name: '回声排练厅', kind: '室内音乐体验', tags: ['独立音乐', '空间声音'], indoor: true, cost: 15, duration: 30, open: 870, close: 1080, x: 520, y: 420, affinity: [73, 98, 64] }
  ]
});

module.exports = { catalogue };

// Generated from src/planner.cjs. All catalogue facts are synthetic.
(() => {
  'use strict';
  const catalogue = {"source":"synthetic","label":"合成演示数据；未接通 Qloo、天气或地图服务","city":"虚构街区","start":{"x":30,"y":70},"original":["A0","B0","C0"],"themes":[{"id":"city-memory","name":"城市记忆","seed":"虚构影片《北岸来信》"},{"id":"indie-music","name":"独立音乐","seed":"虚构艺人“慢速列车”"},{"id":"screen-story","name":"影像叙事","seed":"虚构影片《街角之后》"}],"venues":[{"id":"A0","stage":0,"name":"光影庭院","kind":"露天影像展","tags":["旧城影像","城市记忆"],"indoor":false,"cost":25,"duration":40,"open":720,"close":960,"x":110,"y":150,"affinity":[94,60,96]},{"id":"A1","stage":0,"name":"城市记忆室","kind":"室内微型展","tags":["地方档案","城市记忆"],"indoor":true,"cost":10,"duration":30,"open":780,"close":1020,"x":140,"y":270,"affinity":[90,55,80]},{"id":"A2","stage":0,"name":"唱片回声屋","kind":"室内声音展","tags":["独立唱片","地方声音"],"indoor":true,"cost":20,"duration":35,"open":810,"close":1050,"x":60,"y":370,"affinity":[76,96,65]},{"id":"B0","stage":1,"name":"胶片小馆","kind":"室内影像体验","tags":["城市纪录","影像叙事"],"indoor":true,"cost":35,"duration":50,"open":780,"close":960,"x":340,"y":140,"affinity":[92,62,95]},{"id":"B1","stage":1,"name":"听觉档案室","kind":"室内听觉体验","tags":["城市声景","声音档案"],"indoor":true,"cost":15,"duration":35,"open":780,"close":1050,"x":320,"y":290,"affinity":[89,94,72]},{"id":"B2","stage":1,"name":"街区放映间","kind":"室内短片展","tags":["地方短片","影像叙事"],"indoor":true,"cost":20,"duration":30,"open":840,"close":1020,"x":390,"y":390,"affinity":[84,57,98]},{"id":"C0","stage":2,"name":"河岸声场","kind":"露天声音装置","tags":["河岸记忆","城市声景"],"indoor":false,"cost":30,"duration":40,"open":780,"close":1080,"x":560,"y":170,"affinity":[93,92,77]},{"id":"C1","stage":2,"name":"街角阅读间","kind":"室内主题阅读","tags":["街区口述史","地方文本"],"indoor":true,"cost":0,"duration":25,"open":780,"close":1080,"x":570,"y":310,"affinity":[86,52,75]},{"id":"C2","stage":2,"name":"回声排练厅","kind":"室内音乐体验","tags":["独立音乐","空间声音"],"indoor":true,"cost":15,"duration":30,"open":870,"close":1080,"x":520,"y":420,"affinity":[73,98,64]}]};
  'use strict';

function inputError(message) {
  const error = new Error(message);
  error.code = 'INVALID_SCENARIO';
  return error;
}

function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw inputError(`${name} 必须是 ${min}–${max} 的整数`);
  return value;
}

function normalizeScenario(value, catalogue) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw inputError('需要情境对象');
  const theme = integer(value.theme ?? 0, 'theme', 0, catalogue.themes.length - 1);
  const delay = integer(value.delay ?? 0, 'delay', 0, 180);
  const budget = integer(value.budget ?? 100, 'budget', 0, 10000);
  const end = integer(value.end ?? 1080, 'end', 780, 1440);
  if (typeof value.rain !== 'boolean' && value.rain !== undefined) throw inputError('rain 必须是布尔值');
  const closed = value.closed ?? null;
  if (closed !== null && !catalogue.venues.some(v => v.id === closed)) throw inputError('closed 地点不存在');
  return { theme, delay, budget, end, rain: value.rain ?? false, closed };
}

function validateCatalogue(catalogue) {
  if (!catalogue || catalogue.source !== 'synthetic') throw inputError('当前仅支持已标明来源的合成演示目录');
  if (!Array.isArray(catalogue.original) || catalogue.original.length !== 3) throw inputError('原路线须有三站');
  for (const id of catalogue.original) if (!catalogue.venues.some(v => v.id === id)) throw inputError('原路线地点缺失');
  for (const stage of [0, 1, 2]) if (!catalogue.venues.some(v => v.stage === stage)) throw inputError('每个阶段都须有候选');
}

function travel(a, b, rain) {
  const base = Math.ceil((Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) / 30) + 5;
  return rain ? Math.ceil(base * 1.4) : base;
}

function evaluate(venues, scenario, catalogue) {
  let time = 780 + scenario.delay;
  let cost = 0;
  let walking = 0;
  let waiting = 0;
  let previous = catalogue.start;
  const visits = [];
  for (const venue of venues) {
    const leg = travel(previous, venue, scenario.rain);
    walking += leg;
    time += leg;
    const arrival = time;
    const wait = Math.max(0, venue.open - time);
    waiting += wait;
    time += wait;
    const start = time;
    time += venue.duration;
    cost += venue.cost;
    visits.push({ id: venue.id, name: venue.name, arrival, start, leave: time, leg, wait,
      checks: { opening: start >= venue.open && time <= venue.close,
        closure: venue.id !== scenario.closed, weather: !scenario.rain || venue.indoor } });
    previous = venue;
  }
  const checks = {
    budget: cost <= scenario.budget,
    time: time <= scenario.end,
    opening: visits.every(v => v.checks.opening),
    closure: visits.every(v => v.checks.closure),
    weather: visits.every(v => v.checks.weather)
  };
  const ids = venues.map(v => v.id);
  const culturalScore = Math.round(venues.reduce((sum, v) => sum + v.affinity[scenario.theme], 0) / venues.length);
  const changes = ids.filter((id, i) => id !== catalogue.original[i]).length;
  return { ids, visits, cost, end: time, walking, waiting, checks,
    feasible: Object.values(checks).every(Boolean), culturalScore, changes,
    utility: culturalScore - changes * 2 };
}

function plan(rawScenario, catalogue) {
  validateCatalogue(catalogue);
  const scenario = normalizeScenario(rawScenario, catalogue);
  const byId = new Map(catalogue.venues.map(v => [v.id, v]));
  const original = evaluate(catalogue.original.map(id => byId.get(id)), scenario, catalogue);
  const all = [];
  for (const a of catalogue.venues.filter(v => v.stage === 0))
    for (const b of catalogue.venues.filter(v => v.stage === 1))
      for (const c of catalogue.venues.filter(v => v.stage === 2))
        all.push(evaluate([a, b, c], scenario, catalogue));
  const feasible = all.filter(route => route.feasible).sort((a, b) =>
    b.utility - a.utility || a.end - b.end || a.cost - b.cost || a.ids.join().localeCompare(b.ids.join()));
  return { status: feasible.length ? 'ok' : 'no-solution', source: catalogue.source,
    sourceLabel: catalogue.label, scenario, original, routes: feasible.slice(0, 3),
    examined: all.length, feasibleCount: feasible.length, rejected: all.length - feasible.length };
}



  window.RainRouteStatic = Object.freeze({
    catalogue,
    runPlan(scenario) {
      const result = plan(scenario, catalogue);
      return {
        ...result,
        explanation: result.status === 'no-solution'
          ? '当前硬约束下没有三站可行路线，请调整条件后重试。'
          : `找到 ${result.feasibleCount} 条满足所有硬约束的合成路线，展示前 ${result.routes.length} 条。`,
        trace: ['resolve:synthetic-theme', 'discover:synthetic-catalogue',
          'verify:synthetic-demo-only', 'replan:hard-constraints', 'explain:source-bound'],
        agentFramework: 'Static planner preview'
      };
    }
  });
})();

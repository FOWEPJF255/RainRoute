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

module.exports = { plan, travel, normalizeScenario };

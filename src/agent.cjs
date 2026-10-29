'use strict';

const { StateGraph, Annotation, START, END } = require('@langchain/langgraph');
const { catalogue } = require('./catalogue.cjs');
const { plan, normalizeScenario } = require('./planner.cjs');

const AgentState = Annotation.Root({
  mode: Annotation(),
  scenario: Annotation(),
  entityId: Annotation(),
  discovery: Annotation(),
  result: Annotation(),
  blocked: Annotation(),
  explanation: Annotation(),
  trace: Annotation({ reducer: (previous, next) => previous.concat(next), default: () => [] })
});

function createAgent(qlooClient) {
  return new StateGraph(AgentState)
    .addNode('resolve', async state => {
      if (state.mode === 'demo') return { scenario: normalizeScenario(state.scenario || {}, catalogue), trace: ['resolve:synthetic-theme'] };
      if (state.mode === 'live') return { trace: ['resolve:public-entity-id'] };
      const error = new Error('mode 须为 demo 或 live');
      error.code = 'INVALID_MODE';
      throw error;
    })
    .addNode('discover', async state => {
      if (state.mode === 'demo') return { discovery: { source: 'synthetic' }, trace: ['discover:synthetic-catalogue'] };
      if (!qlooClient) {
        const error = new Error('未配置 Qloo API Key');
        error.code = 'QLOO_KEY_MISSING';
        throw error;
      }
      const data = await qlooClient.placeInsights(state.entityId);
      return { discovery: { source: 'qloo', data }, trace: ['discover:qloo-place-insights'] };
    })
    .addNode('verify', async state => state.mode === 'demo'
      ? { trace: ['verify:synthetic-demo-only'] }
      : { blocked: 'VENUE_FACTS_UNVERIFIED', trace: ['verify:venue-facts-missing'] })
    .addNode('replan', async state => ({ result: plan(state.scenario, catalogue), trace: ['replan:hard-constraints'] }))
    .addNode('explain', async state => ({
      explanation: state.blocked
        ? 'Qloo 文化候选已获取；营业、费用、步行时间和天气尚未独立核验，不能生成真实可行路线。'
        : state.result.status === 'no-solution'
          ? '当前硬约束下没有三站可行路线，请调整条件后重试。'
          : `找到 ${state.result.feasibleCount} 条满足所有硬约束的合成路线，展示前 ${state.result.routes.length} 条。`,
      trace: ['explain:source-bound']
    }))
    .addEdge(START, 'resolve')
    .addEdge('resolve', 'discover')
    .addEdge('discover', 'verify')
    .addConditionalEdges('verify', state => state.blocked ? 'explain' : 'replan')
    .addEdge('replan', 'explain')
    .addEdge('explain', END)
    .compile();
}

async function runAgent({ mode, scenario, entityId, qlooClient } = {}) {
  const state = await createAgent(qlooClient).invoke({ mode, scenario, entityId });
  if (state.blocked) return { status: 'blocked', reason: state.blocked, source: 'qloo',
    explanation: state.explanation, trace: state.trace, agentFramework: 'LangGraph' };
  return { ...state.result, explanation: state.explanation,
    trace: state.trace, agentFramework: 'LangGraph' };
}

module.exports = { runAgent };

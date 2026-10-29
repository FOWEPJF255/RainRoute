'use strict';

const $ = id => document.getElementById(id);
let catalogue;
let result;
let scenario;
let chosen = 0;
let dirty = false;
let accepted = null;
let activePreset = 'rain';
let requestNumber = 0;
const checkRows = [
  ['weather', '天气适配', '下雨时所有节点须为室内'],
  ['closure', '临时关闭', '所选节点不在本次关闭清单中'],
  ['opening', '营业窗口', '每站体验完整落在合成营业窗口内'],
  ['time', '结束时间', '含步行与等待，结束不晚于指定时刻'],
  ['budget', '总预算', '三站体验合计不超过输入预算']
];

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function clock(minutes) { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
function venue(id) { return catalogue.venues.find(v => v.id === id); }
function currentRoute() { return result?.routes?.[chosen] || null; }
function signature(value) { return JSON.stringify(value); }
function setSelect(id, value) { $(id).value = String(value); }
function readScenario() {
  const budgetRaw = $('budget').value.trim();
  if (!/^\d+$/.test(budgetRaw) || Number(budgetRaw) > 10000) throw new Error('预算须为 0–10000 的整数。');
  return { theme: Number($('theme').value), delay: Number($('delay').value), end: Number($('end').value),
    budget: Number(budgetRaw), closed: $('closed').value || null, rain: $('rain').checked };
}
function setControls(values, fault = 'none') {
  setSelect('theme', values.theme ?? 0);
  setSelect('delay', values.delay ?? 0);
  setSelect('end', values.end ?? 1020);
  setSelect('budget', values.budget ?? 100);
  setSelect('closed', values.closed ?? '');
  $('rain').checked = values.rain ?? false;
  setSelect('fault', fault);
}
function markDirty() {
  if (!result) return;
  dirty = true;
  activePreset = '';
  document.querySelectorAll('[data-preset]').forEach(button => button.classList.remove('active'));
  $('dirty-notice').hidden = false;
  document.querySelectorAll('.branch-option').forEach(button => { button.disabled = true; });
  setAdoptState();
}
function applyPreset(name) {
  const defaults = { theme: 0, rain: false, delay: 0, end: 1020, budget: 100, closed: null };
  const presets = {
    clear: {}, rain: { rain: true }, late: { delay: 90, closed: 'B0' },
    closed: { closed: 'B0' }, budget: { rain: true, closed: 'A0', budget: 15, end: 960 },
    mixed: { rain: true, delay: 90 }, fault: { rain: true }
  };
  setControls({ ...defaults, ...presets[name] }, name === 'fault' ? 'timeout' : 'none');
  activePreset = name;
  document.querySelectorAll('[data-preset]').forEach(button => button.classList.toggle('active', button.dataset.preset === name));
  runPlan();
}

async function runPlan() {
  let next;
  try { next = readScenario(); }
  catch (error) { $('input-error').textContent = error.message; return; }
  $('input-error').textContent = '';
  const fault = $('fault').value;
  const thisRequest = ++requestNumber;
  $('replan').disabled = true;
  $('replan').textContent = '正在核对路线…';
  try {
    let payload;
    if (window.RainRouteStatic) {
      payload = window.RainRouteStatic.runPlan(next);
    } else {
      const response = await fetch('/api/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'demo', scenario: next }) });
      payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || `HTTP ${response.status}`);
    }
    if (thisRequest !== requestNumber) return;
    scenario = next;
    result = fault === 'none' ? payload : { ...payload, status: 'simulated-fault', routes: [], feasibleCount: 0,
      examined: 0, trace: ['resolve:synthetic-theme', `discover:simulated-${fault}`, 'verify:no-candidates', 'explain:source-bound'] };
    result.fault = fault;
    chosen = 0;
    dirty = false;
    $('dirty-notice').hidden = true;
    render();
  } catch (error) {
    if (thisRequest !== requestNumber) return;
    $('input-error').textContent = `无法计算路线：${error.message}。旧结果仅供对照。`;
    dirty = true;
    $('dirty-notice').hidden = false;
    setAdoptState();
  } finally {
    if (thisRequest === requestNumber) { $('replan').disabled = false; $('replan').textContent = '应用变化并重规划'; }
  }
}

function renderHero() {
  const route = currentRoute();
  const bad = result.status === 'no-solution';
  const fault = result.status === 'simulated-fault';
  const title = fault ? '暂时取不到文化候选' : bad ? '当前条件下走不通了' :
    scenario.delay === 90 && scenario.closed === 'B0' ? '迟到 90 分钟，胶片小馆又关闭了' :
      scenario.rain ? '下雨了，还能怎样走？' : scenario.closed ? '节点关闭了，路线怎么变？' : '这条文化路线可以怎么走？';
  $('hero-title').textContent = title;
  const eventText = `${scenario.rain ? '下雨' : '晴天'}、${scenario.delay ? `迟到 ${scenario.delay} 分钟` : '未迟到'}、预算 ¥${scenario.budget}、最晚 ${clock(scenario.end)}${scenario.closed ? `、${venue(scenario.closed).name}关闭` : ''}`;
  $('hero-description').textContent = fault
    ? `模拟候选检索${result.fault === 'timeout' ? '超时' : result.fault === 'auth' ? '未授权' : '空结果'}；本轮未生成任何新分支，原路线仅供对照。`
    : bad ? `${eventText} 同时生效。${result.examined} 条三站组合均不可行，本轮不提供替代路线。`
      : `${eventText}。${result.routes.length} 条替代分支满足全部硬约束；文化主题仍按合成指数排序。`;
  const status = fault ? '候选检索未完成' : bad ? '没有可行的三站路线' : '可以继续走';
  $('hero-result').className = `hero-result${fault ? ' warn' : bad ? ' error' : ''}`;
  $('hero-result').innerHTML = `<strong>${status}</strong><p>${fault ? '没有联网重试或伪造服务返回。可清除故障模拟后重试。' : bad ? '可调整预算、结束时间或关闭条件后重试；不会静默删站或编造营业信息。' : `${result.examined} 条组合中 ${result.feasibleCount} 条可行，展示前 ${result.routes.length} 条分支。`}</p>`;
  $('theme-note').textContent = `${catalogue.themes[scenario.theme].name} · ${catalogue.themes[scenario.theme].seed}（合成文化种子）`;
}

function mapPosition(id) {
  const item = venue(id);
  return { x: [108, 324, 540][item.stage], y: [82, 200, 320][Number(id[1])] };
}
function mapPoints(ids) { return [{ x: 30, y: 35 }, ...ids.map(mapPosition)].map(point => `${point.x},${point.y}`).join(' '); }
function renderMap() {
  const route = currentRoute();
  const cells = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++)
    cells.push(`<rect x="${14 + col * 161}" y="${18 + row * 123}" width="145" height="108" rx="8" fill="${(row + col) % 2 ? '#E9EEE6' : '#E5EBE1'}"/>`);
  const nodeShapes = catalogue.venues.map(item => {
    const point = mapPosition(item.id);
    const selected = route?.ids.includes(item.id);
    const blocked = scenario.closed === item.id || scenario.rain && !item.indoor;
    const fill = selected ? 'var(--rr-route-current)' : 'white';
    const stroke = blocked ? 'var(--rr-status-error)' : selected ? 'var(--rr-route-current)' : 'var(--rr-line-strong)';
    const label = blocked ? scenario.closed === item.id ? '已关闭' : '雨天排除' : '';
    return `<g class="map-node" data-venue="${item.id}" role="button" tabindex="0" aria-label="查看${escapeHtml(item.name)}，${blocked ? label : '合成地点'}">
      <title>${escapeHtml(item.name)} · ${escapeHtml(item.kind)} · 合成数据</title>
      <circle class="node-circle" cx="${point.x}" cy="${point.y}" r="${selected ? 16 : 13}" fill="${fill}" stroke="${stroke}" stroke-width="${blocked ? 2.5 : 2}"/>
      ${blocked ? `<path d="M${point.x - 8},${point.y - 8}l16,16" stroke="var(--rr-status-error)" stroke-width="2"/>` : `<text class="map-node-id" x="${point.x}" y="${point.y + 1}" fill="${selected ? 'white' : 'var(--rr-ink-primary)'}">${item.id}</text>`}
      <text class="map-node-name" x="${point.x}" y="${point.y + 33}">${escapeHtml(item.name)}</text>
      ${label ? `<text class="map-node-sub" x="${point.x}" y="${point.y + 47}">${label}</text>` : ''}
    </g>`;
  }).join('');
  $('route-map').innerHTML = `<title>RainRoute 合成街区示意</title><desc>虚线表示原路线，实线表示当前替代分支；无解或故障时没有替代路线。</desc>${cells.join('')}
    <polyline class="route-original" points="${mapPoints(catalogue.original)}"/>
    ${route ? `<polyline class="route-current" points="${mapPoints(route.ids)}"/>` : ''}
    <circle cx="30" cy="35" r="7" fill="var(--rr-ink-primary)"/><text class="map-start-label" x="30" y="16" font-size="10" fill="var(--rr-ink-primary)">出发 ${clock(780 + scenario.delay)}</text>
    ${nodeShapes}`;
  $('map-title').textContent = route ? '原路线与替代分支' : '原路线（仅作对照）';
  $('route-map').setAttribute('aria-label', route ? `原路线 ${catalogue.original.join('、')}；当前分支 ${route.ids.join('、')}` : '仅显示原路线，本轮无可采纳分支');
}

function renderBranches() {
  const route = currentRoute();
  $('branch-title').textContent = route ? '选择一个替代分支' : result.status === 'simulated-fault' ? '候选检索故障' : '当前条件下没有三站可行路线';
  $('branch-count').textContent = result.status === 'simulated-fault' ? '本轮未生成分支' : `已检查 ${result.examined} 条组合，${result.feasibleCount} 条可行`;
  if (route) {
    $('branches').className = 'branch-list';
    $('branches').innerHTML = result.routes.map((item, index) => `<button class="branch-option" type="button" data-branch="${index}" aria-pressed="${index === chosen}">
      <strong>分支 ${String.fromCharCode(65 + index)} · ${item.ids.map(id => escapeHtml(venue(id).name)).join(' → ')}</strong>
      <span class="branch-metrics">¥${item.cost} · ${clock(item.end)} 结束 · 更换 ${item.changes} 站 · 全部硬约束通过</span>
      <span>主题匹配指数 ${item.culturalScore}/100（合成） · 非个人偏好概率</span></button>`).join('');
    return;
  }
  $('branches').className = '';
  $('branches').innerHTML = result.status === 'simulated-fault' ? faultPanel() : noSolutionPanel();
}

function noSolutionPanel() {
  const failures = [];
  if (!result.original.checks.budget) failures.push(['预算不足', `原路线三站合计 ¥${result.original.cost}；当前预算 ¥${scenario.budget}。`]);
  if (!result.original.checks.time) failures.push(['无法按时结束', `原路线 ${clock(result.original.end)} 结束；最晚 ${clock(scenario.end)}。`]);
  if (!result.original.checks.opening) failures.push(['营业窗口冲突', '原路线有节点无法在合成营业时间内完成体验。']);
  if (!result.original.checks.closure || !result.original.checks.weather) failures.push(['节点不可用', `${scenario.closed ? venue(scenario.closed).name + ' 已关闭；' : ''}${scenario.rain ? '露天节点在雨天被排除。' : ''}`]);
  return `<div class="no-solution"><h3>当前条件下没有三站可行路线</h3><p>不会静默删站、放宽预算或编造营业信息。原路线仅供对照，不作为本次推荐。</p>
    <div class="conflicts">${failures.map(([title, detail]) => `<div class="conflict"><strong>${escapeHtml(title)}</strong>${escapeHtml(detail)}</div>`).join('')}</div>
    <div class="adjust-box"><strong>可以这样调整后重试</strong><div class="adjust-actions"><button type="button" data-adjust="budget">预算提高到 ¥25</button><button type="button" data-adjust="end">最晚结束延到 18:00</button><button type="button" data-adjust="rain">取消下雨</button><button type="button" data-adjust="closed">清除临时关闭</button></div></div>
    <p>本轮未生成任何可行分支，因此没有可采纳对象。</p></div>`;
}
function faultPanel() {
  const messages = { timeout: ['超时（模拟 504）', '模拟请求 8 秒未返回、达到两次重试上限；未实际联网。'], auth: ['未授权（模拟 401）', '应检查本人 Key 与赛事环境，不借用其他凭证。'], empty: ['空结果（模拟 200）', '候选层没有返回地点，应调整文化主题或查询范围。'] };
  return `<div class="fault-panel"><h3>暂时无法取得文化候选</h3><p>这是故障注入演示。本轮未生成新分支，也没有把旧路线当作可行方案。</p>
    <div class="fault-types">${Object.entries(messages).map(([key, pair]) => `<div class="fault-type${result.fault === key ? ' active' : ''}"><strong>${pair[0]}</strong>${pair[1]}</div>`).join('')}</div>
    <div class="adjust-box"><strong>可以这样继续</strong><div class="adjust-actions"><button type="button" data-adjust="retry">清除模拟故障并重试</button><button type="button" data-adjust="theme">换一个文化主题</button></div></div></div>`;
}

function changeReason(oldVenue, newVenue, oldVisit) {
  if (oldVenue.id === newVenue.id) return '保留原节点，减少不必要的变更。';
  const reasons = [];
  if (scenario.rain && !oldVenue.indoor) reasons.push('原节点露天，雨天不可用');
  if (scenario.closed === oldVenue.id) reasons.push('原节点临时关闭');
  if (!oldVisit.checks.opening) reasons.push('原节点无法在营业窗口内完成');
  if (!result.original.checks.time) reasons.push('原计划无法按时结束');
  if (!result.original.checks.budget) reasons.push('原计划超预算');
  return `${reasons.join('；') || '与其他节点组合后更满足主题及硬约束'}。`;
}
function renderEvidence() {
  const route = currentRoute();
  if (!route) {
    $('explanation').innerHTML = `<p class="subtle">${result.status === 'simulated-fault' ? '候选层未返回可用结果，本轮没有可解释的替换理由。' : '本轮没有可供采纳的新路线。保留文化主题不能抵消任何硬约束。'}</p>`;
  } else {
    $('explanation').innerHTML = route.ids.map((id, index) => {
      const item = venue(id), oldItem = venue(catalogue.original[index]);
      return `<div class="change-card"><strong>${oldItem.id === item.id ? '保留 ' + escapeHtml(item.name) : escapeHtml(oldItem.name) + ' → ' + escapeHtml(item.name)}</strong>
        <p>${escapeHtml(changeReason(oldItem, item, result.original.visits[index]))}</p>
        <small>合成文化线索：${item.tags.map(escapeHtml).join(' / ')}；在“${escapeHtml(catalogue.themes[scenario.theme].name)}”主题下的人工指数 ${item.affinity[scenario.theme]}/100。</small></div>`;
    }).join('');
  }
  const messages = {
    'resolve:synthetic-theme': '读取明确事件与合成文化种子。',
    'discover:synthetic-catalogue': '读取 9 个自造地点；未来替换为真实 Qloo 候选。',
    'verify:synthetic-demo-only': '核对数据来源：全部为合成演示，不作为真实推荐。',
    'replan:hard-constraints': `枚举 ${result.examined} 条组合，独立检查 5 类硬约束。`,
    'explain:source-bound': '只依据路线与约束结果生成替换说明。'
  };
  $('trace').innerHTML = (result.trace || []).map(step => `<li>${escapeHtml(messages[step] || (step.startsWith('discover:simulated-') ? '候选层故障注入；没有调用外部 API。' : step === 'verify:no-candidates' ? '候选检索未完成，停止路线生成。' : '明确显示故障，等待用户重试。'))}</li>`).join('');
}

function routeHtml(route) {
  if (!route) return '<p class="route-empty">未生成本轮可行分支。原计划仅供对照。</p>';
  const metrics = `<div class="route-metrics"><strong>¥${route.cost}</strong><span>${clock(780 + scenario.delay)} → ${clock(route.end)}</span><em class="${route.feasible ? 'pass' : 'fail'}">${route.feasible ? '全部硬约束通过' : '存在硬约束冲突'}</em></div>`;
  const stops = route.visits.map(visit => {
    const item = venue(visit.id);
    const flags = [!visit.checks.weather ? '雨天露天节点不可用' : '', !visit.checks.closure ? '临时关闭' : '', !visit.checks.opening ? '体验结束超出营业时间' : ''].filter(Boolean);
    return `<div class="route-stop"><time>${clock(visit.start)}<br>↓ ${clock(visit.leave)}</time><div><button type="button" data-venue="${item.id}">${escapeHtml(item.name)}</button>
      <small>${escapeHtml(item.kind)} · ¥${item.cost} · 停留 ${item.duration} 分钟 · 此段步行 ${visit.leg} 分钟</small>
      <small>营业 ${clock(item.open)}–${clock(item.close)}${visit.wait ? ' · 等待开门 ' + visit.wait + ' 分钟' : ''}</small>
      ${flags.length ? `<small class="stop-fail">${flags.join('；')}</small>` : ''}</div></div>`;
  }).join('');
  return metrics + `<div class="route-timeline">${stops}</div>`;
}
function renderComparisons() {
  $('original-route').innerHTML = routeHtml(result.original);
  const route = currentRoute();
  $('selected-title').textContent = route ? `当前分支 ${String.fromCharCode(65 + chosen)}` : '当前分支（未生成）';
  $('selected-ids').textContent = route ? route.ids.join(' → ') : '';
  $('selected-route').innerHTML = routeHtml(route);
}
function renderChecks() {
  const route = currentRoute();
  $('checks').innerHTML = `<table class="checks-table"><thead><tr><th>检查项</th><th>原计划在当前情境下</th><th>当前分支</th><th>检查依据</th></tr></thead><tbody>${checkRows.map(([key, name, rule]) => {
    const original = result.original.checks[key];
    return `<tr><td>${name}</td><td class="${original ? 'pass' : 'fail'}">${original ? '通过' : '不通过'}</td>
      <td class="${route ? route.checks[key] ? 'pass' : 'fail' : 'unknown'}">${route ? route.checks[key] ? '通过' : '不通过' : '未生成，不作通过判断'}</td>
      <td>${key === 'time' ? `含步行与等待，结束 ≤ ${clock(scenario.end)}` : key === 'budget' ? `三站合计 ≤ ¥${scenario.budget}` : rule}</td></tr>`;
  }).join('')}</tbody></table>`;
}
function setAdoptState() {
  const route = currentRoute();
  document.querySelectorAll('.adopt').forEach(button => { button.disabled = !route || dirty; });
  const note = dirty ? '条件已改变，旧结果和此前采纳均需重新核验。' : accepted && accepted.signature === signature(scenario)
    ? `已采纳 ${accepted.names}。仅保存本页会话，未订票或支付。`
    : accepted ? '此前采纳属于旧情境，请重新核验。' : route ? '尚未采纳路线。采纳仅保存本页会话，未订票或支付。' : '本轮没有可采纳分支。';
  document.querySelectorAll('.adopt-note').forEach(element => { element.textContent = note; });
}
function render() {
  renderHero(); renderMap(); renderBranches(); renderEvidence(); renderComparisons(); renderChecks(); setAdoptState();
}

function showVenue(id) {
  const item = venue(id);
  if (!item) return;
  $('venue-dialog-title').textContent = `${item.name} · 合成节点 ${id}`;
  $('venue-dialog-body').innerHTML = `<p>${escapeHtml(item.kind)} · ${item.indoor ? '室内' : '露天'}</p>
    <p>营业 ${clock(item.open)}–${clock(item.close)} · ¥${item.cost} · 停留 ${item.duration} 分钟</p>
    <p>合成文化标签：${item.tags.map(escapeHtml).join(' / ')}。主题指数 ${item.affinity[scenario.theme]}/100。</p>
    <p>以上内容全部为人工演示数据，未由真实 Qloo、场馆、天气或地图服务核验。</p>`;
  $('venue-dialog').showModal();
}

document.addEventListener('click', event => {
  const branch = event.target.closest('[data-branch]');
  if (branch && !dirty) { chosen = Number(branch.dataset.branch); render(); return; }
  const node = event.target.closest('[data-venue]');
  if (node && catalogue) { showVenue(node.dataset.venue); return; }
  const adjust = event.target.closest('[data-adjust]');
  if (adjust) {
    const action = adjust.dataset.adjust;
    if (action === 'budget') $('budget').value = '25';
    if (action === 'end') $('end').value = '1080';
    if (action === 'rain') $('rain').checked = false;
    if (action === 'closed') $('closed').value = '';
    if (action === 'retry') $('fault').value = 'none';
    if (action === 'theme') $('theme').value = String((Number($('theme').value) + 1) % catalogue.themes.length);
    markDirty(); runPlan();
  }
});
document.addEventListener('keydown', event => {
  const node = event.target.closest?.('.map-node[data-venue]');
  if (node && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); showVenue(node.dataset.venue); }
});
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => applyPreset(button.dataset.preset)));
for (const id of ['theme', 'rain', 'delay', 'end', 'closed', 'budget', 'fault']) $(id).addEventListener(id === 'budget' ? 'input' : 'change', markDirty);
$('replan').addEventListener('click', runPlan);
document.querySelectorAll('.adopt').forEach(button => button.addEventListener('click', () => {
  const route = currentRoute();
  if (dirty || !route) return;
  accepted = { signature: signature(scenario), names: route.ids.map(id => venue(id).name).join(' → ') };
  setAdoptState();
}));
$('view-toggle').addEventListener('click', () => {
  const tilted = $('map-wrap').classList.toggle('tilt');
  $('view-toggle').setAttribute('aria-pressed', String(tilted));
  $('view-toggle').textContent = tilted ? '▤ 切换平面示意' : '▱ 切换立体示意';
});
$('dialog-close').addEventListener('click', () => $('venue-dialog').close());
$('venue-dialog').addEventListener('click', event => { if (event.target === $('venue-dialog')) $('venue-dialog').close(); });

async function initialize() {
  try {
    if (window.RainRouteStatic) {
      catalogue = window.RainRouteStatic.catalogue;
    } else {
      const response = await fetch('/api/demo/catalog');
      if (!response.ok) throw new Error(`目录接口 HTTP ${response.status}`);
      catalogue = await response.json();
    }
    $('theme').innerHTML = catalogue.themes.map((theme, index) => `<option value="${index}">${escapeHtml(theme.name)}</option>`).join('');
    $('closed').innerHTML += catalogue.venues.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
    applyPreset('rain');
  } catch (error) {
    $('hero-title').textContent = '演示目录暂时无法加载';
    $('hero-description').textContent = error.message;
    $('hero-result').textContent = '未生成路线，不作推荐。';
    $('replan').disabled = true;
  }
}
initialize();
window.rainrouteDebug = () => ({ catalogue, result, scenario, chosen, dirty, accepted });

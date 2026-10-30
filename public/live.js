'use strict';
const byId = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
let theme = 'cinema';
let payload = null;
const saved = new Map();
function renderUsage(usage) {
  if(!usage||!Number.isInteger(usage.remaining))return;
  byId('usage').textContent=usage.remaining+' / '+usage.limit+' discoveries left today · resets '+new Date(usage.resetAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+' · network limits also apply';
}
async function refreshUsage(){try{const r=await fetch('/api/quota');if(r.ok)renderUsage(await r.json());}catch{}}
refreshUsage();
document.querySelectorAll('[data-theme]').forEach(button => button.addEventListener('click', () => {
  theme = button.dataset.theme;
  document.querySelectorAll('[data-theme]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
}));
byId('discover').addEventListener('click', async () => {
  const button = byId('discover'); button.disabled = true; button.textContent = 'Following cultural connections…';
  byId('notice').textContent = ''; byId('source-status').textContent = 'Requesting Qloo';
  try {
    const response = await fetch('/api/discover', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({theme}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Live discovery is unavailable. Please retry.');
    if (data.source !== 'qloo' || !Array.isArray(data.candidates)) throw new Error('The source could not be verified. No candidates will be shown.');
    payload = data;
    renderUsage(data.usage);
    byId('result-title').textContent = 'Connected to ' + data.seed.label;
    byId('result-description').textContent = 'Worldwide cultural candidates from Qloo. Rank reflects this response, not walking distance or a probability that you will like a place.';
    byId('source-status').textContent = (data.cached ? 'Qloo · cached ' : 'Qloo · checked ') + new Date(data.checkedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    byId('agent-trail').innerHTML = data.trace.map(t => `<li><strong>${escape(t.stage)}</strong><p>${escape(t.detail)}</p></li>`).join('');
    renderCandidates();
  } catch (error) {
    payload = null; byId('candidate-list').innerHTML = '<div class="empty"><h3>Discovery paused</h3><p>No cultural candidates were generated. You can retry or explore the separate synthetic sandbox.</p></div>';
    byId('count').textContent = ''; byId('source-status').textContent = 'Request failed'; byId('notice').textContent = error.message;
    byId('agent-trail').innerHTML = '<li><strong>Discovery failed</strong><p>No synthetic candidates were substituted for a failed live request.</p></li>';
  } finally { button.disabled = false; button.innerHTML = 'Discover places <span>↗</span>'; refreshUsage(); }
});
function renderCandidates() {
  if (!payload) return;
  const hideClosed = byId('hide-closed').checked;
  const candidates = payload.candidates.filter(p => !hideClosed || !p.providerReportsClosed);
  byId('count').textContent = candidates.length + ' visible · ' + (payload.candidates.length - candidates.length) + ' excluded';
  byId('candidate-list').innerHTML = candidates.length ? candidates.map(p => `<article class="candidate"><span class="rank">QLOO RANK ${String(p.rank).padStart(2,'0')}</span><h3>${escape(p.name)}</h3><p class="place-location">${escape([p.city,p.country].filter(Boolean).join(' · ') || 'Location not provided')}</p><p class="description">${escape(p.description || 'A cultural place candidate returned by Qloo. Review its own website for practical details.')}</p><div class="tags">${p.tags.map(t=>`<span class="tag">${escape(t)}</span>`).join('')}</div><p class="unknown">${p.providerReportsClosed ? 'Qloo reports this place as closed.' : 'Operational facts need independent verification.'}</p><div class="candidate-actions"><button class="small-button" data-detail="${escape(p.id)}">Inspect evidence ↗</button><button class="small-button ${saved.has(p.id)?'saved':''}" data-save="${escape(p.id)}">${saved.has(p.id)?'✓ Saved':'＋ Shortlist'}</button></div></article>`).join('') : '<div class="empty"><h3>No candidates to review</h3><p>Try another cultural seed or review the closed-place filter.</p></div>';
}
byId('hide-closed').addEventListener('change',renderCandidates);
byId('candidate-list').addEventListener('click', event => {
  const detail = event.target.closest('[data-detail]'); const save = event.target.closest('[data-save]');
  const id = detail?.dataset.detail ?? save?.dataset.save;
  const p = payload?.candidates.find(p=>p.id===id); if (!p) return;
  if (save) { saved.has(id)?saved.delete(id):saved.set(id,p); renderCandidates(); renderSaved(); }
  if (detail) {
    byId('detail-body').innerHTML = `<p class="eyebrow">QLOO EVIDENCE · CANDIDATE ${p.rank}</p><h2>${escape(p.name)}</h2><p>${escape(p.address || [p.city,p.country].filter(Boolean).join(', '))}</p><p>${escape(p.description)}</p><div class="facts"><strong>Provider metadata</strong>Cultural affinity: ${p.affinity===null?'Not returned':escape(Number(p.affinity).toPrecision(3))} (Qloo response value; not an individual preference probability)<br>Published hours field: ${p.providerHoursAvailable?'Present in provider data':'Not returned'} — not independently verified<br>Closure flag: ${p.providerReportsClosed?'Provider reports closed':'No closure flag returned / false'}<br><strong>Still unknown for a real trip</strong>Current opening status · Actual cost · Indoor access · Walking time · Weather suitability</div><p>A cultural connection does not prove operational feasibility. Check the venue's own information before planning.</p>${p.website?`<a href="${escape(p.website)}" target="_blank" rel="noopener noreferrer">Open venue website to investigate ↗</a>`:'<p>No venue website was supplied by Qloo.</p>'}`;
    byId('detail').showModal();
  }
});
function renderSaved() {
  byId('shortlist-count').textContent = saved.size+' saved';
  byId('shortlist').innerHTML = saved.size ? [...saved.values()].map(p=>`<div class="shortlist-item"><button data-remove="${escape(p.id)}" aria-label="Remove ${escape(p.name)}">Remove ×</button><strong>${escape(p.name)}</strong><p class="subtle">${escape([p.city,p.country].filter(Boolean).join(' · '))} · Qloo rank ${p.rank}<br>${p.tags.map(escape).join(' / ')}</p><ul><li>○ Opening hours</li><li>○ Cost</li><li>○ Indoor access</li><li>○ Travel & weather</li></ul></div>`).join('') : '<p class="subtle">Save candidates to keep their verification checklist together. Saved choices last for this page session only.</p>';
}
byId('shortlist').addEventListener('click',event=>{const b=event.target.closest('[data-remove]');if(b){saved.delete(b.dataset.remove);renderSaved();renderCandidates();}});
byId('close-detail').addEventListener('click',()=>byId('detail').close());

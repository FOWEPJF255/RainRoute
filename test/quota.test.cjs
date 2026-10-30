'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const makeDb=require('../support/quota-db.cjs');
test('durable quota prevents visitor and shared-key budgets from exceeding their limits',async()=>{
  const {reserveVisit,reserveUpstream,quotaContext}=await import('../src/quota.mjs');
  const db=makeDb();
  const context={visitorKey:'visitor:test',networkKey:'network:test',globalKey:'upstream:test',resetAt:Date.now()+86400000};
  const attempts=await Promise.allSettled(Array.from({length:8},()=>reserveVisit(db,context)));
  assert.equal(attempts.filter(a=>a.status==='fulfilled').length,6);
  const keyAttempts=await Promise.allSettled(Array.from({length:62},()=>reserveUpstream(db,context)));
  assert.equal(keyAttempts.filter(a=>a.status==='fulfilled').length,60);
  const networkDb=makeDb();
  const networkAttempts=await Promise.allSettled(Array.from({length:32},(_,i)=>reserveVisit(networkDb,{...context,visitorKey:'distinct-visitor:'+i})));
  assert.equal(networkAttempts.filter(a=>a.status==='fulfilled').length,30);
  const generated=await quotaContext(new Request('https://rainroute.test',{headers:{'CF-Connecting-IP':'192.0.2.1'}}),'private-secret',Date.UTC(2026,9,31));
  assert.ok(!generated.networkKey.includes('192.0.2.1'));assert.ok(!JSON.stringify(generated).includes('private-secret'));
  assert.ok(generated.cookie.includes('HttpOnly; Secure; SameSite=Lax'));
});

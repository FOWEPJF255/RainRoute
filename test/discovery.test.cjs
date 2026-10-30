'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const response=payload=>({ok:true,json:async()=>payload});
const makeDb=require('../support/quota-db.cjs');
test('live discovery normalizes Qloo candidates without turning metadata into verified facts',async()=>{
  const {discoverPlaces}=await import('../src/discovery.mjs');
  const calls=[];
  const result=await discoverPlaces({theme:'cinema',apiKey:'private-test-key',fetchImpl:async(url,options)=>{
    calls.push({url:String(url),options});
    return calls.length===1?response({results:[{entity_id:'film-123',name:'The Grand Budapest Hotel'}]}):response({results:{entities:[{entity_id:'place-123',name:'Example place',query:{affinity:.23},properties:{website:'javascript:alert(1)',hours:{monday:[]},is_closed:true},tags:[{name:'Cinema'}]}]}});
  }});
  assert.equal(result.source,'qloo');assert.equal(result.routeReady,false);
  assert.equal(result.candidates[0].website,null);
  assert.equal(result.candidates[0].factStatus,'independently-unverified');
  assert.equal(result.candidates[0].providerReportsClosed,true);
  assert.equal(calls[0].options.headers['X-Api-Key'],'private-test-key');
  assert.ok(!JSON.stringify(result).includes('private-test-key'));
  assert.ok(calls[1].url.includes('signal.interests.entities=film-123'));
});
test('hosted discovery limits inputs, caches upstream calls, and keeps missing credentials explicit',async()=>{
  const {createHostedHandler}=await import('../src/hosted-worker.mjs');
  let calls=0;
  const env={QLOO_API_KEY:'private-test',DB:makeDb()};
  const handle=createHostedHandler({fetchImpl:async()=>{calls++;return calls%2?response({results:[{entity_id:'seed-123'}]}):response({results:{entities:[]}});}});
  const request=theme=>new Request('https://rainroute.test/api/discover',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'rrv=12345678-1234-1234-1234-123456789abc'},body:JSON.stringify({theme})});
  assert.equal((await handle(request('__proto__'),{})).status,400);
  assert.equal((await handle(request('cinema'),{})).status,503);
  const first=await(await handle(request('cinema'),env)).json();
  const second=await(await handle(request('cinema'),env)).json();
  assert.equal(first.cached,false);assert.equal(second.cached,true);assert.equal(calls,2);
  assert.equal(first.usage.remaining,5);assert.equal(second.usage.remaining,4);
  for(let i=0;i<4;i++) assert.equal((await handle(request('cinema'),env)).status,200);
  assert.equal((await handle(request('cinema'),env)).status,429);
});
test('hosted failures disclose no credentials, serve no environment file, and never substitute demo data',async()=>{
  const {createHostedHandler}=await import('../src/hosted-worker.mjs');
  const handle=createHostedHandler({fetchImpl:async()=>({ok:false,status:401})});
  const request=new Request('https://rainroute.test/api/discover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({theme:'cinema'})});
  const result=await handle(request,{QLOO_API_KEY:'private-credential',DB:makeDb()});
  const body=await result.text();
  assert.equal(result.status,503);assert.ok(!body.includes('private-credential'));assert.ok(!body.includes('candidates'));
  assert.equal((await handle(new Request('https://rainroute.test/.env'),{})).status,404);
});

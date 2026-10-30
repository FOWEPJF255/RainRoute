export const QUOTA_LIMITS = Object.freeze({ visitor:6, network:30, upstream:120 });
export class QuotaError extends Error {
  constructor(code,message,status=429){super(message);this.code=code;this.status=status;}
}
export async function quotaContext(request,secret,time=Date.now()) {
  const existing=request.headers.get('Cookie')?.match(/(?:^|;\s*)rrv=([a-f0-9-]{36})(?:;|$)/i)?.[1];
  const visitor=existing||crypto.randomUUID();
  const day=new Date(time).toISOString().slice(0,10);
  const resetAt=Date.parse(day+'T00:00:00Z')+86400000;
  const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret+'|'+day+'|'+value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  return {visitorKey:'visitor:'+day+':'+await hash(visitor),networkKey:'network:'+day+':'+await hash(request.headers.get('CF-Connecting-IP')||'shared'),globalKey:'upstream:'+day,
    resetAt,cookie:existing?null:'rrv='+visitor+'; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax'};
}
export async function quotaStatus(db,context) {
  if(!db)throw new QuotaError('QUOTA_UNAVAILABLE','Live discovery is paused while quota protection is unavailable.',503);
  const row=await db.prepare('SELECT hits FROM quota_buckets WHERE key = ?').bind(context.visitorKey).first();
  return {limit:QUOTA_LIMITS.visitor,remaining:Math.max(0,QUOTA_LIMITS.visitor-(row?.hits||0)),resetAt:new Date(context.resetAt).toISOString()};
}
async function consume(db,key,amount,limit,resetAt,message) {
  if(!db)throw new QuotaError('QUOTA_UNAVAILABLE','Live discovery is paused while quota protection is unavailable.',503);
  const row=await db.prepare('INSERT INTO quota_buckets (key, hits, expires_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET hits = hits + excluded.hits WHERE hits + excluded.hits <= ? RETURNING hits').bind(key,amount,resetAt,limit).first();
  if(!row)throw new QuotaError('DAILY_LIMIT',message);
  return row.hits;
}
export async function reserveVisit(db,context) {
  await consume(db,context.networkKey,1,QUOTA_LIMITS.network,context.resetAt,'This network has reached its daily discovery allowance. Please return after the daily reset.');
  const hits=await consume(db,context.visitorKey,1,QUOTA_LIMITS.visitor,context.resetAt,'Your browser has used its 6 discoveries for today. Please return after the daily reset.');
  return {limit:QUOTA_LIMITS.visitor,remaining:QUOTA_LIMITS.visitor-hits,resetAt:new Date(context.resetAt).toISOString()};
}
export async function reserveUpstream(db,context) {
  await consume(db,context.globalKey,2,QUOTA_LIMITS.upstream,context.resetAt,'The shared Qloo request budget is used for today. Cached results may still be available; please return after the daily reset.');
}

import { discoverPlaces, DiscoveryError } from './discovery.mjs';
import { quotaContext, quotaStatus, reserveVisit, reserveUpstream, QuotaError } from './quota.mjs';

export function createHostedHandler({ fetchImpl = fetch, now = Date.now } = {}) {
  const cache = new Map();
  const pending = new Map();
  const visits = new Map();
  let globalWindow = { start: now(), count: 0 };
  let cleanupDay='';
  const headers = {
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };
  function json(body, status = 200, extra = {}) {
    return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', ...extra } });
  }
  return async function handle(request, env = {}, assets = {}) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health' && request.method === 'GET')
      return json({ status:'ok', qlooConfigured:!!env.QLOO_API_KEY, quotaProtected:!!env.DB, liveDiscoveryReady:!!env.QLOO_API_KEY&&!!env.DB, liveRouteReady:false });
    if(url.pathname==='/api/quota' && request.method==='GET') {
      try {
        const context=await quotaContext(request,env.QLOO_API_KEY||'',now());
        return json(await quotaStatus(env.DB,context),200,context.cookie?{'Set-Cookie':context.cookie}:{});
      }catch{return json({error:{code:'QUOTA_UNAVAILABLE',message:'Quota status is temporarily unavailable.'}},503);}
    }
    if (url.pathname === '/api/discover' && request.method === 'POST') {
      let context;
      try {
        if (!request.headers.get('Content-Type')?.includes('application/json')) return json({error:{code:'INVALID_CONTENT_TYPE',message:'Send a JSON request.'}},415);
        if (Number(request.headers.get('Content-Length') || 0) > 1024) return json({error:{code:'BODY_TOO_LARGE',message:'Request is too large.'}},413);
        const bodyText = await request.text();
        if (bodyText.length > 1024) return json({error:{code:'BODY_TOO_LARGE',message:'Request is too large.'}},413);
        let body; try { body=JSON.parse(bodyText); } catch { return json({error:{code:'INVALID_JSON',message:'Request must be JSON.'}},400); }
        const theme = body?.theme;
        if (!['cinema','jazz','books'].includes(theme)) return json({error:{code:'INVALID_THEME',message:'Choose one of the three public cultural seeds.'}},400);
        if (!env.QLOO_API_KEY) return json({error:{code:'QLOO_KEY_MISSING',message:'Live discovery is not configured.'}},503);
        const time = now();
        const identity = request.headers.get('CF-Connecting-IP') || 'shared';
        let visit = visits.get(identity);
        if (!visit || time-visit.start >= 60000) visit={start:time,count:0};
        if (++visit.count > 12) return json({error:{code:'RATE_LIMIT',message:'Please wait a minute before requesting again.'}},429,{'Retry-After':'60'});
        if (visits.size>1000) visits.clear();
        visits.set(identity,visit);
        context=await quotaContext(request,env.QLOO_API_KEY,time);
        const usage=await reserveVisit(env.DB,context);
        const cookieHeader=context.cookie?{'Set-Cookie':context.cookie}:{};
        const day=new Date(time).toISOString().slice(0,10);
        if(cleanupDay!==day){await env.DB.prepare('DELETE FROM quota_buckets WHERE key IN (SELECT key FROM quota_buckets WHERE expires_at < ? LIMIT 100)').bind(time-86400000).run();cleanupDay=day;}
        const previous=cache.get(theme);
        if (previous && time-previous.created<1800000) return json({...previous.payload,cached:true,usage},200,cookieHeader);
        if (time-globalWindow.start>=60000) globalWindow={start:time,count:0};
        if (globalWindow.count>=30) return json({error:{code:'RATE_LIMIT',message:'Discovery is busy. Please retry shortly.'}},429,{'Retry-After':'60'});
        let operation=pending.get(theme);
        if (!operation) {
          globalWindow.count++;
          operation=(async()=>{await reserveUpstream(env.DB,context);return discoverPlaces({theme,apiKey:env.QLOO_API_KEY,fetchImpl});})();
          pending.set(theme,operation);
        }
        try { const payload=await operation; cache.set(theme,{created:now(),payload}); return json({...payload,cached:false,usage},200,cookieHeader); }
        finally { if(pending.get(theme)===operation) pending.delete(theme); }
      } catch(error) {
        const known=error instanceof DiscoveryError||error instanceof QuotaError;
        return json({error:{code:known?error.code:'DISCOVERY_FAILED',message:known?error.message:'Live discovery is temporarily unavailable.'}},known?error.status:502,context?.cookie?{'Set-Cookie':context.cookie}:{});
      }
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({error:{code:'METHOD_NOT_ALLOWED',message:'Method not allowed.'}},405);
    const asset=assets[url.pathname];
    if (!asset) return json({error:{code:'NOT_FOUND',message:'Page not found.'}},404);
    return new Response(request.method==='HEAD'?null:asset.body,{headers:{...headers,'Content-Type':asset.type,'Cache-Control':'no-cache'}});
  };
}

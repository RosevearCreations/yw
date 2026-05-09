function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }); }
function getDb(env){ return env.DB || env.DD_DB; }
function getBearerToken(request){ const authHeader=request.headers.get('Authorization')||''; const match=authHeader.match(/^Bearer\s+(.+)$/i); return match ? String(match[1]||'').trim() : ''; }
function normalizeResults(result){ return Array.isArray(result?.results) ? result.results : []; }
async function getAdminUserFromRequest(request, env){ const db=getDb(env); const token=getBearerToken(request); if(!db||!token) return null; try{ const s=await db.prepare(`SELECT s.user_id, u.user_id AS resolved_user_id, u.email, u.display_name, u.role, u.is_active FROM sessions s INNER JOIN users u ON u.user_id=s.user_id WHERE (s.session_token=? OR s.token=?) AND s.expires_at > datetime('now') LIMIT 1`).bind(token, token).first(); if(!s||Number(s.is_active||0)!==1||String(s.role||'').toLowerCase()!=='admin') return null; return { user_id:Number(s.resolved_user_id||s.user_id||0), email:s.email||'', display_name:s.display_name||'' }; }catch{ return null; } }
async function safeAll(db, sql, bindings=[]){ try{ const stmt=db.prepare(sql); const result=bindings.length? await stmt.bind(...bindings).all() : await stmt.all(); return normalizeResults(result); }catch{ return []; } }
export async function onRequestGet(context){ const {request,env}=context; const db=getDb(env); const adminUser=await getAdminUserFromRequest(request, env); if(!adminUser) return json({ok:false,error:'Unauthorized.'},401);
  const [orders, searches, webhooks, sessions]=await Promise.all([
    safeAll(db, `SELECT order_id, order_number, status, payment_status, total_cents, currency, created_at FROM orders ORDER BY created_at DESC LIMIT 8`),
    safeAll(db, `SELECT search_term, result_count, created_at FROM site_search_events ORDER BY created_at DESC LIMIT 8`),
    safeAll(db, `SELECT provider AS provider_name, event_type, process_status, received_at, attempt_count FROM webhook_events ORDER BY COALESCE(last_attempt_at, received_at) DESC LIMIT 8`),
    safeAll(db, `SELECT country, city, entry_path, last_path, page_view_count, is_checkout_started, is_abandoned_cart, last_seen_at FROM site_visitor_sessions ORDER BY last_seen_at DESC LIMIT 8`)
  ]);
  const feed=[];
  for(const row of orders){ feed.push({type:'order', at: row.created_at||null, title:`Order ${row.order_number||('#'+row.order_id)}`, detail:`${row.status||'pending'} • ${(Number(row.total_cents||0)/100).toFixed(2)} ${row.currency||'CAD'}${row.payment_status ? ' • '+row.payment_status : ''}`, severity: String(row.status||'').toLowerCase()==='cancelled' ? 'warning':'info'}); }
  for(const row of searches){ feed.push({type:'search', at:row.created_at||null, title:`Search: ${row.search_term||'(blank)'}`, detail:`${Number(row.result_count||0)} result(s)`, severity:'info'}); }
  for(const row of webhooks){ feed.push({type:'webhook', at:row.received_at||null, title:`Webhook ${row.provider_name||'provider'}: ${row.event_type||'event'}`, detail:`${row.process_status||'received'} • attempt ${Number(row.attempt_count||0)}`, severity:String(row.process_status||'').toLowerCase()==='failed'?'danger':'info'}); }
  for(const row of sessions){ const flags=[]; if(Number(row.is_checkout_started||0)===1) flags.push('checkout'); if(Number(row.is_abandoned_cart||0)===1) flags.push('abandoned'); feed.push({type:'visitor', at:row.last_seen_at||null, title:'Visitor session', detail:`${row.country||'Unknown'}${row.city ? ' / '+row.city : ''} • ${row.entry_path||'/'} → ${row.last_path||'/'} • ${Number(row.page_view_count||0)} view(s)${flags.length ? ' • '+flags.join(', ') : ''}`, severity:Number(row.is_abandoned_cart||0)===1 ? 'warning':'info'}); }
  feed.sort((a,b)=> String(b.at||'').localeCompare(String(a.at||'')));
  return json({ ok:true, requested_by:adminUser, generated_at:new Date().toISOString(), items:feed.slice(0,18) }); }

import { auditAdminAction, getAdminUserFromRequest, getDb, jsonResponse, normalizeText } from "../_lib/adminAudit.js";

function json(data, status = 200) { return jsonResponse(data, status); }
function normalizeResults(result){ return Array.isArray(result?.results)? result.results : []; }

export async function onRequestGet(context){
  const {request,env}=context; const db=getDb(env); const adminUser=await getAdminUserFromRequest(request, env); if(!adminUser) return json({ok:false,error:'Unauthorized.'},401);
  const url=new URL(request.url); const provider=normalizeText(url.searchParams.get('provider')).toLowerCase(); const processStatus=normalizeText(url.searchParams.get('process_status')).toLowerCase(); const q=normalizeText(url.searchParams.get('q')).toLowerCase(); const limit=Math.max(1,Math.min(200,Number(url.searchParams.get('limit')||50)));
  let rows=[]; let summary={};
  try {
    rows = normalizeResults(await db.prepare(`SELECT we.webhook_event_id,we.provider,we.provider_event_id,we.event_type,we.verification_status,we.process_status,we.related_order_id,we.related_payment_id,we.error_text,we.received_at,we.processed_at,we.updated_at,COALESCE(we.attempt_count,0) AS attempt_count,we.last_attempt_at,we.next_retry_at,we.replay_requested_at,we.dispatch_notes,o.order_number,p.transaction_reference FROM webhook_events we LEFT JOIN orders o ON o.order_id=we.related_order_id LEFT JOIN payments p ON p.payment_id=we.related_payment_id WHERE (?='' OR LOWER(COALESCE(we.provider,''))=?) AND (?='' OR LOWER(COALESCE(we.process_status,''))=?) AND (?='' OR LOWER(COALESCE(we.provider_event_id,'')) LIKE ? OR LOWER(COALESCE(we.event_type,'')) LIKE ? OR LOWER(COALESCE(we.error_text,'')) LIKE ? OR LOWER(COALESCE(o.order_number,'')) LIKE ?) ORDER BY COALESCE(we.last_attempt_at,we.received_at) DESC, we.webhook_event_id DESC LIMIT ?`).bind(provider,provider,processStatus,processStatus,q,`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`,limit).all());
    summary = await db.prepare(`SELECT COUNT(*) AS total_events, SUM(CASE WHEN process_status='failed' THEN 1 ELSE 0 END) AS failed_events, SUM(CASE WHEN process_status='received' THEN 1 ELSE 0 END) AS queued_events, SUM(CASE WHEN process_status='duplicate' THEN 1 ELSE 0 END) AS duplicate_events, SUM(CASE WHEN process_status='ignored' THEN 1 ELSE 0 END) AS ignored_events, SUM(CASE WHEN process_status='processed' THEN 1 ELSE 0 END) AS processed_events FROM webhook_events`).first() || {};
  } catch {}
  return json({ ok:true, requested_by:adminUser, summary:{ total_events:Number(summary?.total_events||0), failed_events:Number(summary?.failed_events||0), queued_events:Number(summary?.queued_events||0), duplicate_events:Number(summary?.duplicate_events||0), ignored_events:Number(summary?.ignored_events||0), processed_events:Number(summary?.processed_events||0) }, items:rows });
}

export async function onRequestPatch(context){
  const {request,env}=context; const db=getDb(env); const adminUser=await getAdminUserFromRequest(request, env); if(!adminUser) return json({ok:false,error:'Unauthorized.'},401);
  let body={}; try{ body=await request.json(); }catch{ return json({ok:false,error:'Invalid JSON body.'},400); }
  const webhookEventId=Number(body.webhook_event_id||0); const action=normalizeText(body.action).toLowerCase(); const note=normalizeText(body.note);
  if(!webhookEventId) return json({ok:false,error:'webhook_event_id is required.'},400);
  if(!['requeue','mark_processed','mark_failed','mark_ignored'].includes(action)) return json({ok:false,error:'Unsupported action.'},400);
  try{
    const existing=await db.prepare(`SELECT webhook_event_id, provider_event_id, process_status, COALESCE(attempt_count,0) AS attempt_count FROM webhook_events WHERE webhook_event_id=? LIMIT 1`).bind(webhookEventId).first();
    if(!existing) return json({ok:false,error:'Webhook event not found.'},404);
    let nextStatus=existing.process_status||'received'; let nextRetryAt=null; let replayRequestedAt=null; let processedAt=null; let errorText=null; let attemptCount=Number(existing.attempt_count||0);
    if(action==='requeue'){ nextStatus='received'; replayRequestedAt=new Date().toISOString(); nextRetryAt=replayRequestedAt; attemptCount += 1; }
    else if(action==='mark_processed'){ nextStatus='processed'; processedAt=new Date().toISOString(); }
    else if(action==='mark_failed'){ nextStatus='failed'; errorText=note||'Marked failed by admin.'; nextRetryAt=new Date(Date.now()+15*60*1000).toISOString(); attemptCount += 1; }
    else if(action==='mark_ignored'){ nextStatus='ignored'; processedAt=new Date().toISOString(); }
    await db.prepare(`UPDATE webhook_events SET process_status=?, error_text=CASE WHEN ? IS NULL OR ?='' THEN error_text ELSE ? END, dispatch_notes=CASE WHEN ? IS NULL OR ?='' THEN dispatch_notes ELSE ? END, attempt_count=?, last_attempt_at=CASE WHEN ?='requeue' OR ?='mark_failed' THEN CURRENT_TIMESTAMP ELSE last_attempt_at END, next_retry_at=?, replay_requested_at=COALESCE(?, replay_requested_at), replay_requested_by_user_id=CASE WHEN ? IS NULL THEN replay_requested_by_user_id ELSE ? END, processed_at=COALESCE(?, processed_at), updated_at=CURRENT_TIMESTAMP WHERE webhook_event_id=?`).bind(nextStatus,errorText,errorText,errorText,note||null,note||null,attemptCount,action,action,nextRetryAt,replayRequestedAt,replayRequestedAt ? adminUser.user_id : null,replayRequestedAt ? adminUser.user_id : null,processedAt,webhookEventId).run();
    await auditAdminAction(env, request, adminUser, { action_type:'webhook_admin_action', target_type:'webhook_event', target_id:webhookEventId, target_key:existing.provider_event_id || String(webhookEventId), details:{ action, note, previous_status: existing.process_status || '', next_status: nextStatus } });
    return json({ok:true,message:`Webhook event ${action} complete.`, webhook_event_id:webhookEventId, action, process_status:nextStatus});
  } catch(e){ return json({ok:false,error:e.message||'Webhook update failed.'},500); }
}

// Schema 157 / build 2026-07-12a
// Protected, consent-controlled delivery of customer-visible live job updates.
//
// This function is not a public endpoint. It requires a dedicated run token and
// YWI_CUSTOMER_NOTIFICATION_DELIVERY_ENABLED=true. It sends e-mail only; SMS
// is intentionally not implemented here.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUILD = '2026-07-12a';
const SCHEMA = 157;
const jsonHeaders = { 'Content-Type':'application/json', 'Cache-Control':'no-store' };

function clean(value: unknown, max = 2000) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function siteOrigin(value: unknown) {
  const raw = clean(value,500).replace(/\/$/,'');
  try {
    const parsed = new URL(raw);
    return ['http:','https:'].includes(parsed.protocol) ? parsed.origin : '';
  } catch { return ''; }
}
function retrySeconds(response: Response, attempt: number) {
  const header = Number(response.headers.get('retry-after') || 0);
  if (Number.isFinite(header) && header > 0) return Math.min(Math.max(Math.round(header),60),14400);
  return Math.min(300 * (2 ** Math.max(0, attempt - 1)), 14400);
}
async function rpc(supabase: any, name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name,args);
  if (error) throw new Error(error.message || `RPC ${name} failed.`);
  return data || {};
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ ok:false, error:'Use POST.' }), { status:405, headers:jsonHeaders });
  const supplied = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i,'').trim();
  const runToken = clean(Deno.env.get('YWI_CUSTOMER_NOTIFICATION_RUN_TOKEN'),500);
  if (!runToken || supplied.length < 24 || supplied !== runToken) {
    return new Response(JSON.stringify({ ok:false, error:'Unauthorized.' }), { status:401, headers:jsonHeaders });
  }
  if (clean(Deno.env.get('YWI_CUSTOMER_NOTIFICATION_DELIVERY_ENABLED'),20).toLowerCase() !== 'true') {
    return new Response(JSON.stringify({ ok:false, error:'Customer notification delivery is disabled for this deployment.' }), { status:409, headers:jsonHeaders });
  }

  const url = Deno.env.get('SUPABASE_URL') || Deno.env.get('SB_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SB_SERVICE_ROLE_KEY') || '';
  const resendKey = clean(Deno.env.get('RESEND_API_KEY'),500);
  const from = clean(Deno.env.get('RESEND_FROM_EMAIL') || Deno.env.get('EMAIL_FROM'),320);
  const origin = siteOrigin(Deno.env.get('PUBLIC_SITE_URL') || Deno.env.get('SITE_URL'));
  if (!url || !key || !resendKey || !from || !origin) {
    return new Response(JSON.stringify({ ok:false, error:'Delivery configuration is incomplete. Configure Supabase service credentials, Resend, and PUBLIC_SITE_URL.' }), { status:409, headers:jsonHeaders });
  }

  let requestedLimit = 10;
  try {
    const body = await req.json();
    if (Number.isFinite(Number(body?.limit))) requestedLimit = Math.max(1, Math.min(Math.floor(Number(body.limit)),25));
  } catch { /* no body is fine */ }

  const supabase = createClient(url,key,{ auth:{ persistSession:false } });
  let recovered = 0;
  try {
    const recovery = await rpc(supabase,'ywi_rpc_recover_stale_customer_notification_claims',{ p_dispatch_key:runToken });
    recovered = Number(recovery?.recovered || 0);
  } catch (error) {
    return new Response(JSON.stringify({ ok:false, error:'Could not recover stale delivery claims safely.' }), { status:500, headers:jsonHeaders });
  }
  const { data: candidates, error: candidateError } = await supabase
    .from('customer_notification_outbox')
    .select('id')
    .in('delivery_status',['queued','retry_scheduled'])
    .lte('next_attempt_at',new Date().toISOString())
    .order('next_attempt_at',{ascending:true})
    .limit(requestedLimit);
  if (candidateError) {
    return new Response(JSON.stringify({ ok:false, error:'Could not load the notification outbox.' }), { status:500, headers:jsonHeaders });
  }

  const summary = { recovered, scanned:(candidates || []).length, sent:0, retry_scheduled:0, failed:0, manual_review:0, blocked:0, skipped:0 };
  for (const candidate of candidates || []) {
    let claim:any = {};
    try {
      claim = await rpc(supabase,'ywi_rpc_claim_customer_notification',{
        p_outbox_id:candidate.id,
        p_dispatch_key:runToken
      });
      if (!claim?.claimed) {
        if (claim?.status === 'blocked') summary.blocked++;
        else summary.skipped++;
        continue;
      }
      const subject = `Yard Weasels Inc. service update: ${clean(claim.title || 'Service update',180)}`;
      const secureUrl = `${origin}/?portal=${encodeURIComponent(String(claim.public_token || ''))}`;
      const message = clean(claim.message || '',4000);
      const text = [
        'A new customer-safe service update is available.',
        '',
        clean(claim.title || 'Service update',180),
        message,
        '',
        `View the update securely: ${secureUrl}`,
        '',
        'This message was sent because the customer opted in to live service update email. The secure portal contains the current details.'
      ].filter((line, index, all) => line || (index > 0 && index < all.length - 1)).join('\n');
      const response = await fetch('https://api.resend.com/emails', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':`Bearer ${resendKey}`,
          'Idempotency-Key':`ywi-live-update-${claim.outbox_id}`
        },
        body:JSON.stringify({
          from,
          to:[claim.recipient_email],
          subject,
          text
        })
      });
      const responseText = await response.text();
      let payload:any = {};
      try { payload = responseText ? JSON.parse(responseText) : {}; } catch { payload = {}; }
      if (response.ok) {
        await rpc(supabase,'ywi_rpc_complete_customer_notification',{
          p_outbox_id:claim.outbox_id,
          p_result_status:'sent',
          p_provider_name:'resend',
          p_provider_message_id:clean(payload?.id || payload?.data?.id,240) || null,
          p_response_code:response.status,
          p_error_summary:null,
          p_retry_after_seconds:null,
          p_metadata:{ build:BUILD, schema:SCHEMA, delivery:'resend' }
        });
        summary.sent++;
      } else {
        const providerError = clean(payload?.message || payload?.error?.message || responseText || `HTTP ${response.status}`,1200);
        const retryable = response.status === 429 || response.status >= 500;
        const result = retryable ? 'retry_scheduled' : 'failed';
        await rpc(supabase,'ywi_rpc_complete_customer_notification',{
          p_outbox_id:claim.outbox_id,
          p_result_status:result,
          p_provider_name:'resend',
          p_provider_message_id:null,
          p_response_code:response.status,
          p_error_summary:providerError,
          p_retry_after_seconds:retryable ? retrySeconds(response, Number(claim.attempt_number || 1)) : null,
          p_metadata:{ build:BUILD, schema:SCHEMA, delivery:'resend', retryable }
        });
        summary[result]++;
      }
    } catch (error) {
      // A transport timeout may occur after a provider accepted the message. Hold it
      // for manual review rather than silently retrying and risking a duplicate e-mail.
      const summaryText = clean(error instanceof Error ? error.message : error,1200);
      if (claim?.outbox_id) {
        try {
          await rpc(supabase,'ywi_rpc_complete_customer_notification',{
            p_outbox_id:claim.outbox_id,
            p_result_status:'manual_review',
            p_provider_name:'resend',
            p_provider_message_id:null,
            p_response_code:null,
            p_error_summary:summaryText || 'Transport uncertainty after delivery claim.',
            p_retry_after_seconds:null,
            p_metadata:{ build:BUILD, schema:SCHEMA, delivery:'resend', reason:'transport_uncertainty' }
          });
        } catch { /* the next protected review will surface the claimed item */ }
      }
      summary.manual_review++;
    }
  }

  return new Response(JSON.stringify({ ok:true, build:BUILD, schema:SCHEMA, ...summary }), { headers:jsonHeaders });
});

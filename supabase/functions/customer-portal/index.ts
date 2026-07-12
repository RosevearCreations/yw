import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUILD = '2026-07-07a';
const SCHEMA = 156;
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
class HttpError extends Error { status:number; details?:unknown; constructor(status:number, message:string, details?:unknown) { super(message); this.status=status; this.details=details; } }
const clean = (v:unknown, max=1000) => String(v ?? '').trim().slice(0,max);
const money = (v:unknown) => { const n=Number(String(v ?? '').replace(/[$,]/g,'')); return Number.isFinite(n) ? Number(n.toFixed(2)) : 0; };
const cents = (v:unknown) => Math.round(money(v) * 100);
const nowIso = () => new Date().toISOString();
const validEmail = (v:unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v,260));
const tokenOk = (v:unknown) => /^[a-zA-Z0-9_-]{16,160}$/.test(clean(v,160));
const validCurrency = (v:unknown) => /^[A-Z]{3}$/.test(clean(v,3).toUpperCase());
function publicSiteUrl(value:unknown) {
  const raw=clean(value,500).replace(/\/$/,'');
  try { const parsed=new URL(raw); return ['http:','https:'].includes(parsed.protocol) ? parsed.origin : ''; } catch { return ''; }
}
async function hashValue(value:string) {
  const digest=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b)=>b.toString(16).padStart(2,'0')).join('');
}
async function packageByToken(supabase:any, token:string) {
  const { data, error } = await supabase.from('v_customer_portal_quote_directory').select('*').eq('public_token', token).maybeSingle();
  if (error) throw error;
  if (!data || !data.portal_enabled) throw new HttpError(404, 'This customer portal link is unavailable.');
  return data;
}
async function portalLiveUpdates(supabase:any, workOrderId:string | null | undefined) {
  if (!workOrderId) return [];
  const { data, error } = await supabase
    .from('v_customer_portal_live_updates')
    .select('live_update_id,work_order_id,update_type,title,message,occurred_at,progress_percent,customer_notification_status,media')
    .eq('work_order_id', workOrderId)
    .order('occurred_at', { ascending:false })
    .limit(30);
  if (error) throw error;
  return (data || []).map((row:any) => ({
    id: row.live_update_id,
    type: row.update_type,
    title: row.title,
    message: row.message,
    occurred_at: row.occurred_at,
    progress_percent: row.progress_percent,
    media: Array.isArray(row.media) ? row.media : []
  }));
}

async function portalNotificationPreference(supabase:any, clientId:string | null | undefined) {
  if (!clientId) return { live_work_update_email_opt_in:false, consent_status:'unknown', email_configured:false };
  const { data, error } = await supabase
    .from('customer_notification_preferences')
    .select('consent_status,live_work_update_opt_in,contact_email')
    .eq('client_id', clientId)
    .eq('channel','email')
    .maybeSingle();
  if (error) throw error;
  return {
    live_work_update_email_opt_in: !!data?.live_work_update_opt_in && data?.consent_status === 'granted',
    consent_status: data?.consent_status || 'unknown',
    email_configured: Boolean(clean(data?.contact_email,260))
  };
}

function publicPackage(row:any, liveUpdates:any[] = [], notificationPreference:any = {}) {
  return {
    quote_package_id:row.quote_package_id, package_status:row.package_status, rendered_title:row.rendered_title,
    rendered_html:row.rendered_html, rendered_markdown:row.rendered_markdown, accepted_at:row.accepted_at,
    accepted_by_name:row.accepted_by_name, deposit_required_amount:money(row.deposit_required_amount), deposit_status:row.deposit_status,
    estimate:{ id:row.estimate_id, number:row.estimate_number, status:row.estimate_status, subtotal:money(row.subtotal), tax_total:money(row.tax_total), total:money(row.total_amount), valid_until:row.valid_until },
    customer:{ name:row.client_name },
    work_order:row.work_order_id ? { id:row.work_order_id, number:row.work_order_number, status:row.work_order_status, scheduled_start:row.scheduled_start, scheduled_end:row.scheduled_end, schedule_status:row.schedule_status } : null,
    deposit:row.latest_deposit_request_id ? { id:row.latest_deposit_request_id, status:row.latest_deposit_status, requested_amount:money(row.latest_deposit_amount), paid_amount:money(row.latest_paid_amount), receipt_url:row.receipt_url } : null,
    live_updates: liveUpdates,
    notification_preferences: {
      live_work_update_email_opt_in: !!notificationPreference?.live_work_update_email_opt_in,
      consent_status: notificationPreference?.consent_status || 'unknown',
      email_configured: !!notificationPreference?.email_configured
    }
  };
}

async function callRpc(supabase:any, name:string, args:Record<string,unknown>) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data || {};
}

async function stripeCheckout(secret:string, payload:Record<string,string>, idempotencyKey:string) {
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions', { method:'POST', headers:{ Authorization:`Bearer ${secret}`, 'Content-Type':'application/x-www-form-urlencoded', 'Idempotency-Key':idempotencyKey }, body:new URLSearchParams(payload) });
  const text=await response.text();
  let data:any={}; try { data=text ? JSON.parse(text) : {}; } catch { data={}; }
  if (!response.ok) throw new HttpError(502, data?.error?.message || 'Stripe Checkout session creation failed.');
  return data;
}
async function existingWorkOrder(supabase:any, estimateId:string, number:string) {
  const { data, error }=await supabase.from('work_orders').select('*').or(`estimate_id.eq.${estimateId},work_order_number.eq.${number}`).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if (error) throw error;
  return data || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers:corsHeaders });
  if (req.method !== 'POST') return Response.json({ ok:false, error:'Use POST.' }, { status:405, headers:corsHeaders });
  try {
    const url=Deno.env.get('SUPABASE_URL') || Deno.env.get('SB_URL') || '';
    const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SB_SERVICE_ROLE_KEY') || '';
    if (!url || !key) throw new HttpError(500, 'Customer portal is not configured.');
    const supabase=createClient(url,key,{ auth:{ persistSession:false } });
    const body=await req.json().catch(()=>({}));
    const action=clean(body.action || 'load',80);
    const token=clean(body.token,160);
    if (!tokenOk(token)) throw new HttpError(400, 'A valid portal token is required.');
    const pkg=await packageByToken(supabase,token);
    const forwarded=clean(req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),180).split(',')[0];
    const ipHash=forwarded ? await hashValue(`${forwarded}|${Deno.env.get('PORTAL_HASH_SALT') || 'ywi'}`) : null;
    const userAgent=clean(req.headers.get('user-agent'),500);

    if (action === 'load') {
      const timestamp=nowIso();
      await supabase.from('estimate_quote_packages').update({
        viewed_at:timestamp, first_viewed_at:pkg.first_viewed_at || timestamp, last_viewed_at:timestamp,
        portal_last_viewed_at:timestamp, open_count:Number(pkg.open_count || 0)+1, last_client_action:'viewed',
        last_client_action_at:timestamp, last_client_ip:ipHash, last_client_user_agent:userAgent, updated_at:timestamp
      }).eq('id',pkg.quote_package_id);
      await supabase.from('quote_package_client_events').insert({ quote_package_id:pkg.quote_package_id, event_action:'viewed', event_ip:ipHash, user_agent:userAgent });
      await supabase.from('customer_portal_events').insert({ quote_package_id:pkg.quote_package_id, estimate_id:pkg.estimate_id, work_order_id:pkg.work_order_id || null, event_type:'portal_viewed', event_payload:{ build:BUILD, schema:SCHEMA, ip_hash:ipHash } });
      const liveUpdates = await portalLiveUpdates(supabase, pkg.work_order_id);
      const notificationPreference = await portalNotificationPreference(supabase, pkg.client_id);
      return Response.json({ ok:true, portal:publicPackage(pkg, liveUpdates, notificationPreference) }, { headers:corsHeaders });
    }

    if (action === 'accept_quote') {
      if (pkg.accepted_at) {
        const existingUpdates = await portalLiveUpdates(supabase, pkg.work_order_id);
        const notificationPreference = await portalNotificationPreference(supabase, pkg.client_id);
        return Response.json({ ok:true, already_accepted:true, portal:publicPackage(pkg, existingUpdates, notificationPreference) }, { headers:corsHeaders });
      }
      const name=clean(body.customer_name,180);
      const email=clean(body.customer_email,260).toLowerCase();
      if (name.length < 2 || !validEmail(email)) throw new HttpError(400, 'Customer name and valid email are required.');
      if (body.accept_terms !== true) throw new HttpError(409, 'Quote terms must be accepted.');
      const acceptedResult=await callRpc(supabase,'ywi_rpc_accept_quote_package',{
        p_quote_package_id:pkg.quote_package_id,
        p_customer_name:name,
        p_customer_email:email,
        p_accept_terms:body.accept_terms === true,
        p_terms_version:clean(body.terms_version || '2026-06-18',80),
        p_acceptance_notes:clean(body.acceptance_notes,1000) || null,
        p_ip_hash:ipHash,
        p_user_agent:userAgent
      });
      const refreshed=await packageByToken(supabase,token);
      const liveUpdates=await portalLiveUpdates(supabase, refreshed.work_order_id);
      const notificationPreference=await portalNotificationPreference(supabase, refreshed.client_id);
      return Response.json({ ok:true, accepted:!acceptedResult.already_accepted, already_accepted:!!acceptedResult.already_accepted, work_order:{ id:acceptedResult.work_order_id, number:acceptedResult.work_order_number }, portal:publicPackage(refreshed, liveUpdates, notificationPreference), rpc:acceptedResult }, { headers:corsHeaders });
    }

    if (action === 'create_deposit_checkout') {
      if (!pkg.accepted_at) throw new HttpError(409, 'Accept the quote before paying a deposit.');
      const defaultCurrency=clean(Deno.env.get('DEFAULT_CURRENCY') || 'CAD',3).toUpperCase();
      const currency=validCurrency(defaultCurrency) ? defaultCurrency : 'CAD';
      const prepared=await callRpc(supabase,'ywi_rpc_prepare_deposit_request',{
        p_quote_package_id:pkg.quote_package_id,
        p_currency_code:currency,
        p_token_suffix:token.slice(-6)
      });
      if (prepared.already_paid) return Response.json({ ok:true, already_paid:true, portal:publicPackage(pkg), rpc:prepared }, { headers:corsHeaders });
      const deposit=prepared.deposit;
      if (deposit?.deposit_status === 'checkout_created' && deposit.checkout_url) return Response.json({ ok:true, reused:true, checkout_url:deposit.checkout_url, deposit, rpc:prepared }, { headers:corsHeaders });
      const stripeKey=clean(Deno.env.get('STRIPE_SECRET_KEY'),500);
      const siteUrl=publicSiteUrl(Deno.env.get('PUBLIC_SITE_URL') || Deno.env.get('SITE_URL'));
      if (!stripeKey || !siteUrl) {
        await supabase.rpc('ywi_rpc_mark_deposit_checkout_status', { p_deposit_request_id:deposit.id, p_deposit_status:'checkout_created', p_checkout_session_id:null, p_event_payload:{ setup_required:true, build:BUILD, schema:SCHEMA } });
        return Response.json({ ok:true, setup_required:true, message:'Deposit request saved. Configure STRIPE_SECRET_KEY and PUBLIC_SITE_URL to create hosted checkout.', deposit, rpc:prepared }, { headers:corsHeaders });
      }
      const remainingCents=Number(prepared.remaining_cents || cents(deposit.requested_amount));
      const session=await stripeCheckout(stripeKey, {
        mode:'payment', success_url:`${siteUrl}/?portal=${encodeURIComponent(token)}&deposit=success`, cancel_url:`${siteUrl}/?portal=${encodeURIComponent(token)}&deposit=cancelled`,
        'line_items[0][price_data][currency]':currency.toLowerCase(), 'line_items[0][price_data][product_data][name]':`Deposit for ${pkg.estimate_number}`,
        'line_items[0][price_data][unit_amount]':String(remainingCents), 'line_items[0][quantity]':'1',
        client_reference_id:deposit.id, customer_email:clean(body.customer_email || pkg.client_email,260),
        'metadata[deposit_request_id]':deposit.id, 'metadata[quote_package_id]':pkg.quote_package_id,
        'metadata[estimate_id]':pkg.estimate_id, 'metadata[requested_amount_cents]':String(remainingCents)
      }, `deposit-checkout-${deposit.id}`);
      const attached=await callRpc(supabase,'ywi_rpc_attach_deposit_checkout',{
        p_deposit_request_id:deposit.id,
        p_checkout_session_id:session.id,
        p_checkout_url:session.url,
        p_provider_payload:{ mode:session.mode, payment_status:session.payment_status, amount_total:session.amount_total, currency:session.currency }
      });
      return Response.json({ ok:true, checkout_url:session.url, deposit:attached.deposit || deposit, rpc:{ prepared, attached } }, { headers:corsHeaders });
    }

    if (action === 'set_live_update_notifications') {
      const enabled = body.live_work_update_email_opt_in === true;
      const result = await callRpc(supabase,'ywi_rpc_set_customer_live_update_email_preference',{
        p_quote_package_id:pkg.quote_package_id,
        p_portal_token:token,
        p_enable:enabled,
        p_contact_email:clean(body.contact_email,260) || null
      });
      const refreshed=await packageByToken(supabase,token);
      const liveUpdates=await portalLiveUpdates(supabase, refreshed.work_order_id);
      const notificationPreference=await portalNotificationPreference(supabase, refreshed.client_id);
      return Response.json({ ok:true, notification_preferences:result, portal:publicPackage(refreshed, liveUpdates, notificationPreference) }, { headers:corsHeaders });
    }

    if (action === 'request_service') {
      const name=clean(body.customer_name,180) || pkg.client_name || 'Customer';
      const email=clean(body.customer_email || pkg.client_email,260);
      const message=clean(body.message,2000);
      if (!message) throw new HttpError(400, 'Add a service request message.');
      const { data,error}=await supabase.from('quote_contact_requests').insert({
        request_status:'new', request_source:'customer_portal', full_name:name, contact_value:email || 'portal',
        service_type:clean(body.service_type || 'Existing quote follow-up',180), service_area:clean(body.service_area,180) || null,
        message, preferred_contact_method:validEmail(email) ? 'email' : 'portal', page_path:`/?portal=${token.slice(0,6)}…`, privacy_consent:true,
        metadata:{ build:BUILD, schema:SCHEMA, quote_package_id:pkg.quote_package_id, estimate_id:pkg.estimate_id }
      }).select('*').single();
      if (error) throw error;
      await supabase.from('customer_portal_events').insert({ quote_package_id:pkg.quote_package_id, estimate_id:pkg.estimate_id, work_order_id:pkg.work_order_id || null, event_type:'service_requested', customer_name:name, customer_email:email || null, event_note:message, event_payload:{ quote_contact_request_id:data.id } });
      return Response.json({ ok:true, request_id:data.id }, { headers:corsHeaders });
    }

    throw new HttpError(400, `Unsupported customer portal action: ${action}`);
  } catch (error) {
    const status=error instanceof HttpError ? error.status : 500;
    return Response.json({ ok:false, error:error instanceof Error ? error.message : 'Customer portal request failed.', details:error instanceof HttpError ? error.details : undefined }, { status, headers:corsHeaders });
  }
});

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUILD = '2026-06-17b';
const SCHEMA = 150;
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
function publicPackage(row:any) {
  return {
    quote_package_id:row.quote_package_id, package_status:row.package_status, rendered_title:row.rendered_title,
    rendered_html:row.rendered_html, rendered_markdown:row.rendered_markdown, accepted_at:row.accepted_at,
    accepted_by_name:row.accepted_by_name, deposit_required_amount:money(row.deposit_required_amount), deposit_status:row.deposit_status,
    estimate:{ id:row.estimate_id, number:row.estimate_number, status:row.estimate_status, subtotal:money(row.subtotal), tax_total:money(row.tax_total), total:money(row.total_amount), valid_until:row.valid_until },
    customer:{ name:row.client_name },
    work_order:row.work_order_id ? { id:row.work_order_id, number:row.work_order_number, status:row.work_order_status, scheduled_start:row.scheduled_start, scheduled_end:row.scheduled_end, schedule_status:row.schedule_status } : null,
    deposit:row.latest_deposit_request_id ? { id:row.latest_deposit_request_id, status:row.latest_deposit_status, requested_amount:money(row.latest_deposit_amount), paid_amount:money(row.latest_paid_amount), receipt_url:row.receipt_url } : null
  };
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
      return Response.json({ ok:true, portal:publicPackage(pkg) }, { headers:corsHeaders });
    }

    if (action === 'accept_quote') {
      if (pkg.accepted_at) return Response.json({ ok:true, already_accepted:true, portal:publicPackage(pkg) }, { headers:corsHeaders });
      const name=clean(body.customer_name,180);
      const email=clean(body.customer_email,260).toLowerCase();
      if (name.length < 2 || !validEmail(email)) throw new HttpError(400, 'Customer name and valid email are required.');
      if (body.accept_terms !== true) throw new HttpError(409, 'Quote terms must be accepted.');
      if (pkg.valid_until && new Date(`${pkg.valid_until}T23:59:59Z`) < new Date()) throw new HttpError(409, 'This quote has expired and needs review.');
      const timestamp=nowIso();
      const { data:claimed, error:packageError }=await supabase.from('estimate_quote_packages').update({
        package_status:'accepted', send_status:'accepted', accepted_at:timestamp, accepted_by_name:name, accepted_by_email:email,
        acceptance_notes:clean(body.acceptance_notes,1000) || null, last_client_action:'accepted', last_client_action_at:timestamp,
        portal_terms_version:clean(body.terms_version || '2026-06-17',80), portal_acceptance_ip_hash:ipHash,
        last_client_ip:ipHash, last_client_user_agent:userAgent, updated_at:timestamp
      }).eq('id',pkg.quote_package_id).is('accepted_at',null).select('id').maybeSingle();
      if (packageError) throw packageError;
      if (!claimed) {
        const refreshed=await packageByToken(supabase,token);
        return Response.json({ ok:true, already_accepted:true, portal:publicPackage(refreshed) }, { headers:corsHeaders });
      }
      const stableNumber=`WO-${clean(pkg.estimate_number,60).replace(/[^A-Za-z0-9-]/g,'-')}`.slice(0,80);
      let workOrder:any=pkg.work_order_id ? await existingWorkOrder(supabase,pkg.estimate_id,stableNumber) : null;
      if (!workOrder) workOrder=await existingWorkOrder(supabase,pkg.estimate_id,stableNumber);
      if (!workOrder) {
        const inserted=await supabase.from('work_orders').insert({
          work_order_number:stableNumber, estimate_id:pkg.estimate_id, client_id:pkg.client_id, work_type:'service', status:'draft',
          customer_notes:`Quote accepted through customer portal by ${name} (${email}).`, subtotal:money(pkg.subtotal), tax_total:money(pkg.tax_total), total_amount:money(pkg.total_amount)
        }).select('*').single();
        if (inserted.error) {
          workOrder=await existingWorkOrder(supabase,pkg.estimate_id,stableNumber);
          if (!workOrder) throw inserted.error;
        } else workOrder=inserted.data;
      }
      const { error:estimateError }=await supabase.from('estimates').update({ status:'accepted', approved_at:timestamp, converted_work_order_id:workOrder.id, converted_at:timestamp, updated_at:timestamp }).eq('id',pkg.estimate_id);
      if (estimateError) throw estimateError;
      await supabase.from('quote_package_client_events').insert({ quote_package_id:pkg.quote_package_id, event_action:'accepted', event_email:email, event_name:name, event_ip:ipHash, user_agent:userAgent, notes:clean(body.acceptance_notes,1000) || null });
      await supabase.from('customer_portal_events').insert({ quote_package_id:pkg.quote_package_id, estimate_id:pkg.estimate_id, work_order_id:workOrder.id, event_type:'quote_accepted', customer_name:name, customer_email:email, event_payload:{ terms_version:clean(body.terms_version || '2026-06-17',80), ip_hash:ipHash, build:BUILD, schema:SCHEMA } });
      const refreshed=await packageByToken(supabase,token);
      return Response.json({ ok:true, accepted:true, work_order:workOrder, portal:publicPackage(refreshed) }, { headers:corsHeaders });
    }

    if (action === 'create_deposit_checkout') {
      if (!pkg.accepted_at) throw new HttpError(409, 'Accept the quote before paying a deposit.');
      const required=money(pkg.deposit_required_amount);
      if (required <= 0) throw new HttpError(409, 'This quote does not have a deposit amount configured.');
      if (required > money(pkg.total_amount)) throw new HttpError(409, 'The configured deposit exceeds the quote total and must be corrected by staff.');
      const { data:allDeposits, error:depositListError }=await supabase.from('customer_deposit_requests').select('*').eq('quote_package_id',pkg.quote_package_id).order('created_at',{ascending:false});
      if (depositListError) throw depositListError;
      const paidCents=(allDeposits || []).filter((row:any)=>row.deposit_status==='paid').reduce((sum:number,row:any)=>sum+cents(row.paid_amount),0);
      const remainingCents=Math.max(0,cents(required)-paidCents);
      if (remainingCents === 0) return Response.json({ ok:true, already_paid:true, portal:publicPackage(pkg) }, { headers:corsHeaders });
      const amount=remainingCents/100;
      const now=Date.now();
      const reusable=(allDeposits || []).find((row:any)=>['requested','checkout_created'].includes(row.deposit_status) && cents(row.requested_amount)===remainingCents && (!row.expires_at || new Date(row.expires_at).getTime()>now));
      if (reusable?.deposit_status==='checkout_created' && reusable.checkout_url) return Response.json({ ok:true, reused:true, checkout_url:reusable.checkout_url, deposit:reusable }, { headers:corsHeaders });
      const defaultCurrency=clean(Deno.env.get('DEFAULT_CURRENCY') || 'CAD',3).toUpperCase();
      const currency=validCurrency(defaultCurrency) ? defaultCurrency : 'CAD';
      let deposit=reusable || null;
      if (!deposit) {
        const created=await supabase.from('customer_deposit_requests').insert({
          quote_package_id:pkg.quote_package_id, estimate_id:pkg.estimate_id, client_id:pkg.client_id,
          requested_amount:amount, currency_code:currency, deposit_status:'requested', checkout_provider:'stripe',
          expires_at:new Date(now+24*60*60*1000).toISOString(), metadata:{ build:BUILD, schema:SCHEMA, portal_token_suffix:token.slice(-6), exact_required_balance:true }
        }).select('*').single();
        if (created.error) throw created.error;
        deposit=created.data;
      }
      const stripeKey=clean(Deno.env.get('STRIPE_SECRET_KEY'),500);
      const siteUrl=publicSiteUrl(Deno.env.get('PUBLIC_SITE_URL') || Deno.env.get('SITE_URL'));
      if (!stripeKey || !siteUrl) {
        await supabase.from('customer_portal_events').insert({ quote_package_id:pkg.quote_package_id, estimate_id:pkg.estimate_id, work_order_id:pkg.work_order_id || null, event_type:'deposit_checkout_setup_required', event_status:'pending', event_payload:{ deposit_request_id:deposit.id } });
        return Response.json({ ok:true, setup_required:true, message:'Deposit request saved. Configure STRIPE_SECRET_KEY and PUBLIC_SITE_URL to create hosted checkout.', deposit }, { headers:corsHeaders });
      }
      const session=await stripeCheckout(stripeKey, {
        mode:'payment', success_url:`${siteUrl}/?portal=${encodeURIComponent(token)}&deposit=success`, cancel_url:`${siteUrl}/?portal=${encodeURIComponent(token)}&deposit=cancelled`,
        'line_items[0][price_data][currency]':currency.toLowerCase(), 'line_items[0][price_data][product_data][name]':`Deposit for ${pkg.estimate_number}`,
        'line_items[0][price_data][unit_amount]':String(remainingCents), 'line_items[0][quantity]':'1',
        client_reference_id:deposit.id, customer_email:clean(body.customer_email || pkg.client_email,260),
        'metadata[deposit_request_id]':deposit.id, 'metadata[quote_package_id]':pkg.quote_package_id,
        'metadata[estimate_id]':pkg.estimate_id, 'metadata[requested_amount_cents]':String(remainingCents)
      }, `deposit-checkout-${deposit.id}`);
      const updatedResult=await supabase.from('customer_deposit_requests').update({ deposit_status:'checkout_created', checkout_session_id:session.id, checkout_url:session.url, updated_at:nowIso() }).eq('id',deposit.id).eq('deposit_status','requested').select('*').maybeSingle();
      if (updatedResult.error) throw updatedResult.error;
      const updated=updatedResult.data || deposit;
      await supabase.from('estimate_quote_packages').update({ deposit_status:'checkout_created', updated_at:nowIso() }).eq('id',pkg.quote_package_id);
      await supabase.from('customer_portal_events').insert({ quote_package_id:pkg.quote_package_id, estimate_id:pkg.estimate_id, work_order_id:pkg.work_order_id || null, event_type:'deposit_checkout_created', event_payload:{ deposit_request_id:deposit.id, checkout_session_id:session.id, requested_amount:amount } });
      return Response.json({ ok:true, checkout_url:session.url, deposit:updated }, { headers:corsHeaders });
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

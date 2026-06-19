import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUILD='2026-06-18a';
const SCHEMA=151;
const jsonHeaders={ 'Content-Type':'application/json' };
const clean=(v:unknown,max=1000)=>String(v ?? '').trim().slice(0,max);
const money=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?Number(n.toFixed(2)):0;};
const cents=(v:unknown)=>Math.round(money(v)*100);
const nowIso=()=>new Date().toISOString();
function safeEqual(a:string,b:string){
  if(a.length!==b.length) return false;
  let diff=0; for(let i=0;i<a.length;i+=1) diff|=a.charCodeAt(i)^b.charCodeAt(i); return diff===0;
}
async function hmacHex(secret:string,payload:string){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b)=>b.toString(16).padStart(2,'0')).join('');
}
async function verify(raw:string,header:string,secret:string){
  const parts=header.split(',').map((part)=>part.trim().split('='));
  const timestamp=parts.find(([k])=>k==='t')?.[1]||'';
  const signatures=parts.filter(([k])=>k==='v1').map(([,v])=>v);
  if(!timestamp||!signatures.length) return false;
  if(Math.abs(Math.floor(Date.now()/1000)-Number(timestamp))>300) return false;
  const expected=await hmacHex(secret,`${timestamp}.${raw}`);
  return signatures.some((signature)=>safeEqual(signature,expected));
}
function validateSession(deposit:any,session:any){
  if(session.mode && session.mode!=='payment') throw new Error('Stripe session mode does not match a deposit payment.');
  if(deposit.checkout_session_id && session.id!==deposit.checkout_session_id) throw new Error('Stripe session does not match the saved checkout session.');
  if(session.metadata?.quote_package_id && session.metadata.quote_package_id!==deposit.quote_package_id) throw new Error('Stripe quote package metadata does not match the deposit request.');
  if(session.metadata?.estimate_id && deposit.estimate_id && session.metadata.estimate_id!==deposit.estimate_id) throw new Error('Stripe estimate metadata does not match the deposit request.');
  if(Number.isFinite(Number(session.amount_total)) && Number(session.amount_total)!==cents(deposit.requested_amount)) throw new Error('Stripe paid amount does not match the exact requested deposit.');
  const sessionCurrency=clean(session.currency,8).toUpperCase();
  const depositCurrency=clean(deposit.currency_code||'CAD',8).toUpperCase();
  if(sessionCurrency && sessionCurrency!==depositCurrency) throw new Error('Stripe currency does not match the deposit request.');
}

serve(async(req)=>{
  if(req.method!=='POST') return new Response(JSON.stringify({ok:false,error:'Use POST.'}),{status:405,headers:jsonHeaders});
  try{
    const url=Deno.env.get('SUPABASE_URL')||Deno.env.get('SB_URL')||'';
    const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||Deno.env.get('SB_SERVICE_ROLE_KEY')||'';
    const secret=Deno.env.get('STRIPE_WEBHOOK_SECRET')||'';
    if(!url||!key||!secret) throw new Error('Stripe webhook is not configured.');
    const raw=await req.text();
    const signature=req.headers.get('stripe-signature')||'';
    if(!await verify(raw,signature,secret)) return new Response(JSON.stringify({ok:false,error:'Invalid Stripe signature.'}),{status:400,headers:jsonHeaders});
    const event=JSON.parse(raw);
    const supported=new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired']);
    if(!supported.has(event.type)) return new Response(JSON.stringify({ok:true,ignored:true,reason:'event_type'}),{headers:jsonHeaders});
    const session=event?.data?.object||{};
    const depositId=clean(session?.metadata?.deposit_request_id||session?.client_reference_id,80);
    if(!depositId) return new Response(JSON.stringify({ok:true,ignored:true,reason:'deposit_id'}),{headers:jsonHeaders});
    const supabase=createClient(url,key,{auth:{persistSession:false}});
    const {data:deposit,error:depositError}=await supabase.from('customer_deposit_requests').select('*').eq('id',depositId).maybeSingle();
    if(depositError) throw depositError;
    if(!deposit) return new Response(JSON.stringify({ok:true,ignored:true,reason:'deposit_not_found'}),{headers:jsonHeaders});
    validateSession(deposit,session);

    const paymentSucceeded=event.type==='checkout.session.async_payment_succeeded' || (event.type==='checkout.session.completed' && session.payment_status==='paid');
    if(paymentSucceeded){
      const paidAmount=money(Number(session.amount_total||0)/100);
      const recorded=await supabase.rpc('ywi_rpc_record_portal_deposit_paid',{
        p_deposit_request_id:deposit.id,
        p_checkout_session_id:session.id,
        p_payment_reference:String(session.payment_intent||session.id),
        p_paid_amount:paidAmount,
        p_currency_code:clean(session.currency||deposit.currency_code||'CAD',8).toUpperCase(),
        p_event_payload:{ stripe_event_id:event.id, payment_status:session.payment_status, event_type:event.type, build:BUILD, schema:SCHEMA }
      });
      if(recorded.error) throw recorded.error;
    }else if(event.type==='checkout.session.completed'){
      const marked=await supabase.rpc('ywi_rpc_mark_deposit_checkout_status',{ p_deposit_request_id:deposit.id, p_deposit_status:'processing', p_checkout_session_id:session.id, p_event_payload:{ stripe_event_id:event.id, payment_status:session.payment_status, event_type:event.type, build:BUILD, schema:SCHEMA } });
      if(marked.error) throw marked.error;
    }else if(event.type==='checkout.session.async_payment_failed'){
      const marked=await supabase.rpc('ywi_rpc_mark_deposit_checkout_status',{ p_deposit_request_id:deposit.id, p_deposit_status:'failed', p_checkout_session_id:session.id, p_event_payload:{ stripe_event_id:event.id, payment_status:session.payment_status, event_type:event.type, build:BUILD, schema:SCHEMA } });
      if(marked.error) throw marked.error;
    }else if(event.type==='checkout.session.expired'){
      const marked=await supabase.rpc('ywi_rpc_mark_deposit_checkout_status',{ p_deposit_request_id:deposit.id, p_deposit_status:'expired', p_checkout_session_id:session.id, p_event_payload:{ stripe_event_id:event.id, event_type:event.type, build:BUILD, schema:SCHEMA } });
      if(marked.error) throw marked.error;
    }
    return new Response(JSON.stringify({ok:true,received:true}),{headers:jsonHeaders});
  }catch(error){
    return new Response(JSON.stringify({ok:false,error:error instanceof Error?error.message:'Webhook failed.'}),{status:500,headers:jsonHeaders});
  }
});

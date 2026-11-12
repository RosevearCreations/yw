/* YW563: protected AI Data Platform signed receipt-observation receiver.
 * Independent source pin and backend bearer are prerequisites, never self-enrolled.
 * This records Master-reported evidence ONLY; no Master owner decision is granted. */
import {serve} from 'https://deno.land/std@0.224.0/http/server.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import {canonicalMasterObservation,sha256hex,verifyMasterObservation} from './verification.mjs';

const json=(body:unknown,status=200)=>Response.json(body,{
 status,headers:{'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'"},
});
const fail=(status=403)=>json({ok:false,status:'HOLD_INDEPENDENT_MASTER_RECEIPT'},status);
async function tokenEqual(given:string,expected:string){
 if(!given||!expected||given.length>256||expected.length>256)return false;
 const a=await sha256hex(new TextEncoder().encode(given));
 const b=await sha256hex(new TextEncoder().encode(expected));
 let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
}
serve(async req=>{
 if(req.method!=='POST')return fail(405);
 if(Number(req.headers.get('content-length')||0)>8192)return fail(413);
 const token=Deno.env.get('YW563_MASTER_RECEIVER_TOKEN')||'';
 const url=Deno.env.get('SUPABASE_URL')||'';
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 if(!token||!url||!service)return fail(503);
 const bearer=req.headers.get('Authorization')||'';
 if(!bearer.startsWith('Bearer ')||!await tokenEqual(bearer.slice(7),token))
  return fail(401);
 try{
  const raw=await req.text();
  if(raw.length>8192)return fail(413);
  const body=JSON.parse(raw);
  if(!body||typeof body!=='object'||Array.isArray(body)||
   Object.keys(body).length!==2||!Object.hasOwn(body,'payload')||
   !Object.hasOwn(body,'signature'))return fail();
  const p=body.payload;
  canonicalMasterObservation(p);
  const sb=createClient(url,service,{
   auth:{persistSession:false,autoRefreshToken:false},
   global:{headers:{'X-YW563-Source':'independent-master-receipt-observer'}},
  });
  const pin=await sb.from('ywi_landscape_master_signer_pins_563')
   .select('issuer,key_id,public_key_b64,public_key_sha256,state,custody_evidence_ref,valid_from,valid_until')
   .eq('issuer',p.issuer).eq('key_id',p.key_id).eq('state','ACTIVE')
   .limit(1).maybeSingle();
  if(pin.error||!pin.data||!pin.data.custody_evidence_ref||
    Date.parse(pin.data.valid_from)>Date.now()||
    (pin.data.valid_until&&Date.parse(pin.data.valid_until)<=Date.now()))
   return fail();
  const verified=await verifyMasterObservation(p,body.signature,pin.data.public_key_b64);
  if(verified.public_key_sha256!==pin.data.public_key_sha256)return fail();
  // Atomic case-version, YW561 source receipt, YW562 owner pilot and replay
  // validation is completed inside the service-role-only database RPC.
  const observation=await sb.rpc('ywi_rpc_landscape_master_observation_admit_563',{
   p_company_id:p.company_id,p_request_id:p.request_id,
   p_case_version:p.case_version,
   p_provider_verified_receipt_id:p.provider_verified_receipt_id,
   p_source_pilot_decision_id:p.source_pilot_decision_id,
   p_issuer:p.issuer,p_key_id:p.key_id,
   p_controller_revision:p.controller_revision,
   p_master_receipt_ref:p.master_receipt_ref,
   p_master_claimed_sha256:p.master_claimed_sha256,
   p_observed_state:p.observed_state,p_nonce:p.nonce,
   p_issued_at:p.issued_at,
   p_canonical_sha256:verified.canonical_sha256,
   p_signature_sha256:verified.signature_sha256,
  });
  if(observation.error||!observation.data||
   observation.data.master_owner_accepted!==false||
   observation.data.customer_delivery_verified!==false||
   typeof observation.data.comparison!=='string')
   return fail(409);
  return json({
   ok:true,status:'INDEPENDENT_MASTER_RECEIPT_OBSERVED_OWNER_HOLD',
   observation_id:observation.data.observation_id,
   comparison:observation.data.comparison,
   replayed:observation.data.replayed,
   master_owner_accepted:false,customer_delivery_verified:false,
  });
 }catch(_){
  return fail(); // Never log customer case identifiers, tokens or signed payloads.
 }
});

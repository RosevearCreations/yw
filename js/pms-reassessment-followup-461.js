/* YW 461: genuine third-party reassessment aging and owner-only internal evidence request journal.
 * Never dispatches outbound requests or authorizes field work, review closure or production release. */
(()=>{'use strict';
const modules=Object.freeze(['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture']);
const outcomes=Object.freeze(['difference_confirmed','evidence_gap_confirmed','further_review_required']);
const kinds=Object.freeze(['request_new_field_observation','request_source_clarification','keep_on_hold']);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const fresh=x=>Number.isFinite(Date.parse(x))&&Date.parse(x)<=Date.now()+60000&&Date.now()-Date.parse(x)<=300000;
const sampled=(a,n,c)=>Array.isArray(a)&&a.length<=60&&Number.isSafeInteger(n)&&n===a.length&&c===false;
const denied=['field_accepted','service_authorized','independent_reapproval','release_green','outbound_actions','mutation_authorized','synthetic'];
function requestId(){const c=globalThis.crypto;if(c?.randomUUID)return c.randomUUID();if(!c?.getRandomValues)throw Error('Secure randomness unavailable');
 const b=c.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const s=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');}
function inspectInbox(x,{userId}={}){
 if(!uuid(userId)||x?.viewer_id!==userId||!fresh(x.captured_at)||
  !sampled(x.companies,x.total,x.sample_capped)||
  !['field_accepted','service_authorized','release_green','outbound_actions'].every(k=>x[k]===false))
  return {state:'withheld',reason:'Unverified owner-company inbox'};
 const seen=new Set();for(const c of x.companies){if(!uuid(c.id)||!c.name||seen.has(c.id))return {state:'withheld',reason:'Duplicate or foreign owner company'};seen.add(c.id);}
 return {state:'source_verified',companies:x.companies};
}
function inspect(x,{companyId,userId}={}){
 if(!uuid(companyId)||!uuid(userId)||x?.company_id!==companyId||x.viewer_id!==userId||x.is_owner!==true||
  !fresh(x.captured_at)||!denied.every(k=>x[k]===false)||x.aging_attention_days!==7||
  !Array.isArray(x.services)||x.services.length!==7||
  !sampled(x.reassessments,x.reassessment_total,x.reassessment_sample_capped)||
  !sampled(x.requests,x.request_total,x.request_sample_capped))
  return {state:'withheld',reason:'Reassessment source stale, incomplete or falsely approving'};
 const seen=new Set();for(const s of x.services){if(s.company_id!==companyId||!modules.includes(s.module_key)||
  typeof s.enabled!=='boolean'||seen.has(s.module_key))return {state:'withheld',reason:'Module toggles unverified'};seen.add(s.module_key);}
 seen.clear();for(const r of x.reassessments){
  const age=Math.floor((Date.parse(x.captured_at)-Date.parse(r.reassessed_at))/86400000);
  if(!uuid(r.reassessment_id)||seen.has(r.reassessment_id)||r.company_id!==companyId||
   !uuid(r.triage_id)||!uuid(r.comparison_id)||!uuid(r.owner_user_id)||r.owner_user_id!==userId||
   !uuid(r.reassessor_user_id)||r.reassessor_user_id===userId||!uuid(r.target_id)||
   !['work_orders','estimates'].includes(r.target_table)||!modules.includes(r.service_module_key)||
   !outcomes.includes(r.reassessment_outcome)||!['comparison_differs','insufficient_evidence'].includes(r.comparison_outcome)||
   (r.reassessment_outcome==='difference_confirmed'&&r.comparison_outcome!=='comparison_differs')||
   (r.reassessment_outcome==='evidence_gap_confirmed'&&r.comparison_outcome!=='insufficient_evidence')||
   !Number.isFinite(Date.parse(r.compared_at))||!Number.isFinite(Date.parse(r.triaged_at))||
   !Number.isFinite(Date.parse(r.reassessed_at))||Date.parse(r.triaged_at)<=Date.parse(r.compared_at)||
   Date.parse(r.reassessed_at)<=Date.parse(r.triaged_at)||age<0||r.age_days!==age||
   typeof r.reassessment_reference!=='string'||r.reassessment_reference.trim().length<4)
   return {state:'withheld',reason:'Foreign or incoherent independent reassessment chain'};
  seen.add(r.reassessment_id);
 }
 seen.clear();for(const e of x.requests){const r=x.reassessments.find(r=>r.reassessment_id===e.reassessment_id);
  if(!uuid(e.id)||seen.has(e.id)||e.company_id!==companyId||e.owner_user_id!==userId||!r||
   !kinds.includes(e.request_kind)||!e.source_reference||e.source_reference.trim().length<4||
   !Number.isFinite(Date.parse(e.created_at))||Date.parse(e.created_at)<Date.parse(r.reassessed_at))
   return {state:'withheld',reason:'Unlinked or unauthorized follow-up journal'};seen.add(e.id);}
 return {state:'source_verified',companyId,userId,services:x.services,reassessments:x.reassessments,
  requests:x.requests,attentionDays:7,fieldAccepted:false,serviceAuthorized:false,releaseGreen:false};
}
window.YWI461=Object.freeze({inspect,inspectInbox,kinds,outcomes,modules});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('reassessment461'))return;
 const panel=node('details');panel.id='reassessment461';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='PMS · Reassessment Follow-Up Aging';panel.dataset.adminHubGroups='management operations';
 panel.append(node('summary','461 · Reassessment Aging & Owner Evidence Requests'));
 const body=node('div');body.className='admin-panel-block pms461';
 body.append(node('p','Review genuine independently recorded 460 reassessments. Seven days is an attention indicator, not a deadline or automatic escalation. Evidence requests here are INTERNAL records only: no email, SMS, job, approval or real-world action is sent.'));
 const help=node('a','ⓘ Reassessment evidence request Help');help.href='/help.html#pms-reassessment-followup-461';body.append(help);
 const controls=node('div');controls.className='pms461-controls';const l=node('label','Owned first-service company'),company=node('select');company.id='pms461Company';l.append(company);
 const refresh=node('button','Verify independent reassessment sources');refresh.id='pms461Refresh';refresh.type='button';refresh.className='secondary';controls.append(l,refresh);body.append(controls);
 const status=node('p','HOLD: verify signed-in owner, reassessment sources and module switches.');status.id='pms461Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const summary=node('section');summary.id='pms461Overview';summary.setAttribute('aria-label','Documentary reassessment aging');body.append(summary);
 const journal=node('section');journal.id='pms461Journal';journal.setAttribute('aria-label','Independent findings and internal evidence request journal');body.append(journal);
 const form=node('fieldset');form.id='pms461Form';form.disabled=true;form.append(node('legend','Owner: record internal evidence follow-up without dispatch'));
 const field=(id,desc,tag,max)=>{const l=node('label',desc),e=node(tag);e.id=id;if(max)e.maxLength=max;l.append(e);form.append(l);return e;};
 const select=field('pms461Reassessment','Verified finding awaiting an owner request','select');
 const kind=field('pms461Kind','Internal documentary request type','select');for(const v of kinds){const o=node('option',v.replaceAll('_',' '));o.value=v;kind.append(o);}
 const source=field('pms461Reference','Evidence source reference (4–250 characters)','input',250);
 const notes=field('pms461Notes','Context / source owner (optional, maximum 500 characters)','textarea',500);
 const submit=node('button','Record owner-only evidence request');submit.id='pms461Append';submit.type='button';submit.className='secondary';form.append(submit);body.append(form);
 const hold=node('p','HOLD: Requests stay inside this private journal. The original independent 457 decision, Safety, Jobs, financial, service and Production gates remain unchanged. Real-world outreach requires a separate human-approved process.');hold.id='pms461Hold';hold.className='notice';body.append(hold);
 panel.append(body);host.append(panel);
 let epoch=0,busy=false,verified=null,principal=null;
 const info=x=>{status.textContent=x;};
 function options(el,placeholder,arr,label,value){el.replaceChildren();const p=node('option',placeholder);p.value='';el.append(p);for(const x of arr){const o=node('option',label(x));o.value=value(x);el.append(o);}}
 function invalidate(message){epoch++;verified=null;principal=null;company.replaceChildren();form.disabled=true;summary.replaceChildren();journal.replaceChildren();info(message);}
 async function session(){const auth=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(auth?.isAuthenticated!==true||!uuid(auth.user?.id)||!sb?.auth?.getUser||!sb?.rpc||
   !window.YWISecurity?.canViewModule?.('jobs',auth.role,'view'))throw Error('Signed-in Jobs permission required');
  const who=await sb.auth.getUser();if(who.error||who.data?.user?.id!==auth.user.id)throw Error('Session changed');
  return {uid:auth.user.id,sb};}
 const alive=(ctx,ver,id)=>epoch===ver&&company.value===id&&
  window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&window.YWI_AUTH.getState().user?.id===ctx.uid;
 function show(d){verified=d;form.disabled=true;summary.replaceChildren();journal.replaceChildren();if(d.state!=='source_verified')return info('WITHHELD: '+d.reason);
  const attention=d.reassessments.filter(r=>r.age_days>=d.attentionDays);
  info('SOURCE VERIFIED: '+d.reassessments.length+' independent findings · '+attention.length+' aged 7+ days · '+d.requests.length+' internal requests. Field authority HOLD.');
  summary.append(node('p','Service switches: '+d.services.filter(x=>x.enabled).length+' ON / '+d.services.filter(x=>!x.enabled).length+' OFF'));
  summary.append(node('p','Aging notice only: '+attention.length+' require owner attention after 7 days. No automatic closure, dispatch or escalation.'));
  for(const r of d.reassessments){const row=node('article');row.className='pms461-entry';
   row.append(node('strong',r.service_module_key+' · '+r.reassessment_outcome.replaceAll('_',' ')),
    node('p',r.age_days+' day(s) since independent finding · '+r.reassessment_reference));
   if(r.age_days>=d.attentionDays)row.append(node('p','Attention: follow-up age is 7+ days; HOLD remains.'));
   const e=d.requests.find(e=>e.reassessment_id===r.reassessment_id);
   row.append(node('p',e?'Owner internal request: '+e.request_kind.replaceAll('_',' ')+' · '+e.source_reference:'No internal owner evidence request yet'));
   journal.append(row);}
  if(!d.reassessments.length)journal.append(node('p','No genuine independent findings; no fictional or synthetic evidence created.'));
  const open=d.reassessments.filter(r=>!d.requests.some(e=>e.reassessment_id===r.reassessment_id)&&
   d.services.some(s=>s.module_key===r.service_module_key&&s.enabled));
  options(select,'Choose unrequested, source-linked reassessment',open,
   r=>r.service_module_key+' · '+r.reassessment_outcome+' · '+r.age_days+' days',r=>r.reassessment_id);
  form.disabled=!open.length;
 }
 async function reconcile(){const version=epoch,ctx=await session();
  const list=await ctx.sb.rpc('ywi_rpc_reassessment_owner_inbox_461');if(epoch!==version||list.error)throw Error('Owner company inbox denied');
  const checked=inspectInbox(list.data,{userId:ctx.uid});if(checked.state!=='source_verified')throw Error(checked.reason);
  const previous=company.value;options(company,'Choose verified owner company',checked.companies,c=>c.name,c=>c.id);
  if(checked.companies.some(c=>c.id===previous))company.value=previous;
  else if(checked.companies.length===1)company.value=checked.companies[0].id;
  principal=ctx.uid;const id=company.value;if(!id){info('HOLD: select an owned real company');return;}
  const a=await ctx.sb.rpc('ywi_rpc_reassessment_followups_461',{p_company_id:id});
  if(!alive(ctx,version,id)||a.error||!a.data)throw Error('Independent source read denied');
  const b=await ctx.sb.rpc('ywi_rpc_reassessment_followups_461',{p_company_id:id});
  if(!alive(ctx,version,id)||b.error||!b.data||
   ['services','reassessments','requests'].some(k=>JSON.stringify(a.data[k])!==JSON.stringify(b.data[k])))
   throw Error('Service modules or independent findings changed during source verification');
  show(inspect(b.data,{companyId:id,userId:ctx.uid}));}
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=true;verified=null;form.disabled=true;
  info('Checking independent findings, source identity and active company modules…');
  try{await reconcile();}catch(e){show({state:'withheld',reason:e.message||String(e)});}finally{busy=false;refresh.disabled=company.disabled=false;}});
 submit.addEventListener('click',async()=>{if(busy||verified?.state!=='source_verified')return;
  const id=company.value,version=epoch,r=verified.reassessments.find(r=>r.reassessment_id===select.value),
   type=kind.value,ref=source.value.trim(),memo=notes.value.trim();
  if(!r||verified.requests.some(e=>e.reassessment_id===r.reassessment_id)||
   !verified.services.some(s=>s.module_key===r.service_module_key&&s.enabled)||!kinds.includes(type)||
   ref.length<4||ref.length>250||memo.length>500)return info('WITHHELD: source-linked unrequested finding and source reference required');
  if(!window.confirm('Record an INTERNAL owner evidence request only? No notifications, service approvals, 457 closure or production release.'))return;
  busy=true;form.disabled=refresh.disabled=true;
  try{const ctx=await session();if(ctx.uid!==principal||!alive(ctx,version,id))throw Error('Owner session changed');
   const result=await ctx.sb.rpc('ywi_rpc_request_reassessment_evidence_461',{
    p_company_id:id,p_request_id:requestId(),p_reassessment_id:r.reassessment_id,
    p_request_kind:type,p_source_reference:ref,p_notes:memo||null});
   if(!alive(ctx,version,id)||result.error||!uuid(result.data?.id)||result.data?.company_id!==id||
    result.data?.recorded!==true||
    !['field_accepted','service_authorized','independent_reapproval','outbound_actions','release_green'].every(k=>result.data[k]===false))
    throw Error('Unverified write receipt');
   source.value=notes.value='';await reconcile();
  }catch(e){verified=null;info('WITHHELD: '+(e.message||e)+'. Inspect private journal before any manual retry.');}
  finally{busy=false;refresh.disabled=false;form.disabled=verified?.state!=='source_verified'||
   !verified.reassessments.some(r=>!verified.requests.some(e=>e.reassessment_id===r.reassessment_id));}});
 company.addEventListener('change',()=>{epoch++;verified=null;form.disabled=true;summary.replaceChildren();journal.replaceChildren();info('HOLD: owner company changed; verify again.');});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])
  document.addEventListener(event,()=>invalidate('HOLD: identity, permission or company offering changed; verify again.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

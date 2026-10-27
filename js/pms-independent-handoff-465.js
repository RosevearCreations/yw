/* YW 465: owner-verified proposal and separate reviewer internal acknowledgement. */
(()=>{'use strict';
const modules=Object.freeze(['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture']);
const responses=Object.freeze(['acknowledged_for_review','declined_handoff']);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const el=(tag,value)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=value;return x;};
const time=x=>Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const fresh=x=>Number.isFinite(time(x))&&time(x)<=Date.now()+60000&&Date.now()-time(x)<=300000;
const prior=(a,b)=>Number.isFinite(time(a))&&Number.isFinite(time(b))&&time(a)<=time(b);
const sample=(a,total,cap)=>Array.isArray(a)&&a.length<=60&&Number.isSafeInteger(total)&&a.length===total&&cap===false;
const denied=['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions','mutation_authorized','synthetic'];
function operationId(){const c=globalThis.crypto;if(c?.randomUUID)return c.randomUUID();if(!c?.getRandomValues)throw Error('Secure randomness unavailable');
 const b=c.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const s=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');}
function inspectInbox(x,{userId}={}){
 if(!uuid(userId)||x?.viewer_id!==userId||!fresh(x.captured_at)||!sample(x.companies,x.total,x.sample_capped)||
  !['field_accepted','release_green','outbound_actions'].every(k=>x[k]===false))return {state:'withheld',reason:'Independent handoff inbox unverified'};
 const seen=new Set();for(const c of x.companies){if(!uuid(c.id)||!c.name||typeof c.is_owner!=='boolean'||typeof c.is_reviewer!=='boolean'||
  (!c.is_owner&&!c.is_reviewer)||seen.has(c.id))return {state:'withheld',reason:'Foreign or duplicate handoff company'};seen.add(c.id);}
 return {state:'source_verified',companies:x.companies};
}
function inspect(x,{companyId,userId}={}){
 if(!uuid(companyId)||!uuid(userId)||x?.company_id!==companyId||x.viewer_id!==userId||!fresh(x.captured_at)||
  (!x.is_owner&&!x.is_reviewer)||!denied.every(k=>x[k]===false)||!Array.isArray(x.services)||x.services.length!==7||
  !sample(x.cases,x.case_total,x.case_sample_capped)||!sample(x.handoffs,x.handoff_total,x.handoff_sample_capped)||
  !sample(x.receipts,x.receipt_total,x.receipt_sample_capped))return {state:'withheld',reason:'Independent handoff source incomplete or falsely authorizing'};
 const services=new Map();for(const s of x.services){if(s.company_id!==companyId||!modules.includes(s.module_key)||typeof s.enabled!=='boolean'||services.has(s.module_key))
  return {state:'withheld',reason:'Company service switches invalid'};services.set(s.module_key,s.enabled);}
 const cases=new Map();for(const c of x.cases){if(!uuid(c.proposal_id)||cases.has(c.proposal_id)||c.company_id!==companyId||!uuid(c.owner_user_id)||
  !uuid(c.proposed_reviewer_user_id)||!uuid(c.old_reviewer_id)||!uuid(c.reassessor_user_id)||!uuid(c.comparing_reviewer_id)||
  [c.owner_user_id,c.old_reviewer_id,c.reassessor_user_id,c.comparing_reviewer_id].includes(c.proposed_reviewer_user_id)||
  (x.is_owner&&c.owner_user_id!==userId)||!uuid(c.outcome_id)||!uuid(c.evidence_outcome_id)||
  !['evidence_incomplete','further_review_required'].includes(c.disposition)||!c.proposal_reference||c.proposal_reference.trim().length<4||
  !prior(c.discrepancy_at,c.proposed_at)||!prior(c.proposed_at,x.captured_at)||!modules.includes(c.service_module_key)||
  !['estimates','work_orders'].includes(c.target_table)||!uuid(c.target_id)||typeof c.service_enabled!=='boolean'||
  services.get(c.service_module_key)!==c.service_enabled)
  return {state:'withheld',reason:'Original owner proposal lineage invalid'};cases.set(c.proposal_id,c);}
 const handoffs=new Map();for(const h of x.handoffs){const c=cases.get(h.proposal_id);
  if(!uuid(h.id)||handoffs.has(h.id)||h.company_id!==companyId||!c||h.owner_user_id!==c.owner_user_id||
   h.reviewer_user_id!==c.proposed_reviewer_user_id||(!x.is_owner&&h.reviewer_user_id!==userId)||
   !h.source_reference||h.source_reference.trim().length<4||!prior(c.proposed_at,h.created_at)||!prior(h.created_at,x.captured_at))
   return {state:'withheld',reason:'Handoff identity or source invalid'};handoffs.set(h.id,h);}
 const seen=new Set();for(const r of x.receipts){const h=handoffs.get(r.handoff_id);
  if(!uuid(r.id)||seen.has(r.id)||!h||r.company_id!==companyId||r.reviewer_user_id!==h.reviewer_user_id||
   !responses.includes(r.response)||!r.source_reference||r.source_reference.trim().length<4||
   !prior(h.created_at,r.created_at)||!prior(r.created_at,x.captured_at))
   return {state:'withheld',reason:'Unlinked or false reviewer receipt'};seen.add(r.id);}
 if(!x.is_owner&&x.cases.some(c=>!x.handoffs.some(h=>h.proposal_id===c.proposal_id&&h.reviewer_user_id===userId)))
  return {state:'withheld',reason:'Reviewer sees unassigned proposal'};
 return {state:'source_verified',companyId,userId,isOwner:x.is_owner===true,isReviewer:x.is_reviewer===true,
  services:x.services,cases:x.cases,handoffs:x.handoffs,receipts:x.receipts,releaseGreen:false};
}
window.YWI465=Object.freeze({inspect,inspectInbox,responses,modules});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('handoff465'))return;
 const panel=el('details');panel.id='handoff465';panel.className='admin-hub-detail';panel.dataset.adminHubTitle='PMS · Separate Reviewer Handoff';panel.dataset.adminHubGroups='management operations';
 panel.append(el('summary','465 · Independent Reassignment Verification & Reviewer Handoff'));
 const body=el('div');body.className='admin-panel-block pms465';body.append(el('p','Verify an actual 464 alternative-reviewer proposal and expose one internal handoff to that separate reviewer. The reviewer must sign in independently to acknowledge or decline. No email, SMS, field approval or work assignment.'));
 const help=el('a','ⓘ Separate reviewer handoff Help');help.href='/help.html#pms-independent-handoff-465';body.append(help);
 const controls=el('div');controls.className='pms465-controls';const companyLabel=el('label','Verified owner or assigned reviewer company'),company=el('select'),refresh=el('button','Verify handoff source');
 company.id='pms465Company';companyLabel.append(company);refresh.id='pms465Refresh';refresh.type='button';refresh.className='secondary';controls.append(companyLabel,refresh);body.append(controls);
 const status=el('p','HOLD: verify separate reviewer and original evidence chain.');status.id='pms465Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const journal=el('section');journal.id='pms465Journal';body.append(journal);
 const form=(id,label)=>{const f=el('fieldset');f.id=id;f.disabled=true;f.append(el('legend',label));body.append(f);return f;};
 const ownerForm=form('pms465OwnerForm','Owner: verify proposed reviewer and record INTERNAL handoff');
 const reviewerForm=form('pms465ReviewerForm','Separate reviewer: acknowledge or decline internal handoff');
 const field=(f,id,label,tag,max)=>{const l=el('label',label),x=el(tag);x.id=id;if(max)x.maxLength=max;l.append(x);f.append(l);return x;};
 const proposal=field(ownerForm,'pms465Proposal','Unhanded verified proposal','select');
 const ownerRef=field(ownerForm,'pms465OwnerRef','Verified handoff source reference','input',250);
 const ownerNotes=field(ownerForm,'pms465OwnerNotes','Owner notes (optional)','textarea',500);
 const assign=el('button','Record internal separate reviewer handoff');assign.id='pms465Verify';assign.type='button';assign.className='secondary';ownerForm.append(assign);
 const handoff=field(reviewerForm,'pms465Handoff','Your verified pending handoff','select');
 const response=field(reviewerForm,'pms465Response','Your independent response','select');for(const d of responses){const o=el('option',d.replaceAll('_',' '));o.value=d;response.append(o);}
 const reviewerRef=field(reviewerForm,'pms465ReviewerRef','Reviewer acknowledgement source reference','input',250);
 const reviewerNotes=field(reviewerForm,'pms465ReviewerNotes','Reviewer notes (optional)','textarea',500);
 const ack=el('button','Record reviewer acknowledgement or decline');ack.id='pms465Ack';ack.type='button';ack.className='secondary';reviewerForm.append(ack);
 const hold=el('p','HOLD: A separate reviewer acknowledgement is not new field evidence, a completed reassignment, an independent comparison, Safety clearance, Jobs authorization, 457 closure, or a Production release. All provider notifications remain OFF.');hold.id='pms465Hold';hold.className='notice';body.append(hold);
 panel.append(body);host.append(panel);
 let epoch=0,busy=false,verified=null,principal=null;
 const options=(node,placeholder,items,show,key)=>{node.replaceChildren();const p=el('option',placeholder);p.value='';node.append(p);for(const i of items){const o=el('option',show(i));o.value=key(i);node.append(o);}};
 const invalidate=message=>{epoch++;verified=null;principal=null;ownerForm.disabled=reviewerForm.disabled=true;company.replaceChildren();journal.replaceChildren();status.textContent=message;};
 async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.rpc||!sb.auth?.getUser||!window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Active Jobs sign-in required');
  const who=await sb.auth.getUser();if(who.error||who.data?.user?.id!==a.user.id)throw Error('Reviewer or owner identity changed');return {uid:a.user.id,sb};}
 function show(d){verified=d;journal.replaceChildren();ownerForm.disabled=reviewerForm.disabled=true;if(d.state!=='source_verified'){status.textContent='WITHHELD: '+d.reason;return;}
  status.textContent='SOURCE VERIFIED: '+d.cases.length+' independent proposals · '+d.handoffs.length+' internal handoffs · '+d.receipts.length+' human responses. Field acceptance HOLD.';
  for(const c of d.cases){const h=d.handoffs.find(x=>x.proposal_id===c.proposal_id),r=h&&d.receipts.find(x=>x.handoff_id===h.id),row=el('article');row.className='pms465-entry';
   row.append(el('strong',c.service_module_key+' · '+c.disposition.replaceAll('_',' ')),
    el('p','Owner proposal: '+c.proposal_reference),el('p',h?'Internal handoff source: '+h.source_reference:'Awaiting owner verification'),
    el('p',r?'Separate reviewer response: '+r.response.replaceAll('_',' ')+' · '+r.source_reference:'Independent response pending; HOLD remains'));
   journal.append(row);}
  if(!d.cases.length)journal.append(el('p','No genuine reviewer proposals or assigned handoffs in this company.'));
  const open=d.isOwner?d.cases.filter(c=>c.service_enabled&&!d.handoffs.some(h=>h.proposal_id===c.proposal_id)):[];
  options(proposal,'Choose unhanded owner proposal',open,c=>c.service_module_key+' · '+c.proposal_reference,c=>c.proposal_id);ownerForm.disabled=!open.length;
  const pending=d.isReviewer?d.handoffs.filter(h=>h.reviewer_user_id===d.userId&&!d.receipts.some(r=>r.handoff_id===h.id)&&d.cases.some(c=>c.proposal_id===h.proposal_id&&c.service_enabled)):[];
  options(handoff,'Choose your pending separate reviewer handoff',pending,h=>h.source_reference,h=>h.id);reviewerForm.disabled=!pending.length;}
 async function reconcile(){const ticket=epoch,ctx=await session();const inbox=await ctx.sb.rpc('ywi_rpc_handoff_inbox_465');if(ticket!==epoch||inbox.error)throw Error('Handoff inbox denied');
  const checked=inspectInbox(inbox.data,{userId:ctx.uid});if(checked.state!=='source_verified')throw Error(checked.reason);
  const old=company.value;options(company,'Choose verified company',checked.companies,c=>c.name+(c.is_owner?' · owner':' · reviewer'),c=>c.id);
  if(checked.companies.some(c=>c.id===old))company.value=old;else if(checked.companies.length===1)company.value=checked.companies[0].id;
  const id=company.value;if(!id){status.textContent='HOLD: choose a verified owner or reviewer company';return;}principal=ctx.uid;
  const a=await ctx.sb.rpc('ywi_rpc_handoff_workspace_465',{p_company_id:id}),b=await ctx.sb.rpc('ywi_rpc_handoff_workspace_465',{p_company_id:id});
  if(ticket!==epoch||company.value!==id||window.YWI_AUTH?.getState?.()?.user?.id!==ctx.uid||a.error||b.error||!a.data||!b.data||
   ['services','cases','handoffs','receipts'].some(k=>JSON.stringify(a.data[k])!==JSON.stringify(b.data[k])))throw Error('Handoff source changed or denied');
  show(inspect(b.data,{companyId:id,userId:ctx.uid}));}
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=ownerForm.disabled=reviewerForm.disabled=true;
  try{await reconcile();}catch(e){show({state:'withheld',reason:e.message||String(e)});}finally{busy=false;refresh.disabled=company.disabled=false;}});
 async function write(name,args,id){const ctx=await session();if(ctx.uid!==principal||company.value!==id)throw Error('Owner or reviewer identity changed');
  const result=await ctx.sb.rpc(name,args);if(result.error||!uuid(result.data?.id)||result.data.company_id!==id||result.data.recorded!==true||
   !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions'].every(k=>result.data[k]===false))
   throw Error('Unverified immutable handoff receipt');await reconcile();}
 assign.addEventListener('click',async()=>{const d=verified,id=company.value,c=d?.cases.find(x=>x.proposal_id===proposal.value),ref=ownerRef.value.trim(),memo=ownerNotes.value.trim();
  if(busy||d?.state!=='source_verified'||!d.isOwner||!c||!c.service_enabled||d.handoffs.some(h=>h.proposal_id===c.proposal_id)||
   [d.userId,c.old_reviewer_id,c.reassessor_user_id,c.comparing_reviewer_id].includes(c.proposed_reviewer_user_id)||
   ref.length<4||ref.length>250||memo.length>500)return status.textContent='WITHHELD: distinct proposed reviewer and unhanded source required';
  if(!window.confirm('Record INTERNAL handoff to the already proposed independent reviewer? No message or work authorization.'))return;
  busy=true;ownerForm.disabled=refresh.disabled=true;try{await write('ywi_rpc_verify_handoff_465',{p_company_id:id,p_operation_id:operationId(),p_proposal_id:c.proposal_id,p_source_reference:ref,p_notes:memo||null},id);
   ownerRef.value=ownerNotes.value='';}catch(e){verified=null;status.textContent='WITHHELD: '+(e.message||e)+'. Inspect journal before retry.';}
  finally{busy=false;refresh.disabled=false;ownerForm.disabled=verified?.state!=='source_verified'||!verified.isOwner||!verified.cases.some(c=>c.service_enabled&&!verified.handoffs.some(h=>h.proposal_id===c.proposal_id));}});
 ack.addEventListener('click',async()=>{const d=verified,id=company.value,h=d?.handoffs.find(x=>x.id===handoff.value),ref=reviewerRef.value.trim(),memo=reviewerNotes.value.trim();
  if(busy||d?.state!=='source_verified'||!d.isReviewer||!h||h.reviewer_user_id!==d.userId||d.receipts.some(r=>r.handoff_id===h.id)||
   !responses.includes(response.value)||ref.length<4||ref.length>250||memo.length>500)return status.textContent='WITHHELD: assigned independent reviewer response required';
  if(!window.confirm('Record your own INTERNAL handoff acknowledgement or decline? This is not field evidence or approval.'))return;
  busy=true;reviewerForm.disabled=refresh.disabled=true;try{await write('ywi_rpc_ack_handoff_465',{p_company_id:id,p_operation_id:operationId(),p_handoff_id:h.id,
   p_response:response.value,p_source_reference:ref,p_notes:memo||null},id);reviewerRef.value=reviewerNotes.value='';}
  catch(e){verified=null;status.textContent='WITHHELD: '+(e.message||e)+'. Inspect journal before retry.';}
  finally{busy=false;refresh.disabled=false;reviewerForm.disabled=verified?.state!=='source_verified'||!verified.isReviewer||!verified.handoffs.some(h=>h.reviewer_user_id===verified.userId&&!verified.receipts.some(r=>r.handoff_id===h.id));}});
 company.addEventListener('change',()=>{epoch++;verified=null;ownerForm.disabled=reviewerForm.disabled=true;journal.replaceChildren();status.textContent='HOLD: company changed; verify again.';});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])document.addEventListener(event,()=>invalidate('HOLD: identity, permissions or service switch changed; verify again.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

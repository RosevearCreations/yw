/* YW 466/467: human comparison, separate owner exception follow-up; HOLD always. */
(()=>{'use strict';
const alignments=Object.freeze(['matches_recorded_chain','material_gap','additional_evidence_required']);
const dispositions=Object.freeze(['exception_remains_open','request_source_clarification','ready_for_owner_reassessment']);
const decisions=Object.freeze(['request_further_evidence','retain_exception_hold','documentary_closeout']);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const time=x=>Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const before=(a,b)=>Number.isFinite(time(a))&&Number.isFinite(time(b))&&time(a)<=time(b);
const sample=(a,total,capped)=>Array.isArray(a)&&a.length<=60&&Number.isSafeInteger(total)&&a.length===total&&capped===false;
const flags=['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions','mutation_authorized','synthetic'];
const ref=x=>typeof x==='string'&&x.trim().length>=4&&x.trim().length<=250;
function inspect(x,{companyId,userId}={}){
 const base=window.YWI465?.inspect?.(x?.handoff_source,{companyId,userId});if(base?.state!=='source_verified')return {state:'withheld',reason:base?.reason||'465 source gate unavailable'};
 if(x.company_id!==companyId||x.viewer_id!==userId||!before(x.handoff_source.captured_at,x.captured_at)||
  time(x.captured_at)>Date.now()+60000||Date.now()-time(x.captured_at)>300000||
  !flags.every(k=>x[k]===false)||!Array.isArray(x.original_baselines)||x.original_baselines.length!==base.cases.length||
  !sample(x.comparisons,x.comparison_total,x.comparison_sample_capped)||!sample(x.outcomes,x.outcome_total,x.outcome_sample_capped)||
  !sample(x.followups,x.followup_total,x.followup_sample_capped))return {state:'withheld',reason:'466/467 source incomplete or falsely authorizing'};
 const receipts=new Map(base.receipts.map(r=>[r.id,r])),handoffs=new Map(base.handoffs.map(h=>[h.id,h])),cases=new Map(base.cases.map(c=>[c.proposal_id,c]));
 const baselines=new Map();for(const b of x.original_baselines){if(!uuid(b.proposal_id)||!uuid(b.original_outcome_id)||!ref(b.original_source_reference)||
  !cases.has(b.proposal_id)||baselines.has(b.proposal_id)||!before(b.original_at,x.captured_at))return {state:'withheld',reason:'Original 463 baseline invalid'};
  baselines.set(b.proposal_id,b);}
 const comparisons=new Map(),comparedReceipts=new Set();for(const c of x.comparisons){const r=receipts.get(c.receipt_id),h=handoffs.get(c.handoff_id),p=h&&cases.get(h.proposal_id),b=p&&baselines.get(p.proposal_id);
  if(!uuid(c.id)||comparisons.has(c.id)||comparedReceipts.has(c.receipt_id)||c.company_id!==companyId||!r||!h||!p||!b||r.handoff_id!==h.id||
   r.response!=='acknowledged_for_review'||c.reviewer_user_id!==r.reviewer_user_id||c.reviewer_user_id!==h.reviewer_user_id||
   c.reviewer_user_id!==p.proposed_reviewer_user_id||c.original_source_reference!==b.original_source_reference||
   !ref(c.compared_source_reference)||c.original_source_reference===c.compared_source_reference||!alignments.includes(c.alignment)||
   !before(b.original_at,h.created_at)||!before(r.created_at,c.created_at)||!before(c.created_at,x.captured_at)||!p.service_enabled)
   return {state:'withheld',reason:'Independent comparison does not match immutable 463/465 sources'};
  comparisons.set(c.id,c);comparedReceipts.add(c.receipt_id);}
 const outcomes=new Map(),outcomeComparisons=new Set();for(const o of x.outcomes){const c=comparisons.get(o.comparison_id);
  if(!uuid(o.id)||outcomes.has(o.id)||outcomeComparisons.has(o.comparison_id)||o.company_id!==companyId||!c||
   o.reviewer_user_id!==c.reviewer_user_id||!dispositions.includes(o.disposition)||
   (o.disposition==='ready_for_owner_reassessment'&&c.alignment!=='matches_recorded_chain')||!ref(o.source_reference)||
   !before(c.created_at,o.created_at)||!before(o.created_at,x.captured_at))return {state:'withheld',reason:'466 independent reviewer outcome invalid'};
  outcomes.set(o.id,o);outcomeComparisons.add(o.comparison_id);}
 const followed=new Set();for(const f of x.followups){const o=outcomes.get(f.outcome_id),c=o&&comparisons.get(o.comparison_id),h=c&&handoffs.get(c.handoff_id),p=h&&cases.get(h.proposal_id);
  if(!uuid(f.id)||followed.has(f.outcome_id)||f.company_id!==companyId||!o||!p||
   !['exception_remains_open','request_source_clarification'].includes(o.disposition)||
   !decisions.includes(f.decision)||!ref(f.source_reference)||f.owner_user_id!==p.owner_user_id||
   !before(o.created_at,f.created_at)||!before(f.created_at,x.captured_at))return {state:'withheld',reason:'Owner documentary exception outcome invalid'};
  followed.add(f.outcome_id);}
 return {...base,state:'source_verified',baselines:x.original_baselines,comparisons:x.comparisons,outcomes:x.outcomes,followups:x.followups,releaseGreen:false};
}
window.YWI467=Object.freeze({inspect,alignments,dispositions,decisions});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('comparison467'))return;
 const panel=el('details');panel.id='comparison467';panel.className='admin-hub-detail';panel.dataset.adminHubTitle='PMS · Independent Source Comparison';panel.dataset.adminHubGroups='management operations';
 panel.append(el('summary','466–467 · Independent Source Comparison & Exception Follow-Up'));
 const body=el('div');body.className='admin-panel-block pms467';body.append(el('p','An assigned, separately signed-in reviewer compares documentary source references after acknowledging a 465 handoff. A company owner may then document an exception follow-up. No real-world inspection, reassignment, notification, field approval or release is performed.'));
 const help=el('a','ⓘ Comparison and exception follow-up Help');help.href='/help.html#pms-comparison-followup-467';body.append(help);
 const controls=el('div');controls.className='pms467-controls';const companyLabel=el('label','Verified company'),company=el('select'),refresh=el('button','Verify independent source');company.id='pms467Company';refresh.id='pms467Refresh';refresh.type='button';refresh.className='secondary';companyLabel.append(company);controls.append(companyLabel,refresh);body.append(controls);
 const status=el('p','HOLD: verify signed-in owner/reviewer and original sources.');status.id='pms467Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const journal=el('section');journal.id='pms467Journal';body.append(journal);
 const form=(id,legend)=>{const f=el('fieldset');f.id=id;f.disabled=true;f.append(el('legend',legend));body.append(f);return f;};
 const reviewForm=form('pms467ReviewerForm','Separate reviewer: compare two documentary sources (466)');
 const outcomeForm=form('pms467OutcomeForm','Separate reviewer: record your independent exception outcome (466)');
 const ownerForm=form('pms467OwnerForm','Company owner: follow up an independent exception outcome (467)');
 const field=(form,id,label,tag,max)=>{const l=el('label',label),input=el(tag);input.id=id;if(max)input.maxLength=max;l.append(input);form.append(l);return input;};
 const receipt=field(reviewForm,'pms467Receipt','Your acknowledged, uncompared handoff','select');
 const independent=field(reviewForm,'pms467Independent','Independent source reference (required)','input',250);
 const alignment=field(reviewForm,'pms467Alignment','Source comparison alignment','select');
 for(const v of alignments){const o=el('option',v.replaceAll('_',' '));o.value=v;alignment.append(o);}
 const reviewNotes=field(reviewForm,'pms467ReviewNotes','Reviewer note (optional)','textarea',500);
 const compare=el('button','Record independent comparison');compare.type='button';compare.id='pms467Compare';compare.className='secondary';reviewForm.append(compare);
 const comparison=field(outcomeForm,'pms467Comparison','Your comparison awaiting an independent outcome','select');
 const disposition=field(outcomeForm,'pms467Disposition','Independent documentary outcome','select');
 for(const v of dispositions){const o=el('option',v.replaceAll('_',' '));o.value=v;disposition.append(o);}
 const outcomeRef=field(outcomeForm,'pms467OutcomeRef','Reviewer outcome source reference','input',250);
 const outcomeNotes=field(outcomeForm,'pms467OutcomeNotes','Outcome note (optional)','textarea',500);
 const recordOutcome=el('button','Record reviewer exception outcome');recordOutcome.type='button';recordOutcome.id='pms467RecordOutcome';recordOutcome.className='secondary';outcomeForm.append(recordOutcome);
 const ownerOutcome=field(ownerForm,'pms467OwnerOutcome','Unresolved 466 reviewer exception','select');
 const decision=field(ownerForm,'pms467Decision','Documentary owner decision','select');
 for(const v of decisions){const o=el('option',v.replaceAll('_',' '));o.value=v;decision.append(o);}
 const ownerRef=field(ownerForm,'pms467OwnerRef','Owner follow-up source reference','input',250);
 const ownerNotes=field(ownerForm,'pms467OwnerNotes','Owner note (optional)','textarea',500);
 const follow=el('button','Record documentary exception follow-up');follow.type='button';follow.id='pms467Follow';follow.className='secondary';ownerForm.append(follow);
 const hold=el('p','HOLD: even matches_recorded_chain, ready_for_owner_reassessment and documentary_closeout do not certify field evidence, independently reapprove jobs, execute reviewer reassignment, authorize Safety or Jobs, close the 457 service trial, notify a provider, or turn Production GREEN.');hold.id='pms467Hold';hold.className='notice';body.append(hold);panel.append(body);host.append(panel);
 let epoch=0,busy=false,verified=null,principal=null;
 const choices=(node,placeholder,items,show,key)=>{node.replaceChildren();const p=el('option',placeholder);p.value='';node.append(p);for(const a of items){const o=el('option',show(a));o.value=key(a);node.append(o);}};
 const invalidate=message=>{epoch++;verified=principal=null;company.replaceChildren();journal.replaceChildren();reviewForm.disabled=outcomeForm.disabled=ownerForm.disabled=true;status.textContent=message;};
 function display(d){verified=d;reviewForm.disabled=outcomeForm.disabled=ownerForm.disabled=true;journal.replaceChildren();if(d.state!=='source_verified'){status.textContent='WITHHELD: '+d.reason;return;}
  status.textContent='SOURCE VERIFIED: '+d.comparisons.length+' independent comparisons · '+d.outcomes.length+' reviewer outcomes · '+d.followups.length+' owner follow-ups. Operational approval HOLD.';
  for(const c of d.comparisons){const o=d.outcomes.find(v=>v.comparison_id===c.id),f=o&&d.followups.find(v=>v.outcome_id===o.id),row=el('article');row.className='pms467-entry';row.append(el('strong',c.alignment.replaceAll('_',' ')),el('p','Original 463 source: '+c.original_source_reference),el('p','Independent compared source: '+c.compared_source_reference),el('p',o?'Reviewer outcome: '+o.disposition.replaceAll('_',' '):'Reviewer outcome pending; HOLD remains'),el('p',f?'Owner response: '+f.decision.replaceAll('_',' ')+' · '+f.source_reference:'No owner response; HOLD remains'));journal.append(row);}
  if(!d.comparisons.length)journal.append(el('p','No source comparisons recorded for this company.'));
  const pending=d.isReviewer?d.receipts.filter(r=>r.reviewer_user_id===d.userId&&r.response==='acknowledged_for_review'&&!d.comparisons.some(c=>c.receipt_id===r.id)&&d.handoffs.some(h=>h.id===r.handoff_id&&d.cases.some(c=>c.proposal_id===h.proposal_id&&c.service_enabled))):[];
  choices(receipt,'Choose acknowledged handoff to compare',pending,r=>r.source_reference,r=>r.id);reviewForm.disabled=!pending.length;
  const pendingOutcomes=d.isReviewer?d.comparisons.filter(c=>c.reviewer_user_id===d.userId&&!d.outcomes.some(o=>o.comparison_id===c.id)):[];
  choices(comparison,'Choose comparison awaiting outcome',pendingOutcomes,c=>c.alignment.replaceAll('_',' ')+' · '+c.compared_source_reference,c=>c.id);outcomeForm.disabled=!pendingOutcomes.length;
  const open=d.isOwner?d.outcomes.filter(o=>o.disposition!=='ready_for_owner_reassessment'&&!d.followups.some(f=>f.outcome_id===o.id)):[];
  choices(ownerOutcome,'Choose independent exception outcome',open,o=>o.disposition.replaceAll('_',' ')+' · '+o.source_reference,o=>o.id);ownerForm.disabled=!open.length;}
 async function session(){const auth=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(auth?.isAuthenticated!==true||!uuid(auth.user?.id)||!sb?.rpc||!sb.auth?.getUser||!window.YWISecurity?.canViewModule?.('jobs',auth.role,'view'))throw Error('Active Jobs sign-in required');
  const who=await sb.auth.getUser();if(who.error||who.data?.user?.id!==auth.user.id)throw Error('Account identity changed');return {uid:auth.user.id,sb};}
 async function reconcile(){const ticket=epoch,ctx=await session(),a=await ctx.sb.rpc('ywi_rpc_handoff_inbox_465');
  if(ticket!==epoch||a.error||window.YWI465?.inspectInbox?.(a.data,{userId:ctx.uid})?.state!=='source_verified')throw Error('Independent reviewer company inbox withheld');
  const prev=company.value;choices(company,'Choose verified company',a.data.companies,c=>c.name,c=>c.id);if(a.data.companies.some(c=>c.id===prev))company.value=prev;else if(a.data.companies.length===1)company.value=a.data.companies[0].id;
  const id=company.value;if(!id){verified=null;status.textContent='HOLD: choose a verified company';return;}
  principal=ctx.uid;const first=await ctx.sb.rpc('ywi_rpc_comparison_workspace_467',{p_company_id:id}),second=await ctx.sb.rpc('ywi_rpc_comparison_workspace_467',{p_company_id:id});
  if(ticket!==epoch||first.error||second.error||company.value!==id||window.YWI_AUTH?.getState?.()?.user?.id!==ctx.uid||
   !first.data||!second.data||['handoff_source','original_baselines','comparisons','outcomes','followups'].some(k=>JSON.stringify(first.data[k])!==JSON.stringify(second.data[k])))
   throw Error('Independent comparison sources changed or were denied');
  display(inspect(second.data,{companyId:id,userId:ctx.uid}));}
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=reviewForm.disabled=outcomeForm.disabled=ownerForm.disabled=true;
  try{await reconcile();}catch(e){display({state:'withheld',reason:e.message||String(e)});}finally{busy=false;refresh.disabled=company.disabled=false;}});
 async function write(name,args,id){const ctx=await session();if(ctx.uid!==principal||company.value!==id)throw Error('Identity changed');
  const out=await ctx.sb.rpc(name,args);if(out.error||!uuid(out.data?.id)||out.data.company_id!==id||out.data.recorded!==true||
   !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions'].every(k=>out.data[k]===false))throw Error('Unverified documentary receipt');await reconcile();}
 function operationId(){const c=globalThis.crypto;if(c?.randomUUID)return c.randomUUID();if(!c?.getRandomValues)throw Error('Secure operation identifier unavailable');
  const b=c.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const s=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
  return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');}
 compare.addEventListener('click',async()=>{const d=verified,id=company.value,r=d?.receipts.find(r=>r.id===receipt.value),h=r&&d.handoffs.find(h=>h.id===r.handoff_id),b=h&&d.baselines.find(b=>b.proposal_id===h.proposal_id),source=independent.value.trim(),notes=reviewNotes.value.trim();
  if(busy||d?.state!=='source_verified'||!d.isReviewer||!r||!h||r.reviewer_user_id!==d.userId||r.response!=='acknowledged_for_review'||
   !b||d.comparisons.some(c=>c.receipt_id===r.id)||!ref(source)||source===b.original_source_reference||notes.length>500||!alignments.includes(alignment.value))return status.textContent='WITHHELD: verified reviewer source comparison required';
  if(!window.confirm('Record an INTERNAL documentary comparison? No field or work approval.'))return;
  busy=true;reviewForm.disabled=refresh.disabled=true;try{await write('ywi_rpc_compare_sources_466',{p_company_id:id,p_operation_id:operationId(),p_handoff_id:h.id,
   p_original_source_reference:b.original_source_reference,p_compared_source_reference:source,p_alignment:alignment.value,p_notes:notes||null},id);independent.value=reviewNotes.value='';}
  catch(e){verified=null;status.textContent='WITHHELD: '+(e.message||e)+'. Inspect journal before retry.';}finally{busy=false;refresh.disabled=false;reviewForm.disabled=verified?.state!=='source_verified'||!verified.isReviewer||!verified.receipts.some(r=>r.reviewer_user_id===verified.userId&&r.response==='acknowledged_for_review'&&!verified.comparisons.some(c=>c.receipt_id===r.id));}});
 recordOutcome.addEventListener('click',async()=>{const d=verified,id=company.value,c=d?.comparisons.find(c=>c.id===comparison.value),source=outcomeRef.value.trim(),notes=outcomeNotes.value.trim();
  if(busy||d?.state!=='source_verified'||!d.isReviewer||!c||c.reviewer_user_id!==d.userId||d.outcomes.some(o=>o.comparison_id===c.id)||
   !dispositions.includes(disposition.value)||(disposition.value==='ready_for_owner_reassessment'&&c.alignment!=='matches_recorded_chain')||
   !ref(source)||notes.length>500)return status.textContent='WITHHELD: only your original documentary comparison can receive an outcome';
  if(!window.confirm('Record an INTERNAL independent reviewer exception outcome? No work authorization.'))return;
  busy=true;outcomeForm.disabled=refresh.disabled=true;try{await write('ywi_rpc_record_exception_466',{p_company_id:id,p_operation_id:operationId(),
   p_comparison_id:c.id,p_disposition:disposition.value,p_source_reference:source,p_notes:notes||null},id);outcomeRef.value=outcomeNotes.value='';}
  catch(e){verified=null;status.textContent='WITHHELD: '+(e.message||e)+'. Inspect journal before retry.';}finally{busy=false;refresh.disabled=false;outcomeForm.disabled=verified?.state!=='source_verified'||!verified.isReviewer||!verified.comparisons.some(c=>c.reviewer_user_id===verified.userId&&!verified.outcomes.some(o=>o.comparison_id===c.id));}});
 follow.addEventListener('click',async()=>{const d=verified,id=company.value,o=d?.outcomes.find(o=>o.id===ownerOutcome.value),source=ownerRef.value.trim(),notes=ownerNotes.value.trim();
  if(busy||d?.state!=='source_verified'||!d.isOwner||!o||o.disposition==='ready_for_owner_reassessment'||d.followups.some(f=>f.outcome_id===o.id)||!decisions.includes(decision.value)||!ref(source)||notes.length>500)
   return status.textContent='WITHHELD: actual unresolved independent exception required';
  if(!window.confirm('Record INTERNAL owner documentary follow-up only? This does not resolve field acceptance.'))return;
  busy=true;ownerForm.disabled=refresh.disabled=true;try{await write('ywi_rpc_followup_comparison_467',{p_company_id:id,p_operation_id:operationId(),
   p_outcome_id:o.id,p_decision:decision.value,p_source_reference:source,p_notes:notes||null},id);ownerRef.value=ownerNotes.value='';}
  catch(e){verified=null;status.textContent='WITHHELD: '+(e.message||e)+'. Inspect journal before retry.';}finally{busy=false;refresh.disabled=false;ownerForm.disabled=verified?.state!=='source_verified'||!verified.isOwner||!verified.outcomes.some(o=>o.disposition!=='ready_for_owner_reassessment'&&!verified.followups.some(f=>f.outcome_id===o.id));}});
 company.addEventListener('change',()=>{epoch++;verified=null;reviewForm.disabled=outcomeForm.disabled=ownerForm.disabled=true;journal.replaceChildren();status.textContent='HOLD: company changed; verify again.';});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])document.addEventListener(event,()=>invalidate('HOLD: identity, Jobs permissions or company service changed. Verify again.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

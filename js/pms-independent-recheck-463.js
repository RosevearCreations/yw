/* YW 463: separate independent human reviewer handoff and source-linked documentary recheck. */
(()=>{'use strict';
const modules=Object.freeze(['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture']);
const dispositions=Object.freeze(['source_corresponds','evidence_incomplete','further_review_required']);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const el=(tag,value)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=value;return x;};
const fresh=x=>Number.isFinite(Date.parse(x))&&Date.parse(x)<=Date.now()+60000&&Date.now()-Date.parse(x)<=300000;
const sample=(a,total,cap)=>Array.isArray(a)&&a.length<=60&&Number.isSafeInteger(total)&&a.length===total&&cap===false;
const denied=['field_accepted','service_authorized','independent_reapproval','release_green','outbound_actions','mutation_authorized','synthetic'];
function operationId(){const c=globalThis.crypto;if(c?.randomUUID)return c.randomUUID();if(!c?.getRandomValues)throw Error('Secure randomness unavailable');
 const b=c.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const s=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');}
function inspectInbox(x,{userId}={}){
 if(!uuid(userId)||x?.viewer_id!==userId||!fresh(x.captured_at)||!sample(x.companies,x.total,x.sample_capped)||
  !['field_accepted','release_green','outbound_actions'].every(k=>x[k]===false))return {state:'withheld',reason:'Owner/reviewer inbox unverified'};
 const seen=new Set();for(const c of x.companies){if(!uuid(c.id)||!c.name||(!c.is_owner&&!c.is_reviewer)||seen.has(c.id))return {state:'withheld',reason:'Foreign/duplicate company'};seen.add(c.id);}
 return {state:'source_verified',companies:x.companies};
}
function inspect(x,{companyId,userId}={}){
 if(!uuid(companyId)||!uuid(userId)||x?.company_id!==companyId||x.viewer_id!==userId||!fresh(x.captured_at)||
  (!x.is_owner&&!x.is_reviewer)||!denied.every(k=>x[k]===false)||!Array.isArray(x.services)||x.services.length!==7||
  !sample(x.cases,x.case_total,x.case_sample_capped)||!sample(x.assignments,x.assignment_total,x.assignment_sample_capped)||
  !sample(x.rechecks,x.recheck_total,x.recheck_sample_capped))return {state:'withheld',reason:'Recheck source incomplete or falsely authorizing'};
 const seen=new Set();for(const s of x.services){if(s.company_id!==companyId||!modules.includes(s.module_key)||typeof s.enabled!=='boolean'||seen.has(s.module_key))return {state:'withheld',reason:'Module switches incoherent'};seen.add(s.module_key);}
 seen.clear();for(const c of x.cases){if(!uuid(c.evidence_outcome_id)||seen.has(c.evidence_outcome_id)||c.company_id!==companyId||!uuid(c.request_id)||!uuid(c.reassessment_id)||
  !uuid(c.comparison_id)||!uuid(c.owner_user_id)||!uuid(c.reassessor_user_id)||!uuid(c.comparing_reviewer_id)||
  !uuid(c.target_id)||!['estimates','work_orders'].includes(c.target_table)||!modules.includes(c.service_module_key)||
  c.outcome!=='evidence_received'||!c.evidence_reference||c.evidence_reference.trim().length<4||
  !freshOrPast(c.outcome_at,x.captured_at)||!freshOrPast(c.request_at,c.outcome_at)||!freshOrPast(c.reassessed_at,c.request_at)||
  c.owner_user_id===c.reassessor_user_id||c.owner_user_id===c.comparing_reviewer_id||
  (x.is_owner&&c.owner_user_id!==userId))return {state:'withheld',reason:'Received evidence lineage invalid'};seen.add(c.evidence_outcome_id);}
 seen.clear();for(const a of x.assignments){const c=x.cases.find(v=>v.evidence_outcome_id===a.evidence_outcome_id);
  if(!uuid(a.id)||seen.has(a.id)||a.company_id!==companyId||!c||a.owner_user_id!==c.owner_user_id||!uuid(a.reviewer_user_id)||
   [c.owner_user_id,c.reassessor_user_id,c.comparing_reviewer_id].includes(a.reviewer_user_id)||
   (!x.is_owner&&a.reviewer_user_id!==userId)||!freshOrPast(a.created_at,x.captured_at)||Date.parse(a.created_at)<Date.parse(c.outcome_at)||
   !a.source_reference||a.source_reference.trim().length<4)return {state:'withheld',reason:'Non-independent or unlinked assignment'};seen.add(a.id);}
 seen.clear();for(const r of x.rechecks){const a=x.assignments.find(v=>v.id===r.assignment_id);
  if(!uuid(r.id)||seen.has(r.id)||!a||r.company_id!==companyId||r.reviewer_user_id!==a.reviewer_user_id||
   !dispositions.includes(r.disposition)||!r.source_reference||r.source_reference.trim().length<4||
   !freshOrPast(r.created_at,x.captured_at)||Date.parse(r.created_at)<Date.parse(a.created_at))return {state:'withheld',reason:'Unlinked independent outcome'};seen.add(r.id);}
 return {state:'source_verified',companyId,userId,isOwner:x.is_owner===true,isReviewer:x.is_reviewer===true,
  services:x.services,cases:x.cases,assignments:x.assignments,rechecks:x.rechecks,releaseGreen:false};
}
function freshOrPast(a,b){return Number.isFinite(Date.parse(a))&&Number.isFinite(Date.parse(b))&&Date.parse(a)<=Date.parse(b)+60000;}
window.YWI463=Object.freeze({inspect,inspectInbox,modules,dispositions});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('recheck463'))return;
 const panel=el('details');panel.id='recheck463';panel.className='admin-hub-detail';panel.dataset.adminHubTitle='PMS · Independent Recheck';panel.dataset.adminHubGroups='management operations';
 panel.append(el('summary','463 · Independent Recheck Assignment & Evidence Linking'));
 const body=el('div');body.className='admin-panel-block pms463';body.append(el('p','Assign a separate reviewer to an actual source-verified 462 “evidence received” handoff. The reviewer records a documentary comparison only. No customer notification, field acceptance, Safety clearance, Jobs authorization or production release.'));
 const help=el('a','ⓘ Independent recheck Help');help.href='/help.html#pms-independent-recheck-463';body.append(help);
 const controls=el('div'),companyLabel=el('label','Verified company'),company=el('select'),refresh=el('button','Verify recheck source');controls.className='pms463-controls';
 company.id='pms463Company';companyLabel.append(company);refresh.id='pms463Refresh';refresh.type='button';refresh.className='secondary';controls.append(companyLabel,refresh);body.append(controls);
 const status=el('p','HOLD: verify company, reviewer identity and actual source lineage.');status.id='pms463Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const journal=el('section');journal.id='pms463Journal';body.append(journal);
 const form=(id,legend)=>{const f=el('fieldset');f.id=id;f.disabled=true;f.append(el('legend',legend));body.append(f);return f;};
 const ownerForm=form('pms463OwnerForm','Owner: assign separate independent reviewer (no dispatch)');
 const reviewerForm=form('pms463ReviewerForm','Assigned reviewer: documentary source comparison');
 const field=(f,id,label,tag,max)=>{const l=el('label',label),x=el(tag);x.id=id;if(max)x.maxLength=max;l.append(x);f.append(l);return x;};
 const source=field(ownerForm,'pms463Source','Received evidence awaiting assignment','select');
 const reviewer=field(ownerForm,'pms463Reviewer','Separate reviewer user ID (UUID)','input',36);
 const ownerRef=field(ownerForm,'pms463OwnerRef','Assignment source reference','input',250);
 const ownerNotes=field(ownerForm,'pms463OwnerNotes','Owner notes (optional)','textarea',500);
 const assign=el('button','Record independent reviewer assignment');assign.type='button';assign.id='pms463Assign';assign.className='secondary';ownerForm.append(assign);
 const assignment=field(reviewerForm,'pms463Assignment','Your verified assignment','select');
 const disposition=field(reviewerForm,'pms463Disposition','Independent documentary finding','select');for(const d of dispositions){const o=el('option',d.replaceAll('_',' '));o.value=d;disposition.append(o);}
 const reviewerRef=field(reviewerForm,'pms463ReviewerRef','Observed source comparison reference','input',250);
 const reviewerNotes=field(reviewerForm,'pms463ReviewerNotes','Reviewer notes (optional)','textarea',500);
 const record=el('button','Record independent documentary finding');record.type='button';record.id='pms463Record';record.className='secondary';reviewerForm.append(record);
 const hold=el('p','HOLD: Source correspondence is not evidence certification or reapproval. Any new field observation, 457 decision, job, service eligibility, Safety, finance or release decision requires a separate authorized workflow.');hold.className='notice';hold.id='pms463Hold';body.append(hold);
 panel.append(body);host.append(panel);
 let epoch=0,busy=false,verified=null,principal=null;
 const options=(select,placeholder,items,show,key)=>{select.replaceChildren();const p=el('option',placeholder);p.value='';select.append(p);for(const i of items){const o=el('option',show(i));o.value=key(i);select.append(o);}};
 const invalidate=message=>{epoch++;verified=null;principal=null;ownerForm.disabled=reviewerForm.disabled=true;company.replaceChildren();journal.replaceChildren();status.textContent=message;};
 async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.rpc||!sb.auth?.getUser||!window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Authenticated Jobs viewer required');
  const who=await sb.auth.getUser();if(who.error||who.data?.user?.id!==a.user.id)throw Error('Identity changed');return {uid:a.user.id,sb};}
 function show(d){verified=d;journal.replaceChildren();ownerForm.disabled=reviewerForm.disabled=true;if(d.state!=='source_verified'){status.textContent='WITHHELD: '+d.reason;return;}
  status.textContent='SOURCE VERIFIED: '+d.cases.length+' received evidence chains · '+d.assignments.length+' separate reviewer assignments · '+d.rechecks.length+' documentary findings. Approval HOLD.';
  for(const c of d.cases){const row=el('article');row.className='pms463-entry';const a=d.assignments.find(v=>v.evidence_outcome_id===c.evidence_outcome_id),r=a&&d.rechecks.find(v=>v.assignment_id===a.id);
   row.append(el('strong',c.service_module_key+' · '+c.evidence_reference),el('p',a?'Assigned independent reviewer · '+a.source_reference:'No independent reviewer assigned'),
    el('p',r?'Documentary finding: '+r.disposition.replaceAll('_',' ')+' · '+r.source_reference:'Independent finding pending; HOLD remains'));journal.append(row);}
  if(!d.cases.length)journal.append(el('p','No genuine received-evidence handoffs or assignments in this scope.'));
  const enabled=c=>d.services.some(s=>s.module_key===c.service_module_key&&s.enabled);
  const open=d.isOwner?d.cases.filter(c=>enabled(c)&&!d.assignments.some(a=>a.evidence_outcome_id===c.evidence_outcome_id)):[];
  options(source,'Choose unassigned received evidence',open,c=>c.service_module_key+' · '+c.evidence_reference,c=>c.evidence_outcome_id);ownerForm.disabled=!open.length;
  const review=d.isReviewer?d.assignments.filter(a=>a.reviewer_user_id===d.userId&&
   !d.rechecks.some(r=>r.assignment_id===a.id)&&d.cases.some(c=>c.evidence_outcome_id===a.evidence_outcome_id&&enabled(c))):[];
  options(assignment,'Choose your pending independent recheck',review,a=>a.source_reference,a=>a.id);reviewerForm.disabled=!review.length;
 }
 async function reconcile(){const ticket=epoch,ctx=await session();const inbox=await ctx.sb.rpc('ywi_rpc_recheck_inbox_463');if(ticket!==epoch||inbox.error)throw Error('Owner/reviewer inbox denied');
  const checked=inspectInbox(inbox.data,{userId:ctx.uid});if(checked.state!=='source_verified')throw Error(checked.reason);
  const old=company.value;options(company,'Choose verified company',checked.companies,c=>c.name+(c.is_owner?' · owner':' · reviewer'),c=>c.id);
  if(checked.companies.some(c=>c.id===old))company.value=old;else if(checked.companies.length===1)company.value=checked.companies[0].id;
  const id=company.value;if(!id){status.textContent='HOLD: choose a verified company';return;}principal=ctx.uid;
  const read=()=>ctx.sb.rpc('ywi_rpc_recheck_workspace_463',{p_company_id:id});const a=await read(),b=await read();
  if(ticket!==epoch||company.value!==id||window.YWI_AUTH?.getState?.()?.user?.id!==ctx.uid||a.error||b.error||!a.data||!b.data||
   ['services','cases','assignments','rechecks'].some(k=>JSON.stringify(a.data[k])!==JSON.stringify(b.data[k])))throw Error('Independent recheck source changed or denied');
  show(inspect(b.data,{companyId:id,userId:ctx.uid}));}
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=ownerForm.disabled=reviewerForm.disabled=true;try{await reconcile();}catch(e){show({state:'withheld',reason:e.message||String(e)});}finally{busy=false;refresh.disabled=company.disabled=false;}});
 async function write(action,args,id){const ctx=await session();if(ctx.uid!==principal||company.value!==id)throw Error('Reviewer or owner identity changed');const result=await ctx.sb.rpc(action,args);
  if(result.error||!uuid(result.data?.id)||result.data.company_id!==id||result.data.recorded!==true||
   !['field_accepted','service_authorized','independent_reapproval','release_green','outbound_actions'].every(k=>result.data[k]===false))throw Error('Unverified private journal receipt');await reconcile();}
 assign.addEventListener('click',async()=>{const d=verified,id=company.value,c=d?.cases.find(c=>c.evidence_outcome_id===source.value),who=reviewer.value.trim(),ref=ownerRef.value.trim(),memo=ownerNotes.value.trim();
  if(busy||d?.state!=='source_verified'||!d.isOwner||!c||d.assignments.some(a=>a.evidence_outcome_id===c.evidence_outcome_id)||!uuid(who)||
   [d.userId,c.reassessor_user_id,c.comparing_reviewer_id].includes(who)||ref.length<4||ref.length>250||memo.length>500)return status.textContent='WITHHELD: distinct reviewer and unassigned source chain required';
  if(!window.confirm('Record INTERNAL independent reviewer assignment only? No notification, approval or work authorization.'))return;
  busy=true;ownerForm.disabled=refresh.disabled=true;try{await write('ywi_rpc_assign_recheck_463',{p_company_id:id,p_operation_id:operationId(),p_evidence_outcome_id:c.evidence_outcome_id,p_reviewer_user_id:who,p_source_reference:ref,p_notes:memo||null},id);reviewer.value=ownerRef.value=ownerNotes.value='';}
  catch(e){verified=null;status.textContent='WITHHELD: '+(e.message||e)+'. Inspect journal before retry.';}finally{busy=false;refresh.disabled=false;ownerForm.disabled=verified?.state!=='source_verified'||!verified.isOwner||!verified.cases.some(c=>!verified.assignments.some(a=>a.evidence_outcome_id===c.evidence_outcome_id));}});
 record.addEventListener('click',async()=>{const d=verified,id=company.value,a=d?.assignments.find(a=>a.id===assignment.value),ref=reviewerRef.value.trim(),memo=reviewerNotes.value.trim();
  if(busy||d?.state!=='source_verified'||!d.isReviewer||!a||a.reviewer_user_id!==d.userId||d.rechecks.some(r=>r.assignment_id===a.id)||
   !dispositions.includes(disposition.value)||ref.length<4||ref.length>250||memo.length>500)return status.textContent='WITHHELD: assigned reviewer and source comparison required';
  if(!window.confirm('Record documentary independent finding only? Even source correspondence does NOT approve the field evidence.'))return;
  busy=true;reviewerForm.disabled=refresh.disabled=true;try{await write('ywi_rpc_record_recheck_463',{p_company_id:id,p_operation_id:operationId(),p_assignment_id:a.id,p_disposition:disposition.value,p_source_reference:ref,p_notes:memo||null},id);reviewerRef.value=reviewerNotes.value='';}
  catch(e){verified=null;status.textContent='WITHHELD: '+(e.message||e)+'. Inspect journal before retry.';}finally{busy=false;refresh.disabled=false;reviewerForm.disabled=verified?.state!=='source_verified'||!verified.isReviewer||!verified.assignments.some(a=>a.reviewer_user_id===verified.userId&&!verified.rechecks.some(r=>r.assignment_id===a.id));}});
 company.addEventListener('change',()=>{epoch++;verified=null;ownerForm.disabled=reviewerForm.disabled=true;journal.replaceChildren();status.textContent='HOLD: company changed; verify again.';});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])document.addEventListener(event,()=>invalidate('HOLD: identity, permissions or service switch changed; verify again.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

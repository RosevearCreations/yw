/* YW Item 457: real owner assignment -> separate reviewer -> immutable evidence decision.
 * Verified exception closure applies to the review ledger only, never to operations. */
(()=>{'use strict';
const decisions=Object.freeze(['reviewed_no_exception','returned_for_follow_up','exception_verified_closed']);
const modules=Object.freeze(['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture']);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const node=(tag,value)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=value;return el;};
function requestId(){const a=globalThis.crypto;if(a?.randomUUID)return a.randomUUID();if(!a?.getRandomValues)throw Error('Secure request ID unavailable');
 const bytes=a.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const s=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');}
function inspectInbox(data,{userId,now=Date.now()}={}){
 const captured=Date.parse(data?.captured_at);
 if(!uuid(userId)||!Array.isArray(data?.companies)||data.companies.length>60||
  !Number.isSafeInteger(data.total)||data.total<data.companies.length||
  data.sample_capped!==(data.total>60)||data.sample_capped||data.outbound_actions!==false||
  data.release_green!==false||!Number.isFinite(captured)||captured>now+60000||now-captured>300000)
  return {state:'withheld',reason:'Reviewer inbox missing, truncated or stale'};
 const seen=new Set();for(const c of data.companies){if(!uuid(c.id)||!c.name||
  typeof c.is_owner!=='boolean'||typeof c.is_assigned_reviewer!=='boolean'||
  (!c.is_owner&&!c.is_assigned_reviewer)||seen.has(c.id))
   return {state:'withheld',reason:'Invalid, duplicate or foreign reviewer company'};seen.add(c.id);}
 return {state:'source_verified',companies:data.companies};
}
function inspect(data,{companyId,userId,now=Date.now()}={}){
 const captured=Date.parse(data?.captured_at),validCount=x=>Number.isSafeInteger(x)&&x>=0;
 if(!uuid(companyId)||!uuid(userId)||data?.company_id!==companyId||data.viewer_id!==userId||
  (data.is_owner!==true&&data.is_assigned_reviewer!==true)||
  !Number.isFinite(captured)||captured>now+60000||now-captured>300000||
  !['independent_service_approval','field_accepted','release_green','outbound_actions','synthetic','mutation_authorized'].every(k=>data[k]===false)||
  !Array.isArray(data.services)||data.services.length!==7||
  ![data.handoffs,data.decisions,data.exceptions,data.resolution_evidence].every(Array.isArray)||
  ![data.handoff_total,data.decision_total,data.exception_total,data.evidence_total].every(validCount)||
  ![data.handoff_sample_capped,data.decision_sample_capped,data.exception_sample_capped,data.evidence_sample_capped].every(x=>typeof x==='boolean'))
   return {state:'withheld',reason:'Missing, stale or falsely approving reviewer snapshot'};
 const switches=new Set();for(const s of data.services){if(s.company_id!==companyId||
  !modules.includes(s.module_key)||switches.has(s.module_key)||typeof s.enabled!=='boolean')
   return {state:'withheld',reason:'Service registry is incomplete, foreign or duplicated'};switches.add(s.module_key);}
 const bounded=(list,total,capped)=>list.length<=60&&total>=list.length&&capped===(total>60);
 if(!bounded(data.handoffs,data.handoff_total,data.handoff_sample_capped)||
  !bounded(data.decisions,data.decision_total,data.decision_sample_capped)||
  !bounded(data.exceptions,data.exception_total,data.exception_sample_capped)||
  !bounded(data.resolution_evidence,data.evidence_total,data.evidence_sample_capped)||
  [data.handoff_sample_capped,data.decision_sample_capped,data.exception_sample_capped,data.evidence_sample_capped].some(Boolean))
  return {state:'withheld',reason:'History is truncated; full pagination is required'};
 const seen=new Set(),handoffIds=new Set();for(const h of data.handoffs){if(!uuid(h.id)||
  h.company_id!==companyId||!uuid(h.owner_review_id)||!uuid(h.reviewer_user_id)||
  !uuid(h.target_id)||!modules.includes(h.service_module_key)||
  !['work_orders','estimates'].includes(h.target_table)||
  h.owner_recommendation!=='ready_for_independent_review'||
  !Number.isFinite(Date.parse(h.created_at))||seen.has(h.id)||
  (!data.is_owner&&h.reviewer_user_id!==userId))
  return {state:'withheld',reason:'Handoff source or reviewer does not match'};seen.add(h.id);handoffIds.add(h.id);}
 seen.clear();const decided=new Set();for(const d of data.decisions){if(!uuid(d.id)||
  d.company_id!==companyId||!handoffIds.has(d.handoff_id)||!decisions.includes(d.decision)||
  seen.has(d.id)||decided.has(d.handoff_id)||!Number.isFinite(Date.parse(d.created_at))||
  (d.decision==='exception_verified_closed')!==(uuid(d.exception_review_id)&&uuid(d.resolution_evidence_id)))
  return {state:'withheld',reason:'Reviewer decision is foreign, duplicate or unverified'};
  seen.add(d.id);decided.add(d.handoff_id);}
 seen.clear();for(const e of data.exceptions){if(!uuid(e.id)||e.company_id!==companyId||
  !uuid(e.target_id)||!modules.includes(e.service_module_key)||
  !['work_orders','estimates'].includes(e.target_table)||
  !['blocked','needs_follow_up'].includes(e.review_outcome)||seen.has(e.id)||
  !Number.isFinite(Date.parse(e.recorded_at))||
  !data.handoffs.some(h=>h.service_module_key===e.service_module_key&&h.target_table===e.target_table&&h.target_id===e.target_id))
  return {state:'withheld',reason:'Foreign or invalid historical exception'};seen.add(e.id);}
 seen.clear();for(const e of data.resolution_evidence){if(!uuid(e.id)||e.company_id!==companyId||
  e.checkpoint!=='field_observation'||e.disposition!=='observed'||seen.has(e.id)||
  !Number.isFinite(Date.parse(e.created_at)))return {state:'withheld',reason:'Invalid resolution evidence'};seen.add(e.id);}
 return {state:'source_verified',companyId,userId,isOwner:data.is_owner,isReviewer:data.is_assigned_reviewer,
  ...{services:data.services,handoffs:data.handoffs,decisions:data.decisions,
  exceptions:data.exceptions,evidence:data.resolution_evidence},fieldAccepted:false,releaseGreen:false};
}
window.YWI457=Object.freeze({inspect,inspectInbox,decisions,modules});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('owner457'))return;
 const panel=node('details');panel.id='owner457';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='PMS · Independent Reviewer Handoff';panel.dataset.adminHubGroups='management operations';
 panel.append(node('summary','457 · Independent Reviewer Handoff & Exception Closure'));
 const body=node('div');body.className='admin-panel-block pms457';
 body.append(node('p','The owner selects an existing 456 readiness recommendation and assigns a DIFFERENT active reviewer. Only that reviewer, with their own Jobs approve/manage permission, can record the independent evidence decision. “Exception verified closed” closes a documented review exception, not any service, Safety, field, finance or Production gate.'));
 const help=node('a','ⓘ Independent reviewer handoff Help');help.href='/help.html#pms-first-service-independent-457';body.append(help);
 const controls=node('div');controls.className='pms457-controls';const companyLabel=node('label','Owned or explicitly assigned company');const company=node('select');company.id='pms457Company';companyLabel.append(company);
 const refresh=node('button','Recheck assignments & evidence');refresh.type='button';refresh.className='secondary';refresh.id='pms457Refresh';controls.append(companyLabel,refresh);body.append(controls);
 const status=node('p','HOLD: sign in and recheck actual owner/reviewer assignments.');status.id='pms457Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const summary=node('section');summary.id='pms457Summary';summary.setAttribute('aria-label','Source-linked handoff and reviewer decisions');body.append(summary);
 const history=node('section');history.id='pms457History';history.setAttribute('aria-label','Independent immutable decision history');body.append(history);
 const field=(parent,id,label,tag,max)=>{const l=node('label',label),e=node(tag);e.id=id;if(max)e.maxLength=max;l.append(e);parent.append(l);return e;};
 const ownerForm=node('fieldset');ownerForm.id='pms457OwnerForm';ownerForm.disabled=true;ownerForm.append(node('legend','Owner: assign independent reviewer (append only)'));
 const ready=field(ownerForm,'pms457Ready','Verified 456 ready-for-independent-review recommendation','select');
 const reviewer=field(ownerForm,'pms457Reviewer','Different active reviewer user UUID','input',36);reviewer.placeholder='Existing reviewer profile UUID';
 const ownerRef=field(ownerForm,'pms457OwnerRef','Handoff source reference (4–250 characters)','input',250);
 const ownerNotes=field(ownerForm,'pms457OwnerNotes','Handoff notes (optional)','textarea',500);
 const assign=node('button','Append reviewer assignment');assign.id='pms457Assign';assign.className='secondary';assign.type='button';ownerForm.append(assign);body.append(ownerForm);
 const reviewForm=node('fieldset');reviewForm.id='pms457ReviewerForm';reviewForm.disabled=true;reviewForm.append(node('legend','Independent reviewer: record a decision (no service approval)'));
 const handoff=field(reviewForm,'pms457Handoff','Handoff assigned to our signed-in reviewer','select');
 const decision=field(reviewForm,'pms457Decision','Decision about review evidence','select');for(const name of decisions){const opt=node('option',name.replaceAll('_',' '));opt.value=name;decision.append(opt);}
 const exception=field(reviewForm,'pms457Exception','Prior same-target 456 exception (closure only)','select');
 const evidence=field(reviewForm,'pms457Evidence','Later observed 455 field evidence (closure only)','select');
 const reviewerRef=field(reviewForm,'pms457ReviewerRef','Independent evidence reference (4–250 characters)','input',250);
 const reviewerNotes=field(reviewForm,'pms457ReviewerNotes','Independent reviewer notes (optional)','textarea',500);
 const record=node('button','Append independent reviewer decision');record.type='button';record.id='pms457Record';record.className='secondary';reviewForm.append(record);body.append(reviewForm);
 const hold=node('p','FIELD/Safety/CUSTOMER ACCEPTANCE: HOLD. Review-only exception closure cannot grant operational approval or mark an unobserved production trial complete.');hold.className='notice';hold.id='pms457Release';body.append(hold);panel.append(body);host.append(panel);
 let epoch=0,busy=false,verified=null,source456=null,inbox=[],principal=null;
 const info=m=>{status.textContent=m;};
 const option=(list,placeholder,rows,render,value)=>{list.replaceChildren();const first=node('option',placeholder);first.value='';list.append(first);for(const row of rows){const opt=node('option',render(row));opt.value=value(row);list.append(opt);}};
 function invalidate(message){epoch++;verified=null;source456=null;inbox=[];principal=null;company.replaceChildren();ownerForm.disabled=reviewForm.disabled=true;summary.replaceChildren();history.replaceChildren();info(message);}
 async function session(){const s=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(!s?.isAuthenticated||!uuid(s.user?.id)||!sb?.auth?.getUser||!sb?.rpc||
   !window.YWISecurity?.canViewModule?.('jobs',s.role,'view'))throw Error('Signed-in Jobs view account required');
  const auth=await sb.auth.getUser();if(auth.error||auth.data?.user?.id!==s.user.id)throw Error('Signed-in user changed');
  return {sb,uid:s.user.id};}
 const alive=(ctx,start,id)=>epoch===start&&company.value===id&&
  window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&window.YWI_AUTH.getState().user?.id===ctx.uid;
 const key=h=>h.target_table+':'+h.target_id+':'+h.service_module_key;
 function show(data){verified=data;summary.replaceChildren();history.replaceChildren();ownerForm.disabled=reviewForm.disabled=true;
  if(data.state!=='source_verified'){info('WITHHELD: '+data.reason);return;}
  const open=data.handoffs.filter(h=>!data.decisions.some(d=>d.handoff_id===h.id));
  info('SOURCE VERIFIED: '+data.handoffs.length+' independent handoffs, '+data.decisions.length+' immutable reviewer decisions. Field acceptance HOLD.');
  for(const row of ['Seven company switches: '+data.services.filter(s=>s.enabled).length+' ON / '+data.services.filter(s=>!s.enabled).length+' OFF',
   'Open independent reviewer handoffs: '+open.length,'Historical same-target exceptions: '+data.exceptions.length,
   'Post-handoff 455 observed field records: '+data.evidence.length])summary.append(node('p',row));
  history.append(node('h3','Independent reviewer decision history'));
  for(const d of data.decisions){const a=node('article');a.className='pms457-entry';a.append(node('strong',d.decision.replaceAll('_',' ')),
   node('p',d.source_reference+' · '+d.created_at));if(d.notes)a.append(node('p',d.notes));history.append(a);}
  if(!data.decisions.length)history.append(node('p','No independent decision exists. Absence is HOLD, not closure.'));
  const eligible=(source456?.reviews||[]).filter(r=>r.review_outcome==='ready_for_independent_review'&&
   data.services.some(s=>s.module_key===r.service_module_key&&s.enabled)&&
   !data.handoffs.some(h=>h.owner_review_id===r.id));
  option(ready,'Choose unassigned 456 readiness',eligible,r=>r.service_module_key+' · '+r.target_table+' · '+r.target_id,r=>r.id);
  ownerForm.disabled=!data.isOwner||!eligible.length;
  option(handoff,'Choose our open assignment',open.filter(h=>h.reviewer_user_id===data.userId),
   h=>h.service_module_key+' · '+h.target_table+' · '+h.target_id,h=>h.id);
  option(exception,'Only for exception verified closed',data.exceptions,
   e=>e.review_outcome+' · '+e.service_module_key+' · '+e.target_id,e=>e.id);
  option(evidence,'Only later observed first-use evidence',data.evidence,e=>e.source_reference+' · '+e.created_at,e=>e.id);
  reviewForm.disabled=!data.isReviewer||!open.some(h=>h.reviewer_user_id===data.userId);
 }
 async function reconcile(){const start=epoch,ctx=await session();
  const list=await ctx.sb.rpc('ywi_rpc_reviewer_inbox_457');if(epoch!==start||list.error)throw Error('457 owner/reviewer inbox denied');
  const verifiedInbox=inspectInbox(list.data,{userId:ctx.uid});if(verifiedInbox.state!=='source_verified')throw Error(verifiedInbox.reason);
  principal=ctx.uid;inbox=verifiedInbox.companies;const prior=company.value;
  option(company,'Select verified owner/reviewer company',inbox,c=>c.name+(c.is_owner?' · Owner':' · Assigned reviewer'),c=>c.id);
  if(inbox.some(c=>c.id===prior))company.value=prior;else if(inbox.length===1)company.value=inbox[0].id;
  if(!inbox.length){info('HOLD: no real owner company or assigned review. No test tenant is seeded.');return;}
  const id=company.value;if(!inbox.some(c=>c.id===id)){info('HOLD: choose a verified company and recheck.');return;}
  const first=await ctx.sb.rpc('ywi_rpc_first_service_independent_457',{p_company_id:id});
  if(!alive(ctx,start,id)||first.error)throw Error('457 scoped source snapshot denied');
  const second=await ctx.sb.rpc('ywi_rpc_first_service_independent_457',{p_company_id:id});
  if(!alive(ctx,start,id)||second.error||JSON.stringify(first.data?.services)!==JSON.stringify(second.data?.services))
   throw Error('Service switches changed; refresh before review');
  const inspected=inspect(second.data,{companyId:id,userId:ctx.uid});
  if(inspected.state==='source_verified'&&inspected.isOwner){
   const owner=await ctx.sb.rpc('ywi_rpc_first_service_review_456',{p_company_id:id});
   if(!alive(ctx,start,id)||owner.error||!owner.data)throw Error('456 owner recommendations denied');
   // The 456 workbench applies the same owner-scoped source/receipt/cap checks.
   if(owner.data.company_id!==id||owner.data.review_sample_capped!==false||
    owner.data.receipt_sample_capped!==false||owner.data.owner_entry_sample_capped!==false||
    owner.data.independent_approval_granted!==false||!Array.isArray(owner.data.reviews))
    throw Error('456 owner review history incomplete or untrusted');
   source456=owner.data;
  }else source456=null;
  if(!alive(ctx,start,id))throw Error('Identity changed before source display');show(inspected);
 }
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=true;verified=null;ownerForm.disabled=reviewForm.disabled=true;
  info('Verifying owner assignment, independent reviewer identity and source lineage…');
  try{await reconcile();}catch(e){show({state:'withheld',reason:e?.message||String(e)});}finally{busy=false;refresh.disabled=company.disabled=false;}});
 async function write(name,payload,expected){const start=epoch,id=company.value;
  busy=true;assign.disabled=record.disabled=refresh.disabled=true;
  try{const ctx=await session();if(ctx.uid!==principal||!alive(ctx,start,id))throw Error('Identity or company changed');
   const fresh=await ctx.sb.rpc('ywi_rpc_first_service_independent_457',{p_company_id:id});
   if(!alive(ctx,start,id)||fresh.error||inspect(fresh.data,{companyId:id,userId:ctx.uid}).state!=='source_verified'||
    JSON.stringify(fresh.data.services)!==JSON.stringify(verified.services))
    throw Error('Service/assignment snapshot changed; decision not submitted');
   const reply=await ctx.sb.rpc(name,payload);
   if(!alive(ctx,start,id)||reply.error||reply.data?.recorded!==true||reply.data?.company_id!==id||
    reply.data?.independent_service_approval!==false||reply.data?.field_accepted!==false||
    reply.data?.outbound_actions!==false||(!uuid(reply.data?.id))||
    (expected&&reply.data?.decision!==expected))
    throw Error('Unverifiable server response; inspect journal before retry');
   info('Immutable reviewer journal updated. Refreshing original sources…');await reconcile();
  }catch(e){verified=null;ownerForm.disabled=reviewForm.disabled=true;info('WITHHELD: '+(e?.message||e)+'. No automatic replay; reconcile before retry.');}
  finally{busy=false;assign.disabled=record.disabled=refresh.disabled=false;}}
 assign.addEventListener('click',async()=>{if(busy||verified?.state!=='source_verified'||!verified.isOwner)return;
  const id=company.value,r=source456?.reviews?.find(r=>r.id===ready.value),reviewerId=reviewer.value.trim(),ref=ownerRef.value.trim(),notes=ownerNotes.value.trim();
  if(!r||r.review_outcome!=='ready_for_independent_review'||!uuid(reviewerId)||reviewerId===principal||
   ref.length<4||ref.length>250||notes.length>500)return info('WITHHELD: select 456 readiness and a distinct existing reviewer UUID with a valid reference');
  if(!window.confirm('Assign an independent reviewer for this 456 source? This grants only reviewer access to this handoff, never service approval.'))return;
  await write('ywi_rpc_assign_independent_457',{p_company_id:id,p_request_id:requestId(),p_owner_review_id:r.id,
   p_reviewer_user_id:reviewerId,p_source_reference:ref,p_notes:notes||null});});
 record.addEventListener('click',async()=>{if(busy||verified?.state!=='source_verified'||!verified.isReviewer)return;
  const id=company.value,h=verified.handoffs.find(h=>h.id===handoff.value&&h.reviewer_user_id===principal),
   d=decision.value,e=verified.exceptions.find(e=>e.id===exception.value),v=verified.evidence.find(e=>e.id===evidence.value),
   ref=reviewerRef.value.trim(),notes=reviewerNotes.value.trim();
  if(!h||!decisions.includes(d)||ref.length<4||ref.length>250||notes.length>500)
   return info('WITHHELD: choose our own open handoff, decision and valid evidence reference');
  if(d==='reviewed_no_exception'&&verified.exceptions.some(e=>key(e)===key(h)))
   return info('WITHHELD: original source has a documented exception; review it explicitly or return for follow-up');
  if(d==='exception_verified_closed'&&(!e||!v||key(e)!==key(h)||
   Date.parse(v.created_at)<=Date.parse(h.created_at)||Date.parse(e.recorded_at)>=Date.parse(h.created_at)))
   return info('WITHHELD: closure requires an earlier same-target exception and later observed first-use evidence');
  if(!window.confirm('Append independent '+d.replaceAll('_',' ')+'? This cannot approve, dispatch or authorize field work.'))return;
  await write('ywi_rpc_record_independent_457',{p_company_id:id,p_request_id:requestId(),p_handoff_id:h.id,
   p_decision:d,p_exception_review_id:d==='exception_verified_closed'?e.id:null,
   p_resolution_evidence_id:d==='exception_verified_closed'?v.id:null,p_source_reference:ref,p_notes:notes||null},d);});
 company.addEventListener('change',()=>{epoch++;verified=null;source456=null;ownerForm.disabled=reviewForm.disabled=true;
  summary.replaceChildren();history.replaceChildren();info('HOLD: company changed. Recheck assignment and source records.');});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])
  document.addEventListener(event,()=>invalidate('HOLD: identity, permission or service switch changed. Recheck before any decision.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

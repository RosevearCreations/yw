/* YW 464: owner-only documentary discrepancy follow-up; reassignment remains a proposal. */
(()=>{'use strict';
const decisions=Object.freeze(['request_clarification','retain_hold','propose_reassignment']);
const modules=Object.freeze(['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture']);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const el=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;return n;};
const time=x=>Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const captured=x=>Number.isFinite(time(x))&&time(x)<=Date.now()+60000&&Date.now()-time(x)<=300000;
const prior=(a,b)=>Number.isFinite(time(a))&&Number.isFinite(time(b))&&time(a)<=time(b);
const sample=(a,n,cap)=>Array.isArray(a)&&a.length<=60&&Number.isSafeInteger(n)&&a.length===n&&cap===false;
const denied=['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions','mutation_authorized','synthetic'];
function operationId(){const c=globalThis.crypto;if(c?.randomUUID)return c.randomUUID();if(!c?.getRandomValues)throw Error('Secure randomness unavailable');
 const b=c.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const s=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');}
function inspect(x,{companyId,userId}={}){
 if(!uuid(companyId)||!uuid(userId)||x?.company_id!==companyId||x.viewer_id!==userId||x.is_owner!==true||!captured(x.captured_at)||
  !denied.every(k=>x[k]===false)||!sample(x.cases,x.case_total,x.case_sample_capped)||
  !sample(x.reviews,x.review_total,x.review_sample_capped)||!Array.isArray(x.services)||x.services.length!==7)
  return {state:'withheld',reason:'Owner discrepancy source unverified or falsely authorizing'};
 const service=new Map();for(const s of x.services){if(s.company_id!==companyId||!modules.includes(s.module_key)||typeof s.enabled!=='boolean'||service.has(s.module_key))
  return {state:'withheld',reason:'Company service switches invalid'};service.set(s.module_key,s.enabled);}
 const cases=new Map();for(const c of x.cases){if(!uuid(c.outcome_id)||cases.has(c.outcome_id)||c.company_id!==companyId||c.owner_user_id!==userId||
  !uuid(c.assignment_id)||!uuid(c.evidence_outcome_id)||!uuid(c.old_reviewer_id)||!uuid(c.reassessor_user_id)||!uuid(c.comparing_reviewer_id)||
  [userId,c.reassessor_user_id,c.comparing_reviewer_id].includes(c.old_reviewer_id)||
  !['evidence_incomplete','further_review_required'].includes(c.disposition)||!c.source_reference||c.source_reference.trim().length<4||
  !prior(c.assignment_at,c.created_at)||!prior(c.created_at,x.captured_at)||!modules.includes(c.service_module_key)||
  !['estimates','work_orders'].includes(c.target_table)||!uuid(c.target_id)||
  typeof c.service_enabled!=='boolean'||service.get(c.service_module_key)!==c.service_enabled)
  return {state:'withheld',reason:'Discrepancy lineage invalid'};cases.set(c.outcome_id,c);}
 const seen=new Set();for(const r of x.reviews){const c=cases.get(r.recheck_outcome_id);
  if(!uuid(r.id)||seen.has(r.id)||r.company_id!==companyId||r.owner_user_id!==userId||!c||!decisions.includes(r.decision)||
   !r.source_reference||r.source_reference.trim().length<4||!prior(c.created_at,r.created_at)||!prior(r.created_at,x.captured_at)||
   ((r.decision==='propose_reassignment')!==(r.proposed_reviewer_user_id!==null))||
   (r.proposed_reviewer_user_id!==null&&(!uuid(r.proposed_reviewer_user_id)||
    [userId,c.old_reviewer_id,c.reassessor_user_id,c.comparing_reviewer_id].includes(r.proposed_reviewer_user_id))))
   return {state:'withheld',reason:'Owner review journal invalid'};seen.add(r.id);}
 return {state:'source_verified',companyId,userId,cases:x.cases,reviews:x.reviews,services:x.services,releaseGreen:false};
}
window.YWI464=Object.freeze({inspect,decisions});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('discrepancy464'))return;
 const panel=el('details');panel.id='discrepancy464';panel.className='admin-hub-detail';panel.dataset.adminHubTitle='PMS · Recheck Discrepancies';panel.dataset.adminHubGroups='management operations';
 panel.append(el('summary','464 · Independent Recheck Discrepancy Follow-Up'));
 const body=el('div');body.className='admin-panel-block pms464';body.append(el('p','Owner-only review of real 463 evidence-incomplete or further-review findings. Request clarification, retain HOLD, or propose a different reviewer. Proposals do not assign anyone or authorize work.'));
 const help=el('a','ⓘ Discrepancy follow-up Help');help.href='/help.html#pms-recheck-discrepancy-464';body.append(help);
 const controls=el('div');controls.className='pms464-controls';const companyLabel=el('label','Verified owner company'),company=el('select'),refresh=el('button','Verify discrepancy sources');company.id='pms464Company';
 companyLabel.append(company);refresh.id='pms464Refresh';refresh.type='button';refresh.className='secondary';controls.append(companyLabel,refresh);body.append(controls);
 const status=el('p','HOLD: verify the owner and independent discrepancy sources.');status.id='pms464Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const journal=el('section');journal.id='pms464Journal';body.append(journal);
 const form=el('fieldset');form.id='pms464OwnerForm';form.disabled=true;form.append(el('legend','Owner: one immutable documentary follow-up per discrepancy'));body.append(form);
 const field=(id,label,tag,max)=>{const l=el('label',label),x=el(tag);x.id=id;if(max)x.maxLength=max;l.append(x);form.append(l);return x;};
 const outcome=field('pms464Outcome','Unreviewed independent discrepancy','select');
 const decision=field('pms464Decision','Owner follow-up decision','select');for(const d of decisions){const o=el('option',d.replaceAll('_',' '));o.value=d;decision.append(o);}
 const alternative=field('pms464Reviewer','Alternative independent reviewer UUID (proposal only)','input',36);
 const reference=field('pms464Source','Owner source reference','input',250),notes=field('pms464Notes','Internal notes (optional)','textarea',500);
 const save=el('button','Record owner discrepancy follow-up');save.id='pms464Record';save.type='button';save.className='secondary';form.append(save);
 const hold=el('p','HOLD: Reassignment is only proposed, never executed. No reviewer is invited, field evidence accepted, customer notified, work scheduled, 457 decision changed, Safety approval issued, or production release authorized.');hold.className='notice';hold.id='pms464Hold';body.append(hold);panel.append(body);host.append(panel);
 let epoch=0,busy=false,verified=null,principal=null;
 const options=(node,placeholder,items,show,key)=>{node.replaceChildren();const p=el('option',placeholder);p.value='';node.append(p);for(const item of items){const o=el('option',show(item));o.value=key(item);node.append(o);}};
 const invalidate=message=>{epoch++;verified=null;principal=null;form.disabled=true;company.replaceChildren();journal.replaceChildren();status.textContent=message;};
 async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.rpc||!sb.auth?.getUser||!window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Active Jobs owner sign-in required');
  const who=await sb.auth.getUser();if(who.error||who.data?.user?.id!==a.user.id)throw Error('Owner identity changed');return {uid:a.user.id,sb};}
 function show(d){verified=d;journal.replaceChildren();form.disabled=true;if(d.state!=='source_verified'){status.textContent='WITHHELD: '+d.reason;return;}
  status.textContent='SOURCE VERIFIED: '+d.cases.length+' independent discrepancies · '+d.reviews.length+' immutable owner follow-ups. Field acceptance HOLD.';
  for(const c of d.cases){const r=d.reviews.find(x=>x.recheck_outcome_id===c.outcome_id),row=el('article');row.className='pms464-entry';row.append(el('strong',c.service_module_key+' · '+c.disposition.replaceAll('_',' ')),
   el('p','Reviewer source: '+c.source_reference),el('p',r?'Owner decision: '+r.decision.replaceAll('_',' ')+' · '+r.source_reference:'Owner follow-up pending'),
   el('p',c.service_enabled?'Service ON · still HOLD':'Service OFF · owner review locked'));journal.append(row);}
  if(!d.cases.length)journal.append(el('p','No genuine independent discrepancies in this company scope.'));
  const open=d.cases.filter(c=>c.service_enabled&&!d.reviews.some(r=>r.recheck_outcome_id===c.outcome_id));
  options(outcome,'Choose unresolved discrepancy',open,c=>c.service_module_key+' · '+c.disposition.replaceAll('_',' '),c=>c.outcome_id);
  form.disabled=!open.length;alternative.disabled=decision.value!=='propose_reassignment';}
 async function reconcile(){const ticket=epoch,ctx=await session();const inbox=await ctx.sb.rpc('ywi_rpc_recheck_inbox_463');
  if(ticket!==epoch||inbox.error||!window.YWI463?.inspectInbox)throw Error('Owner company inbox unavailable');
  const checked=window.YWI463.inspectInbox(inbox.data,{userId:ctx.uid});if(checked.state!=='source_verified')throw Error(checked.reason);
  const owned=checked.companies.filter(c=>c.is_owner===true),old=company.value;
  options(company,'Choose owned company',owned,c=>c.name,c=>c.id);if(owned.some(c=>c.id===old))company.value=old;else if(owned.length===1)company.value=owned[0].id;
  const id=company.value;if(!id){status.textContent='HOLD: choose a verified owner company';return;}principal=ctx.uid;
  const a=await ctx.sb.rpc('ywi_rpc_discrepancy_workspace_464',{p_company_id:id}),b=await ctx.sb.rpc('ywi_rpc_discrepancy_workspace_464',{p_company_id:id});
  if(ticket!==epoch||company.value!==id||window.YWI_AUTH?.getState?.()?.user?.id!==ctx.uid||a.error||b.error||!a.data||!b.data||
   ['services','cases','reviews'].some(k=>JSON.stringify(a.data[k])!==JSON.stringify(b.data[k])))throw Error('Discrepancy source changed or denied');
  show(inspect(b.data,{companyId:id,userId:ctx.uid}));}
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=form.disabled=true;
  try{await reconcile();}catch(e){show({state:'withheld',reason:e.message||String(e)});}finally{busy=false;refresh.disabled=company.disabled=false;}});
 decision.addEventListener('change',()=>{alternative.disabled=decision.value!=='propose_reassignment';if(alternative.disabled)alternative.value='';});
 save.addEventListener('click',async()=>{const d=verified,id=company.value,c=d?.cases.find(x=>x.outcome_id===outcome.value),
  selection=decision.value,who=alternative.value.trim(),ref=reference.value.trim(),memo=notes.value.trim();
  if(busy||d?.state!=='source_verified'||!c||!c.service_enabled||d.reviews.some(r=>r.recheck_outcome_id===c.outcome_id)||!decisions.includes(selection)||
   (selection==='propose_reassignment'&&(!uuid(who)||[d.userId,c.old_reviewer_id,c.reassessor_user_id,c.comparing_reviewer_id].includes(who)))||
   (selection!=='propose_reassignment'&&who.length>0)||ref.length<4||ref.length>250||memo.length>500)
   return status.textContent='WITHHELD: valid owner decision and independent proposal required';
  if(!window.confirm('Record INTERNAL documentary follow-up only? This does not reassign a reviewer, notify a customer or authorize work.'))return;
  busy=true;form.disabled=refresh.disabled=true;try{const ctx=await session();if(ctx.uid!==principal||company.value!==id)throw Error('Owner changed');
   const result=await ctx.sb.rpc('ywi_rpc_review_discrepancy_464',{p_company_id:id,p_operation_id:operationId(),p_recheck_outcome_id:c.outcome_id,
    p_decision:selection,p_proposed_reviewer_user_id:selection==='propose_reassignment'?who:null,p_source_reference:ref,p_notes:memo||null});
   if(result.error||!uuid(result.data?.id)||result.data.company_id!==id||result.data.recorded!==true||
    !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions'].every(k=>result.data[k]===false))
    throw Error('Unverified owner review receipt');await reconcile();alternative.value=reference.value=notes.value='';}
   catch(e){verified=null;status.textContent='WITHHELD: '+(e.message||e)+'. Inspect journal before retry.';}
   finally{busy=false;refresh.disabled=false;form.disabled=verified?.state!=='source_verified'||!verified.cases.some(c=>c.service_enabled&&!verified.reviews.some(r=>r.recheck_outcome_id===c.outcome_id));}});
 company.addEventListener('change',()=>{epoch++;verified=null;form.disabled=true;journal.replaceChildren();status.textContent='HOLD: company changed; verify again.';});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])document.addEventListener(event,()=>invalidate('HOLD: owner identity, permissions or service switch changed; verify again.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

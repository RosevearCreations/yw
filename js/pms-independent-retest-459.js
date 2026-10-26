/* YW Item 459: source-linked owner retest handoff to an independent reviewer.
 * A comparison never closes the original 457 decision or authorizes service. */
(()=>{'use strict';
const modules=Object.freeze(['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture']);
const outcomes=Object.freeze(['comparison_matches','comparison_differs','insufficient_evidence']);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const node=(tag,t)=>{const e=document.createElement(tag);if(t!==undefined)e.textContent=t;return e;};
function requestId(){const c=globalThis.crypto;if(c?.randomUUID)return c.randomUUID();if(!c?.getRandomValues)throw Error('Secure randomness unavailable');
 const b=c.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const s=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');}
function bounded(rows,total,capped){return Array.isArray(rows)&&rows.length<=60&&Number.isSafeInteger(total)&&
 total>=rows.length&&capped===(total>60)&&capped===false;}
function inspectInbox(x,{userId,now=Date.now()}={}){
 const ts=Date.parse(x?.captured_at);
 if(!uuid(userId)||!Number.isFinite(ts)||ts>now+60000||now-ts>300000||
  !bounded(x?.companies,x?.total,x?.sample_capped)||x.release_green!==false||x.outbound_actions!==false)
  return {state:'withheld',reason:'Stale or unverified retest inbox'};
 const seen=new Set();for(const c of x.companies){if(!uuid(c.id)||!c.name||seen.has(c.id)||
  (c.is_owner!==true&&c.is_assigned_reviewer!==true)||
  typeof c.is_owner!=='boolean'||typeof c.is_assigned_reviewer!=='boolean')
  return {state:'withheld',reason:'Foreign/duplicate company in retest inbox'};seen.add(c.id);}
 return {state:'source_verified',companies:x.companies};
}
function inspect(x,{companyId,userId,now=Date.now()}={}){
 const ts=Date.parse(x?.captured_at);
 if(!uuid(companyId)||!uuid(userId)||x?.company_id!==companyId||x.viewer_id!==userId||
  (x.is_owner!==true&&x.is_assigned_reviewer!==true)||
  !Number.isFinite(ts)||ts>now+60000||now-ts>300000||
  !['independent_reapproval','field_accepted','service_authorized','release_green',
   'outbound_actions','synthetic','mutation_authorized'].every(k=>x[k]===false)||
  !Array.isArray(x.services)||x.services.length!==7||
  !bounded(x.followups,x.followup_total,x.followup_sample_capped)||
  !bounded(x.assignments,x.assignment_total,x.assignment_sample_capped)||
  !bounded(x.comparisons,x.comparison_total,x.comparison_sample_capped)||
  !bounded(x.fresh_evidence,x.fresh_evidence_total,x.fresh_evidence_sample_capped))
  return {state:'withheld',reason:'Retest source missing, stale, truncated, or falsely approving'};
 const seen=new Set();for(const s of x.services){if(s.company_id!==companyId||!modules.includes(s.module_key)||
  seen.has(s.module_key)||typeof s.enabled!=='boolean')return {state:'withheld',reason:'Seven-service scope invalid'};
  seen.add(s.module_key);}
 seen.clear();for(const f of x.followups){if(!uuid(f.id)||seen.has(f.id)||f.company_id!==companyId||
  !uuid(f.independent_decision_id)||!uuid(f.followup_evidence_id)||
  f.decision!=='returned_for_follow_up'||!modules.includes(f.service_module_key)||
  !uuid(f.target_id)||!['work_orders','estimates'].includes(f.target_table)||
  !Number.isFinite(Date.parse(f.created_at))||!Number.isFinite(Date.parse(f.decision_at))||
  Date.parse(f.created_at)<=Date.parse(f.decision_at))return {state:'withheld',reason:'Retest follow-up provenance invalid'};
  seen.add(f.id);}
 seen.clear();for(const a of x.assignments){if(!uuid(a.id)||seen.has(a.id)||a.company_id!==companyId||
  !x.followups.some(f=>f.id===a.owner_followup_id)||!uuid(a.reviewer_user_id)||
  (!x.is_owner&&a.reviewer_user_id!==userId)||!Number.isFinite(Date.parse(a.created_at))||
  Date.parse(a.created_at)<=Date.parse(x.followups.find(f=>f.id===a.owner_followup_id).created_at))
  return {state:'withheld',reason:'Foreign or invalid independent retest assignment'};
  seen.add(a.id);}
 seen.clear();for(const e of x.fresh_evidence){if(!uuid(e.id)||seen.has(e.id)||e.company_id!==companyId||
  e.checkpoint!=='field_observation'||e.disposition!=='observed'||
  !Number.isFinite(Date.parse(e.created_at))||
  !x.assignments.some(a=>Date.parse(e.created_at)>Date.parse(a.created_at)))
  return {state:'withheld',reason:'Fresh field observation missing original timing'};seen.add(e.id);}
 seen.clear();for(const c of x.comparisons){const a=x.assignments.find(a=>a.id===c.assignment_id);
  const f=x.followups.find(f=>f.id===a?.owner_followup_id);
  const e=x.fresh_evidence.find(e=>e.id===c.fresh_evidence_id);
  if(!uuid(c.id)||seen.has(c.id)||c.company_id!==companyId||!a||!f||!e||
   !outcomes.includes(c.outcome)||c.fresh_evidence_id===f.followup_evidence_id||
   Date.parse(e.created_at)<=Date.parse(a.created_at)||
   !Number.isFinite(Date.parse(c.created_at))||Date.parse(c.created_at)<Date.parse(e.created_at)||
   (!x.is_owner&&a.reviewer_user_id!==userId))return {state:'withheld',reason:'Invalid reviewer comparison provenance'};
  seen.add(c.id);}
 return {state:'source_verified',companyId,userId,isOwner:x.is_owner,isReviewer:x.is_assigned_reviewer,
  services:x.services,followups:x.followups,assignments:x.assignments,comparisons:x.comparisons,
  evidence:x.fresh_evidence,fieldAccepted:false,serviceAuthorized:false,releaseGreen:false};
}
window.YWI459=Object.freeze({inspect,inspectInbox,outcomes,modules});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('retest459'))return;
 const panel=node('details');panel.id='retest459';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='PMS · Independent Retest Comparison';panel.dataset.adminHubGroups='management operations';
 panel.append(node('summary','459 · Independent Retest Assignment & Evidence Comparison'));
 const body=node('div');body.className='admin-panel-block pms459';
 body.append(node('p','Assign only actual 458 retest-ready owner follow-ups to a different active reviewer. A fresh 455 observation must be recorded AFTER the assignment before that reviewer can independently compare it. Matching evidence does not close the original 457 decision or authorize any work.'));
 const help=node('a','ⓘ Independent retest assignment and comparison Help');help.href='/help.html#pms-independent-retest-459';body.append(help);
 const controls=node('div');controls.className='pms459-controls';
 const label=node('label','Owned or independently assigned company'),company=node('select');company.id='pms459Company';label.append(company);
 const refresh=node('button','Verify retest assignments and new evidence');refresh.id='pms459Refresh';refresh.type='button';refresh.className='secondary';controls.append(label,refresh);body.append(controls);
 const status=node('p','HOLD: sign in and verify company and reviewer sources.');status.id='pms459Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const overview=node('section');overview.id='pms459Overview';overview.setAttribute('aria-label','Independent retest source summary');body.append(overview);
 const journal=node('section');journal.id='pms459Journal';journal.setAttribute('aria-label','Immutable retest assignment and comparison journal');body.append(journal);
 const field=(form,id,labelText,tag,max)=>{const l=node('label',labelText),e=node(tag);e.id=id;if(max)e.maxLength=max;l.append(e);form.append(l);return e;};
 const ownerForm=node('fieldset');ownerForm.id='pms459OwnerForm';ownerForm.disabled=true;ownerForm.append(node('legend','Owner: assign independent retest (no operational permission)'));
 const followup=field(ownerForm,'pms459Followup','Real returned-case owner follow-up to retest','select');
 const reviewer=field(ownerForm,'pms459Reviewer','Different active reviewer UUID (not owner)','input',36);reviewer.placeholder='Existing reviewer profile UUID';
 const ownerRef=field(ownerForm,'pms459OwnerReference','Assignment source reference (4–250 characters)','input',250);
 const ownerNotes=field(ownerForm,'pms459OwnerNotes','Owner notes (optional)','textarea',500);
 const assign=node('button','Append independent retest assignment');assign.id='pms459Assign';assign.type='button';assign.className='secondary';ownerForm.append(assign);body.append(ownerForm);
 const reviewerForm=node('fieldset');reviewerForm.id='pms459ReviewerForm';reviewerForm.disabled=true;reviewerForm.append(node('legend','Assigned reviewer: compare new evidence (not closure)'));
 const assignment=field(reviewerForm,'pms459Assignment','Our unreviewed retest assignment','select');
 const fresh=field(reviewerForm,'pms459Evidence','New observed 455 field evidence after assignment','select');
 const outcome=field(reviewerForm,'pms459Outcome','Independent documentary comparison','select');for(const s of outcomes){const o=node('option',s.replaceAll('_',' '));o.value=s;outcome.append(o);}
 const reviewRef=field(reviewerForm,'pms459ReviewerReference','Reviewer comparison source reference','input',250);
 const reviewNotes=field(reviewerForm,'pms459ReviewerNotes','Reviewer notes (optional)','textarea',500);
 const record=node('button','Append independent evidence comparison');record.id='pms459Record';record.type='button';record.className='secondary';reviewerForm.append(record);body.append(reviewerForm);
 const hold=node('p','REAL FIELD / SAFETY / BUSINESS APPROVAL: HOLD. Even a matching independent retest comparison never closes the original 457 review, grants service authority, or changes Production release gates.');hold.id='pms459Release';hold.className='notice';body.append(hold);panel.append(body);host.append(panel);
 let epoch=0,busy=false,verified=null,principal=null;
 const info=s=>{status.textContent=s;};
 const options=(el,placeholder,rows,textFn,valueFn)=>{el.replaceChildren();const blank=node('option',placeholder);blank.value='';el.append(blank);for(const r of rows){const o=node('option',textFn(r));o.value=valueFn(r);el.append(o);}};
 function invalidate(message){epoch++;verified=null;principal=null;company.replaceChildren();ownerForm.disabled=reviewerForm.disabled=true;overview.replaceChildren();journal.replaceChildren();info(message);}
 async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.auth?.getUser||!sb?.rpc||
   !window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Signed-in Jobs access required');
  const user=await sb.auth.getUser();if(user.error||user.data?.user?.id!==a.user.id)throw Error('Session changed');
  return {uid:a.user.id,sb};}
 const alive=(ctx,ver,id)=>epoch===ver&&company.value===id&&
  window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&window.YWI_AUTH.getState().user?.id===ctx.uid;
 function show(d){verified=d;overview.replaceChildren();journal.replaceChildren();ownerForm.disabled=reviewerForm.disabled=true;
  if(d.state!=='source_verified')return info('WITHHELD: '+d.reason);
  info('SOURCE VERIFIED: '+d.followups.length+' retest-ready owner follow-ups; '+d.assignments.length+' reviewer assignments and '+d.comparisons.length+' independent comparisons. Field acceptance HOLD.');
  for(const s of ['Seven modules: '+d.services.filter(s=>s.enabled).length+' ON / '+d.services.filter(s=>!s.enabled).length+' OFF',
   'Retest-ready original owner follow-ups: '+d.followups.length,
   'Assigned independent retests: '+d.assignments.length,
   'Immutable reviewer evidence comparisons: '+d.comparisons.length])overview.append(node('p',s));
  journal.append(node('h3','Retest comparison journal'));
  for(const c of d.comparisons){const a=node('article');a.className='pms459-entry';a.append(node('strong',c.outcome.replaceAll('_',' ')),node('p',c.source_reference+' · '+c.created_at));journal.append(a);}
  if(!d.comparisons.length)journal.append(node('p','No independent retest comparison recorded. All review/field gates remain HOLD.'));
  const eligible=d.followups.filter(f=>!d.assignments.some(a=>a.owner_followup_id===f.id)&&
   d.services.some(s=>s.module_key===f.service_module_key&&s.enabled));
  options(followup,'Select an unassigned real retest follow-up',eligible,f=>f.service_module_key+' · '+f.created_at,f=>f.id);
  ownerForm.disabled=!d.isOwner||!eligible.length;
  const open=d.assignments.filter(a=>a.reviewer_user_id===d.userId&&!d.comparisons.some(c=>c.assignment_id===a.id)&&
   d.services.some(s=>s.module_key===d.followups.find(f=>f.id===a.owner_followup_id)?.service_module_key&&s.enabled));
  options(assignment,'Choose our open reviewer assignment',open,a=>a.source_reference+' · '+a.created_at,a=>a.id);
  options(fresh,'Choose new observed post-assignment field evidence',d.evidence,e=>e.source_reference+' · '+e.created_at,e=>e.id);
  reviewerForm.disabled=!d.isReviewer||!open.length;
 }
 async function reconcile(){const ver=epoch,ctx=await session();const inbox=await ctx.sb.rpc('ywi_rpc_retest_inbox_459');
  if(epoch!==ver||inbox.error)throw Error('Retest inbox denied');
  const checked=inspectInbox(inbox.data,{userId:ctx.uid});if(checked.state!=='source_verified')throw Error(checked.reason);
  const prev=company.value;options(company,'Choose verified owner/reviewer company',checked.companies,c=>c.name,c=>c.id);
  if(checked.companies.some(c=>c.id===prev))company.value=prev;else if(checked.companies.length===1)company.value=checked.companies[0].id;
  principal=ctx.uid;if(!checked.companies.length){info('HOLD: no real company or independent assignment. Test data is not seeded.');return;}
  const id=company.value;if(!checked.companies.some(c=>c.id===id)){info('HOLD: select a verified company');return;}
  const one=await ctx.sb.rpc('ywi_rpc_independent_retest_459',{p_company_id:id});
  if(!alive(ctx,ver,id)||one.error||!one.data)throw Error('459 source read denied');
  const two=await ctx.sb.rpc('ywi_rpc_independent_retest_459',{p_company_id:id});
  if(!alive(ctx,ver,id)||two.error||!two.data||
   ['services','followups','assignments','comparisons','fresh_evidence'].some(k=>JSON.stringify(one.data[k])!==JSON.stringify(two.data[k])))
   throw Error('Retest source or service toggles changed during verification');
  const d=inspect(two.data,{companyId:id,userId:ctx.uid});if(!alive(ctx,ver,id))throw Error('Identity changed');show(d);
 }
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=true;verified=null;ownerForm.disabled=reviewerForm.disabled=true;
  info('Verifying original returned case, owner follow-up, reviewer assignments and fresh evidence…');
  try{await reconcile();}catch(e){show({state:'withheld',reason:e.message||String(e)});}finally{busy=false;refresh.disabled=company.disabled=false;}});
 async function append(rpc,args,ctx,version,id){const result=await ctx.sb.rpc(rpc,args);
  if(!alive(ctx,version,id)||result.error||result.data?.company_id!==id||result.data?.recorded!==true||
   result.data?.field_accepted!==false||result.data?.service_authorized!==false||
   result.data?.independent_reapproval!==false||result.data?.outbound_actions!==false||!uuid(result.data?.id))
   throw Error('Unverifiable journal receipt. Inspect before any manual retry');
 }
 assign.addEventListener('click',async()=>{if(busy||verified?.state!=='source_verified'||!verified.isOwner)return;
  const id=company.value,version=epoch,f=verified.followups.find(x=>x.id===followup.value),other=reviewer.value.trim(),ref=ownerRef.value.trim(),notes=ownerNotes.value.trim();
  if(!f||!uuid(other)||other===principal||ref.length<4||ref.length>250||notes.length>500)return info('WITHHELD: real retest follow-up, other reviewer and source required');
  if(!window.confirm('Assign an independent RETEST REVIEW only? No service or field authorization.'))return;
  busy=true;ownerForm.disabled=reviewerForm.disabled=true;refresh.disabled=true;
  try{const ctx=await session();if(ctx.uid!==principal||!alive(ctx,version,id))throw Error('Owner identity changed');
   await append('ywi_rpc_assign_retest_459',{p_company_id:id,p_request_id:requestId(),p_owner_followup_id:f.id,p_reviewer_user_id:other,p_source_reference:ref,p_notes:notes||null},ctx,version,id);
   ownerRef.value=ownerNotes.value='';await reconcile();
  }catch(e){verified=null;info('WITHHELD: '+(e.message||e)+'. Inspect journal before manual retry.');}
  finally{busy=false;refresh.disabled=false;}});
 record.addEventListener('click',async()=>{if(busy||verified?.state!=='source_verified'||!verified.isReviewer)return;
  const id=company.value,version=epoch,a=verified.assignments.find(x=>x.id===assignment.value),
   f=verified.followups.find(f=>f.id===a?.owner_followup_id),e=verified.evidence.find(x=>x.id===fresh.value),
   choice=outcome.value,ref=reviewRef.value.trim(),notes=reviewNotes.value.trim();
  if(!a||a.reviewer_user_id!==principal||!f||!e||e.id===f.followup_evidence_id||
   Date.parse(e.created_at)<=Date.parse(a.created_at)||!outcomes.includes(choice)||ref.length<4||ref.length>250||notes.length>500)
   return info('WITHHELD: assigned reviewer requires distinct NEW observed evidence after assignment');
  if(!window.confirm('Append a documentary retest comparison ONLY? Independent closure and field authorization stay HOLD.'))return;
  busy=true;ownerForm.disabled=reviewerForm.disabled=true;refresh.disabled=true;
  try{const ctx=await session();if(ctx.uid!==principal||!alive(ctx,version,id))throw Error('Reviewer identity changed');
   await append('ywi_rpc_record_retest_comparison_459',{p_company_id:id,p_request_id:requestId(),p_assignment_id:a.id,p_fresh_evidence_id:e.id,p_outcome:choice,p_source_reference:ref,p_notes:notes||null},ctx,version,id);
   reviewRef.value=reviewNotes.value='';await reconcile();
  }catch(e){verified=null;info('WITHHELD: '+(e.message||e)+'. Inspect journal before manual retry.');}
  finally{busy=false;refresh.disabled=false;}});
 company.addEventListener('change',()=>{epoch++;verified=null;ownerForm.disabled=reviewerForm.disabled=true;overview.replaceChildren();journal.replaceChildren();info('HOLD: company changed; recheck source.');});
 for(const ev of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])
  document.addEventListener(ev,()=>invalidate('HOLD: identity, permission or service switch changed; recheck.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

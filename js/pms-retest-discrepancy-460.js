/* YW 460: source-verified retest discrepancy triage and independent documentary reassessment.
 * An independent reassessment never overrides the original 457 HOLD or grants service. */
(()=>{'use strict';
const modules=Object.freeze(['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture']);
const kinds=Object.freeze(['investigate_difference','request_fresh_evidence','keep_on_hold']);
const outcomes=Object.freeze(['difference_confirmed','evidence_gap_confirmed','further_review_required']);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const node=(tag,t)=>{const e=document.createElement(tag);if(t!==undefined)e.textContent=t;return e;};
const fresh=x=>Number.isFinite(Date.parse(x))&&Date.parse(x)<=Date.now()+60000&&Date.now()-Date.parse(x)<=300000;
const sampled=(rows,total,capped)=>Array.isArray(rows)&&rows.length<=60&&Number.isSafeInteger(total)&&
 total>=rows.length&&capped===(total>60)&&!capped;
function requestId(){const c=globalThis.crypto;if(c?.randomUUID)return c.randomUUID();if(!c?.getRandomValues)throw Error('Secure randomness unavailable');
 const b=c.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const s=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');}
function inspectInbox(x,{userId}={}){
 if(!uuid(userId)||!fresh(x?.captured_at)||!sampled(x?.companies,x?.total,x?.sample_capped)||
  x.field_accepted!==false||x.service_authorized!==false||x.release_green!==false)
  return {state:'withheld',reason:'Unverified or stale discrepancy company inbox'};
 const seen=new Set();for(const c of x.companies){if(!uuid(c.id)||!c.name||seen.has(c.id)||
  typeof c.is_owner!=='boolean'||typeof c.is_reassessor!=='boolean'||(!c.is_owner&&!c.is_reassessor))
  return {state:'withheld',reason:'Foreign or duplicate company'};seen.add(c.id);}
 return {state:'source_verified',companies:x.companies};
}
function inspect(x,{companyId,userId}={}){
 if(!uuid(companyId)||!uuid(userId)||x?.company_id!==companyId||x.viewer_id!==userId||
  (!x.is_owner&&!x.is_reassessor)||typeof x.is_owner!=='boolean'||typeof x.is_reassessor!=='boolean'||
  !fresh(x.captured_at)||!['independent_reapproval','field_accepted','service_authorized',
   'release_green','outbound_actions','synthetic','mutation_authorized'].every(k=>x[k]===false)||
  !Array.isArray(x.services)||x.services.length!==7||
  !sampled(x.cases,x.case_total,x.case_sample_capped)||
  !sampled(x.triages,x.triage_total,x.triage_sample_capped)||
  !sampled(x.reassessments,x.reassessment_total,x.reassessment_sample_capped))
  return {state:'withheld',reason:'Retest discrepancy source stale, incomplete, or falsely approving'};
 const seen=new Set();for(const s of x.services){if(s.company_id!==companyId||!modules.includes(s.module_key)||
  typeof s.enabled!=='boolean'||seen.has(s.module_key))return {state:'withheld',reason:'Service switches not verified'};
  seen.add(s.module_key);}
 seen.clear();for(const c of x.cases){if(!uuid(c.comparison_id)||seen.has(c.comparison_id)||c.company_id!==companyId||
  !uuid(c.assignment_id)||!uuid(c.owner_user_id)||!uuid(c.comparing_reviewer_id)||
  c.comparing_reviewer_id===c.owner_user_id||
  !uuid(c.followup_id)||!uuid(c.original_decision_id)||!uuid(c.original_evidence_id)||
  !uuid(c.fresh_evidence_id)||c.original_evidence_id===c.fresh_evidence_id||
  !uuid(c.target_id)||!['work_orders','estimates'].includes(c.target_table)||
  !modules.includes(c.service_module_key)||
  !['comparison_differs','insufficient_evidence'].includes(c.comparison_outcome)||
  c.original_decision!=='returned_for_follow_up'||c.followup_disposition!=='retest_evidence_ready'||
  c.review_outcome!=='ready_for_independent_review'||
  c.fresh_checkpoint!=='field_observation'||c.fresh_disposition!=='observed'||
  !Number.isFinite(Date.parse(c.assignment_at))||!Number.isFinite(Date.parse(c.fresh_at))||
  !Number.isFinite(Date.parse(c.comparison_at))||
  Date.parse(c.fresh_at)<=Date.parse(c.assignment_at)||Date.parse(c.comparison_at)<Date.parse(c.fresh_at))
  return {state:'withheld',reason:'Invalid 455–459 discrepancy chain'};seen.add(c.comparison_id);}
 seen.clear();for(const t of x.triages){const c=x.cases.find(c=>c.comparison_id===t.comparison_id);
  if(!uuid(t.id)||seen.has(t.id)||t.company_id!==companyId||!c||!uuid(t.reassessor_user_id)||
   t.reassessor_user_id===c.owner_user_id||t.reassessor_user_id===c.comparing_reviewer_id||
   (!x.is_owner&&t.reassessor_user_id!==userId)||!kinds.includes(t.triage_kind)||
   !Number.isFinite(Date.parse(t.created_at))||Date.parse(t.created_at)<=Date.parse(c.comparison_at))
   return {state:'withheld',reason:'Foreign or non-independent discrepancy triage'};seen.add(t.id);}
 seen.clear();for(const r of x.reassessments){const t=x.triages.find(t=>t.id===r.triage_id),
   c=x.cases.find(c=>c.comparison_id===t?.comparison_id);
  if(!uuid(r.id)||seen.has(r.id)||r.company_id!==companyId||!t||!c||
   !outcomes.includes(r.outcome)||
   (r.outcome==='difference_confirmed'&&c.comparison_outcome!=='comparison_differs')||
   (r.outcome==='evidence_gap_confirmed'&&c.comparison_outcome!=='insufficient_evidence')||
   !Number.isFinite(Date.parse(r.created_at))||Date.parse(r.created_at)<=Date.parse(t.created_at))
   return {state:'withheld',reason:'Invalid independent reassessment record'};seen.add(r.id);}
 return {state:'source_verified',companyId,userId,isOwner:x.is_owner,isReassessor:x.is_reassessor,
  services:x.services,cases:x.cases,triages:x.triages,reassessments:x.reassessments,
  fieldAccepted:false,serviceAuthorized:false,releaseGreen:false};
}
window.YWI460=Object.freeze({inspect,inspectInbox,kinds,outcomes,modules});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('discrepancy460'))return;
 const panel=node('details');panel.id='discrepancy460';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='PMS · Independent Retest Discrepancy Triage';panel.dataset.adminHubGroups='management operations';
 panel.append(node('summary','460 · Retest Discrepancy Triage & Independent Reassessment'));
 const body=node('div');body.className='admin-panel-block pms460';
 body.append(node('p','Only genuine 459 differences or insufficient evidence enter this owner triage queue. A THIRD active reviewer, different from the owner and original comparing reviewer, can append an independent follow-up assessment. No result closes the 457 review or authorizes field work.'));
 const help=node('a','ⓘ Retest discrepancy triage Help');help.href='/help.html#pms-retest-discrepancy-460';body.append(help);
 const controls=node('div');controls.className='pms460-controls';const label=node('label','Owned or independently assigned company'),company=node('select');company.id='pms460Company';label.append(company);
 const refresh=node('button','Verify discrepancy and review queue');refresh.id='pms460Refresh';refresh.type='button';refresh.className='secondary';controls.append(label,refresh);body.append(controls);
 const status=node('p','HOLD: verify signed-in company, comparison and reviewer sources.');status.id='pms460Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const overview=node('section');overview.id='pms460Overview';overview.setAttribute('aria-label','Source verified discrepancy counts');body.append(overview);
 const journal=node('section');journal.id='pms460Journal';journal.setAttribute('aria-label','Immutable discrepancy triage and reassessment journal');body.append(journal);
 const field=(form,id,text,tag,max)=>{const l=node('label',text),e=node(tag);e.id=id;if(max)e.maxLength=max;l.append(e);form.append(l);return e;};
 const ownerForm=node('fieldset');ownerForm.id='pms460OwnerForm';ownerForm.disabled=true;ownerForm.append(node('legend','Owner: assign unresolved discrepancy to a THIRD independent reviewer'));
 const caseSelect=field(ownerForm,'pms460Case','Real untriaged 459 discrepancy','select');
 const reassessor=field(ownerForm,'pms460Reassessor','Different active reassessor UUID (not original reviewer or owner)','input',36);reassessor.placeholder='Existing independent reviewer profile UUID';
 const kind=field(ownerForm,'pms460Kind','Documentary triage action','select');for(const k of kinds){const o=node('option',k.replaceAll('_',' '));o.value=k;kind.append(o);}
 const ownerRef=field(ownerForm,'pms460OwnerReference','Triage source reference (4–250 characters)','input',250);
 const ownerNotes=field(ownerForm,'pms460OwnerNotes','Owner notes (optional)','textarea',500);
 const appendTriage=node('button','Append owner triage assignment');appendTriage.id='pms460Triage';appendTriage.type='button';appendTriage.className='secondary';ownerForm.append(appendTriage);body.append(ownerForm);
 const reviewerForm=node('fieldset');reviewerForm.id='pms460ReviewerForm';reviewerForm.disabled=true;reviewerForm.append(node('legend','Independent reassessor: append documentary finding (no closure)'));
 const triageSelect=field(reviewerForm,'pms460TriageSelect','Our open assigned discrepancy','select');
 const result=field(reviewerForm,'pms460Outcome','Independent reassessment finding','select');for(const s of outcomes){const o=node('option',s.replaceAll('_',' '));o.value=s;result.append(o);}
 const reviewRef=field(reviewerForm,'pms460ReviewerReference','Independent source reference','input',250);
 const reviewNotes=field(reviewerForm,'pms460ReviewerNotes','Reassessment notes (optional)','textarea',500);
 const appendReview=node('button','Append independent reassessment');appendReview.id='pms460Reassess';appendReview.type='button';appendReview.className='secondary';reviewerForm.append(appendReview);body.append(reviewerForm);
 const hold=node('p','REAL FIELD / SAFETY / BUSINESS APPROVAL: HOLD. A 460 review never closes the original 457 decision, approves jobs, creates financial records or changes Production release gates.');hold.id='pms460Release';hold.className='notice';body.append(hold);
 panel.append(body);host.append(panel);
 let epoch=0,busy=false,verified=null,principal=null;
 const info=s=>{status.textContent=s;};
 const opts=(el,placeholder,rows,labelFn,valueFn)=>{el.replaceChildren();const z=node('option',placeholder);z.value='';el.append(z);for(const item of rows){const o=node('option',labelFn(item));o.value=valueFn(item);el.append(o);}};
 function invalidate(msg){epoch++;verified=null;principal=null;company.replaceChildren();ownerForm.disabled=reviewerForm.disabled=true;overview.replaceChildren();journal.replaceChildren();info(msg);}
 async function session(){const state=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(state?.isAuthenticated!==true||!uuid(state.user?.id)||!sb?.auth?.getUser||!sb?.rpc||
   !window.YWISecurity?.canViewModule?.('jobs',state.role,'view'))throw Error('Signed-in Jobs access required');
  const who=await sb.auth.getUser();if(who.error||who.data?.user?.id!==state.user.id)throw Error('Session changed');
  return {uid:state.user.id,sb};}
 const alive=(ctx,ver,id)=>epoch===ver&&company.value===id&&
  window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&window.YWI_AUTH.getState().user?.id===ctx.uid;
 function show(d){verified=d;overview.replaceChildren();journal.replaceChildren();ownerForm.disabled=reviewerForm.disabled=true;
  if(d.state!=='source_verified')return info('WITHHELD: '+d.reason);
  info('SOURCE VERIFIED: '+d.cases.length+' genuine discrepancies, '+d.triages.length+' owner triages, '+d.reassessments.length+' independent findings. Field authorization HOLD.');
  for(const t of ['Service switches: '+d.services.filter(s=>s.enabled).length+' ON / '+d.services.filter(s=>!s.enabled).length+' OFF',
   'Unresolved comparisons: '+d.cases.filter(c=>!d.triages.some(t=>t.comparison_id===c.comparison_id)).length,
   'Assigned independent reassessments: '+d.triages.length,'Recorded documentary findings: '+d.reassessments.length])overview.append(node('p',t));
  journal.append(node('h3','Discrepancy and reassessment history'));
  for(const c of d.cases){const item=node('article');item.className='pms460-entry';item.append(node('strong',c.service_module_key+' · '+c.comparison_outcome.replaceAll('_',' ')),node('p',c.comparison_reference+' · '+c.comparison_at));
   const t=d.triages.find(t=>t.comparison_id===c.comparison_id);
   if(t){item.append(node('p','Assigned independent reassessor · '+t.triage_kind.replaceAll('_',' ')));const r=d.reassessments.find(r=>r.triage_id===t.id);
    item.append(node('p',r?'Independent finding: '+r.outcome.replaceAll('_',' '):'Awaiting independent finding · HOLD'));}
   journal.append(item);}
  if(!d.cases.length)journal.append(node('p','No genuine discrepant comparisons. No synthetic cases are added.'));
  const untriaged=d.cases.filter(c=>!d.triages.some(t=>t.comparison_id===c.comparison_id)&&
   d.services.some(s=>s.module_key===c.service_module_key&&s.enabled));
  opts(caseSelect,'Select unresolved source-linked comparison',untriaged,c=>c.service_module_key+' · '+c.comparison_outcome+' · '+c.comparison_at,c=>c.comparison_id);
  ownerForm.disabled=!d.isOwner||!untriaged.length;
  const open=d.triages.filter(t=>t.reassessor_user_id===d.userId&&
   !d.reassessments.some(r=>r.triage_id===t.id)&&d.cases.some(c=>c.comparison_id===t.comparison_id&&
    d.services.some(s=>s.module_key===c.service_module_key&&s.enabled)));
  opts(triageSelect,'Select our open independent reassessment',open,t=>t.triage_kind+' · '+t.created_at,t=>t.id);
  reviewerForm.disabled=!d.isReassessor||!open.length;
 }
 async function reconcile(){const version=epoch,ctx=await session();const inbox=await ctx.sb.rpc('ywi_rpc_discrepancy_inbox_460');
  if(version!==epoch||inbox.error)throw Error('Discrepancy inbox denied');
  const checked=inspectInbox(inbox.data,{userId:ctx.uid});if(checked.state!=='source_verified')throw Error(checked.reason);
  const previous=company.value;opts(company,'Choose verified owner/reassessor company',checked.companies,c=>c.name,c=>c.id);
  if(checked.companies.some(c=>c.id===previous))company.value=previous;else if(checked.companies.length===1)company.value=checked.companies[0].id;
  principal=ctx.uid;if(!checked.companies.length){info('HOLD: no genuine company or third-party reassessment assignment.');return;}
  const id=company.value;if(!checked.companies.some(c=>c.id===id)){info('HOLD: select a verified company');return;}
  const a=await ctx.sb.rpc('ywi_rpc_discrepancy_queue_460',{p_company_id:id});
  if(!alive(ctx,version,id)||a.error||!a.data)throw Error('Discrepancy read denied');
  const b=await ctx.sb.rpc('ywi_rpc_discrepancy_queue_460',{p_company_id:id});
  if(!alive(ctx,version,id)||b.error||!b.data||
   ['services','cases','triages','reassessments'].some(k=>JSON.stringify(a.data[k])!==JSON.stringify(b.data[k])))
   throw Error('Discrepancy sources or service toggles changed during verification');
  show(inspect(b.data,{companyId:id,userId:ctx.uid}));}
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=true;verified=null;
  ownerForm.disabled=reviewerForm.disabled=true;info('Checking 455–459 comparison provenance, service switches and separate reviewer…');
  try{await reconcile();}catch(e){show({state:'withheld',reason:e.message||String(e)});}finally{busy=false;refresh.disabled=company.disabled=false;}});
 async function append(rpc,args,ctx,version,id){const out=await ctx.sb.rpc(rpc,args);
  if(!alive(ctx,version,id)||out.error||out.data?.company_id!==id||out.data?.recorded!==true||
   out.data?.field_accepted!==false||out.data?.service_authorized!==false||
   out.data?.independent_reapproval!==false||out.data?.outbound_actions!==false||!uuid(out.data?.id))
   throw Error('Unverified journal receipt. Inspect before manual retry');}
 appendTriage.addEventListener('click',async()=>{if(busy||verified?.state!=='source_verified'||!verified.isOwner)return;
  const id=company.value,version=epoch,c=verified.cases.find(c=>c.comparison_id===caseSelect.value),
   other=reassessor.value.trim(),source=ownerRef.value.trim(),notes=ownerNotes.value.trim(),choice=kind.value;
  if(!c||!uuid(other)||other===principal||other===c.comparing_reviewer_id||!kinds.includes(choice)||
   source.length<4||source.length>250||notes.length>500)return info('WITHHELD: genuine discrepancy, THIRD reviewer and source reference required');
  if(!window.confirm('Assign documentary discrepancy review to a THIRD reviewer? Original 457 and field gates stay HOLD.'))return;
  busy=true;ownerForm.disabled=reviewerForm.disabled=true;refresh.disabled=true;
  try{const ctx=await session();if(ctx.uid!==principal||!alive(ctx,version,id))throw Error('Owner identity changed');
   await append('ywi_rpc_triage_retest_discrepancy_460',{p_company_id:id,p_request_id:requestId(),
    p_comparison_id:c.comparison_id,p_reassessor_user_id:other,p_triage_kind:choice,
    p_source_reference:source,p_notes:notes||null},ctx,version,id);
   ownerRef.value=ownerNotes.value='';await reconcile();
  }catch(e){verified=null;info('WITHHELD: '+(e.message||e)+'. Inspect journal before manual retry.');}
  finally{busy=false;refresh.disabled=false;}});
 appendReview.addEventListener('click',async()=>{if(busy||verified?.state!=='source_verified'||!verified.isReassessor)return;
  const id=company.value,version=epoch,t=verified.triages.find(t=>t.id===triageSelect.value),
   c=verified.cases.find(c=>c.comparison_id===t?.comparison_id),choice=result.value,
   source=reviewRef.value.trim(),notes=reviewNotes.value.trim();
  if(!t||t.reassessor_user_id!==principal||!c||!outcomes.includes(choice)||
   (choice==='difference_confirmed'&&c.comparison_outcome!=='comparison_differs')||
   (choice==='evidence_gap_confirmed'&&c.comparison_outcome!=='insufficient_evidence')||
   source.length<4||source.length>250||notes.length>500)return info('WITHHELD: own assigned triage and outcome-matched source required');
  if(!window.confirm('Append independent documentary reassessment ONLY? No real service authorization or 457 closure.'))return;
  busy=true;ownerForm.disabled=reviewerForm.disabled=true;refresh.disabled=true;
  try{const ctx=await session();if(ctx.uid!==principal||!alive(ctx,version,id))throw Error('Reviewer identity changed');
   await append('ywi_rpc_reassess_retest_discrepancy_460',{p_company_id:id,p_request_id:requestId(),
    p_triage_id:t.id,p_outcome:choice,p_source_reference:source,p_notes:notes||null},ctx,version,id);
   reviewRef.value=reviewNotes.value='';await reconcile();
  }catch(e){verified=null;info('WITHHELD: '+(e.message||e)+'. Inspect journal before manual retry.');}
  finally{busy=false;refresh.disabled=false;}});
 company.addEventListener('change',()=>{epoch++;verified=null;ownerForm.disabled=reviewerForm.disabled=true;
  overview.replaceChildren();journal.replaceChildren();info('HOLD: company changed; recheck all sources.');});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])
  document.addEventListener(event,()=>invalidate('HOLD: identity, permission or service changed; verify again.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

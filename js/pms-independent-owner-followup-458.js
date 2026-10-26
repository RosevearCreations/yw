/* YW Item 458: owner reassessment of independent 457 reviewer decisions.
 * Source-linked owner follow-up cannot approve or supersede the independent review. */
(()=>{'use strict';
const dispositions=Object.freeze(['hold_open','retest_evidence_ready','closure_review_acknowledged','closure_challenged']);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const node=(tag,t)=>{const e=document.createElement(tag);if(t!==undefined)e.textContent=t;return e;};
function requestId(){const c=globalThis.crypto;if(c?.randomUUID)return c.randomUUID();if(!c?.getRandomValues)throw Error('Secure randomness unavailable');
 const b=c.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const s=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');}
function inspect(data,{companyId,userId,now=Date.now()}={}){
 const ts=Date.parse(data?.captured_at),source=data?.independent_snapshot;
 const verified=window.YWI457?.inspect?.(source,{companyId,userId,now});
 if(!uuid(companyId)||!uuid(userId)||!Number.isFinite(ts)||ts>now+60000||now-ts>300000||
  data?.company_id!==companyId||data.owner_guard!=='ywi_422_assert_owner'||
  verified?.state!=='source_verified'||verified?.isOwner!==true||
  !['field_accepted','service_authorized','independent_reapproval','release_green',
   'outbound_actions','synthetic','mutation_authorized'].every(k=>data[k]===false)||
  !Array.isArray(data.decision_aging)||!Array.isArray(data.followups)||
  !Number.isSafeInteger(data.followup_total)||data.followup_total<0||
  typeof data.followup_sample_capped!=='boolean')
  return {state:'withheld',reason:'Owner follow-up source missing, unauthorized or falsely approving'};
 if(data.followup_sample_capped!==(data.followup_total>60)||data.followup_sample_capped||
  data.followups.length>60||data.followup_total<data.followups.length||
  data.decision_aging.length!==verified.decisions.length)
  return {state:'withheld',reason:'Source decision/follow-up samples are incomplete'};
 const ages=new Set();for(const a of data.decision_aging){const d=verified.decisions.find(d=>d.id===a.id);
  if(!uuid(a.id)||ages.has(a.id)||!d||a.company_id!==companyId||
   a.handoff_id!==d.handoff_id||a.decision!==d.decision||
   Date.parse(a.created_at)!==Date.parse(d.created_at)||
   !Number.isSafeInteger(a.age_days)||a.age_days<0||
   typeof a.older_than_seven_days!=='boolean'||a.older_than_seven_days!==(a.age_days>=7)||
   !Number.isSafeInteger(a.followup_count)||a.followup_count<0||
   Math.abs(a.age_days-Math.floor((now-Date.parse(d.created_at))/86400000))>1)
   return {state:'withheld',reason:'Aging or independent decision provenance mismatch'};
  ages.add(a.id);}
 const seen=new Set();for(const row of data.followups){const d=verified.decisions.find(d=>d.id===row.independent_decision_id);
  if(!uuid(row.id)||seen.has(row.id)||row.company_id!==companyId||!d||
   !dispositions.includes(row.disposition)||!Number.isFinite(Date.parse(row.created_at))||
   Date.parse(row.created_at)<Date.parse(d.created_at)||
   (['retest_evidence_ready','closure_review_acknowledged'].includes(row.disposition)!==uuid(row.followup_evidence_id))||
   (row.disposition==='retest_evidence_ready'&&d.decision!=='returned_for_follow_up')||
   (['closure_review_acknowledged','closure_challenged'].includes(row.disposition)&&d.decision!=='exception_verified_closed')||
   (row.disposition==='closure_review_acknowledged'&&row.followup_evidence_id!==d.resolution_evidence_id)||
   (row.followup_evidence_id&&!verified.evidence.some(e=>e.id===row.followup_evidence_id)))
   return {state:'withheld',reason:'Foreign, unsupported or replayed follow-up record'};
  seen.add(row.id);}
 for(const a of data.decision_aging){const visible=data.followups.filter(x=>x.independent_decision_id===a.id).length;
  if(a.followup_count<visible)return {state:'withheld',reason:'Follow-up counts disagree with visible journal'};}
 return {state:'source_verified',companyId,userId,decisions:verified.decisions,handoffs:verified.handoffs,
  services:verified.services,evidence:verified.evidence,aging:data.decision_aging,followups:data.followups,
  total:data.followup_total,fieldAccepted:false,serviceAuthorized:false,releaseGreen:false};
}
window.YWI458=Object.freeze({inspect,dispositions});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('owner458'))return;
 const panel=node('details');panel.id='owner458';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='PMS · Owner Independent Follow-Up';panel.dataset.adminHubGroups='management operations';
 panel.append(node('summary','458 · Independent Review Follow-Up & Owner Reassessment'));
 const body=node('div');body.className='admin-panel-block pms458';
 body.append(node('p','Reconcile the original 457 independent reviewer decision with real 455 follow-up observations. Review age and make an append-only owner reassessment. An acknowledged review-exception closure is not an independent reapproval, field acceptance, Safety release or work authorization.'));
 const help=node('a','ⓘ Owner follow-up aging and closure reassessment Help');help.href='/help.html#pms-independent-owner-followup-458';body.append(help);
 const controls=node('div');controls.className='pms458-controls';const ownerLabel=node('label','Verified owner company');const company=node('select');company.id='pms458Company';ownerLabel.append(company);
 const refresh=node('button','Recheck independent decisions and follow-up evidence');refresh.id='pms458Refresh';refresh.type='button';refresh.className='secondary';controls.append(ownerLabel,refresh);body.append(controls);
 const status=node('p','HOLD: sign in as the real owner and recheck reviewer sources.');status.id='pms458Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const summary=node('section');summary.id='pms458Summary';summary.setAttribute('aria-label','Independent reviewer decisions and aging');body.append(summary);
 const history=node('section');history.id='pms458History';history.setAttribute('aria-label','Immutable owner follow-up history');body.append(history);
 const form=node('fieldset');form.id='pms458Form';form.disabled=true;form.append(node('legend','Append owner reassessment (not a service approval)'));
 const field=(id,label,tag,max)=>{const l=node('label',label),e=node(tag);e.id=id;if(max)e.maxLength=max;l.append(e);form.append(l);return e;};
 const decision=field('pms458Decision','Actual independent reviewer decision','select');
 const outcome=field('pms458Outcome','Owner review-only follow-up disposition','select');for(const v of dispositions){const opt=node('option',v.replaceAll('_',' '));opt.value=v;outcome.append(opt);}
 const evidence=field('pms458Evidence','Observed 455 field evidence for retest / closure acknowledgement','select');
 const source=field('pms458Reference','Private source reference (4–250 characters)','input',250);
 const notes=field('pms458Notes','Owner reassessment notes (optional; 500 characters)','textarea',500);
 const submit=node('button','Append owner follow-up and reassessment');submit.id='pms458Append';submit.type='button';submit.className='secondary';form.append(submit);
 form.append(node('p','Retest evidence must follow a returned-for-follow-up reviewer decision and be observed after that decision. Closure acknowledgement can cite only the exact independently recorded closure evidence. All statuses remain advisory; OFF services or missing active site evidence WITHHOLD stronger claims.'));
 body.append(form);
 const release=node('p','REAL FIELD/SAFETY ACCEPTANCE: HOLD. Owner closure reassessment does not override independent review, customer consent, regulatory requirements or exact-main deployment checks.');release.className='notice';release.id='pms458Release';body.append(release);panel.append(body);host.append(panel);
 let epoch=0,busy=false,verified=null,ownerUid=null,owned=[];
 const info=x=>{status.textContent=x;};
 function invalidate(message){epoch++;verified=null;ownerUid=null;owned=[];company.replaceChildren();
  form.disabled=true;summary.replaceChildren();history.replaceChildren();info(message);}
 function opts(el,placeholder,rows,label,value){el.replaceChildren();const blank=node('option',placeholder);blank.value='';el.append(blank);
  for(const r of rows){const op=node('option',label(r));op.value=value(r);el.append(op);}}
 async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.auth?.getUser||!sb?.rpc||
   !window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Owner sign-in and Jobs view required');
  const auth=await sb.auth.getUser();if(auth.error||auth.data?.user?.id!==a.user.id)throw Error('Authenticated user changed');
  return {sb,uid:a.user.id};}
 const alive=(ctx,version,id)=>epoch===version&&company.value===id&&
  window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&window.YWI_AUTH.getState().user?.id===ctx.uid;
 function show(data){verified=data;summary.replaceChildren();history.replaceChildren();form.disabled=data.state!=='source_verified'||!data.decisions?.length;
  if(data.state!=='source_verified'){info('WITHHELD: '+data.reason);return;}
  const old=data.aging.filter(x=>x.older_than_seven_days).length;
  info('SOURCE VERIFIED: '+data.decisions.length+' actual independent decisions; '+data.total+' owner follow-up records. Review-only field acceptance HOLD.');
  for(const line of ['Independent decision records: '+data.decisions.length,
   'Older than seven days (attention only): '+old,
   'Append-only owner reassessments: '+data.total,
   'Seven service modules: '+data.services.filter(s=>s.enabled).length+' ON / '+data.services.filter(s=>!s.enabled).length+' OFF'])summary.append(node('p',line));
  for(const a of data.aging){const card=node('article');card.className='pms458-entry';
   card.append(node('strong',a.decision.replaceAll('_',' ')+' · '+a.age_days+' days since review'),
    node('p',a.older_than_seven_days?'Attention: over seven days':'Aging monitored; no automatic escalation'),
    node('p',a.followup_count+' recorded owner follow-ups'));summary.append(card);}
  history.append(node('h3','Owner reassessment journal'));
  for(const r of data.followups){const el=node('article');el.className='pms458-entry';el.append(node('strong',r.disposition.replaceAll('_',' ')),node('p',r.source_reference+' · '+r.created_at));
   if(r.notes)el.append(node('p',r.notes));history.append(el);}
  if(!data.followups.length)history.append(node('p','No owner follow-up. The independent review remains its original recorded status.'));
  opts(decision,'Choose an original 457 decision',data.decisions,d=>d.decision.replaceAll('_',' ')+' · '+d.created_at,d=>d.id);
  opts(evidence,'No evidence — hold/challenge only',data.evidence,e=>e.source_reference+' · '+e.created_at,e=>e.id);
 }
 async function reconcile(){const start=epoch,ctx=await session();
  const roster=await ctx.sb.rpc('ywi_rpc_reviewer_inbox_457');if(epoch!==start||roster.error)throw Error('457 owner/reviewer inbox denied');
  const verifiedInbox=window.YWI457?.inspectInbox?.(roster.data,{userId:ctx.uid});if(verifiedInbox?.state!=='source_verified')throw Error('Incomplete original owner inbox');
  owned=verifiedInbox.companies.filter(c=>c.is_owner);ownerUid=ctx.uid;
  const previous=company.value;opts(company,'Select real owned company',owned,c=>c.name,c=>c.id);
  if(owned.some(c=>c.id===previous))company.value=previous;else if(owned.length===1)company.value=owned[0].id;
  if(!owned.length){info('HOLD: no actual owner company. No Yard Rosevear fixture is seeded in Production.');return;}
  const id=company.value;if(!owned.some(c=>c.id===id)){info('HOLD: choose a verified owner company and recheck');return;}
  const first=await ctx.sb.rpc('ywi_rpc_first_service_independent_457',{p_company_id:id});
  if(!alive(ctx,start,id)||first.error||!first.data)throw Error('Original independent decisions denied');
  const owner=await ctx.sb.rpc('ywi_rpc_owner_independent_followup_458',{p_company_id:id});
  if(!alive(ctx,start,id)||owner.error||!owner.data)throw Error('458 owner follow-up evidence denied');
  const second=await ctx.sb.rpc('ywi_rpc_first_service_independent_457',{p_company_id:id});
  if(!alive(ctx,start,id)||second.error||
   JSON.stringify(first.data.services)!==JSON.stringify(second.data?.services)||
   JSON.stringify(second.data.decisions)!==JSON.stringify(owner.data.independent_snapshot?.decisions)||
   JSON.stringify(second.data.handoffs)!==JSON.stringify(owner.data.independent_snapshot?.handoffs))
   throw Error('Reviewer evidence or service toggles changed during reassessment');
  const examined=inspect(owner.data,{companyId:id,userId:ctx.uid});
  if(!alive(ctx,start,id))throw Error('Identity changed before follow-up display');show(examined);
 }
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=true;verified=null;form.disabled=true;
  info('Verifying real owner, 457 reviewer decision, 455 evidence and aging…');
  try{await reconcile();}catch(e){show({state:'withheld',reason:e?.message||String(e)});}finally{busy=false;refresh.disabled=company.disabled=false;}});
 submit.addEventListener('click',async()=>{if(busy||verified?.state!=='source_verified')return;
  const id=company.value,version=epoch,d=verified.decisions.find(x=>x.id===decision.value),
   v=verified.evidence.find(x=>x.id===evidence.value),disposition=outcome.value,
   ref=source.value.trim(),memo=notes.value.trim();
  if(!d||!dispositions.includes(disposition)||ref.length<4||ref.length>250||memo.length>500)
   return info('WITHHELD: choose an actual independent decision and a valid reference');
  if(disposition==='retest_evidence_ready'&&(d.decision!=='returned_for_follow_up'||!v||
    Date.parse(v.created_at)<=Date.parse(d.created_at)))
   return info('WITHHELD: retest requires a returned case and a newer observed field report');
  if(disposition==='closure_review_acknowledged'&&(d.decision!=='exception_verified_closed'||
    !v||v.id!==d.resolution_evidence_id))
   return info('WITHHELD: acknowledgement requires the exact independent closure evidence');
  if(disposition==='closure_challenged'&&d.decision!=='exception_verified_closed')
   return info('WITHHELD: only independently verified closure can be challenged');
  if(!window.confirm('Append '+disposition.replaceAll('_',' ')+' as an OWNER REVIEW ONLY? No independent reapproval or field authority follows.'))return;
  busy=true;submit.disabled=refresh.disabled=true;
  try{const ctx=await session();if(ctx.uid!==ownerUid||!alive(ctx,version,id))throw Error('Owner or company changed');
   const fresh=await ctx.sb.rpc('ywi_rpc_first_service_independent_457',{p_company_id:id});
   if(!alive(ctx,version,id)||fresh.error||
    JSON.stringify(fresh.data?.services)!==JSON.stringify(verified.services)||
    !fresh.data?.decisions?.some(x=>x.id===d.id&&x.decision===d.decision))
    throw Error('Source changed; no owner reassessment saved');
   const result=await ctx.sb.rpc('ywi_rpc_append_owner_independent_followup_458',{
    p_company_id:id,p_request_id:requestId(),p_independent_decision_id:d.id,
    p_disposition:disposition,p_followup_evidence_id:disposition==='retest_evidence_ready'||disposition==='closure_review_acknowledged'?v.id:null,
    p_source_reference:ref,p_notes:memo||null});
   if(!alive(ctx,version,id)||result.error||result.data?.company_id!==id||result.data?.recorded!==true||
    result.data?.field_accepted!==false||result.data?.service_authorized!==false||
    result.data?.independent_reapproval!==false||result.data?.outbound_actions!==false||!uuid(result.data?.id))
    throw Error('Unverifiable owner journal receipt; inspect before any retry');
   source.value='';notes.value='';info('Append-only reassessment recorded; rechecking original sources…');await reconcile();
  }catch(e){verified=null;form.disabled=true;info('WITHHELD: '+(e?.message||e)+'. Review the journal before manual retry; no automatic replay.');}
  finally{busy=false;submit.disabled=refresh.disabled=false;}});
 company.addEventListener('change',()=>{epoch++;verified=null;form.disabled=true;summary.replaceChildren();history.replaceChildren();info('HOLD: company changed; recheck source evidence.');});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])
  document.addEventListener(event,()=>invalidate('HOLD: owner identity, permission or service switch changed; recheck before reassessment.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

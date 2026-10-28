/* YW 476: owner evidence aging and original separate reviewer documentary follow-up. HOLD. */
(()=>{'use strict';
const dispositions=Object.freeze(['record_documentary_recheck','request_owner_source_refresh','retain_independent_hold']);
const actionable=Object.freeze(['submit_renewed_documentary_source','request_independent_continuity_recheck']);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const validRef=x=>typeof x==='string'&&x.trim().length>=4&&x.trim().length<=250;
const stamp=x=>Date.parse(x);
const ordered=(a,b)=>Number.isFinite(stamp(a))&&Number.isFinite(stamp(b))&&stamp(a)<=stamp(b);
const el=(tag,content)=>{const n=document.createElement(tag);if(content!==undefined)n.textContent=content;return n;};
function operationId(){if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
 if(!globalThis.crypto?.getRandomValues)throw Error('Secure operation ID unavailable');
 const b=globalThis.crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const h=Array.from(b,v=>v.toString(16).padStart(2,'0')).join('');
 return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');}
function ancestry(d,p){const t=d.continuityReviews.find(t=>t.id===p.continuity_review_id),
 w=t&&d.ownerClarifications.find(w=>w.id===t.owner_clarification_id),
 q=w&&d.assignmentReviews.find(q=>q.id===w.assignment_review_id),
 v=q&&d.ownerRenewals.find(v=>v.id===q.owner_renewal_id),
 k=v&&d.confirmations.find(k=>k.id===v.confirmation_id),
 a=k&&d.reassessments.find(a=>a.id===k.reassessment_id),
 r=a&&d.renewals.find(r=>r.id===a.renewal_id),
 f=r&&d.followups.find(f=>f.id===r.followup_id),
 o=f&&d.outcomes.find(o=>o.id===f.outcome_id),
 c=o&&d.comparisons.find(c=>c.id===o.comparison_id),
 h=c&&d.handoffs.find(h=>h.id===c.handoff_id),
 original=h&&d.cases.find(z=>z.proposal_id===h.proposal_id);
 return {t,w,q,v,k,a,r,f,o,c,h,original};}
function priorSources(p,s){return [p.source_reference,s.t?.source_reference,s.w?.source_reference,
 s.q?.source_reference,s.v?.source_reference,s.k?.source_reference,s.a?.source_reference,
 s.r?.source_reference,s.f?.source_reference,s.o?.source_reference,s.c?.compared_source_reference,s.h?.source_reference];}
function validLineage(d,p,s){return s.t&&s.w&&s.q&&s.v&&s.k&&s.a&&s.r&&s.f&&s.o&&s.c&&s.h&&s.original&&
 actionable.includes(p.decision)&&s.t.disposition==='request_refreshed_owner_evidence'&&
 s.q.disposition==='request_owner_source_clarification'&&s.v.decision==='request_independent_recheck'&&
 p.owner_user_id===s.w.owner_user_id&&p.owner_user_id===s.v.owner_user_id&&p.owner_user_id===s.a.owner_user_id&&
 s.t.reviewer_user_id===s.q.reviewer_user_id&&s.t.reviewer_user_id===s.k.reviewer_user_id&&
 s.t.reviewer_user_id===s.r.reviewer_user_id&&s.t.reviewer_user_id===s.h.reviewer_user_id&&
 s.t.reviewer_user_id!==p.owner_user_id&&s.original.owner_user_id===p.owner_user_id&&
 s.original.proposed_reviewer_user_id===s.t.reviewer_user_id&&s.original.service_enabled===true;}
function inspect(x,{companyId,userId}={}){
 const base=window.YWI475?.inspect?.(x,{companyId,userId});
 if(base?.state!=='source_verified')return {state:'withheld',reason:base?.reason||'475 owner renewal source withheld'};
 const requests=base.ownerRenewalRequests,now=stamp(x.reviewer_renewal_as_of);
 if(!Number.isFinite(now)||now!==stamp(x.captured_at)||!Array.isArray(x.owner_renewal_evidence_aging)||
  x.owner_renewal_evidence_age_total!==requests.length||x.owner_renewal_evidence_aging.length!==requests.length||
  !Array.isArray(x.reviewer_followup_receipts)||x.reviewer_followup_receipt_sample_capped!==false||
  !Number.isSafeInteger(x.reviewer_followup_receipt_total)||x.reviewer_followup_receipt_total!==x.reviewer_followup_receipts.length||
  x.reviewer_followup_receipts.length>60||
  !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions','mutation_authorized','synthetic'].every(k=>x[k]===false))
  return {state:'withheld',reason:'476 owner renewal age, receipt count or HOLD authority unverified'};
 const seenAge=new Set();
 for(const row of x.owner_renewal_evidence_aging){const p=requests.find(p=>p.id===row.owner_request_id),
  days=p&&Math.max(0,Math.floor((now-stamp(p.created_at))/86400000));
  if(!p||seenAge.has(p.id)||row.continuity_review_id!==p.continuity_review_id||
   !Number.isSafeInteger(row.age_days)||row.age_days!==days||
   row.band!==(days>=15?'overdue':days>=8?'aging':'current'))
   return {state:'withheld',reason:'476 original owner evidence aging mismatch'};
  seenAge.add(p.id);}
 const seenReceipts=new Set();
 for(const r of x.reviewer_followup_receipts){const p=requests.find(p=>p.id===r.owner_request_id),s=p&&ancestry(base,p);
  if(!uuid(r.id)||!p||!validLineage(base,p,s)||seenReceipts.has(p.id)||r.company_id!==companyId||
   r.reviewer_user_id!==s.t.reviewer_user_id||r.reviewer_user_id===p.owner_user_id||
   !dispositions.includes(r.disposition)||!validRef(r.source_reference)||
   priorSources(p,s).includes(r.source_reference)||!ordered(p.created_at,r.created_at)||
   !ordered(r.created_at,x.captured_at))
   return {state:'withheld',reason:'476 independent signer, source provenance or chronology unverified'};
  seenReceipts.add(p.id);}
 return {...base,state:'source_verified',ownerRenewalEvidenceAging:x.owner_renewal_evidence_aging,
  reviewerFollowupReceipts:x.reviewer_followup_receipts,releaseGreen:false};
}
window.YWI476=Object.freeze({inspect,dispositions});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('reviewer476'))return;
 const card=el('details');card.id='reviewer476';card.className='admin-hub-detail';
 card.dataset.adminHubTitle='PMS · Owner Renewal & Independent Reviewer Receipt';card.dataset.adminHubGroups='management operations';
 card.append(el('summary','476 · Owner Renewal Evidence Aging & Independent Reviewer Follow-Up'));
 const body=el('div');body.className='admin-panel-block pms476';
 body.append(el('p','Age actual 475 owner documentary renewals. Only the original separate reviewer may record one internal follow-up receipt for refreshed source or an owner-requested recheck; no work approval or escalation is automated.'));
 const help=el('a','ⓘ Owner renewal age and independent reviewer receipt Help');help.href='/help.html#pms-owner-renewal-reviewer-followup-476';body.append(help);
 const controls=el('div');controls.className='pms476-controls';
 const label=el('label','Verified company owner or original separate reviewer'),company=el('select'),refresh=el('button','Verify owner renewal sources and reviewer assignment');
 company.id='pms476Company';refresh.id='pms476Refresh';refresh.type='button';refresh.className='secondary';
 label.append(company);controls.append(label,refresh);body.append(controls);
 const status=el('p','HOLD: verify real owner renewal evidence and original reviewer.');status.id='pms476Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const journal=el('section');journal.id='pms476Journal';body.append(journal);
 const form=el('fieldset');form.id='pms476ReviewerForm';form.disabled=true;form.append(el('legend','Original independent reviewer · immutable documentary follow-up'));
 const field=(id,description,tag,max)=>{const l=el('label',description),n=el(tag);n.id=id;if(max)n.maxLength=max;l.append(n);form.append(l);return n;};
 const request=field('pms476Request','Genuine owner renewal requiring independent follow-up','select');
 const decision=field('pms476Disposition','Independent reviewer documentary outcome','select');
 for(const d of dispositions){const option=el('option',d.replaceAll('_',' '));option.value=d;decision.append(option);}
 const source=field('pms476Source','Fresh independent reviewer documentary reference','input',250);
 const notes=field('pms476Notes','Independent reviewer note (optional)','textarea',500);
 const record=el('button','Record independent reviewer follow-up');record.id='pms476Record';record.type='button';record.className='secondary';form.append(record);body.append(form);
 const hold=el('p','HOLD: A reviewer documentary receipt is not independent reapproval, Jobs/Safety acceptance, real work release, owner authority, payroll access, dispatch, customer communication or cross-business gateway activation.');
 hold.id='pms476Hold';hold.className='notice';body.append(hold);card.append(body);host.append(card);
 let epoch=0,busy=false,verified=null,principal=null;
 const choices=(node,placeholder,items,label,id)=>{node.replaceChildren();const empty=el('option',placeholder);empty.value='';node.append(empty);for(const item of items){const option=el('option',label(item));option.value=id(item);node.append(option);}};
 function invalidate(message){epoch++;verified=principal=null;company.replaceChildren();journal.replaceChildren();form.disabled=true;status.textContent=message;}
 function display(d){verified=d;journal.replaceChildren();form.disabled=true;if(d.state!=='source_verified'){status.textContent='WITHHELD: '+d.reason;return;}
  const overdue=d.ownerRenewalEvidenceAging.filter(a=>a.band==='overdue').length;
  status.textContent='SOURCE VERIFIED: '+d.ownerRenewalRequests.length+' owner renewal receipts · '+overdue+' overdue (15+ days) · '+d.reviewerFollowupReceipts.length+' independent reviewer follow-ups. Operational HOLD.';
  for(const p of d.ownerRenewalRequests){const a=d.ownerRenewalEvidenceAging.find(a=>a.owner_request_id===p.id),
   r=d.reviewerFollowupReceipts.find(r=>r.owner_request_id===p.id),entry=el('article');entry.className='pms476-entry';
   entry.append(el('strong',a.band.toUpperCase()+' · '+a.age_days+' full day(s) since verified owner renewal'),
    el('p','Owner documentary renewal: '+p.decision.replaceAll('_',' ')),el('p','Owner source: '+p.source_reference),
    el('p',r?'Independent reviewer follow-up: '+r.disposition.replaceAll('_',' ')+' · '+r.source_reference:
     actionable.includes(p.decision)?'Independent documentary follow-up pending; HOLD remains':'No independent review requested; HOLD remains'));
   journal.append(entry);}
  if(!d.ownerRenewalRequests.length)journal.append(el('p','No genuine 475 owner renewal receipts. Reviewer follow-up cannot be fabricated.'));
  const pending=d.isReviewer?d.ownerRenewalRequests.filter(p=>{const s=ancestry(d,p);return actionable.includes(p.decision)&&
   validLineage(d,p,s)&&s.t.reviewer_user_id===d.userId&&
   !d.reviewerFollowupReceipts.some(r=>r.owner_request_id===p.id);}):[];
  choices(request,'Choose genuine owner renewal evidence',pending,p=>p.source_reference+' · '+d.ownerRenewalEvidenceAging.find(a=>a.owner_request_id===p.id).age_days+' day(s)',p=>p.id);
  form.disabled=!pending.length;}
 async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.rpc||!sb.auth?.getUser||!window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Jobs sign-in required');
  const who=await sb.auth.getUser();if(who.error||who.data?.user?.id!==a.user.id)throw Error('Signed-in user changed');return {uid:a.user.id,sb};}
 async function reconcile(){const ticket=epoch,ctx=await session(),inbox=await ctx.sb.rpc('ywi_rpc_handoff_inbox_465');
  if(ticket!==epoch||inbox.error||window.YWI465?.inspectInbox?.(inbox.data,{userId:ctx.uid})?.state!=='source_verified')throw Error('Verified company inbox withheld');
  const selected=company.value;choices(company,'Choose verified company',inbox.data.companies,c=>c.name,c=>c.id);
  if(inbox.data.companies.some(c=>c.id===selected))company.value=selected;else if(inbox.data.companies.length===1)company.value=inbox.data.companies[0].id;
  const id=company.value;if(!id){verified=null;status.textContent='HOLD: select verified company';return;}
  principal=ctx.uid;const first=await ctx.sb.rpc('ywi_rpc_reviewer_renewal_workspace_476',{p_company_id:id}),
   second=await ctx.sb.rpc('ywi_rpc_reviewer_renewal_workspace_476',{p_company_id:id});
  if(ticket!==epoch||first.error||second.error||!first.data||!second.data||company.value!==id||
   window.YWI_AUTH?.getState?.()?.user?.id!==ctx.uid||
   ['handoff_source','original_baselines','comparisons','outcomes','followups','renewals','reassessments','confirmations','aging','renewal_aging','reassessment_aging','exception_aging','owner_renewals','recheck_aging','assignment_reviews','outcome_aging','owner_clarifications','clarification_aging','continuity_reviews','continuity_finding_aging','owner_renewal_requests','owner_renewal_evidence_aging','reviewer_followup_receipts'].some(k=>JSON.stringify(first.data[k])!==JSON.stringify(second.data[k])))
   throw Error('Independent follow-up source changed, denied or truncated');
  display(inspect(second.data,{companyId:id,userId:ctx.uid}));}
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=form.disabled=true;
  try{await reconcile();}catch(e){display({state:'withheld',reason:e.message||String(e)});}finally{busy=false;refresh.disabled=company.disabled=false;}});
 record.addEventListener('click',async()=>{const d=verified,id=company.value,p=d?.ownerRenewalRequests.find(p=>p.id===request.value),s=p&&ancestry(d,p),
  value=source.value.trim(),note=notes.value.trim();
  if(busy||d?.state!=='source_verified'||!d.isReviewer||!p||!actionable.includes(p.decision)||
   !validLineage(d,p,s)||s.t.reviewer_user_id!==d.userId||
   d.reviewerFollowupReceipts.some(r=>r.owner_request_id===p.id)||!dispositions.includes(decision.value)||
   !validRef(value)||note.length>500||priorSources(p,s).includes(value))
   return status.textContent='WITHHELD: original independent reviewer, genuine owner request and fresh evidence required';
  if(!window.confirm('Record INTERNAL independent documentary review only? No real service, Jobs/Safety or integration release is permitted.'))return;
  busy=true;refresh.disabled=form.disabled=true;
  try{const ctx=await session();if(ctx.uid!==principal||company.value!==id)throw Error('Reviewer identity or company changed');
   const receipt=await ctx.sb.rpc('ywi_rpc_reviewer_renewal_receipt_476',{p_company_id:id,p_operation_id:operationId(),
    p_owner_request_id:p.id,p_disposition:decision.value,p_source_reference:value,p_notes:note||null});
   if(receipt.error||!uuid(receipt.data?.id)||receipt.data.company_id!==id||receipt.data.recorded!==true||
    !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions'].every(k=>receipt.data[k]===false))
    throw Error('Unverified independent reviewer receipt');
   await reconcile();source.value=notes.value='';
  }catch(e){verified=null;status.textContent='WITHHELD: '+(e.message||e)+'. Recheck owner source before retry.';}
  finally{busy=false;refresh.disabled=false;form.disabled=verified?.state!=='source_verified'||!verified.isReviewer||
   !verified.ownerRenewalRequests.some(p=>actionable.includes(p.decision)&&!verified.reviewerFollowupReceipts.some(r=>r.owner_request_id===p.id));}});
 company.addEventListener('change',()=>{epoch++;verified=null;form.disabled=true;journal.replaceChildren();status.textContent='HOLD: company changed. Verify again.';});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])
  document.addEventListener(event,()=>invalidate('HOLD: independent reviewer, Jobs permission or company service changed. Verify again.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

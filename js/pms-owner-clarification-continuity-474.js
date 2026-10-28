/* YW 474: age actual 473 owner clarifications; separate original reviewer documentary continuity only. */
(()=>{'use strict';
const dispositions=Object.freeze(['document_continuity_recheck','request_refreshed_owner_evidence','retain_independent_hold']);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const validRef=x=>typeof x==='string'&&x.trim().length>=4&&x.trim().length<=250;
const stamp=x=>Date.parse(x);
const ordered=(a,b)=>Number.isFinite(stamp(a))&&Number.isFinite(stamp(b))&&stamp(a)<=stamp(b);
const el=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;return n;};
function operationId(){if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
 if(!globalThis.crypto?.getRandomValues)throw Error('Secure operation ID unavailable');
 const b=globalThis.crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const h=Array.from(b,v=>v.toString(16).padStart(2,'0')).join('');
 return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');}
function ancestry(d,p){const q=d.assignmentReviews.find(q=>q.id===p.assignment_review_id),
 v=q&&d.ownerRenewals.find(v=>v.id===q.owner_renewal_id),
 k=v&&d.confirmations.find(k=>k.id===v.confirmation_id),
 a=k&&d.reassessments.find(a=>a.id===k.reassessment_id),
 r=a&&d.renewals.find(r=>r.id===a.renewal_id),
 f=r&&d.followups.find(f=>f.id===r.followup_id),
 o=f&&d.outcomes.find(o=>o.id===f.outcome_id),
 c=o&&d.comparisons.find(c=>c.id===o.comparison_id),
 h=c&&d.handoffs.find(h=>h.id===c.handoff_id),
 original=h&&d.cases.find(x=>x.proposal_id===h.proposal_id);
 return {q,v,k,a,r,f,o,c,h,original};}
function priorSources(p,s){return [p.source_reference,s.q?.source_reference,s.v?.source_reference,
 s.k?.source_reference,s.a?.source_reference,s.r?.source_reference,s.f?.source_reference,
 s.o?.source_reference,s.c?.compared_source_reference,s.h?.source_reference];}
function inspect(x,{companyId,userId}={}){
 const base=window.YWI473?.inspect?.(x,{companyId,userId});
 if(base?.state!=='source_verified')return {state:'withheld',reason:base?.reason||'473 owner clarification source withheld'};
 const clarifications=base.ownerClarifications,now=stamp(x.continuity_review_as_of);
 if(!Number.isFinite(now)||now!==stamp(x.captured_at)||!Array.isArray(x.clarification_aging)||
  x.clarification_age_total!==clarifications.length||x.clarification_aging.length!==clarifications.length||
  !Array.isArray(x.continuity_reviews)||x.continuity_review_sample_capped!==false||
  !Number.isSafeInteger(x.continuity_review_total)||x.continuity_review_total!==x.continuity_reviews.length||
  x.continuity_reviews.length>60||
  !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions','mutation_authorized','synthetic'].every(k=>x[k]===false))
  return {state:'withheld',reason:'474 owner clarification ages, counts or authority withheld'};
 const seenAge=new Set();
 for(const row of x.clarification_aging){const p=clarifications.find(p=>p.id===row.owner_clarification_id),
  days=p&&Math.max(0,Math.floor((now-stamp(p.created_at))/86400000));
  if(!p||seenAge.has(p.id)||row.assignment_review_id!==p.assignment_review_id||
   !Number.isSafeInteger(row.age_days)||row.age_days!==days||
   row.band!==(days>=15?'overdue':days>=8?'aging':'current'))
   return {state:'withheld',reason:'474 owner clarification aging mismatched'};
  seenAge.add(p.id);}
 const seenReview=new Set();
 for(const r of x.continuity_reviews){const p=clarifications.find(p=>p.id===r.owner_clarification_id),s=p&&ancestry(base,p);
  if(!uuid(r.id)||!p||!s?.q||!s.v||!s.k||!s.a||!s.r||!s.f||!s.o||!s.c||!s.h||!s.original||
   seenReview.has(p.id)||r.company_id!==companyId||
   s.q.disposition!=='request_owner_source_clarification'||s.v.decision!=='request_independent_recheck'||
   r.reviewer_user_id!==s.q.reviewer_user_id||r.reviewer_user_id!==s.k.reviewer_user_id||
   r.reviewer_user_id!==s.r.reviewer_user_id||r.reviewer_user_id!==s.h.reviewer_user_id||
   r.reviewer_user_id===p.owner_user_id||s.original.owner_user_id!==p.owner_user_id||
   s.original.proposed_reviewer_user_id!==r.reviewer_user_id||
   !dispositions.includes(r.disposition)||!validRef(r.source_reference)||
   priorSources(p,s).includes(r.source_reference)||!ordered(p.created_at,r.created_at)||
   !ordered(r.created_at,x.captured_at))
   return {state:'withheld',reason:'474 independent reviewer signer, provenance or chronology unverified'};
  seenReview.add(p.id);}
 return {...base,state:'source_verified',clarificationAging:x.clarification_aging,
  continuityReviews:x.continuity_reviews,releaseGreen:false};
}
window.YWI474=Object.freeze({inspect,dispositions});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('continuity474'))return;
 const card=el('details');card.id='continuity474';card.className='admin-hub-detail';
 card.dataset.adminHubTitle='PMS · Owner Clarification Continuity Review';card.dataset.adminHubGroups='management operations';
 card.append(el('summary','474 · Owner Clarification Aging & Independent Continuity Review'));
 const body=el('div');body.className='admin-panel-block pms474';
 body.append(el('p','Age real 473 company-owner clarifications and allow only the separately nominated original reviewer to record one independent documentary continuity finding. No review signs off field work.'));
 const help=el('a','ⓘ Owner clarification aging and independent reviewer Help');help.href='/help.html#pms-owner-clarification-continuity-474';body.append(help);
 const controls=el('div');controls.className='pms474-controls';
 const label=el('label','Verified company owner or independent reviewer'),company=el('select'),refresh=el('button','Verify owner clarifications and reviewer lineage');
 company.id='pms474Company';refresh.id='pms474Refresh';refresh.type='button';refresh.className='secondary';
 label.append(company);controls.append(label,refresh);body.append(controls);
 const status=el('p','HOLD: verify 473 owner clarifications and original reviewer.');status.id='pms474Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const journal=el('section');journal.id='pms474Journal';body.append(journal);
 const form=el('fieldset');form.id='pms474ReviewerForm';form.disabled=true;form.append(el('legend','Original separate reviewer · immutable documentary continuity receipt'));
 const field=(id,title,tag,max)=>{const l=el('label',title),n=el(tag);n.id=id;if(max)n.maxLength=max;l.append(n);form.append(l);return n;};
 const clarification=field('pms474Clarification','Verified owner clarification to review','select');
 const decision=field('pms474Disposition','Independent documentary continuity finding','select');
 for(const d of dispositions){const option=el('option',d.replaceAll('_',' '));option.value=d;decision.append(option);}
 const source=field('pms474Source','Fresh independent reviewer source reference','input',250);
 const notes=field('pms474Notes','Independent reviewer note (optional)','textarea',500);
 const record=el('button','Record independent continuity receipt');record.id='pms474Record';record.type='button';record.className='secondary';form.append(record);body.append(form);
 const hold=el('p','HOLD: An independent documentary continuity receipt cannot approve Jobs/Safety work, release service, reassign reviewers, accept field results, send messages, transfer company data or initiate other systems.');
 hold.id='pms474Hold';hold.className='notice';body.append(hold);card.append(body);host.append(card);
 let epoch=0,busy=false,verified=null,principal=null;
 const choices=(node,placeholder,items,label,id)=>{node.replaceChildren();const empty=el('option',placeholder);empty.value='';node.append(empty);for(const item of items){const option=el('option',label(item));option.value=id(item);node.append(option);}};
 function invalidate(message){epoch++;verified=principal=null;company.replaceChildren();journal.replaceChildren();form.disabled=true;status.textContent=message;}
 function display(d){verified=d;journal.replaceChildren();form.disabled=true;if(d.state!=='source_verified'){status.textContent='WITHHELD: '+d.reason;return;}
  const overdue=d.clarificationAging.filter(a=>a.band==='overdue').length;
  status.textContent='SOURCE VERIFIED: '+d.ownerClarifications.length+' owner clarifications · '+overdue+' overdue (15+ days) · '+d.continuityReviews.length+' independent continuity receipts. Operational HOLD.';
  for(const p of d.ownerClarifications){const a=d.clarificationAging.find(a=>a.owner_clarification_id===p.id),
   r=d.continuityReviews.find(r=>r.owner_clarification_id===p.id),entry=el('article');entry.className='pms474-entry';
   entry.append(el('strong',a.band.toUpperCase()+' · '+a.age_days+' full day(s) since company-owner clarification'),
    el('p','Owner clarification: '+p.decision.replaceAll('_',' ')),el('p','Owner evidence: '+p.source_reference),
    el('p',r?'Independent reviewer continuity: '+r.disposition.replaceAll('_',' ')+' · '+r.source_reference:
     'Independent reviewer continuity evidence pending; HOLD remains'));
   journal.append(entry);}
  if(!d.ownerClarifications.length)journal.append(el('p','No verified 473 owner clarifications. An independent continuity review cannot be synthesized.'));
  const pending=d.isReviewer?d.ownerClarifications.filter(p=>{const s=ancestry(d,p);return s.q&&s.v&&s.k&&s.r&&s.h&&
   s.q.reviewer_user_id===d.userId&&s.k.reviewer_user_id===d.userId&&s.r.reviewer_user_id===d.userId&&
   s.h.reviewer_user_id===d.userId&&p.owner_user_id!==d.userId&&s.original?.service_enabled===true&&
   !d.continuityReviews.some(r=>r.owner_clarification_id===p.id);}):[];
  choices(clarification,'Choose genuine owner clarification for continuity review',pending,p=>p.source_reference+' · '+d.clarificationAging.find(a=>a.owner_clarification_id===p.id).age_days+' day(s)',p=>p.id);
  form.disabled=!pending.length;}
 async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.rpc||!sb.auth?.getUser||!window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Jobs sign-in required');
  const who=await sb.auth.getUser();if(who.error||who.data?.user?.id!==a.user.id)throw Error('Signed-in user changed');return {uid:a.user.id,sb};}
 async function reconcile(){const ticket=epoch,ctx=await session(),inbox=await ctx.sb.rpc('ywi_rpc_handoff_inbox_465');
  if(ticket!==epoch||inbox.error||window.YWI465?.inspectInbox?.(inbox.data,{userId:ctx.uid})?.state!=='source_verified')throw Error('Verified company inbox withheld');
  const selected=company.value;choices(company,'Choose verified company',inbox.data.companies,c=>c.name,c=>c.id);
  if(inbox.data.companies.some(c=>c.id===selected))company.value=selected;else if(inbox.data.companies.length===1)company.value=inbox.data.companies[0].id;
  const id=company.value;if(!id){verified=null;status.textContent='HOLD: select verified company';return;}
  principal=ctx.uid;const first=await ctx.sb.rpc('ywi_rpc_continuity_workspace_474',{p_company_id:id}),
   second=await ctx.sb.rpc('ywi_rpc_continuity_workspace_474',{p_company_id:id});
  if(ticket!==epoch||first.error||second.error||!first.data||!second.data||company.value!==id||
   window.YWI_AUTH?.getState?.()?.user?.id!==ctx.uid||
   ['handoff_source','original_baselines','comparisons','outcomes','followups','renewals','reassessments','confirmations','aging','renewal_aging','reassessment_aging','exception_aging','owner_renewals','recheck_aging','assignment_reviews','outcome_aging','owner_clarifications','clarification_aging','continuity_reviews'].some(k=>JSON.stringify(first.data[k])!==JSON.stringify(second.data[k])))
   throw Error('Independent continuity source changed, denied or truncated');
  display(inspect(second.data,{companyId:id,userId:ctx.uid}));}
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=form.disabled=true;
  try{await reconcile();}catch(e){display({state:'withheld',reason:e.message||String(e)});}finally{busy=false;refresh.disabled=company.disabled=false;}});
 record.addEventListener('click',async()=>{const d=verified,id=company.value,p=d?.ownerClarifications.find(p=>p.id===clarification.value),s=p&&ancestry(d,p),
  value=source.value.trim(),note=notes.value.trim();
  if(busy||d?.state!=='source_verified'||!d.isReviewer||!p||!s?.q||!s.v||!s.k||!s.a||!s.r||!s.f||!s.o||!s.c||!s.h||!s.original||
   s.q.disposition!=='request_owner_source_clarification'||s.v.decision!=='request_independent_recheck'||
   s.q.reviewer_user_id!==d.userId||s.k.reviewer_user_id!==d.userId||s.r.reviewer_user_id!==d.userId||
   s.h.reviewer_user_id!==d.userId||s.original.proposed_reviewer_user_id!==d.userId||s.original.service_enabled!==true||
   p.owner_user_id===d.userId||d.continuityReviews.some(r=>r.owner_clarification_id===p.id)||
   !dispositions.includes(decision.value)||!validRef(value)||note.length>500||priorSources(p,s).includes(value))
   return status.textContent='WITHHELD: original independent reviewer, genuine owner evidence and fresh source required';
  if(!window.confirm('Record INTERNAL independent continuity evidence only? No work release, job approval or external action is permitted.'))return;
  busy=true;refresh.disabled=form.disabled=true;
  try{const ctx=await session();if(ctx.uid!==principal||company.value!==id)throw Error('Reviewer identity or company changed');
   const receipt=await ctx.sb.rpc('ywi_rpc_continuity_review_474',{p_company_id:id,p_operation_id:operationId(),
    p_owner_clarification_id:p.id,p_disposition:decision.value,p_source_reference:value,p_notes:note||null});
   if(receipt.error||!uuid(receipt.data?.id)||receipt.data.company_id!==id||receipt.data.recorded!==true||
    !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions'].every(k=>receipt.data[k]===false))
    throw Error('Unverified independent continuity receipt');
   await reconcile();source.value=notes.value='';
  }catch(e){verified=null;status.textContent='WITHHELD: '+(e.message||e)+'. Reverify before retry.';}
  finally{busy=false;refresh.disabled=false;form.disabled=verified?.state!=='source_verified'||!verified.isReviewer||
   !verified.ownerClarifications.some(p=>!verified.continuityReviews.some(r=>r.owner_clarification_id===p.id));}});
 company.addEventListener('change',()=>{epoch++;verified=null;form.disabled=true;journal.replaceChildren();status.textContent='HOLD: company changed. Verify again.';});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])
  document.addEventListener(event,()=>invalidate('HOLD: independent reviewer, Jobs permission or service changed. Verify again.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

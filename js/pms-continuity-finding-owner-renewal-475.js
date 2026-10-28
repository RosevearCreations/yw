/* YW 475: age independent reviewer findings; only original company owner responds to a real renewal request. */
(()=>{'use strict';
const decisions=Object.freeze(['submit_renewed_documentary_source','request_independent_continuity_recheck','retain_followup_hold']);
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
function ancestry(d,t){const p=d.ownerClarifications.find(p=>p.id===t.owner_clarification_id),
 q=p&&d.assignmentReviews.find(q=>q.id===p.assignment_review_id),
 v=q&&d.ownerRenewals.find(v=>v.id===q.owner_renewal_id),
 k=v&&d.confirmations.find(k=>k.id===v.confirmation_id),
 a=k&&d.reassessments.find(a=>a.id===k.reassessment_id),
 r=a&&d.renewals.find(r=>r.id===a.renewal_id),
 f=r&&d.followups.find(f=>f.id===r.followup_id),
 o=f&&d.outcomes.find(o=>o.id===f.outcome_id),
 c=o&&d.comparisons.find(c=>c.id===o.comparison_id),
 h=c&&d.handoffs.find(h=>h.id===c.handoff_id),
 original=h&&d.cases.find(z=>z.proposal_id===h.proposal_id);
 return {p,q,v,k,a,r,f,o,c,h,original};}
function priorSources(t,s){return [t.source_reference,s.p?.source_reference,s.q?.source_reference,
 s.v?.source_reference,s.k?.source_reference,s.a?.source_reference,s.r?.source_reference,
 s.f?.source_reference,s.o?.source_reference,s.c?.compared_source_reference,s.h?.source_reference];}
function validLineage(d,t,s){return s.p&&s.q&&s.v&&s.k&&s.a&&s.r&&s.f&&s.o&&s.c&&s.h&&s.original&&
 s.v.decision==='request_independent_recheck'&&s.q.disposition==='request_owner_source_clarification'&&
 s.p.owner_user_id===s.v.owner_user_id&&s.p.owner_user_id===s.a.owner_user_id&&
 t.reviewer_user_id===s.q.reviewer_user_id&&t.reviewer_user_id===s.k.reviewer_user_id&&
 t.reviewer_user_id===s.r.reviewer_user_id&&t.reviewer_user_id===s.h.reviewer_user_id&&
 t.reviewer_user_id!==s.p.owner_user_id&&s.original.owner_user_id===s.p.owner_user_id&&
 s.original.proposed_reviewer_user_id===t.reviewer_user_id&&s.original.service_enabled===true;}
function inspect(x,{companyId,userId}={}){
 const base=window.YWI474?.inspect?.(x,{companyId,userId});
 if(base?.state!=='source_verified')return {state:'withheld',reason:base?.reason||'474 independent continuity source withheld'};
 const reviews=base.continuityReviews,now=stamp(x.owner_renewal_as_of);
 if(!Number.isFinite(now)||now!==stamp(x.captured_at)||!Array.isArray(x.continuity_finding_aging)||
  x.continuity_finding_age_total!==reviews.length||x.continuity_finding_aging.length!==reviews.length||
  !Array.isArray(x.owner_renewal_requests)||x.owner_renewal_request_sample_capped!==false||
  !Number.isSafeInteger(x.owner_renewal_request_total)||x.owner_renewal_request_total!==x.owner_renewal_requests.length||
  x.owner_renewal_requests.length>60||
  !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions','mutation_authorized','synthetic'].every(k=>x[k]===false))
  return {state:'withheld',reason:'475 independent finding aging, count or safety gate withheld'};
 const seenAge=new Set();
 for(const row of x.continuity_finding_aging){const t=reviews.find(t=>t.id===row.continuity_review_id),
  days=t&&Math.max(0,Math.floor((now-stamp(t.created_at))/86400000));
  if(!t||seenAge.has(t.id)||row.owner_clarification_id!==t.owner_clarification_id||
   !Number.isSafeInteger(row.age_days)||row.age_days!==days||
   row.band!==(days>=15?'overdue':days>=8?'aging':'current'))
   return {state:'withheld',reason:'475 independent finding age drift or missing receipt'};
  seenAge.add(t.id);}
 const seenRequests=new Set();
 for(const p of x.owner_renewal_requests){const t=reviews.find(t=>t.id===p.continuity_review_id),s=t&&ancestry(base,t);
  if(!uuid(p.id)||!t||!validLineage(base,t,s)||t.disposition!=='request_refreshed_owner_evidence'||
   seenRequests.has(t.id)||p.company_id!==companyId||p.owner_user_id!==s.p.owner_user_id||
   p.owner_user_id===t.reviewer_user_id||!decisions.includes(p.decision)||!validRef(p.source_reference)||
   priorSources(t,s).includes(p.source_reference)||!ordered(t.created_at,p.created_at)||
   !ordered(p.created_at,x.captured_at))
   return {state:'withheld',reason:'475 original owner, fresh evidence, reviewer or chronology unverified'};
  seenRequests.add(t.id);}
 return {...base,state:'source_verified',continuityFindingAging:x.continuity_finding_aging,
  ownerRenewalRequests:x.owner_renewal_requests,releaseGreen:false};
}
window.YWI475=Object.freeze({inspect,decisions});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('renewal475'))return;
 const card=el('details');card.id='renewal475';card.className='admin-hub-detail';
 card.dataset.adminHubTitle='PMS · Independent Continuity Finding & Owner Renewal';card.dataset.adminHubGroups='management operations';
 card.append(el('summary','475 · Independent Continuity Finding Aging & Owner Renewal Reconciliation'));
 const body=el('div');body.className='admin-panel-block pms475';
 body.append(el('p','Age genuine independent reviewer continuity findings. A company owner may respond only to a specific reviewer request for refreshed documentary evidence. Every operational decision stays HOLD.'));
 const help=el('a','ⓘ Independent continuity finding and owner renewal Help');help.href='/help.html#pms-continuity-finding-owner-renewal-475';body.append(help);
 const controls=el('div');controls.className='pms475-controls';
 const label=el('label','Verified company owner or independent reviewer'),company=el('select'),refresh=el('button','Verify continuity finding and owner renewal sources');
 company.id='pms475Company';refresh.id='pms475Refresh';refresh.type='button';refresh.className='secondary';
 label.append(company);controls.append(label,refresh);body.append(controls);
 const status=el('p','HOLD: verify independent reviewer findings before owner renewal.');status.id='pms475Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const journal=el('section');journal.id='pms475Journal';body.append(journal);
 const form=el('fieldset');form.id='pms475OwnerForm';form.disabled=true;form.append(el('legend','Original company owner · one documentary evidence renewal response'));
 const field=(id,description,tag,max)=>{const l=el('label',description),n=el(tag);n.id=id;if(max)n.maxLength=max;l.append(n);form.append(l);return n;};
 const finding=field('pms475Finding','Original independent reviewer request for renewed source','select');
 const decision=field('pms475Decision','Owner follow-up decision','select');
 for(const d of decisions){const option=el('option',d.replaceAll('_',' '));option.value=d;decision.append(option);}
 const source=field('pms475Source','Fresh owner documentary source reference','input',250);
 const notes=field('pms475Notes','Owner evidence clarification (optional)','textarea',500);
 const record=el('button','Record owner renewal response');record.id='pms475Record';record.type='button';record.className='secondary';form.append(record);body.append(form);
 const hold=el('p','HOLD: Owner evidence renewal does not release field work, authorize Jobs or Safety, accept results, dispatch crews, send messages, change payroll, connect a gateway, or move company data.');
 hold.id='pms475Hold';hold.className='notice';body.append(hold);card.append(body);host.append(card);
 let epoch=0,busy=false,verified=null,principal=null;
 const choices=(node,placeholder,items,label,id)=>{node.replaceChildren();const empty=el('option',placeholder);empty.value='';node.append(empty);for(const item of items){const option=el('option',label(item));option.value=id(item);node.append(option);}};
 function invalidate(message){epoch++;verified=principal=null;company.replaceChildren();journal.replaceChildren();form.disabled=true;status.textContent=message;}
 function display(d){verified=d;journal.replaceChildren();form.disabled=true;if(d.state!=='source_verified'){status.textContent='WITHHELD: '+d.reason;return;}
  const overdue=d.continuityFindingAging.filter(a=>a.band==='overdue').length;
  status.textContent='SOURCE VERIFIED: '+d.continuityReviews.length+' independent continuity findings · '+overdue+' overdue (15+ days) · '+d.ownerRenewalRequests.length+' owner renewal receipts. Operational HOLD.';
  for(const t of d.continuityReviews){const a=d.continuityFindingAging.find(a=>a.continuity_review_id===t.id),
   p=d.ownerRenewalRequests.find(p=>p.continuity_review_id===t.id),entry=el('article');entry.className='pms475-entry';
   entry.append(el('strong',a.band.toUpperCase()+' · '+a.age_days+' full day(s) since independent continuity finding'),
    el('p','Independent reviewer: '+t.disposition.replaceAll('_',' ')),el('p','Reviewer source: '+t.source_reference),
    el('p',p?'Owner renewal response: '+p.decision.replaceAll('_',' ')+' · '+p.source_reference:
     t.disposition==='request_refreshed_owner_evidence'?'Owner renewed source pending; HOLD remains':'No owner renewal requested; HOLD remains'));
   journal.append(entry);}
  if(!d.continuityReviews.length)journal.append(el('p','No verified independent continuity findings. An owner renewal request cannot be synthesized.'));
  const pending=d.isOwner?d.continuityReviews.filter(t=>{const s=ancestry(d,t);return t.disposition==='request_refreshed_owner_evidence'&&
   validLineage(d,t,s)&&s.p.owner_user_id===d.userId&&
   !d.ownerRenewalRequests.some(p=>p.continuity_review_id===t.id);}):[];
  choices(finding,'Choose genuine independent reviewer renewal request',pending,t=>t.source_reference+' · '+d.continuityFindingAging.find(a=>a.continuity_review_id===t.id).age_days+' day(s)',t=>t.id);
  form.disabled=!pending.length;}
 async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.rpc||!sb.auth?.getUser||!window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Jobs sign-in required');
  const who=await sb.auth.getUser();if(who.error||who.data?.user?.id!==a.user.id)throw Error('Signed-in user changed');return {uid:a.user.id,sb};}
 async function reconcile(){const ticket=epoch,ctx=await session(),inbox=await ctx.sb.rpc('ywi_rpc_handoff_inbox_465');
  if(ticket!==epoch||inbox.error||window.YWI465?.inspectInbox?.(inbox.data,{userId:ctx.uid})?.state!=='source_verified')throw Error('Verified company inbox withheld');
  const selected=company.value;choices(company,'Choose verified company',inbox.data.companies,c=>c.name,c=>c.id);
  if(inbox.data.companies.some(c=>c.id===selected))company.value=selected;else if(inbox.data.companies.length===1)company.value=inbox.data.companies[0].id;
  const id=company.value;if(!id){verified=null;status.textContent='HOLD: select verified company';return;}
  principal=ctx.uid;const first=await ctx.sb.rpc('ywi_rpc_owner_renewal_workspace_475',{p_company_id:id}),
   second=await ctx.sb.rpc('ywi_rpc_owner_renewal_workspace_475',{p_company_id:id});
  if(ticket!==epoch||first.error||second.error||!first.data||!second.data||company.value!==id||
   window.YWI_AUTH?.getState?.()?.user?.id!==ctx.uid||
   ['handoff_source','original_baselines','comparisons','outcomes','followups','renewals','reassessments','confirmations','aging','renewal_aging','reassessment_aging','exception_aging','owner_renewals','recheck_aging','assignment_reviews','outcome_aging','owner_clarifications','clarification_aging','continuity_reviews','continuity_finding_aging','owner_renewal_requests'].some(k=>JSON.stringify(first.data[k])!==JSON.stringify(second.data[k])))
   throw Error('Owner renewal source changed, denied or truncated');
  display(inspect(second.data,{companyId:id,userId:ctx.uid}));}
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=form.disabled=true;
  try{await reconcile();}catch(e){display({state:'withheld',reason:e.message||String(e)});}finally{busy=false;refresh.disabled=company.disabled=false;}});
 record.addEventListener('click',async()=>{const d=verified,id=company.value,t=d?.continuityReviews.find(t=>t.id===finding.value),s=t&&ancestry(d,t),
  value=source.value.trim(),note=notes.value.trim();
  if(busy||d?.state!=='source_verified'||!d.isOwner||!t||t.disposition!=='request_refreshed_owner_evidence'||
   !validLineage(d,t,s)||s.p.owner_user_id!==d.userId||
   d.ownerRenewalRequests.some(p=>p.continuity_review_id===t.id)||!decisions.includes(decision.value)||
   !validRef(value)||note.length>500||priorSources(t,s).includes(value))
   return status.textContent='WITHHELD: original reviewer renewal request and distinct owner documentary source required';
  if(!window.confirm('Record INTERNAL owner evidence only? Jobs, Safety, service and cross-app actions all remain HOLD.'))return;
  busy=true;refresh.disabled=form.disabled=true;
  try{const ctx=await session();if(ctx.uid!==principal||company.value!==id)throw Error('Owner identity or company changed');
   const receipt=await ctx.sb.rpc('ywi_rpc_owner_continuity_request_475',{p_company_id:id,p_operation_id:operationId(),
    p_continuity_review_id:t.id,p_decision:decision.value,p_source_reference:value,p_notes:note||null});
   if(receipt.error||!uuid(receipt.data?.id)||receipt.data.company_id!==id||receipt.data.recorded!==true||
    !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions'].every(k=>receipt.data[k]===false))
    throw Error('Unverified owner renewal receipt');
   await reconcile();source.value=notes.value='';
  }catch(e){verified=null;status.textContent='WITHHELD: '+(e.message||e)+'. Recheck the source before retry.';}
  finally{busy=false;refresh.disabled=false;form.disabled=verified?.state!=='source_verified'||!verified.isOwner||
   !verified.continuityReviews.some(t=>t.disposition==='request_refreshed_owner_evidence'&&!verified.ownerRenewalRequests.some(p=>p.continuity_review_id===t.id));}});
 company.addEventListener('change',()=>{epoch++;verified=null;form.disabled=true;journal.replaceChildren();status.textContent='HOLD: company changed. Verify again.';});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])
  document.addEventListener(event,()=>invalidate('HOLD: owner, Jobs permission or company service changed. Verify again.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

/* YW 473: age real 472 reviewer outcomes, accept only a distinct owner documentary follow-up. HOLD. */
(()=>{'use strict';
const decisions=Object.freeze(['submit_clarification_evidence','ask_for_independent_recheck','retain_followup_hold']);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const validRef=x=>typeof x==='string'&&x.trim().length>=4&&x.trim().length<=250;
const stamp=x=>Date.parse(x);
const chronological=(a,b)=>Number.isFinite(stamp(a))&&Number.isFinite(stamp(b))&&stamp(a)<=stamp(b);
const el=(tag,content)=>{const n=document.createElement(tag);if(content!==undefined)n.textContent=content;return n;};
function operationId(){if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
 if(!globalThis.crypto?.getRandomValues)throw Error('Secure operation ID unavailable');
 const bytes=globalThis.crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');}
function chain(d,q){const v=d.ownerRenewals.find(v=>v.id===q.owner_renewal_id),
 k=v&&d.confirmations.find(k=>k.id===v.confirmation_id),
 a=k&&d.reassessments.find(a=>a.id===k.reassessment_id),
 r=a&&d.renewals.find(r=>r.id===a.renewal_id),
 f=r&&d.followups.find(f=>f.id===r.followup_id),
 o=f&&d.outcomes.find(o=>o.id===f.outcome_id),
 c=o&&d.comparisons.find(c=>c.id===o.comparison_id),
 h=c&&d.handoffs.find(h=>h.id===c.handoff_id),
 original=h&&d.cases.find(p=>p.proposal_id===h.proposal_id);
 return {v,k,a,r,f,o,c,h,original};}
function inspect(x,{companyId,userId}={}){
 const base=window.YWI472?.inspect?.(x,{companyId,userId});
 if(base?.state!=='source_verified')return {state:'withheld',reason:base?.reason||'472 independent reviewer source unavailable'};
 const reviews=base.assignmentReviews,now=stamp(x.outcome_as_of);
 if(!Number.isFinite(now)||now!==stamp(x.captured_at)||!Array.isArray(x.outcome_aging)||
  x.review_outcome_total!==reviews.length||x.outcome_aging.length!==reviews.length||
  !Array.isArray(x.owner_clarifications)||x.clarification_sample_capped!==false||
  !Number.isSafeInteger(x.clarification_total)||x.clarification_total!==x.owner_clarifications.length||
  x.owner_clarifications.length>60||
  !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions','mutation_authorized','synthetic'].every(k=>x[k]===false))
  return {state:'withheld',reason:'473 independent outcome age, totals or authority withheld'};
 const seenAge=new Set();
 for(const row of x.outcome_aging){const q=reviews.find(q=>q.id===row.assignment_review_id),
  days=q&&Math.max(0,Math.floor((now-stamp(q.created_at))/86400000));
  if(!q||seenAge.has(q.id)||row.owner_renewal_id!==q.owner_renewal_id||
   !Number.isSafeInteger(row.age_days)||row.age_days!==days||
   row.band!==(days>=15?'overdue':days>=8?'aging':'current'))
   return {state:'withheld',reason:'473 server reviewer outcome aging mismatched'};
  seenAge.add(q.id);}
 const seenOwner=new Set();
 for(const p of x.owner_clarifications){const q=reviews.find(q=>q.id===p.assignment_review_id),s=q&&chain(base,q);
  if(!uuid(p.id)||!q||q.disposition!=='request_owner_source_clarification'||
   !s.v||!s.k||!s.a||!s.r||!s.f||!s.o||!s.c||!s.h||!s.original||
   seenOwner.has(q.id)||p.company_id!==companyId||p.owner_user_id!==s.v.owner_user_id||
   p.owner_user_id!==s.a.owner_user_id||p.owner_user_id===q.reviewer_user_id||
   s.original.owner_user_id!==p.owner_user_id||s.original.proposed_reviewer_user_id!==q.reviewer_user_id||
   !decisions.includes(p.decision)||!validRef(p.source_reference)||
   [q.source_reference,s.v.source_reference,s.k.source_reference,s.a.source_reference,
    s.r.source_reference,s.f.source_reference,s.o.source_reference,s.c.compared_source_reference,
    s.h.source_reference].includes(p.source_reference)||
   !chronological(q.created_at,p.created_at)||!chronological(p.created_at,x.captured_at))
   return {state:'withheld',reason:'473 owner clarification, distinct source or chronology unverified'};
  seenOwner.add(q.id);}
 return {...base,state:'source_verified',reviewOutcomes:reviews,outcomeAging:x.outcome_aging,
  ownerClarifications:x.owner_clarifications,releaseGreen:false};
}
window.YWI473=Object.freeze({inspect,decisions});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('clarification473'))return;
 const card=el('details');card.id='clarification473';card.className='admin-hub-detail';
 card.dataset.adminHubTitle='PMS · Independent Recheck Outcome Clarification';card.dataset.adminHubGroups='management operations';
 card.append(el('summary','473 · Independent Recheck Outcome Aging & Owner Clarification'));
 const body=el('div');body.className='admin-panel-block pms473';
 body.append(el('p','Age genuine 472 independent intake outcomes and let only the verified company owner append one new source when the reviewer explicitly requested clarification. Review evidence is not Jobs/Safety approval.'));
 const help=el('a','ⓘ Reviewer outcome and owner clarification Help');help.href='/help.html#pms-recheck-outcome-clarification-473';body.append(help);
 const controls=el('div');controls.className='pms473-controls';
 const label=el('label','Verified company owner or separate reviewer'),company=el('select'),refresh=el('button','Verify independent outcome and owner sources');
 company.id='pms473Company';refresh.id='pms473Refresh';refresh.type='button';refresh.className='secondary';
 label.append(company);controls.append(label,refresh);body.append(controls);
 const status=el('p','HOLD: verify company and 472 independent reviewer outcomes.');status.id='pms473Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const journal=el('section');journal.id='pms473Journal';body.append(journal);
 const form=el('fieldset');form.id='pms473OwnerForm';form.disabled=true;form.append(el('legend','Company owner · documentary clarification follow-up'));
 const field=(id,text,tag,max)=>{const l=el('label',text),n=el(tag);n.id=id;if(max)n.maxLength=max;l.append(n);form.append(l);return n;};
 const review=field('pms473Review','Independent reviewer request needing owner clarification','select');
 const decision=field('pms473Decision','Owner documentary response','select');
 for(const d of decisions){const option=el('option',d.replaceAll('_',' '));option.value=d;decision.append(option);}
 const source=field('pms473Source','New owner documentary source reference','input',250);
 const notes=field('pms473Notes','Owner follow-up note (optional)','textarea',500);
 const record=el('button','Record owner clarification receipt');record.id='pms473Record';record.type='button';record.className='secondary';form.append(record);body.append(form);
 const hold=el('p','HOLD: Owner documentary clarification cannot reassign a reviewer, accept field results, authorize Jobs/Safety work, release a service, transfer tenant records, dispatch crews, or send customer messages.');
 hold.id='pms473Hold';hold.className='notice';body.append(hold);card.append(body);host.append(card);
 let epoch=0,busy=false,verified=null,principal=null;
 const choices=(node,placeholder,items,label,id)=>{node.replaceChildren();const first=el('option',placeholder);first.value='';node.append(first);for(const item of items){const option=el('option',label(item));option.value=id(item);node.append(option);}};
 function invalidate(message){epoch++;verified=principal=null;company.replaceChildren();journal.replaceChildren();form.disabled=true;status.textContent=message;}
 function display(d){verified=d;journal.replaceChildren();form.disabled=true;if(d.state!=='source_verified'){status.textContent='WITHHELD: '+d.reason;return;}
  const overdue=d.outcomeAging.filter(row=>row.band==='overdue').length;
  status.textContent='SOURCE VERIFIED: '+d.reviewOutcomes.length+' independent recheck outcomes · '+overdue+' overdue (15+ days) · '+d.ownerClarifications.length+' owner clarification receipts. Operational HOLD.';
  for(const q of d.reviewOutcomes){const age=d.outcomeAging.find(row=>row.assignment_review_id===q.id),p=d.ownerClarifications.find(row=>row.assignment_review_id===q.id),item=el('article');item.className='pms473-entry';
   item.append(el('strong',age.band.toUpperCase()+' · '+age.age_days+' full day(s) since independent reviewer intake'),
    el('p','Reviewer disposition: '+q.disposition.replaceAll('_',' ')),el('p','Reviewer evidence: '+q.source_reference),
    el('p',p?'Owner clarification: '+p.decision.replaceAll('_',' ')+' · '+p.source_reference:
     q.disposition==='request_owner_source_clarification'?'Owner clarification evidence pending; HOLD remains':'No owner clarification requested; HOLD remains'));
   journal.append(item);}
  if(!d.reviewOutcomes.length)journal.append(el('p','No genuine 472 independent intake outcomes. Reviewer outcome aging cannot create a new request.'));
  const pending=d.isOwner?d.reviewOutcomes.filter(q=>{const s=chain(d,q);return q.disposition==='request_owner_source_clarification'&&
   s.v?.owner_user_id===d.userId&&s.a?.owner_user_id===d.userId&&q.reviewer_user_id!==d.userId&&
   !d.ownerClarifications.some(p=>p.assignment_review_id===q.id);}):[];
  choices(review,'Choose genuine reviewer clarification request',pending,q=>q.source_reference+' · '+d.outcomeAging.find(a=>a.assignment_review_id===q.id).age_days+' day(s)',q=>q.id);
  form.disabled=!pending.length;}
 async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.rpc||!sb.auth?.getUser||!window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Jobs sign-in required');
  const who=await sb.auth.getUser();if(who.error||who.data?.user?.id!==a.user.id)throw Error('Signed-in user changed');return {uid:a.user.id,sb};}
 async function reconcile(){const ticket=epoch,ctx=await session(),inbox=await ctx.sb.rpc('ywi_rpc_handoff_inbox_465');
  if(ticket!==epoch||inbox.error||window.YWI465?.inspectInbox?.(inbox.data,{userId:ctx.uid})?.state!=='source_verified')throw Error('Verified company inbox withheld');
  const selected=company.value;choices(company,'Choose verified company',inbox.data.companies,c=>c.name,c=>c.id);
  if(inbox.data.companies.some(c=>c.id===selected))company.value=selected;else if(inbox.data.companies.length===1)company.value=inbox.data.companies[0].id;
  const id=company.value;if(!id){verified=null;status.textContent='HOLD: select verified company';return;}
  principal=ctx.uid;const first=await ctx.sb.rpc('ywi_rpc_clarification_workspace_473',{p_company_id:id}),second=await ctx.sb.rpc('ywi_rpc_clarification_workspace_473',{p_company_id:id});
  if(ticket!==epoch||first.error||second.error||!first.data||!second.data||company.value!==id||
   window.YWI_AUTH?.getState?.()?.user?.id!==ctx.uid||
   ['handoff_source','original_baselines','comparisons','outcomes','followups','renewals','reassessments','confirmations','aging','renewal_aging','reassessment_aging','exception_aging','owner_renewals','recheck_aging','assignment_reviews','outcome_aging','owner_clarifications'].some(k=>JSON.stringify(first.data[k])!==JSON.stringify(second.data[k])))
   throw Error('Independent outcome source changed, denied or truncated');
  display(inspect(second.data,{companyId:id,userId:ctx.uid}));}
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=form.disabled=true;
  try{await reconcile();}catch(e){display({state:'withheld',reason:e.message||String(e)});}finally{busy=false;refresh.disabled=company.disabled=false;}});
 record.addEventListener('click',async()=>{const d=verified,id=company.value,q=d?.reviewOutcomes.find(q=>q.id===review.value),s=q&&chain(d,q),
  value=source.value.trim(),note=notes.value.trim();
  if(busy||d?.state!=='source_verified'||!d.isOwner||!q||q.disposition!=='request_owner_source_clarification'||
   !s.v||!s.k||!s.a||!s.r||!s.f||!s.o||!s.c||!s.h||!s.original||
   s.v.owner_user_id!==d.userId||s.a.owner_user_id!==d.userId||q.reviewer_user_id===d.userId||
   d.ownerClarifications.some(p=>p.assignment_review_id===q.id)||!decisions.includes(decision.value)||
   !validRef(value)||note.length>500||
   [q.source_reference,s.v.source_reference,s.k.source_reference,s.a.source_reference,s.r.source_reference,
    s.f.source_reference,s.o.source_reference,s.c.compared_source_reference,s.h.source_reference].includes(value))
   return status.textContent='WITHHELD: genuine reviewer request and fresh owner clarification source required';
  if(!window.confirm('Record INTERNAL owner clarification evidence only? Independent review and every operational release remain HOLD.'))return;
  busy=true;refresh.disabled=form.disabled=true;
  try{const ctx=await session();if(ctx.uid!==principal||company.value!==id)throw Error('Owner identity or company changed');
   const receipt=await ctx.sb.rpc('ywi_rpc_owner_clarification_473',{p_company_id:id,p_operation_id:operationId(),
    p_assignment_review_id:q.id,p_decision:decision.value,p_source_reference:value,p_notes:note||null});
   if(receipt.error||!uuid(receipt.data?.id)||receipt.data.company_id!==id||receipt.data.recorded!==true||
    !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions'].every(k=>receipt.data[k]===false))
    throw Error('Unverified owner clarification receipt');
   await reconcile();source.value=notes.value='';
  }catch(e){verified=null;status.textContent='WITHHELD: '+(e.message||e)+'. Recheck the journal before retry.';}
  finally{busy=false;refresh.disabled=false;form.disabled=verified?.state!=='source_verified'||!verified.isOwner||
   !verified.reviewOutcomes.some(q=>q.disposition==='request_owner_source_clarification'&&!verified.ownerClarifications.some(p=>p.assignment_review_id===q.id));}});
 company.addEventListener('change',()=>{epoch++;verified=null;form.disabled=true;journal.replaceChildren();status.textContent='HOLD: company changed. Verify again.';});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])
  document.addEventListener(event,()=>invalidate('HOLD: owner/reviewer, Jobs permission or service changed. Verify again.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

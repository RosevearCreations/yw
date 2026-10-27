/* YW 472: owner renewal aging and original independent reviewer recheck-intake; HOLD. */
(()=>{'use strict';
const dispositions=Object.freeze(['confirm_recheck_intake','request_owner_source_clarification','retain_independent_hold']);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const reference=x=>typeof x==='string'&&x.trim().length>=4&&x.trim().length<=250;
const millis=x=>Date.parse(x);
const order=(a,b)=>Number.isFinite(millis(a))&&Number.isFinite(millis(b))&&millis(a)<=millis(b);
const el=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;return n;};
function uuidOperation(){if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
 const a=new Uint8Array(16);if(!globalThis.crypto?.getRandomValues)throw Error('Secure operation ID unavailable');
 globalThis.crypto.getRandomValues(a);a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;
 const s=Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');}
function chain(d,v){const k=d.confirmations.find(k=>k.id===v.confirmation_id),a=k&&d.reassessments.find(a=>a.id===k.reassessment_id),
 r=a&&d.renewals.find(r=>r.id===a.renewal_id),f=r&&d.followups.find(f=>f.id===r.followup_id),
 o=f&&d.outcomes.find(o=>o.id===f.outcome_id),c=o&&d.comparisons.find(c=>c.id===o.comparison_id),
 h=c&&d.handoffs.find(h=>h.id===c.handoff_id),original=h&&d.cases.find(p=>p.proposal_id===h.proposal_id);
 return {k,a,r,f,o,c,h,original};}
function inspect(x,{companyId,userId}={}){
 const base=window.YWI471?.inspect?.(x,{companyId,userId});
 if(base?.state!=='source_verified')return {state:'withheld',reason:base?.reason||'471 owner renewal source unavailable'};
 const requests=base.ownerRenewals.filter(v=>v.decision==='request_independent_recheck'),clock=millis(x.recheck_as_of);
 if(!Number.isFinite(clock)||clock!==millis(x.captured_at)||!Array.isArray(x.recheck_aging)||
  x.recheck_request_total!==requests.length||x.recheck_aging.length!==requests.length||
  !Array.isArray(x.assignment_reviews)||x.assignment_review_sample_capped!==false||
  !Number.isSafeInteger(x.assignment_review_total)||x.assignment_review_total!==x.assignment_reviews.length||
  x.assignment_reviews.length>60||
  !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions','mutation_authorized','synthetic'].every(k=>x[k]===false))
  return {state:'withheld',reason:'472 independent recheck clock, totals or authority withheld'};
 const aged=new Set();for(const a of x.recheck_aging){const v=requests.find(v=>v.id===a.owner_renewal_id),
  days=v&&Math.max(0,Math.floor((clock-millis(v.created_at))/86400000));
  if(!v||aged.has(v.id)||a.confirmation_id!==v.confirmation_id||!Number.isSafeInteger(a.age_days)||
    a.age_days!==days||a.band!==(days>=15?'overdue':days>=8?'aging':'current'))
   return {state:'withheld',reason:'472 server owner renewal aging mismatched'};
  aged.add(v.id);}
 const reviewed=new Set();for(const q of x.assignment_reviews){const v=requests.find(v=>v.id===q.owner_renewal_id),s=v&&chain(base,v);
  if(!v||!s.k||!s.a||!s.r||!s.f||!s.o||!s.c||!s.h||!s.original||!uuid(q.id)||
   reviewed.has(v.id)||q.company_id!==companyId||q.reviewer_user_id!==s.k.reviewer_user_id||
   q.reviewer_user_id!==s.r.reviewer_user_id||q.reviewer_user_id!==s.h.reviewer_user_id||
   q.reviewer_user_id===v.owner_user_id||s.original.owner_user_id!==v.owner_user_id||
   s.original.proposed_reviewer_user_id!==q.reviewer_user_id||
   !dispositions.includes(q.disposition)||!reference(q.source_reference)||
   [v.source_reference,s.k.source_reference,s.a.source_reference,s.r.source_reference,s.f.source_reference,
    s.o.source_reference,s.c.compared_source_reference,s.h.source_reference].includes(q.source_reference)||
   !order(v.created_at,q.created_at)||!order(q.created_at,x.captured_at))
   return {state:'withheld',reason:'472 reviewer source, signer or chronology not independently verified'};
  reviewed.add(v.id);}
 return {...base,state:'source_verified',requests,recheckAging:x.recheck_aging,assignmentReviews:x.assignment_reviews,releaseGreen:false};
}
window.YWI472=Object.freeze({inspect,dispositions});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('recheck472'))return;
 const card=el('details');card.id='recheck472';card.className='admin-hub-detail';
 card.dataset.adminHubTitle='PMS · Owner Evidence Renewal Recheck';card.dataset.adminHubGroups='management operations';
 card.append(el('summary','472 · Owner Renewal Aging & Independent Recheck Assignment Review'));
 const body=el('div');body.className='admin-panel-block pms472';
 body.append(el('p','Review overdue documentary owner requests and allow only the originally assigned separate reviewer to acknowledge intake. No real reassignment, safety approval, dispatch or external message.'));
 const help=el('a','ⓘ Owner renewal recheck Help');help.href='/help.html#pms-owner-renewal-recheck-472';body.append(help);
 const controls=el('div');controls.className='pms472-controls';const label=el('label','Verified company'),company=el('select'),refresh=el('button','Verify renewal and independent reviewer sources');
 company.id='pms472Company';refresh.id='pms472Refresh';refresh.type='button';refresh.className='secondary';label.append(company);controls.append(label,refresh);body.append(controls);
 const status=el('p','HOLD: verify company and separate reviewer sources.');status.id='pms472Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const journal=el('section');journal.id='pms472Journal';body.append(journal);
 const form=el('fieldset');form.id='pms472ReviewerForm';form.disabled=true;form.append(el('legend','Original separate reviewer · documentary recheck intake'));
 const field=(id,title,tag,max)=>{const l=el('label',title),n=el(tag);n.id=id;if(max)n.maxLength=max;l.append(n);form.append(l);return n;};
 const request=field('pms472Request','Owner recheck request','select');
 const disposition=field('pms472Disposition','Review disposition','select');
 for(const value of dispositions){const option=el('option',value.replaceAll('_',' '));option.value=value;disposition.append(option);}
 const source=field('pms472Source','New independent documentary source reference','input',250);
 const notes=field('pms472Notes','Independent reviewer note (optional)','textarea',500);
 const record=el('button','Record separate reviewer recheck intake');record.id='pms472Record';record.type='button';record.className='secondary';form.append(record);body.append(form);
 const hold=el('p','HOLD: Reviewer intake is not permission to reassign an employee, reopen field acceptance, approve Jobs/Safety, transfer records, send notifications, or promote Production.');hold.id='pms472Hold';hold.className='notice';body.append(hold);
 card.append(body);host.append(card);
 let epoch=0,busy=false,verified=null,principal=null;
 const options=(node,placeholder,items,label,id)=>{node.replaceChildren();const first=el('option',placeholder);first.value='';node.append(first);for(const item of items){const option=el('option',label(item));option.value=id(item);node.append(option);}};
 function invalidate(message){epoch++;verified=principal=null;company.replaceChildren();journal.replaceChildren();form.disabled=true;status.textContent=message;}
 function display(d){verified=d;journal.replaceChildren();form.disabled=true;if(d.state!=='source_verified'){status.textContent='WITHHELD: '+d.reason;return;}
  const overdue=d.recheckAging.filter(a=>a.band==='overdue').length;
  status.textContent='SOURCE VERIFIED: '+d.requests.length+' owner recheck requests · '+overdue+' overdue (15+ days) · '+d.assignmentReviews.length+' separate reviewer intake receipts. Operational HOLD.';
  for(const v of d.requests){const age=d.recheckAging.find(a=>a.owner_renewal_id===v.id),review=d.assignmentReviews.find(q=>q.owner_renewal_id===v.id),item=el('article');item.className='pms472-entry';
   item.append(el('strong',age.band.toUpperCase()+' · '+age.age_days+' full day(s) since owner source renewal'),
    el('p','Owner request: '+v.source_reference),el('p',review?'Independent reviewer: '+review.disposition.replaceAll('_',' ')+' · '+review.source_reference:'Separate reviewer intake pending; HOLD remains'));
   journal.append(item);}
  if(!d.requests.length)journal.append(el('p','No owner requests for independent recheck. Other renewal decisions do not create new reviewer assignments.'));
  const pending=d.isReviewer?d.requests.filter(v=>{const s=chain(d,v);return s.k&&s.r&&s.h&&s.k.reviewer_user_id===d.userId&&s.r.reviewer_user_id===d.userId&&s.h.reviewer_user_id===d.userId&&v.owner_user_id!==d.userId&&!d.assignmentReviews.some(q=>q.owner_renewal_id===v.id);}):[];
  options(request,'Select genuine owner request',pending,v=>v.source_reference+' · '+d.recheckAging.find(a=>a.owner_renewal_id===v.id).age_days+' day(s)',v=>v.id);
  form.disabled=!pending.length;}
 async function session(){const state=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(state?.isAuthenticated!==true||!uuid(state.user?.id)||!sb?.rpc||!sb.auth?.getUser||!window.YWISecurity?.canViewModule?.('jobs',state.role,'view'))throw Error('Jobs sign-in required');
  const who=await sb.auth.getUser();if(who.error||who.data?.user?.id!==state.user.id)throw Error('Signed-in account changed');return {uid:state.user.id,sb};}
 async function reconcile(){const ticket=epoch,ctx=await session(),inbox=await ctx.sb.rpc('ywi_rpc_handoff_inbox_465');
  if(ticket!==epoch||inbox.error||window.YWI465?.inspectInbox?.(inbox.data,{userId:ctx.uid})?.state!=='source_verified')throw Error('Verified company inbox withheld');
  const selected=company.value;options(company,'Choose verified company',inbox.data.companies,c=>c.name,c=>c.id);
  if(inbox.data.companies.some(c=>c.id===selected))company.value=selected;else if(inbox.data.companies.length===1)company.value=inbox.data.companies[0].id;
  const id=company.value;if(!id){verified=null;status.textContent='HOLD: select a verified company';return;}
  principal=ctx.uid;const a=await ctx.sb.rpc('ywi_rpc_recheck_workspace_472',{p_company_id:id}),b=await ctx.sb.rpc('ywi_rpc_recheck_workspace_472',{p_company_id:id});
  if(ticket!==epoch||a.error||b.error||!a.data||!b.data||company.value!==id||window.YWI_AUTH?.getState?.()?.user?.id!==ctx.uid||
   ['handoff_source','original_baselines','comparisons','outcomes','followups','renewals','reassessments','confirmations','aging','renewal_aging','reassessment_aging','exception_aging','owner_renewals','recheck_aging','assignment_reviews'].some(k=>JSON.stringify(a.data[k])!==JSON.stringify(b.data[k])))
   throw Error('Independent owner renewal source changed or denied');
  display(inspect(b.data,{companyId:id,userId:ctx.uid}));}
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=form.disabled=true;
  try{await reconcile();}catch(e){display({state:'withheld',reason:e.message||String(e)});}finally{busy=false;refresh.disabled=company.disabled=false;}});
 record.addEventListener('click',async()=>{const d=verified,id=company.value,v=d?.requests.find(v=>v.id===request.value),s=v&&chain(d,v),value=source.value.trim(),note=notes.value.trim();
  if(busy||d?.state!=='source_verified'||!d.isReviewer||!v||!s.k||!s.r||!s.h||!s.a||!s.f||!s.o||!s.c||
   d.assignmentReviews.some(q=>q.owner_renewal_id===v.id)||s.k.reviewer_user_id!==d.userId||s.h.reviewer_user_id!==d.userId||
   s.r.reviewer_user_id!==d.userId||v.owner_user_id===d.userId||!dispositions.includes(disposition.value)||!reference(value)||note.length>500||
   [v.source_reference,s.k.source_reference,s.a.source_reference,s.r.source_reference,s.f.source_reference,s.o.source_reference,s.c.compared_source_reference,s.h.source_reference].includes(value))
   return status.textContent='WITHHELD: separate reviewer, owner recheck request and new evidence reference required';
  if(!window.confirm('Record INTERNAL independent documentary intake only? Field work, actual reassignment and release remain HOLD.'))return;
  busy=true;refresh.disabled=form.disabled=true;
  try{const ctx=await session();if(ctx.uid!==principal||id!==company.value)throw Error('Review identity or company changed');
   const receipt=await ctx.sb.rpc('ywi_rpc_reviewer_recheck_472',{p_company_id:id,p_operation_id:uuidOperation(),p_owner_renewal_id:v.id,p_disposition:disposition.value,p_source_reference:value,p_notes:note||null});
   if(receipt.error||!uuid(receipt.data?.id)||receipt.data.company_id!==id||receipt.data.recorded!==true||
    !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions'].every(k=>receipt.data[k]===false))throw Error('Unverified independent reviewer intake receipt');
   await reconcile();source.value=notes.value='';
  }catch(e){verified=null;status.textContent='WITHHELD: '+(e.message||e)+'. Verify the documentary journal before retry.';}
  finally{busy=false;refresh.disabled=false;form.disabled=verified?.state!=='source_verified'||!verified.isReviewer||!verified.requests.some(v=>!verified.assignmentReviews.some(q=>q.owner_renewal_id===v.id));}});
 company.addEventListener('change',()=>{epoch++;verified=null;form.disabled=true;journal.replaceChildren();status.textContent='HOLD: company changed. Verify again.';});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])document.addEventListener(event,()=>invalidate('HOLD: company/service or access changed. Verify again.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

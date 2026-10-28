/* YW 477: independently verified reviewer receipt aging and owner source follow-up. HOLD. */
(()=>{'use strict';
const decisions=Object.freeze(['provide_fresh_owner_source','request_independent_recheck','retain_documentary_hold']);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const stamp=x=>Date.parse(x),validRef=x=>typeof x==='string'&&x.trim().length>=4&&x.trim().length<=250;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function operationId(){if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
 if(!globalThis.crypto?.getRandomValues)throw Error('Secure owner operation ID unavailable');
 const b=globalThis.crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const h=Array.from(b,v=>v.toString(16).padStart(2,'0')).join('');
 return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');}
function inspect(x,{companyId,userId}={}){
 const b=window.YWI476?.inspect?.(x,{companyId,userId});
 if(b?.state!=='source_verified')return {state:'withheld',reason:b?.reason||'476 independent source withheld'};
 const reviews=b.reviewerFollowupReceipts,clock=stamp(x.owner_reviewer_as_of);
 if(!Number.isFinite(clock)||clock!==stamp(x.captured_at)||!Array.isArray(x.reviewer_receipt_aging)||
  x.reviewer_receipt_age_total!==reviews.length||x.reviewer_receipt_aging.length!==reviews.length||
  !Array.isArray(x.owner_reviewer_responses)||x.owner_reviewer_response_sample_capped!==false||
  !Number.isSafeInteger(x.owner_reviewer_response_total)||
  x.owner_reviewer_response_total!==x.owner_reviewer_responses.length||x.owner_reviewer_responses.length>60||
  !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions','mutation_authorized','synthetic'].every(k=>x[k]===false))
 return {state:'withheld',reason:'477 reviewer age, response completeness or HOLD not verified'};
 const ages=new Set(),responses=new Set();
 for(const row of x.reviewer_receipt_aging){const r=reviews.find(r=>r.id===row.reviewer_receipt_id);
  const days=r&&Math.max(0,Math.floor((clock-stamp(r.created_at))/86400000));
  if(!r||ages.has(r.id)||row.owner_request_id!==r.owner_request_id||!Number.isSafeInteger(row.age_days)||
   row.age_days!==days||row.band!==(days>=15?'overdue':days>=8?'aging':'current'))
   return {state:'withheld',reason:'477 independent receipt aging mismatch'};
  ages.add(r.id);}
 for(const p of x.owner_reviewer_responses){const r=reviews.find(r=>r.id===p.reviewer_receipt_id),
  original=r&&b.ownerRenewalRequests.find(q=>q.id===r.owner_request_id);
  if(!uuid(p.id)||!r||!original||r.disposition!=='request_owner_source_refresh'||
   responses.has(r.id)||p.company_id!==companyId||p.owner_user_id!==original.owner_user_id||
   p.owner_user_id===r.reviewer_user_id||!decisions.includes(p.decision)||!validRef(p.source_reference)||
   [r.source_reference,original.source_reference].includes(p.source_reference)||
   !Number.isFinite(stamp(p.created_at))||stamp(p.created_at)<stamp(r.created_at)||stamp(p.created_at)>clock)
   return {state:'withheld',reason:'477 owner source, independence, company or chronology mismatch'};
  responses.add(r.id);}
 return {...b,state:'source_verified',reviewerReceiptAging:x.reviewer_receipt_aging,
  ownerReviewerResponses:x.owner_reviewer_responses,releaseGreen:false};
}
window.YWI477=Object.freeze({inspect,decisions});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('owner477'))return;
 const card=el('details');card.id='owner477';card.className='admin-hub-detail';
 card.dataset.adminHubTitle='PMS · Reviewer Follow-Up & Owner Evidence';card.dataset.adminHubGroups='management operations';
 card.append(el('summary','477 · Independent Reviewer Receipt Aging & Owner Evidence Follow-Up'));
 const body=el('div');body.className='admin-panel-block pms477';
 body.append(el('p','Age real independent 476 reviewer receipts. Only the original company owner can respond once to an explicit request for refreshed evidence. All field, approval and integration actions remain on HOLD.'));
 const help=el('a','ⓘ Build 477 and QL-245 evidence Help');help.href='/help.html#pms-owner-reviewer-followup-477';body.append(help);
 const controls=el('div');controls.className='pms477-controls';
 const label=el('label','Verified company owner or original independent reviewer'),company=el('select'),refresh=el('button','Verify reviewer receipt and owner source');
 company.id='pms477Company';refresh.id='pms477Refresh';refresh.type='button';refresh.className='secondary';
 label.append(company);controls.append(label,refresh);body.append(controls);
 const status=el('p','HOLD: verify original reviewer source.');status.id='pms477Status';status.setAttribute('role','status');body.append(status);
 const journal=el('section');journal.id='pms477Journal';body.append(journal);
 const form=el('fieldset');form.id='pms477OwnerForm';form.disabled=true;form.append(el('legend','Original company owner · source-linked documentary response'));
 const field=(id,text,tag,max)=>{const l=el('label',text),n=el(tag);n.id=id;if(max)n.maxLength=max;l.append(n);form.append(l);return n;};
 const request=field('pms477Receipt','Independent reviewer request for owner source','select');
 const decision=field('pms477Decision','Owner documentary response','select');
 for(const d of decisions){const option=el('option',d.replaceAll('_',' '));option.value=d;decision.append(option);}
 const source=field('pms477Source','New owner source reference','input',250),notes=field('pms477Notes','Optional note','textarea',500);
 const record=el('button','Record documentary owner follow-up');record.id='pms477Record';record.type='button';record.className='secondary';form.append(record);body.append(form);
 const hold=el('p','HOLD: No Jobs/Safety acceptance, independent approval, payroll, dispatch, customer communication, or cross-app connection. QL-245 source signatures, seven live negative tests, separately trusted pins, and owner authorization are UNVERIFIED.');
 hold.id='pms477Hold';hold.className='notice';body.append(hold);card.append(body);host.append(card);
 let epoch=0,busy=false,verified=null,principal=null;
 function choices(node,placeholder,items,label,id){node.replaceChildren();const empty=el('option',placeholder);empty.value='';node.append(empty);
  for(const item of items){const option=el('option',label(item));option.value=id(item);node.append(option);}}
 function invalidate(msg){epoch++;verified=principal=null;company.replaceChildren();journal.replaceChildren();form.disabled=true;status.textContent=msg;}
 function display(d){verified=d;journal.replaceChildren();form.disabled=true;if(d.state!=='source_verified'){status.textContent='WITHHELD: '+d.reason;return;}
  const overdue=d.reviewerReceiptAging.filter(a=>a.band==='overdue').length;
  status.textContent='SOURCE VERIFIED: '+d.reviewerFollowupReceipts.length+' reviewer receipts · '+overdue+' overdue (15+ days) · '+d.ownerReviewerResponses.length+' owner responses. Operational and QL-245 connection HOLD.';
  for(const r of d.reviewerFollowupReceipts){const a=d.reviewerReceiptAging.find(a=>a.reviewer_receipt_id===r.id),
   p=d.ownerReviewerResponses.find(p=>p.reviewer_receipt_id===r.id),article=el('article');article.className='pms477-entry';
   article.append(el('strong',a.band.toUpperCase()+' · '+a.age_days+' full day(s) since independent reviewer receipt'),
    el('p','Reviewer finding: '+r.disposition.replaceAll('_',' ')),el('p','Reviewer source: '+r.source_reference),
    el('p',p?'Owner documentary response: '+p.decision.replaceAll('_',' ')+' · '+p.source_reference:'No owner response recorded; HOLD.'));
   journal.append(article);}
  if(!d.reviewerFollowupReceipts.length)journal.append(el('p','No real 476 independent receipts; no synthetic owner follow-up permitted.'));
  const pending=d.isOwner?d.reviewerFollowupReceipts.filter(r=>r.disposition==='request_owner_source_refresh'&&
   d.ownerRenewalRequests.some(p=>p.id===r.owner_request_id&&p.owner_user_id===d.userId)&&
   !d.ownerReviewerResponses.some(p=>p.reviewer_receipt_id===r.id)):[];
  choices(request,'Choose genuine reviewer refresh request',pending,r=>r.source_reference+' · '+d.reviewerReceiptAging.find(a=>a.reviewer_receipt_id===r.id).age_days+' days',r=>r.id);
  form.disabled=!pending.length;}
 async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.rpc||!sb.auth?.getUser||
   !window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Jobs sign-in required');
  const who=await sb.auth.getUser();if(who.error||who.data?.user?.id!==a.user.id)throw Error('Identity changed');
  return {uid:a.user.id,sb};}
 async function reconcile(){const ticket=epoch,ctx=await session(),inbox=await ctx.sb.rpc('ywi_rpc_handoff_inbox_465');
  if(ticket!==epoch||inbox.error||window.YWI465?.inspectInbox?.(inbox.data,{userId:ctx.uid})?.state!=='source_verified')throw Error('Verified company inbox withheld');
  const selected=company.value;choices(company,'Choose verified company',inbox.data.companies,c=>c.name,c=>c.id);
  if(inbox.data.companies.some(c=>c.id===selected))company.value=selected;else if(inbox.data.companies.length===1)company.value=inbox.data.companies[0].id;
  const id=company.value;if(!id){status.textContent='HOLD: choose verified company';return;}
  principal=ctx.uid;
  const a=await ctx.sb.rpc('ywi_rpc_owner_reviewer_workspace_477',{p_company_id:id}),
   b=await ctx.sb.rpc('ywi_rpc_owner_reviewer_workspace_477',{p_company_id:id});
  if(ticket!==epoch||a.error||b.error||!a.data||!b.data||company.value!==id||
    window.YWI_AUTH?.getState?.()?.user?.id!==ctx.uid||
    ['handoff_source','owner_renewal_requests','reviewer_followup_receipts','reviewer_receipt_aging','owner_reviewer_responses'].some(k=>JSON.stringify(a.data[k])!==JSON.stringify(b.data[k])))
   throw Error('Documentary source drift, denied or truncated');
  display(inspect(b.data,{companyId:id,userId:ctx.uid}));}
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=form.disabled=true;
  try{await reconcile();}catch(e){display({state:'withheld',reason:e.message||String(e)});}
  finally{busy=false;refresh.disabled=company.disabled=false;}});
 record.addEventListener('click',async()=>{const d=verified,id=company.value,r=d?.reviewerFollowupReceipts.find(r=>r.id===request.value),
  p=r&&d.ownerRenewalRequests.find(p=>p.id===r.owner_request_id),value=source.value.trim(),note=notes.value.trim();
  if(busy||d?.state!=='source_verified'||!d.isOwner||!r||!p||r.disposition!=='request_owner_source_refresh'||
   p.owner_user_id!==d.userId||d.ownerReviewerResponses.some(x=>x.reviewer_receipt_id===r.id)||
   !decisions.includes(decision.value)||!validRef(value)||note.length>500||
   [r.source_reference,p.source_reference].includes(value))
   return status.textContent='WITHHELD: original owner, independent reviewer refresh request and new evidence required';
  if(!window.confirm('Record documentary follow-up only? No Jobs/Safety or integration connection is authorized.'))return;
  busy=true;refresh.disabled=form.disabled=true;
  try{const ctx=await session();if(ctx.uid!==principal||company.value!==id)throw Error('Company/owner changed');
   const result=await ctx.sb.rpc('ywi_rpc_owner_reviewer_response_477',{p_company_id:id,p_operation_id:operationId(),
    p_reviewer_receipt_id:r.id,p_decision:decision.value,p_source_reference:value,p_notes:note||null});
   if(result.error||!uuid(result.data?.id)||result.data.company_id!==id||result.data.recorded!==true||
    !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions'].every(k=>result.data[k]===false))
    throw Error('Unverified owner response');
   await reconcile();source.value=notes.value='';
  }catch(e){verified=null;status.textContent='WITHHELD: '+(e.message||e);}
  finally{busy=false;refresh.disabled=false;form.disabled=verified?.state!=='source_verified'||!verified.isOwner||
   !verified.reviewerFollowupReceipts.some(r=>r.disposition==='request_owner_source_refresh'&&
    !verified.ownerReviewerResponses.some(p=>p.reviewer_receipt_id===r.id));}});
 company.addEventListener('change',()=>{epoch++;verified=null;form.disabled=true;journal.replaceChildren();status.textContent='HOLD: company changed; reverify.';});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])
 document.addEventListener(event,()=>invalidate('HOLD: identity, Jobs permission or service changed; reverify.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
/* YW 477: independently sourced 476 reviewer-receipt aging. Read-only, HOLD. */
(()=>{'use strict';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function inspect(raw,scope={}){
 const b=window.YWI476?.inspect?.(raw,scope);
 if(b?.state!=='source_verified')return {state:'withheld',reason:b?.reason||'476 source unverified'};
 const clock=Date.parse(raw.captured_at),seen=new Set(),aging=[];
 if(!Number.isFinite(clock)||raw.reviewer_followup_receipts.length>60)return {state:'withheld',reason:'477 source clock or receipt capacity'};
 for(const receipt of b.reviewerFollowupReceipts){
  const when=Date.parse(receipt.created_at);
  if(!uuid(receipt.id)||seen.has(receipt.owner_request_id)||!Number.isFinite(when)||when>clock)
   return {state:'withheld',reason:'477 independent receipt chronology or uniqueness'};
  seen.add(receipt.owner_request_id);
  const days=Math.floor((clock-when)/86400000);
  aging.push({receipt_id:receipt.id,owner_request_id:receipt.owner_request_id,age_days:days,
   band:days>=15?'overdue':days>=8?'aging':'current',
   disposition:receipt.disposition,source_reference:receipt.source_reference});
 }
 const pending=b.ownerRenewalRequests.filter(p=>!seen.has(p.id) &&
  ['submit_renewed_documentary_source','request_independent_continuity_recheck'].includes(p.decision));
 return {...b,state:'source_verified',reviewerReceiptAging:aging,
  outstandingOwnerEvidence:pending,releaseGreen:false,connectionState:'DISCONNECTED'};
}
window.YWI477=Object.freeze({inspect});
function mount(){
 const host=document.getElementById('admin');
 if(!host||document.getElementById('receipt477'))return;
 const card=el('details');card.id='receipt477';card.className='admin-hub-detail';
 card.dataset.adminHubTitle='PMS · Independent Receipt Aging and QL-245 HOLD';
 card.dataset.adminHubGroups='management operations';
 card.append(el('summary','477 · Independent Reviewer Receipt Aging & QL-245 Source Evidence HOLD'));
 const block=el('div');block.className='admin-panel-block pms476';
 block.append(el('p','Read-only follow-up of genuine 476 reviewer receipts and pending 475 owner renewals. No changes to original evidence or service authority.'));
 const help=el('details');help.append(el('summary','ⓘ Receipt-aging and integration evidence guidance'));
 help.append(el('p','Age is measured against the verified server source timestamp: current 0–7 days, aging 8–14 days, overdue 15+ days. A missing reviewer receipt remains pending, not approved.'));
 help.append(el('p','QL-245 requires issued company-tenant credentials, source SHA and green CI, seven real denial traces, signed nonproduction health/capability receipts, separately trusted public-key pins, independent restart proof and an owner approval through another channel. None can be inferred from a production deploy.'));
 block.append(help);
 const controls=el('div');controls.className='pms476-controls';
 const label=el('label','Verified Yard Workers company');
 const company=el('select');company.id='pms477Company';label.append(company);
 const refresh=el('button','Reconcile independent receipts');refresh.type='button';refresh.className='secondary';refresh.id='pms477Refresh';
 controls.append(label,refresh);block.append(controls);
 const status=el('p','HOLD: authenticate and verify original company evidence.');status.id='pms477Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');block.append(status);
 const journal=el('section');journal.id='pms477Journal';block.append(journal);
 const hold=el('p','DISCONNECTED / HOLD · No live QL-245 signed exchange is verified; no Jobs/Safety release, payroll, dispatch, customer message, or cross-app read/write.');
 hold.id='pms477Hold';hold.className='notice';block.append(hold);card.append(block);host.append(card);
 let epoch=0,busy=false;
 const options=(node,items,selected)=>{node.replaceChildren();const first=el('option','Choose verified company');first.value='';node.append(first);
  for(const item of items){const o=el('option',item.name);o.value=item.id;node.append(o);}
  if(items.some(c=>c.id===selected))node.value=selected;else if(items.length===1)node.value=items[0].id;};
 function invalidate(msg){epoch++;company.replaceChildren();journal.replaceChildren();status.textContent=msg;}
 async function reconcile(){const ticket=epoch;
  const auth=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(auth?.isAuthenticated!==true||!uuid(auth.user?.id)||!sb?.rpc||!sb?.auth?.getUser||
   !window.YWISecurity?.canViewModule?.('jobs',auth.role,'view'))throw Error('verified Jobs sign-in required');
  const who=await sb.auth.getUser();if(who.error||who.data?.user?.id!==auth.user.id)throw Error('identity changed');
  const inbox=await sb.rpc('ywi_rpc_handoff_inbox_465');
  if(inbox.error||window.YWI465?.inspectInbox?.(inbox.data,{userId:auth.user.id})?.state!=='source_verified')
   throw Error('company inbox unverified');
  const previous=company.value;options(company,inbox.data.companies,previous);
  const id=company.value;if(!id){status.textContent='HOLD: select a verified company';return;}
  const a=await sb.rpc('ywi_rpc_reviewer_renewal_workspace_476',{p_company_id:id});
  const b=await sb.rpc('ywi_rpc_reviewer_renewal_workspace_476',{p_company_id:id});
  if(a.error||b.error||!a.data||!b.data||ticket!==epoch||company.value!==id||
   window.YWI_AUTH?.getState?.()?.user?.id!==auth.user.id||
   ['owner_renewal_requests','reviewer_followup_receipts','handoff_source'].some(k=>JSON.stringify(a.data[k])!==JSON.stringify(b.data[k])))
   throw Error('independent source replay changed or denied');
  const d=inspect(b.data,{companyId:id,userId:auth.user.id});
  if(d.state!=='source_verified')throw Error(d.reason||'source withheld');
  journal.replaceChildren();
  const overdue=d.reviewerReceiptAging.filter(r=>r.band==='overdue').length;
  status.textContent='SOURCE VERIFIED: '+d.reviewerReceiptAging.length+' independent reviewer receipt(s), '+overdue+
   ' overdue, '+d.outstandingOwnerEvidence.length+' owner renewal(s) awaiting reviewer receipt. Operational HOLD.';
  for(const r of d.reviewerReceiptAging){
   const a=el('article');a.className='pms476-entry';
   a.append(el('strong',r.band.toUpperCase()+' · '+r.age_days+' full day(s) since independent reviewer receipt'),
    el('p',r.disposition.replaceAll('_',' ')+' · '+r.source_reference),
    el('p','Documentary only. Reviewer receipt does not close or approve a service.'));
   journal.append(a);
  }
  if(d.outstandingOwnerEvidence.length)journal.append(el('p',d.outstandingOwnerEvidence.length+' owner renewal(s) still require an original independent reviewer receipt.'));
  if(!d.reviewerReceiptAging.length&&!d.outstandingOwnerEvidence.length)journal.append(el('p','No independently verified reviewer receipts or pending requests. No evidence was fabricated.'));
 }
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=true;
  try{await reconcile();}catch(e){journal.replaceChildren();status.textContent='WITHHELD: '+(e.message||e);}
  finally{busy=false;refresh.disabled=false;}});
 company.addEventListener('change',()=>{epoch++;journal.replaceChildren();status.textContent='HOLD: company changed. Re-verify sources.';});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])
  document.addEventListener(event,()=>invalidate('HOLD: identity, company or service entitlement changed. Re-verify.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
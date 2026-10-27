/* YW 470: owner reassessment aging and independent reviewer continuity; HOLD. */
(()=>{'use strict';
const findings=Object.freeze(['continuity_hold_confirmed','request_source_clarification','recommend_owner_followup']);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const ref=x=>typeof x==='string'&&x.trim().length>=4&&x.trim().length<=250;
const when=x=>Date.parse(x);
const before=(a,b)=>Number.isFinite(when(a))&&Number.isFinite(when(b))&&when(a)<=when(b);
const el=(tag,content)=>{const n=document.createElement(tag);if(content!==undefined)n.textContent=content;return n;};
function operationId(){const c=globalThis.crypto;if(c?.randomUUID)return c.randomUUID();
 if(!c?.getRandomValues)throw Error('Secure operation identifier unavailable');
 const bytes=c.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');}
function lineage(base,a){const r=base.renewals.find(r=>r.id===a.renewal_id),f=r&&base.followups.find(f=>f.id===r.followup_id),
 o=f&&base.outcomes.find(o=>o.id===f.outcome_id),c=o&&base.comparisons.find(c=>c.id===o.comparison_id),
 h=c&&base.handoffs.find(h=>h.id===c.handoff_id);return {r,f,o,c,h};}
function inspect(x,{companyId,userId}={}){
 const base=window.YWI469?.inspect?.(x,{companyId,userId});
 if(base?.state!=='source_verified')return {state:'withheld',reason:base?.reason||'469 owner source unavailable'};
 const asOf=when(x.continuity_as_of),captured=when(x.captured_at);
 if(!Number.isFinite(asOf)||asOf!==captured||!Array.isArray(x.reassessment_aging)||
  x.reassessment_aging.length!==base.reassessments.length||!Array.isArray(x.confirmations)||
  x.confirmation_sample_capped!==false||!Number.isSafeInteger(x.confirmation_total)||
  x.confirmation_total!==x.confirmations.length||x.confirmations.length>60||
  !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions','mutation_authorized','synthetic'].every(k=>x[k]===false))
  return {state:'withheld',reason:'470 documentary continuity or aging projection incomplete or falsely authorizing'};
 const seen=new Set();for(const a of x.reassessment_aging){const owner=base.reassessments.find(o=>o.id===a.reassessment_id),
  days=owner&&Math.max(0,Math.floor((asOf-when(owner.created_at))/86400000));
  if(!owner||seen.has(owner.id)||a.renewal_id!==owner.renewal_id||!Number.isSafeInteger(a.age_days)||
   days!==a.age_days||a.band!==(days>=15?'overdue':days>=8?'aging':'current'))
   return {state:'withheld',reason:'470 server reassessment aging inconsistent'};
  seen.add(owner.id);}
 const signed=new Set();for(const k of x.confirmations){const a=base.reassessments.find(a=>a.id===k.reassessment_id),
  {r,f,o,c,h}=a?lineage(base,a):{},owner=a&&base.cases.find(p=>p.proposal_id===h?.proposal_id);
  if(!uuid(k.id)||!a||!r||!c||!h||!owner||signed.has(a.id)||k.company_id!==companyId||
   k.reviewer_user_id!==r.reviewer_user_id||k.reviewer_user_id!==h.reviewer_user_id||
   k.reviewer_user_id===a.owner_user_id||a.owner_user_id!==f.owner_user_id||
   owner.owner_user_id!==a.owner_user_id||owner.proposed_reviewer_user_id!==k.reviewer_user_id||
   !findings.includes(k.finding)||!ref(k.source_reference)||
   [a.source_reference,r.source_reference,f.source_reference,o.source_reference,c.compared_source_reference,h.source_reference].includes(k.source_reference)||
   !before(a.created_at,k.created_at)||!before(k.created_at,x.captured_at))
   return {state:'withheld',reason:'470 reviewer continuity lineage, source or chronology invalid'};
  signed.add(a.id);}
 return {...base,state:'source_verified',reassessmentAging:x.reassessment_aging,confirmations:x.confirmations,releaseGreen:false};
}
window.YWI470=Object.freeze({inspect,findings});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('continuity470'))return;
 const panel=el('details');panel.id='continuity470';panel.className='admin-hub-detail';panel.dataset.adminHubTitle='PMS · Owner Reassessment Continuity';panel.dataset.adminHubGroups='management operations';
 panel.append(el('summary','470 · Owner Reassessment Aging & Independent Continuity'));
 const body=el('div');body.className='admin-panel-block pms470';
 body.append(el('p','Age genuine owner 469 reassessments against a verified server clock, then allow only the originally assigned separate reviewer to confirm documentary continuity. All real-world work stays on HOLD.'));
 const help=el('a','ⓘ Owner reassessment continuity Help');help.href='/help.html#pms-reassessment-continuity-470';body.append(help);
 const controls=el('div');controls.className='pms470-controls';const label=el('label','Verified owner or separately assigned reviewer company'),company=el('select'),refresh=el('button','Verify owner reassessment continuity');
 company.id='pms470Company';refresh.id='pms470Refresh';refresh.className='secondary';refresh.type='button';label.append(company);controls.append(label,refresh);body.append(controls);
 const status=el('p','HOLD: verify independent renewal and owner reassessment first.');status.id='pms470Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const journal=el('section');journal.id='pms470Journal';body.append(journal);
 const form=el('fieldset');form.id='pms470ReviewerForm';form.disabled=true;form.append(el('legend','Separate assigned reviewer · documentary continuity confirmation'));
 const field=(id,text,tag,max)=>{const l=el('label',text),n=el(tag);n.id=id;if(max)n.maxLength=max;l.append(n);form.append(l);return n;};
 const reassessment=field('pms470Reassessment','Owner reassessment awaiting separate continuity confirmation','select');
 const finding=field('pms470Finding','Independent documentary continuity finding','select');
 for(const v of findings){const o=el('option',v.replaceAll('_',' '));o.value=v;finding.append(o);}
 const source=field('pms470Source','New independent source reference (required)','input',250);
 const notes=field('pms470Notes','Reviewer documentary note (optional)','textarea',500);
 const record=el('button','Record independent continuity confirmation');record.id='pms470Record';record.type='button';record.className='secondary';form.append(record);body.append(form);
 const hold=el('p','HOLD: Age bands, continuity confirmation, reviewer escalation or owner reassessment do not validate field evidence, approve Jobs/Safety, reassign anyone, close the 457 trial, send messages, or authorize Production release.');hold.id='pms470Hold';hold.className='notice';body.append(hold);panel.append(body);host.append(panel);
 let epoch=0,busy=false,verified=null,principal=null;
 const choices=(node,placeholder,rows,show,id)=>{node.replaceChildren();const first=el('option',placeholder);first.value='';node.append(first);for(const row of rows){const o=el('option',show(row));o.value=id(row);node.append(o);}};
 function invalidate(message){epoch++;verified=principal=null;company.replaceChildren();journal.replaceChildren();form.disabled=true;status.textContent=message;}
 function display(d){verified=d;journal.replaceChildren();form.disabled=true;if(d.state!=='source_verified'){status.textContent='WITHHELD: '+d.reason;return;}
  const overdue=d.reassessmentAging.filter(a=>a.band==='overdue').length;
  status.textContent='SOURCE VERIFIED: '+d.reassessments.length+' owner reassessments · '+overdue+' overdue (15+ days) · '+d.confirmations.length+' separate continuity confirmations. Operational HOLD.';
  for(const a of d.reassessments){const age=d.reassessmentAging.find(x=>x.reassessment_id===a.id),k=d.confirmations.find(k=>k.reassessment_id===a.id),entry=el('article');entry.className='pms470-entry';
   entry.append(el('strong',age.band.toUpperCase()+' · '+age.age_days+' full day(s) since owner reassessment'),
    el('p','Owner decision: '+a.decision.replaceAll('_',' ')),el('p','Owner reference: '+a.source_reference),
    el('p',k?'Independent continuity: '+k.finding.replaceAll('_',' ')+' · '+k.source_reference:'Independent confirmation pending; HOLD remains'));
   journal.append(entry);}
  if(!d.reassessments.length)journal.append(el('p','No signed 469 owner reassessments in this company.'));
  const pending=d.isReviewer?d.reassessments.filter(a=>{const {r,h}=lineage(d,a);return r&&h&&r.reviewer_user_id===d.userId&&h.reviewer_user_id===d.userId&&a.owner_user_id!==d.userId&&!d.confirmations.some(k=>k.reassessment_id===a.id);}):[];
  choices(reassessment,'Choose genuine separate owner reassessment',pending,a=>a.decision.replaceAll('_',' ')+' · '+d.reassessmentAging.find(x=>x.reassessment_id===a.id).age_days+' day(s)',a=>a.id);
  form.disabled=!pending.length;}
 async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.rpc||!sb.auth?.getUser||!window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Jobs sign-in required');
  const who=await sb.auth.getUser();if(who.error||who.data?.user?.id!==a.user.id)throw Error('Active account changed');return {uid:a.user.id,sb};}
 async function reconcile(){const ticket=epoch,ctx=await session(),inbox=await ctx.sb.rpc('ywi_rpc_handoff_inbox_465');
  if(ticket!==epoch||inbox.error||window.YWI465?.inspectInbox?.(inbox.data,{userId:ctx.uid})?.state!=='source_verified')throw Error('Company owner/reviewer inbox withheld');
  const selected=company.value;choices(company,'Choose verified company',inbox.data.companies,c=>c.name,c=>c.id);
  if(inbox.data.companies.some(c=>c.id===selected))company.value=selected;else if(inbox.data.companies.length===1)company.value=inbox.data.companies[0].id;
  const id=company.value;if(!id){verified=null;status.textContent='HOLD: select a verified company';return;}
  principal=ctx.uid;const first=await ctx.sb.rpc('ywi_rpc_continuity_workspace_470',{p_company_id:id}),second=await ctx.sb.rpc('ywi_rpc_continuity_workspace_470',{p_company_id:id});
  if(ticket!==epoch||first.error||second.error||!first.data||!second.data||company.value!==id||window.YWI_AUTH?.getState?.()?.user?.id!==ctx.uid||
   ['handoff_source','original_baselines','comparisons','outcomes','followups','renewals','reassessments','aging','renewal_aging','reassessment_aging','confirmations'].some(k=>JSON.stringify(first.data[k])!==JSON.stringify(second.data[k])))
   throw Error('Separate owner/reviewer evidence changed or was denied');
  display(inspect(second.data,{companyId:id,userId:ctx.uid}));}
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=form.disabled=true;
  try{await reconcile();}catch(e){display({state:'withheld',reason:e.message||String(e)});}finally{busy=false;refresh.disabled=company.disabled=false;}});
 record.addEventListener('click',async()=>{const d=verified,id=company.value,a=d?.reassessments.find(a=>a.id===reassessment.value),chain=a&&lineage(d,a),value=source.value.trim(),note=notes.value.trim();
  if(busy||d?.state!=='source_verified'||!d.isReviewer||!a||!chain?.r||!chain.h||chain.r.reviewer_user_id!==d.userId||chain.h.reviewer_user_id!==d.userId||
   a.owner_user_id===d.userId||d.confirmations.some(k=>k.reassessment_id===a.id)||!findings.includes(finding.value)||!ref(value)||
   [a.source_reference,chain.r.source_reference,chain.f.source_reference,chain.o.source_reference,chain.c.compared_source_reference,chain.h.source_reference].includes(value)||note.length>500)
   return status.textContent='WITHHELD: genuine separate-reviewer source and new continuity reference required';
  if(!window.confirm('Record INTERNAL reviewer continuity only? Field and Jobs/Safety acceptance remain on HOLD.'))return;
  busy=true;form.disabled=refresh.disabled=true;
  try{const ctx=await session();if(ctx.uid!==principal||company.value!==id)throw Error('Independent reviewer identity changed');
   const receipt=await ctx.sb.rpc('ywi_rpc_reviewer_confirm_470',{p_company_id:id,p_operation_id:operationId(),p_reassessment_id:a.id,
    p_finding:finding.value,p_source_reference:value,p_notes:note||null});
   if(receipt.error||!uuid(receipt.data?.id)||receipt.data.company_id!==id||receipt.data.recorded!==true||
    !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions'].every(k=>receipt.data[k]===false))
    throw Error('Unverified independent continuity receipt');
   await reconcile();source.value=notes.value='';
  }catch(e){verified=null;status.textContent='WITHHELD: '+(e.message||e)+'. Inspect independent journal before retry.';}
  finally{busy=false;refresh.disabled=false;form.disabled=verified?.state!=='source_verified'||!verified.isReviewer||!verified.reassessments.some(a=>!verified.confirmations.some(k=>k.reassessment_id===a.id));}});
 company.addEventListener('change',()=>{epoch++;verified=null;form.disabled=true;journal.replaceChildren();status.textContent='HOLD: company changed; verify again.';});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])document.addEventListener(event,()=>invalidate('HOLD: reviewer/owner identity, Jobs permission or service changed. Verify again.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

/* YW 469: independently renewed evidence aging and separate owner reassessment; HOLD. */
(()=>{'use strict';
const decisions=Object.freeze(['request_updated_evidence','retain_owner_hold','document_reassessment_path']);
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
function inspect(x,{companyId,userId}={}){
 const base=window.YWI468?.inspect?.(x,{companyId,userId});
 if(base?.state!=='source_verified')return {state:'withheld',reason:base?.reason||'468 source unavailable'};
 const asOf=when(x.renewal_as_of),captured=when(x.captured_at);
 if(!Number.isFinite(asOf)||asOf!==captured||!Array.isArray(x.renewal_aging)||
  x.renewal_aging.length!==base.renewals.length||!Array.isArray(x.reassessments)||
  x.reassessment_sample_capped!==false||!Number.isSafeInteger(x.reassessment_total)||
  x.reassessment_total!==x.reassessments.length||x.reassessments.length>60||
  !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions','mutation_authorized','synthetic'].every(k=>x[k]===false))
  return {state:'withheld',reason:'469 reassessment or aging projection incomplete or falsely authorizing'};
 const aging=new Set();for(const a of x.renewal_aging){const r=base.renewals.find(r=>r.id===a.renewal_id),
  days=r&&Math.max(0,Math.floor((asOf-when(r.created_at))/86400000));
  if(!r||aging.has(r.id)||a.followup_id!==r.followup_id||!Number.isSafeInteger(a.age_days)||a.age_days!==days||
   a.band!==(days>=15?'overdue':days>=8?'aging':'current'))
   return {state:'withheld',reason:'469 server renewal aging inconsistent'};
  aging.add(r.id);}
 const reassessed=new Set();for(const a of x.reassessments){const r=base.renewals.find(r=>r.id===a.renewal_id),
  f=r&&base.followups.find(f=>f.id===r.followup_id),o=f&&base.outcomes.find(o=>o.id===f.outcome_id),
  c=o&&base.comparisons.find(c=>c.id===o.comparison_id);
  if(!uuid(a.id)||!r||!f||!c||reassessed.has(r.id)||a.company_id!==companyId||
   a.owner_user_id!==f.owner_user_id||a.owner_user_id===r.reviewer_user_id||
   !decisions.includes(a.decision)||!ref(a.source_reference)||
   [r.source_reference,f.source_reference,o.source_reference,c.compared_source_reference].includes(a.source_reference)||
   !before(r.created_at,a.created_at)||!before(a.created_at,x.captured_at))
   return {state:'withheld',reason:'469 owner reassessment lineage or chronology invalid'};
  reassessed.add(r.id);}
 return {...base,state:'source_verified',renewalAging:x.renewal_aging,reassessments:x.reassessments,releaseGreen:false};
}
window.YWI469=Object.freeze({inspect,decisions});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('reassessment469'))return;
 const panel=el('details');panel.id='reassessment469';panel.className='admin-hub-detail';panel.dataset.adminHubTitle='PMS · Independent Renewal Reassessment';panel.dataset.adminHubGroups='management operations';
 panel.append(el('summary','469 · Renewal Outcome Aging & Owner Reassessment'));
 const body=el('div');body.className='admin-panel-block pms469';
 body.append(el('p','Review how long an independently signed 468 documentary renewal has awaited owner attention. An authorized company owner may append one source-linked reassessment. Operational acceptance remains on HOLD.'));
 const help=el('a','ⓘ Renewal aging and owner reassessment Help');help.href='/help.html#pms-renewal-reassessment-469';body.append(help);
 const controls=el('div');controls.className='pms469-controls';const label=el('label','Verified owner or assigned reviewer company'),company=el('select'),refresh=el('button','Verify independent renewal chain');
 company.id='pms469Company';refresh.id='pms469Refresh';refresh.className='secondary';refresh.type='button';label.append(company);controls.append(label,refresh);body.append(controls);
 const status=el('p','HOLD: verify reviewer renewal and original owner source.');status.id='pms469Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const journal=el('section');journal.id='pms469Journal';body.append(journal);
 const form=el('fieldset');form.id='pms469OwnerForm';form.disabled=true;form.append(el('legend','Company owner · documentary reassessment after separate reviewer renewal'));
 const field=(id,text,tag,max)=>{const l=el('label',text),n=el(tag);n.id=id;if(max)n.maxLength=max;l.append(n);form.append(l);return n;};
 const renewal=field('pms469Renewal','Independent renewal awaiting owner reassessment','select');
 const decision=field('pms469Decision','Owner documentary reassessment decision','select');for(const d of decisions){const o=el('option',d.replaceAll('_',' '));o.value=d;decision.append(o);}
 const source=field('pms469Source','New owner reassessment source reference (required)','input',250);
 const notes=field('pms469Notes','Owner documentary note (optional)','textarea',500);
 const record=el('button','Record owner documentary reassessment');record.id='pms469Record';record.type='button';record.className='secondary';form.append(record);body.append(form);
 const hold=el('p','HOLD: A renewed reference, aging warning, owner reassessment or recommended escalation does not accept real field evidence, approve Jobs/Safety, reassign a reviewer, close the 457 trial, send notifications, or grant Production release.');hold.id='pms469Hold';hold.className='notice';body.append(hold);panel.append(body);host.append(panel);
 let epoch=0,busy=false,verified=null,principal=null;
 const choices=(node,placeholder,rows,show,id)=>{node.replaceChildren();const first=el('option',placeholder);first.value='';node.append(first);for(const row of rows){const o=el('option',show(row));o.value=id(row);node.append(o);}};
 function invalidate(message){epoch++;verified=principal=null;company.replaceChildren();journal.replaceChildren();form.disabled=true;status.textContent=message;}
 function display(d){verified=d;journal.replaceChildren();form.disabled=true;if(d.state!=='source_verified'){status.textContent='WITHHELD: '+d.reason;return;}
  const overdue=d.renewalAging.filter(a=>a.band==='overdue').length;
  status.textContent='SOURCE VERIFIED: '+d.renewals.length+' independent renewals · '+overdue+' overdue (15+ days) · '+d.reassessments.length+' owner reassessments. Operational HOLD.';
  for(const r of d.renewals){const a=d.renewalAging.find(a=>a.renewal_id===r.id),o=d.reassessments.find(o=>o.renewal_id===r.id),entry=el('article');entry.className='pms469-entry';
   entry.append(el('strong',a.band.toUpperCase()+' · '+a.age_days+' full day(s) since independent renewal'),
    el('p','Reviewer finding: '+r.decision.replaceAll('_',' ')),el('p','Independent reference: '+r.source_reference),
    el('p',o?'Owner reassessment: '+o.decision.replaceAll('_',' ')+' · '+o.source_reference:'Owner reassessment pending; HOLD remains'));
   journal.append(entry);}
  if(!d.renewals.length)journal.append(el('p','No 468 independent renewal records for this company.'));
  const pending=d.isOwner?d.renewals.filter(r=>!d.reassessments.some(o=>o.renewal_id===r.id)&&d.followups.some(f=>f.id===r.followup_id&&f.owner_user_id===d.userId&&r.reviewer_user_id!==d.userId)):[];
  choices(renewal,'Choose genuine separate-reviewer renewal',pending,r=>r.decision.replaceAll('_',' ')+' · '+d.renewalAging.find(a=>a.renewal_id===r.id).age_days+' day(s)',r=>r.id);
  form.disabled=!pending.length;
 }
 async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.rpc||!sb.auth?.getUser||!window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Jobs sign-in required');
  const who=await sb.auth.getUser();if(who.error||who.data?.user?.id!==a.user.id)throw Error('Active account changed');return {uid:a.user.id,sb};}
 async function reconcile(){const ticket=epoch,ctx=await session(),inbox=await ctx.sb.rpc('ywi_rpc_handoff_inbox_465');
  if(ticket!==epoch||inbox.error||window.YWI465?.inspectInbox?.(inbox.data,{userId:ctx.uid})?.state!=='source_verified')throw Error('Owner/reviewer company inbox withheld');
  const selected=company.value;choices(company,'Choose verified company',inbox.data.companies,c=>c.name,c=>c.id);
  if(inbox.data.companies.some(c=>c.id===selected))company.value=selected;else if(inbox.data.companies.length===1)company.value=inbox.data.companies[0].id;
  const id=company.value;if(!id){verified=null;status.textContent='HOLD: select a verified company';return;}
  principal=ctx.uid;const first=await ctx.sb.rpc('ywi_rpc_reassessment_workspace_469',{p_company_id:id}),second=await ctx.sb.rpc('ywi_rpc_reassessment_workspace_469',{p_company_id:id});
  if(ticket!==epoch||first.error||second.error||!first.data||!second.data||company.value!==id||window.YWI_AUTH?.getState?.()?.user?.id!==ctx.uid||
   ['handoff_source','original_baselines','comparisons','outcomes','followups','renewals','aging','renewal_aging','reassessments'].some(k=>JSON.stringify(first.data[k])!==JSON.stringify(second.data[k])))
   throw Error('Independent renewal or reassessment source changed or was denied');
  display(inspect(second.data,{companyId:id,userId:ctx.uid}));}
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=form.disabled=true;
  try{await reconcile();}catch(e){display({state:'withheld',reason:e.message||String(e)});}finally{busy=false;refresh.disabled=company.disabled=false;}});
 record.addEventListener('click',async()=>{const d=verified,id=company.value,r=d?.renewals.find(r=>r.id===renewal.value),f=r&&d.followups.find(f=>f.id===r.followup_id),
  o=f&&d.outcomes.find(o=>o.id===f.outcome_id),c=o&&d.comparisons.find(c=>c.id===o.comparison_id),value=source.value.trim(),note=notes.value.trim();
  if(busy||d?.state!=='source_verified'||!d.isOwner||!r||!f||!c||f.owner_user_id!==d.userId||r.reviewer_user_id===d.userId||
   d.reassessments.some(o=>o.renewal_id===r.id)||!decisions.includes(decision.value)||!ref(value)||
   [r.source_reference,f.source_reference,o.source_reference,c.compared_source_reference].includes(value)||note.length>500)
   return status.textContent='WITHHELD: independent renewal and distinct owner reassessment source required';
  if(!window.confirm('Record INTERNAL owner documentary reassessment only? Field and Jobs/Safety approval remain on HOLD.'))return;
  busy=true;form.disabled=refresh.disabled=true;
  try{const ctx=await session();if(ctx.uid!==principal||company.value!==id)throw Error('Company owner identity changed');
   const receipt=await ctx.sb.rpc('ywi_rpc_owner_reassess_469',{p_company_id:id,p_operation_id:operationId(),
    p_renewal_id:r.id,p_decision:decision.value,p_source_reference:value,p_notes:note||null});
   if(receipt.error||!uuid(receipt.data?.id)||receipt.data.company_id!==id||receipt.data.recorded!==true||
    !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions'].every(k=>receipt.data[k]===false))
    throw Error('Unverified documentary owner reassessment receipt');
   await reconcile();source.value=notes.value='';
  }catch(e){verified=null;status.textContent='WITHHELD: '+(e.message||e)+'. Inspect journal before retry.';}
  finally{busy=false;refresh.disabled=false;form.disabled=verified?.state!=='source_verified'||!verified.isOwner||!verified.renewals.some(r=>!verified.reassessments.some(a=>a.renewal_id===r.id));}});
 company.addEventListener('change',()=>{epoch++;verified=null;form.disabled=true;journal.replaceChildren();status.textContent='HOLD: company changed; verify again.';});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])document.addEventListener(event,()=>invalidate('HOLD: owner/reviewer, Jobs permission or company service changed. Verify again.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

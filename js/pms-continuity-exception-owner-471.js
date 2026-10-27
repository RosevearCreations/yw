/* YW 471: independent continuity exception aging and owner source renewal; HOLD. */
(()=>{'use strict';
const exceptionFindings=Object.freeze(['request_source_clarification','recommend_owner_followup']);
const decisions=Object.freeze(['record_new_owner_evidence','request_independent_recheck','retain_exception_hold']);
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
function lineage(base,k){const a=base.reassessments.find(a=>a.id===k.reassessment_id),
 r=a&&base.renewals.find(r=>r.id===a.renewal_id),f=r&&base.followups.find(f=>f.id===r.followup_id),
 o=f&&base.outcomes.find(o=>o.id===f.outcome_id),c=o&&base.comparisons.find(c=>c.id===o.comparison_id),
 h=c&&base.handoffs.find(h=>h.id===c.handoff_id);return {a,r,f,o,c,h};}
function inspect(x,{companyId,userId}={}){
 const base=window.YWI470?.inspect?.(x,{companyId,userId});
 if(base?.state!=='source_verified')return {state:'withheld',reason:base?.reason||'470 independent source unavailable'};
 const asOf=when(x.exception_as_of),captured=when(x.captured_at),exceptions=base.confirmations.filter(k=>exceptionFindings.includes(k.finding));
 if(!Number.isFinite(asOf)||asOf!==captured||!Array.isArray(x.exception_aging)||
  x.exception_total!==exceptions.length||x.exception_aging.length!==exceptions.length||
  !Array.isArray(x.owner_renewals)||x.owner_renewal_sample_capped!==false||
  !Number.isSafeInteger(x.owner_renewal_total)||x.owner_renewal_total!==x.owner_renewals.length||x.owner_renewals.length>60||
  !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions','mutation_authorized','synthetic'].every(k=>x[k]===false))
  return {state:'withheld',reason:'471 exception aging or owner evidence projection incomplete or falsely authorizing'};
 const agingIds=new Set();for(const a of x.exception_aging){const k=exceptions.find(k=>k.id===a.confirmation_id),
  days=k&&Math.max(0,Math.floor((asOf-when(k.created_at))/86400000));
  if(!k||agingIds.has(k.id)||a.reassessment_id!==k.reassessment_id||!Number.isSafeInteger(a.age_days)||
   a.age_days!==days||a.band!==(days>=15?'overdue':days>=8?'aging':'current'))
   return {state:'withheld',reason:'471 server independent exception aging inconsistent'};
  agingIds.add(k.id);}
 const renewed=new Set();for(const v of x.owner_renewals){const k=exceptions.find(k=>k.id===v.confirmation_id),
  {a,r,f,o,c,h}=k?lineage(base,k):{},original=k&&base.cases.find(p=>p.proposal_id===h?.proposal_id);
  if(!uuid(v.id)||!k||!a||!r||!f||!c||!h||!original||renewed.has(k.id)||v.company_id!==companyId||
   v.owner_user_id!==a.owner_user_id||v.owner_user_id!==f.owner_user_id||v.owner_user_id===k.reviewer_user_id||
   k.reviewer_user_id!==r.reviewer_user_id||k.reviewer_user_id!==h.reviewer_user_id||
   original.owner_user_id!==v.owner_user_id||original.proposed_reviewer_user_id!==k.reviewer_user_id||
   !decisions.includes(v.decision)||!ref(v.source_reference)||
   [k.source_reference,a.source_reference,r.source_reference,f.source_reference,o.source_reference,c.compared_source_reference,h.source_reference].includes(v.source_reference)||
   !before(k.created_at,v.created_at)||!before(v.created_at,x.captured_at))
   return {state:'withheld',reason:'471 owner renewal signer, source, chronology or reviewer lineage invalid'};
  renewed.add(k.id);}
 return {...base,state:'source_verified',exceptionAging:x.exception_aging,exceptions,ownerRenewals:x.owner_renewals,releaseGreen:false};
}
window.YWI471=Object.freeze({inspect,decisions,exceptionFindings});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('exception471'))return;
 const panel=el('details');panel.id='exception471';panel.className='admin-hub-detail';panel.dataset.adminHubTitle='PMS · Independent Continuity Exception Aging';panel.dataset.adminHubGroups='management operations';
 panel.append(el('summary','471 · Continuity Exception Aging & Owner Evidence Renewal'));
 const body=el('div');body.className='admin-panel-block pms471';
 body.append(el('p','Age genuine separate-reviewer continuity exceptions and let the verified company owner append one new documentary source. This does not recheck real work or approve Jobs/Safety.'));
 const help=el('a','ⓘ Continuity exception and integration Help');help.href='/help.html#pms-continuity-exception-471';body.append(help);
 const controls=el('div');controls.className='pms471-controls';const label=el('label','Verified company owner or assigned reviewer company'),company=el('select'),refresh=el('button','Verify independent continuity exceptions');
 company.id='pms471Company';refresh.id='pms471Refresh';refresh.className='secondary';refresh.type='button';label.append(company);controls.append(label,refresh);body.append(controls);
 const status=el('p','HOLD: verify signed 470 continuity exceptions.');status.id='pms471Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const journal=el('section');journal.id='pms471Journal';body.append(journal);
 const form=el('fieldset');form.id='pms471OwnerForm';form.disabled=true;form.append(el('legend','Company owner · documentary exception evidence renewal'));
 const field=(id,text,tag,max)=>{const l=el('label',text),n=el(tag);n.id=id;if(max)n.maxLength=max;l.append(n);form.append(l);return n;};
 const exception=field('pms471Exception','Independent reviewer exception needing owner follow-up','select');
 const decision=field('pms471Decision','Owner documentary evidence-renewal decision','select');
 for(const v of decisions){const o=el('option',v.replaceAll('_',' '));o.value=v;decision.append(o);}
 const source=field('pms471Source','New owner documentary source reference (required)','input',250);
 const notes=field('pms471Notes','Owner note (optional)','textarea',500);
 const record=el('button','Record owner documentary evidence renewal');record.id='pms471Record';record.type='button';record.className='secondary';form.append(record);body.append(form);
 const hold=el('p','HOLD: An overdue reviewer exception, source renewal, recheck request or integration health status does not accept field evidence, clear Jobs/Safety, reassign reviewers, dispatch work, send messages, close the 457 trial or authorize Production release.');hold.id='pms471Hold';hold.className='notice';body.append(hold);panel.append(body);host.append(panel);
 let epoch=0,busy=false,verified=null,principal=null;
 const choices=(node,placeholder,rows,show,id)=>{node.replaceChildren();const first=el('option',placeholder);first.value='';node.append(first);for(const row of rows){const o=el('option',show(row));o.value=id(row);node.append(o);}};
 function invalidate(message){epoch++;verified=principal=null;company.replaceChildren();journal.replaceChildren();form.disabled=true;status.textContent=message;}
 function display(d){verified=d;journal.replaceChildren();form.disabled=true;if(d.state!=='source_verified'){status.textContent='WITHHELD: '+d.reason;return;}
  const overdue=d.exceptionAging.filter(a=>a.band==='overdue').length;
  status.textContent='SOURCE VERIFIED: '+d.exceptions.length+' independent exceptions · '+overdue+' overdue (15+ days) · '+d.ownerRenewals.length+' owner renewals. Operational HOLD.';
  for(const k of d.exceptions){const age=d.exceptionAging.find(a=>a.confirmation_id===k.id),v=d.ownerRenewals.find(v=>v.confirmation_id===k.id),entry=el('article');entry.className='pms471-entry';
   entry.append(el('strong',age.band.toUpperCase()+' · '+age.age_days+' full day(s) since reviewer exception'),
    el('p','Independent finding: '+k.finding.replaceAll('_',' ')),el('p','Reviewer source: '+k.source_reference),
    el('p',v?'Owner source renewal: '+v.decision.replaceAll('_',' ')+' · '+v.source_reference:'Owner documentary follow-up pending; HOLD remains'));
   journal.append(entry);}
  if(!d.exceptions.length)journal.append(el('p','No genuine 470 continuity exceptions for this company. HOLD-only confirmations are not exceptions.'));
  const pending=d.isOwner?d.exceptions.filter(k=>!d.ownerRenewals.some(v=>v.confirmation_id===k.id)&&lineage(d,k).a?.owner_user_id===d.userId&&k.reviewer_user_id!==d.userId):[];
  choices(exception,'Choose genuine independent reviewer exception',pending,k=>k.finding.replaceAll('_',' ')+' · '+d.exceptionAging.find(a=>a.confirmation_id===k.id).age_days+' day(s)',k=>k.id);
  form.disabled=!pending.length;}
 async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.rpc||!sb.auth?.getUser||!window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Jobs sign-in required');
  const who=await sb.auth.getUser();if(who.error||who.data?.user?.id!==a.user.id)throw Error('Active account changed');return {uid:a.user.id,sb};}
 async function reconcile(){const ticket=epoch,ctx=await session(),inbox=await ctx.sb.rpc('ywi_rpc_handoff_inbox_465');
  if(ticket!==epoch||inbox.error||window.YWI465?.inspectInbox?.(inbox.data,{userId:ctx.uid})?.state!=='source_verified')throw Error('Company source inbox withheld');
  const selected=company.value;choices(company,'Choose verified company',inbox.data.companies,c=>c.name,c=>c.id);
  if(inbox.data.companies.some(c=>c.id===selected))company.value=selected;else if(inbox.data.companies.length===1)company.value=inbox.data.companies[0].id;
  const id=company.value;if(!id){verified=null;status.textContent='HOLD: select a verified company';return;}
  principal=ctx.uid;const first=await ctx.sb.rpc('ywi_rpc_exception_workspace_471',{p_company_id:id}),second=await ctx.sb.rpc('ywi_rpc_exception_workspace_471',{p_company_id:id});
  if(ticket!==epoch||first.error||second.error||!first.data||!second.data||company.value!==id||window.YWI_AUTH?.getState?.()?.user?.id!==ctx.uid||
   ['handoff_source','original_baselines','comparisons','outcomes','followups','renewals','reassessments','confirmations','aging','renewal_aging','reassessment_aging','exception_aging','owner_renewals'].some(k=>JSON.stringify(first.data[k])!==JSON.stringify(second.data[k])))
   throw Error('Independent exception source changed, truncated or was denied');
  display(inspect(second.data,{companyId:id,userId:ctx.uid}));}
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=form.disabled=true;
  try{await reconcile();}catch(e){display({state:'withheld',reason:e.message||String(e)});}finally{busy=false;refresh.disabled=company.disabled=false;}});
 record.addEventListener('click',async()=>{const d=verified,id=company.value,k=d?.exceptions.find(k=>k.id===exception.value),chain=k&&lineage(d,k),value=source.value.trim(),note=notes.value.trim();
  if(busy||d?.state!=='source_verified'||!d.isOwner||!k||!chain?.a||!chain.r||!chain.h||!chain.f||!chain.o||!chain.c||
   chain.a.owner_user_id!==d.userId||k.reviewer_user_id===d.userId||k.reviewer_user_id!==chain.r.reviewer_user_id||
   d.ownerRenewals.some(v=>v.confirmation_id===k.id)||!decisions.includes(decision.value)||!ref(value)||
   [k.source_reference,chain.a.source_reference,chain.r.source_reference,chain.f.source_reference,chain.o.source_reference,chain.c.compared_source_reference,chain.h.source_reference].includes(value)||note.length>500)
   return status.textContent='WITHHELD: independent exception and distinct owner documentary source required';
  if(!window.confirm('Record INTERNAL owner documentary evidence renewal only? Jobs/Safety and field acceptance remain on HOLD.'))return;
  busy=true;form.disabled=refresh.disabled=true;
  try{const ctx=await session();if(ctx.uid!==principal||company.value!==id)throw Error('Company owner identity changed');
   const receipt=await ctx.sb.rpc('ywi_rpc_owner_followup_471',{p_company_id:id,p_operation_id:operationId(),p_confirmation_id:k.id,
    p_decision:decision.value,p_source_reference:value,p_notes:note||null});
   if(receipt.error||!uuid(receipt.data?.id)||receipt.data.company_id!==id||receipt.data.recorded!==true||
    !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions'].every(k=>receipt.data[k]===false))
    throw Error('Unverified owner documentary renewal receipt');
   await reconcile();source.value=notes.value='';
  }catch(e){verified=null;status.textContent='WITHHELD: '+(e.message||e)+'. Recheck the evidence journal before retry.';}
  finally{busy=false;refresh.disabled=false;form.disabled=verified?.state!=='source_verified'||!verified.isOwner||!verified.exceptions.some(k=>!verified.ownerRenewals.some(v=>v.confirmation_id===k.id));}});
 company.addEventListener('change',()=>{epoch++;verified=null;form.disabled=true;journal.replaceChildren();status.textContent='HOLD: company changed; verify again.';});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])document.addEventListener(event,()=>invalidate('HOLD: owner/reviewer, Jobs permission or service changed. Verify again.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

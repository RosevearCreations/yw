/* YW 468: server-clock aging + assigned independent reviewer documentary renewal; HOLD. */
(()=>{'use strict';
const decisions=Object.freeze(['refreshed_reference_needs_owner_review','evidence_still_insufficient','independent_escalation_recommended']);
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
 const base=window.YWI467?.inspect?.(x,{companyId,userId});
 if(base?.state!=='source_verified')return {state:'withheld',reason:base?.reason||'467 source unavailable'};
 const asOf=when(x.aging_as_of),captured=when(x.captured_at);
 if(!Number.isFinite(asOf)||asOf!==captured||!Array.isArray(x.aging)||x.aging.length!==base.followups.length||
  !Array.isArray(x.renewals)||x.renewal_sample_capped!==false||!Number.isSafeInteger(x.renewal_total)||
  x.renewal_total!==x.renewals.length||x.renewals.length>60||
  !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions','mutation_authorized','synthetic'].every(k=>x[k]===false))
  return {state:'withheld',reason:'468 aging or renewal projection incomplete or falsely authorizing'};
 const aging=new Map();
 for(const a of x.aging){const f=base.followups.find(f=>f.id===a.followup_id),days=f&&Math.max(0,Math.floor((asOf-when(f.created_at))/86400000));
  if(!f||aging.has(f.id)||a.outcome_id!==f.outcome_id||!Number.isSafeInteger(a.age_days)||a.age_days!==days||
   a.band!==(days>=15?'overdue':days>=8?'aging':'current'))
   return {state:'withheld',reason:'468 server follow-up aging inconsistent'};
  aging.set(f.id,a);}
 const renewals=new Map();
 for(const r of x.renewals){const f=base.followups.find(f=>f.id===r.followup_id),o=f&&base.outcomes.find(o=>o.id===f.outcome_id),
  c=o&&base.comparisons.find(c=>c.id===o.comparison_id);
  if(!uuid(r.id)||!f||!c||renewals.has(f.id)||r.company_id!==companyId||
   r.reviewer_user_id!==c.reviewer_user_id||r.reviewer_user_id===f.owner_user_id||
   !decisions.includes(r.decision)||!ref(r.source_reference)||
   [f.source_reference,o.source_reference,c.compared_source_reference].includes(r.source_reference)||
   !before(f.created_at,r.created_at)||!before(r.created_at,x.captured_at))
   return {state:'withheld',reason:'468 independent renewal or chronology invalid'};
  renewals.set(f.id,r);}
 return {...base,state:'source_verified',aging:x.aging,renewals:x.renewals,agingAsOf:x.aging_as_of,releaseGreen:false};
}
window.YWI468=Object.freeze({inspect,decisions});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('renewal468'))return;
 const panel=el('details');panel.id='renewal468';panel.className='admin-hub-detail';panel.dataset.adminHubTitle='PMS · Documentary Aging & Renewal';panel.dataset.adminHubGroups='management operations';
 panel.append(el('summary','468 · Follow-Up Aging & Independent Evidence Renewal'));
 const body=el('div');body.className='admin-panel-block pms468';
 body.append(el('p','Age unresolved owner follow-ups against a verified server timestamp. Only the originally assigned separate reviewer may record a new documentary reference. Every outcome stays on HOLD.'));
 const help=el('a','ⓘ Follow-up aging and renewal Help');help.href='/help.html#pms-followup-renewal-468';body.append(help);
 const controls=el('div');controls.className='pms468-controls';const label=el('label','Verified owner/reviewer company'),company=el('select'),refresh=el('button','Verify aging and reviewer evidence');
 company.id='pms468Company';refresh.id='pms468Refresh';refresh.className='secondary';refresh.type='button';label.append(company);controls.append(label,refresh);body.append(controls);
 const status=el('p','HOLD: verify original comparison and 467 follow-up first.');status.id='pms468Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const journal=el('section');journal.id='pms468Journal';body.append(journal);
 const form=el('fieldset');form.id='pms468ReviewerForm';form.disabled=true;form.append(el('legend','Assigned independent reviewer · documentary evidence renewal'));
 const field=(id,text,tag,max)=>{const l=el('label',text),n=el(tag);n.id=id;if(max)n.maxLength=max;l.append(n);form.append(l);return n;};
 const followup=field('pms468Followup','Owner follow-up awaiting your separate review','select');
 const decision=field('pms468Decision','Independent evidence-renewal decision','select');for(const d of decisions){const o=el('option',d.replaceAll('_',' '));o.value=d;decision.append(o);}
 const source=field('pms468Source','New distinct documentary reference (required)','input',250);
 const notes=field('pms468Notes','Independent reviewer note (optional)','textarea',500);
 const record=el('button','Record independent documentary renewal');record.id='pms468Record';record.type='button';record.className='secondary';form.append(record);body.append(form);
 const hold=el('p','HOLD: A renewed reference, overdue age, reviewer escalation, owner documentary closeout or evidence-insufficient decision does not approve Jobs/Safety, accept field evidence, perform reviewer reassignment, close the 457 trial, notify anyone, or turn Production GREEN.');hold.id='pms468Hold';hold.className='notice';body.append(hold);
 panel.append(body);host.append(panel);
 let epoch=0,busy=false,verified=null,principal=null;
 const choices=(node,placeholder,rows,show,id)=>{node.replaceChildren();const first=el('option',placeholder);first.value='';node.append(first);for(const row of rows){const o=el('option',show(row));o.value=id(row);node.append(o);}};
 function invalidate(message){epoch++;verified=principal=null;company.replaceChildren();journal.replaceChildren();form.disabled=true;status.textContent=message;}
 function display(d){verified=d;journal.replaceChildren();form.disabled=true;if(d.state!=='source_verified'){status.textContent='WITHHELD: '+d.reason;return;}
  const overdue=d.aging.filter(a=>a.band==='overdue').length;
  status.textContent='SOURCE VERIFIED: '+d.aging.length+' follow-ups · '+overdue+' overdue (15+ days) · '+d.renewals.length+' independent renewals. Operational HOLD.';
  for(const f of d.followups){const a=d.aging.find(a=>a.followup_id===f.id),r=d.renewals.find(r=>r.followup_id===f.id),entry=el('article');entry.className='pms468-entry';
   entry.append(el('strong',a.band.toUpperCase()+' · '+a.age_days+' full day(s) since owner follow-up'),el('p','Owner decision: '+f.decision.replaceAll('_',' ')),
    el('p','Recorded source: '+f.source_reference),el('p',r?'Independent review: '+r.decision.replaceAll('_',' ')+' · '+r.source_reference:'Independent renewal pending; HOLD remains'));
   journal.append(entry);}
  if(!d.followups.length)journal.append(el('p','No documented 467 owner exception follow-ups for this company.'));
  const pending=d.isReviewer?d.followups.filter(f=>!d.renewals.some(r=>r.followup_id===f.id)&&d.outcomes.some(o=>o.id===f.outcome_id&&d.comparisons.some(c=>c.id===o.comparison_id&&c.reviewer_user_id===d.userId))):[];
  choices(followup,'Choose a verified follow-up',pending,f=>f.decision.replaceAll('_',' ')+' · '+d.aging.find(a=>a.followup_id===f.id).age_days+' day(s)',f=>f.id);
  form.disabled=!pending.length;
 }
 async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.rpc||!sb.auth?.getUser||!window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Jobs sign-in required');
  const who=await sb.auth.getUser();if(who.error||who.data?.user?.id!==a.user.id)throw Error('Active account changed');return {uid:a.user.id,sb};}
 async function reconcile(){const ticket=epoch,ctx=await session(),inbox=await ctx.sb.rpc('ywi_rpc_handoff_inbox_465');
  if(ticket!==epoch||inbox.error||window.YWI465?.inspectInbox?.(inbox.data,{userId:ctx.uid})?.state!=='source_verified')throw Error('Company inbox source withheld');
  const selected=company.value;choices(company,'Choose verified company',inbox.data.companies,c=>c.name,c=>c.id);
  if(inbox.data.companies.some(c=>c.id===selected))company.value=selected;else if(inbox.data.companies.length===1)company.value=inbox.data.companies[0].id;
  const id=company.value;if(!id){verified=null;status.textContent='HOLD: select a verified company';return;}
  principal=ctx.uid;const first=await ctx.sb.rpc('ywi_rpc_renewal_workspace_468',{p_company_id:id}),second=await ctx.sb.rpc('ywi_rpc_renewal_workspace_468',{p_company_id:id});
  if(ticket!==epoch||first.error||second.error||!first.data||!second.data||company.value!==id||window.YWI_AUTH?.getState?.()?.user?.id!==ctx.uid||
   ['handoff_source','original_baselines','comparisons','outcomes','followups','renewals','aging'].some(k=>JSON.stringify(first.data[k])!==JSON.stringify(second.data[k])))
    throw Error('Aging or renewal sources changed or were denied');
  display(inspect(second.data,{companyId:id,userId:ctx.uid}));}
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=form.disabled=true;
  try{await reconcile();}catch(e){display({state:'withheld',reason:e.message||String(e)});}finally{busy=false;refresh.disabled=company.disabled=false;}});
 record.addEventListener('click',async()=>{const d=verified,id=company.value,f=d?.followups.find(f=>f.id===followup.value),o=f&&d.outcomes.find(o=>o.id===f.outcome_id),
  c=o&&d.comparisons.find(c=>c.id===o.comparison_id),value=source.value.trim(),note=notes.value.trim();
  if(busy||d?.state!=='source_verified'||!d.isReviewer||!f||!c||c.reviewer_user_id!==d.userId||f.owner_user_id===d.userId||
   d.renewals.some(r=>r.followup_id===f.id)||!decisions.includes(decision.value)||!ref(value)||
   [f.source_reference,o.source_reference,c.compared_source_reference].includes(value)||note.length>500)
   return status.textContent='WITHHELD: genuine new source and separate assigned reviewer required';
  if(!window.confirm('Record an INTERNAL independent documentary renewal? Field and Jobs/Safety approval remain on HOLD.'))return;
  busy=true;form.disabled=refresh.disabled=true;
  try{const ctx=await session();if(ctx.uid!==principal||id!==company.value)throw Error('Independent reviewer changed');
   const receipt=await ctx.sb.rpc('ywi_rpc_review_followup_468',{p_company_id:id,p_operation_id:operationId(),
    p_followup_id:f.id,p_decision:decision.value,p_source_reference:value,p_notes:note||null});
   if(receipt.error||!uuid(receipt.data?.id)||receipt.data.company_id!==id||receipt.data.recorded!==true||
    !['field_accepted','service_authorized','independent_reapproval','reassignment_executed','release_green','outbound_actions'].every(k=>receipt.data[k]===false))
    throw Error('Unverified independent renewal receipt');
   await reconcile();source.value=notes.value='';
  }catch(e){verified=null;status.textContent='WITHHELD: '+(e.message||e)+'. Inspect journal before retry.';}
  finally{busy=false;refresh.disabled=false;form.disabled=verified?.state!=='source_verified'||!verified.isReviewer||!verified.followups.some(f=>!verified.renewals.some(r=>r.followup_id===f.id));}});
 company.addEventListener('change',()=>{epoch++;verified=null;form.disabled=true;journal.replaceChildren();status.textContent='HOLD: company changed; verify again.';});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])document.addEventListener(event,()=>invalidate('HOLD: sign-in, Jobs permission or company service changed. Verify again.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

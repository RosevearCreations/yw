/* YW 462: owner documentary follow-up; source-linked readiness is not approval. */
(()=>{'use strict';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const node=(tag,value)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=value;return e;};
const outcomes=['evidence_received','clarification_pending','continued_hold'];
function operationId(){const c=globalThis.crypto;if(c?.randomUUID)return c.randomUUID();if(!c?.getRandomValues)throw Error('Secure operation ID unavailable');
 const b=c.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const s=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');}
function inspect(base,ledger,{companyId,userId}={}){
 const prior=window.YWI461?.inspect(base,{companyId,userId});
 if(prior?.state!=='source_verified'||ledger?.company_id!==companyId||ledger.viewer_id!==userId||ledger.is_owner!==true||
 !Number.isFinite(Date.parse(ledger.captured_at))||Date.now()-Date.parse(ledger.captured_at)>300000||Date.parse(ledger.captured_at)>Date.now()+60000||
 !Array.isArray(ledger.outcomes)||ledger.outcomes.length>60||ledger.total!==ledger.outcomes.length||ledger.sample_capped!==false||
 !['field_accepted','service_authorized','independent_reapproval','release_green','outbound_actions','mutation_authorized'].every(k=>ledger[k]===false))
 return {state:'withheld',reason:'Owner or outcome source not verified'};
 const seen=new Set();for(const o of ledger.outcomes){const request=prior.requests.find(r=>r.id===o.request_id);
  if(!uuid(o.id)||seen.has(o.id)||!request||o.company_id!==companyId||o.owner_user_id!==userId||
  !outcomes.includes(o.outcome)||typeof o.source_reference!=='string'||o.source_reference.trim().length<4||
  o.source_reference.length>250||!Number.isFinite(Date.parse(o.created_at))||
  Date.parse(o.created_at)<Date.parse(request.created_at)||Date.parse(o.created_at)>Date.parse(ledger.captured_at)+60000)
  return {state:'withheld',reason:'Unlinked or incoherent outcome journal'};
  seen.add(o.id);
 }
 const rows=prior.requests.map(r=>{const finding=prior.reassessments.find(x=>x.reassessment_id===r.reassessment_id);
  const outcome=ledger.outcomes.find(o=>o.request_id===r.id);
  const enabled=prior.services.some(s=>s.module_key===finding.service_module_key&&s.enabled);
  return {request:r,finding,outcome,enabled,readiness:outcome?.outcome==='evidence_received'&&enabled?'documentary_handoff_ready':'hold'};});
 return {state:'source_verified',rows,companyId,userId,releaseGreen:false};
}
window.YWI462=Object.freeze({inspect,outcomes});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('evidence462'))return;
 const panel=node('details');panel.id='evidence462';panel.className='admin-hub-detail';panel.dataset.adminHubTitle='PMS · Owner Evidence Outcomes';panel.dataset.adminHubGroups='management operations';
 panel.append(node('summary','462 · Evidence Follow-Up Outcomes & Recheck Readiness'));
 const body=node('div');body.className='admin-panel-block pms462';body.append(node('p','Owner documentary outcomes only. “Handoff ready” means a reference was logged for independent examination; it does not prove evidence quality, resolve a discrepancy, dispatch a reviewer or authorize work.'));
 const help=node('a','ⓘ Evidence outcomes Help');help.href='/help.html#pms-evidence-outcomes-462';body.append(help);
 const controls=node('div'),label=node('label','Owned company'),company=node('select'),refresh=node('button','Verify outcome sources');controls.className='pms462-controls';
 company.id='pms462Company';label.append(company);refresh.id='pms462Refresh';refresh.type='button';refresh.className='secondary';controls.append(label,refresh);body.append(controls);
 const status=node('p','HOLD: verify owner and real evidence sources.');status.id='pms462Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const results=node('section');results.id='pms462Results';body.append(results);
 const form=node('fieldset');form.id='pms462Form';form.disabled=true;form.append(node('legend','Owner-only documentary follow-up'));
 const field=(id,title,tag,max)=>{const l=node('label',title),el=node(tag);el.id=id;if(max)el.maxLength=max;l.append(el);form.append(l);return el;};
 const request=field('pms462Request','Source-verified request awaiting outcome','select'),outcome=field('pms462Outcome','Documentary outcome','select'),reference=field('pms462Reference','Source reference (4–250 characters)','input',250),notes=field('pms462Notes','Notes (optional, 500 characters)','textarea',500);
 for(const v of outcomes){const o=node('option',v.replaceAll('_',' '));o.value=v;outcome.append(o);}
 const submit=node('button','Record internal follow-up outcome');submit.type='button';submit.id='pms462Record';submit.className='secondary';form.append(submit);body.append(form);
 const hold=node('p','HOLD: Independent recheck requires separate reviewer action and source inspection. Nothing here changes the 457 decision, Safety, Jobs, service switches, financial or production gates. No outbound messages.');hold.id='pms462Hold';hold.className='notice';body.append(hold);
 panel.append(body);host.append(panel);
 let version=0,busy=false,verified=null,principal=null;
 const options=(el,placeholder,arr,show,id)=>{el.replaceChildren();const p=node('option',placeholder);p.value='';el.append(p);for(const r of arr){const o=node('option',show(r));o.value=id(r);el.append(o);}};
 const invalidate=msg=>{version++;verified=null;principal=null;form.disabled=true;company.replaceChildren();results.replaceChildren();status.textContent=msg;};
 async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.rpc||!sb.auth?.getUser||!window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Jobs owner session required');
  const who=await sb.auth.getUser();if(who.error||who.data?.user?.id!==a.user.id)throw Error('Identity changed');return {uid:a.user.id,sb};}
 function show(d){verified=d;results.replaceChildren();form.disabled=true;if(d.state!=='source_verified'){status.textContent='WITHHELD: '+d.reason;return;}
  const ready=d.rows.filter(x=>x.readiness==='documentary_handoff_ready');status.textContent='SOURCE VERIFIED: '+d.rows.length+' owner requests · '+ready.length+' documentary handoffs ready for human independent recheck; approval HOLD.';
  for(const r of d.rows){const el=node('article');el.className='pms462-entry';el.append(node('strong',r.finding.service_module_key+' · '+r.request.request_kind.replaceAll('_',' ')),node('p',r.outcome?'Outcome: '+r.outcome.outcome.replaceAll('_',' ')+' · '+r.outcome.source_reference:'Outcome pending'),node('p',r.readiness==='documentary_handoff_ready'?'Documentary handoff ready for separate independent inspection; no approval':'HOLD — follow-up or service switch requires review'));results.append(el);}
  if(!d.rows.length)results.append(node('p','No verified owner requests; no assumed evidence.'));
  const open=d.rows.filter(x=>!x.outcome&&x.enabled);options(request,'Choose an unresolved owner request',open,x=>x.finding.service_module_key+' · '+x.request.source_reference,x=>x.request.id);form.disabled=!open.length;
 }
 async function reconcile(){const ticket=version,ctx=await session();const inbox=await ctx.sb.rpc('ywi_rpc_reassessment_owner_inbox_461');if(ticket!==version||inbox.error)throw Error('Owner inbox denied');
  const owner=window.YWI461.inspectInbox(inbox.data,{userId:ctx.uid});if(owner.state!=='source_verified')throw Error(owner.reason);
  const selected=company.value;options(company,'Choose verified owner company',owner.companies,x=>x.name,x=>x.id);if(owner.companies.some(x=>x.id===selected))company.value=selected;else if(owner.companies.length===1)company.value=owner.companies[0].id;
  const id=company.value;if(!id){status.textContent='HOLD: select an owned company';return;}principal=ctx.uid;
  async function read(){const [a,b]=await Promise.all([ctx.sb.rpc('ywi_rpc_reassessment_followups_461',{p_company_id:id}),ctx.sb.rpc('ywi_rpc_evidence_outcomes_462',{p_company_id:id})]);if(a.error||b.error||!a.data||!b.data)throw Error('Sources denied');return {base:a.data,ledger:b.data};}
  const first=await read(),second=await read();if(ticket!==version||company.value!==id||window.YWI_AUTH?.getState?.()?.user?.id!==ctx.uid||JSON.stringify(first.base)!==JSON.stringify(second.base)||JSON.stringify(first.ledger.outcomes)!==JSON.stringify(second.ledger.outcomes))throw Error('Source changed during verification');
  show(inspect(second.base,second.ledger,{companyId:id,userId:ctx.uid}));}
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=form.disabled=true;try{await reconcile();}catch(e){show({state:'withheld',reason:e.message||String(e)});}finally{busy=false;refresh.disabled=company.disabled=false;}});
 submit.addEventListener('click',async()=>{if(busy||verified?.state!=='source_verified')return;const id=company.value,ticket=version,r=verified.rows.find(x=>x.request.id===request.value),ref=reference.value.trim(),memo=notes.value.trim();
  if(!r||r.outcome||!r.enabled||!outcomes.includes(outcome.value)||ref.length<4||ref.length>250||memo.length>500){status.textContent='WITHHELD: valid open request and source reference required';return;}
  if(!window.confirm('Record an INTERNAL documentary outcome? No messages, evidence certification, independent approval or work authorization.'))return;
  busy=true;form.disabled=refresh.disabled=true;try{const ctx=await session();if(ctx.uid!==principal||ticket!==version||company.value!==id)throw Error('Owner identity changed');
   const operation=operationId();if(!uuid(operation))throw Error('Secure operation ID unavailable');
   const result=await ctx.sb.rpc('ywi_rpc_record_evidence_outcome_462',{p_company_id:id,p_operation_id:operation,p_request_id:r.request.id,p_outcome:outcome.value,p_source_reference:ref,p_notes:memo||null});
   if(result.error||!uuid(result.data?.id)||result.data.company_id!==id||result.data.recorded!==true||!['field_accepted','service_authorized','independent_reapproval','release_green','outbound_actions'].every(k=>result.data[k]===false))throw Error('Unverified receipt');
   reference.value=notes.value='';await reconcile();
  }catch(e){verified=null;status.textContent='WITHHELD: '+(e.message||e)+'. Review ledger before retry.';}finally{busy=false;refresh.disabled=false;form.disabled=verified?.state!=='source_verified'||!verified.rows.some(x=>!x.outcome&&x.enabled);}});
 company.addEventListener('change',()=>{version++;verified=null;form.disabled=true;results.replaceChildren();status.textContent='HOLD: company changed; verify again.';});
 for(const ev of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])document.addEventListener(ev,()=>invalidate('HOLD: owner, permissions or service switch changed; verify again.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

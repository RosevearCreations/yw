/* YW Item 455: real-owner first-company onboarding and append-only evidence intake.
 * Source parity: 420 registry/audit + 443 server menu + 454 independent inspection.
 * The server, not the browser, rechecks ownership, module state and source gates.
 * A reported observation never grants field acceptance or Production GREEN. */
(()=>{'use strict';
const keys=Object.freeze(['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture']);
const checkpoints=Object.freeze(['company_verified','module_rechecked','customer_property_reviewed','jobs_draft_reviewed','field_observation']);
const labels=Object.freeze({company_verified:'Owner company & identity',module_rechecked:'Module switch ON/OFF recheck',
 customer_property_reviewed:'Canonical customer/property first use',jobs_draft_reviewed:'Original Jobs/estimate gate first use',
 field_observation:'Field observation — reported, NOT accepted'});
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
function secureRequestId(){const api=globalThis.crypto;
 if(api?.randomUUID)return api.randomUUID();
 if(!api?.getRandomValues)throw Error('Secure random source unavailable');
 const bytes=api.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
}
const el=(tag,value)=>{const node=document.createElement(tag);if(value!==undefined)node.textContent=value;return node;};
function inspectIntake(read,{companyId,enabled,now=Date.now()}={}){
 const at=Date.parse(read?.captured_at),arr=read?.entries;
 if(!uuid(companyId)||read?.company_id!==companyId||read?.owner_guard!=='ywi_422_assert_owner'||
  read?.synthetic!==false||read?.mutation_authorized!==false||read?.owner_field_accepted!==false||
  read?.release_green!==false||read?.outbound_actions!==false||
  !Number.isFinite(at)||at>now+60000||now-at>300000||!Array.isArray(arr)||arr.length>60||
  !Array.isArray(read.services)||read.services.length!==7||!Array.isArray(enabled)||
  ![read.client_links,read.property_links,read.jobs_receipts,read.evidence_total].every(x=>Number.isSafeInteger(x)&&x>=0)||
  read.evidence_total<arr.length||typeof read.evidence_sample_capped!=='boolean'||
  read.evidence_sample_capped!==(read.evidence_total>60))return {state:'withheld',reason:'Owner-scoped source incomplete or stale'};
 const seen=new Set();
 for(const service of read.services){if(service.company_id!==companyId||!keys.includes(service.module_key)||
  seen.has(service.module_key)||typeof service.enabled!=='boolean'||
  enabled.includes(service.module_key)!==service.enabled)return {state:'withheld',reason:'Module toggles changed between sources'};
  seen.add(service.module_key);}
 const ids=new Set();
 for(const item of arr){if(!uuid(item.id)||ids.has(item.id)||!checkpoints.includes(item.checkpoint)||
  !['observed','needs_follow_up','blocked'].includes(item.disposition)||
  typeof item.source_reference!=='string'||item.source_reference.trim().length<4||
  !Number.isFinite(Date.parse(item.created_at))||
  (item.checkpoint==='module_rechecked'?(!keys.includes(item.module_key)||typeof item.observed_enabled!=='boolean'):
   (item.module_key!==null||item.observed_enabled!==null)))return {state:'withheld',reason:'Evidence journal is malformed'};
  ids.add(item.id);}
 return {state:'source_verified',companyId,entries:arr,enabled:[...enabled],
  customerCount:read.client_links,propertyCount:read.property_links,jobsCount:read.jobs_receipts,
  evidenceCount:read.evidence_total,evidenceSampleCapped:read.evidence_sample_capped,
  fieldAccepted:false,releaseGreen:false};
}
window.YWI455=Object.freeze({keys,checkpoints,labels,inspectIntake});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('owner455'))return;
 const panel=el('details');panel.id='owner455';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='PMS · First Company Onboarding';panel.dataset.adminHubGroups='management operations';
 panel.append(el('summary','455 · Real Owner Onboarding & First-Use Evidence'));
 const body=el('div');body.className='admin-panel-block pms455';
 body.append(el('p','Start with your own verified company in 420. Every new company starts with seven services OFF. This page never creates an owner, toggles a service, starts a job or approves field work. It rechecks actual source records, then lets a permitted owner append a clearly labelled first-use observation.'));
 const help=el('a','ⓘ First-company onboarding, module parity & evidence Help');help.href='/help.html#pms-owner-first-use-455';body.append(help);
 const companyLabel=el('label','Verified owner company');const company=el('select');company.id='pms455Company';companyLabel.append(company);
 const load=el('button','Recheck real owner & switches');load.type='button';load.id='pms455Load';load.className='secondary';
 const actions=el('div');actions.className='pms455-actions';actions.append(companyLabel,load);body.append(actions);
 const status=el('p','HOLD: sign in as the company owner. Create your first company explicitly in the 420 Company Service Registry, then recheck here.');
 status.id='pms455Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const route=el('ol');route.id='pms455Steps';route.setAttribute('aria-label','First company readiness');body.append(route);
 const timeline=el('section');timeline.id='pms455Timeline';timeline.setAttribute('aria-label','Append-only first-use source evidence');body.append(timeline);
 const intake=el('fieldset');intake.id='pms455Intake';intake.disabled=true;intake.append(el('legend','Record first-use observation (not a field approval)'));
 const field=(id,title,tag,max)=>{const lab=el('label',title),n=el(tag);n.id=id;if(max)n.maxLength=max;lab.append(n);intake.append(lab);return n;};
 const checkpoint=field('pms455Checkpoint','Checkpoint','select');for(const k of checkpoints){const opt=el('option',labels[k]);opt.value=k;checkpoint.append(opt);}
 const module=field('pms455Module','Module (required only for switch recheck)','select');
 const source=field('pms455Source','Private source reference (4–250 characters; no client secrets)','input',250);
 const note=field('pms455Note','Observation details (optional; max 500 characters)','textarea',500);
 const disposition=field('pms455Disposition','Reported disposition','select');for(const v of ['observed','needs_follow_up','blocked']){const opt=el('option',v.replaceAll('_',' '));opt.value=v;disposition.append(opt);}
 const submit=el('button','Append observation under verified owner');submit.type='button';submit.id='pms455Append';submit.className='secondary';intake.append(submit);
 const caution=el('p','No service is enabled, client contacted, estimate submitted, payment taken, safety signoff given or live field trial accepted by saving an observation.');intake.append(caution);body.append(intake);
 const release=el('p','FIELD ACCEPTANCE: HOLD until an actual owner completes and independently reviews first-company and first-service trials. Production GREEN must be established separately from exact main, CI and Vercel evidence.');
 release.id='pms455Release';release.className='notice';body.append(release);
 panel.append(body);host.append(panel);
 let epoch=0,owner=null,roster=[],review=null,busy=false;
 const setStatus=s=>{status.textContent=s;};
 function clear(message){epoch++;owner=null;roster=[];review=null;intake.disabled=true;timeline.replaceChildren();route.replaceChildren();company.replaceChildren();
  const p=el('option','Load owner companies');p.value='';company.append(p);setStatus(message);}
 function setModules(){module.replaceChildren();if(checkpoint.value==='module_rechecked'){
  for(const key of keys){const o=el('option',key+' · '+(review?.enabled.includes(key)?'ON':'OFF'));o.value=key;module.append(o);}
  module.disabled=false;
 }else{const o=el('option','Not applicable');o.value='';module.append(o);module.disabled=true;}}
 checkpoint.addEventListener('change',setModules);
 function display(data){review=data;route.replaceChildren();timeline.replaceChildren();intake.disabled=data.state!=='source_verified';
  if(data.state!=='source_verified'){setStatus('WITHHELD: '+data.reason);return;}
  setStatus('SOURCE VERIFIED: '+data.enabled.length+' ON / '+(7-data.enabled.length)+' OFF; '+data.evidenceCount+' owner reports. Field acceptance remains HOLD.');
  for(const [key,value] of [
   ['Real owner company','Verified owner and company-bound roster'],
   ['Seven service switches',data.enabled.length+' ON, '+(7-data.enabled.length)+' OFF (explicit owner changes only in 420)'],
   ['Customer/property',data.customerCount+' customer links, '+data.propertyCount+' property links'],
   ['Original Jobs/estimates',data.jobsCount+' bounded original 421 gate receipts'],
   ['Evidence intake',data.evidenceCount+' saved observations (not approvals)']]){
   const li=el('li');li.append(el('strong',key+': '),document.createTextNode(value));route.append(li);}
  timeline.append(el('h3','Most recent owner observations'));
  if(!data.entries.length)timeline.append(el('p','No actual first-use evidence yet. Yard Rosevear fixtures are never counted as owner evidence.'));
  for(const e of data.entries){const card=el('article');card.className='pms455-entry';
   card.append(el('strong',labels[e.checkpoint]+' · '+e.disposition));
   const details=el('p',e.source_reference+' · '+e.created_at+(e.module_key?' · '+e.module_key+' '+(e.observed_enabled?'ON':'OFF'):''));
   card.append(details);if(e.notes)card.append(el('p',e.notes));timeline.append(card);}
  if(data.evidenceSampleCapped)timeline.append(el('p','Journal sample limited to 60; review older source records before declaring completion.'));
  setModules();
 }
 async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.auth?.getUser||!sb?.from||!sb?.rpc||
   !window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Verified owner with Jobs view permission required');
  const result=await sb.auth.getUser();if(result.error||result.data?.user?.id!==a.user.id)throw Error('Owner authentication changed');
  return {sb,uid:a.user.id,role:a.role};}
 const alive=(ctx,start,id)=>start===epoch&&company.value===id&&window.YWI_AUTH?.getState?.()?.user?.id===ctx.uid&&
  window.YWI_AUTH.getState().isAuthenticated===true;
 async function recheck(){const start=epoch,ctx=await session();
  if(start!==epoch)throw Error('Session changed');
  const rosterResult=await ctx.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(start!==epoch||rosterResult.error||!window.YWI454?.rosterOwned?.(rosterResult.data,ctx.uid))throw Error('Owner company roster unavailable, foreign or truncated');
  owner=ctx.uid;roster=rosterResult.data;
  const prior=company.value;company.replaceChildren();const blank=el('option','Select owned company');blank.value='';company.append(blank);
  for(const row of roster){const option=el('option',row.name);option.value=row.id;company.append(option);}
  if(roster.some(c=>c.id===prior))company.value=prior;else if(roster.length===1)company.value=roster[0].id;
  if(!roster.length){setStatus('HOLD: no real owner company exists. Open 420 and explicitly create your first company. Nothing has been seeded.');return;}
  const id=company.value;if(!roster.some(c=>c.id===id)){setStatus('HOLD: choose one verified owner company and recheck.');return;}
  const guard=()=>alive(ctx,start,id);
  const nav=await ctx.sb.rpc('ywi_rpc_pms_navigation_443',{p_company_id:id});
  if(!guard()||nav.error||!nav.data)throw Error('443 owner navigation rejected');
  const registry=await ctx.sb.from('ywi_company_service_modules').select('company_id,module_key,enabled,created_at,updated_at').eq('company_id',id).limit(8);
  if(!guard()||registry.error)throw Error('420 owner registry rejected');
  const audit=await ctx.sb.from('ywi_company_service_module_audit').select('id,company_id,module_key,action,next_enabled,recorded_at').eq('company_id',id).order('id',{ascending:false}).limit(26);
  if(!guard()||audit.error)throw Error('420 owner switch audit rejected');
  const receipts=await ctx.sb.from('ywi_new_work_gate_receipts_421').select('company_id,service_module_key,target_table,target_id,checked_at').eq('company_id',id).limit(81);
  if(!guard()||receipts.error)throw Error('421 original Jobs/estimate receipt denied');
  const journal=await ctx.sb.rpc('ywi_rpc_owner_first_use_455',{p_company_id:id});
  if(!guard()||journal.error||!journal.data)throw Error('455 owner journal denied');
  const fresh=await ctx.sb.rpc('ywi_rpc_pms_navigation_443',{p_company_id:id});
  if(!guard()||fresh.error||JSON.stringify(nav.data?.services)!==JSON.stringify(fresh.data?.services))throw Error('Toggle changed during recheck');
  const parity=window.YWI454.inspect({company_id:id,menu:fresh.data,registry:registry.data,audit:audit.data,receipts:receipts.data},
   {companyId:id,jobsAllowed:window.YWISecurity?.canViewModule?.('jobs',ctx.role,'view')===true});
  if(parity.state!=='verified_read_only')throw Error('454 source parity failed: '+parity.reason);
  const inspected=inspectIntake(journal.data,{companyId:id,enabled:parity.enabled});
  if(!guard())throw Error('Session changed before render');
  display(inspected);
 }
 load.addEventListener('click',async()=>{if(busy)return;busy=true;load.disabled=company.disabled=true;review=null;intake.disabled=true;
  setStatus('Checking verified owner, seven module switches, original Jobs receipts and first-use journal…');
  try{await recheck();}catch(e){display({state:'withheld',reason:e?.message||String(e)});}
  finally{busy=false;load.disabled=company.disabled=false;}});
 submit.addEventListener('click',async()=>{if(busy||review?.state!=='source_verified'||!roster.some(c=>c.id===company.value))return;
  const before=epoch,id=company.value,kind=checkpoint.value,mod=kind==='module_rechecked'?module.value:null;
  const enabled=mod?review.enabled.includes(mod):null,ref=source.value.trim(),notes=note.value.trim(),disp=disposition.value;
  if(!checkpoints.includes(kind)||ref.length<4||ref.length>250||notes.length>500||
   (mod&&!keys.includes(mod))||!['observed','needs_follow_up','blocked'].includes(disp)){
   setStatus('WITHHELD: provide a valid checkpoint, private source reference and disposition.');return;}
  if(!window.confirm('Append '+labels[kind]+' as a reported observation for this company? It does NOT approve field operations.'))return;
  busy=true;submit.disabled=load.disabled=true;
  try{const ctx=await session();if(owner!==ctx.uid||!alive(ctx,before,id))throw Error('Owner or company changed');
   const fresh=await ctx.sb.rpc('ywi_rpc_pms_navigation_443',{p_company_id:id});
   if(!alive(ctx,before,id)||fresh.error||!fresh.data?.services||
     fresh.data.services.length!==7||fresh.data.services.some(s=>s.enabled!==review.enabled.includes(s.module_key)))
    throw Error('Current service toggles changed; no evidence was saved');
   const requestId=secureRequestId();if(!uuid(requestId))throw Error('Secure request ID unavailable');
   const result=await ctx.sb.rpc('ywi_rpc_append_owner_first_use_455',{
    p_company_id:id,p_request_id:requestId,p_checkpoint:kind,p_module_key:mod,
    p_observed_enabled:enabled,p_reference:ref,p_notes:notes||null,p_disposition:disp});
   if(!alive(ctx,before,id)||result.error||result.data?.company_id!==id||
     result.data?.recorded!==true||result.data?.owner_field_accepted!==false||result.data?.approval_granted!==false)
    throw Error('Server receipt not verified; inspect journal before retry');
   source.value='';note.value='';setStatus('Append-only evidence receipt confirmed. Rechecking source and first-use steps…');
   await recheck();
  }catch(e){review=null;intake.disabled=true;setStatus('WITHHELD: '+(e?.message||e)+'. No automatic retry; recheck journal before recording again.');}
  finally{busy=false;submit.disabled=load.disabled=false;}});
 company.addEventListener('change',()=>{epoch++;review=null;intake.disabled=true;route.replaceChildren();timeline.replaceChildren();setStatus('HOLD: selected company changed; recheck before intake.');});
 for(const event of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])
  document.addEventListener(event,()=>clear('HOLD: owner identity, permission or audited module toggle changed. Recheck authoritative sources.'));
 clear(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

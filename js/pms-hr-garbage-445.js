/* PMS 445 — private HR records and opt-in rural garbage collection.
 * Only owner-verified RPCs may write. No wage disclosure, Auth cloning,
 * sticker charging, invoice posting, messaging or automatic dispatch. */
(()=>{'use strict';
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const kinds=['onboarding','certification','training','shift','leave','retention'];
const statuses=['planned','in_progress','completed','expired','approved','denied','review_due','on_hold'];
const held=reason=>({state:'withheld',reason,people:[],entries:[],stickers:[],contracts:[],pickups:[],enabled:false});
const fresh=(s,now)=>{const t=Date.parse(s?.captured_at);return Number.isFinite(t)&&t<=now+60000&&now-t<=300000};
function inspectHR(s,{companyId,now=Date.now(),allowed=false}={}){
 if(!uuid(companyId)||!allowed||s?.company_id!==companyId||!fresh(s,now)||
  s.owner_guard!=='ywi_445_assert_hr_owner'||!Array.isArray(s.people)||!Array.isArray(s.entries)||
  s.people_count!==s.people.length||s.entries_count!==s.entries.length||
  s.people.length>100||s.entries.length>200||s.wages_included!==false||
  s.payroll_authorized!==false||s.identity_cloned!==false||s.documents_uploaded!==false||
  s.automatic_record_purge!==false||s.mutation_authorized!==false)
  return held('Private HR source, company ownership, Admin permission or bounded freshness unverified');
 const people=new Set(s.people.map(p=>p.id));
 if(people.size!==s.people.length||s.people.some(p=>!uuid(p.id)||!p.display_name||!p.job_title||
   !['prospect','onboarding','active','leave','inactive'].includes(p.employment_status))||
  new Set(s.entries.map(e=>e.id)).size!==s.entries.length||
  s.entries.some(e=>!uuid(e.id)||!people.has(e.employee_id)||!kinds.includes(e.entry_kind)||
   !statuses.includes(e.reported_status)||!e.title||!Number.isFinite(Date.parse(e.created_at))))
  return held('Foreign or malformed employee, evidence chronology or duplicate HR source');
 return {state:'verified_hr',companyId,people:s.people,entries:s.entries,wagesVisible:false,payrollAuthorized:false};
}
function inspectGarbage(s,{companyId,now=Date.now(),allowed=false}={}){
 if(!uuid(companyId)||!allowed||s?.company_id!==companyId||!fresh(s,now)||
  s.owner_guard!=='ywi_445_assert_hr_owner'||typeof s.enabled!=='boolean'||
  !Array.isArray(s.stickers)||!Array.isArray(s.contracts)||!Array.isArray(s.pickups)||
  s.sticker_count!==s.stickers.length||s.contract_count!==s.contracts.length||
  s.pickup_count!==s.pickups.length||s.stickers.length>100||s.contracts.length>100||
  s.pickups.length>200||s.financial_receipt_verified!==false||s.auto_billing!==false||
  s.municipal_authorization!==false||s.route_dispatched!==false||s.mutation_authorized!==false)
  return held('Garbage module ownership, switch, source caps or payment boundary unverified');
 const stickers=new Map(s.stickers.map(x=>[x.id,x]));
 const contracts=new Map(s.contracts.map(x=>[x.id,x]));
 if(stickers.size!==s.stickers.length||contracts.size!==s.contracts.length||
  new Set(s.pickups.map(x=>x.id)).size!==s.pickups.length||
  s.stickers.some(x=>!uuid(x.id)||!uuid(x.client_id)||!uuid(x.site_id)||
   !/^[A-Za-z0-9-]{4,40}$/.test(x.serial)||!['issued','redeemed','void'].includes(x.status))||
  s.contracts.some(x=>!uuid(x.id)||!uuid(x.client_id)||!uuid(x.site_id)||
   ![7,14,28].includes(x.pickup_interval_days)||
   !['draft','reported_active','ended'].includes(x.reported_status))||
  s.pickups.some(x=>!uuid(x.id)||!uuid(x.client_id)||!uuid(x.site_id)||
   !['scheduled','collected','missed','cancelled'].includes(x.reported_status)||
   !['sticker','contract'].includes(x.service_basis)||
   (x.service_basis==='sticker'&&(!stickers.has(x.sticker_id)||
     stickers.get(x.sticker_id).client_id!==x.client_id||stickers.get(x.sticker_id).site_id!==x.site_id))||
   (x.service_basis==='contract'&&(!contracts.has(x.contract_id)||
     contracts.get(x.contract_id).client_id!==x.client_id||contracts.get(x.contract_id).site_id!==x.site_id))))
  return held('Foreign, duplicated or malformed sticker, contract or pickup record');
 return {state:'verified_garbage',companyId,enabled:s.enabled,stickers:s.stickers,
  contracts:s.contracts,pickups:s.pickups,canCharge:false,canDispatch:false};
}
window.YWI445=Object.freeze({kinds,statuses,inspectHR,inspectGarbage});
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e};
const field=(container,tag,label,id,limit)=>{const wrap=node('label',label),n=node(tag);n.id=id;
 if(limit)n.maxLength=limit;wrap.append(n);container.append(wrap);return n};
const btn=(container,id,txt)=>{const b=node('button',txt);b.type='button';b.className='secondary';b.id=id;container.append(b);return b};
const options=(s,items,placeholder,txt)=>{const prior=s.value;s.replaceChildren();const empty=node('option',placeholder);empty.value='';s.append(empty);
 for(const item of items){const o=node('option',txt(item));o.value=item.id;s.append(o)}
 if(items.some(x=>x.id===prior))s.value=prior;else if(items.length===1)s.value=items[0].id};
const statusesSelect=(s,values)=>{s.replaceChildren();for(const value of values){const x=node('option',value.replaceAll('_',' '));x.value=value;s.append(x)}};
async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
 if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.auth?.getUser||!sb?.from||!sb?.rpc||
  !window.YWISecurity?.canViewModule?.('admin',a.role,'manage')||
  !window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Company owner, Jobs view and Admin manage required');
 const r=await sb.auth.getUser();if(r.error||r.data?.user?.id!==a.user.id)throw Error('Authenticated user mismatch');
 return {uid:a.user.id,sb,role:a.role};}
async function rpc(sb,name,args){const r=await sb.rpc(name,args);if(r.error||r.data===undefined||r.data===null)
 throw Error(r.error?.message||name+' returned no verified source');return r.data}
async function companies(ctx){const r=await ctx.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
 if(r.error||!Array.isArray(r.data)||r.data.length>100||
  new Set(r.data.map(x=>x.id)).size!==r.data.length||
  r.data.some(x=>!uuid(x.id)||x.owner_user_id!==ctx.uid||!x.name))throw Error('Owner-company roster incomplete or foreign');
 return r.data}
const requestId=()=>{if(!window.crypto?.randomUUID)throw Error('Secure browser UUID required for idempotent records');
 const id=window.crypto.randomUUID();if(!uuid(id))throw Error('Generated request ID invalid');return id};
function shell(id,title,intro,helpHref){const host=document.getElementById('admin');if(!host||document.getElementById(id))return null;
 const panel=node('details');panel.id=id;panel.className='admin-hub-detail';panel.dataset.adminHubGroups='management operations jobs';
 panel.dataset.adminHubTitle='PMS · '+title;panel.append(node('summary',title));
 const body=node('div');body.className='admin-panel-block';body.append(node('p',intro));
 const help=node('a','ⓘ Module Help');help.href=helpHref;body.append(help);
 panel.append(body);host.append(panel);return body;}
function mountHR(){const body=shell('owner445HR','445 · Detailed Employee & HR',
 'Private company employee dossiers, certification, shifts, onboarding, leave, training and retention evidence. No payroll or Auth account is created.',
 '/help.html#pms-employee-hr-445');if(!body)return;
 const bar=node('div');bar.className='pms445-grid';const company=field(bar,'select','Verified owner company','pms445HRCompany');body.append(bar);
 const actions=node('div');actions.className='pms445-actions';const refresh=btn(actions,'pms445HRRefresh','Verify HR dossier');body.append(actions);
 const status=node('p','Verify an owner company to view private HR records.');status.id='pms445HRStatus';status.setAttribute('role','status');body.append(status);
 const roster=node('div');roster.id='pms445HRRoster';body.append(roster);
 const create=node('details');create.append(node('summary','Create private employee dossier'));
 const pf=node('div');pf.className='pms445-grid';const name=field(pf,'input','Employee display name','pms445HRName',120);
 const role=field(pf,'input','Job title','pms445HRRole',100);
 const state=field(pf,'select','Employment status','pms445HRState');statusesSelect(state,['prospect','onboarding','active','leave','inactive']);
 const start=field(pf,'input','Reported start date','pms445HRStart');start.type='date';create.append(pf);
 const add=btn(create,'pms445HRAdd','Create company HR record');body.append(create);
 const event=node('details');event.append(node('summary','Append certification, shift, onboarding, leave or other evidence'));
 const ef=node('div');ef.className='pms445-grid';const person=field(ef,'select','Verified company employee','pms445HREmployee');
 const kind=field(ef,'select','Event category','pms445HRKind');statusesSelect(kind,kinds);
 const eTitle=field(ef,'input','Event title','pms445HRTitle',120);
 const eState=field(ef,'select','Reported evidence status','pms445HREventState');statusesSelect(eState,statuses);
 const notes=field(ef,'textarea','Brief factual notes','pms445HRNotes',600);
 const reference=field(ef,'input','Private source reference; mandatory for approved/completed','pms445HRReference',200);
 const from=field(ef,'input','Effective from','pms445HRFrom');from.type='date';
 const until=field(ef,'input','Effective until','pms445HRUntil');until.type='date';event.append(ef);
 const append=btn(event,'pms445HRAppend','Append HR evidence');event.append(node('p','Evidence is immutable; dates and expiry are operator-reported. No documents are uploaded or deleted automatically.'));body.append(event);
 let epoch=0,identity=null,owned=[],data=null,busy=false;
 const alive=(uid,e)=>epoch===e&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&window.YWI_AUTH.getState().user?.id===uid;
 const clear=()=>{data=null;roster.replaceChildren();person.replaceChildren();};
 async function load(e){const ctx=await session();if(!alive(ctx.uid,e))throw Error('Session changed');
  const list=await companies(ctx);if(!alive(ctx.uid,e))throw Error('Session changed while checking company');
  identity=ctx.uid;owned=list;options(company,list,'Choose owner company',x=>x.name);
  if(!owned.some(x=>x.id===company.value)){clear();status.textContent='HOLD: no verified live company. Yard Rosevear remains synthetic.';return;}
  const s=await rpc(ctx.sb,'ywi_rpc_pms_hr_snapshot_445',{p_company_id:company.value});
  if(!alive(ctx.uid,e))throw Error('Session changed during HR read');
  data=inspectHR(s,{companyId:company.value,allowed:true});roster.replaceChildren();
  if(data.state!=='verified_hr')throw Error(data.reason);
  status.textContent='Verified private HR: '+data.people.length+' employees, '+data.entries.length+' records; wages and payroll hidden.';
  options(person,data.people,'Choose company employee',x=>x.display_name+' · '+x.job_title);
  for(const p of data.people){const c=node('article');c.className='notice';c.dataset.pms445Employee=p.id;
   c.append(node('strong',p.display_name+' · '+p.job_title),node('p','Reported status: '+p.employment_status));
   const events=data.entries.filter(x=>x.employee_id===p.id);c.append(node('p',events.length+' HR evidence entries'));
   for(const x of events)c.append(node('p',x.entry_kind+' · '+x.title+' · '+x.reported_status+' · '+(x.effective_until||'no expiry recorded')));
   roster.append(c);}
 }
 async function run(task){if(busy)return;busy=true;for(const b of [refresh,add,append])b.disabled=true;
  const e=epoch;try{await task(e)}catch(ex){clear();status.textContent='WITHHELD: '+(ex.message||String(ex))}
  finally{busy=false;for(const b of [refresh,add,append])b.disabled=false}}
 refresh.onclick=()=>run(load);company.onchange=()=>{epoch++;clear();run(load)};
 const allowed=()=>data?.state==='verified_hr'&&identity===window.YWI_AUTH?.getState?.()?.user?.id&&owned.some(c=>c.id===company.value);
 add.onclick=()=>run(async e=>{if(!allowed())throw Error('Reload verified company HR before creating employee');
  const ctx=await session(),a={p_company_id:company.value,p_request_id:requestId(),
   p_display_name:name.value.trim(),p_job_title:role.value.trim(),p_employment_status:state.value,
   p_start_date:start.value||null};
  if(!window.confirm('Create a private HR dossier? This does not create a login or authorize wages.'))return;
  const id=await rpc(ctx.sb,'ywi_rpc_pms_hr_create_person_445',a);
  if(!uuid(id)||!alive(ctx.uid,e))throw Error('HR create receipt unverifiable');
  name.value='';role.value='';await load(e);status.textContent='Verified company HR record created; no login or payroll change.';});
 append.onclick=()=>run(async e=>{if(!allowed()||!data.people.some(p=>p.id===person.value))throw Error('Select a verified company employee');
  const ctx=await session(),a={p_company_id:company.value,p_employee_id:person.value,p_request_id:requestId(),
   p_kind:kind.value,p_title:eTitle.value.trim(),p_status:eState.value,
   p_notes:notes.value.trim()||null,p_source_ref:reference.value.trim()||null,
   p_effective_from:from.value||null,p_effective_until:until.value||null};
  if(!window.confirm('Append this factual HR record? Earlier evidence cannot be rewritten.'))return;
  const id=await rpc(ctx.sb,'ywi_rpc_pms_hr_append_445',a);
  if(!uuid(id)||!alive(ctx.uid,e))throw Error('HR append receipt unverifiable');
  eTitle.value='';notes.value='';reference.value='';await load(e);status.textContent='HR evidence appended. No payroll run, wage edit or uploaded document.';});
 const invalidate=()=>{epoch++;clear();company.replaceChildren();identity=null;owned=[];status.textContent='Session/permissions changed. Reverify private HR.'};
 document.addEventListener('ywi:auth-changed',invalidate);document.addEventListener('ywi:module-permissions-changed',invalidate);
}
function mountGarbage(){const body=shell('owner445Garbage','445 · Rural Garbage Collection · Stickers & Contracts',
 'Opt-in garbage collection with physical sticker numbers, reported contracts and manual pickup evidence. Never charges, posts an invoice or dispatches a truck automatically.',
 '/help.html#pms-garbage-collection-445');if(!body)return;
 const bar=node('div');bar.className='pms445-grid';const company=field(bar,'select','Verified owner company','pms445GarbageCompany');
 const customer=field(bar,'select','Canonical customer','pms445GarbageCustomer');
 const site=field(bar,'select','Company-linked collection property','pms445GarbageSite');body.append(bar);
 const actions=node('div');actions.className='pms445-actions';const refresh=btn(actions,'pms445GarbageRefresh','Verify garbage module');
 const toggle=btn(actions,'pms445GarbageToggle','Enable garbage collection');body.append(actions);
 const status=node('p','Garbage is OFF until explicitly enabled for a verified company.');status.id='pms445GarbageStatus';status.setAttribute('role','status');body.append(status);
 const history=node('div');history.id='pms445GarbageHistory';body.append(history);
 const sticker=node('details');sticker.append(node('summary','Issue a numbered sticker for one property'));
 const sf=node('div');sf.className='pms445-grid';const serial=field(sf,'input','Physical sticker serial','pms445StickerSerial',40);
 const receipt=field(sf,'input','Reported purchase/receipt reference (optional, NOT payment confirmation)','pms445StickerReceipt',160);
 sticker.append(sf);const issue=btn(sticker,'pms445StickerIssue','Record issued sticker');body.append(sticker);
 const contract=node('details');contract.append(node('summary','Record a reported recurring garbage contract'));
 const cf=node('div');cf.className='pms445-grid';const agreement=field(cf,'input','Private contract reference','pms445ContractRef',160);
 const interval=field(cf,'select','Pickup interval','pms445ContractInterval');for(const [days,label] of [[7,'Weekly'],[14,'Every 2 weeks'],[28,'Every 4 weeks']]){const o=node('option',label);o.value=days;interval.append(o)}
 const contractStatus=field(cf,'select','Operator-reported contract status','pms445ContractState');statusesSelect(contractStatus,['draft','reported_active','ended']);
 contract.append(cf);const register=btn(contract,'pms445ContractRegister','Record contract reference');body.append(contract);
 const pickup=node('details');pickup.append(node('summary','Schedule a pickup against a sticker or reported active contract'));
 const pf=node('div');pf.className='pms445-grid';const basis=field(pf,'select','Service basis','pms445PickupBasis');statusesSelect(basis,['sticker','contract']);
 const source=field(pf,'select','Available sticker / active contract','pms445PickupSource');
 const date=field(pf,'input','Manual pickup date','pms445PickupDate');date.type='date';pickup.append(pf);
 const schedule=btn(pickup,'pms445PickupSchedule','Schedule manual pickup');body.append(pickup);
 let epoch=0,identity=null,owned=[],clients=[],properties=[],data=null,busy=false;
 const alive=(uid,e)=>epoch===e&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&window.YWI_AUTH.getState().user?.id===uid;
 const clear=()=>{data=null;clients=[];properties=[];history.replaceChildren();source.replaceChildren();customer.replaceChildren();site.replaceChildren();};
 const verified=()=>data?.state==='verified_garbage'&&identity===window.YWI_AUTH?.getState?.()?.user?.id&&owned.some(c=>c.id===company.value);
 function sourceOptions(){if(!verified())return;
  const rows=(basis.value==='sticker'?data.stickers.filter(x=>x.status==='issued'):data.contracts.filter(x=>x.reported_status==='reported_active'))
   .filter(x=>x.client_id===customer.value&&x.site_id===site.value);
  options(source,rows,'Choose a valid source',x=>basis.value==='sticker'?x.serial:x.agreement_ref);}
 function show(){history.replaceChildren();if(!verified())return;
  toggle.textContent=data.enabled?'Disable new garbage work':'Enable garbage collection';
  status.textContent=(data.enabled?'ENABLED':'OFF')+' · '+data.stickers.length+' stickers · '+data.contracts.length+
    ' contracts · '+data.pickups.length+' pickups. No payment or dispatch is automated.';
  for(const b of [issue,register,schedule])b.disabled=!data.enabled;
  const entries=[...data.stickers.map(x=>({type:'Sticker',id:x.id,label:x.serial,status:x.status,site_id:x.site_id})),
   ...data.contracts.map(x=>({type:'Contract',id:x.id,label:x.agreement_ref,status:x.reported_status,site_id:x.site_id})),
   ...data.pickups.map(x=>({type:'Pickup',...x,label:x.planned_date,status:x.reported_status}))];
  for(const x of entries){const item=node('article');item.className='notice';item.dataset.pms445GarbageType=x.type;
   item.append(node('strong',x.type+' · '+x.label),node('p','Status: '+x.status));
   if(x.type==='Pickup'&&x.status==='scheduled')for(const outcome of ['collected','missed','cancelled']){
    const b=btn(item,'pms445Close-'+x.id+'-'+outcome,'Record '+outcome);b.dataset.pms445PickupOutcome=outcome;
    b.onclick=()=>run(async e=>{if(!verified())throw Error('Reverify company garbage records');const ctx=await session();
     if(!window.confirm('Record '+outcome+' for this pickup? This is a manual field assertion.'))return;
     const out=await rpc(ctx.sb,'ywi_rpc_pms_garbage_complete_445',{
      p_company_id:company.value,p_pickup_id:x.id,p_outcome:outcome,p_notes:null});
     if(out?.id!==x.id||out.company_id!==company.value||out.reported_status!==outcome||
      out.payment_collected!==false||out.invoice_posted!==false||!alive(ctx.uid,e))throw Error('Pickup outcome receipt invalid');
     await load(e);status.textContent='Pickup '+outcome+' recorded. No payment, invoice or automatic dispatch.';});}
   history.append(item);}
  sourceOptions();}
 async function load(e){const ctx=await session();if(!alive(ctx.uid,e))throw Error('Session changed');
  const list=await companies(ctx);if(!alive(ctx.uid,e))throw Error('Session changed');
  identity=ctx.uid;owned=list;options(company,list,'Choose owner company',x=>x.name);
  if(!owned.some(x=>x.id===company.value)){clear();status.textContent='HOLD: no verified company. Test company Yard Rosevear is synthetic.';return;}
  const [snapshot,rows]=await Promise.all([
   rpc(ctx.sb,'ywi_rpc_pms_garbage_snapshot_445',{p_company_id:company.value}),
   rpc(ctx.sb,'ywi_rpc_company_customers_422',{p_company_id:company.value})]);
  if(!alive(ctx.uid,e)||!Array.isArray(rows)||rows.length>100||
    rows.some(x=>!uuid(x.id)||!x.name))throw Error('Company customer roster not verified');
  data=inspectGarbage(snapshot,{companyId:company.value,allowed:true});if(data.state!=='verified_garbage')throw Error(data.reason);
  clients=rows;options(customer,rows,'Choose company customer',x=>x.name);await loadSites(ctx,e);show();}
 async function loadSites(ctx,e){properties=[];site.replaceChildren();source.replaceChildren();
  if(!clients.some(x=>x.id===customer.value))return;
  const r=await rpc(ctx.sb,'ywi_rpc_customer_history_422',{p_company_id:company.value,p_client_id:customer.value});
  if(!alive(ctx.uid,e)||r.company_id!==company.value||r.client_id!==customer.value||
   r.legacy_unscoped_excluded!==true||!Array.isArray(r.properties)||r.properties.length>100||
   r.properties.some(x=>!uuid(x.id)||!x.name))throw Error('Canonical site ownership unverified');
  properties=r.properties;options(site,properties,'Choose verified collection property',x=>x.name);sourceOptions();}
 async function run(action){if(busy)return;busy=true;const e=epoch;
  try{await action(e)}catch(ex){clear();status.textContent='WITHHELD: '+(ex.message||String(ex))}
  finally{busy=false}}
 refresh.onclick=()=>run(load);company.onchange=()=>{epoch++;clear();run(load)};
 customer.onchange=()=>{epoch++;run(async e=>{const ctx=await session();await loadSites(ctx,e);show()})};
 site.onchange=sourceOptions;basis.onchange=sourceOptions;
 toggle.onclick=()=>run(async e=>{if(!verified())throw Error('Verify owner company first');const ctx=await session(),enabled=!data.enabled;
  if(!window.confirm((enabled?'ENABLE':'DISABLE')+' company garbage collection? OFF blocks new stickers, contracts and pickups; historical records remain.'))return;
  const out=await rpc(ctx.sb,'ywi_rpc_pms_garbage_switch_445',{p_company_id:company.value,p_enabled:enabled});
  if(out?.company_id!==company.value||out.enabled!==enabled||out.automatic_billing!==false||!alive(ctx.uid,e))
   throw Error('Server switch receipt unverified');await load(e);});
 const ownedSite=()=>verified()&&data.enabled&&clients.some(x=>x.id===customer.value)&&properties.some(x=>x.id===site.value);
 async function submit(e,name,args){if(!ownedSite())throw Error('Enable module and select a company-owned customer/property');
  const ctx=await session();if(!window.confirm('Record this manual company-scoped '+name+'? No charge or automatic dispatch.'))return;
  const id=await rpc(ctx.sb,name,{p_company_id:company.value,p_client_id:customer.value,
   p_site_id:site.value,p_request_id:requestId(),...args});
  if(!uuid(id)||!alive(ctx.uid,e))throw Error('Recorded '+name+' ID unverified');await load(e);
  status.textContent='Manual '+name+' recorded; no payment, invoice or dispatch.';}
 issue.onclick=()=>run(e=>submit(e,'ywi_rpc_pms_garbage_issue_sticker_445',{
  p_serial:serial.value.trim(),p_reported_receipt_ref:receipt.value.trim()||null}));
 register.onclick=()=>run(e=>submit(e,'ywi_rpc_pms_garbage_contract_445',{
  p_agreement_ref:agreement.value.trim(),p_interval_days:Number(interval.value),p_status:contractStatus.value}));
 schedule.onclick=()=>run(async e=>{if(!ownedSite())throw Error('Choose verified customer, site and enabled garbage service');
  const selected=(basis.value==='sticker'?data.stickers:data.contracts).find(x=>x.id===source.value&&
   x.client_id===customer.value&&x.site_id===site.value&&
   (basis.value==='sticker'?x.status==='issued':x.reported_status==='reported_active'));
  if(!selected)throw Error('No eligible owned sticker/contract source');
  await submit(e,'ywi_rpc_pms_garbage_schedule_445',{
   p_basis:basis.value,p_source_id:source.value,p_planned_date:date.value||null});});
 const invalidate=()=>{epoch++;clear();company.replaceChildren();identity=null;owned=[];
  status.textContent='Session/permission changed. Reverify garbage company.'};
 document.addEventListener('ywi:auth-changed',invalidate);document.addEventListener('ywi:module-permissions-changed',invalidate);
}
function mount(){mountHR();mountGarbage()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

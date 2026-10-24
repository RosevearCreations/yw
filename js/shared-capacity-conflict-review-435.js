/* YW Item 435: owner-only original Dispatch/Fleet/checkout/material conflict review.
   Advisory, company-scoped and read-only. No automatic assignment or cost total. */
(()=>{'use strict';
const make=(tag,label)=>{const el=document.createElement(tag);if(label!==undefined)el.textContent=String(label);return el;};
const when=value=>value?Date.parse(String(value)):NaN;
const valid=value=>typeof value==='string'&&value.length>0;
const restricted=status=>/cancel|supersed|complet|closed|archiv/i.test(String(status||''));
const unhealthy=status=>/lockout|out.of.service|unavailable|repair|maintenance|fail|inactive|retired|decommission|unsafe|down/i.test(String(status||''));
const withheld=reason=>({state:'withheld',reason,conflicts:[],gaps:[],authorized:false});
const key=(kind,id)=>id===null||id===undefined||id===''?null:kind+':'+String(id);
const uniq=a=>[...new Set(a.filter(Boolean))];
function inspect(source,companyId,start,end,now=Date.now()){
 if(!source||source.company_id!==companyId||
    source.canonical_source!=='original_dispatch_fleet_equipment_material_423_435'||
    source.company_scope_only!==true||source.sources_complete!==true||
    source.cost_posting!==false||source.stock_adjustment!==false||
    source.automatic_reallocation!==false||source.dispatch_authorized!==false||
    when(source.window_start)!==when(start)||when(source.window_end)!==when(end)||
    !Number.isFinite(when(start))||!Number.isFinite(when(end))||
    when(end)<=when(start)||when(end)-when(start)>14*86400000||
    !Number.isFinite(when(source.retrieved_at))||when(source.retrieved_at)>now+300000||
    now-when(source.retrieved_at)>300000||
    !Array.isArray(source.dispatches)||!Array.isArray(source.signouts)||!Array.isArray(source.materials)||
    !Number.isInteger(source.dispatch_count)||!Number.isInteger(source.signout_count)||
    !Number.isInteger(source.material_count)||
    source.dispatches.length!==source.dispatch_count||source.dispatch_count>80||
    source.signouts.length!==source.signout_count||source.signout_count>120||
    source.materials.length!==source.material_count||source.material_count>120)
  return withheld('Stale, foreign, capped, incomplete or contradictory original company sources');
 const dispatches=source.dispatches,signouts=source.signouts,materials=source.materials;
 if(new Set(dispatches.map(d=>String(d?.id))).size!==dispatches.length||
    new Set(signouts.map(s=>String(s?.id))).size!==signouts.length||
    new Set(materials.map(m=>String(m?.id))).size!==materials.length)
  return withheld('Duplicate canonical source IDs');
 const jobs=new Set(dispatches.map(d=>d?.work_order_id));
 const resourceMap=new Map(),conflicts=[],gaps=[],reviews=[];
 const issue=(list,category,subject,message)=>list.push({category,subject:String(subject||'Original source'),message});
 if(!dispatches.length)issue(gaps,'schedule','Selected company','No dated original Dispatch entries in this window; resource readiness cannot be inferred');
 for(const d of dispatches){
  if(!valid(d?.id)||!valid(d.work_order_id)||!valid(d.service)||!valid(d.work_order_number)||
    !Array.isArray(d.crew_member_ids)||!Array.isArray(d.profile_ids)||
    !Array.isArray(d.equipment_ids)||!Array.isArray(d.assets)||
    d.crew_member_ids.length>30||d.profile_ids.length>30||d.equipment_ids.length>20||
    d.assets.length>22||d.crew_member_ids.some(x=>!valid(x))||d.profile_ids.some(x=>!valid(x))||
    !Number.isFinite(when(d.start))||!Number.isFinite(when(d.end))||
    when(d.start)>=when(d.end)||when(d.start)>=when(end)||when(d.end)<=when(start)||
    new Set(d.assets.map(x=>String(x?.id))).size!==d.assets.length)
   return withheld('Unscoped or malformed original Dispatch window/crew/asset evidence');
  const label=d.work_order_number+' · '+d.service+' · '+d.id;
  if(restricted(d.status)){issue(reviews,'historical',label,'Inactive schedule excluded from conflict pairing');continue;}
  if(!d.crew_id)issue(gaps,'crew',label,'Original crew assignment is missing');
  if(!d.crew_member_ids.length&&!d.profile_ids.length)issue(gaps,'crew',label,'Actual crew member/person assignment unavailable');
  const assetIds=[d.truck_id,d.trailer_id,...d.equipment_ids].filter(x=>x!==null&&x!==undefined);
  if(new Set(assetIds.map(String)).size!==assetIds.length)
   issue(gaps,'equipment',label,'Same asset is listed more than once in this Dispatch');
  const resources=uniq([
    key('crew',d.crew_id),key('person',d.lead_id),key('person',d.supervisor_id),
    ...d.crew_member_ids.map(x=>key('person',x)),...d.profile_ids.map(x=>key('person',x)),
    ...assetIds.map(x=>key('asset',x))]);
  if(!resources.length)issue(gaps,'capacity',label,'No original crew/person/asset capacity source');
  for(const id of assetIds){
   const a=d.assets.find(x=>String(x.id)===String(id));
   if(!a){issue(gaps,'equipment',label,'Assigned asset '+id+' missing from original registry');continue;}
   if(a.locked_out===true||unhealthy(a.status)||unhealthy(a.fleet_status)||Number(a.fleet_downtime||0)>0)
    issue(gaps,'fleet',label,'Asset '+(a.name||id)+' locked out, unavailable or in Fleet downtime');
   if(String(id)===String(d.truck_id)||String(id)===String(d.trailer_id)){
    if(!a.fleet_status||!a.fleet_readiness||!Number.isFinite(when(a.fleet_checked_at))||
       now-when(a.fleet_checked_at)>7*86400000||when(a.fleet_checked_at)>now+300000||
       !/ready|pass|serviceable/i.test(String(a.fleet_readiness))||
       /not.ready|fail|caution/i.test(String(a.fleet_readiness)))
     issue(gaps,'fleet',label,'Current original Fleet readiness absent or adverse for '+(a.name||id));
    for(const [field,name] of [['registration_expiry','registration'],['insurance_expiry','insurance'],['inspection_due','inspection']]){
     if(!Number.isFinite(when(a[field]))||when(a[field])<when(d.start))
      issue(gaps,'fleet',label,'Fleet '+name+' expired or missing for '+(a.name||id));
    }
   }
  }
  for(const resource of resources){
   const previous=resourceMap.get(resource)||[];
   for(const other of previous){
    if(other.end>when(d.start)&&other.start<when(d.end)){
     issue(conflicts,resource,other.label+' ↔ '+label,
      'Shared '+resource+' allocated to overlapping original Dispatch windows; '+
      (other.service!==d.service?'CROSS-SERVICE':'same service')+' review required');
    }
   }
   previous.push({start:when(d.start),end:when(d.end),label,service:d.service});
   resourceMap.set(resource,previous);
  }
 }
 const seenSignouts=new Map();
 for(const s of signouts){
  if(!valid(String(s?.id??''))||!valid(s.work_order_id)||s.asset_id===null||s.asset_id===undefined||
    !Number.isFinite(when(s.out))||(s.returned!==null&&s.returned!==undefined&&
    (!Number.isFinite(when(s.returned))||when(s.returned)<when(s.out)))||
    ![true,false,null].includes(s.proof_matches)||
    (s.proof_id!==null&&s.proof_id!==undefined&&!valid(s.proof_work_order_id)))
   return withheld('Malformed original custody or attribution receipt');
  const subject='Checkout '+s.id+' · asset '+s.asset_id;
  if(!s.proof_id)issue(gaps,'equipment proof',subject,'Original checkout has no unique 423 source attribution receipt');
  else if(s.proof_work_order_id!==s.work_order_id||s.proof_matches!==true)
   issue(gaps,'equipment proof',subject,'423 proof links a different order or original checkout fingerprint changed');
  const siblings=seenSignouts.get(String(s.asset_id))||[];
  for(const other of siblings){
   if((other.returned===null||when(other.returned)>when(s.out))&&
      (s.returned===null||when(s.returned)>when(other.out)))
    issue(conflicts,'custody','Checkout '+other.id+' ↔ '+s.id,
     'Asset '+s.asset_id+' has overlapping original equipment checkouts');
  }
  siblings.push(s);seenSignouts.set(String(s.asset_id),siblings);
 }
 for(const m of materials){
  if(!valid(m?.id)||!valid(m.issue_id)||!valid(m.work_order_id)||!jobs.has(m.work_order_id)||
    !Number.isFinite(when(m.issue_date))||!Number.isFinite(Number(m.quantity))||
    !Number.isFinite(Number(m.source_amount))||
    ![true,false,null].includes(m.proof_matches)||
    (m.proof_id!==null&&m.proof_id!==undefined&&!valid(m.proof_work_order_id)))
   return withheld('Foreign, malformed or unattributed original material source');
  const subject='Material line '+m.id+' · '+(m.description||m.issue_number||'original issue');
  if(['issued','partial','closed'].includes(m.issue_status)){
   if(m.usage_type!=='job_use'||!m.material_id||Number(m.quantity)<=0||Number(m.source_amount)<0||
      m.site_id!==m.original_site_id)
    issue(gaps,'material',subject,'Original issue usage, site, quantity or amount inconsistent');
   if(!m.proof_id)issue(gaps,'material proof',subject,'Issued material line lacks its unique original 423 attribution receipt');
   else if(m.proof_work_order_id!==m.work_order_id||m.proof_matches!==true)
    issue(gaps,'material proof',subject,'423 receipt references a different job or changed original material fingerprint');
  }else if(!['draft','void'].includes(m.issue_status))
   issue(gaps,'material',subject,'Unknown original issue status; manual source review required');
 }
 issue(reviews,'scope','Company boundary','Only resources and material issues tied to this owner company and selected dated window were reviewed. Other companies, unscheduled work, future changes and inventory availability are NOT cleared.');
 issue(reviews,'cost','Original job-cost ledger','Issue-line amount is source evidence only. No amounts were summed, double-posted, charged or deducted.');
 return {state:conflicts.length||gaps.length?'hold':'review',authorized:false,
  dispatch_count:dispatches.length,signout_count:signouts.length,material_count:materials.length,
  conflicts,gaps,reviews,source_retrieved_at:source.retrieved_at};
}
window.YWI435=Object.freeze({inspect});
function mount(){
 const host=document.getElementById('admin');if(!host||document.getElementById('owner435'))return;
 const panel=make('details');panel.id='owner435';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Shared Capacity and Original Cost Source Review';
 panel.dataset.adminHubGroups='management operations jobs';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.append(make('summary','435 · Shared Crew, Fleet, Equipment & Materials Conflict Review'));
 const body=make('div');body.className='admin-panel-block';
 body.append(make('p','Compare dated original company dispatches and unique original checkout/material receipts before scheduling. HOLD or REVIEW never reallocates a crew, clears Fleet/Safety, posts a cost, adjusts stock or authorizes work.'));
 const help=make('a','ⓘ Shared capacity and cost-source help');help.href='/help.html#shared-capacity-conflict-review-435';body.append(help);
 const fields=make('div');fields.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px;min-width:0';
 const companyLabel=make('label','Verified owner company'),company=make('select');company.id='owner435Company';
 company.style.cssText='display:block;width:100%;max-width:100%;min-width:0;box-sizing:border-box';
 companyLabel.append(company);fields.append(companyLabel);
 const dateLabel=make('label','UTC review start date (seven days)'),date=make('input');date.type='date';date.id='owner435Start';
 date.value=new Date().toISOString().slice(0,10);date.style.cssText='display:block;width:100%;max-width:100%;min-width:0;box-sizing:border-box';
 dateLabel.append(date);fields.append(dateLabel);body.append(fields);
 const refresh=make('button','Refresh original company conflict evidence');refresh.id='owner435Refresh';
 refresh.type='button';refresh.className='secondary';body.append(refresh);
 const status=make('p','Authenticate as company owner; no resource review has been performed.');status.id='owner435Status';
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const results=make('div');results.id='owner435Results';results.style.cssText='display:grid;gap:12px;min-width:0;max-width:100%;overflow-wrap:anywhere';body.append(results);
 panel.append(body);host.append(panel);
 let session=null,companies=[],epoch=0,busy=false;
 const note=value=>status.textContent=value;
 const clear=()=>{session=null;companies=[];company.replaceChildren();results.replaceChildren();};
 async function identity(){const auth=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(!auth?.isAuthenticated||!auth.user?.id||!sb?.auth?.getUser||!sb?.rpc||!sb?.from)
   throw Error('Authenticated company owner required');
  const user=await sb.auth.getUser();if(user.error||user.data?.user?.id!==auth.user.id)
   throw Error('Authenticated session mismatch');
  return {uid:auth.user.id,sb};}
 function render(review){results.replaceChildren();if(review.state==='withheld'){note('WITHHELD: '+review.reason);return;}
  note(review.state.toUpperCase()+' · '+review.dispatch_count+' dated Dispatch record(s), '+review.signout_count+
   ' checkouts, '+review.material_count+' issue lines. Advisory only — no work, Safety, stock or financial authorization.');
  for(const [title,entries,category] of [['Conflicting assignments',review.conflicts,'conflict'],
    ['Missing or inconsistent original proof',review.gaps,'gap'],
    ['Required manual review',review.reviews,'review']]){
   const section=make('section');section.className='notice';section.dataset.owner435Category=category;
   section.style.cssText='min-width:0;overflow-wrap:anywhere;box-sizing:border-box;border:1px solid #64748b;border-radius:10px;padding:12px';
   section.append(make('h3',title+' · '+entries.length));
   if(!entries.length)section.append(make('p','None detected in the bounded source; this is not a resource clearance.'));
   const list=make('ul');for(const entry of entries){const li=make('li');li.append(make('strong',entry.subject+' — '),document.createTextNode(entry.message));list.append(li);}
   section.append(list);results.append(section);
  }
 }
 async function read(current){const c=companies.find(x=>x.id===company.value);
  if(!session||session.uid!==current.uid||!c||c.owner_user_id!==current.uid)
   throw Error('Select a freshly verified owner company');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date.value))throw Error('Choose a valid UTC start date');
  const start=new Date(date.value+'T00:00:00.000Z');if(!Number.isFinite(start.getTime()))throw Error('Invalid UTC date');
  const end=new Date(start.getTime()+7*86400000);
  const r=await current.sb.rpc('ywi_rpc_shared_capacity_review_435',{
   p_company_id:c.id,p_window_start:start.toISOString(),p_window_end:end.toISOString()});
  if(r.error||!r.data)throw Error('Guarded original conflict source unavailable');
  if(!session||session.uid!==window.YWI_AUTH?.getState?.()?.user?.id||
     company.value!==c.id||date.value!==start.toISOString().slice(0,10))
   throw Error('Owner session or review selection changed during read');
  render(inspect(r.data,c.id,start.toISOString(),end.toISOString()));
 }
 async function run(fn){if(busy)return;busy=true;for(const ctrl of [refresh,company,date])ctrl.disabled=true;
  const before=epoch;try{await fn();if(before!==epoch)throw Error('Owner session changed during review');}
  catch(err){results.replaceChildren();note('WITHHELD: '+(err?.message||err)+'. No reallocation or cost action performed.');}
  finally{busy=false;for(const ctrl of [refresh,company,date])ctrl.disabled=false;}}
 refresh.addEventListener('click',()=>run(async()=>{
  const current=await identity();
  if(!session||session.uid!==current.uid){
   clear();session=current;
   const r=await current.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
   if(r.error||!Array.isArray(r.data)||r.data.length>100||
      new Set(r.data.map(c=>c.id)).size!==r.data.length||
      r.data.some(c=>!valid(c.id)||!valid(c.name)||c.owner_user_id!==current.uid))
    throw Error('Owner company directory withheld or capped');
   companies=r.data;const option=make('option','Choose verified company');option.value='';company.append(option);
   for(const c of companies){const opt=make('option',c.name);opt.value=c.id;company.append(opt);}
   if(companies.length===1)company.value=companies[0].id;
  }
  if(!company.value){note('Select verified owner company and refresh for a seven-day review.');return;}
  await read(current);
 }));
 company.addEventListener('change',()=>{results.replaceChildren();note('Company changed; refresh original evidence.');});
 date.addEventListener('change',()=>{results.replaceChildren();note('Window changed; refresh original evidence.');});
 document.addEventListener('ywi:auth-changed',()=>{epoch++;clear();note('Session changed; sign in and refresh original evidence.');});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

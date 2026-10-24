/* Item 436 — read-only original Jobs/Production and specialist evidence review.
   Existing owner-guarded 424–428 RPCs remain canonical. No production, Safety,
   regulatory, QC, payment or Jobs completion write is performed here. */
(()=>{'use strict';
const services=Object.freeze({
 landscape:{label:'Landscaping / grounds',rpc:'ywi_rpc_landscape_field_dashboard_424',id:424},
 construction:{label:'Construction / repairs',rpc:'ywi_rpc_construction_dashboard_425',id:425},
 water_parks:{label:'Water park maintenance',rpc:'ywi_rpc_aquatic_dashboard_426',id:426},
 snow_removal:{label:'Snow removal / de-icing',rpc:'ywi_rpc_snow_service_dashboard_427',id:427},
 snow_plowing:{label:'Snow plowing',rpc:'ywi_rpc_snow_service_dashboard_427',id:427},
 septic:{label:'Septic haulage',rpc:'ywi_rpc_septic_disposal_dashboard_428',id:428}
});
const keys=Object.keys(services);
const make=(tag,value)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=String(value);return el;};
const text=value=>typeof value==='string'&&value.trim().length>0;
const fail=reason=>({state:'withheld',reason,gaps:[],evidence:[],authorized:false});
const duplicate=a=>new Set(a.map(x=>String(x?.id))).size!==a.length;
const within=(a,max=80)=>Array.isArray(a)&&a.length<=max&&a.every(x=>x&&typeof x==='object'&&text(String(x.id??'')))&&!duplicate(a);
const hold=(gaps,reason,reference)=>gaps.push({reason,reference:String(reference||'Original source')});
const count=(a)=>a.length;

function inspectDirectory(data,companyId,key){
 if(!services[key]||data?.company_id!==companyId||data.work_order_id!==null||
    data.complete!==true||data.source_limit!==80||data.state!=='choose_order'||
    !within(data.orders,60))return fail('Owner company or canonical order directory is missing, foreign, incomplete or capped');
 const orders=key.startsWith('snow_')?data.orders.filter(x=>x.service===key):data.orders;
 if(key.startsWith('snow_')&&data.orders.some(x=>!['snow_removal','snow_plowing'].includes(x.service)))
  return fail('Original storm work-order service identity is inconsistent');
 if(orders.some(o=>!text(o.number)||!text(o.status)))
  return fail('Original Jobs order labels are incomplete');
 return {state:'review',orders,authorized:false};
}

function inspect(data,{companyId,workOrderId,serviceKey,enabled=true}){
 const service=services[serviceKey];
 if(!service||!companyId||!workOrderId||data?.company_id!==companyId||
    data.work_order_id!==workOrderId||data.complete!==true||data.source_limit!==80||
    !['review_only','hold'].includes(data.state)||!within(data.orders,60)||
    !data.orders.some(o=>o.id===workOrderId))return fail('Exact company, original Jobs order or complete bounded service source not verified');
 const order=data.orders.find(o=>o.id===workOrderId);
 if(!text(order.number)||!text(order.status)||
    (serviceKey.startsWith('snow_')&&order.service!==serviceKey))
  return fail('Selected original work order belongs to a different service or has no verified identity');
 const names={
  landscape:['sources','receipts'],construction:['phases','permits','safety','changes','lines'],
  water_parks:['inspections','followups','safety'],
  snow_removal:['sources','receipts','workability','safety','fleet'],
  snow_plowing:['sources','receipts','workability','safety','fleet'],
  septic:['dispatch','artifacts','fleet','safety','receipts']
 }[serviceKey];
 const checked=name=>{
  if(name==='sources'&&serviceKey.startsWith('snow_')){
   const rows=data.sources;
   return Array.isArray(rows)&&rows.length<=80&&rows.every(x=>x&&text(String(x.dispatch_id??''))&&
    text(String(x.activation_id??'')))&&
    new Set(rows.map(x=>String(x.dispatch_id)+':'+String(x.activation_id))).size===rows.length;
  }
  return within(data[name]);
 };
 if(names.some(name=>!checked(name)))return fail('Specialist original source absent, duplicated or capped; no partial completion inference');
 const gaps=[],evidence=[];
 const note=(name,items,unit)=>evidence.push({name,count:count(items),unit});
 if(!enabled)hold(gaps,'Service offering is disabled for NEW work; historical review grants no new work authority','Company 420 entitlement');
 if(data.state==='hold')hold(gaps,'Original specialist source reported changed or adverse evidence','Specialist dashboard');
 switch(serviceKey){
 case 'landscape':{
  note('Measured Production quantities',data.sources,'original quantity rows');
  note('Field attestation receipts',data.receipts,'424 receipts');
  if(!data.sources.length)hold(gaps,'No original session Production quantity recorded','Jobs/Production');
  const byId=new Map(data.sources.map(q=>[String(q.id),q]));
  const seen=new Set();
  for(const r of data.receipts){
   if(!text(r.production_quantity_id)||!byId.has(String(r.production_quantity_id))||seen.has(String(r.production_quantity_id)))
    return fail('Landscape attestation duplicates or references an absent original measured quantity');
   seen.add(String(r.production_quantity_id));
   if(r.state!=='recorded_unreviewed')hold(gaps,'Attestation source changed or requires reconciliation',r.id);
  }
  for(const q of data.sources){
   if(q.eligible!==true||!Number.isFinite(Number(q.actual_quantity))||Number(q.actual_quantity)<=0||
      !text(q.unit_label)||!text(q.metric_label))
    hold(gaps,'Measured production row is not eligible/complete original field evidence',q.id);
   if(!seen.has(String(q.id)))hold(gaps,'Original measured quantity has no 424 field attestation receipt',q.id);
  }
  evidence.push({name:'Measurement totals',count:null,unit:'Not combined across units, sessions or activities'});
  break;
 }
 case 'construction':{
  note('Original construction phases',data.phases,'425 phase records');
  note('Reported permit/document notes',data.permits,'425 reported receipts');
  note('Original work-order lines',data.lines,'Jobs plan lines');
  if(!data.phases.length)hold(gaps,'No original construction phase recorded','Jobs/425 phases');
  if(!data.lines.length)hold(gaps,'No original work-order scope/plan line in the source','Jobs plan');
  const phaseIds=new Set(data.phases.map(p=>String(p.id)));
  for(const permit of data.permits){
   if(!phaseIds.has(String(permit.phase_id)))return fail('Permit receipt does not reference an original phase in this work order');
   if(permit.evidence_state!=='recorded_unverified'||permit.financial_gate==='hold'||permit.safety_gate==='hold')
    hold(gaps,'Reported permit source, Safety or financial review is unresolved',permit.id);
  }
  for(const phase of data.phases)if(!data.permits.some(p=>String(p.phase_id)===String(phase.id)))
   hold(gaps,'No original operator-reported permit/document evidence for this phase; permit requirements are NOT determined here',phase.id);
  if(!data.safety.length)hold(gaps,'Original phase/site Safety plan not located','Original Safety');
  if(!data.release?.signoff_present||!['approved','released'].includes(data.release.release_status)||data.release.threshold_status!=='pass')
   hold(gaps,'Original work-order release and financial sign-off are not independently complete','Jobs release');
  if(data.changes.some(c=>c.customer_authorization_status!=='authorized'||c.scope_application_status!=='applied'||c.budget_applied!==true))
   hold(gaps,'Original change-order customer/scope/budget application remains unresolved','Original changes');
  break;
 }
 case 'water_parks':{
  note('Original aquatic inspection observations',data.inspections,'426 reports');
  note('Operator follow-up observations',data.followups,'426 follow-ups');
  if(!data.inspections.length)hold(gaps,'No original aquatic inspection observation found','Aquatic 426');
  if(!data.safety.length)hold(gaps,'Original work-order/site Safety plan is absent','Original Safety');
  const inspections=new Set(data.inspections.map(x=>String(x.id)));
  for(const r of data.inspections){
   if(r.evidence_state!=='recorded_unverified'||r.closure_gate==='hold'||r.observed_issue!=='none_reported')
    hold(gaps,'Aquatic concern, changed source or Safety closure hold; no independent clearance',r.id);
  }
  for(const f of data.followups){
   if(!inspections.has(String(f.inspection_id)))return fail('Follow-up references an absent or foreign original aquatic inspection');
   if(f.evidence_state!=='recorded_unverified')hold(gaps,'Aquatic follow-up original source changed',f.id);
  }
  evidence.push({name:'Regulatory reopening',count:null,unit:'Not certified by reported inspections or follow-ups'});
  break;
 }
 case 'snow_removal':case 'snow_plowing':{
  note('Original storm/Dispatch activations',data.sources,'dispatch + storm links');
  note('Service-specific storm receipts',data.receipts,'427 operator reports');
  if(!data.sources.length)hold(gaps,'No original storm activation tied to the work order','Storm + Dispatch');
  if(!data.workability.length)hold(gaps,'No original winter Workability observation','Workability');
  if(!data.safety.length)hold(gaps,'No original site Safety plan','Original Safety');
  if(serviceKey==='snow_plowing'&&!data.fleet.length)hold(gaps,'No original truck Fleet readiness source for plowing','Fleet');
  const dispatchIds=new Set(data.sources.map(x=>String(x.dispatch_id)));
  for(const r of data.receipts){
   if(r.service_module_key!==serviceKey||!dispatchIds.has(String(r.dispatch_id)))
    return fail('Storm receipt crosses snow services or references absent Dispatch evidence');
   if(r.evidence_state!=='reported_unverified'||r.source_gate==='hold')
    hold(gaps,'Original storm/workability/Fleet/Safety evidence changed or remains on HOLD',r.id);
  }
  for(const d of data.sources)if(!data.receipts.some(r=>String(r.dispatch_id)===String(d.dispatch_id)))
   hold(gaps,'Original Dispatch/storm activation lacks its distinct service receipt',d.dispatch_id);
  if(!data.receipts.length)hold(gaps,'No original service-specific storm receipt recorded','Snow 427');
  evidence.push({name:'Cleared route or snowfall volume',count:null,unit:'Not inferred from storm activation or reported passes'});
  break;
 }
 case 'septic':{
  note('Original haulage Dispatch',data.dispatch,'Jobs/Dispatch records');
  note('Stored proof-media documents',data.artifacts,'original stored assets');
  note('Facility disposal ticket receipts',data.receipts,'428 operator reports');
  for(const [items,reason] of [[data.dispatch,'Original collection Dispatch missing'],[data.artifacts,'Stored original disposal-ticket proof-media missing'],
   [data.fleet,'Original Fleet readiness not recorded'],[data.safety,'Original site Safety plan not recorded'],
   [data.receipts,'Operator-reported facility/disposal receipt missing']])if(!items.length)hold(gaps,reason,'Original Jobs/Fleet/Safety/428');
  const dispatchIds=new Set(data.dispatch.map(x=>String(x.id)));
  const assetIds=new Set(data.artifacts.map(x=>String(x.id)));
  for(const r of data.receipts){
   if(!dispatchIds.has(String(r.dispatch_id))||!assetIds.has(String(r.original_proof_media_id)))
    return fail('Disposal receipt references an absent original Jobs Dispatch or stored ticket');
   if(!text(r.disposal_facility)||!text(r.disposal_receipt_number)||
      !Number.isFinite(Number(r.measured_volume_l))||Number(r.measured_volume_l)<=0)
    hold(gaps,'Operator disposal facility, document number or measured litres incomplete',r.id);
   if(r.evidence_state!=='operator_reported_unverified'||r.review_gate==='hold')
    hold(gaps,'Original disposal/Fleet/Safety provenance changed or review remains on HOLD',r.id);
  }
  evidence.push({name:'Disposed volume total',count:null,unit:'Never aggregated as a certified disposal amount'});
  break;
 }
 }
 return {state:gaps.length?'hold':'review',company_id:companyId,work_order_id:workOrderId,
  service_key:serviceKey,service_label:service.label,order_number:order.number,
  enabled,authorized:false,completed:false,certified:false,source_build:service.id,
  evidence,gaps,review:'Original operator evidence only. Independent Jobs, QC, Safety, customer and regulatory approvals remain mandatory.'};
}
window.YWI436=Object.freeze({services,inspectDirectory,inspect});

function mount(){
 const host=document.getElementById('admin');if(!host||document.getElementById('owner436'))return;
 const panel=make('details');panel.id='owner436';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Service-Native Production and Evidence Review';
 panel.dataset.adminHubGroups='management operations jobs';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.append(make('summary','436 · Service-Native Production & Evidence Completion Review'));
 const body=make('div');body.className='admin-panel-block';
 body.append(make('p','Review actual original work orders separately for six services. Quantities, phases, inspections, snow events and disposal tickets are NOT interchangeable. Missing records stay HOLD; complete source coverage still means REVIEW, never job completion.'));
 const help=make('a','ⓘ Service-native production and evidence Help');help.href='/help.html#service-native-production-review-436';body.append(help);
 const fields=make('div');fields.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px;min-width:0';
 const picker=(labelText,id)=>{const label=make('label',labelText),select=make('select');select.id=id;
  select.style.cssText='display:block;width:100%;max-width:100%;min-width:0;box-sizing:border-box';label.append(select);fields.append(label);return select;};
 const company=picker('Verified owner company','owner436Company');
 const service=picker('Independent service offering','owner436Service');
 const order=picker('Original service work order','owner436Order');body.append(fields);
 const refresh=make('button','Refresh original production and specialist evidence');refresh.type='button';refresh.id='owner436Refresh';refresh.className='secondary';body.append(refresh);
 const status=make('p','Authenticate as a company owner and refresh. No original work has been reviewed.');status.id='owner436Status';
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const results=make('div');results.id='owner436Results';results.style.cssText='display:grid;gap:12px;min-width:0;max-width:100%;overflow-wrap:anywhere';body.append(results);
 panel.append(body);host.append(panel);
 let session=null,companies=[],entitlements=[],epoch=0,busy=false;
 const note=value=>{status.textContent=value;};
 function options(target,rows,label,placeholder){target.replaceChildren();const empty=make('option',placeholder);empty.value='';target.append(empty);
  for(const item of rows){const opt=make('option',label(item));opt.value=item.id;target.append(opt);}}
 const clear=()=>{session=null;companies=[];entitlements=[];company.replaceChildren();service.replaceChildren();order.replaceChildren();results.replaceChildren();};
 async function identity(){const state=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(!state?.isAuthenticated||!state.user?.id||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)throw Error('Verified owner authentication required');
  const u=await sb.auth.getUser();if(u.error||u.data?.user?.id!==state.user.id)throw Error('Authenticated identity mismatch');
  return {uid:state.user.id,sb};}
 async function rpc(sb,name,companyId,orderId){const r=await sb.rpc(name,{p_company_id:companyId,p_work_order_id:orderId});
  if(r.error||!r.data)throw Error('Canonical read-only '+name+' source denied, missing or incomplete');return r.data;}
 function render(review){results.replaceChildren();if(review.state==='withheld'){note('WITHHELD: '+review.reason);return;}
  note(review.state.toUpperCase()+' · '+review.service_label+' · '+review.order_number+
   '. Original evidence only: not approved, completed, invoiced or certified.');
  const summary=make('section');summary.className='notice';summary.dataset.owner436Group='evidence';
  summary.style.cssText='border:1px solid #64748b;border-radius:10px;padding:12px;min-width:0;overflow-wrap:anywhere';
  summary.append(make('h3','Original source evidence · 42'+String(review.source_build).slice(-1)));
  const ul=make('ul');for(const row of review.evidence){const li=make('li',row.name+': '+(row.count===null?row.unit:row.count+' '+row.unit));ul.append(li);}summary.append(ul);results.append(summary);
  const gaps=make('section');gaps.className='notice';gaps.dataset.owner436Group='holds';
  gaps.style.cssText=summary.style.cssText;gaps.append(make('h3','Missing or changed originals · '+review.gaps.length));
  if(!review.gaps.length)gaps.append(make('p','None detected in this specific order source; independent sign-off is still required.'));
  const list=make('ul');for(const g of review.gaps)list.append(make('li',g.reference+': '+g.reason));gaps.append(list);results.append(gaps);
  results.append(make('p',review.review));
 }
 async function load(){
  const startEpoch=epoch,current=await identity();
  const stillOwner=()=>startEpoch===epoch&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&
   window.YWI_AUTH?.getState?.()?.user?.id===current.uid&&(!session||session.uid===current.uid);
  const assertFresh=()=>{if(!stillOwner())throw Error('Owner session changed during original source read');};
  assertFresh();
  if(!session||session.uid!==current.uid){
   clear();session=current;
  }
  const savedCompany=company.value,savedService=service.value,savedOrder=order.value;
  const companiesResult=await current.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  assertFresh();
  if(companiesResult.error||!Array.isArray(companiesResult.data)||companiesResult.data.length>100||
    duplicate(companiesResult.data)||companiesResult.data.some(c=>!text(c.id)||!text(c.name)||c.owner_user_id!==current.uid))
   throw Error('Verified owner company list is missing, foreign or capped');
  companies=companiesResult.data;options(company,companies,c=>c.name,'Choose verified owner company');
  if(companies.some(c=>c.id===savedCompany))company.value=savedCompany;
  else if(companies.length===1)company.value=companies[0].id;
  if(!company.value){service.replaceChildren();order.replaceChildren();results.replaceChildren();note('Select an existing verified owner company and refresh.');return;}
  const selected=companies.find(c=>c.id===company.value);
  const registry=await current.sb.from('ywi_company_service_modules').select('company_id,module_key,enabled').eq('company_id',selected.id).limit(7);
  assertFresh();
  if(registry.error||!Array.isArray(registry.data)||registry.data.length!==6||
    new Set(registry.data.map(r=>r.module_key)).size!==6||registry.data.some(r=>r.company_id!==selected.id||
     !keys.includes(r.module_key)||typeof r.enabled!=='boolean'))
   throw Error('Six independent company service offerings are not verified');
  entitlements=registry.data;
  options(service,entitlements.map(r=>({id:r.module_key,enabled:r.enabled})),
   r=>services[r.id].label+(r.enabled?'':' · disabled for new work'),'Choose individual service');
  if(keys.includes(savedService))service.value=savedService;
  if(!service.value){order.replaceChildren();results.replaceChildren();note('Choose an independent service and refresh.');return;}
  const source=await rpc(current.sb,services[service.value].rpc,selected.id,null);
  assertFresh();
  const directory=inspectDirectory(source,selected.id,service.value);
  if(directory.state==='withheld')throw Error(directory.reason);
  options(order,directory.orders,o=>o.number+' · '+o.status,'Choose original work order');
  if(directory.orders.some(o=>o.id===savedOrder))order.value=savedOrder;
  else if(directory.orders.length===1)order.value=directory.orders[0].id;
  if(!order.value){results.replaceChildren();note(directory.orders.length?'Select one genuine original Jobs work order and refresh.':'HOLD: No genuine original Jobs work orders for this service; no completion can be inferred.');return;}
  const companyId=selected.id,serviceKey=service.value,workOrderId=order.value;
  const detail=await rpc(current.sb,services[serviceKey].rpc,companyId,workOrderId);
  if(!stillOwner()||session?.uid!==current.uid||
    company.value!==companyId||service.value!==serviceKey||order.value!==workOrderId)
   throw Error('Owner session or original source selection changed during read');
  render(inspect(detail,{companyId,workOrderId,serviceKey,
   enabled:entitlements.find(r=>r.module_key===serviceKey)?.enabled===true}));
 }
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;
  for(const el of [company,service,order,refresh])el.disabled=true;
  try{await load();}catch(e){clear();note('WITHHELD: '+(e?.message||e)+'. No original Jobs, Safety, QC or finance write occurred.');}
  finally{busy=false;for(const el of [company,service,order,refresh])el.disabled=false;}});
 company.addEventListener('change',()=>{epoch++;entitlements=[];service.replaceChildren();order.replaceChildren();results.replaceChildren();note('Owner company changed; refresh entitlements and original Jobs sources.');});
 service.addEventListener('change',()=>{epoch++;order.replaceChildren();results.replaceChildren();note('Service changed; refresh its own original work orders.');});
 order.addEventListener('change',()=>{epoch++;results.replaceChildren();note('Original work order changed; refresh this specific service evidence.');});
 document.addEventListener('ywi:auth-changed',()=>{epoch++;clear();note('Owner session changed. Sign in and refresh original sources.');});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

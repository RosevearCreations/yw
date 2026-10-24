/* YW 440 / Property Maintenance System: read-only owner seasonal provenance and
   truthful company-service directory. Existing 420 server entitlements are the
   sole owner switches; planned services are not provisioned or permitted. */
(()=>{'use strict';
const services=Object.freeze({landscape:'Lawn Care & Grounds',snow_removal:'Snow Removal & De-icing',
 snow_plowing:'Plowing & Winter Routes',septic:'Septic & Vacuum',
 construction:'Light Construction & Repairs',water_parks:'Aquatic & Water Facilities'});
const future=Object.freeze(['Arboriculture & Tree Care','Concrete Forms & Pours',
 'Fibre, Trenching & Utility Lines','Land Clearing & Grading','Ditch Digging & Drainage',
 'Hardscaping & Retaining Walls','Fences, Decks & Outdoor Structures',
 'Excavation & Site Preparation','Commercial Property Inspections']);
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const iso=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'));
const noWrite=Object.freeze({renewal_authorized:false,dispatch_authorized:false,
 billing_authorized:false,field_completion_authorized:false,payroll_authorized:false});
const fail=reason=>({state:'withheld',reason,holds:[],first_use:null,...noWrite});
const hold=(arr,reason)=>arr.push(reason);
function verifyRegistry(rows,companyId){
 if(!Array.isArray(rows)||rows.length!==6||new Set(rows.map(x=>x.module_key)).size!==6||
  rows.some(x=>x.company_id!==companyId||!Object.hasOwn(services,x.module_key)||typeof x.enabled!=='boolean'))
  throw Error('Six-service company registry is incomplete or foreign');
 return Object.fromEntries(rows.map(x=>[x.module_key,x.enabled]));
}
function inspect(c,field,{companyId,workOrderId,serviceKey}){
 if(!uuid(companyId)||!uuid(workOrderId)||!['landscape','snow_removal','snow_plowing'].includes(serviceKey))
  return fail('Original company, Jobs order and seasonal service identity required');
 if(!c||c.company_id!==companyId||c.work_order_id!==workOrderId||c.complete!==true||
  c.state!=='review_only'||c.source_limit!==80||c.mutation_authorized!==false||
  c.automatic_renewal!==false||c.automatic_dispatch!==false||c.automatic_billing!==false||
  c.agreement_scope!=='owner_created_exact_customer_and_property_only'||
  typeof c.service_enabled_now!=='boolean'||
  !['agreements','visit_events','snow_triggers','dispatch_routes'].every(k=>Array.isArray(c[k])&&c[k].length<=80)||
  c.agreements.length>20||!c.order||c.order.id!==workOrderId||c.order.service!==serviceKey||
  !uuid(c.order.client_id)&&c.order.client_id!==null||
  !uuid(c.order.client_site_id)&&c.order.client_site_id!==null||
  !Array.isArray(field?.receipts)||field.receipts.length>80||field.company_id!==companyId||
  field.work_order_id!==workOrderId||field.complete!==true||field.source_limit!==80)
  return fail('Original owner / contract / field source changed, is foreign, malformed or over cap');
 const snow=serviceKey!=='landscape';
 if(snow?(field.state!=='review_only'||field.no_automatic_dispatch!==true||
   field.no_double_billing!==true||!Array.isArray(field.sources)||!Array.isArray(field.orders)):
   (!['review_only','hold'].includes(field.state)||field.review_only!==true||
   !Array.isArray(field.sources)||!Array.isArray(field.orders)))
  return fail('Original service-specific 424/427 field evidence unavailable');
 if(!field.orders.some(o=>o.id===workOrderId&&(snow?o.service===serviceKey:true)))
  return fail('Original company Jobs order disagrees with field-service directory');
 const unique=(items,k)=>new Set(items.map(x=>x[k])).size===items.length;
 if(!unique(c.agreements,'id')||!unique(c.visit_events,'id')||!unique(c.snow_triggers,'id')||
  !unique(c.dispatch_routes,'dispatch_id')||!unique(field.receipts,'id'))
  return fail('Duplicate original contract, visit, trigger, route or field receipt');
 if(c.agreements.some(a=>!uuid(a.id)||!a.agreement_code||!a.service_name||
   a.client_id!==c.order.client_id||a.client_site_id!==c.order.client_site_id||
   a.route_id!==null&&!uuid(a.route_id)||
   !['draft','active','paused','completed','cancelled'].includes(a.agreement_status)||
   a.start_date!==null&&!iso(a.start_date)||a.end_date!==null&&!iso(a.end_date))||
  c.visit_events.some(v=>!uuid(v.id)||!c.agreements.some(a=>a.id===v.agreement_id)||
   !iso(v.original_service_date)||!['skip','weather_delay','makeup','customer_hold','resume','cancel_visit'].includes(v.event_type))||
  c.snow_triggers.some(t=>!uuid(t.id)||!c.agreements.some(a=>a.id===t.agreement_id)||
   !iso(t.event_date)||typeof t.trigger_met!=='boolean')||
  c.dispatch_routes.some(d=>!uuid(d.dispatch_id)||d.route_id!==null&&!uuid(d.route_id)||
   d.client_site_id!==null&&d.client_site_id!==c.order.client_site_id))
  return fail('Contract, visit or dispatch source is orphaned, inconsistent or altered');
 if(snow&&field.receipts.some(r=>!uuid(r.id)||!uuid(r.dispatch_id)||
    !uuid(r.storm_event_id)||r.service_module_key!==serviceKey||!iso(r.observed_on)||
    !['source_changed_hold','reported_unverified'].includes(r.evidence_state)||
    !['hold','independent_dispatch_safety_review_required'].includes(r.source_gate)||
    !field.sources.some(s=>s.dispatch_id===r.dispatch_id&&s.storm_event_id===r.storm_event_id)||
    !c.dispatch_routes.some(d=>d.dispatch_id===r.dispatch_id)))
  return fail('Storm receipt disagrees with original route, service or event');
 if(!snow&&field.receipts.some(r=>!uuid(r.id)||!iso(r.source_session_date)||
    !['recorded_unreviewed','hold'].includes(r.state)))
  return fail('Original landscaping visit receipt malformed');

 const holds=[];
 if(!uuid(c.order.client_id)||!uuid(c.order.client_site_id))
  hold(holds,'Company Jobs order has no verified original customer AND property link; legacy CRM cannot be inferred.');
 if(!c.service_enabled_now)hold(holds,'This offering is disabled for NEW company work; old contracts remain historical.');
 if(!c.agreements.length)hold(holds,'No exact owner-created, same-customer-and-property recurring agreement can be proved.');
 if(c.agreements.length>1)hold(holds,'Multiple dated agreements share this property: renewal/supersession is not evidenced by a canonical contract link.');
 const agreement=c.agreements.length===1?c.agreements[0]:null;
 if(agreement){
  if(agreement.agreement_status!=='active')hold(holds,'Original recurring agreement is not currently active.');
  if(agreement.route_id&&!c.dispatch_routes.some(d=>d.route_id===agreement.route_id))
   hold(holds,'Agreement route is not the original company Jobs dispatch route.');
  if(agreement.start_date&&agreement.end_date&&agreement.start_date>agreement.end_date)
   return fail('Original agreement effective date interval is invalid');
 }
 if(c.visit_events.some(v=>['weather_delay','customer_hold','cancel_visit','skip'].includes(v.event_type)))
  hold(holds,'Manual skipped/held/weather-rescheduled dates exist; original timeline requires operator reconciliation.');
 if(!field.receipts.length)hold(holds,'No dated first-visit field receipt exists. Missing is not zero visits.');
 const dated=field.receipts.map(r=>snow?r.observed_on:r.source_session_date).sort();
 const first=dated.length?dated[0]:null;
 if(first&&agreement&&((agreement.start_date&&first<agreement.start_date)||
  (agreement.end_date&&first>agreement.end_date)))
  hold(holds,'Earliest reported field receipt is outside the contract effective dates.');
 if(snow){
  if(!c.snow_triggers.length)hold(holds,'No original contract snow trigger is recorded.');
  if(c.snow_triggers.some(t=>!t.trigger_met))
   hold(holds,'Some original contract triggers were not met.');
  if(!field.sources.length)hold(holds,'No original storm/route activation joined to company dispatch.');
  if(field.receipts.some(r=>r.source_gate==='hold'||r.evidence_state==='source_changed_hold'))
   hold(holds,'Dispatch, Workability, Safety, Fleet or frozen field source is on HOLD.');
  // Legacy snow_event_triggers and seasonal_storm_events have separate IDs; same
  // date cannot prove they are the same event or automatically authorize work.
  hold(holds,'Contract snow trigger and operational storm event have NO canonical event-ID link; a matching date is insufficient.');
 }else if(field.receipts.some(r=>r.state!=='recorded_unreviewed'))
  hold(holds,'A first-use landscape observation has changed original source and is on HOLD.');
 if(first)hold(holds,'First-use date is a REPORTED receipt only; independent QC/customer acceptance is not established.');
 return {state:holds.length?'hold':'review',company_id:companyId,work_order_id:workOrderId,
  service:serviceKey,order:c.order.number,service_enabled_now:c.service_enabled_now,
  counts:{agreements:c.agreements.length,visits:c.visit_events.length,
   snow_triggers:c.snow_triggers.length,dispatches:c.dispatch_routes.length,
   storm_activations:snow?field.sources.length:0,field_receipts:field.receipts.length},
  agreement:agreement?{code:agreement.agreement_code,status:agreement.agreement_status,
   start:agreement.start_date,end:agreement.end_date,route_id:agreement.route_id}:null,
  first_use:first?{date:first,kind:'reported_only'}:null,holds,...noWrite,
  note:'Source-only, not verified completion, renewed contract, billable event, automatic plow route or Finance approval.'};
}
window.YWI440=Object.freeze({services,future,verifyRegistry,inspect});
const el=(tag,txt)=>{const e=document.createElement(tag);if(txt!==undefined)e.textContent=String(txt);return e;};
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('owner440'))return;
 const panel=el('details');panel.id='owner440';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Property Maintenance System: Company Modules and Seasonal Continuity';
 panel.dataset.adminHubGroups='management operations jobs finance';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.append(el('summary','440 · Property Maintenance System · Services & Seasonal First-Use'));
 const body=el('div');body.className='admin-panel-block';
 body.append(el('p','Property Maintenance System is the shared platform; Yard Workers is the first company. Six services currently have real owner switches and separate workflow panels. The new service specialties and Accounting/Payroll/HR separation below are PLANNED, not active modules.'));
 const help=el('a','ⓘ Property Maintenance System & Build 440 Help');help.href='/help.html#pms-seasonal-continuity-440';body.append(help);
 const catalog=el('div');catalog.id='owner440Catalog';catalog.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:10px;min-width:0';
 const group=(title,items,tag)=>{const box=el('section');box.className='notice';box.style.cssText='border:1px solid #64748b;border-radius:10px;padding:12px;min-width:0;overflow-wrap:anywhere';box.dataset.owner440Group=tag;box.append(el('h3',title));const list=el('ul');for(const txt of items)list.append(el('li',txt));box.append(list);catalog.append(box);return list;};
 const current=group('Current service switches · 420/421',Object.values(services).map(x=>x+' · sign in to see company state'),'live');
 group('Proposed service modules · NOT ACTIVE',future.map(x=>x+' · planned'),'planned');
 group('Core system / Accounting umbrella',[
  'Clients & Properties · existing CRM, company isolation expansion queued',
  'Jobs, Contracts, Dispatch, Equipment & Safety · existing shared functions',
  'Accounting: GL, A/R, A/P, costing, tax, banking & reports · consolidation queued',
  'Payroll & employee compensation · PRIVATE sub-permissions and review required',
  'Employee profiles, certifications, leave & training · HR separation queued',
  'Disable module = hide navigation and deny NEW server writes; preserve historical ledgers'], 'core');
 body.append(catalog);
 const link=el('a','Manage the six CURRENT offerings in audited Company Service Registry (420)');link.href='#owner420';body.append(link);
 body.append(el('h3','Seasonal contract, first-use & plowing event reconciliation'));
 body.append(el('p','Read-only original owner/customer/property provenance. Contract triggers are different records from operational storms. Reported visits do not authorize completion, renewal, dispatch, payroll or invoicing.'));
 const grid=el('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,215px),1fr));gap:10px';
 const picker=(label,id)=>{const outer=el('label',label),select=el('select');select.id=id;select.style.cssText='display:block;width:100%;min-width:0';outer.append(select);grid.append(outer);return select;};
 const company=picker('Verified owner company','owner440Company'),service=picker('Seasonal service','owner440Service'),order=picker('Original Jobs work order','owner440Order');body.append(grid);
 const refresh=el('button','Review original seasonal continuity');refresh.type='button';refresh.className='secondary';refresh.id='owner440Refresh';body.append(refresh);
 const status=el('p','Sign in as a company owner and refresh.');status.id='owner440Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const results=el('div');results.id='owner440Results';results.style.cssText='display:grid;gap:10px;min-width:0;overflow-wrap:anywhere';body.append(results);
 panel.append(body);host.append(panel);
 const fill=(select,rows,label)=>{const saved=select.value;select.replaceChildren();const o=el('option',label);o.value='';select.append(o);for(const r of rows){const opt=el('option',r.label);opt.value=r.id;select.append(opt);}if(rows.some(r=>r.id===saved))select.value=saved;else if(rows.length===1)select.value=rows[0].id;};
 const clear=()=>{company.replaceChildren();service.replaceChildren();order.replaceChildren();results.replaceChildren();current.replaceChildren();for(const x of Object.values(services))current.append(el('li',x+' · sign in to see company state'));};
 let epoch=0,busy=false,uid=null,companies=[],registry=null,orders=[];
 async function owner(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!a.user?.id||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)throw Error('Verified company-owner login required');
  const auth=await sb.auth.getUser();if(auth.error||auth.data?.user?.id!==a.user.id)throw Error('Owner authentication changed');return{uid:a.user.id,sb};}
 const rpc=async(sb,name,id,orderId)=>{const r=await sb.rpc(name,{p_company_id:id,p_work_order_id:orderId});
  if(r.error||!r.data)throw Error('Owner-scoped original source unavailable ('+name+')');return r.data;};
 const alive=(ownerId,start)=>epoch===start&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&window.YWI_AUTH.getState().user?.id===ownerId;
 function show(r){results.replaceChildren();if(r.state==='withheld'){status.textContent='WITHHELD: '+r.reason;return;}
  status.textContent=r.state.toUpperCase()+' · '+services[r.service]+' · '+r.order+' · manual original-source review';
  const card=(title,lines,tag)=>{const section=el('section');section.className='notice';section.dataset.owner440Result=tag;section.style.cssText='padding:12px;border:1px solid #64748b;border-radius:10px;overflow-wrap:anywhere;min-width:0';section.append(el('h4',title));const ul=el('ul');for(const line of lines)ul.append(el('li',line));section.append(ul);results.append(section);};
  card('Original seasonal agreement',[
   'Matching contracts: '+r.counts.agreements+' · '+(r.agreement?.code||'not unambiguously linked'),
   'Current contract status: '+(r.agreement?.status||'unverified'),
   'Effective: '+(r.agreement?.start||'not supplied')+' through '+(r.agreement?.end||'open/unknown'),
   'Service is '+(r.service_enabled_now?'enabled':'disabled')+' for NEW company work. Historical records retained.'],'agreement');
  card('Original visits, dispatch and reported first-use',[
   'Visit reschedule/hold records: '+r.counts.visits,
   'Contract snow triggers: '+r.counts.snow_triggers+' · storm route activations: '+r.counts.storm_activations,
   'Original dispatch records: '+r.counts.dispatches+' · field receipts: '+r.counts.field_receipts,
   'Earliest REPORTED visit: '+(r.first_use?.date||'none recorded')+' · never completion approval.'],'firstuse');
  card('Human evidence gates · '+r.holds.length,r.holds.length?r.holds:['No source gaps in the bounded snapshot; business authorization is STILL separate.'],'holds');results.append(el('p',r.note));}
 async function load(){const start=epoch,who=await owner();if(!alive(who.uid,start))throw Error('Owner session changed');
  if(uid!==who.uid){clear();uid=who.uid;companies=[];registry=null;orders=[];}
  if(!companies.length){const r=await who.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
   if(!alive(who.uid,start)||r.error||!Array.isArray(r.data)||r.data.length>100||
    r.data.some(c=>!uuid(c.id)||!c.name||c.owner_user_id!==who.uid)||new Set(r.data.map(c=>c.id)).size!==r.data.length)
    throw Error('Complete owned-company directory required');
   companies=r.data;fill(company,companies.map(c=>({id:c.id,label:c.name})),'Choose owner company');}
  if(!companies.some(c=>c.id===company.value)){status.textContent='Select an owned company.';return;}
  const id=company.value;
  const modules=await who.sb.from('ywi_company_service_modules').select('company_id,module_key,enabled').eq('company_id',id).limit(7);
  if(!alive(who.uid,start)||company.value!==id||modules.error)throw Error('Company registry denied or changed');
  registry=verifyRegistry(modules.data,id);current.replaceChildren();for(const [key,label] of Object.entries(services))
   current.append(el('li',label+' · '+(registry[key]?'ENABLED':'DISABLED')+' for this company'));
  fill(service,['landscape','snow_removal','snow_plowing'].map(id=>({id,label:services[id]})),'Choose seasonal offering');
  if(!service.value){status.textContent='Select seasonal service to inspect.';return;}
  const chosen=service.value,remote=chosen==='landscape'?'ywi_rpc_landscape_field_dashboard_424':'ywi_rpc_snow_service_dashboard_427';
  const directory=await rpc(who.sb,remote,id,null);
  if(!alive(who.uid,start)||company.value!==id||service.value!==chosen||directory.company_id!==id||directory.work_order_id!==null||
   directory.state!=='choose_order'||directory.complete!==true||!Array.isArray(directory.orders)||directory.orders.length>60||
   directory.orders.some(o=>!uuid(o.id)||!o.number||(chosen!=='landscape'&&o.service!==chosen&&o.service!=='snow_removal'&&o.service!=='snow_plowing')))
   throw Error('Original service Jobs directory denied, changed or exceeded cap');
  orders=directory.orders.filter(o=>chosen==='landscape'||o.service===chosen);
  fill(order,orders.map(o=>({id:o.id,label:o.number+' · '+o.status})),'Choose original Jobs order');
  if(!order.value){status.textContent='HOLD: No original Jobs work order selected.';results.replaceChildren();return;}
  const orderId=order.value;
  const [c,field]=await Promise.all([rpc(who.sb,'ywi_rpc_seasonal_continuity_440',id,orderId),rpc(who.sb,remote,id,orderId)]);
  if(!alive(who.uid,start)||company.value!==id||service.value!==chosen||order.value!==orderId)
   throw Error('Source selection or owner session changed during read');
  if(c.service_enabled_now!==registry[chosen])throw Error('Company entitlement changed since registry refresh');
  show(inspect(c,field,{companyId:id,workOrderId:orderId,serviceKey:chosen}));}
 refresh.onclick=async()=>{if(busy)return;busy=true;for(const x of [refresh,company,service,order])x.disabled=true;
  try{await load();}catch(e){results.replaceChildren();status.textContent='WITHHELD: '+(e?.message||e)+'. No business mutation.';}
  finally{busy=false;for(const x of [refresh,company,service,order])x.disabled=false;}};
 company.onchange=()=>{epoch++;registry=null;orders=[];service.replaceChildren();order.replaceChildren();results.replaceChildren();status.textContent='Company changed; refresh original sources.';};
 service.onchange=()=>{epoch++;orders=[];order.replaceChildren();results.replaceChildren();status.textContent='Service changed; refresh original Jobs directory.';};
 order.onchange=()=>{epoch++;results.replaceChildren();status.textContent='Jobs order changed; refresh original seasonal evidence.';};
 document.addEventListener('ywi:auth-changed',()=>{epoch++;uid=null;clear();status.textContent='Session changed. Reauthenticate before viewing company evidence.';});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

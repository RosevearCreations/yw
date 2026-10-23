/* Item 431 — original client_sites, owner-verified intake, independent Safety HOLD.
   Intentionally read-only. No new CRM, Safety or specialist approval authority. */
(()=>{'use strict';
const fields=Object.freeze({
 area:['Approximate serviceable area','approximate_serviceable_area'],
 access:['Property access instructions','access_notes'],
 gate:['Gates, fences and equipment width','gate_fence_summary'],
 parking:['Truck, trailer and parking restrictions','parking_trailer_limits'],
 slope:['Slopes and terrain','slope_notes'],
 drainage:['Drainage, wet ground or ice-prone areas','drainage_wet_area_notes'],
 hazard:['Recorded property hazards (not a Safety assessment)','hazard_notes'],
 utilities:['Utility and locate notes','utility_locate_notes'],
 pets:['Pets, gates and customer constraints','pet_notes'],
 irrigation:['Irrigation and water lines','irrigation_notes'],
 trees:['Trees, brush and overhead obstacles','tree_brush_notes'],
 zones:['Active property zones','zones']
});
const templates=Object.freeze({
 landscape:{title:'Landscaping & grounds',fields:['area','zones','access','gate','slope','drainage','utilities','pets'],specialist:'424 · Field measurements, quantities and QC'},
 construction:{title:'Construction & repairs',fields:['access','parking','gate','utilities','hazard','slope'],specialist:'425 · Phase, permits, change approval and site Safety'},
 water_parks:{title:'Water parks',fields:['access','hazard','drainage','irrigation','utilities'],specialist:'426 · Aquatic inspection, water testing and independent closure'},
 snow_removal:{title:'Snow removal & de-icing',fields:['access','gate','slope','drainage','hazard'],specialist:'427 · Pedestrian clearing, storm route and de-icer evidence'},
 snow_plowing:{title:'Snow plowing',fields:['parking','gate','access','trees','hazard'],specialist:'427 · Separate plow route, clearance and snow storage review'},
 septic:{title:'Septic haulage',fields:['parking','gate','access','utilities','hazard','drainage'],specialist:'428 · Tank volume, truck access and actual disposal ticket'}
});
const keys=Object.freeze(Object.keys(templates));
const el=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);return n;};
const validDate=(raw,now)=>{if(!raw)return false;const ts=Date.parse(String(raw));return Number.isFinite(ts)&&ts<=now+300000;};
const present=v=>typeof v==='string'?v.trim().length>0:typeof v==='number'?Number.isFinite(v)&&v>=0:Array.isArray(v)?v.length>0:false;
function withheld(reason){return {state:'withheld',reason,cards:[],safety_status:'UNVERIFIED',approved:false};}
function inspect(input,now=Date.now()){
 const {company,uid,services,customers,customerId,history,propertyId,site,retrievedAt}=input||{};
 const core=window.YWI430?.inspect?.({company,uid,services,customers,customerId,history,retrievedAt},now);
 if(!core||core.state==='withheld')return withheld(core?.reason||'Original 430 owner identity/source verification unavailable');
 if(!customerId||!history)return withheld('Select a real owner-linked canonical customer');
 if(!propertyId||!history.properties.some(p=>p.id===propertyId))return withheld('Select a property listed by the guarded 422 customer history');
 if(!site||site.canonical_source!=='client_sites_212'||site.company_id!==company.id||
  site.client_id!==customerId||site.site_id!==propertyId||site.is_active!==true||
  !Array.isArray(site.zones)||site.zones.length>50||new Set(site.zones.map(z=>z.id)).size!==site.zones.length||
  site.zones.some(z=>!z.id||!z.zone_name)||!validDate(site.updated_at,now))
  return withheld('Original site record unavailable, inconsistent, inactive, duplicated or capped');
 if(site.safety_evidence_source!=='NOT_QUERIED'||site.safety_approval!=='UNVERIFIED')
  return withheld('Safety provenance must remain an independent unchecked authority');
 for(const date of [site.access_last_verified_at,site.property_reviewed_at])
  if(date&&!validDate(date,now))return withheld('Site review or access verification timestamp invalid');
 const cards=keys.map(key=>{
  const enabled=services.find(s=>s.module_key===key)?.enabled===true;
  const requirements=templates[key].fields.map(field=>{
   const [label,column]=fields[field];const value=field==='area'&&typeof site[column]==='number'
    ?String(site[column])+' '+(site.area_unit||'unit not recorded'):
    field==='zones'?String(site.zones.length)+' original active zone(s)':site[column];
   const recorded=field==='zones'?site.zones.length>0:present(site[column]);
   return {field,label,state:recorded?'source_recorded':'missing_source',value:recorded?String(value):null};
  });
  return {key,title:templates[key].title,enabled,state:enabled?'site_and_safety_review_required':'offering_disabled',
   requirements,missing:requirements.filter(r=>r.state==='missing_source').length,
   specialist:templates[key].specialist,safety_status:'UNVERIFIED',approved:false};
 });
 return {state:'owner_site_review_required',company_id:company.id,customer_id:customerId,property_id:propertyId,
  source_retrieved_at:retrievedAt,site_review_recorded_at:site.property_reviewed_at||null,
  access_verified_recorded_at:site.access_last_verified_at||null,
  safety_status:'UNVERIFIED',reason:'Original property facts are not proof of site safety, permit or specialist authorization.',
  cards,approved:false};
}
window.YWI431=Object.freeze({keys,templates,fields,inspect});
function mount(){
 const admin=document.getElementById('admin');if(!admin||document.getElementById('owner431'))return;
 const panel=el('details');panel.id='owner431';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Service-Specific Site Intake & Constraints';panel.dataset.adminHubGroups='management operations';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.append(el('summary','431 · Service-Specific Intake & Verified Site Constraints'));
 const body=el('div');body.className='admin-panel-block';
 body.append(el('p','Choose an actual owner company, canonical customer and linked property. We show six different intake checklists using original property records, clearly marking missing facts. Recorded notes are not a Safety clearance or measured site survey.'));
 const help=el('a','ⓘ Site intake, original sources and Safety help');help.href='/help.html#service-site-intake-431';body.append(help);
 const controls=el('div');controls.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px;min-width:0';
 function picker(id,label){const wrap=el('label',label),select=el('select');select.id=id;
  select.style.cssText='display:block;min-width:0;max-width:100%;width:100%;box-sizing:border-box';wrap.append(select);controls.append(wrap);return select;}
 const companySelect=picker('owner431Company','Verified owner company');
 const customerSelect=picker('owner431Customer','Canonical customer');
 const propertySelect=picker('owner431Property','Original customer-owned property');body.append(controls);
 const refresh=el('button','Refresh site intake sources');refresh.type='button';refresh.className='secondary';refresh.id='owner431Refresh';body.append(refresh);
 const status=el('p','Sign in, then refresh original source records. Nothing is submitted here.');status.id='owner431Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const cards=el('div');cards.id='owner431Results';cards.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:12px;min-width:0;max-width:100%';body.append(cards);
 panel.append(body);admin.append(panel);
 let context=null,companies=[],services=[],customers=[],history=null,busy=false,epoch=0;
 const note=s=>status.textContent=s;
 function choices(target,rows,label,empty){target.replaceChildren();const blank=el('option',empty);blank.value='';target.append(blank);
  for(const row of rows){const opt=el('option',label(row));opt.value=row.id;target.append(opt);}}
 function clear(){epoch++;context=null;companies=[];services=[];customers=[];history=null;cards.replaceChildren();
  choices(companySelect,[],x=>x.name,'Select company');choices(customerSelect,[],x=>x.name,'Select customer');choices(propertySelect,[],x=>x.name,'Select property');}
 function render(snapshot){cards.replaceChildren();
  if(snapshot.state==='withheld'){note('WITHHELD: '+snapshot.reason+'. Safety and intake are not approved.');return;}
  note('Original site source read. '+(snapshot.site_review_recorded_at?'Property review timestamp: '+snapshot.site_review_recorded_at+'. ':'Property review timestamp missing. ')+
   (snapshot.access_verified_recorded_at?'Access review recorded: '+snapshot.access_verified_recorded_at+'. ':'Access verification timestamp missing. ')+
   'Safety/permit/field approvals: UNVERIFIED.');
  for(const item of snapshot.cards){const card=el('article');card.dataset.owner431Service=item.key;card.dataset.owner431State=item.state;
   card.style.cssText='border:1px solid #64748b;border-radius:10px;padding:12px;min-width:0;box-sizing:border-box;overflow-wrap:anywhere';
   card.append(el('h3',item.title),el('strong',item.enabled?'SITE + SAFETY REVIEW REQUIRED':'OFFERING DISABLED'));
   const list=el('ul');for(const field of item.requirements){const li=el('li');li.dataset.owner431Field=field.field;li.dataset.owner431Evidence=field.state;
    li.append(el('strong',field.label+': '),el('span',field.value||'MISSING — confirm at original source'));list.append(li);}card.append(list);
   card.append(el('p','Recorded field count does not certify accuracy. Missing fields: '+item.missing+'. Independent Safety status: UNVERIFIED.'));
   card.append(el('p','Review source: '+item.specialist));cards.append(card);}
 }
 async function identity(){const state=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(!state?.isAuthenticated||!state.user?.id||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)throw Error('Authenticated owner session required');
  const res=await sb.auth.getUser();if(res.error||res.data?.user?.id!==state.user.id)throw Error('Authenticated identity mismatch');
  return {uid:res.data.user.id,sb};}
 async function rpc(sb,name,args){const result=await sb.rpc(name,args);if(result.error||result.data==null)throw Error('Guarded original source unavailable: '+name);return result.data;}
 async function verified(){const now=await identity();if(!context||now.uid!==context.uid)throw Error('Owner session changed; refresh');
  return now;}
 async function loadCompany(){cards.replaceChildren();history=null;services=[];customers=[];choices(customerSelect,[],x=>x.name,'Select customer');choices(propertySelect,[],x=>x.name,'Select property');
  const company=companies.find(c=>c.id===companySelect.value);if(!company){note('Choose an owner company.');return;}
  const {uid,sb}=await verified();if(company.owner_user_id!==uid)throw Error('Company owner mismatch');
  const [reg,list]=await Promise.all([sb.from('ywi_company_service_modules').select('company_id,module_key,enabled').eq('company_id',company.id).limit(7),
   rpc(sb,'ywi_rpc_company_customers_422',{p_company_id:company.id})]);
  if(reg.error||!Array.isArray(reg.data))throw Error('Owner service registry unavailable');
  services=reg.data;customers=list;
  const core=window.YWI430?.inspect?.({company,uid,services,customers,retrievedAt:new Date().toISOString()});
  if(core?.state==='withheld'||!core)throw Error(core?.reason||'Original source verification missing');
  choices(customerSelect,customers,x=>x.name+(x.is_active?'':' (inactive)'),'Select customer');
  note('Select an original company-owned customer; no site can be guessed.');}
 async function loadCustomer(){cards.replaceChildren();history=null;choices(propertySelect,[],x=>x.name,'Select property');
  const company=companies.find(c=>c.id===companySelect.value),id=customerSelect.value;if(!company||!id){note('Select a verified customer.');return;}
  const {sb,uid}=await verified();history=await rpc(sb,'ywi_rpc_customer_history_422',{p_company_id:company.id,p_client_id:id});
  const core=window.YWI430?.inspect?.({company,uid,services,customers,customerId:id,history,retrievedAt:new Date().toISOString()});
  if(core?.state==='withheld'||!core)throw Error(core?.reason||'Original history verification missing');
  choices(propertySelect,history.properties,x=>x.name+(x.address?' · '+x.address:''),'Select original property');
  note('Select the original property for the six distinct service templates.');}
 async function loadProperty(){cards.replaceChildren();const company=companies.find(c=>c.id===companySelect.value);
  const client=customerSelect.value,property=propertySelect.value;if(!company||!client||!property){note('Select a verified original property.');return;}
  const {sb,uid}=await verified(),at=new Date().toISOString();
  // RPC validates the same original linked IDs against 422 on the server, not a client-side join.
  const site=await rpc(sb,'ywi_rpc_site_intake_431',{p_company_id:company.id,p_client_id:client,p_site_id:property});
  render(inspect({company,uid,services,customers,customerId:client,history,propertyId:property,site,retrievedAt:at}));}
 async function run(fn){if(busy)return;busy=true;for(const x of [refresh,companySelect,customerSelect,propertySelect])x.disabled=true;
  const stamp=epoch;try{await fn();if(stamp!==epoch)throw Error('Session changed while source was loading');}
  catch(e){cards.replaceChildren();note('WITHHELD: '+(e?.message||e)+'. No site or Safety authority was changed.');}
  finally{busy=false;for(const x of [refresh,companySelect,customerSelect,propertySelect])x.disabled=false;}}
 refresh.addEventListener('click',()=>{if(busy)return;clear();run(async()=>{const session=await identity();const r=await session.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(r.error||!Array.isArray(r.data)||r.data.length>100||r.data.some(c=>!c.id||!c.name||c.owner_user_id!==session.uid)||
   new Set(r.data.map(c=>c.id)).size!==r.data.length)throw Error('Owner company list unavailable, capped or foreign');
  context=session;companies=r.data;choices(companySelect,companies,x=>x.name,'Select owner company');
  if(companies.length===1){companySelect.value=companies[0].id;await loadCompany();}
  else note(companies.length?'Select an owner company to inspect site constraints.':'No owner company found; use 420 for intentional setup.');});});
 companySelect.addEventListener('change',()=>run(loadCompany));
 customerSelect.addEventListener('change',()=>run(loadCustomer));
 propertySelect.addEventListener('change',()=>run(loadProperty));
 document.addEventListener('ywi:auth-changed',()=>{clear();note('Session changed. Refresh to reverify identity and original site.');});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

/* Item 430 — owner-only source-coverage runbook. Read-only canonical Item 420/422
   sources; no service switch, CRM/Jobs write, acceptance, dispatch or billing. */
(()=>{'use strict';
const keys=Object.freeze(['landscape','construction','water_parks','snow_removal','snow_plowing','septic']);
const labels=Object.freeze({landscape:'Landscaping & grounds',construction:'Construction & repairs',
 water_parks:'Water parks',snow_removal:'Snow removal & de-icing',snow_plowing:'Snow plowing',septic:'Septic haulage'});
const next=Object.freeze({landscape:'424 · Field production quantities & QC',construction:'425 · Construction phases, permit/source approval & Safety',
 water_parks:'426 · Aquatic inspections & independent Safety approval',snow_removal:'427 · Sidewalk removal dispatch, storm & Safety',
 snow_plowing:'427 · Separate plowing dispatch, storm & Fleet',septic:'428 · Actual haulage, disposal ticket, Fleet & Safety'});
const fail=reason=>({state:'withheld',reason,services:keys.map(key=>({key,state:'withheld',reason,work_order_id:null})),
 source_coverage:'withheld',accepted:false});
function inspect(input,now=Date.now()){
 const {company,uid,services,customers,customerId,history,retrievedAt}=input||{};
 const at=Date.parse(String(retrievedAt||''));
 if(!Number.isFinite(at)||at>now+300000||now-at>15*60000)return fail('Source read missing or older than 15 minutes; refresh');
 if(!uid||!company?.id||company.owner_user_id!==uid||!company.name)return fail('Authenticated company ownership not verified');
 if(!Array.isArray(services)||services.length!==6||new Set(services.map(s=>s.module_key)).size!==6||
   services.some(s=>s.company_id!==company.id||!keys.includes(s.module_key)||typeof s.enabled!=='boolean'))
   return fail('Six offering entitlements unavailable or cross-company');
 if(!Array.isArray(customers)||customers.length>=100||new Set(customers.map(c=>c.id)).size!==customers.length||
   customers.some(c=>!c.id||!c.name||typeof c.is_active!=='boolean'))
   return fail('Customer list incomplete, duplicate or capped (100)');
 const selected=customers.find(c=>c.id===customerId);
 if(customerId&&!selected)return fail('Selected customer is not in the verified company customer list');
 if(selected&&!selected.is_active)return fail('Selected canonical customer is inactive');
 if(selected){
  if(history?.company_id!==company.id||history?.client_id!==selected.id||history?.legacy_unscoped_excluded!==true||
   history.history_limit_per_type!==80||!Array.isArray(history.properties)||!Array.isArray(history.work_orders)||
   !Array.isArray(history.estimates)||history.work_orders.length>=80||history.estimates.length>=80||
   new Set(history.properties.map(p=>p.id)).size!==history.properties.length||
   new Set(history.work_orders.map(w=>w.id)).size!==history.work_orders.length||
   history.properties.some(p=>!p.id)||history.work_orders.some(w=>!w.id||!keys.includes(w.service)||
     !history.properties.some(p=>p.id===w.property_id)))
   return fail('Canonical history missing, duplicated, cross-company or capped (80); no first-job inference');
 }
 const properties=selected?history.properties:[];
 const orders=selected?history.work_orders:[];
 const results=keys.map(key=>{
  const entitlement=services.find(s=>s.module_key===key);
  let state,reason,job=null;
  if(!entitlement.enabled){state='offering_disabled';reason='Owner must explicitly enable this offering in 420; no automatic switch.';}
  else if(!selected){state='needs_customer';reason='Select or create a real canonical customer in 422.';}
  else if(!properties.length){state='needs_property';reason='Add a genuine customer-owned property in 422.';}
  else {
   const linked=orders.filter(w=>w.service===key).sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')));
   if(!linked.length){state='needs_work_order';reason='Create an authorized draft in 421 and attach the same customer/property in 422; Jobs permission is independently enforced.';}
   else {state='job_linked_review_pending';job=linked[0];reason='Original work-order link found. Field, Dispatch, QC, specialist Safety and owner acceptance are NOT verified by this runbook.';}
  }
  return {key,label:labels[key],state,reason,work_order_id:job?.id||null,
   property_id:job?.property_id||null,linked_work_order_count:orders.filter(w=>w.service===key).length,
   specialist_next:next[key],accepted:false};
 });
 return {state:'owner_review_required',reason:'Six services checked for this owner and selected customer, not the full company cohort.',
  company_id:company.id,customer_id:selected?.id||null,retrieved_at:retrievedAt,
  source_coverage:selected?'owner_company_registry_customer_history':'owner_company_registry_customer_list',
  services:results,accepted:false};
}
window.YWI430=Object.freeze({keys,inspect,labels});
const element=(tag,value)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=String(value);return el;};
function mount(){
 const host=document.getElementById('admin');if(!host||document.getElementById('owner430'))return;
 const panel=element('details');panel.id='owner430';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Six-Service Owner First Trial Runbook';panel.dataset.adminHubGroups='management operations';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.append(element('summary','430 · Six-Service Owner Trial Intake & Source Coverage'));
 const body=element('div');body.className='admin-panel-block';
 body.append(element('p','Owner-guided, read-only first-job source checklist for six separate offerings. Select a real company and canonical customer to inspect verified links; missing source evidence stays on HOLD. No data is created or accepted here.'));
 const link=element('a','ⓘ Help and source runbook');link.href='/help.html#six-service-owner-trial-430';body.append(link);
 const controls=element('div');controls.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px;margin-top:10px;min-width:0';
 const picker=(labelText,id)=>{const label=element('label',labelText);const select=element('select');select.id=id;
  select.style.cssText='display:block;width:100%;max-width:100%;min-width:0;box-sizing:border-box';label.append(select);controls.append(label);return select;};
 const companySelect=picker('Verified owner company','owner430Company');
 const customerSelect=picker('Canonical customer (never a legacy auto-claim)','owner430Customer');
 body.append(controls);
 const refresh=element('button','Refresh owner source coverage');refresh.id='owner430Refresh';refresh.type='button';refresh.className='secondary';body.append(refresh);
 const status=element('p','Refresh sources after sign-in. No first-job acceptance is implied.');status.id='owner430Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const results=element('div');results.id='owner430Results';results.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,285px),1fr));gap:12px;min-width:0;max-width:100%;overflow-wrap:anywhere';body.append(results);
 panel.append(body);host.append(panel);
 let current=null,companies=[],services=[],customers=[],busy=false;
 const note=v=>status.textContent=v;
 function options(select,list,label,placeholder){select.replaceChildren();const empty=element('option',placeholder);empty.value='';select.append(empty);
  for(const item of list){const option=element('option',label(item));option.value=item.id;select.append(option);}}
 function render(snapshot){results.replaceChildren();note(snapshot.state==='withheld'?'WITHHELD: '+snapshot.reason:
  'Read-only evidence at '+snapshot.retrieved_at+'. Every service still requires independent original-source/owner review; no acceptance occurred.');
  for(const svc of snapshot.services){const card=element('article');card.dataset.owner430Service=svc.key;card.dataset.owner430State=svc.state;
   card.style.cssText='border:1px solid #64748b;border-radius:10px;padding:12px;min-width:0;box-sizing:border-box;overflow-wrap:anywhere';
   card.append(element('h3',labels[svc.key]),element('strong',svc.state.replaceAll('_',' ').toUpperCase()),element('p',svc.reason));
   if(svc.work_order_id)card.append(element('p','Linked original Jobs ID: '+svc.work_order_id));
   card.append(element('p','Next: '+(svc.specialist_next||'Refresh verified source permissions before proceeding.')));
   results.append(card);}}
 async function identity(){const auth=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(!auth?.isAuthenticated||!auth?.user?.id||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)throw Error('Verified owner login required');
  const result=await sb.auth.getUser();if(result.error||result.data?.user?.id!==auth.user.id)throw Error('Signed-in owner identity mismatch');
  return {sb,uid:result.data.user.id};}
 async function rpc(sb,name,args){const result=await sb.rpc(name,args);if(result.error||result.data==null)throw Error('Authorized source unavailable: '+name);return result.data;}
 async function loadCompany(){results.replaceChildren();customers=[];services=[];options(customerSelect,[],c=>c.name,'Select a verified customer');
  if(!companySelect.value){note('Select an owner company. If none exist, use 420 to create one.');return;}
  const session=await identity();if(session.uid!==current?.uid)throw Error('Owner session changed');
  const company=companies.find(c=>c.id===companySelect.value);if(!company)throw Error('Company not owner verified');
  const [reg,list]=await Promise.all([
   session.sb.from('ywi_company_service_modules').select('company_id,module_key,enabled').eq('company_id',company.id).limit(7),
   rpc(session.sb,'ywi_rpc_company_customers_422',{p_company_id:company.id})]);
  if(reg.error||!Array.isArray(reg.data))throw Error('Offering registry could not be read');
  services=reg.data;customers=list;
  const snapshot=inspect({company,uid:session.uid,services,customers,retrievedAt:new Date().toISOString()});render(snapshot);
  if(snapshot.state==='withheld')return;
  options(customerSelect,customers,c=>c.name+(c.is_active?'':' (inactive)'),'Select a verified customer');}
 async function loadCustomer(){results.replaceChildren();if(!companySelect.value)return;
  const session=await identity();if(!current||session.uid!==current.uid)throw Error('Owner session changed; refresh');
  const company=companies.find(c=>c.id===companySelect.value);if(!company)throw Error('Owner company is no longer verified');
  const selected=customerSelect.value;
  const history=selected?await rpc(session.sb,'ywi_rpc_customer_history_422',{p_company_id:company.id,p_client_id:selected}):null;
  render(inspect({company,uid:session.uid,services,customers,customerId:selected||null,history,retrievedAt:new Date().toISOString()}));}
 async function run(fn){if(busy)return;busy=true;refresh.disabled=true;companySelect.disabled=true;customerSelect.disabled=true;
  try{await fn();}catch(e){results.replaceChildren();note('WITHHELD: '+(e?.message||e)+'. No approval or source write occurred.');}
  finally{busy=false;refresh.disabled=false;companySelect.disabled=false;customerSelect.disabled=false;}}
 refresh.addEventListener('click',()=>run(async()=>{
  current=null;companies=[];services=[];customers=[];results.replaceChildren();
  options(companySelect,[],c=>c.name,'Select owner company');options(customerSelect,[],c=>c.name,'Select customer');
  const session=await identity();const res=await session.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(res.error||!Array.isArray(res.data)||res.data.length>100||res.data.some(c=>!c.id||!c.name||c.owner_user_id!==session.uid)||
   new Set(res.data.map(c=>c.id)).size!==res.data.length)throw Error('Owner company list incomplete or foreign');
  current=session;companies=res.data;options(companySelect,companies,c=>c.name,'Select owner company');
  if(companies.length===1){companySelect.value=companies[0].id;await loadCompany();}
  else note(companies.length?'Select one verified company to begin the six-service trial.':'No owner company registered; create one in panel 420.');}));
 companySelect.addEventListener('change',()=>run(loadCompany));
 customerSelect.addEventListener('change',()=>run(loadCustomer));
 document.addEventListener('ywi:auth-changed',()=>{current=null;companies=[];services=[];customers=[];results.replaceChildren();companySelect.replaceChildren();customerSelect.replaceChildren();note('Session changed. Refresh owner identity and company coverage.');});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

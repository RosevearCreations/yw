/* Item 422. Company-verified links to canonical clients and client_sites.
   All data is returned by owner-scoped RPCs; no legacy claim or browser join. */
(()=>{'use strict';
const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic'];
const labels={landscape:'Landscaping',construction:'Construction',water_parks:'Water parks',
 snow_removal:'Snow removal',snow_plowing:'Snow plowing',septic:'Septic'};
const $=id=>document.getElementById(id);
const make=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);return n;};
const shortId=x=>String(x||'').slice(0,8);
const uuid=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
function validateHistory(company,client,data){
 if(data?.company_id!==company||data?.client_id!==client||data.legacy_unscoped_excluded!==true||
  !Array.isArray(data.properties)||!Array.isArray(data.estimates)||!Array.isArray(data.work_orders)||
  data.estimates.length>80||data.work_orders.length>80||data.history_limit_per_type!==80||
  data.properties.some(p=>!p.id)||[...data.estimates,...data.work_orders].some(x=>
   !x.id||!keys.includes(x.service)||!data.properties.some(p=>p.id===x.property_id)))
  throw Error('Incomplete or cross-company customer history proof');
 return data;
}
function mount(){
 const admin=$('admin');if(!admin||$('owner422'))return;
 const panel=make('details');panel.id='owner422';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Cross-Service Customer & Property Continuity';
 panel.dataset.adminHubGroups='management operations';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.appendChild(make('summary','422 · Cross-Service Customer & Property Continuity'));
 const body=make('div');body.className='admin-panel-block';
 body.appendChild(make('p','One canonical customer and property can support multiple enabled services. New company ownership is proved by a server-created link; legacy unscoped customers and sites are never auto-claimed. No automatic dispatch, contact or invoicing.'));
 const help=make('a','ⓘ Help');help.href='/help.html#cross-service-continuity-422';body.appendChild(help);
 const refresh=make('button','Refresh company customers');refresh.id='owner422Refresh';refresh.type='button';refresh.className='secondary';body.appendChild(refresh);
 const status=make('p','Refresh under an authenticated company owner.');status.id='owner422Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.appendChild(status);
 const controls=make('div');controls.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px;min-width:0';
 const select=(id,label)=>{const wrap=make('label',label);wrap.style.minWidth='0';const n=make('select');n.id=id;n.style.cssText='display:block;min-width:0;max-width:100%;width:100%;box-sizing:border-box';wrap.appendChild(n);controls.appendChild(wrap);return n;};
 const field=(id,label,limit)=>{const wrap=make('label',label);wrap.style.minWidth='0';const n=make('input');n.id=id;n.maxLength=limit;n.style.cssText='display:block;min-width:0;max-width:100%;width:100%;box-sizing:border-box';wrap.appendChild(n);controls.appendChild(wrap);return n;};
 const company=select('owner422Company','Owner company');
 const customer=select('owner422Customer','Canonical customer');
 const name=field('owner422Name','New customer legal name',120);
 const email=field('owner422Email','Billing email (optional)',254);
 const siteName=field('owner422SiteName','New property name',120);
 const address=field('owner422Address','Service address (optional)',400);
 const property=select('owner422Property','Verified property for draft');
 const kind=select('owner422Kind','Draft type');
 for(const [value,label] of [['estimate','Estimate'],['work_order','Work order']]){const opt=make('option',label);opt.value=value;kind.appendChild(opt);}
 const draft=field('owner422Draft','Existing unlinked draft UUID',36);
 body.appendChild(controls);
 const actions=make('div');actions.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;min-width:0';
 const button=(id,label)=>{const b=make('button',label);b.id=id;b.type='button';b.className='secondary';actions.appendChild(b);return b;};
 const createCustomer=button('owner422CreateCustomer','Create verified customer');
 const createSite=button('owner422CreateSite','Add verified property');
 const attach=button('owner422Attach','Attach customer/property to draft');
 const historyButton=button('owner422HistoryRefresh','Read cross-service history');
 body.appendChild(actions);
 const results=make('div');results.id='owner422Results';results.style.cssText='min-width:0;overflow-wrap:anywhere;margin-top:10px';body.appendChild(results);
 panel.appendChild(body);admin.appendChild(panel);
 let session=null,companies=[],rows=[],busy=false;
 const note=t=>status.textContent=t;
 function options(target,list,getLabel,empty){
  const prior=target.value;target.replaceChildren();const blank=make('option',empty);blank.value='';target.appendChild(blank);
  for(const r of list){const opt=make('option',getLabel(r));opt.value=r.id;target.appendChild(opt);}
  target.value=list.some(r=>r.id===prior)?prior:'';
 }
 function clear(){session=null;companies=[];rows=[];company.replaceChildren();customer.replaceChildren();property.replaceChildren();results.replaceChildren();}
 async function owner(){
  const state=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(state?.isAuthenticated!==true||!state?.user?.id||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)throw Error('Authenticated owner session required');
  const r=await sb.auth.getUser();if(r.error||r.data?.user?.id!==state.user.id)throw Error('Owner session mismatch');
  return {uid:r.data.user.id,sb};
 }
 async function checked(){
  const current=await owner();if(!session||session.uid!==current.uid)throw Error('Session changed: refresh first');
  if(!companies.some(x=>x.id===company.value))throw Error('Select a verified company');
  return current;
 }
 async function rpc(sb,method,args){const r=await sb.rpc(method,args);if(r.error||r.data===null||r.data===undefined)throw Error(r.error?.message||'Server did not confirm '+method);return r.data;}
 async function loadCustomers(current){
  const id=company.value;rows=[];customer.replaceChildren();property.replaceChildren();results.replaceChildren();
  if(!id)return;
  const list=await rpc(current.sb,'ywi_rpc_company_customers_422',{p_company_id:id});
  if(!Array.isArray(list)||list.length>100||list.some(r=>!r.id||!r.name||typeof r.is_active!=='boolean')||
     new Set(list.map(r=>r.id)).size!==list.length)throw Error('Incomplete canonical tenant customer listing');
  rows=list;options(customer,rows,r=>r.name+(r.is_active?'':' (inactive)'),'Choose a verified customer');
  note(rows.length+' verified canonical customers loaded. Legacy unclaimed CRM is excluded.');
 }
 async function history(current){
  results.replaceChildren();property.replaceChildren();
  if(!customer.value)return;
  const data=validateHistory(company.value,customer.value,await rpc(current.sb,'ywi_rpc_customer_history_422',
   {p_company_id:company.value,p_client_id:customer.value}));
  options(property,data.properties,r=>r.name+(r.address?' · '+r.address:''),'Choose a verified property');
  results.appendChild(make('h3',data.customer_name+' · cross-service history'));
  results.appendChild(make('p',data.properties.length+' verified properties · '+data.estimates.length+' estimates · '+data.work_orders.length+' work orders. The most recent 80 of each work type are shown; older records may exist.'));
  const all=[...data.estimates.map(r=>({...r,kind:'Estimate'})),...data.work_orders.map(r=>({...r,kind:'Work order'}))]
   .sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  if(!all.length)results.appendChild(make('p','No company-scoped service history linked yet. Existing unscoped legacy work was not assigned.'));
  for(const item of all){
   const p=make('p');p.dataset.owner422Service=item.service;
   p.textContent=item.kind+' · '+(labels[item.service]||item.service)+' · '+item.status+' · '+item.number+' · '+
    (data.properties.find(s=>s.id===item.property_id)?.name||'Verified property')+' · '+String(item.created_at||'');
   p.style.cssText='border-bottom:1px solid #64748b;padding:6px 0;overflow-wrap:anywhere';results.appendChild(p);
  }
 }
 async function run(fn){
  if(busy)return;busy=true;for(const b of [refresh,createCustomer,createSite,attach,historyButton])b.disabled=true;
  try{await fn();}catch(e){results.replaceChildren();note('WITHHELD: '+(e?.message||e));}
  finally{busy=false;for(const b of [refresh,createCustomer,createSite,attach,historyButton])b.disabled=false;}
 }
 refresh.onclick=()=>run(async()=>{
  clear();const current=await owner();
  const r=await current.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(r.error||!Array.isArray(r.data)||r.data.length>100||r.data.some(c=>!c.id||!c.name||c.owner_user_id!==current.uid))throw Error('Incomplete or foreign company list');
  session={uid:current.uid};companies=r.data;options(company,companies,c=>c.name,'Choose your company');
  if(companies.length===1){company.value=companies[0].id;await loadCustomers(current);}
  else note('Select one of '+companies.length+' owned companies.');
 });
 company.onchange=()=>run(async()=>loadCustomers(await checked()));
 customer.onchange=()=>run(async()=>history(await checked()));
 historyButton.onclick=()=>run(async()=>history(await checked()));
 createCustomer.onclick=()=>run(async()=>{
  const current=await checked();const label=name.value.trim(),mail=email.value.trim();
  if(label.length<2||label.length>120||mail.length>254||(mail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)))throw Error('Check the customer legal name and email');
  if(!window.confirm('Create one canonical customer for this company? No existing legacy customer is merged.'))return;
  const id=await rpc(current.sb,'ywi_rpc_create_customer_422',{
   p_company_id:company.value,p_legal_name:label,p_email:mail||null});
  if(!uuid(id))throw Error('Server customer ID unverified; refresh before retrying');
  await loadCustomers(current);customer.value=id;await history(current);name.value='';email.value='';note('New canonical customer '+shortId(id)+' linked to verified company.');
 });
 createSite.onclick=()=>run(async()=>{
  const current=await checked(),label=siteName.value.trim();
  if(!rows.some(c=>c.id===customer.value&&c.is_active)||label.length<2||label.length>120||address.value.trim().length>400)throw Error('Select an active verified customer and valid property name');
  if(!window.confirm('Create a canonical property under this customer and company?'))return;
  const id=await rpc(current.sb,'ywi_rpc_create_property_422',{
   p_company_id:company.value,p_client_id:customer.value,p_name:label,p_address:address.value.trim()||null});
  if(!uuid(id))throw Error('Server property ID unverified; refresh before retrying');
  await history(current);property.value=id;siteName.value='';address.value='';note('Canonical property '+shortId(id)+' linked to this customer.');
 });
 attach.onclick=()=>run(async()=>{
  const current=await checked(),target=draft.value.trim();
  if(!uuid(target)||!rows.some(c=>c.id===customer.value&&c.is_active)||!property.value)throw Error('Choose a verified customer/property and enter an unlinked draft UUID');
  if(!window.confirm('Attach this customer and property to the existing company draft? This cannot be reassigned.'))return;
  const result=await rpc(current.sb,'ywi_rpc_attach_draft_customer_422',{
   p_company_id:company.value,p_kind:kind.value,p_target_id:target,
   p_client_id:customer.value,p_site_id:property.value});
  if(result!==target)throw Error('Server target mismatch; inspect before retrying');
  await history(current);draft.value='';note('Verified customer/property attached to '+kind.value+' '+shortId(target)+'. No invoice or dispatch was created.');
 });
 document.addEventListener('ywi:auth-changed',()=>{clear();note('Session changed; fresh tenant verification required.');});
}
window.YWI422=Object.freeze({keys,validateHistory});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

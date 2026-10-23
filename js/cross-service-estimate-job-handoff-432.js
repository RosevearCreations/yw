/* Item 432 — owner-only audit of canonical estimate → actual released work order.
   Entirely read-only; no status-only customer acceptance, signatures or work creation. */
(()=>{'use strict';
const services=Object.freeze({landscape:'Landscaping',construction:'Construction',water_parks:'Water parks',
 snow_removal:'Snow removal',snow_plowing:'Snow plowing',septic:'Septic haulage'});
const el=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);return n;};
const validDate=(value,now)=>{if(!value)return false;const t=Date.parse(String(value));return Number.isFinite(t)&&t<=now+300000;};
const number=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const normalizedLines=lines=>lines.map(l=>[Number(l.line_order),String(l.description||'').trim(),
  Number(l.quantity),Number(l.unit_price),Number(l.line_total)]);
function withheld(reason){return {state:'withheld',reason,records:[],source_authorized:false};}
function inspect(input,now=Date.now()){
 const {company,uid,services:entitlements,customers,customerId,history,propertyId,source,retrievedAt}=input||{};
 const core=window.YWI430?.inspect?.({company,uid,services:entitlements,customers,customerId,history,retrievedAt},now);
 if(!core||core.state==='withheld')return withheld(core?.reason||'Owner, Jobs and original customer evidence unavailable');
 if(!propertyId||!history?.properties?.some(p=>p.id===propertyId))return withheld('Unverified customer property');
 if(!source||source.canonical_source!=='original_estimates_work_orders_213_421_422'||
  source.company_id!==company.id||source.client_id!==customerId||source.site_id!==propertyId||
  source.estimate_limit!==50||source.historical_disabled_visible!==true||
  source.customer_agreement_created!==false||source.business_mutations!==false||
  !validDate(source.retrieved_at,now)||now-Date.parse(source.retrieved_at)>300000||
  !Array.isArray(source.estimates)||source.estimates.length>50)
  return withheld('Incomplete, capped, stale or inconsistent original handoff source');
 if(new Set(source.estimates.map(e=>e.id)).size!==source.estimates.length)return withheld('Duplicate estimate source');
 const records=[];
 for(const e of source.estimates){
  if(!e.id||!Object.hasOwn(services,e.service)||e.company_id!==company.id||e.client_id!==customerId||
   e.site_id!==propertyId||!validDate(e.created_at,now)||!validDate(e.updated_at,now)||
   !Array.isArray(e.lines)||e.lines.length>50||!Array.isArray(e.jobs)||e.jobs.length>2||
   new Set(e.lines.map(l=>l.id)).size!==e.lines.length||
   e.lines.some(l=>!l.id||!String(l.description||'').trim()||!Number.isInteger(Number(l.line_order))||number(l.quantity)===null||
    number(l.unit_price)===null||number(l.line_total)===null)||
   new Set(e.jobs.map(j=>j.id)).size!==e.jobs.length||
   e.jobs.some(j=>!j.id||!Array.isArray(j.base_lines)||j.base_lines.length>50||
    new Set(j.base_lines.map(l=>l.id)).size!==j.base_lines.length||
    j.base_lines.some(l=>!l.id||!String(l.description||'').trim()||!Number.isInteger(Number(l.line_order))||
     number(l.quantity)===null||number(l.unit_price)===null||number(l.line_total)===null)))
   return withheld('Malformed or duplicated original estimate or line-item evidence');
  const holds=[];
  const enabled=entitlements.find(s=>s.module_key===e.service)?.enabled===true;
  if(!enabled||e.service_enabled!==true)holds.push('Service entitlement disabled; no NEW work authorization');
  if(!e.new_work_gate_recorded)holds.push('Original estimate company/service creation receipt missing');
  if(number(e.total_amount)===null||number(e.total_amount)<0)holds.push('Original estimate price unavailable');
  if(!String(e.scope_notes||'').trim()&&!e.lines.length)holds.push('Original estimate scope unrecorded');
  if(e.approval_required===true&&!(e.approval_status==='approved'&&e.approved_by===true&&validDate(e.approved_at,now)))
   holds.push('Independent internal estimate approval unverified');
  else if(e.approval_required!==true&&e.approval_required!==false)holds.push('Estimate internal approval requirement unknown');
  if(!e.quote||e.quote.status!=='accepted'||!e.quote.accepted_by_recorded||
    !validDate(e.quote.accepted_at,now)||Date.parse(e.quote.accepted_at)<Date.parse(e.created_at))
   holds.push('Dated customer quote acceptance not verified (estimate status is insufficient)');
  if(!e.quote?.terms_version_recorded)holds.push('Accepted customer terms version not recorded');
  if(number(e.deposit_required)===null||number(e.deposit_paid_recorded)===null||
   Number(e.deposit_paid_recorded)<Number(e.deposit_required))holds.push('Required deposit not evidenced as paid');
  if(e.jobs.length!==1)holds.push(e.jobs.length?'Multiple work orders linked to one estimate':'No original linked work order');
  const job=e.jobs.length===1?e.jobs[0]:null;
  if(job){
   if(job.company_id!==company.id||job.service!==e.service||job.customer_property_matches!==true||job.estimate_id!==e.id)
    holds.push('Job company/service/customer/property mismatch');
   if(!validDate(job.created_at,now)||Date.parse(job.created_at)<Date.parse(e.created_at))holds.push('Job chronology invalid');
   if(e.converted_work_order_id!==job.id||!validDate(e.converted_at,now))
    holds.push('Original conversion pointer/timestamp not reconciled');
   if(!job.new_work_gate_recorded)holds.push('Original job new-work authorization receipt missing');
   if(job.status==='draft'||!job.status)holds.push('Work order remains a draft');
   if(number(job.total_amount)===null||number(e.total_amount)===null||
    Math.abs(Number(job.total_amount)-Number(e.total_amount))>0.01)
    holds.push('Estimate and job prices diverge; review documented change orders');
   if(!e.lines.length||!job.base_lines.length||
    JSON.stringify(normalizedLines(e.lines))!==JSON.stringify(normalizedLines(job.base_lines)))
    holds.push('Base scope/line prices do not match original estimate');
   if(job.approval_required===true&&!(job.approval_status==='approved'&&job.approved_by===true&&validDate(job.approved_at,now)))
    holds.push('Independent Jobs internal approval unverified');
   else if(job.approval_required!==true&&job.approval_required!==false)
    holds.push('Jobs internal approval requirement unknown');
   if(job.release?.status!=='released'||job.release?.threshold!=='pass'||
    job.release?.signoff_by!==true||!validDate(job.release?.signoff_at,now))
    holds.push('Separate signed work-order release absent or blocked');
  }
  records.push({estimate_id:e.id,estimate_number:e.number||e.id,service:e.service,
   service_name:services[e.service],estimate_status:e.status,scope:e.scope_notes||'',
   title:e.title||'',total_amount:e.total_amount,source_lines:e.lines.length,
   customer_accepted_at:e.quote?.accepted_at||null,
   work_order_id:job?.id||null,work_order_number:job?.number||null,
   work_order_status:job?.status||null,release_status:job?.release?.status||'not recorded',
   state:holds.length?'hold':'source_release_traced',holds});
 }
 return {state:records.some(r=>r.state==='hold')?'review_required':'source_audit_recorded',
  records,company_id:company.id,client_id:customerId,site_id:propertyId,
  source_retrieved_at:source.retrieved_at,source_authorized:false,
  reason:'Read-only provenance, not permission to begin work or a newly signed agreement.'};
}
window.YWI432=Object.freeze({services,inspect});
function mount(){
 const host=document.getElementById('admin');if(!host||document.getElementById('owner432'))return;
 const panel=el('details');panel.id='owner432';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Estimate to Authorized Job Audit';panel.dataset.adminHubGroups='management operations jobs';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.append(el('summary','432 · Cross-Service Estimate → Authorized Job Audit'));
 const body=el('div');body.className='admin-panel-block';
 body.append(el('p','Audit original estimates, dated customer quote receipts, internal approvals, deposits, scoped Jobs records and independently signed release. A recorded handoff is not a new contract or authority to begin work. All missing evidence stays on HOLD.'));
 const help=el('a','ⓘ How to read handoff holds');help.href='/help.html#cross-service-estimate-job-handoff-432';body.append(help);
 const controls=el('div');controls.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px;min-width:0';
 const picker=(id,label)=>{const wrap=el('label',label),select=el('select');select.id=id;
  select.style.cssText='display:block;width:100%;max-width:100%;min-width:0;box-sizing:border-box';wrap.append(select);controls.append(wrap);return select;};
 const companySel=picker('owner432Company','Owner company'),customerSel=picker('owner432Customer','Canonical customer'),
  siteSel=picker('owner432Property','Verified original property');body.append(controls);
 const refresh=el('button','Refresh authorized source');refresh.id='owner432Refresh';refresh.type='button';refresh.className='secondary';body.append(refresh);
 const status=el('p','Sign in as company owner to inspect original Jobs handoffs.');status.id='owner432Status';
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const out=el('div');out.id='owner432Results';out.style.cssText='display:grid;gap:12px;min-width:0;max-width:100%';body.append(out);
 panel.append(body);host.append(panel);
 let context=null,companies=[],entitlements=[],customers=[],history=null,epoch=0,busy=false;
 const note=s=>status.textContent=s;
 function choices(target,rows,label,placeholder){target.replaceChildren();const blank=el('option',placeholder);blank.value='';target.append(blank);
  for(const row of rows){const opt=el('option',label(row));opt.value=row.id;target.append(opt);}}
 function clear(){epoch++;context=null;companies=[];entitlements=[];customers=[];history=null;out.replaceChildren();
  choices(companySel,[],x=>x.name,'Choose company');choices(customerSel,[],x=>x.name,'Choose customer');
  choices(siteSel,[],x=>x.name,'Choose property');}
 function render(result){out.replaceChildren();
  if(result.state==='withheld'){note('WITHHELD: '+result.reason+'. No authorization inferred.');return;}
  note(result.records.length+' original estimate(s) checked; '+result.records.filter(r=>r.state==='hold').length+
   ' on HOLD. No customer agreement or work authorization has been issued here.');
  if(!result.records.length){out.append(el('p','No actual original estimate at this site. No successful handoff can be claimed.'));return;}
  for(const r of result.records){const article=el('article');article.className='notice';
   article.dataset.owner432Estimate=r.estimate_id;article.dataset.owner432State=r.state;
   article.style.cssText='border:1px solid #64748b;border-radius:10px;padding:12px;min-width:0;overflow-wrap:anywhere;box-sizing:border-box';
   article.append(el('h3',r.estimate_number+' · '+r.service_name),
    el('strong',r.state==='hold'?'HOLD — approvals or links missing':'SOURCE RELEASE TRACED — operator review still required'),
    el('p','Original scope: '+(r.scope||r.title||'not recorded')+' · '+r.source_lines+' visible base line(s)'),
    el('p','Original estimate total: '+(r.total_amount??'unavailable')+' · status '+(r.estimate_status||'unrecorded')),
    el('p','Dated quote acceptance: '+(r.customer_accepted_at||'NOT VERIFIED')),
    el('p','Linked job: '+(r.work_order_number||'MISSING')+' · '+(r.work_order_status||'not recorded')+
     ' · release '+r.release_status));
   const list=el('ul');if(r.holds.length)for(const h of r.holds)list.append(el('li',h));
   else list.append(el('li','Estimate/job/receipt alignment is recorded; verify independent Safety, Dispatch, permits and specialist controls before acting.'));
   article.append(list);out.append(article);
  }
 }
 async function identity(){const s=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(!s?.isAuthenticated||!s.user?.id||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)throw Error('Authenticated owner session required');
  const res=await sb.auth.getUser();if(res.error||res.data?.user?.id!==s.user.id)throw Error('Owner identity mismatch');
  return {uid:s.user.id,sb};}
 async function verified(){const c=await identity();if(!context||c.uid!==context.uid)throw Error('Session changed; refresh');return c;}
 async function rpc(sb,name,args){const r=await sb.rpc(name,args);if(r.error||r.data==null)throw Error('Guarded canonical source unavailable: '+name);return r.data;}
 async function loadCompany(){const generation=epoch;history=null;entitlements=[];customers=[];out.replaceChildren();
  choices(customerSel,[],x=>x.name,'Choose customer');choices(siteSel,[],x=>x.name,'Choose property');
  const company=companies.find(c=>c.id===companySel.value);if(!company){note('Choose a company.');return;}
  const {uid,sb}=await verified();if(company.owner_user_id!==uid)throw Error('Owner mismatch');
  const [reg,list]=await Promise.all([sb.from('ywi_company_service_modules').select('company_id,module_key,enabled').eq('company_id',company.id).limit(7),
   rpc(sb,'ywi_rpc_company_customers_422',{p_company_id:company.id})]);
  if(generation!==epoch)throw Error('Session changed during company source query');
  if(reg.error||!Array.isArray(reg.data))throw Error('Service entitlement registry unavailable');
  entitlements=reg.data;customers=list;
  const core=window.YWI430?.inspect?.({company,uid,services:entitlements,customers,retrievedAt:new Date().toISOString()});
  if(core?.state==='withheld'||!core)throw Error(core?.reason||'Owner source invalid');
  choices(customerSel,customers,x=>x.name,'Choose customer');note('Choose a linked original customer.');}
 async function loadCustomer(){const generation=epoch;history=null;out.replaceChildren();choices(siteSel,[],x=>x.name,'Choose property');
  const company=companies.find(c=>c.id===companySel.value),client=customerSel.value;
  if(!company||!client){note('Choose a verified customer.');return;}
  const {uid,sb}=await verified();history=await rpc(sb,'ywi_rpc_customer_history_422',{p_company_id:company.id,p_client_id:client});
  if(generation!==epoch)throw Error('Session changed during customer history query');
  const core=window.YWI430?.inspect?.({company,uid,services:entitlements,customers,customerId:client,history,retrievedAt:new Date().toISOString()});
  if(core?.state==='withheld'||!core)throw Error(core?.reason||'Original customer history invalid');
  choices(siteSel,history.properties,x=>x.name+(x.address?' · '+x.address:''),'Choose original property');note('Choose original property for estimate and Jobs handoff.');}
 async function loadProperty(){const generation=epoch;out.replaceChildren();const company=companies.find(c=>c.id===companySel.value),client=customerSel.value,site=siteSel.value;
  if(!company||!client||!site){note('Choose a verified property.');return;}
  const {uid,sb}=await verified(),at=new Date().toISOString();
  const source=await rpc(sb,'ywi_rpc_estimate_job_handoff_432',{p_company_id:company.id,p_client_id:client,p_site_id:site});
  if(generation!==epoch)throw Error('Session changed during handoff source query');
  render(inspect({company,uid,services:entitlements,customers,customerId:client,history,propertyId:site,source,retrievedAt:at}));}
 async function run(fn){if(busy)return;busy=true;for(const x of [refresh,companySel,customerSel,siteSel])x.disabled=true;
  const stamp=epoch;try{await fn();if(stamp!==epoch)throw Error('Session changed during source query');}
  catch(err){out.replaceChildren();note('WITHHELD: '+String(err?.message||err)+'. No work authorization changed.');}
  finally{busy=false;for(const x of [refresh,companySel,customerSel,siteSel])x.disabled=false;}}
 refresh.addEventListener('click',()=>{if(busy)return;clear();run(async()=>{const c=await identity();
  const r=await c.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(r.error||!Array.isArray(r.data)||r.data.length>100||r.data.some(v=>!v.id||!v.name||v.owner_user_id!==c.uid)||
   new Set(r.data.map(v=>v.id)).size!==r.data.length)throw Error('Company source foreign, capped or unavailable');
  context=c;companies=r.data;choices(companySel,companies,x=>x.name,'Choose company');
  if(companies.length===1){companySel.value=companies[0].id;await loadCompany();}
  else note(companies.length?'Choose an owner company.':'No owner company recorded; use the 420 setup first.');});});
 companySel.addEventListener('change',()=>run(loadCompany));
 customerSel.addEventListener('change',()=>run(loadCustomer));
 siteSel.addEventListener('change',()=>run(loadProperty));
 document.addEventListener('ywi:auth-changed',()=>{clear();note('Session changed. Refresh to reverify all handoff evidence.');});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

/* YW 441 — owner-only field-trial integrity/privacy review. A GREEN source
   check is never an accepted field trial or independently verified release. */
(()=>{'use strict';
const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic'];
const labels=Object.freeze({landscape:'Lawn Care & Grounds',construction:'Light Construction',
 water_parks:'Aquatic Facilities',snow_removal:'Snow Removal',snow_plowing:'Snow Plowing',septic:'Septic'});
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const date=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const locked=Object.freeze({trial_accepted:false,release_green_verified:false,
 payroll_authorized:false,finance_authorized:false,dispatch_authorized:false,
 customer_contact_authorized:false,mutation_authorized:false});
const withheld=reason=>({state:'withheld',reason,gaps:[],...locked});
function inspect(d,{companyId,workOrderId=null,now=Date.now()}){
 if(!uuid(companyId)||workOrderId!==null&&!uuid(workOrderId)||
  !d||d.company_id!==companyId||d.work_order_id!==workOrderId||
  !['choose_order','review_only'].includes(d.state)||d.state!==(workOrderId?'review_only':'choose_order')||
  d.complete!==true||d.source_limit!==60||d.privacy_minimized!==true||
  d.tenant_guard!=='owner_and_jobs_view_422'||
  d.trial_accepted!==false||d.release_green_verified!==false||d.mutation_authorized!==false||
  !date(d.captured_at)||!Array.isArray(d.modules)||d.modules.length!==6||
  new Set(d.modules.map(x=>x.module_key)).size!==6||
  d.modules.some(x=>!keys.includes(x.module_key)||typeof x.enabled!=='boolean')||
  !Array.isArray(d.orders)||d.orders.length>60||d.orders.length!==d.scoped_order_count||
  new Set(d.orders.map(o=>o.id)).size!==d.orders.length||
  d.orders.some(o=>!uuid(o.id)||!o.number||!keys.includes(o.service)||!o.status))
  return withheld('Owner, six company entitlements, complete Jobs directory or privacy boundary cannot be verified');
 const captured=Date.parse(d.captured_at);
 if(!Number.isFinite(now)||captured>now+60000||now-captured>5*60000)
  return withheld('Database-sourced capture timestamp missing, future or more than five minutes old');
 if(!workOrderId)return {state:'choose_order',company_id:companyId,
  captured_at:d.captured_at,orders:d.orders.map(o=>({id:o.id,number:o.number,
   service:o.service,status:o.status})),services:d.modules,
  gaps:[d.orders.length?'Select one original Jobs order for full review':'No scoped Jobs orders. Real owner field trial is on HOLD.'],...locked};
 const order=d.order,c=d.coverage;
 if(!order||order.id!==workOrderId||!d.orders.some(o=>o.id===workOrderId&&
   o.service===order.service&&o.number===order.number)||!keys.includes(order.service)||
  typeof order.customer_present!=='boolean'||typeof order.property_present!=='boolean'||
  typeof order.verified_company_customer_property!=='boolean'||
  typeof order.service_enabled_now!=='boolean'||!c||d.evidence_limit!==80||
  !['original_proofs','dispatch_records','qc_runs','specialist_receipts'].every(k=>
   Number.isInteger(c[k])&&c[k]>=0&&c[k]<=80)||
  d.source_last_at!==null&&!date(d.source_last_at))
  return withheld('Selected Jobs identity, company-owned customer/property, original evidence counts or source dates invalid');
 if(d.modules.find(x=>x.module_key===order.service)?.enabled!==order.service_enabled_now)
  return withheld('Company service entitlement changed during owner trial read');
 if(d.source_last_at&&Date.parse(d.source_last_at)>captured+60000)
  return withheld('Original source activity timestamp is newer than the database capture');
 const gaps=[];
 if(!order.customer_present||!order.property_present||!order.verified_company_customer_property)
  gaps.push('Original customer AND property are not independently linked to the owner company in 422.');
 if(!order.service_enabled_now)gaps.push('Service is disabled for new work; historical evidence can still be reviewed.');
 if(c.original_proofs===0)gaps.push('No original execution proof recorded.');
 if(c.dispatch_records===0)gaps.push('No original dispatch record found; a schedule cannot be inferred.');
 if(c.qc_runs===0)gaps.push('No original QC run; customer acceptance cannot be inferred.');
 if(c.specialist_receipts===0)gaps.push('No service-specific dated field receipt. Missing evidence is not zero actual work.');
 if(!d.source_last_at)gaps.push('No dated original execution/dispatch/QC/field source activity.');
 else if(now-Date.parse(d.source_last_at)>30*86400000)
  gaps.push('Latest original source activity is older than 30 days; freshness for a CURRENT live trial is unproven.');
 gaps.push('Independent owner/field acceptance and exact GitHub+Vercel main-SHA evidence remain human/release gates.');
 return {state:'hold',company_id:companyId,work_order_id:workOrderId,
  service:order.service,label:labels[order.service],order:order.number,
  captured_at:d.captured_at,source_last_at:d.source_last_at,
  source_age_days:d.source_last_at?Math.floor((now-Date.parse(d.source_last_at))/86400000):null,
  verified_company_customer_property:order.verified_company_customer_property,
  service_enabled_now:order.service_enabled_now,coverage:{...c},gaps,...locked,
  note:'Source counts are original records, not completed visits, approval, customer consent, licensed compliance, payroll, Finance or certified release readiness.'};
}
window.YWI441=Object.freeze({keys,labels,inspect});
const make=(tag,label)=>{const e=document.createElement(tag);if(label!==undefined)e.textContent=String(label);return e;};
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('owner441'))return;
 const panel=make('details');panel.id='owner441';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Live Field Trial Integrity, Privacy and Release Readiness';
 panel.dataset.adminHubGroups='management operations safety jobs';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.append(make('summary','441 · Live Field Trial Integrity, Privacy & Release Readiness'));
 const body=make('div');body.className='admin-panel-block';
 body.append(make('p','Read-only owner trial audit across six existing services. Company/customer-property links, source completeness and time are validated independently. No wages, client names, addresses or raw field payloads are shown. A Production build can be GREEN while actual owner first-use acceptance is on HOLD.'));
 const help=make('a','ⓘ Live trial privacy & release Help');help.href='/help.html#live-trial-integrity-441';body.append(help);
 const guides=make('p');guides.append(make('span','Check official release evidence separately: '));
 const gh=make('a','GitHub main workflows');gh.href='https://github.com/RosevearCreations/yw/actions';gh.target='_blank';gh.rel='noopener noreferrer';
 const site=make('a','Vercel Production');site.href='https://yw-alpha.vercel.app/';site.target='_blank';site.rel='noopener noreferrer';
 guides.append(gh,make('span',' · '),site);body.append(guides);
 const controls=make('div');controls.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:10px;min-width:0';
 const picker=(caption,id)=>{const label=make('label',caption),select=make('select');select.id=id;
  select.style.cssText='display:block;max-width:100%;min-width:0;width:100%;box-sizing:border-box';
  label.append(select);controls.append(label);return select;};
 const company=picker('Verified company owner','owner441Company');
 const order=picker('Original six-service Jobs order','owner441Order');body.append(controls);
 const button=make('button','Refresh owner trial evidence');button.type='button';button.className='secondary';button.id='owner441Refresh';body.append(button);
 const status=make('p','Authenticate as a company owner and refresh.');status.id='owner441Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const results=make('div');results.id='owner441Results';results.style.cssText='display:grid;gap:12px;min-width:0;max-width:100%;overflow-wrap:anywhere';body.append(results);
 panel.append(body);host.append(panel);
 const choices=(select,rows,placeholder)=>{const prior=select.value;select.replaceChildren();
  const none=make('option',placeholder);none.value='';select.append(none);
  for(const x of rows){const opt=make('option',x.label);opt.value=x.id;select.append(opt);}
  if(rows.some(x=>x.id===prior))select.value=prior;else if(rows.length===1)select.value=rows[0].id;};
 const clear=()=>{company.replaceChildren();order.replaceChildren();results.replaceChildren();};
 let epoch=0,uid=null,companies=[],directory=null,busy=false;
 async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!a.user?.id||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)
   throw Error('Authenticated company-owner session required');
  const auth=await sb.auth.getUser();if(auth.error||auth.data?.user?.id!==a.user.id)
   throw Error('Current owner identity differs from signed-in Supabase user');
  return{uid:a.user.id,sb};}
 const alive=(owner,start)=>epoch===start&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&
  window.YWI_AUTH.getState().user?.id===owner;
 const rpc=async(sb,id,orderId)=>{const r=await sb.rpc('ywi_rpc_live_field_trial_integrity_441',
  {p_company_id:id,p_work_order_id:orderId});if(r.error||!r.data)throw Error('Owner/Jobs-scoped 441 source inaccessible');return r.data;};
 function render(x){results.replaceChildren();if(x.state==='withheld'){status.textContent='WITHHELD: '+x.reason;return;}
  status.textContent=x.state==='choose_order'?'HOLD: choose an original company Jobs order':'HOLD · '+x.label+' · '+x.order+' · manual owner acceptance required';
  if(x.state==='choose_order')return;
  const block=(title,rows)=>{const sec=make('section');sec.className='notice';sec.style.cssText='border:1px solid #64748b;border-radius:10px;padding:12px;min-width:0;overflow-wrap:anywhere';sec.append(make('h3',title));const list=make('ul');for(const row of rows)list.append(make('li',row));sec.append(list);results.append(sec);};
  block('Private original-source coverage',[
   'Company/customer/property ownership: '+(x.verified_company_customer_property?'verified':'HOLD'),
   'Original execution proofs: '+x.coverage.original_proofs+' · dispatch: '+x.coverage.dispatch_records,
   'Original QC runs: '+x.coverage.qc_runs+' · specialist field receipts: '+x.coverage.specialist_receipts,
   'DB read: '+x.captured_at+' · latest source: '+(x.source_last_at||'unknown'),
   'Payroll, Finance and client identity fields are deliberately omitted.']);
  block('Unresolved live-trial / release gates',x.gaps);results.append(make('p',x.note));}
 async function load(){const start=epoch,s=await session();if(!alive(s.uid,start))throw Error('Owner identity changed during read');
  if(uid!==s.uid){clear();uid=s.uid;companies=[];directory=null;}
  if(!companies.length){const r=await s.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
   if(!alive(s.uid,start)||r.error||!Array.isArray(r.data)||r.data.length>100||
    new Set(r.data.map(c=>c.id)).size!==r.data.length||r.data.some(c=>!uuid(c.id)||!c.name||c.owner_user_id!==s.uid))
    throw Error('Owner company roster foreign, capped or incomplete');
   companies=r.data;choices(company,companies.map(c=>({id:c.id,label:c.name})),'Choose verified company');}
  if(!companies.length){order.replaceChildren();results.replaceChildren();status.textContent='HOLD: no registered company; create and verify an owner company in 420. Synthetic Yard Rosevear tests are not a Production company.';return;}
  if(!companies.some(c=>c.id===company.value)){order.replaceChildren();results.replaceChildren();status.textContent='Choose an owner company, then refresh.';return;}
  const companyId=company.value,d=await rpc(s.sb,companyId,null);
  if(!alive(s.uid,start)||company.value!==companyId)throw Error('Company changed during source read');
  const validated=inspect(d,{companyId,now:Date.now()});
  if(validated.state==='withheld')throw Error(validated.reason);
  directory=validated;choices(order,validated.orders.map(o=>({id:o.id,label:o.number+' · '+labels[o.service]+' · '+o.status})),'Choose original work order');
  if(!order.value){render(validated);return;}
  const orderId=order.value,detail=await rpc(s.sb,companyId,orderId);
  if(!alive(s.uid,start)||company.value!==companyId||order.value!==orderId)throw Error('Jobs order changed during source read');
  render(inspect(detail,{companyId,workOrderId:orderId,now:Date.now()}));}
 button.onclick=async()=>{if(busy)return;busy=true;button.disabled=company.disabled=order.disabled=true;
  try{await load();}catch(e){results.replaceChildren();status.textContent='WITHHELD: '+(e?.message||e)+'. No source was modified.';}
  finally{busy=false;button.disabled=company.disabled=order.disabled=false;}};
 company.onchange=()=>{epoch++;directory=null;order.replaceChildren();results.replaceChildren();status.textContent='Company changed; refresh original sources.';};
 order.onchange=()=>{epoch++;results.replaceChildren();status.textContent='Jobs order changed; refresh privacy-safe evidence.';};
 document.addEventListener('ywi:auth-changed',()=>{epoch++;uid=null;companies=[];directory=null;clear();status.textContent='Owner session changed. Reauthenticate.';});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

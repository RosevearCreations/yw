/* Item 434: original owner-linked Jobs → Dispatch/crew/Fleet/Workability/HSE.
   Read-only preflight; never a work, dispatch, or Safety authorization. */
(()=>{'use strict';
const services=Object.freeze({landscape:'Landscaping',construction:'Construction',water_parks:'Water parks',
 snow_removal:'Snow removal',snow_plowing:'Snow plowing',septic:'Septic haulage'});
const next=Object.freeze({landscape:'Verify field conditions, land access and 424 QC',
 construction:'Verify 425 permits, phase controls and site-specific Safety',
 water_parks:'Verify 426 aquatic inspections, isolation and Safety sign-off',
 snow_removal:'Verify 427 distinct walkway/ice event and treatment evidence',
 snow_plowing:'Verify 427 distinct plowing event, truck and route controls',
 septic:'Verify 428 operator, disposal acceptance and truck controls'});
const elem=(tag,value)=>{const node=document.createElement(tag);if(value!==undefined)node.textContent=String(value);return node;};
const time=value=>value?Date.parse(String(value)):NaN;
const dateOK=(value,now)=>Number.isFinite(time(value))&&time(value)<=now+300000;
const isRestricted=value=>/hold|block|cancel|postpon|suspend|reschedul|stop|closed|supersed/i.test(String(value||''));
const withhold=reason=>({state:'withheld',reason,dispatches:[],authorized:false});
function inspect(input,now=Date.now()){
 const {company,uid,entitlements,customers,history,customerId,siteId,workOrderId,source}=input||{};
 const core=window.YWI430?.inspect?.({company,uid,services:entitlements,customers,customerId,history,
  retrievedAt:source?.retrieved_at},now);
 if(!core||core.state==='withheld')return withhold(core?.reason||'Owner/customer source unverified');
 if(!history?.properties?.some(p=>p.id===siteId)||
   !history.work_orders?.some(w=>w.id===workOrderId&&w.property_id===siteId))
  return withhold('Original work order is not linked to this verified customer property');
 const job=history.work_orders.find(w=>w.id===workOrderId);
 if(!source||source.canonical_source!=='original_jobs_dispatch_workability_fleet_hse_434'||
  source.company_id!==company.id||source.client_id!==customerId||source.site_id!==siteId||
  source.work_order_id!==workOrderId||source.service!==job.service||
  source.business_mutations!==false||source.dispatch_authorized!==false||
  !dateOK(source.retrieved_at,now)||now-time(source.retrieved_at)>300000||
  !Object.hasOwn(services,source.service)||typeof source.service_enabled!=='boolean'||
  typeof source.release_signed!=='boolean'||!Number.isInteger(source.dispatch_count)||
  source.dispatch_count<0||source.dispatch_count>20||!Array.isArray(source.dispatches)||
  source.dispatch_count!==source.dispatches.length||
  new Set(source.dispatches.map(d=>d.id)).size!==source.dispatches.length)
  return withhold('Foreign, stale, capped or incomplete canonical Dispatch source');
 const entitlement=entitlements.find(s=>s.module_key===source.service);
 const overview=[];
 if(!entitlement?.enabled||!source.service_enabled)overview.push('Company service disabled — new work is not entitled');
 if(!source.release_signed)overview.push('Independent original Jobs release has not been signed');
 if(['draft','cancelled','canceled','closed'].includes(String(source.work_order_status||'').toLowerCase()))
  overview.push('Original work order is draft, cancelled or closed');
 if(!source.dispatch_count)overview.push('No original Dispatch schedule attached to this work order');
 const results=[];
 for(const d of source.dispatches){
  if(!d?.id||d.work_order_id!==workOrderId||!Array.isArray(d.equipment)||!Array.isArray(d.equipment_ids)||
    d.equipment_ids.length>20||d.equipment.length>22||
    new Set(d.equipment.map(e=>String(e.id))).size!==d.equipment.length||
    typeof d.conflicts_checked!=='boolean'||
    !Number.isInteger(d.crew_members)||d.crew_members<0||
    !Number.isInteger(d.hse_packet_count)||d.hse_packet_count<0)
   return withhold('Malformed, duplicated or unscoped Dispatch/asset evidence');
  const holds=[...overview],reviews=[];
  if(!d.site_matches)holds.push('Dispatch refers to a different property');
  if(isRestricted(d.status)||!['scheduled','confirmed','dispatched','active'].includes(String(d.status||'').toLowerCase()))
   holds.push('Dispatch schedule status requires independent review: '+(d.status||'missing'));
  if(!dateOK(d.start,now+365*86400000)||!Number.isFinite(time(d.end))||time(d.end)<=time(d.start))
   holds.push('Valid Dispatch start/end window is missing');
  if(isRestricted(d.workability_state)||!['workable','caution'].includes(String(d.workability_state||'')))
   holds.push('Dispatch workability remains restricted or not assessed');
  if(!d.crew_id||d.crew_status!=='active'||d.crew_members<1)
   holds.push('Active assigned crew with actual member record is not confirmed');
  if(!d.lead_recorded||!d.supervisor_recorded)reviews.push('Crew lead or supervisor assignment needs confirmation');
  if(!d.conflicts_checked||!Number.isInteger(d.conflict_count))holds.push('Original dispatch conflict source unavailable');
  else if(d.conflict_count>0)holds.push(d.conflict_count+' original dispatch resource overlap(s) require resolution');
  const ids=[d.truck_id,d.trailer_id,...d.equipment_ids].filter(v=>v!==null&&v!==undefined);
  if(new Set(ids.map(String)).size!==ids.length)reviews.push('Duplicate assigned equipment IDs; review resource allocation');
  if(!ids.length)reviews.push('No assigned equipment or vehicle evidence — verify service-specific requirements');
  for(const id of new Set(ids.map(String))){
   const asset=d.equipment.find(e=>String(e.id)===id);
   if(!asset){holds.push('Assigned equipment '+id+' is absent from original registry');continue;}
   if(asset.locked_out===true||isRestricted(asset.status)||isRestricted(asset.fleet_status)||
     /unavailable|out.of.service|maintenance|repair|failed|inactive/i.test(String(asset.status||'')+' '+String(asset.fleet_status||''))||
     Number(asset.fleet_downtime||0)>0)holds.push('Equipment unavailable or locked out: '+(asset.name||id));
   if(String(id)===String(d.truck_id)||String(id)===String(d.trailer_id)){
    if(!asset.fleet_status||!asset.fleet_readiness||!dateOK(asset.fleet_checked_at,now)||
      now-time(asset.fleet_checked_at)>7*86400000)
     holds.push('Current Fleet readiness receipt missing or stale: '+(asset.name||id));
    else if(!/ready|pass|serviceable/i.test(asset.fleet_readiness)||
       /not.ready|fail|caution/i.test(asset.fleet_readiness))
     holds.push('Fleet check does not establish readiness: '+(asset.name||id));
    for(const [key,label] of [['registration_expiry','registration'],['insurance_expiry','insurance'],
      ['inspection_due','annual inspection']]){
     if(!asset[key]||!Number.isFinite(time(asset[key]))||time(asset[key])<time(d.start))
      holds.push('Fleet '+label+' unverified or expired for '+(asset.name||id));
    }
   }
  }
  const o=d.observation,p=d.hse,k=d.decision;
  if(!o||o.dispatch_id!==d.id||!dateOK(o.observed_at,now)||
    now-time(o.observed_at)>24*3600000)
   holds.push('Fresh, exact-Dispatch weather/ground observation missing (24-hour window)');
  else {
   if(!String(o.weather_condition||'').trim()&&!Array.isArray(o.condition_tags))
    holds.push('Substantive recorded site/weather conditions absent');
   if(['icy','saturated'].includes(o.ground_state)||['possible','observed'].includes(o.ice_state)||
      ['nearby','observed'].includes(o.storm_state))reviews.push('Recorded adverse site/weather conditions require Safety review');
  }
  if(!k||k.observation_id!==o?.id||!k.by_recorded||!dateOK(k.decision_at,now)||
    time(k.decision_at)<time(o?.observed_at))holds.push('Current signed supervisor workability decision missing');
  else if(['postpone','reschedule','blocked'].includes(k.state))holds.push('Supervisor workability decision is '+k.state);
  else if(k.state==='caution')reviews.push('Supervisor caution requires a human recheck');
  else if(k.state!=='workable')holds.push('No original workable supervisor decision');
  if(!p||p.work_order_id!==workOrderId)holds.push('Original work-order Safety/HSE packet missing');
  else {
   if(isRestricted(p.status)||!['approved','active','complete','completed','signed_off'].includes(p.status))
    holds.push('Original HSE packet not independently accepted: '+(p.status||'unknown'));
   if(o?.linked_packet_id&&o.linked_packet_id!==p.id)holds.push('Observed Safety packet link is not the returned original packet');
   if(p.weather_required&&!p.weather_done)holds.push('Required HSE weather monitoring incomplete');
   if(p.heat_required&&!p.heat_done)holds.push('Required HSE heat monitoring incomplete');
   if(p.field_signoff_required&&!p.field_signoff_done)holds.push('Required HSE field sign-off incomplete');
   if(p.briefing_required||p.inspection_required)reviews.push('Independently confirm current HSE briefing/inspection records');
   if(d.hse_packet_count>1)reviews.push('Multiple original Safety packets require explicit selection');
  }
  if(Number.isFinite(time(d.start))&&time(d.start)>now+24*3600000)
   reviews.push('Future work window — repeat conditions and Safety checks near dispatch');
  reviews.push(next[source.service]+' in its original source module');
  results.push({id:d.id,start:d.start,state:holds.length?'hold':'review',holds,reviews,
   crew_id:d.crew_id,observation_at:o?.observed_at||null,decision:k?.state||null,
   hse_status:p?.status||null,assets:d.equipment.length});
 }
 return {state:overview.length||results.some(r=>r.state==='hold')?'hold':'review',
  service:source.service,number:source.work_order_number||workOrderId,overview,
  dispatches:results,authorized:false,source_retrieved_at:source.retrieved_at,
  reason:'Read-only preflight only. Only original Dispatch, Safety and Jobs authorities can permit an action.'};
}
window.YWI434=Object.freeze({inspect,services});
function mount(){
 const host=document.getElementById('admin');if(!host||document.getElementById('owner434'))return;
 const panel=elem('details');panel.id='owner434';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Job Dispatch and Safety Preflight';panel.dataset.adminHubGroups='management operations jobs safety';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.append(elem('summary','434 · Job Dispatch, Crew, Workability & Safety Preflight'));
 const body=elem('div');body.className='admin-panel-block';
 body.append(elem('p','Original per-job Dispatch, crew, Fleet, weather and HSE evidence. HOLD is not permission; REVIEW is not approval. Refresh before every decision. This screen cannot schedule, authorize work or clear a lockout.'));
 const help=elem('a','ⓘ Preflight help and hold meanings');help.href='/help.html#service-dispatch-safety-preflight-434';body.append(help);
 const controls=elem('div');controls.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,205px),1fr));gap:10px;min-width:0';
 const picker=(id,label)=>{const wrap=elem('label',label),select=elem('select');select.id=id;
  select.style.cssText='display:block;width:100%;min-width:0;max-width:100%;box-sizing:border-box';wrap.append(select);controls.append(wrap);return select;};
 const company=picker('owner434Company','Owner company'),customer=picker('owner434Customer','Canonical customer'),
  site=picker('owner434Site','Original property'),job=picker('owner434Job','Original work order');body.append(controls);
 const refresh=elem('button','Refresh verified sources');refresh.id='owner434Refresh';refresh.type='button';refresh.className='secondary';body.append(refresh);
 const status=elem('p','Sign in as company owner and refresh. No preflight recorded.');status.id='owner434Status';
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const results=elem('div');results.id='owner434Results';results.style.cssText='display:grid;gap:12px;min-width:0;max-width:100%';body.append(results);
 panel.append(body);host.append(panel);
 let session=null,companies=[],services=[],customers=[],history=null,epoch=0,busy=false;
 const choices=(select,rows,label,empty)=>{select.replaceChildren();const blank=elem('option',empty);blank.value='';select.append(blank);
  for(const row of rows){const opt=elem('option',label(row));opt.value=row.id;select.append(opt);}};
 const clear=()=>{epoch++;session=null;companies=[];services=[];customers=[];history=null;results.replaceChildren();
  choices(company,[],x=>x.name,'Choose company');choices(customer,[],x=>x.name,'Choose customer');
  choices(site,[],x=>x.name,'Choose property');choices(job,[],x=>x.name,'Choose work order');};
 const note=text=>status.textContent=text;
 const rpc=async(sb,name,args)=>{const r=await sb.rpc(name,args);if(r.error||r.data==null)throw Error('Original guarded source unavailable: '+name);return r.data;};
 async function identity(){const auth=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(!auth?.isAuthenticated||!auth.user?.id||!sb?.auth?.getUser||!sb?.rpc||!sb?.from)throw Error('Verified owner login required');
  const r=await sb.auth.getUser();if(r.error||r.data?.user?.id!==auth.user.id)throw Error('Owner session mismatch');
  return {uid:auth.user.id,sb};}
 async function verified(){const c=await identity();if(!session||c.uid!==session.uid)throw Error('Session changed; refresh sources');return c;}
 function render(r){results.replaceChildren();if(r.state==='withheld'){note('WITHHELD: '+r.reason);return;}
  note((r.state==='hold'?'HOLD':'REVIEW')+' — '+r.dispatches.length+' original dispatch(es) for '+r.number+'. Never an authorization.');
  if(!r.dispatches.length){results.append(elem('p','No original dispatch records. Create/review scheduling only in the authorized Dispatch module.'));return;}
  for(const d of r.dispatches){const card=elem('article');card.className='notice';card.dataset.owner434State=d.state;
   card.style.cssText='border:1px solid #64748b;border-radius:10px;padding:12px;min-width:0;overflow-wrap:anywhere;box-sizing:border-box';
   card.append(elem('h3',window.YWI434.services[r.service]+' · '+(d.start||'Unscheduled')),
    elem('strong',d.state.toUpperCase()+' — manual operational review required'),
    elem('p','Crew '+(d.crew_id||'missing')+' · '+d.assets+' assigned asset(s) found · Weather '+(d.observation_at||'missing')+
      ' · Supervisor '+(d.decision||'missing')+' · HSE '+(d.hse_status||'missing')));
   for(const [heading,rows] of [['Blocking evidence',d.holds],['Review in original modules',d.reviews]]){
    if(!rows.length)continue;card.append(elem('h4',heading));const list=elem('ul');for(const row of rows)list.append(elem('li',row));card.append(list);}
   results.append(card);
  }
 }
 async function loadCompany(){results.replaceChildren();history=null;
  choices(customer,[],x=>x.name,'Choose customer');choices(site,[],x=>x.name,'Choose property');choices(job,[],x=>x.name,'Choose work order');
  const c=companies.find(x=>x.id===company.value);if(!c){note('Choose verified company.');return;}
  const {sb,uid}=await verified();if(c.owner_user_id!==uid)throw Error('Foreign company');
  const [reg,list]=await Promise.all([sb.from('ywi_company_service_modules').select('company_id,module_key,enabled').eq('company_id',c.id).limit(7),
   rpc(sb,'ywi_rpc_company_customers_422',{p_company_id:c.id})]);
  if(reg.error||!Array.isArray(reg.data))throw Error('Service entitlements unavailable');
  services=reg.data;customers=list;
  if(window.YWI430.inspect({company:c,uid,services,customers,retrievedAt:new Date().toISOString()}).state==='withheld')
   throw Error('Company entitlement/customer source unverified');
  choices(customer,customers,x=>x.name,'Choose customer');note('Choose original customer.');}
 async function loadCustomer(){results.replaceChildren();history=null;choices(site,[],x=>x.name,'Choose property');choices(job,[],x=>x.name,'Choose work order');
  if(!customer.value){note('Choose original customer.');return;}
  const c=companies.find(x=>x.id===company.value),{sb,uid}=await verified();
  history=await rpc(sb,'ywi_rpc_customer_history_422',{p_company_id:c.id,p_client_id:customer.value});
  const scope=window.YWI430.inspect({company:c,uid,services,customers,customerId:customer.value,history,
   retrievedAt:new Date().toISOString()});
  if(scope.state==='withheld')throw Error(scope.reason);
  choices(site,history.properties,x=>x.name,'Choose property');note('Choose original property.');}
 function loadSite(){results.replaceChildren();choices(job,[],x=>x.name,'Choose work order');
  if(!site.value){note('Choose original property.');return;}
  choices(job,history.work_orders.filter(w=>w.property_id===site.value),w=>(w.number||w.id)+' · '+(window.YWI434.services[w.service]||w.service),
   'Choose work order');note('Choose original work order, then check its latest recorded preflight.');}
 async function loadJob(){results.replaceChildren();if(!job.value){note('Choose work order.');return;}
  const c=companies.find(x=>x.id===company.value),{sb,uid}=await verified();
  const source=await rpc(sb,'ywi_rpc_job_dispatch_preflight_434',{
   p_company_id:c.id,p_client_id:customer.value,p_site_id:site.value,p_work_order_id:job.value});
  render(inspect({company:c,uid,entitlements:services,customers,history,customerId:customer.value,
   siteId:site.value,workOrderId:job.value,source}));}
 async function run(fn){if(busy)return;busy=true;for(const ctl of [refresh,company,customer,site,job])ctl.disabled=true;
  const stamp=epoch;try{await fn();if(stamp!==epoch)throw Error('Session changed during source read');}
  catch(err){results.replaceChildren();note('WITHHELD: '+String(err?.message||err)+'. No work or Safety authorization issued.');}
  finally{busy=false;for(const ctl of [refresh,company,customer,site,job])ctl.disabled=false;}}
 refresh.addEventListener('click',()=>{clear();run(async()=>{const c=await identity(),r=await c.sb.from('ywi_companies')
  .select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(r.error||!Array.isArray(r.data)||r.data.length>100||new Set(r.data.map(x=>x.id)).size!==r.data.length||
    r.data.some(x=>!x.id||x.owner_user_id!==c.uid))throw Error('Owner company directory foreign or capped');
  session=c;companies=r.data;choices(company,companies,x=>x.name,'Choose company');
  if(companies.length===1){company.value=companies[0].id;await loadCompany();}
  else note('Choose verified company; this panel makes no dispatch changes.');});});
 company.addEventListener('change',()=>run(loadCompany));customer.addEventListener('change',()=>run(loadCustomer));
 site.addEventListener('change',()=>run(loadSite));job.addEventListener('change',()=>run(loadJob));
 document.addEventListener('ywi:auth-changed',()=>{clear();note('Session changed. Refresh and reverify before any review.');});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

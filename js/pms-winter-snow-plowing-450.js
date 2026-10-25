/* YW PMS 450 · independently entitled Snow Removal and Snow Plowing.
 * Original 420/421/422 authority remains server-side. Plans, storm readiness reviews
 * and reported passes never authorize dispatch, verify Safety, or invoice customers. */
(()=>{'use strict';
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const keys=Object.freeze(['snow_removal','snow_plowing']);
const modes=Object.freeze(['per_storm','seasonal_contract','per_visit']);
const reviews=Object.freeze(['watch','activation_requested','safety_hold']);
const outcomes=Object.freeze(['reported_complete','partial','weather_hold','skipped']);
const qcStates=Object.freeze(['pending','operator_pass','followup_required']);
const held=reason=>({state:'withheld',reason,services:[],agreements:[],storms:[],passes:[]});
function inspect(s,{companyId,now=Date.now(),jobsAllowed=false}={}){
 const t=Date.parse(s?.captured_at);
 if(!uuid(companyId)||s?.company_id!==companyId||
  s.owner_guard!=='ywi_422_assert_owner'||s.new_work_guard!=='ywi_421_assert_company_new_work'||
  !Number.isFinite(t)||t>now+60000||now-t>300000||jobsAllowed!==true||
  !Array.isArray(s.services)||s.services.length!==2||
  new Set(s.services.map(x=>x.module_key)).size!==2||
  s.services.some(x=>!keys.includes(x.module_key)||typeof x.enabled!=='boolean')||
  !Array.isArray(s.agreements)||!Array.isArray(s.storms)||!Array.isArray(s.passes)||
  s.agreement_count!==s.agreements.length||s.storm_count!==s.storms.length||
  s.pass_count!==s.passes.length||s.agreements.length>100||s.storms.length>200||s.passes.length>250||
  s.historical_read_retained!==true||s.activation_authorized!==false||
  s.safety_verified!==false||s.fleet_verified!==false||s.weather_verified!==false||
  s.dispatch_authorized!==false||s.invoice_posted!==false||s.mutation_authorized!==false)
  return held('Fresh complete owner-only winter source, authority or bounded source counts unavailable');
 const agreements=new Map(s.agreements.map(x=>[x.id,x]));
 const storms=new Map(s.storms.map(x=>[x.id,x]));
 if(agreements.size!==s.agreements.length||storms.size!==s.storms.length||
  new Set(s.passes.map(x=>x.id)).size!==s.passes.length||
  s.agreements.some(a=>!uuid(a.id)||a.company_id!==companyId||!uuid(a.client_id)||!uuid(a.site_id)||
   !a.client_name||!a.site_name||!keys.includes(a.service_key)||!modes.includes(a.billing_mode)||
   !/^\d{4}-\d{2}-\d{2}$/.test(a.starts_on)||
   a.ends_on!==null&&a.ends_on<a.starts_on||!(Number(a.trigger_cm)>=0&&Number(a.trigger_cm)<=250)||
   !['accumulation','icing','manual_inspection'].includes(a.trigger_kind)||
   !['none','optional','included'].includes(a.deicing_policy)||
   !Number.isInteger(a.estimated_charge_cents)||a.estimated_charge_cents<0||!a.source_reference)||
  s.storms.some(x=>!uuid(x.id)||x.company_id!==companyId||!agreements.has(x.agreement_id)||
   agreements.get(x.agreement_id).service_key!==x.service_key||
   !/^\d{4}-\d{2}-\d{2}$/.test(x.observed_on)||
   x.observed_on<agreements.get(x.agreement_id).starts_on||
   agreements.get(x.agreement_id).ends_on!==null&&x.observed_on>agreements.get(x.agreement_id).ends_on||
   !x.storm_reference||!(Number(x.reported_cm)>=0&&Number(x.reported_cm)<=250)||
   !['snow','ice','freezing_rain','mixed','unknown'].includes(x.hazard)||
   !reviews.includes(x.route_review)||!x.source_reference||
   x.route_review==='activation_requested'&&(!x.weather_source||!x.safety_source||
    x.service_key==='snow_plowing'&&!x.fleet_source))||
  s.passes.some(p=>!uuid(p.id)||p.company_id!==companyId||!storms.has(p.storm_review_id)||
   p.service_key!==storms.get(p.storm_review_id).service_key||
   p.agreement_id!==storms.get(p.storm_review_id).agreement_id||
   !/^\d{4}-\d{2}-\d{2}$/.test(p.reported_on)||
   !['walkway','steps','driveway','parking','road','mixed'].includes(p.surface)||
   !Number.isInteger(p.reported_passes)||p.reported_passes<1||p.reported_passes>30||
   !outcomes.includes(p.outcome)||!qcStates.includes(p.qc_status)||
   p.qc_status==='followup_required'&&!p.qc_note||!p.source_reference||
   p.deicer_name!==null&&(!(Number(p.deicer_quantity)>0)||!['kg','bags','litres'].includes(p.deicer_unit))||
   p.deicer_name===null&&(p.deicer_quantity!==null||p.deicer_unit!==null)))
   return held('Foreign, duplicate or malformed company winter plan, storm or pass evidence');
 return {state:'verified_winter',companyId,services:s.services,agreements:s.agreements,storms:s.storms,
  passes:s.passes,historicalRead:true,canActivate:false,canDispatch:false,canInvoice:false};
}
window.YWI450=Object.freeze({keys,modes,reviews,outcomes,qcStates,inspect});
const el=(tag,value)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=String(value);return x};
const input=(parent,tag,label,id,max)=>{const l=el('label',label),f=el(tag);f.id=id;if(max)f.maxLength=max;l.append(f);parent.append(l);return f};
const button=(parent,id,label)=>{const b=el('button',label);b.id=id;b.type='button';b.className='secondary';parent.append(b);return b};
const enums=(f,items)=>{for(const key of items){const o=el('option',key.replaceAll('_',' '));o.value=key;f.append(o)}};
function pick(f,items,placeholder,name=x=>x.name){const prev=f.value;f.replaceChildren();const start=el('option',placeholder);start.value='';f.append(start);
 for(const x of items){const o=el('option',name(x));o.value=x.id;f.append(o)}
 if(items.some(x=>x.id===prev))f.value=prev;else if(items.length===1)f.value=items[0].id;}
const money=value=>{if(!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(String(value)))throw Error('Use a nonnegative CAD amount with at most two decimals');
 const [whole,dec='']=String(value).split('.');return Number(whole)*100+Number(dec.padEnd(2,'0'))};
const cad=c=>(Number(c)/100).toLocaleString('en-CA',{style:'currency',currency:'CAD'});
const requestId=()=>{const id=window.crypto?.randomUUID?.();if(!uuid(id))throw Error('Secure UUID required');return id};
async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
 if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.auth?.getUser||!sb?.from||!sb?.rpc||
  !window.YWISecurity?.canViewModule?.('admin',a.role,'manage')||
  !window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Active Admin manage, Jobs view and owner identity required');
 const r=await sb.auth.getUser();if(r.error||r.data?.user?.id!==a.user.id)throw Error('Owner session mismatch');
 return{uid:a.user.id,role:a.role,sb};}
async function rpc(sb,name,args){const r=await sb.rpc(name,args);if(r.error||r.data===null||r.data===undefined)
 throw Error(r.error?.message||'Winter owner source withheld');return r.data;}
function mountOne(key,id,title){const root=document.getElementById('admin');if(!root||document.getElementById(id))return;
 const panel=el('details');panel.id=id;panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='PMS · '+title;panel.dataset.adminHubGroups='management operations jobs safety';
 panel.append(el('summary','450 · '+title+' · Agreements, Storm Routes & Passes'));
 const body=el('div');body.className='admin-panel-block';
 body.append(el('p','Company-specific manual winter operations. Route activation requests are HOLD for independent weather, Safety, Fleet and original Dispatch review; no authorization to dispatch or bill.'));
 const help=el('a','ⓘ '+title+' Help');help.href='/help.html#pms-winter-450';body.append(help);
 const prefix=key==='snow_removal'?'pms450Snow':'pms450Plow';
 const tools=el('div');tools.className='pms450-grid';const company=input(tools,'select','Verified company',prefix+'Company');body.append(tools);
 const actions=el('div');actions.className='pms450-actions';const refresh=button(actions,prefix+'Refresh','Verify '+title);body.append(actions);
 const status=el('p','Verify the owner company first.');status.id=prefix+'Status';status.setAttribute('role','status');body.append(status);
 const history=el('div');history.id=prefix+'History';history.className='pms450-cards';body.append(history);
 const form=el('details');form.id=prefix+'AgreementPanel';form.append(el('summary','Record site agreement / per-storm threshold (not signed)'));
 const af=el('div');af.className='pms450-grid';const customer=input(af,'select','Verified customer',prefix+'Customer');
 const site=input(af,'select','Canonical company property',prefix+'Site');
 const billing=input(af,'select','Billing arrangement (proposed)',prefix+'Billing');enums(billing,modes);
 const start=input(af,'input','Start date',prefix+'Start');start.type='date';
 const end=input(af,'input','End date (optional)',prefix+'End');end.type='date';
 const trigger=input(af,'input','Trigger snowfall (cm; advisory)',prefix+'Trigger');trigger.type='number';trigger.min='0';trigger.max='250';trigger.step='0.1';trigger.value='5';
 const triggerKind=input(af,'select','Trigger type',prefix+'TriggerKind');enums(triggerKind,['accumulation','icing','manual_inspection']);
 const deicing=input(af,'select','De-icing policy',prefix+'Deicing');enums(deicing,['none','optional','included']);
 const price=input(af,'input','Estimated CAD charge (not invoiced)',prefix+'Price');price.value='0.00';
 const route=input(af,'input','Manual winter route reference',prefix+'Route',100);
 const restrictions=input(af,'textarea','Property hazards / plow clearance / access',prefix+'Restrictions',600);
 const source=input(af,'input','Original agreement source reference',prefix+'Source',160);form.append(af);
 const create=button(form,prefix+'Create','Record winter plan');body.append(form);
 const stormForm=el('details');stormForm.id=prefix+'StormPanel';stormForm.append(el('summary','Record storm threshold / route activation REVIEW'));
 const sf=el('div');sf.className='pms450-grid';const stormAgreement=input(sf,'select','Verified winter plan',prefix+'StormAgreement');
 const stormRef=input(sf,'input','Storm event reference (manual)',prefix+'StormRef',100);
 const date=input(sf,'input','Observation date',prefix+'StormDate');date.type='date';
 const cm=input(sf,'input','Operator-reported accumulation (cm)',prefix+'Cm');cm.type='number';cm.min='0';cm.max='250';cm.step='0.1';cm.value='0';
 const hazard=input(sf,'select','Hazard',prefix+'Hazard');enums(hazard,['snow','ice','freezing_rain','mixed','unknown']);
 const review=input(sf,'select','Operator route review',prefix+'Review');enums(review,reviews);
 const weather=input(sf,'input','Weather observation source',prefix+'Weather',160);
 const safety=input(sf,'input','Safety inspection source',prefix+'Safety',160);
 const fleet=input(sf,'input','Fleet readiness source (mandatory for plowing request)',prefix+'Fleet',160);
 const stormSource=input(sf,'input','Original storm source reference',prefix+'StormSource',160);
 const stormNotes=input(sf,'textarea','Storm notes / decision HOLD',prefix+'StormNotes',600);stormForm.append(sf);
 const addStorm=button(stormForm,prefix+'AddStorm','Record route review (never activate)');body.append(stormForm);
 const passForm=el('details');passForm.id=prefix+'PassPanel';passForm.append(el('summary','Record operator-reported pass / de-icing / field QC'));
 const pf=el('div');pf.className='pms450-grid';const passStorm=input(pf,'select','Verified storm review',prefix+'PassStorm');
 const passDate=input(pf,'input','Reported service date',prefix+'PassDate');passDate.type='date';
 const surface=input(pf,'select','Surface / service area',prefix+'Surface');enums(surface,['walkway','steps','driveway','parking','road','mixed']);
 const count=input(pf,'input','Number of reported passes',prefix+'Passes');count.type='number';count.min='1';count.max='30';count.value='1';
 const outcome=input(pf,'select','Operator-reported outcome',prefix+'Outcome');enums(outcome,outcomes);
 const material=input(pf,'input','De-icer / salt material (optional)',prefix+'Material',100);
 const quantity=input(pf,'input','Reported material quantity',prefix+'Quantity');quantity.type='number';quantity.min='0.01';quantity.step='0.01';
 const unit=input(pf,'select','Material unit',prefix+'Unit');enums(unit,['kg','bags','litres']);
 const qc=input(pf,'select','Field QC (operator report only)',prefix+'QC');enums(qc,qcStates);
 const qcNote=input(pf,'textarea','QC follow-up note',prefix+'QCNote',400);
 const photo=input(pf,'input','Private photo label (not URL)',prefix+'Photo',160);
 const passSource=input(pf,'input','Original pass evidence source',prefix+'PassSource',160);
 const passNotes=input(pf,'textarea','Site condition / evidence notes',prefix+'PassNotes',600);passForm.append(pf);
 const addPass=button(passForm,prefix+'AddPass','Append field pass report');body.append(passForm);
 body.append(el('p','Storm thresholds are not verified forecasts. Requested activation is NOT an active route. Physical passes, de-icing, Safety sign-off, Fleet clearance and customer charges are unverified until their separate original workflows are reconciled.'));
 panel.append(body);root.append(panel);
 let epoch=0,busy=false,identity=null,roster=[],customers=[],sites=[],snapshot=null;
 const controls=[refresh,create,addStorm,addPass];
 const alive=(uid,at)=>at===epoch&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&window.YWI_AUTH.getState().user?.id===uid;
 const clear=()=>{snapshot=null;customers=[];sites=[];history.replaceChildren();customer.replaceChildren();site.replaceChildren();stormAgreement.replaceChildren();passStorm.replaceChildren()};
 const entitled=()=>snapshot?.state==='verified_winter'&&snapshot.services.find(x=>x.module_key===key)?.enabled===true&&
  identity===window.YWI_AUTH?.getState?.()?.user?.id&&roster.some(x=>x.id===company.value);
 const allowed=()=>{if(!entitled()||!window.YWISecurity?.canViewModule?.('jobs',window.YWI_AUTH.getState().role,'create'))
  throw Error(title+' company entitlement ON and original Jobs create permission required');};
 function render(reviewed){snapshot=reviewed;history.replaceChildren();
  if(reviewed.state!=='verified_winter'){status.textContent='WITHHELD: '+reviewed.reason;return;}
  const enabled=reviewed.services.find(x=>x.module_key===key)?.enabled;
  const plans=reviewed.agreements.filter(x=>x.service_key===key);
  const storms=reviewed.storms.filter(x=>x.service_key===key);
  const passes=reviewed.passes.filter(x=>x.service_key===key);
  status.textContent=title+(enabled?' ON':' OFF · historical owner read only')+' · '+plans.length+' plans / '+storms.length+' storm reviews / '+passes.length+' reported passes. Dispatch HOLD.';
  pick(stormAgreement,plans,'Select verified '+title+' plan',x=>x.site_name+' · '+x.starts_on);
  pick(passStorm,storms,'Select service-specific storm review',x=>x.storm_reference+' · '+x.observed_on);
  for(const plan of plans){const c=el('article');c.className='notice';c.dataset.pms450Agreement=plan.id;
   c.append(el('strong',plan.client_name+' · '+plan.site_name+' · '+title));
   c.append(el('p',plan.billing_mode.replaceAll('_',' ')+' · '+plan.trigger_cm+' cm '+plan.trigger_kind+' trigger · '+cad(plan.estimated_charge_cents)+' estimate'));
   c.append(el('p','Route reference: '+(plan.route_reference||'unassigned')+' · De-icing: '+plan.deicing_policy+' · '+plan.source_reference));
   if(plan.site_restrictions)c.append(el('p','Property hazards: '+plan.site_restrictions));
   for(const storm of storms.filter(x=>x.agreement_id===plan.id)){
    const s=el('p',storm.observed_on+' · storm '+storm.storm_reference+' · '+storm.reported_cm+' cm · '+storm.hazard+
     ' · '+storm.route_review.replaceAll('_',' ')+' (review only, never activated)');s.dataset.pms450Storm=storm.id;c.append(s);
    c.append(el('p','Weather/Safety/Fleet source labels: '+[storm.weather_source,storm.safety_source,storm.fleet_source].filter(Boolean).join(' / ')+' · '+storm.source_reference));
    for(const pass of passes.filter(x=>x.storm_review_id===storm.id)){
     const p=el('p',pass.reported_on+' · '+pass.reported_passes+' reported '+pass.surface+' passes · '+pass.outcome+
      ' · QC '+pass.qc_status+(pass.deicer_name?' · '+pass.deicer_quantity+' '+pass.deicer_unit+' '+pass.deicer_name:'')+
      ' · evidence '+pass.source_reference);p.dataset.pms450Pass=pass.id;c.append(p);
     if(pass.qc_note)c.append(el('p','Follow-up: '+pass.qc_note));
    }
   }history.append(c);
  }
  if(!plans.length)history.append(el('p','No recorded company '+title+' agreements. Winter services are independently entitled.'));
 }
 async function loadSites(ctx,at){const id=customer.value;sites=[];site.replaceChildren();if(!customers.some(c=>c.id===id))return;
  const h=await rpc(ctx.sb,'ywi_rpc_customer_history_422',{p_company_id:company.value,p_client_id:id});
  if(!alive(ctx.uid,at)||h.company_id!==company.value||h.client_id!==id||h.legacy_unscoped_excluded!==true||
   !Array.isArray(h.properties)||h.properties.length>100||h.properties.some(x=>!uuid(x.id)||!x.name))throw Error('Canonical company properties withheld');
  sites=h.properties;pick(site,sites,'Choose company property');}
 async function load(at){const ctx=await session();if(!alive(ctx.uid,at))throw Error('Session changed');
  const r=await ctx.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(r.error||!Array.isArray(r.data)||r.data.length>100||new Set(r.data.map(x=>x.id)).size!==r.data.length||
   r.data.some(x=>!uuid(x.id)||x.owner_user_id!==ctx.uid||!x.name)||!alive(ctx.uid,at))throw Error('Owner company roster withheld');
  identity=ctx.uid;roster=r.data;pick(company,roster,'Choose owned company');
  if(!roster.length){render(held('No real owner company; Yard Rosevear is synthetic test only'));return;}
  const raw=await rpc(ctx.sb,'ywi_rpc_pms_winter_snapshot_450',{p_company_id:company.value});
  if(!alive(ctx.uid,at))throw Error('Company session changed');
  render(inspect(raw,{companyId:company.value,jobsAllowed:window.YWISecurity.canViewModule('jobs',ctx.role,'view')}));
  if(snapshot.state!=='verified_winter')throw Error(snapshot.reason);
  customers=[];sites=[];customer.replaceChildren();site.replaceChildren();
  if(!snapshot.services.find(x=>x.module_key===key)?.enabled)return;
  const list=await rpc(ctx.sb,'ywi_rpc_company_customers_422',{p_company_id:company.value});
  if(!alive(ctx.uid,at)||!Array.isArray(list)||list.length>100||new Set(list.map(x=>x.id)).size!==list.length||
   list.some(x=>!uuid(x.id)||!x.name||typeof x.is_active!=='boolean'))throw Error('Canonical customer roster withheld');
  customers=list.filter(x=>x.is_active);pick(customer,customers,'Choose active customer');if(customer.value)await loadSites(ctx,at);}
 async function run(task){if(busy)return;busy=true;controls.forEach(x=>x.disabled=true);const at=epoch;
  try{await task(at)}catch(e){clear();status.textContent='WITHHELD: '+(e?.message||String(e));}
  finally{busy=false;controls.forEach(x=>x.disabled=false)}}
 refresh.onclick=()=>run(load);
 company.onchange=()=>{epoch++;clear();status.textContent='Company changed; reverify independent winter entitlement.';};
 customer.onchange=()=>{epoch++;const at=epoch;run(async()=>{const ctx=await session();if(!alive(ctx.uid,at)||!entitled())throw Error('Owner authority changed');await loadSites(ctx,at);});};
 create.onclick=()=>run(async at=>{allowed();if(!customers.some(x=>x.id===customer.value)||!sites.some(x=>x.id===site.value))throw Error('Choose verified customer and property');
  const cm=Number(trigger.value);if(!start.value||end.value&&end.value<start.value||!Number.isFinite(cm)||cm<0||cm>250)throw Error('Invalid term or threshold');
  const charge=money(price.value),ctx=await session();if(!window.confirm('Save an unsigned winter service plan? No contract execution, route activation, Job or invoice.'))return;
  const id=await rpc(ctx.sb,'ywi_rpc_pms_winter_agreement_450',{
   p_company_id:company.value,p_client_id:customer.value,p_site_id:site.value,p_request_id:requestId(),
   p_service:key,p_billing:billing.value,p_start:start.value,p_end:end.value||null,p_trigger:cm,
   p_trigger_kind:triggerKind.value,p_deicing:deicing.value,p_price_cents:charge,
   p_route_ref:route.value.trim()||null,p_restrictions:restrictions.value.trim()||null,p_source_ref:source.value.trim()});
  if(!uuid(id)||!alive(ctx.uid,at))throw Error('Winter agreement receipt not verified');await load(at);status.textContent='Source-labelled '+title+' plan recorded, no signed contract or dispatch.';});
 addStorm.onclick=()=>run(async at=>{allowed();const plan=snapshot.agreements.find(x=>x.id===stormAgreement.value&&x.service_key===key);
  if(!plan)throw Error('Choose owned '+title+' plan');const depth=Number(cm.value);
  if(!date.value||date.value<plan.starts_on||plan.ends_on&&date.value>plan.ends_on||
   !Number.isFinite(depth)||depth<0||depth>250)throw Error('Invalid storm date or accumulation');
  if(review.value==='activation_requested'&&(!weather.value.trim()||!safety.value.trim()||
   key==='snow_plowing'&&!fleet.value.trim()))throw Error('Activation review needs original weather/Safety/Fleet source labels');
  const ctx=await session();if(!window.confirm('Record an activation REVIEW only? It does not activate any route or certify workability, Safety or Fleet.'))return;
  const id=await rpc(ctx.sb,'ywi_rpc_pms_winter_storm_450',{
   p_company_id:company.value,p_agreement_id:plan.id,p_request_id:requestId(),
   p_storm_ref:stormRef.value.trim(),p_date:date.value,p_reported_cm:depth,p_hazard:hazard.value,
   p_route_review:review.value,p_weather_ref:weather.value.trim()||null,p_safety_ref:safety.value.trim()||null,
   p_fleet_ref:fleet.value.trim()||null,p_source_ref:stormSource.value.trim(),p_notes:stormNotes.value.trim()||null});
  if(!uuid(id)||!alive(ctx.uid,at))throw Error('Storm review receipt not verified');await load(at);status.textContent='Storm review recorded · independent original route activation and gates still HOLD.';});
 addPass.onclick=()=>run(async at=>{allowed();const storm=snapshot.storms.find(x=>x.id===passStorm.value&&x.service_key===key);
  if(!storm)throw Error('Choose a verified service-specific storm review');const n=Number(count.value);
  if(!passDate.value||!Number.isInteger(n)||n<1||n>30)throw Error('Valid date and 1–30 passes required');
  if(qc.value==='followup_required'&&qcNote.value.trim().length<3)throw Error('QC follow-up detail required');
  if(/(^https?:\/\/|\.\.|[?&#])/i.test(photo.value.trim()))throw Error('Private photo label only; no URL');
  const mat=material.value.trim(),qty=mat?Number(quantity.value):null;
  if(mat&&(!Number.isFinite(qty)||qty<=0||qty>100000))throw Error('Positive reported de-icing quantity required');
  const ctx=await session();if(!window.confirm('Append operator-reported winter passes? Not independently verified, dispatched or billed.'))return;
  const id=await rpc(ctx.sb,'ywi_rpc_pms_winter_pass_450',{
   p_company_id:company.value,p_storm_id:storm.id,p_request_id:requestId(),p_date:passDate.value,
   p_surface:surface.value,p_passes:n,p_outcome:outcome.value,p_deicer:mat||null,p_qty:qty,
   p_unit:mat?unit.value:null,p_qc:qc.value,p_qc_note:qcNote.value.trim()||null,
   p_source_ref:passSource.value.trim(),p_photo:photo.value.trim()||null,p_notes:passNotes.value.trim()||null});
  if(!uuid(id)||!alive(ctx.uid,at))throw Error('Field pass receipt not verified');await load(at);status.textContent='Manual '+title+' pass reported; QC and actual completion remain unverified.';});
 const invalidate=()=>{epoch++;identity=null;roster=[];company.replaceChildren();clear();status.textContent='Session/permissions changed; reverify '+title+' access.';};
 document.addEventListener('ywi:auth-changed',invalidate);
 document.addEventListener('ywi:module-permissions-changed',invalidate);
}
function mount(){mountOne('snow_removal','owner450Snow','Snow Removal');mountOne('snow_plowing','owner450Plow','Snow Plowing');}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

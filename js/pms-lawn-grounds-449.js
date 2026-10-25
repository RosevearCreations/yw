/* PMS 449 · independent Lawn & Grounds owner workspace.
 * 421/422 RPCs, never browser filtering, authorize company-specific NEW work.
 * Manual plans, measures and visit/QC reports do not dispatch/bill/verify work. */
(()=>{'use strict';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const services=Object.freeze(['mowing','edging','garden_care','leaf_cleanup','aeration','fertilizing','mixed_grounds']);
const recurr=Object.freeze(['weekly','biweekly','every_n_days','one_time']);
const statuses=Object.freeze(['planned','completed','weather_hold','skipped','qc_followup']);
const qcStates=Object.freeze(['pending','pass_reported','followup_required']);
const held=reason=>({state:'withheld',reason,enabled:false,plans:[],zones:[],visits:[],newWork:false});
function inspect(s,{companyId,now=Date.now(),jobsAllowed=false}={}){
 const time=Date.parse(s?.captured_at);
 if(!uuid(companyId)||s?.company_id!==companyId||
   s.owner_guard!=='ywi_422_assert_owner'||s.new_work_guard!=='ywi_421_assert_company_new_work'||
   s.module_key!=='landscape'||typeof s.enabled!=='boolean'||
   !Number.isFinite(time)||!Number.isFinite(now)||time>now+60000||now-time>300000||
   !Array.isArray(s.plans)||!Array.isArray(s.zones)||!Array.isArray(s.visits)||
   s.plan_count!==s.plans.length||s.zone_count!==s.zones.length||s.visit_count!==s.visits.length||
   s.plans.length>100||s.zones.length>200||s.visits.length>250||
   s.historical_read_retained!==true||s.dispatch_authorized!==false||
   s.invoice_posted!==false||s.qc_verified_independently!==false||
   s.mutation_authorized!==false||jobsAllowed!==true)
   return held('Fresh, bounded Lawn source, original service registry or company Jobs authorization unavailable');
 const plans=new Map(s.plans.map(p=>[p.id,p]));
 const zones=new Map(s.zones.map(z=>[z.id,z]));
 const visits=new Set(s.visits.map(v=>v.id));
 if(plans.size!==s.plans.length||zones.size!==s.zones.length||visits.size!==s.visits.length||
   s.plans.some(p=>!uuid(p.id)||p.company_id!==companyId||!uuid(p.client_id)||!uuid(p.site_id)||
     !p.client_name||!p.site_name||!services.includes(p.service_kind)||!recurr.includes(p.recurrence)||
     !/^\d{4}-\d{2}-\d{2}$/.test(p.anchor_date)||
     (p.recurrence==='every_n_days'?!(p.interval_days>=1&&p.interval_days<=60):p.interval_days!==null)||
     !Number.isInteger(p.quoted_cents)||p.quoted_cents<0||!p.source_reference)||
   s.zones.some(z=>!uuid(z.id)||z.company_id!==companyId||!plans.has(z.plan_id)||
     !z.zone_name||!(Number(z.area)>0)||!['sq_ft','sq_m'].includes(z.area_unit)||
     !['turf','garden_bed','hardscape','mixed'].includes(z.surface)||!z.source_reference)||
   s.visits.some(v=>!uuid(v.id)||v.company_id!==companyId||!plans.has(v.plan_id)||
     (v.zone_id!==null&&(!zones.has(v.zone_id)||zones.get(v.zone_id).plan_id!==v.plan_id))||
     !statuses.includes(v.reported_status)||!qcStates.includes(v.qc_status)||
     (v.qc_status==='followup_required'&&!v.qc_note)||
     !/^\d{4}-\d{2}-\d{2}$/.test(v.service_date)||
     !Number.isInteger(v.estimated_visit_cents)||v.estimated_visit_cents<0||!v.source_reference))
   return held('Foreign property, mismatched plan/zone, unbounded price or malformed QC evidence');
 return {state:'verified_lawn',enabled:s.enabled,companyId,plans:s.plans,zones:s.zones,
   visits:s.visits,newWork:s.enabled,historicalRead:true,canDispatch:false,canInvoice:false,
   qcIndependentlyVerified:false};
}
const day=iso=>{const n=Date.parse(iso+'T00:00:00Z');return Number.isFinite(n)?Math.floor(n/86400000):NaN};
const isoDay=n=>new Date(n*86400000).toISOString().slice(0,10);
function forecast(plan,{today=new Date().toISOString().slice(0,10),days=60,limit=6}={}){
 const start=day(plan?.anchor_date),from=day(today),end=plan?.season_end_date?day(plan.season_end_date):Infinity;
 const step={weekly:7,biweekly:14,every_n_days:plan?.interval_days,one_time:0}[plan?.recurrence];
 if(!Number.isInteger(start)||!Number.isInteger(from)||!Number.isInteger(days)||days<1||days>366||
  !Number.isInteger(limit)||limit<1||limit>12||!Number.isInteger(step)||step<0||step>60||end<start)
  return [];
 if(step===0)return start>=from&&start<=from+days&&start<=end?[isoDay(start)]:[];
 const first=start>=from?start:start+Math.ceil((from-start)/step)*step;
 const dates=[];
 for(let n=first;n<=Math.min(end,from+days)&&dates.length<limit;n+=step)dates.push(isoDay(n));
 return dates;
}
window.YWI449=Object.freeze({inspect,forecast,services,recurr,statuses,qcStates});
const el=(tag,txt)=>{const e=document.createElement(tag);if(txt!==undefined)e.textContent=String(txt);return e};
const input=(wrap,tag,label,id,max)=>{const l=el('label',label),f=el(tag);f.id=id;if(max)f.maxLength=max;l.append(f);wrap.append(l);return f};
const button=(wrap,id,label)=>{const b=el('button',label);b.type='button';b.id=id;b.className='secondary';wrap.append(b);return b};
function pick(f,items,empty='Choose...',name=x=>x.name){const prior=f.value;f.replaceChildren();const blank=el('option',empty);blank.value='';f.append(blank);
 for(const item of items){const opt=el('option',name(item));opt.value=item.id;f.append(opt)}
 if(items.some(x=>x.id===prior))f.value=prior;else if(items.length===1)f.value=items[0].id;}
function enums(f,values){for(const v of values){const opt=el('option',v.replaceAll('_',' '));opt.value=v;f.append(opt)}}
const cents=value=>{if(!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(String(value)))throw Error('Enter a nonnegative CAD amount with up to two decimals');
 const [whole,dec='']=String(value).split('.');return Number(whole)*100+Number(dec.padEnd(2,'0'));};
const requestId=()=>{const v=window.crypto?.randomUUID?.();if(!uuid(v))throw Error('Secure UUID required for exactly-once write');return v};
const formatCad=v=>(Number(v)/100).toLocaleString('en-CA',{style:'currency',currency:'CAD'});
async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
 if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.auth?.getUser||!sb?.from||!sb?.rpc||
    !window.YWISecurity?.canViewModule?.('admin',a.role,'manage')||
    !window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Active Admin manage and Jobs view required');
 const r=await sb.auth.getUser();if(r.error||r.data?.user?.id!==a.user.id)throw Error('Authenticated owner mismatch');
 return {uid:a.user.id,role:a.role,sb};}
async function rpc(sb,name,args){const r=await sb.rpc(name,args);if(r.error||r.data===null||r.data===undefined)
 throw Error(r.error?.message||'Private company Lawn source denied');return r.data;}
function mount(){const admin=document.getElementById('admin');if(!admin||document.getElementById('owner449'))return;
 const panel=el('details');panel.id='owner449';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='PMS · Lawn & Grounds';panel.dataset.adminHubGroups='management operations jobs';
 panel.append(el('summary','449 · Lawn & Grounds · Recurring Plans & Field QC'));
 const body=el('div');body.className='admin-panel-block';
 body.append(el('p','Standalone company-specific lawn program: recurring forecast, measured property zones, route and material notes, estimated prices and manual QC evidence. No automatic crew dispatch, invoice or verified completion.'));
 const help=el('a','ⓘ Lawn & Grounds Help');help.href='/help.html#pms-lawn-grounds-449';body.append(help);
 const toolbar=el('div');toolbar.className='pms449-grid';const company=input(toolbar,'select','Verified owner company','pms449Company');
 body.append(toolbar);const actions=el('div');actions.className='pms449-actions';const refresh=button(actions,'pms449Refresh','Verify lawn program');body.append(actions);
 const status=el('p','Sign in and verify a company before viewing Lawn records.');status.id='pms449Status';status.setAttribute('role','status');body.append(status);
 const history=el('div');history.id='pms449History';history.className='pms449-cards';body.append(history);
 const planForm=el('details');planForm.id='pms449PlanPanel';planForm.append(el('summary','Create recurring service plan (estimate only)'));
 const pf=el('div');pf.className='pms449-grid';const customer=input(pf,'select','Canonical customer','pms449Customer');
 const site=input(pf,'select','Company-linked property','pms449Site');const kind=input(pf,'select','Lawn service','pms449Kind');enums(kind,services);
 const recur=input(pf,'select','Cadence','pms449Recurrence');enums(recur,recurr);
 const interval=input(pf,'input','Interval days (only every_n_days)','pms449Interval');interval.type='number';interval.min='1';interval.max='60';
 const anchor=input(pf,'input','First service date','pms449Anchor');anchor.type='date';
 const end=input(pf,'input','Season end (optional)','pms449End');end.type='date';
 const minutes=input(pf,'input','Estimated service minutes','pms449Minutes');minutes.type='number';minutes.min='15';minutes.max='1440';minutes.value='60';
 const price=input(pf,'input','Estimated plan visit price (CAD)','pms449Price');price.value='0.00';
 const route=input(pf,'input','Route code / manual stop reference','pms449Route',100);
 const source=input(pf,'input','Source work authorization reference','pms449Source',160);
 const notes=input(pf,'textarea','Service scope and site restrictions','pms449Notes',600);planForm.append(pf);
 const create=button(planForm,'pms449Create','Save manual lawn plan');body.append(planForm);
 const zoneForm=el('details');zoneForm.id='pms449ZonePanel';zoneForm.append(el('summary','Add measured lawn zone'));
 const zf=el('div');zf.className='pms449-grid';const zonePlan=input(zf,'select','Existing verified lawn plan','pms449ZonePlan');
 const zoneName=input(zf,'input','Zone label','pms449ZoneName',100);const area=input(zf,'input','Measured area','pms449Area');area.type='number';area.min='0.01';area.step='0.01';
 const unit=input(zf,'select','Area unit','pms449AreaUnit');enums(unit,['sq_ft','sq_m']);const surface=input(zf,'select','Surface','pms449Surface');enums(surface,['turf','garden_bed','hardscape','mixed']);
 const zoneNote=input(zf,'textarea','Zone limitations / crew instructions','pms449ZoneNote',400);
 const zoneSource=input(zf,'input','Measurement source reference','pms449ZoneSource',160);zoneForm.append(zf);
 const zoneAdd=button(zoneForm,'pms449ZoneAdd','Append measured zone');body.append(zoneForm);
 const visitForm=el('details');visitForm.id='pms449VisitPanel';visitForm.append(el('summary','Record manual visit / material usage / QC'));
 const vf=el('div');vf.className='pms449-grid';const visitPlan=input(vf,'select','Existing verified lawn plan','pms449VisitPlan');
 const visitZone=input(vf,'select','Zone (optional; entire property)','pms449VisitZone');
 const date=input(vf,'input','Service date','pms449Date');date.type='date';const visitStatus=input(vf,'select','Reported visit status','pms449VisitStatus');enums(visitStatus,statuses);
 const visitRoute=input(vf,'input','Manual route/stop reference','pms449VisitRoute',100);
 const crew=input(vf,'input','Reported crew minutes','pms449Crew');crew.type='number';crew.min='0';crew.max='1440';crew.value='0';
 const travel=input(vf,'input','Reported travel minutes','pms449Travel');travel.type='number';travel.min='0';travel.max='720';travel.value='0';
 const material=input(vf,'input','Material (optional)','pms449Material',100);
 const quantity=input(vf,'input','Material quantity','pms449Quantity');quantity.type='number';quantity.min='0.01';quantity.step='0.01';
 const materialUnit=input(vf,'select','Material unit','pms449MaterialUnit');enums(materialUnit,['kg','litres','bags','units','cubic_m']);
 const visitPrice=input(vf,'input','Reported price estimate (CAD, never invoiced)','pms449VisitPrice');visitPrice.value='0.00';
 const qc=input(vf,'select','Reported field QC','pms449QC');enums(qc,qcStates);
 const qcNote=input(vf,'textarea','QC follow-up / defect detail','pms449QCNote',400);
 const photo=input(vf,'input','Private photo label (no URL)','pms449Photo',180);
 const visitSource=input(vf,'input','Manual visit evidence reference','pms449VisitSource',160);
 const visitNote=input(vf,'textarea','Factual crew / weather notes','pms449VisitNote',600);visitForm.append(vf);
 const visitAdd=button(visitForm,'pms449VisitAdd','Append manual field report');body.append(visitForm);
 const warning=el('p','An operator report is not an independently verified completion, signed work order or charge. Planned forecast dates do not dispatch crews.');body.append(warning);
 panel.append(body);admin.append(panel);
 let epoch=0,busy=false,identity=null,roster=[],customers=[],sites=[],review=null;
 const controls=[refresh,create,zoneAdd,visitAdd];
 const alive=(uid,at)=>at===epoch&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&window.YWI_AUTH.getState().user?.id===uid;
 const clear=()=>{review=null;customers=[];sites=[];history.replaceChildren();customer.replaceChildren();site.replaceChildren();zonePlan.replaceChildren();visitPlan.replaceChildren();visitZone.replaceChildren()};
 const eligible=()=>review?.state==='verified_lawn'&&review.newWork&&identity===window.YWI_AUTH?.getState?.()?.user?.id&&roster.some(c=>c.id===company.value);
 function render(v){review=v;history.replaceChildren();if(v.state!=='verified_lawn'){status.textContent='WITHHELD: '+v.reason;return;}
  status.textContent=(v.enabled?'Lawn ON':'Lawn OFF · authorized historical read only')+' · '+v.plans.length+' plans, '+v.zones.length+' zones, '+v.visits.length+' manual visits. No actual dispatch or invoice.';
  pick(zonePlan,v.plans,'Select lawn plan',x=>x.site_name+' · '+x.service_kind);
  pick(visitPlan,v.plans,'Select lawn plan',x=>x.site_name+' · '+x.service_kind);
  updateZoneChoices();
  for(const p of v.plans){const card=el('article');card.className='notice';card.dataset.pms449Plan=p.id;
   card.append(el('strong',p.client_name+' · '+p.site_name+' · '+p.service_kind.replaceAll('_',' ')));
   card.append(el('p',p.recurrence+' from '+p.anchor_date+' · '+formatCad(p.quoted_cents)+' manual per-visit price estimate'));
   const dates=forecast(p);card.append(el('p','Forecast only (not dispatched): '+(dates.join(', ')||'No planned dates in next 60 days')));
   card.append(el('p','Route: '+(p.route_reference||'unassigned')+' · source: '+p.source_reference));
   if(p.notes)card.append(el('p','Site constraints: '+p.notes));
   for(const z of v.zones.filter(z=>z.plan_id===p.id)){
    const line=el('p',z.zone_name+' · '+z.area+' '+z.area_unit+' · '+z.surface+' · '+(z.task_note||'no extra note'));
    line.dataset.pms449Zone=z.id;card.append(line);}
   for(const visit of v.visits.filter(x=>x.plan_id===p.id)){
    const line=el('p',visit.service_date+' · '+visit.reported_status.replaceAll('_',' ')+' · QC '+visit.qc_status.replaceAll('_',' ')+
      ' · '+formatCad(visit.estimated_visit_cents)+' estimated'+(visit.material_name?' · '+visit.material_quantity+' '+visit.material_unit+' '+visit.material_name:'')+
      ' · evidence '+visit.source_reference);
    line.dataset.pms449Visit=visit.id;card.append(line);
    if(visit.qc_note)card.append(el('p','Reported QC note: '+visit.qc_note));}
   history.append(card);}
  if(!v.plans.length)history.append(el('p','No company-linked Lawn plan yet; create one only when this company has Lawn enabled.'));
 }
 function updateZoneChoices(){const selected=visitPlan.value;pick(visitZone,review?.zones?.filter(z=>z.plan_id===selected)||[],
  'All zones / site visit',z=>z.zone_name+' · '+z.area+' '+z.area_unit);}
 visitPlan.onchange=updateZoneChoices;
 function chooseCompany(rows){const prior=company.value;pick(company,rows,'Choose verified owner company',x=>x.name);if(rows.some(x=>x.id===prior))company.value=prior;}
 async function loadCustomers(ctx,at){customers=[];sites=[];customer.replaceChildren();site.replaceChildren();
  if(!review?.enabled)return;
  const list=await rpc(ctx.sb,'ywi_rpc_company_customers_422',{p_company_id:company.value});
  if(!alive(ctx.uid,at)||!Array.isArray(list)||list.length>100||new Set(list.map(c=>c.id)).size!==list.length||
   list.some(c=>!uuid(c.id)||!c.name||typeof c.is_active!=='boolean'))throw Error('Canonical company customer roster unavailable');
  customers=list.filter(x=>x.is_active);pick(customer,customers,'Choose active company customer');
  if(customer.value)await loadSites(ctx,at);}
 async function loadSites(ctx,at){const cid=customer.value;site.replaceChildren();sites=[];
  if(!customers.some(c=>c.id===cid))return;
  const h=await rpc(ctx.sb,'ywi_rpc_customer_history_422',{p_company_id:company.value,p_client_id:cid});
  if(!alive(ctx.uid,at)||h.company_id!==company.value||h.client_id!==cid||h.legacy_unscoped_excluded!==true||
   !Array.isArray(h.properties)||h.properties.length>100||h.properties.some(x=>!uuid(x.id)||!x.name))throw Error('Verified canonical properties unavailable');
  sites=h.properties;pick(site,sites,'Choose company-linked site');}
 async function load(at){const ctx=await session();if(!alive(ctx.uid,at))throw Error('Owner changed during verification');
  const r=await ctx.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(r.error||!Array.isArray(r.data)||r.data.length>100||new Set(r.data.map(x=>x.id)).size!==r.data.length||
   r.data.some(x=>!uuid(x.id)||x.owner_user_id!==ctx.uid||!x.name)||!alive(ctx.uid,at))throw Error('Owner company roster incomplete or foreign');
  identity=ctx.uid;roster=r.data;chooseCompany(roster);
  if(!roster.length){render(held('No real owner company; Yard Rosevear is a synthetic test fixture'));return;}
  if(!roster.some(x=>x.id===company.value))throw Error('Choose owned company');
  const result=await rpc(ctx.sb,'ywi_rpc_pms_lawn_snapshot_449',{p_company_id:company.value});
  if(!alive(ctx.uid,at))throw Error('Company session changed during Lawn snapshot');
  render(inspect(result,{companyId:company.value,jobsAllowed:window.YWISecurity.canViewModule('jobs',ctx.role,'view')}));
  if(review?.state!=='verified_lawn')throw Error(review.reason);
  await loadCustomers(ctx,at);}
 async function run(task){if(busy)return;busy=true;controls.forEach(x=>x.disabled=true);const at=epoch;
  try{await task(at)}catch(e){clear();status.textContent='WITHHELD: '+(e?.message||String(e));}
  finally{busy=false;controls.forEach(x=>x.disabled=false)}}
 refresh.onclick=()=>run(load);
 company.onchange=()=>{epoch++;clear();status.textContent='Company changed — verify original Lawn entitlement again.'};
 customer.onchange=()=>{epoch++;const at=epoch;run(async()=>{
  const ctx=await session();if(!alive(ctx.uid,at)||!eligible())throw Error('Company authority changed');await loadSites(ctx,at);})};
 const allowed=()=>{if(!eligible()||!window.YWISecurity?.canViewModule?.('jobs',window.YWI_AUTH.getState().role,'create'))
  throw Error('Lawn ON, owner company and Jobs create permission required');};
 create.onclick=()=>run(async at=>{allowed();if(!customers.some(c=>c.id===customer.value)||!sites.some(s=>s.id===site.value))throw Error('Select verified customer and property');
  const intervalDays=recur.value==='every_n_days'?Number(interval.value):null;
  if(recur.value==='every_n_days'&&(!Number.isInteger(intervalDays)||intervalDays<1||intervalDays>60))throw Error('Choose interval 1–60 days');
  if(!anchor.value||end.value&&end.value<anchor.value||!Number.isInteger(Number(minutes.value))||Number(minutes.value)<15||Number(minutes.value)>1440)throw Error('Invalid date, season or estimated minutes');
  const amount=cents(price.value),ctx=await session();if(!alive(ctx.uid,at))throw Error('Identity changed');
  if(!window.confirm('Record a company-owned Lawn estimate plan? This does NOT dispatch work, sign a contract or invoice.'))return;
  const id=await rpc(ctx.sb,'ywi_rpc_pms_lawn_plan_449',{
   p_company_id:company.value,p_client_id:customer.value,p_site_id:site.value,p_request_id:requestId(),
   p_kind:kind.value,p_recurrence:recur.value,p_interval:intervalDays,p_anchor:anchor.value,
   p_end:end.value||null,p_minutes:Number(minutes.value),p_price_cents:amount,
   p_route_ref:route.value.trim()||null,p_source_ref:source.value.trim(),p_notes:notes.value.trim()||null});
  if(!uuid(id)||!alive(ctx.uid,at))throw Error('Plan creation receipt not verified');
  await load(at);status.textContent='Manual Lawn plan recorded; future dates are not scheduled dispatch.';});
 zoneAdd.onclick=()=>run(async at=>{allowed();if(!review.plans.some(x=>x.id===zonePlan.value))throw Error('Choose verified Lawn plan');
  if(!Number.isFinite(Number(area.value))||Number(area.value)<=0||Number(area.value)>1000000)throw Error('Area must be positive and measured');
  const ctx=await session();if(!window.confirm('Append this measured zone to the selected company plan?'))return;
  const id=await rpc(ctx.sb,'ywi_rpc_pms_lawn_zone_449',{p_company_id:company.value,p_plan_id:zonePlan.value,
   p_request_id:requestId(),p_name:zoneName.value.trim(),p_area:Number(area.value),p_unit:unit.value,
   p_surface:surface.value,p_note:zoneNote.value.trim()||null,p_source_ref:zoneSource.value.trim()});
  if(!uuid(id)||!alive(ctx.uid,at))throw Error('Zone receipt not verified');
  await load(at);status.textContent='Measured company Lawn zone appended; no operational Job created.';});
 visitAdd.onclick=()=>run(async at=>{allowed();if(!review.plans.some(x=>x.id===visitPlan.value)||
   (visitZone.value&&!review.zones.some(x=>x.id===visitZone.value&&x.plan_id===visitPlan.value)))throw Error('Choose verified plan and zone');
  const m=material.value.trim(),qty=m?Number(quantity.value):null,mu=m?materialUnit.value:null;
  if(m&&(!Number.isFinite(qty)||qty<=0||qty>1000000))throw Error('Material quantity required');
  if(!date.value||!Number.isInteger(Number(crew.value))||!Number.isInteger(Number(travel.value))||
    Number(crew.value)<0||Number(crew.value)>1440||Number(travel.value)<0||Number(travel.value)>720)throw Error('Invalid visit date or time');
  if(qc.value==='followup_required'&&!qcNote.value.trim())throw Error('Describe QC follow-up requirement');
  if(/(^https?:\/\/|\.\.|[?&#])/i.test(photo.value.trim()))throw Error('Photo must be a private label, never an URL');
  const amount=cents(visitPrice.value),ctx=await session();if(!window.confirm('Append manual Lawn visit and QC report? Operator claims are not independently verified, billed or dispatched.'))return;
  const id=await rpc(ctx.sb,'ywi_rpc_pms_lawn_visit_449',{
   p_company_id:company.value,p_plan_id:visitPlan.value,p_zone_id:visitZone.value||null,p_request_id:requestId(),
   p_date:date.value,p_status:visitStatus.value,p_route_ref:visitRoute.value.trim()||null,
   p_crew_minutes:Number(crew.value),p_travel_minutes:Number(travel.value),
   p_material:m||null,p_qty:qty,p_unit:mu,p_estimate_cents:amount,p_qc:qc.value,
   p_qc_note:qcNote.value.trim()||null,p_photo_ref:photo.value.trim()||null,
   p_source_ref:visitSource.value.trim(),p_note:visitNote.value.trim()||null});
  if(!uuid(id)||!alive(ctx.uid,at))throw Error('Manual visit receipt not verified');
  await load(at);status.textContent='Manual Lawn field record appended; no payment, Job status or independent QC certification.';});
 const invalidate=()=>{epoch++;identity=null;roster=[];clear();company.replaceChildren();status.textContent='Session/permissions changed; reverify private Lawn access.'};
 document.addEventListener('ywi:auth-changed',invalidate);
 document.addEventListener('ywi:module-permissions-changed',invalidate);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

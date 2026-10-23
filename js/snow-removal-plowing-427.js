/* Build 427 — shared storm, separately attributed original snow services. */
(()=>{'use strict';
const $=id=>document.getElementById(id),make=(tag,value)=>{const e=document.createElement(tag);if(value!=null)e.textContent=String(value);return e;};
const uuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s));
const kinds={snow_removal:['sidewalk','walkway','entrance','steps'],snow_plowing:['driveway','parking_area','roadway']};
function validate(d,company,order){
 if(!d||d.company_id!==company||d.work_order_id!==(order||null)||d.complete!==true||
  d.no_automatic_dispatch!==true||d.no_double_billing!==true||d.source_limit!==80||
  d.state!==(order?'review_only':'choose_order')||
  !['orders','sources','receipts','workability','safety','fleet'].every(k=>Array.isArray(d[k]))||
  d.orders.length>60||['sources','receipts','workability','safety','fleet'].some(k=>d[k].length>80)||
  d.orders.some(o=>!uuid(o.id)||!kinds[o.service]||!o.number)||
  d.sources.some(s=>!uuid(s.dispatch_id)||!uuid(s.storm_event_id)||!uuid(s.activation_id)||
   !['active','complete','paused','cancelled','staged'].includes(s.activation_status))||
  d.receipts.some(r=>!uuid(r.id)||!uuid(r.dispatch_id)||!uuid(r.storm_event_id)||
   !kinds[r.service_module_key]?.includes(r.surface_kind)||
   !['source_changed_hold','reported_unverified'].includes(r.evidence_state)||
   !['hold','independent_dispatch_safety_review_required'].includes(r.source_gate))||
  ['workability','safety','fleet'].some(k=>d[k].some(x=>!uuid(x.id)))||
  new Set(d.receipts.map(x=>x.dispatch_id)).size!==d.receipts.length||
  (order&&!d.orders.some(o=>o.id===order))||
  d.receipts.some(r=>!d.sources.some(s=>s.dispatch_id===r.dispatch_id&&s.storm_event_id===r.storm_event_id))||
  (!order&&['sources','receipts','workability','safety','fleet'].some(k=>d[k].length)))
  throw Error('Partial, foreign or duplicate storm-event evidence withheld');
 return d;
}
function mount(){const root=$('admin');if(!root||$('owner427'))return;
 const panel=make('details');panel.id='owner427';panel.className='admin-hub-detail';panel.dataset.adminHubTitle='Snow Removal & Plowing Event Separation';panel.dataset.adminHubGroups='management operations safety jobs';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';panel.appendChild(make('summary','427 · Snow Removal & Plowing Event Separation'));
 const body=make('div');body.className='admin-panel-block';body.appendChild(make('p','One storm may cover multiple distinct Jobs orders. Sidewalk/entrance snow removal and driveway/roadway plowing remain SEPARATE company offerings. Receipts are reported observations only; canonical Dispatch, weather Workability, Fleet and Safety control the work. No dispatch, weather override or invoice is issued here.'));
 const help=make('a','ⓘ Help');help.href='/help.html#snow-service-events-427';body.appendChild(help);
 const status=make('p','Sign in as an active company owner and refresh.');status.id='owner427Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const refresh=make('button','Refresh owned snow work');refresh.id='owner427Refresh';refresh.type='button';refresh.className='secondary';body.appendChild(refresh);body.appendChild(status);
 const grid=make('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:10px;min-width:0';
 function field(parent,id,label,tag='input'){const wrap=make('label',label),e=make(tag);e.id=id;if(tag==='input')e.type='text';e.style.cssText='display:block;box-sizing:border-box;width:100%;max-width:100%;min-width:0';wrap.appendChild(e);parent.appendChild(wrap);return e;}
 const company=field(grid,'owner427Company','Owned company','select'),order=field(grid,'owner427Order','Original snow service work order','select');body.appendChild(grid);
 const read=make('button','Review storm/dispatch evidence');read.id='owner427Read';read.className='secondary';read.type='button';body.appendChild(read);
 const results=make('div');results.id='owner427Results';results.style.cssText='display:grid;gap:10px;min-width:0;overflow-wrap:anywhere';body.appendChild(results);
 const form=make('fieldset');form.id='owner427Form';form.style.cssText='min-width:0;max-width:100%;box-sizing:border-box';form.appendChild(make('legend','Append reported snow-service event · NOT a dispatch or invoice'));
 const fields=make('div');fields.style.cssText=grid.style.cssText;
 const source=field(fields,'owner427Source','Original storm + dispatch route','select'),surface=field(fields,'owner427Surface','Service-specific surface','select');
 const key=field(fields,'owner427Key','Unique receipt key (a-z, 0-9, _)');
 const date=field(fields,'owner427Date','Observed service date');date.type='date';
 const passes=field(fields,'owner427Passes','Operator-reported passes (1–20)');passes.type='number';passes.min='1';passes.max='20';passes.step='1';
 const workability=field(fields,'owner427Workability','Original winter Workability observation','select');
 const safety=field(fields,'owner427Safety','Original site Safety plan','select');
 const fleet=field(fields,'owner427Fleet','Original truck Fleet readiness (plowing only)','select');form.appendChild(fields);
 const sourceRef=field(form,'owner427Reference','Original field log/reference (8–400 characters)');sourceRef.maxLength=400;
 const notes=field(form,'owner427Notes','Factual observations (20–1000 characters)','textarea');notes.maxLength=1000;notes.rows=3;
 const record=make('button','Append unverified service receipt');record.id='owner427Record';record.type='button';record.className='secondary';form.appendChild(record);body.appendChild(form);panel.appendChild(body);root.appendChild(panel);form.hidden=true;
 const fill=(e,rows,label)=>{const prev=e.value;e.replaceChildren();const empty=make('option',label);empty.value='';e.appendChild(empty);for(const r of rows){const opt=make('option',r.label);opt.value=r.id;e.appendChild(opt);}e.value=rows.some(r=>r.id===prev)?prev:'';};
 let session=null,companies=[],snapshot=null,orders=[],busy=false;
 const clear=()=>{session=null;companies=[];snapshot=null;orders=[];company.replaceChildren();order.replaceChildren();results.replaceChildren();form.hidden=true;};
 const note=s=>{status.textContent=s;};
 async function owner(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!a.user?.id||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)throw Error('Authenticated owner session required');
  const identity=await sb.auth.getUser();if(identity.error||identity.data?.user?.id!==a.user.id)throw Error('Session identity mismatch');return{uid:a.user.id,sb};}
 async function checked(){const cur=await owner();if(!session||session.uid!==cur.uid||!companies.some(c=>c.id===company.value))throw Error('Refresh owned company');return cur;}
 async function rpc(sb,name,args){const r=await sb.rpc(name,args);if(r.error||r.data==null)throw Error(r.error?.message||'Original Dispatch source withheld');return r.data;}
 const selectedService=()=>orders.find(x=>x.id===order.value)?.service;
 function render(d){results.replaceChildren();form.hidden=!d.work_order_id;
  if(!d.work_order_id){results.appendChild(make('p','Choose an original, company-owned snow service order.'));return;}
  const svc=selectedService();results.appendChild(make('p','Original service: '+svc+' · one storm can contain two separate services. Every source stays independently reviewed; no work completion or charge is implied.'));
  fill(source,d.sources.map(x=>({id:x.storm_event_id+'|'+x.dispatch_id,label:x.storm_code+' · '+x.storm_name+' · dispatch '+x.dispatch_id.slice(0,8)+' · '+x.schedule_status})),'Choose original storm/dispatch');
  fill(surface,kinds[svc].map(x=>({id:x,label:x.replaceAll('_',' ')})),'Select '+svc+' surface');
  fill(workability,d.workability.map(x=>({id:x.id,label:x.observation_code+' · '+x.service_date})),'No matching weather review · HOLD');
  fill(safety,d.safety.map(x=>({id:x.id,label:x.plan_number+' · '+x.supervisor_review_status})),'No Safety plan · HOLD');
  fill(fleet,d.fleet.map(x=>({id:x.id,label:'Truck '+x.equipment_item_id+' · '+x.readiness_status})),'No truck readiness · plowing HOLD');fleet.disabled=svc!=='snow_plowing';if(fleet.disabled)fleet.value='';
  if(!d.receipts.length)results.appendChild(make('p','No event receipts; empty history is NOT proof of snow clearing.'));
  for(const r of d.receipts){const article=make('article');article.className='notice';article.dataset.owner427Receipt=r.id;article.style.cssText='min-width:0;max-width:100%;overflow-wrap:anywhere';
   article.appendChild(make('strong','REPORTED · '+r.service_module_key+' · '+r.surface_kind+' · '+r.observed_on));
   article.appendChild(make('p',r.receipt_key+' · '+r.reported_passes+' reported passes · '+r.factual_notes));
   article.appendChild(make('p','Original log: '+r.source_reference+' · '+r.evidence_state));
   const gate=make('p','Source: '+r.source_gate+' · NO automatic dispatch / double billing');gate.dataset.owner427Gate=r.source_gate==='hold'?'hold':'review_only';article.appendChild(gate);results.appendChild(article);}
 }
 async function load(cur,id){const d=validate(await rpc(cur.sb,'ywi_rpc_snow_service_dashboard_427',{p_company_id:company.value,p_work_order_id:id}),company.value,id);snapshot=d;orders=d.orders;
  fill(order,orders.map(o=>({id:o.id,label:o.number+' · '+o.service+' · '+o.status})),'Choose original snow order');if(id)order.value=id;render(d);note('Original storm and separate service sources loaded; all field receipts are reported only.');}
 async function run(fn){if(busy)return;busy=true;for(const b of [refresh,read,record])b.disabled=true;
  try{await fn();}catch(e){results.replaceChildren();form.hidden=true;note('WITHHELD: '+(e?.message||e));}finally{busy=false;for(const b of [refresh,read,record])b.disabled=false;}}
 refresh.onclick=()=>run(async()=>{clear();const cur=await owner();const r=await cur.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(r.error||!Array.isArray(r.data)||r.data.length>100||r.data.some(c=>!uuid(c.id)||!c.name||c.owner_user_id!==cur.uid))throw Error('Incomplete owner-company readback');
  session={uid:cur.uid};companies=r.data;fill(company,companies.map(c=>({id:c.id,label:c.name})),'Choose owned company');if(companies.length===1){company.value=companies[0].id;await load(cur,null);}else note('Select your owned company.');});
 company.onchange=()=>run(async()=>{const cur=await checked();await load(cur,null);});
 order.onchange=()=>run(async()=>{const cur=await checked();if(!orders.some(x=>x.id===order.value)){results.replaceChildren();form.hidden=true;return;}await load(cur,order.value);});
 read.onclick=()=>run(async()=>{const cur=await checked();if(!orders.some(x=>x.id===order.value))throw Error('Choose a company snow order');await load(cur,order.value);});
 record.onclick=()=>run(async()=>{const cur=await checked(),svc=selectedService(),parts=source.value.split('|');
  if(!snapshot||!svc||parts.length!==2||!snapshot.sources.some(s=>s.storm_event_id===parts[0]&&s.dispatch_id===parts[1]))throw Error('Choose original storm and dispatch');
  const k=key.value.trim().toLowerCase(),ref=sourceRef.value.trim(),n=notes.value.trim(),p=Number(passes.value);
  if(!kinds[svc].includes(surface.value)||!/^[a-z0-9_]{3,50}$/.test(k)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date.value)||
   !Number.isInteger(p)||p<1||p>20||ref.length<8||ref.length>400||n.length<20||n.length>1000)throw Error('Provide service-specific surface, dated source, pass count and factual notes');
  if(!window.confirm('Append a REPORTED, unverified '+svc+' event? This does not dispatch a crew, override Workability/Safety or generate billing.'))return;
  const id=await rpc(cur.sb,'ywi_rpc_record_snow_service_427',{p_company_id:company.value,p_work_order_id:order.value,
   p_storm_id:parts[0],p_dispatch_id:parts[1],p_key:k,p_surface:surface.value,p_observed_on:date.value,p_passes:p,
   p_source_reference:ref,p_notes:n,p_workability_id:workability.value||null,p_safety_id:safety.value||null,
   p_fleet_id:svc==='snow_plowing'?(fleet.value||null):null});
  if(!uuid(id))throw Error('Missing server-side receipt identity');await load(cur,order.value);note('Reported '+svc+' event '+id.slice(0,8)+' saved. Safety and dispatch remain independent.');});
 document.addEventListener('ywi:auth-changed',()=>{clear();note('Session changed; refresh owned work.');});
}
window.YWI427=Object.freeze({validate});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

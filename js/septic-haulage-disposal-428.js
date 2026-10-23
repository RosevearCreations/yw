/* Item 428: original Jobs septic hauling and reported disposal artifacts. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const make=(tag,value)=>{const e=document.createElement(tag);if(value!=null)e.textContent=String(value);return e;};
const uuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s));
const streams=['septic','holding_tank','vacuum_waste'],methods=['meter','tank_gauge','weighbridge_conversion'];
function validate(d,company,order){
 if(!d||d.company_id!==company||d.work_order_id!==(order||null)||d.complete!==true||
  d.source_limit!==80||d.no_auto_disposal!==true||d.no_compliance_certification!==true||
  d.no_billing!==true||d.state!==(order?'review_only':'choose_order')||
  !['orders','dispatch','artifacts','fleet','safety','receipts'].every(k=>Array.isArray(d[k]))||
  d.orders.length>60||['dispatch','artifacts','fleet','safety','receipts'].some(k=>d[k].length>80)||
  d.orders.some(o=>!uuid(o.id)||!o.number)||
  d.dispatch.some(s=>!uuid(s.id)||!Array.isArray(s.assigned_crew_profile_ids)||
   s.assigned_crew_profile_ids.some(x=>!uuid(x)))||
  d.artifacts.some(a=>!uuid(a.id)||!uuid(a.execution_proof_id)||
   (a.dispatch_id!==null&&!uuid(a.dispatch_id)))||
  ['fleet','safety'].some(k=>d[k].some(x=>!uuid(x.id)))||
  d.receipts.some(r=>!uuid(r.id)||!uuid(r.dispatch_id)||!uuid(r.operator_profile_id)||
   !uuid(r.original_proof_media_id)||!streams.includes(r.waste_stream)||
   !methods.includes(r.measurement_method)||!Number.isFinite(Number(r.measured_volume_l))||
   Number(r.measured_volume_l)<=0||Number(r.measured_volume_l)>100000||
   !['source_changed_hold','operator_reported_unverified'].includes(r.evidence_state)||
   !['hold','independent_disposal_safety_review_required'].includes(r.review_gate))||
  new Set(d.receipts.map(r=>r.original_proof_media_id)).size!==d.receipts.length||
  (order&&!d.orders.some(o=>o.id===order))||
  d.receipts.some(r=>!d.dispatch.some(x=>x.id===r.dispatch_id)||
   !d.artifacts.some(x=>x.id===r.original_proof_media_id))||
  (!order&&['dispatch','artifacts','fleet','safety','receipts'].some(k=>d[k].length)))
  throw Error('Partial, duplicate or foreign septic evidence withheld');
 return d;
}
function mount(){const root=$('admin');if(!root||$('owner428'))return;
 const panel=make('details');panel.id='owner428';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Septic Haulage & Disposal Receipt Control';
 panel.dataset.adminHubGroups='management operations safety jobs';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.appendChild(make('summary','428 · Septic Haulage & Disposal Receipt Control'));
 const body=make('div');body.className='admin-panel-block';
 body.appendChild(make('p','Record the original septic job, assigned operator, measured tank volume and an existing uploaded Jobs proof-media disposal receipt. These remain operator-reported records, not legal compliance approval, certified waste disposal, Safety clearance, job completion or invoicing.'));
 const help=make('a','ⓘ Help');help.href='/help.html#septic-disposal-428';body.appendChild(help);
 const status=make('p','Sign in as an active company owner and refresh.');status.id='owner428Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const refresh=make('button','Refresh owned septic work');refresh.id='owner428Refresh';refresh.type='button';refresh.className='secondary';body.appendChild(refresh);body.appendChild(status);
 const grid=make('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:10px;min-width:0';
 function field(parent,id,label,tag='input'){const wrap=make('label',label),e=make(tag);e.id=id;if(tag==='input')e.type='text';e.style.cssText='display:block;width:100%;max-width:100%;box-sizing:border-box;min-width:0';wrap.appendChild(e);parent.appendChild(wrap);return e;}
 const company=field(grid,'owner428Company','Owned company','select'),order=field(grid,'owner428Order','Original septic Jobs work order','select');body.appendChild(grid);
 const read=make('button','Review original septic sources');read.id='owner428Read';read.className='secondary';read.type='button';body.appendChild(read);
 const results=make('div');results.id='owner428Results';results.style.cssText='display:grid;gap:10px;min-width:0;overflow-wrap:anywhere';body.appendChild(results);
 const form=make('fieldset');form.id='owner428Form';form.style.cssText='min-width:0;max-width:100%;box-sizing:border-box';
 form.appendChild(make('legend','Append operator-reported haul/disposal proof · NOT certification'));
 const fields=make('div');fields.style.cssText=grid.style.cssText;
 const dispatch=field(fields,'owner428Dispatch','Original Dispatch','select');
 const operator=field(fields,'owner428Operator','Assigned operator','select');
 const artifact=field(fields,'owner428Artifact','Original uploaded disposal receipt image','select');
 const receiptKey=field(fields,'owner428Key','Unique evidence key');
 const collected=field(fields,'owner428Collected','Tank collection date');collected.type='date';
 const disposed=field(fields,'owner428Disposed','Disposal facility receipt date');disposed.type='date';
 const stream=field(fields,'owner428Stream','Reported waste stream','select');
 const volume=field(fields,'owner428Volume','Measured tank volume · litres');volume.type='number';volume.min='0.01';volume.max='100000';volume.step='0.01';
 const method=field(fields,'owner428Method','Volume measurement method','select');
 const fleet=field(fields,'owner428Fleet','Original truck Fleet readiness','select');
 const safety=field(fields,'owner428Safety','Original site Safety plan','select');
 for(const k of streams){const o=make('option',k.replaceAll('_',' '));o.value=k;stream.appendChild(o);}
 for(const k of methods){const o=make('option',k.replaceAll('_',' '));o.value=k;method.appendChild(o);}
 form.appendChild(fields);
 const measurement=field(form,'owner428Measurement','Source for actual measured volume (8–300 characters)');measurement.maxLength=300;
 const facility=field(form,'owner428Facility','Facility name on the disposal receipt');facility.maxLength=180;
 const number=field(form,'owner428Number','Actual disposal receipt number');number.maxLength=100;
 const notes=field(form,'owner428Notes','Factual operator observations (20–1000 characters)','textarea');notes.maxLength=1000;notes.rows=3;
 const record=make('button','Append unverified haul/disposal evidence');record.id='owner428Record';record.type='button';record.className='secondary';form.appendChild(record);body.appendChild(form);panel.appendChild(body);root.appendChild(panel);form.hidden=true;
 const fill=(el,items,placeholder)=>{const prev=el.value;el.replaceChildren();const opt=make('option',placeholder);opt.value='';el.appendChild(opt);for(const r of items){const o=make('option',r.label);o.value=r.id;el.appendChild(o);}el.value=items.some(x=>x.id===prev)?prev:'';};
 let session=null,companies=[],snapshot=null,orders=[],busy=false;
 const clear=()=>{session=null;companies=[];snapshot=null;orders=[];company.replaceChildren();order.replaceChildren();results.replaceChildren();form.hidden=true;};
 const note=s=>{status.textContent=s;};
 async function owner(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!a.user?.id||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)throw Error('Authenticated company owner required');
  const identity=await sb.auth.getUser();if(identity.error||identity.data?.user?.id!==a.user.id)throw Error('Session identity mismatch');return{uid:a.user.id,sb};}
 async function checked(){const cur=await owner();if(!session||session.uid!==cur.uid||!companies.some(c=>c.id===company.value))throw Error('Refresh owned company');return cur;}
 async function rpc(sb,name,args){const r=await sb.rpc(name,args);if(r.error||r.data==null)throw Error(r.error?.message||'Original septic source withheld');return r.data;}
 function render(d){results.replaceChildren();form.hidden=!d.work_order_id;
  if(!d.work_order_id){results.appendChild(make('p','Choose an original, company-owned septic work order.'));return;}
  fill(dispatch,d.dispatch.map(x=>({id:x.id,label:'Dispatch '+x.id.slice(0,8)+' · '+x.schedule_status})),'Choose original dispatch');
  fill(artifact,d.artifacts.map(x=>({id:x.id,label:(x.asset_key||'Stored artifact')+' · '+x.id.slice(0,8)})),'Choose original uploaded disposal artifact');
  fill(fleet,d.fleet.map(x=>({id:x.id,label:'Truck '+x.equipment_item_id+' · '+x.readiness_status})),'No verified truck readiness · HOLD');
  fill(safety,d.safety.map(x=>({id:x.id,label:x.plan_number+' · '+x.supervisor_review_status})),'No Safety approval · HOLD');
  updateOperators();
  if(!d.receipts.length)results.appendChild(make('p','No haul/disposal evidence recorded. This does not prove a pickup or facility receipt exists.'));
  for(const r of d.receipts){const article=make('article');article.className='notice';article.style.cssText='min-width:0;max-width:100%;overflow-wrap:anywhere';article.dataset.owner428Receipt=r.id;
   article.appendChild(make('strong','REPORTED ONLY · '+r.waste_stream+' · '+r.collected_on+' → '+r.disposed_on));
   article.appendChild(make('p',r.measured_volume_l+' litres · '+r.measurement_method+' · operator '+r.operator_profile_id.slice(0,8)));
   article.appendChild(make('p','Facility '+r.disposal_facility+' · receipt '+r.disposal_receipt_number+' · '+r.factual_notes));
   article.appendChild(make('p',r.evidence_state+' · '+r.review_gate+' · NO compliance certification or billing'));
   article.dataset.owner428Gate=r.review_gate==='hold'?'hold':'review_only';results.appendChild(article);}
 }
 function updateOperators(){const d=snapshot?.dispatch.find(x=>x.id===dispatch.value);
  const ids=[d?.assigned_supervisor_profile_id,d?.lead_profile_id,...(d?.assigned_crew_profile_ids||[])].filter(uuid);
  const unique=[...new Set(ids)];fill(operator,unique.map(id=>({id,label:'Original assigned profile '+id.slice(0,8)})),'Choose assigned operator');
  if(snapshot)fill(artifact,snapshot.artifacts.filter(x=>x.dispatch_id===null||x.dispatch_id===dispatch.value)
   .map(x=>({id:x.id,label:(x.asset_key||'Stored artifact')+' · '+x.id.slice(0,8)})),'Choose receipt image for this dispatch');}
 async function load(cur,id){const d=validate(await rpc(cur.sb,'ywi_rpc_septic_disposal_dashboard_428',{p_company_id:company.value,p_work_order_id:id}),company.value,id);
  snapshot=d;orders=d.orders;fill(order,orders.map(x=>({id:x.id,label:x.number+' · '+x.status})),'Choose septic work order');if(id)order.value=id;render(d);note('Original Jobs/Dispatch/Media/Fleet/Safety loaded. All observations remain unverified.');}
 async function run(fn){if(busy)return;busy=true;for(const b of [refresh,read,record])b.disabled=true;
  try{await fn();}catch(e){results.replaceChildren();form.hidden=true;note('WITHHELD: '+(e?.message||e));}
  finally{busy=false;for(const b of [refresh,read,record])b.disabled=false;}}
 refresh.onclick=()=>run(async()=>{clear();const cur=await owner();const r=await cur.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(r.error||!Array.isArray(r.data)||r.data.length>100||r.data.some(x=>!uuid(x.id)||!x.name||x.owner_user_id!==cur.uid))throw Error('Incomplete owner company readback');
  session={uid:cur.uid};companies=r.data;fill(company,companies.map(x=>({id:x.id,label:x.name})),'Choose owned company');if(companies.length===1){company.value=companies[0].id;await load(cur,null);}else note('Select your owned company.');});
 company.onchange=()=>run(async()=>{const cur=await checked();await load(cur,null);});
 order.onchange=()=>run(async()=>{const cur=await checked();if(!orders.some(x=>x.id===order.value)){results.replaceChildren();form.hidden=true;return;}await load(cur,order.value);});
 dispatch.onchange=updateOperators;
 read.onclick=()=>run(async()=>{const cur=await checked();if(!orders.some(x=>x.id===order.value))throw Error('Choose a company septic work order');await load(cur,order.value);});
 record.onclick=()=>run(async()=>{const cur=await checked();const k=receiptKey.value.trim().toLowerCase();
  const measure=measurement.value.trim(),fac=facility.value.trim(),num=number.value.trim(),n=notes.value.trim(),v=Number(volume.value);
  if(!snapshot||!snapshot.dispatch.some(x=>x.id===dispatch.value)||!operator.value||!Array.from(operator.options).some(x=>x.value===operator.value)||
   !snapshot.artifacts.some(x=>x.id===artifact.value&&(x.dispatch_id===null||x.dispatch_id===dispatch.value))||
   !/^[a-z0-9_]{3,50}$/.test(k)||!/^\d{4}-\d{2}-\d{2}$/.test(collected.value)||!/^\d{4}-\d{2}-\d{2}$/.test(disposed.value)||
   disposed.value<collected.value||!streams.includes(stream.value)||!methods.includes(method.value)||
   !Number.isFinite(v)||v<=0||v>100000||measure.length<8||measure.length>300||fac.length<4||fac.length>180||num.length<4||num.length>100||n.length<20||n.length>1000)
   throw Error('Provide original Dispatch/operator/uploaded receipt, dates, measured litres and factual sources');
  if(!window.confirm('Record UNVERIFIED septic collection/disposal evidence? An original uploaded receipt image is required. This does not certify legal disposal, clear Safety or bill the customer.'))return;
  const id=await rpc(cur.sb,'ywi_rpc_record_septic_disposal_428',{p_company_id:company.value,p_work_order_id:order.value,
   p_dispatch_id:dispatch.value,p_operator_id:operator.value,p_key:k,p_collected_on:collected.value,
   p_waste_stream:stream.value,p_volume_l:v,p_measurement_method:method.value,
   p_measurement_source:measure,p_facility:fac,p_receipt_number:num,p_disposed_on:disposed.value,
   p_proof_media_id:artifact.value,p_notes:n,p_fleet_id:fleet.value||null,p_safety_id:safety.value||null});
  if(!uuid(id))throw Error('Missing original receipt identity');await load(cur,order.value);
  note('Unverified receipt '+id.slice(0,8)+' recorded. Independent licensed disposal/Safety review still required.');});
 document.addEventListener('ywi:auth-changed',()=>{clear();note('Session changed; refresh owned septic records.');});
}
window.YWI428=Object.freeze({validate});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

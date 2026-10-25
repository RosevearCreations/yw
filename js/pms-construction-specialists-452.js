/* YW 452 · Construction, Concrete, Fibre and Excavation review-only source workspace.
 * Every project requires an original 425 construction Jobs work order and 422 site link.
 * Operator labels are NOT permit, utility, Safety, inspection, dispatch or Finance approvals. */
(()=>{'use strict';
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const ref=s=>typeof s==='string'&&s.trim().length>=3;
const day=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s));
const specialties=Object.freeze(['light_construction','concrete','fibre_line','excavation','land_clearance','ditch_digging']);
const activities=Object.freeze({
 light_construction:['site_review','permit_review','inspection','other','formwork','grading','clearing'],
 concrete:['site_review','permit_review','inspection','other','formwork','reinforcement','pour','cure'],
 fibre_line:['site_review','permit_review','inspection','other','cable_route','utility_locate','trench','conduit','backfill'],
 excavation:['site_review','permit_review','inspection','other','utility_locate','shoring','dig','backfill','grading'],
 land_clearance:['site_review','permit_review','inspection','other','clearing','grading'],
 ditch_digging:['site_review','permit_review','inspection','other','utility_locate','shoring','ditch','grading']
});
const permitStates=Object.freeze(['unreviewed','not_required_claim','required_unverified','source_provided']);
const fieldStates=Object.freeze(['plan_only','operator_reported','hold']);
const units=Object.freeze(['m','m2','m3','hours','units']);
const withheld=reason=>({state:'withheld',reason,orders:[],projects:[],evidence:[]});
function inspect(s,{companyId,now=Date.now(),jobsAllowed=false}={}){
 const t=Date.parse(s?.captured_at);
 if(!uuid(companyId)||s?.company_id!==companyId||s.owner_guard!=='ywi_422_assert_owner'||
  s.new_work_guard!=='ywi_421_assert_company_new_work'||
  s.original_order_guard!=='ywi_425_assert_construction_order'||s.module_key!=='construction'||
  typeof s.enabled!=='boolean'||!jobsAllowed||!Number.isFinite(t)||t>now+60000||now-t>300000||
  !Array.isArray(s.orders)||!Array.isArray(s.projects)||!Array.isArray(s.evidence)||
  s.orders.length!==s.order_count||s.projects.length!==s.project_count||s.evidence.length!==s.evidence_count||
  s.orders.length>60||s.projects.length>150||s.evidence.length>300||
  s.historical_read_retained!==true||s.permit_verified!==false||s.utility_clearance_verified!==false||
  s.safety_cleared!==false||s.inspection_approved!==false||s.field_work_authorized!==false||
  s.dispatch_authorized!==false||s.finance_posted!==false||s.mutation_authorized!==false)
  return withheld('Fresh complete company Construction sources, owner rights and Jobs access required');
 const orders=new Map(s.orders.map(x=>[x.id,x]));
 const projects=new Map(s.projects.map(x=>[x.id,x]));
 if(orders.size!==s.orders.length||projects.size!==s.projects.length||
  new Set(s.evidence.map(x=>x.id)).size!==s.evidence.length||
  s.orders.some(x=>!uuid(x.id)||x.company_id!==companyId||!uuid(x.client_id)||!uuid(x.site_id)||
   !x.number||!x.client_name||!x.site_name)||
  s.projects.some(x=>!uuid(x.id)||x.company_id!==companyId||!orders.has(x.work_order_id)||
   x.client_id!==orders.get(x.work_order_id)?.client_id||x.site_id!==orders.get(x.work_order_id)?.site_id||
   !specialties.includes(x.specialty)||!ref(x.scope_label)||!ref(x.scope_notes)||!ref(x.site_hazard_source)||
   !ref(x.original_scope_source)||!permitStates.includes(x.permit_state)||
   x.permit_state==='source_provided'&&!ref(x.permit_source))||
  s.evidence.some(x=>!uuid(x.id)||x.company_id!==companyId||!projects.has(x.project_id)||
   !day(x.observed_on)||!activities[projects.get(x.project_id)?.specialty]?.includes(x.activity)||
   !fieldStates.includes(x.field_state)||!ref(x.evidence_reference)||
   (x.reported_quantity===null)!==(x.quantity_unit===null)||
   x.reported_quantity!==null&&(!(Number(x.reported_quantity)>0)||!units.includes(x.quantity_unit))||
   x.field_state==='operator_reported'&&(!ref(x.safety_source)||
    ['fibre_line','excavation','ditch_digging'].includes(projects.get(x.project_id).specialty)&&!ref(x.utility_locate_source))))
  return withheld('Foreign, duplicate, mismatched or incomplete original construction evidence');
 return {state:'verified_construction',companyId,enabled:s.enabled,orders:s.orders,projects:s.projects,
  evidence:s.evidence,canPermit:false,canLocate:false,canDispatch:false,canInvoice:false,canApprove:false};
}
window.YWI452=Object.freeze({specialties,activities,permitStates,fieldStates,units,inspect});
const el=(tag,value)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=String(value);return x};
const field=(parent,tag,label,id,max)=>{const l=el('label',label),f=el(tag);f.id=id;if(max)f.maxLength=max;l.append(f);parent.append(l);return f};
const button=(parent,id,title)=>{const b=el('button',title);b.type='button';b.id=id;b.className='secondary';parent.append(b);return b};
const choices=(select,list)=>{for(const key of list){const o=el('option',key.replaceAll('_',' '));o.value=key;select.append(o)}};
const pick=(select,list,hint,lab=x=>x.name)=>{const old=select.value;select.replaceChildren();const blank=el('option',hint);blank.value='';select.append(blank);
 for(const x of list){const o=el('option',lab(x));o.value=x.id;select.append(o)}
 select.value=list.some(x=>x.id===old)?old:list.length===1?list[0].id:'';};
const requestId=()=>{const x=window.crypto?.randomUUID?.();if(!uuid(x))throw Error('Secure request UUID required');return x;};
async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
 if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.auth?.getUser||!sb?.rpc||!sb?.from||
  !window.YWISecurity?.canViewModule?.('admin',a.role,'manage')||
  !window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))
  throw Error('Active owner, Admin manage and Jobs view permissions required');
 const r=await sb.auth.getUser();if(r.error||r.data?.user?.id!==a.user.id)throw Error('Authenticated owner mismatch');
 return{uid:a.user.id,role:a.role,sb};}
async function rpc(sb,name,args){const r=await sb.rpc(name,args);if(r.error||r.data==null)throw Error(r.error?.message||'Original source withheld');return r.data;}
function mount(){const root=document.getElementById('admin');if(!root||document.getElementById('owner452Construction'))return;
 const panel=el('details');panel.id='owner452Construction';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='PMS · Construction, Concrete, Fibre & Excavation';
 panel.dataset.adminHubGroups='management operations jobs safety';
 panel.append(el('summary','452 · Construction, Concrete, Fibre Lines & Excavation'));
 const body=el('div');body.className='admin-panel-block';
 body.append(el('p','Company-owned construction specialties, original Jobs work orders, manual site scope and append-only field evidence. No source label issues a permit, verifies utility locates, grants excavation access, approves a concrete pour, dispatches staff or posts Finance.'));
 const help=el('a','ⓘ Construction specialty help');help.href='/help.html#pms-construction-452';body.append(help);
 const filters=el('div');filters.className='pms452-tabs';filters.setAttribute('role','group');filters.setAttribute('aria-label','Construction specialty view');
 const tabs=new Map();let selected='concrete';
 for(const key of specialties){const b=button(filters,'pms452Tab'+key,key.replaceAll('_',' '));b.setAttribute('aria-pressed',String(selected===key));tabs.set(key,b);}
 body.append(filters);
 const head=el('div');head.className='pms452-grid';const company=field(head,'select','Verified original owner company','pms452Company');body.append(head);
 const actions=el('div');actions.className='pms452-actions';const refresh=button(actions,'pms452Refresh','Verify construction records');body.append(actions);
 const status=el('p','Choose an original owner company and refresh.');status.id='pms452Status';status.setAttribute('role','status');body.append(status);
 const history=el('div');history.id='pms452History';history.className='pms452-cards';body.append(history);
 const projectForm=el('details');projectForm.id='pms452ProjectPanel';projectForm.append(el('summary','Create specialty scope source (not field authorization)'));
 const pg=el('div');pg.className='pms452-grid';
 const order=field(pg,'select','Original construction Jobs work order','pms452Order');
 const subtype=field(pg,'select','Construction specialty','pms452Specialty');choices(subtype,specialties);
 const label=field(pg,'input','Site/phase scope label','pms452Label',140);
 const scope=field(pg,'textarea','Factual scope and location notes','pms452Scope',750);
 const permit=field(pg,'select','Permit evidence stage (operator claim only)','pms452Permit');choices(permit,permitStates);
 const permitSource=field(pg,'input','Permit/source label (not certification)','pms452PermitSource',160);
 const utility=field(pg,'input','Original utility locate/reference label','pms452Utility',160);
 const hazard=field(pg,'input','Original site hazard source reference','pms452Hazard',160);
 const source=field(pg,'input','Original Jobs/scope source reference','pms452Source',160);
 projectForm.append(pg);const add=button(projectForm,'pms452Add','Record scope for review only');body.append(projectForm);
 const reportForm=el('details');reportForm.id='pms452EvidencePanel';reportForm.append(el('summary','Append original field/permit evidence (not approval)'));
 const fg=el('div');fg.className='pms452-grid';
 const project=field(fg,'select','Verified original company scope','pms452Project');
 const date=field(fg,'input','Reported date of field observation','pms452Date');date.type='date';
 const activity=field(fg,'select','Specialty-specific activity','pms452Activity');
 const quantity=field(fg,'input','Measured/reported quantity (optional)','pms452Quantity');quantity.type='number';quantity.min='0.001';quantity.max='10000000';quantity.step='0.001';
 const unit=field(fg,'select','Quantity unit','pms452Unit');choices(unit,units);
 const state=field(fg,'select','Evidence state (never approved)','pms452State');choices(state,fieldStates);
 const fPermit=field(fg,'input','Original permit source reference','pms452FieldPermit',160);
 const fUtility=field(fg,'input','Original utility locate source','pms452FieldUtility',160);
 const safety=field(fg,'input','Original Safety source reference','pms452Safety',160);
 const inspection=field(fg,'input','Original inspection source reference','pms452Inspection',160);
 const evidence=field(fg,'input','Original photo/report/ticket evidence reference','pms452EvidenceSource',160);
 const notes=field(fg,'textarea','Factual field notes / unresolved holds','pms452Notes',750);
 reportForm.append(fg);const append=button(reportForm,'pms452Append','Append field report · HOLD');body.append(reportForm);
 body.append(el('p','Original Item 425 construction phases, permit decisions, independent Safety, utility locating, inspections, Finance releases, site authorization and Dispatch remain separate review requirements.'));
 const original=el('a','Open original 425 construction permit & change controls');original.href='#owner425';body.append(original);
 panel.append(body);root.append(panel);
 let epoch=0,busy=false,identity=null,roster=[],snapshot=null,chosenActivity='';
 const controls=[refresh,add,append];
 const alive=(uid,e)=>epoch===e&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&window.YWI_AUTH.getState().user?.id===uid;
 const clear=()=>{snapshot=null;history.replaceChildren();order.replaceChildren();project.replaceChildren();activity.replaceChildren();};
 const entitled=()=>snapshot?.state==='verified_construction'&&snapshot.enabled===true&&identity===window.YWI_AUTH?.getState?.()?.user?.id&&roster.some(x=>x.id===company.value);
 const allowed=()=>{if(!entitled()||!window.YWISecurity?.canViewModule?.('jobs',window.YWI_AUTH.getState().role,'create'))
  throw Error('Owned construction entitlement ON and original Jobs-create role required');};
 function render(){history.replaceChildren();if(snapshot?.state!=='verified_construction'){
  status.textContent='WITHHELD: '+(snapshot?.reason||'Verify original sources');return;}
  const rows=snapshot.projects.filter(x=>x.specialty===selected);
  status.textContent='Construction '+(snapshot.enabled?'ON':'OFF · historical owned records only')+
   ' · '+selected.replaceAll('_',' ')+' · '+rows.length+' scope(s) · independent permits, Safety, locates, Dispatch and Finance HOLD.';
  pick(order,snapshot.orders,'Choose canonical construction order',x=>x.number+' · '+x.site_name);
  pick(project,snapshot.projects.filter(x=>x.specialty===selected),'Select owned '+selected+' scope',x=>x.scope_label+' · '+x.site_name);
  const opts=activities[selected],oldActivity=activity.value||chosenActivity;
  activity.replaceChildren();choices(activity,opts);
  if(opts.includes(oldActivity))activity.value=oldActivity;
  chosenActivity=activity.value;
  for(const x of rows){const card=el('article');card.className='notice';card.dataset.pms452Project=x.id;
   card.append(el('strong',x.client_name+' · '+x.site_name+' · '+x.scope_label));
   card.append(el('p',x.scope_notes+' · original order '+x.work_order_id));
   card.append(el('p','Permit (reported only): '+x.permit_state+' · '+(x.permit_source||'no source')+
    ' · locate '+(x.utility_locate_source||'unverified')+' · hazards '+x.site_hazard_source));
   for(const e of snapshot.evidence.filter(r=>r.project_id===x.id)){
    const note=el('p',e.observed_on+' · '+e.activity+' · '+(e.reported_quantity??'no quantity')+' '+(e.quantity_unit??'')+
     ' · '+e.field_state+' · original evidence '+e.evidence_reference+' · Safety '+(e.safety_source||'HOLD'));
    note.dataset.pms452Evidence=e.id;card.append(note);}
   history.append(card);}
  if(!rows.length)history.append(el('p','No source-backed '+selected.replaceAll('_',' ')+' scope recorded for this company.'));
 }
 async function load(e){const ctx=await session();if(!alive(ctx.uid,e))throw Error('Session changed');
  const r=await ctx.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(r.error||!Array.isArray(r.data)||r.data.length>100||new Set(r.data.map(x=>x.id)).size!==r.data.length||
   r.data.some(x=>!uuid(x.id)||x.owner_user_id!==ctx.uid||!x.name)||!alive(ctx.uid,e))
   throw Error('Original company roster withheld');
  identity=ctx.uid;roster=r.data;pick(company,roster,'Choose owned company');
  if(!roster.length){snapshot=withheld('No active owner company; Yard Rosevear is only a local synthetic fixture');render();return;}
  const raw=await rpc(ctx.sb,'ywi_rpc_pms_construction_snapshot_452',{p_company_id:company.value});
  if(!alive(ctx.uid,e))throw Error('Company or identity changed');
  snapshot=inspect(raw,{companyId:company.value,jobsAllowed:window.YWISecurity.canViewModule('jobs',ctx.role,'view')});
  render();if(snapshot.state!=='verified_construction')throw Error(snapshot.reason);
 }
 async function run(fn){if(busy)return;busy=true;controls.forEach(x=>x.disabled=true);const e=epoch;
  try{await fn(e)}catch(error){clear();status.textContent='WITHHELD: '+(error?.message||String(error));}
  finally{busy=false;controls.forEach(x=>x.disabled=false);}}
 refresh.onclick=()=>run(load);
 company.onchange=()=>{epoch++;chosenActivity='';clear();status.textContent='Company changed · reverify original owner scope';};
 activity.onchange=()=>{chosenActivity=activity.value;};
 for(const [key,b] of tabs)b.onclick=()=>{selected=key;subtype.value=key;for(const [k,x] of tabs)x.setAttribute('aria-pressed',String(k===key));if(snapshot)render();};
 subtype.value=selected;
 add.onclick=()=>run(async e=>{allowed();const wo=snapshot.orders.find(x=>x.id===order.value);
  if(!wo||!specialties.includes(subtype.value)||!ref(label.value)||scope.value.trim().length<10||
   !ref(hazard.value)||!ref(source.value)||permit.value==='source_provided'&&!ref(permitSource.value))
   throw Error('Choose an original company work order, specialty, hazard and scope sources');
  const ctx=await session();if(!window.confirm('Record unverified construction scope without permits, digging, dispatch or finance approval?'))return;
  const id=await rpc(ctx.sb,'ywi_rpc_pms_construction_project_452',{p_company_id:company.value,
   p_order_id:wo.id,p_client_id:wo.client_id,p_site_id:wo.site_id,p_request_id:requestId(),
   p_specialty:subtype.value,p_label:label.value.trim(),p_notes:scope.value.trim(),
   p_permit_state:permit.value,p_permit_source:permitSource.value.trim()||null,
   p_utility_source:utility.value.trim()||null,p_hazard_source:hazard.value.trim(),p_scope_source:source.value.trim()});
  if(!uuid(id)||!alive(ctx.uid,e))throw Error('Original project source receipt missing');
  selected=subtype.value;tabs.get(selected)?.click();await load(e);
  status.textContent='Construction source recorded; all field, permit and utility authorizations HOLD.';});
 append.onclick=()=>run(async e=>{allowed();const p=snapshot.projects.find(x=>x.id===project.value);
  if(!p||!day(date.value)||!activities[p.specialty].includes(activity.value)||!fieldStates.includes(state.value)||!ref(evidence.value))
   throw Error('Choose verified original scope, compatible activity, date and source');
  const q=quantity.value.trim()===''?null:Number(quantity.value);
  if(q!==null&&(!Number.isFinite(q)||q<=0||q>10000000)||state.value==='operator_reported'&&
   (!ref(safety.value)||['fibre_line','excavation','ditch_digging'].includes(p.specialty)&&!ref(fUtility.value)))
   throw Error('Measured quantity and original Safety/utility-locate source labels required; no clearance');
  const ctx=await session();if(!window.confirm('Append operator-reported construction evidence only? This does not approve a permit, locate, excavation or pour.'))return;
  const id=await rpc(ctx.sb,'ywi_rpc_pms_construction_evidence_452',{p_company_id:company.value,
   p_project_id:p.id,p_request_id:requestId(),p_date:date.value,p_activity:activity.value,
   p_quantity:q,p_unit:q===null?null:unit.value,p_state:state.value,
   p_permit_source:fPermit.value.trim()||null,p_utility_source:fUtility.value.trim()||null,
   p_safety_source:safety.value.trim()||null,p_inspection_source:inspection.value.trim()||null,
   p_evidence_source:evidence.value.trim(),p_notes:notes.value.trim()||null});
  if(!uuid(id)||!alive(ctx.uid,e))throw Error('Original field source receipt missing');
  await load(e);status.textContent='Field evidence recorded, independent approval and Dispatch HOLD.';});
 const invalidate=()=>{epoch++;identity=null;roster=[];chosenActivity='';company.replaceChildren();clear();status.textContent='Session or permission changed · reverify before construction access';};
 document.addEventListener('ywi:auth-changed',invalidate);
 document.addEventListener('ywi:module-permissions-changed',invalidate);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

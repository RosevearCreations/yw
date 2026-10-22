/* Item 425 — append-only planning and operator permit reports. No permit certification. */
(()=>{'use strict';
const $=id=>document.getElementById(id),make=(tag,s)=>{const e=document.createElement(tag);if(s!==undefined)e.textContent=String(s);return e;};
const uuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s));
const kinds=['building','electrical','plumbing','grading','road_occupancy','environmental','other'];
const statuses=['unknown','submitted','reported_issued'];
function validate(data,company,order){
 if(!data||data.company_id!==company||data.work_order_id!==(order||null)||
  data.complete!==true||data.no_auto_approval!==true||data.source_limit!==80||
  !['choose_order','review_only'].includes(data.state)||
  !['orders','phases','permits','safety','changes','lines'].every(k=>Array.isArray(data[k]))||
  data.orders.length>60||data.phases.length+data.permits.length+data.safety.length+data.changes.length+data.lines.length>80||
  data.orders.some(o=>!uuid(o.id)||!o.number)||data.phases.some(p=>!uuid(p.id)||!p.phase_code||!p.phase_label)||
  data.permits.some(p=>!uuid(p.id)||!uuid(p.phase_id)||!kinds.includes(p.permit_kind)||
   !statuses.includes(p.reported_status)||!['recorded_unverified','source_changed_hold'].includes(p.evidence_state)||
   !['hold','source_verified_only'].includes(p.financial_gate)||!['hold','source_reviewed_only'].includes(p.safety_gate))||
  data.safety.some(s=>!uuid(s.id))||data.changes.some(c=>!uuid(c.id))||data.lines.some(l=>!uuid(l.id))||
  (order&&!data.orders.some(o=>o.id===order))||
  new Set(data.phases.map(x=>x.id)).size!==data.phases.length||
  new Set(data.permits.map(x=>x.id)).size!==data.permits.length)throw Error('Incomplete, duplicate or cross-company construction source');
 if(!order&&(data.state!=='choose_order'||data.phases.length||data.permits.length||data.safety.length||data.changes.length||data.lines.length||data.release!==null))
  throw Error('Unexpected unselected construction disclosure');
 if(order&&(data.state!=='review_only'||data.permits.some(p=>!data.phases.some(ph=>ph.id===p.phase_id))))
  throw Error('Missing original construction phase for permit evidence');
 return data;
}
function mount(){
 const root=$('admin');if(!root||$('owner425'))return;
 const panel=make('details');panel.id='owner425';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Construction Phase, Permit & Change Control';panel.dataset.adminHubGroups='management operations jobs';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';panel.appendChild(make('summary','425 · Construction Phase, Permit & Change Control'));
 const body=make('div');body.className='admin-panel-block';
 body.appendChild(make('p','Record a construction phase on the original Jobs work order and append unverified, operator-reported permit evidence. Safety, original approved change orders and Finance release are independent; nothing here grants a permit, approves pricing, changes budgets, posts costs or releases work.'));
 const help=make('a','ⓘ Help');help.href='/help.html#construction-phase-permit-425';body.appendChild(help);
 const refresh=make('button','Refresh owned construction work');refresh.id='owner425Refresh';refresh.type='button';refresh.className='secondary';body.appendChild(refresh);
 const status=make('p','Sign in as the company owner and refresh.');status.id='owner425Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.appendChild(status);
 const grid=make('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:10px;min-width:0';
 function field(parent,id,label,tag='input'){const l=make('label',label),e=make(tag);e.id=id;if(tag==='input')e.type='text';e.style.cssText='display:block;box-sizing:border-box;width:100%;max-width:100%;min-width:0';l.appendChild(e);parent.appendChild(l);return e;}
 const company=field(grid,'owner425Company','Owned company','select'),order=field(grid,'owner425Order','Original construction work order','select');body.appendChild(grid);
 const read=make('button','Review original construction, Safety and Finance sources');read.id='owner425Read';read.className='secondary';read.type='button';body.appendChild(read);
 const result=make('div');result.id='owner425Results';result.style.cssText='display:grid;gap:10px;min-width:0;overflow-wrap:anywhere';body.appendChild(result);
 const phasePanel=make('fieldset');phasePanel.id='owner425PhaseForm';phasePanel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box';phasePanel.appendChild(make('legend','Create phase reference (Jobs work order stays authoritative)'));
 const phaseFields=make('div');phaseFields.style.cssText=grid.style.cssText;
 const code=field(phaseFields,'owner425Code','Unique phase key'),label=field(phaseFields,'owner425Label','Phase name'),seq=field(phaseFields,'owner425Sequence','Sequence 1–1000');seq.type='number';seq.min='1';seq.max='1000';seq.value='1';
 const line=field(phaseFields,'owner425Line','Original Jobs plan line (optional)','select');phasePanel.appendChild(phaseFields);
 const scope=field(phasePanel,'owner425Scope','Factual planned scope (20–1000 characters)','textarea');scope.rows=3;scope.maxLength=1000;
 const create=make('button','Record construction phase');create.id='owner425Create';create.type='button';create.className='secondary';phasePanel.appendChild(create);body.appendChild(phasePanel);
 const permitPanel=make('fieldset');permitPanel.id='owner425PermitForm';permitPanel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box';permitPanel.appendChild(make('legend','Append operator-reported permit reference (NOT certification)'));
 const permitFields=make('div');permitFields.style.cssText=grid.style.cssText;
 const phase=field(permitFields,'owner425Phase','Recorded construction phase','select');
 const kind=field(permitFields,'owner425Kind','Reported permit category','select');
 const reported=field(permitFields,'owner425Reported','Reported stage (UNVERIFIED)','select');
 const reference=field(permitFields,'owner425Reference','Permit reference from original source');
 const observed=field(permitFields,'owner425Observed','Date source was observed');observed.type='date';
 const safety=field(permitFields,'owner425Safety','Original site Safety plan (optional)','select');
 const change=field(permitFields,'owner425Change','Original change order (optional; no approval)','select');
 permitPanel.appendChild(permitFields);
 const documentRef=field(permitPanel,'owner425Document','Source document / receipt reference (8–400 characters)');documentRef.maxLength=400;
 const notes=field(permitPanel,'owner425Notes','Operator factual notes (20–1000 characters)','textarea');notes.rows=3;notes.maxLength=1000;
 const record=make('button','Append unverified permit evidence');record.id='owner425Record';record.type='button';record.className='secondary';permitPanel.appendChild(record);body.appendChild(permitPanel);
 panel.appendChild(body);root.appendChild(panel);
 phasePanel.hidden=true;permitPanel.hidden=true;
 for(const s of kinds){const o=make('option',s.replaceAll('_',' '));o.value=s;kind.appendChild(o);}
 for(const s of statuses){const o=make('option',s==='reported_issued'?'Operator reports issued — NOT validated':s);o.value=s;reported.appendChild(o);}
 const fill=(el,rows,placeholder)=>{const old=el.value;el.replaceChildren();const blank=make('option',placeholder);blank.value='';el.appendChild(blank);for(const r of rows){const opt=make('option',r.label);opt.value=r.id;el.appendChild(opt);}el.value=rows.some(r=>r.id===old)?old:'';};
 const note=s=>status.textContent=s;
 let session=null,companies=[],orders=[],snapshot=null,busy=false;
 const clear=()=>{session=null;companies=[];orders=[];snapshot=null;company.replaceChildren();order.replaceChildren();result.replaceChildren();phasePanel.hidden=true;permitPanel.hidden=true;};
 async function owner(){const auth=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(auth?.isAuthenticated!==true||!auth.user?.id||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)throw Error('Authenticated owner session required');
  const identity=await sb.auth.getUser();if(identity.error||identity.data?.user?.id!==auth.user.id)throw Error('Session identity mismatch');return {uid:auth.user.id,sb};}
 async function checked(){const current=await owner();if(!session||session.uid!==current.uid||!companies.some(c=>c.id===company.value))throw Error('Refresh owned company first');return current;}
 async function rpc(sb,method,args){const r=await sb.rpc(method,args);if(r.error||r.data==null)throw Error(r.error?.message||'Original construction authority withheld');return r.data;}
 function show(data){result.replaceChildren();phasePanel.hidden=!data.work_order_id;permitPanel.hidden=!data.work_order_id;
  if(!data.work_order_id){result.appendChild(make('p','Select one verified construction work order. Unscoped legacy and foreign records are withheld.'));return;}
  const rel=data.release;
  result.appendChild(make('p','Original Finance release: '+(rel?rel.release_status+' / threshold '+rel.threshold_status+' / signed '+Boolean(rel.signoff_present):'NOT RECORDED · HOLD')+'. No authorization is inferred from this panel.'));
  if(!data.phases.length)result.appendChild(make('p','No construction phases recorded yet. Create a planning reference below; no work will be released.'));
  for(const p of data.phases){const box=make('article');box.className='notice';box.dataset.owner425Phase=p.id;box.style.cssText='min-width:0;max-width:100%;overflow-wrap:anywhere';
   box.appendChild(make('strong',p.sequence_number+' · '+p.phase_label+' ('+p.phase_code+')'));box.appendChild(make('p',p.scope_notes));result.appendChild(box);}
  for(const p of data.permits){const box=make('article');box.className='notice';box.dataset.owner425Permit=p.id;box.style.cssText='min-width:0;max-width:100%;overflow-wrap:anywhere';
   box.appendChild(make('strong','UNVERIFIED '+p.permit_kind+' report · '+p.permit_reference));
   box.appendChild(make('p','Observed '+p.observed_on+' · '+p.reported_status+' (operator-reported ONLY) · '+p.field_notes));
   box.appendChild(make('p','Original source: '+p.source_document_reference+' · Evidence: '+p.evidence_state));
   const gates=make('p','Finance: '+p.financial_gate+' · Safety: '+p.safety_gate+' · No certification or release');gates.dataset.owner425Gate=p.financial_gate==='hold'||p.safety_gate==='hold'||p.evidence_state==='source_changed_hold'?'hold':'review_only';box.appendChild(gates);result.appendChild(box);}
  fill(phase,data.phases.map(p=>({id:p.id,label:p.phase_label+' · '+p.phase_code})),'Choose an original phase');
  fill(line,data.lines.map(l=>({id:l.id,label:l.description||l.id})),'No Jobs plan line');
  fill(safety,data.safety.map(s=>({id:s.id,label:s.plan_number+' · '+s.supervisor_review_status+(s.stop_work_required?' · STOP WORK':'' )})),'No Safety plan — HOLD');
  fill(change,data.changes.map(c=>({id:c.id,label:c.change_order_number+' · '+c.status+' · budget '+(c.budget_applied?'applied':'unverified')})),'No change order link');
 }
 async function load(current,selected){const companyId=company.value;const d=validate(await rpc(current.sb,'ywi_rpc_construction_dashboard_425',{
  p_company_id:companyId,p_work_order_id:selected}),companyId,selected);
  snapshot=d;orders=d.orders;fill(order,orders.map(o=>({id:o.id,label:o.number+' · '+o.status})),'Choose an original construction order');if(selected)order.value=selected;
  show(d);note('Original company construction sources loaded. All phase and permit reports remain non-authoritative.');}
 async function run(callback){if(busy)return;busy=true;for(const b of [refresh,read,create,record])b.disabled=true;
  try{await callback();}catch(e){result.replaceChildren();phasePanel.hidden=true;permitPanel.hidden=true;note('WITHHELD: '+(e?.message||e));}
  finally{busy=false;for(const b of [refresh,read,create,record])b.disabled=false;}}
 refresh.onclick=()=>run(async()=>{clear();const current=await owner();const r=await current.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(r.error||!Array.isArray(r.data)||r.data.length>100||r.data.some(c=>!uuid(c.id)||!c.name||c.owner_user_id!==current.uid))throw Error('Incomplete owner company readback');
  session={uid:current.uid};companies=r.data;fill(company,companies.map(c=>({id:c.id,label:c.name})),'Choose owned company');
  if(companies.length===1){company.value=companies[0].id;await load(current,null);}else note('Select your owned company.');});
 company.onchange=()=>run(async()=>{const current=await checked();await load(current,null);});
 order.onchange=()=>run(async()=>{const current=await checked();if(!orders.some(o=>o.id===order.value)){result.replaceChildren();phasePanel.hidden=true;permitPanel.hidden=true;return;}await load(current,order.value);});
 read.onclick=()=>run(async()=>{const current=await checked();if(!orders.some(o=>o.id===order.value))throw Error('Choose a construction work order first');await load(current,order.value);});
 create.onclick=()=>run(async()=>{const current=await checked(),id=order.value;if(!orders.some(o=>o.id===id)||!snapshot)throw Error('Original construction order missing');
  const phaseCode=code.value.trim().toLowerCase(),phaseName=label.value.trim(),scopeNote=scope.value.trim(),sequence=Number(seq.value);
  if(!/^[a-z0-9_]{2,40}$/.test(phaseCode)||phaseName.length<3||scopeNote.length<20||scopeNote.length>1000||!Number.isInteger(sequence)||sequence<1||sequence>1000)throw Error('Provide original phase key, sequence, name and at least 20 characters of scope');
  if(!window.confirm('Append a planning-only phase to the original work order? This does not authorize construction or payment.'))return;
  const created=await rpc(current.sb,'ywi_rpc_create_construction_phase_425',{p_company_id:company.value,p_work_order_id:id,p_phase_code:phaseCode,p_phase_label:phaseName,p_sequence_number:sequence,p_scope_notes:scopeNote,p_work_order_line_id:line.value||null});
  if(!uuid(created))throw Error('No source phase receipt returned');await load(current,id);phase.value=created;note('Construction phase '+created.slice(0,8)+' recorded for review only.');});
 record.onclick=()=>run(async()=>{const current=await checked(),id=order.value;if(!orders.some(o=>o.id===id)||!snapshot||!snapshot.phases.some(p=>p.id===phase.value))throw Error('Select an original construction phase');
  const ref=reference.value.trim(),doc=documentRef.value.trim(),description=notes.value.trim(),day=observed.value;
  if(!kinds.includes(kind.value)||!statuses.includes(reported.value)||ref.length<3||doc.length<8||description.length<20||description.length>1000||!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('Provide dated permit reference, original document and at least 20 factual characters');
  if(!window.confirm('Append this operator-reported permit reference as UNVERIFIED? This does NOT certify a permit, approve a change order, release Safety or post Finance.'))return;
  const recorded=await rpc(current.sb,'ywi_rpc_record_construction_permit_425',{
   p_company_id:company.value,p_work_order_id:id,p_phase_id:phase.value,p_kind:kind.value,p_reference:ref,
   p_reported_status:reported.value,p_document_reference:doc,p_field_notes:description,p_observed_on:day,
   p_safety_plan_id:safety.value||null,p_change_order_id:change.value||null});
  if(!uuid(recorded))throw Error('No original permit-evidence receipt returned');await load(current,id);
  note('Unverified permit report '+recorded.slice(0,8)+' recorded. No certification, change approval or posting.');});
 document.addEventListener('ywi:auth-changed',()=>{clear();note('Session changed: refresh before reading construction records.');});
}
window.YWI425=Object.freeze({validate});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

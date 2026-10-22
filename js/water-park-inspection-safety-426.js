/* Build 426 — operator aquatic observations and follow-ups; no automatic reopening. */
(()=>{'use strict';
const $=id=>document.getElementById(id),make=(t,s)=>{const e=document.createElement(t);if(s!==undefined)e.textContent=String(s);return e;};
const uuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s));
const kinds=['routine','post_incident','recheck'],issues=['none_reported','concern_reported','closure_reported'];
const states=['pending','operator_reports_addressed'];
function validate(d,company,order){
 if(!d||d.company_id!==company||d.work_order_id!==(order||null)||d.complete!==true||
  d.no_automatic_reopening!==true||d.source_limit!==80||
  d.state!==(order?'review_only':'choose_order')||
  !['orders','safety','inspections','followups'].every(k=>Array.isArray(d[k]))||
  d.orders.length>60||d.safety.length+d.inspections.length+d.followups.length>80||
  d.orders.some(x=>!uuid(x.id)||!x.number)||d.safety.some(x=>!uuid(x.id))||
  d.inspections.some(x=>!uuid(x.id)||!kinds.includes(x.inspection_kind)||!issues.includes(x.observed_issue)||
   !['recorded_unverified','source_changed_hold'].includes(x.evidence_state)||
   !['hold','independent_safety_review_still_required'].includes(x.closure_gate))||
  d.followups.some(x=>!uuid(x.id)||!uuid(x.inspection_id)||!states.includes(x.reported_state)||
   !['recorded_unverified','source_changed_hold'].includes(x.evidence_state)||
   x.reopening_gate!=='hold_until_independent_safety_authority')||
  new Set(d.inspections.map(x=>x.id)).size!==d.inspections.length||
  new Set(d.followups.map(x=>x.id)).size!==d.followups.length||
  (order&&!d.orders.some(x=>x.id===order))||
  d.followups.some(x=>!d.inspections.some(i=>i.id===x.inspection_id)))
  throw Error('Incomplete, duplicate, or foreign aquatic evidence withheld');
 if(!order&&(d.safety.length||d.inspections.length||d.followups.length))
  throw Error('Unexpected unselected facility disclosure');
 return d;
}
function mount(){
 const root=$('admin');if(!root||$('owner426'))return;
 const panel=make('details');panel.id='owner426';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Water Park Inspection & Safety Evidence';panel.dataset.adminHubGroups='management operations safety jobs';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.appendChild(make('summary','426 · Water Park Inspection & Safety Evidence'));
 const body=make('div');body.className='admin-panel-block';
 body.appendChild(make('p','Append dated operator observations, measured aquatic readings and follow-up receipts to an original water-park Jobs order. Safety supervisors retain closure and reopening authority. These reports NEVER authorize dosing, compliance certification or reopening.'));
 const help=make('a','ⓘ Help');help.href='/help.html#water-park-inspection-426';body.appendChild(help);
 const status=make('p','Sign in as company owner and refresh.');status.id='owner426Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const refresh=make('button','Refresh owned aquatic work');refresh.id='owner426Refresh';refresh.type='button';refresh.className='secondary';body.appendChild(refresh);body.appendChild(status);
 const grid=make('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:10px;min-width:0';
 function field(parent,id,label,tag='input'){const l=make('label',label),e=make(tag);e.id=id;if(tag==='input')e.type='text';e.style.cssText='display:block;box-sizing:border-box;width:100%;max-width:100%;min-width:0';l.appendChild(e);parent.appendChild(l);return e;}
 const company=field(grid,'owner426Company','Owned company','select'),order=field(grid,'owner426Order','Original aquatic work order','select');body.appendChild(grid);
 const read=make('button','Review original aquatic Jobs and Safety');read.id='owner426Read';read.type='button';read.className='secondary';body.appendChild(read);
 const result=make('div');result.id='owner426Results';result.style.cssText='display:grid;gap:10px;min-width:0;overflow-wrap:anywhere';body.appendChild(result);
 const inspectionPanel=make('fieldset');inspectionPanel.id='owner426InspectionForm';inspectionPanel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box';inspectionPanel.appendChild(make('legend','Append aquatic field inspection · UNVERIFIED'));
 const fields=make('div');fields.style.cssText=grid.style.cssText;
 const key=field(fields,'owner426Key','Unique inspection reference (a-z, 0-9, _)');
 const area=field(fields,'owner426Area','Named aquatic area / zone');
 const kind=field(fields,'owner426Kind','Inspection kind','select');
 const day=field(fields,'owner426Day','Observed date');day.type='date';
 const issue=field(fields,'owner426Issue','Operator-reported concern / closure','select');
 const safety=field(fields,'owner426Safety','Original site Safety plan (optional, missing means HOLD)','select');
 const ph=field(fields,'owner426Ph','Observed pH (optional, no safe-range decision)');ph.type='number';ph.step='0.01';ph.min='0';ph.max='14';
 const sanitizer=field(fields,'owner426Sanitizer','Observed sanitizer mg/L (optional)');sanitizer.type='number';sanitizer.step='0.01';sanitizer.min='0';sanitizer.max='100';
 const water=field(fields,'owner426Water','Observed water temperature °C (optional)');water.type='number';water.step='0.01';water.min='-5';water.max='60';inspectionPanel.appendChild(fields);
 const source=field(inspectionPanel,'owner426Source','Original test log / document reference (8–400 characters)');source.maxLength=400;
 const notes=field(inspectionPanel,'owner426Notes','Factual observations (20–1000 characters)','textarea');notes.maxLength=1000;notes.rows=3;
 const record=make('button','Append UNVERIFIED aquatic observation');record.id='owner426Record';record.type='button';record.className='secondary';inspectionPanel.appendChild(record);body.appendChild(inspectionPanel);
 const followPanel=make('fieldset');followPanel.id='owner426FollowupForm';followPanel.style.cssText=inspectionPanel.style.cssText;followPanel.appendChild(make('legend','Append follow-up receipt · NEVER reopens an area'));
 const followFields=make('div');followFields.style.cssText=grid.style.cssText;
 const inspection=field(followFields,'owner426Inspection','Original aquatic inspection','select');
 const followKey=field(followFields,'owner426FollowKey','Unique follow-up key');
 const followDate=field(followFields,'owner426FollowDay','Observed follow-up date');followDate.type='date';
 const reported=field(followFields,'owner426Reported','Operator-reported status (unverified)','select');followPanel.appendChild(followFields);
 const action=field(followPanel,'owner426Action','Original repair / action / work reference');action.maxLength=400;
 const followNotes=field(followPanel,'owner426FollowNotes','Factual follow-up notes (20–1000 characters)','textarea');followNotes.rows=3;followNotes.maxLength=1000;
 const followButton=make('button','Append follow-up — HOLD remains');followButton.id='owner426Follow';followButton.type='button';followButton.className='secondary';followPanel.appendChild(followButton);body.appendChild(followPanel);
 panel.appendChild(body);root.appendChild(panel);inspectionPanel.hidden=true;followPanel.hidden=true;
 for(const x of kinds){const opt=make('option',x.replaceAll('_',' '));opt.value=x;kind.appendChild(opt);}
 for(const x of issues){const opt=make('option',x.replaceAll('_',' ')+' · UNVERIFIED');opt.value=x;issue.appendChild(opt);}
 for(const x of states){const opt=make('option',x.replaceAll('_',' ')+' · NOT reopening');opt.value=x;reported.appendChild(opt);}
 const fill=(e,rows,hint)=>{const old=e.value;e.replaceChildren();const blank=make('option',hint);blank.value='';e.appendChild(blank);for(const row of rows){const opt=make('option',row.label);opt.value=row.id;e.appendChild(opt);}e.value=rows.some(row=>row.id===old)?old:'';};
 const note=s=>{status.textContent=s;};let session=null,companies=[],orders=[],snapshot=null,busy=false;
 const clear=()=>{session=null;companies=[];orders=[];snapshot=null;company.replaceChildren();order.replaceChildren();result.replaceChildren();inspectionPanel.hidden=true;followPanel.hidden=true;};
 async function owner(){const auth=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(auth?.isAuthenticated!==true||!auth.user?.id||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)throw Error('Authenticated company-owner session required');
  const identity=await sb.auth.getUser();if(identity.error||identity.data?.user?.id!==auth.user.id)throw Error('Session identity mismatch');return {uid:auth.user.id,sb};}
 async function checked(){const cur=await owner();if(!session||session.uid!==cur.uid||!companies.some(c=>c.id===company.value))throw Error('Refresh owned company first');return cur;}
 async function rpc(sb,name,args){const r=await sb.rpc(name,args);if(r.error||r.data==null)throw Error(r.error?.message||'Original aquatic authority withheld');return r.data;}
 function show(d){result.replaceChildren();inspectionPanel.hidden=!d.work_order_id;followPanel.hidden=!d.work_order_id;
  if(!d.work_order_id){result.appendChild(make('p','Choose a verified water-park order. Legacy, unrelated and foreign sites are withheld.'));return;}
  result.appendChild(make('p','Aquatic safety review is independent. No field record here clears a closure, calibrates instrumentation, certifies water quality or authorizes dosing.'));
  if(!d.inspections.length)result.appendChild(make('p','No aquatic inspection reports yet. The absence of records is NOT evidence of safe operating conditions.'));
  for(const i of d.inspections){const item=make('article');item.className='notice';item.dataset.owner426Inspection=i.id;item.style.cssText='min-width:0;max-width:100%;overflow-wrap:anywhere';
   item.appendChild(make('strong','UNVERIFIED · '+i.inspected_on+' · '+i.area_label+' · '+i.inspection_key));
   item.appendChild(make('p',i.inspection_kind+' · '+i.observed_issue+' · '+i.observation_notes));
   item.appendChild(make('p','Observed pH: '+(i.observed_ph??'not recorded')+' · sanitizer mg/L: '+(i.observed_sanitizer_mg_l??'not recorded')+' · water °C: '+(i.observed_water_c??'not recorded')));
   item.appendChild(make('p','Original log: '+i.source_reference+' · '+i.evidence_state));
   const g=make('p','Safety / closure gate: '+i.closure_gate+' · NO automated reopening');g.dataset.owner426Gate=i.closure_gate==='hold'?'hold':'review_only';item.appendChild(g);result.appendChild(item);}
  for(const f of d.followups){const item=make('article');item.className='notice';item.dataset.owner426Followup=f.id;item.style.cssText='min-width:0;max-width:100%;overflow-wrap:anywhere';
   item.appendChild(make('strong','Follow-up '+f.receipt_key+' · '+f.observed_on));item.appendChild(make('p',f.reported_state+' (reported ONLY) · '+f.factual_notes));
   item.appendChild(make('p','Original action: '+f.action_reference+' · '+f.evidence_state));item.appendChild(make('p','Reopening: '+f.reopening_gate));result.appendChild(item);}
  fill(safety,d.safety.map(s=>({id:s.id,label:s.plan_number+' · '+s.supervisor_review_status+(s.stop_work_required?' · STOP WORK':'' )})),'No Safety plan — HOLD');
  fill(inspection,d.inspections.map(i=>({id:i.id,label:i.inspected_on+' · '+i.area_label+' · '+i.inspection_key})),'Choose a prior inspection');
 }
 async function load(cur,selected){const id=company.value;const d=validate(await rpc(cur.sb,'ywi_rpc_aquatic_dashboard_426',{p_company_id:id,p_work_order_id:selected}),id,selected);snapshot=d;orders=d.orders;
  fill(order,orders.map(o=>({id:o.id,label:o.number+' · '+o.status})),'Choose an original aquatic order');if(selected)order.value=selected;
  show(d);note('Original Jobs and Safety sources loaded. All reported observations remain non-authoritative.');}
 async function run(callback){if(busy)return;busy=true;for(const b of [refresh,read,record,followButton])b.disabled=true;
  try{await callback();}catch(e){result.replaceChildren();inspectionPanel.hidden=true;followPanel.hidden=true;note('WITHHELD: '+(e?.message||e));}
  finally{busy=false;for(const b of [refresh,read,record,followButton])b.disabled=false;}}
 refresh.onclick=()=>run(async()=>{clear();const cur=await owner();const r=await cur.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(r.error||!Array.isArray(r.data)||r.data.length>100||r.data.some(c=>!uuid(c.id)||!c.name||c.owner_user_id!==cur.uid))throw Error('Incomplete owner company readback');
  session={uid:cur.uid};companies=r.data;fill(company,companies.map(c=>({id:c.id,label:c.name})),'Choose owned company');
  if(companies.length===1){company.value=companies[0].id;await load(cur,null);}else note('Select your owned company.');});
 company.onchange=()=>run(async()=>{const cur=await checked();await load(cur,null);});
 order.onchange=()=>run(async()=>{const cur=await checked();if(!orders.some(o=>o.id===order.value)){result.replaceChildren();inspectionPanel.hidden=true;followPanel.hidden=true;return;}await load(cur,order.value);});
 read.onclick=()=>run(async()=>{const cur=await checked();if(!orders.some(o=>o.id===order.value))throw Error('Choose original aquatic work order first');await load(cur,order.value);});
 const numeric=(e,min,max)=>{if(e.value.trim()==='')return null;const v=Number(e.value);if(!Number.isFinite(v)||v<min||v>max)throw Error('Observed reading outside allowed input limits');return v;};
 record.onclick=()=>run(async()=>{const cur=await checked(),id=order.value;if(!snapshot||!orders.some(o=>o.id===id))throw Error('Original aquatic work order required');
  const k=key.value.trim().toLowerCase(),label=area.value.trim(),src=source.value.trim(),n=notes.value.trim(),date=day.value;
  if(!/^[a-z0-9_]{3,50}$/.test(k)||label.length<3||label.length>120||!kinds.includes(kind.value)||!issues.includes(issue.value)||
   !/^\d{4}-\d{2}-\d{2}$/.test(date)||src.length<8||src.length>400||n.length<20||n.length>1000)throw Error('Provide dated field inspection, source log, area and at least 20 factual characters');
  const values={p_ph:numeric(ph,0,14),p_sanitizer_mg_l:numeric(sanitizer,0,100),p_water_c:numeric(water,-5,60)};
  if(!window.confirm('Append this UNVERIFIED inspection? Reported closure and source holds remain; NO automatic chemical dosing, certification or reopening.'))return;
  const resultId=await rpc(cur.sb,'ywi_rpc_record_aquatic_inspection_426',{p_company_id:company.value,p_work_order_id:id,p_key:k,p_area:label,p_kind:kind.value,p_inspected_on:date,p_issue:issue.value,p_source_reference:src,p_notes:n,...values,p_safety_plan_id:safety.value||null});
  if(!uuid(resultId))throw Error('No source inspection receipt returned');await load(cur,id);inspection.value=resultId;
  note('UNVERIFIED aquatic inspection '+resultId.slice(0,8)+' appended; Safety authority remains independent.');});
 followButton.onclick=()=>run(async()=>{const cur=await checked(),id=order.value;if(!snapshot||!orders.some(o=>o.id===id)||!snapshot.inspections.some(i=>i.id===inspection.value))throw Error('Choose original aquatic inspection');
  const k=followKey.value.trim().toLowerCase(),date=followDate.value,src=action.value.trim(),n=followNotes.value.trim();
  if(!/^[a-z0-9_]{3,50}$/.test(k)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||src.length<8||src.length>400||n.length<20||n.length>1000||!states.includes(reported.value))throw Error('Provide dated follow-up, original action reference and factual notes');
  if(!window.confirm('Append an UNVERIFIED follow-up? No closure is lifted and reopening requires independent Safety authority.'))return;
  const resultId=await rpc(cur.sb,'ywi_rpc_append_aquatic_followup_426',{p_company_id:company.value,p_work_order_id:id,p_inspection_id:inspection.value,p_receipt_key:k,p_observed_on:date,p_action_reference:src,p_notes:n,p_reported_state:reported.value});
  if(!uuid(resultId))throw Error('No source follow-up receipt returned');await load(cur,id);note('Follow-up '+resultId.slice(0,8)+' recorded. Existing Safety holds remain.');});
 document.addEventListener('ywi:auth-changed',()=>{clear();note('Session changed: refresh before reading aquatic records.');});
}
window.YWI426=Object.freeze({validate});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

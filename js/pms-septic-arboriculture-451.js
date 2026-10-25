/* YW 451 · separate company-entitled Septic & Arboriculture workspaces.
 * Source labels and reported manifests/assessments are NOT disposal certificates,
 * tree-work permits, crew authorizations, dispatch or billing authority. */
(()=>{'use strict';
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const keys=Object.freeze(['septic','arboriculture']);
const tankKinds=Object.freeze(['septic','holding','pump_chamber','unknown']);
const streams=Object.freeze(['septic','holding_tank','vacuum_waste']);
const disposalStates=Object.freeze(['awaiting_original','operator_reference','source_linked']);
const riskZones=Object.freeze(['open_ground','structure','roadway','utility','unknown']);
const permitStates=Object.freeze(['unreviewed','not_required_claim','required_unverified','source_provided']);
const riskLevels=Object.freeze(['low','moderate','high','stop_work']);
const methods=Object.freeze(['inspection','pruning','removal','stump','cabling','other']);
const reportStates=Object.freeze(['plan_only','field_reported','hold']);
const held=reason=>({state:'withheld',reason,services:[],septic_sites:[],septic_manifests:[],arbor_trees:[],arbor_reviews:[]});
const dated=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s));
const ref=s=>typeof s==='string'&&s.trim().length>=3;
function inspect(s,{companyId,now=Date.now(),jobsAllowed=false}={}){
 const t=Date.parse(s?.captured_at);
 if(!uuid(companyId)||s?.company_id!==companyId||s.owner_guard!=='ywi_422_assert_owner'||
  s.new_work_guard!=='ywi_421_assert_company_new_work'||!Number.isFinite(t)||t>now+60000||now-t>300000||
  !jobsAllowed||!Array.isArray(s.services)||s.services.length!==2||
  new Set(s.services.map(x=>x.module_key)).size!==2||
  s.services.some(x=>!keys.includes(x.module_key)||typeof x.enabled!=='boolean')||
  !Array.isArray(s.septic_sites)||!Array.isArray(s.septic_manifests)||
  !Array.isArray(s.arbor_trees)||!Array.isArray(s.arbor_reviews)||
  s.septic_sites.length!==s.septic_site_count||s.septic_manifests.length!==s.septic_manifest_count||
  s.arbor_trees.length!==s.arbor_tree_count||s.arbor_reviews.length!==s.arbor_review_count||
  s.septic_sites.length>100||s.septic_manifests.length>200||s.arbor_trees.length>100||s.arbor_reviews.length>200||
  s.historical_read_retained!==true||s.regulatory_compliance_verified!==false||
  s.permit_authorized!==false||s.crew_certified!==false||s.safety_cleared!==false||
  s.dispatch_authorized!==false||s.disposal_certified!==false||s.invoice_posted!==false||
  s.mutation_authorized!==false)
  return held('Fresh, complete original-company specialist sources and permissions are required');
 const septic=new Map(s.septic_sites.map(x=>[x.id,x]));
 const arbor=new Map(s.arbor_trees.map(x=>[x.id,x]));
 if(septic.size!==s.septic_sites.length||arbor.size!==s.arbor_trees.length||
  new Set(s.septic_manifests.map(x=>x.id)).size!==s.septic_manifests.length||
  new Set(s.arbor_reviews.map(x=>x.id)).size!==s.arbor_reviews.length||
  s.septic_sites.some(x=>!uuid(x.id)||x.company_id!==companyId||!uuid(x.client_id)||!uuid(x.site_id)||
   !x.client_name||!x.site_name||!tankKinds.includes(x.tank_kind)||!ref(x.access_hazard)||!ref(x.source_reference)||
   x.capacity_l!==null&&(!(Number(x.capacity_l)>0)||Number(x.capacity_l)>1000000))||
  s.septic_manifests.some(x=>!uuid(x.id)||x.company_id!==companyId||!septic.has(x.profile_id)||
   !dated(x.service_on)||!streams.includes(x.waste_stream)||
   !(Number(x.reported_volume_l)>0&&Number(x.reported_volume_l)<=100000)||
   !ref(x.measurement_source)||!ref(x.facility_label)||!ref(x.manifest_reference)||!ref(x.source_reference)||
   !disposalStates.includes(x.disposal_review)||
   (x.original_receipt_428!==null)!==(x.disposal_review==='source_linked')||
   x.original_receipt_428!==null&&!uuid(x.original_receipt_428))||
  s.arbor_trees.some(x=>!uuid(x.id)||x.company_id!==companyId||!uuid(x.client_id)||!uuid(x.site_id)||
   !x.client_name||!x.site_name||!x.tree_label||!x.species_label||!riskZones.includes(x.risk_zone)||
   !permitStates.includes(x.permit_state)||!ref(x.risk_notes)||!ref(x.source_reference)||
   x.approximate_height_m!==null&&(!(Number(x.approximate_height_m)>0)||Number(x.approximate_height_m)>150)||
   x.permit_state==='source_provided'&&!ref(x.permit_source))||
  s.arbor_reviews.some(x=>!uuid(x.id)||x.company_id!==companyId||!arbor.has(x.tree_id)||
   !dated(x.reviewed_on)||!riskLevels.includes(x.risk_level)||!methods.includes(x.planned_method)||
   !reportStates.includes(x.review_state)||!ref(x.evidence_reference)||
   ['high','stop_work'].includes(x.risk_level)&&(!ref(x.safety_source)||!ref(x.crew_credential_source))))
  return held('Foreign, duplicate, incomplete or cross-company specialist evidence');
 return {state:'verified_specialists',companyId,services:s.services,septic_sites:s.septic_sites,
  septic_manifests:s.septic_manifests,arbor_trees:s.arbor_trees,arbor_reviews:s.arbor_reviews,
  historicalRead:true,canCertify:false,canPermit:false,canDispatch:false,canInvoice:false};
}
window.YWI451=Object.freeze({keys,tankKinds,streams,disposalStates,riskZones,permitStates,riskLevels,methods,reportStates,inspect});
const el=(tag,value)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=String(value);return x};
const input=(parent,tag,label,id,max)=>{const l=el('label',label),f=el(tag);f.id=id;if(max)f.maxLength=max;l.append(f);parent.append(l);return f};
const button=(parent,id,label)=>{const b=el('button',label);b.id=id;b.type='button';b.className='secondary';parent.append(b);return b};
const enums=(f,values)=>{for(const key of values){const o=el('option',key.replaceAll('_',' '));o.value=key;f.append(o)}};
const pick=(f,items,hint,name=x=>x.name)=>{const prev=f.value;f.replaceChildren();const start=el('option',hint);start.value='';f.append(start);
 for(const x of items){const opt=el('option',name(x));opt.value=x.id;f.append(opt)}
 if(items.some(x=>x.id===prev))f.value=prev;else if(items.length===1)f.value=items[0].id;};
const requestId=()=>{const id=window.crypto?.randomUUID?.();if(!uuid(id))throw Error('Secure request UUID required');return id};
async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
 if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.auth?.getUser||!sb?.from||!sb?.rpc||
  !window.YWISecurity?.canViewModule?.('admin',a.role,'manage')||
  !window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Admin manage, Jobs view and owner identity required');
 const r=await sb.auth.getUser();if(r.error||r.data?.user?.id!==a.user.id)throw Error('Authenticated owner mismatch');
 return{uid:a.user.id,role:a.role,sb};}
async function rpc(sb,name,args){const r=await sb.rpc(name,args);if(r.error||r.data===null||r.data===undefined)
 throw Error(r.error?.message||'Specialist source withheld');return r.data;}
function mountOne(key,id,title){const root=document.getElementById('admin');if(!root||document.getElementById(id))return;
 const septic=key==='septic';const prefix=septic?'pms451Septic':'pms451Arbor';
 const panel=el('details');panel.id=id;panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='PMS · '+title;panel.dataset.adminHubGroups='management operations jobs safety';
 panel.append(el('summary','451 · '+title+' · Site Inventory & Source Reviews'));
 const body=el('div');body.className='admin-panel-block';
 body.append(el('p',septic?
  'Private septic site records and reported collection/manifests. Only original Build 428 disposal proofs can be linked, and no entry certifies lawful disposal.':
  'Tree inventory, zone hazards, crew/equipment source labels and permit review. No entry grants permits, trained-crew authorization, Safety clearance or physical work approval.'));
 const help=el('a','ⓘ '+title+' Help');help.href='/help.html#pms-specialists-451';body.append(help);
 const bar=el('div');bar.className='pms451-grid';const company=input(bar,'select','Verified owner company',prefix+'Company');body.append(bar);
 const actions=el('div');actions.className='pms451-actions';const refresh=button(actions,prefix+'Refresh','Verify '+title);body.append(actions);
 const status=el('p','Verify a real owner company.');status.id=prefix+'Status';status.setAttribute('role','status');body.append(status);
 const history=el('div');history.id=prefix+'History';history.className='pms451-cards';body.append(history);
 const createForm=el('details');createForm.id=prefix+'InventoryPanel';createForm.append(el('summary',septic?'Record property septic asset (not inspected)':'Add tree to property inventory'));
 const fields=el('div');fields.className='pms451-grid';
 const customer=input(fields,'select','Verified customer',prefix+'Customer');
 const site=input(fields,'select','Original company property',prefix+'Site');
 const kind=septic?input(fields,'select','Tank/system type',prefix+'Kind'):input(fields,'input','Tree identifier',prefix+'TreeLabel',100);
 if(septic)enums(kind,tankKinds);
 const detail=septic?input(fields,'input','Reported capacity in litres (optional)',prefix+'Capacity'):
  input(fields,'input','Species / tree description',prefix+'Species',100);
 if(septic){detail.type='number';detail.min='1';detail.max='1000000';detail.step='0.01';}
 const height=septic?null:input(fields,'input','Approximate height (metres; optional)',prefix+'Height');
 if(height){height.type='number';height.min='0.1';height.max='150';height.step='0.1';}
 const zone=septic?null:input(fields,'select','Tree risk zone',prefix+'Zone');if(zone)enums(zone,riskZones);
 const risk=input(fields,'textarea',septic?'Tank access / confined space / location hazards':'Tree position, defects, targets & access hazards',prefix+'Risk',600);
 const permit=septic?null:input(fields,'select','Permit review claim (not verification)',prefix+'Permit');if(permit)enums(permit,permitStates);
 const permitSource=input(fields,'input','Permit/source reference (not authorization)',prefix+'PermitSource',160);
 const safetySource=septic?input(fields,'input','Site Safety source reference',prefix+'SafetySource',160):null;
 const original=input(fields,'input','Original property/site evidence reference',prefix+'Source',160);
 createForm.append(fields);const create=button(createForm,prefix+'Create','Record '+(septic?'septic site':'tree inventory')+' source');body.append(createForm);
 const reportForm=el('details');reportForm.id=prefix+'ReportPanel';
 reportForm.append(el('summary',septic?'Append manifest / original 428 disposal-link REVIEW':'Append tree risk / crew / permit REVIEW'));
 const rep=el('div');rep.className='pms451-grid';
 const parent=input(rep,'select',septic?'Verified company septic site':'Verified company tree',prefix+'Parent');
 const date=input(rep,'input',septic?'Collection/report date':'Assessment date',prefix+'Date');date.type='date';
 const action=input(rep,'select',septic?'Reported waste stream':'Operator risk assessment',prefix+'Action');enums(action,septic?streams:riskLevels);
 const measure=septic?input(rep,'input','Reported collected volume (L)',prefix+'Volume'):
  input(rep,'select','Planned tree work method',prefix+'Method');
 if(septic){measure.type='number';measure.min='0.01';measure.max='100000';measure.step='0.01';}else enums(measure,methods);
 const measurement=septic?input(rep,'input','Measurement original source reference',prefix+'Measurement',160):null;
 const facility=septic?input(rep,'input','Reported destination facility (not verified)',prefix+'Facility',180):null;
 const manifest=septic?input(rep,'input','Manifest / ticket source reference',prefix+'Manifest',160):null;
 const linked=septic?input(rep,'input','Original Build 428 receipt UUID (optional)',prefix+'Receipt',36):null;
 const state=input(rep,'select',septic?'Disposal documentation state':'Reported field outcome',prefix+'State');enums(state,septic?disposalStates:reportStates);
 const crew=septic?null:input(rep,'input','Crew credential original-source reference',prefix+'Crew',160);
 const equipment=septic?null:input(rep,'input','Equipment / lifting / inspection original-source reference',prefix+'Equipment',160);
 const safety=septic?null:input(rep,'input','Original Safety plan / hazard reference',prefix+'Safety',160);
 const permitRef=septic?null:input(rep,'input','Original permit decision reference',prefix+'ReportPermit',160);
 const reportSource=input(rep,'input','Original report / evidence reference',prefix+'ReportSource',160);
 const notes=input(rep,'textarea','Operator facts and unresolved follow-up',prefix+'Notes',600);
 reportForm.append(rep);const append=button(reportForm,prefix+'Append','Append '+(septic?'manifest':'tree review')+' (not certified)');body.append(reportForm);
 body.append(el('p','All evidence is company-scoped and source-labelled. Site/route hazards, permit status, crew certifications, disposal, vehicle readiness and real Jobs/Dispatch must still be independently checked. No automated approval, regulated disposal or accounting is performed.'));
 panel.append(body);root.append(panel);
 let epoch=0,busy=false,identity=null,roster=[],customers=[],sites=[],snapshot=null;
 const controls=[refresh,create,append];const alive=(uid,e)=>epoch===e&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&window.YWI_AUTH.getState().user?.id===uid;
 const clear=()=>{snapshot=null;customers=[];sites=[];history.replaceChildren();customer.replaceChildren();site.replaceChildren();parent.replaceChildren()};
 const entitled=()=>snapshot?.state==='verified_specialists'&&snapshot.services.find(x=>x.module_key===key)?.enabled===true&&
  identity===window.YWI_AUTH?.getState?.()?.user?.id&&roster.some(x=>x.id===company.value);
 const allowed=()=>{if(!entitled()||!window.YWISecurity?.canViewModule?.('jobs',window.YWI_AUTH.getState().role,'create'))
  throw Error('Owned '+title+' entitlement ON and original Jobs-create role required');};
 function render(review){snapshot=review;history.replaceChildren();
  if(review.state!=='verified_specialists'){status.textContent='WITHHELD: '+review.reason;return;}
  const on=review.services.find(x=>x.module_key===key)?.enabled;
  const roots=septic?review.septic_sites:review.arbor_trees,records=septic?review.septic_manifests:review.arbor_reviews;
  status.textContent=title+(on?' ON':' OFF · historical owned records only')+' · '+roots.length+' site records / '+records.length+' source reports · external approvals HOLD.';
  pick(parent,roots,'Choose original company '+(septic?'septic system':'tree'),x=>x.site_name+' · '+(septic?x.tank_kind:x.tree_label));
  for(const item of roots){const card=el('article');card.className='notice';card.dataset.pms451Inventory=item.id;
   card.append(el('strong',item.client_name+' · '+item.site_name+' · '+(septic?item.tank_kind:item.tree_label+' ('+item.species_label+')')));
   card.append(el('p',septic?'Capacity: '+(item.capacity_l??'unknown')+' L · hazards '+item.access_hazard:
    'Zone '+item.risk_zone+' · height '+(item.approximate_height_m??'unknown')+'m · '+item.risk_notes));
   card.append(el('p','Permit/source label: '+(septic?item.permit_source||'unverified':item.permit_state+' · '+(item.permit_source||'none'))+' · '+item.source_reference));
   for(const record of records.filter(x=>(septic?x.profile_id:x.tree_id)===item.id)){
    const p=el('p',septic?
     record.service_on+' · '+record.reported_volume_l+' L '+record.waste_stream+' · facility '+record.facility_label+
      ' · '+record.disposal_review+(record.original_receipt_428?' · original 428 receipt '+record.original_receipt_428:' · no original disposal receipt'):
     record.reviewed_on+' · '+record.risk_level+' '+record.planned_method+' · '+record.review_state+
      ' · crew '+(record.crew_credential_source||'unverified')+' · equipment '+(record.equipment_source||'unverified'));
    p.dataset.pms451Report=record.id;card.append(p);card.append(el('p','Evidence: '+(septic?record.manifest_reference+' · ':'')+(record.source_reference||record.evidence_reference)));}
   history.append(card);
  }
  if(!roots.length)history.append(el('p','No source-backed '+title+' properties recorded.'));
 }
 async function loadSites(ctx,e){const id=customer.value;sites=[];site.replaceChildren();if(!customers.some(x=>x.id===id))return;
  const h=await rpc(ctx.sb,'ywi_rpc_customer_history_422',{p_company_id:company.value,p_client_id:id});
  if(!alive(ctx.uid,e)||h.company_id!==company.value||h.client_id!==id||h.legacy_unscoped_excluded!==true||
   !Array.isArray(h.properties)||h.properties.length>100||h.properties.some(x=>!uuid(x.id)||!x.name))
   throw Error('Original company property proof unavailable');
  sites=h.properties;pick(site,sites,'Choose company property');}
 async function load(e){const ctx=await session();if(!alive(ctx.uid,e))throw Error('Session changed');
  const r=await ctx.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(r.error||!Array.isArray(r.data)||r.data.length>100||new Set(r.data.map(x=>x.id)).size!==r.data.length||
   r.data.some(x=>!uuid(x.id)||x.owner_user_id!==ctx.uid||!x.name)||!alive(ctx.uid,e))throw Error('Original owner company roster unavailable');
  identity=ctx.uid;roster=r.data;pick(company,roster,'Choose owned company');
  if(!roster.length){render(held('No real owner company; Yard Rosevear exists as a test fixture only'));return;}
  const raw=await rpc(ctx.sb,'ywi_rpc_pms_specialist_snapshot_451',{p_company_id:company.value});
  if(!alive(ctx.uid,e))throw Error('Company identity changed');
  render(inspect(raw,{companyId:company.value,jobsAllowed:window.YWISecurity.canViewModule('jobs',ctx.role,'view')}));
  if(snapshot.state!=='verified_specialists')throw Error(snapshot.reason);
  customers=[];sites=[];customer.replaceChildren();site.replaceChildren();
  if(!snapshot.services.find(x=>x.module_key===key)?.enabled)return;
  const list=await rpc(ctx.sb,'ywi_rpc_company_customers_422',{p_company_id:company.value});
  if(!alive(ctx.uid,e)||!Array.isArray(list)||list.length>100||new Set(list.map(x=>x.id)).size!==list.length||
   list.some(x=>!uuid(x.id)||!x.name||typeof x.is_active!=='boolean'))throw Error('Original customer roster incomplete');
  customers=list.filter(x=>x.is_active);pick(customer,customers,'Choose active customer');if(customer.value)await loadSites(ctx,e);
 }
 async function run(fn){if(busy)return;busy=true;controls.forEach(x=>x.disabled=true);const e=epoch;
  try{await fn(e)}catch(x){clear();status.textContent='WITHHELD: '+(x?.message||String(x));}
  finally{busy=false;controls.forEach(x=>x.disabled=false);}}
 refresh.onclick=()=>run(load);
 company.onchange=()=>{epoch++;clear();status.textContent='Company changed: reverify service entitlement';};
 customer.onchange=()=>{epoch++;const e=epoch;run(async()=>{const ctx=await session();if(!alive(ctx.uid,e)||!entitled())throw Error('Company role changed');await loadSites(ctx,e);});};
 create.onclick=()=>run(async e=>{allowed();if(!customers.some(x=>x.id===customer.value)||!sites.some(x=>x.id===site.value))
  throw Error('Choose a verified original company client and property');
  if(!ref(risk.value)||!ref(original.value)||!septic&&(!kind.value.trim()||!detail.value.trim())||
   !septic&&permit.value==='source_provided'&&!ref(permitSource.value))throw Error('Property source, risk and permit references incomplete');
  const amount=septic?detail.value.trim():height.value.trim(),numeric=amount===''?null:Number(amount);
  if(numeric!==null&&(!Number.isFinite(numeric)||numeric<=0||numeric>(septic?1000000:150)))throw Error('Reported size invalid');
  const ctx=await session();if(!window.confirm('Record unverified '+title+' site information without dispatch or regulatory clearance?'))return;
  const name=septic?'ywi_rpc_pms_septic_site_451':'ywi_rpc_pms_arbor_tree_451';
  const args=septic?{p_company_id:company.value,p_client_id:customer.value,p_site_id:site.value,p_request_id:requestId(),
    p_kind:kind.value,p_capacity:numeric,p_access:risk.value.trim(),p_permit_ref:permitSource.value.trim()||null,
    p_safety_ref:safetySource.value.trim()||null,p_source_ref:original.value.trim()}:
   {p_company_id:company.value,p_client_id:customer.value,p_site_id:site.value,p_request_id:requestId(),
    p_label:kind.value.trim(),p_species:detail.value.trim(),p_height:numeric,p_zone:zone.value,
    p_risk_notes:risk.value.trim(),p_permit_state:permit.value,p_permit_ref:permitSource.value.trim()||null,
    p_source_ref:original.value.trim()};
  const receipt=await rpc(ctx.sb,name,args);if(!uuid(receipt)||!alive(ctx.uid,e))throw Error('Site receipt missing');
  await load(e);status.textContent=title+' site source saved. Safety/permit/regulated work HOLD.';});
 append.onclick=()=>run(async e=>{allowed();const parentRow=(septic?snapshot.septic_sites:snapshot.arbor_trees).find(x=>x.id===parent.value);
  if(!parentRow||!dated(date.value)||!ref(reportSource.value))throw Error('Verified owned site, report date and source required');
  let args,name;
  if(septic){const volume=Number(measure.value),originalReceipt=linked.value.trim()||null;
   if(!(volume>0&&volume<=100000)||!ref(measurement.value)||!ref(facility.value)||!ref(manifest.value)||
    originalReceipt!==null&&!uuid(originalReceipt)||
    (state.value==='source_linked')!==(originalReceipt!==null))throw Error('Manifest volume, original-source and receipt relationship required');
   name='ywi_rpc_pms_septic_manifest_451';args={p_company_id:company.value,p_profile_id:parentRow.id,
    p_request_id:requestId(),p_date:date.value,p_stream:action.value,p_volume:volume,
    p_measure_ref:measurement.value.trim(),p_facility:facility.value.trim(),p_manifest_ref:manifest.value.trim(),
    p_original_receipt:originalReceipt,p_disposal_state:state.value,p_source_ref:reportSource.value.trim(),p_notes:notes.value.trim()||null};
  }else{
   if(['high','stop_work'].includes(action.value)&&(!ref(safety.value)||!ref(crew.value)))
    throw Error('High-risk/stop-work needs original Safety and crew credential source labels; no clearance issued');
   name='ywi_rpc_pms_arbor_review_451';args={p_company_id:company.value,p_tree_id:parentRow.id,
    p_request_id:requestId(),p_date:date.value,p_risk:action.value,p_method:measure.value,
    p_equipment_ref:equipment.value.trim()||null,p_crew_ref:crew.value.trim()||null,
    p_safety_ref:safety.value.trim()||null,p_permit_ref:permitRef.value.trim()||null,
    p_state:state.value,p_evidence_ref:reportSource.value.trim(),p_notes:notes.value.trim()||null};
  }
  const ctx=await session();if(!window.confirm('Append operator source review only? This cannot certify disposal, tree risk, permits or dispatch.'))return;
  const receipt=await rpc(ctx.sb,name,args);if(!uuid(receipt)||!alive(ctx.uid,e))throw Error('Source review receipt missing');
  await load(e);status.textContent=title+' source review saved. Original independent approvals HOLD.';});
 const invalidate=()=>{epoch++;identity=null;roster=[];company.replaceChildren();clear();status.textContent='Session or module permissions changed; reverify '+title;};
 document.addEventListener('ywi:auth-changed',invalidate);
 document.addEventListener('ywi:module-permissions-changed',invalidate);
}
function mount(){mountOne('septic','owner451Septic','Septic Services');mountOne('arboriculture','owner451Arbor','Arboriculture & Tree Care');}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

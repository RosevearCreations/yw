/* YW 437 — owner-only, read-only QC and customer-portal handoff evidence review.
   The canonical QC, Jobs closeout and customer portal remain the sole writers. */
(()=>{'use strict';
const labels=Object.freeze({
 landscape:'Landscaping / grounds',construction:'Construction / repairs',
 water_parks:'Water park maintenance',snow_removal:'Snow removal / de-icing',
 snow_plowing:'Snow plowing',septic:'Septic haulage'
});
const keys=Object.keys(labels);
const valid=x=>typeof x==='string'&&x.trim().length>0;
const rowId=x=>x&&typeof x==='object'&&valid(String(x.id??''));
const bounded=(a,max=80)=>Array.isArray(a)&&a.length<=max&&a.every(rowId)&&
 new Set(a.map(x=>String(x.id))).size===a.length;
const fail=reason=>({state:'withheld',reason,holds:[],counts:{},authorized:false,completed:false,customer_signed:false});
const hold=(a,reason,ref)=>a.push({reason,ref:String(ref||'Original Jobs / QC')});
function inspectDirectory(data,companyId){
 if(data?.company_id!==companyId||data.work_order_id!==null||data.complete!==true||
  data.source_limit!==80||data.state!=='choose_order'||data.approval_or_signature_write!==false||
  !bounded(data.orders,60)||data.orders.some(o=>!keys.includes(o.service)||!valid(o.number)||!valid(o.status)))
  return fail('Original owner Jobs directory is incomplete, foreign, malformed or capped');
 return {state:'review',orders:data.orders,authorized:false};
}
function inspect(data,{companyId,workOrderId,serviceKey}){
 if(!companyId||!workOrderId||!keys.includes(serviceKey)||data?.company_id!==companyId||
  data.work_order_id!==workOrderId||data.complete!==true||data.source_limit!==80||
  data.state!=='review_only'||data.approval_or_signature_write!==false||
  data.customer_message_sent!==false||data.site_reopened!==false||
  !bounded(data.orders,60))return fail('Owner, immutable original Jobs identity or read-only source boundary unverified');
 const o=data.orders.find(r=>r.id===workOrderId);
 if(!o||o.service!==serviceKey||!valid(o.number)||!valid(o.status))
  return fail('Selected work order is missing or belongs to another service');
 const names=['items','deficiencies','rework','evidence','signoffs'];
 if(names.some(k=>!bounded(data[k]))||names.reduce((n,k)=>n+data[k].length,0)>80)
  return fail('QC, objection, proof or signoff source is incomplete, duplicated or capped');
 const qc=data.qc,co=data.closeout,holds=[];
 if(qc!==null&&(!rowId(qc)||qc.work_order_id!==workOrderId))return fail('QC approval belongs to a foreign or invalid original Jobs order');
 if(co!==null&&(!rowId(co)||co.work_order_id!==workOrderId))return fail('Supervisor closeout belongs to a foreign original Jobs order');
 if(!qc&&data.items.concat(data.deficiencies,data.rework,data.evidence).length)
  return fail('Orphaned QC source without its original run');
 if(!co&&data.signoffs.length)return fail('Customer signoff references an absent original closeout');
 const itemIds=new Set(data.items.map(x=>String(x.id)));
 const deficiencyIds=new Set(data.deficiencies.map(x=>String(x.id)));
 for(const x of data.items){
  if(x.qc_run_id!==qc?.id||typeof x.is_required!=='boolean'||!['pending','pass','fail','not_applicable'].includes(x.result_status))
   return fail('QC checklist item has foreign source or invalid result');
 }
 for(const x of data.deficiencies){
  if(x.qc_run_id!==qc?.id||(x.qc_item_id!==null&&!itemIds.has(String(x.qc_item_id)))||
   !['open','rework_required','rework_in_progress','resolved','accepted_exception'].includes(x.deficiency_status))
   return fail('QC deficiency references another checklist item or has invalid status');
 }
 for(const x of data.rework){
  if(!deficiencyIds.has(String(x.deficiency_id))||!['started','progress','completed'].includes(x.event_type)||!valid(x.recorded_at))
   return fail('Rework event references an absent deficiency or invalid original status');
  if(x.resolution_execution_proof_id!==null&&
    (x.resolution_proof_work_order_id!==workOrderId||!['approved','submitted','rejected','retracted'].includes(x.resolution_proof_status)))
   return fail('Rework resolution proof belongs to a foreign or missing original Jobs order');
 }
 for(const x of data.evidence){
  if(x.qc_run_id!==qc?.id||(x.qc_item_id!==null&&!itemIds.has(String(x.qc_item_id)))||
   x.proof_work_order_id!==workOrderId||!valid(x.execution_proof_id)||
   !['before','after','detail','final'].includes(x.evidence_role)||
   typeof x.customer_safe!=='boolean'||typeof x.customer_visible!=='boolean')
   return fail('QC proof link is foreign, missing or not a verified original execution proof');
 }
 for(const x of data.signoffs){
  if(x.closeout_package_id!==co?.id||!['signed','declined'].includes(x.signoff_status)||!valid(x.created_at))
   return fail('Customer signoff is missing, foreign or not an authentic portal record');
 }
 if(!qc)hold(holds,'Original QC run not found; crew completion is not proof of quality acceptance');
 else{
  if(qc.run_status!=='approved'||qc.review_status!=='approved'||
    !valid(qc.reviewed_by_profile_id)||!valid(qc.reviewed_at))
   hold(holds,'Dated independent QC approval is missing or rework remains open',qc.id);
  const required=data.items.filter(x=>x.is_required);
  if(!required.length)hold(holds,'No original required QC checklist items can be verified',qc.id);
  for(const i of required)if(i.result_status!=='pass'||!valid(i.completed_at))
   hold(holds,'Required QC checklist item has no dated PASS evidence',i.id);
  for(const i of required){
   const evidence=data.evidence.filter(e=>e.qc_item_id===i.id&&e.proof_status==='approved'&&e.customer_safe&&e.customer_visible);
   const roles=new Set(evidence.map(e=>e.evidence_role));
   if(i.evidence_requirement==='before_after'&&(!roles.has('before')||!roles.has('after')))
    hold(holds,'Required before-and-after approved QC evidence is incomplete',i.id);
   else if(['before','after','detail'].includes(i.evidence_requirement)&&!roles.has(i.evidence_requirement))
    hold(holds,'Required original QC evidence is missing or unapproved',i.id);
   else if(!['none','before','after','detail','before_after'].includes(i.evidence_requirement))
    return fail('Original QC evidence requirement is missing or invalid');
  }
 }
 for(const d of data.deficiencies)if(d.deficiency_status!=='resolved'||!valid(d.resolved_at))
  hold(holds,'Unresolved customer/QC objection or accepted exception needs a human decision',d.id);
 for(const d of data.deficiencies){
  const events=data.rework.filter(e=>e.deficiency_id===d.id);
  if(events.length&&!events.some(e=>e.event_type==='completed'&&valid(e.resolution_execution_proof_id)&&e.resolution_proof_status==='approved'))
   hold(holds,'Recorded rework has no completed event with original resolution proof',d.id);
 }
 const customerProof=data.evidence.filter(e=>e.proof_status==='approved'&&e.customer_safe===true&&e.customer_visible===true);
 if(!customerProof.length)hold(holds,'No approved customer-safe execution proof is linked to original QC');
 for(const e of data.evidence)if(e.proof_status!=='approved')
  hold(holds,'Linked execution proof has not been independently approved',e.id);
 if(!co)hold(holds,'Original supervisor closeout package not found');
 else{
  if(!['approved','invoice_ready'].includes(co.closeout_status)||!valid(co.approved_by_profile_id)||!valid(co.approved_at))
   hold(holds,'Independent dated supervisor closeout approval missing',co.id);
  if(co.customer_change_requested===true)hold(holds,'Customer requested a change or raised an objection',co.id);
  if(typeof co.customer_signoff_required!=='boolean'||typeof co.customer_change_requested!=='boolean')
   return fail('Canonical closeout signoff boundary is incomplete');
  if(co.customer_signoff_required){
   const latest=data.signoffs.slice().sort((a,b)=>a.created_at.localeCompare(b.created_at)).at(-1);
   if(co.customer_signoff_status!=='signed'||!valid(co.signed_off_at)||latest?.signoff_status!=='signed')
    hold(holds,'Authentic latest customer-portal signed acceptance not independently recorded',co.id);
   if(latest?.signoff_status==='signed'&&valid(co.signed_off_at)&&Date.parse(latest.created_at)>Date.parse(co.signed_off_at))
    hold(holds,'Customer portal chronology must be independently reconciled with closeout date',co.id);
  }else if(data.signoffs.some(s=>s.signoff_status==='declined'))
   hold(holds,'Customer portal contains a declined signature even though closeout signoff is optional',co.id);
 }
 return {state:holds.length?'hold':'review',authorized:false,completed:false,customer_signed:false,
  company_id:companyId,work_order_id:workOrderId,service:serviceKey,
  label:labels[serviceKey],order:o.number,holds,counts:{
   checklist:data.items.length,required:data.items.filter(x=>x.is_required).length,
   deficiencies:data.deficiencies.length,rework:data.rework.length,
   proof:data.evidence.length,customer_safe_proof:customerProof.length,
   portal_signoffs:data.signoffs.length},
  qc_status:qc?.review_status||'missing',closeout_status:co?.closeout_status||'missing',
  portal_state:co?.customer_signoff_status||'not_recorded',
  review:'Review of original records only. Not a new QC sign-off, authentic customer signature, permission to message, reopen a site, invoice or certify work.'};
}
window.YWI437=Object.freeze({labels,inspectDirectory,inspect});
const node=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);return n;};
function mount(){
 const host=document.getElementById('admin');if(!host||document.getElementById('owner437'))return;
 const panel=node('details');panel.id='owner437';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='QC, Exception and Customer Handoff Acceptance';
 panel.dataset.adminHubGroups='management operations jobs';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.append(node('summary','437 · Quality-Control, Exception & Customer Handoff Review'));
 const body=node('div');body.className='admin-panel-block';
 body.append(node('p','Trace real QC approval, required checklist results, deficiencies, rework, customer-safe execution proof, supervisor closeout and authentic portal signoff for one original service job. HOLD is not a completion. No write or customer notification occurs.'));
 const help=node('a','ⓘ QC and customer handoff Help');help.href='/help.html#quality-customer-handoff-437';body.append(help);
 const fields=node('div');fields.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px;min-width:0';
 const picker=(labelText,id)=>{const label=node('label',labelText),select=node('select');select.id=id;
  select.style.cssText='display:block;width:100%;min-width:0;max-width:100%;box-sizing:border-box';
  label.append(select);fields.append(label);return select;};
 const company=picker('Verified owner company','owner437Company');
 const service=picker('Original service offering','owner437Service');
 const order=picker('Original Jobs work order','owner437Order');body.append(fields);
 const refresh=node('button','Reconcile original QC and customer handoff');refresh.type='button';
 refresh.className='secondary';refresh.id='owner437Refresh';body.append(refresh);
 const status=node('p','Authenticate as company owner, then refresh original QC records.');
 status.id='owner437Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const result=node('div');result.id='owner437Results';
 result.style.cssText='display:grid;gap:12px;max-width:100%;min-width:0;overflow-wrap:anywhere';body.append(result);
 panel.append(body);host.append(panel);
 let session=null,epoch=0,busy=false;
 const note=text=>{status.textContent=text;};
 const clear=()=>{session=null;company.replaceChildren();service.replaceChildren();order.replaceChildren();result.replaceChildren();};
 const options=(select,rows,label,placeholder)=>{select.replaceChildren();const empty=node('option',placeholder);empty.value='';select.append(empty);
  for(const row of rows){const opt=node('option',label(row));opt.value=row.id;select.append(opt);}};
 async function identity(){
  const state=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(!state?.isAuthenticated||!state.user?.id||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)throw Error('Authenticated owner identity is required');
  const u=await sb.auth.getUser();
  if(u.error||u.data?.user?.id!==state.user.id)throw Error('Owner authentication mismatch');
  return {uid:state.user.id,sb};
 }
 const rpc=async(sb,companyId,workOrderId)=>{const r=await sb.rpc('ywi_rpc_quality_customer_handoff_437',
  {p_company_id:companyId,p_work_order_id:workOrderId});
  if(r.error||!r.data)throw Error('Owner-guarded original QC, closeout or portal source inaccessible');
  return r.data;};
 function render(review){
  result.replaceChildren();
  if(review.state==='withheld'){note('WITHHELD: '+review.reason);return;}
  note(review.state.toUpperCase()+' · '+review.label+' · '+review.order+
   '. Original evidence only; NO new QC, customer signature or Jobs completion.');
  const summary=node('section');summary.className='notice';summary.dataset.owner437Group='sources';
  summary.style.cssText='border:1px solid #64748b;border-radius:10px;padding:12px;min-width:0;overflow-wrap:anywhere';
  summary.append(node('h3','Original QC, supervisor and portal provenance'));
  summary.append(node('p','QC review: '+review.qc_status+' · Supervisor closeout: '+review.closeout_status+
   ' · Customer portal: '+review.portal_state));
  const list=node('ul');
  for(const [label,key] of [['QC checklist items','checklist'],['Required checks','required'],
   ['Deficiencies','deficiencies'],['Rework events','rework'],['Linked execution proofs','proof'],
   ['Approved customer-safe proofs','customer_safe_proof'],['Portal signoff records','portal_signoffs']]){
   list.append(node('li',label+': '+review.counts[key]));}
  summary.append(list);result.append(summary);
  const warnings=node('section');warnings.className='notice';warnings.dataset.owner437Group='holds';
  warnings.style.cssText=summary.style.cssText;
  warnings.append(node('h3','Outstanding manual gates · '+review.holds.length));
  if(!review.holds.length)warnings.append(node('p','No missing source detected in this order snapshot; independent approvals remain authoritative.'));
  const ul=node('ul');for(const h of review.holds)ul.append(node('li',h.ref+': '+h.reason));
  warnings.append(ul);result.append(warnings);result.append(node('p',review.review));
 }
 async function load(){
  const start=epoch,current=await identity();
  const fresh=()=>start===epoch&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&
   window.YWI_AUTH?.getState?.()?.user?.id===current.uid&&(!session||session.uid===current.uid);
  const assertFresh=()=>{if(!fresh())throw Error('Authenticated owner changed during original source read');};
  assertFresh();
  if(!session||session.uid!==current.uid){clear();session=current;}
  const savedCompany=company.value,savedService=service.value,savedOrder=order.value;
  const r=await current.sb.from('ywi_companies').select('id,name,owner_user_id')
   .order('created_at',{ascending:true}).limit(101);
  assertFresh();
  if(r.error||!bounded(r.data,100)||r.data.some(c=>!valid(c.name)||c.owner_user_id!==current.uid))
   throw Error('Verified original owner companies missing, foreign, duplicated or capped');
  options(company,r.data,c=>c.name,'Choose owner company');
  if(r.data.some(c=>c.id===savedCompany))company.value=savedCompany;
  else if(r.data.length===1)company.value=r.data[0].id;
  if(!company.value){service.replaceChildren();order.replaceChildren();result.replaceChildren();note('Choose an owner company and refresh.');return;}
  const companyId=company.value,source=await rpc(current.sb,companyId,null);assertFresh();
  const directory=inspectDirectory(source,companyId);
  if(directory.state==='withheld')throw Error(directory.reason);
  options(service,keys.map(k=>({id:k})),x=>labels[x.id],'Choose distinct service');
  if(keys.includes(savedService))service.value=savedService;
  if(!service.value){order.replaceChildren();result.replaceChildren();note('Choose a service; original Jobs remains the authoritative order directory.');return;}
  const orders=directory.orders.filter(o=>o.service===service.value);
  options(order,orders,o=>o.number+' · '+o.status,'Choose genuine Jobs order');
  if(orders.some(o=>o.id===savedOrder))order.value=savedOrder;
  else if(orders.length===1)order.value=orders[0].id;
  if(!order.value){result.replaceChildren();note(orders.length?'Select an original service work order and refresh.':'HOLD: No original Jobs order for this service.');return;}
  const serviceKey=service.value,workOrderId=order.value;
  const detail=await rpc(current.sb,companyId,workOrderId);
  if(!fresh()||company.value!==companyId||service.value!==serviceKey||order.value!==workOrderId)
   throw Error('Owner session or selected original work order changed during read');
  render(inspect(detail,{companyId,workOrderId,serviceKey}));
 }
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;
  for(const x of [refresh,company,service,order])x.disabled=true;
  try{await load();}catch(e){clear();note('WITHHELD: '+(e?.message||e)+'. No QC, closeout, customer or Finance write occurred.');}
  finally{busy=false;for(const x of [refresh,company,service,order])x.disabled=false;}
 });
 company.addEventListener('change',()=>{epoch++;service.replaceChildren();order.replaceChildren();result.replaceChildren();note('Owner company changed: refresh source.');});
 service.addEventListener('change',()=>{epoch++;order.replaceChildren();result.replaceChildren();note('Service changed: refresh its original order directory.');});
 order.addEventListener('change',()=>{epoch++;result.replaceChildren();note('Original order changed: refresh its QC evidence.');});
 document.addEventListener('ywi:auth-changed',()=>{epoch++;clear();note('Owner session changed. Reauthenticate and refresh.');});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

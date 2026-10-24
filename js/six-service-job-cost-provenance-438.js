/* YW 438 — one owner, one original Jobs order, independent provenance buckets.
   This read-only review never books money, ranks staff or adds duplicate costs. */
(()=>{'use strict';
const labels=Object.freeze({landscape:'Landscaping / grounds',construction:'Construction / repairs',
 water_parks:'Water park maintenance',snow_removal:'Snow removal / de-icing',
 snow_plowing:'Snow plowing',septic:'Septic haulage'});
const keys=Object.keys(labels),valid=x=>typeof x==='string'&&x.trim().length>0;
const id=x=>x&&typeof x==='object'&&valid(String(x.id??''));
const bounded=(a,max=120)=>Array.isArray(a)&&a.length<=max&&a.every(id)&&
 new Set(a.map(x=>String(x.id))).size===a.length;
const money=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&Number.isSafeInteger(Math.round(n*100));
const cents=n=>Math.round(n*100);
const comparison=(actual,baseline)=>money(actual)&&money(baseline)&&cents(baseline)>0?
 {amount:(cents(actual)-cents(baseline))/100,percent:Math.round(1000*(cents(actual)-cents(baseline))/cents(baseline))/10,
  baseline,actual}:null;
const fail=reason=>({state:'withheld',reason,authorized:false,posted:false,completed:false,metrics:{},holds:[]});
const hold=(a,reason,ref)=>a.push({reason,ref:String(ref||'Original Jobs / Finance')});
function inspectDirectory(d,companyId){
 if(d?.company_id!==companyId||d.work_order_id!==null||d.complete!==true||
 d.state!=='choose_order'||d.source_limit!==120||d.finance_mutation!==false||
 d.job_mutation!==false||d.payroll_mutation!==false||!bounded(d.orders,60)||
 d.orders.some(x=>!keys.includes(x.service)||!valid(x.number)||!valid(x.status)))
  return fail('Owner original Jobs directory is foreign, missing or over review cap');
 return {state:'review',orders:d.orders,authorized:false};
}
function inspect(d,{companyId,workOrderId,serviceKey}){
 if(!valid(companyId)||!valid(workOrderId)||!keys.includes(serviceKey)||
  d?.company_id!==companyId||d.work_order_id!==workOrderId||d.complete!==true||
  d.state!=='review_only'||d.source_limit!==120||d.finance_mutation!==false||
  d.job_mutation!==false||d.payroll_mutation!==false||!bounded(d.orders,60))
  return fail('Owned immutable original Jobs identity and no-write source are not verified');
 const selected=d.orders.find(o=>o.id===workOrderId);
 if(!selected||selected.service!==serviceKey||!valid(selected.number)||!valid(selected.status))
  return fail('Work order is absent or belongs to another service');
 const names=['estimate_lines','order_lines','proofs','crew_hours','material_issues','material_lines',
  'allocations','equipment','invoice_candidates','invoice_postings','ar_invoices'];
 if(names.some(n=>!bounded(d[n]))||names.reduce((n,k)=>n+d[k].length,0)>120)
  return fail('Original cost, timekeeping, allocation or Finance source is incomplete/duplicated/capped');
 const wo=d.order,e=d.estimate,holds=[];
 if(!id(wo)||wo.id!==workOrderId||!money(wo.subtotal)||!money(wo.total_amount)||
  !money(wo.tax_total)||!valid(wo.approval_status))return fail('Original Jobs price or approval is invalid');
 if(wo.estimate_id!==null&&wo.estimate_id!==undefined&&!valid(wo.estimate_id))return fail('Invalid original estimate link');
 if(e!==null&&(!id(e)||e.id!==wo.estimate_id||e.company_id!==companyId||
  e.service_module_key!==serviceKey||!money(e.subtotal)||!money(e.total_amount)||
  !money(e.total_cost)||!valid(e.approval_status)))return fail('Linked estimate belongs to another owner/service or is malformed');
 if(!e&&d.estimate_lines.length)return fail('Orphaned original estimate lines');
 if(d.estimate_lines.some(x=>x.estimate_id!==e?.id||!money(x.line_total)||!money(x.cost_total)))
  return fail('Foreign or malformed original estimate line');
 if(d.order_lines.some(x=>x.work_order_id!==workOrderId||!money(x.line_total)||!money(x.cost_total)))
  return fail('Foreign or malformed original Jobs line');
 for(const p of d.proofs){
  if(p.work_order_id!==workOrderId||!['submitted','approved','rejected','retracted'].includes(p.proof_status)||
   !['arrival','progress','completion','quality','material','equipment','expense','note'].includes(p.proof_type)||
   !['labour_cost_total','material_cost_total','equipment_cost_total','other_cost_total','total_cost'].every(k=>money(p[k]))||
   !Number.isInteger(p.labour_minutes)||p.labour_minutes<0)
   return fail('Execution cost proof is foreign, malformed or missing amount provenance');
  const components=['labour_cost_total','material_cost_total','equipment_cost_total','other_cost_total']
   .reduce((n,k)=>n+cents(p[k]),0);
  if(Math.abs(components-cents(p.total_cost))>1)return fail('Execution proof category amounts do not reconcile with source total');
 }
 for(const x of d.crew_hours){
  if(x.work_order_id!==workOrderId||
    (wo.legacy_job_id!==null&&String(x.job_id)!==String(wo.legacy_job_id))||
    !['hours_worked','regular_hours','overtime_hours'].every(k=>money(x[k])))
   return fail('Timekeeping row has foreign Jobs identity or invalid hours');
 }
 const recordedTimeIds=d.crew_hours.filter(x=>x.time_entry_id!==null&&x.time_entry_id!==undefined)
  .map(x=>String(x.time_entry_id));
 if(recordedTimeIds.length!==new Set(recordedTimeIds).size)
  return fail('Duplicate canonical time-entry receipt could double-count original labour hours');
 const issues=new Set(d.material_issues.map(x=>String(x.id)));
 const lines=new Set(d.material_lines.map(x=>String(x.id)));
 const orderLines=new Set(d.order_lines.map(x=>String(x.id)));
 for(const x of d.material_issues){
  if(x.work_order_id!==workOrderId||!['draft','issued','partial','closed','void'].includes(x.issue_status)||
    !money(x.issue_total))return fail('Material issue is foreign or has invalid status/amount');
 }
 for(const x of d.material_lines){
  if(!issues.has(String(x.issue_id))||x.issue_work_order_id!==workOrderId||
    (x.work_order_line_id!==null&&!orderLines.has(String(x.work_order_line_id)))||
    !money(x.quantity)||!money(x.unit_cost)||!money(x.line_total))
   return fail('Original material line is foreign or lacks a valid issue/plan source');
 }
 const equipment=new Set(d.equipment.map(x=>String(x.id)));
 for(const x of d.equipment){
  if(x.work_order_id!==workOrderId||!valid(x.checked_out_at)||
    (wo.legacy_job_id!==null&&x.job_id!==null&&String(x.job_id)!==String(wo.legacy_job_id)))
   return fail('Equipment checkout is foreign, missing or linked to a different Jobs identity');
 }
 for(const x of d.allocations){
  const material=x.material_issue_line_id!==null&&x.material_issue_line_id!==undefined;
  const asset=x.equipment_signout_id!==null&&x.equipment_signout_id!==undefined;
  if(x.company_id!==companyId||x.work_order_id!==workOrderId||material===asset||
   (material&&!lines.has(String(x.material_issue_line_id)))||
   (asset&&!equipment.has(String(x.equipment_signout_id)))||
   typeof x.source_fresh!=='boolean')
   return fail('423 allocation receipt is foreign, orphaned or incomplete');
 }
 const candidates=new Set(d.invoice_candidates.map(x=>String(x.id)));
 const invoices=new Set(d.ar_invoices.map(x=>String(x.id)));
 for(const x of d.invoice_candidates){
  if(x.work_order_id!==workOrderId||x.estimate_id!==wo.estimate_id||
   !['draft','ready','reviewed','posted','rejected'].includes(x.candidate_status)||
   !money(x.subtotal)||!money(x.tax_total)||!money(x.total_amount))
   return fail('Invoice candidate references another original order/estimate or amount');
 }
 for(const x of d.ar_invoices){
  if(x.work_order_id!==workOrderId||!valid(x.invoice_status)||
   !['subtotal','tax_total','total_amount','balance_due','amount_paid'].every(k=>money(x[k])))
   return fail('AR invoice is foreign or the original Finance amounts are invalid');
 }
 for(const x of d.invoice_postings){
  if(!candidates.has(String(x.invoice_candidate_id))||x.candidate_work_order_id!==workOrderId||
   !['draft','reviewed','posted','reversed','failed'].includes(x.posting_status)||
   (x.ar_invoice_id!==null&&!invoices.has(String(x.ar_invoice_id))))
   return fail('Finance posting has foreign candidate, status or AR invoice link');
 }
 if(!e)hold(holds,'Original approved estimate not linked to this Jobs order');
 else if(e.approval_status!=='approved'||!valid(e.approved_at))
  hold(holds,'Dated original estimate approval is not established',e.id);
 if(!['approved','released','completed'].includes(wo.approval_status))
  hold(holds,'Original Jobs price has not passed its independent approval gate',wo.id);
 if(!cents(wo.subtotal)||!e||!cents(e.subtotal))hold(holds,'Comparable positive original price denominator is absent',wo.id);
 const priceVariance=e&&e.approval_status==='approved'&&valid(e.approved_at)&&
  ['approved','released','completed'].includes(wo.approval_status)?comparison(wo.subtotal,e.subtotal):null;
 const approved=d.proofs.filter(p=>p.proof_status==='approved'&&valid(p.approved_at)&&valid(p.approved_by_profile_id));
 if(!approved.length)hold(holds,'No independently approved original execution cost proof',wo.id);
 if(approved.length>1)hold(holds,'Multiple approved proof cost envelopes may overlap; no synthetic total',wo.id);
 if(d.proofs.some(p=>p.proof_status==='submitted'||(p.proof_status==='approved'&&
  (!valid(p.approved_at)||!valid(p.approved_by_profile_id)))))
  hold(holds,'Pending or undated execution cost proof remains for manual review',wo.id);
 const oneProof=approved.length===1?approved[0]:null;
 if(oneProof&&cents(oneProof.total_cost)===0)
  hold(holds,'Zero-valued proof does not establish measured actual job expenditure',oneProof.id);
 const baseline=money(wo.estimate_baseline_cost_total)?wo.estimate_baseline_cost_total:null;
 if(baseline===null||!cents(baseline))hold(holds,'Original accepted positive job-cost baseline not recorded',wo.id);
 const costVariance=oneProof&&cents(oneProof.total_cost)>0&&baseline!==null&&
  ['approved','released','completed'].includes(wo.approval_status)?comparison(oneProof.total_cost,baseline):null;
 if(!d.crew_hours.length)hold(holds,'No original timekeeping hours have been attributed to this work order',wo.id);
 if(d.crew_hours.some(x=>Math.abs(cents(x.regular_hours)+cents(x.overtime_hours)-cents(x.hours_worked))>2))
  hold(holds,'Original regular/overtime hours need independent timekeeping reconciliation',wo.id);
 if(!d.material_lines.length)hold(holds,'No original issued material lines recorded; this is not zero cost',wo.id);
 const validMaterials=d.material_lines.filter(x=>x.usage_type==='job_use'&&
  d.material_issues.some(m=>m.id===x.issue_id&&['issued','partial','closed'].includes(m.issue_status)));
 if(d.material_lines.length!==validMaterials.length)hold(holds,'Draft, void or non-job-use materials cannot establish actual consumption',wo.id);
 for(const x of validMaterials)if(!d.allocations.some(p=>p.material_issue_line_id===x.id&&p.source_fresh))
  hold(holds,'Material usage has no unchanged 423 original allocation receipt',x.id);
 if(!d.equipment.length)hold(holds,'No original equipment custody evidence; zero asset expense is unproven',wo.id);
 for(const x of d.equipment)if(!d.allocations.some(p=>String(p.equipment_signout_id)===String(x.id)&&p.source_fresh))
  hold(holds,'Equipment checkout has no unchanged original 423 custody receipt',x.id);
 if(d.allocations.some(x=>!x.source_fresh))hold(holds,'Original material/equipment source changed after 423 attestation',wo.id);
 if(!d.ar_invoices.length)hold(holds,'No original AR invoice amount yet; Finance total is not zero revenue',wo.id);
 if(d.ar_invoices.length>1)hold(holds,'Multiple AR invoices require credit/debit/refund reconciliation, not summed revenue',wo.id);
 if(d.ar_invoices.some(x=>['draft','void','cancelled','canceled'].includes(x.invoice_status)))
  hold(holds,'Original AR document is unissued, void or cancelled, not valid posted revenue',wo.id);
 if(d.invoice_postings.some(p=>p.posting_status!=='posted'))
  hold(holds,'Original Finance posting is not completed/accepted',wo.id);
 const ar=d.ar_invoices.length===1&&
  !['draft','void','cancelled','canceled'].includes(d.ar_invoices[0].invoice_status)?d.ar_invoices[0]:null;
 const financeVariance=ar?comparison(ar.subtotal,wo.subtotal):null;
 return {state:holds.length?'hold':'review',authorized:false,posted:false,completed:false,
  company_id:companyId,work_order_id:workOrderId,service:serviceKey,label:labels[serviceKey],
  number:selected.number,holds,metrics:{priceVariance,costVariance,financeVariance,
   approvedProofCost:oneProof?.total_cost??null,labourCost:oneProof?.labour_cost_total??null,
   materialCost:oneProof?.material_cost_total??null,equipmentCost:oneProof?.equipment_cost_total??null,
   otherCost:oneProof?.other_cost_total??null,
   crewHours:d.crew_hours.reduce((n,x)=>n+x.hours_worked,0),
   originalMaterialIssueLines:d.material_lines.length,verifiedMaterialLines:validMaterials.filter(x=>
    d.allocations.some(p=>p.material_issue_line_id===x.id&&p.source_fresh)).length,
   custodyRecords:d.equipment.length,originalArInvoices:d.ar_invoices.length,
   invoiceCandidates:d.invoice_candidates.length,postingRecords:d.invoice_postings.length},
  review:'Original Jobs price, labour time, material use, equipment custody and Finance are separate sources. Approved execution cost is not combined with material issue totals, payroll, estimates or AR. No invoice, posted cost, ROI, staff ranking or authority is created.'};
}
window.YWI438=Object.freeze({labels,inspectDirectory,inspect,comparison});
const node=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);return n;};
function mount(){
 const host=document.getElementById('admin');if(!host||document.getElementById('owner438'))return;
 const panel=node('details');panel.id='owner438';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Six-Service Job Cost and Price Variance';
 panel.dataset.adminHubGroups='management operations jobs';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.append(node('summary','438 · Six-Service Job-Cost Provenance & Price Variance Review'));
 const body=node('div');body.className='admin-panel-block';
 body.append(node('p','Read original price, recorded hours, material and custody receipts, approved proof cost and original Finance side by side. Comparisons are shown only with a verified source and a positive denominator. No expense source is added twice.'));
 const help=node('a','ⓘ Job-cost provenance Help');help.href='/help.html#six-service-job-cost-provenance-438';body.append(help);
 const fields=node('div');fields.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px;min-width:0';
 const picker=(labelText,id)=>{const label=node('label',labelText),select=node('select');select.id=id;
  select.style.cssText='display:block;width:100%;min-width:0;max-width:100%;box-sizing:border-box';
  label.append(select);fields.append(label);return select;};
 const company=picker('Verified owner company','owner438Company');
 const service=picker('Distinct original service','owner438Service');
 const order=picker('Original Jobs work order','owner438Order');body.append(fields);
 const refresh=node('button','Reconcile original job-cost and Finance sources');refresh.type='button';
 refresh.className='secondary';refresh.id='owner438Refresh';body.append(refresh);
 const status=node('p','Authenticate as company owner and refresh original records.');
 status.id='owner438Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const result=node('div');result.id='owner438Results';
 result.style.cssText='display:grid;gap:12px;max-width:100%;min-width:0;overflow-wrap:anywhere';body.append(result);
 panel.append(body);host.append(panel);
 let session=null,epoch=0,busy=false;
 const note=s=>{status.textContent=s;};
 const clear=()=>{session=null;company.replaceChildren();service.replaceChildren();order.replaceChildren();result.replaceChildren();};
 const options=(sel,rows,label,placeholder)=>{sel.replaceChildren();const empty=node('option',placeholder);empty.value='';sel.append(empty);
  for(const r of rows){const item=node('option',label(r));item.value=r.id;sel.append(item);}};
 async function identity(){const state=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(!state?.isAuthenticated||!state.user?.id||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)
   throw Error('Authenticated original company owner required');
  const u=await sb.auth.getUser();
  if(u.error||u.data?.user?.id!==state.user.id)throw Error('Owner authentication mismatch');
  return {uid:state.user.id,sb};}
 async function rpc(sb,companyId,workOrderId){
  const r=await sb.rpc('ywi_rpc_job_cost_provenance_438',
   {p_company_id:companyId,p_work_order_id:workOrderId});
  if(r.error||!r.data)throw Error('Original owner-guarded Jobs/cost/Finance source inaccessible');
  return r.data;}
 const amount=n=>typeof n==='number'&&Number.isFinite(n)?'$'+n.toFixed(2):'not measured';
 function render(r){result.replaceChildren();
  if(r.state==='withheld'){note('WITHHELD: '+r.reason);return;}
  note(r.state.toUpperCase()+' · '+r.label+' · '+r.number+' · source-only review, NOT a posted cost or profit');
  const add=(title,items,group)=>{const box=node('section');box.className='notice';box.dataset.owner438Group=group;
   box.style.cssText='border:1px solid #64748b;border-radius:10px;padding:12px;min-width:0;overflow-wrap:anywhere';
   box.append(node('h3',title));const ul=node('ul');for(const item of items)ul.append(node('li',item));box.append(ul);result.append(box);};
  const m=r.metrics;
  const v=(name,val)=>val?`${name}: ${amount(val.amount)} (${val.percent}% of original baseline variance; baseline ${amount(val.baseline)}, observed ${amount(val.actual)})`:
   `${name}: withheld — original positive denominator and source approval required`;
  add('Three independent comparisons (never combined)',[
   v('Original job subtotal vs approved estimate subtotal',m.priceVariance),
   v('Single approved proof cost vs accepted Jobs cost baseline',m.costVariance),
   v('Original AR subtotal vs original Jobs subtotal',m.financeVariance)],'variance');
  add('Original sources — separate, not added together',[
   `Approved proof cost envelope: ${amount(m.approvedProofCost)} (labour ${amount(m.labourCost)}, materials ${amount(m.materialCost)}, equipment ${amount(m.equipmentCost)}, other ${amount(m.otherCost)})`,
   `Original timekeeping hours: ${m.crewHours.toFixed(2)} · no employee cost, ranking or payroll inferred`,
   `Original material issue lines: ${m.originalMaterialIssueLines} · unchanged 423 allocation: ${m.verifiedMaterialLines}`,
   `Equipment custody records: ${m.custodyRecords} · not an asset-cost total`,
   `Original AR invoices: ${m.originalArInvoices}; Finance candidates: ${m.invoiceCandidates}; posting records: ${m.postingRecords}`], 'sources');
  add(`Outstanding manual evidence gates · ${r.holds.length}`,
   r.holds.length?r.holds.map(h=>h.ref+': '+h.reason):['No missing source in this bounded snapshot; human review still required.'],'holds');
  result.append(node('p',r.review));
 }
 async function load(){const start=epoch,current=await identity();
  const fresh=()=>start===epoch&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&
   window.YWI_AUTH?.getState?.()?.user?.id===current.uid&&(!session||session.uid===current.uid);
  const assertFresh=()=>{if(!fresh())throw Error('Owner identity changed during source read');};
  assertFresh();if(!session||session.uid!==current.uid){clear();session=current;}
  const savedCompany=company.value,savedService=service.value,savedOrder=order.value;
  const r=await current.sb.from('ywi_companies').select('id,name,owner_user_id')
   .order('created_at',{ascending:true}).limit(101);
  assertFresh();if(r.error||!bounded(r.data,100)||r.data.some(c=>!valid(c.name)||c.owner_user_id!==current.uid))
   throw Error('Original owner companies are inaccessible, foreign or over cap');
  options(company,r.data,c=>c.name,'Choose owner company');
  if(r.data.some(c=>c.id===savedCompany))company.value=savedCompany;
  else if(r.data.length===1)company.value=r.data[0].id;
  if(!company.value){service.replaceChildren();order.replaceChildren();result.replaceChildren();note('Choose verified owner company and refresh.');return;}
  const companyId=company.value,dir=inspectDirectory(await rpc(current.sb,companyId,null),companyId);assertFresh();
  if(dir.state==='withheld')throw Error(dir.reason);
  options(service,keys.map(id=>({id})),x=>labels[x.id],'Choose original service');
  if(keys.includes(savedService))service.value=savedService;
  if(!service.value){order.replaceChildren();result.replaceChildren();note('Choose one independent service and refresh.');return;}
  const orders=dir.orders.filter(x=>x.service===service.value);
  options(order,orders,x=>x.number+' · '+x.status,'Choose original Jobs order');
  if(orders.some(x=>x.id===savedOrder))order.value=savedOrder;
  else if(orders.length===1)order.value=orders[0].id;
  if(!order.value){result.replaceChildren();note(orders.length?'Select original Jobs order and refresh.':'HOLD: No original Jobs order for this service.');return;}
  const workOrderId=order.value,serviceKey=service.value,data=await rpc(current.sb,companyId,workOrderId);
  if(!fresh()||company.value!==companyId||service.value!==serviceKey||order.value!==workOrderId)
   throw Error('Owner, service or Jobs order changed during cost source read');
  render(inspect(data,{companyId,workOrderId,serviceKey}));
 }
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;
  for(const x of [refresh,company,service,order])x.disabled=true;
  try{await load();}catch(e){clear();note('WITHHELD: '+(e?.message||e)+'. No cost, Finance, payroll or Jobs writes occurred.');}
  finally{busy=false;for(const x of [refresh,company,service,order])x.disabled=false;}
 });
 company.addEventListener('change',()=>{epoch++;service.replaceChildren();order.replaceChildren();result.replaceChildren();note('Company changed; refresh owner source.');});
 service.addEventListener('change',()=>{epoch++;order.replaceChildren();result.replaceChildren();note('Service changed; refresh Jobs directory.');});
 order.addEventListener('change',()=>{epoch++;result.replaceChildren();note('Order changed; refresh source costs.');});
 document.addEventListener('ywi:auth-changed',()=>{epoch++;clear();note('Owner session changed. Reauthenticate and refresh.');});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

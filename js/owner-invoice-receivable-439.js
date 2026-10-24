/* YW 439 — owner-only invoice-candidate and receivable source trace.
   Composes the existing independently owner-guarded 437 QC and 438 Finance
   reads. Neither this panel nor its review result authorizes a Finance write. */
(()=>{'use strict';
const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic'];
const labels=Object.freeze({landscape:'Landscaping / grounds',construction:'Construction / repairs',
 water_parks:'Water park maintenance',snow_removal:'Snow removal / de-icing',
 snow_plowing:'Snow plowing',septic:'Septic haulage'});
const valid=x=>typeof x==='string'&&x.trim().length>0;
const money=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&
 Number.isSafeInteger(Math.round(n*100));
const cents=n=>Math.round(n*100);
const sameMoney=(a,b)=>money(a)&&money(b)&&Math.abs(cents(a)-cents(b))<=1;
const fail=reason=>({state:'withheld',reason,holds:[],billing_authorized:false,
 posting_authorized:false,collection_authorized:false,customer_contact_authorized:false});
const hold=(holds,reason,ref)=>holds.push({reason,ref:String(ref||'Original Jobs / Finance')});
const noWrite=Object.freeze({billing_authorized:false,posting_authorized:false,
 collection_authorized:false,customer_contact_authorized:false});
function sameDirectory(q,f,companyId){
 // Detail responses carry the same bounded directory with a selected order;
 // validate that directory shape while the inspectors below validate the
 // *unmodified* detail response and its original selected identity.
 const directory=d=>d?.work_order_id===null?d:{...d,work_order_id:null,state:'choose_order'};
 const a=window.YWI437?.inspectDirectory?.(directory(q),companyId);
 const b=window.YWI438?.inspectDirectory?.(directory(f),companyId);
 if(a?.state!=='review'||b?.state!=='review'||a.orders.length!==b.orders.length||
  a.orders.some((x,i)=>Object.keys(x).some(k=>x[k]!==b.orders[i]?.[k])))
  return fail('Two original owner Jobs directories disagree, are inaccessible or exceed their caps');
 return {state:'review',orders:a.orders,...noWrite};
}
function inspect(q,f,{companyId,workOrderId,serviceKey}){
 if(!valid(companyId)||!valid(workOrderId)||!keys.includes(serviceKey)||
  !window.YWI437?.inspect||!window.YWI438?.inspect)return fail('Owner review dependencies unavailable');
 const directory=sameDirectory(q,f,companyId);
 if(directory.state!=='review')return directory;
 const order=directory.orders.find(x=>x.id===workOrderId);
 if(!order||order.service!==serviceKey||!valid(order.number))return fail('Original Jobs order/service mismatch');
 const qc=window.YWI437.inspect(q,{companyId,workOrderId,serviceKey});
 const finance=window.YWI438.inspect(f,{companyId,workOrderId,serviceKey});
 if(qc.state==='withheld'||finance.state==='withheld')
  return fail('QC, Jobs or Finance original source is foreign, malformed, duplicated or capped');
 if(!['review','hold'].includes(qc.state)||!['review','hold'].includes(finance.state))
  return fail('Original QC or Finance source evaluation unavailable');
 const wo=f.order,co=q.closeout,candidates=f.invoice_candidates,postings=f.invoice_postings,
  invoices=f.ar_invoices,holds=[];
 if(!wo||wo.id!==workOrderId||!Array.isArray(candidates)||!Array.isArray(postings)||
  !Array.isArray(invoices))return fail('Original invoice lineage missing or belongs to another job');
 if(qc.state!=='review')for(const h of qc.holds)hold(holds,h.reason,h.ref);
 if(!co||co.invoice_readiness_status!=='ready')
  hold(holds,'Owner-reviewed closeout has not recorded invoice readiness',co?.id||wo.id);
 if(!['approved','released','completed'].includes(wo.approval_status))
  hold(holds,'Original Jobs price is not independently approved',wo.id);
 if(!f.estimate||f.estimate.id!==wo.estimate_id||
  f.estimate.approval_status!=='approved'||!valid(f.estimate.approved_at))
  hold(holds,'Original estimate has no dated approval linked to this work order',wo.id);
 if(candidates.length!==1)
  hold(holds,candidates.length?'Multiple invoice candidates require individual Finance reconciliation':'No original invoice candidate exists',wo.id);
 if(postings.length>1||invoices.length>1)
  hold(holds,'Multiple posting/AR documents need separate reversal or credit review; never combine balances',wo.id);
 const candidate=candidates.length===1?candidates[0]:null;
 const posting=postings.length===1?postings[0]:null;
 const ar=invoices.length===1?invoices[0]:null;
 if(candidate){
  if(candidate.work_order_id!==workOrderId||candidate.estimate_id!==wo.estimate_id)
   return fail('Invoice candidate is not linked to the original approved Jobs/estimate identity');
  if(!money(candidate.subtotal)||!money(candidate.tax_total)||!money(candidate.total_amount)||
   cents(candidate.subtotal)<=0||!sameMoney(candidate.subtotal+candidate.tax_total,candidate.total_amount))
   return fail('Original invoice candidate amount is malformed or does not reconcile');
  if(candidate.candidate_status==='draft'||candidate.candidate_status==='rejected')
   hold(holds,'Original candidate is draft/rejected; no billing-ready candidate',candidate.id);
  if(candidate.candidate_status!=='posted'&&(posting||ar))
   hold(holds,'Finance posting/AR exists while candidate is not posted; manual reconciliation required',candidate.id);
  if(candidate.candidate_status==='posted'){
   if(!posting||posting.invoice_candidate_id!==candidate.id||posting.posting_status!=='posted'||
    !valid(posting.posted_at))hold(holds,'Posted candidate has no single dated original Finance posting',candidate.id);
   if(!ar||posting?.ar_invoice_id!==ar.id)
    hold(holds,'Posted candidate has no matching unique original AR invoice receipt',candidate.id);
  }
  if(ar&&!sameMoney(candidate.total_amount,ar.total_amount))
   hold(holds,'Original invoice candidate amount differs from AR document',candidate.id);
 }
 if(posting&&(!candidates.some(c=>c.id===posting.invoice_candidate_id)||
   posting.candidate_work_order_id!==workOrderId))
  return fail('Orphaned or foreign Finance posting cannot be attributed to this Jobs order');
 if(ar){
  if(ar.work_order_id!==workOrderId||!['issued','partial','paid','overdue'].includes(ar.invoice_status))
   hold(holds,'AR document is foreign, draft, void, cancelled or has unverified status',ar.id);
  if(!['subtotal','tax_total','total_amount','amount_paid','balance_due'].every(k=>money(ar[k]))||
   !sameMoney(ar.subtotal+ar.tax_total,ar.total_amount)||
   !sameMoney(ar.amount_paid+ar.balance_due,ar.total_amount))
   hold(holds,'AR subtotal, tax, payments and balance do not reconcile',ar.id);
  if(ar.invoice_status==='paid'&&cents(ar.balance_due)>0)
   hold(holds,'AR says paid but a positive receivable remains',ar.id);
 }
 // A REVIEW state reports *read evidence only*. It never posts or collects.
 return {state:holds.length?'hold':'review',...noWrite,company_id:companyId,
  work_order_id:workOrderId,service:serviceKey,label:labels[serviceKey],order:order.number,
  qc_status:qc.qc_status,closeout_status:qc.closeout_status,
  invoice_readiness:co?.invoice_readiness_status||'missing',
  candidate: candidate?{id:candidate.id,status:candidate.candidate_status,
   total:candidate.total_amount}:null,
  posting:posting?{id:posting.id,status:posting.posting_status,
   dated:valid(posting.posted_at),ar_invoice_id:posting.ar_invoice_id}:null,
  receivable:ar?{id:ar.id,status:ar.invoice_status,total:ar.total_amount,
   amount_paid:ar.amount_paid,balance_due:ar.balance_due}:null,
  counts:{candidates:candidates.length,postings:postings.length,ar:invoices.length},holds,
  review:'Source-only owner reconciliation. REVIEW means no missing evidence in two bounded reads, not billing eligibility, invoice authorization, posting, collection or a customer charge.'};
}
window.YWI439=Object.freeze({labels,sameDirectory,inspect});
const node=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);return n;};
function mount(){
 const host=document.getElementById('admin');if(!host||document.getElementById('owner439'))return;
 const panel=node('details');panel.id='owner439';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Owner Invoice Candidate and Receivable Trace';
 panel.dataset.adminHubGroups='management operations finance jobs';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.append(node('summary','439 · Owner-Gated Invoice Candidate & Receivable Trace'));
 const body=node('div');body.className='admin-panel-block';
 body.append(node('p','Inspect approved QC and closeout alongside the original invoice candidate, Finance posting and receivable for one real service job. This is a read-only owner review; no billing, collection or customer message is sent.'));
 const help=node('a','ⓘ Invoice and receivable Help');help.href='/help.html#owner-invoice-receivable-439';body.append(help);
 const fields=node('div');fields.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px;min-width:0';
 const picker=(caption,id)=>{const label=node('label',caption),select=node('select');select.id=id;
  select.style.cssText='display:block;width:100%;min-width:0;max-width:100%;box-sizing:border-box';
  label.append(select);fields.append(label);return select;};
 const company=picker('Verified owner company','owner439Company');
 const service=picker('Original service offering','owner439Service');
 const order=picker('Original Jobs work order','owner439Order');body.append(fields);
 const refresh=node('button','Trace original invoice and receivable');refresh.type='button';
 refresh.className='secondary';refresh.id='owner439Refresh';body.append(refresh);
 const status=node('p','Authenticate as the company owner and refresh.');status.id='owner439Status';
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const result=node('div');result.id='owner439Results';
 result.style.cssText='display:grid;gap:12px;max-width:100%;min-width:0;overflow-wrap:anywhere';body.append(result);
 panel.append(body);host.append(panel);
 let session=null,epoch=0,busy=false;
 const note=s=>{status.textContent=s;};
 const clear=()=>{session=null;company.replaceChildren();service.replaceChildren();order.replaceChildren();result.replaceChildren();};
 const options=(select,rows,title,placeholder)=>{select.replaceChildren();const empty=node('option',placeholder);
  empty.value='';select.append(empty);for(const r of rows){const opt=node('option',title(r));opt.value=r.id;select.append(opt);}};
 async function identity(){const state=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(!state?.isAuthenticated||!state.user?.id||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)
   throw Error('Authenticated company-owner identity required');
  const u=await sb.auth.getUser();if(u.error||u.data?.user?.id!==state.user.id)
   throw Error('Owner identity differs from verified Supabase session');
  return {uid:state.user.id,sb};}
 const rpc=async(sb,name,companyId,workOrderId)=>{const r=await sb.rpc(name,
  {p_company_id:companyId,p_work_order_id:workOrderId});
  if(r.error||!r.data)throw Error('Original owner-guarded QC / Finance sources inaccessible');
  return r.data;};
 function render(r){result.replaceChildren();if(r.state==='withheld'){note('WITHHELD: '+r.reason);return;}
  note(r.state.toUpperCase()+' · '+r.label+' · '+r.order+' · manual Finance authority required');
  const add=(title,items,group)=>{const card=node('section');card.className='notice';
   card.dataset.owner439Group=group;
   card.style.cssText='border:1px solid #64748b;border-radius:10px;padding:12px;min-width:0;overflow-wrap:anywhere';
   card.append(node('h3',title));const ul=node('ul');for(const item of items)ul.append(node('li',item));
   card.append(ul);result.append(card);};
  const amount=n=>money(n)?'$'+n.toFixed(2):'unverified';
  add('Original owner and closeout review',[
   'Independent QC review: '+r.qc_status,'Supervisor closeout: '+r.closeout_status,
   'Original invoice readiness flag: '+r.invoice_readiness,
   'Human invoice and payment decisions remain outside this screen.'],'qc');
  add('One-to-one original Finance lineage',[
   `Candidates: ${r.counts.candidates} · ${r.candidate?.status||'none'} · ${amount(r.candidate?.total)}`,
   `Posting receipts: ${r.counts.postings} · ${r.posting?.status||'none'} · dated: ${r.posting?.dated?'yes':'unverified'}`,
   `AR invoices: ${r.counts.ar} · ${r.receivable?.status||'none'} · original total: ${amount(r.receivable?.total)}`,
   `Recorded payments: ${amount(r.receivable?.amount_paid)} · receivable balance: ${amount(r.receivable?.balance_due)}`,
   'Multiple candidates, credits or invoices are not summed into a fabricated balance.'],'lineage');
  add('Manual evidence gates · '+r.holds.length,
   r.holds.length?r.holds.map(h=>h.ref+': '+h.reason):['No missing source detected. Human Finance authorization is still mandatory.'],'holds');
  result.append(node('p',r.review));}
 async function load(){const start=epoch,current=await identity();
  const fresh=()=>start===epoch&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&
   window.YWI_AUTH?.getState?.()?.user?.id===current.uid&&(!session||session.uid===current.uid);
  const assertFresh=()=>{if(!fresh())throw Error('Owner session changed during source read');};
  assertFresh();if(!session||session.uid!==current.uid){clear();session=current;}
  const saved=[company.value,service.value,order.value];
  const r=await current.sb.from('ywi_companies').select('id,name,owner_user_id')
   .order('created_at',{ascending:true}).limit(101);assertFresh();
  if(r.error||!Array.isArray(r.data)||r.data.length>100||new Set(r.data.map(x=>x.id)).size!==r.data.length||
   r.data.some(c=>!valid(c.id)||!valid(c.name)||c.owner_user_id!==current.uid))
   throw Error('Original owner companies are foreign, duplicated, missing or over cap');
  options(company,r.data,x=>x.name,'Choose owner company');
  if(r.data.some(x=>x.id===saved[0]))company.value=saved[0];
  else if(r.data.length===1)company.value=r.data[0].id;
  if(!company.value){service.replaceChildren();order.replaceChildren();result.replaceChildren();note('Choose owner company and refresh.');return;}
  const companyId=company.value;
  const [qd,fd]=await Promise.all([
   rpc(current.sb,'ywi_rpc_quality_customer_handoff_437',companyId,null),
   rpc(current.sb,'ywi_rpc_job_cost_provenance_438',companyId,null)]);assertFresh();
  const dir=sameDirectory(qd,fd,companyId);if(dir.state!=='review')throw Error(dir.reason);
  options(service,keys.map(id=>({id})),x=>labels[x.id],'Choose one service');
  if(keys.includes(saved[1]))service.value=saved[1];
  if(!service.value){order.replaceChildren();result.replaceChildren();note('Choose original service and refresh.');return;}
  const orders=dir.orders.filter(x=>x.service===service.value);
  options(order,orders,x=>x.number+' · '+x.status,'Choose original Jobs order');
  if(orders.some(x=>x.id===saved[2]))order.value=saved[2];
  else if(orders.length===1)order.value=orders[0].id;
  if(!order.value){result.replaceChildren();note(orders.length?'Select original work order and refresh.':'HOLD: No original Jobs order for this service.');return;}
  const workOrderId=order.value,serviceKey=service.value;
  const [q,f]=await Promise.all([
   rpc(current.sb,'ywi_rpc_quality_customer_handoff_437',companyId,workOrderId),
   rpc(current.sb,'ywi_rpc_job_cost_provenance_438',companyId,workOrderId)]);
  if(!fresh()||company.value!==companyId||service.value!==serviceKey||order.value!==workOrderId)
   throw Error('Owner session or selected Jobs identity changed during read');
  render(inspect(q,f,{companyId,workOrderId,serviceKey}));}
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;
  for(const x of [refresh,company,service,order])x.disabled=true;
  try{await load();}catch(e){clear();note('WITHHELD: '+(e?.message||e)+'. No business mutation occurred.');}
  finally{busy=false;for(const x of [refresh,company,service,order])x.disabled=false;}});
 company.addEventListener('change',()=>{epoch++;service.replaceChildren();order.replaceChildren();result.replaceChildren();note('Company changed; refresh original sources.');});
 service.addEventListener('change',()=>{epoch++;order.replaceChildren();result.replaceChildren();note('Service changed; refresh Jobs order directory.');});
 order.addEventListener('change',()=>{epoch++;result.replaceChildren();note('Jobs order changed; refresh original Finance lineage.');});
 document.addEventListener('ywi:auth-changed',()=>{epoch++;clear();note('Owner session changed. Reauthenticate and refresh.');});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

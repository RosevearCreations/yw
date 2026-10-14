/* Build 398 — material reconciliation: advisory, no inventory or Finance mutation. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
function assess(material){
  const issues=[],onHand=numeric(material.stock_on_hand),unit=String(material.unit_code||'').trim();
  if(!unit)issues.push('Canonical stock unit missing — conversion and reconciliation withheld');
  if(onHand===null)issues.push('Authoritative stock quantity unavailable');
  else if(onHand<0)issues.push('Negative recorded stock: investigate before any further issue');
  if(material.inventory_tracked===false)issues.push('Material is not stock tracked');
  if(material.current_unit_cost==null)issues.push('Current unit cost withheld or unknown — cost comparison unavailable');
  if(numeric(material.usage_variance_quantity)!==null && numeric(material.usage_variance_quantity)!==0)issues.push('Recorded usage variance requires review');
  if(material.stock_status==='shortage'||material.stock_status==='out_of_stock')issues.push('Stock shortage indicated');
  return {state:issues.length?'REVIEW / UNVERIFIED':'STOCK SNAPSHOT ONLY — job-level match unverified',issues};
}
function init(){
 const admin=$('admin');if(!admin||$('materialReconcile398'))return;
 const el=document.createElement('details');el.id='materialReconcile398';el.className='admin-hub-detail';el.dataset.adminHubGroups='operations';el.dataset.adminHubTitle='Material issue and return reconciliation';
 el.innerHTML='<summary>Build 398 · Material Issue &amp; Return Reconciliation</summary><div class="admin-panel-block"><p>Read-only canonical stock snapshot and exceptions. Plan lines, actual-use evidence, job issue/return receipts and per-transaction audit provenance must be checked in their authorized source modules; aggregate stock totals do not prove a job was reconciled. Returns, receipts, purchasing, corrections and stock movement are never triggered here.</p><button type="button" class="secondary" id="material398Refresh">Recheck material stock evidence</button><p id="material398Status" role="status" aria-live="polite">No current evidence retrieved.</p><div id="material398Rows"></div></div>';
 admin.appendChild(el);let busy=false;
 $('material398Refresh').onclick=async()=>{
 if(busy)return;busy=true;const button=$('material398Refresh'),status=$('material398Status'),rows=$('material398Rows');button.disabled=true;button.textContent='Checking…';rows.replaceChildren();
 try{
  const api=window.YWIAPI;if(typeof api?.fetchJobsDirectory!=='function')throw Error('Authorized Jobs material source unavailable');
  const data=await api.fetchJobsDirectory({scope:'all'});
  if(data?.ok===false||!Array.isArray(data?.material_stock_control))throw Error(data?.error||'Canonical material stock source unavailable');
  const materials=data.material_stock_control;if(materials.length>=1500)throw Error('Material directory reached the query cap; completeness unverified');
  const issues=materials.map(m=>({m,result:assess(m)}));
  status.textContent=materials.length+' material(s) received · '+issues.filter(x=>x.result.issues.length).length+' stock exception(s) · job issue/return matching UNVERIFIED; no inventory changes.';
  rows.innerHTML=issues.length?issues.map(({m,result})=>'<div class="notice"><strong>'+esc(m.sku||m.item_name||m.id)+'</strong> · '+esc(result.state)+'<p>On hand: '+esc(m.stock_on_hand??'unknown')+' '+esc(m.unit_code||'unit unknown')+' · unit cost: '+esc(m.current_unit_cost??'restricted')+'</p>'+result.issues.map(i=>'<p>'+esc(i)+'</p>').join('')+'</div>').join(''):'<p>No material rows available; no evidence of reconciliation is implied.</p>';
 }catch(e){status.textContent='BLOCKED / UNAVAILABLE: '+String(e?.message||e);}
 finally{busy=false;button.disabled=false;button.textContent='Recheck material stock evidence';}
 };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
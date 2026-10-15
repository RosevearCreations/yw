/* Build 401 — AR aging and payment exception review, no mutations. */
(()=>{'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('ar401'))return;
const el=document.createElement('details');el.id='ar401';el.className='admin-hub-detail';el.dataset.adminHubTitle='Receivables aging and payments';el.dataset.adminHubGroups='finance';
el.innerHTML='<summary>Build 401 · Receivables Aging &amp; Payment Reconciliation</summary><div class="admin-panel-block"><p>Internal Finance review only. Aging is calculated from recorded invoice due dates and balances; payment allocations require matching canonical application evidence. No payment, deposit allocation, collection, invoice posting, reminder, or provider mutation.</p><button id="ar401Refresh" class="secondary" type="button">Review receivables</button><p id="ar401Status" role="status" aria-live="polite">Not reviewed.</p><div id="ar401Rows"></div></div>';host.appendChild(el);const btn=document.getElementById('ar401Refresh'),status=document.getElementById('ar401Status'),output=document.getElementById('ar401Rows');let busy=false;
btn.onclick=async()=>{if(busy)return;busy=true;btn.disabled=true;output.replaceChildren();
try{const api=window.YWIAPI;if(typeof api?.loadAdminDirectory!=='function')throw Error('Finance directory unavailable');const data=await api.loadAdminDirectory({scope:'accounting_backbone'});
if(data?.ok===false||!Array.isArray(data?.ar_invoices)||!Array.isArray(data?.ar_payments)||!Array.isArray(data?.ar_payment_applications))throw Error(data?.error||'Canonical AR invoice, payment, or allocation source unavailable');
const invoices=data.ar_invoices,payments=data.ar_payments,applications=data.ar_payment_applications;
if([invoices,payments,applications].some(x=>x.length>=1500))throw Error('Finance source query cap reached: completeness unverified');
const today=Date.now(),ms=86400000;const rows=invoices.map(i=>{const balance=Number(i.balance_due),due=Date.parse(i.due_date||'');const invalid=!Number.isFinite(balance)||balance<0||!Number.isFinite(due);
const days=invalid?null:Math.max(0,Math.floor((today-due)/ms));const linked=applications.filter(a=>String(a.invoice_id||'')===String(i.id||''));const mismatch=linked.some(a=>!payments.some(p=>String(p.id||'')===String(a.payment_id||''))||!Number.isFinite(Number(a.applied_amount))||Number(a.applied_amount)<0);
return {i,balance,days,linked,mismatch,held:invalid||mismatch};});
status.textContent=rows.length+' receivables reviewed · '+rows.filter(x=>x.held).length+' blocked/unverified · '+rows.filter(x=>x.days>0&&x.balance>0).length+' overdue. No Finance writes.';
output.innerHTML=rows.map(({i,balance,days,linked,mismatch,held})=>'<div class="notice"><strong>'+esc(i.invoice_number||i.id)+'</strong> · '+esc(held?'HOLD / UNVERIFIED':days===null?'AGE UNKNOWN':days===0?'CURRENT':days<=30?'1–30 days':days<=60?'31–60 days':days<=90?'61–90 days':'90+ days')+'<p>Due '+esc(i.due_date||'unknown')+' · balance '+esc(Number.isFinite(balance)&&balance>=0?balance.toFixed(2):'restricted')+' · linked applications '+linked.length+'</p><p>'+esc(mismatch?'Missing payment source or invalid allocation: manual Finance reconciliation required.':'Payment totals and deposit allocation still require authorized Finance verification.')+'</p></div>').join('')||'<p>No invoices returned; zero balance is not implied.</p>';
}catch(e){status.textContent='BLOCKED / UNAVAILABLE: '+String(e?.message||e);}
finally{busy=false;btn.disabled=false;}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
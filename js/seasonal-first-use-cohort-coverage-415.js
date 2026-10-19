/* Build 415 — seasonal first-use coverage, read-only, no inferred denominators. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fresh=v=>{const n=Date.parse(String(v?.retrieved_at||''));return Number.isFinite(n)&&n<=Date.now()+300000&&Date.now()-n<=300000;};
const seasons={spring_summer:'Spring / Summer',fall:'Fall',winter:'Winter',four_season:'Four-season'};
const states={sample_supported:'Sample-supported first-use denominator',
  insufficient_sample:'WITHHELD: fewer than three fully linked first-use customer/property samples',
  linkage_gap_withheld:'WITHHELD: first-use/Workability linkage gaps'};
function mount(){
 const host=$('admin');if(!host||$('seasonal415'))return;
 const panel=document.createElement('details');panel.id='seasonal415';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Seasonal first-use cohort coverage';panel.dataset.adminHubGroups='operations jobs';
 panel.innerHTML='<summary>415 · Seasonal First-Use Cohort Coverage</summary><div class="admin-panel-block">'+
 '<p>Review first actual, dated Production starts by customer/property and seasonal service. CRM ownership, production field receipt, season cycle and same-day Workability observation must link. Cohorts require at least three records. Missing samples are not zero.</p>'+
 '<button type="button" id="seasonal415Recheck" class="secondary">Recheck seasonal first-use evidence</button> '+
 '<a href="/help.html#seasonal-first-use-cohort-415" aria-label="Help: seasonal first-use coverage">ⓘ Help</a>'+
 '<p id="seasonal415Status" role="status" aria-live="polite">Not checked.</p><div id="seasonal415Rows" style="display:grid;gap:10px;min-width:0;overflow-wrap:anywhere"></div></div>';
 host.appendChild(panel);let busy=false;
 $('seasonal415Recheck').addEventListener('click',async()=>{
  if(busy)return;busy=true;const button=$('seasonal415Recheck'),status=$('seasonal415Status'),out=$('seasonal415Rows');
  button.disabled=true;out.replaceChildren();status.textContent='Checking CRM, Production, season cycle and Workability completeness…';
  try{
   const api=window.YWIAPI;if(typeof api?.loadAdminDirectory!=='function')throw Error('Jobs source unavailable');
   const reply=await api.loadAdminDirectory({scope:'seasonal_first_use_cohort_coverage'});
   if(reply?.ok!==true)throw Error(reply?.error||'Access denied');
   const d=reply?.coverage_415;
   if(!d||d.complete!==true||!fresh(d)||!Array.isArray(d.cohorts)||d.state==='withheld'){
    status.textContent='WITHHELD: '+String(d?.reason||'Authorized complete seasonal sources not confirmed.');
    out.innerHTML='<p data-seasonal415-state="withheld">No first-use denominator inferred.</p>';return;
   }
   if(d.state==='no_record'){
    if(d.cohorts.length)throw Error('Inconsistent no-record state');
    status.textContent='No dated seasonal operating cycles in complete authorized source.';
    out.innerHTML='<p data-seasonal415-state="no_record">No zero or missing-season conclusions are assumed.</p>';return;
   }
   if(d.state!=='recorded'||d.cohorts.length>60||d.minimum_sample!==3)throw Error('Unexpected or capped seasonal sample');
   const approved=d.cohorts.filter(r=>r.coverage_state==='sample_supported'&&Number.isSafeInteger(r.first_use_denominator)&&r.first_use_denominator>=3);
   status.textContent=approved.length+' sample-supported cohort(s) among '+d.cohorts.length+' dated seasonal cycles. Read only.';
   out.innerHTML=d.cohorts.map(r=>{
    const valid=r.coverage_state==='sample_supported'&&Number.isSafeInteger(r.first_use_denominator)&&r.first_use_denominator>=3;
    const label=valid?'Verified first-use sample denominator: '+esc(r.first_use_denominator):
      'First-use denominator WITHHELD (never assume zero)';
    return '<article class="notice" data-seasonal415-state="'+(valid?'supported':'held')+'" style="min-width:0;overflow-wrap:anywhere">'+
     '<strong>'+esc(seasons[r.season_context]||'Unknown season')+' · '+esc(r.season_year)+'</strong>'+
     '<p>Service: '+esc(r.service_context||'Not verified')+'</p>'+
     '<p><strong>'+label+'</strong></p>'+
     '<p>'+esc(states[r.coverage_state]||'WITHHELD: unknown evidence state')+'</p>'+
     (valid?'<p>First actual starts: '+esc(r.first_use_date_min)+' – '+esc(r.first_use_date_max)+'</p>':'')+
     '<p>Distinct customer/property within this cycle, not total customers or productivity. No staff ranking, performance attribution or Workability override.</p></article>';
   }).join('');
  }catch(e){status.textContent='BLOCKED / UNAVAILABLE: '+String(e?.message||e);out.replaceChildren();}
  finally{busy=false;button.disabled=false;}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
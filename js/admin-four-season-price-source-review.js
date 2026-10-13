/* Build 393 — read-only four-season service price source validation. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const seasons=[['spring_summer','Spring / summer'],['fall','Fall cleanup'],['winter','Winter snow / ice'],['four_season','Four season']];
const classify=t=>{const s=[t.template_name,t.template_code,t.job_family,t.project_scope,t.service_pattern].join(' ').toLowerCase();
if(/snow|plow|ice|salt|winter|storm/.test(s))return 'winter';
if(/leaf|leaves|fall|autumn/.test(s))return 'fall';
if(/mow|lawn|landscap|garden|spring|summer|mulch/.test(s))return 'spring_summer';
return 'four_season';};
function evaluate(t,taxes){
 const issues=[];const charge=Number(t.default_quoted_charge_total);
 if(t.default_quoted_charge_total==null||!Number.isFinite(charge)||charge<=0)issues.push('Missing or non-positive recorded charge; not approved for quoting');
 if(!t.default_pricing_method)issues.push('Pricing method not recorded');
 if(!t.default_estimated_visit_minutes&&!t.default_estimated_duration_hours&&!t.default_estimated_duration_days)issues.push('Duration/unit basis not recorded');
 const tax=taxes.find(x=>String(x.id)===String(t.sales_tax_code_id));
 if(!tax)issues.push('Sales tax source missing or unavailable');
 else if(tax.is_active===false||!['sale','both'].includes(tax.applies_to))issues.push('Sales tax code inactive or not sale-applicable');
 return {issues,tax};
}
function start(){
 const admin=$('admin');if(!admin||$('pricingReview393'))return;
 const box=document.createElement('details');box.id='pricingReview393';box.className='admin-hub-detail';box.dataset.adminHubTitle='Four-season price source validation';box.dataset.adminHubGroups='operations';
 box.innerHTML='<summary>Build 393 · Four-Season Service Template &amp; Price Source Validation</summary><div class="admin-panel-block"><p>Read-only inspection of authorized service pricing templates, recorded unit/duration basis and Canadian tax configuration. No rates are invented, applied or published.</p><label>Season <select id="pricing393Season">'+seasons.map(([v,n])=>'<option value="'+v+'">'+n+'</option>').join('')+'</select></label> <button type="button" id="pricing393Refresh" class="secondary">Review current sources</button><div id="pricing393Status" role="status" aria-live="polite" class="notice">Select Review current sources to load current authorized records.</div><div id="pricing393Results"></div></div>';
 admin.appendChild(box);
 const status=$('pricing393Status'),results=$('pricing393Results'),button=$('pricing393Refresh'),select=$('pricing393Season');
 let data=null,busy=false;
 function render(){
 if(!data)return;
 const rows=data.service_pricing_templates.filter(t=>classify(t)===select.value&&t.is_active!==false);
 const taxes=data.tax_codes;const settings=data.business_tax_settings;
 const activeSale=taxes.filter(t=>t.is_active!==false&&['sale','both'].includes(t.applies_to));
 const configIssues=[];
 if(!settings.length)configIssues.push('No accessible business tax profile');
 if(!activeSale.length)configIssues.push('No active sale-applicable tax code');
 if(settings.some(t=>!t.currency_code||!t.province_code))configIssues.push('Business currency/province configuration incomplete');
 const reviewed=rows.map(t=>({t,...evaluate(t,taxes)}));
 const problems=reviewed.filter(x=>x.issues.length).length;
 status.textContent=rows.length+' recorded template(s) for '+select.options[select.selectedIndex].text+'; '+problems+' require price/source review.'+(configIssues.length?' Tax configuration needs attention.':'');
 results.innerHTML='<p><strong>Tax context:</strong> '+esc(settings.map(t=>[t.profile_name,t.province_code,t.currency_code].filter(Boolean).join(' · ')).join('; ')||'Unavailable')+' · '+esc(activeSale.map(t=>t.code+' ('+t.rate_percent+'%)').join(', ')||'No verified active sale code')+'</p>'+
 (configIssues.length?'<p class="notice">'+configIssues.map(esc).join('; ')+'</p>':'')+
 (rows.length?'<div class="admin-backbone-grid">'+reviewed.map(({t,issues,tax})=>'<div class="notice"><strong>'+esc(t.template_name||t.template_code)+'</strong><br><small>Recorded charge: '+(Number.isFinite(Number(t.default_quoted_charge_total))?esc(t.default_quoted_charge_total):'Missing')+' '+esc(settings[0]?.currency_code||'currency unverified')+' · Pricing: '+esc(t.default_pricing_method||'missing')+' · Basis: '+esc(t.default_estimated_visit_minutes||t.default_estimated_duration_hours||t.default_estimated_duration_days||'missing')+' (recorded duration/visit units) · Tax: '+esc(tax?.code||'unavailable')+'</small><br>'+ (issues.length?'<strong>Review required:</strong> '+issues.map(esc).join('; '):'Source fields present; commercial approval still required')+'</div>').join('')+'</div>':'<p class="notice">No recorded templates for this season. Configure and approve a canonical template before quoting; no default rate is assumed.</p>');
 }
 select.addEventListener('change',render);
 button.addEventListener('click',async()=>{
 if(busy)return;busy=true;button.disabled=true;button.textContent='Checking…';status.textContent='Loading authoritative Jobs directory…';
 try{
 const api=window.YWIAPI;
 if(typeof api?.fetchJobsDirectory!=='function')throw Error('Jobs directory unavailable or not authorized');
 const response=await api.fetchJobsDirectory({scope:'all'});
 if(response?.ok===false)throw Error(response.error||'Access denied');
 if(!Array.isArray(response?.service_pricing_templates)||!Array.isArray(response?.tax_codes)||!Array.isArray(response?.business_tax_settings))throw Error('Required price/tax sources are not available; review withheld');
 data=response;render();
 }catch(e){data=null;results.textContent='';status.textContent='Review unavailable: '+String(e?.message||e)}
 finally{busy=false;button.disabled=false;button.textContent='Review current sources'}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

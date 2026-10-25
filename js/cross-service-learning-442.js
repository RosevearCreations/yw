/* YW 442 — original first Jobs source-coverage comparison only; no conversions,
   completion, invoices, ROI, payroll decision or live trial acceptance inferred. */
(()=>{'use strict';
const keys=Object.freeze(['landscape','construction','water_parks','snow_removal','snow_plowing','septic']);
const labels=Object.freeze({landscape:'Lawn & Grounds',construction:'Light Construction',
 water_parks:'Aquatic Facilities',snow_removal:'Snow Removal',snow_plowing:'Snow Plowing',septic:'Septic'});
const counts=Object.freeze(['first_jobs','verified_customer_site','unlinked_original_jobs',
 'dispatch_present','production_present','execution_proof_present','qc_present',
 'invoice_present','specialist_receipt_present']);
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const locked=Object.freeze({comparison_accepted:false,roi:null,employee_ranking:null,
 causal_improvement:null,mutation_authorized:false,first_job_completion_authorized:false,
 invoice_authorized:false,payroll_authorized:false});
const withheld=reason=>({state:'withheld',reason,services:[],...locked});
function inspect(d,{companyId,now=Date.now()}={}){
 const pp=d?.periods?.previous,cp=d?.periods?.current;
 const ts=v=>typeof v==='string'?Date.parse(v):NaN;
 if(!uuid(companyId)||!d||d.company_id!==companyId||d.owner_guard!=='ywi_422_assert_owner'||
  d.privacy_minimized!==true||d.synthetic!==false||d.capped!==false||
  d.source_coverage!=='complete'||d.max_original_jobs!==2000||
  !Number.isInteger(d.total_company_jobs)||d.total_company_jobs<0||d.total_company_jobs>2000||
  d.minimum_per_service_period!==10||d.comparison_accepted!==false||
  d.roi!==null||d.employee_ranking!==null||d.causal_improvement!==null||
  d.mutation_authorized!==false||!Array.isArray(d.services)||d.services.length!==6||
  new Set(d.services.map(x=>x.service)).size!==6||!d.services.every(x=>keys.includes(x.service))||
  !Number.isFinite(ts(d.captured_at))||!Number.isFinite(now)||
  ts(d.captured_at)>now+60000||now-ts(d.captured_at)>5*60000||
  ![pp?.start,pp?.end,cp?.start,cp?.end].every(x=>Number.isFinite(ts(x)))||
  ts(pp.end)!==ts(cp.start)||ts(pp.end)-ts(pp.start)!==14*86400000||
  ts(cp.end)-ts(cp.start)!==14*86400000||ts(cp.end)>now||
  now-ts(cp.end)>86400000+60000)
  return withheld('Owner identity, complete six-service source, capture freshness or two contiguous 14-day UTC windows unverified');
 let firstTotal=0;
 for(const s of d.services){
  if(typeof s.enabled!=='boolean')return withheld('Service switch state missing');
  for(const period of [s.previous,s.current]){
   if(!period||!counts.every(k=>Number.isInteger(period[k])&&period[k]>=0&&period[k]<=2000)||
    counts.filter(k=>k.endsWith('_present')||k==='verified_customer_site')
     .some(k=>period[k]>period.first_jobs)||
    period.unlinked_original_jobs>d.total_company_jobs)
    return withheld('Original Jobs or source counts malformed, excessive or impossible');
   firstTotal+=period.first_jobs;
  }
 }
 if(firstTotal>d.total_company_jobs)return withheld('First Jobs counts exceed original company Jobs population');
 const services=d.services.map(s=>{
  const p=s.previous,c=s.current;
  const reasons=[];
  if(!s.enabled)reasons.push('Offering is currently OFF; historical sources are preserved but new work is blocked.');
  if(p.unlinked_original_jobs||c.unlinked_original_jobs||
   p.verified_customer_site!==p.first_jobs||c.verified_customer_site!==c.first_jobs)
   reasons.push('At least one original Jobs record lacks a verified company-owned customer and property.');
  if(p.first_jobs<10||c.first_jobs<10)reasons.push('Fewer than ten original first-customer Jobs in one or both periods.');
  const descriptive=reasons.length===0;
  return {key:s.service,label:labels[s.service],enabled:s.enabled,
   state:descriptive?'descriptive_source_presence_only':'hold',
   reason:descriptive?'Descriptive source-presence counts only; differing follow-up time forbids causal/conversion claims.':reasons.join(' '),
   previous:{...p},current:{...c},...locked};
 });
 const any=services.some(s=>s.state==='descriptive_source_presence_only');
 return {state:any?'partial_descriptive_source_presence_only':'hold',
  company_id:companyId,captured_at:d.captured_at,periods:d.periods,
  services,reason:any?'Source-presence counts only: no proven business improvement or staff performance.':
   'No service meets both periods\' verified, enabled, ten-first-Jobs gate. Real first-job outcome comparison is on HOLD.',
  tenant_isolated:true,privacy_minimized:true,...locked};
}
window.YWI442=Object.freeze({keys,labels,inspect});
const el=(tag,value)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=String(value);return e;};
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('owner442'))return;
 const panel=el('details');panel.id='owner442';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Production Learning VII — Six-Service Source Cohorts';
 panel.dataset.adminHubGroups='management operations safety jobs';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.append(el('summary','442 · Production Learning VII · Real Six-Service Source Review'));
 const body=el('div');body.className='admin-panel-block';
 body.append(el('p','Read-only, owner/company-scoped first-Jobs review for two completed UTC 14-day periods. We count original source presence separately for six services. First work, approved completion, invoice eligibility, ROI and employee performance must never be inferred from these counts.'));
 const help=el('a','ⓘ Cohort & company-admin test Help');help.href='/help.html#cross-service-learning-442';body.append(help);
 const bar=el('div');bar.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:10px;min-width:0';
 const label=el('label','Verified owner company');const company=el('select');company.id='owner442Company';
 company.style.cssText='width:100%;min-width:0;max-width:100%;box-sizing:border-box;display:block';label.append(company);bar.append(label);body.append(bar);
 const button=el('button','Refresh original company cohorts');button.type='button';button.id='owner442Refresh';button.className='secondary';body.append(button);
 const status=el('p','Authenticate as the actual company owner. No automatic comparison or first-job approval.');
 status.id='owner442Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const results=el('div');results.id='owner442Results';results.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,285px),1fr));gap:12px;min-width:0;overflow-wrap:anywhere';body.append(results);
 panel.append(body);host.append(panel);
 let epoch=0,uid=null,roster=[],busy=false;
 const clear=()=>{company.replaceChildren();results.replaceChildren();};
 const opts=(rows)=>{const prior=company.value;company.replaceChildren();const o=el('option','Choose owner company');o.value='';company.append(o);
  for(const item of rows){const q=el('option',item.name);q.value=item.id;company.append(q);}
  if(rows.some(x=>x.id===prior))company.value=prior;else if(rows.length===1)company.value=rows[0].id;};
 async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!a.user?.id||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)
   throw Error('Verified company-owner sign-in required');
  const response=await sb.auth.getUser();if(response.error||response.data?.user?.id!==a.user.id)
   throw Error('Supabase identity and active owner session mismatch');
  return{uid:a.user.id,sb};}
 const alive=(id,start)=>epoch===start&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&
  window.YWI_AUTH.getState().user?.id===id;
 function render(review){results.replaceChildren();
  if(review.state==='withheld'){status.textContent='WITHHELD: '+review.reason;return;}
  status.textContent=review.state.startsWith('partial')?'SOURCE COVERAGE ONLY — not owner trial acceptance':
   'HOLD — '+review.reason;
  for(const service of review.services){const c=el('article');c.className='notice';c.dataset.owner442Service=service.key;
   c.style.cssText='border:1px solid #64748b;border-radius:10px;padding:12px;box-sizing:border-box;min-width:0;overflow-wrap:anywhere';
   c.append(el('h3',service.label),el('strong',service.state==='hold'?'HOLD':'DESCRIPTIVE SOURCE ONLY'));
   c.append(el('p',service.reason));
   c.append(el('p','Previous first Jobs: '+service.previous.first_jobs+' · Current first Jobs: '+service.current.first_jobs));
   c.append(el('p','Original property links (previous/current): '+service.previous.verified_customer_site+'/'+service.current.verified_customer_site));
   c.append(el('p','Field receipts (previous/current): '+service.previous.specialist_receipt_present+'/'+service.current.specialist_receipt_present));
   c.append(el('p','Production, QC and invoice source PRESENCE (current): '+service.current.production_present+', '+service.current.qc_present+', '+service.current.invoice_present));
   results.append(c);}}
 async function load(){const start=epoch,s=await session();if(!alive(s.uid,start))throw Error('Owner session changed');
  if(uid!==s.uid){clear();uid=s.uid;roster=[];}
  if(!roster.length){const r=await s.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
   if(!alive(s.uid,start)||r.error||!Array.isArray(r.data)||r.data.length>100||
    new Set(r.data.map(c=>c.id)).size!==r.data.length||
    r.data.some(c=>!uuid(c.id)||!c.name||c.owner_user_id!==s.uid))
    throw Error('Incomplete or cross-company owner roster');
   roster=r.data;opts(roster);}
  if(!roster.length){results.replaceChildren();status.textContent='HOLD: no real owner companies. Yard Rosevear / Company Admin is a synthetic test fixture, not a live Auth account.';return;}
  if(!roster.some(c=>c.id===company.value)){status.textContent='Choose one original owner company before reading cohorts.';return;}
  const id=company.value,r=await s.sb.rpc('ywi_rpc_cross_service_learning_442',{p_company_id:id});
  if(!alive(s.uid,start)||company.value!==id||r.error||!r.data)throw Error('Owner-bound original cohort source denied or changed');
  render(inspect(r.data,{companyId:id,now:Date.now()}));}
 button.onclick=async()=>{if(busy)return;busy=true;button.disabled=company.disabled=true;
  try{await load();}catch(e){results.replaceChildren();status.textContent='WITHHELD: '+(e?.message||e)+'. No record was modified.';}
  finally{busy=false;button.disabled=company.disabled=false;}};
 company.onchange=()=>{epoch++;results.replaceChildren();status.textContent='Company changed; revalidate original owner sources.';};
 document.addEventListener('ywi:auth-changed',()=>{epoch++;uid=null;roster=[];clear();status.textContent='Owner session changed; source is cleared.';});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

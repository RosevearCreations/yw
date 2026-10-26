/* YW 454: read-only, owner-scoped acceptance of the live seven-module registry.
 * This is NOT a live cross-tenant penetration test or a Production deployment verdict.
 * Owner-only 420 RLS, 421 Jobs-create, 422 links and 443 RPC remain authoritative. */
(()=>{'use strict';
const keys=Object.freeze(['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture']);
const titles=Object.freeze({landscape:'Lawn & Grounds',construction:'Construction and Site Work',
 water_parks:'Aquatic Facilities',snow_removal:'Snow Removal',snow_plowing:'Snow Plowing',
 septic:'Septic Services',arboriculture:'Arboriculture & Tree Care'});
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const hold=reason=>({state:'withheld',reason,enabled:[],disabled:[],historicalRead:false,newWorkAuthorized:false});
function rosterOwned(rows,uid){return uuid(uid)&&Array.isArray(rows)&&rows.length<=100&&
 new Set(rows.map(x=>x.id)).size===rows.length&&rows.every(x=>uuid(x.id)&&x.owner_user_id===uid&&
 typeof x.name==='string'&&x.name.trim().length>=2);}
function inspect(source,{companyId,now=Date.now(),jobsAllowed=false}={}){
 const menu=source?.menu,registry=source?.registry,audit=source?.audit,receipts=source?.receipts;
 const t=Date.parse(menu?.captured_at);
 if(!uuid(companyId)||source?.company_id!==companyId||jobsAllowed!==true||
 !menu||menu.company_id!==companyId||menu.owner_guard!=='ywi_422_assert_owner'||
 menu.jobs_new_work_guard!=='ywi_421_assert_company_new_work'||
 menu.historical_audit_retained!==true||menu.privacy_minimized!==true||
 menu.synthetic!==false||menu.mutation_authorized!==false||
 !Number.isFinite(t)||!Number.isFinite(now)||t>now+60000||now-t>300000||
 !Array.isArray(menu.services)||menu.services.length!==keys.length||
 !Array.isArray(registry)||registry.length!==keys.length||
 !Array.isArray(audit)||audit.length>26||!Array.isArray(receipts)||receipts.length>80)
  return hold('Owner, fresh complete registry, historical source or Jobs access not verified');
 const validKeys=rows=>new Set(rows.map(r=>r.module_key)).size===keys.length&&
  rows.every(r=>r.company_id===companyId&&keys.includes(r.module_key)&&typeof r.enabled==='boolean');
 if(!validKeys(menu.services)||!validKeys(registry)||
  registry.some(r=>!Number.isFinite(Date.parse(r.created_at))||!Number.isFinite(Date.parse(r.updated_at))||
   menu.services.find(m=>m.module_key===r.module_key)?.enabled!==r.enabled))
  return hold('Live 420 registry differs from the independently authenticated 443 snapshot');
 const ids=new Set();
 for(const a of audit){
  if(a.company_id!==companyId||!keys.includes(a.module_key)||
   !['initialized','enabled','disabled'].includes(a.action)||typeof a.next_enabled!=='boolean'||
   !Number.isFinite(Date.parse(a.recorded_at))||ids.has(a.id))
   return hold('Company switch audit is foreign, duplicated or malformed');
  ids.add(a.id);
 }
 const newest=new Set();
 for(const a of audit){
  if(newest.has(a.module_key))continue;
  newest.add(a.module_key);
  if(registry.find(r=>r.module_key===a.module_key).enabled!==a.next_enabled)
   return hold('Latest sampled toggle audit and live switch disagree');
 }
 const receiptIds=new Set();
 for(const r of receipts){
  const key=r.target_table+':'+r.target_id;
  if(r.company_id!==companyId||!keys.includes(r.service_module_key)||
   !['estimates','work_orders'].includes(r.target_table)||!uuid(r.target_id)||
   !Number.isFinite(Date.parse(r.checked_at))||receiptIds.has(key))
    return hold('Historical Jobs/estimate receipt is foreign, duplicated or malformed');
  receiptIds.add(key);
 }
 const enabled=keys.filter(k=>registry.some(r=>r.module_key===k&&r.enabled));
 return {state:'verified_read_only',companyId,enabled,disabled:keys.filter(k=>!enabled.includes(k)),
  capturedAt:menu.captured_at,auditSample:audit.length,receiptSample:receipts.length,
  auditSampleCapped:audit.length===26,historicalRead:true,newWorkAuthorized:false,
  tenantScoped:true,liveForeignTenantDenialTested:false,releaseGreen:false};
}
window.YWI454=Object.freeze({keys,titles,inspect,rosterOwned});
const el=(tag,label)=>{const node=document.createElement(tag);if(label!==undefined)node.textContent=label;return node;};
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('owner454'))return;
 const panel=el('details');panel.id='owner454';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='PMS · Modular Acceptance';panel.dataset.adminHubGroups='management operations';
 panel.append(el('summary','454 · Modular Tenancy & Mobile Acceptance Workbench'));
 const body=el('div');body.className='admin-panel-block pms454';
 body.append(el('p','Verify seven service switches against two independent, owner-bound reads. Review a bounded historical audit and new-work receipt sample without writing or switching anything. This cannot approve field operations or certify the deployment.'));
 const help=el('a','ⓘ How to verify modules, history and mobile access');
 help.href='/help.html#pms-modular-production-acceptance-454';body.append(help);
 const controls=el('div');controls.className='pms454-controls';
 const label=el('label','Owner company');const company=el('select');company.id='pms454Company';
 const placeholder=el('option','Load owned companies first');placeholder.value='';company.append(placeholder);label.append(company);
 const run=el('button','Verify company source');run.type='button';run.id='pms454Run';run.className='secondary';
 controls.append(label,run);body.append(controls);
 const status=el('p','HOLD: sign in as the company owner and run the read-only verification.');
 status.id='pms454Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const matrix=el('div');matrix.id='pms454Matrix';matrix.setAttribute('aria-label','Company module ON and OFF audit');body.append(matrix);
 const history=el('p');history.id='pms454History';body.append(history);
 const release=el('p','Production release is NOT certified by this page. Compare the exact main SHA, required GitHub CI checks and Ready Vercel production deployment independently. Real owner/field acceptance remains HOLD.');
 release.id='pms454Release';release.className='notice';body.append(release);
 panel.append(body);host.append(panel);
 let epoch=0,uid=null,roster=[],busy=false;
 function wipe(message){matrix.replaceChildren();history.replaceChildren();status.textContent=message;}
 function invalidate(message){epoch++;uid=null;roster=[];company.replaceChildren();const p=el('option','Load owned companies first');p.value='';company.append(p);wipe(message);}
 function render(value){matrix.replaceChildren();history.replaceChildren();
  if(value.state!=='verified_read_only'){wipe('WITHHELD: '+value.reason);return;}
  status.textContent='VERIFIED SOURCE READ: '+value.enabled.length+' ON / '+value.disabled.length+' OFF. Navigation and new-work are separate authorizations.';
  const list=el('ul');list.className='pms454-module-list';
  for(const key of keys){const item=el('li');item.className='pms454-module';const name=el('strong',titles[key]);
   const state=el('span',value.enabled.includes(key)?'ON · entry shown':'OFF · no new work');
   state.dataset.pms454State=key;item.append(name,state);list.append(item);}
  matrix.append(list);
  history.textContent='Historical audit read: '+value.auditSample+' recent switch entries'+(value.auditSampleCapped?' (sample capped)':'')+
   '; '+value.receiptSample+' original Jobs/estimate gate receipts in this bounded read. Existing records were not changed. Empty source is not proof of completed field work.';
 }
 async function session(){const auth=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(auth?.isAuthenticated!==true||!uuid(auth.user?.id)||!sb?.auth?.getUser||!sb?.from||!sb?.rpc||
   !window.YWISecurity?.canViewModule?.('jobs',auth.role,'view'))throw Error('Verified owner with Jobs view permission required');
  const r=await sb.auth.getUser();if(r.error||r.data?.user?.id!==auth.user.id)throw Error('Owner session mismatch');
  return {sb,uid:auth.user.id,role:auth.role};}
 const alive=(id,start)=>start===epoch&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&
  window.YWI_AUTH.getState().user?.id===id;
 async function runAcceptance(){const start=epoch,ctx=await session();
  if(!alive(ctx.uid,start))throw Error('Session changed during verification');
  if(ctx.uid!==uid){uid=ctx.uid;roster=[];}
  if(!roster.length){const r=await ctx.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
   if(!alive(ctx.uid,start)||r.error||!rosterOwned(r.data,ctx.uid))throw Error('Owned-company list is missing, foreign or capped');
   roster=r.data;const prior=company.value;company.replaceChildren();const option=el('option','Choose company');option.value='';company.append(option);
   for(const c of roster){const opt=el('option',c.name);opt.value=c.id;company.append(opt);}
   if(roster.some(c=>c.id===prior))company.value=prior;else if(roster.length===1)company.value=roster[0].id;}
  if(!roster.length){wipe('HOLD: no registered owner company. Yard Rosevear is test-only and was not seeded in Production.');return;}
  const companyId=company.value;if(!roster.some(c=>c.id===companyId)){
   wipe('HOLD: select one of the verified owner companies and run again.');return;}
  const guarded=()=>alive(ctx.uid,start)&&company.value===companyId;
  const nav=await ctx.sb.rpc('ywi_rpc_pms_navigation_443',{p_company_id:companyId});
  if(!guarded()||nav.error||!nav.data)throw Error('Owner-only 443 navigation read was denied');
  const reg=await ctx.sb.from('ywi_company_service_modules').select('company_id,module_key,enabled,created_at,updated_at').eq('company_id',companyId).limit(8);
  if(!guarded()||reg.error)throw Error('Owner-only switch registry read was denied');
  const audits=await ctx.sb.from('ywi_company_service_module_audit').select('id,company_id,module_key,action,next_enabled,recorded_at').eq('company_id',companyId).order('id',{ascending:false}).limit(26);
  if(!guarded()||audits.error)throw Error('Owner-only switch audit read was denied');
  const jobs=await ctx.sb.from('ywi_new_work_gate_receipts_421').select('company_id,service_module_key,target_table,target_id,checked_at').eq('company_id',companyId).limit(81);
  if(!guarded()||jobs.error)throw Error('Historical Jobs receipt read was denied');
  // Two RPC snapshots fence concurrent owner switches; a changed toggle is never presented as current.
  const again=await ctx.sb.rpc('ywi_rpc_pms_navigation_443',{p_company_id:companyId});
  if(!guarded()||again.error||!again.data||
   JSON.stringify(nav.data.services)!==JSON.stringify(again.data.services))
   throw Error('Offering changed during verification; refresh');
  render(inspect({company_id:companyId,menu:again.data,registry:reg.data,audit:audits.data,receipts:jobs.data},
   {companyId,jobsAllowed:window.YWISecurity?.canViewModule?.('jobs',ctx.role,'view')===true}));
 }
 run.onclick=async()=>{if(busy)return;busy=true;run.disabled=company.disabled=true;
  wipe('Checking authenticated owner, module parity and bounded historical sources…');
  try{await runAcceptance();}catch(e){wipe('WITHHELD: '+(e?.message||e));}
  finally{busy=false;run.disabled=company.disabled=false;}};
 company.onchange=()=>{epoch++;wipe('HOLD: company selection changed; verify again.');};
 for(const name of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])
  document.addEventListener(name,()=>invalidate('HOLD: identity, permissions or service switches changed; reload company source.'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

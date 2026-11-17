/* YW580: nine real service-module identities in Tier 2, including Ponds/Skateparks.
 * Catalogue visibility does not equal company authorization. Read-only preview is
 * always available to signed-in company users; actual actions require original
 * YW579/YW443 owner proof or YW580 specialty RPC proof. */
(()=>{'use strict';
const KEYS=Object.freeze([
 ['landscape','Lawn & Grounds','owner449','today'],
 ['snow_removal','Snow Removal','owner450Snow','today'],
 ['snow_plowing','Snow Plowing','owner450Plow','today'],
 ['septic','Septic Services','owner451Septic','today'],
 ['arboriculture','Arboriculture / Tree Care','owner451Arbor','today'],
 ['construction','Construction','owner452Construction','today'],
 ['water_parks','Aquatic Facilities','owner426','today'],
 ['ponds','Custom Ponds','ponds','ponds'],
 ['skateparks','Skateparks','skateparks','skateparks']
]);
const SPEC=new Set(['ponds','skateparks']);
const $=id=>document.getElementById(id),doc=document.documentElement;
const el=(tag,txt)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;return n;};
const auth=()=>window.YWI_AUTH?.getState?.()||{};
const role=()=>auth().role||'employee';
const authorized=section=>window.YWISecurity?.canViewSection?.(section,role())===true;
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const platform=()=>doc.dataset.ywSurface==='platform'||location.hash==='#sysop';
const user=()=>auth().isAuthenticated===true&&uuid(auth().user?.id)&&!platform();
const owner=()=>user()&&window.YWIDualWorkspace?.snapshot?.()?.ownedCompanies>0;
const base=()=>window.YW579Navigation?.snapshot?.()||{};
const state={epoch:0,fetchKey:'',specialty:null,pending:false,selected:'',section:'overview',timer:null,observer:null};
const required=['ponds','skateparks'];
function inspectSpecialty(source,companyId,now=Date.now()){
 const t=Date.parse(source?.captured_at);
 if(!uuid(companyId)||source?.company_id!==companyId||
    source?.owner_guard!=='ywi_422_assert_owner'||source?.synthetic!==false||
    source?.mutation_authorized!==false||source?.privacy_minimized!==true||
    !Number.isFinite(t)||t>now+60000||now-t>240000||
    !Array.isArray(source.services)||source.services.length!==2||
    new Set(source.services.map(s=>s.module_key)).size!==2||
    source.services.some(s=>s.company_id!==companyId||!required.includes(s.module_key)||
     typeof s.enabled!=='boolean'))
  return Object.freeze({state:'HOLD',companyId:'',services:[]});
 return Object.freeze({state:'VERIFIED_NAVIGATION_ONLY',companyId,capturedAt:source.captured_at,
  services:source.services.map(x=>({key:x.module_key,enabled:x.enabled})),
  canBook:false,canWrite:false,canCharge:false});
}
function specialtyStatus(key,baseSnapshot){
 if(!owner()||baseSnapshot.verified!==true||!uuid(baseSnapshot.companyId))return 'unverified';
 if(state.specialty?.state!=='VERIFIED_NAVIGATION_ONLY'||state.specialty.companyId!==baseSnapshot.companyId||
    Date.now()-Date.parse(state.specialty.capturedAt)>240000)return 'unprovisioned';
 return state.specialty.services.find(s=>s.key===key)?.enabled===true?'on':'off';
}
function serviceStatus(key){
 const b=base();
 if(!user()||!owner()||b.verified!==true||!uuid(b.companyId))return 'unverified';
 if(SPEC.has(key))return specialtyStatus(key,b);
 return (b.enabledServices||[]).includes(key)?'on':'off';
}
function clearPrivate(){
 state.epoch++;state.specialty=null;state.fetchKey='';state.pending=false;
 state.selected='';state.section='overview';doc.removeAttribute('data-yw580-selected');
 const tools=$('yw580BlueprintTools');tools?.replaceChildren();
 const panel=$('yw580Blueprint');if(panel){panel.replaceChildren();panel.hidden=true;}
}
function isUsable(key){
 const b=base();
 return user()&&owner()&&b.verified===true&&uuid(b.companyId)&&
 serviceStatus(key)==='on'&&
 (!SPEC.has(key)||(state.specialty?.companyId===b.companyId&&
  state.specialty?.state==='VERIFIED_NAVIGATION_ONLY'))&&
 (SPEC.has(key)?authorized(key):window.YWISecurity?.canViewModule?.('jobs',role(),'view')===true);
}
function applySectionTools(key){
 const tools=$('yw580BlueprintTools');if(!tools)return;
 tools.replaceChildren();
 const tabs=[
  ['overview','Workflow'],
  ['quote','Quotes & scope'],
  ['evidence','Photos & evidence'],
  ['resources','Crew & materials'],
  ['maintenance','Maintenance'],
  ['finance','Finance & audit']
 ];
 for(const [k,label] of tabs){
  const b=el('button',label);b.type='button';b.dataset.yw580Tool=k;
  b.setAttribute('aria-pressed',String(state.section===k));
  b.addEventListener('click',()=>{state.section=k;applySectionTools(key);renderBlueprint(key);});
  tools.append(b);
 }
 tools.hidden=false;
}
function renderBlueprint(key){
 const host=$('yw580Blueprint');if(!host)return;
 const info=KEYS.find(x=>x[0]===key);if(!info){host.hidden=true;return;}
 const workflow=window.YW580Blueprints?.[key];
 host.replaceChildren();
 host.hidden=false;host.dataset.yw580Module=key;
 const header=el('div');header.className='yw580-blueprint-head';
 const h=el('div');h.append(el('p','YW580 / SERVICE WORKFLOW'),el('h2',info[1]));
 const badge=el('span',serviceStatus(key)==='on'?'ENABLED · VERIFIED':serviceStatus(key)==='off'?'DISABLED FOR COMPANY':'PREVIEW ONLY · UNVERIFIED');
 badge.className='yw580-blueprint-state';header.append(h,badge);host.append(header);
 host.append(el('p',workflow?.summary||'Module-specific work requires an owner-authorized company and original operational records.'));
 const block=el('div');block.className='yw580-blueprint-grid';
 const selected=state.section;
 const add=(title,items)=>{
  const article=el('article');article.append(el('h3',title));
  const list=el('ul');for(const item of items){list.append(el('li',item));}
  article.append(list);block.append(article);
 };
 if(selected==='overview'){
  add('Service delivery blueprint',workflow?.steps||[]);
  add('Shared cross-module touchpoints',workflow?.crossModule||[]);
 }else if(selected==='quote'){
  add('Scoped quote & original customer/job link',workflow?.quote||[]);
  add('Required authority',["Same verified company, customer and property IDs","An approved scope & service entitlement before new work","Never create a contract, job or deposit from this preview"]);
 }else if(selected==='evidence'){
  add('Photo and evidence requirements',workflow?.photos||[]);
  add('Original audit trail',["Job/service/source revision and photographer identity","Capture time, location provenance where consented, file hash","Consent, retention schedule, authorizing signature and review status"]);
 }else if(selected==='resources'){
  add('Crew, scheduling, equipment & materials',workflow?.resources||[]);
  add('Independent resource custody',["Use original dispatch/crew/stock records","Avoid double-booking labor or equipment across service modules","Record materials/labor by originating job and company"]);
 }else if(selected==='maintenance'){
  add('Lifecycle and recurring care',workflow?.maintenance||[]);
  add('Safe reminder boundaries',["Contract scope and renewal consent","Job-linked inspection, warranty, treatment history","No automated customer messaging or scheduling without authority"]);
 }else{
  add('Job financial lineage',workflow?.finance||[]);
  add('Independent controls',["Quote → approved work order → invoice → provider/bank settlement","Payroll/time, taxes, expenses and source-audited general ledger","Cross-module reference IDs, idempotency and separate financial approvals"]);
 }
 host.append(block);
 const foot=el('div');foot.className='yw580-blueprint-actions';
 const notice=el('p',isUsable(key)?
  'Company module is enabled. Existing screens still enforce their original Jobs, Safety, Finance and customer permissions.':
  'Structure preview only: company/entitlement verification or the specialty registry is not active. No customer data or new work is exposed.');
 notice.className='yw580-blueprint-disclaimer';foot.append(notice);
 if(isUsable(key)){
  const open=el('button','Open original service workspace');
  open.type='button';open.className='secondary';
  open.addEventListener('click',()=>{
   if(!isUsable(key))return;
   if(SPEC.has(key))window.YWIRouter?.showSection?.(key);
   else window.YW579Navigation?.choose?.(key);
  });
  foot.append(open);
 }
 host.append(foot);
}
function select(key){
 if(!KEYS.some(x=>x[0]===key)||!user())return;
 state.selected=key;state.section='overview';doc.dataset.yw580Selected=key;
 render();applySectionTools(key);renderBlueprint(key);
 if(isUsable(key)&&!SPEC.has(key))window.YW579Navigation?.choose?.(key);
}
function render(){
 const nav=$('yw580ServiceCatalog');if(!nav)return;
 const platformScope=platform();nav.replaceChildren();nav.hidden=!user()||platformScope;
 if(!user()||platformScope){const host=$('yw580Blueprint');if(host)host.hidden=true;return;}
 for(const [key,label] of KEYS){
  const status=serviceStatus(key);
  const b=el('button');b.type='button';b.dataset.yw580Service=key;
  b.dataset.yw580State=status;b.setAttribute('aria-pressed',String(state.selected===key));
  b.setAttribute('aria-label',label+' — '+(status==='on'?'enabled':status==='off'?'disabled':'not verified')+'; select workflow blueprint');
  b.append(el('strong',label),el('small',status==='on'?'Enabled':status==='off'?'Off':status==='unprovisioned'?'Setup required':'Verify company'));
  b.addEventListener('click',()=>select(key));nav.append(b);
 }
 const oldStatus=$('yw579ServiceStatus');
 if(oldStatus){
  const verified=base().verified===true;
  oldStatus.textContent=verified?
    'Selected company · original service entitlements checked; specialty availability is independently verified.':
    'Service catalogue visible · verify ownership to enable actual modules.';
 }
}
async function refreshSpecialty(){
 const b=base(),identity=auth().user?.id;
 if(!owner()||b.verified!==true||!uuid(b.companyId)){
  if(state.specialty||state.fetchKey){state.specialty=null;state.fetchKey='';}
  render();return;
 }
 const key=identity+'|'+b.companyId;
 if(key===state.fetchKey||state.pending){render();return;}
 state.epoch++;const token=state.epoch;state.fetchKey=key;state.specialty=null;state.pending=true;
 render();
 try{
  const sb=window.YWI_SB||window._sb;
  if(!sb?.rpc||!sb?.auth?.getUser)throw Error('Original specialty registry missing');
  const verified=await sb.auth.getUser();
  if(verified.error||verified.data?.user?.id!==identity)throw Error('Owner identity changed');
  const q=await sb.rpc('ywi_rpc_specialty_entitlements_580',{p_company_id:b.companyId});
  if(token!==state.epoch||auth().user?.id!==identity||base().companyId!==b.companyId)return;
  if(q.error||!q.data)throw Error('Specialty registration not provisioned');
  state.specialty=inspectSpecialty(q.data,b.companyId);
 }catch{if(token===state.epoch)state.specialty=null;}
 finally{if(token===state.epoch){state.pending=false;render();if(state.selected)renderBlueprint(state.selected);}}
}
function schedule(){
 if(state.timer)clearTimeout(state.timer);
 state.timer=setTimeout(()=>{state.timer=null;refreshSpecialty();},100);
}
function mount(){
 const tier=$('yw579ModuleTier')?.querySelector('.yw579-tier-content');
 if(!tier||$('yw580ServiceCatalog'))return;
 const btn=$('yw579RefreshServices');if(btn)tier.insertBefore(btn,$('yw579ServiceStatus'));
 const nav=el('nav');nav.id='yw580ServiceCatalog';
 nav.setAttribute('aria-label','All nine Yard Workers company service modules');
 tier.insertBefore(nav,$('yw579ServiceStatus'));
 const toolTier=$('yw579ToolsTier')?.querySelector('.yw579-tier-content');
 if(toolTier){const tools=el('nav');tools.id='yw580BlueprintTools';tools.hidden=true;
 tools.setAttribute('aria-label','Service workflow components');toolTier.append(tools);}
 const banner=document.querySelector('.slave-shell-banner');
 if(banner){const host=el('section');host.id='yw580Blueprint';host.className='yw580-blueprint';host.hidden=true;
 host.setAttribute('aria-label','Service workflow blueprint');banner.after(host);}
 // Source navigation checks the original RPC and publishes visible state via DOM.
 const legacy=$('yw579ServiceNav');
 if(legacy&&typeof MutationObserver==='function'){
  state.observer=new MutationObserver(schedule);
  state.observer.observe(legacy,{childList:true});
 }
 document.addEventListener('ywi:auth-changed',()=>{clearPrivate();schedule();});
 document.addEventListener('ywi:workspace-authority-changed',schedule);
 document.addEventListener('ywi:module-permissions-changed',schedule);
 document.addEventListener('ywi:company-service-offering-changed',()=>{clearPrivate();schedule();});
 $('yw579CompanySelect')?.addEventListener('change',()=>{clearPrivate();schedule();});
 $('mainNav')?.addEventListener('click',()=>{state.selected='';doc.removeAttribute('data-yw580-selected');
  const panel=$('yw580Blueprint');if(panel)panel.hidden=true;
  const tools=$('yw580BlueprintTools');if(tools)tools.hidden=true;},true);
 document.addEventListener('ywi:route-shown',()=>{
  if(platform()){clearPrivate();render();}
 });
 window.addEventListener('hashchange',()=>{if(platform()){clearPrivate();render();}});
 render();schedule();
}
window.YW580Catalog=Object.freeze({modules:KEYS.map(x=>({key:x[0],label:x[1]})),inspectSpecialty,
 status:serviceStatus,select,refresh:refreshSpecialty,
 snapshot:()=>({selected:state.selected,selectedTool:state.section,verifiedSpecialty:state.specialty?.state==='VERIFIED_NAVIGATION_ONLY',
  companyId:base().verified===true?base().companyId:null})});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
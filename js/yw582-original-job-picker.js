/* YW582 — choose an ORIGINAL owner-linked customer, property and work order.
 * Read-only discovery from YW422 RPCs; never creates jobs, changes roles,
 * enables subscriptions or bypasses YW581 storage and consent checks. */
(()=>{'use strict';
const uuid=x=>typeof x==='string'&&
 /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const services=new Set(['landscape','snow_removal','snow_plowing','septic',
 'arboriculture','construction','water_parks','ponds','skateparks']);
const by=id=>document.getElementById(id);
const el=(tag,label)=>{const e=document.createElement(tag);if(label!==undefined)e.textContent=label;return e;};
const state={epoch:0,company:'',actor:'',clients:[],dossier:null,pending:false};
function inspectOriginal(source,{companyId,clientId}={}){
 const denied={state:'HOLD',properties:[],jobs:[]};
 if(!uuid(companyId)||!uuid(clientId)||source?.company_id!==companyId||
   source?.client_id!==clientId||source?.legacy_unscoped_excluded!==true||
   source?.history_limit_per_type!==80||!source?.customer_name||
   !Array.isArray(source.properties)||source.properties.length>100||
   !Array.isArray(source.work_orders)||source.work_orders.length>80||
   !Array.isArray(source.estimates)||source.estimates.length>80)return denied;
 const props=source.properties, jobs=source.work_orders;
 if(new Set(props.map(p=>p.id)).size!==props.length||
    new Set(jobs.map(w=>w.id)).size!==jobs.length||
    props.some(p=>!uuid(p.id)||typeof p.name!=='string'||!p.name)||
    jobs.some(w=>!uuid(w.id)||!uuid(w.property_id)||!props.some(p=>p.id===w.property_id)||
      !services.has(w.service)||!w.status||
      !Number.isFinite(Date.parse(w.created_at))))return denied;
 return Object.freeze({state:'ORIGINAL_422_OWNER_READ_ONLY',
  properties:props.map(p=>({id:p.id,name:p.name})),
  jobs:jobs.map(w=>({id:w.id,propertyId:w.property_id,service:w.service,
   label:(w.number||w.id)+' · '+w.service+' · '+w.status})),
  canUpload:false,canCreateJob:false,canPostFinance:false});
}
const context=()=>({
 auth:window.YWI_AUTH?.getState?.()||{},
 nav:window.YW579Navigation?.snapshot?.()||{},
 stage:window.YW581Acceptance?.snapshot?.()||{}
});
function allowed(){
 const x=context();
 return x.auth.isAuthenticated===true&&uuid(x.auth.user?.id)&&
  x.nav.verified===true&&uuid(x.nav.companyId)&&
  x.stage.state==='OWNER_STAGING_REVIEW_ONLY'&&x.stage.accepted>0&&
  window.YWIDualWorkspace?.snapshot?.()?.ownedCompanies>0&&
  document.documentElement.dataset.ywSurface!=='platform'&&location.hash!=='#sysop'&&
  window.YWISecurity?.canViewModule?.('jobs',x.auth.role||'employee','view')===true;
}
const say=msg=>{const n=by('yw582PickerStatus');if(n)n.textContent=msg;};
function choices(id,items,placeholder,label){
 const n=by(id);if(!n)return;
 n.replaceChildren();const initial=el('option',placeholder);initial.value='';n.append(initial);
 for(const item of items){const option=el('option',label(item));option.value=item.id;n.append(option);}
}
function clear(){
 state.epoch++;state.company='';state.actor='';state.clients=[];state.dossier=null;
 for(const id of ['yw582Client','yw582Property','yw582Job'])
  choices(id,[],'Verify original records',()=>'-');
 for(const id of ['yw581Client','yw581Property','yw581Job']){
  const n=by(id);if(n){n.value='';n.readOnly=false;}
 }
 say('HOLD: select an owner-verified company and review staging before original job lookup.');
}
function safe(run,ctx){
 return run===state.epoch&&allowed()&&context().nav.companyId===ctx.company&&
  context().auth.user?.id===ctx.actor;
}
async function owner(){
 const auth=context().auth,nav=context().nav, sb=window.YWI_SB||window._sb;
 if(!allowed()||!sb?.rpc||!sb?.auth?.getUser)throw Error('Original company session not verified');
 const a=await sb.auth.getUser();
 if(a.error||a.data?.user?.id!==auth.user?.id)throw Error('Original user session changed');
 return {actor:auth.user.id,company:nav.companyId,sb};
}
async function load(){
 if(state.pending)return;
 const run=++state.epoch;state.pending=true;
 const button=by('yw582FindJobs');if(button)button.disabled=true;
 state.clients=[];state.dossier=null;
 try{
  const ctx=await owner();
  if(!safe(run,ctx))throw Error('Owner scope changed');
  const r=await ctx.sb.rpc('ywi_rpc_company_customers_422',{p_company_id:ctx.company});
  if(!safe(run,ctx)||r.error||!Array.isArray(r.data)||r.data.length>100||
    new Set(r.data.map(x=>x.id)).size!==r.data.length||
    r.data.some(x=>!uuid(x.id)||typeof x.name!=='string'||!x.name||typeof x.is_active!=='boolean'))
    throw Error('Original company customer list was not verified');
  state.actor=ctx.actor;state.company=ctx.company;
  state.clients=r.data.filter(x=>x.is_active===true);
  choices('yw582Client',state.clients,'Choose original customer',x=>x.name);
  choices('yw582Property',[],'Choose customer first',x=>x.name);
  choices('yw582Job',[],'Choose property first',x=>x.label);
  say('Original customer roster verified: '+state.clients.length+
   '. Choose a customer, property and existing job; no new records will be created.');
 }catch(e){if(run===state.epoch){clear();say('HOLD: '+(e?.message||'Original company lookup unavailable'));}}
 finally{state.pending=false;if(button)button.disabled=false;}
}
async function clientChanged(){
 const run=++state.epoch,clientId=by('yw582Client')?.value;
 state.dossier=null;
 choices('yw582Property',[],'Choose customer first',x=>x.name);
 choices('yw582Job',[],'Choose property first',x=>x.label);
 if(!state.clients.some(x=>x.id===clientId))return;
 try{
  const ctx=await owner();
  if(!safe(run,ctx)||ctx.company!==state.company||ctx.actor!==state.actor)throw Error('Company authority changed');
  const result=await ctx.sb.rpc('ywi_rpc_customer_history_422',{
   p_company_id:state.company,p_client_id:clientId});
  if(!safe(run,ctx)||by('yw582Client')?.value!==clientId||result.error)
   throw Error('Original customer lookup no longer current');
  const original=inspectOriginal(result.data,{companyId:state.company,clientId});
  if(original.state!=='ORIGINAL_422_OWNER_READ_ONLY')throw Error('Original customer-property-job linkage failed validation');
  state.dossier=original;
  choices('yw582Property',original.properties,'Choose original property',x=>x.name);
  say('Original property and work order relationships verified; choose a property.');
 }catch(e){if(run===state.epoch){state.dossier=null;say('HOLD: '+(e?.message||'No original job records'));}}
}
function propertyChanged(){
 const p=by('yw582Property')?.value;
 const jobs=state.dossier?.jobs?.filter(j=>j.propertyId===p&&
   window.YW581Acceptance?.canEvidenceService?.(j.service)===true)||[];
 choices('yw582Job',jobs,'Choose accepted existing job',x=>x.label);
 for(const id of ['yw581Client','yw581Property','yw581Job']){
  const x=by(id);if(x){x.value='';x.readOnly=false;}
 }
 say(jobs.length?'Choose an existing job under this verified property.':
  'HOLD: no currently accepted existing service job for this property.');
}
function jobChanged(){
 const client=by('yw582Client')?.value,prop=by('yw582Property')?.value,job=by('yw582Job')?.value;
 const found=state.dossier?.jobs?.find(x=>x.id===job&&x.propertyId===prop);
 if(!allowed()||context().nav.companyId!==state.company||
    context().auth.user?.id!==state.actor||
    !state.clients.some(x=>x.id===client)||!state.dossier?.properties?.some(p=>p.id===prop)||
    !found||window.YW581Acceptance?.canEvidenceService?.(found.service)!==true){
  for(const id of ['yw581Client','yw581Property','yw581Job']){
   const x=by(id);if(x){x.value='';x.readOnly=false;}
  }
  say('HOLD: choose a verified original job with current staged service acceptance.');
  return;
 }
 for(const [id,value] of [['yw581Client',client],['yw581Property',prop],['yw581Job',job]]){
  const x=by(id);if(x){x.value=value;x.readOnly=true;}
 }
 say('Original job selected. Review photo and documentation consent. The server will check all identities again on upload.');
}
function mount(){
 const form=by('yw581Upload');if(!form||by('yw582Picker'))return;
 const picker=el('section');picker.id='yw582Picker';picker.className='yw582-picker';
 const heading=el('h3','Choose an existing customer, property & job');picker.append(heading);
 picker.append(el('p','Uses original company-owned CRM and job records. No manual UUID copying required.'));
 const verify=el('button','Find original jobs');verify.id='yw582FindJobs';verify.type='button';
 verify.className='secondary';verify.addEventListener('click',load);picker.append(verify);
 for(const [id,name,change] of [
  ['yw582Client','Original customer',clientChanged],
  ['yw582Property','Original property',propertyChanged],
  ['yw582Job','Original service job',jobChanged]]){
  const label=el('label',name),select=el('select');select.id=id;
  select.setAttribute('aria-label',name);label.append(select);picker.append(label);
  select.addEventListener('change',change);
 }
 const status=el('p','HOLD: review original company and staging acceptance first.');
 status.id='yw582PickerStatus';status.setAttribute('role','status');
 status.setAttribute('aria-live','polite');picker.append(status);
 form.insertBefore(picker,form.firstChild);
 for(const id of ['ywi:auth-changed','ywi:workspace-authority-changed',
    'ywi:module-permissions-changed','ywi:company-service-offering-changed'])
  document.addEventListener(id,clear);
 by('yw579CompanySelect')?.addEventListener('change',clear);
 window.addEventListener('hashchange',()=>{if(location.hash==='#sysop')clear();});
 clear();
}
window.YW582OriginalJobs=Object.freeze({inspectOriginal,clear,load});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

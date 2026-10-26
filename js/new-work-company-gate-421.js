/* YW Item 421 — a guided caller for server-gated new draft estimate/work order.
   The SQL triggers and RPCs decide authorization. No optimistic "enabled" write. */
(()=>{'use strict';
const keys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture'];
const labels={landscape:'Landscaping',construction:'Construction',water_parks:'Water parks',
snow_removal:'Snow removal',snow_plowing:'Snow plowing',septic:'Septic services',arboriculture:'Arboriculture & tree care'};
function validate(company,services){
 if(!company?.id||!services||services.length!==keys.length||
  services.some(r=>r.company_id!==company.id||!keys.includes(r.module_key)||typeof r.enabled!=='boolean')||
  new Set(services.map(r=>r.module_key)).size!==keys.length)throw Error('Incomplete tenant-scoped service entitlement evidence');
 return services.filter(r=>r.enabled);
}
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;};
const $=id=>document.getElementById(id);
function mount(){
 const host=$('admin');if(!host||$('owner421'))return;
 const panel=el('details');panel.id='owner421';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='New Work Service Gate';panel.dataset.adminHubGroups='management operations';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.appendChild(el('summary','421 · New-Work Service Entitlement Enforcement'));
 const body=el('div');body.className='admin-panel-block';
 body.appendChild(el('p','Create company-scoped draft estimates or work orders only when the owner has enabled the offering and holds active Jobs create permission. The database independently checks each write. No customer or site is linked until tenant ownership is verified. Existing historical work is unaffected.'));
 const action=el('button','Refresh authenticated company services');action.id='owner421Refresh';action.className='secondary';action.type='button';body.appendChild(action);
 const help=el('a','ⓘ Help');help.href='/help.html#new-work-entitlement-421';help.style.marginLeft='8px';body.appendChild(help);
 const status=el('p','Refresh to check the current signed-in owner and seven service switches.');
 status.id='owner421Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.appendChild(status);
 const workspace=el('div');workspace.id='owner421Results';workspace.style.cssText='min-width:0;overflow-wrap:anywhere';body.appendChild(workspace);
 panel.appendChild(body);host.appendChild(panel);
 let busy=false,loaded=null;
 const note=m=>status.textContent=m;
 async function identity(){
  const auth=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(!auth?.isAuthenticated||!auth?.user?.id||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)throw Error('Authenticated company owner required');
  const {data,error}=await sb.auth.getUser();
  if(error||!data?.user?.id||data.user.id!==auth.user.id)throw Error('Session identity mismatch');
  return {sb,uid:data.user.id};
 }
 async function load(){
  if(busy)return;
  busy=true;action.disabled=true;workspace.replaceChildren();loaded=null;
  try{
   const {sb,uid}=await identity();
   const resp=await sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
   if(resp.error||!Array.isArray(resp.data)||resp.data.length>100)throw Error('Incomplete owner company listing');
   if(resp.data.some(c=>!c?.id||c.owner_user_id!==uid))throw Error('Foreign company ownership in response');
   const models=[];
   for(const company of resp.data){
    const r=await sb.from('ywi_company_service_modules').select('company_id,module_key,enabled').eq('company_id',company.id).limit(8);
    if(r.error)throw Error('Company service source unavailable');
    models.push({company,enabled:validate(company,r.data)});
   }
   loaded={uid,sb};note('Server-controlled services loaded. The database revalidates owner, Jobs permission and enabled offering on every new draft.');
   for(const {company,enabled} of models){
    const box=el('section');box.style.cssText='border:1px solid #64748b;border-radius:8px;padding:12px;margin-top:12px;min-width:0;box-sizing:border-box';
    box.appendChild(el('h3',company.name));
    if(!enabled.length){box.appendChild(el('p','All services disabled. Enable a company offering in Build 420 first.'));workspace.appendChild(box);continue;}
    const row=el('div');row.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:8px;min-width:0';
    const family=el('select');family.dataset.owner421Service=company.id;
    for(const svc of enabled){const opt=el('option',labels[svc.module_key]);opt.value=svc.module_key;family.appendChild(opt);}
    const mode=el('select');mode.dataset.owner421Kind=company.id;
    for(const value of ['estimate','work_order']){const opt=el('option',value==='estimate'?'Draft estimate':'Draft work order');opt.value=value;mode.appendChild(opt);}
    const title=el('input');title.placeholder='Draft description (3–120 characters)';title.maxLength=120;title.dataset.owner421Title=company.id;title.setAttribute('aria-label','Draft work description');
    for(const n of [family,mode,title])n.style.cssText='min-width:0;max-width:100%;width:100%;box-sizing:border-box';
    row.append(family,mode,title);box.appendChild(row);
    const save=el('button','Create authorized draft');save.type='button';save.dataset.owner421Create=company.id;box.appendChild(save);
    const receipt=el('p');receipt.dataset.owner421Receipt=company.id;box.appendChild(receipt);
    save.addEventListener('click',async()=>{
     if(busy)return;
     const trimmed=title.value.trim(),key=family.value,kind=mode.value;
     if(trimmed.length<3||trimmed.length>120||!enabled.some(s=>s.module_key===key)){receipt.textContent='WITHHELD: supply a valid description and enabled service';return;}
     if(!window.confirm('Create a new '+kind+' draft for '+company.name+' / '+labels[key]+'? The server will recheck permissions and service status.'))return;
     busy=true;save.disabled=true;action.disabled=true;
     try{
      const current=await identity();if(current.uid!==loaded?.uid)throw Error('Owner identity changed');
      const isEstimate=kind==='estimate';
      const rpc=isEstimate?'ywi_rpc_create_scoped_estimate_421':'ywi_rpc_create_scoped_work_order_421';
      const args=isEstimate?
      {p_company_id:company.id,p_module_key:key,p_title:trimmed}:
      {p_company_id:company.id,p_module_key:key,p_title:trimmed,p_estimate_id:null};
      const result=await current.sb.rpc(rpc,args);
      if(result.error||typeof result.data!=='string'||!result.data)throw Error('Server authorization or new-work receipt failed');
      receipt.textContent='Created server-authorized draft '+result.data+'. No customer, dispatch or invoice was added.';
      note('Server confirmed '+kind+' draft; refresh before any further new work.');
      save.disabled=true;loaded=null;
     }catch(e){receipt.textContent='WITHHELD: '+(e?.message||e);save.disabled=true;loaded=null;}
     finally{busy=false;action.disabled=false;}
    });
    workspace.appendChild(box);
   }
   if(!models.length)workspace.appendChild(el('p','No owner company found. Create one in the Build 420 Company Service Registry.'));
  }catch(e){workspace.replaceChildren();note('WITHHELD: '+(e?.message||e));}
  finally{busy=false;action.disabled=false;}
 }
 action.addEventListener('click',load);
 document.addEventListener('ywi:auth-changed',()=>{loaded=null;workspace.replaceChildren();note('Session changed. Recheck company and service authority.');});
 document.addEventListener('ywi:company-service-offering-changed',()=>{loaded=null;workspace.replaceChildren();note('Service switches changed. Refresh under current company authority.');});
}
window.YWI421=Object.freeze({keys,validate});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

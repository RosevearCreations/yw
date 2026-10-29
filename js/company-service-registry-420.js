/* YW Item 420/451 — authenticated, company-owned service switches.
   Server grants, constraints, trigger audit and RLS are authoritative. Item 421 governs new work. */
(()=>{'use strict';
const keys=Object.freeze(['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture']);
const labels=Object.freeze({landscape:'Landscaping, lawn and grounds',construction:'Small construction and repairs',
water_parks:'Water parks and aquatic facilities',snow_removal:'Snow removal and de-icing',
snow_plowing:'Snow plowing',septic:'Septic and vacuum services',arboriculture:'Arboriculture and tree care'});
const $=id=>document.getElementById(id);
const el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=String(text);return x;};
function verifyRows(company, rows){
 if(!company?.id||!Array.isArray(rows)||rows.length!==keys.length)throw Error('Registry incomplete; writes withheld');
 const seen=new Set();
 for(const r of rows){if(r.company_id!==company.id||!keys.includes(r.module_key)||
 seen.has(r.module_key)||typeof r.enabled!=='boolean'||!r.created_at||!r.updated_at)
 throw Error('Registry evidence invalid; writes withheld');seen.add(r.module_key);}
 return keys.map(k=>rows.find(r=>r.module_key===k));
}
async function ownerSession(){
 const sb=window.YWI_SB||window._sb;
 const authState=window.YWI_AUTH?.getState?.();
 if(!sb?.from||!sb?.auth?.getUser||authState?.isAuthenticated!==true||!authState?.user?.id)
 throw Error('Sign in before using company services');
 const {data,error}=await sb.auth.getUser();
 if(error||!data?.user?.id||data.user.id!==authState.user.id)throw Error('Current authenticated identity could not be verified');
 return {sb,uid:data.user.id};
}
function panel(){
 // Company management belongs to every authenticated company owner in
 // Settings, never to the application-wide Admin console.
 const host=$('settings');if(!host||$('owner420'))return;
 const p=el('details');p.id='owner420';p.className='admin-hub-detail';
 p.dataset.adminHubTitle='Company Service Registry';p.dataset.adminHubGroups='management operations';
 p.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 p.appendChild(el('summary','My Companies · Services & Modules'));
 const body=el('div');body.className='admin-panel-block';
 const n=el('p','Owner-only company registry. New companies start with all seven services DISABLED. Arboriculture is an independently audited company service added in Build 451. Staff roles and shared CRM, Jobs, Finance and Safety records remain unchanged. Build 421 independently enforces service switches for NEW Jobs work; historical jobs and contracts remain intact.');
 body.appendChild(n);
 const controls=el('div');controls.style.cssText='display:flex;gap:8px;flex-wrap:wrap;align-items:center;min-width:0';
 const refresh=el('button','Refresh companies');refresh.id='owner420Refresh';refresh.type='button';refresh.className='secondary';
 const newName=el('input');newName.id='owner420Name';newName.placeholder='New company legal/operating name';newName.maxLength=120;
 newName.setAttribute('aria-label','New company name');newName.style.cssText='min-width:0;max-width:100%;width:min(100%,280px);box-sizing:border-box';
 const create=el('button','Create company');create.id='owner420Create';create.type='button';
 const help=el('a','ⓘ Help');help.href='/help.html#company-service-registry-420';
 controls.append(refresh,newName,create,help);body.appendChild(controls);
 const status=el('p','Sign in and refresh to load owner companies.');status.id='owner420Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.appendChild(status);
 const root=el('div');root.id='owner420Results';root.style.cssText='display:grid;gap:12px;min-width:0;max-width:100%;overflow-wrap:anywhere';body.appendChild(root);
 p.appendChild(body);host.appendChild(p);
 let busy=false;let context=null;
 const notice=(msg)=>{status.textContent=msg;};
 async function load(){
  if(busy)return;busy=true;refresh.disabled=true;create.disabled=true;
  root.replaceChildren();notice('Verifying owner identity and reading registry…');context=null;
  try{
   const {sb,uid}=await ownerSession();
   const q=await sb.from('ywi_companies').select('id,name,owner_user_id,created_at').order('created_at',{ascending:true}).limit(101);
   if(q.error||!Array.isArray(q.data))throw Error('Company registry unavailable');
   if(q.data.length>100)throw Error('More than 100 companies: full listing needed before editing');
   if(q.data.some(c=>c.owner_user_id!==uid||!c.id||!c.name))throw Error('Tenant identity mismatch');
   const models=[];
   for(const c of q.data){
    const m=await sb.from('ywi_company_service_modules').select('company_id,module_key,enabled,created_at,updated_at').eq('company_id',c.id).limit(8);
    if(m.error)throw Error('Company service registry inaccessible');
    const services=verifyRows(c,m.data);
    const a=await sb.from('ywi_company_service_module_audit').select('id,company_id,module_key,action,previous_enabled,next_enabled,recorded_at').eq('company_id',c.id).order('id',{ascending:false}).limit(26);
    if(a.error||!Array.isArray(a.data))throw Error('Company audit register unavailable');
    if(a.data.some(row=>row.company_id!==c.id||!keys.includes(row.module_key)))throw Error('Audit tenant mismatch');
    models.push({company:c,services,audit:a.data});
   }
   context={sb,uid};notice(q.data.length+' owner-owned companies loaded. Server-side RLS enforces company boundaries; changing switches is audited. Historical work is unaffected.');
   if(!models.length)root.appendChild(el('p','No companies registered for this account. You may create your first company above.'));
   for(const m of models){
    const wrap=el('section');wrap.style.cssText='min-width:0;max-width:100%;border:1px solid #64748b;border-radius:10px;padding:12px;box-sizing:border-box';
    wrap.appendChild(el('h3',m.company.name));
    wrap.appendChild(el('p','All switches apply only to new company service offerings; existing customer and Finance records retain their own authority.'));
    const grid=el('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:10px';
    for(const service of m.services){
     const card=el('article');card.dataset.owner420Key=service.module_key;
     card.style.cssText='padding:10px;border:1px solid #64748b;border-radius:8px;min-width:0;overflow-wrap:anywhere';
     card.appendChild(el('strong',labels[service.module_key]));
     const s=el('p',service.enabled?'Enabled for this company':'Disabled for this company');s.dataset.owner420Enabled=String(service.enabled);card.appendChild(s);
     const toggle=el('button',service.enabled?'Disable':'Enable');toggle.type='button';toggle.className='secondary';toggle.dataset.owner420Toggle=service.module_key;
     toggle.addEventListener('click',async()=>{
      if(busy)return;
      const desired=!service.enabled;const verb=desired?'ENABLE':'DISABLE';
      if(!window.confirm(verb+' '+labels[service.module_key]+' for '+m.company.name+
       '? The action is audited. Historical contracts and jobs are not cancelled.'))return;
      busy=true;toggle.disabled=true;refresh.disabled=true;create.disabled=true;
      notice('Recording explicit owner '+verb.toLowerCase()+' decision…');
      try{
       const current=await ownerSession();
       if(current.uid!==context?.uid)throw Error('Owner session changed');
       const res=await current.sb.from('ywi_company_service_modules').update({enabled:desired})
        .eq('company_id',m.company.id).eq('module_key',service.module_key)
        .eq('enabled',service.enabled).select('company_id,module_key,enabled,created_at,updated_at');
       if(res.error||res.data?.length!==1||res.data[0].enabled!==desired)throw Error('Change not confirmed; re-read required');
       // A successful server-confirmed toggle invalidates all visible entitlement snapshots.
       document.dispatchEvent(new CustomEvent('ywi:company-service-offering-changed',
        {detail:{company_id:m.company.id,module_key:service.module_key}}));
       busy=false;notice('Saved under owner identity; reloading authoritative registry and audit…');
       await load();
      }catch(err){busy=false;notice('WITHHELD: '+(err?.message||err)+'. Refresh to reconcile.');toggle.disabled=true;refresh.disabled=false;create.disabled=false;}
     });
     card.appendChild(toggle);grid.appendChild(card);
    }
    wrap.appendChild(grid);
    wrap.appendChild(el('p','Latest audit entries (up to 25; older entries retained server-side):'));
    const log=el('ul');log.dataset.owner420Audit=m.company.id;
    for(const a of m.audit.slice(0,25))log.appendChild(el('li',a.recorded_at+' · '+labels[a.module_key]+' · '+a.action));
    if(m.audit.length===26)log.appendChild(el('li','Additional historical audit records exist; this display is not exhaustive.'));
    if(!m.audit.length)log.appendChild(el('li','No audit records found; verify registry migration before toggling.'));
    wrap.appendChild(log);root.appendChild(wrap);
   }
  }catch(err){root.replaceChildren();notice('WITHHELD: '+(err?.message||err)+'. No service change permitted.');}
  finally{busy=false;refresh.disabled=false;create.disabled=false;}
 }
 refresh.addEventListener('click',load);
 create.addEventListener('click',async()=>{
  if(busy)return;
  const name=newName.value.trim();
  if(name.length<2||name.length>120){notice('Enter a company name between 2 and 120 characters.');return;}
  if(!window.confirm('Create company "'+name+'" with all seven service offerings DISABLED?'))return;
  busy=true;create.disabled=true;refresh.disabled=true;
  try{
   const {sb}=await ownerSession();
   const r=await sb.from('ywi_companies').insert({name}).select('id,name');
   if(r.error||r.data?.length!==1)throw Error('Company creation unconfirmed');
   document.dispatchEvent(new CustomEvent('ywi:company-service-offering-changed',
    {detail:{company_id:r.data[0].id}}));
   busy=false;newName.value='';await load();
  }catch(err){busy=false;notice('WITHHELD: '+(err?.message||err)+'. Refresh and confirm server records.');create.disabled=false;refresh.disabled=false;}
 });
 document.addEventListener('ywi:auth-changed',()=>{context=null;root.replaceChildren();notice('Session changed. Refresh under the current verified owner identity.');});
}
window.YWI420=Object.freeze({keys,verifyRows,ownerSession});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',panel,{once:true});else panel();
})();

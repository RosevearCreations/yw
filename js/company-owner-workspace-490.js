/* Build 490. A company owner is identified by server-side ownership, not
   profiles.role='admin'. Every company read remains subject to Supabase RLS. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const node=(tag,value)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=String(value);return e;};
const serviceKeys=new Set(['landscape','construction','water_parks','snow_removal',
 'snow_plowing','septic','arboriculture']);
function install(){
 const host=$('settings');if(!host||$('owner490'))return;
 const section=node('section');section.id='owner490';section.className='admin-panel-block';
 section.style.cssText='border:1px solid #64748b;border-radius:12px;padding:14px;margin:14px 0;min-width:0;overflow-wrap:anywhere';
 section.appendChild(node('h3','My Company Workspace'));
 section.appendChild(node('p','Company ownership is separate from Yard Workers platform administration. Only our own company records are available here.'));
 const load=node('button','Load my companies');load.type='button';load.id='owner490Load';
 const status=node('p','Sign in to verify company ownership.');status.id='owner490Status';status.setAttribute('role','status');
 const list=node('div');list.id='owner490List';list.style.cssText='display:grid;gap:10px;min-width:0';
 section.append(load,status,list);
 const heading=host.querySelector('h2');if(heading)heading.after(section);else host.appendChild(section);
 async function refresh(){
  load.disabled=true;list.replaceChildren();status.textContent='Checking signed-in identity and company ownership…';
  try{
   const sb=window.YWI_SB||window._sb,session=window.YWI_AUTH?.getState?.();
   if(session?.isAuthenticated!==true||!session?.user?.id||!sb?.auth?.getUser||!sb?.from)
     throw Error('Authenticated company owner required');
   const auth=await sb.auth.getUser();
   if(auth.error||auth.data?.user?.id!==session.user.id)throw Error('Session identity mismatch');
   const q=await sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
   if(q.error||!Array.isArray(q.data)||q.data.length>100||q.data.some(c=>
     !c.id||!c.name||c.owner_user_id!==session.user.id))throw Error('Owner company roster unavailable or cross-tenant');
   if(!q.data.length){status.textContent='No companies owned by this account.';return;}
   const views=[];
   for(const c of q.data){
    const m=await sb.from('ywi_company_service_modules').select('company_id,module_key,enabled')
     .eq('company_id',c.id).limit(8);
    if(m.error||!Array.isArray(m.data)||m.data.length!==7||new Set(m.data.map(x=>x.module_key)).size!==7||
      m.data.some(x=>x.company_id!==c.id||!serviceKeys.has(x.module_key)||typeof x.enabled!=='boolean'))
      throw Error('Company module registry incomplete or foreign');
    views.push({company:c,enabled:m.data.filter(x=>x.enabled).length});
   }
   status.textContent=views.length+' owned company workspace(s) verified by signed-in identity.';
   for(const view of views){
    const c=view.company,item=node('article');item.dataset.owner490Company=c.id;
    item.style.cssText='border:1px solid #64748b;border-radius:10px;padding:12px;min-width:0;overflow-wrap:anywhere';
    item.append(node('h4',c.name),node('p','Company owner — application-wide administrator privileges are not required.'),
      node('p','Enabled services: '+view.enabled+' of 7'));
    const open=node('button','Manage this company’s services');open.type='button';
    open.addEventListener('click',()=>{
      const registry=$('owner420');if(!registry){status.textContent='Company service controls unavailable';return;}
      registry.open=true;registry.scrollIntoView?.({behavior:'smooth',block:'start'});
      $('owner420Refresh')?.click();
    });
    item.appendChild(open);list.appendChild(item);
   }
  }catch(err){list.replaceChildren();status.textContent='WITHHELD: '+(err?.message||'Unverified identity');}
  finally{load.disabled=false;}
 }
 load.addEventListener('click',refresh);
 document.addEventListener('ywi:auth-changed',()=>{
  list.replaceChildren();status.textContent='Session changed. Load the company workspace again.';
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

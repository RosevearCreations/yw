/* Build 489: platform-only company directory. The server-side function verifies
   curated platform admin membership; a client role label does not grant access. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const el=(tag,content)=>{const node=document.createElement(tag);if(content!==undefined)node.textContent=String(content);return node;};
function panel(){
 const host=$('admin');if(!host||$('platform489'))return;
 const details=el('details');details.id='platform489';details.className='admin-hub-detail';
 details.dataset.adminHubTitle='Platform Company Directory';
 details.dataset.adminHubGroups='people operations readiness';
 details.appendChild(el('summary','489 · Platform Company Directory'));
 const body=el('div');body.className='admin-panel-block';
 body.appendChild(el('p','Read-only oversight of registered landscaping companies. Company settings and work remain private to each company owner.'));
 const refresh=el('button','Load company directory');refresh.type='button';refresh.id='platform489Refresh';
 const status=el('p','Sign in as the Primary Administrator.');status.id='platform489Status';status.setAttribute('role','status');
 const results=el('div');results.id='platform489Results';results.style.cssText='display:grid;gap:10px;min-width:0';
 body.append(refresh,status,results);details.appendChild(body);host.appendChild(details);
 refresh.addEventListener('click',async()=>{
  refresh.disabled=true;results.replaceChildren();status.textContent='Verifying platform authority…';
  try{
   const sb=window.YWI_SB||window._sb,actor=window.YWI_AUTH?.getState?.();
   if(actor?.isAuthenticated!==true||!actor?.user?.id||!sb?.auth?.getUser||!sb?.rpc)
     throw Error('Authenticated platform administrator required');
   const identity=await sb.auth.getUser();
   if(identity.error||identity.data?.user?.id!==actor.user.id)throw Error('Session identity not verified');
   const result=await sb.rpc('ywi_platform_company_directory_489');
   if(result.error||!Array.isArray(result.data))throw Error('Platform company directory unavailable or permission denied');
   status.textContent=result.data.length+' company registrations read from platform-only directory.';
   if(!result.data.length)results.appendChild(el('p','No companies registered.'));
   for(const c of result.data){
    if(!c.company_id||!c.owner_user_id||!c.company_name||!c.owner_email||
       !Number.isSafeInteger(Number(c.registered_services)))throw Error('Incomplete company directory');
    const item=el('section');item.style.cssText='border:1px solid #64748b;border-radius:10px;padding:12px;overflow-wrap:anywhere';
    item.append(el('h3',c.company_name),el('p','Owner: '+c.owner_email),
      el('p','Services enabled: '+c.enabled_services+' of '+c.registered_services));
    results.appendChild(item);
   }
  }catch(err){results.replaceChildren();status.textContent='ACCESS WITHHELD: '+(err?.message||'Unknown error');}
  finally{refresh.disabled=false;}
 });
 document.addEventListener('ywi:auth-changed',()=>{results.replaceChildren();status.textContent='Session changed; reload to verify platform access.';});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',panel,{once:true});else panel();
})();

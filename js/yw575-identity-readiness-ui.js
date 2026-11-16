/* YW575 authenticated identity review: no admin privileges or real revocation conveyed. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
function render(){
 const admin=$('admin');if(!admin)return;
 const a=window.YWI_AUTH?.getState?.()||{},sec=window.YWISecurity;
 let host=$('yw575IdentityReadiness');
 const allowed=a.isAuthenticated===true&&a.role==='admin'&&sec?.canViewModule?.('admin',a.role,'manage')===true;
 if(!allowed){host?.remove();return;}
 if(!host){host=document.createElement('section');host.id='yw575IdentityReadiness';
  host.className='admin-panel-block';host.dataset.adminHubGroups='people readiness';
  host.dataset.adminHubTitle='YW575 HR Access & Device Sessions';admin.append(host);}
 host.replaceChildren();
 const heading=document.createElement('h3');heading.textContent='YW575 · HR role segregation & device-session review';host.append(heading);
 const p=document.createElement('p');p.textContent='Current session is authenticated as '+String(a.role||'unknown')+
  '. This is a read-only release readiness panel. A UI Admin label is not company ownership or authorization to revoke another person’s sessions.';
 host.append(p);
 const ul=document.createElement('ul');
 for(const message of [
 'Company-scoped role grants and HR records require fresh server-side RLS and trusted tenant membership.',
 'Other-device revocation requires independently approved company action, MFA, provider session verification and immutable audit.',
 'Revoking refresh tokens alone does not immediately revoke unexpired access JWTs; sensitive operations must recheck session_id.',
 'No remote identity change, cross-company search, revoke-all command or Master authority is enabled by YW575 source.']){
  const li=document.createElement('li');li.textContent=message;ul.append(li);}
 host.append(ul);
}
document.addEventListener('DOMContentLoaded',render);
document.addEventListener('ywi:auth-changed',render);
document.addEventListener('ywi:module-permissions-changed',render);
})();

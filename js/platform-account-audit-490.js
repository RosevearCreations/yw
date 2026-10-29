/* Build 490: server-only curated platform administrator audit. This page is
   evidence for a human decision; it never demotes/approves accounts. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const el=(tag,value)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=String(value);return e;};
function install(){
 const host=$('admin');if(!host||$('platform490'))return;
 const panel=el('details');panel.id='platform490';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Platform Account Role Audit';
 panel.dataset.adminHubGroups='people readiness';
 panel.appendChild(el('summary','490 · Platform & Company Owner Account Audit'));
 const body=el('div');body.className='admin-panel-block';
 body.appendChild(el('p','Only the privately curated Primary Administrator can read this audit. Legacy global admins are flagged for owner review, never changed automatically.'));
 const refresh=el('button','Audit administrator and company owner accounts');refresh.type='button';refresh.id='platform490Refresh';
 const status=el('p','Sign in as the Primary Administrator to review accounts.');status.id='platform490Status';status.setAttribute('role','status');
 const records=el('div');records.id='platform490Records';records.style.cssText='display:grid;gap:10px;min-width:0';
 body.append(refresh,status,records);panel.appendChild(body);host.appendChild(panel);
 refresh.addEventListener('click',async()=>{
  refresh.disabled=true;records.replaceChildren();status.textContent='Verifying platform access…';
  try{
   const sb=window.YWI_SB||window._sb,session=window.YWI_AUTH?.getState?.();
   if(session?.isAuthenticated!==true||!session?.user?.id||!sb?.auth?.getUser||!sb?.rpc)
     throw Error('Authenticated platform administrator required');
   const user=await sb.auth.getUser();
   if(user.error||user.data?.user?.id!==session.user.id)throw Error('Session identity mismatch');
   const r=await sb.rpc('ywi_platform_account_audit_490');
   if(r.error||!Array.isArray(r.data))throw Error('Platform-only audit denied or unavailable');
   if(!r.data.length)throw Error('No audited accounts returned');
   const approved=r.data.filter(x=>x.curated_platform_admin===true);
   if(approved.length!==1)throw Error('Platform administrator registry needs independent review');
   let legacy=0;
   for(const x of r.data){
    if(!x.profile_id||!x.account_email||!x.account_name||!['admin','employee','worker','staff','supervisor','hse','job_admin','site_leader','onsite_admin'].includes(x.global_role)||
       !Number.isSafeInteger(Number(x.owned_company_count))||x.profile_email_matches_auth!==true)
      throw Error('Invalid account audit data');
    const kind=x.curated_platform_admin?'CURATED PRIMARY ADMINISTRATOR':
      x.global_role==='admin'?'LEGACY GLOBAL ADMIN — REVIEW REQUIRED':'COMPANY OWNER';
    if(kind.startsWith('LEGACY'))legacy++;
    const item=el('article');item.dataset.platform490Role=kind;
    item.style.cssText='padding:12px;border:1px solid #64748b;border-radius:10px;overflow-wrap:anywhere';
    item.append(el('h4',x.account_name),el('p',x.account_email),
      el('p',kind),el('p','Owned companies: '+x.owned_company_count));
    records.appendChild(item);
   }
   status.textContent='Audited '+r.data.length+' accounts. '+legacy+' legacy global admin exception(s) require an owner decision.';
  }catch(e){records.replaceChildren();status.textContent='WITHHELD: '+(e?.message||'Unverified platform authority');}
  finally{refresh.disabled=false;}
 });
 document.addEventListener('ywi:auth-changed',()=>{
  records.replaceChildren();status.textContent='Session changed; platform audit must be reverified.';
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

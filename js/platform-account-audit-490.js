/* Build 490/491: curated platform-only read audit, never a role editor.
   Build 491 discards in-flight results when the authenticated session changes. */
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
 let generation=0;
 refresh.addEventListener('click',async()=>{
  const epoch=++generation;
  refresh.disabled=true;records.replaceChildren();status.textContent='Verifying platform access…';
  try{
   const sb=window.YWI_SB||window._sb,session=window.YWI_AUTH?.getState?.();
   if(session?.isAuthenticated!==true||!session?.user?.id||!sb?.auth?.getUser||!sb?.rpc)
     throw Error('Authenticated platform administrator required');
   const uid=session.user.id;
   const assertCurrent=()=>{
    const state=window.YWI_AUTH?.getState?.();
    if(epoch!==generation||state?.isAuthenticated!==true||state.user?.id!==uid)
     throw Error('Platform administrator session changed');
   };
   const user=await sb.auth.getUser();
   assertCurrent();
   if(user.error||user.data?.user?.id!==session.user.id)throw Error('Session identity mismatch');
   const r=await sb.rpc('ywi_platform_account_audit_490');
   assertCurrent();
   if(r.error||!Array.isArray(r.data))throw Error('Platform-only audit denied or unavailable');
   if(!r.data.length)throw Error('No audited accounts returned');
   const approved=r.data.filter(x=>x.curated_platform_admin===true);
   if(approved.length!==1)throw Error('Platform administrator registry needs independent review');
   const ledger=await sb.rpc('ywi_platform_legacy_evidence_list_493');
   assertCurrent();
   if(ledger.error||!Array.isArray(ledger.data)||ledger.data.length>200)
     throw Error('Restricted legacy-role evidence ledger unavailable');
   const legacyIds=new Set(r.data.filter(x=>x.global_role==='admin'&&
     x.curated_platform_admin!==true).map(x=>x.profile_id));
   if(ledger.data.some(e=>!legacyIds.has(e.profile_id)||
      !Number.isSafeInteger(Number(e.entry_id))||
      !/^[A-Za-z0-9][A-Za-z0-9._/-]{5,119}$/.test(e.evidence_reference)||
      e.evidence_state!=='UNVERIFIED_REFERENCE'||!Number.isFinite(Date.parse(e.recorded_at))))
     throw Error('Foreign or invalid legacy evidence returned');
   let legacy=0;const view=document.createDocumentFragment();
   const review=el('p','Build 493 review ledger: ticket references are append-only, unverified observations. No entry proves authority, approves a role or changes access. Independent owner review remains required. Never enter keys, tokens or private proof.');
   view.appendChild(review);
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
      el('p',kind),el('p','Owned companies: '+x.owned_company_count),
      el('p','Account state: '+(x.active===true?'active':'inactive')+' · Staff tier: '+(x.staff_tier||'none')));
    if(kind.startsWith('LEGACY')){
      item.appendChild(el('p','REVIEW PENDING — original authority and tenant scope not independently verified.'));
      const evidence=el('details');evidence.dataset.legacy493Ledger=x.profile_id;
      evidence.appendChild(el('summary','Evidence-reference ledger (unverified)'));
      const entries=el('ol');
      const references=ledger.data.filter(e=>e.profile_id===x.profile_id);
      for(const entry of references)entries.appendChild(el('li',
        entry.evidence_reference+' · UNVERIFIED_REFERENCE · '+
        new Date(entry.recorded_at).toLocaleString()));
      if(!references.length)entries.appendChild(el('li','No evidence reference recorded.'));
      evidence.appendChild(entries);
      const input=el('input');input.type='text';input.maxLength=120;
      input.placeholder='Ticket ID only, e.g. QL-267-REVIEW-001';
      input.setAttribute('aria-label','Unverified legacy role evidence ticket reference');
      const record=el('button','Record unverified reference');record.type='button';
      const recordStatus=el('p','Reference IDs only. This cannot approve or revoke a role.');
      recordStatus.setAttribute('role','status');
      record.addEventListener('click',async()=>{
        const reference=input.value.trim();
        if(!/^[A-Za-z0-9][A-Za-z0-9._/-]{5,119}$/.test(reference)){
          recordStatus.textContent='Use a 6–120 character ticket ID. Do not enter URLs, notes or private evidence.';return;
        }
        record.disabled=true;recordStatus.textContent='Recording unverified reference…';
        try{
          assertCurrent();
          const saved=await sb.rpc('ywi_platform_legacy_evidence_record_493',{
            p_profile_id:x.profile_id,p_reference:reference});
          assertCurrent();
          if(saved.error||!Number.isSafeInteger(Number(saved.data)))
            throw Error('Platform evidence write denied or unavailable');
          recordStatus.textContent='Reference recorded; refreshing audited ledger…';
          refresh.click();
        }catch(e){if(epoch===generation){record.disabled=false;
          recordStatus.textContent='WITHHELD: '+(e?.message||'Unverified reference rejected');}}
      });
      evidence.append(input,record,recordStatus);item.appendChild(evidence);
    }
    view.appendChild(item);
   }
   assertCurrent();
   records.replaceChildren(view);
   status.textContent='Audited '+r.data.length+' accounts. '+legacy+
    ' legacy global admin exception(s); '+ledger.data.length+
    ' unverified reference(s). Independent owner decision still required.';
  }catch(e){if(epoch===generation){records.replaceChildren();status.textContent='WITHHELD: '+(e?.message||'Unverified platform authority');}}
  finally{if(epoch===generation)refresh.disabled=false;}
 });
 document.addEventListener('ywi:auth-changed',()=>{
  generation++;refresh.disabled=false;
  records.replaceChildren();status.textContent='Session changed; platform audit must be reverified.';
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

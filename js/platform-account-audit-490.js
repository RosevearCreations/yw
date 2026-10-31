/* Build 490/491: curated platform-only read audit, never a role editor.
   Build 491 discards in-flight results when the authenticated session changes. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const el=(tag,value)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=String(value);return e;};
const stat=(label,value,tone='purple')=>{
 const card=el('div');card.className='yw494-kpi';card.dataset.tone=tone;
 const caption=el('span',label);caption.className='yw494-kpi-label';
 const number=el('strong',value);number.className='yw494-kpi-value';
 card.append(caption,number);return card;
};
function install(){
 const host=$('admin');if(!host||$('platform490'))return;
 const panel=el('details');panel.id='platform490';panel.className='admin-hub-detail yw494-command';
 panel.dataset.adminHubTitle='Platform Account Role Audit';
 panel.dataset.adminHubGroups='people readiness';
 panel.appendChild(el('summary','490 · Platform & Company Owner Account Audit'));
 const body=el('div');body.className='admin-panel-block';
 const hero=el('div');hero.className='yw494-hero';
 hero.append(el('span','PLATFORM SECURITY  /  BUILD 495'),el('h3','Legacy-Role Evidence & Decision Handoff'),
  el('p','Review current authority, reconcile restricted ticket references and prepare an independent decision handoff. No approval or role transition is possible here.'));
 const metrics=el('div');metrics.className='yw494-kpis';metrics.id='platform494Metrics';
 metrics.append(stat('Audited accounts','—'),stat('Legacy exceptions','—','amber'),stat('Unverified references','—','blue'));
 const filterLabel=el('label','Review account group');filterLabel.setAttribute('for','platform494ReviewFilter');
 const reviewFilter=el('select');reviewFilter.id='platform494ReviewFilter';
 for(const [label,value] of [['All audited accounts','all'],['Legacy roles requiring review','legacy'],
  ['Legacy roles without reference','missing'],['Legacy roles with references','recorded']])reviewFilter.appendChild(new Option(label,value));
 const filterBar=el('div');filterBar.className='yw494-filter-bar';filterBar.append(filterLabel,reviewFilter);
 const refresh=el('button','Audit administrator and company owner accounts');refresh.type='button';refresh.id='platform490Refresh';
 const status=el('p','Sign in as the Primary Administrator to review accounts.');status.id='platform490Status';status.setAttribute('role','status');
 const records=el('div');records.id='platform490Records';records.style.cssText='display:grid;gap:10px;min-width:0';
 body.append(hero,metrics,refresh,status,filterBar,records);panel.appendChild(body);host.appendChild(panel);
 const applyFilter=()=>{
  for(const item of records.querySelectorAll('[data-platform490-role]')){
   const kind=item.dataset.platform490Role||'',count=Number(item.dataset.platform494ReferenceCount||0);
   item.hidden=reviewFilter.value==='legacy'&&!kind.startsWith('LEGACY')||
    reviewFilter.value==='missing'&&(!kind.startsWith('LEGACY')||count!==0)||
    reviewFilter.value==='recorded'&&(!kind.startsWith('LEGACY')||count===0);
  }
 };
 reviewFilter.addEventListener('change',applyFilter);
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
   if(new Set(ledger.data.map(e=>String(e.entry_id))).size!==ledger.data.length)
    throw Error('Duplicate ledger identities require independent review');
   let legacy=0;const view=document.createDocumentFragment();
   const review=el('p','RECONCILIATION SCOPE: Current role/account audit plus append-only ticket references. A ticket ID is not independent source proof, signer custody or an owner decision. Never enter keys, tokens or private proof.');
   view.appendChild(review);
   for(const x of r.data){
    if(!x.profile_id||!x.account_email||!x.account_name||!['admin','employee','worker','staff','supervisor','hse','job_admin','site_leader','onsite_admin'].includes(x.global_role)||
       !Number.isSafeInteger(Number(x.owned_company_count))||x.profile_email_matches_auth!==true)
      throw Error('Invalid account audit data');
    const kind=x.curated_platform_admin?'CURATED PRIMARY ADMINISTRATOR':
      x.global_role==='admin'?'LEGACY GLOBAL ADMIN — REVIEW REQUIRED':'COMPANY OWNER';
    if(kind.startsWith('LEGACY'))legacy++;
    const item=el('article');item.dataset.platform490Role=kind;
    item.className='yw494-review-card';
    const references=ledger.data.filter(e=>e.profile_id===x.profile_id);
    item.dataset.platform494ReferenceCount=references.length;
    item.append(el('h4',x.account_name),el('p',x.account_email),
      el('p',kind),el('p','Owned companies: '+x.owned_company_count),
      el('p','Account state: '+(x.active===true?'active':'inactive')+' · Staff tier: '+(x.staff_tier||'none')));
    if(kind.startsWith('LEGACY')){
      item.appendChild(el('p','REVIEW PENDING — original authority and tenant scope not independently verified.'));
      const reconciliation=el('p');reconciliation.className='yw494-evidence-state';
      reconciliation.dataset.state=references.length?'unverified':'missing';
      reconciliation.textContent=references.length?'UNVERIFIED ONLY · '+references.length+
       ' reference(s), last recorded '+new Date(references[0].recorded_at).toLocaleString():
       'NO REFERENCE · Original source and owner decision not evidenced';
      item.appendChild(reconciliation);
      const evidence=el('details');evidence.dataset.legacy493Ledger=x.profile_id;
      evidence.appendChild(el('summary','Evidence-reference ledger (unverified)'));
      const entries=el('ol');
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
      const handoff=el('details');handoff.className='yw494-review-details';
      handoff.dataset.platform495Handoff=x.profile_id;
      handoff.appendChild(el('summary','Prepare independent authority decision handoff'));
      const trackLabel=el('label','Review question');
      const track=el('select');track.setAttribute('aria-label','Legacy authority review question');
      const questions=[['Verify original grant and scope','VERIFY_ORIGINAL'],
       ['Review restriction to company authority','RESTRICT_SCOPE'],
       ['Review removal of legacy global authority','REMOVE_LEGACY']];
      for(const [label,value] of questions)track.appendChild(new Option(label,value));
      const prepare=el('button','Prepare read-only handoff');prepare.type='button';
      const packet=el('textarea');packet.readOnly=true;packet.rows=10;
      packet.setAttribute('aria-label','Read-only legacy authority decision handoff');
      packet.placeholder='Prepare a handoff after validating the signed-in platform administrator.';
      const copy=el('button','Copy prepared handoff');copy.type='button';copy.disabled=true;
      const outcome=el('p','A draft is not an approval. Independent reviewer and owner decisions must be recorded in the authorized workflow.');
      outcome.setAttribute('role','status');
      prepare.addEventListener('click',()=>{
        try{
          assertCurrent();
          if(!questions.some(([,value])=>value===track.value))throw Error('Invalid review question');
          const tickets=references.map(entry=>entry.evidence_reference+' (UNVERIFIED_REFERENCE)');
          packet.value=['Yard Workers / Build 495 — INDEPENDENT AUTHORITY REVIEW HANDOFF',
           'Draft only — no authority granted, restricted or revoked.',
           'Created (UTC): '+new Date().toISOString(),
           'Profile ID: '+x.profile_id,
           'Account: '+x.account_name+' / '+x.account_email,
           'Current account role: '+x.global_role+' (legacy global administrator)',
           'Company ownership count: '+x.owned_company_count,
           'Requested review question: '+track.value,
           'Original source proof: NOT VERIFIED',
           'Independent signer custody: NOT VERIFIED',
           'Ticket references: '+(tickets.length?tickets.join(', '):'NONE RECORDED'),
           'Owner decision: NOT RECEIVED',
           'Reviewer action: Validate original authority, tenant scope and custody outside this read-only handoff; record a signed disposition in the authorized governance workflow.',
           'No privileged role changes or gateway releases are authorized by this packet.'].join('\n');
          copy.disabled=false;
          outcome.textContent='Prepared a reference-only draft. Share through our approved private review channel; do not put secrets into this packet.';
        }catch(e){packet.value='';copy.disabled=true;
          outcome.textContent='WITHHELD: '+(e?.message||'Platform session changed');}
      });
      copy.addEventListener('click',async()=>{
        try{
          assertCurrent();if(!packet.value||!navigator.clipboard?.writeText)
            throw Error('Copy is unavailable; select the read-only text manually');
          await navigator.clipboard.writeText(packet.value);assertCurrent();
          outcome.textContent='Handoff copied locally. No external destination was contacted.';
        }catch(e){outcome.textContent='WITHHELD: '+(e?.message||'Copy unavailable');}
      });
      trackLabel.appendChild(track);
      handoff.append(trackLabel,prepare,packet,copy,outcome);
      item.appendChild(handoff);
    }
    view.appendChild(item);
   }
   assertCurrent();
   records.replaceChildren(view);
   metrics.replaceChildren(stat('Audited accounts',r.data.length),stat('Legacy exceptions',legacy,'amber'),
    stat('Unverified references',ledger.data.length,'blue'));
   applyFilter();
   status.textContent='Audited '+r.data.length+' accounts. '+legacy+
    ' legacy global admin exception(s); '+ledger.data.length+' unverified reference(s). '+
    'Reconciled for review only; independent owner decision still required.';
  }catch(e){if(epoch===generation){records.replaceChildren();metrics.replaceChildren();status.textContent='WITHHELD: '+(e?.message||'Unverified platform authority');}}
  finally{if(epoch===generation)refresh.disabled=false;}
 });
 document.addEventListener('ywi:auth-changed',()=>{
  generation++;refresh.disabled=false;
  records.replaceChildren();metrics.replaceChildren();status.textContent='Session changed; platform audit must be reverified.';
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

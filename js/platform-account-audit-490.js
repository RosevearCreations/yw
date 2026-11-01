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
 // BUILD 498 copy-only exception follow-up remains restricted in BUILD 499 aging review.
 // BUILD 500 copy-only priority follow-up remains available in BUILD 501.
 // BUILD 502 queue readiness remains available; BUILD 503 adds a focused,
 // fail-closed resolution-readiness check per exception.
 hero.append(el('span','PLATFORM SECURITY  /  BUILD 502'),el('h3','Legacy-Role Evidence & Independent Review Intake'),
  el('p','Review restricted references, recheck local priority and individual exception readiness against the ledger, and prepare copy-only independent follow-up. No timer, reference or note grants approval or changes roles.'));
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
      const intake=el('details');intake.className='yw494-review-details';
      intake.dataset.platform496Intake=x.profile_id;
      intake.appendChild(el('summary','Independent reviewer response intake (unverified)'));
      const intakeHelp=el('p','Record or recheck only a separate reviewer’s external ticket ID. The restricted ledger can prove a reference exists, but cannot verify reviewer independence, original grant, signer custody or owner approval. No role change follows.');
      const recommendationLabel=el('label','Reported recommendation (not accepted as a decision)');
      const recommendation=el('select');recommendation.setAttribute('aria-label','Reported independent reviewer recommendation');
      const options=[['More original evidence required','MORE_EVIDENCE'],
       ['Review restriction to company scope','REVIEW_RESTRICTION'],
       ['Review removal of legacy role','REVIEW_REMOVAL'],
       ['Review retaining the existing role','REVIEW_RETENTION']];
      for(const [label,value] of options)recommendation.appendChild(new Option(label,value));
      recommendationLabel.appendChild(recommendation);
      const refLabel=el('label','External reviewer ticket ID (no URLs or secrets)');
      const decisionRef=el('input');decisionRef.type='text';decisionRef.maxLength=120;
      decisionRef.setAttribute('aria-label','Independent reviewer external ticket reference');
      decisionRef.placeholder='e.g. QL-269-REVIEW-002';refLabel.appendChild(decisionRef);
      const acknowledgement=el('label');
      const checkbox=el('input');checkbox.type='checkbox';checkbox.dataset.platform496Unverified='true';
      acknowledgement.append(checkbox,document.createTextNode(' I understand this is an unverified ticket reference, not approval.'));
      const intakeButton=el('button','Record unverified reviewer reference');intakeButton.type='button';
      const reconcileButton=el('button','Reconcile ticket against restricted ledger');
      reconcileButton.type='button';reconcileButton.dataset.platform497Reconcile='true';
      const intakeStatus=el('p','Awaiting an external reviewer ticket. No source evidence or role decision is inferred.');
      intakeStatus.setAttribute('role','status');
      const validReference=value=>/^[A-Za-z0-9][A-Za-z0-9._/-]{5,119}$/.test(value);
      const followUp=el('button','Prepare reviewer exception follow-up');followUp.type='button';
      followUp.dataset.platform498Followup='true';followUp.disabled=true;
      const followUpNote=el('textarea');followUpNote.readOnly=true;followUpNote.rows=5;
      followUpNote.hidden=true;followUpNote.dataset.platform498Note='true';
      followUpNote.setAttribute('aria-label','Local unverified reviewer exception follow-up note');
      const followUpStatus=el('p','No reviewer exception follow-up prepared.');
      followUpStatus.className='yw498-verify-state';followUpStatus.dataset.platform498Status='true';
      followUpStatus.setAttribute('aria-live','polite');
      const refreshAge=el('button','Refresh reviewer exception age');refreshAge.type='button';
      refreshAge.dataset.platform499RefreshAge='true';refreshAge.disabled=true;
      const ageStatus=el('p','No unresolved exception observed in this session.');
      ageStatus.className='yw499-age-state';ageStatus.dataset.platform499Age='true';
      ageStatus.setAttribute('aria-live','polite');
      const priorityButton=el('button','Prepare priority reviewer follow-up');priorityButton.type='button';
      priorityButton.dataset.platform500Priority='true';priorityButton.disabled=true;
      const priorityNote=el('textarea');priorityNote.readOnly=true;priorityNote.hidden=true;
      priorityNote.rows=5;priorityNote.dataset.platform500PriorityNote='true';
      priorityNote.setAttribute('aria-label','Local copy-only reviewer exception priority follow-up');
      const priorityStatus=el('p','No independently reconciled unresolved exception priority.');
      priorityStatus.className='yw500-priority-state';priorityStatus.dataset.platform500PriorityStatus='true';
      priorityStatus.setAttribute('aria-live','polite');
      const queueButton=el('button','Review local reviewer priority queue');queueButton.type='button';
      queueButton.dataset.platform501PriorityQueue='true';queueButton.disabled=true;
      const queueStatus=el('p','No unresolved reviewer exceptions queued in this device session.');
      queueStatus.className='yw501-queue-state';queueStatus.dataset.platform501QueueStatus='true';
      queueStatus.setAttribute('aria-live','polite');
      const queueList=el('ol');queueList.className='yw501-priority-list';
      queueList.dataset.platform501QueueList='true';queueList.hidden=true;
      const readinessButton=el('button','Recheck queue follow-up readiness');readinessButton.type='button';
      readinessButton.dataset.platform502Readiness='true';readinessButton.disabled=true;
      const readinessStatus=el('p','Readiness withheld until unresolved tickets are freshly checked against the restricted ledger.');
      readinessStatus.className='yw502-readiness-state';readinessStatus.dataset.platform502ReadinessStatus='true';
      readinessStatus.setAttribute('aria-live','polite');
      const readinessPacket=el('textarea');readinessPacket.readOnly=true;readinessPacket.rows=7;
      readinessPacket.dataset.platform502ReadinessPacket='true';readinessPacket.hidden=true;
      readinessPacket.setAttribute('aria-label','Copy-only reviewer priority queue readiness handoff');
      const resolutionSelect=el('select');resolutionSelect.dataset.platform503ResolutionSelect='true';
      resolutionSelect.setAttribute('aria-label','Choose unresolved reviewer exception for resolution readiness');
      resolutionSelect.disabled=true;
      const resolutionButton=el('button','Inspect selected exception resolution readiness');
      resolutionButton.type='button';resolutionButton.dataset.platform503Resolution='true';
      resolutionButton.disabled=true;
      const resolutionStatus=el('p','Choose an unresolved local exception for an independent resolution-readiness check.');
      resolutionStatus.className='yw503-resolution-state';resolutionStatus.dataset.platform503ResolutionStatus='true';
      resolutionStatus.setAttribute('role','status');resolutionStatus.setAttribute('aria-live','polite');
      const resolutionNote=el('textarea');resolutionNote.rows=5;resolutionNote.readOnly=true;
      resolutionNote.dataset.platform503ResolutionNote='true';resolutionNote.hidden=true;
      resolutionNote.setAttribute('aria-label','Copy-only individual reviewer exception resolution checklist');
      let lastException=null;
      let firstSeen=new Map();
      let priorityQueue=new Map();
      let queueRevision=0;
      const refreshResolution=()=>{
        resolutionNote.hidden=true;resolutionNote.value='';
        const prior=resolutionSelect.value;
        resolutionSelect.replaceChildren();
        resolutionSelect.appendChild(new Option('Select unresolved local ticket',''));
        for(const [key,row] of priorityQueue)
          resolutionSelect.appendChild(new Option(row.reference+' · '+row.code,key));
        resolutionSelect.value=priorityQueue.has(prior)?prior:'';
        resolutionSelect.disabled=!priorityQueue.size;
        resolutionButton.disabled=!resolutionSelect.value;
        resolutionStatus.textContent='RECHECK REQUIRED · individual resolution requires a fresh restricted ledger read and independent owner decision.';
      };
      resolutionSelect.addEventListener('change',()=>{
        resolutionButton.disabled=!resolutionSelect.value;resolutionNote.hidden=true;
        resolutionStatus.textContent='RECHECK REQUIRED · selected ticket not yet verified by a fresh ledger read.';
      });
      const queueBand=observedAt=>{
        const hours=Math.floor(Math.max(0,Date.now()-observedAt)/3600000);
        return hours>=24?{rank:0,label:'HIGH RECHECK',hours}:
          hours>=1?{rank:1,label:'RECHECK DUE',hours}:{rank:2,label:'ROUTINE RECHECK',hours};};
      const priorityBand=()=>{if(!lastException)return'NONE';
        const hours=Math.floor(Math.max(0,Date.now()-lastException.observedAt)/3600000);
        return hours>=24?'HIGH RECHECK':hours>=1?'RECHECK DUE':'ROUTINE RECHECK';};
      const ageLabel=()=>{if(!lastException)return'No unresolved exception observed in this session.';
        const elapsed=Math.max(0,Date.now()-lastException.observedAt);
        const hours=Math.floor(elapsed/3600000);
        const band=hours>=24?'RECHECK PRIORITY':hours>=1?'AGING':'JUST OBSERVED';
        return band+' · '+hours+' elapsed device hour(s) since this ticket/code was first observed. '+
          'Device-clock estimate only, not external reviewer evidence or an owner decision.';};
      const clearFollowUp=()=>{lastException=null;followUp.disabled=true;
        refreshAge.disabled=true;priorityButton.disabled=true;
        followUpNote.value='';followUpNote.hidden=true;
        priorityNote.value='';priorityNote.hidden=true;};
      const markException=(reference,code)=>{
        const id=reference+'|'+code;
        let observedAt=firstSeen.get(id);
        if(!Number.isFinite(observedAt)){
          if(firstSeen.size>=12)firstSeen.clear();
          observedAt=Date.now();firstSeen.set(id,observedAt);
        }
        if(!priorityQueue.has(id)&&priorityQueue.size>=6)
          priorityQueue=new Map([...priorityQueue].slice(-5));
        priorityQueue.set(id,{reference,code,observedAt});
        queueRevision++;readinessButton.disabled=false;
        refreshResolution();
        readinessPacket.value='';readinessPacket.hidden=true;
        readinessStatus.textContent='RECHECK REQUIRED · queue changed; fresh restricted ledger read required before follow-up.';
        queueButton.disabled=false;queueList.hidden=true;
        queueStatus.textContent='SESSION PRIORITY QUEUE READY · '+priorityQueue.size+
          ' unresolved local ticket/code observation(s), bounded to 6; review to sort by device age.';
        clearFollowUp();lastException={reference,code,observedAt};
        followUp.disabled=false;refreshAge.disabled=false;priorityButton.disabled=false;
        ageStatus.textContent=ageLabel();
        priorityStatus.textContent='LOCAL PRIORITY '+priorityBand()+
          ' · requires independent source proof and authorized owner decision.';
        followUpStatus.textContent='UNRESOLVED '+code+' · local follow-up available. No owner decision or role change.';};
      decisionRef.addEventListener('input',()=>{clearFollowUp();
        ageStatus.textContent='Ticket changed; reconcile again to inspect this device-observed exception age.';
        priorityStatus.textContent='Ticket changed; priority follow-up withdrawn until fresh restricted reconciliation.';
        followUpStatus.textContent='Ticket changed; recheck the restricted ledger before preparing a follow-up.';});
      const reconcile=async(reference,afterSave=false,expectedEntryId=null)=>{
        assertCurrent();
        const check=await sb.rpc('ywi_platform_legacy_evidence_list_493');
        assertCurrent();
        const rows=check.data;
        if(check.error||!Array.isArray(rows)||rows.length>200||rows.some(e=>
          !legacyIds.has(e.profile_id)||!Number.isSafeInteger(Number(e.entry_id))||
          !validReference(e.evidence_reference)||e.evidence_state!=='UNVERIFIED_REFERENCE'||
          !Number.isFinite(Date.parse(e.recorded_at)))||
          new Set(rows.map(e=>String(e.entry_id))).size!==rows.length)
          throw Error('Restricted ledger incomplete, foreign or inconsistent');
        const matches=rows.filter(e=>e.profile_id===x.profile_id&&e.evidence_reference===reference);
        if(matches.length>1)throw Error('Conflicting duplicate reviewer references require independent review');
        if(!matches.length){
          intakeStatus.textContent=(afterSave?'RECONCILIATION GAP: Submitted':'NOT FOUND:')+
           ' ticket '+reference+' does not appear in the freshly read restricted ledger. No decision accepted; refresh and investigate.';
          markException(reference,afterSave?'RECONCILIATION_GAP':'REFERENCE_NOT_FOUND');
          return false;
        }
        if(expectedEntryId!==null&&Number(matches[0].entry_id)!==expectedEntryId)
          throw Error('Recorded reference ID conflicts with the restricted ledger');
        intakeStatus.textContent='MATCHED 1 UNVERIFIED_REFERENCE · '+reference+' · recorded '+
          new Date(matches[0].recorded_at).toLocaleString()+
          '. Original proof NOT VERIFIED; independent reviewer recommendation not accepted. Owner decision NOT RECEIVED; no role change.';
        firstSeen=new Map([...firstSeen].filter(([id])=>!id.startsWith(reference+'|')));
        priorityQueue=new Map([...priorityQueue].filter(([id])=>!id.startsWith(reference+'|')));
        queueRevision++;readinessButton.disabled=!priorityQueue.size;
        refreshResolution();
        readinessPacket.value='';readinessPacket.hidden=true;
        readinessStatus.textContent='REFERENCE MATCHED · queue readiness must be checked again for remaining observations.';
        queueButton.disabled=!priorityQueue.size;queueList.hidden=true;
        queueStatus.textContent=priorityQueue.size?priorityQueue.size+
          ' other unresolved local observation(s) remain. Review the queue again.':
          'Matching reference removed from local priority queue; no unresolved observations remain.';
        clearFollowUp();followUpStatus.textContent='Reference present but UNVERIFIED. No exception follow-up or owner decision is inferred.';
        ageStatus.textContent='Reference found but UNVERIFIED; prior local exception age cleared. No owner decision.';
        priorityStatus.textContent='REFERENCE PRESENT · priority follow-up cleared; still no authorized role decision.';
        return true;
      };
      refreshAge.addEventListener('click',()=>{
        try{assertCurrent();
          if(!lastException||decisionRef.value.trim()!==lastException.reference)
            throw Error('Reconcile the current ticket first');
          ageStatus.textContent=ageLabel();
          priorityNote.value='';priorityNote.hidden=true;
          priorityStatus.textContent='REFRESHED LOCAL PRIORITY '+priorityBand()+
            ' · device-clock advisory only; regenerate a follow-up before using.';
        }catch(e){clearFollowUp();ageStatus.textContent='WITHHELD: '+(e?.message||'Session changed');
          priorityStatus.textContent='WITHHELD: Priority follow-up cleared on session/reconciliation failure.';}
      });
      priorityButton.addEventListener('click',()=>{
        try{assertCurrent();
          if(!lastException||decisionRef.value.trim()!==lastException.reference||
             !validReference(lastException.reference))throw Error('Reconcile the current ticket first');
          const band=priorityBand();
          priorityNote.value='QL-269 — UNDER REVIEW · INDEPENDENT REVIEWER PRIORITY FOLLOW-UP\n'+
            'Legacy account: '+x.profile_id+'\nTicket: '+lastException.reference+'\n'+
            'Restricted reconciliation exception: '+lastException.code+'\n'+
            'LOCAL RECHECK PRIORITY: '+band+' (device-clock advisory only)\n'+
            ageLabel()+'\n'+
            'Next: request original independent source proof, independently reconcile the reference, '+
            'and obtain an authorized owner decision. No signer trust, approval, role change, '+
            'private evidence, server write or external delivery recorded.';
          priorityNote.hidden=false;
          priorityStatus.textContent='COPY-ONLY '+band+' FOLLOW-UP READY · not sent, saved or approved.';
        }catch(e){clearFollowUp();priorityStatus.textContent='WITHHELD: '+(e?.message||'Reconciliation unavailable');}
      });
      queueButton.addEventListener('click',()=>{
        try{assertCurrent();
          if(!legacyIds.has(x.profile_id)||!priorityQueue.size)throw Error('Current legacy account and unresolved observations required');
          const ranked=[...priorityQueue.values()].map(entry=>({...entry,...queueBand(entry.observedAt)}))
            .sort((a,b)=>a.rank-b.rank||a.observedAt-b.observedAt||a.reference.localeCompare(b.reference));
          queueList.replaceChildren();
          for(const row of ranked){
            queueList.appendChild(el('li',row.label+' · '+row.hours+' elapsed device hour(s) · ticket '+
              row.reference+' · '+row.code+'. Independent proof and owner decision still required.'));
          }
          queueList.hidden=false;
          queueStatus.textContent='LOCAL REVIEWER PRIORITY QUEUE · '+ranked.length+
            ' observation(s), oldest/highest recheck priority first. Device-clock estimates only; not an external queue, source proof or authorization.';
        }catch(e){priorityQueue.clear();queueList.replaceChildren();queueList.hidden=true;
          queueRevision++;queueButton.disabled=true;readinessButton.disabled=true;
          refreshResolution();
          readinessPacket.value='';readinessPacket.hidden=true;
          queueStatus.textContent='WITHHELD: '+(e?.message||'Session changed');}
      });
      readinessButton.addEventListener('click',async()=>{
        const revision=queueRevision;
        readinessButton.disabled=true;readinessPacket.value='';readinessPacket.hidden=true;
        readinessStatus.textContent='Checking each unresolved observation against a fresh restricted ledger read…';
        try{
          assertCurrent();
          if(!legacyIds.has(x.profile_id)||!priorityQueue.size)throw Error('Current legacy account and unresolved queue required');
          const check=await sb.rpc('ywi_platform_legacy_evidence_list_493');
          assertCurrent();
          if(queueRevision!==revision)throw Error('Priority queue changed while checking readiness');
          const rows=check.data;
          if(check.error||!Array.isArray(rows)||rows.length>200||rows.some(e=>
            !legacyIds.has(e.profile_id)||!Number.isSafeInteger(Number(e.entry_id))||
            !validReference(e.evidence_reference)||e.evidence_state!=='UNVERIFIED_REFERENCE'||
            !Number.isFinite(Date.parse(e.recorded_at)))||
            new Set(rows.map(e=>String(e.entry_id))).size!==rows.length)
            throw Error('Restricted ledger incomplete, foreign or inconsistent');
          const ranked=[...priorityQueue.values()].map(entry=>({...entry,...queueBand(entry.observedAt)}))
            .sort((a,b)=>a.rank-b.rank||a.observedAt-b.observedAt||a.reference.localeCompare(b.reference));
          const stillMissing=[],nowPresent=[];
          for(const row of ranked){
            const matches=rows.filter(e=>e.profile_id===x.profile_id&&e.evidence_reference===row.reference);
            if(matches.length>1)throw Error('Conflicting duplicate reviewer references require independent review');
            (matches.length?nowPresent:stillMissing).push(row);
          }
          for(const row of nowPresent){
            priorityQueue=new Map([...priorityQueue].filter(([key])=>key!==row.reference+'|'+row.code));
            firstSeen=new Map([...firstSeen].filter(([key])=>key!==row.reference+'|'+row.code));
          }
          if(lastException&&nowPresent.some(row=>row.reference===lastException.reference)){
            clearFollowUp();
            priorityStatus.textContent='REFERENCE PRESENT · previously prepared priority follow-up withdrawn.';
          }
          queueRevision++;queueList.hidden=true;
          queueButton.disabled=!priorityQueue.size;
          refreshResolution();
          readinessStatus.textContent='FRESH LEDGER CHECK · '+stillMissing.length+
            ' local observation(s) still missing, '+nowPresent.length+
            ' ticket(s) now present as UNVERIFIED_REFERENCE. Missing references require independent proof; presence is not a decision.';
          if(stillMissing.length){
            readinessPacket.value=['YW Build 502 · COPY-ONLY PRIORITY FOLLOW-UP READINESS',
              'QL-269 UNDER REVIEW · Not sent, saved to server, approved or independently verified.',
              'Legacy profile: '+x.profile_id,'Fresh restricted read (UTC): '+new Date().toISOString(),
              ...stillMissing.map(row=>row.label+' · '+row.hours+' device hour(s) · '+row.reference+
                ' · '+row.code+' · reference absent from restricted ledger'),
              'Next: seek original source proof, independent reviewer reconciliation, and an authorized owner decision.',
              'Device age is advisory; no role, permission, integration gate or external queue was changed.'].join('\n');
            readinessPacket.hidden=false;
          }
        }catch(e){if(epoch===generation){readinessStatus.textContent='WITHHELD: '+
          (e?.message||'Readiness unavailable')+'. Retry the restricted read; no handoff prepared.';}}
        finally{try{assertCurrent();readinessButton.disabled=!priorityQueue.size;}
          catch{readinessButton.disabled=true;}}
      });
      resolutionButton.addEventListener('click',async()=>{
        const id=resolutionSelect.value,entry=priorityQueue.get(id),revision=queueRevision;
        resolutionButton.disabled=true;resolutionNote.hidden=true;
        resolutionStatus.textContent='Checking selected local exception against the restricted ledger…';
        try{
          assertCurrent();
          if(!legacyIds.has(x.profile_id)||!entry||!validReference(entry.reference))
            throw Error('Current legacy account and selected unresolved exception required');
          const result=await sb.rpc('ywi_platform_legacy_evidence_list_493');
          assertCurrent();
          if(queueRevision!==revision||priorityQueue.get(id)!==entry||resolutionSelect.value!==id)
            throw Error('Local queue or selected exception changed during recheck');
          const rows=result.data;
          if(result.error||!Array.isArray(rows)||rows.length>200||rows.some(e=>
            !legacyIds.has(e.profile_id)||!Number.isSafeInteger(Number(e.entry_id))||
            !validReference(e.evidence_reference)||e.evidence_state!=='UNVERIFIED_REFERENCE'||
            !Number.isFinite(Date.parse(e.recorded_at)))||
            new Set(rows.map(e=>String(e.entry_id))).size!==rows.length)
            throw Error('Restricted ledger incomplete, foreign or inconsistent');
          const matches=rows.filter(e=>e.profile_id===x.profile_id&&e.evidence_reference===entry.reference);
          if(matches.length>1)throw Error('Conflicting duplicate reviewer references');
          const presence=matches.length?'REFERENCE PRESENT AS UNVERIFIED':'REFERENCE ABSENT';
          resolutionStatus.textContent='RESOLUTION NOT READY · '+presence+
            ' · original independent proof and authorized owner decision are still required.';
          resolutionNote.value=['YW Build 503 · COPY-ONLY EXCEPTION RESOLUTION CHECKLIST',
            'QL-269 UNDER REVIEW · no integration or role activation.',
            'Legacy profile: '+x.profile_id,'Ticket: '+entry.reference,
            'Local exception: '+entry.code,'Fresh restricted ledger read (UTC): '+new Date().toISOString(),
            'Restricted reference state: '+presence,
            'PENDING: independently verify original source evidence and signer provenance.',
            'PENDING: reconcile the independent reviewer decision against owner scope.',
            'PENDING: obtain a separately authorized owner decision before any role or gate change.',
            'Not sent, approved or saved to server. Local device age is not evidence of resolution.'].join('\n');
          resolutionNote.hidden=false;
        }catch(e){if(epoch===generation){resolutionNote.value='';resolutionNote.hidden=true;
          resolutionStatus.textContent='WITHHELD: '+(e?.message||'Resolution readiness unavailable')+
            '. No resolution or authority inferred.';}}
        finally{try{assertCurrent();resolutionButton.disabled=!resolutionSelect.value;}
          catch{resolutionButton.disabled=true;}}
      });
      followUp.addEventListener('click',()=>{
        try{
          assertCurrent();
          if(!lastException||decisionRef.value.trim()!==lastException.reference||
             !validReference(lastException.reference))throw Error('Reconcile the current ticket first');
          followUpNote.value='QL-269 — UNDER REVIEW · INDEPENDENT REVIEWER EXCEPTION FOLLOW-UP\n'+
           'Legacy account: '+x.profile_id+'\nTicket reference: '+lastException.reference+'\n'+
           'Read-only reconciliation exception: '+lastException.code+'\n'+
           'First device-observed (not external proof): '+new Date(lastException.observedAt).toISOString()+'\n'+
           ageLabel()+'\n'+
           'Next: obtain independent original source proof and an authorized owner decision. '+
           'No signer trust, approval, role change, private evidence or external delivery recorded.';
          followUpNote.hidden=false;
          followUpStatus.textContent='LOCAL FOLLOW-UP READY · copy manually for authorized review. Not sent, saved or approved.';
        }catch(e){clearFollowUp();followUpStatus.textContent='WITHHELD: '+(e?.message||'Owner review required');}
      });
      reconcileButton.addEventListener('click',async()=>{
        const reference=decisionRef.value.trim();
        if(!validReference(reference)){
          intakeStatus.textContent='WITHHELD: Enter a 6–120 character reviewer ticket ID, never a URL or private evidence.';return;
        }
        clearFollowUp();reconcileButton.disabled=true;intakeStatus.textContent='Rechecking restricted references without writes…';
        try{await reconcile(reference);}catch(e){if(epoch===generation){
          intakeStatus.textContent='WITHHELD: '+(e?.message||'Restricted reconciliation unavailable');
          markException(reference,'RESTRICTED_LEDGER_WITHHELD');}}
        finally{if(epoch===generation)reconcileButton.disabled=false;}
      });
      intakeButton.addEventListener('click',async()=>{
        const reference=decisionRef.value.trim(),reported=recommendation.value;
        if(!options.some(([,value])=>value===reported)||
           !validReference(reference)||!checkbox.checked){
          intakeStatus.textContent='WITHHELD: Select a recommendation, enter a valid 6–120 character ticket ID and acknowledge its unverified status.';return;
        }
        intakeButton.disabled=true;intakeStatus.textContent='Recording a ticket reference only…';
        try{
          assertCurrent();
          const saved=await sb.rpc('ywi_platform_legacy_evidence_record_493',{
            p_profile_id:x.profile_id,p_reference:reference});
          assertCurrent();
          if(saved.error||!Number.isSafeInteger(Number(saved.data)))
            throw Error('Restricted unverified evidence record unavailable');
          checkbox.checked=false;
          intakeStatus.textContent='Reference submitted. Checking the independent restricted ledger…';
          await reconcile(reference,true,Number(saved.data));
          if(epoch===generation)intakeStatus.textContent+=' Reported '+reported+
           ' remains an unaccepted local note. Refresh the full account audit to update its counts.';
        }catch(e){if(epoch===generation){intakeButton.disabled=false;
          intakeStatus.textContent='WITHHELD: '+(e?.message||'Independent response intake denied');
          markException(reference,'RECORD_RECHECK_WITHHELD');}}
        finally{if(epoch===generation)intakeButton.disabled=false;}
      });
      intake.append(intakeHelp,recommendationLabel,refLabel,acknowledgement,
       intakeButton,reconcileButton,intakeStatus,followUp,followUpNote,followUpStatus,
       refreshAge,ageStatus,priorityButton,priorityNote,priorityStatus,
       queueButton,queueStatus,queueList,readinessButton,readinessStatus,readinessPacket,
       resolutionSelect,resolutionButton,resolutionStatus,resolutionNote);
      item.appendChild(intake);
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

/* Build 525: explicit local recovery conflict decisions and provisional findings. */
'use strict';
(function(){
  const historyKey='yw:management-recovery-history:v2';
  const maxBytes=1024;
  const same=(a,b)=>a?.version===b?.version&&a?.focus===b?.focus&&a?.density===b?.density;
  const label=items=>items.length?items.map((x,i)=>`${i+1}. ${x.focus} · ${x.density}`).join(' | '):'No local snapshots';
  function mount(){
    const prior=document.getElementById('owner524History');
    const api=window.YWIOwnerManagementHistory524;
    if(!prior||!api?.getSnapshots||document.getElementById('owner525Retest'))return;
    const section=document.createElement('section');
    section.id='owner525Retest';section.dataset.build='525';section.className='admin-panel-block yw525-retest';
    section.setAttribute('aria-labelledby','owner525Title');
    section.innerHTML='<header><span class="yw525-kicker">Yard Workers · Management / Build 525</span>'+ 
      '<h4 id="owner525Title">Resolve recovery conflicts and retest accessibility</h4>'+ 
      '<p>Compare local and imported version 2 histories before deciding whether to keep, append or replace. Export only provisional, manually observed accessibility findings.</p></header>'+ 
      '<div class="yw525-compare" aria-label="Recovery history conflict review">'+ 
      '<div><h5>This device</h5><p id="owner525Local">No local snapshots</p></div>'+ 
      '<div><h5>Inspected import</h5><p id="owner525Incoming">Select a v2 history file above.</p></div></div>'+ 
      '<p id="owner525ConflictStatus" role="status" aria-live="polite" aria-atomic="true">No import is awaiting a decision.</p>'+ 
      '<div class="yw525-actions"><button id="owner525Backup" type="button">Download local backup first</button>'+ 
      '<button id="owner525Keep" type="button" disabled>Keep local history</button>'+ 
      '<button id="owner525Append" type="button" disabled>Append inspected history</button>'+ 
      '<button id="owner525Replace" type="button" disabled>Replace with inspected history</button>'+ 
      '<button id="owner525Undo" type="button" disabled>Undo last history change</button></div>'+ 
      '<div class="yw525-findings" aria-labelledby="owner525FindingTitle"><h5 id="owner525FindingTitle">Owner retest and accessibility finding draft</h5>'+ 
      '<p>Complete the Build 522 keyboard check and Build 524 assistive-technology checklist above. Record observations without customer information; this is not final owner acceptance.</p>'+ 
      '<div class="yw525-fields"><label for="owner525Category">Finding area<select id="owner525Category"><option value="keyboard">Keyboard navigation</option><option value="screen_reader">Screen reader</option><option value="zoom">Zoom and responsive layout</option><option value="contrast">Contrast and focus</option></select></label>'+ 
      '<label for="owner525Outcome">Local retest outcome<select id="owner525Outcome"><option value="not_run">Not run</option><option value="follow_up">Follow-up needed</option><option value="observed_local">Observed locally</option></select></label></div>'+ 
      '<label for="owner525Notes">Finding notes (240 characters maximum; no personal or customer details)<textarea id="owner525Notes" maxlength="240" rows="3" placeholder="Describe what was observed on this device only"></textarea></label>'+ 
      '<div class="yw525-actions"><button id="owner525Review" type="button">Review provisional retest</button>'+ 
      '<button id="owner525Export" type="button" disabled>Download finding draft</button></div>'+ 
      '<p id="owner525FindingStatus" role="status" aria-live="polite" aria-atomic="true">No retest reviewed. Manual owner acceptance remains outstanding.</p></div>'+ 
      '<p class="yw525-boundary">Local display history and manual findings only. No network delivery, business source changes, customer records, formal sign-off, or credential transfer. QL-269 remains <strong>UNDER REVIEW</strong>.</p>';
    prior.after(section);
    const $=id=>section.querySelector('#'+id);
    const file=document.getElementById('owner524File'),merge=document.getElementById('owner524Merge');
    const status=$('owner525ConflictStatus');
    let pending=null,conflict=false,approved=false,undo=null,sequence=0,draft=null;
    const safeLocal=()=>api.getSnapshots();
    function render(){
      const local=safeLocal();conflict=Boolean(pending&&local&&local.length&&
        (local.length!==pending.length||local.some((item,i)=>!same(item,pending[i]))));
      $('owner525Local').textContent=local?label(local):'Local history unavailable or invalid; reset it above first.';
      $('owner525Incoming').textContent=pending?label(pending):'Select a v2 history file above.';
      $('owner525Keep').disabled=!pending;
      $('owner525Append').disabled=!pending||!local;
      $('owner525Replace').disabled=!pending||!local;
      $('owner525Undo').disabled=!undo||!local;
    }
    function clear(message){pending=null;approved=false;sequence++;render();status.textContent=message;}
    file.addEventListener('change',async()=>{
      const token=++sequence;pending=null;approved=false;render();
      const chosen=file.files?.[0];
      if(!chosen){status.textContent='No import selected. Local history is unchanged.';return;}
      if(chosen.size>maxBytes){status.textContent='Import exceeds 1 KB and cannot be compared.';return;}
      try{const raw=await chosen.text();if(token!==sequence)return;
        if(new TextEncoder().encode(raw).length>maxBytes)throw Error('size');
        const packet=JSON.parse(raw);
        if(!api.validate(packet))throw Error('schema');
        pending=packet.snapshots.map(item=>({...item}));render();
        status.textContent=conflict?
          'DIFFERENCE FOUND · Your existing snapshots may be displaced by a five-item append. Download a local backup, then explicitly Keep, Append or Replace.':
          'No differing local snapshots detected. Review the inspected file before choosing an action.';
      }catch{status.textContent='Invalid or unsupported history file. Nothing was changed.';}
      render();
    });
    merge.addEventListener('click',event=>{
      if(!pending&&file.files?.length){event.preventDefault();event.stopImmediatePropagation();
        status.textContent='Wait for history comparison before applying an import.';return;}
      if(pending&&conflict&&!approved){event.preventDefault();event.stopImmediatePropagation();
        status.textContent='Append paused. Use the explicit Append inspected history choice below.';
        $('owner525Append').focus();}
    },true);
    $('owner525Keep').addEventListener('click',()=>{
      if(!pending)return;api.discardPending();clear('Kept local history; inspected import discarded.');
    });
    $('owner525Append').addEventListener('click',()=>{
      const before=safeLocal();if(!pending||!before||merge.disabled)return;
      approved=true;merge.click();approved=false;
      const after=safeLocal();
      if(after){undo=before;clear('Inspected history appended. Undo can restore the previous local snapshots during this session.');}
    });
    $('owner525Replace').addEventListener('click',()=>{
      const before=safeLocal();if(!pending||!before)return;
      if(api.replaceSnapshots(pending,'Inspected display history replaced after explicit conflict review.')){
        undo=before;clear('Inspected history replaced. Undo can restore the local snapshots from before replacement.');}
    });
    $('owner525Undo').addEventListener('click',()=>{
      if(!undo)return;
      if(api.replaceSnapshots(undo,'Previous display-only recovery history restored.')){
        undo=null;clear('Previous device recovery history restored. No evidence or approval was changed.');}
    });
    $('owner525Backup').addEventListener('click',()=>{
      if(safeLocal())document.getElementById('owner524Export').click();
      status.textContent='Local recovery file requested. Keep the downloaded version 2 JSON privately before replacing anything.';
    });
    document.getElementById('owner524Clear').addEventListener('click',()=>{undo=null;render();});
    document.getElementById('owner524Snapshot').addEventListener('click',render);
    document.getElementById('owner524Migrate').addEventListener('click',render);
    const fields=['owner525Category','owner525Outcome','owner525Notes'];
    const invalidate=()=>{
      draft=null;$('owner525Export').disabled=true;
      $('owner525FindingStatus').textContent='Finding changed. Review provisional retest again before exporting.';
    };
    for(const id of fields)for(const type of ['change','input'])$(id).addEventListener(type,invalidate);
    for(const id of ['owner524Reader','owner524Focus','owner524Zoom'])
      document.getElementById(id)?.addEventListener('change',invalidate);
    for(const id of ['owner522Start','owner522Review'])
      document.getElementById(id)?.addEventListener('click',invalidate);
    $('owner525Review').addEventListener('click',()=>{
      const keyboard=(document.getElementById('owner522NavStatus')?.textContent||'').includes('LOCAL NAVIGATION OBSERVED');
      const reader=document.getElementById('owner524Reader')?.checked===true;
      const focus=document.getElementById('owner524Focus')?.checked===true;
      const zoom=document.getElementById('owner524Zoom')?.checked===true;
      const outcome=$('owner525Outcome').value;
      const note=$('owner525Notes').value.trim().slice(0,240);
      draft={format:'yw-management-accessibility-finding-draft',schema_version:1,
        category:$('owner525Category').value,outcome,note,
        observations:{keyboard_return:keyboard,screen_reader:reader,focus,zoom}};
      const full=keyboard&&reader&&focus&&zoom&&outcome==='observed_local';
      $('owner525FindingStatus').textContent=(full?'LOCAL RETEST OBSERVED':'RETEST FOLLOW-UP REQUIRED')+
        ' · keyboard source/return '+(keyboard?'observed':'not verified')+
        '; screen reader '+(reader?'self-reported':'not checked')+
        '; focus '+(focus?'self-reported':'not checked')+
        '; zoom '+(zoom?'self-reported':'not checked')+
        '. Draft only; independent manual owner acceptance and source verification remain outstanding.';
      $('owner525Export').disabled=false;
    });
    $('owner525Export').addEventListener('click',()=>{
      if(!draft)return;
      const raw=JSON.stringify(draft)+'\n';
      if(new TextEncoder().encode(raw).length>maxBytes){
        $('owner525FindingStatus').textContent='Draft exceeds 1 KB; download refused.';return;}
      const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;
      link.download='yard-workers-accessibility-finding-draft.json';
      document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
      $('owner525FindingStatus').textContent='Provisional finding draft exported locally. No external delivery, audit receipt or owner sign-off was created.';
    });
    render();
  }
  const owner=window.YWIOwnerManagementCommandUI;
  if(owner?.mount){const original=owner.mount;
    owner.mount=function(...args){const result=original.apply(this,args);mount();return result;};}
  window.YWIOwnerManagementRetest525={mount,historyKey};
})();

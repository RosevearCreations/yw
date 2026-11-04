/* Build 523: review local/import conflicts and recover display-only preferences. */
'use strict';
(function(){
  const format='yard-workers-management-display-view';
  const maxBytes=1024;
  const valid=value=>window.YWIOwnerManagementPortability522?.validate?.(value)===true;
  const pref=value=>window.YWIOwnerManagementWorkspace521?.validate?.(value)===true;
  const same=(a,b)=>Boolean(a&&b&&a.focus===b.focus&&a.density===b.density&&a.version===b.version);
  function mount(){
    const portable=document.getElementById('owner522Portability');
    const area=document.getElementById('owner521Area');
    const density=document.getElementById('owner521Density');
    if(!portable||!area||!density||document.getElementById('owner523ConflictReview'))return;
    const section=document.createElement('section');
    section.id='owner523ConflictReview';section.dataset.build='523';
    section.className='admin-panel-block yw523-conflicts';
    section.setAttribute('aria-labelledby','owner523Title');
    section.innerHTML='<header><span class="yw523-kicker">Yard Workers · Management / Build 523</span>'+ 
      '<h4 id="owner523Title">Compare saved views before replacing one</h4>'+ 
      '<p>Take a display-only recovery file to another device, inspect differences, and choose which view to keep. This is file transfer, not cloud synchronization.</p></header>'+ 
      '<div class="yw523-comparison" id="owner523Comparison" aria-label="Local and imported display preferences">'+ 
      '<div><h5>This device</h5><p id="owner523Local">All evidence · Comfortable spacing</p></div>'+ 
      '<div><h5>Imported file</h5><p id="owner523Incoming">Choose a portable view file above to compare.</p></div></div>'+ 
      '<p id="owner523ConflictStatus" role="status" aria-live="polite" aria-atomic="true">Nothing to compare. Your current workspace remains unchanged.</p>'+ 
      '<div class="yw523-actions"><button id="owner523Backup" type="button">Download recovery copy</button>'+ 
      '<button id="owner523Keep" type="button" disabled>Keep this device’s view</button>'+ 
      '<button id="owner523Replace" type="button" disabled>Replace with imported view</button>'+ 
      '<button id="owner523Undo" type="button" disabled>Undo last import</button></div>'+ 
      '<div class="yw523-accessibility" aria-labelledby="owner523AccessTitle"><h5 id="owner523AccessTitle">Evidence accessibility follow-up</h5>'+ 
      '<p>Use the Build 522 keyboard source-and-return check above. Then note what was actually observed in this browser; these checks are not a certification.</p>'+ 
      '<label><input id="owner523FocusSeen" type="checkbox" /> I observed a visible keyboard focus indicator on this device</label>'+ 
      '<label><input id="owner523ZoomSeen" type="checkbox" /> I reviewed layout at 200% zoom or a narrow screen on this device</label>'+ 
      '<button id="owner523Assess" type="button">Review local observations</button>'+ 
      '<p id="owner523AccessStatus" role="status" aria-live="polite" aria-atomic="true">Not reviewed; manual device and assistive-technology acceptance remains outstanding.</p></div>'+ 
      '<p class="yw523-boundary">Recovery copies contain area/spacing choices only. No user identifiers, evidence, approvals or original-source records are transferred. QL-269 remains <strong>UNDER REVIEW</strong>.</p>';
    portable.after(section);
    const $=id=>section.querySelector('#'+id);
    const file=document.getElementById('owner522Import');
    const apply=document.getElementById('owner522Apply');
    const discard=document.getElementById('owner522Discard');
    const recover=document.getElementById('owner522Recover');
    const current=()=>({version:1,focus:area.value,density:density.value});
    const describe=p=>p?`${p.focus} evidence area · ${p.density} spacing`:'No imported view selected';
    const status=$('owner523ConflictStatus');
    let pending=null,conflict=false,approved=false,undoValue=null,sequence=0;
    function render(){
      conflict=Boolean(pending&&!same(current(),pending));
      $('owner523Local').textContent=describe(current());
      $('owner523Incoming').textContent=pending?describe(pending):'Choose a portable view file above to compare.';
      $('owner523Keep').disabled=!pending;
      $('owner523Replace').disabled=!pending||!conflict;
      $('owner523Undo').disabled=!undoValue;
    }
    function clear(reason){pending=null;conflict=false;approved=false;sequence++;render();status.textContent=reason;}
    file.addEventListener('change',async()=>{
      const token=++sequence;pending=null;conflict=false;approved=false;render();
      const selected=file.files?.[0];
      if(!selected){status.textContent='No portable view selected. Current workspace unchanged.';return;}
      if(selected.size>maxBytes){status.textContent='File too large for comparison. Current workspace unchanged.';return;}
      try{
        const raw=await selected.text();
        if(token!==sequence)return;
        if(new TextEncoder().encode(raw).length>maxBytes)throw new Error('size');
        const packet=JSON.parse(raw);
        if(!valid(packet))throw new Error('schema');
        pending=packet.preferences;conflict=!same(current(),pending);
        status.textContent=conflict?
          'DIFFERENCE FOUND · Review both views. Standard Apply is guarded until you explicitly choose Replace with imported view. Download a recovery copy first if needed.':
          'MATCH · The file has the same area and spacing choices. No conflict to resolve.';
      }catch{status.textContent='Unrecognized or unsafe display-view file. Import cannot be compared or authorized.';}
      render();
    });
    apply.addEventListener('click',event=>{
      if(!pending&&file.files?.length){
        event.preventDefault();event.stopImmediatePropagation();
        status.textContent='Apply paused until the portable file comparison is complete.';return;
      }
      if(!pending||!conflict||approved)return;
      event.preventDefault();event.stopImmediatePropagation();
      status.textContent='Replacement paused: compare preferences, then select Replace with imported view or Keep this device’s view.';
      $('owner523Replace').focus();
    },true);
    $('owner523Keep').addEventListener('click',()=>{
      if(!pending)return;discard.click();clear('Kept this device’s preferences. Imported file discarded without any change.');
    });
    $('owner523Replace').addEventListener('click',()=>{
      if(!pending||!conflict||!pref(current()))return;
      const before=current();approved=true;apply.click();approved=false;
      if(same(current(),pending)){
        undoValue=before;
        clear('Imported display view applied. Your previous device view can be restored with Undo last import during this session.');
      }else{status.textContent='Replacement was not verified; current display view was preserved.';render();}
    });
    $('owner523Backup').addEventListener('click',()=>{
      if(pref(current()))document.getElementById('owner522Export').click();
      render();status.textContent='Recovery file requested. Keep the downloaded JSON file privately; import it on another device to preview your display choices.';
    });
    $('owner523Undo').addEventListener('click',()=>{
      if(!pref(undoValue))return;
      area.value=undoValue.focus;area.dispatchEvent(new Event('change',{bubbles:true}));
      density.value=undoValue.density;density.dispatchEvent(new Event('change',{bubbles:true}));
      document.getElementById('owner521Save').click();
      undoValue=null;render();
      status.textContent='Previous display view restored on this device. Only visual preferences changed; source evidence remains untouched.';
    });
    discard.addEventListener('click',()=>clear('Import discarded. Current view preserved.'));
    recover.addEventListener('click',()=>{undoValue=null;clear('Safe defaults restored. Recovery is limited to display preferences.');});
    area.addEventListener('change',render);density.addEventListener('change',render);
    $('owner523Assess').addEventListener('click',()=>{
      const navigation=document.getElementById('owner522NavStatus')?.textContent||'';
      const keyboard=navigation.includes('LOCAL NAVIGATION OBSERVED');
      const focus=$('owner523FocusSeen').checked;
      const zoom=$('owner523ZoomSeen').checked;
      const all=keyboard&&focus&&zoom;
      const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
      $('owner523AccessStatus').textContent=(all?'LOCAL OBSERVATIONS NOTED':'FOLLOW-UP NEEDED')+
        ' · keyboard source/return '+(keyboard?'observed':'not verified')+
        '; focus indicator '+(focus?'self-reported':'not checked')+
        '; narrow/zoom layout '+(zoom?'self-reported':'not checked')+
        '; reduced-motion preference '+(reduce?'requested':'not requested')+
        '. No owner sign-off, formal accessibility certification or source approval recorded.';
    });
    render();
  }
  const owner=window.YWIOwnerManagementCommandUI;
  if(owner?.mount){const original=owner.mount;
    owner.mount=function(...args){const result=original.apply(this,args);mount();return result;};}
  window.YWIOwnerManagementConflicts523={mount,format};
})();

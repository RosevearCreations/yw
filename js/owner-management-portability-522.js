/* Build 522: portable display-only views, recovery and local evidence-navigation check. */
'use strict';
(function(){
  const format='yard-workers-management-display-view';
  const maxBytes=1024;
  const prefKey='yw:management-workspace-display:v521';
  const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
    Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
  const validPacket=value=>exact(value,['format','schema_version','preferences'])&&
    value.format===format&&value.schema_version===1&&
    window.YWIOwnerManagementWorkspace521?.validate?.(value.preferences)===true;
  function mount(){
    const owner=document.getElementById('owner521Workspace');
    const map=document.querySelector('.owner520-navigation');
    if(!owner||!map||document.getElementById('owner522Portability'))return;
    const section=document.createElement('section');
    section.id='owner522Portability';section.className='admin-panel-block yw522-portability';
    section.dataset.build='522';section.setAttribute('aria-labelledby','owner522Title');
    section.innerHTML='<header><span class="yw522-kicker">Yard Workers · Management / Build 522</span><h4 id="owner522Title">Recover and carry your review workspace</h4><p>Move only your visual area and spacing choices between devices. Review the import before applying it; no source data is copied.</p></header>'+ 
      '<div class="yw522-tools"><button id="owner522Export" type="button">Export display view</button>'+ 
      '<label for="owner522Import">Choose a saved view file<input id="owner522Import" type="file" accept=".json,application/json" /></label>'+ 
      '<button id="owner522Apply" type="button" disabled>Apply inspected view</button>'+ 
      '<button id="owner522Discard" type="button">Discard import</button>'+ 
      '<button id="owner522Recover" type="button">Recover defaults</button></div>'+ 
      '<p id="owner522ImportStatus" role="status" aria-live="polite" aria-atomic="true">No import selected. Export contains preferences only, never evidence.</p>'+ 
      '<div class="yw522-check"><h5>Evidence navigation acceptance check</h5><p>Locally check one permitted source link and return focus to its map. This check does not certify accessibility or record owner approval.</p>'+ 
      '<button id="owner522Start" type="button">Begin keyboard navigation check</button><button id="owner522Review" type="button" disabled>Review local check</button>'+ 
      '<p id="owner522NavStatus" role="status" aria-live="polite">Not checked · source evidence must still be independently verified.</p></div>'+ 
      '<p class="yw522-boundary">No network upload, account transfer, original-source snapshot, Finance authorization, closure or signed receipt. QL-269 remains <strong>UNDER REVIEW</strong>.</p>';
    owner.after(section);
    const $=id=>section.querySelector('#'+id);
    const area=document.getElementById('owner521Area');
    const density=document.getElementById('owner521Density');
    const importFile=$('owner522Import');
    const apply=$('owner522Apply');
    const importStatus=$('owner522ImportStatus');
    const checkStatus=$('owner522NavStatus');
    const review=$('owner522Review');
    let pending=null,check={active:false,opened:false,returned:false};
    const current=()=>({version:1,focus:area.value,density:density.value});
    $('owner522Export').addEventListener('click',()=>{
      const prefs=current();if(!window.YWIOwnerManagementWorkspace521.validate(prefs)){
        importStatus.textContent='Current view is invalid; export was not created.';return;}
      const serialized=JSON.stringify({format,schema_version:1,preferences:prefs})+'\n';
      const blob=new Blob([serialized],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='yard-workers-management-view.json';
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),0);
      importStatus.textContent='Display-only view exported. No evidence, account data or approvals included.';
    });
    importFile.addEventListener('change',async()=>{
      pending=null;apply.disabled=true;
      const file=importFile.files?.[0];if(!file){importStatus.textContent='No import selected.';return;}
      if(file.size>maxBytes){importStatus.textContent='Import rejected: file exceeds 1 KB display-view limit.';return;}
      try{const raw=await file.text();
        if(new TextEncoder().encode(raw).length>maxBytes)throw new Error('oversized');
        const parsed=JSON.parse(raw);if(!validPacket(parsed))throw new Error('schema');
        pending=parsed.preferences;apply.disabled=false;
        importStatus.textContent='Inspected display view: '+pending.focus+' area, '+pending.density+
          ' spacing. Select Apply inspected view to replace current display preferences; no evidence imported.';
      }catch{importStatus.textContent='Import rejected: invalid, oversized or unsupported display-view JSON. Current view unchanged.';}
    });
    apply.addEventListener('click',()=>{
      if(!pending||!validPacket({format,schema_version:1,preferences:pending}))return;
      area.value=pending.focus;area.dispatchEvent(new Event('change',{bubbles:true}));
      density.value=pending.density;density.dispatchEvent(new Event('change',{bubbles:true}));
      document.getElementById('owner521Save').click();
      let saved=false;try{const disk=JSON.parse(localStorage.getItem(prefKey)||'null');
        saved=JSON.stringify(disk)===JSON.stringify(pending);}catch{}
      importStatus.textContent=saved?'Imported and saved display view on this device. Source evidence unchanged.':
        'Imported view applied for this session; device persistence unavailable. Source evidence unchanged.';
      pending=null;apply.disabled=true;importFile.value='';
    });
    $('owner522Discard').addEventListener('click',()=>{
      pending=null;apply.disabled=true;importFile.value='';
      importStatus.textContent='Import discarded. Current display view unchanged.';
    });
    $('owner522Recover').addEventListener('click',()=>{
      pending=null;apply.disabled=true;importFile.value='';
      document.getElementById('owner521Reset').click();
      importStatus.textContent='Default review workspace recovered. Only display preferences were reset.';
    });
    if(document.getElementById('owner521Status')?.textContent.includes('invalid'))
      importStatus.textContent='Damaged saved-view setting detected. Use Recover defaults or inspect a portable file.';
    $('owner522Start').addEventListener('click',()=>{
      check={active:false,opened:false,returned:false};review.disabled=true;
      if(!map.querySelector('#owner520Navigation .yw520-path a[href^="#owner"]')){
        checkStatus.textContent='SOURCE WITHHELD · no permitted evidence route is available for a local navigation check.';return;}
      check.active=true;checkStatus.textContent='Check started. Use Tab and Enter to open a permitted source link, then Return to evidence map.';
    });
    map.addEventListener('click',event=>{
      if(!check.active||!event.target.closest?.('#owner520Navigation a[href^="#owner"]'))return;
      if(document.activeElement?.id?.startsWith('owner')){
        check.opened=true;review.disabled=false;checkStatus.textContent='Source focus observed. Return to the evidence map before reviewing the check.';
      }
    });
    document.getElementById('owner521Return').addEventListener('click',()=>{
      if(!check.active||!check.opened)return;
      const focused=document.activeElement?.closest?.('#owner520Navigation a[href^="#owner"]');
      check.returned=Boolean(focused);
      checkStatus.textContent=check.returned?'Map focus returned in this session. Review the local check.':
        'Focus return not verified; repeat the navigation check.';
    });
    review.addEventListener('click',()=>{
      checkStatus.textContent=check.opened&&check.returned?
        'LOCAL NAVIGATION OBSERVED · source and return focus completed. Manual device/assistive-technology acceptance remains required; no owner approval recorded.':
        'INCOMPLETE · open a permitted source and return keyboard focus before manual acceptance.';
      check.active=false;review.disabled=true;
    });
  }
  const owner=window.YWIOwnerManagementCommandUI;
  if(owner?.mount){const original=owner.mount;
    owner.mount=function(...args){const result=original.apply(this,args);mount();return result;};}
  window.YWIOwnerManagementPortability522={mount,validate:validPacket};
})();

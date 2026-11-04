/* Build 524: versioned display-only recovery history and local accessibility review. */
'use strict';
(function(){
  const key='yw:management-recovery-history:v2';
  const legacy='yw:management-workspace-display:v521';
  const format='yard-workers-management-recovery-history';
  const maxBytes=1024,maxSnapshots=5;
  const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
    Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
  const pref=value=>window.YWIOwnerManagementWorkspace521?.validate?.(value)===true;
  const valid=value=>exact(value,['format','schema_version','snapshots'])&&
    value.format===format&&value.schema_version===2&&
    Array.isArray(value.snapshots)&&value.snapshots.length<=maxSnapshots&&
    value.snapshots.every(pref);
  const packet=snapshots=>({format,schema_version:2,snapshots});
  const same=(a,b)=>a?.version===b?.version&&a?.focus===b?.focus&&a?.density===b?.density;
  function read(){
    let raw;
    try{raw=localStorage.getItem(key);}catch{return {snapshots:[],state:'unavailable'};}
    if(raw===null)return {snapshots:[],state:'empty'};
    try{if(new TextEncoder().encode(raw).length>maxBytes)throw Error('oversize');
      const value=JSON.parse(raw);
      return valid(value)?{snapshots:value.snapshots.slice(),state:'restored'}:
        {snapshots:[],state:'invalid'};
    }catch{return {snapshots:[],state:'invalid'};}
  }
  function mount(){
    const previous=document.getElementById('owner523ConflictReview');
    const area=document.getElementById('owner521Area');
    const density=document.getElementById('owner521Density');
    if(!previous||!area||!density||document.getElementById('owner524History'))return;
    const section=document.createElement('section');
    section.id='owner524History';section.dataset.build='524';
    section.className='admin-panel-block yw524-history';
    section.setAttribute('aria-labelledby','owner524Title');
    section.innerHTML='<header><span class="yw524-kicker">Yard Workers · Management / Build 524</span>'+ 
      '<h4 id="owner524Title">Recovery history and version migration</h4>'+ 
      '<p>Keep up to five local snapshots of review area and spacing. Version 1 preferences can be copied into a version 2 history without deleting the original. Files never contain source records.</p></header>'+ 
      '<div class="yw524-actions"><button id="owner524Migrate" type="button">Copy saved v1 view to history</button>'+ 
      '<button id="owner524Snapshot" type="button">Save current display snapshot</button>'+ 
      '<button id="owner524Export" type="button">Export v2 recovery history</button>'+ 
      '<label for="owner524File">Import v2 history file<input id="owner524File" type="file" accept=".json,application/json" /></label>'+ 
      '<button id="owner524Merge" type="button" disabled>Append inspected history</button></div>'+ 
      '<div class="yw524-restore"><label for="owner524Select">Local recovery snapshots<select id="owner524Select" aria-describedby="owner524Status"></select></label>'+ 
      '<button id="owner524Restore" type="button" disabled>Restore selected display view</button>'+ 
      '<button id="owner524Clear" type="button">Clear recovery history</button></div>'+ 
      '<p id="owner524Status" role="status" aria-live="polite" aria-atomic="true">Checking display-only recovery history.</p>'+ 
      '<div class="yw524-acceptance" aria-labelledby="owner524AcceptanceTitle"><h5 id="owner524AcceptanceTitle">Assistive-technology follow-up workbench</h5>'+ 
      '<p>Complete the Build 522 keyboard navigation check first. These checkboxes capture only what we observed in this browser, not approval or a formal accessibility certification.</p>'+ 
      '<label><input id="owner524Reader" type="checkbox" /> I manually checked spoken labels and status updates with a screen reader</label>'+ 
      '<label><input id="owner524Focus" type="checkbox" /> I checked keyboard focus and source-return behaviour</label>'+ 
      '<label><input id="owner524Zoom" type="checkbox" /> I checked zoom/narrow layout and reduced-motion behaviour</label>'+ 
      '<button id="owner524Review" type="button">Review local follow-up</button>'+ 
      '<p id="owner524AcceptanceStatus" role="status" aria-live="polite">Not reviewed. Manual assistive-technology acceptance remains outstanding.</p></div>'+ 
      '<p class="yw524-boundary">Local snapshots only; no tenant identifiers, evidence, credentials, receipts, external transfer or owner sign-off. QL-269 remains <strong>UNDER REVIEW</strong>.</p>';
    previous.after(section);
    const $=id=>section.querySelector('#'+id);
    const current=()=>({version:1,focus:area.value,density:density.value});
    const status=$('owner524Status');
    const initial=read();let snapshots=initial.snapshots,invalid=initial.state==='invalid';
    let pending=null,importSequence=0,clearArmed=false;
    function render(){
      const select=$('owner524Select'),prior=select.value;
      select.replaceChildren();
      snapshots.forEach((item,i)=>{const option=document.createElement('option');
        option.value=String(i);option.textContent=`${i+1}. ${item.focus} area · ${item.density} spacing`;
        select.appendChild(option);});
      if([...select.options].some(x=>x.value===prior))select.value=prior;
      $('owner524Restore').disabled=invalid||snapshots.length===0;
      $('owner524Merge').disabled=invalid||!pending;
      $('owner524Snapshot').disabled=invalid;
      $('owner524Migrate').disabled=invalid;
      $('owner524Export').disabled=invalid;
    }
    function persist(message){
      const value=packet(snapshots);
      if(!valid(value))throw Error('invalid recovery history');
      try{localStorage.setItem(key,JSON.stringify(value));status.textContent=message;}
      catch{status.textContent=message+' Device storage unavailable; this history is session-only.';}
      render();
    }
    function append(items,verb){
      clearArmed=false;
      let added=0;
      for(const item of items){if(!pref(item))continue;
        if(same(snapshots[snapshots.length-1],item))continue;
        snapshots.push({version:1,focus:item.focus,density:item.density});added++;
        if(snapshots.length>maxSnapshots)snapshots.shift();}
      persist(added?`${verb}: ${added} display snapshot(s) added. History keeps only the latest five.`:
        `${verb}: no new display choices; existing history preserved.`);
    }
    status.textContent=invalid?'Saved v2 history is invalid. No data was replaced. Clear history twice to start safely.':
      initial.state==='unavailable'?'Local history storage unavailable; only this session can be used.':
      initial.state==='restored'?'Existing version 2 display history restored on this device.':
      'No recovery history yet. Create a snapshot or copy an existing version 1 saved view.';
    $('owner524Migrate').addEventListener('click',()=>{
      if(invalid)return;
      try{const raw=localStorage.getItem(legacy);
        if(raw===null||new TextEncoder().encode(raw).length>256)throw Error('missing');
        const value=JSON.parse(raw);if(!pref(value))throw Error('unsupported');
        append([value],'Version 1 copied to version 2');
      }catch{status.textContent='No valid version 1 saved view to migrate. Original preferences were not modified.';}
    });
    $('owner524Snapshot').addEventListener('click',()=>{if(!invalid&&pref(current()))append([current()],'Snapshot saved');});
    $('owner524Restore').addEventListener('click',()=>{
      clearArmed=false;
      const item=snapshots[Number($('owner524Select').value)];
      if(invalid||!pref(item))return;
      area.value=item.focus;area.dispatchEvent(new Event('change',{bubbles:true}));
      density.value=item.density;density.dispatchEvent(new Event('change',{bubbles:true}));
      document.getElementById('owner521Save').click();
      status.textContent=`Restored ${item.focus} / ${item.density} display view. Source records and owner decisions remain unchanged.`;
    });
    $('owner524Export').addEventListener('click',()=>{
      if(invalid)return;const raw=JSON.stringify(packet(snapshots))+'\n';
      if(new TextEncoder().encode(raw).length>maxBytes){status.textContent='Recovery file exceeded the 1 KB limit; export refused.';return;}
      const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download='yard-workers-recovery-history-v2.json';
      document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
      status.textContent='Version 2 history exported with display preferences only; store the file privately.';
    });
    $('owner524File').addEventListener('change',async()=>{
      clearArmed=false;
      const token=++importSequence;pending=null;render();
      const file=$('owner524File').files?.[0];
      if(!file){status.textContent='No history file selected.';return;}
      if(file.size>maxBytes){status.textContent='History import refused: file exceeds 1 KB.';return;}
      try{const raw=await file.text();if(token!==importSequence)return;
        if(new TextEncoder().encode(raw).length>maxBytes)throw Error('oversize');
        const value=JSON.parse(raw);if(!valid(value))throw Error('schema');
        pending=value.snapshots.map(x=>({...x}));
        status.textContent=`Inspected v2 history with ${pending.length} display snapshot(s). Select Append inspected history to merge; current history is unchanged.`;
      }catch{status.textContent='History import rejected: invalid or unsupported v2 display-only JSON. Current history unchanged.';}
      render();
    });
    $('owner524Merge').addEventListener('click',()=>{
      if(invalid||!pending)return;const incoming=pending;
      pending=null;importSequence++;$('owner524File').value='';
      append(incoming,'Inspected version 2 history appended');
    });
    $('owner524Clear').addEventListener('click',()=>{
      if(!clearArmed){clearArmed=true;status.textContent='Press Clear recovery history again to remove only the local v2 snapshots. Original v1 view remains.';return;}
      clearArmed=false;pending=null;importSequence++;$('owner524File').value='';
      try{localStorage.removeItem(key);snapshots=[];invalid=false;
        status.textContent='Local v2 recovery history cleared. Original v1 saved view preserved.';}
      catch{snapshots=[];invalid=false;status.textContent='Session history cleared; device storage could not be cleared.';}
      render();
    });
    $('owner524Review').addEventListener('click',()=>{
      const observed=(document.getElementById('owner522NavStatus')?.textContent||'').includes('LOCAL NAVIGATION OBSERVED');
      const reader=$('owner524Reader').checked,focus=$('owner524Focus').checked,zoom=$('owner524Zoom').checked;
      const ready=reader&&focus&&zoom&&observed;
      $('owner524AcceptanceStatus').textContent=(ready?'LOCAL OBSERVATIONS DOCUMENTED':'FOLLOW-UP OUTSTANDING')+
        ' · source/return '+(observed?'observed':'not verified')+
        '; screen reader '+(reader?'self-reported':'not checked')+
        '; keyboard focus '+(focus?'self-reported':'not checked')+
        '; zoom/motion '+(zoom?'self-reported':'not checked')+
        '. Manual owner acceptance still required; no certification, source approval or audit receipt created.';
    });
    render();
  }
  const owner=window.YWIOwnerManagementCommandUI;
  if(owner?.mount){const original=owner.mount;
    owner.mount=function(...args){const result=original.apply(this,args);mount();return result;};}
  window.YWIOwnerManagementHistory524={mount,validate:valid,key};
})();

/* Build 526: bounded local retest triage, snapshot comparison and device follow-up. */
'use strict';
(function(){
  const key='yw:management-owner-retest-triage:v1';
  const format='yard-workers-management-retest-triage';
  const maxBytes=4096,maxFindings=6,maxComparisons=4;
  const categories=['keyboard','screen_reader','zoom','contrast'];
  const outcomes=['not_run','follow_up','observed_local'];
  const devices=['desktop','phone','tablet','assistive'];
  const dispositions=['under_review','device_retest','owner_review'];
  const areas=['all','economic','capacity','reliability'];
  const densities=['compact','comfortable'];
  const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
    Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
  const choice=value=>exact(value,['version','focus','density'])&&value.version===1&&
    areas.includes(value.focus)&&densities.includes(value.density);
  const observations=value=>exact(value,['keyboard_return','screen_reader','focus','zoom'])&&
    Object.values(value).every(x=>typeof x==='boolean');
  const reviewed=value=>exact(value,['category','outcome','observations'])&&
    categories.includes(value.category)&&outcomes.includes(value.outcome)&&
    observations(value.observations);
  const finding=value=>exact(value,['id','category','outcome','device','disposition','observations'])&&
    Number.isSafeInteger(value.id)&&value.id>0&&categories.includes(value.category)&&
    outcomes.includes(value.outcome)&&devices.includes(value.device)&&
    dispositions.includes(value.disposition)&&observations(value.observations);
  const comparison=value=>exact(value,['id','local','inspected','different'])&&
    Number.isSafeInteger(value.id)&&value.id>0&&typeof value.different==='boolean'&&
    [value.local,value.inspected].every(a=>Array.isArray(a)&&a.length<=5&&a.every(choice));
  const fresh=()=>({format,schema_version:1,next_id:1,findings:[],comparisons:[]});
  function valid(value){
    if(!exact(value,['format','schema_version','next_id','findings','comparisons'])||
      value.format!==format||value.schema_version!==1||!Number.isSafeInteger(value.next_id)||
      value.next_id<1||!Array.isArray(value.findings)||value.findings.length>maxFindings||
      !value.findings.every(finding)||!Array.isArray(value.comparisons)||
      value.comparisons.length>maxComparisons||!value.comparisons.every(comparison))return false;
    const ids=[...value.findings,...value.comparisons].map(item=>item.id);
    return new Set(ids).size===ids.length&&ids.every(id=>id<value.next_id);
  }
  function load(){
    try{const raw=localStorage.getItem(key);
      if(raw===null)return {value:fresh(),invalid:false};
      if(new TextEncoder().encode(raw).length>maxBytes)throw Error('oversize');
      const value=JSON.parse(raw);if(!valid(value))throw Error('schema');
      return {value,invalid:false};
    }catch{return {value:fresh(),invalid:true};}
  }
  const full=item=>item.outcome==='observed_local'&&Object.values(item.observations).every(Boolean);
  const short=items=>items.length?items.map(x=>`${x.focus}/${x.density}`).join(' → '):'none';
  function mount(){
    const prior=document.getElementById('owner525Retest');
    const api=window.YWIOwnerManagementRetest525;
    if(!prior||!api?.getComparison||!api?.getReviewedFinding||document.getElementById('owner526Triage'))return;
    const section=document.createElement('section');
    section.id='owner526Triage';section.dataset.build='526';
    section.className='admin-panel-block yw526-triage';
    section.setAttribute('aria-labelledby','owner526Title');
    section.innerHTML='<header><span class="yw526-kicker">Yard Workers · Management / Build 526</span>'+ 
      '<h4 id="owner526Title">Retest triage and device follow-up</h4>'+ 
      '<p>Keep a small, local review queue of Build 525 observations. Record comparisons of display-only recovery snapshots. No customer data, automatic accessibility pass or owner sign-off is created.</p></header>'+ 
      '<div class="yw526-grid"><div class="yw526-panel" aria-labelledby="owner526CompareTitle">'+
      '<h5 id="owner526CompareTitle">Recovery snapshot comparison history</h5>'+ 
      '<p>After inspecting a version 2 history above, record the local and inspected choices before deciding whether to keep, append or replace them.</p>'+ 
      '<button type="button" id="owner526Compare">Record current comparison</button>'+ 
      '<ol id="owner526Comparisons" aria-label="Recent local snapshot comparisons"></ol></div>'+ 
      '<div class="yw526-panel" aria-labelledby="owner526DeviceTitle">'+ 
      '<h5 id="owner526DeviceTitle">Owner device follow-up</h5>'+ 
      '<p>Review a Build 525 finding first. Choose only the device actually checked; an observation here is never independent certification.</p>'+ 
      '<div class="yw526-fields"><label for="owner526Device">Device reviewed<select id="owner526Device"><option value="">Choose a tested device</option><option value="desktop">Desktop / laptop</option><option value="phone">Phone</option><option value="tablet">Tablet</option><option value="assistive">Assistive-technology device</option></select></label>'+ 
      '<label for="owner526Disposition">Follow-up state<select id="owner526Disposition"><option value="under_review">Under review</option><option value="device_retest">Device retest required</option><option value="owner_review">Ready for manual owner review</option></select></label></div>'+ 
      '<button id="owner526Add" type="button">Add reviewed finding to triage</button></div></div>'+ 
      '<div class="yw526-panel" aria-labelledby="owner526FindingsTitle"><div class="yw526-heading"><h5 id="owner526FindingsTitle">Local finding triage queue</h5>'+ 
      '<label for="owner526Filter">Filter by state<select id="owner526Filter"><option value="all">All states</option><option value="under_review">Under review</option><option value="device_retest">Device retest required</option><option value="owner_review">Manual owner review</option></select></label></div>'+ 
      '<ol id="owner526Findings" aria-label="Provisional finding records"></ol>'+ 
      '<label for="owner526Selected">Selected finding<select id="owner526Selected"><option value="">Select a saved finding</option></select></label>'+ 
      '<div class="yw526-actions"><button id="owner526Update" type="button" disabled>Update selected device follow-up</button>'+ 
      '<button id="owner526Export" type="button" disabled>Download local triage JSON</button>'+ 
      '<button id="owner526Reset" type="button">Clear local Build 526 review only (twice)</button></div>'+ 
      '<p id="owner526Status" role="status" aria-live="polite" aria-atomic="true">No local review actions yet.</p></div>'+ 
      '<p class="yw526-boundary">Local observations and display choices only. Notes, personal identities, customer evidence, receipts and external transmission are deliberately excluded. QL-269 stays <strong>UNDER REVIEW</strong>.</p>';
    prior.after(section);
    const $=id=>section.querySelector('#'+id);
    const initial=load();let state=initial.value,invalid=initial.invalid,resetArmed=false;
    const status=$('owner526Status');
    function save(message){
      if(!valid(state))throw Error('invalid triage');
      const raw=JSON.stringify(state);
      if(new TextEncoder().encode(raw).length>maxBytes){status.textContent='Local review is full; no changes saved.';return false;}
      try{localStorage.setItem(key,raw);status.textContent=message;}
      catch{status.textContent=message+' Device storage unavailable: session-only review.';}
      render();return true;
    }
    function render(){
      const filter=$('owner526Filter').value;
      $('owner526Comparisons').replaceChildren();
      for(const entry of state.comparisons.slice().reverse()){
        const li=document.createElement('li');
        li.textContent=`Comparison ${entry.id}: this device (${entry.local.length}) ${short(entry.local)}; inspected (${entry.inspected.length}) ${short(entry.inspected)}. ${entry.different?'DIFFERENCE':'SAME CHOICES'}.`;
        $('owner526Comparisons').appendChild(li);
      }
      if(!state.comparisons.length){const li=document.createElement('li');li.textContent='No comparisons recorded on this device.';$('owner526Comparisons').appendChild(li);}
      const selected=$('owner526Selected'),previous=selected.value;
      selected.replaceChildren();const first=document.createElement('option');first.value='';first.textContent='Select a saved finding';selected.appendChild(first);
      for(const entry of state.findings){const option=document.createElement('option');
        option.value=String(entry.id);option.textContent=`Finding ${entry.id} · ${entry.category} · ${entry.device}`;selected.appendChild(option);}
      if([...selected.options].some(x=>x.value===previous))selected.value=previous;
      $('owner526Findings').replaceChildren();
      const visible=state.findings.filter(entry=>filter==='all'||entry.disposition===filter);
      for(const entry of visible){const li=document.createElement('li');
        li.textContent=`Finding ${entry.id} · ${entry.category.replace('_',' ')} · ${entry.device} · ${entry.outcome.replace('_',' ')} · ${entry.disposition.replaceAll('_',' ')}. `;
        const button=document.createElement('button');button.type='button';button.textContent=`Select finding ${entry.id}`;
        button.addEventListener('click',()=>{selected.value=String(entry.id);render();status.textContent=`Finding ${entry.id} selected. Choose its follow-up state and device, then update.`;});
        li.appendChild(button);$('owner526Findings').appendChild(li);}
      if(!visible.length){const li=document.createElement('li');li.textContent='No findings match this filter.';$('owner526Findings').appendChild(li);}
      const current=state.findings.find(entry=>String(entry.id)===selected.value);
      $('owner526Update').disabled=invalid||!current;
      $('owner526Export').disabled=invalid||(!state.findings.length&&!state.comparisons.length);
      $('owner526Add').disabled=invalid;
      $('owner526Compare').disabled=invalid;
    }
    $('owner526Compare').addEventListener('click',()=>{
      if(invalid)return;
      const value=api.getComparison();
      if(!Array.isArray(value.local)||!Array.isArray(value.inspected)||
        !value.local.every(choice)||!value.inspected.every(choice)){
        status.textContent='Inspect a valid version 2 history above before recording a comparison.';return;}
      const record={id:state.next_id++,local:value.local.map(x=>({...x})),
        inspected:value.inspected.map(x=>({...x})),different:Boolean(value.differing)};
      state.comparisons.push(record);
      if(state.comparisons.length>maxComparisons)state.comparisons.shift();
      save(`Comparison ${record.id} saved locally; ${record.different?'differences remain for explicit review':'choices matched'}. No recovery history was changed.`);
    });
    $('owner526Add').addEventListener('click',()=>{
      if(invalid)return;
      const item=api.getReviewedFinding(),device=$('owner526Device').value,disposition=$('owner526Disposition').value;
      if(!reviewed(item)){status.textContent='Review the provisional Build 525 finding again before adding it.';return;}
      if(!devices.includes(device)){status.textContent='Choose the device actually reviewed before adding a finding.';return;}
      if(disposition==='owner_review'&&!full(item)){
        status.textContent='Manual owner-review handoff requires all local observations and an observed-local outcome. Choose Under review or Device retest instead.';return;}
      const record={id:state.next_id++,category:item.category,outcome:item.outcome,device,disposition,
        observations:{...item.observations}};
      state.findings.push(record);if(state.findings.length>maxFindings)state.findings.shift();
      save(`Finding ${record.id} added for ${device} as ${disposition.replaceAll('_',' ')}. No owner approval was recorded.`);
    });
    $('owner526Filter').addEventListener('change',render);
    $('owner526Selected').addEventListener('change',render);
    $('owner526Update').addEventListener('click',()=>{
      if(invalid)return;
      const entry=state.findings.find(x=>String(x.id)===$('owner526Selected').value);
      const device=$('owner526Device').value,disposition=$('owner526Disposition').value;
      if(!entry||!devices.includes(device)){
        status.textContent='Select a finding and a tested device before updating.';return;}
      if(disposition==='owner_review'&&!full(entry)){
        status.textContent='This finding still requires device follow-up; no manual owner-review handoff recorded.';return;}
      entry.device=device;entry.disposition=disposition;
      save(`Finding ${entry.id} follow-up updated for ${device}: ${disposition.replaceAll('_',' ')}. Owner acceptance remains separate.`);
    });
    $('owner526Export').addEventListener('click',()=>{
      if(invalid||(!state.findings.length&&!state.comparisons.length))return;
      const raw=JSON.stringify(state)+'\n';
      if(new TextEncoder().encode(raw).length>maxBytes){status.textContent='Export exceeded 4 KB and was refused.';return;}
      const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download='yard-workers-management-retest-triage-v1.json';
      document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
      status.textContent='Local triage draft downloaded. No owner sign-off, source evidence, or external delivery occurred.';
    });
    $('owner526Reset').addEventListener('click',()=>{
      if(!resetArmed){resetArmed=true;status.textContent='Press Clear local Build 526 review only again to remove its triage and comparison records. Build 524/525 histories are not touched.';return;}
      resetArmed=false;try{localStorage.removeItem(key);}catch{}
      state=fresh();invalid=false;render();status.textContent='Build 526 local triage and comparisons cleared. Earlier recovery history and finding draft were not changed.';
    });
    status.textContent=invalid?'Saved local Build 526 triage is invalid. No records will be overwritten; press Clear twice to start a new local review.':
      'Local review restored. Findings and comparisons here are draft observations, not approval or source evidence.';
    render();
  }
  const owner=window.YWIOwnerManagementCommandUI;
  if(owner?.mount){const original=owner.mount;
    owner.mount=function(...args){const result=original.apply(this,args);mount();return result;};}
  window.YWIOwnerManagementTriage526={mount,validate:valid,key};
})();

/* Build 521: display-only saved Management navigation and accessible evidence return. */
'use strict';
(function(){
  const key='yw:management-workspace-display:v521';
  const choices=new Set(['all','economic','capacity','reliability']);
  const densities=new Set(['comfortable','compact']);
  const defaults=()=>({version:1,focus:'all',density:'comfortable'});
  const safe=value=>value&&typeof value==='object'&&!Array.isArray(value)&&
    value.version===1&&choices.has(value.focus)&&densities.has(value.density)&&
    Object.keys(value).sort().join(',')==='density,focus,version';
  function read(){
    try{const raw=localStorage.getItem(key);if(raw===null)return {value:defaults(),state:'empty'};
      const value=JSON.parse(raw);return safe(value)?{value,state:'restored'}:
        {value:defaults(),state:'invalid'};
    }catch{return {value:defaults(),state:'unavailable'};}
  }
  function mount(){
    const base=document.querySelector('.owner520-navigation');
    const focus=document.getElementById('owner520Focus');
    if(!base||!focus||document.getElementById('owner521Workspace'))return;
    const section=document.createElement('section');
    section.id='owner521Workspace';section.className='admin-panel-block yw521-workspace';
    section.dataset.build='521';section.setAttribute('aria-labelledby','owner521Title');
    section.innerHTML='<header class="yw521-heading"><div><span class="yw521-kicker">Yard Workers · Management / Build 521</span><h4 id="owner521Title">My evidence review workspace</h4><p>Keep a preferred review area and card spacing on this device. Evidence and owner decisions are never saved here.</p></div><span class="yw521-badge">Display settings only</span></header>'+ 
      '<div class="yw521-controls"><label for="owner521Area">Review area<select id="owner521Area"><option value="all">All evidence areas</option><option value="economic">Economic source</option><option value="capacity">Seasonal closure</option><option value="reliability">Reliability receipt</option></select></label>'+ 
      '<label for="owner521Density">Card spacing<select id="owner521Density"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>'+ 
      '<button id="owner521Save" type="button">Save view</button><button id="owner521Reset" type="button">Restore defaults</button></div>'+ 
      '<div class="yw521-actions"><button id="owner521Open" type="button">Open first available source link</button><button id="owner521Return" type="button" disabled>Return to evidence map</button></div>'+ 
      '<p id="owner521Status" role="status" aria-live="polite" aria-atomic="true"></p>'+ 
      '<p class="yw521-boundary">Preferences are limited to area and spacing; no records, identity, source timestamps, receipts or approvals are stored. The source views still enforce Jobs/Finance permissions. QL-269 remains <strong>UNDER REVIEW</strong>.</p>';
    base.before(section);
    const area=section.querySelector('#owner521Area');
    const density=section.querySelector('#owner521Density');
    const status=section.querySelector('#owner521Status');
    const save=section.querySelector('#owner521Save');
    const reset=section.querySelector('#owner521Reset');
    const open=section.querySelector('#owner521Open');
    const back=section.querySelector('#owner521Return');
    const stored=read();let lastLink=null;
    function apply(value){
      area.value=value.focus;density.value=value.density;focus.value=value.focus;
      base.classList.toggle('yw521-compact',value.density==='compact');
      focus.dispatchEvent(new Event('change',{bubbles:true}));
    }
    apply(stored.value);
    status.textContent=stored.state==='restored'?'Saved display preferences restored from this device. Source evidence still needs rechecking.':
      stored.state==='invalid'?'Saved preferences were invalid; safe defaults are in use. Save to replace them.':
      stored.state==='unavailable'?'Device storage unavailable; preferences remain usable for this session.':
      'Default review view loaded. Choose a review area and save if useful.';
    area.addEventListener('change',()=>{focus.value=area.value;
      focus.dispatchEvent(new Event('change',{bubbles:true}));
      back.disabled=true;lastLink=null;
      status.textContent='Review area changed for display only. Select Save view to remember it.';});
    focus.addEventListener('change',()=>{area.value=focus.value;back.disabled=true;lastLink=null;});
    density.addEventListener('change',()=>{base.classList.toggle('yw521-compact',density.value==='compact');
      status.textContent='Card spacing changed for display only. Select Save view to remember it.';});
    save.addEventListener('click',()=>{
      const value={version:1,focus:area.value,density:density.value};
      if(!safe(value)){status.textContent='Unsupported preference; nothing saved.';return;}
      try{localStorage.setItem(key,JSON.stringify(value));
        status.textContent='Saved this device\'s display view. No evidence or owner approval was saved.';
      }catch{status.textContent='Device storage unavailable. Current display settings remain active for this session.';}
    });
    reset.addEventListener('click',()=>{
      apply(defaults());back.disabled=true;lastLink=null;
      try{localStorage.removeItem(key);status.textContent='Default display view restored; saved preference removed.';}
      catch{status.textContent='Default view restored for this session; device storage could not be cleared.';}
    });
    function navigate(link){
      const hash=link.getAttribute('href')||'';
      if(!/^#owner[A-Za-z0-9]+$/.test(hash))return false;
      const target=document.getElementById(hash.slice(1));if(!target)return false;
      const details=target.closest('details');if(details)details.open=true;
      target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
      const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
      target.scrollIntoView?.({behavior:reduced?'auto':'smooth',block:'start'});
      lastLink=link;back.disabled=false;
      status.textContent='Opened '+(link.textContent.trim()||'evidence')+'. Review the original source; this navigation is not acceptance or closure.';
      return true;
    }
    base.addEventListener('click',event=>{
      const link=event.target.closest?.('a[href^="#owner"]');
      if(!link||!base.contains(link))return;
      if(navigate(link))event.preventDefault();
    });
    open.addEventListener('click',()=>{
      const link=base.querySelector('#owner520Navigation .yw520-path a[href^="#owner"]');
      if(!link){status.textContent='No permitted source link is currently available. Recheck evidence and access.';return;}
      navigate(link);
    });
    back.addEventListener('click',()=>{
      if(!lastLink?.isConnected){back.disabled=true;status.textContent='Review map changed; select a source again.';return;}
      lastLink.focus();status.textContent='Focus returned to the evidence map. The source record has not changed.';
    });
  }
  const owner=window.YWIOwnerManagementCommandUI;
  if(owner?.mount){const original=owner.mount;
    owner.mount=function(...args){const result=original.apply(this,args);mount();return result;};}
  window.YWIOwnerManagementWorkspace521={mount,validate:safe,storageKey:key};
})();

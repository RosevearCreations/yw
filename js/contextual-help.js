/* Build 377: accessible read-only Help links for dynamic application headings. */
'use strict';
(function(){
  const mappings=[
    [/management outcome confidence|cohort trend/i,'management-outcome-confidence-cohort-trend'],
    [/production learning|autonomous roadmap/i,'production-learning-roadmap-renewal-ii'],
    [/workability.to.schedule recovery/i,'workability-schedule-recovery-outcomes'],
    [/seasonal operations/i,'seasonal-operations-centre'],
    [/material estimator|material estimating/i,'landscape-material-estimator'],
    [/workforce|employees|crew management/i,'employee-crew-management'],
    [/dispatch|crew scheduling/i,'crew-scheduling-dispatch'],
    [/finance|accounting|reconcil/i,'landscaping-finance-dashboard'],
    [/equipment/i,'equipment-registry-qr-v2'],
    [/safety|hazard|incident/i,'safety-compliance-command-centre'],
    [/customer|client|property/i,'customer-property-crm'],
    [/route optimization/i,'route-optimization-territory'],
    [/job lifecycle|estimate.*invoice/i,'estimate-job-invoice-workflow']
  ];
  const ready=new WeakSet();
  const topicFor=(heading)=>{
    const explicit=heading.closest('[data-help-topic]')?.getAttribute('data-help-topic')||'';
    if(/^[a-z0-9-]{3,80}$/.test(explicit))return explicit;
    const title=(heading.textContent||'').trim();
    const item=mappings.find(([match])=>match.test(title));
    return item?item[1]:'';
  };
  function addLinks(root){
    for(const heading of root.querySelectorAll('main h2, main h3, main h4, #adminHub h2, #adminHub h3, #adminHub h4')){
      if(ready.has(heading)||heading.closest('nav,header,.yw-contextual-help'))continue;
      ready.add(heading);
      const title=(heading.textContent||'').trim();
      if(!title||heading.parentElement?.querySelector(':scope > .yw-contextual-help'))continue;
      const link=document.createElement('a');
      link.className='yw-contextual-help';
      link.href='/help.html'+(topicFor(heading)?'#'+topicFor(heading):'');
      link.textContent='ⓘ';
      link.title='Help: '+title;
      link.setAttribute('aria-label','Help: '+title);
      link.setAttribute('data-help-for',title.slice(0,80));
      heading.insertAdjacentElement('afterend',link);
    }
  }
  function boot(){
    if(document.getElementById('ywContextualHelpStyle'))return;
    const style=document.createElement('style');
    style.id='ywContextualHelpStyle';
    style.textContent='.yw-contextual-help{display:inline-flex;align-items:center;justify-content:center;min-width:30px;min-height:30px;margin:2px 7px 4px 0;padding:3px;border-radius:50%;color:inherit;border:1px solid currentColor;font-size:1.05rem;font-weight:700;text-decoration:none;vertical-align:middle}.yw-contextual-help:focus-visible{outline:3px solid #fbbf24;outline-offset:2px}@media(pointer:coarse){.yw-contextual-help{min-width:44px;min-height:44px}}';
    document.head.appendChild(style);
    let queued=false;
    const scan=()=>{queued=false;addLinks(document)};
    scan();
    const observer=new MutationObserver((mutations)=>{
      if(!mutations.some(m=>m.addedNodes.length)||queued)return;
      queued=true;
      setTimeout(scan,80);
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();

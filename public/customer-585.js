/* YW585 · Public, privacy-preserving, local-only customer planner.
 * This page is intentionally NOT the secure customer account, a quote
 * system, a booking endpoint or tenant publication. No network requests.
 */
(()=>{'use strict';
 const services=Object.freeze({
  landscape:'Lawn & grounds',snow_removal:'Snow removal',
  snow_plowing:'Snow plowing',septic:'Septic',arboriculture:'Tree care',
  construction:'Construction',water_parks:'Aquatic facilities',
  ponds:'Custom ponds (planning concept only)',
  skateparks:'Skateparks (planning concept only)'
 });
 const specialty=new Set(['ponds','skateparks']);
 const property=Object.freeze({residential:'Residential',commercial:'Commercial',rural:'Rural property',
  community:'Public/community property',unsure:'Not sure yet'});
 const when=Object.freeze({flexible:'Flexible','this-season':'This season',
  'next-season':'Next season',urgent:'Urgent (not a dispatch request)'});
 const frequency=Object.freeze({'one-time':'One-time work',recurring:'Recurring maintenance',
  estimate:'Need guidance'});
 const hold=reason=>Object.freeze({state:'HOLD',reason,plan:null,
  booked:false,transmitted:false,accountCreated:false,customerDataLoaded:false});
 function inspectScope(source){
  const chosen=source?.service,area=source?.property,time=source?.when,visits=source?.frequency;
  const note=source?.notes;
  if(!Object.prototype.hasOwnProperty.call(services,chosen)||
    !Object.prototype.hasOwnProperty.call(property,area)||
    !Object.prototype.hasOwnProperty.call(when,time)||
    !Object.prototype.hasOwnProperty.call(frequency,visits)||
    typeof note!=='string'||note.length>600||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(note))
    return hold('Choose a valid planning category and limit description to 600 characters.');
  const plan=Object.freeze({service:services[chosen],property:property[area],
   timing:when[time],frequency:frequency[visits],notes:note.trim(),
   conceptualOnly:specialty.has(chosen)});
  return Object.freeze({state:'BROWSER_ONLY_NOT_BOOKED',plan,booked:false,
   transmitted:false,accountCreated:false,customerDataLoaded:false});
 }
 function buildSheet(scope){
  if(scope?.state!=='BROWSER_ONLY_NOT_BOOKED'||!scope.plan)return null;
  const p=scope.plan;
  return [
   'YARD WORKERS · PERSONAL PLANNING SHEET',
   'NOT SUBMITTED · NOT A QUOTE OR BOOKING',
   '',
   'Service area: '+p.service,
   'General property type: '+p.property,
   'Preferred timing: '+p.timing,
   'Visit pattern: '+p.frequency,
   'Work notes: '+(p.notes||'Not provided'),
   ...(p.conceptualOnly?['Specialty category is planning-only; service is not activated.']:[]),
   '',
   'This sheet is only prepared in this browser and does not transmit',
   'any information. No landscaping company has received or accepted it.',
   'A verified account, written quote, privacy consent and original',
   'company/job authority will be required before any live booking.'
  ].join('\n');
 }
 const $=id=>document.getElementById(id);
 const status=message=>{const e=$('yw585-form-status');if(e)e.textContent=message;};
 function clear(){
  $('yw585-scope-form')?.reset?.();
  const output=$('yw585-summary');if(output)output.hidden=true;
  const text=$('yw585-summary-text');if(text)text.textContent='';
  status('Cleared. Nothing from this planning sheet was sent or stored.');
 }
 function start(){
  const form=$('yw585-scope-form'),summary=$('yw585-summary');
  if(!form||!summary)return;
  form.addEventListener('submit',event=>{
   event.preventDefault();
   const result=inspectScope({service:$('yw585-service')?.value,
    property:$('yw585-property')?.value,when:$('yw585-when')?.value,
    frequency:$('yw585-frequency')?.value,notes:$('yw585-notes')?.value??''});
   if(result.state!=='BROWSER_ONLY_NOT_BOOKED'){
    summary.hidden=true;status('Planning sheet unavailable: '+result.reason);return;
   }
   const sheet=buildSheet(result);
   $('yw585-summary-text').textContent=sheet;
   summary.hidden=false;
   status('Planning sheet created only in this browser. No network request, quote or booking occurred.');
   summary.scrollIntoView?.({block:'start',behavior:'auto'});
  });
  $('yw585-clear')?.addEventListener('click',clear);
  $('yw585-copy')?.addEventListener('click',async()=>{
   const text=$('yw585-summary-text')?.textContent;
   if(!text)return;
   if(!navigator?.clipboard?.writeText){status('Copy unavailable in this browser; use Print instead.');return;}
   try{await navigator.clipboard.writeText(text);status('Planning sheet copied locally. Nothing was sent to the service provider.');}
   catch{status('Browser clipboard access was blocked; use Print instead.');}
  });
  $('yw585-print')?.addEventListener('click',()=>{if(!summary.hidden)window.print?.();});
  window.addEventListener?.('pagehide',()=>{
   // Avoid retaining user-entered notes when navigating away.
   $('yw585-scope-form')?.reset?.();
   const text=$('yw585-summary-text');if(text)text.textContent='';
  });
 }
 window.YW585Planning=Object.freeze({services,inspectScope,buildSheet});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

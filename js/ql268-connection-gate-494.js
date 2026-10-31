/* Build 495 / QL-269: review status paused by owner direction. Under Review
   is an operator label only; the machine contract continues to return HOLD,
   deny all capabilities and require original source proof, independent custody,
   tenant isolation, separate reviewer disposition and explicit owner TEST-only
   authorization before any authenticated trial. This UI runs no automatic GET. */
(()=>{'use strict';
const el=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);return n;};
function install(){
 const host=document.getElementById('settings');
 if(!host||document.getElementById('ql268Gate494'))return;
 const panel=el('details');panel.id='ql268Gate494';panel.className='admin-hub-detail yw494-command';
 panel.appendChild(el('summary','495 · QL-269 Connection Exceptions — Under Review'));
 const body=el('div');body.className='admin-panel-block';
 const hero=el('div');hero.className='yw494-hero';
 hero.append(el('span','INTEGRATION CONTROL  /  QL-269 PAUSED'),
  el('h3','Connection Exceptions Under Review'),
  el('p','Owner-requested pause: no QL-269 escalation clock or new gateway trial is active. Public discovery never substitutes for signer evidence, tenant authorization or a TEST release.'));
 const metrics=el('div');metrics.className='yw494-kpis';metrics.id='ql268Metrics494';
 function metric(label,value,tone){const card=el('div');card.className='yw494-kpi';card.dataset.tone=tone;
  const caption=el('span',label);caption.className='yw494-kpi-label';
  const number=el('strong',value);number.className='yw494-kpi-value';card.append(caption,number);return card;}
 metrics.append(metric('Review status','UNDER REVIEW','amber'),metric('Connection','DISABLED','blue'),
  metric('Aging clock','PAUSED','purple'));
 const button=el('button','Verify public safety status (read-only)');button.type='button';button.id='ql268Read494';
 const status=el('p','Under Review — QL-269 is set aside. Connection disabled; no authenticated trial or new aging deadline authorized.');
 status.id='ql268Status494';status.setAttribute('role','status');
 const gates=el('div');gates.id='ql268Gates494';gates.className='yw494-gate-grid';
 const checks=[
  ['Original signed source-proof B','UNDER REVIEW','An original publication and independent source validation are still needed if the work resumes.'],
  ['Independent signer custody and pin witness','UNDER REVIEW','Private signer/witness receipts have not been accepted here.'],
  ['Isolated nonproduction tenant and seven-denial proof','UNDER REVIEW','Tenant and service isolation need independent validation before any trial.'],
  ['Explicit owner TEST-only GET release','NOT AUTHORIZED','The pause grants no trial, connection, access token or new permission.']
 ];
 for(const [name,condition,description] of checks){
  const card=el('article');card.className='yw494-gate-card';card.dataset.gateState='review';
  const label=el('span',condition);label.className='yw494-gate-badge';
  card.append(label,el('h4',name),el('p',description));gates.appendChild(card);
 }
 const note=el('p','Under Review is a work-tracking label, not a change to the technical connection contract. The API continues to deny connections and report its existing safety state. No token, private evidence or live action is requested.');
 note.className='yw494-note';
 body.append(hero,metrics,button,status,gates,note);panel.appendChild(body);host.appendChild(panel);
 let generation=0;
 button.addEventListener('click',async()=>{
  const epoch=++generation;button.disabled=true;status.textContent='GET health and capabilities only; no authentication or commands…';
  try{
   const paths=['/api/integration/v1/health','/api/integration/v1/capabilities'];
   const result=[];
   for(const path of paths){
    const response=await fetch(path,{method:'GET',credentials:'omit',cache:'no-store',redirect:'error'});
    if(epoch!==generation)return;
    if(!response.ok)throw Error('Public source unavailable');
    result.push(await response.json());
   }
   if(epoch!==generation)return;
   const [health,capabilities]=result;
   if(health?.app_id!=='yard-workers'||capabilities?.app_id!=='yard-workers'||
      health.contract_version!=='1'||capabilities.contract_version!=='1')
     throw Error('Contract or application identity mismatch');
   const items=capabilities.capabilities;
   if(health.connection_status!=='HOLD'||capabilities.connection_status!=='HOLD'||
      health.authenticated!==false||health.events_enabled!==false||health.commands_enabled!==false||
      capabilities.events_enabled!==false||capabilities.commands_enabled!==false||
      capabilities.owner_approval_required!==true||
      capabilities.tenant_scope!=='required_before_connection'||
      capabilities.service_module_scope!=='required_before_connection'||
      !Array.isArray(items)||!items.length||
      items.some(x=>!x||typeof x.name!=='string'||x.enabled!==false))
     throw Error('Enabled capability or missing tenant isolation prerequisite');
   metrics.replaceChildren(metric('Review status','UNDER REVIEW','amber'),
    metric('Disabled capabilities',items.length,'blue'),metric('Aging clock','PAUSED','purple'));
   status.textContent='QL-269 UNDER REVIEW · '+new Date().toLocaleString()+' · 2 public GETs succeeded. '+
    items.length+' capabilities disabled. Connection remains inactive; no conditional trial released.';
  }catch(e){if(epoch===generation){
   metrics.replaceChildren(metric('Review status','UNDER REVIEW','amber'),metric('Safety check','WITHHELD','red'),
    metric('Aging clock','PAUSED','purple'));
   status.textContent='REVIEW EXCEPTION: '+(e?.message||'Unverified discovery')+'. No trial authorized.';
  }}finally{if(epoch===generation)button.disabled=false;}
 });
 document.addEventListener('ywi:auth-changed',()=>{
  generation++;button.disabled=false;
  status.textContent='Session changed; public gate readback reset. Under Review; connection disabled.';
  metrics.replaceChildren(metric('Review status','UNDER REVIEW','amber'),metric('Connection','DISABLED','blue'),
   metric('Aging clock','PAUSED','purple'));
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

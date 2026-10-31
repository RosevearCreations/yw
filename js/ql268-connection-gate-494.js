/* Build 494 / QL-268: public read-only exception gate. No authorization path. */
(()=>{'use strict';
const el=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);return n;};
function install(){
 const host=document.getElementById('settings');
 if(!host||document.getElementById('ql268Gate494'))return;
 const panel=el('details');panel.id='ql268Gate494';panel.className='admin-hub-detail yw494-command';
 panel.appendChild(el('summary','494 · QL-268 Conditional Connection Gate (HELD)'));
 const body=el('div');body.className='admin-panel-block';
 const hero=el('div');hero.className='yw494-hero';
 hero.append(el('span','INTEGRATION CONTROL  /  QL-268'),
  el('h3','Connection Gate Readiness'),
  el('p','Public discovery is a health check, not signed-proof acceptance, tenant authorization or permission for a TEST gateway trial.'));
 const metrics=el('div');metrics.className='yw494-kpis';metrics.id='ql268Metrics494';
 function metric(label,value,tone){const card=el('div');card.className='yw494-kpi';card.dataset.tone=tone;
  const caption=el('span',label);caption.className='yw494-kpi-label';
  const number=el('strong',value);number.className='yw494-kpi-value';card.append(caption,number);return card;}
 metrics.append(metric('Connection','HOLD','amber'),metric('Public GET','NOT CHECKED','blue'),
  metric('Gate approvals','NOT EVIDENCED','red'));
 const button=el('button','Refresh public QL-268 gate readback');button.type='button';button.id='ql268Read494';
 const status=el('p','DISCONNECTED / HOLD. A real independent evidence decision has not been presented here.');
 status.id='ql268Status494';status.setAttribute('role','status');
 const gates=el('div');gates.id='ql268Gates494';gates.className='yw494-gate-grid';
 const checks=[
  ['Original signed source-proof B','NOT EVIDENCED','Requires immutable original publication and independent source validation.'],
  ['Independent signer custody and pin witness','NOT EVIDENCED','Private signer/witness receipt is not established by public discovery.'],
  ['Isolated nonproduction tenant and seven-denial proof','NOT EVIDENCED','Tenant and service scopes must be independently proven before any trial.'],
  ['Explicit owner TEST-only GET release','NOT AUTHORIZED','Separate authenticated owner approval and an independent reviewer are required.']
 ];
 for(const [name,condition,description] of checks){
  const card=el('article');card.className='yw494-gate-card';card.dataset.gateState='held';
  const label=el('span',condition);label.className='yw494-gate-badge';
  card.append(label,el('h4',name),el('p',description));gates.appendChild(card);
 }
 const note=el('p','The four gates above remain unmet by this readback even when both public endpoints respond. No token, private evidence or live connection is requested.');
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
   metrics.replaceChildren(metric('Connection','HOLD','amber'),
    metric('Disabled capabilities',items.length,'blue'),metric('Gate approvals','NOT EVIDENCED','red'));
   status.textContent='QL-268 PUBLIC READBACK · '+new Date().toLocaleString()+' · 2 GETs succeeded. '+
    items.length+' capabilities disabled. Connection remains DISCONNECTED / HOLD; conditional trial NOT RELEASED.';
  }catch(e){if(epoch===generation){
   metrics.replaceChildren(metric('Connection','HOLD','amber'),metric('Public GET','WITHHELD','red'),
    metric('Gate approvals','NOT EVIDENCED','red'));
   status.textContent='WITHHELD / HOLD: '+(e?.message||'Unverified discovery')+'. No trial authorized.';
  }}finally{if(epoch===generation)button.disabled=false;}
 });
 document.addEventListener('ywi:auth-changed',()=>{
  generation++;button.disabled=false;
  status.textContent='Session changed; public gate readback reset. DISCONNECTED / HOLD.';
  metrics.replaceChildren(metric('Connection','HOLD','amber'),metric('Public GET','NOT CHECKED','blue'),
   metric('Gate approvals','NOT EVIDENCED','red'));
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

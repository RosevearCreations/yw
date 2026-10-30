/* Build 493 / QL-267. Public GET readback only: never an authorization path. */
(()=>{'use strict';
const el=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);return n;};
function install(){
 const host=document.getElementById('settings');
 if(!host||document.getElementById('ql267Exceptions493'))return;
 const panel=el('details');panel.id='ql267Exceptions493';panel.className='admin-hub-detail';
 panel.appendChild(el('summary','493 · QL-267 Connection Exception Readback (HELD)'));
 const body=el('div');body.className='admin-panel-block';
 body.appendChild(el('p','Connection status is independent of deployment success. Public discovery does not prove signed source B, independent custody, tenant isolation or owner TEST permission.'));
 const button=el('button','Read QL-267 exceptions');button.type='button';
 const status=el('p','Not checked; all gateway trials remain DISCONNECTED / HOLD.');
 status.id='ql267Status493';status.setAttribute('role','status');
 const list=el('ul');list.id='ql267List493';
 const unresolved=[
  'Original signed source-proof B: not independently evidenced in this readback',
  'Independent signer custody and witness receipt: not independently evidenced',
  'Isolated nonproduction tenant and seven-denial proof: not independently evidenced',
  'Separate authenticated owner TEST-only GET authorization: not provided in this panel'
 ];
 for(const exception of unresolved)list.appendChild(el('li',exception));
 body.append(button,status,list);panel.appendChild(body);host.appendChild(panel);
 let generation=0;
 button.addEventListener('click',async()=>{
  const epoch=++generation;button.disabled=true;status.textContent='Checking only public health/capabilities GETs…';
  try{
   const paths=['/api/integration/v1/health','/api/integration/v1/capabilities'];
   const results=[];
   for(const path of paths){
    const response=await fetch(path,{method:'GET',credentials:'omit',cache:'no-store'});
    if(!response.ok)throw Error('Public discovery endpoint unavailable');
    const value=await response.json();
    if(epoch!==generation)return;
    results.push(value);
   }
   const [health,capabilities]=results;
   if(health?.app_id!=='yard-workers'||capabilities?.app_id!=='yard-workers'||
      health.contract_version!=='1'||capabilities.contract_version!=='1')
     throw Error('Source identity or contract mismatch');
   if(health.connection_status!=='HOLD'||capabilities.connection_status!=='HOLD'||
      health.authenticated!==false||health.events_enabled!==false||health.commands_enabled!==false||
      capabilities.events_enabled!==false||capabilities.commands_enabled!==false||
      capabilities.owner_approval_required!==true||
      capabilities.tenant_scope!=='required_before_connection'||
      capabilities.service_module_scope!=='required_before_connection'||
      !Array.isArray(capabilities.capabilities)||!capabilities.capabilities.length||
      capabilities.capabilities.some(x=>!x||typeof x.name!=='string'||x.enabled!==false))
     throw Error('Unexpected enabled capability or missing isolation gate');
   status.textContent='QL-267: HOLD / DISCONNECTED. '+capabilities.capabilities.length+
    ' capabilities disabled; no authenticated GET, relay, command, event or TEST trial authorized.';
  }catch(e){if(epoch===generation)status.textContent='WITHHELD / HOLD: '+
    (e?.message||'Unverified public discovery')+'. Escalate for independent review; no trial authorized.';}
  finally{if(epoch===generation)button.disabled=false;}
 });
 document.addEventListener('ywi:auth-changed',()=>{
  generation++;button.disabled=false;
  status.textContent='Session changed. QL-267 readback must be repeated; connection stays HOLD.';
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

/* Build 492: public discovery readback only. A 200 response never authorizes a gateway trial. */
(()=>{'use strict';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function install(){
 const host=document.getElementById('settings');if(!host||document.getElementById('ql266Readback492'))return;
 const panel=el('details');panel.id='ql266Readback492';panel.className='admin-hub-detail';
 panel.appendChild(el('summary','492 · QL-266 Connection Status Readback'));
 const body=el('div');body.className='admin-panel-block';
 body.appendChild(el('p','Read-only public health and capability discovery. Connection approval, signer custody, tenant isolation and independently verified proof remain separate gates.'));
 const button=el('button','Read current connection status');button.type='button';
 const status=el('p','Not checked. Gateway remains on HOLD until independently authorized.');
 status.setAttribute('role','status');
 body.append(button,status);panel.appendChild(body);host.appendChild(panel);
 let generation=0;
 button.addEventListener('click',async()=>{
  const epoch=++generation;button.disabled=true;status.textContent='Reading source endpoints…';
  try{
   const paths=['/api/integration/v1/health','/api/integration/v1/capabilities'];
   const results=[];
   for(const path of paths){
    const response=await fetch(path,{method:'GET',cache:'no-store',credentials:'omit'});
    if(!response.ok)throw Error('Discovery endpoint unavailable');
    results.push(await response.json());
    if(epoch!==generation)return;
   }
   const [health,capabilities]=results;
   if(health.app_id!=='yard-workers'||capabilities.app_id!=='yard-workers'||
      health.contract_version!=='1'||capabilities.contract_version!=='1'||
      health.connection_status!=='HOLD'||capabilities.connection_status!=='HOLD'||
      health.authenticated!==false||health.events_enabled!==false||health.commands_enabled!==false||
      capabilities.events_enabled!==false||capabilities.commands_enabled!==false||
      !Array.isArray(capabilities.capabilities)||capabilities.capabilities.some(x=>x.enabled!==false))
    throw Error('Unexpected discovery result; manual independent review required');
   status.textContent='QL-266 source readback: HOLD / DISCONNECTED. Discovery available; '+
     capabilities.capabilities.length+' capabilities disabled. No authenticated GET or cross-app data exchange authorized.';
  }catch(e){if(epoch===generation)status.textContent='WITHHELD: '+(e?.message||'Readback unavailable')+'; connection remains HOLD.';}
  finally{if(epoch===generation)button.disabled=false;}
 });
 document.addEventListener('ywi:auth-changed',()=>{generation++;button.disabled=false;status.textContent='Session changed. Recheck connection discovery.';});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

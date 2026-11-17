/* YW580 owner-only specialty entitlement controls. Never auto-enable.
 * All permissions and audit/compare-and-swap authority are server-side RPC. */
(()=>{'use strict';
const $=id=>document.getElementById(id),make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const auth=()=>window.YWI_AUTH?.getState?.()||{};
const current=()=>window.YW579Navigation?.snapshot?.()||{};
const canOwner=()=>auth().isAuthenticated===true&&
 window.YWIDualWorkspace?.snapshot?.()?.ownedCompanies>0&&
 current().verified===true&&!!current().companyId&&
 document.documentElement.dataset.ywSurface!=='platform';
let epoch=0,busy=false,verified=null;
function status(text){const n=$('yw580SettingsStatus');if(n)n.textContent=text;}
function clear(){epoch++;verified=null;const root=$('yw580SettingsOptions');root?.replaceChildren();
 status('Verify an owned landscaping company before changing specialty modules.');}
async function load(){
 const run=++epoch,company=current().companyId,actor=auth().user?.id;
 verified=null;$('yw580SettingsOptions')?.replaceChildren();
 if(!canOwner()){status('HOLD: owner-verified company and current Jobs permissions required.');return;}
 const sb=window.YWI_SB||window._sb;
 if(!sb?.auth?.getUser||!sb?.rpc){status('HOLD: server enrollment unavailable.');return;}
 status('Verifying owner session and original specialty registry…');
 try{
  const identity=await sb.auth.getUser();
  if(run!==epoch||auth().user?.id!==actor||current().companyId!==company)return;
  if(identity.error||identity.data?.user?.id!==actor)throw Error('Owner identity mismatch');
  const response=await sb.rpc('ywi_rpc_specialty_entitlements_580',{p_company_id:company});
  if(run!==epoch||auth().user?.id!==actor||current().companyId!==company)return;
  if(response.error||!response.data)throw Error('Staging-only specialty RPC not activated');
  verified=window.YW580Catalog?.inspectSpecialty?.(response.data,company);
  if(verified?.state!=='VERIFIED_NAVIGATION_ONLY')throw Error('Invalid source or cross-company specialty register');
  render(company);
  status('Original owner verification passed. Each service change requires an explicit confirmation and server-audited revision.');
 }catch(e){if(run===epoch){verified=null;status('HOLD: '+(e?.message||'Original specialty registry unavailable'));}}
}
function render(company){
 const host=$('yw580SettingsOptions');if(!host)return;
 host.replaceChildren();
 if(!canOwner()||verified?.state!=='VERIFIED_NAVIGATION_ONLY'||verified.companyId!==company)return;
 for(const [key,label] of [['ponds','Custom Ponds'],['skateparks','Skateparks']]){
  const item=verified.services.find(x=>x.key===key);if(!item)continue;
  const card=make('div');card.className='yw580-specialty-setting';
  card.append(make('strong',label),make('span',item.enabled?'ENABLED':'DISABLED'));
  const button=make('button',item.enabled?'Disable module':'Enable module');
  button.type='button';button.className='secondary';button.dataset.yw580Toggle=key;
  button.addEventListener('click',async()=>{
   if(busy||!canOwner()||verified.companyId!==current().companyId)return;
   const target=!item.enabled,word=target?'ENABLE':'DISABLE';
   if(!window.confirm(word+' '+label+' for the verified company? The decision is audited on the server.'))return;
   const actor=auth().user?.id,companyId=current().companyId;
   busy=true;button.disabled=true;status('Requesting original company-owner service change…');
   try{
    const sb=window.YWI_SB||window._sb;
    const session=await sb.auth.getUser();
    if(session.error||session.data?.user?.id!==actor||!canOwner()||current().companyId!==companyId)
     throw Error('Owner session changed');
    const result=await sb.rpc('ywi_rpc_specialty_update_580',{
      p_company_id:companyId,p_module_key:key,p_expected:item.enabled,p_enabled:target});
    if(result.error||result.data?.company_id!==companyId||result.data?.module_key!==key||
       result.data?.enabled!==target||result.data?.new_work_authorized!==false)
     throw Error('Independent audited update not confirmed');
    document.dispatchEvent(new CustomEvent('ywi:company-service-offering-changed',
     {detail:{company_id:companyId,module_key:key}}));
    status('Owner decision recorded. Re-reading original server registry…');
    await load();
   }catch(e){status('HOLD: '+(e?.message||'Service update not verified')+'. Re-verify before retry.');}
   finally{busy=false;button.disabled=false;}
  });
  card.append(button);host.append(card);
 }
}
function init(){
 const host=$('settings');if(!host||$('yw580SpecialtySettings'))return;
 const detail=make('details');detail.id='yw580SpecialtySettings';detail.className='admin-hub-detail';
 detail.dataset.adminHubTitle='Ponds & Skateparks · company service switches';
 detail.dataset.adminHubGroups='management operations jobs';
 detail.append(make('summary','YW580 · Ponds and Skateparks · Service Entitlements'));
 const body=make('div');body.className='admin-panel-block';
 body.append(make('p','These are full service modules in Tier 2. New companies start with both OFF. An owner must explicitly activate each service after the original database migration has been independently accepted; existing Jobs/Finance authorization remains separate.'));
 const button=make('button','Verify company modules');button.type='button';button.className='secondary';
 button.addEventListener('click',load);body.append(button);
 const msg=make('p','Verify an owned landscaping company to inspect its independent service flags.');
 msg.id='yw580SettingsStatus';msg.setAttribute('role','status');body.append(msg);
 const opts=make('div');opts.id='yw580SettingsOptions';body.append(opts);detail.append(body);host.append(detail);
 document.addEventListener('ywi:auth-changed',clear);
 document.addEventListener('ywi:workspace-authority-changed',clear);
 document.addEventListener('ywi:module-permissions-changed',clear);
 document.addEventListener('ywi:company-service-offering-changed',clear);
 $('yw579CompanySelect')?.addEventListener('change',clear);
}
document.addEventListener('DOMContentLoaded',init,{once:true});
window.YW580Settings=Object.freeze({load,clear});
})();
// All identities and records here are fictional and never inserted into Production.
import {fixture as navigation,company,companyId,ownerId,serviceKeys}
 from './pms-module-navigation-443.mjs';
export {company,companyId,ownerId,serviceKeys};
export const foreignCompanyId='a4540000-0000-4454-8454-000000000002';
export function fixture({now=Date.now(),enabled=['landscape','snow_removal','septic']}={}){
 const menu=navigation({now,enabled});
 return {company_id:companyId,menu,
  registry:menu.services.map(s=>({...s,created_at:new Date(now-90000).toISOString(),updated_at:new Date(now-20000).toISOString()})),
  audit:menu.services.map((s,i)=>({id:7-i,company_id:companyId,module_key:s.module_key,
   action:s.enabled?'enabled':'initialized',next_enabled:s.enabled,recorded_at:new Date(now-30000).toISOString()})),
  receipts:[{company_id:companyId,service_module_key:'landscape',target_table:'work_orders',
   target_id:'a4540000-0000-4454-8454-000000000011',checked_at:new Date(now-45000).toISOString()}]};
}

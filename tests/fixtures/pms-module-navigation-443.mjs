// Disposable test-only PMS company. Never provision Auth users, copy passwords,
// seed Production tenant rows or grant actual company-admin permissions here.
import {company,companyId,ownerId,companyAdminTest,serviceKeys as originalSix}
 from './cross-service-learning-442.mjs';
export {company,companyId,ownerId,companyAdminTest};
export const serviceKeys=[...originalSix,'arboriculture'];
export function fixture({now=Date.now(),enabled=['landscape','snow_removal','septic']}={}){
 return {company_id:companyId,owner_guard:'ywi_422_assert_owner',
  jobs_new_work_guard:'ywi_421_assert_company_new_work',
  captured_at:new Date(now).toISOString(),privacy_minimized:true,synthetic:false,
  historical_audit_retained:true,mutation_authorized:false,
  services:serviceKeys.map(module_key=>({company_id:companyId,module_key,
   enabled:enabled.includes(module_key)}))};
}

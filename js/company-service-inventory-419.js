/* Item 419: display a dated, aggregate-only source inventory. Never use this view for entitlements. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const schemaKeys=['landscape','construction','water_parks','snow_removal','snow_plowing','septic'];
function inspect(s){
 if(!s||s.schema_version!==1||s.inventory_kind!=='source_scoped_read_only_audit'||
   s.item!==419||s.live_endpoint!==false||s.stored_personal_data!==false||
   !Number.isFinite(Date.parse(s.as_of_utc))||Date.parse(s.as_of_utc)>Date.now()+300000||
   !s.source_counts||!Array.isArray(s.company_offerings)||s.company_offerings.length!==6||
   !Array.isArray(s.platform_modules)||!Array.isArray(s.pricing_templates)||
   !Array.isArray(s.prerequisites_for_420)||s.prerequisites_for_420.length<4||
   !s.inspection_scope||s.inspection_scope.tenant_key_matches!==0||
   s.company_entitlement_registry_present_in_inspected_schema!==false)
   throw Error('Invalid or untrusted dated entitlement source inventory');
 const keys=s.company_offerings.map(o=>o?.key);
 if(schemaKeys.some((x,i)=>keys[i]!==x)||keys.some((x,i)=>keys.indexOf(x)!==i)||
   s.company_offerings.some(o=>o?.company_entitlement!==null||o?.company_entitlement_state!=='not_verifiable'||
    !Array.isArray(o.related_pricing_templates)||typeof o.label!=='string')||
   s.platform_modules.some(o=>!['admin','jobs','finance','safety'].includes(o.key)||o.is_enabled!==true)||
   s.pricing_templates.some(o=>o.active!==true||!o.code||!o.name)||
   Object.values(s.source_counts).some(v=>!Number.isSafeInteger(v)||v<0))
   throw Error('Unverified company offering or platform state in inventory');
 return s;
}
function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);if(className)node.className=className;return node;}
function mount(){
 const host=$('admin');if(!host||$('owner419'))return;
 const p=el('details');p.id='owner419';p.className='admin-hub-detail';p.dataset.adminHubTitle='Company Service Offering Inventory';
 p.dataset.adminHubGroups='management operations';p.style.cssText='max-width:100%;min-width:0;box-sizing:border-box;overflow-wrap:anywhere';
 p.appendChild(el('summary','419 · Company Service Offering Entitlement Inventory'));
 const body=el('div',undefined,'admin-panel-block');
 body.appendChild(el('p','Audited read-only snapshot of existing platform modules, active pricing templates, business agreements and missing company tenant/entitlement proof. A pricing template or enabled Admin module does NOT enable a company service.'));
 const recheck=el('button','Load dated source inventory','secondary');recheck.type='button';recheck.id='owner419Load';body.appendChild(recheck);
 const help=el('a','ⓘ Help');help.href='/help.html#company-service-inventory-419';help.style.marginLeft='8px';body.appendChild(help);
 const status=el('p','Not loaded.','');status.id='owner419Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.appendChild(status);
 const results=el('div');results.id='owner419Results';results.style.cssText='display:grid;gap:12px;min-width:0;overflow-wrap:anywhere';body.appendChild(results);p.appendChild(body);host.appendChild(p);
 let busy=false;
 recheck.addEventListener('click',async()=>{
  if(busy)return;busy=true;recheck.disabled=true;results.replaceChildren();status.textContent='Loading dated read-only evidence…';
  try{
   const response=await fetch('/data/company-service-inventory-419.json',{cache:'no-store',credentials:'same-origin'});
   if(!response.ok)throw Error('Inventory file unavailable');
   const s=inspect(await response.json());
   status.textContent='Audited source snapshot: '+s.as_of_utc+' · Not a live tenant entitlement check. The six company offering flags are NOT VERIFIED.';
   const section=title=>{const article=el('section');article.style.cssText='min-width:0;max-width:100%;overflow-wrap:anywhere';article.appendChild(el('h3',title));results.appendChild(article);return article;};
   const overview=section('Observed Production source totals');
   overview.appendChild(el('p','CRM customers '+s.source_counts.clients+' · Properties '+s.source_counts.client_sites+
     ' · Work orders '+s.source_counts.work_orders+' · Recurring agreements '+s.source_counts.recurring_service_agreements+
     ' · Contract documents '+s.source_counts.service_contract_documents+'. Zero checked records must NOT be interpreted as no outside or historical obligations.'));
   overview.appendChild(el('p','Enabled permission-driven platform modules: '+s.platform_modules.map(m=>m.key).join(', ')+
     '. These are NOT company offering switches.'));
   const prices=section('Active pricing templates — not entitlements');
   const ul=el('ul');for(const t of s.pricing_templates)ul.appendChild(el('li',t.code+' — '+t.name+' ('+t.family+')'));prices.appendChild(ul);
   const offerings=section('Six proposed independently selectable services');
   const cards=el('div');cards.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px;min-width:0';
   for(const o of s.company_offerings){
    const c=el('article',undefined,'notice');c.dataset.owner419Key=o.key;c.style.cssText='min-width:0;max-width:100%;overflow-wrap:anywhere;box-sizing:border-box';
    c.appendChild(el('strong',o.label));c.appendChild(el('p','Company entitlement: NOT VERIFIED (no company-level enabled flag proven).'));
    c.appendChild(el('p','Related pricing: '+(o.related_pricing_templates.join(', ')||'none verified')));
    c.appendChild(el('p',o.evidence_note));cards.appendChild(c);
   }offerings.appendChild(cards);
   const boundary=section('Tenant separation & safe rollout holds');
   boundary.appendChild(el('p','No tested tenant/company key found on the nine inspected backbone tables; wider schema and RLS isolation were NOT certified.'));
   const list=el('ol');for(const item of s.prerequisites_for_420)list.appendChild(el('li',item));boundary.appendChild(list);
   boundary.appendChild(el('p',s.authority_boundary));
  }catch(e){status.textContent='WITHHELD: '+String(e?.message||e)+'. No entitlements were verified.';results.replaceChildren();}
  finally{busy=false;recheck.disabled=false;}
 });
}
if(typeof window!=='undefined')window.YWI419=Object.freeze({inspect});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

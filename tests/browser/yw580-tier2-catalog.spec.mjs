import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const html=read('index.html');
const tier=html.slice(html.indexOf('<div id="yw579TierHost"'),html.indexOf('  </header>',html.indexOf('<div id="yw579TierHost"')));
const blueprint=read('js/yw580-workflow-blueprints.js'),catalog=read('js/yw580-module-catalog.js');
const style=read('theme-tiers-579.css')+'\n'+read('theme-modules-580.css');
const actor='a1111111-1111-4111-8111-111111111111',company='b2222222-2222-4222-8222-222222222222';
async function mount(page,{width=1440}={}){
 await page.setViewportSize({width,height:960});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
 '<body data-authenticated="true"><header class="app-header"><div class="header-top"><h1>Yard Workers</h1></div>'+tier+
 '</header><div class="slave-shell-banner">Yard Workers platform</div><main><section id="settings"></section><section id="admin"></section></main></body></html>');
 await page.evaluate(({actor,company})=>{
  window.__session={isAuthenticated:true,user:{id:actor},role:'admin'};
  window.__verified=false;window.__owned=false;window.__calls=[];window.__routes=[];window.__legacy=[];
  window.YWI_AUTH={getState:()=>window.__session};
  window.YWIDualWorkspace={snapshot:()=>({ownedCompanies:window.__owned?1:0})};
  window.YWISecurity={canViewModule:()=>true,canViewSection:()=>true};
  window.YWIRouter={showSection:id=>{window.__routes.push(id);location.hash='#'+id;}};
  window.YW579Navigation={
   snapshot:()=>({verified:window.__verified,companyId:window.__verified?company:null,
    enabledServices:window.__verified?['landscape','snow_removal','septic']:[]}),
   choose:key=>window.__legacy.push(key)
  };
  const response={company_id:company,captured_at:new Date().toISOString(),owner_guard:'ywi_422_assert_owner',
   synthetic:false,mutation_authorized:false,privacy_minimized:true,
   services:[{company_id:company,module_key:'ponds',enabled:true},
             {company_id:company,module_key:'skateparks',enabled:false}]};
  window._sb={auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},
   rpc:async(name)=>{window.__calls.push(name);return{data:response,error:null};}};
 },{actor,company});
 await page.addStyleTag({content:style});
 await page.addScriptTag({content:blueprint});
 await page.addScriptTag({content:catalog});
}
for(const width of [390,768,1440]){
 test('YW580 all nine Tier 2 modules visible with no verified owner at '+width+'px',async({page})=>{
  await mount(page,{width});
  await expect(page.locator('#yw580ServiceCatalog [data-yw580-service]')).toHaveCount(9);
  for(const id of ['ponds','skateparks','snow_removal','arboriculture','septic']){
   await expect(page.locator('[data-yw580-service="'+id+'"]')).toBeVisible();
   await expect(page.locator('[data-yw580-service="'+id+'"]')).toHaveAttribute('data-yw580-state','unverified');
  }
  await expect(page.locator('#yw579PlanningNav')).toBeHidden();
  await page.locator('[data-yw580-service="ponds"]').click();
  await expect(page.locator('#yw580Blueprint')).toContainText('Custom Ponds');
  await expect(page.locator('#yw580Blueprint')).toContainText('Structure preview only');
  await expect(page.locator('#yw580Blueprint')).not.toContainText('planning only');
  await expect(page.locator('#yw580Blueprint .yw580-blueprint-actions button')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__routes)).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 });
}
test('YW580 original owner verification enables exactly original services and independent Ponds',async({page})=>{
 await mount(page);
 await page.evaluate(()=>{window.__owned=true;window.__verified=true;
  document.dispatchEvent(new Event('ywi:workspace-authority-changed'));});
 await expect.poll(()=>page.locator('[data-yw580-service="ponds"]').getAttribute('data-yw580-state')).toBe('on');
 await expect(page.locator('[data-yw580-service="skateparks"]')).toHaveAttribute('data-yw580-state','off');
 await expect(page.locator('[data-yw580-service="arboriculture"]')).toHaveAttribute('data-yw580-state','off');
 await expect(page.locator('[data-yw580-service="snow_removal"]')).toHaveAttribute('data-yw580-state','on');
 await page.locator('[data-yw580-service="ponds"]').click();
 await expect(page.locator('#yw580Blueprint')).toContainText('ENABLED · VERIFIED');
 await page.locator('#yw580Blueprint .yw580-blueprint-actions button').click();
 expect(await page.evaluate(()=>window.__routes)).toEqual(['ponds']);
 await page.locator('[data-yw580-service="snow_removal"]').click();
 expect(await page.evaluate(()=>window.__legacy)).toEqual(['snow_removal']);
 await page.locator('[data-yw580-tool="evidence"]').click();
 await expect(page.locator('#yw580Blueprint')).toContainText('Photo and evidence requirements');
 expect(await page.evaluate(()=>window.__calls)).toContain('ywi_rpc_specialty_entitlements_580');
});
test('YW580 identity logout invalidates old enabled service and linked blueprint',async({page})=>{
 await mount(page);
 await page.evaluate(()=>{window.__owned=true;window.__verified=true;
  document.dispatchEvent(new Event('ywi:workspace-authority-changed'));});
 await expect.poll(()=>page.locator('[data-yw580-service="ponds"]').getAttribute('data-yw580-state')).toBe('on');
 await page.locator('[data-yw580-service="ponds"]').click();
 await page.evaluate(()=>{window.__session.isAuthenticated=false;window.__session.user=null;
  window.__verified=false;window.__owned=false;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('#yw580Blueprint')).toBeHidden();
 await expect(page.locator('#yw580ServiceCatalog')).toBeHidden();
 expect(await page.evaluate(()=>window.YW580Catalog.snapshot().verifiedSpecialty)).toBe(false);
});
test('YW580 disabled specialty exposes previews but never opens unentitled work',async({page})=>{
 await mount(page);
 await page.evaluate(()=>{window.__owned=true;window.__verified=true;document.dispatchEvent(new Event('ywi:workspace-authority-changed'));});
 await expect.poll(()=>page.locator('[data-yw580-service="skateparks"]').getAttribute('data-yw580-state')).toBe('off');
 await page.locator('[data-yw580-service="skateparks"]').click();
 await expect(page.locator('#yw580Blueprint')).toContainText('Skateparks');
 await expect(page.locator('#yw580Blueprint')).toContainText('Structure preview only');
 await expect(page.locator('#yw580Blueprint .yw580-blueprint-actions button')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__routes)).toEqual([]);
});

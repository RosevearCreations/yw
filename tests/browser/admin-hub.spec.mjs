import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const hubSource=fs.readFileSync(path.join(process.cwd(),'js/admin-hub-ui.js'),'utf8');
const moduleAccessSource=fs.readFileSync(path.join(process.cwd(),'js/module-access-ui.js'),'utf8');

async function mount(page,{manage=true}={}){
  await page.setContent('<!doctype html><html><head></head><body><main><section id="admin" class="card"></section><section id="it" class="card"></section></main></body></html>');
  await page.evaluate(({manage})=>{
    window.__calls=[];
    window.__section='home';
    window.__auth={isAuthenticated:true,role:manage?'admin':'supervisor',profile:{id:'admin-hub-test'}};
    window.YWI_AUTH={getState:()=>window.__auth};
    window.YWISecurity={canViewModule:(module,_role,minimum='view')=>module==='admin' && (minimum==='view' || manage)};
    window.YWIRouter={showSection:(route)=>{window.__route=route;}};
    window.YWIAppDiagnostics={getItems:()=>[{scope:'synthetic-runtime',message:'Synthetic runtime check requires attention.'}]};
    window.YWIAdminUI={
      create:(config)=>{
        const instance={
          state:{locked:false},
          applyRoleAccess(){},
          applyAdminSectionFilter(section){window.__section=section;},
          async init(){
            const host=document.getElementById('admin');
            host.innerHTML=`
              <div class="section-heading"><div><h2>Admin</h2><p class="section-subtitle">Legacy long form content.</p></div></div>
              <div class="admin-panel-block" data-admin-panel-title="Admin Home Command Center"><div><h3>Admin Home Command Center</h3><p class="section-subtitle">Current command center.</p></div><button id="ad_command_refresh_panel">Refresh</button></div>
              <div class="admin-panel-block"><div><h3>Staff Directory and Access</h3><p class="section-subtitle">Staff and roles.</p></div><button id="ad_staff_refresh_panel">Refresh Staff</button></div>
              <div class="admin-panel-block"><div><h3>Admin Password Control</h3><p class="section-subtitle">Temporary password and account access controls.</p></div></div>
              <div class="admin-panel-block"><div><h3>Operations and Accounting Backbone Manager</h3><p class="section-subtitle">Jobs and operations.</p></div><button id="ad_jobs_refresh_panel">Refresh Jobs</button></div>
              <div class="admin-panel-block"><div><h3>Evidence Manager</h3><p class="section-subtitle">Safety evidence.</p></div><button id="ad_evidence_refresh_panel">Refresh Evidence</button></div>
              <div class="admin-panel-block"><div><h3>Guided Close Center</h3><p class="section-subtitle">Finance close.</p></div><button id="ad_accounting_refresh_panel">Refresh Accounting</button></div>
              <div class="admin-panel-block"><div><h3>App Health and Schema Center</h3><p class="section-subtitle">Diagnostics and integrations.</p></div><button id="ad_health_refresh_panel">Refresh Health</button><table id="ad_health_table"><tbody><tr><td>warning</td><td>synthetic</td><td>Check integration</td><td>Needs review</td></tr></tbody></table></div>
              <div class="admin-panel-block"><div><h3>Production Readiness and Permissions</h3><p class="section-subtitle">Audit and readiness.</p></div><table id="ad_audit_log_table"><tbody><tr><td>Now</td><td>Admin</td><td>Updated</td><td>Profile</td><td>Synthetic audit event</td></tr></tbody></table></div>
              <table id="ad_task_table"><tbody><tr><td>P1</td><td>Review access</td><td>security</td></tr></tbody></table>
              <div id="ad_section_nav" class="admin-section-nav"></div>
              <span id="ad_staff_age_badge" data-status="warning">Not loaded</span>
              <span id="ad_jobs_age_badge" data-status="warning">Not loaded</span>
              <span id="ad_evidence_age_badge" data-status="warning">Not loaded</span>
              <span id="ad_accounting_age_badge" data-status="warning">Not loaded</span>
              <span id="ad_health_age_badge" data-status="warning">Not loaded</span>`;
            const refreshMap={
              ad_command_refresh_panel:'command_center',ad_staff_refresh_panel:'people',ad_jobs_refresh_panel:'operations',
              ad_evidence_refresh_panel:'evidence',ad_accounting_refresh_panel:'accounting_close',ad_health_refresh_panel:'health'
            };
            for(const [id,scope] of Object.entries(refreshMap)) document.getElementById(id)?.addEventListener('click',()=>config.loadAdminDirectory({scope}));
            await config.loadAdminDirectory({scope:'command_center'});
            await config.loadAdminDirectory({scope:'people'});
            await config.loadAdminDirectory({scope:'operations'});
            await config.loadAdminSelectors();
          }
        };
        return instance;
      }
    };
    window.__config={
      loadAdminDirectory:async(payload)=>{window.__calls.push(`directory:${payload.scope}`);return {};},
      loadAdminSelectors:async()=>{window.__calls.push('selectors');return {};}
    };
  },{manage});
  await page.addScriptTag({content:hubSource});
  await page.evaluate(async()=>{
    window.__adminInstance=window.YWIAdminUI.create(window.__config);
    await window.__adminInstance.init();
  });
}

async function mountPeopleAccess(page){
  await page.route('http://people.test/**',async(route)=>{
    await route.fulfill({
      status:200,
      contentType:'text/html',
      body:'<!doctype html><html><head></head><body><main><section id="admin" class="card"><div class="section-heading"><h2>Admin</h2></div></section></main></body></html>'
    });
  });
  await page.goto('http://people.test/');
  await page.evaluate(()=>{
    localStorage.setItem('ywi_admin_hub_section_v1',JSON.stringify('home'));
    window.__moduleCalls=[];
    window.__hubOpen=null;
    window.YWI_AUTH={getState:()=>({isAuthenticated:true,role:'admin',profile:{id:'admin-1'}})};
    window.YWIAdminHub={open:(section,options)=>{window.__hubOpen={section,options};}};
    window.YWIAPI={
      escHtml:(value)=>String(value??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m])),
      jsonFetch:async(path,options)=>{
        window.__moduleCalls.push({path,body:options?.body});
        return {
          ok:true,
          module_permission_profiles:[
            {id:'admin-1',full_name:'Alex Admin',email:'alex@example.invalid',role:'admin',is_active:true,employment_status:'active'},
            {id:'sup-1',full_name:'Bea Supervisor',email:'bea@example.invalid',role:'supervisor',is_active:true,employment_status:'active'},
            {id:'emp-1',full_name:'Chris Employee',email:'chris@example.invalid',role:'employee',is_active:true,employment_status:'active'}
          ],
          module_role_defaults:[
            {role:'admin',module_key:'safety',access_level:'manage'},{role:'admin',module_key:'finance',access_level:'manage'},{role:'admin',module_key:'jobs',access_level:'manage'},{role:'admin',module_key:'admin',access_level:'manage'},
            {role:'supervisor',module_key:'safety',access_level:'approve'},{role:'supervisor',module_key:'finance',access_level:'view'},{role:'supervisor',module_key:'jobs',access_level:'approve'},{role:'supervisor',module_key:'admin',access_level:'view'},
            {role:'employee',module_key:'safety',access_level:'create'},{role:'employee',module_key:'finance',access_level:'hidden'},{role:'employee',module_key:'jobs',access_level:'view'},{role:'employee',module_key:'admin',access_level:'hidden'}
          ],
          module_permission_overrides:[{profile_id:'emp-1',module_key:'safety',access_level:'view'}],
          admin_module_access_integrity:[{profile_id:'admin-1',all_modules_manage:true}],
          source_errors:[]
        };
      }
    };
  });
  await page.addScriptTag({content:moduleAccessSource});
}

test('Admin opens as grouped card home and defers deep scopes',async({page})=>{
  await mount(page,{manage:true});
  await expect(page.locator('#ad_hub_needs')).toContainText('Needs Attention');
  await expect(page.locator('#ad_hub_grid .admin-hub-card')).toHaveCount(7);
  await expect(page.locator('#ad_hub_grid')).toContainText('People & Access');
  await expect(page.locator('#ad_hub_grid')).toContainText('I.T. & System');
  await expect(page.locator('#ad_hub_search_input')).toHaveAttribute('placeholder',/Find an Admin setting/);
  await expect(page.locator('#ad_hub_activity_list')).toContainText('Synthetic audit event');
  expect(await page.evaluate(()=>window.__calls)).toEqual(['directory:command_center']);
  await expect(page.locator('.admin-hub-detail')).toHaveCount(8);
  await expect(page.locator('.admin-hub-detail:not([hidden])')).toHaveCount(2);
});

test('opening People loads only its bounded scope once and keeps the workspace selected',async({page})=>{
  await mount(page,{manage:true});
  await page.locator('[data-admin-hub-group="people"]').click();
  await expect.poll(async()=>page.evaluate(()=>window.__calls.filter((value)=>value==='directory:people').length)).toBe(1);
  await expect(page.locator('#ad_hub_breadcrumb')).toContainText('People & Access');
  const visiblePeoplePanels=page.locator('.admin-hub-detail:not([hidden]) summary');
  await expect(visiblePeoplePanels).toHaveCount(2);
  await expect(visiblePeoplePanels.first()).toContainText(/Staff Directory|Password/);
  await page.locator('[data-admin-hub-group="people"]').click();
  await expect(page.locator('#ad_hub_breadcrumb')).toContainText('People & Access');
  expect(await page.evaluate(()=>window.__calls.filter((value)=>value==='directory:people').length)).toBe(1);
});

test('Admin search jumps to the matching focused panel',async({page})=>{
  await mount(page,{manage:true});
  await page.locator('#ad_hub_search_input').fill('password');
  await expect(page.locator('#ad_hub_search_results')).toContainText('Admin Password Control');
  await page.locator('#ad_hub_search_results [data-admin-search-type="panel"]').first().click();
  await expect(page.locator('#ad_hub_breadcrumb')).toContainText('People & Access');
  const passwordDetails=page.locator('.admin-hub-detail').filter({hasText:'Admin Password Control'});
  await expect(passwordDetails).toBeVisible();
  await expect(passwordDetails).toHaveAttribute('open','');
});

test('view-only Admin access hides manage-only cards',async({page})=>{
  await mount(page,{manage:false});
  await expect(page.locator('#ad_hub_grid')).toContainText('Business & Operations');
  await expect(page.locator('#ad_hub_grid')).toContainText('Safety & Evidence');
  await expect(page.locator('#ad_hub_grid')).toContainText('Diagnostics & Integrations');
  await expect(page.locator('#ad_hub_grid')).not.toContainText('People & Access');
  await expect(page.locator('#ad_hub_grid')).not.toContainText('Finance & Accounting');
  await expect(page.locator('#ad_hub_grid')).not.toContainText('Audit & Security');
  await expect(page.locator('#ad_hub_grid')).not.toContainText('I.T. & System');
});

test('I.T. card routes to the separate Admin I.T. Readiness screen',async({page})=>{
  await mount(page,{manage:true});
  await page.locator('[data-admin-hub-group="it"]').click();
  await expect.poll(async()=>page.evaluate(()=>window.__route)).toBe('it');
});

test('People module access stays idle on Admin Home, then becomes a searchable focused workspace',async({page})=>{
  await mountPeopleAccess(page);
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('ywi:route-shown',{detail:{allowed:'admin'}})));
  expect(await page.evaluate(()=>window.__moduleCalls.length)).toBe(0);
  await expect(page.locator('#moduleAccessManager')).toContainText('Module access is loaded on demand');

  await page.evaluate(()=>{
    localStorage.setItem('ywi_admin_hub_section_v1',JSON.stringify('people'));
    document.dispatchEvent(new CustomEvent('ywi:route-shown',{detail:{allowed:'admin'}}));
  });
  await expect.poll(async()=>page.evaluate(()=>window.__moduleCalls.length)).toBe(1);
  expect(await page.evaluate(()=>window.__moduleCalls[0])).toEqual({path:'admin-it-control',body:{action:'module_permissions'}});
  await expect(page.locator('.module-access-metrics article')).toHaveCount(5);
  await expect(page.locator('.module-access-metrics')).toContainText('3');
  await expect(page.locator('#moduleAccessPeopleList .module-access-person')).toHaveCount(3);
  await expect(page.locator('#moduleAccessManager')).toContainText('Staff module access');

  await page.locator('#moduleAccessSearch').fill('Bea');
  await expect(page.locator('#moduleAccessPeopleList .module-access-person')).toHaveCount(1);
  await expect(page.locator('#moduleAccessPeopleList')).toContainText('Bea Supervisor');
  await page.locator('#moduleAccessPeopleList .module-access-person').click();
  await expect(page.locator('#moduleAccessProfile')).toHaveValue('sup-1');
  await expect(page.locator('#moduleAccessManager')).toContainText('Effective: approve');

  await page.locator('[data-people-panel="Admin Password Control"]').click();
  await expect.poll(async()=>page.evaluate(()=>window.__hubOpen?.options?.panelTitle)).toBe('Admin Password Control');
  expect(await page.evaluate(()=>window.__moduleCalls.length)).toBe(1);
});
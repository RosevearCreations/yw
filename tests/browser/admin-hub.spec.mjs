import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const hubSource=fs.readFileSync(path.join(process.cwd(),'js/admin-hub-ui.js'),'utf8');

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

test('Admin opens as grouped card home and defers deep scopes',async({page})=>{
  await mount(page,{manage:true});
  await expect(page.locator('#ad_hub_needs')).toContainText('Needs Attention');
  await expect(page.locator('#ad_hub_grid .admin-hub-card')).toHaveCount(7);
  await expect(page.locator('#ad_hub_grid')).toContainText('People & Access');
  await expect(page.locator('#ad_hub_grid')).toContainText('I.T. & System');
  await expect(page.locator('#ad_hub_search_input')).toHaveAttribute('placeholder',/Find an Admin setting/);
  await expect(page.locator('#ad_hub_activity_list')).toContainText('Synthetic audit event');
  expect(await page.evaluate(()=>window.__calls)).toEqual(['directory:command_center']);
  await expect(page.locator('.admin-hub-detail')).toHaveCount(7);
  await expect(page.locator('.admin-hub-detail:not([hidden])')).toHaveCount(1);
});

test('opening People loads only its bounded scope once and remembers the workspace',async({page})=>{
  await mount(page,{manage:true});
  await page.locator('[data-admin-hub-group="people"]').click();
  await expect.poll(async()=>page.evaluate(()=>window.__calls.filter((value)=>value==='directory:people').length)).toBe(1);
  await expect(page.locator('#ad_hub_breadcrumb')).toContainText('People & Access');
  await expect(page.locator('.admin-hub-detail:not([hidden]) summary')).toContainText(/Staff Directory|Assignment|Catalog|Password/);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ywi_admin_hub_section_v1')))).toBe('people');
  await page.locator('[data-admin-hub-group="people"]').click();
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

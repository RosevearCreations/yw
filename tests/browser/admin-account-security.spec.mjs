import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const passwordSource = fs.readFileSync(path.join(process.cwd(),'js/password-security.js'),'utf8');
const adminSource = fs.readFileSync(path.join(process.cwd(),'js/admin-account-security-ui.js'),'utf8');
const runtimeGateSource = fs.readFileSync(path.join(process.cwd(),'js/next-safe-action-runtime-gate.js'),'utf8');

async function basePage(page, { role='employee', resetRequired=false, stagingMode='locked' } = {}) {
  await page.setContent(`<!doctype html><html><head></head><body>
    <section id="settings"><h2>Settings</h2><label>New password<input id="account_password" type="password" value="SecretPass9!" /></label></section>
    <section id="admin"><h2>Admin</h2></section>
    <div id="itReadinessWorkspace"><div class="it-readiness-shell">
      <section class="it-readiness-panel"><span class="it-readiness-kicker">Outstanding work</span><h3>Old completed rails</h3></section>
      <section class="it-readiness-panel"><span class="it-readiness-kicker">Preflight</span><h3>Schema 107 old check</h3></section>
      <section class="it-readiness-panel"><span class="it-readiness-kicker">Production</span><h3>Old production review</h3></section>
    </div></div>
  </body></html>`);
  await page.evaluate(({ role, resetRequired, stagingMode }) => {
    window.__authState = { isAuthenticated:true, pendingAuthResolution:false, needsAccountSetup:false, role, profile:{ id: role==='admin'?'admin-1':'user-1', full_name: role==='admin'?'Admin User':'Worker User', password_reset_required:resetRequired }, user:{ id: role==='admin'?'admin-1':'user-1' } };
    window.__apiCalls = [];
    window.__stagingMode = stagingMode;
    window.YWI_AUTH = {
      getState: () => ({ ...window.__authState, profile:{...window.__authState.profile} }),
      changePassword: async () => ({ user:{id:window.__authState.user.id} }),
      refresh: async () => true,
    };
    window.YWIRouter = { showSection: (key) => { window.__shownSection = key; } };
    window.YWIAPI = {
      escHtml: (value) => String(value ?? '').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])),
      jsonFetch: async (_path, options={}) => {
        window.__apiCalls.push({path:_path,...(options.body || {})});
        const action = options.body?.action;
        if (_path === 'admin-staging-acceptance' && action === 'status') {
          if (window.__stagingMode === 'runnable') {
            return {
              ok:true,
              environment_guard:{
                mutation_allowed:true,
                runtime_environment:'staging',
                actual_project_ref:'yw-staging-ref',
                expected_staging_project_ref:'yw-staging-ref',
                reason:'Dedicated non-production environment guard is satisfied.'
              },
              schema_authority:{
                exact_schema_match:true,
                expected_schema_version:202,
                latest_applied_schema_version:202,
                message:'Staging database exactly matches the current repository schema authority.'
              }
            };
          }
          return {
            ok:true,
            environment_guard:{
              mutation_allowed:false,
              runtime_environment:'production',
              actual_project_ref:'jmqvkgiqlimdhcofwkxr',
              expected_staging_project_ref:null,
              reason:'Production project authority permanently denies staging-acceptance mutation.'
            },
            schema_authority:{
              exact_schema_match:true,
              expected_schema_version:202,
              latest_applied_schema_version:202,
              message:'Runtime schema is current, but Production is never valid staging evidence.'
            }
          };
        }
        if (action === 'confirm_password_change') {
          window.__authState.profile.password_reset_required = false;
          return { ok:true };
        }
        if (action === 'overview') {
          return { ok:true,
            accounts:[
              {profile_id:'admin-1',full_name:'Admin User',username:'admin',email:'admin@example.test',role:'admin',is_active:true,password_login_ready:true,password_reset_required:false,password_changed_at:'2026-09-01T10:00:00Z'},
              {profile_id:'user-2',full_name:'Worker Two',username:'worker2',email:'worker2@example.test',role:'employee',is_active:true,password_login_ready:true,password_reset_required:false,password_changed_at:null}
            ],
            current_todo:[{todo_key:'rail:operations_cockpit_live',todo_title:'Operations Cockpit live acceptance',todo_status:'ready',current_action:'Run current staging scenario evidence.',evidence_requirement:'Human staging signoff.',source_kind:'staging_acceptance',requires_human:true,requires_external:false,sort_order:1}],
            current_todo_status:{current_todo_count:1,business_acceptance_count:1,security_followup_count:0,repository_followup_count:0},
            next_safe_action_status:{
              current_action_count:14,
              staging_ready_candidate_count:6,
              external_verification_count:3,
              pending_human_or_provider_count:3,
              blocked_accounting_count:2,
              next_todo_key:'rail:operations_cockpit_live',
              next_todo_title:'Operations Cockpit live acceptance',
              next_action_class:'staging_ready_candidate',
              safe_candidate_after_environment_guard:true,
              next_action:'Run current staging scenario evidence.',
              next_safety_note:'Candidate only. Re-verify the dedicated non-production staging environment guard before mutation.'
            },
            next_safe_action_queue:[{
              todo_key:'rail:operations_cockpit_live',todo_title:'Operations Cockpit live acceptance',todo_status:'ready',
              current_action:'Run current staging scenario evidence.',source_kind:'staging_acceptance',priority_bucket:10,
              action_class:'staging_ready_candidate',safe_candidate_after_environment_guard:true,
              safety_note:'Candidate only. Re-verify the dedicated non-production staging environment guard before mutation.',sort_order:1
            }]
          };
        }
        if (action === 'reset_temporary_password') return {ok:true,target_label:'Worker Two',force_password_change:true};
        return {ok:true};
      }
    };
  }, { role, resetRequired, stagingMode });
}

test('eyeball reveals only the value entered in the browser and temporary password forces settings gate', async ({ page }) => {
  await basePage(page,{role:'employee',resetRequired:true});
  await page.addScriptTag({content:passwordSource});
  const input = page.locator('#account_password');
  const toggle = page.locator('.ywi-password-toggle').first();
  await expect(input).toHaveAttribute('type','password');
  await toggle.click();
  await expect(input).toHaveAttribute('type','text');
  await expect(input).toHaveValue('SecretPass9!');
  await toggle.click();
  await expect(input).toHaveAttribute('type','password');
  expect(await page.evaluate(() => window.YWI_AUTH.getState().needsAccountSetup)).toBe(true);
  expect(await page.evaluate(() => window.__shownSection)).toBe('settings');
  await page.evaluate(() => window.YWI_AUTH.changePassword('PermanentPass8!'));
  const calls = await page.evaluate(() => window.__apiCalls);
  expect(calls.some((row) => row.action === 'confirm_password_change')).toBe(true);
  expect(await page.evaluate(() => window.__authState.profile.password_reset_required)).toBe(false);
});

test('Admin renders next safe action, live locked runtime truth, current To-Do, and audited temporary password controls', async ({ page }) => {
  await basePage(page,{role:'employee',resetRequired:false,stagingMode:'locked'});
  await page.addScriptTag({content:passwordSource});
  await page.evaluate(() => {
    window.__authState = {
      ...window.__authState,
      role:'admin',
      profile:{...window.__authState.profile,id:'admin-1',full_name:'Admin User',password_reset_required:false},
      user:{id:'admin-1'}
    };
  });
  await page.addScriptTag({content:adminSource});
  await page.addScriptTag({content:runtimeGateSource});
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('ywi:module-loaded',{detail:{moduleKey:'admin'}})));

  await expect(page.locator('#adminNextSafeActionPanel')).toContainText('Operations Cockpit live acceptance');
  await expect(page.locator('#adminNextSafeActionPanel')).toContainText('candidate after environment guard');
  await expect(page.locator('#adminNextSafeActionPanel')).toContainText('6 staging-ready');
  await expect(page.locator('#adminNextSafeActionPanel')).toContainText('2 accounting blocked');
  await expect(page.locator('#adminNextSafeActionPanel')).toContainText('does not authorize staging mutation');
  await expect(page.locator('#adminNextSafeActionRuntimeGate')).toContainText('Runtime execution gate: LOCKED');
  await expect(page.locator('#adminNextSafeActionRuntimeGate')).toContainText('Production project authority permanently denies staging-acceptance mutation.');
  await expect(page.locator('#adminNextSafeActionRuntimeGate')).toContainText('Source-ready does not mean runnable staging.');

  await expect(page.locator('#adminCurrentTodoPanel')).toContainText('Only unresolved current requirements');
  await expect(page.locator('#adminCurrentTodoPanel')).toContainText('Run current staging scenario evidence.');
  await expect(page.getByText('Old completed rails')).toBeHidden();
  await expect(page.getByText('Schema 107 old check')).toBeHidden();
  await expect(page.getByText('Old production review')).toBeHidden();

  const guardCalls = await page.evaluate(() => window.__apiCalls);
  expect(guardCalls.some((row)=>row.path==='admin-staging-acceptance' && row.action==='status')).toBe(true);
  expect(guardCalls.some((row)=>['record_case','finalize','signoff'].includes(row.action))).toBe(false);

  await page.locator('button[data-profile-id="user-2"]').click();
  const temp = page.locator('#adminTemporaryPassword');
  await expect(temp).toBeVisible();
  const generated = await temp.inputValue();
  expect(generated.length).toBeGreaterThanOrEqual(12);
  await temp.fill('EditedTempPass7!');
  await page.locator('#adminTemporaryPasswordReason').fill('User forgot password');
  const eye = page.locator('#adminTempPasswordEditor .ywi-password-toggle').first();
  await eye.click();
  await expect(temp).toHaveAttribute('type','text');
  await page.locator('#adminSetTemporaryPassword').click();
  await expect(page.locator('#adminAccountSecurityPanel')).toContainText('must replace it in Account & Security');
  const calls = await page.evaluate(() => window.__apiCalls);
  const reset = calls.find((row) => row.action === 'reset_temporary_password');
  expect(reset.target_profile_id).toBe('user-2');
  expect(reset.temporary_password).toBe('EditedTempPass7!');
  expect(reset.reason).toBe('User forgot password');
});

test('next safe action runtime gate becomes RUNNABLE only when environment and exact schema both pass', async ({ page }) => {
  await basePage(page,{role:'admin',resetRequired:false,stagingMode:'runnable'});
  await page.addScriptTag({content:adminSource});
  await page.addScriptTag({content:runtimeGateSource});
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('ywi:module-loaded',{detail:{moduleKey:'admin'}})));

  await expect(page.locator('#adminNextSafeActionRuntimeGate')).toContainText('Runtime execution gate: RUNNABLE');
  await expect(page.locator('#adminNextSafeActionRuntimeGate')).toContainText('Dedicated non-production environment guard is satisfied.');
  await expect(page.locator('#adminNextSafeActionRuntimeGate')).toContainText('Expected Schema 202 · live Schema 202');
  const calls = await page.evaluate(() => window.__apiCalls);
  expect(calls.filter((row)=>row.path==='admin-staging-acceptance' && row.action==='status').length).toBe(1);
  expect(calls.some((row)=>['record_case','finalize','signoff'].includes(row.action))).toBe(false);
});

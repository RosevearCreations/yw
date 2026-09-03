import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root,file),'utf8');
const migration = read('sql/191_admin_account_recovery_readiness_cleanup.sql');
const edge = read('supabase/functions/admin-account-security/index.ts');
const passwordUi = read('js/password-security.js');
const adminUi = read('js/admin-account-security-ui.js');
const runtime = read('js/module-runtime.js');
const config = read('supabase/config.toml');

const checks = [];
const add = (key, ok, detail) => checks.push({key,ok:!!ok,detail});
const hasAll = (text, parts) => parts.every((part)=>text.includes(part));

add('schema191-marker', hasAll(migration,["191::int as expected_schema_version","values(191,'191_admin_account_recovery_readiness_cleanup'","'schema191_admin_account_recovery_readiness_cleanup'"]), 'Schema 191 advances drift/version/scorecard authority.');
add('reset-audit-private', hasAll(migration,['create table if not exists public.admin_password_resets','enable row level security','revoke all on table public.admin_password_resets from public,anon,authenticated','grant select,insert,update on table public.admin_password_resets to service_role']), 'Reset audit is service-private.');
add('no-plaintext-storage-schema', !/\btemporary_password\s+(text|varchar|character varying)/i.test(migration) && !/\bpassword\s+(text|varchar|character varying)/i.test(migration), 'Migration has no plaintext password column.');
add('temporary-password-gate', hasAll(migration,['password_reset_required boolean not null default false','temporary_password_issued_at timestamptz','temporary_password_issued_by_profile_id uuid']), 'Profile gate records reset requirement without password material.');
add('current-only-todo', hasAll(migration,['create or replace view public.v_it_current_admin_todo',"where r.rail_status<>'complete'",'v_it_security_advisor_truth','repository:main_protection','v_it_historical_readiness_archive']), 'Current To-Do excludes complete rails and preserves legacy readiness as audit.');
add('stale-deploy-hints-guarded', hasAll(migration,['current_todo_excludes_superseded_deploy_hints','deploy schema 155','deploy quote-contact-submit','schema 107']), 'Assertions explicitly reject known superseded deployment instructions from active To-Do.');
add('server-admin-reset', hasAll(edge,['admin.auth.admin.updateUserById','reset_temporary_password','targetProfileId === actorId','force_password_change: true','password_reset_required: true']), 'Protected server path resets another active user without current password and forces replacement.');
add('server-no-password-echo', !/temporary_password\s*:/i.test(edge.split('return response({').slice(-1)[0] || '') && !/metadata:\s*\{[^}]*password/i.test(edge), 'Edge does not persist or echo the temporary password in reset metadata/response.');
add('self-confirm-clears-gate', hasAll(edge,['confirm_password_change','password_reset_required: false','password_changed_at: now','reset_status: "completed"']), 'Authenticated user can clear the gate only after browser auth password update succeeds.');
add('jwt-protected', /\[functions\.admin-account-security\][\s\S]*?verify_jwt\s*=\s*true/.test(config), 'New Admin account-security function is JWT protected.');
add('eyeball-toggle', hasAll(passwordUi,["toggle.textContent = '👁'","input.type = showing ? 'password' : 'text'","aria-label', showing ? 'Show password' : 'Hide password'"]), 'Eyeball toggles entered password between masked and regular print.');
add('forced-module-gate', hasAll(passwordUi,['password_reset_required === true','needsAccountSetup: true','confirm_password_change']), 'Temporary-password flag is surfaced through the existing module setup gate until replacement.');
add('admin-current-todo-ui', hasAll(adminUi,['Current Admin To-Do','Only unresolved current requirements','Completed builds and superseded preflight/prerelease checklists are retained for audit','hideHistoricalTodoPanels']), 'Admin UI shows current-only work and hides legacy audit-only panels.');
add('admin-reset-ui', hasAll(adminUi,['Set temporary password','Generate another','adminTemporaryPassword','reset_temporary_password']), 'Admin UI supports editable/generated temporary passwords.');
const adminHistoricalScripts = [
  '/js/admin-actions.js',
  '/js/admin-ui.js',
  '/js/operations-cockpit.js',
  '/js/module-access-ui.js',
  '/js/it-readiness-ui.js',
  '/js/staging-acceptance-ui.js'
];
add(
  'module-contract-preserved',
  runtime.includes("const GLOBAL_PASSWORD_SECURITY_SCRIPT = '/js/password-security.js'")
    && adminHistoricalScripts.every((script)=>runtime.includes(`'${script}'`))
    && !runtime.includes("'/js/admin-account-security-ui.js'"),
  'Existing Admin module manifest retains all historical scripts; password security is global and the new Admin account-security UI is loaded outside the manifest.'
);
add('finance-provider-boundary', !/(stripe|paypal|finance_job|posting_execution|provider_mutation\s*:\s*true)/i.test(edge + passwordUi + adminUi), 'Build 191 account-security runtime does not add Finance/provider mutation paths.');

const failed = checks.filter((x)=>!x.ok);
for (const check of checks) console.log(`${check.ok?'PASS':'FAIL'} ${check.key}: ${check.detail}`);
if (failed.length) {
  console.error(`\nBuild 191 source gate failed: ${failed.map((x)=>x.key).join(', ')}`);
  process.exit(1);
}
console.log(`\nBuild 191 source gate passed (${checks.length}/${checks.length}).`);

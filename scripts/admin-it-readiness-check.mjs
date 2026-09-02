import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const exists=(file)=>fs.existsSync(path.join(root,file));
const checks=[];
function check(name,ok,detail=''){checks.push({name,ok:!!ok,detail});}

const migration=read('sql/160_it_readiness_admin_access_integrity.sql');
const releaseMigration=read('sql/166_it_release_authority.sql');
const endpoint=read('supabase/functions/admin-it-control/index.ts');
const moduleUi=read('js/module-access-ui.js');
const itUi=read('js/it-readiness-ui.js');
const security=read('js/security.js');
const nav=read('js/module-nav.js');
const config=read('supabase/config.toml');
const css=read('it-readiness.css');

check('schema160-migration-present',exists('sql/160_it_readiness_admin_access_integrity.sql'));
check('schema160-it-admin-manage-route',/['"]it['"]\s*,\s*['"]admin['"]\s*,\s*['"]I\.T\. Readiness['"]\s*,\s*['"]manage['"]/.test(migration));
check('schema160-admin-role-manage-all', ['safety','finance','jobs','admin'].every((key)=>migration.includes(`('admin','${key}','manage'`)));
check('schema160-admin-override-db-trigger',migration.includes('trg_prevent_admin_module_override')&&migration.includes('Admin module access is break-glass manage and cannot be overridden.'));
check('schema160-private-readiness-registry',migration.includes('it_readiness_check_registry')&&migration.includes('enable row level security')&&migration.includes('revoke all on table public.it_readiness_check_registry from anon, authenticated'));
check('schema160-security-invoker-integrity-view',migration.includes('v_admin_module_access_integrity')&&migration.includes('with (security_invoker=true)'));
check('schema160-atomic-service-role-rpc',migration.includes('ywi_admin_set_profile_module_permissions')&&migration.includes('security invoker')&&migration.includes('grant execute on function public.ywi_admin_set_profile_module_permissions')&&migration.includes('to service_role'));
check('schema160-rpc-not-browser-public',migration.includes('revoke all on function public.ywi_admin_set_profile_module_permissions')&&migration.includes('anon, authenticated'));
check('schema160-readiness-assertions',migration.includes('ywi_it_readiness_security_assertions')&&migration.includes('all_active_admins_manage_all_modules'));
check('schema160-historical-drift-marker',migration.includes('160::int as expected_schema_version'));

check('schema166-migration-present',exists('sql/166_it_release_authority.sql'));
check('schema166-private-source-evidence',releaseMigration.includes('it_release_source_evidence')&&releaseMigration.includes('enable row level security')&&releaseMigration.includes('revoke all on table public.it_release_source_evidence from public, anon, authenticated'));
check('schema166-security-invoker-authority-view',releaseMigration.includes('v_it_release_authority_status')&&releaseMigration.includes('with (security_invoker=true)'));
check('schema166-service-source-capture',releaseMigration.includes('ywi_record_release_source_evidence')&&releaseMigration.includes('to service_role'));
check('schema166-release-assertions',releaseMigration.includes('ywi_it_release_authority_assertions')&&releaseMigration.includes('release_authority_main_source_evidence'));
check('schema166-manual-promotion',releaseMigration.includes('manual_human_promotion_required'));
check('schema166-drift-marker',releaseMigration.includes('166::int as expected_schema_version'));

check('admin-it-control-source',exists('supabase/functions/admin-it-control/index.ts'));
check('admin-it-control-requires-profile-admin',endpoint.includes('normalizedRole(actorProfile.role) !== "admin"'));
check('admin-it-control-no-user-metadata-auth',!endpoint.includes('user_metadata')&&!endpoint.includes('app_metadata'));
check('admin-it-control-module-profile-payload',endpoint.includes('module_permission_profiles')&&endpoint.includes('v_admin_module_access_integrity'));
check('admin-it-control-atomic-save-rpc',endpoint.includes('ywi_admin_set_profile_module_permissions'));
check('admin-it-control-readiness-sources', ['v_schema_drift_status','v_it_release_authority_status','v_it_release_source_evidence_current','v_admin_schema_preflight_checks','v_admin_deployment_checklist','v_admin_function_readiness_checks','v_production_readiness_checklist','v_admin_backup_restore_rehearsal_directory','v_admin_error_health_center','v_public_seo_smoke_check'].every((value)=>endpoint.includes(value)));
check('admin-it-control-release-assertions',endpoint.includes('ywi_it_release_authority_assertions'));
check('admin-it-control-finance-mapping-readiness',endpoint.includes('v_it_finance_account_mapping_review_status')&&endpoint.includes('ywi_finance_account_mapping_review_assertions'));
check('admin-it-control-finance-mapping-observability',endpoint.includes('v_it_finance_account_mapping_observability_status')&&endpoint.includes('ywi_finance_account_mapping_observability_assertions')&&endpoint.includes('finance_account_mapping_observability')&&endpoint.includes('mapping_observability_status'));
check('admin-it-control-dynamic-schema',endpoint.includes('expectedSchemaVersion')&&!endpoint.includes('expected_schema_version: 160')&&!endpoint.includes('>= 160'));
check('admin-it-control-auth-user-count-only',endpoint.includes('auth.admin.listUsers')&&!endpoint.includes('data.users.map'));
check('admin-it-control-jwt-config',config.includes('[functions.admin-it-control]')&&/\[functions\.admin-it-control\][\s\S]*?verify_jwt\s*=\s*true/.test(config));

check('module-ui-dedicated-endpoint',moduleUi.includes("jsonFetch?.('admin-it-control'")&&moduleUi.includes("action:'module_permissions'"));
check('module-ui-no-legacy-directory-dependency',!moduleUi.includes("loadAdminDirectory?.({scope:'module_permissions'"));
check('module-ui-atomic-save',moduleUi.includes("action:'save_module_permissions'")&&moduleUi.includes('changes=MODULES.map'));
check('module-ui-admin-break-glass-disabled',moduleUi.includes('Admin break-glass')&&moduleUi.includes("normalizedRole(p.role)==='admin'"));
check('module-ui-four-modules',moduleUi.includes("const MODULES = ['safety','finance','jobs','admin']"));
check('module-ui-it-assets',moduleUi.includes('/js/it-readiness-ui.js?v=2026-09-01h')&&moduleUi.includes('/it-readiness.css?v=2026-09-01h'));

check('it-ui-present',exists('js/it-readiness-ui.js'));
check('it-ui-route-injected',itUi.includes("section.id='it'")&&itUi.includes("e?.detail?.allowed==='it'"));
check('it-ui-browser-smoke',itUi.includes('runSmokeCheck'));
check('it-ui-readiness-endpoint',itUi.includes("action:'it_readiness'"));
check('it-ui-release-authority',itUi.includes("panel('release_authority'")&&itUi.includes("panel('release_source_evidence'")&&itUi.includes('repository_enforcement_status'));
check('it-ui-finance-mapping-review',itUi.includes("panel('finance_account_mapping_review'")&&itUi.includes('mapping_readiness_status')&&itUi.includes('finance_account_mapping_review'));
check('it-ui-finance-mapping-observability',itUi.includes("panel('finance_account_mapping_observability'")&&itUi.includes('mapping_observability_status')&&itUi.includes('finance_account_mapping_observability'));
check('it-ui-no-stale-schema160-fallback',!itUi.includes('Schema 160 control plane')&&!itUi.includes('expected_schema_version||160'));
check('it-ui-no-fifth-module',!itUi.includes('data-module="it"'));
check('it-responsive-css',/@media\(max-width:900px\)/.test(css)&&/@media\(max-width:560px\)/.test(css));
check('it-forced-colors-css',css.includes('@media(forced-colors:active)'));

check('security-it-admin-manage',security.includes("admin: 'admin', it: 'admin'")&&security.includes("admin: 'view', it: 'manage'"));
check('security-admin-break-glass-still-manage',security.includes("if (normalizeRole(role) === 'admin') return 'manage'"));
check('nav-it-inside-admin',nav.includes("admin: ['admin','it']")&&nav.includes("it: 'I.T. Readiness'"));
check('nav-top-modules-unchanged-four',!nav.includes("it: ['it']"));

const passed=checks.filter((item)=>item.ok).length;
console.log(`I.T. readiness/admin release-authority check: ${passed}/${checks.length} passed\n`);
for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.detail?` — ${item.detail}`:''}`);
if(passed!==checks.length)process.exit(1);

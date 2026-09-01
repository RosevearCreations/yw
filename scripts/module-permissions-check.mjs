#!/usr/bin/env node
/** Static contract for schema 159 module boundaries plus schema 160 Admin/I.T. hardening. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root=process.cwd();
const read=(f)=>fs.readFileSync(path.join(root,f),'utf8');
const hasAll=(t,v)=>v.every((x)=>t.includes(x));
const out=[]; const add=(name,ok,details='')=>out.push({name,ok,details});
const migration=read('sql/159_module_boundaries_permission_gated_navigation.sql');
const migration160=read('sql/160_it_readiness_admin_access_integrity.sql');
const schema=read('sql/000_full_schema_reference.sql');
const index=read('index.html');
const security=read('js/security.js');
const router=read('js/router.js');
const auth=read('js/auth.js');
const moduleNav=read('js/module-nav.js');
const moduleAccess=read('js/module-access-ui.js');
const financeUi=read('js/finance-ui.js');
const app=read('app.js');
const adminDirectory=read('supabase/functions/admin-directory/index.ts');
const adminSelectors=read('supabase/functions/admin-selectors/index.ts');
const adminManage=read('supabase/functions/admin-manage/index.ts');
const adminItControl=read('supabase/functions/admin-it-control/index.ts');
const jobsDirectory=read('supabase/functions/jobs-directory/index.ts');
const jobsManage=read('supabase/functions/jobs-manage/index.ts');
const operations=read('supabase/functions/operations-manage/index.ts');
const accountant=read('supabase/functions/accountant-export/index.ts');
const uploadPublic=read('supabase/functions/upload-public-asset/index.ts');
const safetyFiles=['resend-email','review-list','review-submission','submission-detail','upload-image','upload-hse-packet-proof'];
add('schema159-module-tables',hasAll(migration,['app_modules','app_module_routes','app_role_module_permissions','app_profile_module_permissions','app_module_permission_audit']));
add('schema159-four-modules', ['safety','finance','jobs','admin'].every((k)=>migration.includes(`('${k}'`)));
add('schema159-permission-rpcs',hasAll(migration,['ywi_effective_module_access','ywi_get_my_module_permissions','ywi_get_profile_module_permissions','ywi_module_security_assertions']));
add('schema159-admin-break-glass',migration.includes("if v_role='admin' then return 'manage'; end if;"));
add('schema160-admin-it-hardening',hasAll(migration160,['I.T. Readiness','trg_prevent_admin_module_override','v_admin_module_access_integrity','ywi_admin_set_profile_module_permissions','ywi_it_readiness_security_assertions']));
add('canonical-reference-through-160',schema.includes('-- BEGIN MIGRATION: 159_module_boundaries_permission_gated_navigation') && schema.includes('-- BEGIN MIGRATION: 160_it_readiness_admin_access_integrity') && (schema.match(/BEGIN MIGRATION:/g)||[]).length===131);
const topModules=[...index.matchAll(/data-module="([^"]+)"/g)].map((m)=>m[1]);
add('top-navigation-exact-four-modules',JSON.stringify(topModules.slice(0,4))===JSON.stringify(['safety','finance','jobs','admin']),topModules.join(','));
add('module-subnav-present',index.includes('id="moduleSectionNav"') && moduleNav.includes('SECTION_ORDER'));
add('it-admin-subnav-not-fifth-module',moduleNav.includes("admin: ['admin','it']") && security.includes("it: 'admin'") && !topModules.includes('it'));
add('finance-module-present',index.includes('id="finance"') && hasAll(financeUi,["scope:'accounting'",'Finance module']));
add('browser-security-module-aware',hasAll(security,['ACCESS_RANK','SECTION_MODULES','getModuleAccess','canViewModule','getDefaultSectionForModule']));
add('router-no-always-visible-bypass',!router.includes('alwaysVisible') && router.includes('canViewSection'));
add('auth-loads-self-permissions',auth.includes("rpc('ywi_get_my_module_permissions'") && auth.includes('setModulePermissions'));
add('protected-ui-initialization-module-aware',hasAll(app,["canUseModule('admin','view')","canUseModule('jobs','view')","canUseModule('safety','view')"]));
add('admin-permission-editor-safety-only',hasAll(moduleAccess,["preset('safety_only')","action:'preset_module_permissions'",'Set Safety-only','admin-it-control']));
add('admin-permission-editor-admin-break-glass',hasAll(moduleAccess,['Admin break-glass',"normalizedRole(p.role)==='admin'",'disabled title="Admin always has manage access."']));
add('admin-it-control-atomic-permission-write',hasAll(adminItControl,['module_permission_profiles','save_module_permissions','preset_module_permissions','ywi_admin_set_profile_module_permissions']));
add('admin-directory-enforces-modules',hasAll(adminDirectory,['hasModuleAccess',"scope === 'module_permissions'","moduleRequirementForScope","app_profile_module_permissions"]));
add('admin-selectors-admin-module',hasAll(adminSelectors,['hasModuleAccess',"'admin', 'view'"]));
add('admin-manage-module-audit',hasAll(adminManage,['moduleRequirementForEntity',"entity === 'module_permission'",'app_module_permission_audit',"preset === 'safety_only'"]));
add('jobs-directory-enforces-and-redacts',hasAll(jobsDirectory,["'jobs', 'view'",'financeAllowed','financeRedactions','...financeRedactions']));
add('jobs-manage-enforces',hasAll(jobsManage,["'jobs', 'create'","'finance', 'create'",'job_financial_event']));
add('operations-action-module-map',hasAll(operations,['moduleRequirementForAction',"moduleKey:'finance'","moduleKey:'jobs'","moduleKey:'admin'",'const SCHEMA = 159']));
add('accountant-finance-manage',hasAll(accountant,["'finance', 'manage'",'const SCHEMA = 159']));
add('public-upload-admin-manage',hasAll(uploadPublic,["'admin', 'manage'",'const SCHEMA = 159']));
for(const name of safetyFiles){const t=read(`supabase/functions/${name}/index.ts`); add(`safety-function:${name}`,hasAll(t,['hasModuleAccess',"'safety'"]));}
let ts; try { const require=createRequire(import.meta.url); ts=require('typescript'); } catch {}
if(ts){
  for(const file of ['supabase/functions/_shared/module-permissions.ts','supabase/functions/admin-directory/index.ts','supabase/functions/admin-selectors/index.ts','supabase/functions/admin-manage/index.ts','supabase/functions/admin-it-control/index.ts','supabase/functions/jobs-directory/index.ts','supabase/functions/jobs-manage/index.ts','supabase/functions/operations-manage/index.ts','supabase/functions/accountant-export/index.ts','supabase/functions/upload-public-asset/index.ts',...safetyFiles.map((n)=>`supabase/functions/${n}/index.ts`)]){
    const r=ts.transpileModule(read(file),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:file});
    const errors=(r.diagnostics||[]).filter((d)=>d.category===ts.DiagnosticCategory.Error);
    add(`typescript:${file}`,errors.length===0,errors.map((d)=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join(' | '));
  }
}
const passed=out.filter((x)=>x.ok).length;
console.log(`\nSchema 159/160 module permission check: ${passed}/${out.length} passed\n`);
for(const r of out) console.log(`${r.ok?'PASS':'FAIL'}  ${r.name}${r.details?` — ${r.details}`:''}`);
process.exit(out.some((x)=>!x.ok)?1:0);

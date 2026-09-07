#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const hub=read('js/admin-hub-ui.js');
const runtime=read('js/module-runtime.js');
const admin=read('js/admin-ui.js');
const config=read('js/app-config.js');
const operations=read('js/admin-operations-workspace.js');
const safety=read('js/admin-safety-workspace.js');
const worker=read('server-worker.js');
const results=[];
const add=(name,ok,detail='')=>results.push({name,ok:!!ok,detail});
const all=(text,values)=>values.every((value)=>text.includes(value));

add('card-groups', all(hub,['People & Access','Business & Operations','Safety & Evidence','Finance & Accounting','Diagnostics & Integrations','Audit & Security','I.T. & System']), 'Admin home exposes seven focused operator groups.');
add('needs-attention', all(hub,['Needs Attention','collectNeeds','YWIAppDiagnostics','ad_task_table','ad_health_table']), 'Admin home summarizes current diagnostics, tasks, and health exceptions.');
add('search-launcher', all(hub,['Find an Admin setting','buildSearchIndex','data-admin-search-type']), 'Admin settings/workspaces are searchable without scrolling.');
add('breadcrumb-workspace', all(hub,['ad_hub_breadcrumb','admin-hub-workspace-heading','Back to Admin Home']), 'Focused workspaces retain Admin context and a direct path home.');
add('remembered-progressive-disclosure', all(hub,['STORAGE_SECTION','STORAGE_OPEN','admin-hub-detail','details.open']), 'Selected workspace and expanded panels are remembered locally.');
add('permission-aware-cards', all(hub,['minimum:\'manage\'','minimum:\'view\'','can(group.minimum)','canViewModule']), 'Restricted cards follow the current Admin module access level.');
add('lazy-initial-admin-data', all(hub,['initialPhase','scope !== \'command_center\'','deferredScopes','loadAdminSelectors: async']), 'Initial Admin boot fetches the command center only; deeper scopes/selectors are deferred.');
add('workspace-load-on-open', all(hub,['loadGroupOnce','ad_staff_refresh_panel','ad_jobs_refresh_panel','ad_evidence_refresh_panel','ad_accounting_refresh_panel','ad_health_refresh_panel']), 'Opening a card reuses existing bounded scope refresh controls.');
add('standard-status-language', all(hub,['BLOCKED','READY','OPEN TO LOAD','ACTION','admin-hub-status']), 'Hub cards use concise shared readiness language.');
add('audit-activity', all(hub,['Recent Admin & Audit Activity','ad_audit_log_table','collectAuditRows']), 'Recent administrative audit activity is surfaced on the Admin home.');
add('legacy-actions-preserved', all(admin,['refreshAdminPanelScope','applyAdminSectionFilter','focusAdminHubEntity']), 'Build 229 decorates rather than replaces the existing Admin data/action authority.');
add('runtime-order', runtime.includes("'/js/admin-ui.js',\n        '/js/admin-hub-ui.js',\n        '/js/operations-cockpit.js'"), 'Hub decorator loads after Admin UI and before secondary Admin controllers.');

add('build234-lazy-script', all(config,['loadAdminOperationsWorkspaceOnDemand','Business & Operations','/js/admin-operations-workspace.js?v=2026-09-07a','data-ywi-admin-operations-workspace']), 'Build 234 operations presentation is fetched only after the focused workspace is selected.');
add('build234-existing-authority', all(operations,['window.YWIAdminHub?.open?.(\'operations\'','ad_jobs_refresh_panel','Operations and Accounting Backbone Manager','Dropdown and Catalog Manager','Admin Task Inbox']), 'Build 234 reuses existing Admin panels and the existing bounded operations refresh.');
add('build234-bounded-summary', all(operations,['#ad_ops_dashboard_cards .admin-stat-card','.slice(0, 6)','#ad_task_table tbody tr','.slice(0, 3)','ad_site_activity_summary']), 'Operations overview is bounded to six metrics, three tasks, and the already-rendered activity summary.');
add('build234-no-direct-data-authority', !/(YWIAPI|supabase|jsonFetch|manageAdminEntity|fetch\s*\()/i.test(operations), 'Focused operations presentation adds no direct API/database authority.');
add('build234-no-precache', !worker.match(/APP_SHELL\s*=\s*\[[\s\S]*admin-operations-workspace\.js/), 'Build 234 operations JavaScript is not added to the Core precache list.');
add('build234-cache-contract', worker.includes("const CACHE_NAME = 'ywi-shell-v2026-09-07b';") && worker.includes("fetch(assetUrl, { cache: 'reload' })"), 'Build 234 preserves the current account-security shell contract; app-config remains network-first for the lazy loader.');

add('build235-lazy-script', all(config,['loadAdminSafetyWorkspaceOnDemand','Safety & Evidence','/js/admin-safety-workspace.js?v=2026-09-07a','data-ywi-admin-safety-workspace']), 'Build 235 safety presentation is fetched only after the focused safety workspace is selected.');
add('build235-existing-authority', all(safety,['window.YWIAdminHub?.open?.(\'safety\'','ad_evidence_refresh_panel','Evidence Manager','Ontario OHSA / Workplace Safety Hub','Operations and Accounting Backbone Manager']), 'Build 235 reuses existing safety/evidence panels and the existing bounded evidence refresh.');
add('build235-bounded-summary', all(safety,['#ad_evidence_manager_table tbody tr','#ad_evidence_action_queue_table tbody tr','#ad_attendance_evidence_table tbody tr','#ad_hse_evidence_table tbody tr','ad_evidence_summary']), 'Safety overview is bounded to already-rendered evidence/action/attendance/HSE state.');
add('build235-no-direct-data-authority', !/(YWIAPI|supabase|jsonFetch|manageAdminEntity|fetch\s*\()/i.test(safety), 'Focused safety presentation adds no direct API/database authority.');
add('build235-no-precache', !worker.match(/APP_SHELL\s*=\s*\[[\s\S]*admin-safety-workspace\.js/), 'Build 235 safety JavaScript is not added to the Core precache list.');
add('build235-observer-bounded', all(safety,['ad_hub_breadcrumb','ad_evidence_age_badge','ad_evidence_summary','ad_evidence_manager_table','ad_evidence_action_queue_table','ad_attendance_evidence_table','ad_hse_evidence_table']) && !safety.includes("observer.observe(document.getElementById(WORKSPACE_ID)"), 'Build 235 observes existing evidence sources only and cannot self-observe its rendered workspace.');
add('no-finance-provider-enable', !/(provider_mutation\s*[:=]\s*true|posting_execution\s*[:=]\s*true|stripe.*enable|paypal.*enable)/i.test(`${hub}\n${operations}\n${safety}`), 'Information architecture cannot enable Finance/provider execution.');

const failed=results.filter((row)=>!row.ok);
for(const row of results) console.log(`${row.ok?'PASS':'FAIL'} ${row.name}${row.detail?` - ${row.detail}`:''}`);
if(failed.length){console.error(`\nBuild 235 Admin workspace gate failed: ${failed.length}/${results.length}`);process.exit(1);}
console.log(`\nBuild 235 Admin workspace gate passed: ${results.length}/${results.length}`);
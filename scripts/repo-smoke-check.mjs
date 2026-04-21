import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const results = [];
let failed = false;

function addCheck(name, ok, details) {
  results.push({ name, ok, details });
  if (!ok) failed = true;
}

function fileExists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

const indexHtml = read('index.html');
const h1Count = (indexHtml.match(/<h1\b/gi) || []).length;
addCheck('single-public-h1-index', h1Count <= 1, `index.html contains ${h1Count} H1 tag(s).`);

const requiredFiles = [
  'index.html',
  'style.css',
  'app.js',
  'server-worker.js',
  'js/app-config.js',
  'js/bootstrap.js',
  'js/api.js',
  'js/jobs-ui.js',
  'sql/000_full_schema_reference.sql',
  'KNOWN_ISSUES_AND_GAPS.md',
  'sql/065_job_crews_recurring_schedules_and_activity_tracking.sql',
  'sql/066_journal_posting_controls_and_material_issue_usage.sql',
  'sql/067_source_journal_route_execution_and_hse_proof.sql',
  'sql/068_journal_sync_exceptions_and_upload_failure_fallback.sql',
  'sql/069_hse_osha_interfaces_weather_chemical_traffic_signoff.sql',
  'sql/070_hse_upload_retry_and_analytics_monitoring.sql',
  'sql/071_admin_focus_hse_action_items_and_monitor_summaries.sql',
  'sql/072_hse_hub_and_accounting_review_summaries.sql',
  'sql/073_hse_link_context_and_monitor_shortcuts.sql',
  'sql/074_hse_control_cues_and_inspection_focus.sql',
  'sql/075_landscaping_job_workflow_and_crew_planning.sql',
  'sql/076_job_pricing_profitability_and_schedule_logic.sql',
  'sql/077_service_pricing_templates_and_ontario_tax_codes.sql',
  'sql/078_job_sessions_reassignments_and_admin_sorting.sql',
  'sql/079_job_financial_rollups_and_profit_review.sql',
  'sql/080_service_agreements_assets_payroll_and_login_tracking.sql',
  'sql/081_contract_conversion_payroll_exports_and_snow_invoice_automation.sql',
  'sql/082_site_activity_audit_and_admin_recent_events.sql',
  'sql/083_employee_time_clock_and_break_tracking.sql',
  'sql/084_supervisor_attendance_review_and_execution_candidates.sql',
  'sql/085_attendance_photo_geofence_scheduler_and_signed_contract_invoice.sql',
  'sql/086_hseops_performance_and_site_activity_rollups.sql',
  'sql/087_evidence_review_scheduler_settings_and_signed_contract_kickoff.sql',
  'js/hse-ops-ui.js',
  'supabase/functions/jobs-directory/index.ts',
  'supabase/functions/jobs-manage/index.ts',
  'supabase/functions/upload-job-comment-attachment/index.ts',
  'supabase/functions/upload-equipment-evidence/index.ts',
  'supabase/functions/upload-route-execution-attachment/index.ts',
  'supabase/functions/upload-hse-packet-proof/index.ts',
  'supabase/functions/analytics-traffic/index.ts',
  'supabase/functions/upload-employee-time-photo/index.ts',
  'supabase/functions/service-execution-scheduler/index.ts'
];
for (const relPath of requiredFiles) {
  addCheck(`file:${relPath}`, fileExists(relPath), fileExists(relPath) ? 'Present.' : 'Missing.');
}

addCheck(
  'index-references-app-config',
  /<script[^>]+src="\/js\/app-config\.js\?v=/i.test(indexHtml),
  'index.html should reference js/app-config.js with a cache-busting query string.'
);
addCheck(
  'index-references-bootstrap',
  /<script[^>]+src="\/js\/bootstrap\.js\?v=/i.test(indexHtml),
  'index.html should reference js/bootstrap.js with a cache-busting query string.'
);

const appJs = read('app.js');
addCheck('app-exposes-diagnostics', appJs.includes('window.YWIAppDiagnostics'), 'app.js should expose window.YWIAppDiagnostics.');
addCheck('app-exposes-module-timings', appJs.includes('window.YWIModuleTimings'), 'app.js should expose window.YWIModuleTimings.');

const bootstrapJs = read('js/bootstrap.js');
addCheck('bootstrap-exposes-timing-events', bootstrapJs.includes('ywi:timing'), 'bootstrap.js should emit timing events.');

const adminUi = read('js/admin-ui.js');
addCheck('admin-has-smoke-check', adminUi.includes('Run Smoke Check'), 'admin-ui.js should render the smoke check controls.');
addCheck('admin-has-conflict-review', adminUi.includes('Conflict Review'), 'admin-ui.js should render the conflict review panel.');

const accountUi = read('js/account-ui.js');
addCheck('account-has-conflict-review', accountUi.includes('Conflict Review'), 'account-ui.js should render the conflict review panel.');
addCheck('account-has-support-export', accountUi.includes('Export Support Snapshot'), 'account-ui.js should render the support snapshot export button.');

const schema = read('sql/000_full_schema_reference.sql');
addCheck('schema-header-current', /087_evidence_review_scheduler_settings_and_signed_contract_kickoff/i.test(schema), 'Schema snapshot header should reflect the latest 087 pass.');

console.log(JSON.stringify({ ok: !failed, checks: results }, null, 2));
if (failed) process.exit(1);

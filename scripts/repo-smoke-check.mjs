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
  'js/mobile-menu.js',
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
  'sql/088_scheduler_cron_media_review_payroll_close_receipts.sql',
  'sql/089_historical_reporting_and_auth_wall_support.sql',
  'sql/090_incident_reporting_saved_report_presets_and_trends.sql',
  'sql/091_corrective_actions_training_and_sds_tracking.sql',
  'sql/092_management_workflows_and_subscriptions.sql',
  'sql/093_report_delivery_and_worker_self_service.sql',
  'sql/094_jobs_commercial_completion_and_accounting_ready.sql',
  'sql/095_jobs_quote_approval_release_and_accounting_candidates.sql',
  'sql/096_jobs_quote_output_threshold_enforcement_and_closeout_posting.sql',
  'sql/097_jobs_quote_delivery_threshold_rules_and_accountant_exports.sql',
  'sql/098_jobs_quote_email_signoff_and_gl_posting.sql',
  'sql/099_quote_acceptance_threshold_autoeval_and_accounting_lifecycle.sql',
  'sql/100_accounting_close_reconciliation_and_tax_filing_foundation.sql',
  'sql/101_accounting_posting_automation_and_export_bundle.sql',
  'sql/102_accounting_close_end_to_end_workflow.sql',
  'sql/103_accounting_close_admin_ui_controls.sql',
  'sql/104_reporting_loader_timeout_guardrails.sql',
  'sql/105_repo_cleanup_and_roadmap_refresh.sql',
  'sql/106_admin_command_center_schema_tracking_and_health.sql',
  'sql/107_admin_readiness_drilldowns_and_live_schema_fix.sql',
  'sql/108_saved_filters_close_wizard_health_and_seo_gates.sql',
  'sql/109_pagination_close_wizard_audit_backup_mobile_foundations.sql',
  'sql/110_mobile_navigation_quality_gates.sql',
  'js/hse-ops-ui.js',
  'supabase/functions/jobs-directory/index.ts',
  'supabase/functions/jobs-manage/index.ts',
  'supabase/functions/upload-job-comment-attachment/index.ts',
  'supabase/functions/upload-equipment-evidence/index.ts',
  'supabase/functions/upload-route-execution-attachment/index.ts',
  'supabase/functions/upload-hse-packet-proof/index.ts',
  'supabase/functions/analytics-traffic/index.ts',
  'supabase/functions/upload-employee-time-photo/index.ts',
  'supabase/functions/service-execution-scheduler/index.ts',
  'supabase/functions/service-execution-scheduler-run/index.ts',
  'supabase/functions/report-subscription-delivery-run/index.ts',
  'supabase/functions/report-subscription-delivery-run/config.toml',
  'supabase/functions/service-execution-scheduler-run/config.toml'
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
const mobileMenuJs = read('js/mobile-menu.js');
addCheck('index-has-compact-mobile-menu-toggle', indexHtml.includes('id="mainMenuToggle"') && indexHtml.includes('id="mainNav"'), 'index.html should include the compact mobile menu toggle and main nav target.');
addCheck('index-loads-mobile-menu-js', /<script[^>]+src="\/js\/mobile-menu\.js\?v=/i.test(indexHtml), 'index.html should load js/mobile-menu.js with a cache-busting query string.');
addCheck('mobile-menu-binds-expanded-state', mobileMenuJs.includes('aria-expanded') && mobileMenuJs.includes('is-menu-open'), 'mobile-menu.js should toggle aria-expanded and the header open class.');
addCheck('style-has-mobile-menu-collapse', read('style.css').includes('.main-menu-toggle') && read('style.css').includes('.app-header.is-menu-open nav.main-nav'), 'style.css should collapse the main nav on mobile and expand it when open.');

const reportsUi = read('js/reports-ui.js');
addCheck('reports-has-corrective-actions', reportsUi.includes('Corrective Actions'), 'reports-ui.js should render the corrective actions panel.');
addCheck('reports-has-training-expiry', reportsUi.includes('Training / Certification Records'), 'reports-ui.js should render the training and certification panel.');

const adminUi = read('js/admin-ui.js');
addCheck('admin-has-compact-section-toggle', adminUi.includes('admin-section-toggle') && adminUi.includes('ad_section_current'), 'admin-ui.js should render a compact expandable admin-section menu on phones.');
addCheck('admin-has-smoke-check', adminUi.includes('Run Smoke Check'), 'admin-ui.js should render the smoke check controls.');
addCheck('admin-has-conflict-review', adminUi.includes('Conflict Review'), 'admin-ui.js should render the conflict review panel.');

const accountUi = read('js/account-ui.js');
addCheck('account-has-conflict-review', accountUi.includes('Conflict Review'), 'account-ui.js should render the conflict review panel.');
addCheck('account-has-support-export', accountUi.includes('Export Support Snapshot'), 'account-ui.js should render the support snapshot export button.');

const schema = read('sql/000_full_schema_reference.sql');
addCheck('schema-header-current', /110_mobile_navigation_quality_gates/i.test(schema), 'Schema snapshot should reflect the latest 110 pass.');

const schedulerRun = read('supabase/functions/service-execution-scheduler-run/index.ts');
addCheck('scheduler-run-advances-next-run', schedulerRun.includes('next_run_at: computeNextRunAt'), 'Scheduler Edge Function should advance next_run_at after successful runs.');
addCheck('scheduler-run-has-duplicate-note', schema.includes('duplicate queued dispatches are suppressed for 10 minutes'), 'Canonical schema should document the 10-minute duplicate dispatch guard.');


addCheck('no-fixed-schema-copy', !fileExists('sql/000_full_schema_reference.fixed.sql'), 'sql/000_full_schema_reference.fixed.sql should not exist.');
addCheck('no-fixed-092-copy', !fileExists('sql/092_management_workflows_and_subscriptions.fixed.sql'), 'sql/092_management_workflows_and_subscriptions.fixed.sql should not exist.');
addCheck('schema-has-commercial-engagement-view', schema.includes('v_quote_package_engagement_directory'), 'Canonical schema should include the quote engagement directory view.');
addCheck('schema-uses-client-join-for-quote-engagement', schema.includes('left join public.clients c on c.id = e.client_id'), 'Canonical schema should join clients when building quote engagement data.');

addCheck('schema-has-accounting-close-dashboard', schema.includes('v_accounting_close_dashboard'), 'Canonical schema should include the accounting close dashboard view.');
addCheck('schema-has-trial-balance', schema.includes('v_gl_trial_balance_summary'), 'Canonical schema should include the GL trial balance summary view.');
addCheck('schema-has-sales-tax-filing-summary', schema.includes('v_sales_tax_filing_summary'), 'Canonical schema should include the sales tax filing summary view.');

addCheck('schema-has-sales-tax-prep', schema.includes('v_sales_tax_prep_directory'), 'Canonical schema should include the sales tax prep directory view.');
addCheck('schema-has-payroll-remittance-prep', schema.includes('v_payroll_remittance_prep_directory'), 'Canonical schema should include the payroll remittance prep directory view.');
addCheck('schema-has-accountant-bundle', schema.includes('v_accountant_handoff_bundle_directory'), 'Canonical schema should include the accountant handoff bundle directory view.');
addCheck('schema-has-ar-payment-applications', schema.includes('v_ar_payment_application_directory'), 'Canonical schema should include the AR payment application directory view.');
addCheck('schema-has-ap-payment-applications', schema.includes('v_ap_payment_application_directory'), 'Canonical schema should include the AP payment application directory view.');
addCheck('schema-has-generated-journal-lines', schema.includes('v_gl_journal_generated_line_directory'), 'Canonical schema should include the generated journal line directory view.');
addCheck('schema-has-reconciliation-match-scored', schema.includes('v_bank_reconciliation_match_scored_directory'), 'Canonical schema should include the scored bank reconciliation match directory view.');
addCheck('schema-has-sales-tax-review', schema.includes('v_sales_tax_filing_review_directory'), 'Canonical schema should include the sales tax filing review directory view.');
addCheck('schema-has-payroll-remittance-review', schema.includes('v_payroll_remittance_review_directory'), 'Canonical schema should include the payroll remittance review directory view.');
addCheck('schema-has-accountant-package-directory', schema.includes('v_accountant_handoff_package_directory'), 'Canonical schema should include the accountant handoff package directory view.');
addCheck('schema-has-accounting-close-admin-control-dashboard', schema.includes('v_accounting_close_admin_control_dashboard'), 'Canonical schema should include the accounting close admin control dashboard view.');
addCheck('schema-has-reporting-loader-health', schema.includes('v_reporting_loader_health'), 'Canonical schema should include the schema 104 reporting loader health view.');
addCheck('schema-has-repo-cleanup-roadmap-health', schema.includes('v_repo_cleanup_and_roadmap_health'), 'Canonical schema should include the schema 105 repo cleanup and roadmap health view.');
addCheck('schema-has-app-schema-versions', schema.includes('app_schema_versions'), 'Canonical schema should include the app_schema_versions tracking table.');
addCheck('schema-has-admin-command-center', schema.includes('v_admin_home_command_center'), 'Canonical schema should include the Admin Home Command Center view.');
addCheck('schema-has-admin-health-center', schema.includes('v_admin_error_health_center'), 'Canonical schema should include the Admin Error Health Center view.');
addCheck('schema-has-admin-task-inbox', schema.includes('v_admin_task_inbox'), 'Canonical schema should include the DB-backed Admin Task Inbox view.');
addCheck('schema-has-drift-status', schema.includes('v_schema_drift_status'), 'Canonical schema should include schema drift status view.');
addCheck('schema-has-production-readiness', schema.includes('v_production_readiness_checklist'), 'Canonical schema should include production readiness checklist view.');
addCheck('schema-has-role-permission-matrix', schema.includes('v_role_permission_matrix'), 'Canonical schema should include role permission matrix view.');
addCheck('schema-has-evidence-manager-directory', schema.includes('v_evidence_manager_directory'), 'Canonical schema should include evidence manager directory view.');
addCheck('schema-has-saved-filter-summary', schema.includes('v_admin_saved_filter_scope_summary'), 'Canonical schema should include saved filter summary view.');
addCheck('schema-has-close-wizard-steps', schema.includes('v_admin_close_wizard_steps'), 'Canonical schema should include close wizard step view.');
addCheck('schema-has-health-resolution-queue', schema.includes('v_admin_health_resolution_queue'), 'Canonical schema should include health resolution queue view.');
addCheck('schema-has-deployment-gates', schema.includes('v_admin_deployment_gate_status'), 'Canonical schema should include deployment gate status view.');
addCheck('schema-has-public-seo-smoke-check', schema.includes('v_public_seo_smoke_check'), 'Canonical schema should include public SEO smoke check view.');
addCheck('schema-has-admin-audit-log', schema.includes('v_admin_audit_event_directory'), 'Canonical schema should include the admin audit event directory view.');
addCheck('schema-has-bank-csv-import', schema.includes('v_bank_csv_import_session_directory'), 'Canonical schema should include the bank CSV import staging directory view.');
addCheck('schema-has-backup-rehearsal', schema.includes('v_admin_backup_restore_rehearsal_directory'), 'Canonical schema should include the backup/restore rehearsal directory view.');
addCheck('schema-has-evidence-action-queue', schema.includes('v_admin_evidence_action_queue'), 'Canonical schema should include the evidence action queue view.');
addCheck('schema-has-mobile-action-cards', schema.includes('v_admin_mobile_action_card_directory'), 'Canonical schema should include mobile action card view.');
addCheck('schema-has-mobile-navigation-quality-gates', schema.includes('v_mobile_navigation_quality_gates'), 'Canonical schema should include mobile navigation quality gate tracking.');
addCheck('schema-has-frontend-quality-gates', schema.includes('app_frontend_quality_gates'), 'Canonical schema should include frontend UI quality gates.');
addCheck('schema-has-pagination-settings', schema.includes('v_admin_list_pagination_settings'), 'Canonical schema should include admin pagination settings.');
addCheck('admin-directory-does-not-select-job-status', !read('supabase/functions/admin-directory/index.ts').includes('job_status,client_id'), 'admin-directory should not select jobs.job_status directly because live schema may use jobs.status.');
addCheck('admin-selectors-does-not-select-job-status', !read('supabase/functions/admin-selectors/index.ts').includes('job_status,client_id'), 'admin-selectors should not select jobs.job_status directly because live schema may use jobs.status.');
addCheck('admin-renders-command-center', adminUi.includes('Admin Home Command Center') && adminUi.includes('renderAdminCommandCenter'), 'admin-ui.js should render the Admin Home Command Center.');
addCheck('admin-renders-saved-filters', adminUi.includes('Save Current View') && adminUi.includes('renderSavedFilters'), 'admin-ui.js should render and save admin saved filters.');
addCheck('admin-renders-deployment-gates', adminUi.includes('ad_deployment_gate_table') && adminUi.includes('adminDeploymentGateStatus'), 'admin-ui.js should render deployment gates.');
addCheck('admin-renders-seo-smoke-table', adminUi.includes('ad_seo_smoke_table') && adminUi.includes('publicSeoSmokeCheck'), 'admin-ui.js should render SEO smoke check rows.');
addCheck('admin-renders-health-center', adminUi.includes('App Health and Schema Center') && adminUi.includes('renderAdminHealthCenter'), 'admin-ui.js should render the App Health and Schema Center.');
addCheck('edge-loads-command-center', read('supabase/functions/admin-directory/index.ts').includes('v_admin_home_command_center'), 'admin-directory should load the Admin Command Center views.');
addCheck('edge-loads-schema-109-views', read('supabase/functions/admin-directory/index.ts').includes('v_admin_close_wizard_steps') && read('supabase/functions/admin-directory/index.ts').includes('v_admin_audit_event_directory') && read('supabase/functions/admin-directory/index.ts').includes('v_bank_csv_import_session_directory'), 'admin-directory should load schema 109 readiness views.');
addCheck('edge-loads-mobile-quality-gates', read('supabase/functions/admin-directory/index.ts').includes('v_mobile_navigation_quality_gates'), 'admin-directory should load mobile navigation quality gates when schema 110 is applied.');
addCheck('admin-manage-saves-filters', read('supabase/functions/admin-manage/index.ts').includes("entity === 'admin_saved_filter'"), 'admin-manage should support saved filter write actions.');
addCheck('admin-manage-close-step-actions', read('supabase/functions/admin-manage/index.ts').includes("entity === 'admin_close_workflow_step'"), 'admin-manage should support guided close step actions.');
addCheck('admin-manage-evidence-actions', read('supabase/functions/admin-manage/index.ts').includes("entity === 'admin_evidence_action'"), 'admin-manage should support evidence action queue writes.');
addCheck('active-docs-archived-snapshot', fileExists('archive/markdown-current-snapshot-2026-05-16a/root/README.md'), 'Archive snapshot should preserve the previous root README.');
addCheck('retired-markdown-not-in-root', !fileExists('AI_START_PROMPT.md') && !fileExists('PROJECT_BRAIN.md') && !fileExists('REPO_BASE.md') && !fileExists('RUNBOOK_AUTH_BOOTSTRAP.md'), 'Retired root Markdown should be moved out of the active root.');
addCheck('no-test-write-files', !fileExists('test_write.txt') && !fileExists('test_write2_OLD.txt') && !fileExists('test_write3.txt') && !fileExists('test_write_OLD.txt'), 'Temporary test_write files should not exist in the active root.');
addCheck('verifydb-retired-from-active-sql', !fileExists('sql/VerifyDB_24_04_2026.sql'), 'Old VerifyDB helper should stay archived, not active in sql/.');

console.log(JSON.stringify({ ok: !failed, checks: results }, null, 2));
if (failed) process.exit(1);

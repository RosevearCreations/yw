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
  'sql/111_admin_directory_pagination_saved_view_replay.sql',
  'sql/112_admin_operations_pagination_sorting_panel_refresh.sql',
  'sql/113_admin_panel_refresh_and_job_review_actions.sql',
  'sql/114_staged_admin_load_and_cache_fallback_guardrails.sql',
  'sql/115_admin_panel_retry_timing_and_command_scope.sql',
  'sql/116_admin_diagnostics_drawer_and_stale_data_badges.sql',
  'sql/117_split_admin_scopes_confirmation_and_deployment_checklist.sql',
  'sql/118_admin_preflight_registry_deployment_checklist_ui.sql',
  'sql/119_admin_action_permissions_preflight_and_retry_rules.sql',
  'sql/120_ontario_ohsa_mobile_first_app_guardrails.sql',
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
addCheck('schema-header-current', /121_mobile_today_dashboard_pwa_and_offline_badges/i.test(schema), 'Schema snapshot should reflect the latest 121 pass.');

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
addCheck('schema-has-111-pagination-replay-marker', schema.includes('111_admin_directory_pagination_saved_view_replay'), 'Canonical schema should include schema 111 pagination and saved-view replay marker.');
addCheck('admin-directory-does-not-select-job-status', !read('supabase/functions/admin-directory/index.ts').includes('job_status,client_id'), 'admin-directory should not select jobs.job_status directly because live schema may use jobs.status.');
addCheck('admin-selectors-does-not-select-job-status', !read('supabase/functions/admin-selectors/index.ts').includes('job_status,client_id'), 'admin-selectors should not select jobs.job_status directly because live schema may use jobs.status.');
addCheck('admin-renders-command-center', adminUi.includes('Admin Home Command Center') && adminUi.includes('renderAdminCommandCenter'), 'admin-ui.js should render the Admin Home Command Center.');
addCheck('admin-renders-saved-filters', adminUi.includes('Save Current View') && adminUi.includes('renderSavedFilters'), 'admin-ui.js should render and save admin saved filters.');
addCheck('admin-renders-deployment-gates', adminUi.includes('ad_deployment_gate_table') && adminUi.includes('adminDeploymentGateStatus'), 'admin-ui.js should render deployment gates.');
addCheck('admin-renders-seo-smoke-table', adminUi.includes('ad_seo_smoke_table') && adminUi.includes('publicSeoSmokeCheck'), 'admin-ui.js should render SEO smoke check rows.');
addCheck('admin-renders-health-center', adminUi.includes('App Health and Schema Center') && adminUi.includes('renderAdminHealthCenter'), 'admin-ui.js should render the App Health and Schema Center.');
addCheck('edge-loads-command-center', read('supabase/functions/admin-directory/index.ts').includes('v_admin_home_command_center'), 'admin-directory should load the Admin Command Center views.');
addCheck('edge-loads-schema-109-views', read('supabase/functions/admin-directory/index.ts').includes('v_admin_close_wizard_steps') && read('supabase/functions/admin-directory/index.ts').includes('v_admin_audit_event_directory') && read('supabase/functions/admin-directory/index.ts').includes('v_bank_csv_import_session_directory'), 'admin-directory should load schema 109 readiness views.');
addCheck('edge-loads-mobile-quality-gates', read('supabase/functions/admin-directory/index.ts').includes('v_mobile_navigation_quality_gates'), 'admin-directory should load mobile navigation quality gates when schema 110+ is applied.');
addCheck('edge-returns-people-pagination-meta', read('supabase/functions/admin-directory/index.ts').includes('people_page_size') && read('supabase/functions/admin-directory/index.ts').includes('pagination_meta'), 'admin-directory should accept people pagination controls and return pagination_meta.');
addCheck('edge-returns-jobs-pagination-meta', read('supabase/functions/admin-directory/index.ts').includes('jobs_page_size') && read('supabase/functions/admin-directory/index.ts').includes('safeListPaged'), 'admin-directory should have a paged jobs query path.');
addCheck('admin-staff-pagination-controls', adminUi.includes('ad_staff_pager') && adminUi.includes('applyStaffDirectoryFilter'), 'Admin UI should render Staff Directory search, role, page size, and previous/next controls.');
addCheck('admin-staff-sort-controls', adminUi.includes('ad_staff_sort') && adminUi.includes('people_sort'), 'Admin UI should render Staff Directory sort controls and send people_sort to admin-directory.');
addCheck('admin-jobs-pagination-controls', adminUi.includes('ad_jobs_pager') && adminUi.includes('applyJobsDirectoryFilter'), 'Admin UI should render visible Jobs/Operations pagination controls.');
addCheck('edge-supports-admin-directory-sorting', read('supabase/functions/admin-directory/index.ts').includes('allowSort') && read('supabase/functions/admin-directory/index.ts').includes('people_sort') && read('supabase/functions/admin-directory/index.ts').includes('jobs_sort'), 'admin-directory should sanitize and honor Staff/Jobs sorting parameters.');
addCheck('schema-has-112-operations-pagination-marker', schema.includes('112_admin_operations_pagination_sorting_panel_refresh'), 'Canonical schema should include schema 112 operations pagination/sorting marker.');
addCheck('admin-saved-filter-replays-staff-filters', adminUi.includes('people_search') && adminUi.includes('people_role_filter') && adminUi.includes('jobs_search') && adminUi.includes('Loaded saved admin view with section, Staff Directory filters, and Jobs paging filters'), 'Saved admin filters should persist/replay Staff Directory and Jobs paging filters.');
addCheck('admin-manage-saves-filters', read('supabase/functions/admin-manage/index.ts').includes("entity === 'admin_saved_filter'"), 'admin-manage should support saved filter write actions.');
addCheck('admin-manage-close-step-actions', read('supabase/functions/admin-manage/index.ts').includes("entity === 'admin_close_workflow_step'"), 'admin-manage should support guided close step actions.');
addCheck('admin-manage-evidence-actions', read('supabase/functions/admin-manage/index.ts').includes("entity === 'admin_evidence_action'"), 'admin-manage should support evidence action queue writes.');
addCheck('active-docs-archived-snapshot', fileExists('archive/markdown-current-snapshot-2026-05-27a/README.md'), 'Archive snapshot should preserve the previous root README for the current pass.');
addCheck('retired-markdown-not-in-root', !fileExists('AI_START_PROMPT.md') && !fileExists('PROJECT_BRAIN.md') && !fileExists('REPO_BASE.md') && !fileExists('RUNBOOK_AUTH_BOOTSTRAP.md'), 'Retired root Markdown should be moved out of the active root.');
addCheck('no-test-write-files', !fileExists('test_write.txt') && !fileExists('test_write2_OLD.txt') && !fileExists('test_write3.txt') && !fileExists('test_write_OLD.txt'), 'Temporary test_write files should not exist in the active root.');
addCheck('verifydb-retired-from-active-sql', !fileExists('sql/VerifyDB_24_04_2026.sql'), 'Old VerifyDB helper should stay archived, not active in sql/.');


addCheck('schema-has-113-panel-refresh-marker', schema.includes('113_admin_panel_refresh_and_job_review_actions'), 'Canonical schema should include schema 113 panel-refresh and job-review marker.');
addCheck('admin-has-panel-refresh-buttons', adminUi.includes('ad_staff_refresh_panel') && adminUi.includes('ad_jobs_refresh_panel') && adminUi.includes('refreshAdminPanelScope'), 'Admin UI should expose panel-only refresh buttons and handler.');
addCheck('admin-renders-jobs-review-table', adminUi.includes('ad_jobs_review_table') && adminUi.includes('handleJobReviewAction'), 'Admin UI should render a separate Jobs review table with row actions.');
addCheck('admin-manage-job-actions', read('supabase/functions/admin-manage/index.ts').includes("entity === 'job'") && read('supabase/functions/admin-manage/index.ts').includes("action === 'add_note'"), 'admin-manage should support job status/note actions from the Jobs review table.');
addCheck('edge-has-panel-fast-paths', read('supabase/functions/admin-directory/index.ts').includes("operations_scope: 'fast_path'") && read('supabase/functions/admin-directory/index.ts').includes("health_scope: 'fast_path'") && read('supabase/functions/admin-directory/index.ts').includes("accounting_scope: 'fast_path'"), 'admin-directory should expose narrow panel fast paths for operations, health, and accounting.');


addCheck('schema-has-114-staged-admin-load-marker', schema.includes('114_staged_admin_load_and_cache_fallback_guardrails'), 'Canonical schema should include schema 114 staged Admin load marker.');
addCheck('admin-loads-staged-scopes-first', adminUi.includes('getRegisteredInitialAdminScopes') && adminUi.includes("let stagedScopes = ['command_center']") && adminUi.includes("scope: 'all',") && adminUi.includes('timeoutMs: 90000'), 'Admin initial load should try staged panel scopes before the heavy all-scope emergency fallback.');
addCheck('admin-summary-reports-staged-warnings', adminUi.includes('state.adminLoadWarnings') && adminUi.includes('Some panels need retry'), 'Admin UI should report staged panel retry warnings instead of immediately showing only cached data.');
addCheck('cache-version-2026-05-27a', read('server-worker.js').includes('2026-05-27a') && read('index.html').includes('2026-05-27a'), 'Index and service worker should use the 2026-05-27a asset/cache version.');

addCheck('schema-has-115-panel-retry-marker', schema.includes('115_admin_panel_retry_timing_and_command_scope'), 'Canonical schema should include schema 115 panel retry/timing marker.');
addCheck('admin-has-command-center-fast-path-stage', adminUi.includes("'command_center'") && adminUi.includes('Retry Command Center') && adminUi.includes('recordAdminScopeTiming'), 'Admin UI should load a command_center scope and show retry/timing state.');
addCheck('admin-has-health-accounting-retry-buttons', adminUi.includes('ad_health_refresh_panel') && adminUi.includes('ad_accounting_refresh_panel'), 'Admin UI should expose Health and Accounting panel retry buttons.');
addCheck('admin-renders-scope-timing-cards', adminUi.includes('renderAdminScopeStatus') && adminUi.includes('admin-scope-status-card'), 'Admin UI should render per-scope live load timing cards.');
addCheck('edge-has-command-center-fast-path', read('supabase/functions/admin-directory/index.ts').includes("command_center_scope: 'fast_path'"), 'admin-directory should expose a lightweight command_center fast path.');
addCheck('style-has-admin-scope-status-mobile', read('style.css').includes('.admin-scope-status-grid') && read('style.css').includes('.admin-scope-status-card'), 'style.css should include mobile-safe Admin scope timing cards.');
addCheck('active-docs-archived-snapshot-2026-05-27a-legacy-check', fileExists('archive/markdown-current-snapshot-2026-05-27a/README.md'), 'Archive snapshot should preserve the previous root README for the 2026-05-27a pass.');

addCheck('report-subscription-delivery-run-newline-escapes', !read('supabase/functions/report-subscription-delivery-run/index.ts').includes("join('\n')") || read('supabase/functions/report-subscription-delivery-run/index.ts').includes("lines.join('\\n')"), 'Report delivery function should use escaped newline strings that bundle correctly.');

addCheck('schema-has-116-admin-diagnostics-marker', schema.includes('116_admin_diagnostics_drawer_and_stale_data_badges'), 'Canonical schema should include schema 116 Admin diagnostics marker.');
addCheck('admin-has-diagnostics-drawer', adminUi.includes('ad_scope_diagnostics_details') && adminUi.includes('renderAdminScopeDiagnostics'), 'Admin UI should render an expandable panel diagnostics drawer.');
addCheck('admin-has-stale-age-badges', adminUi.includes('admin-age-badge') && adminUi.includes('renderAdminPanelAgeBadges'), 'Admin UI should show stale-data age badges for staged panel loads.');
addCheck('admin-persists-panel-failures', adminUi.includes("entity: 'admin_panel_load_diagnostic'") && read('supabase/functions/admin-manage/index.ts').includes("entity === 'admin_panel_load_diagnostic'"), 'Admin UI and admin-manage should persist failed staged panel loads.');
addCheck('edge-loads-panel-diagnostics', read('supabase/functions/admin-directory/index.ts').includes('v_admin_panel_load_diagnostics'), 'admin-directory should return persisted panel diagnostics in health/all scopes.');
addCheck('style-has-admin-diagnostics-mobile', read('style.css').includes('.admin-diagnostics-drawer') && read('style.css').includes('.admin-age-badge'), 'style.css should include mobile-safe diagnostics drawer and age badge rules.');
addCheck('active-docs-archived-snapshot-2026-05-27a', fileExists('archive/markdown-current-snapshot-2026-05-27a/README.md'), 'Archive snapshot should preserve the previous root README for the 2026-05-27a pass.');


addCheck('schema-has-117-split-scope-marker', schema.includes('117_split_admin_scopes_confirmation_and_deployment_checklist'), 'Canonical schema should include schema 117 split Admin scope marker.');
addCheck('edge-has-split-accounting-fast-paths', read('supabase/functions/admin-directory/index.ts').includes("scope === 'accounting_close'") && read('supabase/functions/admin-directory/index.ts').includes("scope === 'banking'") && read('supabase/functions/admin-directory/index.ts').includes("scope === 'tax_payroll'"), 'admin-directory should expose split accounting fast paths.');
addCheck('edge-has-evidence-fast-path', read('supabase/functions/admin-directory/index.ts').includes("scope === 'evidence'") && read('supabase/functions/admin-directory/index.ts').includes('v_evidence_manager_directory'), 'admin-directory should expose a dedicated evidence fast path.');
addCheck('admin-loads-split-scopes-first', adminUi.includes("'accounting_close'") && adminUi.includes("'tax_payroll'") && adminUi.includes("'evidence'"), 'Admin initial load should use split accounting/evidence scopes.');
addCheck('admin-has-confirmation-guardrails', adminUi.includes('confirmAdminAction') && adminUi.includes('Mark job') && adminUi.includes('Create an evidence follow-up'), 'Admin UI should confirm status-changing actions.');
addCheck('style-has-admin-skeleton-loaders', read('style.css').includes('is-admin-loading') && read('style.css').includes('adminSkeletonPulse'), 'style.css should include Admin skeleton loader rules.');
addCheck('active-docs-archived-snapshot-2026-05-27a', fileExists('archive/markdown-current-snapshot-2026-05-27a/README.md'), 'Archive snapshot should preserve the previous root README for the 2026-05-27a pass.');

addCheck('schema-has-118-admin-preflight-marker', schema.includes('118_admin_preflight_registry_deployment_checklist_ui'), 'Canonical schema should include schema 118 Admin preflight/readiness marker.');
addCheck('admin-renders-deployment-checklist-table', adminUi.includes('ad_deployment_checklist_table') && adminUi.includes('adminDeploymentChecklist'), 'Admin UI should render deployment checklist rows from v_admin_deployment_checklist.');
addCheck('admin-renders-function-readiness-table', adminUi.includes('ad_function_readiness_table') && adminUi.includes('adminFunctionReadinessChecks'), 'Admin UI should render function readiness rows from v_admin_function_readiness_checks.');
addCheck('admin-loads-registry-driven-scopes', adminUi.includes('getRegisteredInitialAdminScopes') && adminUi.includes('adminFastPathScopeRegistry'), 'Admin UI should use the DB-backed fast-path scope registry when available.');
addCheck('edge-loads-admin-scope-registry', read('supabase/functions/admin-directory/index.ts').includes('v_admin_fast_path_scope_registry') && read('supabase/functions/admin-directory/index.ts').includes('v_admin_deployment_checklist') && read('supabase/functions/admin-directory/index.ts').includes('v_admin_function_readiness_checks'), 'admin-directory should return scope registry, deployment checklist, and function readiness rows.');


addCheck('schema-has-119-action-permission-marker', schema.includes('119_admin_action_permissions_preflight_and_retry_rules'), 'Canonical schema should include schema 119 action permission/preflight/retry marker.');
addCheck('schema-has-admin-action-permission-registry', schema.includes('v_admin_action_permission_registry') && schema.includes('admin_action_permission_registry'), 'Canonical schema should include Admin action permission registry and view.');
addCheck('schema-has-admin-panel-retry-policy', schema.includes('v_admin_panel_retry_policy') && schema.includes('admin_panel_retry_policy'), 'Canonical schema should include Admin panel retry/backoff policy and view.');
addCheck('schema-has-admin-schema-preflight', schema.includes('v_admin_schema_preflight_checks') && schema.includes('admin_schema_preflight_checks'), 'Canonical schema should include Admin schema preflight checks and view.');
addCheck('admin-renders-action-permission-table', adminUi.includes('ad_action_permission_table') && adminUi.includes('applyAdminActionDisabledStates'), 'Admin UI should render action permission rows and disable known buttons by registry/role.');
addCheck('admin-renders-schema-preflight-table', adminUi.includes('ad_schema_preflight_table') && adminUi.includes('adminSchemaPreflightChecks'), 'Admin UI should render schema preflight rows in Production Readiness.');
addCheck('admin-renders-panel-retry-policy-table', adminUi.includes('ad_panel_retry_policy_table') && adminUi.includes('adminPanelRetryPolicy'), 'Admin UI should render panel retry/backoff policy rows.');
addCheck('edge-loads-admin-action-permission-registry', read('supabase/functions/admin-directory/index.ts').includes('v_admin_action_permission_registry') && read('supabase/functions/admin-directory/index.ts').includes('actor_role'), 'admin-directory should return action permission registry rows and actor_role for role-aware disabled states.');
addCheck('cache-version-2026-05-27a-latest', read('server-worker.js').includes('2026-05-27a') && read('index.html').includes('2026-05-27a'), 'Index and service worker should use the 2026-05-27a asset/cache version.');


addCheck('schema-has-120-ontario-mobile-marker', schema.includes('120_ontario_ohsa_mobile_first_app_guardrails'), 'Canonical schema should include schema 120 Ontario OHSA/mobile-first marker.');
addCheck('schema-has-mobile-first-quality-gates', schema.includes('v_app_mobile_first_quality_gates') && schema.includes('app_mobile_first_quality_gates'), 'Canonical schema should include mobile-first quality gates and view.');
addCheck('schema-has-jurisdiction-wording-gates', schema.includes('v_app_jurisdiction_wording_gates') && schema.includes('app_jurisdiction_wording_gates'), 'Canonical schema should include Ontario jurisdiction wording gates and view.');
addCheck('edge-loads-mobile-and-wording-gates', read('supabase/functions/admin-directory/index.ts').includes('v_app_mobile_first_quality_gates') && read('supabase/functions/admin-directory/index.ts').includes('v_app_jurisdiction_wording_gates'), 'admin-directory should return mobile-first and Ontario wording gate rows.');
const visibleCopyFiles = ['index.html', 'js/admin-ui.js', 'js/hse-ops-ui.js', 'js/reports-ui.js', 'manifest.json'];
const visibleCopy = visibleCopyFiles.map((file) => read(file)).join('\n');
addCheck(
  'ontario-ohsa-visible-copy',
  !/OSHA/.test(visibleCopy),
  'Visible app copy should use Ontario OHSA / workplace safety wording, not U.S. safety wording.'
);
addCheck(
  'mobile-quick-nav-present',
  /id="mobileQuickNav"/.test(indexHtml) && /mobile-quick-nav/.test(read('style.css')),
  'Mobile quick-action bar should be present for phone-first field usage.'
);


addCheck('schema-has-121-mobile-today-marker', schema.includes('121_mobile_today_dashboard_pwa_and_offline_badges'), 'Canonical schema should include schema 121 mobile Today/PWA/offline badge marker.');
addCheck('schema-has-mobile-today-registry', schema.includes('v_mobile_today_action_registry') && schema.includes('mobile_today_action_registry'), 'Canonical schema should include mobile Today action registry and view.');
addCheck('schema-has-mobile-pwa-gates', schema.includes('v_mobile_pwa_install_quality_gates') && schema.includes('mobile_pwa_install_quality_gates'), 'Canonical schema should include mobile PWA install quality gates and view.');
addCheck('today-route-present', indexHtml.includes('id="today"') && indexHtml.includes('mobileTodayGrid'), 'index.html should include the mobile Today dashboard route.');
addCheck('today-default-route', read('js/router.js').includes("const DEFAULT_SECTION = 'today'") && read('manifest.json').includes('"start_url": "/#today"'), 'Router and PWA manifest should default to #today.');
addCheck('mobile-today-script-loaded', indexHtml.includes('/js/mobile-today.js') && fileExists('js/mobile-today.js'), 'index.html should load js/mobile-today.js.');
addCheck('mobile-quick-nav-six-actions', indexHtml.includes('data-mobile-quick="today"') && indexHtml.includes('data-mobile-quick="hseops"') && indexHtml.includes('data-mobile-quick="admin"'), 'Mobile quick nav should include Today, Safety, and Admin actions.');
addCheck('mobile-quick-badges-present', indexHtml.includes('data-mobile-badge="today"') && read('js/mobile-menu.js').includes('syncBadges') && read('js/outbox.js').includes('notifyQueueChanged'), 'Mobile quick nav badges should be wired to outbox/action queue changes.');
addCheck('style-has-mobile-today-cards', read('style.css').includes('.mobile-today-grid') && read('style.css').includes('.mobile-install-card') && read('style.css').includes('.mobile-quick-badge'), 'style.css should include mobile Today cards, PWA install card, and quick badge rules.');
addCheck('service-worker-caches-mobile-today', read('server-worker.js').includes('/js/mobile-today.js') && read('server-worker.js').includes('2026-05-27a'), 'Service worker should cache js/mobile-today.js with the latest cache version.');
addCheck('edge-loads-mobile-today-views', read('supabase/functions/admin-directory/index.ts').includes('v_mobile_today_action_registry') && read('supabase/functions/admin-directory/index.ts').includes('v_mobile_pwa_install_quality_gates'), 'admin-directory should return mobile Today/PWA quality gate views.');
addCheck('active-docs-archived-snapshot-2026-05-27a', fileExists('archive/markdown-current-snapshot-2026-05-27a/README.md'), 'Archive snapshot should preserve the previous root README for the 2026-05-27a pass.');

console.log(JSON.stringify({ ok: !failed, checks: results }, null, 2));
if (failed) process.exit(1);

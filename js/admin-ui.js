/* File: js/admin-ui.js
   Brief description: Admin Dashboard UI controller.
   Renders a live approval/notification panel with approve/reject/resolve actions,
   deploy smoke checks, queued admin action retry, and lightweight directory counts.
*/

'use strict';

(function () {
  function escHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function createAdminUI(config = {}) {
    const loadAdminDirectory = config.loadAdminDirectory;
    const loadAdminSelectors = config.loadAdminSelectors || window.YWIAPI?.loadAdminSelectors;
    const manageAdminEntity = window.YWIAPI?.manageAdminEntity;
    const manageSummary = config.manageSummary || function () {};
    const getCurrentRole = config.getCurrentRole || (() => 'worker');
    const getAccessProfile = config.getAccessProfile || (() => ({
      canViewAdminDirectory: false,
      canManageAdminDirectory: false,
      roleLabel: 'Worker'
    }));

    const state = {
      locked: true,
      manageLocked: true,
      notifications: [],
      counts: { users: 0, sites: 0, assignments: 0, orders: 0 },
      users: [],
      sites: [],
      assignments: [],
      selectors: { profiles: [], sites: [], assignments: [], positions: [], trades: [], staffTiers: [], seniorityLevels: [], employmentStatuses: [], jobTypes: [], units: [], costCodes: [], serviceAreas: [], routes: [], jobs: [], routeStops: [], routeStopExecutions: [], routeStopExecutionAttachments: [], clients: [], clientSites: [], materials: [], equipmentMaster: [], estimates: [], estimateLines: [], workOrders: [], workOrderLines: [], subcontractClients: [], subcontractDispatches: [], linkedHsePackets: [], hsePacketEvents: [], hsePacketProofs: [], glAccounts: [], glJournalBatches: [], glJournalSyncExceptions: [], glJournalEntries: [], vendors: [], arInvoices: [], arPayments: [], apBills: [], apPayments: [], materialReceipts: [], materialReceiptLines: [], materialIssues: [], materialIssueLines: [], fieldUploadFailures: [], appTrafficEvents: [], backendMonitorEvents: [], trafficDailySummary: [], monitorThresholdAlerts: [], adminHomeCommandCenter: [], adminErrorHealthCenter: [], adminTaskInbox: [], appSchemaVersionStatus: [], roleDashboardPresets: [], hsePacketActionItems: [], hseDashboardSummary: [], accountingReviewSummary: [], jobFinancialEvents: [], jobFinancialRollups: [], recurringServiceAgreements: [], snowEventTriggers: [], changeOrders: [], customerAssets: [], customerAssetJobLinks: [], warrantyCallbackEvents: [], payrollExportRuns: [], payrollReviewSummary: [], routeProfitabilitySummary: [], serviceContractDocuments: [], serviceAgreementProfitabilitySummary: [], snowEventInvoiceCandidates: [], callbackWarrantyDashboardSummary: [], payrollReviewDetail: [], estimateConversionCandidates: [], serviceExecutionSchedulerSettings: [], serviceExecutionSchedulerStatus: [], signedContractJobKickoffCandidates: [] },
      salesOrders: [],
      accountingEntries: [],
      siteActivityEvents: [],
      siteActivitySummary: [],
      siteActivityTypeRollups: [],
      siteActivityEntityRollups: [],
      attendancePhotoReview: [],
      hseEvidenceReview: [],
      payrollCloseReviewSummary: [],
      serviceExecutionSchedulerSettings: [],
      serviceExecutionSchedulerStatus: [],
      signedContractJobKickoffCandidates: [],
      serviceAreas: [],
      routes: [],
      jobs: [],
      routeStops: [],
      routeStopExecutions: [],
      routeStopExecutionAttachments: [],
      clients: [],
      clientSites: [],
      unitsOfMeasure: [],
      costCodes: [],
      taxCodes: [],
      servicePricingTemplates: [],
      businessTaxSettings: [],
      jobFinancialEvents: [],
      jobFinancialRollups: [],
      recurringServiceAgreements: [],
      snowEventTriggers: [],
      changeOrders: [],
      customerAssets: [],
      customerAssetJobLinks: [],
      warrantyCallbackEvents: [],
      payrollExportRuns: [],
      payrollReviewSummary: [],
      routeProfitabilitySummary: [],
      serviceContractDocuments: [],
      serviceAgreementProfitabilitySummary: [],
      snowEventInvoiceCandidates: [],
      callbackWarrantyDashboardSummary: [],
      payrollReviewDetail: [],
      estimateConversionCandidates: [],
      employeeTimeAttendanceExceptions: [],
      employeeTimeEntryReviews: [],
      operationsDashboardSummary: [],
      serviceAgreementExecutionCandidates: [],
      employeeTimeReviewQueue: [],
      employeeTimeReviewSummary: [],
      materialsCatalog: [],
      equipmentMaster: [],
      estimates: [],
      estimateLines: [],
      workOrders: [],
      workOrderLines: [],
      subcontractClients: [],
      subcontractDispatches: [],
      linkedHsePackets: [],
      hsePacketEvents: [],
      hsePacketProofs: [],
      chartOfAccounts: [],
      glJournalBatches: [],
      glJournalSyncExceptions: [],
      glJournalEntries: [],
      apVendors: [],
      arInvoices: [],
      arPayments: [],
      apBills: [],
      apPayments: [],
      bankAccounts: [],
      accountingPeriodCloses: [],
      salesTaxFilings: [],
      payrollRemittanceRuns: [],
      bankStatementImports: [],
      bankReconciliationSessions: [],
      bankReconciliationItems: [],
      bankReconciliationMatchScored: [],
      arPaymentApplications: [],
      apPaymentApplications: [],
      accountantHandoffExports: [],
      accountantHandoffPackages: [],
      accountingCloseAdminControlDashboard: [],
      accountingReconciliationManualReviewQueue: [],
      accountingClosePackageDeliveryQueue: [],
      materialReceipts: [],
      materialReceiptLines: [],
      materialIssues: [],
      materialIssueLines: [],
      fieldUploadFailures: [],
      appTrafficEvents: [],
      backendMonitorEvents: [],
      trafficDailySummary: [],
      monitorThresholdAlerts: [],
      adminHomeCommandCenter: [],
      adminErrorHealthCenter: [],
      adminTaskInbox: [],
      appSchemaVersionStatus: [],
      roleDashboardPresets: [],
      schemaDriftStatus: [],
      productionReadinessChecklist: [],
      rolePermissionMatrix: [],
      adminSavedFilterDirectory: [],
      adminSavedFilterScopeSummary: [],
      adminCloseCenterOverview: [],
      adminCloseWizardSteps: [],
      adminHealthResolutionQueue: [],
      adminDeploymentGateStatus: [],
      publicSeoSmokeCheck: [],
      adminAuditEventDirectory: [],
      adminBackupRestoreRehearsals: [],
      bankCsvImportSessions: [],
      adminEvidenceActionQueue: [],
      adminMobileActionCards: [],
      mobileNavigationQualityGates: [],
      mobileFirstQualityGates: [],
      jurisdictionWordingGates: [],
      mobileTodayActionRegistry: [],
      mobilePwaInstallQualityGates: [],
      mobileFormStepperRegistry: [],
      mobileFormQualityGates: [],
      adminListPaginationSettings: [],
      evidenceManagerDirectory: [],
      hsePacketActionItems: [],
      hseDashboardSummary: [],
      accountingReviewSummary: [],
      smokeChecks: [],
      adminDirectoryMeta: {},
      adminLoadWarnings: [],
      adminScopeTimings: {},
      adminScopeLastUpdated: {},
      adminPanelLoadDiagnostics: [],
      adminFastPathScopeRegistry: [],
      adminActionConfirmationRules: [],
      adminActionPermissionRegistry: [],
      adminPanelRetryPolicy: [],
      adminSchemaPreflightChecks: [],
      adminDeploymentChecklist: [],
      adminFunctionReadinessChecks: [],
      appDeploymentBundleChecks: [],
      appPublicSeoChecks: [],
      appRuntimeFallbackChecks: [],
      appRoadmapActionSteps: [],
      appDepthReviewQueue: [],
      appDataMigrationCandidates: [],
      appSchemaDocumentationSyncChecks: [],
      appPublicRouteSeoRegistry: [],
      appInternalLinkSuggestionQueue: [],
      appCssComponentTokenInventory: [],
      appMobileFieldActionQueue: [],
      appReleaseManifestChecks: [],
      appPaymentApplicationActionRegistry: [],
      appAccountingCloseControlQueue: [],
      appEquipmentAccountabilityActionQueue: [],
      appPublicSeoPublicationQueue: [],
      appFallbackObservabilityMatrix: [],
      appSchemaMigrationCompatibilityChecks: [],
      appAccountingEvidencePackageQueue: [],
      appEquipmentReturnToServiceRules: [],
      appPublicAssetSmokeChecks: [],
      appErrorRecoveryPlaybook: [],
      appPaymentExecutionQueue: [],
      appBankReconciliationExecutionQueue: [],
      appEquipmentScanTemplateRegistry: [],
      appLocalSeoExecutionQueue: [],
      appFallbackDrillQueue: [],
      appPaymentApplicationUiQueue: [],
      appReconciliationImportValidationQueue: [],
      appEquipmentServiceCloseoutQueue: [],
      appSeoAssetPublicationQueue: [],
      appRuntimeRecoveryTelemetryQueue: [],
      appPaymentPostingProofQueue: [],
      appReconciliationMatchWorkbenchQueue: [],
      appEquipmentScanVerificationQueue: [],
      appLocalSeoAssetSmokeQueue: [],
      appRuntimeFallbackDrillHistoryQueue: [],
      appPaymentWritePathQueue: [],
      appReconciliationScoringRuleQueue: [],
      appEquipmentAccessoryTemplateQueue: [],
      appLocalSeoGenerationQueue: [],
      appMobileOfflineConflictResolutionQueue: [],
      appPaymentAdjustmentWorkflowQueue: [],
      appReconciliationExceptionResolutionQueue: [],
      appEquipmentScanRolloutQueue: [],
      appLocalSeoContentDepthQueue: [],
      appRuntimeErrorMessageCatalog: [],
      appReleaseValidationQueue: [],
      appPaymentReconciliationExecutionQueue: [],
      appEquipmentMobileScanValidationQueue: [],
      appLocalSeoReleaseValidationQueue: [],
      appRuntimeFallbackMessageQueue: [],
      appJsonDbMigrationExecutionQueue: [],
      appReleaseCutoverChecklist: [],
      appPaymentExceptionDecisionQueue: [],
      appEquipmentReturnToServiceGateQueue: [],
      appLocalSearchEvidenceQueue: [],
      appCssDriftWatchlist: [],
      appRuntimeFallbackTestPlan: [],
      appJsonDbSourceOfTruthQueue: [],
      appPaymentReconciliationCutoverDrillQueue: [],
      appEquipmentServiceCostRecoveryQueue: [],
      appLocalSeoProminenceActionQueue: [],
      appCssAccessibilityFallbackQueue: [],
      appDataMigrationValidationQueue: [],
      appRuntimeReleaseMessageQueue: [],
      appReleaseReadinessSignoffQueue: [],
      appAccountingExceptionClosureQueue: [],
      appEquipmentServiceVerificationQueue: [],
      appLocalSeoRefreshQueue: [],
      appCssMobileRegressionQueue: [],
      appRuntimeObservabilityReleaseQueue: [],
      appAccountingCutoverTrialBalanceQueue: [],
      appEquipmentScanAssetRolloutQueue: [],
      appLocalSeoProminencePublicationQueue: [],
      appCssMobileReleaseGuardQueue: [],
      appRuntimeSupportPlaybookQueue: [],
      appDataSourceMigrationLockQueue: [],
      appReleaseExitCriteriaQueue: [],
      appPaymentCloseoutActionQueue: [],
      appReconciliationExceptionWorkflowQueue: [],
      appEquipmentChainOfCustodyQueue: [],
      appLocalSeoConversionQueue: [],
      appRuntimeFallbackEscalationQueue: [],
      appReleaseHandoffQueue: [],
      appPaymentPostingProofQueue: [],
      appEquipmentCustodyEvidenceQueue: [],
      appSeoConversionEvidenceQueue: [],
      appRuntimeFallbackEventLogQueue: [],
      appSchemaDeployRepairQueue: [],
      appPaymentReconciliationProofCloseoutQueue: [],
      appEquipmentReturnExceptionActionQueue: [],
      appLocalSearchProminenceEvidenceQueue: [],
      appRuntimeFallbackObservabilityQueue: [],
      appJsonDbSourceMigrationQueue: [],
      actorRole: '',
      actorProfileId: '',
      directoryPagination: {
        people: { page: 1, pageSize: 25, total: 0, totalPages: 1, loaded: 0, search: '', roleFilter: '', sort: 'full_name', direction: 'asc' },
        jobs: { page: 1, pageSize: 25, total: 0, totalPages: 1, loaded: 0, search: '', sort: 'job_code', direction: 'asc' }
      },
      adminSection: 'home'
    };

    const DRAFT_KEY = 'ywi_admin_workspace_draft_v2';
    const ADMIN_CACHE_KEY = 'ywi_admin_directory_cache_v1';

    const ADMIN_SECTION_GROUPS = [
      ['home', 'Command Center'],
      ['people', 'People and Access'],
      ['operations', 'Jobs and Operations'],
      ['safety', 'Ontario Safety'],
      ['accounting', 'Accounting'],
      ['messaging', 'Messaging and Diagnostics'],
      ['health', 'Health and Schema'],
      ['readiness', 'Readiness'],
      ['all', 'Show All']
    ];

    const ADMIN_PANEL_GROUPS = {
      'Admin Home Command Center': ['home'],
      'App Health and Schema Center': ['home','health','messaging'],
      'Admin Task Inbox': ['home','health','operations','safety','accounting'],
      'Guided Close Center': ['home','accounting'],
      'Evidence Manager': ['home','safety','operations'],
      'Production Readiness and Permissions': ['home','health','readiness'],
      'Staff Directory and Access': ['people'],
      'Assignment Workbench': ['people'],
      'Dropdown and Catalog Manager': ['people','operations'],
      'Admin Password Control': ['people'],
      'Orders and Accounting Stub': ['accounting'],
      'Ontario OHSA / Workplace Safety Hub': ['safety'],
      'Operations and Accounting Backbone Manager': ['operations','safety','accounting'],
      'Deploy Smoke Check': ['messaging'],
      'Conflict Review': ['messaging'],
      'Approval Queue': ['messaging'],
      'Email Preview / Test Send': ['messaging']
    };

    function loadDraft() {
      try {
        return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
      } catch {
        return {};
      }
    }

    function saveDraft() {
      const e = els();
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          notification_id: e.emailNotificationId?.value || '',
          email_to: e.emailTo?.value || '',
          email_subject: e.emailSubject?.value || '',
          email_body: e.emailBody?.value || '',
          queue_search: e.search?.value || '',
          queue_status: e.filterStatus?.value || '',
          smoke_summary: e.smokeSummary?.textContent || '',
          target_profile_id: e.passwordProfileId?.value || '',
          order_customer_name: e.orderCustomerName?.value || '',
          order_customer_email: e.orderCustomerEmail?.value || ''
        }));
      } catch {}
    }

    function restoreDraft() {
      const e = els();
      const draft = loadDraft();
      if (e.emailNotificationId && !e.emailNotificationId.value) e.emailNotificationId.value = draft.notification_id || '';
      if (e.emailTo && !e.emailTo.value) e.emailTo.value = draft.email_to || '';
      if (e.emailSubject && !e.emailSubject.value) e.emailSubject.value = draft.email_subject || '';
      if (e.emailBody && !e.emailBody.value) e.emailBody.value = draft.email_body || '';
      if (e.search && !e.search.value) e.search.value = draft.queue_search || '';
      if (e.filterStatus && !e.filterStatus.value) e.filterStatus.value = draft.queue_status || '';
      if (e.passwordProfileId && !e.passwordProfileId.value) e.passwordProfileId.value = draft.target_profile_id || '';
      if (e.orderCustomerName && !e.orderCustomerName.value) e.orderCustomerName.value = draft.order_customer_name || '';
      if (e.orderCustomerEmail && !e.orderCustomerEmail.value) e.orderCustomerEmail.value = draft.order_customer_email || '';
    }

    function saveAdminCache(payload) {
      try { localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), payload })); } catch {}
    }

    function loadAdminCache() {
      try { return JSON.parse(localStorage.getItem(ADMIN_CACHE_KEY) || 'null'); } catch { return null; }
    }

    function ensureLayout() {
      const section = document.getElementById('admin');
      if (!section) return;
      if (section.dataset.adminLayoutReady === '1') return;
      section.dataset.adminLayoutReady = '1';
      section.innerHTML = `
        <div class="section-heading">
          <div>
            <h2>Admin</h2>
            <p class="section-subtitle">Administrative backend for staff accounts, approvals, password control, orders, accounting, and workflow oversight.</p>
          </div>
          <div class="admin-heading-actions">
            <button id="ad_reload" class="secondary" type="button">Reload</button>
          </div>
        </div>

        <div id="ad_summary" class="notice" style="display:none;margin-bottom:14px;"></div>

        <div class="admin-stats-grid" id="ad_stats_grid">
          <div class="admin-stat-card"><span>Users</span><strong id="ad_users_count">0</strong></div>
          <div class="admin-stat-card"><span>Sites</span><strong id="ad_sites_count">0</strong></div>
          <div class="admin-stat-card"><span>Assignments</span><strong id="ad_assignments_count">0</strong></div>
          <div class="admin-stat-card"><span>Queue</span><strong id="ad_notifications_count">0</strong></div>
          <div class="admin-stat-card"><span>Orders</span><strong id="ad_orders_count">0</strong></div>
        </div>

        <div class="admin-panel-block" data-admin-panel-title="Admin Home Command Center" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Admin Home Command Center</h3>
              <p class="section-subtitle">One-stop dashboard for open jobs, HSE reviews, accounting close, failed uploads, reporting health, and schema status.</p>
            </div>
            <div class="admin-heading-actions">
              <span id="ad_command_age_badge" class="admin-age-badge" data-status="warning">Not loaded</span>
              <button id="ad_command_refresh_panel" class="secondary" type="button">Retry Command Center</button>
            </div>
          </div>
          <div id="ad_command_center" class="admin-command-grid"></div>
          <div class="admin-saved-filter-toolbar" style="margin-top:12px;">
            <label>Saved view name
              <input id="ad_saved_filter_name" type="text" placeholder="Example: Accounting close review" />
            </label>
            <label>Scope
              <select id="ad_saved_filter_scope">
                <option value="home">Command Center</option>
                <option value="people">People and Access</option>
                <option value="operations">Operations</option>
                <option value="accounting">Accounting</option>
                <option value="safety">Safety / HSE</option>
                <option value="health">Health</option>
                <option value="readiness">Readiness</option>
              </select>
            </label>
            <label class="admin-inline-check"><input id="ad_saved_filter_shared" type="checkbox" /> Shared</label>
            <button id="ad_saved_filter_save" class="secondary" type="button">Save Current View</button>
          </div>
          <div id="ad_saved_filter_cards" class="admin-task-grid" style="margin-top:12px;"></div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_saved_filter_table">
              <thead><tr><th>Scope</th><th>Name</th><th>Owner</th><th>Shared</th><th>Used</th><th>Actions</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" data-admin-panel-title="App Health and Schema Center" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">App Health and Schema Center</h3>
              <p class="section-subtitle">Central place for frontend/API issues, backend alerts, schema markers, and fallback status so operators do not need the browser console first.</p>
            </div>
            <div class="admin-heading-actions">
              <span id="ad_health_age_badge" class="admin-age-badge" data-status="warning">Not loaded</span>
              <button id="ad_health_refresh_panel" class="secondary" type="button">Retry Health</button>
              <button id="ad_clear_diagnostics" class="secondary" type="button">Clear Local Diagnostics</button>
            </div>
          </div>
          <div id="ad_health_summary" class="notice" style="display:block;margin-bottom:12px;">Health data has not loaded yet.</div>
          <div id="ad_scope_status" class="admin-scope-status-grid" style="margin-bottom:12px;"></div>
          <div id="ad_panel_age_badges" class="admin-panel-age-grid" style="margin-bottom:12px;"></div>
          <details id="ad_scope_diagnostics_details" class="admin-diagnostics-drawer" style="margin-bottom:12px;">
            <summary>Panel diagnostics and live-load details</summary>
            <div id="ad_scope_diagnostics_body" class="admin-diagnostics-list"></div>
          </details>
          <div id="ad_health_cards" class="admin-health-grid"></div>
          <div class="table-scroll">
            <table id="ad_health_table">
              <thead><tr><th>Status</th><th>Source</th><th>Title</th><th>Message</th><th>Last Seen</th><th>Actions</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_schema_table">
              <thead><tr><th>Schema</th><th>Migration</th><th>Status</th><th>Applied</th><th>Notes</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" data-admin-panel-title="Admin Task Inbox" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Admin Task Inbox</h3>
              <p class="section-subtitle">DB-backed follow-up queue for notifications, close work, bank reconciliation exceptions, tax/remittance review, training, and corrective actions.</p>
            </div>
          </div>
          <div id="ad_task_cards" class="admin-task-grid"></div>
          <div class="table-scroll">
            <table id="ad_task_table">
              <thead><tr><th>Priority</th><th>Task</th><th>Source</th><th>Due / Last Seen</th><th>Route</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>


        <div class="admin-panel-block" data-admin-panel-title="Guided Close Center" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Guided Close Center</h3>
              <p class="section-subtitle">One place to see close blockers: open periods, payment applications, reconciliation, tax/remittance review, journal candidates, and accountant package delivery.</p>
            </div>
            <div class="admin-heading-actions">
              <span id="ad_accounting_age_badge" class="admin-age-badge" data-status="warning">Not loaded</span>
              <button id="ad_accounting_refresh_panel" class="secondary" type="button">Retry Accounting</button>
            </div>
          </div>
          <div id="ad_close_center_cards" class="admin-command-grid"></div>
          <div id="ad_close_center_summary" class="notice" style="display:block;margin:12px 0;">Close Center data has not loaded yet.</div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_close_wizard_detail_table">
              <thead><tr><th>Step</th><th>Status</th><th>Owner / Due</th><th>Blockers</th><th>Actions</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" data-admin-panel-title="Evidence Manager" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Evidence Manager</h3>
              <p class="section-subtitle">Unified queue for failed uploads, attendance photos, HSE packet proof, route attachments, signatures, and receipt/job evidence.</p>
            </div>
            <div class="admin-heading-actions">
              <span id="ad_evidence_age_badge" class="admin-age-badge" data-status="warning">Not loaded</span>
              <button id="ad_evidence_refresh_panel" class="secondary" type="button">Retry Evidence</button>
            </div>
          </div>
          <div id="ad_evidence_manager_cards" class="admin-task-grid"></div>
          <div class="table-scroll">
            <table id="ad_evidence_manager_table">
              <thead><tr><th>Status</th><th>Evidence</th><th>Source</th><th>Owner</th><th>Last Seen</th><th>Action</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_evidence_action_queue_table">
              <thead><tr><th>Status</th><th>Action</th><th>Evidence</th><th>Owner</th><th>Updated</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" data-admin-panel-title="Production Readiness and Permissions" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Production Readiness and Permissions</h3>
              <p class="section-subtitle">Schema drift, deployment gates, backup checks, and practical role permissions before treating the app like production software.</p>
            </div>
          </div>
          <div id="ad_readiness_cards" class="admin-health-grid"></div>
          <div class="table-scroll" style="margin-bottom:12px;">
            <table id="ad_schema_preflight_table">
              <thead><tr><th>Area</th><th>Object</th><th>Status</th><th>Operator Hint</th><th>Risk if Missing</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-bottom:12px;">
            <table id="ad_readiness_table">
              <thead><tr><th>Area</th><th>Check</th><th>Status</th><th>Action</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll">
            <table id="ad_permissions_table">
              <thead><tr><th>Role</th><th>Workflow</th><th>View</th><th>Create</th><th>Approve</th><th>Close/Reopen</th><th>Export</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_action_permission_table">
              <thead><tr><th>Action</th><th>Area</th><th>Required Role</th><th>Status</th><th>Disabled Message</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_deployment_gate_table">
              <thead><tr><th>Area</th><th>Gate</th><th>Status</th><th>Command / Check</th><th>Action</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_deployment_checklist_table">
              <thead><tr><th>Area</th><th>Checklist Item</th><th>Status</th><th>Command / Check</th><th>Risk if Missed</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_panel_retry_policy_table">
              <thead><tr><th>Panel</th><th>Scope</th><th>Attempts / Cooldown</th><th>Status</th><th>Operator Hint</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_function_readiness_table">
              <thead><tr><th>Function</th><th>Scope / Use</th><th>Status</th><th>Last Checked</th><th>Signoff</th><th>Deploy Hint</th><th>Failure Hint</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_build_guardrail_table">
              <thead><tr><th>Area</th><th>Build / Bundle Check</th><th>Status</th><th>Command / Route</th><th>Risk if Missed</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_public_seo_guardrail_table">
              <thead><tr><th>Area</th><th>SEO / Local Check</th><th>Status</th><th>Local Wording Hint</th><th>Risk if Missed</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_runtime_fallback_table">
              <thead><tr><th>Surface</th><th>Fallback Check</th><th>Status</th><th>Fallback Hint</th><th>Risk if Missed</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_roadmap_action_table">
              <thead><tr><th>Batch</th><th>#</th><th>Area</th><th>Step</th><th>Status</th><th>Acceptance Check</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_depth_review_table">
              <thead><tr><th>Area</th><th>Depth Gap</th><th>Status</th><th>Recommended Depth</th><th>Accounting / Cost Impact</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_data_migration_table">
              <thead><tr><th>Area</th><th>Source</th><th>Target</th><th>Risk</th><th>Status</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_schema_doc_sync_table">
              <thead><tr><th>Area</th><th>Sync Check</th><th>Status</th><th>File</th><th>Risk if Missed</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_route_seo_registry_table">
              <thead><tr><th>Route</th><th>Title / H1</th><th>Status</th><th>Local Terms</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_internal_link_queue_table">
              <thead><tr><th>Source</th><th>Target</th><th>Anchor / Context</th><th>Status</th><th>Reason</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_css_token_inventory_table">
              <thead><tr><th>Area</th><th>Token</th><th>Status</th><th>Mobile Check</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_mobile_field_action_table">
              <thead><tr><th>Area</th><th>Action</th><th>Status</th><th>Scan / Proof</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_release_manifest_table">
              <thead><tr><th>Release</th><th>Area</th><th>Status</th><th>File / Marker</th><th>Failure Hint</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_payment_action_registry_table">
              <thead><tr><th>Area</th><th>Payment Action</th><th>Status</th><th>Accounting Effect</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_accounting_close_control_table">
              <thead><tr><th>Close Area</th><th>Control</th><th>Status</th><th>Proof / Lock</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_equipment_accountability_action_table">
              <thead><tr><th>Area</th><th>Equipment Action</th><th>Status</th><th>Enforcement / Service Task</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_public_seo_publication_table">
              <thead><tr><th>Area</th><th>Publication Gate</th><th>Status</th><th>Smoke / Local Proof</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_fallback_observability_table">
              <thead><tr><th>Surface</th><th>Failure Mode</th><th>Status</th><th>User Message / Retry</th><th>Owner</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_payment_application_ui_queue_table">
              <thead><tr><th>Area</th><th>Payment UI Control</th><th>Status</th><th>Validation / Posting</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_reconciliation_import_validation_table">
              <thead><tr><th>Area</th><th>Import Check</th><th>Status</th><th>CSV / Match Rules</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_equipment_service_closeout_table">
              <thead><tr><th>Area</th><th>Closeout Control</th><th>Status</th><th>Proof / Cost / Return</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_seo_asset_publication_table">
              <thead><tr><th>Area</th><th>Asset Gate</th><th>Status</th><th>File / Local / Validation</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_runtime_recovery_telemetry_table">
              <thead><tr><th>Surface</th><th>Recovery Signal</th><th>Status</th><th>Signal / Message / Retry</th><th>Owner</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_payment_posting_proof_table">
              <thead><tr><th>Area</th><th>Proof Control</th><th>Status</th><th>Source / Proof / Block</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_reconciliation_match_workbench_table">
              <thead><tr><th>Area</th><th>Workbench Control</th><th>Status</th><th>Import / Score / Review</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_equipment_scan_verification_table">
              <thead><tr><th>Area</th><th>Verification Control</th><th>Status</th><th>Scan / Role / Evidence</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_local_seo_asset_smoke_table">
              <thead><tr><th>Area</th><th>SEO Asset Check</th><th>Status</th><th>Asset / Local / Validation</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_runtime_fallback_drill_history_table">
              <thead><tr><th>Surface</th><th>Fallback Drill</th><th>Status</th><th>Trigger / Expected / Evidence</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_payment_write_path_table">
              <thead><tr><th>Area</th><th>Write Path</th><th>Status</th><th>Validation / Proof / Rollback</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_reconciliation_scoring_rule_table">
              <thead><tr><th>Area</th><th>Scoring Rule</th><th>Status</th><th>Match / Review / Undo</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_equipment_accessory_template_table">
              <thead><tr><th>Pool</th><th>Accessory Template</th><th>Status</th><th>Checkout / Return / Exception</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_local_seo_generation_table">
              <thead><tr><th>Area</th><th>SEO Generation</th><th>Status</th><th>Output / Local / Validation</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_mobile_offline_conflict_resolution_table">
              <thead><tr><th>Form Area</th><th>Conflict Control</th><th>Status</th><th>Detect / Choice / Retry</th><th>Data Safety / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_payment_adjustment_workflow_table">
              <thead><tr><th>Area</th><th>Adjustment Workflow</th><th>Status</th><th>Validation / Posting / Reversal</th><th>Evidence / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_reconciliation_exception_resolution_table">
              <thead><tr><th>Area</th><th>Exception Rule</th><th>Status</th><th>Score / Review / Block</th><th>Undo / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_equipment_scan_rollout_table">
              <thead><tr><th>Area</th><th>Scan Rollout</th><th>Status</th><th>Device / Manual / Accessories</th><th>Verifier / Service Task</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_local_seo_content_depth_table">
              <thead><tr><th>Route</th><th>Content Depth</th><th>Status</th><th>Phrase / Proof / Links</th><th>Gate / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_runtime_error_message_catalog_table">
              <thead><tr><th>Surface</th><th>Error Message</th><th>Status</th><th>User / Operator / Telemetry</th><th>Retry / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_release_validation_table">
              <thead><tr><th>Area</th><th>Release Validation</th><th>Status</th><th>Evidence / Preflight</th><th>Failure / Owner</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_payment_reconciliation_execution_table">
              <thead><tr><th>Area</th><th>Execution Control</th><th>Status</th><th>Validate / Post / Approve</th><th>Rollback / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_equipment_mobile_scan_validation_table">
              <thead><tr><th>Area</th><th>Equipment Validation</th><th>Status</th><th>Scan / Accessories / Verifier</th><th>Service / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_local_seo_release_validation_table">
              <thead><tr><th>Route</th><th>SEO Validation</th><th>Status</th><th>Phrase / H1 / Schema</th><th>Links / Proof</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_runtime_fallback_message_table">
              <thead><tr><th>Surface</th><th>Fallback Message</th><th>Status</th><th>Trigger / User / Operator</th><th>Recovery / Telemetry</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_json_db_migration_execution_table">
              <thead><tr><th>Data Area</th><th>Migration Candidate</th><th>Status</th><th>Current / Target / Risk</th><th>Execution / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>

          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_release_cutover_checklist_table">
              <thead><tr><th>Area</th><th>Cutover Control</th><th>Status</th><th>Preflight / Deploy</th><th>Rollback / Owner</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_payment_exception_decision_table">
              <thead><tr><th>Area</th><th>Payment Exception</th><th>Status</th><th>Validation / Posting / Approval</th><th>Rollback / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_equipment_return_to_service_gate_table">
              <thead><tr><th>Area</th><th>Return-to-Service Gate</th><th>Status</th><th>Scan / Accessory / Verifier</th><th>Service / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_local_search_evidence_table">
              <thead><tr><th>Route</th><th>Local Search Evidence</th><th>Status</th><th>Phrase / Proof / Link</th><th>Publication / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_css_drift_watchlist_table">
              <thead><tr><th>Area</th><th>CSS Watch</th><th>Status</th><th>Token / Selector / Risk</th><th>Test / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_runtime_fallback_test_plan_table">
              <thead><tr><th>Surface</th><th>Fallback Test</th><th>Status</th><th>Failure / Copy / Telemetry</th><th>Retry / Owner</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_json_db_source_of_truth_table">
              <thead><tr><th>Data Area</th><th>Source-of-Truth Decision</th><th>Status</th><th>Current / Target / Rule</th><th>Validation / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>

          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_payment_reconciliation_cutover_drill_table">
              <thead><tr><th>Area</th><th>Cutover Drill</th><th>Status</th><th>Validate / Post / Signoff</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_equipment_service_cost_recovery_table">
              <thead><tr><th>Area</th><th>Cost Recovery</th><th>Status</th><th>Source Cost / Job Link</th><th>Approval / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_local_seo_prominence_action_table">
              <thead><tr><th>Route</th><th>SEO Prominence Action</th><th>Status</th><th>Wording / Proof / Links</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_css_accessibility_fallback_table">
              <thead><tr><th>Area</th><th>CSS / Accessibility Check</th><th>Status</th><th>Accessibility / Selector</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_data_migration_validation_table">
              <thead><tr><th>Data Area</th><th>Migration Validation</th><th>Status</th><th>Current / Target / Validation</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_runtime_release_message_table">
              <thead><tr><th>Surface</th><th>Release Message</th><th>Status</th><th>Failure / User / Operator</th><th>Retry / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_release_readiness_signoff_table">
              <thead><tr><th>Area</th><th>Release Signoff</th><th>Status</th><th>Evidence / Verifier</th><th>Block / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_accounting_exception_closure_table">
              <thead><tr><th>Area</th><th>Accounting Exception</th><th>Status</th><th>Source / Decision</th><th>Posting / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_equipment_service_verification_table">
              <thead><tr><th>Area</th><th>Equipment Verification</th><th>Status</th><th>Scan / Proof</th><th>Role / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_local_seo_refresh_table">
              <thead><tr><th>Route</th><th>SEO Refresh</th><th>Status</th><th>Keywords / Proof / Links</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_css_mobile_regression_table">
              <thead><tr><th>Area</th><th>CSS/Mobile Regression</th><th>Status</th><th>Breakpoint / Selector</th><th>Test / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_runtime_observability_release_table">
              <thead><tr><th>Surface</th><th>Observability</th><th>Status</th><th>Signal / Message</th><th>Operator / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_accounting_cutover_trial_balance_table">
              <thead><tr><th>Area</th><th>Cutover Trial Balance</th><th>Status</th><th>Source / Exception</th><th>Lock / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_equipment_scan_asset_rollout_table">
              <thead><tr><th>Area</th><th>Scan Asset Rollout</th><th>Status</th><th>Asset / Scan Test</th><th>Verifier / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_local_seo_prominence_publication_table">
              <thead><tr><th>Route</th><th>SEO Prominence Publication</th><th>Status</th><th>Prominence / Evidence / Links</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_css_mobile_release_guard_table">
              <thead><tr><th>Area</th><th>CSS/Mobile Release Guard</th><th>Status</th><th>Selector / Mobile / Accessibility</th><th>Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_runtime_support_playbook_table">
              <thead><tr><th>Surface</th><th>Support Playbook</th><th>Status</th><th>Detection / User Message</th><th>Support / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_data_source_migration_lock_table">
              <thead><tr><th>Data Area</th><th>Migration Lock</th><th>Status</th><th>Current / Target</th><th>Validation / Fallback</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_seo_smoke_table">
              <thead><tr><th>Page</th><th>Title</th><th>H1</th><th>Local Terms</th><th>Meta</th><th>Broken Assets</th><th>Status</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_bank_csv_import_table">
              <thead><tr><th>Status</th><th>File</th><th>Rows</th><th>Duplicates</th><th>Updated</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_backup_rehearsal_table">
              <thead><tr><th>Status</th><th>Rehearsal</th><th>Operator</th><th>Result</th><th>Next Action</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_mobile_action_card_table">
              <thead><tr><th>Role</th><th>Action</th><th>Priority</th><th>Status</th><th>Route</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="ad_audit_log_table">
              <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Summary</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Recent Site Activity</h3>
              <p class="section-subtitle">Track new jobs, staff additions, equipment changes, agreements, contracts, payroll exports, and other key admin-visible activity from one place.</p>
            </div>
          </div>
          <div id="ad_site_activity_summary" class="notice" style="display:block;margin-bottom:12px;">No recent site activity yet.</div>
          <div id="ad_ops_dashboard_cards" class="admin-stats-grid" style="margin-bottom:12px;"></div>
          <div id="ad_site_activity_rollups" class="admin-stats-grid" style="margin-bottom:12px;"></div>
          <div class="table-scroll">
            <table id="ad_site_activity_table">
              <thead><tr><th>When</th><th>Type</th><th>Title</th><th>Actor</th><th>Summary</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Attendance and HSE Evidence Review</h3>
              <p class="section-subtitle">Review attendance photos, geofence exceptions, and HSE packet proof links without opening each record one at a time.</p>
            </div>
          </div>
          <div id="ad_evidence_summary" class="notice" style="display:block;margin-bottom:12px;">No evidence review items loaded yet.</div>
          <div class="table-scroll" style="margin-bottom:12px;">
            <table id="ad_attendance_evidence_table">
              <thead><tr><th>Uploaded</th><th>Employee</th><th>Job</th><th>Stage</th><th>Geofence</th><th>Review</th><th>Evidence / Actions</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll">
            <table id="ad_hse_evidence_table">
              <thead><tr><th>Uploaded</th><th>Packet</th><th>Stage</th><th>Kind</th><th>Caption</th><th>Review</th><th>Evidence / Actions</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-section-nav" id="ad_section_nav" role="navigation" aria-label="Admin sections"></div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Staff Directory and Access</h3>
              <p class="section-subtitle">Create staff accounts, assign Admin/Supervisor/Employee tiers, block or delete users, manage verification flags, and prepare the personnel backend for work-order assignment.</p>
            </div>
            <div class="admin-heading-actions">
              <button id="ad_staff_refresh_panel" class="secondary" type="button">Refresh Staff Only</button>
              <span id="ad_staff_age_badge" class="admin-age-badge" data-status="warning">Not loaded</span>
            </div>
          </div>
          <div class="grid">
            <label>Selected User
              <select id="ad_staff_profile_id"></select>
            </label>
            <label>Full Name<input id="ad_staff_full_name" type="text" placeholder="Full name" /></label>
            <label>Email<input id="ad_staff_email" type="email" placeholder="user@example.com" /></label>
            <label>Phone<input id="ad_staff_phone" type="text" placeholder="Phone" /></label>
            <label>Role
              <select id="ad_staff_role">
                <option value="employee">Employee</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label>Staff Tier<select id="ad_staff_tier"></select></label>
            <label>Seniority Level<select id="ad_staff_seniority"></select></label>
            <label>Employment Status
              <select id="ad_staff_status"><option value="active">Active</option><option value="blocked">Blocked</option><option value="inactive">Inactive</option></select>
            </label>
            <label>Employee Number<input id="ad_staff_employee_number" type="text" /></label>
            <label>Position<select id="ad_staff_position"></select></label>
            <label>Trade<select id="ad_staff_trade"></select></label>
            <label>Start Date<input id="ad_staff_start_date" type="date" /></label>
            <label>Hourly Cost Rate<input id="ad_staff_hourly_cost_rate" type="number" min="0" step="0.01" placeholder="0.00" /></label>
            <label>Overtime Cost Rate<input id="ad_staff_overtime_cost_rate" type="number" min="0" step="0.01" placeholder="0.00" /></label>
            <label>Hourly Bill Rate<input id="ad_staff_hourly_bill_rate" type="number" min="0" step="0.01" placeholder="0.00" /></label>
            <label>Overtime Bill Rate<input id="ad_staff_overtime_bill_rate" type="number" min="0" step="0.01" placeholder="0.00" /></label>
            <label>Payroll Burden %<input id="ad_staff_payroll_burden_percent" type="number" min="0" step="0.01" placeholder="0.00" /></label>
            <label>Last Logged In<input id="ad_staff_last_login_at" type="text" readonly placeholder="No login recorded" /></label>
            <label>Login Events<input id="ad_staff_login_event_count" type="number" readonly placeholder="0" /></label>
            <form id="ad_staff_new_password_form" autocomplete="on"><input type="text" name="username" autocomplete="username" style="position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden;" tabindex="-1" aria-hidden="true"><label>New Password<input id="ad_staff_new_password" type="password" name="new-password" autocomplete="new-password" placeholder="Required for new user" /></label><div class="muted" style="margin-top:6px;font-size:.9rem;">For new staff users, use at least 10 characters with upper, lower, and a number.</div></form>
            <label style="display:flex;align-items:end;gap:8px;"><input id="ad_staff_phone_verified" type="checkbox" /><span>Phone verified</span></label>
            <label style="display:flex;align-items:end;gap:8px;"><input id="ad_staff_email_verified" type="checkbox" /><span>Email verified</span></label>
            <label style="display:flex;align-items:end;gap:8px;"><input id="ad_staff_active" type="checkbox" checked /><span>Active</span></label>
          </div>
          <label style="display:block;margin-top:12px;">Notes<textarea id="ad_staff_notes" rows="3" placeholder="Staff notes"></textarea></label>
          <div class="form-footer admin-backbone-footer" style="margin-top:12px;">
            <button id="ad_staff_create" class="secondary" type="button">Create Staff User</button>
            <button id="ad_staff_save" class="secondary" type="button">Save Staff Details</button>
            <button id="ad_staff_reset_email" class="secondary" type="button">Send Password Reset</button>
            <button id="ad_staff_block" class="secondary" type="button">Block / Unblock</button>
            <button id="ad_staff_delete" class="secondary" type="button">Delete User</button>
          </div>
          <div id="ad_staff_status_notice" class="notice" style="display:none;margin-top:10px;"></div>
          <div class="admin-list-toolbar" id="ad_staff_pager" style="margin-top:14px;">
            <label>Search staff<input id="ad_staff_search" type="search" placeholder="Name, email, phone, trade" /></label>
            <label>Role
              <select id="ad_staff_role_filter">
                <option value="">All roles</option>
                <option value="employee">Employee</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label>Sort
              <select id="ad_staff_sort">
                <option value="full_name">Name</option>
                <option value="email">Email</option>
                <option value="role">Role</option>
                <option value="employment_status">Status</option>
                <option value="last_login_at">Last Login</option>
                <option value="created_at">Created</option>
                <option value="updated_at">Updated</option>
              </select>
            </label>
            <label>Direction
              <select id="ad_staff_sort_dir">
                <option value="asc">A to Z</option>
                <option value="desc">Z to A</option>
              </select>
            </label>
            <label>Rows
              <select id="ad_staff_page_size">
                <option value="10">10</option>
                <option value="25" selected>25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </label>
            <div class="admin-pager-actions">
              <button id="ad_staff_prev_page" class="secondary" type="button">Previous</button>
              <span id="ad_staff_page_label" class="muted">Page 1 of 1</span>
              <button id="ad_staff_next_page" class="secondary" type="button">Next</button>
              <button id="ad_staff_apply_filter" class="secondary" type="button">Apply</button>
            </div>
          </div>
          <div class="table-scroll" style="margin-top:14px;">
            <table id="ad_staff_table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Tier</th><th>Seniority</th><th>Status</th><th>Phone</th><th>Cost/hr</th><th>Bill/hr</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Assignment Workbench</h3>
              <p class="section-subtitle">Assign staff to sites, set reporting lines, and manage the supervisor/admin structure used by jobs and approvals.</p>
            </div>
          </div>
          <div class="grid">
            <label>Assignment
              <select id="ad_assignment_id"></select>
            </label>
            <label>Site
              <select id="ad_assignment_site_id"></select>
            </label>
            <label>Profile
              <select id="ad_assignment_profile_id"></select>
            </label>
            <label>Assignment Role
              <select id="ad_assignment_role">
                <option value="worker">Worker</option>
                <option value="employee">Employee</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label>Reports to Supervisor
              <select id="ad_assignment_supervisor"></select>
            </label>
            <label>Reports to Admin
              <select id="ad_assignment_admin"></select>
            </label>
            <label style="display:flex;align-items:end;gap:8px;"><input id="ad_assignment_primary" type="checkbox" /><span>Primary assignment</span></label>
          </div>
          <div class="form-footer admin-backbone-footer" style="margin-top:12px;">
            <button id="ad_assignment_create" class="secondary" type="button">Create Assignment</button>
            <button id="ad_assignment_save" class="secondary" type="button">Save Assignment</button>
            <button id="ad_assignment_delete" class="secondary" type="button">Delete Assignment</button>
          </div>
          <div class="table-scroll" style="margin-top:14px;">
            <table id="ad_assignments_table">
              <thead><tr><th>Site</th><th>Staff</th><th>Role</th><th>Primary</th><th>Supervisor</th><th>Admin</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Dropdown and Catalog Manager</h3>
              <p class="section-subtitle">Populate the shared dropdown fields used by staff forms and future job/work-order flows.</p>
            </div>
          </div>
          <div class="grid">
            <label>Catalog
              <select id="ad_catalog_type">
                <option value="position">Positions</option>
                <option value="trade">Trades</option>
                <option value="staff_tier">Staff tiers</option>
                <option value="seniority">Seniority levels</option>
                <option value="employment_status">Employment statuses</option>
                <option value="job_type">Job types</option>
              </select>
            </label>
            <label>Selected Item
              <select id="ad_catalog_item_id"></select>
            </label>
            <label>Name<input id="ad_catalog_name" type="text" placeholder="Catalog value" /></label>
            <label>Sort Order<input id="ad_catalog_sort" type="number" min="0" step="1" value="100" /></label>
            <label style="display:flex;align-items:end;gap:8px;"><input id="ad_catalog_active" type="checkbox" checked /><span>Active</span></label>
          </div>
          <div class="form-footer admin-backbone-footer" style="margin-top:12px;">
            <button id="ad_catalog_create" class="secondary" type="button">Create Item</button>
            <button id="ad_catalog_save" class="secondary" type="button">Save Item</button>
            <button id="ad_catalog_delete" class="secondary" type="button">Delete Item</button>
          </div>
          <div class="table-scroll" style="margin-top:14px;">
            <table id="ad_catalog_table">
              <thead><tr><th>Name</th><th>Sort</th><th>Active</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Admin Password Control</h3>
              <p class="section-subtitle">Allow an Admin to set a new password for any profile, including another Admin, with audit logging.</p>
            </div>
          </div>
          <form id="ad_password_form" autocomplete="on">
            <input type="text" id="ad_password_username" autocomplete="username email" class="sr-only" tabindex="-1" aria-hidden="true" />
            <div class="grid">
              <label>Target Profile
                <select id="ad_password_profile_id"></select>
              </label>
              <label>New Password
                <input id="ad_password_new" type="password" autocomplete="new-password" placeholder="New password" />
              </label>
              <label>Confirm Password
                <input id="ad_password_confirm" type="password" autocomplete="new-password" placeholder="Confirm password" />
              </label>
            </div>
            <div class="grid" style="margin-top:12px;">
              <label>Reason
                <input id="ad_password_reason" type="text" placeholder="Reason for reset" />
              </label>
              <label style="display:flex;align-items:end;gap:8px;">
                <input id="ad_password_force_change" type="checkbox" />
                <span>Flag as temporary / force change at next sign-in</span>
              </label>
            </div>
            <div class="form-footer admin-backbone-footer" style="margin-top:12px;">
              <button id="ad_password_set" class="secondary" type="button">Set Password</button>
            </div>
          </form>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Orders and Accounting Stub</h3>
              <p class="section-subtitle">Create a basic order record and automatically create its first accounting row so later inventory, cost, revenue, and tax workflows have a clean starting point.</p>
            </div>
          </div>
          <div class="grid">
            <label>Customer Name
              <input id="ad_order_customer_name" type="text" placeholder="Customer name" />
            </label>
            <label>Customer Email
              <input id="ad_order_customer_email" type="email" placeholder="customer@example.com" />
            </label>
            <label>Order Status
              <select id="ad_order_status">
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
              </select>
            </label>
          </div>
          <div class="grid" style="margin-top:12px;">
            <label>Subtotal
              <input id="ad_order_subtotal" type="number" step="0.01" min="0" value="0" />
            </label>
            <label>Ontario HST / GST-HST
              <input id="ad_order_tax" type="number" step="0.01" min="0" value="0" />
            </label>
            <label>Total
              <input id="ad_order_total" type="number" step="0.01" min="0" value="0" />
            </label>
          </div>
          <div class="notice" style="margin-top:12px;">Ontario default helper: use 13% HST on taxable Ontario supplies, but review zero-rated, exempt, and place-of-supply exceptions before posting final invoices.</div>
          <label style="display:block;margin-top:12px;">Notes
            <textarea id="ad_order_notes" rows="3" placeholder="Basic accounting/order notes"></textarea>
          </label>
          <div class="form-footer admin-backbone-footer" style="margin-top:12px;">
            <button id="ad_order_create" class="secondary" type="button">Create Order + Accounting Record</button>
          </div>
          <div class="table-scroll" style="margin-top:14px;">
            <table id="ad_orders_table">
              <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th><th>Created</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:14px;">
            <table id="ad_accounting_table">
              <thead><tr><th>Entry</th><th>Source</th><th>Status</th><th>Total</th><th>Created</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Ontario OHSA / Workplace Safety Hub</h3>
              <p class="section-subtitle">Primary mobile safety interface for standalone jobs and linked operations work. Use these controls to move between Ontario OHSA-aware safety workflows while the operations backbone grows around them.</p>
            </div>
          </div>
          <div class="admin-hub-grid">
            <button class="admin-hub-card" type="button" data-admin-route="toolbox"><strong>Toolbox Talk</strong><span>Daily briefings, hazards, attendance, and work-start signoff.</span><em>Live</em></button>
            <button class="admin-hub-card" type="button" data-admin-route="ppe"><strong>PPE Check</strong><span>Verify required PPE before task start, dispatch, or visitor entry.</span><em>Live</em></button>
            <button class="admin-hub-card" type="button" data-admin-route="firstaid"><strong>First Aid Kit</strong><span>Track kit status and readiness for crews, parks, splash pads, and public works.</span><em>Live</em></button>
            <button class="admin-hub-card" type="button" data-admin-route="incident"><strong>Incident / Near Miss</strong><span>Capture injuries, close calls, equipment damage, vehicle events, and corrective-action ownership.</span><em>New</em></button>
            <button class="admin-hub-card" type="button" data-admin-route="inspection"><strong>Site Inspection</strong><span>Capture hazards for landscaping, construction, subcontract, and unscheduled work.</span><em>Live</em></button>
            <button class="admin-hub-card" type="button" data-admin-route="drill"><strong>Emergency Drill</strong><span>Document preparedness checks and emergency-response exercises.</span><em>Live</em></button>
            <button class="admin-hub-card" type="button" data-admin-route="log"><strong>Logbook / Review</strong><span>Review safety records, approvals, images, and linked field history.</span><em>Stabilized</em></button>
            <button class="admin-hub-card" type="button" data-admin-route="reports"><strong>Historical Reports</strong><span>Pull date-filtered HSE, corrective-action, training expiry, payroll, scheduler, and contract history with export-ready tables.</span><em>New</em></button>
            <button class="admin-hub-card" type="button" data-admin-focus-entity="linked_hse_packet"><strong>Linked HSE Packets</strong><span>Standalone-capable safety packets with direct linkage to jobs, work orders, routes, equipment, dispatches, sites, and subcontract work.</span><em>Live</em></button>
            <button class="admin-hub-card" type="button" data-admin-focus-entity="app_traffic_event" data-admin-focus-secondary="backend_monitor_event"><strong>Analytics / Traffic Monitor</strong><span>Review page traffic, API failures, upload issues, runtime incidents, and alert thresholds from the same Admin shell.</span><em>Live</em></button>
          </div>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Operations and Accounting Backbone Manager</h3>
              <p class="section-subtitle">Use the new operations/accounting tables end to end: lines, stops, AR/AP posting, material receiving, linked HSE packets, plus the existing estimates, work orders, materials, units, routes, service areas, dispatch, and chart of accounts.</p>
            </div>
            <div class="admin-heading-actions">
              <button id="ad_jobs_refresh_panel" class="secondary" type="button">Refresh Jobs Only</button>
              <span id="ad_jobs_age_badge" class="admin-age-badge" data-status="warning">Not loaded</span>
            </div>
          </div>
          <div class="grid">
            <label>Manager
              <select id="ad_backbone_entity">
                <optgroup label="Reference Data">
                  <option value="unit_of_measure">Units of Measure</option>
                  <option value="cost_code">Cost Codes</option>
                  <option value="tax_code">Tax Codes</option>
                  <option value="business_tax_setting">Business Tax Settings</option>
                  <option value="service_pricing_template">Service Pricing Templates</option>
                  <option value="recurring_service_agreement">Recurring Service Agreements</option>
                  <option value="snow_event_trigger">Snow Event Triggers</option>
                  <option value="service_area">Service Areas</option>
                  <option value="route">Routes</option>
                  <option value="route_stop">Route Stops</option>
                  <option value="route_stop_execution">Route Stop Executions</option>
                  <option value="route_stop_execution_attachment">Route Stop Execution Attachments</option>
                </optgroup>
                <optgroup label="Operations Master Data">
                  <option value="client">Clients</option>
                  <option value="client_site">Client Sites</option>
                  <option value="material">Materials Catalog</option>
                  <option value="equipment_master">Equipment Master</option>
                  <option value="customer_asset">Customer Assets</option>
                  <option value="customer_asset_job_link">Customer Asset Job Links</option>
                  <option value="warranty_callback_event">Warranty / Callback Events</option>
                </optgroup>
                <optgroup label="Estimates and Work Orders">
                  <option value="estimate">Estimates</option>
                  <option value="estimate_line">Estimate Lines</option>
                  <option value="work_order">Work Orders</option>
                  <option value="work_order_line">Work Order Lines</option>
                </optgroup>
                <optgroup label="Subcontract Dispatch">
                  <option value="subcontract_client">Subcontract Clients</option>
                  <option value="subcontract_dispatch">Subcontract Dispatches</option>
                  <option value="linked_hse_packet">Linked HSE Packets</option>
                  <option value="hse_packet_event">HSE Packet Events</option>
                  <option value="hse_packet_proof">HSE Packet Proofs</option>
                  <option value="field_upload_failure">Upload Failure Trail</option>
                </optgroup>
                <optgroup label="Accounting Backbone">
                  <option value="gl_account">Chart of Accounts</option>
                  <option value="gl_journal_batch">Journal Batches</option>
                  <option value="gl_journal_entry">Journal Entries</option>
                  <option value="gl_journal_sync_exception">Journal Sync Exceptions</option>
                  <option value="bank_account">Bank Accounts</option>
                  <option value="accounting_period_close">Period Close Control</option>
                  <option value="sales_tax_filing">Sales Tax Filings</option>
                  <option value="payroll_remittance_run">Payroll Remittance Runs</option>
                  <option value="bank_statement_import">Bank Statement Imports</option>
                  <option value="bank_reconciliation_session">Bank Reconciliation Sessions</option>
                  <option value="bank_reconciliation_item">Bank Reconciliation Items</option>
                  <option value="ar_payment_application">AR Payment Applications</option>
                  <option value="ap_payment_application">AP Payment Applications</option>
                  <option value="accountant_handoff_export">Accountant Handoff Packages</option>
                  <option value="ap_vendor">Vendors</option>
                  <option value="ar_invoice">AR Invoices</option>
                  <option value="ar_payment">AR Payments</option>
                  <option value="ap_bill">AP Bills</option>
                  <option value="ap_payment">AP Payments</option>
                  <option value="material_receipt">Material Receipts</option>
                  <option value="material_receipt_line">Material Receipt Lines</option>
                  <option value="material_issue">Material Issues</option>
                  <option value="material_issue_line">Material Issue Lines</option>
                  <option value="change_order">Change Orders</option>
                  <option value="service_contract_document">Service Contract Documents</option>
                  <option value="payroll_export_run">Payroll Export Runs</option>
                  <option value="service_execution_scheduler_setting">Scheduler Settings</option>
                  <option value="employee_time_entry">Employee Time Entries</option>
                  <option value="employee_time_entry_review">Employee Time Reviews</option>
                </optgroup>
                <optgroup label="Analytics and Monitoring">
                  <option value="app_traffic_event">Traffic Events</option>
                  <option value="backend_monitor_event">Backend Monitor Events</option>
                </optgroup>
              </select>
            </label>
            <label>Selected Record
              <select id="ad_backbone_item_id"></select>
            </label>
          </div>
          <div class="admin-list-toolbar admin-jobs-toolbar" id="ad_jobs_pager" style="margin-top:14px;">
            <label>Search jobs<input id="ad_jobs_search" type="search" placeholder="Job code, name, status" /></label>
            <label>Sort
              <select id="ad_jobs_sort">
                <option value="job_code">Job Code</option>
                <option value="job_name">Job Name</option>
                <option value="status">Status</option>
                <option value="priority">Priority</option>
                <option value="start_date">Start Date</option>
                <option value="updated_at">Updated</option>
              </select>
            </label>
            <label>Direction
              <select id="ad_jobs_sort_dir">
                <option value="asc">A to Z / oldest</option>
                <option value="desc">Z to A / newest</option>
              </select>
            </label>
            <label>Rows
              <select id="ad_jobs_page_size">
                <option value="10">10</option>
                <option value="25" selected>25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </label>
            <div class="admin-pager-actions">
              <button id="ad_jobs_prev_page" class="secondary" type="button">Previous</button>
              <span id="ad_jobs_page_label" class="muted">Page 1 of 1</span>
              <button id="ad_jobs_next_page" class="secondary" type="button">Next</button>
              <button id="ad_jobs_apply_filter" class="secondary" type="button">Refresh Jobs</button>
            </div>
          </div>
          <div class="table-scroll admin-jobs-review-wrap" style="margin-top:14px;">
            <table id="ad_jobs_review_table">
              <thead><tr><th>Job</th><th>Status</th><th>Priority</th><th>Start</th><th>Updated</th><th>Actions</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div id="ad_backbone_fields" class="grid" style="margin-top:12px;"></div>
          <div id="ad_backbone_insights" class="admin-insights-grid" style="margin-top:12px;"></div>
          <div class="form-footer admin-backbone-footer" style="margin-top:12px;">
            <button id="ad_backbone_create" class="secondary" type="button">Create Record</button>
            <button id="ad_backbone_save" class="secondary" type="button">Save Record</button>
            <button id="ad_backbone_delete" class="secondary" type="button">Delete Record</button>
            <button id="ad_backbone_post" class="secondary" type="button" style="display:none;">Post Journal Batch</button>
            <button id="ad_backbone_generate" class="secondary" type="button" style="display:none;">Generate Output</button>
            <button id="ad_backbone_download" class="secondary" type="button" style="display:none;">Download / Print</button>
          </div>
          <div class="table-scroll" style="margin-top:14px;">
            <table id="ad_backbone_table">
              <thead><tr id="ad_backbone_table_head"></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Deploy Smoke Check</h3>
              <p class="section-subtitle">Check shell files, runtime config reachability, diagnostics state, startup timing, and bootstrap endpoints.</p>
            </div>
            <div class="admin-heading-actions">
              <button id="ad_run_smoke" class="secondary" type="button">Run Smoke Check</button>
              <button id="ad_retry_sync" class="secondary" type="button">Retry Pending Admin Sync</button>
            </div>
          </div>
          <div id="ad_smoke_summary" class="notice" style="display:none;margin-bottom:12px;"></div>
          <div class="table-scroll">
            <table id="ad_smoke_table">
              <thead>
                <tr><th>Check</th><th>Status</th><th>Details</th></tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Conflict Review</h3>
              <p class="section-subtitle">Review queued admin sync conflicts, compare local payloads, and decide whether to retry, keep the local draft, or discard it.</p>
            </div>
            <div class="admin-heading-actions">
              <button id="ad_reload_conflicts" class="secondary" type="button">Refresh Conflicts</button>
            </div>
          </div>
          <div id="ad_conflict_summary" class="notice" style="display:none;margin-bottom:12px;"></div>
          <div class="table-scroll">
            <table id="ad_conflicts_table">
              <thead><tr><th>Queued</th><th>Action</th><th>Status</th><th>Local Payload</th><th>Conflict</th><th>Actions</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Approval Queue</h3>
              <p class="section-subtitle">Approve, reject, resolve, preview email, test send, or retry failed delivery.</p>
            </div>
          </div>
          <div class="grid" style="margin-bottom:12px;">
            <label>Search
              <input id="ad_notification_search" type="text" placeholder="Search title, type, status, creator" />
            </label>
            <label>Status
              <select id="ad_notification_filter_status">
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="resolved">Resolved</option>
                <option value="failed">Failed delivery</option>
                <option value="dead_letter">Dead letter</option>
              </select>
            </label>
          </div>
          <div class="table-scroll">
            <table id="ad_notifications_table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Decision</th>
                  <th>Delivery</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="admin-panel-block" style="margin-top:16px;">
          <div class="section-heading">
            <div>
              <h3 style="margin:0;">Email Preview / Test Send</h3>
              <p class="section-subtitle">Choose a notification from the queue, preview the message, then test-send or retry it.</p>
            </div>
          </div>
          <div class="grid">
            <label>Notification ID
              <input id="ad_email_notification_id" type="text" readonly />
            </label>
            <label>To
              <input id="ad_email_to" type="text" placeholder="admin@example.com" />
            </label>
            <label>Subject
              <input id="ad_email_subject" type="text" placeholder="Notification subject" />
            </label>
          </div>
          <label style="display:block;margin-top:12px;">Body
            <textarea id="ad_email_body" rows="8" placeholder="Preview body will load here."></textarea>
          </label>
          <div class="form-footer admin-backbone-footer" style="margin-top:12px;">
            <button id="ad_preview_email" class="secondary" type="button">Preview Email</button>
            <button id="ad_test_send_email" class="primary" type="button">Test Send</button>
            <button id="ad_retry_email" class="secondary" type="button">Retry Failed Send</button>
          </div>
        </div>
      `;
    }

    function els() {
      return {
        section: document.getElementById('admin'),
        summary: document.getElementById('ad_summary'),
        reloadBtn: document.getElementById('ad_reload'),
        usersCount: document.getElementById('ad_users_count'),
        staffProfileId: document.getElementById('ad_staff_profile_id'),
        staffFullName: document.getElementById('ad_staff_full_name'),
        staffEmail: document.getElementById('ad_staff_email'),
        staffPhone: document.getElementById('ad_staff_phone'),
        staffRole: document.getElementById('ad_staff_role'),
        staffTier: document.getElementById('ad_staff_tier'),
        staffSeniority: document.getElementById('ad_staff_seniority'),
        staffStatus: document.getElementById('ad_staff_status'),
        staffEmployeeNumber: document.getElementById('ad_staff_employee_number'),
        staffPosition: document.getElementById('ad_staff_position'),
        staffTrade: document.getElementById('ad_staff_trade'),
        staffStartDate: document.getElementById('ad_staff_start_date'),
        staffHourlyCostRate: document.getElementById('ad_staff_hourly_cost_rate'),
        staffOvertimeCostRate: document.getElementById('ad_staff_overtime_cost_rate'),
        staffHourlyBillRate: document.getElementById('ad_staff_hourly_bill_rate'),
        staffOvertimeBillRate: document.getElementById('ad_staff_overtime_bill_rate'),
        staffPayrollBurdenPercent: document.getElementById('ad_staff_payroll_burden_percent'),
        staffLastLoginAt: document.getElementById('ad_staff_last_login_at'),
        staffLoginEventCount: document.getElementById('ad_staff_login_event_count'),
        staffNewPassword: document.getElementById('ad_staff_new_password'),
        staffPhoneVerified: document.getElementById('ad_staff_phone_verified'),
        staffEmailVerified: document.getElementById('ad_staff_email_verified'),
        staffActive: document.getElementById('ad_staff_active'),
        staffNotes: document.getElementById('ad_staff_notes'),
        staffCreateBtn: document.getElementById('ad_staff_create'),
        staffSaveBtn: document.getElementById('ad_staff_save'),
        staffResetBtn: document.getElementById('ad_staff_reset_email'),
        staffBlockBtn: document.getElementById('ad_staff_block'),
        staffDeleteBtn: document.getElementById('ad_staff_delete'),
        staffStatusNotice: document.getElementById('ad_staff_status_notice'),
        staffSearch: document.getElementById('ad_staff_search'),
        staffRoleFilter: document.getElementById('ad_staff_role_filter'),
        staffSort: document.getElementById('ad_staff_sort'),
        staffSortDir: document.getElementById('ad_staff_sort_dir'),
        staffPageSize: document.getElementById('ad_staff_page_size'),
        staffPrevPage: document.getElementById('ad_staff_prev_page'),
        staffNextPage: document.getElementById('ad_staff_next_page'),
        staffPageLabel: document.getElementById('ad_staff_page_label'),
        staffApplyFilter: document.getElementById('ad_staff_apply_filter'),
        staffRefreshPanel: document.getElementById('ad_staff_refresh_panel'),
        staffBody: document.querySelector('#ad_staff_table tbody'),
        assignmentId: document.getElementById('ad_assignment_id'),
        assignmentSiteId: document.getElementById('ad_assignment_site_id'),
        assignmentProfileId: document.getElementById('ad_assignment_profile_id'),
        assignmentRole: document.getElementById('ad_assignment_role'),
        assignmentSupervisor: document.getElementById('ad_assignment_supervisor'),
        assignmentAdmin: document.getElementById('ad_assignment_admin'),
        assignmentPrimary: document.getElementById('ad_assignment_primary'),
        assignmentCreateBtn: document.getElementById('ad_assignment_create'),
        assignmentSaveBtn: document.getElementById('ad_assignment_save'),
        assignmentDeleteBtn: document.getElementById('ad_assignment_delete'),
        assignmentsBody: document.querySelector('#ad_assignments_table tbody'),
        catalogType: document.getElementById('ad_catalog_type'),
        catalogItemId: document.getElementById('ad_catalog_item_id'),
        catalogName: document.getElementById('ad_catalog_name'),
        catalogSort: document.getElementById('ad_catalog_sort'),
        catalogActive: document.getElementById('ad_catalog_active'),
        catalogCreateBtn: document.getElementById('ad_catalog_create'),
        catalogSaveBtn: document.getElementById('ad_catalog_save'),
        catalogDeleteBtn: document.getElementById('ad_catalog_delete'),
        catalogBody: document.querySelector('#ad_catalog_table tbody'),
        backboneEntity: document.getElementById('ad_backbone_entity'),
        backboneItemId: document.getElementById('ad_backbone_item_id'),
        backboneFields: document.getElementById('ad_backbone_fields'),
        backboneInsights: document.getElementById('ad_backbone_insights'),
        backboneCreateBtn: document.getElementById('ad_backbone_create'),
        backboneSaveBtn: document.getElementById('ad_backbone_save'),
        backboneDeleteBtn: document.getElementById('ad_backbone_delete'),
        backbonePostBtn: document.getElementById('ad_backbone_post'),
        backboneGenerateBtn: document.getElementById('ad_backbone_generate'),
        backboneDownloadBtn: document.getElementById('ad_backbone_download'),
        jobsSearch: document.getElementById('ad_jobs_search'),
        jobsSort: document.getElementById('ad_jobs_sort'),
        jobsSortDir: document.getElementById('ad_jobs_sort_dir'),
        jobsPageSize: document.getElementById('ad_jobs_page_size'),
        jobsPrevPage: document.getElementById('ad_jobs_prev_page'),
        jobsNextPage: document.getElementById('ad_jobs_next_page'),
        jobsPageLabel: document.getElementById('ad_jobs_page_label'),
        jobsApplyFilter: document.getElementById('ad_jobs_apply_filter'),
        jobsRefreshPanel: document.getElementById('ad_jobs_refresh_panel'),
        jobsReviewBody: document.querySelector('#ad_jobs_review_table tbody'),
        backboneHead: document.getElementById('ad_backbone_table_head'),
        backboneBody: document.querySelector('#ad_backbone_table tbody'),
        sitesCount: document.getElementById('ad_sites_count'),
        assignmentsCount: document.getElementById('ad_assignments_count'),
        notificationsCount: document.getElementById('ad_notifications_count'),
        ordersCount: document.getElementById('ad_orders_count'),
        commandCenter: document.getElementById('ad_command_center'),
        commandRefreshPanel: document.getElementById('ad_command_refresh_panel'),
        savedFilterName: document.getElementById('ad_saved_filter_name'),
        savedFilterScope: document.getElementById('ad_saved_filter_scope'),
        savedFilterShared: document.getElementById('ad_saved_filter_shared'),
        savedFilterSaveBtn: document.getElementById('ad_saved_filter_save'),
        savedFilterCards: document.getElementById('ad_saved_filter_cards'),
        savedFilterBody: document.querySelector('#ad_saved_filter_table tbody'),
        healthSummary: document.getElementById('ad_health_summary'),
        scopeStatus: document.getElementById('ad_scope_status'),
        scopeDiagnosticsDetails: document.getElementById('ad_scope_diagnostics_details'),
        scopeDiagnosticsBody: document.getElementById('ad_scope_diagnostics_body'),
        panelAgeBadges: document.getElementById('ad_panel_age_badges'),
        commandAgeBadge: document.getElementById('ad_command_age_badge'),
        healthAgeBadge: document.getElementById('ad_health_age_badge'),
        staffAgeBadge: document.getElementById('ad_staff_age_badge'),
        jobsAgeBadge: document.getElementById('ad_jobs_age_badge'),
        accountingAgeBadge: document.getElementById('ad_accounting_age_badge'),
        evidenceAgeBadge: document.getElementById('ad_evidence_age_badge'),
        healthRefreshPanel: document.getElementById('ad_health_refresh_panel'),
        healthCards: document.getElementById('ad_health_cards'),
        healthBody: document.querySelector('#ad_health_table tbody'),
        schemaBody: document.querySelector('#ad_schema_table tbody'),
        taskCards: document.getElementById('ad_task_cards'),
        taskBody: document.querySelector('#ad_task_table tbody'),
        clearDiagnosticsBtn: document.getElementById('ad_clear_diagnostics'),
        closeCenterCards: document.getElementById('ad_close_center_cards'),
        closeCenterSummary: document.getElementById('ad_close_center_summary'),
        accountingRefreshPanel: document.getElementById('ad_accounting_refresh_panel'),
        evidenceRefreshPanel: document.getElementById('ad_evidence_refresh_panel'),
        closeWizardDetailBody: document.querySelector('#ad_close_wizard_detail_table tbody'),
        evidenceManagerCards: document.getElementById('ad_evidence_manager_cards'),
        evidenceManagerBody: document.querySelector('#ad_evidence_manager_table tbody'),
        evidenceActionQueueBody: document.querySelector('#ad_evidence_action_queue_table tbody'),
        readinessCards: document.getElementById('ad_readiness_cards'),
        schemaPreflightBody: document.querySelector('#ad_schema_preflight_table tbody'),
        readinessBody: document.querySelector('#ad_readiness_table tbody'),
        permissionsBody: document.querySelector('#ad_permissions_table tbody'),
        actionPermissionBody: document.querySelector('#ad_action_permission_table tbody'),
        deploymentGateBody: document.querySelector('#ad_deployment_gate_table tbody'),
        deploymentChecklistBody: document.querySelector('#ad_deployment_checklist_table tbody'),
        panelRetryPolicyBody: document.querySelector('#ad_panel_retry_policy_table tbody'),
        functionReadinessBody: document.querySelector('#ad_function_readiness_table tbody'),
        buildGuardrailBody: document.querySelector('#ad_build_guardrail_table tbody'),
        publicSeoGuardrailBody: document.querySelector('#ad_public_seo_guardrail_table tbody'),
        runtimeFallbackBody: document.querySelector('#ad_runtime_fallback_table tbody'),
        roadmapActionBody: document.querySelector('#ad_roadmap_action_table tbody'),
        depthReviewBody: document.querySelector('#ad_depth_review_table tbody'),
        dataMigrationBody: document.querySelector('#ad_data_migration_table tbody'),
        schemaDocSyncBody: document.querySelector('#ad_schema_doc_sync_table tbody'),
        routeSeoRegistryBody: document.querySelector('#ad_route_seo_registry_table tbody'),
        internalLinkQueueBody: document.querySelector('#ad_internal_link_queue_table tbody'),
        cssTokenInventoryBody: document.querySelector('#ad_css_token_inventory_table tbody'),
        mobileFieldActionBody: document.querySelector('#ad_mobile_field_action_table tbody'),
        releaseManifestBody: document.querySelector('#ad_release_manifest_table tbody'),
        paymentActionRegistryBody: document.querySelector('#ad_payment_action_registry_table tbody'),
        accountingCloseControlBody: document.querySelector('#ad_accounting_close_control_table tbody'),
        equipmentAccountabilityActionBody: document.querySelector('#ad_equipment_accountability_action_table tbody'),
        publicSeoPublicationBody: document.querySelector('#ad_public_seo_publication_table tbody'),
        fallbackObservabilityBody: document.querySelector('#ad_fallback_observability_table tbody'),
        schemaCompatibilityBody: document.querySelector('#ad_schema_compatibility_table tbody'),
        accountingEvidencePackageBody: document.querySelector('#ad_accounting_evidence_package_table tbody'),
        equipmentReturnRulesBody: document.querySelector('#ad_equipment_return_rules_table tbody'),
        publicAssetSmokeBody: document.querySelector('#ad_public_asset_smoke_table tbody'),
        errorRecoveryPlaybookBody: document.querySelector('#ad_error_recovery_playbook_table tbody'),
        paymentExecutionQueueBody: document.querySelector('#ad_payment_execution_queue_table tbody'),
        bankReconciliationExecutionBody: document.querySelector('#ad_bank_reconciliation_execution_table tbody'),
        equipmentScanTemplateBody: document.querySelector('#ad_equipment_scan_template_table tbody'),
        localSeoExecutionBody: document.querySelector('#ad_local_seo_execution_table tbody'),
        fallbackDrillBody: document.querySelector('#ad_fallback_drill_table tbody'),
        paymentApplicationUiQueueBody: document.querySelector('#ad_payment_application_ui_queue_table tbody'),
        reconciliationImportValidationBody: document.querySelector('#ad_reconciliation_import_validation_table tbody'),
        equipmentServiceCloseoutBody: document.querySelector('#ad_equipment_service_closeout_table tbody'),
        seoAssetPublicationBody: document.querySelector('#ad_seo_asset_publication_table tbody'),
        runtimeRecoveryTelemetryBody: document.querySelector('#ad_runtime_recovery_telemetry_table tbody'),
        paymentPostingProofBody: document.querySelector('#ad_payment_posting_proof_table tbody'),
        reconciliationMatchWorkbenchBody: document.querySelector('#ad_reconciliation_match_workbench_table tbody'),
        equipmentScanVerificationBody: document.querySelector('#ad_equipment_scan_verification_table tbody'),
        localSeoAssetSmokeBody: document.querySelector('#ad_local_seo_asset_smoke_table tbody'),
        runtimeFallbackDrillHistoryBody: document.querySelector('#ad_runtime_fallback_drill_history_table tbody'),
        paymentWritePathBody: document.querySelector('#ad_payment_write_path_table tbody'),
        reconciliationScoringRuleBody: document.querySelector('#ad_reconciliation_scoring_rule_table tbody'),
        equipmentAccessoryTemplateBody: document.querySelector('#ad_equipment_accessory_template_table tbody'),
        localSeoGenerationBody: document.querySelector('#ad_local_seo_generation_table tbody'),
        mobileOfflineConflictResolutionBody: document.querySelector('#ad_mobile_offline_conflict_resolution_table tbody'),
        paymentAdjustmentWorkflowBody: document.querySelector('#ad_payment_adjustment_workflow_table tbody'),
        reconciliationExceptionResolutionBody: document.querySelector('#ad_reconciliation_exception_resolution_table tbody'),
        equipmentScanRolloutBody: document.querySelector('#ad_equipment_scan_rollout_table tbody'),
        localSeoContentDepthBody: document.querySelector('#ad_local_seo_content_depth_table tbody'),
        runtimeErrorMessageCatalogBody: document.querySelector('#ad_runtime_error_message_catalog_table tbody'),
        releaseValidationBody: document.querySelector('#ad_release_validation_table tbody'),
        paymentReconciliationExecutionBody: document.querySelector('#ad_payment_reconciliation_execution_table tbody'),
        equipmentMobileScanValidationBody: document.querySelector('#ad_equipment_mobile_scan_validation_table tbody'),
        localSeoReleaseValidationBody: document.querySelector('#ad_local_seo_release_validation_table tbody'),
        runtimeFallbackMessageBody: document.querySelector('#ad_runtime_fallback_message_table tbody'),
        jsonDbMigrationExecutionBody: document.querySelector('#ad_json_db_migration_execution_table tbody'),
        releaseCutoverChecklistBody: document.querySelector('#ad_release_cutover_checklist_table tbody'),
        paymentExceptionDecisionBody: document.querySelector('#ad_payment_exception_decision_table tbody'),
        equipmentReturnToServiceGateBody: document.querySelector('#ad_equipment_return_to_service_gate_table tbody'),
        localSearchEvidenceBody: document.querySelector('#ad_local_search_evidence_table tbody'),
        cssDriftWatchlistBody: document.querySelector('#ad_css_drift_watchlist_table tbody'),
        runtimeFallbackTestPlanBody: document.querySelector('#ad_runtime_fallback_test_plan_table tbody'),
        jsonDbSourceOfTruthBody: document.querySelector('#ad_json_db_source_of_truth_table tbody'),
        paymentReconciliationCutoverDrillBody: document.querySelector('#ad_payment_reconciliation_cutover_drill_table tbody'),
        equipmentServiceCostRecoveryBody: document.querySelector('#ad_equipment_service_cost_recovery_table tbody'),
        localSeoProminenceActionBody: document.querySelector('#ad_local_seo_prominence_action_table tbody'),
        cssAccessibilityFallbackBody: document.querySelector('#ad_css_accessibility_fallback_table tbody'),
        dataMigrationValidationBody: document.querySelector('#ad_data_migration_validation_table tbody'),
        runtimeReleaseMessageBody: document.querySelector('#ad_runtime_release_message_table tbody'),
        releaseReadinessSignoffBody: document.querySelector('#ad_release_readiness_signoff_table tbody'),
        accountingExceptionClosureBody: document.querySelector('#ad_accounting_exception_closure_table tbody'),
        equipmentServiceVerificationBody: document.querySelector('#ad_equipment_service_verification_table tbody'),
        localSeoRefreshBody: document.querySelector('#ad_local_seo_refresh_table tbody'),
        cssMobileRegressionBody: document.querySelector('#ad_css_mobile_regression_table tbody'),
        runtimeObservabilityReleaseBody: document.querySelector('#ad_runtime_observability_release_table tbody'),
        accountingCutoverTrialBalanceBody: document.querySelector('#ad_accounting_cutover_trial_balance_table tbody'),
        equipmentScanAssetRolloutBody: document.querySelector('#ad_equipment_scan_asset_rollout_table tbody'),
        localSeoProminencePublicationBody: document.querySelector('#ad_local_seo_prominence_publication_table tbody'),
        cssMobileReleaseGuardBody: document.querySelector('#ad_css_mobile_release_guard_table tbody'),
        runtimeSupportPlaybookBody: document.querySelector('#ad_runtime_support_playbook_table tbody'),
        dataSourceMigrationLockBody: document.querySelector('#ad_data_source_migration_lock_table tbody'),
        releaseExitCriteriaBody: document.querySelector('#ad_release_exit_criteria_table tbody'),
        paymentCloseoutActionBody: document.querySelector('#ad_payment_closeout_action_table tbody'),
        reconciliationExceptionWorkflowBody: document.querySelector('#ad_reconciliation_exception_workflow_table tbody'),
        equipmentChainOfCustodyBody: document.querySelector('#ad_equipment_chain_of_custody_table tbody'),
        localSeoConversionBody: document.querySelector('#ad_local_seo_conversion_table tbody'),
        runtimeFallbackEscalationBody: document.querySelector('#ad_runtime_fallback_escalation_table tbody'),
        releaseHandoffBody: document.querySelector('#ad_release_handoff_table tbody'),
        paymentPostingProof2Body: document.querySelector('#ad_payment_posting_proof_schema141_table tbody'),
        equipmentCustodyEvidenceBody: document.querySelector('#ad_equipment_custody_evidence_table tbody'),
        seoConversionEvidenceBody: document.querySelector('#ad_seo_conversion_evidence_table tbody'),
        runtimeFallbackEventLogBody: document.querySelector('#ad_runtime_fallback_event_log_table tbody'),
        schemaDeployRepairBody: document.querySelector('#ad_schema_deploy_repair_table tbody'),
        paymentReconciliationProofCloseoutBody: document.querySelector('#ad_payment_reconciliation_proof_closeout_table tbody'),
        equipmentReturnExceptionActionBody: document.querySelector('#ad_equipment_return_exception_action_table tbody'),
        localSearchProminenceEvidenceBody: document.querySelector('#ad_local_search_prominence_evidence_table tbody'),
        runtimeFallbackObservabilityBody: document.querySelector('#ad_runtime_fallback_observability_table tbody'),
        jsonDbSourceMigrationBody: document.querySelector('#ad_json_db_source_migration_table tbody'),
        seoSmokeBody: document.querySelector('#ad_seo_smoke_table tbody'),
        bankCsvImportBody: document.querySelector('#ad_bank_csv_import_table tbody'),
        backupRehearsalBody: document.querySelector('#ad_backup_rehearsal_table tbody'),
        mobileActionCardBody: document.querySelector('#ad_mobile_action_card_table tbody'),
        auditLogBody: document.querySelector('#ad_audit_log_table tbody'),
        siteActivitySummary: document.getElementById('ad_site_activity_summary'),
        opsDashboardCards: document.getElementById('ad_ops_dashboard_cards'),
        siteActivityRollups: document.getElementById('ad_site_activity_rollups'),
        siteActivityBody: document.querySelector('#ad_site_activity_table tbody'),
        evidenceSummary: document.getElementById('ad_evidence_summary'),
        attendanceEvidenceBody: document.querySelector('#ad_attendance_evidence_table tbody'),
        hseEvidenceBody: document.querySelector('#ad_hse_evidence_table tbody'),
        passwordForm: document.getElementById('ad_password_form'),
        passwordProfileId: document.getElementById('ad_password_profile_id'),
        passwordNew: document.getElementById('ad_password_new'),
        passwordConfirm: document.getElementById('ad_password_confirm'),
        passwordReason: document.getElementById('ad_password_reason'),
        passwordForceChange: document.getElementById('ad_password_force_change'),
        passwordSetBtn: document.getElementById('ad_password_set'),
        orderCustomerName: document.getElementById('ad_order_customer_name'),
        orderCustomerEmail: document.getElementById('ad_order_customer_email'),
        orderStatus: document.getElementById('ad_order_status'),
        orderSubtotal: document.getElementById('ad_order_subtotal'),
        orderTax: document.getElementById('ad_order_tax'),
        orderTotal: document.getElementById('ad_order_total'),
        orderNotes: document.getElementById('ad_order_notes'),
        orderCreateBtn: document.getElementById('ad_order_create'),
        ordersBody: document.querySelector('#ad_orders_table tbody'),
        accountingBody: document.querySelector('#ad_accounting_table tbody'),
        search: document.getElementById('ad_notification_search'),
        filterStatus: document.getElementById('ad_notification_filter_status'),
        notificationsBody: document.querySelector('#ad_notifications_table tbody'),
        smokeBtn: document.getElementById('ad_run_smoke'),
        retrySyncBtn: document.getElementById('ad_retry_sync'),
        smokeSummary: document.getElementById('ad_smoke_summary'),
        smokeBody: document.querySelector('#ad_smoke_table tbody'),
        conflictSummary: document.getElementById('ad_conflict_summary'),
        conflictBody: document.querySelector('#ad_conflicts_table tbody'),
        reloadConflictsBtn: document.getElementById('ad_reload_conflicts'),
        emailNotificationId: document.getElementById('ad_email_notification_id'),
        emailTo: document.getElementById('ad_email_to'),
        emailSubject: document.getElementById('ad_email_subject'),
        emailBody: document.getElementById('ad_email_body'),
        previewBtn: document.getElementById('ad_preview_email'),
        testSendBtn: document.getElementById('ad_test_send_email'),
        retryBtn: document.getElementById('ad_retry_email')
      };
    }

    function setSummary(text = '', isError = false) {
      const e = els();
      if (!e.summary) return;
      if (!text) {
        e.summary.style.display = 'none';
        e.summary.textContent = '';
        e.summary.dataset.kind = '';
      } else {
        e.summary.style.display = 'block';
        e.summary.textContent = text;
        e.summary.dataset.kind = isError ? 'error' : 'info';
      }
      manageSummary(text);
    }

    function setStaffNotice(text = '', isError = false) {
      const e = els();
      if (!e.staffStatusNotice) return;
      if (!text) {
        e.staffStatusNotice.style.display = 'none';
        e.staffStatusNotice.textContent = '';
        e.staffStatusNotice.dataset.kind = '';
        return;
      }
      e.staffStatusNotice.style.display = 'block';
      e.staffStatusNotice.textContent = text;
      e.staffStatusNotice.dataset.kind = isError ? 'error' : 'info';
    }

    function setStaffBusy(isBusy, label = 'Saving staff details…') {
      const e = els();
      [e.staffCreateBtn, e.staffSaveBtn, e.staffResetBtn, e.staffBlockBtn, e.staffDeleteBtn].forEach((btn) => {
        if (!btn) return;
        btn.disabled = !!isBusy;
        btn.dataset.busy = isBusy ? 'true' : 'false';
      });
      if (isBusy) setStaffNotice(label, false);
    }

    function isValidEmailAddress(value = '') {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
    }

    function validateStaffPassword(value = '') {
      const clean = String(value || '');
      if (!clean.trim()) return 'New staff user requires an initial password.';
      if (clean.length < 10) return 'Password must be at least 10 characters long.';
      if (!/[A-Z]/.test(clean) || !/[a-z]/.test(clean) || !/[0-9]/.test(clean)) {
        return 'Password must include upper, lower, and number characters.';
      }
      return '';
    }

    function applyRoleAccess() {
      const access = getAccessProfile(getCurrentRole());
      state.locked = !access.canViewAdminDirectory;
      state.manageLocked = !access.canManageAdminDirectory;
      const e = els();
      if (e.section) e.section.dataset.adminLocked = state.locked ? 'true' : 'false';
      if (state.locked) {
        setSummary('Supervisor, HSE, Job Admin, or Admin access is required to use this section.', true);
      }
    }

    function filteredNotifications() {
      const e = els();
      const search = String(e.search?.value || '').trim().toLowerCase();
      const status = String(e.filterStatus?.value || '').trim().toLowerCase();
      return state.notifications.filter((row) => {
        const hay = [
          row.id,
          row.notification_type,
          row.title,
          row.message,
          row.status,
          row.decision_status,
          row.created_by_name
        ].join(' ').toLowerCase();
        const statusValue = String(row.decision_status || row.status || row.email_status || '').toLowerCase();
        const statusMatch = !status || statusValue === status;
        return (!search || hay.includes(search)) && statusMatch;
      });
    }

    function renderNotifications() {
      const e = els();
      if (!e.notificationsBody) return;
      const rows = filteredNotifications();
      if (e.notificationsCount) e.notificationsCount.textContent = String(rows.length);
      e.notificationsBody.innerHTML = '';
      rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escHtml(row.id)}</td>
          <td>${escHtml(row.notification_type)}</td>
          <td><strong>${escHtml(row.title || '')}</strong><div class="muted">${escHtml((row.message || '').slice(0, 120))}</div></td>
          <td>${escHtml(row.decision_status || row.status || '')}</td>
          <td>${escHtml(row.email_status || 'pending')}</td>
          <td>${escHtml(row.created_at || '')}</td>
          <td>
            <div class="table-actions" style="display:flex;flex-wrap:wrap;gap:6px;">
              ${state.manageLocked ? `<span class="muted">View only</span>` : `
                <button class="secondary" data-notification-action="approve" data-id="${escHtml(row.id)}">Approve</button>
                <button class="secondary" data-notification-action="reject" data-id="${escHtml(row.id)}">Reject</button>
                <button class="secondary" data-notification-action="resolve" data-id="${escHtml(row.id)}">Resolve</button>
                <button class="secondary" data-notification-action="preview_email" data-id="${escHtml(row.id)}">Preview</button>
                <button class="secondary" data-notification-action="test_send" data-id="${escHtml(row.id)}">Test Send</button>
                <button class="secondary" data-notification-action="retry_send" data-id="${escHtml(row.id)}">Retry</button>
              `}
            </div>
          </td>
        `;
        e.notificationsBody.appendChild(tr);
      });
    }


    function fillStaffForm(row) {
      const e = els();
      const item = row || {};
      if (!row) setStaffNotice('', false);
      if (e.staffProfileId) e.staffProfileId.value = item.id || '';
      if (e.staffFullName) e.staffFullName.value = item.full_name || '';
      if (e.staffEmail) e.staffEmail.value = item.email || '';
      if (e.staffPhone) e.staffPhone.value = item.phone || '';
      if (e.staffRole) e.staffRole.value = item.role || 'employee';
      if (e.staffTier) e.staffTier.value = item.staff_tier || item.role || '';
      if (e.staffSeniority) e.staffSeniority.value = item.seniority_level || '';
      if (e.staffStatus) e.staffStatus.value = item.employment_status || (item.is_active === false ? 'blocked' : 'active');
      if (e.staffEmployeeNumber) e.staffEmployeeNumber.value = item.employee_number || '';
      if (e.staffPosition) e.staffPosition.value = item.current_position || '';
      if (e.staffTrade) e.staffTrade.value = item.trade_specialty || '';
      if (e.staffStartDate) e.staffStartDate.value = item.start_date || '';
      if (e.staffHourlyCostRate) e.staffHourlyCostRate.value = item.hourly_cost_rate ?? '';
      if (e.staffOvertimeCostRate) e.staffOvertimeCostRate.value = item.overtime_cost_rate ?? '';
      if (e.staffHourlyBillRate) e.staffHourlyBillRate.value = item.hourly_bill_rate ?? '';
      if (e.staffOvertimeBillRate) e.staffOvertimeBillRate.value = item.overtime_bill_rate ?? '';
      if (e.staffPayrollBurdenPercent) e.staffPayrollBurdenPercent.value = item.payroll_burden_percent ?? '';
      if (e.staffLastLoginAt) e.staffLastLoginAt.value = item.last_login_at ? new Date(item.last_login_at).toLocaleString() : '';
      if (e.staffLoginEventCount) e.staffLoginEventCount.value = item.login_event_count ?? 0;
      if (e.staffPhoneVerified) e.staffPhoneVerified.checked = !!item.phone_verified;
      if (e.staffEmailVerified) e.staffEmailVerified.checked = !!item.email_verified;
      if (e.staffActive) e.staffActive.checked = item.is_active !== false;
      if (e.staffNotes) e.staffNotes.value = item.notes || '';
    }

    function applyDirectoryPaginationMeta(meta = {}) {
      const people = meta?.people || {};
      const jobs = meta?.jobs || {};
      if (people && typeof people === 'object') {
        state.directoryPagination.people = {
          ...state.directoryPagination.people,
          page: Number(people.page || state.directoryPagination.people.page || 1),
          pageSize: Number(people.page_size || state.directoryPagination.people.pageSize || 25),
          total: Number(people.total || 0),
          totalPages: Number(people.total_pages || 1),
          loaded: Number(people.loaded || 0),
          search: String(people.search ?? state.directoryPagination.people.search ?? ''),
          roleFilter: String(people.role_filter ?? state.directoryPagination.people.roleFilter ?? ''),
          sort: String(people.sort ?? state.directoryPagination.people.sort ?? 'full_name'),
          direction: String(people.direction ?? state.directoryPagination.people.direction ?? 'asc')
        };
      }
      if (jobs && typeof jobs === 'object') {
        state.directoryPagination.jobs = {
          ...state.directoryPagination.jobs,
          page: Number(jobs.page || state.directoryPagination.jobs.page || 1),
          pageSize: Number(jobs.page_size || state.directoryPagination.jobs.pageSize || 25),
          total: Number(jobs.total || 0),
          totalPages: Number(jobs.total_pages || 1),
          loaded: Number(jobs.loaded || 0),
          search: String(jobs.search ?? state.directoryPagination.jobs.search ?? ''),
          sort: String(jobs.order_column ?? jobs.sort ?? state.directoryPagination.jobs.sort ?? 'job_code'),
          direction: jobs.ascending === false ? 'desc' : String(jobs.direction ?? state.directoryPagination.jobs.direction ?? 'asc')
        };
      }
    }


    function mergeAdminDirectoryScopeResponse(resp = {}) {
      if (!resp || typeof resp !== 'object') return;
      if (resp.pagination_meta && typeof resp.pagination_meta === 'object') {
        state.adminDirectoryMeta = { ...(state.adminDirectoryMeta || {}), ...(resp.pagination_meta || {}) };
        applyDirectoryPaginationMeta(state.adminDirectoryMeta);
      }
      if (resp.actor_role) state.actorRole = resp.actor_role;
      if (resp.actor_profile_id) state.actorProfileId = resp.actor_profile_id;
      if (Array.isArray(resp.users) || Array.isArray(resp.profiles)) state.users = Array.isArray(resp.users) ? resp.users : resp.profiles;
      if (Array.isArray(resp.sites)) state.sites = resp.sites;
      if (Array.isArray(resp.assignments)) state.assignments = resp.assignments;
      if (Array.isArray(resp.jobs)) state.jobs = resp.jobs;
      if (Array.isArray(resp.service_areas)) state.serviceAreas = resp.service_areas;
      if (Array.isArray(resp.routes)) state.routes = resp.routes;
      if (Array.isArray(resp.clients)) state.clients = resp.clients;
      if (Array.isArray(resp.client_sites)) state.clientSites = resp.client_sites;
      if (Array.isArray(resp.operations_dashboard_summary)) state.operationsDashboardSummary = resp.operations_dashboard_summary;
      if (Array.isArray(resp.admin_home_command_center)) state.adminHomeCommandCenter = resp.admin_home_command_center;
      if (Array.isArray(resp.admin_error_health_center)) state.adminErrorHealthCenter = resp.admin_error_health_center;
      if (Array.isArray(resp.admin_task_inbox)) state.adminTaskInbox = resp.admin_task_inbox;
      if (Array.isArray(resp.app_schema_version_status)) state.appSchemaVersionStatus = resp.app_schema_version_status;
      if (Array.isArray(resp.schema_drift_status)) state.schemaDriftStatus = resp.schema_drift_status;
      if (Array.isArray(resp.production_readiness_checklist)) state.productionReadinessChecklist = resp.production_readiness_checklist;
      if (Array.isArray(resp.role_permission_matrix)) state.rolePermissionMatrix = resp.role_permission_matrix;
      if (Array.isArray(resp.admin_close_center_overview)) state.adminCloseCenterOverview = resp.admin_close_center_overview;
      if (Array.isArray(resp.admin_saved_filter_directory)) state.adminSavedFilterDirectory = resp.admin_saved_filter_directory;
      if (Array.isArray(resp.admin_saved_filter_scope_summary)) state.adminSavedFilterScopeSummary = resp.admin_saved_filter_scope_summary;
      if (Array.isArray(resp.admin_close_center_overview)) state.adminCloseCenterOverview = resp.admin_close_center_overview;
      if (Array.isArray(resp.admin_close_wizard_steps)) state.adminCloseWizardSteps = resp.admin_close_wizard_steps;
      if (Array.isArray(resp.admin_health_resolution_queue)) state.adminHealthResolutionQueue = resp.admin_health_resolution_queue;
      if (Array.isArray(resp.admin_deployment_gate_status)) state.adminDeploymentGateStatus = resp.admin_deployment_gate_status;
      if (Array.isArray(resp.public_seo_smoke_check)) state.publicSeoSmokeCheck = resp.public_seo_smoke_check;
      if (Array.isArray(resp.admin_audit_event_directory)) state.adminAuditEventDirectory = resp.admin_audit_event_directory;
      if (Array.isArray(resp.admin_backup_restore_rehearsal_directory)) state.adminBackupRestoreRehearsals = resp.admin_backup_restore_rehearsal_directory;
      if (Array.isArray(resp.bank_csv_import_session_directory)) state.bankCsvImportSessions = resp.bank_csv_import_session_directory;
      if (Array.isArray(resp.evidence_manager_directory)) state.evidenceManagerDirectory = resp.evidence_manager_directory;
      if (Array.isArray(resp.admin_evidence_action_queue)) state.adminEvidenceActionQueue = resp.admin_evidence_action_queue;
      if (Array.isArray(resp.mobile_navigation_quality_gates)) state.mobileNavigationQualityGates = resp.mobile_navigation_quality_gates;
      if (Array.isArray(resp.mobile_first_quality_gates)) state.mobileFirstQualityGates = resp.mobile_first_quality_gates;
      if (Array.isArray(resp.jurisdiction_wording_gates)) state.jurisdictionWordingGates = resp.jurisdiction_wording_gates;
      if (Array.isArray(resp.mobile_today_action_registry)) state.mobileTodayActionRegistry = resp.mobile_today_action_registry;
      if (Array.isArray(resp.mobile_pwa_install_quality_gates)) state.mobilePwaInstallQualityGates = resp.mobile_pwa_install_quality_gates;
      if (Array.isArray(resp.mobile_form_stepper_registry)) state.mobileFormStepperRegistry = resp.mobile_form_stepper_registry;
      if (Array.isArray(resp.mobile_form_quality_gates)) state.mobileFormQualityGates = resp.mobile_form_quality_gates;
      if (Array.isArray(resp.admin_mobile_action_card_directory)) state.adminMobileActionCards = resp.admin_mobile_action_card_directory;
      if (Array.isArray(resp.admin_list_pagination_settings)) state.adminListPaginationSettings = resp.admin_list_pagination_settings;
      if (Array.isArray(resp.admin_panel_load_diagnostics)) state.adminPanelLoadDiagnostics = resp.admin_panel_load_diagnostics;
      if (Array.isArray(resp.admin_fast_path_scope_registry)) state.adminFastPathScopeRegistry = resp.admin_fast_path_scope_registry;
      if (Array.isArray(resp.admin_action_confirmation_rules)) state.adminActionConfirmationRules = resp.admin_action_confirmation_rules;
      if (Array.isArray(resp.admin_action_permission_registry)) state.adminActionPermissionRegistry = resp.admin_action_permission_registry;
      if (Array.isArray(resp.admin_panel_retry_policy)) state.adminPanelRetryPolicy = resp.admin_panel_retry_policy;
      if (Array.isArray(resp.admin_schema_preflight_checks)) state.adminSchemaPreflightChecks = resp.admin_schema_preflight_checks;
      if (Array.isArray(resp.admin_deployment_checklist)) state.adminDeploymentChecklist = resp.admin_deployment_checklist;
      if (Array.isArray(resp.admin_function_readiness_checks)) state.adminFunctionReadinessChecks = resp.admin_function_readiness_checks;
      if (Array.isArray(resp.app_deployment_bundle_checks)) state.appDeploymentBundleChecks = resp.app_deployment_bundle_checks;
      if (Array.isArray(resp.app_public_seo_checks)) state.appPublicSeoChecks = resp.app_public_seo_checks;
      if (Array.isArray(resp.app_runtime_fallback_checks)) state.appRuntimeFallbackChecks = resp.app_runtime_fallback_checks;
      if (Array.isArray(resp.app_roadmap_action_steps)) state.appRoadmapActionSteps = resp.app_roadmap_action_steps;
      if (Array.isArray(resp.app_depth_review_queue)) state.appDepthReviewQueue = resp.app_depth_review_queue;
      if (Array.isArray(resp.app_data_migration_candidates)) state.appDataMigrationCandidates = resp.app_data_migration_candidates;
      if (Array.isArray(resp.app_schema_documentation_sync_checks)) state.appSchemaDocumentationSyncChecks = resp.app_schema_documentation_sync_checks;
      if (Array.isArray(resp.app_public_route_seo_registry)) state.appPublicRouteSeoRegistry = resp.app_public_route_seo_registry;
      if (Array.isArray(resp.app_internal_link_suggestion_queue)) state.appInternalLinkSuggestionQueue = resp.app_internal_link_suggestion_queue;
      if (Array.isArray(resp.app_css_component_token_inventory)) state.appCssComponentTokenInventory = resp.app_css_component_token_inventory;
      if (Array.isArray(resp.app_mobile_field_action_queue)) state.appMobileFieldActionQueue = resp.app_mobile_field_action_queue;
      if (Array.isArray(resp.app_release_manifest_checks)) state.appReleaseManifestChecks = resp.app_release_manifest_checks;
      if (Array.isArray(resp.app_payment_application_action_registry)) state.appPaymentApplicationActionRegistry = resp.app_payment_application_action_registry;
      if (Array.isArray(resp.app_accounting_close_control_queue)) state.appAccountingCloseControlQueue = resp.app_accounting_close_control_queue;
      if (Array.isArray(resp.app_equipment_accountability_action_queue)) state.appEquipmentAccountabilityActionQueue = resp.app_equipment_accountability_action_queue;
      if (Array.isArray(resp.app_public_seo_publication_queue)) state.appPublicSeoPublicationQueue = resp.app_public_seo_publication_queue;
      if (Array.isArray(resp.app_fallback_observability_matrix)) state.appFallbackObservabilityMatrix = resp.app_fallback_observability_matrix;
      if (Array.isArray(resp.app_schema_migration_compatibility_checks)) state.appSchemaMigrationCompatibilityChecks = resp.app_schema_migration_compatibility_checks;
      if (Array.isArray(resp.app_accounting_evidence_package_queue)) state.appAccountingEvidencePackageQueue = resp.app_accounting_evidence_package_queue;
      if (Array.isArray(resp.app_equipment_return_to_service_rules)) state.appEquipmentReturnToServiceRules = resp.app_equipment_return_to_service_rules;
      if (Array.isArray(resp.app_public_asset_smoke_checks)) state.appPublicAssetSmokeChecks = resp.app_public_asset_smoke_checks;
      if (Array.isArray(resp.app_error_recovery_playbook)) state.appErrorRecoveryPlaybook = resp.app_error_recovery_playbook;
      if (Array.isArray(resp.app_payment_execution_queue)) state.appPaymentExecutionQueue = resp.app_payment_execution_queue;
      if (Array.isArray(resp.app_bank_reconciliation_execution_queue)) state.appBankReconciliationExecutionQueue = resp.app_bank_reconciliation_execution_queue;
      if (Array.isArray(resp.app_equipment_scan_template_registry)) state.appEquipmentScanTemplateRegistry = resp.app_equipment_scan_template_registry;
      if (Array.isArray(resp.app_local_seo_execution_queue)) state.appLocalSeoExecutionQueue = resp.app_local_seo_execution_queue;
      if (Array.isArray(resp.app_fallback_drill_queue)) state.appFallbackDrillQueue = resp.app_fallback_drill_queue;
      if (Array.isArray(resp.app_payment_application_ui_queue)) state.appPaymentApplicationUiQueue = resp.app_payment_application_ui_queue;
      if (Array.isArray(resp.app_reconciliation_import_validation_queue)) state.appReconciliationImportValidationQueue = resp.app_reconciliation_import_validation_queue;
      if (Array.isArray(resp.app_equipment_service_closeout_queue)) state.appEquipmentServiceCloseoutQueue = resp.app_equipment_service_closeout_queue;
      if (Array.isArray(resp.app_seo_asset_publication_queue)) state.appSeoAssetPublicationQueue = resp.app_seo_asset_publication_queue;
      if (Array.isArray(resp.app_runtime_recovery_telemetry_queue)) state.appRuntimeRecoveryTelemetryQueue = resp.app_runtime_recovery_telemetry_queue;
      if (Array.isArray(resp.app_payment_posting_proof_queue)) state.appPaymentPostingProofQueue = resp.app_payment_posting_proof_queue;
      if (Array.isArray(resp.app_reconciliation_match_workbench_queue)) state.appReconciliationMatchWorkbenchQueue = resp.app_reconciliation_match_workbench_queue;
      if (Array.isArray(resp.app_equipment_scan_verification_queue)) state.appEquipmentScanVerificationQueue = resp.app_equipment_scan_verification_queue;
      if (Array.isArray(resp.app_local_seo_asset_smoke_queue)) state.appLocalSeoAssetSmokeQueue = resp.app_local_seo_asset_smoke_queue;
      if (Array.isArray(resp.app_runtime_fallback_drill_history_queue)) state.appRuntimeFallbackDrillHistoryQueue = resp.app_runtime_fallback_drill_history_queue;
      if (Array.isArray(resp.app_payment_write_path_queue)) state.appPaymentWritePathQueue = resp.app_payment_write_path_queue;
      if (Array.isArray(resp.app_reconciliation_scoring_rule_queue)) state.appReconciliationScoringRuleQueue = resp.app_reconciliation_scoring_rule_queue;
      if (Array.isArray(resp.app_equipment_accessory_template_queue)) state.appEquipmentAccessoryTemplateQueue = resp.app_equipment_accessory_template_queue;
      if (Array.isArray(resp.app_local_seo_generation_queue)) state.appLocalSeoGenerationQueue = resp.app_local_seo_generation_queue;
      if (Array.isArray(resp.app_mobile_offline_conflict_resolution_queue)) state.appMobileOfflineConflictResolutionQueue = resp.app_mobile_offline_conflict_resolution_queue;
      if (Array.isArray(resp.app_payment_adjustment_workflow_queue)) state.appPaymentAdjustmentWorkflowQueue = resp.app_payment_adjustment_workflow_queue;
      if (Array.isArray(resp.app_reconciliation_exception_resolution_queue)) state.appReconciliationExceptionResolutionQueue = resp.app_reconciliation_exception_resolution_queue;
      if (Array.isArray(resp.app_equipment_scan_rollout_queue)) state.appEquipmentScanRolloutQueue = resp.app_equipment_scan_rollout_queue;
      if (Array.isArray(resp.app_local_seo_content_depth_queue)) state.appLocalSeoContentDepthQueue = resp.app_local_seo_content_depth_queue;
      if (Array.isArray(resp.app_runtime_error_message_catalog)) state.appRuntimeErrorMessageCatalog = resp.app_runtime_error_message_catalog;
      if (Array.isArray(resp.app_release_validation_queue)) state.appReleaseValidationQueue = resp.app_release_validation_queue;
      if (Array.isArray(resp.app_payment_reconciliation_execution_queue)) state.appPaymentReconciliationExecutionQueue = resp.app_payment_reconciliation_execution_queue;
      if (Array.isArray(resp.app_equipment_mobile_scan_validation_queue)) state.appEquipmentMobileScanValidationQueue = resp.app_equipment_mobile_scan_validation_queue;
      if (Array.isArray(resp.app_local_seo_release_validation_queue)) state.appLocalSeoReleaseValidationQueue = resp.app_local_seo_release_validation_queue;
      if (Array.isArray(resp.app_runtime_fallback_message_queue)) state.appRuntimeFallbackMessageQueue = resp.app_runtime_fallback_message_queue;
      if (Array.isArray(resp.app_json_db_migration_execution_queue)) state.appJsonDbMigrationExecutionQueue = resp.app_json_db_migration_execution_queue;
      if (Array.isArray(resp.app_release_cutover_checklist)) state.appReleaseCutoverChecklist = resp.app_release_cutover_checklist;
      if (Array.isArray(resp.app_payment_exception_decision_queue)) state.appPaymentExceptionDecisionQueue = resp.app_payment_exception_decision_queue;
      if (Array.isArray(resp.app_equipment_return_to_service_gate_queue)) state.appEquipmentReturnToServiceGateQueue = resp.app_equipment_return_to_service_gate_queue;
      if (Array.isArray(resp.app_local_search_evidence_queue)) state.appLocalSearchEvidenceQueue = resp.app_local_search_evidence_queue;
      if (Array.isArray(resp.app_css_drift_watchlist)) state.appCssDriftWatchlist = resp.app_css_drift_watchlist;
      if (Array.isArray(resp.app_runtime_fallback_test_plan)) state.appRuntimeFallbackTestPlan = resp.app_runtime_fallback_test_plan;
      if (Array.isArray(resp.app_json_db_source_of_truth_queue)) state.appJsonDbSourceOfTruthQueue = resp.app_json_db_source_of_truth_queue;

      state.counts = {
        users: state.directoryPagination.people?.total || state.users.length,
        sites: Array.isArray(state.sites) ? state.sites.length : 0,
        assignments: Array.isArray(state.assignments) ? state.assignments.length : 0,
        orders: Array.isArray(state.salesOrders) ? state.salesOrders.length : 0
      };
    }

    function getAdminDirectoryPagingPayload() {
      const peoplePaging = state.directoryPagination.people || {};
      const jobsPaging = state.directoryPagination.jobs || {};
      return {
        limit: 200,
        people_page: peoplePaging.page || 1,
        people_page_size: peoplePaging.pageSize || 25,
        people_search: peoplePaging.search || '',
        role_filter: peoplePaging.roleFilter || '',
        people_sort: peoplePaging.sort || 'full_name',
        people_sort_dir: peoplePaging.direction || 'asc',
        jobs_page: jobsPaging.page || 1,
        jobs_page_size: jobsPaging.pageSize || 25,
        jobs_search: jobsPaging.search || '',
        jobs_sort: jobsPaging.sort || 'job_code',
        jobs_sort_dir: jobsPaging.direction || 'asc'
      };
    }

    function getRegisteredInitialAdminScopes() {
      const fallback = ['command_center', 'health', 'people', 'operations', 'accounting_close', 'banking', 'tax_payroll', 'evidence'];
      const rows = Array.isArray(state.adminFastPathScopeRegistry) ? state.adminFastPathScopeRegistry : [];
      const configured = rows
        .filter((row) => row && row.is_initial_load_scope && !row.is_deprecated && row.scope_key)
        .map((row) => String(row.scope_key).trim().toLowerCase())
        .filter(Boolean);
      const ordered = configured.length ? configured : fallback;
      return Array.from(new Set(['command_center', ...ordered]));
    }

    function getAdminScopeRegistryRow(scope) {
      const clean = String(scope || '').trim().toLowerCase();
      const rows = Array.isArray(state.adminFastPathScopeRegistry) ? state.adminFastPathScopeRegistry : [];
      return rows.find((row) => String(row.scope_key || '').trim().toLowerCase() === clean) || null;
    }

    function getAdminScopeTimeout(scope) {
      const clean = String(scope || 'all').toLowerCase();
      const registryRow = getAdminScopeRegistryRow(clean);
      const registryTimeout = Number(registryRow?.preferred_timeout_ms || 0);
      if (Number.isFinite(registryTimeout) && registryTimeout >= 5000) return registryTimeout;
      if (clean === 'all') return 90000;
      if (clean === 'operations') return 25000;
      if (clean === 'reporting') return 20000;
      if (clean === 'accounting') return 30000;
      if (['accounting_close', 'banking', 'tax_payroll', 'evidence'].includes(clean)) return 18000;
      return 16000;
    }

    const ADMIN_SCOPE_LABELS = {
      command_center: 'Command Center',
      health: 'Health',
      people: 'People',
      operations: 'Operations',
      accounting_close: 'Accounting Close',
      banking: 'Banking',
      tax_payroll: 'Tax/Payroll',
      evidence: 'Evidence',
      accounting: 'Accounting Fallback',
      all: 'All Fallback'
    };

    const ADMIN_SCOPE_PANEL_KEYS = {
      command_center: 'admin_command_center',
      health: 'admin_health_schema',
      people: 'admin_staff_directory',
      operations: 'admin_jobs_operations',
      accounting_close: 'admin_accounting_close',
      banking: 'admin_banking_reconciliation',
      tax_payroll: 'admin_tax_payroll',
      evidence: 'admin_evidence_manager',
      accounting: 'admin_accounting_fallback',
      all: 'admin_all_fallback'
    };

    function getAdminScopeStaleSeconds(scope) {
      const loadedAt = state.adminScopeLastUpdated[String(scope || '').toLowerCase()];
      if (!loadedAt) return null;
      const loadedMs = new Date(loadedAt).getTime();
      if (!Number.isFinite(loadedMs)) return null;
      return Math.max(0, Math.round((Date.now() - loadedMs) / 1000));
    }

    function formatAdminScopeAge(scope) {
      const seconds = getAdminScopeStaleSeconds(scope);
      if (seconds === null) return 'Not loaded';
      if (seconds < 60) return `${seconds}s old`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m old`;
      const hours = Math.floor(minutes / 60);
      return `${hours}h old`;
    }

    function getAdminScopeAgeSeverity(scope) {
      const timing = state.adminScopeTimings[String(scope || '').toLowerCase()] || {};
      if (timing.ok === false) return 'error';
      const seconds = getAdminScopeStaleSeconds(scope);
      if (seconds === null) return 'warning';
      if (seconds > 900) return 'warning';
      return 'ok';
    }

    function setAdminAgeBadge(el, scope) {
      if (!el) return;
      const severity = getAdminScopeAgeSeverity(scope);
      el.dataset.status = severity;
      el.textContent = formatAdminScopeAge(scope);
      el.title = `${ADMIN_SCOPE_LABELS[scope] || scope} last live load age`;
    }

    function renderAdminPanelAgeBadges() {
      const e = els();
      setAdminAgeBadge(e.commandAgeBadge, 'command_center');
      setAdminAgeBadge(e.healthAgeBadge, 'health');
      setAdminAgeBadge(e.staffAgeBadge, 'people');
      setAdminAgeBadge(e.jobsAgeBadge, 'operations');
      setAdminAgeBadge(e.accountingAgeBadge, 'accounting_close');
      setAdminAgeBadge(e.evidenceAgeBadge, 'evidence');
      if (!e.panelAgeBadges) return;
      const scopes = ['command_center', 'health', 'people', 'operations', 'accounting_close', 'banking', 'tax_payroll', 'evidence'];
      e.panelAgeBadges.innerHTML = scopes.map((scope) => {
        const severity = getAdminScopeAgeSeverity(scope);
        const row = state.adminScopeTimings[scope] || {};
        return `<span class="admin-age-badge" data-status="${escHtml(severity)}"><strong>${escHtml(ADMIN_SCOPE_LABELS[scope] || scope)}</strong> ${escHtml(formatAdminScopeAge(scope))}${row.ok === false ? ` · ${escHtml(row.message || 'retry needed')}` : ''}</span>`;
      }).join('');
    }

    function renderAdminScopeDiagnostics() {
      const e = els();
      if (!e.scopeDiagnosticsBody) return;
      const scopes = ['command_center', 'health', 'people', 'operations', 'accounting_close', 'banking', 'tax_payroll', 'evidence', 'accounting', 'all'];
      const liveRows = scopes.map((scope) => ({
        row_kind: 'browser',
        edge_scope: scope,
        panel_key: ADMIN_SCOPE_PANEL_KEYS[scope] || scope,
        load_status: state.adminScopeTimings[scope]?.ok === false ? 'failed' : (state.adminScopeTimings[scope]?.ok === true ? 'loaded' : 'pending'),
        elapsed_ms: state.adminScopeTimings[scope]?.elapsedMs,
        stale_age_seconds: getAdminScopeStaleSeconds(scope),
        diagnostic_message: state.adminScopeTimings[scope]?.message || 'No live request recorded in this browser session yet.',
        captured_at: state.adminScopeTimings[scope]?.checkedAt || '',
      }));
      const persisted = (Array.isArray(state.adminPanelLoadDiagnostics) ? state.adminPanelLoadDiagnostics : []).slice(0, 12).map((row) => ({ ...row, row_kind: 'database' }));
      const rows = [...liveRows, ...persisted].slice(0, 24);
      e.scopeDiagnosticsBody.innerHTML = rows.map((row) => {
        const status = String(row.load_status || 'observed').toLowerCase();
        const severity = status.includes('fail') || status.includes('timeout') ? 'error' : (status.includes('pending') ? 'warning' : 'ok');
        const age = row.stale_age_seconds == null ? '—' : `${row.stale_age_seconds}s`;
        return `<div class="admin-diagnostic-row" data-status="${escHtml(severity)}">
          <strong>${escHtml(row.row_kind || 'browser')}</strong>
          <span>${escHtml(ADMIN_SCOPE_LABELS[row.edge_scope] || row.edge_scope || row.panel_key || 'panel')}</span>
          <span>${escHtml(row.load_status || 'observed')}</span>
          <span>${escHtml(row.elapsed_ms != null ? `${row.elapsed_ms}ms` : '—')}</span>
          <span>${escHtml(age)}</span>
          <small>${escHtml(row.diagnostic_message || row.message || '')}</small>
        </div>`;
      }).join('');
    }

    function persistAdminPanelDiagnostic(scope, timing) {
      if (!manageAdminEntity || !timing || timing.ok !== false) return;
      const clean = String(scope || 'all').toLowerCase();
      const payload = {
        entity: 'admin_panel_load_diagnostic',
        action: 'create',
        panel_key: ADMIN_SCOPE_PANEL_KEYS[clean] || clean,
        edge_scope: clean,
        load_status: 'failed',
        elapsed_ms: Number(timing.elapsedMs || 0),
        stale_age_seconds: getAdminScopeStaleSeconds(clean),
        diagnostic_message: timing.message || 'Admin panel failed to load.',
        metadata: {
          checked_at: timing.checkedAt,
          user_agent: navigator.userAgent,
          route_hash: window.location.hash || ''
        }
      };
      Promise.resolve(manageAdminEntity(payload)).catch(() => {});
    }

    function recordAdminScopeTiming(scope, startedAt, ok = true, message = '') {
      const clean = String(scope || 'all').toLowerCase();
      const elapsedMs = Math.max(0, Math.round(performance.now() - startedAt));
      const checkedAt = new Date().toISOString();
      state.adminScopeTimings[clean] = {
        scope: clean,
        ok: !!ok,
        elapsedMs,
        staleAgeSeconds: getAdminScopeStaleSeconds(clean),
        message: String(message || (ok ? 'Loaded' : 'Failed')).slice(0, 180),
        checkedAt
      };
      if (ok) {
        state.adminScopeLastUpdated[clean] = checkedAt;
        state.adminScopeTimings[clean].staleAgeSeconds = 0;
      }
      renderAdminScopeStatus();
      if (!ok) persistAdminPanelDiagnostic(clean, state.adminScopeTimings[clean]);
      return state.adminScopeTimings[clean];
    }

    function renderAdminScopeStatus() {
      const e = els();
      if (!e.scopeStatus) return;
      const labels = ADMIN_SCOPE_LABELS;
      const scopes = ['command_center', 'health', 'people', 'operations', 'accounting_close', 'banking', 'tax_payroll', 'evidence'];
      e.scopeStatus.innerHTML = scopes.map((scope) => {
        const row = state.adminScopeTimings[scope] || {};
        const ok = row.ok === true;
        const failed = row.ok === false;
        const severity = ok ? 'ok' : (failed ? 'error' : 'warning');
        const age = formatAdminScopeAge(scope);
        const elapsed = Number.isFinite(Number(row.elapsedMs)) ? `${row.elapsedMs}ms` : '—';
        const msg = row.message || (failed ? 'Failed' : 'Waiting for first live load');
        return `
          <div class="admin-scope-status-card" data-status="${escHtml(severity)}">
            <span>${escHtml(labels[scope] || scope)}</span>
            <strong>${escHtml(ok ? 'Live' : (failed ? 'Retry' : 'Pending'))}</strong>
            <small>${escHtml(elapsed)} · ${escHtml(age)}</small>
            <small>${escHtml(msg)}</small>
          </div>`;
      }).join('');
      renderAdminPanelAgeBadges();
      renderAdminScopeDiagnostics();
    }

    async function refreshAdminPanelScope(scope = 'all') {
      applyRoleAccess();
      if (state.locked) return null;
      const cleanScope = String(scope || 'all').trim().toLowerCase() || 'all';
      const startedAt = performance.now();
      let resp = null;
      try {
        resp = await loadAdminDirectory({ ...getAdminDirectoryPagingPayload(), scope: cleanScope, timeoutMs: getAdminScopeTimeout(cleanScope) });
        recordAdminScopeTiming(cleanScope, startedAt, true, 'Manual refresh loaded.');
      } catch (err) {
        recordAdminScopeTiming(cleanScope, startedAt, false, err?.message || 'Panel refresh failed.');
        throw err;
      }
      mergeAdminDirectoryScopeResponse(resp || {});
      const e = els();
      if (e.usersCount) e.usersCount.textContent = String(state.counts.users || 0);
      if (e.sitesCount) e.sitesCount.textContent = String(state.counts.sites || 0);
      if (e.assignmentsCount) e.assignmentsCount.textContent = String(state.counts.assignments || 0);
      if (cleanScope === 'people') {
        renderStaffDirectory();
        renderProfileOptions();
        renderAssignmentWorkbench();
        setSummary('Staff Directory refreshed without reloading the full Admin manager.');
        return resp;
      }
      if (cleanScope === 'operations') {
        renderJobsReviewTable();
        renderBackboneTable();
        fillBackboneForm(getSelectedBackboneRecord());
        renderOperationsDashboardCards();
        renderAdminCommandCenter();
        setSummary('Jobs and Operations refreshed without reloading the full Admin manager.');
        return resp;
      }
      if (cleanScope === 'command_center') {
        renderAdminCommandCenter();
        renderAdminTaskInbox();
        setSummary('Command Center refreshed without reloading full Admin data.');
        return resp;
      }
      if (cleanScope === 'health') {
        renderAdminCommandCenter();
        renderAdminHealthCenter();
        renderAdminTaskInbox();
        renderProductionReadiness();
        setSummary('Health and Schema panels refreshed.');
        return resp;
      }
      if (['accounting_close', 'banking', 'tax_payroll', 'accounting'].includes(cleanScope)) {
        renderGuidedCloseCenter();
        renderProductionReadiness();
        renderAdminCommandCenter();
        setSummary(`${ADMIN_SCOPE_LABELS[cleanScope] || 'Accounting'} refreshed without reloading the full Admin manager.`);
        return resp;
      }
      if (cleanScope === 'evidence') {
        renderEvidenceManager();
        renderEvidenceReview();
        renderAdminCommandCenter();
        setSummary('Evidence Manager refreshed without reloading the full Admin manager.');
        return resp;
      }
      renderStaffDirectory();
      renderBackboneTable();
      renderAdminCommandCenter();
      renderAdminHealthCenter();
      return resp;
    }

    function renderStaffPagination() {
      const e = els();
      const paging = state.directoryPagination.people || { page: 1, pageSize: 25, total: 0, totalPages: 1, loaded: 0 };
      if (e.staffSearch && document.activeElement !== e.staffSearch) e.staffSearch.value = paging.search || '';
      if (e.staffRoleFilter && document.activeElement !== e.staffRoleFilter) e.staffRoleFilter.value = paging.roleFilter || '';
      if (e.staffSort && document.activeElement !== e.staffSort) e.staffSort.value = paging.sort || 'full_name';
      if (e.staffSortDir && document.activeElement !== e.staffSortDir) e.staffSortDir.value = paging.direction || 'asc';
      if (e.staffPageSize && document.activeElement !== e.staffPageSize) e.staffPageSize.value = String(paging.pageSize || 25);
      if (e.staffPageLabel) {
        const start = paging.total ? ((paging.page - 1) * paging.pageSize) + 1 : 0;
        const end = Math.min(paging.total || 0, (paging.page || 1) * (paging.pageSize || 25));
        e.staffPageLabel.textContent = `Page ${paging.page || 1} of ${paging.totalPages || 1} · ${start}-${end} of ${paging.total || state.users.length}`;
      }
      if (e.staffPrevPage) e.staffPrevPage.disabled = (paging.page || 1) <= 1;
      if (e.staffNextPage) e.staffNextPage.disabled = (paging.page || 1) >= (paging.totalPages || 1);
    }

    function renderJobsPagination() {
      const e = els();
      const paging = state.directoryPagination.jobs || { page: 1, pageSize: 25, total: 0, totalPages: 1, loaded: 0, search: '', sort: 'job_code', direction: 'asc' };
      if (e.jobsSearch && document.activeElement !== e.jobsSearch) e.jobsSearch.value = paging.search || '';
      if (e.jobsSort && document.activeElement !== e.jobsSort) e.jobsSort.value = paging.sort || 'job_code';
      if (e.jobsSortDir && document.activeElement !== e.jobsSortDir) e.jobsSortDir.value = paging.direction || 'asc';
      if (e.jobsPageSize && document.activeElement !== e.jobsPageSize) e.jobsPageSize.value = String(paging.pageSize || 25);
      if (e.jobsPageLabel) {
        const start = paging.total ? ((paging.page - 1) * paging.pageSize) + 1 : 0;
        const end = Math.min(paging.total || 0, (paging.page || 1) * (paging.pageSize || 25));
        e.jobsPageLabel.textContent = `Jobs page ${paging.page || 1} of ${paging.totalPages || 1} · ${start}-${end} of ${paging.total || state.jobs.length}`;
      }
      if (e.jobsPrevPage) e.jobsPrevPage.disabled = (paging.page || 1) <= 1;
      if (e.jobsNextPage) e.jobsNextPage.disabled = (paging.page || 1) >= (paging.totalPages || 1);
    }

    function applyJobsDirectoryFilter(resetPage = true) {
      const e = els();
      const nextPageSize = Number(e.jobsPageSize?.value || state.directoryPagination.jobs.pageSize || 25);
      state.directoryPagination.jobs = {
        ...state.directoryPagination.jobs,
        search: String(e.jobsSearch?.value || '').trim(),
        sort: String(e.jobsSort?.value || 'job_code').trim() || 'job_code',
        direction: String(e.jobsSortDir?.value || 'asc').trim() || 'asc',
        pageSize: Number.isFinite(nextPageSize) && nextPageSize > 0 ? nextPageSize : 25,
        page: resetPage ? 1 : (state.directoryPagination.jobs.page || 1)
      };
      return refreshAdminPanelScope('operations');
    }

    function renderStaffDirectory() {
      const e = els();
      renderStaffPagination();
      if (e.staffProfileId) {
        const current = e.staffProfileId.value || '';
        e.staffProfileId.innerHTML = '<option value="">Select staff</option>' + state.users.map((row) => `<option value="${escHtml(row.id)}">${escHtml(row.full_name || row.email || row.id)} (${escHtml(row.role || 'employee')})</option>`).join('');
        if (current && state.users.some((row) => String(row.id) === String(current))) e.staffProfileId.value = current;
      }
      if (e.staffBody) {
        e.staffBody.innerHTML = state.users.map((row) => `<tr data-staff-id="${escHtml(row.id)}"><td>${escHtml(row.full_name || '')}</td><td>${escHtml(row.email || '')}</td><td>${escHtml(row.role || '')}</td><td>${escHtml(row.staff_tier || '')}</td><td>${escHtml(row.seniority_level || '')}</td><td>${escHtml(row.employment_status || (row.is_active === false ? 'blocked' : 'active'))}</td><td>${escHtml(row.phone || '')}</td><td>${escHtml(row.hourly_cost_rate || '')}</td><td>${escHtml(row.hourly_bill_rate || '')}</td><td>${escHtml(row.last_login_at ? new Date(row.last_login_at).toLocaleString() : '')}</td><td>${escHtml(row.login_event_count ?? 0)}</td></tr>`).join('') || '<tr><td colspan="11" class="muted">No staff records loaded for this page/filter.</td></tr>'; 
      }
    }

    function applyStaffDirectoryFilter(resetPage = true) {
      const e = els();
      const nextPageSize = Number(e.staffPageSize?.value || state.directoryPagination.people.pageSize || 25);
      state.directoryPagination.people = {
        ...state.directoryPagination.people,
        search: String(e.staffSearch?.value || '').trim(),
        roleFilter: String(e.staffRoleFilter?.value || '').trim(),
        sort: String(e.staffSort?.value || 'full_name').trim() || 'full_name',
        direction: String(e.staffSortDir?.value || 'asc').trim() || 'asc',
        pageSize: Number.isFinite(nextPageSize) && nextPageSize > 0 ? nextPageSize : 25,
        page: resetPage ? 1 : (state.directoryPagination.people.page || 1)
      };
      return refreshAdminPanelScope('people');
    }

    function getSelectedStaff() {
      const e = els();
      return state.users.find((row) => String(row.id) === String(e.staffProfileId?.value || '')) || null;
    }

    async function createStaffUser() {
      const e = els();
      const email = String(e.staffEmail?.value || '').trim().toLowerCase();
      const password = String(e.staffNewPassword?.value || '');
      if (!email) {
        setStaffNotice('Email is required for a new staff user.', true);
        return setSummary('Email is required for a new staff user.', true);
      }
      if (!isValidEmailAddress(email)) {
        setStaffNotice('Enter a valid email address before creating the staff user.', true);
        return setSummary('Enter a valid email address before creating the staff user.', true);
      }
      const passwordIssue = validateStaffPassword(password);
      if (passwordIssue) {
        setStaffNotice(passwordIssue, true);
        return setSummary(passwordIssue, true);
      }
      if (typeof manageAdminEntity !== 'function') {
        setStaffNotice('Admin save service is not available right now. Reload the page and try again.', true);
        throw new Error('Admin save service is not available right now.');
      }
      setStaffBusy(true, 'Creating staff user…');
      try {
        const resp = await manageAdminEntity({ entity:'credential', action:'create_user', email, new_password:password, full_name:e.staffFullName?.value || '', phone:e.staffPhone?.value || '', role:e.staffRole?.value || 'employee', staff_tier:e.staffTier?.value || '', seniority_level:e.staffSeniority?.value || '', employment_status:e.staffStatus?.value || 'active', employee_number:e.staffEmployeeNumber?.value || '', current_position:e.staffPosition?.value || '', trade_specialty:e.staffTrade?.value || '', start_date:e.staffStartDate?.value || null, phone_verified:!!e.staffPhoneVerified?.checked, email_verified:!!e.staffEmailVerified?.checked, is_active:!!e.staffActive?.checked, notes:e.staffNotes?.value || '', hourly_cost_rate:e.staffHourlyCostRate?.value || null, overtime_cost_rate:e.staffOvertimeCostRate?.value || null, hourly_bill_rate:e.staffHourlyBillRate?.value || null, overtime_bill_rate:e.staffOvertimeBillRate?.value || null, payroll_burden_percent:e.staffPayrollBurdenPercent?.value || null });
        if (!resp?.ok) throw new Error(resp?.error || 'Failed to create staff user.');
        if (e.staffNewPassword) e.staffNewPassword.value = '';
        await loadDirectory();
        const createdRecord = state.users.find((row) => String(row.id) === String(resp?.record?.id || '')) || resp.record || null;
        fillStaffForm(createdRecord);
        setStaffNotice(`Staff user created for ${createdRecord?.email || email}.`, false);
        setSummary(`Staff user created for ${createdRecord?.email || email}.`, false);
      } catch (error) {
        const message = String(error?.message || error || 'Failed to create staff user.');
        setStaffNotice(message, true);
        setSummary(message, true);
        throw error;
      } finally {
        setStaffBusy(false);
      }
    }

    async function saveStaffDetails() {
      const e = els();
      const profileId = e.staffProfileId?.value || '';
      const email = String(e.staffEmail?.value || '').trim().toLowerCase();
      if (!profileId) {
        setStaffNotice('Select a staff record first before saving.', true);
        return setSummary('Select a staff record first before saving.', true);
      }
      if (!email) {
        setStaffNotice('Email is required before saving staff details.', true);
        return setSummary('Email is required before saving staff details.', true);
      }
      if (!isValidEmailAddress(email)) {
        setStaffNotice('Enter a valid email address before saving staff details.', true);
        return setSummary('Enter a valid email address before saving staff details.', true);
      }
      if (typeof manageAdminEntity !== 'function') {
        setStaffNotice('Admin save service is not available right now. Reload the page and try again.', true);
        throw new Error('Admin save service is not available right now.');
      }
      setStaffBusy(true, 'Saving staff details…');
      try {
        const resp = await manageAdminEntity({ entity:'profile', action:'update', profile_id:profileId, email, full_name:e.staffFullName?.value || null, role:e.staffRole?.value || 'employee', phone:e.staffPhone?.value || null, phone_verified:!!e.staffPhoneVerified?.checked, email_verified:!!e.staffEmailVerified?.checked, employee_number:e.staffEmployeeNumber?.value || null, current_position:e.staffPosition?.value || null, trade_specialty:e.staffTrade?.value || null, seniority_level:e.staffSeniority?.value || null, employment_status:e.staffStatus?.value || 'active', staff_tier:e.staffTier?.value || null, start_date:e.staffStartDate?.value || null, notes:e.staffNotes?.value || null, is_active:!!e.staffActive?.checked, hourly_cost_rate:e.staffHourlyCostRate?.value || null, overtime_cost_rate:e.staffOvertimeCostRate?.value || null, hourly_bill_rate:e.staffHourlyBillRate?.value || null, overtime_bill_rate:e.staffOvertimeBillRate?.value || null, payroll_burden_percent:e.staffPayrollBurdenPercent?.value || null });
        if (!resp?.ok) throw new Error(resp?.error || 'Failed to save staff details.');
        await loadDirectory();
        const savedRecord = state.users.find((row) => String(row.id) === String(profileId)) || resp.record || null;
        fillStaffForm(savedRecord);
        setStaffNotice(`Staff details saved for ${savedRecord?.email || email}.`, false);
        setSummary(`Staff details saved for ${savedRecord?.email || email}.`, false);
      } catch (error) {
        const message = String(error?.message || error || 'Failed to save staff details.');
        setStaffNotice(message, true);
        setSummary(message, true);
        throw error;
      } finally {
        setStaffBusy(false);
      }
    }

    async function toggleStaffBlock() {
      const e = els();
      const profileId = e.staffProfileId?.value || '';
      if (!profileId) {
        setStaffNotice('Select a staff record first before changing active status.', true);
        return setSummary('Select a staff record first before changing active status.', true);
      }
      const nextActive = !e.staffActive?.checked;
      setStaffBusy(true, nextActive ? 'Activating staff record…' : 'Blocking staff record…');
      try {
        const resp = await manageAdminEntity({ entity:'profile', action:'set_active', profile_id:profileId, is_active:nextActive, employment_status: nextActive ? 'active' : 'blocked' });
        if (!resp?.ok) throw new Error(resp?.error || 'Failed to update active status.');
        await loadDirectory();
        fillStaffForm(resp.record || null);
        const message = nextActive ? 'Staff record unblocked / activated.' : 'Staff record blocked.';
        setStaffNotice(message, false);
        setSummary(message, false);
      } catch (error) {
        const message = String(error?.message || error || 'Failed to update active status.');
        setStaffNotice(message, true);
        setSummary(message, true);
        throw error;
      } finally {
        setStaffBusy(false);
      }
    }

    async function sendStaffReset() {
      const e = els();
      const profileId = e.staffProfileId?.value || '';
      if (!profileId) {
        setStaffNotice('Select a staff record first before sending a reset.', true);
        return setSummary('Select a staff record first before sending a reset.', true);
      }
      setStaffBusy(true, 'Generating password reset link…');
      try {
        const resp = await manageAdminEntity({ entity:'credential', action:'send_password_reset', profile_id: profileId });
        if (!resp?.ok) throw new Error(resp?.error || 'Failed to send reset.');
        const message = `Password reset link generated for ${resp.email || 'selected user'}.`;
        setStaffNotice(message, false);
        setSummary(message, false);
      } catch (error) {
        const message = String(error?.message || error || 'Failed to send reset.');
        setStaffNotice(message, true);
        setSummary(message, true);
        throw error;
      } finally {
        setStaffBusy(false);
      }
    }

    async function deleteStaffUser() {
      const e = els();
      const profileId = e.staffProfileId?.value || '';
      if (!profileId) {
        setStaffNotice('Select a staff record first before deleting.', true);
        return setSummary('Select a staff record first before deleting.', true);
      }
      const ok = window.confirm('Delete this user and auth account? This cannot be undone.');
      if (!ok) return;
      setStaffBusy(true, 'Deleting staff user…');
      try {
        const resp = await manageAdminEntity({ entity:'profile', action:'delete', profile_id: profileId });
        if (!resp?.ok) throw new Error(resp?.error || 'Failed to delete user.');
        await loadDirectory();
        fillStaffForm(null);
        setStaffNotice('User deleted.', false);
        setSummary('User deleted.', false);
      } catch (error) {
        const message = String(error?.message || error || 'Failed to delete user.');
        setStaffNotice(message, true);
        setSummary(message, true);
        throw error;
      } finally {
        setStaffBusy(false);
      }
    }

    function renderProfileOptions() {
      const e = els();
      if (!e.passwordProfileId) return;
      const current = e.passwordProfileId.value || '';
      e.passwordProfileId.innerHTML = '<option value="">Select profile</option>' + state.users.map((row) => `<option value="${escHtml(row.id)}">${escHtml(row.full_name || row.email || row.id)} (${escHtml(row.role || 'worker')})</option>`).join('');
      if (current) e.passwordProfileId.value = current;
    }

    function renderOrders() {
      const e = els();
      if (e.ordersBody) {
        e.ordersBody.innerHTML = state.salesOrders.map((row) => `<tr><td><strong>${escHtml(row.order_code || row.id)}</strong></td><td>${escHtml(row.customer_name || row.customer_email || '')}</td><td>${escHtml(row.order_status || '')}</td><td>${escHtml(row.currency_code || 'CAD')} ${escHtml(row.total_amount || 0)}</td><td>${escHtml(row.created_at || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No orders created yet.</td></tr>';
      }
      if (e.accountingBody) {
        e.accountingBody.innerHTML = state.accountingEntries.map((row) => `<tr><td><strong>${escHtml(row.entry_type || row.id)}</strong></td><td>${escHtml(row.source_type || '')} #${escHtml(row.source_id || '')}</td><td>${escHtml(row.entry_status || '')}</td><td>${escHtml(row.currency_code || 'CAD')} ${escHtml(row.total_amount || 0)}</td><td>${escHtml(row.created_at || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No accounting records created yet.</td></tr>';
      }
    }

    async function setAdminPassword() {
      const e = els();
      const profileId = e.passwordProfileId?.value?.trim?.() || '';
      const password = e.passwordNew?.value || '';
      const confirm = e.passwordConfirm?.value || '';
      if (!profileId) return setSummary('Choose a target profile for the password change.', true);
      if (!password) return setSummary('Enter a new password.', true);
      if (password !== confirm) return setSummary('Password confirmation does not match.', true);
      try {
        const resp = await manageAdminEntity({ entity: 'credential', action: 'set_password', profile_id: profileId, new_password: password, reason: e.passwordReason?.value || '', force_password_change: !!e.passwordForceChange?.checked });
        if (!resp?.ok) throw new Error(resp?.error || 'Password reset failed.');
        if (e.passwordNew) e.passwordNew.value = '';
        if (e.passwordConfirm) e.passwordConfirm.value = '';
        setSummary('Admin password change completed and audited.');
        await loadDirectory();
      } catch (err) {
        setSummary(String(err?.message || 'Password reset failed.'), true);
      }
    }

    function syncOntarioOrderTotals(forceTax = false) {
      const e = els();
      const subtotal = Number(e.orderSubtotal?.value || 0);
      const currentTax = Number(e.orderTax?.value || 0);
      const tax = forceTax || currentTax <= 0 ? Number((subtotal * 0.13).toFixed(2)) : currentTax;
      if (e.orderTax && (forceTax || currentTax <= 0)) e.orderTax.value = String(tax.toFixed(2));
      if (e.orderTotal) e.orderTotal.value = String((subtotal + tax).toFixed(2));
    }

    async function createSalesOrder() {
      const e = els();
      try {
        syncOntarioOrderTotals(false);
        const subtotal = Number(e.orderSubtotal?.value || 0);
        const tax = Number(e.orderTax?.value || 0);
        const total = Number(e.orderTotal?.value || subtotal + tax);
        const resp = await manageAdminEntity({ entity: 'sales_order', action: 'create', customer_name: e.orderCustomerName?.value || '', customer_email: e.orderCustomerEmail?.value || '', order_status: e.orderStatus?.value || 'draft', subtotal_amount: subtotal, tax_amount: tax, total_amount: total, notes: e.orderNotes?.value || '' });
        if (!resp?.ok) throw new Error(resp?.error || 'Order create failed.');
        setSummary(`Order ${resp?.record?.order_code || resp?.record?.id || ''} created with accounting entry ${resp?.accounting_record?.id || ''}. Ontario HST helper currently defaults to 13% for taxable Ontario work.`);
        await loadDirectory();
      } catch (err) {
        setSummary(String(err?.message || 'Order create failed.'), true);
      }
    }

    function renderSmokeChecks(result = {}) {
      const e = els();
      if (!e.smokeBody) return;
      const checks = Array.isArray(result.checks) ? result.checks : [];
      state.smokeChecks = checks;
      e.smokeBody.innerHTML = '';
      for (const row of checks) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escHtml(row.scope || row.name || 'check')}</td>
          <td>${row.ok ? 'OK' : 'Fail'}</td>
          <td>${escHtml(row.message || row.details || '')}</td>
        `;
        e.smokeBody.appendChild(tr);
      }
      if (e.smokeSummary) {
        if (!checks.length) {
          e.smokeSummary.style.display = 'none';
          e.smokeSummary.textContent = '';
        } else {
          const failures = checks.filter((row) => !row.ok).length;
          e.smokeSummary.style.display = 'block';
          e.smokeSummary.dataset.kind = failures ? 'error' : 'info';
          e.smokeSummary.textContent = failures
            ? `Smoke check found ${failures} failing item(s).`
            : 'Smoke check passed.';
        }
      }
      saveDraft();
    }

    function hydratePreview(notificationId, preview = {}) {
      const e = els();
      if (e.emailNotificationId) e.emailNotificationId.value = notificationId ? String(notificationId) : '';
      if (e.emailTo) e.emailTo.value = preview.to || '';
      if (e.emailSubject) e.emailSubject.value = preview.subject || '';
      if (e.emailBody) e.emailBody.value = preview.body || '';
      saveDraft();
    }

    async function runNotificationAction(action, notificationId, extra = {}) {
      if (!manageAdminEntity) throw new Error('Admin manage API is unavailable.');
      const resp = await manageAdminEntity({
        entity: 'notification',
        action,
        notification_id: notificationId,
        ...extra
      });
      if (!resp?.ok) throw new Error(resp?.error || `Notification ${action} failed`);
      return resp;
    }

    async function onNotificationTableClick(event) {
      const btn = event.target.closest('[data-notification-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-notification-action');
      const notificationId = btn.getAttribute('data-id');
      if (!notificationId) return;

      let decisionNotes = '';
      try {
        if (action === 'approve' || action === 'reject' || action === 'resolve') {
          decisionNotes = window.prompt(`Optional note for ${action}:`, '') || '';
        }
        const resp = await runNotificationAction(action, notificationId, { decision_notes: decisionNotes });
        if (resp?.preview) hydratePreview(notificationId, resp.preview);
        setSummary(`Notification ${notificationId} ${action.replace('_', ' ')} complete.`);
        renderConflictTable();
      await loadDirectory();
      } catch (err) {
        const msg = String(err?.message || 'Notification action failed.');
        if (msg.toLowerCase().includes('offline') || msg.includes('HTTP 5')) {
          window.YWIOutbox?.queueAction?.({
            scope: 'admin',
            action_type: 'admin_notification_action',
            payload: {
              entity: 'notification',
              action,
              notification_id: notificationId,
              decision_notes: decisionNotes
            },
            label: `Notification ${action}`
          });
          setSummary('Notification action saved to the admin outbox for retry.');
        } else {
          setSummary(msg, true);
        }
      }
    }

    async function onPreviewButton(action) {
      const e = els();
      const notificationId = e.emailNotificationId?.value?.trim?.() || '';
      if (!notificationId) {
        setSummary('Choose a notification first from the approval queue.', true);
        return;
      }
      try {
        const resp = await runNotificationAction(action, notificationId, {
          email_to: e.emailTo?.value || '',
          email_subject: e.emailSubject?.value || '',
          email_body: e.emailBody?.value || ''
        });
        if (resp?.preview) hydratePreview(notificationId, resp.preview);
        saveDraft();
        setSummary(
          action === 'preview_email'
            ? `Preview ready for notification ${notificationId}.`
            : `Notification ${notificationId} ${action.replace('_', ' ')} complete.`
        );
        await loadDirectory();
      } catch (err) {
        const msg = String(err?.message || 'Email action failed.');
        if (msg.toLowerCase().includes('offline') || msg.includes('HTTP 5')) {
          window.YWIOutbox?.queueAction?.({
            scope: 'admin',
            action_type: 'admin_notification_action',
            payload: {
              entity: 'notification',
              action,
              notification_id: notificationId,
              email_to: e.emailTo?.value || '',
              email_subject: e.emailSubject?.value || '',
              email_body: e.emailBody?.value || ''
            },
            label: `Email ${action}`
          });
          setSummary('Email action saved to the admin outbox for retry.');
        } else {
          setSummary(msg, true);
        }
      }
    }

    async function runSmokeCheck() {
      const e = els();
      if (e.smokeBtn) {
        e.smokeBtn.disabled = true;
        e.smokeBtn.textContent = 'Running...';
      }

      try {
        if (typeof window.YWIAPI?.runSmokeCheck === 'function') {
          const result = await window.YWIAPI.runSmokeCheck();
          renderSmokeChecks(result);
          setSummary(result?.ok ? 'Smoke check completed successfully.' : 'Smoke check completed with failures.', !result?.ok);
          return result;
        }

        const checks = [];
        const loadedScripts = Array.from(document.scripts || [])
          .map((script) => script.src || '')
          .filter(Boolean);
        checks.push({
          scope: 'shell-scripts',
          ok: loadedScripts.some((src) => src.includes('/js/bootstrap.js')),
          message: `Loaded ${loadedScripts.length} script(s).`
        });

        try {
          const cfgResp = await fetch('/js/app-config.js', { cache: 'no-store' });
          checks.push({
            scope: 'app-config',
            ok: cfgResp.ok,
            status: cfgResp.status,
            message: cfgResp.ok ? 'app-config.js reachable.' : 'app-config.js missing.'
          });
        } catch (err) {
          checks.push({
            scope: 'app-config',
            ok: false,
            message: err?.message || 'app-config.js check failed.'
          });
        }

        try {
          const compatResp = await fetch('/api/auth/bootstrap-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ smoke: true })
          });
          checks.push({
            scope: 'bootstrap-compat',
            ok: compatResp.ok,
            status: compatResp.status,
            message: compatResp.ok
              ? 'Compatibility bootstrap endpoint reachable.'
              : 'Compatibility bootstrap endpoint failed.'
          });
        } catch (err) {
          checks.push({
            scope: 'bootstrap-compat',
            ok: false,
            message: err?.message || 'Compatibility bootstrap check failed.'
          });
        }

        const diagItems = Array.isArray(window.YWIAppDiagnostics?.getItems?.())
          ? window.YWIAppDiagnostics.getItems()
          : [];
        const timingItems = Array.isArray(window.YWIModuleTimings?.getItems?.())
          ? window.YWIModuleTimings.getItems()
          : [];
        checks.push({
          scope: 'diagnostics-banner',
          ok: diagItems.length === 0,
          message: diagItems.length
            ? `${diagItems.length} diagnostic item(s) are present.`
            : 'Diagnostics banner is empty on the current boot.'
        });
        checks.push({
          scope: 'module-timings',
          ok: timingItems.length > 0,
          message: timingItems.length
            ? `Captured ${timingItems.length} timing trace(s). Latest: ${timingItems[0]?.scope || 'n/a'} in ${timingItems[0]?.duration_ms || 0} ms.`
            : 'No module timing traces have been captured yet.'
        });

        const result = { ok: checks.every((row) => row.ok), checks };
        renderSmokeChecks(result);
        setSummary(result.ok ? 'Smoke check completed successfully.' : 'Smoke check completed with failures.', !result.ok);
        return result;
      } catch (err) {
        const message = String(err?.message || 'Smoke check failed.');
        renderSmokeChecks({ ok: false, checks: [{ scope: 'smoke-check', ok: false, message }] });
        setSummary(message, true);
        return { ok: false, checks: [{ scope: 'smoke-check', ok: false, message }] };
      } finally {
        if (e.smokeBtn) {
          e.smokeBtn.disabled = false;
          e.smokeBtn.textContent = 'Run Smoke Check';
        }
      }
    }

    async function retryPendingAdminSync() {
      const e = els();
      if (e.retrySyncBtn) {
        e.retrySyncBtn.disabled = true;
        e.retrySyncBtn.textContent = 'Retrying...';
      }

      try {
        const result = await window.YWIOutbox?.retryQueuedActions?.({
          scope: 'admin',
          handlers: {
            admin_notification_action: async (payload = {}) => {
              if (!manageAdminEntity) {
                throw new Error('Admin manage API is unavailable.');
              }
              const resp = await manageAdminEntity(payload);
              if (!resp?.ok) {
                const err = new Error(resp?.error || 'Admin notification retry failed.');
                err.details = resp?.details || [];
                throw err;
              }
              return resp;
            }
          }
        });

        const summary = result || { total: 0, retried: 0, remaining: 0, conflicts: [] };
        const conflictCount = Array.isArray(summary.conflicts) ? summary.conflicts.length : 0;
        setSummary(
          summary.total
            ? `Admin sync retried ${summary.retried} of ${summary.total}. Remaining: ${summary.remaining}. Conflicts: ${conflictCount}.`
            : 'No pending admin sync items were queued.'
        );
        await loadDirectory();
        return summary;
      } catch (err) {
        setSummary(String(err?.message || 'Failed to retry pending admin sync.'), true);
        return { ok: false };
      } finally {
        if (e.retrySyncBtn) {
          e.retrySyncBtn.disabled = false;
          e.retrySyncBtn.textContent = 'Retry Pending Admin Sync';
        }
      }
    }


    function setAdminLoading(isLoading, scope = 'all') {
      const section = document.getElementById('admin');
      if (!section) return;
      section.classList.toggle('is-admin-loading', !!isLoading);
      section.dataset.loadingScope = isLoading ? String(scope || 'all') : '';
    }

    async function loadDirectory() {
      applyRoleAccess();
      if (state.locked) return;

      try {
        setAdminLoading(true, 'staged');
        let resp = {};
        let stagedScopes = ['command_center'];
        const stagedWarnings = [];

        for (let stagedIndex = 0; stagedIndex < stagedScopes.length; stagedIndex += 1) {
          const stagedScope = stagedScopes[stagedIndex];
          const startedAt = performance.now();
          try {
            const stagedResp = await loadAdminDirectory({
              ...getAdminDirectoryPagingPayload(),
              scope: stagedScope,
              timeoutMs: getAdminScopeTimeout(stagedScope)
            });
            recordAdminScopeTiming(stagedScope, startedAt, true, 'Initial staged load completed.');

            if (stagedResp && typeof stagedResp === 'object') {
              resp = {
                ...resp,
                ...stagedResp,
                pagination_meta: {
                  ...(resp.pagination_meta || {}),
                  ...(stagedResp.pagination_meta || {})
                }
              };
              mergeAdminDirectoryScopeResponse(stagedResp);
              if (stagedScope === 'command_center') {
                stagedScopes = Array.from(new Set([...stagedScopes, ...getRegisteredInitialAdminScopes()]));
              }
            }
          } catch (scopeErr) {
            const message = scopeErr?.message || 'failed';
            recordAdminScopeTiming(stagedScope, startedAt, false, message);
            stagedWarnings.push(`${stagedScope}: ${message}`);
            if (stagedScope === 'command_center') {
              stagedScopes = Array.from(new Set([...stagedScopes, ...getRegisteredInitialAdminScopes()]));
            }
          }
        }

        if (!Object.keys(resp).length) {
          const fallbackStartedAt = performance.now();
          try {
            resp = await loadAdminDirectory({
              ...getAdminDirectoryPagingPayload(),
              scope: 'all',
              timeoutMs: 90000
            });
            recordAdminScopeTiming('all', fallbackStartedAt, true, 'Emergency all-scope fallback loaded.');
          } catch (fallbackErr) {
            recordAdminScopeTiming('all', fallbackStartedAt, false, fallbackErr?.message || 'All-scope fallback failed.');
            throw fallbackErr;
          }
        } else if (stagedWarnings.length) {
          state.adminLoadWarnings = stagedWarnings;
        } else {
          state.adminLoadWarnings = [];
        }
        state.notifications = Array.isArray(resp?.notifications) ? resp.notifications : [];
        state.users = Array.isArray(resp?.users) ? resp.users : [];
        state.adminDirectoryMeta = resp?.pagination_meta || {};
        if (resp?.actor_role) state.actorRole = resp.actor_role;
        if (resp?.actor_profile_id) state.actorProfileId = resp.actor_profile_id;
        applyDirectoryPaginationMeta(state.adminDirectoryMeta);
        state.sites = Array.isArray(resp?.sites) ? resp.sites : [];
        state.assignments = Array.isArray(resp?.assignments) ? resp.assignments : [];
        state.salesOrders = Array.isArray(resp?.sales_orders) ? resp.sales_orders : [];
        state.accountingEntries = Array.isArray(resp?.accounting_entries) ? resp.accounting_entries : [];
        state.siteActivityEvents = Array.isArray(resp?.site_activity_events) ? resp.site_activity_events : [];
        state.siteActivitySummary = Array.isArray(resp?.site_activity_summary) ? resp.site_activity_summary : [];
        state.siteActivityTypeRollups = Array.isArray(resp?.site_activity_type_rollups) ? resp.site_activity_type_rollups : [];
        state.siteActivityEntityRollups = Array.isArray(resp?.site_activity_entity_rollups) ? resp.site_activity_entity_rollups : [];
        state.attendancePhotoReview = Array.isArray(resp?.attendance_photo_review) ? resp.attendance_photo_review : [];
        state.hseEvidenceReview = Array.isArray(resp?.hse_evidence_review) ? resp.hse_evidence_review : [];
        state.employeeTimeClockEntries = Array.isArray(resp?.employee_time_clock_entries) ? resp.employee_time_clock_entries : [];
        state.employeeTimeClockCurrent = Array.isArray(resp?.employee_time_clock_current) ? resp.employee_time_clock_current : [];
        state.employeeTimeClockSummary = Array.isArray(resp?.employee_time_clock_summary) ? resp.employee_time_clock_summary : [];
        state.employeeTimeAttendanceExceptions = Array.isArray(resp?.employee_time_attendance_exceptions) ? resp.employee_time_attendance_exceptions : [];
        state.employeeTimeEntryReviews = Array.isArray(resp?.employee_time_entry_reviews) ? resp.employee_time_entry_reviews : [];
        state.employeeTimeReviewQueue = Array.isArray(resp?.employee_time_review_queue) ? resp.employee_time_review_queue : [];
        state.employeeTimeReviewSummary = Array.isArray(resp?.employee_time_review_summary) ? resp.employee_time_review_summary : [];
        state.operationsDashboardSummary = Array.isArray(resp?.operations_dashboard_summary) ? resp.operations_dashboard_summary : [];
        state.serviceAgreementExecutionCandidates = Array.isArray(resp?.service_agreement_execution_candidates) ? resp.service_agreement_execution_candidates : [];
        state.serviceExecutionSchedulerSettings = Array.isArray(resp?.service_execution_scheduler_settings) ? resp.service_execution_scheduler_settings : [];
        state.serviceExecutionSchedulerStatus = Array.isArray(resp?.service_execution_scheduler_status) ? resp.service_execution_scheduler_status : [];
        state.signedContractJobKickoffCandidates = Array.isArray(resp?.signed_contract_job_kickoff_candidates) ? resp.signed_contract_job_kickoff_candidates : [];
        state.employeeTimeAttendanceExceptions = Array.isArray(resp?.employee_time_attendance_exceptions) ? resp.employee_time_attendance_exceptions : [];
        state.employeeTimeEntryReviews = Array.isArray(resp?.employee_time_entry_reviews) ? resp.employee_time_entry_reviews : [];
        state.employeeTimeReviewQueue = Array.isArray(resp?.employee_time_review_queue) ? resp.employee_time_review_queue : [];
        state.employeeTimeReviewSummary = Array.isArray(resp?.employee_time_review_summary) ? resp.employee_time_review_summary : [];
        state.operationsDashboardSummary = Array.isArray(resp?.operations_dashboard_summary) ? resp.operations_dashboard_summary : [];
        state.serviceAgreementExecutionCandidates = Array.isArray(resp?.service_agreement_execution_candidates) ? resp.service_agreement_execution_candidates : [];
        state.serviceExecutionSchedulerSettings = Array.isArray(resp?.service_execution_scheduler_settings) ? resp.service_execution_scheduler_settings : [];
        state.serviceExecutionSchedulerStatus = Array.isArray(resp?.service_execution_scheduler_status) ? resp.service_execution_scheduler_status : [];
        state.signedContractJobKickoffCandidates = Array.isArray(resp?.signed_contract_job_kickoff_candidates) ? resp.signed_contract_job_kickoff_candidates : [];
        state.serviceAreas = Array.isArray(resp?.service_areas) ? resp.service_areas : [];
        state.routes = Array.isArray(resp?.routes) ? resp.routes : [];
        state.jobs = Array.isArray(resp?.jobs) ? resp.jobs : [];
        state.routeStops = Array.isArray(resp?.route_stops) ? resp.route_stops : [];
        state.routeStopExecutions = Array.isArray(resp?.route_stop_executions) ? resp.route_stop_executions : [];
        state.routeStopExecutionAttachments = Array.isArray(resp?.route_stop_execution_attachments) ? resp.route_stop_execution_attachments : [];
        state.clients = Array.isArray(resp?.clients) ? resp.clients : [];
        state.clientSites = Array.isArray(resp?.client_sites) ? resp.client_sites : [];
        state.unitsOfMeasure = Array.isArray(resp?.units_of_measure) ? resp.units_of_measure : [];
        state.costCodes = Array.isArray(resp?.cost_codes) ? resp.cost_codes : [];
        state.taxCodes = Array.isArray(resp?.tax_codes) ? resp.tax_codes : [];
        state.servicePricingTemplates = Array.isArray(resp?.service_pricing_templates) ? resp.service_pricing_templates : [];
        state.businessTaxSettings = Array.isArray(resp?.business_tax_settings) ? resp.business_tax_settings : [];
        state.recurringServiceAgreements = Array.isArray(resp?.recurring_service_agreements) ? resp.recurring_service_agreements : [];
        state.snowEventTriggers = Array.isArray(resp?.snow_event_triggers) ? resp.snow_event_triggers : [];
        state.changeOrders = Array.isArray(resp?.change_orders) ? resp.change_orders : [];
        state.customerAssets = Array.isArray(resp?.customer_assets) ? resp.customer_assets : [];
        state.customerAssetJobLinks = Array.isArray(resp?.customer_asset_job_links) ? resp.customer_asset_job_links : [];
        state.warrantyCallbackEvents = Array.isArray(resp?.warranty_callback_events) ? resp.warranty_callback_events : [];
        state.payrollExportRuns = Array.isArray(resp?.payroll_export_runs) ? resp.payroll_export_runs : [];
        state.payrollReviewSummary = Array.isArray(resp?.payroll_review_summary) ? resp.payroll_review_summary : [];
        state.routeProfitabilitySummary = Array.isArray(resp?.route_profitability_summary) ? resp.route_profitability_summary : [];
        state.serviceContractDocuments = Array.isArray(resp?.service_contract_documents) ? resp.service_contract_documents : [];
        state.serviceAgreementProfitabilitySummary = Array.isArray(resp?.service_agreement_profitability_summary) ? resp.service_agreement_profitability_summary : [];
        state.snowEventInvoiceCandidates = Array.isArray(resp?.snow_event_invoice_candidates) ? resp.snow_event_invoice_candidates : [];
        state.callbackWarrantyDashboardSummary = Array.isArray(resp?.callback_warranty_dashboard_summary) ? resp.callback_warranty_dashboard_summary : [];
        state.payrollReviewDetail = Array.isArray(resp?.payroll_review_detail) ? resp.payroll_review_detail : [];
        state.payrollCloseReviewSummary = Array.isArray(resp?.payroll_close_review_summary) ? resp.payroll_close_review_summary : [];
        state.estimateConversionCandidates = Array.isArray(resp?.estimate_conversion_candidates) ? resp.estimate_conversion_candidates : [];
        state.jobFinancialEvents = Array.isArray(resp?.job_financial_events) ? resp.job_financial_events : [];
        state.jobFinancialRollups = Array.isArray(resp?.job_financial_rollups) ? resp.job_financial_rollups : [];
        state.materialsCatalog = Array.isArray(resp?.materials_catalog) ? resp.materials_catalog : [];
        state.equipmentMaster = Array.isArray(resp?.equipment_master) ? resp.equipment_master : [];
        state.estimates = Array.isArray(resp?.estimates) ? resp.estimates : [];
        state.estimateLines = Array.isArray(resp?.estimate_lines) ? resp.estimate_lines : [];
        state.workOrders = Array.isArray(resp?.work_orders) ? resp.work_orders : [];
        state.workOrderLines = Array.isArray(resp?.work_order_lines) ? resp.work_order_lines : [];
        state.subcontractClients = Array.isArray(resp?.subcontract_clients) ? resp.subcontract_clients : [];
        state.subcontractDispatches = Array.isArray(resp?.subcontract_dispatches) ? resp.subcontract_dispatches : [];
        state.linkedHsePackets = Array.isArray(resp?.linked_hse_packets) ? resp.linked_hse_packets : [];
        state.hsePacketEvents = Array.isArray(resp?.hse_packet_events) ? resp.hse_packet_events : [];
        state.hsePacketProofs = Array.isArray(resp?.hse_packet_proofs) ? resp.hse_packet_proofs : [];
        state.chartOfAccounts = Array.isArray(resp?.chart_of_accounts) ? resp.chart_of_accounts : [];
        state.glJournalBatches = Array.isArray(resp?.gl_journal_batches) ? resp.gl_journal_batches : [];
        state.glJournalSyncExceptions = Array.isArray(resp?.gl_journal_sync_exceptions) ? resp.gl_journal_sync_exceptions : [];
        state.glJournalEntries = Array.isArray(resp?.gl_journal_entries) ? resp.gl_journal_entries : [];
        state.apVendors = Array.isArray(resp?.ap_vendors) ? resp.ap_vendors : [];
        state.arInvoices = Array.isArray(resp?.ar_invoices) ? resp.ar_invoices : [];
        state.arPayments = Array.isArray(resp?.ar_payments) ? resp.ar_payments : [];
        state.apBills = Array.isArray(resp?.ap_bills) ? resp.ap_bills : [];
        state.apPayments = Array.isArray(resp?.ap_payments) ? resp.ap_payments : [];
        state.materialReceipts = Array.isArray(resp?.material_receipts) ? resp.material_receipts : [];
        state.materialReceiptLines = Array.isArray(resp?.material_receipt_lines) ? resp.material_receipt_lines : [];
        state.materialIssues = Array.isArray(resp?.material_issues) ? resp.material_issues : [];
        state.materialIssueLines = Array.isArray(resp?.material_issue_lines) ? resp.material_issue_lines : [];
        state.fieldUploadFailures = Array.isArray(resp?.field_upload_failures) ? resp.field_upload_failures : [];
        state.appTrafficEvents = Array.isArray(resp?.app_traffic_events) ? resp.app_traffic_events : [];
        state.backendMonitorEvents = Array.isArray(resp?.backend_monitor_events) ? resp.backend_monitor_events : [];
        state.trafficDailySummary = Array.isArray(resp?.app_traffic_daily_summary) ? resp.app_traffic_daily_summary : [];
        state.monitorThresholdAlerts = Array.isArray(resp?.monitor_threshold_alerts) ? resp.monitor_threshold_alerts : [];
        state.adminHomeCommandCenter = Array.isArray(resp?.admin_home_command_center) ? resp.admin_home_command_center : [];
        state.adminErrorHealthCenter = Array.isArray(resp?.admin_error_health_center) ? resp.admin_error_health_center : [];
        state.adminTaskInbox = Array.isArray(resp?.admin_task_inbox) ? resp.admin_task_inbox : [];
        state.appSchemaVersionStatus = Array.isArray(resp?.app_schema_version_status) ? resp.app_schema_version_status : [];
        state.roleDashboardPresets = Array.isArray(resp?.role_dashboard_presets) ? resp.role_dashboard_presets : [];
        state.adminAuditEventDirectory = Array.isArray(resp?.admin_audit_event_directory) ? resp.admin_audit_event_directory : [];
        state.adminBackupRestoreRehearsals = Array.isArray(resp?.admin_backup_restore_rehearsal_directory) ? resp.admin_backup_restore_rehearsal_directory : [];
        state.bankCsvImportSessions = Array.isArray(resp?.bank_csv_import_session_directory) ? resp.bank_csv_import_session_directory : [];
        state.adminEvidenceActionQueue = Array.isArray(resp?.admin_evidence_action_queue) ? resp.admin_evidence_action_queue : [];
        state.adminMobileActionCards = Array.isArray(resp?.admin_mobile_action_card_directory) ? resp.admin_mobile_action_card_directory : [];
        state.mobileFirstQualityGates = Array.isArray(resp?.mobile_first_quality_gates) ? resp.mobile_first_quality_gates : state.mobileFirstQualityGates;
        state.jurisdictionWordingGates = Array.isArray(resp?.jurisdiction_wording_gates) ? resp.jurisdiction_wording_gates : state.jurisdictionWordingGates;
        state.mobileTodayActionRegistry = Array.isArray(resp?.mobile_today_action_registry) ? resp.mobile_today_action_registry : state.mobileTodayActionRegistry;
        state.mobilePwaInstallQualityGates = Array.isArray(resp?.mobile_pwa_install_quality_gates) ? resp.mobile_pwa_install_quality_gates : state.mobilePwaInstallQualityGates;
        state.mobileFormStepperRegistry = Array.isArray(resp?.mobile_form_stepper_registry) ? resp.mobile_form_stepper_registry : state.mobileFormStepperRegistry;
        state.mobileFormQualityGates = Array.isArray(resp?.mobile_form_quality_gates) ? resp.mobile_form_quality_gates : state.mobileFormQualityGates;
        state.adminListPaginationSettings = Array.isArray(resp?.admin_list_pagination_settings) ? resp.admin_list_pagination_settings : [];
        state.adminPanelLoadDiagnostics = Array.isArray(resp?.admin_panel_load_diagnostics) ? resp.admin_panel_load_diagnostics : state.adminPanelLoadDiagnostics;
        state.adminFastPathScopeRegistry = Array.isArray(resp?.admin_fast_path_scope_registry) ? resp.admin_fast_path_scope_registry : state.adminFastPathScopeRegistry;
        state.adminActionConfirmationRules = Array.isArray(resp?.admin_action_confirmation_rules) ? resp.admin_action_confirmation_rules : state.adminActionConfirmationRules;
        state.adminActionPermissionRegistry = Array.isArray(resp?.admin_action_permission_registry) ? resp.admin_action_permission_registry : state.adminActionPermissionRegistry;
        state.adminPanelRetryPolicy = Array.isArray(resp?.admin_panel_retry_policy) ? resp.admin_panel_retry_policy : state.adminPanelRetryPolicy;
        state.adminSchemaPreflightChecks = Array.isArray(resp?.admin_schema_preflight_checks) ? resp.admin_schema_preflight_checks : state.adminSchemaPreflightChecks;
        state.adminDeploymentChecklist = Array.isArray(resp?.admin_deployment_checklist) ? resp.admin_deployment_checklist : state.adminDeploymentChecklist;
        state.adminFunctionReadinessChecks = Array.isArray(resp?.admin_function_readiness_checks) ? resp.admin_function_readiness_checks : state.adminFunctionReadinessChecks;
        state.appDeploymentBundleChecks = Array.isArray(resp?.app_deployment_bundle_checks) ? resp.app_deployment_bundle_checks : state.appDeploymentBundleChecks;
        state.appPublicSeoChecks = Array.isArray(resp?.app_public_seo_checks) ? resp.app_public_seo_checks : state.appPublicSeoChecks;
        state.appRuntimeFallbackChecks = Array.isArray(resp?.app_runtime_fallback_checks) ? resp.app_runtime_fallback_checks : state.appRuntimeFallbackChecks;
        state.appRoadmapActionSteps = Array.isArray(resp?.app_roadmap_action_steps) ? resp.app_roadmap_action_steps : state.appRoadmapActionSteps;
        state.appDepthReviewQueue = Array.isArray(resp?.app_depth_review_queue) ? resp.app_depth_review_queue : state.appDepthReviewQueue;
        state.appDataMigrationCandidates = Array.isArray(resp?.app_data_migration_candidates) ? resp.app_data_migration_candidates : state.appDataMigrationCandidates;
        state.appSchemaDocumentationSyncChecks = Array.isArray(resp?.app_schema_documentation_sync_checks) ? resp.app_schema_documentation_sync_checks : state.appSchemaDocumentationSyncChecks;
        state.appPublicRouteSeoRegistry = Array.isArray(resp?.app_public_route_seo_registry) ? resp.app_public_route_seo_registry : state.appPublicRouteSeoRegistry;
        state.appInternalLinkSuggestionQueue = Array.isArray(resp?.app_internal_link_suggestion_queue) ? resp.app_internal_link_suggestion_queue : state.appInternalLinkSuggestionQueue;
        state.appCssComponentTokenInventory = Array.isArray(resp?.app_css_component_token_inventory) ? resp.app_css_component_token_inventory : state.appCssComponentTokenInventory;
        state.appMobileFieldActionQueue = Array.isArray(resp?.app_mobile_field_action_queue) ? resp.app_mobile_field_action_queue : state.appMobileFieldActionQueue;
        state.appReleaseManifestChecks = Array.isArray(resp?.app_release_manifest_checks) ? resp.app_release_manifest_checks : state.appReleaseManifestChecks;
        state.appPaymentApplicationActionRegistry = Array.isArray(resp?.app_payment_application_action_registry) ? resp.app_payment_application_action_registry : state.appPaymentApplicationActionRegistry;
        state.appAccountingCloseControlQueue = Array.isArray(resp?.app_accounting_close_control_queue) ? resp.app_accounting_close_control_queue : state.appAccountingCloseControlQueue;
        state.appEquipmentAccountabilityActionQueue = Array.isArray(resp?.app_equipment_accountability_action_queue) ? resp.app_equipment_accountability_action_queue : state.appEquipmentAccountabilityActionQueue;
        state.appPublicSeoPublicationQueue = Array.isArray(resp?.app_public_seo_publication_queue) ? resp.app_public_seo_publication_queue : state.appPublicSeoPublicationQueue;
        state.appFallbackObservabilityMatrix = Array.isArray(resp?.app_fallback_observability_matrix) ? resp.app_fallback_observability_matrix : state.appFallbackObservabilityMatrix;
        state.hsePacketActionItems = Array.isArray(resp?.hse_packet_action_items) ? resp.hse_packet_action_items : [];
        state.hseDashboardSummary = Array.isArray(resp?.hse_dashboard_summary) ? resp.hse_dashboard_summary : [];
        state.accountingReviewSummary = Array.isArray(resp?.accounting_review_summary) ? resp.accounting_review_summary : [];
        state.counts = {
          users: state.directoryPagination.people?.total || state.users.length,
          sites: Array.isArray(resp?.sites) ? resp.sites.length : 0,
          assignments: state.assignments.length,
          orders: state.salesOrders.length
        };

        const e = els();
        if (e.usersCount) e.usersCount.textContent = String(state.counts.users);
        if (e.sitesCount) e.sitesCount.textContent = String(state.counts.sites);
        if (e.assignmentsCount) e.assignmentsCount.textContent = String(state.counts.assignments);
        if (e.ordersCount) e.ordersCount.textContent = String(state.counts.orders);

        renderStaffDirectory();
        renderProfileOptions();
        renderAssignmentWorkbench();
        renderCatalogManager();
        renderBackboneTable();
        fillBackboneForm(getSelectedBackboneRecord());
        renderNotifications();
        renderOrders();
        renderSiteActivityTable();
        renderAdminCommandCenter();
        renderSavedFilters();
        renderAdminHealthCenter();
        renderAdminTaskInbox();
        renderGuidedCloseCenter();
        renderEvidenceManager();
        renderProductionReadiness();
        await refreshSelectors();

        saveAdminCache(resp);
        const outboxSummary = window.YWIOutbox?.getActionSummary?.('admin') || { total: 0, conflicts: 0 };
        const stagedWarningText = Array.isArray(state.adminLoadWarnings) && state.adminLoadWarnings.length
          ? ` Some panels need retry: ${state.adminLoadWarnings.join('; ')}.`
          : '';
        setAdminLoading(false);
        setSummary(
          state.manageLocked
            ? `Read-only admin view loaded. Admin role is required for approval actions.${stagedWarningText}`
            : `Admin view loaded in smaller panels.${outboxSummary.total ? ` Pending admin sync: ${outboxSummary.total} item(s), ${outboxSummary.conflicts || 0} conflict(s).` : ''}${stagedWarningText}`
        );
      } catch (err) {
        setAdminLoading(false);
        const cached = loadAdminCache();
        if (cached?.payload) {
          const resp = cached.payload;
          state.notifications = Array.isArray(resp?.notifications) ? resp.notifications : [];
          state.users = Array.isArray(resp?.users) ? resp.users : [];
          state.sites = Array.isArray(resp?.sites) ? resp.sites : [];
          state.assignments = Array.isArray(resp?.assignments) ? resp.assignments : [];
          state.salesOrders = Array.isArray(resp?.sales_orders) ? resp.sales_orders : [];
          state.accountingEntries = Array.isArray(resp?.accounting_entries) ? resp.accounting_entries : [];
          state.siteActivityEvents = Array.isArray(resp?.site_activity_events) ? resp.site_activity_events : [];
          state.siteActivitySummary = Array.isArray(resp?.site_activity_summary) ? resp.site_activity_summary : [];
          state.siteActivityTypeRollups = Array.isArray(resp?.site_activity_type_rollups) ? resp.site_activity_type_rollups : [];
          state.siteActivityEntityRollups = Array.isArray(resp?.site_activity_entity_rollups) ? resp.site_activity_entity_rollups : [];
        state.attendancePhotoReview = Array.isArray(resp?.attendance_photo_review) ? resp.attendance_photo_review : [];
        state.hseEvidenceReview = Array.isArray(resp?.hse_evidence_review) ? resp.hse_evidence_review : [];
          state.employeeTimeClockEntries = Array.isArray(resp?.employee_time_clock_entries) ? resp.employee_time_clock_entries : [];
          state.employeeTimeClockCurrent = Array.isArray(resp?.employee_time_clock_current) ? resp.employee_time_clock_current : [];
          state.employeeTimeClockSummary = Array.isArray(resp?.employee_time_clock_summary) ? resp.employee_time_clock_summary : [];
          state.employeeTimeAttendanceExceptions = Array.isArray(resp?.employee_time_attendance_exceptions) ? resp.employee_time_attendance_exceptions : [];
          state.employeeTimeEntryReviews = Array.isArray(resp?.employee_time_entry_reviews) ? resp.employee_time_entry_reviews : [];
        state.employeeTimeReviewQueue = Array.isArray(resp?.employee_time_review_queue) ? resp.employee_time_review_queue : [];
        state.employeeTimeReviewSummary = Array.isArray(resp?.employee_time_review_summary) ? resp.employee_time_review_summary : [];
          state.operationsDashboardSummary = Array.isArray(resp?.operations_dashboard_summary) ? resp.operations_dashboard_summary : [];
          state.serviceAgreementExecutionCandidates = Array.isArray(resp?.service_agreement_execution_candidates) ? resp.service_agreement_execution_candidates : [];
        state.serviceExecutionSchedulerSettings = Array.isArray(resp?.service_execution_scheduler_settings) ? resp.service_execution_scheduler_settings : [];
        state.serviceExecutionSchedulerStatus = Array.isArray(resp?.service_execution_scheduler_status) ? resp.service_execution_scheduler_status : [];
        state.signedContractJobKickoffCandidates = Array.isArray(resp?.signed_contract_job_kickoff_candidates) ? resp.signed_contract_job_kickoff_candidates : [];
          state.serviceAreas = Array.isArray(resp?.service_areas) ? resp.service_areas : [];
          state.routes = Array.isArray(resp?.routes) ? resp.routes : [];
          state.jobs = Array.isArray(resp?.jobs) ? resp.jobs : [];
          state.routeStops = Array.isArray(resp?.route_stops) ? resp.route_stops : [];
          state.routeStopExecutions = Array.isArray(resp?.route_stop_executions) ? resp.route_stop_executions : [];
          state.routeStopExecutionAttachments = Array.isArray(resp?.route_stop_execution_attachments) ? resp.route_stop_execution_attachments : [];
          state.clients = Array.isArray(resp?.clients) ? resp.clients : [];
          state.clientSites = Array.isArray(resp?.client_sites) ? resp.client_sites : [];
          state.unitsOfMeasure = Array.isArray(resp?.units_of_measure) ? resp.units_of_measure : [];
          state.costCodes = Array.isArray(resp?.cost_codes) ? resp.cost_codes : [];
          state.taxCodes = Array.isArray(resp?.tax_codes) ? resp.tax_codes : [];
          state.servicePricingTemplates = Array.isArray(resp?.service_pricing_templates) ? resp.service_pricing_templates : [];
          state.businessTaxSettings = Array.isArray(resp?.business_tax_settings) ? resp.business_tax_settings : [];
          state.recurringServiceAgreements = Array.isArray(resp?.recurring_service_agreements) ? resp.recurring_service_agreements : [];
          state.snowEventTriggers = Array.isArray(resp?.snow_event_triggers) ? resp.snow_event_triggers : [];
          state.changeOrders = Array.isArray(resp?.change_orders) ? resp.change_orders : [];
          state.customerAssets = Array.isArray(resp?.customer_assets) ? resp.customer_assets : [];
          state.customerAssetJobLinks = Array.isArray(resp?.customer_asset_job_links) ? resp.customer_asset_job_links : [];
          state.warrantyCallbackEvents = Array.isArray(resp?.warranty_callback_events) ? resp.warranty_callback_events : [];
          state.payrollExportRuns = Array.isArray(resp?.payroll_export_runs) ? resp.payroll_export_runs : [];
          state.payrollReviewSummary = Array.isArray(resp?.payroll_review_summary) ? resp.payroll_review_summary : [];
          state.routeProfitabilitySummary = Array.isArray(resp?.route_profitability_summary) ? resp.route_profitability_summary : [];
          state.serviceContractDocuments = Array.isArray(resp?.service_contract_documents) ? resp.service_contract_documents : [];
          state.serviceAgreementProfitabilitySummary = Array.isArray(resp?.service_agreement_profitability_summary) ? resp.service_agreement_profitability_summary : [];
          state.snowEventInvoiceCandidates = Array.isArray(resp?.snow_event_invoice_candidates) ? resp.snow_event_invoice_candidates : [];
          state.callbackWarrantyDashboardSummary = Array.isArray(resp?.callback_warranty_dashboard_summary) ? resp.callback_warranty_dashboard_summary : [];
          state.payrollReviewDetail = Array.isArray(resp?.payroll_review_detail) ? resp.payroll_review_detail : [];
        state.payrollCloseReviewSummary = Array.isArray(resp?.payroll_close_review_summary) ? resp.payroll_close_review_summary : [];
          state.estimateConversionCandidates = Array.isArray(resp?.estimate_conversion_candidates) ? resp.estimate_conversion_candidates : [];
          state.jobFinancialEvents = Array.isArray(resp?.job_financial_events) ? resp.job_financial_events : [];
          state.jobFinancialRollups = Array.isArray(resp?.job_financial_rollups) ? resp.job_financial_rollups : [];
          state.materialsCatalog = Array.isArray(resp?.materials_catalog) ? resp.materials_catalog : [];
          state.equipmentMaster = Array.isArray(resp?.equipment_master) ? resp.equipment_master : [];
          state.estimates = Array.isArray(resp?.estimates) ? resp.estimates : [];
          state.estimateLines = Array.isArray(resp?.estimate_lines) ? resp.estimate_lines : [];
          state.workOrders = Array.isArray(resp?.work_orders) ? resp.work_orders : [];
          state.workOrderLines = Array.isArray(resp?.work_order_lines) ? resp.work_order_lines : [];
          state.subcontractClients = Array.isArray(resp?.subcontract_clients) ? resp.subcontract_clients : [];
          state.subcontractDispatches = Array.isArray(resp?.subcontract_dispatches) ? resp.subcontract_dispatches : [];
          state.linkedHsePackets = Array.isArray(resp?.linked_hse_packets) ? resp.linked_hse_packets : [];
          state.hsePacketEvents = Array.isArray(resp?.hse_packet_events) ? resp.hse_packet_events : [];
          state.hsePacketProofs = Array.isArray(resp?.hse_packet_proofs) ? resp.hse_packet_proofs : [];
          state.chartOfAccounts = Array.isArray(resp?.chart_of_accounts) ? resp.chart_of_accounts : [];
          state.glJournalBatches = Array.isArray(resp?.gl_journal_batches) ? resp.gl_journal_batches : [];
          state.glJournalSyncExceptions = Array.isArray(resp?.gl_journal_sync_exceptions) ? resp.gl_journal_sync_exceptions : [];
          state.glJournalEntries = Array.isArray(resp?.gl_journal_entries) ? resp.gl_journal_entries : [];
          state.apVendors = Array.isArray(resp?.ap_vendors) ? resp.ap_vendors : [];
          state.arInvoices = Array.isArray(resp?.ar_invoices) ? resp.ar_invoices : [];
          state.arPayments = Array.isArray(resp?.ar_payments) ? resp.ar_payments : [];
          state.apBills = Array.isArray(resp?.ap_bills) ? resp.ap_bills : [];
          state.apPayments = Array.isArray(resp?.ap_payments) ? resp.ap_payments : [];
          state.bankAccounts = Array.isArray(resp?.bank_accounts) ? resp.bank_accounts : [];
          state.accountingPeriodCloses = Array.isArray(resp?.accounting_period_closes) ? resp.accounting_period_closes : [];
          state.salesTaxFilings = Array.isArray(resp?.sales_tax_filings) ? resp.sales_tax_filings : [];
          state.payrollRemittanceRuns = Array.isArray(resp?.payroll_remittance_runs) ? resp.payroll_remittance_runs : [];
          state.bankStatementImports = Array.isArray(resp?.bank_statement_imports) ? resp.bank_statement_imports : [];
          state.bankReconciliationSessions = Array.isArray(resp?.bank_reconciliation_sessions) ? resp.bank_reconciliation_sessions : [];
          state.bankReconciliationItems = Array.isArray(resp?.bank_reconciliation_items) ? resp.bank_reconciliation_items : [];
          state.bankReconciliationMatchScored = Array.isArray(resp?.bank_reconciliation_match_scored) ? resp.bank_reconciliation_match_scored : [];
          state.arPaymentApplications = Array.isArray(resp?.ar_payment_applications) ? resp.ar_payment_applications : [];
          state.apPaymentApplications = Array.isArray(resp?.ap_payment_applications) ? resp.ap_payment_applications : [];
          state.accountantHandoffExports = Array.isArray(resp?.accountant_handoff_exports) ? resp.accountant_handoff_exports : [];
          state.accountantHandoffPackages = Array.isArray(resp?.accountant_handoff_packages) ? resp.accountant_handoff_packages : [];
          state.accountingCloseAdminControlDashboard = Array.isArray(resp?.accounting_close_admin_control_dashboard) ? resp.accounting_close_admin_control_dashboard : [];
          state.accountingReconciliationManualReviewQueue = Array.isArray(resp?.accounting_reconciliation_manual_review_queue) ? resp.accounting_reconciliation_manual_review_queue : [];
          state.accountingClosePackageDeliveryQueue = Array.isArray(resp?.accounting_close_package_delivery_queue) ? resp.accounting_close_package_delivery_queue : [];
          state.materialReceipts = Array.isArray(resp?.material_receipts) ? resp.material_receipts : [];
          state.materialReceiptLines = Array.isArray(resp?.material_receipt_lines) ? resp.material_receipt_lines : [];
          state.materialIssues = Array.isArray(resp?.material_issues) ? resp.material_issues : [];
          state.materialIssueLines = Array.isArray(resp?.material_issue_lines) ? resp.material_issue_lines : [];
          state.fieldUploadFailures = Array.isArray(resp?.field_upload_failures) ? resp.field_upload_failures : [];
          state.appTrafficEvents = Array.isArray(resp?.app_traffic_events) ? resp.app_traffic_events : [];
          state.backendMonitorEvents = Array.isArray(resp?.backend_monitor_events) ? resp.backend_monitor_events : [];
          state.trafficDailySummary = Array.isArray(resp?.app_traffic_daily_summary) ? resp.app_traffic_daily_summary : [];
          state.monitorThresholdAlerts = Array.isArray(resp?.monitor_threshold_alerts) ? resp.monitor_threshold_alerts : [];
          state.adminHomeCommandCenter = Array.isArray(resp?.admin_home_command_center) ? resp.admin_home_command_center : [];
          state.adminErrorHealthCenter = Array.isArray(resp?.admin_error_health_center) ? resp.admin_error_health_center : [];
          state.adminTaskInbox = Array.isArray(resp?.admin_task_inbox) ? resp.admin_task_inbox : [];
          state.appSchemaVersionStatus = Array.isArray(resp?.app_schema_version_status) ? resp.app_schema_version_status : [];
          state.roleDashboardPresets = Array.isArray(resp?.role_dashboard_presets) ? resp.role_dashboard_presets : [];
          state.hsePacketActionItems = Array.isArray(resp?.hse_packet_action_items) ? resp.hse_packet_action_items : [];
          state.hseDashboardSummary = Array.isArray(resp?.hse_dashboard_summary) ? resp.hse_dashboard_summary : [];
          state.accountingReviewSummary = Array.isArray(resp?.accounting_review_summary) ? resp.accounting_review_summary : [];
          renderStaffDirectory();
          renderProfileOptions();
          renderAssignmentWorkbench();
          renderCatalogManager();
          renderBackboneTable();
          fillBackboneForm(getSelectedBackboneRecord());
          renderNotifications();
          renderOrders();
          renderSiteActivityTable();
          renderAdminCommandCenter();
          renderAdminHealthCenter();
          renderAdminTaskInbox();
          await refreshSelectors();
          setSummary(`Live admin load failed. Showing cached admin data from ${cached.savedAt || 'an earlier session'}.`, true);
          return;
        }
        setSummary(err?.message || 'Failed to load admin data.', true);
      }
    }

    function clearDirectory() {
      state.notifications = [];
      state.sites = [];
      state.assignments = [];
      state.selectors = { profiles: [], sites: [], assignments: [], positions: [], trades: [], staffTiers: [], seniorityLevels: [], employmentStatuses: [], jobTypes: [], units: [], costCodes: [], serviceAreas: [], routes: [], jobs: [], routeStops: [], routeStopExecutions: [], routeStopExecutionAttachments: [], clients: [], clientSites: [], materials: [], equipmentMaster: [], estimates: [], estimateLines: [], workOrders: [], workOrderLines: [], subcontractClients: [], subcontractDispatches: [], linkedHsePackets: [], hsePacketEvents: [], hsePacketProofs: [], glAccounts: [], glJournalBatches: [], glJournalEntries: [], vendors: [], arInvoices: [], arPayments: [], apBills: [], apPayments: [], materialReceipts: [], materialReceiptLines: [], materialIssues: [], materialIssueLines: [], trafficDailySummary: [], monitorThresholdAlerts: [], adminHomeCommandCenter: [], adminErrorHealthCenter: [], adminTaskInbox: [], appSchemaVersionStatus: [], roleDashboardPresets: [], hsePacketActionItems: [], hseDashboardSummary: [], accountingReviewSummary: [], jobFinancialEvents: [], jobFinancialRollups: [], recurringServiceAgreements: [], snowEventTriggers: [], changeOrders: [], customerAssets: [], customerAssetJobLinks: [], warrantyCallbackEvents: [], payrollExportRuns: [], payrollReviewSummary: [], routeProfitabilitySummary: [], serviceContractDocuments: [], serviceAgreementProfitabilitySummary: [], snowEventInvoiceCandidates: [], callbackWarrantyDashboardSummary: [], payrollReviewDetail: [], estimateConversionCandidates: [], serviceExecutionSchedulerSettings: [], serviceExecutionSchedulerStatus: [], signedContractJobKickoffCandidates: [] };
      state.employeeTimeClockEntries = [];
      state.employeeTimeClockCurrent = [];
      state.employeeTimeClockSummary = [];
      state.employeeTimeAttendanceExceptions = [];
      state.employeeTimeEntryReviews = [];
      state.operationsDashboardSummary = [];
      state.serviceAgreementExecutionCandidates = [];
      state.serviceAreas = [];
      state.routes = [];
      state.clients = [];
      state.clientSites = [];
      state.unitsOfMeasure = [];
      state.costCodes = [];
      state.materialsCatalog = [];
      state.equipmentMaster = [];
      state.estimates = [];
      state.workOrders = [];
      state.subcontractClients = [];
      state.subcontractDispatches = [];
      state.chartOfAccounts = [];
      state.apVendors = [];
      state.arInvoices = [];
      state.arPayments = [];
      state.apBills = [];
      state.apPayments = [];
      state.bankAccounts = [];
      state.accountingPeriodCloses = [];
      state.salesTaxFilings = [];
      state.payrollRemittanceRuns = [];
      state.bankStatementImports = [];
      state.bankReconciliationSessions = [];
      state.bankReconciliationItems = [];
      state.bankReconciliationMatchScored = [];
      state.arPaymentApplications = [];
      state.apPaymentApplications = [];
      state.accountantHandoffExports = [];
      state.accountantHandoffPackages = [];
      state.accountingCloseAdminControlDashboard = [];
      state.accountingReconciliationManualReviewQueue = [];
      state.accountingClosePackageDeliveryQueue = [];
      state.adminHomeCommandCenter = [];
      state.adminErrorHealthCenter = [];
      state.adminTaskInbox = [];
      state.appSchemaVersionStatus = [];
      state.roleDashboardPresets = [];
      state.apBills = [];
      renderNotifications();
      const e = els();
      if (e.usersCount) e.usersCount.textContent = '0';
      if (e.sitesCount) e.sitesCount.textContent = '0';
      if (e.assignmentsCount) e.assignmentsCount.textContent = '0';
      if (e.notificationsCount) e.notificationsCount.textContent = '0';
      if (e.ordersCount) e.ordersCount.textContent = '0';
      hydratePreview('', {});
      renderOrders();
      renderBackboneTable();
      fillBackboneForm(null);
      renderSmokeChecks({ checks: [] });
      renderAdminCommandCenter();
      renderAdminHealthCenter();
      renderAdminTaskInbox();
    }

    function getCatalogRows(type) {
      const map = {
        position: state.selectors.positions || [],
        trade: state.selectors.trades || [],
        staff_tier: state.selectors.staffTiers || [],
        seniority: state.selectors.seniorityLevels || [],
        employment_status: state.selectors.employmentStatuses || [],
        job_type: state.selectors.jobTypes || []
      };
      return Array.isArray(map[type]) ? map[type] : [];
    }

    function optionList(rows, valueKey = 'id', labelFn = null, placeholder = 'Select') {
      const items = Array.isArray(rows) ? rows : [];
      const toLabel = labelFn || ((row) => row?.name || row?.full_name || row?.email || row?.site_code || row?.id || '');
      return `<option value="">${escHtml(placeholder)}</option>` + items.map((row) => `<option value="${escHtml(row?.[valueKey] ?? '')}">${escHtml(toLabel(row))}</option>`).join('');
    }

    function setSelectValue(el, value) {
      if (!el) return;
      const normalized = value == null ? '' : String(value);
      el.value = normalized;
      if (el.value !== normalized) el.value = '';
    }



    const BACKBONE_CONFIG = {
      unit_of_measure: { label: 'Units of Measure', rowsKey: 'unitsOfMeasure', valueKey: 'id', labelField: 'name', fields: [
        { name: 'code', label: 'Code', type: 'text', required: true },
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'category', label: 'Category', type: 'text' },
        { name: 'sort_order', label: 'Sort Order', type: 'number' },
        { name: 'is_active', label: 'Active', type: 'checkbox' }
      ], columns: [['code','Code'], ['name','Name'], ['category','Category'], ['is_active','Active']] },
      cost_code: { label: 'Cost Codes', rowsKey:'costCodes', valueKey:'id', labelField:'name', fields: [
        { name:'code', label:'Code', type:'text', required:true }, { name:'name', label:'Name', type:'text', required:true },
        { name:'category', label:'Category', type:'text' }, { name:'description', label:'Description', type:'textarea' }, { name:'is_active', label:'Active', type:'checkbox' }
      ], columns:[['code','Code'],['name','Name'],['category','Category'],['is_active','Active']] },
      tax_code: { label:'Tax Codes', rowsKey:'taxCodes', valueKey:'id', labelField:'name', fields:[
        { name:'code', label:'Code', type:'text', required:true }, { name:'name', label:'Name', type:'text', required:true },
        { name:'tax_type', label:'Tax Type', type:'select', options:[['hst','HST'],['gst','GST'],['pst','PST'],['qst','QST'],['zero_rated','Zero Rated'],['exempt','Exempt'],['other','Other']] },
        { name:'province_code', label:'Province', type:'text' }, { name:'country_code', label:'Country', type:'text' },
        { name:'rate_percent', label:'Rate %', type:'number' }, { name:'applies_to', label:'Applies To', type:'select', options:[['sale','Sale'],['purchase','Purchase'],['both','Both']] },
        { name:'is_default', label:'Default', type:'checkbox' }, { name:'is_active', label:'Active', type:'checkbox' }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['code','Code'],['name','Name'],['tax_type','Type'],['rate_percent','Rate %'],['applies_to','Applies To']] },
      business_tax_setting: { label:'Business Tax Settings', rowsKey:'businessTaxSettings', valueKey:'id', labelField:'profile_name', fields:[
        { name:'profile_name', label:'Profile Name', type:'text', required:true }, { name:'province_code', label:'Province', type:'text' }, { name:'country_code', label:'Country', type:'text' },
        { name:'currency_code', label:'Currency', type:'text' }, { name:'default_sales_tax_code_id', label:'Default Sales Tax', type:'select', source:'taxCodes' }, { name:'default_purchase_tax_code_id', label:'Default Purchase Tax', type:'select', source:'taxCodes' },
        { name:'hst_registration_number', label:'HST Number', type:'text' }, { name:'fiscal_year_end_mmdd', label:'Fiscal Year End', type:'text' }, { name:'small_supplier_flag', label:'Small Supplier', type:'checkbox' }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['profile_name','Profile'],['province_code','Province'],['currency_code','Currency'],['small_supplier_flag','Small Supplier']] },
      service_pricing_template: { label:'Service Pricing Templates', rowsKey:'servicePricingTemplates', valueKey:'id', labelField:'template_name', fields:[
        { name:'template_code', label:'Template Code', type:'text', required:true }, { name:'template_name', label:'Template Name', type:'text', required:true },
        { name:'job_family', label:'Job Family', type:'text' }, { name:'project_scope', label:'Project Scope', type:'text' }, { name:'service_pattern', label:'Service Pattern', type:'text' },
        { name:'default_schedule_mode', label:'Schedule Mode', type:'select', options:[['standalone','Standalone'],['one_time','One Time'],['recurring','Recurring'],['open_end','Open End']] },
        { name:'default_estimated_visit_minutes', label:'Visit Minutes', type:'number' }, { name:'default_estimated_duration_hours', label:'Duration Hours', type:'number' }, { name:'default_estimated_duration_days', label:'Duration Days', type:'number' },
        { name:'default_estimated_cost_total', label:'Estimated Cost', type:'number' }, { name:'default_quoted_charge_total', label:'Quoted Charge', type:'number' },
        { name:'default_pricing_method', label:'Pricing Method', type:'select', options:[['manual','Manual'],['markup','Markup'],['margin','Margin'],['fixed','Fixed']] }, { name:'default_markup_percent', label:'Markup %', type:'number' },
        { name:'default_discount_mode', label:'Discount Mode', type:'select', options:[['none','None'],['percent','Percent'],['fixed','Fixed'],['tiered','Tiered']] }, { name:'default_discount_value', label:'Discount Value', type:'number' },
        { name:'sales_tax_code_id', label:'Sales Tax Code', type:'select', source:'taxCodes' }, { name:'notes', label:'Notes', type:'textarea' }, { name:'is_active', label:'Active', type:'checkbox' }
      ], columns:[['template_code','Code'],['template_name','Template'],['job_family','Family'],['default_quoted_charge_total','Charge'],['sales_tax_code_id','Tax']] },
      recurring_service_agreement: { label:'Recurring Service Agreements', rowsKey:'recurringServiceAgreements', valueKey:'id', labelField:'agreement_code', fields:[
        { name:'agreement_code', label:'Agreement Code', type:'text', required:true }, { name:'client_id', label:'Client', type:'select', source:'clients' }, { name:'client_site_id', label:'Client Site', type:'select', source:'clientSites' },
        { name:'service_pricing_template_id', label:'Pricing Template', type:'select', source:'servicePricingTemplates' }, { name:'route_id', label:'Route', type:'select', source:'routes' }, { name:'crew_id', label:'Crew', type:'text' }, { name:'tax_code_id', label:'Tax Code', type:'select', source:'taxCodes' },
        { name:'estimate_id', label:'Source Estimate', type:'select', source:'estimates' }, { name:'contract_document_id', label:'Contract Document', type:'select', source:'serviceContractDocuments' },
        { name:'service_name', label:'Service Name', type:'text', required:true }, { name:'agreement_status', label:'Status', type:'select', options:[['draft','Draft'],['active','Active'],['paused','Paused'],['completed','Completed'],['cancelled','Cancelled']] },
        { name:'billing_method', label:'Billing Method', type:'select', options:[['per_visit','Per Visit'],['flat_period','Flat Period'],['seasonal','Seasonal'],['event_trigger','Event Trigger'],['time_and_material','Time & Material']] },
        { name:'service_pattern', label:'Service Pattern', type:'text' }, { name:'recurrence_basis', label:'Recurrence Basis', type:'text' }, { name:'recurrence_rule', label:'Recurrence Rule', type:'text' }, { name:'recurrence_interval', label:'Recurrence Interval', type:'number' },
        { name:'start_date', label:'Start Date', type:'date' }, { name:'end_date', label:'End Date', type:'date' }, { name:'open_end_date', label:'Open End Date', type:'checkbox' },
        { name:'visit_estimated_minutes', label:'Visit Minutes', type:'number' }, { name:'visit_estimated_duration_hours', label:'Visit Hours', type:'number' }, { name:'visit_cost_total', label:'Visit Cost', type:'number' }, { name:'visit_charge_total', label:'Visit Charge', type:'number' },
        { name:'markup_percent', label:'Markup %', type:'number' }, { name:'discount_mode', label:'Discount Mode', type:'select', options:[['none','None'],['percent','Percent'],['fixed','Fixed'],['tiered','Tiered']] }, { name:'discount_value', label:'Discount Value', type:'number' }, { name:'tiered_discount_notes', label:'Tiered Discount Notes', type:'textarea' },
        { name:'event_trigger_type', label:'Event Trigger', type:'select', options:[['','None'],['snow_cm','Snow CM'],['snow_event','Snow Event'],['ice_event','Ice Event'],['manual','Manual']] }, { name:'snow_trigger_threshold_cm', label:'Snow Threshold CM', type:'number' }, { name:'trigger_notes', label:'Trigger Notes', type:'textarea' },
        { name:'pricing_notes', label:'Pricing Notes', type:'textarea' }, { name:'service_notes', label:'Service Notes', type:'textarea' }, { name:'agreement_notes', label:'Agreement Notes', type:'textarea' }
      ], columns:[['agreement_code','Agreement'],['service_name','Service'],['agreement_status','Status'],['visit_charge_total','Visit Charge'],['event_trigger_type','Trigger']] },
      snow_event_trigger: { label:'Snow Event Triggers', rowsKey:'snowEventTriggers', valueKey:'id', labelField:'event_label', fields:[
        { name:'agreement_id', label:'Agreement', type:'select', source:'recurringServiceAgreements', required:true }, { name:'event_date', label:'Event Date', type:'date' }, { name:'event_label', label:'Event Label', type:'text' },
        { name:'snowfall_cm', label:'Snowfall CM', type:'number' }, { name:'threshold_cm', label:'Threshold CM', type:'number' }, { name:'trigger_met', label:'Trigger Met', type:'checkbox' }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['agreement_id','Agreement'],['event_date','Date'],['snowfall_cm','Snowfall'],['trigger_met','Triggered']] },
      change_order: { label:'Change Orders', rowsKey:'changeOrders', valueKey:'id', labelField:'change_order_number', fields:[
        { name:'job_id', label:'Job', type:'select', source:'jobs', required:true }, { name:'agreement_id', label:'Agreement', type:'select', source:'recurringServiceAgreements' }, { name:'change_order_number', label:'Change Order Number', type:'text', required:true },
        { name:'status', label:'Status', type:'select', options:[['draft','Draft'],['requested','Requested'],['approved','Approved'],['rejected','Rejected'],['completed','Completed'],['void','Void']] }, { name:'requested_at', label:'Requested At', type:'datetime-local' }, { name:'approved_at', label:'Approved At', type:'datetime-local' }, { name:'approved_by_profile_id', label:'Approved By', type:'select', source:'profiles' },
        { name:'scope_summary', label:'Scope Summary', type:'textarea', required:true }, { name:'reason', label:'Reason', type:'textarea' }, { name:'estimated_cost_delta', label:'Estimated Cost Delta', type:'number' }, { name:'estimated_charge_delta', label:'Estimated Charge Delta', type:'number' }, { name:'actual_cost_delta', label:'Actual Cost Delta', type:'number' }, { name:'actual_charge_delta', label:'Actual Charge Delta', type:'number' }, { name:'tax_code_id', label:'Tax Code', type:'select', source:'taxCodes' }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['change_order_number','Change Order'],['status','Status'],['requested_at','Requested'],['estimated_charge_delta','Charge Delta']] },
      service_contract_document: { label:'Service Contract Documents', rowsKey:'serviceContractDocuments', valueKey:'id', labelField:'document_number', fields:[
        { name:'document_number', label:'Document Number', type:'text', required:true }, { name:'source_entity', label:'Source Entity', type:'select', options:[['estimate','Estimate'],['recurring_service_agreement','Recurring Service Agreement'],['job','Job'],['manual','Manual']] }, { name:'source_id', label:'Source ID', type:'text', required:true },
        { name:'estimate_id', label:'Estimate', type:'select', source:'estimates' }, { name:'agreement_id', label:'Agreement', type:'select', source:'recurringServiceAgreements' }, { name:'job_id', label:'Job', type:'select', source:'jobs' }, { name:'client_id', label:'Client', type:'select', source:'clients' }, { name:'client_site_id', label:'Client Site', type:'select', source:'clientSites' },
        { name:'document_kind', label:'Document Kind', type:'select', options:[['application','Application'],['contract','Contract'],['change_order','Change Order'],['service_summary','Service Summary'],['payroll_export_cover','Payroll Export Cover']] }, { name:'document_status', label:'Status', type:'select', options:[['draft','Draft'],['issued','Issued'],['signed','Signed'],['archived','Archived'],['void','Void']] }, { name:'title', label:'Title', type:'text', required:true }, { name:'contract_reference', label:'Contract Reference', type:'text' },
        { name:'effective_date', label:'Effective Date', type:'date' }, { name:'expiry_date', label:'Expiry Date', type:'date' }, { name:'issued_at', label:'Issued At', type:'datetime-local' }, { name:'signed_at', label:'Signed At', type:'datetime-local' }, { name:'signed_by_name', label:'Signed By Name', type:'text' }, { name:'signed_by_title', label:'Signed By Title', type:'text' }, { name:'signed_by_email', label:'Signed By Email', type:'email' }, { name:'signed_document_url', label:'Signed Document URL', type:'text' }, { name:'linked_invoice_id', label:'Linked Invoice', type:'select', source:'arInvoices' }, { name:'rendered_html', label:'Rendered HTML', type:'textarea' }, { name:'rendered_text', label:'Rendered Text', type:'textarea' }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['document_number','Document'],['document_kind','Kind'],['document_status','Status'],['signed_at','Signed'],['linked_invoice_id','Invoice']] },

      service_execution_scheduler_setting: { label:'Service Execution Scheduler Settings', rowsKey:'serviceExecutionSchedulerSettings', valueKey:'id', labelField:'setting_code', fields:[
        { name:'setting_code', label:'Setting Code', type:'text', required:true }, { name:'is_enabled', label:'Enabled', type:'checkbox' }, { name:'run_timezone', label:'Timezone', type:'text' }, { name:'cadence', label:'Cadence', type:'select', options:[['manual','Manual'],['hourly','Hourly'],['daily','Daily'],['weekly','Weekly']] },
        { name:'run_hour_local', label:'Run Hour', type:'number' }, { name:'run_minute_local', label:'Run Minute', type:'number' }, { name:'lookahead_days', label:'Lookahead Days', type:'number' }, { name:'auto_create_sessions', label:'Auto Create Sessions', type:'checkbox' },
        { name:'auto_stage_invoices', label:'Auto Stage Invoices', type:'checkbox' }, { name:'require_linked_job', label:'Require Linked Job', type:'checkbox' }, { name:'invoke_url', label:'Invoke URL', type:'text' }, { name:'last_run_at', label:'Last Run', type:'datetime-local' }, { name:'next_run_at', label:'Next Run', type:'datetime-local' }, { name:'last_dispatch_at', label:'Last Dispatch', type:'datetime-local', readonly:true }, { name:'last_dispatch_status', label:'Dispatch Status', type:'text', readonly:true }, { name:'last_dispatch_notes', label:'Dispatch Notes', type:'textarea', readonly:true }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['setting_code','Setting'],['cadence','Cadence'],['is_enabled','Enabled'],['next_run_at','Next Run']] },
      customer_asset: { label:'Customer Assets', rowsKey:'customerAssets', valueKey:'id', labelField:'asset_name', fields:[
        { name:'asset_code', label:'Asset Code', type:'text', required:true }, { name:'client_id', label:'Client', type:'select', source:'clients' }, { name:'client_site_id', label:'Client Site', type:'select', source:'clientSites' },
        { name:'asset_name', label:'Asset Name', type:'text', required:true }, { name:'asset_type', label:'Asset Type', type:'text' }, { name:'serial_number', label:'Serial Number', type:'text' }, { name:'install_date', label:'Install Date', type:'date' }, { name:'warranty_expiry_date', label:'Warranty Expiry', type:'date' }, { name:'manufacturer', label:'Manufacturer', type:'text' }, { name:'model', label:'Model', type:'text' }, { name:'location_notes', label:'Location Notes', type:'textarea' }, { name:'service_notes', label:'Service Notes', type:'textarea' }, { name:'is_active', label:'Active', type:'checkbox' }
      ], columns:[['asset_code','Asset'],['asset_name','Name'],['asset_type','Type'],['warranty_expiry_date','Warranty']] },
      customer_asset_job_link: { label:'Customer Asset Job Links', rowsKey:'customerAssetJobLinks', valueKey:'id', labelField:'asset_code', fields:[
        { name:'asset_id', label:'Asset', type:'select', source:'customerAssets', required:true }, { name:'job_id', label:'Job', type:'select', source:'jobs', required:true }, { name:'service_date', label:'Service Date', type:'date' }, { name:'event_type', label:'Event Type', type:'select', options:[['service','Service'],['inspection','Inspection'],['repair','Repair'],['warranty','Warranty'],['callback','Callback'],['installation','Installation'],['replacement','Replacement']] }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['asset_code','Asset'],['job_code','Job'],['service_date','Service Date'],['event_type','Event']] },
      warranty_callback_event: { label:'Warranty / Callback Events', rowsKey:'warrantyCallbackEvents', valueKey:'id', labelField:'callback_number', fields:[
        { name:'callback_number', label:'Callback Number', type:'text', required:true }, { name:'job_id', label:'Job', type:'select', source:'jobs' }, { name:'asset_id', label:'Asset', type:'select', source:'customerAssets' }, { name:'client_site_id', label:'Client Site', type:'select', source:'clientSites' },
        { name:'callback_type', label:'Callback Type', type:'select', options:[['callback','Callback'],['warranty','Warranty'],['service_revisit','Service Revisit'],['deficiency','Deficiency']] }, { name:'status', label:'Status', type:'select', options:[['open','Open'],['scheduled','Scheduled'],['in_progress','In Progress'],['closed','Closed'],['void','Void']] }, { name:'warranty_covered', label:'Warranty Covered', type:'checkbox' }, { name:'opened_at', label:'Opened At', type:'datetime-local' }, { name:'closed_at', label:'Closed At', type:'datetime-local' }, { name:'estimated_cost_total', label:'Estimated Cost', type:'number' }, { name:'actual_cost_total', label:'Actual Cost', type:'number' }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['callback_number','Callback'],['callback_type','Type'],['status','Status'],['actual_cost_total','Actual Cost']] },
      payroll_export_run: { label:'Payroll Export Runs', rowsKey:'payrollExportRuns', valueKey:'id', labelField:'run_code', fields:[
        { name:'run_code', label:'Run Code', type:'text', required:true }, { name:'period_start', label:'Period Start', type:'date', required:true }, { name:'period_end', label:'Period End', type:'date', required:true }, { name:'status', label:'Status', type:'select', options:[['draft','Draft'],['ready','Ready'],['exported','Exported'],['void','Void']] }, { name:'export_provider', label:'Export Provider', type:'select', options:[['generic_csv','Generic CSV'],['quickbooks_time_csv','QuickBooks Time CSV'],['simplepay_csv','SimplePay CSV'],['adp_csv','ADP CSV'],['json','JSON']] }, { name:'export_format', label:'Export Format', type:'select', options:[['csv','CSV'],['json','JSON']] }, { name:'export_file_name', label:'File Name', type:'text' }, { name:'export_mime_type', label:'MIME Type', type:'text' }, { name:'exported_entry_count', label:'Entry Count', type:'number', readonly:true }, { name:'exported_hours_total', label:'Hours', type:'number', readonly:true }, { name:'exported_payroll_cost_total', label:'Payroll Cost', type:'number', readonly:true }, { name:'exported_at', label:'Exported At', type:'datetime-local' }, { name:'exported_by_profile_id', label:'Exported By', type:'select', source:'profiles' }, { name:'delivery_status', label:'Delivery Status', type:'select', options:[['pending','Pending'],['delivered','Delivered'],['confirmed','Confirmed']] }, { name:'delivery_reference', label:'Delivery Reference', type:'text' }, { name:'delivery_notes', label:'Delivery Notes', type:'textarea' }, { name:'delivered_at', label:'Delivered At', type:'datetime-local', readonly:true }, { name:'delivered_by_profile_id', label:'Delivered By', type:'select', source:'profiles', readonly:true }, { name:'delivery_confirmed_at', label:'Delivery Confirmed At', type:'datetime-local', readonly:true }, { name:'payroll_close_status', label:'Payroll Close Status', type:'select', options:[['open','Open'],['ready_to_close','Ready to Close'],['closed','Closed']] }, { name:'payroll_closed_at', label:'Payroll Closed At', type:'datetime-local', readonly:true }, { name:'payroll_closed_by_profile_id', label:'Payroll Closed By', type:'select', source:'profiles', readonly:true }, { name:'payroll_close_notes', label:'Payroll Close Notes', type:'textarea' }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['run_code','Run'],['period_start','Start'],['period_end','End'],['export_provider','Provider'],['status','Status'],['exported_entry_count','Entries']] },
      employee_time_entry: { label:'Employee Time Entries', rowsKey:'employeeTimeClockEntries', valueKey:'id', labelField:'full_name', fields:[
        { name:'profile_id', label:'Employee', type:'select', source:'profiles', required:true }, { name:'job_id', label:'Job', type:'select', source:'jobs', required:true }, { name:'site_id', label:'Site', type:'select', source:'sites' }, { name:'job_session_id', label:'Job Session ID', type:'text' },
        { name:'clock_status', label:'Clock Status', type:'select', options:[['active','Active'],['paused','Paused'],['signed_out','Signed Out'],['cancelled','Cancelled']] }, { name:'signed_in_at', label:'Signed In At', type:'datetime-local' }, { name:'signed_out_at', label:'Signed Out At', type:'datetime-local' },
        { name:'paid_work_minutes', label:'Paid Minutes', type:'number' }, { name:'unpaid_break_minutes', label:'Break Minutes', type:'number' }, { name:'clock_in_geo_source', label:'Clock-in Geo Source', type:'text' }, { name:'clock_in_photo_note', label:'Clock-in Photo Note', type:'textarea' },
        { name:'clock_out_geo_source', label:'Clock-out Geo Source', type:'text' }, { name:'clock_out_photo_note', label:'Clock-out Photo Note', type:'textarea' }, { name:'exception_status', label:'Exception Status', type:'select', options:[['clear','Clear'],['open','Open'],['reviewed','Reviewed'],['resolved','Resolved'],['waived','Waived']] }, { name:'exception_notes', label:'Exception Notes', type:'textarea' }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['full_name','Employee'],['job_code','Job'],['clock_status','Status'],['signed_in_at','Signed In'],['signed_out_at','Signed Out'],['exception_status','Exception']] },
      employee_time_entry_review: { label:'Employee Time Reviews', rowsKey:'employeeTimeEntryReviews', valueKey:'id', labelField:'exception_type', fields:[
        { name:'time_entry_id', label:'Time Entry', type:'select', source:'employeeTimeClockEntries', required:true }, { name:'review_type', label:'Review Type', type:'select', options:[['attendance_exception','Attendance Exception'],['clock_edit','Clock Edit'],['geofence_review','Geofence Review'],['payroll_review','Payroll Review']] },
        { name:'exception_type', label:'Exception Type', type:'text' }, { name:'review_status', label:'Status', type:'select', options:[['open','Open'],['reviewed','Reviewed'],['resolved','Resolved'],['waived','Waived']] }, { name:'reviewed_by_profile_id', label:'Reviewed By', type:'select', source:'profiles' }, { name:'reviewed_at', label:'Reviewed At', type:'datetime-local' }, { name:'resolution_notes', label:'Resolution Notes', type:'textarea' }
      ], columns:[['exception_type','Exception'],['review_status','Status'],['reviewed_at','Reviewed At'],['reviewed_by_profile_id','Reviewer']] },
      job_financial_event: { label:'Job Financial Events', rowsKey:'jobFinancialEvents', valueKey:'id', labelField:'event_type', fields:[
        { name:'job_id', label:'Job', type:'select', source:'jobs', required:true }, { name:'job_session_id', label:'Job Session ID', type:'text' },
        { name:'event_date', label:'Event Date', type:'date' }, { name:'event_type', label:'Event Type', type:'select', options:[['material','Material'],['equipment_repair','Equipment Repair'],['delay','Delay'],['fuel','Fuel'],['travel','Travel'],['subcontract','Subcontract'],['disposal','Disposal'],['permit','Permit'],['revenue_adjustment','Revenue Adjustment'],['discount_adjustment','Discount Adjustment'],['other','Other']] },
        { name:'cost_amount', label:'Cost Amount', type:'number' }, { name:'revenue_amount', label:'Revenue Amount', type:'number' }, { name:'quantity', label:'Quantity', type:'number' },
        { name:'unit_cost', label:'Unit Cost', type:'number' }, { name:'unit_price', label:'Unit Price', type:'number' }, { name:'is_billable', label:'Billable', type:'checkbox' },
        { name:'vendor_id', label:'Vendor', type:'select', source:'vendors' }, { name:'tax_code_id', label:'Tax Code', type:'select', source:'taxCodes' }, { name:'gl_account_id', label:'GL Account', type:'select', source:'glAccounts' },
        { name:'reference_number', label:'Reference', type:'text' }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['job_code','Job'],['event_date','Date'],['event_type','Type'],['cost_amount','Cost'],['revenue_amount','Revenue'],['is_billable','Billable']] },
      service_area: { label:'Service Areas', rowsKey:'serviceAreas', valueKey:'id', labelField:'name', fields:[
        { name:'area_code', label:'Area Code', type:'text' }, { name:'name', label:'Name', type:'text', required:true },
        { name:'region', label:'Region', type:'text' }, { name:'notes', label:'Notes', type:'textarea' }, { name:'is_active', label:'Active', type:'checkbox' }
      ], columns:[['area_code','Code'],['name','Name'],['region','Region'],['is_active','Active']] },
      route: { label:'Routes', rowsKey:'routes', valueKey:'id', labelField:'name', fields:[
        { name:'route_code', label:'Route Code', type:'text' }, { name:'name', label:'Name', type:'text', required:true },
        { name:'service_area_id', label:'Service Area', type:'select', source:'serviceAreas' },
        { name:'route_type', label:'Route Type', type:'select', options:[['recurring','Recurring'],['project','Project'],['seasonal','Seasonal'],['dispatch','Dispatch']] },
        { name:'day_of_week', label:'Day of Week (0-6)', type:'number' }, { name:'notes', label:'Notes', type:'textarea' }, { name:'is_active', label:'Active', type:'checkbox' }
      ], columns:[['route_code','Code'],['name','Name'],['route_type','Type'],['day_of_week','Day']] },
      route_stop: { label:'Route Stops', rowsKey:'routeStops', valueKey:'id', labelField:'id', fields:[
        { name:'route_id', label:'Route', type:'select', source:'routes', required:true }, { name:'client_site_id', label:'Client Site', type:'select', source:'clientSites' },
        { name:'stop_order', label:'Stop Order', type:'number' }, { name:'planned_arrival_time', label:'Planned Arrival', type:'time' }, { name:'planned_duration_minutes', label:'Duration Minutes', type:'number' },
        { name:'instructions', label:'Instructions', type:'textarea' }, { name:'is_active', label:'Active', type:'checkbox' }
      ], columns:[['route_id','Route'],['stop_order','Stop'],['planned_arrival_time','Arrival'],['planned_duration_minutes','Minutes']] },
      route_stop_execution: { label:'Route Stop Executions', rowsKey:'routeStopExecutions', valueKey:'id', labelField:'id', fields:[
        { name:'route_stop_id', label:'Route Stop', type:'select', source:'routeStops', required:true }, { name:'route_id', label:'Route', type:'select', source:'routes' }, { name:'client_site_id', label:'Client Site', type:'select', source:'clientSites' },
        { name:'execution_date', label:'Execution Date', type:'date', required:true }, { name:'execution_sequence', label:'Sequence', type:'number' }, { name:'execution_status', label:'Status', type:'select', options:[['planned','Planned'],['in_progress','In Progress'],['completed','Completed'],['skipped','Skipped'],['delayed','Delayed'],['cancelled','Cancelled']] },
        { name:'started_at', label:'Started At', type:'datetime-local' }, { name:'arrived_at', label:'Arrived At', type:'datetime-local' }, { name:'completed_at', label:'Completed At', type:'datetime-local' }, { name:'completed_by_profile_id', label:'Completed By', type:'select', source:'profiles' },
        { name:'supervisor_profile_id', label:'Supervisor', type:'select', source:'supervisorProfiles' }, { name:'delay_minutes', label:'Delay Minutes', type:'number' }, { name:'special_instructions_acknowledged', label:'Instructions Acknowledged', type:'checkbox' },
        { name:'attachment_count', label:'Attachment Count', type:'number', readonly:true }, { name:'photo_count', label:'Photo Count', type:'number', readonly:true }, { name:'notes', label:'Notes', type:'textarea' }, { name:'exception_notes', label:'Exception Notes', type:'textarea' }
      ], columns:[['execution_date','Date'],['execution_status','Status'],['route_stop_id','Route Stop'],['attachment_count','Files']] },
      route_stop_execution_attachment: { label:'Route Stop Execution Attachments', rowsKey:'routeStopExecutionAttachments', valueKey:'id', labelField:'file_name', fields:[
        { name:'execution_id', label:'Execution', type:'select', source:'routeStopExecutions', required:true }, { name:'attachment_kind', label:'Kind', type:'select', options:[['photo','Photo'],['file','File'],['signature','Signature'],['document','Document']] },
        { name:'file_name', label:'File Name', type:'text' }, { name:'mime_type', label:'Mime Type', type:'text' }, { name:'storage_bucket', label:'Storage Bucket', type:'text' }, { name:'storage_path', label:'Storage Path', type:'text' },
        { name:'public_url', label:'Public URL', type:'text' }, { name:'caption', label:'Caption', type:'textarea' }
      ], columns:[['execution_id','Execution'],['attachment_kind','Kind'],['file_name','File'],['public_url','URL']] },
      client: { label:'Clients', rowsKey:'clients', valueKey:'id', labelField:'legal_name', fields:[
        { name:'client_code', label:'Client Code', type:'text' }, { name:'legal_name', label:'Legal Name', type:'text', required:true },
        { name:'display_name', label:'Display Name', type:'text' }, { name:'client_type', label:'Client Type', type:'select', options:[['customer','Customer'],['general_contractor','General Contractor'],['municipal','Municipal'],['subcontract_partner','Subcontract Partner']] },
        { name:'billing_email', label:'Billing Email', type:'email' }, { name:'phone', label:'Phone', type:'text' },
        { name:'address_line1', label:'Address Line 1', type:'text' }, { name:'city', label:'City', type:'text' }, { name:'province', label:'Province', type:'text' },
        { name:'postal_code', label:'Postal Code', type:'text' }, { name:'payment_terms_days', label:'Payment Terms (days)', type:'number' },
        { name:'notes', label:'Notes', type:'textarea' }, { name:'is_active', label:'Active', type:'checkbox' }
      ], columns:[['client_code','Code'],['legal_name','Client'],['client_type','Type'],['is_active','Active']] },
      client_site: { label:'Client Sites', rowsKey:'clientSites', valueKey:'id', labelField:'site_name', fields:[
        { name:'client_id', label:'Client', type:'select', source:'clients', required:true }, { name:'legacy_site_id', label:'Linked Legacy Site', type:'select', source:'sites' },
        { name:'site_code', label:'Site Code', type:'text' }, { name:'site_name', label:'Site Name', type:'text', required:true },
        { name:'service_address', label:'Service Address', type:'text' }, { name:'city', label:'City', type:'text' }, { name:'province', label:'Province', type:'text' },
        { name:'postal_code', label:'Postal Code', type:'text' }, { name:'access_notes', label:'Access Notes', type:'textarea' }, { name:'hazard_notes', label:'Hazard Notes', type:'textarea' }, { name:'is_active', label:'Active', type:'checkbox' }
      ], columns:[['site_code','Code'],['site_name','Site'],['city','City'],['is_active','Active']] },
      material: { label:'Materials Catalog', rowsKey:'materialsCatalog', valueKey:'id', labelField:'item_name', fields:[
        { name:'sku', label:'SKU', type:'text' }, { name:'item_name', label:'Item Name', type:'text', required:true }, { name:'material_category', label:'Category', type:'text' },
        { name:'unit_id', label:'Unit', type:'select', source:'units' }, { name:'default_unit_cost', label:'Unit Cost', type:'number' }, { name:'default_bill_rate', label:'Bill Rate', type:'number' },
        { name:'reorder_point', label:'Reorder Point', type:'number' }, { name:'reorder_quantity', label:'Reorder Quantity', type:'number' }, { name:'taxable', label:'Taxable', type:'checkbox' },
        { name:'inventory_tracked', label:'Inventory Tracked', type:'checkbox' }, { name:'notes', label:'Notes', type:'textarea' }, { name:'is_active', label:'Active', type:'checkbox' }
      ], columns:[['sku','SKU'],['item_name','Item'],['material_category','Category'],['default_unit_cost','Cost']] },
      equipment_master: { label:'Equipment Master', rowsKey:'equipmentMaster', valueKey:'id', labelField:'item_name', fields:[
        { name:'equipment_code', label:'Equipment Code', type:'text' }, { name:'item_name', label:'Item Name', type:'text', required:true }, { name:'equipment_category', label:'Category', type:'text' },
        { name:'manufacturer', label:'Manufacturer', type:'text' }, { name:'model', label:'Model', type:'text' }, { name:'ownership_type', label:'Ownership', type:'select', options:[['owned','Owned'],['rented','Rented'],['leased','Leased'],['subcontract','Subcontract']] },
        { name:'bill_rate_hourly', label:'Bill Rate Hourly', type:'number' }, { name:'cost_rate_hourly', label:'Cost Rate Hourly', type:'number' }, { name:'default_operator_required', label:'Operator Required', type:'checkbox' },
        { name:'notes', label:'Notes', type:'textarea' }, { name:'is_active', label:'Active', type:'checkbox' }
      ], columns:[['equipment_code','Code'],['item_name','Equipment'],['equipment_category','Category'],['ownership_type','Ownership']] },
      estimate: { label:'Estimates', rowsKey:'estimates', valueKey:'id', labelField:'estimate_number', fields:[
        { name:'estimate_number', label:'Estimate Number', type:'text', required:true }, { name:'client_id', label:'Client', type:'select', source:'clients' }, { name:'client_site_id', label:'Client Site', type:'select', source:'clientSites' },
        { name:'estimate_type', label:'Estimate Type', type:'select', source:'jobTypes', optionValueKey:'name' }, { name:'status', label:'Status', type:'select', options:[['draft','Draft'],['sent','Sent'],['approved','Approved'],['declined','Declined']] },
        { name:'valid_until', label:'Valid Until', type:'date' }, { name:'subtotal', label:'Subtotal', type:'number' }, { name:'tax_total', label:'Tax Total', type:'number' }, { name:'total_amount', label:'Total Amount', type:'number' },
        { name:'scope_notes', label:'Scope Notes', type:'textarea' }, { name:'terms_notes', label:'Terms Notes', type:'textarea' }
      ], columns:[['estimate_number','Estimate'],['estimate_type','Type'],['status','Status'],['total_amount','Total']] },
      estimate_line: { label:'Estimate Lines', rowsKey:'estimateLines', valueKey:'id', labelField:'description', fields:[
        { name:'estimate_id', label:'Estimate', type:'select', source:'estimates', required:true }, { name:'line_order', label:'Line Order', type:'number' },
        { name:'line_type', label:'Line Type', type:'select', options:[['service','Service'],['material','Material'],['equipment','Equipment'],['allowance','Allowance']] }, { name:'description', label:'Description', type:'text', required:true },
        { name:'cost_code_id', label:'Cost Code', type:'select', source:'costCodes' }, { name:'unit_id', label:'Unit', type:'select', source:'units' }, { name:'quantity', label:'Quantity', type:'number' },
        { name:'unit_cost', label:'Unit Cost', type:'number' }, { name:'unit_price', label:'Unit Price', type:'number' }, { name:'line_total', label:'Line Total', type:'number', readonly:true },
        { name:'material_id', label:'Material', type:'select', source:'materials' }, { name:'equipment_master_id', label:'Equipment', type:'select', source:'equipmentMaster' }
      ], columns:[['estimate_id','Estimate'],['line_order','Order'],['description','Description'],['line_total','Total']] },
      work_order: { label:'Work Orders', rowsKey:'workOrders', valueKey:'id', labelField:'work_order_number', fields:[
        { name:'work_order_number', label:'Work Order Number', type:'text', required:true }, { name:'estimate_id', label:'Estimate', type:'select', source:'estimates' },
        { name:'client_id', label:'Client', type:'select', source:'clients' }, { name:'client_site_id', label:'Client Site', type:'select', source:'clientSites' }, { name:'legacy_job_id', label:'Linked Legacy Job ID', type:'number' },
        { name:'work_type', label:'Work Type', type:'select', source:'jobTypes', optionValueKey:'name' }, { name:'status', label:'Status', type:'select', options:[['draft','Draft'],['scheduled','Scheduled'],['in_progress','In Progress'],['completed','Completed'],['closed','Closed']] },
        { name:'scheduled_start', label:'Scheduled Start', type:'datetime-local' }, { name:'scheduled_end', label:'Scheduled End', type:'datetime-local' },
        { name:'service_area_id', label:'Service Area', type:'select', source:'serviceAreas' }, { name:'route_id', label:'Route', type:'select', source:'routes' }, { name:'supervisor_profile_id', label:'Supervisor', type:'select', source:'supervisorProfiles' },
        { name:'subtotal', label:'Subtotal', type:'number' }, { name:'tax_total', label:'Tax Total', type:'number' }, { name:'total_amount', label:'Total Amount', type:'number' }, { name:'actual_material_cost_total', label:'Actual Material Cost', type:'number', readonly:true }, { name:'receipt_count', label:'Receipt Count', type:'number', readonly:true }, { name:'received_material_cost_total', label:'Received Material Cost', type:'number', readonly:true }, { name:'unallocated_receipt_cost_total', label:'Unallocated Receipt Cost', type:'number', readonly:true }, { name:'open_hse_packets', label:'Open HSE Packets', type:'number', readonly:true }, { name:'ready_hse_packets', label:'Ready HSE Packets', type:'number', readonly:true }, { name:'closed_hse_packets', label:'Closed HSE Packets', type:'number', readonly:true }, { name:'operational_status', label:'Operational Status', type:'text', readonly:true },
        { name:'crew_notes', label:'Crew Notes', type:'textarea' }, { name:'customer_notes', label:'Customer Notes', type:'textarea' }, { name:'safety_notes', label:'Safety Notes', type:'textarea' }
      ], columns:[['work_order_number','Work Order'],['work_type','Type'],['status','Status'],['total_amount','Total']] },
      work_order_line: { label:'Work Order Lines', rowsKey:'workOrderLines', valueKey:'id', labelField:'description', fields:[
        { name:'work_order_id', label:'Work Order', type:'select', source:'workOrders', required:true }, { name:'line_order', label:'Line Order', type:'number' },
        { name:'line_type', label:'Line Type', type:'select', options:[['service','Service'],['material','Material'],['equipment','Equipment'],['allowance','Allowance']] }, { name:'description', label:'Description', type:'text', required:true },
        { name:'cost_code_id', label:'Cost Code', type:'select', source:'costCodes' }, { name:'unit_id', label:'Unit', type:'select', source:'units' }, { name:'quantity', label:'Quantity', type:'number' },
        { name:'unit_cost', label:'Unit Cost', type:'number' }, { name:'unit_price', label:'Unit Price', type:'number' }, { name:'line_total', label:'Line Total', type:'number', readonly:true },
        { name:'material_id', label:'Material', type:'select', source:'materials' }, { name:'equipment_master_id', label:'Equipment', type:'select', source:'equipmentMaster' },
        { name:'actual_quantity_received', label:'Actual Qty Received', type:'number', readonly:true }, { name:'actual_material_cost', label:'Actual Material Cost', type:'number', readonly:true }
      ], columns:[['work_order_id','Work Order'],['line_order','Order'],['description','Description'],['line_total','Total']] },
      subcontract_client: { label:'Subcontract Clients', rowsKey:'subcontractClients', valueKey:'id', labelField:'company_name', fields:[
        { name:'client_id', label:'Linked Client', type:'select', source:'clients' }, { name:'subcontract_code', label:'Code', type:'text' }, { name:'company_name', label:'Company Name', type:'text', required:true },
        { name:'contact_name', label:'Contact Name', type:'text' }, { name:'contact_email', label:'Contact Email', type:'email' }, { name:'contact_phone', label:'Contact Phone', type:'text' },
        { name:'billing_basis', label:'Billing Basis', type:'select', options:[['hourly','Hourly'],['daily','Daily'],['unit','Unit'],['fixed','Fixed']] }, { name:'rate_notes', label:'Rate Notes', type:'textarea' }, { name:'is_active', label:'Active', type:'checkbox' }
      ], columns:[['subcontract_code','Code'],['company_name','Company'],['billing_basis','Billing'],['is_active','Active']] },
      subcontract_dispatch: { label:'Subcontract Dispatches', rowsKey:'subcontractDispatches', valueKey:'id', labelField:'dispatch_number', fields:[
        { name:'dispatch_number', label:'Dispatch Number', type:'text', required:true }, { name:'subcontract_client_id', label:'Subcontract Client', type:'select', source:'subcontractClients', required:true },
        { name:'client_site_id', label:'Client Site', type:'select', source:'clientSites' }, { name:'work_order_id', label:'Work Order', type:'select', source:'workOrders' }, { name:'operator_profile_id', label:'Operator', type:'select', source:'profiles' },
        { name:'equipment_master_id', label:'Equipment', type:'select', source:'equipmentMaster' }, { name:'dispatch_status', label:'Status', type:'select', options:[['draft','Draft'],['scheduled','Scheduled'],['in_progress','In Progress'],['completed','Completed'],['invoiced','Invoiced']] },
        { name:'dispatch_start', label:'Dispatch Start', type:'datetime-local' }, { name:'dispatch_end', label:'Dispatch End', type:'datetime-local' }, { name:'billing_basis', label:'Billing Basis', type:'select', options:[['hourly','Hourly'],['daily','Daily'],['unit','Unit'],['fixed','Fixed']] },
        { name:'bill_rate', label:'Bill Rate', type:'number' }, { name:'cost_rate', label:'Cost Rate', type:'number' }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['dispatch_number','Dispatch'],['dispatch_status','Status'],['billing_basis','Billing'],['bill_rate','Bill Rate']] },
      linked_hse_packet: { label:'Linked HSE Packets', rowsKey:'linkedHsePackets', valueKey:'id', labelField:'packet_number', fields:[
        { name:'packet_number', label:'Packet Number', type:'text', required:true }, { name:'packet_type', label:'Packet Type', type:'select', options:[['work_order','Work Order'],['dispatch','Dispatch'],['standalone_hse','Standalone HSE'],['unscheduled_project','Unscheduled Project']] },
        { name:'packet_scope', label:'Packet Scope', type:'select', options:[['standalone','Standalone'],['site','Site'],['work_order','Work Order'],['route','Route'],['dispatch','Dispatch'],['equipment','Equipment'],['job','Job'],['subcontract_work','Subcontract Work']] },
        { name:'packet_status', label:'Packet Status', type:'select', options:[['draft','Draft'],['issued','Issued'],['in_progress','In Progress'],['ready_for_closeout','Ready for Closeout'],['closed','Closed']] },
        { name:'job_id', label:'Job', type:'select', source:'jobs' }, { name:'work_order_id', label:'Work Order', type:'select', source:'workOrders' }, { name:'dispatch_id', label:'Dispatch', type:'select', source:'subcontractDispatches' },
        { name:'client_site_id', label:'Client Site', type:'select', source:'clientSites' }, { name:'route_id', label:'Route', type:'select', source:'routes' }, { name:'equipment_master_id', label:'Equipment', type:'select', source:'equipmentMaster' }, { name:'supervisor_profile_id', label:'Supervisor', type:'select', source:'supervisorProfiles' },
        { name:'unscheduled_project', label:'Unscheduled Project', type:'checkbox' }, { name:'standalone_project_name', label:'Standalone Project Name', type:'text' },
        { name:'completion_percent', label:'Completion %', type:'number', readonly:true }, { name:'proof_count', label:'Proof Count', type:'number', readonly:true }, { name:'event_count', label:'Event Count', type:'number', readonly:true }, { name:'exception_event_count', label:'Exception Event Count', type:'number', readonly:true },
        { name:'photo_count', label:'Photo Count', type:'number', readonly:true }, { name:'signature_count', label:'Signature Count', type:'number', readonly:true }, { name:'document_count', label:'Document Count', type:'number', readonly:true },
        { name:'briefing_required', label:'Briefing Required', type:'checkbox' }, { name:'briefing_completed', label:'Briefing Completed', type:'checkbox' }, { name:'inspection_required', label:'Inspection Required', type:'checkbox' }, { name:'inspection_completed', label:'Inspection Completed', type:'checkbox' },
        { name:'emergency_review_required', label:'Emergency Review Required', type:'checkbox' }, { name:'emergency_review_completed', label:'Emergency Review Completed', type:'checkbox' },
        { name:'machinery_review_required', label:'Machinery Review Required', type:'checkbox' }, { name:'machinery_review_completed', label:'Machinery Review Completed', type:'checkbox' }, { name:'last_machinery_review_at', label:'Last Machinery Review', type:'datetime-local', readonly:true },
        { name:'moving_blade_risk', label:'Moving Blade Risk', type:'checkbox' }, { name:'pinch_point_risk', label:'Pinch Point Risk', type:'checkbox' }, { name:'thrown_object_risk', label:'Thrown Object Risk', type:'checkbox' },
        { name:'guard_controls_verified', label:'Guards Verified', type:'checkbox' }, { name:'lockout_required', label:'Lockout Required', type:'checkbox' }, { name:'lockout_verified', label:'Lockout Verified', type:'checkbox' },
        { name:'lifting_review_required', label:'Lifting Review Required', type:'checkbox' }, { name:'lifting_review_completed', label:'Lifting Review Completed', type:'checkbox' }, { name:'last_lifting_review_at', label:'Last Lifting Review', type:'datetime-local', readonly:true },
        { name:'manual_handling_required', label:'Manual Handling Required', type:'checkbox' }, { name:'repetitive_motion_risk', label:'Repetitive Motion Risk', type:'checkbox' }, { name:'overhead_reach_risk', label:'Overhead Reach Risk', type:'checkbox' }, { name:'uneven_terrain_risk', label:'Uneven Terrain Risk', type:'checkbox' }, { name:'crew_lift_required', label:'Crew Lift Required', type:'checkbox' },
        { name:'weather_monitoring_required', label:'Weather Monitoring Required', type:'checkbox' }, { name:'weather_monitoring_completed', label:'Weather Monitoring Completed', type:'checkbox' }, { name:'last_weather_check_at', label:'Last Weather Check', type:'datetime-local', readonly:true },
        { name:'heat_monitoring_required', label:'Heat Monitoring Required', type:'checkbox' }, { name:'heat_monitoring_completed', label:'Heat Monitoring Completed', type:'checkbox' }, { name:'last_heat_check_at', label:'Last Heat Check', type:'datetime-local', readonly:true },
        { name:'chemical_handling_required', label:'Chemical Handling Required', type:'checkbox' }, { name:'chemical_handling_completed', label:'Chemical Handling Completed', type:'checkbox' }, { name:'last_chemical_check_at', label:'Last Chemical Check', type:'datetime-local', readonly:true },
        { name:'traffic_control_required', label:'Traffic/Public Control Required', type:'checkbox' }, { name:'traffic_control_completed', label:'Traffic/Public Control Completed', type:'checkbox' }, { name:'last_traffic_check_at', label:'Last Traffic Check', type:'datetime-local', readonly:true },
        { name:'cones_barriers_required', label:'Cones/Barriers Required', type:'checkbox' }, { name:'cones_barriers_completed', label:'Cones/Barriers Confirmed', type:'checkbox' }, { name:'roadside_exposure_risk', label:'Roadside Exposure Risk', type:'checkbox' },
        { name:'field_signoff_required', label:'Field Signoff Required', type:'checkbox' }, { name:'field_signoff_completed', label:'Field Signoff Completed', type:'checkbox' }, { name:'closeout_completed', label:'Closeout Completed', type:'checkbox' }, { name:'field_signed_off_at', label:'Field Signed Off At', type:'datetime-local', readonly:true }, { name:'field_signed_off_by_profile_id', label:'Field Signed Off By', type:'select', source:'profiles', readonly:true },
        { name:'reopen_in_progress', label:'Reopen In Progress', type:'checkbox' }, { name:'reopen_count', label:'Reopen Count', type:'number', readonly:true }, { name:'last_reopened_at', label:'Last Reopened At', type:'datetime-local', readonly:true }, { name:'last_reopened_by_profile_id', label:'Last Reopened By', type:'select', source:'profiles', readonly:true }, { name:'reopen_reason', label:'Reopen Reason', type:'textarea' },
        { name:'ready_for_closeout_at', label:'Ready for Closeout At', type:'datetime-local', readonly:true }, { name:'closed_at', label:'Closed At', type:'datetime-local', readonly:true }, { name:'closed_by_profile_id', label:'Closed By', type:'select', source:'profiles' },
        { name:'task_tool_risk_notes', label:'Task / Tool Risk Notes', type:'textarea' }, { name:'machinery_notes', label:'Machinery Notes', type:'textarea' }, { name:'crew_size_notes', label:'Crew Size Notes', type:'textarea' }, { name:'lifting_notes', label:'Lifting Notes', type:'textarea' }, { name:'weather_notes', label:'Weather Notes', type:'textarea' }, { name:'heat_plan_notes', label:'Heat Plan Notes', type:'textarea' }, { name:'hydration_plan_notes', label:'Hydration Plan Notes', type:'textarea' }, { name:'clothing_notes', label:'Clothing Notes', type:'textarea' }, { name:'sun_air_movement_notes', label:'Sun / Air Movement Notes', type:'textarea' }, { name:'worker_specific_risk_notes', label:'Worker-Specific Risk Notes', type:'textarea' }, { name:'chemical_notes', label:'Chemical Notes', type:'textarea' }, { name:'sds_notes', label:'SDS Notes', type:'textarea' }, { name:'traffic_notes', label:'Traffic Notes', type:'textarea' }, { name:'public_interaction_notes', label:'Public Interaction Notes', type:'textarea' }, { name:'site_communication_notes', label:'Site Communication Notes', type:'textarea' }, { name:'packet_notes', label:'Packet Notes', type:'textarea' }, { name:'closeout_notes', label:'Closeout Notes', type:'textarea' }
      ], columns:[['packet_number','Packet'],['packet_scope','Scope'],['packet_status','Status'],['event_count','Events'],['proof_count','Proofs']] },
      hse_packet_event: { label:'HSE Packet Events', rowsKey:'hsePacketEvents', valueKey:'id', labelField:'event_type', fields:[
        { name:'packet_id', label:'HSE Packet', type:'select', source:'linkedHsePackets', required:true }, { name:'event_type', label:'Event Type', type:'select', options:[['note','Note'],['weather_check','Weather Check'],['heat_check','Heat Check'],['chemical_check','Chemical Check'],['traffic_check','Traffic Check'],['field_signoff','Field Signoff'],['closeout','Closeout'],['reopen','Reopen'],['dispatch_review','Dispatch Review'],['hazard_review','Hazard Review']] },
        { name:'event_status', label:'Event Status', type:'select', options:[['ok','OK'],['warning','Warning'],['exception','Exception'],['closed','Closed'],['signed','Signed']] }, { name:'event_at', label:'Event At', type:'datetime-local' },
        { name:'hazard_category', label:'Hazard Category', type:'select', options:[['general','General'],['machinery_tools','Machinery / Tools'],['lifting_posture','Lifting / Posture'],['weather_heat','Weather / Heat'],['chemicals_public','Chemicals / Public'],['slip_trip_fall','Slip / Trip / Fall'],['traffic','Traffic']] },
        { name:'weather_condition', label:'Weather Condition', type:'text' }, { name:'temperature_c', label:'Temperature C', type:'number' }, { name:'humidex_c', label:'Humidex C', type:'number' }, { name:'humidity_percent', label:'Humidity %', type:'number' }, { name:'wind_kph', label:'Wind KPH', type:'number' }, { name:'sun_exposure_level', label:'Sun Exposure', type:'select', options:[['low','Low'],['moderate','Moderate'],['high','High'],['extreme','Extreme']] }, { name:'precipitation_notes', label:'Precipitation Notes', type:'textarea' },
        { name:'heat_risk_level', label:'Heat Risk Level', type:'select', options:[['low','Low'],['moderate','Moderate'],['high','High'],['extreme','Extreme']] },
        { name:'moving_blade_risk', label:'Moving Blade Risk', type:'checkbox' }, { name:'pinch_point_risk', label:'Pinch Point Risk', type:'checkbox' }, { name:'thrown_object_risk', label:'Thrown Object Risk', type:'checkbox' }, { name:'guard_controls_verified', label:'Guards Verified', type:'checkbox' }, { name:'lockout_required', label:'Lockout Required', type:'checkbox' }, { name:'lockout_verified', label:'Lockout Verified', type:'checkbox' },
        { name:'manual_handling_level', label:'Manual Handling Level', type:'select', options:[['low','Low'],['moderate','Moderate'],['high','High'],['team_lift','Team Lift']] }, { name:'manual_handling_required', label:'Manual Handling Required', type:'checkbox' }, { name:'repetitive_motion_risk', label:'Repetitive Motion Risk', type:'checkbox' }, { name:'overhead_reach_risk', label:'Overhead Reach Risk', type:'checkbox' }, { name:'uneven_terrain_risk', label:'Uneven Terrain Risk', type:'checkbox' }, { name:'crew_lift_required', label:'Crew Lift Required', type:'checkbox' }, { name:'crew_size_needed', label:'Crew Size Needed', type:'number' },
        { name:'chemical_name', label:'Chemical Name', type:'text' }, { name:'sds_reviewed', label:'SDS Reviewed', type:'checkbox' }, { name:'ppe_verified', label:'PPE Verified', type:'checkbox' }, { name:'hydration_verified', label:'Hydration Verified', type:'checkbox' },
        { name:'traffic_control_level', label:'Traffic Control Level', type:'select', options:[['none','None'],['cones_only','Cones Only'],['lane_control','Lane Control'],['public_interface','Public Interface'],['spotter_required','Spotter Required']] }, { name:'cones_barriers_required', label:'Cones/Barriers Required', type:'checkbox' }, { name:'cones_barriers_in_place', label:'Cones/Barriers In Place', type:'checkbox' }, { name:'roadside_exposure_risk', label:'Roadside Exposure Risk', type:'checkbox' },
        { name:'task_tool_risk_notes', label:'Task / Tool Risk Notes', type:'textarea' }, { name:'posture_notes', label:'Posture Notes', type:'textarea' }, { name:'air_movement_notes', label:'Air Movement Notes', type:'textarea' }, { name:'clothing_notes', label:'Clothing Notes', type:'textarea' }, { name:'worker_specific_risk_notes', label:'Worker-Specific Risk Notes', type:'textarea' }, { name:'site_communication_notes', label:'Site Communication Notes', type:'textarea' }, { name:'public_interaction_notes', label:'Public Interaction Notes', type:'textarea' }, { name:'notes', label:'Notes', type:'textarea' }, { name:'proof_url', label:'Proof URL', type:'text' }
      ], columns:[['packet_id','Packet'],['event_type','Type'],['event_status','Status'],['event_at','When']] },
      hse_packet_proof: { label:'HSE Packet Proofs', rowsKey:'hsePacketProofs', valueKey:'id', labelField:'file_name', fields:[
        { name:'packet_id', label:'HSE Packet', type:'select', source:'linkedHsePackets', required:true }, { name:'proof_kind', label:'Proof Kind', type:'select', options:[['photo','Photo'],['file','File'],['signature','Signature'],['document','Document']] },
        { name:'proof_stage', label:'Proof Stage', type:'select', options:[['field','Field'],['closeout','Closeout'],['reopen','Reopen'],['exception','Exception']] }, { name:'file_name', label:'File Name', type:'text' }, { name:'mime_type', label:'Mime Type', type:'text' },
        { name:'storage_bucket', label:'Storage Bucket', type:'text' }, { name:'storage_path', label:'Storage Path', type:'text' }, { name:'public_url', label:'Public URL', type:'text' }, { name:'caption', label:'Caption', type:'text' }, { name:'proof_notes', label:'Proof Notes', type:'textarea' }
      ], columns:[['packet_id','Packet'],['proof_kind','Kind'],['proof_stage','Stage'],['file_name','File']] },
      gl_account: { label:'Chart of Accounts', rowsKey:'chartOfAccounts', valueKey:'id', labelField:'account_name', fields:[
        { name:'account_number', label:'Account Number', type:'text', required:true }, { name:'account_name', label:'Account Name', type:'text', required:true }, { name:'account_type', label:'Account Type', type:'select', options:[['asset','Asset'],['liability','Liability'],['equity','Equity'],['revenue','Revenue'],['expense','Expense']] },
        { name:'parent_account_id', label:'Parent Account', type:'select', source:'glAccounts' }, { name:'system_code', label:'System Code', type:'text' }, { name:'is_active', label:'Active', type:'checkbox' }
      ], columns:[['account_number','No.'],['account_name','Account'],['account_type','Type'],['system_code','Code']] },
      gl_journal_batch: { label:'Journal Batches', rowsKey:'glJournalBatches', valueKey:'id', labelField:'batch_number', fields:[
        { name:'batch_number', label:'Batch Number', type:'text', required:true }, { name:'source_module', label:'Source Module', type:'text' }, { name:'batch_status', label:'Batch Status', type:'select', options:[['draft','Draft'],['review','Review'],['posted','Posted'],['void','Void']] },
        { name:'batch_date', label:'Batch Date', type:'date' }, { name:'memo', label:'Memo', type:'textarea' }, { name:'source_record_type', label:'Source Record Type', type:'text' }, { name:'source_record_id', label:'Source Record ID', type:'text' },
        { name:'line_count', label:'Line Count', type:'number', readonly:true }, { name:'debit_total', label:'Debit Total', type:'number', readonly:true }, { name:'credit_total', label:'Credit Total', type:'number', readonly:true }, { name:'is_balanced', label:'Balanced', type:'checkbox', readonly:true },
        { name:'source_generated', label:'Source Generated', type:'checkbox', readonly:true }, { name:'source_sync_state', label:'Source Sync State', type:'text', readonly:true }, { name:'source_synced_at', label:'Source Synced At', type:'datetime-local', readonly:true }, { name:'exception_count', label:'Exception Count', type:'number', readonly:true }, { name:'open_exception_count', label:'Open Exceptions', type:'number', readonly:true }, { name:'blocking_exception_count', label:'Blocking Exceptions', type:'number', readonly:true }, { name:'last_exception_at', label:'Last Exception At', type:'datetime-local', readonly:true }, { name:'posting_notes', label:'Posting Notes', type:'textarea' }
      ], columns:[['batch_number','Batch'],['batch_status','Status'],['source_sync_state','Sync'],['open_exception_count','Open Exceptions'],['debit_total','Debit']] },
      gl_journal_sync_exception: { label:'Journal Sync Exceptions', rowsKey:'glJournalSyncExceptions', valueKey:'id', labelField:'title', fields:[
        { name:'batch_id', label:'Batch ID', type:'text', readonly:true }, { name:'batch_number', label:'Batch', type:'text', readonly:true }, { name:'exception_type', label:'Exception Type', type:'text', readonly:true }, { name:'severity', label:'Severity', type:'select', options:[['info','Info'],['warning','Warning'],['error','Error']] },
        { name:'exception_status', label:'Status', type:'select', options:[['open','Open'],['resolved','Resolved'],['dismissed','Dismissed']] }, { name:'title', label:'Title', type:'text' }, { name:'details', label:'Details', type:'textarea' },
        { name:'last_seen_at', label:'Last Seen At', type:'datetime-local', readonly:true }, { name:'resolved_at', label:'Resolved At', type:'datetime-local', readonly:true }, { name:'resolution_notes', label:'Resolution Notes', type:'textarea' }
      ], columns:[['batch_number','Batch'],['exception_type','Exception'],['severity','Severity'],['exception_status','Status']] },
      gl_journal_entry: { label:'Journal Entries', rowsKey:'glJournalEntries', valueKey:'id', labelField:'memo', fields:[
        { name:'batch_id', label:'Batch', type:'select', source:'glJournalBatches', required:true }, { name:'line_number', label:'Line Number', type:'number' }, { name:'entry_date', label:'Entry Date', type:'date' },
        { name:'account_id', label:'Account', type:'select', source:'glAccounts', required:true }, { name:'debit_amount', label:'Debit Amount', type:'number' }, { name:'credit_amount', label:'Credit Amount', type:'number' },
        { name:'client_id', label:'Client', type:'select', source:'clients' }, { name:'work_order_id', label:'Work Order', type:'select', source:'workOrders' }, { name:'dispatch_id', label:'Dispatch', type:'select', source:'subcontractDispatches' }, { name:'memo', label:'Memo', type:'textarea' }
      ], columns:[['batch_id','Batch'],['line_number','Line'],['account_id','Account'],['debit_amount','Debit']] },

      bank_account: { label:'Bank Accounts', rowsKey:'bankAccounts', valueKey:'id', labelField:'account_name', fields:[
        { name:'account_name', label:'Account Name', type:'text', required:true }, { name:'institution_name', label:'Institution', type:'text' }, { name:'currency_code', label:'Currency', type:'text' }, { name:'account_mask', label:'Account Mask', type:'text' },
        { name:'account_status', label:'Status', type:'select', options:[['open','Open'],['inactive','Inactive'],['closed','Closed']] }, { name:'gl_account_id', label:'GL Account', type:'select', source:'glAccounts' }, { name:'is_default', label:'Default', type:'checkbox' }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['account_name','Account'],['institution_name','Institution'],['currency_code','Currency'],['account_status','Status'],['is_default','Default']] },
      accounting_period_close: { label:'Period Close Control', rowsKey:'accountingPeriodCloses', valueKey:'id', labelField:'period_code', fields:[
        { name:'period_code', label:'Period Code', type:'text', required:true }, { name:'period_start', label:'Start Date', type:'date', required:true }, { name:'period_end', label:'End Date', type:'date', required:true },
        { name:'close_scope', label:'Scope', type:'select', options:[['month_end','Month End'],['quarter_end','Quarter End'],['year_end','Year End'],['custom','Custom']] }, { name:'close_status', label:'Status', type:'select', options:[['open','Open'],['in_review','In Review'],['closed','Closed'],['reopened','Reopened']] },
        { name:'ar_locked', label:'Lock AR', type:'checkbox' }, { name:'ap_locked', label:'Lock AP', type:'checkbox' }, { name:'gl_locked', label:'Lock GL', type:'checkbox' }, { name:'payroll_locked', label:'Lock Payroll', type:'checkbox' }, { name:'tax_locked', label:'Lock Tax', type:'checkbox' }, { name:'close_notes', label:'Close Notes', type:'textarea' }
      ], columns:[['period_code','Period'],['period_start','Start'],['period_end','End'],['close_status','Status'],['gl_locked','GL Locked']] },
      sales_tax_filing: { label:'Sales Tax Filings', rowsKey:'salesTaxFilings', valueKey:'id', labelField:'filing_code', fields:[
        { name:'filing_code', label:'Filing Code', type:'text', required:true }, { name:'business_tax_setting_id', label:'Tax Profile', type:'select', source:'businessTaxSettings' }, { name:'tax_code_id', label:'Tax Code', type:'select', source:'taxCodes' },
        { name:'filing_scope', label:'Scope', type:'select', options:[['hst_return','HST Return'],['gst_return','GST Return'],['pst_return','PST Return'],['custom','Custom']] }, { name:'filing_period_start', label:'Start Date', type:'date', required:true }, { name:'filing_period_end', label:'End Date', type:'date', required:true }, { name:'due_date', label:'Due Date', type:'date' },
        { name:'filing_status', label:'Filing Status', type:'select', options:[['draft','Draft'],['prepared','Prepared'],['filed','Filed'],['paid','Paid'],['amended','Amended']] }, { name:'review_status', label:'Review Status', type:'select', options:[['draft','Draft'],['prepared','Prepared'],['reviewed','Reviewed'],['approved','Approved'],['filed','Filed'],['paid','Paid']] },
        { name:'taxable_sales_total', label:'Taxable Sales', type:'number' }, { name:'tax_collected_total', label:'Tax Collected', type:'number' }, { name:'tax_paid_total', label:'Tax Paid', type:'number' }, { name:'adjustment_total', label:'Adjustments', type:'number' }, { name:'net_remittance_total', label:'Net Remittance', type:'number' },
        { name:'reference_number', label:'Filing Reference', type:'text' }, { name:'payment_reference', label:'Payment Reference', type:'text' }, { name:'review_notes', label:'Review Notes', type:'textarea' }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['filing_code','Filing'],['filing_period_end','Period End'],['filing_status','Status'],['review_status','Review'],['net_remittance_total','Net']] },
      payroll_remittance_run: { label:'Payroll Remittance Runs', rowsKey:'payrollRemittanceRuns', valueKey:'id', labelField:'remittance_code', fields:[
        { name:'remittance_code', label:'Remittance Code', type:'text', required:true }, { name:'payroll_export_run_id', label:'Payroll Export', type:'select', source:'payrollExportRuns' }, { name:'remittance_type', label:'Type', type:'select', options:[['source_deductions','Source Deductions'],['wsib','WSIB'],['benefits','Benefits'],['custom','Custom']] },
        { name:'remittance_period_start', label:'Start Date', type:'date', required:true }, { name:'remittance_period_end', label:'End Date', type:'date', required:true }, { name:'due_date', label:'Due Date', type:'date' },
        { name:'remittance_status', label:'Remittance Status', type:'select', options:[['draft','Draft'],['prepared','Prepared'],['remitted','Remitted'],['void','Void']] }, { name:'review_status', label:'Review Status', type:'select', options:[['draft','Draft'],['prepared','Prepared'],['reviewed','Reviewed'],['approved','Approved'],['remitted','Remitted']] },
        { name:'gross_pay_total', label:'Gross Pay', type:'number' }, { name:'employee_deduction_total', label:'Employee Deductions', type:'number' }, { name:'employer_contribution_total', label:'Employer Contributions', type:'number' }, { name:'net_remittance_total', label:'Net Remittance', type:'number' },
        { name:'reference_number', label:'Reference Number', type:'text' }, { name:'payment_reference', label:'Payment Reference', type:'text' }, { name:'review_notes', label:'Review Notes', type:'textarea' }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['remittance_code','Run'],['remittance_period_end','Period End'],['remittance_status','Status'],['review_status','Review'],['net_remittance_total','Net']] },
      bank_statement_import: { label:'Bank Statement Imports', rowsKey:'bankStatementImports', valueKey:'id', labelField:'import_code', fields:[
        { name:'bank_account_id', label:'Bank Account', type:'select', source:'bankAccounts', required:true }, { name:'import_code', label:'Import Code', type:'text', required:true }, { name:'statement_start', label:'Statement Start', type:'date' }, { name:'statement_end', label:'Statement End', type:'date' },
        { name:'import_status', label:'Import Status', type:'select', options:[['draft','Draft'],['imported','Imported'],['reviewed','Reviewed'],['reconciled','Reconciled'],['rejected','Rejected']] }, { name:'opening_balance', label:'Opening Balance', type:'number' }, { name:'closing_balance', label:'Closing Balance', type:'number' }, { name:'transaction_count', label:'Transaction Count', type:'number' }, { name:'source_file_name', label:'Source File', type:'text' }, { name:'source_format', label:'Format', type:'text' }
      ], columns:[['import_code','Import'],['bank_account_id','Bank'],['statement_end','End'],['import_status','Status'],['closing_balance','Closing']] },
      bank_reconciliation_session: { label:'Bank Reconciliation Sessions', rowsKey:'bankReconciliationSessions', valueKey:'id', labelField:'session_code', fields:[
        { name:'bank_account_id', label:'Bank Account', type:'select', source:'bankAccounts', required:true }, { name:'statement_import_id', label:'Statement Import', type:'select', source:'bankStatementImports' }, { name:'session_code', label:'Session Code', type:'text', required:true }, { name:'period_start', label:'Period Start', type:'date' }, { name:'period_end', label:'Period End', type:'date' },
        { name:'reconciliation_status', label:'Status', type:'select', options:[['draft','Draft'],['in_review','In Review'],['balanced','Balanced'],['closed','Closed'],['difference_pending','Difference Pending']] }, { name:'book_balance', label:'Book Balance', type:'number' }, { name:'bank_balance', label:'Bank Balance', type:'number' }, { name:'difference_amount', label:'Difference', type:'number' }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['session_code','Session'],['bank_account_id','Bank'],['period_end','Period End'],['reconciliation_status','Status'],['difference_amount','Difference']] },
      bank_reconciliation_item: { label:'Bank Reconciliation Items', rowsKey:'bankReconciliationItems', valueKey:'id', labelField:'item_description', fields:[
        { name:'reconciliation_session_id', label:'Session', type:'select', source:'bankReconciliationSessions', required:true }, { name:'item_source_type', label:'Source Type', type:'select', options:[['bank_statement_line','Bank Statement Line'],['ar_payment','AR Payment'],['ap_payment','AP Payment'],['gl_journal_entry','GL Journal Entry'],['processor_payout','Processor Payout'],['adjustment','Adjustment'],['other','Other']] },
        { name:'item_date', label:'Item Date', type:'date' }, { name:'item_description', label:'Description', type:'text' }, { name:'amount', label:'Amount', type:'number' }, { name:'match_status', label:'Match Status', type:'select', options:[['unmatched','Unmatched'],['matched','Matched'],['partial','Partial'],['exception','Exception']] }, { name:'clearing_status', label:'Clearing Status', type:'select', options:[['open','Open'],['cleared','Cleared'],['void','Void'],['ignored','Ignored']] }, { name:'difference_reason', label:'Difference Reason', type:'text' }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['item_date','Date'],['item_description','Description'],['amount','Amount'],['match_status','Match'],['clearing_status','Clearing']] },
      ar_payment_application: { label:'AR Payment Applications', rowsKey:'arPaymentApplications', valueKey:'id', labelField:'payment_number', fields:[
        { name:'payment_id', label:'AR Payment', type:'select', source:'arPayments', required:true }, { name:'invoice_id', label:'AR Invoice', type:'select', source:'arInvoices', required:true }, { name:'applied_amount', label:'Applied Amount', type:'number', required:true }, { name:'application_date', label:'Application Date', type:'date' }, { name:'application_status', label:'Status', type:'select', options:[['applied','Applied'],['reversed','Reversed'],['void','Void']] }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['payment_id','Payment'],['invoice_id','Invoice'],['application_date','Date'],['applied_amount','Applied'],['application_status','Status']] },
      ap_payment_application: { label:'AP Payment Applications', rowsKey:'apPaymentApplications', valueKey:'id', labelField:'payment_number', fields:[
        { name:'payment_id', label:'AP Payment', type:'select', source:'apPayments', required:true }, { name:'bill_id', label:'AP Bill', type:'select', source:'apBills', required:true }, { name:'applied_amount', label:'Applied Amount', type:'number', required:true }, { name:'application_date', label:'Application Date', type:'date' }, { name:'application_status', label:'Status', type:'select', options:[['applied','Applied'],['reversed','Reversed'],['void','Void']] }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['payment_id','Payment'],['bill_id','Bill'],['application_date','Date'],['applied_amount','Applied'],['application_status','Status']] },
      accountant_handoff_export: { label:'Accountant Handoff Packages', rowsKey:'accountantHandoffExports', valueKey:'id', labelField:'export_title', fields:[
        { name:'export_kind', label:'Export Kind', type:'select', options:[['closeout_bundle','Closeout Bundle'],['period_close','Period Close'],['accountant_review','Accountant Review'],['custom','Custom']] }, { name:'entity_scope', label:'Entity Scope', type:'text' }, { name:'entity_id', label:'Entity ID / Period ID', type:'text', required:true }, { name:'business_tax_setting_id', label:'Tax Profile', type:'select', source:'businessTaxSettings' },
        { name:'export_status', label:'Export Status', type:'select', options:[['draft','Draft'],['prepared','Prepared'],['generated','Generated'],['delivered','Delivered'],['void','Void']] }, { name:'export_title', label:'Title', type:'text' }, { name:'bundle_kind', label:'Bundle Kind', type:'select', options:[['management_close_bundle','Management Close Bundle'],['corp_t2_bundle','Corp/T2 Bundle'],['llc_review_bundle','LLC Review Bundle'],['custom','Custom']] }, { name:'delivery_channel', label:'Delivery Channel', type:'select', options:[['manual','Manual'],['email','Email'],['download','Download']] }, { name:'delivered_to_email', label:'Delivered To Email', type:'email' },
        { name:'package_status', label:'Package Status', type:'select', options:[['draft','Draft'],['prepared','Prepared'],['reviewed','Reviewed'],['finalized','Finalized'],['delivered','Delivered']] }, { name:'package_markdown', label:'Package Markdown', type:'textarea', readonly:true }
      ], columns:[['export_title','Package'],['bundle_kind','Kind'],['package_status','Status'],['delivery_channel','Delivery'],['generated_at','Generated']] },
      ap_vendor: { label:'Vendors', rowsKey:'apVendors', valueKey:'id', labelField:'legal_name', fields:[
        { name:'vendor_code', label:'Vendor Code', type:'text' }, { name:'legal_name', label:'Legal Name', type:'text', required:true }, { name:'display_name', label:'Display Name', type:'text' },
        { name:'contact_name', label:'Contact Name', type:'text' }, { name:'contact_email', label:'Contact Email', type:'email' }, { name:'contact_phone', label:'Contact Phone', type:'text' }, { name:'payment_terms_days', label:'Terms (days)', type:'number' },
        { name:'tax_registration_number', label:'Tax Registration', type:'text' }, { name:'notes', label:'Notes', type:'textarea' }, { name:'is_active', label:'Active', type:'checkbox' }
      ], columns:[['vendor_code','Code'],['legal_name','Vendor'],['contact_name','Contact'],['is_active','Active']] },
      ar_invoice: { label:'AR Invoices', rowsKey:'arInvoices', valueKey:'id', labelField:'invoice_number', fields:[
        { name:'invoice_number', label:'Invoice Number', type:'text', required:true }, { name:'client_id', label:'Client', type:'select', source:'clients', required:true }, { name:'work_order_id', label:'Work Order', type:'select', source:'workOrders' },
        { name:'dispatch_id', label:'Dispatch', type:'select', source:'subcontractDispatches' }, { name:'recurring_service_agreement_id', label:'Agreement', type:'select', source:'recurringServiceAgreements' }, { name:'snow_event_trigger_id', label:'Snow Trigger', type:'select', source:'snowEventTriggers' }, { name:'service_contract_document_id', label:'Contract Doc', type:'select', source:'serviceContractDocuments' }, { name:'invoice_source', label:'Source', type:'select', options:[['manual','Manual'],['job','Job'],['agreement_visit','Agreement Visit'],['agreement_snow','Agreement Snow'],['change_order','Change Order'],['callback','Callback'],['contract','Contract']] }, { name:'invoice_status', label:'Status', type:'select', options:[['draft','Draft'],['issued','Issued'],['partial','Partial'],['paid','Paid'],['void','Void']] },
        { name:'invoice_date', label:'Invoice Date', type:'date' }, { name:'due_date', label:'Due Date', type:'date' }, { name:'subtotal', label:'Subtotal', type:'number' }, { name:'tax_total', label:'Tax Total', type:'number' }, { name:'total_amount', label:'Total Amount', type:'number' }, { name:'posted_amount', label:'Posted Amount', type:'number', readonly:true }, { name:'open_amount', label:'Open Amount', type:'number', readonly:true }, { name:'posted_percent', label:'Posted %', type:'number', readonly:true }, { name:'balance_due', label:'Balance Due', type:'number', readonly:true }
      ], columns:[['invoice_number','Invoice'],['invoice_source','Source'],['invoice_status','Status'],['invoice_date','Date'],['balance_due','Balance']] },
      ar_payment: { label:'AR Payments', rowsKey:'arPayments', valueKey:'id', labelField:'payment_number', fields:[
        { name:'payment_number', label:'Payment Number', type:'text', required:true }, { name:'client_id', label:'Client', type:'select', source:'clients', required:true },
        { name:'invoice_id', label:'Invoice', type:'select', source:'arInvoices' }, { name:'payment_date', label:'Payment Date', type:'date' }, { name:'payment_method', label:'Payment Method', type:'text' },
        { name:'reference_number', label:'Reference Number', type:'text' }, { name:'amount', label:'Amount', type:'number' }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['payment_number','Payment'],['client_id','Client'],['payment_date','Date'],['amount','Amount']] },
      ap_bill: { label:'AP Bills', rowsKey:'apBills', valueKey:'id', labelField:'bill_number', fields:[
        { name:'bill_number', label:'Bill Number', type:'text', required:true }, { name:'vendor_id', label:'Vendor', type:'select', source:'vendors', required:true }, { name:'bill_status', label:'Status', type:'select', options:[['draft','Draft'],['received','Received'],['scheduled','Scheduled'],['partial','Partial'],['paid','Paid'],['void','Void']] },
        { name:'bill_date', label:'Bill Date', type:'date' }, { name:'due_date', label:'Due Date', type:'date' }, { name:'subtotal', label:'Subtotal', type:'number' }, { name:'tax_total', label:'Tax Total', type:'number' }, { name:'total_amount', label:'Total Amount', type:'number' }, { name:'posted_amount', label:'Posted Amount', type:'number', readonly:true }, { name:'open_amount', label:'Open Amount', type:'number', readonly:true }, { name:'posted_percent', label:'Posted %', type:'number', readonly:true }, { name:'balance_due', label:'Balance Due', type:'number', readonly:true }
      ], columns:[['bill_number','Bill'],['bill_status','Status'],['bill_date','Date'],['balance_due','Balance']] },
      ap_payment: { label:'AP Payments', rowsKey:'apPayments', valueKey:'id', labelField:'payment_number', fields:[
        { name:'payment_number', label:'Payment Number', type:'text', required:true }, { name:'vendor_id', label:'Vendor', type:'select', source:'vendors', required:true },
        { name:'bill_id', label:'Bill', type:'select', source:'apBills' }, { name:'payment_date', label:'Payment Date', type:'date' }, { name:'payment_method', label:'Payment Method', type:'text' },
        { name:'reference_number', label:'Reference Number', type:'text' }, { name:'amount', label:'Amount', type:'number' }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['payment_number','Payment'],['vendor_id','Vendor'],['payment_date','Date'],['amount','Amount']] },
      material_receipt: { label:'Material Receipts', rowsKey:'materialReceipts', valueKey:'id', labelField:'receipt_number', fields:[
        { name:'receipt_number', label:'Receipt Number', type:'text', required:true }, { name:'vendor_id', label:'Vendor', type:'select', source:'vendors' }, { name:'client_site_id', label:'Client Site', type:'select', source:'clientSites' },
        { name:'work_order_id', label:'Work Order', type:'select', source:'workOrders' }, { name:'receipt_status', label:'Receipt Status', type:'select', options:[['draft','Draft'],['received','Received'],['checked_in','Checked In'],['closed','Closed']] },
        { name:'receipt_date', label:'Receipt Date', type:'date' }, { name:'received_by_profile_id', label:'Received By', type:'select', source:'profiles' }, { name:'line_count', label:'Line Count', type:'number', readonly:true }, { name:'quantity_total', label:'Quantity Total', type:'number', readonly:true }, { name:'receipt_total', label:'Receipt Total', type:'number', readonly:true }, { name:'allocated_receipt_total', label:'Allocated Receipt Total', type:'number', readonly:true }, { name:'unallocated_receipt_total', label:'Unallocated Receipt Total', type:'number', readonly:true }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['receipt_number','Receipt'],['receipt_status','Status'],['receipt_date','Date'],['vendor_id','Vendor']] },
      material_receipt_line: { label:'Material Receipt Lines', rowsKey:'materialReceiptLines', valueKey:'id', labelField:'description', fields:[
        { name:'receipt_id', label:'Receipt', type:'select', source:'materialReceipts', required:true }, { name:'line_order', label:'Line Order', type:'number' },
        { name:'material_id', label:'Material', type:'select', source:'materials' }, { name:'description', label:'Description', type:'text', required:true }, { name:'unit_id', label:'Unit', type:'select', source:'units' },
        { name:'quantity', label:'Quantity', type:'number' }, { name:'unit_cost', label:'Unit Cost', type:'number' }, { name:'line_total', label:'Line Total', type:'number', readonly:true },
        { name:'cost_code_id', label:'Cost Code', type:'select', source:'costCodes' }, { name:'work_order_line_id', label:'Work Order Line', type:'select', source:'workOrderLines' }
      ], columns:[['receipt_id','Receipt'],['line_order','Order'],['description','Description'],['line_total','Total']] },
      material_issue: { label:'Material Issues', rowsKey:'materialIssues', valueKey:'id', labelField:'issue_number', fields:[
        { name:'issue_number', label:'Issue Number', type:'text', required:true }, { name:'work_order_id', label:'Work Order', type:'select', source:'workOrders' }, { name:'client_site_id', label:'Client Site', type:'select', source:'clientSites' },
        { name:'issue_status', label:'Issue Status', type:'select', options:[['draft','Draft'],['issued','Issued'],['partial','Partial'],['closed','Closed'],['void','Void']] }, { name:'issue_date', label:'Issue Date', type:'date' }, { name:'issued_by_profile_id', label:'Issued By', type:'select', source:'profiles' },
        { name:'line_count', label:'Line Count', type:'number', readonly:true }, { name:'quantity_total', label:'Quantity Total', type:'number', readonly:true }, { name:'issue_total', label:'Issue Total', type:'number', readonly:true }, { name:'estimated_material_total', label:'Estimated Material Total', type:'number', readonly:true }, { name:'variance_amount', label:'Variance Amount', type:'number', readonly:true }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['issue_number','Issue'],['issue_status','Status'],['issue_date','Date'],['variance_amount','Variance']] },
      material_issue_line: { label:'Material Issue Lines', rowsKey:'materialIssueLines', valueKey:'id', labelField:'description', fields:[
        { name:'issue_id', label:'Issue', type:'select', source:'materialIssues', required:true }, { name:'line_order', label:'Line Order', type:'number' },
        { name:'material_id', label:'Material', type:'select', source:'materials' }, { name:'work_order_line_id', label:'Work Order Line', type:'select', source:'workOrderLines' }, { name:'description', label:'Description', type:'text', required:true }, { name:'unit_id', label:'Unit', type:'select', source:'units' },
        { name:'quantity', label:'Quantity', type:'number' }, { name:'unit_cost', label:'Unit Cost', type:'number' }, { name:'line_total', label:'Line Total', type:'number', readonly:true }, { name:'cost_code_id', label:'Cost Code', type:'select', source:'costCodes' }, { name:'notes', label:'Notes', type:'textarea' }
      ], columns:[['issue_id','Issue'],['line_order','Order'],['description','Description'],['line_total','Total']] },
      field_upload_failure: { label:'Upload Failure Trail', rowsKey:'fieldUploadFailures', valueKey:'id', labelField:'file_name', fields:[
        { name:'failure_scope', label:'Failure Scope', type:'text', readonly:true }, { name:'linked_record_type', label:'Linked Record Type', type:'text', readonly:true }, { name:'linked_record_id', label:'Linked Record ID', type:'text', readonly:true },
        { name:'job_code', label:'Job', type:'text', readonly:true }, { name:'packet_number', label:'Packet', type:'text', readonly:true }, { name:'file_name', label:'File Name', type:'text', readonly:true }, { name:'failure_stage', label:'Failure Stage', type:'text', readonly:true },
        { name:'failure_reason', label:'Failure Reason', type:'textarea', readonly:true }, { name:'retry_status', label:'Retry Status', type:'select', options:[['pending','Pending'],['retrying','Retrying'],['resolved','Resolved'],['abandoned','Abandoned']] }, { name:'upload_attempts', label:'Attempts', type:'number' },
        { name:'retry_owner_profile_id', label:'Retry Owner', type:'select', source:'profiles' }, { name:'retry_owner_notes', label:'Retry Owner Notes', type:'textarea' }, { name:'last_retry_at', label:'Last Retry At', type:'datetime-local' }, { name:'next_retry_after', label:'Next Retry After', type:'datetime-local' }, { name:'resolution_notes', label:'Resolution Notes', type:'textarea' }
      ], columns:[['failure_scope','Scope'],['file_name','File'],['retry_status','Retry'],['created_at','Created']] },
      app_traffic_event: { label:'Traffic Events', rowsKey:'appTrafficEvents', valueKey:'id', labelField:'event_name', fields:[
        { name:'event_name', label:'Event', type:'text', readonly:true }, { name:'route_name', label:'Route', type:'text', readonly:true }, { name:'page_path', label:'Page Path', type:'text', readonly:true }, { name:'endpoint_path', label:'Endpoint', type:'text', readonly:true },
        { name:'http_status', label:'HTTP Status', type:'number', readonly:true }, { name:'duration_ms', label:'Duration (ms)', type:'number', readonly:true }, { name:'role_label', label:'Role', type:'text', readonly:true }, { name:'is_authenticated', label:'Authenticated', type:'checkbox', readonly:true },
        { name:'referrer', label:'Referrer', type:'text', readonly:true }, { name:'created_at', label:'Created At', type:'datetime-local', readonly:true }
      ], columns:[['event_name','Event'],['route_name','Route'],['endpoint_path','Endpoint'],['created_at','Created']] },
      backend_monitor_event: { label:'Backend Monitor Events', rowsKey:'backendMonitorEvents', valueKey:'id', labelField:'title', fields:[
        { name:'monitor_scope', label:'Scope', type:'text', readonly:true }, { name:'event_name', label:'Event', type:'text', readonly:true }, { name:'severity', label:'Severity', type:'select', options:[['info','Info'],['warning','Warning'],['error','Error'],['critical','Critical']] },
        { name:'lifecycle_status', label:'Lifecycle Status', type:'select', options:[['open','Open'],['investigating','Investigating'],['resolved','Resolved'],['dismissed','Dismissed']] }, { name:'route_name', label:'Route', type:'text', readonly:true }, { name:'endpoint_path', label:'Endpoint', type:'text', readonly:true },
        { name:'function_name', label:'Function', type:'text', readonly:true }, { name:'http_status', label:'HTTP Status', type:'number', readonly:true }, { name:'title', label:'Title', type:'text', readonly:true }, { name:'message', label:'Message', type:'textarea', readonly:true },
        { name:'occurrence_count', label:'Occurrences', type:'number', readonly:true }, { name:'resolution_notes', label:'Resolution Notes', type:'textarea' }, { name:'resolved_at', label:'Resolved At', type:'datetime-local', readonly:true }
      ], columns:[['monitor_scope','Scope'],['severity','Severity'],['lifecycle_status','Status'],['title','Title']] }
    };

    function getBackboneRows(entity) {
      const map = { unit_of_measure: state.unitsOfMeasure || [], cost_code: state.costCodes || [], tax_code: state.taxCodes || [], business_tax_setting: state.businessTaxSettings || [], service_pricing_template: state.servicePricingTemplates || [], job_financial_event: state.jobFinancialEvents || [], recurring_service_agreement: state.recurringServiceAgreements || [], snow_event_trigger: state.snowEventTriggers || [], change_order: state.changeOrders || [], service_contract_document: state.serviceContractDocuments || [], customer_asset: state.customerAssets || [], customer_asset_job_link: state.customerAssetJobLinks || [], warranty_callback_event: state.warrantyCallbackEvents || [], payroll_export_run: state.payrollExportRuns || [], employee_time_entry: state.employeeTimeClockEntries || [], employee_time_entry_review: state.employeeTimeEntryReviews || [], service_execution_scheduler_setting: state.serviceExecutionSchedulerSettings || [], service_area: state.serviceAreas || [], route: state.routes || [], route_stop: state.routeStops || [], route_stop_execution: state.routeStopExecutions || [], route_stop_execution_attachment: state.routeStopExecutionAttachments || [], client: state.clients || [], client_site: state.clientSites || [], material: state.materialsCatalog || [], equipment_master: state.equipmentMaster || [], estimate: state.estimates || [], estimate_line: state.estimateLines || [], work_order: state.workOrders || [], work_order_line: state.workOrderLines || [], subcontract_client: state.subcontractClients || [], subcontract_dispatch: state.subcontractDispatches || [], linked_hse_packet: state.linkedHsePackets || [], hse_packet_event: state.hsePacketEvents || [], hse_packet_proof: state.hsePacketProofs || [], field_upload_failure: state.fieldUploadFailures || [], app_traffic_event: state.appTrafficEvents || [], backend_monitor_event: state.backendMonitorEvents || [], gl_account: state.chartOfAccounts || [], gl_journal_batch: state.glJournalBatches || [], gl_journal_sync_exception: state.glJournalSyncExceptions || [], gl_journal_entry: state.glJournalEntries || [], ap_vendor: state.apVendors || [], ar_invoice: state.arInvoices || [], ar_payment: state.arPayments || [], ap_bill: state.apBills || [], ap_payment: state.apPayments || [], bank_account: state.bankAccounts || [], accounting_period_close: state.accountingPeriodCloses || [], sales_tax_filing: state.salesTaxFilings || [], payroll_remittance_run: state.payrollRemittanceRuns || [], bank_statement_import: state.bankStatementImports || [], bank_reconciliation_session: state.bankReconciliationSessions || [], bank_reconciliation_item: state.bankReconciliationItems || [], ar_payment_application: state.arPaymentApplications || [], ap_payment_application: state.apPaymentApplications || [], accountant_handoff_export: state.accountantHandoffExports || [], material_receipt: state.materialReceipts || [], material_receipt_line: state.materialReceiptLines || [], material_issue: state.materialIssues || [], material_issue_line: state.materialIssueLines || [] };
      return Array.isArray(map[entity]) ? map[entity] : [];
    }

    function getBackboneOptionRows(source) {
      const profiles = Array.isArray(state.selectors.profiles) ? state.selectors.profiles : state.users || [];
      const map = {
        profiles,
        supervisorProfiles: profiles.filter((row) => ['supervisor','admin','hse','job_admin','site_leader'].includes(String(row.role || row.staff_tier || '').toLowerCase())),
        sites: state.selectors.sites || state.sites || [],
        units: state.selectors.units || state.unitsOfMeasure || [],
        serviceAreas: state.selectors.serviceAreas || state.serviceAreas || [],
        routes: state.selectors.routes || state.routes || [],
        jobs: state.selectors.jobs || state.jobs || [],
        routeStops: state.selectors.routeStops || state.routeStops || [],
        routeStopExecutions: state.selectors.routeStopExecutions || state.routeStopExecutions || [],
        routeStopExecutionAttachments: state.selectors.routeStopExecutionAttachments || state.routeStopExecutionAttachments || [],
        clients: state.selectors.clients || state.clients || [],
        clientSites: state.selectors.clientSites || state.clientSites || [],
        materials: state.selectors.materials || state.materialsCatalog || [],
        equipmentMaster: state.selectors.equipmentMaster || state.equipmentMaster || [],
        estimates: state.selectors.estimates || state.estimates || [],
        estimateLines: state.selectors.estimateLines || state.estimateLines || [],
        workOrders: state.selectors.workOrders || state.workOrders || [],
        workOrderLines: state.selectors.workOrderLines || state.workOrderLines || [],
        subcontractClients: state.selectors.subcontractClients || state.subcontractClients || [],
        subcontractDispatches: state.selectors.subcontractDispatches || state.subcontractDispatches || [],
        linkedHsePackets: state.selectors.linkedHsePackets || state.linkedHsePackets || [],
        hsePacketEvents: state.selectors.hsePacketEvents || state.hsePacketEvents || [],
        hsePacketProofs: state.selectors.hsePacketProofs || state.hsePacketProofs || [],
        glAccounts: state.selectors.glAccounts || state.chartOfAccounts || [],
        glJournalBatches: state.selectors.glJournalBatches || state.glJournalBatches || [],
        glJournalEntries: state.selectors.glJournalEntries || state.glJournalEntries || [],
        vendors: state.selectors.vendors || state.apVendors || [],
        arInvoices: state.selectors.arInvoices || state.arInvoices || [],
        arPayments: state.selectors.arPayments || state.arPayments || [],
        apBills: state.selectors.apBills || state.apBills || [],
        apPayments: state.selectors.apPayments || state.apPayments || [],
        bankAccounts: state.selectors.bankAccounts || state.bankAccounts || [],
        accountingPeriodCloses: state.selectors.accountingPeriodCloses || state.accountingPeriodCloses || [],
        salesTaxFilings: state.selectors.salesTaxFilings || state.salesTaxFilings || [],
        payrollRemittanceRuns: state.selectors.payrollRemittanceRuns || state.payrollRemittanceRuns || [],
        bankStatementImports: state.selectors.bankStatementImports || state.bankStatementImports || [],
        bankReconciliationSessions: state.selectors.bankReconciliationSessions || state.bankReconciliationSessions || [],
        bankReconciliationItems: state.selectors.bankReconciliationItems || state.bankReconciliationItems || [],
        arPaymentApplications: state.selectors.arPaymentApplications || state.arPaymentApplications || [],
        apPaymentApplications: state.selectors.apPaymentApplications || state.apPaymentApplications || [],
        accountantHandoffExports: state.selectors.accountantHandoffExports || state.accountantHandoffExports || [],
        materialReceipts: state.selectors.materialReceipts || state.materialReceipts || [],
        materialReceiptLines: state.selectors.materialReceiptLines || state.materialReceiptLines || [],
        materialIssues: state.selectors.materialIssues || state.materialIssues || [],
        materialIssueLines: state.selectors.materialIssueLines || state.materialIssueLines || [],
        costCodes: state.selectors.costCodes || state.costCodes || [],
        taxCodes: state.selectors.taxCodes || state.taxCodes || [],
        servicePricingTemplates: state.selectors.servicePricingTemplates || state.servicePricingTemplates || [],
        recurringServiceAgreements: state.recurringServiceAgreements || [],
        snowEventTriggers: state.snowEventTriggers || [],
        serviceContractDocuments: state.serviceContractDocuments || [],
        customerAssets: state.customerAssets || [],
        employeeTimeClockEntries: state.employeeTimeClockEntries || [],
        jobTypes: state.selectors.jobTypes || []
      };
      return Array.isArray(map[source]) ? map[source] : [];
    }

    function getBackboneOptionLabel(source, row) {
      if (!row) return '';
      if (source === 'profiles' || source === 'supervisorProfiles') return `${row.full_name || row.email || row.id}${row.role ? ` (${row.role})` : ''}`;
      if (source === 'sites') return `${row.site_code || ''}${row.site_name ? ` - ${row.site_name}` : ''}`;
      if (source === 'units') return `${row.code || ''}${row.name ? ` - ${row.name}` : ''}`;
      if (source === 'serviceAreas') return `${row.area_code || ''}${row.name ? ` - ${row.name}` : ''}`;
      if (source === 'routes') return `${row.route_code || ''}${row.name ? ` - ${row.name}` : ''}`;
      if (source === 'routeStops') return `${row.stop_order ?? ''}${row.instructions ? ` - ${row.instructions}` : ''}`;
      if (source === 'routeStopExecutions') return `${row.execution_date || ''}${row.execution_status ? ` - ${row.execution_status}` : ''}`;
      if (source === 'jobs') return `${row.job_code || ''}${row.job_name ? ` - ${row.job_name}` : ''}`;
      if (source === 'routeStopExecutionAttachments') return row.file_name || row.caption || row.id;
      if (source === 'clients') return row.display_name || row.legal_name || row.client_code || row.id;
      if (source === 'clientSites') return row.site_name || row.site_code || row.id;
      if (source === 'materials') return row.item_name || row.sku || row.id;
      if (source === 'equipmentMaster') return row.item_name || row.equipment_code || row.id;
      if (source === 'estimates') return row.estimate_number || row.id;
      if (source === 'estimateLines') return `${row.line_order ?? ''} - ${row.description || row.id}`;
      if (source === 'workOrders') return row.work_order_number || row.id;
      if (source === 'workOrderLines') return `${row.line_order ?? ''} - ${row.description || row.id}`;
      if (source === 'subcontractClients') return row.company_name || row.subcontract_code || row.id;
      if (source === 'subcontractDispatches') return row.dispatch_number || row.id;
      if (source === 'linkedHsePackets') return row.packet_number || row.id;
      if (source === 'hsePacketEvents') return `${row.event_type || 'event'}${row.event_at ? ` @ ${String(row.event_at).replace('T', ' ').slice(0, 16)}` : ''}`;
      if (source === 'hsePacketProofs') return row.file_name || row.caption || row.id;
      if (source === 'glAccounts') return `${row.account_number || ''} - ${row.account_name || row.id}`;
      if (source === 'glJournalBatches') return row.batch_number || row.id;
      if (source === 'glJournalEntries') return `${row.line_number ?? ''}${row.memo ? ` - ${row.memo}` : ''}`;
      if (source === 'vendors') return row.display_name || row.legal_name || row.vendor_code || row.id;
      if (source === 'arInvoices') return row.invoice_number || row.id;
      if (source === 'arPayments') return row.payment_number || row.id;
      if (source === 'apBills') return row.bill_number || row.id;
      if (source === 'apPayments') return row.payment_number || row.id;
      if (source === 'bankAccounts') return `${row.account_name || row.institution_name || row.id}${row.account_mask ? ` (${row.account_mask})` : ''}`;
      if (source === 'accountingPeriodCloses') return `${row.period_code || row.id}${row.close_status ? ` - ${row.close_status}` : ''}`;
      if (source === 'salesTaxFilings') return `${row.filing_code || row.id}${row.review_status ? ` - ${row.review_status}` : ''}`;
      if (source === 'payrollRemittanceRuns') return `${row.remittance_code || row.id}${row.review_status ? ` - ${row.review_status}` : ''}`;
      if (source === 'bankStatementImports') return `${row.import_code || row.id}${row.statement_end ? ` - ${row.statement_end}` : ''}`;
      if (source === 'bankReconciliationSessions') return `${row.session_code || row.id}${row.reconciliation_status ? ` - ${row.reconciliation_status}` : ''}`;
      if (source === 'bankReconciliationItems') return `${row.item_date || ''} ${row.item_description || row.id}`.trim();
      if (source === 'arPaymentApplications' || source === 'apPaymentApplications') return `${row.application_date || ''} ${row.applied_amount || ''}`.trim() || row.id;
      if (source === 'accountantHandoffExports') return row.export_title || row.export_kind || row.id;
      if (source === 'materialReceipts') return row.receipt_number || row.id;
      if (source === 'materialReceiptLines') return `${row.line_order ?? ''} - ${row.description || row.id}`;
      if (source === 'materialIssues') return row.issue_number || row.id;
      if (source === 'materialIssueLines') return `${row.line_order ?? ''} - ${row.description || row.id}`;
      if (source === 'costCodes') return `${row.code || ''}${row.name ? ` - ${row.name}` : ''}`;
      if (source === 'jobTypes') return row.name || row.id;
      return row.name || row.id || '';
    }

    function formatBackboneValue(field, row) {
      const value = row?.[field.name];
      if (field.type === 'checkbox') return !!value;
      if (field.type === 'date' && value) return String(value).slice(0, 10);
      if (field.type === 'datetime-local' && value) return String(value).replace(' ', 'T').slice(0, 16);
      return value == null ? '' : String(value);
    }

    function getBackboneFieldConfig(entity, key) {
      const cfg = BACKBONE_CONFIG[entity];
      return cfg?.fields?.find((field) => field.name === key) || null;
    }

    function formatMoney(value) {
      const n = Number(value || 0);
      return Number.isFinite(n) ? n.toFixed(2) : '0.00';
    }

    function setBackboneInputValue(name, value) {
      const input = document.getElementById(`ad_bb_${name}`);
      if (!input) return;
      if (input.type === 'checkbox') {
        input.checked = !!value;
        return;
      }
      input.value = value == null ? '' : String(value);
    }

    function getBackboneDisplayValue(entity, key, row) {
      const field = getBackboneFieldConfig(entity, key);
      const value = row?.[key];
      if (!field) return value == null ? '' : String(value);
      if (field.type === 'checkbox') return value ? 'Yes' : 'No';
      if (field.type === 'select') {
        if (Array.isArray(field.options)) {
          const match = field.options.find((opt) => String(opt[0]) === String(value ?? ''));
          return match ? match[1] : (value == null ? '' : String(value));
        }
        const option = getBackboneOptionRows(field.source).find((item) => String(item?.[field.optionValueKey || 'id']) === String(value ?? ''));
        return option ? getBackboneOptionLabel(field.source, option) : (value == null ? '' : String(value));
      }
      if (field.type === 'date' && value) return String(value).slice(0, 10);
      if (field.type === 'datetime-local' && value) return String(value).replace('T', ' ').slice(0, 16);
      return value == null ? '' : String(value);
    }

    function getHsePreviewFromInputs() {
      const flagPairs = [
        ['briefing_required', 'briefing_completed'],
        ['inspection_required', 'inspection_completed'],
        ['emergency_review_required', 'emergency_review_completed'],
        ['weather_monitoring_required', 'weather_monitoring_completed'],
        ['heat_monitoring_required', 'heat_monitoring_completed'],
        ['chemical_handling_required', 'chemical_handling_completed'],
        ['traffic_control_required', 'traffic_control_completed'],
        ['field_signoff_required', 'field_signoff_completed']
      ];
      const requiredCount = flagPairs.reduce((sum, [required]) => sum + (document.getElementById(`ad_bb_${required}`)?.checked ? 1 : 0), 0);
      const completedCount = flagPairs.reduce((sum, [required, completed]) => sum + ((document.getElementById(`ad_bb_${required}`)?.checked && document.getElementById(`ad_bb_${completed}`)?.checked) ? 1 : 0), 0);
      const closeoutCompleted = !!document.getElementById('ad_bb_closeout_completed')?.checked;
      const reopenInProgress = !!document.getElementById('ad_bb_reopen_in_progress')?.checked;
      const percent = closeoutCompleted ? 100 : (requiredCount ? Math.round((completedCount / requiredCount) * 10000) / 100 : 100);
      let status = String(document.getElementById('ad_bb_packet_status')?.value || 'draft');
      if (reopenInProgress) {
        status = 'in_progress';
      } else if (closeoutCompleted || status === 'closed') {
        status = 'closed';
      } else {
        status = percent >= 100 ? 'ready_for_closeout' : completedCount > 0 ? 'in_progress' : 'draft';
      }
      return { requiredCount, completedCount, percent, status };
    }


    function getAdminSectionForEntity(entity = '') {
      const clean = String(entity || '').trim();
      if (!clean) return 'people';
      if (['linked_hse_packet','hse_packet_event','hse_packet_proof','field_upload_failure','app_traffic_event','backend_monitor_event'].includes(clean)) return 'safety';
      if (['gl_account','gl_journal_batch','gl_journal_entry','gl_journal_sync_exception','bank_account','accounting_period_close','sales_tax_filing','payroll_remittance_run','bank_statement_import','bank_reconciliation_session','bank_reconciliation_item','ar_payment_application','ap_payment_application','accountant_handoff_export','ap_vendor','ar_invoice','ar_payment','ap_bill','ap_payment','material_receipt','material_receipt_line','material_issue','material_issue_line','job_financial_event','payroll_export_run'].includes(clean)) return 'accounting';
      if (['route','route_stop','route_stop_execution','route_stop_execution_attachment','client','client_site','material','equipment_master','estimate','estimate_line','work_order','work_order_line','subcontract_client','subcontract_dispatch','recurring_service_agreement','service_contract_document','customer_asset','customer_asset_job_link','warranty_callback_event','service_execution_scheduler_setting','employee_time_entry','employee_time_entry_review'].includes(clean)) return 'operations';
      return 'people';
    }

    function getAdminSectionLabel(sectionName = 'people') {
      const clean = String(sectionName || 'people').trim() || 'people';
      return ADMIN_SECTION_GROUPS.find(([key]) => key === clean)?.[1] || 'People and Access';
    }

    function applyAdminSectionFilter(sectionName = 'people') {
      const clean = String(sectionName || 'people').trim() || 'people';
      state.adminSection = clean;
      document.querySelectorAll('#admin [data-admin-section-groups]').forEach((panel) => {
        const groups = String(panel.getAttribute('data-admin-section-groups') || '').split(',').map((v) => v.trim()).filter(Boolean);
        const visible = clean === 'all' || groups.includes(clean);
        panel.style.display = visible ? '' : 'none';
      });
      document.querySelectorAll('#ad_section_nav [data-admin-section]').forEach((btn) => {
        const active = String(btn.getAttribute('data-admin-section') || '') === clean;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      const current = document.getElementById('ad_section_current');
      if (current) current.textContent = getAdminSectionLabel(clean);
      const nav = document.getElementById('ad_section_nav');
      if (nav && window.matchMedia?.('(max-width: 720px)').matches) {
        nav.classList.remove('is-open');
        nav.querySelector('[data-admin-section-toggle]')?.setAttribute('aria-expanded', 'false');
      }
    }

    function setupAdminSectionNav() {
      const nav = document.getElementById('ad_section_nav');
      if (!nav || nav.dataset.ready === '1') return;
      nav.dataset.ready = '1';
      nav.innerHTML = `
        <button class="secondary admin-section-toggle" type="button" data-admin-section-toggle aria-expanded="false">
          <span>Admin sections</span>
          <span id="ad_section_current" class="admin-section-current">${escHtml(getAdminSectionLabel(state.adminSection || 'people'))}</span>
        </button>
        <div class="admin-section-list" role="tablist" aria-label="Admin section groups">
          ${ADMIN_SECTION_GROUPS.map(([key, label]) => `<button class="secondary admin-section-btn" type="button" data-admin-section="${escHtml(key)}" aria-selected="false">${escHtml(label)}</button>`).join('')}
        </div>
      `;
      document.querySelectorAll('#admin .admin-panel-block').forEach((panel) => {
        const heading = panel.querySelector('h3')?.textContent?.trim() || '';
        const groups = ADMIN_PANEL_GROUPS[heading] || ['operations'];
        panel.setAttribute('data-admin-section-groups', groups.join(','));
      });
      nav.querySelector('[data-admin-section-toggle]')?.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('is-open');
        nav.querySelector('[data-admin-section-toggle]')?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
      nav.querySelectorAll('[data-admin-section]').forEach((btn) => {
        btn.addEventListener('click', () => applyAdminSectionFilter(btn.getAttribute('data-admin-section') || 'people'));
      });
      applyAdminSectionFilter(state.adminSection || 'people');
    }

    function resolveTopHseActionItem() {
      const rows = Array.isArray(state.hsePacketActionItems) ? [...state.hsePacketActionItems] : [];
      rows.sort((a, b) => Number(a?.action_priority || 999) - Number(b?.action_priority || 999));
      return rows.find((item) => item?.needs_attention) || rows[0] || null;
    }

    function resolveTopMonitorAlert() {
      const rank = { error: 1, warning: 2, info: 3 };
      const rows = Array.isArray(state.monitorThresholdAlerts) ? [...state.monitorThresholdAlerts] : [];
      rows.sort((a, b) => (rank[String(a?.alert_level || '').toLowerCase()] || 9) - (rank[String(b?.alert_level || '').toLowerCase()] || 9));
      return rows[0] || null;
    }

    function setActiveAdminHubFocus(entity = '') {
      document.querySelectorAll('[data-admin-focus-entity]').forEach((btn) => {
        const primary = String(btn.getAttribute('data-admin-focus-entity') || '').trim();
        const secondary = String(btn.getAttribute('data-admin-focus-secondary') || '').trim();
        const active = entity && (entity === primary || entity === secondary);
        btn.classList.toggle('active', !!active);
        if (active) btn.setAttribute('aria-current', 'true');
        else btn.removeAttribute('aria-current');
      });
    }

    function focusAdminBackboneEntity(entity, options = {}) {
      const e = els();
      if (!e.backboneEntity) return;
      const targetEntity = String(entity || '').trim() || 'unit_of_measure';
      const preferredId = String(options.preferredId || '').trim();
      e.backboneEntity.value = targetEntity;
      renderBackboneTable();
      if (e.backboneItemId) {
        const rows = getBackboneRows(targetEntity);
        const fallbackId = rows[0]?.id ? String(rows[0].id) : '';
        e.backboneItemId.value = preferredId || fallbackId || '';
      }
      fillBackboneForm(getSelectedBackboneRecord());
      renderBackboneInsights();
      setActiveAdminHubFocus(targetEntity);
      applyAdminSectionFilter(getAdminSectionForEntity(targetEntity));
      document.getElementById('ad_backbone_fields')?.scrollIntoView({ behavior:'smooth', block:'start' });
      if (options.summary) setSummary(options.summary, false);
    }

    function focusAdminHubEntity(entity, options = {}) {
      const clean = String(entity || '').trim();
      if (!clean) return;
      const preferredIdOverride = String(options?.preferredId || '').trim();
      const summaryOverride = String(options?.summary || '').trim();
      const targetEntityOverride = String(options?.targetEntity || '').trim();
      if (clean === 'linked_hse_packet') {
        const actionItem = resolveTopHseActionItem();
        const preferredId = preferredIdOverride || actionItem?.packet_id || actionItem?.id || state.linkedHsePackets?.[0]?.id || '';
        const summary = summaryOverride || (actionItem ? `Focused Linked HSE Packets. Top follow-up: ${actionItem.packet_number || actionItem.packet_id || 'packet'} — ${actionItem.action_title || actionItem.action_summary || 'review required'}` : 'Focused Linked HSE Packets.');
        focusAdminBackboneEntity('linked_hse_packet', { preferredId, summary });
        return;
      }
      if (clean === 'app_traffic_event' || clean === 'backend_monitor_event' || clean === 'field_upload_failure') {
        const topAlert = resolveTopMonitorAlert();
        const targetEntity = targetEntityOverride || (clean === 'field_upload_failure'
          ? 'field_upload_failure'
          : (((topAlert && String(topAlert.alert_key || '').includes('monitor')) || (state.backendMonitorEvents || []).length) ? 'backend_monitor_event' : 'app_traffic_event'));
        const preferredId = preferredIdOverride || (targetEntity === 'backend_monitor_event'
          ? (state.backendMonitorEvents?.[0]?.id || '')
          : (targetEntity === 'field_upload_failure' ? (state.fieldUploadFailures?.[0]?.id || '') : (state.appTrafficEvents?.[0]?.id || '')));
        const summary = summaryOverride || (topAlert ? `Focused Analytics / Traffic Monitor. Current threshold: ${topAlert.alert_title || topAlert.alert_key} (${topAlert.alert_level || 'warning'}).` : 'Focused Analytics / Traffic Monitor.');
        focusAdminBackboneEntity(targetEntity, { preferredId, summary });
        return;
      }
      focusAdminBackboneEntity(targetEntityOverride || clean, { preferredId: preferredIdOverride, summary: summaryOverride || `Focused ${clean.replaceAll('_', ' ')}.` });
    }

    function renderBackboneInsights(row = null) {
      const e = els();
      if (!e.backboneInsights) return;
      const entity = e.backboneEntity?.value || 'unit_of_measure';
      const selected = row || getSelectedBackboneRecord() || null;
      const cards = [];
      const val = (name) => document.getElementById(`ad_bb_${name}`)?.value || '';
      const checked = (name) => !!document.getElementById(`ad_bb_${name}`)?.checked;

      if (entity === 'route' || entity === 'route_stop') {
        const routeId = entity === 'route' ? (selected?.id || e.backboneItemId?.value || '') : (val('route_id') || selected?.route_id || '');
        const stops = (state.routeStops || []).filter((item) => String(item.route_id || '') === String(routeId || ''));
        const plannedMinutes = stops.reduce((sum, item) => sum + Number(item.planned_duration_minutes || 0), 0);
        cards.push({ title: 'Route Stops', value: String(stops.length), help: 'Loaded stops for the selected route.' });
        cards.push({ title: 'Planned Minutes', value: String(plannedMinutes), help: 'Sum of planned duration across loaded stops.' });
        cards.push({ title: 'Next Stop Order', value: String(stops.reduce((max, item) => Math.max(max, Number(item.stop_order || 0)), 0) + 10), help: 'Suggested next stop order for a new stop.' });
      }

      if (entity === 'route_stop_execution' || entity === 'route_stop_execution_attachment') {
        const executionId = entity === 'route_stop_execution' ? (selected?.id || e.backboneItemId?.value || '') : (val('execution_id') || selected?.execution_id || '');
        const execution = (state.routeStopExecutions || []).find((item) => String(item.id) === String(executionId)) || null;
        const attachments = (state.routeStopExecutionAttachments || []).filter((item) => String(item.execution_id || '') === String(executionId));
        cards.push({ title: 'Execution Status', value: String(execution?.execution_status || val('execution_status') || 'planned').replaceAll('_', ' '), help: 'Current lifecycle state for the selected route stop visit.' });
        cards.push({ title: 'Attachments', value: String(execution?.attachment_count || attachments.length), help: 'Notes, photos, signatures, and other attachments linked to this execution.' });
        cards.push({ title: 'Delay Minutes', value: String(execution?.delay_minutes || val('delay_minutes') || 0), help: 'Use delayed for late arrivals and exceptions.' });
      }

      if (entity === 'estimate' || entity === 'estimate_line') {
        const estimateId = entity === 'estimate' ? (selected?.id || e.backboneItemId?.value || '') : (val('estimate_id') || selected?.estimate_id || '');
        const estimate = (state.estimates || []).find((item) => String(item.id) === String(estimateId)) || null;
        const lines = (state.estimateLines || []).filter((item) => String(item.estimate_id || '') === String(estimateId));
        const rolledSubtotal = lines.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
        cards.push({ title: 'Estimate Lines', value: String(lines.length), help: 'Loaded lines for the selected estimate.' });
        cards.push({ title: 'Rolled Subtotal', value: `$${formatMoney(rolledSubtotal)}`, help: 'Line total rollup before tax.' });
        cards.push({ title: 'Rolled Total', value: `$${formatMoney(rolledSubtotal + Number(estimate?.tax_total || 0))}`, help: 'Current subtotal plus tax.' });
      }

      if (entity === 'estimate_line') {
        cards.push({ title: 'Derived Line Total', value: `$${formatMoney(Number(val('quantity') || 0) * Number(val('unit_price') || 0))}`, help: 'Auto-calculated from quantity × unit price.' });
      }

      if (entity === 'work_order' || entity === 'work_order_line') {
        const workOrderId = entity === 'work_order' ? (selected?.id || e.backboneItemId?.value || '') : (val('work_order_id') || selected?.work_order_id || '');
        const workOrder = (state.workOrders || []).find((item) => String(item.id) === String(workOrderId)) || null;
        const lines = (state.workOrderLines || []).filter((item) => String(item.work_order_id || '') === String(workOrderId));
        const rolledSubtotal = lines.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
        const actualMaterialCost = lines.reduce((sum, item) => sum + Number(item.actual_material_cost || 0), 0);
        const packets = (state.linkedHsePackets || []).filter((item) => String(item.work_order_id || '') === String(workOrderId));
        cards.push({ title: 'Work Order Lines', value: String(workOrder?.line_count || lines.length), help: 'Loaded lines for the selected work order.' });
        cards.push({ title: 'Rolled Total', value: `$${formatMoney(Number(workOrder?.rolled_total || (rolledSubtotal + Number(workOrder?.tax_total || 0))))}`, help: 'Current subtotal plus tax.' });
        cards.push({ title: 'Receipt Count', value: String(workOrder?.receipt_count || 0), help: 'Receipts linked directly to this work order.' });
        cards.push({ title: 'Actual Material Cost', value: `$${formatMoney(Number(workOrder?.received_material_cost_total || actualMaterialCost))}`, help: 'Received material cost linked to work-order lines and receipts.' });
        cards.push({ title: 'Unallocated Receipt Cost', value: `$${formatMoney(Number(workOrder?.unallocated_receipt_cost_total || 0))}`, help: 'Receipt cost not yet tied to a work-order line.' });
        cards.push({ title: 'Open HSE Packets', value: String(workOrder?.open_hse_packets || packets.filter((item) => !['ready_for_closeout', 'closed'].includes(String(item.packet_status || ''))).length), help: 'Linked packets still in draft or in progress.' });
      }

      if (entity === 'work_order_line') {
        cards.push({ title: 'Derived Sell Total', value: `$${formatMoney(Number(val('quantity') || 0) * Number(val('unit_price') || 0))}`, help: 'Auto-calculated from quantity × unit price.' });
        cards.push({ title: 'Actual Qty Received', value: String(val('actual_quantity_received') || selected?.actual_quantity_received || 0), help: 'Updated from linked material receipts.' });
        cards.push({ title: 'Actual Material Cost', value: `$${formatMoney(val('actual_material_cost') || selected?.actual_material_cost || 0)}`, help: 'Updated from linked material receipts.' });
      }

      if (entity === 'ar_invoice') {
        const total = Number(val('total_amount') || selected?.total_amount || 0);
        const balance = Number(val('balance_due') || selected?.balance_due || total);
        cards.push({ title: 'Invoice Total', value: `$${formatMoney(total)}`, help: 'Current invoice total.' });
        cards.push({ title: 'Open Balance', value: `$${formatMoney(Number(selected?.open_amount || balance))}`, help: 'Remaining receivable after posted payments.' });
        cards.push({ title: 'Posted Amount', value: `$${formatMoney(Number(selected?.posted_amount || Math.max(total - balance, 0)))}`, help: 'Total posted payments against this invoice.' });
        cards.push({ title: 'Posted %', value: `${formatMoney(Number(selected?.posted_percent || 0))}%`, help: 'Percent of the invoice total already posted.' });
      }

      if (entity === 'route_stop_execution') {
        bind('route_stop_id', () => {
          const stop = (state.routeStops || []).find((item) => String(item.id) === String(document.getElementById('ad_bb_route_stop_id')?.value || ''));
          if (stop) {
            if (!document.getElementById('ad_bb_route_id')?.value && stop.route_id) setBackboneInputValue('route_id', stop.route_id);
            if (!document.getElementById('ad_bb_client_site_id')?.value && stop.client_site_id) setBackboneInputValue('client_site_id', stop.client_site_id);
          }
          renderBackboneInsights();
        }, 'change');
      }
      if (entity === 'ar_payment') {
        const invoice = (state.arInvoices || []).find((item) => String(item.id) === String(val('invoice_id') || selected?.invoice_id || '')) || null;
        cards.push({ title: 'Suggested Post', value: `$${formatMoney(invoice?.balance_due || 0)}`, help: 'Defaults to the loaded invoice balance when amount is blank.' });
        cards.push({ title: 'Invoice Balance', value: `$${formatMoney(invoice?.balance_due || 0)}`, help: 'Open balance on the selected AR invoice.' });
      }

      if (entity === 'ap_bill') {
        const total = Number(val('total_amount') || selected?.total_amount || 0);
        const balance = Number(val('balance_due') || selected?.balance_due || total);
        cards.push({ title: 'Bill Total', value: `$${formatMoney(total)}`, help: 'Current bill total.' });
        cards.push({ title: 'Open Balance', value: `$${formatMoney(Number(selected?.open_amount || balance))}`, help: 'Remaining payable after posted payments.' });
        cards.push({ title: 'Posted Amount', value: `$${formatMoney(Number(selected?.posted_amount || Math.max(total - balance, 0)))}`, help: 'Total posted payments against this bill.' });
        cards.push({ title: 'Posted %', value: `${formatMoney(Number(selected?.posted_percent || 0))}%`, help: 'Percent of the bill total already posted.' });
      }

      if (entity === 'ap_payment') {
        const bill = (state.apBills || []).find((item) => String(item.id) === String(val('bill_id') || selected?.bill_id || '')) || null;
        cards.push({ title: 'Suggested Post', value: `$${formatMoney(bill?.balance_due || 0)}`, help: 'Defaults to the loaded bill balance when amount is blank.' });
        cards.push({ title: 'Bill Balance', value: `$${formatMoney(bill?.balance_due || 0)}`, help: 'Open balance on the selected AP bill.' });
      }

      if (entity === 'gl_journal_batch' || entity === 'gl_journal_entry') {
        const batchId = entity === 'gl_journal_batch' ? (selected?.id || e.backboneItemId?.value || '') : (val('batch_id') || selected?.batch_id || '');
        const entries = (state.glJournalEntries || []).filter((item) => String(item.batch_id || '') === String(batchId));
        const debit = entries.reduce((sum, item) => sum + formatMoney(item.debit_amount), 0);
        const credit = entries.reduce((sum, item) => sum + formatMoney(item.credit_amount), 0);
        const balanced = Math.abs(debit - credit) < 0.005 && entries.length > 0;
        cards.push({ title: 'Entries', value: String(entries.length), help: 'Lines currently in this journal batch.' });
        cards.push({ title: 'Debit Total', value: formatMoney(selected?.debit_total ?? debit), help: 'Summed debit amount for the batch.' });
        cards.push({ title: 'Credit Total', value: formatMoney(selected?.credit_total ?? credit), help: 'Summed credit amount for the batch.' });
        cards.push({ title: 'Balanced', value: selected?.is_balanced ? 'Yes' : (balanced ? 'Yes' : 'No'), help: 'Posting is blocked until debit and credit totals match.' });
        cards.push({ title: 'Source Sync', value: String(selected?.source_sync_state || 'manual').replaceAll('_', ' '), help: 'Source-generated batches become stale if the source record changes after posting.' });
      }
      if (entity === 'material_receipt' || entity === 'material_receipt_line') {
        const receiptId = entity === 'material_receipt' ? (selected?.id || e.backboneItemId?.value || '') : (val('receipt_id') || selected?.receipt_id || '');
        const lines = (state.materialReceiptLines || []).filter((item) => String(item.receipt_id || '') === String(receiptId));
        const receiptTotal = lines.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
        const allocatedTotal = lines.reduce((sum, item) => sum + (item.work_order_line_id ? Number(item.line_total || 0) : 0), 0);
        const unallocatedTotal = Math.max(receiptTotal - allocatedTotal, 0);
        cards.push({ title: 'Receipt Lines', value: String(selected?.line_count || lines.length), help: 'Loaded receipt lines for this receipt.' });
        cards.push({ title: 'Receipt Total', value: `$${formatMoney(Number(selected?.receipt_total || receiptTotal))}`, help: 'Rollup of linked receipt lines.' });
        cards.push({ title: 'Allocated Cost', value: `$${formatMoney(Number(selected?.allocated_receipt_total || allocatedTotal))}`, help: 'Receipt cost already linked to work-order lines.' });
        cards.push({ title: 'Unallocated Cost', value: `$${formatMoney(Number(selected?.unallocated_receipt_total || unallocatedTotal))}`, help: 'Receipt cost still waiting for work-order allocation.' });
      }

      if (entity === 'material_receipt_line') {
        const workOrderLine = (state.workOrderLines || []).find((item) => String(item.id) === String(val('work_order_line_id') || selected?.work_order_line_id || '')) || null;
        cards.push({ title: 'Derived Receipt Total', value: `$${formatMoney(Number(val('quantity') || 0) * Number(val('unit_cost') || 0))}`, help: 'Auto-calculated from quantity × unit cost.' });
        cards.push({ title: 'Linked Work-Order Line', value: workOrderLine ? `${workOrderLine.line_order || ''} - ${workOrderLine.description || 'Linked'}` : 'Not linked', help: 'Receiving-to-costing ties receipt cost back to a work-order line.' });
      }

      if (entity === 'material_issue' || entity === 'material_issue_line') {
        const issueId = entity === 'material_issue' ? (selected?.id || e.backboneItemId?.value || '') : (val('issue_id') || selected?.issue_id || '');
        const lines = (state.materialIssueLines || []).filter((item) => String(item.issue_id || '') === String(issueId));
        const issueTotal = lines.reduce((sum, item) => sum + formatMoney(item.line_total), 0);
        cards.push({ title: 'Issue Lines', value: String(lines.length), help: 'Material issue/usage lines for this issue header.' });
        cards.push({ title: 'Issued Total', value: formatMoney(selected?.issue_total ?? issueTotal), help: 'Total issued material cost from issue lines.' });
        cards.push({ title: 'Estimated Cost', value: formatMoney(selected?.estimated_material_total), help: 'Estimated material cost from linked work-order lines.' });
        cards.push({ title: 'Variance', value: formatMoney(selected?.variance_amount), help: 'Actual issued cost minus estimated material cost.' });
      }
      if (entity === 'linked_hse_packet' || entity === 'hse_packet_proof' || entity === 'hse_packet_event') {
        const packetId = entity === 'linked_hse_packet'
          ? (selected?.id || e.backboneItemId?.value || '')
          : (val('packet_id') || selected?.packet_id || '');
        const packet = (state.linkedHsePackets || []).find((item) => String(item.id) === String(packetId)) || null;
        const preview = getHsePreviewFromInputs();
        const proofs = (state.hsePacketProofs || []).filter((item) => String(item.packet_id || '') === String(packetId));
        const events = (state.hsePacketEvents || []).filter((item) => String(item.packet_id || '') === String(packetId));
        cards.push({ title: 'Required Steps', value: String(preview.requiredCount), help: 'Briefing, inspection, emergency review, weather, heat, chemical, traffic, and field signoff steps marked as required.' });
        cards.push({ title: 'Completed Steps', value: String(preview.completedCount), help: 'Required HSE steps completed so far.' });
        cards.push({ title: 'Completion', value: `${formatMoney(preview.percent)}%`, help: 'Auto-derived packet progress for closeout readiness.' });
        cards.push({ title: 'Events / Proof', value: `${events.length} / ${packet?.proof_count || proofs.length}`, help: 'HSE workflow events and proof items currently linked to this packet.' });
        cards.push({ title: 'Weather / Heat', value: `${Number(packet?.weather_event_count || 0)} / ${Number(packet?.heat_event_count || 0)}`, help: 'Weather and heat workflow event counts for this packet.' });
        cards.push({ title: 'Chemical / Traffic', value: `${Number(packet?.chemical_event_count || 0)} / ${Number(packet?.traffic_event_count || 0)}`, help: 'Chemical-handling and traffic/public interaction event counts.' });
        cards.push({ title: 'Signoff / Closeout', value: `${Number(packet?.signoff_event_count || 0)} / ${Number(packet?.closeout_event_count || 0)}`, help: 'Field signoff and closeout events completed against the packet.' });
        const actionItem = (state.hsePacketActionItems || []).find((item) => String(item?.packet_id || item?.id || '') === String(packetId));
        const openActionItems = (state.hsePacketActionItems || []).filter((item) => item?.needs_attention);
        cards.push({ title: 'Reopens', value: String(packet?.reopen_count || 0), help: 'How many times this packet has been reopened after closeout review.' });
        cards.push({ title: 'Suggested Status', value: preview.status.replaceAll('_', ' '), help: 'Draft, in progress, ready for closeout, or closed based on completion.' });
        cards.push({ title: 'Action Priority', value: String(actionItem?.action_priority || 'normal'), help: actionItem?.action_title || actionItem?.action_summary || 'No immediate blocker is flagged for this packet.' });
        cards.push({ title: 'Open HSE Follow-up', value: String(openActionItems.length), help: 'Linked or standalone packets still carrying critical or warning action items.' });
      }

      if (entity === 'employee_time_entry') {
        cards.push({ title: 'Clock-in Photo', value: selected?.clock_in_photo_url ? 'Available' : 'Missing', help: selected?.clock_in_photo_url || 'No clock-in photo is linked to this time entry.' });
        cards.push({ title: 'Clock-out Photo', value: selected?.clock_out_photo_url ? 'Available' : 'Missing', help: selected?.clock_out_photo_url || 'No clock-out photo is linked to this time entry.' });
        cards.push({ title: 'Clock-in Geofence', value: String(selected?.clock_in_geofence_status || 'not_checked').replaceAll('_', ' '), help: selected?.clock_in_geofence_distance_meters != null ? `${selected.clock_in_geofence_distance_meters}m from site center.` : 'No clock-in distance was recorded.' });
        cards.push({ title: 'Clock-out Geofence', value: String(selected?.clock_out_geofence_status || 'not_checked').replaceAll('_', ' '), help: selected?.clock_out_geofence_distance_meters != null ? `${selected.clock_out_geofence_distance_meters}m from site center.` : 'No clock-out distance was recorded.' });
      }

      if (entity === 'hse_packet_proof') {
        cards.push({ title: 'Proof URL', value: selected?.public_url ? 'Available' : 'Missing', help: selected?.public_url || 'No public proof URL is linked to this record.' });
        cards.push({ title: 'Proof Kind', value: String(selected?.proof_kind || 'proof').replaceAll('_', ' '), help: selected?.caption || selected?.proof_notes || 'Caption or proof notes will help evidence review.' });
      }

      if (entity === 'service_contract_document') {
        const kickoff = (state.signedContractJobKickoffCandidates || []).find((item) => String(item.contract_document_id || '') === String(selected?.id || '')) || null;
        cards.push({ title: 'Signed Status', value: selected?.signed_at || String(selected?.document_status || '') === 'signed' ? 'Signed' : 'Pending', help: selected?.signed_at || 'Contract must be signed before live-job kickoff and invoice generation.' });
        cards.push({ title: 'Kickoff Status', value: String(kickoff?.kickoff_status || (selected?.job_id ? 'linked_job_exists' : 'unknown')).replaceAll('_', ' '), help: kickoff?.suggested_job_code || 'Kickoff will create or link a live job using the agreement code as the service-contract reference.' });
        cards.push({ title: 'Linked Invoice', value: selected?.linked_invoice_id ? 'Generated' : 'Pending', help: selected?.linked_invoice_id || 'No invoice has been linked to this contract yet.' });
      }

      if (entity === 'payroll_export_run') {
        const close = Array.isArray(state.payrollCloseReviewSummary) ? state.payrollCloseReviewSummary[0] : null;
        cards.push({ title: 'Delivery Status', value: String(selected?.delivery_status || 'pending').replaceAll('_', ' '), help: selected?.delivery_confirmed_at || selected?.delivered_at || 'Delivery has not been confirmed yet.' });
        cards.push({ title: 'Payroll Close', value: String(selected?.payroll_close_status || 'open').replaceAll('_', ' '), help: selected?.payroll_closed_at || 'Close signoff has not been completed yet.' });
        cards.push({ title: 'Attendance Reviews', value: String(close?.attendance_review_needed_count || 0), help: 'Open attendance exceptions should be reviewed before payroll close.' });
      }

      if (entity === 'service_execution_scheduler_setting') {
        const status = (Array.isArray(state.serviceExecutionSchedulerStatus) ? state.serviceExecutionSchedulerStatus : []).find((item) => item?.id === selected?.id) || (Array.isArray(state.serviceExecutionSchedulerStatus) ? state.serviceExecutionSchedulerStatus[0] : null);
        cards.push({ title: 'Latest Run', value: status?.latest_run_code || 'None', help: status?.latest_run_status || 'No scheduler run has been recorded yet.' });
        cards.push({ title: 'Due Now', value: status?.is_due ? 'Yes' : 'No', help: status?.next_run_at || 'Next scheduled run time is not set.' });
        cards.push({ title: 'Last Dispatch', value: status?.last_dispatch_status || selected?.last_dispatch_status || 'None', help: status?.last_dispatch_notes || selected?.invoke_url || 'Cron dispatch URL has not been configured yet.' });
      }

      e.backboneInsights.innerHTML = cards.map((card) => `
        <div class="admin-insight-card">
          <span>${escHtml(card.title)}</span>
          <strong>${escHtml(card.value)}</strong>
          <small>${escHtml(card.help)}</small>
        </div>
      `).join('') || '<div class="notice">Select or enter a record to see rollups and workflow hints.</div>';
    }

    function bindBackboneFieldLogic(entity) {
      const bind = (name, handler, eventName = 'input') => {
        const input = document.getElementById(`ad_bb_${name}`);
        if (!input || input.dataset[`bound${eventName}`] === '1') return;
        input.dataset[`bound${eventName}`] = '1';
        input.addEventListener(eventName, handler);
      };

      const recalcLineFromPrice = () => {
        setBackboneInputValue('line_total', (Number(document.getElementById('ad_bb_quantity')?.value || 0) * Number(document.getElementById('ad_bb_unit_price')?.value || 0)).toFixed(2));
        renderBackboneInsights();
      };
      const recalcLineFromCost = () => {
        setBackboneInputValue('line_total', (Number(document.getElementById('ad_bb_quantity')?.value || 0) * Number(document.getElementById('ad_bb_unit_cost')?.value || 0)).toFixed(2));
        renderBackboneInsights();
      };

      if (entity === 'estimate_line' || entity === 'work_order_line') {
        ['quantity', 'unit_price'].forEach((name) => bind(name, recalcLineFromPrice));
        bind('material_id', () => {
          const material = (state.materialsCatalog || []).find((item) => String(item.id) === String(document.getElementById('ad_bb_material_id')?.value || ''));
          if (material) {
            if (!document.getElementById('ad_bb_description')?.value) setBackboneInputValue('description', material.item_name || '');
            if (!document.getElementById('ad_bb_unit_id')?.value && material.unit_id) setBackboneInputValue('unit_id', material.unit_id);
            if (Number(document.getElementById('ad_bb_unit_cost')?.value || 0) <= 0 && Number(material.default_unit_cost || 0) > 0) setBackboneInputValue('unit_cost', formatMoney(material.default_unit_cost || 0));
            if (Number(document.getElementById('ad_bb_unit_price')?.value || 0) <= 0 && Number(material.default_bill_rate || 0) > 0) setBackboneInputValue('unit_price', formatMoney(material.default_bill_rate || 0));
          }
          recalcLineFromPrice();
          renderBackboneInsights();
        }, 'change');
        bind('equipment_master_id', () => {
          const equipment = (state.equipmentMaster || []).find((item) => String(item.id) === String(document.getElementById('ad_bb_equipment_master_id')?.value || ''));
          if (equipment) {
            if (!document.getElementById('ad_bb_description')?.value) setBackboneInputValue('description', equipment.item_name || '');
            if (Number(document.getElementById('ad_bb_unit_cost')?.value || 0) <= 0 && Number(equipment.cost_rate_hourly || 0) > 0) setBackboneInputValue('unit_cost', formatMoney(equipment.cost_rate_hourly || 0));
            if (Number(document.getElementById('ad_bb_unit_price')?.value || 0) <= 0 && Number(equipment.bill_rate_hourly || 0) > 0) setBackboneInputValue('unit_price', formatMoney(equipment.bill_rate_hourly || 0));
          }
          recalcLineFromPrice();
          renderBackboneInsights();
        }, 'change');
        ['estimate_id', 'work_order_id'].forEach((name) => bind(name, () => renderBackboneInsights(), 'change'));
        recalcLineFromPrice();
      }
      if (entity === 'material_receipt_line') {
        ['quantity', 'unit_cost'].forEach((name) => bind(name, recalcLineFromCost));
        bind('work_order_line_id', () => {
          const workOrderLine = (state.workOrderLines || []).find((item) => String(item.id) === String(document.getElementById('ad_bb_work_order_line_id')?.value || ''));
          if (workOrderLine) {
            if (!document.getElementById('ad_bb_description')?.value) setBackboneInputValue('description', workOrderLine.description || '');
            if (!document.getElementById('ad_bb_unit_id')?.value && workOrderLine.unit_id) setBackboneInputValue('unit_id', workOrderLine.unit_id);
            if (!document.getElementById('ad_bb_material_id')?.value && workOrderLine.material_id) setBackboneInputValue('material_id', workOrderLine.material_id);
            if (!document.getElementById('ad_bb_cost_code_id')?.value && workOrderLine.cost_code_id) setBackboneInputValue('cost_code_id', workOrderLine.cost_code_id);
            if (Number(document.getElementById('ad_bb_unit_cost')?.value || 0) <= 0 && Number(workOrderLine.unit_cost || 0) > 0) setBackboneInputValue('unit_cost', formatMoney(workOrderLine.unit_cost || 0));
          }
          recalcLineFromCost();
          renderBackboneInsights();
        }, 'change');
        bind('material_id', () => {
          const material = (state.materialsCatalog || []).find((item) => String(item.id) === String(document.getElementById('ad_bb_material_id')?.value || ''));
          if (material) {
            if (!document.getElementById('ad_bb_description')?.value) setBackboneInputValue('description', material.item_name || '');
            if (!document.getElementById('ad_bb_unit_id')?.value && material.unit_id) setBackboneInputValue('unit_id', material.unit_id);
            if (Number(document.getElementById('ad_bb_unit_cost')?.value || 0) <= 0 && Number(material.default_unit_cost || 0) > 0) setBackboneInputValue('unit_cost', formatMoney(material.default_unit_cost || 0));
          }
          recalcLineFromCost();
          renderBackboneInsights();
        }, 'change');
        bind('receipt_id', () => renderBackboneInsights(), 'change');
        recalcLineFromCost();
      }
      if (entity === 'route_stop') {
        bind('route_id', () => {
          const routeId = document.getElementById('ad_bb_route_id')?.value || '';
          const currentStop = Number(document.getElementById('ad_bb_stop_order')?.value || 0);
          if (routeId && currentStop <= 0) {
            const nextStop = (state.routeStops || [])
              .filter((item) => String(item.route_id || '') === String(routeId))
              .reduce((max, item) => Math.max(max, Number(item.stop_order || 0)), 0) + 10;
            setBackboneInputValue('stop_order', nextStop || 10);
          }
          renderBackboneInsights();
        }, 'change');
      }
      if (entity === 'route_stop_execution') {
        bind('route_stop_id', () => {
          const stop = (state.routeStops || []).find((item) => String(item.id) === String(document.getElementById('ad_bb_route_stop_id')?.value || ''));
          if (stop) {
            if (!document.getElementById('ad_bb_route_id')?.value && stop.route_id) setBackboneInputValue('route_id', stop.route_id);
            if (!document.getElementById('ad_bb_client_site_id')?.value && stop.client_site_id) setBackboneInputValue('client_site_id', stop.client_site_id);
          }
          renderBackboneInsights();
        }, 'change');
      }
      if (entity === 'ar_payment') {
        bind('invoice_id', () => {
          const invoice = (state.arInvoices || []).find((item) => String(item.id) === String(document.getElementById('ad_bb_invoice_id')?.value || ''));
          if (invoice) {
            if (!document.getElementById('ad_bb_client_id')?.value) setBackboneInputValue('client_id', invoice.client_id || '');
            if (Number(document.getElementById('ad_bb_amount')?.value || 0) <= 0) setBackboneInputValue('amount', formatMoney(invoice.balance_due || 0));
          }
          renderBackboneInsights();
        }, 'change');
      }
      if (entity === 'ap_payment') {
        bind('bill_id', () => {
          const bill = (state.apBills || []).find((item) => String(item.id) === String(document.getElementById('ad_bb_bill_id')?.value || ''));
          if (bill) {
            if (!document.getElementById('ad_bb_vendor_id')?.value) setBackboneInputValue('vendor_id', bill.vendor_id || '');
            if (Number(document.getElementById('ad_bb_amount')?.value || 0) <= 0) setBackboneInputValue('amount', formatMoney(bill.balance_due || 0));
          }
          renderBackboneInsights();
        }, 'change');
      }
      if (entity === 'linked_hse_packet') {
        ['briefing_required', 'briefing_completed', 'inspection_required', 'inspection_completed', 'emergency_review_required', 'emergency_review_completed', 'weather_monitoring_required', 'weather_monitoring_completed', 'heat_monitoring_required', 'heat_monitoring_completed', 'chemical_handling_required', 'chemical_handling_completed', 'traffic_control_required', 'traffic_control_completed', 'field_signoff_required', 'field_signoff_completed', 'packet_status', 'reopen_in_progress', 'packet_type', 'packet_scope'].forEach((name) => bind(name, () => {
          const preview = getHsePreviewFromInputs();
          if (!document.getElementById('ad_bb_reopen_in_progress')?.checked && document.getElementById('ad_bb_packet_status')?.value !== 'closed') setBackboneInputValue('packet_status', preview.status);
          if (document.getElementById('ad_bb_packet_type')?.value === 'unscheduled_project') setBackboneInputValue('unscheduled_project', true);
          if (document.getElementById('ad_bb_reopen_in_progress')?.checked && !document.getElementById('ad_bb_reopen_reason')?.value) setBackboneInputValue('reopen_reason', 'Evidence or exception follow-up required');
          setBackboneInputValue('completion_percent', preview.percent.toFixed(2));
          if (document.getElementById('ad_bb_field_signoff_completed')?.checked && !document.getElementById('ad_bb_field_signed_off_at')?.value) setBackboneInputValue('field_signed_off_at', new Date().toISOString().slice(0, 16));
          if (preview.status === 'ready_for_closeout' && !document.getElementById('ad_bb_ready_for_closeout_at')?.value) {
            setBackboneInputValue('ready_for_closeout_at', new Date().toISOString().slice(0, 16));
          }
          renderBackboneInsights();
        }, name === 'packet_status' || name === 'packet_type' || name === 'packet_scope' ? 'change' : 'input'));
      }
      if (entity === 'hse_packet_event') {
        ['event_type', 'event_status', 'packet_id'].forEach((name) => bind(name, () => {
          const type = document.getElementById('ad_bb_event_type')?.value || 'note';
          if ((type === 'field_signoff' || type === 'closeout') && !document.getElementById('ad_bb_event_status')?.value) setBackboneInputValue('event_status', type === 'field_signoff' ? 'signed' : 'closed');
          renderBackboneInsights();
        }, 'change'));
      }

      renderBackboneInsights();
    }

    function renderBackboneUploadControls(entity, row = null) {
      const labelMap = {
        route_stop_execution_attachment: 'Upload attachment',
        hse_packet_proof: 'Upload proof',
        field_upload_failure: 'Retry with replacement file'
      };
      if (!['route_stop_execution_attachment', 'hse_packet_proof', 'field_upload_failure'].includes(entity)) return '';
      return `
        <div class="admin-upload-block">
          <label>${escHtml(labelMap[entity] || 'Upload file')}
            <input id="ad_bb_upload_file" type="file" />
          </label>
          <button id="ad_bb_upload_btn" class="secondary" type="button">${escHtml(labelMap[entity] || 'Upload file')}</button>
          <p class="muted" style="margin:0;">Use this for route execution photos/files, HSE packet proof images/signatures, or a replacement retry after a logged upload failure.</p>
        </div>
      `;
    }

    async function uploadBackboneFile(entity, selected = null) {
      const fileInput = document.getElementById('ad_bb_upload_file');
      const file = fileInput?.files?.[0];
      if (!file) throw new Error('Select a file first.');

      const packetId = document.getElementById('ad_bb_packet_id')?.value || selected?.packet_id || selected?.linked_record_id || '';
      const executionId = document.getElementById('ad_bb_execution_id')?.value || selected?.execution_id || selected?.linked_record_id || '';

      if (entity === 'route_stop_execution_attachment') {
        const formData = new FormData();
        formData.set('execution_id', executionId);
        formData.set('attachment_kind', document.getElementById('ad_bb_attachment_kind')?.value || selected?.attachment_kind || 'photo');
        formData.set('caption', document.getElementById('ad_bb_caption')?.value || '');
        formData.set('file', file);
        return window.YWIAPI?.uploadRouteExecutionAttachment?.(formData, true);
      }

      if (entity === 'hse_packet_proof') {
        const formData = new FormData();
        formData.set('packet_id', packetId);
        formData.set('proof_kind', document.getElementById('ad_bb_proof_kind')?.value || selected?.proof_kind || 'photo');
        formData.set('proof_stage', document.getElementById('ad_bb_proof_stage')?.value || selected?.proof_stage || 'field');
        formData.set('caption', document.getElementById('ad_bb_caption')?.value || '');
        formData.set('proof_notes', document.getElementById('ad_bb_proof_notes')?.value || '');
        formData.set('file', file);
        return window.YWIAPI?.uploadHsePacketProof?.(formData, true);
      }

      if (entity === 'field_upload_failure') {
        const scope = String(selected?.failure_scope || '');
        if (scope === 'job_comment_attachment') {
          const formData = new FormData();
          formData.set('job_comment_id', String(selected?.comment_id || selected?.linked_record_id || ''));
          formData.set('attachment_kind', String(selected?.client_context?.attachment_kind || 'photo'));
          if (selected?.client_context?.caption) formData.set('caption', String(selected.client_context.caption));
          formData.set('file', file);
          return window.YWIAPI?.uploadJobCommentAttachment?.(formData, true);
        }
        if (scope === 'equipment_evidence') {
          const formData = new FormData();
          formData.set('signout_id', String(selected?.signout_id || selected?.linked_record_id || ''));
          formData.set('stage', String(selected?.client_context?.stage || 'checkout'));
          formData.set('evidence_kind', String(selected?.client_context?.evidence_kind || 'photo'));
          if (selected?.client_context?.signer_role) formData.set('signer_role', String(selected.client_context.signer_role));
          if (selected?.client_context?.caption) formData.set('caption', String(selected.client_context.caption));
          formData.set('file', file);
          return window.YWIAPI?.uploadEquipmentEvidence?.(formData, true);
        }
        if (scope === 'route_execution_attachment') {
          const formData = new FormData();
          formData.set('execution_id', String(selected?.execution_id || selected?.linked_record_id || ''));
          formData.set('attachment_kind', String(selected?.client_context?.attachment_kind || 'photo'));
          if (selected?.client_context?.caption) formData.set('caption', String(selected.client_context.caption));
          formData.set('file', file);
          return window.YWIAPI?.uploadRouteExecutionAttachment?.(formData, true);
        }
        if (scope === 'hse_proof') {
          const formData = new FormData();
          formData.set('packet_id', String(selected?.packet_id || selected?.linked_record_id || ''));
          formData.set('proof_kind', String(selected?.client_context?.proof_kind || 'photo'));
          formData.set('proof_stage', String(selected?.client_context?.proof_stage || 'field'));
          if (selected?.client_context?.caption) formData.set('caption', String(selected.client_context.caption));
          if (selected?.client_context?.proof_notes) formData.set('proof_notes', String(selected.client_context.proof_notes));
          formData.set('file', file);
          return window.YWIAPI?.uploadHsePacketProof?.(formData, true);
        }
        throw new Error('This failure record does not have a supported retry upload target.');
      }

      throw new Error('Unsupported upload target.');
    }

    function bindBackboneUploadLogic(entity, row = null) {
      const btn = document.getElementById('ad_bb_upload_btn');
      if (!btn || btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', async () => {
        try {
          btn.disabled = true;
          const selected = row || getSelectedBackboneRecord();
          const result = await uploadBackboneFile(entity, selected);
          await refreshSelectors();
          await loadDirectory();
          if (entity === 'field_upload_failure' && selected?.id) {
            await manageAdminEntity({
              entity: 'field_upload_failure',
              action: 'update',
              item_id: selected.id,
              retry_status: 'resolved',
              upload_attempts: Number(selected.upload_attempts || 0) + 1,
              last_retry_at: new Date().toISOString(),
              resolution_notes: `Replacement upload completed on ${new Date().toLocaleString()}.`
            });
          }
          const record = result?.record || null;
          if (record?.id && ['route_stop_execution_attachment', 'hse_packet_proof'].includes(entity)) {
            fillBackboneForm(record);
          }
          setSummary('Upload completed and Admin data refreshed.');
        } catch (err) {
          setSummary(String(err?.message || err), true);
        } finally {
          btn.disabled = false;
        }
      });
    }

    function getBackboneGenerateLabel(entity, row) {
      if (entity === 'payroll_export_run') {
        if (!row?.exported_at) return 'Generate Export';
        if (!['delivered','confirmed'].includes(String(row?.delivery_status || '').toLowerCase())) return 'Confirm Delivery';
        if (String(row?.payroll_close_status || '').toLowerCase() !== 'closed') return 'Close Payroll Run';
        return 'Refresh Export State';
      }
      if (entity === 'service_contract_document') {
        if (String(row?.document_status || '').toLowerCase() === 'signed' || row?.signed_at) {
          if (!row?.job_id) return 'Kickoff Job / Work Order';
          return 'Generate Signed Invoice';
        }
        return 'Open Print / Invoice';
      }
      const labels = { estimate: 'Convert to Agreement', recurring_service_agreement: 'Generate Contract / Run Scheduler', snow_event_trigger: 'Generate Snow Invoice', service_execution_scheduler_setting: 'Run Scheduler Now', ar_payment_application: 'Auto-Apply AR Payment', ap_payment_application: 'Auto-Apply AP Payment', bank_reconciliation_session: 'Auto-Match Reconciliation', sales_tax_filing: 'Advance Filing Review', payroll_remittance_run: 'Advance Remittance Review', accountant_handoff_export: 'Build / Deliver Package', accounting_period_close: 'Close / Reopen Period' };
      return labels[entity] || 'Generate Output';
    }

    function renderBackboneFields(entity, row = null) {
      const e = els();
      const cfg = BACKBONE_CONFIG[entity];
      if (!e.backboneFields || !cfg) return;
      e.backboneFields.innerHTML = cfg.fields.map((field) => {
        const inputId = `ad_bb_${field.name}`;
        const value = formatBackboneValue(field, row);
        const readOnlyAttr = field.readonly ? ' readonly' : '';
        const disabledHint = field.readonly ? ' data-readonly="true"' : '';
        if (field.type === 'textarea') return `<label>${escHtml(field.label)}<textarea id="${escHtml(inputId)}" rows="3"${readOnlyAttr}${disabledHint}>${escHtml(value)}</textarea></label>`;
        if (field.type === 'checkbox') return `<label style="display:flex;align-items:end;gap:8px;"><input id="${escHtml(inputId)}" type="checkbox" ${value ? 'checked' : ''}${field.readonly ? ' disabled' : ''}${disabledHint} /><span>${escHtml(field.label)}</span></label>`;
        if (field.type === 'select') {
          const options = Array.isArray(field.options)
            ? `<option value="">Select ${escHtml(field.label)}</option>` + field.options.map((opt) => `<option value="${escHtml(opt[0])}">${escHtml(opt[1])}</option>`).join('')
            : optionList(getBackboneOptionRows(field.source), field.optionValueKey || 'id', (item) => getBackboneOptionLabel(field.source, item), `Select ${field.label}`);
          return `<label>${escHtml(field.label)}<select id="${escHtml(inputId)}"${field.readonly ? ' disabled' : ''}${disabledHint}>${options}</select></label>`;
        }
        return `<label>${escHtml(field.label)}<input id="${escHtml(inputId)}" type="${escHtml(field.type || 'text')}" value="${escHtml(value)}"${readOnlyAttr}${disabledHint} /></label>`;
      }).join('') + renderBackboneUploadControls(entity, row || null);
      cfg.fields.forEach((field) => {
        if (field.type === 'select') {
          const input = document.getElementById(`ad_bb_${field.name}`);
          if (input) setSelectValue(input, row?.[field.name] || '');
        }
      });
      bindBackboneFieldLogic(entity);
      bindBackboneUploadLogic(entity, row || null);
      if (e.backbonePostBtn) e.backbonePostBtn.style.display = entity === 'gl_journal_batch' ? '' : 'none';
      if (e.backboneGenerateBtn) {
        const allowed = ['estimate','recurring_service_agreement','snow_event_trigger','payroll_export_run','service_execution_scheduler_setting','service_contract_document','ar_payment_application','ap_payment_application','bank_reconciliation_session','sales_tax_filing','payroll_remittance_run','accountant_handoff_export','accounting_period_close'];
        e.backboneGenerateBtn.style.display = allowed.includes(entity) ? '' : 'none';
        e.backboneGenerateBtn.textContent = getBackboneGenerateLabel(entity, row || null);
      }
      if (e.backboneDownloadBtn) {
        const labels = { payroll_export_run: 'Download Export', service_contract_document: 'Download / Print', accountant_handoff_export: 'Download Package' };
        e.backboneDownloadBtn.style.display = labels[entity] ? '' : 'none';
        e.backboneDownloadBtn.textContent = labels[entity] || 'Download / Print';
      }
      renderBackboneInsights(row || null);
    }

    function fillBackboneForm(row = null) {
      const e = els();
      const entity = e.backboneEntity?.value || 'unit_of_measure';
      if (e.backboneItemId) setSelectValue(e.backboneItemId, row?.id || '');
      renderBackboneFields(entity, row || null);
    }


    function downloadTextFile(fileName, content, mimeType = 'text/plain;charset=utf-8') {
      const blob = new Blob([String(content || '')], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'export.txt';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 250);
    }

    function openPrintableHtml(title, html) {
      const win = window.open('', '_blank', 'noopener,noreferrer,width=980,height=800');
      if (!win) throw new Error('Pop-up blocked. Please allow pop-ups to print the generated document.');
      win.document.open();
      win.document.write(html || `<html><head><title>${escHtml(title || 'Print Preview')}</title></head><body><pre>${escHtml(html || '')}</pre></body></html>`);
      win.document.close();
      win.focus();
    }

    async function runBackboneGenerateAction() {
      const e = els();
      const entity = e.backboneEntity?.value || 'unit_of_measure';
      const itemId = e.backboneItemId?.value || '';
      const row = getSelectedBackboneRecord();
      if (!itemId && !['service_contract_document','ar_payment_application','ap_payment_application'].includes(entity)) throw new Error('Select a record first.');
      if (entity === 'ar_payment_application') {
        const paymentId = row?.payment_id || document.getElementById('ad_bb_payment_id')?.value || '';
        if (!paymentId) throw new Error('Select an AR payment or payment application first.');
        const resp = await manageAdminEntity({ entity: 'ar_payment_application', action: 'auto_apply', payment_id: paymentId });
        if (!resp?.ok) throw new Error(resp?.error || 'AR payment auto-apply failed.');
        await loadDirectory();
        await refreshSelectors();
        renderBackboneTable();
        setSummary(`AR payment auto-apply completed. Created ${resp.applied_count || 0} application(s).`);
        return;
      }
      if (entity === 'ap_payment_application') {
        const paymentId = row?.payment_id || document.getElementById('ad_bb_payment_id')?.value || '';
        if (!paymentId) throw new Error('Select an AP payment or payment application first.');
        const resp = await manageAdminEntity({ entity: 'ap_payment_application', action: 'auto_apply', payment_id: paymentId });
        if (!resp?.ok) throw new Error(resp?.error || 'AP payment auto-apply failed.');
        await loadDirectory();
        await refreshSelectors();
        renderBackboneTable();
        setSummary(`AP payment auto-apply completed. Created ${resp.applied_count || 0} application(s).`);
        return;
      }
      if (entity === 'bank_reconciliation_session') {
        const resp = await manageAdminEntity({ entity: 'bank_reconciliation_session', action: 'auto_match', item_id: itemId });
        if (!resp?.ok) throw new Error(resp?.error || 'Bank reconciliation auto-match failed.');
        await loadDirectory();
        await refreshSelectors();
        fillBackboneForm(resp.record || row || null);
        renderBackboneTable();
        setSummary(`Bank reconciliation auto-match completed. Matched ${resp.matched_count || 0} item(s).`);
        return;
      }
      if (entity === 'sales_tax_filing') {
        const status = String(row?.review_status || row?.filing_status || 'draft').toLowerCase();
        const action = status === 'draft' ? 'prepare_from_period' : status === 'prepared' ? 'review' : status === 'reviewed' ? 'approve' : status === 'approved' ? 'file' : status === 'filed' ? 'pay' : 'update';
        const resp = await manageAdminEntity({ ...collectBackbonePayload(), action, item_id: itemId });
        if (!resp?.ok) throw new Error(resp?.error || 'Sales tax filing workflow action failed.');
        await loadDirectory();
        await refreshSelectors();
        fillBackboneForm(resp.record || null);
        renderBackboneTable();
        setSummary(`Sales tax filing moved with action: ${action.replaceAll('_', ' ')}.`);
        return;
      }
      if (entity === 'payroll_remittance_run') {
        const status = String(row?.review_status || row?.remittance_status || 'draft').toLowerCase();
        const action = status === 'draft' ? 'prepare_from_export' : status === 'prepared' ? 'review' : status === 'reviewed' ? 'approve' : status === 'approved' ? 'remit' : 'update';
        const resp = await manageAdminEntity({ ...collectBackbonePayload(), action, item_id: itemId });
        if (!resp?.ok) throw new Error(resp?.error || 'Payroll remittance workflow action failed.');
        await loadDirectory();
        await refreshSelectors();
        fillBackboneForm(resp.record || null);
        renderBackboneTable();
        setSummary(`Payroll remittance moved with action: ${action.replaceAll('_', ' ')}.`);
        return;
      }
      if (entity === 'accountant_handoff_export') {
        const status = String(row?.package_status || 'draft').toLowerCase();
        const action = status === 'draft' ? 'build_bundle' : status === 'prepared' ? 'review_package' : status === 'reviewed' ? 'finalize_package' : status === 'finalized' ? 'deliver_package' : 'build_bundle';
        const resp = await manageAdminEntity({ ...collectBackbonePayload(), action, item_id: itemId });
        if (!resp?.ok) throw new Error(resp?.error || 'Accountant handoff package workflow action failed.');
        await loadDirectory();
        await refreshSelectors();
        fillBackboneForm(resp.record || null);
        renderBackboneTable();
        setSummary(`Accountant handoff package moved with action: ${action.replaceAll('_', ' ')}.`);
        return;
      }
      if (entity === 'accounting_period_close') {
        const action = String(row?.close_status || '').toLowerCase() === 'closed' ? 'reopen' : 'close';
        const resp = await manageAdminEntity({ ...collectBackbonePayload(), action, item_id: itemId });
        if (!resp?.ok) throw new Error(resp?.error || 'Accounting period close action failed.');
        await loadDirectory();
        await refreshSelectors();
        fillBackboneForm(resp.record || null);
        renderBackboneTable();
        setSummary(`Accounting period ${action === 'close' ? 'closed and locked' : 'reopened'}.`);
        return;
      }
      if (entity === 'estimate') {
        const resp = await manageAdminEntity({ entity: 'estimate', action: 'convert_to_agreement', item_id: itemId });
        if (!resp?.ok) throw new Error(resp?.error || 'Estimate conversion failed.');
        await loadDirectory();
        await refreshSelectors();
        if (e.backboneEntity) e.backboneEntity.value = 'recurring_service_agreement';
        fillBackboneForm(resp.record || null);
        renderBackboneTable();
        setSummary('Estimate converted into a draft recurring service agreement.');
        return;
      }
      if (entity === 'recurring_service_agreement') {
        if (row?.contract_document_id && String(row.agreement_status || '').toLowerCase() === 'active') {
          const resp = await manageAdminEntity({ entity: 'recurring_service_agreement', action: 'run_scheduler', item_id: itemId });
          if (!resp?.ok) throw new Error(resp?.error || 'Scheduler run failed.');
          await loadDirectory();
          await refreshSelectors();
          fillBackboneForm(row || null);
          renderBackboneTable();
          setSummary(`Scheduler run completed. Created ${resp.created_count || 0} session(s), staged ${resp.invoice_candidate_count || 0} invoice candidate(s), skipped ${resp.skipped_count || 0}.`);
          return;
        }
        const resp = await manageAdminEntity({ entity: 'service_contract_document', action: 'generate_from_source', source_entity: 'recurring_service_agreement', source_id: itemId, document_kind: 'contract' });
        if (!resp?.ok) throw new Error(resp?.error || 'Contract generation failed.');
        await loadDirectory();
        await refreshSelectors();
        if (resp.record?.rendered_html) openPrintableHtml(resp.record?.title || 'Service Contract', resp.record.rendered_html);
        if (e.backboneEntity) e.backboneEntity.value = 'service_contract_document';
        fillBackboneForm(resp.record || null);
        renderBackboneTable();
        setSummary('Printable contract generated and stored in Service Contract Documents.');
        return;
      }
      if (entity === 'snow_event_trigger') {
        const resp = await manageAdminEntity({ entity: 'snow_event_trigger', action: 'generate_invoice', item_id: itemId });
        if (!resp?.ok) throw new Error(resp?.error || 'Snow invoice generation failed.');
        await loadDirectory();
        await refreshSelectors();
        if (e.backboneEntity) e.backboneEntity.value = 'ar_invoice';
        fillBackboneForm(resp.record || null);
        renderBackboneTable();
        setSummary('Draft AR invoice created from the selected snow event trigger.');
        return;
      }
      if (entity === 'payroll_export_run') {
        let resp = null;
        if (!row?.exported_at) {
          resp = await manageAdminEntity({ entity: 'payroll_export_run', action: 'generate_export', item_id: itemId });
          if (!resp?.ok) throw new Error(resp?.error || 'Payroll export generation failed.');
        } else if (!['delivered','confirmed'].includes(String(row?.delivery_status || '').toLowerCase())) {
          const deliveryReference = window.prompt('Delivery reference or batch ID (required):', row?.delivery_reference || '') || '';
          if (!String(deliveryReference || '').trim()) {
            setSummary('Add a delivery reference or batch ID before marking the payroll export delivered.', true);
            return;
          }
          const deliveryNotes = window.prompt('Delivery note (optional):', row?.delivery_notes || 'Export file delivered to payroll provider.') || '';
          resp = await manageAdminEntity({ entity: 'payroll_export_run', action: 'mark_delivered', item_id: itemId, delivery_status: 'delivered', delivery_reference: deliveryReference, delivery_notes: deliveryNotes });
          if (!resp?.ok) throw new Error(resp?.error || 'Payroll export delivery update failed.');
        } else if (String(row?.delivery_status || '').toLowerCase() === 'delivered') {
          const deliveryReference = window.prompt('Keep the delivery reference or batch ID:', row?.delivery_reference || '') || '';
          if (!String(deliveryReference || '').trim()) {
            setSummary('Keep the delivery reference on the payroll export before confirming receipt.', true);
            return;
          }
          const confirmNotes = window.prompt('Confirmation note (optional):', row?.delivery_notes || 'Provider receipt confirmed.') || '';
          resp = await manageAdminEntity({ entity: 'payroll_export_run', action: 'mark_delivered', item_id: itemId, delivery_status: 'confirmed', delivery_reference: deliveryReference, delivery_notes: confirmNotes });
          if (!resp?.ok) throw new Error(resp?.error || 'Payroll export confirmation failed.');
        } else if (String(row?.payroll_close_status || '').toLowerCase() !== 'closed') {
          const closeNotes = window.prompt('Close signoff note (required):', row?.payroll_close_notes || 'Payroll run closed after confirmed delivery.') || '';
          if (!String(closeNotes || '').trim()) {
            setSummary('Add a close signoff note before closing the payroll export.', true);
            return;
          }
          resp = await manageAdminEntity({ entity: 'payroll_export_run', action: 'close_run', item_id: itemId, payroll_close_notes: closeNotes });
          if (!resp?.ok) throw new Error(resp?.error || 'Payroll close signoff failed.');
        } else {
          setSummary('Payroll export is already delivered and closed.');
          return;
        }
        await loadDirectory();
        await refreshSelectors();
        fillBackboneForm(resp.record || null);
        renderBackboneTable();
        if (resp.export_file_content) downloadTextFile(resp.export_file_name || 'payroll-export.csv', resp.export_file_content, resp.export_mime_type || 'text/csv;charset=utf-8');
        setSummary(!row?.exported_at ? 'Payroll export generated and downloaded.' : (String(row?.delivery_status || '').toLowerCase() === 'pending' ? 'Payroll export marked delivered.' : (String(row?.delivery_status || '').toLowerCase() === 'delivered' ? 'Payroll export delivery confirmed.' : 'Payroll export closed and signed off.')));
        return;
      }
      if (entity === 'service_execution_scheduler_setting') {
        const resp = await manageAdminEntity({ entity: 'service_execution_scheduler_setting', action: 'run_now', item_id: itemId });
        if (!resp?.ok) throw new Error(resp?.error || 'Scheduler run failed.');
        await loadDirectory();
        await refreshSelectors();
        setSummary(`Scheduler run completed. Created ${resp.created_count || 0} session(s), ${resp.invoice_candidate_count || 0} invoice candidate(s), ${resp.skipped_count || 0} skipped.`);
        return;
      }
      if (entity === 'service_contract_document') {
        if (String(row?.document_status || '').toLowerCase() === 'signed' || row?.signed_at) {
          if (!row?.job_id) {
            const kickoff = await manageAdminEntity({ entity: 'service_contract_document', action: 'kickoff_live_job_from_signed', item_id: itemId });
            if (!kickoff?.ok) throw new Error(kickoff?.error || 'Live job kickoff from signed contract failed.');
            await loadDirectory();
            await refreshSelectors();
            if (e.backboneEntity) e.backboneEntity.value = 'work_order';
            renderBackboneTable();
            fillBackboneForm(getSelectedBackboneRecord());
            const jobMessage = kickoff?.job_created
              ? (kickoff?.record?.job_id ? ` Job ${kickoff.record.job_id} created.` : ' Job created.')
              : (kickoff?.linked_existing_job || kickoff?.job_id ? ` Existing job ${kickoff.job_id || kickoff?.record?.job_id || ''} linked.` : ' Existing job linkage retained.');
            const workOrderNo = kickoff?.work_order?.work_order_number
              ? `${kickoff?.work_order_created ? ' Work order ' : ' Existing work order '}${kickoff.work_order.work_order_number} ready.`
              : '';
            const sessionDate = kickoff?.first_session?.session_date
              ? `${kickoff?.first_session_created ? ' First session ' : ' Existing first session '}${kickoff.first_session.session_date}.`
              : '';
            setSummary(`Live job kickoff completed from the signed contract.${jobMessage}${workOrderNo}${sessionDate} Run Generate again to stage the invoice if needed.`.trim());
            return;
          }
          const resp = await manageAdminEntity({ entity: 'service_contract_document', action: 'generate_invoice_from_signed', item_id: itemId });
          if (!resp?.ok) throw new Error(resp?.error || 'Invoice generation from signed contract failed.');
          await loadDirectory();
          await refreshSelectors();
          if (e.backboneEntity) e.backboneEntity.value = 'ar_invoice';
          fillBackboneForm(resp.record || null);
          renderBackboneTable();
          setSummary('Draft invoice generated from the signed contract document.');
          return;
        }
        if (!row?.rendered_html) throw new Error('This contract document does not contain printable HTML yet.');
        openPrintableHtml(row.title || row.document_number || 'Contract Document', row.rendered_html);
        setSummary('Printable document opened in a new tab.');
        return;
      }
    }

    async function runBackboneDownloadAction() {
      const e = els();
      const entity = e.backboneEntity?.value || 'unit_of_measure';
      const row = getSelectedBackboneRecord();
      if (!row) throw new Error('Select a record first.');
      if (entity === 'payroll_export_run') {
        if (!row.export_file_content) throw new Error('Generate the payroll export first.');
        downloadTextFile(row.export_file_name || `${row.run_code || 'payroll-export'}.csv`, row.export_file_content, row.export_mime_type || 'text/csv;charset=utf-8');
        return;
      }
      if (entity === 'accountant_handoff_export') {
        if (row.package_markdown) {
          downloadTextFile(`${row.export_title || row.id || 'accountant-handoff'}.md`.replace(/[^a-z0-9._-]+/gi, '-'), row.package_markdown, 'text/markdown;charset=utf-8');
          return;
        }
        if (row.package_json || row.bundle_payload || row.export_payload) {
          downloadTextFile(`${row.export_title || row.id || 'accountant-handoff'}.json`.replace(/[^a-z0-9._-]+/gi, '-'), JSON.stringify(row.package_json || row.bundle_payload || row.export_payload || {}, null, 2), 'application/json;charset=utf-8');
          return;
        }
        throw new Error('No package markdown or JSON is stored on this accountant handoff record.');
      }
      if (entity === 'service_contract_document') {
        if (row.rendered_html) {
          downloadTextFile(`${row.document_number || 'document'}.html`, row.rendered_html, 'text/html;charset=utf-8');
          openPrintableHtml(row.title || row.document_number || 'Contract Document', row.rendered_html);
          return;
        }
        if (row.rendered_text) {
          downloadTextFile(`${row.document_number || 'document'}.txt`, row.rendered_text, 'text/plain;charset=utf-8');
          return;
        }
        throw new Error('No printable content is stored on this contract document.');
      }
    }


    function getJobStatusSeverity(status = '') {
      const clean = String(status || '').toLowerCase();
      if (['complete','completed','closed'].includes(clean)) return 'ok';
      if (['cancelled','canceled','void'].includes(clean)) return 'muted';
      if (['blocked','on_hold','delayed'].includes(clean)) return 'warning';
      return 'info';
    }

    const ADMIN_ROLE_RANK = { employee: 10, worker: 10, staff: 10, onsite_admin: 18, site_leader: 20, supervisor: 30, hse: 40, job_admin: 45, admin: 50 };

    function normalizeAdminRole(role = '') {
      const clean = String(role || '').trim().toLowerCase();
      if (clean === 'worker' || clean === 'staff') return 'employee';
      return clean || 'employee';
    }

    function canAdminRoleRun(requiredRole = 'employee') {
      const actor = normalizeAdminRole(state.actorRole || state.adminDirectoryMeta?.actor_role || '');
      if (!actor) return true;
      return (ADMIN_ROLE_RANK[actor] || 0) >= (ADMIN_ROLE_RANK[normalizeAdminRole(requiredRole)] || 0);
    }

    function getActionPermission(actionKey) {
      return (Array.isArray(state.adminActionPermissionRegistry) ? state.adminActionPermissionRegistry : [])
        .find((row) => String(row.action_key || '') === String(actionKey));
    }

    function applyAdminActionDisabledStates() {
      const registry = Array.isArray(state.adminActionPermissionRegistry) ? state.adminActionPermissionRegistry : [];
      if (!registry.length) return;
      const buttonRules = [
        ['job_status_update', '[data-job-action="complete"], [data-job-action="cancel"]'],
        ['job_add_note', '[data-job-action="note"]'],
        ['close_step_complete', '[data-close-step-action="complete"]'],
        ['close_step_reopen', '[data-close-step-action="reopen"]'],
        ['deployment_gate_update', '[data-gate-key]'],
        ['evidence_follow_up', '[data-evidence-action="follow_up"]']
      ];
      buttonRules.forEach(([actionKey, selector]) => {
        const rule = getActionPermission(actionKey);
        if (!rule) return;
        const isEnabled = rule.is_enabled !== false && String(rule.is_enabled || 'true') !== 'false';
        const allowed = isEnabled && canAdminRoleRun(rule.required_role || 'employee');
        document.querySelectorAll(selector).forEach((button) => {
          button.disabled = !allowed;
          button.classList.toggle('is-disabled-by-role', !allowed);
          button.setAttribute('data-permission-action', actionKey);
          if (!allowed) {
            button.title = rule.disabled_message || `Requires ${rule.required_role || 'a higher role'}.`;
            button.setAttribute('aria-disabled', 'true');
          } else {
            button.removeAttribute('aria-disabled');
          }
        });
      });
    }

    function renderJobsReviewTable() {
      const e = els();
      if (!e.jobsReviewBody) return;
      const rows = Array.isArray(state.jobs) ? state.jobs : [];
      e.jobsReviewBody.innerHTML = rows.map((row) => {
        const status = row.status || row.job_status || 'open';
        const label = `${row.job_code || ''}${row.job_name ? ` — ${row.job_name}` : ''}`.trim() || row.id;
        return `<tr data-job-id="${escHtml(row.id || '')}">
          <td><strong>${escHtml(label)}</strong><div class="muted">${escHtml(row.client_name || row.site_name || row.route_name || '')}</div></td>
          <td>${renderStatusPill(status, getJobStatusSeverity(status))}</td>
          <td>${escHtml(row.priority || '')}</td>
          <td>${escHtml(row.start_date || row.scheduled_start_date || '')}</td>
          <td>${escHtml(row.updated_at || row.created_at || '')}</td>
          <td><div class="admin-row-actions">
            <button class="secondary admin-job-action" type="button" data-job-action="open" data-job-id="${escHtml(row.id || '')}">Open</button>
            <button class="secondary admin-job-action" type="button" data-job-action="complete" data-job-id="${escHtml(row.id || '')}">Complete</button>
            <button class="secondary admin-job-action" type="button" data-job-action="cancel" data-job-id="${escHtml(row.id || '')}">Cancel</button>
            <button class="secondary admin-job-action" type="button" data-job-action="note" data-job-id="${escHtml(row.id || '')}">Add Note</button>
          </div></td>
        </tr>`;
      }).join('') || '<tr><td colspan="6" class="muted">No jobs loaded for this filter/page.</td></tr>';
      if (e.paymentActionRegistryBody) {
        const rows = Array.isArray(state.appPaymentApplicationActionRegistry) ? state.appPaymentApplicationActionRegistry : [];
        e.paymentActionRegistryBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.action_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.action_title || '')}</strong><div class="muted">${escHtml(row.source_table_hint || '')}</div></td>
            <td>${renderStatusPill(row.workflow_status || 'planned', /ready|done|in_progress|pass/i.test(String(row.workflow_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.accounting_effect || '')}</td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No payment application action rows loaded yet. Apply schema 128.</td></tr>';
      }
      if (e.accountingCloseControlBody) {
        const rows = Array.isArray(state.appAccountingCloseControlQueue) ? state.appAccountingCloseControlQueue : [];
        e.accountingCloseControlBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.close_area || '')}</td>
            <td><strong>${escHtml(row.control_title || '')}</strong><div class="muted">${escHtml(row.source_totals_hint || '')}</div></td>
            <td>${renderStatusPill(row.control_status || 'planned', /ready|done|in_progress|pass/i.test(String(row.control_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.proof_hint || '')}<div class="muted">${escHtml(row.lock_behavior || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No accounting close control rows loaded yet. Apply schema 128.</td></tr>';
      }
      if (e.equipmentAccountabilityActionBody) {
        const rows = Array.isArray(state.appEquipmentAccountabilityActionQueue) ? state.appEquipmentAccountabilityActionQueue : [];
        e.equipmentAccountabilityActionBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.equipment_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.action_title || '')}</strong><div class="muted">Scan: ${escHtml(row.scanner_status || '')}</div></td>
            <td>${renderStatusPill(row.action_status || 'planned', /ready|done|in_progress|pass/i.test(String(row.action_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.server_enforcement_status || '')}<div class="muted">${escHtml(row.service_task_behavior || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment accountability rows loaded yet. Apply schema 128.</td></tr>';
      }
      if (e.publicSeoPublicationBody) {
        const rows = Array.isArray(state.appPublicSeoPublicationQueue) ? state.appPublicSeoPublicationQueue : [];
        e.publicSeoPublicationBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.publish_area || '')}<div class="muted">${escHtml(row.route_key || '')}</div></td>
            <td><strong>${escHtml(row.publish_title || '')}</strong><div class="muted">${escHtml(row.required_evidence || '')}</div></td>
            <td>${renderStatusPill(row.publish_status || 'planned', /ready|done|in_progress|pass/i.test(String(row.publish_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.smoke_test_hint || '')}<div class="muted">${escHtml(row.local_wording_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No public SEO publication rows loaded yet. Apply schema 128.</td></tr>';
      }
      if (e.fallbackObservabilityBody) {
        const rows = Array.isArray(state.appFallbackObservabilityMatrix) ? state.appFallbackObservabilityMatrix : [];
        e.fallbackObservabilityBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.app_surface || '')}</td>
            <td><strong>${escHtml(row.failure_mode || '')}</strong><div class="muted">${escHtml(row.telemetry_hint || '')}</div></td>
            <td>${renderStatusPill(row.fallback_status || 'review', /covered|ready|done|pass/i.test(String(row.fallback_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.user_message_hint || '')}<div class="muted">${escHtml(row.retry_policy_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.owner_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No fallback observability rows loaded yet. Apply schema 128.</td></tr>';
      }
      if (e.schemaCompatibilityBody) {
        const rows = Array.isArray(state.appSchemaMigrationCompatibilityChecks) ? state.appSchemaMigrationCompatibilityChecks : [];
        e.schemaCompatibilityBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.schema_file || '')}<div class="muted">${escHtml(row.compatibility_area || '')}</div></td>
            <td><strong>${escHtml(row.check_title || '')}</strong><div class="muted">${escHtml(row.repair_hint || '')}</div></td>
            <td>${renderStatusPill(row.check_status || 'review', /pass|covered|ready|done/i.test(String(row.check_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.legacy_column || '')} → ${escHtml(row.expected_column || '')}</td>
            <td class="admin-table-note">${escHtml(row.smoke_test_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No schema compatibility rows loaded yet. Apply schema 129.</td></tr>';
      }
      if (e.accountingEvidencePackageBody) {
        const rows = Array.isArray(state.appAccountingEvidencePackageQueue) ? state.appAccountingEvidencePackageQueue : [];
        e.accountingEvidencePackageBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.package_area || '')}<div class="muted">${escHtml(row.reviewer_role_hint || '')}</div></td>
            <td><strong>${escHtml(row.package_title || '')}</strong><div class="muted">${escHtml(row.source_rows_hint || '')}</div></td>
            <td>${renderStatusPill(row.package_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.package_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.required_proof_hint || '')}<div class="muted">${escHtml(row.export_format_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No accounting evidence package rows loaded yet. Apply schema 129.</td></tr>';
      }
      if (e.equipmentReturnRulesBody) {
        const rows = Array.isArray(state.appEquipmentReturnToServiceRules) ? state.appEquipmentReturnToServiceRules : [];
        e.equipmentReturnRulesBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.equipment_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.rule_title || '')}</strong><div class="muted">${escHtml(row.source_event_hint || '')}</div></td>
            <td>${renderStatusPill(row.rule_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.rule_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.proof_required_hint || '')}<div class="muted">${escHtml(row.block_behavior || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment return-to-service rows loaded yet. Apply schema 129.</td></tr>';
      }
      if (e.publicAssetSmokeBody) {
        const rows = Array.isArray(state.appPublicAssetSmokeChecks) ? state.appPublicAssetSmokeChecks : [];
        e.publicAssetSmokeBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.asset_area || '')}</td>
            <td><strong>${escHtml(row.asset_title || '')}</strong><div class="muted">${escHtml(row.source_registry_hint || '')}</div></td>
            <td>${renderStatusPill(row.check_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.check_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.file_path || '')}<div class="muted">${escHtml(row.local_seo_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.failure_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No public asset smoke rows loaded yet. Apply schema 129.</td></tr>';
      }
      if (e.errorRecoveryPlaybookBody) {
        const rows = Array.isArray(state.appErrorRecoveryPlaybook) ? state.appErrorRecoveryPlaybook : [];
        e.errorRecoveryPlaybookBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.app_area || '')}</td>
            <td><strong>${escHtml(row.error_signature || '')}</strong><div class="muted">${escHtml(row.operator_message || '')}</div></td>
            <td>${renderStatusPill(row.playbook_status || 'review', /covered|pass|ready|done/i.test(String(row.playbook_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.recovery_steps || '')}<div class="muted">${escHtml(row.prevention_check || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.owner_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No error recovery playbook rows loaded yet. Apply schema 129.</td></tr>';
      }
      if (e.paymentExecutionQueueBody) {
        const rows = Array.isArray(state.appPaymentExecutionQueue) ? state.appPaymentExecutionQueue : [];
        e.paymentExecutionQueueBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.action_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.action_title || '')}</strong></td>
            <td>${renderStatusPill(row.action_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.action_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.source_rows_hint || '')}<div class="muted">${escHtml(row.route_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No payment execution rows loaded yet. Apply schema 130.</td></tr>';
      }
      if (e.bankReconciliationExecutionBody) {
        const rows = Array.isArray(state.appBankReconciliationExecutionQueue) ? state.appBankReconciliationExecutionQueue : [];
        e.bankReconciliationExecutionBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.action_area || '')}</td>
            <td><strong>${escHtml(row.action_title || '')}</strong></td>
            <td>${renderStatusPill(row.action_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.action_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.source_rows_hint || '')}<div class="muted">${escHtml(row.route_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No reconciliation execution rows loaded yet. Apply schema 130.</td></tr>';
      }
      if (e.equipmentScanTemplateBody) {
        const rows = Array.isArray(state.appEquipmentScanTemplateRegistry) ? state.appEquipmentScanTemplateRegistry : [];
        e.equipmentScanTemplateBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.equipment_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.action_title || '')}</strong></td>
            <td>${renderStatusPill(row.action_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.action_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.scanner_status || '')}<div class="muted">${escHtml(row.service_task_behavior || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment scan/template rows loaded yet. Apply schema 130.</td></tr>';
      }
      if (e.localSeoExecutionBody) {
        const rows = Array.isArray(state.appLocalSeoExecutionQueue) ? state.appLocalSeoExecutionQueue : [];
        e.localSeoExecutionBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.seo_area || '')}</td>
            <td><strong>${escHtml(row.action_title || '')}</strong></td>
            <td>${renderStatusPill(row.action_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.action_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.required_evidence || '')}<div class="muted">${escHtml(row.local_wording_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No local SEO execution rows loaded yet. Apply schema 130.</td></tr>';
      }
      if (e.fallbackDrillBody) {
        const rows = Array.isArray(state.appFallbackDrillQueue) ? state.appFallbackDrillQueue : [];
        e.fallbackDrillBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.app_surface || '')}</td>
            <td><strong>${escHtml(row.drill_title || '')}</strong></td>
            <td>${renderStatusPill(row.drill_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.drill_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.trigger_hint || '')}<div class="muted">${escHtml(row.expected_fallback || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.owner_hint || '')}<div class="muted">${escHtml(row.recovery_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No fallback drill rows loaded yet. Apply schema 130.</td></tr>';
      }
      if (e.paymentApplicationUiQueueBody) {
        const rows = Array.isArray(state.appPaymentApplicationUiQueue) ? state.appPaymentApplicationUiQueue : [];
        e.paymentApplicationUiQueueBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.control_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.control_title || '')}</strong><div class="muted">${escHtml(row.route_hint || '')}</div></td>
            <td>${renderStatusPill(row.control_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.control_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.validation_hint || '')}<div class="muted">${escHtml(row.posting_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No payment UI control rows loaded yet. Apply schema 131.</td></tr>';
      }
      if (e.reconciliationImportValidationBody) {
        const rows = Array.isArray(state.appReconciliationImportValidationQueue) ? state.appReconciliationImportValidationQueue : [];
        e.reconciliationImportValidationBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.import_area || '')}</td>
            <td><strong>${escHtml(row.check_title || '')}</strong><div class="muted">${escHtml(row.reviewer_hint || '')}</div></td>
            <td>${renderStatusPill(row.check_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.check_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.csv_rule_hint || '')}<div class="muted">${escHtml(row.match_rule_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No reconciliation import validation rows loaded yet. Apply schema 131.</td></tr>';
      }
      if (e.equipmentServiceCloseoutBody) {
        const rows = Array.isArray(state.appEquipmentServiceCloseoutQueue) ? state.appEquipmentServiceCloseoutQueue : [];
        e.equipmentServiceCloseoutBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.equipment_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.closeout_title || '')}</strong></td>
            <td>${renderStatusPill(row.closeout_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.closeout_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.proof_hint || '')}<div class="muted">${escHtml(row.cost_capture_hint || '')}</div><div class="muted">${escHtml(row.return_to_service_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment service closeout rows loaded yet. Apply schema 131.</td></tr>';
      }
      if (e.seoAssetPublicationBody) {
        const rows = Array.isArray(state.appSeoAssetPublicationQueue) ? state.appSeoAssetPublicationQueue : [];
        e.seoAssetPublicationBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.seo_area || '')}<div class="muted">${escHtml(row.route_key || '')}</div></td>
            <td><strong>${escHtml(row.asset_title || '')}</strong></td>
            <td>${renderStatusPill(row.asset_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.asset_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.file_path_hint || '')}<div class="muted">${escHtml(row.local_search_hint || '')}</div><div class="muted">${escHtml(row.validation_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No SEO asset publication rows loaded yet. Apply schema 131.</td></tr>';
      }
      if (e.runtimeRecoveryTelemetryBody) {
        const rows = Array.isArray(state.appRuntimeRecoveryTelemetryQueue) ? state.appRuntimeRecoveryTelemetryQueue : [];
        e.runtimeRecoveryTelemetryBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.app_surface || '')}</td>
            <td><strong>${escHtml(row.recovery_title || '')}</strong></td>
            <td>${renderStatusPill(row.recovery_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.recovery_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.signal_hint || '')}<div class="muted">${escHtml(row.operator_message_hint || '')}</div><div class="muted">${escHtml(row.retry_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.owner_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No runtime recovery telemetry rows loaded yet. Apply schema 131.</td></tr>';
      }
      if (e.paymentPostingProofBody) {
        const rows = Array.isArray(state.appPaymentPostingProofQueue) ? state.appPaymentPostingProofQueue : [];
        e.paymentPostingProofBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.proof_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.proof_title || '')}</strong></td>
            <td>${renderStatusPill(row.proof_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.proof_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.source_row_hint || '')}<div class="muted">${escHtml(row.proof_requirement || '')}</div><div class="muted">${escHtml(row.posting_block_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No payment posting proof rows loaded yet. Apply schema 132.</td></tr>';
      }
      if (e.reconciliationMatchWorkbenchBody) {
        const rows = Array.isArray(state.appReconciliationMatchWorkbenchQueue) ? state.appReconciliationMatchWorkbenchQueue : [];
        e.reconciliationMatchWorkbenchBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.match_area || '')}</td>
            <td><strong>${escHtml(row.workbench_title || '')}</strong></td>
            <td>${renderStatusPill(row.workbench_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.workbench_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.import_rule_hint || '')}<div class="muted">${escHtml(row.match_score_hint || '')}</div><div class="muted">${escHtml(row.manual_review_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No reconciliation match workbench rows loaded yet. Apply schema 132.</td></tr>';
      }
      if (e.equipmentScanVerificationBody) {
        const rows = Array.isArray(state.appEquipmentScanVerificationQueue) ? state.appEquipmentScanVerificationQueue : [];
        e.equipmentScanVerificationBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.equipment_area || '')}</td>
            <td><strong>${escHtml(row.verification_title || '')}</strong></td>
            <td>${renderStatusPill(row.verification_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.verification_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.scan_path_hint || '')}<div class="muted">${escHtml(row.role_gate_hint || '')}</div><div class="muted">${escHtml(row.evidence_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment scan verification rows loaded yet. Apply schema 132.</td></tr>';
      }
      if (e.localSeoAssetSmokeBody) {
        const rows = Array.isArray(state.appLocalSeoAssetSmokeQueue) ? state.appLocalSeoAssetSmokeQueue : [];
        e.localSeoAssetSmokeBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.seo_area || '')}</td>
            <td><strong>${escHtml(row.smoke_title || '')}</strong></td>
            <td>${renderStatusPill(row.smoke_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.smoke_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.asset_path_hint || '')}<div class="muted">${escHtml(row.local_relevance_hint || '')}</div><div class="muted">${escHtml(row.validation_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No local SEO asset smoke rows loaded yet. Apply schema 132.</td></tr>';
      }
      if (e.runtimeFallbackDrillHistoryBody) {
        const rows = Array.isArray(state.appRuntimeFallbackDrillHistoryQueue) ? state.appRuntimeFallbackDrillHistoryQueue : [];
        e.runtimeFallbackDrillHistoryBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.app_surface || '')}</td>
            <td><strong>${escHtml(row.drill_title || '')}</strong></td>
            <td>${renderStatusPill(row.drill_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.drill_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.trigger_hint || '')}<div class="muted">${escHtml(row.expected_result_hint || '')}</div><div class="muted">${escHtml(row.evidence_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No runtime fallback drill history rows loaded yet. Apply schema 132.</td></tr>';
      }

      if (e.paymentWritePathBody) {
        const rows = Array.isArray(state.appPaymentWritePathQueue) ? state.appPaymentWritePathQueue : [];
        e.paymentWritePathBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.write_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.write_title || '')}</strong><div class="muted">${escHtml(row.source_rows_hint || '')}</div></td>
            <td>${renderStatusPill(row.write_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.write_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.validation_hint || '')}<div class="muted">${escHtml(row.posting_proof_hint || '')}</div><div class="muted">${escHtml(row.rollback_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No payment write-path rows loaded yet. Apply schema 133.</td></tr>';
      }
      if (e.reconciliationScoringRuleBody) {
        const rows = Array.isArray(state.appReconciliationScoringRuleQueue) ? state.appReconciliationScoringRuleQueue : [];
        e.reconciliationScoringRuleBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.rule_area || '')}</td>
            <td><strong>${escHtml(row.rule_title || '')}</strong><div class="muted">${escHtml(row.score_hint || '')}</div></td>
            <td>${renderStatusPill(row.rule_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.rule_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.match_input_hint || '')}<div class="muted">${escHtml(row.reviewer_action_hint || '')}</div><div class="muted">${escHtml(row.undo_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No reconciliation scoring rows loaded yet. Apply schema 133.</td></tr>';
      }
      if (e.equipmentAccessoryTemplateBody) {
        const rows = Array.isArray(state.appEquipmentAccessoryTemplateQueue) ? state.appEquipmentAccessoryTemplateQueue : [];
        e.equipmentAccessoryTemplateBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.equipment_pool_hint || '')}</td>
            <td><strong>${escHtml(row.template_title || '')}</strong><div class="muted">${escHtml(row.expected_items_hint || '')}</div></td>
            <td>${renderStatusPill(row.template_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.template_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.checkout_compare_hint || '')}<div class="muted">${escHtml(row.return_compare_hint || '')}</div><div class="muted">${escHtml(row.exception_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment accessory template rows loaded yet. Apply schema 133.</td></tr>';
      }
      if (e.localSeoGenerationBody) {
        const rows = Array.isArray(state.appLocalSeoGenerationQueue) ? state.appLocalSeoGenerationQueue : [];
        e.localSeoGenerationBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.seo_area || '')}</td>
            <td><strong>${escHtml(row.generation_title || '')}</strong><div class="muted">${escHtml(row.source_registry_hint || '')}</div></td>
            <td>${renderStatusPill(row.generation_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.generation_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.output_asset_hint || '')}<div class="muted">${escHtml(row.local_relevance_hint || '')}</div><div class="muted">${escHtml(row.validation_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No local SEO generation rows loaded yet. Apply schema 133.</td></tr>';
      }
      if (e.mobileOfflineConflictResolutionBody) {
        const rows = Array.isArray(state.appMobileOfflineConflictResolutionQueue) ? state.appMobileOfflineConflictResolutionQueue : [];
        e.mobileOfflineConflictResolutionBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.form_area || '')}</td>
            <td><strong>${escHtml(row.conflict_title || '')}</strong></td>
            <td>${renderStatusPill(row.conflict_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.conflict_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.detection_hint || '')}<div class="muted">${escHtml(row.user_choice_hint || '')}</div><div class="muted">${escHtml(row.retry_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.data_safety_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No mobile offline conflict rows loaded yet. Apply schema 133.</td></tr>';
      }
      if (e.paymentAdjustmentWorkflowBody) {
        const rows = Array.isArray(state.appPaymentAdjustmentWorkflowQueue) ? state.appPaymentAdjustmentWorkflowQueue : [];
        e.paymentAdjustmentWorkflowBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.workflow_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.workflow_title || '')}</strong></td>
            <td>${renderStatusPill(row.workflow_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.workflow_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.validation_hint || '')}<div class="muted">${escHtml(row.posting_hint || '')}</div><div class="muted">${escHtml(row.reversal_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.evidence_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No payment adjustment workflow rows loaded yet. Apply schema 134.</td></tr>';
      }
      if (e.reconciliationExceptionResolutionBody) {
        const rows = Array.isArray(state.appReconciliationExceptionResolutionQueue) ? state.appReconciliationExceptionResolutionQueue : [];
        e.reconciliationExceptionResolutionBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.exception_area || '')}</td>
            <td><strong>${escHtml(row.exception_title || '')}</strong></td>
            <td>${renderStatusPill(row.exception_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.exception_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.match_score_hint || '')}<div class="muted">${escHtml(row.human_review_hint || '')}</div><div class="muted">${escHtml(row.posting_block_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.undo_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No reconciliation exception rows loaded yet. Apply schema 134.</td></tr>';
      }
      if (e.equipmentScanRolloutBody) {
        const rows = Array.isArray(state.appEquipmentScanRolloutQueue) ? state.appEquipmentScanRolloutQueue : [];
        e.equipmentScanRolloutBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.rollout_area || '')}</td>
            <td><strong>${escHtml(row.rollout_title || '')}</strong></td>
            <td>${renderStatusPill(row.rollout_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.rollout_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.device_requirement_hint || '')}<div class="muted">${escHtml(row.manual_fallback_hint || '')}</div><div class="muted">${escHtml(row.accessory_template_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.verifier_role_hint || '')}<div class="muted">${escHtml(row.service_task_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment scan rollout rows loaded yet. Apply schema 134.</td></tr>';
      }
      if (e.localSeoContentDepthBody) {
        const rows = Array.isArray(state.appLocalSeoContentDepthQueue) ? state.appLocalSeoContentDepthQueue : [];
        e.localSeoContentDepthBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.route_key || '')}<div class="muted">${escHtml(row.content_area || '')}</div></td>
            <td><strong>${escHtml(row.content_title || '')}</strong></td>
            <td>${renderStatusPill(row.content_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.content_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.primary_local_phrase || '')}<div class="muted">${escHtml(row.proof_requirement_hint || '')}</div><div class="muted">${escHtml(row.internal_link_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.publication_gate_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No local SEO content depth rows loaded yet. Apply schema 134.</td></tr>';
      }
      if (e.runtimeErrorMessageCatalogBody) {
        const rows = Array.isArray(state.appRuntimeErrorMessageCatalog) ? state.appRuntimeErrorMessageCatalog : [];
        e.runtimeErrorMessageCatalogBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.app_surface || '')}</td>
            <td><strong>${escHtml(row.error_title || '')}</strong></td>
            <td>${renderStatusPill(row.error_status || 'review', /pass|covered|ready|done|in_progress/i.test(String(row.error_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.user_message || '')}<div class="muted">${escHtml(row.operator_hint || '')}</div><div class="muted">${escHtml(row.telemetry_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.retry_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No runtime message catalog rows loaded yet. Apply schema 134.</td></tr>';
      }
      applyAdminActionDisabledStates();
    }


    function confirmAdminAction(message, details = '') {
      const clean = String(message || 'Continue?').trim();
      const suffix = String(details || '').trim();
      return window.confirm(suffix ? `${clean}\n\n${suffix}` : clean);
    }

    async function handleJobReviewAction(event) {
      const btn = event.target.closest('.admin-job-action');
      if (!btn) return;
      const jobId = btn.getAttribute('data-job-id') || '';
      const action = btn.getAttribute('data-job-action') || 'open';
      const row = (Array.isArray(state.jobs) ? state.jobs : []).find((job) => String(job.id) === String(jobId));
      if (!jobId) return;
      if (action === 'open') {
        setSummary(`Focused job ${row?.job_code || jobId}. Use the Jobs/Operations toolbar to keep reviewing this page.`);
        btn.closest('tr')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        return;
      }
      let status = '';
      if (action === 'complete') status = 'completed';
      if (action === 'cancel') status = 'cancelled';
      if (action !== 'note') {
        const label = row?.job_code || row?.job_name || jobId;
        if (!confirmAdminAction(`Mark job ${label} as ${status}?`, 'This changes the job status and writes an admin activity record.')) return;
      }
      const notePrompt = action === 'note'
        ? 'Add a short job note:'
        : `Optional note for marking this job ${status}:`;
      const note = window.prompt(notePrompt, '') || '';
      const payload = action === 'note'
        ? { entity: 'job', action: 'add_note', item_id: jobId, note }
        : { entity: 'job', action: 'update_status', item_id: jobId, status, note };
      if (action === 'note' && !note.trim()) return;
      btn.disabled = true;
      try {
        const resp = await manageAdminEntity(payload);
        if (!resp?.ok) throw new Error(resp?.error || 'Job action failed.');
        setSummary(action === 'note' ? 'Job note saved.' : `Job marked ${status}.`);
        await refreshAdminPanelScope('operations');
      } catch (err) {
        setSummary(String(err?.message || err || 'Job action failed.'), true);
      } finally {
        btn.disabled = false;
      }
    }

    function renderBackboneTable() {
      const e = els();
      const entity = e.backboneEntity?.value || 'unit_of_measure';
      renderJobsPagination();
      renderJobsReviewTable();
      setActiveAdminHubFocus(entity);
      const cfg = BACKBONE_CONFIG[entity];
      const rows = getBackboneRows(entity);
      if (!cfg || !e.backboneBody || !e.backboneHead || !e.backboneItemId) return;
      e.backboneHead.innerHTML = cfg.columns.map(([, label]) => `<th>${escHtml(label)}</th>`).join('');
      e.backboneItemId.innerHTML = optionList(rows, cfg.valueKey || 'id', (row) => row[cfg.labelField] || row.id, `Select ${cfg.label}`);
      e.backboneBody.innerHTML = rows.map((row) => `<tr data-backbone-id="${escHtml(row.id)}">${cfg.columns.map(([key]) => `<td>${escHtml(getBackboneDisplayValue(entity, key, row))}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cfg.columns.length}" class="muted">No ${escHtml(cfg.label.toLowerCase())} loaded.</td></tr>`;
      renderBackboneInsights();
    }

    function getSelectedBackboneRecord() {
      const e = els();
      const entity = e.backboneEntity?.value || 'unit_of_measure';
      const rows = getBackboneRows(entity);
      return rows.find((row) => String(row.id) === String(e.backboneItemId?.value || '')) || null;
    }

    function collectBackbonePayload() {
      const e = els();
      const entity = e.backboneEntity?.value || 'unit_of_measure';
      const cfg = BACKBONE_CONFIG[entity];
      const payload = { entity, action: 'update', item_id: e.backboneItemId?.value || '' };
      cfg.fields.forEach((field) => {
        const input = document.getElementById(`ad_bb_${field.name}`);
        if (!input) return;
        payload[field.name] = field.type === 'checkbox' ? !!input.checked : input.value;
      });
      return payload;
    }

    async function saveBackboneItem(isCreate = false) {
      const e = els();
      const entity = e.backboneEntity?.value || 'unit_of_measure';
      const cfg = BACKBONE_CONFIG[entity];
      const payload = collectBackbonePayload();
      payload.action = isCreate ? 'create' : 'update';
      payload.item_id = e.backboneItemId?.value || '';
      for (const field of cfg.fields) {
        if (!field.required) continue;
        const input = document.getElementById(`ad_bb_${field.name}`);
        const val = field.type === 'checkbox' ? !!input?.checked : String(input?.value || '').trim();
        if (!val) throw new Error(`${field.label} is required.`);
      }
      const resp = await manageAdminEntity(payload);
      if (!resp?.ok) throw new Error(resp?.error || `${cfg.label} save failed.`);
      setSummary(isCreate ? `${cfg.label} record created.` : `${cfg.label} record updated.`);
      await loadDirectory();
      await refreshSelectors();
      fillBackboneForm(resp.record || null);
      renderBackboneTable();
    }

    async function postBackboneJournalBatch() {
      const e = els();
      const entity = e.backboneEntity?.value || 'unit_of_measure';
      if (entity !== 'gl_journal_batch') throw new Error('Select a journal batch first.');
      const itemId = e.backboneItemId?.value || '';
      if (!itemId) throw new Error('Select a journal batch first.');
      const resp = await manageAdminEntity({ entity, action: 'post', item_id: itemId, posting_notes: document.getElementById('ad_bb_posting_notes')?.value || '' });
      if (!resp?.ok) throw new Error(resp?.error || 'Journal batch post failed.');
      setSummary('Journal batch posted.');
      await loadDirectory();
      await refreshSelectors();
      fillBackboneForm(resp.record || null);
      renderBackboneTable();
    }

    async function deleteBackboneItem() {
      const e = els();
      const entity = e.backboneEntity?.value || 'unit_of_measure';
      const cfg = BACKBONE_CONFIG[entity];
      const itemId = e.backboneItemId?.value || '';
      if (!itemId) throw new Error(`Select a ${cfg.label.toLowerCase()} record first.`);
      const resp = await manageAdminEntity({ entity, action: 'delete', item_id: itemId });
      if (!resp?.ok) throw new Error(resp?.error || `${cfg.label} delete failed.`);
      setSummary(`${cfg.label} record deleted.`);
      await loadDirectory();
      await refreshSelectors();
      fillBackboneForm(null);
      renderBackboneTable();
    }

    function renderCatalogManager() {
      const e = els();
      const rows = getCatalogRows(e.catalogType?.value || 'position');
      if (e.catalogItemId) {
        const current = e.catalogItemId.value || '';
        e.catalogItemId.innerHTML = optionList(rows, 'id', (row) => row.name || row.position_name || row.trade_name || row.id, 'Select item');
        setSelectValue(e.catalogItemId, current);
      }
      if (e.catalogBody) {
        e.catalogBody.innerHTML = rows.map((row) => `<tr data-catalog-id="${escHtml(row.id)}"><td>${escHtml(row.name || row.position_name || row.trade_name || '')}</td><td>${escHtml(row.sort_order ?? 100)}</td><td>${row.is_active === false ? 'No' : 'Yes'}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No catalog items loaded.</td></tr>';
      }
    }

    function fillCatalogForm(item) {
      const e = els();
      const row = item || {};
      if (e.catalogItemId) setSelectValue(e.catalogItemId, row.id || '');
      if (e.catalogName) e.catalogName.value = row.name || row.position_name || row.trade_name || '';
      if (e.catalogSort) e.catalogSort.value = String(row.sort_order ?? 100);
      if (e.catalogActive) e.catalogActive.checked = row.is_active !== false;
    }

    function renderAssignmentWorkbench() {
      const e = els();
      const assignments = Array.isArray(state.assignments) ? state.assignments : [];
      const sites = Array.isArray(state.sites) ? state.sites : [];
      const profiles = Array.isArray(state.users) ? state.users : [];
      const supervisors = profiles.filter((row) => ['supervisor','site_leader','hse','job_admin','admin'].includes(String(row.role || '')));
      const admins = profiles.filter((row) => String(row.role || '') === 'admin');
      if (e.assignmentId) {
        const current = e.assignmentId.value || '';
        e.assignmentId.innerHTML = optionList(assignments, 'id', (row) => `${row.site_code || row['sites']?.site_code || 'Site'} - ${row.full_name || row['profiles']?.full_name || row.profile_id || ''}`, 'Select assignment');
        setSelectValue(e.assignmentId, current);
      }
      if (e.assignmentSiteId) {
        const current = e.assignmentSiteId.value || '';
        e.assignmentSiteId.innerHTML = optionList(sites, 'id', (row) => `${row.site_code || ''} ${row.site_name ? '- ' + row.site_name : ''}`, 'Select site');
        setSelectValue(e.assignmentSiteId, current);
      }
      if (e.assignmentProfileId) {
        const current = e.assignmentProfileId.value || '';
        e.assignmentProfileId.innerHTML = optionList(profiles, 'id', (row) => `${row.full_name || row.email || row.id} (${row.role || 'employee'})`, 'Select staff');
        setSelectValue(e.assignmentProfileId, current);
      }
      if (e.assignmentSupervisor) {
        const current = e.assignmentSupervisor.value || '';
        e.assignmentSupervisor.innerHTML = optionList(supervisors, 'id', (row) => row.full_name || row.email || row.id, 'Select supervisor');
        setSelectValue(e.assignmentSupervisor, current);
      }
      if (e.assignmentAdmin) {
        const current = e.assignmentAdmin.value || '';
        e.assignmentAdmin.innerHTML = optionList(admins, 'id', (row) => row.full_name || row.email || row.id, 'Select admin');
        setSelectValue(e.assignmentAdmin, current);
      }
      if (e.assignmentsBody) {
        e.assignmentsBody.innerHTML = assignments.map((row) => `<tr data-assignment-id="${escHtml(row.id)}"><td>${escHtml(row.site_code || row['sites']?.site_code || '')}</td><td>${escHtml(row.full_name || row['profiles']?.full_name || row.profile_id || '')}</td><td>${escHtml(row.assignment_role || '')}</td><td>${row.is_primary ? 'Yes' : 'No'}</td><td>${escHtml(row.supervisor_name || '')}</td><td>${escHtml(row.admin_name || '')}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No assignments loaded.</td></tr>';
      }
    }

    function fillAssignmentForm(item) {
      const e = els();
      const row = item || {};
      if (e.assignmentId) setSelectValue(e.assignmentId, row.id || '');
      if (e.assignmentSiteId) setSelectValue(e.assignmentSiteId, row.site_id || '');
      if (e.assignmentProfileId) setSelectValue(e.assignmentProfileId, row.profile_id || '');
      if (e.assignmentRole) setSelectValue(e.assignmentRole, row.assignment_role || 'worker');
      if (e.assignmentSupervisor) setSelectValue(e.assignmentSupervisor, row.reports_to_supervisor_profile_id || '');
      if (e.assignmentAdmin) setSelectValue(e.assignmentAdmin, row.reports_to_admin_profile_id || '');
      if (e.assignmentPrimary) e.assignmentPrimary.checked = !!row.is_primary;
    }

    function getSelectedAssignment() {
      const e = els();
      return (state.assignments || []).find((row) => String(row.id) === String(e.assignmentId?.value || '')) || null;
    }

    async function saveAssignment(isCreate = false) {
      const e = els();
      const payload = {
        entity: 'assignment',
        action: isCreate ? 'create' : 'update',
        assignment_id: e.assignmentId?.value || '',
        site_id: e.assignmentSiteId?.value || '',
        profile_id: e.assignmentProfileId?.value || '',
        assignment_role: e.assignmentRole?.value || 'worker',
        is_primary: !!e.assignmentPrimary?.checked,
        reports_to_supervisor_name: (state.users || []).find((row) => String(row.id) === String(e.assignmentSupervisor?.value || ''))?.email || '',
        reports_to_admin_name: (state.users || []).find((row) => String(row.id) === String(e.assignmentAdmin?.value || ''))?.email || ''
      };
      if (!payload.site_id || !payload.profile_id) throw new Error('Site and profile are required for assignments.');
      const resp = await manageAdminEntity(payload);
      if (!resp?.ok) throw new Error(resp?.error || 'Assignment save failed.');
      setSummary(isCreate ? 'Assignment created.' : 'Assignment updated.');
      await loadDirectory();
      fillAssignmentForm(resp.record || null);
    }

    async function deleteAssignment() {
      const e = els();
      const assignmentId = e.assignmentId?.value || '';
      if (!assignmentId) throw new Error('Select an assignment first.');
      const resp = await manageAdminEntity({ entity: 'assignment', action: 'delete', assignment_id: assignmentId });
      if (!resp?.ok) throw new Error(resp?.error || 'Assignment delete failed.');
      setSummary('Assignment deleted.');
      await loadDirectory();
      fillAssignmentForm(null);
    }

    async function saveCatalogItem(isCreate = false) {
      const e = els();
      const payload = {
        entity: 'catalog',
        action: isCreate ? 'create' : 'update',
        catalog_type: e.catalogType?.value || 'position',
        item_id: e.catalogItemId?.value || '',
        name: e.catalogName?.value || '',
        sort_order: Number(e.catalogSort?.value || 100),
        is_active: !!e.catalogActive?.checked
      };
      if (!payload.name.trim()) throw new Error('Catalog item name is required.');
      const resp = await manageAdminEntity(payload);
      if (!resp?.ok) throw new Error(resp?.error || 'Catalog save failed.');
      setSummary(isCreate ? 'Catalog item created.' : 'Catalog item updated.');
      await refreshSelectors();
      fillCatalogForm(resp.record || null);
    }

    async function deleteCatalogItem() {
      const e = els();
      const itemId = e.catalogItemId?.value || '';
      if (!itemId) throw new Error('Select a catalog item first.');
      const resp = await manageAdminEntity({ entity: 'catalog', action: 'delete', catalog_type: e.catalogType?.value || 'position', item_id: itemId });
      if (!resp?.ok) throw new Error(resp?.error || 'Catalog delete failed.');
      setSummary('Catalog item deleted.');
      await refreshSelectors();
      fillCatalogForm(null);
    }

    async function refreshSelectors() {
      if (!loadAdminSelectors) return true;
      try {
        const payload = await loadAdminSelectors({ scope: 'admin_core' });
        state.selectors = {
          profiles: Array.isArray(payload?.profiles) ? payload.profiles : state.users,
          sites: Array.isArray(payload?.sites) ? payload.sites : state.sites,
          assignments: Array.isArray(payload?.assignments) ? payload.assignments : state.assignments,
          positions: Array.isArray(payload?.positions) ? payload.positions : [],
          trades: Array.isArray(payload?.trades) ? payload.trades : [],
          staffTiers: Array.isArray(payload?.staff_tiers) ? payload.staff_tiers : [],
          seniorityLevels: Array.isArray(payload?.seniority_levels) ? payload.seniority_levels : [],
          employmentStatuses: Array.isArray(payload?.employment_statuses) ? payload.employment_statuses : [],
          jobTypes: Array.isArray(payload?.job_types) ? payload.job_types : [],
          units: Array.isArray(payload?.units_of_measure) ? payload.units_of_measure : state.unitsOfMeasure,
          costCodes: Array.isArray(payload?.cost_codes) ? payload.cost_codes : state.costCodes,
          taxCodes: Array.isArray(payload?.tax_codes) ? payload.tax_codes : state.taxCodes,
          servicePricingTemplates: Array.isArray(payload?.service_pricing_templates) ? payload.service_pricing_templates : state.servicePricingTemplates,
          businessTaxSettings: Array.isArray(payload?.business_tax_settings) ? payload.business_tax_settings : state.businessTaxSettings,
          serviceAreas: Array.isArray(payload?.service_areas) ? payload.service_areas : state.serviceAreas,
          routes: Array.isArray(payload?.routes) ? payload.routes : state.routes,
          jobs: Array.isArray(payload?.jobs) ? payload.jobs : state.jobs,
          routeStops: Array.isArray(payload?.route_stops) ? payload.route_stops : state.routeStops,
          routeStopExecutions: Array.isArray(payload?.route_stop_executions) ? payload.route_stop_executions : state.routeStopExecutions,
          routeStopExecutionAttachments: Array.isArray(payload?.route_stop_execution_attachments) ? payload.route_stop_execution_attachments : state.routeStopExecutionAttachments,
          clients: Array.isArray(payload?.clients) ? payload.clients : state.clients,
          clientSites: Array.isArray(payload?.client_sites) ? payload.client_sites : state.clientSites,
          materials: Array.isArray(payload?.materials_catalog) ? payload.materials_catalog : state.materialsCatalog,
          equipmentMaster: Array.isArray(payload?.equipment_master) ? payload.equipment_master : state.equipmentMaster,
          estimates: Array.isArray(payload?.estimates) ? payload.estimates : state.estimates,
          estimateLines: Array.isArray(payload?.estimate_lines) ? payload.estimate_lines : state.estimateLines,
          workOrders: Array.isArray(payload?.work_orders) ? payload.work_orders : state.workOrders,
          workOrderLines: Array.isArray(payload?.work_order_lines) ? payload.work_order_lines : state.workOrderLines,
          subcontractClients: Array.isArray(payload?.subcontract_clients) ? payload.subcontract_clients : state.subcontractClients,
          subcontractDispatches: Array.isArray(payload?.subcontract_dispatches) ? payload.subcontract_dispatches : state.subcontractDispatches,
          linkedHsePackets: Array.isArray(payload?.linked_hse_packets) ? payload.linked_hse_packets : state.linkedHsePackets,
          hsePacketEvents: Array.isArray(payload?.hse_packet_events) ? payload.hse_packet_events : state.hsePacketEvents,
          hsePacketProofs: Array.isArray(payload?.hse_packet_proofs) ? payload.hse_packet_proofs : state.hsePacketProofs,
          glAccounts: Array.isArray(payload?.chart_of_accounts) ? payload.chart_of_accounts : state.chartOfAccounts,
          glJournalBatches: Array.isArray(payload?.gl_journal_batches) ? payload.gl_journal_batches : state.glJournalBatches,
          glJournalSyncExceptions: Array.isArray(payload?.gl_journal_sync_exceptions) ? payload.gl_journal_sync_exceptions : state.glJournalSyncExceptions,
          glJournalEntries: Array.isArray(payload?.gl_journal_entries) ? payload.gl_journal_entries : state.glJournalEntries,
          vendors: Array.isArray(payload?.ap_vendors) ? payload.ap_vendors : state.apVendors,
          arInvoices: Array.isArray(payload?.ar_invoices) ? payload.ar_invoices : state.arInvoices,
          arPayments: Array.isArray(payload?.ar_payments) ? payload.ar_payments : state.arPayments,
          apBills: Array.isArray(payload?.ap_bills) ? payload.ap_bills : state.apBills,
          apPayments: Array.isArray(payload?.ap_payments) ? payload.ap_payments : state.apPayments,
          bankAccounts: Array.isArray(payload?.bank_accounts) ? payload.bank_accounts : state.bankAccounts,
          accountingPeriodCloses: Array.isArray(payload?.accounting_period_closes) ? payload.accounting_period_closes : state.accountingPeriodCloses,
          salesTaxFilings: Array.isArray(payload?.sales_tax_filings) ? payload.sales_tax_filings : state.salesTaxFilings,
          payrollRemittanceRuns: Array.isArray(payload?.payroll_remittance_runs) ? payload.payroll_remittance_runs : state.payrollRemittanceRuns,
          bankStatementImports: Array.isArray(payload?.bank_statement_imports) ? payload.bank_statement_imports : state.bankStatementImports,
          bankReconciliationSessions: Array.isArray(payload?.bank_reconciliation_sessions) ? payload.bank_reconciliation_sessions : state.bankReconciliationSessions,
          bankReconciliationItems: Array.isArray(payload?.bank_reconciliation_items) ? payload.bank_reconciliation_items : state.bankReconciliationItems,
          arPaymentApplications: Array.isArray(payload?.ar_payment_applications) ? payload.ar_payment_applications : state.arPaymentApplications,
          apPaymentApplications: Array.isArray(payload?.ap_payment_applications) ? payload.ap_payment_applications : state.apPaymentApplications,
          accountantHandoffExports: Array.isArray(payload?.accountant_handoff_exports) ? payload.accountant_handoff_exports : state.accountantHandoffExports,
          materialReceipts: Array.isArray(payload?.material_receipts) ? payload.material_receipts : state.materialReceipts,
          materialReceiptLines: Array.isArray(payload?.material_receipt_lines) ? payload.material_receipt_lines : state.materialReceiptLines,
          materialIssues: Array.isArray(payload?.material_issues) ? payload.material_issues : state.materialIssues,
          materialIssueLines: Array.isArray(payload?.material_issue_lines) ? payload.material_issue_lines : state.materialIssueLines,
          fieldUploadFailures: Array.isArray(payload?.field_upload_failures) ? payload.field_upload_failures : state.fieldUploadFailures,
          appTrafficEvents: Array.isArray(payload?.app_traffic_events) ? payload.app_traffic_events : state.appTrafficEvents,
          backendMonitorEvents: Array.isArray(payload?.backend_monitor_events) ? payload.backend_monitor_events : state.backendMonitorEvents,
          trafficDailySummary: Array.isArray(payload?.app_traffic_daily_summary) ? payload.app_traffic_daily_summary : state.trafficDailySummary,
          monitorThresholdAlerts: Array.isArray(payload?.monitor_threshold_alerts) ? payload.monitor_threshold_alerts : state.monitorThresholdAlerts,
          adminHomeCommandCenter: Array.isArray(payload?.admin_home_command_center) ? payload.admin_home_command_center : state.adminHomeCommandCenter,
          adminErrorHealthCenter: Array.isArray(payload?.admin_error_health_center) ? payload.admin_error_health_center : state.adminErrorHealthCenter,
          adminTaskInbox: Array.isArray(payload?.admin_task_inbox) ? payload.admin_task_inbox : state.adminTaskInbox,
          appSchemaVersionStatus: Array.isArray(payload?.app_schema_version_status) ? payload.app_schema_version_status : state.appSchemaVersionStatus,
          roleDashboardPresets: Array.isArray(payload?.role_dashboard_presets) ? payload.role_dashboard_presets : state.roleDashboardPresets,
          schemaDriftStatus: Array.isArray(payload?.schema_drift_status) ? payload.schema_drift_status : state.schemaDriftStatus,
          productionReadinessChecklist: Array.isArray(payload?.production_readiness_checklist) ? payload.production_readiness_checklist : state.productionReadinessChecklist,
          rolePermissionMatrix: Array.isArray(payload?.role_permission_matrix) ? payload.role_permission_matrix : state.rolePermissionMatrix,
          adminSavedFilterDirectory: Array.isArray(payload?.admin_saved_filter_directory) ? payload.admin_saved_filter_directory : state.adminSavedFilterDirectory,
          adminSavedFilterScopeSummary: Array.isArray(payload?.admin_saved_filter_scope_summary) ? payload.admin_saved_filter_scope_summary : state.adminSavedFilterScopeSummary,
          adminCloseCenterOverview: Array.isArray(payload?.admin_close_center_overview) ? payload.admin_close_center_overview : state.adminCloseCenterOverview,
          adminCloseWizardSteps: Array.isArray(payload?.admin_close_wizard_steps) ? payload.admin_close_wizard_steps : state.adminCloseWizardSteps,
          adminHealthResolutionQueue: Array.isArray(payload?.admin_health_resolution_queue) ? payload.admin_health_resolution_queue : state.adminHealthResolutionQueue,
          adminDeploymentGateStatus: Array.isArray(payload?.admin_deployment_gate_status) ? payload.admin_deployment_gate_status : state.adminDeploymentGateStatus,
          publicSeoSmokeCheck: Array.isArray(payload?.public_seo_smoke_check) ? payload.public_seo_smoke_check : state.publicSeoSmokeCheck,
          adminAuditEventDirectory: Array.isArray(payload?.admin_audit_event_directory) ? payload.admin_audit_event_directory : state.adminAuditEventDirectory,
          adminBackupRestoreRehearsals: Array.isArray(payload?.admin_backup_restore_rehearsal_directory) ? payload.admin_backup_restore_rehearsal_directory : state.adminBackupRestoreRehearsals,
          bankCsvImportSessions: Array.isArray(payload?.bank_csv_import_session_directory) ? payload.bank_csv_import_session_directory : state.bankCsvImportSessions,
          adminEvidenceActionQueue: Array.isArray(payload?.admin_evidence_action_queue) ? payload.admin_evidence_action_queue : state.adminEvidenceActionQueue,
          adminMobileActionCards: Array.isArray(payload?.admin_mobile_action_card_directory) ? payload.admin_mobile_action_card_directory : state.adminMobileActionCards,
          adminListPaginationSettings: Array.isArray(payload?.admin_list_pagination_settings) ? payload.admin_list_pagination_settings : state.adminListPaginationSettings,
          evidenceManagerDirectory: Array.isArray(payload?.evidence_manager_directory) ? payload.evidence_manager_directory : state.evidenceManagerDirectory,
          hsePacketActionItems: Array.isArray(payload?.hse_packet_action_items) ? payload.hse_packet_action_items : state.hsePacketActionItems,
          hseDashboardSummary: Array.isArray(payload?.hse_dashboard_summary) ? payload.hse_dashboard_summary : state.hseDashboardSummary,
          accountingReviewSummary: Array.isArray(payload?.accounting_review_summary) ? payload.accounting_review_summary : state.accountingReviewSummary,
          appDeploymentBundleChecks: Array.isArray(payload?.app_deployment_bundle_checks) ? payload.app_deployment_bundle_checks : state.appDeploymentBundleChecks,
          appPublicSeoChecks: Array.isArray(payload?.app_public_seo_checks) ? payload.app_public_seo_checks : state.appPublicSeoChecks,
          appRuntimeFallbackChecks: Array.isArray(payload?.app_runtime_fallback_checks) ? payload.app_runtime_fallback_checks : state.appRuntimeFallbackChecks,
          appRoadmapActionSteps: Array.isArray(payload?.app_roadmap_action_steps) ? payload.app_roadmap_action_steps : state.appRoadmapActionSteps,
          appDepthReviewQueue: Array.isArray(payload?.app_depth_review_queue) ? payload.app_depth_review_queue : state.appDepthReviewQueue,
          appDataMigrationCandidates: Array.isArray(payload?.app_data_migration_candidates) ? payload.app_data_migration_candidates : state.appDataMigrationCandidates,
          appSchemaDocumentationSyncChecks: Array.isArray(payload?.app_schema_documentation_sync_checks) ? payload.app_schema_documentation_sync_checks : state.appSchemaDocumentationSyncChecks,
          appPublicRouteSeoRegistry: Array.isArray(payload?.app_public_route_seo_registry) ? payload.app_public_route_seo_registry : state.appPublicRouteSeoRegistry,
          appInternalLinkSuggestionQueue: Array.isArray(payload?.app_internal_link_suggestion_queue) ? payload.app_internal_link_suggestion_queue : state.appInternalLinkSuggestionQueue,
          appCssComponentTokenInventory: Array.isArray(payload?.app_css_component_token_inventory) ? payload.app_css_component_token_inventory : state.appCssComponentTokenInventory,
          appMobileFieldActionQueue: Array.isArray(payload?.app_mobile_field_action_queue) ? payload.app_mobile_field_action_queue : state.appMobileFieldActionQueue,
          appReleaseManifestChecks: Array.isArray(payload?.app_release_manifest_checks) ? payload.app_release_manifest_checks : state.appReleaseManifestChecks,
          appPaymentApplicationActionRegistry: Array.isArray(payload?.app_payment_application_action_registry) ? payload.app_payment_application_action_registry : state.appPaymentApplicationActionRegistry,
          appAccountingCloseControlQueue: Array.isArray(payload?.app_accounting_close_control_queue) ? payload.app_accounting_close_control_queue : state.appAccountingCloseControlQueue,
          appEquipmentAccountabilityActionQueue: Array.isArray(payload?.app_equipment_accountability_action_queue) ? payload.app_equipment_accountability_action_queue : state.appEquipmentAccountabilityActionQueue,
          appPublicSeoPublicationQueue: Array.isArray(payload?.app_public_seo_publication_queue) ? payload.app_public_seo_publication_queue : state.appPublicSeoPublicationQueue,
          appFallbackObservabilityMatrix: Array.isArray(payload?.app_fallback_observability_matrix) ? payload.app_fallback_observability_matrix : state.appFallbackObservabilityMatrix,
          appSchemaMigrationCompatibilityChecks: Array.isArray(payload?.app_schema_migration_compatibility_checks) ? payload.app_schema_migration_compatibility_checks : state.appSchemaMigrationCompatibilityChecks,
          appAccountingEvidencePackageQueue: Array.isArray(payload?.app_accounting_evidence_package_queue) ? payload.app_accounting_evidence_package_queue : state.appAccountingEvidencePackageQueue,
          appEquipmentReturnToServiceRules: Array.isArray(payload?.app_equipment_return_to_service_rules) ? payload.app_equipment_return_to_service_rules : state.appEquipmentReturnToServiceRules,
          appPublicAssetSmokeChecks: Array.isArray(payload?.app_public_asset_smoke_checks) ? payload.app_public_asset_smoke_checks : state.appPublicAssetSmokeChecks,
          appErrorRecoveryPlaybook: Array.isArray(payload?.app_error_recovery_playbook) ? payload.app_error_recovery_playbook : state.appErrorRecoveryPlaybook,
          appPaymentExecutionQueue: Array.isArray(payload?.app_payment_execution_queue) ? payload.app_payment_execution_queue : state.appPaymentExecutionQueue,
          appBankReconciliationExecutionQueue: Array.isArray(payload?.app_bank_reconciliation_execution_queue) ? payload.app_bank_reconciliation_execution_queue : state.appBankReconciliationExecutionQueue,
          appEquipmentScanTemplateRegistry: Array.isArray(payload?.app_equipment_scan_template_registry) ? payload.app_equipment_scan_template_registry : state.appEquipmentScanTemplateRegistry,
          appLocalSeoExecutionQueue: Array.isArray(payload?.app_local_seo_execution_queue) ? payload.app_local_seo_execution_queue : state.appLocalSeoExecutionQueue,
          appFallbackDrillQueue: Array.isArray(payload?.app_fallback_drill_queue) ? payload.app_fallback_drill_queue : state.appFallbackDrillQueue,
          appPaymentApplicationUiQueue: Array.isArray(payload?.app_payment_application_ui_queue) ? payload.app_payment_application_ui_queue : state.appPaymentApplicationUiQueue,
          appReconciliationImportValidationQueue: Array.isArray(payload?.app_reconciliation_import_validation_queue) ? payload.app_reconciliation_import_validation_queue : state.appReconciliationImportValidationQueue,
          appEquipmentServiceCloseoutQueue: Array.isArray(payload?.app_equipment_service_closeout_queue) ? payload.app_equipment_service_closeout_queue : state.appEquipmentServiceCloseoutQueue,
          appSeoAssetPublicationQueue: Array.isArray(payload?.app_seo_asset_publication_queue) ? payload.app_seo_asset_publication_queue : state.appSeoAssetPublicationQueue,
          appRuntimeRecoveryTelemetryQueue: Array.isArray(payload?.app_runtime_recovery_telemetry_queue) ? payload.app_runtime_recovery_telemetry_queue : state.appRuntimeRecoveryTelemetryQueue,
          appPaymentPostingProofQueue: Array.isArray(payload?.app_payment_posting_proof_queue) ? payload.app_payment_posting_proof_queue : state.appPaymentPostingProofQueue,
          appReconciliationMatchWorkbenchQueue: Array.isArray(payload?.app_reconciliation_match_workbench_queue) ? payload.app_reconciliation_match_workbench_queue : state.appReconciliationMatchWorkbenchQueue,
          appEquipmentScanVerificationQueue: Array.isArray(payload?.app_equipment_scan_verification_queue) ? payload.app_equipment_scan_verification_queue : state.appEquipmentScanVerificationQueue,
          appLocalSeoAssetSmokeQueue: Array.isArray(payload?.app_local_seo_asset_smoke_queue) ? payload.app_local_seo_asset_smoke_queue : state.appLocalSeoAssetSmokeQueue,
          appRuntimeFallbackDrillHistoryQueue: Array.isArray(payload?.app_runtime_fallback_drill_history_queue) ? payload.app_runtime_fallback_drill_history_queue : state.appRuntimeFallbackDrillHistoryQueue,
          appPaymentWritePathQueue: Array.isArray(payload?.app_payment_write_path_queue) ? payload.app_payment_write_path_queue : state.appPaymentWritePathQueue,
          appReconciliationScoringRuleQueue: Array.isArray(payload?.app_reconciliation_scoring_rule_queue) ? payload.app_reconciliation_scoring_rule_queue : state.appReconciliationScoringRuleQueue,
          appEquipmentAccessoryTemplateQueue: Array.isArray(payload?.app_equipment_accessory_template_queue) ? payload.app_equipment_accessory_template_queue : state.appEquipmentAccessoryTemplateQueue,
          appLocalSeoGenerationQueue: Array.isArray(payload?.app_local_seo_generation_queue) ? payload.app_local_seo_generation_queue : state.appLocalSeoGenerationQueue,
          appMobileOfflineConflictResolutionQueue: Array.isArray(payload?.app_mobile_offline_conflict_resolution_queue) ? payload.app_mobile_offline_conflict_resolution_queue : state.appMobileOfflineConflictResolutionQueue,
          appPaymentAdjustmentWorkflowQueue: Array.isArray(payload?.app_payment_adjustment_workflow_queue) ? payload.app_payment_adjustment_workflow_queue : state.appPaymentAdjustmentWorkflowQueue,
          appReconciliationExceptionResolutionQueue: Array.isArray(payload?.app_reconciliation_exception_resolution_queue) ? payload.app_reconciliation_exception_resolution_queue : state.appReconciliationExceptionResolutionQueue,
          appEquipmentScanRolloutQueue: Array.isArray(payload?.app_equipment_scan_rollout_queue) ? payload.app_equipment_scan_rollout_queue : state.appEquipmentScanRolloutQueue,
          appLocalSeoContentDepthQueue: Array.isArray(payload?.app_local_seo_content_depth_queue) ? payload.app_local_seo_content_depth_queue : state.appLocalSeoContentDepthQueue,
          appRuntimeErrorMessageCatalog: Array.isArray(payload?.app_runtime_error_message_catalog) ? payload.app_runtime_error_message_catalog : state.appRuntimeErrorMessageCatalog,
          appReleaseValidationQueue: Array.isArray(payload?.app_release_validation_queue) ? payload.app_release_validation_queue : state.appReleaseValidationQueue,
          appPaymentReconciliationExecutionQueue: Array.isArray(payload?.app_payment_reconciliation_execution_queue) ? payload.app_payment_reconciliation_execution_queue : state.appPaymentReconciliationExecutionQueue,
          appEquipmentMobileScanValidationQueue: Array.isArray(payload?.app_equipment_mobile_scan_validation_queue) ? payload.app_equipment_mobile_scan_validation_queue : state.appEquipmentMobileScanValidationQueue,
          appLocalSeoReleaseValidationQueue: Array.isArray(payload?.app_local_seo_release_validation_queue) ? payload.app_local_seo_release_validation_queue : state.appLocalSeoReleaseValidationQueue,
          appRuntimeFallbackMessageQueue: Array.isArray(payload?.app_runtime_fallback_message_queue) ? payload.app_runtime_fallback_message_queue : state.appRuntimeFallbackMessageQueue,
          appJsonDbMigrationExecutionQueue: Array.isArray(payload?.app_json_db_migration_execution_queue) ? payload.app_json_db_migration_execution_queue : state.appJsonDbMigrationExecutionQueue,
          appReleaseCutoverChecklist: Array.isArray(payload?.app_release_cutover_checklist) ? payload.app_release_cutover_checklist : state.appReleaseCutoverChecklist,
          appPaymentExceptionDecisionQueue: Array.isArray(payload?.app_payment_exception_decision_queue) ? payload.app_payment_exception_decision_queue : state.appPaymentExceptionDecisionQueue,
          appEquipmentReturnToServiceGateQueue: Array.isArray(payload?.app_equipment_return_to_service_gate_queue) ? payload.app_equipment_return_to_service_gate_queue : state.appEquipmentReturnToServiceGateQueue,
          appLocalSearchEvidenceQueue: Array.isArray(payload?.app_local_search_evidence_queue) ? payload.app_local_search_evidence_queue : state.appLocalSearchEvidenceQueue,
          appCssDriftWatchlist: Array.isArray(payload?.app_css_drift_watchlist) ? payload.app_css_drift_watchlist : state.appCssDriftWatchlist,
          appRuntimeFallbackTestPlan: Array.isArray(payload?.app_runtime_fallback_test_plan) ? payload.app_runtime_fallback_test_plan : state.appRuntimeFallbackTestPlan,
          appJsonDbSourceOfTruthQueue: Array.isArray(payload?.app_json_db_source_of_truth_queue) ? payload.app_json_db_source_of_truth_queue : state.appJsonDbSourceOfTruthQueue,
          appPaymentReconciliationCutoverDrillQueue: Array.isArray(payload?.app_payment_reconciliation_cutover_drill_queue) ? payload.app_payment_reconciliation_cutover_drill_queue : state.appPaymentReconciliationCutoverDrillQueue,
          appEquipmentServiceCostRecoveryQueue: Array.isArray(payload?.app_equipment_service_cost_recovery_queue) ? payload.app_equipment_service_cost_recovery_queue : state.appEquipmentServiceCostRecoveryQueue,
          appLocalSeoProminenceActionQueue: Array.isArray(payload?.app_local_seo_prominence_action_queue) ? payload.app_local_seo_prominence_action_queue : state.appLocalSeoProminenceActionQueue,
          appCssAccessibilityFallbackQueue: Array.isArray(payload?.app_css_accessibility_fallback_queue) ? payload.app_css_accessibility_fallback_queue : state.appCssAccessibilityFallbackQueue,
          appDataMigrationValidationQueue: Array.isArray(payload?.app_data_migration_validation_queue) ? payload.app_data_migration_validation_queue : state.appDataMigrationValidationQueue,
          appRuntimeReleaseMessageQueue: Array.isArray(payload?.app_runtime_release_message_queue) ? payload.app_runtime_release_message_queue : state.appRuntimeReleaseMessageQueue,
          appReleaseReadinessSignoffQueue: Array.isArray(payload?.app_release_readiness_signoff_queue) ? payload.app_release_readiness_signoff_queue : state.appReleaseReadinessSignoffQueue,
          appAccountingExceptionClosureQueue: Array.isArray(payload?.app_accounting_exception_closure_queue) ? payload.app_accounting_exception_closure_queue : state.appAccountingExceptionClosureQueue,
          appEquipmentServiceVerificationQueue: Array.isArray(payload?.app_equipment_service_verification_queue) ? payload.app_equipment_service_verification_queue : state.appEquipmentServiceVerificationQueue,
          appLocalSeoRefreshQueue: Array.isArray(payload?.app_local_seo_refresh_queue) ? payload.app_local_seo_refresh_queue : state.appLocalSeoRefreshQueue,
          appCssMobileRegressionQueue: Array.isArray(payload?.app_css_mobile_regression_queue) ? payload.app_css_mobile_regression_queue : state.appCssMobileRegressionQueue,
          appRuntimeObservabilityReleaseQueue: Array.isArray(payload?.app_runtime_observability_release_queue) ? payload.app_runtime_observability_release_queue : state.appRuntimeObservabilityReleaseQueue
,          appAccountingCutoverTrialBalanceQueue: Array.isArray(payload?.app_accounting_cutover_trial_balance_queue) ? payload.app_accounting_cutover_trial_balance_queue : state.appAccountingCutoverTrialBalanceQueue,
          appEquipmentScanAssetRolloutQueue: Array.isArray(payload?.app_equipment_scan_asset_rollout_queue) ? payload.app_equipment_scan_asset_rollout_queue : state.appEquipmentScanAssetRolloutQueue,
          appLocalSeoProminencePublicationQueue: Array.isArray(payload?.app_local_seo_prominence_publication_queue) ? payload.app_local_seo_prominence_publication_queue : state.appLocalSeoProminencePublicationQueue,
          appCssMobileReleaseGuardQueue: Array.isArray(payload?.app_css_mobile_release_guard_queue) ? payload.app_css_mobile_release_guard_queue : state.appCssMobileReleaseGuardQueue,
          appRuntimeSupportPlaybookQueue: Array.isArray(payload?.app_runtime_support_playbook_queue) ? payload.app_runtime_support_playbook_queue : state.appRuntimeSupportPlaybookQueue,
          appDataSourceMigrationLockQueue: Array.isArray(payload?.app_data_source_migration_lock_queue) ? payload.app_data_source_migration_lock_queue : state.appDataSourceMigrationLockQueue,
          appReleaseExitCriteriaQueue: Array.isArray(payload?.app_release_exit_criteria_queue) ? payload.app_release_exit_criteria_queue : state.appReleaseExitCriteriaQueue,
          appPaymentCloseoutActionQueue: Array.isArray(payload?.app_payment_closeout_action_queue) ? payload.app_payment_closeout_action_queue : state.appPaymentCloseoutActionQueue,
          appReconciliationExceptionWorkflowQueue: Array.isArray(payload?.app_reconciliation_exception_workflow_queue) ? payload.app_reconciliation_exception_workflow_queue : state.appReconciliationExceptionWorkflowQueue,
          appEquipmentChainOfCustodyQueue: Array.isArray(payload?.app_equipment_chain_of_custody_queue) ? payload.app_equipment_chain_of_custody_queue : state.appEquipmentChainOfCustodyQueue,
          appLocalSeoConversionQueue: Array.isArray(payload?.app_local_seo_conversion_queue) ? payload.app_local_seo_conversion_queue : state.appLocalSeoConversionQueue,
          appRuntimeFallbackEscalationQueue: Array.isArray(payload?.app_runtime_fallback_escalation_queue) ? payload.app_runtime_fallback_escalation_queue : state.appRuntimeFallbackEscalationQueue,
          appReleaseHandoffQueue: Array.isArray(payload?.app_release_handoff_queue) ? payload.app_release_handoff_queue : state.appReleaseHandoffQueue,
          appPaymentPostingProofQueue: Array.isArray(payload?.app_payment_posting_proof_queue) ? payload.app_payment_posting_proof_queue : state.appPaymentPostingProofQueue,
          appEquipmentCustodyEvidenceQueue: Array.isArray(payload?.app_equipment_custody_evidence_queue) ? payload.app_equipment_custody_evidence_queue : state.appEquipmentCustodyEvidenceQueue,
          appSeoConversionEvidenceQueue: Array.isArray(payload?.app_seo_conversion_evidence_queue) ? payload.app_seo_conversion_evidence_queue : state.appSeoConversionEvidenceQueue,
          appRuntimeFallbackEventLogQueue: Array.isArray(payload?.app_runtime_fallback_event_log_queue) ? payload.app_runtime_fallback_event_log_queue : state.appRuntimeFallbackEventLogQueue,
          appSchemaDeployRepairQueue: Array.isArray(payload?.app_schema_deploy_repair_queue) ? payload.app_schema_deploy_repair_queue : state.appSchemaDeployRepairQueue,
          appPaymentReconciliationProofCloseoutQueue: Array.isArray(payload?.app_payment_reconciliation_proof_closeout_queue) ? payload.app_payment_reconciliation_proof_closeout_queue : state.appPaymentReconciliationProofCloseoutQueue,
          appEquipmentReturnExceptionActionQueue: Array.isArray(payload?.app_equipment_return_exception_action_queue) ? payload.app_equipment_return_exception_action_queue : state.appEquipmentReturnExceptionActionQueue,
          appLocalSearchProminenceEvidenceQueue: Array.isArray(payload?.app_local_search_prominence_evidence_queue) ? payload.app_local_search_prominence_evidence_queue : state.appLocalSearchProminenceEvidenceQueue,
          appRuntimeFallbackObservabilityQueue: Array.isArray(payload?.app_runtime_fallback_observability_queue) ? payload.app_runtime_fallback_observability_queue : state.appRuntimeFallbackObservabilityQueue,
          appJsonDbSourceMigrationQueue: Array.isArray(payload?.app_json_db_source_migration_queue) ? payload.app_json_db_source_migration_queue : state.appJsonDbSourceMigrationQueue,

        };
        const e = els();
        if (e.staffPosition) {
          const current = e.staffPosition.value || '';
          e.staffPosition.innerHTML = optionList(state.selectors.positions, 'name', (row) => row.name || row.position_name || '', 'Select position');
          setSelectValue(e.staffPosition, current);
        }
        if (e.staffTrade) {
          const current = e.staffTrade.value || '';
          e.staffTrade.innerHTML = optionList(state.selectors.trades, 'name', (row) => row.name || row.trade_name || '', 'Select trade');
          setSelectValue(e.staffTrade, current);
        }
        if (e.staffTier) {
          const current = e.staffTier.value || '';
          e.staffTier.innerHTML = optionList(state.selectors.staffTiers, 'name', (row) => row.name || '', 'Select staff tier');
          setSelectValue(e.staffTier, current);
        }
        if (e.staffSeniority) {
          const current = e.staffSeniority.value || '';
          e.staffSeniority.innerHTML = optionList(state.selectors.seniorityLevels, 'name', (row) => row.name || '', 'Select seniority');
          setSelectValue(e.staffSeniority, current);
        }
        if (e.staffStatus) {
          const current = e.staffStatus.value || '';
          e.staffStatus.innerHTML = optionList(state.selectors.employmentStatuses, 'name', (row) => row.name || '', 'Select status');
          setSelectValue(e.staffStatus, current || 'active');
        }
        renderAssignmentWorkbench();
        renderCatalogManager();
        renderBackboneTable();
        fillBackboneForm(getSelectedBackboneRecord());
        return true;
      } catch (err) {
        setSummary(String(err?.message || 'Failed to load admin selectors.'), true);
        return false;
      }
    }






    function renderSavedFilters() {
      const e = els();
      if (!e.savedFilterCards && !e.savedFilterBody) return;
      const rows = Array.isArray(state.adminSavedFilterDirectory) ? state.adminSavedFilterDirectory : [];
      const summaries = Array.isArray(state.adminSavedFilterScopeSummary) ? state.adminSavedFilterScopeSummary : [];
      if (e.savedFilterCards) {
        e.savedFilterCards.innerHTML = summaries.slice(0, 6).map((row) => `<button class="admin-task-card" type="button" data-admin-section="${escHtml(row.filter_scope || 'home')}"><span>${escHtml(row.filter_scope || 'Scope')}</span><strong>${escHtml(String(row.filter_count || 0))}</strong><small>${escHtml(String(row.shared_filter_count || 0))} shared · last used ${escHtml(row.last_used_at || 'never')}</small></button>`).join('') || '<div class="muted">No saved views yet. Save one from the toolbar above.</div>';
      }
      if (e.savedFilterBody) {
        e.savedFilterBody.innerHTML = rows.slice(0, 40).map((row) => `
          <tr>
            <td>${escHtml(row.filter_scope || '')}</td>
            <td><strong>${escHtml(row.filter_name || '')}</strong><div class="muted">${escHtml(row.section_hint || row.route_hint || '')}</div></td>
            <td>${escHtml(row.owner_name || 'Me')}</td>
            <td>${row.is_shared ? 'Yes' : 'No'}</td>
            <td>${escHtml(String(row.usage_count || 0))}</td>
            <td><button class="secondary" type="button" data-saved-filter-use="${escHtml(row.id || '')}" data-saved-filter-section="${escHtml(row.section_hint || row.filter_scope || 'home')}">Use</button> <button class="secondary" type="button" data-saved-filter-delete="${escHtml(row.id || '')}">Delete</button></td>
          </tr>
        `).join('') || '<tr><td colspan="6" class="muted">No saved filters loaded yet.</td></tr>';
      }
    }

    async function saveCurrentAdminFilter() {
      const e = els();
      if (!manageAdminEntity) throw new Error('Admin manage API is not available.');
      const name = String(e.savedFilterName?.value || '').trim();
      if (!name) throw new Error('Add a saved view name first.');
      const scope = String(e.savedFilterScope?.value || state.adminSection || 'home').trim() || 'home';
      await manageAdminEntity({
        entity: 'admin_saved_filter',
        action: 'create',
        filter_scope: scope,
        filter_name: name,
        is_shared: !!e.savedFilterShared?.checked,
        section_hint: state.adminSection || scope,
        route_hint: 'admin',
        filter_payload: {
          section: state.adminSection || scope,
          queue_search: e.search?.value || '',
          queue_status: e.filterStatus?.value || '',
          backbone_entity: e.backboneEntity?.value || '',
          catalog_type: e.catalogType?.value || '',
          people_search: state.directoryPagination.people?.search || e.staffSearch?.value || '',
          people_role_filter: state.directoryPagination.people?.roleFilter || e.staffRoleFilter?.value || '',
          people_sort: state.directoryPagination.people?.sort || e.staffSort?.value || 'full_name',
          people_sort_dir: state.directoryPagination.people?.direction || e.staffSortDir?.value || 'asc',
          people_page_size: state.directoryPagination.people?.pageSize || e.staffPageSize?.value || 25,
          jobs_search: state.directoryPagination.jobs?.search || e.jobsSearch?.value || '',
          jobs_sort: state.directoryPagination.jobs?.sort || e.jobsSort?.value || 'job_code',
          jobs_sort_dir: state.directoryPagination.jobs?.direction || e.jobsSortDir?.value || 'asc',
          jobs_page_size: state.directoryPagination.jobs?.pageSize || e.jobsPageSize?.value || 25
        }
      });
      if (e.savedFilterName) e.savedFilterName.value = '';
      setSummary('Saved admin view.', false);
      await loadDirectory();
    }

    async function handleSavedFilterClick(event) {
      const useBtn = event.target.closest('[data-saved-filter-use]');
      const delBtn = event.target.closest('[data-saved-filter-delete]');
      const scopeBtn = event.target.closest('#ad_saved_filter_cards [data-admin-section]');
      if (scopeBtn) {
        applyAdminSectionFilter(scopeBtn.getAttribute('data-admin-section') || 'home');
        return;
      }
      if (!useBtn && !delBtn) return;
      if (!manageAdminEntity) throw new Error('Admin manage API is not available.');
      const itemId = (useBtn || delBtn).getAttribute(useBtn ? 'data-saved-filter-use' : 'data-saved-filter-delete') || '';
      if (!itemId) return;
      if (useBtn) {
        const saved = state.adminSavedFilterDirectory.find((row) => String(row.id || '') === String(itemId)) || null;
        const payload = (saved && typeof saved.filter_payload === 'object') ? saved.filter_payload : {};
        await manageAdminEntity({ entity: 'admin_saved_filter', action: 'touch', item_id: itemId });
        applyAdminSectionFilter(payload.section || useBtn.getAttribute('data-saved-filter-section') || 'home');
        if (payload.queue_search && els().search) els().search.value = payload.queue_search;
        if (payload.queue_status && els().filterStatus) els().filterStatus.value = payload.queue_status;
        if (payload.backbone_entity && els().backboneEntity) els().backboneEntity.value = payload.backbone_entity;
        if (payload.catalog_type && els().catalogType) els().catalogType.value = payload.catalog_type;
        state.directoryPagination.people = {
          ...state.directoryPagination.people,
          page: 1,
          search: String(payload.people_search || ''),
          roleFilter: String(payload.people_role_filter || ''),
          sort: String(payload.people_sort || state.directoryPagination.people.sort || 'full_name'),
          direction: String(payload.people_sort_dir || state.directoryPagination.people.direction || 'asc'),
          pageSize: Number(payload.people_page_size || state.directoryPagination.people.pageSize || 25)
        };
        state.directoryPagination.jobs = {
          ...state.directoryPagination.jobs,
          page: 1,
          search: String(payload.jobs_search || ''),
          sort: String(payload.jobs_sort || state.directoryPagination.jobs.sort || 'job_code'),
          direction: String(payload.jobs_sort_dir || state.directoryPagination.jobs.direction || 'asc'),
          pageSize: Number(payload.jobs_page_size || state.directoryPagination.jobs.pageSize || 25)
        };
        setSummary('Loaded saved admin view with section, Staff Directory filters, and Jobs paging filters.', false);
        await loadDirectory();
      }
      if (delBtn) {
        await manageAdminEntity({ entity: 'admin_saved_filter', action: 'delete', item_id: itemId });
        setSummary('Deleted saved admin view.', false);
        await loadDirectory();
      }
    }

    async function handleAdminHealthAction(event) {
      const btn = event.target.closest('[data-health-resolve]');
      if (!btn || !manageAdminEntity) return;
      const sourceId = btn.getAttribute('data-health-resolve') || '';
      const sourceArea = btn.getAttribute('data-health-source') || 'health';
      if (!confirmAdminAction('Mark this health item resolved?', 'Use this only after the issue has been checked or a follow-up note has been added.')) return;
      await manageAdminEntity({ entity: 'admin_health_resolution_note', action: 'resolve', source_area: sourceArea, source_id: sourceId, resolution_status: 'resolved', resolution_notes: 'Resolved from Admin Health panel.' });
      setSummary('Health item marked resolved in the resolution log.', false);
      await loadDirectory();
    }

    async function handleReadinessAction(event) {
      const btn = event.target.closest('[data-gate-key]');
      if (!btn || !manageAdminEntity) return;
      if (!confirmAdminAction('Update this deployment gate?', 'This changes the readiness status shown to future Admin users.')) return;
      await manageAdminEntity({ entity: 'admin_deployment_gate_check', action: 'update', item_id: btn.getAttribute('data-gate-key'), check_status: btn.getAttribute('data-gate-status') || 'passed' });
      setSummary('Deployment gate updated.', false);
      await loadDirectory();
    }

    async function handleEvidenceManagerAction(event) {
      const btn = event.target.closest('[data-evidence-action]');
      if (!btn || !manageAdminEntity) return;
      const source = btn.getAttribute('data-evidence-source') || '';
      const sourceId = btn.getAttribute('data-evidence-id') || '';
      if (!sourceId) return;
      if (!confirmAdminAction('Create an evidence follow-up?', 'This adds the item to the evidence action queue for review.')) return;
      await manageAdminEntity({ entity: 'admin_health_resolution_note', action: 'create', source_area: `evidence:${source}`, source_id: sourceId, resolution_status: 'assigned', resolution_notes: 'Evidence follow-up opened from Evidence Manager.' });
      await manageAdminEntity({ entity: 'admin_evidence_action', action: 'create', source_area: source || 'evidence', source_id: sourceId, action_type: 'follow_up', evidence_title: 'Evidence follow-up from manager', action_status: 'queued' });
      setSummary('Evidence follow-up added to the health and evidence action queues.', false);
      await loadDirectory();
    }

    async function handleGuidedCloseAction(event) {
      const btn = event.target.closest('[data-close-step-action]');
      if (!btn || !manageAdminEntity) return;
      const stepKey = btn.getAttribute('data-close-step-key') || '';
      const action = btn.getAttribute('data-close-step-action') || '';
      if (!stepKey || !action) return;
      if (!confirmAdminAction(`${action === 'complete' ? 'Complete' : 'Reopen'} this close step?`, 'Close steps affect the accounting close checklist and review flow.')) return;
      await manageAdminEntity({ entity: 'admin_close_workflow_step', action, item_id: stepKey, completion_notes: `${action} from Guided Close Center.` });
      setSummary(`Close step ${action === 'complete' ? 'completed' : 'reopened'}.`, false);
      await loadDirectory();
    }

    function getLocalDiagnosticRows() {
      const diagnostics = window.YWIAppDiagnostics?.getItems?.() || [];
      return (Array.isArray(diagnostics) ? diagnostics : []).map((item) => ({
        source: item.scope || 'frontend',
        severity: 'warning',
        title: 'Local diagnostic',
        message: item.message || 'Client-side issue captured.',
        last_seen_at: item.at || new Date().toISOString(),
        route_hint: 'health'
      }));
    }

    function firstNumber(...values) {
      for (const value of values) {
        const n = Number(value);
        if (Number.isFinite(n)) return n;
      }
      return 0;
    }

    function severityRank(severity = '') {
      const clean = String(severity || '').toLowerCase();
      if (clean === 'error' || clean === 'critical') return 1;
      if (clean === 'warning') return 2;
      if (clean === 'ok') return 9;
      return 5;
    }

    function renderStatusPill(label, severity = 'info') {
      const clean = String(severity || 'info').toLowerCase();
      return `<span class="admin-status-pill" data-severity="${escHtml(clean)}">${escHtml(label || clean)}</span>`;
    }

    function renderAdminCommandCenter() {
      const e = els();
      if (!e.commandCenter) return;
      const db = Array.isArray(state.adminHomeCommandCenter) ? (state.adminHomeCommandCenter[0] || {}) : {};
      const outboxSummary = window.YWIOutbox?.getActionSummary?.('admin') || { total: 0, conflicts: 0 };
      const latestSchema = (Array.isArray(state.appSchemaVersionStatus) ? state.appSchemaVersionStatus : [])[0] || {};
      const closeRows = Array.isArray(state.accountingCloseAdminControlDashboard) ? state.accountingCloseAdminControlDashboard : [];
      const openClose = closeRows.filter((row) => String(row.close_status || '').toLowerCase() !== 'closed').length;
      const openJobs = (Array.isArray(state.jobs) ? state.jobs : []).filter((row) => !['complete','completed','closed','cancelled','canceled'].includes(String(row.job_status || row.status || '').toLowerCase())).length;
      const hseActions = Array.isArray(state.hsePacketActionItems) ? state.hsePacketActionItems.length : 0;
      const failedUploads = firstNumber(db.failed_upload_count, (Array.isArray(state.fieldUploadFailures) ? state.fieldUploadFailures.length : 0));
      const reconciliationReviews = firstNumber(db.reconciliation_review_count, (Array.isArray(state.accountingReconciliationManualReviewQueue) ? state.accountingReconciliationManualReviewQueue.length : 0));
      const packageQueue = firstNumber(db.package_delivery_attention_count, (Array.isArray(state.accountingClosePackageDeliveryQueue) ? state.accountingClosePackageDeliveryQueue.filter((row) => row.needs_delivery_attention !== false).length : 0));
      const healthRows = [...(Array.isArray(state.adminErrorHealthCenter) ? state.adminErrorHealthCenter : []), ...getLocalDiagnosticRows()];
      const healthIssues = healthRows.filter((row) => severityRank(row.severity) <= 2).length;
      const cards = [
        { label: 'Open Jobs', value: firstNumber(db.open_job_count, openJobs), help: 'Jobs not yet closed or cancelled.', route: 'jobs', section: 'operations' },
        { label: 'HSE / Safety Reviews', value: firstNumber(db.hse_review_count, hseActions), help: 'Open packets, corrective actions, or safety follow-up.', route: 'hseops', section: 'safety' },
        { label: 'Accounting Close', value: firstNumber(db.open_accounting_period_count, openClose), help: 'Periods, tax, payroll, or bank reconciliation still open.', entity: 'accounting_period_close', section: 'accounting' },
        { label: 'Payment Applications', value: firstNumber(db.payment_application_attention_count, (state.arPaymentApplications?.length || 0) + (state.apPaymentApplications?.length || 0)), help: 'AR/AP payment applications ready for review.', entity: 'ar_payment_application', section: 'accounting' },
        { label: 'Bank Reconciliation', value: reconciliationReviews, help: 'Unmatched, partial, or exception bank items.', entity: 'bank_reconciliation_item', section: 'accounting' },
        { label: 'Accountant Packages', value: packageQueue, help: 'Export bundles needing finalize, delivery, or confirmation.', entity: 'accountant_handoff_export', section: 'accounting' },
        { label: 'Failed Uploads', value: failedUploads, help: 'Evidence/media upload problems needing retry or review.', entity: 'field_upload_failure', section: 'safety' },
        { label: 'App Health', value: healthIssues, help: `Schema ${latestSchema.schema_version || db.latest_schema_version || 'not logged'} · ${outboxSummary.total || 0} queued admin sync item(s).`, route: 'admin', section: 'health' }
      ];
      e.commandCenter.innerHTML = cards.map((card) => `
        <button class="admin-command-card" type="button" ${card.route ? `data-admin-command-route="${escHtml(card.route)}"` : ''} ${card.entity ? `data-admin-command-entity="${escHtml(card.entity)}"` : ''} ${card.section ? `data-admin-command-section="${escHtml(card.section)}"` : ''}>
          <span>${escHtml(card.label)}</span>
          <strong>${escHtml(String(card.value ?? 0))}</strong>
          <small>${escHtml(card.help || '')}</small>
        </button>
      `).join('');
    }

    function renderAdminHealthCenter() {
      const e = els();
      if (!e.healthBody && !e.schemaBody && !e.healthCards) return;
      const localRows = getLocalDiagnosticRows();
      const dbRows = Array.isArray(state.adminErrorHealthCenter) ? state.adminErrorHealthCenter : [];
      const rows = [...dbRows, ...localRows].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
      const errorCount = rows.filter((row) => severityRank(row.severity) === 1).length;
      const warningCount = rows.filter((row) => severityRank(row.severity) === 2).length;
      const latestSchema = (Array.isArray(state.appSchemaVersionStatus) ? state.appSchemaVersionStatus : [])[0] || {};
      const drift = (Array.isArray(state.schemaDriftStatus) ? state.schemaDriftStatus : [])[0] || {};
      const lastHealth = rows[0]?.last_seen_at || rows[0]?.checked_at || '';
      if (e.healthSummary) {
        e.healthSummary.dataset.kind = errorCount ? 'error' : (warningCount ? 'warning' : 'info');
        e.healthSummary.textContent = rows.length
          ? `${rows.length} health item(s): ${errorCount} error(s), ${warningCount} warning(s). Latest schema marker: ${latestSchema.schema_version || 'not logged'}.`
          : `No active health alerts loaded. Latest schema marker: ${latestSchema.schema_version || 'not logged'}.`;
      }
      renderAdminScopeStatus();
      renderAdminPanelAgeBadges();
      renderAdminScopeDiagnostics();
      const failedScopes = Object.values(state.adminScopeTimings || {}).filter((row) => row && row.ok === false).length;
      if (e.healthCards) {
        e.healthCards.innerHTML = [
          ['Errors', errorCount, 'Critical items that need action.'],
          ['Warnings', warningCount, 'Timeouts, failed delivery, or review warnings.'],
          ['Local Diagnostics', localRows.length, 'Client-side issues captured in this browser.'],
          ['Panel Load Issues', failedScopes, 'Failed staged Admin scopes can be retried individually.'],
          ['Latest Schema', latestSchema.schema_version || '—', latestSchema.migration_key || latestSchema.notes || 'No schema version table row found yet.'],
          ['Schema Drift', drift.drift_status || 'unknown', drift.message || 'Apply migrations through the latest repo schema marker.']
        ].map(([label, value, help]) => `<div class="admin-health-card"><span>${escHtml(label)}</span><strong>${escHtml(String(value))}</strong><small>${escHtml(help)}</small></div>`).join('');
      }
      if (e.healthBody) {
        e.healthBody.innerHTML = rows.slice(0, 80).map((row) => `
          <tr>
            <td>${renderStatusPill(row.severity || 'info', row.severity || 'info')}</td>
            <td>${escHtml(row.source || row.monitor_scope || '')}</td>
            <td><strong>${escHtml(row.title || '')}</strong></td>
            <td class="admin-table-note">${escHtml(row.message || row.note || '')}</td>
            <td>${escHtml(row.last_seen_at || row.checked_at || lastHealth || '')}</td>
            <td>${row.source_id || row.id ? `<button class="secondary" type="button" data-health-resolve="${escHtml(row.source_id || row.id)}" data-health-source="${escHtml(row.source || row.monitor_scope || 'health')}">Resolve</button>` : '<span class="muted">Local only</span>'}</td>
          </tr>
        `).join('') || '<tr><td colspan="6" class="muted">No health alerts loaded.</td></tr>';
      }
      if (e.schemaBody) {
        const schemaRows = Array.isArray(state.appSchemaVersionStatus) ? state.appSchemaVersionStatus : [];
        e.schemaBody.innerHTML = schemaRows.slice(0, 30).map((row) => `
          <tr>
            <td>${escHtml(row.schema_version || '')}</td>
            <td>${escHtml(row.migration_key || row.schema_name || '')}</td>
            <td>${renderStatusPill(row.status || 'unknown', String(row.status || '').toLowerCase() === 'applied' ? 'ok' : 'warning')}</td>
            <td>${escHtml(row.applied_at || '')}</td>
            <td class="admin-table-note">${escHtml(row.notes || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">Schema tracking table has not been seeded yet. Apply schema 106.</td></tr>';
      }
    }

    function renderAdminTaskInbox() {
      const e = els();
      if (!e.taskCards && !e.taskBody) return;
      const rows = Array.isArray(state.adminTaskInbox) ? state.adminTaskInbox : [];
      const high = rows.filter((row) => Number(row.priority_rank || 99) <= 20).length;
      const accounting = rows.filter((row) => String(row.source_area || '').toLowerCase().includes('accounting')).length;
      const safety = rows.filter((row) => /hse|safety|training|corrective/i.test(String(row.source_area || row.task_source || ''))).length;
      if (e.taskCards) {
        e.taskCards.innerHTML = [
          ['High Priority', high, 'Needs the first look.'],
          ['Accounting', accounting, 'Close, filing, remittance, and reconciliation.'],
          ['Safety / HSE', safety, 'Corrective action, training, and packet follow-up.'],
          ['Total Tasks', rows.length, 'Loaded from DB task views and active workflow tables.']
        ].map(([label, value, help]) => `<div class="admin-task-card"><span>${escHtml(label)}</span><strong>${escHtml(String(value))}</strong><small>${escHtml(help)}</small></div>`).join('');
      }
      if (e.taskBody) {
        e.taskBody.innerHTML = rows.slice(0, 80).map((row) => `
          <tr>
            <td>${escHtml(row.priority_label || row.priority_rank || '')}</td>
            <td><strong>${escHtml(row.task_title || row.title || '')}</strong><div class="muted">${escHtml(row.task_summary || row.message || '')}</div></td>
            <td>${escHtml(row.source_area || row.task_source || '')}</td>
            <td>${escHtml(row.due_at || row.last_seen_at || row.created_at || '')}</td>
            <td>${escHtml(row.route_hint || row.entity_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No admin tasks are currently loaded.</td></tr>';
      }
    }


    function renderGuidedCloseCenter() {
      const e = els();
      if (!e.closeCenterCards && !e.closeCenterSummary) return;
      const row = (Array.isArray(state.adminCloseCenterOverview) ? state.adminCloseCenterOverview : [])[0] || {};
      const cards = [
        ['Open Periods', row.open_accounting_period_count || 0, 'Close/reopen period work still active.'],
        ['Payment Review', row.payment_application_attention_count || 0, 'AR/AP payment applications needing review.'],
        ['Bank Review', row.reconciliation_review_count || 0, 'Unmatched, partial, or exception bank items.'],
        ['Tax / Payroll', (Number(row.open_tax_filing_count || 0) + Number(row.open_payroll_remittance_count || 0)), 'Filing and remittance prep still open.'],
        ['Journal Candidates', row.journal_candidate_count || 0, 'Posting candidates or generated lines needing validation.'],
        ['Packages', row.package_delivery_attention_count || 0, 'Accountant exports needing delivery confirmation.']
      ];
      const steps = Array.isArray(state.adminCloseWizardSteps) ? state.adminCloseWizardSteps : [];
      if (e.closeCenterCards) {
        const baseCards = cards.map(([label, value, help]) => `<div class="admin-command-card"><span>${escHtml(label)}</span><strong>${escHtml(String(value))}</strong><small>${escHtml(help)}</small></div>`).join('');
        const stepCards = steps.slice(0, 8).map((step, idx) => `<button class="admin-command-card" type="button" data-admin-command-section="accounting" data-admin-command-entity="${escHtml(step.source_entity || '')}"><span>Step ${idx + 1}: ${escHtml(step.step_group || '')}</span><strong>${escHtml(step.step_title || '')}</strong><small>${escHtml(step.step_detail || '')}</small></button>`).join('');
        e.closeCenterCards.innerHTML = baseCards + stepCards;
      }
      if (e.closeCenterSummary) {
        const blockerCount = cards.reduce((sum, [, value]) => sum + Number(value || 0), 0);
        e.closeCenterSummary.textContent = blockerCount ? `${blockerCount} close blocker(s) or review item(s) are visible. Step owners, due dates, blocker counts, and close/reopen actions are now tracked by schema 109.` : 'No close blockers loaded from the current dashboard view.';
      }
      if (e.closeWizardDetailBody) {
        e.closeWizardDetailBody.innerHTML = steps.slice(0, 80).map((step) => {
          const stepStatus = String(step.step_status || 'review').toLowerCase();
          const isDone = ['done','complete','completed','closed'].includes(stepStatus);
          const blockerValue = firstNumber(step.active_blocker_count, step.blocker_count_override, row?.[step.blocker_count_column] || 0);
          return `
          <tr>
            <td><strong>${escHtml(step.step_title || step.step_key || '')}</strong><div class="muted">${escHtml(step.step_group || '')}</div></td>
            <td>${renderStatusPill(step.step_status || 'review', isDone ? 'ok' : (blockerValue ? 'warning' : 'info'))}</td>
            <td>${escHtml(step.owner_name || 'Unassigned')}<div class="muted">${escHtml(step.due_at || 'No due date')}</div></td>
            <td>${escHtml(String(blockerValue))}<div class="muted">${escHtml(step.blocker_count_column || '')}</div></td>
            <td><div class="admin-row-actions"><button class="secondary" type="button" data-close-step-action="complete" data-close-step-key="${escHtml(step.step_key || '')}">Complete</button><button class="secondary" type="button" data-close-step-action="reopen" data-close-step-key="${escHtml(step.step_key || '')}">Reopen</button></div></td>
          </tr>`;
        }).join('') || '<tr><td colspan="5" class="muted">No guided close steps loaded yet. Apply schema 109.</td></tr>';
      }
    }

    function renderEvidenceManager() {
      const e = els();
      if (!e.evidenceManagerCards && !e.evidenceManagerBody) return;
      const rows = Array.isArray(state.evidenceManagerDirectory) ? state.evidenceManagerDirectory : [];
      const failed = rows.filter((row) => /fail|error|retry/i.test(String(row.evidence_status || row.status || ''))).length;
      const review = rows.filter((row) => row.needs_review || /review|pending/i.test(String(row.evidence_status || row.status || ''))).length;
      const signatures = rows.filter((row) => /signature|signoff/i.test(String(row.evidence_type || row.source_area || ''))).length;
      if (e.evidenceManagerCards) {
        e.evidenceManagerCards.innerHTML = [
          ['Needs Review', review, 'Photos, receipts, signatures, or proof waiting for review.'],
          ['Failed / Retry', failed, 'Uploads that need retry, replacement, or admin resolution.'],
          ['Signatures', signatures, 'Signoff evidence present in the unified queue.'],
          ['Total Evidence', rows.length, 'Loaded from DB evidence manager view.']
        ].map(([label, value, help]) => `<div class="admin-task-card"><span>${escHtml(label)}</span><strong>${escHtml(String(value))}</strong><small>${escHtml(help)}</small></div>`).join('');
      }
      if (e.evidenceManagerBody) {
        e.evidenceManagerBody.innerHTML = rows.slice(0, 80).map((row) => `
          <tr>
            <td>${renderStatusPill(row.evidence_status || row.status || 'review', row.needs_review ? 'warning' : 'info')}</td>
            <td><strong>${escHtml(row.evidence_title || row.title || row.file_name || 'Evidence item')}</strong><div class="muted">${escHtml(row.evidence_type || '')}</div></td>
            <td>${escHtml(row.source_area || row.source_table || '')}</td>
            <td>${escHtml(row.owner_name || row.profile_name || row.created_by_name || '')}</td>
            <td>${escHtml(row.last_seen_at || row.created_at || row.uploaded_at || '')}</td>
            <td><div class="admin-row-actions"><span>${escHtml(row.action_hint || row.route_hint || 'Open source record')}</span>${row.source_id ? `<button class="secondary" type="button" data-evidence-action="follow_up" data-evidence-source="${escHtml(row.source_area || '')}" data-evidence-id="${escHtml(row.source_id || '')}">Follow up</button>` : ''}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="6" class="muted">No evidence manager rows loaded yet.</td></tr>';
      }
      if (e.evidenceActionQueueBody) {
        const actionRows = Array.isArray(state.adminEvidenceActionQueue) ? state.adminEvidenceActionQueue : [];
        e.evidenceActionQueueBody.innerHTML = actionRows.slice(0, 80).map((row) => `
          <tr>
            <td>${renderStatusPill(row.action_status || 'queued', /complete|done/i.test(String(row.action_status || '')) ? 'ok' : 'warning')}</td>
            <td>${escHtml(row.action_type || '')}</td>
            <td><strong>${escHtml(row.evidence_title || row.source_area || '')}</strong><div class="muted">${escHtml(row.source_id || '')}</div></td>
            <td>${escHtml(row.assigned_to_name || row.created_by_name || '')}</td>
            <td>${escHtml(row.updated_at || row.created_at || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No retry/replace/archive evidence actions have been queued yet.</td></tr>';
      }
    }

    function renderProductionReadiness() {
      const e = els();
      if (!e.readinessCards && !e.readinessBody && !e.permissionsBody) return;
      const checks = Array.isArray(state.productionReadinessChecklist) ? state.productionReadinessChecklist : [];
      const perms = Array.isArray(state.rolePermissionMatrix) ? state.rolePermissionMatrix : [];
      const preflight = Array.isArray(state.adminSchemaPreflightChecks) ? state.adminSchemaPreflightChecks : [];
      const actionPerms = Array.isArray(state.adminActionPermissionRegistry) ? state.adminActionPermissionRegistry : [];
      const retryPolicies = Array.isArray(state.adminPanelRetryPolicy) ? state.adminPanelRetryPolicy : [];
      const mobileGates = Array.isArray(state.mobileFirstQualityGates) ? state.mobileFirstQualityGates : [];
      const wordingGates = Array.isArray(state.jurisdictionWordingGates) ? state.jurisdictionWordingGates : [];
      const drift = (Array.isArray(state.schemaDriftStatus) ? state.schemaDriftStatus : [])[0] || {};
      const blocked = checks.filter((row) => /blocked|fail|missing/i.test(String(row.check_status || ''))).length;
      const warnings = checks.filter((row) => /warn|review/i.test(String(row.check_status || ''))).length;
      const missingPreflight = preflight.filter((row) => /missing|fail|blocked/i.test(String(row.check_status || row.live_status || ''))).length;
      if (e.readinessCards) {
        e.readinessCards.innerHTML = [
          ['Schema Drift', drift.drift_status || 'unknown', drift.message || 'Live database should match repo schema marker.'],
          ['Schema Preflight', missingPreflight ? `${missingPreflight} missing` : `${preflight.length} checks`, 'Names missing tables/views before risky Admin actions are used.'],
          ['Blocked Checks', blocked, 'Must be fixed before production sign-off.'],
          ['Action Rules', actionPerms.length, 'DB-backed action button role guardrails.'],
          ['Retry Policies', retryPolicies.length, 'Panel retry/backoff rules for safer Edge Function calls.'],
          ['Permission Rows', perms.length, 'Visible role/workflow permission matrix.'],
          ['Mobile Gates', mobileGates.length, 'Phone-first workflow checks for field usage.'],
          ['Today Actions', (state.mobileTodayActionRegistry || []).length, 'Role-aware mobile Today dashboard action registry.'],
          ['PWA Gates', (state.mobilePwaInstallQualityGates || []).length, 'Install helper and offline badge checks for phone users.'],
          ['Mobile Forms', (state.mobileFormStepperRegistry || []).length, 'Phone steppers, draft resume chips, and form quality gates.'],
          ['Ontario Wording', wordingGates.length, 'Jurisdiction wording guardrails for Ontario OHSA copy.'],
          ['Build Guardrails', (state.appDeploymentBundleChecks || []).length, 'Bundle parse, cache, and deploy-readiness checks.'],
          ['Roadmap Rows', (state.appRoadmapActionSteps || []).length, 'Completed 20 plus next 20 planned steps.'],
          ['Depth Reviews', (state.appDepthReviewQueue || []).length, 'Accounting, equipment, SEO, mobile, CSS, and fallback depth gaps.']
        ].map(([label, value, help]) => `<div class="admin-health-card"><span>${escHtml(label)}</span><strong>${escHtml(String(value))}</strong><small>${escHtml(help)}</small></div>`).join('');
      }
      if (e.schemaPreflightBody) {
        e.schemaPreflightBody.innerHTML = preflight.slice(0, 120).map((row) => `
          <tr>
            <td>${escHtml(row.check_area || '')}</td>
            <td><strong>${escHtml(row.required_object_name || '')}</strong><div class="muted">${escHtml(row.required_object_type || '')}</div></td>
            <td>${renderStatusPill(row.check_status || row.live_status || 'review', /present|pass|ok|ready/i.test(String(row.check_status || row.live_status || '')) ? 'ok' : (/missing|fail|blocked/i.test(String(row.check_status || row.live_status || '')) ? 'error' : 'warning'))}</td>
            <td class="admin-table-note">${escHtml(row.operator_hint || '')}</td>
            <td class="admin-table-note">${escHtml(row.failure_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No schema preflight rows loaded yet. Apply schema 119.</td></tr>';
      }
      if (e.readinessBody) {
        e.readinessBody.innerHTML = checks.slice(0, 80).map((row) => `
          <tr>
            <td>${escHtml(row.check_area || '')}</td>
            <td><strong>${escHtml(row.check_title || '')}</strong><div class="muted">${escHtml(row.check_detail || '')}</div></td>
            <td>${renderStatusPill(row.check_status || 'review', /ok|ready|pass/i.test(String(row.check_status || '')) ? 'ok' : 'warning')}</td>
            <td>${escHtml(row.next_action || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="4" class="muted">No production readiness checks loaded yet. Apply schema 107.</td></tr>';
      }
      if (e.permissionsBody) {
        e.permissionsBody.innerHTML = perms.slice(0, 120).map((row) => `
          <tr>
            <td>${escHtml(row.role_key || row.role_label || '')}</td>
            <td>${escHtml(row.workflow_area || '')}</td>
            <td>${row.can_view ? 'Yes' : 'No'}</td>
            <td>${row.can_create ? 'Yes' : 'No'}</td>
            <td>${row.can_approve ? 'Yes' : 'No'}</td>
            <td>${row.can_close_reopen ? 'Yes' : 'No'}</td>
            <td>${row.can_export ? 'Yes' : 'No'}</td>
          </tr>
        `).join('') || '<tr><td colspan="7" class="muted">No permission matrix rows loaded yet. Apply schema 107.</td></tr>';
      }
      if (e.actionPermissionBody) {
        e.actionPermissionBody.innerHTML = actionPerms.slice(0, 120).map((row) => {
          const isEnabled = row.is_enabled !== false && String(row.is_enabled || 'true') !== 'false';
          const allowed = isEnabled && canAdminRoleRun(row.required_role || 'employee');
          return `
            <tr>
              <td><strong>${escHtml(row.action_label || row.action_key || '')}</strong><div class="muted">${escHtml(row.action_key || '')}</div></td>
              <td>${escHtml(row.action_area || '')}</td>
              <td>${escHtml(row.required_role || 'employee')}</td>
              <td>${renderStatusPill(allowed ? 'enabled' : 'disabled', allowed ? 'ok' : 'warning')}</td>
              <td class="admin-table-note">${escHtml(allowed ? (row.enabled_message || 'Allowed for this role.') : (row.disabled_message || 'Not allowed for this role.'))}</td>
            </tr>`;
        }).join('') || '<tr><td colspan="5" class="muted">No action permission rows loaded yet. Apply schema 119.</td></tr>';
      }
      if (e.deploymentGateBody) {
        const gates = Array.isArray(state.adminDeploymentGateStatus) ? state.adminDeploymentGateStatus : [];
        e.deploymentGateBody.innerHTML = gates.slice(0, 80).map((row) => `
          <tr>
            <td>${escHtml(row.check_area || '')}</td>
            <td><strong>${escHtml(row.check_title || '')}</strong><div class="muted">${escHtml(row.failure_hint || '')}</div></td>
            <td>${renderStatusPill(row.check_status || 'review', /pass|ok|ready/i.test(String(row.check_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.command_hint || '')}</td>
            <td><button class="secondary" type="button" data-gate-key="${escHtml(row.check_key || '')}" data-gate-status="passed">Mark Pass</button></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No deployment gates loaded yet. Apply schema 108.</td></tr>';
      }
      if (e.deploymentChecklistBody) {
        const rows = Array.isArray(state.adminDeploymentChecklist) ? state.adminDeploymentChecklist : [];
        e.deploymentChecklistBody.innerHTML = rows.slice(0, 80).map((row) => `
          <tr>
            <td>${escHtml(row.checklist_area || row.check_area || '')}</td>
            <td><strong>${escHtml(row.checklist_title || row.check_title || '')}</strong></td>
            <td>${renderStatusPill(row.check_status || 'review', /pass|ready|complete|ok/i.test(String(row.check_status || '')) ? 'ok' : (/fail|blocked/i.test(String(row.check_status || '')) ? 'error' : 'warning'))}</td>
            <td class="admin-table-note">${escHtml(row.command_hint || '')}</td>
            <td class="admin-table-note">${escHtml(row.failure_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No deployment checklist rows loaded yet. Apply schema 117 or later.</td></tr>';
      }
      if (e.panelRetryPolicyBody) {
        e.panelRetryPolicyBody.innerHTML = retryPolicies.slice(0, 80).map((row) => `
          <tr>
            <td><strong>${escHtml(row.panel_title || row.panel_key || '')}</strong></td>
            <td>${escHtml(row.scope_key || '')}</td>
            <td>${escHtml(String(row.max_attempts ?? ''))} / ${escHtml(String(row.cooldown_seconds ?? ''))}s</td>
            <td>${renderStatusPill(row.retry_status || 'active', /active|ready|ok/i.test(String(row.retry_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.operator_hint || row.failure_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No panel retry policy rows loaded yet. Apply schema 119.</td></tr>';
      }
      if (e.functionReadinessBody) {
        const rows = Array.isArray(state.adminFunctionReadinessChecks) ? state.adminFunctionReadinessChecks : [];
        e.functionReadinessBody.innerHTML = rows.slice(0, 80).map((row) => `
          <tr>
            <td><strong>${escHtml(row.function_name || row.function_key || '')}</strong></td>
            <td>${escHtml(row.expected_scope || row.scope_key || '')}</td>
            <td>${renderStatusPill(row.readiness_status || 'review', /pass|ready|deployed|ok/i.test(String(row.readiness_status || '')) ? 'ok' : (/fail|blocked|missing/i.test(String(row.readiness_status || '')) ? 'error' : 'warning'))}</td>
            <td class="admin-table-note">${escHtml(row.last_checked_at || row.checked_at || '')}</td>
            <td class="admin-table-note">${escHtml(row.operator_signoff_at ? `Signed ${row.operator_signoff_at}` : (row.operator_notes || 'Pending'))}</td>
            <td class="admin-table-note">${escHtml(row.deploy_hint || row.command_hint || '')}</td>
            <td class="admin-table-note">${escHtml(row.failure_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="7" class="muted">No function readiness rows loaded yet. Apply schema 118.</td></tr>';
      }
      if (e.buildGuardrailBody) {
        const rows = Array.isArray(state.appDeploymentBundleChecks) ? state.appDeploymentBundleChecks : [];
        e.buildGuardrailBody.innerHTML = rows.slice(0, 80).map((row) => `
          <tr>
            <td>${escHtml(row.check_area || '')}</td>
            <td><strong>${escHtml(row.check_title || '')}</strong><div class="muted">${escHtml(row.function_name || row.file_path || '')}</div></td>
            <td>${renderStatusPill(row.current_status || 'review', /pass|ready|ok/i.test(String(row.current_status || '')) ? 'ok' : (/fail|blocked|missing/i.test(String(row.current_status || '')) ? 'error' : 'warning'))}</td>
            <td class="admin-table-note">${escHtml(row.test_command || row.route_hint || '')}</td>
            <td class="admin-table-note">${escHtml(row.failure_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No build guardrail rows loaded yet. Apply schema 125.</td></tr>';
      }
      if (e.publicSeoGuardrailBody) {
        const rows = Array.isArray(state.appPublicSeoChecks) ? state.appPublicSeoChecks : [];
        e.publicSeoGuardrailBody.innerHTML = rows.slice(0, 80).map((row) => `
          <tr>
            <td>${escHtml(row.check_area || 'seo')}</td>
            <td><strong>${escHtml(row.check_title || '')}</strong><div class="muted">${escHtml(row.route_hint || '')}</div></td>
            <td>${renderStatusPill(row.current_status || 'review', /pass|ready|ok/i.test(String(row.current_status || '')) ? 'ok' : (/fail|blocked|missing/i.test(String(row.current_status || '')) ? 'error' : 'warning'))}</td>
            <td class="admin-table-note">${escHtml(row.local_wording_hint || '')}</td>
            <td class="admin-table-note">${escHtml(row.failure_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No SEO guardrail rows loaded yet. Apply schema 125.</td></tr>';
      }
      if (e.runtimeFallbackBody) {
        const rows = Array.isArray(state.appRuntimeFallbackChecks) ? state.appRuntimeFallbackChecks : [];
        e.runtimeFallbackBody.innerHTML = rows.slice(0, 80).map((row) => `
          <tr>
            <td>${escHtml(row.surface_hint || row.check_area || '')}</td>
            <td><strong>${escHtml(row.check_title || '')}</strong></td>
            <td>${renderStatusPill(row.current_status || 'review', /pass|ready|ok/i.test(String(row.current_status || '')) ? 'ok' : (/fail|blocked|missing/i.test(String(row.current_status || '')) ? 'error' : 'warning'))}</td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
            <td class="admin-table-note">${escHtml(row.failure_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No runtime fallback rows loaded yet. Apply schema 125.</td></tr>';
      }
      if (e.roadmapActionBody) {
        const rows = Array.isArray(state.appRoadmapActionSteps) ? state.appRoadmapActionSteps : [];
        e.roadmapActionBody.innerHTML = rows.slice(0, 160).map((row) => `
          <tr>
            <td>${escHtml(row.step_batch || '')}</td>
            <td>${escHtml(String(row.step_number ?? ''))}</td>
            <td>${escHtml(row.step_area || '')}</td>
            <td><strong>${escHtml(row.step_title || '')}</strong><div class="muted">${escHtml(row.route_hint || row.source_doc || '')}</div></td>
            <td>${renderStatusPill(row.step_status || 'planned', /complete|pass|done/i.test(String(row.step_status || '')) ? 'ok' : (/blocked|fail/i.test(String(row.step_status || '')) ? 'error' : 'warning'))}</td>
            <td class="admin-table-note">${escHtml(row.acceptance_check || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="6" class="muted">No roadmap action rows loaded yet. Apply schema 126.</td></tr>';
      }
      if (e.depthReviewBody) {
        const rows = Array.isArray(state.appDepthReviewQueue) ? state.appDepthReviewQueue : [];
        e.depthReviewBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.review_area || '')}</td>
            <td><strong>${escHtml(row.review_title || '')}</strong><div class="muted">${escHtml(row.current_depth || '')}</div></td>
            <td>${renderStatusPill(row.review_status || 'review', /pass|ready|ok/i.test(String(row.review_status || '')) ? 'ok' : (/blocked|fail/i.test(String(row.review_status || '')) ? 'error' : 'warning'))}</td>
            <td class="admin-table-note">${escHtml(row.recommended_depth || '')}</td>
            <td class="admin-table-note">${escHtml(row.accounting_impact || row.cost_linkage_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No application depth review rows loaded yet. Apply schema 126.</td></tr>';
      }
      if (e.dataMigrationBody) {
        const rows = Array.isArray(state.appDataMigrationCandidates) ? state.appDataMigrationCandidates : [];
        e.dataMigrationBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.data_area || '')}</td>
            <td class="admin-table-note">${escHtml(row.source_location || '')}</td>
            <td class="admin-table-note">${escHtml(row.recommended_target || '')}</td>
            <td>${renderStatusPill(row.duplication_risk || 'review', /low/i.test(String(row.duplication_risk || '')) ? 'ok' : (/high/i.test(String(row.duplication_risk || '')) ? 'error' : 'warning'))}</td>
            <td>${renderStatusPill(row.migration_status || 'review', /complete|in_progress|done/i.test(String(row.migration_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.fallback_plan || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="6" class="muted">No data migration candidate rows loaded yet. Apply schema 126.</td></tr>';
      }
      if (e.schemaDocSyncBody) {
        const rows = Array.isArray(state.appSchemaDocumentationSyncChecks) ? state.appSchemaDocumentationSyncChecks : [];
        e.schemaDocSyncBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.check_area || '')}</td>
            <td><strong>${escHtml(row.check_title || '')}</strong></td>
            <td>${renderStatusPill(row.current_status || 'review', /pass|ready|ok/i.test(String(row.current_status || '')) ? 'ok' : (/fail|blocked|missing/i.test(String(row.current_status || '')) ? 'error' : 'warning'))}</td>
            <td class="admin-table-note">${escHtml(row.file_path || row.test_command || '')}</td>
            <td class="admin-table-note">${escHtml(row.failure_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No schema/documentation sync rows loaded yet. Apply schema 126.</td></tr>';
      }

      if (e.routeSeoRegistryBody) {
        const rows = Array.isArray(state.appPublicRouteSeoRegistry) ? state.appPublicRouteSeoRegistry : [];
        e.routeSeoRegistryBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td><strong>${escHtml(row.route_label || row.route_key || '')}</strong><div class="muted">${escHtml(row.route_path || '')}</div></td>
            <td>${escHtml(row.page_title || '')}<div class="muted">H1: ${escHtml(row.h1_text || '')}</div></td>
            <td>${renderStatusPill(row.publish_status || 'review', /ready|published|pass/i.test(String(row.publish_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.primary_local_terms || row.local_wording_notes || '')}</td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No route SEO registry rows loaded yet. Apply schema 127.</td></tr>';
      }
      if (e.internalLinkQueueBody) {
        const rows = Array.isArray(state.appInternalLinkSuggestionQueue) ? state.appInternalLinkSuggestionQueue : [];
        e.internalLinkQueueBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.source_route_label || row.source_route_path || '')}</td>
            <td>${escHtml(row.target_route_label || row.target_route_path || '')}</td>
            <td><strong>${escHtml(row.suggested_anchor_text || '')}</strong><div class="muted">${escHtml(row.link_context || '')}</div></td>
            <td>${renderStatusPill(row.suggestion_status || 'review', /approved|ready|pass/i.test(String(row.suggestion_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.seo_reason || row.proof_reason || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No internal-link suggestion rows loaded yet. Apply schema 127.</td></tr>';
      }
      if (e.cssTokenInventoryBody) {
        const rows = Array.isArray(state.appCssComponentTokenInventory) ? state.appCssComponentTokenInventory : [];
        e.cssTokenInventoryBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.component_area || '')}</td>
            <td><strong>${escHtml(row.token_name || '')}</strong><div class="muted">${escHtml(row.recommended_class_name || row.current_source || '')}</div></td>
            <td>${renderStatusPill(row.token_status || 'review', /ready|in_progress|pass/i.test(String(row.token_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.mobile_check_hint || '')}</td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No CSS token inventory rows loaded yet. Apply schema 127.</td></tr>';
      }
      if (e.mobileFieldActionBody) {
        const rows = Array.isArray(state.appMobileFieldActionQueue) ? state.appMobileFieldActionQueue : [];
        e.mobileFieldActionBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.action_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.action_title || '')}</strong><div class="muted">${escHtml(row.route_hint || '')}</div></td>
            <td>${renderStatusPill(row.action_status || 'planned', /ready|in_progress|pass/i.test(String(row.action_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.scan_or_proof_hint || '')}</td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No mobile field action rows loaded yet. Apply schema 127.</td></tr>';
      }
      if (e.releaseManifestBody) {
        const rows = Array.isArray(state.appReleaseManifestChecks) ? state.appReleaseManifestChecks : [];
        e.releaseManifestBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.release_label || '')}</td>
            <td><strong>${escHtml(row.manifest_area || '')}</strong><div class="muted">${escHtml(row.manifest_title || '')}</div></td>
            <td>${renderStatusPill(row.manifest_status || 'review', /pass|ready|ok/i.test(String(row.manifest_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.file_path || '')}<div class="muted">${escHtml(row.expected_marker || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.failure_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No release manifest rows loaded yet. Apply schema 127.</td></tr>';
      }
      if (e.paymentActionRegistryBody) {
        const rows = Array.isArray(state.appPaymentApplicationActionRegistry) ? state.appPaymentApplicationActionRegistry : [];
        e.paymentActionRegistryBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.action_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.action_title || '')}</strong><div class="muted">${escHtml(row.source_table_hint || '')}</div></td>
            <td>${renderStatusPill(row.workflow_status || 'planned', /ready|done|in_progress|pass/i.test(String(row.workflow_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.accounting_effect || '')}</td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No payment application action rows loaded yet. Apply schema 128.</td></tr>';
      }
      if (e.accountingCloseControlBody) {
        const rows = Array.isArray(state.appAccountingCloseControlQueue) ? state.appAccountingCloseControlQueue : [];
        e.accountingCloseControlBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.close_area || '')}</td>
            <td><strong>${escHtml(row.control_title || '')}</strong><div class="muted">${escHtml(row.source_totals_hint || '')}</div></td>
            <td>${renderStatusPill(row.control_status || 'planned', /ready|done|in_progress|pass/i.test(String(row.control_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.proof_hint || '')}<div class="muted">${escHtml(row.lock_behavior || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No accounting close control rows loaded yet. Apply schema 128.</td></tr>';
      }
      if (e.equipmentAccountabilityActionBody) {
        const rows = Array.isArray(state.appEquipmentAccountabilityActionQueue) ? state.appEquipmentAccountabilityActionQueue : [];
        e.equipmentAccountabilityActionBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.equipment_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.action_title || '')}</strong><div class="muted">Scan: ${escHtml(row.scanner_status || '')}</div></td>
            <td>${renderStatusPill(row.action_status || 'planned', /ready|done|in_progress|pass/i.test(String(row.action_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.server_enforcement_status || '')}<div class="muted">${escHtml(row.service_task_behavior || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment accountability rows loaded yet. Apply schema 128.</td></tr>';
      }
      if (e.publicSeoPublicationBody) {
        const rows = Array.isArray(state.appPublicSeoPublicationQueue) ? state.appPublicSeoPublicationQueue : [];
        e.publicSeoPublicationBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.publish_area || '')}<div class="muted">${escHtml(row.route_key || '')}</div></td>
            <td><strong>${escHtml(row.publish_title || '')}</strong><div class="muted">${escHtml(row.required_evidence || '')}</div></td>
            <td>${renderStatusPill(row.publish_status || 'planned', /ready|done|in_progress|pass/i.test(String(row.publish_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.smoke_test_hint || '')}<div class="muted">${escHtml(row.local_wording_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No public SEO publication rows loaded yet. Apply schema 128.</td></tr>';
      }
      if (e.fallbackObservabilityBody) {
        const rows = Array.isArray(state.appFallbackObservabilityMatrix) ? state.appFallbackObservabilityMatrix : [];
        e.fallbackObservabilityBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.app_surface || '')}</td>
            <td><strong>${escHtml(row.failure_mode || '')}</strong><div class="muted">${escHtml(row.telemetry_hint || '')}</div></td>
            <td>${renderStatusPill(row.fallback_status || 'review', /covered|ready|done|pass/i.test(String(row.fallback_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.user_message_hint || '')}<div class="muted">${escHtml(row.retry_policy_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.owner_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No fallback observability rows loaded yet. Apply schema 128.</td></tr>';
      }
      if (e.schemaCompatibilityBody) {
        const rows = Array.isArray(state.appSchemaMigrationCompatibilityChecks) ? state.appSchemaMigrationCompatibilityChecks : [];
        e.schemaCompatibilityBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.schema_file || '')}<div class="muted">${escHtml(row.compatibility_area || '')}</div></td>
            <td><strong>${escHtml(row.check_title || '')}</strong><div class="muted">${escHtml(row.repair_hint || '')}</div></td>
            <td>${renderStatusPill(row.check_status || 'review', /pass|covered|ready|done/i.test(String(row.check_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.legacy_column || '')} → ${escHtml(row.expected_column || '')}</td>
            <td class="admin-table-note">${escHtml(row.smoke_test_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No schema compatibility rows loaded yet. Apply schema 129.</td></tr>';
      }
      if (e.accountingEvidencePackageBody) {
        const rows = Array.isArray(state.appAccountingEvidencePackageQueue) ? state.appAccountingEvidencePackageQueue : [];
        e.accountingEvidencePackageBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.package_area || '')}<div class="muted">${escHtml(row.reviewer_role_hint || '')}</div></td>
            <td><strong>${escHtml(row.package_title || '')}</strong><div class="muted">${escHtml(row.source_rows_hint || '')}</div></td>
            <td>${renderStatusPill(row.package_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.package_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.required_proof_hint || '')}<div class="muted">${escHtml(row.export_format_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No accounting evidence package rows loaded yet. Apply schema 129.</td></tr>';
      }
      if (e.equipmentReturnRulesBody) {
        const rows = Array.isArray(state.appEquipmentReturnToServiceRules) ? state.appEquipmentReturnToServiceRules : [];
        e.equipmentReturnRulesBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.equipment_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.rule_title || '')}</strong><div class="muted">${escHtml(row.source_event_hint || '')}</div></td>
            <td>${renderStatusPill(row.rule_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.rule_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.proof_required_hint || '')}<div class="muted">${escHtml(row.block_behavior || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment return-to-service rows loaded yet. Apply schema 129.</td></tr>';
      }
      if (e.publicAssetSmokeBody) {
        const rows = Array.isArray(state.appPublicAssetSmokeChecks) ? state.appPublicAssetSmokeChecks : [];
        e.publicAssetSmokeBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.asset_area || '')}</td>
            <td><strong>${escHtml(row.asset_title || '')}</strong><div class="muted">${escHtml(row.source_registry_hint || '')}</div></td>
            <td>${renderStatusPill(row.check_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.check_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.file_path || '')}<div class="muted">${escHtml(row.local_seo_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.failure_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No public asset smoke rows loaded yet. Apply schema 129.</td></tr>';
      }
      if (e.errorRecoveryPlaybookBody) {
        const rows = Array.isArray(state.appErrorRecoveryPlaybook) ? state.appErrorRecoveryPlaybook : [];
        e.errorRecoveryPlaybookBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.app_area || '')}</td>
            <td><strong>${escHtml(row.error_signature || '')}</strong><div class="muted">${escHtml(row.operator_message || '')}</div></td>
            <td>${renderStatusPill(row.playbook_status || 'review', /covered|pass|ready|done/i.test(String(row.playbook_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.recovery_steps || '')}<div class="muted">${escHtml(row.prevention_check || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.owner_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No error recovery playbook rows loaded yet. Apply schema 129.</td></tr>';
      }
      if (e.paymentExecutionQueueBody) {
        const rows = Array.isArray(state.appPaymentExecutionQueue) ? state.appPaymentExecutionQueue : [];
        e.paymentExecutionQueueBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.action_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.action_title || '')}</strong></td>
            <td>${renderStatusPill(row.action_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.action_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.source_rows_hint || '')}<div class="muted">${escHtml(row.route_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No payment execution rows loaded yet. Apply schema 130.</td></tr>';
      }
      if (e.bankReconciliationExecutionBody) {
        const rows = Array.isArray(state.appBankReconciliationExecutionQueue) ? state.appBankReconciliationExecutionQueue : [];
        e.bankReconciliationExecutionBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.action_area || '')}</td>
            <td><strong>${escHtml(row.action_title || '')}</strong></td>
            <td>${renderStatusPill(row.action_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.action_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.source_rows_hint || '')}<div class="muted">${escHtml(row.route_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No reconciliation execution rows loaded yet. Apply schema 130.</td></tr>';
      }
      if (e.equipmentScanTemplateBody) {
        const rows = Array.isArray(state.appEquipmentScanTemplateRegistry) ? state.appEquipmentScanTemplateRegistry : [];
        e.equipmentScanTemplateBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.equipment_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.action_title || '')}</strong></td>
            <td>${renderStatusPill(row.action_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.action_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.scanner_status || '')}<div class="muted">${escHtml(row.service_task_behavior || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment scan/template rows loaded yet. Apply schema 130.</td></tr>';
      }
      if (e.localSeoExecutionBody) {
        const rows = Array.isArray(state.appLocalSeoExecutionQueue) ? state.appLocalSeoExecutionQueue : [];
        e.localSeoExecutionBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.seo_area || '')}</td>
            <td><strong>${escHtml(row.action_title || '')}</strong></td>
            <td>${renderStatusPill(row.action_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.action_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.required_evidence || '')}<div class="muted">${escHtml(row.local_wording_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No local SEO execution rows loaded yet. Apply schema 130.</td></tr>';
      }
      if (e.fallbackDrillBody) {
        const rows = Array.isArray(state.appFallbackDrillQueue) ? state.appFallbackDrillQueue : [];
        e.fallbackDrillBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.app_surface || '')}</td>
            <td><strong>${escHtml(row.drill_title || '')}</strong></td>
            <td>${renderStatusPill(row.drill_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.drill_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.trigger_hint || '')}<div class="muted">${escHtml(row.expected_fallback || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.owner_hint || '')}<div class="muted">${escHtml(row.recovery_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No fallback drill rows loaded yet. Apply schema 130.</td></tr>';
      }
      if (e.paymentApplicationUiQueueBody) {
        const rows = Array.isArray(state.appPaymentApplicationUiQueue) ? state.appPaymentApplicationUiQueue : [];
        e.paymentApplicationUiQueueBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.control_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.control_title || '')}</strong><div class="muted">${escHtml(row.route_hint || '')}</div></td>
            <td>${renderStatusPill(row.control_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.control_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.validation_hint || '')}<div class="muted">${escHtml(row.posting_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No payment UI control rows loaded yet. Apply schema 131.</td></tr>';
      }
      if (e.reconciliationImportValidationBody) {
        const rows = Array.isArray(state.appReconciliationImportValidationQueue) ? state.appReconciliationImportValidationQueue : [];
        e.reconciliationImportValidationBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.import_area || '')}</td>
            <td><strong>${escHtml(row.check_title || '')}</strong><div class="muted">${escHtml(row.reviewer_hint || '')}</div></td>
            <td>${renderStatusPill(row.check_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.check_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.csv_rule_hint || '')}<div class="muted">${escHtml(row.match_rule_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No reconciliation import validation rows loaded yet. Apply schema 131.</td></tr>';
      }
      if (e.equipmentServiceCloseoutBody) {
        const rows = Array.isArray(state.appEquipmentServiceCloseoutQueue) ? state.appEquipmentServiceCloseoutQueue : [];
        e.equipmentServiceCloseoutBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.equipment_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.closeout_title || '')}</strong></td>
            <td>${renderStatusPill(row.closeout_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.closeout_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.proof_hint || '')}<div class="muted">${escHtml(row.cost_capture_hint || '')}</div><div class="muted">${escHtml(row.return_to_service_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment service closeout rows loaded yet. Apply schema 131.</td></tr>';
      }
      if (e.seoAssetPublicationBody) {
        const rows = Array.isArray(state.appSeoAssetPublicationQueue) ? state.appSeoAssetPublicationQueue : [];
        e.seoAssetPublicationBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.seo_area || '')}<div class="muted">${escHtml(row.route_key || '')}</div></td>
            <td><strong>${escHtml(row.asset_title || '')}</strong></td>
            <td>${renderStatusPill(row.asset_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.asset_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.file_path_hint || '')}<div class="muted">${escHtml(row.local_search_hint || '')}</div><div class="muted">${escHtml(row.validation_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No SEO asset publication rows loaded yet. Apply schema 131.</td></tr>';
      }
      if (e.runtimeRecoveryTelemetryBody) {
        const rows = Array.isArray(state.appRuntimeRecoveryTelemetryQueue) ? state.appRuntimeRecoveryTelemetryQueue : [];
        e.runtimeRecoveryTelemetryBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.app_surface || '')}</td>
            <td><strong>${escHtml(row.recovery_title || '')}</strong></td>
            <td>${renderStatusPill(row.recovery_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.recovery_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.signal_hint || '')}<div class="muted">${escHtml(row.operator_message_hint || '')}</div><div class="muted">${escHtml(row.retry_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.owner_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No runtime recovery telemetry rows loaded yet. Apply schema 131.</td></tr>';
      }

      if (e.paymentWritePathBody) {
        const rows = Array.isArray(state.appPaymentWritePathQueue) ? state.appPaymentWritePathQueue : [];
        e.paymentWritePathBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.write_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.write_title || '')}</strong><div class="muted">${escHtml(row.source_rows_hint || '')}</div></td>
            <td>${renderStatusPill(row.write_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.write_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.validation_hint || '')}<div class="muted">${escHtml(row.posting_proof_hint || '')}</div><div class="muted">${escHtml(row.rollback_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No payment write-path rows loaded yet. Apply schema 133.</td></tr>';
      }
      if (e.reconciliationScoringRuleBody) {
        const rows = Array.isArray(state.appReconciliationScoringRuleQueue) ? state.appReconciliationScoringRuleQueue : [];
        e.reconciliationScoringRuleBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.rule_area || '')}</td>
            <td><strong>${escHtml(row.rule_title || '')}</strong><div class="muted">${escHtml(row.score_hint || '')}</div></td>
            <td>${renderStatusPill(row.rule_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.rule_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.match_input_hint || '')}<div class="muted">${escHtml(row.reviewer_action_hint || '')}</div><div class="muted">${escHtml(row.undo_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No reconciliation scoring rows loaded yet. Apply schema 133.</td></tr>';
      }
      if (e.equipmentAccessoryTemplateBody) {
        const rows = Array.isArray(state.appEquipmentAccessoryTemplateQueue) ? state.appEquipmentAccessoryTemplateQueue : [];
        e.equipmentAccessoryTemplateBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.equipment_pool_hint || '')}</td>
            <td><strong>${escHtml(row.template_title || '')}</strong><div class="muted">${escHtml(row.expected_items_hint || '')}</div></td>
            <td>${renderStatusPill(row.template_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.template_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.checkout_compare_hint || '')}<div class="muted">${escHtml(row.return_compare_hint || '')}</div><div class="muted">${escHtml(row.exception_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment accessory template rows loaded yet. Apply schema 133.</td></tr>';
      }
      if (e.localSeoGenerationBody) {
        const rows = Array.isArray(state.appLocalSeoGenerationQueue) ? state.appLocalSeoGenerationQueue : [];
        e.localSeoGenerationBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.seo_area || '')}</td>
            <td><strong>${escHtml(row.generation_title || '')}</strong><div class="muted">${escHtml(row.source_registry_hint || '')}</div></td>
            <td>${renderStatusPill(row.generation_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.generation_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.output_asset_hint || '')}<div class="muted">${escHtml(row.local_relevance_hint || '')}</div><div class="muted">${escHtml(row.validation_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No local SEO generation rows loaded yet. Apply schema 133.</td></tr>';
      }
      if (e.mobileOfflineConflictResolutionBody) {
        const rows = Array.isArray(state.appMobileOfflineConflictResolutionQueue) ? state.appMobileOfflineConflictResolutionQueue : [];
        e.mobileOfflineConflictResolutionBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.form_area || '')}</td>
            <td><strong>${escHtml(row.conflict_title || '')}</strong></td>
            <td>${renderStatusPill(row.conflict_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.conflict_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.detection_hint || '')}<div class="muted">${escHtml(row.user_choice_hint || '')}</div><div class="muted">${escHtml(row.retry_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.data_safety_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No mobile offline conflict rows loaded yet. Apply schema 133.</td></tr>';
      }
      if (e.paymentAdjustmentWorkflowBody) {
        const rows = Array.isArray(state.appPaymentAdjustmentWorkflowQueue) ? state.appPaymentAdjustmentWorkflowQueue : [];
        e.paymentAdjustmentWorkflowBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.workflow_area || '')}<div class="muted">${escHtml(row.required_role || '')}</div></td>
            <td><strong>${escHtml(row.workflow_title || '')}</strong></td>
            <td>${renderStatusPill(row.workflow_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.workflow_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.validation_hint || '')}<div class="muted">${escHtml(row.posting_hint || '')}</div><div class="muted">${escHtml(row.reversal_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.evidence_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No payment adjustment workflow rows loaded yet. Apply schema 134.</td></tr>';
      }
      if (e.reconciliationExceptionResolutionBody) {
        const rows = Array.isArray(state.appReconciliationExceptionResolutionQueue) ? state.appReconciliationExceptionResolutionQueue : [];
        e.reconciliationExceptionResolutionBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.exception_area || '')}</td>
            <td><strong>${escHtml(row.exception_title || '')}</strong></td>
            <td>${renderStatusPill(row.exception_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.exception_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.match_score_hint || '')}<div class="muted">${escHtml(row.human_review_hint || '')}</div><div class="muted">${escHtml(row.posting_block_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.undo_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No reconciliation exception rows loaded yet. Apply schema 134.</td></tr>';
      }
      if (e.equipmentScanRolloutBody) {
        const rows = Array.isArray(state.appEquipmentScanRolloutQueue) ? state.appEquipmentScanRolloutQueue : [];
        e.equipmentScanRolloutBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.rollout_area || '')}</td>
            <td><strong>${escHtml(row.rollout_title || '')}</strong></td>
            <td>${renderStatusPill(row.rollout_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.rollout_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.device_requirement_hint || '')}<div class="muted">${escHtml(row.manual_fallback_hint || '')}</div><div class="muted">${escHtml(row.accessory_template_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.verifier_role_hint || '')}<div class="muted">${escHtml(row.service_task_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment scan rollout rows loaded yet. Apply schema 134.</td></tr>';
      }
      if (e.localSeoContentDepthBody) {
        const rows = Array.isArray(state.appLocalSeoContentDepthQueue) ? state.appLocalSeoContentDepthQueue : [];
        e.localSeoContentDepthBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.route_key || '')}<div class="muted">${escHtml(row.content_area || '')}</div></td>
            <td><strong>${escHtml(row.content_title || '')}</strong></td>
            <td>${renderStatusPill(row.content_status || 'planned', /pass|covered|ready|done|in_progress/i.test(String(row.content_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.primary_local_phrase || '')}<div class="muted">${escHtml(row.proof_requirement_hint || '')}</div><div class="muted">${escHtml(row.internal_link_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.publication_gate_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No local SEO content depth rows loaded yet. Apply schema 134.</td></tr>';
      }
      if (e.runtimeErrorMessageCatalogBody) {
        const rows = Array.isArray(state.appRuntimeErrorMessageCatalog) ? state.appRuntimeErrorMessageCatalog : [];
        e.runtimeErrorMessageCatalogBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.app_surface || '')}</td>
            <td><strong>${escHtml(row.error_title || '')}</strong></td>
            <td>${renderStatusPill(row.error_status || 'review', /pass|covered|ready|done|in_progress/i.test(String(row.error_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.user_message || '')}<div class="muted">${escHtml(row.operator_hint || '')}</div><div class="muted">${escHtml(row.telemetry_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.retry_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No runtime message catalog rows loaded yet. Apply schema 134.</td></tr>';
      }
      applyAdminActionDisabledStates();

      if (e.releaseValidationBody) {
        const rows = Array.isArray(state.appReleaseValidationQueue) ? state.appReleaseValidationQueue : [];
        e.releaseValidationBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.validation_area || '')}<div class="muted">${escHtml(row.owner_hint || '')}</div></td>
            <td><strong>${escHtml(row.validation_title || '')}</strong></td>
            <td>${renderStatusPill(row.validation_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.validation_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.required_evidence || '')}<div class="muted">${escHtml(row.preflight_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.failure_response_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No release validation rows loaded yet. Apply schema 135.</td></tr>';
      }
      if (e.paymentReconciliationExecutionBody) {
        const rows = Array.isArray(state.appPaymentReconciliationExecutionQueue) ? state.appPaymentReconciliationExecutionQueue : [];
        e.paymentReconciliationExecutionBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.execution_area || '')}</td>
            <td><strong>${escHtml(row.execution_title || '')}</strong></td>
            <td>${renderStatusPill(row.execution_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.execution_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.input_validation_hint || '')}<div class="muted">${escHtml(row.posting_or_match_hint || '')}</div><div class="muted">${escHtml(row.approval_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.rollback_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No payment/reconciliation execution rows loaded yet. Apply schema 135.</td></tr>';
      }
      if (e.equipmentMobileScanValidationBody) {
        const rows = Array.isArray(state.appEquipmentMobileScanValidationQueue) ? state.appEquipmentMobileScanValidationQueue : [];
        e.equipmentMobileScanValidationBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.equipment_area || '')}</td>
            <td><strong>${escHtml(row.validation_title || '')}</strong></td>
            <td>${renderStatusPill(row.validation_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.validation_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.scan_hint || '')}<div class="muted">${escHtml(row.accessory_hint || '')}</div><div class="muted">${escHtml(row.verifier_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.service_task_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment mobile scan validation rows loaded yet. Apply schema 135.</td></tr>';
      }
      if (e.localSeoReleaseValidationBody) {
        const rows = Array.isArray(state.appLocalSeoReleaseValidationQueue) ? state.appLocalSeoReleaseValidationQueue : [];
        e.localSeoReleaseValidationBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.route_key || '')}<div class="muted">${escHtml(row.seo_area || '')}</div></td>
            <td><strong>${escHtml(row.seo_title || '')}</strong></td>
            <td>${renderStatusPill(row.seo_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.seo_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.phrase_hint || '')}<div class="muted">${escHtml(row.one_h1_hint || '')}</div><div class="muted">${escHtml(row.structured_data_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.internal_link_hint || '')}<div class="muted">${escHtml(row.proof_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No local SEO release validation rows loaded yet. Apply schema 135.</td></tr>';
      }
      if (e.runtimeFallbackMessageBody) {
        const rows = Array.isArray(state.appRuntimeFallbackMessageQueue) ? state.appRuntimeFallbackMessageQueue : [];
        e.runtimeFallbackMessageBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.app_surface || '')}</td>
            <td><strong>${escHtml(row.message_title || '')}</strong></td>
            <td>${renderStatusPill(row.message_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.message_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.trigger_hint || '')}<div class="muted">${escHtml(row.user_copy_hint || '')}</div><div class="muted">${escHtml(row.operator_copy_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.recovery_hint || '')}<div class="muted">${escHtml(row.telemetry_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No runtime fallback message rows loaded yet. Apply schema 135.</td></tr>';
      }
      if (e.jsonDbMigrationExecutionBody) {
        const rows = Array.isArray(state.appJsonDbMigrationExecutionQueue) ? state.appJsonDbMigrationExecutionQueue : [];
        e.jsonDbMigrationExecutionBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.data_area || '')}</td>
            <td><strong>${escHtml(row.migration_title || '')}</strong></td>
            <td>${renderStatusPill(row.migration_status || 'review', /pass|covered|ready|done|completed|in_progress/i.test(String(row.migration_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.current_source_hint || '')}<div class="muted">${escHtml(row.target_source_hint || '')}</div><div class="muted">${escHtml(row.duplication_risk_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.execution_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No JSON/DB migration execution rows loaded yet. Apply schema 135.</td></tr>';
      }

      if (e.releaseCutoverChecklistBody) {
        const rows = Array.isArray(state.appReleaseCutoverChecklist) ? state.appReleaseCutoverChecklist : [];
        e.releaseCutoverChecklistBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.cutover_area || '')}<div class="muted">${escHtml(row.route_hint || '')}</div></td>
            <td><strong>${escHtml(row.cutover_title || '')}</strong></td>
            <td>${renderStatusPill(row.cutover_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.cutover_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.preflight_hint || '')}<div class="muted">${escHtml(row.deploy_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.rollback_hint || '')}<div class="muted">${escHtml(row.owner_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No release cutover rows loaded yet. Apply schema 136.</td></tr>';
      }
      if (e.paymentExceptionDecisionBody) {
        const rows = Array.isArray(state.appPaymentExceptionDecisionQueue) ? state.appPaymentExceptionDecisionQueue : [];
        e.paymentExceptionDecisionBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.exception_area || '')}</td>
            <td><strong>${escHtml(row.decision_title || '')}</strong></td>
            <td>${renderStatusPill(row.decision_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.decision_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.validation_hint || '')}<div class="muted">${escHtml(row.posting_hint || '')}</div><div class="muted">${escHtml(row.approval_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.rollback_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No payment exception decision rows loaded yet. Apply schema 136.</td></tr>';
      }
      if (e.equipmentReturnToServiceGateBody) {
        const rows = Array.isArray(state.appEquipmentReturnToServiceGateQueue) ? state.appEquipmentReturnToServiceGateQueue : [];
        e.equipmentReturnToServiceGateBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.gate_area || '')}</td>
            <td><strong>${escHtml(row.gate_title || '')}</strong></td>
            <td>${renderStatusPill(row.gate_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.gate_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.scan_requirement_hint || '')}<div class="muted">${escHtml(row.accessory_requirement_hint || '')}</div><div class="muted">${escHtml(row.verifier_requirement_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.service_task_requirement_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment return-to-service gate rows loaded yet. Apply schema 136.</td></tr>';
      }
      if (e.localSearchEvidenceBody) {
        const rows = Array.isArray(state.appLocalSearchEvidenceQueue) ? state.appLocalSearchEvidenceQueue : [];
        e.localSearchEvidenceBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.route_key || '')}<div class="muted">${escHtml(row.evidence_area || '')}</div></td>
            <td><strong>${escHtml(row.evidence_title || '')}</strong></td>
            <td>${renderStatusPill(row.evidence_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.evidence_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.phrase_hint || '')}<div class="muted">${escHtml(row.proof_hint || '')}</div><div class="muted">${escHtml(row.internal_link_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.publication_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No local search evidence rows loaded yet. Apply schema 136.</td></tr>';
      }
      if (e.cssDriftWatchlistBody) {
        const rows = Array.isArray(state.appCssDriftWatchlist) ? state.appCssDriftWatchlist : [];
        e.cssDriftWatchlistBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.component_area || '')}</td>
            <td><strong>${escHtml(row.component_title || '')}</strong></td>
            <td>${renderStatusPill(row.watch_status || 'review', /pass|covered|ready|done|completed|in_progress/i.test(String(row.watch_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.token_hint || '')}<div class="muted">${escHtml(row.selector_hint || '')}</div><div class="muted">${escHtml(row.drift_risk_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.test_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No CSS drift watchlist rows loaded yet. Apply schema 136.</td></tr>';
      }
      if (e.runtimeFallbackTestPlanBody) {
        const rows = Array.isArray(state.appRuntimeFallbackTestPlan) ? state.appRuntimeFallbackTestPlan : [];
        e.runtimeFallbackTestPlanBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.app_surface || '')}</td>
            <td><strong>${escHtml(row.test_title || '')}</strong></td>
            <td>${renderStatusPill(row.test_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.test_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.failure_mode || '')}<div class="muted">${escHtml(row.user_copy_hint || '')}</div><div class="muted">${escHtml(row.telemetry_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.retry_hint || '')}<div class="muted">${escHtml(row.owner_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No runtime fallback test rows loaded yet. Apply schema 136.</td></tr>';
      }
      if (e.jsonDbSourceOfTruthBody) {
        const rows = Array.isArray(state.appJsonDbSourceOfTruthQueue) ? state.appJsonDbSourceOfTruthQueue : [];
        e.jsonDbSourceOfTruthBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.data_area || '')}</td>
            <td><strong>${escHtml(row.source_title || '')}</strong></td>
            <td>${renderStatusPill(row.source_status || 'review', /pass|covered|ready|done|completed|in_progress/i.test(String(row.source_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.current_source_hint || '')}<div class="muted">${escHtml(row.target_source_hint || '')}</div><div class="muted">${escHtml(row.migration_rule_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.validation_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No JSON/DB source-of-truth rows loaded yet. Apply schema 136.</td></tr>';
      }

      if (e.paymentReconciliationCutoverDrillBody) {
        const rows = Array.isArray(state.appPaymentReconciliationCutoverDrillQueue) ? state.appPaymentReconciliationCutoverDrillQueue : [];
        e.paymentReconciliationCutoverDrillBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.drill_area || '')}</td>
            <td><strong>${escHtml(row.drill_title || '')}</strong></td>
            <td>${renderStatusPill(row.drill_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.drill_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.validation_hint || '')}<div class="muted">${escHtml(row.posting_hint || '')}</div><div class="muted">${escHtml(row.signoff_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No payment/reconciliation cutover drill rows loaded yet. Apply schema 137.</td></tr>';
      }
      if (e.equipmentServiceCostRecoveryBody) {
        const rows = Array.isArray(state.appEquipmentServiceCostRecoveryQueue) ? state.appEquipmentServiceCostRecoveryQueue : [];
        e.equipmentServiceCostRecoveryBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.recovery_area || '')}</td>
            <td><strong>${escHtml(row.recovery_title || '')}</strong></td>
            <td>${renderStatusPill(row.recovery_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.recovery_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.source_cost_hint || '')}<div class="muted">${escHtml(row.job_link_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.approval_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment service cost recovery rows loaded yet. Apply schema 137.</td></tr>';
      }
      if (e.localSeoProminenceActionBody) {
        const rows = Array.isArray(state.appLocalSeoProminenceActionQueue) ? state.appLocalSeoProminenceActionQueue : [];
        e.localSeoProminenceActionBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.route_key || '')}<div class="muted">${escHtml(row.action_area || '')}</div></td>
            <td><strong>${escHtml(row.action_title || '')}</strong></td>
            <td>${renderStatusPill(row.action_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.action_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.prominent_wording_hint || '')}<div class="muted">${escHtml(row.proof_hint || '')}</div><div class="muted">${escHtml(row.internal_link_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No local SEO prominence rows loaded yet. Apply schema 137.</td></tr>';
      }
      if (e.cssAccessibilityFallbackBody) {
        const rows = Array.isArray(state.appCssAccessibilityFallbackQueue) ? state.appCssAccessibilityFallbackQueue : [];
        e.cssAccessibilityFallbackBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.component_area || '')}</td>
            <td><strong>${escHtml(row.check_title || '')}</strong></td>
            <td>${renderStatusPill(row.check_status || 'review', /pass|covered|ready|done|completed|in_progress/i.test(String(row.check_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.accessibility_hint || '')}<div class="muted">${escHtml(row.selector_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No CSS accessibility fallback rows loaded yet. Apply schema 137.</td></tr>';
      }
      if (e.dataMigrationValidationBody) {
        const rows = Array.isArray(state.appDataMigrationValidationQueue) ? state.appDataMigrationValidationQueue : [];
        e.dataMigrationValidationBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.data_area || '')}</td>
            <td><strong>${escHtml(row.validation_title || '')}</strong></td>
            <td>${renderStatusPill(row.validation_status || 'review', /pass|covered|ready|done|completed|in_progress/i.test(String(row.validation_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.current_source_hint || '')}<div class="muted">${escHtml(row.target_source_hint || '')}</div><div class="muted">${escHtml(row.validation_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No data migration validation rows loaded yet. Apply schema 137.</td></tr>';
      }
      if (e.runtimeReleaseMessageBody) {
        const rows = Array.isArray(state.appRuntimeReleaseMessageQueue) ? state.appRuntimeReleaseMessageQueue : [];
        e.runtimeReleaseMessageBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.app_surface || '')}</td>
            <td><strong>${escHtml(row.message_title || '')}</strong></td>
            <td>${renderStatusPill(row.message_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.message_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.failure_hint || '')}<div class="muted">${escHtml(row.user_message_hint || '')}</div><div class="muted">${escHtml(row.operator_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.retry_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No runtime release message rows loaded yet. Apply schema 137.</td></tr>';
      }

      if (e.releaseReadinessSignoffBody) {
        const rows = Array.isArray(state.appReleaseReadinessSignoffQueue) ? state.appReleaseReadinessSignoffQueue : [];
        e.releaseReadinessSignoffBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.signoff_area || '')}</td>
            <td><strong>${escHtml(row.signoff_title || '')}</strong></td>
            <td>${renderStatusPill(row.signoff_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.signoff_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.evidence_hint || '')}<div class="muted">${escHtml(row.verifier_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.release_block_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No release readiness signoff rows loaded yet. Apply schema 138.</td></tr>';
      }
      if (e.accountingExceptionClosureBody) {
        const rows = Array.isArray(state.appAccountingExceptionClosureQueue) ? state.appAccountingExceptionClosureQueue : [];
        e.accountingExceptionClosureBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.exception_area || '')}</td>
            <td><strong>${escHtml(row.exception_title || '')}</strong></td>
            <td>${renderStatusPill(row.closure_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.closure_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.source_rows_hint || '')}<div class="muted">${escHtml(row.decision_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.posting_or_lock_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No accounting exception closure rows loaded yet. Apply schema 138.</td></tr>';
      }
      if (e.equipmentServiceVerificationBody) {
        const rows = Array.isArray(state.appEquipmentServiceVerificationQueue) ? state.appEquipmentServiceVerificationQueue : [];
        e.equipmentServiceVerificationBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.equipment_area || '')}</td>
            <td><strong>${escHtml(row.verification_title || '')}</strong></td>
            <td>${renderStatusPill(row.verification_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.verification_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.scan_or_asset_hint || '')}<div class="muted">${escHtml(row.service_proof_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.role_gate_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment service verification rows loaded yet. Apply schema 138.</td></tr>';
      }
      if (e.localSeoRefreshBody) {
        const rows = Array.isArray(state.appLocalSeoRefreshQueue) ? state.appLocalSeoRefreshQueue : [];
        e.localSeoRefreshBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.route_key || '')}<div class="muted">${escHtml(row.refresh_area || '')}</div></td>
            <td><strong>${escHtml(row.refresh_title || '')}</strong></td>
            <td>${renderStatusPill(row.refresh_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.refresh_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.keyword_hint || '')}<div class="muted">${escHtml(row.proof_hint || '')}</div><div class="muted">${escHtml(row.internal_link_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No local SEO refresh rows loaded yet. Apply schema 138.</td></tr>';
      }
      if (e.cssMobileRegressionBody) {
        const rows = Array.isArray(state.appCssMobileRegressionQueue) ? state.appCssMobileRegressionQueue : [];
        e.cssMobileRegressionBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.component_area || '')}</td>
            <td><strong>${escHtml(row.regression_title || '')}</strong></td>
            <td>${renderStatusPill(row.regression_status || 'review', /pass|covered|ready|done|completed|in_progress/i.test(String(row.regression_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.breakpoint_hint || '')}<div class="muted">${escHtml(row.selector_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.test_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No CSS/mobile regression rows loaded yet. Apply schema 138.</td></tr>';
      }
      if (e.runtimeObservabilityReleaseBody) {
        const rows = Array.isArray(state.appRuntimeObservabilityReleaseQueue) ? state.appRuntimeObservabilityReleaseQueue : [];
        e.runtimeObservabilityReleaseBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.app_surface || '')}</td>
            <td><strong>${escHtml(row.observability_title || '')}</strong></td>
            <td>${renderStatusPill(row.observability_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.observability_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.signal_hint || '')}<div class="muted">${escHtml(row.user_message_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.operator_action_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No runtime observability release rows loaded yet. Apply schema 138.</td></tr>';
      }

      if (e.accountingCutoverTrialBalanceBody) {
        const rows = Array.isArray(state.appAccountingCutoverTrialBalanceQueue) ? state.appAccountingCutoverTrialBalanceQueue : [];
        e.accountingCutoverTrialBalanceBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.cutover_area || '')}</td>
            <td><strong>${escHtml(row.cutover_title || '')}</strong></td>
            <td>${renderStatusPill(row.cutover_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.cutover_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.source_balance_hint || '')}<div class="muted">${escHtml(row.exception_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.posting_lock_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No accounting cutover trial-balance rows loaded yet. Apply schema 139.</td></tr>';
      }
      if (e.equipmentScanAssetRolloutBody) {
        const rows = Array.isArray(state.appEquipmentScanAssetRolloutQueue) ? state.appEquipmentScanAssetRolloutQueue : [];
        e.equipmentScanAssetRolloutBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.rollout_area || '')}</td>
            <td><strong>${escHtml(row.rollout_title || '')}</strong></td>
            <td>${renderStatusPill(row.rollout_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.rollout_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.asset_tag_hint || '')}<div class="muted">${escHtml(row.scan_test_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.verifier_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment scan asset rollout rows loaded yet. Apply schema 139.</td></tr>';
      }
      if (e.localSeoProminencePublicationBody) {
        const rows = Array.isArray(state.appLocalSeoProminencePublicationQueue) ? state.appLocalSeoProminencePublicationQueue : [];
        e.localSeoProminencePublicationBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.route_key || '')}<div class="muted">${escHtml(row.publication_area || '')}</div></td>
            <td><strong>${escHtml(row.publication_title || '')}</strong></td>
            <td>${renderStatusPill(row.publication_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.publication_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.prominence_hint || '')}<div class="muted">${escHtml(row.evidence_hint || '')}</div><div class="muted">${escHtml(row.internal_link_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No local SEO prominence publication rows loaded yet. Apply schema 139.</td></tr>';
      }
      if (e.cssMobileReleaseGuardBody) {
        const rows = Array.isArray(state.appCssMobileReleaseGuardQueue) ? state.appCssMobileReleaseGuardQueue : [];
        e.cssMobileReleaseGuardBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.guard_area || '')}</td>
            <td><strong>${escHtml(row.guard_title || '')}</strong></td>
            <td>${renderStatusPill(row.guard_status || 'review', /pass|covered|ready|done|completed|in_progress/i.test(String(row.guard_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.selector_hint || '')}<div class="muted">${escHtml(row.mobile_test_hint || '')}</div><div class="muted">${escHtml(row.accessibility_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No CSS/mobile release guard rows loaded yet. Apply schema 139.</td></tr>';
      }
      if (e.runtimeSupportPlaybookBody) {
        const rows = Array.isArray(state.appRuntimeSupportPlaybookQueue) ? state.appRuntimeSupportPlaybookQueue : [];
        e.runtimeSupportPlaybookBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.app_surface || '')}</td>
            <td><strong>${escHtml(row.playbook_title || '')}</strong></td>
            <td>${renderStatusPill(row.playbook_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.playbook_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.detection_hint || '')}<div class="muted">${escHtml(row.user_message_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.support_action_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No runtime support playbook rows loaded yet. Apply schema 139.</td></tr>';
      }
      if (e.dataSourceMigrationLockBody) {
        const rows = Array.isArray(state.appDataSourceMigrationLockQueue) ? state.appDataSourceMigrationLockQueue : [];
        e.dataSourceMigrationLockBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.data_area || '')}</td>
            <td><strong>${escHtml(row.lock_title || '')}</strong></td>
            <td>${renderStatusPill(row.lock_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.lock_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.current_source_hint || '')}<div class="muted">${escHtml(row.target_source_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.validation_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No data source migration lock rows loaded yet. Apply schema 139.</td></tr>';
      }

      if (e.releaseExitCriteriaBody) {
        const rows = Array.isArray(state.appReleaseExitCriteriaQueue) ? state.appReleaseExitCriteriaQueue : [];
        e.releaseExitCriteriaBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.criteria_area || '')}</td>
            <td><strong>${escHtml(row.criteria_title || '')}</strong></td>
            <td>${renderStatusPill(row.criteria_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.criteria_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.evidence_hint || '')}<div class="muted">${escHtml(row.blocker_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.owner_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No release exit criteria rows loaded yet. Apply schema 140.</td></tr>';
      }
      if (e.paymentCloseoutActionBody) {
        const rows = Array.isArray(state.appPaymentCloseoutActionQueue) ? state.appPaymentCloseoutActionQueue : [];
        e.paymentCloseoutActionBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.payment_area || '')}</td>
            <td><strong>${escHtml(row.closeout_title || '')}</strong></td>
            <td>${renderStatusPill(row.closeout_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.closeout_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.source_rows_hint || '')}<div class="muted">${escHtml(row.decision_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.posting_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No payment closeout action rows loaded yet. Apply schema 140.</td></tr>';
      }
      if (e.reconciliationExceptionWorkflowBody) {
        const rows = Array.isArray(state.appReconciliationExceptionWorkflowQueue) ? state.appReconciliationExceptionWorkflowQueue : [];
        e.reconciliationExceptionWorkflowBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.reconciliation_area || '')}</td>
            <td><strong>${escHtml(row.workflow_title || '')}</strong></td>
            <td>${renderStatusPill(row.workflow_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.workflow_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.exception_hint || '')}<div class="muted">${escHtml(row.reviewer_action_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.undo_or_lock_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No reconciliation exception workflow rows loaded yet. Apply schema 140.</td></tr>';
      }
      if (e.equipmentChainOfCustodyBody) {
        const rows = Array.isArray(state.appEquipmentChainOfCustodyQueue) ? state.appEquipmentChainOfCustodyQueue : [];
        e.equipmentChainOfCustodyBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.custody_area || '')}</td>
            <td><strong>${escHtml(row.custody_title || '')}</strong></td>
            <td>${renderStatusPill(row.custody_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.custody_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.scan_or_signature_hint || '')}<div class="muted">${escHtml(row.verification_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.cost_or_service_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment chain-of-custody rows loaded yet. Apply schema 140.</td></tr>';
      }
      if (e.localSeoConversionBody) {
        const rows = Array.isArray(state.appLocalSeoConversionQueue) ? state.appLocalSeoConversionQueue : [];
        e.localSeoConversionBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.route_key || '')}<div class="muted">${escHtml(row.conversion_area || '')}</div></td>
            <td><strong>${escHtml(row.conversion_title || '')}</strong></td>
            <td>${renderStatusPill(row.conversion_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.conversion_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.search_term_hint || '')}<div class="muted">${escHtml(row.conversion_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.proof_or_link_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No local SEO conversion rows loaded yet. Apply schema 140.</td></tr>';
      }
      if (e.runtimeFallbackEscalationBody) {
        const rows = Array.isArray(state.appRuntimeFallbackEscalationQueue) ? state.appRuntimeFallbackEscalationQueue : [];
        e.runtimeFallbackEscalationBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.app_surface || '')}</td>
            <td><strong>${escHtml(row.escalation_title || '')}</strong></td>
            <td>${renderStatusPill(row.escalation_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.escalation_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.detection_hint || '')}<div class="muted">${escHtml(row.user_message_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.escalation_action_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No runtime fallback escalation rows loaded yet. Apply schema 140.</td></tr>';
      }


      if (e.releaseHandoffBody) {
        const rows = Array.isArray(state.appReleaseHandoffQueue) ? state.appReleaseHandoffQueue : [];
        e.releaseHandoffBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.handoff_area || '')}</td>
            <td><strong>${escHtml(row.handoff_title || '')}</strong></td>
            <td>${renderStatusPill(row.handoff_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.handoff_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.release_evidence_hint || '')}<div class="muted">${escHtml(row.deploy_action_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.rollback_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No release handoff rows loaded yet. Apply schema 141.</td></tr>';
      }
      if (e.paymentPostingProof2Body) {
        const rows = Array.isArray(state.appPaymentPostingProofQueue) ? state.appPaymentPostingProofQueue : [];
        e.paymentPostingProof2Body.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.payment_area || '')}</td>
            <td><strong>${escHtml(row.proof_title || '')}</strong></td>
            <td>${renderStatusPill(row.proof_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.proof_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.source_rows_hint || '')}<div class="muted">${escHtml(row.proof_required_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.posting_or_close_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No payment posting proof rows loaded yet. Apply schema 141.</td></tr>';
      }
      if (e.equipmentCustodyEvidenceBody) {
        const rows = Array.isArray(state.appEquipmentCustodyEvidenceQueue) ? state.appEquipmentCustodyEvidenceQueue : [];
        e.equipmentCustodyEvidenceBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.custody_area || '')}</td>
            <td><strong>${escHtml(row.evidence_title || '')}</strong></td>
            <td>${renderStatusPill(row.evidence_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.evidence_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.required_scan_or_signature || '')}<div class="muted">${escHtml(row.required_photo_or_note || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.accounting_or_service_link || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No equipment custody evidence rows loaded yet. Apply schema 141.</td></tr>';
      }
      if (e.seoConversionEvidenceBody) {
        const rows = Array.isArray(state.appSeoConversionEvidenceQueue) ? state.appSeoConversionEvidenceQueue : [];
        e.seoConversionEvidenceBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.route_key || '')}<div class="muted">${escHtml(row.evidence_area || '')}</div></td>
            <td><strong>${escHtml(row.evidence_title || '')}</strong></td>
            <td>${renderStatusPill(row.evidence_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.evidence_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.search_phrase_hint || '')}<div class="muted">${escHtml(row.page_evidence_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.conversion_path_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No SEO conversion evidence rows loaded yet. Apply schema 141.</td></tr>';
      }
      if (e.runtimeFallbackEventLogBody) {
        const rows = Array.isArray(state.appRuntimeFallbackEventLogQueue) ? state.appRuntimeFallbackEventLogQueue : [];
        e.runtimeFallbackEventLogBody.innerHTML = rows.slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row.app_surface || '')}</td>
            <td><strong>${escHtml(row.event_title || '')}</strong></td>
            <td>${renderStatusPill(row.event_status || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row.event_status || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row.detection_hint || '')}<div class="muted">${escHtml(row.log_payload_hint || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.owner_action_hint || '')}<div class="muted">${escHtml(row.fallback_hint || '')}</div></td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No runtime fallback event log rows loaded yet. Apply schema 141.</td></tr>';
      }

      const renderSchema142Rows = (body, rows, emptyText, cols) => {
        if (!body) return;
        body.innerHTML = (Array.isArray(rows) ? rows : []).slice(0, 100).map((row) => `
          <tr>
            <td>${escHtml(row[cols.area] || '')}${cols.subArea ? `<div class="muted">${escHtml(row[cols.subArea] || '')}</div>` : ''}</td>
            <td><strong>${escHtml(row[cols.title] || '')}</strong></td>
            <td>${renderStatusPill(row[cols.status] || 'planned', /pass|covered|ready|done|completed|in_progress/i.test(String(row[cols.status] || '')) ? 'ok' : 'warning')}</td>
            <td class="admin-table-note">${escHtml(row[cols.primary] || '')}<div class="muted">${escHtml(row[cols.secondary] || '')}</div></td>
            <td class="admin-table-note">${escHtml(row.fallback_hint || '')}</td>
          </tr>
        `).join('') || `<tr><td colspan="5" class="muted">${escHtml(emptyText)}</td></tr>`;
      };
      renderSchema142Rows(e.schemaDeployRepairBody, state.appSchemaDeployRepairQueue, 'No schema 142 repair rows loaded yet. Apply schema 142.', { area: 'repair_area', title: 'repair_title', status: 'repair_status', primary: 'repair_action_hint', secondary: 'verification_hint' });
      renderSchema142Rows(e.paymentReconciliationProofCloseoutBody, state.appPaymentReconciliationProofCloseoutQueue, 'No schema 142 payment/reconciliation proof closeout rows loaded yet. Apply schema 142.', { area: 'closeout_area', title: 'closeout_title', status: 'closeout_status', primary: 'approval_hint', secondary: 'posting_or_export_hint' });
      renderSchema142Rows(e.equipmentReturnExceptionActionBody, state.appEquipmentReturnExceptionActionQueue, 'No schema 142 equipment return exception rows loaded yet. Apply schema 142.', { area: 'exception_area', title: 'action_title', status: 'action_status', primary: 'decision_hint', secondary: 'service_or_cost_hint' });
      renderSchema142Rows(e.localSearchProminenceEvidenceBody, state.appLocalSearchProminenceEvidenceQueue, 'No schema 142 local-search prominence evidence rows loaded yet. Apply schema 142.', { area: 'prominence_area', subArea: 'route_key', title: 'evidence_title', status: 'evidence_status', primary: 'page_signal_hint', secondary: 'conversion_signal_hint' });
      renderSchema142Rows(e.runtimeFallbackObservabilityBody, state.appRuntimeFallbackObservabilityQueue, 'No schema 142 runtime fallback observability rows loaded yet. Apply schema 142.', { area: 'app_surface', title: 'observability_title', status: 'observability_status', primary: 'logging_hint', secondary: 'review_hint' });
      renderSchema142Rows(e.jsonDbSourceMigrationBody, state.appJsonDbSourceMigrationQueue, 'No schema 142 JSON/DB source migration rows loaded yet. Apply schema 142.', { area: 'source_area', title: 'migration_title', status: 'migration_status', primary: 'target_source_hint', secondary: 'validation_hint' });

      if (e.seoSmokeBody) {
        const seoRows = Array.isArray(state.publicSeoSmokeCheck) ? state.publicSeoSmokeCheck : [];
        e.seoSmokeBody.innerHTML = seoRows.slice(0, 80).map((row) => `
          <tr>
            <td>${escHtml(row.page_path || '')}</td>
            <td>${escHtml(row.page_title || '')}</td>
            <td>${escHtml(row.h1_count ?? '')}</td>
            <td>${row.local_terms_present ? 'Yes' : 'No'}</td>
            <td>${row.meta_description_present ? 'Yes' : 'No'}</td>
            <td>${escHtml(row.broken_asset_count ?? '')}</td>
            <td>${renderStatusPill(row.check_status || 'review', /fail/i.test(String(row.check_status || '')) ? 'error' : (/warn|review/i.test(String(row.check_status || '')) ? 'warning' : 'ok'))}</td>
          </tr>
        `).join('') || '<tr><td colspan="7" class="muted">No SEO smoke rows loaded yet. Apply schema 108.</td></tr>';
      }
      if (e.bankCsvImportBody) {
        const rows = Array.isArray(state.bankCsvImportSessions) ? state.bankCsvImportSessions : [];
        e.bankCsvImportBody.innerHTML = rows.slice(0, 40).map((row) => `
          <tr>
            <td>${renderStatusPill(row.import_status || 'draft', /complete|accepted/i.test(String(row.import_status || '')) ? 'ok' : 'warning')}</td>
            <td><strong>${escHtml(row.file_name || 'Bank CSV import')}</strong><div class="muted">${escHtml(row.bank_account_name || '')}</div></td>
            <td>${escHtml(String(row.total_row_count ?? 0))} total / ${escHtml(String(row.accepted_row_count ?? 0))} accepted</td>
            <td>${escHtml(String(row.duplicate_row_count ?? 0))}</td>
            <td>${escHtml(row.updated_at || row.created_at || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No bank CSV import sessions have been staged yet.</td></tr>';
      }
      if (e.backupRehearsalBody) {
        const rows = Array.isArray(state.adminBackupRestoreRehearsals) ? state.adminBackupRestoreRehearsals : [];
        e.backupRehearsalBody.innerHTML = rows.slice(0, 40).map((row) => `
          <tr>
            <td>${renderStatusPill(row.rehearsal_status || 'planned', /pass|complete/i.test(String(row.rehearsal_status || '')) ? 'ok' : 'warning')}</td>
            <td><strong>${escHtml(row.rehearsal_name || '')}</strong><div class="muted">${escHtml(row.rehearsal_scope || '')}</div></td>
            <td>${escHtml(row.operator_name || '')}</td>
            <td>${escHtml(row.result_summary || '')}</td>
            <td>${escHtml(row.next_action || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No backup/restore rehearsal rows loaded yet.</td></tr>';
      }
      if (e.mobileActionCardBody) {
        const rows = Array.isArray(state.adminMobileActionCards) ? state.adminMobileActionCards : [];
        e.mobileActionCardBody.innerHTML = rows.slice(0, 60).map((row) => `
          <tr>
            <td>${escHtml(row.role_key || '')}</td>
            <td><strong>${escHtml(row.card_title || '')}</strong><div class="muted">${escHtml(row.card_detail || '')}</div></td>
            <td>${escHtml(String(row.priority_rank ?? ''))}</td>
            <td>${renderStatusPill(row.card_status || 'review', /ready|active/i.test(String(row.card_status || '')) ? 'ok' : 'warning')}</td>
            <td>${escHtml(row.route_hint || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No mobile action cards loaded yet.</td></tr>';
        const todayRows = (Array.isArray(state.mobileTodayActionRegistry) ? state.mobileTodayActionRegistry : []).map((row) => `
          <tr>
            <td>${escHtml(row.required_role || 'employee')}</td>
            <td><strong>${escHtml(row.action_title || '')}</strong><div class="muted">${escHtml(row.action_detail || row.mobile_hint || '')}</div></td>
            <td>${escHtml(String(row.priority_rank ?? ''))}</td>
            <td>${renderStatusPill(row.action_status || 'review', /active|ready|pass/i.test(String(row.action_status || '')) ? 'ok' : 'warning')}</td>
            <td>${escHtml(row.route_hint || '')}</td>
          </tr>
        `).join('');
        const pwaRows = (Array.isArray(state.mobilePwaInstallQualityGates) ? state.mobilePwaInstallQualityGates : []).map((row) => `
          <tr>
            <td>PWA</td>
            <td><strong>${escHtml(row.gate_title || '')}</strong><div class="muted">${escHtml(row.test_hint || '')}</div></td>
            <td>${escHtml(String(row.sort_order ?? ''))}</td>
            <td>${renderStatusPill(row.gate_status || 'review', /pass|ready|active/i.test(String(row.gate_status || '')) ? 'ok' : 'warning')}</td>
            <td>${escHtml(row.platform_hint || '')}</td>
          </tr>
        `).join('');
        const mobileGateRows = (Array.isArray(state.mobileFirstQualityGates) ? state.mobileFirstQualityGates : []).map((row) => `
          <tr>
            <td>mobile</td>
            <td><strong>${escHtml(row.gate_title || '')}</strong><div class="muted">${escHtml(row.test_hint || '')}</div></td>
            <td>${escHtml(String(row.sort_order ?? ''))}</td>
            <td>${renderStatusPill(row.gate_status || 'review', /pass|ready|active/i.test(String(row.gate_status || '')) ? 'ok' : 'warning')}</td>
            <td>${escHtml(row.route_hint || '')}</td>
          </tr>
        `).join('');
        const formStepperRows = (Array.isArray(state.mobileFormStepperRegistry) ? state.mobileFormStepperRegistry : []).map((row) => `
          <tr>
            <td>form</td>
            <td><strong>${escHtml(row.form_title || row.form_key || '')}</strong><div class="muted">${escHtml(Array.isArray(row.step_labels) ? row.step_labels.join(' → ') : (row.offline_hint || ''))}</div></td>
            <td>${escHtml(String(row.sort_order ?? ''))}</td>
            <td>${renderStatusPill(row.quality_status || 'review', /pass|ready|active/i.test(String(row.quality_status || '')) ? 'ok' : 'warning')}</td>
            <td>${escHtml(row.route_hint || '')}</td>
          </tr>
        `).join('');
        const formGateRows = (Array.isArray(state.mobileFormQualityGates) ? state.mobileFormQualityGates : []).map((row) => `
          <tr>
            <td>form gate</td>
            <td><strong>${escHtml(row.gate_title || '')}</strong><div class="muted">${escHtml(row.test_hint || '')}</div></td>
            <td>${escHtml(String(row.sort_order ?? ''))}</td>
            <td>${renderStatusPill(row.gate_status || 'review', /pass|ready|active/i.test(String(row.gate_status || '')) ? 'ok' : 'warning')}</td>
            <td>${escHtml(row.route_hint || '')}</td>
          </tr>
        `).join('');
        const wordingRows = (Array.isArray(state.jurisdictionWordingGates) ? state.jurisdictionWordingGates : []).map((row) => `
          <tr>
            <td>Ontario</td>
            <td><strong>${escHtml(row.gate_title || '')}</strong><div class="muted">Use: ${escHtml(row.preferred_terms || '')}</div></td>
            <td>${escHtml(String(row.sort_order ?? ''))}</td>
            <td>${renderStatusPill(row.gate_status || 'review', /pass|ready|active/i.test(String(row.gate_status || '')) ? 'ok' : 'warning')}</td>
            <td>${escHtml(row.route_hint || '')}</td>
          </tr>
        `).join('');
        if (todayRows || pwaRows || mobileGateRows || formStepperRows || formGateRows || wordingRows) e.mobileActionCardBody.insertAdjacentHTML('beforeend', todayRows + pwaRows + mobileGateRows + formStepperRows + formGateRows + wordingRows);
      }
      if (e.auditLogBody) {
        const rows = Array.isArray(state.adminAuditEventDirectory) ? state.adminAuditEventDirectory : [];
        e.auditLogBody.innerHTML = rows.slice(0, 60).map((row) => `
          <tr>
            <td>${escHtml(row.occurred_at || '')}</td>
            <td>${escHtml(row.actor_name || row.actor_email || '')}</td>
            <td>${escHtml(row.event_action || '')}</td>
            <td>${escHtml(row.entity_type || '')}${row.entity_id ? `<div class="muted">${escHtml(row.entity_id)}</div>` : ''}</td>
            <td class="admin-table-note">${escHtml(row.event_summary || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5" class="muted">No audit events loaded yet.</td></tr>';
      }
    }

    function handleAdminCommandClick(event) {
      const btn = event.target.closest('[data-admin-command-route],[data-admin-command-entity],[data-admin-command-section]');
      if (!btn) return;
      const section = btn.getAttribute('data-admin-command-section') || '';
      const route = btn.getAttribute('data-admin-command-route') || '';
      const entity = btn.getAttribute('data-admin-command-entity') || '';
      if (section) applyAdminSectionFilter(section);
      if (section === 'health') document.querySelector('[data-admin-panel-title=\"App Health and Schema Center\"]')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      if (section === 'accounting') document.querySelector('[data-admin-panel-title=\"Guided Close Center\"]')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      if (section === 'safety') document.querySelector('[data-admin-panel-title=\"Evidence Manager\"]')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      if (entity) focusAdminHubEntity(entity, { summary: `Focused ${entity.replaceAll('_', ' ')} from the Admin Command Center.` });
      if (route && route !== 'admin') window.YWIRouter?.showSection?.(route);
    }

    function renderOperationsDashboardCards() {
      const e = els();
      if (!e.opsDashboardCards) return;
      const summary = Array.isArray(state.operationsDashboardSummary) ? state.operationsDashboardSummary[0] : null;
      const payrollClose = Array.isArray(state.payrollCloseReviewSummary) ? state.payrollCloseReviewSummary[0] : null;
      const reviewSummary = Array.isArray(state.employeeTimeReviewSummary) ? state.employeeTimeReviewSummary[0] : null;
      const cards = summary ? [
        ['Active Crews', summary.active_crews_on_site_count],
        ['Active Staff', summary.active_staff_on_site_count],
        ['Overdue Sign-outs', summary.overdue_sign_out_count],
        ['Unsigned Sessions', summary.unsigned_session_job_count],
        ['Delayed Jobs', summary.delayed_job_count],
        ['Loss-making Jobs', summary.loss_making_job_count],
        ['Attendance Reviews', reviewSummary?.needs_review_count || payrollClose?.attendance_review_needed_count || 0],
        ['Unexported Payroll Hrs', payrollClose?.unexported_hours_total || 0],
      ] : [];
      e.opsDashboardCards.innerHTML = cards.map(([label, value]) => `<div class="admin-stat-card"><span>${escHtml(label)}</span><strong>${escHtml(String(value ?? 0))}</strong></div>`).join('') || '<div class="muted">No dashboard summary available yet.</div>';
    }

    function mapActivityEntityToBackbone(entityType = '') {
      const clean = String(entityType || '').trim().toLowerCase();
      const map = {
        profile: 'profile',
        job: 'work_order',
        equipment_master: 'equipment_master',
        recurring_service_agreement: 'recurring_service_agreement',
        service_contract_document: 'service_contract_document',
        payroll_export_run: 'payroll_export_run',
        employee_time_entry: 'employee_time_entry',
        employee_time_entry_review: 'employee_time_entry_review',
        linked_hse_packet: 'linked_hse_packet',
        hse_packet_proof: 'hse_packet_proof',
        route_stop_execution_attachment: 'route_stop_execution_attachment',
        warranty_callback_event: 'warranty_callback_event',
      };
      return map[clean] || '';
    }

    function renderActivityRollups() {
      const e = els();
      if (!e.siteActivityRollups) return;
      const entityRows = (Array.isArray(state.siteActivityEntityRollups) ? state.siteActivityEntityRollups : []).slice(0, 4);
      const typeRows = (Array.isArray(state.siteActivityTypeRollups) ? state.siteActivityTypeRollups : []).slice(0, 4);
      const cards = [];
      for (const row of entityRows) {
        cards.push(`<button class="admin-stat-card admin-activity-drill" type="button" data-drill-kind="entity" data-entity-type="${escHtml(row.entity_type || '')}"><span>${escHtml(String(row.entity_type || '').replaceAll('_', ' '))}</span><strong>${escHtml(String(row.last_24h_event_count || 0))}</strong></button>`);
      }
      for (const row of typeRows) {
        cards.push(`<button class="admin-stat-card admin-activity-drill" type="button" data-drill-kind="type" data-event-type="${escHtml(row.event_type || '')}" data-entity-type="${escHtml(row.entity_type || '')}"><span>${escHtml(String(row.event_type || '').replaceAll('_', ' '))}</span><strong>${escHtml(String(row.last_24h_event_count || 0))}</strong></button>`);
      }
      e.siteActivityRollups.innerHTML = cards.join('') || '<div class="muted">No activity rollups yet.</div>';
    }

    function renderEvidenceReviewStatus(row) {
      const status = String(row?.review_status || 'pending').replaceAll('_', ' ');
      const note = row?.review_notes ? ` · ${row.review_notes}` : '';
      const reviewer = row?.reviewed_by_name ? ` · ${row.reviewed_by_name}` : '';
      return `<div><strong>${escHtml(status)}</strong></div><small class="muted">${escHtml(`${row?.reviewed_at || 'Awaiting review'}${reviewer}${note}`)}</small>`;
    }

    function renderEvidenceReviewActions(entity, row) {
      const id = entity === 'employee_time_entry' ? row.time_entry_id : row.proof_id;
      const mediaStage = entity === 'employee_time_entry' ? row.photo_stage : row.proof_stage;
      const openLink = entity === 'employee_time_entry' ? row.photo_url : row.public_url;
      return `
        <div class="table-actions evidence-review-actions">
          ${openLink ? `<a href="${escHtml(openLink)}" target="_blank" rel="noopener">Open</a>` : '<span class="muted">No file</span>'}
          <button type="button" class="secondary evidence-review-btn" data-review-entity="${escHtml(entity)}" data-review-id="${escHtml(id || '')}" data-review-stage="${escHtml(mediaStage || '')}" data-review-status="approved">Approve</button>
          <button type="button" class="secondary evidence-review-btn" data-review-entity="${escHtml(entity)}" data-review-id="${escHtml(id || '')}" data-review-stage="${escHtml(mediaStage || '')}" data-review-status="rejected">Reject</button>
          <button type="button" class="secondary evidence-review-btn" data-review-entity="${escHtml(entity)}" data-review-id="${escHtml(id || '')}" data-review-stage="${escHtml(mediaStage || '')}" data-review-status="follow_up">Follow Up</button>
        </div>`;
    }

    function renderEvidenceReview() {
      const e = els();
      const attendance = (Array.isArray(state.attendancePhotoReview) ? state.attendancePhotoReview : []).slice(0, 8);
      const hse = (Array.isArray(state.hseEvidenceReview) ? state.hseEvidenceReview : []).slice(0, 8);
      if (e.attendanceEvidenceBody) {
        e.attendanceEvidenceBody.innerHTML = attendance.map((row) => `
          <tr data-evidence-entity="employee_time_entry" data-evidence-id="${escHtml(row.time_entry_id || '')}">
            <td>${escHtml(row.uploaded_at || '')}</td>
            <td>${escHtml(row.full_name || '')}</td>
            <td>${escHtml(row.job_code || row.job_name || '')}</td>
            <td>${escHtml(String(row.photo_stage || '').replaceAll('_', ' '))}</td>
            <td>${escHtml(String(row.geofence_status || 'not_checked').replaceAll('_', ' '))}${row.geofence_distance_meters != null ? ` · ${escHtml(String(row.geofence_distance_meters))}m` : ''}</td>
            <td>${renderEvidenceReviewStatus(row)}</td>
            <td>${renderEvidenceReviewActions('employee_time_entry', row)}</td>
          </tr>
        `).join('') || '<tr><td colspan="7" class="muted">No attendance evidence loaded yet.</td></tr>';
      }
      if (e.hseEvidenceBody) {
        e.hseEvidenceBody.innerHTML = hse.map((row) => `
          <tr data-evidence-entity="hse_packet_proof" data-evidence-id="${escHtml(row.proof_id || '')}">
            <td>${escHtml(row.created_at || '')}</td>
            <td>${escHtml(row.packet_number || '')}</td>
            <td>${escHtml(String(row.proof_stage || '').replaceAll('_', ' '))}</td>
            <td>${escHtml(String(row.proof_kind || '').replaceAll('_', ' '))}</td>
            <td>${escHtml(row.caption || row.proof_notes || '')}</td>
            <td>${renderEvidenceReviewStatus(row)}</td>
            <td>${renderEvidenceReviewActions('hse_packet_proof', row)}</td>
          </tr>
        `).join('') || '<tr><td colspan="7" class="muted">No HSE proof items loaded yet.</td></tr>';
      }
      if (e.evidenceSummary) {
        const attendanceFlags = attendance.filter((row) => row?.needs_review || ['outside','override'].includes(String(row.geofence_status || '').toLowerCase())).length;
        const hseFlags = hse.filter((row) => row?.needs_review).length;
        e.evidenceSummary.textContent = `Attendance evidence: ${attendance.length} row(s), ${attendanceFlags} needing review. HSE evidence: ${hse.length} row(s), ${hseFlags} needing review.`;
        e.evidenceSummary.dataset.kind = attendanceFlags || hseFlags ? 'warning' : 'info';
      }
    }

    function renderSiteActivityTable() {
      renderOperationsDashboardCards();
      renderActivityRollups();
      renderEvidenceReview();
      const e = els();
      if (!e.siteActivityBody) return;
      const rows = Array.isArray(state.siteActivityEvents) ? state.siteActivityEvents : [];
      e.siteActivityBody.innerHTML = rows.map((item) => `
        <tr data-activity-entity-type="${escHtml(item.entity_type || '')}" data-activity-entity-id="${escHtml(item.entity_id || '')}">
          <td>${escHtml(item.occurred_at || item.created_at || '')}</td>
          <td>${escHtml(String(item.event_type || '').replaceAll('_', ' '))}</td>
          <td><strong>${escHtml(item.title || '')}</strong></td>
          <td>${escHtml(item.created_by_name || '')}</td>
          <td>${escHtml(item.summary || '')}</td>
        </tr>
      `).join('') || '<tr><td colspan="5" class="muted">No recent site activity yet.</td></tr>';
      if (e.siteActivitySummary) {
        const summary = Array.isArray(state.siteActivitySummary) ? state.siteActivitySummary[0] : null;
        const timeSummary = Array.isArray(state.employeeTimeClockSummary) ? state.employeeTimeClockSummary[0] : null;
        const topTypes = (Array.isArray(state.siteActivityTypeRollups) ? state.siteActivityTypeRollups : [])
          .filter((item) => Number(item.last_24h_event_count || 0) > 0)
          .slice(0, 3)
          .map((item) => `${String(item.event_type || '').replaceAll('_', ' ')} ${Number(item.last_24h_event_count || 0)}`)
          .join(' · ');
        e.siteActivitySummary.textContent = summary
          ? `Last 24 hours: ${Number(summary.last_24h_event_count || 0)} event(s), ${Number(summary.last_24h_job_created_count || 0)} job(s), ${Number(summary.last_24h_staff_created_count || 0)} staff record(s), ${Number(summary.last_24h_equipment_created_count || 0)} equipment item(s), ${Number(timeSummary?.last_24h_clock_in_count || 0)} clock-in(s), ${Number(timeSummary?.currently_clocked_in_count || 0)} active on-site, ${Number((state.operationsDashboardSummary?.[0] || {}).overdue_sign_out_count || 0)} overdue sign-out(s)${topTypes ? `. Top activity: ${topTypes}.` : ''}`
          : (rows.length ? `Loaded ${rows.length} recent site activity item(s).` : 'No recent site activity yet.');
        e.siteActivitySummary.dataset.kind = summary && Number(summary.last_24h_attention_count || 0) > 0 ? 'warning' : 'info';
      }
    }

    function handleActivityDrillClick(event) {
      const btn = event.target.closest('.admin-activity-drill');
      if (btn) {
        const entityType = btn.getAttribute('data-entity-type') || '';
        const targetEntity = mapActivityEntityToBackbone(entityType);
        if (targetEntity) {
          focusAdminHubEntity(targetEntity, { summary: `Focused ${String(entityType || '').replaceAll('_', ' ')} from activity rollup.` });
        }
        return;
      }
      const tr = event.target.closest('[data-activity-entity-type]');
      if (!tr) return;
      const entityType = tr.getAttribute('data-activity-entity-type') || '';
      const entityId = tr.getAttribute('data-activity-entity-id') || '';
      const targetEntity = mapActivityEntityToBackbone(entityType);
      if (targetEntity) {
        focusAdminHubEntity(targetEntity, { preferredId: entityId, summary: `Focused ${String(entityType || '').replaceAll('_', ' ')} from recent activity.` });
      }
    }

    async function handleEvidenceDrillClick(event) {
      const reviewBtn = event.target.closest('.evidence-review-btn');
      if (reviewBtn) {
        event.preventDefault();
        event.stopPropagation();
        const entity = reviewBtn.getAttribute('data-review-entity') || '';
        const id = reviewBtn.getAttribute('data-review-id') || '';
        const mediaStage = reviewBtn.getAttribute('data-review-stage') || '';
        const reviewStatus = reviewBtn.getAttribute('data-review-status') || 'pending';
        const needsNote = ['rejected', 'follow_up'].includes(String(reviewStatus || '').toLowerCase());
        const defaultNote = reviewStatus === 'follow_up' ? 'Needs follow-up review.' : (reviewStatus === 'rejected' ? 'Reason for rejection.' : '');
        const reviewNotes = window.prompt(`${needsNote ? 'Required' : 'Optional'} note for ${reviewStatus.replaceAll('_', ' ')} on ${mediaStage.replaceAll('_', ' ')}:`, defaultNote) || '';
        if (needsNote && !String(reviewNotes || '').trim()) {
          setSummary(`A note is required when evidence is marked ${reviewStatus.replaceAll('_', ' ')}.`, true);
          return;
        }
        try {
          const actionEntity = entity === 'employee_time_entry' ? 'employee_time_entry' : 'hse_packet_proof';
          const resp = await manageAdminEntity({ entity: actionEntity, action: 'review_media', item_id: id, media_stage: mediaStage, review_status: reviewStatus, review_notes: reviewNotes });
          if (!resp?.ok) throw new Error(resp?.error || 'Evidence review update failed.');
          await loadDirectory();
          await refreshSelectors();
          setSummary(`Evidence marked ${reviewStatus.replaceAll('_', ' ')}.`);
        } catch (err) {
          setSummary(err?.message || 'Unable to update evidence review.', true);
        }
        return;
      }
      if (event.target.closest('a')) return;
      const tr = event.target.closest('[data-evidence-entity]');
      if (!tr) return;
      const entity = tr.getAttribute('data-evidence-entity') || '';
      const id = tr.getAttribute('data-evidence-id') || '';
      if (entity) focusAdminHubEntity(entity, { preferredId: id, summary: `Focused ${entity.replaceAll('_', ' ')} from evidence review.` });
    }

    function renderConflictTable() {
      const e = els();
      if (!e.conflictBody) return;
      const summary = window.YWIOutbox?.getActionSummary?.('admin') || { items: [], conflicts: 0, total: 0 };
      const rows = Array.isArray(summary.items) ? summary.items.filter((item) => item.status === 'conflict' || Number(item.merge_count || 0) > 0) : [];
      e.conflictBody.innerHTML = rows.map((item) => `
        <tr>
          <td>${escHtml(item.updated_at || item.queued_at || '')}</td>
          <td>${escHtml(item.label || item.action_type || '')}</td>
          <td>${escHtml(item.status || 'pending')}</td>
          <td><pre class="code-block" style="max-width:280px;white-space:pre-wrap;">${escHtml(JSON.stringify(item.payload || {}, null, 2))}</pre></td>
          <td><div>${escHtml(item.error || 'Merged local change pending review.')}</div>${Array.isArray(item.conflict_details) && item.conflict_details.length ? `<ul>${item.conflict_details.map((detail) => `<li>${escHtml(detail)}</li>`).join('')}</ul>` : ''}</td>
          <td>
            <div class="table-actions" style="display:flex;flex-wrap:wrap;gap:6px;">
              <button class="secondary" data-conflict-action="retry" data-id="${escHtml(item.id)}">Retry</button>
              <button class="secondary" data-conflict-action="keep_local" data-id="${escHtml(item.id)}">Keep Local</button>
              <button class="secondary" data-conflict-action="discard" data-id="${escHtml(item.id)}">Discard</button>
            </div>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="6" class="muted">No admin conflicts are waiting for review.</td></tr>';
      setSummary(rows.length ? `Conflict review shows ${rows.length} admin item(s) needing attention.` : 'No admin conflicts are waiting for review.');
      if (e.conflictSummary) {
        e.conflictSummary.style.display = 'block';
        e.conflictSummary.dataset.kind = rows.length ? 'error' : 'info';
        e.conflictSummary.textContent = rows.length
          ? `${rows.length} queued admin item(s) need review before the next retry.`
          : 'No admin conflicts are waiting for review.';
      }
    }

    async function handleConflictClick(event) {
      const btn = event.target.closest('[data-conflict-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-conflict-action');
      const id = btn.getAttribute('data-id');
      if (!id) return;
      try {
        if (action === 'discard') {
          window.YWIOutbox?.removeActionItem?.(id);
          renderConflictTable();
          return;
        }
        if (action === 'keep_local') {
          window.YWIOutbox?.resolveActionConflict?.(id, { status: 'pending', error: '' });
          renderConflictTable();
          return;
        }
        if (action === 'retry') {
          const item = window.YWIOutbox?.getActionItem?.(id);
          if (!item) throw new Error('Queued item was not found.');
          await retryQueuedActions({ scope: 'admin', handlers: { admin_notification_action: (payload) => manageAdminEntity(payload) } });
          renderConflictTable();
        }
      } catch (err) {
        setSummary(err?.message || 'Unable to update the conflict item.', true);
      }
    }

    function bind() {
      const e = els();

      ['emailTo', 'emailSubject', 'emailBody'].forEach((key) => {
        const field = e[key];
        if (field && field.dataset.boundDraft !== '1') {
          field.dataset.boundDraft = '1';
          field.addEventListener('input', saveDraft);
        }
      });

      if (e.commandCenter && e.commandCenter.dataset.bound !== '1') {
        e.commandCenter.dataset.bound = '1';
        e.commandCenter.addEventListener('click', handleAdminCommandClick);
      }
      if (e.savedFilterSaveBtn && e.savedFilterSaveBtn.dataset.bound !== '1') {
        e.savedFilterSaveBtn.dataset.bound = '1';
        e.savedFilterSaveBtn.addEventListener('click', () => saveCurrentAdminFilter().catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.savedFilterCards && e.savedFilterCards.dataset.bound !== '1') {
        e.savedFilterCards.dataset.bound = '1';
        e.savedFilterCards.addEventListener('click', (event) => handleSavedFilterClick(event).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.savedFilterBody && e.savedFilterBody.dataset.bound !== '1') {
        e.savedFilterBody.dataset.bound = '1';
        e.savedFilterBody.addEventListener('click', (event) => handleSavedFilterClick(event).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.healthBody && e.healthBody.dataset.boundHealth !== '1') {
        e.healthBody.dataset.boundHealth = '1';
        e.healthBody.addEventListener('click', (event) => handleAdminHealthAction(event).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.readinessBody && e.readinessBody.dataset.boundReadiness !== '1') {
        e.readinessBody.dataset.boundReadiness = '1';
        e.readinessBody.addEventListener('click', (event) => handleReadinessAction(event).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.deploymentGateBody && e.deploymentGateBody.dataset.boundGate !== '1') {
        e.deploymentGateBody.dataset.boundGate = '1';
        e.deploymentGateBody.addEventListener('click', (event) => handleReadinessAction(event).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.evidenceManagerBody && e.evidenceManagerBody.dataset.boundEvidence !== '1') {
        e.evidenceManagerBody.dataset.boundEvidence = '1';
        e.evidenceManagerBody.addEventListener('click', (event) => handleEvidenceManagerAction(event).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.commandRefreshPanel && e.commandRefreshPanel.dataset.bound !== '1') {
        e.commandRefreshPanel.dataset.bound = '1';
        e.commandRefreshPanel.addEventListener('click', () => refreshAdminPanelScope('command_center').catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.healthRefreshPanel && e.healthRefreshPanel.dataset.bound !== '1') {
        e.healthRefreshPanel.dataset.bound = '1';
        e.healthRefreshPanel.addEventListener('click', () => refreshAdminPanelScope('health').catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.accountingRefreshPanel && e.accountingRefreshPanel.dataset.bound !== '1') {
        e.accountingRefreshPanel.dataset.bound = '1';
        e.accountingRefreshPanel.addEventListener('click', () => refreshAdminPanelScope('accounting_close').catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.evidenceRefreshPanel && e.evidenceRefreshPanel.dataset.bound !== '1') {
        e.evidenceRefreshPanel.dataset.bound = '1';
        e.evidenceRefreshPanel.addEventListener('click', () => refreshAdminPanelScope('evidence').catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.clearDiagnosticsBtn && e.clearDiagnosticsBtn.dataset.bound !== '1') {
        e.clearDiagnosticsBtn.dataset.bound = '1';
        e.clearDiagnosticsBtn.addEventListener('click', () => {
          window.YWIAppDiagnostics?.clear?.();
          renderAdminHealthCenter();
          setSummary('Local diagnostics cleared. Live backend health rows will remain until resolved.');
        });
      }
      if (e.reloadBtn && e.reloadBtn.dataset.bound !== '1') {
        e.reloadBtn.dataset.bound = '1';
        e.reloadBtn.addEventListener('click', () => loadDirectory());
      }
      if (e.search && e.search.dataset.bound !== '1') {
        e.search.dataset.bound = '1';
        e.search.addEventListener('input', () => {
          saveDraft();
          renderNotifications();
        });
      }
      if (e.filterStatus && e.filterStatus.dataset.bound !== '1') {
        e.filterStatus.dataset.bound = '1';
        e.filterStatus.addEventListener('change', () => {
          saveDraft();
          renderNotifications();
        });
      }
      if (e.notificationsBody && e.notificationsBody.dataset.bound !== '1') {
        e.notificationsBody.dataset.bound = '1';
        e.notificationsBody.addEventListener('click', onNotificationTableClick);
      }
      if (e.previewBtn && e.previewBtn.dataset.bound !== '1') {
        e.previewBtn.dataset.bound = '1';
        e.previewBtn.addEventListener('click', () => onPreviewButton('preview_email'));
      }
      if (e.testSendBtn && e.testSendBtn.dataset.bound !== '1') {
        e.testSendBtn.dataset.bound = '1';
        e.testSendBtn.addEventListener('click', () => onPreviewButton('test_send'));
      }
      if (e.retryBtn && e.retryBtn.dataset.bound !== '1') {
        e.retryBtn.dataset.bound = '1';
        e.retryBtn.addEventListener('click', () => onPreviewButton('retry_send'));
      }
      if (e.staffProfileId && e.staffProfileId.dataset.bound !== '1') {
        e.staffProfileId.dataset.bound = '1';
        e.staffProfileId.addEventListener('change', () => fillStaffForm(getSelectedStaff()));
      }

      if (e.staffRefreshPanel && e.staffRefreshPanel.dataset.bound !== '1') {
        e.staffRefreshPanel.dataset.bound = '1';
        e.staffRefreshPanel.addEventListener('click', () => refreshAdminPanelScope('people').catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.staffApplyFilter && e.staffApplyFilter.dataset.bound !== '1') {
        e.staffApplyFilter.dataset.bound = '1';
        e.staffApplyFilter.addEventListener('click', () => applyStaffDirectoryFilter(true).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.staffSearch && e.staffSearch.dataset.bound !== '1') {
        e.staffSearch.dataset.bound = '1';
        e.staffSearch.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            applyStaffDirectoryFilter(true).catch((err) => setSummary(String(err?.message || err), true));
          }
        });
      }
      if (e.staffRoleFilter && e.staffRoleFilter.dataset.bound !== '1') {
        e.staffRoleFilter.dataset.bound = '1';
        e.staffRoleFilter.addEventListener('change', () => applyStaffDirectoryFilter(true).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.staffSort && e.staffSort.dataset.bound !== '1') {
        e.staffSort.dataset.bound = '1';
        e.staffSort.addEventListener('change', () => applyStaffDirectoryFilter(true).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.staffSortDir && e.staffSortDir.dataset.bound !== '1') {
        e.staffSortDir.dataset.bound = '1';
        e.staffSortDir.addEventListener('change', () => applyStaffDirectoryFilter(true).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.staffPageSize && e.staffPageSize.dataset.bound !== '1') {
        e.staffPageSize.dataset.bound = '1';
        e.staffPageSize.addEventListener('change', () => applyStaffDirectoryFilter(true).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.staffPrevPage && e.staffPrevPage.dataset.bound !== '1') {
        e.staffPrevPage.dataset.bound = '1';
        e.staffPrevPage.addEventListener('click', () => {
          state.directoryPagination.people.page = Math.max(1, (state.directoryPagination.people.page || 1) - 1);
          refreshAdminPanelScope('people').catch((err) => setSummary(String(err?.message || err), true));
        });
      }
      if (e.staffNextPage && e.staffNextPage.dataset.bound !== '1') {
        e.staffNextPage.dataset.bound = '1';
        e.staffNextPage.addEventListener('click', () => {
          const maxPage = state.directoryPagination.people.totalPages || 1;
          state.directoryPagination.people.page = Math.min(maxPage, (state.directoryPagination.people.page || 1) + 1);
          refreshAdminPanelScope('people').catch((err) => setSummary(String(err?.message || err), true));
        });
      }

      if (e.jobsRefreshPanel && e.jobsRefreshPanel.dataset.bound !== '1') {
        e.jobsRefreshPanel.dataset.bound = '1';
        e.jobsRefreshPanel.addEventListener('click', () => refreshAdminPanelScope('operations').catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.jobsReviewBody && e.jobsReviewBody.dataset.bound !== '1') {
        e.jobsReviewBody.dataset.bound = '1';
        e.jobsReviewBody.addEventListener('click', handleJobReviewAction);
      }
      if (e.jobsApplyFilter && e.jobsApplyFilter.dataset.bound !== '1') {
        e.jobsApplyFilter.dataset.bound = '1';
        e.jobsApplyFilter.addEventListener('click', () => applyJobsDirectoryFilter(true).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.jobsSearch && e.jobsSearch.dataset.bound !== '1') {
        e.jobsSearch.dataset.bound = '1';
        e.jobsSearch.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            applyJobsDirectoryFilter(true).catch((err) => setSummary(String(err?.message || err), true));
          }
        });
      }
      if (e.jobsSort && e.jobsSort.dataset.bound !== '1') {
        e.jobsSort.dataset.bound = '1';
        e.jobsSort.addEventListener('change', () => applyJobsDirectoryFilter(true).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.jobsSortDir && e.jobsSortDir.dataset.bound !== '1') {
        e.jobsSortDir.dataset.bound = '1';
        e.jobsSortDir.addEventListener('change', () => applyJobsDirectoryFilter(true).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.jobsPageSize && e.jobsPageSize.dataset.bound !== '1') {
        e.jobsPageSize.dataset.bound = '1';
        e.jobsPageSize.addEventListener('change', () => applyJobsDirectoryFilter(true).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.jobsPrevPage && e.jobsPrevPage.dataset.bound !== '1') {
        e.jobsPrevPage.dataset.bound = '1';
        e.jobsPrevPage.addEventListener('click', () => {
          state.directoryPagination.jobs.page = Math.max(1, (state.directoryPagination.jobs.page || 1) - 1);
          refreshAdminPanelScope('operations').catch((err) => setSummary(String(err?.message || err), true));
        });
      }
      if (e.jobsNextPage && e.jobsNextPage.dataset.bound !== '1') {
        e.jobsNextPage.dataset.bound = '1';
        e.jobsNextPage.addEventListener('click', () => {
          const maxPage = state.directoryPagination.jobs.totalPages || 1;
          state.directoryPagination.jobs.page = Math.min(maxPage, (state.directoryPagination.jobs.page || 1) + 1);
          refreshAdminPanelScope('operations').catch((err) => setSummary(String(err?.message || err), true));
        });
      }
      if (e.siteActivityBody && e.siteActivityBody.dataset.bound !== '1') {
        e.siteActivityBody.dataset.bound = '1';
        e.siteActivityBody.addEventListener('click', handleActivityDrillClick);
      }
      if (e.siteActivityRollups && e.siteActivityRollups.dataset.bound !== '1') {
        e.siteActivityRollups.dataset.bound = '1';
        e.siteActivityRollups.addEventListener('click', handleActivityDrillClick);
      }
      if (e.attendanceEvidenceBody && e.attendanceEvidenceBody.dataset.bound !== '1') {
        e.attendanceEvidenceBody.dataset.bound = '1';
        e.attendanceEvidenceBody.addEventListener('click', handleEvidenceDrillClick);
      }
      if (e.hseEvidenceBody && e.hseEvidenceBody.dataset.bound !== '1') {
        e.hseEvidenceBody.dataset.bound = '1';
        e.hseEvidenceBody.addEventListener('click', handleEvidenceDrillClick);
      }

      if (e.staffBody && e.staffBody.dataset.bound !== '1') {
        e.staffBody.dataset.bound = '1';
        e.staffBody.addEventListener('click', (event) => {
          const tr = event.target.closest('[data-staff-id]');
          if (!tr) return;
          if (e.staffProfileId) e.staffProfileId.value = tr.getAttribute('data-staff-id') || '';
          fillStaffForm(getSelectedStaff());
        });
      }
      if (e.staffCreateBtn && e.staffCreateBtn.dataset.bound !== '1') {
        e.staffCreateBtn.dataset.bound = '1';
        e.staffCreateBtn.addEventListener('click', () => createStaffUser().catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.staffSaveBtn && e.staffSaveBtn.dataset.bound !== '1') {
        e.staffSaveBtn.dataset.bound = '1';
        e.staffSaveBtn.addEventListener('click', () => saveStaffDetails().catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.staffResetBtn && e.staffResetBtn.dataset.bound !== '1') {
        e.staffResetBtn.dataset.bound = '1';
        e.staffResetBtn.addEventListener('click', () => sendStaffReset().catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.staffBlockBtn && e.staffBlockBtn.dataset.bound !== '1') {
        e.staffBlockBtn.dataset.bound = '1';
        e.staffBlockBtn.addEventListener('click', () => toggleStaffBlock().catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.staffDeleteBtn && e.staffDeleteBtn.dataset.bound !== '1') {
        e.staffDeleteBtn.dataset.bound = '1';
        e.staffDeleteBtn.addEventListener('click', () => deleteStaffUser().catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.assignmentId && e.assignmentId.dataset.bound !== '1') {
        e.assignmentId.dataset.bound = '1';
        e.assignmentId.addEventListener('change', () => fillAssignmentForm(getSelectedAssignment()));
      }
      if (e.assignmentsBody && e.assignmentsBody.dataset.bound !== '1') {
        e.assignmentsBody.dataset.bound = '1';
        e.assignmentsBody.addEventListener('click', (event) => {
          const tr = event.target.closest('[data-assignment-id]');
          if (!tr) return;
          if (e.assignmentId) e.assignmentId.value = tr.getAttribute('data-assignment-id') || '';
          fillAssignmentForm(getSelectedAssignment());
        });
      }
      if (e.assignmentCreateBtn && e.assignmentCreateBtn.dataset.bound !== '1') {
        e.assignmentCreateBtn.dataset.bound = '1';
        e.assignmentCreateBtn.addEventListener('click', () => saveAssignment(true).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.assignmentSaveBtn && e.assignmentSaveBtn.dataset.bound !== '1') {
        e.assignmentSaveBtn.dataset.bound = '1';
        e.assignmentSaveBtn.addEventListener('click', () => saveAssignment(false).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.assignmentDeleteBtn && e.assignmentDeleteBtn.dataset.bound !== '1') {
        e.assignmentDeleteBtn.dataset.bound = '1';
        e.assignmentDeleteBtn.addEventListener('click', () => deleteAssignment().catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.catalogType && e.catalogType.dataset.bound !== '1') {
        e.catalogType.dataset.bound = '1';
        e.catalogType.addEventListener('change', () => { fillCatalogForm(null); renderCatalogManager(); });
      }
      if (e.catalogItemId && e.catalogItemId.dataset.bound !== '1') {
        e.catalogItemId.dataset.bound = '1';
        e.catalogItemId.addEventListener('change', () => {
          const row = getCatalogRows(e.catalogType?.value || 'position').find((item) => String(item.id) === String(e.catalogItemId?.value || ''));
          fillCatalogForm(row || null);
        });
      }
      if (e.catalogBody && e.catalogBody.dataset.bound !== '1') {
        e.catalogBody.dataset.bound = '1';
        e.catalogBody.addEventListener('click', (event) => {
          const tr = event.target.closest('[data-catalog-id]');
          if (!tr) return;
          if (e.catalogItemId) e.catalogItemId.value = tr.getAttribute('data-catalog-id') || '';
          const row = getCatalogRows(e.catalogType?.value || 'position').find((item) => String(item.id) === String(e.catalogItemId?.value || ''));
          fillCatalogForm(row || null);
        });
      }
      if (e.catalogCreateBtn && e.catalogCreateBtn.dataset.bound !== '1') {
        e.catalogCreateBtn.dataset.bound = '1';
        e.catalogCreateBtn.addEventListener('click', () => saveCatalogItem(true).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.catalogSaveBtn && e.catalogSaveBtn.dataset.bound !== '1') {
        e.catalogSaveBtn.dataset.bound = '1';
        e.catalogSaveBtn.addEventListener('click', () => saveCatalogItem(false).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.catalogDeleteBtn && e.catalogDeleteBtn.dataset.bound !== '1') {
        e.catalogDeleteBtn.dataset.bound = '1';
        e.catalogDeleteBtn.addEventListener('click', () => deleteCatalogItem().catch((err) => setSummary(String(err?.message || err), true)));
      }

      if (e.backboneEntity && e.backboneEntity.dataset.bound !== '1') {
        e.backboneEntity.dataset.bound = '1';
        e.backboneEntity.addEventListener('change', () => { renderBackboneTable(); fillBackboneForm(null); });
      }
      if (e.backboneItemId && e.backboneItemId.dataset.bound !== '1') {
        e.backboneItemId.dataset.bound = '1';
        e.backboneItemId.addEventListener('change', () => fillBackboneForm(getSelectedBackboneRecord()));
      }
      if (e.backboneBody && e.backboneBody.dataset.bound !== '1') {
        e.backboneBody.dataset.bound = '1';
        e.backboneBody.addEventListener('click', (event) => {
          const tr = event.target.closest('[data-backbone-id]');
          if (!tr) return;
          if (e.backboneItemId) e.backboneItemId.value = tr.getAttribute('data-backbone-id') || '';
          fillBackboneForm(getSelectedBackboneRecord());
        });
      }
      if (e.backboneCreateBtn && e.backboneCreateBtn.dataset.bound !== '1') {
        e.backboneCreateBtn.dataset.bound = '1';
        e.backboneCreateBtn.addEventListener('click', () => saveBackboneItem(true).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.backboneSaveBtn && e.backboneSaveBtn.dataset.bound !== '1') {
        e.backboneSaveBtn.dataset.bound = '1';
        e.backboneSaveBtn.addEventListener('click', () => saveBackboneItem(false).catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.backboneDeleteBtn && e.backboneDeleteBtn.dataset.bound !== '1') {
        e.backboneDeleteBtn.dataset.bound = '1';
        e.backboneDeleteBtn.addEventListener('click', () => deleteBackboneItem().catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.backbonePostBtn && e.backbonePostBtn.dataset.bound !== '1') {
        e.backbonePostBtn.dataset.bound = '1';
        e.backbonePostBtn.addEventListener('click', () => postBackboneJournalBatch().catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.backboneGenerateBtn && e.backboneGenerateBtn.dataset.bound !== '1') {
        e.backboneGenerateBtn.dataset.bound = '1';
        e.backboneGenerateBtn.addEventListener('click', () => runBackboneGenerateAction().catch((err) => setSummary(String(err?.message || err), true)));
      }
      if (e.backboneDownloadBtn && e.backboneDownloadBtn.dataset.bound !== '1') {
        e.backboneDownloadBtn.dataset.bound = '1';
        e.backboneDownloadBtn.addEventListener('click', () => runBackboneDownloadAction().catch((err) => setSummary(String(err?.message || err), true)));
      }
      document.querySelectorAll('[data-admin-route]').forEach((btn) => {
        if (btn.dataset.boundRoute === '1') return;
        btn.dataset.boundRoute = '1';
        btn.addEventListener('click', () => window.YWIRouter?.showSection?.(btn.getAttribute('data-admin-route') || 'toolbox'));
      });
      document.querySelectorAll('[data-admin-focus-entity]').forEach((btn) => {
        if (btn.dataset.boundFocus === '1') return;
        btn.dataset.boundFocus = '1';
        btn.addEventListener('click', () => focusAdminHubEntity(btn.getAttribute('data-admin-focus-entity') || ''));
      });
      if (!document.body.dataset.adminFocusRequestBound) {
        document.body.dataset.adminFocusRequestBound = '1';
        document.addEventListener('ywi:admin-focus-request', (event) => {
          const entity = event?.detail?.entity || '';
          if (entity) {
            focusAdminHubEntity(entity, {
              preferredId: event?.detail?.preferredId || '',
              summary: event?.detail?.summary || '',
              targetEntity: event?.detail?.targetEntity || ''
            });
          }
        });
      }
      if (e.passwordForm && e.passwordForm.dataset.bound !== '1') {
        e.passwordForm.dataset.bound = '1';
        e.passwordForm.addEventListener('submit', (event) => {
          event.preventDefault();
          setAdminPassword();
        });
      }
      if (e.passwordSetBtn && e.passwordSetBtn.dataset.bound !== '1') {
        e.passwordSetBtn.dataset.bound = '1';
        e.passwordSetBtn.addEventListener('click', () => setAdminPassword());
      }
      if (e.orderCreateBtn && e.orderCreateBtn.dataset.bound !== '1') {
        e.orderCreateBtn.dataset.bound = '1';
        e.orderCreateBtn.addEventListener('click', () => createSalesOrder());
      }
      if (e.smokeBtn && e.smokeBtn.dataset.bound !== '1') {
        e.smokeBtn.dataset.bound = '1';
        e.smokeBtn.addEventListener('click', () => runSmokeCheck());
      }
      if (e.conflictBody && e.conflictBody.dataset.bound !== '1') {
        e.conflictBody.dataset.bound = '1';
        e.conflictBody.addEventListener('click', handleConflictClick);
      }
      if (e.reloadConflictsBtn && e.reloadConflictsBtn.dataset.bound !== '1') {
        e.reloadConflictsBtn.dataset.bound = '1';
        e.reloadConflictsBtn.addEventListener('click', () => renderConflictTable());
      }
      if (e.retrySyncBtn && e.retrySyncBtn.dataset.bound !== '1') {
        e.retrySyncBtn.dataset.bound = '1';
        e.retrySyncBtn.addEventListener('click', () => retryPendingAdminSync());
      }
    }

    async function init() {
      ensureLayout();
      setupAdminSectionNav();
      restoreDraft();
      bind();
      applyRoleAccess();
      renderSmokeChecks({ checks: [] });
      await loadDirectory();
    }

    return {
      state,
      init,
      loadDirectory,
      clearDirectory,
      refreshSelectors,
      applyRoleAccess,
      runSmokeCheck,
      retryPendingAdminSync,
      focusEntity: focusAdminHubEntity,
      applyAdminSectionFilter
    };
  }

  window.YWIAdminUI = { create: createAdminUI };
})();

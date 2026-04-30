/* File: js/jobs-ui.js
   Brief description: Jobs and equipment planning UI.
   Renders live forms inside the Jobs and Equipment sections, supports pool-aware reservation requests,
   restores saved jobs into the form, and adds role-aware requirement approval controls.
*/

'use strict';

(function () {
  const JOB_DRAFT_KEY = 'ywi_job_draft_v1';
  const EQUIPMENT_DRAFT_KEY = 'ywi_equipment_draft_v1';

  function $(sel, root = document) { return root.querySelector(sel); }
  function escHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function createJobsUI(config = {}) {
    const api = config.api;
    const getAccessProfile = config.getAccessProfile || (() => ({ canManageJobs: false, canManageAdminDirectory: false }));
    const getCurrentRole = config.getCurrentRole || (() => 'worker');

    const state = {
      jobs: [],
      equipment: [],
      requirements: [],
      signouts: [],
      pools: [],
      notifications: [],
      inspections: [],
      maintenance: [],
      crews: [],
      crewMembers: [],
      profiles: [],
      servicePricingTemplates: [],
      taxCodes: [],
      businessTaxSettings: [],
      jobComments: [],
      jobCommentAttachments: [],
      jobSessions: [],
      jobCrewHours: [],
      jobReassignments: [],
      jobFinancialEvents: [],
      jobFinancialRollups: [],
      estimates: [],
      estimateLines: [],
      workOrders: [],
      workOrderLines: [],
      completionReviews: [],
      accountingQueue: [],
      commercialApprovals: [],
      quotePackages: [],
      approvalThresholds: [],
      workOrderReleaseReviews: [],
      completionPackageItems: [],
      invoiceCandidates: [],
      journalCandidates: [],
      arapReviewQueue: [],
      profitabilityScorecards: [],
      quoteOutputRows: [],
      thresholdEvaluations: [],
      closeoutEvidence: [],
      invoicePostingRules: [],
      journalPostingRules: [],
      accountantHandoffExports: [],
      profitabilityVariance: [],
      completionSignoffSteps: [],
      invoicePostings: [],
      journalPostings: [],
      profitabilityManagement: [],
      selectedJobId: null,
      jobSort: { key: 'start_date', dir: 'desc' },
      editingJobId: null,
      editingEquipmentCode: '',
      signaturePads: { worker: null, supervisor: null, admin: null },
      checkoutPhotos: [],
      returnPhotos: [],
      checkoutPhotoFiles: [],
      returnPhotoFiles: []
    };

    function ensureLayout() {
      const jobs = document.getElementById('jobs');
      const equipment = document.getElementById('equipment');
      if (jobs && jobs.dataset.jobsLayoutReady !== '1') {
        jobs.dataset.jobsLayoutReady = '1';
        jobs.innerHTML = `
          <div class="section-heading">
            <div>
              <h2>Jobs</h2>
              <p class="section-subtitle">Create jobs, restore saved jobs back into the form, request pool-based reservations, and approve or reject requirement exceptions.</p>
            </div>
            <div class="admin-heading-actions">
              <a href="#equipment" class="secondary" id="job_open_equipment_link">Open Equipment Interface</a>
              <button id="job_load" class="secondary" type="button">Reload</button>
              <button id="job_clear" class="secondary" type="button">New Job</button>
            </div>
          </div>
          <div class="grid">
            <label>Job Code<input id="job_code" type="text" placeholder="JOB-1001" /></label>
            <label>Job Name<input id="job_name" type="text" placeholder="Main install" /></label>
            <label>Site<select id="job_site_name"></select></label>
            <label>Job Type<input id="job_type" type="text" placeholder="Install / Repair" /></label>
            <label>Status<input id="job_status" type="text" value="planned" /></label>
            <label>Priority<input id="job_priority" type="text" value="normal" /></label>
            <label>Start Date<input id="job_start_date" type="date" /></label>
            <label>End Date<input id="job_end_date" type="date" /></label>
            <label>Supervisor<input id="job_supervisor_name" type="text" placeholder="Supervisor name" /></label>
            <label>Signing Supervisor<input id="job_signing_supervisor_name" type="text" /></label>
            <label>Admin<input id="job_admin_name" type="text" /></label>
            <label>Client<input id="job_client_name" type="text" /></label>
            <label>Client Ref<input id="job_client_reference" type="text" placeholder="CLIENT-001" /></label>
            <label>Service Contract<input id="job_service_contract_reference" type="text" placeholder="SC-1001" /></label>
            <label>Transaction #<input id="job_billing_transaction_number" type="text" placeholder="TXN-1001" /></label>
            <label>Invoice #<input id="job_invoice_number" type="text" placeholder="INV-1001" /></label>
          </div>
          <label style="display:block;margin-top:12px;">Notes
            <textarea id="job_notes" rows="3" placeholder="Job notes"></textarea>
          </label>
          <div class="form-footer" style="margin-top:12px;">
            <button id="job_add_equipment" class="secondary" type="button">Add Requirement</button>
            <button id="job_save" class="primary" type="button">Save Job</button>
            <label style="display:flex;align-items:center;gap:8px;">
              <input id="job_request_approval" type="checkbox" /> Request job approval
            </label>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="job_equipment_table">
              <thead>
                <tr>
                  <th>Equipment / Pool</th>
                  <th>Pool Key</th>
                  <th>Needed</th>
                  <th>Reserved</th>
                  <th>Approval</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
          <div id="job_access_notice" class="notice" style="display:none;margin-top:14px;"></div>
          <div id="job_summary" class="notice" style="display:none;margin-top:14px;"></div>
          <div class="admin-panel-block" style="margin-top:16px;">
            <h3 style="margin-top:0;">Saved Jobs</h3>
            <div class="table-scroll">
              <table id="job_list_table">
                <thead>
                  <tr>
                    <th><button type="button" class="table-sort" data-job-sort="job_code">Code</button></th>
                    <th><button type="button" class="table-sort" data-job-sort="job_name">Name</button></th>
                    <th><button type="button" class="table-sort" data-job-sort="client_name">Client</button></th>
                    <th><button type="button" class="table-sort" data-job-sort="billing_transaction_number">Transaction</button></th>
                    <th><button type="button" class="table-sort" data-job-sort="invoice_number">Invoice</button></th>
                    <th><button type="button" class="table-sort" data-job-sort="start_date">Date</button></th>
                    <th><button type="button" class="table-sort" data-job-sort="estimated_duration_hours">Duration</button></th>
                    <th><button type="button" class="table-sort" data-job-sort="service_pattern">Repeats</button></th>
                    <th><button type="button" class="table-sort" data-job-sort="status">Status</button></th>
                    <th><button type="button" class="table-sort" data-job-sort="quoted_charge_total">Financial</button></th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        `;
      }
      if (equipment && equipment.dataset.jobsLayoutReady !== '1') {
        equipment.dataset.jobsLayoutReady = '1';
        equipment.innerHTML = `
          <div class="section-heading">
            <div>
              <h2>Equipment</h2>
              <p class="section-subtitle">Manage rental-style asset records, pool keys, serials, images, purchase history, signed checkout/return events, and post-return damage evidence.</p>
            </div>
            <div class="admin-heading-actions">
              <a href="#admin" class="secondary" id="eq_open_admin_link">Open Admin Queue</a>
              <button id="eq_load" class="secondary" type="button">Reload</button>
              <button id="eq_clear" class="secondary" type="button">New Item</button>
            </div>
          </div>
          <div class="grid">
            <label>Equipment Code<input id="eq_code" type="text" /></label>
            <label>Equipment Name<input id="eq_name" type="text" /></label>
            <label>Category<input id="eq_category" type="text" /></label>
            <label>Pool Key<input id="eq_pool_key" type="text" /></label>
            <label>Home Site<select id="eq_home_site"></select></label>
            <label>Status<input id="eq_status" type="text" value="available" /></label>
            <label>Current Job<input id="eq_current_job_code" type="text" /></label>
            <label>Assigned Supervisor<input id="eq_assigned_supervisor" type="text" /></label>
            <label>Serial<input id="eq_serial" type="text" /></label>
            <label>Asset Tag<input id="eq_asset_tag" type="text" /></label>
            <label>Manufacturer<input id="eq_manufacturer" type="text" /></label>
            <label>Model<input id="eq_model" type="text" /></label>
            <label>Year<input id="eq_year" type="number" min="1900" max="2100" /></label>
            <label>Purchase Date<input id="eq_purchase_date" type="date" /></label>
            <label>Purchase Price<input id="eq_purchase_price" type="number" min="0" step="0.01" /></label>
            <label>Condition<input id="eq_condition" type="text" value="ready" /></label>
            <label>Image URL<input id="eq_image_url" type="url" /></label>
            <label>Service Interval (days)<input id="eq_service_interval_days" type="number" min="0" step="1" /></label>
            <label>Last Service<input id="eq_last_service_date" type="date" /></label>
            <label>Next Service Due<input id="eq_next_service_due_date" type="date" /></label>
            <label>Last Inspection<input id="eq_last_inspection_at" type="date" /></label>
            <label>Next Inspection Due<input id="eq_next_inspection_due_date" type="date" /></label>
            <label>Defect Status<input id="eq_defect_status" type="text" value="clear" /></label>
            <label>Defect Notes<input id="eq_defect_notes" type="text" /></label>
            <label style="display:flex;align-items:center;gap:8px;"> <input id="eq_is_locked_out" type="checkbox" /> Locked Out </label>
          </div>
          <label style="display:block;margin-top:12px;">Comments
            <textarea id="eq_comments" rows="2" placeholder="Damage notes, maintenance notes, rental comments"></textarea>
          </label>
          <label style="display:block;margin-top:12px;">Notes
            <textarea id="eq_notes" rows="3"></textarea>
          </label>
          <div class="admin-panel-block" style="margin-top:16px;">
            <h3 style="margin-top:0;">Checkout / Return Signatures</h3>
            <div class="grid">
              <label>Worker Signature<input id="eq_worker_signature" type="text" placeholder="Worker sign-off name" /></label>
              <label>Supervisor Signature<input id="eq_supervisor_signature" type="text" placeholder="Supervisor sign-off name" /></label>
              <label>Admin Signature<input id="eq_admin_signature" type="text" placeholder="Admin sign-off name" /></label>
              <label>Checkout Condition<input id="eq_checkout_condition" type="text" placeholder="Ready / worn / damaged" /></label>
              <label>Return Condition<input id="eq_return_condition" type="text" placeholder="Returned condition" /></label>
              <label style="display:flex;align-items:center;gap:8px;"><input id="eq_damage_reported" type="checkbox" /> Damage noted on return</label>
            </div>
            <label style="display:block;margin-top:12px;">Damage Notes
              <textarea id="eq_damage_notes" rows="2" placeholder="Describe cracks, dents, missing parts, or new wear found on return."></textarea>
            </label>
            <div class="grid" style="margin-top:12px;">
              <label>Checkout Photos<input id="eq_checkout_photos" type="file" accept="image/*" multiple /></label>
              <label>Return / Damage Photos<input id="eq_return_photos" type="file" accept="image/*" multiple /></label>
            </div>
            <div class="grid compact" style="margin-top:8px;">
              <div><strong>Checkout Evidence</strong><div id="eq_checkout_photo_preview" class="photo-preview-grid"></div></div>
              <div><strong>Return / Damage Evidence</strong><div id="eq_return_photo_preview" class="photo-preview-grid"></div></div>
            </div>
            <div class="grid" style="margin-top:12px;">
              <div class="signature-capture-block">
                <label style="display:block;">Worker Signature Capture</label>
                <canvas id="eq_worker_signature_canvas" class="signature-canvas" width="320" height="120"></canvas>
                <div class="form-footer" style="margin-top:8px;"><button id="eq_worker_signature_clear" class="secondary" type="button">Clear Worker Signature</button></div>
              </div>
              <div class="signature-capture-block">
                <label style="display:block;">Supervisor Signature Capture</label>
                <canvas id="eq_supervisor_signature_canvas" class="signature-canvas" width="320" height="120"></canvas>
                <div class="form-footer" style="margin-top:8px;"><button id="eq_supervisor_signature_clear" class="secondary" type="button">Clear Supervisor Signature</button></div>
              </div>
              <div class="signature-capture-block">
                <label style="display:block;">Admin Signature Capture</label>
                <canvas id="eq_admin_signature_canvas" class="signature-canvas" width="320" height="120"></canvas>
                <div class="form-footer" style="margin-top:8px;"><button id="eq_admin_signature_clear" class="secondary" type="button">Clear Admin Signature</button></div>
              </div>
            </div>
          </div>
          <div class="form-footer" style="margin-top:12px;">
            <button id="eq_save" class="primary" type="button">Save Equipment</button>
            <button id="eq_checkout" class="secondary" type="button">Check Out</button>
            <button id="eq_return" class="secondary" type="button">Return</button>
            <button id="eq_add_inspection" class="secondary" type="button">Record Inspection</button>
            <button id="eq_add_maintenance" class="secondary" type="button">Record Service</button>
            <button id="eq_lockout" class="secondary" type="button">Lockout</button>
            <button id="eq_clear_lockout" class="secondary" type="button">Clear Lockout</button>
          </div>
          <div id="equipment_access_notice" class="notice" style="display:none;margin-top:14px;"></div>
          <div id="eq_summary" class="notice" style="display:none;margin-top:14px;"></div>
          <div class="admin-panel-block" style="margin-top:16px;">
            <h3 style="margin-top:0;">Availability by Pool</h3>
            <div class="table-scroll">
              <table id="eq_pool_table">
                <thead><tr><th>Pool</th><th>Category</th><th>Total</th><th>Available</th><th>Reserved</th><th>Checked Out</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
          <div class="admin-panel-block" style="margin-top:16px;">
            <h3 style="margin-top:0;">Equipment List</h3>
            <div class="table-scroll">
              <table id="eq_list_table">
                <thead><tr><th>Code</th><th>Name</th><th>Status</th><th>Serial</th><th>Pool</th><th>Service Due</th><th>Inspection Due</th><th>Lockout</th><th>Action</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
          <div class="admin-panel-block" style="margin-top:16px;">
            <h3 style="margin-top:0;">Checkout / Return History</h3>
            <div class="table-scroll">
              <table id="eq_history_table">
                <thead><tr><th>Equipment</th><th>Job</th><th>Out</th><th>Return</th><th>Worker</th><th>Supervisor</th><th>Admin</th><th>Condition</th><th>Photos</th><th>Damage</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
          <div class="admin-panel-block" style="margin-top:16px;">
            <h3 style="margin-top:0;">Evidence Gallery</h3>
            <div id="eq_gallery_summary" class="notice" style="display:none;margin-bottom:12px;"></div>
            <div id="eq_gallery" class="photo-preview-grid"><span class="muted">Select a history row gallery to view equipment evidence.</span></div>
          </div>
          <div class="admin-panel-block" style="margin-top:16px;">
            <h3 style="margin-top:0;">Inspection History</h3>
            <div class="table-scroll">
              <table id="eq_inspection_table">
                <thead><tr><th>Equipment</th><th>Date</th><th>Status</th><th>Inspector</th><th>Due</th><th>Notes</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
          <div class="admin-panel-block" style="margin-top:16px;">
            <h3 style="margin-top:0;">Maintenance / Service History</h3>
            <div class="table-scroll">
              <table id="eq_maintenance_table">
                <thead><tr><th>Equipment</th><th>Date</th><th>Type</th><th>Provider</th><th>Cost</th><th>Notes</th></tr></thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        `;
      }

    }

    function ensureExtendedJobsPanel() {
      const jobs = document.getElementById('jobs');
      if (!jobs) return;
      if (!document.getElementById('job_ops_extension')) {
        const summaryBlock = document.createElement('div');
        summaryBlock.id = 'job_ops_extension';
        summaryBlock.className = 'admin-panel-block';
        summaryBlock.style.marginTop = '16px';
        summaryBlock.innerHTML = `
          <h3 style="margin-top:0;">Crew, Schedule, and Job Packet</h3>
          <div class="grid">
            <label>Assigned Crew<select id="job_crew_id"></select></label>
            <label>New Crew Name<input id="job_crew_name" type="text" placeholder="Crew name for this job" list="employee-options" /></label>
            <label>Crew Code<input id="job_crew_code" type="text" placeholder="CREW-01" /></label>
            <label>Crew Kind<select id="job_crew_kind"><option value="general">General</option><option value="installation">Installation</option><option value="maintenance">Maintenance</option><option value="snow">Snow</option><option value="parks">Parks</option><option value="construction">Construction</option><option value="custom">Custom</option></select></label>
            <label>Assigned Supervisor<input id="job_assigned_supervisor_name" type="text" placeholder="Required supervisor" list="employee-options" /></label>
            <label>Crew Lead<input id="job_crew_lead_name" type="text" placeholder="Crew lead" list="employee-options" /></label>
            <label>Job Family<select id="job_job_family"><option value="landscaping_standard">Standard Landscaping</option><option value="landscaping_recurring">Recurring Landscaping</option><option value="custom_project">Custom Project</option><option value="park_project">Park Project</option><option value="park_maintenance">Park Maintenance</option><option value="snow">Snow / Winter</option><option value="home_modification">Home Modification</option><option value="construction">Construction</option></select></label>
            <label>Project Scope<select id="job_project_scope"><option value="property_service">Property Service</option><option value="park">Park / Water Park</option><option value="home_modification">Home Modification</option><option value="construction">Construction</option><option value="maintenance">Maintenance</option><option value="snow">Snow</option></select></label>
            <label>Service Pattern<select id="job_service_pattern"><option value="one_time">One Time</option><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="monthly">Monthly</option><option value="seasonal">Seasonal</option><option value="custom">Custom</option></select></label>
            <label>Schedule Mode<select id="job_schedule_mode"><option value="standalone">Standalone Project</option><option value="recurring">Recurring Service</option><option value="project_phase">Project Phase</option></select></label>
            <label>Recurrence Basis<select id="job_recurrence_basis"><option value="calendar_rule">Calendar Rule</option><option value="custom_cycle">Custom Cycle</option><option value="event_driven">Event Driven</option></select></label>
            <label>Recurrence Summary<input id="job_recurrence_summary" type="text" placeholder="Every Tuesday and Friday" /></label>
            <label>Recurrence Rule<input id="job_recurrence_rule" type="text" placeholder="FREQ=WEEKLY;BYDAY=TU,FR" /></label>
            <label>Recurrence Interval<input id="job_recurrence_interval" type="number" min="1" step="1" placeholder="1" /></label>
            <label>Anchor Date<input id="job_recurrence_anchor_date" type="date" /></label>
            <label>Custom Days / Cycle<input id="job_recurrence_custom_days" type="text" placeholder="Mon,Wed,Fri or every 10 days" /></label>
            <label>Estimated Visit Minutes<input id="job_estimated_visit_minutes" type="number" min="0" step="15" placeholder="120" /></label>
            <label>Approx Duration Hours<input id="job_estimated_duration_hours" type="number" min="0" step="0.25" placeholder="2.5" /></label>
            <label>Approx Duration Days<input id="job_estimated_duration_days" type="number" min="0" step="1" placeholder="3" /></label>
            <label>Service Template<select id="job_service_pricing_template_id"></select></label>
            <label>Sales Tax Code<select id="job_sales_tax_code_id"></select></label>
            <label>Cost to Us<input id="job_estimated_cost_total" type="number" min="0" step="0.01" placeholder="0.00" /></label>
            <label>Charge to Client<input id="job_quoted_charge_total" type="number" min="0" step="0.01" placeholder="0.00" /></label>
            <label>Pricing Method<select id="job_pricing_method"><option value="manual">Manual</option><option value="markup_percent">Markup %</option><option value="discount_from_charge">Discount from Charge</option><option value="tiered_discount">Tiered Discount</option></select></label>
            <label>Markup %<input id="job_markup_percent" type="number" step="0.01" placeholder="25" /></label>
            <label>Discount Mode<select id="job_discount_mode"><option value="none">None</option><option value="percent">Percent</option><option value="fixed">Fixed Amount</option><option value="tiered">Tiered</option></select></label>
            <label>Discount Value<input id="job_discount_value" type="number" step="0.01" placeholder="10 or 125" /></label>
            <label>Delay Cost<input id="job_delay_cost_total" type="number" min="0" step="0.01" placeholder="0.00" /></label>
            <label>Repair Cost<input id="job_equipment_repair_cost_total" type="number" min="0" step="0.01" placeholder="0.00" /></label>
            <label>Actual Cost<input id="job_actual_cost_total" type="number" min="0" step="0.01" placeholder="0.00" /></label>
            <label>Actual Charge<input id="job_actual_charge_total" type="number" min="0" step="0.01" placeholder="0.00" /></label>
            <label>Tax Rate %<input id="job_estimated_tax_rate_percent" type="number" min="0" step="0.001" placeholder="13" /></label>
            <label>Estimated Tax<input id="job_estimated_tax_total" type="number" min="0" step="0.01" placeholder="0.00" readonly /></label>
            <label>Total with Tax<input id="job_estimated_total_with_tax" type="number" min="0" step="0.01" placeholder="0.00" readonly /></label>
            <label>Reservation Window Start<input id="job_reservation_window_start" type="date" /></label>
            <label>Reservation Window End<input id="job_reservation_window_end" type="date" /></label>
            <label>Equipment Planning<select id="job_equipment_planning_status"><option value="draft">Draft</option><option value="planned">Planned</option><option value="reserved">Reserved</option><option value="partial">Partial</option><option value="ready">Ready</option></select></label>
            <label style="display:flex;align-items:center;gap:8px;margin-top:26px;"><input id="job_equipment_readiness_required" type="checkbox" checked /> Equipment readiness required</label>
            <label style="display:flex;align-items:center;gap:8px;margin-top:26px;"><input id="job_open_end_date" type="checkbox" /> Open end date</label>
            <label style="display:flex;align-items:center;gap:8px;margin-top:26px;"><input id="job_delayed_schedule" type="checkbox" /> Delayed schedule</label>
          </div>
          <label style="display:block;margin-top:12px;">Crew Members
            <textarea id="job_crew_member_names" rows="2" placeholder="Comma-separated crew member names or emails"></textarea>
          </label>
          <label style="display:block;margin-top:12px;">Custom Schedule Notes
            <textarea id="job_custom_schedule_notes" rows="2" placeholder="Custom rotation, snow trigger, monthly exceptions, or seasonal notes"></textarea>
          </label>
          <label style="display:block;margin-top:12px;">Tiered Discount Notes
            <textarea id="job_tiered_discount_notes" rows="2" placeholder="Volume tiers, repeat-service discounts, or custom pricing notes"></textarea>
          </label>
          <label style="display:block;margin-top:12px;">Delay Notes
            <textarea id="job_delay_reason" rows="2" placeholder="Weather delay, crew shortage, equipment issue, client delay, material shortage"></textarea>
          </label>
          <label style="display:block;margin-top:12px;">Reservation / Equipment Notes
            <textarea id="job_reservation_notes" rows="2" placeholder="Shovels, riding mower, backhoe, snow plow, specialty attachments, staging notes"></textarea>
          </label>
          <label style="display:block;margin-top:12px;">Special Instructions
            <textarea id="job_special_instructions" rows="3" placeholder="Gate codes, hazard notes, photo reminders, site-specific instructions"></textarea>
          </label>
          <div id="job_ops_summary" class="notice" style="display:none;margin-top:12px;"></div>
        `;
        const summaryTarget = document.getElementById('job_summary');
        summaryTarget?.parentNode?.insertBefore(summaryBlock, summaryTarget.nextSibling);
      }
      if (!document.getElementById('job_activity_block')) {
        const activity = document.createElement('div');
        activity.id = 'job_activity_block';
        activity.className = 'admin-panel-block';
        activity.style.marginTop = '16px';
        activity.innerHTML = `
          <h3 style="margin-top:0;">Job Activity, Photos, and Instructions</h3>
          <div class="grid">
            <label>Comment Type<select id="job_comment_type"><option value="update">Update</option><option value="photo">Photo Update</option><option value="issue">Issue</option><option value="instruction">Instruction</option><option value="closeout">Closeout</option></select></label>
            <label style="display:flex;align-items:center;gap:8px;margin-top:26px;"><input id="job_comment_special_instruction" type="checkbox" /> Update job special instructions</label>
            <label style="display:flex;align-items:center;gap:8px;margin-top:26px;"><input id="job_comment_visible_to_client" type="checkbox" /> Client-visible note</label>
            <label>Photos / Files<input id="job_comment_files" type="file" accept="image/*,.pdf,.doc,.docx" multiple /></label>
          </div>
          <label style="display:block;margin-top:12px;">Comment
            <textarea id="job_comment_text" rows="3" placeholder="Crew update, site condition, issue, or instruction"></textarea>
          </label>
          <div class="form-footer" style="margin-top:12px;">
            <button id="job_comment_save" class="secondary" type="button">Post Update</button>
          </div>
          <div id="job_activity_summary" class="notice" style="display:none;margin-top:12px;"></div>
          <div id="job_activity_list" class="job-activity-list" style="margin-top:12px;"><span class="muted">Save or load a job to track comments, photos, and special instructions.</span></div>
        `;
        const savedJobsBlock = document.querySelector('#jobs .admin-panel-block:last-of-type');
        if (savedJobsBlock?.parentNode) savedJobsBlock.parentNode.insertBefore(activity, savedJobsBlock);
        else jobs.appendChild(activity);
      }
      if (!document.getElementById('job_tracking_block')) {
        const tracking = document.createElement('div');
        tracking.id = 'job_tracking_block';
        tracking.className = 'admin-panel-block';
        tracking.style.marginTop = '16px';
        tracking.innerHTML = `
          <h3 style="margin-top:0;">Session Tracking, Crew Hours, and Reassignments</h3>
          <div class="form-footer">
            <button id="job_track_session" class="secondary" type="button">Record Session</button>
            <button id="job_track_hours" class="secondary" type="button">Log Crew Hours</button>
            <button id="job_track_reassign" class="secondary" type="button">Reassign Crew / Equipment</button>
            <button id="job_track_financial" class="secondary" type="button">Log Cost / Revenue</button>
          </div>
          <div id="job_tracking_summary" class="notice" style="display:none;margin-top:12px;"></div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="job_session_table">
              <thead><tr><th>Date</th><th>Start</th><th>End</th><th>Duration</th><th>Status</th><th>Supervisor Signoff</th><th>Action</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="job_crew_hours_table">
              <thead><tr><th>Worker</th><th>Session</th><th>Start</th><th>End</th><th>Regular</th><th>OT</th><th>Total</th><th>Action</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="job_reassign_table">
              <thead><tr><th>Started</th><th>From</th><th>To</th><th>Member / Equipment</th><th>Reason</th><th>Emergency</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="table-scroll" style="margin-top:12px;">
            <table id="job_financial_table">
              <thead><tr><th>Date</th><th>Type</th><th>Cost</th><th>Revenue</th><th>Billable</th><th>Reference</th><th>Action</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        `;
        const savedJobsBlock = document.querySelector('#jobs .admin-panel-block:last-of-type');
        if (savedJobsBlock?.parentNode) savedJobsBlock.parentNode.insertBefore(tracking, savedJobsBlock);
        else jobs.appendChild(tracking);
      }
    }

    function ensureCommercialPanel() {
      const jobs = document.getElementById('jobs');
      if (!jobs || document.getElementById('job_commercial_block')) return;
      const panel = document.createElement('div');
      panel.id = 'job_commercial_block';
      panel.className = 'admin-panel-block';
      panel.style.marginTop = '16px';
      panel.innerHTML = `
        <h3 style="margin-top:0;">Commercial Workflow and Completion</h3>
        <div class="form-footer">
          <button id="job_create_estimate" class="secondary" type="button">Create Estimate From Job</button>
          <button id="job_add_estimate_line" class="secondary" type="button">Add Estimate Line</button>
          <button id="job_render_quote_package" class="secondary" type="button">Render Quote Package</button>
          <button id="job_print_quote_package" class="secondary" type="button">Print / Copy Quote</button>
          <button id="job_send_quote_package" class="secondary" type="button">Mark Quote Sent</button>
          <button id="job_convert_to_package" class="secondary" type="button">Convert Estimate to Job Package</button>
          <button id="job_release_review" class="secondary" type="button">Review / Release Work Order</button>
          <button id="job_evaluate_thresholds" class="secondary" type="button">Evaluate Thresholds</button>
          <button id="job_completion_review" class="secondary" type="button">Create / Update Completion Review</button>
          <button id="job_add_closeout_item" class="secondary" type="button">Add Closeout Item</button>
          <button id="job_add_closeout_evidence" class="secondary" type="button">Link Closeout Evidence</button>
          <button id="job_add_signoff_step" class="secondary" type="button">Add Signoff Step</button>
          <button id="job_sign_selected_step" class="secondary" type="button">Sign Completion Step</button>
          <button id="job_queue_accounting" class="secondary" type="button">Queue for Accounting Review</button>
          <button id="job_create_invoice_candidate" class="secondary" type="button">Create Invoice Candidate</button>
          <button id="job_create_journal_candidate" class="secondary" type="button">Create Journal Candidate</button>
          <button id="job_post_invoice_candidate" class="secondary" type="button">Post Invoice Candidate</button>
          <button id="job_post_journal_candidate" class="secondary" type="button">Post Journal Candidate</button>
          <button id="job_queue_arap_review" class="secondary" type="button">Queue AR / AP Review</button>
          <button id="job_export_closeout_summary" class="secondary" type="button">Export Closeout Summary</button>
          <button id="job_export_accountant_handoff" class="secondary" type="button">Export Accountant Handoff</button>
        </div>
        <div id="job_commercial_summary" class="notice" style="display:none;margin-top:12px;"></div>
        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_estimate_table">
            <thead><tr><th>Estimate</th><th>Client</th><th>Status</th><th>Approval</th><th>Total</th><th>Margin</th><th>Converted</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_work_order_table">
            <thead><tr><th>Work Order</th><th>Estimate</th><th>Status</th><th>Completion</th><th>Accounting</th><th>Total</th><th>Margin</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_completion_review_table">
            <thead><tr><th>Job</th><th>Status</th><th>Completion Date</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Accounting</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_accounting_queue_table">
            <thead><tr><th>Job</th><th>Review</th><th>Accounting Trigger</th><th>Profit</th><th>Last Event</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_quote_package_table">
            <thead><tr><th>Estimate</th><th>Package</th><th>Tax Profile</th><th>Status</th><th>Sent</th><th>Accepted</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_release_review_table">
            <thead><tr><th>Work Order</th><th>Release</th><th>Threshold</th><th>Discount %</th><th>Margin %</th><th>Required Signoff</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_closeout_item_table">
            <thead><tr><th>Item</th><th>Type</th><th>Status</th><th>Required</th><th>Due</th><th>Completed</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>

        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_quote_output_table">
            <thead><tr><th>Estimate</th><th>Brand</th><th>Status</th><th>Subject</th><th>Last Output</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_threshold_eval_table">
            <thead><tr><th>Threshold</th><th>Status</th><th>Discount %</th><th>Margin %</th><th>Total</th><th>Message</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_closeout_evidence_table">
            <thead><tr><th>Item</th><th>Kind</th><th>Label</th><th>Source</th><th>Created</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>

        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_signoff_step_table">
            <thead><tr><th>Kind</th><th>Status</th><th>Required Role</th><th>Signed By</th><th>Signed At</th><th>Notes</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_invoice_candidate_table">
            <thead><tr><th>Candidate</th><th>Status</th><th>Tax Profile</th><th>Total</th><th>Client</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_journal_candidate_table">
            <thead><tr><th>Job</th><th>Status</th><th>Tax Profile</th><th>Journal Memo</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_arap_queue_table">
            <thead><tr><th>Source</th><th>Status</th><th>Assigned</th><th>Notes</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>


        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_invoice_posting_table">
            <thead><tr><th>Candidate</th><th>Status</th><th>External Ref</th><th>Queue</th><th>Posted</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_journal_posting_table">
            <thead><tr><th>Memo</th><th>Status</th><th>Journal #</th><th>Batch</th><th>Posted</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_management_scorecard_table">
            <thead><tr><th>Group</th><th>Label</th><th>Jobs</th><th>Margin %</th><th>Revenue Var %</th><th>Cost Var %</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_accountant_export_table">
            <thead><tr><th>Kind</th><th>Status</th><th>Title</th><th>Tax Profile</th><th>Generated</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_variance_table">
            <thead><tr><th>Group</th><th>Label</th><th>Quoted</th><th>Est Cost</th><th>Actual Revenue</th><th>Actual Cost</th><th>Revenue Var</th><th>Cost Var</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="table-scroll" style="margin-top:12px;">
          <table id="job_profitability_scorecard_table">
            <thead><tr><th>Group</th><th>Label</th><th>Jobs</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin %</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      `;
      const savedJobsBlock = document.querySelector('#jobs .admin-panel-block:last-of-type');
      if (savedJobsBlock?.parentNode) savedJobsBlock.parentNode.insertBefore(panel, savedJobsBlock);
      else jobs.appendChild(panel);
    }

    function els() {
      return {
        jobsSection: $('#jobs'),
        equipmentSection: $('#equipment'),
        jobCode: $('#job_code'),
        jobName: $('#job_name'),
        jobSiteName: $('#job_site_name'),
        jobType: $('#job_type'),
        jobStatus: $('#job_status'),
        jobPriority: $('#job_priority'),
        jobStartDate: $('#job_start_date'),
        jobEndDate: $('#job_end_date'),
        jobSupervisorName: $('#job_supervisor_name'),
        jobSigningSupervisorName: $('#job_signing_supervisor_name'),
        jobAdminName: $('#job_admin_name'),
        jobClientName: $('#job_client_name'),
        jobClientReference: $('#job_client_reference'),
        jobServiceContractReference: $('#job_service_contract_reference'),
        jobBillingTransactionNumber: $('#job_billing_transaction_number'),
        jobInvoiceNumber: $('#job_invoice_number'),
        jobNotes: $('#job_notes'),
        jobCrewId: $('#job_crew_id'),
        jobCrewName: $('#job_crew_name'),
        jobCrewCode: $('#job_crew_code'),
        jobAssignedSupervisorName: $('#job_assigned_supervisor_name'),
        jobCrewKind: $('#job_crew_kind'),
        jobCrewLeadName: $('#job_crew_lead_name'),
        jobJobFamily: $('#job_job_family'),
        jobProjectScope: $('#job_project_scope'),
        jobServicePattern: $('#job_service_pattern'),
        jobScheduleMode: $('#job_schedule_mode'),
        jobRecurrenceBasis: $('#job_recurrence_basis'),
        jobRecurrenceSummary: $('#job_recurrence_summary'),
        jobRecurrenceRule: $('#job_recurrence_rule'),
        jobRecurrenceInterval: $('#job_recurrence_interval'),
        jobRecurrenceAnchorDate: $('#job_recurrence_anchor_date'),
        jobRecurrenceCustomDays: $('#job_recurrence_custom_days'),
        jobEstimatedVisitMinutes: $('#job_estimated_visit_minutes'),
        jobEstimatedDurationHours: $('#job_estimated_duration_hours'),
        jobEstimatedDurationDays: $('#job_estimated_duration_days'),
        jobServicePricingTemplateId: $('#job_service_pricing_template_id'),
        jobSalesTaxCodeId: $('#job_sales_tax_code_id'),
        jobEstimatedCostTotal: $('#job_estimated_cost_total'),
        jobQuotedChargeTotal: $('#job_quoted_charge_total'),
        jobPricingMethod: $('#job_pricing_method'),
        jobMarkupPercent: $('#job_markup_percent'),
        jobDiscountMode: $('#job_discount_mode'),
        jobDiscountValue: $('#job_discount_value'),
        jobDelayCostTotal: $('#job_delay_cost_total'),
        jobEquipmentRepairCostTotal: $('#job_equipment_repair_cost_total'),
        jobActualCostTotal: $('#job_actual_cost_total'),
        jobActualChargeTotal: $('#job_actual_charge_total'),
        jobEstimatedTaxRatePercent: $('#job_estimated_tax_rate_percent'),
        jobEstimatedTaxTotal: $('#job_estimated_tax_total'),
        jobEstimatedTotalWithTax: $('#job_estimated_total_with_tax'),
        jobReservationWindowStart: $('#job_reservation_window_start'),
        jobReservationWindowEnd: $('#job_reservation_window_end'),
        jobEquipmentPlanningStatus: $('#job_equipment_planning_status'),
        jobEquipmentReadinessRequired: $('#job_equipment_readiness_required'),
        jobOpenEndDate: $('#job_open_end_date'),
        jobDelayedSchedule: $('#job_delayed_schedule'),
        jobCrewMemberNames: $('#job_crew_member_names'),
        jobCustomScheduleNotes: $('#job_custom_schedule_notes'),
        jobTieredDiscountNotes: $('#job_tiered_discount_notes'),
        jobDelayReason: $('#job_delay_reason'),
        jobReservationNotes: $('#job_reservation_notes'),
        jobSpecialInstructions: $('#job_special_instructions'),
        jobOpsSummary: $('#job_ops_summary'),
        jobCommentType: $('#job_comment_type'),
        jobCommentSpecialInstruction: $('#job_comment_special_instruction'),
        jobCommentVisibleToClient: $('#job_comment_visible_to_client'),
        jobCommentFiles: $('#job_comment_files'),
        jobCommentText: $('#job_comment_text'),
        jobCommentSave: $('#job_comment_save'),
        jobActivitySummary: $('#job_activity_summary'),
        jobActivityList: $('#job_activity_list'),
        jobTrackSession: $('#job_track_session'),
        jobTrackHours: $('#job_track_hours'),
        jobTrackReassign: $('#job_track_reassign'),
        jobTrackFinancial: $('#job_track_financial'),
        jobTrackingSummary: $('#job_tracking_summary'),
        jobSessionBody: $('#job_session_table tbody'),
        jobCrewHoursBody: $('#job_crew_hours_table tbody'),
        jobReassignBody: $('#job_reassign_table tbody'),
        jobFinancialBody: $('#job_financial_table tbody'),
        jobAddEquipment: $('#job_add_equipment'),
        jobRequestApproval: $('#job_request_approval'),
        jobEquipmentBody: $('#job_equipment_table tbody'),
        jobSave: $('#job_save'),
        jobLoad: $('#job_load'),
        jobClear: $('#job_clear'),
        jobAccessNotice: $('#job_access_notice'),
        jobSummary: $('#job_summary'),
        jobListBody: $('#job_list_table tbody'),
        jobCreateEstimate: $('#job_create_estimate'),
        jobAddEstimateLine: $('#job_add_estimate_line'),
        jobRenderQuotePackage: $('#job_render_quote_package'),
        jobPrintQuotePackage: $('#job_print_quote_package'),
        jobSendQuotePackage: $('#job_send_quote_package'),
        jobConvertToPackage: $('#job_convert_to_package'),
        jobReleaseReview: $('#job_release_review'),
        jobEvaluateThresholds: $('#job_evaluate_thresholds'),
        jobCompletionReview: $('#job_completion_review'),
        jobAddCloseoutItem: $('#job_add_closeout_item'),
        jobAddCloseoutEvidence: $('#job_add_closeout_evidence'),
        jobAddSignoffStep: $('#job_add_signoff_step'),
        jobSignSelectedStep: $('#job_sign_selected_step'),
        jobQueueAccounting: $('#job_queue_accounting'),
        jobCreateInvoiceCandidate: $('#job_create_invoice_candidate'),
        jobCreateJournalCandidate: $('#job_create_journal_candidate'),
        jobPostInvoiceCandidate: $('#job_post_invoice_candidate'),
        jobPostJournalCandidate: $('#job_post_journal_candidate'),
        jobQueueArapReview: $('#job_queue_arap_review'),
        jobExportCloseoutSummary: $('#job_export_closeout_summary'),
        jobExportAccountantHandoff: $('#job_export_accountant_handoff'),
        jobCommercialSummary: $('#job_commercial_summary'),
        jobEstimateBody: $('#job_estimate_table tbody'),
        jobWorkOrderBody: $('#job_work_order_table tbody'),
        jobCompletionReviewBody: $('#job_completion_review_table tbody'),
        jobAccountingQueueBody: $('#job_accounting_queue_table tbody'),
        jobQuotePackageBody: $('#job_quote_package_table tbody'),
        jobQuoteOutputBody: $('#job_quote_output_table tbody'),
        jobThresholdEvalBody: $('#job_threshold_eval_table tbody'),
        jobCloseoutEvidenceBody: $('#job_closeout_evidence_table tbody'),
        jobReleaseReviewBody: $('#job_release_review_table tbody'),
        jobCloseoutItemBody: $('#job_closeout_item_table tbody'),
        jobSignoffStepBody: $('#job_signoff_step_table tbody'),
        jobInvoiceCandidateBody: $('#job_invoice_candidate_table tbody'),
        jobJournalCandidateBody: $('#job_journal_candidate_table tbody'),
        jobArapQueueBody: $('#job_arap_queue_table tbody'),
        jobInvoicePostingBody: $('#job_invoice_posting_table tbody'),
        jobJournalPostingBody: $('#job_journal_posting_table tbody'),
        jobAccountantExportBody: $('#job_accountant_export_table tbody'),
        jobVarianceBody: $('#job_variance_table tbody'),
        jobProfitabilityScorecardBody: $('#job_profitability_scorecard_table tbody'),
        jobManagementScorecardBody: $('#job_management_scorecard_table tbody'),
        eqCode: $('#eq_code'),
        eqName: $('#eq_name'),
        eqCategory: $('#eq_category'),
        eqHomeSite: $('#eq_home_site'),
        eqStatus: $('#eq_status'),
        eqCurrentJobCode: $('#eq_current_job_code'),
        eqAssignedSupervisor: $('#eq_assigned_supervisor'),
        eqSerial: $('#eq_serial'),
        eqPoolKey: $('#eq_pool_key'),
        eqAssetTag: $('#eq_asset_tag'),
        eqManufacturer: $('#eq_manufacturer'),
        eqModel: $('#eq_model'),
        eqYear: $('#eq_year'),
        eqPurchaseDate: $('#eq_purchase_date'),
        eqPurchasePrice: $('#eq_purchase_price'),
        eqCondition: $('#eq_condition'),
        eqImageUrl: $('#eq_image_url'),
        eqServiceIntervalDays: $('#eq_service_interval_days'),
        eqLastServiceDate: $('#eq_last_service_date'),
        eqNextServiceDueDate: $('#eq_next_service_due_date'),
        eqLastInspectionAt: $('#eq_last_inspection_at'),
        eqNextInspectionDueDate: $('#eq_next_inspection_due_date'),
        eqDefectStatus: $('#eq_defect_status'),
        eqDefectNotes: $('#eq_defect_notes'),
        eqIsLockedOut: $('#eq_is_locked_out'),
        eqComments: $('#eq_comments'),
        eqAccessNotice: $('#equipment_access_notice'),
        eqWorkerSignature: $('#eq_worker_signature'),
        eqSupervisorSignature: $('#eq_supervisor_signature'),
        eqAdminSignature: $('#eq_admin_signature'),
        eqWorkerSignatureCanvas: $('#eq_worker_signature_canvas'),
        eqSupervisorSignatureCanvas: $('#eq_supervisor_signature_canvas'),
        eqAdminSignatureCanvas: $('#eq_admin_signature_canvas'),
        eqWorkerSignatureClear: $('#eq_worker_signature_clear'),
        eqSupervisorSignatureClear: $('#eq_supervisor_signature_clear'),
        eqAdminSignatureClear: $('#eq_admin_signature_clear'),
        eqCheckoutCondition: $('#eq_checkout_condition'),
        eqReturnCondition: $('#eq_return_condition'),
        eqDamageReported: $('#eq_damage_reported'),
        eqDamageNotes: $('#eq_damage_notes'),
        eqCheckoutPhotos: $('#eq_checkout_photos'),
        eqReturnPhotos: $('#eq_return_photos'),
        eqCheckoutPhotoPreview: $('#eq_checkout_photo_preview'),
        eqReturnPhotoPreview: $('#eq_return_photo_preview'),
        eqNotes: $('#eq_notes'),
        eqSave: $('#eq_save'),
        eqLoad: $('#eq_load'),
        eqClear: $('#eq_clear'),
        eqCheckout: $('#eq_checkout'),
        eqReturn: $('#eq_return'),
        eqAddInspection: $('#eq_add_inspection'),
        eqAddMaintenance: $('#eq_add_maintenance'),
        eqLockout: $('#eq_lockout'),
        eqClearLockout: $('#eq_clear_lockout'),
        eqSummary: $('#eq_summary'),
        eqListBody: $('#eq_list_table tbody'),
        eqPoolBody: $('#eq_pool_table tbody'),
        eqHistoryBody: $('#eq_history_table tbody'),
        eqGallery: $('#eq_gallery'),
        eqGallerySummary: $('#eq_gallery_summary'),
        eqInspectionBody: $('#eq_inspection_table tbody'),
        eqMaintenanceBody: $('#eq_maintenance_table tbody')
      };
    }


    function initSignaturePads() {
      const e = els();
      const pairs = [
        ['worker', e.eqWorkerSignatureCanvas, e.eqWorkerSignatureClear],
        ['supervisor', e.eqSupervisorSignatureCanvas, e.eqSupervisorSignatureClear],
        ['admin', e.eqAdminSignatureCanvas, e.eqAdminSignatureClear]
      ];
      pairs.forEach(([key, canvas, clearBtn]) => {
        if (!canvas || typeof window.SignaturePad !== 'function') return;
        if (!state.signaturePads[key]) {
          state.signaturePads[key] = new window.SignaturePad(canvas, { minWidth: 0.8, maxWidth: 2.1 });
        }
        if (clearBtn && clearBtn.dataset.bound !== '1') {
          clearBtn.dataset.bound = '1';
          clearBtn.addEventListener('click', () => state.signaturePads[key]?.clear());
        }
      });
    }

    function clearSignaturePads() {
      Object.values(state.signaturePads).forEach((pad) => pad?.clear?.());
    }

    function collectSignaturePayload() {
      return {};
    }

    function dataUrlToFile(dataUrl, fileName) {
      const parts = String(dataUrl || '').split(',');
      const header = parts[0] || '';
      const body = parts[1] || '';
      const mimeMatch = header.match(/data:([^;]+);base64/i);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      const binary = atob(body);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new File([bytes], fileName, { type: mimeType });
    }

    async function uploadEquipmentEvidence(signoutId, stage) {
      if (!signoutId || !api?.uploadEquipmentEvidenceBatch) return [];
      const uploads = [];
      const photoFiles = stage === 'checkout' ? state.checkoutPhotoFiles : state.returnPhotoFiles;
      photoFiles.forEach((file, index) => uploads.push({ signoutId, stage, evidenceKind: 'photo', caption: `${stage} evidence ${index + 1}`, file }));
      ['worker','supervisor','admin'].forEach((role) => {
        const pad = state.signaturePads[role];
        if (pad && !pad.isEmpty()) {
          uploads.push({ signoutId, stage, evidenceKind: 'signature', signerRole: role, caption: `${stage} ${role} signature`, file: dataUrlToFile(pad.toDataURL('image/png'), `${stage}-${role}-signature.png`) });
        }
      });
      if (!uploads.length) return [];
      return api.uploadEquipmentEvidenceBatch(uploads);
    }

    function normalizePhotoList(value) {
      if (!value) return [];
      if (Array.isArray(value)) return value.filter(Boolean);
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        } catch {
          return value ? [value] : [];
        }
      }
      return [];
    }

    function renderPhotoPreviews() {
      const e = els();
      const renderInto = (host, items) => {
        if (!host) return;
        host.innerHTML = normalizePhotoList(items).map((src) => `<a href="${escHtml(src)}" target="_blank" rel="noopener"><img src="${escHtml(src)}" alt="Evidence photo" class="evidence-thumb" /></a>`).join('') || '<span class="muted">No photos selected.</span>';
      };
      renderInto(e.eqCheckoutPhotoPreview, state.checkoutPhotos);
      renderInto(e.eqReturnPhotoPreview, state.returnPhotos);
    }

    function filesToDataUrls(fileList) {
      const files = Array.from(fileList || []).filter((file) => /^image\//i.test(file.type || ''));
      return Promise.all(files.map((file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error(`Failed to read image ${file.name}`));
        reader.readAsDataURL(file);
      })));
    }

    async function handleEvidenceFiles(input, bucket) {
      const files = input?.files;
      if (!files?.length) return;
      state[bucket] = await filesToDataUrls(files);
      state[bucket === 'checkoutPhotos' ? 'checkoutPhotoFiles' : 'returnPhotoFiles'] = Array.from(files);
      renderPhotoPreviews();
    }

    async function runConnectionDiagnostics(targetEl) {
      if (!api?.diagnoseConnections) return;
      try {
        const diag = await api.diagnoseConnections();
        const failed = (diag.checks || []).filter((row) => !row.ok);
        if (failed.length) setNotice(targetEl, failed.map((row) => row.message).join(' '), true);
      } catch (err) {
        setNotice(targetEl, err?.message || 'Connection diagnostics failed.', true);
      }
    }

    function setNotice(el, text = '', isError = false) {
      if (!el) return;
      if (!text) {
        el.style.display = 'none';
        el.textContent = '';
        el.dataset.kind = '';
        return;
      }
      el.style.display = 'block';
      el.textContent = text;
      el.dataset.kind = isError ? 'error' : 'info';
    }

    function canManage() {
      const access = getAccessProfile(getCurrentRole());
      return !!(access.canManageJobs || access.canManageAdminDirectory);
    }

    function canApprove() {
      const access = getAccessProfile(getCurrentRole());
      return !!access.canManageAdminDirectory;
    }

    function applyRoleVisibility() {
      const e = els();
      const access = getAccessProfile(getCurrentRole());
      const allowed = !!access.canManageJobs || !!access.canManageAdminDirectory;
      if (e.jobsSection) e.jobsSection.style.display = '';
      if (e.equipmentSection) e.equipmentSection.style.display = '';
      setNotice(
        e.jobAccessNotice,
        allowed
          ? 'You can manage jobs from this screen.'
          : 'You can view the Jobs area, but your role cannot create or edit jobs yet. Ask a supervisor, job admin, or admin for access.',
        !allowed
      );
      setNotice(
        e.eqAccessNotice,
        allowed
          ? 'You can manage equipment from this screen.'
          : 'You can view the Equipment area, but your role cannot check out, return, or edit equipment yet. Ask a supervisor, job admin, or admin for access.',
        !allowed
      );
      document.body.dataset.canApproveJobs = canApprove() ? 'true' : 'false';
      syncActionLocks();
    }


    function syncActionLocks() {
      const allowed = canManage();
      const editableIds = [
        'job_code','job_name','job_site_name','job_type','job_status','job_priority','job_start_date','job_end_date',
        'job_supervisor_name','job_signing_supervisor_name','job_admin_name','job_client_name','job_notes',
        'job_crew_id','job_crew_name','job_crew_code','job_crew_kind','job_assigned_supervisor_name','job_crew_lead_name','job_job_family','job_project_scope','job_service_pattern','job_schedule_mode','job_recurrence_basis','job_recurrence_summary','job_recurrence_rule','job_recurrence_interval','job_recurrence_anchor_date','job_recurrence_custom_days','job_estimated_visit_minutes','job_estimated_duration_hours','job_estimated_duration_days','job_estimated_cost_total','job_quoted_charge_total','job_pricing_method','job_markup_percent','job_discount_mode','job_discount_value','job_delay_cost_total','job_equipment_repair_cost_total','job_actual_cost_total','job_actual_charge_total','job_reservation_window_start','job_reservation_window_end','job_equipment_planning_status','job_equipment_readiness_required','job_open_end_date','job_delayed_schedule','job_crew_member_names','job_custom_schedule_notes','job_tiered_discount_notes','job_delay_reason','job_reservation_notes','job_special_instructions','job_comment_type','job_comment_special_instruction','job_comment_visible_to_client','job_comment_files','job_comment_text',
        'eq_code','eq_name','eq_category','eq_pool_key','eq_home_site','eq_status','eq_current_job_code','eq_assigned_supervisor',
        'eq_serial','eq_asset_tag','eq_manufacturer','eq_model','eq_year','eq_purchase_date','eq_purchase_price','eq_condition',
        'eq_image_url','eq_service_interval_days','eq_last_service_date','eq_next_service_due_date','eq_last_inspection_at',
        'eq_next_inspection_due_date','eq_defect_status','eq_defect_notes','eq_is_locked_out','eq_comments','eq_notes',
        'eq_worker_signature','eq_supervisor_signature','eq_admin_signature','eq_checkout_condition','eq_return_condition','eq_damage_notes','eq_damage_reported','eq_checkout_photos','eq_return_photos'
      ];
      editableIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.disabled = !allowed;
      });
      ['job_add_equipment','job_request_approval','job_save','job_clear','job_comment_save','job_track_session','job_track_hours','job_track_reassign','job_create_estimate','job_add_estimate_line','job_render_quote_package','job_print_quote_package','job_send_quote_package','job_convert_to_package','job_release_review','job_evaluate_thresholds','job_completion_review','job_add_closeout_item','job_add_closeout_evidence','job_queue_accounting','job_create_invoice_candidate','job_create_journal_candidate','job_queue_arap_review','job_export_closeout_summary','job_export_accountant_handoff','eq_save','eq_checkout','eq_return','eq_add_inspection','eq_add_maintenance','eq_lockout','eq_clear_lockout','eq_clear'].forEach((id)=>{
        const el = document.getElementById(id);
        if (el) el.disabled = !allowed;
      });
    }

    function fillSiteSelect(selectEl) {
      if (!selectEl) return;
      const current = selectEl.value;
      const uniqueSites = Array.from(new Map(state.jobs.map((row) => [row.site_id || row.site_code || row.site_name, row])).values())
        .filter((row) => row.site_name || row.site_code)
        .map((row) => ({ value: row.site_code || row.site_name, label: row.site_code ? `${row.site_code} — ${row.site_name || ''}` : row.site_name }));
      selectEl.innerHTML = '<option value="">Select site</option>' + uniqueSites.map((row) => `<option value="${escHtml(row.value)}">${escHtml(row.label)}</option>`).join('');
      if (current) selectEl.value = current;
    }

    function fillCrewSelect(selectEl) {
      if (!selectEl) return;
      const current = selectEl.value;
      const rows = Array.isArray(state.crews) ? state.crews : [];
      selectEl.innerHTML = '<option value="">No saved crew</option>' + rows.map((row) => `<option value="${escHtml(row.id)}">${escHtml(row.crew_name || row.crew_code || row.id)}</option>`).join('');
      if (current) selectEl.value = current;
    }

    function fillEmployeeDataList() {
      const dataList = document.getElementById('employee-options');
      if (!dataList) return;
      dataList.innerHTML = (Array.isArray(state.profiles) ? state.profiles : []).map((row) => `<option value="${escHtml(row.full_name || row.email || '')}">${escHtml(row.email || '')}</option>`).join('');
    }

    function getSelectedJobComments() {
      return (Array.isArray(state.jobComments) ? state.jobComments : []).filter((row) => Number(row.job_id || 0) === Number(state.selectedJobId || state.editingJobId || 0));
    }

    function renderJobActivity() {
      const e = els();
      if (!e.jobActivityList) return;
      const activeJobId = Number(state.selectedJobId || state.editingJobId || 0);
      if (!activeJobId) {
        e.jobActivityList.innerHTML = '<span class="muted">Save or load a job to track comments, photos, and special instructions.</span>';
        setNotice(e.jobActivitySummary, '');
        return;
      }
      const comments = getSelectedJobComments();
      const activeJob = (state.jobs || []).find((row) => Number(row.id) === activeJobId) || null;
      setNotice(e.jobActivitySummary, activeJob ? `Tracking ${comments.length} update(s) for ${activeJob.job_code || activeJob.job_name || 'job'}.` : '');
      e.jobActivityList.innerHTML = comments.length ? comments.map((row) => `
        <article class="job-activity-card">
          <div class="job-activity-header">
            <strong>${escHtml(row.comment_type || 'update')}</strong>
            <span class="muted">${escHtml(row.created_by_name || '')} ${row.created_at ? `• ${escHtml(String(row.created_at).replace('T', ' ').slice(0, 16))}` : ''}</span>
          </div>
          <div>${escHtml(row.comment_text || '')}</div>
          ${row.is_special_instruction ? '<div class="job-activity-chip">Special instruction</div>' : ''}
          ${Array.isArray(row.attachments) && row.attachments.length ? `<div class="job-activity-attachments">${row.attachments.map((asset) => `<a href="${escHtml(asset.public_url || asset.preview_url || '#')}" target="_blank" rel="noopener" class="job-activity-attachment">${asset.attachment_kind === 'photo' ? `<img src="${escHtml(asset.public_url || asset.preview_url || '')}" alt="${escHtml(asset.file_name || 'Attachment')}" />` : ''}<span>${escHtml(asset.file_name || asset.attachment_kind || 'Attachment')}</span></a>`).join('')}</div>` : ''}
          <div class="form-footer" style="margin-top:8px;">
            <button type="button" class="secondary" data-job-comment-delete="${escHtml(row.id)}">Delete</button>
          </div>
        </article>
      `).join('') : '<span class="muted">No comments or photos have been added for this job yet.</span>';
    }

    function addEquipmentRequirementRow(row = {}) {
      const e = els();
      if (!e.jobEquipmentBody) return;
      const lockedApproval = !canApprove();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="job-eq-name" placeholder="Harness / Lift / specific asset" value="${escHtml(row.equipment_name || row.name || '')}"></td>
        <td><input type="text" class="job-eq-pool" placeholder="pool key" value="${escHtml(row.equipment_pool_key || row.pool_key || '')}"></td>
        <td><input type="number" class="job-eq-needed" min="1" step="1" value="${escHtml(row.needed_qty ?? 1)}"></td>
        <td><input type="number" class="job-eq-reserved" min="0" step="1" value="${escHtml(row.reserved_qty ?? 0)}"></td>
        <td>
          <select class="job-eq-approval" ${lockedApproval ? 'disabled' : ''}>
            <option value="not_required" ${(row.approval_status || '') === 'not_required' ? 'selected' : ''}>Not required</option>
            <option value="pending" ${(row.approval_status || '') === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="approved" ${(row.approval_status || '') === 'approved' ? 'selected' : ''}>Approved</option>
            <option value="rejected" ${(row.approval_status || '') === 'rejected' ? 'selected' : ''}>Rejected</option>
          </select>
        </td>
        <td><button type="button" class="secondary job-eq-remove">Remove</button></td>
      `;
      e.jobEquipmentBody.appendChild(tr);
    }

    function collectRequirements() {
      const e = els();
      return Array.from(e.jobEquipmentBody?.querySelectorAll('tr') || []).map((tr) => ({
        name: $('.job-eq-name', tr)?.value?.trim?.() || '',
        pool_key: $('.job-eq-pool', tr)?.value?.trim?.() || '',
        needed_qty: Number($('.job-eq-needed', tr)?.value || 0),
        reserved_qty: Number($('.job-eq-reserved', tr)?.value || 0),
        approval_status: $('.job-eq-approval', tr)?.value || 'not_required'
      })).filter((row) => row.name || row.pool_key);
    }


    function safeLocalSet(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    }

    function safeLocalGet(key) {
      try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
    }

    function saveJobDraft() {
      const e = els();
      safeLocalSet(JOB_DRAFT_KEY, {
        job_code: e.jobCode?.value || '',
        job_name: e.jobName?.value || '',
        site_name: e.jobSiteName?.value || '',
        job_type: e.jobType?.value || '',
        status: e.jobStatus?.value || '',
        priority: e.jobPriority?.value || '',
        start_date: e.jobStartDate?.value || '',
        end_date: e.jobEndDate?.value || '',
        supervisor_name: e.jobSupervisorName?.value || '',
        signing_supervisor_name: e.jobSigningSupervisorName?.value || '',
        admin_name: e.jobAdminName?.value || '',
        client_name: e.jobClientName?.value || '',
        notes: e.jobNotes?.value || '',
        crew_id: e.jobCrewId?.value || '',
        crew_name: e.jobCrewName?.value || '',
        crew_code: e.jobCrewCode?.value || '',
        crew_kind: e.jobCrewKind?.value || 'general',
        assigned_supervisor_name: e.jobAssignedSupervisorName?.value || '',
        crew_lead_name: e.jobCrewLeadName?.value || '',
        job_family: e.jobJobFamily?.value || 'landscaping_standard',
        project_scope: e.jobProjectScope?.value || 'property_service',
        service_pattern: e.jobServicePattern?.value || 'one_time',
        schedule_mode: e.jobScheduleMode?.value || 'standalone',
        recurrence_basis: e.jobRecurrenceBasis?.value || 'calendar_rule',
        recurrence_summary: e.jobRecurrenceSummary?.value || '',
        recurrence_rule: e.jobRecurrenceRule?.value || '',
        recurrence_interval: e.jobRecurrenceInterval?.value || '',
        recurrence_anchor_date: e.jobRecurrenceAnchorDate?.value || '',
        recurrence_custom_days: e.jobRecurrenceCustomDays?.value || '',
        estimated_visit_minutes: e.jobEstimatedVisitMinutes?.value || '',
        service_pricing_template_id: e.jobServicePricingTemplateId?.value || '',
        sales_tax_code_id: e.jobSalesTaxCodeId?.value || '',
        estimated_tax_rate_percent: e.jobEstimatedTaxRatePercent?.value || '',
        reservation_window_start: e.jobReservationWindowStart?.value || '',
        reservation_window_end: e.jobReservationWindowEnd?.value || '',
        equipment_planning_status: e.jobEquipmentPlanningStatus?.value || 'draft',
        equipment_readiness_required: !!e.jobEquipmentReadinessRequired?.checked,
        crew_member_names: e.jobCrewMemberNames?.value || '',
        custom_schedule_notes: e.jobCustomScheduleNotes?.value || '',
        reservation_notes: e.jobReservationNotes?.value || '',
        special_instructions: e.jobSpecialInstructions?.value || '',
        request_approval: !!e.jobRequestApproval?.checked,
        requirements: collectRequirements()
      });
    }

    function saveEquipmentDraft() {
      const e = els();
      safeLocalSet(EQUIPMENT_DRAFT_KEY, {
        equipment_code: e.eqCode?.value || '',
        equipment_name: e.eqName?.value || '',
        category: e.eqCategory?.value || '',
        equipment_pool_key: e.eqPoolKey?.value || '',
        home_site: e.eqHomeSite?.value || '',
        status: e.eqStatus?.value || '',
        current_job_code: e.eqCurrentJobCode?.value || '',
        assigned_supervisor_name: e.eqAssignedSupervisor?.value || '',
        serial_number: e.eqSerial?.value || '',
        asset_tag: e.eqAssetTag?.value || '',
        manufacturer: e.eqManufacturer?.value || '',
        model_number: e.eqModel?.value || '',
        purchase_year: e.eqYear?.value || '',
        purchase_date: e.eqPurchaseDate?.value || '',
        purchase_price: e.eqPurchasePrice?.value || '',
        condition_status: e.eqCondition?.value || '',
        image_url: e.eqImageUrl?.value || '',
        service_interval_days: e.eqServiceIntervalDays?.value || '',
        last_service_date: e.eqLastServiceDate?.value || '',
        next_service_due_date: e.eqNextServiceDueDate?.value || '',
        last_inspection_at: e.eqLastInspectionAt?.value || '',
        next_inspection_due_date: e.eqNextInspectionDueDate?.value || '',
        defect_status: e.eqDefectStatus?.value || '',
        defect_notes: e.eqDefectNotes?.value || '',
        is_locked_out: !!e.eqIsLockedOut?.checked,
        comments: e.eqComments?.value || '',
        notes: e.eqNotes?.value || '',
        worker_signature_name: e.eqWorkerSignature?.value || '',
        supervisor_signature_name: e.eqSupervisorSignature?.value || '',
        admin_signature_name: e.eqAdminSignature?.value || '',
        checkout_condition: e.eqCheckoutCondition?.value || '',
        return_condition: e.eqReturnCondition?.value || '',
        damage_reported: !!e.eqDamageReported?.checked,
        damage_notes: e.eqDamageNotes?.value || ''
      });
    }

    function restoreDrafts() {
      const e = els();
      const jobDraft = safeLocalGet(JOB_DRAFT_KEY);
      const eqDraft = safeLocalGet(EQUIPMENT_DRAFT_KEY);
      if (jobDraft && !state.editingJobId && !e.jobCode?.value && !state.jobs.length) {
        e.jobCode.value = jobDraft.job_code || '';
        e.jobName.value = jobDraft.job_name || '';
        e.jobSiteName.value = jobDraft.site_name || '';
        e.jobType.value = jobDraft.job_type || '';
        e.jobStatus.value = jobDraft.status || 'planned';
        e.jobPriority.value = jobDraft.priority || 'normal';
        e.jobStartDate.value = jobDraft.start_date || '';
        e.jobEndDate.value = jobDraft.end_date || '';
        e.jobSupervisorName.value = jobDraft.supervisor_name || '';
        e.jobSigningSupervisorName.value = jobDraft.signing_supervisor_name || '';
        e.jobAdminName.value = jobDraft.admin_name || '';
        e.jobClientName.value = jobDraft.client_name || '';
        e.jobNotes.value = jobDraft.notes || '';
        e.jobCrewId.value = jobDraft.crew_id || '';
        e.jobCrewName.value = jobDraft.crew_name || '';
        e.jobCrewCode.value = jobDraft.crew_code || '';
        e.jobCrewKind.value = jobDraft.crew_kind || 'general';
        e.jobAssignedSupervisorName.value = jobDraft.assigned_supervisor_name || '';
        e.jobCrewLeadName.value = jobDraft.crew_lead_name || '';
        e.jobJobFamily.value = jobDraft.job_family || 'landscaping_standard';
        e.jobProjectScope.value = jobDraft.project_scope || 'property_service';
        e.jobServicePattern.value = jobDraft.service_pattern || 'one_time';
        e.jobScheduleMode.value = jobDraft.schedule_mode || 'standalone';
        e.jobRecurrenceBasis.value = jobDraft.recurrence_basis || 'calendar_rule';
        e.jobRecurrenceSummary.value = jobDraft.recurrence_summary || '';
        e.jobRecurrenceRule.value = jobDraft.recurrence_rule || '';
        e.jobRecurrenceInterval.value = jobDraft.recurrence_interval || '';
        e.jobRecurrenceAnchorDate.value = jobDraft.recurrence_anchor_date || '';
        e.jobRecurrenceCustomDays.value = jobDraft.recurrence_custom_days || '';
        e.jobEstimatedVisitMinutes.value = jobDraft.estimated_visit_minutes || '';
        if (e.jobServicePricingTemplateId) e.jobServicePricingTemplateId.value = jobDraft.service_pricing_template_id || '';
        if (e.jobSalesTaxCodeId) e.jobSalesTaxCodeId.value = jobDraft.sales_tax_code_id || '';
        if (e.jobEstimatedTaxRatePercent) e.jobEstimatedTaxRatePercent.value = jobDraft.estimated_tax_rate_percent || '';
        e.jobReservationWindowStart.value = jobDraft.reservation_window_start || '';
        e.jobReservationWindowEnd.value = jobDraft.reservation_window_end || '';
        e.jobEquipmentPlanningStatus.value = jobDraft.equipment_planning_status || 'draft';
        e.jobEquipmentReadinessRequired.checked = jobDraft.equipment_readiness_required !== false;
        e.jobCrewMemberNames.value = jobDraft.crew_member_names || '';
        e.jobCustomScheduleNotes.value = jobDraft.custom_schedule_notes || '';
        e.jobReservationNotes.value = jobDraft.reservation_notes || '';
        e.jobSpecialInstructions.value = jobDraft.special_instructions || '';
        e.jobRequestApproval.checked = !!jobDraft.request_approval;
        if (e.jobEquipmentBody) e.jobEquipmentBody.innerHTML = '';
        (Array.isArray(jobDraft.requirements) && jobDraft.requirements.length ? jobDraft.requirements : [{ needed_qty: 1, reserved_qty: 0 }]).forEach(addEquipmentRequirementRow);
        setNotice(e.jobSummary, 'Recovered unsaved job draft from this device.');
      }
      if (eqDraft && !state.editingEquipmentCode && !e.eqCode?.value && !state.equipment.length) {
        e.eqCode.value = eqDraft.equipment_code || '';
        e.eqName.value = eqDraft.equipment_name || '';
        e.eqCategory.value = eqDraft.category || '';
        e.eqPoolKey.value = eqDraft.equipment_pool_key || '';
        e.eqHomeSite.value = eqDraft.home_site || '';
        e.eqStatus.value = eqDraft.status || 'available';
        e.eqCurrentJobCode.value = eqDraft.current_job_code || '';
        e.eqAssignedSupervisor.value = eqDraft.assigned_supervisor_name || '';
        e.eqSerial.value = eqDraft.serial_number || '';
        e.eqAssetTag.value = eqDraft.asset_tag || '';
        e.eqManufacturer.value = eqDraft.manufacturer || '';
        e.eqModel.value = eqDraft.model_number || '';
        e.eqYear.value = eqDraft.purchase_year || '';
        e.eqPurchaseDate.value = eqDraft.purchase_date || '';
        e.eqPurchasePrice.value = eqDraft.purchase_price || '';
        e.eqCondition.value = eqDraft.condition_status || 'ready';
        e.eqImageUrl.value = eqDraft.image_url || '';
        e.eqServiceIntervalDays.value = eqDraft.service_interval_days || '';
        e.eqLastServiceDate.value = eqDraft.last_service_date || '';
        e.eqNextServiceDueDate.value = eqDraft.next_service_due_date || '';
        e.eqLastInspectionAt.value = eqDraft.last_inspection_at || '';
        e.eqNextInspectionDueDate.value = eqDraft.next_inspection_due_date || '';
        e.eqDefectStatus.value = eqDraft.defect_status || 'clear';
        e.eqDefectNotes.value = eqDraft.defect_notes || '';
        e.eqIsLockedOut.checked = !!eqDraft.is_locked_out;
        e.eqComments.value = eqDraft.comments || '';
        e.eqNotes.value = eqDraft.notes || '';
        e.eqWorkerSignature.value = eqDraft.worker_signature_name || '';
        e.eqSupervisorSignature.value = eqDraft.supervisor_signature_name || '';
        e.eqAdminSignature.value = eqDraft.admin_signature_name || '';
        e.eqCheckoutCondition.value = eqDraft.checkout_condition || '';
        e.eqReturnCondition.value = eqDraft.return_condition || '';
        e.eqDamageReported.checked = !!eqDraft.damage_reported;
        e.eqDamageNotes.value = eqDraft.damage_notes || '';
        setNotice(e.eqSummary, 'Recovered unsaved equipment draft from this device.');
      }
    }

    function clearDrafts(kind = 'all') {
      try {
        if (kind === 'all' || kind === 'job') localStorage.removeItem(JOB_DRAFT_KEY);
        if (kind === 'all' || kind === 'equipment') localStorage.removeItem(EQUIPMENT_DRAFT_KEY);
      } catch {}
    }

    function clearJobForm() {
      const e = els();
      state.editingJobId = null;
      state.selectedJobId = null;
      [e.jobCode, e.jobName, e.jobType, e.jobStatus, e.jobPriority, e.jobStartDate, e.jobEndDate, e.jobSupervisorName, e.jobSigningSupervisorName, e.jobAdminName, e.jobClientName, e.jobClientReference, e.jobServiceContractReference, e.jobBillingTransactionNumber, e.jobInvoiceNumber, e.jobCrewId, e.jobCrewName, e.jobCrewCode, e.jobCrewKind, e.jobAssignedSupervisorName, e.jobCrewLeadName, e.jobJobFamily, e.jobProjectScope, e.jobServicePattern, e.jobScheduleMode, e.jobRecurrenceBasis, e.jobRecurrenceSummary, e.jobRecurrenceRule, e.jobRecurrenceInterval, e.jobRecurrenceAnchorDate, e.jobRecurrenceCustomDays, e.jobEstimatedVisitMinutes, e.jobReservationWindowStart, e.jobReservationWindowEnd, e.jobEquipmentPlanningStatus, e.jobCrewMemberNames, e.jobCustomScheduleNotes].forEach((el) => { if (el) el.value = ''; });
      if (e.jobStatus) e.jobStatus.value = 'planned';
      if (e.jobPriority) e.jobPriority.value = 'normal';
      if (e.jobScheduleMode) e.jobScheduleMode.value = 'standalone';
      if (e.jobRecurrenceBasis) e.jobRecurrenceBasis.value = 'calendar_rule';
      if (e.jobJobFamily) e.jobJobFamily.value = 'landscaping_standard';
      if (e.jobProjectScope) e.jobProjectScope.value = 'property_service';
      if (e.jobServicePattern) e.jobServicePattern.value = 'one_time';
      if (e.jobEquipmentPlanningStatus) e.jobEquipmentPlanningStatus.value = 'draft';
      if (e.jobEquipmentReadinessRequired) e.jobEquipmentReadinessRequired.checked = true;
      if (e.jobSiteName) e.jobSiteName.value = '';
      if (e.jobNotes) e.jobNotes.value = '';
      if (e.jobCustomScheduleNotes) e.jobCustomScheduleNotes.value = '';
      if (e.jobReservationNotes) e.jobReservationNotes.value = '';
      if (e.jobSpecialInstructions) e.jobSpecialInstructions.value = '';
      if (e.jobCommentText) e.jobCommentText.value = '';
      if (e.jobCommentFiles) e.jobCommentFiles.value = '';
      if (e.jobRequestApproval) e.jobRequestApproval.checked = false;
      if (e.jobEquipmentBody) e.jobEquipmentBody.innerHTML = '';
      addEquipmentRequirementRow({ needed_qty: 1, reserved_qty: 0 });
      clearDrafts('job');
      renderJobActivity();
      setNotice(e.jobSummary, 'Ready for a new job entry.');
    }

    function clearEquipmentForm() {
      const e = els();
      state.editingEquipmentCode = '';
      [e.eqCode, e.eqName, e.eqCategory, e.eqStatus, e.eqCurrentJobCode, e.eqAssignedSupervisor, e.eqSerial, e.eqPoolKey, e.eqAssetTag, e.eqManufacturer, e.eqModel, e.eqYear, e.eqPurchaseDate, e.eqPurchasePrice, e.eqCondition, e.eqImageUrl, e.eqComments, e.eqWorkerSignature, e.eqSupervisorSignature, e.eqAdminSignature, e.eqCheckoutCondition, e.eqReturnCondition, e.eqDamageNotes].forEach((el) => { if (el) el.value = ''; });
      if (e.eqStatus) e.eqStatus.value = 'available';
      if (e.eqCondition) e.eqCondition.value = 'ready';
      if (e.eqHomeSite) e.eqHomeSite.value = '';
      if (e.eqDamageReported) e.eqDamageReported.checked = false;
      if (e.eqNotes) e.eqNotes.value = '';
      state.checkoutPhotos = [];
      state.returnPhotos = [];
      state.checkoutPhotoFiles = [];
      state.returnPhotoFiles = [];
      if (e.eqCheckoutPhotos) e.eqCheckoutPhotos.value = '';
      if (e.eqReturnPhotos) e.eqReturnPhotos.value = '';
      renderPhotoPreviews();
      clearSignaturePads();
      clearDrafts('equipment');
      setNotice(e.eqSummary, 'Ready for a new equipment entry.');
    }

    function loadJobIntoForm(jobRow) {
      const e = els();
      if (!jobRow) return;
      state.editingJobId = jobRow.id;
      state.selectedJobId = jobRow.id;
      e.jobCode.value = jobRow.job_code || '';
      e.jobName.value = jobRow.job_name || '';
      e.jobSiteName.value = jobRow.site_code || jobRow.site_name || '';
      e.jobType.value = jobRow.job_type || '';
      e.jobStatus.value = jobRow.status || 'planned';
      e.jobPriority.value = jobRow.priority || 'normal';
      e.jobStartDate.value = jobRow.start_date || '';
      e.jobEndDate.value = jobRow.end_date || '';
      e.jobSupervisorName.value = jobRow.supervisor_name || '';
      e.jobSigningSupervisorName.value = jobRow.signing_supervisor_name || '';
      e.jobAdminName.value = jobRow.admin_name || '';
      e.jobClientName.value = jobRow.client_name || '';
      if (e.jobClientReference) e.jobClientReference.value = jobRow.client_reference || '';
      if (e.jobServiceContractReference) e.jobServiceContractReference.value = jobRow.service_contract_reference || '';
      if (e.jobBillingTransactionNumber) e.jobBillingTransactionNumber.value = jobRow.billing_transaction_number || '';
      if (e.jobInvoiceNumber) e.jobInvoiceNumber.value = jobRow.invoice_number || '';
      e.jobNotes.value = jobRow.notes || '';
      e.jobCrewId.value = jobRow.crew_id || '';
      e.jobCrewName.value = jobRow.crew_name || '';
      e.jobCrewCode.value = jobRow.crew_code || '';
      e.jobCrewKind.value = jobRow.crew_kind || 'general';
      e.jobAssignedSupervisorName.value = jobRow.assigned_supervisor_name || jobRow.supervisor_name || '';
      e.jobCrewLeadName.value = jobRow.crew_lead_name || '';
      e.jobJobFamily.value = jobRow.job_family || 'landscaping_standard';
      e.jobProjectScope.value = jobRow.project_scope || 'property_service';
      e.jobServicePattern.value = jobRow.service_pattern || 'one_time';
      e.jobScheduleMode.value = jobRow.schedule_mode || 'standalone';
      e.jobRecurrenceBasis.value = jobRow.recurrence_basis || 'calendar_rule';
      e.jobRecurrenceSummary.value = jobRow.recurrence_summary || '';
      e.jobRecurrenceRule.value = jobRow.recurrence_rule || '';
      e.jobRecurrenceInterval.value = jobRow.recurrence_interval || '';
      e.jobRecurrenceAnchorDate.value = jobRow.recurrence_anchor_date || '';
      e.jobRecurrenceCustomDays.value = jobRow.recurrence_custom_days || '';
      e.jobEstimatedVisitMinutes.value = jobRow.estimated_visit_minutes || '';
      if (e.jobServicePricingTemplateId) e.jobServicePricingTemplateId.value = jobRow.service_pricing_template_id || '';
      if (e.jobSalesTaxCodeId) e.jobSalesTaxCodeId.value = jobRow.sales_tax_code_id || '';
      e.jobEstimatedDurationHours.value = jobRow.estimated_duration_hours || '';
      e.jobEstimatedDurationDays.value = jobRow.estimated_duration_days || '';
      e.jobEstimatedCostTotal.value = jobRow.estimated_cost_total ?? '';
      if (e.jobEstimatedTaxRatePercent) e.jobEstimatedTaxRatePercent.value = jobRow.estimated_tax_rate_percent ?? '';
      if (e.jobEstimatedTaxTotal) e.jobEstimatedTaxTotal.value = jobRow.estimated_tax_total ?? '';
      if (e.jobEstimatedTotalWithTax) e.jobEstimatedTotalWithTax.value = jobRow.estimated_total_with_tax ?? '';
      e.jobQuotedChargeTotal.value = jobRow.quoted_charge_total ?? '';
      e.jobPricingMethod.value = jobRow.pricing_method || 'manual';
      e.jobMarkupPercent.value = jobRow.markup_percent ?? '';
      e.jobDiscountMode.value = jobRow.discount_mode || 'none';
      e.jobDiscountValue.value = jobRow.discount_value ?? '';
      e.jobTieredDiscountNotes.value = jobRow.tiered_discount_notes || '';
      e.jobDelayReason.value = jobRow.delay_reason || '';
      e.jobDelayCostTotal.value = jobRow.delay_cost_total ?? '';
      e.jobEquipmentRepairCostTotal.value = jobRow.equipment_repair_cost_total ?? '';
      e.jobActualCostTotal.value = jobRow.actual_cost_total ?? '';
      e.jobActualChargeTotal.value = jobRow.actual_charge_total ?? '';
      e.jobReservationWindowStart.value = jobRow.reservation_window_start || '';
      e.jobReservationWindowEnd.value = jobRow.reservation_window_end || '';
      e.jobEquipmentPlanningStatus.value = jobRow.equipment_planning_status || 'draft';
      e.jobEquipmentReadinessRequired.checked = jobRow.equipment_readiness_required !== false;
      e.jobOpenEndDate.checked = !!jobRow.open_end_date;
      e.jobDelayedSchedule.checked = !!jobRow.delayed_schedule;
      const selectedCrew = (state.crews || []).find((item) => String(item.id) === String(jobRow.crew_id || '')) || null;
      e.jobCrewMemberNames.value = Array.isArray(selectedCrew?.members_json) ? selectedCrew.members_json.map((item) => item.full_name || item.email || '').filter(Boolean).join(', ') : ''; 
      e.jobCustomScheduleNotes.value = jobRow.custom_schedule_notes || '';
      e.jobReservationNotes.value = jobRow.reservation_notes || selectedCrew?.default_equipment_notes || '';
      e.jobSpecialInstructions.value = jobRow.special_instructions || '';
      e.jobRequestApproval.checked = ['requested','pending'].includes(String(jobRow.approval_status || '').toLowerCase());
      e.jobEquipmentBody.innerHTML = '';
      const reqs = state.requirements.filter((row) => Number(row.job_id) === Number(jobRow.id));
      (reqs.length ? reqs : [{ needed_qty: 1, reserved_qty: 0 }]).forEach(addEquipmentRequirementRow);
      renderJobActivity();
      setNotice(e.jobSummary, `Loaded job ${jobRow.job_code} into the form for editing.`);
      window.YWIRouter?.showSection?.('jobs', { skipFocus: true });
    }

    function loadEquipmentIntoForm(row) {
      const e = els();
      if (!row) return;
      state.editingEquipmentCode = row.equipment_code || '';
      e.eqCode.value = row.equipment_code || '';
      e.eqName.value = row.equipment_name || '';
      e.eqCategory.value = row.category || '';
      e.eqHomeSite.value = row.home_site_code || row.home_site_name || '';
      e.eqStatus.value = row.status || 'available';
      e.eqCurrentJobCode.value = row.current_job_code || '';
      e.eqAssignedSupervisor.value = row.assigned_supervisor_name || '';
      e.eqSerial.value = row.serial_number || '';
      e.eqPoolKey.value = row.equipment_pool_key || '';
      e.eqAssetTag.value = row.asset_tag || '';
      e.eqManufacturer.value = row.manufacturer || '';
      e.eqModel.value = row.model_number || '';
      e.eqYear.value = row.purchase_year || '';
      e.eqPurchaseDate.value = row.purchase_date || '';
      e.eqPurchasePrice.value = row.purchase_price ?? '';
      e.eqCondition.value = row.condition_status || 'ready';
      e.eqImageUrl.value = row.image_url || '';
      e.eqComments.value = row.comments || '';
      e.eqNotes.value = row.notes || '';
      clearSignaturePads();
      setNotice(e.eqSummary, `Loaded equipment ${row.equipment_code} into the form for editing.`);
      window.YWIRouter?.showSection?.('equipment', { skipFocus: true });
    }

    function sortJobs(rows) {
      const sort = state.jobSort || { key: 'start_date', dir: 'desc' };
      const dir = sort.dir === 'asc' ? 1 : -1;
      const key = sort.key || 'start_date';
      const getValue = (row) => {
        switch (key) {
          case 'estimated_duration_hours': return Number(row.estimated_duration_hours || row.total_logged_hours || 0);
          case 'quoted_charge_total': return Number(row.quoted_charge_total || 0);
          case 'start_date': return String(row.start_date || row.last_session_started_at || '');
          case 'service_pattern': return `${row.service_pattern || ''} ${row.recurrence_summary || ''}`.trim();
          default: return row[key] ?? '';
        }
      };
      return [...(rows || [])].sort((a, b) => {
        const av = getValue(a);
        const bv = getValue(b);
        if (typeof av === 'number' || typeof bv === 'number') return (Number(av || 0) - Number(bv || 0)) * dir;
        return String(av || '').localeCompare(String(bv || ''), undefined, { numeric: true, sensitivity: 'base' }) * dir;
      });
    }

    function renderJobTracking() {
      const e = els();
      if (!e.jobSessionBody || !e.jobCrewHoursBody || !e.jobReassignBody) return;
      const activeJobId = Number(state.selectedJobId || state.editingJobId || 0);
      const sessions = (state.jobSessions || []).filter((row) => Number(row.job_id || 0) === activeJobId);
      const hours = (state.jobCrewHours || []).filter((row) => Number(row.job_id || 0) === activeJobId);
      const reassignments = (state.jobReassignments || []).filter((row) => Number(row.source_job_id || 0) === activeJobId || Number(row.target_job_id || 0) === activeJobId);
      if (!activeJobId) {
        e.jobSessionBody.innerHTML = '<tr><td colspan="7" class="muted">Load a job to track sessions.</td></tr>';
        e.jobCrewHoursBody.innerHTML = '<tr><td colspan="8" class="muted">Load a job to log crew hours.</td></tr>';
        e.jobReassignBody.innerHTML = '<tr><td colspan="6" class="muted">Load a job to view reassignments.</td></tr>';
        if (e.jobFinancialBody) e.jobFinancialBody.innerHTML = '<tr><td colspan="7" class="muted">Load a job to view financial events.</td></tr>';
        setNotice(e.jobTrackingSummary, 'Load a job row to record sessions, hours, reassignments, and financial events.');
        return;
      }
      const totalHours = hours.reduce((sum, row) => sum + Number(row.hours_worked || 0), 0);
      const signedCount = sessions.filter((row) => row.site_supervisor_signed_off_at).length;
      setNotice(e.jobTrackingSummary, `${sessions.length} session(s), ${totalHours.toFixed(2)} logged hour(s), ${reassignments.length} reassignment(s), ${signedCount} supervisor signoff(s), labor cost $${Number(financialRollup.labor_cost_total || financialRollup.actual_labor_cost_total || 0).toFixed(2)}, actual rollup profit $${Number(financialRollup.actual_profit_rollup_total || 0).toFixed(2)}.`);
      e.jobSessionBody.innerHTML = sessions.length ? sessions.map((row) => `<tr><td>${escHtml(row.session_date || '')}</td><td>${escHtml(row.started_at_local || row.started_at || '')}</td><td>${escHtml(row.ended_at_local || row.ended_at || '')}</td><td>${escHtml(row.duration_label || row.duration_minutes || '')}</td><td>${escHtml(row.session_status || '')}</td><td>${escHtml(row.site_supervisor_signoff_name || row.site_supervisor_name || '')}${row.site_supervisor_signed_off_at ? ' • Signed' : ''}</td><td><button type="button" class="secondary" data-session-delete="${escHtml(row.id)}">Delete</button></td></tr>`).join('') : '<tr><td colspan="7" class="muted">No sessions logged yet for this job.</td></tr>';
      e.jobCrewHoursBody.innerHTML = hours.length ? hours.map((row) => `<tr><td>${escHtml(row.worker_name || row.profile_name || '')}</td><td>${escHtml(row.session_date || row.job_session_id || '')}</td><td>${escHtml(row.started_at_local || row.started_at || '')}</td><td>${escHtml(row.ended_at_local || row.ended_at || '')}</td><td>${escHtml(row.regular_hours || '')}</td><td>${escHtml(row.overtime_hours || '')}</td><td>${escHtml(row.hours_worked || '')}</td><td><button type="button" class="secondary" data-hours-delete="${escHtml(row.id)}">Delete</button></td></tr>`).join('') : '<tr><td colspan="8" class="muted">No crew hours logged yet for this job.</td></tr>';
      e.jobReassignBody.innerHTML = reassignments.length ? reassignments.map((row) => `<tr><td>${escHtml(row.started_at_local || row.started_at || '')}</td><td>${escHtml(row.source_job_code || '')}</td><td>${escHtml(row.target_job_code || '')}</td><td>${escHtml(row.profile_name || row.equipment_code || row.equipment_name || '')}</td><td>${escHtml(row.reason || '')}</td><td>${row.emergency_override ? 'Yes' : 'No'}</td></tr>`).join('') : '<tr><td colspan="6" class="muted">No reassignment events logged yet for this job.</td></tr>';
      if (e.jobFinancialBody) e.jobFinancialBody.innerHTML = financialEvents.length ? financialEvents.map((row) => `<tr><td>${escHtml(row.event_date || '')}</td><td>${escHtml(row.event_type || '')}</td><td>$${Number(row.cost_amount || 0).toFixed(2)}</td><td>$${Number(row.revenue_amount || 0).toFixed(2)}</td><td>${row.is_billable ? 'Yes' : 'No'}</td><td>${escHtml(row.reference_number || '')}</td><td><button type="button" class="secondary" data-financial-delete="${escHtml(row.id)}">Delete</button></td></tr>`).join('') : '<tr><td colspan="7" class="muted">No financial events logged yet for this job.</td></tr>';
    }

    function renderJobs() {
      const e = els();
      if (!e.jobListBody) return;
      e.jobListBody.innerHTML = '';
      sortJobs(state.jobs).forEach((row) => {
        const tr = document.createElement('tr');
        tr.dataset.jobRow = String(row.id || '');
        tr.tabIndex = 0;
        const quoted = Number(row.quoted_charge_total || 0);
        const estProfit = Number(row.estimated_profit_total || (quoted - Number(row.estimated_cost_total || 0)));
        const duration = Number(row.total_logged_hours || row.estimated_duration_hours || 0);
        const repeat = [row.service_pattern, row.recurrence_summary || row.recurrence_basis].filter(Boolean).join(' • ');
        tr.innerHTML = `<td>${escHtml(row.job_code)}</td><td>${escHtml(row.job_name)}</td><td>${escHtml(row.client_reference || row.client_name || '')}</td><td>${escHtml(row.billing_transaction_number || '')}</td><td>${escHtml(row.invoice_number || '')}</td><td>${escHtml(row.start_date || '')}${row.open_end_date ? ' • Open' : ''}</td><td>${Number.isFinite(duration) && duration ? duration.toFixed(2) : ''}</td><td>${escHtml(repeat)}</td><td>${escHtml(row.status || '')}${row.delayed_schedule ? ' • Delayed' : ''}</td><td>$${Number.isFinite(quoted) ? quoted.toFixed(2) : '0.00'} / Profit $${Number.isFinite(estProfit) ? estProfit.toFixed(2) : '0.00'}</td><td><div class="table-actions"><button type="button" class="secondary" data-job-load="${escHtml(row.id)}">Load</button><button type="button" class="secondary" data-job-session="${escHtml(row.id)}">Session</button><button type="button" class="secondary" data-job-hours="${escHtml(row.id)}">Hours</button><button type="button" class="secondary" data-job-reassign="${escHtml(row.id)}">Reassign</button></div></td>`;
        e.jobListBody.appendChild(tr);
      });
      renderJobTracking();
      renderCommercialWorkflow();
    }

    function getSelectedCommercialContext() {
      const activeJobId = Number(state.selectedJobId || state.editingJobId || 0);
      const jobRow = (state.jobs || []).find((row) => Number(row.id) === activeJobId) || null;
      const workOrders = (state.workOrders || []).filter((row) => Number(row.legacy_job_id || 0) === activeJobId);
      const estimateIds = new Set(workOrders.map((row) => String(row.estimate_id || '')).filter(Boolean));
      const estimates = (state.estimates || []).filter((row) => Number(row.converted_job_id || 0) === activeJobId || estimateIds.has(String(row.id || '')));
      const completionReviews = (state.completionReviews || []).filter((row) => Number(row.job_id || 0) === activeJobId);
      const accountingQueue = (state.accountingQueue || []).filter((row) => Number(row.job_id || 0) === activeJobId);
      const invoiceCandidates = (state.invoiceCandidates || []).filter((row) => String(row.job_id || '') === String(activeJobId));
      const journalCandidates = (state.journalCandidates || []).filter((row) => String(row.job_id || '') === String(activeJobId));
      return { activeJobId, jobRow, workOrders, estimates, completionReviews, accountingQueue, invoiceCandidates, journalCandidates };
    }

    function renderCommercialWorkflow() {
      const e = els();
      if (!e.jobEstimateBody || !e.jobWorkOrderBody || !e.jobCompletionReviewBody || !e.jobAccountingQueueBody) return;
      const { activeJobId, jobRow, workOrders, estimates, completionReviews, accountingQueue } = getSelectedCommercialContext();
      const quotePackages = (state.quotePackages || []).filter((row) => estimates.some((est) => String(est.id || '') === String(row.estimate_id || '')));
      const releaseReviews = (state.workOrderReleaseReviews || []).filter((row) => workOrders.some((wo) => String(wo.id || '') === String(row.work_order_id || '')));
      const closeoutItems = (state.completionPackageItems || []).filter((row) => completionReviews.some((cr) => String(cr.id || '') === String(row.completion_review_id || '')));
      const invoiceCandidates = (state.invoiceCandidates || []).filter((row) => String(row.job_id || '') === String(activeJobId));
      const journalCandidates = (state.journalCandidates || []).filter((row) => String(row.job_id || '') === String(activeJobId));
      const arapQueue = (state.arapReviewQueue || []).filter((row) => String(row.job_id || '') === String(activeJobId));
      const scorecards = (state.profitabilityScorecards || []).filter((row) => ['site','supervisor','route','job_family'].includes(String(row.group_type || '')));
      const quoteOutputRows = (state.quoteOutputRows || []).filter((row) => estimates.some((est) => String(est.id || '') === String(row.estimate_id || '')));
      const thresholdEvaluations = (state.thresholdEvaluations || []).filter((row) => workOrders.some((wo) => String(wo.id || '') === String(row.work_order_id || '')));
      const closeoutEvidence = (state.closeoutEvidence || []).filter((row) => completionReviews.some((cr) => String(cr.id || '') === String(row.completion_review_id || '')));
      const signoffSteps = (state.completionSignoffSteps || []).filter((row) => completionReviews.some((cr) => String(cr.id || '') === String(row.completion_review_id || '')));
      const invoicePostings = (state.invoicePostings || []).filter((row) => String(row.job_id || '') === String(activeJobId));
      const journalPostings = (state.journalPostings || []).filter((row) => String(row.job_id || '') === String(activeJobId));
      const accountantExports = (state.accountantHandoffExports || []).filter((row) => completionReviews.some((cr) => String(cr.id || '') === String(row.entity_id || '')));
      const varianceRows = (state.profitabilityVariance || []).filter((row) => ['job','site','supervisor','route','job_family'].includes(String(row.group_type || '')));
      const managementRows = (state.profitabilityManagement || []).filter((row) => ['site','supervisor','route','job_family'].includes(String(row.group_type || '')));
      if (!activeJobId || !jobRow) {
        e.jobEstimateBody.innerHTML = '<tr><td colspan="7" class="muted">Load a job to manage estimates.</td></tr>';
        e.jobWorkOrderBody.innerHTML = '<tr><td colspan="7" class="muted">Load a job to manage work orders.</td></tr>';
        e.jobCompletionReviewBody.innerHTML = '<tr><td colspan="7" class="muted">Load a job to manage completion review.</td></tr>';
        e.jobAccountingQueueBody.innerHTML = '<tr><td colspan="5" class="muted">Load a job to review accounting readiness.</td></tr>';
        e.jobQuotePackageBody.innerHTML = '<tr><td colspan="6" class="muted">Load a job to review quote packages.</td></tr>';
        e.jobReleaseReviewBody.innerHTML = '<tr><td colspan="6" class="muted">Load a job to review release controls.</td></tr>';
        e.jobCloseoutItemBody.innerHTML = '<tr><td colspan="6" class="muted">Load a job to review closeout items.</td></tr>';
        e.jobSignoffStepBody.innerHTML = '<tr><td colspan="6" class="muted">Load a job to review completion signoff steps.</td></tr>';
        e.jobQuoteOutputBody.innerHTML = '<tr><td colspan="5" class="muted">Load a job to review quote output.</td></tr>';
        e.jobThresholdEvalBody.innerHTML = '<tr><td colspan="6" class="muted">Load a job to review threshold evaluations.</td></tr>';
        e.jobCloseoutEvidenceBody.innerHTML = '<tr><td colspan="5" class="muted">Load a job to review closeout evidence.</td></tr>';
        e.jobInvoiceCandidateBody.innerHTML = '<tr><td colspan="5" class="muted">Load a job to review invoice candidates.</td></tr>';
        e.jobJournalCandidateBody.innerHTML = '<tr><td colspan="4" class="muted">Load a job to review journal candidates.</td></tr>';
        e.jobArapQueueBody.innerHTML = '<tr><td colspan="4" class="muted">Load a job to review AR/AP coordination.</td></tr>';
        e.jobInvoicePostingBody.innerHTML = '<tr><td colspan="5" class="muted">Load a job to review invoice postings.</td></tr>';
        e.jobJournalPostingBody.innerHTML = '<tr><td colspan="5" class="muted">Load a job to review journal postings.</td></tr>';
        e.jobAccountantExportBody.innerHTML = '<tr><td colspan="5" class="muted">Load a job to review accountant handoff exports.</td></tr>';
        e.jobVarianceBody.innerHTML = '<tr><td colspan="8" class="muted">Load a job to review profitability and variance.</td></tr>';
        e.jobProfitabilityScorecardBody.innerHTML = '<tr><td colspan="7" class="muted">Load a job to review profitability scorecards.</td></tr>';
        e.jobManagementScorecardBody.innerHTML = '<tr><td colspan="6" class="muted">Load a job to review management scorecards.</td></tr>';
        setNotice(e.jobCommercialSummary, '');
        return;
      }
      e.jobEstimateBody.innerHTML = estimates.length ? estimates.map((row) => `<tr><td>${escHtml(row.estimate_number || '')}</td><td>${escHtml(row.client_name || '')}</td><td>${escHtml(row.status || '')}</td><td>${escHtml(row.approval_status || '')}</td><td>$${Number(row.total_amount || 0).toFixed(2)}</td><td>$${Number(row.margin_estimate_total || row.line_margin_total || 0).toFixed(2)}</td><td>${escHtml(row.converted_work_order_number || row.converted_job_code || '')}</td></tr>`).join('') : '<tr><td colspan="7" class="muted">No commercial estimate package linked to this job yet.</td></tr>';
      e.jobWorkOrderBody.innerHTML = workOrders.length ? workOrders.map((row) => `<tr><td>${escHtml(row.work_order_number || '')}</td><td>${escHtml(row.estimate_number || '')}</td><td>${escHtml(row.status || '')}</td><td>${escHtml(row.completion_review_status || '')}</td><td>${escHtml(row.accounting_trigger_status || '')}</td><td>$${Number(row.total_amount || 0).toFixed(2)}</td><td>$${Number(row.margin_estimate_total || row.line_margin_total || 0).toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="7" class="muted">No linked work order yet.</td></tr>';
      e.jobCompletionReviewBody.innerHTML = completionReviews.length ? completionReviews.map((row) => `<tr><td>${escHtml(row.job_code || '')}</td><td>${escHtml(row.review_status || '')}</td><td>${escHtml(row.completion_date || '')}</td><td>$${Number(row.revenue_total || 0).toFixed(2)}</td><td>$${Number(row.cost_total || 0).toFixed(2)}</td><td>$${Number(row.profit_total || 0).toFixed(2)}</td><td>${row.accounting_ready ? 'Ready' : escHtml(row.accounting_trigger_status || '')}</td></tr>`).join('') : '<tr><td colspan="7" class="muted">No completion review yet.</td></tr>';
      e.jobAccountingQueueBody.innerHTML = accountingQueue.length ? accountingQueue.map((row) => `<tr><td>${escHtml(row.job_code || '')}</td><td>${escHtml(row.review_status || '')}</td><td>${escHtml(row.accounting_trigger_status || '')}</td><td>$${Number(row.profit_total || 0).toFixed(2)}</td><td>${escHtml(row.last_accounting_action || row.last_accounting_event_status || '')}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">This job is not queued for accounting yet.</td></tr>';
      e.jobQuotePackageBody.innerHTML = quotePackages.length ? quotePackages.map((row) => `<tr><td>${escHtml(row.estimate_number || '')}</td><td>${escHtml(row.rendered_title || row.quote_title || '')}</td><td>${escHtml(row.tax_profile_name || row.legal_entity_type || '')}</td><td>${escHtml(row.package_status || '')}</td><td>${escHtml(row.sent_at || '')}</td><td>${escHtml(row.accepted_at || '')}</td></tr>`).join('') : '<tr><td colspan="6" class="muted">No quote package yet.</td></tr>';
      e.jobQuoteOutputBody.innerHTML = quoteOutputRows.length ? quoteOutputRows.map((row) => `<tr><td>${escHtml(row.estimate_number || '')}</td><td>${escHtml(row.brand_name || '')}</td><td>${escHtml(row.package_status || '')}</td><td>${escHtml(row.email_subject || '')}</td><td>${escHtml(row.last_output_event_at || row.last_rendered_at || '')}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">No branded quote output yet.</td></tr>';
      e.jobReleaseReviewBody.innerHTML = releaseReviews.length ? releaseReviews.map((row) => `<tr><td>${escHtml(row.work_order_number || '')}</td><td>${escHtml(row.release_status || '')}</td><td>${escHtml(row.threshold_status || '')}</td><td>${Number(row.discount_percent || 0).toFixed(2)}</td><td>${Number(row.margin_percent || 0).toFixed(2)}</td><td>${escHtml(row.required_signoff_role || '')}</td></tr>`).join('') : '<tr><td colspan="6" class="muted">No release review yet.</td></tr>';
      e.jobThresholdEvalBody.innerHTML = thresholdEvaluations.length ? thresholdEvaluations.map((row) => `<tr><td>${escHtml(row.threshold_name || '')}</td><td>${escHtml(row.evaluated_status || '')}</td><td>${Number(row.discount_percent || 0).toFixed(2)}</td><td>${Number(row.margin_percent || 0).toFixed(2)}</td><td>$${Number(row.total_amount || 0).toFixed(2)}</td><td>${escHtml(row.evaluation_message || '')}</td></tr>`).join('') : '<tr><td colspan="6" class="muted">No threshold evaluations yet.</td></tr>';
      e.jobCloseoutItemBody.innerHTML = closeoutItems.length ? closeoutItems.map((row) => `<tr><td>${escHtml(row.label || '')}</td><td>${escHtml(row.item_type || '')}</td><td>${escHtml(row.item_status || '')}</td><td>${row.required_item ? 'Yes' : 'No'}</td><td>${escHtml(row.due_at || '')}</td><td>${escHtml(row.completed_at || row.completed_by_name || '')}</td></tr>`).join('') : '<tr><td colspan="6" class="muted">No closeout items yet.</td></tr>';
      e.jobSignoffStepBody.innerHTML = signoffSteps.length ? signoffSteps.map((row) => `<tr><td>${escHtml(row.signoff_kind || '')}</td><td>${escHtml(row.signoff_status || '')}</td><td>${escHtml(row.required_role || '')}</td><td>${escHtml(row.signoff_display_name || '')}</td><td>${escHtml(row.signed_at || '')}</td><td>${escHtml(row.signoff_notes || '')}</td></tr>`).join('') : '<tr><td colspan="6" class="muted">No completion signoff steps yet.</td></tr>';
      e.jobCloseoutEvidenceBody.innerHTML = closeoutEvidence.length ? closeoutEvidence.map((row) => `<tr><td>${escHtml(row.label || row.resolved_file_name || '')}</td><td>${escHtml(row.asset_kind || '')}</td><td>${escHtml(row.notes || row.resolved_caption || '')}</td><td>${escHtml(row.source_table || row.resolved_asset_url || row.asset_url || '')}</td><td>${escHtml(row.created_at || '')}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">No closeout evidence linked yet.</td></tr>';
      e.jobInvoiceCandidateBody.innerHTML = invoiceCandidates.length ? invoiceCandidates.map((row) => `<tr><td>${escHtml(row.candidate_number || '')}</td><td>${escHtml(row.candidate_status || '')}</td><td>${escHtml(row.tax_profile_name || row.legal_entity_type || '')}</td><td>$${Number(row.total_amount || 0).toFixed(2)}</td><td>${escHtml(row.client_name || '')}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">No invoice candidates yet.</td></tr>';
      e.jobJournalCandidateBody.innerHTML = journalCandidates.length ? journalCandidates.map((row) => `<tr><td>${escHtml(row.job_code || '')}</td><td>${escHtml(row.candidate_status || '')}</td><td>${escHtml(row.tax_profile_name || row.legal_entity_type || '')}</td><td>${escHtml(row.journal_memo || '')}</td></tr>`).join('') : '<tr><td colspan="4" class="muted">No journal candidates yet.</td></tr>';
      e.jobArapQueueBody.innerHTML = arapQueue.length ? arapQueue.map((row) => `<tr><td>${escHtml(row.source_type || '')}</td><td>${escHtml(row.queue_status || '')}</td><td>${escHtml(row.assigned_name || '')}</td><td>${escHtml(row.notes || '')}</td></tr>`).join('') : '<tr><td colspan="4" class="muted">No AR/AP review items yet.</td></tr>';
      e.jobAccountantExportBody.innerHTML = accountantExports.length ? accountantExports.map((row) => `<tr><td>${escHtml(row.export_kind || '')}</td><td>${escHtml(row.export_status || '')}</td><td>${escHtml(row.export_title || '')}</td><td>${escHtml(row.legal_entity_name || row.tax_profile_name || row.legal_entity_type || '')}</td><td>${escHtml(row.generated_at || '')}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">No accountant handoff exports yet.</td></tr>';
      e.jobVarianceBody.innerHTML = varianceRows.length ? varianceRows.map((row) => `<tr><td>${escHtml(row.group_type || '')}</td><td>${escHtml(row.group_label || '')}</td><td>$${Number(row.quoted_total || 0).toFixed(2)}</td><td>$${Number(row.estimated_cost_total || 0).toFixed(2)}</td><td>$${Number(row.actual_revenue_total || 0).toFixed(2)}</td><td>$${Number(row.actual_cost_total || 0).toFixed(2)}</td><td>$${Number(row.revenue_variance_total || 0).toFixed(2)}</td><td>$${Number(row.cost_variance_total || 0).toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="8" class="muted">No variance rows yet.</td></tr>';
      e.jobProfitabilityScorecardBody.innerHTML = scorecards.length ? scorecards.map((row) => `<tr><td>${escHtml(row.group_type || '')}</td><td>${escHtml(row.group_label || '')}</td><td>${Number(row.job_count || 0)}</td><td>$${Number(row.revenue_total || 0).toFixed(2)}</td><td>$${Number(row.cost_total || 0).toFixed(2)}</td><td>$${Number(row.profit_total || 0).toFixed(2)}</td><td>${Number(row.margin_percent || 0).toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="7" class="muted">No profitability scorecards available yet.</td></tr>';
      setNotice(e.jobCommercialSummary, `Commercial package for ${jobRow.job_code || jobRow.job_name}: ${estimates.length} estimate(s), ${workOrders.length} work order(s), ${completionReviews.length} completion review(s), ${quotePackages.length} quote package(s), ${thresholdEvaluations.length} threshold evaluation(s), ${invoiceCandidates.length} invoice candidate(s), ${journalCandidates.length} journal candidate(s), ${accountantExports.length} accountant export(s).`);
    }

    async function createEstimateFromJob() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      if (!ctx.jobRow) return setNotice(e.jobCommercialSummary, 'Load a job before creating an estimate.', true);
      const estimateNumber = window.prompt('Estimate number:', `EST-${String(ctx.jobRow.job_code || ctx.jobRow.id).replace(/[^A-Z0-9]/gi, '').toUpperCase()}`) || '';
      if (!estimateNumber) return;
      const quoteTitle = window.prompt('Quote / estimate title:', ctx.jobRow.job_name || '') || '';
      const clientName = window.prompt('Client name for this estimate:', ctx.jobRow.client_name || ctx.jobRow.client_reference || '') || '';
      const subtotal = Number(window.prompt('Subtotal before tax:', String(ctx.jobRow.quoted_charge_total || 0)) || '0');
      const taxTotal = Number(window.prompt('Tax total:', String(ctx.jobRow.estimated_tax_total || 0)) || '0');
      const totalAmount = Number(window.prompt('Total amount:', String((Number(subtotal||0) + Number(taxTotal||0)).toFixed(2))) || '0');
      const resp = await api.manageAdminEntity({ entity: 'estimate', action: 'create', estimate_number: estimateNumber, quote_title: quoteTitle, estimate_type: ctx.jobRow.job_type || 'service', status: 'draft', subtotal, tax_total: taxTotal, total_amount: totalAmount, approval_required: true, approval_status: 'draft', scope_notes: ctx.jobRow.notes || '', internal_notes: `Created from job ${ctx.jobRow.job_code || ctx.jobRow.id}.`, client_notes: clientName ? `Client: ${clientName}` : '' });
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'Estimate create failed.', true);
      setNotice(e.jobCommercialSummary, `Estimate ${resp.record?.estimate_number || estimateNumber} created.`);
      await loadData();
    }

    async function addEstimateLineFromSelectedJob() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      const estimate = ctx.estimates[0];
      if (!estimate?.id) return setNotice(e.jobCommercialSummary, 'Create or convert an estimate first.', true);
      const description = window.prompt('Estimate line description:', ctx.jobRow?.job_name || 'Service line') || '';
      if (!description) return;
      const quantity = Number(window.prompt('Quantity:', '1') || '1');
      const unitCost = Number(window.prompt('Unit cost:', String(ctx.jobRow?.estimated_cost_total || 0)) || '0');
      const unitPrice = Number(window.prompt('Unit price:', String(ctx.jobRow?.quoted_charge_total || 0)) || '0');
      const resp = await api.manageAdminEntity({ entity: 'estimate_line', action: 'create', estimate_id: estimate.id, line_order: (state.estimateLines || []).filter((row) => String(row.estimate_id||'')===String(estimate.id)).length + 1, description, quantity, unit_cost: unitCost, unit_price: unitPrice, pricing_basis_label: 'job-derived' });
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'Estimate line create failed.', true);
      setNotice(e.jobCommercialSummary, 'Estimate line added.');
      await loadData();
    }

    async function convertEstimateToJobPackage() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      const estimate = ctx.estimates.find((row) => !row.converted_job_id) || ctx.estimates[0];
      if (!estimate?.id) return setNotice(e.jobCommercialSummary, 'Create an estimate first.', true);
      const resp = await api.manageAdminEntity({ entity: 'estimate', action: 'convert_to_job_package', item_id: estimate.id, job_code: ctx.jobRow?.job_code, job_name: ctx.jobRow?.job_name, start_date: ctx.jobRow?.start_date, client_name: ctx.jobRow?.client_name });
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'Estimate conversion failed.', true);
      setNotice(e.jobCommercialSummary, `Estimate converted to ${resp.job?.job_code || ''} / ${resp.work_order?.work_order_number || ''}.`);
      await loadData();
    }

    async function createOrUpdateCompletionReview() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      if (!ctx.jobRow) return setNotice(e.jobCommercialSummary, 'Load a job first.', true);
      const workOrder = ctx.workOrders[0] || null;
      const existing = ctx.completionReviews[0] || null;
      const revenueTotal = Number(window.prompt('Completion revenue total:', String(ctx.jobRow.actual_charge_rollup_total || ctx.jobRow.actual_charge_total || ctx.jobRow.quoted_charge_total || 0)) || '0');
      const costTotal = Number(window.prompt('Completion cost total:', String(ctx.jobRow.actual_cost_rollup_total || ctx.jobRow.actual_cost_total || ctx.jobRow.estimated_cost_total || 0)) || '0');
      const reviewStatus = window.prompt('Review status (draft, pending, approved, rejected, ready_for_accounting, posted):', existing?.review_status || 'pending') || 'pending';
      const completionDate = window.prompt('Completion date (YYYY-MM-DD):', existing?.completion_date || ctx.jobRow.end_date || new Date().toISOString().slice(0,10)) || '';
      const varianceSummary = window.prompt('Variance summary:', existing?.variance_summary || '') || '';
      const payload = { entity: 'job_completion_review', action: existing?.id ? 'update' : 'create', item_id: existing?.id, job_id: ctx.jobRow.id, work_order_id: workOrder?.id || null, estimate_id: ctx.estimates[0]?.id || null, review_status: reviewStatus, completion_date: completionDate, completion_notes: ctx.jobRow.notes || '', closeout_evidence_complete: true, supervisor_signoff_complete: true, all_sessions_signed_off: true, revenue_total: revenueTotal, cost_total: costTotal, variance_summary: varianceSummary, accounting_ready: reviewStatus === 'ready_for_accounting', accounting_trigger_status: reviewStatus === 'ready_for_accounting' ? 'queued' : 'pending' };
      const resp = await api.manageAdminEntity(payload);
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'Completion review save failed.', true);
      setNotice(e.jobCommercialSummary, 'Completion review saved.');
      await loadData();
    }

    async function queueSelectedJobForAccounting() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      const review = ctx.completionReviews[0];
      if (!review?.id) return setNotice(e.jobCommercialSummary, 'Create a completion review first.', true);
      const resp = await api.manageAdminEntity({ entity: 'job_completion_review', action: 'queue_accounting', item_id: review.id, memo: 'Queued from Jobs commercial workflow.' });
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'Accounting queue action failed.', true);
      setNotice(e.jobCommercialSummary, 'Job queued for accounting review.');
      await loadData();
    }


    async function renderSelectedQuotePackage() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      const estimate = ctx.estimates[0];
      if (!estimate?.id) return setNotice(e.jobCommercialSummary, 'Create an estimate first.', true);
      const taxProfile = (state.businessTaxSettings || [])[0] || null;
      const resp = await api.manageAdminEntity({ entity: 'estimate_quote_package', action: 'render_from_estimate', estimate_id: estimate.id, business_tax_setting_id: taxProfile?.id || null, rendered_title: estimate.quote_title || estimate.estimate_number });
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'Quote package render failed.', true);
      setNotice(e.jobCommercialSummary, `Quote package rendered for ${estimate.estimate_number || ''}.`);
      await loadData();
    }


    async function printSelectedQuotePackage() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      const pkg = (state.quotePackages || []).find((row) => ctx.estimates.some((est) => String(est.id || '') === String(row.estimate_id || '')));
      if (!pkg?.id) return setNotice(e.jobCommercialSummary, 'Render a quote package first.', true);
      await api.manageAdminEntity({ entity: 'estimate_quote_package', action: 'mark_printed', item_id: pkg.id });
      const html = String(pkg.printable_html || pkg.rendered_html || '').trim();
      if (!html) return setNotice(e.jobCommercialSummary, 'No printable quote content is available yet.', true);
      try {
        const win = window.open('', '_blank', 'noopener,noreferrer,width=980,height=820');
        if (win) {
          win.document.open();
          win.document.write(html);
          win.document.close();
          win.focus();
        }
      } catch {}
      try { await navigator.clipboard.writeText(html); setNotice(e.jobCommercialSummary, 'Printable quote HTML opened in a new window and copied to clipboard.'); } catch { setNotice(e.jobCommercialSummary, 'Printable quote HTML opened in a new window.'); }
      console.log(html);
      await loadData();
    }

    async function sendSelectedQuotePackage() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      const pkg = (state.quotePackages || []).find((row) => ctx.estimates.some((est) => String(est.id || '') === String(row.estimate_id || '')));
      if (!pkg?.id) return setNotice(e.jobCommercialSummary, 'Render a quote package first.', true);
      const email = window.prompt('Recipient email:', pkg.client_email || '') || '';
      if (!email) return;
      const resp = await api.manageAdminEntity({ entity: 'estimate_quote_package', action: 'send_quote_output', item_id: pkg.id, client_email: email, output_type: 'email', recipient_email: email, email_subject: pkg.email_subject || null });
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'Quote send flag failed.', true);
      setNotice(e.jobCommercialSummary, resp.delivered ? 'Quote package sent by email.' : 'Quote package send recorded.');
      await loadData();
    }

    async function evaluateSelectedThresholds() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      const workOrder = ctx.workOrders[0];
      if (!workOrder?.id) return setNotice(e.jobCommercialSummary, 'Convert an estimate to a work order first.', true);
      const resp = await api.manageAdminEntity({ entity: 'work_order_release_review', action: 'evaluate_thresholds', work_order_id: workOrder.id, estimate_id: workOrder.estimate_id || null, discount_percent: Number(workOrder.discount_value || 0), margin_percent: Number(workOrder.margin_estimate_percent || 0), job_family: ctx.jobRow?.job_family || null, release_notes: `Automatic threshold evaluation for ${workOrder.work_order_number || workOrder.id}.` });
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'Threshold evaluation failed.', true);
      setNotice(e.jobCommercialSummary, `${resp.message || 'Thresholds evaluated.'} Result: ${resp.threshold_status || ''}.`);
      await loadData();
    }

    async function addCloseoutEvidenceToSelectedReview() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      const item = (state.completionPackageItems || []).find((row) => ctx.completionReviews.some((cr) => String(cr.id || '') === String(row.completion_review_id || '')) && String(row.item_type || '') === 'evidence') || (ctx.completionReviews[0] ? (state.completionPackageItems || []).find((row) => String(row.completion_review_id || '') === String(ctx.completionReviews[0].id || '')) : null);
      if (!item?.id) return setNotice(e.jobCommercialSummary, 'Add a closeout item first.', true);
      const sourceTable = window.prompt('Evidence source table (job_comment_attachments, submission_images, equipment_evidence_assets) or leave blank for a direct URL:', '') || '';
      const sourceId = sourceTable ? (window.prompt('Source row id:', '') || '') : '';
      const assetUrl = sourceTable ? '' : (window.prompt('Evidence URL or storage path:', '') || '');
      if (!sourceTable && !assetUrl) return;
      const label = window.prompt('Evidence label:', 'Closeout evidence') || 'Closeout evidence';
      const resp = await api.manageAdminEntity({ entity: 'job_completion_closeout_asset', action: 'create', closeout_item_id: item.id, asset_kind: sourceTable ? 'file' : 'url', label, asset_url: assetUrl, source_table: sourceTable || null, source_id: sourceId || null, notes: `Linked from Jobs commercial workflow for ${ctx.jobRow?.job_code || item.id}.` });
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'Closeout evidence link failed.', true);
      setNotice(e.jobCommercialSummary, 'Closeout evidence linked.');
      await loadData();
    }

    async function exportSelectedAccountantHandoff() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      const review = ctx.completionReviews[0];
      if (!review?.id) return setNotice(e.jobCommercialSummary, 'Create a completion review first.', true);
      const taxProfile = (state.businessTaxSettings || [])[0] || null;
      const exportKind = window.prompt('Export kind (t2_package, llc_package, closeout_bundle, invoice_review, journal_review):', taxProfile?.legal_entity_type === 'llc_us' ? 'llc_package' : 't2_package') || 'closeout_bundle';
      const resp = await api.manageAdminEntity({ entity: 'job_completion_review', action: 'export_accountant_handoff', item_id: review.id, business_tax_setting_id: taxProfile?.id || null, export_kind: exportKind });
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'Accountant handoff export failed.', true);
      const summary = String(resp.export_markdown || '').trim();
      if (summary) {
        try {
          const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=780');
          if (win) {
            win.document.open();
            win.document.write(`<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;padding:20px;">${summary.replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre>`);
            win.document.close();
          }
        } catch {}
        try { await navigator.clipboard.writeText(summary); setNotice(e.jobCommercialSummary, 'Accountant handoff opened in a new window and copied to clipboard.'); } catch { console.log(summary); setNotice(e.jobCommercialSummary, 'Accountant handoff generated. Check the new window or console output.'); }
      }
      await loadData();
    }

    async function reviewOrReleaseSelectedWorkOrder() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      const workOrder = ctx.workOrders[0];
      if (!workOrder?.id) return setNotice(e.jobCommercialSummary, 'Convert an estimate to a work order first.', true);
      const discountPercent = Number(window.prompt('Discount percent for release review:', String(workOrder.discount_value || 0)) || '0');
      const marginPercent = Number(window.prompt('Margin percent for release review:', String(workOrder.margin_estimate_percent || 0)) || '0');
      const threshold = (state.approvalThresholds || []).find((row) => row.applies_to_scope === 'global' || String(row.applies_to_value || '') === String(ctx.jobRow?.job_family || ''));
      const thresholdStatus = threshold?.hard_block && threshold.minimum_margin_percent != null && marginPercent < Number(threshold.minimum_margin_percent || 0) ? 'block' : ((threshold?.minimum_margin_percent != null && marginPercent < Number(threshold.minimum_margin_percent || 0)) || (threshold?.discount_percent_cap != null && discountPercent > Number(threshold.discount_percent_cap || 0)) ? 'warn' : 'pass');
      const requiredSignoffRole = threshold?.required_signoff_role || (thresholdStatus === 'pass' ? 'supervisor' : 'admin');
      const existing = (state.workOrderReleaseReviews || []).find((row) => String(row.work_order_id || '') === String(workOrder.id || ''));
      const releaseNow = window.confirm(`Threshold result: ${thresholdStatus}. Required signoff: ${requiredSignoffRole}. Click OK to release now, or Cancel to only save the review.`);
      const action = releaseNow ? 'release' : (existing?.id ? 'update' : 'create');
      const resp = await api.manageAdminEntity({ entity: 'work_order_release_review', action, item_id: existing?.id, work_order_id: workOrder.id, estimate_id: workOrder.estimate_id || null, release_status: releaseNow ? 'released' : 'pending', threshold_status: thresholdStatus, discount_percent: discountPercent, margin_percent: marginPercent, required_signoff_role: requiredSignoffRole, release_notes: `Commercial release review for ${workOrder.work_order_number || workOrder.id}.` });
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'Release review failed.', true);
      setNotice(e.jobCommercialSummary, releaseNow ? 'Work order released.' : 'Release review saved.');
      await loadData();
    }

    async function addCloseoutItemToSelectedReview() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      const review = ctx.completionReviews[0];
      if (!review?.id) return setNotice(e.jobCommercialSummary, 'Create a completion review first.', true);
      const label = window.prompt('Closeout item label:', 'Supervisor signoff package') || '';
      if (!label) return;
      const itemType = window.prompt('Item type (evidence, supervisor_signoff, client_signoff, variance_explanation, session_closeout, materials, equipment, other):', 'evidence') || 'evidence';
      const resp = await api.manageAdminEntity({ entity: 'job_completion_closeout_item', action: 'create', completion_review_id: review.id, label, item_type: itemType, item_status: 'pending', required_item: true });
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'Closeout item create failed.', true);
      setNotice(e.jobCommercialSummary, 'Closeout item added.');
      await loadData();
    }

    async function createInvoiceCandidateForSelectedReview() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      const review = ctx.completionReviews[0];
      if (!review?.id) return setNotice(e.jobCommercialSummary, 'Create a completion review first.', true);
      const taxProfile = (state.businessTaxSettings || [])[0] || null;
      const totalAmount = Number(window.prompt('Invoice candidate total amount:', String(review.revenue_total || 0)) || '0');
      const taxTotal = Number(window.prompt('Invoice candidate tax amount:', '0') || '0');
      const resp = await api.manageAdminEntity({ entity: 'job_completion_review', action: 'create_invoice_candidate', item_id: review.id, business_tax_setting_id: taxProfile?.id || null, total_amount: totalAmount + taxTotal, subtotal: totalAmount, tax_total: taxTotal });
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'Invoice candidate create failed.', true);
      setNotice(e.jobCommercialSummary, `Invoice candidate ${resp.record?.candidate_number || ''} created.`);
      await loadData();
    }

    async function createJournalCandidateForSelectedReview() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      const review = ctx.completionReviews[0];
      if (!review?.id) return setNotice(e.jobCommercialSummary, 'Create a completion review first.', true);
      const taxProfile = (state.businessTaxSettings || [])[0] || null;
      const resp = await api.manageAdminEntity({ entity: 'job_completion_review', action: 'create_journal_candidate', item_id: review.id, business_tax_setting_id: taxProfile?.id || null, journal_memo: `Commercial closeout journal for ${ctx.jobRow?.job_code || review.job_id}` });
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'Journal candidate create failed.', true);
      setNotice(e.jobCommercialSummary, 'Journal candidate created.');
      await loadData();
    }

    async function queueArapReviewForSelectedReview() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      const review = ctx.completionReviews[0];
      if (!review?.id) return setNotice(e.jobCommercialSummary, 'Create a completion review first.', true);
      const resp = await api.manageAdminEntity({ entity: 'job_completion_review', action: 'queue_ar_ap_review', item_id: review.id, notes: 'Queued from Jobs commercial workflow.' });
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'AR/AP review queue failed.', true);
      setNotice(e.jobCommercialSummary, 'AR/AP review queued.');
      await loadData();
    }

    async function exportSelectedCloseoutSummary() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      const review = ctx.completionReviews[0];
      if (!review?.id) return setNotice(e.jobCommercialSummary, 'Create a completion review first.', true);
      const resp = await api.manageAdminEntity({ entity: 'job_completion_review', action: 'export_closeout_summary', item_id: review.id });
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'Closeout summary export failed.', true);
      const summary = String(resp.export_markdown || '').trim();
      if (!summary) return setNotice(e.jobCommercialSummary, 'No closeout summary was returned.', true);
      try {
        await navigator.clipboard.writeText(summary);
        setNotice(e.jobCommercialSummary, 'Closeout summary copied to clipboard.');
      } catch {
        setNotice(e.jobCommercialSummary, 'Closeout summary generated. Check the console output.');
      }
      console.log(summary);
    }



    async function addSignoffStepToSelectedReview() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      const review = ctx.completionReviews[0];
      if (!review?.id) return setNotice(e.jobCommercialSummary, 'Create a completion review first.', true);
      const signoff_kind = window.prompt('Signoff kind (field_supervisor, operations_manager, client, accounting, safety, other):', 'field_supervisor') || 'field_supervisor';
      const required_role = window.prompt('Required role for this signoff:', signoff_kind === 'client' ? 'client' : 'supervisor') || '';
      const notes = window.prompt('Signoff notes / instructions:', '') || '';
      const resp = await api.manageAdminEntity({ entity: 'job_completion_signoff_step', action: 'create', completion_review_id: review.id, signoff_kind, required_role, signoff_notes: notes });
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'Signoff step create failed.', true);
      setNotice(e.jobCommercialSummary, 'Completion signoff step added.');
      await loadData();
    }

    async function signSelectedCompletionStep() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      const step = (state.completionSignoffSteps || []).find((row) => ctx.completionReviews.some((cr) => String(cr.id || '') === String(row.completion_review_id || '')) && String(row.signoff_status || '') !== 'signed');
      if (!step?.id) return setNotice(e.jobCommercialSummary, 'No pending signoff step was found for this completion review.', true);
      const signoff_name = window.prompt('Signoff name:', step.signoff_display_name || '') || '';
      const signoff_notes = window.prompt('Signoff notes:', step.signoff_notes || '') || '';
      const resp = await api.manageAdminEntity({ entity: 'job_completion_signoff_step', action: 'sign', item_id: step.id, signoff_name, signoff_notes });
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'Completion signoff failed.', true);
      setNotice(e.jobCommercialSummary, 'Completion signoff recorded.');
      await loadData();
    }

    async function postSelectedInvoiceCandidate() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      const candidate = ctx.invoiceCandidates?.[0] || (state.invoiceCandidates || []).find((row) => String(row.job_id || '') === String(ctx.activeJobId || ''));
      if (!candidate?.id) return setNotice(e.jobCommercialSummary, 'Create an invoice candidate first.', true);
      const external_invoice_number = window.prompt('External invoice number:', candidate.candidate_number || '') || candidate.candidate_number || '';
      const resp = await api.manageAdminEntity({ entity: 'job_invoice_candidate', action: 'post_candidate', item_id: candidate.id, external_system: 'manual', external_invoice_number, notes: 'Posted from Jobs commercial workflow.' });
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'Invoice posting failed.', true);
      setNotice(e.jobCommercialSummary, 'Invoice candidate posted into AR/AP workflow.');
      await loadData();
    }

    async function postSelectedJournalCandidate() {
      const e = els();
      const ctx = getSelectedCommercialContext();
      const candidate = ctx.journalCandidates?.[0] || (state.journalCandidates || []).find((row) => String(row.job_id || '') === String(ctx.activeJobId || ''));
      if (!candidate?.id) return setNotice(e.jobCommercialSummary, 'Create a journal candidate first.', true);
      const journal_entry_number = window.prompt('Journal entry number:', '') || '';
      const batch_number = window.prompt('Batch number:', '') || '';
      const resp = await api.manageAdminEntity({ entity: 'job_journal_candidate', action: 'post_candidate', item_id: candidate.id, external_system: 'manual', journal_entry_number, batch_number, notes: 'Posted from Jobs commercial workflow.' });
      if (!resp?.ok) return setNotice(e.jobCommercialSummary, resp?.error || 'Journal posting failed.', true);
      setNotice(e.jobCommercialSummary, 'Journal candidate posted into GL workflow.');
      await loadData();
    }

    function renderGallery(signoutId = null) {
      const e = els();
      if (!e.eqGallery) return;
      const row = state.signouts.find((item) => Number(item.id) === Number(signoutId || state.selectedGallerySignoutId));
      if (!row || !Array.isArray(row.evidence_assets) || !row.evidence_assets.length) {
        e.eqGallery.innerHTML = '<span class="muted">Select a history row gallery to view equipment evidence.</span>';
        setNotice(e.eqGallerySummary, signoutId ? 'No evidence assets were found for that checkout / return record.' : '');
        return;
      }
      state.selectedGallerySignoutId = Number(row.id);
      e.eqGallery.innerHTML = `
        <div class="form-footer" style="margin-bottom:10px;">
          <button type="button" class="secondary" data-gallery-select-all="1">Select all</button>
          <button type="button" class="secondary" data-gallery-bulk-delete="${escHtml(row.id)}">Delete selected</button>
        </div>
      ` + row.evidence_assets.map((asset) => `
        <div class="evidence-asset-card">
          <label class="muted" style="display:flex;gap:6px;align-items:center;font-size:12px;"><input type="checkbox" data-gallery-asset="${escHtml(asset.id)}" />Select</label>
          <a href="${escHtml(asset.public_url || asset.storage_path || '#')}" target="_blank" rel="noopener">
            <img src="${escHtml(asset.public_url || asset.storage_path || '')}" alt="${escHtml(asset.caption || asset.evidence_kind || 'Evidence asset')}" class="evidence-thumb" />
          </a>
          <div class="muted" style="font-size:12px;">${escHtml(asset.stage || '')} • ${escHtml(asset.evidence_kind || '')} ${asset.signer_role ? `• ${escHtml(asset.signer_role)}` : ''}</div>
          <div class="muted" style="font-size:12px;">${escHtml(asset.caption || '')}</div>
          <div class="muted" style="font-size:12px;">Progress: Ready</div>
          <div class="form-footer" style="margin-top:8px;">
            <label class="secondary" style="cursor:pointer;">Replace<input type="file" accept="image/*" data-replace-evidence="${escHtml(asset.id)}" data-signout-id="${escHtml(row.id)}" data-stage="${escHtml(asset.stage || 'return')}" data-kind="${escHtml(asset.evidence_kind || 'photo')}" data-role="${escHtml(asset.signer_role || '')}" style="display:none;" /></label>
            <button type="button" class="secondary" data-delete-evidence="${escHtml(asset.id)}">Delete</button>
          </div>
        </div>
      `).join('');
      setNotice(e.eqGallerySummary, `Viewing ${row.evidence_assets.length} evidence asset(s) for ${row.equipment_code || row.equipment_item_id}. Use Select all and Delete selected for bulk cleanup.`);
    }

    function renderEquipment() {
      const e = els();
      if (e.eqListBody) {
        e.eqListBody.innerHTML = '';
        state.equipment.forEach((row) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${escHtml(row.equipment_code)}</td><td>${escHtml(row.equipment_name)}</td><td>${escHtml(row.status)}</td><td>${escHtml(row.serial_number || '')}</td><td>${escHtml(row.equipment_pool_key || '')}</td><td>${escHtml(row.next_service_due_date || '')}</td><td>${escHtml(row.next_inspection_due_date || '')}</td><td>${row.is_locked_out ? 'Yes' : 'No'}</td><td><button type="button" class="secondary" data-equipment-load="${escHtml(row.equipment_code)}">Load</button></td>`;
          e.eqListBody.appendChild(tr);
        });
      }
      if (e.eqPoolBody) {
        e.eqPoolBody.innerHTML = '';
        state.pools.forEach((row) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${escHtml(row.equipment_pool_key)}</td><td>${escHtml(row.category || '')}</td><td>${escHtml(row.total_qty)}</td><td>${escHtml(row.available_qty)}</td><td>${escHtml(row.reserved_qty)}</td><td>${escHtml(row.checked_out_qty)}</td>`;
          e.eqPoolBody.appendChild(tr);
        });
      }
      if (e.eqHistoryBody) {
        e.eqHistoryBody.innerHTML = '';
        state.signouts.forEach((row) => {
          const tr = document.createElement('tr');
          const photoCount = Number(row.checkout_photo_count || 0) + Number(row.return_photo_count || 0);
          tr.innerHTML = `<td>${escHtml(row.equipment_code || row.equipment_item_id || '')}</td><td>${escHtml(row.job_code || row.job_id || '')}</td><td>${escHtml(row.checked_out_at || '')}</td><td>${escHtml(row.returned_at || '')}</td><td>${escHtml(row.checkout_worker_signature_name || row.return_worker_signature_name || '')}</td><td>${escHtml(row.checkout_supervisor_signature_name || row.return_supervisor_signature_name || '')}</td><td>${escHtml(row.checkout_admin_signature_name || row.return_admin_signature_name || '')}</td><td>${escHtml(row.checkout_condition || '')}${row.return_condition ? ` → ${escHtml(row.return_condition)}` : ''}</td><td>${photoCount ? `<button type="button" class="secondary" data-view-gallery="${escHtml(row.id)}">View (${photoCount})</button>` : '—'}</td><td>${row.damage_reported ? escHtml(row.damage_notes || 'Damage noted') : '—'}</td>`;
          e.eqHistoryBody.appendChild(tr);
        });
      }
      if (e.eqInspectionBody) {
        e.eqInspectionBody.innerHTML = '';
        state.inspections.forEach((row) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${escHtml(row.equipment_code || '')}</td><td>${escHtml(row.inspected_at || '')}</td><td>${escHtml(row.inspection_status || '')}</td><td>${escHtml(row.inspector_name || '')}</td><td>${escHtml(row.next_due_date || '')}</td><td>${escHtml(row.notes || '')}</td>`;
          e.eqInspectionBody.appendChild(tr);
        });
      }
      renderGallery();
      if (e.eqMaintenanceBody) {
        e.eqMaintenanceBody.innerHTML = '';
        state.maintenance.forEach((row) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${escHtml(row.equipment_code || '')}</td><td>${escHtml(row.performed_at || '')}</td><td>${escHtml(row.maintenance_type || '')}</td><td>${escHtml(row.provider_name || '')}</td><td>${escHtml(row.cost_amount || '')}</td><td>${escHtml(row.notes || '')}</td>`;
          e.eqMaintenanceBody.appendChild(tr);
        });
      }
    }



    async function saveJobComment() {
      const e = els();
      const activeJobId = Number(state.selectedJobId || state.editingJobId || 0);
      if (!activeJobId) {
        setNotice(e.jobActivitySummary, 'Save or load a job before posting activity updates.', true);
        return;
      }
      try {
        const resp = await api.manageJobsEntity({
          entity: 'job_comment',
          action: 'create',
          job_id: activeJobId,
          comment_type: e.jobCommentType?.value || 'update',
          comment_text: e.jobCommentText?.value?.trim?.() || '',
          is_special_instruction: !!e.jobCommentSpecialInstruction?.checked,
          visible_to_client: !!e.jobCommentVisibleToClient?.checked,
          set_job_instruction: !!e.jobCommentSpecialInstruction?.checked
        });
        if (!resp?.ok || !resp?.record?.id) throw new Error(resp?.error || 'Failed to save job comment');
        const files = Array.from(e.jobCommentFiles?.files || []);
        let attachmentWarning = '';
        if (files.length && api?.uploadJobCommentAttachmentBatch) {
          try {
            await api.uploadJobCommentAttachmentBatch(files.map((file) => ({ commentId: resp.record.id, attachmentKind: file.type.startsWith('image/') ? 'photo' : 'file', file })));
          } catch (uploadErr) {
            attachmentWarning = String(uploadErr?.message || 'Attachment upload failed.');
          }
        }
        if (e.jobCommentText) e.jobCommentText.value = '';
        if (e.jobCommentFiles) e.jobCommentFiles.value = '';
        if (e.jobCommentSpecialInstruction) e.jobCommentSpecialInstruction.checked = false;
        if (e.jobCommentVisibleToClient) e.jobCommentVisibleToClient.checked = false;
        setNotice(e.jobActivitySummary, attachmentWarning ? `Job update saved, but attachment upload needs review. ${attachmentWarning}` : 'Job update saved.', !!attachmentWarning);
        await loadData();
      } catch (err) {
        setNotice(e.jobActivitySummary, err?.message || 'Failed to save job update.', true);
      }
    }

    async function deleteJobComment(commentId) {
      const e = els();
      if (!commentId) return;
      try {
        await api.manageJobsEntity({ entity: 'job_comment', action: 'delete', item_id: commentId });
        setNotice(e.jobActivitySummary, 'Job update deleted.');
        await loadData();
      } catch (err) {
        setNotice(e.jobActivitySummary, err?.message || 'Failed to delete job update.', true);
      }
    }

    async function deleteEvidenceAsset(assetId) {
      if (!assetId) return;
      setNotice(els().eqGallerySummary, 'Deleting evidence asset…');
      await api.manageJobsEntity({ entity: 'equipment_evidence_asset', action: 'delete', asset_id: assetId });
      await loadData();
      renderGallery(state.selectedGallerySignoutId);
    }

    async function bulkDeleteEvidenceAssets(signoutId) {
      const selected = Array.from(document.querySelectorAll('[data-gallery-asset]:checked')).map((el) => Number(el.value || el.dataset.galleryAsset || 0)).filter(Boolean);
      if (!selected.length) {
        setNotice(els().eqGallerySummary, 'Select one or more evidence assets first.');
        return;
      }
      setNotice(els().eqGallerySummary, `Deleting ${selected.length} selected evidence asset(s)…`);
      for (const assetId of selected) {
        await api.manageJobsEntity({ entity: 'equipment_evidence_asset', action: 'delete', asset_id: assetId });
      }
      await loadData();
      renderGallery(signoutId || state.selectedGallerySignoutId);
    }

    async function replaceEvidenceAsset(inputEl) {
      const file = inputEl?.files?.[0];
      if (!file) return;
      const assetId = Number(inputEl.dataset.replaceEvidence || 0);
      const signoutId = Number(inputEl.dataset.signoutId || 0);
      if (!assetId || !signoutId) return;
      setNotice(els().eqGallerySummary, 'Replacing evidence asset… Upload in progress.');
      await api.manageJobsEntity({ entity: 'equipment_evidence_asset', action: 'delete', asset_id: assetId });
      await api.uploadEquipmentEvidenceBatch([{ signoutId, stage: inputEl.dataset.stage || 'return', evidenceKind: inputEl.dataset.kind || 'photo', signerRole: inputEl.dataset.role || '', caption: 'Replacement evidence upload', file }]);
      await loadData();
      renderGallery(signoutId);
      setNotice(els().eqGallerySummary, 'Evidence asset replaced successfully.');
    }

    async function loadData() {
      const e = els();
      try {
        const resp = await api.fetchJobsDirectory({ scope: 'all' });
        state.jobs = Array.isArray(resp?.jobs) ? resp.jobs : [];
        state.equipment = Array.isArray(resp?.equipment) ? resp.equipment : [];
        state.requirements = Array.isArray(resp?.requirements) ? resp.requirements : [];
        state.crews = Array.isArray(resp?.crews) ? resp.crews : [];
        state.crewMembers = Array.isArray(resp?.crew_members) ? resp.crew_members : [];
        state.profiles = Array.isArray(resp?.profiles) ? resp.profiles : [];
        state.jobComments = Array.isArray(resp?.job_comments) ? resp.job_comments : [];
        state.jobCommentAttachments = Array.isArray(resp?.job_comment_attachments) ? resp.job_comment_attachments : [];
        state.jobSessions = Array.isArray(resp?.job_sessions) ? resp.job_sessions : [];
        state.jobCrewHours = Array.isArray(resp?.job_crew_hours) ? resp.job_crew_hours : [];
        state.jobReassignments = Array.isArray(resp?.job_reassignments) ? resp.job_reassignments : [];
        state.jobFinancialEvents = Array.isArray(resp?.job_financial_events) ? resp.job_financial_events : [];
        state.jobFinancialRollups = Array.isArray(resp?.job_financial_rollups) ? resp.job_financial_rollups : [];
        state.signouts = Array.isArray(resp?.signouts) ? resp.signouts : [];
        state.pools = Array.isArray(resp?.pools) ? resp.pools : [];
        state.notifications = Array.isArray(resp?.notifications) ? resp.notifications : [];
        state.inspections = Array.isArray(resp?.inspections) ? resp.inspections : [];
        state.maintenance = Array.isArray(resp?.maintenance) ? resp.maintenance : [];
        state.servicePricingTemplates = Array.isArray(resp?.service_pricing_templates) ? resp.service_pricing_templates : [];
        state.taxCodes = Array.isArray(resp?.tax_codes) ? resp.tax_codes : [];
        state.businessTaxSettings = Array.isArray(resp?.business_tax_settings) ? resp.business_tax_settings : [];
        state.estimates = Array.isArray(resp?.estimates) ? resp.estimates : [];
        state.estimateLines = Array.isArray(resp?.estimate_lines) ? resp.estimate_lines : [];
        state.workOrders = Array.isArray(resp?.work_orders) ? resp.work_orders : [];
        state.workOrderLines = Array.isArray(resp?.work_order_lines) ? resp.work_order_lines : [];
        state.completionReviews = Array.isArray(resp?.job_completion_reviews) ? resp.job_completion_reviews : [];
        state.accountingQueue = Array.isArray(resp?.job_accounting_ready_queue) ? resp.job_accounting_ready_queue : [];
        state.commercialApprovals = Array.isArray(resp?.commercial_approval_events) ? resp.commercial_approval_events : [];
        state.quotePackages = Array.isArray(resp?.quote_packages) ? resp.quote_packages : [];
        state.approvalThresholds = Array.isArray(resp?.commercial_approval_thresholds) ? resp.commercial_approval_thresholds : [];
        state.workOrderReleaseReviews = Array.isArray(resp?.work_order_release_reviews) ? resp.work_order_release_reviews : [];
        state.completionPackageItems = Array.isArray(resp?.completion_package_items) ? resp.completion_package_items : [];
        state.invoiceCandidates = Array.isArray(resp?.invoice_candidates) ? resp.invoice_candidates : [];
        state.journalCandidates = Array.isArray(resp?.journal_candidates) ? resp.journal_candidates : [];
        state.arapReviewQueue = Array.isArray(resp?.ar_ap_review_queue) ? resp.ar_ap_review_queue : [];
        state.profitabilityScorecards = Array.isArray(resp?.profitability_scorecards) ? resp.profitability_scorecards : [];
        state.quoteOutputRows = Array.isArray(resp?.quote_output_rows) ? resp.quote_output_rows : [];
        state.thresholdEvaluations = Array.isArray(resp?.threshold_evaluations) ? resp.threshold_evaluations : [];
        state.closeoutEvidence = Array.isArray(resp?.closeout_evidence) ? resp.closeout_evidence : [];
        state.invoicePostingRules = Array.isArray(resp?.invoice_posting_rules) ? resp.invoice_posting_rules : [];
        state.journalPostingRules = Array.isArray(resp?.journal_posting_rules) ? resp.journal_posting_rules : [];
        state.accountantHandoffExports = Array.isArray(resp?.accountant_handoff_exports) ? resp.accountant_handoff_exports : [];
        state.profitabilityVariance = Array.isArray(resp?.profitability_variance) ? resp.profitability_variance : [];
        state.completionSignoffSteps = Array.isArray(resp?.completion_signoff_steps) ? resp.completion_signoff_steps : [];
        state.invoicePostings = Array.isArray(resp?.invoice_postings) ? resp.invoice_postings : [];
        state.journalPostings = Array.isArray(resp?.journal_postings) ? resp.journal_postings : [];
        state.profitabilityManagement = Array.isArray(resp?.profitability_management) ? resp.profitability_management : [];
        fillSiteSelect(e.jobSiteName);
        fillSiteSelect(e.eqHomeSite);
        fillCrewSelect(e.jobCrewId);
        fillServiceTemplateSelect(e.jobServicePricingTemplateId);
        fillTaxCodeSelect(e.jobSalesTaxCodeId);
        fillEmployeeDataList();
        renderJobs();
        renderEquipment();
        renderRequirementReviewPanel();
        renderJobActivity();
        renderJobTracking();
      renderCommercialWorkflow();
        setNotice(e.jobSummary, `Loaded ${state.jobs.length} jobs and ${state.requirements.length} requirements.`);
        setNotice(e.eqSummary, `Loaded ${state.equipment.length} equipment items across ${state.pools.length} pools.`);
      } catch (err) {
        setNotice(e.jobSummary, err?.message || 'Failed to load jobs.', true);
        setNotice(e.eqSummary, err?.message || 'Failed to load equipment.', true);
      }
    }

    async function recordJobSession(jobRow = null) {
      const e = els();
      try {
        const activeJob = jobRow || (state.jobs || []).find((row) => Number(row.id) === Number(state.selectedJobId || state.editingJobId || 0));
        if (!activeJob?.id) throw new Error('Load a job before recording a session.');
        const session_date = window.prompt('Session date (YYYY-MM-DD):', activeJob.start_date || new Date().toISOString().slice(0, 10)) || '';
        const started_at = window.prompt('Session start (YYYY-MM-DD HH:MM):', `${session_date} 08:00`) || '';
        const ended_at = window.prompt('Session end (YYYY-MM-DD HH:MM):', `${session_date} 12:00`) || '';
        const session_status = window.prompt('Session status (planned, in_progress, completed, delayed, paused, cancelled):', 'completed') || 'completed';
        const delay_minutes = window.prompt('Delay minutes:', activeJob.delayed_schedule ? '15' : '0') || '0';
        const site_supervisor_signoff_name = window.prompt('Site supervisor signoff name:', activeJob.signing_supervisor_name || activeJob.assigned_supervisor_name || activeJob.supervisor_name || '') || '';
        const site_supervisor_signoff_notes = window.prompt('Supervisor signoff notes:', '') || '';
        const notes = window.prompt('Session notes:', activeJob.special_instructions || '') || '';
        const resp = await api.manageJobsEntity({ entity: 'job_session', action: 'create', job_id: activeJob.id, session_date, started_at, ended_at, session_status, delay_minutes: Number(delay_minutes || 0), site_supervisor_signoff_name, site_supervisor_signoff_notes, notes, service_frequency_label: activeJob.service_pattern || '' });
        if (!resp?.ok) throw new Error(resp?.error || 'Session tracking failed');
        setNotice(e.jobTrackingSummary, `Session recorded for ${activeJob.job_code}.`);
        await loadData();
      } catch (err) {
        setNotice(e.jobTrackingSummary, err?.message || 'Session tracking failed.', true);
      }
    }

    async function logCrewHours(jobRow = null) {
      const e = els();
      try {
        const activeJob = jobRow || (state.jobs || []).find((row) => Number(row.id) === Number(state.selectedJobId || state.editingJobId || 0));
        if (!activeJob?.id) throw new Error('Load a job before logging crew hours.');
        const selectedCrew = (state.crews || []).find((item) => String(item.id) === String(activeJob.crew_id || '')) || null;
        const suggestedWorker = Array.isArray(selectedCrew?.members_json) && selectedCrew.members_json.length ? (selectedCrew.members_json[0].full_name || selectedCrew.members_json[0].email || '') : '';
        const worker_name = window.prompt('Crew member name or email:', suggestedWorker) || '';
        if (!worker_name.trim()) throw new Error('Crew member name is required.');
        const latestSession = (state.jobSessions || []).filter((row) => Number(row.job_id || 0) === Number(activeJob.id)).sort((a,b) => String(b.started_at || '').localeCompare(String(a.started_at || '')))[0] || null;
        const started_at = window.prompt('Hours start (YYYY-MM-DD HH:MM):', latestSession?.started_at_local || latestSession?.started_at || `${new Date().toISOString().slice(0,10)} 08:00`) || '';
        const ended_at = window.prompt('Hours end (YYYY-MM-DD HH:MM):', latestSession?.ended_at_local || latestSession?.ended_at || `${new Date().toISOString().slice(0,10)} 12:00`) || '';
        const regular_hours = window.prompt('Regular hours:', '4') || '0';
        const overtime_hours = window.prompt('Overtime hours:', '0') || '0';
        const notes = window.prompt('Crew hour notes:', '') || '';
        const resp = await api.manageJobsEntity({ entity: 'job_crew_time', action: 'create', job_id: activeJob.id, crew_id: activeJob.crew_id || null, worker_name, profile_name: worker_name, job_session_id: latestSession?.id || null, started_at, ended_at, regular_hours: Number(regular_hours || 0), overtime_hours: Number(overtime_hours || 0), notes });
        if (!resp?.ok) throw new Error(resp?.error || 'Crew hour logging failed');
        setNotice(e.jobTrackingSummary, `Crew hours logged for ${worker_name}.`);
        await loadData();
      } catch (err) {
        setNotice(e.jobTrackingSummary, err?.message || 'Crew hour logging failed.', true);
      }
    }


    async function recordJobFinancialEvent(jobRow = null) {
      const e = els();
      try {
        const activeJob = jobRow || (state.jobs || []).find((row) => Number(row.id) === Number(state.selectedJobId || state.editingJobId || 0));
        if (!activeJob?.id) throw new Error('Load a job before recording a cost or revenue event.');
        const event_date = window.prompt('Event date (YYYY-MM-DD):', new Date().toISOString().slice(0, 10)) || '';
        const event_type = window.prompt('Event type (material, equipment_repair, delay, fuel, travel, subcontract, disposal, permit, revenue_adjustment, discount_adjustment, other):', 'material') || 'other';
        const cost_amount = window.prompt('Cost amount:', '0') || '0';
        const revenue_amount = window.prompt('Revenue amount:', '0') || '0';
        const is_billable = window.confirm('Is this event billable to the client?');
        const reference_number = window.prompt('Reference / receipt / invoice number:', '') || '';
        const notes = window.prompt('Notes:', '') || '';
        const resp = await api.manageJobsEntity({ entity: 'job_financial_event', action: 'create', job_id: activeJob.id, event_date, event_type, cost_amount: Number(cost_amount || 0), revenue_amount: Number(revenue_amount || 0), is_billable, reference_number, notes });
        if (!resp?.ok) throw new Error(resp?.error || 'Financial event save failed.');
        await loadData();
      } catch (err) {
        setNotice(e.jobTrackingSummary, err?.message || 'Failed to record job financial event.', true);
      }
    }

    async function reassignJobResources(jobRow = null) {
      const e = els();
      try {
        const activeJob = jobRow || (state.jobs || []).find((row) => Number(row.id) === Number(state.selectedJobId || state.editingJobId || 0));
        if (!activeJob?.id) throw new Error('Load a job before creating a reassignment.');
        const target_job_code = window.prompt('Target job code:', '') || '';
        if (!target_job_code.trim()) throw new Error('A target job code is required.');
        const equipment_code = window.prompt('Equipment code to reassign (leave blank if reassigning a crew member):', '') || '';
        const profile_name = equipment_code ? '' : (window.prompt('Crew member name or email to reassign:', '') || '');
        if (!equipment_code.trim() && !profile_name.trim()) throw new Error('Provide either an equipment code or a crew member name.');
        const reason = window.prompt('Reason for reassignment:', 'Emergency split / service contract support') || '';
        const service_contract_reference = window.prompt('Service contract / override reference:', activeJob.service_contract_reference || '') || '';
        const emergency_override = window.confirm('Mark this reassignment as an emergency override?');
        const resp = await api.manageJobsEntity({ entity: 'job_reassignment', action: 'create', source_job_id: activeJob.id, source_job_code: activeJob.job_code, target_job_code, equipment_code: equipment_code.trim() || null, profile_name: profile_name.trim() || null, reason, emergency_override, service_contract_reference });
        if (!resp?.ok) throw new Error(resp?.error || 'Reassignment failed');
        setNotice(e.jobTrackingSummary, `Reassignment recorded from ${activeJob.job_code} to ${target_job_code}.`);
        await loadData();
      } catch (err) {
        setNotice(e.jobTrackingSummary, err?.message || 'Reassignment failed.', true);
      }
    }

    async function saveJob() {
      const e = els();
      try {
        const payload = {
          entity: 'job',
          action: 'upsert',
          job_code: e.jobCode?.value?.trim?.() || '',
          job_name: e.jobName?.value?.trim?.() || '',
          site_name: e.jobSiteName?.value?.trim?.() || '',
          job_type: e.jobType?.value?.trim?.() || '',
          status: e.jobStatus?.value?.trim?.() || 'planned',
          priority: e.jobPriority?.value?.trim?.() || 'normal',
          start_date: e.jobStartDate?.value || null,
          end_date: e.jobEndDate?.value || null,
          supervisor_name: e.jobSupervisorName?.value?.trim?.() || '',
          assigned_supervisor_name: e.jobAssignedSupervisorName?.value?.trim?.() || e.jobSupervisorName?.value?.trim?.() || '',
          signing_supervisor_name: e.jobSigningSupervisorName?.value?.trim?.() || '',
          admin_name: e.jobAdminName?.value?.trim?.() || '',
          client_name: e.jobClientName?.value?.trim?.() || '',
          client_reference: e.jobClientReference?.value?.trim?.() || '',
          service_contract_reference: e.jobServiceContractReference?.value?.trim?.() || '',
          billing_transaction_number: e.jobBillingTransactionNumber?.value?.trim?.() || '',
          invoice_number: e.jobInvoiceNumber?.value?.trim?.() || '',
          notes: e.jobNotes?.value?.trim?.() || '',
          crew_id: e.jobCrewId?.value || '',
          crew_name: e.jobCrewName?.value?.trim?.() || '',
          crew_code: e.jobCrewCode?.value?.trim?.() || '',
          crew_kind: e.jobCrewKind?.value || 'general',
          crew_lead_name: e.jobCrewLeadName?.value?.trim?.() || '',
          job_family: e.jobJobFamily?.value || 'landscaping_standard',
          project_scope: e.jobProjectScope?.value || 'property_service',
          service_pattern: e.jobServicePattern?.value || 'one_time',
          schedule_mode: e.jobScheduleMode?.value || 'standalone',
          recurrence_basis: e.jobRecurrenceBasis?.value || 'calendar_rule',
          recurrence_summary: e.jobRecurrenceSummary?.value?.trim?.() || '',
          recurrence_rule: e.jobRecurrenceRule?.value?.trim?.() || '',
          recurrence_interval: e.jobRecurrenceInterval?.value ? Number(e.jobRecurrenceInterval.value) : null,
          recurrence_anchor_date: e.jobRecurrenceAnchorDate?.value || null,
          recurrence_custom_days: e.jobRecurrenceCustomDays?.value?.trim?.() || '',
          estimated_visit_minutes: e.jobEstimatedVisitMinutes?.value ? Number(e.jobEstimatedVisitMinutes.value) : null,
          estimated_duration_hours: e.jobEstimatedDurationHours?.value ? Number(e.jobEstimatedDurationHours.value) : null,
          estimated_duration_days: e.jobEstimatedDurationDays?.value ? Number(e.jobEstimatedDurationDays.value) : null,
          estimated_cost_total: e.jobEstimatedCostTotal?.value ? Number(e.jobEstimatedCostTotal.value) : 0,
          quoted_charge_total: e.jobQuotedChargeTotal?.value ? Number(e.jobQuotedChargeTotal.value) : 0,
          pricing_method: e.jobPricingMethod?.value || 'manual',
          markup_percent: e.jobMarkupPercent?.value ? Number(e.jobMarkupPercent.value) : null,
          discount_mode: e.jobDiscountMode?.value || 'none',
          discount_value: e.jobDiscountValue?.value ? Number(e.jobDiscountValue.value) : 0,
          tiered_discount_notes: e.jobTieredDiscountNotes?.value?.trim?.() || '',
          open_end_date: !!e.jobOpenEndDate?.checked,
          delayed_schedule: !!e.jobDelayedSchedule?.checked,
          delay_reason: e.jobDelayReason?.value?.trim?.() || '',
          delay_cost_total: e.jobDelayCostTotal?.value ? Number(e.jobDelayCostTotal.value) : 0,
          equipment_repair_cost_total: e.jobEquipmentRepairCostTotal?.value ? Number(e.jobEquipmentRepairCostTotal.value) : 0,
          actual_cost_total: e.jobActualCostTotal?.value ? Number(e.jobActualCostTotal.value) : 0,
          actual_charge_total: e.jobActualChargeTotal?.value ? Number(e.jobActualChargeTotal.value) : 0,
          reservation_window_start: e.jobReservationWindowStart?.value || null,
          reservation_window_end: e.jobReservationWindowEnd?.value || null,
          equipment_planning_status: e.jobEquipmentPlanningStatus?.value || 'draft',
          equipment_readiness_required: !!e.jobEquipmentReadinessRequired?.checked,
          crew_member_names: e.jobCrewMemberNames?.value?.trim?.() || '',
          custom_schedule_notes: e.jobCustomScheduleNotes?.value?.trim?.() || '',
          reservation_notes: e.jobReservationNotes?.value?.trim?.() || '',
          special_instructions: e.jobSpecialInstructions?.value?.trim?.() || '',
          request_approval: !!e.jobRequestApproval?.checked,
          requirements: collectRequirements()
        };
        const resp = await api.manageJobsEntity(payload);
        if (!resp?.ok) throw new Error(resp?.error || 'Job save failed');
        clearDrafts('job');
        state.selectedJobId = Number(resp?.record?.id || state.selectedJobId || 0);
        const estProfit = Number(resp?.record?.estimated_profit_total || 0);
        setNotice(e.jobSummary, `Job ${payload.job_code} saved. Pricing, crew, schedule, and reservation checks were applied. Estimated profit: $${Number.isFinite(estProfit) ? estProfit.toFixed(2) : '0.00'}.`);
        await loadData();
      } catch (err) {
        setNotice(e.jobSummary, err?.message || 'Failed to save job.', true);
      }
    }

    async function saveEquipment() {
      const e = els();
      try {
        const resp = await api.manageJobsEntity({
          entity: 'equipment',
          action: 'upsert',
          equipment_code: e.eqCode?.value?.trim?.() || '',
          equipment_name: e.eqName?.value?.trim?.() || '',
          category: e.eqCategory?.value?.trim?.() || '',
          home_site: e.eqHomeSite?.value?.trim?.() || '',
          status: e.eqStatus?.value?.trim?.() || 'available',
          current_job_code: e.eqCurrentJobCode?.value?.trim?.() || '',
          assigned_supervisor_name: e.eqAssignedSupervisor?.value?.trim?.() || '',
          serial_number: e.eqSerial?.value?.trim?.() || '',
          equipment_pool_key: e.eqPoolKey?.value?.trim?.() || '',
          asset_tag: e.eqAssetTag?.value?.trim?.() || '',
          manufacturer: e.eqManufacturer?.value?.trim?.() || '',
          model_number: e.eqModel?.value?.trim?.() || '',
          purchase_year: e.eqYear?.value ? Number(e.eqYear.value) : null,
          purchase_date: e.eqPurchaseDate?.value || null,
          purchase_price: e.eqPurchasePrice?.value ? Number(e.eqPurchasePrice.value) : null,
          condition_status: e.eqCondition?.value?.trim?.() || '',
          image_url: e.eqImageUrl?.value?.trim?.() || '',
          service_interval_days: e.eqServiceIntervalDays?.value ? Number(e.eqServiceIntervalDays.value) : null,
          last_service_date: e.eqLastServiceDate?.value || null,
          next_service_due_date: e.eqNextServiceDueDate?.value || null,
          last_inspection_at: e.eqLastInspectionAt?.value || null,
          next_inspection_due_date: e.eqNextInspectionDueDate?.value || null,
          defect_status: e.eqDefectStatus?.value?.trim?.() || 'clear',
          defect_notes: e.eqDefectNotes?.value?.trim?.() || '',
          is_locked_out: !!e.eqIsLockedOut?.checked,
          comments: e.eqComments?.value?.trim?.() || '',
          notes: e.eqNotes?.value?.trim?.() || ''
        });
        if (!resp?.ok) throw new Error(resp?.error || 'Equipment save failed');
        clearDrafts('equipment');
        setNotice(e.eqSummary, `Equipment ${e.eqCode?.value || ''} saved.`);
        await loadData();
      } catch (err) {
        setNotice(e.eqSummary, err?.message || 'Failed to save equipment.', true);
      }
    }

    async function checkoutEquipment() {
      const e = els();
      try {
        const resp = await api.manageJobsEntity({ entity: 'equipment', action: 'checkout', equipment_code: e.eqCode?.value?.trim?.() || '', job_code: e.eqCurrentJobCode?.value?.trim?.() || '', supervisor_name: e.eqAssignedSupervisor?.value?.trim?.() || '', worker_signature_name: e.eqWorkerSignature?.value?.trim?.() || '', supervisor_signature_name: e.eqSupervisorSignature?.value?.trim?.() || '', admin_signature_name: e.eqAdminSignature?.value?.trim?.() || '', checkout_condition: e.eqCheckoutCondition?.value?.trim?.() || '', notes: e.eqNotes?.value?.trim?.() || '', ...collectSignaturePayload() });
        if (!resp?.ok) throw new Error(resp?.error || 'Checkout failed');
        try { await uploadEquipmentEvidence(resp?.signout_id || resp?.record?.id, 'checkout'); } catch (uploadErr) { setNotice(e.eqSummary, `Equipment checked out, but evidence upload failed: ${uploadErr?.message || uploadErr}`, true); }
        clearDrafts('equipment');
        setNotice(e.eqSummary, `Equipment ${e.eqCode?.value || ''} checked out.`);
        await loadData();
      } catch (err) {
        setNotice(e.eqSummary, err?.message || 'Checkout failed.', true);
      }
    }

    async function returnEquipment() {
      const e = els();
      try {
        const resp = await api.manageJobsEntity({ entity: 'equipment', action: 'return', equipment_code: e.eqCode?.value?.trim?.() || '', worker_signature_name: e.eqWorkerSignature?.value?.trim?.() || '', supervisor_signature_name: e.eqSupervisorSignature?.value?.trim?.() || '', admin_signature_name: e.eqAdminSignature?.value?.trim?.() || '', return_condition: e.eqReturnCondition?.value?.trim?.() || '', return_notes: e.eqNotes?.value?.trim?.() || '', damage_reported: !!e.eqDamageReported?.checked, damage_notes: e.eqDamageNotes?.value?.trim?.() || '', ...collectSignaturePayload() });
        if (!resp?.ok) throw new Error(resp?.error || 'Return failed');
        try { await uploadEquipmentEvidence(resp?.signout_id || resp?.record?.id, 'return'); } catch (uploadErr) { setNotice(e.eqSummary, `Equipment returned, but evidence upload failed: ${uploadErr?.message || uploadErr}`, true); }
        clearDrafts('equipment');
        setNotice(e.eqSummary, `Equipment ${e.eqCode?.value || ''} returned.`);
        await loadData();
      } catch (err) {
        setNotice(e.eqSummary, err?.message || 'Return failed.', true);
      }
    }


    async function recordInspection() {
      const e = els();
      try {
        const inspection_status = window.prompt('Inspection status (pass / fail / needs_service):', e.eqDefectStatus?.value || 'pass') || 'pass';
        const notes = window.prompt('Inspection notes:', e.eqDefectNotes?.value || '') || '';
        const next_due_date = window.prompt('Next inspection due date (YYYY-MM-DD):', e.eqNextInspectionDueDate?.value || '') || '';
        const resp = await api.manageJobsEntity({ entity: 'equipment', action: 'inspect', equipment_code: e.eqCode?.value?.trim?.() || '', inspection_status, notes, next_due_date });
        if (!resp?.ok) throw new Error(resp?.error || 'Inspection save failed');
        setNotice(e.eqSummary, `Inspection recorded for ${e.eqCode?.value || ''}.`);
        await loadData();
      } catch (err) {
        setNotice(e.eqSummary, err?.message || 'Inspection save failed.', true);
      }
    }

    async function recordMaintenance() {
      const e = els();
      try {
        const maintenance_type = window.prompt('Service type:', 'service') || 'service';
        const provider_name = window.prompt('Provider / technician:', '') || '';
        const cost_amount = window.prompt('Cost amount:', '') || '';
        const performed_at = window.prompt('Performed date (YYYY-MM-DD):', e.eqLastServiceDate?.value || '') || '';
        const next_due_date = window.prompt('Next service due date (YYYY-MM-DD):', e.eqNextServiceDueDate?.value || '') || '';
        const notes = window.prompt('Service notes:', e.eqNotes?.value || '') || '';
        const resp = await api.manageJobsEntity({ entity: 'equipment', action: 'maintenance', equipment_code: e.eqCode?.value?.trim?.() || '', maintenance_type, provider_name, cost_amount, performed_at, next_due_date, notes });
        if (!resp?.ok) throw new Error(resp?.error || 'Maintenance save failed');
        setNotice(e.eqSummary, `Maintenance recorded for ${e.eqCode?.value || ''}.`);
        await loadData();
      } catch (err) {
        setNotice(e.eqSummary, err?.message || 'Maintenance save failed.', true);
      }
    }

    async function setLockout(isLocked) {
      const e = els();
      try {
        const notes = window.prompt(isLocked ? 'Lockout reason:' : 'Clear lockout notes:', e.eqDefectNotes?.value || '') || '';
        const resp = await api.manageJobsEntity({ entity: 'equipment', action: isLocked ? 'defect_lockout' : 'defect_clear', equipment_code: e.eqCode?.value?.trim?.() || '', notes });
        if (!resp?.ok) throw new Error(resp?.error || 'Lockout update failed');
        setNotice(e.eqSummary, isLocked ? `Equipment ${e.eqCode?.value || ''} locked out.` : `Lockout cleared for ${e.eqCode?.value || ''}.`);
        await loadData();
      } catch (err) {
        setNotice(e.eqSummary, err?.message || 'Lockout update failed.', true);
      }
    }
    async function updateRequirementApproval(requirementId, action) {
      const e = els();
      try {
        const decisionNotes = window.prompt(`Optional note for ${action}:`, '') || '';
        const resp = await window.YWIAPI.manageAdminEntity({ entity: 'job_requirement', action, requirement_id: requirementId, decision_notes: decisionNotes });
        if (!resp?.ok) throw new Error(resp?.error || 'Requirement approval update failed');
        setNotice(e.jobSummary, `Requirement ${requirementId} ${action} complete.`);
        await loadData();
      } catch (err) {
        setNotice(e.jobSummary, err?.message || 'Requirement update failed.', true);
      }
    }

    function renderRequirementReviewPanel() {
      const e = els();
      const existing = document.getElementById('job_requirement_review_block');
      if (existing) existing.remove();
      const pending = state.requirements.filter((row) => ['pending', 'rejected', 'approved'].includes(String(row.approval_status || '').toLowerCase()) || Number(row.reserved_qty || 0) < Number(row.needed_qty || 0));
      if (!pending.length || !e.jobsSection) return;
      const allowApprove = canApprove();
      const allowRequest = canManage();
      const block = document.createElement('div');
      block.id = 'job_requirement_review_block';
      block.className = 'admin-panel-block';
      block.style.marginTop = '16px';
      block.innerHTML = `
        <h3 style="margin-top:0;">Requirement Review</h3>
        <div class="table-scroll">
          <table>
            <thead><tr><th>ID</th><th>Job</th><th>Equipment</th><th>Needed</th><th>Reserved</th><th>Approval</th><th>Actions</th></tr></thead>
            <tbody>
              ${pending.map((row) => `
                <tr>
                  <td>${escHtml(row.id)}</td>
                  <td>${escHtml(row.job_id)}</td>
                  <td>${escHtml(row.equipment_name || row.equipment_code || row.equipment_pool_key || '')}</td>
                  <td>${escHtml(row.needed_qty)}</td>
                  <td>${escHtml(row.reserved_qty)}</td>
                  <td>${escHtml(row.approval_status || '')}</td>
                  <td>
                    <div class="table-actions" style="display:flex;flex-wrap:wrap;gap:6px;">
                      ${allowRequest ? `<button type="button" class="secondary" data-requirement-action="request_approval" data-id="${escHtml(row.id)}">Request</button>` : ''}
                      ${allowApprove ? `<button type="button" class="secondary" data-requirement-action="approve" data-id="${escHtml(row.id)}">Approve</button>` : ''}
                      ${allowApprove ? `<button type="button" class="secondary" data-requirement-action="reject" data-id="${escHtml(row.id)}">Reject</button>` : ''}
                      ${!allowApprove && !allowRequest ? `<span class="muted">View only</span>` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      e.jobsSection.appendChild(block);
      block.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-requirement-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-requirement-action');
        if ((action === 'approve' || action === 'reject') && !canApprove()) {
          setNotice(e.jobSummary, 'Admin access is required for requirement approvals.', true);
          return;
        }
        if (action === 'request_approval' && !canManage()) {
          setNotice(e.jobSummary, 'Supervisor+ access is required to request approval.', true);
          return;
        }
        updateRequirementApproval(btn.getAttribute('data-id'), action);
      });
    }

    function bind() {
      const e = els();
      if (e.jobAddEquipment && e.jobAddEquipment.dataset.bound !== '1') {
        e.jobAddEquipment.dataset.bound = '1';
        e.jobAddEquipment.addEventListener('click', () => addEquipmentRequirementRow({ needed_qty: 1, reserved_qty: 0 }));
      }
      if (e.jobEquipmentBody && e.jobEquipmentBody.dataset.bound !== '1') {
        e.jobEquipmentBody.dataset.bound = '1';
        e.jobEquipmentBody.addEventListener('click', (event) => {
          const btn = event.target.closest('.job-eq-remove');
          if (!btn) return;
          btn.closest('tr')?.remove();
        });
      }
      if (e.jobListBody && e.jobListBody.dataset.bound !== '1') {
        e.jobListBody.dataset.bound = '1';
        e.jobListBody.addEventListener('click', (event) => {
          const rowEl = event.target.closest('[data-job-row]');
          const loadBtn = event.target.closest('[data-job-load]');
          const sessionBtn = event.target.closest('[data-job-session]');
          const hoursBtn = event.target.closest('[data-job-hours]');
          const reassignBtn = event.target.closest('[data-job-reassign]');
          const id = loadBtn?.getAttribute('data-job-load') || sessionBtn?.getAttribute('data-job-session') || hoursBtn?.getAttribute('data-job-hours') || reassignBtn?.getAttribute('data-job-reassign') || rowEl?.getAttribute('data-job-row');
          if (!id) return;
          const row = state.jobs.find((job) => String(job.id) === String(id));
          if (!row) return;
          if (sessionBtn) return void recordJobSession(row);
          if (hoursBtn) return void logCrewHours(row);
          if (reassignBtn) return void reassignJobResources(row);
          loadJobIntoForm(row);
        });
      }
      const sortHead = document.querySelector('#job_list_table thead');
      if (sortHead && sortHead.dataset.bound !== '1') {
        sortHead.dataset.bound = '1';
        sortHead.addEventListener('click', (event) => {
          const btn = event.target.closest('[data-job-sort]');
          if (!btn) return;
          const key = btn.getAttribute('data-job-sort') || 'start_date';
          if (state.jobSort?.key === key) state.jobSort.dir = state.jobSort.dir === 'asc' ? 'desc' : 'asc';
          else state.jobSort = { key, dir: key === 'start_date' ? 'desc' : 'asc' };
          renderJobs();
        });
      }
      if (e.jobTrackSession && e.jobTrackSession.dataset.bound !== '1') {
        e.jobTrackSession.dataset.bound = '1';
        e.jobTrackSession.addEventListener('click', () => recordJobSession());
      }
      if (e.jobTrackHours && e.jobTrackHours.dataset.bound !== '1') {
        e.jobTrackHours.dataset.bound = '1';
        e.jobTrackHours.addEventListener('click', () => logCrewHours());
      }
      if (e.jobTrackReassign && e.jobTrackReassign.dataset.bound !== '1') {
        e.jobTrackReassign.dataset.bound = '1';
        e.jobTrackReassign.addEventListener('click', () => reassignJobResources());
      }
      if (e.jobTrackFinancial && e.jobTrackFinancial.dataset.bound !== '1') {
        e.jobTrackFinancial.dataset.bound = '1';
        e.jobTrackFinancial.addEventListener('click', () => recordJobFinancialEvent());
      }
      if (e.jobSessionBody && e.jobSessionBody.dataset.bound !== '1') {
        e.jobSessionBody.dataset.bound = '1';
        e.jobSessionBody.addEventListener('click', async (event) => {
          const btn = event.target.closest('[data-session-delete]');
          if (!btn) return;
          const resp = await api.manageJobsEntity({ entity: 'job_session', action: 'delete', item_id: btn.getAttribute('data-session-delete') });
          if (!resp?.ok) return setNotice(e.jobTrackingSummary, resp?.error || 'Session delete failed.', true);
          await loadData();
        });
      }
      if (e.jobCrewHoursBody && e.jobCrewHoursBody.dataset.bound !== '1') {
        e.jobCrewHoursBody.dataset.bound = '1';
        e.jobCrewHoursBody.addEventListener('click', async (event) => {
          const btn = event.target.closest('[data-hours-delete]');
          if (!btn) return;
          const resp = await api.manageJobsEntity({ entity: 'job_crew_time', action: 'delete', item_id: btn.getAttribute('data-hours-delete') });
          if (!resp?.ok) return setNotice(e.jobTrackingSummary, resp?.error || 'Crew hour delete failed.', true);
          await loadData();
        });
      }
      if (e.jobCreateEstimate && e.jobCreateEstimate.dataset.bound !== '1') {
        e.jobCreateEstimate.dataset.bound = '1';
        e.jobCreateEstimate.addEventListener('click', () => createEstimateFromJob());
      }
      if (e.jobAddEstimateLine && e.jobAddEstimateLine.dataset.bound !== '1') {
        e.jobAddEstimateLine.dataset.bound = '1';
        e.jobAddEstimateLine.addEventListener('click', () => addEstimateLineFromSelectedJob());
      }
      if (e.jobConvertToPackage && e.jobConvertToPackage.dataset.bound !== '1') {
        e.jobConvertToPackage.dataset.bound = '1';
        e.jobConvertToPackage.addEventListener('click', () => convertEstimateToJobPackage());
      }
      if (e.jobCompletionReview && e.jobCompletionReview.dataset.bound !== '1') {
        e.jobCompletionReview.dataset.bound = '1';
        e.jobCompletionReview.addEventListener('click', () => createOrUpdateCompletionReview());
      }
      if (e.jobQueueAccounting && e.jobQueueAccounting.dataset.bound !== '1') {
        e.jobQueueAccounting.dataset.bound = '1';
        e.jobQueueAccounting.addEventListener('click', () => queueSelectedJobForAccounting());
      }
      if (e.jobRenderQuotePackage && e.jobRenderQuotePackage.dataset.bound !== '1') {
        e.jobRenderQuotePackage.dataset.bound = '1';
        e.jobRenderQuotePackage.addEventListener('click', () => renderSelectedQuotePackage());
      }
      if (e.jobPrintQuotePackage && e.jobPrintQuotePackage.dataset.bound !== '1') {
        e.jobPrintQuotePackage.dataset.bound = '1';
        e.jobPrintQuotePackage.addEventListener('click', () => printSelectedQuotePackage());
      }
      if (e.jobSendQuotePackage && e.jobSendQuotePackage.dataset.bound !== '1') {
        e.jobSendQuotePackage.dataset.bound = '1';
        e.jobSendQuotePackage.addEventListener('click', () => sendSelectedQuotePackage());
      }
      if (e.jobReleaseReview && e.jobReleaseReview.dataset.bound !== '1') {
        e.jobReleaseReview.dataset.bound = '1';
        e.jobReleaseReview.addEventListener('click', () => reviewOrReleaseSelectedWorkOrder());
      }
      if (e.jobEvaluateThresholds && e.jobEvaluateThresholds.dataset.bound !== '1') {
        e.jobEvaluateThresholds.dataset.bound = '1';
        e.jobEvaluateThresholds.addEventListener('click', () => evaluateSelectedThresholds());
      }
      if (e.jobAddCloseoutItem && e.jobAddCloseoutItem.dataset.bound !== '1') {
        e.jobAddCloseoutItem.dataset.bound = '1';
        e.jobAddCloseoutItem.addEventListener('click', () => addCloseoutItemToSelectedReview());
      }
      if (e.jobAddCloseoutEvidence && e.jobAddCloseoutEvidence.dataset.bound !== '1') {
        e.jobAddCloseoutEvidence.dataset.bound = '1';
        e.jobAddCloseoutEvidence.addEventListener('click', () => addCloseoutEvidenceToSelectedReview());
      }
      if (e.jobAddSignoffStep && e.jobAddSignoffStep.dataset.bound !== '1') {
        e.jobAddSignoffStep.dataset.bound = '1';
        e.jobAddSignoffStep.addEventListener('click', () => addSignoffStepToSelectedReview());
      }
      if (e.jobSignSelectedStep && e.jobSignSelectedStep.dataset.bound !== '1') {
        e.jobSignSelectedStep.dataset.bound = '1';
        e.jobSignSelectedStep.addEventListener('click', () => signSelectedCompletionStep());
      }
      if (e.jobCreateInvoiceCandidate && e.jobCreateInvoiceCandidate.dataset.bound !== '1') {
        e.jobCreateInvoiceCandidate.dataset.bound = '1';
        e.jobCreateInvoiceCandidate.addEventListener('click', () => createInvoiceCandidateForSelectedReview());
      }
      if (e.jobCreateJournalCandidate && e.jobCreateJournalCandidate.dataset.bound !== '1') {
        e.jobCreateJournalCandidate.dataset.bound = '1';
        e.jobCreateJournalCandidate.addEventListener('click', () => createJournalCandidateForSelectedReview());
      }
      if (e.jobPostInvoiceCandidate && e.jobPostInvoiceCandidate.dataset.bound !== '1') {
        e.jobPostInvoiceCandidate.dataset.bound = '1';
        e.jobPostInvoiceCandidate.addEventListener('click', () => postSelectedInvoiceCandidate());
      }
      if (e.jobPostJournalCandidate && e.jobPostJournalCandidate.dataset.bound !== '1') {
        e.jobPostJournalCandidate.dataset.bound = '1';
        e.jobPostJournalCandidate.addEventListener('click', () => postSelectedJournalCandidate());
      }
      if (e.jobQueueArapReview && e.jobQueueArapReview.dataset.bound !== '1') {
        e.jobQueueArapReview.dataset.bound = '1';
        e.jobQueueArapReview.addEventListener('click', () => queueArapReviewForSelectedReview());
      }
      if (e.jobExportCloseoutSummary && e.jobExportCloseoutSummary.dataset.bound !== '1') {
        e.jobExportCloseoutSummary.dataset.bound = '1';
        e.jobExportCloseoutSummary.addEventListener('click', () => exportSelectedCloseoutSummary());
      }
      if (e.jobExportAccountantHandoff && e.jobExportAccountantHandoff.dataset.bound !== '1') {
        e.jobExportAccountantHandoff.dataset.bound = '1';
        e.jobExportAccountantHandoff.addEventListener('click', () => exportSelectedAccountantHandoff());
      }

      if (e.jobFinancialBody && e.jobFinancialBody.dataset.bound !== '1') {
        e.jobFinancialBody.dataset.bound = '1';
        e.jobFinancialBody.addEventListener('click', async (event) => {
          const btn = event.target.closest('[data-financial-delete]');
          if (!btn) return;
          const resp = await api.manageJobsEntity({ entity: 'job_financial_event', action: 'delete', item_id: btn.getAttribute('data-financial-delete') });
          if (!resp?.ok) return setNotice(e.jobTrackingSummary, resp?.error || 'Financial event delete failed.', true);
          await loadData();
        });
      }
      if (e.eqListBody && e.eqListBody.dataset.bound !== '1') {
        e.eqListBody.dataset.bound = '1';
        e.eqListBody.addEventListener('click', (event) => {
          const btn = event.target.closest('[data-equipment-load]');
          if (!btn) return;
          const row = state.equipment.find((item) => String(item.equipment_code) === String(btn.getAttribute('data-equipment-load')));
          loadEquipmentIntoForm(row);
        });
      }
      if (e.jobSupervisorName && e.jobSupervisorName.dataset.bound !== '1') {
        e.jobSupervisorName.dataset.bound = '1';
        e.jobSupervisorName.addEventListener('change', () => {
          if (e.jobAssignedSupervisorName && !e.jobAssignedSupervisorName.value) e.jobAssignedSupervisorName.value = e.jobSupervisorName.value || '';
        });
      }
      if (e.jobCrewId && e.jobCrewId.dataset.bound !== '1') {
        e.jobCrewId.dataset.bound = '1';
        e.jobCrewId.addEventListener('change', () => {
          const crew = (state.crews || []).find((row) => String(row.id) === String(e.jobCrewId.value || ''));
          if (!crew) return;
          if (e.jobCrewName && !e.jobCrewName.value) e.jobCrewName.value = crew.crew_name || '';
          if (e.jobCrewKind && !e.jobCrewKind.value) e.jobCrewKind.value = crew.crew_kind || 'general';
          if (e.jobAssignedSupervisorName && !e.jobAssignedSupervisorName.value) e.jobAssignedSupervisorName.value = crew.supervisor_name || '';
          if (e.jobCrewLeadName && !e.jobCrewLeadName.value) e.jobCrewLeadName.value = crew.lead_name || '';
          if (e.jobReservationNotes && !e.jobReservationNotes.value) e.jobReservationNotes.value = crew.default_equipment_notes || '';
          if (e.jobCrewMemberNames && Array.isArray(crew.members_json) && !e.jobCrewMemberNames.value) e.jobCrewMemberNames.value = crew.members_json.map((item) => item.full_name || item.email || '').filter(Boolean).join(', ');
        });
      }
      if (e.jobSave && e.jobSave.dataset.bound !== '1') {
        e.jobSave.dataset.bound = '1';
        e.jobSave.addEventListener('click', saveJob);
      }
      if (e.jobCommentSave && e.jobCommentSave.dataset.bound !== '1') {
        e.jobCommentSave.dataset.bound = '1';
        e.jobCommentSave.addEventListener('click', saveJobComment);
      }
      if (e.jobActivityList && e.jobActivityList.dataset.bound !== '1') {
        e.jobActivityList.dataset.bound = '1';
        e.jobActivityList.addEventListener('click', (event) => {
          const btn = event.target.closest('[data-job-comment-delete]');
          if (!btn) return;
          deleteJobComment(btn.getAttribute('data-job-comment-delete'));
        });
      }
      if (e.jobLoad && e.jobLoad.dataset.bound !== '1') {
        e.jobLoad.dataset.bound = '1';
        e.jobLoad.addEventListener('click', loadData);
      }
      if (e.jobClear && e.jobClear.dataset.bound !== '1') {
        e.jobClear.dataset.bound = '1';
        e.jobClear.addEventListener('click', clearJobForm);
      }
      if (e.eqSave && e.eqSave.dataset.bound !== '1') {
        e.eqSave.dataset.bound = '1';
        e.eqSave.addEventListener('click', saveEquipment);
      }
      if (e.eqLoad && e.eqLoad.dataset.bound !== '1') {
        e.eqLoad.dataset.bound = '1';
        e.eqLoad.addEventListener('click', loadData);
      }
      if (e.eqClear && e.eqClear.dataset.bound !== '1') {
        e.eqClear.dataset.bound = '1';
        e.eqClear.addEventListener('click', clearEquipmentForm);
      }
      if (e.eqCheckout && e.eqCheckout.dataset.bound !== '1') {
        e.eqCheckout.dataset.bound = '1';
        e.eqCheckout.addEventListener('click', checkoutEquipment);
      }
      if (e.eqReturn && e.eqReturn.dataset.bound !== '1') {
        e.eqReturn.dataset.bound = '1';
        e.eqReturn.addEventListener('click', returnEquipment);
      }
      if (e.eqAddInspection && e.eqAddInspection.dataset.bound !== '1') {
        e.eqAddInspection.dataset.bound = '1';
        e.eqAddInspection.addEventListener('click', recordInspection);
      }
      if (e.eqAddMaintenance && e.eqAddMaintenance.dataset.bound !== '1') {
        e.eqAddMaintenance.dataset.bound = '1';
        e.eqAddMaintenance.addEventListener('click', recordMaintenance);
      }
      if (e.eqLockout && e.eqLockout.dataset.bound !== '1') {
        e.eqLockout.dataset.bound = '1';
        e.eqLockout.addEventListener('click', () => setLockout(true));
      }
      if (e.eqClearLockout && e.eqClearLockout.dataset.bound !== '1') {
        e.eqClearLockout.dataset.bound = '1';
        e.eqClearLockout.addEventListener('click', () => setLockout(false));
      }
      if (e.jobsSection && e.jobsSection.dataset.autosaveBound !== '1') {
        e.jobsSection.dataset.autosaveBound = '1';
        e.jobsSection.addEventListener('input', () => { saveJobDraft(); saveEquipmentDraft(); });
        e.jobsSection.addEventListener('change', () => { saveJobDraft(); saveEquipmentDraft(); });
      }
    }

    async function init() {
      ensureLayout();
      ensureExtendedJobsPanel();
      ensureCommercialPanel();
      bind();
      applyRoleVisibility();
      await loadData();
      if (!state.jobs.length) clearJobForm();
      if (!state.equipment.length) clearEquipmentForm();
      restoreDrafts();
      initSignaturePads();
      renderRequirementReviewPanel();
    }

    return { init, applyRoleVisibility, loadData };
  }

  window.YWIJobsUI = { create: createJobsUI };
})();

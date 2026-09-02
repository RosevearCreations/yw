export const ACCESS_RANK = Object.freeze({ hidden:0, view:10, create:20, approve:30, manage:40 });

export const INTAKES = Object.freeze({
  review: '00000000-0000-4000-8000-000000000179',
  approval: '00000000-0000-4000-8000-000000000180',
  blocked: '00000000-0000-4000-8000-000000000181',
  recovery: '00000000-0000-4000-8000-000000000182',
  posted: '00000000-0000-4000-8000-000000000183',
  reversed: '00000000-0000-4000-8000-000000000184',
});

const base = (intake_id, lifecycle_stage, blocker_code, blocker_message, action_hint) => ({
  intake_id,
  job_id: 179000,
  job_code: `SYN-${intake_id.slice(-3)}`,
  job_name: 'Synthetic Finance acceptance fixture',
  client_name: 'Synthetic customer — never persisted',
  total_amount: 113,
  subtotal: 100,
  tax_total: 13,
  queued_at: '2026-09-02T12:00:00.000Z',
  lifecycle_stage,
  blocker_code,
  blocker_message,
  action_hint,
  execution_release_enabled: false,
  provider_mutation_authorized: false,
  posting_execution_status: null,
  posting_approval_id: null,
  execution_run_id: null,
  ar_invoice_id: null,
  gl_batch_id: null,
});

export const OPERATIONAL_LIFECYCLE = Object.freeze([
  base(INTAKES.review, 'awaiting_review', 'FINANCE_REVIEW_REQUIRED', 'A human Finance disposition is required.', 'Approve or reject with a reason.'),
  { ...base(INTAKES.approval, 'awaiting_posting_approval', 'POSTING_APPROVAL_REQUIRED', 'Separate Finance posting approval is required.', 'Review both draft candidates before approval.'), posting_approval_status:null },
  { ...base(INTAKES.blocked, 'preflight_blocked', 'AR_ACCOUNT_MAPPING_NOT_APPROVED', 'Accounts Receivable mapping is not accountant-approved.', 'Resolve the mapping through the human accounting authority.'), posting_approval_id:'10000000-0000-4000-8000-000000000179', posting_approval_status:'approved', preflight_status:'blocked', invoice_mapping_status:'blocked', journal_mapping_status:'blocked' },
  { ...base(INTAKES.recovery, 'recovery_required', 'POSTING_RECOVERY_REQUIRED', 'A partial accounting state requires recovery review.', 'Quarantine retries until reconciliation is clean.'), posting_approval_id:'10000000-0000-4000-8000-000000000180', posting_approval_status:'approved', preflight_status:'passed_execution_closed', posting_execution_status:'recovery_required', execution_run_id:'20000000-0000-4000-8000-000000000179' },
  { ...base(INTAKES.posted, 'posted', 'POSTED', 'The paired AR + GL posting is complete.', 'No action is required unless an auditable reversal is needed.'), posting_approval_id:'10000000-0000-4000-8000-000000000181', posting_approval_status:'approved', preflight_status:'passed_execution_closed', posting_execution_status:'completed', execution_run_id:'20000000-0000-4000-8000-000000000180', ar_invoice_id:'30000000-0000-4000-8000-000000000179', gl_batch_id:'40000000-0000-4000-8000-000000000179' },
  { ...base(INTAKES.reversed, 'reversed', 'POSTING_REVERSED', 'The original posting was reversed through auditable authority.', 'Preserve both original and reversal history.'), posting_approval_id:'10000000-0000-4000-8000-000000000182', posting_approval_status:'approved', preflight_status:'passed_execution_closed', posting_execution_status:'reversed', execution_run_id:'20000000-0000-4000-8000-000000000181', ar_invoice_id:'30000000-0000-4000-8000-000000000180', gl_batch_id:'40000000-0000-4000-8000-000000000180', reversal_status:'completed' },
]);

export function financeFixture(accessLevel='view') {
  const canApprove = ACCESS_RANK[accessLevel] >= ACCESS_RANK.approve;
  const canManage = ACCESS_RANK[accessLevel] >= ACCESS_RANK.manage;
  return {
    accounting: {
      ok:true,
      accounting_close_admin_control_dashboard:[],
      accounting_reconciliation_manual_review_queue:[],
      accounting_close_package_delivery_queue:[],
      sales_tax_filing_review:[],
      payroll_remittance_review:[],
      admin_close_center_overview:[],
    },
    review: {
      ok:true,
      scope:'finance_job_completion_review',
      access_level:accessLevel,
      can_create:ACCESS_RANK[accessLevel] >= ACCESS_RANK.create,
      can_approve:canApprove,
      can_manage:canManage,
      status:{awaiting_disposition_count:1,approved_awaiting_generation_count:1,generated_count:1,blocked_count:0},
      queue:[
        { ...OPERATIONAL_LIFECYCLE[0], intake_status:'finance_review_queued', disposition_id:null, disposition_status:null, candidate_generation_status:'not_eligible', completion_date:'2026-09-02' },
        { ...OPERATIONAL_LIFECYCLE[1], intake_status:'processed', disposition_id:'50000000-0000-4000-8000-000000000179', disposition_status:'approved', disposition_reason:'Synthetic approval', candidate_generation_status:'eligible', completion_date:'2026-09-02' },
      ],
      boundary:{posting_authorized:false,provider_mutation:false},
    },
    posting: {
      ok:true,
      scope:'finance_job_completion_operational_control_plane',
      access_level:accessLevel,
      can_create:ACCESS_RANK[accessLevel] >= ACCESS_RANK.create,
      can_approve:canApprove,
      can_manage:canManage,
      operational_lifecycle:OPERATIONAL_LIFECYCLE,
      operational_summary:{
        awaiting_review_count:1,stale_review_count:0,awaiting_posting_approval_count:1,
        preflight_blocked_count:1,recovery_required_count:1,posted_count:1,reversed_count:1,
        execution_release_enabled:false,provider_mutation_authorized:false,
      },
      reconciliation_issues:[{
        issue_key:'synthetic:recovery',severity:'warning',issue_code:'SYNTHETIC_RECOVERY_REQUIRED',
        details:'Synthetic browser-only recovery example.',action_hint:'No persistent row exists; verify recovery guidance only.'
      }],
      queue: OPERATIONAL_LIFECYCLE.map((row)=>({intake_id:row.intake_id,execution_authorized:false})),
      boundary:{posting_execution_authorized:false,provider_mutation:false,execution_release_server_owned:true},
    }
  };
}

export function itReadinessFixture() {
  const section=(rows=[])=>({rows,error:null,summary:{status:'passed',total:rows.length,blocking:0,warning:0,error:null}});
  return {
    ok:true,
    summary:{overall_status:'green',expected_schema_version:179,latest_applied_schema_version:179,source_gate_status:'green',repository_enforcement_status:'amber',active_admin_count:1,admin_access_integrity_blockers:0,readiness_blockers:0,assertion_blockers:0,production_promotion_mode:'manual_human_promotion_required',source_sha:'synthetic179'},
    security_assertions:{
      module:[],it:[],release_authority:[],consumer_observability:[],finance_operational:[{assertion_key:'finance_operational',assertion_status:'passed',details:'Synthetic operational proof.'}],finance_release_hardening:[{assertion_key:'finance_release_hardening',assertion_status:'passed',details:'Synthetic permission/release proof.'}],errors:[]
    },
    sections:{
      release_authority:section([{release_authority_status:'green',message:'Synthetic release authority.'}]),
      release_source_evidence:section([{source_gate_status:'green',source_sha:'synthetic179'}]),
      cross_module_consumer_health:section([]),
      finance_operational:section([{pipeline_status:'green',details:'Synthetic Finance pipeline.'}]),
      finance_reconciliation:section([]),
      finance_release_hardening:section([{hardening_status:'green',details:'Synthetic Finance hardening.'}]),
      admin_access_integrity:section([{profile_id:'admin-fixture',profile_label:'Synthetic Admin',role:'admin',all_modules_manage:true,safety_access:'manage',finance_access:'manage',jobs_access:'manage',admin_access:'manage'}]),
      schema_drift:section([{drift_status:'current',message:'179/179'}]),
      schema_preflight:section([]),deployment_checklist:section([]),function_readiness:section([]),production_readiness:section([]),deployment_gate:section([]),backup_restore:section([]),runtime_health:section([]),admin_tasks:section([]),public_seo:section([]),
    }
  };
}

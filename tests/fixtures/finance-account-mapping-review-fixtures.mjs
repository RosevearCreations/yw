export const ACCESS_RANK=Object.freeze({hidden:0,view:10,create:20,approve:30,manage:40});

export const ACCOUNTS=Object.freeze([
  {id:'81000000-0000-4000-8000-000000000001',account_number:'1200',account_name:'Accounts Receivable',account_type:'asset',system_code:'ar',normal_balance:'debit',is_control_account:true},
  {id:'81000000-0000-4000-8000-000000000002',account_number:'4100',account_name:'Landscape Service Revenue',account_type:'revenue',system_code:'revenue_landscape',normal_balance:'credit',is_control_account:false},
  {id:'81000000-0000-4000-8000-000000000003',account_number:'2200',account_name:'Sales Tax Payable',account_type:'liability',system_code:'tax_payable',normal_balance:'credit',is_control_account:true},
  {id:'81000000-0000-4000-8000-000000000004',account_number:'1000',account_name:'Operating Cash',account_type:'asset',system_code:'cash',normal_balance:'debit',is_control_account:true},
]);

export const MAPPINGS=Object.freeze([
  {
    mapping_rule_id:'82000000-0000-4000-8000-000000000001',mapping_key:'accounts_receivable',source_key:'ar',target_label:'Accounts receivable',
    account_id:ACCOUNTS[0].id,account_number:'1200',account_name:'Accounts Receivable',account_type:'asset',system_code:'ar',account_is_active:true,
    review_status:'review',reviewed_at:null,mapping_is_active:true,mapping_approved:false,conditional_for_zero_tax:false,
    blocker_code:'ACCOUNTANT_REVIEW_REQUIRED',blocker_message:'A Finance manager/accountant must explicitly approve or reject this mapping with a reason.',
    action_hint:'Open Finance mapping review and complete the human account/review decision.'
  },
  {
    mapping_rule_id:'82000000-0000-4000-8000-000000000002',mapping_key:'service_revenue',source_key:'revenue_landscape',target_label:'Service revenue',
    account_id:ACCOUNTS[1].id,account_number:'4100',account_name:'Landscape Service Revenue',account_type:'revenue',system_code:'revenue_landscape',account_is_active:true,
    review_status:'approved',reviewed_at:'2026-09-02T18:00:00.000Z',mapping_is_active:true,mapping_approved:true,conditional_for_zero_tax:false,
    blocker_code:'READY',blocker_message:'Human mapping review is complete.',action_hint:'No mapping action is required.'
  },
  {
    mapping_rule_id:'82000000-0000-4000-8000-000000000003',mapping_key:'sales_tax_payable',source_key:'tax_payable',target_label:'Sales tax payable',
    account_id:ACCOUNTS[2].id,account_number:'2200',account_name:'Sales Tax Payable',account_type:'liability',system_code:'tax_payable',account_is_active:true,
    review_status:'rejected',reviewed_at:'2026-09-02T18:05:00.000Z',mapping_is_active:true,mapping_approved:false,conditional_for_zero_tax:true,
    blocker_code:'ACCOUNT_MAPPING_REJECTED',blocker_message:'The selected mapping was rejected; select/review an appropriate chart account.',
    action_hint:'Review this conditional mapping before any invoice with non-zero tax can be posted.'
  }
]);

const expectedType=(mappingKey)=>({accounts_receivable:'asset',service_revenue:'revenue',sales_tax_payable:'liability'})[mappingKey];

export const DECISION_SUPPORT=Object.freeze(MAPPINGS.flatMap((mapping)=>ACCOUNTS.map((account)=>{
  const structural=account.account_type===expectedType(mapping.mapping_key);
  const current=account.id===mapping.account_id;
  const identity=account.system_code===mapping.source_key;
  const compatibility=current&&structural?'CURRENT_SELECTION':identity&&structural?'SOURCE_IDENTITY_MATCH':structural?'TYPE_COMPATIBLE':'TYPE_MISMATCH';
  return {
    mapping_rule_id:mapping.mapping_rule_id,
    mapping_key:mapping.mapping_key,
    source_key:mapping.source_key,
    target_label:mapping.target_label,
    current_account_id:mapping.account_id,
    current_account_number:mapping.account_number,
    current_account_name:mapping.account_name,
    current_account_type:mapping.account_type,
    current_system_code:mapping.system_code,
    review_status:mapping.review_status,
    mapping_approved:mapping.mapping_approved,
    expected_account_type:expectedType(mapping.mapping_key),
    candidate_account_id:account.id,
    candidate_account_number:account.account_number,
    candidate_account_name:account.account_name,
    candidate_account_type:account.account_type,
    candidate_system_code:account.system_code,
    candidate_normal_balance:account.normal_balance,
    candidate_is_control_account:account.is_control_account,
    candidate_is_active:true,
    is_current_selection:current,
    structural_match:structural,
    source_identity_match:identity,
    approval_eligible:structural,
    compatibility_code:compatibility,
    decision_rank:current&&structural?0:identity&&structural?10:structural?20:90,
    decision_support_message:structural?'Active account is structurally compatible; final selection remains a human decision.':`Account type ${account.account_type} does not match the expected ${expectedType(mapping.mapping_key)} type and cannot be approved.`
  };
})));

export const OBSERVABILITY=Object.freeze([
  {
    mapping_rule_id:MAPPINGS[0].mapping_rule_id,mapping_key:'accounts_receivable',review_status:'review',mapping_approved:false,
    review_age_days:69,review_age_code:'HUMAN_REVIEW_PENDING_STALE',drift_code:'NONE',technical_drift:false,account_recheck_recommended:false,
    preflight_sample_count:0,preflight_mapping_blocker_count:0,preflight_reconciliation_code:'NO_GENERATED_PAIR_SAMPLE',preflight_reconciliation_issue:false,
    observability_status:'amber',observability_action_hint:'Human accountant/bookkeeper review has been pending at least 30 days. This is a human decision queue, not an I.T. migration failure.'
  },
  {
    mapping_rule_id:MAPPINGS[1].mapping_rule_id,mapping_key:'service_revenue',review_status:'approved',mapping_approved:true,
    review_age_days:0,review_age_code:'REVIEW_COMPLETE',drift_code:'NONE',technical_drift:false,account_recheck_recommended:false,
    preflight_sample_count:1,preflight_mapping_blocker_count:0,preflight_reconciliation_code:'ALIGNED',preflight_reconciliation_issue:false,
    observability_status:'green',observability_action_hint:'Mapping observability is aligned with the canonical human review and posting-preflight authorities.'
  },
  {
    mapping_rule_id:MAPPINGS[2].mapping_rule_id,mapping_key:'sales_tax_payable',review_status:'rejected',mapping_approved:false,
    review_age_days:0,review_age_code:'REVIEW_REJECTED',drift_code:'NONE',technical_drift:false,account_recheck_recommended:false,
    preflight_sample_count:0,preflight_mapping_blocker_count:0,preflight_reconciliation_code:'NO_GENERATED_PAIR_SAMPLE',preflight_reconciliation_issue:false,
    observability_status:'amber',observability_action_hint:'A human rejected this mapping. Finance manage must decide whether to select/review another account.'
  }
]);

export function mappingFixture(accessLevel='view'){
  const canManage=ACCESS_RANK[accessLevel]>=ACCESS_RANK.manage;
  return {
    ok:true,
    scope:'finance_account_mapping_review',
    actor_profile_id:'83000000-0000-4000-8000-000000000001',
    access_level:accessLevel,
    can_manage:canManage,
    mappings:MAPPINGS.map((row)=>({...row})),
    readiness:{
      mapping_count:3,approved_count:1,pending_count:2,missing_account_count:0,inactive_account_count:0,rejected_count:1,
      audit_event_count:2,latest_review_at:'2026-09-02T18:05:00.000Z',execution_release_enabled:false,provider_mutation_enabled:false,
      mapping_readiness_status:'amber',
      readiness_message:'Human accountant/bookkeeper mapping review is still required; this is not an I.T. migration failure.'
    },
    decision_support:canManage?DECISION_SUPPORT.map((row)=>({...row})):[],
    decision_support_readiness:{
      mapping_count:3,eligible_candidate_count:4,type_mismatch_candidate_count:8,current_selection_incompatible_count:0,mapping_without_eligible_candidate_count:0,
      execution_release_enabled:false,provider_mutation_enabled:false,mapping_decision_support_status:'green',
      decision_support_message:'Decision support is structurally healthy. Final account selection and approval remain human accounting decisions.'
    },
    observability:OBSERVABILITY.map((row)=>({...row})),
    observability_readiness:{
      mapping_count:3,approved_count:1,pending_count:2,stale_review_count:1,aging_review_count:0,rejected_count:1,
      technical_drift_count:0,account_recheck_count:0,preflight_reconciliation_issue_count:0,no_generated_pair_sample_count:2,
      execution_release_enabled:false,provider_mutation_enabled:false,release_authority_status:'green',source_gate_status:'green',schema_status:'current',release_schema_version:183,
      mapping_observability_status:'amber',
      observability_message:'Human accountant/bookkeeper review is stale/pending; this is an accounting decision queue, not an I.T. migration failure.'
    },
    accounts:canManage?ACCOUNTS.map((row)=>({...row})):[],
    boundary:{human_accounting_decision_required:true,migration_auto_approval:false,structural_account_type_guard_on_approval:true,posting_execution_authorized:false,provider_mutation:false,jobs_writeback:false}
  };
}

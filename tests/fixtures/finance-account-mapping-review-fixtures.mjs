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
    accounts:canManage?ACCOUNTS.map((row)=>({...row})):[],
    boundary:{human_accounting_decision_required:true,migration_auto_approval:false,posting_execution_authorized:false,provider_mutation:false,jobs_writeback:false}
  };
}

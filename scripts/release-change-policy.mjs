#!/usr/bin/env node
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {classifyChangedFiles, collectReleaseCandidateContext, resolveCandidateKind} from './release-candidate-manifest.mjs';

export const POLICY_AUTHORITY='build_246_release_change_policy';
export const WORKFLOW_PATH='.github/workflows/staging-browser-integration.yml';

const clean=(value)=>String(value ?? '').trim();
const uniq=(values)=>[...new Set(values.filter(Boolean))].sort();

export const GATE_PROFILES=Object.freeze({
  baseline:Object.freeze([
    'test:promotion-shape',
    'test:repository-protection-preflight',
    'test:release-source-evidence-verify',
    'test:release-source-evidence-record',
    'test:runtime',
    'test:boundaries',
    'test:acceptance',
    'test:release-authority',
    'test:repo',
    'test:browser',
  ]),
  schema_changing:Object.freeze([
    'test:staging-acceptance',
    'test:staging-runtime-schema',
    'test:current-schema-staging-runbook',
    'test:finance-schema-dependencies',
  ]),
  auth_or_security_sensitive:Object.freeze([
    'test:submission-security',
    'test:security-advisor-truth',
    'test:admin-account-security',
    'test:auth-security-evidence',
    'test:browser:admin-account-security',
  ]),
  finance_sensitive:Object.freeze([
    'test:finance-schema-dependencies',
    'test:finance-posting-safety',
    'test:finance-posting-preflight',
    'test:finance-release-hardening',
    'test:browser:finance',
  ]),
  provider_sensitive:Object.freeze([
    'test:finance-posting-safety',
    'test:finance-posting-preflight',
    'test:finance-release-hardening',
    'test:staging-acceptance',
  ]),
  deployment_sensitive:Object.freeze([
    'test:promotion-shape',
    'test:repository-protection-preflight',
    'test:release-source-evidence-verify',
    'test:release-source-evidence-record',
    'test:performance-budgets',
    'test:browser:performance-budgets',
  ]),
  staging_sensitive:Object.freeze([
    'test:staging-acceptance',
    'test:staging-scenarios',
    'test:staging-environment-guard',
    'test:staging-target-preflight',
    'test:staging-runtime-schema',
    'test:browser:staging-acceptance',
  ]),
  public_content_sensitive:Object.freeze([
    'test:help-seo',
    'test:search-discovery',
    'test:public-route-publication',
    'test:browser:public-route-publication',
    'test:browser:help-seo',
  ]),
  release_governance:Object.freeze([
    'test:promotion-shape',
    'test:repository-protection-preflight',
    'test:release-source-evidence-verify',
    'test:release-source-evidence-record',
    'test:performance-budgets',
  ]),
  unclassified_source_change:Object.freeze([
    'test:runtime',
    'test:boundaries',
    'test:acceptance',
    'test:repo',
    'test:browser',
  ]),
});

const CLASS_PRIORITY=Object.freeze([
  'schema_changing',
  'auth_or_security_sensitive',
  'provider_sensitive',
  'finance_sensitive',
  'deployment_sensitive',
  'staging_sensitive',
  'release_governance',
  'public_content_sensitive',
  'unclassified_source_change',
]);

const CRITICAL=new Set(['schema_changing','auth_or_security_sensitive','provider_sensitive','finance_sensitive']);
const HIGH=new Set(['deployment_sensitive','staging_sensitive','release_governance']);
const MEDIUM=new Set(['public_content_sensitive','unclassified_source_change']);

export function buildReleaseChangePolicy(files=[]){
  const change=classifyChangedFiles(files);
  const tags=new Set(change.preliminary_risk_tags || []);
  const classes=CLASS_PRIORITY.filter((name)=>tags.has(name));
  if(!classes.length)classes.push('unclassified_source_change');
  const primaryClass=classes[0];
  const requiredGateScripts=uniq([
    ...GATE_PROFILES.baseline,
    ...classes.flatMap((name)=>GATE_PROFILES[name] || GATE_PROFILES.unclassified_source_change),
  ]);
  const riskLevel=classes.some((name)=>CRITICAL.has(name)) ? 'critical'
    : classes.some((name)=>HIGH.has(name)) ? 'high'
    : classes.some((name)=>MEDIUM.has(name)) ? 'medium'
    : 'low';
  const manualReviewRequired=riskLevel==='critical' || riskLevel==='high';
  const evidenceProfile=primaryClass==='schema_changing' ? 'schema_migration_and_dependent_runtime'
    : primaryClass==='auth_or_security_sensitive' ? 'security_and_admin_access'
    : primaryClass==='provider_sensitive' ? 'provider_and_finance_safety'
    : primaryClass==='finance_sensitive' ? 'finance_schema_posting_and_recovery'
    : primaryClass==='deployment_sensitive' ? 'deployment_release_governance'
    : primaryClass==='staging_sensitive' ? 'staging_acceptance_and_runtime_schema'
    : primaryClass==='release_governance' ? 'release_governance_and_performance'
    : primaryClass==='public_content_sensitive' ? 'public_route_search_and_seo'
    : 'standard_source_acceptance';

  return {
    policy_format_version:1,
    authority:POLICY_AUTHORITY,
    primary_class:primaryClass,
    classes,
    risk_level:riskLevel,
    evidence_profile:evidenceProfile,
    manual_review_required:manualReviewRequired,
    database_migration_required:classes.includes('schema_changing'),
    auth_security_review_required:classes.includes('auth_or_security_sensitive'),
    finance_review_required:classes.includes('finance_sensitive'),
    provider_review_required:classes.includes('provider_sensitive'),
    deployment_review_required:classes.includes('deployment_sensitive') || classes.includes('release_governance'),
    staging_acceptance_required:classes.includes('staging_sensitive') || classes.includes('schema_changing') || classes.includes('provider_sensitive'),
    required_gate_scripts:requiredGateScripts,
    changed_file_count:change.changed_file_count,
    changed_files:change.changed_files,
    changed_surfaces:change.changed_surfaces,
    risk_tags:change.preliminary_risk_tags,
    changed_migrations:change.changed_migrations,
    boundaries:{
      release_authorization_performed:false,
      production_promotion_performed:false,
      database_mutation_performed:false,
      auth_or_permission_mutation_performed:false,
      finance_posting_enabled:false,
      provider_mutation_performed:false,
    },
  };
}

export function verifyPolicyGateCoverage(policy,options={}){
  const packageJson=options.packageJson || JSON.parse(fs.readFileSync('package.json','utf8'));
  const workflow=options.workflowSource ?? fs.readFileSync(WORKFLOW_PATH,'utf8');
  const missingPackageScripts=[];
  const missingWorkflowSteps=[];
  for(const gate of policy.required_gate_scripts || []){
    if(!clean(packageJson?.scripts?.[gate]))missingPackageScripts.push(gate);
    if(!workflow.includes(`npm run ${gate}`))missingWorkflowSteps.push(gate);
  }
  return {
    ok:missingPackageScripts.length===0 && missingWorkflowSteps.length===0,
    missing_package_scripts:uniq(missingPackageScripts),
    missing_workflow_steps:uniq(missingWorkflowSteps),
  };
}

export function evaluateCurrentReleaseChangePolicy(env=process.env,options={}){
  const context=options.context || collectReleaseCandidateContext(env,options.deps || {});
  const policy=buildReleaseChangePolicy(context.changed_files || []);
  const coverage=verifyPolicyGateCoverage(policy,options);
  const candidateKind=resolveCandidateKind(env);
  const errors=[];
  if(!policy.changed_file_count)errors.push('Changed-file evidence is unavailable; release classification cannot silently infer source-only risk.');
  if(!coverage.ok){
    if(coverage.missing_package_scripts.length)errors.push(`Required package gates missing: ${coverage.missing_package_scripts.join(', ')}.`);
    if(coverage.missing_workflow_steps.length)errors.push(`Required workflow gates missing: ${coverage.missing_workflow_steps.join(', ')}.`);
  }
  return {ok:errors.length===0,candidate_kind:candidateKind,context,policy,coverage,errors};
}

function printResult(result){
  console.log(JSON.stringify({
    ok:result.ok,
    authority:result.policy.authority,
    candidate_kind:result.candidate_kind,
    primary_class:result.policy.primary_class,
    classes:result.policy.classes,
    risk_level:result.policy.risk_level,
    evidence_profile:result.policy.evidence_profile,
    changed_file_count:result.policy.changed_file_count,
    changed_migrations:result.policy.changed_migrations,
    required_gate_scripts:result.policy.required_gate_scripts,
    missing_package_scripts:result.coverage.missing_package_scripts,
    missing_workflow_steps:result.coverage.missing_workflow_steps,
    errors:result.errors,
  },null,2));
  if(!result.ok){
    console.error('\nBUILD 246 RELEASE CHANGE POLICY: LOCKED');
    process.exitCode=1;
    return;
  }
  console.log('\nBUILD 246 RELEASE CHANGE POLICY: COVERAGE VERIFIED');
  console.log('Classification selects required evidence only; canonical workflow/repository controls remain release authority.');
}

const invoked=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked)printResult(evaluateCurrentReleaseChangePolicy(process.env));

#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildReleaseChangePolicy, evaluateCurrentReleaseChangePolicy, GATE_PROFILES, POLICY_AUTHORITY, verifyPolicyGateCoverage} from './release-change-policy.mjs';

const checks=[];
const check=(name,fn)=>{try{fn();checks.push({name,ok:true});}catch(error){checks.push({name,ok:false,error:error?.message||String(error)});}};

check('source-only-candidate-gets-standard-proof',()=>{
  const policy=buildReleaseChangePolicy(['js/mobile-today.js','tests/browser/mobile-today.spec.mjs']);
  assert.equal(policy.authority,POLICY_AUTHORITY);
  assert.equal(policy.database_migration_required,false);
  assert.equal(policy.provider_review_required,false);
  assert.ok(policy.required_gate_scripts.includes('test:runtime'));
  assert.ok(policy.required_gate_scripts.includes('test:browser'));
});

check('schema-change-selects-migration-and-runtime-gates',()=>{
  const policy=buildReleaseChangePolicy(['sql/208_schema_change.sql','js/admin.js']);
  assert.equal(policy.primary_class,'schema_changing');
  assert.equal(policy.risk_level,'critical');
  assert.equal(policy.database_migration_required,true);
  assert.equal(policy.staging_acceptance_required,true);
  assert.deepEqual(policy.changed_migrations,['208']);
  for(const gate of GATE_PROFILES.schema_changing)assert.ok(policy.required_gate_scripts.includes(gate),gate);
});

check('auth-change-selects-security-evidence',()=>{
  const policy=buildReleaseChangePolicy(['supabase/functions/auth-admin/index.ts','tests/auth-security.spec.mjs']);
  assert.ok(policy.classes.includes('auth_or_security_sensitive'));
  assert.equal(policy.auth_security_review_required,true);
  for(const gate of GATE_PROFILES.auth_or_security_sensitive)assert.ok(policy.required_gate_scripts.includes(gate),gate);
});

check('finance-provider-change-selects-both-profiles',()=>{
  const policy=buildReleaseChangePolicy(['scripts/finance-payment-provider-preflight.mjs']);
  assert.ok(policy.classes.includes('finance_sensitive'));
  assert.ok(policy.classes.includes('provider_sensitive'));
  assert.equal(policy.finance_review_required,true);
  assert.equal(policy.provider_review_required,true);
  for(const gate of [...GATE_PROFILES.finance_sensitive,...GATE_PROFILES.provider_sensitive])assert.ok(policy.required_gate_scripts.includes(gate),gate);
});

check('workflow-change-selects-release-governance-and-deployment',()=>{
  const policy=buildReleaseChangePolicy(['.github/workflows/staging-browser-integration.yml']);
  assert.ok(policy.classes.includes('deployment_sensitive'));
  assert.ok(policy.classes.includes('release_governance'));
  assert.equal(policy.deployment_review_required,true);
  assert.ok(policy.required_gate_scripts.includes('test:repository-protection-preflight'));
  assert.ok(policy.required_gate_scripts.includes('test:performance-budgets'));
});

check('public-content-change-selects-seo-and-route-proof',()=>{
  const policy=buildReleaseChangePolicy(['help.html','sitemap.xml']);
  assert.ok(policy.classes.includes('public_content_sensitive'));
  for(const gate of GATE_PROFILES.public_content_sensitive)assert.ok(policy.required_gate_scripts.includes(gate),gate);
});

check('policy-never-performs-release-or-mutation',()=>{
  const policy=buildReleaseChangePolicy(['sql/208_schema_change.sql','scripts/finance-payment-provider-preflight.mjs']);
  assert.deepEqual(policy.boundaries,{
    release_authorization_performed:false,
    production_promotion_performed:false,
    database_mutation_performed:false,
    auth_or_permission_mutation_performed:false,
    finance_posting_enabled:false,
    provider_mutation_performed:false,
  });
});

check('missing-required-package-gate-fails-coverage',()=>{
  const policy=buildReleaseChangePolicy(['sql/208_schema_change.sql']);
  const packageJson={scripts:Object.fromEntries(policy.required_gate_scripts.map((gate)=>[gate,'node ok.mjs']))};
  delete packageJson.scripts['test:staging-runtime-schema'];
  const workflow=policy.required_gate_scripts.map((gate)=>`- run: npm run ${gate}`).join('\n');
  const coverage=verifyPolicyGateCoverage(policy,{packageJson,workflowSource:workflow});
  assert.equal(coverage.ok,false);
  assert.deepEqual(coverage.missing_package_scripts,['test:staging-runtime-schema']);
});

check('missing-required-workflow-step-fails-coverage',()=>{
  const policy=buildReleaseChangePolicy(['scripts/finance-posting-preflight.mjs']);
  const packageJson={scripts:Object.fromEntries(policy.required_gate_scripts.map((gate)=>[gate,'node ok.mjs']))};
  const workflow=policy.required_gate_scripts.filter((gate)=>gate!=='test:finance-posting-safety').map((gate)=>`- run: npm run ${gate}`).join('\n');
  const coverage=verifyPolicyGateCoverage(policy,{packageJson,workflowSource:workflow});
  assert.equal(coverage.ok,false);
  assert.deepEqual(coverage.missing_workflow_steps,['test:finance-posting-safety']);
});

check('dynamic-candidate-evaluation-fails-closed-without-change-evidence',()=>{
  const packageJson=JSON.parse(fs.readFileSync('package.json','utf8'));
  const workflowSource=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
  const result=evaluateCurrentReleaseChangePolicy({YWI_GITHUB_EVENT_NAME:'pull_request',YWI_GITHUB_BASE_REF:'dev',YWI_GITHUB_HEAD_REF:'feature'}, {
    context:{changed_files:[]},packageJson,workflowSource,
  });
  assert.equal(result.ok,false);
  assert.match(result.errors.join(' '),/Changed-file evidence is unavailable/);
});

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const manifest=fs.readFileSync('scripts/release-candidate-manifest.mjs','utf8');
check('package-wires-build-246-classifier',()=>{
  assert.equal(pkg.scripts?.['release:classify'],'node scripts/release-change-policy.mjs');
  assert.equal(pkg.scripts?.['test:release-classifier'],'node scripts/release-change-policy-check.mjs');
  assert.match(pkg.scripts?.['test:release-source-evidence'] || '',/release-change-policy-check\.mjs/);
  assert.match(pkg.scripts?.['test:release-source-evidence'] || '',/release-change-policy\.mjs/);
});
check('canonical-workflow-still-invokes-parent-release-source-gate',()=>{
  assert.match(workflow,/npm run test:release-source-evidence/);
  assert.match(workflow,/npm run test:repository-protection-preflight/);
});
check('build-244-manifest-remains-evidence-not-release-authority',()=>{
  assert.match(manifest,/descriptive_evidence_only:true/);
  assert.match(manifest,/release_authorization_performed:false/);
  assert.ok(!manifest.includes('production_promotion_performed:true'));
});

const passed=checks.filter((item)=>item.ok).length;
for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.error?' — '+item.error:''}`);
console.log(`\n${passed}/${checks.length} Build 246 release change policy checks passed.`);
process.exit(passed===checks.length?0:1);

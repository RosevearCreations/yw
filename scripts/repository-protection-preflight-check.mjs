#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  evaluateRepositoryProtection,
  renderRepositoryProtectionSummary,
  REPOSITORY_PROTECTION_REMEDIATION
} from './repository-protection-preflight.mjs';

const sha='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const base={
  YWI_GITHUB_EVENT_NAME:'push',
  YWI_GITHUB_REF:'refs/heads/main',
  YWI_EXPECTED_MAIN_SHA:sha,
  YWI_GITHUB_MAIN_SHA:sha,
  YWI_GITHUB_MAIN_PROTECTED:'true',
};

const checks=[];
const check=(name,fn)=>{try{fn();checks.push({name,ok:true});}catch(error){checks.push({name,ok:false,error:error?.message||String(error)});}};

check('exact-protected-main-is-ready',()=>{
  const r=evaluateRepositoryProtection(base);
  assert.equal(r.ok,true);
  assert.deepEqual(r.blocker_codes,[]);
  assert.equal(r.remediation,null);
  assert.match(r.next_safe_action,/verified for this exact main SHA/i);
});
check('unprotected-main-is-locked-with-actionable-remediation',()=>{
  const r=evaluateRepositoryProtection({...base,YWI_GITHUB_MAIN_PROTECTED:'false'});
  assert.equal(r.ok,false);
  assert.equal(r.main_protected,false);
  assert.ok(r.blocker_codes.includes('main_unprotected'));
  assert.match(r.next_safe_action,/Enable GitHub branch protection for main/i);
  assert.equal(r.remediation?.automatic_fix_supported,false);
  assert.equal(r.remediation?.manual_steps?.length,5);
});
check('stale-main-sha-is-locked-with-fresh-run-action',()=>{
  const r=evaluateRepositoryProtection({...base,YWI_GITHUB_MAIN_SHA:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'});
  assert.equal(r.ok,false);
  assert.equal(r.exact_main_sha_match,false);
  assert.ok(r.blocker_codes.includes('main_sha_mismatch'));
  assert.match(r.next_safe_action,/fresh exact-main run/i);
});
check('pull-request-event-cannot-authorize-release',()=>assert.equal(evaluateRepositoryProtection({...base,YWI_GITHUB_EVENT_NAME:'pull_request'}).ok,false));
check('non-main-ref-cannot-authorize-release',()=>assert.equal(evaluateRepositoryProtection({...base,YWI_GITHUB_REF:'refs/heads/dev'}).ok,false));
check('missing-github-evidence-is-locked',()=>{
  const r=evaluateRepositoryProtection({...base,YWI_GITHUB_MAIN_SHA:'',YWI_GITHUB_MAIN_PROTECTED:''});
  assert.equal(r.ok,false);
  assert.ok(r.blocker_codes.includes('missing_github_main_evidence'));
});
check('protected-value-is-exact-not-truthy',()=>assert.equal(evaluateRepositoryProtection({...base,YWI_GITHUB_MAIN_PROTECTED:'1'}).ok,false));
check('manual-remediation-contract-is-specific-and-non-automatic',()=>{
  assert.equal(REPOSITORY_PROTECTION_REMEDIATION.automatic_fix_supported,false);
  const text=REPOSITORY_PROTECTION_REMEDIATION.manual_steps.join('\n');
  for(const value of [
    'Settings → Branches',
    'classic branch protection rule targeting main',
    'Require a pull request before merging',
    'force pushes and branch deletion disabled',
    'protected=true on that same main SHA'
  ]) assert.ok(text.includes(value),value);
});
check('github-step-summary-is-actionable-and-cannot-claim-auto-fix',()=>{
  const summary=renderRepositoryProtectionSummary(evaluateRepositoryProtection({...base,YWI_GITHUB_MAIN_PROTECTED:'false'}));
  for(const value of [
    '### Exact-main repository enforcement',
    '**BLOCKED**',
    '`main_unprotected`',
    '#### Next safe action',
    '#### Manual remediation',
    'Settings → Branches',
    'cannot enable branch protection',
    'does not weaken the exact-main enforcement check'
  ]) assert.ok(summary.includes(value),value);
});

const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const docs=fs.readFileSync('docs/NEXT_STEPS_AND_SANITY_CHECK.md','utf8');
const help=fs.readFileSync('help.html','utf8');
const preflightSource=fs.readFileSync('scripts/repository-protection-preflight.mjs','utf8');
check('workflow-has-exact-main-live-gate',()=>{
  for(const value of [
    'Require GitHub repository enforcement on exact main',
    "github.event_name == 'push' && github.ref == 'refs/heads/main'",
    'YWI_EXPECTED_MAIN_SHA: ${{ github.sha }}',
    'YWI_GITHUB_MAIN_PROTECTED',
    'npm run repository:protection:require',
  ]) assert.ok(workflow.includes(value),value);
});
check('workflow-does-not-use-green-ci-as-protection-proof',()=>assert.ok(!workflow.includes('YWI_GITHUB_MAIN_PROTECTED: true')));
check('preflight-writes-actions-summary-without-bypass',()=>{
  assert.ok(preflightSource.includes('GITHUB_STEP_SUMMARY'));
  assert.ok(preflightSource.includes('appendFileSync'));
  assert.ok(preflightSource.includes('process.exitCode=1'));
  assert.ok(!preflightSource.includes('automatic_fix_supported:true'));
});
check('operator-authority-documents-external-boundary',()=>{
  assert.ok(docs.includes('exact-main repository protection preflight'));
  assert.ok(help.includes('Repository enforcement preflight'));
  assert.ok(help.includes('does not enable branch protection'));
});

for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.error?` — ${item.error}`:''}`);
const failed=checks.filter((item)=>!item.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} repository protection preflight checks passed.`);
if(failed.length)process.exit(1);

#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluateProductionPromotionShape, renderPromotionShapeSummary } from './production-promotion-shape-preflight.mjs';

const checks=[];
const check=(name,fn)=>{try{fn();checks.push({name,ok:true});}catch(error){checks.push({name,ok:false,error:error?.message||String(error)});}};

const feature={
  YWI_GITHUB_EVENT_NAME:'pull_request',
  YWI_GITHUB_REF:'refs/pull/123/merge',
  YWI_GITHUB_BASE_REF:'dev',
  YWI_GITHUB_HEAD_REF:'build241-production-promotion-shape-guard',
};

check('feature-pr-to-dev-is-valid-shape',()=>{
  const r=evaluateProductionPromotionShape(feature);
  assert.equal(r.ok,true);
  assert.equal(r.mode,'development_feature_candidate');
  assert.equal(r.production_promotion_authorized,false);
});
check('dev-to-main-promotion-is-valid-shape',()=>{
  const r=evaluateProductionPromotionShape({...feature,YWI_GITHUB_BASE_REF:'main',YWI_GITHUB_HEAD_REF:'dev'});
  assert.equal(r.ok,true);
  assert.equal(r.mode,'production_promotion_candidate');
  assert.match(r.next_safe_action,/complete canonical source and rendered-browser promotion gate/i);
});
check('feature-branch-cannot-target-main',()=>{
  const r=evaluateProductionPromotionShape({...feature,YWI_GITHUB_BASE_REF:'main',YWI_GITHUB_HEAD_REF:'build241-production-promotion-shape-guard'});
  assert.equal(r.ok,false);
  assert.ok(r.blocker_codes.includes('production_main_requires_dev_head'));
  assert.match(r.next_safe_action,/do not promote a feature branch directly to main/i);
});
check('dev-pr-must-use-feature-head',()=>{
  const r=evaluateProductionPromotionShape({...feature,YWI_GITHUB_HEAD_REF:'main'});
  assert.equal(r.ok,false);
  assert.ok(r.blocker_codes.includes('development_pr_requires_feature_head'));
});
check('unsupported-pr-base-is-locked',()=>{
  const r=evaluateProductionPromotionShape({...feature,YWI_GITHUB_BASE_REF:'release',YWI_GITHUB_HEAD_REF:'dev'});
  assert.equal(r.ok,false);
  assert.ok(r.blocker_codes.includes('unsupported_pull_request_base'));
});
check('exact-main-push-is-valid-followup-shape',()=>{
  const r=evaluateProductionPromotionShape({YWI_GITHUB_EVENT_NAME:'push',YWI_GITHUB_REF:'refs/heads/main'});
  assert.equal(r.ok,true);
  assert.equal(r.mode,'exact_main_followup');
  assert.equal(r.production_promotion_authorized,false);
});
check('non-main-push-is-locked',()=>{
  const r=evaluateProductionPromotionShape({YWI_GITHUB_EVENT_NAME:'push',YWI_GITHUB_REF:'refs/heads/dev'});
  assert.equal(r.ok,false);
  assert.ok(r.blocker_codes.includes('unsupported_push_ref'));
});
check('workflow-dispatch-is-source-only',()=>{
  const r=evaluateProductionPromotionShape({YWI_GITHUB_EVENT_NAME:'workflow_dispatch',YWI_GITHUB_REF:'refs/heads/main'});
  assert.equal(r.ok,true);
  assert.equal(r.mode,'manual_source_check');
  assert.match(r.next_safe_action,/not Production promotion authority/i);
});
check('summary-never-claims-promotion-authority',()=>{
  const r=evaluateProductionPromotionShape({...feature,YWI_GITHUB_BASE_REF:'main',YWI_GITHUB_HEAD_REF:'dev'});
  const text=renderPromotionShapeSummary(r);
  assert.ok(text.includes('Production promotion shape'));
  assert.ok(text.includes('never authorizes Production promotion'));
  assert.ok(text.includes('repository-enforcement'));
});

const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
check('package-wiring',()=>{
  assert.equal(pkg.scripts['promotion:shape:require'],'node scripts/production-promotion-shape-preflight.mjs');
  assert.equal(pkg.scripts['test:promotion-shape'],'node scripts/production-promotion-shape-preflight-check.mjs');
});
check('workflow-wiring',()=>{
  for(const value of [
    'Validate Development / Production promotion shape',
    'YWI_GITHUB_EVENT_NAME: ${{ github.event_name }}',
    'YWI_GITHUB_REF: ${{ github.ref }}',
    'YWI_GITHUB_BASE_REF: ${{ github.base_ref }}',
    'YWI_GITHUB_HEAD_REF: ${{ github.head_ref }}',
    'npm run promotion:shape:require',
    'npm run test:promotion-shape'
  ]) assert.ok(workflow.includes(value),value);
  assert.ok(workflow.indexOf('npm run promotion:shape:require') < workflow.indexOf('npm run test:release-source-evidence'));
});
check('workflow-has-no-promotion-bypass',()=>{
  for(const forbidden of ['promotion_shape_bypass','ALLOW_DIRECT_MAIN','SKIP_PROMOTION_SHAPE']) assert.ok(!workflow.includes(forbidden),forbidden);
});

for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.error?` — ${item.error}`:''}`);
const failed=checks.filter((item)=>!item.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} production promotion shape checks passed.`);
if(failed.length)process.exit(1);

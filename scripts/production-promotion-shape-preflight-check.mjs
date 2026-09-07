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
  YWI_GITHUB_HEAD_REF:'build242-production-promotion-freshness-guard',
};
const promotion={
  ...feature,
  YWI_GITHUB_BASE_REF:'main',
  YWI_GITHUB_HEAD_REF:'dev',
  YWI_GITHUB_PR_HEAD_SHA:'dev-current-sha',
  YWI_GITHUB_PR_BASE_SHA:'main-current-sha',
  YWI_GITHUB_LIVE_DEV_SHA:'dev-current-sha',
  YWI_GITHUB_LIVE_MAIN_SHA:'main-current-sha',
};

check('feature-pr-to-dev-is-valid-shape',()=>{
  const r=evaluateProductionPromotionShape(feature);
  assert.equal(r.ok,true);
  assert.equal(r.mode,'development_feature_candidate');
  assert.equal(r.freshness_status,'not_applicable');
  assert.equal(r.production_promotion_authorized,false);
});
check('current-dev-to-current-main-promotion-is-valid',()=>{
  const r=evaluateProductionPromotionShape(promotion);
  assert.equal(r.ok,true);
  assert.equal(r.mode,'production_promotion_candidate');
  assert.equal(r.freshness_status,'current');
  assert.equal(r.promotion_freshness_verified,true);
  assert.match(r.next_safe_action,/exact current dev SHA/i);
});
check('promotion-requires-live-freshness-evidence',()=>{
  const r=evaluateProductionPromotionShape({...promotion,YWI_GITHUB_LIVE_DEV_SHA:''});
  assert.equal(r.ok,false);
  assert.equal(r.freshness_status,'unverified');
  assert.ok(r.blocker_codes.includes('promotion_freshness_evidence_missing'));
  assert.match(r.next_safe_action,/fresh GitHub evidence/i);
});
check('stale-promotion-head-is-locked',()=>{
  const r=evaluateProductionPromotionShape({...promotion,YWI_GITHUB_PR_HEAD_SHA:'stale-dev-sha'});
  assert.equal(r.ok,false);
  assert.ok(r.blocker_codes.includes('promotion_head_not_current_dev'));
  assert.match(r.next_safe_action,/current dev tip/i);
});
check('stale-promotion-base-is-locked',()=>{
  const r=evaluateProductionPromotionShape({...promotion,YWI_GITHUB_PR_BASE_SHA:'stale-main-sha'});
  assert.equal(r.ok,false);
  assert.ok(r.blocker_codes.includes('promotion_base_not_current_main'));
  assert.match(r.next_safe_action,/current main tip/i);
});
check('feature-branch-cannot-target-main',()=>{
  const r=evaluateProductionPromotionShape({...promotion,YWI_GITHUB_HEAD_REF:'build242-production-promotion-freshness-guard'});
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
  assert.equal(r.freshness_status,'not_applicable');
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
check('summary-exposes-freshness-without-authority',()=>{
  const text=renderPromotionShapeSummary(evaluateProductionPromotionShape(promotion));
  assert.ok(text.includes('Production promotion shape and freshness'));
  assert.ok(text.includes('Promotion freshness'));
  assert.ok(text.includes('Current dev SHA'));
  assert.ok(text.includes('Current main SHA'));
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
    'Validate Development / Production promotion shape and freshness',
    'GH_TOKEN: ${{ github.token }}',
    'YWI_GITHUB_EVENT_NAME: ${{ github.event_name }}',
    'YWI_GITHUB_REF: ${{ github.ref }}',
    'YWI_GITHUB_BASE_REF: ${{ github.base_ref }}',
    'YWI_GITHUB_HEAD_REF: ${{ github.head_ref }}',
    'YWI_GITHUB_PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}',
    'YWI_GITHUB_PR_BASE_SHA: ${{ github.event.pull_request.base.sha }}',
    'branches/dev',
    'branches/main',
    'YWI_GITHUB_LIVE_DEV_SHA',
    'YWI_GITHUB_LIVE_MAIN_SHA',
    'npm run promotion:shape:require',
    'npm run test:promotion-shape'
  ]) assert.ok(workflow.includes(value),value);
  assert.ok(workflow.indexOf('npm run promotion:shape:require') < workflow.indexOf('npm run test:release-source-evidence'));
});
check('workflow-live-branch-fetch-is-promotion-only',()=>{
  assert.ok(workflow.includes("if [[ \"${YWI_GITHUB_EVENT_NAME}\" == \"pull_request\" && \"${YWI_GITHUB_BASE_REF}\" == \"main\" && \"${YWI_GITHUB_HEAD_REF}\" == \"dev\" ]]; then"));
});
check('workflow-has-no-promotion-bypass',()=>{
  for(const forbidden of ['promotion_shape_bypass','ALLOW_DIRECT_MAIN','SKIP_PROMOTION_SHAPE','SKIP_PROMOTION_FRESHNESS']) assert.ok(!workflow.includes(forbidden),forbidden);
});

for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.error?` — ${item.error}`:''}`);
const failed=checks.filter((item)=>!item.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} production promotion shape/freshness checks passed.`);
if(failed.length)process.exit(1);

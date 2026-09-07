#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  evaluateProductionPromotionShape,
  renderPromotionShapeSummary,
  resolvePromotionFreshnessEnv,
  resolvePromotionAncestryEnv,
} from './production-promotion-shape-preflight.mjs';

const checks=[];
const check=(name,fn)=>{try{fn();checks.push({name,ok:true});}catch(error){checks.push({name,ok:false,error:error?.message||String(error)});}};

const feature={
  YWI_GITHUB_EVENT_NAME:'pull_request',
  YWI_GITHUB_REF:'refs/pull/123/merge',
  YWI_GITHUB_BASE_REF:'dev',
  YWI_GITHUB_HEAD_REF:'build243-production-promotion-ancestry-guard',
};
const promotion={
  ...feature,
  YWI_GITHUB_BASE_REF:'main',
  YWI_GITHUB_HEAD_REF:'dev',
  YWI_GITHUB_PR_HEAD_SHA:'dev-current-sha',
  YWI_GITHUB_PR_BASE_SHA:'main-current-sha',
  YWI_GITHUB_LIVE_DEV_SHA:'dev-current-sha',
  YWI_GITHUB_LIVE_MAIN_SHA:'main-current-sha',
  YWI_GITHUB_PROMOTION_MERGE_BASES:'previous-dev-sha',
  YWI_GITHUB_LIVE_MAIN_PARENTS:'previous-main-sha,previous-dev-sha',
};

check('feature-pr-to-dev-is-valid-shape',()=>{
  const r=evaluateProductionPromotionShape(feature);
  assert.equal(r.ok,true); assert.equal(r.mode,'development_feature_candidate');
  assert.equal(r.freshness_status,'not_applicable'); assert.equal(r.ancestry_status,'not_applicable');
  assert.equal(r.production_promotion_authorized,false);
});
check('current-dev-to-current-main-promotion-is-valid',()=>{
  const r=evaluateProductionPromotionShape(promotion);
  assert.equal(r.ok,true); assert.equal(r.freshness_status,'current');
  assert.equal(r.ancestry_status,'previous_promoted_dev_preserved');
  assert.equal(r.promotion_freshness_verified,true); assert.equal(r.promotion_ancestry_verified,true);
});
check('fast-forward-style-main-ancestor-is-valid',()=>{
  const r=evaluateProductionPromotionShape({...promotion,YWI_GITHUB_PROMOTION_MERGE_BASES:'main-current-sha',YWI_GITHUB_LIVE_MAIN_PARENTS:'older-main-sha'});
  assert.equal(r.ok,true); assert.equal(r.ancestry_status,'main_is_dev_ancestor');
});
check('promotion-requires-live-freshness-evidence',()=>{
  const r=evaluateProductionPromotionShape({...promotion,YWI_GITHUB_LIVE_DEV_SHA:''});
  assert.equal(r.ok,false); assert.ok(r.blocker_codes.includes('promotion_freshness_evidence_missing'));
});
check('stale-promotion-head-is-locked',()=>{
  const r=evaluateProductionPromotionShape({...promotion,YWI_GITHUB_PR_HEAD_SHA:'stale-dev-sha'});
  assert.equal(r.ok,false); assert.ok(r.blocker_codes.includes('promotion_head_not_current_dev'));
});
check('stale-promotion-base-is-locked',()=>{
  const r=evaluateProductionPromotionShape({...promotion,YWI_GITHUB_PR_BASE_SHA:'stale-main-sha'});
  assert.equal(r.ok,false); assert.ok(r.blocker_codes.includes('promotion_base_not_current_main'));
});
check('promotion-with-no-dev-changes-is-locked',()=>{
  const r=evaluateProductionPromotionShape({...promotion,YWI_GITHUB_PR_HEAD_SHA:'same-sha',YWI_GITHUB_PR_BASE_SHA:'same-sha',YWI_GITHUB_LIVE_DEV_SHA:'same-sha',YWI_GITHUB_LIVE_MAIN_SHA:'same-sha',YWI_GITHUB_PROMOTION_MERGE_BASES:'same-sha'});
  assert.equal(r.ok,false); assert.ok(r.blocker_codes.includes('promotion_has_no_dev_changes')); assert.equal(r.ancestry_status,'no_changes');
});
check('promotion-requires-ancestry-evidence',()=>{
  const r=evaluateProductionPromotionShape({...promotion,YWI_GITHUB_PROMOTION_MERGE_BASES:''});
  assert.equal(r.ok,false); assert.ok(r.blocker_codes.includes('promotion_ancestry_evidence_missing'));
});
check('ambiguous-promotion-ancestry-is-locked',()=>{
  const r=evaluateProductionPromotionShape({...promotion,YWI_GITHUB_PROMOTION_MERGE_BASES:'base-one,base-two'});
  assert.equal(r.ok,false); assert.ok(r.blocker_codes.includes('promotion_ancestry_ambiguous')); assert.equal(r.ancestry_status,'ambiguous');
});
check('rewritten-or-main-only-history-is-locked',()=>{
  const r=evaluateProductionPromotionShape({...promotion,YWI_GITHUB_PROMOTION_MERGE_BASES:'older-common-ancestor',YWI_GITHUB_LIVE_MAIN_PARENTS:'previous-main-sha,previous-promoted-dev-sha'});
  assert.equal(r.ok,false); assert.ok(r.blocker_codes.includes('promotion_ancestry_not_canonical'));
  assert.match(r.next_safe_action,/main-only change|rewritten Development history/i);
});
check('freshness-hydration-reads-event-and-exact-remote-refs',()=>{
  const env={...feature,YWI_GITHUB_BASE_REF:'main',YWI_GITHUB_HEAD_REF:'dev',GITHUB_EVENT_PATH:'/tmp/event.json'};
  const h=resolvePromotionFreshnessEnv(env,{readFile:()=>JSON.stringify({pull_request:{head:{sha:'dev-current-sha'},base:{sha:'main-current-sha'}}}),lsRemote:()=>`dev-current-sha\trefs/heads/dev\nmain-current-sha\trefs/heads/main\n`});
  assert.equal(h.YWI_GITHUB_PR_HEAD_SHA,'dev-current-sha'); assert.equal(h.YWI_GITHUB_PR_BASE_SHA,'main-current-sha');
  assert.equal(h.YWI_GITHUB_LIVE_DEV_SHA,'dev-current-sha'); assert.equal(h.YWI_GITHUB_LIVE_MAIN_SHA,'main-current-sha');
});
check('ancestry-hydration-fetches-current-dev-main-history',()=>{
  const calls=[];
  const h=resolvePromotionAncestryEnv({...promotion,YWI_GITHUB_PROMOTION_MERGE_BASES:'',YWI_GITHUB_LIVE_MAIN_PARENTS:''},{isShallow:()=>true,git:(args)=>{calls.push(args);if(args[0]==='fetch')return '';if(args[0]==='merge-base')return 'previous-dev-sha\n';if(args[0]==='rev-list')return 'main-current-sha previous-main-sha previous-dev-sha\n';throw new Error('unexpected git call');}});
  assert.equal(h.YWI_GITHUB_PROMOTION_MERGE_BASES,'previous-dev-sha'); assert.equal(h.YWI_GITHUB_LIVE_MAIN_PARENTS,'previous-main-sha,previous-dev-sha');
  assert.equal(evaluateProductionPromotionShape(h).ok,true);
  const fetchCall=calls.find((args)=>args[0]==='fetch'); assert.ok(fetchCall.includes('--unshallow'));
  assert.ok(fetchCall.includes('+refs/heads/dev:refs/remotes/origin/dev')); assert.ok(fetchCall.includes('+refs/heads/main:refs/remotes/origin/main'));
});
check('ancestry-hydration-omits-unshallow-for-complete-repo',()=>{
  const calls=[];
  resolvePromotionAncestryEnv({...promotion,YWI_GITHUB_PROMOTION_MERGE_BASES:'',YWI_GITHUB_LIVE_MAIN_PARENTS:''},{isShallow:()=>false,git:(args)=>{calls.push(args);if(args[0]==='fetch')return '';if(args[0]==='merge-base')return 'previous-dev-sha\n';if(args[0]==='rev-list')return 'main-current-sha previous-main-sha previous-dev-sha\n';return '';}});
  assert.ok(!calls.find((args)=>args[0]==='fetch').includes('--unshallow'));
});
check('feature-pr-does-not-run-freshness-or-ancestry-lookups',()=>{
  let touched=false;
  const f=resolvePromotionFreshnessEnv(feature,{readFile:()=>{touched=true;},lsRemote:()=>{touched=true;}});
  resolvePromotionAncestryEnv(f,{isShallow:()=>{touched=true;return true;},git:()=>{touched=true;}});
  assert.equal(touched,false);
});
check('failed-live-ref-lookup-remains-fail-closed',()=>{
  const env={...feature,YWI_GITHUB_BASE_REF:'main',YWI_GITHUB_HEAD_REF:'dev',GITHUB_EVENT_PATH:'/tmp/event.json'};
  const h=resolvePromotionFreshnessEnv(env,{readFile:()=>JSON.stringify({pull_request:{head:{sha:'dev-current-sha'},base:{sha:'main-current-sha'}}}),lsRemote:()=>{throw new Error('remote unavailable');}});
  const r=evaluateProductionPromotionShape(h); assert.equal(r.ok,false); assert.ok(r.blocker_codes.includes('promotion_freshness_evidence_missing'));
});
check('failed-history-fetch-remains-fail-closed',()=>{
  const h=resolvePromotionAncestryEnv({...promotion,YWI_GITHUB_PROMOTION_MERGE_BASES:'',YWI_GITHUB_LIVE_MAIN_PARENTS:''},{isShallow:()=>true,git:()=>{throw new Error('history unavailable');}});
  const r=evaluateProductionPromotionShape(h); assert.equal(r.ok,false); assert.ok(r.blocker_codes.includes('promotion_ancestry_evidence_missing'));
});
check('feature-branch-cannot-target-main',()=>{
  const r=evaluateProductionPromotionShape({...promotion,YWI_GITHUB_HEAD_REF:'build243-production-promotion-ancestry-guard'});
  assert.equal(r.ok,false); assert.ok(r.blocker_codes.includes('production_main_requires_dev_head'));
});
check('dev-pr-must-use-feature-head',()=>{
  const r=evaluateProductionPromotionShape({...feature,YWI_GITHUB_HEAD_REF:'main'}); assert.equal(r.ok,false); assert.ok(r.blocker_codes.includes('development_pr_requires_feature_head'));
});
check('unsupported-pr-base-is-locked',()=>{
  const r=evaluateProductionPromotionShape({...feature,YWI_GITHUB_BASE_REF:'release',YWI_GITHUB_HEAD_REF:'dev'}); assert.equal(r.ok,false); assert.ok(r.blocker_codes.includes('unsupported_pull_request_base'));
});
check('exact-main-push-is-valid-followup-shape',()=>{
  const r=evaluateProductionPromotionShape({YWI_GITHUB_EVENT_NAME:'push',YWI_GITHUB_REF:'refs/heads/main'}); assert.equal(r.ok,true); assert.equal(r.mode,'exact_main_followup'); assert.equal(r.production_promotion_authorized,false);
});
check('non-main-push-is-locked',()=>{
  const r=evaluateProductionPromotionShape({YWI_GITHUB_EVENT_NAME:'push',YWI_GITHUB_REF:'refs/heads/dev'}); assert.equal(r.ok,false); assert.ok(r.blocker_codes.includes('unsupported_push_ref'));
});
check('workflow-dispatch-is-source-only',()=>{
  const r=evaluateProductionPromotionShape({YWI_GITHUB_EVENT_NAME:'workflow_dispatch',YWI_GITHUB_REF:'refs/heads/main'}); assert.equal(r.ok,true); assert.equal(r.mode,'manual_source_check'); assert.match(r.next_safe_action,/not Production promotion authority/i);
});
check('summary-exposes-freshness-and-ancestry-without-authority',()=>{
  const text=renderPromotionShapeSummary(evaluateProductionPromotionShape(promotion));
  for(const value of ['Production promotion shape, freshness and ancestry','Promotion freshness','Promotion ancestry','Merge base(s)','Current main parent(s)','never authorizes Production promotion','repository-enforcement']) assert.ok(text.includes(value),value);
});

const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const source=fs.readFileSync('scripts/production-promotion-shape-preflight.mjs','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
check('package-wiring',()=>{
  assert.equal(pkg.scripts['promotion:shape:require'],'node scripts/production-promotion-shape-preflight.mjs');
  assert.equal(pkg.scripts['test:promotion-shape'],'node scripts/production-promotion-shape-preflight-check.mjs');
});
check('workflow-wiring-remains-canonical',()=>{
  for(const value of ['Validate Development / Production promotion shape','YWI_GITHUB_EVENT_NAME: ${{ github.event_name }}','YWI_GITHUB_REF: ${{ github.ref }}','YWI_GITHUB_BASE_REF: ${{ github.base_ref }}','YWI_GITHUB_HEAD_REF: ${{ github.head_ref }}','npm run promotion:shape:require','npm run test:promotion-shape']) assert.ok(workflow.includes(value),value);
  assert.ok(workflow.indexOf('npm run promotion:shape:require') < workflow.indexOf('npm run test:release-source-evidence'));
});
check('source-fetches-only-canonical-dev-main-promotion-evidence',()=>{
  for(const value of ["eventName !== 'pull_request' || baseRef !== 'main' || headRef !== 'dev'","execFileSync('git', ['ls-remote', 'origin', 'refs/heads/dev', 'refs/heads/main']","+refs/heads/dev:refs/remotes/origin/dev","+refs/heads/main:refs/remotes/origin/main","['merge-base', '--all', 'refs/remotes/origin/main', 'refs/remotes/origin/dev']","['rev-list', '--parents', '-n', '1', 'refs/remotes/origin/main']",'GITHUB_EVENT_PATH']) assert.ok(source.includes(value),value);
});
check('workflow-and-source-have-no-promotion-bypass',()=>{
  for(const forbidden of ['promotion_shape_bypass','ALLOW_DIRECT_MAIN','SKIP_PROMOTION_SHAPE','SKIP_PROMOTION_FRESHNESS','SKIP_PROMOTION_ANCESTRY']) {assert.ok(!workflow.includes(forbidden),forbidden);assert.ok(!source.includes(forbidden),forbidden);}
});

for(const item of checks) console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.error?` — ${item.error}`:''}`);
const failed=checks.filter((item)=>!item.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} production promotion shape/freshness/ancestry checks passed.`);
if(failed.length) process.exit(1);

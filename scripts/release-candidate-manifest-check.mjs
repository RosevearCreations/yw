#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildReleaseCandidateManifest,
  classifyChangedFiles,
  collectReleaseCandidateContext,
  resolveCandidateKind,
  writeReleaseCandidateManifest,
} from './release-candidate-manifest.mjs';

const checks=[];
const check=(name,fn)=>{try{fn();checks.push({name,ok:true});}catch(error){checks.push({name,ok:false,error:error?.message||String(error)});}};
const sha=(char)=>char.repeat(40);
const baseContext={
  event_name:'pull_request',
  ref:'refs/pull/244/merge',
  base_ref:'dev',
  head_ref:'build244-canonical-release-manifest',
  workflow_sha:sha('a'),
  feature_sha:sha('b'),
  pr_base_sha:sha('c'),
  dev_sha:sha('d'),
  main_sha:sha('e'),
  tree_sha:sha('f'),
  changed_files:[
    'scripts/release-candidate-manifest.mjs',
    'scripts/release-candidate-manifest-check.mjs',
    'package.json',
  ],
};
const env={
  YWI_GITHUB_EVENT_NAME:'pull_request',
  YWI_GITHUB_REF:'refs/pull/244/merge',
  YWI_GITHUB_BASE_REF:'dev',
  YWI_GITHUB_HEAD_REF:'build244-canonical-release-manifest',
  YWI_GITHUB_REPOSITORY:'RosevearCreations/yw',
  YWI_GITHUB_WORKFLOW_NAME:'YWI source and staging checks',
  YWI_GITHUB_RUN_ID:'12345',
  YWI_GITHUB_RUN_ATTEMPT:'1',
  YWI_SOURCE_SUITE_COMPLETED:'true',
  YWI_GITHUB_MAIN_PROTECTED:'false',
};

check('candidate-kind-feature-pr',()=>assert.equal(resolveCandidateKind(env),'development_feature_candidate'));
check('candidate-kind-production-promotion',()=>assert.equal(resolveCandidateKind({...env,YWI_GITHUB_BASE_REF:'main',YWI_GITHUB_HEAD_REF:'dev'}),'production_promotion_candidate'));
check('candidate-kind-exact-main',()=>assert.equal(resolveCandidateKind({YWI_GITHUB_EVENT_NAME:'push',YWI_GITHUB_REF:'refs/heads/main'}),'exact_main_followup'));
check('source-only-release-governance-classification',()=>{
  const result=classifyChangedFiles(baseContext.changed_files);
  assert.equal(result.migration_change,false);
  assert.ok(result.changed_surfaces.includes('automation_and_controls'));
  assert.ok(result.preliminary_risk_tags.includes('release_governance'));
  assert.equal(result.changed_file_count,3);
});
check('schema-change-classification',()=>{
  const result=classifyChangedFiles(['sql/208_release_manifest.sql','js/admin.js']);
  assert.equal(result.migration_change,true);
  assert.deepEqual(result.changed_migrations,['208']);
  assert.ok(result.preliminary_risk_tags.includes('schema_changing'));
  assert.ok(result.changed_surfaces.includes('database_schema'));
});
check('sensitive-surface-tags-are-descriptive',()=>{
  const result=classifyChangedFiles(['scripts/finance-posting-preflight.mjs','tests/auth-security.spec.mjs','.github/workflows/staging.yml','help.html']);
  for(const tag of ['finance_sensitive','auth_or_security_sensitive','staging_sensitive','deployment_sensitive','public_content_sensitive'])assert.ok(result.preliminary_risk_tags.includes(tag),tag);
});
check('manifest-contains-canonical-source-identity',()=>{
  const result=buildReleaseCandidateManifest(env,{context:baseContext,latestSchema:207,generatedAt:'2026-09-07T15:00:00.000Z'});
  assert.equal(result.ok,true);
  assert.equal(result.manifest.manifest_kind,'ywi_release_candidate');
  assert.equal(result.manifest.source.feature_sha,sha('b'));
  assert.equal(result.manifest.source.dev_sha,sha('d'));
  assert.equal(result.manifest.source.main_sha,sha('e'));
  assert.equal(result.manifest.source.candidate_tree_sha,sha('f'));
  assert.equal(result.manifest.schema.repository_latest_version,207);
});
check('manifest-exposes-gate-evidence-without-authorizing-release',()=>{
  const {manifest}=buildReleaseCandidateManifest(env,{context:baseContext,latestSchema:207});
  assert.equal(manifest.gate_evidence.workflow_name,'YWI source and staging checks');
  assert.equal(manifest.gate_evidence.workflow_run_id,12345);
  assert.equal(manifest.gate_evidence.source_suite_completed_before_manifest,true);
  assert.equal(manifest.boundaries.descriptive_evidence_only,true);
  assert.equal(manifest.boundaries.release_authorization_performed,false);
  assert.equal(manifest.boundaries.production_promotion_performed,false);
  assert.equal(manifest.boundaries.build_246_policy_classifier_not_replaced,true);
});
check('unprotected-main-remains-visible-external-blocker',()=>{
  const {manifest}=buildReleaseCandidateManifest(env,{context:baseContext,latestSchema:207});
  assert.ok(manifest.external_blockers.some((item)=>item.code==='main_unprotected'));
});
check('verified-main-does-not-fabricate-protection-blocker',()=>{
  const {manifest}=buildReleaseCandidateManifest({...env,YWI_GITHUB_MAIN_PROTECTED:'true'},{context:baseContext,latestSchema:207});
  assert.ok(!manifest.external_blockers.some((item)=>item.code==='main_unprotected'));
});
check('missing-change-evidence-is-visible-not-silently-green',()=>{
  const {manifest}=buildReleaseCandidateManifest(env,{context:{...baseContext,changed_files:[]},latestSchema:207});
  assert.ok(manifest.external_blockers.some((item)=>item.code==='changed_files_unverified'));
});
check('wrong-repository-is-rejected',()=>{
  const result=buildReleaseCandidateManifest({...env,YWI_GITHUB_REPOSITORY:'example/wrong'},{context:baseContext,latestSchema:207});
  assert.equal(result.ok,false);
  assert.match(result.errors.join(' '),/RosevearCreations\/yw/);
});
check('stale-schema-discovery-is-rejected',()=>{
  const result=buildReleaseCandidateManifest(env,{context:baseContext,latestSchema:200});
  assert.equal(result.ok,false);
  assert.match(result.errors.join(' '),/Schema 201 or newer/);
});
check('context-hydration-uses-event-remote-tips-tree-and-diff',()=>{
  const calls=[];
  const hydrated=collectReleaseCandidateContext({...env,YWI_GITHUB_SHA:sha('a'),YWI_GITHUB_EVENT_PATH:'/tmp/event.json'}, {
    readFile:()=>JSON.stringify({pull_request:{head:{sha:sha('b')},base:{sha:sha('c')}}}),
    lsRemote:()=>`${sha('d')}\trefs/heads/dev\n${sha('e')}\trefs/heads/main\n`,
    git:(args)=>{
      calls.push(args);
      if(args[0]==='fetch')return '';
      if(args[0]==='diff')return 'package.json\nscripts/release-candidate-manifest.mjs\n';
      if(args[0]==='rev-parse')return `${sha('f')}\n`;
      throw new Error(`unexpected git call ${args.join(' ')}`);
    },
  });
  assert.equal(hydrated.feature_sha,sha('b'));
  assert.equal(hydrated.dev_sha,sha('d'));
  assert.equal(hydrated.main_sha,sha('e'));
  assert.equal(hydrated.tree_sha,sha('f'));
  assert.deepEqual(hydrated.changed_files,['package.json','scripts/release-candidate-manifest.mjs']);
  assert.ok(calls.some((args)=>args[0]==='fetch'));
  assert.ok(calls.some((args)=>args[0]==='diff'));
});
check('writer-produces-machine-readable-json',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ywi-release-manifest-'));
  const outputPath=path.join(dir,'candidate.json');
  try{
    const result=writeReleaseCandidateManifest(env,{context:baseContext,latestSchema:207,generatedAt:'2026-09-07T15:00:00.000Z',outputPath});
    assert.equal(result.ok,true);
    const parsed=JSON.parse(fs.readFileSync(outputPath,'utf8'));
    assert.equal(parsed.manifest_format_version,1);
    assert.equal(parsed.schema.repository_latest_version,207);
    assert.equal(parsed.change.changed_file_count,3);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const evidenceCheck=fs.readFileSync('scripts/release-source-evidence-bundle-check.mjs','utf8');
check('package-wiring',()=>{
  assert.equal(pkg.scripts['release:manifest:write'],'node scripts/release-candidate-manifest.mjs');
  assert.equal(pkg.scripts['test:release-manifest'],'node scripts/release-candidate-manifest-check.mjs');
  assert.match(pkg.scripts['test:release-source-evidence'],/release-candidate-manifest-check\.mjs/);
});
check('canonical-release-source-step-remains-parent-gate',()=>{
  assert.ok(evidenceCheck.includes('release-source evidence'));
  assert.ok(!evidenceCheck.includes('production_promotion_performed:true'));
});

const passed=checks.filter((item)=>item.ok).length;
for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.error?' — '+item.error:''}`);
console.log(`\n${passed}/${checks.length} canonical release manifest checks passed.`);
process.exit(passed===checks.length?0:1);

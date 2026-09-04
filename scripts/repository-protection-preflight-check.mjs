#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluateRepositoryProtection } from './repository-protection-preflight.mjs';

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

check('exact-protected-main-is-ready',()=>assert.equal(evaluateRepositoryProtection(base).ok,true));
check('unprotected-main-is-locked',()=>{
  const r=evaluateRepositoryProtection({...base,YWI_GITHUB_MAIN_PROTECTED:'false'});
  assert.equal(r.ok,false); assert.equal(r.main_protected,false);
});
check('stale-main-sha-is-locked',()=>{
  const r=evaluateRepositoryProtection({...base,YWI_GITHUB_MAIN_SHA:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'});
  assert.equal(r.ok,false); assert.equal(r.exact_main_sha_match,false);
});
check('pull-request-event-cannot-authorize-release',()=>assert.equal(evaluateRepositoryProtection({...base,YWI_GITHUB_EVENT_NAME:'pull_request'}).ok,false));
check('non-main-ref-cannot-authorize-release',()=>assert.equal(evaluateRepositoryProtection({...base,YWI_GITHUB_REF:'refs/heads/dev'}).ok,false));
check('missing-github-evidence-is-locked',()=>assert.equal(evaluateRepositoryProtection({...base,YWI_GITHUB_MAIN_SHA:'',YWI_GITHUB_MAIN_PROTECTED:''}).ok,false));
check('protected-value-is-exact-not-truthy',()=>assert.equal(evaluateRepositoryProtection({...base,YWI_GITHUB_MAIN_PROTECTED:'1'}).ok,false));

const workflow=fs.readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const docs=fs.readFileSync('docs/NEXT_STEPS_AND_SANITY_CHECK.md','utf8');
const help=fs.readFileSync('help.html','utf8');
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
check('operator-authority-documents-external-boundary',()=>{
  assert.ok(docs.includes('exact-main repository protection preflight'));
  assert.ok(help.includes('Repository enforcement preflight'));
  assert.ok(help.includes('does not enable branch protection'));
});

for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.error?` — ${item.error}`:''}`);
const failed=checks.filter((item)=>!item.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} repository protection preflight checks passed.`);
if(failed.length)process.exit(1);

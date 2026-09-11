#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath='.github/workflows/post-promotion-dev-reconciliation.yml';
const canonicalPath='.github/workflows/staging-browser-integration.yml';
const workflow=fs.readFileSync(workflowPath,'utf8');
const canonical=fs.readFileSync(canonicalPath,'utf8');
const checks=[];
const add=(name,ok,detail='')=>checks.push({name,ok:!!ok,detail});

add('workflow-run-only',workflow.includes("workflow_run:")&&workflow.includes("workflows: ['YWI source and staging checks']")&&workflow.includes('types: [completed]'));
add('successful-main-push-only',workflow.includes("github.event.workflow_run.conclusion == 'success'")&&workflow.includes("github.event.workflow_run.event == 'push'")&&workflow.includes("github.event.workflow_run.head_branch == 'main'"));
add('contents-write-only',/permissions:\s*\n\s*contents:\s*write\s*(?:\n|$)/m.test(workflow)&&!/(issues|pull-requests|actions|checks|deployments|packages|id-token):\s*write/i.test(workflow));
add('exact-run-sha-bound',workflow.includes('YWI_SOURCE_RUN_SHA: ${{ github.event.workflow_run.head_sha }}')&&workflow.includes('current_main="$(git rev-parse origin/main)"')&&workflow.includes('[[ "$current_main" != "$YWI_SOURCE_RUN_SHA" ]]'));
add('dev-must-be-ancestor',workflow.includes('git merge-base --is-ancestor "$current_dev" "$current_main"'));
add('zero-tree-diff-required',workflow.includes('git diff --quiet "$current_dev" "$current_main" --'));
add('idempotent-exact-match',workflow.includes('[[ "$current_dev" == "$current_main" ]]')&&workflow.includes('no update required'));
add('non-force-dev-only-push',workflow.includes('git push origin "$current_main:refs/heads/dev"')&&!/git\s+push[^\n]*(?:--force|-f\b|\+refs\/heads)/i.test(workflow));
add('never-push-main',!workflow.includes('refs/heads/main"')&&!/git\s+push[^\n]*main/i.test(workflow));
add('no-supabase-or-business-secrets',!/(SUPABASE_|STRIPE|PAYPAL|SERVICE_ROLE|CUSTOMER|FINANCE_POSTING)/i.test(workflow));
add('no-db-provider-business-mutation',!/(psql|supabase\s+db|curl\s+.*supabase|payment|invoice|customer|provider|posting)/i.test(workflow));
add('canonical-source-remains-main-push-gated',canonical.includes('push:\n    branches: [main]')&&canonical.includes('name: YWI source and staging checks'));

for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.detail?' — '+item.detail:''}`);
const failed=checks.filter((item)=>!item.ok);
if(failed.length){
  console.error(`Post-promotion dev reconciliation contract failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`Post-promotion dev reconciliation contract passed: ${checks.length}/${checks.length}`);

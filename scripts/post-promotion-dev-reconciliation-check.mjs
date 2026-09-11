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
add('serialized-reconciliation',workflow.includes('concurrency:')&&workflow.includes('group: ywi-post-promotion-dev-reconciliation')&&workflow.includes('cancel-in-progress: false'));
add('exact-run-sha-bound',workflow.includes('YWI_SOURCE_RUN_SHA: ${{ github.event.workflow_run.head_sha }}')&&workflow.includes('current_main="$(git rev-parse origin/main)"')&&workflow.includes('[[ "$current_main" != "$YWI_SOURCE_RUN_SHA" ]]'));
add('superseded-main-safe-skip',workflow.includes('Safe skip: source run')&&workflow.includes('was superseded because main is now')&&/if \[\[ "\$current_main" != "\$YWI_SOURCE_RUN_SHA" \]\]; then[\s\S]*?exit 0/.test(workflow));
add('idempotent-exact-match',workflow.includes('[[ "$current_dev" == "$current_main" ]]')&&workflow.includes('no update required'));
add('new-development-safe-skip',workflow.includes('git merge-base --is-ancestor "$current_main" "$current_dev"')&&workflow.includes('has newer Development work')&&/merge-base --is-ancestor "\$current_main" "\$current_dev"[\s\S]*?exit 0/.test(workflow));
add('diverged-history-fails-closed',workflow.includes('Refusing reconciliation: dev history diverged from current main.')&&workflow.includes('git merge-base --is-ancestor "$current_dev" "$current_main"'));
add('zero-tree-diff-required',workflow.includes('git diff --quiet "$current_dev" "$current_main" --')&&workflow.includes('Refusing reconciliation: dev and main application trees differ.'));
add('non-force-dev-only-push',workflow.includes('git push origin "$current_main:refs/heads/dev"')&&!/git\s+push[^\n]*(?:--force|-f\b|\+refs\/heads)/i.test(workflow));
add('concurrent-dev-push-race-safe',workflow.includes('Initial non-force dev push was rejected; re-checking for concurrent Development work.')&&workflow.includes('refreshed_dev="$(git rev-parse origin/dev)"')&&workflow.includes('git merge-base --is-ancestor "$current_main" "$refreshed_dev"')&&workflow.includes('already contains exact GREEN main'));
add('rejected-push-unsafe-state-fails',workflow.includes('does not descend from exact GREEN main')&&/does not descend from exact GREEN main[^\n]*" >&2\n\s*exit 1/.test(workflow));
add('never-push-main',!/:refs\/heads\/main(?:["'\s]|$)/i.test(workflow));
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

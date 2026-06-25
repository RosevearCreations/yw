#!/usr/bin/env node
/** Repository-level static sanity check for build 2026-06-23a / schema 153. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const exists=(file)=>fs.existsSync(path.join(root,file));
const all=(text, values)=>values.every((value)=>text.includes(value));
const results=[];
function add(name,ok,details=''){results.push({name,ok,details});}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap((entry)=>{const full=path.join(dir,entry.name);return entry.isDirectory()?walk(full):[full];});}

const schema=read('sql/000_full_schema_reference.sql');
const migration153=read('sql/153_release_fixture_policy_mapping_seo_alerts.sql');
const operations=read('supabase/functions/operations-manage/index.ts');
const upload=read('supabase/functions/upload-public-asset/index.ts');
const webhook=read('supabase/functions/stripe-webhook/index.ts');
const accountant=read('supabase/functions/accountant-export/index.ts');
const cockpit=read('js/operations-cockpit.js');
const index=read('index.html');
const css=read('style.css');
const config=read('supabase/config.toml');

// Documentation and archive integrity.
const activeMd=walk(root).filter((file)=>file.endsWith('.md')&&!file.includes(`${path.sep}archive${path.sep}`)).map((file)=>path.relative(root,file).replaceAll('\\','/')).sort();
add('active-markdown-exactly-three',JSON.stringify(activeMd)===JSON.stringify(['README.md','docs/ACTIVE_PROJECT_HANDBOOK.md','docs/NEXT_STEPS_AND_SANITY_CHECK.md']),`Active Markdown: ${activeMd.join(', ')||'none'}`);
add('retired-markdown-archive-present',exists('archive/retired-markdown-2026-06-23a')&&walk(path.join(root,'archive/retired-markdown-2026-06-23a')).filter((file)=>file.endsWith('.md')).length>=80,'Historical Markdown is preserved in the dated archive.');
add('temp-write-files-retired',!walk(root).filter((file)=>!file.includes(`${path.sep}archive${path.sep}`)&&/test_write/i.test(path.basename(file))).length,'No temporary write files remain active.');

// Schema/reference integrity.
const migrationBlocks=(schema.match(/BEGIN MIGRATION:/g)||[]).length;
add('canonical-schema-through-153',schema.includes('BEGIN MIGRATION: 030_')&&schema.includes('BEGIN MIGRATION: 153_')&&migrationBlocks===124,`Canonical schema has ${migrationBlocks} migration blocks.`);
add('canonical-schema-includes-schema153-verbatim',schema.includes(migration153.trim()),'Full schema contains the current migration.');
add('schema153-transaction-balanced',(migration153.match(/^begin;$/gmi)||[]).length===1&&(migration153.match(/^commit;$/gmi)||[]).length===1,'Schema 153 has one BEGIN and one COMMIT marker.');
add('schema153-staging-fixtures',all(migration153,['operations_staging_fixture_sets','ywi_rpc_create_staging_fixture_set','ywi_rpc_cleanup_staging_fixture_set','STAGING-']),'Disposable staging fixtures are defined.');
add('schema153-private-media',all(migration153,['review-assets','review_storage_bucket','published_storage_bucket','public=false']),'Review media bucket and promotion fields are defined.');
add('schema153-policy-assertions',all(migration153,['ywi_security_policy_assertions','v_security_policy_assertion_summary','sensitive_tables_rls_enabled']),'Policy assertion layer is defined.');
add('schema153-accountant-mapping',all(migration153,['accountant_export_mapping_rules','v_accountant_mapping_readiness','ywi_rpc_capture_accountant_close_snapshot']),'Accountant mapping/close controls are defined.');
add('schema153-route-and-alert-queues',all(migration153,['content_signal_observations','v_route_content_decision_queue','stripe_webhook_operational_alerts','v_stripe_webhook_alert_queue']),'Route evidence and webhook alert queues are defined.');

// Function and UI wiring.
add('operations-schema153-release-proof',all(operations,["const SCHEMA = 153",'publishApprovedAsset','YWI_ALLOW_STAGING_FIXTURES','content_signal_record','stripe_webhook_alert_decision','ywi_refresh_stripe_webhook_alerts']),'Operations Edge Function is wired to schema 153 controls.');
add('upload-private-review-asset',all(upload,["const BUCKET = 'review-assets'",'review_only:true','imageDimensions','checksum_sha256']),'Upload handler verifies and privately stores review media.');
add('webhook-alert-refresh',all(webhook,["const SCHEMA=153",'validateSession','ywi_rpc_record_portal_deposit_paid','ywi_refresh_stripe_webhook_alerts']),'Stripe handler validates events and refreshes safe alerts.');
add('accountant-close-snapshot',all(accountant,["const SCHEMA = 153",'ywi_rpc_capture_accountant_close_snapshot','close_mapping_snapshot','createSignedUrl']),'Accountant export captures mapping/close snapshot and uses signed downloads.');
add('cockpit-release-proof-ui',all(cockpit,['Schema 153 release-proof actions','oc_fixture_form','oc_policy_summary','oc_signal_queue','oc_webhook_alerts','oc-private-media']),'Cockpit exposes responsive release-proof controls.');
add('css-release-proof-responsive',all(css,['.oc-release-grid','.oc-release-card','.oc-private-media','@media(max-width:960px){.oc-release-grid']), 'Release-proof/private-media CSS includes responsive fallback.');
add('cockpit-dark-contrast-remediation',all(css,['Build 2026-06-23a — Operations Cockpit contrast remediation','--oc-text: #f8fbff','--oc-surface: #0c172b','.operations-cockpit .oc-badge-approved','.operations-cockpit .oc-permission.is-allowed','.operations-cockpit .oc-permission.is-restricted','.operations-cockpit .operations-status[data-status="error"]','@media (forced-colors: active)']),'Cockpit dark-surface tokens and state contrast overrides remain present.');
add('jwt-config-protected-functions',/\[functions\.operations-manage\]\s+verify_jwt = true/s.test(config)&&/\[functions\.upload-public-asset\]\s+verify_jwt = true/s.test(config)&&/\[functions\.accountant-export\]\s+verify_jwt = true/s.test(config),'Protected functions retain JWT verification.');

// SEO/CSS/cache guardrails.
const h1Count=(index.match(/<h1\b/gi)||[]).length;
add('homepage-one-h1',h1Count===1,`Homepage H1 count: ${h1Count}.`);
const ids=[...index.matchAll(/\bid=["']([^"']+)["']/gi)].map((match)=>match[1]);
const duplicateIds=ids.filter((id,indexValue)=>ids.indexOf(id)!==indexValue);
add('homepage-no-duplicate-ids',duplicateIds.length===0,duplicateIds.length?`Duplicates: ${[...new Set(duplicateIds)].join(', ')}`:'No duplicate IDs.');
add('build-cache-marker-current',all(index,['2026-06-23a','operations-cockpit.js?v=2026-06-23a'])&&read('server-worker.js').includes('ywi-shell-v2026-06-23a'),'HTML and service-worker cache marker are current.');
add('visual-input-mime-match',cockpit.includes('accept="image/jpeg,image/png,image/webp"')&&!migration153.includes('image/avif'),'UI/storage MIME promise matches server verification.');

// New helper/CI files.
for(const file of ['scripts/staging-fixtures.mjs','scripts/security-policy-assertions.mjs','scripts/operations-cockpit-contrast-check.mjs','tests/browser/operations-portal.spec.mjs','.github/workflows/staging-browser-integration.yml','package.json']) add(`exists:${file}`,exists(file),'Required release-proof support file is present.');

const jsFiles=['js/api.js','js/operations-cockpit.js','js/customer-portal.js','js/public-routes.js','scripts/generate-public-routes.mjs','scripts/operations-rpc-integration-test.mjs','scripts/security-policy-assertions.mjs','scripts/staging-fixtures.mjs','scripts/operations-rpc-staging-e2e.mjs','scripts/operations-cockpit-contrast-check.mjs','scripts/repo-smoke-check.mjs','app.js','server-worker.js'];
for(const file of jsFiles){const run=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});add(`syntax:${file}`,run.status===0,run.status===0?'Syntax OK.':(run.stderr||run.stdout).trim());}

let ts;
try{const require=createRequire(import.meta.url);try{ts=require('typescript');}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');}}catch(error){add('typescript-compiler-available',false,String(error));}
if(ts){for(const file of ['supabase/functions/operations-manage/index.ts','supabase/functions/upload-public-asset/index.ts','supabase/functions/customer-portal/index.ts','supabase/functions/public-content/index.ts','supabase/functions/stripe-webhook/index.ts','supabase/functions/accountant-export/index.ts']){const output=ts.transpileModule(read(file),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:file});const errors=(output.diagnostics||[]).filter((diag)=>diag.category===ts.DiagnosticCategory.Error);add(`typescript-syntax:${file}`,errors.length===0,errors.length?errors.map((diag)=>ts.flattenDiagnosticMessageText(diag.messageText,'\n')).join(' | '):'TypeScript syntax OK.');}}

for(const script of ['scripts/operations-rpc-integration-test.mjs','scripts/security-policy-assertions.mjs','scripts/operations-cockpit-contrast-check.mjs','scripts/operations-rpc-staging-e2e.mjs']){const run=spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8'});add(`static:${path.basename(script)}`,run.status===0,run.status===0?'Static checks passed.':(run.stderr||run.stdout).trim());}

const passed=results.filter((item)=>item.ok).length;
console.log(`\nYWI repository smoke check: ${passed}/${results.length} passed\n`);
for(const item of results)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.details?` — ${item.details}`:''}`);
process.exit(results.some((item)=>!item.ok)?1:0);

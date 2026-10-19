import fs from 'node:fs';import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const backend=read('supabase/functions/admin-directory/index.ts');
const i=backend.indexOf("if (scope === 'seasonal_first_use_cohort_coverage')");
const j=backend.indexOf("if (scope === 'activity_timeline')",i);
assert.ok(i>0&&j>i,'Seasonal first-use server source missing');
const source=backend.slice(i,j);
for(const term of [
 "roleRank(actorRole) < roleRank('supervisor')",
 "hasModuleAccess(supabase,actorProfile,'jobs','view')",
 "safeListEvidence(supabase,'clients'",
 "safeListEvidence(supabase,'client_sites'",
 "safeListEvidence(supabase,'work_orders'",
 "safeListEvidence(supabase,'v_landscape_production_session_directory'",
 "safeListEvidence(supabase,'workability_observations'",
 "safeListEvidence(supabase,'seasonal_operations_cycles'",
 "r.row_count>=r.limit","Date.parse(sample.started_at)",
 "spring_summer:'mowing_landscaping'","fall:'fall_cleanup'",
 "winter:'snow_clearing_removal'","four_season:'general_outdoor'",
 "String(o.work_order_id||'')===String(order.id)",
 "String(o.client_site_id||'')===String(site.id)",
 "String(o.service_date||'').slice(0,10)===serviceDay",
 "String(o.season_context||'')===String(c.season_context)",
 "String(o.service_context||'')===serviceContext",
 "Date.parse(s.started_at)<Date.parse(client.created_at)",
 "Date.parse(s.started_at)<Date.parse(site.created_at)",
 "s.production_recorded_by_profile_id","const minSample=3",
 "unresolved===0&&firsts.length>=minSample",
 "first_use_denominator:eligible?firsts.length:null",
 "linkage_gap_withheld","insufficient_sample","sample_supported",
 "state:'withheld'","denominator_definition:"])
 assert.ok(source.includes(term),'First-use cohort canonical proof missing: '+term);
assert.doesNotMatch(source,/\.(?:insert|upsert|update|delete)\s*\(/,'First-use evidence may never write');
assert.ok(backend.slice(0,i).includes("'seasonal_first_use_cohort_coverage'"),'Jobs view permission mapping missing');
const ui=read('js/seasonal-first-use-cohort-coverage-415.js');new Function(ui);
for(const term of ['seasonal415','seasonal_first_use_cohort_coverage',
 'Date.now()-n<=300000','d.minimum_sample!==3',
 'data-seasonal415-state','first_use_denominator>=3',
 'No first-use denominator inferred','First-use denominator WITHHELD'])
 assert.ok(ui.includes(term),'First-use UI safety missing: '+term);
const p=JSON.parse(read('package.json'));
assert.equal(p.scripts['test:seasonal-first-use-cohort-coverage-415'],
 'node scripts/seasonal-first-use-cohort-coverage-415-check.mjs');
assert.ok(p.scripts['test:browser:seasonal-first-use-cohort-coverage-415'].includes(
 'tests/browser/seasonal-first-use-cohort-coverage-415.spec.mjs'));
const ci=read('.github/workflows/staging-browser-integration.yml');
for(const term of ['npm run test:seasonal-first-use-cohort-coverage-415',
 'npm run test:browser:seasonal-first-use-cohort-coverage-415'])
 assert.ok(ci.includes(term),'CI gate missing: '+term);
assert.ok(read('index.html').includes('js/seasonal-first-use-cohort-coverage-415.js'));
assert.ok(read('help.html').includes('id="seasonal-first-use-cohort-415"'));
console.log('Build 415 cohort identity, freshness, sample minimum, no-zero and no-write source contracts PASS');

import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('sql/212_property_site_intelligence.sql');
const operations=read('supabase/functions/operations-manage/index.ts');
const ui=read('js/operations-cockpit.js');
const boundaries=read('supabase/functions/_shared/module-write-boundaries.ts');
const core=read('supabase/functions/_shared/core-data-read-models.ts');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');

for (const token of [
  'Schema 212 — Build 323 Property & Site Intelligence',
  'approximate_serviceable_area numeric(12,2)',
  'gate_fence_summary text',
  'parking_trailer_limits text',
  'pet_notes text',
  'irrigation_notes text',
  'slope_notes text',
  'drainage_wet_area_notes text',
  'utility_locate_notes text',
  'tree_brush_notes text',
  'recurring_property_instructions text',
  'create table if not exists public.client_site_zones',
  'create table if not exists public.client_site_photos',
  'v_property_site_intelligence',
  'v_property_site_zone_directory',
  'v_property_site_photo_directory',
  'ywi_rpc_property_site_save',
  'ywi_rpc_property_zone_save',
  'ywi_rpc_property_photo_register',
  "('property_site_save','jobs','approve','write'",
  "('property_zone_save','jobs','approve','write'",
  "('property_photo_register','jobs','approve','write'",
  'ywi_property_site_security_assertions',
  "212,'212_property_site_intelligence'",
  '212 as expected_schema_version'
]) assert.ok(migration.includes(token), `Schema 212 missing ${token}`);

assert.ok(!/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.client_sites\b/i.test(migration),'Build 323 must extend, not recreate, client_sites.');
assert.ok(!/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.sites\b/i.test(migration),'Build 323 must preserve the separate Safety/legacy sites authority.');
assert.ok(!/\b(?:insert\s+into|update|delete\s+from)\s+public\.sites\b/i.test(migration),'Build 323 must not mutate the Safety/legacy sites authority.');

for (const token of [
  "v_property_site_intelligence",
  "v_property_site_zone_directory",
  "v_property_site_photo_directory",
  "property_site_meta: { build:323, schema:212",
  "action === 'property_site_save'",
  "action === 'property_zone_save'",
  "action === 'property_photo_register'",
  "supabase.rpc('ywi_rpc_property_site_save'",
  "supabase.rpc('ywi_rpc_property_zone_save'",
  "supabase.rpc('ywi_rpc_property_photo_register'",
  'build:323,schema:212'
]) assert.ok(operations.includes(token), `operations-manage missing ${token}`);

for (const token of [
  'Property &amp; Site Intelligence',
  'oc_property_form',
  'oc_property_zone_form',
  'oc_property_photo_form',
  'oc_property_sites',
  'oc_property_zones',
  'oc_property_photos',
  'Gates / fences',
  'Parking / trailer limits',
  'Pets',
  'Irrigation',
  'Drainage / wet areas',
  'Utilities / locate notes',
  'Tree / brush concerns',
  'Recurring property instructions',
  'Register private photo reference',
  "action:'property_site_save'",
  "action:'property_zone_save'",
  "action:'property_photo_register'"
]) assert.ok(ui.includes(token), `Operations UI missing ${token}`);

assert.ok(ui.includes('Property hazard notes are field context, not a replacement for Safety assessments.'));
assert.ok(ui.includes('Build 323 does not publish property photos.'));
assert.ok(boundaries.includes("property_site_save: contract('property_site_save', 'jobs', 'approve', 'write', 'property_site', 'jobs.property_site.saved')"));
assert.ok(boundaries.includes("property_zone_save: contract('property_zone_save', 'jobs', 'approve', 'write', 'property_site', 'jobs.property_site.zone_saved')"));
assert.ok(boundaries.includes("property_photo_register: contract('property_photo_register', 'jobs', 'approve', 'write', 'property_site', 'jobs.property_site.photo_registered')"));
assert.ok(core.includes("customer_site:") && core.includes("service_address,city,province,postal_code,approximate_serviceable_area,area_unit"));
assert.equal(pkg.scripts['test:property-site-intelligence'],'node scripts/property-site-intelligence-check.mjs');
assert.equal(pkg.scripts['test:browser:property-site-intelligence'],'playwright test --config=playwright.config.mjs tests/browser/property-site-intelligence.spec.mjs');
assert.ok(workflow.includes('npm run test:property-site-intelligence'));
assert.ok(workflow.includes('npm run test:browser:property-site-intelligence'));
assert.ok(help.includes('Build 323') && help.includes('Property &amp; Site Intelligence'));
assert.ok(roadmap.includes('324 — Estimate → Job → Invoice Workflow'));

try { new Function(ui); }
catch(error) { assert.fail(`Operations UI JavaScript syntax failed: ${error}`); }

const require=createRequire(import.meta.url);
const ts=require('typescript');
for(const [file,content] of [
  ['supabase/functions/operations-manage/index.ts',operations],
  ['supabase/functions/_shared/module-write-boundaries.ts',boundaries],
  ['supabase/functions/_shared/core-data-read-models.ts',core]
]){
  const output=ts.transpileModule(content,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:file});
  const errors=(output.diagnostics||[]).filter((d)=>d.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,errors.map((d)=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join(' | '));
}

console.log('Build 323 Property & Site Intelligence source gate: PASS');

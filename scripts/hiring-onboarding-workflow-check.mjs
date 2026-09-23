import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(f)=>fs.readFileSync(path.join(root,f),'utf8');
const migration=read('sql/227_hiring_onboarding_workflow.sql');
const directory=read('supabase/functions/admin-directory/index.ts');
const manage=read('supabase/functions/hiring-manage/index.ts');
const api=read('js/api.js');
const ui=read('js/admin-hiring-onboarding-ui.js');
const hub=read('js/admin-hub-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const must=(source,tokens,label)=>tokens.forEach((token)=>assert.ok(source.includes(token),label+': missing '+token));

must(migration,[
  'Schema 227 — Build 339 Hiring & Onboarding Workflow',
  'create table if not exists public.workforce_hiring_candidates',
  'create table if not exists public.workforce_candidate_onboarding_items',
  'create table if not exists public.workforce_candidate_stage_events',
  'create or replace view public.v_workforce_hiring_onboarding_overview',
  'public.v_training_certification_matrix',
  'public.crew_members',
  'SPRING_SUMMER_LANDSCAPING_ORIENTATION',
  'FALL_CLEANUP_ORIENTATION',
  'WINTER_SNOW_OPERATIONS_ORIENTATION',
  '227 as expected_schema_version',
  'enable row level security'
],'Schema 227');
assert.ok(!/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(?:profiles|crews|crew_members|training_records|training_requirement_assignments|training_internal_authorization_reviews)\b/i.test(migration),'Build 339 must not recreate canonical workforce/training/crew authorities.');

must(directory,[
  "['module_permissions','workforce','timekeeping','performance','onboarding'].includes(key)",
  "scope === 'onboarding'",
  'v_workforce_hiring_onboarding_overview',
  'workforce_candidate_onboarding_items',
  "seasonal_boundary:'YW is a four-season Ontario operation"
],'Onboarding read boundary');
must(manage,[
  "entity==='hiring_candidate'",
  "entity==='hiring_onboarding_item'",
  "WINTER_SNOW_OPERATIONS_ORIENTATION",
  "SPRING_SUMMER_LANDSCAPING_ORIENTATION",
  "FALL_CLEANUP_ORIENTATION",
  "hasModuleAccess(supabase,actorProfile,'admin','manage')",
  "Pre-field readiness is incomplete"
],'Onboarding write boundary');
must(api,["startsWith('hiring_')","'hiring-manage'"],'API hiring route');
must(ui,[
  'Build 339 — Hiring & Onboarding Workflow',
  'Four-season Ontario operating model',
  'winter snow clearing/removal',
  "scope:'onboarding'",
  "entity:'hiring_candidate'",
  "entity:'hiring_onboarding_item'"
],'Build 339 workbench');
must(hub,[
  'loadBuild339HiringOnboarding',
  '/js/admin-hiring-onboarding-ui.js?v=2026-09-22b339',
  "if (key === 'people') { loadBuild336Workforce(); loadBuild337Timekeeping(); loadBuild338PerformanceDevelopment(); loadBuild339HiringOnboarding(); }"
],'Build 339 lazy loading');
must(help,[
  'Build 339 — Hiring &amp; Onboarding Workflow',
  'four-season Ontario company',
  'snow clearing and snow removal',
  'pre-field ready'
],'Build 339 Help');
must(roadmap,[
  '#### **339 — Hiring & Onboarding Workflow** is implemented',
  '### Four-season Ontario operating model',
  'winter snow clearing/removal',
  '#### 340 — Customer & Property CRM'
],'Build 339 roadmap');
must(pkg,['test:hiring-onboarding-workflow','test:browser:hiring-onboarding-workflow'],'Build 339 package scripts');
must(workflow,['npm run test:hiring-onboarding-workflow','npm run test:browser:hiring-onboarding-workflow'],'Build 339 CI wiring');

console.log('Build 339 Hiring & Onboarding Workflow source contract: GREEN');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('sql/224_employee_crew_management.sql');
const directory=read('supabase/functions/admin-directory/index.ts');
const manage=read('supabase/functions/admin-manage/index.ts');
const ui=read('js/admin-workforce-ui.js');
const hub=read('js/admin-hub-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');

const must=(source,tokens,label)=>tokens.forEach((token)=>assert.ok(source.includes(token),label+': missing '+token));

must(migration,[
  'Schema 224 — Build 336 Employee & Crew Management',
  'alter table public.profiles',
  'workforce_availability_status',
  'seasonal_status',
  'workforce_active_from',
  'workforce_active_until',
  'create table if not exists public.workforce_skills',
  'create table if not exists public.workforce_profile_skills',
  'create table if not exists public.workforce_availability_windows',
  'create or replace view public.v_workforce_employee_directory',
  'create or replace view public.v_workforce_crew_directory',
  'create or replace view public.v_workforce_summary',
  'public.v_training_certification_matrix',
  'with (security_invoker=true)',
  'enable row level security',
  '224 as expected_schema_version'
],'Schema 224');

assert.ok(!/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(?:profiles|crews|crew_members|training_records|training_requirement_assignments|training_internal_authorization_reviews)\b/i.test(migration),'Build 336 must extend, not recreate, canonical employee/crew/training authorities.');
const workforceView=migration.slice(migration.indexOf('create or replace view public.v_workforce_employee_directory'),migration.indexOf('create or replace view public.v_workforce_crew_directory'));
for(const sensitive of ['address_line1','address_line2','emergency_contact_name','emergency_contact_phone']) assert.ok(!workforceView.includes(sensitive),'Operational workforce view must omit '+sensitive);

must(directory,[
  "['module_permissions','workforce'].includes(key)",
  "scope === 'workforce'",
  'v_workforce_employee_directory',
  'v_workforce_crew_directory',
  'workforce_private_contacts',
  'v_training_certification_matrix',
  "privacy_boundary:'Home address and emergency-contact fields are returned only by this Admin-manage workforce scope."
],'Admin workforce read boundary');

must(manage,[
  "'workforce_profile'",
  "'workforce_skill'",
  "'workforce_profile_skill'",
  "'workforce_availability'",
  "'workforce_crew'",
  "event_type:'workforce_profile_updated'",
  "event_type:'workforce_crew_updated'",
  "membership_status:'ended'"
],'Admin workforce write boundary');

must(ui,[
  'Build 336 — Employee & Crew Management',
  'Privacy boundary:',
  "entity:'workforce_profile'",
  "entity:'workforce_profile_skill'",
  "entity:'workforce_availability'",
  "entity:'workforce_crew'",
  'Build 330 remains the training and internal-authorization authority'
],'Build 336 workbench');

must(hub,[
  'loadBuild336Workforce',
  '/js/admin-workforce-ui.js?v=2026-09-22b336',
  "if (key === 'people') loadBuild336Workforce();"
],'Build 336 lazy loading');

must(help,[
  'Build 336 — Employee &amp; Crew Management',
  'privacy-aware',
  'Build 330',
  'does not grant equipment or legal authorization'
],'Build 336 Help');
must(roadmap,['#### **336 — Employee & Crew Management** is implemented','#### 337 — Timekeeping, Attendance & Payroll Evidence'],'Build 336 roadmap');
must(pkg,['test:employee-crew-management','test:browser:employee-crew-management'],'Build 336 package scripts');
must(workflow,['npm run test:employee-crew-management','npm run test:browser:employee-crew-management'],'Build 336 CI wiring');

console.log('Build 336 Employee & Crew Management source contract: GREEN');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('sql/225_timekeeping_attendance_payroll_evidence.sql');
const directory=read('supabase/functions/admin-directory/index.ts');
const manage=read('supabase/functions/admin-manage/index.ts');
const ui=read('js/admin-timekeeping-ui.js');
const profile=read('js/profile-ui.js');
const account=read('supabase/functions/account-maintenance/index.ts');
const hub=read('js/admin-hub-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');

const must=(source,tokens,label)=>tokens.forEach((token)=>assert.ok(source.includes(token),label+': missing '+token));

must(migration,[
  'Schema 225 — Build 337 Timekeeping, Attendance & Payroll Evidence',
  'alter table public.employee_time_entries',
  'travel_minutes',
  'employee_explanation',
  'supervisor_approval_status',
  'create table if not exists public.employee_time_corrections',
  'before_snapshot jsonb',
  'after_snapshot jsonb',
  'create or replace view public.v_timekeeping_payroll_evidence',
  'create or replace view public.v_timekeeping_correction_audit',
  'create or replace view public.v_timekeeping_attendance_summary',
  'public.job_session_crew_hours',
  'public.v_employee_time_review_queue',
  'with (security_invoker=true)',
  'enable row level security',
  '225 as expected_schema_version'
],'Schema 225');

assert.ok(!/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(?:employee_time_entries|employee_time_entry_breaks|job_session_crew_hours|payroll_export_runs)\b/i.test(migration),'Build 337 must extend, not recreate, canonical time/payroll authorities.');

must(directory,[
  "['module_permissions','workforce','timekeeping'].includes(key)",
  "scope === 'timekeeping'",
  'v_timekeeping_payroll_evidence',
  'v_timekeeping_correction_audit',
  'v_timekeeping_attendance_summary',
  "authority_boundary:'Payroll provider export, delivery and close controls remain in Finance.'"
],'Timekeeping read boundary');

must(manage,[
  "'timekeeping_correction'",
  "'timekeeping_approval'",
  "entity === 'timekeeping_correction'",
  "entity === 'timekeeping_approval'",
  "correction_status:'approved'",
  'correction_version',
  'Pending correction requests must be resolved before payroll evidence approval.'
],'Timekeeping write boundary');

must(profile,[
  "timeTravelMinutes: $('#me_time_travel_minutes')",
  'Travel Minutes<input id="me_time_travel_minutes"',
  "if (action === 'employee_clock_out') payload.travel_minutes"
],'Employee travel capture');

must(account,[
  'const requestedTravelMinutes = Math.max(0, Math.round(Number(body.travel_minutes || 0)))',
  'travel_minutes: travelMinutes',
  'travel_minutes: travelMinutes, crew_hours_id'
],'Travel-time persistence');

must(ui,[
  'Build 337 — Timekeeping, Attendance & Payroll Evidence',
  'Authority boundary:',
  "entity:'timekeeping_correction'",
  "entity:'timekeeping_approval'",
  'Download Ready CSV',
  'Finance keeps payroll-export generation, delivery and close controls'
],'Build 337 workbench');

must(hub,[
  'loadBuild337Timekeeping',
  '/js/admin-timekeeping-ui.js?v=2026-09-22b337',
  "if (key === 'people') { loadBuild336Workforce(); loadBuild337Timekeeping(); }"
],'Build 337 lazy loading');

must(help,[
  'Build 337 — Timekeeping, Attendance &amp; Payroll Evidence',
  'Travel time',
  'correction audit',
  'Finance payroll-export'
],'Build 337 Help');
must(roadmap,['#### **337 — Timekeeping, Attendance & Payroll Evidence** is implemented','#### 338 — Performance & Development'],'Build 337 roadmap');
must(pkg,['test:timekeeping-attendance-payroll-evidence','test:browser:timekeeping-attendance-payroll-evidence'],'Build 337 package scripts');
must(workflow,['npm run test:timekeeping-attendance-payroll-evidence','npm run test:browser:timekeeping-attendance-payroll-evidence'],'Build 337 CI wiring');

console.log('Build 337 Timekeeping, Attendance & Payroll Evidence source contract: GREEN');

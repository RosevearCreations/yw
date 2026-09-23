import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('sql/226_performance_development.sql');
const directory=read('supabase/functions/admin-directory/index.ts');
const manage=read('supabase/functions/performance-manage/index.ts');
const api=read('js/api.js');
const ui=read('js/admin-performance-development-ui.js');
const hub=read('js/admin-hub-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');

const must=(source,tokens,label)=>tokens.forEach((token)=>assert.ok(source.includes(token),label+': missing '+token));

must(migration,[
  'Schema 226 — Build 338 Performance & Development',
  'public.workforce_role_expectations',
  'public.workforce_coaching_records',
  'public.workforce_development_plans',
  'public.workforce_performance_reviews',
  'public.workforce_improvement_actions',
  'public.v_workforce_attendance_patterns',
  'public.v_workforce_performance_development_overview',
  'public.v_timekeeping_payroll_evidence',
  'with (security_invoker=true)',
  'enable row level security',
  '226 as expected_schema_version'
],'Schema 226');

assert.ok(!/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(?:profiles|employee_time_entries|training_assignments|hse_incidents|incident_reports)\b/i.test(migration),
  'Build 338 must extend, not recreate, canonical workforce/timekeeping/training/Safety authorities.');
assert.ok(!/join\s+public\.[a-z0-9_]*(?:incident|near_miss)/i.test(migration),
  'Build 338 performance views must not join Safety incident or near-miss truth.');

must(directory,[
  "['module_permissions','workforce','timekeeping','performance','onboarding'].includes(key)",
  "scope === 'performance'",
  'v_workforce_performance_development_overview',
  'v_workforce_attendance_patterns',
  "safety_boundary:'Safety incident and near-miss truth is intentionally not returned by this performance scope.'"
],'Performance read boundary');

must(manage,[
  "'performance_expectation'",
  "'performance_coaching'",
  "'performance_development_plan'",
  "'performance_review'",
  "'performance_improvement_action'",
  "hasModuleAccess(supabase,actorProfile,'admin','manage')"
],'Performance write boundary');

must(api,[
  "startsWith('performance_')",
  "'performance-manage'",
  "specializedFunction"
],'Performance API routing');

must(ui,[
  'Build 338 — Performance & Development',
  'Safety boundary:',
  "entity:'performance_coaching'",
  "entity:'performance_development_plan'",
  "entity:'performance_review'",
  "entity:'performance_improvement_action'",
  'Attendance reviews (90d)'
],'Build 338 workbench');

must(hub,[
  'loadBuild338PerformanceDevelopment',
  '/js/admin-performance-development-ui.js?v=2026-09-22b338',
  "if (key === 'people') { loadBuild336Workforce(); loadBuild337Timekeeping(); loadBuild338PerformanceDevelopment(); loadBuild339HiringOnboarding(); }"
],'Build 338 lazy loading');

must(help,[
  'Build 338 — Performance &amp; Development',
  'role expectations',
  'coaching and recognition',
  'Safety incident and near-miss truth remains separate'
],'Build 338 Help');
must(roadmap,['#### **338 — Performance & Development** is implemented','#### **339 — Hiring & Onboarding Workflow** is implemented','#### **340 — Customer & Property CRM** is implemented'],'Build 338 roadmap');
must(pkg,['test:performance-development','test:browser:performance-development'],'Build 338 package scripts');
must(workflow,['npm run test:performance-development','npm run test:browser:performance-development'],'Build 338 CI wiring');

console.log('Build 338 Performance & Development source contract: GREEN');

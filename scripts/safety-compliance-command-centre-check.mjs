import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(path)=>fs.readFileSync(path,'utf8');
const selector=read('supabase/functions/admin-selectors/index.ts');
const hse=read('js/hse-ops-ui.js');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');

const must=(source, needles, label)=>needles.forEach((needle)=>assert.ok(source.includes(needle), label + ': missing ' + needle));

must(selector,[
  "if (scope === 'hse_ops')",
  "hasModuleAccess(supabase, actorProfile, 'admin', 'view')",
  "roleRank(actorRole) < roleRank('supervisor')",
  "'v_incident_near_miss_history'",
  "'v_corrective_action_task_directory'",
  "'v_training_record_directory'",
  "'v_training_expiry_summary'",
  "'v_supervisor_safety_queue'",
  "'v_site_safety_scorecards'",
  "'v_equipment_jsa_hazard_link_directory'",
  "'equipment_items'",
  "'submissions'",
  "'client_sites'",
  'incident_near_miss_history: incidentNearMissHistory',
  'corrective_action_tasks: correctiveActionTasks',
  'training_records: trainingRecords',
  'equipment_lockouts: equipmentLockouts',
  'safety_submissions: safetySubmissions',
  'client_site_hazards: clientSiteHazards'
],'Build 327 HSE selector');

must(hse,[
  'const SAFETY_COMMAND_CENTRE_BUILD = 327',
  'deriveSafetyCommandCentre',
  'Safety &amp; Compliance Command Centre',
  "key:'open_hazards'",
  "key:'required_assessments'",
  "key:'toolbox_talks'",
  "key:'incidents'",
  "key:'corrective_actions'",
  "key:'training_expiries'",
  "key:'ppe_issues'",
  "key:'equipment_lockouts'",
  "key:'site_hazards'",
  "key:'supervisor_signoff'",
  "key:'overdue_actions'",
  'does not by itself establish legal or regulatory compliance',
  'data-safety-metric',
  'Priority safety queue'
],'Build 327 Safety UI');

assert.ok(!selector.includes('subtotal,total_amount,total_cost'), 'Build 327 HSE selector must not expose Finance totals.');
const commandCentreStart=hse.indexOf('function safetyCommandCentreMarkup');
const commandCentreEnd=hse.indexOf('function normalizeSummary',commandCentreStart);
const commandCentreSource=hse.slice(commandCentreStart,commandCentreEnd);
assert.ok(commandCentreStart>=0 && commandCentreEnd>commandCentreStart);
assert.ok(!commandCentreSource.includes('manageOperations('), 'Build 327 command centre itself must remain read-only even when later Safety builds add separate workflows.');

must(help,['Safety &amp; Compliance Command Centre','Build 327','not a legal-compliance certificate'],'Build 327 Help');
must(roadmap,['327 — Safety & Compliance Command Centre','328 — Job Hazard & Site Safety Plans'],'Build 327 roadmap history');
must(pkg,['test:safety-compliance-command-centre','test:browser:safety-compliance-command-centre'],'Build 327 package scripts');
must(workflow,['npm run test:safety-compliance-command-centre','npm run test:browser:safety-compliance-command-centre'],'Build 327 CI wiring');

console.log('Build 327 Safety & Compliance Command Centre source gate GREEN');

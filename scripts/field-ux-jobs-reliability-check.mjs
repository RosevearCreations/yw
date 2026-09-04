import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const today = read('js/mobile-today.js');
const pkg = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/staging-browser-integration.yml');
const help = read('help.html');

const checks = [
  ['Today exposes sync health', /fieldSyncHealth/.test(today) && /getActionSummary/.test(today)],
  ['Conflicts are explicit and never auto-resolved', /Review conflict/i.test(today) && !/resolveActionConflict\s*\(/.test(today)],
  ['Desktop Jobs workbench exists', /jobsDesktopWorkbench/.test(today) && /job-workbench-search/.test(today) && /job-workbench-status/.test(today)],
  ['Desktop filtering is presentation-only', /applyJobsWorkbenchFilter/.test(today) && /row\.hidden/.test(today)],
  ['Phone Today retains Jobs as a field action', /mobileTodayGrid/.test(today) && /Open Jobs/.test(today)],
  ['Source gate is wired', pkg.scripts?.['test:field-ux']?.includes('field-ux-jobs-reliability-check.mjs') && /test:field-ux/.test(workflow)],
  ['Rendered acceptance is wired', pkg.scripts?.['test:browser:field-ux']?.includes('field-ux-jobs-reliability.spec.mjs') && /test:browser:field-ux/.test(workflow)],
  ['Operator Help documents the new workflow', /Desktop Jobs workbench/.test(help) && /Review conflicts before retrying/.test(help)]
];

for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
console.log(`Build 204 field UX / Jobs reliability authority: ${checks.length}/${checks.length} PASS`);

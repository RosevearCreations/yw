import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const workflowDir = path.join(repoRoot, '.github', 'workflows');

function workflowFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

const files = workflowFiles(workflowDir);
const violations = [];
let checkoutUses = 0;
let setupNodeUses = 0;

for (const file of files) {
  const rel = path.relative(repoRoot, file).replaceAll(path.sep, '/');
  const source = fs.readFileSync(file, 'utf8');

  for (const match of source.matchAll(/actions\/checkout@v(\d+)/g)) {
    checkoutUses += 1;
    const major = Number(match[1]);
    if (!Number.isInteger(major) || major < 7) {
      violations.push(`${rel}: actions/checkout@v${match[1]} is below the supported v7 baseline.`);
    }
  }

  for (const match of source.matchAll(/actions\/setup-node@v(\d+)/g)) {
    setupNodeUses += 1;
    const major = Number(match[1]);
    if (!Number.isInteger(major) || major < 7) {
      violations.push(`${rel}: actions/setup-node@v${match[1]} is below the supported v7 baseline.`);
    }
  }

  if (/node-version:\s*['"]?20(?:\.[^'"\s]+)?['"]?/i.test(source)) {
    violations.push(`${rel}: Node 20 is deprecated for YWI workflows; use Node 22 or newer.`);
  }
}

if (checkoutUses === 0) {
  violations.push('No actions/checkout usage was found; workflow runtime coverage is incomplete.');
}
if (setupNodeUses === 0) {
  violations.push('No actions/setup-node usage was found; workflow runtime coverage is incomplete.');
}

if (violations.length > 0) {
  console.error('GITHUB ACTIONS RUNTIME CONTRACT: FAILED');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      workflow_files_scanned: files.length,
      checkout_uses: checkoutUses,
      setup_node_uses: setupNodeUses,
      minimum_checkout_major: 7,
      minimum_setup_node_major: 7,
      minimum_ywi_node_major: 22,
    },
    null,
    2,
  ),
);
console.log('GITHUB ACTIONS RUNTIME CONTRACT: GREEN');

#!/usr/bin/env node
/** Schema 164 executable contract proof for fail-closed action ownership. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const source = fs.readFileSync(path.join(process.cwd(), 'supabase/functions/_shared/module-write-boundaries.ts'), 'utf8');
const require = createRequire(import.meta.url);
const ts = require('typescript');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true,
  },
  reportDiagnostics: true,
  fileName: 'supabase/functions/_shared/module-write-boundaries.ts'
});
const errors = (transpiled.diagnostics || []).filter((diag) => diag.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((diag) => ts.flattenDiagnosticMessageText(diag.messageText, '\n')).join(' | '));

const module = { exports: {} };
const sandbox = {
  module,
  exports: module.exports,
  require() { throw new Error('Schema 164 boundary helper must not have runtime imports.'); },
  Object,
  String,
  Array,
  Set,
  Map,
  console,
};
vm.createContext(sandbox);
vm.runInContext(transpiled.outputText, sandbox, { filename: 'module-write-boundaries.js' });

const {
  MODULE_WRITE_ACTIONS,
  MODULE_WRITE_BOUNDARIES,
  resolveModuleWriteBoundary,
  boundaryAuditFields,
} = module.exports;

assert.equal(Array.from(MODULE_WRITE_ACTIONS).length, 35, 'Exactly 35 operations actions must be contracted.');
assert.equal(Object.keys(MODULE_WRITE_BOUNDARIES).length, 35);

const financeCreate = resolveModuleWriteBoundary('payment_action_request');
assert.equal(financeCreate.ownerModule, 'finance');
assert.equal(financeCreate.minimum, 'create');
assert.equal(financeCreate.mode, 'write');

const financeRead = resolveModuleWriteBoundary('reconciliation_suggest');
assert.equal(financeRead.ownerModule, 'finance');
assert.equal(financeRead.minimum, 'view');
assert.equal(financeRead.mode, 'read');
assert.equal(financeRead.eventKey, null);

const jobsWrite = resolveModuleWriteBoundary('work_order_execution_proof_submit');
assert.equal(jobsWrite.ownerModule, 'jobs');
assert.equal(jobsWrite.minimum, 'create');
assert.equal(jobsWrite.mode, 'write');
assert.equal(jobsWrite.crossModule, true);
assert.equal(jobsWrite.eventKey, 'jobs.execution_proof.submitted');

const adminWrite = resolveModuleWriteBoundary('public_route_publish');
assert.equal(adminWrite.ownerModule, 'admin');
assert.equal(adminWrite.minimum, 'manage');
assert.equal(adminWrite.mode, 'write');

const disabled = resolveModuleWriteBoundary('deposit_status_update');
assert.equal(disabled.ownerModule, 'finance');
assert.equal(disabled.minimum, 'manage');
assert.equal(disabled.mode, 'disabled');

assert.equal(resolveModuleWriteBoundary('not_a_real_action'), null, 'Unknown actions must resolve to null, never Admin/manage.');
assert.equal(resolveModuleWriteBoundary(''), null);
assert.equal(resolveModuleWriteBoundary(null), null);

const audit = boundaryAuditFields(jobsWrite);
assert.deepEqual({ ...audit }, {
  boundary_owner_module: 'jobs',
  boundary_minimum_access: 'create',
  boundary_mode: 'write',
  boundary_event_key: 'jobs.execution_proof.submitted',
  cross_module_event: true,
});

const unknownAudit = boundaryAuditFields(null);
assert.deepEqual({ ...unknownAudit }, {
  boundary_owner_module: null,
  boundary_minimum_access: null,
  boundary_mode: null,
  boundary_event_key: null,
  cross_module_event: false,
});

for (const action of Array.from(MODULE_WRITE_ACTIONS)) {
  const boundary = resolveModuleWriteBoundary(action);
  assert.ok(boundary, `Contract should resolve: ${action}`);
  assert.equal(boundary.action, action, `Contract key/action must agree: ${action}`);
  assert.ok(['safety','finance','jobs','admin'].includes(boundary.ownerModule));
  assert.ok(['view','create','approve','manage'].includes(boundary.minimum));
  assert.ok(['read','write','disabled'].includes(boundary.mode));
  if (boundary.crossModule) assert.ok(boundary.eventKey, `Cross-module contract needs event key: ${action}`);
}

console.log('PASS boundary-exact-35-actions');
console.log('PASS boundary-finance-read-write-ownership');
console.log('PASS boundary-jobs-cross-module-event');
console.log('PASS boundary-admin-write-ownership');
console.log('PASS boundary-disabled-payment-mutation');
console.log('PASS boundary-unknown-action-fails-closed');
console.log('PASS boundary-audit-metadata');
console.log('PASS boundary-all-contracts-valid');
console.log('\nSchema 164 module write-boundary behavior gate passed: 8/8 checks.');

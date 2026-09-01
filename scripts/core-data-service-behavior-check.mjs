#!/usr/bin/env node
/** Schema 163 browser behavior gate: denied reads never transport; cache is profile/module scoped and invalidated safely. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source = fs.readFileSync(path.join(process.cwd(), 'js/core-data-service.js'), 'utf8');

class TestCustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
}

let authState = {
  isAuthenticated: true,
  pendingAuthResolution: false,
  needsAccountSetup: false,
  isLoggingOut: false,
  role: 'employee',
  profile: { id: 'profile-a', role: 'employee' },
  user: { id: 'profile-a' }
};
const grants = { safety: false, finance: false, jobs: false, admin: false };
const listeners = new Map();
const events = [];
const apiCalls = [];

const document = {
  addEventListener(type, handler) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(handler);
  },
  dispatchEvent(event) {
    events.push(event);
    for (const handler of listeners.get(event.type) || []) handler(event);
    return true;
  }
};

const window = {
  YWI_AUTH: { getState: () => authState },
  YWISecurity: { canViewModule: (moduleKey) => grants[moduleKey] === true },
  YWIAPI: {
    async jsonFetch(endpoint, options) {
      apiCalls.push({ endpoint, options });
      const entities = Array.from(options?.body?.entities || []);
      return {
        ok: true,
        build: '2026-09-01e',
        schema: 163,
        contract_version: 1,
        module_key: options?.body?.module_key,
        read_only: true,
        data: Object.fromEntries(entities.map((key) => [key, [{ id: `${key}-1` }]]))
      };
    }
  }
};

const sandbox = {
  window,
  document,
  CustomEvent: TestCustomEvent,
  Error,
  Promise,
  Map,
  Set,
  Object,
  Array,
  String,
  Number,
  Math,
  Date,
  console
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'js/core-data-service.js' });

const core = window.YWICoreData;
assert.ok(core, 'YWICoreData should be exposed.');
assert.equal(core.BUILD, '2026-09-01e');
assert.equal(core.CONTRACT_VERSION, 1);
assert.deepEqual(Array.from(core.ENTITY_KEYS), ['profile','customer','customer_site','job','equipment','customer_asset','service_document']);

await assert.rejects(
  () => core.read({ moduleKey: 'finance', entities: ['customer'] }),
  (error) => error?.code === 'MODULE_ACCESS_DENIED' && error?.status === 403,
  'Denied module Core read should fail locally.'
);
assert.equal(apiCalls.length, 0, 'Denied module read must not call core-data-read.');

grants.finance = true;
const first = await core.read({ moduleKey: 'finance', entities: ['customer','job'], limit: 50 });
assert.equal(apiCalls.length, 1, 'First allowed read should call transport once.');
assert.equal(apiCalls[0].endpoint, 'core-data-read');
assert.equal(apiCalls[0].options.body.module_key, 'finance');
assert.deepEqual(Array.from(apiCalls[0].options.body.entities), ['customer','job']);
assert.equal(first.read_only, true);
assert.equal(first.data.customer.length, 1);

const cached = await core.read({ moduleKey: 'finance', entities: ['job','customer'], limit: 50 });
assert.equal(apiCalls.length, 1, 'Equivalent entity set should reuse profile+module cache regardless of input order.');
assert.equal(cached.data.job[0].id, 'job-1');

await core.read({ moduleKey: 'finance', entities: ['customer','job'], limit: 50, force: true });
assert.equal(apiCalls.length, 2, 'Forced read should bypass the cache.');

const beforeIdentityChange = core.getState();
assert.equal(beforeIdentityChange.cacheEntries, 1);
authState = {
  ...authState,
  profile: { id: 'profile-b', role: 'employee' },
  user: { id: 'profile-b' }
};
document.dispatchEvent(new TestCustomEvent('ywi:auth-changed', { detail: { state: authState } }));
assert.equal(core.getState().cacheEntries, 0, 'Profile identity change must invalidate cached Core rows.');
assert.ok(events.some((event) => event.type === 'ywi:core-data-invalidated' && event.detail?.reason === 'profile-changed'));

await core.read({ moduleKey: 'finance', entities: ['customer'], limit: 50 });
assert.equal(apiCalls.length, 3, 'New profile should perform a new Core read.');

document.dispatchEvent(new TestCustomEvent('ywi:module-permissions-changed', { detail: {} }));
assert.equal(core.getState().cacheEntries, 0, 'Permission changes must invalidate cached Core rows.');
assert.ok(events.some((event) => event.type === 'ywi:core-data-invalidated' && event.detail?.reason === 'module-permissions-changed'));

authState = { ...authState, isAuthenticated: false };
document.dispatchEvent(new TestCustomEvent('ywi:auth-changed', { detail: { state: authState } }));
await assert.rejects(() => core.read({ moduleKey: 'finance', entities: ['customer'] }), (error) => error?.code === 'MODULE_ACCESS_DENIED');
assert.equal(apiCalls.length, 3, 'Signed-out reads must not transport.');

console.log('PASS core-data-denied-read-no-transport');
console.log('PASS core-data-allowed-read-bounded-transport');
console.log('PASS core-data-profile-module-cache');
console.log('PASS core-data-force-refresh');
console.log('PASS core-data-profile-change-invalidation');
console.log('PASS core-data-permission-change-invalidation');
console.log('PASS core-data-signout-no-transport');
console.log('\nSchema 163 Core data behavior gate passed: 7/7 checks.');

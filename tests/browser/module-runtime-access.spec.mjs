import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const runtimeSource = fs.readFileSync(path.join(process.cwd(), 'js/module-runtime.js'), 'utf8');

const moduleScripts = Object.freeze({
  safety: [
    '/js/hse-ops-ui.js',
    '/js/logbook-ui.js',
    '/js/reports-ui.js',
    '/js/forms-toolbox.js',
    '/js/forms-ppe.js',
    '/js/forms-firstaid.js',
    '/js/forms-incident.js',
    '/js/forms-inspection.js',
    '/js/forms-drill.js'
  ],
  finance: ['/js/finance-ui.js'],
  jobs: ['/js/jobs-ui.js', '/js/jobs-finance-boundary.js'],
  admin: [
    '/js/admin-actions.js',
    '/js/admin-ui.js',
    '/js/operations-cockpit.js',
    '/js/module-access-ui.js',
    '/js/it-readiness-ui.js'
  ]
});

const scenarios = [
  { key: 'anonymous', authenticated: false, allowed: [] },
  { key: 'safety_only', authenticated: true, allowed: ['safety'] },
  { key: 'finance_only', authenticated: true, allowed: ['finance'] },
  { key: 'jobs_only', authenticated: true, allowed: ['jobs'] },
  { key: 'admin_only', authenticated: true, allowed: ['admin'] },
  { key: 'safety_jobs', authenticated: true, allowed: ['safety', 'jobs'] },
  { key: 'finance_admin', authenticated: true, allowed: ['finance', 'admin'] },
  { key: 'full_admin', authenticated: true, allowed: ['safety', 'finance', 'jobs', 'admin'] }
];

const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 960 }
];

const canonicalCore = {
  profile: 'profiles',
  customer: 'clients',
  customer_site: 'client_sites',
  job: 'jobs',
  equipment: 'equipment_master',
  customer_asset: 'customer_assets',
  service_document: 'service_contract_documents'
};

function expectedScripts(allowed) {
  return allowed.flatMap((moduleKey) => moduleScripts[moduleKey]);
}

async function mountRuntime(page, scenario) {
  const requested = [];
  await page.route('https://runtime.test/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/js/')) {
      requested.push(url.pathname);
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `window.__ywiLoadedScripts = window.__ywiLoadedScripts || []; window.__ywiLoadedScripts.push(${JSON.stringify(url.pathname)});`
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><head><meta charset="utf-8"></head><body><main id="app-shell">YWI test shell</main></body></html>'
    });
  });

  await page.goto('https://runtime.test/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ allowed, authenticated }) => {
    window.__ywiGrants = Object.fromEntries(['safety', 'finance', 'jobs', 'admin'].map((key) => [key, allowed.includes(key)]));
    window.__ywiAuthState = {
      isAuthenticated: authenticated,
      pendingAuthResolution: false,
      needsAccountSetup: false,
      role: allowed.length === 4 ? 'admin' : 'employee',
      profile: authenticated ? { id: 'profile-acceptance' } : null,
      user: authenticated ? { id: 'user-acceptance' } : null
    };
    window.YWI_AUTH = { getState: () => window.__ywiAuthState };
    window.YWISecurity = { canViewModule: (moduleKey) => window.__ywiGrants[moduleKey] === true };
    window.initFormModules = () => {};
    window.initProtectedModules = () => {};
    window.seedAllTables = () => {};
    window.YWIModuleNav = { sync() {} };
  }, scenario);
  await page.addScriptTag({ content: runtimeSource });
  await page.evaluate(() => window.YWIModuleRuntime.syncForCurrentAccess());
  return requested;
}

for (const viewport of viewports) {
  for (const scenario of scenarios) {
    test(`${scenario.key} requests exactly its permitted bundles on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const requested = await mountRuntime(page, scenario);
      const state = await page.evaluate(() => window.YWIModuleRuntime.getRuntimeState());
      const manifestKeys = await page.evaluate(() => Object.keys(window.YWIModuleRuntime.getManifest()));
      const coreRelations = await page.evaluate(() => Object.fromEntries(
        Object.entries(window.YWIModuleRuntime.getCoreContract()).map(([key, value]) => [key, value.relation])
      ));

      expect(state.loadedModules).toEqual(scenario.allowed);
      expect(requested).toEqual(expectedScripts(scenario.allowed));
      expect(manifestKeys).toEqual(['safety', 'finance', 'jobs', 'admin']);
      expect(manifestKeys).not.toContain('it');
      expect(coreRelations).toEqual(canonicalCore);

      for (const denied of ['safety', 'finance', 'jobs', 'admin'].filter((key) => !scenario.allowed.includes(key))) {
        for (const deniedScript of moduleScripts[denied]) expect(requested).not.toContain(deniedScript);
      }

      if (scenario.allowed.includes('admin')) {
        expect(requested).toContain('/js/it-readiness-ui.js');
      } else {
        expect(requested).not.toContain('/js/it-readiness-ui.js');
      }

      if (scenario.allowed.includes('jobs')) {
        expect(requested).toContain('/js/jobs-finance-boundary.js');
      } else {
        expect(requested).not.toContain('/js/jobs-finance-boundary.js');
      }
    });
  }
}

test('permission downgrade emits purge before stale Finance code can persist', async ({ page }) => {
  const scenario = { authenticated: true, allowed: ['finance'] };
  await mountRuntime(page, scenario);

  let purgeReason = null;
  await page.exposeFunction('recordYwiPurge', (reason) => { purgeReason = reason; });
  await page.evaluate(() => {
    document.addEventListener('ywi:module-runtime-purge', (event) => window.recordYwiPurge(event.detail?.reason || null), { once: true });
    window.__ywiGrants.finance = false;
  });

  await page.evaluate(() => window.YWIModuleRuntime.syncForCurrentAccess()).catch(() => {});
  await expect.poll(() => purgeReason).toBe('permission_removed:finance');
});

test('sign-out emits purge before stale Jobs code can persist', async ({ page }) => {
  const scenario = { authenticated: true, allowed: ['jobs'] };
  await mountRuntime(page, scenario);

  let purgeReason = null;
  await page.exposeFunction('recordYwiPurge', (reason) => { purgeReason = reason; });
  await page.evaluate(() => {
    document.addEventListener('ywi:module-runtime-purge', (event) => window.recordYwiPurge(event.detail?.reason || null), { once: true });
    window.__ywiAuthState = { ...window.__ywiAuthState, isAuthenticated: false };
  });

  await page.evaluate(() => window.YWIModuleRuntime.syncForCurrentAccess()).catch(() => {});
  await expect.poll(() => purgeReason).toBe('signed_out');
});
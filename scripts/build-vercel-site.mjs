import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
const marker = '.ywi-vercel-static-build';

// Publish only customer-facing static assets; never publish repository internals.
const files = [
  'index.html',
  'help.html',
  'app.js',
  'style.css',
  'build494-command.css',
  'build521-workspace.css',
  'build522-portability.css',
  'build523-conflicts.css',
  'build524-history.css',
  'build525-retest.css',
  'build526-triage.css',
  'build540-ci-slo.css',
  'build541-ci-custody.css',
  'it-readiness.css',
  'favicon.ico',
  'manifest.json',
  'robots.txt',
  'sitemap.xml',
  'server-worker.js',
];
const directories = ['js', 'icons'];

if (existsSync(output)) {
  if (!existsSync(join(output, marker))) {
    throw new Error('Refusing to replace dist/: it was not created by the YW Vercel static build');
  }
  rmSync(output, { recursive: true });
}

mkdirSync(output, { recursive: true });
for (const path of files) cpSync(join(root, path), join(output, path));
for (const path of directories) cpSync(join(root, path), join(output, path), { recursive: true });

// public/data contains explicitly public, versioned website data.
const publicDirectory = join(root, 'public');
if (existsSync(publicDirectory)) {
  for (const entry of readdirSync(publicDirectory)) {
    cpSync(join(publicDirectory, entry), join(output, entry), { recursive: true });
  }
}

// This project deploys dist/ as a static site, not Vercel Functions. Publish
// build-time, non-sensitive v1 discovery documents through exact GET rewrites.
// Protected tenant/module APIs must NOT be added to this static output.
const integrationDir = join(output, 'api', 'integration', 'v1');
mkdirSync(integrationDir, { recursive: true });
const environment = ['production', 'preview', 'development'].includes(process.env.VERCEL_ENV)
  ? process.env.VERCEL_ENV : 'unknown';
const isProductionMain = process.env.VERCEL_ENV === 'production' &&
  process.env.VERCEL_GIT_COMMIT_REF === 'main';
const releaseSha = isProductionMain && /^[a-f0-9]{40}$/.test(process.env.VERCEL_GIT_COMMIT_SHA || '')
  ? process.env.VERCEL_GIT_COMMIT_SHA : null;
// A tracked manifest cannot embed its own final commit SHA. The deployed
// manifest is pinned at build time to the Git-origin Vercel deployment SHA.
// If the Git-derived SHA is absent, publish an explicit HOLD, never a guess.
const discoveryPath = join(output, '.well-known', 'rosevear-integration-manifest.json');
const manifest = JSON.parse(readFileSync(discoveryPath, 'utf8'));
if (manifest.source_id !== 'yw' || manifest.repository !== 'RosevearCreations/yw' ||
    manifest.source_role !== 'platform_shell' || manifest.tenant_boundary !== 'platform_shell') {
  throw new Error('YW master product source identity or platform-shell boundary invalid');
}
manifest.source_revision = releaseSha;
manifest.source_revision_state = releaseSha ? 'DEPLOYMENT_BOUND_UNSIGNED' : 'HOLD_UNVERIFIED_SOURCE_REVISION';
manifest.connection_state = 'DISCONNECTED / HOLD';
manifest.signature = {algorithm:'Ed25519',key_id:null,value:null,
  state:'AWAITING_INDEPENDENT_SOURCE_SIGNER'};
writeFileSync(discoveryPath, JSON.stringify(manifest,null,2)+'\n');
const common = { contract_version: '1', app_id: 'yard-workers', app_version: '471',
  environment, connection_status: 'HOLD', source_revision: releaseSha,
  source_revision_state: releaseSha ? 'DEPLOYMENT_BOUND_UNSIGNED' : 'HOLD_UNVERIFIED_SOURCE_REVISION',
  tenant_boundary: 'platform_shell', events_enabled: false, commands_enabled: false };
const documents = {
  'health.json': { ...common, health: 'available', authenticated: false },
  'capabilities.json': { ...common, tenant_scope: 'required_before_connection',
    service_module_scope: 'required_before_connection', owner_approval_required: true,
    capabilities: ['read_client', 'read_property', 'read_estimate', 'read_job',
      'read_route', 'read_equipment', 'create_handoff', 'update_job_status']
      .map(name => ({ name, enabled: false })) },
};
for (const [name, payload] of Object.entries(documents)) {
  writeFileSync(join(integrationDir, name), JSON.stringify(payload) + '\n');
}

writeFileSync(join(output, marker), 'Generated website output. Do not edit this directory.\n');
console.log(`YW Vercel static website generated in ${output}`);

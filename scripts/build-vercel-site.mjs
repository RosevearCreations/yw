import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
const common = { contract_version: '1', app_id: 'yard-workers', app_version: '471',
  environment, connection_status: 'HOLD', events_enabled: false, commands_enabled: false };
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

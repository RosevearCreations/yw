import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
assert.equal(config.buildCommand, 'npm run build:vercel');
assert.equal(config.outputDirectory, 'dist');

execFileSync(process.execPath, [join(root, 'scripts/build-vercel-site.mjs')], { stdio: 'inherit' });
const output = join(root, 'dist');

for (const path of [
  'index.html', 'help.html', 'app.js', 'style.css', 'it-readiness.css',
  'manifest.json', 'favicon.ico', 'robots.txt', 'sitemap.xml',
  'server-worker.js', 'js/app-config.js', 'js/mobile-field-evidence-433.js',
  'js/service-dispatch-safety-preflight-434.js',
  'js/shared-capacity-conflict-review-435.js', 'icons/icon-192.png',
  'data/company-service-inventory-419.json',
]) {
  assert.ok(existsSync(join(output, path)), `Missing website asset: ${path}`);
}

// Every local script and stylesheet referenced by the app entry point must ship.
for (const page of ['index.html', 'help.html']) {
  const html = readFileSync(join(output, page), 'utf8');
  for (const [, asset] of html.matchAll(/(?:src|href)="\/(?!#)([^"?#]+)(?:[?#][^"]*)?"/g)) {
    if (asset === '') continue;
    assert.ok(existsSync(join(output, asset)), `${page} references absent /${asset}`);
  }
}

// Internal files may not accidentally be included in the public deployment.
for (const forbidden of [
  'api', 'docs', 'scripts', 'sql', 'supabase', 'tests', '.github',
  'package.json', 'package-lock.json', 'README.md', '.env',
]) {
  assert.ok(!existsSync(join(output, forbidden)), `Private path exposed: ${forbidden}`);
}
assert.ok(readdirSync(output).includes('index.html'), 'Site root would be a 404');
console.log('YW Vercel output verified: root page, assets and private-file boundary');

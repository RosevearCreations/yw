#!/usr/bin/env node
import fs from 'node:fs';

const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const moduleScripts = [
  '/js/admin-actions.js',
  '/js/admin-ui.js',
  '/js/operations-cockpit.js',
  '/js/finance-ui.js',
  '/js/module-access-ui.js',
  '/js/hse-ops-ui.js',
  '/js/logbook-ui.js',
  '/js/reports-ui.js',
  '/js/jobs-ui.js',
  '/js/forms-toolbox.js',
  '/js/forms-ppe.js',
  '/js/forms-firstaid.js',
  '/js/forms-incident.js',
  '/js/forms-inspection.js',
  '/js/forms-drill.js'
];

for (const src of moduleScripts) {
  const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  html = html.replace(new RegExp(`^\\s*<script src="${escaped}\\?v=[^"]+"><\\/script>\\s*\\n`, 'm'), '');
}

html = html.replace('  <!-- Correct module order -->', '  <!-- Shared Core shell. Business modules are permission-loaded by module-runtime.js. -->');

const referenceLine = /(^\s*<script src="\/js\/reference-data\.js\?v=[^"]+"><\/script>\s*$)/m;
if (!html.includes('/js/module-runtime.js?')) {
  if (!referenceLine.test(html)) throw new Error('reference-data script anchor not found');
  html = html.replace(referenceLine, `$1\n  <script src="/js/module-runtime.js?v=2026-09-01d"></script>`);
}

html = html.replace(/<script src="\/app\.js\?v=[^"]+" defer><\/script>/, '<script src="/app.js?v=2026-09-01d" defer></script>');

for (const src of moduleScripts) {
  const staticTag = new RegExp(`<script src="${src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\?v=`);
  if (staticTag.test(html)) throw new Error(`Module script still eagerly loaded: ${src}`);
}

if ((html.match(/\/js\/module-runtime\.js\?v=/g) || []).length !== 1) {
  throw new Error('Expected exactly one static module-runtime script');
}

fs.writeFileSync(file, html);
console.log('Schema 162 shell activation complete: module scripts are permission-driven.');

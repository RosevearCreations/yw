#!/usr/bin/env node
import fs from 'node:fs';

const indexPath = 'index.html';
const smokePath = 'scripts/repo-smoke-check.mjs';

let index = fs.readFileSync(indexPath, 'utf8');
index = index.replace('/server-worker.js?v=2026-09-01b', '/server-worker.js?v=2026-09-01d');
fs.writeFileSync(indexPath, index);

let smoke = fs.readFileSync(smokePath, 'utf8');
smoke = smoke.replace('/** Repository-level static sanity check for build 2026-09-01b / schema 160. */', '/** Repository-level static sanity check for Shared Core/module runtime through Schema 162. */');
smoke = smoke.replace(
  "add('build-cache-marker-current', hasAll(index, ['2026-09-01b', 'operations-cockpit.js?v=2026-09-01b']) && read('server-worker.js').includes('ywi-shell-v2026-09-01b'), 'HTML and service-worker cache marker are current.');",
  "add('build-cache-marker-current', hasAll(index, ['server-worker.js?v=2026-09-01d', 'module-runtime.js?v=2026-09-01d', 'app.js?v=2026-09-01d']) && read('server-worker.js').includes('ywi-shell-v2026-09-01d'), 'Schema 162 HTML/runtime and service-worker cache markers are current.');"
);
fs.writeFileSync(smokePath, smoke);

console.log('Schema 162 cache marker repair complete.');

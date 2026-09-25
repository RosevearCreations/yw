import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const outbox=read('js/outbox.js');
const today=read('js/mobile-today.js');
const operations=read('supabase/functions/operations-manage/index.ts');
const index=read('index.html');
const help=read('help.html');
const roadmap=read('docs/NEXT_STEPS_AND_SANITY_CHECK.md');
const pkg=read('package.json');
const workflow=read('.github/workflows/staging-browser-integration.yml');
const must=(source,needles,label)=>needles.forEach((needle)=>assert.ok(source.includes(needle),`${label}: missing ${needle}`));

must(outbox,[
  "RECOVERY_HISTORY_KEY = 'ywi_conflict_recovery_history_v1'",
  'function ownerKey()',
  'function serverSnapshotFromError',
  'local_payload: item?.payload || {}',
  'server_payload: isConflict ? serverSnapshotFromError',
  'function getRecoveryItems',
  "['keep_mine', 'keep_server', 'merge', 'retry', 'discard']",
  "Merge requires an explicit merged object. Automatic merge is disabled.",
  'This queued conflict belongs to a different signed-in profile.',
  "document.dispatchEvent(new CustomEvent('ywi:conflict-recovery'"
],'Build 348 outbox');

must(today,[
  'Build 348 — Offline &amp; Conflict Recovery',
  'Mine — retained locally',
  'Server — authoritative snapshot',
  'Not supplied by this record contract.',
  'Keep Mine',
  'Keep Server',
  'Merge',
  'Retry',
  'Discard',
  'Automatic merge is disabled.',
  "document.addEventListener('ywi:conflict-recovery', render)"
],'Build 348 field UI');

assert.ok(!today.includes('Object.assign(comparison.server_payload'), 'Build 348 must not auto-merge server payload into local payload.');
assert.ok(!outbox.includes("action === 'merge' ? { ..."), 'Build 348 must not use an implicit merge shortcut.');
must(operations,["action === 'offline_conflict_card' || action === 'offline_conflict_resolve'","mobile_offline_conflict_cards","retry_sync","keep_local","reload_server","discard_local"],'Existing server conflict-card authority');
must(index,['/js/mobile-today.js?v=2026-09-25b348','/js/outbox.js?v=2026-09-25b348'],'Build 348 cache bust');
must(help,['Build 348 — Offline &amp; Conflict Recovery','Compare before deciding:','Explicit recovery only:','Profile isolation:'],'Build 348 help');
must(roadmap,['#### **348 — Offline & Conflict Recovery** is implemented','next planned autonomous item is **350 — Owner / Management Command Centre**'],'Build 348 roadmap');
must(pkg,['test:offline-conflict-recovery','test:browser:offline-conflict-recovery'],'Build 348 scripts');
must(workflow,['npm run test:offline-conflict-recovery','npm run test:browser:offline-conflict-recovery'],'Build 348 CI');

new Function(outbox);
new Function(today);
console.log('Build 348 Offline & Conflict Recovery checks: PASS');

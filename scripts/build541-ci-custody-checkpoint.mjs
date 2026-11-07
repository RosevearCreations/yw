#!/usr/bin/env node
/** Post-GREEN nonprivileged artifact checkpoint. Does not renew GitHub expiry. */
import { readFile,writeFile } from 'node:fs/promises';
import { createCheckpoint } from './build541-ci-custody-checkpoint-core.mjs';

const auditRaw=await readFile('ci-runtime-audit.json','utf8');
const archiveRaw=await readFile('ci-slo-archive.json','utf8');
const receiptRaw=await readFile('ci-slo-retention-receipt.json','utf8');
const checkpoint=await createCheckpoint(auditRaw,archiveRaw,receiptRaw);
await writeFile('ci-slo-custody-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n','utf8');
console.log(`Build 541: original SHA ${checkpoint.originalMainSha.slice(0,12)} readback checkpoint produced; independent second-site custody and owner renewal remain unverified.`);

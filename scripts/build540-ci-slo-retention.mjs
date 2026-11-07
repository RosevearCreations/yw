#!/usr/bin/env node
/** Generates three matching CI artifact files only after exact-main audit verification. */
import { readFile, writeFile } from 'node:fs/promises';
import { createEvidenceArchive } from './build540-ci-slo-retention-core.mjs';

const source = process.env.YWI_CI_AUDIT_REPORT_PATH || 'ci-runtime-audit.json';
const raw = await readFile(source, 'utf8');
const { archive, receipt } = createEvidenceArchive(JSON.parse(raw), raw);
await writeFile('ci-slo-archive.json', `${JSON.stringify(archive, null, 2)}\n`, 'utf8');
await writeFile('ci-slo-retention-receipt.json', `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
console.log(`Build 540: portable owner archive and 30-day artifact retention receipt for original Actions run ${receipt.originalActionsRunId}; no independent custody claimed.`);

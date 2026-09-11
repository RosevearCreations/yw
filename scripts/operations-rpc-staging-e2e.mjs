#!/usr/bin/env node
import process from 'node:process';
import { verifyRuntimeAuthority } from './staging-runtime-authority-preflight.mjs';

const authority = await verifyRuntimeAuthority(process.env, fetch);
if (!authority.ok) {
  console.error('STAGING RUNTIME AUTHORITY: LOCKED');
  for (const error of authority.errors || []) console.error(`- ${error}`);
  process.exit(1);
}
if (!authority.skipped) {
  console.log('STAGING RUNTIME AUTHORITY: READY');
}

await import('./operations-rpc-staging-e2e-core.mjs');

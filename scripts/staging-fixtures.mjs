#!/usr/bin/env node
/**
 * Creates or cleans one labelled disposable fixture set in a dedicated staging
 * Supabase project. It refuses ambiguous targets and never defaults to production.
 *
 * Create: YWI_STAGING_FIXTURES=1 YWI_STAGING_LABEL=staging
 *         YWI_STAGING_CONFIRM=I_CONFIRM_STAGING_ONLY ... node scripts/staging-fixtures.mjs create
 * Cleanup: same interlocks plus YWI_STAGING_FIXTURE_SET_ID=<uuid> ... cleanup
 */
import process from 'node:process';

const action = String(process.argv[2] || 'help').toLowerCase();
const url = (process.env.SUPABASE_URL || process.env.SB_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY || '';
const actorId = process.env.YWI_STAGING_JOB_ADMIN_PROFILE_ID || '';
const label = String(process.env.YWI_STAGING_LABEL || '').trim().toLowerCase();
const confirm = process.env.YWI_STAGING_CONFIRM || '';
const enabled = process.env.YWI_STAGING_FIXTURES === '1';
const fixtureLabel = String(process.env.YWI_STAGING_FIXTURE_LABEL || 'STAGING-RPC').trim().toUpperCase();

function fail(message) { console.error(`ERROR  ${message}`); process.exit(1); }
if (!['create','cleanup'].includes(action)) {
  console.log('Usage: node scripts/staging-fixtures.mjs create|cleanup');
  process.exit(0);
}
if (!enabled) fail('Set YWI_STAGING_FIXTURES=1. Fixtures are disabled by default.');
if (label !== 'staging' || confirm !== 'I_CONFIRM_STAGING_ONLY') fail('Set YWI_STAGING_LABEL=staging and YWI_STAGING_CONFIRM=I_CONFIRM_STAGING_ONLY.');
if (!url || !key || !actorId) fail('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and YWI_STAGING_JOB_ADMIN_PROFILE_ID.');
if (action === 'create' && !/^STAGING-[A-Z0-9_-]{3,80}$/.test(fixtureLabel)) fail('YWI_STAGING_FIXTURE_LABEL must begin STAGING- and use only A-Z, 0-9, _, or -.');

async function rpc(name, body) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method:'POST',
    headers:{ apikey:key, authorization:`Bearer ${key}`, 'Content-Type':'application/json', Prefer:'return=representation' },
    body:JSON.stringify(body)
  });
  const raw=await response.text(); let data=null; try { data=raw?JSON.parse(raw):null; } catch { data=raw; }
  if (!response.ok) throw new Error(`${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}
try {
  if (action === 'create') {
    const result = await rpc('ywi_rpc_create_staging_fixture_set', { p_actor_profile_id:actorId, p_fixture_label:fixtureLabel });
    const safe = { ...result };
    if (safe.portal_token && process.env.YWI_REVEAL_STAGING_TOKENS !== '1') safe.portal_token = '[masked: set YWI_REVEAL_STAGING_TOKENS=1 only for a local staging browser test]';
    console.log(JSON.stringify(safe, null, 2));
  } else {
    const fixtureSetId = process.env.YWI_STAGING_FIXTURE_SET_ID || '';
    if (!/^[0-9a-f-]{36}$/i.test(fixtureSetId)) fail('Set YWI_STAGING_FIXTURE_SET_ID to the UUID returned by create.');
    const result = await rpc('ywi_rpc_cleanup_staging_fixture_set', { p_fixture_set_id:fixtureSetId, p_actor_profile_id:actorId, p_cleanup_note:'Cleanup requested by scripts/staging-fixtures.mjs.' });
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

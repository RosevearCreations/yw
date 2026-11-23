// Structural guard prevents repeat of PL/pgSQL dollar-quoted function
// terminator error that blocked YW591's first controlled migration.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync('sql/yw591_private_photo_retry_opt_in_multitenant.sql','utf8');
const declarations=[...sql.matchAll(/language plpgsql [^\n]+ as \$fn\$/g)];
const endings=[...sql.matchAll(/end; \$fn\$;/g)];
assert.equal(declarations.length,7,'Expected seven reviewed YW591 PL/pgSQL functions');
assert.equal(endings.length,declarations.length,
 'Every PL/pgSQL END must be terminated with a semicolon before $fn$');
assert.ok(!sql.includes('end $fn$;'),'Unterminated PL/pgSQL END is unsafe');
assert.ok(sql.trim().startsWith('-- YW591'));
assert.ok(sql.trim().endsWith('commit;'));
assert.ok(sql.includes('revoke all on function public.ywi_591_reserve_attempt'));
assert.ok(sql.includes('revoke all on function public.ywi_591_finalize_attempt'));
assert.ok(sql.includes('revoke all on function public.ywi_591_quarantine_attempt'));
assert.ok(sql.includes('enable row level security'));
console.log('YW591 source migration function terminator and service-only RLS contract PASS');

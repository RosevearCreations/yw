import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const ui=fs.readFileSync('js/operations-cockpit.js','utf8');
const endpoint=fs.readFileSync('supabase/functions/operations-manage/index.ts','utf8');
const migration=fs.readFileSync('sql/210_crew_scheduling_dispatch.sql','utf8');

test('Build 321 exposes daily weekly crew scheduling with conflict/workability controls', async ({ page }) => {
  await page.setContent('<main><section id="operationsCockpit"><form id="oc_crew_dispatch_form"></form><div id="oc_crew_dispatch_board"></div></section></main>');
  expect(ui).toContain('Crew Scheduling &amp; Dispatch');
  expect(ui).toContain('7-day');
  expect(ui).toContain('Daily');
  expect(ui).toContain('Travel allowance (min)');
  expect(ui).toContain('Conflict override note');
  expect(ui).toContain('blocked workability');
  expect(endpoint).toContain("supabase.rpc('ywi_rpc_dispatch_schedule_v2'");
  expect(endpoint).toContain("crew_dispatch_meta: { build:321, schema:210");
  expect(migration).toContain('b.resource_keys && o.resource_keys');
  expect(migration).toContain('an explicit override note is required');
  expect(migration).toContain("v_status='cancelled'");
  expect(migration).toContain("v_status='rescheduled'");
});

test('Build 321 preserves canonical Jobs dispatch event authority', async () => {
  expect(migration).toContain("'jobs.job_scheduled'");
  expect(migration).toContain("'contract_version',2");
  expect(migration).toContain("'build',321");
  expect(migration).toContain("'schema',210");
  expect(endpoint).toContain("action === 'dispatch_schedule'");
  expect(endpoint).not.toContain("action === 'crew_dispatch_schedule'");
});

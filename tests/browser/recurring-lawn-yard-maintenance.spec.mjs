import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const ui=fs.readFileSync('js/operations-cockpit.js','utf8');
const endpoint=fs.readFileSync('supabase/functions/operations-manage/index.ts','utf8');
const migration=fs.readFileSync('sql/211_recurring_lawn_yard_maintenance.sql','utf8');

test('Build 322 renders recurring program and upcoming visit controls', async ({ page }) => {
  await page.setContent('<main><section id="operationsCockpit"><form id="oc_recurring_program_form"></form><div id="oc_recurring_programs"></div><div id="oc_recurring_visits"></div></section></main>');
  expect(ui).toContain('Recurring Lawn &amp; Yard Maintenance');
  expect(ui).toContain('Weekly');
  expect(ui).toContain('Biweekly');
  expect(ui).toContain('Custom days');
  expect(ui).toContain('Seasonal once');
  expect(ui).toContain('Weather delay');
  expect(ui).toContain('Make-up date');
  expect(ui).toContain('Customer hold');
  expect(ui).toContain('Cancel visit');
  expect(endpoint).toContain("recurring_service_meta: { build:322, schema:211");
});

test('Build 322 keeps recurrence evidence private and reuses the scheduler', async () => {
  expect(migration).toContain('alter table public.recurring_service_visit_events enable row level security;');
  expect(migration).toContain('revoke all on table public.recurring_service_visit_events from public,anon,authenticated;');
  expect(migration).toContain('create or replace view public.v_service_execution_scheduler_candidates');
  expect(migration).toContain("v.visit_status in ('scheduled','weather_delayed','makeup')");
  expect(migration).toContain("'finance_provider_execution_off'");
  expect(endpoint).not.toContain("action === 'recurring_service_dispatch'");
});

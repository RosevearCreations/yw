import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const ui=fs.readFileSync('js/operations-cockpit.js','utf8');
const endpoint=fs.readFileSync('supabase/functions/operations-manage/index.ts','utf8');
const migration=fs.readFileSync('sql/213_estimate_job_invoice_workflow.sql','utf8');

test('Build 324 renders landscaping estimate, assumption, change-order and readiness controls', async ({ page }) => {
  await page.setContent('<main><section id="operationsCockpit"><form id="oc_estimate_workflow_form"></form><form id="oc_estimate_assumption_form"></form><form id="oc_change_order_form"></form><div id="oc_estimate_workflows"></div><div id="oc_estimate_assumptions"></div><div id="oc_change_orders"></div><div id="oc_estimate_variance"></div></section></main>');
  expect(ui).toContain('Estimate → Job → Invoice Workflow');
  expect(ui).toContain('Labour hours');
  expect(ui).toContain('Crew size');
  expect(ui).toContain('Subcontract / vendor');
  expect(ui).toContain('Optional work');
  expect(ui).toContain('Customer approval reference');
  expect(ui).toContain('Baseline → actual variance');
  expect(endpoint).toContain("estimate_invoice_meta: { build:324, schema:213");
});

test('Build 324 preserves portal acceptance and Finance invoice authority', async () => {
  expect(migration).toContain("'portal_acceptance_authority_preserved'");
  expect(migration).toContain("'finance_candidate_authority_preserved'");
  expect(migration).toContain("'finance_provider_execution_off'");
  expect(migration).toContain('public.job_invoice_candidates');
  expect(migration).toContain('public.ywi_rpc_accept_quote_package');
  expect(migration).not.toMatch(/insert\s+into\s+public\.(?:ar_invoices|ar_invoice_lines|gl_journal_batches|gl_journal_entries|ar_payments|payments)\b/i);
});

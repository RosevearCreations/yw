import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const source=fs.readFileSync('js/finance-ui.js','utf8');

test('Build 319 renders an internal read-only landscaping finance dashboard contract', async ({ page }) => {
  await page.setContent('<main id="financeWorkspace"></main>');
  expect(source).toContain('Landscaping Finance Dashboard &amp; Cash Position');
  expect(source).toContain('Cash / bank position');
  expect(source).toContain('Overdue / open receivables');
  expect(source).toContain('Vendor / material commitments');
  expect(source).toContain('Job profitability exceptions');
  expect(source).toContain('Tax / payroll readiness');
  expect(source).toContain('Seasonal comparison');
  expect(source).toContain('this dashboard is read-only');
  expect(source).not.toContain('posting_execution_authorized: true');
  expect(source).not.toContain('provider_mutation: true');
});

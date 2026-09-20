import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const ui=fs.readFileSync('js/operations-cockpit.js','utf8');
const endpoint=fs.readFileSync('supabase/functions/operations-manage/index.ts','utf8');

test('Build 320 exposes one permission-aware prioritized attention workspace', async ({ page }) => {
  await page.setContent('<main><div id="operationsCockpit"><div id="oc_attention_queue"></div><div id="oc_attention_resolved"></div></div></main>');
  expect(ui).toContain('Operations Needs Attention');
  expect(ui).toContain('Recently resolved');
  expect(ui).toContain('attention-open');
  expect(ui).toContain('attention-defer');
  expect(ui).toContain('attention-resolve');
  expect(ui).toContain("canViewModule?.(row.source_module");
  expect(endpoint).toContain('ATTENTION_PRIORITY_RANK');
  expect(endpoint).toContain('permission_filtered:true');
  expect(endpoint).toContain('completed_not_invoiced');
  expect(endpoint).toContain('overdue_receivable');
  expect(endpoint).toContain('reconciliation_exception');
  expect(endpoint).toContain('timesheet_issue');
  expect(endpoint).toContain('maintenance_overdue');
});

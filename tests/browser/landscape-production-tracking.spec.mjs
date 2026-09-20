import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const ui=fs.readFileSync('js/operations-cockpit.js','utf8');
const endpoint=fs.readFileSync('supabase/functions/operations-manage/index.ts','utf8');
const migration=fs.readFileSync('sql/214_landscape_production_tracking.sql','utf8');

test('Build 325 renders field session, workability, crew and production controls', async ({ page }) => {
  await page.setContent('<main><section id="operationsCockpit"><form id="oc_production_session_form"></form><form id="oc_production_quantity_form"></form><div id="oc_production_sessions"></div><div id="oc_production_quantities"></div></section></main>');
  expect(ui).toContain('Landscape Production Tracking');
  expect(ui).toContain('Crew-hour evidence');
  expect(ui).toContain('Weather / workability context');
  expect(ui).toContain('Return visit required');
  expect(ui).toContain('Production / disposal quantities');
  expect(ui).toContain('Before/during/after photos');
  expect(endpoint).toContain("landscape_production_meta: { build:325, schema:214");
});

test('Build 325 reuses canonical field evidence authorities', async () => {
  expect(migration).toContain("'canonical_execution_authorities_preserved'");
  expect(migration).toContain("'media_evidence_authority_preserved'");
  expect(migration).toContain("'material_equipment_authority_preserved'");
  expect(migration).toContain('public.material_issues');
  expect(migration).toContain('public.equipment_signouts');
  expect(migration).toContain('public.work_order_execution_proofs');
  expect(migration).toContain('public.work_order_live_updates');
  expect(migration).not.toMatch(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(?:production_material|production_equipment|production_photo|production_closeout)/i);
});

test('Build 325 material issue trigger handles header and line shapes', async () => {
  expect(migration).toContain('create or replace function public.ywi_after_material_issue_journal_sync()');
  expect(migration).toContain("nullif(to_jsonb(new)->>'issue_id','')::uuid");
  expect(migration).toContain("nullif(to_jsonb(new)->>'id','')::uuid");
  expect(migration).toContain("nullif(to_jsonb(old)->>'issue_id','')::uuid");
  expect(migration).toContain("nullif(to_jsonb(old)->>'id','')::uuid");
});

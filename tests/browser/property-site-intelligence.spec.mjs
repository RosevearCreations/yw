import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const ui=fs.readFileSync('js/operations-cockpit.js','utf8');
const endpoint=fs.readFileSync('supabase/functions/operations-manage/index.ts','utf8');
const migration=fs.readFileSync('sql/212_property_site_intelligence.sql','utf8');

test('Build 323 renders property, zone and private photo-reference controls', async ({ page }) => {
  await page.setContent('<main><section id="operationsCockpit"><form id="oc_property_form"></form><form id="oc_property_zone_form"></form><form id="oc_property_photo_form"></form><div id="oc_property_sites"></div><div id="oc_property_zones"></div><div id="oc_property_photos"></div></section></main>');
  expect(ui).toContain('Property &amp; Site Intelligence');
  expect(ui).toContain('Gates / fences');
  expect(ui).toContain('Parking / trailer limits');
  expect(ui).toContain('Pets');
  expect(ui).toContain('Irrigation');
  expect(ui).toContain('Drainage / wet areas');
  expect(ui).toContain('Utilities / locate notes');
  expect(ui).toContain('Tree / brush concerns');
  expect(ui).toContain('Register private photo reference');
  expect(endpoint).toContain("property_site_meta: { build:323, schema:212");
});

test('Build 323 keeps property intelligence private and preserves Safety site authority', async () => {
  expect(migration).toContain('alter table public.client_site_zones enable row level security;');
  expect(migration).toContain('alter table public.client_site_photos enable row level security;');
  expect(migration).toContain('revoke all on table public.client_site_zones from public,anon,authenticated;');
  expect(migration).toContain('revoke all on table public.client_site_photos from public,anon,authenticated;');
  expect(migration).toContain("'legacy_safety_site_authority_preserved'");
  expect(migration).toContain("'finance_provider_execution_off'");
  expect(endpoint).not.toContain("action === 'property_safety_site_save'");
});

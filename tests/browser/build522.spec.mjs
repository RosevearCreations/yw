import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const original=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const saved=readFileSync('js/owner-management-workspace-521.js','utf8');
const portable=readFileSync('js/owner-management-portability-522.js','utf8');
const styles=['build494-command.css','build521-workspace.css','build522-portability.css']
  .map(f=>readFileSync(f,'utf8')).join('\n');
const fixture=visibility=>({ok:true,source_visibility:{jobs:true,finance:true,admin:true,safety:false,...visibility},
  source_freshness:{},owner_jobs:[]});
async function boot(page,visibility={}){
  await page.route('https://yw522.test/**',route=>route.fulfill({status:200,contentType:'text/html',
    body:'<!doctype html><html><body><section id="admin"></section></body></html>'}));
  await page.goto('https://yw522.test/');
  await page.addStyleTag({content:styles});
  await page.evaluate(d=>{window.YWIAPI={loadAdminDirectory:async()=>d};},fixture(visibility));
  for(const source of [original,saved,portable])await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
  await expect(page.locator('#owner522Portability')).toHaveCount(1);
}
const packet=(focus='reliability')=>({format:'yard-workers-management-display-view',schema_version:1,
  preferences:{version:1,focus,density:'compact'}});
test('inspects and applies only valid portable display preferences',async({page})=>{
  await boot(page);
  await page.locator('#owner522Import').setInputFiles({name:'view.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(packet()))});
  await expect(page.locator('#owner522ImportStatus')).toContainText('Inspected display view');
  await expect(page.locator('#owner522Apply')).toBeEnabled();
  await page.locator('#owner522Apply').click();
  await expect(page.locator('#owner521Area')).toHaveValue('reliability');
  await expect(page.locator('#owner520Focus')).toHaveValue('reliability');
  await expect(page.locator('.owner520-navigation')).toHaveClass(/yw521-compact/);
  await expect(page.locator('#owner522ImportStatus')).toContainText('saved display view');
  expect(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('yw:management-workspace-display:v521'))).sort()))
    .toEqual(['density','focus','version']);
});
test('rejects oversized, malformed and overprivileged import objects without changes',async({page})=>{
  await boot(page);
  await page.locator('#owner522Import').setInputFiles({name:'over.json',mimeType:'application/json',
    buffer:Buffer.from('x'.repeat(1100))});
  await expect(page.locator('#owner522ImportStatus')).toContainText('exceeds 1 KB');
  await page.locator('#owner522Import').setInputFiles({name:'unsafe.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({...packet('economic'),secret:'private'}))});
  await expect(page.locator('#owner522ImportStatus')).toContainText('Import rejected');
  await expect(page.locator('#owner522Apply')).toBeDisabled();
  await expect(page.locator('#owner521Area')).toHaveValue('all');
});
test('exports portable JSON without source records or approval claims',async({page})=>{
  await boot(page);await page.locator('#owner521Area').selectOption('capacity');
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#owner522Export').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('yard-workers-management-view.json');
  await expect(page.locator('#owner522ImportStatus')).toContainText('No evidence');
});
test('manual keyboard evidence navigation reports only observed local source and return focus',async({page})=>{
  await boot(page);await page.locator('#owner522Start').click();
  const link=page.locator('#owner520Navigation a[href="#owner375Scenarios"]');
  await link.focus();await page.keyboard.press('Enter');
  await expect(page.locator('#owner375Scenarios')).toBeFocused();
  const back=page.locator('#owner521Return');await back.focus();await page.keyboard.press('Enter');
  await expect(link).toBeFocused();
  await page.locator('#owner522Review').click();
  await expect(page.locator('#owner522NavStatus')).toContainText('LOCAL NAVIGATION OBSERVED');
  await expect(page.locator('#owner522NavStatus')).toContainText('no owner approval');
});
test('permission withholding and recovery do not invent acceptance',async({page})=>{
  await boot(page,{jobs:false,finance:false});
  await page.locator('#owner522Start').click();
  await expect(page.locator('#owner522NavStatus')).toContainText('SOURCE WITHHELD');
  await expect(page.locator('#owner522Review')).toBeDisabled();
  await page.locator('#owner522Recover').click();
  await expect(page.locator('#owner521Area')).toHaveValue('all');
  await expect(page.locator('#owner522ImportStatus')).toContainText('Default review workspace recovered');
});

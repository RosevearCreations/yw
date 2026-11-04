import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const sources=['js/admin-owner-management-command-ui.js',
  'js/owner-management-workspace-521.js',
  'js/owner-management-portability-522.js',
  'js/owner-management-conflicts-523.js'].map(path=>readFileSync(path,'utf8'));
const styles=['build494-command.css','build521-workspace.css',
  'build522-portability.css','build523-conflicts.css'].map(path=>readFileSync(path,'utf8')).join('\n');
const packet=(focus='reliability',density='compact')=>({
  format:'yard-workers-management-display-view',schema_version:1,
  preferences:{version:1,focus,density}});
async function boot(page,visibility={}){
  await page.route('https://yw523.test/**',route=>route.fulfill({status:200,contentType:'text/html',
    body:'<!doctype html><html><body><section id="admin"></section></body></html>'}));
  await page.goto('https://yw523.test/');
  await page.addStyleTag({content:styles});
  await page.evaluate(v=>{window.YWIAPI={loadAdminDirectory:async()=>({ok:true,
    source_visibility:{jobs:true,finance:true,admin:true,safety:false,...v},
    source_freshness:{},owner_jobs:[]})};},visibility);
  for(const source of sources)await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
  await expect(page.locator('#owner523ConflictReview')).toHaveCount(1);
}
async function choose(page,value=packet()){
  await page.locator('#owner522Import').setInputFiles({name:'view.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(value))});
  await expect(page.locator('#owner523Incoming')).toContainText(value.preferences.focus);
}
test('conflicting import requires a separate, explicit replacement decision',async({page})=>{
  await boot(page);await choose(page);
  await expect(page.locator('#owner523ConflictStatus')).toContainText('DIFFERENCE FOUND');
  await expect(page.locator('#owner523Local')).toContainText('all evidence area');
  await page.locator('#owner522Apply').click();
  await expect(page.locator('#owner523ConflictStatus')).toContainText('Replacement paused');
  await expect(page.locator('#owner521Area')).toHaveValue('all');
  await page.locator('#owner523Replace').click();
  await expect(page.locator('#owner521Area')).toHaveValue('reliability');
  await expect(page.locator('#owner520Focus')).toHaveValue('reliability');
  await expect(page.locator('#owner523ConflictStatus')).toContainText('previous device view');
});
test('keep this device choice discards staged conflict without altering stored preferences',async({page})=>{
  await boot(page);
  await page.locator('#owner521Area').selectOption('economic');
  await page.locator('#owner521Save').click();
  await choose(page,packet('capacity'));
  await page.locator('#owner523Keep').click();
  await expect(page.locator('#owner521Area')).toHaveValue('economic');
  await expect(page.locator('#owner522Apply')).toBeDisabled();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('yw:management-workspace-display:v521')).focus))
    .toBe('economic');
});
test('replacement can be undone in the same session without touching evidence',async({page})=>{
  await boot(page);await page.locator('#owner521Area').selectOption('capacity');
  await page.locator('#owner521Save').click();
  await choose(page,packet('reliability'));
  await page.locator('#owner523Replace').click();
  await expect(page.locator('#owner523Undo')).toBeEnabled();
  await page.locator('#owner523Undo').click();
  await expect(page.locator('#owner521Area')).toHaveValue('capacity');
  await expect(page.locator('#owner523Undo')).toBeDisabled();
  expect(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('yw:management-workspace-display:v521'))).sort()))
    .toEqual(['density','focus','version']);
});
test('download recovery copy has a portable format and never includes source records',async({page})=>{
  await boot(page);await page.locator('#owner521Area').selectOption('economic');
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#owner523Backup').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('yard-workers-management-view.json');
  await expect(page.locator('#owner523ConflictStatus')).toContainText('another device');
});
test('invalid and oversized files cannot override local settings or activate replacement',async({page})=>{
  await boot(page);
  await page.locator('#owner522Import').setInputFiles({name:'unsafe.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({...packet(),tokens:['not-allowed']}))});
  await expect(page.locator('#owner523ConflictStatus')).toContainText('unsafe');
  await expect(page.locator('#owner523Replace')).toBeDisabled();
  await page.locator('#owner522Import').setInputFiles({name:'large.json',mimeType:'application/json',
    buffer:Buffer.from('x'.repeat(1200))});
  await expect(page.locator('#owner523ConflictStatus')).toContainText('too large');
  await expect(page.locator('#owner521Area')).toHaveValue('all');
});
test('accessibility follow-up reports local observations, never formal owner acceptance',async({page})=>{
  await boot(page);await page.locator('#owner523Assess').click();
  await expect(page.locator('#owner523AccessStatus')).toContainText('FOLLOW-UP NEEDED');
  await page.locator('#owner522Start').click();
  const source=page.locator('#owner520Navigation a[href="#owner375Scenarios"]');
  await source.focus();await page.keyboard.press('Enter');
  await page.locator('#owner521Return').focus();await page.keyboard.press('Enter');
  await page.locator('#owner522Review').click();
  await page.locator('#owner523FocusSeen').check();
  await page.locator('#owner523ZoomSeen').check();
  await page.locator('#owner523Assess').click();
  await expect(page.locator('#owner523AccessStatus')).toContainText('LOCAL OBSERVATIONS NOTED');
  await expect(page.locator('#owner523AccessStatus')).toContainText('No owner sign-off');
});

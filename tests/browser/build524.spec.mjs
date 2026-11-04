import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const sources=['js/admin-owner-management-command-ui.js',
  'js/owner-management-workspace-521.js',
  'js/owner-management-portability-522.js',
  'js/owner-management-conflicts-523.js',
  'js/owner-management-history-524.js'].map(path=>readFileSync(path,'utf8'));
const styles=['build494-command.css','build521-workspace.css','build522-portability.css',
  'build523-conflicts.css','build524-history.css'].map(path=>readFileSync(path,'utf8')).join('\n');
const legacyKey='yw:management-workspace-display:v521';
const historyKey='yw:management-recovery-history:v2';
const view=(focus='economic',density='compact')=>({version:1,focus,density});
const pack=values=>({format:'yard-workers-management-recovery-history',schema_version:2,snapshots:values});
async function boot(page,options={}){
  await page.route('https://yw524.test/**',route=>route.fulfill({status:200,contentType:'text/html',
    body:'<!doctype html><html><body><section id="admin"></section></body></html>'}));
  await page.goto('https://yw524.test/');await page.addStyleTag({content:styles});
  await page.evaluate(({legacy,history})=>{
    if(legacy!==undefined)localStorage.setItem('yw:management-workspace-display:v521',legacy);
    if(history!==undefined)localStorage.setItem('yw:management-recovery-history:v2',history);
    window.YWIAPI={loadAdminDirectory:async()=>({ok:true,
      source_visibility:{jobs:true,finance:true,admin:true,safety:false},source_freshness:{},owner_jobs:[]})};
  },options);
  for(const source of sources)await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
  await expect(page.locator('#owner524History')).toHaveCount(1);
}
test('copies a valid v1 preference to v2 history without deleting the v1 source',async({page})=>{
  await boot(page,{legacy:JSON.stringify(view('capacity'))});
  await page.locator('#owner524Migrate').click();
  await expect(page.locator('#owner524Status')).toContainText('Version 1 copied to version 2');
  const result=await page.evaluate(([a,b])=>({before:JSON.parse(localStorage.getItem(a)),
    after:JSON.parse(localStorage.getItem(b))}),[legacyKey,historyKey]);
  expect(result.before).toEqual(view('capacity'));
  expect(result.after).toEqual(pack([view('capacity')]));
});
test('quarantines invalid v2 recovery until explicit two-step reset',async({page})=>{
  const corrupted=JSON.stringify({...pack([view()]),secret:'must-not-carry'});
  await boot(page,{history:corrupted});
  await expect(page.locator('#owner524Status')).toContainText('invalid');
  await expect(page.locator('#owner524Snapshot')).toBeDisabled();
  await page.locator('#owner524Clear').click();
  expect(await page.evaluate(key=>localStorage.getItem(key),historyKey)).toBe(corrupted);
  await page.locator('#owner524Clear').click();
  expect(await page.evaluate(key=>localStorage.getItem(key),historyKey)).toBe(null);
  await expect(page.locator('#owner524Snapshot')).toBeEnabled();
});
test('keeps at most five snapshots and restores selected display choices',async({page})=>{
  await boot(page);
  const values=[view('all','comfortable'),view('economic','compact'),view('capacity','comfortable'),
    view('reliability','compact'),view('all','compact'),view('economic','comfortable')];
  for(const item of values){
    await page.locator('#owner521Area').selectOption(item.focus);
    await page.locator('#owner521Density').selectOption(item.density);
    await page.locator('#owner524Snapshot').click();
  }
  await expect(page.locator('#owner524Select option')).toHaveCount(5);
  const history=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),historyKey);
  expect(history.snapshots).toEqual(values.slice(1));
  await page.locator('#owner524Select').selectOption('0');
  await page.locator('#owner524Restore').click();
  await expect(page.locator('#owner521Area')).toHaveValue('economic');
  await expect(page.locator('#owner521Density')).toHaveValue('compact');
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),legacyKey)).toEqual(view('economic'));
});
test('exports v2 history and merges an inspected v2 file without importing sensitive fields',async({page})=>{
  await boot(page);await page.locator('#owner524Snapshot').click();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#owner524Export').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('yard-workers-recovery-history-v2.json');
  await page.locator('#owner524File').setInputFiles({name:'v2.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(pack([view('capacity'),view('economic')])))});
  await expect(page.locator('#owner524Status')).toContainText('Inspected v2 history');
  await page.locator('#owner524Merge').click();
  const v2=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),historyKey);
  expect(v2.snapshots).toEqual([view('all','comfortable'),view('capacity'),view('economic')]);
  expect(Object.keys(v2).sort()).toEqual(['format','schema_version','snapshots']);
});
test('rejects oversized and overprivileged v2 files while preserving current history',async({page})=>{
  await boot(page);await page.locator('#owner524Snapshot').click();
  await page.locator('#owner524File').setInputFiles({name:'large.json',mimeType:'application/json',
    buffer:Buffer.from('x'.repeat(1100))});
  await expect(page.locator('#owner524Status')).toContainText('exceeds 1 KB');
  await expect(page.locator('#owner524Merge')).toBeDisabled();
  await page.locator('#owner524File').setInputFiles({name:'unsafe.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({...pack([view('economic')]),identity:'not allowed'}))});
  await expect(page.locator('#owner524Status')).toContainText('rejected');
  const v2=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),historyKey);
  expect(v2.snapshots).toEqual([view('all','comfortable')]);
});
test('assistive-technology workbench never records a formal owner approval',async({page})=>{
  await boot(page);await page.locator('#owner524Review').click();
  await expect(page.locator('#owner524AcceptanceStatus')).toContainText('FOLLOW-UP OUTSTANDING');
  await page.locator('#owner522Start').click();
  const source=page.locator('#owner520Navigation a[href="#owner375Scenarios"]');
  await source.focus();await page.keyboard.press('Enter');
  await page.locator('#owner521Return').focus();await page.keyboard.press('Enter');
  await page.locator('#owner522Review').click();
  for(const id of ['owner524Reader','owner524Focus','owner524Zoom'])await page.locator('#'+id).check();
  await page.locator('#owner524Review').click();
  await expect(page.locator('#owner524AcceptanceStatus')).toContainText('LOCAL OBSERVATIONS DOCUMENTED');
  await expect(page.locator('#owner524AcceptanceStatus')).toContainText('Manual owner acceptance still required');
  expect(await page.evaluate(key=>localStorage.getItem(key),historyKey)).toBe(null);
});

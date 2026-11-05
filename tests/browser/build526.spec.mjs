import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const sourceFiles=['js/admin-owner-management-command-ui.js',
  'js/owner-management-workspace-521.js','js/owner-management-portability-522.js',
  'js/owner-management-conflicts-523.js','js/owner-management-history-524.js',
  'js/owner-management-retest-525.js','js/owner-management-triage-526.js'];
const sources=sourceFiles.map(x=>readFileSync(x,'utf8'));
const styles=['build494-command.css','build521-workspace.css','build522-portability.css',
  'build523-conflicts.css','build524-history.css','build525-retest.css','build526-triage.css']
  .map(x=>readFileSync(x,'utf8')).join('\n');
const key='yw:management-owner-retest-triage:v1';
const historyKey='yw:management-recovery-history:v2';
const item=(focus='economic',density='compact')=>({version:1,focus,density});
const pack=snapshots=>({format:'yard-workers-management-recovery-history',schema_version:2,snapshots});
async function boot(page,options={}){
  await page.route('https://yw526.test/**',route=>route.fulfill({status:200,contentType:'text/html',
    body:'<!doctype html><html><body><section id="admin"></section></body></html>'}));
  await page.goto('https://yw526.test/');await page.addStyleTag({content:styles});
  await page.evaluate(({triage,history})=>{
    if(triage!==undefined)localStorage.setItem('yw:management-owner-retest-triage:v1',triage);
    if(history!==undefined)localStorage.setItem('yw:management-recovery-history:v2',history);
    window.YWIAPI={loadAdminDirectory:async()=>({ok:true,source_visibility:{jobs:true,
      finance:true,admin:true,safety:false},source_freshness:{},owner_jobs:[]})};
  },options);
  for(const source of sources)await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
  await expect(page.locator('#owner526Triage')).toHaveCount(1);
}
async function reviewed(page,outcome='follow_up'){
  await page.locator('#owner525Category').selectOption('screen_reader');
  await page.locator('#owner525Outcome').selectOption(outcome);
  await page.locator('#owner525Notes').fill('Sensitive free-text should not be copied to triage.');
  await page.locator('#owner525Review').click();
}
async function choose(page,values){
  await page.locator('#owner524File').setInputFiles({name:'history.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(pack(values)))});
  await expect(page.locator('#owner525Incoming')).toContainText(values[0].focus);
}
test('local finding triage requires a reviewed draft and actual device; notes are excluded',async({page})=>{
  await boot(page);await page.locator('#owner526Add').click();
  await expect(page.locator('#owner526Status')).toContainText('Review the provisional');
  await reviewed(page);await page.locator('#owner526Add').click();
  await expect(page.locator('#owner526Status')).toContainText('Choose the device');
  await page.locator('#owner526Device').selectOption('desktop');
  await page.locator('#owner526Add').click();
  await expect(page.locator('#owner526Findings')).toContainText('screen reader');
  const value=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  expect(value.findings).toHaveLength(1);
  expect(Object.keys(value.findings[0]).sort()).toEqual(['category','device','disposition','id','observations','outcome']);
  expect(JSON.stringify(value)).not.toContain('Sensitive');
  expect(value.findings[0].disposition).toBe('under_review');
});
test('device follow-up updates selected record and filtering never changes source evidence',async({page})=>{
  await boot(page,{history:JSON.stringify(pack([item('capacity')]))});
  await reviewed(page);await page.locator('#owner526Device').selectOption('desktop');
  await page.locator('#owner526Add').click();
  await page.locator('#owner526Selected').selectOption('1');
  await page.locator('#owner526Disposition').selectOption('device_retest');
  await page.locator('#owner526Device').selectOption('phone');
  await page.locator('#owner526Update').click();
  await page.locator('#owner526Filter').selectOption('device_retest');
  await expect(page.locator('#owner526Findings')).toContainText('phone');
  await page.locator('#owner526Filter').selectOption('under_review');
  await expect(page.locator('#owner526Findings')).toContainText('No findings match');
  expect((await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key)).findings[0].device).toBe('phone');
  expect((await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),historyKey)).snapshots).toEqual([item('capacity')]);
});
test('manual owner-review handoff is blocked without complete local device observations',async({page})=>{
  await boot(page);await reviewed(page,'observed_local');
  await page.locator('#owner526Device').selectOption('assistive');
  await page.locator('#owner526Disposition').selectOption('owner_review');
  await page.locator('#owner526Add').click();
  await expect(page.locator('#owner526Status')).toContainText('requires all local observations');
  for(const id of ['owner524Reader','owner524Focus','owner524Zoom'])await page.locator('#'+id).check();
  await page.locator('#owner522Start').click();
  const source=page.locator('#owner520Navigation a[href="#owner375Scenarios"]');
  await source.focus();await page.keyboard.press('Enter');
  await page.locator('#owner521Return').focus();await page.keyboard.press('Enter');
  await page.locator('#owner522Review').click();await page.locator('#owner525Review').click();
  await page.locator('#owner526Add').click();
  await expect(page.locator('#owner526Findings')).toContainText('owner review');
  await expect(page.locator('#owner526Status')).toContainText('No owner approval was recorded');
});
test('snapshot comparison records before and after replacement, without mutating prior comparison',async({page})=>{
  await boot(page,{history:JSON.stringify(pack([item('capacity')]))});
  await page.locator('#owner526Compare').click();
  await expect(page.locator('#owner526Status')).toContainText('Inspect a valid version 2');
  await choose(page,[item('reliability')]);
  await page.locator('#owner526Compare').click();
  await expect(page.locator('#owner526Comparisons')).toContainText('DIFFERENCE');
  await page.locator('#owner525Replace').click();
  await choose(page,[item('reliability')]);
  await page.locator('#owner526Compare').click();
  const value=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  expect(value.comparisons).toHaveLength(2);
  expect(value.comparisons[0]).toMatchObject({local:[item('capacity')],inspected:[item('reliability')],different:true});
  expect(value.comparisons[1]).toMatchObject({local:[item('reliability')],inspected:[item('reliability')],different:false});
});
test('invalid persisted triage is isolated until explicit two-press reset',async({page})=>{
  await boot(page,{triage:JSON.stringify({owner:'untrusted',access:'admin'}),
    history:JSON.stringify(pack([item('capacity')]))});
  await expect(page.locator('#owner526Status')).toContainText('invalid');
  await expect(page.locator('#owner526Add')).toBeDisabled();
  await page.locator('#owner526Reset').click();
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).not.toBeNull();
  await page.locator('#owner526Reset').click();
  await expect(page.locator('#owner526Add')).toBeEnabled();
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBeNull();
  expect((await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),historyKey)).snapshots).toEqual([item('capacity')]);
});
test('export is bounded, source-free and does not claim certification or delivery',async({page})=>{
  await boot(page);await expect(page.locator('#owner526Export')).toBeDisabled();
  await reviewed(page);await page.locator('#owner526Device').selectOption('tablet');
  await page.locator('#owner526Add').click();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#owner526Export').click();const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('yard-workers-management-retest-triage-v1.json');
  const raw=readFileSync(await download.path(),'utf8');
  expect(Buffer.byteLength(raw,'utf8')).toBeLessThanOrEqual(4096);
  const packet=JSON.parse(raw);
  expect(Object.keys(packet).sort()).toEqual(['comparisons','findings','format','next_id','schema_version']);
  expect(packet).not.toHaveProperty('owner_approval');
  expect(raw).not.toContain('Sensitive');
  await expect(page.locator('#owner526Status')).toContainText('No owner sign-off');
});
test('queues are bounded to six findings and four comparison entries',async({page})=>{
  await boot(page,{history:JSON.stringify(pack([item('capacity')]))});
  await reviewed(page);await page.locator('#owner526Device').selectOption('desktop');
  for(let i=0;i<8;i++)await page.locator('#owner526Add').click();
  await choose(page,[item('economic')]);
  for(let i=0;i<6;i++)await page.locator('#owner526Compare').click();
  const value=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  expect(value.findings).toHaveLength(6);expect(value.comparisons).toHaveLength(4);
  expect(value.findings[0].id).toBe(3);expect(value.comparisons[0].id).toBe(11);
});

import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const sourceFiles=['js/admin-owner-management-command-ui.js',
  'js/owner-management-workspace-521.js','js/owner-management-portability-522.js',
  'js/owner-management-conflicts-523.js','js/owner-management-history-524.js',
  'js/owner-management-retest-525.js'];
const sources=sourceFiles.map(x=>readFileSync(x,'utf8'));
const styles=['build494-command.css','build521-workspace.css','build522-portability.css',
  'build523-conflicts.css','build524-history.css','build525-retest.css']
  .map(x=>readFileSync(x,'utf8')).join('\n');
const key='yw:management-recovery-history:v2';
const item=(focus='economic',density='compact')=>({version:1,focus,density});
const pack=snapshots=>({format:'yard-workers-management-recovery-history',schema_version:2,snapshots});
async function boot(page,options={}){
  await page.route('https://yw525.test/**',route=>route.fulfill({status:200,contentType:'text/html',
    body:'<!doctype html><html><body><section id="admin"></section></body></html>'}));
  await page.goto('https://yw525.test/');await page.addStyleTag({content:styles});
  await page.evaluate(({history,visibility})=>{
    if(history!==undefined)localStorage.setItem('yw:management-recovery-history:v2',history);
    window.YWIAPI={loadAdminDirectory:async()=>({ok:true,source_visibility:{jobs:true,
      finance:true,admin:true,safety:false,...visibility},source_freshness:{},owner_jobs:[]})};
  },options);
  for(const source of sources)await page.addScriptTag({content:source});
  await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
  await expect(page.locator('#owner525Retest')).toHaveCount(1);
}
async function choose(page,values){
  await page.locator('#owner524File').setInputFiles({name:'history.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(pack(values)))});
  await expect(page.locator('#owner525Incoming')).toContainText(values[0].focus);
}
test('conflicting append is guarded until explicit decision; keep preserves local history',async({page})=>{
  const local=pack([item('capacity')]);await boot(page,{history:JSON.stringify(local)});
  await choose(page,[item('reliability')]);
  await expect(page.locator('#owner525ConflictStatus')).toContainText('DIFFERENCE FOUND');
  await page.locator('#owner524Merge').click();
  await expect(page.locator('#owner525ConflictStatus')).toContainText('Append paused');
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key)).toEqual(local);
  await page.locator('#owner525Keep').click();
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key)).toEqual(local);
  await expect(page.locator('#owner525Append')).toBeDisabled();
});
test('explicit append warns about displacement and can undo to previous history',async({page})=>{
  const original=[item('all','comfortable'),item('economic'),item('capacity'),item('reliability')];
  await boot(page,{history:JSON.stringify(pack(original))});
  await choose(page,[item('all','compact'),item('economic','comfortable')]);
  await page.locator('#owner525Append').click();
  let history=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  expect(history.snapshots).toEqual([...original.slice(1),item('all','compact'),item('economic','comfortable')]);
  await page.locator('#owner525Undo').click();
  history=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  expect(history.snapshots).toEqual(original);
});
test('explicit replace and undo restore v2 local model without touching v1 source',async({page})=>{
  const before=[item('capacity')],after=[item('reliability')];
  await boot(page,{history:JSON.stringify(pack(before))});
  await choose(page,after);
  await page.locator('#owner525Replace').click();
  expect((await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key)).snapshots).toEqual(after);
  await expect(page.locator('#owner524Select option')).toHaveCount(1);
  await expect(page.locator('#owner524Select option')).toContainText('reliability');
  await page.locator('#owner525Undo').click();
  expect((await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key)).snapshots).toEqual(before);
});
test('rejects invalid and oversized histories before any conflict choice',async({page})=>{
  await boot(page,{history:JSON.stringify(pack([item('capacity')]))});
  await page.locator('#owner524File').setInputFiles({name:'huge.json',mimeType:'application/json',
    buffer:Buffer.from('x'.repeat(1200))});
  await expect(page.locator('#owner525ConflictStatus')).toContainText('exceeds 1 KB');
  await expect(page.locator('#owner525Replace')).toBeDisabled();
  await page.locator('#owner524File').setInputFiles({name:'unsafe.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({...pack([item('reliability')]),tenant:'should-not-import'}))});
  await expect(page.locator('#owner525ConflictStatus')).toContainText('Invalid or unsupported');
  expect((await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key)).snapshots).toEqual([item('capacity')]);
});
test('retest finding exports bounded local JSON without source data or owner sign-off',async({page})=>{
  await boot(page);await expect(page.locator('#owner525Export')).toBeDisabled();
  await page.locator('#owner525Category').selectOption('screen_reader');
  await page.locator('#owner525Outcome').selectOption('follow_up');
  await page.locator('#owner525Notes').fill('Status announcement needs a manual device retest.');
  await page.locator('#owner525Review').click();
  await expect(page.locator('#owner525FindingStatus')).toContainText('RETEST FOLLOW-UP REQUIRED');
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#owner525Export').click();const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('yard-workers-accessibility-finding-draft.json');
  const draft=JSON.parse(readFileSync(await download.path(),'utf8'));
  expect(draft.format).toBe('yw-management-accessibility-finding-draft');
  expect(draft.schema_version).toBe(1);expect(draft.category).toBe('screen_reader');
  expect(draft.outcome).toBe('follow_up');
  expect(Object.keys(draft).sort()).toEqual(['category','format','note','observations','outcome','schema_version']);
  expect(draft).not.toHaveProperty('owner_approval');
  await expect(page.locator('#owner525FindingStatus')).toContainText('No external delivery');
});
test('finding edits invalidate preview, and local retest never certifies approval',async({page})=>{
  await boot(page);
  await page.locator('#owner522Start').click();
  const source=page.locator('#owner520Navigation a[href="#owner375Scenarios"]');
  await source.focus();await page.keyboard.press('Enter');
  await page.locator('#owner521Return').focus();await page.keyboard.press('Enter');
  await page.locator('#owner522Review').click();
  for(const id of ['owner524Reader','owner524Focus','owner524Zoom'])await page.locator('#'+id).check();
  await page.locator('#owner525Outcome').selectOption('observed_local');
  await page.locator('#owner525Review').click();
  await expect(page.locator('#owner525FindingStatus')).toContainText('LOCAL RETEST OBSERVED');
  await expect(page.locator('#owner525FindingStatus')).toContainText('independent manual owner acceptance');
  await page.locator('#owner524Reader').uncheck();
  await expect(page.locator('#owner525Export')).toBeDisabled();
  await page.locator('#owner525Review').click();
  await expect(page.locator('#owner525FindingStatus')).toContainText('RETEST FOLLOW-UP REQUIRED');
});

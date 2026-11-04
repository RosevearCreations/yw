import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const owner=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const extension=readFileSync('js/owner-management-workspace-521.js','utf8');
const css=readFileSync('build521-workspace.css','utf8')+'\n'+readFileSync('build494-command.css','utf8');
const fixture=visibility=>({ok:true,source_visibility:{jobs:true,finance:true,admin:true,safety:false,...visibility},
  source_freshness:{},owner_jobs:[]});
async function boot(page,visibility={}){
  await page.route('https://yw521.test/**',route=>route.fulfill({status:200,contentType:'text/html',
    body:'<!doctype html><html><body><section id="admin"></section></body></html>'}));
  await page.goto('https://yw521.test/');
  await page.addStyleTag({content:css});
  await page.evaluate(data=>{window.__fixture=data;window.YWIAPI={loadAdminDirectory:async()=>window.__fixture};},fixture(visibility));
  await page.addScriptTag({content:owner});await page.addScriptTag({content:extension});
  await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
  await expect(page.locator('#owner521Workspace')).toHaveCount(1);
}
test('saves only a bounded display preference and restores it on remount',async({page})=>{
  await boot(page);
  await page.locator('#owner521Area').selectOption('capacity');
  await page.locator('#owner521Density').selectOption('compact');
  await expect(page.locator('#owner520Focus')).toHaveValue('capacity');
  await page.locator('#owner521Save').click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('yw:management-workspace-display:v521'))))
    .toEqual({version:1,focus:'capacity',density:'compact'});
  await page.evaluate(()=>document.getElementById('ownerCommand350').remove());
  await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
  await expect(page.locator('#owner521Area')).toHaveValue('capacity');
  await expect(page.locator('.owner520-navigation')).toHaveClass(/yw521-compact/);
  await expect(page.locator('#owner521Status')).toContainText('restored from this device');
});
test('invalid local data fails to safe defaults and reset clears the setting',async({page})=>{
  await boot(page);
  await page.evaluate(()=>localStorage.setItem('yw:management-workspace-display:v521',
    JSON.stringify({version:1,focus:'unknown',density:'compact',ownerApproval:true})));
  await page.evaluate(()=>document.getElementById('ownerCommand350').remove());
  await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
  await expect(page.locator('#owner521Area')).toHaveValue('all');
  await expect(page.locator('#owner521Status')).toContainText('invalid');
  await page.locator('#owner521Reset').click();
  expect(await page.evaluate(()=>localStorage.getItem('yw:management-workspace-display:v521'))).toBeNull();
});
test('source drill-through moves keyboard focus and returns without changing evidence',async({page})=>{
  await boot(page);
  const jump=page.locator('#owner520Navigation a[href="#owner375Scenarios"]');
  await jump.click();
  await expect(page.locator('#owner375Scenarios')).toBeFocused();
  await page.locator('#owner521Return').click();
  await expect(jump).toBeFocused();
  await expect(page.locator('#owner521Status')).toContainText('not changed');
});
test('permission loss removes source jumps, but display controls remain safe',async({page})=>{
  await boot(page,{jobs:false,finance:false});
  await expect(page.locator('#owner520Navigation [data-owner520-lane]')).toHaveCount(0);
  await page.locator('#owner521Open').click();
  await expect(page.locator('#owner521Status')).toContainText('No permitted source link');
  await expect(page.locator('#owner521Return')).toBeDisabled();
});
test('mobile layout keeps usable focus rings and no horizontal overflow',async({page})=>{
  await boot(page);await page.setViewportSize({width:390,height:844});
  const save=page.locator('#owner521Save');await save.focus();await expect(save).toBeFocused();
  expect(await save.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
    .toBeLessThanOrEqual(1);
});

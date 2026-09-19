import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const jobsSource=fs.readFileSync(path.join(process.cwd(),'js/jobs-ui.js'),'utf8');

async function mount(page,{canManage=true}={}){
  await page.route('https://export317.test/**',async(route)=>{
    await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><head></head><body><section id="jobs"></section><section id="equipment"></section></body></html>'});
  });
  await page.goto('https://export317.test/');
  await page.evaluate(({canManage})=>{
    window.__export317Calls=[];
    window.__opened=[];
    window.prompt=()=> 'September 2026 Accountant Close Package';
    window.open=(url)=>{window.__opened.push(url); return {};};
    window.__jobs317Api={
      async fetchJobsDirectory(){
        return {
          jobs:[],equipment:[],requirements:[],profiles:[],pools:[],
          month_end_close_workbench:[{
            id:'31700000-0000-4000-8000-000000000001',
            period_code:'2026-09',
            period_start:'2026-09-01',
            period_end:'2026-09-30',
            close_status:'in_review',
            period_lock_status:'soft_locked'
          }]
        };
      },
      async accountantExport(payload){
        window.__export317Calls.push(JSON.parse(JSON.stringify(payload)));
        return {
          ok:true,
          build:317,
          package_version:2,
          export:{id:'31700000-0000-4000-8000-000000000002'},
          manifest:{files:[
            {filename:'trial-balance-through-period-end.csv'},
            {filename:'gl-detail-period.csv'},
            {filename:'unresolved-reconciliation-exceptions.csv'}
          ]},
          download_url:'https://signed.example.invalid/accountant-package.zip',
          posting_execution_authorized:false,
          provider_mutation:false,
          jobs_writeback:false
        };
      },
      async manageAdminEntity(){throw new Error('Unexpected admin mutation in Build 317 package test');},
      async manageJobsEntity(){throw new Error('Unexpected Jobs mutation in Build 317 package test');}
    };
    window.__jobs317Access=()=>({canManageJobs:canManage,canManageAdminDirectory:canManage});
  },{canManage});
  await page.addScriptTag({content:jobsSource});
  await page.evaluate(async()=>{
    const ui=window.YWIJobsUI.create({
      api:window.__jobs317Api,
      getAccessProfile:window.__jobs317Access,
      getCurrentRole:()=> 'admin'
    });
    await ui.init();
  });
}

test('Build 317 generates the selected month-end private accountant package through the existing Edge boundary',async({page})=>{
  await mount(page);
  const button=page.getByRole('button',{name:'Generate Accountant Package v2'});
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.click();

  await expect.poll(async()=>page.evaluate(()=>window.__export317Calls.length)).toBe(1);
  const call=await page.evaluate(()=>window.__export317Calls[0]);
  expect(call).toEqual({
    action:'prepare_v2',
    period_close_id:'31700000-0000-4000-8000-000000000001',
    period_start:'2026-09-01',
    period_end:'2026-09-30',
    export_title:'September 2026 Accountant Close Package'
  });
  expect(call).not.toHaveProperty('posting_execution_authorized');
  expect(call).not.toHaveProperty('provider_mutation');

  await expect.poll(async()=>page.evaluate(()=>window.__opened[0]||'')).toBe('https://signed.example.invalid/accountant-package.zip');
  await expect(page.locator('#job_commercial_summary')).toContainText('Build 317 accountant package v2 generated');
  await expect(page.locator('#job_commercial_summary')).toContainText('3 data file(s)');
  await expect(page.locator('#job_commercial_summary')).toContainText('Private signed download opened');
});

test('Build 317 package control stays locked when Jobs/Admin management access is absent',async({page})=>{
  await mount(page,{canManage:false});
  await expect(page.getByRole('button',{name:'Generate Accountant Package v2'})).toBeDisabled();
  expect(await page.evaluate(()=>window.__export317Calls.length)).toBe(0);
});

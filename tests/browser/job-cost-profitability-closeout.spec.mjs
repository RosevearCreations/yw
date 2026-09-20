import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const jobsSource=fs.readFileSync(path.join(process.cwd(),'js/jobs-ui.js'),'utf8');

async function mount(page,{financeRows=true}={}){
  await page.route('https://profit318.test/**',async(route)=>{
    await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><head></head><body><section id="jobs"></section><section id="equipment"></section></body></html>'});
  });
  await page.goto('https://profit318.test/');
  await page.evaluate(({financeRows})=>{
    window.__jobs318Api={
      async fetchJobsDirectory(){
        return {
          jobs:[{id:318,job_code:'JOB-LAND-318',job_name:'Spring cleanup',client_name:'Maple Property',service_pattern:'seasonal_cleanup',quoted_charge_total:1800,estimated_cost_total:1050}],
          equipment:[],requirements:[],profiles:[],pools:[],
          job_profitability_closeout: financeRows ? [{
            build:318,
            job_id:318,
            job_code:'JOB-LAND-318',
            job_name:'Spring cleanup',
            client_name:'Maple Property',
            service_pattern:'seasonal_cleanup',
            closeout_status:'collection_open',
            estimated_revenue_total:1800,
            estimated_cost_total:1050,
            estimated_profit_total:750,
            actual_revenue_total:1925,
            invoiced_total:1925,
            collected_total:1500,
            outstanding_invoiced_total:425,
            labour_cost_total:540,
            material_cost_total:210,
            equipment_cost_total:145,
            fuel_cost_total:65,
            travel_cost_total:40,
            subcontract_cost_total:120,
            disposal_cost_total:85,
            rework_cost_total:35,
            other_cost_total:10,
            actual_cost_total:1250,
            actual_profit_total:675,
            actual_margin_percent:35.06,
            revenue_variance_total:125,
            cost_variance_total:200,
            profit_variance_total:-75,
            source_provenance:{
              labour_entry_count:4,
              financial_event_count:8,
              submitted_execution_proof_count:3,
              approved_execution_proof_count:2,
              posted_invoice_count:1,
              payment_application_count:2
            },
            internal_only:true,
            posting_execution_authorized:false,
            provider_mutation:false
          }] : []
        };
      },
      async manageJobsEntity(){throw new Error('Unexpected Jobs mutation in Build 318 profitability test');},
      async manageAdminEntity(){throw new Error('Unexpected Finance/Admin mutation in Build 318 profitability test');}
    };
    window.__jobs318Access=()=>({canManageJobs:true,canManageAdminDirectory:true});
  },{financeRows});
  await page.addScriptTag({content:jobsSource});
  await page.evaluate(async()=>{
    const ui=window.YWIJobsUI.create({
      api:window.__jobs318Api,
      getAccessProfile:window.__jobs318Access,
      getCurrentRole:()=> 'admin'
    });
    await ui.init();
  });
}

test('Build 318 renders landscaping profitability closeout only from Finance-authorized directory data',async({page})=>{
  await mount(page,{financeRows:true});
  const table=page.locator('#job_profitability_closeout_table');
  await expect(table).toBeVisible();
  await expect(table).toContainText('JOB-LAND-318');
  await expect(table).toContainText('collection_open');
  await expect(table).toContainText('Quote $1800.00');
  await expect(table).toContainText('Actual $1925.00');
  await expect(table).toContainText('Invoiced $1925.00');
  await expect(table).toContainText('Collected $1500.00');
  await expect(table).toContainText('Equipment $145.00');
  await expect(table).toContainText('Fuel $65.00');
  await expect(table).toContainText('Travel $40.00');
  await expect(table).toContainText('Disposal $85.00');
  await expect(table).toContainText('Subcontract $120.00');
  await expect(table).toContainText('Rework $35.00');
  await expect(table).toContainText('Profit $675.00');
  await expect(table).toContainText('Margin 35.06%');
  await expect(table).toContainText('4 labour');
  await expect(table).toContainText('8 cost events');
  await expect(table).toContainText('2 approved proof');
  await expect(table).toContainText('1 invoice');
  await expect(table).toContainText('2 payment app');
  await expect(table).toContainText('Internal only');
});

test('Build 318 profitability closeout fails closed when Finance-authorized rows are absent',async({page})=>{
  await mount(page,{financeRows:false});
  const table=page.locator('#job_profitability_closeout_table');
  await expect(table).toBeVisible();
  await expect(table).toContainText('No Finance-authorized Build 318 profitability closeout rows');
  await expect(table).not.toContainText('Profit $675.00');
});

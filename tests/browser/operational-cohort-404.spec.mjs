import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/admin-owner-management-command-ui.js','utf8');
const cohorts={
 state:'measured',reason:'Complete canonical reads',lookback_days:90,minimum_sample:10,
 generated_at:new Date().toISOString(),
 stages:[
  {name:'Customer intake',count:15},
  {name:'First-job dispatch',count:13},
  {name:'Production session',count:11},
  {name:'Approved closeout',count:9},
  {name:'Invoice',count:8}
 ],
 conversions:[
  {from:'Customer intake',to:'First-job dispatch',numerator:13,denominator:15,rate:86.7,state:'measured'},
  {from:'First-job dispatch',to:'Production session',numerator:11,denominator:13,rate:84.6,state:'measured'},
  {from:'Production session',to:'Approved closeout',numerator:9,denominator:11,rate:81.8,state:'measured'},
  {from:'Approved closeout',to:'Invoice',numerator:8,denominator:9,rate:null,state:'withheld_small_sample'}
 ]
};
const response=(cohort=cohorts)=>({
 ok:true,source_visibility:{jobs:true,finance:true,admin:false,safety:false},
 source_freshness:{},management_metric_confidence:{},first_operational_cohort_404:cohort
});
async function boot(page,data){
 await page.setViewportSize({width:390,height:850});
 await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(payload=>{window.__calls=0;window.YWIAPI={loadAdminDirectory:async()=>{window.__calls++;return payload;}};},data);
 await page.addScriptTag({content:source});
 await page.evaluate(()=>window.YWIOwnerManagementCommandUI.mount({api:window.YWIAPI}));
 await expect(page.locator('#owner404FirstCohort')).not.toBeEmpty();
}
test('Build 404 renders authorized canonical first-job transitions and withholds small denominators on phone',async({page})=>{
 await boot(page,response());
 const h=page.locator('#owner404FirstCohort');
 await expect(h).toContainText('Customer intake');
 await expect(h).toContainText('15');
 await expect(h).toContainText('86.7%');
 await expect(h).toContainText('Rate withheld');
 await expect(h.locator('[data-owner404-stage]')).toHaveCount(4);
 await expect(h.locator('input,select,textarea,button')).toHaveCount(0);
 await expect(page.locator('a[href="/help.html#first-operational-cohort-404"]')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 expect(await page.evaluate(()=>window.__calls)).toBe(1);
});
test('Build 404 never exposes cohort metrics when canonical source is withheld',async({page})=>{
 await boot(page,response({state:'withheld',reason:'Capped Finance read',stages:[],conversions:[]}));
 const h=page.locator('#owner404FirstCohort');
 await expect(h.locator('[data-owner404-state="withheld"]')).toContainText('Capped Finance read');
 await expect(h.locator('[data-owner404-stage]')).toHaveCount(0);
});
test('Build 404 requires combined Jobs and Finance visibility for any counts',async({page})=>{
 const data=response();data.source_visibility.finance=false;
 await boot(page,data);
 await expect(page.locator('[data-owner404-state="permission_hidden"]')).toContainText('Jobs and Finance view permissions');
 await expect(page.locator('[data-owner404-stage]')).toHaveCount(0);
});

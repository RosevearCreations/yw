import {test,expect} from '@playwright/test';import fs from 'node:fs';
const script=fs.readFileSync('js/seasonal-first-use-cohort-coverage-415.js','utf8');
const now=()=>new Date().toISOString();
const row=(patch={})=>({season_year:2026,season_context:'winter',
 service_context:'snow_clearing_removal',cycle_id:'winter-cycle',
 first_use_denominator:3,first_use_date_min:now(),first_use_date_max:now(),
 coverage_state:'sample_supported',minimum_sample:3,...patch});
const answer=(patch={})=>({ok:true,scope:'seasonal_first_use_cohort_coverage',
 coverage_415:{state:'recorded',complete:true,retrieved_at:now(),minimum_sample:3,cohorts:[row()],...patch}});
async function boot(page,data){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><body><section id="admin"></section></body></html>');
 await page.evaluate(v=>{window.__writes=0;window.YWIAPI={
 loadAdminDirectory:async({scope})=>{if(scope!=='seasonal_first_use_cohort_coverage')throw Error('Wrong scope');return structuredClone(v);},
 manageAdminEntity:()=>{window.__writes++;throw Error('Forbidden')}};},data);
 await page.addScriptTag({content:script});
 await page.locator('#seasonal415 summary').click();
 await page.locator('#seasonal415Recheck').click();
}
test('verified winter first-use cohort has dated sample count but no staff metrics',async({page})=>{
 await boot(page,answer());
 const e=page.locator('[data-seasonal415-state="supported"]');
 await expect(e).toContainText('Winter · 2026');
 await expect(e).toContainText('Verified first-use sample denominator: 3');
 await expect(e).toContainText('snow_clearing_removal');
 expect(await page.evaluate(()=>window.__writes)).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
test('under minimum, linkage gap and missing season report withheld not zero',async({page})=>{
 await boot(page,answer({cohorts:[
 row({season_context:'spring_summer',service_context:'mowing_landscaping',coverage_state:'insufficient_sample',first_use_denominator:null}),
 row({season_context:'fall',service_context:'fall_cleanup',coverage_state:'linkage_gap_withheld',first_use_denominator:null}),
 row({season_context:'four_season',service_context:'general_outdoor',coverage_state:'insufficient_sample',first_use_denominator:null})
 ]}));
 await expect(page.locator('[data-seasonal415-state="held"]')).toHaveCount(3);
 await expect(page.locator('[data-seasonal415-state="supported"]')).toHaveCount(0);
 await expect(page.locator('[data-seasonal415-state="held"]').first()).toContainText('WITHHELD');
});
test('stale, capped and no-record source do not infer zero',async({page})=>{
 await boot(page,answer({state:'withheld',complete:false,cohorts:[],reason:'capped'}));
 await expect(page.locator('[data-seasonal415-state="withheld"]')).toBeVisible();
 await page.evaluate(v=>window.YWIAPI.loadAdminDirectory=async()=>structuredClone(v),answer({retrieved_at:'2026-01-01T00:00:00Z'}));
 await page.locator('#seasonal415Recheck').click();
 await expect(page.locator('[data-seasonal415-state="withheld"]')).toBeVisible();
 await page.evaluate(v=>window.YWIAPI.loadAdminDirectory=async()=>structuredClone(v),answer({state:'no_record',cohorts:[]}));
 await page.locator('#seasonal415Recheck').click();
 await expect(page.locator('[data-seasonal415-state="no_record"]')).toBeVisible();
});
test('untrusted seasonal service fields are escaped',async({page})=>{
 await boot(page,answer({cohorts:[row({service_context:'<img src=x onerror=alert(1)>'})]}));
 await expect(page.locator('[data-seasonal415-state="supported"]')).toContainText('<img src=x onerror=alert(1)>');
 await expect(page.locator('[data-seasonal415-state="supported"] img')).toHaveCount(0);
});

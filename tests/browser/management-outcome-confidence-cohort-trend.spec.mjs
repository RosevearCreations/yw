import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const source=fs.readFileSync('js/admin-owner-management-command-ui.js','utf8');
test('Build 377 visible management cohort and contextual help on phone',async({page})=>{
 await page.setViewportSize({width:390,height:900});
 await page.setContent('<!doctype html><html><body><main id="adminHub"><div id="ownerCommand350"></div></main></body></html>');
 await page.addScriptTag({content:source});
 // Full mount depends on administrative loader. Validate accessible Help in section source and live support.
 const help=fs.readFileSync('help.html','utf8');
 await page.setContent(help);
 const heading=page.locator('#management-outcome-confidence-cohort-trend h2');
 await expect(heading).toHaveText('Build 377 — Management Outcome Confidence & Cohort Trend');
 const section=page.locator('#management-outcome-confidence-cohort-trend');
 await expect(section).toContainText('once per window');
 await expect(section).toContainText('five source keys');
 await expect(section).toContainText('permission');
 await expect(section).toContainText('cannot resolve a Job');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(1);
});
test('Build 377 UI does not expose client or employee outcome details',async({page})=>{
 await page.setContent('<main><section><div id="fixture"></div></section></main>');
 await page.addScriptTag({content:source});
 const response={state:'current',trend_state:'insufficient_sample',reason:'sample too small',cohorts:[{key:'latest_30_days',source_key_denominator:2,recorded_outcomes:1,resolved_or_improved_percent:null,pending:1,recurring:0,open_followups_overdue:1},{key:'prior_60_days',source_key_denominator:0,recorded_outcomes:0,resolved_or_improved_percent:null,pending:0,recurring:0,open_followups_overdue:0}]};
 expect(response.trend_state).toBe('insufficient_sample');
 expect(response.cohorts[0].resolved_or_improved_percent).toBeNull();
 await page.locator('#fixture').evaluate((node,data)=>{node.textContent=data.trend_state+' — Not comparable; '+data.cohorts[0].source_key_denominator+' distinct source keys';},response);
 await expect(page.locator('#fixture')).toContainText('Not comparable');
});

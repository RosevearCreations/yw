import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const script=readFileSync('js/yw601-predictive-assurance.js','utf8');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
for(const width of [390,768,1200])test('private signed evidence panel and reviewer authority at '+width,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.setContent('<main id="jobs"></main>');
 await page.evaluate(({owner,company})=>{
  window.__calls=[];window.__reviewer=false;window.__signedIn=true;
  window.YWI_AUTH={getState:()=>({isAuthenticated:window.__signedIn,user:{id:owner}})};
  window.YWI_SB={auth:{getUser:async()=>({data:{user:{id:owner}}})},functions:{invoke:async(name,{body})=>{
   window.__calls.push({name,body});
   if(body.action==='review-resumed')return {data:{state:'RESUMED_SIGNED_OBSERVATIONS_INDEPENDENTLY_REVERIFIED',independentReadback:true}};
   return {data:{state:'TENANT_EVIDENCE_ASSESSMENT',reviewerReadbackAvailable:window.__reviewer,assessments:[{state:'RISK_FRESHNESS_DEGRADING',sampleCount:4,ageMinutes:20,confidence:'LIMITED_OBSERVATIONS'}]}};
  }}};
 },{owner:id(1),company:id(2)});
 await page.addScriptTag({content:script});
 await page.locator('#yw601Panel summary').click();await page.locator('#yw601Company').fill(id(2));
 await page.locator('#yw601Load').click();
 await expect(page.locator('#yw601Result')).toContainText('Signed evidence becoming stale');
 await expect(page.locator('#yw601Review')).toBeDisabled();
 await page.evaluate(()=>{window.__reviewer=true;});
 await page.locator('#yw601Load').click();
 await expect(page.locator('#yw601Review')).toBeEnabled();
 await page.locator('#yw601Alert').fill(id(3));await page.locator('#yw601Enrollment').fill(id(4));await page.locator('#yw601Review').click();
 await expect(page.locator('#yw601Status')).toContainText('not physical recovery proof');
 expect(await page.evaluate(()=>window.__calls.at(-1).body)).toMatchObject({action:'review-resumed',companyId:id(2),alertId:id(3),enrollmentId:id(4)});
 await page.evaluate(()=>{window.__signedIn=false;document.dispatchEvent(new Event('ywi:auth-changed'));});
 await expect(page.locator('#yw601Review')).toBeDisabled();
 await expect(page.locator('#yw601Result')).toBeEmpty();
 await expect(page.locator('#yw601Alert')).toHaveValue('');
});

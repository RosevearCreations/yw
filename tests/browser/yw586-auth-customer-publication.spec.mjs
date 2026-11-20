import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const html=read('public/customer-account.html')
 .replace(/<script[^>]*><\/script>/g,'')
 .replace(/<link rel="stylesheet"[^>]*\/>/g,'')
 .replace(/<link rel="icon"[^>]*\/>/g,'');
const css=read('public/customer-585.css')+'\n'+read('public/customer-account-586.css');
const js=read('public/customer-account-586.js');
const actor='a3000000-0000-4000-8000-000000000001',
 company='a0000000-0000-4000-8000-000000000001',
 client='a1000000-0000-4000-8000-000000000001';
const member={company_id:company,client_id:client,customer_user_id:actor,membership_state:'active'};
async function mount(page,{enabled=false,foreign=false}={}){
 await page.setContent(html);
 await page.addStyleTag({content:css});
 await page.evaluate(({actor,company,client,member,enabled,foreign})=>{
  window.YWI_RUNTIME_CONFIG={SB_URL:'https://fixtures.supabase.co',SB_ANON_KEY:'synthetic-public-anon-only'};
  window.__calls=[];window.__signedOut=0;
  const scope={scope:'original_customer_company_only',company_id:foreign?'b0000000-0000-4000-8000-000000000002':company,
    client_id:client,company_name:'Verified Landscaping Original',
    service_count_enabled:0,captured_at:new Date().toISOString(),
    can_view_work_orders:false,can_view_photos:false,can_submit_booking:false,
    can_charge_account:false,can_change_company_settings:false,
    public_site_published:false,owner_or_sysop_authority:false};
  const sb={
   auth:{
    signInWithPassword:async({email,password})=>{
     window.__calls.push('auth.signInWithPassword');
     return{data:{user:{id:actor}},error:null};
    },
    getUser:async()=>{window.__calls.push('auth.getUser');return{data:{user:{id:actor}},error:null}},
    signOut:async()=>{window.__signedOut++;return{error:null}}
   },
   from:table=>{
    window.__calls.push('from:'+table);
    const q={select(){return q},eq(){return q},limit:async()=>({
     data:enabled?[member]:[],error:null})};
    return q;
   },
   rpc:async(name,args)=>{
    window.__calls.push('rpc:'+name);
    return{data:scope,error:null};
   }
  };
  window.supabase={createClient:()=>sb};
 },{actor,company,client,member,enabled,foreign});
 await page.addScriptTag({content:js});
}
for(const width of [390,768,1440]){
 test('YW586 private account denies unapproved original customer at '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:860});
  await mount(page,{enabled:false});
  await page.locator('#yw586-email').fill('customer@example.com');
  await page.locator('#yw586-password').fill('synthetic_test_password');
  await page.getByRole('button',{name:'Verify my account'}).click();
  await expect(page.locator('#yw586-account-status')).toContainText('HOLD');
  await expect(page.locator('#yw586-company-list')).not.toContainText('Verified Landscaping Original');
  const calls=await page.evaluate(()=>window.__calls);
  expect(calls).not.toContain('from:work_orders');
  expect(calls).not.toContain('from:photos');
  expect(calls).not.toContain('from:invoices');
  expect(calls).not.toContain('storage');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/);
 });
}
test('YW586 verified original member reveals company label only, never jobs/photos/payments',async({page})=>{
 await mount(page,{enabled:true});
 await page.locator('#yw586-email').fill('already@example.com');
 await page.locator('#yw586-password').fill('synthetic_test_password');
 await page.getByRole('button',{name:'Verify my account'}).click();
 await expect(page.locator('#yw586-company-list')).toContainText('Verified Landscaping Original');
 await expect(page.locator('#yw586-account-status')).toContainText('Read-only company scope');
 const calls=await page.evaluate(()=>window.__calls);
 expect(calls).toContain('rpc:ywi_585_customer_portal_scope');
 expect(calls).not.toContain('from:work_orders');
 expect(calls).not.toContain('from:photos');
 expect(calls).not.toContain('from:invoices');
 await page.getByRole('button',{name:'Clear session'}).click();
 await expect(page.locator('#yw586-company-list')).not.toContainText('Verified Landscaping Original');
});
test('YW586 forged company scope is withheld after successful login',async({page})=>{
 await mount(page,{enabled:true,foreign:true});
 await page.locator('#yw586-email').fill('already@example.com');
 await page.locator('#yw586-password').fill('synthetic_test_password');
 await page.getByRole('button',{name:'Verify my account'}).click();
 await expect(page.locator('#yw586-account-status')).toContainText('HOLD');
 await expect(page.locator('#yw586-company-list')).not.toContainText('Verified Landscaping Original');
});
test('YW586 owner preview opens only after true original owner-bound draft and cannot publish',async({page})=>{
 const owner='c0000000-0000-4000-8000-000000000001';
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="yw584SiteRecords"></section></body></html>');
 await page.evaluate(({owner,company})=>{
  document.documentElement.dataset.ywSurface='company';
  window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:owner}})};
  window.YW579Navigation={snapshot:()=>({verified:true,companyId:company})};
  window.YW584CompanySupport={snapshot:()=>({state:'OWNER_STAGED_PRIVATE_DRAFTS',companyId:company})};
  window.YWIDualWorkspace={snapshot:()=>({ownedCompanies:1})};
  window.TextEncoder=TextEncoder;
  // The browser fixture is not a live certificate or a trust anchor.
  Object.defineProperty(window,'crypto',{configurable:true,value:{subtle:{digest:async()=>new Uint8Array(32).fill(165).buffer}}});
  const row={company_id:company,site_slug:'verified-landscape',display_name:'Owner Private Landscaping',
   headline:'Verified original site draft preview',
   public_description:'Owner-protected local landscaping company homepage concept with no public publishing',
   theme_name:'forest',publication_state:'draft',updated_at:new Date().toISOString()};
  const sb={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},
   from:table=>{
    const q={select(){return q},eq(){return q},limit:async()=>({data:table==='ywi_companies'?
     [{id:company,owner_user_id:owner}]:[row],error:null})};return q;}};
  window.YWI_SB=sb;
 },{owner,company});
 await page.addStyleTag({content:read('theme-publication-586.css')});
 await page.addScriptTag({content:read('js/yw586-website-publication-preview.js')});
 await page.locator('#yw586SiteReview summary').click();
 await page.getByRole('button',{name:'Load verified private site preview'}).click();
 await expect(page.locator('#yw586PreviewBody')).toContainText('Owner Private Landscaping');
 await expect(page.locator('#yw586PreviewBody')).toContainText('NOT PUBLISHED');
 await expect(page.locator('#yw586PreviewBody')).toContainText('SHA-256 review digest');
 await page.locator('[data-yw586-check]').check();
 await page.getByRole('button',{name:'Check local review readiness'}).click();
 await expect(page.locator('#yw586PreviewStatus')).toContainText('STILL PRIVATE');
 await page.evaluate(()=>document.dispatchEvent(new Event('ywi:auth-changed')));
 await expect(page.locator('#yw586PreviewBody')).toBeEmpty();
});

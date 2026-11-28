import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
for(const width of [390,768,1440]){
 test('YW602 scoped property map and payer decision '+width,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.setContent('<style>'+read('theme-yw602.css')+'</style><main class="yw602-customer-page"><section id="portal"></section></main>');
  await page.evaluate(({actor,company,site,zone,job,req})=>{
   window.fixture={actor,company,site,zone,job,req,role:'resident',calls:[],state:'awaiting_payer_approval'};
   window.sb={auth:{getUser:async()=>({data:{user:{id:actor}}})},rpc:async(name,{p_action,p_payload})=>{
    const f=window.fixture;f.calls.push({name,p_action,p_payload});
    if(p_action==='list')return {data:{state:'authorized_properties',properties:[{company_id:company,site_id:site,company_name:'Fixture company',site_name:'Fixture property',access_role:f.role}]}};
    if(p_action==='overview')return {data:{state:'property_overview',company_id:company,site_id:site,access_role:f.role,billing_performed:false,zones:[{id:zone,zone_name:'North bed',x:100,y:200,w:4000,h:2000,revision:1}],work_orders:[{id:job,work_order_number:'FIX-1',status:'scheduled'}],changes:[{id:req,zone_id:zone,description:'Mulch north bed',version:2,scope:'Supply and spread mulch',quantity:2,unit:'yards',total_cents:f.role==='payer'?7000:null,state:f.state}]}};
    if(p_action==='decide'&&f.role==='payer'){f.state='customer_accepted';return {data:{state:'decision_saved'}};}
    return {error:{message:'denied'}};
   }};
  },{actor:id(1),company:id(10),site:id(20),zone:id(40),job:id(50),req:id(60)});
  await page.addScriptTag({content:read('js/yw602-property-portal.js')});
  await page.evaluate(()=>{window.portal=window.YW602PropertyPortal.mount(document.querySelector('#portal'),{getClient:()=>window.sb});});
  await page.getByRole('button',{name:'Refresh authorized properties'}).click();
  await page.locator('select[name=property]').selectOption(id(10)+':'+id(20));
  await expect(page.getByRole('button',{name:/North bed ·/})).toBeVisible();
  await page.getByRole('button',{name:/North bed ·/}).click();
  await expect(page.locator('select[name=zone]')).toHaveValue(id(40));
  await expect(page.getByRole('button',{name:'Accept this quote'})).toHaveCount(0);
  await expect(page.locator('#portal')).not.toContainText('$70.00');
  await page.evaluate(()=>{window.fixture.role='payer';});
  await page.getByRole('button',{name:'Refresh authorized properties'}).click();
  await page.locator('select[name=property]').selectOption(id(10)+':'+id(20));
  await expect(page.getByRole('button',{name:'Accept this quote'})).toBeVisible();
  await expect(page.locator('#portal')).toContainText('$70.00');
  await page.getByLabel('I have reviewed this exact version and total.').check();
  await page.getByRole('button',{name:'Accept this quote'}).click();
  await expect(page.locator('#portal')).toContainText('Payer accepted · scope handoff pending');
  expect(await page.evaluate(()=>window.fixture.calls.filter(x=>x.p_action==='decide').map(x=>x.p_payload.version))).toEqual([2]);
  await page.evaluate(()=>window.portal.reset());
  await expect(page.locator('#portal')).not.toContainText('Mulch north bed');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 });
}
test('YW602 explicit Shell exit guards direct company-module routes',async({page})=>{
 await page.setContent('<main><section id="today" class="card">Jobs</section><section id="company" class="card">Company</section><section id="sysop" class="card">Shell</section><section id="me" class="card">Profile</section></main>');
 await page.evaluate(()=>{window.YWI_AUTH={getState:()=>({isAuthenticated:true,user:{id:'fixture'},role:'admin'})};window.YWIDualWorkspace={isSysopVerified:()=>true};window.YWISecurity={canViewSection:()=>true};});
 await page.addScriptTag({content:read('js/router.js')});
 await page.evaluate(()=>window.YWIRouter.showSection('sysop'));
 await page.evaluate(()=>window.YWIRouter.showSection('today'));
 await expect(page.locator('#sysop')).toHaveClass(/active/);
 await page.evaluate(()=>window.YWIRouter.showSection('company'));
 await expect(page.locator('#company')).toHaveClass(/active/);
 await page.evaluate(()=>window.YWIRouter.showSection('today'));
 await expect(page.locator('#today')).toHaveClass(/active/);
});

test('YW602 private access never calls Supabase employee Auth or persists the access code',async({page})=>{
 await page.setContent('<meta name="robots" content="noindex"><section id="yw602SignIn"><form id="yw602Login"><input name="access_code" type="password" required><button type="submit">Sign in</button></form></section><p id="yw602LoginStatus"></p><button id="yw602Logout" hidden>Sign out</button><section id="yw602CustomerPortal" hidden></section>');
 await page.evaluate(({customer})=>{
  window.YWI_RUNTIME_CONFIG={SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'fixture-public-key'};
  window.calls=[];
  window.supabase={createClient:()=>{throw Error('Employee Auth must never initialize');}};
  window.fetch=async(url,opts)=>{
   const body=JSON.parse(opts.body);window.calls.push({url,body,credentials:opts.credentials,auth:opts.headers.Authorization});
   if(body.p_access_code!=='a'.repeat(64))return {ok:false};
   return {ok:true,json:async()=>({state:'authorized_properties',customer_id:customer,properties:[]})};
  };
 },{customer:id(90)});
 await page.addScriptTag({content:read('js/yw602-property-portal.js')});
 await page.addScriptTag({content:read('js/yw602-customer-entry.js')});
 await page.locator('input[name=access_code]').fill('a'.repeat(64));
 await page.getByRole('button',{name:'Sign in'}).click();
 await expect(page.locator('#yw602LoginStatus')).toContainText('Private access verified');
 await expect(page.locator('#yw602CustomerPortal')).toContainText('No authorized properties');
 expect(await page.evaluate(()=>window.calls.every(x=>x.url.endsWith('/rest/v1/rpc/ywi_602_customer_portal')&&x.credentials==='omit'&&x.auth==='Bearer fixture-public-key'))).toBe(true);
 await page.getByRole('button',{name:'Sign out'}).click();
 await expect(page.locator('#yw602CustomerPortal')).toBeHidden();
 await expect(page.locator('input[name=access_code]')).toHaveValue('');
 await page.locator('input[name=access_code]').fill('b'.repeat(64));
 await page.getByRole('button',{name:'Sign in'}).click();
 await expect(page.locator('#yw602LoginStatus')).toContainText('Access refused');
 await expect(page.locator('#yw602CustomerPortal')).toBeHidden();
});

import {test,expect} from '@playwright/test';
import fs from 'node:fs';

const security=fs.readFileSync('js/security.js','utf8');
const router=fs.readFileSync('js/router.js','utf8');
const workspace=fs.readFileSync('js/dual-workspace-550.js','utf8');
const css=fs.readFileSync('style.css','utf8');
const userId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function mount(page,{authenticated=true,sysop=false,foreign=false,delay=0}={}){
  await page.setViewportSize({width:390,height:820});
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><header>
    <nav id="mainNav"><a href="#today">Jobs</a><a href="#admin">Admin</a></nav>
    <nav id="moduleSectionNav"></nav><nav id="workspace550Nav" hidden><a id="workspace550CompanyLink" href="#company">Landscaping company</a><a id="workspace550SysopLink" href="#sysop" hidden>Sysop</a></nav></header>
    <main><section class="card" id="today">Jobs</section><section class="card" id="me">My profile</section>
    <section class="card" id="company"><div id="workspace550Company"></div></section>
    <section class="card" id="sysop"><div id="workspace550Sysop"></div></section></main></body></html>`);
  await page.evaluate(({authenticated,sysop,foreign,delay,userId})=>{
    const state={isAuthenticated:authenticated,role:'employee',user:authenticated?{id:userId,user_metadata:{role:'admin'}}:null};
    window.__session=state;
    window.YWI_AUTH={getState:()=>state};
    window.__queries=[];
    window._sb={auth:{getUser:async()=>({data:{user:state.user},error:null})},rpc:async(name)=>{
      window.__queries.push(name);
      if(name==='ywi_is_platform_administrator_489')return {data:sysop,error:null};
      if(name==='ywi_platform_company_directory_489')return {data:[{company_id:'cc',company_name:'Company <img src=x onerror=alert(1)>',owner_email:'private@example.com',enabled_services:3,registered_services:7}],error:null};
      throw Error('Unexpected RPC '+name);
    },from:(name)=>{
      window.__queries.push(name);
      if(name!=='ywi_companies')throw Error('Unexpected table '+name);
      return {select:()=>({order:()=>({limit:async()=>{
        if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
        return {data:[{id:'cc',name:'Rosevear Landscaping',owner_user_id:foreign?'other-owner':userId}],error:null};
      }})})};
    }};
  },{authenticated,sysop,foreign,delay,userId});
  await page.addScriptTag({content:security});
  await page.addScriptTag({content:router});
  await page.addScriptTag({content:workspace});
  await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
  await expect.poll(()=>page.evaluate(()=>window.YWIDualWorkspace.snapshot().checking)).toBe(false);
}

test('YW 550 unverified employee metadata never grants the Sysop shell',async({page})=>{
  await mount(page,{sysop:false});
  await expect(page.locator('#workspace550Company')).toContainText('Rosevear Landscaping');
  await expect(page.locator('#workspace550SysopLink')).toBeHidden();
  await page.evaluate(()=>window.YWIRouter.showSection('sysop'));
  await expect(page.locator('#sysop')).not.toHaveClass(/active/);
  expect(await page.evaluate(()=>window.YWIDualWorkspace.isSysopVerified())).toBe(false);
  expect(await page.evaluate(()=>window.__queries)).not.toContain('ywi_platform_company_directory_489');
});

test('YW 550 platform identity sees summary statistics but never private owner data or tenant records',async({page})=>{
  await mount(page,{sysop:true});
  await expect(page.locator('#workspace550SysopLink')).toBeVisible();
  await page.evaluate(()=>window.YWIRouter.showSection('sysop'));
  await expect(page.locator('#workspace550Sysop')).toContainText('Registered landscaping companies');
  await expect(page.locator('#workspace550Sysop')).toContainText('Company <img src=x onerror=alert(1)>');
  await expect(page.locator('#workspace550Sysop')).not.toContainText('private@example.com');
  await expect(page.locator('#workspace550Sysop img')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('YW 550 fails closed for a foreign company and anonymous session',async({page})=>{
  await mount(page,{sysop:true,foreign:true});
  await expect(page.locator('#workspace550Company')).toContainText('ACCESS WITHHELD');
  await expect(page.locator('#workspace550SysopLink')).toBeHidden();
  await expect(page.locator('#workspace550Company')).not.toContainText('Rosevear Landscaping');
  await mount(page,{authenticated:false});
  await expect(page.locator('#workspace550Nav')).toBeHidden();
  await expect(page.locator('#workspace550SysopLink')).toBeHidden();
});

test('YW 550 removes prior privileged data when identity changes during an async read',async({page})=>{
  await mount(page,{sysop:true,delay:120});
  await expect(page.locator('#workspace550Sysop')).toContainText('Verified platform Sysop session');
  await page.evaluate(()=>{
    window.__session.isAuthenticated=false;window.__session.user=null;
    document.dispatchEvent(new Event('ywi:auth-changed'));
  });
  await expect(page.locator('#workspace550Nav')).toBeHidden();
  await expect(page.locator('#workspace550SysopLink')).toBeHidden();
  await expect(page.locator('#workspace550Sysop')).not.toContainText('Company <img');
  expect(await page.evaluate(()=>window.YWIDualWorkspace.snapshot().sysopVerified)).toBe(false);
});

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const referenceSource=fs.readFileSync(path.join(process.cwd(),'js/reference-data.js'),'utf8');
const configSource=fs.readFileSync(path.join(process.cwd(),'js/app-config.js'),'utf8');

async function mountReference(page){
  await page.setContent('<!doctype html><html><head></head><body></body></html>');
  await page.evaluate(()=>{
    history.replaceState({},'', '#today');
    window.__identity='profile-a';
    window.__referenceCalls=0;
    window.__profileCalls=[];
    window.YWI_AUTH={getState:()=>({isAuthenticated:true,identityKey:window.__identity,profile:{id:window.__identity,full_name:'Test User'}})};
    window.YWIProfileUI={create:(config)=>({guardedApi:config.api})};
    window.__referenceApi={
      fetchReferenceData:async()=>{
        window.__referenceCalls+=1;
        await new Promise((resolve)=>setTimeout(resolve,30));
        return {sites:[{site_code:'A',site_name:'Alpha'}],supervisors:[],admins:[],employees:[],positions:[{name:'Operator'}],trades:[{name:'General'}]};
      }
    };
    window.__profileApi={
      fetchProfileScope:async(input)=>{
        const scope=typeof input==='string'?input:input?.scope;
        window.__profileCalls.push(scope);
        await new Promise((resolve)=>setTimeout(resolve,30));
        return scope==='crew'?{profiles:[{id:'crew-1'}]}:{profile:{id:'profile-a'}};
      },
      fetchMyTimeClockContext:async()=>{window.__profileCalls.push('time');return {active_entry:null,recent_entries:[],jobs:[]};},
      saveMyProfile:async()=>({ok:true})
    };
  });
  await page.addScriptTag({content:referenceSource});
}

test('reference data coalesces concurrent reads, honors freshness, force refresh, and identity invalidation',async({page})=>{
  await mountReference(page);
  await page.evaluate(()=>{location.hash='#me';});
  await page.evaluate(async()=>{
    window.__reference=window.YWIReferenceData.create({api:window.__referenceApi,getAuthState:()=>window.YWI_AUTH.getState()});
    await Promise.all([window.__reference.load(),window.__reference.load()]);
  });
  expect(await page.evaluate(()=>window.__referenceCalls)).toBe(1);
  expect(await page.evaluate(()=>window.__reference.isFresh())).toBe(true);
  await page.evaluate(()=>window.__reference.load());
  expect(await page.evaluate(()=>window.__referenceCalls)).toBe(1);
  await page.evaluate(()=>window.__reference.load({force:true}));
  expect(await page.evaluate(()=>window.__referenceCalls)).toBe(2);
  await page.evaluate(async()=>{window.__identity='profile-b';await window.__reference.load();});
  expect(await page.evaluate(()=>window.__referenceCalls)).toBe(3);
});

test('profile and crew reads are route-scoped and duplicate in-flight reads are reused',async({page})=>{
  await mountReference(page);
  await page.evaluate(()=>{window.__profile=window.YWIProfileUI.create({api:window.__profileApi});});
  await page.evaluate(async()=>{
    location.hash='#today';
    await window.__profile.guardedApi.fetchProfileScope('self');
    await window.__profile.guardedApi.fetchProfileScope({scope:'crew'});
    await window.__profile.guardedApi.fetchMyTimeClockContext();
  });
  expect(await page.evaluate(()=>window.__profileCalls)).toEqual([]);

  await page.evaluate(async()=>{
    location.hash='#me';
    await Promise.all([
      window.__profile.guardedApi.fetchProfileScope('self'),
      window.__profile.guardedApi.fetchProfileScope('self'),
      window.__profile.guardedApi.fetchMyTimeClockContext()
    ]);
  });
  expect(await page.evaluate(()=>window.__profileCalls.filter((x)=>x==='self').length)).toBe(1);
  expect(await page.evaluate(()=>window.__profileCalls.filter((x)=>x==='time').length)).toBe(1);

  await page.evaluate(async()=>{
    location.hash='#crew';
    await Promise.all([
      window.__profile.guardedApi.fetchProfileScope({scope:'crew',search:'',role_filter:''}),
      window.__profile.guardedApi.fetchProfileScope({scope:'crew',search:'',role_filter:''})
    ]);
  });
  expect(await page.evaluate(()=>window.__profileCalls.filter((x)=>x==='crew').length)).toBe(1);
});

test('successful profile save invalidates shared reference freshness',async({page})=>{
  await mountReference(page);
  await page.evaluate(async()=>{
    location.hash='#me';
    window.__reference=window.YWIReferenceData.create({api:window.__referenceApi,getAuthState:()=>window.YWI_AUTH.getState()});
    await window.__reference.load();
    window.__profile=window.YWIProfileUI.create({api:window.__profileApi});
    await window.__profile.guardedApi.saveMyProfile({full_name:'Updated'});
  });
  expect(await page.evaluate(()=>window.__reference.isFresh())).toBe(false);
  expect(await page.evaluate(()=>window.__reference.state.lastInvalidationReason)).toBe('self-profile-save');
});

test('Supabase auth callback returns synchronously before deferred application work',async({page})=>{
  await page.setContent('<!doctype html><html><head><meta name="robots" content="index,follow"><link rel="canonical" href="https://yardweasels.ca/"><meta property="og:url" content="https://yardweasels.ca/"></head><body></body></html>');
  await page.evaluate(()=>{
    window.__authApplicationCalled=false;
    window.__underlyingCallback=null;
    window.supabase={
      createClient:()=>({auth:{onAuthStateChange:(callback)=>{window.__underlyingCallback=callback;return {data:{subscription:{unsubscribe(){}}}};}}})
    };
  });
  await page.addScriptTag({content:configSource});
  const result=await page.evaluate(()=>{
    const client=window.supabase.createClient('https://example.supabase.co','anon');
    client.auth.onAuthStateChange(async()=>{window.__authApplicationCalled=true;await Promise.resolve();});
    const returned=window.__underlyingCallback('TOKEN_REFRESHED',{user:{id:'a'}});
    return {returned,called:window.__authApplicationCalled};
  });
  expect(result.returned).toBeUndefined();
  expect(result.called).toBe(false);
  await expect.poll(async()=>page.evaluate(()=>window.__authApplicationCalled)).toBe(true);
});

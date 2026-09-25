import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const outboxJs=fs.readFileSync('js/outbox.js','utf8');
const todayJs=fs.readFileSync('js/mobile-today.js','utf8');

async function boot(page){
  await page.setViewportSize({width:390,height:844});
  await page.setContent(`<!doctype html><html><head><style>*{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden}button{font:inherit}</style></head><body>
    <section id="today"><div id="mobileTodayStatus"></div><div id="mobileTodayGrid"></div><div id="mobileInstallCard"></div></section>
    <section id="jobs"><div class="section-heading"><h2>Jobs</h2></div><div class="table-scroll"><table id="job_list_table"><tbody></tbody></table></div></section>
  </body></html>`);
  await page.addScriptTag({content:`
    (()=>{const values=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:(k)=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,String(v)),removeItem:(k)=>values.delete(k)}})})();
    window.__profileId='profile-one';
    window.YWI_AUTH={getState:()=>({isAuthenticated:true,role:'admin',profile:{id:window.__profileId,role:'admin'}})};
    window.YWISecurity={normalizeRole:(r)=>r,getRoleLabel:()=> 'Admin',canViewSection:()=>true};
    window.YWIRouter={showSection:(name)=>{document.body.dataset.route=name}};
    window.YWIMobileFormAssist={countDrafts:()=>0,draftSummaries:()=>[]};
  `});
  await page.addScriptTag({content:outboxJs});
  await page.evaluate(async()=>{
    window.YWIOutbox.queueAction({
      scope:'jobs',
      action_type:'job_note_update',
      label:'JOB-348 note',
      payload:{job_id:'JOB-348',note:'local crew note'}
    });
    await window.YWIOutbox.retryQueuedActions({
      handlers:{
        job_note_update:async()=>{
          const error=new Error('stale conflict: server record changed');
          error.serverPayload={job_id:'JOB-348',note:'server dispatcher note'};
          throw error;
        }
      }
    });
  });
  await page.addScriptTag({content:todayJs});
  await page.evaluate(()=>window.YWIMobileToday.render());
}

test('Build 348 shows retained local and server values and never auto-overwrites',async({page})=>{
  await boot(page);
  const recovery=page.locator('#offlineConflictRecovery348');
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText('Build 348 — Offline & Conflict Recovery');
  await expect(recovery).toContainText('local crew note');
  await expect(recovery).toContainText('server dispatcher note');
  await expect(recovery.getByRole('button',{name:'Keep Mine'})).toBeVisible();
  await expect(recovery.getByRole('button',{name:'Keep Server'})).toBeVisible();
  await expect(recovery.getByRole('button',{name:'Merge'})).toBeEnabled();
  await expect(recovery.getByRole('button',{name:'Retry'})).toBeVisible();
  await expect(recovery.getByRole('button',{name:'Discard'})).toBeVisible();

  await recovery.getByRole('button',{name:'Keep Mine'}).click();
  const state=await page.evaluate(()=>({
    item:window.YWIOutbox.getActionItems()[0],
    history:window.YWIOutbox.getRecoveryHistory()
  }));
  expect(state.item.status).toBe('pending');
  expect(state.item.payload.note).toBe('local crew note');
  expect(state.item.server_payload.note).toBe('server dispatcher note');
  expect(state.history.at(-1).resolution_action).toBe('keep_mine');
});

test('Build 348 merge is deliberate and profile-scoped',async({page})=>{
  await boot(page);
  page.on('dialog',async(dialog)=>{
    if(dialog.type()==='prompt') await dialog.accept(JSON.stringify({job_id:'JOB-348',note:'reviewed merged note'}));
    else await dialog.accept();
  });
  await page.getByRole('button',{name:'Merge'}).click();
  const merged=await page.evaluate(()=>window.YWIOutbox.getActionItems()[0]);
  expect(merged.status).toBe('pending');
  expect(merged.payload.note).toBe('reviewed merged note');
  expect(merged.recovery_resolution).toBe('merge');

  await page.evaluate(()=>{
    const item=window.YWIOutbox.getActionItems()[0];
    window.YWIOutbox.updateActionItem(item.id,{status:'conflict'});
    window.__profileId='profile-two';
    window.YWIMobileToday.render();
  });
  expect(await page.evaluate(()=>window.YWIOutbox.getRecoveryItems().length)).toBe(0);
  await expect(page.locator('#offlineConflictRecovery348')).toHaveCount(0);
});

test('Build 348 keeps mobile recovery controls within the viewport',async({page})=>{
  await boot(page);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const heights=await page.locator('#offlineConflictRecovery348 button').evaluateAll((els)=>els.map((el)=>el.getBoundingClientRect().height));
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(42);
});

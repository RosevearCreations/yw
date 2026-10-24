import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const script=readFileSync('js/quality-customer-handoff-437.js','utf8');

async function setup(page,opts={}){
 await page.setViewportSize({width:390,height:844});
 await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:8px"><div id="admin"></div></body></html>');
 await page.evaluate(options=>{
  window.__calls=[];window.__writes=[];
  window.__signedOut=Boolean(options.signedOut);
  window.YWI_AUTH={getState:()=>({isAuthenticated:!window.__signedOut,user:{id:'owner-1'}})};
  window.YWI_SB={
   auth:{getUser:async()=>({data:{user:{id:options.badSession?'foreign':'owner-1'}}})},
   from(table){window.__calls.push(table);return {
    select(){return this},order(){return this},
    limit(){return Promise.resolve({data:[{id:'company-1',name:'Original Yard Workers company',
     owner_user_id:options.foreignOwner?'foreign':'owner-1'}],error:null})},
    insert(){window.__writes.push('insert')},update(){window.__writes.push('update')},
    delete(){window.__writes.push('delete')},upsert(){window.__writes.push('upsert')}
   }},
   rpc:async(name,args)=>{
    window.__calls.push(name);
    const original={id:'order-1',number:'WO-437',status:'awaiting_qc',service:'landscape'};
    const base={company_id:options.foreignResponse?'foreign':'company-1',
     work_order_id:args.p_work_order_id,orders:[original],complete:true,source_limit:80,
     state:args.p_work_order_id?'review_only':'choose_order',approval_or_signature_write:false,
     customer_message_sent:false,site_reopened:false};
    if(!args.p_work_order_id)return {data:base,error:options.denied?{message:'denied'}:null};
    return {error:options.denied?{message:'denied'}:null,data:{...base,
     qc:{id:'qc-1',work_order_id:'order-1',run_status:'approved',review_status:'approved',
      reviewed_by_profile_id:'supervisor',reviewed_at:'2026-10-24T09:00:00Z'},
     items:[{id:'item-1',qc_run_id:'qc-1',is_required:true,result_status:'pass',
      completed_at:'2026-10-24T09:00:00Z',evidence_requirement:'after'}],
     deficiencies:[],rework:[],
     evidence:[{id:'evidence-1',qc_run_id:'qc-1',qc_item_id:'item-1',execution_proof_id:'proof-1',
      evidence_role:'after',proof_work_order_id:options.foreignProof?'other':'order-1',
      proof_status:'approved',customer_safe:true,customer_visible:true}],
     closeout:{id:'closeout-1',work_order_id:'order-1',closeout_status:'approved',
      approved_by_profile_id:'supervisor',approved_at:'2026-10-24T09:00:00Z',
      customer_signoff_required:true,customer_change_requested:Boolean(options.customerChange),
      customer_signoff_status:options.missingSignoff?'requested':'signed',
      signed_off_at:options.missingSignoff?null:'2026-10-24T09:02:00Z'},
     signoffs:options.missingSignoff?[]:[{id:'portal-sign-1',closeout_package_id:'closeout-1',
      signoff_status:options.customerDeclined?'declined':'signed',created_at:'2026-10-24T09:02:00Z'}]
    }};
   }
  };
 },opts);
 await page.addScriptTag({content:script});
 await page.locator('#owner437 summary').click();
 await page.locator('#owner437Refresh').click();
}

async function chooseOriginal(page){
 await page.locator('#owner437Service').selectOption('landscape');
 await page.locator('#owner437Refresh').click();
}

test('390px genuine original QC and portal provenance stays REVIEW with zero writes',async({page})=>{
 await setup(page);await chooseOriginal(page);
 await expect(page.locator('#owner437Status')).toContainText('REVIEW');
 await expect(page.locator('[data-owner437-group="sources"]')).toContainText('QC checklist items: 1');
 await expect(page.locator('[data-owner437-group="sources"]')).toContainText('Portal signoff records: 1');
 await expect(page.locator('#owner437Results')).toContainText('Not a new QC sign-off');
 expect(await page.evaluate(()=>window.__calls)).toEqual(['ywi_companies',
  'ywi_rpc_quality_customer_handoff_437','ywi_companies',
  'ywi_rpc_quality_customer_handoff_437','ywi_rpc_quality_customer_handoff_437']);
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('missing or declined original portal signoff and customer objection remain HOLD',async({page})=>{
 for(const opts of [{missingSignoff:true},{customerDeclined:true},{customerChange:true}]){
  await setup(page,opts);await chooseOriginal(page);
  await expect(page.locator('#owner437Status')).toContainText('HOLD');
  await expect(page.locator('[data-owner437-group="holds"]')).not.toBeEmpty();
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});

test('foreign execution proof and denied owner sources are WITHHELD with zero writes',async({page})=>{
 for(const opts of [{foreignProof:true},{foreignResponse:true},{denied:true},
  {foreignOwner:true},{badSession:true},{signedOut:true}]){
  await setup(page,opts);
  if(!opts.foreignOwner&&!opts.badSession&&!opts.signedOut&&!opts.denied&&!opts.foreignResponse)
   await chooseOriginal(page);
  else if(opts.foreignResponse||opts.denied)await expect(page.locator('#owner437Status')).toContainText('WITHHELD');
  await expect(page.locator('#owner437Status')).toContainText('WITHHELD');
  await expect(page.locator('#owner437Results')).toBeEmpty();
  expect(await page.evaluate(()=>window.__writes)).toEqual([]);
 }
});

test('auth change removes visible customer source review',async({page})=>{
 await setup(page);await chooseOriginal(page);
 await expect(page.locator('#owner437Results')).toContainText('Portal signoff records');
 await page.evaluate(()=>{window.__signedOut=true;document.dispatchEvent(new CustomEvent('ywi:auth-changed'));});
 await expect(page.locator('#owner437Results')).toBeEmpty();
 await expect(page.locator('#owner437Status')).toContainText('session changed');
 await page.locator('#owner437Refresh').click();
 await expect(page.locator('#owner437Status')).toContainText('WITHHELD');
 expect(await page.evaluate(()=>window.__writes)).toEqual([]);
});

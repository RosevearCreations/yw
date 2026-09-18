import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function registerBank311BrowserTests(){
  const addonSource=fs.readFileSync(path.join(process.cwd(),'js/bank-import-workbench-v2.js'),'utf8');

  async function mount(page){
    await page.route('https://bank311.test/**',async(route)=>{
      await route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html><body>
        <section id="operationsCockpit">
          <div id="oc_status" hidden></div>
          <form id="oc_bank_form">
            <label>CSV<input id="oc_bank_file" type="file"></label>
            <label>Bank<select id="oc_bank_account"><option value="bank-1" selected>Operating</option></select></label>
            <label>Hint<input id="oc_bank_account_hint"></label>
            <input id="oc_bank_import_id" type="hidden">
            <input id="oc_bank_confirmation_note" value="reviewed">
            <button type="submit">Validate mapped rows</button>
          </form>
          <p id="oc_bank_preview_summary"></p>
          <p id="oc_bank_server_summary"></p>
          <table><thead id="oc_bank_preview_headers"></thead><tbody id="oc_bank_preview_rows"></tbody></table>
          <h4>Live import queue</h4><div id="oc_bank_queue"></div>
          <button id="oc_refresh" type="button">Refresh</button>
        </section>
      </body></html>`});
    });
    await page.goto('https://bank311.test/');
    await page.evaluate(()=>{
      window.__bank311Calls=[];
      window.__bank311State={imports:[],rows:[],counter:0};
      const clone=(value)=>JSON.parse(JSON.stringify(value));
      window.YWIAPI={
        parseBankCsvPreviewText(text,maxRows=2500){
          const lines=String(text).trim().split(/\r?\n/).slice(0,maxRows+1);
          const headers=lines.shift().split(',').map((v)=>v.trim());
          const rows=lines.map((line)=>Object.fromEntries(line.split(',').map((v,i)=>[headers[i],v.trim()])));
          return {headers,rows,errors:[]};
        },
        async manageOperations(payload){
          window.__bank311Calls.push(clone(payload));
          const state=window.__bank311State;
          if(payload.action==='operations_queue_list'){
            return {ok:true,queues:{
              bank_imports:clone(state.imports),
              bank_preview_rows:clone(state.rows),
              capabilities:{actions:{
                bank_csv_confirm_import:{permitted:true,label:'Bank import approval'},
                bank_csv_preview:{permitted:true,label:'Bank preview'}
              }}
            }};
          }
          if(payload.action==='bank_csv_preview' && !payload.review_operation){
            state.counter+=1;
            const id=`00000000-0000-4000-8000-${String(state.counter).padStart(12,'0')}`;
            const now=new Date().toISOString();
            state.imports.unshift({
              id,import_key:`BANK311-${state.counter}`,original_filename:payload.original_filename,
              bank_account_id:payload.bank_account_id,bank_account_name:'Operating',preview_status:'review',
              accepted_rows:1,rejected_rows:1,duplicate_rows:1,accepted_row_count:1,rejected_row_count:1,
              promoted_row_count:0,created_at:now,metadata:{
                source_file_sha256:payload.source_file_sha256,
                source_file_bytes:payload.source_file_bytes,
                source_file_last_modified:payload.source_file_last_modified,
                column_mapping:payload.column_mapping
              }
            });
            state.rows=[
              {id:'10000000-0000-4000-8000-000000000001',import_id:id,row_number:1,row_status:'accepted',transaction_date:'2026-09-01',description:'Fuel',amount:-10,reference:'A1',rejection_reason:null},
              {id:'10000000-0000-4000-8000-000000000002',import_id:id,row_number:2,row_status:'rejected',transaction_date:'2026-09-01',description:'Fuel',amount:-10,reference:'A1',rejection_reason:'Possible duplicate row.'}
            ];
            return {ok:true,batch:{id},summary:{accepted:1,rejected:1,duplicates:1}};
          }
          if(payload.action==='bank_csv_preview' && payload.review_operation==='row_decision'){
            const row=state.rows.find((item)=>item.id===payload.row_id);
            if(payload.decision==='approve'){row.row_status='accepted';row.rejection_reason=null;}
            if(payload.decision==='reject'){row.row_status='rejected';row.rejection_reason=payload.reason;}
            if(payload.decision==='correct'){row.row_status='accepted';row.rejection_reason=null;row.transaction_date=payload.transaction_date;row.description=payload.description;row.amount=Number(payload.amount);row.reference=payload.reference;}
            return {ok:true,record:clone(row),summary:{accepted:state.rows.filter((r)=>r.row_status==='accepted').length,rejected:state.rows.filter((r)=>r.row_status==='rejected').length}};
          }
          if(payload.action==='bank_csv_preview' && payload.review_operation==='bulk_decision'){
            for(const row of state.rows.filter((item)=>payload.row_ids.includes(item.id))){
              row.row_status=payload.decision==='approve'?'accepted':'rejected';
              row.rejection_reason=payload.decision==='approve'?null:payload.reason;
            }
            return {ok:true,reviewed:payload.row_ids.length};
          }
          if(payload.action==='bank_csv_preview' && payload.review_operation==='discard_import'){
            const item=state.imports.find((entry)=>entry.id===payload.import_id);
            item.preview_status='discarded';
            for(const row of state.rows){row.row_status='rejected';row.rejection_reason='Import discarded before promotion: '+payload.reason;}
            return {ok:true,discarded:true};
          }
          if(payload.action==='bank_csv_confirm_import'){
            const item=state.imports.find((entry)=>entry.id===payload.import_id);
            item.preview_status='promoted';item.promoted_at=new Date().toISOString();item.promoted_row_count=item.accepted_row_count||1;
            return {ok:true,promoted:true,record:clone(item)};
          }
          throw new Error('Unexpected action '+payload.action);
        }
      };
    });
    await page.addScriptTag({content:addonSource});
    await expect(page.locator('#oc_bank311_mapping')).toBeVisible();
  }

  async function stagePreview(page){
    await page.locator('#oc_bank_file').setInputFiles({
      name:'operating-september.csv',
      mimeType:'text/csv',
      buffer:Buffer.from('Transaction Date,Description,Debit,Credit,Reference\n2026-09-01,Fuel,10,,A1\n2026-09-01,Fuel,10,,A1')
    });
    await expect(page.locator('#oc_bank311_map_date')).toHaveValue('Transaction Date');
    await expect(page.locator('#oc_bank311_map_description')).toHaveValue('Description');
    await expect(page.locator('#oc_bank311_map_debit')).toHaveValue('Debit');
    await page.locator('#oc_bank311_save_template').click();
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ywi_bank_import_column_templates_v2')||'{}')['bank:bank-1']?.mapping?.date)).toBe('Transaction Date');
    await page.locator('#oc_bank_form button[type=submit]').click();
    await expect(page.locator('#oc_bank_server_summary')).toContainText('1 accepted; 1 rejected; 1 duplicate');
    const previewCall=await page.evaluate(()=>window.__bank311Calls.find((call)=>call.action==='bank_csv_preview'&&!call.review_operation));
    expect(previewCall.source_file_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(previewCall.source_file_bytes).toBeGreaterThan(0);
    expect(previewCall.rows[0].__source_row['Transaction Date']).toBe('2026-09-01');
    expect(previewCall.column_mapping.debit).toBe('Debit');
    await expect(page.locator('#oc_bank311_history')).toContainText('operating-september.csv');
    await expect(page.locator('#oc_bank311_history')).toContainText('duplicate flag(s)');
  }

  test('Build 311 maps, fingerprints, reviews and discards without posting',async({page})=>{
    await mount(page);
    await stagePreview(page);
    await page.locator('[data-bank311-action="open"]').click();
    await expect(page.locator('#oc_bank311_review')).toContainText('Possible duplicate row.');
    await page.locator('#oc_bank311_review tr').filter({hasText:'Possible duplicate row.'}).locator('[data-bank311-action="approve-row"]').click();
    await expect.poll(async()=>page.evaluate(()=>window.__bank311Calls.filter((call)=>call.review_operation==='row_decision').at(-1)?.decision)).toBe('approve');

    await page.locator('[data-bank311-action="open"]').click();
    const firstBox=page.locator('[data-bank311-row-select]').first();
    await firstBox.check();
    page.once('dialog',(dialog)=>dialog.accept('manual review reject'));
    await page.locator('#oc_bank311_bulk_reject').click();
    await expect.poll(async()=>page.evaluate(()=>window.__bank311Calls.filter((call)=>call.review_operation==='bulk_decision').at(-1)?.row_ids?.length)).toBe(1);

    page.once('dialog',(dialog)=>dialog.accept('wrong statement file'));
    await page.locator('[data-bank311-action="discard"]').click();
    await expect(page.locator('#oc_bank311_history')).toContainText('discarded');
    const calls=await page.evaluate(()=>window.__bank311Calls);
    expect(calls.some((call)=>call.review_operation==='discard_import')).toBe(true);
    expect(calls.some((call)=>call.action==='payment_action_decision')).toBe(false);
    expect(calls.some((call)=>call.action==='reconciliation_action')).toBe(false);
  });

  test('Build 311 explicit promotion uses only the existing promotion action',async({page})=>{
    await mount(page);
    await stagePreview(page);
    await page.locator('[data-bank311-action="promote"]').click();
    await expect.poll(async()=>page.evaluate(()=>window.__bank311Calls.filter((call)=>call.action==='bank_csv_confirm_import').length)).toBe(1);
    await expect(page.locator('#oc_bank311_history')).toContainText('Promoted');
    const calls=await page.evaluate(()=>window.__bank311Calls);
    expect(calls.filter((call)=>call.action==='bank_csv_confirm_import')).toHaveLength(1);
    expect(calls.some((call)=>call.action==='payment_action_decision')).toBe(false);
  });
}
registerBank311BrowserTests();

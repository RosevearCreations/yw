import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const scannerPath=path.resolve(here,'../../js/equipment-scanner.js');

async function renderEquipmentHarness(page){
  await page.setContent(`<!doctype html><html><body>
    <main style="max-width:900px;margin:20px auto;padding:12px;">
      <label>Equipment code <input id="eq_code"></label>
      <label>Name <input id="eq_name"></label>
      <label>Asset tag <input id="eq_asset_tag"></label>
      <label>Serial <input id="eq_serial"></label>
      <label>QR <input id="eq_qr_code_value"></label>
      <label>Barcode <input id="eq_barcode_value"></label>
      <button id="eq_scan_code" type="button">Scan / Enter Code</button>
      <div id="eq_summary" role="status"></div>
    </main>
  </body></html>`);
}

test('phone camera scan stays untrusted until protected exact resolution',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await renderEquipmentHarness(page);
  await page.evaluate(()=>{
    Object.defineProperty(window,'isSecureContext',{value:true,configurable:true});
    Object.defineProperty(HTMLMediaElement.prototype,'srcObject',{value:null,writable:true,configurable:true});
    HTMLMediaElement.prototype.play=async function(){};
    const track={stop(){window.__cameraStopped=true;}};
    Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>({getTracks:()=>[track]})},configurable:true});
    class MockBarcodeDetector{
      static async getSupportedFormats(){return ['qr_code','code_128'];}
      constructor(){this.seen=false;}
      async detect(){
        if(this.seen)return [];
        this.seen=true;
        return [{rawValue:'QR-YW-185-001',format:'qr_code'}];
      }
    }
    window.BarcodeDetector=MockBarcodeDetector;
    window.YWIAPI={
      jsonFetch:async(name,options)=>{
        window.__scanCall={name,options};
        return {
          ok:true,build:'2026-09-02q',schema:185,replayed:false,
          scan:{id:'11111111-1111-4111-8111-111111111111',resolution_status:'resolved'},
          custody:{id:'22222222-2222-4222-8222-222222222222'},
          resolution:{
            status:'resolved',identifier_kind:'qr_code_value',candidate_count:1,
            equipment_item_id:185,equipment_master_id:'33333333-3333-4333-8333-333333333333',
            equipment_code:'EQ-185-001',equipment_name:'Build 185 Camera Test',equipment_status:'ready'
          }
        };
      }
    };
  });
  await page.addScriptTag({path:scannerPath});

  await page.getByRole('button',{name:'Scan / Enter Code'}).click();
  await expect(page.locator('#eq_code')).toHaveValue('EQ-185-001');
  await expect(page.locator('#eq_qr_code_value')).toHaveValue('QR-YW-185-001');
  await expect(page.locator('#eq_barcode_value')).toHaveValue('');
  await expect(page.locator('#eq_summary')).toContainText('Resolved qr code value');
  await expect(page.locator('#ywi_equipment_scanner_overlay')).toHaveCount(0);

  const result=await page.evaluate(()=>({call:window.__scanCall,stopped:window.__cameraStopped===true}));
  expect(result.stopped).toBe(true);
  expect(result.call.name).toBe('equipment-scan-manage');
  expect(result.call.options.body.scan_source).toBe('camera_barcode_detector');
  expect(result.call.options.body.scan_code).toBe('QR-YW-185-001');
  expect(result.call.options.body.idempotency_key).toBe(result.call.options.headers['x-idempotency-key']);
});

test('desktop unsupported camera keeps permanent manual fallback and refuses unresolved trust',async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await renderEquipmentHarness(page);
  await page.evaluate(()=>{
    Object.defineProperty(window,'isSecureContext',{value:true,configurable:true});
    try{delete window.BarcodeDetector;}catch{}
    window.prompt=()=> 'BAR-UNKNOWN-185';
    window.YWIAPI={
      jsonFetch:async(name,options)=>{
        window.__scanCall={name,options};
        return {
          ok:true,build:'2026-09-02q',schema:185,replayed:false,
          scan:{id:'44444444-4444-4444-8444-444444444444',resolution_status:'unresolved'},
          custody:{id:'55555555-5555-4555-8555-555555555555',custody_status:'needs_review'},
          resolution:{status:'unresolved',identifier_kind:null,candidate_count:0,equipment_code:'BAR-UNKNOWN-185'}
        };
      }
    };
  });
  await page.addScriptTag({path:scannerPath});

  await page.getByRole('button',{name:'Scan / Enter Code'}).click();
  await expect(page.locator('#eq_code')).toHaveValue('');
  await expect(page.locator('#eq_qr_code_value')).toHaveValue('');
  await expect(page.locator('#eq_barcode_value')).toHaveValue('');
  await expect(page.locator('#eq_summary')).toContainText('No exact equipment match');
  await expect(page.locator('#eq_summary')).toContainText('was not trusted into the equipment form');

  const call=await page.evaluate(()=>window.__scanCall);
  expect(call.name).toBe('equipment-scan-manage');
  expect(call.options.body.scan_source).toBe('manual');
  expect(call.options.body.scan_code).toBe('BAR-UNKNOWN-185');
  expect(call.options.body.idempotency_key).toBe(call.options.headers['x-idempotency-key']);
});

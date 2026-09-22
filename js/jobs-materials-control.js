/* File: js/jobs-materials-control.js
   Build 335 — Fuel, Consumables & Materials Control.
   Extends canonical materials_catalog/material_receipts/material_issues/fleet_fuel_logs.
*/
'use strict';

(function () {
  function escHtml(value) {
    return String(value ?? '')
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }
  function setNotice(el, message, isError=false) {
    if (!el) return;
    el.textContent=String(message || '');
    el.style.display='block';
    el.classList.toggle('error',!!isError);
  }
  function numOrNull(value) {
    return value === '' || value == null ? null : Number(value);
  }

  function createPanel() {
    const jobs=document.getElementById('jobs');
    if (!jobs || document.getElementById('fuel_consumables_materials_control_v1')) return;
    const panel=document.createElement('div');
    panel.id='fuel_consumables_materials_control_v1';
    panel.className='admin-panel-block';
    panel.dataset.build='335';
    panel.style.marginTop='16px';
    panel.innerHTML=`
      <div class="section-heading">
        <div>
          <span class="module-kicker">Build 335 · fuel / consumables / materials</span>
          <h3 style="margin:4px 0 0;">Fuel, Consumables &amp; Materials Control</h3>
          <p class="section-subtitle">Control canonical material stock, supplier/cost evidence, reorder levels, work-order use, waste and cycle-count variance. Fleet fuel remains in the existing fleet fuel log.</p>
        </div>
      </div>
      <div id="material_control_summary" class="notice">Loading material control...</div>
      <div class="grid" style="margin-top:12px;">
        <label>Material<select id="material_control_select"><option value="">New material</option></select></label>
        <label>SKU<input id="material_control_sku" type="text" placeholder="MULCH-BLK" /></label>
        <label>Name<input id="material_control_name" type="text" placeholder="Black Mulch" /></label>
        <label>Category<input id="material_control_category" type="text" placeholder="mulch / seed / fertilizer / fuel" /></label>
        <label>Unit<select id="material_control_unit"><option value="">—</option></select></label>
        <label>Preferred Supplier<select id="material_control_vendor"><option value="">—</option></select></label>
        <label>Supplier SKU<input id="material_control_supplier_sku" type="text" /></label>
        <label>Storage Location<input id="material_control_storage" type="text" placeholder="Bin / trailer / shop shelf" /></label>
        <label>Unit Cost<input id="material_control_unit_cost" type="number" min="0" step="0.01" /></label>
        <label>Opening Qty<input id="material_control_opening" type="number" min="0" step="0.01" /></label>
        <label>Reorder Point<input id="material_control_reorder_point" type="number" min="0" step="0.01" /></label>
        <label>Reorder Qty<input id="material_control_reorder_qty" type="number" min="0" step="0.01" /></label>
        <label>Target Stock<input id="material_control_target" type="number" min="0" step="0.01" /></label>
        <label>Usage Type<select id="material_control_usage_type"><option value="job_use">Job use</option><option value="waste">Waste</option><option value="internal_use">Internal use</option></select></label>
        <label>Work Order<select id="material_control_work_order"><option value="">—</option></select></label>
        <label>Adjustment Type<select id="material_control_adjustment_type"><option value="other">Other</option><option value="damage_loss">Damage / loss</option><option value="found">Found stock</option><option value="receipt_correction">Receipt correction</option><option value="issue_correction">Issue correction</option><option value="transfer">Transfer</option></select></label>
        <label style="display:flex;align-items:center;gap:8px;">Track Stock<input id="material_control_tracked" type="checkbox" checked /></label>
      </div>
      <div class="hseops-inline-actions" style="margin-top:10px;">
        <button id="material_control_save" class="primary" type="button">Save Material</button>
        <button id="material_control_receipt" class="secondary" type="button">Record Receipt</button>
        <button id="material_control_issue" class="secondary" type="button">Record Issue</button>
        <button id="material_control_adjust" class="secondary" type="button">Record Adjustment</button>
        <button id="material_control_cycle_count" class="secondary" type="button">Record Cycle Count</button>
      </div>
      <div class="table-scroll" style="margin-top:12px;">
        <table id="material_control_table">
          <thead><tr><th>Material</th><th>Category</th><th>On Hand</th><th>Status</th><th>Supplier</th><th>Unit Cost</th><th>Job Use</th><th>Waste</th><th>Variance</th><th>Action</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="table-scroll" style="margin-top:12px;">
        <table id="fuel_consumables_table">
          <thead><tr><th>Fuel</th><th>Events</th><th>Litres</th><th>Total Cost</th><th>Avg/L</th><th>Last Fuel</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>`;
    jobs.appendChild(panel);
  }

  async function mount(config={}) {
    const api=config.api;
    if (!api?.fetchJobsDirectory || !api?.manageJobsEntity) return;
    createPanel();

    const state={
      rows:[], summary:[], fuel:[], vendors:[], units:[], workOrders:[], selectedMaterialId:null
    };
    const $=(id)=>document.getElementById(id);
    const e={
      summary:$('material_control_summary'), select:$('material_control_select'), sku:$('material_control_sku'),
      name:$('material_control_name'), category:$('material_control_category'), unit:$('material_control_unit'),
      vendor:$('material_control_vendor'), supplierSku:$('material_control_supplier_sku'), storage:$('material_control_storage'),
      unitCost:$('material_control_unit_cost'), opening:$('material_control_opening'), reorderPoint:$('material_control_reorder_point'),
      reorderQty:$('material_control_reorder_qty'), target:$('material_control_target'), usageType:$('material_control_usage_type'),
      workOrder:$('material_control_work_order'), adjustmentType:$('material_control_adjustment_type'), tracked:$('material_control_tracked'),
      save:$('material_control_save'), receipt:$('material_control_receipt'), issue:$('material_control_issue'),
      adjust:$('material_control_adjust'), cycleCount:$('material_control_cycle_count'),
      body:document.querySelector('#material_control_table tbody'), fuelBody:document.querySelector('#fuel_consumables_table tbody')
    };

    function selectedMaterialRow() {
      const id=String(e.select?.value || state.selectedMaterialId || '');
      return state.rows.find((row)=>String(row.id || '')===id) || null;
    }

    function fillMaterialControlForm(row=null) {
      const r=row || selectedMaterialRow();
      if (!e.select) return;
      if (!r) {
        state.selectedMaterialId=null; e.select.value='';
        for (const el of [e.sku,e.name,e.category,e.supplierSku,e.storage,e.unitCost,e.reorderPoint,e.reorderQty,e.target]) if(el) el.value='';
        if(e.opening)e.opening.value='0'; if(e.unit)e.unit.value=''; if(e.vendor)e.vendor.value=''; if(e.tracked)e.tracked.checked=true;
        return;
      }
      state.selectedMaterialId=r.id; e.select.value=String(r.id);
      if(e.sku)e.sku.value=r.sku||''; if(e.name)e.name.value=r.item_name||''; if(e.category)e.category.value=r.material_category||'';
      if(e.unit)e.unit.value=r.unit_id||''; if(e.vendor)e.vendor.value=r.preferred_vendor_id||''; if(e.supplierSku)e.supplierSku.value=r.supplier_sku||'';
      if(e.storage)e.storage.value=r.storage_location||''; if(e.unitCost)e.unitCost.value=r.current_unit_cost??r.default_unit_cost??'';
      if(e.opening)e.opening.value=r.opening_quantity??0; if(e.reorderPoint)e.reorderPoint.value=r.reorder_point??'';
      if(e.reorderQty)e.reorderQty.value=r.reorder_quantity??''; if(e.target)e.target.value=r.target_stock_quantity??'';
      if(e.tracked)e.tracked.checked=r.inventory_tracked!==false;
    }

    function renderMaterialsControlWorkbench() {
      const rows=state.rows, s=state.summary?.[0]||{}, current=String(state.selectedMaterialId||e.select?.value||'');
      if(e.select) {
        e.select.innerHTML='<option value="">New material</option>'+rows.map((r)=>`<option value="${escHtml(r.id)}">${escHtml(r.sku||'')} · ${escHtml(r.item_name||'')}</option>`).join('');
        e.select.value=rows.some((r)=>String(r.id)===current)?current:'';
      }
      if(e.unit)e.unit.innerHTML='<option value="">—</option>'+state.units.map((u)=>`<option value="${escHtml(u.id)}">${escHtml(u.code||u.name||'')} · ${escHtml(u.name||'')}</option>`).join('');
      if(e.vendor)e.vendor.innerHTML='<option value="">—</option>'+state.vendors.map((v)=>`<option value="${escHtml(v.id)}">${escHtml(v.display_name||v.legal_name||v.vendor_code||'')}</option>`).join('');
      if(e.workOrder)e.workOrder.innerHTML='<option value="">—</option>'+state.workOrders.map((wo)=>`<option value="${escHtml(wo.id)}">${escHtml(wo.work_order_number||wo.id)} · ${escHtml(wo.status||'')}</option>`).join('');
      setNotice(e.summary,`${Number(s.active_material_count||0)} active material(s) · ${Number(s.reorder_required_count||0)} reorder · stock value ${s.stock_value_total==null?'restricted':'$'+Number(s.stock_value_total||0).toFixed(2)} · job use ${Number(s.job_use_quantity_total||0).toFixed(2)} · waste ${Number(s.waste_quantity_total||0).toFixed(2)} · variance ${Number(s.usage_variance_quantity_total||0).toFixed(2)}.`);
      if(e.body)e.body.innerHTML=rows.length?rows.map((r)=>`<tr><td>${escHtml(r.sku||'')} · ${escHtml(r.item_name||'')}</td><td>${escHtml(r.material_category||'')}</td><td>${Number(r.stock_on_hand||0).toFixed(2)} ${escHtml(r.unit_code||'')}</td><td>${escHtml(String(r.stock_status||'').replaceAll('_',' '))}</td><td>${escHtml(r.preferred_vendor_name||r.last_vendor_name||'')}</td><td>${r.current_unit_cost==null?'restricted':'$'+Number(r.current_unit_cost||0).toFixed(2)}</td><td>${Number(r.job_use_quantity||0).toFixed(2)}</td><td>${Number(r.waste_quantity||0).toFixed(2)}</td><td>${Number(r.usage_variance_quantity||0).toFixed(2)}</td><td><button type="button" class="secondary" data-material-load="${escHtml(r.id)}">Load</button></td></tr>`).join(''):'<tr><td colspan="10" class="muted">No controlled materials yet.</td></tr>';
      if(e.fuelBody)e.fuelBody.innerHTML=state.fuel.length?state.fuel.map((r)=>`<tr><td>${escHtml(r.fuel_type||'')}</td><td>${Number(r.fuel_event_count||0)}</td><td>${Number(r.quantity_litres||0).toFixed(2)}</td><td>${r.total_cost==null?'restricted':'$'+Number(r.total_cost||0).toFixed(2)}</td><td>${r.average_cost_per_litre==null?'restricted':'$'+Number(r.average_cost_per_litre||0).toFixed(4)}</td><td>${escHtml(r.last_fueled_at||'')}</td></tr>`).join(''):'<tr><td colspan="6" class="muted">No fleet fuel evidence yet.</td></tr>';
      if(state.selectedMaterialId)fillMaterialControlForm(rows.find((r)=>String(r.id)===String(state.selectedMaterialId))||null);
    }

    async function refresh() {
      const resp=await api.fetchJobsDirectory({scope:'all'});
      state.rows=Array.isArray(resp?.material_stock_control)?resp.material_stock_control:[];
      state.summary=Array.isArray(resp?.material_control_summary)?resp.material_control_summary:[];
      state.fuel=Array.isArray(resp?.fuel_consumables_summary)?resp.fuel_consumables_summary:[];
      state.vendors=Array.isArray(resp?.material_vendors)?resp.material_vendors:[];
      state.units=Array.isArray(resp?.material_units)?resp.material_units:[];
      state.workOrders=Array.isArray(resp?.work_orders)?resp.work_orders:[];
      renderMaterialsControlWorkbench();
    }

    async function saveMaterial() {
      const resp=await api.manageJobsEntity({entity:'material',action:'material_catalog_upsert',material_id:state.selectedMaterialId||null,sku:e.sku?.value?.trim?.()||null,item_name:e.name?.value?.trim?.()||'',material_category:e.category?.value?.trim?.()||null,unit_id:e.unit?.value||null,preferred_vendor_id:e.vendor?.value||null,supplier_sku:e.supplierSku?.value?.trim?.()||null,storage_location:e.storage?.value?.trim?.()||null,default_unit_cost:numOrNull(e.unitCost?.value)??0,opening_quantity:numOrNull(e.opening?.value)??0,reorder_point:numOrNull(e.reorderPoint?.value),reorder_quantity:numOrNull(e.reorderQty?.value),target_stock_quantity:numOrNull(e.target?.value),inventory_tracked:e.tracked?.checked!==false});
      if(!resp?.ok)return setNotice(e.summary,resp?.error||'Material save failed.',true);
      state.selectedMaterialId=resp.record?.id||state.selectedMaterialId; await refresh();
    }
    async function recordReceipt() {
      const r=selectedMaterialRow(); if(!r)return setNotice(e.summary,'Load a material before recording a receipt.',true);
      const q=window.prompt('Material quantity received:','1'); if(q===null)return;
      const cost=window.prompt('Receipt unit cost:',String(r.current_unit_cost??r.default_unit_cost??0)); if(cost===null)return;
      const resp=await api.manageJobsEntity({entity:'material',action:'material_stock_receipt',material_id:r.id,quantity:Number(q),unit_cost:Number(cost),vendor_id:e.vendor?.value||null,work_order_id:e.workOrder?.value||null});
      if(!resp?.ok)return setNotice(e.summary,resp?.error||'Material receipt failed.',true); await refresh();
    }
    async function recordIssue() {
      const r=selectedMaterialRow(); if(!r)return setNotice(e.summary,'Load a material before recording an issue.',true);
      const q=window.prompt('Material quantity to issue:','1'); if(q===null)return;
      const planned=window.prompt('Planned quantity for variance:',q); if(planned===null)return;
      const usage=e.usageType?.value||'job_use', wasteReason=usage==='waste'?(window.prompt('Waste reason:','')||''):'';
      const resp=await api.manageJobsEntity({entity:'material',action:'material_stock_issue',material_id:r.id,quantity:Number(q),planned_quantity:Number(planned),usage_type:usage,waste_reason:wasteReason||null,work_order_id:e.workOrder?.value||null});
      if(!resp?.ok)return setNotice(e.summary,resp?.error||'Material issue failed.',true); await refresh();
    }
    async function recordAdjustment() {
      const r=selectedMaterialRow(); if(!r)return setNotice(e.summary,'Load a material before recording an adjustment.',true);
      const q=window.prompt('Stock quantity delta (+/-):','0'); if(q===null)return;
      const reason=window.prompt('Stock adjustment reason:','')||'';
      const resp=await api.manageJobsEntity({entity:'material',action:'material_stock_adjust',material_id:r.id,quantity_delta:Number(q),adjustment_type:e.adjustmentType?.value||'other',reason,work_order_id:e.workOrder?.value||null});
      if(!resp?.ok)return setNotice(e.summary,resp?.error||'Stock adjustment failed.',true); await refresh();
    }
    async function recordCycleCount() {
      const r=selectedMaterialRow(); if(!r)return setNotice(e.summary,'Load a material before recording a count.',true);
      const q=window.prompt('Counted quantity:',String(r.stock_on_hand??0)); if(q===null)return;
      const reason=window.prompt('Cycle count reason:','Cycle count')||'Cycle count';
      const resp=await api.manageJobsEntity({entity:'material',action:'material_cycle_count',material_id:r.id,counted_quantity:Number(q),reason});
      if(!resp?.ok)return setNotice(e.summary,resp?.error||'Cycle count failed.',true); await refresh();
    }

    if(e.select && e.select.dataset.bound!=='1'){e.select.dataset.bound='1';e.select.addEventListener('change',()=>{state.selectedMaterialId=e.select.value||null;fillMaterialControlForm();});}
    if(e.body && e.body.dataset.bound!=='1'){e.body.dataset.bound='1';e.body.addEventListener('click',(event)=>{const btn=event.target.closest('[data-material-load]');if(!btn)return;state.selectedMaterialId=btn.getAttribute('data-material-load')||null;renderMaterialsControlWorkbench();fillMaterialControlForm();});}
    if(e.save && e.save.dataset.bound!=='1'){e.save.dataset.bound='1';e.save.addEventListener('click',saveMaterial);}
    if(e.receipt && e.receipt.dataset.bound!=='1'){e.receipt.dataset.bound='1';e.receipt.addEventListener('click',recordReceipt);}
    if(e.issue && e.issue.dataset.bound!=='1'){e.issue.dataset.bound='1';e.issue.addEventListener('click',recordIssue);}
    if(e.adjust && e.adjust.dataset.bound!=='1'){e.adjust.dataset.bound='1';e.adjust.addEventListener('click',recordAdjustment);}
    if(e.cycleCount && e.cycleCount.dataset.bound!=='1'){e.cycleCount.dataset.bound='1';e.cycleCount.addEventListener('click',recordCycleCount);}

    await refresh();
  }

  window.YWIMaterialsControl={mount};
})();

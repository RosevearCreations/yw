document.addEventListener('DOMContentLoaded', () => {
  const mount = document.getElementById('accountingBackendMount');
  if (!mount || !window.DDAuth) return;

  function fillInput(form, name, value) {
    const field = form?.elements?.[name];
    if (field) field.value = value == null ? '' : String(value);
  }

  function activeMonth() {
    return new Date().toISOString().slice(0, 7);
  }

  function activeDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function inject() {
    const expenseCard = document.getElementById('expense-entry');
    const overheadCard = document.getElementById('overhead-allocation');
    const expenseForm = document.getElementById('expenseForm');
    const overheadForm = document.getElementById('overheadForm');
    const expenseLedger = document.getElementById('expenseLedgerCode');
    if (!expenseCard || !overheadCard || !expenseForm || !overheadForm || document.getElementById('accountingMonthlyPresetCard')) return false;

    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'accountingMonthlyPresetCard';
    card.style.marginTop = '18px';
    card.innerHTML = `
      <h2 style="margin-top:0">Monthly overhead shortcuts</h2>
      <p class="small" style="margin-top:0">The current accounting layer already records operating expenses in <code>accounting_expenses</code> and shared monthly overhead in <code>accounting_overhead_allocations</code>. These shortcuts make common T2-style monthly costs faster to enter, but the final corporate tax mapping should still be reviewed with your accountant.</p>
      <div class="admin-dashboard-grid" id="accountingPresetButtons">
        <button type="button" class="btn" data-expense-preset='{"vendor_name":"Hydro One","ledger_code":"6100","notes":"Monthly workshop electricity","tax_amount":""}'>Electricity</button>
        <button type="button" class="btn" data-expense-preset='{"vendor_name":"Enbridge","ledger_code":"6120","notes":"Monthly workshop gas","tax_amount":""}'>Gas</button>
        <button type="button" class="btn" data-expense-preset='{"vendor_name":"ISP / Internet","ledger_code":"6300","notes":"Monthly business internet","tax_amount":""}'>Internet</button>
        <button type="button" class="btn" data-expense-preset='{"vendor_name":"Phone provider","ledger_code":"6310","notes":"Monthly business phone","tax_amount":""}'>Phone</button>
        <button type="button" class="btn" data-expense-preset='{"vendor_name":"Insurance provider","ledger_code":"6600","notes":"Monthly insurance","tax_amount":""}'>Insurance</button>
        <button type="button" class="btn" data-expense-preset='{"vendor_name":"Software vendor","ledger_code":"6500","notes":"Monthly software subscription","tax_amount":""}'>Software</button>
        <button type="button" class="btn" data-expense-preset='{"vendor_name":"Landlord / Workshop","ledger_code":"6200","notes":"Monthly workshop or storage rent","tax_amount":""}'>Rent</button>
        <button type="button" class="btn" data-expense-preset='{"vendor_name":"Bank / Processor","ledger_code":"6715","notes":"Monthly bank and merchant charges","tax_amount":""}'>Bank fees</button>
        <button type="button" class="btn" data-expense-preset='{"vendor_name":"Accountant / Bookkeeper","ledger_code":"6862","notes":"Accounting and bookkeeping fees","tax_amount":""}'>Accounting fees</button>
        <button type="button" class="btn" data-expense-preset='{"vendor_name":"Post / Courier","ledger_code":"9270","notes":"Shipping, postage, or mailing costs not captured elsewhere","tax_amount":""}'>Shipping admin</button>
        <button type="button" class="btn" data-overhead-preset='{"ledger_code":"6200","ledger_name":"Rent allocation","allocation_basis":"manual","notes":"Monthly workshop rent allocation"}'>Rent allocation</button>
        <button type="button" class="btn" data-overhead-preset='{"ledger_code":"6100","ledger_name":"Electricity allocation","allocation_basis":"manual","notes":"Monthly electricity overhead allocation"}'>Electricity allocation</button>
      </div>`;

    mount.insertBefore(card, mount.firstChild);

    card.querySelectorAll('[data-expense-preset]').forEach((button) => button.addEventListener('click', () => {
      const preset = JSON.parse(button.getAttribute('data-expense-preset') || '{}');
      fillInput(expenseForm, 'expense_date', activeDate());
      fillInput(expenseForm, 'vendor_name', preset.vendor_name || '');
      fillInput(expenseForm, 'notes', preset.notes || '');
      if (expenseLedger) expenseLedger.value = preset.ledger_code || '';
      const amountField = expenseForm.elements?.amount;
      if (amountField) amountField.focus();
    }));

    card.querySelectorAll('[data-overhead-preset]').forEach((button) => button.addEventListener('click', () => {
      const preset = JSON.parse(button.getAttribute('data-overhead-preset') || '{}');
      fillInput(overheadForm, 'period_month', activeMonth());
      fillInput(overheadForm, 'ledger_code', preset.ledger_code || '');
      fillInput(overheadForm, 'ledger_name', preset.ledger_name || '');
      fillInput(overheadForm, 'allocation_basis', preset.allocation_basis || 'manual');
      fillInput(overheadForm, 'notes', preset.notes || '');
      const amountField = overheadForm.elements?.amount;
      if (amountField) amountField.focus();
    }));

    return true;
  }

  if (!inject()) {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (inject() || tries > 20) clearInterval(timer);
    }, 300);
  }
});

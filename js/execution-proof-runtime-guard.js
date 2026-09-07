/* Build 253 — browser-side execution-proof capture guard.
   This is a usability/preflight layer only. Server/RPC validation remains authoritative.
   It never records staging acceptance evidence, changes business rails, or bypasses role checks. */
'use strict';

(function () {
  const FORM_ID = 'oc_execution_proof_form';
  const SUMMARY_MESSAGE = 'Customer-visible execution proof requires a customer-safe summary.';
  const COST_MESSAGE = 'Execution proof costs must be zero or positive numbers.';
  const COST_FIELDS = Object.freeze([
    'labour_minutes',
    'labour_hourly_rate',
    'material_cost_total',
    'equipment_cost_total',
    'other_cost_total'
  ]);

  function formElement(form, name) {
    return form?.elements?.namedItem?.(name) || form?.elements?.[name] || null;
  }

  function setStatus(message) {
    const status = document.getElementById('oc_status');
    if (!status) return;
    status.textContent = message;
    status.dataset.status = 'error';
    status.hidden = false;
  }

  function syncSummaryRequirement(form) {
    if (!(form instanceof HTMLFormElement) || form.id !== FORM_ID) return;
    const visible = formElement(form, 'customer_visible')?.checked === true;
    const summary = formElement(form, 'customer_summary');
    if (!(summary instanceof HTMLTextAreaElement)) return;
    summary.required = visible;
    summary.setAttribute('aria-required', visible ? 'true' : 'false');
    if (!visible || summary.value.trim()) summary.setCustomValidity('');
  }

  function validateForm(form) {
    if (!(form instanceof HTMLFormElement) || form.id !== FORM_ID) return { ok:true };
    const customerVisible = formElement(form, 'customer_visible')?.checked === true;
    const summary = formElement(form, 'customer_summary');
    const customerSummary = String(summary?.value || '').trim();

    if (customerVisible && !customerSummary) {
      summary?.setCustomValidity?.(SUMMARY_MESSAGE);
      return { ok:false, field:'customer_summary', message:SUMMARY_MESSAGE };
    }
    summary?.setCustomValidity?.('');

    for (const name of COST_FIELDS) {
      const input = formElement(form, name);
      const raw = String(input?.value ?? '').trim();
      const value = raw === '' ? 0 : Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        input?.setCustomValidity?.(COST_MESSAGE);
        return { ok:false, field:name, message:COST_MESSAGE };
      }
      input?.setCustomValidity?.('');
    }
    return { ok:true, customerVisible, customerSummary };
  }

  function blockInvalidSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== FORM_ID) return;
    syncSummaryRequirement(form);
    const result = validateForm(form);
    if (result.ok) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setStatus(result.message);
    const field = formElement(form, result.field);
    field?.focus?.({ preventScroll:true });
    field?.reportValidity?.();
    document.dispatchEvent(new CustomEvent('ywi:execution-proof-validation-blocked', {
      detail:{ field:result.field, message:result.message }
    }));
  }

  function handleChange(event) {
    const target = event.target;
    const form = target?.form;
    if (!(form instanceof HTMLFormElement) || form.id !== FORM_ID) return;
    if (target?.name === 'customer_visible' || target?.name === 'customer_summary') syncSummaryRequirement(form);
    if (COST_FIELDS.includes(String(target?.name || ''))) target.setCustomValidity?.('');
  }

  function discoverForms(root = document) {
    if (root instanceof HTMLFormElement && root.id === FORM_ID) syncSummaryRequirement(root);
    root.querySelectorAll?.(`#${FORM_ID}`).forEach(syncSummaryRequirement);
  }

  document.addEventListener('submit', blockInvalidSubmit, true);
  document.addEventListener('change', handleChange, true);
  document.addEventListener('input', handleChange, true);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) mutation.addedNodes.forEach((node) => {
      if (node.nodeType === 1) discoverForms(node);
    });
  });
  if (document.documentElement) observer.observe(document.documentElement, { childList:true, subtree:true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => discoverForms(), { once:true });
  else discoverForms();

  window.YWIExecutionProofRuntimeGuard = Object.freeze({
    validateForm,
    syncSummaryRequirement,
    messages:Object.freeze({ summary:SUMMARY_MESSAGE, cost:COST_MESSAGE }),
    costFields:COST_FIELDS
  });
})();

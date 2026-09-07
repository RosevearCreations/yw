/* Build 254 — supervisor closeout/signoff browser guard.
   This is browser UX/preflight parity only. Server/RPC validation remains authoritative.
   It prevents duplicate before/after gallery selections and blocks invoice-readiness actions
   until the rendered closeout queue proves customer signoff is signed. */
'use strict';

(function () {
  const FORM_ID = 'oc_closeout_form';
  const INVOICE_ACTION = 'closeout-invoice';
  const DUPLICATE_GALLERY_MESSAGE = 'Choose different approved images for BEFORE and AFTER closeout gallery positions.';
  const SIGNOFF_MESSAGE = 'Customer signoff is required before invoice readiness.';

  function setStatus(message) {
    const el = document.getElementById('oc_status');
    if (!el) return;
    el.textContent = message;
    el.dataset.status = 'error';
    el.hidden = false;
  }

  function selectedValues(select) {
    return new Set([...select?.selectedOptions || []].map((option) => String(option.value || '')).filter(Boolean));
  }

  function duplicateGalleryAsset(form) {
    const before = selectedValues(form?.querySelector?.('[data-oc-closeout-before-assets]'));
    const after = selectedValues(form?.querySelector?.('[data-oc-closeout-after-assets]'));
    return [...before].find((value) => after.has(value)) || '';
  }

  function validateGallery(form) {
    const duplicate = duplicateGalleryAsset(form);
    if (!duplicate) return { ok:true, duplicate_asset_id:'' };
    return { ok:false, duplicate_asset_id:duplicate, message:DUPLICATE_GALLERY_MESSAGE };
  }

  function readSignoffStatus(card) {
    const rows = [...card?.querySelectorAll?.('dl > div') || []];
    const signoffRow = rows.find((row) => String(row.querySelector('dt')?.textContent || '').trim().toLowerCase() === 'signoff');
    return String(signoffRow?.querySelector('dd')?.textContent || '').trim().toLowerCase().replace(/\s+/g, '_');
  }

  function guardInvoiceButton(button) {
    if (!(button instanceof HTMLButtonElement)) return;
    const card = button.closest('.oc-closeout-card');
    if (!card || readSignoffStatus(card) === 'signed') return;
    if (button.disabled && button.dataset.ywiCloseoutSignoffGuard !== '1') return;
    if (button.dataset.ywiCloseoutSignoffGuard !== '1') {
      button.dataset.ywiCloseoutSignoffGuard = '1';
      button.dataset.ywiCloseoutOriginalLabel = button.textContent || 'Mark invoice-ready';
      button.dataset.ywiCloseoutOriginalTitle = button.title || '';
    }
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
    button.title = SIGNOFF_MESSAGE;
    button.textContent = 'Waiting for customer signoff';
  }

  function enforceInvoiceReadiness(root = document) {
    root.querySelectorAll?.(`[data-oc-action="${INVOICE_ACTION}"]`).forEach(guardInvoiceButton);
  }

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== FORM_ID) return;
    const result = validateGallery(form);
    if (result.ok) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setStatus(result.message);
    const before = form.querySelector('[data-oc-closeout-before-assets]');
    const duplicateOption = [...before?.options || []].find((option) => option.value === result.duplicate_asset_id);
    duplicateOption?.scrollIntoView?.({ block:'nearest' });
    before?.focus?.({ preventScroll:true });
  }, true);

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.(`[data-oc-action="${INVOICE_ACTION}"]`);
    if (!button) return;
    const card = button.closest('.oc-closeout-card');
    if (!card || readSignoffStatus(card) === 'signed') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setStatus(SIGNOFF_MESSAGE);
    guardInvoiceButton(button);
  }, true);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches?.(`[data-oc-action="${INVOICE_ACTION}"]`)) guardInvoiceButton(node);
        enforceInvoiceReadiness(node);
      });
    }
  });

  function sync() { enforceInvoiceReadiness(document); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once:true });
  else sync();
  observer.observe(document.documentElement, { childList:true, subtree:true });
  document.addEventListener('ywi:operations-cockpit-updated', () => queueMicrotask(sync));

  window.YWICloseoutRuntimeGuard = Object.freeze({
    validateGallery,
    readSignoffStatus,
    enforceInvoiceReadiness,
    messages:Object.freeze({ duplicateGallery:DUPLICATE_GALLERY_MESSAGE, signoffRequired:SIGNOFF_MESSAGE })
  });
})();

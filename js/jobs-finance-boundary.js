/* File: js/jobs-finance-boundary.js
   Schema 172 module boundary shim.
   Completion accounting candidates are now owned by Finance. This script removes the legacy Jobs
   browser controls while database guards independently enforce the same boundary server-side.
*/

'use strict';

(function () {
  const legacyFinanceControlIds = [
    'jobCreateInvoiceCandidate',
    'jobCreateJournalCandidate',
    'jobPostInvoiceCandidate',
    'jobPostJournalCandidate',
    'jobQueueArApReview'
  ];

  function retireControl(id) {
    const button = document.getElementById(id);
    if (!button || button.dataset.schema172FinanceBoundary === 'true') return;
    button.dataset.schema172FinanceBoundary = 'true';
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
    button.title = 'Moved to Finance. Completed-job candidate approval/generation is controlled by Schema 172 Finance review.';
    button.hidden = true;
  }

  function applyBoundary() {
    legacyFinanceControlIds.forEach(retireControl);
    const host = document.getElementById('jobsCommercialWorkspace') || document.getElementById('jobsCommercialPanel');
    if (host && !host.querySelector('[data-schema172-finance-boundary-note]')) {
      const note = document.createElement('div');
      note.dataset.schema172FinanceBoundaryNote = 'true';
      note.className = 'finance-module-note';
      note.innerHTML = '<strong>Finance boundary:</strong> completed-job invoice/journal candidate decisions have moved to Finance. Jobs remains the canonical completion/evidence owner; Finance owns accounting disposition and draft candidate generation.';
      host.prepend(note);
    }
  }

  const observer = new MutationObserver(() => applyBoundary());
  function start() {
    applyBoundary();
    observer.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();

  document.addEventListener('ywi:route-shown', applyBoundary);
  document.addEventListener('ywi:module-loaded', applyBoundary);
})();

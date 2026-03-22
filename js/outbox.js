/* File: js/outbox.js
   Brief description: Shared outbox module for queued submissions.
   Stores failed form payloads locally, retries them later, and binds retry buttons
   without keeping that logic inside app.js.
*/

'use strict';

(function () {
  const OUTBOX_KEY = 'ywi_outbox_v1';

  function getItems() {
    try {
      return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function setItems(list) {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  }

  function push(item) {
    const list = getItems();
    list.push(item);
    setItems(list);
    return list.length;
  }

  function clear() {
    setItems([]);
  }

  async function retryAll(config = {}) {
    const isAuthenticated = config.isAuthenticated || (() => false);
    const sendToFunction = config.sendToFunction;
    const uploadImagesForSubmission = config.uploadImagesForSubmission || (async () => {});

    if (!isAuthenticated()) {
      throw new Error('Please sign in first.');
    }

    if (typeof sendToFunction !== 'function') {
      throw new Error('Outbox retry requires sendToFunction.');
    }

    const outbox = getItems();
    if (!outbox.length) {
      return { total: 0, remaining: 0, retried: 0 };
    }

    const remaining = [];
    let retried = 0;

    for (const item of outbox) {
      try {
        const resp = await sendToFunction(item.formType, item.payload);
        const submissionId = resp?.id;

        if (submissionId && Array.isArray(item.localImages) && item.localImages.length) {
          await uploadImagesForSubmission(item.localImages, submissionId);
        }

        retried += 1;
      } catch {
        remaining.push(item);
      }
    }

    setItems(remaining);
    return {
      total: outbox.length,
      retried,
      remaining: remaining.length
    };
  }

  function bindRetryButtons(config = {}) {
    const buttons = Array.from(document.querySelectorAll('[data-role="retry-outbox"]'));

    buttons.forEach((btn) => {
      if (btn.dataset.boundRetryOutbox === '1') return;
      btn.dataset.boundRetryOutbox = '1';
      btn.addEventListener('click', async () => {
        try {
          const result = await retryAll(config);
          if (!result.total) {
            alert('Outbox is empty.');
            return;
          }
          alert(result.remaining ? `Retried. ${result.remaining} item(s) remain.` : 'Outbox sent successfully.');
        } catch (err) {
          alert(err?.message || 'Failed to retry outbox.');
        }
      });
    });
  }

  window.YWIOutbox = {
    OUTBOX_KEY,
    getItems,
    setItems,
    push,
    clear,
    retryAll,
    bindRetryButtons
  };
})();

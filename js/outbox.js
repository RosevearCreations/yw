/* File: js/outbox.js
   Brief description: Shared outbox module for queued submissions.
   Stores failed form payloads locally, retries them later, and binds retry buttons
   without keeping that logic inside app.js.
*/

'use strict';

(function () {
  const OUTBOX_KEY = 'ywi_outbox_v1';
  const ACTION_QUEUE_KEY = 'ywi_action_outbox_v1';

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



  function getActionItems() {
    try {
      return JSON.parse(localStorage.getItem(ACTION_QUEUE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function setActionItems(list) {
    localStorage.setItem(ACTION_QUEUE_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  }

  function buildConflictKey(item = {}) {
    const payload = item?.payload || {};
    const base = [
      item?.scope || 'general',
      item?.action_type || 'unknown',
      payload.entity || '',
      payload.notification_id || payload.request_id || payload.profile_id || payload.asset_id || payload.job_id || payload.equipment_code || ''
    ].join(':');
    return base || `${item?.scope || 'general'}:${item?.action_type || 'unknown'}`;
  }

  function queueAction(item) {
    const list = getActionItems();
    const conflictKey = item?.conflict_key || buildConflictKey(item);
    const existingIndex = list.findIndex((entry) => String(entry.conflict_key || '') === String(conflictKey) && entry.status !== 'sent');
    const merged = {
      id: existingIndex >= 0 ? list[existingIndex].id : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      queued_at: existingIndex >= 0 ? list[existingIndex].queued_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'pending',
      scope: item?.scope || 'general',
      action_type: item?.action_type || 'unknown',
      payload: item?.payload || {},
      label: item?.label || '',
      error: '',
      attempts: existingIndex >= 0 ? Number(list[existingIndex].attempts || 0) : 0,
      merge_count: existingIndex >= 0 ? Number(list[existingIndex].merge_count || 0) + 1 : 0,
      conflict_key: conflictKey,
      conflict_details: []
    };
    if (existingIndex >= 0) list[existingIndex] = merged;
    else list.push(merged);
    setActionItems(list);
    return list.length;
  }

  async function retryQueuedActions(config = {}) {
    const handlers = config.handlers || {};
    const scope = config.scope || '';
    const list = getActionItems();
    const remaining = [];
    const conflicts = [];
    let retried = 0;
    for (const item of list) {
      if (scope && item.scope !== scope) {
        remaining.push(item);
        continue;
      }
      const handler = handlers[item.action_type];
      if (typeof handler !== 'function') {
        const failed = { ...item, status: 'conflict', error: `No handler for ${item.action_type}`, attempts: Number(item.attempts || 0) + 1, conflict_details: ['Missing replay handler.'] };
        remaining.push(failed);
        conflicts.push(failed);
        continue;
      }
      try {
        await handler(item.payload || {}, item);
        retried += 1;
      } catch (err) {
        const msg = String(err?.message || err || 'Retry failed');
        const detail = Array.isArray(err?.details) ? err.details : [];
        const isConflict = /conflict|already|duplicate|stale|merge/i.test(msg);
        const failed = { ...item, status: isConflict ? 'conflict' : 'pending', error: msg, attempts: Number(item.attempts || 0) + 1, conflict_details: detail };
        remaining.push(failed);
        if (isConflict) conflicts.push(failed);
      }
    }
    setActionItems(remaining);
    return { total: list.length, retried, remaining: remaining.length, conflicts };
  }

  function getActionItem(id) {
    return getActionItems().find((item) => String(item.id || '') === String(id || '')) || null;
  }

  function removeActionItem(id) {
    const filtered = getActionItems().filter((item) => String(item.id || '') !== String(id || ''));
    setActionItems(filtered);
    return filtered.length;
  }

  function updateActionItem(id, updater = {}) {
    const list = getActionItems();
    const index = list.findIndex((item) => String(item.id || '') === String(id || ''));
    if (index < 0) return null;
    const current = list[index] || {};
    const next = {
      ...current,
      ...(typeof updater === 'function' ? updater(current) : updater),
      updated_at: new Date().toISOString()
    };
    list[index] = next;
    setActionItems(list);
    return next;
  }

  function resolveActionConflict(id, updates = {}) {
    return updateActionItem(id, (current) => ({
      ...current,
      ...updates,
      status: updates.status || 'pending',
      error: updates.error || '',
      conflict_details: Array.isArray(updates.conflict_details) ? updates.conflict_details : []
    }));
  }

  function getActionSummary(scope = '') {
    const items = getActionItems().filter((item) => !scope || item.scope === scope);
    return {
      total: items.length,
      conflicts: items.filter((item) => item.status === 'conflict').length,
      pending: items.filter((item) => item.status !== 'conflict').length,
      merged: items.filter((item) => Number(item.merge_count || 0) > 0).length,
      items
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
    bindRetryButtons,
    ACTION_QUEUE_KEY,
    getActionItems,
    setActionItems,
    queueAction,
    retryQueuedActions,
    getActionItem,
    updateActionItem,
    resolveActionConflict,
    removeActionItem,
    getActionSummary
  };
})();

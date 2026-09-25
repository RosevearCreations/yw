/* File: js/outbox.js
   Brief description: Shared outbox module for queued submissions.
   Stores failed form payloads locally, retries them later, and binds retry buttons
   without keeping that logic inside app.js.
*/

'use strict';

(function () {
  const OUTBOX_KEY = 'ywi_outbox_v1';
  const ACTION_QUEUE_KEY = 'ywi_action_outbox_v1';
  const RECOVERY_HISTORY_KEY = 'ywi_conflict_recovery_history_v1';

  function ownerKey() {
    try {
      const auth = window.YWI_AUTH?.getState?.() || {};
      return String(auth?.profile?.id || auth?.user?.id || auth?.user?.email || '').trim();
    } catch {
      return '';
    }
  }

  function getRecoveryHistory() {
    try {
      return JSON.parse(localStorage.getItem(RECOVERY_HISTORY_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function setRecoveryHistory(list) {
    const bounded = (Array.isArray(list) ? list : []).slice(-50);
    localStorage.setItem(RECOVERY_HISTORY_KEY, JSON.stringify(bounded));
    return bounded;
  }

  function recordRecovery(item, action, note = '') {
    const history = getRecoveryHistory();
    history.push({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      source_item_id: item?.id || null,
      conflict_key: item?.conflict_key || '',
      scope: item?.scope || 'general',
      action_type: item?.action_type || 'unknown',
      owner_key: item?.owner_key || ownerKey(),
      resolution_action: action,
      resolution_note: String(note || '').slice(0, 500),
      local_payload: item?.payload || item?.local_payload || {},
      server_payload: item?.server_payload || null,
      resolved_at: new Date().toISOString()
    });
    setRecoveryHistory(history);
  }

  function serverSnapshotFromError(err, detail = []) {
    const direct = err?.server_payload || err?.serverPayload || err?.current_payload || err?.currentPayload || err?.current || null;
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) return direct;
    for (const entry of Array.isArray(detail) ? detail : []) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const candidate = entry.server_payload || entry.serverPayload || entry.current_payload || entry.currentPayload || entry.current || null;
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) return candidate;
    }
    return null;
  }

  function getItems() {
    try {
      return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function notifyQueueChanged(kind = 'forms') {
    try {
      window.YWIMobileMenu?.syncBadges?.();
      document.dispatchEvent(new CustomEvent('ywi:outbox-changed', { detail: { kind } }));
    } catch {}
  }

  function setItems(list) {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(Array.isArray(list) ? list : []));
    notifyQueueChanged('forms');
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
    notifyQueueChanged('actions');
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
      conflict_details: [],
      owner_key: existingIndex >= 0 ? (list[existingIndex].owner_key || ownerKey()) : ownerKey(),
      recovery_resolution: existingIndex >= 0 ? (list[existingIndex].recovery_resolution || '') : ''
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
        const failed = {
          ...item,
          status: isConflict ? 'conflict' : 'pending',
          error: msg,
          attempts: Number(item.attempts || 0) + 1,
          conflict_details: detail,
          owner_key: item?.owner_key || ownerKey(),
          local_payload: item?.payload || {},
          server_payload: isConflict ? serverSnapshotFromError(err, detail) : (item?.server_payload || null),
          conflict_detected_at: isConflict ? (item?.conflict_detected_at || new Date().toISOString()) : (item?.conflict_detected_at || null)
        };
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

  function getRecoveryItems(options = {}) {
    const includeLegacy = options?.includeLegacy === true;
    const owner = ownerKey();
    return getActionItems().filter((item) => {
      if (item?.status !== 'conflict') return false;
      if (item?.owner_key) return owner && String(item.owner_key) === owner;
      return includeLegacy;
    });
  }

  function getRecoveryComparison(itemOrId) {
    const item = typeof itemOrId === 'object' && itemOrId
      ? itemOrId
      : getActionItem(itemOrId);
    if (!item) return null;
    const localPayload = item?.payload || item?.local_payload || {};
    const serverPayload = item?.server_payload && typeof item.server_payload === 'object'
      ? item.server_payload
      : null;
    return {
      id: item.id,
      conflict_key: item.conflict_key || '',
      scope: item.scope || 'general',
      action_type: item.action_type || 'unknown',
      label: item.label || item.action_type || 'Queued action',
      error: item.error || '',
      local_payload: localPayload,
      server_payload: serverPayload,
      server_snapshot_available: Boolean(serverPayload),
      merge_available: Boolean(serverPayload && localPayload && typeof localPayload === 'object' && !Array.isArray(localPayload))
    };
  }

  function applyRecoveryAction(id, action, options = {}) {
    const supported = ['keep_mine', 'keep_server', 'merge', 'retry', 'discard'];
    if (!supported.includes(action)) throw new Error('Unsupported conflict recovery action.');
    const item = getActionItem(id);
    if (!item || item.status !== 'conflict') throw new Error('Conflict item is no longer available.');
    const currentOwner = ownerKey();
    if (item.owner_key && (!currentOwner || String(item.owner_key) !== currentOwner)) {
      throw new Error('This queued conflict belongs to a different signed-in profile.');
    }

    const note = String(options?.note || '').slice(0, 500);
    if (action === 'keep_server' || action === 'discard') {
      recordRecovery(item, action, note);
      removeActionItem(id);
      document.dispatchEvent(new CustomEvent('ywi:conflict-recovery', { detail: { id, action, removed: true } }));
      return { action, removed: true };
    }

    let updates = {
      status: 'pending',
      recovery_resolution: action,
      recovery_note: note,
      error: '',
      conflict_details: [],
      resolved_at: new Date().toISOString()
    };

    if (action === 'merge') {
      const merged = options?.merged_payload;
      if (!merged || typeof merged !== 'object' || Array.isArray(merged)) {
        throw new Error('Merge requires an explicit merged object. Automatic merge is disabled.');
      }
      updates = { ...updates, payload: merged, local_payload: merged };
    }

    const next = updateActionItem(id, updates);
    recordRecovery(next || item, action, note);
    document.dispatchEvent(new CustomEvent('ywi:conflict-recovery', { detail: { id, action, item: next } }));
    return { action, removed: false, item: next };
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
    RECOVERY_HISTORY_KEY,
    notifyQueueChanged,
    getActionItems,
    setActionItems,
    queueAction,
    retryQueuedActions,
    getActionItem,
    updateActionItem,
    resolveActionConflict,
    removeActionItem,
    getActionSummary,
    getRecoveryItems,
    getRecoveryComparison,
    applyRecoveryAction,
    getRecoveryHistory
  };
})();

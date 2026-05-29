/* File: js/mobile-form-helper.js
   Brief description: Mobile-first form stepper and draft resume helper.
   Adds safe, reusable phone guidance to the field forms without changing
   submit payloads or blocking existing offline outbox behavior.
*/

'use strict';

(function () {
  const DRAFT_PREFIX = 'ywi.mobile.form.draft.';
  const MOBILE_QUERY = '(max-width: 759px)';

  const FORM_CONFIGS = {
    toolboxForm: {
      route: '#toolbox',
      title: 'Toolbox Talk',
      steps: [
        { key: 'basics', label: 'Basics', target: '#tb_site' },
        { key: 'topic', label: 'Topic', target: '#tb_topic' },
        { key: 'attendees', label: 'Attendees', target: '#tbAttendees' },
        { key: 'photos', label: 'Photos', target: '#tb_image_files' },
        { key: 'submit', label: 'Submit', target: '#toolboxForm button[type="submit"]' }
      ]
    },
    ppeForm: {
      route: '#ppe',
      title: 'PPE Check',
      steps: [
        { key: 'basics', label: 'Basics', target: '#ppe_site' },
        { key: 'items', label: 'Items', target: '#ppeItems' },
        { key: 'notes', label: 'Notes', target: '#ppe_notes' },
        { key: 'submit', label: 'Submit', target: '#ppeForm button[type="submit"]' }
      ]
    },
    faForm: {
      route: '#firstaid',
      title: 'First Aid Kit',
      steps: [
        { key: 'basics', label: 'Basics', target: '#fa_site' },
        { key: 'items', label: 'Items', target: '#faItems' },
        { key: 'notes', label: 'Notes', target: '#fa_notes' },
        { key: 'submit', label: 'Submit', target: '#faForm button[type="submit"]' }
      ]
    },
    incidentForm: {
      route: '#incident',
      title: 'Incident / Near Miss',
      steps: [
        { key: 'basics', label: 'Basics', target: '#inc_site' },
        { key: 'event', label: 'Event', target: '#inc_event_summary' },
        { key: 'actions', label: 'Actions', target: '#inc_immediate_actions' },
        { key: 'photos', label: 'Photos', target: '#inc_image_files' },
        { key: 'submit', label: 'Submit', target: '#incidentForm button[type="submit"]' }
      ]
    },
    inspForm: {
      route: '#inspect',
      title: 'Site Inspection',
      steps: [
        { key: 'basics', label: 'Basics', target: '#insp_site' },
        { key: 'items', label: 'Items', target: '#inspItems' },
        { key: 'photos', label: 'Photos', target: '#insp_image_files' },
        { key: 'submit', label: 'Submit', target: '#inspForm button[type="submit"]' }
      ]
    },
    drForm: {
      route: '#drill',
      title: 'Emergency Drill',
      steps: [
        { key: 'basics', label: 'Basics', target: '#dr_site' },
        { key: 'scenario', label: 'Scenario', target: '#dr_scenario' },
        { key: 'attendees', label: 'Attendees', target: '#drAttendees' },
        { key: 'submit', label: 'Submit', target: '#drForm button[type="submit"]' }
      ]
    }
  };

  const state = {
    bound: false,
    media: null,
    timers: new Map()
  };

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function escHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function isMobile() {
    if (!state.media && typeof window.matchMedia === 'function') {
      state.media = window.matchMedia(MOBILE_QUERY);
    }
    return !!state.media?.matches;
  }

  function draftKey(formId) {
    return `${DRAFT_PREFIX}${formId}`;
  }

  function getFieldKey(field) {
    return field.id || field.name || '';
  }

  function shouldSkipField(field) {
    const type = String(field.type || '').toLowerCase();
    return !getFieldKey(field) || ['file', 'button', 'submit', 'reset', 'password', 'hidden'].includes(type);
  }

  function fieldValue(field) {
    const type = String(field.type || '').toLowerCase();
    if (type === 'checkbox') return !!field.checked;
    if (type === 'radio') return field.checked ? field.value : undefined;
    if (field.tagName === 'SELECT' && field.multiple) {
      return Array.from(field.selectedOptions || []).map((option) => option.value);
    }
    return field.value ?? '';
  }

  function setFieldValue(field, value) {
    const type = String(field.type || '').toLowerCase();
    if (type === 'checkbox') field.checked = !!value;
    else if (type === 'radio') field.checked = String(field.value) === String(value);
    else if (field.tagName === 'SELECT' && field.multiple && Array.isArray(value)) {
      Array.from(field.options || []).forEach((option) => { option.selected = value.includes(option.value); });
    } else if (value !== undefined) {
      field.value = value;
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function collectValues(form) {
    const values = {};
    form.querySelectorAll('input, select, textarea').forEach((field) => {
      if (shouldSkipField(field)) return;
      const key = getFieldKey(field);
      const value = fieldValue(field);
      if (value !== undefined) values[key] = value;
    });
    return values;
  }

  function hasMeaningfulValue(values) {
    return Object.entries(values || {}).some(([key, value]) => {
      if (key.endsWith('_date') && String(value || '') === new Date().toISOString().slice(0, 10)) return false;
      if (typeof value === 'boolean') return value;
      if (Array.isArray(value)) return value.length > 0;
      return String(value ?? '').trim().length > 0;
    });
  }

  function readDraft(formId) {
    try {
      const raw = localStorage.getItem(draftKey(formId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeDraft(form, config, silent = false) {
    const values = collectValues(form);
    if (!hasMeaningfulValue(values)) {
      if (!silent) setStatus(form, 'Nothing to save yet.');
      return false;
    }

    const payload = {
      form_id: form.id,
      title: config.title,
      route: config.route,
      saved_at: new Date().toISOString(),
      values
    };

    localStorage.setItem(draftKey(form.id), JSON.stringify(payload));
    setStatus(form, `Draft saved ${new Date(payload.saved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
    notifyDraftsChanged();
    return true;
  }

  function restoreDraft(form, config) {
    const draft = readDraft(form.id);
    if (!draft?.values) {
      setStatus(form, 'No saved draft found for this form.');
      return false;
    }

    form.querySelectorAll('input, select, textarea').forEach((field) => {
      if (shouldSkipField(field)) return;
      const key = getFieldKey(field);
      if (Object.prototype.hasOwnProperty.call(draft.values, key)) setFieldValue(field, draft.values[key]);
    });

    setStatus(form, `Draft resumed from ${new Date(draft.saved_at || Date.now()).toLocaleString()}.`);
    notifyDraftsChanged();
    return true;
  }

  function clearDraft(form) {
    localStorage.removeItem(draftKey(form.id));
    setStatus(form, 'Saved draft cleared for this form.');
    syncAssist(form);
    notifyDraftsChanged();
  }

  function getAssist(form) {
    return document.querySelector(`[data-mobile-form-assist-for="${form.id}"]`);
  }

  function setStatus(form, message) {
    const assist = getAssist(form);
    const status = assist?.querySelector('[data-mobile-form-status]');
    if (status) status.textContent = message || '';
  }

  function draftLabel(formId) {
    const draft = readDraft(formId);
    if (!draft?.saved_at) return 'No saved draft';
    return `Saved ${new Date(draft.saved_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  }

  function stepTarget(step) {
    const target = $(step.target);
    if (target && !target.id) target.id = `mobile-step-${step.key}-${Math.random().toString(36).slice(2, 8)}`;
    return target;
  }

  function currentStepIndex(form) {
    const assist = getAssist(form);
    return Math.max(0, Number(assist?.dataset.currentStep || 0));
  }

  function goToStep(form, config, index) {
    const steps = config.steps || [];
    if (!steps.length) return;
    const safeIndex = Math.max(0, Math.min(index, steps.length - 1));
    const assist = getAssist(form);
    if (assist) assist.dataset.currentStep = String(safeIndex);
    assist?.querySelectorAll('[data-mobile-form-step]').forEach((chip) => {
      chip.classList.toggle('active', Number(chip.getAttribute('data-mobile-form-step')) === safeIndex);
    });
    const target = stepTarget(steps[safeIndex]);
    if (target) {
      target.classList.add('mobile-form-step-target');
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => target.classList.remove('mobile-form-step-target'), 1600);
    }
  }

  function syncAssist(form) {
    const assist = getAssist(form);
    if (!assist) return;
    const label = assist.querySelector('[data-mobile-form-draft-label]');
    if (label) label.textContent = draftLabel(form.id);
    const hasDraft = !!readDraft(form.id);
    assist.querySelector('[data-mobile-form-action="restore"]')?.toggleAttribute('disabled', !hasDraft);
    assist.querySelector('[data-mobile-form-action="clear"]')?.toggleAttribute('disabled', !hasDraft);
  }

  function scheduleAutoSave(form, config) {
    window.clearTimeout(state.timers.get(form.id));
    state.timers.set(form.id, window.setTimeout(() => {
      if (form.dataset.mobileFormDirty === '1') {
        writeDraft(form, config, true);
        form.dataset.mobileFormDirty = '0';
      }
      syncAssist(form);
    }, 1800));
  }

  function assistMarkup(form, config) {
    const chips = (config.steps || []).map((step, index) => `
      <button type="button" class="mobile-form-chip" data-mobile-form-step="${index}">${escHtml(step.label)}</button>
    `).join('');

    return `
      <div class="mobile-form-assist" data-mobile-form-assist-for="${escHtml(form.id)}" data-current-step="0">
        <div class="mobile-form-assist-top">
          <div>
            <strong>${escHtml(config.title)} mobile guide</strong>
            <small data-mobile-form-draft-label>${escHtml(draftLabel(form.id))}</small>
          </div>
          <span class="mobile-form-online-pill">${navigator.onLine === false ? 'Offline-ready' : 'Online'}</span>
        </div>
        <div class="mobile-form-stepper" aria-label="${escHtml(config.title)} mobile form steps">${chips}</div>
        <div class="mobile-form-controls">
          <button type="button" class="secondary" data-mobile-form-action="prev">Back</button>
          <button type="button" class="secondary" data-mobile-form-action="next">Next</button>
          <button type="button" class="secondary" data-mobile-form-action="save">Save Draft</button>
          <button type="button" class="secondary" data-mobile-form-action="restore">Resume Draft</button>
          <button type="button" class="secondary" data-mobile-form-action="clear">Clear</button>
        </div>
        <div class="mobile-form-status" data-mobile-form-status>Use the chips to jump through this form on a phone. Drafts save only on this device.</div>
      </div>
    `;
  }

  function enhanceForm(form, config) {
    if (!form || form.dataset.mobileFormAssistReady === '1') return;
    form.dataset.mobileFormAssistReady = '1';
    form.classList.add('has-mobile-form-assist');
    form.insertAdjacentHTML('beforebegin', assistMarkup(form, config));
    const assist = getAssist(form);
    assist?.querySelectorAll('[data-mobile-form-step]').forEach((chip) => {
      chip.addEventListener('click', () => goToStep(form, config, Number(chip.getAttribute('data-mobile-form-step') || 0)));
    });
    assist?.addEventListener('click', (event) => {
      const action = event.target?.closest?.('[data-mobile-form-action]')?.getAttribute('data-mobile-form-action');
      if (!action) return;
      if (action === 'prev') goToStep(form, config, currentStepIndex(form) - 1);
      if (action === 'next') goToStep(form, config, currentStepIndex(form) + 1);
      if (action === 'save') writeDraft(form, config, false);
      if (action === 'restore') restoreDraft(form, config);
      if (action === 'clear') clearDraft(form);
      syncAssist(form);
    });
    form.addEventListener('input', () => {
      form.dataset.mobileFormDirty = '1';
      scheduleAutoSave(form, config);
    });
    form.addEventListener('change', () => {
      form.dataset.mobileFormDirty = '1';
      scheduleAutoSave(form, config);
    });
    form.addEventListener('submit', () => {
      localStorage.removeItem(draftKey(form.id));
      notifyDraftsChanged();
    });
    syncAssist(form);
  }

  function enhanceAvailableForms() {
    Object.entries(FORM_CONFIGS).forEach(([formId, config]) => {
      const form = document.getElementById(formId);
      if (form) enhanceForm(form, config);
    });
  }

  function draftSummaries() {
    const rows = [];
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i) || '';
        if (!key.startsWith(DRAFT_PREFIX)) continue;
        const draft = JSON.parse(localStorage.getItem(key) || '{}');
        if (draft?.form_id) rows.push(draft);
      }
    } catch {}
    return rows.sort((a, b) => String(b.saved_at || '').localeCompare(String(a.saved_at || '')));
  }

  function countDrafts() {
    return draftSummaries().length;
  }

  function notifyDraftsChanged() {
    const detail = { draft_count: countDrafts(), drafts: draftSummaries() };
    document.dispatchEvent(new CustomEvent('ywi:mobile-drafts-updated', { detail }));
    document.dispatchEvent(new CustomEvent('ywi:mobile-badges-updated', { detail }));
    try { window.YWIMobileMenu?.syncBadges?.(); } catch {}
    try { window.YWIMobileToday?.render?.(); } catch {}
  }

  function bind() {
    if (state.bound) return;
    state.bound = true;
    enhanceAvailableForms();
    const observer = new MutationObserver(() => enhanceAvailableForms());
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('ywi:route-shown', enhanceAvailableForms);
    document.addEventListener('DOMContentLoaded', enhanceAvailableForms);
    window.addEventListener('online', notifyDraftsChanged);
    window.addEventListener('offline', notifyDraftsChanged);
    if (typeof window.matchMedia === 'function') {
      state.media = window.matchMedia(MOBILE_QUERY);
      state.media.addEventListener?.('change', enhanceAvailableForms);
    }
    window.setTimeout(enhanceAvailableForms, 700);
  }

  window.YWIMobileFormAssist = {
    bind,
    enhanceAvailableForms,
    countDrafts,
    draftSummaries,
    saveDraft: (formId) => {
      const form = document.getElementById(formId);
      const config = FORM_CONFIGS[formId];
      return form && config ? writeDraft(form, config, false) : false;
    },
    restoreDraft: (formId) => {
      const form = document.getElementById(formId);
      const config = FORM_CONFIGS[formId];
      return form && config ? restoreDraft(form, config) : false;
    },
    isMobile
  };

  document.addEventListener('DOMContentLoaded', bind);
})();

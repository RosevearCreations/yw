/* Build 252 — bind the Admin next-safe-action card to live staging execution truth.
   This add-on performs status-only reads. It never records/finalizes/signs staging
   evidence and never turns a source-ready candidate into mutation authority. */
'use strict';

(function () {
  const state = { loading:false, payload:null, error:'', observer:null };
  const esc = (value) => window.YWIAPI?.escHtml?.(value) || String(value ?? '')
    .replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function authState() { return window.YWI_AUTH?.getState?.() || {}; }
  function isAdmin() { return String(authState().role || '').toLowerCase() === 'admin'; }
  function panel() { return document.getElementById('adminNextSafeActionPanel'); }
  function isStagingCandidate(host = panel()) {
    const text = String(host?.textContent || '').toLowerCase();
    return text.includes('staging ready candidate') || text.includes('candidate after environment guard');
  }

  function ensureGate() {
    const host = panel();
    if (!host || !isAdmin() || !isStagingCandidate(host)) {
      document.getElementById('adminNextSafeActionRuntimeGate')?.remove();
      return null;
    }
    let gate = document.getElementById('adminNextSafeActionRuntimeGate');
    if (!gate) {
      gate = document.createElement('div');
      gate.id = 'adminNextSafeActionRuntimeGate';
      gate.style.marginTop = '12px';
      host.appendChild(gate);
      render();
    }
    return gate;
  }

  function executionTruth() {
    const guard = state.payload?.environment_guard || {};
    const schema = state.payload?.schema_authority || {};
    const environmentReady = guard.mutation_allowed === true;
    const schemaReady = schema.exact_schema_match === true;
    return { guard, schema, environmentReady, schemaReady, runnable:environmentReady && schemaReady };
  }

  function render() {
    const gate = document.getElementById('adminNextSafeActionRuntimeGate') || ensureGate();
    if (!gate) return false;

    if (state.loading && !state.payload) {
      gate.className = 'notice next-safe-action-runtime-gate';
      gate.innerHTML = '<strong>Runtime execution gate: CHECKING</strong><div>Status-only staging guard read in progress. No staging mutation is being performed.</div>';
      return true;
    }

    const { guard, schema, runnable } = executionTruth();
    const status = runnable ? 'RUNNABLE' : 'LOCKED';
    const runtime = guard.runtime_environment || 'unknown';
    const actual = guard.actual_project_ref || 'unresolved';
    const expected = guard.expected_staging_project_ref || 'not configured';
    const schemaExpected = schema.expected_schema_version ?? 'unknown';
    const schemaLive = schema.latest_applied_schema_version ?? 'unknown';
    const reason = state.error || guard.reason || (runnable
      ? 'Dedicated non-production environment and exact current schema are both proven.'
      : 'Staging execution authority is not proven; mutation remains locked.');
    const schemaReason = schema.exact_schema_match === true ? '' : (schema.message || 'Exact current-schema proof is unavailable.');

    gate.className = `${runnable ? 'help-callout' : 'it-readiness-error'} next-safe-action-runtime-gate`;
    gate.innerHTML = `<strong>Runtime execution gate: ${esc(status)}</strong>
      <div><small>Runtime ${esc(runtime)} · current project ${esc(actual)} · expected staging project ${esc(expected)}</small></div>
      <div><small>Expected Schema ${esc(schemaExpected)} · live Schema ${esc(schemaLive)}</small></div>
      <div><small>${esc(reason)}</small></div>
      ${schemaReason ? `<div><small>${esc(schemaReason)}</small></div>` : ''}
      <div><small><strong>Source-ready does not mean runnable staging.</strong> This card uses a status-only guard read and does not authorize staging mutation.</small></div>
      <div class="it-readiness-actions" style="margin-top:8px"><button id="adminNextSafeActionRuntimeRefresh" type="button" class="secondary">Refresh execution gate</button></div>`;
    document.getElementById('adminNextSafeActionRuntimeRefresh')?.addEventListener('click', () => load(true));
    return true;
  }

  async function load(force = false) {
    const host = ensureGate();
    if (!host || !isAdmin() || state.loading) return;
    if (state.payload && !force) { render(); return; }
    state.loading = true;
    state.error = '';
    render();
    try {
      const payload = await window.YWIAPI?.jsonFetch?.('admin-staging-acceptance', {
        method:'POST',
        body:{ action:'status' },
        requireAuth:true,
        timeoutMs:45000,
      });
      if (!payload) throw new Error('Staging status endpoint returned no data.');
      state.payload = payload;
    } catch (err) {
      state.payload = {
        environment_guard:{ mutation_allowed:false, runtime_environment:'unknown', reason:'Status-only staging guard could not be loaded; staging mutation remains locked.' },
        schema_authority:{ exact_schema_match:false, message:'Exact current-schema proof could not be loaded.' }
      };
      state.error = err?.message || 'Unable to read staging execution guard.';
    } finally {
      state.loading = false;
      render();
    }
  }

  function ensure() {
    const gate = ensureGate();
    if (gate && !state.payload && !state.loading) load();
  }

  function bind() {
    if (state.observer) return;
    state.observer = new MutationObserver(() => {
      const host = panel();
      if (!host || !isStagingCandidate(host)) return;
      if (!document.getElementById('adminNextSafeActionRuntimeGate')) queueMicrotask(ensure);
    });
    state.observer.observe(document.documentElement, { childList:true, subtree:true });
    document.addEventListener('ywi:module-loaded', (event) => {
      if (event.detail?.moduleKey === 'admin') queueMicrotask(ensure);
    });
    document.addEventListener('ywi:auth-changed', () => {
      state.payload = null;
      state.error = '';
      queueMicrotask(ensure);
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure, { once:true });
    else queueMicrotask(ensure);
  }

  bind();
  window.YWINextSafeActionRuntimeGate = Object.freeze({ load, render });
})();

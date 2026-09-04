/* Admin account security + current I.T. work authority.
   Existing passwords are never available. Admin may replace another active user's
   password with an audited temporary password that must be changed by the user. */
'use strict';

(function () {
  const state = { loading:false, payload:null, selected:null, temporaryPassword:'', message:'', error:'' };
  const byId = (id) => document.getElementById(id);
  const esc = (value) => window.YWIAPI?.escHtml?.(value) || String(value ?? '')
    .replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function authState() { return window.YWI_AUTH?.getState?.() || {}; }
  function isAdmin() { return String(authState().role || '').toLowerCase() === 'admin'; }

  function generateTemporaryPassword(length = 16) {
    const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ','abcdefghijkmnopqrstuvwxyz','23456789','!@#$%&*+-_='];
    const all = groups.join('');
    const bytes = new Uint32Array(Math.max(length, groups.length));
    crypto.getRandomValues(bytes);
    const chars = groups.map((group, i) => group[bytes[i] % group.length]);
    for (let i = groups.length; i < Math.max(length, 12); i += 1) chars.push(all[bytes[i] % all.length]);
    for (let i = chars.length - 1; i > 0; i -= 1) {
      const j = bytes[i % bytes.length] % (i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('en-CA');
  }

  function nextSafeActionHtml() {
    const status = state.payload?.next_safe_action_status || {};
    const queue = Array.isArray(state.payload?.next_safe_action_queue) ? state.payload.next_safe_action_queue : [];
    const next = queue[0] || {};
    const title = status.next_todo_title || next.todo_title || 'No unresolved action';
    const action = status.next_action || next.current_action || 'No current unresolved action requires prioritization.';
    const note = status.next_safety_note || next.safety_note || 'Continue to use current release and environment guards.';
    const actionClass = status.next_action_class || next.action_class || 'none';
    const candidate = status.safe_candidate_after_environment_guard === true || next.safe_candidate_after_environment_guard === true;
    return `<section class="it-readiness-panel" id="adminNextSafeActionPanel">
      <span class="it-readiness-kicker">Next safe action</span>
      <h3>${esc(title)}</h3>
      <p><strong>${esc(actionClass.replaceAll('_',' '))}</strong>${candidate ? ' · candidate after environment guard' : ''}</p>
      <p><b>Current action:</b> ${esc(action)}</p>
      <p class="muted"><b>Safety:</b> ${esc(note)}</p>
      <p class="muted">${Number(status.staging_ready_candidate_count || 0)} staging-ready · ${Number(status.external_verification_count || 0)} external verification · ${Number(status.pending_human_or_provider_count || 0)} content/provider pending · ${Number(status.blocked_accounting_count || 0)} accounting blocked.</p>
      <p class="muted">Priority is guidance only. It does not authorize staging mutation, close a rail, change Auth, publish content, enable Finance/provider mutation, or promote Production.</p>
    </section>`;
  }

  function currentTodoHtml() {
    const rows = Array.isArray(state.payload?.current_todo) ? state.payload.current_todo : [];
    const status = state.payload?.current_todo_status || {};
    return `<section class="it-readiness-panel" id="adminCurrentTodoPanel">
      <span class="it-readiness-kicker">Current Admin To-Do</span>
      <h3>Only unresolved current requirements</h3>
      <p>${Number(status.current_todo_count || rows.length)} current item(s) · ${Number(status.business_acceptance_count || 0)} business acceptance · ${Number(status.security_followup_count || 0)} security · ${Number(status.repository_followup_count || 0)} repository.</p>
      <p class="muted">Completed builds and superseded preflight/prerelease checklists are retained for audit but removed from this active list.</p>
      ${rows.length ? `<div class="it-readiness-list">${rows.map((row) => `<div class="it-readiness-row"><div><strong>${esc(row.todo_title || row.todo_key)}</strong><small><b>Current action:</b> ${esc(row.current_action || '')}</small><small><b>Evidence:</b> ${esc(row.evidence_requirement || '')}</small><small>${esc([row.source_kind, row.requires_human ? 'human required' : '', row.requires_external ? 'external evidence' : ''].filter(Boolean).join(' · '))}</small></div><span class="it-readiness-status warning">${esc(row.todo_status || 'pending')}</span></div>`).join('')}</div>` : '<div class="it-readiness-empty">No current unresolved Admin To-Do items.</div>'}
    </section>`;
  }

  function accountsHtml() {
    const rows = Array.isArray(state.payload?.accounts) ? state.payload.accounts : [];
    const me = authState().profile?.id || authState().user?.id || '';
    return `<section class="it-readiness-panel" id="adminAccountSecurityPanel">
      <span class="it-readiness-kicker">Account security</span>
      <h3>Admin password recovery</h3>
      <p><b>Existing passwords cannot be viewed.</b> Supabase stores one-way password hashes. An Admin can replace another active user's password with an audited temporary password; the user must then choose a permanent password before normal module access resumes.</p>
      ${state.message ? `<div class="notice">${esc(state.message)}</div>` : ''}
      ${state.error ? `<div class="it-readiness-error">${esc(state.error)}</div>` : ''}
      <div style="overflow:auto"><table class="data-table" style="min-width:900px"><thead><tr><th>User</th><th>Username</th><th>Email</th><th>Role</th><th>Account</th><th>Password state</th><th>Last change</th><th>Action</th></tr></thead><tbody>
      ${rows.map((row) => `<tr data-profile-id="${esc(row.profile_id)}"><td>${esc(row.full_name || row.profile_id)}</td><td>${esc(row.username || '—')}</td><td>${esc(row.email || '—')}</td><td>${esc(row.role || '—')}</td><td>${row.is_active===false?'Inactive':'Active'}</td><td>${row.password_reset_required===true?'<strong>Temporary password — change required</strong>':(row.password_login_ready===true?'Ready':'Setup pending')}</td><td>${esc(formatDate(row.password_changed_at))}</td><td>${row.profile_id===me?'<small>Use Account & Security</small>':`<button type="button" class="secondary admin-temp-reset-open" data-profile-id="${esc(row.profile_id)}" ${row.is_active===false?'disabled':''}>Set temporary password</button>`}</td></tr>`).join('') || '<tr><td colspan="8">No profile rows returned.</td></tr>'}
      </tbody></table></div>
      <div id="adminTempPasswordEditor" style="margin-top:14px"></div>
    </section>`;
  }

  function editorHtml() {
    const row = state.selected;
    if (!row) return '';
    const password = state.temporaryPassword || generateTemporaryPassword();
    state.temporaryPassword = password;
    return `<div class="notice"><strong>Set temporary password for ${esc(row.full_name || row.username || row.email || row.profile_id)}</strong>
      <p style="margin-top:6px">The current password is not required and cannot be retrieved. Give this temporary password to the user through an appropriate private channel. It is not stored in the Yard Weasels database.</p>
      <div class="form-grid">
        <label>Temporary password<input id="adminTemporaryPassword" type="password" data-ywi-password-field="1" autocomplete="new-password" value="${esc(password)}" /></label>
        <label>Audit reason<input id="adminTemporaryPasswordReason" type="text" maxlength="240" placeholder="Example: user forgot password" /></label>
      </div>
      <div class="form-footer" style="margin-top:10px"><button id="adminGenerateTemporaryPassword" type="button" class="secondary">Generate another</button><button id="adminSetTemporaryPassword" type="button">Set temporary password</button><button id="adminCancelTemporaryPassword" type="button" class="secondary">Cancel</button></div>
    </div>`;
  }

  function hideHistoricalTodoPanels() {
    const workspace = byId('itReadinessWorkspace');
    if (!workspace) return;
    const hideKickers = new Set(['Outstanding work','Preflight','Deployment','Functions','Production']);
    workspace.querySelectorAll('.it-readiness-panel').forEach((panel) => {
      const kicker = panel.querySelector('.it-readiness-kicker')?.textContent?.trim() || '';
      if (hideKickers.has(kicker)) {
        panel.hidden = true;
        panel.dataset.ywiAuditOnly = '1';
      }
    });
    const shell = workspace.querySelector('.it-readiness-shell');
    if (shell && !byId('itLegacyArchiveNotice')) {
      const note = document.createElement('div');
      note.id = 'itLegacyArchiveNotice';
      note.className = 'notice';
      note.innerHTML = '<strong>Current-work cleanup active</strong><div>Completed and superseded preflight, deployment, function-readiness, and release checklist rows are archived from the active To-Do display. Their database history is retained for audit.</div>';
      shell.insertBefore(note, shell.children[1] || null);
    }
  }

  function render() {
    const host = byId('adminAccountSecurityWorkspace');
    if (!host) return;
    if (!isAdmin()) {
      host.innerHTML = '<div class="it-readiness-error">Admin manage access is required for account-security controls.</div>';
      return;
    }
    if (state.loading) {
      host.innerHTML = '<div class="it-readiness-loading">Loading current Admin security state…</div>';
      return;
    }
    if (!state.payload) {
      host.innerHTML = '<button id="adminAccountSecurityLoad" type="button">Load account security & current To-Do</button>';
      byId('adminAccountSecurityLoad')?.addEventListener('click', load);
      return;
    }
    host.innerHTML = `<div class="it-readiness-grid">${nextSafeActionHtml()}${currentTodoHtml()}${accountsHtml()}</div>`;
    renderEditor();
    bindActions();
    hideHistoricalTodoPanels();
  }

  function renderEditor() {
    const editor = byId('adminTempPasswordEditor');
    if (!editor) return;
    editor.innerHTML = editorHtml();
    window.YWIPasswordSecurity?.bindPasswordVisibility?.(editor);
  }

  function bindActions() {
    document.querySelectorAll('.admin-temp-reset-open').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.profileId || '';
        state.selected = (state.payload?.accounts || []).find((row) => row.profile_id === id) || null;
        state.temporaryPassword = generateTemporaryPassword();
        state.message = '';
        state.error = '';
        renderEditor();
        bindEditorActions();
      });
    });
    bindEditorActions();
  }

  function bindEditorActions() {
    byId('adminGenerateTemporaryPassword')?.addEventListener('click', () => {
      state.temporaryPassword = generateTemporaryPassword();
      const input = byId('adminTemporaryPassword');
      if (input) input.value = state.temporaryPassword;
    });
    byId('adminCancelTemporaryPassword')?.addEventListener('click', () => {
      state.selected = null;
      state.temporaryPassword = '';
      renderEditor();
    });
    byId('adminSetTemporaryPassword')?.addEventListener('click', resetTemporaryPassword);
  }

  async function load() {
    if (!isAdmin() || state.loading) return;
    state.loading = true;
    state.error = '';
    render();
    try {
      const payload = await window.YWIAPI.jsonFetch('admin-account-security', { method:'POST', body:{ action:'overview' }, requireAuth:true });
      if (!payload?.ok) throw new Error(payload?.error || 'Unable to load Admin account security.');
      state.payload = payload;
    } catch (err) {
      state.error = err?.message || 'Unable to load Admin account security.';
      state.payload = { accounts:[], current_todo:[], current_todo_status:null, next_safe_action_status:null, next_safe_action_queue:[] };
    } finally {
      state.loading = false;
      render();
    }
  }

  async function resetTemporaryPassword() {
    if (!state.selected) return;
    const input = byId('adminTemporaryPassword');
    const reasonInput = byId('adminTemporaryPasswordReason');
    const password = String(input?.value || '');
    const reason = String(reasonInput?.value || '').trim();
    const button = byId('adminSetTemporaryPassword');
    if (button) button.disabled = true;
    state.error = '';
    try {
      const payload = await window.YWIAPI.jsonFetch('admin-account-security', {
        method:'POST',
        body:{ action:'reset_temporary_password', target_profile_id:state.selected.profile_id, temporary_password:password, reason },
        requireAuth:true,
      });
      if (!payload?.ok) throw new Error(payload?.error || 'Temporary password reset failed.');
      state.message = `${payload.target_label || 'User'} now has the temporary password shown in the editor. They must replace it in Account & Security before normal module access resumes.`;
      state.selected = null;
      state.temporaryPassword = '';
      await load();
    } catch (err) {
      state.error = err?.message || 'Temporary password reset failed.';
      if (button) button.disabled = false;
      render();
    }
  }

  function ensureHost() {
    const admin = byId('admin');
    if (!admin || byId('adminAccountSecurityWorkspace')) return;
    const host = document.createElement('div');
    host.id = 'adminAccountSecurityWorkspace';
    host.style.marginTop = '18px';
    admin.appendChild(host);
    render();
  }

  const readinessObserver = new MutationObserver(() => hideHistoricalTodoPanels());
  document.addEventListener('ywi:module-loaded', (event) => {
    if (event.detail?.moduleKey !== 'admin') return;
    ensureHost();
    load();
    const readiness = byId('itReadinessWorkspace');
    if (readiness) readinessObserver.observe(readiness, { childList:true, subtree:true });
  });
  document.addEventListener('ywi:auth-changed', () => {
    if (isAdmin()) { ensureHost(); if (!state.payload) load(); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureHost, { once:true });
  else ensureHost();

  window.YWIAdminAccountSecurity = Object.freeze({ load, generateTemporaryPassword, hideHistoricalTodoPanels });
})();

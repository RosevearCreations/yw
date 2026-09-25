/* File: js/mobile-today.js
   Brief description: Phone-first Today dashboard, field sync-health authority,
   PWA install helper, and presentation-only desktop Jobs workbench controls.
*/

'use strict';

(function () {
  const state = {
    bound: false,
    deferredInstallPrompt: null,
    lastRenderKey: '',
    jobsObserver: null,
    crewContext: null,
    crewLoading: false,
    crewError: '',
    crewLoadedAt: 0,
    crewTab: 'route'
  };

  function authState() {
    return window.YWI_AUTH?.getState?.() || {};
  }

  function security() {
    return window.YWISecurity || null;
  }

  function router() {
    return window.YWIRouter || null;
  }

  function outbox() {
    return window.YWIOutbox || null;
  }

  function normalizeRole(role) {
    return security()?.normalizeRole?.(role) || String(role || 'employee').trim().toLowerCase() || 'employee';
  }

  function roleLabel(role) {
    return security()?.getRoleLabel?.(role) || 'Employee';
  }

  function canView(section) {
    const role = currentRole();
    return security()?.canViewSection ? security().canViewSection(section, role) : true;
  }

  function currentRole() {
    const stateRole = authState().role || authState().profile?.role || 'employee';
    return normalizeRole(stateRole);
  }

  function countOutboxItems() {
    try { return outbox()?.getItems?.()?.length || 0; } catch { return 0; }
  }

  function actionSummary() {
    try {
      if (typeof outbox()?.getActionSummary === 'function') return outbox().getActionSummary() || {};
      const items = outbox()?.getActionItems?.() || [];
      return {
        total: items.length,
        conflicts: items.filter((item) => item?.status === 'conflict').length,
        pending: items.filter((item) => item?.status !== 'conflict').length,
        items
      };
    } catch {
      return { total: 0, conflicts: 0, pending: 0, items: [] };
    }
  }

  function countActionItems() {
    return Number(actionSummary().total || 0);
  }

  function countConflictItems() {
    return Number(actionSummary().conflicts || 0);
  }

  function countDraftForms() {
    try { return window.YWIMobileFormAssist?.countDrafts?.() || 0; } catch { return 0; }
  }

  function firstDraftRoute() {
    try { return window.YWIMobileFormAssist?.draftSummaries?.()?.[0]?.route || '#today'; } catch { return '#today'; }
  }

  function isStandalonePwa() {
    return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  }

  function syncSnapshot() {
    const summary = actionSummary();
    return {
      online: navigator.onLine !== false,
      forms: countOutboxItems(),
      drafts: countDraftForms(),
      actions: Number(summary.total || 0),
      conflicts: Number(summary.conflicts || 0),
      pendingActions: Number(summary.pending || 0)
    };
  }

  function syncState(snapshot = syncSnapshot()) {
    if (!snapshot.online) return 'offline';
    if (snapshot.conflicts > 0) return 'conflict';
    if (snapshot.forms > 0 || snapshot.drafts > 0 || snapshot.actions > 0) return 'pending';
    return 'current';
  }

  function syncLabel(snapshot = syncSnapshot()) {
    const value = syncState(snapshot);
    if (value === 'offline') return 'Offline — local work retained';
    if (value === 'conflict') return 'Review required — sync conflict';
    if (value === 'pending') return 'Pending local work';
    return 'Current with server';
  }

  function statusText() {
    const snapshot = syncSnapshot();
    const chunks = [];
    chunks.push(snapshot.online ? 'Online' : 'Offline mode');
    chunks.push(`${snapshot.forms} form submission${snapshot.forms === 1 ? '' : 's'} queued`);
    chunks.push(`${snapshot.drafts} saved form draft${snapshot.drafts === 1 ? '' : 's'}`);
    chunks.push(`${snapshot.actions} admin/action item${snapshot.actions === 1 ? '' : 's'} queued`);
    if (snapshot.conflicts) chunks.push(`${snapshot.conflicts} conflict${snapshot.conflicts === 1 ? '' : 's'} need review`);
    return chunks.join(' • ');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  }

  function prettyPayload(value) {
    try { return JSON.stringify(value ?? {}, null, 2); } catch { return String(value ?? ''); }
  }

  function recoveryItems() {
    try { return outbox()?.getRecoveryItems?.() || []; } catch { return []; }
  }

  function renderConflictRecovery(host) {
    host?.querySelector?.('#offlineConflictRecovery348')?.remove?.();
    const items = recoveryItems();
    if (!host || !items.length) return;

    const section = document.createElement('div');
    section.id = 'offlineConflictRecovery348';
    section.className = 'offline-conflict-recovery';
    section.setAttribute('aria-label', 'Offline and conflict recovery');
    section.innerHTML = `
      <div class="offline-recovery-head">
        <div><strong>Build 348 — Offline &amp; Conflict Recovery</strong><p>Compare what is still on this device with the server snapshot when the record contract supplied one. Nothing is overwritten automatically.</p></div>
        <span class="field-sync-state">${items.length} review</span>
      </div>
      <div class="offline-recovery-list">
        ${items.map((item) => {
          const comparison = outbox()?.getRecoveryComparison?.(item) || { local_payload:item?.payload || {}, server_payload:item?.server_payload || null, server_snapshot_available:Boolean(item?.server_payload), merge_available:Boolean(item?.server_payload) };
          const local = escapeHtml(prettyPayload(comparison.local_payload));
          const server = comparison.server_snapshot_available ? escapeHtml(prettyPayload(comparison.server_payload)) : 'Not supplied by this record contract.';
          return `<article class="offline-recovery-card" data-recovery-id="${escapeHtml(item.id)}">
            <div class="offline-recovery-card-head"><strong>${escapeHtml(comparison.label || item.label || item.action_type || 'Queued action')}</strong><small>${escapeHtml(item.scope || 'general')} · ${escapeHtml(item.action_type || 'unknown')}</small></div>
            ${comparison.error ? `<p class="offline-recovery-error">${escapeHtml(comparison.error)}</p>` : ''}
            <div class="offline-recovery-compare">
              <div><span>Mine — retained locally</span><pre>${local}</pre></div>
              <div><span>Server — authoritative snapshot</span><pre>${server}</pre></div>
            </div>
            <p class="field-sync-note">Keep Mine, Merge and Retry return the local item to its normal replay path; server conflict checks still apply. Keep Server or Discard removes the queued local mutation only after this explicit choice.</p>
            <div class="offline-recovery-actions">
              <button type="button" class="secondary" data-recovery-action="keep_mine">Keep Mine</button>
              <button type="button" class="secondary" data-recovery-action="keep_server">Keep Server</button>
              <button type="button" class="secondary" data-recovery-action="merge" ${comparison.merge_available ? '' : 'disabled title="No server snapshot is available for a deliberate merge."'}>Merge</button>
              <button type="button" class="secondary" data-recovery-action="retry">Retry</button>
              <button type="button" class="secondary" data-recovery-action="discard">Discard</button>
            </div>
          </article>`;
        }).join('')}
      </div>`;

    section.addEventListener('click', (event) => {
      const button = event.target?.closest?.('[data-recovery-action]');
      if (!button) return;
      const card = button.closest('[data-recovery-id]');
      const id = card?.dataset?.recoveryId || '';
      const action = button.dataset.recoveryAction || '';
      if (!id || !action) return;
      try {
        if ((action === 'keep_server' || action === 'discard') && !window.confirm(`Confirm ${action === 'keep_server' ? 'Keep Server' : 'Discard'}? The queued local mutation will be removed from the active outbox.`)) return;
        if (action === 'merge') {
          const comparison = outbox()?.getRecoveryComparison?.(id);
          const draft = window.prompt('Edit the merged JSON deliberately. Automatic merge is disabled.', prettyPayload(comparison?.local_payload || {}));
          if (draft === null) return;
          let merged;
          try { merged = JSON.parse(draft); } catch { throw new Error('Merged value must be valid JSON.'); }
          outbox()?.applyRecoveryAction?.(id, 'merge', { merged_payload: merged, note:'Manual merge prepared from Build 348 recovery.' });
        } else {
          outbox()?.applyRecoveryAction?.(id, action, { note:`Build 348 explicit ${action} decision.` });
        }
        render();
      } catch (error) {
        window.alert(error?.message || 'Conflict recovery action failed.');
      }
    });

    host.appendChild(section);
  }

  function ensureReliabilityStyles() {
    if (document.getElementById('fieldUxReliabilityStyles')) return;
    const style = document.createElement('style');
    style.id = 'fieldUxReliabilityStyles';
    style.textContent = `
      .field-sync-health{margin:0 0 14px;padding:14px;border:1px solid rgba(148,163,184,.22);border-radius:14px;background:rgba(15,23,42,.72)}
      .field-sync-health-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .field-sync-health-head strong{font-size:1rem}.field-sync-state{display:inline-flex;align-items:center;min-height:32px;padding:5px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.28);font-size:.82rem;font-weight:700}
      .field-sync-health[data-sync-state="current"] .field-sync-state{border-color:rgba(52,211,153,.35);color:#d7ffe9}.field-sync-health[data-sync-state="pending"] .field-sync-state{border-color:rgba(251,191,36,.38);color:#fff3c4}.field-sync-health[data-sync-state="conflict"] .field-sync-state,.field-sync-health[data-sync-state="offline"] .field-sync-state{border-color:rgba(248,113,113,.4);color:#ffd4d4}
      .field-sync-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:10px}.field-sync-metric{min-width:0;padding:9px 10px;border-radius:11px;background:rgba(148,163,184,.07)}.field-sync-metric span{display:block;font-size:.75rem;color:var(--text-faint,#94a3b8)}.field-sync-metric strong{display:block;margin-top:2px;font-size:1.05rem}
      .field-sync-note{margin:10px 0 0;color:var(--text-soft,#cbd5e1);line-height:1.45}.field-sync-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
      .offline-conflict-recovery{margin-top:14px;padding-top:14px;border-top:1px solid rgba(148,163,184,.22)}.offline-recovery-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}.offline-recovery-head p{margin:5px 0 0;color:var(--text-soft,#cbd5e1);line-height:1.45}.offline-recovery-list{display:grid;gap:10px;margin-top:10px}.offline-recovery-card{padding:12px;border:1px solid rgba(251,191,36,.28);border-radius:12px;background:rgba(15,23,42,.52)}.offline-recovery-card-head{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.offline-recovery-card-head small{color:var(--text-faint,#94a3b8)}.offline-recovery-error{margin:8px 0;color:#ffd4d4}.offline-recovery-compare{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.offline-recovery-compare>div{min-width:0}.offline-recovery-compare span{display:block;font-size:.78rem;font-weight:700;margin-bottom:4px}.offline-recovery-compare pre{margin:0;max-height:220px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:9px;border-radius:9px;background:rgba(2,6,23,.55);font-size:.75rem}.offline-recovery-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.offline-recovery-actions button{min-height:42px}
      .mobile-crew-v2{margin:0 0 16px;padding:14px;border:1px solid rgba(148,163,184,.22);border-radius:16px;background:rgba(15,23,42,.78)}
      .mobile-crew-v2-head{display:flex;gap:10px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}.mobile-crew-v2-head h2{margin:0;font-size:1.15rem}.mobile-crew-v2-head p{margin:4px 0 0;color:var(--text-soft,#cbd5e1)}
      .mobile-crew-v2-tabs,.mobile-crew-v2-actions{display:flex;gap:8px;flex-wrap:wrap}.mobile-crew-v2-tabs{margin:12px 0}.mobile-crew-v2-tabs button[aria-selected="true"]{outline:2px solid currentColor}
      .mobile-crew-v2-list{display:grid;gap:10px}.mobile-crew-v2-card{padding:12px;border:1px solid rgba(148,163,184,.2);border-radius:14px;background:rgba(148,163,184,.06)}
      .mobile-crew-v2-card-head{display:flex;gap:8px;justify-content:space-between;align-items:flex-start}.mobile-crew-v2-card h3{margin:0;font-size:1rem}.mobile-crew-v2-card p{margin:5px 0;line-height:1.4}
      .mobile-crew-v2-meta{display:flex;gap:6px;flex-wrap:wrap;margin:7px 0}.mobile-crew-v2-chip{display:inline-flex;padding:4px 8px;border-radius:999px;background:rgba(148,163,184,.1);font-size:.78rem}
      .mobile-crew-v2-notes{margin:8px 0;padding:9px;border-radius:10px;background:rgba(148,163,184,.07)}.mobile-crew-v2-notes strong{display:block;margin-bottom:3px}
      .mobile-crew-v2-actions button{min-height:42px}.mobile-crew-v2-empty{padding:12px;border-radius:12px;background:rgba(148,163,184,.06);color:var(--text-soft,#cbd5e1)}
      .jobs-desktop-workbench{display:none}.jobs-sync-health{margin:12px 0}.job-workbench-result{align-self:end;min-height:42px;display:flex;align-items:center;color:var(--text-soft,#cbd5e1)}
      @media(max-width:520px){.field-sync-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.field-sync-actions>*{flex:1 1 145px}.offline-recovery-compare{grid-template-columns:1fr}.offline-recovery-actions button{flex:1 1 120px}}
      @media(min-width:900px){.jobs-desktop-workbench{display:grid;grid-template-columns:minmax(220px,1.5fr) minmax(170px,.7fr) auto auto;gap:10px;align-items:end;padding:12px;margin:10px 0 12px;border:1px solid rgba(148,163,184,.18);border-radius:14px;background:rgba(15,23,42,.48)}.jobs-desktop-workbench label{min-width:0}.jobs-desktop-workbench button{min-height:44px}}
    `;
    document.head.appendChild(style);
  }

  function renderSyncHealth() {
    ensureReliabilityStyles();
    const today = document.getElementById('today');
    if (!today) return;
    let panel = document.getElementById('fieldSyncHealth');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'fieldSyncHealth';
      panel.className = 'field-sync-health';
      panel.setAttribute('aria-live', 'polite');
      const grid = document.getElementById('mobileTodayGrid');
      if (grid?.parentElement === today) today.insertBefore(panel, grid);
      else today.prepend(panel);
    }
    const snapshot = syncSnapshot();
    panel.dataset.syncState = syncState(snapshot);
    const conflictCopy = snapshot.conflicts > 0
      ? '<p class="field-sync-note"><strong>Review conflict before retrying.</strong> Compare the queued local action with the current server state; this screen never overwrites either copy automatically.</p>'
      : snapshot.online
        ? '<p class="field-sync-note">Queued work stays visible until the server confirms it. A green connection alone does not mean every local change has synchronized.</p>'
        : '<p class="field-sync-note">Keep working only in forms that support local drafts/outbox storage. Sign-in, uploads and live reads may remain unavailable until connectivity returns.</p>';
    panel.innerHTML = `
      <div class="field-sync-health-head"><strong>Field sync health</strong><span class="field-sync-state">${syncLabel(snapshot)}</span></div>
      <div class="field-sync-metrics">
        <div class="field-sync-metric"><span>Queued forms</span><strong>${snapshot.forms}</strong></div>
        <div class="field-sync-metric"><span>Saved drafts</span><strong>${snapshot.drafts}</strong></div>
        <div class="field-sync-metric"><span>Queued actions</span><strong>${snapshot.actions}</strong></div>
        <div class="field-sync-metric"><span>Conflicts</span><strong>${snapshot.conflicts}</strong></div>
      </div>
      ${conflictCopy}
      <div class="field-sync-actions">
        ${snapshot.drafts ? '<button type="button" class="secondary" data-field-sync-action="draft">Resume newest draft</button>' : ''}
        ${snapshot.conflicts ? '<button type="button" class="secondary" data-field-sync-action="review">Review conflicts</button>' : ''}
        <button type="button" class="secondary" data-field-sync-action="jobs">Open Jobs</button>
      </div>`;
    panel.querySelector('[data-field-sync-action="draft"]')?.addEventListener('click', () => router()?.showSection?.(firstDraftRoute().replace(/^#/, '')));
    panel.querySelector('[data-field-sync-action="review"]')?.addEventListener('click', () => {
      const recovery = document.getElementById('offlineConflictRecovery348');
      if (recovery) {
        recovery.scrollIntoView?.({ block:'start', behavior:'smooth' });
        recovery.querySelector('button:not([disabled])')?.focus?.();
      } else {
        router()?.showSection?.(canView('admin') ? 'admin' : 'today');
      }
    });
    panel.querySelector('[data-field-sync-action="jobs"]')?.addEventListener('click', () => router()?.showSection?.('jobs'));
    renderConflictRecovery(panel);
  }

  function baseCards() {
    return [
      { key: 'toolbox', title: 'Toolbox Talk', body: 'Open the daily talk and capture the required signoff while on site.', href: '#toolbox', roles: ['employee','onsite_admin','site_leader','supervisor','hse','job_admin','admin'], badge: 'Start' },
      { key: 'incident', title: 'Incident / Near Miss', body: 'Record a safety event quickly from the phone, even before the admin review work happens.', href: '#incident', roles: ['employee','onsite_admin','site_leader','supervisor','hse','job_admin','admin'], badge: 'Fast' },
      { key: 'jobs', title: 'Jobs', body: 'Check job notes, operations work, and field status from a mobile-friendly screen.', href: '#jobs', roles: ['employee','onsite_admin','site_leader','supervisor','hse','job_admin','admin'], badge: 'Field' },
      { key: 'hseops', title: 'Ontario Safety Ops', body: 'Review Ontario OHSA-aware safety queues, evidence, corrective actions, training, and SDS records.', href: '#hseops', roles: ['employee','onsite_admin','site_leader','supervisor','hse','job_admin','admin'], badge: 'Safety' },
      { key: 'ppe', title: 'PPE Check', body: 'Complete a quick PPE check with large touch targets and offline fallback.', href: '#ppe', roles: ['employee','onsite_admin','site_leader','supervisor','hse','job_admin','admin'], badge: 'Check' },
      { key: 'inspect', title: 'Site Inspection', body: 'Capture an inspection, photo evidence, and follow-up notes from the field.', href: '#inspect', roles: ['employee','onsite_admin','site_leader','supervisor','hse','job_admin','admin'], badge: 'Inspect' },
      { key: 'crew', title: 'Crew Review', body: 'Supervisors can jump into crew records and open review work without a long desktop table first.', href: '#crew', roles: ['supervisor','hse','job_admin','admin'], badge: 'Supervisor' },
      { key: 'admin', title: 'Admin Retry Center', body: 'Review staged Admin panel status, retries, permissions, and production readiness checks.', href: '#admin', roles: ['admin'], badge: 'Admin' }
    ];
  }

  function visibleCards() {
    const role = currentRole();
    const draftCount = countDraftForms();
    const cards = baseCards()
      .filter((card) => card.roles.includes(role) || canView(card.key))
      .filter((card, index, list) => list.findIndex((item) => item.key === card.key) === index);

    if (draftCount > 0) {
      cards.unshift({
        key: 'drafts', title: 'Resume Saved Drafts',
        body: `${draftCount} phone form draft${draftCount === 1 ? '' : 's'} saved on this device. Open the newest draft and use Resume Draft.`,
        href: firstDraftRoute(), roles: ['employee','onsite_admin','site_leader','supervisor','hse','job_admin','admin'],
        badge: `${draftCount} draft${draftCount === 1 ? '' : 's'}`
      });
    }
    return cards.slice(0, 6);
  }

  function renderCard(card) {
    return `
      <article class="mobile-today-card" data-today-card="${card.key}">
        <div class="mobile-today-card-head"><strong>${card.title}</strong><span>${card.badge}</span></div>
        <p>${card.body}</p>
        <a class="primary mobile-today-action" href="${card.href}" data-mobile-today-link="${card.key}">Open ${card.title}</a>
      </article>`;
  }

  function renderInstallCard() {
    const card = document.getElementById('mobileInstallCard');
    if (!card) return;
    if (isStandalonePwa()) {
      card.hidden = true;
      card.innerHTML = '';
      return;
    }
    card.hidden = false;
    const canInstall = !!state.deferredInstallPrompt;
    card.innerHTML = `
      <div><strong>Install on this phone</strong><p>Use the app like a field tool: faster launch, offline shell, and quicker access to Today actions.</p><small>Android/Chrome may show an install button. On iPhone/Safari, use Share → Add to Home Screen.</small></div>
      <button id="mobileInstallBtn" class="secondary" type="button" ${canInstall ? '' : 'disabled'}>${canInstall ? 'Install App' : 'Use browser install menu'}</button>`;
    card.querySelector('#mobileInstallBtn')?.addEventListener('click', async () => {
      if (!state.deferredInstallPrompt) return;
      state.deferredInstallPrompt.prompt();
      try { await state.deferredInstallPrompt.userChoice; } catch {}
      state.deferredInstallPrompt = null;
      renderInstallCard();
    });
  }

  function updateStatus() {
    const status = document.getElementById('mobileTodayStatus');
    if (!status) return;
    status.style.display = 'block';
    status.textContent = `${roleLabel(currentRole())} • ${statusText()}`;
  }

  function jobsRows() {
    return Array.from(document.querySelectorAll('#job_list_table tbody tr[data-job-row], #job_list_table tbody tr')).filter((row) => row.cells?.length > 1);
  }

  function jobRowStatus(row) {
    return String(row?.cells?.[8]?.textContent || '').trim();
  }

  function refreshJobStatusOptions(select) {
    if (!select) return;
    const selected = select.value || 'all';
    const statuses = [...new Set(jobsRows().map(jobRowStatus).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    select.innerHTML = '<option value="all">All statuses</option>' + statuses.map((value) => `<option value="${value.replaceAll('&','&amp;').replaceAll('"','&quot;')}">${value}</option>`).join('');
    if ([...select.options].some((option) => option.value === selected)) select.value = selected;
  }

  function applyJobsWorkbenchFilter() {
    const workbench = document.getElementById('jobsDesktopWorkbench');
    if (!workbench) return;
    const query = String(workbench.querySelector('.job-workbench-search')?.value || '').trim().toLowerCase();
    const status = String(workbench.querySelector('.job-workbench-status')?.value || 'all');
    const rows = jobsRows();
    let visible = 0;
    rows.forEach((row) => {
      const textMatch = !query || String(row.textContent || '').toLowerCase().includes(query);
      const statusMatch = status === 'all' || jobRowStatus(row) === status;
      row.hidden = !(textMatch && statusMatch);
      if (!row.hidden) visible += 1;
    });
    const result = workbench.querySelector('.job-workbench-result');
    if (result) result.textContent = `${visible} of ${rows.length} jobs shown`;
  }

  function crewEscape(value) {
    return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }

  function crewCacheKey() {
    const profileId = authState().profile?.id || authState().user?.id || 'anonymous';
    return 'ywi_mobile_crew_v2_' + profileId;
  }

  function readCrewCache() {
    try {
      const raw = sessionStorage.getItem(crewCacheKey());
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.payload?.build === 326 ? parsed : null;
    } catch { return null; }
  }

  function writeCrewCache(payload) {
    try { sessionStorage.setItem(crewCacheKey(), JSON.stringify({ saved_at: new Date().toISOString(), payload })); } catch {}
  }

  function crewApi() { return window.YWIAPI || null; }

  async function loadMobileCrewContext(force = false) {
    const signedIn = !!authState().isAuthenticated;
    if (!signedIn || state.crewLoading) return;
    if (!force && state.crewContext && Date.now() - state.crewLoadedAt < 60000) return;
    if (navigator.onLine === false) {
      const cached = readCrewCache();
      if (cached?.payload) {
        state.crewContext = cached.payload;
        state.crewError = 'Offline — showing the last crew snapshot from this signed-in browser session.';
      } else {
        state.crewError = 'Offline — no crew snapshot is cached in this signed-in browser session yet.';
      }
      renderMobileCrewApp();
      return;
    }
    if (!crewApi()?.fetchMobileCrewContext) return;
    state.crewLoading = true;
    state.crewError = '';
    renderMobileCrewApp();
    try {
      const payload = await crewApi().fetchMobileCrewContext({ days: 7 });
      if (!payload?.ok) throw new Error(payload?.error || 'Mobile crew context did not load.');
      state.crewContext = payload;
      state.crewLoadedAt = Date.now();
      writeCrewCache(payload);
    } catch (error) {
      const cached = readCrewCache();
      if (cached?.payload) state.crewContext = cached.payload;
      state.crewError = (error?.message || 'Mobile crew context failed.') + (cached?.payload ? ' Showing the last signed-in-session snapshot.' : '');
    } finally {
      state.crewLoading = false;
      renderMobileCrewApp();
    }
  }

  function crewDateTime(value) {
    if (!value) return 'Unscheduled';
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return String(value);
    return date.toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
  }

  function crewTitle(row) {
    return row?.job?.job_name || row?.work_order?.work_type || row?.job?.job_code || row?.work_order?.work_order_number || 'Assigned work';
  }

  function crewSiteLine(row) {
    const site = row?.site || {};
    return [site.site_name, site.service_address, site.city].filter(Boolean).join(' · ') || 'Site details unavailable';
  }

  function crewPropertyNotes(row) {
    const site = row?.site || {};
    const access = [site.access_notes,site.gate_fence_summary,site.parking_trailer_limits,site.pet_notes,site.recurring_property_instructions].filter(Boolean).join(' • ');
    const hazard = [site.hazard_notes,site.slope_notes,site.drainage_wet_area_notes,site.utility_locate_notes,site.tree_brush_notes].filter(Boolean).join(' • ');
    return { access, hazard };
  }

  function crewActionButton(label, action, index, enabled = true) {
    return '<button type="button" class="secondary" data-crew-action="' + crewEscape(action) + '" data-crew-index="' + index + '"' + (enabled ? '' : ' disabled') + '>' + crewEscape(label) + '</button>';
  }

  function crewActionMarkup(row, index) {
    const caps = state.crewContext?.capabilities || {};
    const online = navigator.onLine !== false;
    const session = row?.latest_session || null;
    const inProgress = session?.session_status === 'in_progress';
    const buttons = [
      crewActionButton('Clock / Break','clock',index,true),
      crewActionButton('Safety / Inspection','safety',index,true),
      crewActionButton('Equipment Scan','equipment',index,!!caps.equipment_scan)
    ];
    if (caps.production_capture) {
      buttons.push(crewActionButton(inProgress ? 'Finish Visit' : 'Start Visit',inProgress ? 'finish_visit' : 'start_visit',index,online));
      buttons.push(crewActionButton('Production Qty','quantity',index,online && !!session?.id));
    }
    if (caps.live_update) buttons.push(crewActionButton('Live Update','live_update',index,online));
    if (caps.execution_proof) buttons.push(crewActionButton('Execution Proof','execution_proof',index,online));
    if (caps.deficiency_rework) buttons.push(crewActionButton('Deficiency / Rework','deficiency',index,online));
    if (caps.closeout_request) buttons.push(crewActionButton('Closeout Request','closeout',index,online));
    return buttons.join('');
  }

  function crewCard(row, index) {
    const notes = crewPropertyNotes(row);
    const dispatch = row?.dispatch || {};
    const production = row?.production || {};
    const evidence = row?.evidence || {};
    const routeOrder = dispatch.route_order || row?.route?.stop?.stop_order || '';
    const equipmentProblems = (row?.equipment || []).filter((item) => item?.is_locked_out || (item?.defect_status && item.defect_status !== 'clear' && item.defect_status !== 'none'));
    const materialCount = production.material_issues?.length || 0;
    const quantityCount = production.quantities?.length || 0;
    const proofCount = evidence.proofs?.length || 0;
    const closeoutStatus = row?.closeout?.closeout_status || 'not submitted';
    return '<article class="mobile-crew-v2-card" data-crew-card="' + index + '">' +
      '<div class="mobile-crew-v2-card-head"><div><h3>' + crewEscape(crewTitle(row)) + '</h3><p>' + crewEscape(crewSiteLine(row)) + '</p></div><span class="mobile-crew-v2-chip">' + crewEscape(dispatch.schedule_status || row?.work_order?.status || 'scheduled') + '</span></div>' +
      '<div class="mobile-crew-v2-meta">' +
        (routeOrder ? '<span class="mobile-crew-v2-chip">Stop ' + crewEscape(routeOrder) + '</span>' : '') +
        '<span class="mobile-crew-v2-chip">' + crewEscape(crewDateTime(dispatch.scheduled_start || row?.work_order?.scheduled_start)) + '</span>' +
        '<span class="mobile-crew-v2-chip">' + materialCount + ' material use</span>' +
        '<span class="mobile-crew-v2-chip">' + quantityCount + ' production qty</span>' +
        '<span class="mobile-crew-v2-chip">' + proofCount + ' proof</span>' +
        '<span class="mobile-crew-v2-chip">Closeout: ' + crewEscape(closeoutStatus) + '</span>' +
      '</div>' +
      (notes.access ? '<div class="mobile-crew-v2-notes"><strong>Property access</strong>' + crewEscape(notes.access) + '</div>' : '') +
      (notes.hazard ? '<div class="mobile-crew-v2-notes"><strong>Hazards / site notes</strong>' + crewEscape(notes.hazard) + '</div>' : '') +
      (dispatch.dispatch_notes ? '<div class="mobile-crew-v2-notes"><strong>Dispatch notes</strong>' + crewEscape(dispatch.dispatch_notes) + '</div>' : '') +
      (equipmentProblems.length ? '<div class="mobile-crew-v2-notes"><strong>Equipment attention</strong>' + equipmentProblems.map((item) => crewEscape(item.equipment_name || item.equipment_code || item.id) + (item.is_locked_out ? ' — LOCKED OUT' : ' — ' + crewEscape(item.defect_status))).join('<br>') + '</div>' : '') +
      '<div class="mobile-crew-v2-actions">' + crewActionMarkup(row,index) + '</div>' +
    '</article>';
  }

  function renderMobileCrewApp() {
    const today = document.getElementById('today');
    if (!today) return;
    let panel = document.getElementById('mobileCrewAppV2');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'mobileCrewAppV2';
      panel.className = 'mobile-crew-v2';
      panel.setAttribute('aria-live','polite');
      const grid = document.getElementById('mobileTodayGrid');
      if (grid?.parentElement === today) today.insertBefore(panel, grid);
      else today.appendChild(panel);
    }
    const payload = state.crewContext;
    const rows = state.crewTab === 'jobs' ? (payload?.my_jobs || []) : (payload?.my_route || []);
    const snapshot = syncSnapshot();
    const syncCopy = state.crewError || (snapshot.online ? 'Assignment-filtered live field context.' : 'Offline — server writes are disabled; local supported forms retain their own drafts/outbox.');
    panel.innerHTML =
      '<div class="mobile-crew-v2-head"><div><h2>Mobile Crew App v2</h2><p>My Jobs, My Route and field actions for 390/430-width phones.</p></div><span class="field-sync-state">' + crewEscape(syncLabel(snapshot)) + '</span></div>' +
      '<div class="mobile-crew-v2-tabs"><button type="button" class="secondary" data-crew-tab="route" aria-selected="' + (state.crewTab === 'route') + '">My Route</button><button type="button" class="secondary" data-crew-tab="jobs" aria-selected="' + (state.crewTab === 'jobs') + '">My Jobs</button><button type="button" class="secondary" data-crew-refresh="1"' + (state.crewLoading || !snapshot.online ? ' disabled' : '') + '>' + (state.crewLoading ? 'Refreshing…' : 'Refresh') + '</button></div>' +
      '<p class="field-sync-note">' + crewEscape(syncCopy) + '</p>' +
      '<div class="mobile-crew-v2-list">' + (state.crewLoading && !payload ? '<div class="mobile-crew-v2-empty">Loading assigned field work…</div>' : rows.length ? rows.map(crewCard).join('') : '<div class="mobile-crew-v2-empty">No assigned work is in the current seven-day crew window.</div>') + '</div>';
    panel.querySelectorAll('[data-crew-tab]').forEach((button) => button.addEventListener('click', () => { state.crewTab = button.dataset.crewTab || 'route'; renderMobileCrewApp(); }));
    panel.querySelector('[data-crew-refresh]')?.addEventListener('click', () => loadMobileCrewContext(true));
    panel.querySelectorAll('[data-crew-action]').forEach((button) => button.addEventListener('click', () => runCrewAction(button.dataset.crewAction, Number(button.dataset.crewIndex || 0))));
  }

  async function crewOperation(payload) {
    if (navigator.onLine === false) throw new Error('This server action needs a connection. Supported Safety forms and drafts can still be used offline.');
    if (!crewApi()?.manageOperations) throw new Error('Operations service is unavailable.');
    return crewApi().manageOperations(payload);
  }

  async function runCrewAction(action, index) {
    const row = (state.crewTab === 'jobs' ? state.crewContext?.my_jobs : state.crewContext?.my_route)?.[index] || null;
    if (!row && !['clock','safety','equipment'].includes(action)) return;
    if (action === 'clock') return router()?.showSection?.('me');
    if (action === 'safety') return router()?.showSection?.('inspect');
    if (action === 'equipment') return router()?.showSection?.('equipment');
    const workOrderId = row?.work_order?.id || row?.dispatch?.work_order_id || '';
    try {
      if (action === 'start_visit') {
        await crewOperation({ action:'landscape_production_session_save', work_order_id:workOrderId, dispatch_schedule_item_id:row?.dispatch?.id || null, session_date:new Date().toISOString().slice(0,10), session_status:'in_progress', started_at:new Date().toISOString(), workability_status:row?.dispatch?.workability_state || 'not_recorded', weather_summary:row?.dispatch?.weather_summary || null, completion_state:'open', production_notes:'Started from Mobile Crew App v2.' });
      } else if (action === 'finish_visit') {
        const note = window.prompt('Completion / production note (optional):','') || '';
        await crewOperation({ action:'landscape_production_session_save', id:row?.latest_session?.id, work_order_id:workOrderId, session_status:'completed', ended_at:new Date().toISOString(), completion_state:'complete', production_notes:note || 'Completed from Mobile Crew App v2.' });
      } else if (action === 'quantity') {
        if (!row?.latest_session?.id) throw new Error('Start the visit before recording production quantity.');
        const metric = window.prompt('What did we measure? (example: Mowing area, Mulch installed)','');
        if (!metric) return;
        const actual = window.prompt('Actual quantity','0');
        if (actual === null) return;
        const unit = window.prompt('Unit (example: sq ft, bags, loads, each)','') || '';
        await crewOperation({ action:'landscape_production_quantity_save', job_session_id:row.latest_session.id, record_type:'production', activity_type:'other', metric_label:metric, actual_quantity:Number(actual || 0), unit_label:unit, is_active:true });
      } else if (action === 'live_update') {
        const message = window.prompt('Staff live update','');
        if (!message) return;
        await crewOperation({ action:'work_order_live_update_create', work_order_id:workOrderId, job_session_id:row?.latest_session?.id || null, visibility:'staff', update_type:'progress', title:'Mobile field update', message, occurred_at:new Date().toISOString(), customer_notification_requested:false });
      } else if (action === 'execution_proof') {
        const notes = window.prompt('Execution proof notes','');
        if (!notes) return;
        await crewOperation({ action:'work_order_execution_proof_submit', work_order_id:workOrderId, job_session_id:row?.latest_session?.id || null, dispatch_schedule_item_id:row?.dispatch?.id || null, proof_type:'progress', title:'Mobile execution proof', staff_notes:notes, customer_visible:false, occurred_at:new Date().toISOString(), asset_ids:[] });
      } else if (action === 'deficiency') {
        const message = window.prompt('Describe deficiency, rework or follow-up needed','');
        if (!message) return;
        await crewOperation({ action:'work_order_live_update_create', work_order_id:workOrderId, job_session_id:row?.latest_session?.id || null, visibility:'staff', update_type:'deficiency', title:'Deficiency / rework', message, occurred_at:new Date().toISOString(), customer_notification_requested:false });
      } else if (action === 'closeout') {
        const summary = window.prompt('Customer-safe closeout summary','');
        if (!summary) return;
        await crewOperation({ action:'work_order_closeout_submit', work_order_id:workOrderId, customer_summary:summary, staff_closeout_notes:'Submitted from Mobile Crew App v2.', invoice_ready_requested:false, review_request_requested:false, before_asset_ids:[], after_asset_ids:[] });
      }
      state.crewError = '';
      await loadMobileCrewContext(true);
    } catch (error) {
      state.crewError = error?.message || 'Field action failed.';
      renderMobileCrewApp();
    }
  }

  function renderJobsSyncHealth() {
    const jobs = document.getElementById('jobs');
    if (!jobs) return;
    let panel = document.getElementById('jobsSyncHealth');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'jobsSyncHealth';
      panel.className = 'field-sync-health jobs-sync-health';
      const heading = jobs.querySelector('.section-heading');
      heading?.insertAdjacentElement('afterend', panel);
    }
    const snapshot = syncSnapshot();
    panel.dataset.syncState = syncState(snapshot);
    panel.innerHTML = `<div class="field-sync-health-head"><strong>Jobs sync state</strong><span class="field-sync-state">${syncLabel(snapshot)}</span></div><p class="field-sync-note">${snapshot.conflicts ? 'Review conflicts before retrying queued job/admin actions. Server and local copies are not replaced automatically.' : snapshot.online ? 'Use the desktop filters below for review only; filtering never changes job records.' : 'Jobs shown from the current page may be stale while offline. Local drafts/outbox items remain separate until confirmed by the server.'}</p>`;
  }

  function ensureJobsDesktopWorkbench() {
    ensureReliabilityStyles();
    const jobs = document.getElementById('jobs');
    const table = document.getElementById('job_list_table');
    if (!jobs || !table) return;
    jobs.dataset.desktopWorkbenchReady = '1';
    let workbench = document.getElementById('jobsDesktopWorkbench');
    if (!workbench) {
      workbench = document.createElement('div');
      workbench.id = 'jobsDesktopWorkbench';
      workbench.className = 'jobs-desktop-workbench';
      workbench.innerHTML = `
        <label>Find jobs<input class="job-workbench-search" type="search" placeholder="Code, client, invoice, job name…" autocomplete="off"></label>
        <label>Status<select class="job-workbench-status"><option value="all">All statuses</option></select></label>
        <div class="job-workbench-result" aria-live="polite">0 jobs shown</div>
        <button class="secondary job-workbench-clear" type="button">Clear filters</button>`;
      const tableWrap = table.closest('.table-scroll') || table.parentElement;
      tableWrap?.insertAdjacentElement('beforebegin', workbench);
      const search = workbench.querySelector('.job-workbench-search');
      const status = workbench.querySelector('.job-workbench-status');
      search?.addEventListener('input', applyJobsWorkbenchFilter);
      status?.addEventListener('change', applyJobsWorkbenchFilter);
      workbench.querySelector('.job-workbench-clear')?.addEventListener('click', () => {
        if (search) search.value = '';
        if (status) status.value = 'all';
        applyJobsWorkbenchFilter();
        search?.focus();
      });
    }
    const select = workbench.querySelector('.job-workbench-status');
    refreshJobStatusOptions(select);
    applyJobsWorkbenchFilter();
    renderJobsSyncHealth();

    const body = table.tBodies?.[0];
    if (body && !state.jobsObserver) {
      state.jobsObserver = new MutationObserver(() => {
        refreshJobStatusOptions(document.querySelector('#jobsDesktopWorkbench .job-workbench-status'));
        applyJobsWorkbenchFilter();
      });
      state.jobsObserver.observe(body, { childList: true, subtree: true, characterData: true });
    }
  }

  function render() {
    ensureReliabilityStyles();
    const grid = document.getElementById('mobileTodayGrid');
    const snapshot = syncSnapshot();
    const renderKey = JSON.stringify({ role: currentRole(), ...snapshot });
    if (grid) {
      if (state.lastRenderKey !== renderKey || !grid.innerHTML.trim()) {
        state.lastRenderKey = renderKey;
        grid.innerHTML = visibleCards().map(renderCard).join('') || '<div class="notice">No Today actions are available for this role yet.</div>';
        grid.querySelectorAll('[data-mobile-today-link]').forEach((link) => {
          link.addEventListener('click', (event) => {
            event.preventDefault();
            const href = link.getAttribute('href') || '#today';
            router()?.showSection?.(href.slice(1));
          });
        });
      }
    }
    updateStatus();
    renderSyncHealth();
    renderInstallCard();
    renderMobileCrewApp();
    if (authState().isAuthenticated) loadMobileCrewContext(false);
    ensureJobsDesktopWorkbench();
    document.dispatchEvent(new CustomEvent('ywi:mobile-today-rendered', {
      detail: { role: currentRole(), outbox_count: snapshot.forms, action_count: snapshot.actions, conflict_count: snapshot.conflicts }
    }));
  }

  function bind() {
    if (state.bound) return;
    state.bound = true;
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      state.deferredInstallPrompt = event;
      renderInstallCard();
    });
    window.addEventListener('online', () => { render(); loadMobileCrewContext(true); });
    window.addEventListener('offline', render);
    document.addEventListener('ywi:auth-changed', () => { state.crewContext=null; state.crewLoadedAt=0; render(); loadMobileCrewContext(true); });
    document.addEventListener('ywi:route-shown', render);
    document.addEventListener('ywi:mobile-badges-updated', render);
    document.addEventListener('ywi:mobile-drafts-updated', render);
    document.addEventListener('ywi:outbox-changed', render);
    document.addEventListener('ywi:conflict-recovery', render);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
    window.setInterval(render, 30000);
    render();
  }

  window.YWIMobileToday = {
    bind, render, countOutboxItems, countActionItems, countConflictItems, countDraftForms,
    syncSnapshot, applyJobsWorkbenchFilter, ensureJobsDesktopWorkbench, loadMobileCrewContext, renderMobileCrewApp, renderConflictRecovery
  };
  document.addEventListener('DOMContentLoaded', bind);
})();
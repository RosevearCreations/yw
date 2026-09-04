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
    jobsObserver: null
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
      .jobs-desktop-workbench{display:none}.jobs-sync-health{margin:12px 0}.job-workbench-result{align-self:end;min-height:42px;display:flex;align-items:center;color:var(--text-soft,#cbd5e1)}
      @media(max-width:520px){.field-sync-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.field-sync-actions>*{flex:1 1 145px}}
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
    panel.querySelector('[data-field-sync-action="review"]')?.addEventListener('click', () => router()?.showSection?.(canView('admin') ? 'admin' : 'today'));
    panel.querySelector('[data-field-sync-action="jobs"]')?.addEventListener('click', () => router()?.showSection?.('jobs'));
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
    window.addEventListener('online', render);
    window.addEventListener('offline', render);
    document.addEventListener('ywi:auth-changed', render);
    document.addEventListener('ywi:route-shown', render);
    document.addEventListener('ywi:mobile-badges-updated', render);
    document.addEventListener('ywi:mobile-drafts-updated', render);
    document.addEventListener('ywi:outbox-changed', render);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
    window.setInterval(render, 30000);
    render();
  }

  window.YWIMobileToday = {
    bind, render, countOutboxItems, countActionItems, countConflictItems, countDraftForms,
    syncSnapshot, applyJobsWorkbenchFilter, ensureJobsDesktopWorkbench
  };
  document.addEventListener('DOMContentLoaded', bind);
})();
/* File: js/mobile-today.js
   Brief description: Phone-first Today dashboard and PWA install helper.
   Builds role-aware shortcuts, offline queue counts, and install guidance without
   blocking the existing form/admin modules.
*/

'use strict';

(function () {
  const state = {
    bound: false,
    deferredInstallPrompt: null,
    lastRenderKey: ''
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

  function countActionItems() {
    try { return outbox()?.getActionItems?.()?.length || 0; } catch { return 0; }
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

  function statusText() {
    const online = navigator.onLine !== false;
    const pendingForms = countOutboxItems();
    const pendingActions = countActionItems();
    const draftForms = countDraftForms();
    const chunks = [];
    chunks.push(online ? 'Online' : 'Offline mode');
    chunks.push(`${pendingForms} form submission${pendingForms === 1 ? '' : 's'} queued`);
    chunks.push(`${draftForms} saved form draft${draftForms === 1 ? '' : 's'}`);
    chunks.push(`${pendingActions} admin/action item${pendingActions === 1 ? '' : 's'} queued`);
    return chunks.join(' • ');
  }

  function baseCards() {
    return [
      {
        key: 'toolbox',
        title: 'Toolbox Talk',
        body: 'Open the daily talk and capture the required signoff while on site.',
        href: '#toolbox',
        roles: ['employee','onsite_admin','site_leader','supervisor','hse','job_admin','admin'],
        badge: 'Start'
      },
      {
        key: 'incident',
        title: 'Incident / Near Miss',
        body: 'Record a safety event quickly from the phone, even before the admin review work happens.',
        href: '#incident',
        roles: ['employee','onsite_admin','site_leader','supervisor','hse','job_admin','admin'],
        badge: 'Fast'
      },
      {
        key: 'jobs',
        title: 'Jobs',
        body: 'Check job notes, operations work, and field status from a mobile-friendly screen.',
        href: '#jobs',
        roles: ['employee','onsite_admin','site_leader','supervisor','hse','job_admin','admin'],
        badge: 'Field'
      },
      {
        key: 'hseops',
        title: 'Ontario Safety Ops',
        body: 'Review Ontario OHSA-aware safety queues, evidence, corrective actions, training, and SDS records.',
        href: '#hseops',
        roles: ['employee','onsite_admin','site_leader','supervisor','hse','job_admin','admin'],
        badge: 'Safety'
      },
      {
        key: 'ppe',
        title: 'PPE Check',
        body: 'Complete a quick PPE check with large touch targets and offline fallback.',
        href: '#ppe',
        roles: ['employee','onsite_admin','site_leader','supervisor','hse','job_admin','admin'],
        badge: 'Check'
      },
      {
        key: 'inspect',
        title: 'Site Inspection',
        body: 'Capture an inspection, photo evidence, and follow-up notes from the field.',
        href: '#inspect',
        roles: ['employee','onsite_admin','site_leader','supervisor','hse','job_admin','admin'],
        badge: 'Inspect'
      },
      {
        key: 'crew',
        title: 'Crew Review',
        body: 'Supervisors can jump into crew records and open review work without a long desktop table first.',
        href: '#crew',
        roles: ['supervisor','hse','job_admin','admin'],
        badge: 'Supervisor'
      },
      {
        key: 'admin',
        title: 'Admin Retry Center',
        body: 'Review staged Admin panel status, retries, permissions, and production readiness checks.',
        href: '#admin',
        roles: ['admin'],
        badge: 'Admin'
      }
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
        key: 'drafts',
        title: 'Resume Saved Drafts',
        body: `${draftCount} phone form draft${draftCount === 1 ? '' : 's'} saved on this device. Open the newest draft and use Resume Draft.`,
        href: firstDraftRoute(),
        roles: ['employee','onsite_admin','site_leader','supervisor','hse','job_admin','admin'],
        badge: `${draftCount} draft${draftCount === 1 ? '' : 's'}`
      });
    }

    return cards.slice(0, 6);
  }

  function renderCard(card) {
    return `
      <article class="mobile-today-card" data-today-card="${card.key}">
        <div class="mobile-today-card-head">
          <strong>${card.title}</strong>
          <span>${card.badge}</span>
        </div>
        <p>${card.body}</p>
        <a class="primary mobile-today-action" href="${card.href}" data-mobile-today-link="${card.key}">Open ${card.title}</a>
      </article>
    `;
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
      <div>
        <strong>Install on this phone</strong>
        <p>Use the app like a field tool: faster launch, offline shell, and quicker access to Today actions.</p>
        <small>Android/Chrome may show an install button. On iPhone/Safari, use Share → Add to Home Screen.</small>
      </div>
      <button id="mobileInstallBtn" class="secondary" type="button" ${canInstall ? '' : 'disabled'}>${canInstall ? 'Install App' : 'Use browser install menu'}</button>
    `;

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

  function render() {
    const grid = document.getElementById('mobileTodayGrid');
    if (!grid) return;
    const renderKey = JSON.stringify({ role: currentRole(), forms: countOutboxItems(), drafts: countDraftForms(), actions: countActionItems(), online: navigator.onLine !== false });
    if (state.lastRenderKey === renderKey && grid.innerHTML.trim()) {
      updateStatus();
      renderInstallCard();
      return;
    }
    state.lastRenderKey = renderKey;
    grid.innerHTML = visibleCards().map(renderCard).join('') || '<div class="notice">No Today actions are available for this role yet.</div>';
    grid.querySelectorAll('[data-mobile-today-link]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const href = link.getAttribute('href') || '#today';
        router()?.showSection?.(href.slice(1));
      });
    });
    updateStatus();
    renderInstallCard();
    document.dispatchEvent(new CustomEvent('ywi:mobile-today-rendered', {
      detail: { role: currentRole(), outbox_count: countOutboxItems(), action_count: countActionItems() }
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
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) render();
    });
    window.setInterval(render, 30000);
    render();
  }

  window.YWIMobileToday = { bind, render, countOutboxItems, countActionItems, countDraftForms };
  document.addEventListener('DOMContentLoaded', bind);
})();

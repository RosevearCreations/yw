/* File: js/workspace-organization.js
   Build 231 workspace direction and progressive-disclosure organizer.
   Presentation and request-shaping only: Today gains a clear next-action hierarchy, Finance
   opens as a lightweight workspace chooser with review/posting reads deferred until selected,
   and I.T. Readiness groups its bounded runtime truth into collapsible operator domains.
   Server-side authorization and release/accounting safety remain authoritative.
*/

'use strict';

(function () {
  const state = {
    financeWorkspace: 'overview',
    financeApiPatched: false,
    financeApplying: false,
    financeObserver: null,
    itApplying: false,
    itObserver: null,
    patchTimer: null
  };

  const FINANCE_WORKSPACES = Object.freeze([
    { key:'overview', title:'Finance Overview', note:'Start here. See bounded accounting status, then open only the work queue you need.' },
    { key:'review', title:'Review Queue', note:'Completed-job Finance disposition and draft-candidate generation.' },
    { key:'posting', title:'Posting Controls', note:'Approval, preflight, controlled posting and reversal authority.' },
    { key:'reconciliation', title:'Reconciliation', note:'Manual reconciliation exceptions that need review.' },
    { key:'close', title:'Close & Tax', note:'Period close, tax filing and payroll remittance review.' },
    { key:'mapping', title:'Account Mapping', note:'Human accountant mapping, observability and decision support — still on demand.' }
  ]);

  const IT_GROUPS = Object.freeze([
    { key:'release', title:'Release & Source', match:['release authority','source evidence','scorecard truth','acceptance readiness','outstanding work','production readiness','deployment gate'] },
    { key:'runtime', title:'Database & Runtime', match:['database','preflight','deployment checklist','edge function readiness','backup / restore','runtime and error health'] },
    { key:'finance', title:'Finance & Accounting', match:['event consumers','finance pipeline','finance reconciliation','finance release hardening','finance mapping review','mapping decision support','mapping observability'] },
    { key:'security', title:'Access & Security', match:['admin break-glass access','deep release and security assertions'] },
    { key:'operations', title:'Operations & Public', match:['admin task inbox','public seo release checks'] }
  ]);

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function currentRoute() {
    return String(window.location?.hash || '#today').replace(/^#/, '').split(/[?&]/)[0].trim().toLowerCase() || 'today';
  }

  function ensureStyles() {
    if (document.getElementById('workspaceOrganizationStyles')) return;
    const style = document.createElement('style');
    style.id = 'workspaceOrganizationStyles';
    style.textContent = `
      .workspace-direction{margin:0 0 14px;padding:16px;border:1px solid rgba(148,163,184,.22);border-radius:16px;background:rgba(15,23,42,.74)}
      .workspace-direction-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}.workspace-direction-head h3{margin:2px 0 4px}.workspace-direction-head p{margin:0;color:var(--text-soft,#cbd5e1)}
      .workspace-direction-badge{display:inline-flex;align-items:center;min-height:32px;padding:5px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.28);font-size:.8rem;font-weight:800}.workspace-direction[data-state="action"] .workspace-direction-badge{border-color:rgba(251,191,36,.42);color:#fff3c4}.workspace-direction[data-state="blocked"] .workspace-direction-badge{border-color:rgba(248,113,113,.45);color:#ffd4d4}.workspace-direction[data-state="ready"] .workspace-direction-badge{border-color:rgba(52,211,153,.38);color:#d7ffe9}
      .workspace-direction-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.workspace-direction-actions>*{min-height:42px}
      .today-group-heading{grid-column:1/-1;margin:4px 0 -2px;padding-top:4px;font-size:.78rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint,#94a3b8)}
      .finance-workspace-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0}.finance-workspace-choice{min-width:0;text-align:left;padding:13px;border:1px solid rgba(148,163,184,.2);border-radius:14px;background:rgba(15,23,42,.55);color:inherit;cursor:pointer}.finance-workspace-choice strong,.finance-workspace-choice small{display:block}.finance-workspace-choice small{margin-top:5px;color:var(--text-soft,#cbd5e1);line-height:1.35}.finance-workspace-choice[aria-pressed="true"]{border-color:rgba(96,165,250,.65);box-shadow:0 0 0 1px rgba(96,165,250,.22) inset}.finance-workspace-note{margin:10px 0 14px;padding:12px 14px;border-radius:12px;background:rgba(148,163,184,.07);color:var(--text-soft,#cbd5e1)}
      .it-readiness-domain-nav{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:14px 0}.it-domain-jump{padding:10px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:rgba(15,23,42,.52);color:inherit;text-align:left;cursor:pointer}.it-domain-jump strong,.it-domain-jump small{display:block}.it-domain-jump small{margin-top:3px;color:var(--text-faint,#94a3b8)}
      .it-readiness-domain{grid-column:1/-1;border:1px solid rgba(148,163,184,.2);border-radius:16px;background:rgba(15,23,42,.42);overflow:hidden}.it-readiness-domain>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;padding:15px 16px;font-weight:800}.it-readiness-domain>summary::-webkit-details-marker{display:none}.it-readiness-domain-body{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:0 12px 12px}.it-domain-state{font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-faint,#94a3b8)}.it-domain-state.blocked{color:#ffd4d4}.it-domain-state.action{color:#fff3c4}.it-domain-state.ready{color:#d7ffe9}
      @media(max-width:900px){.finance-workspace-nav{grid-template-columns:repeat(2,minmax(0,1fr))}.it-readiness-domain-nav{grid-template-columns:repeat(2,minmax(0,1fr))}.it-readiness-domain-body{grid-template-columns:1fr}}
      @media(max-width:520px){.finance-workspace-nav{grid-template-columns:1fr}.workspace-direction-actions>*{flex:1 1 145px}.it-readiness-domain-nav{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function deferredReviewPayload() {
    return { ok:true, deferred:true, queue:[], status:{ awaiting_disposition_count:0, approved_awaiting_generation_count:0, generated_count:0, blocked_count:0 } };
  }

  function deferredPostingPayload() {
    return { ok:true, deferred:true, queue:[], operational_lifecycle:[], reconciliation_issues:[], operational_summary:{ execution_release_enabled:false, awaiting_review_count:0, awaiting_posting_approval_count:0, preflight_blocked_count:0, recovery_required_count:0, posted_count:0, reversed_count:0 } };
  }

  function patchFinanceApi() {
    if (state.financeApiPatched) return true;
    const api = window.YWIAPI;
    if (!api || typeof api.jsonFetch !== 'function') return false;
    const original = api.jsonFetch.bind(api);
    const guarded = function workspaceAwareJsonFetch(path, options = {}) {
      const endpoint = String(path || '').replace(/^\/+/, '').split('?')[0];
      if (endpoint === 'finance-job-completion-review' && state.financeWorkspace !== 'review') {
        return Promise.resolve(deferredReviewPayload());
      }
      if (endpoint === 'finance-job-completion-posting-approval' && state.financeWorkspace !== 'posting') {
        return Promise.resolve(deferredPostingPayload());
      }
      return original(path, options);
    };
    guarded.__ywiWorkspaceOrganization = true;
    guarded.__ywiOriginalJsonFetch = original;
    api.jsonFetch = guarded;
    state.financeApiPatched = true;
    if (state.patchTimer) { clearInterval(state.patchTimer); state.patchTimer = null; }
    return true;
  }

  function financePanelKey(panel) {
    const heading = String(panel?.querySelector('h3')?.textContent || '').trim().toLowerCase();
    if (heading.includes('completed jobs')) return 'review';
    if (heading.includes('completion') && heading.includes('accounting lifecycle')) return 'posting';
    if (heading.includes('reconciliation')) return 'reconciliation';
    if (heading.includes('accounting close')) return 'close';
    if (heading.includes('tax filing') || heading.includes('payroll remittance')) return 'close';
    return 'overview';
  }

  function financeDirectionText() {
    const selected = FINANCE_WORKSPACES.find((item) => item.key === state.financeWorkspace) || FINANCE_WORKSPACES[0];
    if (selected.key === 'overview') return 'Finance starts light. Review and posting authorities are not called until you explicitly open those workspaces.';
    if (selected.key === 'review') return 'Only the completed-job review authority is live for this workspace. Posting control reads remain deferred.';
    if (selected.key === 'posting') return 'Only the posting control-plane authority is live for this workspace. Review-queue reads remain deferred.';
    if (selected.key === 'mapping') return 'Mapping remains an explicit human-accounting load. Use its Load button when you actually need the deep mapping evidence.';
    return selected.note;
  }

  function selectFinanceWorkspace(key, options = {}) {
    if (!FINANCE_WORKSPACES.some((item) => item.key === key)) key = 'overview';
    const changed = state.financeWorkspace !== key;
    state.financeWorkspace = key;
    decorateFinance();
    if ((key === 'review' || key === 'posting') && (changed || options.force === true)) {
      const refresh = document.getElementById('financeRefresh');
      if (refresh && !refresh.disabled) refresh.click();
    }
  }

  function decorateFinance() {
    if (state.financeApplying) return;
    const host = document.getElementById('financeWorkspace');
    if (!host) return;
    state.financeApplying = true;
    try {
      ensureStyles();
      let nav = host.querySelector('.finance-workspace-nav');
      if (!nav) {
        nav = document.createElement('div');
        nav.className = 'finance-workspace-nav';
        const heading = host.querySelector('.module-workspace-heading');
        heading?.insertAdjacentElement('afterend', nav);
      }
      nav.innerHTML = FINANCE_WORKSPACES.map((item) => `<button type="button" class="finance-workspace-choice" data-finance-workspace="${esc(item.key)}" aria-pressed="${item.key === state.financeWorkspace ? 'true' : 'false'}"><strong>${esc(item.title)}</strong><small>${esc(item.note)}</small></button>`).join('');
      nav.querySelectorAll('[data-finance-workspace]').forEach((button) => button.addEventListener('click', () => selectFinanceWorkspace(button.dataset.financeWorkspace)));

      let note = host.querySelector('.finance-workspace-note');
      if (!note) {
        note = document.createElement('div');
        note.className = 'finance-workspace-note';
        nav.insertAdjacentElement('afterend', note);
      }
      note.innerHTML = `<strong>${esc((FINANCE_WORKSPACES.find((item) => item.key === state.financeWorkspace) || FINANCE_WORKSPACES[0]).title)}:</strong> ${esc(financeDirectionText())}`;

      host.querySelectorAll('.finance-list-card').forEach((panel) => {
        const panelKey = financePanelKey(panel);
        panel.dataset.financeWorkspacePanel = panelKey;
        panel.hidden = state.financeWorkspace === 'overview' || state.financeWorkspace === 'mapping' || panelKey !== state.financeWorkspace;
      });

      const mappingHost = document.getElementById('financeMappingWorkspace');
      if (mappingHost) mappingHost.hidden = state.financeWorkspace !== 'mapping';
    } finally {
      state.financeApplying = false;
    }
  }

  function observeFinance() {
    const finance = document.getElementById('finance');
    if (!finance || state.financeObserver) return;
    state.financeObserver = new MutationObserver(() => {
      if (state.financeApplying) return;
      queueMicrotask(decorateFinance);
    });
    state.financeObserver.observe(finance, { childList:true, subtree:true });
    decorateFinance();
  }

  function todayPriority(snapshot) {
    if (!snapshot.online) return { state:'blocked', badge:'OFFLINE', title:'Keep local work safe', body:'Use only offline-capable drafts/outbox work until live reads and writes recover.', route:null };
    if (snapshot.conflicts > 0) return { state:'blocked', badge:'REVIEW', title:'Resolve sync conflicts first', body:`${snapshot.conflicts} conflict${snapshot.conflicts === 1 ? '' : 's'} need deliberate review before retry.`, route:'admin' };
    if (snapshot.drafts > 0) return { state:'action', badge:'RESUME', title:'Resume saved field work', body:`${snapshot.drafts} saved draft${snapshot.drafts === 1 ? '' : 's'} remain on this device.`, route:String((window.YWIMobileFormAssist?.draftSummaries?.()?.[0]?.route || '#today')).replace(/^#/,'') };
    if (snapshot.forms > 0 || snapshot.actions > 0) return { state:'action', badge:'PENDING', title:'Confirm queued work', body:'Local work is queued. Keep it visible until the server confirms synchronization.', route:'jobs' };
    return { state:'ready', badge:'READY', title:'Choose today’s next field action', body:'Sync is current. Start with the job, safety, or supervisor action that applies now.', route:'jobs' };
  }

  function groupTodayCards() {
    const grid = document.getElementById('mobileTodayGrid');
    if (!grid || grid.dataset.organized === '1') return;
    const cards = Array.from(grid.querySelectorAll('[data-today-card]'));
    if (!cards.length) return;
    const groups = [
      { title:'Now / work', keys:['drafts','jobs'] },
      { title:'Safety & field', keys:['toolbox','incident','ppe','inspect','hseops'] },
      { title:'Supervision & admin', keys:['crew','admin'] }
    ];
    groups.forEach((group) => {
      const members = cards.filter((card) => group.keys.includes(card.dataset.todayCard));
      if (!members.length) return;
      const label = document.createElement('div');
      label.className = 'today-group-heading';
      label.textContent = group.title;
      grid.appendChild(label);
      members.forEach((card) => grid.appendChild(card));
    });
    grid.dataset.organized = '1';
  }

  function decorateToday() {
    const today = document.getElementById('today');
    if (!today) return;
    ensureStyles();
    const snapshot = window.YWIMobileToday?.syncSnapshot?.() || { online:navigator.onLine !== false, forms:0, drafts:0, actions:0, conflicts:0 };
    const priority = todayPriority(snapshot);
    let panel = document.getElementById('todayDirection');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'todayDirection';
      panel.className = 'workspace-direction';
      const sync = document.getElementById('fieldSyncHealth');
      if (sync?.parentElement === today) today.insertBefore(panel, sync);
      else today.prepend(panel);
    }
    panel.dataset.state = priority.state;
    panel.innerHTML = `<div class="workspace-direction-head"><div><small>What needs attention now</small><h3>${esc(priority.title)}</h3><p>${esc(priority.body)}</p></div><span class="workspace-direction-badge">${esc(priority.badge)}</span></div><div class="workspace-direction-actions">${priority.route ? `<button type="button" class="primary" data-today-direction="${esc(priority.route)}">Open next action</button>` : ''}<button type="button" class="secondary" data-today-direction="toolbox">Safety</button><button type="button" class="secondary" data-today-direction="jobs">Jobs</button>${String(window.YWI_AUTH?.getState?.()?.role || '').toLowerCase() === 'admin' ? '<button type="button" class="secondary" data-today-direction="admin">Admin</button>' : ''}</div>`;
    panel.querySelectorAll('[data-today-direction]').forEach((button) => button.addEventListener('click', () => window.YWIRouter?.showSection?.(button.dataset.todayDirection)));
    groupTodayCards();
  }

  function itPanelState(panel) {
    if (panel.querySelector('.it-readiness-status.error,.it-readiness-error')) return 'blocked';
    if (panel.querySelector('.it-readiness-status.warning')) return 'action';
    if (panel.querySelector('.it-readiness-status.passed')) return 'ready';
    return 'open';
  }

  function groupState(panels) {
    if (panels.some((panel) => itPanelState(panel) === 'blocked')) return 'blocked';
    if (panels.some((panel) => itPanelState(panel) === 'action')) return 'action';
    if (panels.some((panel) => itPanelState(panel) === 'ready')) return 'ready';
    return 'open';
  }

  function classifyItPanel(panel) {
    const text = String(panel.textContent || '').trim().toLowerCase();
    return IT_GROUPS.find((group) => group.match.some((needle) => text.includes(needle)))?.key || 'operations';
  }

  function decorateIT() {
    if (state.itApplying) return;
    const host = document.getElementById('itReadinessWorkspace');
    const grid = host?.querySelector('.it-readiness-grid');
    if (!host || !grid || grid.dataset.organized === '1') return;
    state.itApplying = true;
    try {
      ensureStyles();
      const panels = Array.from(grid.children).filter((node) => node.classList?.contains('it-readiness-panel'));
      if (!panels.length) return;
      const buckets = Object.fromEntries(IT_GROUPS.map((group) => [group.key, []]));
      panels.forEach((panel) => buckets[classifyItPanel(panel)].push(panel));
      grid.innerHTML = '';
      const nav = document.createElement('div');
      nav.className = 'it-readiness-domain-nav';
      IT_GROUPS.forEach((group, index) => {
        const members = buckets[group.key];
        if (!members.length) return;
        const current = groupState(members);
        const details = document.createElement('details');
        details.className = 'it-readiness-domain';
        details.id = `itDomain-${group.key}`;
        details.open = index === 0 || current === 'blocked';
        const summary = document.createElement('summary');
        summary.innerHTML = `<span>${esc(group.title)}</span><span class="it-domain-state ${esc(current)}">${esc(current === 'action' ? 'action required' : current)}</span>`;
        const body = document.createElement('div');
        body.className = 'it-readiness-domain-body';
        members.forEach((panel) => body.appendChild(panel));
        details.append(summary, body);
        grid.appendChild(details);
        const jump = document.createElement('button');
        jump.type = 'button';
        jump.className = 'it-domain-jump';
        jump.dataset.itDomain = group.key;
        jump.innerHTML = `<strong>${esc(group.title)}</strong><small>${members.length} panel${members.length === 1 ? '' : 's'} · ${esc(current)}</small>`;
        jump.addEventListener('click', () => { details.open = true; details.scrollIntoView({ behavior:'smooth', block:'start' }); });
        nav.appendChild(jump);
      });
      const hero = host.querySelector('.it-readiness-hero');
      hero?.insertAdjacentElement('afterend', nav);
      grid.dataset.organized = '1';
    } finally {
      state.itApplying = false;
    }
  }

  function observeIT() {
    const host = document.getElementById('itReadinessWorkspace');
    if (!host || state.itObserver) return;
    state.itObserver = new MutationObserver(() => {
      if (state.itApplying) return;
      queueMicrotask(decorateIT);
    });
    state.itObserver.observe(host, { childList:true, subtree:true });
    decorateIT();
  }

  function syncCurrentRoute() {
    patchFinanceApi();
    const route = currentRoute();
    if (route === 'today') decorateToday();
    if (route === 'finance') { observeFinance(); decorateFinance(); }
    if (route === 'it') { observeIT(); decorateIT(); }
  }

  function bind() {
    ensureStyles();
    patchFinanceApi();
    if (!state.financeApiPatched && !state.patchTimer) state.patchTimer = setInterval(patchFinanceApi, 50);
    document.addEventListener('DOMContentLoaded', syncCurrentRoute);
    document.addEventListener('ywi:boot-ready', syncCurrentRoute);
    document.addEventListener('ywi:auth-changed', syncCurrentRoute);
    document.addEventListener('ywi:route-shown', syncCurrentRoute);
    document.addEventListener('ywi:mobile-today-rendered', decorateToday);
    document.addEventListener('ywi:module-loaded', (event) => {
      if (event?.detail?.moduleKey === 'finance') { patchFinanceApi(); queueMicrotask(() => { observeFinance(); decorateFinance(); }); }
      if (event?.detail?.moduleKey === 'admin') queueMicrotask(() => { observeIT(); decorateIT(); });
    });
    if (document.readyState !== 'loading') queueMicrotask(syncCurrentRoute);
  }

  window.YWIWorkspaceOrganization = Object.freeze({
    selectFinanceWorkspace,
    decorateFinance,
    decorateToday,
    decorateIT,
    patchFinanceApi,
    getState: () => ({ financeWorkspace:state.financeWorkspace, financeApiPatched:state.financeApiPatched })
  });

  bind();
})();

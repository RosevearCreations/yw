/* File: js/admin-hub-ui.js
   Build 229 Admin information architecture.
   Organizes the legacy long-form Admin manager into focused, permission-aware workspaces.
   The existing Admin controller remains the data/action authority; this layer only controls
   navigation, progressive disclosure, first-load load shedding, and operator orientation.
*/

'use strict';

(function () {
  const STORAGE_SECTION = 'ywi_admin_hub_section_v1';
  const STORAGE_OPEN = 'ywi_admin_hub_open_panels_v1';
  const STYLE_ID = 'ywi-admin-hub-style';
  const HUB_VERSION = 1;

  const GROUPS = Object.freeze([
    { key:'people', label:'People & Access', description:'Staff profiles, roles, assignments, passwords, and access controls.', refresh:'ad_staff_refresh_panel', minimum:'manage', icon:'👥' },
    { key:'operations', label:'Business & Operations', description:'Jobs, sites, catalog setup, routes, work orders, and operating configuration.', refresh:'ad_jobs_refresh_panel', minimum:'view', icon:'▦' },
    { key:'safety', label:'Safety & Evidence', description:'Ontario safety administration, evidence queues, HSE proof, and corrective follow-up.', refresh:'ad_evidence_refresh_panel', minimum:'view', icon:'✚' },
    { key:'accounting', label:'Finance & Accounting', description:'Close controls, accounting administration, reconciliation, tax and payroll review.', refresh:'ad_accounting_refresh_panel', minimum:'manage', icon:'$' },
    { key:'messaging', label:'Diagnostics & Integrations', description:'Health signals, messaging, smoke checks, conflicts, notifications, and integration diagnostics.', refresh:'ad_health_refresh_panel', minimum:'view', icon:'⌁' },
    { key:'readiness', label:'Audit & Security', description:'Production readiness, role permissions, audit history, deployment gates, and security controls.', refresh:'ad_health_refresh_panel', minimum:'manage', icon:'◆' },
    { key:'it', label:'I.T. & System', description:'Runtime, database/schema, authentication, repository/release, staging, and observability readiness.', route:'it', minimum:'manage', icon:'⚙' }
  ]);

  const PANEL_GROUPS = Object.freeze({
    'Admin Home Command Center':['home'],
    'App Health and Schema Center':['home','messaging','readiness'],
    'Admin Task Inbox':['home','operations','safety','accounting'],
    'Guided Close Center':['accounting'],
    'Evidence Manager':['safety'],
    'Production Readiness and Permissions':['readiness'],
    'Staff Directory and Access':['people'],
    'Assignment Workbench':['people'],
    'Dropdown and Catalog Manager':['people','operations'],
    'Admin Password Control':['people'],
    'Orders and Accounting Stub':['accounting'],
    'Ontario OHSA / Workplace Safety Hub':['safety'],
    'Operations and Accounting Backbone Manager':['operations','safety','accounting'],
    'Deploy Smoke Check':['messaging'],
    'Conflict Review':['messaging'],
    'Approval Queue':['messaging'],
    'Email Preview / Test Send':['messaging']
  });

  const SECTION_LABELS = Object.freeze({
    home:'Admin Home', people:'People & Access', operations:'Business & Operations', safety:'Safety & Evidence',
    accounting:'Finance & Accounting', messaging:'Diagnostics & Integrations', health:'System Health', readiness:'Audit & Security'
  });

  function authState() { return window.YWI_AUTH?.getState?.() || {}; }
  function role() { return authState().role || 'employee'; }
  function security() { return window.YWISecurity || null; }
  function can(minimum = 'view') { return security()?.canViewModule?.('admin', role(), minimum) === true; }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; }
    catch { return fallback; }
  }
  function saveJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #admin.ywi-admin-hub-ready > .section-graphic-placeholder { display:none !important; }
      .admin-hub-shell { margin: 14px 0 18px; }
      .admin-hub-topline { display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px; }
      .admin-hub-breadcrumb { color:#b9c8dc;font-size:.9rem; }
      .admin-hub-breadcrumb strong { color:#f5f8fc; }
      .admin-hub-search { display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:8px;max-width:760px; }
      .admin-hub-search input { min-width:0; }
      .admin-hub-needs { border:1px solid rgba(245,158,11,.38);background:rgba(120,53,15,.14);border-radius:16px;padding:14px;margin:14px 0; }
      .admin-hub-needs[data-state="clear"] { border-color:rgba(34,197,94,.35);background:rgba(20,83,45,.14); }
      .admin-hub-needs-head { display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px; }
      .admin-hub-needs-list { display:grid;gap:7px; }
      .admin-hub-need { display:flex;gap:10px;align-items:flex-start;padding:9px 10px;border-radius:10px;background:rgba(15,23,42,.52); }
      .admin-hub-need strong { min-width:92px; }
      .admin-hub-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin:14px 0; }
      .admin-hub-card { text-align:left;display:flex;flex-direction:column;gap:7px;min-height:156px;padding:15px;border:1px solid rgba(148,163,184,.23);border-radius:16px;background:linear-gradient(180deg,rgba(30,41,59,.93),rgba(15,23,42,.93));color:inherit;cursor:pointer; }
      .admin-hub-card:hover,.admin-hub-card:focus-visible { border-color:rgba(96,165,250,.7);transform:translateY(-1px); }
      .admin-hub-card[aria-current="page"] { border-color:rgba(96,165,250,.9);box-shadow:0 0 0 1px rgba(96,165,250,.24) inset; }
      .admin-hub-card-icon { font-size:1.35rem; }
      .admin-hub-card-title { font-size:1rem;font-weight:800; }
      .admin-hub-card small { line-height:1.35;color:#c4d1e2; }
      .admin-hub-status { margin-top:auto;display:inline-flex;align-items:center;width:max-content;max-width:100%;padding:4px 8px;border-radius:999px;font-size:.72rem;font-weight:800;letter-spacing:.03em;text-transform:uppercase;background:rgba(148,163,184,.15); }
      .admin-hub-status[data-state="ready"] { background:rgba(34,197,94,.17);color:#bbf7d0; }
      .admin-hub-status[data-state="action"] { background:rgba(245,158,11,.18);color:#fde68a; }
      .admin-hub-status[data-state="blocked"] { background:rgba(239,68,68,.18);color:#fecaca; }
      .admin-hub-status[data-state="external"] { background:rgba(59,130,246,.18);color:#bfdbfe; }
      .admin-hub-activity { margin:14px 0;border:1px solid rgba(148,163,184,.2);border-radius:14px;padding:12px; }
      .admin-hub-activity-list { display:grid;gap:6px;margin-top:8px; }
      .admin-hub-activity-row { padding:8px 9px;border-radius:9px;background:rgba(15,23,42,.46);font-size:.88rem; }
      .admin-hub-search-results { display:grid;gap:5px;margin-top:8px; }
      .admin-hub-search-result { width:100%;text-align:left;padding:9px 10px;border-radius:9px;background:rgba(15,23,42,.62);border:1px solid rgba(148,163,184,.2);color:inherit; }
      #admin .admin-section-nav { display:none !important; }
      #admin .admin-hub-detail { margin:12px 0;border:1px solid rgba(148,163,184,.18);border-radius:14px;background:rgba(15,23,42,.22);overflow:clip; }
      #admin .admin-hub-detail[hidden] { display:none !important; }
      #admin .admin-hub-detail > summary { cursor:pointer;list-style:none;padding:13px 15px;font-weight:800;background:rgba(30,41,59,.7);display:flex;align-items:center;justify-content:space-between;gap:10px; }
      #admin .admin-hub-detail > summary::-webkit-details-marker { display:none; }
      #admin .admin-hub-detail > summary::after { content:'Open';font-size:.75rem;font-weight:700;color:#b9c8dc; }
      #admin .admin-hub-detail[open] > summary::after { content:'Close'; }
      #admin .admin-hub-detail > .admin-panel-block { margin:0 !important;border:0 !important;border-radius:0 !important; }
      #admin .admin-hub-workspace-heading { display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin:14px 0 8px; }
      #admin .admin-hub-workspace-heading h3 { margin:0; }
      @media (max-width:700px) { .admin-hub-search{grid-template-columns:1fr}.admin-hub-grid{grid-template-columns:1fr}.admin-hub-card{min-height:0}.admin-hub-need{display:block}.admin-hub-need strong{display:block;margin-bottom:3px} }
    `;
    document.head.appendChild(style);
  }

  function panelTitle(panel) {
    return String(panel?.dataset?.adminPanelTitle || panel?.querySelector('h3')?.textContent || 'Admin workspace').trim();
  }

  function groupsForTitle(title) {
    if (PANEL_GROUPS[title]) return PANEL_GROUPS[title];
    const text = title.toLowerCase();
    if (/staff|password|assignment|access|catalog/.test(text)) return ['people'];
    if (/account|bank|close|tax|payroll|journal|finance/.test(text)) return ['accounting'];
    if (/safety|hse|evidence|incident|attendance/.test(text)) return ['safety'];
    if (/health|schema|deploy|smoke|conflict|notification|email|diagnostic|integration/.test(text)) return ['messaging','readiness'];
    if (/readiness|permission|audit|security/.test(text)) return ['readiness'];
    return ['operations'];
  }

  function wrapPanels(section) {
    const existing = [...section.querySelectorAll(':scope > .admin-panel-block')];
    const remembered = new Set(loadJson(STORAGE_OPEN, []));
    for (const panel of existing) {
      if (panel.closest('.admin-hub-detail')) continue;
      const title = panelTitle(panel);
      panel.dataset.adminPanelTitle = title;
      const groups = groupsForTitle(title);
      panel.dataset.adminSectionGroups = groups.join(',');
      const details = document.createElement('details');
      details.className = 'admin-hub-detail';
      details.dataset.adminHubTitle = title;
      details.dataset.adminHubGroups = groups.join(',');
      details.open = remembered.has(title) || title === 'Admin Home Command Center';
      const summary = document.createElement('summary');
      summary.textContent = title;
      panel.before(details);
      details.append(summary, panel);
      details.addEventListener('toggle', () => {
        const open = [...section.querySelectorAll('.admin-hub-detail[open]')].map((node) => node.dataset.adminHubTitle).filter(Boolean);
        saveJson(STORAGE_OPEN, open);
      });
    }
  }

  function severityFromBadge(id) {
    const badge = document.getElementById(id);
    const status = String(badge?.dataset?.status || '').toLowerCase();
    const text = String(badge?.textContent || '').toLowerCase();
    if (status === 'error' || /fail|timeout|error|blocked/.test(text)) return ['BLOCKED','blocked'];
    if (status === 'ok' || /\blive\b|ready|current/.test(text)) return ['READY','ready'];
    return ['OPEN TO LOAD','external'];
  }

  function statusForGroup(group) {
    if (group.key === 'it') return ['OPEN I.T. READINESS','external'];
    const badgeMap = { people:'ad_staff_age_badge', operations:'ad_jobs_age_badge', safety:'ad_evidence_age_badge', accounting:'ad_accounting_age_badge', messaging:'ad_health_age_badge', readiness:'ad_health_age_badge' };
    return severityFromBadge(badgeMap[group.key]);
  }

  function collectNeeds() {
    const items = [];
    const diagnostics = Array.isArray(window.YWIAppDiagnostics?.getItems?.()) ? window.YWIAppDiagnostics.getItems() : [];
    diagnostics.slice(0,3).forEach((row) => items.push({ label:'Runtime', message:row?.message || row?.scope || 'Runtime diagnostic requires review.', section:'messaging' }));

    const taskRows = [...document.querySelectorAll('#ad_task_table tbody tr')].filter((row) => row.cells?.length && !/no .*loaded|no tasks/i.test(row.textContent || ''));
    taskRows.slice(0,3).forEach((row) => items.push({ label:'Admin task', message:[...row.cells].slice(0,3).map((cell) => cell.textContent.trim()).filter(Boolean).join(' · '), section:'home' }));

    const healthRows = [...document.querySelectorAll('#ad_health_table tbody tr')].filter((row) => /fail|error|blocked|warning|timeout/i.test(row.textContent || ''));
    healthRows.slice(0,2).forEach((row) => items.push({ label:'System', message:[...row.cells].slice(0,4).map((cell) => cell.textContent.trim()).filter(Boolean).join(' · '), section:'messaging' }));

    return items.slice(0,7);
  }

  function collectAuditRows() {
    return [...document.querySelectorAll('#ad_audit_log_table tbody tr')]
      .filter((row) => row.cells?.length && !/no .*loaded|no audit/i.test(row.textContent || ''))
      .slice(0,5)
      .map((row) => [...row.cells].slice(0,5).map((cell) => cell.textContent.trim()).filter(Boolean).join(' · '));
  }

  function createShell(section) {
    let shell = document.getElementById('ad_hub_shell');
    if (shell) return shell;
    shell = document.createElement('div');
    shell.id = 'ad_hub_shell';
    shell.className = 'admin-hub-shell';
    shell.innerHTML = `
      <div class="admin-hub-topline">
        <div id="ad_hub_breadcrumb" class="admin-hub-breadcrumb">Admin / <strong>Admin Home</strong></div>
        <button id="ad_hub_home" class="secondary" type="button">Admin Home</button>
      </div>
      <div class="admin-hub-search" role="search">
        <input id="ad_hub_search_input" type="search" placeholder="Find an Admin setting, screen, or control…" aria-label="Find an Admin setting" />
        <button id="ad_hub_search_clear" class="secondary" type="button">Clear</button>
      </div>
      <div id="ad_hub_search_results" class="admin-hub-search-results" hidden></div>
      <section id="ad_hub_needs" class="admin-hub-needs" aria-live="polite"></section>
      <div id="ad_hub_grid" class="admin-hub-grid" aria-label="Admin workspace groups"></div>
      <section class="admin-hub-activity" aria-labelledby="ad_hub_activity_title">
        <div class="admin-hub-needs-head"><strong id="ad_hub_activity_title">Recent Admin & Audit Activity</strong><button type="button" class="secondary" data-admin-hub-open="readiness">Open Audit & Security</button></div>
        <div id="ad_hub_activity_list" class="admin-hub-activity-list"></div>
      </section>
      <div id="ad_hub_workspace_heading" class="admin-hub-workspace-heading" hidden><div><span class="module-kicker">Admin workspace</span><h3 id="ad_hub_workspace_title">Admin Home</h3><p id="ad_hub_workspace_description" class="section-subtitle"></p></div><button id="ad_hub_back" class="secondary" type="button">Back to Admin Home</button></div>
    `;
    const heading = section.querySelector(':scope > .section-heading');
    if (heading) heading.after(shell); else section.prepend(shell);
    return shell;
  }

  function buildSearchIndex(section) {
    const cards = GROUPS.map((group) => ({ type:'group', key:group.key, title:group.label, description:group.description }));
    const panels = [...section.querySelectorAll('.admin-hub-detail')].map((details) => ({
      type:'panel',
      key:details.dataset.adminHubTitle,
      title:details.dataset.adminHubTitle,
      description:details.querySelector('.section-subtitle')?.textContent?.trim?.() || '',
      groups:String(details.dataset.adminHubGroups || '').split(',').filter(Boolean)
    }));
    return [...cards, ...panels];
  }

  function currentGroup(key) { return GROUPS.find((group) => group.key === key) || null; }

  function createController(section, instance, deferredScopes) {
    const loadedGroups = new Set(['home']);
    let selected = 'home';
    let refreshTimer = 0;
    let searchIndex = [];

    function groupAllowed(group) {
      if (group.key === 'it') return can(group.minimum);
      return can(group.minimum);
    }

    function setBreadcrumb(key) {
      const crumb = document.getElementById('ad_hub_breadcrumb');
      const title = key === 'home' ? 'Admin Home' : (currentGroup(key)?.label || SECTION_LABELS[key] || key);
      if (crumb) crumb.innerHTML = `Admin / <strong>${esc(title)}</strong>`;
      const titleEl = document.getElementById('ad_hub_workspace_title');
      const descEl = document.getElementById('ad_hub_workspace_description');
      const heading = document.getElementById('ad_hub_workspace_heading');
      if (heading) heading.hidden = key === 'home';
      if (titleEl) titleEl.textContent = title;
      if (descEl) descEl.textContent = currentGroup(key)?.description || '';
    }

    function syncDetailsVisibility(key) {
      section.querySelectorAll('.admin-hub-detail').forEach((details) => {
        const groups = String(details.dataset.adminHubGroups || '').split(',').filter(Boolean);
        const visible = key === 'home' ? groups.includes('home') : groups.includes(key);
        details.hidden = !visible;
      });
    }

    function refreshCards() {
      const grid = document.getElementById('ad_hub_grid');
      if (!grid) return;
      grid.innerHTML = GROUPS.filter(groupAllowed).map((group) => {
        const [label,state] = statusForGroup(group);
        return `<button type="button" class="admin-hub-card" data-admin-hub-group="${esc(group.key)}" ${selected === group.key ? 'aria-current="page"' : ''}>
          <span class="admin-hub-card-icon" aria-hidden="true">${esc(group.icon)}</span>
          <span class="admin-hub-card-title">${esc(group.label)}</span>
          <small>${esc(group.description)}</small>
          <span class="admin-hub-status" data-state="${esc(state)}">${esc(label)}</span>
        </button>`;
      }).join('');
    }

    function refreshNeedsAndActivity() {
      const needsHost = document.getElementById('ad_hub_needs');
      if (needsHost) {
        const needs = collectNeeds();
        needsHost.dataset.state = needs.length ? 'action' : 'clear';
        needsHost.innerHTML = `<div class="admin-hub-needs-head"><strong>Needs Attention</strong><span class="admin-hub-status" data-state="${needs.length ? 'action' : 'ready'}">${needs.length ? `${needs.length} ACTION${needs.length === 1 ? '' : 'S'}` : 'CLEAR'}</span></div>${needs.length ? `<div class="admin-hub-needs-list">${needs.map((item) => `<button type="button" class="admin-hub-need" data-admin-hub-open="${esc(item.section)}"><strong>${esc(item.label)}</strong><span>${esc(item.message)}</span></button>`).join('')}</div>` : '<small>No current browser diagnostics or loaded Admin task/health exceptions require attention.</small>'}`;
      }
      const activityHost = document.getElementById('ad_hub_activity_list');
      if (activityHost) {
        const rows = collectAuditRows();
        activityHost.innerHTML = rows.length ? rows.map((row) => `<div class="admin-hub-activity-row">${esc(row)}</div>`).join('') : '<small>Audit activity is loaded on demand. Open Audit & Security to retrieve the latest administrative history.</small>';
      }
      refreshCards();
    }

    function scheduleSummaryRefresh() {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(refreshNeedsAndActivity, 80);
    }

    function loadGroupOnce(key) {
      if (loadedGroups.has(key)) return;
      const group = currentGroup(key);
      if (!group) return;
      loadedGroups.add(key);
      if (group.route) return;
      const button = group.refresh ? document.getElementById(group.refresh) : null;
      if (button && !button.disabled) setTimeout(() => button.click(), 0);
    }

    function open(key = 'home', options = {}) {
      const clean = String(key || 'home').trim().toLowerCase();
      const group = currentGroup(clean);
      if (group?.route) {
        window.YWIRouter?.showSection?.(group.route);
        return;
      }
      selected = clean === 'health' ? 'messaging' : clean;
      if (selected !== 'home' && !groupAllowed(currentGroup(selected) || { minimum:'view' })) selected = 'home';
      try { instance.applyAdminSectionFilter?.(selected === 'readiness' ? 'readiness' : selected); } catch {}
      syncDetailsVisibility(selected);
      setBreadcrumb(selected);
      saveJson(STORAGE_SECTION, selected);
      loadGroupOnce(selected);
      refreshCards();
      if (options.panelTitle) {
        const details = [...section.querySelectorAll('.admin-hub-detail')].find((node) => node.dataset.adminHubTitle === options.panelTitle);
        if (details) { details.hidden = false; details.open = true; details.scrollIntoView({ behavior:'smooth', block:'start' }); }
      } else if (selected !== 'home') {
        document.getElementById('ad_hub_workspace_heading')?.scrollIntoView?.({ behavior:'smooth', block:'start' });
      }
    }

    function renderSearch(query) {
      const host = document.getElementById('ad_hub_search_results');
      if (!host) return;
      const q = String(query || '').trim().toLowerCase();
      if (!q) { host.hidden = true; host.innerHTML = ''; return; }
      const matches = searchIndex.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(q)).slice(0,8);
      host.hidden = false;
      host.innerHTML = matches.length ? matches.map((item) => `<button type="button" class="admin-hub-search-result" data-admin-search-type="${esc(item.type)}" data-admin-search-key="${esc(item.key)}"><strong>${esc(item.title)}</strong><br><small>${esc(item.description || '')}</small></button>`).join('') : '<div class="admin-hub-search-result">No matching Admin setting or workspace.</div>';
    }

    function bindShell() {
      const shell = createShell(section);
      searchIndex = buildSearchIndex(section);
      shell.addEventListener('click', (event) => {
        const groupButton = event.target.closest('[data-admin-hub-group],[data-admin-hub-open]');
        if (groupButton) { open(groupButton.getAttribute('data-admin-hub-group') || groupButton.getAttribute('data-admin-hub-open') || 'home'); return; }
        const result = event.target.closest('[data-admin-search-type]');
        if (result) {
          const type = result.getAttribute('data-admin-search-type');
          const key = result.getAttribute('data-admin-search-key') || '';
          if (type === 'group') open(key);
          else {
            const indexed = searchIndex.find((item) => item.type === 'panel' && item.key === key);
            open(indexed?.groups?.[0] || 'home', { panelTitle:key });
          }
          return;
        }
      });
      document.getElementById('ad_hub_home')?.addEventListener('click', () => open('home'));
      document.getElementById('ad_hub_back')?.addEventListener('click', () => open('home'));
      const input = document.getElementById('ad_hub_search_input');
      input?.addEventListener('input', () => renderSearch(input.value));
      input?.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        const first = document.querySelector('#ad_hub_search_results [data-admin-search-type]');
        if (first) { event.preventDefault(); first.click(); }
      });
      document.getElementById('ad_hub_search_clear')?.addEventListener('click', () => { if (input) input.value=''; renderSearch(''); input?.focus(); });
    }

    bindShell();
    const observer = new MutationObserver(scheduleSummaryRefresh);
    observer.observe(section, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['data-status'] });
    const remembered = String(loadJson(STORAGE_SECTION, 'home') || 'home');
    open(remembered);
    scheduleSummaryRefresh();

    return Object.freeze({ open, refresh:refreshNeedsAndActivity, version:HUB_VERSION, deferredScopes:[...deferredScopes] });
  }

  function decorateFactory() {
    const factory = window.YWIAdminUI?.create;
    if (typeof factory !== 'function' || factory.__ywiAdminHubDecorated) return;

    const decorated = function createAdminWithHub(config = {}) {
      let initialPhase = true;
      const deferredScopes = new Set();
      const originalDirectory = config.loadAdminDirectory;
      const originalSelectors = config.loadAdminSelectors;
      const guardedConfig = {
        ...config,
        loadAdminDirectory: async (payload = {}) => {
          const scope = String(payload?.scope || 'all').toLowerCase();
          if (initialPhase && scope !== 'command_center') {
            deferredScopes.add(scope);
            return { deferred_admin_scope:scope, pagination_meta:{} };
          }
          return originalDirectory(payload);
        },
        loadAdminSelectors: async (...args) => {
          if (initialPhase) return {};
          return typeof originalSelectors === 'function' ? originalSelectors(...args) : {};
        }
      };

      const instance = factory(guardedConfig);
      if (!instance || typeof instance.init !== 'function') return instance;
      const originalInit = instance.init.bind(instance);
      let controller = null;
      instance.init = async (...args) => {
        injectStyles();
        const section = document.getElementById('admin');
        const layoutObserver = section ? new MutationObserver(() => {
          if (section.querySelector('.admin-panel-block') && !section.classList.contains('ywi-admin-hub-ready')) {
            wrapPanels(section);
            section.classList.add('ywi-admin-hub-ready');
          }
        }) : null;
        layoutObserver?.observe(section, { childList:true, subtree:false });
        try {
          await Promise.resolve(originalInit(...args));
        } finally {
          initialPhase = false;
          layoutObserver?.disconnect();
        }
        if (section) {
          wrapPanels(section);
          section.classList.add('ywi-admin-hub-ready');
          controller = controller || createController(section, instance, deferredScopes);
          window.YWIAdminHub = controller;
        }
        return instance;
      };
      return instance;
    };
    decorated.__ywiAdminHubDecorated = true;
    decorated.__ywiOriginalCreate = factory;
    window.YWIAdminUI.create = decorated;
  }

  injectStyles();
  decorateFactory();
})();

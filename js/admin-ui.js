'use strict';

/* =========================================================
   js/admin-ui.js
   Admin dashboard UI module

   Purpose:
   - move admin dashboard behavior out of app.js
   - manage directory tables, selectors, and form loading
   - handle admin lock state and role-aware UI behavior
   - keep existing DOM ids and endpoint payloads intact
========================================================= */

(function () {
  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function escHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function slugifyToken(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function roleChip(label) {
    const safe = escHtml(label || 'unknown');
    const slug = slugifyToken(label || 'unknown');
    return `<span class="role-chip role-chip--${slug}">${safe}</span>`;
  }

  function setNotice(el, text) {
    if (!el) return;
    if (text) {
      el.style.display = 'block';
      el.textContent = text;
    } else {
      el.style.display = 'none';
      el.textContent = '';
    }
  }

  function fillSelectOptions(selectEl, rows, placeholder = 'Select...') {
    if (!selectEl) return;

    const current = selectEl.value || '';
    selectEl.innerHTML = '';

    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = placeholder;
    selectEl.appendChild(empty);

    rows.forEach((row) => {
      const opt = document.createElement('option');
      opt.value = String(row.id ?? '');
      opt.textContent = row.option_label || row.display_label || row.email || row.site_code || String(row.id);
      selectEl.appendChild(opt);
    });

    if (current && rows.some(r => String(r.id) === current)) {
      selectEl.value = current;
    }
  }

  function pickById(rows, id) {
    return rows.find(r => String(r.id) === String(id)) || null;
  }

  function createAdminUI(config = {}) {
    const loadAdminDirectory = config.loadAdminDirectory;
    const loadAdminSelectors = config.loadAdminSelectors;
    const manageSummary = config.manageSummary || (() => {});
    const getCurrentRole = config.getCurrentRole || (() => 'worker');
    const onProfileLoaded = config.onProfileLoaded || (() => {});
    const onSiteLoaded = config.onSiteLoaded || (() => {});
    const onAssignmentLoaded = config.onAssignmentLoaded || (() => {});

    const els = {
      adminSection: $('#admin'),

      adSearch: $('#ad_search'),
      adSiteId: $('#ad_site_id'),
      adProfileId: $('#ad_profile_id'),
      adActiveOnly: $('#ad_active_only'),
      adLimit: $('#ad_limit'),
      adMode: $('#ad_mode'),
      adLoad: $('#ad_load'),
      adClear: $('#ad_clear'),

      adUsersBody: $('#ad_users_table')?.querySelector('tbody') || null,
      adSitesBody: $('#ad_sites_table')?.querySelector('tbody') || null,
      adAssignmentsBody: $('#ad_assignments_table')?.querySelector('tbody') || null,

      adUsersCount: $('#ad_users_count'),
      adSitesCount: $('#ad_sites_count'),
      adAssignmentsCount: $('#ad_assignments_count'),
      adModeLabel: $('#ad_mode_label'),
      adSummary: $('#ad_summary'),

      amSummary: $('#am_summary'),

      amProfileSelector: $('#am_profile_selector'),
      amSiteSelector: $('#am_site_selector'),
      amAssignmentSelector: $('#am_assignment_selector'),
      amAssignmentProfileSelector: $('#am_assignment_profile_selector'),
      amAssignmentSiteSelector: $('#am_assignment_site_selector'),

      amProfileId: $('#am_profile_id'),
      amProfileName: $('#am_profile_name'),
      amProfileRole: $('#am_profile_role'),
      amProfileActive: $('#am_profile_active'),

      amSiteId: $('#am_site_id'),
      amSiteCode: $('#am_site_code'),
      amSiteName: $('#am_site_name'),
      amSiteAddress: $('#am_site_address'),
      amSiteNotes: $('#am_site_notes'),
      amSiteActive: $('#am_site_active'),

      amAssignmentId: $('#am_assignment_id'),
      amAssignmentSiteId: $('#am_assignment_site_id'),
      amAssignmentProfileId: $('#am_assignment_profile_id'),
      amAssignmentRole: $('#am_assignment_role'),
      amAssignmentPrimary: $('#am_assignment_primary'),

      adminModeButtons: Array.from(document.querySelectorAll('[data-admin-mode]'))
    };

    const state = {
      locked: true,
      users: [],
      sites: [],
      assignments: [],
      selectorProfiles: [],
      selectorSites: [],
      selectorAssignments: [],
      selectedUserId: '',
      selectedSiteId: '',
      selectedAssignmentId: ''
    };

    function setManageSummary(text) {
      manageSummary(text);
      setNotice(els.amSummary, text);
    }

    function updateStats({ users = 0, sites = 0, assignments = 0 } = {}) {
      if (els.adUsersCount) els.adUsersCount.textContent = String(users);
      if (els.adSitesCount) els.adSitesCount.textContent = String(sites);
      if (els.adAssignmentsCount) els.adAssignmentsCount.textContent = String(assignments);

      if (els.adModeLabel) {
        const mode = els.adMode?.value || 'all';
        els.adModeLabel.textContent = mode === 'all'
          ? 'All data'
          : mode.charAt(0).toUpperCase() + mode.slice(1);
      }
    }

    function renderEmptyRow(tbody, colspan, text) {
      if (!tbody) return;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="${colspan}" style="color:#9ca3af;">${escHtml(text)}</td>`;
      tbody.appendChild(tr);
    }

    function highlightRow(tbody, selectedId) {
      if (!tbody) return;
      tbody.querySelectorAll('tr[data-admin-row-id]').forEach((tr) => {
        const isSelected = String(tr.dataset.adminRowId || '') === String(selectedId || '');
        tr.classList.toggle('is-selected', isSelected);
      });
    }

    function renderUsers(rows) {
      if (!els.adUsersBody) return;
      els.adUsersBody.innerHTML = '';

      if (!rows.length) {
        renderEmptyRow(els.adUsersBody, 6, 'No profiles found for the current filter.');
        return;
      }

      rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.className = 'admin-table-row';
        tr.dataset.adminType = 'user';
        tr.dataset.adminRowId = String(row.id || '');

        tr.innerHTML = `
          <td>${escHtml(row.id || '')}</td>
          <td>${escHtml(row.email || '')}</td>
          <td>${escHtml(row.full_name || '')}</td>
          <td>${roleChip(row.role || '')}</td>
          <td>${row.is_active ? 'Yes' : 'No'}</td>
          <td>${escHtml(row.primary_site_code || '')}</td>
        `;
        els.adUsersBody.appendChild(tr);
      });

      highlightRow(els.adUsersBody, state.selectedUserId);
    }

    function renderSites(rows) {
      if (!els.adSitesBody) return;
      els.adSitesBody.innerHTML = '';

      if (!rows.length) {
        renderEmptyRow(els.adSitesBody, 6, 'No sites found for the current filter.');
        return;
      }

      rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.className = 'admin-table-row';
        tr.dataset.adminType = 'site';
        tr.dataset.adminRowId = String(row.id || '');

        tr.innerHTML = `
          <td>${escHtml(row.id || '')}</td>
          <td>${escHtml(row.site_code || '')}</td>
          <td>${escHtml(row.site_name || '')}</td>
          <td>${escHtml(row.address || '')}</td>
          <td>${row.is_active ? 'Yes' : 'No'}</td>
          <td>${escHtml(row.assignment_count || 0)}</td>
        `;
        els.adSitesBody.appendChild(tr);
      });

      highlightRow(els.adSitesBody, state.selectedSiteId);
    }

    function renderAssignments(rows) {
      if (!els.adAssignmentsBody) return;
      els.adAssignmentsBody.innerHTML = '';

      if (!rows.length) {
        renderEmptyRow(els.adAssignmentsBody, 7, 'No assignments found for the current filter.');
        return;
      }

      rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.className = 'admin-table-row';
        tr.dataset.adminType = 'assignment';
        tr.dataset.adminRowId = String(row.id || '');

        tr.innerHTML = `
          <td>${escHtml(row.id || '')}</td>
          <td>${escHtml(row.site_code || '')}</td>
          <td>${escHtml(row.site_name || '')}</td>
          <td>${escHtml(row.email || '')}</td>
          <td>${escHtml(row.full_name || '')}</td>
          <td>${roleChip(row.assignment_role || '')}</td>
          <td>${row.is_primary ? 'Yes' : 'No'}</td>
        `;
        els.adAssignmentsBody.appendChild(tr);
      });

      highlightRow(els.adAssignmentsBody, state.selectedAssignmentId);
    }

    function clearDirectory() {
      if (els.adUsersBody) els.adUsersBody.innerHTML = '';
      if (els.adSitesBody) els.adSitesBody.innerHTML = '';
      if (els.adAssignmentsBody) els.adAssignmentsBody.innerHTML = '';

      state.users = [];
      state.sites = [];
      state.assignments = [];
      state.selectedUserId = '';
      state.selectedSiteId = '';
      state.selectedAssignmentId = '';

      updateStats({ users: 0, sites: 0, assignments: 0 });
      setNotice(els.adSummary, '');
    }

    function setLocked(isLocked, message = '') {
      state.locked = !!isLocked;

      if (els.adminSection) {
        els.adminSection.dataset.adminLocked = isLocked ? 'true' : 'false';
      }

      [
        els.adLoad,
        els.adClear,
        els.amProfileSelector,
        els.amSiteSelector,
        els.amAssignmentSelector,
        els.amAssignmentProfileSelector,
        els.amAssignmentSiteSelector,
        ...els.adminModeButtons
      ].forEach((el) => {
        if (el) el.disabled = !!isLocked;
      });

      if (isLocked) {
        setManageSummary(message || 'Admin access is required.');
      }
    }

    function applyRoleAccess() {
      const role = String(getCurrentRole() || 'worker');
      const canUseAdmin = role === 'admin';
      setLocked(!canUseAdmin, canUseAdmin ? '' : 'Admin tools are visible only to admin users.');
    }

    function loadProfileIntoForm(row) {
      if (!row) return;

      state.selectedUserId = String(row.id || '');
      highlightRow(els.adUsersBody, state.selectedUserId);

      if (els.amProfileSelector) els.amProfileSelector.value = row.id || '';
      if (els.amProfileId) els.amProfileId.value = row.id || '';
      if (els.amProfileName) els.amProfileName.value = row.full_name || '';
      if (els.amProfileRole) els.amProfileRole.value = row.role || '';
      if (els.amProfileActive) els.amProfileActive.checked = !!row.is_active;

      setManageSummary(`Loaded profile ${row.email || row.id || ''} into the editor.`);
      onProfileLoaded(row);
    }

    function loadSiteIntoForm(row) {
      if (!row) return;

      state.selectedSiteId = String(row.id || '');
      highlightRow(els.adSitesBody, state.selectedSiteId);

      if (els.amSiteSelector) els.amSiteSelector.value = row.id || '';
      if (els.amSiteId) els.amSiteId.value = row.id || '';
      if (els.amSiteCode) els.amSiteCode.value = row.site_code || '';
      if (els.amSiteName) els.amSiteName.value = row.site_name || '';
      if (els.amSiteAddress) els.amSiteAddress.value = row.address || '';
      if (els.amSiteNotes) els.amSiteNotes.value = row.notes || '';
      if (els.amSiteActive) els.amSiteActive.checked = !!row.is_active;

      setManageSummary(`Loaded site ${row.site_code || row.id || ''} into the editor.`);
      onSiteLoaded(row);
    }

    function loadAssignmentIntoForm(row) {
      if (!row) return;

      state.selectedAssignmentId = String(row.id || '');
      highlightRow(els.adAssignmentsBody, state.selectedAssignmentId);

      if (els.amAssignmentSelector) els.amAssignmentSelector.value = row.id || '';
      if (els.amAssignmentId) els.amAssignmentId.value = row.id || '';
      if (els.amAssignmentSiteId) els.amAssignmentSiteId.value = row.site_id || '';
      if (els.amAssignmentProfileId) els.amAssignmentProfileId.value = row.profile_id || '';
      if (els.amAssignmentRole) els.amAssignmentRole.value = row.assignment_role || 'worker';
      if (els.amAssignmentPrimary) els.amAssignmentPrimary.checked = !!row.is_primary;
      if (els.amAssignmentSiteSelector) els.amAssignmentSiteSelector.value = row.site_id || '';
      if (els.amAssignmentProfileSelector) els.amAssignmentProfileSelector.value = row.profile_id || '';

      setManageSummary(`Loaded assignment ${row.id || ''} into the editor.`);
      onAssignmentLoaded(row);
    }

    async function refreshSelectors() {
      if (state.locked) {
        state.selectorProfiles = [];
        state.selectorSites = [];
        state.selectorAssignments = [];

        fillSelectOptions(els.amProfileSelector, [], 'Admin access required');
        fillSelectOptions(els.amSiteSelector, [], 'Admin access required');
        fillSelectOptions(els.amAssignmentSelector, [], 'Admin access required');
        fillSelectOptions(els.amAssignmentProfileSelector, [], 'Admin access required');
        fillSelectOptions(els.amAssignmentSiteSelector, [], 'Admin access required');
        return;
      }

      const data = await loadAdminSelectors({
        kind: 'all',
        active_only: false,
        limit: 500
      });

      if (!data?.ok) {
        throw new Error(data?.error || 'Selector load failed');
      }

      state.selectorProfiles = data.profiles || [];
      state.selectorSites = data.sites || [];
      state.selectorAssignments = data.assignments || [];

      fillSelectOptions(els.amProfileSelector, state.selectorProfiles, 'Select profile...');
      fillSelectOptions(els.amSiteSelector, state.selectorSites, 'Select site...');
      fillSelectOptions(els.amAssignmentSelector, state.selectorAssignments, 'Select assignment...');
      fillSelectOptions(els.amAssignmentProfileSelector, state.selectorProfiles, 'Select profile...');
      fillSelectOptions(els.amAssignmentSiteSelector, state.selectorSites, 'Select site...');
    }

    async function loadDirectory() {
      if (state.locked) {
        clearDirectory();
        return;
      }

      const data = await loadAdminDirectory({
        search: els.adSearch?.value?.trim?.() || undefined,
        site_id: els.adSiteId?.value?.trim?.() || undefined,
        profile_id: els.adProfileId?.value?.trim?.() || undefined,
        active_only: !!els.adActiveOnly?.checked,
        limit: Number(els.adLimit?.value || 200) || 200,
        mode: els.adMode?.value || 'all'
      });

      if (!data?.ok) {
        throw new Error(data?.error || 'Admin directory load failed');
      }

      state.users = data.users || [];
      state.sites = data.sites || [];
      state.assignments = data.assignments || [];

      renderUsers(state.users);
      renderSites(state.sites);
      renderAssignments(state.assignments);
      updateStats({
        users: state.users.length,
        sites: state.sites.length,
        assignments: state.assignments.length
      });

      setNotice(els.adSummary, 'Directory loaded. Click any row to load it into the matching editor.');
      setManageSummary('Admin directory loaded. Click any row to load it into the editor.');
    }

    function onAdminFilterEnter(e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      loadDirectory().catch((err) => {
        console.error(err);
        alert('Failed to load admin directory.');
      });
    }

    function bindEvents() {
      [els.adSearch, els.adSiteId, els.adProfileId, els.adLimit].forEach((el) => {
        el?.addEventListener('keydown', onAdminFilterEnter);
      });

      els.adLoad?.addEventListener('click', async () => {
        try {
          await loadDirectory();
          await refreshSelectors();
        } catch (err) {
          console.error(err);
          alert('Failed to load admin directory.');
        }
      });

      els.adClear?.addEventListener('click', () => {
        if (els.adSearch) els.adSearch.value = '';
        if (els.adSiteId) els.adSiteId.value = '';
        if (els.adProfileId) els.adProfileId.value = '';
        if (els.adActiveOnly) els.adActiveOnly.checked = false;
        if (els.adLimit) els.adLimit.value = '200';
        if (els.adMode) els.adMode.value = 'all';
        clearDirectory();
      });

      els.adminModeButtons.forEach((btn) => {
        btn.addEventListener('click', async () => {
          const mode = btn.getAttribute('data-admin-mode') || 'all';
          if (els.adMode) els.adMode.value = mode;

          try {
            await loadDirectory();
          } catch (err) {
            console.error(err);
            alert('Failed to switch admin mode.');
          }
        });
      });

      els.adMode?.addEventListener('change', async () => {
        try {
          await loadDirectory();
        } catch (err) {
          console.error(err);
          alert('Failed to change admin mode.');
        }
      });

      els.adUsersBody?.addEventListener('click', (e) => {
        const tr = (e.target instanceof Element) ? e.target.closest('tr[data-admin-row-id]') : null;
        if (!tr) return;
        const row = state.users.find(item => String(item.id || '') === String(tr.dataset.adminRowId || ''));
        if (row) loadProfileIntoForm(row);
      });

      els.adSitesBody?.addEventListener('click', (e) => {
        const tr = (e.target instanceof Element) ? e.target.closest('tr[data-admin-row-id]') : null;
        if (!tr) return;
        const row = state.sites.find(item => String(item.id || '') === String(tr.dataset.adminRowId || ''));
        if (row) loadSiteIntoForm(row);
      });

      els.adAssignmentsBody?.addEventListener('click', (e) => {
        const tr = (e.target instanceof Element) ? e.target.closest('tr[data-admin-row-id]') : null;
        if (!tr) return;
        const row = state.assignments.find(item => String(item.id || '') === String(tr.dataset.adminRowId || ''));
        if (row) loadAssignmentIntoForm(row);
      });

      els.amProfileSelector?.addEventListener('change', () => {
        const row = pickById(state.selectorProfiles, els.amProfileSelector.value);
        if (row) loadProfileIntoForm(row);
      });

      els.amSiteSelector?.addEventListener('change', () => {
        const row = pickById(state.selectorSites, els.amSiteSelector.value);
        if (row) loadSiteIntoForm(row);
      });

      els.amAssignmentSelector?.addEventListener('change', () => {
        const row = pickById(state.selectorAssignments, els.amAssignmentSelector.value);
        if (row) loadAssignmentIntoForm(row);
      });

      els.amAssignmentProfileSelector?.addEventListener('change', () => {
        if (els.amAssignmentProfileId) {
          els.amAssignmentProfileId.value = els.amAssignmentProfileSelector.value || '';
        }
      });

      els.amAssignmentSiteSelector?.addEventListener('change', () => {
        if (els.amAssignmentSiteId) {
          els.amAssignmentSiteId.value = els.amAssignmentSiteSelector.value || '';
        }
      });
    }

    async function init() {
      bindEvents();
      applyRoleAccess();
      clearDirectory();
      await refreshSelectors();
    }

    return {
      init,
      loadDirectory,
      refreshSelectors,
      clearDirectory,
      applyRoleAccess,
      setLocked,
      state
    };
  }

  window.YWIAdminUI = {
    create: createAdminUI
  };
})();

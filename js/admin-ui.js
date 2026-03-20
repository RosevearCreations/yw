/* File: js/admin-ui.js
   Brief description: Admin Dashboard UI controller for loading users, sites, and assignments,
   syncing selectors, filtering results, locking admin-only access, and loading rows into edit forms.
*/

'use strict';

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

  function textMatch(value, search) {
    if (!search) return true;
    return String(value ?? '').toLowerCase().includes(search.toLowerCase());
  }

  function createAdminUI(config = {}) {
    const loadAdminDirectory = config.loadAdminDirectory;
    const loadAdminSelectors = config.loadAdminSelectors;
    const manageSummary = config.manageSummary || function () {};
    const getCurrentRole = config.getCurrentRole || (() => 'worker');
    const onProfileLoaded = config.onProfileLoaded || function () {};
    const onSiteLoaded = config.onSiteLoaded || function () {};
    const onAssignmentLoaded = config.onAssignmentLoaded || function () {};

    const els = {
      section: $('#admin'),

      modeButtons: Array.from(document.querySelectorAll('[data-admin-mode]')),
      modeSelect: $('#ad_mode'),
      search: $('#ad_search'),
      siteId: $('#ad_site_id'),
      profileId: $('#ad_profile_id'),
      activeOnly: $('#ad_active_only'),
      limit: $('#ad_limit'),
      loadBtn: $('#ad_load'),
      clearBtn: $('#ad_clear'),
      summary: $('#ad_summary'),

      usersCount: $('#ad_users_count'),
      sitesCount: $('#ad_sites_count'),
      assignmentsCount: $('#ad_assignments_count'),
      modeLabel: $('#ad_mode_label'),

      usersTable: $('#ad_users_table tbody'),
      sitesTable: $('#ad_sites_table tbody'),
      assignmentsTable: $('#ad_assignments_table tbody'),

      profileSelector: $('#am_profile_selector'),
      siteSelector: $('#am_site_selector'),
      assignmentSelector: $('#am_assignment_selector'),
      assignmentSiteSelector: $('#am_assignment_site_selector'),
      assignmentProfileSelector: $('#am_assignment_profile_selector'),

      formProfileId: $('#am_profile_id'),
      formProfileName: $('#am_profile_name'),
      formProfileRole: $('#am_profile_role'),
      formProfileActive: $('#am_profile_active'),

      formSiteId: $('#am_site_id'),
      formSiteCode: $('#am_site_code'),
      formSiteName: $('#am_site_name'),
      formSiteAddress: $('#am_site_address'),
      formSiteNotes: $('#am_site_notes'),
      formSiteActive: $('#am_site_active'),

      formAssignmentId: $('#am_assignment_id'),
      formAssignmentSiteId: $('#am_assignment_site_id'),
      formAssignmentProfileId: $('#am_assignment_profile_id'),
      formAssignmentRole: $('#am_assignment_role'),
      formAssignmentPrimary: $('#am_assignment_primary')
    };

    const state = {
      locked: true,
      mode: 'all',
      users: [],
      sites: [],
      assignments: [],
      profilesById: new Map(),
      sitesById: new Map(),
      assignmentsById: new Map(),
      selectorData: {
        profiles: [],
        sites: [],
        assignments: []
      }
    };

    function setSummary(text) {
      if (els.summary) {
        if (text) {
          els.summary.style.display = 'block';
          els.summary.textContent = text;
        } else {
          els.summary.style.display = 'none';
          els.summary.textContent = '';
        }
      }
      manageSummary(text);
    }

    function applyRoleAccess() {
      const role = getCurrentRole();
      const allowed = role === 'admin';

      state.locked = !allowed;

      if (els.section) {
        els.section.dataset.adminLocked = allowed ? 'false' : 'true';
        els.section.classList.toggle('is-admin-locked', !allowed);
      }

      [
        els.modeSelect,
        els.search,
        els.siteId,
        els.profileId,
        els.activeOnly,
        els.limit,
        els.loadBtn,
        els.clearBtn,
        els.profileSelector,
        els.siteSelector,
        els.assignmentSelector,
        els.assignmentSiteSelector,
        els.assignmentProfileSelector
      ].forEach((el) => {
        if (el) el.disabled = !allowed;
      });

      els.modeButtons.forEach((btn) => {
        btn.disabled = !allowed;
      });

      if (!allowed) {
        setSummary('Admin access is required to use this dashboard.');
      } else if (!state.users.length && !state.sites.length && !state.assignments.length) {
        setSummary('');
      }
    }

    function setMode(mode) {
      state.mode = mode || 'all';

      if (els.modeSelect) {
        els.modeSelect.value = state.mode;
      }

      els.modeButtons.forEach((btn) => {
        const isActive = btn.dataset.adminMode === state.mode;
        btn.classList.toggle('active', isActive);
      });

      const labelMap = {
        all: 'All data',
        users: 'Users only',
        sites: 'Sites only',
        assignments: 'Assignments only'
      };

      if (els.modeLabel) {
        els.modeLabel.textContent = labelMap[state.mode] || 'All data';
      }

      const showUsers = state.mode === 'all' || state.mode === 'users';
      const showSites = state.mode === 'all' || state.mode === 'sites';
      const showAssignments = state.mode === 'all' || state.mode === 'assignments';

      const usersBlock = $('#ad_users_table')?.closest('.admin-panel-block');
      const sitesBlock = $('#ad_sites_table')?.closest('.admin-panel-block');
      const assignmentsBlock = $('#ad_assignments_table')?.closest('.admin-panel-block');

      if (usersBlock) usersBlock.style.display = showUsers ? '' : 'none';
      if (sitesBlock) sitesBlock.style.display = showSites ? '' : 'none';
      if (assignmentsBlock) assignmentsBlock.style.display = showAssignments ? '' : 'none';
    }

    function clearTableBody(tbody) {
      if (tbody) tbody.innerHTML = '';
    }

    function clearDirectory() {
      state.users = [];
      state.sites = [];
      state.assignments = [];
      state.profilesById.clear();
      state.sitesById.clear();
      state.assignmentsById.clear();

      clearTableBody(els.usersTable);
      clearTableBody(els.sitesTable);
      clearTableBody(els.assignmentsTable);

      if (els.usersCount) els.usersCount.textContent = '0';
      if (els.sitesCount) els.sitesCount.textContent = '0';
      if (els.assignmentsCount) els.assignmentsCount.textContent = '0';

      setSummary(state.locked ? 'Admin access is required to use this dashboard.' : '');
    }

    function fillSelect(selectEl, items, placeholder, valueKey, labelBuilder) {
      if (!selectEl) return;

      const current = selectEl.value;
      selectEl.innerHTML = '';

      const first = document.createElement('option');
      first.value = '';
      first.textContent = placeholder;
      selectEl.appendChild(first);

      items.forEach((item) => {
        const option = document.createElement('option');
        option.value = item[valueKey] ?? '';
        option.textContent = labelBuilder(item);
        selectEl.appendChild(option);
      });

      if (current && Array.from(selectEl.options).some((opt) => opt.value === current)) {
        selectEl.value = current;
      }
    }

    function refreshMaps() {
      state.profilesById = new Map(state.users.map((item) => [String(item.id), item]));
      state.sitesById = new Map(state.sites.map((item) => [String(item.id), item]));
      state.assignmentsById = new Map(state.assignments.map((item) => [String(item.id), item]));
    }

    function getFilteredUsers() {
      const search = els.search?.value?.trim?.() || '';
      const profileId = els.profileId?.value?.trim?.() || '';
      const siteId = els.siteId?.value?.trim?.() || '';
      const activeOnly = !!els.activeOnly?.checked;
      const limit = Math.max(1, Math.min(1000, Number(els.limit?.value || 200)));

      return state.users
        .filter((item) => !profileId || String(item.id) === profileId)
        .filter((item) => !siteId || String(item.primary_site_id || '') === siteId)
        .filter((item) => !activeOnly || !!item.is_active)
        .filter((item) =>
          !search ||
          textMatch(item.email, search) ||
          textMatch(item.full_name, search) ||
          textMatch(item.role, search) ||
          textMatch(item.primary_site_name, search) ||
          textMatch(item.primary_site_code, search)
        )
        .slice(0, limit);
    }

    function getFilteredSites() {
      const search = els.search?.value?.trim?.() || '';
      const siteId = els.siteId?.value?.trim?.() || '';
      const activeOnly = !!els.activeOnly?.checked;
      const limit = Math.max(1, Math.min(1000, Number(els.limit?.value || 200)));

      return state.sites
        .filter((item) => !siteId || String(item.id) === siteId)
        .filter((item) => !activeOnly || !!item.is_active)
        .filter((item) =>
          !search ||
          textMatch(item.site_code, search) ||
          textMatch(item.site_name, search) ||
          textMatch(item.address, search) ||
          textMatch(item.notes, search)
        )
        .slice(0, limit);
    }

    function getFilteredAssignments() {
      const search = els.search?.value?.trim?.() || '';
      const profileId = els.profileId?.value?.trim?.() || '';
      const siteId = els.siteId?.value?.trim?.() || '';
      const activeOnly = !!els.activeOnly?.checked;
      const limit = Math.max(1, Math.min(1000, Number(els.limit?.value || 200)));

      return state.assignments
        .filter((item) => !profileId || String(item.profile_id) === profileId)
        .filter((item) => !siteId || String(item.site_id) === siteId)
        .filter((item) => !activeOnly || item.profile_is_active !== false)
        .filter((item) =>
          !search ||
          textMatch(item.user_email, search) ||
          textMatch(item.full_name, search) ||
          textMatch(item.assignment_role, search) ||
          textMatch(item.site_code, search) ||
          textMatch(item.site_name, search)
        )
        .slice(0, limit);
    }

    function renderUsers() {
      if (!els.usersTable) return;

      const rows = getFilteredUsers();
      els.usersTable.innerHTML = '';

      rows.forEach((item) => {
        const tr = document.createElement('tr');
        tr.dataset.profileId = String(item.id || '');
        tr.innerHTML = `
          <td>${escHtml(item.id || '')}</td>
          <td>${escHtml(item.email || '')}</td>
          <td>${escHtml(item.full_name || '')}</td>
          <td>${escHtml(item.role || '')}</td>
          <td>${item.is_active ? 'Yes' : 'No'}</td>
          <td>${escHtml(item.primary_site_name || item.primary_site_code || '')}</td>
        `;
        els.usersTable.appendChild(tr);
      });

      if (els.usersCount) {
        els.usersCount.textContent = String(rows.length);
      }
    }

    function renderSites() {
      if (!els.sitesTable) return;

      const rows = getFilteredSites();
      els.sitesTable.innerHTML = '';

      rows.forEach((item) => {
        const tr = document.createElement('tr');
        tr.dataset.siteId = String(item.id || '');
        tr.innerHTML = `
          <td>${escHtml(item.id || '')}</td>
          <td>${escHtml(item.site_code || '')}</td>
          <td>${escHtml(item.site_name || '')}</td>
          <td>${escHtml(item.address || '')}</td>
          <td>${item.is_active ? 'Yes' : 'No'}</td>
          <td>${escHtml(item.assignment_count ?? 0)}</td>
        `;
        els.sitesTable.appendChild(tr);
      });

      if (els.sitesCount) {
        els.sitesCount.textContent = String(rows.length);
      }
    }

    function renderAssignments() {
      if (!els.assignmentsTable) return;

      const rows = getFilteredAssignments();
      els.assignmentsTable.innerHTML = '';

      rows.forEach((item) => {
        const tr = document.createElement('tr');
        tr.dataset.assignmentId = String(item.id || '');
        tr.innerHTML = `
          <td>${escHtml(item.id || '')}</td>
          <td>${escHtml(item.site_code || '')}</td>
          <td>${escHtml(item.site_name || '')}</td>
          <td>${escHtml(item.user_email || '')}</td>
          <td>${escHtml(item.full_name || '')}</td>
          <td>${escHtml(item.assignment_role || '')}</td>
          <td>${item.is_primary ? 'Yes' : 'No'}</td>
        `;
        els.assignmentsTable.appendChild(tr);
      });

      if (els.assignmentsCount) {
        els.assignmentsCount.textContent = String(rows.length);
      }
    }

    function renderDirectory() {
      renderUsers();
      renderSites();
      renderAssignments();
      setMode(state.mode);
    }

    function loadProfileIntoForm(profileId) {
      const item = state.profilesById.get(String(profileId));
      if (!item) return;

      if (els.profileSelector) els.profileSelector.value = String(item.id || '');
      if (els.formProfileId) els.formProfileId.value = String(item.id || '');
      if (els.formProfileName) els.formProfileName.value = item.full_name || '';
      if (els.formProfileRole) els.formProfileRole.value = item.role || '';
      if (els.formProfileActive) els.formProfileActive.checked = !!item.is_active;

      onProfileLoaded(item);
    }

    function loadSiteIntoForm(siteId) {
      const item = state.sitesById.get(String(siteId));
      if (!item) return;

      if (els.siteSelector) els.siteSelector.value = String(item.id || '');
      if (els.formSiteId) els.formSiteId.value = String(item.id || '');
      if (els.formSiteCode) els.formSiteCode.value = item.site_code || '';
      if (els.formSiteName) els.formSiteName.value = item.site_name || '';
      if (els.formSiteAddress) els.formSiteAddress.value = item.address || '';
      if (els.formSiteNotes) els.formSiteNotes.value = item.notes || '';
      if (els.formSiteActive) els.formSiteActive.checked = !!item.is_active;

      onSiteLoaded(item);
    }

    function loadAssignmentIntoForm(assignmentId) {
      const item = state.assignmentsById.get(String(assignmentId));
      if (!item) return;

      if (els.assignmentSelector) els.assignmentSelector.value = String(item.id || '');
      if (els.formAssignmentId) els.formAssignmentId.value = String(item.id || '');
      if (els.formAssignmentSiteId) els.formAssignmentSiteId.value = String(item.site_id || '');
      if (els.formAssignmentProfileId) els.formAssignmentProfileId.value = String(item.profile_id || '');
      if (els.formAssignmentRole) els.formAssignmentRole.value = item.assignment_role || 'worker';
      if (els.formAssignmentPrimary) els.formAssignmentPrimary.checked = !!item.is_primary;

      if (els.assignmentSiteSelector) els.assignmentSiteSelector.value = String(item.site_id || '');
      if (els.assignmentProfileSelector) els.assignmentProfileSelector.value = String(item.profile_id || '');

      onAssignmentLoaded(item);
    }

    async function refreshSelectors() {
      if (!loadAdminSelectors || state.locked) return;

      try {
        const resp = await loadAdminSelectors({});
        const profiles = Array.isArray(resp?.profiles) ? resp.profiles : [];
        const sites = Array.isArray(resp?.sites) ? resp.sites : [];
        const assignments = Array.isArray(resp?.assignments) ? resp.assignments : [];

        state.selectorData = { profiles, sites, assignments };

        fillSelect(
          els.profileSelector,
          profiles,
          'Select profile...',
          'id',
          (item) => `${item.email || item.full_name || item.id}${item.role ? ` — ${item.role}` : ''}`
        );

        fillSelect(
          els.assignmentProfileSelector,
          profiles,
          'Select profile...',
          'id',
          (item) => `${item.email || item.full_name || item.id}${item.role ? ` — ${item.role}` : ''}`
        );

        fillSelect(
          els.siteSelector,
          sites,
          'Select site...',
          'id',
          (item) => `${item.site_code || item.site_name || item.id}${item.site_name ? ` — ${item.site_name}` : ''}`
        );

        fillSelect(
          els.assignmentSiteSelector,
          sites,
          'Select site...',
          'id',
          (item) => `${item.site_code || item.site_name || item.id}${item.site_name ? ` — ${item.site_name}` : ''}`
        );

        fillSelect(
          els.assignmentSelector,
          assignments,
          'Select assignment...',
          'id',
          (item) =>
            `${item.site_code || item.site_name || item.site_id} — ${item.user_email || item.full_name || item.profile_id}`
        );
      } catch (err) {
        console.error('Failed to load admin selectors', err);
      }
    }

    async function loadDirectory() {
      if (state.locked) {
        setSummary('Admin access is required to use this dashboard.');
        return;
      }

      const payload = {
        mode: els.modeSelect?.value || state.mode || 'all',
        search: els.search?.value?.trim?.() || '',
        site_id: els.siteId?.value?.trim?.() || '',
        profile_id: els.profileId?.value?.trim?.() || '',
        active_only: !!els.activeOnly?.checked,
        limit: Math.max(1, Math.min(1000, Number(els.limit?.value || 200)))
      };

      try {
        setSummary('Loading directory...');
        const resp = await loadAdminDirectory(payload);

        state.users = Array.isArray(resp?.users) ? resp.users : [];
        state.sites = Array.isArray(resp?.sites) ? resp.sites : [];
        state.assignments = Array.isArray(resp?.assignments) ? resp.assignments : [];

        refreshMaps();
        setMode(payload.mode);
        renderDirectory();
        setSummary(`Loaded ${state.users.length} users, ${state.sites.length} sites, and ${state.assignments.length} assignments.`);
      } catch (err) {
        console.error(err);
        setSummary('Failed to load admin directory.');
      }
    }

    function bindTableClicks() {
      els.usersTable?.addEventListener('click', (e) => {
        const tr = (e.target instanceof Element) ? e.target.closest('tr[data-profile-id]') : null;
        if (!tr) return;
        loadProfileIntoForm(tr.dataset.profileId);
      });

      els.sitesTable?.addEventListener('click', (e) => {
        const tr = (e.target instanceof Element) ? e.target.closest('tr[data-site-id]') : null;
        if (!tr) return;
        loadSiteIntoForm(tr.dataset.siteId);
      });

      els.assignmentsTable?.addEventListener('click', (e) => {
        const tr = (e.target instanceof Element) ? e.target.closest('tr[data-assignment-id]') : null;
        if (!tr) return;
        loadAssignmentIntoForm(tr.dataset.assignmentId);
      });
    }

    function bindSelectors() {
      els.profileSelector?.addEventListener('change', () => {
        if (els.profileSelector.value) {
          loadProfileIntoForm(els.profileSelector.value);
        }
      });

      els.siteSelector?.addEventListener('change', () => {
        if (els.siteSelector.value) {
          loadSiteIntoForm(els.siteSelector.value);
        }
      });

      els.assignmentSelector?.addEventListener('change', () => {
        if (els.assignmentSelector.value) {
          loadAssignmentIntoForm(els.assignmentSelector.value);
        }
      });

      els.assignmentSiteSelector?.addEventListener('change', () => {
        if (els.formAssignmentSiteId) {
          els.formAssignmentSiteId.value = els.assignmentSiteSelector.value || '';
        }
      });

      els.assignmentProfileSelector?.addEventListener('change', () => {
        if (els.formAssignmentProfileId) {
          els.formAssignmentProfileId.value = els.assignmentProfileSelector.value || '';
        }
      });
    }

    function bindToolbar() {
      els.modeButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const mode = btn.dataset.adminMode || 'all';
          setMode(mode);
          if (els.modeSelect) els.modeSelect.value = mode;
          renderDirectory();
        });
      });

      els.modeSelect?.addEventListener('change', () => {
        setMode(els.modeSelect.value || 'all');
        renderDirectory();
      });

      [els.search, els.siteId, els.profileId, els.activeOnly, els.limit].forEach((el) => {
        el?.addEventListener('input', () => renderDirectory());
        el?.addEventListener('change', () => renderDirectory());
      });

      els.loadBtn?.addEventListener('click', () => {
        loadDirectory();
      });

      els.clearBtn?.addEventListener('click', () => {
        if (els.search) els.search.value = '';
        if (els.siteId) els.siteId.value = '';
        if (els.profileId) els.profileId.value = '';
        if (els.activeOnly) els.activeOnly.checked = false;
        if (els.limit) els.limit.value = '200';
        setMode('all');
        clearDirectory();
      });
    }

    async function init() {
      bindToolbar();
      bindTableClicks();
      bindSelectors();
      setMode('all');
      applyRoleAccess();

      if (!state.locked) {
        await refreshSelectors();
      }
    }

    return {
      state,
      init,
      loadDirectory,
      clearDirectory,
      refreshSelectors,
      applyRoleAccess,
      loadProfileIntoForm,
      loadSiteIntoForm,
      loadAssignmentIntoForm
    };
  }

  window.YWIAdminUI = {
    create: createAdminUI
  };
})();

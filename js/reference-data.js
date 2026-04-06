
/* File: js/reference-data.js
   Brief description: Shared reference-data loader for populated site, supervisor, employee,
   position, and trade fields. Populates datalists/select-style inputs so forms can use admin/supervisor-managed values.
*/

'use strict';

(function () {
  function $(sel, root = document) { return root.querySelector(sel); }
  function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function ensureDataList(id) {
    let dl = document.getElementById(id);
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = id;
      document.body.appendChild(dl);
    }
    return dl;
  }

  function fillDataList(id, values) {
    const dl = ensureDataList(id);
    dl.innerHTML = '';
    [...new Set((values || []).filter(Boolean))].sort().forEach((value) => {
      const opt = document.createElement('option');
      opt.value = String(value);
      dl.appendChild(opt);
    });
  }

  function setListOnSelectors(selectors, listId) {
    selectors.forEach((sel) => {
      $$(sel).forEach((el) => el.setAttribute('list', listId));
    });
  }

  function createReferenceDataUI(config = {}) {
    const api = config.api;
    const getCurrentRole = config.getCurrentRole || (() => 'worker');
    const getAuthState = config.getAuthState || (() => window.YWI_AUTH?.getState?.() || {});
    const state = { last: null };

    async function load() {
      if (!api?.fetchReferenceData) return;
      const authState = getAuthState();
      if (!authState?.isAuthenticated || authState?.isLoggingOut) return;
      try {
        const resp = await api.fetchReferenceData({ include_people: true, include_sites: true, include_catalogs: true });
        state.last = resp || {};

        const sites = (resp.sites || []).map((s) => s.site_name ? `${s.site_code || s.site_name} — ${s.site_name}` : (s.site_code || s.site_name)).filter(Boolean);
        const supervisors = (resp.supervisors || []).map((p) => p.display_name || p.full_name || p.email).filter(Boolean);
        const admins = (resp.admins || []).map((p) => p.display_name || p.full_name || p.email).filter(Boolean);
        const employees = (resp.employees || []).map((p) => p.display_name || p.full_name || p.email).filter(Boolean);
        const positions = (resp.positions || []).map((x) => x.name || x).filter(Boolean);
        const trades = (resp.trades || []).map((x) => x.name || x).filter(Boolean);

        fillDataList('site-options', sites);
        fillDataList('supervisor-options', supervisors);
        fillDataList('employee-options', employees);
        fillDataList('admin-options', admins);
        fillDataList('position-options', positions);
        fillDataList('trade-options', trades);

        setListOnSelectors(['#tb_site','#ppe_site','#fa_site','#insp_site','#dr_site','#ad_search_site_name'], 'site-options');
        setListOnSelectors(['#tb_leader','#ppe_checker','#fa_checker','#insp_inspector','#dr_supervisor','#insp_approver_other','#job_supervisor_name','#job_signing_supervisor_name','#eq_assigned_supervisor','#am_profile_default_supervisor_name','#am_profile_override_supervisor_name'], 'supervisor-options');
        setListOnSelectors(['.insp-assigned','.tb-name','.ppe-name','.dr-name','.insp-worker-name'], 'employee-options');
        setListOnSelectors(['#job_admin_name','#am_profile_default_admin_name','#am_profile_override_admin_name'], 'admin-options');
        setListOnSelectors(['#me_current_position','#am_profile_current_position'], 'position-options');
        setListOnSelectors(['#me_trade_specialty','#am_profile_trade_specialty'], 'trade-options');
      } catch (err) {
        console.error('Reference data load failed', err);
      }
    }

    function bind() {
      document.addEventListener('ywi:auth-changed', (event) => {
        const nextState = event?.detail?.state || getAuthState();
        if (!nextState?.isAuthenticated || nextState?.isLoggingOut) return;
        load();
      });
      document.addEventListener('ywi:boot-ready', () => { load(); });
    }

    function init() { bind(); load(); }

    return { init, load, state };
  }

  window.YWIReferenceData = { create: createReferenceDataUI };
})();

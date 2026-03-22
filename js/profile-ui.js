/* File: js/profile-ui.js
   Brief description: Self profile, crew directory, and session/settings UI module.
   Lets employees view and update their own profile details, supervisors view crew records,
   and admins view the broader people directory from a non-CRUD screen.
*/

'use strict';

(function () {
  function $(sel, root = document) { return root.querySelector(sel); }
  function escHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function createProfileUI(config = {}) {
    const api = config.api;
    const getCurrentRole = config.getCurrentRole || (() => 'worker');
    const getAuthState = config.getAuthState || (() => ({}));
    const getAccessProfile = config.getAccessProfile || (() => ({ canViewCrew: false, roleLabel: 'Worker' }));

    const els = {
      meSection: $('#me'),
      crewSection: $('#crew'),
      settingsSection: $('#settings'),
      meSummary: $('#me_summary'),
      crewSummary: $('#crew_summary'),
      sessionSummary: $('#settings_session_summary'),
      sessionWhoami: $('#settings_whoami'),
      sessionRole: $('#settings_role'),
      sessionExpires: $('#settings_expires'),
      sessionLogout: $('#settings_logout'),
      sessionSettingsHint: $('#settings_future_hint'),

      meName: $('#me_full_name'),
      meEmail: $('#me_email'),
      meRole: $('#me_role'),
      mePhone: $('#me_phone'),
      meAddress1: $('#me_address1'),
      meAddress2: $('#me_address2'),
      meCity: $('#me_city'),
      meProvince: $('#me_province'),
      mePostal: $('#me_postal_code'),
      meVehicle: $('#me_vehicle_make_model'),
      mePlate: $('#me_vehicle_plate'),
      mePosition: $('#me_current_position'),
      meTrade: $('#me_trade_specialty'),
      mePrefs: $('#me_feature_preferences'),
      meEmergencyName: $('#me_emergency_contact_name'),
      meEmergencyPhone: $('#me_emergency_contact_phone'),
      meSave: $('#me_save'),
      meReload: $('#me_reload'),

      crewSearch: $('#crew_search'),
      crewRoleFilter: $('#crew_role_filter'),
      crewLoad: $('#crew_load'),
      crewTableBody: $('#crew_table tbody')
    };

    const state = { selfProfile: null, crewRows: [] };

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

    function renderSession() {
      const authState = getAuthState() || {};
      const profile = authState.profile || {};
      const access = getAccessProfile(getCurrentRole());
      if (els.sessionWhoami) els.sessionWhoami.value = profile.full_name || profile.email || authState.user?.email || '';
      if (els.sessionRole) els.sessionRole.value = access.roleLabel || authState.role || 'Worker';
      if (els.sessionExpires) {
        const expiresAt = authState.session?.expires_at ? new Date(authState.session.expires_at * 1000).toLocaleString() : '';
        els.sessionExpires.value = expiresAt;
      }
    }

    function renderSelf(profile) {
      state.selfProfile = profile || null;
      if (!profile) return;
      if (els.meName) els.meName.value = profile.full_name || '';
      if (els.meEmail) els.meEmail.value = profile.email || '';
      if (els.meRole) els.meRole.value = profile.role || '';
      if (els.mePhone) els.mePhone.value = profile.phone || '';
      if (els.meAddress1) els.meAddress1.value = profile.address_line1 || '';
      if (els.meAddress2) els.meAddress2.value = profile.address_line2 || '';
      if (els.meCity) els.meCity.value = profile.city || '';
      if (els.meProvince) els.meProvince.value = profile.province || '';
      if (els.mePostal) els.mePostal.value = profile.postal_code || '';
      if (els.meVehicle) els.meVehicle.value = profile.vehicle_make_model || '';
      if (els.mePlate) els.mePlate.value = profile.vehicle_plate || '';
      if (els.mePosition) els.mePosition.value = profile.current_position || '';
      if (els.meTrade) els.meTrade.value = profile.trade_specialty || '';
      if (els.mePrefs) els.mePrefs.value = profile.feature_preferences || '';
      if (els.meEmergencyName) els.meEmergencyName.value = profile.emergency_contact_name || '';
      if (els.meEmergencyPhone) els.meEmergencyPhone.value = profile.emergency_contact_phone || '';
    }

    function renderCrew(rows) {
      state.crewRows = Array.isArray(rows) ? rows : [];
      if (!els.crewTableBody) return;
      els.crewTableBody.innerHTML = '';
      state.crewRows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escHtml(row.full_name || '')}</td>
          <td>${escHtml(row.email || '')}</td>
          <td>${escHtml(row.role || '')}</td>
          <td>${escHtml(row.current_position || '')}</td>
          <td>${escHtml(row.trade_specialty || '')}</td>
          <td>${escHtml(row.phone || '')}</td>
          <td>${row.is_active ? 'Yes' : 'No'}</td>
        `;
        els.crewTableBody.appendChild(tr);
      });
    }

    async function loadSelfProfile() {
      try {
        setNotice(els.meSummary, 'Loading your profile...');
        const resp = await api.fetchProfileScope('self');
        const profile = resp?.profile || resp?.profiles?.[0] || null;
        renderSelf(profile);
        setNotice(els.meSummary, profile ? '' : 'No profile record was returned.');
      } catch (err) {
        console.error(err);
        setNotice(els.meSummary, 'Failed to load your profile.');
      }
    }

    async function saveSelfProfile() {
      try {
        setNotice(els.meSummary, 'Saving your profile...');
        const resp = await api.saveMyProfile({
          full_name: els.meName?.value?.trim?.() || null,
          phone: els.mePhone?.value?.trim?.() || null,
          address_line1: els.meAddress1?.value?.trim?.() || null,
          address_line2: els.meAddress2?.value?.trim?.() || null,
          city: els.meCity?.value?.trim?.() || null,
          province: els.meProvince?.value?.trim?.() || null,
          postal_code: els.mePostal?.value?.trim?.() || null,
          vehicle_make_model: els.meVehicle?.value?.trim?.() || null,
          vehicle_plate: els.mePlate?.value?.trim?.() || null,
          current_position: els.mePosition?.value?.trim?.() || null,
          trade_specialty: els.meTrade?.value?.trim?.() || null,
          feature_preferences: els.mePrefs?.value?.trim?.() || null,
          emergency_contact_name: els.meEmergencyName?.value?.trim?.() || null,
          emergency_contact_phone: els.meEmergencyPhone?.value?.trim?.() || null
        });
        if (!resp?.ok) throw new Error(resp?.error || 'Profile save failed');
        setNotice(els.meSummary, 'Your profile was saved.');
        await loadSelfProfile();
      } catch (err) {
        console.error(err);
        setNotice(els.meSummary, err?.message || 'Failed to save your profile.');
      }
    }

    async function loadCrew() {
      const access = getAccessProfile(getCurrentRole());
      if (!access.canViewCrew) {
        renderCrew([]);
        return;
      }
      try {
        setNotice(els.crewSummary, 'Loading crew view...');
        const resp = await api.fetchProfileScope('crew', {
          search: els.crewSearch?.value?.trim?.() || '',
          role_filter: els.crewRoleFilter?.value || ''
        });
        renderCrew(resp?.profiles || []);
        setNotice(els.crewSummary, `Loaded ${resp?.profiles?.length || 0} people.`);
      } catch (err) {
        console.error(err);
        setNotice(els.crewSummary, 'Failed to load crew records.');
      }
    }

    async function clearCurrentSession() {
      if (!window.confirm('Log out of this current session?')) return;
      try {
        await window.YWI_AUTH.logout();
      } catch (err) {
        console.error(err);
        setNotice(els.sessionSummary, 'Failed to clear the current session.');
      }
    }

    function applyRoleVisibility() {
      const access = getAccessProfile(getCurrentRole());
      if (els.crewSection) els.crewSection.style.display = access.canViewCrew ? '' : 'none';
      renderSession();
    }

    function bind() {
      els.meReload?.addEventListener('click', loadSelfProfile);
      els.meSave?.addEventListener('click', saveSelfProfile);
      els.crewLoad?.addEventListener('click', loadCrew);
      els.sessionLogout?.addEventListener('click', clearCurrentSession);
      document.addEventListener('ywi:auth-changed', () => {
        applyRoleVisibility();
        loadSelfProfile();
        if (getAccessProfile(getCurrentRole()).canViewCrew) loadCrew();
      });
    }

    async function init() {
      bind();
      applyRoleVisibility();
      await loadSelfProfile();
      if (getAccessProfile(getCurrentRole()).canViewCrew) await loadCrew();
    }

    return { init, loadSelfProfile, loadCrew, applyRoleVisibility };
  }

  window.YWIProfileUI = { create: createProfileUI };
})();

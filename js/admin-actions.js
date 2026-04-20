/* File: js/admin-actions.js
   Brief description: Shared admin CRUD action module.
   Moves profile, site, and assignment create/update/delete logic out of app.js
   and adds support for richer employee/supervisor/admin profile fields.
*/

'use strict';

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);

  function createAdminActions(config = {}) {
    const api = config.api;
    const getAccessProfile = config.getAccessProfile || (() => ({ canManageAdminDirectory: false }));
    const getCurrentRole = config.getCurrentRole || (() => 'worker');
    const onAfterSave = config.onAfterSave || (async () => {});
    const setSummary = config.setSummary || (() => {});

    const els = {
      profileId: $('#am_profile_id'),
      profileName: $('#am_profile_name'),
      profileRole: $('#am_profile_role'),
      profileActive: $('#am_profile_active'),
      profilePhone: $('#am_profile_phone'),
      profilePhoneVerified: $('#am_profile_phone_verified'),
      profileAddress1: $('#am_profile_address1'),
      profileAddress2: $('#am_profile_address2'),
      profileCity: $('#am_profile_city'),
      profileProvince: $('#am_profile_province'),
      profilePostalCode: $('#am_profile_postal_code'),
      profileEmergencyName: $('#am_profile_emergency_name'),
      profileEmergencyPhone: $('#am_profile_emergency_phone'),
      profileVehicle: $('#am_profile_vehicle'),
      profileVehiclePlate: $('#am_profile_vehicle_plate'),
      profileYearsEmployed: $('#am_profile_years_employed'),
      profileStartDate: $('#am_profile_start_date'),
      profileEmployeeNumber: $('#am_profile_employee_number'),
      profileCurrentPosition: $('#am_profile_current_position'),
      profilePreviousEmployee: $('#am_profile_previous_employee'),
      profileTrade: $('#am_profile_trade_specialty'),
      profileStrengths: $('#am_profile_strengths'),
      profileCerts: $('#am_profile_certifications'),
      profileDefaultSupervisorName: $('#am_profile_default_supervisor_name'),
      profileOverrideSupervisorName: $('#am_profile_override_supervisor_name'),
      profileDefaultAdminName: $('#am_profile_default_admin_name'),
      profileOverrideAdminName: $('#am_profile_override_admin_name'),
      profilePrefs: $('#am_profile_feature_preferences'),
      profileNotes: $('#am_profile_notes'),
      profileSave: $('#am_profile_save'),

      siteId: $('#am_site_id'),
      siteCode: $('#am_site_code'),
      siteName: $('#am_site_name'),
      siteAddress: $('#am_site_address'),
      siteRegion: $('#am_site_region'),
      siteClientName: $('#am_site_client_name'),
      siteProjectCode: $('#am_site_project_code'),
      siteProjectStatus: $('#am_site_project_status'),
      siteSupervisorName: $('#am_site_supervisor_name'),
      siteSigningSupervisorName: $('#am_site_signing_supervisor_name'),
      siteAdminName: $('#am_site_admin_name'),
      siteNotes: $('#am_site_notes'),
      siteActive: $('#am_site_active'),
      siteCreate: $('#am_site_create'),
      siteUpdate: $('#am_site_update'),

      assignmentId: $('#am_assignment_id'),
      assignmentSiteId: $('#am_assignment_site_id'),
      assignmentProfileId: $('#am_assignment_profile_id'),
      assignmentRole: $('#am_assignment_role'),
      assignmentPrimary: $('#am_assignment_primary'),
      assignmentReportsToSupervisor: $('#am_assignment_reports_to_supervisor'),
      assignmentReportsToAdmin: $('#am_assignment_reports_to_admin'),
      assignmentCreate: $('#am_assignment_create'),
      assignmentUpdate: $('#am_assignment_update'),
      assignmentDelete: $('#am_assignment_delete')
    };

    function ensureAdminManageAllowed() {
      if (!getAccessProfile(getCurrentRole()).canManageAdminDirectory) {
        alert('Admin role is required for this action.');
        return false;
      }
      return true;
    }

    function numOrNull(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }

    function buildProfilePayload() {
      const profileId = els.profileId?.value?.trim?.() || '';
      if (!profileId) throw new Error('Profile ID is required.');

      return {
        entity: 'profile',
        action: 'update',
        profile_id: profileId,
        full_name: els.profileName?.value?.trim?.() || null,
        role: els.profileRole?.value || undefined,
        is_active: !!els.profileActive?.checked,
        phone: els.profilePhone?.value?.trim?.() || null,
        phone_verified: !!els.profilePhoneVerified?.checked,
        address_line1: els.profileAddress1?.value?.trim?.() || null,
        address_line2: els.profileAddress2?.value?.trim?.() || null,
        city: els.profileCity?.value?.trim?.() || null,
        province: els.profileProvince?.value?.trim?.() || null,
        postal_code: els.profilePostalCode?.value?.trim?.() || null,
        emergency_contact_name: els.profileEmergencyName?.value?.trim?.() || null,
        emergency_contact_phone: els.profileEmergencyPhone?.value?.trim?.() || null,
        vehicle_make_model: els.profileVehicle?.value?.trim?.() || null,
        vehicle_plate: els.profileVehiclePlate?.value?.trim?.() || null,
        years_employed: numOrNull(els.profileYearsEmployed?.value),
        start_date: els.profileStartDate?.value || null,
        employee_number: els.profileEmployeeNumber?.value?.trim?.() || null,
        current_position: els.profileCurrentPosition?.value?.trim?.() || null,
        previous_employee: !!els.profilePreviousEmployee?.checked,
        trade_specialty: els.profileTrade?.value?.trim?.() || null,
        strengths: els.profileStrengths?.value?.trim?.() || null,
        certifications: els.profileCerts?.value?.trim?.() || null,
        default_supervisor_name: els.profileDefaultSupervisorName?.value?.trim?.() || null,
        override_supervisor_name: els.profileOverrideSupervisorName?.value?.trim?.() || null,
        default_admin_name: els.profileDefaultAdminName?.value?.trim?.() || null,
        override_admin_name: els.profileOverrideAdminName?.value?.trim?.() || null,
        feature_preferences: els.profilePrefs?.value?.trim?.() || null,
        notes: els.profileNotes?.value?.trim?.() || null
      };
    }

    async function saveProfile() {
      if (!ensureAdminManageAllowed()) return;
      try {
        const payload = buildProfilePayload();
        const resp = await api.manageAdminEntity(payload);
        if (!resp?.ok) throw new Error(resp?.error || 'Profile save failed');
        setSummary(`Profile updated: ${resp?.record?.email || payload.profile_id}`);
        await onAfterSave();
      } catch (err) {
        console.error(err);
        alert(err?.message || 'Failed to save profile.');
      }
    }

    async function createSite() {
      if (!ensureAdminManageAllowed()) return;
      const siteCode = els.siteCode?.value?.trim?.() || '';
      const siteName = els.siteName?.value?.trim?.() || '';
      if (!siteCode || !siteName) {
        alert('Site code and site name are required.');
        return;
      }
      try {
        const resp = await api.manageAdminEntity({
          entity: 'site',
          action: 'create',
          site_code: siteCode,
          site_name: siteName,
          address: els.siteAddress?.value?.trim?.() || null,
          region: els.siteRegion?.value?.trim?.() || null,
          client_name: els.siteClientName?.value?.trim?.() || null,
          project_code: els.siteProjectCode?.value?.trim?.() || null,
          project_status: els.siteProjectStatus?.value?.trim?.() || null,
          site_supervisor_name: els.siteSupervisorName?.value?.trim?.() || null,
          signing_supervisor_name: els.siteSigningSupervisorName?.value?.trim?.() || null,
          admin_name: els.siteAdminName?.value?.trim?.() || null,
          notes: els.siteNotes?.value?.trim?.() || null,
          is_active: !!els.siteActive?.checked
        });
        if (!resp?.ok) throw new Error(resp?.error || 'Site create failed');
        if (els.siteId) els.siteId.value = resp?.record?.id || '';
        setSummary(`Site created: ${resp?.record?.site_code || siteCode}`);
        await onAfterSave();
      } catch (err) {
        console.error(err);
        alert(err?.message || 'Failed to create site.');
      }
    }

    async function updateSite() {
      if (!ensureAdminManageAllowed()) return;
      const siteId = els.siteId?.value?.trim?.() || '';
      if (!siteId) {
        alert('Site ID is required for update.');
        return;
      }
      try {
        const resp = await api.manageAdminEntity({
          entity: 'site',
          action: 'update',
          site_id: siteId,
          site_code: els.siteCode?.value?.trim?.() || undefined,
          site_name: els.siteName?.value?.trim?.() || undefined,
          address: els.siteAddress?.value?.trim?.() || null,
          region: els.siteRegion?.value?.trim?.() || null,
          client_name: els.siteClientName?.value?.trim?.() || null,
          project_code: els.siteProjectCode?.value?.trim?.() || null,
          project_status: els.siteProjectStatus?.value?.trim?.() || null,
          site_supervisor_name: els.siteSupervisorName?.value?.trim?.() || null,
          signing_supervisor_name: els.siteSigningSupervisorName?.value?.trim?.() || null,
          admin_name: els.siteAdminName?.value?.trim?.() || null,
          notes: els.siteNotes?.value?.trim?.() || null,
          is_active: !!els.siteActive?.checked
        });
        if (!resp?.ok) throw new Error(resp?.error || 'Site update failed');
        setSummary(`Site updated: ${resp?.record?.site_code || siteId}`);
        await onAfterSave();
      } catch (err) {
        console.error(err);
        alert(err?.message || 'Failed to update site.');
      }
    }

    async function createAssignment() {
      if (!ensureAdminManageAllowed()) return;
      const siteId = els.assignmentSiteId?.value?.trim?.() || '';
      const profileId = els.assignmentProfileId?.value?.trim?.() || '';
      if (!siteId || !profileId) {
        alert('Site ID and Profile ID are required.');
        return;
      }
      try {
        const resp = await api.manageAdminEntity({
          entity: 'assignment',
          action: 'create',
          site_id: siteId,
          profile_id: profileId,
          assignment_role: els.assignmentRole?.value || 'worker',
          is_primary: !!els.assignmentPrimary?.checked,
          reports_to_supervisor_name: els.assignmentReportsToSupervisor?.value?.trim?.() || null,
          reports_to_admin_name: els.assignmentReportsToAdmin?.value?.trim?.() || null
        });
        if (!resp?.ok) throw new Error(resp?.error || 'Assignment create failed');
        if (els.assignmentId) els.assignmentId.value = resp?.record?.id || '';
        setSummary(`Assignment created: ${resp?.record?.id || ''}`);
        await onAfterSave();
      } catch (err) {
        console.error(err);
        alert(err?.message || 'Failed to create assignment.');
      }
    }

    async function updateAssignment() {
      if (!ensureAdminManageAllowed()) return;
      const assignmentId = els.assignmentId?.value?.trim?.() || '';
      if (!assignmentId) {
        alert('Assignment ID is required for update.');
        return;
      }
      try {
        const resp = await api.manageAdminEntity({
          entity: 'assignment',
          action: 'update',
          assignment_id: assignmentId,
          assignment_role: els.assignmentRole?.value || 'worker',
          is_primary: !!els.assignmentPrimary?.checked,
          reports_to_supervisor_name: els.assignmentReportsToSupervisor?.value?.trim?.() || null,
          reports_to_admin_name: els.assignmentReportsToAdmin?.value?.trim?.() || null
        });
        if (!resp?.ok) throw new Error(resp?.error || 'Assignment update failed');
        setSummary(`Assignment updated: ${assignmentId}`);
        await onAfterSave();
      } catch (err) {
        console.error(err);
        alert(err?.message || 'Failed to update assignment.');
      }
    }

    async function deleteAssignment() {
      if (!ensureAdminManageAllowed()) return;
      const assignmentId = els.assignmentId?.value?.trim?.() || '';
      if (!assignmentId) {
        alert('Assignment ID is required for delete.');
        return;
      }
      if (!window.confirm(`Delete assignment ${assignmentId}?`)) return;
      try {
        const resp = await api.manageAdminEntity({
          entity: 'assignment',
          action: 'delete',
          assignment_id: assignmentId
        });
        if (!resp?.ok) throw new Error(resp?.error || 'Assignment delete failed');
        if (els.assignmentId) els.assignmentId.value = '';
        setSummary(`Assignment deleted: ${assignmentId}`);
        await onAfterSave();
      } catch (err) {
        console.error(err);
        alert(err?.message || 'Failed to delete assignment.');
      }
    }

    function bind() {
      if (els.profileSave && els.profileSave.dataset.boundClick !== '1') {
        els.profileSave.dataset.boundClick = '1';
        els.profileSave.addEventListener('click', saveProfile);
      }
      if (els.siteCreate && els.siteCreate.dataset.boundClick !== '1') {
        els.siteCreate.dataset.boundClick = '1';
        els.siteCreate.addEventListener('click', createSite);
      }
      if (els.siteUpdate && els.siteUpdate.dataset.boundClick !== '1') {
        els.siteUpdate.dataset.boundClick = '1';
        els.siteUpdate.addEventListener('click', updateSite);
      }
      if (els.assignmentCreate && els.assignmentCreate.dataset.boundClick !== '1') {
        els.assignmentCreate.dataset.boundClick = '1';
        els.assignmentCreate.addEventListener('click', createAssignment);
      }
      if (els.assignmentUpdate && els.assignmentUpdate.dataset.boundClick !== '1') {
        els.assignmentUpdate.dataset.boundClick = '1';
        els.assignmentUpdate.addEventListener('click', updateAssignment);
      }
      if (els.assignmentDelete && els.assignmentDelete.dataset.boundClick !== '1') {
        els.assignmentDelete.dataset.boundClick = '1';
        els.assignmentDelete.addEventListener('click', deleteAssignment);
      }
    }

    return { bind, saveProfile, createSite, updateSite, createAssignment, updateAssignment, deleteAssignment };
  }

  window.YWIAdminActions = { create: createAdminActions };
})();

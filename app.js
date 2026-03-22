/* File: app.js
   Brief description: Shared application shell refactored to use js/api.js and js/security.js.
   Initializes auth-aware modules, shared outbox/admin behavior, tiered UI security,
   and app-wide state while keeping API and account security logic in dedicated modules.
*/

'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const whoami = $('#whoami');
const reviewPanel = $('#reviewPanel');

const amProfileId = $('#am_profile_id');
const amProfileName = $('#am_profile_name');
const amProfileRole = $('#am_profile_role');
const amProfileActive = $('#am_profile_active');
const amProfileSave = $('#am_profile_save');

const amSiteId = $('#am_site_id');
const amSiteCode = $('#am_site_code');
const amSiteName = $('#am_site_name');
const amSiteAddress = $('#am_site_address');
const amSiteNotes = $('#am_site_notes');
const amSiteActive = $('#am_site_active');
const amSiteCreate = $('#am_site_create');
const amSiteUpdate = $('#am_site_update');

const amAssignmentId = $('#am_assignment_id');
const amAssignmentSiteId = $('#am_assignment_site_id');
const amAssignmentProfileId = $('#am_assignment_profile_id');
const amAssignmentRole = $('#am_assignment_role');
const amAssignmentPrimary = $('#am_assignment_primary');
const amAssignmentCreate = $('#am_assignment_create');
const amAssignmentUpdate = $('#am_assignment_update');
const amAssignmentDelete = $('#am_assignment_delete');

const amSummary = $('#am_summary');
const OUTBOX_KEY = 'ywi_outbox_v1';

const appState = {
  currentUser: null,
  currentRole: 'worker',
  currentProfileActive: false,
  isAuthenticated: false,
  adminLocked: true,
  domReady: false,
  initialized: false
};

const modules = {
  adminUI: null,
  logbookUI: null,
  toolboxFormUI: null,
  ppeFormUI: null,
  firstAidFormUI: null,
  inspectionFormUI: null,
  drillFormUI: null
};

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function getOutbox() {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
  } catch {
    return [];
  }
}

function setOutbox(list) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(list));
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

function setManageSummary(text) {
  setNotice(amSummary, text);
}

function auth() {
  return window.YWI_AUTH || null;
}

function router() {
  return window.YWIRouter || null;
}

function api() {
  return window.YWIAPI || null;
}

function security() {
  return window.YWISecurity || null;
}

function getAccessProfile(role = appState.currentRole) {
  return security()?.getAccessProfile?.(role) || {
    role,
    roleLabel: role,
    canReviewSubmissions: false,
    canViewAdminDirectory: false,
    canManageAdminDirectory: false
  };
}

function applyRoleVisibility() {
  const role = appState.currentRole || 'worker';
  const access = getAccessProfile(role);

  document.body.dataset.userRole = role;

  if (reviewPanel) {
    reviewPanel.style.display = access.canReviewSubmissions ? '' : 'none';
  }

  if (modules.adminUI?.applyRoleAccess) {
    modules.adminUI.applyRoleAccess();
    appState.adminLocked = !!modules.adminUI.state?.locked;
  } else {
    appState.adminLocked = !access.canViewAdminDirectory;
  }

  if (modules.logbookUI?.applyRoleVisibility) {
    modules.logbookUI.applyRoleVisibility();
  }
}

function syncAuthStateFromBoot(detail = {}) {
  const state = detail.state || auth()?.getState?.() || null;
  const profile = state?.profile || null;
  const user = state?.user || null;
  const role = state?.role || profile?.role || 'worker';
  const access = getAccessProfile(role);

  appState.currentUser = profile || user || null;
  appState.currentRole = role;
  appState.currentProfileActive = profile?.is_active !== false && !!state?.isAuthenticated;
  appState.isAuthenticated = !!state?.isAuthenticated;

  if (whoami) {
    const email = profile?.email || user?.email || '';
    whoami.textContent = email ? `${email} (${access.roleLabel})` : access.roleLabel;
  }

  applyRoleVisibility();
}

function applyDateFallback() {
  [
    '#tb_date',
    '#ppe_date',
    '#fa_date',
    '#insp_date',
    '#dr_date',
    '#lg_from',
    '#lg_to'
  ].forEach((sel) => {
    const el = $(sel);
    if (el && !el.value) el.value = todayISO();
  });
}

async function retryOutbox() {
  if (!appState.isAuthenticated) {
    alert('Please sign in first.');
    return;
  }

  const ywiApi = api();
  if (!ywiApi) {
    alert('API module is not ready.');
    return;
  }

  const outbox = getOutbox();
  if (!outbox.length) {
    alert('Outbox is empty.');
    return;
  }

  const remaining = [];

  for (const item of outbox) {
    try {
      const resp = await ywiApi.sendToFunction(item.formType, item.payload);
      const submissionId = resp?.id;

      if (submissionId && Array.isArray(item.localImages) && item.localImages.length) {
        await ywiApi.uploadImagesForSubmission(item.localImages, submissionId);
      }
    } catch {
      remaining.push(item);
    }
  }

  setOutbox(remaining);
  alert(remaining.length ? `Retried. ${remaining.length} item(s) remain.` : 'Outbox sent successfully.');
}

function bindOutboxButtons() {
  $$('[data-role="retry-outbox"]').forEach((btn) => {
    if (btn.dataset.boundRetryOutbox === '1') return;
    btn.dataset.boundRetryOutbox = '1';
    btn.addEventListener('click', retryOutbox);
  });
}

function ensureAdminManageAllowed() {
  if (!getAccessProfile().canManageAdminDirectory) {
    alert('Admin role is required for this action.');
    return false;
  }
  return true;
}

async function refreshAdminModuleAfterSave() {
  if (modules.adminUI?.loadDirectory) {
    await modules.adminUI.loadDirectory();
  }
  if (modules.adminUI?.refreshSelectors) {
    await modules.adminUI.refreshSelectors();
  }
}

function bindAdminActions() {
  if (amProfileSave && amProfileSave.dataset.boundClick !== '1') {
    amProfileSave.dataset.boundClick = '1';
    amProfileSave.addEventListener('click', async () => {
      if (!ensureAdminManageAllowed()) return;

      const profileId = amProfileId?.value?.trim?.() || '';
      if (!profileId) {
        alert('Profile ID is required.');
        return;
      }

      try {
        const resp = await api().manageAdminEntity({
          entity: 'profile',
          action: 'update',
          profile_id: profileId,
          full_name: amProfileName?.value?.trim?.() || null,
          role: amProfileRole?.value || undefined,
          is_active: !!amProfileActive?.checked
        });

        if (!resp?.ok) throw new Error(resp?.error || 'Profile save failed');

        setManageSummary(`Profile updated: ${resp?.record?.email || profileId}`);
        await refreshAdminModuleAfterSave();
      } catch (err) {
        console.error(err);
        alert('Failed to save profile.');
      }
    });
  }

  if (amSiteCreate && amSiteCreate.dataset.boundClick !== '1') {
    amSiteCreate.dataset.boundClick = '1';
    amSiteCreate.addEventListener('click', async () => {
      if (!ensureAdminManageAllowed()) return;

      const siteCode = amSiteCode?.value?.trim?.() || '';
      const siteName = amSiteName?.value?.trim?.() || '';

      if (!siteCode || !siteName) {
        alert('Site code and site name are required.');
        return;
      }

      try {
        const resp = await api().manageAdminEntity({
          entity: 'site',
          action: 'create',
          site_code: siteCode,
          site_name: siteName,
          address: amSiteAddress?.value?.trim?.() || null,
          notes: amSiteNotes?.value?.trim?.() || null,
          is_active: !!amSiteActive?.checked
        });

        if (!resp?.ok) throw new Error(resp?.error || 'Site create failed');

        setManageSummary(`Site created: ${resp?.record?.site_code || siteCode}`);
        if (amSiteId) amSiteId.value = resp?.record?.id || '';
        await refreshAdminModuleAfterSave();
      } catch (err) {
        console.error(err);
        alert('Failed to create site.');
      }
    });
  }

  if (amSiteUpdate && amSiteUpdate.dataset.boundClick !== '1') {
    amSiteUpdate.dataset.boundClick = '1';
    amSiteUpdate.addEventListener('click', async () => {
      if (!ensureAdminManageAllowed()) return;

      const siteId = amSiteId?.value?.trim?.() || '';
      if (!siteId) {
        alert('Site ID is required for update.');
        return;
      }

      try {
        const resp = await api().manageAdminEntity({
          entity: 'site',
          action: 'update',
          site_id: siteId,
          site_code: amSiteCode?.value?.trim?.() || undefined,
          site_name: amSiteName?.value?.trim?.() || undefined,
          address: amSiteAddress?.value?.trim?.() || null,
          notes: amSiteNotes?.value?.trim?.() || null,
          is_active: !!amSiteActive?.checked
        });

        if (!resp?.ok) throw new Error(resp?.error || 'Site update failed');

        setManageSummary(`Site updated: ${resp?.record?.site_code || siteId}`);
        await refreshAdminModuleAfterSave();
      } catch (err) {
        console.error(err);
        alert('Failed to update site.');
      }
    });
  }

  if (amAssignmentCreate && amAssignmentCreate.dataset.boundClick !== '1') {
    amAssignmentCreate.dataset.boundClick = '1';
    amAssignmentCreate.addEventListener('click', async () => {
      if (!ensureAdminManageAllowed()) return;

      const siteId = amAssignmentSiteId?.value?.trim?.() || '';
      const profileId = amAssignmentProfileId?.value?.trim?.() || '';

      if (!siteId || !profileId) {
        alert('Site ID and Profile ID are required.');
        return;
      }

      try {
        const resp = await api().manageAdminEntity({
          entity: 'assignment',
          action: 'create',
          site_id: siteId,
          profile_id: profileId,
          assignment_role: amAssignmentRole?.value || 'worker',
          is_primary: !!amAssignmentPrimary?.checked
        });

        if (!resp?.ok) throw new Error(resp?.error || 'Assignment create failed');

        if (amAssignmentId) amAssignmentId.value = resp?.record?.id || '';
        setManageSummary(`Assignment created: ${resp?.record?.id || ''}`);
        await refreshAdminModuleAfterSave();
      } catch (err) {
        console.error(err);
        alert('Failed to create assignment.');
      }
    });
  }

  if (amAssignmentUpdate && amAssignmentUpdate.dataset.boundClick !== '1') {
    amAssignmentUpdate.dataset.boundClick = '1';
    amAssignmentUpdate.addEventListener('click', async () => {
      if (!ensureAdminManageAllowed()) return;

      const assignmentId = amAssignmentId?.value?.trim?.() || '';
      if (!assignmentId) {
        alert('Assignment ID is required for update.');
        return;
      }

      try {
        const resp = await api().manageAdminEntity({
          entity: 'assignment',
          action: 'update',
          assignment_id: assignmentId,
          assignment_role: amAssignmentRole?.value || 'worker',
          is_primary: !!amAssignmentPrimary?.checked
        });

        if (!resp?.ok) throw new Error(resp?.error || 'Assignment update failed');

        setManageSummary(`Assignment updated: ${assignmentId}`);
        await refreshAdminModuleAfterSave();
      } catch (err) {
        console.error(err);
        alert('Failed to update assignment.');
      }
    });
  }

  if (amAssignmentDelete && amAssignmentDelete.dataset.boundClick !== '1') {
    amAssignmentDelete.dataset.boundClick = '1';
    amAssignmentDelete.addEventListener('click', async () => {
      if (!ensureAdminManageAllowed()) return;

      const assignmentId = amAssignmentId?.value?.trim?.() || '';
      if (!assignmentId) {
        alert('Assignment ID is required for delete.');
        return;
      }

      const confirmed = window.confirm(`Delete assignment ${assignmentId}?`);
      if (!confirmed) return;

      try {
        const resp = await api().manageAdminEntity({
          entity: 'assignment',
          action: 'delete',
          assignment_id: assignmentId
        });

        if (!resp?.ok) throw new Error(resp?.error || 'Assignment delete failed');

        setManageSummary(`Assignment deleted: ${assignmentId}`);
        if (amAssignmentId) amAssignmentId.value = '';
        await refreshAdminModuleAfterSave();
      } catch (err) {
        console.error(err);
        alert('Failed to delete assignment.');
      }
    });
  }
}

function seedAllTables() {
  modules.toolboxFormUI?.seed?.();
  modules.ppeFormUI?.seed?.();
  modules.firstAidFormUI?.seed?.();
  modules.inspectionFormUI?.seed?.();
  modules.drillFormUI?.seed?.();
}

function initAdminModule() {
  if (modules.adminUI || !window.YWIAdminUI?.create || !api()) return;

  modules.adminUI = window.YWIAdminUI.create({
    loadAdminDirectory: api().loadAdminDirectory,
    loadAdminSelectors: api().loadAdminSelectors,
    manageSummary: setManageSummary,
    getCurrentRole: () => appState.currentRole,
    getAccessProfile,
    onProfileLoaded: () => {},
    onSiteLoaded: () => {},
    onAssignmentLoaded: () => {}
  });

  modules.adminUI.init().catch((err) => {
    console.error('Admin UI init failed', err);
  });
}

function initLogbookModule() {
  if (modules.logbookUI || !window.YWILogbookUI?.create || !api()) return;

  modules.logbookUI = window.YWILogbookUI.create({
    fetchLogData: api().fetchLogData,
    fetchSubmissionDetail: api().fetchSubmissionDetail,
    saveSubmissionReview: api().saveSubmissionReview,
    storagePreviewUrl: api().storagePreviewUrl,
    getCurrentRole: () => appState.currentRole,
    getAccessProfile
  });

  modules.logbookUI.init().catch((err) => {
    console.error('Logbook UI init failed', err);
  });
}

function initFormModules() {
  if (!api()) return;

  if (!modules.toolboxFormUI && window.YWIFormsToolbox?.create) {
    modules.toolboxFormUI = window.YWIFormsToolbox.create({
      sendToFunction: api().sendToFunction,
      uploadImagesForSubmission: api().uploadImagesForSubmission,
      getOutbox,
      setOutbox
    });

    modules.toolboxFormUI.init().catch((err) => {
      console.error('Toolbox form init failed', err);
    });
  }

  if (!modules.ppeFormUI && window.YWIFormsPPE?.create) {
    modules.ppeFormUI = window.YWIFormsPPE.create({
      sendToFunction: api().sendToFunction,
      getOutbox,
      setOutbox
    });

    modules.ppeFormUI.init().catch((err) => {
      console.error('PPE form init failed', err);
    });
  }

  if (!modules.firstAidFormUI && window.YWIFormsFirstAid?.create) {
    modules.firstAidFormUI = window.YWIFormsFirstAid.create({
      sendToFunction: api().sendToFunction,
      getOutbox,
      setOutbox
    });

    modules.firstAidFormUI.init().catch((err) => {
      console.error('First Aid form init failed', err);
    });
  }

  if (!modules.inspectionFormUI && window.YWIFormsInspection?.create) {
    modules.inspectionFormUI = window.YWIFormsInspection.create({
      sendToFunction: api().sendToFunction,
      uploadImagesForSubmission: api().uploadImagesForSubmission,
      getOutbox,
      setOutbox
    });

    modules.inspectionFormUI.init().catch((err) => {
      console.error('Inspection form init failed', err);
    });
  }

  if (!modules.drillFormUI && window.YWIFormsDrill?.create) {
    modules.drillFormUI = window.YWIFormsDrill.create({
      sendToFunction: api().sendToFunction,
      uploadImagesForSubmission: api().uploadImagesForSubmission,
      getOutbox,
      setOutbox
    });

    modules.drillFormUI.init().catch((err) => {
      console.error('Drill form init failed', err);
    });
  }
}

async function initializeAppShell() {
  applyDateFallback();
  bindOutboxButtons();
  bindAdminActions();
  setManageSummary('');

  initFormModules();
  initAdminModule();
  initLogbookModule();

  seedAllTables();

  const currentAuthState = auth()?.getState?.();
  if (currentAuthState) {
    syncAuthStateFromBoot({ state: currentAuthState });
  } else {
    applyRoleVisibility();
  }

  appState.initialized = true;

  if (location.hash === '#admin' && appState.isAuthenticated && modules.adminUI?.loadDirectory) {
    try {
      await modules.adminUI.loadDirectory();
    } catch (err) {
      console.error('Admin auto-load failed', err);
    }
  }
}

document.addEventListener('ywi:boot-ready', async (e) => {
  syncAuthStateFromBoot({ state: auth()?.getState?.() || null, ...e.detail });

  if (appState.domReady && !appState.initialized) {
    await initializeAppShell();
  }
});

document.addEventListener('ywi:auth-changed', async (e) => {
  syncAuthStateFromBoot(e.detail || {});

  if (modules.adminUI?.refreshSelectors) {
    await modules.adminUI.refreshSelectors();
  }

  if (location.hash === '#admin' && appState.isAuthenticated && modules.adminUI?.loadDirectory) {
    try {
      await modules.adminUI.loadDirectory();
    } catch (err) {
      console.error('Admin auth refresh failed', err);
    }
  } else if (!appState.isAuthenticated) {
    if (modules.adminUI?.clearDirectory) modules.adminUI.clearDirectory();
    if (modules.logbookUI?.clearSubmissionDetail) modules.logbookUI.clearSubmissionDetail();
    if (modules.logbookUI?.clearReviewPanel) modules.logbookUI.clearReviewPanel();
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  appState.domReady = true;
  applyDateFallback();

  if (!appState.initialized) {
    await initializeAppShell();
  }
});

window.addEventListener('hashchange', () => {
  setTimeout(seedAllTables, 0);

  if (location.hash === '#admin' && appState.isAuthenticated && modules.adminUI?.loadDirectory) {
    modules.adminUI.loadDirectory().catch((err) => console.error('Admin hash load failed', err));
  }
});

window.addEventListener('load', () => {
  router()?.init?.();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    setTimeout(seedAllTables, 0);
  }
});

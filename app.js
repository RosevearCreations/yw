/* File: app.js
   Brief description: Shared application shell for YWI HSE.
   Initializes auth-aware modules, shared security and routing behavior, outbox retry,
   admin CRUD bindings, and app-wide visibility/guard logic.
*/

'use strict';

const $ = (sel, root = document) => root.querySelector(sel);

const whoami = $('#whoami');
const reviewPanel = $('#reviewPanel');
const amSummary = $('#am_summary');

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
  drillFormUI: null,
  adminActions: null,
  profileUI: null,
  referenceDataUI: null,
  jobsUI: null
};

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
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

function auth() { return window.YWI_AUTH || null; }
function router() { return window.YWIRouter || null; }
function api() { return window.YWIAPI || null; }
function security() { return window.YWISecurity || null; }
function outbox() { return window.YWIOutbox || null; }
function referenceData() { return window.YWIReferenceData || null; }
function jobsUIFactory() { return window.YWIJobsUI || null; }

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

  if (reviewPanel) reviewPanel.style.display = access.canReviewSubmissions ? '' : 'none';

  if (modules.adminUI?.applyRoleAccess) {
    modules.adminUI.applyRoleAccess();
    appState.adminLocked = !!modules.adminUI.state?.locked;
  } else {
    appState.adminLocked = !access.canViewAdminDirectory;
  }

  if (modules.logbookUI?.applyRoleVisibility) {
    modules.logbookUI.applyRoleVisibility();
  }

  if (modules.profileUI?.applyRoleVisibility) {
    modules.profileUI.applyRoleVisibility();
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
    const fullName = profile?.full_name || user?.user_metadata?.full_name || '';
    const email = profile?.email || user?.email || '';
    whoami.textContent = fullName ? `${fullName} (${access.roleLabel})` : (email ? `${email} (${access.roleLabel})` : access.roleLabel);
  }

  applyRoleVisibility();
  router()?.init?.();
}

function applyDateFallback() {
  ['#tb_date','#ppe_date','#fa_date','#insp_date','#dr_date','#lg_from','#lg_to'].forEach((sel) => {
    const el = $(sel);
    if (el && !el.value) el.value = todayISO();
  });
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
  modules.adminUI.init().catch((err) => console.error('Admin UI init failed', err));
}

function initProfileModule() {
  if (modules.profileUI || !window.YWIProfileUI?.create || !api()) return;

  modules.profileUI = window.YWIProfileUI.create({
    api: api(),
    getCurrentRole: () => appState.currentRole,
    getAuthState: () => auth()?.getState?.() || {},
    getAccessProfile
  });

  modules.profileUI.init().catch((err) => {
    console.error('Profile UI init failed', err);
  });
}


function initReferenceDataModule() {
  if (modules.referenceDataUI || !window.YWIReferenceData?.create || !api()) return;
  modules.referenceDataUI = window.YWIReferenceData.create({
    api: api(),
    getCurrentRole: () => appState.currentRole
  });
  modules.referenceDataUI.init();
}


function initJobsModule() {
  if (modules.jobsUI || !jobsUIFactory()?.create || !api()) return;
  modules.jobsUI = jobsUIFactory().create({
    api: api(),
    getCurrentRole: () => appState.currentRole,
    getAccessProfile
  });
  modules.jobsUI.init().catch((err) => console.error('Jobs UI init failed', err));
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
  modules.logbookUI.init().catch((err) => console.error('Logbook UI init failed', err));
}

function initFormModules() {
  if (!api() || !outbox()) return;
  if (!modules.toolboxFormUI && window.YWIFormsToolbox?.create) {
    modules.toolboxFormUI = window.YWIFormsToolbox.create({ sendToFunction: api().sendToFunction, uploadImagesForSubmission: api().uploadImagesForSubmission, getOutbox: outbox().getItems, setOutbox: outbox().setItems });
    modules.toolboxFormUI.init().catch((err) => console.error('Toolbox form init failed', err));
  }
  if (!modules.ppeFormUI && window.YWIFormsPPE?.create) {
    modules.ppeFormUI = window.YWIFormsPPE.create({ sendToFunction: api().sendToFunction, getOutbox: outbox().getItems, setOutbox: outbox().setItems });
    modules.ppeFormUI.init().catch((err) => console.error('PPE form init failed', err));
  }
  if (!modules.firstAidFormUI && window.YWIFormsFirstAid?.create) {
    modules.firstAidFormUI = window.YWIFormsFirstAid.create({ sendToFunction: api().sendToFunction, getOutbox: outbox().getItems, setOutbox: outbox().setItems });
    modules.firstAidFormUI.init().catch((err) => console.error('First Aid form init failed', err));
  }
  if (!modules.inspectionFormUI && window.YWIFormsInspection?.create) {
    modules.inspectionFormUI = window.YWIFormsInspection.create({ sendToFunction: api().sendToFunction, uploadImagesForSubmission: api().uploadImagesForSubmission, getOutbox: outbox().getItems, setOutbox: outbox().setItems });
    modules.inspectionFormUI.init().catch((err) => console.error('Inspection form init failed', err));
  }
  if (!modules.drillFormUI && window.YWIFormsDrill?.create) {
    modules.drillFormUI = window.YWIFormsDrill.create({ sendToFunction: api().sendToFunction, uploadImagesForSubmission: api().uploadImagesForSubmission, getOutbox: outbox().getItems, setOutbox: outbox().setItems });
    modules.drillFormUI.init().catch((err) => console.error('Drill form init failed', err));
  }
}

function initAdminActions() {
  if (modules.adminActions || !window.YWIAdminActions?.create || !api()) return;
  modules.adminActions = window.YWIAdminActions.create({
    api: api(),
    getCurrentRole: () => appState.currentRole,
    getAccessProfile,
    setSummary: setManageSummary,
    onAfterSave: async () => {
      if (modules.adminUI?.loadDirectory) await modules.adminUI.loadDirectory();
      if (modules.adminUI?.refreshSelectors) await modules.adminUI.refreshSelectors();
    }
  });
  modules.adminActions.bind();
}

async function initializeAppShell() {
  applyDateFallback();
  outbox()?.bindRetryButtons?.({ isAuthenticated: () => appState.isAuthenticated, sendToFunction: api()?.sendToFunction, uploadImagesForSubmission: api()?.uploadImagesForSubmission });
  setManageSummary('');
  initFormModules();
  initAdminModule();
  initLogbookModule();
  initProfileModule();
  initReferenceDataModule();
  initJobsModule();
  initAdminActions();
  seedAllTables();
  const currentAuthState = auth()?.getState?.();
  if (currentAuthState) syncAuthStateFromBoot({ state: currentAuthState });
  else applyRoleVisibility();
  appState.initialized = true;
  if (location.hash === '#admin' && appState.isAuthenticated && modules.adminUI?.loadDirectory) {
    try { await modules.adminUI.loadDirectory(); } catch (err) { console.error('Admin auto-load failed', err); }
  }
}

document.addEventListener('ywi:boot-ready', async (e) => {
  syncAuthStateFromBoot({ state: auth()?.getState?.() || null, ...e.detail });
  if (appState.domReady && !appState.initialized) await initializeAppShell();
});

document.addEventListener('ywi:auth-changed', async (e) => {
  syncAuthStateFromBoot(e.detail || {});
  if (modules.adminUI?.refreshSelectors) await modules.adminUI.refreshSelectors();
  if (location.hash === '#admin' && appState.isAuthenticated && modules.adminUI?.loadDirectory) {
    try { await modules.adminUI.loadDirectory(); } catch (err) { console.error('Admin auth refresh failed', err); }
  } else if (!appState.isAuthenticated) {
    if (modules.adminUI?.clearDirectory) modules.adminUI.clearDirectory();
    if (modules.logbookUI?.clearSubmissionDetail) modules.logbookUI.clearSubmissionDetail();
    if (modules.logbookUI?.clearReviewPanel) modules.logbookUI.clearReviewPanel();
  }
});

document.addEventListener('ywi:route-denied', (e) => {
  const detail = e.detail || {};
  if (detail.requested === 'admin') {
    setManageSummary(`Access redirected. ${detail.role || 'Current role'} cannot open Admin.`);
  }
  if (detail.requested === 'jobs' || detail.requested === 'equipment') {
    const jobSummary = document.getElementById('job_summary');
    if (jobSummary) {
      jobSummary.style.display = 'block';
      jobSummary.textContent = `Access redirected. ${detail.role || 'Current role'} cannot open ${detail.requested}.`;
    }
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  appState.domReady = true;
  applyDateFallback();
  if (!appState.initialized) await initializeAppShell();
});

window.addEventListener('hashchange', () => {
  setTimeout(seedAllTables, 0);
  if (location.hash === '#admin' && appState.isAuthenticated && modules.adminUI?.loadDirectory) {
    modules.adminUI.loadDirectory().catch((err) => console.error('Admin hash load failed', err));
  }
});

window.addEventListener('load', () => { router()?.init?.(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(seedAllTables, 0); });

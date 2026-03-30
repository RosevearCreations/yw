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

const diagnostics = {
  items: [],
  maxItems: 12,
  bound: false
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

function ensureDiagnosticsPanel() {
  let panel = document.getElementById('diagnosticsBanner');
  if (panel) return panel;
  const offlineBanner = document.getElementById('offlineBanner');
  panel = document.createElement('section');
  panel.id = 'diagnosticsBanner';
  panel.className = 'notice';
  panel.style.display = 'none';
  panel.style.maxWidth = '1100px';
  panel.style.margin = '14px auto 0';
  panel.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div>
        <strong>Diagnostics</strong>
        <div id="diagnosticsSummary" style="margin-top:6px;">Recent startup and sync issues will appear here.</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="diagnosticsRetryBtn" class="secondary" type="button">Retry protected screens</button>
        <button id="diagnosticsExportBtn" class="secondary" type="button">Export diagnostics</button>
        <button id="diagnosticsSupportExportBtn" class="secondary" type="button">Export support bundle</button>
        <button id="diagnosticsDismissBtn" class="secondary" type="button">Dismiss</button>
      </div>
    </div>
    <ul id="diagnosticsList" style="margin:10px 0 0 18px;padding:0;"></ul>
  `;
  if (offlineBanner?.parentNode) {
    offlineBanner.parentNode.insertBefore(panel, offlineBanner.nextSibling);
  } else {
    document.body.insertBefore(panel, document.body.firstChild);
  }
  panel.querySelector('#diagnosticsDismissBtn')?.addEventListener('click', () => {
    panel.style.display = 'none';
  });
  panel.querySelector('#diagnosticsExportBtn')?.addEventListener('click', () => {
    const payload = {
      exported_at: new Date().toISOString(),
      location: window.location.href,
      user_agent: navigator.userAgent,
      diagnostics: diagnostics.items.slice()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ywi-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  });
  panel.querySelector('#diagnosticsRetryBtn')?.addEventListener('click', () => {
    panel.style.display = 'none';
    initProtectedModules();
    modules.adminUI?.loadDirectory?.();
    modules.profileUI?.load?.();
    modules.jobsUI?.load?.();
  });
  return panel;
}

function renderDiagnostics() {
  const panel = ensureDiagnosticsPanel();
  const list = panel.querySelector('#diagnosticsList');
  const summary = panel.querySelector('#diagnosticsSummary');
  if (!diagnostics.items.length) {
    panel.style.display = 'none';
    if (list) list.innerHTML = '';
    if (summary) summary.textContent = 'Recent startup and sync issues will appear here.';
    return;
  }
  panel.style.display = 'block';
  if (summary) summary.textContent = `${diagnostics.items.length} recent issue(s) captured. You can retry the protected screens after sign-in.`;
  if (list) {
    list.innerHTML = diagnostics.items.map((item) => {
      const details = Array.isArray(item.details) && item.details.length ? `<ul style="margin-top:6px;">${item.details.map((detail) => `<li>${detail}</li>`).join('')}</ul>` : '';
      return `<li><strong>${item.scope}</strong>: ${item.message}${details}</li>`;
    }).join('');
  }
}

function pushDiagnostic(scope, message, details = []) {
  const cleanScope = String(scope || 'app');
  const cleanMessage = String(message || 'Unexpected application issue.');
  diagnostics.items = diagnostics.items.filter((item) => !(item.scope === cleanScope && item.message === cleanMessage));
  diagnostics.items.unshift({ scope: cleanScope, message: cleanMessage, details: Array.isArray(details) ? details : [], at: new Date().toISOString(), elapsed_ms: startupMetrics.modules[cleanScope]?.elapsed_ms || null });
  diagnostics.items = diagnostics.items.slice(0, diagnostics.maxItems);
  renderDiagnostics();
}

function clearDiagnosticsMatching(scopePrefix) {
  if (!scopePrefix) return;
  diagnostics.items = diagnostics.items.filter((item) => !String(item.scope || '').startsWith(scopePrefix));
  renderDiagnostics();
}

function bindDiagnosticsEvents() {
  if (diagnostics.bound) return;
  diagnostics.bound = true;
  window.addEventListener('ywi:app-error', (event) => {
    pushDiagnostic(event?.detail?.scope || 'app', event?.detail?.message || 'Unexpected application issue.', event?.detail?.details || []);
  });
  window.addEventListener('ywi:api-validation', (event) => {
    pushDiagnostic('validation', event?.detail?.message || 'Validation failed.', event?.detail?.details || []);
  });
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
  if (appState.isAuthenticated) {
    clearDiagnosticsMatching('auth');
    clearDiagnosticsMatching('bootstrap');
  }
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
  if (!hasAuthenticatedSession() || modules.adminUI || !window.YWIAdminUI?.create || !api()) return;
  const startedAt = Date.now();
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
  modules.adminUI.init().then(() => { markModuleTiming('admin-ui', startedAt, 'ok'); }).catch((err) => { markModuleTiming('admin-ui', startedAt, 'error', { message: err?.message || 'Admin UI failed to initialize.' }); console.error('Admin UI init failed', err); pushDiagnostic('admin-ui', err?.message || 'Admin UI failed to initialize.'); });
}

function hasAuthenticatedSession() {
  return !!(auth()?.getState?.()?.isAuthenticated || appState.isAuthenticated);
}

function initProtectedModules() {
  if (!hasAuthenticatedSession()) return;
  initAdminModule();
  initLogbookModule();
  initProfileModule();
  initReferenceDataModule();
  initJobsModule();
  initAdminActions();
}

function initProfileModule() {
  if (!hasAuthenticatedSession() || modules.profileUI || !window.YWIProfileUI?.create || !api()) return;
  const startedAt = Date.now();

  modules.profileUI = window.YWIProfileUI.create({
    api: api(),
    getCurrentRole: () => appState.currentRole,
    getAuthState: () => auth()?.getState?.() || {},
    getAccessProfile
  });

  modules.profileUI.init().then(() => { markModuleTiming('profile-ui', startedAt, 'ok'); }).catch((err) => {
    markModuleTiming('profile-ui', startedAt, 'error', { message: err?.message || 'Profile screen failed to initialize.' });
    console.error('Profile UI init failed', err);
    pushDiagnostic('profile-ui', err?.message || 'Profile screen failed to initialize.');
  });
}


function initReferenceDataModule() {
  if (!hasAuthenticatedSession() || modules.referenceDataUI || !window.YWIReferenceData?.create || !api()) return;
  const startedAt = Date.now();
  modules.referenceDataUI = window.YWIReferenceData.create({
    api: api(),
    getCurrentRole: () => appState.currentRole
  });
  modules.referenceDataUI.init().then?.(() => { markModuleTiming('reference-data', startedAt, 'ok'); }).catch?.((err) => { markModuleTiming('reference-data', startedAt, 'error', { message: err?.message || 'Reference data failed to initialize.' }); console.error('Reference data init failed', err); pushDiagnostic('reference-data', err?.message || 'Reference data failed to initialize.'); });
}


function initJobsModule() {
  if (!hasAuthenticatedSession() || modules.jobsUI || !jobsUIFactory()?.create || !api()) return;
  const startedAt = Date.now();
  modules.jobsUI = jobsUIFactory().create({
    api: api(),
    getCurrentRole: () => appState.currentRole,
    getAccessProfile
  });
  modules.jobsUI.init().then(() => { markModuleTiming('jobs-ui', startedAt, 'ok'); }).catch((err) => { markModuleTiming('jobs-ui', startedAt, 'error', { message: err?.message || 'Jobs or Equipment screens failed to initialize.' }); console.error('Jobs UI init failed', err); pushDiagnostic('jobs-ui', err?.message || 'Jobs or Equipment screens failed to initialize.'); });
}

function initLogbookModule() {
  if (!hasAuthenticatedSession() || modules.logbookUI || !window.YWILogbookUI?.create || !api()) return;
  const startedAt = Date.now();
  modules.logbookUI = window.YWILogbookUI.create({
    fetchLogData: api().fetchLogData,
    fetchSubmissionDetail: api().fetchSubmissionDetail,
    saveSubmissionReview: api().saveSubmissionReview,
    storagePreviewUrl: api().storagePreviewUrl,
    getCurrentRole: () => appState.currentRole,
    getAccessProfile
  });
  modules.logbookUI.init().then(() => { markModuleTiming('logbook-ui', startedAt, 'ok'); }).catch((err) => { markModuleTiming('logbook-ui', startedAt, 'error', { message: err?.message || 'Logbook failed to initialize.' }); console.error('Logbook UI init failed', err); pushDiagnostic('logbook-ui', err?.message || 'Logbook failed to initialize.'); });
}

function initFormModules() {
  if (!api() || !outbox()) return;
  if (!modules.toolboxFormUI && window.YWIFormsToolbox?.create) {
    modules.toolboxFormUI = window.YWIFormsToolbox.create({ sendToFunction: api().sendToFunction, uploadImagesForSubmission: api().uploadImagesForSubmission, getOutbox: outbox().getItems, setOutbox: outbox().setItems });
    modules.toolboxFormUI.init().catch((err) => { console.error('Toolbox form init failed', err); pushDiagnostic('toolbox-form', err?.message || 'Toolbox Talk failed to initialize.'); });
  }
  if (!modules.ppeFormUI && window.YWIFormsPPE?.create) {
    modules.ppeFormUI = window.YWIFormsPPE.create({ sendToFunction: api().sendToFunction, getOutbox: outbox().getItems, setOutbox: outbox().setItems });
    modules.ppeFormUI.init().catch((err) => { console.error('PPE form init failed', err); pushDiagnostic('ppe-form', err?.message || 'PPE Check failed to initialize.'); });
  }
  if (!modules.firstAidFormUI && window.YWIFormsFirstAid?.create) {
    modules.firstAidFormUI = window.YWIFormsFirstAid.create({ sendToFunction: api().sendToFunction, getOutbox: outbox().getItems, setOutbox: outbox().setItems });
    modules.firstAidFormUI.init().catch((err) => { console.error('First Aid form init failed', err); pushDiagnostic('first-aid-form', err?.message || 'First Aid form failed to initialize.'); });
  }
  if (!modules.inspectionFormUI && window.YWIFormsInspection?.create) {
    modules.inspectionFormUI = window.YWIFormsInspection.create({ sendToFunction: api().sendToFunction, uploadImagesForSubmission: api().uploadImagesForSubmission, getOutbox: outbox().getItems, setOutbox: outbox().setItems });
    modules.inspectionFormUI.init().catch((err) => { console.error('Inspection form init failed', err); pushDiagnostic('inspection-form', err?.message || 'Site Inspection failed to initialize.'); });
  }
  if (!modules.drillFormUI && window.YWIFormsDrill?.create) {
    modules.drillFormUI = window.YWIFormsDrill.create({ sendToFunction: api().sendToFunction, uploadImagesForSubmission: api().uploadImagesForSubmission, getOutbox: outbox().getItems, setOutbox: outbox().setItems });
    modules.drillFormUI.init().catch((err) => { console.error('Drill form init failed', err); pushDiagnostic('drill-form', err?.message || 'Emergency Drill failed to initialize.'); });
  }
}

function initAdminActions() {
  if (!hasAuthenticatedSession() || modules.adminActions || !window.YWIAdminActions?.create || !api()) return;
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
  bindDiagnosticsEvents();
window.YWIAppDiagnostics = { getItems: () => diagnostics.items.slice(), clear: renderDiagnostics, exportItems: () => diagnostics.items.slice(), getSupportSnapshot: getRuntimeSupportSnapshot, getModuleTimings: () => Object.values(startupMetrics.modules) };
  ensureDiagnosticsPanel();
  applyDateFallback();
  outbox()?.bindRetryButtons?.({ isAuthenticated: () => appState.isAuthenticated, sendToFunction: api()?.sendToFunction, uploadImagesForSubmission: api()?.uploadImagesForSubmission });
  setManageSummary('');
  initFormModules();
  initProtectedModules();
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
  if (appState.isAuthenticated) initProtectedModules();
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

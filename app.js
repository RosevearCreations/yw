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
  bound: false,
  timings: {}
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
      const timingText = item.elapsed_ms ? ` <span class="muted">(${item.elapsed_ms} ms)</span>` : '';
      const details = Array.isArray(item.details) && item.details.length ? `<ul style="margin-top:6px;">${item.details.map((detail) => `<li>${detail}</li>`).join('')}</ul>` : '';
      return `<li><strong>${item.scope}</strong>: ${item.message}${timingText}${details}</li>`;
    }).join('');
  }
}

function pushDiagnostic(scope, message, details = [], meta = {}) {
  const cleanScope = String(scope || 'app');
  const cleanMessage = String(message || 'Unexpected application issue.');
  diagnostics.items = diagnostics.items.filter((item) => !(item.scope === cleanScope && item.message === cleanMessage));
  diagnostics.items.unshift({
    scope: cleanScope,
    message: cleanMessage,
    details: Array.isArray(details) ? details : [],
    at: new Date().toISOString(),
    elapsed_ms: meta?.elapsed_ms || 0
  });
  diagnostics.items = diagnostics.items.slice(0, diagnostics.maxItems);
  renderDiagnostics();
}

function markModuleTiming(scope, status, startedAt, details = []) {
  const elapsed = Math.max(0, Date.now() - Number(startedAt || Date.now()));
  diagnostics.timings[scope] = {
    status,
    elapsed_ms: elapsed,
    at: new Date().toISOString(),
    details: Array.isArray(details) ? details : []
  };
  if (status === 'error') {
    pushDiagnostic(scope, 'Module failed during startup.', details, { elapsed_ms: elapsed });
  }
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
  const adminStartedAt = Date.now();
  modules.adminUI.init()
    .then(() => markModuleTiming('admin-ui', 'ok', adminStartedAt))
    .catch((err) => {
      console.error('Admin UI init failed', err);
      markModuleTiming('admin-ui', 'error', adminStartedAt, [err?.message || 'Admin UI failed to initialize.']);
    });
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

  modules.profileUI = window.YWIProfileUI.create({
    api: api(),
    getCurrentRole: () => appState.currentRole,
    getAuthState: () => auth()?.getState?.() || {},
    getAccessProfile
  });

  const profileStartedAt = Date.now();
  modules.profileUI.init().then(() => {
    markModuleTiming('profile-ui', 'ok', profileStartedAt);
  }).catch((err) => {
    console.error('Profile UI init failed', err);
    markModuleTiming('profile-ui', 'error', profileStartedAt, [err?.message || 'Profile screen failed to initialize.']);
  });
}


function initReferenceDataModule() {
  if (!hasAuthenticatedSession() || modules.referenceDataUI || !window.YWIReferenceData?.create || !api()) return;
  modules.referenceDataUI = window.YWIReferenceData.create({
    api: api(),
    getCurrentRole: () => appState.currentRole
  });
  const referenceStartedAt = Date.now();
  modules.referenceDataUI.init().then?.(() => {
    markModuleTiming('reference-data', 'ok', referenceStartedAt);
  }).catch?.((err) => {
    console.error('Reference data init failed', err);
    markModuleTiming('reference-data', 'error', referenceStartedAt, [err?.message || 'Reference data failed to initialize.']);
  });
}


function initJobsModule() {
  if (!hasAuthenticatedSession() || modules.jobsUI || !jobsUIFactory()?.create || !api()) return;
  modules.jobsUI = jobsUIFactory().create({
    api: api(),
    getCurrentRole: () => appState.currentRole,
    getAccessProfile
  });
  const jobsStartedAt = Date.now();
  modules.jobsUI.init()
    .then(() => markModuleTiming('jobs-ui', 'ok', jobsStartedAt))
    .catch((err) => {
      console.error('Jobs UI init failed', err);
      markModuleTiming('jobs-ui', 'error', jobsStartedAt, [err?.message || 'Jobs or Equipment screens failed to initialize.']);
    });
}

function initLogbookModule() {
  if (!hasAuthenticatedSession() || modules.logbookUI || !window.YWILogbookUI?.create || !api()) return;
  modules.logbookUI = window.YWILogbookUI.create({
    fetchLogData: api().fetchLogData,
    fetchSubmissionDetail: api().fetchSubmissionDetail,
    saveSubmissionReview: api().saveSubmissionReview,
    storagePreviewUrl: api().storagePreviewUrl,
    getCurrentRole: () => appState.currentRole,
    getAccessProfile
  });
  const logbookStartedAt = Date.now();
  modules.logbookUI.init()
    .then(() => markModuleTiming('logbook-ui', 'ok', logbookStartedAt))
    .catch((err) => {
      console.error('Logbook UI init failed', err);
      markModuleTiming('logbook-ui', 'error', logbookStartedAt, [err?.message || 'Logbook failed to initialize.']);
    });
}

function initFormModules() {
  if (!api() || !outbox()) return;
  if (!modules.toolboxFormUI && window.YWIFormsToolbox?.create) {
    modules.toolboxFormUI = window.YWIFormsToolbox.create({ sendToFunction: api().sendToFunction, uploadImagesForSubmission: api().uploadImagesForSubmission, getOutbox: outbox().getItems, setOutbox: outbox().setItems });
    const toolboxStartedAt = Date.now();
    modules.toolboxFormUI.init()
      .then(() => markModuleTiming('toolbox-form', 'ok', toolboxStartedAt))
      .catch((err) => {
        console.error('Toolbox form init failed', err);
        markModuleTiming('toolbox-form', 'error', toolboxStartedAt, [err?.message || 'Toolbox Talk failed to initialize.']);
      });
  }
  if (!modules.ppeFormUI && window.YWIFormsPPE?.create) {
    modules.ppeFormUI = window.YWIFormsPPE.create({ sendToFunction: api().sendToFunction, getOutbox: outbox().getItems, setOutbox: outbox().setItems });
    const ppeStartedAt = Date.now();
    modules.ppeFormUI.init()
      .then(() => markModuleTiming('ppe-form', 'ok', ppeStartedAt))
      .catch((err) => {
        console.error('PPE form init failed', err);
        markModuleTiming('ppe-form', 'error', ppeStartedAt, [err?.message || 'PPE Check failed to initialize.']);
      });
  }
  if (!modules.firstAidFormUI && window.YWIFormsFirstAid?.create) {
    modules.firstAidFormUI = window.YWIFormsFirstAid.create({ sendToFunction: api().sendToFunction, getOutbox: outbox().getItems, setOutbox: outbox().setItems });
    const firstAidStartedAt = Date.now();
    modules.firstAidFormUI.init()
      .then(() => markModuleTiming('first-aid-form', 'ok', firstAidStartedAt))
      .catch((err) => {
        console.error('First Aid form init failed', err);
        markModuleTiming('first-aid-form', 'error', firstAidStartedAt, [err?.message || 'First Aid form failed to initialize.']);
      });
  }
  if (!modules.inspectionFormUI && window.YWIFormsInspection?.create) {
    modules.inspectionFormUI = window.YWIFormsInspection.create({ sendToFunction: api().sendToFunction, uploadImagesForSubmission: api().uploadImagesForSubmission, getOutbox: outbox().getItems, setOutbox: outbox().setItems });
    const inspectionStartedAt = Date.now();
    modules.inspectionFormUI.init()
      .then(() => markModuleTiming('inspection-form', 'ok', inspectionStartedAt))
      .catch((err) => {
        console.error('Inspection form init failed', err);
        markModuleTiming('inspection-form', 'error', inspectionStartedAt, [err?.message || 'Site Inspection failed to initialize.']);
      });
  }
  if (!modules.drillFormUI && window.YWIFormsDrill?.create) {
    modules.drillFormUI = window.YWIFormsDrill.create({ sendToFunction: api().sendToFunction, uploadImagesForSubmission: api().uploadImagesForSubmission, getOutbox: outbox().getItems, setOutbox: outbox().setItems });
    const drillStartedAt = Date.now();
    modules.drillFormUI.init()
      .then(() => markModuleTiming('drill-form', 'ok', drillStartedAt))
      .catch((err) => {
        console.error('Drill form init failed', err);
        markModuleTiming('drill-form', 'error', drillStartedAt, [err?.message || 'Emergency Drill failed to initialize.']);
      });
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
window.YWIAppDiagnostics = {
  getItems: () => diagnostics.items.slice(),
  getTimings: () => ({ ...diagnostics.timings }),
  clear: renderDiagnostics
};
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

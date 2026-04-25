/* File: app.js
   Brief description: Shared application shell for YWI HSE.
   Initializes auth-aware modules, shared security and routing behavior, outbox retry,
   admin CRUD bindings, and app-wide visibility/guard logic.
   This version skips protected module boot while account onboarding is still required.
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
  initialized: false,
  needsAccountSetup: false,
  pendingAuthResolution: false
};

const modules = {
  adminUI: null,
  logbookUI: null,
  reportsUI: null,
  toolboxFormUI: null,
  ppeFormUI: null,
  firstAidFormUI: null,
  inspectionFormUI: null,
  drillFormUI: null,
  incidentFormUI: null,
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

const moduleTimings = {
  entries: [],
  maxEntries: 80
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
    if (canInitProtectedModules()) {
      initProtectedModules();
      modules.adminUI?.loadDirectory?.();
      modules.profileUI?.load?.();
      modules.jobsUI?.load?.();
    }
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
  const timingCount = moduleTimings.entries.length;
  if (summary) summary.textContent = `${diagnostics.items.length} recent issue(s) captured. You can retry the protected screens after sign-in.${timingCount ? ` Module timings captured: ${timingCount}.` : ''}`;
  if (list) {
    list.innerHTML = diagnostics.items.map((item) => {
      const details = Array.isArray(item.details) && item.details.length
        ? `<ul style="margin-top:6px;">${item.details.map((detail) => `<li>${detail}</li>`).join('')}</ul>`
        : '';
      return `<li><strong>${item.scope}</strong>: ${item.message}${details}</li>`;
    }).join('');
  }
}

function pushDiagnostic(scope, message, details = []) {
  const cleanScope = String(scope || 'app');
  const cleanMessage = String(message || 'Unexpected application issue.');
  diagnostics.items = diagnostics.items.filter((item) => !(item.scope === cleanScope && item.message === cleanMessage));
  diagnostics.items.unshift({
    scope: cleanScope,
    message: cleanMessage,
    details: Array.isArray(details) ? details : [],
    at: new Date().toISOString()
  });
  diagnostics.items = diagnostics.items.slice(0, diagnostics.maxItems);
  renderDiagnostics();
}

function clearDiagnosticsMatching(scopePrefix) {
  if (!scopePrefix) return;
  diagnostics.items = diagnostics.items.filter((item) => !String(item.scope || '').startsWith(scopePrefix));
  renderDiagnostics();
}

function recordTiming(scope, stage, start, extra = {}) {
  const started = Number(start || performance.now());
  const finished = performance.now();
  const entry = {
    scope: String(scope || 'app'),
    stage: String(stage || 'run'),
    started_at_ms: started,
    finished_at_ms: finished,
    duration_ms: Number((finished - started).toFixed(2)),
    at: new Date().toISOString(),
    ...extra
  };
  moduleTimings.entries.unshift(entry);
  moduleTimings.entries = moduleTimings.entries.slice(0, moduleTimings.maxEntries);
  window.__YWI_MODULE_TIMINGS = moduleTimings.entries.slice();
  window.dispatchEvent(new CustomEvent('ywi:timing', { detail: entry }));
  return entry;
}

async function timedRun(scope, fn) {
  const started = performance.now();
  try {
    const result = await fn();
    recordTiming(scope, 'success', started, { ok: true });
    return result;
  } catch (err) {
    recordTiming(scope, 'failure', started, { ok: false, message: err?.message || 'Failed.' });
    throw err;
  }
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
function trafficApi() { return window.YWIAPI || null; }
function api() { return window.YWIAPI || null; }
function security() { return window.YWISecurity || null; }
function outbox() { return window.YWIOutbox || null; }
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

function canInitProtectedModules() {
  const state = auth()?.getState?.() || {};
  return !!(
    (state.isAuthenticated || appState.isAuthenticated) &&
    !state.pendingAuthResolution &&
    !state.needsAccountSetup &&
    !appState.pendingAuthResolution &&
    !appState.needsAccountSetup
  );
}

function applyRoleVisibility() {
  const role = appState.currentRole || 'worker';
  const access = getAccessProfile(role);
  document.body.dataset.userRole = role;
  document.body.dataset.needsAccountSetup = appState.needsAccountSetup ? 'true' : 'false';

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

  if (modules.reportsUI?.applyRoleVisibility) {
    modules.reportsUI.applyRoleVisibility();
  }

  if (modules.profileUI?.applyRoleVisibility) {
    modules.profileUI.applyRoleVisibility();
  }
}

function syncAuthStateFromBoot(detail = {}) {
  const state = detail.state || auth()?.getState?.() || null;
  const profile = state?.profile || null;
  const user = state?.user || null;
  const role = state?.role || profile?.role || user?.user_metadata?.role || 'employee';
  const access = getAccessProfile(role);

  appState.currentUser = state?.isAuthenticated ? (profile || user || null) : null;
  appState.currentRole = state?.isAuthenticated ? role : 'employee';
  appState.currentProfileActive = profile?.is_active !== false && !!state?.isAuthenticated;
  appState.isAuthenticated = !!state?.isAuthenticated;
  appState.needsAccountSetup = !!state?.needsAccountSetup;
  appState.pendingAuthResolution = !!state?.pendingAuthResolution;

  if (whoami) {
    const fullName = profile?.full_name || user?.user_metadata?.full_name || '';
    const email = profile?.email || user?.email || '';
    whoami.textContent = fullName
      ? `${fullName} (${access.roleLabel})`
      : (email ? `${email} (${access.roleLabel})` : access.roleLabel);
  }

  applyRoleVisibility();

  if (appState.isAuthenticated) {
    clearDiagnosticsMatching('auth');
    clearDiagnosticsMatching('bootstrap');
  } else {
    clearDiagnosticsMatching('profile-ui');
    clearDiagnosticsMatching('reference-data');
  }

  router()?.init?.();
}

function applyDateFallback() {
  ['#tb_date', '#ppe_date', '#fa_date', '#insp_date', '#dr_date', '#inc_date', '#lg_from', '#lg_to'].forEach((sel) => {
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
  if (!canInitProtectedModules() || modules.adminUI || !window.YWIAdminUI?.create || !api()) return;
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
  timedRun('admin-ui.init', () => Promise.resolve(modules.adminUI.init())).catch((err) => {
    console.error('Admin UI init failed', err);
    pushDiagnostic('admin-ui', err?.message || 'Admin UI failed to initialize.');
  });
}

function hasAuthenticatedSession() {
  const state = auth()?.getState?.() || {};
  return !!(state.isAuthenticated || appState.isAuthenticated);
}

function initProtectedModules() {
  if (!hasAuthenticatedSession()) return;
  if (!canInitProtectedModules()) return;

  initAdminModule();
  initLogbookModule();
  initReportsModule();
  initProfileModule();
  initReferenceDataModule();
  initJobsModule();
  initAdminActions();
}

function initProfileModule() {
  if (!canInitProtectedModules() || modules.profileUI || !window.YWIProfileUI?.create || !api()) return;

  modules.profileUI = window.YWIProfileUI.create({
    api: api(),
    getCurrentRole: () => appState.currentRole,
    getAuthState: () => auth()?.getState?.() || {},
    getAccessProfile
  });

  timedRun('profile-ui.init', () => Promise.resolve(modules.profileUI.init())).catch((err) => {
    console.error('Profile UI init failed', err);
    pushDiagnostic('profile-ui', err?.message || 'Profile screen failed to initialize.');
  });
}

function initReferenceDataModule() {
  if (!canInitProtectedModules() || modules.referenceDataUI || !window.YWIReferenceData?.create || !api()) return;
  modules.referenceDataUI = window.YWIReferenceData.create({
    api: api(),
    getCurrentRole: () => appState.currentRole,
    getAuthState: () => auth()?.getState?.() || {}
  });
  timedRun('reference-data.init', () => Promise.resolve(modules.referenceDataUI.init())).catch((err) => {
    console.error('Reference data init failed', err);
    pushDiagnostic('reference-data', err?.message || 'Reference data failed to initialize.');
  });
}

function initJobsModule() {
  if (!canInitProtectedModules() || modules.jobsUI || !jobsUIFactory()?.create || !api()) return;
  modules.jobsUI = jobsUIFactory().create({
    api: api(),
    getCurrentRole: () => appState.currentRole,
    getAccessProfile
  });
  timedRun('jobs-ui.init', () => Promise.resolve(modules.jobsUI.init())).catch((err) => {
    console.error('Jobs UI init failed', err);
    pushDiagnostic('jobs-ui', err?.message || 'Jobs or Equipment screens failed to initialize.');
  });
}


function initReportsModule() {
  if (!canInitProtectedModules() || modules.reportsUI || !window.YWIReportsUI?.create || !api()) return;
  modules.reportsUI = window.YWIReportsUI.create({
    loadAdminDirectory: api().loadAdminDirectory,
    manageAdminEntity: api().manageAdminEntity,
    getCurrentRole: () => appState.currentRole,
    getAccessProfile,
    getAuthState: () => auth()?.getState?.() || {}
  });
  timedRun('reports-ui.init', () => Promise.resolve(modules.reportsUI.init())).catch((err) => {
    console.error('Reports UI init failed', err);
    pushDiagnostic('reports-ui', err?.message || 'Historical reports failed to initialize.');
  });
}

function initLogbookModule() {
  if (!canInitProtectedModules() || modules.logbookUI || !window.YWILogbookUI?.create || !api()) return;
  modules.logbookUI = window.YWILogbookUI.create({
    fetchLogData: api().fetchLogData,
    fetchSubmissionDetail: api().fetchSubmissionDetail,
    saveSubmissionReview: api().saveSubmissionReview,
    storagePreviewUrl: api().storagePreviewUrl,
    getCurrentRole: () => appState.currentRole,
    getAccessProfile
  });
  timedRun('logbook-ui.init', () => Promise.resolve(modules.logbookUI.init())).catch((err) => {
    console.error('Logbook UI init failed', err);
    pushDiagnostic('logbook-ui', err?.message || 'Logbook failed to initialize.');
  });
}

function initFormModules() {
  if (!api() || !outbox()) return;

  if (!modules.toolboxFormUI && window.YWIFormsToolbox?.create) {
    modules.toolboxFormUI = window.YWIFormsToolbox.create({
      sendToFunction: api().sendToFunction,
      uploadImagesForSubmission: api().uploadImagesForSubmission,
      getOutbox: outbox().getItems,
      setOutbox: outbox().setItems
    });
    timedRun('toolbox-form.init', () => Promise.resolve(modules.toolboxFormUI.init())).catch((err) => {
      console.error('Toolbox form init failed', err);
      pushDiagnostic('toolbox-form', err?.message || 'Toolbox Talk failed to initialize.');
    });
  }

  if (!modules.ppeFormUI && window.YWIFormsPPE?.create) {
    modules.ppeFormUI = window.YWIFormsPPE.create({
      sendToFunction: api().sendToFunction,
      getOutbox: outbox().getItems,
      setOutbox: outbox().setItems
    });
    timedRun('ppe-form.init', () => Promise.resolve(modules.ppeFormUI.init())).catch((err) => {
      console.error('PPE form init failed', err);
      pushDiagnostic('ppe-form', err?.message || 'PPE Check failed to initialize.');
    });
  }

  if (!modules.firstAidFormUI && window.YWIFormsFirstAid?.create) {
    modules.firstAidFormUI = window.YWIFormsFirstAid.create({
      sendToFunction: api().sendToFunction,
      getOutbox: outbox().getItems,
      setOutbox: outbox().setItems
    });
    timedRun('first-aid-form.init', () => Promise.resolve(modules.firstAidFormUI.init())).catch((err) => {
      console.error('First Aid form init failed', err);
      pushDiagnostic('first-aid-form', err?.message || 'First Aid form failed to initialize.');
    });
  }

  if (!modules.inspectionFormUI && window.YWIFormsInspection?.create) {
    modules.inspectionFormUI = window.YWIFormsInspection.create({
      sendToFunction: api().sendToFunction,
      uploadImagesForSubmission: api().uploadImagesForSubmission,
      getOutbox: outbox().getItems,
      setOutbox: outbox().setItems
    });
    timedRun('inspection-form.init', () => Promise.resolve(modules.inspectionFormUI.init())).catch((err) => {
      console.error('Inspection form init failed', err);
      pushDiagnostic('inspection-form', err?.message || 'Site Inspection failed to initialize.');
    });
  }

  if (!modules.drillFormUI && window.YWIFormsDrill?.create) {
    modules.drillFormUI = window.YWIFormsDrill.create({
      sendToFunction: api().sendToFunction,
      uploadImagesForSubmission: api().uploadImagesForSubmission,
      getOutbox: outbox().getItems,
      setOutbox: outbox().setItems
    });
    timedRun('drill-form.init', () => Promise.resolve(modules.drillFormUI.init())).catch((err) => {
      console.error('Drill form init failed', err);
      pushDiagnostic('drill-form', err?.message || 'Emergency Drill failed to initialize.');
    });
  }


  if (!modules.incidentFormUI && window.YWIFormsIncident?.create) {
    modules.incidentFormUI = window.YWIFormsIncident.create({
      sendToFunction: api().sendToFunction,
      uploadImagesForSubmission: api().uploadImagesForSubmission,
      getOutbox: outbox().getItems,
      setOutbox: outbox().setItems
    });
    timedRun('incident-form.init', () => Promise.resolve(modules.incidentFormUI.init())).catch((err) => {
      console.error('Incident form init failed', err);
      pushDiagnostic('incident-form', err?.message || 'Incident / near miss form failed to initialize.');
    });
  }
}

function initAdminActions() {
  if (!canInitProtectedModules() || modules.adminActions || !window.YWIAdminActions?.create || !api()) return;
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
    clear: () => {
      diagnostics.items = [];
      renderDiagnostics();
    }
  };
  window.YWIModuleTimings = {
    getItems: () => moduleTimings.entries.slice(),
    clear: () => {
      moduleTimings.entries = [];
      window.__YWI_MODULE_TIMINGS = [];
    }
  };

  ensureDiagnosticsPanel();
  applyDateFallback();

  outbox()?.bindRetryButtons?.({
    isAuthenticated: () => appState.isAuthenticated,
    sendToFunction: api()?.sendToFunction,
    uploadImagesForSubmission: api()?.uploadImagesForSubmission
  });

  setManageSummary('');
  initFormModules();
  seedAllTables();

  const currentAuthState = auth()?.getState?.();
  if (currentAuthState) syncAuthStateFromBoot({ state: currentAuthState });
  else applyRoleVisibility();

  if (canInitProtectedModules()) {
    initProtectedModules();
  }

  appState.initialized = true;

  if (location.hash === '#admin' && canInitProtectedModules() && modules.adminUI?.loadDirectory) {
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
  } else if (canInitProtectedModules()) {
    initProtectedModules();
  }
});

document.addEventListener('ywi:auth-changed', async (e) => {
  syncAuthStateFromBoot(e.detail || {});

  if (canInitProtectedModules()) {
    initProtectedModules();
    if (modules.adminUI?.refreshSelectors) await modules.adminUI.refreshSelectors();
    if (location.hash === '#admin' && modules.adminUI?.loadDirectory) {
      try {
        await modules.adminUI.loadDirectory();
      } catch (err) {
        console.error('Admin auth refresh failed', err);
      }
    }
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
  if (location.hash === '#admin' && canInitProtectedModules() && modules.adminUI?.loadDirectory) {
    modules.adminUI.loadDirectory().catch((err) => console.error('Admin hash load failed', err));
  }
});

window.addEventListener('load', () => { router()?.init?.(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') setTimeout(seedAllTables, 0);
});


document.addEventListener('ywi:route-shown', (e) => {
  const detail = e.detail || {};
  trafficApi()?.trackTrafficEvent?.({
    event_name: 'route_view',
    route_name: detail.allowed || detail.requested || '',
    page_path: `${location.pathname}${location.hash || ''}`,
    page_title: document.title || '',
    details: { requested: detail.requested || null, role: detail.role || null }
  }, !!window.YWI_AUTH?.getState?.()?.isAuthenticated).catch(() => {});
});

window.addEventListener('error', (e) => {
  trafficApi()?.trackMonitorEvent?.({
    event_name: 'client_error',
    monitor_scope: 'frontend',
    severity: 'error',
    route_name: (location.hash || '#toolbox').slice(1),
    title: 'Unhandled client error',
    message: e?.message || 'Unknown client error',
    details: { source: e?.filename || null, line: e?.lineno || null, column: e?.colno || null }
  }, !!window.YWI_AUTH?.getState?.()?.isAuthenticated).catch(() => {});
});

window.addEventListener('unhandledrejection', (e) => {
  trafficApi()?.trackMonitorEvent?.({
    event_name: 'client_error',
    monitor_scope: 'frontend',
    severity: 'error',
    route_name: (location.hash || '#toolbox').slice(1),
    title: 'Unhandled promise rejection',
    message: String(e?.reason?.message || e?.reason || 'Unknown rejection')
  }, !!window.YWI_AUTH?.getState?.()?.isAuthenticated).catch(() => {});
});

window.addEventListener('load', () => {
  trafficApi()?.trackTrafficEvent?.({
    event_name: 'page_view',
    route_name: ((location.hash || '#toolbox').slice(1) || 'toolbox'),
    page_path: `${location.pathname}${location.hash || ''}`,
    page_title: document.title || ''
  }, !!window.YWI_AUTH?.getState?.()?.isAuthenticated).catch(() => {});
});

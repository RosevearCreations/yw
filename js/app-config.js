/* File: js/app-config.js
   Brief description: Primary runtime config for the YWI HSE app shell.
   Set the Supabase project URL and anon/public key here for normal sign-in.
   The login-screen runtime key entry remains available only as an emergency fallback.

   Public-web authority is intentionally centralized here because this file loads in
   the document head before the browser public-route renderer. The canonical public
   authority remains yardweasels.ca; the established ywiinc.com business website is
   related business presence, not an automatic cross-domain canonical target.
*/

'use strict';

const YWI_CANONICAL_ORIGIN = 'https://yardweasels.ca';
const YWI_ESTABLISHED_BUSINESS_ORIGIN = 'https://ywiinc.com';
const YWI_PUBLIC_INDEX_DIRECTIVE = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
const YWI_NONCANONICAL_INDEX_DIRECTIVE = 'noindex,follow';
const YWI_LOCAL_INDEX_TEST_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'layout.test']);

function ywiCanonicalUrl(value = '/', fallbackPath = '/') {
  try {
    const base = new URL(YWI_CANONICAL_ORIGIN);
    const candidate = new URL(String(value || fallbackPath || '/'), base);
    if (candidate.origin === base.origin) return candidate.href;
    return new URL(String(fallbackPath || '/'), base).href;
  } catch {
    return new URL(String(fallbackPath || '/'), YWI_CANONICAL_ORIGIN).href;
  }
}

function ywiIsIndexableHost(hostname = window.location.hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return host === new URL(YWI_CANONICAL_ORIGIN).hostname || YWI_LOCAL_INDEX_TEST_HOSTS.has(host);
}

function ywiIndexDirective(hostname = window.location.hostname) {
  return ywiIsIndexableHost(hostname) ? YWI_PUBLIC_INDEX_DIRECTIVE : YWI_NONCANONICAL_INDEX_DIRECTIVE;
}

function ywiApplyPublicDocumentAuthority(pathname = window.location.pathname) {
  const canonical = ywiCanonicalUrl(pathname || '/', pathname || '/');
  const robots = document.head?.querySelector('meta[name="robots"]');
  if (robots) robots.setAttribute('content', ywiIndexDirective());
  const canonicalLink = document.head?.querySelector('link[rel="canonical"]');
  if (canonicalLink) canonicalLink.setAttribute('href', canonical);
  const ogUrl = document.head?.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', canonical);
  document.documentElement.dataset.publicIndexAuthority = ywiIsIndexableHost() ? 'canonical' : 'noncanonical';
  return { canonical, robots: ywiIndexDirective(), indexableHost: ywiIsIndexableHost() };
}

window.YWI_PUBLIC_WEB_AUTHORITY = Object.freeze({
  canonicalOrigin: YWI_CANONICAL_ORIGIN,
  canonicalHost: new URL(YWI_CANONICAL_ORIGIN).hostname,
  establishedBusinessOrigin: YWI_ESTABLISHED_BUSINESS_ORIGIN,
  publicIndexDirective: YWI_PUBLIC_INDEX_DIRECTIVE,
  noncanonicalIndexDirective: YWI_NONCANONICAL_INDEX_DIRECTIVE,
  canonicalUrl: ywiCanonicalUrl,
  isIndexableHost: ywiIsIndexableHost,
  indexDirective: ywiIndexDirective,
  applyDocumentAuthority: ywiApplyPublicDocumentAuthority
});

ywiApplyPublicDocumentAuthority();

window.YWI_RUNTIME_CONFIG = Object.assign({}, window.YWI_RUNTIME_CONFIG || {}, {
  SB_URL: 'https://jmqvkgiqlimdhcofwkxr.supabase.co',
  SB_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJqdXF2a2dpcWxpbWRoY29md2t4ciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzcwMDA2MzQ2LCJleHAiOjIwODU1ODIzNDZ9.ULYqX2TL08_wfREPCIZjIbRf8nAc61ZWndm8UUJZ-D4',
  SUPABASE_URL: 'https://jmqvkgiqlimdhcofwkxr.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJqdXF2a2dpcWxpbWRoY29md2t4ciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzcwMDA2MzQ2LCJleHAiOjIwODU1ODIzNDZ9.ULYqX2TL08_wfREPCIZjIbRf8nAc61ZWndm8UUJZ-D4',
  APP_ENV: 'production',
  APP_CONFIG_SOURCE: 'js/app-config.js',
  APP_CONFIG_UPDATED_AT: '2026-09-07'
});

(function installAuthCallbackLifecycleGuard() {
  const supabase = window.supabase;
  if (!supabase?.createClient || supabase.createClient.__ywiAuthCallbackGuarded) return;
  const originalCreateClient = supabase.createClient.bind(supabase);

  function reportCallbackFailure(error) {
    const message = error?.message || 'Deferred authentication callback failed.';
    console.error('Deferred authentication callback failed.', error || message);
    try { window.dispatchEvent(new CustomEvent('ywi:app-error', { detail:{ scope:'auth-callback', message } })); } catch {}
  }

  function deferCallback(callback, event, session) {
    const run = () => {
      try { Promise.resolve(callback(event, session)).catch(reportCallbackFailure); }
      catch (error) { reportCallbackFailure(error); }
    };
    if (typeof queueMicrotask === 'function') queueMicrotask(run);
    else Promise.resolve().then(run);
  }

  function guardedCreateClient(...args) {
    const client = originalCreateClient(...args);
    const auth = client?.auth;
    if (!auth?.onAuthStateChange || auth.onAuthStateChange.__ywiAuthCallbackGuarded) return client;
    const originalOnAuthStateChange = auth.onAuthStateChange.bind(auth);
    const guardedOnAuthStateChange = function guardedOnAuthStateChange(callback) {
      if (typeof callback !== 'function') return originalOnAuthStateChange(callback);
      return originalOnAuthStateChange((event, session) => { deferCallback(callback, event, session); });
    };
    guardedOnAuthStateChange.__ywiAuthCallbackGuarded = true;
    auth.onAuthStateChange = guardedOnAuthStateChange;
    return client;
  }

  guardedCreateClient.__ywiAuthCallbackGuarded = true;
  guardedCreateClient.__ywiOriginalCreateClient = originalCreateClient;
  supabase.createClient = guardedCreateClient;
})();

(function loadWorkspaceOrganization() {
  if (document.querySelector('script[data-ywi-workspace-organization="1"]')) return;
  const script = document.createElement('script');
  script.src = '/js/workspace-organization.js?v=2026-09-07a';
  script.async = false;
  script.dataset.ywiWorkspaceOrganization = '1';
  script.onerror = () => {
    try { window.dispatchEvent(new CustomEvent('ywi:app-error', { detail:{ scope:'workspace-organization', message:'Workspace organization controls could not be loaded.', details:['Core authorization remains in force. Reload before using Finance review/posting controls.'] } })); } catch {}
  };
  document.head.appendChild(script);
})();

(function loadAdminOperationsWorkspaceOnDemand() {
  const selector = 'script[data-ywi-admin-operations-workspace="1"]';
  let observer = null;

  function isOperationsOpen() {
    return String(document.querySelector('#ad_hub_breadcrumb strong')?.textContent || '').trim() === 'Business & Operations';
  }

  function loadIfNeeded() {
    if (!isOperationsOpen() || document.querySelector(selector)) return;
    const script = document.createElement('script');
    script.src = '/js/admin-operations-workspace.js?v=2026-09-07a';
    script.async = false;
    script.dataset.ywiAdminOperationsWorkspace = '1';
    script.onerror = () => {
      try { window.dispatchEvent(new CustomEvent('ywi:app-error', { detail:{ scope:'admin-operations-workspace', message:'Business & Operations workspace controls could not be loaded.', details:['Existing Admin operations authority remains available through the underlying panels.'] } })); } catch {}
    };
    document.head.appendChild(script);
  }

  function startObserver() {
    loadIfNeeded();
    const root = document.getElementById('admin') || document.body;
    if (!root || observer) return;
    observer = new MutationObserver(loadIfNeeded);
    observer.observe(root, { subtree:true, childList:true, characterData:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once:true });
  else startObserver();
})();

// Build 235 follows the same load-shedding boundary for Safety & Evidence. The focused helper
// is presentation-only and is fetched only after the Admin hub selects the safety workspace.
(function loadAdminSafetyWorkspaceOnDemand() {
  const selector = 'script[data-ywi-admin-safety-workspace="1"]';
  let observer = null;

  function isSafetyOpen() {
    return String(document.querySelector('#ad_hub_breadcrumb strong')?.textContent || '').trim() === 'Safety & Evidence';
  }

  function loadIfNeeded() {
    if (!isSafetyOpen() || document.querySelector(selector)) return;
    const script = document.createElement('script');
    script.src = '/js/admin-safety-workspace.js?v=2026-09-07a';
    script.async = false;
    script.dataset.ywiAdminSafetyWorkspace = '1';
    script.onerror = () => {
      try { window.dispatchEvent(new CustomEvent('ywi:app-error', { detail:{ scope:'admin-safety-workspace', message:'Safety & Evidence workspace controls could not be loaded.', details:['Existing Admin safety and evidence authority remains available through the underlying panels.'] } })); } catch {}
    };
    document.head.appendChild(script);
  }

  function startObserver() {
    loadIfNeeded();
    const root = document.getElementById('admin') || document.body;
    if (!root || observer) return;
    observer = new MutationObserver(loadIfNeeded);
    observer.observe(root, { subtree:true, childList:true, characterData:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once:true });
  else startObserver();
})();

// Build 236 adds the same bounded, on-demand presentation rule to Admin Finance & Accounting.
// It does not add or enable posting, payment, provider, database, or Finance write authority.
(function loadAdminFinanceWorkspaceOnDemand() {
  const selector = 'script[data-ywi-admin-finance-workspace="1"]';
  let observer = null;

  function isFinanceOpen() {
    return String(document.querySelector('#ad_hub_breadcrumb strong')?.textContent || '').trim() === 'Finance & Accounting';
  }

  function loadIfNeeded() {
    if (!isFinanceOpen() || document.querySelector(selector)) return;
    const script = document.createElement('script');
    script.src = '/js/admin-finance-workspace.js?v=2026-09-07a';
    script.async = false;
    script.dataset.ywiAdminFinanceWorkspace = '1';
    script.onerror = () => {
      try { window.dispatchEvent(new CustomEvent('ywi:app-error', { detail:{ scope:'admin-finance-workspace', message:'Finance & Accounting workspace controls could not be loaded.', details:['Existing Admin accounting and Finance authorities remain available through their established panels and module workspaces.'] } })); } catch {}
    };
    document.head.appendChild(script);
  }

  function startObserver() {
    loadIfNeeded();
    const root = document.getElementById('admin') || document.body;
    if (!root || observer) return;
    observer = new MutationObserver(loadIfNeeded);
    observer.observe(root, { subtree:true, childList:true, characterData:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once:true });
  else startObserver();
})();

// Build 237 keeps Diagnostics & Integrations behind the same bounded, on-demand Admin boundary.
// The helper only summarizes rendered Admin state and reuses established health/messaging controls.
(function loadAdminDiagnosticsWorkspaceOnDemand() {
  const selector = 'script[data-ywi-admin-diagnostics-workspace="1"]';
  let observer = null;

  function isDiagnosticsOpen() {
    return String(document.querySelector('#ad_hub_breadcrumb strong')?.textContent || '').trim() === 'Diagnostics & Integrations';
  }

  function loadIfNeeded() {
    if (!isDiagnosticsOpen() || document.querySelector(selector)) return;
    const script = document.createElement('script');
    script.src = '/js/admin-diagnostics-workspace.js?v=2026-09-07a';
    script.async = false;
    script.dataset.ywiAdminDiagnosticsWorkspace = '1';
    script.onerror = () => {
      try { window.dispatchEvent(new CustomEvent('ywi:app-error', { detail:{ scope:'admin-diagnostics-workspace', message:'Diagnostics & Integrations workspace controls could not be loaded.', details:['Existing Admin health, smoke, conflict and notification authorities remain available through their established panels.'] } })); } catch {}
    };
    document.head.appendChild(script);
  }

  function startObserver() {
    loadIfNeeded();
    const root = document.getElementById('admin') || document.body;
    if (!root || observer) return;
    observer = new MutationObserver(loadIfNeeded);
    observer.observe(root, { subtree:true, childList:true, characterData:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once:true });
  else startObserver();
})();

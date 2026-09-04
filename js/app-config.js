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
  SB_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptcXZrZ2lxbGltZGhjb2Z3a3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDYzNDYsImV4cCI6MjA4NTU4MjM0Nn0.ULYqX2TL08_wfREPCIZjIbRf8nAc61ZWndm8UUJZ-D4',
  SUPABASE_URL: 'https://jmqvkgiqlimdhcofwkxr.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptcXZrZ2lxbGltZGhjb2Z3a3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDYzNDYsImV4cCI6MjA4NTU4MjM0Nn0.ULYqX2TL08_wfREPCIZjIbRf8nAc61ZWndm8UUJZ-D4',
  APP_ENV: 'production',
  APP_CONFIG_SOURCE: 'js/app-config.js',
  APP_CONFIG_UPDATED_AT: '2026-09-03'
});

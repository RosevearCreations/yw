/* File: js/router.js
   Brief description: Shared hash router for the YWI HSE single-page app.
   Handles safe section navigation, ignores auth callback hashes, applies route guards,
   and keeps nav state in sync without binding twice.
*/

'use strict';

(function () {
  const DEFAULT_SECTION = 'toolbox';
  const state = { initialized: false };

  function security() {
    return window.YWISecurity || null;
  }

  function auth() {
    return window.YWI_AUTH || null;
  }

  function getRole() {
    return auth()?.getState?.()?.role || 'worker';
  }

  function getSections() {
    return Array.from(document.querySelectorAll('main > section.card'));
  }

  function getNavLinks() {
    return Array.from(document.querySelectorAll('nav a[href^="#"]'));
  }

  function isAuthCallbackHash(raw) {
    return /(^|&)(access_token|refresh_token|expires_at|expires_in|token_type|type|error|error_code|error_description|code)=/i.test(raw || '');
  }

  function normalizeSectionId(id) {
    return String(id || DEFAULT_SECTION).replace(/[^a-zA-Z0-9_-]/g, '') || DEFAULT_SECTION;
  }

  function sectionExists(id) {
    return getSections().some((section) => section.id === id);
  }

  function getRequestedSection() {
    const raw = (location.hash || `#${DEFAULT_SECTION}`).slice(1);
    if (isAuthCallbackHash(raw)) return null;
    const firstPart = (raw.split('#')[0] || '').split('&')[0] || DEFAULT_SECTION;
    const normalized = normalizeSectionId(firstPart);
    return sectionExists(normalized) ? normalized : DEFAULT_SECTION;
  }

  function getAllowedSection(sectionId) {
    const sec = security();
    const role = getRole();
    if (!sec?.canViewSection) return sectionId;
    if (sec.canViewSection(sectionId, role)) return sectionId;
    return sec.getDefaultSectionForRole?.(role) || DEFAULT_SECTION;
  }

  function updateNav(sectionId) {
    getNavLinks().forEach((link) => {
      const linkId = normalizeSectionId((link.getAttribute('href') || '').slice(1));
      const alwaysVisible = ['toolbox','ppe','firstaid','inspect','drill','log','hseops','me','jobs','equipment','settings'];
      const allowed = security()?.canViewSection ? security().canViewSection(linkId, getRole()) : true;
      link.classList.toggle('active', link.getAttribute('href') === `#${sectionId}`);
      link.style.display = (allowed || alwaysVisible.includes(linkId)) ? '' : 'none';
    });
  }

  function updateSections(sectionId) {
    getSections().forEach((section) => {
      section.classList.toggle('active', section.id === sectionId);
    });
  }

  function updateHash(sectionId) {
    const raw = (location.hash || '').slice(1);
    if (!isAuthCallbackHash(raw) && location.hash !== `#${sectionId}`) {
      history.replaceState(null, '', `#${sectionId}`);
    }
  }

  function focusSection(sectionId) {
    const first = document.querySelector(`#${sectionId} input, #${sectionId} textarea, #${sectionId} select`);
    if (first) first.focus({ preventScroll: true });
  }

  function showSection(sectionId, options = {}) {
    if (!sectionId) return;
    const allowedSection = getAllowedSection(sectionId);
    updateSections(allowedSection);
    updateNav(allowedSection);
    updateHash(allowedSection);
    if (!options.skipFocus) {
      try { focusSection(allowedSection); } catch {}
    }
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch { try { window.scrollTo(0, 0); } catch {} }
    document.dispatchEvent(new CustomEvent('ywi:route-shown', { detail: { requested: sectionId, allowed: allowedSection, role: getRole() } }));
    if (allowedSection !== sectionId) {
      document.dispatchEvent(new CustomEvent('ywi:route-denied', { detail: { requested: sectionId, redirected: allowedSection, role: getRole() } }));
    }
  }

  function onNavClick(e) {
    const link = e.currentTarget;
    e.preventDefault();
    const href = link.getAttribute('href') || `#${DEFAULT_SECTION}`;
    showSection(normalizeSectionId(href.slice(1)));
  }

  function bindNav() {
    getNavLinks().forEach((link) => {
      if (link.dataset.routerBound === '1') return;
      link.dataset.routerBound = '1';
      link.addEventListener('click', onNavClick);
    });
  }

  function bindHashChange() {
    if (window.__ywiRouterHashBound) return;
    window.__ywiRouterHashBound = true;
    window.addEventListener('hashchange', () => {
      const sectionId = getRequestedSection();
      if (sectionId) showSection(sectionId);
    });
  }

  function init() {
    if (state.initialized) {
      const sectionId = getRequestedSection();
      if (sectionId) showSection(sectionId, { skipFocus: true });
      return;
    }
    state.initialized = true;
    bindNav();
    bindHashChange();
    const sectionId = getRequestedSection();
    if (sectionId) showSection(sectionId, { skipFocus: true });
  }

  window.YWIRouter = { init, showSection, getRequestedSection, isAuthCallbackHash };
  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('ywi:auth-changed', init);
})();

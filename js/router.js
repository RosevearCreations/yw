/* File: js/router.js
   Brief description: Shared hash router for the YWI HSE single-page app.
   Handles safe section navigation, ignores auth callback hashes, keeps nav state in sync,
   and includes an init guard so it does not bind twice if called from both DOMContentLoaded and app code.
*/

'use strict';

(function () {
  const DEFAULT_SECTION = 'toolbox';

  const state = {
    initialized: false
  };

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

    if (isAuthCallbackHash(raw)) {
      return null;
    }

    const firstPart = raw.split('&')[0] || DEFAULT_SECTION;
    const normalized = normalizeSectionId(firstPart);

    return sectionExists(normalized) ? normalized : DEFAULT_SECTION;
  }

  function updateNav(sectionId) {
    getNavLinks().forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === `#${sectionId}`);
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
    const first = document.querySelector(
      `#${sectionId} input, #${sectionId} textarea, #${sectionId} select`
    );

    if (first) {
      first.focus({ preventScroll: true });
    }
  }

  function showSection(sectionId) {
    if (!sectionId) return;

    updateSections(sectionId);
    updateNav(sectionId);
    updateHash(sectionId);
    focusSection(sectionId);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function onNavClick(e) {
    const link = e.currentTarget;
    e.preventDefault();

    const href = link.getAttribute('href') || `#${DEFAULT_SECTION}`;
    const sectionId = normalizeSectionId(href.slice(1));
    showSection(sectionId);
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
      if (sectionId) {
        showSection(sectionId);
      }
    });
  }

  function init() {
    if (state.initialized) {
      const sectionId = getRequestedSection();
      if (sectionId) showSection(sectionId);
      return;
    }

    state.initialized = true;

    bindNav();
    bindHashChange();

    const sectionId = getRequestedSection();
    if (sectionId) {
      showSection(sectionId);
    }
  }

  window.YWIRouter = {
    init,
    showSection,
    getRequestedSection,
    isAuthCallbackHash
  };

  document.addEventListener('DOMContentLoaded', init);
})();

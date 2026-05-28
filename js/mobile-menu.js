/* File: js/mobile-menu.js
   Brief description: Compact expandable mobile navigation for the YWI app shell.
   Keeps the main menu collapsed on phones, updates the current-section label,
   closes after route selection, and leaves desktop navigation unchanged.
*/

'use strict';

(function () {
  const MOBILE_QUERY = '(max-width: 759px)';
  const state = {
    bound: false,
    open: false,
    media: null
  };

  function getEls() {
    return {
      header: document.querySelector('.app-header'),
      toggle: document.getElementById('mainMenuToggle'),
      nav: document.getElementById('mainNav'),
      current: document.getElementById('mainMenuCurrent'),
      quickNav: document.getElementById('mobileQuickNav')
    };
  }

  function isMobile() {
    if (!state.media && typeof window.matchMedia === 'function') {
      state.media = window.matchMedia(MOBILE_QUERY);
    }
    return !!state.media?.matches;
  }

  function activeLinkText() {
    const { nav } = getEls();
    const active = nav?.querySelector('a.active[href^="#"]') || nav?.querySelector('a[href^="#"]');
    return active?.textContent?.trim?.() || 'Menu';
  }

  function setOpen(open) {
    const { header, toggle, nav, current } = getEls();
    const nextOpen = !!open;
    state.open = nextOpen;
    header?.classList.toggle('is-menu-open', nextOpen);
    document.body?.classList.toggle('is-main-menu-open', nextOpen);
    toggle?.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
    if (nav) nav.setAttribute('aria-hidden', isMobile() && !nextOpen ? 'true' : 'false');
    if (current) current.textContent = activeLinkText();
  }

  function close() {
    setOpen(false);
  }

  function open() {
    setOpen(true);
  }

  function toggle() {
    setOpen(!state.open);
  }

  function syncQuickNav() {
    const { quickNav } = getEls();
    if (!quickNav) return;
    const active = (document.querySelector('#mainNav a.active[href^="#"]')?.getAttribute('href') || window.location.hash || '#toolbox').replace('#', '');
    quickNav.querySelectorAll('[data-mobile-quick]').forEach((link) => {
      const key = link.getAttribute('data-mobile-quick') || '';
      link.classList.toggle('active', key === active);
      if (key === active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function sync() {
    const { current, nav } = getEls();
    if (current) current.textContent = activeLinkText();
    syncQuickNav();
    if (!isMobile()) {
      setOpen(false);
      if (nav) nav.setAttribute('aria-hidden', 'false');
    } else if (!state.open && nav) {
      nav.setAttribute('aria-hidden', 'true');
    }
  }

  function onDocumentClick(event) {
    if (!state.open || !isMobile()) return;
    const { header } = getEls();
    if (header && !header.contains(event.target)) close();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape' && state.open) close();
  }

  function bind() {
    if (state.bound) return;
    const { toggle: btn, nav } = getEls();
    if (!btn || !nav) return;
    state.bound = true;
    btn.addEventListener('click', toggle);
    nav.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', () => {
        if (isMobile()) close();
      });
    });
    const quickNav = document.getElementById('mobileQuickNav');
    quickNav?.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', () => {
        if (isMobile()) close();
        window.setTimeout(syncQuickNav, 40);
      });
    });
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('ywi:route-shown', () => {
      sync();
      if (isMobile()) close();
    });
    if (typeof window.matchMedia === 'function') {
      state.media = window.matchMedia(MOBILE_QUERY);
      state.media.addEventListener?.('change', sync);
    }
    window.addEventListener('resize', sync);
    sync();
  }

  window.YWIMobileMenu = { bind, open, close, toggle, sync };
  document.addEventListener('DOMContentLoaded', bind);
})();

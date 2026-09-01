/* File: js/module-nav.js
   Schema 160 top-level module navigation.
   The first navigation tier remains Safety/OHSA, Finance, Jobs, Admin. A second tier shows
   only routes that belong to the active permitted module. I.T. Readiness is an Admin/manage
   sub-section, not a fifth top-level module.
*/

'use strict';

(function () {
  const SECTION_LABELS = {
    toolbox: 'Toolbox Talk', ppe: 'PPE Check', firstaid: 'First Aid Kit', incident: 'Incident / Near Miss',
    inspect: 'Site Inspection', drill: 'Emergency Drill', log: 'Logbook', reports: 'Safety Reports', hseops: 'Safety Operations',
    finance: 'Finance Home', today: 'Today', crew: 'Crew', jobs: 'Jobs', equipment: 'Equipment',
    admin: 'Admin Control Center', it: 'I.T. Readiness'
  };
  const SECTION_ORDER = {
    safety: ['toolbox','ppe','firstaid','incident','inspect','drill','log','reports','hseops'],
    finance: ['finance'],
    jobs: ['today','crew','jobs','equipment'],
    admin: ['admin','it']
  };

  function security() { return window.YWISecurity || null; }
  function authState() { return window.YWI_AUTH?.getState?.() || {}; }
  function role() { return authState().role || 'employee'; }

  function activeSection() {
    return String((location.hash || '').replace(/^#/, '') || window.YWIRouter?.getRequestedSection?.() || '').split('&')[0];
  }

  function activeModule() {
    const sec = security();
    const section = activeSection();
    const module = sec?.getModuleForSection?.(section);
    if (module && sec?.canViewModule?.(module, role(), 'view')) return module;
    return sec?.getVisibleModules?.(role())?.[0]?.key || '';
  }

  function renderTopModules() {
    const nav = document.getElementById('mainNav');
    const sec = security();
    if (!nav || !sec) return;
    const currentModule = activeModule();
    nav.querySelectorAll('[data-module]').forEach((link) => {
      const key = String(link.dataset.module || '');
      const allowed = sec.canViewModule(key, role(), 'view');
      link.hidden = !allowed;
      link.setAttribute('aria-hidden', allowed ? 'false' : 'true');
      link.classList.toggle('active', allowed && key === currentModule);
      if (allowed && key === currentModule) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function renderSubnav(moduleKey = activeModule()) {
    const nav = document.getElementById('moduleSectionNav');
    const sec = security();
    if (!nav || !sec) return;
    if (!moduleKey || !sec.canViewModule(moduleKey, role(), 'view')) {
      nav.innerHTML = '';
      nav.hidden = true;
      return;
    }
    const current = activeSection();
    const links = (SECTION_ORDER[moduleKey] || [])
      .filter((sectionId) => sec.canViewSection(sectionId, role()))
      .map((sectionId) => `<a href="#${sectionId}" data-section="${sectionId}"${sectionId === current ? ' class="active" aria-current="page"' : ''}>${SECTION_LABELS[sectionId] || sectionId}</a>`)
      .join('');
    nav.innerHTML = links;
    nav.hidden = !links;
    nav.dataset.activeModule = moduleKey;
    nav.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        window.YWIRouter?.showSection?.(String(link.getAttribute('href') || '').slice(1));
      });
    });
  }

  function updateCurrentLabel() {
    const current = document.getElementById('mainMenuCurrent');
    const sec = security();
    if (!current || !sec) return;
    const moduleKey = activeModule();
    const sectionId = activeSection();
    const moduleLabel = sec.MODULES?.[moduleKey]?.shortLabel || sec.MODULES?.[moduleKey]?.label || 'Menu';
    const sectionLabel = SECTION_LABELS[sectionId] || '';
    current.textContent = sectionLabel && sectionId !== sec.MODULES?.[moduleKey]?.defaultSection ? `${moduleLabel} · ${sectionLabel}` : moduleLabel;
  }

  function sync() {
    renderTopModules();
    renderSubnav();
    updateCurrentLabel();
    window.YWIRouter?.bindNav?.();
  }

  function bindTopModuleClicks() {
    const nav = document.getElementById('mainNav');
    if (!nav || nav.dataset.moduleBound === '1') return;
    nav.dataset.moduleBound = '1';
    nav.addEventListener('click', (event) => {
      const link = event.target instanceof Element ? event.target.closest('a[data-module]') : null;
      if (!link) return;
      event.preventDefault();
      const moduleKey = String(link.dataset.module || '');
      const target = security()?.getDefaultSectionForModule?.(moduleKey, role());
      if (target) window.YWIRouter?.showSection?.(target);
    });
  }

  function init() { bindTopModuleClicks(); sync(); }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('ywi:auth-changed', () => setTimeout(sync, 0));
  document.addEventListener('ywi:module-permissions-changed', () => setTimeout(sync, 0));
  document.addEventListener('ywi:route-shown', () => setTimeout(sync, 0));
  window.YWIModuleNav = { sync, activeModule, renderSubnav };
})();

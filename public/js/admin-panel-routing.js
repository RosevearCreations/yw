// File: /public/js/admin-panel-routing.js
// Brief description: Builds collapsible admin panels, preserves their state,
// opens the correct panel for hash links, and keeps member-preview links consistent.

document.addEventListener('DOMContentLoaded', () => {
  const storageKey = 'dd_admin_panel_state_v2';
  const dashboard = document.querySelector('.admin-shell');
  if (!dashboard) return;

  function loadState() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  }
  function saveState(state) {
    try { localStorage.setItem(storageKey, JSON.stringify(state || {})); } catch {}
  }

  const savedState = loadState();
  const panelSections = Array.from(dashboard.querySelectorAll(':scope > .card[id$="Section"]'));
  panelSections.forEach((section) => {
    if (section.dataset.adminPanel === '1') return;
    const heading = section.querySelector(':scope > h2');
    if (!heading) return;
    const title = heading.textContent.trim() || section.id;
    section.dataset.adminPanel = '1';
    section.classList.add('admin-panel');

    const body = document.createElement('div');
    body.className = 'admin-panel-body';
    while (section.children.length) body.appendChild(section.children[0]);
    section.appendChild(body);

    const panelHead = document.createElement('div');
    panelHead.className = 'admin-panel-head';
    panelHead.innerHTML = `<button class="btn admin-panel-toggle" type="button" aria-expanded="true"><span class="admin-panel-toggle-label"></span><span class="admin-panel-toggle-icon">▾</span></button>`;
    section.insertBefore(panelHead, body);
    const toggle = panelHead.querySelector('.admin-panel-toggle');
    const label = panelHead.querySelector('.admin-panel-toggle-label');
    const icon = panelHead.querySelector('.admin-panel-toggle-icon');
    if (label) label.textContent = title;

    const key = section.id || title;
    const open = savedState[key] !== 0;
    section.dataset.panelOpen = open ? '1' : '0';
    body.style.display = open ? '' : 'none';
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (icon) icon.textContent = open ? '▾' : '▸';

    toggle.addEventListener('click', () => {
      const nextOpen = section.dataset.panelOpen !== '1';
      section.dataset.panelOpen = nextOpen ? '1' : '0';
      body.style.display = nextOpen ? '' : 'none';
      toggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
      if (icon) icon.textContent = nextOpen ? '▾' : '▸';
      savedState[key] = nextOpen ? 1 : 0;
      saveState(savedState);
    });
  });

  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);
    const panel = target?.closest?.('[data-admin-panel]');
    const toggle = panel?.querySelector?.('.admin-panel-toggle');
    if (panel && panel.dataset.panelOpen !== '1') toggle?.click();
    target?.scrollIntoView?.({ block: 'start' });
  }

  document.querySelectorAll('a[href="/members/"], a[href^="/members/#"]').forEach((link) => {
    const url = new URL(link.getAttribute('href'), window.location.origin);
    url.searchParams.set('admin_preview', '1');
    link.setAttribute('href', `${url.pathname}${url.search}${url.hash}`);
  });
});

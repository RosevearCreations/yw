// File: /public/js/site-auth-ui.js
// Brief description: Shared site-wide auth UI helper. It updates nav visibility,
// renders a floating account widget on every page, and emits page-level auth events.

document.addEventListener("DOMContentLoaded", () => {
  if (!window.DDAuth) return;

  const loggedInEls = Array.from(document.querySelectorAll("[data-show-when-logged-in]"));
  const loggedOutEls = Array.from(document.querySelectorAll("[data-show-when-logged-out]"));
  const adminEls = Array.from(document.querySelectorAll("[data-show-when-admin]"));
  const navUserNameEls = Array.from(document.querySelectorAll("[data-nav-user-name]"));
  const logoutButtons = Array.from(document.querySelectorAll("[data-nav-logout]"));
  const linksWrap = document.querySelector('.nav .links');
  let floatingWidgetEl = null;

  function show(el, shouldShow) { if (el) el.style.display = shouldShow ? "" : "none"; }
  function getSafeUserName(user) { return String(user?.display_name || user?.email || 'Member').trim() || 'Member'; }

  function ensureFloatingWidget() {
    if (floatingWidgetEl) return floatingWidgetEl;
    floatingWidgetEl = document.createElement('aside');
    floatingWidgetEl.id = 'ddAuthWidget';
    floatingWidgetEl.className = 'dd-auth-widget card';
    floatingWidgetEl.innerHTML = `
      <div class="dd-auth-widget-head">
        <div>
          <div class="dd-auth-widget-title">Account</div>
          <div class="small" id="ddAuthWidgetState">Checking session…</div>
        </div>
        <button class="btn" type="button" id="ddAuthWidgetToggle">Open</button>
      </div>
      <div class="dd-auth-widget-body" id="ddAuthWidgetBody" style="display:none">
        <div id="ddAuthWidgetLoggedIn" style="display:none">
          <div class="small" id="ddAuthWidgetUserLabel" style="margin-bottom:10px"></div>
          <div class="dd-auth-widget-links">
            <a href="/members/index.html">Settings</a>
            <a href="/members/index.html#orders">Orders</a>
            <a href="/admin/index.html" id="ddAuthWidgetAdminLink" style="display:none">Admin Dashboard</a>
            <button class="btn" type="button" id="ddAuthWidgetLogout">Logout</button>
          </div>
        </div>
        <div id="ddAuthWidgetLoggedOut" style="display:none">
          <div class="small" style="margin-bottom:10px">You are currently logged out.</div>
          <div class="dd-auth-widget-links">
            <a href="/login/index.html">Login</a>
            <a href="/register/index.html">Create account</a>
            <a href="/account-help/index.html?mode=password">Forgot password</a>
            <a href="/account-help/index.html?mode=email">Forgot email</a>
          </div>
        </div>
      </div>`;
    document.body.appendChild(floatingWidgetEl);
    const toggle = floatingWidgetEl.querySelector('#ddAuthWidgetToggle');
    const body = floatingWidgetEl.querySelector('#ddAuthWidgetBody');
    const logout = floatingWidgetEl.querySelector('#ddAuthWidgetLogout');
    toggle?.addEventListener('click', () => {
      body.style.display = body.style.display === 'none' ? 'block' : 'block';
      if (body.style.display === 'block' && toggle.textContent === 'Open') toggle.textContent = 'Close';
      else if (toggle.textContent === 'Close') { body.style.display = 'none'; toggle.textContent = 'Open'; }
    });
    logout?.addEventListener('click', async () => {
      try { await window.DDAuth.logout(); } finally { window.location.href = '/'; }
    });
    return floatingWidgetEl;
  }

  function applyUi(user) {
    const loggedIn = !!user;
    const role = String(user?.role || "").trim().toLowerCase();
    const isAdmin = loggedIn && role === 'admin';
    const name = getSafeUserName(user);
    loggedInEls.forEach((el) => show(el, loggedIn));
    loggedOutEls.forEach((el) => show(el, !loggedIn));
    adminEls.forEach((el) => show(el, isAdmin));
    navUserNameEls.forEach((el) => { el.textContent = name; });
    const widget = ensureFloatingWidget();
    if (widget) {
      const state = widget.querySelector('#ddAuthWidgetState');
      const loggedInWrap = widget.querySelector('#ddAuthWidgetLoggedIn');
      const loggedOutWrap = widget.querySelector('#ddAuthWidgetLoggedOut');
      const label = widget.querySelector('#ddAuthWidgetUserLabel');
      const adminLink = widget.querySelector('#ddAuthWidgetAdminLink');
      if (state) state.textContent = loggedIn ? `${name} • ${role || 'member'}` : 'Not logged in';
      if (label) label.textContent = loggedIn ? `Signed in as ${name} (${user?.email || 'no email'})` : '';
      if (adminLink) adminLink.style.display = isAdmin ? '' : 'none';
      show(loggedInWrap, loggedIn);
      show(loggedOutWrap, !loggedIn);
    }
    if (linksWrap) {
      let statusEl = linksWrap.querySelector('.dd-nav-status');
      if (!statusEl) {
        statusEl = document.createElement('span');
        statusEl.className = 'small dd-nav-status';
        statusEl.innerHTML = 'Signed in as <span data-nav-user-name>Member</span>';
        statusEl.style.display = 'none';
        linksWrap.appendChild(statusEl);
      }
      show(statusEl, loggedIn);
      const nameEl = statusEl?.querySelector('[data-nav-user-name]');
      if (nameEl) nameEl.textContent = name;
    }
  }

  function emitAuthEvents(user, session = null) {
    const loggedIn = !!user;
    const role = String(user?.role || "").trim().toLowerCase();
    const isAdmin = loggedIn && role === 'admin';
    document.dispatchEvent(new CustomEvent('dd:auth-ready', { detail: { ok: true, logged_in: loggedIn, user, session } }));
    document.dispatchEvent(new CustomEvent('dd:member-access-ready', { detail: { ok: loggedIn, logged_in: loggedIn, user, session } }));
    document.dispatchEvent(new CustomEvent('dd:members-ready', { detail: { ok: loggedIn, logged_in: loggedIn, user, session } }));
    document.dispatchEvent(new CustomEvent('dd:admin-ready', { detail: { ok: isAdmin, logged_in: loggedIn, user, session } }));
  }

  async function refreshAuthState() {
    const cachedUser = window.DDAuth.getStoredUser();
    if (cachedUser) {
      applyUi(cachedUser);
      emitAuthEvents(cachedUser, null);
    }
    if (!window.DDAuth.isLoggedIn()) {
      if (!cachedUser) {
        applyUi(null);
        emitAuthEvents(null, null);
      }
      return;
    }
    try {
      const data = await window.DDAuth.me();
      applyUi(data?.user || null);
      emitAuthEvents(data?.user || null, data?.session || null);
    } catch {
      window.DDAuth.clearAuth();
      applyUi(null);
      emitAuthEvents(null, null);
    }
  }

  logoutButtons.forEach((button) => button.addEventListener('click', async () => {
    try { await window.DDAuth.logout(); } finally { window.location.href = '/'; }
  }));

  document.addEventListener('dd:auth-changed', (event) => {
    const user = event?.detail?.logged_in ? (event?.detail?.user || window.DDAuth.getStoredUser()) : null;
    applyUi(user);
    emitAuthEvents(user, null);
  });

  applyUi(window.DDAuth.getStoredUser());
  refreshAuthState();
});

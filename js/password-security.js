/* Build 191 — password visibility + temporary-password replacement gate.
   Existing passwords are never readable. This module only reveals values currently
   present in browser password inputs and forces an admin-issued temporary password
   to be replaced before normal module access resumes. */
'use strict';

(function () {
  const TOGGLE_MARKER = 'ywiPasswordToggleBound';
  const ADMIN_SECURITY_SCRIPT = '/js/admin-account-security-ui.js';
  let patched = false;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function bindPasswordInput(input) {
    if (!(input instanceof HTMLInputElement) || input.dataset[TOGGLE_MARKER] === '1') return;
    if (input.type !== 'password' && input.dataset.ywiPasswordField !== '1') return;
    input.dataset[TOGGLE_MARKER] = '1';
    input.dataset.ywiPasswordField = '1';
    const wrapper = document.createElement('span');
    wrapper.className = 'ywi-password-input-wrap';
    wrapper.style.display = 'grid';
    wrapper.style.gridTemplateColumns = 'minmax(0,1fr) auto';
    wrapper.style.gap = '6px';
    wrapper.style.alignItems = 'center';
    const parent = input.parentNode;
    if (!parent) return;
    parent.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'secondary ywi-password-toggle';
    toggle.textContent = '👁';
    toggle.title = 'Show password';
    toggle.setAttribute('aria-label', 'Show password');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.style.minWidth = '44px';
    toggle.style.padding = '8px 10px';
    toggle.addEventListener('click', () => {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      toggle.setAttribute('aria-pressed', showing ? 'false' : 'true');
      toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      toggle.title = showing ? 'Show password' : 'Hide password';
      input.focus({ preventScroll: true });
    });
    wrapper.appendChild(toggle);
  }

  function bindPasswordVisibility(root = document) {
    root.querySelectorAll?.('input[type="password"],input[data-ywi-password-field="1"]').forEach(bindPasswordInput);
  }

  function loadAdminSecurityUi() {
    const state = window.YWI_AUTH?.getState?.() || {};
    if (String(state.role || '').toLowerCase() !== 'admin' || state.needsAccountSetup) return;
    if ([...document.scripts].some((s) => new URL(s.src || '', location.origin).pathname === ADMIN_SECURITY_SCRIPT)) return;
    const script = document.createElement('script');
    script.src = `${ADMIN_SECURITY_SCRIPT}?v=2026-09-03e`;
    script.async = false;
    script.dataset.ywiAdminSecurity = '1';
    script.onerror = () => window.dispatchEvent(new CustomEvent('ywi:app-error',{detail:{scope:'admin-account-security-ui',message:'Admin account security controls could not be loaded.',details:['Refresh before attempting an account reset.']}}));
    document.head.appendChild(script);
  }

  function renderResetBanner() {
    const auth = window.YWI_AUTH;
    const state = auth?.getState?.() || {};
    const required = state.profile?.password_reset_required === true;
    const settings = document.getElementById('settings');
    if (!settings) return;
    let banner = document.getElementById('temporaryPasswordRequiredNotice');
    if (!required) { banner?.remove(); return; }
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'temporaryPasswordRequiredNotice';
      banner.className = 'notice';
      banner.style.marginBottom = '14px';
      settings.insertBefore(banner, settings.firstChild?.nextSibling || settings.firstChild);
    }
    banner.innerHTML = `<strong>Temporary password must be replaced</strong><div style="margin-top:6px">An administrator issued a temporary password for this account. Enter a new permanent password in <b>Account &amp; Security</b> below. Other modules remain closed until the replacement is saved.</div>`;
    window.YWIRouter?.showSection?.('settings', { skipFocus: true });
  }

  function patchAuth() {
    const auth = window.YWI_AUTH;
    if (!auth || patched) return false;
    patched = true;
    const originalGetState = auth.getState.bind(auth);
    auth.getState = function getStateWithPasswordGate() {
      const state = originalGetState() || {};
      if (state.profile?.password_reset_required === true) return { ...state, needsAccountSetup: true, passwordResetRequired: true };
      return state;
    };
    const originalChangePassword = auth.changePassword.bind(auth);
    auth.changePassword = async function changePasswordWithResetCompletion(newPassword) {
      const before = originalGetState() || {};
      const wasTemporary = before.profile?.password_reset_required === true;
      const result = await originalChangePassword(newPassword);
      if (wasTemporary) {
        try {
          const payload = await window.YWIAPI?.jsonFetch?.('admin-account-security', { method:'POST', body:{ action:'confirm_password_change' }, requireAuth:true });
          if (!payload?.ok) throw new Error(payload?.error || 'Unable to clear temporary-password requirement.');
          await auth.refresh?.();
        } catch (err) {
          throw new Error(`Your password was changed, but the temporary-password gate could not be cleared. Contact Admin/I.T. before continuing. ${err?.message || ''}`.trim());
        }
      }
      return result;
    };
    return true;
  }

  function sync() {
    patchAuth();
    bindPasswordVisibility(document);
    renderResetBanner();
    loadAdminSecurityUi();
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches?.('input[type="password"],input[data-ywi-password-field="1"]')) bindPasswordInput(node);
        bindPasswordVisibility(node);
      });
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once:true });
  else sync();
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('ywi:auth-changed',()=>queueMicrotask(sync));
  document.addEventListener('ywi:module-runtime-ready',()=>queueMicrotask(sync));

  window.YWIPasswordSecurity = Object.freeze({ bindPasswordVisibility, isTemporaryPasswordRequired:()=>window.YWI_AUTH?.getState?.()?.profile?.password_reset_required===true, escape:esc });
})();

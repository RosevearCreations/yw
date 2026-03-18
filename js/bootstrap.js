'use strict';

/* =========================================================
   js/bootstrap.js
   Application bootstrap / startup layer

   Purpose:
   - create Supabase client once
   - initialize shared auth service
   - initialize auth UI
   - expose app-wide globals for gradual refactor
   - emit auth lifecycle events for other modules
========================================================= */

(function () {
  const CONFIG = {
    supabaseUrl: 'https://jmqvkgiqlimdhcofwkxr.supabase.co',
    supabaseKey: 'sb_publishable_Xyg1zQU9_vsAaME9BeHm_w_RRgtPs_e',
    authStorageKey: 'ywi-auth',
    profileTable: 'profiles',
    defaultRouteAfterLogin: '#toolbox',
    idleTimeoutMs: 30 * 60 * 1000
  };

  function dispatchAppEvent(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function normalizeHashRoute(hash) {
    const value = String(hash || '');
    const cleaned = value.startsWith('#') ? value : `#${value || 'toolbox'}`;
    const raw = cleaned.slice(1);

    if (/^(access_token|refresh_token|expires_at|expires_in|token_type|type|error|code)=/i.test(raw)) {
      return CONFIG.defaultRouteAfterLogin;
    }

    return cleaned || CONFIG.defaultRouteAfterLogin;
  }

  function ensureRoute() {
    const safeHash = normalizeHashRoute(window.location.hash || CONFIG.defaultRouteAfterLogin);
    if (window.location.hash !== safeHash) {
      history.replaceState({}, '', window.location.pathname + safeHash);
    }
  }

  function createSupabaseClient() {
    if (!window.supabase?.createClient) {
      throw new Error('Supabase library is not loaded.');
    }

    return window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: CONFIG.authStorageKey
      }
    });
  }

  function setIdleLogout(auth) {
    if (!auth || !CONFIG.idleTimeoutMs || CONFIG.idleTimeoutMs < 1) return;

    let idleTimer = null;

    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(async () => {
        try {
          if (auth.isAuthenticated()) {
            await auth.signOut();
          }
        } catch (err) {
          console.error('Idle logout failed.', err);
        }
      }, CONFIG.idleTimeoutMs);
    };

    ['click', 'mousemove', 'keydown', 'touchstart', 'scroll'].forEach((evt) => {
      window.addEventListener(evt, resetIdle, { passive: true });
    });

    resetIdle();
  }

  function buildBootObject({ sb, auth, authUI }) {
    return {
      config: { ...CONFIG },
      sb,
      auth,
      authUI,

      async getAccessToken() {
        return auth.getAccessToken();
      },

      async authHeader() {
        const token = await auth.getAccessToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },

      currentUser() {
        return auth.getUser();
      },

      currentProfile() {
        return auth.getProfile();
      },

      currentRole() {
        return auth.getRole();
      },

      can(role) {
        return auth.can(role);
      }
    };
  }

  async function start() {
    try {
      ensureRoute();

      const sb = createSupabaseClient();
      const auth = window.YWIAuth.create({
        sb,
        profileTable: CONFIG.profileTable
      });

      const authUI = window.YWIAuthUI.create({
        auth
      });

      const boot = buildBootObject({ sb, auth, authUI });

      window.YWI_CONFIG = { ...CONFIG };
      window.YWI_SB = sb;
      window.YWI_AUTH = auth;
      window.YWI_AUTH_UI = authUI;
      window.YWI_BOOT = boot;

      /* backward compatibility for older code still using window._sb */
      window._sb = sb;

      auth.onChange((state) => {
        dispatchAppEvent('ywi:auth-changed', {
          state,
          role: state.role,
          roleLabel: state.roleLabel,
          isAuthenticated: state.isAuthenticated,
          profile: state.profile,
          user: state.user
        });

        if (state.isAuthenticated) {
          dispatchAppEvent('ywi:user-ready', {
            state,
            profile: state.profile,
            role: state.role
          });
        }
      });

      dispatchAppEvent('ywi:boot-started', {
        config: { ...CONFIG }
      });

      if (authUI?.init) {
        await authUI.init();
      } else {
        await auth.init();
      }

      setIdleLogout(auth);

      dispatchAppEvent('ywi:boot-ready', {
        config: { ...CONFIG },
        role: auth.getRole(),
        isAuthenticated: auth.isAuthenticated(),
        profile: auth.getProfile()
      });

      console.info('YWI bootstrap ready.');
    } catch (err) {
      console.error('YWI bootstrap failed.', err);

      dispatchAppEvent('ywi:boot-error', {
        message: err?.message || 'Unknown bootstrap error'
      });

      const authNotice = document.getElementById('authNotice');
      if (authNotice) {
        authNotice.style.display = 'block';
        authNotice.textContent = `Startup error: ${err?.message || 'Could not initialize app.'}`;
        authNotice.setAttribute('data-state', 'error');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

'use strict';

/* =========================================================
   js/auth.js
   Central auth/session helper for YWI HSE

   Purpose:
   - keep auth logic out of app.js
   - support current magic-link login
   - prepare for email/password login later
   - expose current user/session/role helpers
   - support role-based UI visibility
========================================================= */

(function () {
  const AUTH_STORAGE_KEY = 'ywi-auth-state';

  const DEFAULT_ROLES = {
    worker: {
      key: 'worker',
      label: 'Worker',
      rank: 10
    },
    staff: {
      key: 'staff',
      label: 'Staff',
      rank: 20
    },
    onsite_admin: {
      key: 'onsite_admin',
      label: 'Onsite Admin',
      rank: 30
    },
    job_admin: {
      key: 'job_admin',
      label: 'Job Admin',
      rank: 40
    },
    site_leader: {
      key: 'site_leader',
      label: 'Site Leader',
      rank: 50
    },
    supervisor: {
      key: 'supervisor',
      label: 'Supervisor',
      rank: 60
    },
    hse: {
      key: 'hse',
      label: 'HSE',
      rank: 70
    },
    admin: {
      key: 'admin',
      label: 'Admin',
      rank: 100
    }
  };

  function normalizeRole(role) {
    const key = String(role || '').trim().toLowerCase();
    return DEFAULT_ROLES[key] ? key : 'worker';
  }

  function roleLabel(role) {
    const key = normalizeRole(role);
    return DEFAULT_ROLES[key]?.label || 'Worker';
  }

  function roleRank(role) {
    const key = normalizeRole(role);
    return DEFAULT_ROLES[key]?.rank || 0;
  }

  function canAccessRole(userRole, requiredRole) {
    return roleRank(userRole) >= roleRank(requiredRole);
  }

  function safeJsonParse(value, fallback = null) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  class YWIAuth {
    constructor(config) {
      this.sb = config?.sb || null;
      this.profileTable = config?.profileTable || 'profiles';
      this.onChangeCallbacks = [];
      this.state = {
        session: null,
        user: null,
        profile: null,
        role: 'worker',
        isAuthenticated: false,
        isActive: false,
        authMode: 'magic_link'
      };
    }

    /* =========================
       INTERNAL STATE
    ========================= */
    _setState(nextState) {
      this.state = {
        ...this.state,
        ...nextState
      };
      this._persistState();
      this._emitChange();
    }

    _persistState() {
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
          role: this.state.role,
          isAuthenticated: this.state.isAuthenticated,
          isActive: this.state.isActive,
          authMode: this.state.authMode,
          profile: this.state.profile
            ? {
                id: this.state.profile.id || '',
                email: this.state.profile.email || '',
                full_name: this.state.profile.full_name || '',
                role: this.state.profile.role || '',
                is_active: this.state.profile.is_active !== false
              }
            : null
        }));
      } catch (err) {
        console.warn('Could not persist auth state.', err);
      }
    }

    _emitChange() {
      this.onChangeCallbacks.forEach((fn) => {
        try {
          fn(this.getState());
        } catch (err) {
          console.error('Auth change callback failed.', err);
        }
      });
    }

    _buildFallbackProfile(user) {
      return {
        id: user?.id || '',
        email: user?.email || '',
        full_name: user?.user_metadata?.full_name || '',
        role: 'worker',
        is_active: true
      };
    }

    async _loadProfile(user) {
      if (!this.sb || !user?.id) return null;

      try {
        const { data, error } = await this.sb
          .from(this.profileTable)
          .select('id,email,full_name,role,is_active')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        return data || null;
      } catch (err) {
        console.warn('Profile lookup failed. Falling back to auth user.', err);
        return null;
      }
    }

    /* =========================
       PUBLIC STATE
    ========================= */
    getState() {
      return {
        ...this.state,
        roleLabel: roleLabel(this.state.role)
      };
    }

    getSession() {
      return this.state.session || null;
    }

    getUser() {
      return this.state.user || null;
    }

    getProfile() {
      return this.state.profile || null;
    }

    getRole() {
      return normalizeRole(this.state.role);
    }

    getRoleLabel() {
      return roleLabel(this.state.role);
    }

    isAuthenticated() {
      return !!this.state.isAuthenticated;
    }

    isActive() {
      return !!this.state.isActive;
    }

    hasRole(role) {
      return normalizeRole(this.state.role) === normalizeRole(role);
    }

    can(role) {
      return canAccessRole(this.state.role, role);
    }

    onChange(callback) {
      if (typeof callback !== 'function') return () => {};
      this.onChangeCallbacks.push(callback);
      return () => {
        this.onChangeCallbacks = this.onChangeCallbacks.filter(fn => fn !== callback);
      };
    }

    /* =========================
       INITIALIZE
    ========================= */
    async init() {
      if (!this.sb) {
        console.warn('Supabase client missing. Auth service inactive.');
        return this.getState();
      }

      try {
        const { data } = await this.sb.auth.getSession();
        const session = data?.session || null;
        await this._applySession(session);
      } catch (err) {
        console.error('Auth init failed.', err);
      }

      this.sb.auth.onAuthStateChange(async (_event, session) => {
        await this._applySession(session || null);
      });

      return this.getState();
    }

    async _applySession(session) {
      if (!session?.user) {
        this._setState({
          session: null,
          user: null,
          profile: null,
          role: 'worker',
          isAuthenticated: false,
          isActive: false
        });
        return;
      }

      const user = session.user;
      let profile = await this._loadProfile(user);

      if (!profile) {
        profile = this._buildFallbackProfile(user);
      }

      const normalizedRole = normalizeRole(profile.role || user?.user_metadata?.role || 'worker');
      const active = profile.is_active !== false;

      this._setState({
        session,
        user,
        profile: {
          ...profile,
          role: normalizedRole,
          is_active: active
        },
        role: normalizedRole,
        isAuthenticated: true,
        isActive: active
      });
    }

    /* =========================
       LOGIN METHODS
    ========================= */
    async sendMagicLink(email, emailRedirectTo) {
      if (!this.sb) throw new Error('Auth client unavailable.');

      const cleanEmail = String(email || '').trim();
      if (!cleanEmail) throw new Error('Email is required.');

      const { error } = await this.sb.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo
        }
      });

      if (error) throw error;

      this._setState({
        authMode: 'magic_link'
      });

      return { ok: true };
    }

    async signInWithPassword(email, password) {
      if (!this.sb) throw new Error('Auth client unavailable.');

      const cleanEmail = String(email || '').trim();
      const cleanPassword = String(password || '');

      if (!cleanEmail) throw new Error('Email is required.');
      if (!cleanPassword) throw new Error('Password is required.');

      const { data, error } = await this.sb.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword
      });

      if (error) throw error;

      this._setState({
        authMode: 'password'
      });

      await this._applySession(data?.session || null);
      return { ok: true, session: data?.session || null };
    }

    async signUpWithPassword(email, password, metadata = {}) {
      if (!this.sb) throw new Error('Auth client unavailable.');

      const cleanEmail = String(email || '').trim();
      const cleanPassword = String(password || '');

      if (!cleanEmail) throw new Error('Email is required.');
      if (!cleanPassword) throw new Error('Password is required.');
      if (cleanPassword.length < 8) throw new Error('Password must be at least 8 characters.');

      const { data, error } = await this.sb.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          data: metadata
        }
      });

      if (error) throw error;

      this._setState({
        authMode: 'password'
      });

      if (data?.session) {
        await this._applySession(data.session);
      }

      return {
        ok: true,
        user: data?.user || null,
        session: data?.session || null
      };
    }

    async resetPassword(email, redirectTo) {
      if (!this.sb) throw new Error('Auth client unavailable.');

      const cleanEmail = String(email || '').trim();
      if (!cleanEmail) throw new Error('Email is required.');

      const { error } = await this.sb.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo
      });

      if (error) throw error;
      return { ok: true };
    }

    async updatePassword(newPassword) {
      if (!this.sb) throw new Error('Auth client unavailable.');

      const cleanPassword = String(newPassword || '');
      if (!cleanPassword) throw new Error('New password is required.');
      if (cleanPassword.length < 8) throw new Error('Password must be at least 8 characters.');

      const { data, error } = await this.sb.auth.updateUser({
        password: cleanPassword
      });

      if (error) throw error;

      if (data?.user) {
        const session = this.state.session;
        await this._applySession(session);
      }

      return { ok: true };
    }

    async signOut() {
      if (!this.sb) return { ok: true };

      const { error } = await this.sb.auth.signOut();
      if (error) throw error;

      this._setState({
        session: null,
        user: null,
        profile: null,
        role: 'worker',
        isAuthenticated: false,
        isActive: false
      });

      return { ok: true };
    }

    async refresh() {
      if (!this.sb) throw new Error('Auth client unavailable.');

      const { data, error } = await this.sb.auth.refreshSession();
      if (error) throw error;

      await this._applySession(data?.session || null);
      return this.getState();
    }

    async getAccessToken() {
      if (!this.sb) return '';
      const { data } = await this.sb.auth.getSession();
      return data?.session?.access_token || '';
    }
  }

  /* =========================
     GLOBAL EXPORT
  ========================= */
  function createYWIAuth(config) {
    return new YWIAuth(config);
  }

  window.YWIAuth = {
    create: createYWIAuth,
    normalizeRole,
    roleLabel,
    roleRank,
    canAccessRole,
    restorePersistedState() {
      const stored = safeJsonParse(localStorage.getItem(AUTH_STORAGE_KEY), null);
      return stored || null;
    },
    knownRoles() {
      return Object.values(DEFAULT_ROLES).map(role => ({
        key: role.key,
        label: role.label,
        rank: role.rank
      }));
    }
  };
})();

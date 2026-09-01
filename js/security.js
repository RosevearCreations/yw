/* File: js/security.js
   Schema 159 module + role security helper.
   Roles still control approval/action seniority. Module permissions independently control
   whether Safety/OHSA, Finance, Jobs, or Admin surfaces exist for the signed-in profile.
*/

'use strict';

(function () {
  const ROLE_RANK = {
    worker: 10,
    employee: 10,
    staff: 15,
    onsite_admin: 18,
    site_leader: 20,
    supervisor: 30,
    hse: 40,
    job_admin: 45,
    admin: 50
  };

  const ACCESS_RANK = { hidden: 0, view: 10, create: 20, approve: 30, manage: 40 };

  const MODULES = {
    safety: { key: 'safety', label: 'Safety / OHSA', shortLabel: 'Safety', defaultSection: 'toolbox', sortOrder: 10 },
    finance: { key: 'finance', label: 'Finance', shortLabel: 'Finance', defaultSection: 'finance', sortOrder: 20 },
    jobs: { key: 'jobs', label: 'Jobs', shortLabel: 'Jobs', defaultSection: 'today', sortOrder: 30 },
    admin: { key: 'admin', label: 'Admin', shortLabel: 'Admin', defaultSection: 'admin', sortOrder: 40 }
  };

  const SECTION_MODULES = {
    toolbox: 'safety', ppe: 'safety', firstaid: 'safety', incident: 'safety', inspect: 'safety', drill: 'safety',
    log: 'safety', reports: 'safety', hseops: 'safety',
    finance: 'finance',
    today: 'jobs', crew: 'jobs', jobs: 'jobs', equipment: 'jobs',
    admin: 'admin'
  };

  const SECTION_ACCESS = {
    toolbox: 'create', ppe: 'create', firstaid: 'create', incident: 'create', inspect: 'create', drill: 'create',
    log: 'view', reports: 'approve', hseops: 'approve',
    finance: 'view',
    today: 'view', crew: 'approve', jobs: 'view', equipment: 'create',
    admin: 'view'
  };

  // Legacy role fallback is used only while schema 159 permissions have not loaded.
  const ROLE_MODULE_DEFAULTS = {
    employee: { safety: 'create', finance: 'hidden', jobs: 'create', admin: 'hidden' },
    onsite_admin: { safety: 'create', finance: 'hidden', jobs: 'create', admin: 'hidden' },
    site_leader: { safety: 'approve', finance: 'hidden', jobs: 'approve', admin: 'hidden' },
    supervisor: { safety: 'approve', finance: 'view', jobs: 'approve', admin: 'hidden' },
    hse: { safety: 'manage', finance: 'hidden', jobs: 'view', admin: 'hidden' },
    job_admin: { safety: 'view', finance: 'manage', jobs: 'manage', admin: 'hidden' },
    admin: { safety: 'manage', finance: 'manage', jobs: 'manage', admin: 'manage' }
  };

  const SECTION_RULES = {
    today: 'worker', toolbox: 'worker', ppe: 'worker', firstaid: 'worker', incident: 'worker', inspect: 'worker', drill: 'worker',
    me: 'worker', settings: 'worker', crew: 'supervisor', log: 'worker', reports: 'supervisor', hseops: 'worker', admin: 'admin', jobs: 'worker', equipment: 'worker', finance: 'supervisor'
  };

  const moduleState = { loaded: false, permissions: {}, rows: [] };

  function normalizeRole(role) {
    const clean = String(role || 'employee').trim().toLowerCase() || 'employee';
    if (clean === 'worker' || clean === 'staff') return 'employee';
    return clean;
  }

  function normalizeAccess(value) {
    const clean = String(value || 'hidden').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(ACCESS_RANK, clean) ? clean : 'hidden';
  }

  function roleRank(role) { return ROLE_RANK[normalizeRole(role)] || 0; }
  function hasMinRole(role, minimumRole) { return roleRank(role) >= roleRank(minimumRole); }
  function accessRank(level) { return ACCESS_RANK[normalizeAccess(level)] || 0; }
  function accessAtLeast(actual, minimum = 'view') { return accessRank(actual) >= accessRank(minimum); }

  function fallbackModuleAccess(role, moduleKey) {
    const normalized = normalizeRole(role);
    if (normalized === 'admin') return 'manage';
    return ROLE_MODULE_DEFAULTS[normalized]?.[moduleKey] || 'hidden';
  }

  function setModulePermissions(rows = [], { loaded = true } = {}) {
    const next = {};
    for (const row of Array.isArray(rows) ? rows : []) {
      const key = String(row?.module_key || row?.moduleKey || '').trim().toLowerCase();
      if (!MODULES[key]) continue;
      next[key] = normalizeAccess(row?.access_level || row?.accessLevel);
    }
    moduleState.permissions = next;
    moduleState.rows = Array.isArray(rows) ? rows.slice() : [];
    moduleState.loaded = !!loaded;
    document.dispatchEvent(new CustomEvent('ywi:module-permissions-changed', { detail: getModulePermissionState() }));
  }

  function clearModulePermissions() {
    moduleState.permissions = {};
    moduleState.rows = [];
    moduleState.loaded = false;
  }

  function getModulePermissionState() {
    return { loaded: moduleState.loaded, permissions: { ...moduleState.permissions }, rows: moduleState.rows.slice() };
  }

  function getModuleAccess(moduleKey, role) {
    const key = String(moduleKey || '').trim().toLowerCase();
    if (!MODULES[key]) return 'hidden';
    if (normalizeRole(role) === 'admin') return 'manage';
    if (moduleState.loaded && Object.prototype.hasOwnProperty.call(moduleState.permissions, key)) return normalizeAccess(moduleState.permissions[key]);
    return fallbackModuleAccess(role, key);
  }

  function canViewModule(moduleKey, role, minimum = 'view') {
    return accessAtLeast(getModuleAccess(moduleKey, role), minimum);
  }

  function getModuleForSection(sectionId) {
    return SECTION_MODULES[String(sectionId || '').trim()] || null;
  }

  function getRequiredModuleAccess(sectionId) {
    return SECTION_ACCESS[String(sectionId || '').trim()] || 'view';
  }

  function canReviewSubmissions(role) { return roleRank(role) >= roleRank('site_leader'); }
  function canViewCrew(role) { return roleRank(role) >= roleRank('supervisor'); }
  function canViewAdminDirectory(role) { return roleRank(role) >= roleRank('supervisor'); }
  function canManageJobs(role) { return roleRank(role) >= roleRank('supervisor'); }
  function canManageAdminDirectory(role) { return roleRank(role) >= roleRank('admin'); }

  function canViewPerson(viewerRole, targetRole) {
    const viewer = normalizeRole(viewerRole);
    const target = normalizeRole(targetRole);
    if (viewer === 'admin') return true;
    if (viewer === target) return true;
    if (viewer === 'supervisor') return roleRank(target) < roleRank('supervisor');
    if (viewer === 'hse' || viewer === 'job_admin') return roleRank(target) < roleRank('admin');
    return false;
  }

  function getRoleLabel(role) {
    const labels = {
      worker: 'Employee', employee: 'Employee', staff: 'Employee', onsite_admin: 'Onsite Admin', site_leader: 'Site Leader',
      supervisor: 'Supervisor', hse: 'HSE', job_admin: 'Job Admin', admin: 'Admin'
    };
    return labels[normalizeRole(role)] || 'Employee';
  }

  function getAccessProfile(role) {
    const normalized = normalizeRole(role);
    return {
      role: normalized,
      roleLabel: getRoleLabel(normalized),
      rank: roleRank(normalized),
      modules: Object.fromEntries(Object.keys(MODULES).map((key) => [key, getModuleAccess(key, normalized)])),
      canReviewSubmissions: canReviewSubmissions(normalized),
      canViewCrew: canViewCrew(normalized),
      canViewAdminDirectory: canViewAdminDirectory(normalized),
      canManageAdminDirectory: canManageAdminDirectory(normalized),
      canManageJobs: canManageJobs(normalized)
    };
  }

  function canViewSection(sectionId, role) {
    const id = String(sectionId || '').trim();
    if (id === 'me' || id === 'settings') return true;
    const moduleKey = getModuleForSection(id);
    if (moduleKey) return canViewModule(moduleKey, role, getRequiredModuleAccess(id));
    const minimum = SECTION_RULES[id] || 'worker';
    return hasMinRole(role, minimum);
  }

  function getVisibleModules(role) {
    return Object.values(MODULES).sort((a, b) => a.sortOrder - b.sortOrder).filter((module) => canViewModule(module.key, role, 'view'));
  }

  function getDefaultSectionForModule(moduleKey, role) {
    const module = MODULES[String(moduleKey || '').trim().toLowerCase()];
    if (!module || !canViewModule(module.key, role, 'view')) return null;
    if (canViewSection(module.defaultSection, role)) return module.defaultSection;
    const candidate = Object.keys(SECTION_MODULES).find((section) => SECTION_MODULES[section] === module.key && canViewSection(section, role));
    return candidate || null;
  }

  function getDefaultSectionForRole(role) {
    for (const module of getVisibleModules(role)) {
      const section = getDefaultSectionForModule(module.key, role);
      if (section) return section;
    }
    return 'me';
  }

  function getDeniedMessage(sectionId, role) {
    const moduleKey = getModuleForSection(sectionId);
    if (moduleKey) {
      const actual = getModuleAccess(moduleKey, role);
      const required = getRequiredModuleAccess(sectionId);
      return `${getRoleLabel(role)} has ${actual} access to ${MODULES[moduleKey].label}. ${required} access is required for ${sectionId}.`;
    }
    const min = SECTION_RULES[String(sectionId || '').trim()] || 'worker';
    return `${getRoleLabel(role)} cannot open #${sectionId}. ${getRoleLabel(min)} access is required.`;
  }

  window.YWISecurity = {
    ROLE_RANK, ACCESS_RANK, MODULES, SECTION_MODULES, SECTION_ACCESS, SECTION_RULES,
    normalizeRole, normalizeAccess, roleRank, hasMinRole, accessRank, accessAtLeast,
    setModulePermissions, clearModulePermissions, getModulePermissionState, getModuleAccess, canViewModule,
    getModuleForSection, getRequiredModuleAccess, getVisibleModules, getDefaultSectionForModule,
    canReviewSubmissions, canViewCrew, canViewAdminDirectory, canManageAdminDirectory, canManageJobs, canViewPerson,
    getRoleLabel, getAccessProfile, canViewSection, getDefaultSectionForRole, getDeniedMessage
  };
})();

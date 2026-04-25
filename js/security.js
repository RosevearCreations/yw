/* File: js/security.js
   Brief description: Shared role and security helper module.
   Centralizes role ranks, tier checks, section guards, and people-visibility rules
   for workers, supervisors, job admins, HSE, and admins.
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

  const SECTION_RULES = {
    toolbox: 'worker',
    ppe: 'worker',
    firstaid: 'worker',
    inspect: 'worker',
    drill: 'worker',
    me: 'worker',
    settings: 'worker',
    crew: 'supervisor',
    log: 'worker',
    reports: 'supervisor',
    hseops: 'worker',
    admin: 'admin',
    jobs: 'worker',
    equipment: 'worker'
  };

  function normalizeRole(role) {
    const clean = String(role || 'employee').trim().toLowerCase() || 'employee';
    if (clean === 'worker' || clean === 'staff') return 'employee';
    return clean;
  }

  function roleRank(role) {
    return ROLE_RANK[normalizeRole(role)] || 0;
  }

  function hasMinRole(role, minimumRole) {
    return roleRank(role) >= roleRank(minimumRole);
  }

  function canReviewSubmissions(role) {
    return roleRank(role) >= roleRank('site_leader');
  }

  function canViewCrew(role) {
    return roleRank(role) >= roleRank('supervisor');
  }

  function canViewAdminDirectory(role) {
    return roleRank(role) >= roleRank('supervisor');
  }

  function canManageJobs(role) {
    return roleRank(role) >= roleRank('supervisor');
  }

  function canManageAdminDirectory(role) {
    return roleRank(role) >= roleRank('admin');
  }

  function canViewPerson(viewerRole, targetRole) {
    const viewer = normalizeRole(viewerRole);
    const target = normalizeRole(targetRole);

    if (viewer === 'admin') return true;
    if (viewer === target) return true;

    if (viewer === 'supervisor') {
      return roleRank(target) < roleRank('supervisor');
    }

    if (viewer === 'hse' || viewer === 'job_admin') {
      return roleRank(target) < roleRank('admin');
    }

    return false;
  }

  function getRoleLabel(role) {
    const labels = {
      worker: 'Employee',
      employee: 'Employee',
      staff: 'Employee',
      onsite_admin: 'Onsite Admin',
      site_leader: 'Site Leader',
      supervisor: 'Supervisor',
      hse: 'HSE',
      job_admin: 'Job Admin',
      admin: 'Admin'
    };
    return labels[normalizeRole(role)] || 'Employee';
  }

  function getAccessProfile(role) {
    const normalized = normalizeRole(role);
    return {
      role: normalized,
      roleLabel: getRoleLabel(normalized),
      rank: roleRank(normalized),
      canReviewSubmissions: canReviewSubmissions(normalized),
      canViewCrew: canViewCrew(normalized),
      canViewAdminDirectory: canViewAdminDirectory(normalized),
      canManageAdminDirectory: canManageAdminDirectory(normalized),
      canManageJobs: canManageJobs(normalized)
    };
  }

  function canViewSection(sectionId, role) {
    const minimum = SECTION_RULES[String(sectionId || '').trim()] || 'worker';
    return hasMinRole(role, minimum);
  }

  function getDefaultSectionForRole(role) {
    const normalized = normalizeRole(role);
    if (normalized === 'employee' || normalized === 'onsite_admin') return 'toolbox';
    if (normalized === 'supervisor' || normalized === 'hse' || normalized === 'job_admin') return 'crew';
    if (normalized === 'admin') return 'admin';
    return 'toolbox';
  }

  function getDeniedMessage(sectionId, role) {
    const min = SECTION_RULES[String(sectionId || '').trim()] || 'worker';
    return `${getRoleLabel(role)} cannot open #${sectionId}. ${getRoleLabel(min)} access is required.`;
  }

  window.YWISecurity = {
    ROLE_RANK,
    SECTION_RULES,
    normalizeRole,
    roleRank,
    hasMinRole,
    canReviewSubmissions,
    canViewCrew,
    canViewAdminDirectory,
    canManageAdminDirectory,
    canManageJobs,
    canViewPerson,
    getRoleLabel,
    getAccessProfile,
    canViewSection,
    getDefaultSectionForRole,
    getDeniedMessage
  };
})();

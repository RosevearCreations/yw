/* File: js/security.js
   Brief description: Shared role and security helper module.
   Centralizes role ranks, tier checks, route/view rules, and section guards
   so UI modules and routing all follow the same security model.
*/

'use strict';

(function () {
  const ROLE_RANK = {
    worker: 10,
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
    log: 'worker',
    admin: 'supervisor'
  };

  function normalizeRole(role) {
    return String(role || 'worker').trim().toLowerCase() || 'worker';
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

  function canViewAdminDirectory(role) {
    return roleRank(role) >= roleRank('supervisor');
  }

  function canManageAdminDirectory(role) {
    return roleRank(role) >= roleRank('admin');
  }

  function canManageProfiles(role) {
    return roleRank(role) >= roleRank('admin');
  }

  function canManageSites(role) {
    return roleRank(role) >= roleRank('admin');
  }

  function canManageAssignments(role) {
    return roleRank(role) >= roleRank('admin');
  }

  function getRoleLabel(role) {
    const labels = {
      worker: 'Worker',
      staff: 'Employee',
      onsite_admin: 'Onsite Admin',
      site_leader: 'Site Leader',
      supervisor: 'Supervisor',
      hse: 'HSE',
      job_admin: 'Job Admin',
      admin: 'Admin'
    };
    return labels[normalizeRole(role)] || 'Worker';
  }

  function getAccessProfile(role) {
    const normalized = normalizeRole(role);
    return {
      role: normalized,
      roleLabel: getRoleLabel(normalized),
      rank: roleRank(normalized),
      canReviewSubmissions: canReviewSubmissions(normalized),
      canViewAdminDirectory: canViewAdminDirectory(normalized),
      canManageAdminDirectory: canManageAdminDirectory(normalized),
      canManageProfiles: canManageProfiles(normalized),
      canManageSites: canManageSites(normalized),
      canManageAssignments: canManageAssignments(normalized)
    };
  }

  function canViewSection(sectionId, role) {
    const minimum = SECTION_RULES[String(sectionId || '').trim()] || 'worker';
    return hasMinRole(role, minimum);
  }

  function getDefaultSectionForRole(role) {
    if (canViewSection('toolbox', role)) return 'toolbox';
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
    canViewAdminDirectory,
    canManageAdminDirectory,
    canManageProfiles,
    canManageSites,
    canManageAssignments,
    getRoleLabel,
    getAccessProfile,
    canViewSection,
    getDefaultSectionForRole,
    getDeniedMessage
  };
})();

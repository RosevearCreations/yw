export type ModuleKey = 'safety' | 'finance' | 'jobs' | 'admin';
export type ModuleAccessLevel = 'hidden' | 'view' | 'create' | 'approve' | 'manage';

export const MODULE_ACCESS_RANK: Record<ModuleAccessLevel, number> = {
  hidden: 0,
  view: 10,
  create: 20,
  approve: 30,
  manage: 40,
};

const ROLE_DEFAULTS: Record<string, Record<ModuleKey, ModuleAccessLevel>> = {
  employee: { safety: 'create', finance: 'hidden', jobs: 'create', admin: 'hidden' },
  onsite_admin: { safety: 'create', finance: 'hidden', jobs: 'create', admin: 'hidden' },
  site_leader: { safety: 'approve', finance: 'hidden', jobs: 'approve', admin: 'hidden' },
  supervisor: { safety: 'approve', finance: 'view', jobs: 'approve', admin: 'hidden' },
  hse: { safety: 'manage', finance: 'hidden', jobs: 'view', admin: 'hidden' },
  job_admin: { safety: 'view', finance: 'manage', jobs: 'manage', admin: 'hidden' },
  admin: { safety: 'manage', finance: 'manage', jobs: 'manage', admin: 'manage' },
};

export function normalizeRole(role?: unknown) {
  const clean = String(role || 'employee').trim().toLowerCase() || 'employee';
  if (clean === 'worker' || clean === 'staff') return 'employee';
  return clean;
}

export function normalizeModuleAccess(value?: unknown): ModuleAccessLevel {
  const clean = String(value || 'hidden').trim().toLowerCase();
  return (['hidden','view','create','approve','manage'].includes(clean) ? clean : 'hidden') as ModuleAccessLevel;
}

export function fallbackModuleAccess(role: unknown, moduleKey: ModuleKey): ModuleAccessLevel {
  return ROLE_DEFAULTS[normalizeRole(role)]?.[moduleKey] || 'hidden';
}

export function accessAtLeast(actual: unknown, minimum: ModuleAccessLevel = 'view') {
  return MODULE_ACCESS_RANK[normalizeModuleAccess(actual)] >= MODULE_ACCESS_RANK[minimum];
}

export async function effectiveModuleAccess(supabase: any, profile: any, moduleKey: ModuleKey): Promise<ModuleAccessLevel> {
  if (!profile?.id) return 'hidden';
  if (normalizeRole(profile.role) === 'admin') return 'manage';
  try {
    const { data, error } = await supabase.rpc('ywi_effective_module_access', {
      p_profile_id: profile.id,
      p_module_key: moduleKey,
    });
    if (!error && data) return normalizeModuleAccess(data);
  } catch {
    // Schema 159 must be deployed before module enforcement is relied on. The role fallback
    // keeps a schema-158 staging project usable while the migration is being applied.
  }
  return fallbackModuleAccess(profile.role, moduleKey);
}

export async function moduleAccessMap(supabase: any, profile: any) {
  const keys: ModuleKey[] = ['safety','finance','jobs','admin'];
  const pairs = await Promise.all(keys.map(async (key) => [key, await effectiveModuleAccess(supabase, profile, key)] as const));
  return Object.fromEntries(pairs) as Record<ModuleKey, ModuleAccessLevel>;
}

export async function hasModuleAccess(supabase: any, profile: any, moduleKey: ModuleKey, minimum: ModuleAccessLevel = 'view') {
  return accessAtLeast(await effectiveModuleAccess(supabase, profile, moduleKey), minimum);
}

export async function requireModuleAccess(supabase: any, profile: any, moduleKey: ModuleKey, minimum: ModuleAccessLevel = 'view') {
  const actual = await effectiveModuleAccess(supabase, profile, moduleKey);
  if (!accessAtLeast(actual, minimum)) {
    const err = new Error(`${moduleKey[0].toUpperCase()}${moduleKey.slice(1)} module ${minimum} access is required.`) as Error & { status?: number; moduleKey?: string; requiredAccess?: string; actualAccess?: string };
    err.status = 403;
    err.moduleKey = moduleKey;
    err.requiredAccess = minimum;
    err.actualAccess = actual;
    throw err;
  }
  return actual;
}

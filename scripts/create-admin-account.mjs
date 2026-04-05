import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_SITE_ID = process.env.DEFAULT_SITE_ID || '';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMeNow!2026';
const ADMIN_FULL_NAME = process.env.ADMIN_FULL_NAME || 'System Administrator';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'system.admin';
const ADMIN_EMPLOYEE_NUMBER = process.env.ADMIN_EMPLOYEE_NUMBER || 'ADMIN-ROOT-001';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

if (ADMIN_PASSWORD.length < 10) {
  console.error('ADMIN_PASSWORD must be at least 10 characters long.');
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function ensureAdminUser() {
  const list = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = (list.data?.users || []).find((user) => String(user.email || '').toLowerCase() === ADMIN_EMAIL);
  if (existing) {
    const updated = await adminClient.auth.admin.updateUserById(existing.id, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: ADMIN_FULL_NAME,
        role: 'admin',
        employee_number: ADMIN_EMPLOYEE_NUMBER,
        staff_tier: 'admin'
      }
    });
    if (updated.error) throw updated.error;
    return existing.id;
  }
  const created = await adminClient.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: ADMIN_FULL_NAME,
      role: 'admin',
      employee_number: ADMIN_EMPLOYEE_NUMBER,
      staff_tier: 'admin'
    }
  });
  if (created.error) throw created.error;
  return created.data.user.id;
}

async function ensureAdminProfile(userId) {
  const now = new Date().toISOString();
  const payload = {
    id: userId,
    email: ADMIN_EMAIL,
    full_name: ADMIN_FULL_NAME,
    username: ADMIN_USERNAME,
    role: 'admin',
    is_active: true,
    email_verified: true,
    phone_verified: false,
    employment_status: 'active',
    staff_tier: 'admin',
    seniority_level: 'executive',
    employee_number: ADMIN_EMPLOYEE_NUMBER,
    password_login_ready: true,
    account_setup_completed_at: now,
    onboarding_completed_at: now,
    updated_at: now,
  };
  const result = await adminClient.from('profiles').upsert(payload, { onConflict: 'id' }).select('id, role, email').single();
  if (result.error) throw result.error;
  if (DEFAULT_SITE_ID) {
    await adminClient.from('site_assignments').upsert({
      site_id: DEFAULT_SITE_ID,
      profile_id: userId,
      assignment_role: 'admin',
      is_primary: true,
      updated_at: now,
    }, { onConflict: 'site_id,profile_id' });
  }
}

const userId = await ensureAdminUser();
await ensureAdminProfile(userId);
console.log(`Administrator ready: ${ADMIN_EMAIL} (${userId})`);
console.log('Change the password immediately after first sign-in.');

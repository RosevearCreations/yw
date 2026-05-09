import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_SITE_ID = process.env.DEFAULT_SITE_ID || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const accounts = [
  {
    email: 'veardev@live.ca',
    password: 'YwiAdmin!2026#Start',
    full_name: 'Vear Dev Admin',
    role: 'admin',
    username: 'veardev.admin',
    employee_number: 'ADMIN-001'
  },
  {
    email: 'veardev@gmail.com',
    password: 'YwiWorker!2026#Start',
    full_name: 'Vear Dev Employee',
    role: 'employee',
    username: 'veardev.employee',
    employee_number: 'EMP-001'
  }
];

async function ensureUser(account) {
  const list = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = (list.data?.users || []).find((user) => String(user.email || '').toLowerCase() === account.email.toLowerCase());
  if (existing) {
    await adminClient.auth.admin.updateUserById(existing.id, {
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: account.full_name }
    });
    return existing.id;
  }
  const created = await adminClient.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { full_name: account.full_name }
  });
  if (created.error) throw created.error;
  return created.data.user.id;
}

async function ensureProfile(userId, account) {
  const payload = {
    id: userId,
    email: account.email,
    full_name: account.full_name,
    username: account.username,
    role: account.role,
    is_active: true,
    email_verified: true,
    password_login_ready: true,
    account_setup_completed_at: new Date().toISOString(),
    onboarding_completed_at: new Date().toISOString(),
    employee_number: account.employee_number,
    updated_at: new Date().toISOString()
  };
  const result = await adminClient.from('profiles').upsert(payload, { onConflict: 'id' }).select('id').single();
  if (result.error) throw result.error;
  if (DEFAULT_SITE_ID) {
    await adminClient.from('site_assignments').upsert({
      site_id: DEFAULT_SITE_ID,
      profile_id: userId,
      assignment_role: account.role === 'admin' ? 'admin' : 'employee',
      is_primary: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'site_id,profile_id' });
  }
}

for (const account of accounts) {
  const userId = await ensureUser(account);
  await ensureProfile(userId, account);
  console.log(`Prepared ${account.email} (${account.role})`);
}

console.log('Temporary passwords:');
console.log('veardev@live.ca -> YwiAdmin!2026#Start');
console.log('veardev@gmail.com -> YwiWorker!2026#Start');
console.log('Change both passwords immediately after first sign-in.');

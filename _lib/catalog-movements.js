
export async function insertCatalogMovement(env, movement) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/catalog_inventory_movements`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify([{...movement, updated_at: new Date().toISOString()}])
  });
  if (!res.ok) return { ok:false, error: await res.text() };
  const rows = await res.json().catch(()=>[]);
  return { ok:true, movement: Array.isArray(rows) ? rows[0] || null : null };
}

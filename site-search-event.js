// File: /functions/api/site-search-event.js
// Brief description: Records lightweight public site-search analytics without blocking search UX.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function normalizeText(value) {
  return String(value || '').trim();
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: true, skipped: true });
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const searchTerm = normalizeText(body.search_term).slice(0, 200);
  if (!searchTerm) return json({ ok: false, error: 'search_term is required.' }, 400);

  try {
    await env.DB.prepare(`
      INSERT INTO site_search_events (
        search_term,
        result_count,
        path,
        created_at
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      searchTerm,
      Number(body.result_count || 0),
      normalizeText(body.path) || '/search/'
    ).run();
  } catch {
    return json({ ok: true, skipped: true });
  }

  return json({ ok: true });
}

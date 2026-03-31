/* File: api/auth/bootstrap-admin.js
   Brief description: Compatibility JSON endpoint for older cached shells that still call
   /api/auth/bootstrap-admin on the frontend host. Returns JSON instead of an HTML 404 and
   optionally proxies to the Supabase bootstrap-admin Edge Function when configured.
*/

export default async function handler(req, res) {
  const supabaseUrl = process.env.SB_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.SB_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const target = supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/bootstrap-admin` : '';

  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, compatibility: true, message: 'Use POST for bootstrap-admin compatibility calls.' });
  }

  try {
    if (target) {
      const authHeader = req.headers.authorization || req.headers.Authorization || (anonKey ? `Bearer ${anonKey}` : '');
      const upstream = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(anonKey ? { apikey: anonKey } : {}),
          ...(authHeader ? { Authorization: authHeader } : {})
        },
        body: JSON.stringify(req.body || {})
      });
      const text = await upstream.text();
      const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
      res.status(upstream.status || 200);
      res.setHeader('Content-Type', contentType);
      return res.send(text);
    }
  } catch (error) {
    return res.status(200).json({
      ok: false,
      compatibility: true,
      message: 'Compatibility bootstrap route failed upstream. Reload the app so the latest shell uses the Supabase Edge Function directly.',
      error: error?.message || 'Upstream bootstrap proxy failed.'
    });
  }

  return res.status(200).json({
    ok: false,
    compatibility: true,
    message: 'Compatibility bootstrap route responded locally. Reload the app so the latest shell uses the Supabase Edge Function directly.',
    route: '/api/auth/bootstrap-admin'
  });
}

/* File: api/auth/admin-manage.js
   Brief description: Compatibility JSON endpoint for admin-manage calls when the live
   frontend is newer than the deployed Supabase Edge Function set, or when direct
   browser calls to the function URL stall or fail. Proxies to the Supabase
   admin-manage function when available and always returns JSON instead of HTML.
*/

export default async function handler(req, res) {
  const supabaseUrl = process.env.SB_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.SB_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const target = supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/admin-manage` : '';

  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, compatibility: true, message: 'Use POST for admin-manage compatibility calls.' });
  }

  try {
    if (target) {
      const authHeader = req.headers.authorization || req.headers.Authorization || '';
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
      message: 'Compatibility admin-manage route failed upstream. Deploy or redeploy the Supabase function set and reload the app.',
      error: error?.message || 'Upstream admin-manage proxy failed.'
    });
  }

  return res.status(200).json({
    ok: false,
    compatibility: true,
    message: 'Compatibility admin-manage route responded locally. Deploy or redeploy the Supabase function set and reload the app.',
    route: '/api/auth/admin-manage'
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).send('ok');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = process.env.SB_URL || process.env.SUPABASE_URL || 'https://jmqvkgiqlimdhcofwkxr.supabase.co';
  const targetUrl = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/review-list`;
  const headers = {
    'Content-Type': 'application/json',
  };
  if (req.headers.authorization) headers.Authorization = req.headers.authorization;
  if (req.headers.apikey) headers.apikey = req.headers.apikey;

  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body || {}),
    });
    const raw = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(raw);
  } catch (error) {
    res.status(500).json({ ok: false, error: error?.message || 'Review proxy failed' });
  }
}

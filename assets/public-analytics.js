(function attachRosieAnalytics(globalScope) {
  const API = '/api/analytics/ingest';
  const STORAGE = {
    visitor: 'rosie_analytics_visitor_id',
    session: 'rosie_analytics_session_id',
    startedAt: 'rosie_analytics_started_at',
    cart: 'rosie_analytics_last_cart'
  };
  const state = { pageStartedAt: Date.now(), lastHeartbeatAt: 0, started: false };

  function uuid() {
    if (globalScope.crypto?.randomUUID) return globalScope.crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
  function getOrCreate(key, rotateHours) {
    try {
      const existing = localStorage.getItem(key);
      const startedAt = Number(localStorage.getItem(`${key}:at`) || 0);
      if (existing && (!rotateHours || (Date.now() - startedAt) < rotateHours * 3600000)) return existing;
      const value = uuid();
      localStorage.setItem(key, value);
      localStorage.setItem(`${key}:at`, String(Date.now()));
      return value;
    } catch { return uuid(); }
  }
  function safeLocal(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function setLocal(key, value) { try { localStorage.setItem(key, value); } catch {} }
  function getCartSnapshot() {
    const candidates = ['rosie_cart', 'rosie_gift_cart', 'gift_cart', 'cart'];
    for (const key of candidates) {
      const raw = safeLocal(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return { key, item_count: parsed.length, raw: parsed.slice(0, 10) };
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length) return { key, item_count: Array.isArray(parsed.items) ? parsed.items.length : Object.keys(parsed).length, raw: parsed };
      } catch {
        if (raw) return { key, item_count: 1, raw: String(raw).slice(0, 500) };
      }
    }
    return null;
  }
  async function post(event_type, payload = {}, extra = {}) {
    const visitor_id = getOrCreate(STORAGE.visitor, 24 * 365 * 5);
    const session_id = getOrCreate(STORAGE.session, 12);
    const body = {
      visitor_id,
      session_id,
      event_type,
      page_path: location.pathname + location.search,
      page_title: document.title || '',
      referrer: document.referrer || '',
      locale: navigator.language || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      screen: `${globalScope.screen?.width || 0}x${globalScope.screen?.height || 0}`,
      source: new URLSearchParams(location.search).get('utm_source') || '',
      campaign: new URLSearchParams(location.search).get('utm_campaign') || '',
      payload,
      ...extra
    };
    try {
      await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true, cache: 'no-store' });
    } catch {}
  }
  function maybeTrackCart() {
    const snapshot = getCartSnapshot();
    const now = JSON.stringify(snapshot || null);
    const prev = safeLocal(STORAGE.cart);
    if (now !== prev) {
      setLocal(STORAGE.cart, now);
      if (snapshot) post('cart_snapshot', { cart_key: snapshot.key, item_count: snapshot.item_count, snapshot: snapshot.raw });
    }
  }
  function start() {
    if (state.started) return;
    state.started = true;
    setLocal(STORAGE.startedAt, String(Date.now()));
    post('page_view', { path: location.pathname, search: location.search, hash: location.hash || '' });
    maybeTrackCart();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        post('page_exit', { duration_ms: Date.now() - state.pageStartedAt });
      } else {
        state.pageStartedAt = Date.now();
        post('page_focus', {});
      }
    });
    globalScope.addEventListener('beforeunload', () => {
      post('page_exit', { duration_ms: Date.now() - state.pageStartedAt });
    });
    setInterval(() => {
      state.lastHeartbeatAt = Date.now();
      maybeTrackCart();
      post('heartbeat', { duration_ms: Date.now() - state.pageStartedAt, online: true });
    }, 30000);
  }

  globalScope.RosieAnalytics = {
    start,
    track(event_type, payload = {}, extra = {}) { return post(event_type, payload, extra); },
    trackCheckout(stateName, payload = {}) { return post('checkout_progress', payload, { checkout_state: stateName || '' }); },
    trackCart(payload = {}) { return post('cart_snapshot', payload); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);

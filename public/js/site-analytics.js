// File: /public/js/site-analytics.js
// Brief description: Tracks page views, H1 usage, cart abandonment, searches, and session journeys for admin analytics.

(function () {
  const VISITOR_KEY = 'dd_visitor_token';
  const SESSION_KEY = 'dd_browser_session_token';
  const CART_KEY = 'dd_cart';
  function getVisitorToken() { try { let token = localStorage.getItem(VISITOR_KEY); if (!token) { token = crypto.randomUUID(); localStorage.setItem(VISITOR_KEY, token); } return token; } catch { return crypto.randomUUID(); } }
  function getBrowserSessionToken() { try { let token = sessionStorage.getItem(SESSION_KEY); if (!token) { token = crypto.randomUUID(); sessionStorage.setItem(SESSION_KEY, token); } return token; } catch { return crypto.randomUUID(); } }
  function safeCartSummary() { try { const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); const items = Array.isArray(parsed) ? parsed : []; return { cart_count: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0), cart_value_cents: items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.price_cents || 0)), 0) }; } catch { return { cart_count: 0, cart_value_cents: 0 }; } }
  async function post(url, body) { try { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch {} }
  const visitor_token = getVisitorToken(); const browser_session_token = getBrowserSessionToken(); const path = `${window.location.pathname}`; const query_string = window.location.search || '';
  function firstH1() { const el = document.querySelector('h1'); return el ? String(el.textContent || '').trim() : ''; }
  window.DDAnalytics = {
    visitor_token,
    browser_session_token,
    trackVisit(event_type = 'page_view', meta = null) { return post('/api/track/visit', { visitor_token, browser_session_token, path, query_string, referrer: document.referrer || '', page_title: document.title || '', page_h1: firstH1(), event_type, meta }); },
    trackCart(event_type, extra = {}) { const cart = safeCartSummary(); return post('/api/track/cart', { visitor_token, browser_session_token, event_type, path, ...cart, ...extra }); },
    trackSearch(search_term, result_count = 0) { return post('/api/track/visit', { visitor_token, browser_session_token, path, query_string, page_title: document.title || '', page_h1: firstH1(), event_type: 'search', meta: { search_term, result_count } }); }
  };
  document.addEventListener('DOMContentLoaded', () => { window.DDAnalytics.trackVisit('page_view'); });
  window.addEventListener('beforeunload', () => { if (!/\/checkout\/confirmation\//.test(window.location.pathname)) { const cart = safeCartSummary(); if (cart.cart_count > 0) { try { navigator.sendBeacon('/api/track/cart', new Blob([JSON.stringify({ visitor_token, browser_session_token, event_type: window.location.pathname.includes('/checkout') ? 'cart_abandoned' : 'cart_active_exit', path, ...cart })], { type: 'application/json' })); } catch {} } } });
})();

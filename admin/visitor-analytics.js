import { getAdminUserFromRequest, getDb, jsonResponse } from "../_lib/adminAudit.js";

function json(data, status = 200) { return jsonResponse(data, status); }
function normalizeResults(result) { return Array.isArray(result?.results) ? result.results : []; }
async function safeFirst(db, sql, ...bindings){ try{ return await db.prepare(sql).bind(...bindings).first(); }catch{ return null; } }
async function safeAll(db, sql, ...bindings){ try{ return normalizeResults(await db.prepare(sql).bind(...bindings).all()); }catch{ return []; } }

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);
  const url = new URL(request.url);
  const sinceDays = Math.max(1, Math.min(120, Number(url.searchParams.get('days') || 30)));

  const summary = await safeFirst(db, `
    SELECT
      (SELECT COUNT(*) FROM site_visitors WHERE first_seen_at >= datetime('now', '-' || ? || ' days')) AS unique_visitors,
      (SELECT COUNT(*) FROM site_page_views WHERE created_at >= datetime('now', '-' || ? || ' days')) AS page_views,
      (SELECT COUNT(*) FROM site_search_events WHERE created_at >= datetime('now', '-' || ? || ' days')) AS searches,
      (SELECT COUNT(*) FROM cart_activity WHERE event_type = 'cart_abandoned' AND created_at >= datetime('now', '-' || ? || ' days')) AS abandoned_carts,
      (SELECT COUNT(*) FROM cart_activity WHERE event_type = 'checkout_started' AND created_at >= datetime('now', '-' || ? || ' days')) AS checkout_starts,
      (SELECT COUNT(*) FROM site_visitor_sessions WHERE started_at >= datetime('now', '-' || ? || ' days')) AS visitor_sessions,
      (SELECT COUNT(*) FROM orders WHERE created_at >= datetime('now', '-' || ? || ' days')) AS orders_created,
      (SELECT COUNT(*) FROM orders WHERE LOWER(COALESCE(payment_status,'')) IN ('paid','completed','captured','partially_refunded','refunded') AND created_at >= datetime('now', '-' || ? || ' days')) AS paid_orders
  `, sinceDays, sinceDays, sinceDays, sinceDays, sinceDays, sinceDays, sinceDays, sinceDays) || {};

  const topPaths = await safeAll(db, `SELECT path, COUNT(*) AS view_count FROM site_page_views WHERE created_at >= datetime('now', '-' || ? || ' days') GROUP BY path ORDER BY view_count DESC, path ASC LIMIT 20`, sinceDays);
  const countries = await safeAll(db, `SELECT COALESCE(country, 'Unknown') AS country, COUNT(*) AS visitor_count FROM site_visitors WHERE first_seen_at >= datetime('now', '-' || ? || ' days') GROUP BY COALESCE(country, 'Unknown') ORDER BY visitor_count DESC, country ASC LIMIT 20`, sinceDays);
  const daily = await safeAll(db, `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS page_views FROM site_page_views WHERE created_at >= datetime('now', '-' || ? || ' days') GROUP BY substr(created_at, 1, 10) ORDER BY day ASC`, sinceDays);
  const topSearches = await safeAll(db, `SELECT search_term, COUNT(*) AS search_count, SUM(result_count) AS total_results FROM site_search_events WHERE created_at >= datetime('now', '-' || ? || ' days') GROUP BY search_term ORDER BY search_count DESC, search_term ASC LIMIT 20`, sinceDays);
  const zeroResultSearches = await safeAll(db, `SELECT search_term, COUNT(*) AS zero_result_count FROM site_search_events WHERE COALESCE(result_count,0) = 0 AND created_at >= datetime('now', '-' || ? || ' days') GROUP BY search_term ORDER BY zero_result_count DESC, search_term ASC LIMIT 20`, sinceDays);
  const topReferrers = await safeAll(db, `SELECT COALESCE(referrer_host, 'Direct / Unknown') AS referrer_host, COUNT(*) AS visitor_count FROM site_visitors WHERE first_seen_at >= datetime('now', '-' || ? || ' days') GROUP BY COALESCE(referrer_host, 'Direct / Unknown') ORDER BY visitor_count DESC, referrer_host ASC LIMIT 20`, sinceDays);
  const topEntryPaths = await safeAll(db, `SELECT COALESCE(entry_path, '/') AS entry_path, COUNT(*) AS session_count FROM site_visitor_sessions WHERE started_at >= datetime('now', '-' || ? || ' days') GROUP BY COALESCE(entry_path, '/') ORDER BY session_count DESC, entry_path ASC LIMIT 20`, sinceDays);
const topProductPaths = await safeAll(db, `SELECT COALESCE(path, '/') AS path, COUNT(*) AS view_count FROM site_page_views WHERE path LIKE '/product/%' AND viewed_at >= datetime('now', '-' || ? || ' days') GROUP BY COALESCE(path, '/') ORDER BY view_count DESC, path ASC LIMIT 20`, sinceDays);
  const topOrderedProducts = await safeAll(db, `SELECT COALESCE(oi.product_name, p.name, 'Unknown product') AS product_name, COUNT(*) AS line_count, SUM(COALESCE(oi.quantity,0)) AS quantity_ordered, SUM(COALESCE(oi.line_total_cents,0)) AS revenue_cents FROM order_items oi LEFT JOIN products p ON p.product_id = oi.product_id LEFT JOIN orders o ON o.order_id = oi.order_id WHERE COALESCE(o.created_at, oi.created_at) >= datetime('now', '-' || ? || ' days') GROUP BY COALESCE(oi.product_name, p.name, 'Unknown product') ORDER BY revenue_cents DESC, quantity_ordered DESC LIMIT 20`, sinceDays);
  const abandoned = await safeAll(db, `SELECT visitor_token, path, cart_count, cart_value_cents, created_at, meta_json FROM cart_activity WHERE event_type = 'cart_abandoned' AND created_at >= datetime('now', '-' || ? || ' days') ORDER BY created_at DESC LIMIT 30`, sinceDays);
  const recentSessions = await safeAll(db, `SELECT svs.site_visitor_session_id, COALESCE(svs.country, 'Unknown') AS country, svs.city, svs.entry_path, svs.last_path, svs.page_view_count, svs.event_count, svs.is_checkout_started, svs.is_abandoned_cart, svs.started_at, svs.last_seen_at FROM site_visitor_sessions svs ORDER BY svs.last_seen_at DESC LIMIT 50`);
  const funnelByDay = await safeAll(db, `
    SELECT day,
           SUM(visitor_sessions) AS visitor_sessions,
           SUM(checkout_starts) AS checkout_starts,
           SUM(orders_created) AS orders_created,
           SUM(paid_orders) AS paid_orders
    FROM (
      SELECT substr(started_at, 1, 10) AS day, COUNT(*) AS visitor_sessions, 0 AS checkout_starts, 0 AS orders_created, 0 AS paid_orders
      FROM site_visitor_sessions
      WHERE started_at >= datetime('now', '-' || ? || ' days')
      GROUP BY substr(started_at, 1, 10)
      UNION ALL
      SELECT substr(created_at, 1, 10) AS day, 0, COUNT(*) AS checkout_starts, 0, 0
      FROM cart_activity
      WHERE event_type = 'checkout_started' AND created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY substr(created_at, 1, 10)
      UNION ALL
      SELECT substr(created_at, 1, 10) AS day, 0, 0, COUNT(*) AS orders_created, 0
      FROM orders
      WHERE created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY substr(created_at, 1, 10)
      UNION ALL
      SELECT substr(created_at, 1, 10) AS day, 0, 0, 0, COUNT(*) AS paid_orders
      FROM orders
      WHERE LOWER(COALESCE(payment_status,'')) IN ('paid','completed','captured','partially_refunded','refunded')
        AND created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY substr(created_at, 1, 10)
    )
    GROUP BY day
    ORDER BY day ASC
  `, sinceDays, sinceDays, sinceDays, sinceDays);

  return json({
    ok: true,
    requested_by: adminUser,
    range_days: sinceDays,
    summary: {
      unique_visitors: Number(summary?.unique_visitors || 0),
      visitor_sessions: Number(summary?.visitor_sessions || 0),
      page_views: Number(summary?.page_views || 0),
      searches: Number(summary?.searches || 0),
      abandoned_carts: Number(summary?.abandoned_carts || 0),
      checkout_starts: Number(summary?.checkout_starts || 0),
      orders_created: Number(summary?.orders_created || 0),
      paid_orders: Number(summary?.paid_orders || 0)
    },
    funnel: {
      checkout_to_order_rate: Number(summary?.checkout_starts || 0) > 0 ? Number((Number(summary?.orders_created || 0) / Number(summary?.checkout_starts || 0)).toFixed(4)) : 0,
      order_to_paid_rate: Number(summary?.orders_created || 0) > 0 ? Number((Number(summary?.paid_orders || 0) / Number(summary?.orders_created || 0)).toFixed(4)) : 0,
      abandonment_rate: Number(summary?.checkout_starts || 0) > 0 ? Number((Number(summary?.abandoned_carts || 0) / Number(summary?.checkout_starts || 0)).toFixed(4)) : 0
    },
    funnel_by_day: funnelByDay.map((row) => ({ day: row.day || '', visitor_sessions: Number(row.visitor_sessions || 0), checkout_starts: Number(row.checkout_starts || 0), orders_created: Number(row.orders_created || 0), paid_orders: Number(row.paid_orders || 0) })),
    daily: daily.map((row) => ({ day: row.day || '', page_views: Number(row.page_views || 0) })),
    top_paths: topPaths.map((row) => ({ path: row.path || '/', view_count: Number(row.view_count || 0) })),
    countries: countries.map((row) => ({ country: row.country || 'Unknown', visitor_count: Number(row.visitor_count || 0) })),
    top_searches: topSearches.map((row) => ({ search_term: row.search_term || '', search_count: Number(row.search_count || 0), total_results: Number(row.total_results || 0) })),
    zero_result_searches: zeroResultSearches.map((row) => ({ search_term: row.search_term || '', zero_result_count: Number(row.zero_result_count || 0) })),
    top_referrers: topReferrers.map((row) => ({ referrer_host: row.referrer_host || 'Direct / Unknown', visitor_count: Number(row.visitor_count || 0) })),
    top_entry_paths: topEntryPaths.map((row) => ({ entry_path: row.entry_path || '/', session_count: Number(row.session_count || 0) })),
    top_product_paths: topProductPaths.map((row) => ({ path: row.path || '/', view_count: Number(row.view_count || 0) })),
    top_ordered_products: topOrderedProducts.map((row) => ({ product_name: row.product_name || 'Unknown product', line_count: Number(row.line_count || 0), quantity_ordered: Number(row.quantity_ordered || 0), revenue_cents: Number(row.revenue_cents || 0) })),
    abandoned_carts: abandoned.map((row) => ({ visitor_token: row.visitor_token || '', path: row.path || '', cart_count: Number(row.cart_count || 0), cart_value_cents: Number(row.cart_value_cents || 0), created_at: row.created_at || null, meta_json: row.meta_json || null })),
    recent_sessions: recentSessions.map((row) => ({ site_visitor_session_id: Number(row.site_visitor_session_id || 0), country: row.country || 'Unknown', city: row.city || '', entry_path: row.entry_path || '', last_path: row.last_path || '', page_view_count: Number(row.page_view_count || 0), event_count: Number(row.event_count || 0), is_checkout_started: Number(row.is_checkout_started || 0), is_abandoned_cart: Number(row.is_abandoned_cart || 0), started_at: row.started_at || null, last_seen_at: row.last_seen_at || null }))
  });
}

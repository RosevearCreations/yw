import { captureRuntimeIncident } from "./_lib/adminAudit.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=120",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    }
  });
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

async function runProductQuery(db, sql, bindings = []) {
  const stmt = db.prepare(sql);
  const result = bindings.length ? await stmt.bind(...bindings).all() : await stmt.all();
  return normalizeResults(result);
}

function shapeProducts(rows) {
  return rows.map((row) => ({ ...row, seo_h1: row.h1_override || row.name || "" }));
}

function buildFilterGroups(products) {
  const group = (values) => Object.entries(values).map(([label, count]) => ({ label, count })).sort((a, b) => a.label.localeCompare(b.label));
  const categories = {};
  const colors = {};
  const productTypes = {};
  products.forEach((product) => {
    const category = normalizeText(product.product_category);
    const color = normalizeText(product.color_name);
    const productType = normalizeText(product.product_type);
    if (category) categories[category] = (categories[category] || 0) + 1;
    if (color) colors[color] = (colors[color] || 0) + 1;
    if (productType) productTypes[productType] = (productTypes[productType] || 0) + 1;
  });
  return {
    categories: group(categories),
    colors: group(colors),
    product_types: group(productTypes)
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB || env.DD_DB;
  const url = new URL(request.url);
  const q = normalizeText(url.searchParams.get('q')).toLowerCase();
  const product_type = normalizeText(url.searchParams.get('product_type')).toLowerCase();
  const min_price_cents = Number.isInteger(Number(url.searchParams.get('min_price_cents'))) ? Number(url.searchParams.get('min_price_cents')) : null;
  const max_price_cents = Number.isInteger(Number(url.searchParams.get('max_price_cents'))) ? Number(url.searchParams.get('max_price_cents')) : null;
  const requires_shipping = normalizeText(url.searchParams.get('requires_shipping'));
  const warnings = [];

  if (!db) {
    warnings.push('db_binding_unavailable');
    return json({
      ok: true,
      products: [],
      warning: 'Product database is unavailable right now. Showing an empty live result.',
      summary: { total_products: 0, authority: 'binding_unavailable' },
      filter_groups: { categories: [], colors: [], product_types: [] },
      diagnostics: { warnings, query: q, product_type, min_price_cents, max_price_cents, requires_shipping }
    });
  }

  const clauses = [`p.status = 'active'`];
  const bindings = [];
  if (q) {
    clauses.push(`(
      LOWER(COALESCE(p.name, '')) LIKE ? OR
      LOWER(COALESCE(p.short_description, '')) LIKE ? OR
      LOWER(COALESCE(p.description, '')) LIKE ? OR
      LOWER(COALESCE(p.sku, '')) LIKE ? OR
      LOWER(COALESCE(p.product_category, '')) LIKE ? OR
      LOWER(COALESCE(p.color_name, '')) LIKE ? OR
      LOWER(COALESCE(ps.keywords, '')) LIKE ?
    )`);
    const like = `%${q}%`;
    bindings.push(like, like, like, like, like, like, like);
  }
  if (['physical', 'digital'].includes(product_type)) {
    clauses.push(`p.product_type = ?`);
    bindings.push(product_type);
  }
  if (min_price_cents != null) { clauses.push(`p.price_cents >= ?`); bindings.push(min_price_cents); }
  if (max_price_cents != null) { clauses.push(`p.price_cents <= ?`); bindings.push(max_price_cents); }
  if (requires_shipping === '1' || requires_shipping === '0') { clauses.push(`p.requires_shipping = ?`); bindings.push(Number(requires_shipping)); }

  const primarySql = `
    SELECT
      p.product_id, p.product_number, p.slug, p.sku, p.name, p.product_category, p.color_name, p.shipping_code, p.review_status, p.short_description, p.description, p.product_type, p.status,
      p.price_cents, p.compare_at_price_cents, p.currency, p.taxable, p.tax_class_id, p.requires_shipping,
      p.weight_grams, p.inventory_tracking, COALESCE(p.inventory_quantity, 0) AS inventory_quantity, p.digital_file_url, p.featured_image_url,
      p.sort_order, p.created_at, p.updated_at,
      tc.code AS tax_class_code, tc.name AS tax_class_name, COALESCE(tc.rate_percent, tc.tax_rate, 0) AS tax_rate,
      ps.meta_title, ps.meta_description, ps.keywords, ps.h1_override, ps.canonical_url, ps.og_title,
      ps.og_description, ps.og_image_url
    FROM products p
    LEFT JOIN tax_classes tc ON p.tax_class_id = tc.tax_class_id
    LEFT JOIN product_seo ps ON ps.product_id = p.product_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY p.sort_order ASC, p.created_at DESC, p.product_id DESC
  `;

  const fallbackClauses = clauses.map((clause) => clause.replace(/\s+OR\s+LOWER\(COALESCE\(ps\.keywords, ''\)\) LIKE \?/g, ''));
  const fallbackSql = `
    SELECT
      p.product_id, p.product_number, p.slug, p.sku, p.name, p.product_category, p.color_name, p.shipping_code, p.review_status, p.short_description, p.description, p.product_type, p.status,
      p.price_cents, p.compare_at_price_cents, p.currency, p.taxable, p.tax_class_id, p.requires_shipping,
      p.weight_grams, p.inventory_tracking, COALESCE(p.inventory_quantity, 0) AS inventory_quantity, p.digital_file_url, p.featured_image_url,
      p.sort_order, p.created_at, p.updated_at,
      '' AS tax_class_code, '' AS tax_class_name, 0 AS tax_rate,
      '' AS meta_title, '' AS meta_description, '' AS keywords, '' AS h1_override, '' AS canonical_url, '' AS og_title,
      '' AS og_description, '' AS og_image_url
    FROM products p
    WHERE ${fallbackClauses.join(' AND ')}
    ORDER BY p.sort_order ASC, p.created_at DESC, p.product_id DESC
  `;

  try {
    const rows = await runProductQuery(db, primarySql, bindings);
    const products = shapeProducts(rows);
    return json({
      ok: true,
      products,
      summary: { total_products: products.length, authority: 'd1_primary_query' },
      filter_groups: buildFilterGroups(products),
      diagnostics: { warnings, query: q, product_type, min_price_cents, max_price_cents, requires_shipping }
    });
  } catch (primaryError) {
    warnings.push('primary_query_failed');
    await captureRuntimeIncident(env, request, {
      incident_scope: 'public_catalog',
      incident_code: 'products_primary_query_failed',
      severity: 'warning',
      message: 'Primary products query failed. Trying the fallback products query.',
      details: { error: String(primaryError?.message || primaryError || 'Unknown primary query error'), query: q, product_type, min_price_cents, max_price_cents, requires_shipping }
    });

    try {
      const fbBindings = q ? [ `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%` ] : [];
      if (['physical', 'digital'].includes(product_type)) fbBindings.push(product_type);
      if (min_price_cents != null) fbBindings.push(min_price_cents);
      if (max_price_cents != null) fbBindings.push(max_price_cents);
      if (requires_shipping === '1' || requires_shipping === '0') fbBindings.push(Number(requires_shipping));
      const rows = await runProductQuery(db, fallbackSql, fbBindings);
      const products = shapeProducts(rows);
      warnings.push('fallback_query_used');
      return json({
        ok: true,
        products,
        warning: 'Fallback product query used while the richer storefront query recovers.',
        summary: { total_products: products.length, authority: 'd1_fallback_query' },
        filter_groups: buildFilterGroups(products),
        diagnostics: { warnings, query: q, product_type, min_price_cents, max_price_cents, requires_shipping }
      });
    } catch (fallbackError) {
      warnings.push('fallback_query_failed');
      await captureRuntimeIncident(env, request, {
        incident_scope: 'public_catalog',
        incident_code: 'products_fallback_query_failed',
        severity: 'error',
        message: 'Both primary and fallback product queries failed. Returning a safe empty live result.',
        details: {
          primary_error: String(primaryError?.message || primaryError || 'Unknown primary query error'),
          fallback_error: String(fallbackError?.message || fallbackError || 'Unknown fallback query error'),
          query: q,
          product_type,
          min_price_cents,
          max_price_cents,
          requires_shipping
        }
      });
      return json({
        ok: true,
        products: [],
        warning: 'Live product queries are unavailable right now. A safe empty result was returned.',
        error_detail: String(fallbackError?.message || primaryError?.message || 'Unknown error'),
        summary: { total_products: 0, authority: 'error' },
        filter_groups: { categories: [], colors: [], product_types: [] },
        diagnostics: { warnings, query: q, product_type, min_price_cents, max_price_cents, requires_shipping }
      });
    }
  }
}

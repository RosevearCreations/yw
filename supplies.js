// File: /functions/api/supplies.js
// Brief description: Public read endpoint for supplies. It prefers D1 catalog_items rows for
// item_kind='supply' and falls back to the legacy JSON source so outward-facing pages,
// search, and fallback handling share one centralized authority path during migration.

import { captureRuntimeIncident } from "./_lib/adminAudit.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=120',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  });
}

function normalizeText(value) { return String(value || '').trim(); }
function normalizeResults(result) { return Array.isArray(result?.results) ? result.results : []; }
function slugify(value) { return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

function normalizeFromCatalog(row) {
  let source = {};
  try { source = row.source_record_json ? JSON.parse(row.source_record_json) : {}; } catch { source = {}; }
  const rawName = row.name || source.item_name_suggested || source.name || source.display_name || source.title || source.example_image_file || 'Supply';
  return Object.assign({}, source, {
    id: source.id || row.source_key || row.catalog_item_id,
    slug: row.slug || source.slug || slugify(rawName),
    item_name_suggested: source.item_name_suggested || rawName,
    name: rawName,
    category: row.category || source.category || source.consumable_type || '',
    subcategory: row.subcategory || source.subcategory || source.type || '',
    item_type: row.item_type || source.item_type || source.type || '',
    primary_area: row.subcategory || source.primary_area || source.area || '',
    notes: row.notes || source.notes || source.notes_public || source.how_we_use || '',
    image_url: row.image_url || source.image_url || source.image || source.src || '',
    source_key: row.source_key || source.source_key || '',
    updated_at: row.updated_at || null,
    source: 'catalog_items'
  });
}

async function loadJsonFallback(request) {
  try {
    const response = await fetch(new URL('/data/supplies/supplies_items_master.json', request.url).toString(), { cf: { cacheTtl: 0, cacheEverything: false } });
    if (!response.ok) return { items: [], error: `Fallback responded ${response.status}.` };
    const data = await response.json().catch(() => null);
    const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
    return {
      items: items.map((item, index) => Object.assign({}, item, {
        id: item.id || item.item_group_key_strict || item.item_group_key_loose || item.slug || `${slugify(item.item_name_suggested || item.name || 'supply')}-${index + 1}`,
        slug: item.slug || slugify(item.item_name_suggested || item.name || item.example_image_file || 'supply'),
        image_url: item.image_url || item.image || item.src || '',
        source: 'json'
      })),
      error: ''
    };
  } catch (error) {
    return { items: [], error: error?.message || 'Fallback load failed.' };
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB || env.DD_DB;
  const url = new URL(request.url);
  const query = normalizeText(url.searchParams.get('q')).toLowerCase();
  const like = `%${query}%`;
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 500), 1000));
  const warnings = [];
  let items = [];
  let authority = 'empty';

  if (db) {
    try {
      const rows = normalizeResults(await db.prepare(`
        SELECT catalog_item_id, source_key, slug, name, category, subcategory, item_type, short_description,
               notes, image_url, amazon_url, source_record_json, updated_at
        FROM catalog_items
        WHERE item_kind = 'supply'
          AND COALESCE(visible_public, 1) = 1
          AND COALESCE(status, 'active') = 'active'
          AND (
            ? = ''
            OR LOWER(COALESCE(name, '')) LIKE ?
            OR LOWER(COALESCE(category, '')) LIKE ?
            OR LOWER(COALESCE(subcategory, '')) LIKE ?
            OR LOWER(COALESCE(item_type, '')) LIKE ?
            OR LOWER(COALESCE(short_description, '')) LIKE ?
            OR LOWER(COALESCE(notes, '')) LIKE ?
          )
        ORDER BY COALESCE(sort_order, 0) ASC, LOWER(COALESCE(name, '')) ASC
        LIMIT ?
      `).bind(query, like, like, like, like, like, like, limit).all());
      items = rows.map(normalizeFromCatalog);
      if (items.length) authority = 'd1';
    } catch (error) {
      warnings.push('d1_supply_read_failed');
      await captureRuntimeIncident(env, request, {
        incident_scope: 'public_catalog',
        incident_code: 'supply_d1_read_failed',
        severity: 'warning',
        message: 'Supplies D1 read failed. Public JSON fallback was used.',
        details: { error: error?.message || 'Unknown D1 error.', query, limit }
      });
    }
  } else {
    warnings.push('d1_binding_unavailable');
  }

  if (!items.length) {
    const fallback = await loadJsonFallback(request);
    if (fallback.items.length) {
      items = query
        ? fallback.items.filter((item) => JSON.stringify(item).toLowerCase().includes(query)).slice(0, limit)
        : fallback.items.slice(0, limit);
      authority = items.length ? 'json_fallback' : authority;
      if (authority === 'json_fallback') warnings.push('json_fallback_used');
    } else if (fallback.error) {
      warnings.push('json_fallback_unavailable');
      await captureRuntimeIncident(env, request, {
        incident_scope: 'public_catalog',
        incident_code: 'supply_json_fallback_failed',
        severity: 'error',
        message: 'Supplies JSON fallback could not be loaded.',
        details: { error: fallback.error, query, limit }
      });
    }
  }

  const filter_groups = {
    categories: Object.entries(items.reduce((acc, item) => {
      const key = normalizeText(item.category || item.section || '').trim();
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})).map(([label, count]) => ({ label, count })).sort((a, b) => a.label.localeCompare(b.label)),
    types: Object.entries(items.reduce((acc, item) => {
      const key = normalizeText(item.subcategory || item.type || item.item_type || '').trim();
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})).map(([label, count]) => ({ label, count })).sort((a, b) => a.label.localeCompare(b.label))
  };

  return json({
    ok: true,
    asset_origin: 'https://assets.devilndove.com',
    asset_prefix: 'supplies',
    items,
    fallback_used: authority === 'json_fallback',
    diagnostics: { warnings, query, limit },
    summary: {
      total_items: items.length,
      query,
      authority
    },
    filter_groups
  });
}

import { getAdminUserFromRequest, getDb, jsonResponse, normalizeText, auditAdminAction } from "../_lib/adminAudit.js";

function json(data, status = 200) {
  return jsonResponse(data, status, { "Cache-Control": "no-store" });
}

function safeNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchJsonFromSite(request, path) {
  const url = new URL(path, request.url);
  const response = await fetch(url.toString(), {
    cf: { cacheTtl: 0, cacheEverything: false }
  }).catch(() => null);

  if (!response || !response.ok) return null;
  return response.json().catch(() => null);
}

async function fetchMovieJsonBase(request) {
  const paths = [
    "/data/movies/movie_catalog_enriched.v2.json",
    "/assets/movies/movie_catalog_enriched.v2.json",
    "/data/movies/movie_catalog_enriched.json",
    "/assets/movies/movie_catalog_enriched.json"
  ];

  for (const path of paths) {
    const data = await fetchJsonFromSite(request, path);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.movies)) return data.movies;
    if (Array.isArray(data?.titles)) return data.titles;
  }

  return [];
}

function normalizeMovieRow(row, index = 0) {
  const upc = normalizeText(row.upc || row.UPC || row.barcode || row.code);
  const title = normalizeText(row.title || row.name || row.movie_title || row.primaryTitle);
  const originalTitle = normalizeText(row.original_title || row.originalTitle);

  return {
    movie_catalog_id: Number(row.movie_catalog_id || 0),
    upc,
    slug: normalizeText(row.slug || slugify(title || upc || `movie-${index + 1}`)),
    title,
    original_title: originalTitle,
    sort_title: normalizeText(row.sort_title || title || originalTitle || upc || `movie-${index + 1}`),
    summary: normalizeText(row.summary || row.description || row.plot_summary || row.synopsis),
    release_year: normalizeText(row.release_year ?? row.year ?? row.startYear),
    media_format: normalizeText(row.media_format || row.format || "DVD/Blu-ray"),
    genre: normalizeText(row.genre),
    director_names: normalizeText(row.director_names || row.director || row.directors),
    actor_names: normalizeText(row.actor_names || row.actors || row.cast_names || row.cast),
    front_image_url: normalizeText(row.front_image_url || row.front_image || row.image_front),
    back_image_url: normalizeText(row.back_image_url || row.back_image || row.image_back),
    runtime_minutes: normalizeText(row.runtime_minutes),
    studio_name: normalizeText(row.studio_name || row.studio),
    trailer_url: normalizeText(row.trailer_url || row.trailer || row.youtube_url),
    imdb_id: normalizeText(row.imdb_id || row.tconst),
    alternate_identifier: normalizeText(row.alternate_identifier),
    metadata_status: normalizeText(row.metadata_status || "pending"),
    metadata_source: normalizeText(row.metadata_source),
    estimated_value_low_cents: row.estimated_value_low_cents == null ? "" : String(row.estimated_value_low_cents),
    estimated_value_high_cents: row.estimated_value_high_cents == null ? "" : String(row.estimated_value_high_cents),
    estimated_value_currency: normalizeText(row.estimated_value_currency || "CAD"),
    rarity_notes: normalizeText(row.rarity_notes),
    collection_notes: normalizeText(row.collection_notes),
    value_search_url: normalizeText(row.value_search_url),
    status: normalizeText(row.status || "active") || "active",
    featured_rank: row.featured_rank == null || row.featured_rank === "" ? "" : String(row.featured_rank)
  };
}

function mergeMovieRows(baseRow, overlayRow) {
  const merged = { ...baseRow };
  for (const [key, value] of Object.entries(overlayRow || {})) {
    if (value == null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    merged[key] = value;
  }
  return merged;
}

async function tableExists(db, tableName) {
  const row = await db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1`
  ).bind(tableName).first().catch(() => null);
  return !!row?.name;
}

async function ensureMovieTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS movie_catalog (
      movie_catalog_id INTEGER PRIMARY KEY AUTOINCREMENT,
      upc TEXT NOT NULL UNIQUE,
      slug TEXT,
      title TEXT,
      original_title TEXT,
      sort_title TEXT,
      summary TEXT,
      release_year INTEGER,
      media_format TEXT,
      genre TEXT,
      director_names TEXT,
      actor_names TEXT,
      front_image_url TEXT,
      back_image_url TEXT,
      runtime_minutes INTEGER,
      studio_name TEXT,
      trailer_url TEXT,
      imdb_id TEXT,
      alternate_identifier TEXT,
      metadata_status TEXT,
      metadata_source TEXT,
      estimated_value_low_cents INTEGER,
      estimated_value_high_cents INTEGER,
      estimated_value_currency TEXT,
      rarity_notes TEXT,
      collection_notes TEXT,
      value_search_url TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      featured_rank INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const pragma = await db.prepare(`PRAGMA table_info(movie_catalog)`).all().catch(() => ({ results: [] }));
  const existingCols = new Set((pragma.results || []).map((row) => row.name));

  const maybeAdd = async (name, sqlType) => {
    if (!existingCols.has(name)) {
      await db.prepare(`ALTER TABLE movie_catalog ADD COLUMN ${name} ${sqlType}`).run().catch(() => null);
    }
  };

  await maybeAdd("slug", "TEXT");
  await maybeAdd("title", "TEXT");
  await maybeAdd("original_title", "TEXT");
  await maybeAdd("sort_title", "TEXT");
  await maybeAdd("summary", "TEXT");
  await maybeAdd("release_year", "INTEGER");
  await maybeAdd("media_format", "TEXT");
  await maybeAdd("genre", "TEXT");
  await maybeAdd("director_names", "TEXT");
  await maybeAdd("actor_names", "TEXT");
  await maybeAdd("front_image_url", "TEXT");
  await maybeAdd("back_image_url", "TEXT");
  await maybeAdd("runtime_minutes", "INTEGER");
  await maybeAdd("studio_name", "TEXT");
  await maybeAdd("trailer_url", "TEXT");
  await maybeAdd("imdb_id", "TEXT");
  await maybeAdd("alternate_identifier", "TEXT");
  await maybeAdd("metadata_status", "TEXT");
  await maybeAdd("metadata_source", "TEXT");
  await maybeAdd("estimated_value_low_cents", "INTEGER");
  await maybeAdd("estimated_value_high_cents", "INTEGER");
  await maybeAdd("estimated_value_currency", "TEXT");
  await maybeAdd("rarity_notes", "TEXT");
  await maybeAdd("collection_notes", "TEXT");
  await maybeAdd("value_search_url", "TEXT");
  await maybeAdd("status", "TEXT");
  await maybeAdd("featured_rank", "INTEGER");
  await maybeAdd("created_at", "TEXT");
  await maybeAdd("updated_at", "TEXT");
}

async function fetchOverlayRows(db) {
  if (!db) return [];
  const exists = await tableExists(db, "movie_catalog");
  if (!exists) return [];

  await ensureMovieTable(db);

  const result = await db.prepare(`
    SELECT
      movie_catalog_id,
      upc,
      slug,
      title,
      original_title,
      sort_title,
      summary,
      release_year,
      media_format,
      genre,
      director_names,
      actor_names,
      front_image_url,
      back_image_url,
      runtime_minutes,
      studio_name,
      trailer_url,
      imdb_id,
      alternate_identifier,
      metadata_status,
      metadata_source,
      estimated_value_low_cents,
      estimated_value_high_cents,
      estimated_value_currency,
      rarity_notes,
      collection_notes,
      value_search_url,
      status,
      featured_rank
    FROM movie_catalog
    WHERE COALESCE(status, 'active') != 'archived'
    ORDER BY COALESCE(featured_rank, 999999) ASC, LOWER(COALESCE(sort_title, title, upc, '')) ASC
  `).all().catch(() => ({ results: [] }));

  return Array.isArray(result?.results) ? result.results.map(normalizeMovieRow) : [];
}

function matchesQuery(row, q) {
  if (!q) return true;
  const hay = [
    row.upc,
    row.slug,
    row.title,
    row.original_title,
    row.summary,
    row.release_year,
    row.actor_names,
    row.director_names,
    row.genre,
    row.media_format,
    row.studio_name,
    row.imdb_id,
    row.alternate_identifier,
    row.metadata_source,
    row.rarity_notes,
    row.collection_notes,
    row.value_search_url
  ].join(" ").toLowerCase();

  return hay.includes(q);
}

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const adminUser = await getAdminUserFromRequest(request, env);
    if (!adminUser) return json({ ok: false, error: "Unauthorized." }, 401);

    const db = getDb(env);
    if (db) {
      await ensureMovieTable(db);
    }

    const url = new URL(request.url);
    const q = normalizeText(url.searchParams.get("q")).toLowerCase();

    const baseRows = (await fetchMovieJsonBase(request)).map(normalizeMovieRow);
    const overlayRows = await fetchOverlayRows(db);

    const byKey = new Map();

    for (const row of baseRows) {
      const key = normalizeText(row.upc || row.slug);
      if (!key) continue;
      byKey.set(key, row);
    }

    for (const row of overlayRows) {
      const key = normalizeText(row.upc || row.slug);
      if (!key) continue;
      const existing = byKey.get(key);
      byKey.set(key, existing ? mergeMovieRows(existing, row) : row);
    }

    const items = Array.from(byKey.values())
      .filter((row) => matchesQuery(row, q))
      .sort((a, b) =>
        String(a.sort_title || a.title || "").localeCompare(
          String(b.sort_title || b.title || ""),
          undefined,
          { sensitivity: "base" }
        )
      );

    return json({
      ok: true,
      items,
      summary: {
        total_movies: items.length,
        source_of_truth: "movie_catalog_enriched.v2.json with D1 overlay",
        has_db: !!db,
        db_overlay_rows: overlayRows.length
      }
    });
  } catch (error) {
    return json({
      ok: false,
      error: "Movie list failed.",
      details: String(error?.message || error)
    }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const adminUser = await getAdminUserFromRequest(request, env);
    if (!adminUser) return json({ ok: false, error: "Unauthorized." }, 401);

    const db = getDb(env);
    if (!db) {
      return json({
        ok: false,
        error: "Movie editing requires a working D1 binding."
      }, 500);
    }

    await ensureMovieTable(db);

    let body = {};
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON body." }, 400);
    }

    const upc = normalizeText(body.upc);
    const title = normalizeText(body.title);
    const slug = normalizeText(body.slug || slugify(title || upc));
    const status = normalizeText(body.status || "active") || "active";

    if (!upc && !slug) {
      return json({ ok: false, error: "UPC or slug is required." }, 400);
    }

    const payload = {
      upc: upc || slug,
      slug,
      title,
      original_title: normalizeText(body.original_title),
      sort_title: normalizeText(body.sort_title || title || upc),
      summary: normalizeText(body.summary),
      release_year: safeNumber(body.release_year),
      media_format: normalizeText(body.media_format),
      genre: normalizeText(body.genre),
      director_names: normalizeText(body.director_names),
      actor_names: normalizeText(body.actor_names),
      front_image_url: normalizeText(body.front_image_url),
      back_image_url: normalizeText(body.back_image_url),
      runtime_minutes: safeNumber(body.runtime_minutes),
      studio_name: normalizeText(body.studio_name),
      trailer_url: normalizeText(body.trailer_url),
      imdb_id: normalizeText(body.imdb_id),
      alternate_identifier: normalizeText(body.alternate_identifier),
      metadata_status: normalizeText(body.metadata_status || "manually_reviewed"),
      metadata_source: normalizeText(body.metadata_source || "manual_overlay"),
      estimated_value_low_cents: safeNumber(body.estimated_value_low_cents),
      estimated_value_high_cents: safeNumber(body.estimated_value_high_cents),
      estimated_value_currency: normalizeText(body.estimated_value_currency || "CAD"),
      rarity_notes: normalizeText(body.rarity_notes),
      collection_notes: normalizeText(body.collection_notes),
      value_search_url: normalizeText(body.value_search_url),
      status,
      featured_rank: body.featured_rank == null || body.featured_rank === "" ? null : Number(body.featured_rank)
    };

    const existing = await db.prepare(`
      SELECT movie_catalog_id
      FROM movie_catalog
      WHERE upc = ? OR slug = ?
      LIMIT 1
    `).bind(payload.upc, payload.slug).first().catch(() => null);

    if (existing?.movie_catalog_id) {
      await db.prepare(`
        UPDATE movie_catalog
        SET
          upc = ?,
          slug = ?,
          title = ?,
          original_title = ?,
          sort_title = ?,
          summary = ?,
          release_year = ?,
          media_format = ?,
          genre = ?,
          director_names = ?,
          actor_names = ?,
          front_image_url = ?,
          back_image_url = ?,
          runtime_minutes = ?,
          studio_name = ?,
          trailer_url = ?,
          imdb_id = ?,
          alternate_identifier = ?,
          metadata_status = ?,
          metadata_source = ?,
          estimated_value_low_cents = ?,
          estimated_value_high_cents = ?,
          estimated_value_currency = ?,
          rarity_notes = ?,
          collection_notes = ?,
          value_search_url = ?,
          status = ?,
          featured_rank = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE movie_catalog_id = ?
      `).bind(
        payload.upc,
        payload.slug,
        payload.title,
        payload.original_title,
        payload.sort_title,
        payload.summary,
        payload.release_year,
        payload.media_format,
        payload.genre,
        payload.director_names,
        payload.actor_names,
        payload.front_image_url,
        payload.back_image_url,
        payload.runtime_minutes,
        payload.studio_name,
        payload.trailer_url,
        payload.imdb_id,
        payload.alternate_identifier,
        payload.metadata_status,
        payload.metadata_source,
        payload.estimated_value_low_cents,
        payload.estimated_value_high_cents,
        payload.estimated_value_currency,
        payload.rarity_notes,
        payload.collection_notes,
        payload.value_search_url,
        payload.status,
        payload.featured_rank,
        Number(existing.movie_catalog_id)
      ).run();
    } else {
      await db.prepare(`
        INSERT INTO movie_catalog (
          upc, slug, title, original_title, sort_title, summary, release_year,
          media_format, genre, director_names, actor_names, front_image_url,
          back_image_url, runtime_minutes, studio_name, trailer_url, imdb_id,
          alternate_identifier, metadata_status, metadata_source,
          estimated_value_low_cents, estimated_value_high_cents, estimated_value_currency,
          rarity_notes, collection_notes, value_search_url, status, featured_rank,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        payload.upc,
        payload.slug,
        payload.title,
        payload.original_title,
        payload.sort_title,
        payload.summary,
        payload.release_year,
        payload.media_format,
        payload.genre,
        payload.director_names,
        payload.actor_names,
        payload.front_image_url,
        payload.back_image_url,
        payload.runtime_minutes,
        payload.studio_name,
        payload.trailer_url,
        payload.imdb_id,
        payload.alternate_identifier,
        payload.metadata_status,
        payload.metadata_source,
        payload.estimated_value_low_cents,
        payload.estimated_value_high_cents,
        payload.estimated_value_currency,
        payload.rarity_notes,
        payload.collection_notes,
        payload.value_search_url,
        payload.status,
        payload.featured_rank
      ).run();
    }

    await auditAdminAction(env, request, adminUser, {
      action_type: "movie_save",
      target_type: "movie_catalog",
      target_key: payload.upc || payload.slug,
      details: {
        upc: payload.upc,
        slug: payload.slug,
        title: payload.title,
        metadata_status: payload.metadata_status
      }
    });

    return json({
      ok: true,
      message: "Movie saved.",
      item: payload
    });
  } catch (error) {
    return json({
      ok: false,
      error: "Movie save failed.",
      details: String(error?.message || error)
    }, 500);
  }
}

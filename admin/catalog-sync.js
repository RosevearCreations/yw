import {
  captureRuntimeIncident,
  getAdminUserFromRequest,
  getDb,
  jsonResponse,
  normalizeText,
} from "../_lib/adminAudit.js";

function json(data, status = 200) {
  return jsonResponse(data, status, { "Cache-Control": "no-store" });
}

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildImageUrl(origin, folder, fileName, rawKey) {
  const key = normalizeText(rawKey) || [folder, normalizeText(fileName)].filter(Boolean).join("/");
  if (!key) return "";
  const encoded = key.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `${origin}/${encoded}`;
}

async function ensureCatalogItemsTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS catalog_items (
      catalog_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_kind TEXT NOT NULL CHECK (item_kind IN ('tool','supply','creation','other')),
      source_key TEXT NOT NULL,
      slug TEXT,
      name TEXT NOT NULL,
      brand TEXT,
      category TEXT,
      subcategory TEXT,
      item_type TEXT,
      short_description TEXT,
      notes TEXT,
      image_url TEXT,
      r2_object_key TEXT,
      amazon_url TEXT,
      storage_location TEXT,
      quantity_on_hand INTEGER NOT NULL DEFAULT 0,
      reorder_point INTEGER NOT NULL DEFAULT 0,
      visible_public INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      sort_order INTEGER NOT NULL DEFAULT 0,
      source_record_json TEXT,
      source_json_path TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(item_kind, source_key)
    )
  `).run();

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_catalog_items_kind ON catalog_items(item_kind)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_catalog_items_slug ON catalog_items(slug)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_catalog_items_public_sort ON catalog_items(item_kind, status, visible_public, sort_order, name)`).run();
}

async function ensureMovieCatalogTable(db) {
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
      metadata_status TEXT NOT NULL DEFAULT 'pending',
      metadata_source TEXT,
      estimated_value_low_cents INTEGER,
      estimated_value_high_cents INTEGER,
      estimated_value_currency TEXT,
      rarity_notes TEXT,
      collection_notes TEXT,
      value_search_url TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      featured_rank INTEGER,
      source_record_json TEXT,
      source_json_path TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_movie_catalog_title ON movie_catalog(sort_title, title)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_movie_catalog_status ON movie_catalog(status)`).run();
}

async function fetchJsonFromSite(request, paths) {
  const tried_paths = [];
  const warnings = [];

  for (const path of paths) {
    const resolved = new URL(path, request.url).toString();
    tried_paths.push(path);
    try {
      const response = await fetch(resolved, { cf: { cacheTtl: 0, cacheEverything: false } });
      if (!response.ok) {
        warnings.push(`Fetch failed for ${path} (${response.status}).`);
        continue;
      }
      const data = await response.json().catch(() => null);
      if (Array.isArray(data)) return { items: data, source_path: path, tried_paths, warnings };
      if (Array.isArray(data?.items)) return { items: data.items, source_path: path, tried_paths, warnings };
      if (Array.isArray(data?.movies)) return { items: data.movies, source_path: path, tried_paths, warnings };
      warnings.push(`No array payload found at ${path}.`);
    } catch (error) {
      warnings.push(`Could not read ${path}: ${String(error?.message || error || 'Unknown error')}`);
    }
  }

  return { items: [], source_path: "", tried_paths, warnings };
}

function mapToolRow(row, index, sourcePath) {
  const name = normalizeText(row.item_name_suggested || row.name || row.example_image_file) || `Tool ${index + 1}`;
  const area = normalizeText(row.primary_area || row.area || "Workshop Basics");
  const category = normalizeText(row.category || row.tool_category || "Uncategorized");
  const sourceKey = normalizeText(row.item_group_key_strict || row.r2_object_key || row.example_image_file || `${slugify(name)}-${index + 1}`);
  return {
    item_kind: "tool",
    source_key: sourceKey,
    slug: slugify(name),
    name,
    brand: normalizeText(row.brand_guess || row.brand),
    category,
    subcategory: area,
    item_type: normalizeText(row.tool_type || ""),
    short_description: [area, category].filter(Boolean).join(" • "),
    notes: normalizeText(row.how_we_use || row.notes_public || row.notes),
    image_url: buildImageUrl("https://assets.devilndove.com", "Toolshed", row.example_image_file || row.image_file, row.r2_object_key),
    r2_object_key: normalizeText(row.r2_object_key || ["Toolshed", normalizeText(row.example_image_file)].filter(Boolean).join("/")),
    amazon_url: normalizeText(row.amazon_url || row.amazon_search_url || row.amazon_search),
    storage_location: [row.location_zone, row.location_shelf, row.location_bin].map(normalizeText).filter(Boolean).join(" / "),
    quantity_on_hand: Number(row.quantity_owned || 0) || 0,
    reorder_point: 0,
    sort_order: index,
    source_record_json: JSON.stringify(row || {}),
    source_json_path: sourcePath,
  };
}

function mapSupplyRow(row, index, sourcePath) {
  const name = normalizeText(row.item_name_suggested || row.example_image_file) || `Supply ${index + 1}`;
  const type = normalizeText(row.consumable_type || "Workshop supply");
  const sourceKey = normalizeText(row.item_group_key_strict || row.r2_object_key || row.example_image_file || `${slugify(name)}-${index + 1}`);
  return {
    item_kind: "supply",
    source_key: sourceKey,
    slug: slugify(name),
    name,
    brand: normalizeText(row.brand_guess || row.brand),
    category: type,
    subcategory: normalizeText(row.primary_area || ""),
    item_type: type,
    short_description: [type, normalizeText(row.primary_area)].filter(Boolean).join(" • "),
    notes: normalizeText(row.notes),
    image_url: buildImageUrl("https://assets.devilndove.com", "Supplies", row.example_image_file || row.image_file, row.r2_object_key),
    r2_object_key: normalizeText(row.r2_object_key || ["Supplies", normalizeText(row.example_image_file)].filter(Boolean).join("/")),
    amazon_url: normalizeText(row.amazon_url || row.amazon_search_url),
    storage_location: normalizeText(row.storage_location),
    quantity_on_hand: Number(row.on_hand_qty || 0) || 0,
    reorder_point: Number(row.reorder_point || 0) || 0,
    sort_order: index,
    source_record_json: JSON.stringify(row || {}),
    source_json_path: sourcePath,
  };
}

function mapCreationRow(row, index, sourcePath) {
  const name = normalizeText(row.name || row.title) || `Creation ${index + 1}`;
  const image = normalizeText(row.image || row.image_url || row.src);
  const sourceKey = normalizeText(row.id || row.slug || image || `${slugify(name)}-${index + 1}`);
  return {
    item_kind: "creation",
    source_key: sourceKey,
    slug: slugify(row.slug || name),
    name,
    brand: "",
    category: normalizeText(row.section || "Featured creation"),
    subcategory: normalizeText(row.type || ""),
    item_type: normalizeText(row.type || ""),
    short_description: [normalizeText(row.section), normalizeText(row.type), normalizeText(row.alt)].filter(Boolean).join(" • "),
    notes: normalizeText(row.caption || row.description || row.alt),
    image_url: image,
    r2_object_key: "",
    amazon_url: "",
    storage_location: "",
    quantity_on_hand: 0,
    reorder_point: 0,
    sort_order: index,
    source_record_json: JSON.stringify(row || {}),
    source_json_path: sourcePath,
  };
}

function mapMovieRow(row, index, sourcePath) {
  const upc = normalizeText(row.upc || row.UPC || row.barcode || row.code || row.alternate_identifier || row.imdb_id || `movie-${index + 1}`);
  const title = normalizeText(row.title || row.name || row.movie_title || `Movie ${index + 1}`);
  const releaseYear = Number(row.release_year || row.year || 0) || null;
  return {
    upc,
    slug: slugify(title || upc),
    title,
    original_title: normalizeText(row.original_title),
    sort_title: normalizeText(row.sort_title || title).toLowerCase(),
    summary: normalizeText(row.summary || row.description || row.plot_summary || row.synopsis),
    release_year: releaseYear,
    media_format: normalizeText(row.media_format || row.format),
    genre: normalizeText(row.genre),
    director_names: normalizeText(row.director_names || row.director),
    actor_names: normalizeText(row.actor_names || row.actors),
    front_image_url: normalizeText(row.front_image_url || row.image_front || row.image || row.cover_front),
    back_image_url: normalizeText(row.back_image_url || row.image_back || row.cover_back),
    runtime_minutes: Number(row.runtime_minutes || row.runtime || 0) || null,
    studio_name: normalizeText(row.studio_name || row.studio),
    trailer_url: normalizeText(row.trailer_url),
    imdb_id: normalizeText(row.imdb_id),
    alternate_identifier: normalizeText(row.alternate_identifier),
    metadata_status: normalizeText(row.metadata_status) || "pending",
    metadata_source: normalizeText(row.metadata_source || "json_sync"),
    estimated_value_low_cents: Number(row.estimated_value_low_cents || 0) || null,
    estimated_value_high_cents: Number(row.estimated_value_high_cents || 0) || null,
    estimated_value_currency: normalizeText(row.estimated_value_currency),
    rarity_notes: normalizeText(row.rarity_notes),
    collection_notes: normalizeText(row.collection_notes || row.notes),
    value_search_url: normalizeText(row.value_search_url),
    status: normalizeText(row.status) || "active",
    featured_rank: Number(row.featured_rank || 0) || null,
    source_record_json: JSON.stringify(row || {}),
    source_json_path: sourcePath,
  };
}

function chunkRows(rows, size = 50) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
}

async function upsertCatalogRows(db, rows) {
  let upserted = 0;
  for (const chunk of chunkRows(rows, 50)) {
    const statements = chunk.map((row) => db.prepare(`
      INSERT INTO catalog_items (
        item_kind, source_key, slug, name, brand, category, subcategory, item_type,
        short_description, notes, image_url, r2_object_key, amazon_url, storage_location,
        quantity_on_hand, reorder_point, visible_public, status, sort_order,
        source_record_json, source_json_path, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'active', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(item_kind, source_key) DO UPDATE SET
        slug = excluded.slug,
        name = excluded.name,
        brand = excluded.brand,
        category = excluded.category,
        subcategory = excluded.subcategory,
        item_type = excluded.item_type,
        short_description = excluded.short_description,
        notes = excluded.notes,
        image_url = excluded.image_url,
        r2_object_key = excluded.r2_object_key,
        amazon_url = excluded.amazon_url,
        storage_location = excluded.storage_location,
        quantity_on_hand = excluded.quantity_on_hand,
        reorder_point = excluded.reorder_point,
        sort_order = excluded.sort_order,
        source_record_json = excluded.source_record_json,
        source_json_path = excluded.source_json_path,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      row.item_kind,
      row.source_key,
      row.slug || null,
      row.name,
      row.brand || null,
      row.category || null,
      row.subcategory || null,
      row.item_type || null,
      row.short_description || null,
      row.notes || null,
      row.image_url || null,
      row.r2_object_key || null,
      row.amazon_url || null,
      row.storage_location || null,
      Number(row.quantity_on_hand || 0),
      Number(row.reorder_point || 0),
      Number(row.sort_order || 0),
      row.source_record_json || null,
      row.source_json_path || null
    ));
    await db.batch(statements);
    upserted += chunk.length;
  }
  return upserted;
}

async function upsertMovieRows(db, rows) {
  let upserted = 0;
  for (const chunk of chunkRows(rows, 25)) {
    const statements = chunk.map((row) => db.prepare(`
      INSERT INTO movie_catalog (
        upc, slug, title, original_title, sort_title, summary, release_year,
        media_format, genre, director_names, actor_names, front_image_url,
        back_image_url, runtime_minutes, studio_name, trailer_url, imdb_id,
        alternate_identifier, metadata_status, metadata_source,
        estimated_value_low_cents, estimated_value_high_cents, estimated_value_currency,
        rarity_notes, collection_notes, value_search_url, status, featured_rank,
        source_record_json, source_json_path, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(upc) DO UPDATE SET
        slug = excluded.slug,
        title = excluded.title,
        original_title = excluded.original_title,
        sort_title = excluded.sort_title,
        summary = excluded.summary,
        release_year = excluded.release_year,
        media_format = excluded.media_format,
        genre = excluded.genre,
        director_names = excluded.director_names,
        actor_names = excluded.actor_names,
        front_image_url = excluded.front_image_url,
        back_image_url = excluded.back_image_url,
        runtime_minutes = excluded.runtime_minutes,
        studio_name = excluded.studio_name,
        trailer_url = excluded.trailer_url,
        imdb_id = excluded.imdb_id,
        alternate_identifier = excluded.alternate_identifier,
        metadata_status = excluded.metadata_status,
        metadata_source = excluded.metadata_source,
        estimated_value_low_cents = excluded.estimated_value_low_cents,
        estimated_value_high_cents = excluded.estimated_value_high_cents,
        estimated_value_currency = excluded.estimated_value_currency,
        rarity_notes = excluded.rarity_notes,
        collection_notes = excluded.collection_notes,
        value_search_url = excluded.value_search_url,
        status = excluded.status,
        featured_rank = excluded.featured_rank,
        source_record_json = excluded.source_record_json,
        source_json_path = excluded.source_json_path,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      row.upc,
      row.slug || null,
      row.title || null,
      row.original_title || null,
      row.sort_title || null,
      row.summary || null,
      row.release_year,
      row.media_format || null,
      row.genre || null,
      row.director_names || null,
      row.actor_names || null,
      row.front_image_url || null,
      row.back_image_url || null,
      row.runtime_minutes,
      row.studio_name || null,
      row.trailer_url || null,
      row.imdb_id || null,
      row.alternate_identifier || null,
      row.metadata_status || 'pending',
      row.metadata_source || null,
      row.estimated_value_low_cents,
      row.estimated_value_high_cents,
      row.estimated_value_currency || null,
      row.rarity_notes || null,
      row.collection_notes || null,
      row.value_search_url || null,
      row.status || 'active',
      row.featured_rank,
      row.source_record_json || null,
      row.source_json_path || null
    ));
    await db.batch(statements);
    upserted += chunk.length;
  }
  return upserted;
}

function normalizeCollections(body) {
  const aliases = {
    tools: 'tools',
    tool: 'tools',
    supplies: 'supplies',
    supply: 'supplies',
    movies: 'movies',
    movie: 'movies',
    featured: 'featured',
    creations: 'featured',
    creation: 'featured',
    featured_creations: 'featured',
  };

  const raw = [];
  if (Array.isArray(body?.collections)) raw.push(...body.collections);
  if (Array.isArray(body?.item_kinds)) raw.push(...body.item_kinds);
  if (!raw.length) raw.push('tools', 'supplies', 'movies', 'featured');

  const normalized = [];
  for (const value of raw.map((entry) => aliases[normalizeText(entry).toLowerCase()] || '')) {
    if (value && !normalized.includes(value)) normalized.push(value);
  }
  return normalized.length ? normalized : ['tools', 'supplies', 'movies', 'featured'];
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: 'Database binding is not configured.' }, 500);

  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return json({ ok: false, error: 'Unauthorized.' }, 401);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  try {
    await ensureCatalogItemsTable(db);
    await ensureMovieCatalogTable(db);

    const collections = normalizeCollections(body);
    const definitions = {
      tools: {
        fetch_paths: ['/data/toolshed/toolshed_items_master.json', '/data/data/toolshed/toolshed_items_master.json'],
        target_table: 'catalog_items',
        item_kind: 'tool',
        mapper: mapToolRow,
        upsert: upsertCatalogRows,
      },
      supplies: {
        fetch_paths: ['/data/supplies/supplies_items_master.json', '/data/data/supplies/supplies_items_master.json'],
        target_table: 'catalog_items',
        item_kind: 'supply',
        mapper: mapSupplyRow,
        upsert: upsertCatalogRows,
      },
      movies: {
        fetch_paths: ['/data/movies/movie_catalog_enriched.v2.json', '/data/movies/movie_catalog_enriched.json'],
        target_table: 'movie_catalog',
        item_kind: 'movie',
        mapper: mapMovieRow,
        upsert: upsertMovieRows,
      },
      featured: {
        fetch_paths: ['/data/site/featured-items.json', '/data/data/site/featured-items.json'],
        target_table: 'catalog_items',
        item_kind: 'creation',
        mapper: mapCreationRow,
        upsert: upsertCatalogRows,
      },
    };

    const summary = [];
    let totalUpserted = 0;

    for (const collection of collections) {
      const definition = definitions[collection];
      if (!definition) continue;

      const fetched = await fetchJsonFromSite(request, definition.fetch_paths);
      const rows = fetched.items.map((row, index) => definition.mapper(row, index, fetched.source_path || definition.fetch_paths[0]));
      const upserted = rows.length ? await definition.upsert(db, rows) : 0;
      totalUpserted += upserted;

      summary.push({
        collection,
        item_kind: definition.item_kind,
        target_table: definition.target_table,
        fetched: fetched.items.length,
        upserted,
        source_path: fetched.source_path || definition.fetch_paths[0],
        tried_paths: fetched.tried_paths,
        warnings: fetched.warnings,
        write_mode: collection === 'movies' ? 'batched_d1_upsert_25' : 'batched_d1_upsert_50',
      });
    }

    return json({
      ok: true,
      requested_by: adminUser,
      total_upserted: totalUpserted,
      summary,
      results: summary,
    });
  } catch (error) {
    await captureRuntimeIncident(env, request, {
      incident_scope: 'catalog_sync',
      incident_code: 'catalog_sync_failed',
      severity: 'error',
      message: 'Catalog migration sync failed.',
      related_user_id: adminUser.user_id,
      details: {
        error: String(error?.message || error || 'Unknown error'),
      },
    });

    return json({ ok: false, error: String(error?.message || error || 'Catalog sync failed.') }, 500);
  }
}

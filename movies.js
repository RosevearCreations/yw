import { captureRuntimeIncident } from "./_lib/adminAudit.js";

// File: /functions/api/movies.js
// JSON-first movie API using movie_catalog_enriched.v2.json as the base truth.

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

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueList(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = normalizeText(value);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function splitNames(value) {
  if (Array.isArray(value)) return uniqueList(value);
  const text = normalizeText(value);
  if (!text) return [];
  return uniqueList(
    text
      .split(/[|;,]/g)
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

function normalizeAkaTitles(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === "string") {
          return { title: normalizeText(entry) };
        }
        if (entry && typeof entry === "object") {
          return {
            title: normalizeText(entry.title),
            region: normalizeText(entry.region),
            language: normalizeText(entry.language),
            types: Array.isArray(entry.types) ? entry.types.filter(Boolean) : [],
            attributes: Array.isArray(entry.attributes) ? entry.attributes.filter(Boolean) : [],
            is_original_title: Boolean(entry.is_original_title || entry.isOriginalTitle)
          };
        }
        return null;
      })
      .filter((entry) => entry && entry.title);
  }
  return [];
}

function deriveCoverUrl(row, side) {
  const explicit = normalizeText(
    side === "front"
      ? (
          row.front_image_url ||
          row.front_image ||
          row.image_front ||
          row.cover_front ||
          row.frontImageUrl
        )
      : (
          row.back_image_url ||
          row.back_image ||
          row.image_back ||
          row.cover_back ||
          row.backImageUrl
        )
  );
  if (explicit) return explicit;

  const upc = normalizeText(row.upc || row.UPC || row.barcode || row.code);
  if (!upc) return "";

  const base = normalizeText(
    row.cover_base_url ||
    row.r2_movie_base_url ||
    "https://pub-f8137eb938da486a9f24410ccf49087c.r2.dev/movies"
  ).replace(/\/$/, "");

  return `${base}/${upc}${side === "front" ? "f" : "b"}.jpg`;
}


function movieIdentityKeys(row) {
  const keys = [];
  const upc = normalizeText(row.upc).toLowerCase();
  const slug = normalizeText(row.slug).toLowerCase();
  const title = normalizeText(row.title || row.original_title).toLowerCase();
  const year = normalizeText(row.release_year).toLowerCase();
  if (upc) keys.push(`upc:${upc}`);
  if (slug) keys.push(`slug:${slug}`);
  if (title && year) keys.push(`titleyear:${title}::${year}`);
  if (title) keys.push(`title:${title}`);
  return Array.from(new Set(keys));
}

function buildTrailerSearchUrl(title, year) {
  const q = encodeURIComponent([normalizeText(title), normalizeText(year), "official trailer"].filter(Boolean).join(" "));
  return q ? `https://www.youtube.com/results?search_query=${q}` : "";
}

function normalizeMovieRow(row, index = 0) {
  const upc = normalizeText(row.upc || row.UPC || row.barcode || row.code);
  const title = normalizeText(row.title || row.name || row.movie_title || row.primaryTitle);
  const originalTitle = normalizeText(row.original_title || row.originalTitle);
  const year = safeNumber(row.release_year ?? row.year ?? row.startYear);
  const actorNames = normalizeText(row.actor_names || row.actors || row.cast_names || row.cast);
  const directorNames = normalizeText(row.director_names || row.director || row.directors);
  const trailerUrl = normalizeText(row.trailer_url || row.trailer || row.youtube_url);

  return {
    movie_catalog_id: Number(row.movie_catalog_id || 0),
    upc,
    slug: normalizeText(row.slug || slugify(title || upc || `movie-${index + 1}`)),
    title,
    original_title: originalTitle,
    sort_title: normalizeText(row.sort_title || title || originalTitle || upc || `movie-${index + 1}`),
    summary: normalizeText(row.summary || row.description || row.plot_summary || row.synopsis),
    release_year: year,
    media_format: normalizeText(row.media_format || row.format || "DVD/Blu-ray"),
    genre: normalizeText(row.genre),
    director_names: directorNames,
    actor_names: actorNames,
    directors: splitNames(directorNames),
    actors: splitNames(actorNames),
    front_image_url: normalizeText(row.front_image_url || deriveCoverUrl(row, "front")),
    back_image_url: normalizeText(row.back_image_url || deriveCoverUrl(row, "back")),
    runtime_minutes: safeNumber(row.runtime_minutes),
    studio_name: normalizeText(row.studio_name || row.studio),
    imdb_id: normalizeText(row.imdb_id || row.tconst),
    alternate_identifier: normalizeText(row.alternate_identifier),
    metadata_status: normalizeText(row.metadata_status || (title ? "enriched" : "pending")),
    metadata_source: normalizeText(row.metadata_source),
    collection_notes: normalizeText(row.collection_notes),
    rarity_notes: normalizeText(row.rarity_notes),
    trailer_url: trailerUrl,
    trailer_search_url: trailerUrl || buildTrailerSearchUrl(title || upc, year),
    featured_rank: row.featured_rank == null || row.featured_rank === "" ? null : Number(row.featured_rank),
    status: normalizeText(row.status || "active") || "active",
    aka_titles: normalizeAkaTitles(row.aka_titles),
    source_record: row
  };
}

function mergeMovieRows(baseRow, overlayRow) {
  const merged = { ...baseRow };

  for (const [key, value] of Object.entries(overlayRow || {})) {
    if (value == null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    if (Array.isArray(value) && !value.length) continue;
    merged[key] = value;
  }

  merged.upc = normalizeText(merged.upc);
  merged.slug = normalizeText(merged.slug || slugify(merged.title || merged.upc));
  merged.title = normalizeText(merged.title);
  merged.original_title = normalizeText(merged.original_title);
  merged.sort_title = normalizeText(merged.sort_title || merged.title || merged.upc);
  merged.front_image_url = normalizeText(merged.front_image_url || deriveCoverUrl(merged, "front"));
  merged.back_image_url = normalizeText(merged.back_image_url || deriveCoverUrl(merged, "back"));
  merged.trailer_search_url = normalizeText(merged.trailer_search_url || merged.trailer_url || buildTrailerSearchUrl(merged.title || merged.upc, merged.release_year));
  merged.directors = splitNames(merged.director_names);
  merged.actors = splitNames(merged.actor_names);

  return merged;
}

async function fetchJsonFromSite(request, path) {
  const url = new URL(path, request.url);
  const response = await fetch(url.toString(), {
    cf: { cacheTtl: 0, cacheEverything: false }
  }).catch(() => null);

  if (!response || !response.ok) return null;
  return response.json().catch(() => null);
}

async function fetchBaseMovieCatalog(request) {
  const paths = [
    "/data/movies/movie_catalog_enriched.v2.json",
    "/assets/movies/movie_catalog_enriched.v2.json",
    "/data/movies/movie_catalog_enriched.json",
    "/assets/movies/movie_catalog_enriched.json",
    "/data/catalog.json"
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

async function fetchDbOverlay(env) {
  const db = env.DB || env.DD_DB;
  if (!db) return [];

  const hasTable = await db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='movie_catalog' LIMIT 1`)
    .first()
    .catch(() => null);

  if (!hasTable?.name) return [];

  const result = await db.prepare(`
    SELECT
      movie_catalog_id,
      upc,
      slug,
      title,
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
      collection_notes,
      rarity_notes,
      status,
      featured_rank,
      updated_at
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
    row.collection_notes
  ].join(" ").toLowerCase();

  return hay.includes(q);
}

function filterByField(row, fieldValue, rowValue) {
  if (!fieldValue) return true;
  return String(rowValue || "").toLowerCase().includes(fieldValue);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const q = normalizeText(url.searchParams.get("q")).toLowerCase();
  const year = normalizeText(url.searchParams.get("year")).toLowerCase();
  const actor = normalizeText(url.searchParams.get("actor")).toLowerCase();
  const director = normalizeText(url.searchParams.get("director")).toLowerCase();
  const genre = normalizeText(url.searchParams.get("genre")).toLowerCase();
  const studio = normalizeText(url.searchParams.get("studio")).toLowerCase();
  const format = normalizeText(url.searchParams.get("format")).toLowerCase();
  const upc = normalizeText(url.searchParams.get("upc")).toLowerCase();
  const page = Math.max(Number(url.searchParams.get("page") || 1), 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 500);

  const warnings = [];
  const baseRows = await fetchBaseMovieCatalog(request);
  const baseItems = baseRows.map(normalizeMovieRow);
  const overlayItems = await fetchDbOverlay(env);

  if (!baseItems.length) {
    warnings.push('movie_json_base_unavailable');
    await captureRuntimeIncident(env, request, {
      incident_scope: 'public_movies',
      incident_code: 'movie_json_base_unavailable',
      severity: 'warning',
      message: 'Movie base JSON returned no rows. Public movie API is relying on any available D1 overlay or an empty safe result.',
      details: { query: q, page, limit }
    });
  }
  if (!overlayItems.length) warnings.push('movie_d1_overlay_empty');

  const byKey = new Map();
  const canonicalItems = [];

  function registerMovie(row) {
    const keys = movieIdentityKeys(row);
    let existing = null;
    for (const key of keys) {
      if (byKey.has(key)) { existing = byKey.get(key); break; }
    }
    const merged = existing ? mergeMovieRows(existing, row) : row;
    if (!existing) canonicalItems.push(merged);
    else {
      const index = canonicalItems.indexOf(existing);
      if (index >= 0) canonicalItems[index] = merged;
    }
    for (const key of keys) byKey.set(key, merged);
  }

  baseItems.forEach(registerMovie);
  overlayItems.forEach(registerMovie);

  let items = canonicalItems
    .filter((row) => row.status !== "archived")
    .filter((row) => matchesQuery(row, q))
    .filter((row) => filterByField(row, year, row.release_year))
    .filter((row) => filterByField(row, actor, row.actor_names))
    .filter((row) => filterByField(row, director, row.director_names))
    .filter((row) => filterByField(row, genre, row.genre))
    .filter((row) => filterByField(row, studio, row.studio_name))
    .filter((row) => filterByField(row, format, row.media_format))
    .filter((row) => filterByField(row, upc, row.upc));

  items.sort((a, b) => {
    const ar = a.featured_rank == null ? 999999 : Number(a.featured_rank);
    const br = b.featured_rank == null ? 999999 : Number(b.featured_rank);
    if (ar !== br) return ar - br;
    return String(a.sort_title || a.title || a.upc).localeCompare(String(b.sort_title || b.title || b.upc), undefined, {
      sensitivity: "base"
    });
  });

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * limit;
  const pagedItems = items.slice(offset, offset + limit);

  const availableGenres = uniqueList(
    items.flatMap((row) => String(row.genre || "").split(",").map((v) => v.trim()).filter(Boolean))
  );
  const availableFormats = uniqueList(items.map((row) => row.media_format));
  const availableStudios = uniqueList(items.map((row) => row.studio_name));
  const availableYears = uniqueList(items.map((row) => row.release_year));

  return json({
    ok: true,
    items: pagedItems,
    summary: {
      total_items: totalItems,
      page: safePage,
      limit,
      total_pages: totalPages,
      has_more: safePage < totalPages,
      from: totalItems ? offset + 1 : 0,
      to: totalItems ? offset + pagedItems.length : 0,
      source: !baseItems.length && overlayItems.length ? 'D1 overlay rows only' : 'movie_catalog_enriched.v2.json with D1 overlay and title/year matching',
      authority_mode: !baseItems.length && overlayItems.length ? 'd1-overlay-only' : (overlayItems.length >= Math.max(1, Math.floor(baseItems.length * 0.8)) ? 'hybrid-d1-ready' : 'json-base-with-d1-overlay'),
      base_row_count: baseItems.length,
      overlay_row_count: overlayItems.length,
      has_db_overlay: overlayItems.length > 0,
      with_front_image: items.filter((row) => row.front_image_url).length,
      with_back_image: items.filter((row) => row.back_image_url).length,
      with_title: items.filter((row) => row.title).length,
      with_director: items.filter((row) => row.director_names).length,
      with_summary: items.filter((row) => row.summary).length
    },
    filters: {
      genres: availableGenres,
      formats: availableFormats,
      studios: availableStudios,
      years: availableYears
    },
    warning: warnings.includes('movie_json_base_unavailable') ? 'Movie JSON base read is unavailable right now. Showing any available overlay rows and safe empty fields where needed.' : '',
    diagnostics: { warnings, query: q, page: safePage, limit }
  });
}

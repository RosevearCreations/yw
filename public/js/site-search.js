// File: /public/js/site-search.js
// Brief description: Public site search across storefront products, tools, supplies,
// featured creations, movies, and key landing pages with lightweight analytics logging.
// It now degrades more gracefully when one or more live sources are unavailable.

document.addEventListener('DOMContentLoaded', () => {
  const inputEl = document.getElementById('siteSearchInput');
  const buttonEl = document.getElementById('siteSearchButton');
  const resetEl = document.getElementById('siteSearchReset');
  const summaryEl = document.getElementById('siteSearchSummary');
  const resultsEl = document.getElementById('siteSearchResults');
  const emptyEl = document.getElementById('siteSearchEmpty');

  const staticPages = [
    { type: 'Page', name: 'Home', summary: 'Handmade jewelry, workshop creations and maker life in Southern Ontario.', url: '/' },
    { type: 'Page', name: 'About Devil n Dove', summary: 'Learn about our workshop, process, and creative projects.', url: '/about/' },
    { type: 'Page', name: 'Shop', summary: 'Shop handmade jewelry, art and digital creations.', url: '/shop/' },
    { type: 'Page', name: 'Gallery', summary: 'Art, jewelry and workshop experiments.', url: '/gallery/' },
    { type: 'Page', name: 'Creations', summary: 'Browse finished creations and featured work.', url: '/creations/' },
    { type: 'Page', name: 'Tools', summary: 'Workshop tools we use at Devil n Dove.', url: '/tools/' },
    { type: 'Page', name: 'Supplies', summary: 'Workshop supplies and consumables we use.', url: '/supplies/' },
    { type: 'Page', name: 'Toolshed', summary: 'Workshop gear, notes, and duplicate tool references.', url: '/toolshed/' },
    { type: 'Page', name: 'Movies', summary: 'Movies, nostalgia and favourite picks.', url: '/movies/' },
    { type: 'Page', name: 'Contact', summary: 'Questions, custom work and shop help.', url: '/contact/' }
  ];

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function scoreText(query, ...parts) {
    const haystack = parts.join(' ').toLowerCase();
    if (!haystack || !query) return 0;
    let score = 0;
    if (haystack.includes(query)) score += 10;
    for (const token of query.split(/\s+/).filter(Boolean)) {
      if (haystack.includes(token)) score += 3;
    }
    return score;
  }

  async function fetchSearchSource(label, url, extractor, mapper, query) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || `${label} search source is unavailable.`);
      const rows = extractor(data);
      return { label, items: rows.map((row) => mapper(row, query)).filter((row) => row.score > 0 || !query), warning: Array.isArray(data?.diagnostics?.warnings) && data.diagnostics.warnings.length ? `${label} is using fallback data.` : '' };
    } catch (error) {
      return { label, items: [], error: error?.message || `${label} search source is unavailable.` };
    }
  }

  function fetchPages(query) {
    return staticPages
      .map((row) => ({ ...row, score: scoreText(query, row.name, row.summary) }))
      .filter((row) => row.score > 0 || (!query && row.url === '/shop/'));
  }

  async function logSearch(term, resultCount) {
    try {
      await fetch('/api/site-search-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search_term: term, result_count: resultCount, path: '/search/' })
      });
    } catch {}
  }

  function render(results, query, notice = '') {
    if (!resultsEl || !summaryEl || !emptyEl) return;
    if (!results.length) {
      resultsEl.innerHTML = '';
      emptyEl.style.display = '';
      summaryEl.textContent = query ? `No results found for “${query}”.${notice ? ` ${notice}` : ''}` : 'Enter a search term to begin.';
      return;
    }
    emptyEl.style.display = 'none';
    summaryEl.textContent = `${results.length} result(s) found${query ? ` for “${query}”` : ''}.${notice ? ` ${notice}` : ''}`;
    resultsEl.innerHTML = results.map((row) => `
      <article class="card">
        ${row.image ? `<img src="${escapeHtml(row.image)}" alt="${escapeHtml(row.name)}" style="width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:12px;margin-bottom:12px"/>` : ''}
        <div class="small">${escapeHtml(row.type)}</div>
        <h2 style="font-size:1.05rem;margin:8px 0">${escapeHtml(row.name)}</h2>
        <p class="small" style="min-height:3.2em">${escapeHtml(row.summary || 'No summary available.')}</p>
        <div style="margin-top:12px"><a class="btn" href="${escapeHtml(row.url)}">Open</a></div>
      </article>
    `).join('');
  }

  async function runSearch() {
    const query = String(inputEl?.value || '').trim().toLowerCase();
    if (!query) {
      render([], '');
      return;
    }
    summaryEl.textContent = 'Searching...';

    const sources = await Promise.all([
      fetchSearchSource('Products', `/api/products?q=${encodeURIComponent(query)}`, (data) => Array.isArray(data.products) ? data.products : [], (row, q) => ({
        type: 'Product',
        name: row.name || 'Product',
        summary: row.short_description || row.meta_description || row.product_type || 'Storefront product',
        url: `/shop/product/?slug=${encodeURIComponent(row.slug || '')}`,
        image: row.featured_image_url || row.og_image_url || '',
        score: scoreText(q, row.name, row.short_description, row.meta_description, row.keywords, row.product_type)
      }), query),
      fetchSearchSource('Tools', `/api/tools?q=${encodeURIComponent(query)}&limit=250`, (data) => Array.isArray(data.items) ? data.items : [], (row, q) => ({
        type: 'Tool',
        name: row.item_name_suggested || row.name || row.brand_guess || 'Workshop tool',
        summary: [row.primary_area, row.category, row.notes_public, row.notes, row.location_zone, row.location_shelf].filter(Boolean).join(' • '),
        url: '/tools/',
        image: row.image_url || '',
        score: scoreText(q, row.item_name_suggested, row.name, row.brand_guess, row.category, row.primary_area, row.notes_public, row.notes, row.location_zone, row.location_shelf)
      }), query),
      fetchSearchSource('Supplies', `/api/supplies?q=${encodeURIComponent(query)}&limit=250`, (data) => Array.isArray(data.items) ? data.items : [], (row, q) => ({
        type: 'Supply',
        name: row.item_name_suggested || row.name || row.consumable_type || 'Workshop supply',
        summary: [row.consumable_type, row.primary_area, row.process_tags, row.notes, row.storage_location].filter(Boolean).join(' • '),
        url: '/supplies/',
        image: row.image_url || '',
        score: scoreText(q, row.item_name_suggested, row.name, row.consumable_type, row.primary_area, row.process_tags, row.notes, row.storage_location)
      }), query),
      fetchSearchSource('Creations', `/api/creations?q=${encodeURIComponent(query)}&limit=250`, (data) => Array.isArray(data.items) ? data.items : [], (row, q) => ({
        type: 'Creation',
        name: row.name || row.title || 'Featured creation',
        summary: [row.section, row.type, row.alt, row.caption, row.description].filter(Boolean).join(' • '),
        url: '/creations/',
        image: row.image || row.image_url || '',
        score: scoreText(q, row.name, row.title, row.section, row.type, row.alt, row.caption, row.description)
      }), query),
      fetchSearchSource('Movies', `/api/movies?q=${encodeURIComponent(query)}&limit=120`, (data) => Array.isArray(data.items) ? data.items : [], (row, q) => ({
        type: 'Movie',
        name: row.title || row.upc || 'Movie',
        summary: [row.release_year, row.genre, row.director_names, row.actor_names, row.summary].filter(Boolean).join(' • '),
        url: '/movies/',
        image: row.front_image_url || '',
        score: scoreText(q, row.title, row.upc, row.release_year, row.genre, row.director_names, row.actor_names, row.summary)
      }), query)
    ]);

    const pages = fetchPages(query);
    const results = [...sources.flatMap((source) => source.items), ...pages]
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || String(a.name || '').localeCompare(String(b.name || '')))
      .slice(0, 36);

    const warnings = sources.map((source) => source.warning).filter(Boolean);
    const failures = sources.filter((source) => source.error).map((source) => source.label);
    const noticeParts = [];
    if (warnings.length) noticeParts.push(Array.from(new Set(warnings)).join(' '));
    if (failures.length) noticeParts.push(`Some live sources are unavailable right now: ${Array.from(new Set(failures)).join(', ')}. Static page results are still included.`);

    render(results, query, noticeParts.join(' '));
    logSearch(query, results.length);
  }

  buttonEl?.addEventListener('click', runSearch);
  resetEl?.addEventListener('click', () => {
    if (inputEl) inputEl.value = '';
    render([], '');
  });
  inputEl?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runSearch();
    }
  });

  const url = new URL(window.location.href);
  const q = String(url.searchParams.get('q') || '').trim();
  if (q && inputEl) {
    inputEl.value = q;
    runSearch();
  }
});

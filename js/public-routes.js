/* Approved public route renderer - build 2026-06-18a / schema 151
   Runtime fallback for approved route records. Static generation remains the
   preferred deployment path for crawler-ready HTML and sitemap output. */
'use strict';

(function () {
  const path = `/${window.location.pathname.replace(/^\/+|\/+$/g, '')}`.replace(/^\/$/, '/');
  const reserved = new Set(['/', '/index.html', '/sitemap.xml', '/robots.txt', '/manifest.json', '/style.css', '/favicon.ico', '/server-worker.js']);
  const reservedRoots = new Set(['api','archive','docs','icons','js','scripts','sql','supabase']);
  const routeRoot = path.split('/').filter(Boolean)[0] || '';
  const hasPortal = new URLSearchParams(window.location.search).has('portal');
  if (hasPortal || reserved.has(path) || reservedRoots.has(routeRoot)) return;

  document.body.classList.add('public-route-mode');
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
  const byId = (id) => document.getElementById(id);
  const safeUrl = (value, fallback = '') => { try { const parsed = new URL(String(value || fallback), window.location.origin); return ['http:','https:'].includes(parsed.protocol) ? parsed.href : fallback; } catch { return fallback; } };
  const safeCta = (value) => { const raw = String(value || '/#quote-intake'); return raw.startsWith('/') || raw.startsWith('#') ? raw : '/#quote-intake'; };

  function sanitizeHtml(raw) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(raw || ''), 'text/html');
    const allowed = new Set(['P','BR','STRONG','B','EM','I','UL','OL','LI','H2','H3','H4','BLOCKQUOTE','HR','TABLE','THEAD','TBODY','TR','TH','TD','A','SMALL']);
    [...doc.body.querySelectorAll('*')].forEach((node) => {
      if (!allowed.has(node.tagName)) { node.replaceWith(...node.childNodes); return; }
      const href = node.tagName === 'A' ? (node.getAttribute('href') || '') : '';
      [...node.attributes].forEach((attr) => node.removeAttribute(attr.name));
      if (node.tagName === 'A' && /^(https?:|mailto:|tel:|\/|#)/i.test(href)) {
        node.setAttribute('href', href);
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
    return doc.body.innerHTML;
  }

  function markdownToHtml(markdown) {
    const lines = String(markdown || '').split(/\r?\n/);
    const out = [];
    let list = null;
    const inline = (value) => esc(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
    const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
    lines.forEach((line) => {
      const text = line.trim();
      if (!text) { close(); return; }
      const heading = text.match(/^(#{2,4})\s+(.+)$/);
      if (heading) { close(); const level = Math.min(4, heading[1].length); out.push(`<h${level}>${inline(heading[2])}</h${level}>`); return; }
      const bullet = text.match(/^[-*]\s+(.+)$/);
      if (bullet) { if (list !== 'ul') { close(); list = 'ul'; out.push('<ul>'); } out.push(`<li>${inline(bullet[1])}</li>`); return; }
      close(); out.push(`<p>${inline(text)}</p>`);
    });
    close(); return out.join('');
  }

  function ensureMeta(name, content) {
    let meta = document.head.querySelector(`meta[name="${name}"]`);
    if (!meta) { meta = document.createElement('meta'); meta.name = name; document.head.append(meta); }
    meta.content = content;
  }
  function ensureProperty(property, content) {
    let meta = document.head.querySelector(`meta[property="${property}"]`);
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('property', property); document.head.append(meta); }
    meta.content = content;
  }
  function ensureCanonical(url) {
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.append(link); }
    link.href = url;
  }

  function shell() {
    let main = byId('publicRouteView');
    if (!main) {
      main = document.createElement('main');
      main.id = 'publicRouteView';
      main.className = 'public-route-shell';
      document.body.prepend(main);
    }
    return main;
  }

  function render(route, visual) {
    const main = shell();
    const body = sanitizeHtml(route.page_body_html || '') || markdownToHtml(route.page_body_markdown || '') || `<p>${esc(route.page_intro || '')}</p>`;
    const imageUrl = safeUrl(visual?.public_url || visual?.source_url || '', '');
    const canonical = safeUrl(route.canonical_url, `${window.location.origin}${route.route_path}`);
    const cta = safeCta(route.primary_cta_path);
    document.title = route.page_title;
    ensureMeta('description', route.meta_description || route.page_intro || '');
    ensureCanonical(canonical);
    ensureProperty('og:title', route.page_title);
    ensureProperty('og:description', route.meta_description || route.page_intro || '');
    ensureProperty('og:url', canonical);
    ensureProperty('og:type', 'website');
    if (imageUrl) ensureProperty('og:image', imageUrl);

    document.querySelectorAll('script[data-public-route-schema]').forEach((node) => node.remove());
    const schema = document.createElement('script');
    schema.type = 'application/ld+json';
    schema.dataset.publicRouteSchema = '1';
    schema.textContent = JSON.stringify({
      '@context':'https://schema.org', '@type':'Service', name:route.service_name || route.h1_text,
      description:route.meta_description || route.page_intro, areaServed:route.location_name || 'Southern Ontario',
      provider:{ '@type':'Organization', name:'Yard Weasels Inc.', url:window.location.origin }, url:canonical
    });
    document.head.append(schema);

    main.innerHTML = `
      <header class="public-route-header">
        <a href="/" class="public-route-brand"><span aria-hidden="true">YWI</span><strong>Yard Weasels Inc.</strong></a>
        <a class="secondary" href="${esc(cta)}">Request a quote</a>
      </header>
      <article class="public-route-article">
        <nav class="public-route-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>${esc(route.service_name || route.location_name || 'Service')}</span></nav>
        <section class="public-route-hero">
          <div><span class="public-route-kicker">${esc(route.location_name || 'Southern Ontario')}</span><h1>${esc(route.h1_text)}</h1><p>${esc(route.page_intro || route.meta_description || '')}</p><div class="public-route-hero-actions"><a class="primary" href="${esc(cta)}">Request a quote</a><a class="secondary" href="/#quote-intake">View contact form</a></div></div>
          ${imageUrl ? `<figure><img src="${esc(imageUrl)}" alt="${esc(visual.alt_text || route.h1_text)}" width="${Number(visual.pixel_width || 1200)}" height="${Number(visual.pixel_height || 800)}" loading="eager" decoding="async"><figcaption>Approved service visual</figcaption></figure>` : `<div class="public-route-visual-placeholder" role="img" aria-label="Approved service image placeholder"><span aria-hidden="true">◇</span><strong>Service visual placeholder</strong><small>This publishes only until an approved, compressed, consent-cleared image replaces it.</small></div>`}
        </section>
        <section class="public-route-proof"><strong>Local proof</strong><p>${esc(route.local_proof_hint || 'Ask us about availability, service scope, and proof relevant to your Southern Ontario site.')}</p></section>
        <section class="public-route-content">${body}</section>
        <section class="public-route-cta"><div><span>Ready to discuss the work?</span><h2>Request a clear quote and next-step plan</h2><p>Share the location, service need, timing, and any safety or access constraints.</p></div><a class="primary" href="${esc(cta)}">Start a request</a></section>
      </article>
      <footer class="public-route-footer"><span>Yard Weasels Inc. · Southern Ontario</span><a href="/">Home</a></footer>`;
  }

  async function load() {
    const main = shell();
    main.innerHTML = '<section class="public-route-loading"><span class="auth-loading-spinner" aria-hidden="true"></span><h1>Loading service page…</h1></section>';
    try {
      if (!window.YWIAPI?.fetchPublicContent) throw new Error('Public content service is unavailable.');
      const response = await window.YWIAPI.fetchPublicContent({ action:'route', route_path:path });
      if (!response?.ok) throw new Error(response?.error || 'Published page not found.');
      render(response.route, response.visual);
    } catch (error) {
      document.title = 'Page not found | Yard Weasels Inc.';
      main.innerHTML = `<section class="public-route-error"><span aria-hidden="true">404</span><h1>Published page not found</h1><p>${esc(error?.message || 'This page is not available.')}</p><a class="primary" href="/">Return home</a></section>`;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once:true });
  else load();
})();

#!/usr/bin/env node
/**
 * Generate crawler-ready HTML and sitemap entries from approved/public route records.
 *
 * Required environment:
 *   PUBLIC_CONTENT_ENDPOINT=https://<project>.supabase.co/functions/v1/public-content
 * Optional:
 *   SUPABASE_ANON_KEY=<public anon key>
 *   PUBLIC_SITE_URL=https://yardweasels.ca
 *
 * The script refuses unsafe paths, generates exactly one H1 per page, and only
 * consumes records returned by the public-content function (approved + published).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const endpoint = String(process.env.PUBLIC_CONTENT_ENDPOINT || '').replace(/\/$/, '');
const anonKey = String(process.env.SUPABASE_ANON_KEY || '');
const siteUrl = String(process.env.PUBLIC_SITE_URL || 'https://yardweasels.ca').replace(/\/$/, '');
const build = '2026-07-07a';
if (!endpoint) {
  console.error('Missing PUBLIC_CONTENT_ENDPOINT. No route files were changed.');
  process.exit(2);
}

const reservedRoots = new Set(['api','archive','docs','icons','js','scripts','sql','supabase','index.html','style.css','favicon.ico','manifest.json','robots.txt','sitemap.xml','server-worker.js']);
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const safePath = (value = '') => {
  const clean = `/${String(value).replace(/^\/+|\/+$/g, '')}`.replace(/^\/$/, '/');
  const routeRoot = clean.split('/').filter(Boolean)[0]?.toLowerCase() || '';
  if (clean === '/' || !/^\/[a-z0-9][a-z0-9\/-]*$/.test(clean) || clean.includes('..') || reservedRoots.has(routeRoot)) throw new Error(`Unsafe route path: ${value}`);
  return clean;
};
const safeUrl = (value = '', fallback = '') => {
  try {
    const parsed = new URL(String(value || fallback), siteUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return fallback;
    return parsed.href;
  } catch { return fallback; }
};
function inlineMarkdown(value = '') {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
}
function markdownToHtml(markdown = '') {
  const out = [];
  let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of String(markdown).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { close(); continue; }
    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) { close(); const level = Math.min(4, heading[1].length); out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`); continue; }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (bullet || numbered) {
      const next = bullet ? 'ul' : 'ol';
      if (list !== next) { close(); list = next; out.push(`<${list}>`); }
      out.push(`<li>${inlineMarkdown((bullet || numbered)[1])}</li>`);
      continue;
    }
    close(); out.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  close();
  return out.join('\n');
}
function sanitizeApprovedHtml(raw = '') {
  return String(raw)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form)[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/javascript:/gi, '');
}
async function call(payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type':'application/json', ...(anonKey ? { apikey:anonKey, authorization:`Bearer ${anonKey}` } : {}) },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) throw new Error(data?.error || `Public content request failed (${response.status}).`);
  return data;
}
function pageHtml(route, visual) {
  const canonical = safeUrl(route.canonical_url, `${siteUrl}${route.route_path}`);
  const image = safeUrl(visual?.public_url || visual?.source_url, '');
  const cta = String(route.primary_cta_path || '/#quote-intake').startsWith('/') || String(route.primary_cta_path || '').startsWith('#') ? route.primary_cta_path : '/#quote-intake';
  const body = sanitizeApprovedHtml(route.page_body_html || '') || markdownToHtml(route.page_body_markdown || '') || `<p>${escapeHtml(route.page_intro || '')}</p>`;
  const schema = JSON.stringify({ '@context':'https://schema.org', '@type':'Service', name:route.service_name || route.h1_text, description:route.meta_description || route.page_intro, areaServed:route.location_name || 'Southern Ontario', provider:{ '@type':'Organization', name:'Yard Weasels Inc.', url:siteUrl }, url:canonical }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en-CA">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(route.page_title)}</title>
  <meta name="description" content="${escapeHtml(route.meta_description || route.page_intro || '')}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="stylesheet" href="/style.css?v=${build}">
  <meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(route.page_title)}"><meta property="og:description" content="${escapeHtml(route.meta_description || '')}"><meta property="og:url" content="${escapeHtml(canonical)}">${image ? `\n  <meta property="og:image" content="${escapeHtml(image)}">` : ''}
  <script type="application/ld+json">${schema}</script>
</head>
<body class="public-route-mode static-public-route">
<main id="publicRouteView" class="public-route-shell">
  <header class="public-route-header"><a href="/" class="public-route-brand"><span aria-hidden="true">YWI</span><strong>Yard Weasels Inc.</strong></a><a class="secondary" href="${escapeHtml(cta)}">Request a quote</a></header>
  <article class="public-route-article">
    <nav class="public-route-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>${escapeHtml(route.service_name || route.location_name || 'Service')}</span></nav>
    <section class="public-route-hero"><div><span class="public-route-kicker">${escapeHtml(route.location_name || 'Southern Ontario')}</span><h1>${escapeHtml(route.h1_text)}</h1><p>${escapeHtml(route.page_intro || route.meta_description || '')}</p><div class="public-route-hero-actions"><a class="primary" href="${escapeHtml(cta)}">Request a quote</a><a class="secondary" href="/#quote-intake">View contact form</a></div></div>${image ? `<figure><img src="${escapeHtml(image)}" alt="${escapeHtml(visual?.alt_text || route.h1_text)}" width="${Number(visual?.pixel_width || 1200)}" height="${Number(visual?.pixel_height || 800)}" loading="eager" decoding="async"><figcaption>Approved service visual</figcaption></figure>` : `<div class="public-route-visual-placeholder" role="img" aria-label="Service image placeholder"><span aria-hidden="true">◇</span><strong>Service visual placeholder</strong><small>An approved, compressed, consent-cleared image will replace this placeholder.</small></div>`}</section>
    <section class="public-route-proof"><strong>Local proof</strong><p>${escapeHtml(route.local_proof_hint || '')}</p></section>
    <section class="public-route-content">${body}</section>
    <section class="public-route-cta"><div><span>Ready to discuss the work?</span><h2>Request a clear quote and next-step plan</h2><p>Share the location, service need, timing, and any safety or access constraints.</p></div><a class="primary" href="${escapeHtml(cta)}">Start a request</a></section>
  </article>
  <footer class="public-route-footer"><span>Yard Weasels Inc. · Southern Ontario</span><a href="/">Home</a></footer>
</main>
</body>
</html>\n`;
}
function sitemapXml(entries) {
  const rows = [{ route_path:'/', canonical_url:`${siteUrl}/`, last_modified:new Date().toISOString().slice(0,10), change_frequency:'weekly', priority:1 }, ...entries];
  const unique = [...new Map(rows.map((row) => [row.route_path, row])).values()];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${unique.map((row) => `  <url>\n    <loc>${escapeHtml(safeUrl(row.canonical_url, `${siteUrl}${row.route_path}`))}</loc>\n    <lastmod>${escapeHtml(row.last_modified || new Date().toISOString().slice(0,10))}</lastmod>\n    <changefreq>${escapeHtml(row.change_frequency || 'monthly')}</changefreq>\n    <priority>${Number(row.priority || 0.7).toFixed(1)}</priority>\n  </url>`).join('\n')}\n</urlset>\n`;
}

const sitemap = await call({ action:'sitemap' });
const generated = [];
for (const entry of sitemap.entries || []) {
  const routePath = safePath(entry.route_path);
  const response = await call({ action:'route', route_path:routePath });
  const outputDir = path.join(root, routePath.slice(1));
  await fs.mkdir(outputDir, { recursive:true });
  await fs.writeFile(path.join(outputDir, 'index.html'), pageHtml(response.route, response.visual), 'utf8');
  generated.push({ ...entry, route_path:routePath });
  console.log(`Generated ${routePath}/index.html`);
}
await fs.writeFile(path.join(root, 'sitemap.xml'), sitemapXml(generated), 'utf8');
console.log(`Generated ${generated.length} approved public page(s) and sitemap.xml for build ${build}.`);

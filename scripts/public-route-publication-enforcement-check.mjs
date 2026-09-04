import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const failures = [];
const expect = (haystack, needle, label) => { if (!haystack.includes(needle)) failures.push(label); };
const forbid = (haystack, needle, label) => { if (haystack.includes(needle)) failures.push(label); };

const schema150 = read('sql/150_end_to_end_operations_customer_portal_media_route_publication.sql');
const operations = read('supabase/functions/operations-manage/index.ts');
const cockpit = read('js/operations-cockpit.js');
const publicContent = read('supabase/functions/public-content/index.ts');
const generator = read('scripts/generate-public-routes.mjs');
const searchGate = read('scripts/search-discovery-quality-check.mjs');
const help = read('help.html');
const handbook = read('docs/ACTIVE_PROJECT_HANDBOOK.md');

[
  ['public.public_route_approval_items', 'historical route approval authority'],
  ['public.public_sitemap_entries', 'historical sitemap registry'],
  ['canonical_url text', 'canonical storage'],
  ['published_at timestamptz', 'published timestamp'],
  ['visual_asset_approval_items', 'visual approval authority']
].forEach(([needle, label]) => expect(schema150, needle, label));

[
  ["action === 'public_route_register'", 'route register action'],
  ["action === 'public_route_decision'", 'route decision action'],
  ["action === 'public_route_publish'", 'route publish action'],
  ["action === 'visual_asset_decision'", 'visual asset decision action']
].forEach(([needle, label]) => expect(operations, needle, label));

[
  ["'route-approve':'public_route_decision'", 'cockpit route approve capability'],
  ["'route-reject':'public_route_decision'", 'cockpit route reject capability'],
  ["'route-publish':'public_route_publish'", 'cockpit route publish capability'],
  ["'asset-approve':'visual_asset_decision'", 'cockpit asset approve capability'],
  ["'asset-reject':'visual_asset_decision'", 'cockpit asset reject capability']
].forEach(([needle, label]) => expect(cockpit, needle, label));

expect(publicContent, ".eq('route_status','approved').not('published_at','is',null)", 'public content requires approved + published route');
expect(publicContent, ".eq('asset_status','approved')", 'public content requires approved visual');
expect(publicContent, "Published route not found.", 'unpublished route fails closed');

[
  ['Canonical URL disagrees with approved route path', 'route/canonical mismatch fails closed'],
  ['Sitemap canonical disagrees with route path', 'sitemap/canonical mismatch fails closed'],
  ['Future sitemap lastmod', 'future sitemap freshness rejected'],
  ['approvedHtml(', 'approved HTML sanitization'],
  ['<h1>${esc(route.h1_text)}</h1>', 'one explicit route H1 source'],
  ['index,follow,max-image-preview:large', 'canonical public indexing policy'],
  ["'@type':'WebPage'", 'WebPage structured data'],
  ["'@type':'Service'", 'Service structured data'],
  ["'@type':'BreadcrumbList'", 'BreadcrumbList structured data'],
  ['alt="${esc(imageAlt)}"', 'approved image alt output'],
  ['Approved service visual', 'approved visual caption'],
  ['Service visual placeholder', 'safe placeholder fallback']
].forEach(([needle, label]) => expect(generator, needle, label));

forbid(generator, 'PUBLIC_CANONICAL_ORIGIN', 'deployment canonical override must remain unavailable');
expect(searchGate, 'canonical', 'search discovery gate remains linked');
expect(searchGate, 'structured data', 'search discovery structured-data contract');
expect(help, 'approved content', 'Help retains approval boundary');
expect(handbook, 'Public pages require one H1', 'handbook retains public-page authority');

if (failures.length) {
  console.error(`Public route publication enforcement failed (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('Public route publication enforcement passed.');

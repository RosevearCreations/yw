#!/usr/bin/env node
/** Static check for the 2026-08-05a route-priority shell fix. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const index = read('index.html');
const router = read('js/router.js');
const css = read('style.css');
const mobileMenu = read('js/mobile-menu.js');
const results = [];
const add = (name, ok, details = '') => results.push({ name, ok, details });

const mainStart = index.indexOf('<main class="container">');
const mainEnd = index.indexOf('</main>');
const supportStart = index.indexOf('<aside class="app-supporting-panels"');
const authLoadingStart = index.indexOf('<section id="authLoading"');
const firstVisualPanel = Math.min(
  ...[
    'graphic-placeholder-wall app-support-panel',
    'surface-readiness-strip app-support-panel',
    'surface-proof-strip app-support-panel',
    'surface-value-strip app-support-panel',
    'surface-execution-strip app-support-panel',
    'public-intake-strip app-support-panel',
    'mobile-conflict-preview-strip app-support-panel',
    'write-action-proof-strip app-support-panel'
  ].map((needle) => {
    const idx = index.indexOf(needle);
    return idx >= 0 ? idx : Number.POSITIVE_INFINITY;
  })
);

add('main-exists-before-support-panels', mainStart > 0 && supportStart > mainEnd && mainEnd > mainStart, `main=${mainStart}, mainEnd=${mainEnd}, support=${supportStart}`);
add('no-large-support-panels-before-main', firstVisualPanel > mainEnd, `first support panel index=${firstVisualPanel}; mainEnd=${mainEnd}`);
add('auth-loading-before-main-only', authLoadingStart > 0 && authLoadingStart < mainStart, 'Only the auth-loading/login shell is before the app workspace.');
add('supporting-panels-preserved-below-app', index.includes('<aside class="app-supporting-panels"') && index.includes('Hero operations visual') && index.includes('Quote / contact intake'), 'Supporting visuals and intake panels remain available below active route sections.');
add('section-placeholders-preserved', ['Toolbox visual placeholder','PPE proof placeholder','First aid visual placeholder','Incident evidence placeholder','Inspection visual placeholder','Job workflow placeholder','Equipment scan placeholder','Admin control center placeholder'].every((needle) => index.includes(needle)), 'Section-level placeholders remain in routed cards.');
add('router-scrolls-to-active-section', router.includes('function scrollToActiveSection') && router.includes('section.scrollIntoView') && router.includes('scrollToActiveSection(allowedSection)'), 'Router scrolls to the selected allowed card.');
const showSectionStart = router.indexOf('function showSection');
const showSectionBody = showSectionStart >= 0 ? router.slice(showSectionStart, router.indexOf('function onNavClick', showSectionStart)) : '';
add('show-section-does-not-force-page-top', !showSectionBody.includes('window.scrollTo({ top: 0'), 'showSection no longer scrolls to the page top above support panels.');
add('sticky-header-scroll-margin', css.includes('main.container > .card') && css.includes('scroll-margin-top'), 'Active routed cards have scroll margin for sticky header.');
add('support-panel-css-below-workspace', css.includes('.app-supporting-panels') && css.includes('.app-supporting-panels .graphic-placeholder-wall'), 'Supporting panel layout is scoped below the app workspace.');
add('mobile-menu-still-closes-on-route', mobileMenu.includes("document.addEventListener('ywi:route-shown'") && mobileMenu.includes('if (isMobile()) close();'), 'Mobile menu closes when a route is shown.');
add('cache-marker-current', index.includes('2026-08-05a') && read('server-worker.js').includes('2026-08-05a'), 'HTML and service worker use the current cache marker.');

const passed = results.filter((item) => item.ok).length;
console.log(`\nNavigation route priority check: ${passed}/${results.length} passed\n`);
for (const item of results) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.details ? ` — ${item.details}` : ''}`);
process.exit(results.some((item) => !item.ok) ? 1 : 0);

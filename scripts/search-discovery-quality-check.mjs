#!/usr/bin/env node
import fs from 'node:fs';
const read=(file)=>fs.readFileSync(file,'utf8');
const checks=[]; const add=(name,ok,detail='')=>checks.push({name,ok:!!ok,detail});
const h1=(text)=>(text.match(/<h1\b/gi)||[]).length;
const generator=read('scripts/generate-public-routes.mjs');
const routes=read('js/public-routes.js');
const migration=read('sql/196_search_discovery_quality.sql');
const index=read('index.html');
const help=read('help.html');
const robots=read('robots.txt');
const sitemap=read('sitemap.xml');
const browser=read('tests/browser/help-seo-layout.spec.mjs');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/staging-browser-integration.yml');
const docs=[read('README.md'),read('docs/ACTIVE_PROJECT_HANDBOOK.md'),read('docs/NEXT_STEPS_AND_SANITY_CHECK.md')];

add('schema196-migration-present',fs.existsSync('sql/196_search_discovery_quality.sql'));
add('schema196-assertions-present',/ywi_search_discovery_quality_assertions/.test(migration));
add('schema196-sitemap-origin-assertion',/active_sitemap_canonical_origin/.test(migration)&&/yardweasels\.ca/.test(migration));
add('schema196-sitemap-path-assertion',/active_sitemap_route_matches_canonical/.test(migration));
add('schema196-lastmod-assertion',/active_sitemap_lastmod_truthful/.test(migration)&&/last_modified>current_date/.test(migration));
add('schema196-business-rails-unchanged',/open_business_acceptance_unchanged/.test(migration)&&/\)=11/.test(migration));
add('schema196-finance-provider-off',/finance_provider_execution_off/.test(migration)&&/provider_mutation_enabled=true/.test(migration));
add('schema196-no-external-submission',/search_engine_submission',false/.test(migration));
add('schema196-drift-marker',/select\s+196::int\s+as\s+expected_schema_version/i.test(migration)&&/196_search_discovery_quality/.test(migration));

add('generator-git-derived-home-lastmod',/execFileSync\('git'/.test(generator)&&/gitLastmod\('index\.html'/.test(generator));
add('generator-no-hardcoded-home-lastmod',!/last_modified:\s*['"]20\d{2}-\d{2}-\d{2}['"]/.test(generator));
add('generator-canonical-route-conflict-fails',/Canonical URL disagrees with approved route path/.test(generator));
add('generator-sitemap-conflict-fails',/Sitemap canonical disagrees with route path/.test(generator));
add('generator-route-payload-parity',/Route payload path disagrees with sitemap/.test(generator));
add('generator-future-lastmod-fails',/Future sitemap lastmod/.test(generator));
add('generator-structured-graph',/['"]WebPage['"]/.test(generator)&&/['"]Service['"]/.test(generator)&&/['"]BreadcrumbList['"]/.test(generator));
add('generator-social-parity',/twitter:card/.test(generator)&&/og:image:alt/.test(generator)&&/twitter:image:alt/.test(generator));

add('runtime-canonical-state',/function\s+canonicalState\b/.test(routes));
add('runtime-canonical-conflict-noindex',/canonicalInfo\.consistent\s*\?\s*publicIndexDirective\(\)\s*:\s*['"]noindex,follow['"]/.test(routes));
add('runtime-canonical-conflict-observable',/dataset\.canonicalConsistency/.test(routes));
add('runtime-structured-graph',/['"]WebPage['"]/.test(routes)&&/['"]Service['"]/.test(routes)&&/['"]BreadcrumbList['"]/.test(routes));
add('runtime-social-cleanup',/removeProperty\('og:image'\)/.test(routes)&&/removeMeta\('twitter:image'\)/.test(routes));
add('runtime-single-h1',/demoteAppShellH1\(\)/.test(routes)&&h1(routes)===2,`renderer literal H1=${h1(routes)}`);

add('home-one-h1',h1(index)===1,`H1=${h1(index)}`);
add('help-one-h1',h1(help)===1,`H1=${h1(help)}`);
add('help-noindex',/noindex,nofollow,noarchive,nosnippet/i.test(help));
add('help-search-discovery-current',/sitemap/i.test(help)&&/fresh/i.test(help)&&/structured data/i.test(help)&&/external search-engine submission/i.test(help));
add('robots-canonical-sitemap',/Sitemap:\s*https:\/\/yardweasels\.ca\/sitemap\.xml/i.test(robots));
add('robots-allows-help-to-see-noindex',!/^Disallow:\s*\/help\.html/im.test(robots));
add('static-sitemap-root-canonical',/<loc>https:\/\/yardweasels\.ca\/<\/loc>/.test(sitemap));
add('static-sitemap-has-date-lastmod',/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(sitemap));
add('static-sitemap-no-obsolete-priority',!/<changefreq>|<priority>/.test(sitemap));

add('browser-phone-desktop-matrix',/name:'phone'/.test(browser)&&/name:'desktop'/.test(browser));
add('browser-structured-data-proof',/publicSchemaTypes/.test(browser)&&/BreadcrumbList/.test(browser)&&/WebPage/.test(browser));
add('browser-canonical-conflict-proof',/canonical conflict fails closed/.test(browser)&&/data-canonical-consistency/.test(browser));

add('package-search-discovery-gate',pkg.scripts?.['test:search-discovery']==='node scripts/search-discovery-quality-check.mjs');
add('workflow-search-discovery-gate',workflow.includes('npm run test:search-discovery'));
add('active-docs-no-build-ledgers',docs.every((text)=>!(/\bBuild\s+\d+\b/i.test(text))&&!(/\b[0-9a-f]{40}\b/i.test(text))));
add('active-docs-search-discovery-contract',docs.every((text)=>/sitemap/i.test(text)&&/canonical/i.test(text)&&/structured data/i.test(text)&&/fresh/i.test(text)));
add('no-automatic-indexnow-call',[generator,routes,index].every((text)=>!text.includes('api.indexnow.org')));

const passed=checks.filter((item)=>item.ok).length;
console.log(`Search discovery quality gate: ${passed}/${checks.length} passed`);
for(const item of checks) console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}${item.detail?' — '+item.detail:''}`);
process.exit(passed===checks.length?0:1);

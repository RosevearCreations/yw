import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const checks = [];
const add = (name, pass, detail = '') => checks.push({ name, pass: Boolean(pass), detail });

const pkg = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/staging-browser-integration.yml');
const browser = read('tests/browser/three-surface-interface.spec.mjs');
const index = read('index.html');
const style = read('style.css');
const handbook = read('docs/ACTIVE_PROJECT_HANDBOOK.md');
const helpSeo = read('tests/browser/help-seo-layout.spec.mjs');

add('matrix-phone-390', browser.includes("name:'phone-390'") && browser.includes('width:390'));
add('matrix-phone-430', browser.includes("name:'phone-430'") && browser.includes('width:430'));
add('matrix-desktop-1366', browser.includes("name:'desktop-1366'") && browser.includes('width:1366'));
add('matrix-desktop-1440', browser.includes("name:'desktop-1440'") && browser.includes('width:1440'));
add('browser-mobile-quick-nav', browser.includes('mobileQuickNav') && browser.includes('data-mobile-module'));
add('browser-desktop-full-nav', browser.includes('mainNav') && browser.includes('mainMenuToggle'));
add('browser-table-containment', browser.includes('table-scroll') && browser.includes('scrollWidth'));
add('browser-touch-targets', browser.includes('44') && browser.includes('mobile-quick-nav'));
add('browser-keyboard-focus', browser.includes('focus()') && browser.includes('document.activeElement'));
add('browser-public-one-h1', browser.includes("locator('h1').count()") && browser.includes('toBe(1)'));
add('browser-public-canonical', browser.includes("link[rel=\"canonical\"]") && browser.includes('https://yardweasels.ca/'));
add('browser-public-index-policy', browser.includes('meta[name="robots"]') && browser.includes('index,follow'));
add('browser-no-overflow', browser.includes('document.documentElement.scrollWidth') && browser.includes('toBeLessThanOrEqual'));
add('app-has-mobile-shortcuts', index.includes('id="mobileQuickNav"') && ['safety','finance','jobs','admin'].every((key) => index.includes(`data-mobile-module="${key}"`)));
add('app-has-desktop-module-nav', index.includes('id="mainNav"') && ['safety','finance','jobs','admin'].every((key) => index.includes(`data-module="${key}"`)));
add('mobile-nav-fixed-contract', style.includes('.mobile-quick-nav') && style.includes('position: fixed'));
add('mobile-menu-contract', style.includes('.main-menu-toggle') && style.includes('@media (max-width: 759px)'));
add('table-scroll-contract', style.includes('.table-scroll') && style.includes('overflow: auto'));
add('existing-help-seo-matrix-preserved', helpSeo.includes("name:'phone'") && helpSeo.includes("name:'desktop'") && helpSeo.includes('canonical public service webpage'));
add('handbook-three-surface-authority', handbook.includes('## Mobile, PC application and webpage layout') && handbook.includes('**Phone:**') && handbook.includes('**Desktop application:**') && handbook.includes('**Public webpage:**'));
add('package-source-gate', pkg.scripts?.['test:three-surface'] === 'node scripts/three-surface-interface-enforcement-check.mjs');
add('package-browser-gate', pkg.scripts?.['test:browser:three-surface'] === 'playwright test --config=playwright.config.mjs tests/browser/three-surface-interface.spec.mjs');
add('workflow-source-gate', workflow.includes('npm run test:three-surface'));
add('workflow-browser-gate', workflow.includes('npm run test:browser:three-surface'));
add('no-schema-side-effect', !browser.includes('SUPABASE_SERVICE_ROLE_KEY') && !workflow.includes('test:browser:three-surface\n        env:'));

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'}  ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
}
const failed = checks.filter((check) => !check.pass);
console.log(`\nBuild 203 three-surface interface source gate: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);

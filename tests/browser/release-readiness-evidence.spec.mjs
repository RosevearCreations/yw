import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const css = fs.readFileSync('style.css', 'utf8');

async function mountReleaseReview(page, width) {
  await page.setViewportSize({ width, height: width <= 430 ? 900 : 960 });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>
    *{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden}.fixture{max-width:1180px;margin:0 auto;padding:20px}.review-banner{padding:12px 14px;border:1px solid rgba(148,163,184,.25);border-radius:12px;margin-bottom:14px}.release-summary{display:grid;gap:12px}.release-summary article{padding:14px;border:1px solid rgba(148,163,184,.2);border-radius:12px}.operations-form button{min-height:44px}
  </style></head><body><main class="fixture"><section id="operationsCockpit" class="operations-cockpit"><header><span class="operations-kicker">Release authority</span><h1>Release readiness evidence</h1><p class="review-banner"><strong>REVIEW ONLY.</strong> This screen records release evidence. It does not deploy code or promote Production.</p></header>
  <div id="oc_release_dashboard" class="oc-release-dashboard"><div class="release-summary oc-release-gates"><article><span>Source evidence</span><strong>Ready for review</strong><small>Exact-source and workflow evidence are reviewed here.</small></article><article><span>Staging evidence</span><strong>Human evidence required</strong><small>Live staging remains separately guarded.</small></article><article><span>Production decision</span><strong>Not performed</strong><small>No Production release was performed by this review.</small></article></div></div>
  <form id="oc_release_snapshot_form" class="operations-form"><label>Review scope<select name="review_scope"><option value="staging">Staging evidence</option><option value="production_candidate">Production-candidate review</option></select></label><label>Confirmation<input name="confirmation_phrase" maxlength="80" placeholder="Type REVIEW ONLY" required></label><label class="operations-span">Reviewer note<textarea name="reviewer_note" maxlength="2000" placeholder="What was reviewed, what remains, and any release decision outside this app."></textarea></label><button type="submit" data-oc-permission="release_readiness_snapshot">Capture evidence snapshot</button><small class="operations-span">This records evidence only. It cannot deploy code, publish routes, or change payment status.</small></form>
  </section></main></body></html>`);
}

for (const viewport of [{ name:'phone', width:390 }, { name:'desktop', width:1440 }]) {
  test(`release readiness evidence remains review-only on ${viewport.name}`, async ({ page }) => {
    await mountReleaseReview(page, viewport.width);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('.review-banner')).toContainText(/REVIEW ONLY/i);
    await expect(page.locator('#oc_release_dashboard')).toContainText(/Production decision/i);
    await expect(page.locator('#oc_release_dashboard')).toContainText(/Not performed/i);
    await expect(page.locator('select[name="review_scope"] option')).toHaveCount(2);
    await expect(page.locator('input[name="confirmation_phrase"]')).toHaveAttribute('placeholder', 'Type REVIEW ONLY');
    await expect(page.getByRole('button', { name:'Capture evidence snapshot' })).toBeVisible();
    await expect(page.locator('#oc_release_snapshot_form')).toContainText(/cannot deploy code, publish routes, or change payment status/i);
    const body = (await page.locator('body').innerText()).toLowerCase();
    for (const forbidden of ['deploy production', 'promote production', 'release now', 'enable finance posting', 'charge customer']) expect(body).not.toContain(forbidden);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const buttonBox = await page.getByRole('button', { name:'Capture evidence snapshot' }).boundingBox();
    expect(buttonBox?.height || 0).toBeGreaterThanOrEqual(44);
  });
}

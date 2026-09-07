import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const css = fs.readFileSync('style.css', 'utf8');
const portalRuntime = fs.readFileSync('js/customer-portal.js', 'utf8');

async function mountPortal(page, viewport) {
  await page.setViewportSize(viewport);
  await page.setContent(`<!doctype html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex,nofollow,noarchive,nosnippet">
    <style>${css}</style>
    </head><body class="customer-portal-mode">
    <main id="customerPortalView" class="customer-portal-shell">
      <header class="customer-portal-header">
        <a class="customer-portal-brand" href="/"><span class="customer-portal-mark">YWI</span><span><strong>Yard Weasels Inc.</strong><small>Secure customer quote portal</small></span></a>
        <span class="customer-portal-security">Token-protected link</span>
      </header>
      <section class="customer-portal-status customer-portal-status-success">Quote loaded securely.</section>
      <section class="customer-portal-hero"><div><span class="customer-portal-kicker">Quote Q-210</span><h1>Your service quote</h1><p>Review, accept, pay a hosted deposit, and follow service progress from one secure page.</p></div><div class="customer-portal-hero-visual"><strong>Approved service visual</strong><small>Customer-safe evidence only.</small></div></section>
      <section class="customer-portal-summary"><article><small>Estimate</small><strong>$1,250.00</strong></article><article><small>Deposit</small><strong>$250.00</strong></article><article><small>Status</small><strong>Accepted</strong></article><article class="customer-portal-total"><small>Total</small><strong>$1,250.00</strong></article></section>
      <section class="customer-portal-updates"><header><div><span class="customer-portal-kicker">Live service updates</span><h2>Work progress shared with you</h2></div></header><ol><li class="customer-portal-update"><article><header><div><span>Work in progress</span><h3>Crew arrived</h3></div></header><p>Your service is underway.</p></article></li></ol></section>
      <section class="customer-portal-proofs"><header><div><span class="customer-portal-kicker">Approved proof</span><h2>Arrival, completion, and service evidence</h2></div></header><ol><li class="customer-portal-proof"><article><h3>Completion proof approved</h3><p>Approved customer-safe evidence is ready.</p></article></li></ol></section>
      <section class="customer-portal-closeout"><header><div><span class="customer-portal-kicker">Final closeout</span><h2>Review completed work</h2></div><strong class="is-off">Signoff requested</strong></header><p>The supervisor-approved summary is ready.</p><form class="customer-portal-form customer-portal-closeout-form"><label>Your name<input type="text" value="Customer"></label><div class="customer-portal-button-row"><button class="primary" type="button">Approve completed work</button><button class="secondary" type="button">Request follow-up</button></div></form></section>
      <section class="customer-portal-notification-preference"><header><div><span class="customer-portal-kicker">Your choice</span><h2>Service update email</h2></div><strong class="is-on">Email updates are on</strong></header><form class="customer-portal-form"><label>Contact email<input type="email" value="customer@example.invalid"></label><button class="primary" type="button">Save email preference</button></form></section>
      <div class="customer-portal-layout"><article class="customer-portal-document"><div class="customer-portal-section-heading"><span>Quote details</span><small>Status: accepted</small></div><div class="customer-portal-document-body"><h2>Approved scope</h2><p>Customer-visible scope and totals.</p></div></article><aside class="customer-portal-actions-panel"><section class="customer-portal-progress"><h2>Progress</h2><ol><li class="is-complete"><span>1</span><div><strong>Quote available</strong><small>Ready</small></div></li><li class="is-complete"><span>2</span><div><strong>Quote acceptance</strong><small>Accepted</small></div></li><li class="is-current"><span>3</span><div><strong>Deposit</strong><small>Hosted checkout</small></div></li><li><span>4</span><div><strong>Scheduling</strong><small>Pending</small></div></li></ol></section><section class="customer-portal-deposit"><h2>Deposit</h2><button class="primary" type="button">Pay deposit securely</button><small>Payment is completed on Stripe Checkout.</small></section><section class="customer-portal-schedule"><h2>Dispatch and schedule</h2><dl><div><dt>Work order</dt><dd>WO-210</dd></div><div><dt>Scheduled</dt><dd>Sep 10</dd></div></dl></section></aside></div>
      <footer class="customer-portal-footer"><strong>Need help?</strong><span>Use the follow-up form. Never send payment-card details in a message.</span></footer>
    </main>
    </body></html>`);
}

for (const viewport of [{name:'phone-390',width:390,height:844},{name:'phone-430',width:430,height:932}]) {
  test(`${viewport.name} customer portal remains usable, private and overflow-free`, async ({ page }) => {
    await mountPortal(page, viewport);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('#operationsCockpit')).toHaveCount(0);
    await expect(page.locator('.customer-portal-updates')).toBeVisible();
    await expect(page.locator('.customer-portal-proofs')).toBeVisible();
    await expect(page.locator('.customer-portal-closeout')).toBeVisible();
    await expect(page.locator('.customer-portal-notification-preference')).toBeVisible();
    await expect(page.getByRole('button', { name:'Pay deposit securely' })).toBeVisible();
    await expect(page.getByRole('button', { name:'Approve completed work' })).toBeVisible();
    await expect(page.locator('.customer-portal-security')).toBeHidden();
    const inputHeights = await page.locator('.customer-portal-form input').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(Math.min(...inputHeights)).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const body = (await page.locator('body').innerText()).toLowerCase();
    for (const forbidden of ['labour $','material $','equipment $','margin $','staff-only note','private review path','service role key']) expect(body).not.toContain(forbidden);
  });
}

test('desktop customer portal preserves two-column quote/action workspace without staff controls', async ({ page }) => {
  await mountPortal(page, {width:1440,height:960});
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('.customer-portal-security')).toBeVisible();
  const layout = page.locator('.customer-portal-layout');
  const children = layout.locator(':scope > *');
  await expect(children).toHaveCount(2);
  const boxes = await children.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()));
  expect(Math.abs(boxes[0].top - boxes[1].top)).toBeLessThan(8);
  expect(boxes[0].width).toBeGreaterThan(boxes[1].width);
  await expect(page.locator('#operationsCockpit')).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

function build255PortalState({ depositStatus='requested', paidAmount=0 } = {}) {
  return {
    quote_package_id:'55111111-1111-4111-8111-111111111111',
    package_status:'accepted',
    rendered_title:'Build 255 Stripe test-mode acceptance',
    rendered_html:'<h2>Approved scope</h2><p>Disposable test customer acceptance fixture.</p>',
    rendered_markdown:'',
    accepted_at:'2026-09-07T18:00:00Z',
    accepted_by_name:'Build 255 Test Customer',
    deposit_required_amount:250,
    deposit_status:depositStatus,
    estimate:{
      id:'55222222-2222-4222-8222-222222222222', number:'Q-BUILD255-TEST', status:'accepted',
      subtotal:1000, tax_total:130, total:1130, valid_until:'2026-09-30'
    },
    customer:{ name:'Build 255 Test Customer' },
    work_order:{ id:'55333333-3333-4333-8333-333333333333', number:'WO-BUILD255-TEST', status:'accepted', scheduled_start:null, scheduled_end:null, schedule_status:'pending' },
    deposit:{
      id:'55444444-4444-4444-8444-444444444444', status:depositStatus,
      requested_amount:250, paid_amount:paidAmount, receipt_url:null
    },
    live_updates:[], execution_proofs:[], closeouts:[],
    notification_preferences:{ live_work_update_email_opt_in:false, consent_status:'unknown', email_configured:false }
  };
}

async function mountBuild255RealPortal(page, { query='', state=build255PortalState(), checkoutResponse=null, calls=null } = {}) {
  const portalToken = 'build255StripePortalToken123456789';
  const recorded = calls || [];
  await page.exposeFunction('__recordBuild255PortalCall', (payload) => { recorded.push(payload); });
  await page.route('https://portal.test/**', (route) => route.fulfill({
    status:200,
    contentType:'text/html',
    body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><header class="app-header"><h1>Yard Weasels</h1></header></body></html>`
  }));
  await page.goto(`https://portal.test/?portal=${portalToken}${query}`);
  await page.evaluate(({ state, checkoutResponse }) => {
    window.__build255PortalState = state;
    window.__build255CheckoutResponse = checkoutResponse;
    window.YWIAPI = {
      customerPortal: async (payload) => {
        await window.__recordBuild255PortalCall(JSON.parse(JSON.stringify(payload)));
        if (payload?.action === 'load') return { ok:true, portal:window.__build255PortalState };
        if (payload?.action === 'create_deposit_checkout') return window.__build255CheckoutResponse;
        return { ok:true, portal:window.__build255PortalState };
      }
    };
  }, { state, checkoutResponse });
  await page.addScriptTag({ content:portalRuntime });
  await expect(page.locator('#customerPortalView')).toBeVisible();
  return { portalToken, recorded };
}

test('Build 255 real portal keeps a blocked live-key test-mode checkout on YWI and restores the customer action', async ({ page }) => {
  const calls = [];
  await mountBuild255RealPortal(page, {
    calls,
    checkoutResponse:{
      ok:false,
      error:'Stripe live key cannot be used while STRIPE_CHECKOUT_MODE=test.',
      details:{ allowed:false, provider_mode:'test', code:'stripe_key_mode_mismatch', test_mode:true }
    }
  });

  const depositButton = page.getByRole('button', { name:'Pay deposit securely' });
  await expect(depositButton).toBeVisible();
  await depositButton.click();
  await expect(page.locator('#customerPortalStatus')).toContainText('Stripe live key cannot be used while STRIPE_CHECKOUT_MODE=test.');
  await expect(depositButton).toBeEnabled();
  await expect(depositButton).toHaveText('Pay deposit securely');
  expect(page.url()).toMatch(/^https:\/\/portal\.test\//);
  expect(calls.find((call) => call.action === 'create_deposit_checkout')).toMatchObject({
    token:'build255StripePortalToken123456789', action:'create_deposit_checkout'
  });
  await expect(page.locator('input[name*="card" i],input[autocomplete="cc-number"],input[autocomplete="cc-csc"]')).toHaveCount(0);
});

test('Build 255 real portal sends the intended action then leaves YWI for hosted Stripe test Checkout', async ({ page }) => {
  const calls = [];
  await page.route('https://checkout.stripe.test/**', (route) => route.fulfill({
    status:200, contentType:'text/html', body:'<!doctype html><html><body><main><h1>Hosted Stripe test Checkout fixture</h1></main></body></html>'
  }));
  await mountBuild255RealPortal(page, {
    calls,
    checkoutResponse:{
      ok:true,
      checkout_url:'https://checkout.stripe.test/session/cs_test_build255',
      stripe_policy:{ allowed:true, provider_mode:'test', environment:'staging', code:'stripe_test_mode', test_mode:true }
    }
  });

  await Promise.all([
    page.waitForURL('https://checkout.stripe.test/session/cs_test_build255'),
    page.getByRole('button', { name:'Pay deposit securely' }).click()
  ]);
  expect(calls.find((call) => call.action === 'create_deposit_checkout')).toMatchObject({
    token:'build255StripePortalToken123456789', action:'create_deposit_checkout'
  });
  await expect(page.getByRole('heading', { name:'Hosted Stripe test Checkout fixture' })).toBeVisible();
  await expect(page.locator('input')).toHaveCount(0);
});

test('Build 255 deposit success return waits for webhook-confirmed state instead of claiming payment early', async ({ page }) => {
  await mountBuild255RealPortal(page, {
    query:'&deposit=success',
    state:build255PortalState({ depositStatus:'processing', paidAmount:0 }),
    checkoutResponse:null
  });
  await expect(page.locator('#customerPortalStatus')).toContainText('Payment was submitted. The confirmed deposit status appears below when the payment webhook has finished.');
  await expect(page.getByRole('heading', { name:'Deposit received' })).toHaveCount(0);
  await expect(page.getByRole('button', { name:'Pay deposit securely' })).toBeVisible();
});

test('Build 255 real portal renders Deposit received only after returned portal state is paid', async ({ page }) => {
  await mountBuild255RealPortal(page, {
    state:build255PortalState({ depositStatus:'paid', paidAmount:250 }),
    checkoutResponse:null
  });
  await expect(page.getByRole('heading', { name:'Deposit received' })).toBeVisible();
  await expect(page.getByText('$250.00 recorded.', { exact:false })).toBeVisible();
  await expect(page.getByRole('button', { name:'Pay deposit securely' })).toHaveCount(0);
  const body = (await page.locator('body').innerText()).toLowerCase();
  for (const forbidden of ['card number','cvv','cvc','expiration date','service role key','sk_test_','sk_live_']) expect(body).not.toContain(forbidden);
});

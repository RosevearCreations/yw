import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const css = fs.readFileSync('style.css', 'utf8');
const portalRuntime = fs.readFileSync('js/customer-portal.js', 'utf8');

function portalState({ depositStatus='requested', paidAmount=0 } = {}) {
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

async function mountRealPortal(page, { query='', state=portalState(), checkoutResponse=null, calls=null } = {}) {
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

test('real portal keeps a blocked live-key/test-mode checkout on YWI and restores the customer action', async ({ page }) => {
  const calls = [];
  await mountRealPortal(page, {
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

test('real portal sends the intended deposit action then leaves YWI for hosted Stripe test Checkout', async ({ page }) => {
  const calls = [];
  await page.route('https://checkout.stripe.test/**', (route) => route.fulfill({
    status:200, contentType:'text/html', body:'<!doctype html><html><body><main><h1>Hosted Stripe test Checkout fixture</h1></main></body></html>'
  }));
  await mountRealPortal(page, {
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

test('deposit success return waits for webhook-confirmed state instead of claiming payment early', async ({ page }) => {
  await mountRealPortal(page, {
    query:'&deposit=success',
    state:portalState({ depositStatus:'processing', paidAmount:0 }),
    checkoutResponse:null
  });
  await expect(page.locator('#customerPortalStatus')).toContainText('Payment was submitted. The confirmed deposit status appears below when the payment webhook has finished.');
  await expect(page.getByRole('heading', { name:'Deposit received' })).toHaveCount(0);
  await expect(page.getByRole('button', { name:'Pay deposit securely' })).toBeVisible();
});

test('real portal renders Deposit received only after returned portal state is paid', async ({ page }) => {
  await mountRealPortal(page, {
    state:portalState({ depositStatus:'paid', paidAmount:250 }),
    checkoutResponse:null
  });
  await expect(page.getByRole('heading', { name:'Deposit received' })).toBeVisible();
  await expect(page.getByText('$250.00 recorded.', { exact:false })).toBeVisible();
  await expect(page.getByRole('button', { name:'Pay deposit securely' })).toHaveCount(0);
  const body = (await page.locator('body').innerText()).toLowerCase();
  for (const forbidden of ['card number','cvv','cvc','expiration date','service role key','sk_test_','sk_live_']) expect(body).not.toContain(forbidden);
});

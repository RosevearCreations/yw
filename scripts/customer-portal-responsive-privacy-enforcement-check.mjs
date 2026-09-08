#!/usr/bin/env node
/** Build 210 + Build 255 + Build 256: deterministic customer-portal responsive/privacy/provider-mode release authority. */
import fs from 'node:fs';
import {
  resolveStripeCheckoutPolicy,
  resolveStripeRuntimeMode,
  resolveStripeWebhookPolicy,
  publicStripePolicy
} from '../supabase/functions/_shared/stripe-runtime-policy.mjs';
import {
  evaluateStripeAcceptancePreflight,
  STRIPE_ACCEPTANCE_CONFIRM,
  STRIPE_ACCEPTANCE_DATA_SCOPE,
  STRIPE_ACCEPTANCE_RAIL
} from './customer-portal-stripe-acceptance-preflight.mjs';

const read = (path) => fs.readFileSync(path, 'utf8');
const hasAll = (text, values) => values.every((value) => text.includes(value));
const checks = [];
const add = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail });
const expectPolicy = (name, policy, expected) => {
  const ok = Object.entries(expected).every(([key,value]) => policy?.[key] === value);
  add(name, ok, `${policy?.code || 'no-code'} / ${policy?.mode || 'no-mode'} / allowed=${String(policy?.allowed)}`);
};

const portal = read('js/customer-portal.js');
const portalFn = read('supabase/functions/customer-portal/index.ts');
const webhookFn = read('supabase/functions/stripe-webhook/index.ts');
const stripePolicySource = read('supabase/functions/_shared/stripe-runtime-policy.mjs');
const stripeAcceptancePreflightSource = read('scripts/customer-portal-stripe-acceptance-preflight.mjs');
const runbook = read('sql/188_open_rail_acceptance_readiness.sql');
const css = read('style.css');
const workflow = read('.github/workflows/staging-browser-integration.yml');
const oldBrowser = read('tests/browser/operations-portal.spec.mjs');
const portalBrowser = read('tests/browser/customer-portal-responsive-privacy.spec.mjs');

add('token-mode-is-explicit', hasAll(portal, ["params.get('portal')", "document.body.classList.add('customer-portal-mode')"]), 'Portal mode requires an explicit URL token and hides the protected staff shell.');
add('portal-is-noindex', portal.includes("ensureMeta('robots','noindex,nofollow,noarchive,nosnippet')"), 'Tokenized customer portals stay out of search indexes.');
add('single-h1-contract', hasAll(portal, ['demoteAppShellH1()', 'customer-portal-hero', '<h1>${esc(row.rendered_title']), 'The app-shell H1 is demoted before the portal renders its single customer H1.');
add('html-and-url-sanitization', hasAll(portal, ['function sanitizeHtml', 'const allowed = new Set', "['http:','https:'].includes(parsed.protocol)"]), 'Customer document HTML and media URLs remain bounded to the safe renderer.');
add('quote-acceptance-is-wired', portal.includes("action:'accept_quote'"), 'Quote acceptance remains a deliberate customer action.');
add('deposit-checkout-is-hosted', hasAll(portal, ["action:'create_deposit_checkout'", 'Stripe Checkout', 'Card details are not entered into this application.']), 'Card entry remains outside the YWI portal.');
add('notification-preference-is-explicit', portal.includes("action:'set_live_update_notifications'"), 'Customer email consent remains explicitly changeable from the portal.');
add('closeout-signoff-is-explicit', portal.includes("action:'sign_closeout'"), 'Customer closeout approval/follow-up remains an explicit action.');
add('customer-lifecycle-panels-exist', hasAll(portal, ['liveUpdateTimeline(liveUpdates)', 'executionProofTimeline(executionProofs)', 'closeoutPackagePanel(closeouts)', 'notificationPreferencePanel(notificationPreference)']), 'Updates, approved proof, closeout and notification preference remain part of one customer surface.');
add('customer-server-view-remains-bounded', hasAll(portalFn, ['v_customer_portal_live_updates', 'v_customer_portal_execution_proofs']), 'Server-side customer reads continue through portal-safe views.');
add('internal-cost-fields-not-rendered', !portal.includes('row.margin_amount') && !portal.includes('row.labour_cost_total') && !portal.includes('row.material_cost_total') && !portal.includes('row.equipment_cost_total') && !portal.includes('row.staff_notes'), 'Internal costing and staff-note fields are not rendered by customer-portal.js.');
add('responsive-portal-css-exists', hasAll(css, ['.customer-portal-layout{display:grid', '@media(max-width:960px)', '@media(max-width:620px)', '.customer-portal-shell,.public-route-shell']), 'Portal has distinct desktop/tablet/phone layout rules.');
add('legacy-live-portal-case-stays-staging-only', hasAll(oldBrowser, ['YWI_E2E_PORTAL_URL', 'disposable STAGING portal token']), 'Optional live portal evidence remains staging-only and separate from deterministic CI.');
add('build210-source-gate-is-mandatory', workflow.includes('node scripts/customer-portal-responsive-privacy-enforcement-check.mjs'), 'Customer portal source authority is required by the release workflow.');
add('build210-browser-gate-is-mandatory', workflow.includes('tests/browser/customer-portal-responsive-privacy.spec.mjs'), 'Customer portal rendered acceptance is required by the release workflow.');
add('three-surface-regression-remains-mandatory', hasAll(workflow, ['npm run test:three-surface', 'npm run test:browser:three-surface']), 'Mobile app, desktop app and public website regression still run alongside the portal gate.');

expectPolicy('build255-default-test-checkout-allows-test-key', resolveStripeCheckoutPolicy({ secretKey:'sk_test_build255' }), {
  allowed:true, mode:'test', keyMode:'test', code:'stripe_test_mode'
});
expectPolicy('build255-default-test-checkout-blocks-live-key', resolveStripeCheckoutPolicy({ secretKey:'sk_live_build255' }), {
  allowed:false, mode:'test', keyMode:'live', code:'stripe_key_mode_mismatch'
});
expectPolicy('build255-missing-secret-fails-closed', resolveStripeCheckoutPolicy({ secretKey:'' }), {
  allowed:false, mode:'test', keyMode:'missing', code:'stripe_secret_missing'
});
expectPolicy('build255-unrecognized-secret-fails-closed', resolveStripeCheckoutPolicy({ secretKey:'not-a-stripe-key' }), {
  allowed:false, mode:'test', keyMode:'unrecognized', code:'stripe_secret_unrecognized'
});
expectPolicy('build255-invalid-provider-mode-fails-closed', resolveStripeRuntimeMode({ requestedMode:'sandbox' }), {
  allowed:false, mode:'sandbox', code:'stripe_mode_invalid'
});
expectPolicy('build255-live-mode-blocked-outside-production', resolveStripeCheckoutPolicy({
  secretKey:'sk_live_build255', requestedMode:'live', environment:'staging', liveCheckoutEnabled:'true'
}), {
  allowed:false, mode:'live', code:'stripe_live_requires_production_environment'
});
expectPolicy('build255-live-mode-blocked-without-explicit-enable', resolveStripeCheckoutPolicy({
  secretKey:'sk_live_build255', requestedMode:'live', environment:'production', liveCheckoutEnabled:'false'
}), {
  allowed:false, mode:'live', code:'stripe_live_requires_explicit_enable'
});
expectPolicy('build255-live-mode-requires-three-explicit-facts', resolveStripeCheckoutPolicy({
  secretKey:'sk_live_build255', requestedMode:'live', environment:'production', liveCheckoutEnabled:'true'
}), {
  allowed:true, mode:'live', keyMode:'live', code:'stripe_live_explicitly_enabled'
});
expectPolicy('build255-test-webhook-event-allowed-by-default', resolveStripeWebhookPolicy({ eventLivemode:false }), {
  allowed:true, mode:'test', eventLivemode:false, code:'stripe_test_mode'
});
expectPolicy('build255-live-webhook-event-blocked-by-default', resolveStripeWebhookPolicy({ eventLivemode:true }), {
  allowed:false, mode:'test', eventLivemode:true, code:'stripe_event_mode_mismatch'
});
expectPolicy('build255-missing-webhook-livemode-fails-closed', resolveStripeWebhookPolicy({}), {
  allowed:false, mode:'test', code:'stripe_event_mode_missing'
});
expectPolicy('build255-live-webhook-requires-explicit-production-enable', resolveStripeWebhookPolicy({
  requestedMode:'live', environment:'production', liveCheckoutEnabled:'true', eventLivemode:true
}), {
  allowed:true, mode:'live', eventLivemode:true, code:'stripe_live_explicitly_enabled'
});
expectPolicy('build255-test-event-blocked-in-explicit-live-mode', resolveStripeWebhookPolicy({
  requestedMode:'live', environment:'production', liveCheckoutEnabled:'true', eventLivemode:false
}), {
  allowed:false, mode:'live', eventLivemode:false, code:'stripe_event_mode_mismatch'
});

const publicPolicy = publicStripePolicy(resolveStripeCheckoutPolicy({ secretKey:'sk_test_BUILD255_SECRET_MUST_NOT_LEAK' }));
add('build255-public-policy-is-secret-free',
  publicPolicy.allowed === true && publicPolicy.test_mode === true && publicPolicy.provider_mode === 'test'
  && !JSON.stringify(publicPolicy).includes('BUILD255_SECRET_MUST_NOT_LEAK')
  && !Object.prototype.hasOwnProperty.call(publicPolicy,'keyMode'),
  'Browser/observability policy exposes mode and decision only, never secret/key classification.');

add('build255-shared-policy-defaults-test', hasAll(stripePolicySource, [
  'function requestedMode', "value || 'test'", "mode:'test'", 'stripe_key_mode_mismatch',
  'stripe_live_requires_production_environment', 'stripe_live_requires_explicit_enable', 'stripe_event_mode_mismatch'
]), 'Shared policy defaults fail-closed to Stripe test mode and requires explicit Production live enable.');
add('build255-checkout-function-uses-shared-policy', hasAll(portalFn, [
  'resolveStripeCheckoutPolicy', 'STRIPE_CHECKOUT_MODE', 'STRIPE_LIVE_CHECKOUT_ENABLED', 'YWI_ENVIRONMENT',
  'if (!stripePolicy.allowed) throw new HttpError(409', 'metadata[ywi_stripe_mode]', 'metadata[ywi_environment]',
  'session?.livemode', "'cs_live_'", "'cs_test_'", 'stripe_policy:safeStripePolicy'
]), 'Hosted checkout cannot call/attach Stripe unless configured mode, secret prefix, returned livemode and session prefix agree.');
const checkoutPolicyIndex = portalFn.indexOf('const stripePolicy=resolveStripeCheckoutPolicy');
const checkoutNetworkIndex = portalFn.indexOf('const session=await stripeCheckout');
add('build255-checkout-policy-precedes-stripe-network', checkoutPolicyIndex >= 0 && checkoutNetworkIndex > checkoutPolicyIndex && portalFn.slice(checkoutPolicyIndex, checkoutNetworkIndex).includes('if (!stripePolicy.allowed)'), 'Provider-mode policy is evaluated before the Stripe Checkout network call.');
add('build255-webhook-function-uses-shared-policy', hasAll(webhookFn, [
  'resolveStripeWebhookPolicy', 'STRIPE_CHECKOUT_MODE', 'STRIPE_LIVE_CHECKOUT_ENABLED', 'eventLivemode:event?.livemode',
  "reason:'stripe_mode'", "validation_status:'failed'", 'provider_mode:stripePolicy.mode', 'event_livemode:event.livemode'
]), 'Webhook verifies provider mode and records secret-free mode evidence.');
const webhookPolicyIndex = webhookFn.indexOf('stripePolicy=resolveStripeWebhookPolicy');
const webhookDepositIndex = webhookFn.indexOf("depositId=clean(session?.metadata?.deposit_request_id");
const webhookPaidRpcIndex = webhookFn.indexOf('ywi_rpc_record_portal_deposit_paid');
add('build255-webhook-policy-precedes-deposit-mutation', webhookPolicyIndex >= 0 && webhookDepositIndex > webhookPolicyIndex && webhookPaidRpcIndex > webhookDepositIndex, 'Provider-mode decision happens before deposit lookup and paid-state mutation.');
add('build255-webhook-mode-mismatch-acknowledged-without-processing', hasAll(webhookFn, [
  'if(!stripePolicy.allowed)', "delivery_status:'failed'", "return new Response(JSON.stringify({ok:true,ignored:true,reason:'stripe_mode'"
]), 'Forbidden live/test deliveries are acknowledged to stop retries while deposit state remains untouched.');
add('build255-customer-ui-remains-hosted-no-card-entry', hasAll(portal, [
  "action:'create_deposit_checkout'", 'window.location.assign(response.checkout_url)',
  'Payment is completed on Stripe Checkout. Card details are not entered into this application.',
  "params.get('deposit') === 'success'", 'confirmed deposit status appears below when the payment webhook has finished.'
]) && !/(card_number|card-number|cvc|cvv|expiry|expiration)/i.test(portal), 'YW never renders or collects card details and waits for webhook-confirmed deposit state.');
add('build255-provider-rail-remains-test-mode-human-external', hasAll(runbook, [
  "('customer_portal_live','Run Stripe test-mode customer portal acceptance'",
  'Use Stripe test mode and a disposable/test customer flow',
  'Do not use a Production payment or enable provider mutation as a shortcut.',
  'matching validated webhook delivery',
  'human review that no Production payment/provider mutation was used.',
  '"production_payment":"forbidden"'
]), 'Build 255 strengthens the technical boundary but does not substitute for required Stripe test-mode/human evidence.');
const stripeCallerSources = `${portalFn}\n${webhookFn}`;
add('build255-no-live-enable-hardcoded', !/liveCheckoutEnabled\s*:\s*["']true["']|STRIPE_LIVE_CHECKOUT_ENABLED\s*=\s*["']?true/i.test(stripeCallerSources), 'Runtime callers read the live-enable switch from environment state and never hardcode it on.');
add('build255-no-business-rail-auto-close', !/update\s+public\.admin_scorecard_progress_rails[\s\S]{0,500}customer_portal_live/i.test(stripePolicySource + '\n' + portalFn + '\n' + webhookFn), 'Runtime policy cannot close the customer portal rail.');
add('build255-real-browser-provider-contract', hasAll(portalBrowser, [
  "const portalRuntime = fs.readFileSync('js/customer-portal.js', 'utf8')",
  'mountBuild255RealPortal', 'stripe_key_mode_mismatch',
  'Hosted Stripe test Checkout fixture', 'confirmed deposit status appears below when the payment webhook has finished.',
  "depositStatus:'paid'", 'Deposit received'
]), 'Mandatory rendered portal test executes blocked-mode, hosted-test-checkout, webhook-waiting and paid-state behavior through the real customer runtime.');

const build256Secret='sk_test_BUILD256_SECRET_MUST_NOT_LEAK';
const build256WebhookSecret='whsec_BUILD256_WEBHOOK_SECRET_MUST_NOT_LEAK';
const build256PortalToken='BUILD256_PORTAL_TOKEN_MUST_NOT_LEAK';
const build256Base={
  YWI_RUN_STRIPE_TEST_ACCEPTANCE:'1',
  YWI_STRIPE_ACCEPTANCE_CONFIRM:STRIPE_ACCEPTANCE_CONFIRM,
  YWI_STRIPE_ACCEPTANCE_DATA_SCOPE:STRIPE_ACCEPTANCE_DATA_SCOPE,
  YWI_STRIPE_ACCEPTANCE_DATA_LABEL:'TEST-BUILD256-CUSTOMER-PORTAL',
  YWI_STRIPE_ACCEPTANCE_TEST_EMAIL:'build256@example.invalid',
  YWI_STRIPE_ACCEPTANCE_PORTAL_URL:`https://yardweasels.ca/?portal=${build256PortalToken}`,
  YWI_STRIPE_ACCEPTANCE_WEBHOOK_URL:'https://stagingprojectref.supabase.co/functions/v1/stripe-webhook',
  STRIPE_CHECKOUT_MODE:'test',
  STRIPE_LIVE_CHECKOUT_ENABLED:'false',
  YWI_ENVIRONMENT:'production',
  STRIPE_SECRET_KEY:build256Secret,
  STRIPE_WEBHOOK_SIGNING_SECRET:build256WebhookSecret,
};
const build256Ready=evaluateStripeAcceptancePreflight(build256Base);
add('build256-valid-test-acceptance-preflight-is-ready',
  build256Ready.ok === true
  && build256Ready.rail === STRIPE_ACCEPTANCE_RAIL
  && build256Ready.provider_mode === 'test'
  && build256Ready.test_key_confirmed === true
  && build256Ready.live_checkout_enable_off === true
  && build256Ready.portal_token_present === true
  && build256Ready.disposable_test_email_confirmed === true
  && build256Ready.disposable_data_scope_confirmed === true
  && build256Ready.network_calls_performed === false
  && build256Ready.mutations_performed === false,
  'A fully explicit disposable Stripe TEST acceptance configuration becomes READY without performing provider/database work.');

const build256LiveKey=evaluateStripeAcceptancePreflight({...build256Base,STRIPE_SECRET_KEY:'sk_live_BUILD256_FORBIDDEN'});
add('build256-live-key-is-denied',
  build256LiveKey.ok === false
  && build256LiveKey.test_key_confirmed === false
  && build256LiveKey.errors.some((value)=>value.includes('stripe_key_mode_mismatch')),
  'Live Stripe secret keys cannot pass the test acceptance preflight.');

const build256LiveMode=evaluateStripeAcceptancePreflight({
  ...build256Base,
  STRIPE_CHECKOUT_MODE:'live',
  STRIPE_SECRET_KEY:'sk_live_BUILD256_FORBIDDEN',
  STRIPE_LIVE_CHECKOUT_ENABLED:'true'
});
add('build256-live-mode-and-enable-are-denied',
  build256LiveMode.ok === false
  && build256LiveMode.live_checkout_enable_off === false
  && build256LiveMode.errors.some((value)=>value.includes('STRIPE_CHECKOUT_MODE must be explicitly set to test'))
  && build256LiveMode.errors.some((value)=>value.includes('STRIPE_LIVE_CHECKOUT_ENABLED must not be true')),
  'Provider acceptance cannot be switched into live mode through acceptance configuration.');

const build256RealCustomer=evaluateStripeAcceptancePreflight({...build256Base,YWI_STRIPE_ACCEPTANCE_TEST_EMAIL:'customer@example.com'});
add('build256-real-customer-email-is-denied',
  build256RealCustomer.ok === false
  && build256RealCustomer.disposable_test_email_confirmed === false
  && build256RealCustomer.errors.some((value)=>value.includes('@example.invalid')),
  'Acceptance is constrained to disposable example.invalid customer identity.');

const build256MissingConfirm=evaluateStripeAcceptancePreflight({...build256Base,YWI_STRIPE_ACCEPTANCE_CONFIRM:''});
add('build256-explicit-test-only-confirmation-is-required',
  build256MissingConfirm.ok === false
  && build256MissingConfirm.test_only_confirmation === false,
  'A deliberate test-only confirmation phrase is required before READY.');

const build256PublicText=JSON.stringify(build256Ready);
add('build256-preflight-output-is-secret-and-token-free',
  !build256PublicText.includes(build256Secret)
  && !build256PublicText.includes(build256WebhookSecret)
  && !build256PublicText.includes(build256PortalToken)
  && build256PublicText.includes('"portal_token_present":true')
  && build256PublicText.includes('"webhook_signing_secret_present":true'),
  'Preflight reports secret/token presence and sanitized origins/paths only.');

add('build256-preflight-is-no-network-no-mutation-source',
  hasAll(stripeAcceptancePreflightSource,[
    'This validates configuration only.',
    'network_calls_performed:false',
    'mutations_performed:false',
    'STRIPE_CHECKOUT_MODE must be explicitly set to test',
    'STRIPE_LIVE_CHECKOUT_ENABLED must not be true',
    '@example.invalid',
    'required_manual_evidence'
  ])
  && !/\bfetch\s*\(|\baxios\b|https\.request\s*\(|supabase\.from\s*\(|\.rpc\s*\(/i.test(stripeAcceptancePreflightSource),
  'The acceptance preflight is pure configuration validation and contains no provider/database transport.');

add('build256-manual-evidence-rail-remains-open',
  build256Ready.required_manual_evidence.includes('hosted_test_checkout_completed')
  && build256Ready.required_manual_evidence.includes('matching_test_webhook_validated')
  && build256Ready.required_manual_evidence.includes('deposit_and_customer_status_transition_verified')
  && build256Ready.required_manual_evidence.includes('human_review_no_production_payment_or_live_provider_mutation')
  && hasAll(runbook,[
    'matching validated webhook delivery',
    'resulting deposit/customer-status transition',
    'human review that no Production payment/provider mutation was used.'
  ]),
  'Build 256 prepares acceptance but does not replace hosted Checkout, webhook, state-transition, or human evidence.');

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
if (failed.length) process.exit(1);
console.log(`Customer portal authority passed (${checks.length}/${checks.length}), including Build 255 provider-mode enforcement and Build 256 Stripe acceptance preflight.`);

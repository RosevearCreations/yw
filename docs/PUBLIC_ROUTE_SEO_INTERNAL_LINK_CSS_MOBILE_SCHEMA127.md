# Public Route SEO, Internal Link, CSS, and Mobile Guardrails — Schema 127

Last refreshed: **2026-06-02b**

Schema 127 adds DB-visible guardrails for the next round of public SEO and mobile-depth work.

## Added tables/views

- `app_public_route_seo_registry` / `v_app_public_route_seo_registry`
- `app_internal_link_suggestion_queue` / `v_app_internal_link_suggestion_queue`
- `app_css_component_token_inventory` / `v_app_css_component_token_inventory`
- `app_mobile_field_action_queue` / `v_app_mobile_field_action_queue`
- `app_release_manifest_checks` / `v_app_release_manifest_checks`

## Why this matters

The app now has a DB-backed place to track title/H1/meta/local wording, internal link suggestions, CSS drift risks, phone-first field actions, and release packaging checks. This keeps the roadmap and known gaps visible in Admin instead of hiding them only in Markdown.

## UI updates

Admin Production Readiness now renders compact tables for the schema 127 views. The Equipment page also has a manual **Scan / Enter Code** fallback so QR/barcode values can be captured even before camera scanning is finished.

## Next pass focus

Payment application actions, bank CSV preview, reconciliation manual match/undo, remittance proof, close lock/reopen controls, real camera scan, reusable accessory templates, verifier-role enforcement, and generated release manifest files.
<!-- 2026-06-02b pass: schema 127 public route SEO registry, internal links, CSS token inventory, mobile field actions, release manifest checks, Admin readiness visibility, scan fallback, archive hygiene, cache marker, and Markdown refresh. -->

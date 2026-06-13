# Schema 143 Desktop/Mobile Visual SEO CSS Runtime Source Controls

Build: **2026-06-12a**  
Schema: **143**

This pass adds a dedicated readiness layer for keeping the app sharp on both desktop website/Admin surfaces and mobile field-app surfaces. It also tracks professional visual enrichment, local-search content depth, CSS/motion/image guardrails, schema deploy validation, and JSON/DB source-consolidation decisions.

## Added queues and views

- `app_desktop_mobile_surface_parity_queue` / `v_app_desktop_mobile_surface_parity_queue`
- `app_visual_professional_enrichment_queue` / `v_app_visual_professional_enrichment_queue`
- `app_local_search_content_depth_queue` / `v_app_local_search_content_depth_queue`
- `app_css_motion_image_guard_queue` / `v_app_css_motion_image_guard_queue`
- `app_schema_deploy_validation_queue` / `v_app_schema_deploy_validation_queue`
- `app_source_consolidation_decision_queue` / `v_app_source_consolidation_decision_queue`

## Public shell update

The public shell now includes a professional desktop/mobile readiness strip that explains the desktop website/Admin surface, the mobile field-app surface, and visual polish direction without adding another H1.

## Deployment order

1. Confirm repaired schema 141 has applied if the live DB previously failed on `proof_area`/`payment_area`.
2. Apply schema 142 if not already applied.
3. Apply schema 143.
4. Redeploy `admin-directory`.
5. Redeploy `jobs-manage` and `jobs-directory` only if live versions are behind.
6. Clear service worker/cache so `2026-06-12a` assets load.

## Smoke coverage

The smoke script checks schema 143 markers, Admin view loading, Admin UI table bindings, desktop/mobile visual strip, CSS brace balance, one public H1, sitemap freshness, robots presence, and cache version.

# Active Project Handbook

**Release:** `2026-07-12a`  
**Schema target:** `157`  
**Business model:** local service operations with quote intake, customer portal, deposits, dispatch, proof-of-work, internal job costing, accountant handoff, and approved local SEO pages.

## Current direction

The platform is moving from separate admin forms toward one controlled field-service workflow:

1. Quote request and owner follow-up.
2. Customer portal quote review and acceptance.
3. Stripe-hosted deposit request with webhook-controlled paid status.
4. Dispatch scheduling and live staff/customer updates.
5. Consent-controlled customer email notifications.
6. Service-execution proof with arrival/completion evidence and internal cost capture.
7. Accountant-ready export and release-readiness evidence.
8. Approved public route pages and sitemap entries only after SEO and media gates pass.

## Schema 157 service-execution proof

Schema 157 adds a proof and internal costing layer:

- `work_order_execution_proofs` records arrival, progress, completion, quality, material, equipment, expense, and service-note proof.
- `work_order_execution_proof_media` links approved visual assets to proof records.
- `v_work_order_execution_cost_dashboard` compares approved actual labour/material/equipment/other cost against the accepted work-order estimate.
- `v_work_order_execution_proof_queue` feeds the Operations Cockpit review queue.
- `v_customer_portal_execution_proofs` exposes only approved customer-safe proof summaries and approved public images.
- `ywi_rpc_submit_work_order_execution_proof` requires site leader or higher.
- `ywi_rpc_decide_work_order_execution_proof` requires supervisor or higher.

Customer portal proof is private portal content, not public SEO content. It must never expose staff notes, costs, access details, margin, or private-review media.

## SEO direction

Public SEO remains separate from customer portal content. Public pages need one clear H1, useful local-service copy, approved original images, descriptive alt text, canonical URLs, visible content matching structured data, and sitemap entries only after approval. Do not mass-publish thin automated pages.

## Security and payment boundaries

- Stripe deposit status remains webhook-controlled.
- Customer notification delivery requires explicit portal opt-in and a protected dispatcher token.
- Review assets stay private until approved and copied to public delivery.
- Accountant exports stay private and use signed links.
- Service-execution cost data is internal only.

## Active documentation rule

Only this handbook, `README.md`, and `docs/NEXT_STEPS_AND_SANITY_CHECK.md` are active. Historical Markdown is archived for recovery.

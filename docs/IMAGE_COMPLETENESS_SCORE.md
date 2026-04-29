## 2026-04-23 note
Image scoring is still a rule-based completeness score only. No AI quality rating has been added in this pass.

<!-- Reviewed during 2026-04-22 workflow guardrail, portable scheduler sync, and repo-alignment pass. -->
# Image Completeness Score

This score is a rule-based completeness score. It is not an AI quality rating.

## Current row-level weighting
- 20 points if the row has an image URL
- 15 points if alt text is present and at least 5 characters
- 20 points if the image is at least 1200×1200
- 12 points if the image is at least 800×800 but under 1200×1200
- 20 points for the first image if the orientation is square or landscape
- 10 points for later images if orientation is recognized
- 15 points if crop history exists
- 5 points if a caption exists
- 5 points if an image title exists

Each row is capped at 100.

## Admin scoring display
- Image score = average of all image row scores
- First-image score = score of the first image only

## First-image save guardrails
The lead image is checked more strictly before save:
- it must be square or landscape
- it must be at least 1200×1200
- alt text must be at least 12 characters
- first-image score must be at least 70%

## Upload-time local file checks
Before upload, the local file is checked against these minimums:
- general image minimum: 800×800 and square/landscape
- first image target: 1200×1200 and square/landscape

## Current meaning
This score is currently about completeness and merchandising readiness signals such as:
- image present
- usable alt text
- sufficient size
- acceptable orientation
- crop history recorded
- caption/title present

## Future merchandising-score ideas
Future work can add a separate merchandising score or a deeper second-pass score for signals such as:
- background consistency
- subject fill in frame
- blur or sharpness checks
- brightness and contrast checks
- duplicate-angle penalty
- lifestyle shot bonus versus plain record-shot evidence


## Clarification
This is meant as a merchandising-completeness signal for Admin workflow and save guardrails. It should not be described to operators as an AI quality score, photo-aesthetic score, or subjective product-image judgment.

## 2026-04-24 auth wall, historical reports, and OSHA reporting pass
- Fixed the public auth wall so logged-out users no longer see the live Toolbox Talk, PPE Check, First Aid Kit, Site Inspection, or Emergency Drill screens underneath the sign-in interface.
- Added a supervisor/admin **Historical Reports** screen with export-ready HSE form history, site/form rollups, and cross-workflow history covering submissions, HSE packet events, evidence review, scheduler runs, payroll exports, and signed contracts.
- Added migration `sql/089_historical_reporting_and_auth_wall_support.sql` and synced the full schema reference so reporting stays DB-backed instead of drifting into browser-only JSON snapshots.
- Continued the OSHA-facing direction by keeping the five field forms first-class while making their historical retrieval and review more usable for office and supervisor follow-up.
- Next strongest follow-up: add incident / near-miss reporting, saved report presets, richer trend charts, and deeper drill-down exports by site, worker, route, and work-order context.

## 2026-04-24 incident reporting, DB-backed report presets, and richer HSE analytics pass
- Added a new **Incident / Near Miss** field form so workers and supervisors can capture injuries, close calls, damage, witness names, immediate actions, and corrective-action ownership without waiting for office follow-up.
- Added migration `sql/090_incident_reporting_saved_report_presets_and_trends.sql`.
- Added DB-backed reporting presets (`report_presets`) so supervisors and admins can reuse saved report filters without depending on local browser storage.
- Expanded reporting with DB-backed views for incident history, monthly trends, worker rollups, and site/job/route context rollups.
- Reworked the historical reports screen to use the richer DB-backed datasets and added incident CSV export.
- Added a dedicated incident quick link in the public nav, HSE Ops, and Admin hub so the OSHA-facing workflows stay easy to reach on mobile and desktop.
- Next strongest follow-up: training history + certification expiry, SDS acknowledgement tracking, OSHA 300/300A/301-oriented recordkeeping helpers, and corrective-action task assignment from incident rows.

## 2026-04-25 corrective actions + training pass
- Synced the repo to include first-class corrective-action tasks, training / certification expiry tracking, SDS acknowledgement history, and management-focused reporting.
- See `docs/CORRECTIVE_ACTIONS_AND_TRAINING.md` and the new `sql/091_corrective_actions_training_and_sds_tracking.sql` migration.

## Latest pass note (2026-04-25d)
- Synced for scheduled report delivery, worker self-service training/SDS acknowledgement, and Jobs commercial/accounting foundation planning.

## 2026-04-26 pass note

This pass moves the project into the Jobs commercial/accounting phase.
It adds the 094 Jobs commercial workflow foundation, updates the repo status toward estimate/work-order/completion/accounting readiness, and keeps the schema/docs aligned for the next phase.


## Pass 096 notes

This pass adds branded quote output, automatic threshold evaluation, closeout evidence linkage, invoice/journal posting-rule structures, accountant handoff exports, and profitability/variance scorecards for the Jobs commercial workflow.

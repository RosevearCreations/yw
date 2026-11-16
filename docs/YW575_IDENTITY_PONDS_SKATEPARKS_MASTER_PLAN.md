# YW575 — Company identity boundaries, custom Ponds, Skateparks and Master monitoring
Date: 2026-11-16. Scope: source-only code release. Not a live migration or identity-provider operation.

## YW575 identity, company and device sessions
The source policy requires original server-verified actor and subject, matching active company/tenant,
fresh HR capability grants, active provider session, trusted revocation ledger and MFA plus independent
same-company reviewer for cross-device revocation. Output is a REQUEST, never proof that a provider
revoked a session. Do not accept browser, untrusted JWT user_metadata, public client role or display label
as authority. No Supabase privileged writes are made. See the staging-only SQL design.
Database rollout remains blocked by the separate YW574 migration provenance/isolated-staging
issue. Supabase access JWTs may remain valid until expiry after a sign-out; sensitive operations
must validate session_id against real provider state.

## Custom Ponds — dedicated module
Survey and permitted land use; geotechnical/groundwater, conservation authority and watercourse permissions;
hydraulic/overflow and erosion control; shape/depth and public safety; shell/liner or concrete structural
design; pumps, filters, aerators, power/GFCI; habitat, fish/aquatic vegetation and ecological impacts;
excavation/installation/commissioning; as-builts, commissioning, insurance and owner handover.
Recurring maintenance: seasonal scheduling, water-quality monitoring (parameters depend on intended
use), pump/filter care, algal/plant management, sediment/debris, invasive species, water level/overflow,
winterization, leak repair, service records, waste disposal and recurring quotes. The first routed screen
offers a dimensional planning estimator and ephemeral checklist only. Canonical CRM, quote, Jobs, crew,
finance, inventory, purchase orders, field media and signed inspection workflows are future integrations.

## Skateparks — dedicated module
Community consultation, user progression, accessible circulation, siting, zoning and permits, topo/geotech,
civil/site design, drainage, lighting, track/street/bowl design, concrete/steel geometry, engineered
structures and safety standards chosen by licensed designers under applicable Ontario/municipal codes.
Manage estimates, procurement, equipment and crews, quality testing, concrete curing, independent
acceptance, as-builts, handover, risk assessment and periodic inspections. Maintenance covers cracking,
spalling, corrosion, coping/rails, protrusions, transitions, drainage/ice, graffiti, incident-response,
temporary closure, independently approved reopening, warranties and reserve budgets.
Initial screen estimates concept footprint only and holds all acceptance until originals are verified.

## Naming migration
The new public-facing workspace, help and README display Yard Workers. The historic Yard Weasels brand
still appears in old source comments, security fixture strings, original production database names and
the existing verified domain 'yardweasels.ca'. This is a backward-compatibility exception, NOT completed
global eradication. Do not rewrite git history, production project reference, foreign key, service URL,
SEO canonical or signed historic evidence merely for a cosmetic rename. Owner needs a new domain and
verified redirects, original DBA migration and full regression prior to removal.

## Three-Master server monitoring
Source contract in docs/integration declares AI Data Platform top Master, Rosevear AI Hub local
host system, Comms Hub routing; YW and iCamp as two Slave Application Shells. The requested
futuristic monitoring can show performance and outage telemetry only after independently signed,
read-only, filtered ingest per app and fresh timestamps. If no source is available show UNKNOWN/HOLD,
never fake GREEN. Home Assistant/MQTT integration needs owner-approved per-capability enrollment,
device safety interlocks, automation rate limits, audit trail, emergency STOP, and strictly separate
physical control authority. This YW release cannot make other three Master repos display new views.
Protocol 1.1 additive messages must remain compatible with 1.0 peers; additive builds deploy alone.

## Release acceptance
Protected feature → dev → main, all GitHub source/auth/browser checks and exact SHA Vercel preview
READY, then production Vercel READY with the live yw-alpha.vercel.app alias and exact main SHA,
push source/browser/release authority checks SUCCESS and non-force dev/main convergence.
Nothing in this release executes SQL, HR mutation, remote session revocation, pond/skatepark
quotes/jobs/builds, original monitoring telemetry or home control commands.

# YW / Yard Workers — Multi-service integration architecture

**Owner requirement (October 17, 2026):** One integrated, company-scoped service business platform with independently enabled or disabled services. These are desired business capabilities, NOT claims that new specialist modules or company-service switches are already operational.

## Service offerings (future independently selectable module keys)

| Key | Service module | Service-specific activities and controls |
|---|---|---|
| landscape | Landscaping, lawn and grounds | Mowing, planting, irrigation, recurring grounds maintenance, seasonal work |
| construction | Small construction and repairs | Estimates, phases, permits, change orders, subcontractors, construction safety |
| water_parks | Water parks and aquatic facilities | Inspections, cleaning, chemical/water checks, downtime and maintenance proof |
| snow_removal | Snow removal and de-icing | Walkway clearing, shoveling, ice treatment, snow events, salt usage |
| snow_plowing | Snow plowing | Trucks/plows, equipment hours, multi-site routes, site priorities, plow passes |
| septic | Septic and vacuum services | Tank visits, pumping volume, disposal/haulage receipts, vehicle and safety checks |

Snow plowing and snow removal are separate offerings but share equipment and dispatch where appropriate. No duplicate costs or invoices for one job/asset.

## Shared, authoritative backbone (must not fork by module)

- One customer/contact record, owned properties and site/zone history, even where multiple services are offered at the same property.
- One estimate/quote/approval/work-order/change-order lifecycle, consistent jobs, pricing templates, service codes, deposits, invoices, receivables, payments and Finance approvals.
- One dispatch calendar and route, workability, crew availability, timekeeping, seasonal coverage and incident/safety evidence authority, supplemented with module-specific requirements.
- One employee identity and role/permission backbone; module-specific competency, training and HSE attestations remain mandatory.
- One equipment, fleet, tools and consumables inventory. Shared asset IDs record assignment, inspection/lockout, checkouts, actual usage, material consumption, job cost, maintenance and inter-service availability. No implicit deductions, transfers or override.
- Shared job sessions, production quantities and execution proofs, completion/QC, return visits, safety checks, audit logs and customer-safe documents all reference canonical work-order and company/property IDs.

## Separate company offering switches (proposed — not deployed)

A company-level \`company_service_modules\` record should provide \`company_id\`, \`module_key\`, \`enabled\`, timestamps and auditing. Company offering availability controls *new* service bookings/forms and new module-specific writes, enforced in server authorization independently of employee module-role permissions. Disabling a service must not delete or conceal authorized historical customer/property records, change invoices, strand unfinished work or bypass safety/financial obligations. Ensure tenant isolation, migration of existing service availability, and rollback-safe cutover.

Existing Jobs/Finance/Safety role module permissions are not a substitute for these company offering flags. No new flags or tables are created by Build 410.

## Controlled rollout plan

1. Audit existing organisation/tenant identity, pricing templates, service names, work-order types and current cross-module dependencies.
2. Implement auditable company service-entitlement registry, owner toggles and enforcement with idempotent migrations and existing-service-safe defaults.
3. Bind public/private service catalog, quote wizard, admin navigation, staffing/roles and accounting codes to enabled services. Keep shared Customer, Equipment and Finance surfaces accessible based on their normal permissions.
4. Add specialist field forms and compliance requirements service by service: landscaping; small construction; water parks; snow removal; snow plowing; septic.
5. Acceptance tests: one customer with multiple services; seasonal work; shared truck/attachment usage; technician certification; stock consumption; disabling a service with open jobs; historic invoices and QC readback; separate approval boundaries.

**Build 410 scope:** an authenticated read-only receipt showing actual first-session production starts, separate field capture/unfinished work and explicit return-visit proof. No synthetic work session, customer communication, automatic completion, service module toggles or Finance mutation.

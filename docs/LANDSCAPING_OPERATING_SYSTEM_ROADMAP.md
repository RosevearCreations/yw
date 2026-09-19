# YW Landscaping & Yard Maintenance Operating System Roadmap

_Last updated: 2026-09-19_

## Product direction

YW is being developed as a powerful operating system for a landscaping, lawn-care, yard-maintenance and related field-service business.

The application should be organized around five permanent business pillars:

1. **Safety & Compliance**
2. **Jobs & Customers**
3. **Equipment & Fleet**
4. **Employment & Workforce**
5. **Finance & Profitability**

Admin, I.T. readiness, mobile, offline support, notifications, reporting, audit history and search are supporting capabilities. They should strengthen the five business pillars rather than become separate competing products.

## Core business chain

The primary operating chain is:

**Customer → Property → Estimate → Job / Visit → Crew → Time → Equipment → Materials → Safety → Completion Evidence → Invoice → Payment → Profitability**

The system should preserve traceability across that chain so management can answer practical questions such as:

- Which crews and service types are profitable?
- Which recurring properties consistently exceed estimate?
- Which completed jobs have not been invoiced?
- Which customers or properties have overdue balances or recurring service issues?
- Which equipment is unavailable, overdue for service or disproportionately expensive?
- Which employee needs training before using a specific machine?
- Which jobs are at risk because of weather, scheduling, material or equipment constraints?
- What is tomorrow's crew, route, equipment and safety readiness?
- What did a mowing route, cleanup crew or landscape installation actually earn after labour, materials, equipment, disposal and travel?
- What unresolved safety, Finance, equipment or workforce issue prevents the business from being operationally GREEN?

## Module model

### Safety & Compliance

Safety is a first-class operational module, not a checklist attached to Jobs.

The long-term system should support:

- field-level hazard assessments;
- job/site safety plans;
- toolbox talks;
- daily crew safety checks;
- PPE requirements;
- incidents, injuries, property damage and environmental events;
- near misses;
- corrective actions;
- training and certification requirements;
- equipment operator authorization;
- work refusal / stop-work evidence where applicable;
- lockout and return-to-service controls;
- supervisor review and closeout;
- audit history and evidence retention.

The application should remain capable of supporting Ontario OHSA-style requirements and OSHA-style safety workflows without falsely claiming regulatory compliance merely because a form exists.

### Jobs & Customers

Jobs should be property-aware and service-aware.

The long-term system should support:

- leads and customers;
- multiple properties per customer;
- site/property intelligence;
- estimates and optional work;
- recurring maintenance agreements;
- seasonal services;
- schedule and dispatch;
- crew assignment;
- route grouping;
- weather/workability constraints;
- job and visit execution;
- quantities and production tracking;
- change orders;
- customer communication;
- photos and completion evidence;
- quality control;
- invoice readiness;
- service history and renewals.

### Equipment & Fleet

Equipment should be traceable from purchase through field use, maintenance and retirement.

The long-term system should support:

- mowers, trimmers, blowers, saws, aerators, spreaders, tractors and specialty equipment;
- trucks and trailers;
- QR/barcode identity;
- equipment assignment to crews/jobs;
- daily/pre-use inspection;
- defects and lockout;
- repair/service work orders;
- hour/km/date preventive-maintenance intervals;
- fuel and operating cost;
- blades, belts, filters, batteries and accessories;
- registration/insurance evidence where relevant;
- trailer load/content readiness;
- service history and lifecycle cost;
- replacement planning.

### Employment & Workforce

The workforce model should connect people, skills, time and field authority.

The long-term system should support:

- employee profiles;
- role and supervisor hierarchy;
- crew membership;
- availability;
- qualifications and training;
- equipment authorization;
- onboarding;
- attendance;
- job/visit time;
- travel time;
- breaks and overtime;
- timesheet correction and approval;
- payroll evidence/export;
- coaching, reviews and development;
- seasonal staffing;
- hiring/onboarding workflow;
- separation between safety truth and performance-management decisions.

### Finance & Profitability

Finance should answer operational questions while preserving accounting controls.

The long-term system should support:

- job cost;
- estimate vs actual;
- labour cost;
- materials and consumables;
- equipment/fleet cost;
- subcontractors and vendor cost;
- fuel;
- disposal/tipping fees;
- travel;
- revenue and invoicing;
- collections;
- gross margin and variance;
- A/R and A/P;
- bank import/reconciliation;
- payment application;
- account mapping;
- posting preview;
- reconciliation exceptions;
- period close;
- accountant export;
- cash position;
- tax/remittance readiness.

Accounting posting, provider/payment mutation and Production provider enablement remain separately authorized controls.

---

# Autonomous Build Queue

Builds 318–350 are the core autonomous landscaping operating-system program. Builds 351–353 are controlled acceptance campaigns and retain external/human prerequisites.

## 318 — Job Cost & Profitability Closeout

Make job profitability landscaping-specific.

Bring together:

- estimate / approved scope;
- invoiced and collected revenue;
- crew labour time and loaded labour cost;
- travel time where tracked;
- materials such as mulch, soil, seed, fertilizer, sod, gravel, stone and plants;
- consumables;
- equipment usage and operating cost;
- fuel;
- subcontract/vendor cost;
- waste/disposal/tipping fees;
- rework;
- gross margin;
- estimate-to-actual variance.

Preserve execution-proof provenance. Internal cost and margin remain staff-only while customer-safe completion evidence stays separate.

## 319 — Landscaping Finance Dashboard & Cash Position

Provide ownership/management with an operational Finance view covering:

- cash/bank position from authoritative data;
- receivables and overdue invoices;
- near-term vendor/payroll/material commitments;
- taxes/remittances;
- current-period revenue;
- current-period cost and margin;
- job profitability exceptions;
- reconciliation blockers;
- close readiness;
- seasonal revenue/cost comparisons.

This is management decision support, not a replacement for accountant-reviewed statements.

## 320 — Operations Needs Attention

Create one prioritized business-wide work queue for:

- overdue/unassigned jobs;
- jobs at risk;
- unresolved customer/property follow-up;
- equipment defects/lockouts;
- overdue maintenance;
- safety corrective actions;
- employee/training issues;
- missing timesheets;
- completed-not-invoiced work;
- overdue receivables;
- reconciliation/Finance exceptions.

Include priority, owner, due date, source module, permission-aware **Take me there**, defer/snooze and recently resolved history.

Acknowledging or snoozing an alert must never resolve the source business record.

## 321 — Crew Scheduling & Dispatch

Build a landscaping-specific daily/weekly scheduler with:

- crew composition;
- lead/supervisor;
- assigned employees;
- truck/trailer assignment;
- equipment requirements;
- property/job assignment;
- recurring visits;
- estimated duration;
- drive/travel allowance;
- route order;
- schedule conflicts;
- availability conflicts;
- equipment conflicts;
- weather/workability state;
- reschedule and cancellation reason;
- dispatch-ready status.

## 322 — Recurring Lawn & Yard Maintenance Engine

Support true recurring field service:

- weekly / biweekly / custom mowing;
- garden/bed maintenance;
- hedge/shrub trimming;
- spring cleanup;
- fall cleanup;
- aeration;
- fertilizing;
- seasonal service programs;
- optional winter/snow services where the business chooses to support them.

Support recurrence rules, service windows, seasonal start/stop, skipped visits, weather delays, make-up visits, customer holds and permanent cancellation.

## 323 — Property & Site Intelligence

Make the property a first-class record.

Capture:

- property/customer relationship;
- service address;
- zones / lawn areas / garden beds;
- approximate serviceable area;
- gates/fences;
- access instructions;
- parking/trailer limitations;
- pets;
- irrigation;
- known hazards;
- utilities/locate notes;
- slopes;
- drainage/wet areas;
- tree/brush issues;
- neighbour/public interaction concerns;
- approved property photos;
- preferred service instructions;
- recurring property-specific checklist.

## 324 — Estimate → Job → Invoice Workflow

Make estimating landscaping-aware.

Support:

- service templates;
- labour-hour assumptions;
- crew-size assumptions;
- material quantities;
- equipment requirements;
- subcontract/vendor allowances;
- disposal;
- travel;
- markup/margin review;
- optional/additional work;
- customer approval;
- deposits where applicable;
- work-order conversion;
- change orders;
- invoice readiness.

Estimate assumptions must remain traceable into job-cost variance.

## 325 — Landscape Production Tracking

Capture what actually happened in the field:

- actual start/finish;
- crew members;
- labour hours;
- work quantities;
- material use;
- equipment used;
- disposal/tipping;
- delays;
- weather/workability impacts;
- production notes;
- before/during/after photos;
- unfinished work;
- return visit required;
- customer/site issue;
- completion evidence.

## 326 — Mobile Crew App v2

Optimize the field application for 390/430-width phones.

Prioritize:

- My Jobs / My Route;
- property access notes;
- clock in/out;
- job checklist;
- safety assessment;
- photos/live update;
- material use;
- equipment scan;
- inspection/defect;
- production quantities;
- execution proof;
- deficiency/rework;
- closeout request;
- customer signoff where appropriate;
- clear pending/offline sync state.

Avoid horizontal overflow and keep touch targets field-usable.

## 327 — Safety & Compliance Command Centre

Create a dedicated safety operating centre with:

- open hazards;
- required assessments;
- toolbox talks;
- incidents/near misses;
- corrective actions;
- training expiries;
- PPE issues;
- equipment lockouts;
- unresolved site hazards;
- supervisor signoff;
- safety trends and overdue actions.

Safety records must not be silently resolved by notification acknowledgement or job completion.

## 328 — Job Hazard & Site Safety Plans

Create reusable safety plans by landscaping work type, including examples such as:

- mowing;
- trimming/edging;
- blower use;
- chainsaw/brush cutting;
- hedge work;
- tree/brush work within supported business scope;
- loading/unloading;
- trailers/towing;
- roadside work;
- excavation/digging;
- underground utility concern;
- pesticide/fertilizer/application work where legally permitted;
- heat;
- cold;
- storms/lightning;
- slips/trips;
- steep slopes;
- public/pedestrian interaction.

A site/job may inherit a template but field staff must be able to record actual conditions and controls.

## 329 — Incident & Near-Miss Investigation

Support immediate and auditable event capture:

- incident type;
- injury/illness where applicable;
- property damage;
- vehicle/equipment damage;
- environmental event;
- near miss;
- date/time/site/job;
- workers involved;
- witnesses;
- equipment involved;
- photos/documents;
- initial response;
- root/contributing factors;
- corrective actions;
- owner;
- due date;
- supervisor review;
- closure evidence.

## 330 — Training & Certification Matrix

Create a role/equipment-based training matrix for employees.

Support company-required and jurisdiction-specific evidence such as:

- orientation;
- WHMIS where applicable;
- first aid/CPR where required;
- equipment authorization;
- chainsaw/brush equipment;
- mower/tractor authorization;
- pesticide/application credentials where required;
- trailer/towing;
- supervisor training;
- company SOPs;
- refresher/expiry dates.

Do not infer legal authorization solely from an internal checkbox.

## 331 — Equipment Registry & QR System v2

Give every significant asset an operational identity:

- asset code;
- QR/barcode;
- make/model/serial;
- purchase date/cost;
- assigned crew/location;
- status;
- manuals;
- approved photos;
- meter/hours where supported;
- accessories;
- current lockout state;
- latest inspection;
- next maintenance;
- lifecycle cost;
- replacement status.

## 332 — Daily Equipment Inspection & Lockout

Create field-usable pre-use/post-use inspections.

Support:

- machine-specific checklist;
- condition;
- guards/safety systems;
- fluids;
- blades/cutting components;
- tires/wheels;
- fuel/battery;
- accessories;
- damage;
- defect notes/photos;
- lockout;
- supervisor/maintenance review;
- repair task;
- verified return to service.

A failed safety-critical inspection must not be bypassed by ordinary job completion.

## 333 — Fleet, Trailer & Vehicle Operations

Add operational fleet controls for trucks/trailers:

- vehicle/trailer identity;
- odometer;
- registration;
- insurance evidence;
- inspection;
- maintenance;
- tire status;
- towing assignment;
- hitch/trailer compatibility;
- crew/job assignment;
- trailer load/content readiness;
- fuel;
- damage;
- downtime.

## 334 — Preventive Maintenance Engine

Schedule maintenance from:

- date;
- equipment hours;
- vehicle kilometres;
- seasonal milestones.

Track service such as:

- oil;
- filters;
- blades;
- sharpening;
- belts;
- lubrication;
- tires;
- batteries;
- winterization/storage;
- preseason setup;
- repairs.

Keep full service history and downtime evidence.

## 335 — Fuel, Consumables & Materials Control

Track landscaping supplies and field consumption:

- gasoline/diesel where applicable;
- oil;
- trimmer line;
- blades;
- fasteners;
- fertilizer;
- seed;
- sod;
- mulch;
- soil;
- gravel/stone;
- plants;
- landscape fabric;
- disposal supplies;
- other consumables.

Support stock, reorder, supplier, unit cost, job use, waste and variance.

## 336 — Employee & Crew Management

Create practical workforce operations:

- employee status;
- role;
- supervisor;
- crew;
- skills;
- availability;
- contact/emergency-data privacy boundaries;
- assigned training;
- equipment authorization;
- seasonal status;
- active/inactive dates.

## 337 — Timekeeping, Attendance & Payroll Evidence

Track:

- shift clock;
- job/visit time;
- travel time;
- breaks;
- overtime;
- missed punches;
- corrections;
- employee explanation;
- supervisor approval;
- job-cost allocation;
- payroll-ready export/evidence.

Time correction must remain auditable.

## 338 — Performance & Development

Support:

- role expectations;
- coaching;
- recognition;
- attendance trends;
- training/development plans;
- documented reviews;
- improvement actions;
- follow-up dates.

Keep safety incident truth independent from performance-management outcomes.

## 339 — Hiring & Onboarding Workflow

Build:

**Applicant → Interview → Offer → Hired → Documents → Orientation → Training → Equipment Authorization → Crew Assignment**

Track incomplete onboarding and required pre-field gates.

## 340 — Customer & Property CRM

Bring together:

- leads;
- customers;
- multiple properties;
- estimates;
- active service plans;
- service history;
- communications;
- complaints;
- follow-ups;
- property preferences;
- renewals;
- upsell/cross-service opportunities.

## 341 — Route Optimization & Territory Management

Support recurring-route planning by:

- service area;
- property proximity;
- crew capacity;
- estimated duration;
- equipment needs;
- time windows;
- recurring frequency;
- route order;
- travel efficiency;
- territory ownership.

Initial optimization may be heuristic; the operator must retain control over the actual dispatch plan.

## 342 — Weather & Workability Controls

Add weather/workability status without automatically making unsafe decisions.

Support:

- rain delay;
- saturated ground;
- heat;
- cold;
- high wind;
- lightning/storm;
- visibility;
- service-type restrictions;
- supervisor decision;
- postponement/reschedule;
- customer notification readiness.

The system provides decision support; field/supervisory safety authority remains human-controlled.

## 343 — Landscape Material Estimator

Add area/volume/quantity calculators tied to estimates and jobs:

- mulch;
- soil;
- sod;
- seed;
- fertilizer;
- gravel;
- stone;
- disposal volume;
- other configurable materials.

Record assumptions, unit conversions, waste factor and planned vs actual use.

## 344 — Change Orders & Extras

Support field-discovered scope safely:

**Crew identifies extra work → evidence/photos → office/supervisor review → price/scope → customer authorization → job budget/scope update → invoice evidence**

No hidden customer billing or unaudited field-only price change.

## 345 — Quality Control & Customer Signoff

Provide service-type completion templates:

- crew completion;
- supervisor QC where required;
- deficiencies;
- rework;
- before/after evidence;
- customer-safe completion summary;
- customer acknowledgement/signoff where appropriate;
- unresolved issue tracking.

## 346 — Seasonal Operations Centre

Prepare the business for seasonal transitions:

- spring startup;
- summer maintenance;
- fall cleanup;
- winter shutdown;
- optional snow/winter operations.

Coordinate:

- recurring customer rollover;
- seasonal staffing;
- equipment conversion/service;
- material stock;
- route activation;
- seasonal checklists;
- outstanding customer work.

## 347 — Universal Activity & Audit Timeline

Create one permission-aware chronological history across:

- Customer;
- Property;
- Estimate;
- Job/Visit;
- Employee;
- Equipment/Fleet;
- Safety;
- Invoice/Payment.

Show meaningful events such as created, changed, assigned, approved, rejected, inspected, locked out, trained, uploaded, notified, posted and reopened with actor, timestamp, source module and evidence reference.

## 348 — Offline & Conflict Recovery

Make field synchronization understandable.

Where supported, show:

- local value;
- server value;
- reason for conflict;
- Keep Mine;
- Keep Server;
- Merge;
- Retry;
- Discard.

Preserve unsent work and never silently overwrite newer authoritative records.

## 349 — Saved Views, Search & Command Centre

Add permission-aware saved operational views such as:

- My Crew Today;
- My Route;
- Jobs Behind Schedule;
- Equipment Locked Out;
- Maintenance Due;
- Safety Actions Due;
- Training Expiring;
- Completed Not Invoiced;
- Overdue Receivables;
- Finance Exceptions;
- Assigned to Me.

Add global permission-aware search/navigation across customers, properties, jobs, invoices/payments, employees, equipment and Admin workspaces.

## 350 — Owner / Management Command Centre

Create a practical business cockpit showing:

- crews working today;
- jobs/visits scheduled and completed;
- schedule risk;
- production/completion rate;
- revenue;
- job margin;
- labour utilization;
- recurring route performance;
- safety blockers;
- equipment downtime;
- training/workforce blockers;
- completed-not-invoiced;
- receivables;
- cash/Finance readiness;
- operational needs attention.

It must deep-link to the authoritative source workflow instead of becoming a duplicate data authority.

---

# Controlled Acceptance Campaigns

These builds remain on the roadmap but are not ordinary autonomous feature releases.

## 351 — Real Staging Acceptance Campaign

Run only when a dedicated non-Production Supabase project/branch exists and is explicitly authorized.

Require:

- exact environment identity;
- project-ref guard;
- exact current-schema parity immediately before mutation;
- disposable automated cases;
- required human Operations/Jobs/Safety/Equipment scenarios;
- recorded evidence;
- deliberate finalization/signoff.

Never substitute Production customer/business/provider data.

## 352 — Accounting Acceptance Campaign

After the landscaping Finance workflow is complete and no critical Finance blockers remain, run controlled test transactions through:

- estimates/jobs;
- job cost;
- bank import;
- reconciliation;
- payment application;
- account mapping;
- posting preview;
- reconciliation exceptions;
- period close;
- accountant export.

Verify idempotency, locked-period behavior, reopen audit, job-profitability linkage and expected accountant output.

Passing acceptance does not automatically enable Production posting.

## 353 — Payment & Provider Acceptance

Only after internal accounting behavior is trustworthy, validate supported payment/provider paths including:

- success;
- decline/failure;
- duplicate webhook/event;
- retry;
- idempotency;
- refund;
- partial refund;
- dispute/chargeback;
- uncertain outcome/manual review.

Verify provider events link to the correct internal customer/payment/accounting/job records and cannot double-settle, double-apply or double-post.

Provider acceptance and Production provider enablement remain separate deliberate decisions.

---

# Roadmap Selection Rules

When the next YW build is requested:

1. Prefer the earliest still-valid roadmap item whose prerequisites are satisfied.
2. Re-scan current `dev` / `main` and open branches/PRs first so concurrent work is not duplicated.
3. A newly discovered security, safety, release-integrity or data-integrity defect may take priority.
4. Small adjacent fixes may be grouped when they share the same authority/test surface.
5. Unrelated business domains should remain separate releases.
6. Do not create CI-only micro-releases merely to increase the build number.
7. Favor real landscaping operating value: Jobs, Safety, Equipment, Employment and Finance.
8. Keep permissions, evidence, audit, offline safety and source authority fail-closed.
9. Do not infer regulatory compliance, accounting approval, payment-provider readiness or Production authorization merely because source/browser tests pass.
10. Builds 351–353 retain their external/human prerequisites and must not be replaced by synthetic source-only confidence.

## Current next build

With Builds 316 and 317 already completed, the next planned autonomous item is:

**Build 318 — Job Cost & Profitability Closeout**

It should be implemented specifically around landscaping and yard-maintenance economics, not as a generic job-costing screen.

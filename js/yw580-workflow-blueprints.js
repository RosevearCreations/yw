/* YW580: service-specific workflow blueprints.
 * Design metadata only — not customer data, executed tasks or evidence receipts. */
(()=>{'use strict';
const common=Object.freeze({
 crossModule:[
  'Client and property identity shared with original CRM and job registry',
  'Scheduling, crew capacity, route and equipment reservations',
  'Inventory/material consumption tied to the originating service job',
  'Timesheet and payroll approvals tied to actual verified labor',
  'Quote, invoice, settlement, accounting and maintenance history',
  'Consent-aware photo evidence and immutable source audit references'
 ],
 quote:[
  'Site/property inspection with measurements and customer consent',
  'Required materials, rentals, labor, fuel, disposal and contingency costs',
  'Customer scope, exclusions, milestones, warranty and change orders'
 ],
 finance:[
  'Original signed customer quote and approved change orders',
  'Job-specific costs and usage reconcile to company ledger',
  'Taxes and original provider settlement require independent approval'
 ]
});
const service={
 landscape:{
  summary:'Lawn care, grounds maintenance and seasonal programs with recurring site work.',
  steps:['Property assessment and service zone map','Mowing/edging/bed-care scope and recurring route',
   'Crew, chemical-free/approved treatment and equipment scheduling','Job-day before/after evidence and customer sign-off'],
  photos:['Property baseline, hazards and irrigation heads','Before and after each service zone',
   'Damage or obstructions and signed exception photos'],
  resources:['Mowers, trimmers, trailer, service crew and fuel','Grass/soil/mulch, disposal and weather workability'],
  maintenance:['Weekly/biweekly/seasonal programs','Irrigation and soil condition reviews','Customer contract renewals']},
 snow_removal:{
  summary:'Winter response, salt/de-icing and tracked property service-level obligations.',
  steps:['Site risk and snow-trigger contract review','Weather and route mobilization',
   'Crew and snow equipment dispatch','Arrival, depth, cleared areas, ice treatment and completion receipts'],
  photos:['Preseason curbs, bollards, drains and hazards','Accumulation measurements and time-stamped clearance',
   'Treatment documentation, slip-risk and completion evidence'],
  resources:['Shovel teams, blowers, salt spreaders, standby vehicles','Salt/sand inventory, storm demand and response limits'],
  maintenance:['Storm logs and revisit triggers','Seasonal contract review and equipment readiness']},
 snow_plowing:{
  summary:'Plow routes, snow-placement constraints, municipal access and equipment readiness.',
  steps:['Lot/driveway plan and stacking-zone approval','Storm priority dispatch with GPS route',
   'Blade/truck/plow verification','Service completion and property damage exception handling'],
  photos:['Lot condition before plowing','Plowed lanes, pile locations and hazards','Blade damage and property exceptions'],
  resources:['Plow trucks, blades, tires, fuel, backup operators','Route and tipping/disposal coordination'],
  maintenance:['Prestorm blade inspections','Route SLA and poststorm damage reports']},
 septic:{
  summary:'Septic inspection and servicing with restricted-site, environmental and disposal controls.',
  steps:['Property system location, permit and service-history review','Access and confined-space assessment',
   'Certified service plan and controlled waste handling','Disposal manifest, customer handoff and follow-up'],
  photos:['Access conditions, lids and setbacks','Equipment/connection setup with privacy controls',
   'Service completion, waste manifest and system observations'],
  resources:['Licensed/qualified operator, vacuum equipment, PPE','Authorized disposal site, truck capacity and spill control'],
  maintenance:['Tank inspection/pump-out schedule','Alarm, drainage and problem-case follow-ups']},
 arboriculture:{
  summary:'Tree assessment, pruning, removal and stump/brush disposal under elevated-risk controls.',
  steps:['Arborist tree-risk assessment and ownership/permit check','Drop zone, utilities and rigging job hazard review',
   'Qualified climbing/aerial crew and equipment allocation','Cut/rig/clear checklist and property sign-off'],
  photos:['Tree health, trunk/canopy and neighbor utilities','Rigging, exclusion zones and each critical cut stage',
   'Stump/brush cleanup, access and final property condition'],
  resources:['Qualified climbers/riggers, lift and chainsaw inspection','Chipper, trailer, traffic plan and debris disposal'],
  maintenance:['Annual hazard inspection','Pruning and seasonal monitoring plans']},
 construction:{
  summary:'Concrete, repairs, excavation and small builds with scope and inspection milestones.',
  steps:['Site survey, permits and buried-utility locates','Design/spec, change-order and material bill',
   'Crew/equipment staging and construction phases','Inspection, deficiency, warranty and completion handoff'],
  photos:['Pre-work condition, utility marking and foundations','Progress-by-phase and hidden-work evidence',
   'Inspection sign-off, punch-list and as-built records'],
  resources:['Qualified trade crew and excavators','Concrete, aggregate, formwork, fibres and subcontractors'],
  maintenance:['Warranty inspections and defect follow-up','Asset service intervals and repair history']},
 water_parks:{
  summary:'Aquatic facility construction, maintenance, water safety and testing.',
  steps:['Site safety, capacity and regulatory design review','Water system/attraction component scoping',
   'Qualified installers, inspections and commissioning','Daily safety, chemistry and preventive maintenance handoffs'],
  photos:['Groundworks, waterproofing and plant-room baseline','Pressure/leak/safety system test evidence',
   'Commissioning and required inspection approvals'],
  resources:['Certified aquatic specialists, pumps, filters and water treatment','Water testing supplies, safety barriers and inspection crew'],
  maintenance:['Water-quality tests and operating logs','Pump/filtration PM, seasonal closures and reopening']},
 ponds:{
  summary:'Custom ponds: design, excavation, waterproofing, filtration, planting and ongoing care.',
  steps:['Site layout, grades, permissions and underground locates','Waterproofing/liner/edge design and materials quote',
   'Excavation, pumps, filters, safety and electrical inspection','Leak test, landscaping, biological startup and handoff'],
  photos:['Original grading, access and utility locates','Liner seams, plumbing, pump installation and water test',
   'Completed edges, plant zones and maintenance instructions'],
  resources:['Excavator, liners, pumps, filtration, rock and aquatic plant materials',
   'Electrician/qualified designer and environmental/water sourcing review'],
  maintenance:['Filter cleaning and water-quality tests','Seasonal pump service, algae and winterization']},
 skateparks:{
  summary:'Skateparks: terrain design, structural build, rideability, inspection and lifecycle care.',
  steps:['Community brief, accessibility and design/safety standards review','Engineer design, permits and drainage plan',
   'Earthworks, concrete/steel features and cure/finish inspection','Independent safety inspection, opening and asset handoff'],
  photos:['Existing terrain, utility locates and drainage','Formwork, reinforcement, welds and pour/finish stages',
   'Final edge transitions, impact surfaces and acceptance inspection'],
  resources:['Design engineer, skilled concrete/steel team and lifts','Forms, reinforcement, concrete, grinds and curing materials'],
  maintenance:['Crack/fastener inspections and resurfacing','Drainage, seasonal closure and hazard reporting']}
};
for(const [key,x] of Object.entries(service)){
 x.crossModule=[...common.crossModule];
 x.quote=[...common.quote,...(x.quote||[])];
 x.finance=[...common.finance,...(x.finance||[])];
 Object.freeze(x.steps);Object.freeze(x.photos);Object.freeze(x.resources);
 Object.freeze(x.maintenance);Object.freeze(x.crossModule);Object.freeze(x.quote);
 Object.freeze(x.finance);Object.freeze(x);
}
window.YW580Blueprints=Object.freeze(service);
})();
/* YW575 independent Skateparks module: public-use civil design and lifecycle. */
(()=>{'use strict';window.YWI575Specialty?.register?.({
 id:'skateparks',title:'Skateparks — Concept, Civil Build, Inspection & Maintenance',
 intro:'Plan skatepark sites, flow zones and build stages. This planning estimator does not establish compliance, geometric safety, structural adequacy or a certified riding surface.',
 fields:[
  {id:'length',label:'Concept site length (metres)',min:3,max:500,step:.5,default:45},
  {id:'width',label:'Concept site width (metres)',min:3,max:500,step:.5,default:30},
  {id:'coverage',label:'Proposed hardscape coverage (%)',min:5,max:100,step:1,default:65}
 ],
 calculate:({length,width,coverage})=>{
  const area=length*width;const surface=area*coverage/100;
  return 'Concept footprint '+area.toFixed(1)+' m²; preliminary riding/hardscape area '+surface.toFixed(1)+
   ' m². Not a final concrete takeoff. Transitions, slab thickness, subbase, reinforcement, drainage, accessible paths and engineer-approved profiles are separate.';
 },
 stages:[
  {name:'01 · Community & site',tasks:['Community consultation, beginner/intermediate/advanced rider mix and inclusion goals',
   'Land tenure, setbacks, municipal procurement and public consultation approval',
   'Topographic survey, underground locates, geotechnical report and soils',
   'Accessibility routes, parking, public transit, emergency access and lighting',
   'Noise, drainage, neighbouring uses, environmental assessment and risk review']},
  {name:'02 · Detailed design',tasks:['Qualified skatepark designer and licensed local professional engineering review',
   'Flow circulation, sightlines, staging areas and collision/transfer conflict analysis',
   'Street, bowl, pump track, plaza and progression features as separately approved',
   'Standards review: applicable CSA/municipal requirements and ASTM F2480 or EN 14974 where relevant',
   'Concrete geometry, rebar/embedded steel, coping, edge detailing and finish tolerances',
   'Stormwater, grading, subdrains, frost protection, public utilities and site security',
   'Accessible amenities, benches, waste, shade, signage and lighting']},
  {name:'03 · Construction & commissioning',tasks:['Site controls, erosion/sediment, excavation/shoring and utility protection',
   'Subbase compaction, drainage tests, forms and specialty steel verification',
   'Concrete batching, placement, finish, joints and curing quality-control records',
   'Independent design-conformance and obstacle/edge hazard inspections',
   'Accessible route, emergency response, signage and handover walkthrough',
   'As-built records, warranties, municipal acceptance and operation plan']},
  {name:'04 · Lifecycle & repairs',tasks:['Routine documented inspection for cracks, settlement, trip edges and protruding metal',
   'Debris, standing water, ice, graffiti and vandalism response',
   'Coping/welds/fasteners/rail integrity and corrosion inspection',
   'Concrete spall, joint, grind and surface repairs with approved methods',
   'Lighting, drainage, benches, fencing and accessible-route maintenance',
   'Hazard severity, isolation/closure, work-order assignment and independent reopening approval',
   'Seasonal condition reviews, periodic engineering inspection and reserve budget',
   'Incident records, customer/municipal communication and warranty follow-up']}
 ]
});})();

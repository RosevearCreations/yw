/* YW575 independent Custom Ponds module: design, construction, aftercare. */
(()=>{'use strict';window.YWI575Specialty?.register?.({
 id:'ponds',title:'Custom Ponds — Design, Build, Water Quality & Maintenance',
 intro:'Plan ornamental, naturalized or ecosystem ponds. Geometric estimates are preliminary; liners, banks, overflow, utilities, fish welfare, permits and drainage require specialist validation.',
 fields:[
  {id:'length',label:'Average water length (metres)',min:.5,max:500,step:.1,default:10},
  {id:'width',label:'Average water width (metres)',min:.5,max:500,step:.1,default:5},
  {id:'depth',label:'Average depth (metres)',min:.2,max:20,step:.1,default:1.2}
 ],
 calculate:({length,width,depth})=>{
  const area=length*width,litres=area*depth*1000;
  return 'Rectangular-envelope planning estimate: '+area.toFixed(1)+' m² water area; '+
   litres.toLocaleString('en-CA',{maximumFractionDigits:0})+' L / '+(litres/1000).toFixed(1)+
   ' m³. Actual irregular shape, displacement, safe side slopes, liner and filtration capacity need verified drawings. Do not size pumps from this estimate alone.';
 },
 stages:[
  {name:'01 · Survey & permissions',tasks:['Client goals: wildlife, swimming, koi, ornamental or stormwater (distinct risk classes)',
   'Property boundary, underground utilities and safe excavation locates','Soil, groundwater and geotechnical investigation',
   'Municipal permits, conservation authority, drainage/watercourse and discharge review',
   'Public safety, fencing, accessibility, child/wildlife exposure and insurance assessment']},
  {name:'02 · Design & engineering',tasks:['Site topography, capacity, depths, safe side slopes and shoreline profile',
   'Water source, catchment, overflow, flood/erosion strategy and winter conditions',
   'Pond shell, liner/underlay, concrete or bioengineering detailing and waterproofing',
   'Pump, filter, aeration, skimmer, UV and electrical GFCI with qualified design',
   'Aquatic habitats, plant zones, fish oxygen/temperature and ecological balance',
   'Material takeoff, estimate, schedule, crew qualifications, HSE and vendor selection']},
  {name:'03 · Construction & handover',tasks:['Excavation, trench, dewatering and soil disposal controls',
   'Subgrade preparation, protected liner/structures and edge restraint',
   'Waterproof pressure/leak tests, electrical and pump commissioning',
   'Water chemistry baseline, turbidity, flow, aeration and overflow test',
   'As-built levels, warranties, maintenance manual, customer instruction and independent safety sign-off']},
  {name:'04 · Pond maintenance service',tasks:['Visit scheduling, access and weather/seasonal workability',
   'Record water pH, dissolved oxygen, ammonia/nitrite, temperature and clarity as applicable',
   'Inspect pumps, filters, aerators, UV, hoses, strainers and power protection',
   'Assess algae, invasive plants, vegetation, fish health and wildlife risks',
   'Skim debris, manage sediment, filter servicing and approved disposal',
   'Leak/liner/shoreline/overflow inspection and corrective actions',
   'Winterization, de-icing/aeration strategy and spring restart',
   'Photographic condition report, customer-safe follow-up and recurring plan review']}
 ]
});})();

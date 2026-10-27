// Public static allowlist only. All protected data capabilities remain disabled.
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).setHeader('Allow','GET').json({error:'method_not_allowed'});
  const env=process.env.VERCEL_ENV;
  const names=['read_client','read_property','read_estimate','read_job','read_route',
    'read_equipment','create_handoff','update_job_status'];
  return res.status(200).json({contract_version:'1',app_id:'yard-workers',app_version:'471',
    environment:['production','preview','development'].includes(env)?env:'unknown',
    connection_status:'HOLD',tenant_scope:'required_before_connection',
    service_module_scope:'required_before_connection',
    capabilities:names.map(name=>({name,enabled:false})),
    events_enabled:false,commands_enabled:false,owner_approval_required:true});
}

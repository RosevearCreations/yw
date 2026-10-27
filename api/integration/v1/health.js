// Rosevear Integration Contract v1: read-only capability discovery, not authorization.
// No tenant, customer, credential or operational evidence is returned here.
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).setHeader('Allow','GET').json({error:'method_not_allowed'});
  const env=process.env.VERCEL_ENV;
  return res.status(200).json({contract_version:'1',app_id:'yard-workers',app_version:'471',
    environment:['production','preview','development'].includes(env)?env:'unknown',
    connection_status:'HOLD',health:'available',authenticated:false,
    events_enabled:false,commands_enabled:false});
}

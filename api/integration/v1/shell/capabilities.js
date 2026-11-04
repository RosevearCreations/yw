import {verifySourceShellGet} from '../../../../server/rosevear-shell-ql335.mjs';

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','X-Rosevear-Shell-Envelope');
  // This is a platform shell, not a landscaping-company credential.
  const result=await verifySourceShellGet({method:req.method,
    path:'/api/integration/v1/shell/capabilities',query:req.query,
    headers:req.headers,runtime:process.env.VERCEL_ENV==='preview'?'nonproduction':'hold'});
  if(req.method!=='GET')res.setHeader('Allow','GET');
  return res.status(result.httpStatus).json(result);
}

import {verifySourceShellGet} from '../../../../server/rosevear-shell-ql335.mjs';

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','X-Rosevear-Shell-Envelope');
  // No source-owner signer, KMS handle, broker workload or atomic nonce
  // adapter has been independently authorized. Never use a tenant key here.
  const result=await verifySourceShellGet({method:req.method,
    path:'/api/integration/v1/shell/health',query:req.query,
    headers:req.headers,runtime:process.env.VERCEL_ENV==='preview'?'nonproduction':'hold'});
  if(req.method!=='GET')res.setHeader('Allow','GET');
  return res.status(result.httpStatus).json(result);
}

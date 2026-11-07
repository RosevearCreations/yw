import {handleQl364SourceHealth,QL364_PATH,QL364_SOURCE_ID,
  QL364_REPOSITORY} from '../../../../server/ql364-source-health.mjs';

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  // QL-365D: a single exact private TEST protocol on the health path.
  // The legacy QL-335 challenge cannot authenticate a QL-362 health GET.
  // Original-owner approval, durable one-use claim, and source KMS signer
  // remain deliberately unbound until independently authenticated in the field.
  const request=new Request(new URL(req.url??QL364_PATH,'https://source.invalid'),{
    method:req.method,headers:req.headers});
  const result=await handleQl364SourceHealth({request,
    sourceId:QL364_SOURCE_ID,repository:QL364_REPOSITORY});
  if(req.method!=='GET')res.setHeader('Allow','GET');
  result.headers.forEach((value,key)=>res.setHeader(key,value));
  return res.status(result.status).json(await result.json());
}

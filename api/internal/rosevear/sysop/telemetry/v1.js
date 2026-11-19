import {handleSysopTelemetry} from '../../../../../server/sysop-telemetry-v1.mjs';
export default async function handler(req,res){
 const request=new Request(new URL(req.url??'/internal/rosevear/sysop/telemetry/v1','https://source.invalid'),{method:req.method,headers:req.headers});
 const result=await handleSysopTelemetry({request,env:process.env,sourceCommit:process.env.VERCEL_GIT_COMMIT_SHA});
 result.headers.forEach((v,k)=>res.setHeader(k,v));return res.status(result.status).json(await result.json());
}

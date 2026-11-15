// YW571 operator-only evidence verification command.
// Example: node scripts/yw571-verify-cli.mjs disposition ./PRIVATE-receipt.json ./TRUSTED-owner-pin.json
// Trust material MUST come from independent enrollment, never the untrusted receipt.
import {readFileSync} from 'node:fs';
import {verifyDisposition571,verifyRenewalPair571,verifyHandoffShape571}
 from './yw571-evidence-contract.mjs';
const [kind,...paths]=process.argv.slice(2);
function read(path){
 if(!path||!/^.{1,512}$/.test(path))throw Error('Missing or invalid file path');
 const raw=readFileSync(path,'utf8');
 if(Buffer.byteLength(raw,'utf8')>128*1024)throw Error('Evidence document exceeds safe bound');
 return JSON.parse(raw);
}
let outcome;
try{
 if(kind==='disposition'&&paths.length===2)
  outcome=verifyDisposition571(read(paths[0]),read(paths[1]));
 else if(kind==='renewal'&&paths.length===4)
  outcome=verifyRenewalPair571(read(paths[0]),read(paths[1]),read(paths[2]),read(paths[3]));
 else if(kind==='handoff-shape'&&paths.length===1)
  outcome=verifyHandoffShape571(read(paths[0]));
 else throw Error('Usage: disposition receipt.json owner-trust.json | renewal old.json new.json old-trust.json new-trust.json | handoff-shape packet.json');
}catch(e){outcome={ok:false,code:'HOLD_INVALID_EVIDENCE_INPUT',message:e.message};}
console.log(JSON.stringify({
 ok:outcome.ok===true,code:outcome.code,
 message:outcome.message||'Review signed original source and issuer authority.',
 connected:false,closure_authorized:false,customer_delivery_verified:false
},null,2));
process.exitCode=outcome.ok===true?0:1;

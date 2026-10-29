// Operator-only local review of the exact QL-258 sanitized Yard Workers export.
// No network calls, no secrets, no untrusted approvals or side effects.
import {readFileSync,statSync} from 'node:fs';
import {acceptSanitizedYwOwnerHandoff,noOwnerHandoffYet} from '../server/rosevear-ql258-owner-intake-490.mjs';

if(process.argv.length===2){
 process.stdout.write(JSON.stringify(noOwnerHandoffYet(),null,2)+'\n');
 process.exitCode=2;
}else{
 try{
  if(process.argv.length!==3)throw Error('ONE_SANITIZED_PACKET_PATH_REQUIRED');
  const p=process.argv[2];
  const stat=statSync(p);
  if(!stat.isFile()||stat.size>8192)throw Error('SANITIZED_PACKET_TOO_LARGE_OR_INVALID');
  const result=acceptSanitizedYwOwnerHandoff(JSON.parse(readFileSync(p,'utf8')));
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
 }catch(e){
  const code=/^QL258_490_REJECT_[A-Z0-9_]+$/.test(String(e?.message))
   ? e.message : 'SANITIZED_PACKET_UNAVAILABLE_OR_INVALID';
  process.stderr.write('QL258_490_HOLD: '+code+'\n');
  process.exitCode=2;
 }
}

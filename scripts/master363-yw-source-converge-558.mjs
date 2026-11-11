// Run only on the independent authorized source custody host, after deployment.
// No private key, passphrase, tenant data or raw environment variable is printed.
import {readFileSync,realpathSync,statSync} from 'node:fs';
import {dirname,relative,resolve,sep} from 'node:path';
import {platform} from 'node:os';
import {randomBytes} from 'node:crypto';
import {sourcePayload,signSourcePayload,verifySourcePacket} from '../server/master363-yw-source-converge-558.mjs';
import {build364Payload,signBuild364Receipt,verifyBuild364Receipt} from '../server/master363-yw-build364-receipt.mjs';

function privatePem(filename){
 if(typeof filename!=='string'||!filename)return null;
 const file=realpathSync(filename),root=realpathSync(resolve('.'));
 const rel=relative(root,file);
 if(!(rel==='..'||rel.startsWith('..'+sep)))throw Error('PRIVATE_KEY_WITHIN_REPOSITORY');
 const info=statSync(file),directory=statSync(dirname(file));
 if(!info.isFile()||info.size>32768||
   (platform()!=='win32'&&((info.mode&0o077)!==0||(directory.mode&0o077)!==0)))
  throw Error('PRIVATE_KEY_CUSTODY_PERMISSIONS');
 return readFileSync(file,'utf8');
}
try{
 const command=process.argv[2];
 if(!['sign','sign-build364'].includes(command)||
  process.argv.length!==(command==='sign'?5:6))
  throw Error('SIGN_COMMAND_REVISION_AND_MANIFEST_DIGEST_REQUIRED');
 const sourceRevision=process.argv[3],manifestSha256=process.argv[4];
 const encryptedPrivateKeyPem=privatePem(process.env.YWI_SOURCE_SIGNER_KEY_FILE);
 if(command==='sign'){
  const payload=sourcePayload({sourceRevision,manifestSha256,nonce:randomBytes(32).toString('hex')});
  const packet=signSourcePayload({payload,encryptedPrivateKeyPem,
   passphrase:process.env.YWI_SOURCE_SIGNER_PASSPHRASE,
   expectedPublicPin:process.env.YWI_TRUSTED_SOURCE_PIN_SHA256});
  const verified=verifySourcePacket(packet,{trustedPublicPin:process.env.YWI_TRUSTED_SOURCE_PIN_SHA256,
   sourceRevision,manifestSha256});
  process.stdout.write(JSON.stringify({packet,sourceSideVerification:verified})+'\n');
 }else{
  // Original custody host must first independently observe REAL source runtime health.
  // A copied CI status, deployment READY flag, mock or static fixture cannot be used.
  const observationFile=realpathSync(process.argv[5]);
  const root=realpathSync(resolve('.'));
  const rel=relative(root,observationFile);
  if(!(rel==='..'||rel.startsWith('..'+sep)))throw Error('HEALTH_OBSERVATION_WITHIN_REPOSITORY');
  const info=statSync(observationFile);
  if(!info.isFile()||info.size>8192)throw Error('INVALID_HEALTH_OBSERVATION_FILE');
  const observation=JSON.parse(readFileSync(observationFile,'utf8'));
  if(observation.manifestSha256!==manifestSha256)throw Error('MANIFEST_OBSERVATION_MISMATCH');
  const payload=build364Payload({sourceRevision,manifestRevision:observation.manifestRevision,
   keyId:process.env.YWI_SOURCE_SIGNER_KEY_ID,health:observation.health,
   nonce:randomBytes(32).toString('hex')});
  const receipt=signBuild364Receipt({payload,encryptedPrivateKeyPem,
   passphrase:process.env.YWI_SOURCE_SIGNER_PASSPHRASE,
   expectedPublicPin:process.env.YWI_TRUSTED_SOURCE_PIN_SHA256});
  const privateKey=(await import('node:crypto')).createPrivateKey({key:encryptedPrivateKeyPem,
   format:'pem',passphrase:process.env.YWI_SOURCE_SIGNER_PASSPHRASE});
  const publicKeyPem=(await import('node:crypto')).createPublicKey(privateKey)
   .export({type:'spki',format:'pem'});
  const sourceSideVerification=verifyBuild364Receipt(receipt,{
   trustedKeyId:process.env.YWI_SOURCE_SIGNER_KEY_ID,trustedPublicKeyPem:publicKeyPem,
   sourceRevision});
  // Public key must be enrolled at Build364 independently; do not trust this output as enrollment.
  process.stdout.write(JSON.stringify({receipt,manifestSha256,publicKeyPem,
   sourceSideVerification,controllerEnrollment:'HOLD_UNTIL_INDEPENDENT_VERIFICATION',
   ownerAccepted:false,connection:'HOLD'})+'\n');
 }
}catch(error){
 const safe=String(error?.message||'').match(/^(?:MASTER363_YW_HOLD_[A-Z0-9_]+|PRIVATE_KEY_WITHIN_REPOSITORY|PRIVATE_KEY_CUSTODY_PERMISSIONS|SIGN_COMMAND_REVISION_AND_MANIFEST_DIGEST_REQUIRED)$/)?.[0]
  || 'PRIVATE_SIGNER_OR_INDEPENDENT_PIN_UNAVAILABLE';
 process.stderr.write('MASTER363-YW-SOURCE-CONVERGE HOLD: '+safe+'\n');
 process.exitCode=2;
}

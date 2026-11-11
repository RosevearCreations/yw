// Run only on the independent authorized source custody host, after deployment.
// No private key, passphrase, tenant data or raw environment variable is printed.
import {readFileSync,realpathSync,statSync} from 'node:fs';
import {dirname,relative,resolve,sep} from 'node:path';
import {platform} from 'node:os';
import {randomBytes} from 'node:crypto';
import {sourcePayload,signSourcePayload,verifySourcePacket} from '../server/master363-yw-source-converge-558.mjs';

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
 if(process.argv[2]!=='sign'||process.argv.length!==5)throw Error('SIGN_COMMAND_REVISION_AND_MANIFEST_DIGEST_REQUIRED');
 const sourceRevision=process.argv[3],manifestSha256=process.argv[4];
 const encryptedPrivateKeyPem=privatePem(process.env.YWI_SOURCE_SIGNER_KEY_FILE);
 const payload=sourcePayload({sourceRevision,manifestSha256,nonce:randomBytes(32).toString('hex')});
 const packet=signSourcePayload({payload,encryptedPrivateKeyPem,
  passphrase:process.env.YWI_SOURCE_SIGNER_PASSPHRASE,
  expectedPublicPin:process.env.YWI_TRUSTED_SOURCE_PIN_SHA256});
 const verified=verifySourcePacket(packet,{trustedPublicPin:process.env.YWI_TRUSTED_SOURCE_PIN_SHA256,
  sourceRevision,manifestSha256});
 process.stdout.write(JSON.stringify({packet,sourceSideVerification:verified})+'\n');
}catch(error){
 const safe=String(error?.message||'').match(/^(?:MASTER363_YW_HOLD_[A-Z0-9_]+|PRIVATE_KEY_WITHIN_REPOSITORY|PRIVATE_KEY_CUSTODY_PERMISSIONS|SIGN_COMMAND_REVISION_AND_MANIFEST_DIGEST_REQUIRED)$/)?.[0]
  || 'PRIVATE_SIGNER_OR_INDEPENDENT_PIN_UNAVAILABLE';
 process.stderr.write('MASTER363-YW-SOURCE-CONVERGE HOLD: '+safe+'\n');
 process.exitCode=2;
}

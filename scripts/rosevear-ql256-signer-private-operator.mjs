// Must be run by a real authorized private custodian on their secured host, not CI.
import {provisionOperatorSigner} from '../server/rosevear-ql256-signer-provisioning-487.mjs';
const destination=process.argv[2];
const passphrase=process.env.YWI_QL256_SIGNER_PASSPHRASE;
try {
 const result=provisionOperatorSigner({outputDirectory:destination,passphrase});
 process.stdout.write(JSON.stringify(result)+'\n');
}catch(error){
 process.stderr.write('QL-256 private signer provisioning blocked: '+String(error.message).replace(/[^A-Z0-9_ -]/gi,'')+'\n');
 process.exitCode=1;
}

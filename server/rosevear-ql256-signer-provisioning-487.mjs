// QL-256: authentic private-operator key provisioning, NOT owner/test authorization.
import {generateKeyPairSync,createHash,createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';
import {existsSync,realpathSync,statSync,writeFileSync} from 'node:fs';
import {resolve,relative,isAbsolute,join,sep} from 'node:path';

export const sourceEvidenceA=Object.freeze({
 repository:'RosevearCreations/yw',
 sourceShaA:'2c7b07037beb1b0ac239eb1b994cb6a87fd1923e',
 sourceCiUrl:'https://github.com/RosevearCreations/yw/actions/runs/40884395920',
 sourceCiRunId:40884395920,
 sourceCiHeadSha:'2c7b07037beb1b0ac239eb1b994cb6a87fd1923e',
 sourceCiConclusion:'success',
 // Public GitHub observation: not an independent private witness/owner attestation.
 proofCommitShaB:null,originalSignedProofPublished:false,ownerTestAuthorization:'NOT_GIVEN'
});
export const ql256RequiredNames=Object.freeze([
 {name:'YWI_QL256_SIGNER_PRIVATE_KEY_ENCRYPTED',kind:'private_file',scope:'private_operator_only'},
 {name:'YWI_QL256_SIGNER_PASSPHRASE',kind:'secret',scope:'private_operator_only'},
 {name:'YWI_QL256_SIGNER_PUBLIC_SPKI_SHA256',kind:'public_digest',scope:'trusted_private_registry'},
 {name:'YWI_QL256_NONPRODUCTION_TENANT_ID',kind:'tenant_id',scope:'privately_verified_only'},
 {name:'YWI_QL256_CUSTODIAN_RECEIPT_ID',kind:'opaque_reference',scope:'private_witness_return'},
 {name:'YWI_QL256_WITNESS_RECEIPT_ID',kind:'opaque_reference',scope:'private_witness_return'},
 {name:'YWI_QL256_OWNER_TEST_RECEIPT_ID',kind:'opaque_reference',scope:'independent_owner_review'}
]);
const bad=(condition,code)=>{if(!condition)throw Error('QL256_487_BLOCKED_'+code);};

export function provisionOperatorSigner({outputDirectory,passphrase,repositoryRoot=process.cwd()}={}){
 bad(typeof outputDirectory==='string'&&isAbsolute(outputDirectory),'ABSOLUTE_OUTPUT_DIRECTORY');
 bad(typeof passphrase==='string'&&passphrase.length>=24&&passphrase.length<=1024,'PASSPHRASE_REQUIRED');
 const root=realpathSync(repositoryRoot),target=realpathSync(outputDirectory);
 const rel=relative(root,target);
 bad(rel==='..'||rel.startsWith('..'+sep),'PRIVATE_PATH_OUTSIDE_REPOSITORY');
 bad(statSync(target).isDirectory()&&(statSync(target).mode&0o077)===0,'PRIVATE_DIRECTORY_PERMISSIONS');
 for(const filename of ['ql256-ed25519-encrypted-pkcs8.pem','ql256-ed25519-public-spki.pem','ql256-ed25519-fingerprint.txt'])
  bad(!existsSync(join(target,filename)),'NO_OVERWRITE');
 const {publicKey,privateKey}=generateKeyPairSync('ed25519');
 const encrypted=privateKey.export({type:'pkcs8',format:'pem',cipher:'aes-256-cbc',passphrase});
 const publicPem=publicKey.export({type:'spki',format:'pem'});
 const publicDer=publicKey.export({type:'spki',format:'der'});
 const fingerprint=createHash('sha256').update(publicDer).digest('hex');
 // Confirm actual private material decrypts and signs before writing operator-owned files.
 const recovered=createPrivateKey({key:encrypted,format:'pem',passphrase});
 const message=Buffer.from('rosevear.integration.v1 QL256 signer self-test');
 bad(verify(null,message,createPublicKey(recovered),sign(null,message,recovered)),'CRYPTOSYSTEM_SELF_TEST');
 writeFileSync(join(target,'ql256-ed25519-encrypted-pkcs8.pem'),encrypted,{flag:'wx',mode:0o600});
 writeFileSync(join(target,'ql256-ed25519-public-spki.pem'),publicPem,{flag:'wx',mode:0o600});
 writeFileSync(join(target,'ql256-ed25519-fingerprint.txt'),fingerprint+'\n',{flag:'wx',mode:0o600});
 return {publicSpkiSha256:fingerprint,encryptedPrivateKeyCreated:true,
  originalSignedProofCreated:false,independentlyCustodied:false,
  independentWitnessAssigned:false,ownerTestAuthorized:false,connection_state:'DISCONNECTED'};
}

export function ql256Inventory({vercelEnvNames=[],projectNames=[],signerPrivateStatus='UNKNOWN'}={}){
 bad(Array.isArray(vercelEnvNames)&&vercelEnvNames.every(x=>typeof x==='string'),'ENV_NAMES');
 bad(Array.isArray(projectNames)&&projectNames.every(x=>typeof x==='string'),'PROJECT_NAMES');
 bad(['UNKNOWN','ENCRYPTED_OPERATOR_FILE_PRESENT','NOT_PROVISIONED'].includes(signerPrivateStatus),'SIGNER_STATE');
 return {sourceEvidenceA,vercelEnvCount:vercelEnvNames.length,
  signerProvisioningDecision:signerPrivateStatus==='ENCRYPTED_OPERATOR_FILE_PRESENT'?
   'SIGNER_EXISTS_CUSTODY_NOT_VERIFIED':signerPrivateStatus==='NOT_PROVISIONED'?
   'SIGNER_NOT_PROVISIONED':'SIGNER_STATUS_UNKNOWN',
  isolatedYardWorkersNonproductionTenantVerified:false,
  independentCustodianAssigned:false,independentWitnessAssigned:false,
  proofBPublished:false,realGatewayGets:'NOT_RUN',ownerTestDecision:'NOT_GIVEN',
  connection_state:'DISCONNECTED',decision:'HOLD'};
}

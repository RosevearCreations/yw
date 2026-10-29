// Local operator-only verifier. Neither evidence file belongs in GitHub/CI.
import {readFileSync,realpathSync,statSync} from 'node:fs';
import {dirname,isAbsolute,relative,sep} from 'node:path';
import {verifyPinnedCustodyReceipts} from '../server/rosevear-ql256-custody-isolation-488.mjs';

function privateFile(raw,repoRoot) {
  if (!raw || !isAbsolute(raw)) throw Error('ABSOLUTE_PRIVATE_FILE_REQUIRED');
  const p=realpathSync(raw),root=realpathSync(repoRoot),rel=relative(root,p);
  if (!(rel==='..'||rel.startsWith('..'+sep))) throw Error('REPOSITORY_PATH_FORBIDDEN');
  const info=statSync(p),dir=statSync(dirname(p));
  if (!info.isFile() || (info.mode&0o077)!==0 || (dir.mode&0o077)!==0)
    throw Error('PRIVATE_FILE_OR_DIRECTORY_PERMISSIONS');
  if (info.size>65536) throw Error('PRIVATE_EVIDENCE_TOO_LARGE');
  return JSON.parse(readFileSync(p,'utf8'));
}

try {
  if (process.argv.length!==4) throw Error('REQUIRES_PRIVATE_CUSTODY_PACKET_AND_SEPARATE_REGISTRY');
  const packet=privateFile(process.argv[2],process.cwd());
  const registry=privateFile(process.argv[3],process.cwd());
  const verified=verifyPinnedCustodyReceipts(packet,registry);
  // Never print identities, paths, private receipts or raw attestations.
  process.stdout.write(JSON.stringify(verified,null,2)+'\n');
  process.stdout.write('Independent private registry provenance and tenant isolation still require human verification.\n');
} catch (err) {
  const message=String(err?.message||'UNVERIFIED');
  // Filesystem/JSON exceptions can contain private paths or contents. Expose
  // only our own fixed error codes, never raw exception text.
  const safe=/^(?:QL256_488_HOLD_[A-Z0-9_]+|ABSOLUTE_PRIVATE_FILE_REQUIRED|REPOSITORY_PATH_FORBIDDEN|PRIVATE_FILE_OR_DIRECTORY_PERMISSIONS|PRIVATE_EVIDENCE_TOO_LARGE|REQUIRES_PRIVATE_CUSTODY_PACKET_AND_SEPARATE_REGISTRY)$/.test(message)
    ? message : 'PRIVATE_EVIDENCE_UNAVAILABLE_OR_INVALID';
  process.stderr.write('QL256_488_OPERATOR_HOLD: '+safe+'\n');
  process.exitCode=2;
}

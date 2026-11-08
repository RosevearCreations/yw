import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=(path)=>fs.readFileSync(path,'utf8');
const mobile=read('js/mobile-today.js');
const client=read('js/api.js');
const endpoint=read('supabase/functions/upload-mobile-rework-photo/index.ts');
const manage=read('supabase/functions/operations-manage/index.ts');
const browser={YWI_AUTH:{getState:()=>({profile:{id:'11111111-1111-4111-8111-111111111111'}})}};
const saved=new Map();
const sessionStorage={getItem:(key)=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value),removeItem:(key)=>saved.delete(key)};
vm.runInNewContext(mobile,{window:browser,document:{addEventListener(){}},navigator:{onLine:true},sessionStorage,console},{filename:'mobile-today.js'});
const ui=browser.YWIMobileToday;
const row={work_order:{id:'21111111-1111-4111-8111-111111111111'},closeout:{closeout_status:'rework_required',rejected_at:'2026-11-08T12:00:00Z',rejection_reason:'Inspect corrected fence'},evidence:{proofs:[]}};
const draft=ui.crewPhotoDraft(row);
assert.ok(draft);
draft.notes='The damaged east fence has been repaired.';
draft.open=true;
ui.persistCrewPhotoDraft(row);
assert.ok(saved.has(ui.crewPhotoDraftKey(row)),'Text draft stays scoped to profile, job and rejection');
assert.ok(!saved.get(ui.crewPhotoDraftKey(row)).includes('files'),'Binary file contents must not be saved in web storage');
assert.ok(ui.crewPhotoEditorMarkup(row,0).includes('textarea'));
assert.ok(!ui.crewPhotoEditorMarkup(row,0).includes('<script>'));
assert.notEqual(ui.crewPhotoDraftKey(row),ui.crewPhotoDraftKey({...row,closeout:{...row.closeout,rejected_at:'2026-11-09T12:00:00Z'}}));
ui.discardCrewPhotoDraft(row);
assert.ok(!saved.has(ui.crewPhotoDraftKey(row)));

for(const guard of [
  "const BUCKET = 'review-assets'", "const MAX_BYTES = 5 * 1024 * 1024", "supabase.auth.getUser(token)",
  "profile.is_active===false", "hasModuleAccess(supabase,profile,'jobs','create')",
  "from('work_order_closeout_packages')", "from('dispatch_schedule_items')", "from('crew_members')",
  "['cancelled','superseded']", "Only assigned crew can access", "imageKind(file)",
  "file.size>MAX_BYTES", "review_storage_bucket:BUCKET", "asset_status:'review'", "surface_area:'internal'",
  "consent_status:'pending'", "customer_visible:false", "createSignedUrl(asset.review_storage_path,300)"
]) assert.ok(endpoint.includes(guard),'Missing private upload/review protection '+guard);
assert.ok(!endpoint.includes("from('public-assets')"),'Private correction evidence must never use the public storage bucket');
for(const guard of ["assetIds.length>4", "asset.metadata?.source!=='mobile_rework_photo_547'",
  "asset.metadata?.uploaded_by_profile_id!==profile.id", "asset.metadata?.rejected_at!==closeout.rejected_at",
  "asset.review_storage_bucket!=='review-assets'", "p_asset_ids:assetIds", "p_customer_visible:false"])
  assert.ok(manage.includes(guard),'Missing proof-asset assignment/visibility guard '+guard);
assert.ok(client.includes("mobileReworkPhoto") && client.includes('upload-mobile-rework-photo'));
assert.ok(mobile.includes('data-crew-photo-save') && mobile.includes('data-crew-photo-review') && mobile.includes('URL.revokeObjectURL'));
console.log('YW 547 private correction photo intake, proof ownership, review and session draft recovery GREEN');

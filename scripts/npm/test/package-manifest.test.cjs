const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {readWebManifest}=require('../package-manifest.cjs');
function fixture(t,patch={}){const root=fs.mkdtempSync(path.join(os.tmpdir(),'engine-web-manifest-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(path.join(root,'engine-sdk.json'),JSON.stringify({schemaVersion:2,kind:'engine',component:'web',engineVersion:'4.0.0',engineRevision:'r1',sdkReleaseId:'r1',entries:{inputFormat:'esm-js'},...patch}));return root;}
test('accepts generated modular Web identity without CLI imports',t=>{assert.equal(readWebManifest(fixture(t)).engineRevision,'r1');});
test('rejects editor identity and missing Web identity',t=>{assert.throws(()=>readWebManifest(fixture(t,{component:'editor'})),/Web SDK/);assert.throws(()=>readWebManifest(fixture(t,{sdkReleaseId:''})),/identity/);});
test('rejects browser entry outside the generated Web package',t=>{assert.throws(()=>readWebManifest(fixture(t,{profiles:{web:{entry:'../outside.js'}}})),/escapes/);});

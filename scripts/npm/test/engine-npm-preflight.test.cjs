const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateEngineNpmInputs } = require('../engine-npm-preflight');
function fixture(t) {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-preflight-'));
 t.after(() => fs.rmSync(root, { recursive: true, force: true }));
 fs.writeFileSync(path.join(root, 'cc.config.json'), JSON.stringify({ features: { worker: {}, 'worker-pool': {}, webassembly: {} } }));
 for (const target of ['web', 'nodejs', 'minigame']) { fs.mkdirSync(path.join(root, 'pal/worker', target), { recursive: true }); fs.writeFileSync(path.join(root, 'pal/worker', target, 'index.js'), ''); }
 return root;
}
test('missing PAL fails before packaging', t => {
 const root=fixture(t); fs.rmSync(path.join(root,'pal/worker/nodejs/index.js'));
 assert.throws(()=>validateEngineNpmInputs(root), /ENGINE_NPM_PAL_INCOMPLETE/);
});
test('missing prepared profile is rejected', t => {
 const root=fixture(t); assert.throws(()=>validateEngineNpmInputs(root,['editor']),/ENGINE_NPM_PROFILE_INCOMPLETE/);
});
test('stale maps and missing bundled implementations are rejected', t => {
 const root=fixture(t), profile=path.join(root,'bin/.cache/dev-cli/editor'); fs.mkdirSync(path.join(profile,'bundled'),{recursive:true});
 fs.writeFileSync(path.join(profile,'import-map.json'),JSON.stringify({imports:{}})); fs.writeFileSync(path.join(profile,'bundled/index.js'),'');
 assert.throws(()=>validateEngineNpmInputs(root,['editor']),/ENGINE_NPM_PROFILE_STALE/);
 const imports=Object.fromEntries(['worker','worker-pool','webassembly'].map(id=>['cce:/internal/x/cc-fu/'+id,'q-bundled:///exports/'+id+'.js'])); imports['pal/worker']='q-bundled:///pal/worker.js';
 fs.writeFileSync(path.join(profile,'import-map.json'),JSON.stringify({imports}));
 assert.throws(()=>validateEngineNpmInputs(root,['editor']),/ENGINE_NPM_PROFILE_STALE/);
 fs.writeFileSync(path.join(profile,'bundled/index.js'),Object.values(imports).map(id=>'System.register('+JSON.stringify(id)+', [], function(){});').join('\n'));
 assert.doesNotThrow(()=>validateEngineNpmInputs(root,['editor']));
});

test('stale synchronized PAL version is rejected', t => {
 const root=fixture(t);fs.mkdirSync(path.join(root,'node_modules/@cocos/engine-pal'),{recursive:true});fs.writeFileSync(path.join(root,'node_modules/@cocos/engine-pal/package.json'),JSON.stringify({version:'2.0.0'}));fs.writeFileSync(path.join(root,'pal/.pal-source.json'),JSON.stringify({package:'@cocos/engine-pal',version:'1.0.0'}));assert.throws(()=>validateEngineNpmInputs(root),/ENGINE_NPM_PAL_STALE/);
});

test('templates cover unregistered web platforms without native launch projects', t => {
 const root=fixture(t);for(const name of ['custom-game','baidu-mini-game','web-mobile','common','google-play','windows','xr-pico'])fs.mkdirSync(path.join(root,'templates',name),{recursive:true});
 assert.deepEqual(require('../pack-engine-npm').selectWebTemplates(root).sort(),['baidu-mini-game','custom-game','web-mobile']);
});

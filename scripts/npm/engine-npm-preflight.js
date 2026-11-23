'use strict';
const fs = require('node:fs');
const path = require('node:path');

function validateEngineNpmInputs(source, profiles = [], profileRoot = path.join(source, 'bin/.cache/dev-cli')) {
    const config = JSON.parse(fs.readFileSync(path.join(source, 'cc.config.json'), 'utf8'));
    const palStamp = path.join(source, 'pal/.pal-source.json');
    const palPackage = path.join(source, 'node_modules/@cocos/engine-pal/package.json');
    if (fs.existsSync(palStamp) && fs.existsSync(palPackage)) {
        const prepared = JSON.parse(fs.readFileSync(palStamp, 'utf8'));
        const installed = JSON.parse(fs.readFileSync(palPackage, 'utf8'));
        if (prepared.package === '@cocos/engine-pal' && prepared.version !== installed.version) throw new Error('[ENGINE_NPM_PAL_STALE] PAL differs from the installed package; synchronize PAL before compiling or packaging.');
    }
    const workerUnits = ['worker', 'worker-pool', 'webassembly'].filter(id => config.features?.[id]);
    if (config.features?.worker) {
        for (const platform of ['nodejs', 'web', 'minigame']) {
            const file = path.join(source, 'pal/worker', platform, 'index.js');
            if (!fs.existsSync(file)) throw new Error('[ENGINE_NPM_PAL_INCOMPLETE] Missing ' + file + '; install engine dependencies and synchronize PAL before compiling profiles.');
        }
    }
    for (const profile of profiles) {
        const root = path.join(profileRoot, profile);
        const mapFile = path.join(root, 'import-map.json');
        const bundleFile = path.join(root, 'bundled/index.js');
        if (!fs.existsSync(mapFile) || !fs.existsSync(bundleFile)) throw new Error('[ENGINE_NPM_PROFILE_INCOMPLETE] Prepare ' + profile + ' import map and bundle before packaging.');
        const imports = JSON.parse(fs.readFileSync(mapFile, 'utf8')).imports || {};
        const code = fs.readFileSync(bundleFile, 'utf8');
        const registrations = new Set([...code.matchAll(/System\.register\(["']([^"']+)["']/g)].map(match => match[1]));
        for (const [specifier, mapped] of Object.entries(imports)) {
            if ((specifier.startsWith('cce:/internal/x/cc-fu/') || specifier.startsWith('pal/')) && typeof mapped === 'string' && mapped.startsWith('q-bundled:') && !registrations.has(mapped)) throw new Error('[ENGINE_NPM_PROFILE_STALE] ' + profile + ' bundle is missing ' + specifier + '; recompile the engine before packaging.');
        }
        for (const id of workerUnits.map(unit => 'cce:/internal/x/cc-fu/' + unit).concat(config.features?.worker ? ['pal/worker'] : [])) {
            const mapped = imports[id];
            if (!mapped || !registrations.has(mapped)) throw new Error('[ENGINE_NPM_PROFILE_STALE] ' + profile + ' profile is missing ' + id + '; synchronize PAL, then recompile the engine before packaging.');
        }
    }
}
module.exports = { validateEngineNpmInputs };

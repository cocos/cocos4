'use strict';
const fs = require('node:fs');
const path = require('node:path');
/** Validate a generated Web package used as the identity base for Editor packaging. */
function readWebManifest(root) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'engine-sdk.json'), 'utf8'));
    if (manifest.schemaVersion !== 2 || manifest.kind !== 'engine' || manifest.component !== 'web') throw new Error('A generated schemaVersion 2 Web SDK is required');
    for (const key of ['engineVersion', 'engineRevision', 'sdkReleaseId']) if (typeof manifest[key] !== 'string' || !manifest[key].trim()) throw new Error('Missing Web SDK identity: ' + key);
    if (!manifest.entries || manifest.entries.inputFormat !== 'esm-js') throw new Error('Web SDK must provide modular ESM inputs');
    const entry = manifest.profiles?.web?.entry;
    if (entry) {
        if (typeof entry !== 'string' || path.isAbsolute(entry) || entry.split(/[\\/]/).includes('..')) throw new Error('Web SDK entry escapes its package');
        const base = fs.realpathSync(root);
        const target = fs.realpathSync(path.resolve(base, entry));
        const relative = path.relative(base, target);
        if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('Web SDK entry escapes its package');
    }
    return manifest;
}
module.exports = { readWebManifest };

const fs = require('fs');
const path = require('path');

// Register additional PAL capability checks here. Each check receives palRoot,
// returns true if it changed files, and throws when the build cannot continue.
// Checks must be safe to repeat and preserve existing real PAL implementations.
const checks = [
    ensureWorker,
];

// Shared entry for installation and every engine build path.
module.exports = function ensurePal(palRoot = path.join(__dirname, '..', 'pal')) {
    if (!fs.existsSync(palRoot) || !fs.statSync(palRoot).isDirectory()) {
        throw new Error(`PAL directory is missing: ${palRoot}. Install engine dependencies first.`);
    }
    let changed = false;
    for (const check of checks) {
        // Always execute every check, even if an earlier one changed files.
        if (check(palRoot)) changed = true;
    }
    return changed;
};

// Older PAL packages have no worker module. Supply a platform-independent,
// unavailable backend so static imports resolve and WorkerPool can run inline.
function ensureWorker(palRoot) {
    const workerRoot = path.join(palRoot, 'worker');
    const templateRoot = path.join(__dirname, 'pal-worker-fallback');
    const platforms = ['web', 'minigame', 'native', 'nodejs'];
    const forwarder = "export { createWorkerBackend } from '../index.js';\n";
    const files = ['index.js', 'index.d.ts', 'type.d.ts'];
    if (fs.existsSync(workerRoot)) {
        const index = path.join(workerRoot, 'index.js');
        // Upgrade an engine-generated compatibility module after its PAL contract changes.
        // Do not replace any real platform implementation, even after a partial local copy.
        const generated = fs.existsSync(index)
            && fs.readFileSync(index, 'utf8').startsWith('// Compatibility only: real platform implementations remain in cocos-pal.')
            && platforms.every((platform) => {
                const entry = path.join(workerRoot, platform, 'index.js');
                return fs.existsSync(entry) && fs.readFileSync(entry, 'utf8') === forwarder;
            });
        if (!generated) return false;
        if (files.every((file) => fs.existsSync(path.join(workerRoot, file))
            && fs.readFileSync(path.join(workerRoot, file)).equals(fs.readFileSync(path.join(templateRoot, file))))
            && platforms.every((platform) => {
                const declaration = path.join(workerRoot, platform, 'index.d.ts');
                return fs.existsSync(declaration) && fs.readFileSync(declaration, 'utf8') === forwarder;
            })) return false;
    }
    fs.mkdirSync(workerRoot, { recursive: true });
    for (const file of files) {
        fs.copyFileSync(path.join(templateRoot, file), path.join(workerRoot, file));
    }
    for (const platform of platforms) {
        const dir = path.join(workerRoot, platform);
        fs.mkdirSync(dir, { recursive: true });
        for (const ext of ['js', 'd.ts']) {
            fs.writeFileSync(path.join(dir, `index.${ext}`), forwarder);
        }
    }
    console.log('[pal-worker] PAL has no worker module; installed single-thread compatibility backend.');
    return true;
}

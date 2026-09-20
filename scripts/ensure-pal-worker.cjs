const fs = require('fs');
const path = require('path');

// Older PAL packages have no worker module. Supply a platform-independent,
// unavailable backend so static imports resolve and WorkerPool can run inline.
module.exports = function ensurePalWorker(palRoot = path.join(__dirname, '..', 'pal')) {
    if (!fs.existsSync(palRoot)) {
        throw new Error(`PAL directory is missing: ${palRoot}. Install engine dependencies first.`);
    }
    const workerRoot = path.join(palRoot, 'worker');
    if (fs.existsSync(workerRoot)) return false;

    const templateRoot = path.join(__dirname, 'pal-worker-fallback');
    fs.mkdirSync(workerRoot, { recursive: true });
    for (const file of ['index.js', 'index.d.ts', 'type.d.ts']) {
        fs.copyFileSync(path.join(templateRoot, file), path.join(workerRoot, file));
    }
    for (const platform of ['web', 'minigame', 'native', 'nodejs']) {
        const dir = path.join(workerRoot, platform);
        fs.mkdirSync(dir);
        for (const ext of ['js', 'd.ts']) {
            fs.writeFileSync(path.join(dir, `index.${ext}`), "export { createWorkerBackend } from '../index.js';\n");
        }
    }
    console.log('[pal-worker] PAL has no worker module; installed single-thread compatibility backend.');
    return true;
};

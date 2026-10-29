// Build and exercise the optimized public Worker API with a Worker-capable PAL.
// Optional first argument: an isolated engine checkout used for validation.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const assert = require('node:assert/strict');
const { buildEngine } = require('@cocos/ccbuild');

async function main() {
    const engine = fs.realpathSync(process.argv[2] || path.join(__dirname, '..'));
    const out = path.join(engine, 'bin', 'worker-release-check');
    const options = {
        engine,
        platform: 'HTML5',
        moduleFormat: 'cjs',
        mode: 'BUILD',
        compress: true,
        split: false,
        sourceMap: false,
        loose: true,
        inlineEnum: true,
        mangleProperties: true,
        flags: { DEBUG: false },
    };
    // Pool-only selection must also expose the basic API when calling ccbuild directly.
    await buildEngine({ ...options, out, features: ['worker-pool'] });
    const basicOut = path.join(out, 'basic');
    const disabledOut = path.join(out, 'disabled');
    for (const [target, features] of [[basicOut, ['worker']], [disabledOut, ['affine-transform']]]) {
        await buildEngine({ ...options, out: target, features, sourceMap: true });
        const map = JSON.parse(fs.readFileSync(path.join(target, 'cc.js.map'), 'utf8'));
        assert.ok(!map.sources.some(file => /worker-pool\.ts$/.test(file)), 'pool implementation must be omitted');
        if (target === disabledOut) {
            assert.ok(!map.sources.some(file => /(?:pal\/worker\/|misc\/worker\.ts$)/.test(file)),
                'disabled Worker features must omit the basic API and PAL Worker');
        }
    }
    console.log('[worker features] minified bytes:', {
        worker: fs.statSync(path.join(basicOut, 'cc.js')).size,
        workerPool: fs.statSync(path.join(out, 'cc.js')).size,
    });
    execFileSync(process.execPath, [
        path.join(__dirname, '../tests/scripts/worker-release.test.cjs'),
        path.join(out, 'cc.js'),
        path.join(basicOut, 'cc.js'),
        path.join(disabledOut, 'cc.js'),
    ], { stdio: 'inherit' });
}

// ccbuild can retain minifier worker threads after returning. This standalone CLI owns that work;
// exit only after all builds and the synchronous child test process have finished.
main().then(() => process.exit(0), (error) => {
    console.error(error);
    process.exit(1);
});

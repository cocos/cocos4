// Build and exercise the optimized public Worker API with a Worker-capable PAL.
// Optional first argument: an isolated engine checkout used for validation.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildEngine } = require('@cocos/ccbuild');

async function main() {
    const engine = fs.realpathSync(process.argv[2] || path.join(__dirname, '..'));
    const out = path.join(engine, 'bin', 'worker-release-check');
    await buildEngine({
        engine,
        out,
        features: ['worker'],
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
    });
    execFileSync(process.execPath, [
        path.join(__dirname, '../tests/scripts/worker-release.test.cjs'),
        path.join(out, 'cc.js'),
    ], { stdio: 'inherit' });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

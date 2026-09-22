const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

test('common PAL entry rejects a missing root or a file before installing fallbacks', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pal root '));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const ensure = require('../../scripts/ensure-pal.cjs');
    const missing = path.join(root, 'missing');
    assert.throws(() => ensure(missing), /Install engine dependencies first/);
    assert.equal(fs.existsSync(missing), false);
    const file = path.join(root, 'file');
    fs.writeFileSync(file, 'unchanged');
    assert.throws(() => ensure(file), /Install engine dependencies first/);
    assert.equal(fs.readFileSync(file, 'utf8'), 'unchanged');
});

test('old generated fallback is refreshed when the engine PAL contract changes', (t) => {
    const pal = fs.mkdtempSync(path.join(os.tmpdir(), 'pal contract '));
    t.after(() => fs.rmSync(pal, { recursive: true, force: true }));
    const ensure = require('../../scripts/ensure-pal.cjs');
    assert.equal(ensure(pal), true);
    const index = path.join(pal, 'worker/index.js');
    const latest = fs.readFileSync(index, 'utf8');
    fs.writeFileSync(index, '// Compatibility only: real platform implementations remain in cocos-pal.\nexport function createWorkerBackend() { return {}; }\n');
    assert.equal(ensure(pal), true);
    assert.equal(fs.readFileSync(index, 'utf8'), latest);
    assert.equal(ensure(pal), false, 'unchanged compatibility files must not be rewritten');
});

for (const entry of [
    'build-h5-source.js', 'build-h5-minified.js', 'build-cli-minified.js',
    'build-declarations.js', 'build-const.js', 'compile-native-ts.js',
]) {
    test(`${entry} prepares an existing old PAL before loading the compiler, without reinstalling`, (t) => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'build old pal '));
        t.after(() => fs.rmSync(root, { recursive: true, force: true }));
        const scripts = path.join(root, 'scripts');
        fs.mkdirSync(scripts);
        for (const name of [entry, 'ensure-pal.cjs', 'pal-worker-fallback']) {
            fs.cpSync(path.resolve(__dirname, '../../scripts', name), path.join(scripts, name), { recursive: true });
        }
        const pal = path.join(root, 'pal');
        fs.mkdirSync(pal);
        fs.writeFileSync(path.join(pal, 'existing.js'), 'keep local PAL unchanged');
        // Stop when the actual entry loads ccbuild. No compiler dependencies or
        // npm install are present in this fixture: preparation must happen first.
        const preload = path.join(root, 'check.cjs');
        fs.writeFileSync(preload, `
            const fs = require('fs');
            const path = require('path');
            const assert = require('node:assert/strict');
            const Module = require('module');
            const originalLoad = Module._load;
            Module._load = function (request, ...args) {
                if (request === '@cocos/ccbuild') {
                    for (const platform of ['web', 'minigame', 'native', 'nodejs']) {
                        assert.ok(fs.existsSync(path.join(__dirname, 'pal/worker', platform, 'index.js')));
                    }
                    assert.ok(fs.existsSync(path.join(__dirname, 'pal/worker/type.d.ts')));
                    console.log('COMPILER_READY');
                    process.exit(0);
                }
                if (request === 'fs-extra') return {};
                if (request === 'chalk') return {};
                return originalLoad.call(this, request, ...args);
            };
        `);
        function build() {
            const result = spawnSync(process.execPath, ['--require', preload, path.join(scripts, entry)], {
                cwd: os.tmpdir(), encoding: 'utf8',
            });
            assert.equal(result.status, 0, result.stderr);
            assert.match(result.stdout, /COMPILER_READY/);
            return result.stdout;
        }
        assert.match(build(), /single-thread compatibility/);
        assert.equal(fs.readFileSync(path.join(pal, 'existing.js'), 'utf8'), 'keep local PAL unchanged');
        // Simulate a newer PAL and prove repeated builds do not replace it.
        const workerEntry = path.join(pal, 'worker/web/index.js');
        fs.writeFileSync(workerEntry, 'real platform implementation');
        assert.doesNotMatch(build(), /single-thread compatibility/);
        assert.equal(fs.readFileSync(workerEntry, 'utf8'), 'real platform implementation');
    });
}

test('install old PAL, upgrade to worker PAL, and downgrade without stale implementations', async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spread pal '));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const scripts = path.join(root, 'scripts');
    const sourceScripts = path.resolve(__dirname, '../../scripts');
    fs.mkdirSync(scripts);
    for (const name of ['spread-pal.cjs', 'ensure-pal.cjs', 'pal-worker-fallback']) {
        fs.cpSync(path.join(sourceScripts, name), path.join(scripts, name), { recursive: true });
    }
    // Use the default npm-package source, just like the engine postinstall hook.
    const installed = path.join(root, 'node_modules/@cocos/engine-pal/dist');
    fs.mkdirSync(installed, { recursive: true });
    fs.writeFileSync(path.join(installed, 'unrelated.js'), 'export const value = 42;\n');
    fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
    function spread(args = []) {
        const result = spawnSync(process.execPath, [path.join(scripts, 'spread-pal.cjs'), ...args], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
        return result.stdout;
    }
    assert.match(spread(), /single-thread compatibility/);
    const destination = path.join(root, 'pal');
    assert.equal(fs.readFileSync(path.join(destination, 'unrelated.js'), 'utf8'), 'export const value = 42;\n');
    for (const platform of ['web', 'minigame', 'native', 'nodejs']) {
        const entry = path.join(destination, 'worker', platform, 'index.js');
        const { createWorkerBackend } = await import(pathToFileURL(entry).href);
        const backend = createWorkerBackend();
        assert.equal('kind' in backend, false);
        assert.equal(backend.concurrencyLimit, 0);
        assert.equal(backend.scriptFallback, null);
        assert.equal(backend.createFunctionWorker(() => 42), null);
        assert.match(backend.diagnose('task.js').reason, /PAL package has no worker module/);
        assert.ok(fs.existsSync(entry.replace(/\.js$/, '.d.ts')));
    }
    assert.ok(fs.existsSync(path.join(destination, 'worker/type.d.ts')));

    const modern = path.join(root, 'new PAL dist');
    fs.mkdirSync(path.join(modern, 'worker/web'), { recursive: true });
    const realCode = 'export const realWorker = true;\n';
    fs.writeFileSync(path.join(modern, 'worker/web/index.js'), realCode);
    assert.doesNotMatch(spread(['--source', modern]), /single-thread compatibility/);
    assert.equal(fs.readFileSync(path.join(destination, 'worker/web/index.js'), 'utf8'), realCode);
    assert.equal(fs.existsSync(path.join(destination, 'worker/index.js')), false);

    assert.match(spread(), /single-thread compatibility/);
    assert.doesNotMatch(fs.readFileSync(path.join(destination, 'worker/web/index.js'), 'utf8'), /realWorker/);
});

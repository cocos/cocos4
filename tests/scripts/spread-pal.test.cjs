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
    const index = path.join(pal, 'worker/compat.js');
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
                    // Types come from @types/pal/worker.d.ts; the compatibility module is JS only.
                    assert.equal(fs.existsSync(path.join(__dirname, 'pal/worker/type.d.ts')), false);
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
        assert.equal(fs.existsSync(entry.replace(/\.js$/, '.d.ts')), false);
    }
    assert.equal(fs.existsSync(path.join(destination, 'worker/type.d.ts')), false);

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

// ------------------------------------------------------------------ upgrade paths without re-install

const PLATFORMS = ['web', 'minigame', 'native', 'nodejs'];

function makeEngine(t, label) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `${label} `));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const scripts = path.join(root, 'scripts');
    fs.mkdirSync(scripts);
    for (const name of ['spread-pal.cjs', 'ensure-pal.cjs', 'pal-worker-fallback']) {
        fs.cpSync(path.resolve(__dirname, '../../scripts', name), path.join(scripts, name), { recursive: true });
    }
    const pkg = path.join(root, 'node_modules/@cocos/engine-pal');
    const dist = path.join(pkg, 'dist');
    const pal = path.join(root, 'pal');
    return {
        root, dist, pal,
        // A build entry: every scripts/build-*.js calls ensure-pal before loading the compiler.
        ensure: () => require(path.join(scripts, 'ensure-pal.cjs'))(pal),
        spread(args = []) {
            const result = spawnSync(process.execPath, [path.join(scripts, 'spread-pal.cjs'), ...args], { encoding: 'utf8' });
            assert.equal(result.status, 0, result.stderr);
            return result.stdout;
        },
        installPackage(version, { worker, files = {} }) {
            fs.rmSync(pkg, { recursive: true, force: true });
            fs.mkdirSync(dist, { recursive: true });
            fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: '@cocos/engine-pal', version }));
            for (const [file, content] of Object.entries(files)) fs.writeFileSync(path.join(dist, file), content);
            if (worker) writeRealWorker(dist, version);
        },
    };
}

function writeRealWorker(dist, tag) {
    for (const platform of PLATFORMS) {
        fs.mkdirSync(path.join(dist, 'worker', platform), { recursive: true });
        fs.writeFileSync(path.join(dist, 'worker', platform, 'index.js'), `export const real = '${platform} ${tag}';\n`);
    }
    fs.writeFileSync(path.join(dist, 'worker/type.d.ts'), 'export interface IWorker {}\n');
}

function isFallback(pal) {
    return fs.existsSync(path.join(pal, 'worker/compat.js'))
        && fs.readFileSync(path.join(pal, 'worker/compat.js'), 'utf8').startsWith('// Compatibility only');
}

test('fallback switches to the real worker when the installed package gains it without postinstall', (t) => {
    const e = makeEngine(t, 'upgrade stamp');
    e.installPackage('1.0.4', { worker: false, files: { 'shared.js': 'v4', 'removed-later.js': 'old' } });
    assert.match(e.spread(), /single-thread compatibility/);
    assert.ok(isFallback(e.pal));

    // `npm install --ignore-scripts` (or a failed postinstall): package updated, pal/ untouched.
    e.installPackage('1.0.5', { worker: true, files: { 'shared.js': 'v5' } });
    assert.equal(e.ensure(), true);
    assert.equal(isFallback(e.pal), false);
    for (const platform of PLATFORMS) {
        assert.match(fs.readFileSync(path.join(e.pal, 'worker', platform, 'index.js'), 'utf8'), /1\.0\.5/);
    }
    // The whole directory follows the package: no module from the old version survives.
    assert.equal(fs.readFileSync(path.join(e.pal, 'shared.js'), 'utf8'), 'v5');
    assert.equal(fs.existsSync(path.join(e.pal, 'removed-later.js')), false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(e.pal, '.pal-source.json'), 'utf8')).version, '1.0.5');
    assert.equal(e.ensure(), false, 'an up-to-date PAL must not be copied again');
});

test('regular npm install (postinstall spread) replaces the fallback with the real worker', (t) => {
    const e = makeEngine(t, 'upgrade postinstall');
    e.installPackage('1.0.4', { worker: false });
    e.spread();
    assert.ok(isFallback(e.pal));
    e.installPackage('1.0.5', { worker: true });
    assert.doesNotMatch(e.spread(), /single-thread compatibility/);
    assert.equal(isFallback(e.pal), false);
    assert.equal(fs.existsSync(path.join(e.pal, 'worker/web/index.js')), true);
});

test('a pal copy made before source stamps still picks up the installed worker module', (t) => {
    const e = makeEngine(t, 'upgrade legacy');
    e.installPackage('1.0.4', { worker: false, files: { 'shared.js': 'v4' } });
    e.spread();
    fs.rmSync(path.join(e.pal, '.pal-source.json'));
    e.installPackage('1.0.5', { worker: true, files: { 'shared.js': 'v5' } });
    assert.equal(e.ensure(), true);
    assert.equal(isFallback(e.pal), false);
    assert.match(fs.readFileSync(path.join(e.pal, 'worker/web/index.js'), 'utf8'), /1\.0\.5/);
    // Without a stamp the rest of pal/ has no known version: only the missing worker is restored.
    assert.equal(fs.readFileSync(path.join(e.pal, 'shared.js'), 'utf8'), 'v4');
    assert.equal(e.ensure(), false);
});

test('an explicit local PAL source is never mixed with or replaced by the npm package', (t) => {
    const e = makeEngine(t, 'local source');
    const local = path.join(e.root, 'local PAL dist');
    fs.mkdirSync(local);
    fs.writeFileSync(path.join(local, 'shared.js'), 'local');
    e.installPackage('1.0.5', { worker: true, files: { 'shared.js': 'npm' } });
    assert.match(e.spread(['--source', local]), /single-thread compatibility/);
    assert.equal(e.ensure(), false);
    assert.ok(isFallback(e.pal));
    assert.equal(fs.readFileSync(path.join(e.pal, 'shared.js'), 'utf8'), 'local');

    // Once the local source gains a worker, the next build uses it.
    writeRealWorker(local, 'local');
    assert.equal(e.ensure(), true);
    assert.match(fs.readFileSync(path.join(e.pal, 'worker/native/index.js'), 'utf8'), /local/);
    assert.equal(e.ensure(), false);
});

test('a real worker is kept as is, including a local build newer than the package', (t) => {
    const e = makeEngine(t, 'keep real');
    const local = path.join(e.root, 'local PAL dist');
    writeRealWorker(local, 'local');
    e.installPackage('1.0.5', { worker: true });
    e.spread(['--source', local]);
    assert.equal(e.ensure(), false);
    assert.match(fs.readFileSync(path.join(e.pal, 'worker/web/index.js'), 'utf8'), /local/);
});

test('fallbacks generated with declaration files are rewritten as JS only', (t) => {
    const e = makeEngine(t, 'old layout');
    fs.mkdirSync(e.pal);
    assert.equal(e.ensure(), true);
    fs.writeFileSync(path.join(e.pal, 'worker/type.d.ts'), 'export interface IWorker {}\n');
    for (const platform of PLATFORMS) {
        fs.writeFileSync(path.join(e.pal, 'worker', platform, 'index.d.ts'), "export { createWorkerBackend } from '../index.js';\n");
    }
    assert.equal(e.ensure(), true);
    assert.equal(fs.existsSync(path.join(e.pal, 'worker/type.d.ts')), false);
    assert.equal(fs.existsSync(path.join(e.pal, 'worker/web/index.d.ts')), false);
    assert.ok(isFallback(e.pal));
    assert.equal(e.ensure(), false);
});

test('the fallback has no pal/worker/index.js, so `pal/worker` always resolves through the platform override', (t) => {
    const e = makeEngine(t, 'no root index');
    fs.mkdirSync(e.pal);
    assert.equal(e.ensure(), true);
    assert.equal(fs.existsSync(path.join(e.pal, 'worker/index.js')), false);
    for (const platform of PLATFORMS) {
        assert.equal(fs.readFileSync(path.join(e.pal, 'worker', platform, 'index.js'), 'utf8'),
            "export { createWorkerBackend } from '../compat.js';\n");
    }
});

test('a fallback generated with the old root index.js layout is migrated', (t) => {
    const e = makeEngine(t, 'legacy root index');
    const worker = path.join(e.pal, 'worker');
    fs.mkdirSync(worker, { recursive: true });
    fs.copyFileSync(path.resolve(__dirname, '../../scripts/pal-worker-fallback/compat.js'), path.join(worker, 'index.js'));
    for (const platform of PLATFORMS) {
        fs.mkdirSync(path.join(worker, platform));
        fs.writeFileSync(path.join(worker, platform, 'index.js'), "export { createWorkerBackend } from '../index.js';\n");
    }
    assert.equal(e.ensure(), true);
    assert.equal(fs.existsSync(path.join(worker, 'index.js')), false);
    assert.ok(isFallback(e.pal));
    assert.equal(e.ensure(), false);
});

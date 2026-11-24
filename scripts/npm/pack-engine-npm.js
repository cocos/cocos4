'use strict';

const fs = require('node:fs/promises');
const sync = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { parseArgs } = require('node:util');

const { validateEngineNpmInputs } = require('./engine-npm-preflight');

const SOURCE_ROOTS = ['cocos', 'exports', 'pal', 'vendor', 'extensions'];
const RESOURCE_ROOTS = ['editor/engine-features', 'native/external/emscripten', 'external', 'licenses', 'templates/launcher'];
const PREPARED_ROOTS = ['bin/.declarations', 'bin/adapter/minigame', 'bin/adapter/runtime'];
const TARGETS = { 'web-mobile': 'HTML5', 'web-desktop': 'HTML5', wechatgame: 'WECHAT', wechatprogram: 'WECHAT_MINI_PROGRAM',
    'alipay-mini-game': 'ALIPAY', 'bytedance-mini-game': 'BYTEDANCE', 'taobao-mini-game': 'TAOBAO_MINIGAME',
    'taobao-creative-app': 'TAOBAO', 'xiaomi-quick-game': 'XIAOMI' };
const WEB_FEATURES = ['base', 'gfx-webgl', 'gfx-webgl2', '2d', '3d', 'animation', 'skeletal-animation', 'ui', 'rich-text', 'mask', 'graphics', 'tween', 'audio', 'video', 'webview', 'particle', 'particle-2d', 'primitive', 'terrain', 'tiled-map', 'physics-builtin', 'physics-2d-builtin', 'spine-3.8', 'dragon-bones'];
const slash = value => value.split(path.sep).join('/');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const decoratorOptions = new Map();

function modulePaths(filename, sourceRoot) {
    return () => ({ visitor: { StringLiteral(p) {
        const parent = p.parent;
        const moduleSource = (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(parent.type) && p.key === 'source')
            || (parent.type === 'CallExpression' && (parent.callee.type === 'Import' || parent.callee.name === 'require') && p.listKey === 'arguments');
        if (!moduleSource) return;
        let value = p.node.value;
        const alias = value === 'cc.decorator' ? 'cocos/core/data/decorators/index' : value.startsWith('@cocos/engine/') ? value.slice('@cocos/engine/'.length) : undefined;
        if (alias !== undefined) {
            let target = path.join(sourceRoot, alias);
            if (sync.existsSync(target) && sync.statSync(target).isDirectory()) target = path.join(target, 'index');
            value = slash(path.relative(path.dirname(filename), target));
            if (!value.startsWith('.')) value = './' + value;
        }
        if (value.startsWith('.') && /\.ts$/.test(value)) value = value.slice(0, -3) + '.js';
        p.node.value = value;
    } } });
}

/** Preserve virtual constants and platform alternatives; only lower language syntax. */
async function transformModule(source, filename, sourceRoot) {
    const requireBuild = createRequire(require.resolve('@cocos/ccbuild'));
    const core = requireBuild('@babel/core');
    const { babelPresetCC } = requireBuild('@cocos/creator-programming-babel-preset-cc');
    if (!decoratorOptions.has(sourceRoot)) decoratorOptions.set(sourceRoot,
        require('@cocos/ccbuild').StatsQuery.create(sourceRoot).then(query => query.getOptimizeDecorators()));
    const decorators = await decoratorOptions.get(sourceRoot);
    const result = await core.transformAsync(source, {
        filename, sourceFileName: slash(path.relative(sourceRoot, filename)),
        configFile: false, babelrc: false, sourceMaps: true,
        presets: [[babelPresetCC, { allowDeclareFields: true, ...decorators }]],
        plugins: [modulePaths(filename, sourceRoot)],
    });
    return result;
}

function rewriteOverrides(config) {
    const result = structuredClone(config);
    for (const rule of result.moduleOverrides || []) {
        const overrides = {};
        for (const [from, to] of Object.entries(rule.overrides)) {
            const convert = value => value.endsWith('.ts') ? value.slice(0, -3) + '.js' : value;
            overrides[rule.isVirtualModule ? from : convert(from)] = convert(to);
        }
        rule.overrides = overrides;
    }
    if (result.treeShake?.noSideEffectFiles) result.treeShake.noSideEffectFiles = result.treeShake.noSideEffectFiles.map(file => file.replace(/\.ts$/, '.js'));
    return result;
}

function selectWebTemplates(source) {
    const native = new Set(['android', 'ios', 'mac', 'windows', 'linux', 'ohos', 'harmonyos-next', 'native', 'common', 'cmake', 'qnx', 'google-play']);
    return sync.readdirSync(path.join(source, 'templates'), { withFileTypes: true })
        .filter(entry => entry.isDirectory() && !native.has(entry.name) && !entry.name.startsWith('xr-'))
        .map(entry => entry.name);
}

async function copyTree(source, destination) {
    if (!sync.existsSync(source)) return;
    await fs.cp(source, destination, { recursive: true, filter: file => {
        if (sync.lstatSync(file).isSymbolicLink()) throw new Error(`Resource symlink requires an explicit packaging rule: ${file}`);
        return !['.git', 'node_modules', 'library', '__tests__', 'transform-cache', '.incremental.json'].includes(path.basename(file));
    } });
}

async function packEngineNpm({ source, output, buildRuntime = true, onProgress = () => {} }) {
    source = await fs.realpath(source);
    output = path.resolve(output);
    const relative = path.relative(source, output);
    if (relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) throw new Error('Output must be outside engine source');
    if (sync.existsSync(output)) throw new Error(`Output already exists: ${output}`);
    const pkg = await read(path.join(source, 'package.json'));
    const config = await read(path.join(source, 'cc.config.json'));
    validateEngineNpmInputs(source);
    for (const file of ['bin/.declarations/cc.d.ts', 'bin/adapter/minigame']) {
        if (!sync.existsSync(path.join(source, file))) throw new Error(`Prepare engine artifacts before packaging: ${file}`);
    }
    const staging = `${output}.${crypto.randomUUID()}.tmp`;
    await fs.mkdir(staging, { recursive: true });
    const files = [];
    try {
        async function emitTree(relativeRoot) {
            const base = path.join(source, relativeRoot);
            if (!sync.existsSync(base)) return;
            for (const entry of await fs.readdir(base, { withFileTypes: true })) {
                if (entry.isSymbolicLink()) throw new Error(`Source symlink requires an explicit packaging rule: ${relativeRoot}/${entry.name}`);
                if (['node_modules', '__tests__', 'tests', '.git'].includes(entry.name)) continue;
                const rel = slash(path.join(relativeRoot, entry.name));
                if (entry.isDirectory()) { await emitTree(rel); continue; }
                if (/\.d\.ts$|\.(test|spec)\.[tj]s$/.test(entry.name)) continue;
                const input = path.join(source, rel);
                const discoveryEntry = /^(exports|editor\/exports)\/[^/]+\.ts$/.test(rel) || rel === 'cocos/core/platform/macro.ts';
                const destRel = rel.endsWith('.ts') ? rel.slice(0, -3) + (discoveryEntry ? '.impl.js' : '.js') : rel;
                const dest = path.join(staging, destRel);
                await fs.mkdir(path.dirname(dest), { recursive: true });
                if (rel.endsWith('.ts')) {
                    const result = await transformModule(await fs.readFile(input, 'utf8'), input, source);
                    await fs.writeFile(dest, `${result.code}\n//# sourceMappingURL=${path.basename(dest)}.map\n`);
                    await fs.writeFile(dest + '.map', JSON.stringify(result.map));
                } else if (rel.endsWith('.js') && /@cocos\/engine\/|cc\.decorator/.test(await fs.readFile(input, 'utf8'))) {
                    const result = await transformModule(await fs.readFile(input, 'utf8'), input, source);
                    await fs.writeFile(dest, result.code);
                } else await fs.copyFile(input, dest);
                files.push(destRel);
                if (files.length % 250 === 0) onProgress(`Transpiled/copied ${files.length} modules`);
            }
        }
        for (const root of SOURCE_ROOTS) await emitTree(root);
        const predefine = path.join(source, 'predefine.ts');
        const loweredPredefine = await transformModule(await fs.readFile(predefine, 'utf8'), predefine, source);
        await fs.writeFile(path.join(staging, 'predefine.js'), loweredPredefine.code);
        files.push('predefine.js');
        for (const root of [...RESOURCE_ROOTS, ...PREPARED_ROOTS]) await copyTree(path.join(source, root), path.join(staging, root));
        for (const target of selectWebTemplates(source)) await copyTree(path.join(source, 'templates', target), path.join(staging, 'templates', target));
        // ccbuild still discovers editor exports even for a game build. This empty
        // discovery directory is metadata compatibility, not editor implementation.
        await fs.mkdir(path.join(staging, 'editor/exports'), { recursive: true });
        await fs.writeFile(path.join(staging, 'editor/exports/.keep'), '');
        for (const file of ['DebugInfos.json', 'cc.config.schema.json', 'LICENSE', 'AUTHORS.txt']) {
            if (sync.existsSync(path.join(source, file))) await fs.copyFile(path.join(source, file), path.join(staging, file));
        }
        await fs.writeFile(path.join(staging, 'cc.config.json'), JSON.stringify(rewriteOverrides(config), null, 2));
        await fs.writeFile(path.join(staging, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
            target: 'esnext', module: 'esnext', noEmit: true, skipLibCheck: true, types: [], baseUrl: '.',
            paths: { 'cc.decorator': ['cocos/core/data/decorators/index.js'] },
        }, include: ['exports/*.ts', 'editor/exports/*.ts'] }, null, 2));
        // Compatibility discovery entries contain no original implementation. Current
        // ccbuild discovers only .ts exports; actual implementation remains ESM JS.
        const entrypoints = {};
        for (const rel of files.filter(file => /^(exports|editor\/exports)\/[^/]+\.impl\.js$/.test(file))) {
            const stub = rel.slice(0, -8) + '.ts';
            await fs.writeFile(path.join(staging, stub), `// Generated ccbuild discovery entry.\nexport * from './${path.basename(rel)}';\n`);
            entrypoints[stub] = rel;
        }
        // Keep old source-profile detection compatible without publishing macro TS.
        await fs.writeFile(path.join(staging, 'cocos/core/platform/macro.ts'), "// Generated compatibility entry.\nexport * from './macro.impl.js';\n");
        await fs.writeFile(path.join(staging, 'module-entries.json'), JSON.stringify(entrypoints, null, 2));
        await fs.mkdir(path.join(staging, 'types'), { recursive: true });
        await fs.writeFile(path.join(staging, 'types/index.d.ts'), '/// <reference path="../bin/.declarations/cc.d.ts" />\n/// <reference path="../bin/.declarations/cc.editor.d.ts" />\nexport * from "cc";\n');
        if (buildRuntime) {
            onProgress('Building browser ESM runtime');
            await require('@cocos/ccbuild').buildEngine({ engine: source, out: path.join(staging, 'runtime/web'), features: WEB_FEATURES,
                platform: 'HTML5', mode: 'BUILD', moduleFormat: 'esm', compress: false, split: false, sourceMap: true });
            const runtimeFiles = await fs.readdir(path.join(staging, 'runtime/web'));
            const entry = runtimeFiles.includes('cc.js') ? 'cc.js' : runtimeFiles.includes('index.js') ? 'index.js' : undefined;
            if (!entry) throw new Error(`Cannot identify browser ESM entry: ${runtimeFiles.join(', ')}`);
            await fs.writeFile(path.join(staging, 'runtime/web/index.mjs'), `export * from './${entry}';\n`);
            await fs.writeFile(path.join(staging, 'runtime/web/package.json'), '{"type":"module"}\n');
        }
        const hashes = [];
        async function hashTree(dir) {
            for (const entry of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
                const file = path.join(dir, entry.name);
                if (entry.isDirectory()) await hashTree(file);
                else hashes.push([slash(path.relative(staging, file)), crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')]);
            }
        }
        onProgress('Hashing package payload');
        await hashTree(staging);
        const revision = 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(hashes)).digest('hex');
        const manifest = { schemaVersion: 2, kind: 'engine', engineVersion: pkg.version, engineRevision: revision,
            sdkReleaseId: revision, component: 'web', capabilities: ['web', 'minigame', 'modular-js'],
            entries: { inputFormat: 'esm-js', engineRoot: '.', featureConfig: 'cc.config.json', moduleEntries: 'module-entries.json' },
            profiles: { ...(buildRuntime ? { web: { entry: 'runtime/web/index.mjs', format: 'esm', features: WEB_FEATURES } } : {}) },
            platformResolution: 'plugin',
            platformConstants: [...new Set(['HTML5', ...[config.constants.MINIGAME?.value, config.constants.RUNTIME_BASED?.value].flatMap(value => typeof value === 'string' ? [...value.matchAll(/\$([A-Z0-9_]+)/g)].map(match => match[1]) : [])])],
            targets: Object.fromEntries(Object.entries(TARGETS).map(([target, platform]) => [target, { platform }])), files: hashes };
        await fs.writeFile(path.join(staging, 'engine-sdk.json'), JSON.stringify(manifest, null, 2));
        const dependencies = Object.fromEntries(Object.entries(pkg.dependencies || {}).filter(([name]) => ['@cocos/box2d', '@cocos/cannon', '@cocos/dragonbones-js'].includes(name)));
        await fs.writeFile(path.join(staging, 'package.json'), JSON.stringify({ name: '@cocos/engine-web', version: pkg.version,
            license: pkg.license, sideEffects: true, dependencies,
            exports: { '.': { types: './types/index.d.ts', import: './runtime/web/index.mjs' }, './engine-sdk.json': './engine-sdk.json' } }, null, 2));
        await fs.rename(staging, output);
        return { output, modules: files.length, revision };
    } catch (error) {
        await fs.rm(staging, { recursive: true, force: true });
        throw error;
    }
}

const PACK_HELP = `Usage: npm run pack:npm -- --kind web|editor --output NEW_DIRECTORY [options]

  --kind web              Browser runtime and modular JS SDK (default)
  --kind editor           Editor component; requires --base WEB_SDK
  --source ENGINE         Prepared engine source directory (defaults to this engine)
  --output NEW_DIRECTORY  New package directory; never overwrites existing output
  --base WEB_SDK          Matching Web package directory (editor only)
  --help                  Show this help without preparing any files

Native packaging is reserved but not implemented. Its future options are
--kind native --target PLATFORM --arch ARCH --configuration Debug|Release
--library-type static|shared. Packing libraries will be separate from compiling them.

Run npm pack in the generated directory to create an installable .tgz.
`;

function parsePackArguments(args) {
    const { values } = parseArgs({ args, options: {
        kind: { type: 'string', default: 'web' }, source: { type: 'string', default: path.resolve(__dirname, '../..') }, output: { type: 'string' },
        base: { type: 'string' }, help: { type: 'boolean' }, target: { type: 'string' }, arch: { type: 'string' },
        configuration: { type: 'string' }, 'library-type': { type: 'string' },
    } });
    if (values.help) return { help: true };
    if (!['web', 'editor', 'native'].includes(values.kind)) throw new Error(`Unknown package kind: ${values.kind}. Use web or editor.`);
    if (values.kind === 'native') {
        const error = new Error('Native npm packaging is not implemented yet. No files were generated.');
        error.code = 'ENGINE_NPM_NATIVE_NOT_IMPLEMENTED';
        throw error;
    }
    for (const option of ['target', 'arch', 'configuration', 'library-type']) if (values[option] !== undefined) throw new Error(`--${option} is only valid for native packaging`);
    for (const option of ['source', 'output']) if (!values[option]?.trim()) throw new Error(`--${option} is required. Use --help for usage.`);
    if (values.kind === 'editor' && !values.base?.trim()) throw new Error('--base WEB_SDK is required for editor packaging');
    if (values.kind === 'web' && values.base !== undefined) throw new Error('--base is only valid for editor packaging');
    return { kind: values.kind, source: values.source, output: values.output, ...(values.base ? { base: values.base } : {}) };
}

async function runPack(request, handlers = {
    web: packEngineNpm,
    editor: options => require('./pack-engine-editor').packEngineEditor(options),
}) {
    if (request.help) return PACK_HELP;
    const { kind, ...options } = request;
    if (!['web', 'editor'].includes(kind)) throw new Error(`Unsupported package kind: ${kind}`);
    return handlers[kind]({ ...options, onProgress: console.log });
}

module.exports = { selectWebTemplates, packEngineNpm, transformModule, rewriteOverrides, TARGETS, parsePackArguments, runPack, PACK_HELP };
if (require.main === module) {
    Promise.resolve().then(() => runPack(parsePackArguments(process.argv.slice(2))))
        .then(console.log).catch(error => { console.error(error.message); process.exitCode = 1; });
}

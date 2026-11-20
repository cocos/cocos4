'use strict';

const fs = require('node:fs/promises');
const sync = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseArgs } = require('node:util');
const { transformModule } = require('./pack-engine-npm');
const { validateEngineNpmInputs } = require('./engine-npm-preflight');
const { readWebManifest: readManifest } = require('./package-manifest.cjs');

async function packEngineEditor({ source, base, output }) {
    source = await fs.realpath(source);
    base = await fs.realpath(base);
    validateEngineNpmInputs(source, ['editor', 'web']);
    output = path.resolve(output);
    const web = readManifest(base);
    if (web?.schemaVersion !== 2 || web.component !== 'web') throw new Error('A prepared Web SDK is required');
    const pkg = JSON.parse(await fs.readFile(path.join(source, 'package.json'), 'utf8'));
    if (pkg.version !== web.engineVersion) throw new Error('Editor engine version differs from Web SDK');
    for (const input of [source, base]) {
        const relative = path.relative(input, output);
        if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) throw new Error('Editor output must be outside its inputs');
    }
    if (sync.existsSync(output)) throw new Error(`Output already exists: ${output}`);
    for (const profile of ['editor', 'web']) if (!sync.existsSync(path.join(source, 'bin/.cache/dev-cli', profile, 'loader.js'))) throw new Error(`Prepare ${profile} profile before packaging the editor`);
    const staging = output + '.' + crypto.randomUUID() + '.tmp';
    await fs.mkdir(staging, { recursive: true });
    try {
        for (const directory of ['editor/assets', 'editor/i18n', 'editor/settings', 'editor/extends', 'bin/.editor', 'bin/.cache/dev-cli']) {
            const from = path.join(source, directory);
            if (sync.existsSync(from)) await fs.cp(from, path.join(staging, directory), { recursive: true, filter: file => !['transform-cache', '.incremental.json', 'node_modules', '.git'].includes(path.basename(file)) });
        }
        for (const name of ['i18n-utils.js']) if (sync.existsSync(path.join(source, 'editor', name))) await fs.copyFile(path.join(source, 'editor', name), path.join(staging, 'editor', name));
        await fs.mkdir(path.join(staging, 'editor/exports'), { recursive: true });
        for (const entry of await fs.readdir(path.join(source, 'editor/exports'))) {
            if (!entry.endsWith('.ts') || entry.endsWith('.d.ts')) continue;
            const file = path.join(source, 'editor/exports', entry);
            const js = entry.slice(0, -3) + '.impl.js';
            const result = await transformModule(await fs.readFile(file, 'utf8'), file, source);
            await fs.writeFile(path.join(staging, 'editor/exports', js), result.code);
            await fs.writeFile(path.join(staging, 'editor/exports', entry), `export * from './${js}';\n`);
        }
        for (const file of ['LICENSE', 'AUTHORS.txt']) if (sync.existsSync(path.join(source, file))) await fs.copyFile(path.join(source, file), path.join(staging, file));
        const hash = crypto.createHash('sha256');
        async function hashPayload(dir) {
            for (const item of (await fs.readdir(dir, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
                const file = path.join(dir, item.name);
                if (item.isDirectory()) await hashPayload(file);
                else hash.update(path.relative(staging, file).split(path.sep).join('/')).update(await fs.readFile(file));
            }
        }
        await hashPayload(staging);
        const manifest = { schemaVersion: 2, kind: 'engine', engineVersion: web.engineVersion, payloadRevision: 'sha256:' + hash.digest('hex'),
            engineRevision: web.engineRevision, sdkReleaseId: web.sdkReleaseId, component: 'editor', capabilities: ['editor', 'host', 'preview'],
            entries: {}, targets: {}, profiles: { editor: { entry: 'bin/.cache/dev-cli/editor/loader.js' }, preview: { entry: 'bin/.cache/dev-cli/web/loader.js' } } };
        await fs.writeFile(path.join(staging, 'engine-sdk.json'), JSON.stringify(manifest, null, 2));
        await fs.writeFile(path.join(staging, 'package.json'), JSON.stringify({ name: '@cocos/engine-editor', version: pkg.version,
            license: pkg.license, dependencies: { '@cocos/engine-web': pkg.version }, exports: { './engine-sdk.json': './engine-sdk.json' } }, null, 2));
        await fs.rename(staging, output);
        return { output };
    } catch (error) { await fs.rm(staging, { recursive: true, force: true }); throw error; }
}

module.exports = { packEngineEditor };
if (require.main === module) {
    const { values } = parseArgs({ options: { source: { type: 'string', default: path.resolve(__dirname, '../..') }, base: { type: 'string' }, output: { type: 'string' } } });
    if (!values.source || !values.base || !values.output) throw new Error('Usage: node scripts/npm/pack-engine-editor.js --source ENGINE --base WEB_SDK --output NEW_DIRECTORY');
    packEngineEditor(values).then(console.log).catch(error => { console.error(error); process.exitCode = 1; });
}

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { parseArgs } = require('node:util');

function npmCli() {
    const candidates = [process.env.npm_execpath,
        path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
        path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')];
    const cli = candidates.find(file => file && fs.existsSync(file));
    if (!cli) throw new Error('Cannot locate npm CLI; run through npm run pack:npm:artifacts.');
    return cli;
}

function packArtifacts({ packages, output, source = path.resolve(__dirname, '../..') }) {
    if (!Array.isArray(packages) || !packages.length) throw new Error('At least one --package directory is required.');
    output = path.resolve(output);
    if (fs.existsSync(output)) throw new Error('Output already exists: ' + output);
    const inputs = packages.map(directory => {
        const root = fs.realpathSync(directory);
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        const manifest = JSON.parse(fs.readFileSync(path.join(root, 'engine-sdk.json'), 'utf8'));
        if (!pkg.name || !pkg.version || manifest.schemaVersion !== 2 || manifest.kind !== 'engine') throw new Error('Invalid generated SDK package: ' + root);
        for (const key of ['engineVersion', 'engineRevision', 'sdkReleaseId', 'component']) if (typeof manifest[key] !== 'string' || !manifest[key].trim()) throw new Error('Missing SDK identity: ' + key);
        if (pkg.version !== manifest.engineVersion) throw new Error('Package version differs from engineVersion: ' + pkg.name);
        return { root, pkg, manifest };
    });
    const seen = new Set();
    for (const item of inputs) {
        const id = item.pkg.name + '@' + item.pkg.version;
        if (seen.has(id)) throw new Error('Duplicate package: ' + id);
        seen.add(id);
        for (const key of ['engineVersion', 'engineRevision', 'sdkReleaseId']) if (item.manifest[key] !== inputs[0].manifest[key]) throw new Error('Cannot bundle SDK packages with different ' + key);
    }
    for (const item of inputs) {
        const relative = path.relative(item.root, output);
        if (!relative || relative === '.' || !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) throw new Error('Artifact output must be outside package inputs.');
    }
    fs.mkdirSync(path.dirname(output), { recursive: true });
    output = path.join(fs.realpathSync(path.dirname(output)), path.basename(output));
    for (const item of inputs) {
        const relative = path.relative(item.root, output);
        if (!relative || relative === '.' || !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) throw new Error('Artifact output must be outside package inputs.');
    }
    const staging = output + '.' + crypto.randomUUID() + '.tmp';
    fs.mkdirSync(staging);
    try {
        const entries = [];
        for (const { root, pkg, manifest } of inputs) {
            const result = JSON.parse(execFileSync(process.execPath, [npmCli(), 'pack', '--ignore-scripts', '--json', '--pack-destination', staging], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }));
            const name = result[0]?.filename;
            if (!name || path.basename(name) !== name || !name.endsWith('.tgz')) throw new Error('Invalid npm pack output.');
            const payload = fs.readFileSync(path.join(staging, name));
            entries.push({ name: pkg.name, version: pkg.version, component: manifest.component,
                filename: name, bytes: payload.length, sha256: crypto.createHash('sha256').update(payload).digest('hex'),
                integrity: 'sha512-' + crypto.createHash('sha512').update(payload).digest('base64'),
                targets: manifest.targets || {}, profiles: manifest.profiles || {} });
        }
        let commit = null, dirty = null;
        try {
            commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim();
            dirty = !!execFileSync('git', ['status', '--porcelain'], { cwd: source, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim();
        } catch { /* Source archives have SDK identity but no Git checkout. */ }
        const base = inputs[0].manifest;
        const provenance = { schemaVersion: 1, engineVersion: base.engineVersion, engineRevision: base.engineRevision,
            sdkReleaseId: base.sdkReleaseId, source: { commit, dirty }, packages: entries };
        fs.writeFileSync(path.join(staging, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
        fs.writeFileSync(path.join(staging, 'SHA256SUMS'), entries.map(item => item.sha256 + '  ' + item.filename).join('\n') + '\n');
        fs.writeFileSync(path.join(staging, 'README.md'), '# Engine npm packages\n\nExtract the downloaded Actions ZIP, then install the required tarballs:\n\n~~~sh\nnpm install ' + entries.map(item => './' + item.filename).join(' ') + '\n~~~\n\nVerify SHA256SUMS and provenance.json. The ZIP is an Actions download container; npm installs the .tgz files inside it. Full CLI editing/build workflows require a matching Editor component in addition to Web. A component artifact alone does not imply that all companion components are included. Native architecture/ABI validation belongs to the native package generator; this command only bundles already-generated npm packages.\n');
        fs.renameSync(staging, output);
        return provenance;
    } finally { fs.rmSync(staging, { recursive: true, force: true }); }
}
module.exports = { packArtifacts };
if (require.main === module) {
    const { values } = parseArgs({ options: { package: { type: 'string', multiple: true }, output: { type: 'string' }, help: { type: 'boolean' } } });
    if (values.help) console.log('Usage: npm run pack:npm:artifacts -- --package GENERATED_PACKAGE [--package MATCHING_PACKAGE] --output NEW_DIRECTORY');
    else { try { if (!values.output) throw new Error('--output is required.'); console.log(JSON.stringify(packArtifacts({ packages: values.package, output: values.output }), null, 2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
}

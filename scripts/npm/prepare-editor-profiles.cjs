'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { parseArgs } = require('node:util');
const { readWebManifest } = require('./package-manifest.cjs');
const { validateEngineNpmInputs } = require('./engine-npm-preflight');

function evaluateCondition(expression, constants) {
    const tokens = expression.match(/\$[A-Z0-9_]+|\|\||&&|!|[()]|true|false/g) || [];
    if (tokens.join('') !== expression.replace(/\s/g, '')) throw new Error('Invalid feature environment condition: ' + expression);
    let index = 0;
    function atom() {
        const token = tokens[index++];
        if (token === '!') return !atom();
        if (token === '(') { const result = or(); if (tokens[index++] !== ')') throw new Error('Unclosed feature condition'); return result; }
        if (token === 'true' || token === 'false') return token === 'true';
        if (!token?.startsWith('$')) throw new Error('Invalid feature condition');
        return !!constants[token.slice(1)];
    }
    function and() { let result = atom(); while (tokens[index] === '&&') { index++; const next = atom(); result = result && next; } return result; }
    function or() { let result = and(); while (tokens[index] === '||') { index++; const next = and(); result = result || next; } return result; }
    const result = or(); if (index !== tokens.length) throw new Error('Invalid feature condition'); return result;
}

function selectFeatures(available, renderConfig, constants) {
    const rules = {};
    for (const [id, feature] of Object.entries(renderConfig.features || {})) {
        if (feature.options) Object.assign(rules, feature.options); else rules[id] = feature;
    }
    const known = new Set(available);
    function resolve(id, visited = new Set()) {
        if (!known.has(id)) throw new Error('Unknown fallback feature: ' + id);
        if (visited.has(id)) throw new Error('Feature fallback cycle: ' + id);
        const rule = rules[id];
        if (!rule?.envCondition || evaluateCondition(rule.envCondition, constants)) return id;
        return rule.fallback ? resolve(rule.fallback, new Set([...visited, id])) : undefined;
    }
    return [...new Set(available.filter(id => !id.startsWith('spine-') || ['spine-3.8','spine-4.2'].includes(id)).map(id => resolve(id)).filter(Boolean))];
}

async function prepareEditorProfiles({ source = path.resolve(__dirname, '../..'), base }) {
    source = fs.realpathSync(source);
    const web = readWebManifest(base);
    const pkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
    if (pkg.version !== web.engineVersion) throw new Error('Source engine version differs from Web SDK');
    validateEngineNpmInputs(source);
    const adapters = path.join(source, 'bin/adapter/nodejs');
    for (const name of ['web-adapter.js','engine-adapter.js']) if (!fs.existsSync(path.join(adapters,name))) throw new Error('Prepare Node adapter: ' + name);
    const destination = path.join(source, 'bin/.cache/npm-editor');
    const staging = destination + '.' + crypto.randomUUID() + '.tmp';
    fs.mkdirSync(staging, {recursive:true});
    try {
        const profiles = {};
        for (const [name,platform] of [['editor','NODEJS'],['web','HTML5']]) {
            const dir = path.join(staging,name);
            // QuickCompiler resolves virtual override keys against cwd. Keep cwd outside
            // source without changing the calling process or importing any CLI code.
            await new Promise((resolve,reject)=>{
                const child=spawn(process.execPath,[path.join(__dirname,'prepare-profile-worker.cjs'),JSON.stringify({source,dir,name,platform})],{cwd:path.dirname(source),stdio:'inherit',windowsHide:true});
                child.once('error',reject);
                child.once('exit',(code,signal)=>code===0?resolve():reject(new Error('Profile compilation failed: '+name+' ('+code+', '+signal+')')));
            });
            profiles[name]=JSON.parse(fs.readFileSync(path.join(dir,'profile.json'),'utf8'));
        }
        fs.cpSync(adapters,path.join(staging,'adapters'),{recursive:true});
        fs.writeFileSync(path.join(staging,'VERSION'),'4');
        fs.writeFileSync(path.join(staging,'npm-profiles.json'),JSON.stringify({engineVersion:web.engineVersion,engineRevision:web.engineRevision,sdkReleaseId:web.sdkReleaseId,profiles},null,2));
        validateEngineNpmInputs(source,['editor','web'],staging);
        // Only replace the npm publishing cache, never the editor's live dev-cli cache.
        fs.rmSync(destination,{recursive:true,force:true});
        fs.renameSync(staging,destination);
        return {profiles:destination,sdkReleaseId:web.sdkReleaseId};
    } catch (error) {
        const diagnostics = {};
        for (const name of ['editor','web']) {
            const root = path.join(staging,name);
            if (fs.existsSync(path.join(root,'import-map.json'))) {
                const imports = JSON.parse(fs.readFileSync(path.join(root,'import-map.json'),'utf8')).imports;
                const bundle = fs.readFileSync(path.join(root,'bundled/index.js'),'utf8');
                diagnostics[name] = {worker:imports['pal/worker'],workerModules:[...bundle.matchAll(/System\.register\(["']([^"']*pal\/worker[^"']*)["']/g)].map(match=>match[1])};
            }
        }
        console.error('Profile diagnostics:',JSON.stringify(diagnostics));
        throw error;
    } finally { fs.rmSync(staging,{recursive:true,force:true}); }
}
module.exports={prepareEditorProfiles,selectFeatures,evaluateCondition};
if(require.main===module){const {values}=parseArgs({options:{source:{type:'string',default:path.resolve(__dirname,'../..')},base:{type:'string'}}});if(!values.base)throw Error('--base WEB_PACKAGE is required');prepareEditorProfiles(values).then(console.log).catch(error=>{console.error(error);process.exitCode=1;});}

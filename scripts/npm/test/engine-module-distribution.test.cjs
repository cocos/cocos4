const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformModule, rewriteOverrides } = require('../pack-engine-npm');
const engine = path.resolve(__dirname, '../../..');

test('pretranspilation retains deferred platform constants and module boundaries', async () => {
    const result = await transformModule("import { NATIVE } from 'internal:constants'; import { a } from './a.ts'; export const target: string = NATIVE ? a : 'web';", path.join(engine, 'fixture.ts'), engine);
    assert.match(result.code, /internal:constants/);
    assert.match(result.code, /NATIVE \? a : 'web'/);
    assert.match(result.code, /\.\/a\.js/);
    assert.doesNotMatch(result.code, /target: string/);
});

test('class decorators and decorated field initializers survive the language lowering stage', async () => {
    const result = await transformModule(`
        function registered(constructor: any) { constructor.registered = true; }
        function field(target: any, key: string, descriptor: any) { return descriptor; }
        @registered
        export class Example { @field value: number = 42; }
    `, path.join(engine, 'fixture.ts'), engine);
    const { Example } = await import('data:text/javascript;base64,' + Buffer.from(result.code).toString('base64'));
    assert.equal(Example.registered, true);
    assert.equal(new Example().value, 42);
});

test('real Node implementation lowers without losing registration and condition references', async () => {
    const file = path.join(engine, 'cocos/scene-graph/node.ts');
    const result = await transformModule(fs.readFileSync(file, 'utf8'), file, engine);
    assert.match(result.code, /cc\.Node/);
    assert.match(result.code, /internal:constants/);
    assert.match(result.code, /serializable/);
    assert.equal(result.map.sources.length, 1);
    assert.equal(result.map.sources[0].includes('D:'), false);
});

test('config rewriting changes physical module paths without changing virtual names or tests', () => {
    const config = { moduleOverrides: [
        { test: 'context.buildTimeConstants.NATIVE', isVirtualModule: true, overrides: { 'pal/input': 'pal/input/native.ts' } },
        { test: 'flags', isVirtualModule: false, overrides: { 'cocos/a.ts': 'cocos/a.jsb.ts' } },
    ] };
    const result = rewriteOverrides(config);
    assert.deepEqual(result.moduleOverrides[0].overrides, { 'pal/input': 'pal/input/native.js' });
    assert.deepEqual(result.moduleOverrides[1].overrides, { 'cocos/a.js': 'cocos/a.jsb.js' });
    assert.equal(result.moduleOverrides[0].test, config.moduleOverrides[0].test);
    assert.equal(Object.keys(config.moduleOverrides[1].overrides)[0], 'cocos/a.ts');
});

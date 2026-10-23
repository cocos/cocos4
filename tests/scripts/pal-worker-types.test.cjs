// The engine declares the `pal/worker` contract itself (@types/pal/worker.d.ts) so that type checks
// work with any installed PAL. When a real PAL worker module is present, prove that its public
// types are structurally identical to that declaration, so the two cannot drift apart silently.
// PAL_WORKER_TYPES=<path to worker/type.d.ts> checks a local cocos-pal build instead.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const engine = path.resolve(__dirname, '../..');
const realTypes = process.env.PAL_WORKER_TYPES
    ? path.resolve(process.env.PAL_WORKER_TYPES)
    : path.join(engine, 'pal/worker/type.d.ts');

test('@types/pal/worker.d.ts matches the PAL worker contract', { skip: !fs.existsSync(realTypes) && 'no real PAL worker module installed' }, (t) => {
    const ts = require(path.join(engine, 'node_modules/typescript'));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pal worker types '));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const names = ['IWorker', 'IWorkerDiagnosis', 'IWorkerBackend', 'IPlatformWorkerBackend', 'IWorkerResolution', 'IWorkerCapabilities'];
    const real = path.join(dir, 'real.d.ts');
    fs.copyFileSync(realTypes, real);
    const check = path.join(dir, 'check.ts');
    fs.writeFileSync(check, [
        "import type * as Engine from 'pal/worker';",
        "import type * as Pal from './real';",
        'type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;',
        ...names.map((n) => `export const ${n}: Same<Engine.${n}, Pal.${n}> = true;`),
    ].join('\n'));
    const program = ts.createProgram([path.join(engine, '@types/pal/worker.d.ts'), check], {
        strict: true, noEmit: true, types: [], lib: ['lib.es2017.d.ts', 'lib.dom.d.ts'], skipLibCheck: true,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program)
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    assert.deepEqual(diagnostics, []);
});

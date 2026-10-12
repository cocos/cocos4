// Run against the real ccbuild output (features: ['worker'], HTML5, cjs,
// compress: true, DEBUG: false, mangleProperties: true).
// Usage: node tests/scripts/worker-release.test.cjs /absolute/path/to/cc.js
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const bundle = process.argv[2];
if (!bundle) throw new Error('Pass the minified HTML5 worker feature bundle path.');
const source = fs.readFileSync(bundle, 'utf8');

function load() {
    const handles = [];
    class Worker {
        constructor() { this.sent = []; this.stopped = 0; handles.push(this); }
        postMessage(message, transfer) {
            this.sent.push(structuredClone(message, { transfer: transfer || [] }));
        }
        terminate() { this.stopped++; }
        reply(value, ok = true) {
            const { id } = this.sent[this.sent.length - 1];
            this.onmessage({ data: { id, ok, value, error: ok ? undefined : value } });
        }
        fail(message = 'backend failed') { this.onerror({ message }); }
    }
    const context = { exports: {}, console, Worker, navigator: { hardwareConcurrency: 4 },
        setTimeout, clearTimeout, ArrayBuffer, SharedArrayBuffer, Uint8Array };
    context.global = context;
    vm.runInNewContext(source, context, { filename: bundle });
    return { cc: context.exports, handles };
}

// Host workers are controlled substitutes; scheduler and PAL are the compiled code.
test('release API, queue reuse and message protocol survive property mangling', async () => {
    const { cc, handles } = load();
    assert.equal(cc.getWorkerCapabilities().supportsTransfer, true);
    assert.equal(cc.getOptimalWorkerCount(), 3);
    const pool = new cc.WorkerPool('workers/task.js', { maxWorkers: 1, idleReleaseAfter: 0 });
    try {
        assert.equal(pool.backend, 'worker');
        assert.equal(pool.concurrency, 1);
        const first = pool.run([3]);
        const second = pool.run([4]);
        assert.deepEqual(handles[0].sent[0], { id: 1, args: [3] });
        handles[0].reply(6);
        assert.equal(await first, 6);
        handles[0].reply(8);
        assert.equal(await second, 8);
        assert.equal(handles.length, 1);
    } finally { pool.terminate(); }
    assert.equal(handles[0].stopped, 1);
    await assert.rejects(pool.run(), /16502/);
});

test('concurrent failures retain safe fallback and reject transferred ownership', async () => {
    const { cc, handles } = load();
    const calls = [];
    const pool = new cc.WorkerPool('workers/task.js', { maxWorkers: 3, idleReleaseAfter: 0,
        fallback: n => { calls.push(n); return n * 2; } });
    try {
        const first = pool.run([3]);
        const second = pool.run([4]);
        const bytes = new Uint8Array([5]);
        const transferred = assert.rejects(pool.run([bytes], [bytes.buffer]), /backend failed/);
        assert.equal(bytes.byteLength, 0);
        handles[0].fail(); handles[1].fail(); handles[2].fail();
        assert.equal(await first, 6); assert.equal(await second, 8); await transferred;
        assert.deepEqual(calls.sort((a, b) => a - b), [3, 4]);
        assert.equal(pool.backend, 'sync');
        assert.equal(await pool.run([6]), 12);
    } finally { pool.terminate(); }
});

test('old worker errors after recheck cannot degrade the new backend', async () => {
    const { cc, handles } = load();
    const pool = new cc.WorkerPool('workers/task.js', { idleReleaseAfter: 0, fallback: n => n * 2 });
    try {
        const stale = assert.rejects(pool.run([3]), /stale/);
        assert.equal(pool.recheck(), 'worker');
        const fresh = pool.run([4]);
        handles[0].fail('stale'); await stale;
        assert.equal(pool.backend, 'worker');
        handles[1].reply(8); assert.equal(await fresh, 8);
    } finally { pool.terminate(); }
});

test('task errors reject without retry and the executor remains reusable', async () => {
    const { cc, handles } = load();
    const pool = new cc.WorkerPool('workers/task.js', { idleReleaseAfter: 0,
        fallback: () => { throw new Error('must not replay task errors'); } });
    try {
        const failed = assert.rejects(pool.run(), /computation failed/);
        handles[0].reply('computation failed', false); await failed;
        const next = pool.run(); handles[0].reply(7); assert.equal(await next, 7);
        assert.equal(handles.length, 1);
    } finally { pool.terminate(); }
});

test('malformed replies and timeouts retain distinct release diagnostic IDs', async () => {
    const { cc, handles } = load();
    const pool = new cc.WorkerPool('workers/task.js', { timeout: 20, idleReleaseAfter: 0 });
    try {
        const malformed = assert.rejects(pool.run(), /16513/);
        handles[0].onmessage({ data: {} }); await malformed;
        await assert.rejects(pool.run(), /16511/);
        assert.equal(handles[0].stopped, 1);
        assert.equal(handles[1].stopped, 1);
    } finally { pool.terminate(); }
});

test('function fallback and input validation remain available in release builds', async () => {
    const { cc } = load();
    assert.throws(() => new cc.WorkerPool(''), /16500/);
    assert.throws(() => new cc.WorkerPool(null), /16501/);
    assert.throws(() => cc.createWorker(''), /16515/);
    const pool = new cc.WorkerPool(n => n * 2, { idleReleaseAfter: 0 });
    try {
        assert.equal(pool.backend, 'sync');
        assert.equal(await pool.run([3]), 6);
    } finally { pool.terminate(); }
});

jest.mock('pal/worker', () => ({ createWorkerBackend: jest.fn() }));

import { createWorkerBackend } from 'pal/worker';
import { WorkerPool } from '../../cocos/misc/worker-pool';
import { resetWorkerBackendCache } from '../../cocos/misc/worker';

test('function workers use PAL concurrency without reading any host identity', async () => {
    let reply: (value: any) => void;
    const backend = {
        get kind() { throw new Error('host identity must not be read'); },
        hardwareConcurrency: 8,
        concurrencyLimit: 2,
        supportsFunctionWorker: true,
        scriptFailureHint: '',
        createFunctionWorker: jest.fn((fn: (...args: any[]) => any) => ({
            postMessage: (msg: any) => { Promise.resolve().then(() => reply({ id: msg.id, ok: true, value: fn(...msg.args) })); },
            onMessage: (listener: (value: any) => void) => { reply = listener; },
            onError: jest.fn(),
            terminate: jest.fn(),
        })),
    };
    (createWorkerBackend as jest.Mock).mockReturnValue(backend);
    resetWorkerBackendCache();
    const pool = new WorkerPool((n: number) => n + 1, { maxWorkers: 4 });
    try {
        expect(pool.backend).toBe('worker');
        expect(pool.concurrency).toBe(2);
        await expect(pool.run([41])).resolves.toBe(42);
    } finally {
        pool.terminate();
        resetWorkerBackendCache();
    }
});

test('pool schedules the exact PAL-selected backend without reading any host identity', async () => {
    let reply: (value: any) => void;
    const selected = {
        get kind() { throw new Error('host identity must not be read'); },
        concurrencyLimit: 2,
        scriptFailureHint: '',
        createScriptWorker: jest.fn(() => ({
            postMessage: (msg: any) => { Promise.resolve().then(() => reply({ id: msg.id, ok: true, value: msg.args[0] * 2 })); },
            onMessage: (fn: (value: any) => void) => { reply = fn; },
            onError: jest.fn(),
            terminate: jest.fn(),
        })),
    };
    const root = {
        get kind() { throw new Error('host identity must not be read'); },
        hardwareConcurrency: 8,
        concurrencyLimit: 1,
        scriptFailureHint: '',
        createScriptWorker: jest.fn(() => { throw new Error('must use PAL-selected backend'); }),
        resolveScriptWorker: jest.fn(() => ({
            backend: selected,
            diagnosis: { ready: true, version: 1, reason: '' },
            warnOnFailure: false,
        })),
    };
    (createWorkerBackend as jest.Mock).mockReturnValue(root);
    resetWorkerBackendCache();
    const pool = new WorkerPool('task.js', { maxWorkers: 4 });
    try {
        expect(pool.backend).toBe('worker');
        expect(pool.concurrency).toBe(2);
        await expect(pool.run([21])).resolves.toBe(42);
        expect(selected.createScriptWorker).toHaveBeenCalledWith('task.js');
        expect(root.createScriptWorker).not.toHaveBeenCalled();
        expect(pool.recheck()).toBe('worker');
    } finally {
        pool.terminate();
        resetWorkerBackendCache();
    }
});

function controlledBackend() {
    const handles: any[] = [];
    const backend = {
        hardwareConcurrency: 4, concurrencyLimit: 2, supportsFunctionWorker: true,
        supportsTransfer: true, scriptFailureHint: '',
        resolveScriptWorker: () => ({ backend, diagnosis: { ready: true, version: 1, reason: '' }, warnOnFailure: false }),
        createScriptWorker: jest.fn(() => {
            const handle: any = {
                postMessage: jest.fn(), terminate: jest.fn(),
                onMessage: (fn: any) => { handle.reply = fn; },
                onError: (fn: any) => { handle.fail = fn; },
            };
            handles.push(handle);
            return handle;
        }),
        createFunctionWorker: jest.fn(() => backend.createScriptWorker()),
    };
    return { backend, handles };
}

const unavailable = {
    hardwareConcurrency: 1, concurrencyLimit: 0, supportsFunctionWorker: false, scriptFailureHint: '',
    resolveScriptWorker: () => ({ backend: null, diagnosis: { ready: false, version: 0, reason: 'unavailable' }, warnOnFailure: false }),
};

afterEach(() => resetWorkerBackendCache());

test('a different pool refreshing the PAL cache does not change function backend selection', async () => {
    const { backend, handles } = controlledBackend();
    (createWorkerBackend as jest.Mock).mockReturnValue(backend);
    resetWorkerBackendCache();
    const pool = new WorkerPool((n: number) => n + 1);
    (createWorkerBackend as jest.Mock).mockReturnValue(unavailable);
    resetWorkerBackendCache();
    const inline = new WorkerPool((n: number) => n + 2);
    const result = pool.run([1]);
    expect(handles).toHaveLength(1);
    handles[0].reply({ id: 1, ok: true, value: 2 });
    await expect(result).resolves.toBe(2);
    await expect(inline.run([1])).resolves.toBe(3);
    pool.terminate(); inline.terminate();
});

test.each([true, false])('recheck retires busy workers and settles queued tasks (fallback=%s)', async (fallback) => {
    const { backend, handles } = controlledBackend();
    (createWorkerBackend as jest.Mock).mockReturnValue(backend);
    resetWorkerBackendCache();
    const pool = new WorkerPool('task.js', { maxWorkers: 1, idleReleaseAfter: 0, fallback: fallback ? (n: number) => n * 3 : undefined });
    const running = pool.run([2]);
    const queued = pool.run([3]);
    const checkQueued = fallback ? expect(queued).resolves.toBe(9) : expect(queued).rejects.toThrow(/unavailable/);
    (createWorkerBackend as jest.Mock).mockReturnValue(unavailable);
    expect(pool.recheck()).toBe(fallback ? 'sync' : 'none');
    expect(handles[0].terminate).not.toHaveBeenCalled();
    handles[0].reply({ id: 1, ok: true, value: 4 });
    await expect(running).resolves.toBe(4);
    await checkQueued;
    expect(handles[0].terminate).toHaveBeenCalledTimes(1);
    expect(handles[0].postMessage).toHaveBeenCalledTimes(1);
    pool.terminate();
});

test('late errors from a retired worker do not degrade the newly checked backend', async () => {
    const old = controlledBackend(); const fresh = controlledBackend();
    (createWorkerBackend as jest.Mock).mockReturnValue(old.backend);
    resetWorkerBackendCache();
    const pool = new WorkerPool('task.js', { maxWorkers: 1, fallback: () => -1 });
    const failed = expect(pool.run()).rejects.toThrow('old error');
    (createWorkerBackend as jest.Mock).mockReturnValue(fresh.backend);
    pool.recheck();
    old.handles[0].fail(new Error('old error'));
    await failed;
    expect(pool.backend).toBe('worker');
    const next = pool.run();
    fresh.handles[0].reply({ id: 2, ok: true, value: 42 });
    await expect(next).resolves.toBe(42);
    pool.terminate();
});

test('synchronous postMessage exceptions evict the worker and drain through fallback', async () => {
    const { backend } = controlledBackend();
    const make = backend.createScriptWorker.getMockImplementation()!;
    backend.createScriptWorker.mockImplementation(() => {
        const handle = make();
        handle.postMessage.mockImplementation(() => { throw new Error('send failed'); });
        return handle;
    });
    (createWorkerBackend as jest.Mock).mockReturnValue(backend);
    resetWorkerBackendCache();
    const pool = new WorkerPool('task.js', { fallback: (n: number) => n * 3 });
    await expect(pool.run([2])).resolves.toBe(6);
    await expect(pool.run([3])).resolves.toBe(9);
    expect(pool.backend).toBe('sync');
    pool.terminate();
});

test('transferred arguments are never replayed after worker failure', async () => {
    const { backend, handles } = controlledBackend();
    const fallback = jest.fn((arg: Uint8Array) => arg[0]);
    (createWorkerBackend as jest.Mock).mockReturnValue(backend);
    resetWorkerBackendCache();
    const pool = new WorkerPool('task.js', { fallback });
    const bytes = new Uint8Array([42]);
    const result = pool.run([bytes], [bytes.buffer]);
    // Node MessageChannel performs a real ownership transfer, unlike a mock postMessage.
    const { port1, port2 } = new (require('worker_threads').MessageChannel)();
    port1.postMessage(bytes, [bytes.buffer]);
    port1.close(); port2.close();
    expect(bytes.byteLength).toBe(0);
    handles[0].fail(new Error('worker died'));
    await expect(result).rejects.toThrow('worker died');
    expect(fallback).not.toHaveBeenCalled();
    expect(pool.backend).toBe('sync');
    await expect(pool.run([new Uint8Array([7])])).resolves.toBe(7);
    pool.terminate();
});


test('a large queued batch drains iteratively after synchronous fallback', async () => {
    const { backend, handles } = controlledBackend();
    (createWorkerBackend as jest.Mock).mockReturnValue(backend);
    resetWorkerBackendCache();
    const pool = new WorkerPool('task.js', { maxWorkers: 1, fallback: (n: number) => n + 1 });
    const results = Array.from({ length: 10000 }, (_, n) => pool.run([n]));
    handles[0].fail(new Error('worker died'));
    const values = await Promise.all(results);
    expect(values[0]).toBe(1);
    expect(values[9999]).toBe(10000);
    pool.terminate();
});

jest.mock('pal/worker', () => ({ createWorkerBackend: jest.fn() }));

import { createWorkerBackend } from 'pal/worker';
import { WorkerPool } from '../../cocos/misc/worker-pool';
import { resetWorkerBackendCache } from '../../cocos/misc/worker';

function controlledBackend(limit = 3) {
    const handles: any[] = [];
    const backend = {
        hardwareConcurrency: 4, concurrencyLimit: limit, supportsTransfer: true,
        supportsFunctionWorker: false, scriptFailureHint: '',
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
    };
    (createWorkerBackend as jest.Mock).mockReturnValue(backend);
    return { backend, handles };
}

const pools: WorkerPool[] = [];
function pool(options: ConstructorParameters<typeof WorkerPool>[1] = {}) {
    const value = new WorkerPool('workers/task.js', { maxWorkers: 3, idleReleaseAfter: 0, ...options });
    pools.push(value);
    return value;
}
function reply(handle: any, value: number) {
    handle.reply({ id: handle.postMessage.mock.calls[0][0].id, ok: true, value });
}
beforeEach(() => resetWorkerBackendCache());
afterEach(() => {
    for (const value of pools.splice(0)) value.terminate();
    jest.useRealTimers();
    resetWorkerBackendCache();
});

test.each([[0, 1], [1, 0], [2, 0, 1]])('consecutive worker failures recover every task (order %j)', async (...order) => {
    const { handles } = controlledBackend();
    const fallback = jest.fn((n: number) => n * 2);
    const value = pool({ fallback, maxWorkers: order.length });
    const fulfilled = order.map(() => jest.fn());
    const rejected = order.map(() => jest.fn());
    const results = order.map((_, i) => value.run([i + 3]).then(fulfilled[i], rejected[i]));
    const queued = value.run([9]);
    for (const i of order) handles[i].fail(new Error('backend failed'));
    await Promise.all(results);
    await expect(queued).resolves.toBe(18);
    expect(value.backend).toBe('sync');
    for (let i = 0; i < order.length; ++i) {
        expect(fulfilled[i]).toHaveBeenCalledTimes(1);
        expect(fulfilled[i]).toHaveBeenCalledWith((i + 3) * 2);
        expect(rejected[i]).not.toHaveBeenCalled();
        expect(fallback.mock.calls.filter(([n]) => n === i + 3)).toHaveLength(1);
        expect(handles[i].terminate).toHaveBeenCalledTimes(1);
        // Late duplicate events must not replay an already recovered task.
        handles[i].fail(new Error('duplicate error'));
        reply(handles[i], -1);
    }
    await expect(value.run([10])).resolves.toBe(20);
    expect(fallback).toHaveBeenCalledTimes(order.length + 2);
});

test.each([true, false])('one successful task and one failed task (failure first=%s)', async (failureFirst) => {
    const { handles } = controlledBackend();
    const fallback = jest.fn((n: number) => n * 2);
    const value = pool({ fallback });
    const results = Promise.all([value.run([3]), value.run([4])]);
    if (failureFirst) {
        handles[0].fail(new Error('backend failed'));
        reply(handles[1], 104);
    } else {
        reply(handles[1], 104);
        handles[0].fail(new Error('backend failed'));
    }
    await expect(results).resolves.toEqual([6, 104]);
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledWith(3);
});

test.each([1, 3])('%i silent workers recover through fallback after timeout', async (count) => {
    jest.useFakeTimers();
    controlledBackend();
    const fallback = jest.fn((n: number) => n * 2);
    const value = pool({ fallback, timeout: 20 });
    const results = Promise.all(Array.from({ length: count }, (_, i) => value.run([i + 3])));
    jest.advanceTimersByTime(20);
    await expect(results).resolves.toEqual(Array.from({ length: count }, (_, i) => (i + 3) * 2));
    expect(fallback).toHaveBeenCalledTimes(count);
    jest.advanceTimersByTime(100);
    expect(fallback).toHaveBeenCalledTimes(count);
});

test('a transferred task still rejects when another worker already caused degradation', async () => {
    const { handles } = controlledBackend();
    const fallback = jest.fn((n: number) => n * 2);
    const value = pool({ fallback });
    const first = value.run([3]);
    const bytes = new Uint8Array([4]);
    const second = expect(value.run([bytes], [bytes.buffer])).rejects.toThrow('transferred worker failed');
    const { port1, port2 } = new (require('worker_threads').MessageChannel)();
    try {
        port1.postMessage(bytes, [bytes.buffer]);
        expect(bytes.byteLength).toBe(0);
    } finally {
        port1.close(); port2.close();
    }
    handles[0].fail(new Error('backend failed'));
    handles[1].fail(new Error('transferred worker failed'));
    await expect(first).resolves.toBe(6);
    await second;
    expect(fallback).toHaveBeenCalledTimes(1);
    await expect(value.run([5])).resolves.toBe(10);
});

test.each([false, true])('pre-recheck faults cannot degrade a new backend (already degraded=%s)', async (degraded) => {
    const old = controlledBackend();
    const fallback = jest.fn((n: number) => n * 2);
    const value = pool({ fallback });
    const first = degraded ? value.run([3]) : null;
    const stale = expect(value.run([4])).rejects.toThrow('old backend failed');
    if (degraded) old.handles[0].fail(new Error('initial failure'));
    const fresh = controlledBackend();
    expect(value.recheck()).toBe('worker');
    old.handles[degraded ? 1 : 0].fail(new Error('old backend failed'));
    await stale;
    expect(value.backend).toBe('worker');
    expect(fallback).not.toHaveBeenCalled();
    if (first) {
        reply(fresh.handles[0], 6);
        await expect(first).resolves.toBe(6);
    }
    const next = value.run([5]);
    const handle = fresh.handles.find((worker) => worker.postMessage.mock.calls.some(([message]: any[]) => message.args[0] === 5));
    const message = handle.postMessage.mock.calls.find(([m]: any[]) => m.args[0] === 5)[0];
    handle.reply({ id: message.id, ok: true, value: 10 });
    await expect(next).resolves.toBe(10);
    expect(value.backend).toBe('worker');
    expect(fallback).not.toHaveBeenCalled();
});

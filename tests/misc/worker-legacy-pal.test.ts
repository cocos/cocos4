// Exercise WorkerPool with the same backend installed for pre-worker PAL packages.
jest.mock('pal/worker', () => require('../../scripts/pal-worker-fallback/compat.js'));

import { WorkerPool } from '../../cocos/misc/worker-pool';
import { getWorkerCapabilities } from '../../cocos/misc/worker';
import { checkWorkerScript, createWorker } from '../../cocos/misc/worker';

describe('PAL package without a worker module', () => {
    let savedWorker: PropertyDescriptor | undefined;
    const constructor = jest.fn(() => { throw new Error('must not start a Worker'); });

    beforeEach(() => {
        savedWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
        Object.defineProperty(globalThis, 'Worker', { configurable: true, value: constructor });
        constructor.mockClear();
    });

    afterEach(() => {
        expect(constructor).not.toHaveBeenCalled();
        if (savedWorker) Object.defineProperty(globalThis, 'Worker', savedWorker);
        else delete (globalThis as any).Worker;
    });

    test('reports the missing PAL capability even when a global Worker exists', () => {
        expect(getWorkerCapabilities()).toMatchObject({
            available: false, parallel: false, concurrencyLimit: 0,
            supportsTransfer: false, supportsSharedArrayBuffer: false, supportsFunctionWorker: false,
        });
        expect(checkWorkerScript('workers/task.js')).toMatchObject({ ready: false, version: 0 });
        expect(getWorkerCapabilities().reason).toContain('PAL package has no worker module');
        expect(getWorkerCapabilities()).not.toHaveProperty('kind');
        expect(getWorkerCapabilities().supportsStandardWorker).toBe(false);
    });

    test('function tasks run inline, including after rechecking capabilities', async () => {
        const pool = new WorkerPool((n: number) => n * 2, { maxWorkers: 4 });
        try {
            expect(pool.backend).toBe('sync');
            expect(pool.concurrency).toBe(1);
            await expect(pool.run([21])).resolves.toBe(42);
            expect(pool.recheck()).toBe('sync');
            await expect(pool.run([3])).resolves.toBe(6);
        } finally {
            pool.terminate();
        }
    });

    test('script tasks use their supplied fallback', async () => {
        const pool = new WorkerPool('workers/task.js', { fallback: (a: number, b: number) => a + b });
        try {
            expect(pool.backend).toBe('sync');
            await expect(pool.run([20, 22])).resolves.toBe(42);
        } finally {
            pool.terminate();
        }
    });

    test('script tasks without fallback fail explicitly, as does direct worker creation', async () => {
        const pool = new WorkerPool('workers/task.js');
        try {
            await expect(pool.run([])).rejects.toThrow('PAL package has no worker module');
            expect(() => createWorker('workers/task.js')).toThrow('PAL package has no worker module');
        } finally {
            pool.terminate();
        }
    });
});

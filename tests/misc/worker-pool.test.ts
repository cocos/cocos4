/**
 * WorkerPool / worker tests for an environment WITHOUT any worker backend:
 * jsdom has no global `Worker`, `WECHAT` is false and there is no `wx` — so script mode can only
 * resolve to the `'sync'` backend (with options.fallback) or `'none'` (without), and function mode
 * must run inline on the main thread.
 *
 * The Web-Worker backend is covered by `worker-web.test.ts`, the WeChat backends by
 * `worker-wechat.test.ts` (each test file gets its own jsdom environment + module registry, so the
 * module-level caches in worker.ts cannot leak between them).
 */
import { WorkerPool } from '../../cocos/misc/worker-pool';
import { checkWorkerScript, getWorkerConcurrencyLimit } from '../../cocos/misc/worker';

describe('Worker capability detection without any backend', () => {
    test('checkWorkerScript reports not-ready when the platform has no worker', () => {
        const status = checkWorkerScript('workers/demo.js');
        expect(status.ready).toBe(false);
        expect(status.version).toBe(0);
        expect(status.reason).toMatch(/no worker backend on this platform/);
    });

    test('getWorkerConcurrencyLimit is 0 when no Worker exists', () => {
        expect(getWorkerConcurrencyLimit()).toBe(0);
    });
});

describe('WorkerPool script mode without any worker backend', () => {
    test('rejects with a precise reason when no fallback was provided', async () => {
        const pool = new WorkerPool('workers/demo.js');
        await expect(pool.run([1])).rejects.toThrow(/No worker backend for/);
        // The reason must explain BOTH missing backends so the developer knows what to fix.
        await expect(pool.run([1])).rejects.toThrow(/no worker backend on this platform/);
        await expect(pool.run([1])).rejects.toThrow(/no createWorker and no global Worker/);
        pool.terminate();
    });

    test('runs single-threaded via options.fallback and resolves', async () => {
        const fallback = jest.fn((a: number, b: number) => a + b);
        const pool = new WorkerPool('workers/demo.js', { fallback });
        await expect(pool.run([1, 2])).resolves.toBe(3);
        await expect(pool.run([10, 20])).resolves.toBe(30);
        expect(fallback).toHaveBeenCalledTimes(2);
        expect(fallback).toHaveBeenLastCalledWith(10, 20);
        pool.terminate();
    });

    test('a throwing fallback rejects the task but keeps the pool usable', async () => {
        let shouldThrow = true;
        const pool = new WorkerPool('workers/demo.js', {
            fallback: (v: number) => {
                if (shouldThrow) { throw new Error('fallback boom'); }
                return v;
            },
        });
        await expect(pool.run([1])).rejects.toThrow('fallback boom');
        shouldThrow = false;
        await expect(pool.run([7])).resolves.toBe(7);
        pool.terminate();
    });

    test('a non-function fallback is ignored (backend stays none)', async () => {
        const pool = new WorkerPool('workers/demo.js', { fallback: 42 as any });
        await expect(pool.run([1])).rejects.toThrow(/No worker backend for/);
        pool.terminate();
    });
});

describe('WorkerPool function mode without worker support', () => {
    test('runs the task inline synchronously', async () => {
        const pool = new WorkerPool((a: number) => a * 2);
        await expect(pool.run([21])).resolves.toBe(42);
        pool.terminate();
    });

    test('an inline task that throws rejects', async () => {
        const pool = new WorkerPool(() => {
            throw new Error('inline boom');
        });
        await expect(pool.run([])).rejects.toThrow('inline boom');
        pool.terminate();
    });
});

describe('WorkerPool argument and lifecycle boundaries', () => {
    test('constructor rejects invalid first arguments', () => {
        expect(() => new WorkerPool('')).toThrow(TypeError);
        expect(() => new WorkerPool(123 as any)).toThrow(TypeError);
        expect(() => new WorkerPool(null as any)).toThrow(TypeError);
        expect(() => new WorkerPool(undefined as any)).toThrow(TypeError);
        expect(() => new WorkerPool({} as any)).toThrow(TypeError);
    });

    test('run after terminate rejects and terminate is idempotent', async () => {
        const pool = new WorkerPool('workers/demo.js', { fallback: () => 1 });
        pool.terminate();
        await expect(pool.run([])).rejects.toThrow(/terminated/);
        expect(() => pool.terminate()).not.toThrow();
    });
});

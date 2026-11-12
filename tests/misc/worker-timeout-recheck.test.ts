/**
 * Tests for the two stage-2 capabilities that close the "worker goes silent" and "probed too early"
 * holes:
 *
 * 1. `options.timeout` — a watchdog per dispatched task. A worker that accepts a message and never
 *    replies (deadlock, infinite loop, a platform that drops the message) used to leave the task
 *    pending FOREVER and, worse, left that worker parked in the pool with `busy === true`, silently
 *    shrinking the pool by one on every occurrence. The watchdog must both fail the task AND evict
 *    the worker, so the next task lands on a fresh one.
 *
 * 2. `pool.recheck()` — backend resolution used to happen once at construction and could never be
 *    revisited. That is wrong whenever capability appears LATER: a worker script inside a WeChat
 *    subpackage that finishes downloading after the pool was built, or `wx.env.isSupportStandardWorker`
 *    flipping as the V2 grey release rolls out. Without recheck the pool stays locked to 'sync'/'none'
 *    for its whole lifetime.
 *
 * jsdom has no `Worker`, so we stub the global. `replyMode = 'silent'` reproduces the hang.
 */
import { WorkerPool } from '../../cocos/misc/worker-pool';
import { getWorkerBackend, resetWorkerBackendCache } from '../../cocos/misc/worker';

type ReplyMode = 'ok' | 'silent';

class FakeWebWorker {
    public static instances: FakeWebWorker[] = [];
    public static replyMode: ReplyMode = 'ok';

    public readonly url: string;
    public posted: any[] = [];
    public terminated = false;
    public onmessage: ((e: { data: any }) => void) | null = null;
    public onerror: ((e: any) => void) | null = null;

    constructor (url: string) {
        this.url = url;
        FakeWebWorker.instances.push(this);
    }

    public postMessage (msg: any): void {
        this.posted.push(msg);
        if (FakeWebWorker.replyMode === 'silent') {
            // The hang: message accepted, no reply ever. This is what the watchdog exists for.
            return;
        }
        Promise.resolve().then(() => {
            if (this.onmessage) { this.onmessage({ data: { id: msg.id, ok: true, value: msg.args[0] * 2 } }); }
        });
    }

    public terminate (): void {
        this.terminated = true;
    }
}

/** Install / remove the global `Worker` so a pool can be built before capability exists. */
function installWorker (): void {
    (globalThis as any).Worker = FakeWebWorker;
}
function removeWorker (): void {
    delete (globalThis as any).Worker;
}

beforeEach(() => {
    installWorker();
    FakeWebWorker.instances.length = 0;
    FakeWebWorker.replyMode = 'ok';
    resetWorkerBackendCache();
});

afterEach(() => {
    removeWorker();
    resetWorkerBackendCache();
});

describe('options.timeout — watchdog on an unresponsive worker', () => {
    test('a silent worker fails the task instead of hanging forever', async () => {
        FakeWebWorker.replyMode = 'silent';
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1, timeout: 30 });

        await expect(pool.run([1])).rejects.toThrow(/timed out after 30ms/);
        pool.terminate();
    });

    test('the timed-out worker is EVICTED, not left busy in the pool', async () => {
        FakeWebWorker.replyMode = 'silent';
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1, timeout: 30 });

        await expect(pool.run([1])).rejects.toThrow(/timed out/);
        const dead = FakeWebWorker.instances[0];
        expect(dead.terminated).toBe(true);

        // The decisive part: the pool must not reuse the corpse. Recover the worker and confirm the
        // NEXT task lands on a fresh instance rather than being swallowed by the dead one.
        FakeWebWorker.replyMode = 'ok';
        await expect(pool.run([5])).resolves.toBe(10);
        expect(FakeWebWorker.instances.length).toBe(2);
        pool.terminate();
    });

    test('the error message is actionable (names the protocol and the docs)', async () => {
        FakeWebWorker.replyMode = 'silent';
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1, timeout: 30 });
        await expect(pool.run([1])).rejects.toThrow(/engine protocol|README/);
        pool.terminate();
    });

    test('a slow-but-successful worker is NOT timed out when the reply arrives in time', async () => {
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1, timeout: 500 });
        await expect(pool.run([7])).resolves.toBe(14);
        // No eviction on success: the same worker must serve the next task.
        await expect(pool.run([8])).resolves.toBe(16);
        expect(FakeWebWorker.instances.length).toBe(1);
        pool.terminate();
    });

    test('the watchdog is cleared after each task (no timer leak across many tasks)', async () => {
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1, timeout: 5000 });
        for (let i = 0; i < 50; i++) {
            // eslint-disable-next-line no-await-in-loop
            await expect(pool.run([i])).resolves.toBe(i * 2);
        }
        // A leaked timer per task would still be pending; nothing should fire after terminate().
        pool.terminate();
        // If a stale timer were still armed it would fire against a disposed worker and could reject
        // an unrelated task. Give any such timer a chance to surface as an unhandled rejection.
        await new Promise((r) => setTimeout(r, 30));
        expect(FakeWebWorker.instances.length).toBe(1);
    });

    test('timeout defaults to OFF, preserving the previous behaviour', async () => {
        FakeWebWorker.replyMode = 'silent';
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1 });
        const outcome = await Promise.race([
            pool.run([1]).then(() => 'RESOLVED').catch(() => 'REJECTED'),
            new Promise<string>((r) => setTimeout(() => r('STILL_PENDING'), 80)),
        ]);
        expect(outcome).toBe('STILL_PENDING');
        pool.terminate();
    });

    test('an invalid timeout (0 / negative / NaN) is treated as OFF', async () => {
        FakeWebWorker.replyMode = 'silent';
        for (const bad of [0, -1, Number.NaN]) {
            // eslint-disable-next-line no-await-in-loop
            const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1, timeout: bad });
            // eslint-disable-next-line no-await-in-loop
            const outcome = await Promise.race([
                pool.run([1]).then(() => 'RESOLVED').catch(() => 'REJECTED'),
                new Promise<string>((r) => setTimeout(() => r('STILL_PENDING'), 40)),
            ]);
            expect(outcome).toBe('STILL_PENDING');
            pool.terminate();
        }
    });
});

describe('pool.recheck() — upgrading a backend that was probed too early', () => {
    test('a pool built with no Worker at all resolves to sync/none, then upgrades to web', async () => {
        removeWorker();
        resetWorkerBackendCache();
        // Built before capability existed. With a fallback it degrades to 'sync'; without one 'none'.
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 4, fallback: (n: number) => n * 3 });
        expect(pool.backend).toBe('sync');
        await expect(pool.run([2])).resolves.toBe(6); // computed inline on the main thread

        // Capability appears (e.g. the subpackage finished downloading).
        installWorker();
        expect(pool.recheck()).toBe('worker');
        expect(pool.backend).toBe('worker');
        // Now it really goes through a worker: the fallback would have returned 6, the worker returns 4.
        await expect(pool.run([2])).resolves.toBe(4);
        expect(FakeWebWorker.instances.length).toBe(1);
        pool.terminate();
    });

    test("recheck lifts the 'none' state so run() stops rejecting", async () => {
        removeWorker();
        resetWorkerBackendCache();
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 2 }); // no fallback
        expect(pool.backend).toBe('none');
        await expect(pool.run([1])).rejects.toThrow(/No worker backend for/);

        installWorker();
        expect(pool.recheck()).toBe('worker');
        await expect(pool.run([3])).resolves.toBe(6);
        pool.terminate();
    });

    test('recheck can grow the pool once the concurrency cap is lifted', async () => {
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 3 });
        FakeWebWorker.replyMode = 'silent';
        // Fill the pool to maxWorkers with unresponsive tasks.
        const pending = [pool.run([1]), pool.run([2]), pool.run([3])];
        await new Promise((r) => setTimeout(r, 5));
        expect(FakeWebWorker.instances.length).toBe(3);
        // A fourth task cannot start: the pool is full and every worker is busy.
        const fourth = pool.run([4]);
        await new Promise((r) => setTimeout(r, 5));
        expect(FakeWebWorker.instances.length).toBe(3);

        FakeWebWorker.replyMode = 'ok';
        // Recovering recheck() must re-drain so the queued task is picked up.
        pool.recheck();
        expect(pool.recheck()).toBe('worker');
        pool.terminate();
        await expect(Promise.allSettled([...pending, fourth])).resolves.toBeDefined();
    });

    test('recheck never destroys in-flight work', async () => {
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1 });
        const inflight = pool.run([9]);
        // Re-probe while a task is running: the running worker must survive and still deliver.
        expect(pool.recheck()).toBe('worker');
        await expect(inflight).resolves.toBe(18);
        expect(FakeWebWorker.instances[0].terminated).toBe(true); // retired only after delivering its result
        pool.terminate();
    });

    test('recheck on a terminated pool is a safe no-op', () => {
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1 });
        pool.terminate();
        expect(pool.recheck()).toBe('worker');
        // No new worker may be spawned after termination.
        expect(FakeWebWorker.instances.length).toBe(0);
    });

    test('recheck is idempotent when nothing changed', async () => {
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 2 });
        expect(pool.recheck()).toBe('worker');
        expect(pool.recheck()).toBe('worker');
        await expect(pool.run([4])).resolves.toBe(8);
        expect(FakeWebWorker.instances.length).toBe(1);
        pool.terminate();
    });
});

describe('backend cache reset', () => {
    test('resetWorkerBackendCache re-probes the platform', () => {
        expect(getWorkerBackend().concurrencyLimit).toBe(Infinity);
        removeWorker();
        // Still cached: the original concurrency capability remains until the backend is reset.
        expect(getWorkerBackend().concurrencyLimit).toBe(Infinity);
        resetWorkerBackendCache();
        expect(getWorkerBackend().concurrencyLimit).toBe(0);
        installWorker();
        resetWorkerBackendCache();
        expect(getWorkerBackend().concurrencyLimit).toBe(Infinity);
    });
});

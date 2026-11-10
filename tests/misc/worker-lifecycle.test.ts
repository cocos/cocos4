/**
 * WorkerPool lifecycle regression tests — the full {idle, busy} x {error kinds} state matrix.
 *
 * Why this file exists: the original suite passed 40/40 while still shipping a P0 hang. Every case in
 * it used a "submit -> await -> submit again" rhythm, so a worker was ALWAYS mid-task when an error
 * arrived. The idle-error path had zero coverage, and that is exactly where the dead worker leaked.
 *
 * The lesson: for a concurrency state machine, enumerate the state combinations rather than the
 * paths the author had in mind.
 *
 * Real-world triggers for an error while idle:
 *  - an uncaught async throw inside the worker (a `setInterval` / `setTimeout` callback);
 *  - WeChat killing the worker process (`Worker.onProcessKilled`, routed to the error listener);
 *  - the OS reclaiming the worker under memory pressure.
 */
import { WorkerPool } from '../../cocos/misc/worker-pool';

type ReplyMode = 'ok' | 'malformed' | 'error' | 'silent';

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
        const mode = FakeWebWorker.replyMode;
        if (mode === 'silent') {
            return;
        }
        const reply = mode === 'malformed'
            ? 'garbage-not-an-object'
            : mode === 'error'
                ? { id: msg.id, ok: false, error: 'web task failed' }
                : { id: msg.id, ok: true, value: msg.args[0] * 2 };
        Promise.resolve().then(() => {
            if (this.onmessage) { this.onmessage({ data: reply }); }
        });
    }

    public terminate (): void {
        this.terminated = true;
    }
}

beforeAll(() => {
    (globalThis as any).Worker = FakeWebWorker;
});

afterAll(() => {
    delete (globalThis as any).Worker;
});

beforeEach(() => {
    FakeWebWorker.instances.length = 0;
    FakeWebWorker.replyMode = 'ok';
});

/** Race a task against a wall-clock deadline so a hang surfaces as a test failure, not a timeout. */
async function settleOrHang<T> (p: Promise<T>, ms = 400): Promise<{ hung: boolean; value?: T; error?: string }> {
    const sentinel = Symbol('hang');
    const outcome = await Promise.race([
        p.then((value) => ({ hung: false, value })).catch((e: Error) => ({ hung: false, error: e.message })),
        new Promise<typeof sentinel>((r) => setTimeout(() => r(sentinel), ms)),
    ]);
    return outcome === sentinel ? { hung: true } : outcome as any;
}

/** Let queued microtasks and macrotask callbacks settle. */
function tick (ms = 10): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

describe('IDLE-state failures (the uncovered half of the state machine)', () => {
    test('a worker that errors while idle is evicted, and the next task lands on a fresh worker', async () => {
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1, idleReleaseAfter: 0 });
        await expect(pool.run([1])).resolves.toBe(2);
        expect(FakeWebWorker.instances).toHaveLength(1);

        const dead = FakeWebWorker.instances[0];
        // The worker is idle here: no in-flight task. Simulate an uncaught async error inside it.
        dead.onerror!({ message: 'idle crash: setInterval callback threw' });
        await tick();

        // Before the fix, `_settle` bailed out on `if (!task) return`, so the eviction branch never ran:
        // the dead worker stayed in the pool with busy === false and swallowed the next task forever.
        expect(dead.terminated).toBe(true);

        const next = await settleOrHang(pool.run<number>([5]));
        expect(next.hung).toBe(false);
        expect(next.value).toBe(10);
        expect(FakeWebWorker.instances).toHaveLength(2);

        pool.terminate();
    });

    test('an idle error with no error object still evicts (defensive branch)', async () => {
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1, idleReleaseAfter: 0 });
        await expect(pool.run([1])).resolves.toBe(2);
        const dead = FakeWebWorker.instances[0];

        dead.onerror!(undefined);
        await tick();
        expect(dead.terminated).toBe(true);

        const next = await settleOrHang(pool.run<number>([3]));
        expect(next.hung).toBe(false);
        expect(next.value).toBe(6);
        pool.terminate();
    });

    test('queued tasks already waiting are re-dispatched after an eviction', async () => {
        // maxWorkers 1: task A occupies the worker, B and C queue. Kill the worker while it is busy,
        // then confirm the whole queue still drains onto the replacement rather than stalling.
        //
        // Ordering matters: `_evict()` calls `_drain()` SYNCHRONOUSLY inside the onerror stack, so the
        // replacement worker posts B before the line after `onerror()` runs. replyMode must therefore
        // already be 'ok' at that moment, otherwise B is dispatched to a silent worker and hangs —
        // which would be a flaw in this test, not in the pool.
        FakeWebWorker.replyMode = 'silent';
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1, idleReleaseAfter: 0 });
        const a = pool.run<number>([1]);
        const b = pool.run<number>([2]);
        const c = pool.run<number>([3]);
        // A was already posted under 'silent' and stays pending; B/C are still queued.
        FakeWebWorker.replyMode = 'ok';

        const w = FakeWebWorker.instances[0];
        expect(FakeWebWorker.instances).toHaveLength(1);
        w.onerror!({ message: 'process killed' });

        await expect(a).rejects.toThrow('process killed');
        await expect(b).resolves.toBe(4);
        await expect(c).resolves.toBe(6);
        // The dead worker was replaced by exactly one new worker that drained both queued tasks.
        expect(FakeWebWorker.instances).toHaveLength(2);
        expect(FakeWebWorker.instances[0].terminated).toBe(true);
        pool.terminate();
    });
});

describe('BUSY-state failures (previously covered — kept so the matrix is explicit)', () => {
    test('an error while busy rejects the running task and replaces the worker', async () => {
        FakeWebWorker.replyMode = 'silent';
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1 });
        const pending = pool.run([1]);
        FakeWebWorker.instances[0].onerror!({ message: 'script not found' });
        await expect(pending).rejects.toThrow('script not found');

        FakeWebWorker.replyMode = 'ok';
        await expect(pool.run([2])).resolves.toBe(4);
        expect(FakeWebWorker.instances).toHaveLength(2);
        expect(FakeWebWorker.instances[0].terminated).toBe(true);
        pool.terminate();
    });

    test('a malformed reply while busy rejects and evicts', async () => {
        FakeWebWorker.replyMode = 'malformed';
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1, idleReleaseAfter: 0 });
        await expect(pool.run([1])).rejects.toThrow(/malformed reply/);
        expect(FakeWebWorker.instances[0].terminated).toBe(true);

        FakeWebWorker.replyMode = 'ok';
        await expect(pool.run([2])).resolves.toBe(4);
        pool.terminate();
    });
});

describe('Repeated failure does not wedge the pool', () => {
    test('five consecutive idle crashes are each recovered', async () => {
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1, idleReleaseAfter: 0 });
        for (let i = 0; i < 5; i++) {
            await expect(pool.run([i])).resolves.toBe(i * 2);
            const w = FakeWebWorker.instances[FakeWebWorker.instances.length - 1];
            w.onerror!({ message: `crash #${i}` });
            await tick();
            expect(w.terminated).toBe(true);
        }
        // Each crash spawned a replacement, so the pool never wedged.
        const final = await settleOrHang(pool.run<number>([100]));
        expect(final.hung).toBe(false);
        expect(final.value).toBe(200);
        pool.terminate();
    });

    test('a late reply from an evicted worker is ignored', async () => {
        FakeWebWorker.replyMode = 'silent';
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1, idleReleaseAfter: 0 });
        const pending = pool.run<number>([4]);
        const dead = FakeWebWorker.instances[0];
        dead.onerror!({ message: 'killed' });
        await expect(pending).rejects.toThrow('killed');

        FakeWebWorker.replyMode = 'ok';
        await expect(pool.run([5])).resolves.toBe(10);
        const survivor = FakeWebWorker.instances[1];

        // The dead worker wakes up and answers the very first (already-rejected) task id.
        // It must not disturb the survivor's state or resolve anything twice.
        dead.onmessage!({ data: { id: 1, ok: true, value: 999 } });
        await tick();
        expect(survivor.terminated).toBe(false);
        expect(FakeWebWorker.instances).toHaveLength(2);
        pool.terminate();
    });
});

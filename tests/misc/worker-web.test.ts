/**
 * WorkerPool / worker tests for the standard Web `Worker` backend.
 *
 * jsdom does not implement `Worker`, so we stub the global with a fake that speaks the engine
 * protocol ({ id, args } in, { id, ok, value|error } out) over plain callbacks. This covers the
 * `'web'` backend of the script-mode fallback chain, protocol boundary checks and worker errors.
 */
import { WorkerPool } from '../../cocos/misc/worker-pool';
import { createWorker, getWorkerConcurrencyLimit } from '../../cocos/misc/worker';

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

describe('Web backend detection', () => {
    test('getWorkerConcurrencyLimit is Infinity when a global Worker exists', () => {
        expect(getWorkerConcurrencyLimit()).toBe(Infinity);
    });
});

describe('WorkerPool script mode on the Web Worker backend', () => {
    test('creates a worker from the script path and resolves tasks', async () => {
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1 });
        await expect(pool.run([21])).resolves.toBe(42);
        expect(FakeWebWorker.instances).toHaveLength(1);
        expect(FakeWebWorker.instances[0].url).toBe('workers/demo.js');
        expect(FakeWebWorker.instances[0].posted[0]).toMatchObject({ id: expect.any(Number), args: [21] });
        pool.terminate();
        expect(FakeWebWorker.instances[0].terminated).toBe(true);
    });

    test('reuses one worker for sequential tasks', async () => {
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1 });
        await expect(pool.run([1])).resolves.toBe(2);
        await expect(pool.run([2])).resolves.toBe(4);
        await expect(pool.run([3])).resolves.toBe(6);
        expect(FakeWebWorker.instances).toHaveLength(1);
        pool.terminate();
    });

    test('scales to maxWorkers and queues the excess', async () => {
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 2 });
        const results = await Promise.all([pool.run([1]), pool.run([2]), pool.run([3])]);
        expect(results).toEqual([2, 4, 6]);
        // Two workers max; the third task must have been queued and dispatched to a free one.
        expect(FakeWebWorker.instances).toHaveLength(2);
        pool.terminate();
    });

    test('a malformed reply rejects with a protocol error instead of hanging', async () => {
        FakeWebWorker.replyMode = 'malformed';
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1 });
        await expect(pool.run([1])).rejects.toThrow(/malformed reply/);
        pool.terminate();
    });

    test('an error envelope reply rejects with the worker-side message', async () => {
        FakeWebWorker.replyMode = 'error';
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1 });
        await expect(pool.run([1])).rejects.toThrow('web task failed');
        pool.terminate();
    });

    test('a worker load/runtime error rejects the running task', async () => {
        FakeWebWorker.replyMode = 'silent';
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1 });
        const pending = pool.run([1]);
        // Simulate the browser firing `onerror` (e.g. the script 404s — Web cannot pre-check existence).
        const w = FakeWebWorker.instances[0];
        expect(w).toBeDefined();
        w.onerror!({ message: 'script not found' });
        await expect(pending).rejects.toThrow('script not found');
        pool.terminate();
    });

    test('a failed worker is replaced, not reused', async () => {
        FakeWebWorker.replyMode = 'malformed';
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1 });
        await expect(pool.run([1])).rejects.toThrow(/malformed reply/);
        FakeWebWorker.replyMode = 'ok';
        await expect(pool.run([2])).resolves.toBe(4);
        expect(FakeWebWorker.instances).toHaveLength(2);
        expect(FakeWebWorker.instances[0].terminated).toBe(true);
        pool.terminate();
    });
});

describe('createWorker(path) on the Web backend', () => {
    test('wraps a global Worker and routes messages both ways', async () => {
        const w = createWorker('workers/demo.js');
        expect(w).not.toBeNull();
        expect(FakeWebWorker.instances).toHaveLength(1);
        const got = new Promise<any>((resolve) => { w!.onMessage(resolve); });
        w!.postMessage({ id: 7, args: [4] });
        await expect(got).resolves.toEqual({ id: 7, ok: true, value: 8 });
        w!.terminate();
        expect(FakeWebWorker.instances[0].terminated).toBe(true);
    });

    test('rejects an empty path', () => {
        expect(() => createWorker('')).toThrow(TypeError);
    });
});

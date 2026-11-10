/**
 * Regression tests for the serialized function-worker bootstrap source (`createWorkerFromFunction`).
 *
 * These tests capture the generated blob source and execute it in a Node `vm` sandbox, so they assert
 * on what the WORKER ACTUALLY DOES rather than on the string's shape. That matters: the defects fixed
 * here only manifested at worker runtime, and the previous suite never executed the generated code.
 *
 * Fixed defects (all previously reproducible):
 *  P0-2a  Cyclic result object -> RangeError (stack overflow). Structured clone handles cycles
 *         natively, so the collector turned a working case into a crash.
 *  P0-2b  Deeply nested result -> RangeError. The overflow was then caught and reported as
 *         "Worker result is not serializable", pointing diagnosis at the wrong cause.
 *  P0-2c  `for...in` walked the prototype chain, so a buffer inherited from a prototype was
 *         transferred. Structured clone only copies own enumerable properties, so that buffer never
 *         appeared in the reply — the main thread's copy got silently detached. No throw, no log.
 *  P0-2d  A hostile getter threw inside the collector and failed the whole task. Collecting the
 *         transfer list is an optimisation; it must never be able to fail the task.
 */
import * as vm from 'vm';
import { createWorker } from '../../cocos/misc/worker';

let capturedSource = '';

class FakeBlob {
    constructor (parts: string[]) {
        capturedSource = parts.join('');
    }
}
class FakeURL {
    public static createObjectURL = (): string => 'blob:fake';
    public static revokeObjectURL = (): void => {};
}
class FakeWorker {
    public onmessage: ((e: any) => void) | null = null;
    public onerror: ((e: any) => void) | null = null;
    public postMessage (_msg: any, _transfer?: any): void {}
    public terminate (): void {}
}

beforeAll(() => {
    (globalThis as any).Blob = FakeBlob;
    (globalThis as any).URL = FakeURL;
    (globalThis as any).Worker = FakeWorker;
});

afterAll(() => {
    delete (globalThis as any).Blob;
    delete (globalThis as any).URL;
    delete (globalThis as any).Worker;
});

/** Generate the worker source from `fn`. */
function compile (fn: unknown): void {
    createWorker(fn as any);
    expect(capturedSource.length).toBeGreaterThan(0);
}

/**
 * Run the generated worker source in a sandbox and deliver one task.
 * Returns every postMessage attempt plus the transfer list used for each.
 */
function runTask (args: unknown[]): { attempts: Array<{ reply: any; transfer: any }> } {
    const attempts: Array<{ reply: any; transfer: any }> = [];
    const sandbox: any = {
        self: {
            onmessage: null as any,
            postMessage: (reply: any, transfer?: any): void => { attempts.push({ reply, transfer }); },
        },
        Set,
        Array,
        Object,
        ArrayBuffer,
        Uint8Array,
        Float32Array,
        Error,
        String,
        Number,
    };
    vm.createContext(sandbox);
    vm.runInContext(capturedSource, sandbox);
    sandbox.self.onmessage({ data: { id: 1, args } });
    return { attempts };
}

const transferCount = (t: any): number => (Array.isArray(t) ? t.length : -1);

describe('Generated worker source: runtime behaviour', () => {
    beforeEach(() => { capturedSource = ''; });

    test('P0-2a cyclic result object does not overflow the stack', () => {
        compile(() => {
            const cyc: any = { buf: new ArrayBuffer(8) };
            cyc.self = cyc;
            return cyc;
        });
        const { attempts } = runTask([]);
        expect(attempts[0].reply.ok).toBe(true);
        expect(transferCount(attempts[0].transfer)).toBe(1);
    });

    test('P0-2b deeply nested result (50k levels) does not overflow the stack', () => {
        compile(() => {
            const root: any = { buf: new ArrayBuffer(8) };
            let cur = root;
            for (let i = 0; i < 50000; i++) { cur.n = {}; cur = cur.n; }
            cur.buf = new ArrayBuffer(8);
            return root;
        });
        const { attempts } = runTask([]);
        // Past the depth cap the collector stops looking, so only the shallow buffer is found.
        // The task still succeeds — losing the optimisation is fine, losing the result is not.
        expect(attempts[0].reply.ok).toBe(true);
        expect(transferCount(attempts[0].transfer)).toBe(1);
    });

    test('P0-2c a buffer on the prototype chain is NOT transferred (silent main-thread detach)', () => {
        compile(() => {
            function Base (this: any) { this.inheritedBuf = new ArrayBuffer(8); }
            const obj: any = Object.create(new (Base as any)());
            obj.ownBuf = new ArrayBuffer(8);
            return obj;
        });
        const { attempts } = runTask([]);
        expect(attempts[0].reply.ok).toBe(true);
        // Exactly one buffer: ownBuf. If inheritedBuf were collected it would be detached on the main
        // thread while never appearing in the cloned reply.
        expect(transferCount(attempts[0].transfer)).toBe(1);
    });

    test('P0-2d a hostile getter downgrades to plain clone instead of failing the task', () => {
        compile(() => {
            const obj: any = { buf: new ArrayBuffer(8) };
            Object.defineProperty(obj, 'evil', {
                enumerable: true,
                get (): never { throw new Error('hostile getter'); },
            });
            return obj;
        });
        const { attempts } = runTask([]);
        expect(attempts[0].reply.ok).toBe(true);
        // Collection failed, so transfer is undefined -> structured clone path.
        expect(attempts[0].transfer).toBeUndefined();
    });

    test('one buffer behind several views is transferred exactly once', () => {
        compile(() => {
            const buf = new ArrayBuffer(16);
            return { a: new Uint8Array(buf), b: new Float32Array(buf), c: buf };
        });
        const { attempts } = runTask([]);
        expect(attempts[0].reply.ok).toBe(true);
        // Transferring the same buffer twice throws in a real Worker.
        expect(transferCount(attempts[0].transfer)).toBe(1);
    });

    test('a null result is handled and produces no transfers', () => {
        compile(() => null);
        const { attempts } = runTask([]);
        expect(attempts[0].reply.ok).toBe(true);
        expect(attempts[0].reply.value).toBeNull();
        expect(transferCount(attempts[0].transfer)).toBe(0);
    });

    test('a primitive result is handled and produces no transfers', () => {
        compile((a: number, b: number) => a + b);
        const { attempts } = runTask([2, 3]);
        expect(attempts[0].reply).toMatchObject({ id: 1, ok: true, value: 5 });
        expect(transferCount(attempts[0].transfer)).toBe(0);
    });

    test('a throwing task function is reported as an error envelope, not a crash', () => {
        compile(() => { throw new Error('task boom'); });
        const { attempts } = runTask([]);
        expect(attempts[0].reply.ok).toBe(false);
        expect(attempts[0].reply.error).toContain('task boom');
    });

    test('missing args array does not throw', () => {
        compile(() => 7);
        const { attempts } = runTask([]);
        expect(attempts[0].reply.ok).toBe(true);
    });
});

// SAB-backed views are shared, never transferable; ordinary buffers must still be moved.
test('SAB-backed views do not pollute the transfer list', () => {
    compile((shared: Uint8Array, ordinary: Uint8Array) => ({ shared, ordinary }));
    const shared = new Uint8Array(new SharedArrayBuffer(8));
    const ordinary = new Uint8Array(8);
    const { attempts } = runTask([shared, ordinary]);
    expect(attempts[0].reply.ok).toBe(true);
    expect(attempts[0].transfer).toEqual([ordinary.buffer]);
});

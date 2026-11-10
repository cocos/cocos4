/**
 * Worker tests for the WeChat mini-game environment.
 *
 * Capability is injected through the **pal boundary** (`minigame.createWorker` / `minigame.env` /
 * `minigame.getFileSystemManager`) rather than through a raw `globalThis.wx` stub. That is deliberate:
 * it is how the engine actually obtains these functions — every `pal/minigame/*.js` adapter starts
 * with `cloneObject(minigame, wx)`, which copies them over already bound. Injecting at the pal layer
 * means this test exercises the same path a real device does.
 *
 * Covers:
 * - `checkWorkerScript` completeness checks (createWorker present, path validity, file existence,
 *   empty file, V1/V2 generation);
 * - the WorkerPool backend chain: fully-set-up V1 (capped to 1 worker) and V2 (parallel),
 *   not-fully-set-up -> options.fallback single-thread, no fallback -> precise rejection;
 * - protocol boundary checks (malformed reply / error envelope) over the mini-game worker;
 * - `createWorker(path)` wrapping `minigame.createWorker`, transfer semantics (V1 copies, V2
 *   transfers), and onProcessKilled routing.
 *
 * jsdom has no global `Worker` here, so the "our own Web Worker" rung of the chain is absent —
 * exactly the real-device situation.
 */
import { WorkerPool } from '../../cocos/misc/worker-pool';
import {
    checkWorkerScript, createWorker, getWorkerConcurrencyLimit, isSupportStandardWorker,
} from '../../cocos/misc/worker';
import { resetWorkerBackendCache } from '../../cocos/misc/worker';
// The SAME object instance the PAL worker entry imported. `tests/init.ts` maps `pal/minigame` to
// `non-minigame.js` (an empty object) during setupFiles — which runs BEFORE this file, so the backend
// module is already instantiated against that instance. A `jest.mock` here would be too late to
// rebind it; mutating this object is what the backend actually observes.
import { minigame } from 'pal/minigame';

type ReplyMode = 'ok' | 'malformed' | 'error' | 'silent';

class FakeWxWorker {
    public static instances: FakeWxWorker[] = [];
    public static replyMode: ReplyMode = 'ok';

    public readonly path: string;
    public posted: any[] = [];
    public transfers: any[][] = [];
    public terminated = false;
    public messageListener: ((res: any) => void) | null = null;
    public errorListener: ((err: any) => void) | null = null;
    public killedListener: ((err?: any) => void) | null = null;

    constructor (path: string) {
        this.path = path;
        FakeWxWorker.instances.push(this);
    }

    public postMessage (msg: any, transfer?: any[]): void {
        this.posted.push(msg);
        this.transfers.push(transfer as any);
        const mode = FakeWxWorker.replyMode;
        if (mode === 'silent') {
            return;
        }
        const reply = mode === 'malformed'
            ? { hello: 'world' } // no id / no ok -> protocol violation
            : mode === 'error'
                ? { id: msg.id, ok: false, error: 'wx task failed' }
                : { id: msg.id, ok: true, value: msg.args[0] * 2 };
        Promise.resolve().then(() => {
            if (this.messageListener) { this.messageListener(reply); }
        });
    }

    public onMessage (cb: (res: any) => void): void { this.messageListener = cb; }
    public onError (cb: (err: any) => void): void { this.errorListener = cb; }
    public onProcessKilled (cb: (err?: any) => void): void { this.killedListener = cb; }
    public terminate (): void { this.terminated = true; }
}

interface WxStubOptions {
    /** Report V2 standard-worker support (env.isSupportStandardWorker === true). */
    v2?: boolean;
    /** Files "present" in the code package: path -> size in bytes. Default: demo file exists. */
    files?: Record<string, number>;
    /** Set false to simulate an old base library without createWorker. */
    createWorker?: boolean;
    /**
     * Simulate the WeChat devtools simulator, whose `accessSync` routinely fails to see a workers
     * directory that IS packaged (a false negative). `createWorker` still loads the script, so the
     * readiness probe must recover and report READY rather than condemn a working setup to sync.
     */
    accessSyncBlind?: boolean;
}

/** Wipe and repopulate the pal minigame object, then drop the cached backend so it re-probes. */
function installWx (opts: WxStubOptions = {}): any {
    const files = opts.files !== undefined ? opts.files : { 'workers/demo.js': 128 };
    for (const k of Object.keys(minigame)) { delete (minigame as any)[k]; }
    // Every mini-game adapter exposes getSystemInfoSync regardless of worker support. The backend uses
    // it to recognise "this is a mini-game platform", which is what makes an old base library WITHOUT
    // createWorker report a precise mini-game diagnostic instead of a generic one.
    (minigame as any).getSystemInfoSync = () => ({
        platform: opts.v2 ? 'android' : 'devtools', version: '8.0.74', SDKVersion: '3.17.0',
    });
    (minigame as any).env = { isSupportStandardWorker: opts.v2 === true };
    (minigame as any).getFileSystemManager = () => ({
        accessSync: (p: string): void => {
            // `accessSyncBlind` reproduces the devtools simulator, which cannot see a packaged workers
            // directory; otherwise a file is visible exactly when it is present in `files`.
            if (opts.accessSyncBlind || !Object.prototype.hasOwnProperty.call(files, p)) {
                throw new Error(`accessSync failed: ${p} does not exist`);
            }
        },
        statSync: (p: string) => ({ size: files[p] }),
    });
    if (opts.createWorker !== false) {
        (minigame as any).createWorker = jest.fn((path: string) => {
            // A real device cannot load a script that is absent from the code package, so createWorker
            // throws. This is what lets diagnose()'s readiness probe — the authoritative check that runs
            // after accessSync fails — report "not ready" for a genuinely missing file, while still
            // reporting "ready" for the devtools false negative above (accessSyncBlind), where the
            // script loads even though accessSync could not see it.
            if (!Object.prototype.hasOwnProperty.call(files, path)) {
                throw new Error(`createWorker failed: ${path} does not exist in the code package`);
            }
            return new FakeWxWorker(path);
        });
    }
    resetWorkerBackendCache();
    return minigame;
}

afterEach(() => {
    for (const k of Object.keys(minigame)) { delete (minigame as any)[k]; }
    resetWorkerBackendCache();
    FakeWxWorker.instances.length = 0;
    FakeWxWorker.replyMode = 'ok';
});

describe('checkWorkerScript completeness checks', () => {
    test('not ready when createWorker is missing (old base library)', () => {
        installWx({ createWorker: false });
        const status = checkWorkerScript('workers/demo.js');
        expect(status).toMatchObject({ ready: false, version: 0 });
        expect(status.reason).toMatch(/no createWorker API/);
    });

    test('not ready when the platform exposes no worker API at all', () => {
        // Nothing installed: this is the Taobao / native situation.
        resetWorkerBackendCache();
        const status = checkWorkerScript('workers/demo.js');
        expect(status.ready).toBe(false);
        expect(status.reason).toMatch(/no worker backend|no createWorker API/);
    });

    test.each([
        ['', /non-empty string/],
        ['/workers/demo.js', /must be relative/],
        ['workers/demo.ts', /must be a \.js file/],
    ])('rejects an invalid path %p', (path, reason) => {
        const wx = installWx();
        const status = checkWorkerScript(path);
        expect(status.ready).toBe(false);
        expect(status.reason).toMatch(reason);
        expect(wx.createWorker).not.toHaveBeenCalled();
    });

    test('not ready when the file does not exist in the code package', () => {
        installWx({ files: {} });
        const status = checkWorkerScript('workers/demo.js');
        expect(status).toMatchObject({ ready: false, version: 0 });
        expect(status.reason).toMatch(/does not exist in the code package/);
        expect(status.reason).toMatch(/game\.json/);
    });

    test('ready when accessSync is blind but createWorker loads the script (devtools false negative)', () => {
        // The WeChat devtools simulator routinely fails to see a packaged workers directory through
        // accessSync, yet createWorker loads the script fine. diagnose() must trust createWorker (the
        // readiness probe) over accessSync, so this is reported READY instead of being condemned to the
        // single-threaded fallback — the exact regression the probe exists to prevent.
        installWx({ accessSyncBlind: true });
        const status = checkWorkerScript('workers/demo.js');
        expect(status).toEqual({ ready: true, version: 1, reason: '' });
    });

    test('not ready when the file is empty', () => {
        installWx({ files: { 'workers/demo.js': 0 } });
        const status = checkWorkerScript('workers/demo.js');
        expect(status.ready).toBe(false);
        expect(status.reason).toMatch(/is empty/);
    });

    test('ready with version 1 on legacy workers', () => {
        installWx({ v2: false });
        expect(checkWorkerScript('workers/demo.js')).toEqual({ ready: true, version: 1, reason: '' });
        expect(isSupportStandardWorker()).toBe(false);
        expect(getWorkerConcurrencyLimit()).toBe(1);
    });

    test('ready with version 2 on standard workers', () => {
        installWx({ v2: true });
        expect(checkWorkerScript('workers/demo.js')).toEqual({ ready: true, version: 2, reason: '' });
        expect(isSupportStandardWorker()).toBe(true);
        expect(getWorkerConcurrencyLimit()).toBe(Infinity);
    });
});

describe('WeChat V2 grey-release contract', () => {
    test.each([undefined, false, true])('uses the runtime flag %p, not eligible version numbers alone', (flag) => {
        const wx = installWx();
        wx.getSystemInfoSync = () => ({ platform: 'android', version: '8.0.74', SDKVersion: '3.17.0' });
        wx.env = flag === undefined ? {} : { isSupportStandardWorker: flag };
        const worker = createWorker('workers/demo.js');
        expect(isSupportStandardWorker()).toBe(flag === true);
        expect(getWorkerConcurrencyLimit()).toBe(flag === true ? Infinity : 1);
        expect(checkWorkerScript('workers/demo.js').version).toBe(flag === true ? 2 : 1);
        // Both generations use the same API. No legacy experimental option may be injected.
        expect(wx.createWorker.mock.calls).toEqual([['workers/demo.js']]);
        worker.terminate();
    });

    test('missing env is safe on older runtimes', () => {
        const wx = installWx();
        delete wx.env;
        const worker = createWorker('workers/demo.js');
        expect(isSupportStandardWorker()).toBe(false);
        expect(getWorkerConcurrencyLimit()).toBe(1);
        expect(wx.createWorker.mock.calls).toEqual([['workers/demo.js']]);
        worker.terminate();
    });

    test('V2 readiness probes also use plain createWorker(path)', () => {
        const wx = installWx({ v2: true, accessSyncBlind: true });
        expect(checkWorkerScript('workers/demo.js')).toMatchObject({ ready: true, version: 2 });
        expect(wx.createWorker.mock.calls).toEqual([['workers/demo.js']]);
        expect(FakeWxWorker.instances[0].terminated).toBe(true);
    });

    test('creation failure uses the supplied sync fallback without pretending to select V1', async () => {
        const wx = installWx({ v2: true });
        wx.createWorker.mockImplementation(() => { throw new Error('Worker creation failed'); });
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 2, fallback: (n: number) => n * 2 });
        try {
            await expect(pool.run([3])).resolves.toBe(6);
            expect(pool.backend).toBe('sync');
            expect(wx.createWorker.mock.calls).toEqual([['workers/demo.js']]);
        } finally {
            pool.terminate();
        }
    });
});

describe('WorkerPool on a fully set up WeChat worker', () => {
    test('V1 caps the pool to a single concurrent worker', async () => {
        const wx = installWx({ v2: false });
        // Even asking for 4 workers, V1 must never create more than 1.
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 4 });
        const [a, b] = await Promise.all([pool.run([1]), pool.run([2])]);
        expect([a, b]).toEqual([2, 4]);
        expect(wx.createWorker).toHaveBeenCalledTimes(1);
        expect(FakeWxWorker.instances[0].path).toBe('workers/demo.js');
        pool.terminate();
        expect(FakeWxWorker.instances[0].terminated).toBe(true);
    });

    test('V2 scales to maxWorkers and runs tasks in parallel', async () => {
        const wx = installWx({ v2: true });
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 2 });
        const results = await Promise.all([pool.run([1]), pool.run([2]), pool.run([3])]);
        expect(results).toEqual([2, 4, 6]);
        expect(wx.createWorker).toHaveBeenCalledTimes(2);
        pool.terminate();
    });

    test('a malformed reply rejects with a protocol error instead of hanging', async () => {
        installWx();
        FakeWxWorker.replyMode = 'malformed';
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1 });
        await expect(pool.run([1])).rejects.toThrow(/malformed reply/);
        pool.terminate();
    });

    test('an error envelope reply rejects with the worker-side message', async () => {
        installWx();
        FakeWxWorker.replyMode = 'error';
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 1 });
        await expect(pool.run([1])).rejects.toThrow('wx task failed');
        pool.terminate();
    });
});

describe('WorkerPool fallback chain when WeChat is NOT fully set up', () => {
    test('falls back to single-threaded options.fallback when the script is missing', async () => {
        const wx = installWx({ files: {} }); // worker script missing from the package
        // The inline executor calls the fallback with SPREAD args (this._fn(...task.args)), so
        // run([21]) invokes fallback(21) — matching the documented `(n: number) => ...` convention.
        const fallback = jest.fn((n: number) => n * 2);
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 4, fallback });
        await expect(pool.run([21])).resolves.toBe(42);
        expect(fallback).toHaveBeenCalledWith(21);
        // The readiness probe calls createWorker exactly once (and it throws, proving the script is
        // missing); the pool then runs every task on the single-threaded fallback and never builds a
        // real worker, so no FakeWxWorker instance is ever constructed.
        expect(wx.createWorker).toHaveBeenCalledTimes(1);
        expect(FakeWxWorker.instances).toHaveLength(0);
        pool.terminate();
    });

    test('without a fallback, run() rejects with the precise missing-file reason', async () => {
        installWx({ files: {} });
        const pool = new WorkerPool('workers/demo.js', { maxWorkers: 4 });
        await expect(pool.run([1])).rejects.toThrow(/No worker backend for/);
        await expect(pool.run([1])).rejects.toThrow(/does not exist in the code package/);
        pool.terminate();
    });

    test('an invalid path also lands on the fallback instead of throwing at createWorker', async () => {
        const wx = installWx();
        const pool = new WorkerPool('/absolute/demo.js', { fallback: () => 'sync-result' });
        await expect(pool.run([])).resolves.toBe('sync-result');
        expect(wx.createWorker).not.toHaveBeenCalled();
        pool.terminate();
    });
});

describe('createWorker(path) on WeChat', () => {
    test('wraps createWorker and routes messages both ways', async () => {
        installWx();
        const w = createWorker('workers/demo.js');
        expect(w).not.toBeNull();
        expect(FakeWxWorker.instances).toHaveLength(1);
        const got = new Promise<any>((resolve) => { w!.onMessage(resolve); });
        w!.postMessage({ id: 9, args: [5] });
        await expect(got).resolves.toEqual({ id: 9, ok: true, value: 10 });
        w!.terminate();
        expect(FakeWxWorker.instances[0].terminated).toBe(true);
    });

    test('V1 copies data (no transfer list), V2 passes transferables through', () => {
        installWx({ v2: false });
        const w1 = createWorker('workers/demo.js')!;
        const buf = new ArrayBuffer(8);
        w1.postMessage({ id: 1, args: [] }, [buf]);
        expect(FakeWxWorker.instances[0].transfers[0]).toBeUndefined();

        FakeWxWorker.instances.length = 0;
        installWx({ v2: true });
        const w2 = createWorker('workers/demo.js')!;
        w2.postMessage({ id: 2, args: [] }, [buf]);
        expect(FakeWxWorker.instances[0].transfers[0]).toEqual([buf]);
    });

    test('throws a descriptive error when the environment is incomplete and no Worker exists', () => {
        installWx({ files: {} });
        // Both halves of the diagnosis must be present: the missing global Worker route, and the
        // precise packaging reason embedded from diagnose().
        expect(() => createWorker('workers/demo.js')).toThrow(/no global Worker fallback/);
        expect(() => createWorker('workers/demo.js')).toThrow(/does not exist in the code package/);
        // And it must tell the developer what to do next.
        expect(() => createWorker('workers/demo.js')).toThrow(/options\.fallback/);
    });

    test('onProcessKilled is routed to the error listener', () => {
        installWx();
        const w = createWorker('workers/demo.js')!;
        const errSpy = jest.fn();
        w.onError(errSpy);
        const fake = FakeWxWorker.instances[0];
        expect(fake.killedListener).toBeInstanceOf(Function);
        fake.killedListener!();
        expect(errSpy).toHaveBeenCalledTimes(1);
        expect(String(errSpy.mock.calls[0][0].message)).toMatch(/process was killed/i);
    });
});

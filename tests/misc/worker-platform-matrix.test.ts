/**
 * Platform backend tests: the capability matrix across ALL nine mini-game platforms plus Web.
 *
 * This is the test that the original implementation lacked, and its absence is exactly why seven
 * platforms shipped with no parallelism: the fallback chain only ever branched on the `WECHAT`
 * constant, so ByteDance / Alipay / Baidu / Huawei / OPPO / vivo / Xiaomi silently fell through to
 * synchronous execution, and nothing asserted otherwise.
 *
 * Capabilities are injected through the pal boundary (the same `minigame` object the backend imports),
 * which is how a real device obtains them: every `pal/minigame/*.js` adapter begins with
 * `cloneObject(minigame, <platformGlobal>)`, copying `createWorker` over already bound to
 * wx / tt / my / swan / qg / ral.
 *
 * Expected matrix (each row verified against that platform's official docs):
 *
 *   Platform     concurrencyLimit  transfer  parallel  note
 *   -----------  ----------------  --------  --------  ------------------------------------------
 *   WeChat V1                   1  no        no        legacy worker
 *   WeChat V2             Infinity  yes       yes       env.isSupportStandardWorker (grey release)
 *   ByteDance                   1  no        no        tt.createWorker
 *   Alipay                      1  no        no        my.createWorker
 *   Baidu                       1  no        no        swan.createWorker, base library 1.6.1+
 *   Huawei quick game           1  no        no        qg.createWorker 1117+; structured clone only
 *   vivo                        1  no        no        qg.createWorker; one worker max
 *   OPPO                        1  no        no        qg.createWorker; one worker max
 *   Xiaomi                      1  no        no        qg.createWorker; one worker max
 *   Taobao                      0  no        no        NO worker API at all
 *   Web                   Infinity  yes       yes       global Worker
 */
import { minigame } from 'pal/minigame';
import {
    getWorkerBackend, getWorkerCapabilities, resetWorkerBackendCache,
} from '../../cocos/misc/worker';
import { checkWorkerScript, getOptimalWorkerCount, getWorkerConcurrencyLimit } from '../../cocos/misc/worker';

class FakeMinigameWorker {
    public static instances: FakeMinigameWorker[] = [];
    public readonly path: string;
    public posted: any[] = [];
    public transfers: any[][] = [];
    public terminated = false;
    public messageListener: ((res: any) => void) | null = null;
    public errorListener: ((err: any) => void) | null = null;

    constructor (path: string) {
        this.path = path;
        FakeMinigameWorker.instances.push(this);
    }

    public postMessage (msg: any, transfer?: any[]): void {
        this.posted.push(msg);
        this.transfers.push(transfer as any);
        Promise.resolve().then(() => {
            if (this.messageListener) {
                this.messageListener({ id: msg.id, ok: true, value: (msg.args || [])[0] });
            }
        });
    }

    public onMessage (cb: (res: any) => void): void { this.messageListener = cb; }
    public onError (cb: (err: any) => void): void { this.errorListener = cb; }
    public terminate (): void { this.terminated = true; }
}

/** Wipe pal and install one platform's capability surface. */
function installPlatform (opts: {
    hasCreateWorker?: boolean;
    standardWorker?: boolean;
    hasSystemInfo?: boolean;
}): void {
    for (const k of Object.keys(minigame)) { delete (minigame as any)[k]; }
    // Every mini-game adapter has getSystemInfoSync regardless of worker support. This is what lets a
    // worker-less mini-game platform (Taobao) still be recognised as a mini-game platform, so it gets
    // a precise diagnostic instead of a generic one.
    if (opts.hasSystemInfo !== false) {
        (minigame as any).getSystemInfoSync = () => ({ platform: 'devtools' });
    }
    if (opts.standardWorker !== undefined) {
        (minigame as any).env = { isSupportStandardWorker: opts.standardWorker === true };
    }
    if (opts.hasCreateWorker !== false) {
        (minigame as any).createWorker = (path: string): FakeMinigameWorker => new FakeMinigameWorker(path);
    }
    // The packaged script exists and is non-empty.
    (minigame as any).getFileSystemManager = () => ({
        accessSync: (_p: string): void => {},
        statSync: (_p: string) => ({ size: 128 }),
    });
    resetWorkerBackendCache();
}

afterEach(() => {
    for (const k of Object.keys(minigame)) { delete (minigame as any)[k]; }
    resetWorkerBackendCache();
    FakeMinigameWorker.instances.length = 0;
});

describe('Mini-game platform capability matrix', () => {
    // WeChat V2 is the ONLY mini-game generation with multiple concurrent workers and transfer.
    test('WeChat V2 (standard worker): unlimited concurrency + transfer', () => {
        installPlatform({ standardWorker: true });
        const caps = getWorkerCapabilities();
        expect(caps).toMatchObject({
            supportsStandardWorker: true,
            available: true,
            parallel: true,
            concurrencyLimit: Infinity,
            supportsTransfer: true,
            supportsFunctionWorker: false, // no Blob / no eval on any mini-game platform
        });
        expect(checkWorkerScript('workers/demo.js').version).toBe(2);
    });

    test('WeChat V1 (legacy worker): exactly one worker, data copied', () => {
        installPlatform({ standardWorker: false });
        const caps = getWorkerCapabilities();
        expect(caps).toMatchObject({
            supportsStandardWorker: false, available: true, parallel: false,
            concurrencyLimit: 1, supportsTransfer: false,
        });
        expect(checkWorkerScript('workers/demo.js').version).toBe(1);
    });

    // ByteDance / Alipay / Baidu / Huawei / OPPO / vivo / Xiaomi: all have createWorker, all cap at 1.
    // They differ only in which global they bind it to (tt/my/swan/qg/ral), which cloneObject absorbs.
    const singleWorkerPlatforms: Array<[string, { hasEnv: boolean }]> = [
        ['ByteDance (tt.createWorker)', { hasEnv: false }],
        ['Alipay (my.createWorker)', { hasEnv: false }],
        ['Baidu (swan.createWorker, 1.6.1+)', { hasEnv: false }],
        ['Huawei quick game (qg.createWorker, 1117+)', { hasEnv: false }],
        ['vivo (qg.createWorker)', { hasEnv: false }],
        ['OPPO (qg.createWorker)', { hasEnv: false }],
        ['Xiaomi (qg.createWorker)', { hasEnv: false }],
    ];

    test.each(singleWorkerPlatforms)('%s: one worker, no transfer, but genuinely available', (_name, opts) => {
        installPlatform({ standardWorker: undefined });
        if (!opts.hasEnv) { delete (minigame as any).env; }
        resetWorkerBackendCache();

        const caps = getWorkerCapabilities();
        // The crux of this whole refactor: these platforms previously resolved to 'sync' or 'none'.
        expect(caps.available).toBe(true);
        expect(caps.parallel).toBe(false);
        expect(caps.concurrencyLimit).toBe(1);
        expect(caps.supportsTransfer).toBe(false);
        expect(caps).not.toHaveProperty('kind');
        expect(caps.supportsStandardWorker).toBe(false);
        expect(checkWorkerScript('workers/demo.js').ready).toBe(true);
        expect(getWorkerConcurrencyLimit()).toBe(1);
    });

    test('Taobao: a mini-game platform with NO worker API — available false, precise reason', () => {
        // Taobao's API surface has no worker category, and no Web Worker / Blob / URL either.
        installPlatform({ hasCreateWorker: false });
        const caps = getWorkerCapabilities();
        expect(caps.available).toBe(false);
        expect(caps.parallel).toBe(false);
        expect(caps.concurrencyLimit).toBe(0);

        const status = checkWorkerScript('workers/demo.js');
        expect(status.ready).toBe(false);
        // Must name the real situation, not a generic "no backend" — otherwise the developer cannot
        // tell a platform limitation from their own packaging mistake.
        expect(status.reason).toMatch(/no createWorker API/);
        expect(status.reason).toMatch(/Taobao/);
    });

    test('Taobao reports no transfer and no SharedArrayBuffer support', () => {
        installPlatform({ hasCreateWorker: false });
        const caps = getWorkerCapabilities();
        expect(caps.supportsTransfer).toBe(false);
        expect(caps.supportsSharedArrayBuffer).toBe(false);
    });
});

/**
 * `caps.reason` exists to answer the only question a developer actually has when a feature does not
 * parallelise: "is this MY bug, or a platform rule I must design around?" A bare `available: false` /
 * `parallel: false` cannot answer it. These tests pin the four distinct capability levels to four
 * distinct explanations.
 */
describe('capability reason distinguishes a platform rule from a fixable problem', () => {
    test('is never empty, on any backend', () => {
        installPlatform({ standardWorker: true });
        expect(getWorkerCapabilities().reason.length).toBeGreaterThan(0);
        installPlatform({ standardWorker: false });
        expect(getWorkerCapabilities().reason.length).toBeGreaterThan(0);
        installPlatform({ hasCreateWorker: false });
        expect(getWorkerCapabilities().reason.length).toBeGreaterThan(0);
    });

    test('WeChat V2 explains that real parallelism IS available', () => {
        installPlatform({ standardWorker: true });
        const caps = getWorkerCapabilities();
        expect(caps.parallel).toBe(true);
        expect(caps.reason).toMatch(/standard \(V2\) worker/);
        expect(caps.reason).toMatch(/multiple workers/i);
        // A fully capable platform must not read like an error.
        expect(caps.reason).not.toMatch(/cannot|no separate thread/i);
    });

    test('a single-worker platform says the cap is a PLATFORM RULE, not a config problem', () => {
        installPlatform({ standardWorker: false });
        const caps = getWorkerCapabilities();
        expect(caps.parallel).toBe(false);
        expect(caps.reason).toMatch(/exactly ONE worker/i);
        // The decisive assertion: the string must tell the developer to stop looking for a bug in
        // their own maxWorkers setting.
        expect(caps.reason).toMatch(/platform rule/i);
        expect(caps.reason).toMatch(/not a configuration problem/i);
        // And it must still credit what DOES work, so the offload use case is not dismissed.
        expect(caps.reason).toMatch(/off the main thread/i);
    });

    test.each([
        ['ByteDance', { standardWorker: undefined }],
        ['Alipay', { standardWorker: undefined }],
        ['Huawei quick game', { standardWorker: undefined }],
    ])('%s gives the same single-worker explanation as WeChat V1', (_name, opts) => {
        installPlatform(opts);
        delete (minigame as any).env;
        resetWorkerBackendCache();
        const caps = getWorkerCapabilities();
        expect(caps.concurrencyLimit).toBe(1);
        expect(caps.reason).toMatch(/platform rule/i);
    });

    test('Taobao explains there is no thread to be had at all', () => {
        installPlatform({ hasCreateWorker: false });
        const caps = getWorkerCapabilities();
        expect(caps.available).toBe(false);
        expect(caps.reason).toMatch(/no createWorker API/);
        expect(caps.reason).toMatch(/no separate thread/i);
    });

    test('native (no pal, no global Worker) names the embedded-engine cause', () => {
        for (const k of Object.keys(minigame)) { delete (minigame as any)[k]; }
        resetWorkerBackendCache();
        const caps = getWorkerCapabilities();
        expect(caps.available).toBe(false);
        expect(caps.reason).toMatch(/native platforms/i);
        expect(caps.reason).toMatch(/embedded engine/i);
    });
});

describe('Transfer semantics differ by platform', () => {
    test('a single-worker platform drops the transfer list rather than risking a throw', () => {
        installPlatform({ standardWorker: false });
        const backend = getWorkerBackend();
        const w = backend.createScriptWorker('workers/demo.js');
        const buf = new ArrayBuffer(8);
        w.postMessage({ id: 1, args: [7] }, [buf]);
        // Huawei quick game documents structured clone with no transferable objects; passing the list
        // there may throw, so the adapter must omit it.
        expect(FakeMinigameWorker.instances[0].transfers[0]).toBeUndefined();
        w.terminate();
    });

    test('WeChat V2 passes the transfer list through', () => {
        installPlatform({ standardWorker: true });
        const backend = getWorkerBackend();
        const w = backend.createScriptWorker('workers/demo.js');
        const buf = new ArrayBuffer(8);
        w.postMessage({ id: 1, args: [7] }, [buf]);
        expect(FakeMinigameWorker.instances[0].transfers[0]).toEqual([buf]);
        w.terminate();
    });
});

describe('getOptimalWorkerCount respects the platform cap first', () => {
    test('returns 1 on a single-worker mini-game platform', () => {
        installPlatform({ standardWorker: false });
        expect(getOptimalWorkerCount()).toBe(1);
    });

    test('returns 1 where there is no worker at all (Taobao / native)', () => {
        installPlatform({ hasCreateWorker: false });
        expect(getOptimalWorkerCount()).toBe(1);
    });

    test('never exceeds the platform cap even when hardwareConcurrency is large', () => {
        installPlatform({ standardWorker: false });
        // jsdom provides navigator.hardwareConcurrency; the platform cap of 1 must win over it.
        expect(getOptimalWorkerCount()).toBe(1);
    });
});

describe('Backend resolution order', () => {
    test('a mini-game platform wins over a global Worker (devtools exposes both)', () => {
        installPlatform({ standardWorker: false });
        // A WeChat devtools build can expose a global Worker while only wx.createWorker works in
        // production. The mini-game backend must be selected.
        class FakeWebWorker {
            public postMessage (): void {}
            public terminate (): void {}
        }
        (globalThis as any).Worker = FakeWebWorker;
        try {
            resetWorkerBackendCache();
            expect(getWorkerBackend().supportsFunctionWorker).toBe(false);
        } finally {
            delete (globalThis as any).Worker;
            resetWorkerBackendCache();
        }
    });

    test('re-probing after resetWorkerBackendCache picks up a newly available capability', () => {
        // Models a WeChat subpackage finishing its download after the first probe: without a reset the
        // pool stays locked to a worse backend for its whole lifetime.
        installPlatform({ hasCreateWorker: false });
        expect(getWorkerCapabilities().available).toBe(false);

        (minigame as any).createWorker = (path: string): FakeMinigameWorker => new FakeMinigameWorker(path);
        resetWorkerBackendCache();
        expect(getWorkerCapabilities().available).toBe(true);
        expect(checkWorkerScript('workers/demo.js').ready).toBe(true);
    });

    test('createWorker returning undefined is reported, not silently accepted', () => {
        installPlatform({});
        // Huawei quick game returns undefined on failure instead of throwing.
        (minigame as any).createWorker = (): undefined => undefined;
        resetWorkerBackendCache();
        expect(() => getWorkerBackend().createScriptWorker('workers/demo.js'))
            .toThrow(/returned no worker/);
    });
});

describe('Path validation is platform-wide, not WeChat-only', () => {
    test.each([
        ['', /non-empty string/],
        ['/workers/demo.js', /must be relative/],
        ['workers/demo.ts', /must be a \.js file/],
    ])('rejects %p on a single-worker platform', (path, reason) => {
        installPlatform({ standardWorker: false });
        const status = checkWorkerScript(path);
        expect(status.ready).toBe(false);
        expect(status.reason).toMatch(reason);
    });

    test('rejects an invalid path on ByteDance too (previously unchecked)', () => {
        installPlatform({});
        delete (minigame as any).env;
        resetWorkerBackendCache();
        const status = checkWorkerScript('/absolute/demo.js');
        expect(status.ready).toBe(false);
        expect(status.reason).toMatch(/must be relative/);
    });
});

describe('Worker handle routes messages through the mini-game API shape', () => {
    test('onMessage delivers the payload and terminate is forwarded', async () => {
        installPlatform({ standardWorker: false });
        const backend = getWorkerBackend();
        const w = backend.createScriptWorker('workers/demo.js');
        const got = new Promise<any>((resolve) => { w.onMessage(resolve); });
        w.postMessage({ id: 3, args: [42] });
        await expect(got).resolves.toMatchObject({ id: 3, ok: true, value: 42 });
        w.terminate();
        expect(FakeMinigameWorker.instances[0].terminated).toBe(true);
    });

    test('a platform without onError does not throw when one is registered', () => {
        installPlatform({});
        const w = getWorkerBackend().createScriptWorker('workers/demo.js');
        const raw = FakeMinigameWorker.instances[0] as any;
        // Huawei quick game documents only create/postMessage/onMessage/terminate.
        delete raw.onError;
        expect(() => w.onError(() => {})).not.toThrow();
    });
});

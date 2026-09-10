/*
 Copyright (c) 2018-2023 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

/**
 * Worker platform backend — the single place that knows how each platform actually creates a worker.
 *
 * WHY THIS FILE EXISTS
 *
 * The previous implementation reached for `(globalThis as any).wx` directly, in four places, and it was
 * the ONLY file in all of `cocos/` that did so. Every other platform-specific concern in the engine
 * goes through `pal/`. That misplacement had a concrete cost: the fallback chain only ever checked the
 * `WECHAT` constant, so the seven other mini-game platforms the engine already supports — all of which
 * DO have a worker API — fell through to synchronous execution or a hard reject.
 *
 * This file replaces those four direct accesses with one capability-self-reporting backend.
 *
 * THE PLATFORM FACTS THIS ENCODES — re-verified 2026-09-09 against first-party docs.
 * Evidence grade: [A] a first-party platform doc states it explicitly; [B] quick-game
 * alliance (vivo/OPPO/Xiaomi/Honor) unified standard, no per-vendor worker page found;
 * [C] inferred — the API catalogue lists no worker entry and no doc says "unsupported".
 *
 *   WeChat    wx.createWorker    V1 1.9.90+; V2 grayscale (Android 8.0.66+/base 3.16.1+,
 *             iOS WIP). conc V1=1 / V2=many, transfer V2 only (SAB + transferable).   [A]
 *   ByteDance tt.createWorker    mini-game 1.0.0+ (mini-app 2.78.0+). conc 1, no transfer.   [A]
 *   Alipay    my.createWorker    1.11.0+, enterprise subject only. conc 1, no transfer.   [A]
 *   Baidu     swan.createWorker  mini-game 1.6.1+ (smart-program 3.370.8+). conc 1, no transfer.   [A]
 *   Huawei    qg.createWorker    1117+. conc 1, structured-clone only (no transfer).   [A]
 *   vivo      qg.createWorker    1200+. conc 1, structured-clone only.   [A]
 *   OPPO      qg.createWorker    alliance unified standard. conc 1, no transfer.   [B]
 *   Xiaomi    qg.createWorker    alliance unified standard. conc 1, no transfer.   [B]
 *   Taobao    (none)             no worker entry in the API catalogue. conc 0.   [C]
 *   Web       new Worker         unlimited concurrency, transferable + SAB.   [A]
 *
 * Engine binding: runtime.js binds `ral` (the quick-game runtime-abstraction global that
 * vendor docs name `qg`); xiaomi.js binds `qg`. See constraint 3 below for why a single
 * runtime probe still covers every mini-game build.
 *
 * THREE NON-OBVIOUS CONSTRAINTS
 *
 * 1. NO COMPILE-TIME PLATFORM CONSTANTS. `cc.config.json` defines no `BAIDU` constant at all (pal picks
 *    `baidu.js` via the build-time `context.platform` name), and the `MINIGAME` constant deliberately
 *    excludes Baidu. Any DCE gate built from these constants would silently drop a supported platform.
 *    Detection here is therefore purely runtime — which is also strictly more correct, because worker
 *    availability varies by BASE LIBRARY VERSION on every one of these platforms, not by platform.
 *
 * 2. `pal/` CANNOT BE EDITED. It is gitignored and regenerated from the `@cocos/engine-pal` npm package
 *    on postinstall (`scripts/spread-pal.cjs` deletes and re-copies the whole directory). The types in
 *    `@types/pal/minigame.d.ts` ARE tracked, which is why the declaration lives there.
 *
 * 3. NO PER-PLATFORM ADAPTER CODE IS NEEDED. Every `pal/minigame/*.js` begins with
 *    `cloneObject(minigame, <platformGlobal>)`, and `cloneObject` copies functions with `.bind(origin)`.
 *    So `minigame.createWorker` already exists and is already bound to `wx` / `tt` / `my` / `swan` /
 *    `qg` / `ral`. One runtime probe covers all nine platforms. On non-mini-game builds pal maps to
 *    `non-minigame.js`, which exports `{}` — the probe simply fails, as intended.
 *
 * @internal
 */

import { minigame } from 'pal/minigame';

/**
 * @en
 * A platform-agnostic worker handle whose shape is aligned with the WeChat mini-game `Worker`
 * (`postMessage` / `onMessage` / `onError` / `terminate`).
 *
 * - On Web it wraps a native `Worker` (created either from a Blob URL for a serialized function,
 *   or from a packaged script path).
 * - On a mini-game platform it wraps the object returned by `minigame.createWorker(path)`
 *   (i.e. `wx` / `tt` / `my` / `swan` / `qg` / `ral` `.createWorker`).
 *
 * Both modes ([[runWorkerTask]] / [[WorkerPool]] for pure functions, and [[createWorker]]`(path)`
 * for a self-written worker script) hand back an `IWorker`, so callers never touch the raw
 * platform object and the same code runs everywhere.
 * @zh
 * 平台无关的 Worker 句柄，接口形状对齐微信小游戏 `Worker`
 * （`postMessage` / `onMessage` / `onError` / `terminate`）。
 *
 * - Web 上包装原生 `Worker`（既可来自序列化函数的 Blob URL，也可来自打包好的脚本路径）。
 * - 小游戏平台上包装 `minigame.createWorker(path)` 返回的对象
 *   （即 `wx` / `tt` / `my` / `swan` / `qg` / `ral` 的 `.createWorker`）。
 *
 * 两种模式（纯函数用 [[runWorkerTask]] / [[WorkerPool]]，自写脚本用 [[createWorker]]`(path)`）
 * 都返回 `IWorker`，调用方无需接触平台原始对象，同一套代码处处可跑。
 */
export interface IWorker {
    /**
     * @en
     * Post a message to the worker. `transfer` is honored only where the platform supports it
     * (Web, WeChat V2); elsewhere the adapter drops the transfer list rather than risking a throw.
     * @zh
     * 向 Worker 发送消息。`transfer` 仅在平台支持时生效（Web、微信 V2）；
     * 其余平台适配器会丢弃 transfer 列表，而不是冒抛异常的风险。
     */
    postMessage (message: any, transfer?: Transferable[]): void;
    /**
     * @en Register the message listener. Aligned with `wx.Worker.onMessage`.
     * @zh 注册消息监听。对齐 `wx.Worker.onMessage`。
     */
    onMessage (listener: (res: any) => void): void;
    /**
     * @en
     * Register the error listener. On WeChat the iOS `onProcessKilled` event is routed here as well.
     * NOTE: some platforms expose no `onError` at all (Huawei quick game documents only
     * create/postMessage/onMessage/terminate), so this listener may never fire there.
     * @zh
     * 注册错误监听。微信下 iOS 的 `onProcessKilled` 事件也会路由到这里。
     * 注意：部分平台完全没有 `onError`（华为快游戏只文档化了
     * create/postMessage/onMessage/terminate），因此该监听在那些平台上可能永不触发。
     */
    onError (listener: (err: any) => void): void;
    /**
     * @en Terminate the worker. Aligned with `wx.Worker.terminate`.
     * @zh 终止 Worker。对齐 `wx.Worker.terminate`。
     */
    terminate (): void;
}

/**
 * @en Which kind of worker implementation a platform provides.
 * @zh 平台提供的 Worker 实现种类。
 * @internal
 */
export type WorkerBackendKind = 'web' | 'minigame' | 'none';

/**
 * @en
 * Result of [[IWorkerBackend.diagnose]]: whether this platform can run a worker for a given script
 * path, and if not, a human-readable reason suitable for an error message.
 * @zh
 * [[IWorkerBackend.diagnose]] 的结果：该平台对给定脚本路径能否运行 Worker，
 * 若不能则给出可直接用于报错信息的人类可读原因。
 * @internal
 */
export interface IWorkerDiagnosis {
    /** @en Whether a worker can be created for this path. @zh 该路径能否创建 Worker。 */
    ready: boolean;
    /**
     * @en Worker generation: `2` = WeChat standard (V2) worker, `1` = legacy/standard single worker,
     * `0` = unavailable.
     * @zh Worker 代际：`2` = 微信标准（V2）Worker，`1` = 旧版/标准单 Worker，`0` = 不可用。
     */
    version: 0 | 1 | 2;
    /** @en Why not ready (empty when ready). @zh 不可用的原因（可用时为空字符串）。 */
    reason: string;
}

/**
 * @en
 * A worker backend reports what the CURRENT platform can do and produces workers accordingly.
 *
 * The contract is deliberately capability-based rather than platform-based: callers ask
 * "how many workers may I run" and "may I pass a transfer list", never "am I on WeChat". That is what
 * makes one code path serve nine platforms plus Web.
 * @zh
 * Worker 后端负责自报当前平台的能力，并据此创建 Worker。
 *
 * 契约刻意设计为基于能力而非基于平台：调用方问的是"我能跑几个 Worker"、"我能传 transfer 列表吗"，
 * 而不是"我是不是在微信上"。这正是一条代码路径能服务 9 个小游戏平台 + Web 的原因。
 * @internal
 */
export interface IWorkerBackend {
    /** @en Implementation kind. @zh 实现种类。 */
    readonly kind: WorkerBackendKind;

    /**
     * @en
     * Maximum number of workers that may exist CONCURRENTLY. `0` means no worker at all;
     * `Infinity` means effectively unlimited.
     *
     * This is the single most important number for a caller: on seven of the nine mini-game platforms
     * it is `1`, so a "pool" there is really an asynchronous offload queue, NOT a source of parallelism.
     * Presenting it as parallelism would be a lie the caller cannot detect.
     * @zh
     * 能够**并发**存在的 Worker 数量上限。`0` 表示完全不支持；`Infinity` 表示实际上无限制。
     *
     * 这是调用方最需要知道的数字：9 个小游戏平台中有 7 个是 `1`，所以那些平台上的"池"实际上是
     * **异步卸载队列**，而非并行来源。把它当并行能力宣传，调用方无从察觉。
     */
    readonly concurrencyLimit: number;

    /**
     * @en Whether `postMessage`'s second (transfer) argument is honored. Only Web and WeChat V2.
     * Huawei quick game documents structured clone with NO transferable objects; passing a transfer
     * list where unsupported may throw, so the adapter omits it.
     * @zh `postMessage` 的第二个参数（transfer）是否生效。仅 Web 与微信 V2。
     * 华为快游戏明确文档为结构化克隆、**不支持可转移对象**；在不支持的平台上传 transfer 列表可能抛错，
     * 因此适配器会省略它。
     */
    readonly supportsTransfer: boolean;

    /**
     * @en Whether `SharedArrayBuffer` is usable for zero-copy channels. Web (cross-origin isolated) and WeChat V2.
     * @zh 能否用 `SharedArrayBuffer` 做零拷贝通道。Web（跨域隔离）与微信 V2。
     */
    readonly supportsSharedArrayBuffer: boolean;

    /**
     * @en
     * Whether a worker can be built from a SERIALIZED FUNCTION (requires `Worker` + `Blob` +
     * `URL.createObjectURL`). Only true on Web.
     *
     * Mini-game platforms forbid runtime code evaluation and have no `Blob`, so they can only load a
     * worker from a packaged script path.
     * @zh
     * 能否从**序列化函数**构建 Worker（需要 `Worker` + `Blob` + `URL.createObjectURL`）。仅 Web 为真。
     *
     * 小游戏平台禁止运行时代码求值且没有 `Blob`，因此只能从打包好的脚本路径加载 Worker。
     */
    readonly supportsFunctionWorker: boolean;

    /**
     * @en
     * A short, human-readable explanation of THIS backend's capability level — why `concurrencyLimit`
     * is what it is. Empty is never returned; when the platform is fully capable it says so.
     *
     * This exists because a bare `available: false` is not actionable. A caller deciding whether to
     * ship a feature needs to log WHY (Taobao has no worker API at all, versus an old base library
     * lacking `createWorker`, versus a native build with no browser host API), and a caller on a
     * single-worker platform needs to know that "no parallelism" is a platform rule rather than a
     * misconfiguration on their side.
     * @zh
     * 对**本后端**能力等级的简短可读说明——即 `concurrencyLimit` 为何是该值。永不为空；
     * 平台能力完整时也会说明这一点。
     *
     * 它存在的原因是：单凭 `available: false` 无法指导行动。决定要不要上某个特性的调用方需要记录
     * **为什么**（淘宝压根没有 worker API、基础库过旧缺 `createWorker`、还是原生构建没有浏览器宿主
     * API），而处在单 worker 平台上的调用方需要知道"不能并行"是平台规则，而不是自己配错了。
     */
    readonly capabilityReason: string;

    /**
     * @en Create a worker from a packaged script path. Throws with a precise reason on failure.
     * @zh 从打包好的脚本路径创建 Worker。失败时抛出带精确原因的错误。
     */
    createScriptWorker (path: string): IWorker;

    /**
     * @en Non-destructive capability check for a script path, with a diagnostic reason.
     * @zh 对脚本路径做无副作用的能力检查，并给出诊断原因。
     */
    diagnose (path: string): IWorkerDiagnosis;
}

/**
 * @en Wraps a native Web `Worker` into the [[IWorker]] shape.
 * @zh 把原生 Web `Worker` 包装成 [[IWorker]] 形状。
 * @internal
 */
export class WebWorkerAdapter implements IWorker {
    private _w: Worker;

    constructor (w: Worker) {
        this._w = w;
    }

    public postMessage (message: any, transfer?: Transferable[]): void {
        if (transfer && transfer.length) {
            this._w.postMessage(message, transfer);
        } else {
            this._w.postMessage(message);
        }
    }

    public onMessage (listener: (res: any) => void): void {
        this._w.onmessage = (e): void => { listener(e.data); };
    }

    public onError (listener: (err: any) => void): void {
        this._w.onerror = listener;
    }

    public terminate (): void {
        this._w.terminate();
    }
}

/**
 * @en
 * Wraps the object returned by `minigame.createWorker(path)` into the [[IWorker]] shape.
 *
 * This is where the per-platform differences are absorbed, so nothing above this class needs to know
 * which platform it is on:
 * - `onError` is optional — Huawei quick game does not document it. Guarded, not assumed.
 * - `onProcessKilled` is WeChat-only (iOS experimental worker reclamation) and is routed into the
 *   error listener, so a killed process surfaces as a task failure and the pool can respawn.
 * - The transfer list is passed ONLY when the backend reports `supportsTransfer`. Elsewhere the data
 *   is structured-cloned, and passing a transfer list may throw.
 * @zh
 * 把 `minigame.createWorker(path)` 返回的对象包装成 [[IWorker]] 形状。
 *
 * 平台差异在这一层被吸收，因此该类之上的任何代码都不需要知道自己跑在哪个平台：
 * - `onError` 是可选的——华为快游戏未文档化该接口。做了存在性保护，而非假定存在。
 * - `onProcessKilled` 是微信独有（iOS 实验性 Worker 被系统回收），会被路由进错误监听，
 *   因此进程被杀会表现为任务失败，池可以据此重建。
 * - transfer 列表**仅**在后端自报 `supportsTransfer` 时才传。其余平台走结构化克隆，传 transfer 可能抛错。
 * @internal
 */
export class MinigameWorkerAdapter implements IWorker {
    private _w: any;
    private readonly _supportsTransfer: boolean;
    private _errListener: ((err: any) => void) | null = null;

    constructor (mgWorker: any, supportsTransfer: boolean) {
        this._w = mgWorker;
        this._supportsTransfer = supportsTransfer;
        // WeChat iOS experimental worker: the system can reclaim the worker process at any time.
        // Route it to the error listener so the in-flight task fails loudly instead of hanging.
        if (typeof this._w.onProcessKilled === 'function') {
            this._w.onProcessKilled((err: any): void => {
                if (this._errListener) {
                    this._errListener(err || { message: 'Worker process was killed by the system' });
                }
            });
        }
    }

    public postMessage (message: any, transfer?: Transferable[]): void {
        // Only WeChat V2 honors a transfer list. On every other mini-game platform the payload is
        // structured-cloned, and passing the list may throw — so omit it.
        if (transfer && transfer.length && this._supportsTransfer) {
            this._w.postMessage(message, transfer);
        } else {
            this._w.postMessage(message);
        }
    }

    public onMessage (listener: (res: any) => void): void {
        this._w.onMessage(listener);
    }

    public onError (listener: (err: any) => void): void {
        this._errListener = listener;
        if (typeof this._w.onError === 'function') {
            this._w.onError(listener);
        }
    }

    public terminate (): void {
        this._w.terminate();
    }
}

/**
 * @en The Web backend: real workers, unlimited concurrency, transfer and (function-mode) Blob support.
 * @zh Web 后端：真正的 Worker、无限并发、支持 transfer 与（函数模式的）Blob。
 * @internal
 */
class WebWorkerBackend implements IWorkerBackend {
    public readonly kind: WorkerBackendKind = 'web';
    public readonly concurrencyLimit = Infinity;
    public readonly supportsTransfer = true;
    // Genuinely requires a cross-origin-isolated context; feature-detect rather than assume.
    public readonly supportsSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
    public readonly supportsFunctionWorker = true;
    public readonly capabilityReason = 'a standard global Worker constructor is available, so any '
        + 'number of workers may run concurrently (bounded only by the device\'s cores)';

    public createScriptWorker (path: string): IWorker {
        // eslint-disable-next-line no-restricted-globals
        return new WebWorkerAdapter(new Worker(path));
    }

    public diagnose (path: string): IWorkerDiagnosis {
        if (typeof path !== 'string' || !path) {
            return { ready: false, version: 0, reason: 'worker script path must be a non-empty string' };
        }
        return { ready: true, version: 1, reason: '' };
    }
}

/**
 * @en
 * The mini-game backend, covering all nine platforms through the single `minigame.createWorker` entry.
 * @zh
 * 小游戏后端，通过唯一的 `minigame.createWorker` 入口覆盖全部 9 个平台。
 * @internal
 */
class MinigameWorkerBackend implements IWorkerBackend {
    public readonly kind: WorkerBackendKind = 'minigame';
    public readonly concurrencyLimit: number;
    public readonly supportsTransfer: boolean;
    public readonly supportsSharedArrayBuffer: boolean;
    /** No mini-game platform can build a worker from a serialized string (no Blob, no eval). */
    public readonly supportsFunctionWorker = false;
    /**
     * @en WeChat V2 (standard worker) is the only mini-game generation with multi-worker + transfer.
     * @zh 微信 V2（标准 Worker）是唯一支持多 Worker + transfer 的小游戏代际。
     */
    public readonly isWeChatStandardWorker: boolean;
    /**
     * @en Whether this platform exposes `createWorker` at all (false on Taobao and on old base libraries).
     * @zh 该平台是否暴露 `createWorker`（淘宝与过旧基础库为 false）。
     */
    public readonly hasCreateWorker: boolean;
    public readonly capabilityReason: string;

    constructor () {
        this.hasCreateWorker = typeof (minigame as any).createWorker === 'function';
        // `wx.env.isSupportStandardWorker` is the ONLY way to detect V2: it is in grey release, needs
        // client >= 8.0.66 (Android) + base library >= 3.16.1, and is unsupported in the devtools.
        // Reaching it through `minigame.env` (copied off `wx` by cloneObject) avoids touching `wx`
        // directly from engine code.
        const env = (minigame as any).env;
        this.isWeChatStandardWorker = this.hasCreateWorker
            && !!(env && env.isSupportStandardWorker === true);
        this.supportsTransfer = this.isWeChatStandardWorker;
        this.supportsSharedArrayBuffer = this.isWeChatStandardWorker
            && typeof SharedArrayBuffer !== 'undefined';
        if (!this.hasCreateWorker) {
            // Taobao, or a mini-game base library too old for workers. Report 0 rather than 1 so
            // callers see "no thread available" instead of being told they can offload.
            this.concurrencyLimit = 0;
            this.capabilityReason = 'this mini-game platform exposes no createWorker API and offers no '
                + 'Web Worker fallback, so no separate thread is available';
        } else if (this.isWeChatStandardWorker) {
            this.concurrencyLimit = Infinity;
            this.capabilityReason = 'the WeChat standard (V2) worker is enabled, so multiple workers may '
                + 'run concurrently and transfer lists are honored';
        } else {
            // V1 and every other platform allow exactly one. This is a platform rule, not a
            // misconfiguration — the reason string must say so, or callers will hunt for a bug
            // in their own maxWorkers setting.
            this.concurrencyLimit = 1;
            this.capabilityReason = 'this platform permits exactly ONE worker at a time, so tasks can be '
                + 'moved off the main thread but cannot be computed in parallel. This is a platform '
                + 'limit, not a configuration problem';
        }
    }

    public createScriptWorker (path: string): IWorker {
        const diagnosis = this.diagnose(path);
        if (!diagnosis.ready) {
            throw new Error(`Worker is not available for "${path}": ${diagnosis.reason}`);
        }
        // `createWorker` is optional in the type and returns `undefined` (rather than throwing) when
        // creation fails on Huawei quick game — so the result must be null-checked.
        const created = (minigame as any).createWorker(path);
        if (!created) {
            throw new Error(`createWorker("${path}") returned no worker instance. The script may be `
                + 'missing from the packaged workers directory, or its subpackage has not been '
                + 'downloaded yet (see docs/worker/README.md).');
        }
        return new MinigameWorkerAdapter(created, this.supportsTransfer);
    }

    public diagnose (path: string): IWorkerDiagnosis {
        if (!this.hasCreateWorker) {
            // Two distinct cases deserve distinct messages, because the fix differs:
            // - Taobao mini-game exposes NO worker API at all, and no Web Worker / Blob either, so
            //   there is simply no thread to be had on that platform.
            // - Other mini-game platforms DO have createWorker, but only from a minimum base library
            //   version (Baidu 1.6.1+, Huawei quick game 1117+); an old runtime reports undefined.
            return {
                ready: false,
                version: 0,
                reason: 'this mini-game platform exposes no createWorker API and offers no Web Worker '
                    + 'fallback, so it cannot run tasks on a separate thread. Either the platform has no '
                    + 'worker support at all (Taobao mini-game), or its base library is older than the '
                    + 'version that introduced createWorker',
            };
        }
        if (typeof path !== 'string' || !path) {
            return { ready: false, version: 0, reason: 'worker script path must be a non-empty string' };
        }
        // Every mini-game platform requires a package-relative path; a leading "/" is rejected.
        if (path.charAt(0) === '/') {
            return {
                ready: false,
                version: 0,
                reason: `worker script path must be relative to the package root (no leading "/"): "${path}"`,
            };
        }
        if (!path.endsWith('.js')) {
            return { ready: false, version: 0, reason: `worker script must be a .js file: "${path}"` };
        }
        // Boundary check: the file should exist inside the code package. This catches the most common
        // mistakes — file not packaged, not under the workers directory declared in game.json /
        // manifest.json / app.json, or a subpackage worker referenced before download.
        //
        // IMPORTANT: `accessSync` is a HINT, never an authority. The WeChat devtools simulator does not
        // faithfully expose the code-package filesystem — a `workers` directory newly declared in
        // game.json is routinely invisible to it even when the file is packaged correctly and loads
        // fine. Treating its throw as final therefore condemns a perfectly working setup to the sync
        // fallback. The only check that agrees with what the runtime actually does is `createWorker`
        // itself, so on a throw we fall through to the probe below instead of returning early.
        let accessFailed = false;
        if (typeof minigame.getFileSystemManager === 'function') {
            const fsm = minigame.getFileSystemManager();
            try {
                fsm.accessSync(path);
                // Best-effort content sanity check: an empty file can never speak the protocol.
                try {
                    const st = (fsm as any).statSync(path);
                    if (st && typeof st.size === 'number' && st.size <= 0) {
                        return { ready: false, version: 0, reason: `worker script "${path}" is empty` };
                    }
                } catch (e) {
                    // statSync may be unavailable for some package paths; existence was already confirmed.
                }
            } catch (e) {
                accessFailed = true;
            }
        }
        if (accessFailed) {
            const probe = this.probeScript(path);
            if (!probe.ok) {
                return {
                    ready: false,
                    version: 0,
                    reason: `worker script "${path}" could not be loaded (createWorker ${probe.error}) — `
                        + 'make sure it is placed inside the workers directory declared in game.json '
                        + '(WeChat) / manifest.json (quick game) / app.json, and that its subpackage '
                        + 'has been downloaded first if it lives in one',
                };
            }
        }
        return { ready: true, version: this.isWeChatStandardWorker ? 2 : 1, reason: '' };
    }

    /**
     * @en
     * Create-then-immediately-terminate a worker for `path`, purely to learn whether the runtime can
     * load that script. This is the authoritative check: it exercises exactly the code path a real
     * worker takes, so unlike `accessSync` it stays correct on hosts whose filesystem APIs disagree
     * with the worker loader (notably the WeChat devtools simulator).
     *
     * The handle is terminated before returning because V1 platforms permit exactly ONE concurrent
     * worker — a leaked probe would permanently block every real worker afterwards. Note the probe
     * therefore momentarily occupies that single slot; it is only ever run when `accessSync` has
     * already failed, which on a real device means a genuinely missing script rather than a simulator
     * false negative.
     * @zh
     * 为 `path` 创建并立即销毁一个 Worker，仅用于探明运行时能否加载该脚本。这是权威判据：它走的正是
     * 真实 Worker 的加载路径，因此与 `accessSync` 不同，在文件系统 API 与 Worker 加载器不一致的宿主
     * （尤其是微信开发者工具模拟器）上依然正确。
     *
     * 返回前必须 terminate：V1 平台只允许同时存在一个 Worker，探针泄漏会永久堵死后续所有真实 Worker。
     * 注意探针会短暂占用这唯一的槽位；它只在 `accessSync` 已经失败时才运行——在真机上这意味着脚本
     * 确实缺失，而非模拟器的假阴性。
     * @internal
     */
    private probeScript (path: string): { ok: boolean; error: string } {
        let created: any;
        try {
            created = (minigame as any).createWorker(path);
        } catch (e: any) {
            return { ok: false, error: (e && e.message) ? `threw: ${e.message}` : `threw: ${String(e)}` };
        }
        // Huawei quick game returns `undefined` instead of throwing when creation fails.
        if (!created) {
            return { ok: false, error: 'returned no worker instance' };
        }
        try {
            created.terminate();
        } catch (e) {
            // Best effort — a successful create already proved the script loads.
        }
        return { ok: true, error: '' };
    }
}

/**
 * @en The null backend: no worker of any kind. Callers must degrade to synchronous execution.
 * @zh 空后端：完全不支持 Worker。调用方必须降级为同步执行。
 * @internal
 */
class NoneWorkerBackend implements IWorkerBackend {
    public readonly kind: WorkerBackendKind = 'none';
    public readonly concurrencyLimit = 0;
    public readonly supportsTransfer = false;
    public readonly supportsSharedArrayBuffer = false;
    public readonly supportsFunctionWorker = false;
    public readonly capabilityReason = 'neither a platform createWorker nor a global Worker constructor '
        + 'is available, so no separate thread exists. This is expected on native platforms (JavaScript '
        + 'runs inside an embedded engine with no browser host API)';

    public createScriptWorker (path: string): IWorker {
        throw new Error(`Worker is not supported in the current environment (cannot create "${path}")`);
    }

    public diagnose (_path: string): IWorkerDiagnosis {
        return { ready: false, version: 0, reason: 'no worker backend is available on this platform' };
    }
}

let _backend: IWorkerBackend | undefined;
// eslint-disable-next-line @typescript-eslint/naming-convention
let _WebWorkerCtor: typeof Worker | undefined | null;

/**
 * @en
 * Resolve the worker backend for the current platform. Cached for the lifetime of the module.
 *
 * Selection order, purely by runtime capability:
 *  1. The platform is a mini-game platform → mini-game backend. This covers all nine platforms,
 *     INCLUDING Taobao, which has no worker API at all: selecting it anyway is what produces the
 *     precise "this platform has no createWorker" diagnostic instead of a generic one.
 *  2. Global `Worker` exists → Web backend (Web, and devtools environments that provide one).
 *  3. Otherwise → none (native platforms).
 *
 * The mini-game check comes FIRST on purpose: a WeChat devtools build can expose a global `Worker`
 * while `wx.createWorker` is the only thing that actually works in production there.
 * @zh
 * 解析当前平台的 Worker 后端。结果在模块生命周期内缓存。
 *
 * 选择顺序完全依据运行时能力：
 *  1. 平台是小游戏平台 → 小游戏后端。这覆盖全部 9 个平台，**包括完全没有 Worker API 的淘宝**：
 *     刻意仍选中它，正是为了给出精确的"该平台没有 createWorker"诊断，而非泛化信息。
 *  2. 全局 `Worker` 存在 → Web 后端（Web，以及提供了 Worker 的开发者工具环境）。
 *  3. 否则 → none（原生平台）。
 *
 * 小游戏检查**刻意放在最前**：微信开发者工具的构建可能暴露全局 `Worker`，
 * 但生产环境下那里真正可用的只有 `wx.createWorker`。
 * @internal
 */
export function getWorkerBackend (): IWorkerBackend {
    if (_backend) {
        return _backend;
    }
    // "Is this a mini-game platform?" is decided by a capability EVERY mini-game adapter has and
    // non-minigame.js ({}) does not: getSystemInfoSync. It is independent of worker support, which is
    // the point — Taobao is a mini-game platform with NO worker API, and must still get the precise
    // mini-game diagnostic instead of a generic "no backend" message.
    const isMinigamePlatform = typeof (minigame as any).createWorker === 'function'
        || typeof (minigame as any).getSystemInfoSync === 'function';
    if (isMinigamePlatform) {
        _backend = new MinigameWorkerBackend();
        _WebWorkerCtor = null;
        return _backend;
    }
    // eslint-disable-next-line no-restricted-globals
    if (typeof Worker !== 'undefined') {
        _backend = new WebWorkerBackend();
        // eslint-disable-next-line no-restricted-globals
        _WebWorkerCtor = Worker;
        return _backend;
    }
    _backend = new NoneWorkerBackend();
    _WebWorkerCtor = null;
    return _backend;
}

/**
 * @en
 * A plain-data snapshot of what the current platform can do with workers.
 *
 * This is the single call a gameplay or feature layer should use to decide whether to enable a
 * worker-backed feature at all — it answers "is there a thread, and is there PARALLELISM" without
 * exposing any platform identity.
 * @zh
 * 当前平台 Worker 能力的纯数据快照。
 *
 * 这是玩法层/特性层用来决定"要不要开启某个 Worker 特性"的唯一入口——它回答"有没有线程、有没有**并行能力**"，
 * 而不暴露任何平台身份。
 */
export interface IWorkerCapabilities {
    /** @en `'web'` | `'minigame'` | `'none'`. @zh `'web'` | `'minigame'` | `'none'`。 */
    kind: WorkerBackendKind;
    /** @en Whether any worker exists at all (`concurrencyLimit > 0`). @zh 是否完全存在 Worker（`concurrencyLimit > 0`）。 */
    available: boolean;
    /**
     * @en
     * Whether MORE THAN ONE worker may run concurrently. `false` on seven of the nine mini-game
     * platforms even though a worker exists — the decisive distinction between "offload a long task
     * off the main thread" and "actually compute in parallel".
     * @zh
     * 能否并发运行**多于一个** Worker。9 个小游戏平台中有 7 个为 `false`，即便它们确实有 Worker——
     * 这正是"把长任务从主线程挪走"与"真正并行计算"之间的决定性区别。
     */
    parallel: boolean;
    /** @en Maximum concurrent workers. `Infinity` = effectively unlimited. @zh 并发 Worker 上限。`Infinity` = 实际上无限制。 */
    concurrencyLimit: number;
    /** @en Whether `postMessage`'s transfer list is honored (Web, WeChat V2 only). @zh `postMessage` 的 transfer 列表是否生效（仅 Web、微信 V2）。 */
    supportsTransfer: boolean;
    /** @en Whether `SharedArrayBuffer` zero-copy channels are usable. @zh 能否使用 `SharedArrayBuffer` 零拷贝通道。 */
    supportsSharedArrayBuffer: boolean;
    /** @en Whether a worker can be built from a serialized function (Web only). @zh 能否从序列化函数构建 Worker（仅 Web）。 */
    supportsFunctionWorker: boolean;
    /**
     * @en
     * Why the capability level is what it is. Never empty. Intended for logging and for telling the
     * developer whether "no parallelism" is a platform rule they must design around, or a packaging /
     * base-library problem they can fix.
     * @zh
     * 说明能力等级为何如此。永不为空。用于日志，以及告诉开发者"不能并行"究竟是他必须绕开的平台规则，
     * 还是可以自己修复的打包 / 基础库问题。
     */
    reason: string;
}

/**
 * @en
 * Snapshot the current platform's worker capabilities.
 *
 * The `parallel` field exists because `available` alone is misleading: Taobao has no worker, native
 * platforms have no worker, but ByteDance / Alipay / Baidu / Huawei / OPPO / vivo / Xiaomi / WeChat V1
 * all have EXACTLY ONE. For those eight, a pool cannot speed anything up by splitting work — it can
 * only move work off the main thread. A feature that needs true parallelism (e.g. splitting a mesh
 * bake across cores) must gate on `parallel`, not on `available`.
 *
 * @zh
 * 快照当前平台的 Worker 能力。
 *
 * `parallel` 字段之所以存在，是因为仅有 `available` 会产生误导：淘宝没有 Worker、原生平台没有 Worker，
 * 但抖音 / 支付宝 / 百度 / 华为 / OPPO / vivo / 小米 / 微信 V1 **都恰好只有 1 个**。对这 8 种情况，
 * 池无法通过拆分任务来加速——它只能把工作从主线程挪走。需要真并行的特性（例如把网格烘焙拆分到多核）
 * 必须以 `parallel` 为准，而不是 `available`。
 *
 * @example
 * ```ts
 * const caps = getWorkerCapabilities();
 * if (!caps.available) {
 *     // No thread at all (Taobao, native): disable the feature or degrade quality instead.
 * } else if (!caps.parallel) {
 *     // One worker: still worth offloading a long blocking task, but do not split work into chunks.
 * } else {
 *     // Real parallelism: size the pool from getOptimalWorkerCount().
 * }
 * ```
 */
export function getWorkerCapabilities (): IWorkerCapabilities {
    const backend = getWorkerBackend();
    return {
        kind: backend.kind,
        available: backend.concurrencyLimit > 0,
        parallel: backend.concurrencyLimit > 1,
        concurrencyLimit: backend.concurrencyLimit,
        supportsTransfer: backend.supportsTransfer,
        supportsSharedArrayBuffer: backend.supportsSharedArrayBuffer,
        supportsFunctionWorker: backend.supportsFunctionWorker,
        reason: backend.capabilityReason,
    };
}

/**
 * @en
 * The `Worker` constructor, when function-mode workers are possible. `null` otherwise.
 * Exposed for [[createWorker]]'s function mode, which must serialize into a Blob URL.
 * @zh
 * 当函数模式 Worker 可用时返回 `Worker` 构造器，否则为 `null`。
 * 供 [[createWorker]] 的函数模式使用——它需要序列化进 Blob URL。
 * @internal
 */
export function getWebWorkerCtor (): typeof Worker | null {
    getWorkerBackend();
    return _WebWorkerCtor ?? null;
}

/**
 * @en
 * Drop the cached backend so the next [[getWorkerBackend]] call re-probes the platform.
 *
 * Needed because capabilities can legitimately change at runtime: a WeChat subpackage containing the
 * worker script may finish downloading after the first probe, and the `useExperimentalWorker` path can
 * be re-created after `onProcessKilled`. Without this, a pool that probed too early stays locked to a
 * worse backend for its whole lifetime.
 * @zh
 * 丢弃已缓存的后端，使下一次 [[getWorkerBackend]] 重新探测平台。
 *
 * 之所以需要，是因为能力确实可能在运行时变化：包含 worker 脚本的微信分包可能在首次探测之后才下载完成，
 * `useExperimentalWorker` 路径也可能在 `onProcessKilled` 之后被重建。没有这个入口，
 * 探测过早的池会在整个生命周期里被锁死在更差的后端上。
 * @internal
 */
export function resetWorkerBackendCache (): void {
    _backend = undefined;
    _WebWorkerCtor = undefined;
}

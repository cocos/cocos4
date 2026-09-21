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

import {
    WorkerTask, IWorker, getOptimalWorkerCount,
    getWorkerBackend, resetWorkerBackendCache,
} from './worker';
import type { IPlatformWorkerBackend } from 'pal/worker';
import { warn } from '../core/platform/debug';

/** Execution state, independent of the host platform. */
export type WorkerExecutionMode = 'worker' | 'sync' | 'none';

/**
 * @en
 * Infrastructure failures (a worker that never replies / times out, errors out, fails to spawn, or
 * speaks a malformed protocol) tolerated before a script-mode pool gives up on the real worker and
 * degrades to single-threaded execution via `options.fallback`. Kept at 1: each of these signals
 * means the worker backend is not functioning for this script, so retrying on a real worker would
 * only fail again — and on the seven single-worker mini-game platforms a retry would also re-occupy
 * the one worker slot. A task-level computation error (the worker replies `{ ok: false }`) is NOT an
 * infrastructure failure and never counts toward this.
 * @zh
 * 脚本模式的池在放弃真 Worker、降级为 `options.fallback` 单线程执行之前，所能容忍的**基础设施失败**
 * 次数（Worker 永不回复 / 超时、报错、创建失败、或回发非法协议）。取 1：上述任一信号都意味着该脚本的
 * Worker 后端不可用，再用真 Worker 重试只会再次失败——而且在 7 个单 Worker 小游戏平台上重试还会重新
 * 占掉那唯一的槽位。任务级计算错误（Worker 回发 `{ ok: false }`）**不算**基础设施失败，不计入此数。
 */
const DEGRADE_AFTER_FAILURES = 1;

/**
 * @en Options for [[WorkerPool]].
 * @zh [[WorkerPool]] 的选项。
 */
export interface WorkerPoolOptions {
    /**
     * @en
     * Maximum number of concurrent workers. Extra tasks are queued and dispatched when a worker frees up.
     * Default is `1`.
     * @zh
     * 并发 Worker 的最大数量。多余的任务会排队，等某个 Worker 空闲后再派发。默认 `1`。
     */
    maxWorkers?: number;
    /**
     * @en
     * Idle release time in milliseconds. An idle worker is terminated after being idle for this long,
     * to avoid keeping threads (and their memory) alive forever. Set to `0` to never release idle workers.
     * Default is `1000` (1 second).
     * @zh
     * 空闲释放时间（毫秒）。Worker 空闲超过该时长后会被终止，避免线程（及其内存）长期驻留。
     * 设为 `0` 表示永不释放空闲 Worker。默认 `1000`（1 秒）。
     */
    idleReleaseAfter?: number;
    /**
     * @en
     * Synchronous fallback task (**script mode only**). It must compute the same result as the worker
     * script's `runTask(args)` from the same `args`. When NO worker backend is available at all —
     * the platform worker environment is not fully set up ([[checkWorkerScript]] not ready), or the
     * platform has no worker API (Taobao mini-game, native) and there is no global `Worker` either —
     * tasks run single-threaded on the main thread with this function instead of rejecting. If omitted
     * in that situation, `run()` rejects with a descriptive error.
     * Runtime failures retry non-transferred arguments only. Transferred tasks reject because
     * ownership has moved; subsequent tasks use this fallback. Fallback computation must be retry-safe.
     * @zh
     * 同步降级任务函数（**仅脚本模式**）。它必须与 worker 脚本里的 `runTask(args)` 用相同的 `args`
     * 算出相同的结果。当所有 Worker 后端都不可用时——平台 Worker 环境未设置完整
     * （[[checkWorkerScript]] 不 ready），或平台根本没有 Worker API（淘宝小游戏、原生）且也没有全局
     * `Worker`——任务将用它在主线程**单线程**执行，而不是直接 reject。若此时未提供该函数，
     * `run()` 会以带说明的错误 reject。
     * 运行时失败仅重试未移交所有权的参数；已 transfer 的任务拒绝，后续任务仍使用 fallback。
     * fallback 应为可安全重试的计算逻辑。
     */
    fallback?: WorkerTask;
    /**
     * @en
     * Per-task timeout in milliseconds. When exceeded, the task rejects with a timeout error and the
     * worker running it is terminated so the pool spawns a fresh one.
     *
     * Default is `0` (no timeout). A timeout is the ONLY safety net against a worker that never
     * replies — a worker script that fails to post back, or a worker silently reclaimed by the
     * platform. Some platforms make this materially more likely: not every mini-game platform exposes
     * `onError` (Huawei quick game documents only create/postMessage/onMessage/terminate), so an
     * internal failure there produces no error event at all.
     *
     * Recommended for script mode in production: pick a bound well above your worst-case task duration.
     * @zh
     * 单个任务的超时时间（毫秒）。超时后任务以超时错误 reject，运行它的 Worker 会被终止，
     * 池随后重建一个。
     *
     * 默认 `0`（不超时）。超时是对"Worker 永不回复"的**唯一**兜底——比如 Worker 脚本忘记回发结果，
     * 或 Worker 被平台静默回收。部分平台让这种情况更容易发生：并非每个小游戏平台都暴露 `onError`
     * （华为快游戏只文档化了 create/postMessage/onMessage/terminate），那里的内部失败根本不会产生错误事件。
     *
     * 生产环境的脚本模式建议设置超时：取一个明显高于最坏情况任务耗时的上界。
     */
    timeout?: number;
}

/**
 * @en
 * A pool of workers bound to a single self-contained task function (function mode) or to a
 * pre-packaged worker script (script mode — the only way to get a real worker on any mini-game
 * platform, because they forbid rebuilding a function from source).
 *
 * It is designed for *high-frequency* workloads (e.g. per-frame physics / crowd simulation / data processing):
 * instead of spawning and tearing down a worker for every call — which costs a Blob URL round-trip and
 * thread startup — the pool keeps a bounded set of workers alive and reuses them, releasing idle workers
 * after [[WorkerPoolOptions.idleReleaseAfter]].
 *
 * IMPORTANT — a pool is not always a source of parallelism. On seven of the nine mini-game platforms
 * (ByteDance, Alipay, Baidu, Huawei, OPPO, vivo, Xiaomi) and on WeChat V1, the platform allows exactly
 * ONE worker, so the pool is capped to one worker no matter what `maxWorkers` says. There it is an
 * **asynchronous offload queue**: it keeps a long task off the main thread, but it cannot run two tasks
 * at once. Gate features that need true parallelism on
 * [[getWorkerCapabilities]]`()`.parallel, not on whether a worker exists.
 *
 * In function mode, on platforms that cannot build a worker from a serialized string (every mini-game
 * platform, and native) each task simply runs synchronously on the main thread, so the pool is a
 * transparent no-op wrapper. To get a real worker on a mini-game platform, use script mode:
 * `new WorkerPool('workers/my-task/index.js')` — the pool then creates its worker from a pre-packaged
 * script via `minigame.createWorker` (see the constructor and the bundled template).
 *
 * For *CPU-bound* workloads on a genuinely parallel platform, pass [[getOptimalWorkerCount]] as
 * `maxWorkers` to parallelize across the available cores (leaving one core for the main thread). Note
 * that `maxWorkers` only matters when you submit several independent tasks concurrently — a single
 * queued task always uses exactly one worker.
 *
 * @zh
 * 绑定到单个自包含任务函数（函数模式）或预打包 Worker 脚本（脚本模式——这是在任何小游戏平台上获得
 * 真 Worker 的**唯一**方式，因为它们禁止用源码重建函数）的 Worker 池。
 *
 * 它面向*高频*负载（如逐帧的物理模拟、人群模拟、数据处理）：与其每次调用都创建再销毁一个 Worker——
 * 那会付出 Blob URL 往返和线程启动的成本——池会保活一个有上限的 Worker 集合并复用，
 * 空闲超过 [[WorkerPoolOptions.idleReleaseAfter]] 的 Worker 会被释放。
 *
 * **重要——池并不总是并行来源。** 9 个小游戏平台中有 7 个（抖音、支付宝、百度、华为、OPPO、vivo、小米）
 * 以及微信 V1，平台只允许**恰好 1 个** Worker，因此无论 `maxWorkers` 传什么，池都会被封顶到 1 个。
 * 在这些平台上它是一个**异步卸载队列**：能把长任务从主线程挪走，但无法同时跑两个任务。
 * 需要真并行的特性，请以 [[getWorkerCapabilities]]`()`.parallel 为准，而不是以"有没有 Worker"为准。
 *
 * 在函数模式下，凡是无法从序列化字符串构建 Worker 的平台（全部小游戏平台、原生），每个任务直接在主线程
 * 同步执行，因此池是一个透明的空包装。小游戏平台上若要真 Worker，请用脚本模式：
 * `new WorkerPool('workers/my-task/index.js')`——池会通过 `minigame.createWorker`
 * 从预打包脚本创建 Worker（参见构造函数与随附模板）。
 *
 * 对于*真正可并行*平台上的 *CPU 密集型*负载，可将 [[getOptimalWorkerCount]] 作为 `maxWorkers` 传入，
 * 跨可用核心并行（给主线程留一个核心）。注意：只有当你*同时*提交多个独立任务时 `maxWorkers` 才起作用——
 * 单个排队任务始终只用一个 Worker。
 *
 * @example
 * Function mode (Web real-parallel; mini-game / native transparent sync fallback):
 * ```ts
 * const pool = new WorkerPool((n: number) => {
 *     let acc = 0;
 *     for (let i = 0; i < n; i++) acc += Math.sqrt(i);
 *     return acc;
 * }, { maxWorkers: getOptimalWorkerCount(), idleReleaseAfter: 1000 });
 *
 * const result = await pool.run([1_000_000]);
 * // ...
 * pool.terminate();
 * ```
 *
 * Script mode (a real worker on Web AND every mini-game platform that has one):
 * ```ts
 * // Backend chain resolved at construction: platform worker (only when fully set up — see
 * // checkWorkerScript) → global Worker → single-threaded via options.fallback → run() rejects.
 * // Pool size is auto-capped by the platform: 1 worker on the seven single-worker platforms and
 * // WeChat V1; up to maxWorkers on WeChat V2 and Web.
 * // On WeChat V2 pass an explicit maxWorkers to scale beyond 1 (core count is not detectable there).
 * const pool = new WorkerPool('workers/heavy-compute/index.js', {
 *     maxWorkers: 4,
 *     // Optional: same computation as the worker script's runTask(args), used single-threaded
 *     // when no worker backend is available at all. Without it, run() would reject there.
 *     fallback: (n: number) => { let acc = 0; for (let i = 0; i < n; i++) acc += Math.sqrt(i); return acc; },
 * });
 * const result = await pool.run([1_000_000]);
 * pool.terminate();
 * ```
 */
export class WorkerPool {
    private readonly _fn: WorkerTask | null;
    private readonly _script: string | null;
    private readonly _fallback: WorkerTask | null;
    private readonly _idleReleaseAfter: number;
    private readonly _timeout: number;
    private readonly _explicitMax: number;
    private _maxWorkers: number;
    /** Execution state only; platform selection and identity belong to PAL. */
    private _executionMode: WorkerExecutionMode;
    private _activeBackend: IPlatformWorkerBackend | null = null;
    private _scriptFailureHint = '';
    private _backendReason: string;
    private _workers: PooledWorker[] = [];
    private _queue: PoolTask[] = [];
    private _released = false;
    private _draining = false;
    private _taskId = 0;
    /**
     * @en Consecutive infrastructure failures on the real worker backend. Reset by [[WorkerPool.recheck]].
     * Reaching [[DEGRADE_AFTER_FAILURES]] triggers degradation to single-threaded sync execution.
     * @zh 真 Worker 后端上累计的基础设施失败次数。[[WorkerPool.recheck]] 会重置；达到
     * [[DEGRADE_AFTER_FAILURES]] 即触发降级为单线程同步执行。
     */
    private _infraFailures = 0;
    /** @en Whether this pool has degraded to single-threaded sync execution. @zh 本池是否已降级为单线程同步执行。 */
    private _degraded = false;
    /** @en Guards against spamming the degradation warning (warn at most once per pool). @zh 防止重复刷降级警告（每池至多警告一次）。 */
    private _degradeWarned = false;
    /**
     * @en Guards the CONSTRUCTION-time degradation warning (at most once per pool, even across
     * [[WorkerPool.recheck]] re-resolutions). @zh 防止重复刷**构造期**降级警告（每池至多一次，即便
     * [[WorkerPool.recheck]] 反复重解析）。
     */
    private _constructionWarned = false;

    /**
     * @en
     * Create a pool from a self-contained function or a packaged script path.
     * PAL selects a usable script backend and its concurrency limit. When no backend is
     * available, script tasks use options.fallback; without it, run() rejects with PAL's reason.
     * Function tasks use a worker when PAL supports them, otherwise they execute inline.
     * Scripts receive `{ id, args }` and reply with `{ id, ok, value }` or `{ id, ok: false, error }`.
     * @zh
     * 使用独立函数或已打包的脚本路径创建任务池。脚本后端的选择和并发上限由 PAL 提供。
     * 没有可用后端时，脚本任务执行 options.fallback；未提供则携带 PAL 的诊断原因拒绝任务。
     * 函数任务在 PAL 支持时使用 Worker，否则在主线程执行。
     * 脚本接收 `{ id, args }`，回复 `{ id, ok, value }` 或 `{ id, ok: false, error }`。
     */
    constructor (fnOrScript: WorkerTask | string, options?: WorkerPoolOptions) {
        const isScriptMode = typeof fnOrScript === 'string';
        if (isScriptMode) {
            if (!fnOrScript) {
                throw new TypeError('WorkerPool script path must be a non-empty string');
            }
            this._script = fnOrScript;
            this._fn = null;
        } else {
            if (typeof fnOrScript !== 'function') {
                throw new TypeError('WorkerPool requires a self-contained task function or a worker script path');
            }
            this._fn = fnOrScript;
            this._script = null;
        }

        const rawFallback = options ? options.fallback : undefined;
        this._fallback = typeof rawFallback === 'function' ? rawFallback : null;

        const rawMax = options ? options.maxWorkers : undefined;
        // An explicit, valid pool size (>= 1). 0 means "not specified" so we can apply a default below.
        this._explicitMax = (typeof rawMax === 'number' && Number.isFinite(rawMax) && rawMax >= 1)
            ? Math.floor(rawMax)
            : 0;

        const rawTimeout = options ? options.timeout : undefined;
        this._timeout = (typeof rawTimeout === 'number' && Number.isFinite(rawTimeout) && rawTimeout > 0)
            ? rawTimeout
            : 0;

        // Use `??` so an explicit `0` (meaning "never release idle workers") is preserved.
        this._idleReleaseAfter = (options && options.idleReleaseAfter !== undefined)
            ? options.idleReleaseAfter
            : 1000;

        this._executionMode = 'none';
        this._backendReason = '';
        this._maxWorkers = 0;
        this._resolveBackend();
    }

    /**
     * @en
     * (Re-)resolve which execution backend this pool uses, and cap the pool size accordingly.
     *
     * Split out of the constructor so [[WorkerPool.recheck]] can run it again later. Resolution is
     * driven purely by runtime capability, never by a compile-time platform constant — branching on
     * `WECHAT` is what left seven mini-game platforms with a working `createWorker` falling through to
     * synchronous execution.
     * @zh
     * （重新）解析本池使用哪个执行后端，并据此封顶池大小。
     *
     * 从构造函数中拆出，以便 [[WorkerPool.recheck]] 之后能再次调用。解析完全由**运行时能力**驱动，
     * 绝不依赖编译期平台常量——正是对 `WECHAT` 的分支判断，让 7 个拥有可用 `createWorker` 的
     * 小游戏平台掉进了同步执行。
     */
    private _resolveBackend (): void {
        const platform = getWorkerBackend();
        const explicitMax = this._explicitMax;
        const desired = explicitMax > 0 ? explicitMax : getOptimalWorkerCount();
        this._activeBackend = null;
        this._scriptFailureHint = platform.scriptFailureHint;
        this._backendReason = '';

        if (this._script) {
            const resolved = platform.resolveScriptWorker(this._script);
            if (resolved.backend) {
                this._executionMode = 'worker';
                this._activeBackend = resolved.backend;
                this._scriptFailureHint = resolved.backend.scriptFailureHint;
                this._maxWorkers = Math.min(desired, resolved.backend.concurrencyLimit);
            } else if (this._fallback) {
                this._executionMode = 'sync';
                this._maxWorkers = 1;
                this._warnConstructionDegrade(resolved.warnOnFailure, resolved.diagnosis.reason);
            } else {
                this._executionMode = 'none';
                this._maxWorkers = 0;
                this._backendReason = `No worker backend for "${this._script}" (${resolved.diagnosis.reason}). `
                    + 'Provide options.fallback to run single-threaded, or fix packaging (docs/worker/README.md).';
                this._warnConstructionDegrade(resolved.warnOnFailure, resolved.diagnosis.reason);
            }
        } else if (platform.supportsFunctionWorker) {
            this._executionMode = 'worker';
            this._activeBackend = platform;
            this._maxWorkers = Math.min(explicitMax > 0 ? explicitMax : 1, platform.concurrencyLimit);
        } else {
            this._executionMode = 'sync';
            this._maxWorkers = 1;
        }
    }

    /**
     * @en
     * Re-probe the platform and re-resolve the execution backend.
     *
     * The backend is normally decided once, at construction. That is wrong whenever capability appears
     * LATER, which really happens:
     * - the worker script lives in a WeChat subpackage that finishes downloading after the pool was
     *   created — `diagnose()` failed at construction because the file did not exist yet;
     * - the base library hot-updates, or `wx.env.isSupportStandardWorker` flips as the V2 grey release
     *   rolls out to the device.
     *
     * Without this, a pool that probed too early stays locked to `'sync'`/`'none'` for its entire
     * lifetime even though a real worker is now available.
     *
     * Idle executors are retired; busy executors finish their current task and are then retired.
     * Queued tasks use the newly selected backend, or reject if it is unavailable without a fallback.
     * Transferred tasks cannot be replayed after failure because ownership has already moved.
     *
     * @returns the execution state: `'worker'`, `'sync'` or `'none'`.
     * @zh
     * 重新探测平台并重新解析执行后端。
     *
     * 后端通常只在构造时决定一次。但只要能力是**之后**才出现的，这就错了，而这确实会发生：
     * - worker 脚本位于微信分包中，该分包在池创建之后才下载完成——构造时 `diagnose()` 因文件尚不存在而失败；
     * - 基础库热更新，或随着 V2 灰度推送到该设备，`wx.env.isSupportStandardWorker` 发生翻转。
     *
     * 没有这个入口，探测过早的池会在整个生命周期里被锁死在 `'sync'`/`'none'` 上，
     * 即便真 Worker 现在已经可用。
     *
     * 空闲执行器立即释放，忙碌执行器完成当前任务后释放。排队任务交给新后端；
     * 若新后端不可用且没有 fallback，则拒绝排队任务。已移交所有权的任务失败后不能重放。
     *
     * @returns 当前执行状态：`'worker'`、`'sync'` 或 `'none'`。
     */
    public recheck (): WorkerExecutionMode {
        if (this._released) {
            return this.backend;
        }
        // Give the real worker backend another chance: a subpackage may have finished downloading or
        // the base library may have hot-updated since we degraded. Reset the failure budget so the
        // fresh probe starts clean. (_degradeWarned stays sticky to avoid log spam across rechecks.)
        this._infraFailures = 0;
        this._degraded = false;
        // Drop the cached platform probe so the next read reflects the current environment.
        resetWorkerBackendCache();
        this._resolveBackend();

        // New tasks must use the newly resolved backend. Busy workers finish their current
        // task, but are never reused after this capability check.
        this._retireWorkers();
        this._drain();
        return this.backend;
    }

    private _retireWorkers (): void {
        for (let i = this._workers.length - 1; i >= 0; i--) {
            const worker = this._workers[i];
            worker.retired = true;
            if (!worker.busy) {
                this._workers.splice(i, 1);
                worker.dispose();
            }
        }
    }

    /**
     * @en Current execution state: worker, synchronous fallback, or unavailable.
     * @zh 当前执行状态：Worker、主线程同步回退，或不可用。
     */
    public get backend (): WorkerExecutionMode {
        return this._executionMode;
    }

    /**
     * @en
     * The resolved parallel worker count this pool will actually run tasks on
     * (already clamped by the platform concurrency limit and the hardware estimate).
     * Callers doing manual chunking should size their chunk count to this value so that chunks map
     * 1:1 onto real parallel workers, instead of queueing serially on a single worker (e.g. WeChat V1,
     * where `concurrencyLimit` is 1) and multiplying the per-frame round-trip latency.
     * @zh
     * 池实际会用于并行执行任务的 worker 数（已计入平台并发上限与硬件核数估计）。
     * 手动分块的调用方应按此值确定分块数，使分块与真实并行 worker 一一对应；否则在单 worker 平台
     * （如微信 V1，`concurrencyLimit` 为 1）上多块会串行排队，成倍放大每帧往返延迟。
     */
    public get concurrency (): number {
        return this._maxWorkers;
    }

    /**
     * @en
     * Queue a task and resolve with its return value when it completes.
     * If a worker is free (or the pool is under `maxWorkers`), the task starts immediately;
     * otherwise it waits in the queue.
     * @zh
     * 排队一个任务，完成时用其返回值 resolve。
     * 如果有空闲 Worker（或池中 Worker 数未达到 `maxWorkers`），任务立即开始；否则在队列中等待。
     * @param args Arguments passed to the task function. 传给任务函数的参数。
     * @param transfer Transferable objects to transfer to the worker. 零拷贝转移到 Worker 的对象。
     */
    public run<TResult = unknown> (args?: unknown[], transfer?: Transferable[]): Promise<TResult> {
        return new Promise<TResult>((resolve, reject) => {
            if (this._released) {
                reject(new Error('WorkerPool has been terminated'));
                return;
            }
            if (this._executionMode === 'none') {
                // Script mode, but no worker backend is available (WeChat worker not fully set up,
                // no global Worker) and no options.fallback was provided — we cannot proceed.
                reject(new Error(this._backendReason || 'WorkerPool has no available execution backend'));
                return;
            }
            this._queue.push({
                args: args || [],
                transfer: transfer || [],
                resolve: (value: unknown): void => resolve(value as TResult),
                reject,
            });
            this._drain();
        });
    }

    /**
     * @en
     * Terminate all workers immediately and reject all pending tasks.
     * @zh
     * 立即终止所有 Worker，并拒绝所有排队中的任务。
     */
    public terminate (): void {
        if (this._released) {
            return;
        }
        this._released = true;

        const error = new Error('WorkerPool has been terminated');
        for (const task of this._queue) {
            task.reject(error);
        }
        this._queue.length = 0;

        for (const w of this._workers) {
            w.dispose();
        }
        this._workers.length = 0;
    }

    private _drain (): void {
        if (this._released || this._draining) return;
        this._draining = true;
        try {
            if (this._executionMode === 'none') {
                const pending = this._queue.splice(0);
                for (const task of pending) task.reject(new Error(this._backendReason));
                return;
            }
            while (this._queue.length > 0) {
                let worker = this._findIdleWorker();
                if (!worker && this._workers.length < this._maxWorkers) {
                    try {
                        worker = this._spawnWorker();
                    } catch (err) {
                        // Script-mode worker creation can throw synchronously (e.g. the path is not
                        // packaged into the `workers` directory, or a subpackage has not been downloaded).
                        // Treat it as an infrastructure failure: degrade so we stop respawning a broken
                        // backend, and re-run this task via the fallback when one exists (otherwise reject
                        // it). Keep draining either way so the remaining tasks are not left hanging.
                        const failed = this._queue.shift();
                        this._onInfraFailure(failed || null, err as Error);
                        continue;
                    }
                    if (worker) {
                        this._workers.push(worker);
                    }
                }
                if (!worker) {
                    // No free worker and already at maxWorkers: wait for a completion callback.
                    return;
                }
                const task = this._queue.shift();
                if (task) {
                    this._dispatch(worker, task);
                }
            }
        } finally {
            this._draining = false;
        }
    }

    private _findIdleWorker (): PooledWorker | null {
        for (const w of this._workers) {
            if (!w.busy && !w.retired) {
                return w;
            }
        }
        return null;
    }

    private _spawnWorker (): PooledWorker {
        let worker: IWorker | null = null;
        let fn = this._fn;
        if (this._script) {
            if (this._executionMode === 'worker') {
                // Use the exact backend PAL selected, so creation matches its concurrency and capabilities.
                worker = this._activeBackend!.createScriptWorker(this._script);
            } else {
                // 'sync' backend (no worker at all): run the user-provided fallback inline.
                // ('none' never reaches here — run() rejects before queuing.)
                fn = this._fallback;
            }
        } else if (this._executionMode === 'worker') {
            worker = this._activeBackend!.createFunctionWorker(this._fn!);
            if (!worker) {
                // Capability disappeared before creation. Do not silently report a worker pool
                // while scheduling multiple inline executors.
                this._executionMode = 'sync';
                this._maxWorkers = 1;
                this._retireWorkers();
            }
        }
        // A null `worker` leaves PooledWorker in inline mode → it runs `fn` synchronously.
        const pooled = new PooledWorker(worker, fn, this._idleReleaseAfter, this._onWorkerIdle.bind(this), this._timeout);
        // Route infrastructure failures (timeout / onError / malformed reply) on a REAL worker back to
        // the pool so it can count them and degrade to single-threaded execution instead of hanging.
        // An inline executor never triggers it, so the callback simply stays unused there.
        pooled.onInfraFailure = (t: PoolTask, err: Error): void => {
            // A failure from before recheck must not disable a freshly selected backend.
            if (pooled.retired) t.reject(err);
            else this._onInfraFailure(t, err);
        };
        return pooled;
    }

    private _dispatch (worker: PooledWorker, task: PoolTask): void {
        worker.busy = true;
        worker.cancelIdleTimer();
        const id = ++this._taskId;
        worker.onComplete = (): void => {
            worker.busy = false;
            if (worker.retired) this._onWorkerIdle(worker);
            else this._drain();
        };
        // Once ownership has been transferred, the original arguments cannot be replayed safely.
        task.transferred = !worker.isInline && !!this._activeBackend?.supportsTransfer && task.transfer.length > 0;
        worker.execute(id, task);
    }

    private _onWorkerIdle (worker: PooledWorker): void {
        if (this._released) {
            return;
        }
        if (worker.busy) {
            return;
        }
        const idx = this._workers.indexOf(worker);
        if (idx < 0) {
            return;
        }
        this._workers.splice(idx, 1);
        worker.dispose();
        // A worker was freed up (idle-release or failure): re-drain so queued tasks don't stall.
        this._drain();
    }

    /**
     * @internal
     * Handle an INFRASTRUCTURE failure on a real worker: it timed out, errored, failed to spawn, or
     * spoke a malformed protocol. These all mean the worker backend is not functioning for this
     * script — unlike a task-level `{ ok: false }` reply (a genuine computation error), which is
     * rejected directly and never reaches here.
     *
     * Script mode: count the failure and, once [[DEGRADE_AFTER_FAILURES]] is reached, degrade the
     * WHOLE pool so no further task hangs on the broken backend. With `options.fallback` we switch to
     * the `'sync'` backend (one inline executor on the main thread) and re-run the failed task through
     * it, so the caller still gets a result instead of a rejection — the graceful "warn + run
     * single-threaded" path the engine promises. Without a fallback there is no single-thread path to
     * degrade to, so we keep the existing evict-and-respawn recovery and reject the task, but warn
     * loudly so the developer learns the worker is broken and how to fix it.
     *
     * Function mode is deliberately EXCLUDED from degradation: its inline path is the SAME `_fn` that
     * may have just deadlocked inside the worker, so running it on the main thread could move the hang
     * onto the render thread. There we keep the existing recovery — reject the task, evict, respawn.
     *
     * @param task The in-flight task that failed, or `null` when the failure carries no task.
     * @param error The infrastructure error.
     */
    private _onInfraFailure (task: PoolTask | null, error: Error): void {
        if (!this._script) {
            // Function mode: no safe single-thread path (see above). Reject and let _settle evict +
            // respawn a fresh worker, exactly as before the circuit breaker existed.
            if (task) {
                task.reject(error);
            }
            return;
        }

        this._infraFailures++;
        if (!this._degraded && this._infraFailures >= DEGRADE_AFTER_FAILURES) {
            this._degraded = true;
            if (this._fallback) {
                // Graceful degradation: every future task runs on the main thread via the fallback.
                this._executionMode = 'sync';
                this._backendReason = '';
                this._maxWorkers = 1;
                // Drop idle real workers so the next dispatch goes to an inline executor, not a
                // leftover worker on the backend we just gave up on.
                this._retireWorkers();
            }
            this._warnDegrade(error);
        }

        if (!task) {
            return;
        }
        if (this._executionMode === 'sync' && this._fallback && !task.transferred) {
            // Re-run the failed task on the main thread. Front of the queue preserves ordering; the
            // eviction-driven re-drain (runtime failure) or the _drain loop (spawn failure) dispatches
            // it through an inline executor running the fallback.
            this._queue.unshift(task);
        } else {
            task.reject(error);
        }
    }

    /**
     * @internal
     * Emit the one-time RUNTIME-degradation warning. `_degradeWarned` is sticky for the pool's
     * lifetime so repeated failures — or a `recheck()` that re-degrades — never spam the log.
     */
    private _warnDegrade (error: Error): void {
        if (this._degradeWarned) {
            return;
        }
        this._degradeWarned = true;
        const script = this._script || '(function)';
        warn(`WorkerPool ${this._fallback ? 'degraded to single-threaded' : 'is rejecting tasks (no options.fallback)'} `
            + `for "${script}": worker backend failed (${error.message}). ${this._scriptFailureHint}`);
    }

    /** PAL decides whether unavailable script execution deserves a one-time warning. */
    private _warnConstructionDegrade (warnOnFailure: boolean, reason: string): void {
        if (!warnOnFailure || this._constructionWarned) {
            return;
        }
        this._constructionWarned = true;
        warn(`WorkerPool could not use a worker for "${this._script || '(function)'}" and is `
            + `${this._fallback ? 'running single-threaded via options.fallback' : 'REJECTING tasks (no options.fallback)'}. `
            + `Reason: ${reason}. ${this._scriptFailureHint}`);
    }
}

/**
 * @internal
 */
interface PoolTask {
    args: unknown[];
    transfer: Transferable[];
    transferred?: boolean;
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
}

/**
 * @internal
 * A single pooled worker, either backed by a real Web Worker or an inline synchronous executor.
 */
class PooledWorker {
    public busy = false;
    public retired = false;
    public onComplete: (() => void) | null = null;
    /**
     * @internal
     * Set by the pool: called when an INFRASTRUCTURE failure occurs while a task is in flight — the
     * worker timed out, errored, or spoke a malformed protocol. The pool counts these and (in script
     * mode) degrades to single-threaded execution so nothing hangs. Deliberately distinct from a
     * task-level `{ ok: false }` reply (a genuine computation error), which is rejected directly and
     * never routed here. Only real workers ever trigger it; an inline executor cannot suffer an
     * infrastructure failure (a throwing `fallback`/`_fn` is a task-level error).
     */
    public onInfraFailure: ((task: PoolTask, error: Error) => void) | null = null;

    /**
     * @en
     * Whether this pooled worker runs tasks INLINE on the calling thread instead of owning a real
     * worker. True for the `'sync'` backend and for function mode on platforms that cannot rebuild a
     * function from source. Such an executor is a placeholder, not parallelism — [[WorkerPool.recheck]]
     * retires the idle ones once a real backend appears.
     * @zh
     * 本池化 worker 是否在调用线程上**内联**执行任务，而非持有真正的 worker。
     * `'sync'` 后端、以及无法从源码重建函数的平台上的函数模式均如此。这类执行器只是占位而非并行——
     * 一旦真后端出现，[[WorkerPool.recheck]] 会把其中空闲的退役。
     */
    public get isInline (): boolean {
        return this._worker === null;
    }

    private readonly _worker: IWorker | null;
    private readonly _fn: WorkerTask | null;
    private readonly _idleReleaseAfter: number;
    private readonly _timeout: number;
    private readonly _onIdle: (worker: PooledWorker) => void;
    private _current: PoolTask | null = null;
    private _currentId = -1;
    private _idleTimer: ReturnType<typeof setTimeout> | null = null;
    private _timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    private _disposed = false;
    private _failed = false;

    constructor (
        worker: IWorker | null,
        fn: WorkerTask | null,
        idleReleaseAfter: number,
        onIdle: (worker: PooledWorker) => void,
        timeout = 0,
    ) {
        this._worker = worker;
        this._fn = fn;
        this._idleReleaseAfter = idleReleaseAfter;
        this._onIdle = onIdle;
        this._timeout = timeout > 0 ? timeout : 0;

        if (worker) {
            // IWorker.onMessage hands back the reply payload directly (the adapter unwraps `e.data`
            // on Web, and WeChat's `onMessage` already passes `res`), so no MessageEvent here.
            worker.onMessage((reply: IWorkerReply): void => {
                this._onMessage(reply);
            });
            worker.onError((e: any): void => {
                this._failed = true;
                if (this._current) {
                    // Busy: fail the in-flight task; _settle's `_failed` branch then evicts us.
                    this._settle(null, new Error(e && e.message ? String(e.message) : 'Worker error'));
                } else {
                    // Idle: there is no task to settle, but this worker is no longer trustworthy.
                    // It MUST be evicted here — otherwise it stays in the pool with `busy === false`,
                    // the next task gets dispatched onto it, and `postMessage` goes into a black hole
                    // (the task hangs forever, and script mode has no timeout to recover it).
                    // Real triggers: an uncaught async error inside the worker (e.g. a `setInterval`
                    // callback throwing), or WeChat killing the worker process (`onProcessKilled`).
                    this._evict();
                }
            });
        }
    }

    public execute (id: number, task: PoolTask): void {
        this._current = task;
        this._currentId = id;
        if (!this._worker) {
            if (!this._fn) {
                // Script mode without a live worker should never reach here (run()/_drain guard it),
                // but stay defensive: there is no function to run synchronously, so fail the task.
                this._settle(null, new Error('Worker is unavailable and no synchronous fallback exists'));
                return;
            }
            // Inline synchronous fallback (non-Worker platforms, function mode only). This blocks the
            // main thread, which is the unavoidable behavior when no worker is available.
            try {
                const value = this._fn(...task.args);
                this._settle(value, null);
            } catch (err) {
                this._settle(null, err as Error);
            }
            return;
        }
        // Arm before sending: adapters may synchronously report an error (or a test reply).
        this.armTimeout();
        try {
            this._worker.postMessage({ id, args: task.args }, task.transfer);
        } catch (err) {
            this._failed = true;
            this._settle(null, err instanceof Error ? err : new Error(String(err)));
        }
        // Watchdog. Only meaningful for a REAL worker: the inline synchronous path above blocks the
        // main thread for the whole duration, so a timer could never fire during it anyway.
        // Without this, a worker that accepts the message and never replies — a script that deadlocks,
        // an infinite loop, a platform that silently drops the message — leaves the task pending
        // forever AND leaves that worker parked in the pool with `busy === true`, permanently
        // shrinking the pool's effective size by one on every occurrence.
    }

    /**
     * @internal
     * Start the per-task watchdog. On expiry the task is failed and this worker is EVICTED (not
     * merely marked free): an unresponsive worker is indistinguishable from a dead one, so letting
     * the pool reuse it would just hang the next task too. Eviction routes through `_onIdle`, which
     * splices us out, disposes us and re-drains the queue onto a freshly spawned worker.
     */
    private armTimeout (): void {
        if (this._timeout <= 0) {
            return;
        }
        this.cancelTimeoutTimer();
        const id = this._currentId;
        this._timeoutTimer = setTimeout(() => {
            this._timeoutTimer = null;
            // Ignore a timer that outlived its task (shouldn't happen — _settle cancels it — but a
            // stale timer firing against a NEW task would fail an innocent one).
            if (!this._current || this._currentId !== id) {
                return;
            }
            this._failed = true;
            this._settle(null, new Error(`Worker task timed out after ${this._timeout}ms — the worker never replied `
                + '(deadlock, infinite loop, or non-protocol script). Worker discarded; see docs/worker/README.md'));
        }, this._timeout);
    }

    private cancelTimeoutTimer (): void {
        if (this._timeoutTimer !== null) {
            clearTimeout(this._timeoutTimer);
            this._timeoutTimer = null;
        }
    }

    public cancelIdleTimer (): void {
        if (this._idleTimer !== null) {
            clearTimeout(this._idleTimer);
            this._idleTimer = null;
        }
    }

    public dispose (): void {
        if (this._disposed) {
            return;
        }
        this._disposed = true;
        this.cancelIdleTimer();
        this.cancelTimeoutTimer();
        if (this._worker) {
            this._worker.terminate();
        }
        if (this._current) {
            this._current.reject(new Error('Worker has been disposed'));
            this._current = null;
            this._currentId = -1;
        }
        this.onComplete = null;
    }

    private _onMessage (reply: IWorkerReply): void {
        if (!this._current) {
            return;
        }
        // Boundary check: the worker script must speak the engine protocol. A malformed reply means
        // the packaged file is wrong (not based on the template) — fail loudly with a clear error
        // instead of letting the task hang forever waiting for a well-formed reply.
        if (!reply || typeof reply !== 'object'
            || typeof reply.id !== 'number'
            || typeof reply.ok !== 'boolean') {
            this._failed = true;
            this._settle(null, new Error('Worker script sent a malformed reply — it must implement the engine protocol: '
                + 'receive { id, args }, post back { id, ok, value } or { id, ok: false, error } (docs/worker/cc-worker-template.js)'));
            return;
        }
        // Guard against a stale/late reply from a previous task on the same worker.
        if (reply.id !== this._currentId) {
            return;
        }
        if (reply.ok) {
            this._settle(reply.value, null);
        } else {
            this._settle(null, new Error(reply.error || 'Worker task failed'));
        }
    }

    private _settle (value: unknown, error: Error | null): void {
        const task = this._current;
        if (!task) {
            return;
        }
        this._current = null;
        this._currentId = -1;
        this.cancelTimeoutTimer();

        if (error) {
            if (this._failed && this.onInfraFailure) {
                // Infrastructure failure (timeout / onError / malformed reply): the worker backend
                // itself is not functioning. Hand the task to the pool, which counts the failure,
                // degrades script-mode pools to single-threaded execution once the threshold is hit,
                // and either re-runs this task via the fallback or rejects it.
                this.onInfraFailure(task, error);
            } else {
                // Task-level failure (the worker replied { ok: false }, or an inline fallback/_fn
                // threw): a genuine computation error, not a broken backend. Reject directly and keep
                // trusting the worker.
                task.reject(error);
            }
        } else {
            task.resolve(value);
        }

        // A worker that reported an uncaught error is not trustworthy for reuse: dispose it so the
        // pool spawns a fresh one instead of replaying the same failure on every task.
        if (this._failed) {
            this._evict();
            return;
        }

        // Mark idle (kicking off the idle-release timer) and notify the pool to drain the queue.
        if (this._idleReleaseAfter > 0 && !this._disposed) {
            this.cancelIdleTimer();
            this._idleTimer = setTimeout(() => {
                this._idleTimer = null;
                this._onIdle(this);
            }, this._idleReleaseAfter);
        }

        if (this.onComplete) {
            const cb = this.onComplete;
            this.onComplete = null;
            cb();
        }
    }

    /**
     * @internal
     * Retire this worker for good: drop any completion callback, clear the busy flag, and hand
     * ourselves to the pool's idle hook (which splices us out of `_workers`, calls `dispose()` and
     * re-drains the queue so queued tasks get a freshly spawned worker).
     *
     * Used by BOTH failure paths, which is the whole point of extracting it: `_settle`'s `_failed`
     * branch (worker died while a task was in flight) and the idle `onError` branch (worker died
     * while idle). The idle path can never reach the `_settle` branch, because `_settle` returns
     * early when `_current` is null — routing it here is what stops a dead worker from silently
     * swallowing the next task.
     */
    private _evict (): void {
        this.onComplete = null;
        this.busy = false;
        this._onIdle(this);
    }
}

/**
 * @internal
 */
interface IWorkerReply {
    id: number;
    ok: boolean;
    value?: unknown;
    error?: string;
}

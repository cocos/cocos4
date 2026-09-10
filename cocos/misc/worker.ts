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

import { legacyCC } from '../core/global-exports';
import {
    getWorkerBackend,
    getWebWorkerCtor,
    getWorkerCapabilities,
    WebWorkerAdapter,
} from './worker-backend';
import type { IWorker } from './worker-backend';

export type { IWorker };

/**
 * @en
 * The task function executed inside a Web Worker.
 *
 * **Important**: the function must be *self-contained*: it is serialized via `Function.prototype.toString()`
 * and reconstructed in a fresh global scope inside the worker, so it cannot capture variables from the
 * enclosing closure, nor reference any engine / scene objects (`Node`, `Component`, `Vec3`, ...).
 * Only plain data (numbers, strings, arrays, plain objects) and transferable buffers (`ArrayBuffer`,
 * typed arrays backed by their own buffer) may cross the worker boundary.
 *
 * @zh
 * 在 Web Worker 内执行的任务函数。
 *
 * **注意**：函数必须*自包含*——引擎通过 `Function.prototype.toString()` 序列化函数并在 Worker 的全新全局作用域中重建，
 * 因此它不能捕获外部闭包变量，也不能引用任何引擎 / 场景对象（`Node`、`Component`、`Vec3` 等）。
 * 只有普通数据（数字、字符串、数组、普通对象）和可转移缓冲区（`ArrayBuffer`、自带缓冲区的类型化数组）可以跨 Worker 边界传递。
 *
 * @remarks
 * @en
 * The default argument type is `any[]` rather than `unknown[]`, deliberately. Arguments reach the task
 * through a DYNAMIC array channel — `pool.run([1_000_000])` is `unknown[]`, spread internally as
 * `fn(...args)` — so the type system can never relate what you pass to `run()` to what your task
 * declares. An `unknown[]` parameter therefore buys zero safety while breaking the natural spelling:
 * under `strictFunctionTypes` a concrete `(limit: number) => number` is NOT assignable to
 * `(...args: unknown[]) => unknown`, so `new WorkerPool(fn, { fallback: countPrimes })` would not
 * compile. `any[]` restores bivariance and lets the obvious code type-check. Pass explicit type
 * arguments when you want the stricter shape: `WorkerTask<[number, number], number>`.
 * @zh
 * 默认参数类型刻意取 `any[]` 而非 `unknown[]`。参数是通过**动态数组通道**抵达任务函数的——
 * `pool.run([1_000_000])` 是 `unknown[]`，内部以 `fn(...args)` 展开——因此类型系统永远无法把你传给
 * `run()` 的东西与任务函数的声明关联起来。于是 `unknown[]` 参数**换不到任何安全性**，却破坏了最自然的写法：
 * 在 `strictFunctionTypes` 下，具体的 `(limit: number) => number` **不能**赋值给
 * `(...args: unknown[]) => unknown`，导致 `new WorkerPool(fn, { fallback: countPrimes })` 无法编译。
 * `any[]` 恢复双变，让显而易见的代码通过类型检查。需要更严格的形状时请显式传类型参数：
 * `WorkerTask<[number, number], number>`。
 */
// `any[]` here is a deliberate, documented trade-off — see the remarks above. Do not "fix" it back to
// `unknown[]`: that reintroduces a compile error on every concrete task function.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WorkerTask<TArgs extends any[] = any[], TResult = unknown> = (...args: TArgs) => TResult;

/**
 * @en Options for running a task in a Web Worker.
 * @zh 在 Web Worker 中运行任务的选项。
 */
export interface WorkerRunOptions {
    /**
     * @en
     * Transferable objects (e.g. `ArrayBuffer`, `MessagePort`) to be transferred (zero-copy) to the worker.
     * Transferred buffers are neutered (detached) on the main thread.
     * @zh
     * 要零拷贝转移到 Worker 的可转移对象（如 `ArrayBuffer`、`MessagePort`）。
     * 被转移的缓冲区在主线程会被置空（detach）。
     */
    transfer?: Transferable[];
    /**
     * @en
     * Timeout in milliseconds. When exceeded, the task rejects with an error and the worker is terminated.
     * Set to 0 (default) to disable the timeout.
     * @zh
     * 超时时间（毫秒）。超过后任务以错误结束并终止 Worker。设为 0（默认）表示不超时。
     */
    timeout?: number;
}

/**
 * @en Result envelope exchanged between the main thread and the worker.
 * @zh 主线程与 Worker 之间交换的结果信封。
 * @internal
 */
interface IWorkerReply {
    id: number;
    ok: boolean;
    value?: unknown;
    error?: string;
}

let _taskId = 0;

let _workerSupport: boolean | undefined;

/**
 * @en
 * Detect whether the current environment supports spawning a Web Worker from a serialized function
 * (i.e. `Worker` constructor + `Blob` + `URL.createObjectURL` are all available).
 *
 * This is the capability required by **mode 1** (pure-function workers used by [[runWorkerTask]] /
 * [[WorkerPool]]). Native platforms run JavaScript inside an embedded engine (V8 / JavaScriptCore)
 * without the browser host API, and mini-game platforms forbid runtime code evaluation and have no
 * `Blob` (they use `createWorker` with a packaged script path instead), so both report `false` here
 * and mode 1 falls back to running synchronously on the main thread. Use [[createWorker]]`(path)`
 * (mode 2) for a real worker on a mini-game platform.
 *
 * NOTE: this answers "can I build a worker from a FUNCTION". It says nothing about whether the
 * platform has workers at all — for that use [[getWorkerConcurrencyLimit]], which is nonzero on all
 * nine mini-game platforms except Taobao. Conflating the two is what made a WeChat V2 build report
 * an optimal worker count of 1.
 * @zh
 * 检测当前环境是否支持从序列化函数创建 Web Worker
 * （即 `Worker` 构造器 + `Blob` + `URL.createObjectURL` 三者齐全）。
 *
 * 这是**模式一**（[[runWorkerTask]] / [[WorkerPool]] 使用的纯函数 Worker）所需的能力。
 * 原生平台在嵌入式 JS 引擎（V8 / JavaScriptCore）中运行、没有浏览器宿主 API；小游戏平台禁止运行时代码求值
 * 且没有 `Blob`（它们用 `createWorker` + 打包脚本路径），因此两者这里都返回 `false`，
 * 模式一自动降级为主线程同步执行。小游戏平台上若要真正的 Worker，请用 [[createWorker]]`(path)`（模式二）。
 *
 * 注意：本函数回答的是"能否从**函数**构建 Worker"，与平台到底有没有 Worker 无关——后者请用
 * [[getWorkerConcurrencyLimit]]，除淘宝外它在全部 9 个小游戏平台上都非零。
 * 把两者混为一谈，正是微信 V2 构建把最优 Worker 数报成 1 的原因。
 */
export function isWorkerSupported (): boolean {
    if (_workerSupport !== undefined) {
        return _workerSupport;
    }

    _workerSupport = false;

    // Only the Web backend can build a worker from a serialized string. Mini-game platforms forbid
    // runtime code evaluation entirely, so this is false there by construction.
    if (!getWorkerBackend().supportsFunctionWorker) {
        return _workerSupport;
    }
    // The Web backend guarantees a global `Worker`; Blob + URL are still host APIs that can be absent
    // (e.g. a stripped-down or sandboxed browser context), so verify them before committing.
    if (typeof Blob === 'undefined') {
        return _workerSupport;
    }
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return _workerSupport;
    }

    _workerSupport = true;
    return _workerSupport;
}

/**
 * @en
 * Suggest a sensible worker count for CPU-bound (compute-heavy) tasks.
 *
 * The platform's concurrency cap is applied FIRST, because on seven of the nine mini-game platforms
 * the limit is exactly one worker — a platform restriction, not a hardware one. Only where the
 * platform allows many (Web, WeChat V2 standard worker) does the hardware estimate apply:
 * `hardwareConcurrency - 1`, deliberately leaving one logical core for the main thread (rendering +
 * game logic). This is a *starting point*, not a universal answer: I/O-bound tasks can benefit from
 * more workers, and tiny per-frame tasks are often better off with `1`.
 *
 * Where `navigator.hardwareConcurrency` is unavailable — as is typically the case on mini-game
 * platforms, which expose device info through their own APIs rather than `navigator` — this
 * conservatively returns `1`. Size such a pool explicitly instead
 * (`new WorkerPool(path, { maxWorkers: 4 })`).
 *
 * Returns `1` when the platform has no worker at all (native platforms, Taobao), matching the single
 * inline executor the pool falls back to.
 *
 * @zh
 * 为 CPU 密集型（重计算）任务推荐一个合理的 Worker 数量。
 *
 * **平台并发上限优先**，因为 9 个小游戏平台中有 7 个上限恰好是 1 个 Worker——这是平台限制而非硬件限制。
 * 只有平台允许多 Worker 时（Web、微信 V2 标准 Worker）才采用硬件估算：`hardwareConcurrency - 1`，
 * 刻意给主线程（渲染 + 游戏逻辑）留一个逻辑核。这是一个*起点*，不是普适答案：I/O 型任务可以开更多 Worker，
 * 而每帧的小任务往往用 `1` 个更合适。
 *
 * 当 `navigator.hardwareConcurrency` 不可用时——**包括全部小游戏平台**（它们都不暴露 `navigator`）——
 * 保守返回 `1`。这类平台请显式指定池大小（`new WorkerPool(path, { maxWorkers: 4 })`）。
 *
 * 平台完全不支持 Worker 时（原生平台、淘宝）返回 `1`，与池降级使用的单个内联执行器一致。
 *
 * @example
 * ```ts
 * const pool = new WorkerPool(myPureFn, {
 *     maxWorkers: getOptimalWorkerCount(),
 * });
 * ```
 */
export function getOptimalWorkerCount (): number {
    const limit = getWorkerBackend().concurrencyLimit;
    // No worker at all: the pool can only ever run one inline executor.
    if (limit === 0) {
        return 1;
    }
    // A hard platform cap (the seven single-worker mini-game platforms) wins over any hardware estimate.
    // NOTE: the previous implementation reached this answer only by accident — it short-circuited on
    // `isWorkerSupported()`, which tests FUNCTION-mode capability (Worker + Blob + URL). A WeChat V2
    // runtime has real multi-worker support but no Blob, so it was misreported as capped at 1.
    if (limit !== Infinity) {
        return limit;
    }
    // eslint-disable-next-line no-restricted-globals
    const hc = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency)
        ? navigator.hardwareConcurrency
        : 1;
    return Math.max(1, Math.floor(hc) - 1);
}

/**
 * @en
 * Whether the mini-game runtime supports the **standard (WeChat V2) worker**: multiple concurrent
 * workers, `SharedArrayBuffer`, transfer lists in `postMessage`, `OffscreenCanvas`, etc.
 *
 * This is a WeChat-only capability today (detected via `minigame.env.isSupportStandardWorker`), but it
 * is expressed as a backend capability rather than a platform check, so the answer stays correct if
 * another platform later ships a standard worker.
 *
 * V2 is in grey release, so this MUST be checked at runtime before relying on any V2-only capability.
 * It safely returns `false` (i.e. fall back to the single-worker generation) when:
 * - the platform is not a mini-game platform at all (Web / native);
 * - the platform has no `env.isSupportStandardWorker` (every non-WeChat mini-game platform);
 * - `minigame.env` is undefined (old base library);
 * - running in the WeChat devtools (V2 is not supported there yet).
 *
 * Without V2 the hard constraints are: at most **1** concurrent worker, data is structured-cloned
 * (no transfer), and no platform API / rendering inside the worker.
 * @zh
 * 小游戏运行时是否支持**标准（微信 V2）Worker**：多并发 Worker、`SharedArrayBuffer`、
 * `postMessage` 的 transfer 列表、`OffscreenCanvas` 等。
 *
 * 目前这是微信独有的能力（通过 `minigame.env.isSupportStandardWorker` 检测），但它被表达为后端能力
 * 而非平台判断，因此将来若其他平台也推出标准 Worker，这里的答案依然正确。
 *
 * V2 仍在灰度，因此依赖任何 V2 能力前**必须**运行时检测。以下情况安全返回 `false`（即回退到单 Worker 代际）：
 * - 根本不是小游戏平台（Web / 原生）；
 * - 平台没有 `env.isSupportStandardWorker`（所有非微信小游戏平台）；
 * - `minigame.env` 为 undefined（旧基础库）；
 * - 微信开发者工具中运行（V2 暂不支持）。
 *
 * 无 V2 时的硬约束：最多 **1** 个并发 Worker、数据走结构化克隆（无 transfer）、Worker 内无平台 API / 渲染。
 */
export function isSupportStandardWorker (): boolean {
    const backend = getWorkerBackend();
    return backend.kind === 'minigame' && backend.supportsTransfer;
}

/**
 * @en Result of [[checkWorkerScript]]: whether the platform worker environment is fully set up for a script path.
 * @zh [[checkWorkerScript]] 的结果：平台 Worker 环境对某脚本路径是否设置完整。
 */
export interface IWorkerScriptStatus {
    /**
     * @en Whether a worker can be used for this path. Only when `true` should you go the worker route.
     * @zh 该路径能否使用 Worker。仅当为 `true` 时才应走 Worker 路线。
     */
    ready: boolean;
    /**
     * @en Worker version: `2` = standard (WeChat V2) worker, `1` = single-worker generation, `0` = unavailable.
     * @zh Worker 版本：`2` = 标准（微信 V2）Worker，`1` = 单 Worker 代际，`0` = 不可用。
     */
    version: 0 | 1 | 2;
    /**
     * @en Human-readable reason when not ready (empty string when ready). Suitable for error messages.
     * @zh 不可用时的原因说明（可用时为空字符串），可直接用于报错信息。
     */
    reason: string;
}

/**
 * @en
 * Check whether the platform's worker environment is **fully set up** for the given script path.
 *
 * "Fully set up" means ALL of the following hold:
 * 1. the platform exposes a worker API at all (`minigame.createWorker`, or a global `Worker`);
 * 2. the path is valid: a non-empty **relative** path ending with `.js` (mini-game platforms reject
 *    absolute paths and non-JS files);
 * 3. on mini-game platforms, the file **actually exists** in the code package (verified via
 *    `minigame.getFileSystemManager().accessSync`) and is **not empty** (best-effort `statSync`).
 *    A missing file usually means it was not placed in the workers directory declared in
 *    `game.json` (WeChat) / `manifest.json` (quick game) / `app.json`, or its subpackage has not
 *    been downloaded yet.
 *
 * When `ready` is `true`, `version` tells you which worker generation you got (`2` = WeChat standard
 * multi-worker, `1` = single-worker generation). When `ready` is `false`, `reason` explains why, and
 * callers should fall back to a standard Web `Worker` (if any), then to synchronous execution.
 * @zh
 * 检查平台的 Worker 环境对给定脚本路径是否**设置完整**。
 *
 * "设置完整"指以下条件全部成立：
 * 1. 平台确实暴露了 Worker API（`minigame.createWorker`，或全局 `Worker`）；
 * 2. 路径合法：非空、**相对路径**、以 `.js` 结尾（小游戏平台会拒绝绝对路径与非 JS 文件）；
 * 3. 在小游戏平台上，文件**确实存在**于代码包中（通过 `minigame.getFileSystemManager().accessSync`
 *    校验）且**非空**（尽力而为的 `statSync`）。文件缺失通常意味着它没被放进 `game.json`（微信）/
 *    `manifest.json`（快游戏）/ `app.json` 声明的 workers 目录，或所在分包尚未下载。
 *
 * `ready` 为 `true` 时，`version` 表明拿到的 Worker 代际（`2` = 微信标准多 Worker，`1` = 单 Worker 代际）。
 * `ready` 为 `false` 时，`reason` 说明原因，调用方应降级到标准 Web `Worker`（若有），再不行就同步执行。
 */
export function checkWorkerScript (path: string): IWorkerScriptStatus {
    return getWorkerBackend().diagnose(path);
}

/**
 * @en
 * The maximum number of worker instances that can run **concurrently** on the current platform.
 *
 * - Web (global `Worker`): effectively unlimited → `Infinity`.
 * - WeChat **V2** standard worker (`env.isSupportStandardWorker`): multiple workers → `Infinity`.
 * - WeChat V1, ByteDance, Alipay, Baidu, and the quick-game family (Huawei / OPPO / vivo / Xiaomi):
 *   only ONE worker at a time → `1`.
 * - Taobao mini-game and native platforms (no worker API at all) → `0`.
 *
 * A cap of `1` means the platform has a worker but no parallelism: [[WorkerPool]] there is an
 * **asynchronous offload queue** — it frees the main thread from a long task, but it cannot run two
 * tasks at once. [[WorkerPool]] in **script mode** (`new WorkerPool(path)`) already caps its pool size
 * per platform automatically (via [[checkWorkerScript]]), so it never tries to create more workers
 * than the platform allows — creating a second worker on a single-worker platform fails.
 *
 * Do NOT pass this result directly as `maxWorkers`: where it returns `Infinity` the pool treats that
 * as "not specified". Pass a concrete number instead:
 * ```ts
 * const pool = new WorkerPool('workers/my-task/index.js', { maxWorkers: 4 });
 * ```
 * @zh
 * 当前平台上能够**并发**运行的 worker 实例数量上限。
 *
 * - Web（全局 `Worker`）：实际上无限制 → `Infinity`。
 * - 微信 **V2** 标准 Worker（`env.isSupportStandardWorker`）：支持多 Worker → `Infinity`。
 * - 微信 V1、抖音、支付宝、百度，以及快游戏家族（华为 / OPPO / vivo / 小米）：同一时刻仅 1 个 → `1`。
 * - 淘宝小游戏与原生平台（完全没有 Worker API）→ `0`。
 *
 * 上限为 `1` 意味着平台有 Worker 但**没有并行能力**：此时 [[WorkerPool]] 是一个**异步卸载队列**——
 * 它能把长任务从主线程挪走，但无法同时跑两个任务。[[WorkerPool]] **脚本模式**（`new WorkerPool(path)`）
 * 已通过 [[checkWorkerScript]] 自动按平台封顶池大小，不会创建超过平台允许的 Worker 数——
 * 在单 Worker 平台上创建第二个会失败。
 *
 * 不要把本函数的返回值直接传给 `maxWorkers`：返回 `Infinity` 时池会将其视为"未指定"。请传具体数值：
 * ```ts
 * const pool = new WorkerPool('workers/my-task/index.js', { maxWorkers: 4 });
 * ```
 */
export function getWorkerConcurrencyLimit (): number {
    return getWorkerBackend().concurrencyLimit;
}

/**
 * @en
 * Create a dedicated Web Worker from a serialized function (**mode 1**), and wire its message protocol.
 * Returns `null` where function-workers are unsupported (mini-game platforms / native), so callers
 * fall back to synchronous execution. Used internally by [[runWorkerTask]] and [[WorkerPool]].
 * @zh
 * 从序列化函数创建专用 Web Worker（**模式一**）并接好消息协议。
 * 在不支持函数式 Worker 的平台（全部小游戏平台 / 原生）返回 `null`，调用方据此降级为同步执行。
 * 供 [[runWorkerTask]] 和 [[WorkerPool]] 内部使用。
 * @internal
 */
function createWorkerFromFunction (fn: WorkerTask): IWorker | null {
    if (typeof fn !== 'function') {
        throw new TypeError('WorkerTask must be a self-contained function');
    }
    if (!isWorkerSupported()) {
        // Mini-game platforms forbid runtime code evaluation and have no Blob (only
        // `createWorker(path)`); native has no browser host API. Mode 1 cannot build a worker from a
        // string there → signal the caller to run synchronously.
        return null;
    }
    const WorkerCtor = getWebWorkerCtor();
    if (!WorkerCtor) {
        // Defensive: support said yes but the constructor vanished → run synchronously.
        return null;
    }
    const source = [
        // The serialized function is injected verbatim, then the worker simply
        // applies it to the transferred args and posts the result (or error) back.
        `'use strict';`,
        `const __fn = (${fn.toString()});`,
        // Recursively collect ArrayBuffers from the return value so they are MOVED (zero-copy) back
        // to the main thread instead of being structured-cloned. For large TypedArray results (e.g.
        // terrain vertex data) this avoids copying hundreds of MB on every task.
        //
        // Four hard-won rules, each one fixing a real defect:
        //  1. `seen` Set — the previous version recursed forever on cyclic objects and threw
        //     RangeError. Structured clone handles cycles natively, so blowing up there was a pure
        //     regression: it turned a working case into a crash.
        //  2. `Object.keys` instead of `for...in` — `for...in` walks the prototype chain, so a buffer
        //     inherited from a prototype got transferred. That detaches it WITHOUT it ever appearing
        //     in the cloned reply (structured clone only copies own enumerable properties) — silent,
        //     unlogged data loss. `Object.keys` matches structured clone's own-property semantics.
        //  3. Depth cap (32) — deeply nested graphs recursed the collector off the stack. Past the cap
        //     we simply stop looking: we lose the zero-copy optimisation for that buffer, never correctness.
        //  4. Set dedupe — `out.indexOf` was O(n) per buffer, making wide results O(n^2).
        `const __MAX_TRANSFER_DEPTH = 32;`,
        `function __collectTransfers (v, out, seen, depth) {`,
        `    if (v == null || depth > __MAX_TRANSFER_DEPTH) { return; }`,
        `    if (v instanceof ArrayBuffer) { out.add(v); return; }`,
        `    if (ArrayBuffer.isView(v)) { if (v.buffer) { out.add(v.buffer); } return; }`,
        `    if (typeof v !== 'object') { return; }`,
        `    if (seen.has(v)) { return; }`,
        `    seen.add(v);`,
        `    if (Array.isArray(v)) {`,
        `        for (let i = 0; i < v.length; i++) { __collectTransfers(v[i], out, seen, depth + 1); }`,
        `        return;`,
        `    }`,
        `    const keys = Object.keys(v);`,
        `    for (let i = 0; i < keys.length; i++) {`,
        `        __collectTransfers(v[keys[i]], out, seen, depth + 1);`,
        `    }`,
        `}`,
        `self.onmessage = function (e) {`,
        `    const msg = e.data || {};`,
        `    let reply;`,
        `    try {`,
        `        reply = { id: msg.id, ok: true, value: __fn.apply(null, msg.args || []) };`,
        `    } catch (err) {`,
        `        reply = { id: msg.id, ok: false, error: (err && (err.message || err.stack)) || String(err) };`,
        `    }`,
        // Collecting the transfer list is an OPTIMISATION, so it must never be able to fail the task.
        // Any throw here (hostile object with a throwing getter, exotic types, ...) downgrades to a
        // plain structured clone: slower, but correct.
        `    let transfer;`,
        `    try {`,
        `        const set = new Set();`,
        `        __collectTransfers(reply.value, set, new Set(), 0);`,
        `        transfer = Array.from(set);`,
        `    } catch (eCollect) {`,
        `        transfer = undefined;`,
        `    }`,
        `    try {`,
        `        self.postMessage(reply, transfer);`,
        `    } catch (err2) {`,
        // Three-tier degradation. The second tier matters: postMessage can fail purely because of the
        // transfer list (a SharedArrayBuffer cannot be transferred, or the platform supports no
        // transfer at all) while the payload itself clones fine. Retry once WITHOUT the transfer list
        // before declaring the result unserializable.
        // Caveat: if the first attempt detached some buffers before throwing, the retry clones them as
        // zero-length. Degraded data still beats a hard task failure, and the alternative (no retry)
        // loses the entire result.
        `        try {`,
        `            self.postMessage(reply);`,
        `        } catch (err3) {`,
        `            try {`,
        `                self.postMessage({ id: msg.id, ok: false, error: 'Worker result is not serializable: ' + (err3 && err3.message) });`,
        `            } catch (e4) { /* ignore */ }`,
        `        }`,
        `    }`,
        `};`,
    ].join('\n');

    // eslint-disable-next-line no-restricted-globals
    const blob = new Blob([source], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new WorkerCtor(url);
    // The blob URL can be revoked immediately; the worker has already loaded its source synchronously.
    URL.revokeObjectURL(url);
    return new WebWorkerAdapter(worker);
}

/**
 * @en
 * Create a worker from a packaged script path (**mode 2**), aligned with `minigame.createWorker`.
 * - Mini-game platforms (all nine): `minigame.createWorker(path)` — the script must live in the
 *   packaged workers directory declared in `game.json` (WeChat) / `manifest.json` (quick game) /
 *   `app.json`; if it is in a subpackage, download that subpackage first.
 * - Web: `new Worker(path)` (the script must be same-origin).
 *
 * Unlike mode 1, this works on mini-game platforms because the worker code is a real packaged file
 * rather than a runtime-serialized string (which those platforms forbid). The returned [[IWorker]]
 * exposes the WeChat-aligned messaging API, and the caller defines its own message protocol
 * (no envelope is imposed).
 *
 * Platform order matters and is decided by the backend, not by a platform constant: on a mini-game
 * build the mini-game worker is tried first, and only if it is not fully set up (script missing,
 * subpackage not yet downloaded, base library too old) does it fall through to a global `Worker`
 * (which some devtools environments provide), then to a precise error.
 * @zh
 * 从打包好的脚本路径创建 Worker（**模式二**），对齐 `minigame.createWorker`。
 * - 小游戏平台（全部 9 个）：`minigame.createWorker(path)`——脚本须位于 `game.json`（微信）/
 *   `manifest.json`（快游戏）/ `app.json` 声明的 workers 目录内；若在分包中，需先下载该分包。
 * - Web：`new Worker(path)`（脚本需同源）。
 *
 * 与模式一不同，这在小游戏平台上可用，因为 Worker 代码是真实打包文件而非运行时序列化字符串
 * （那些平台禁止后者）。返回的 [[IWorker]] 暴露对齐微信的消息 API，协议由调用方自定义（不强加信封）。
 *
 * 平台顺序很重要，且由后端而非平台常量决定：小游戏构建下优先尝试小游戏 Worker，只有当它未完全就绪时
 * （脚本缺失、分包未下载、基础库过旧）才降级到全局 `Worker`（部分开发者工具环境提供），再不行就精确报错。
 * @internal
 */
function createWorkerFromPath (path: string): IWorker {
    if (typeof path !== 'string' || !path) {
        throw new TypeError('createWorker(path) requires a non-empty worker script path');
    }
    const backend = getWorkerBackend();
    if (backend.kind === 'minigame') {
        // Go the mini-game route ONLY when its worker environment is fully set up for this path
        // (createWorker available + path valid + file exists in the package). Otherwise fall through
        // to a standard Web Worker (e.g. some devtools environments), and if that is missing too,
        // report a precise error instead of failing obscurely.
        const status = backend.diagnose(path);
        if (status.ready) {
            return backend.createScriptWorker(path);
        }
        // eslint-disable-next-line no-restricted-globals
        if (typeof Worker !== 'undefined') {
            // eslint-disable-next-line no-restricted-globals
            return new WebWorkerAdapter(new Worker(path));
        }
        throw new Error(`Worker is not available for "${path}": ${status.reason}. `
            + 'No global Worker fallback either — fix the packaging (see docs/worker/README.md) '
            + 'or provide a synchronous fallback (WorkerPool options.fallback).');
    }
    if (backend.kind === 'web') {
        return backend.createScriptWorker(path);
    }
    throw new Error('Worker is not supported in the current environment');
}

/**
 * @en
 * Create a worker. The signature is aligned with the mini-game `createWorker`:
 *
 * - `createWorker(path: string)` → **mode 2**: a worker loaded from a packaged script. Web uses
 *   `new Worker(path)`; every mini-game platform that has a worker uses
 *   `minigame.createWorker(path)` (WeChat / ByteDance / Alipay / Baidu / Huawei / OPPO / vivo /
 *   Xiaomi). Works on all of them.
 * - `createWorker(fn: WorkerTask)` → **mode 1**: a worker built from a self-contained function
 *   (**Web only**). On mini-game platforms and native this throws, because they forbid rebuilding a
 *   function from source — use [[runWorkerTask]] or [[WorkerPool]] instead, which automatically fall
 *   back to synchronous execution there.
 *
 * Both return an [[IWorker]] (`postMessage` / `onMessage` / `onError` / `terminate`). Check
 * [[getWorkerCapabilities]] first if you need to know whether the platform has a worker at all
 * (Taobao mini-game and native do not).
 * @zh
 * 创建一个 Worker，签名对齐小游戏的 `createWorker`：
 *
 * - `createWorker(path: string)` → **模式二**：从打包脚本加载 Worker。Web 用 `new Worker(path)`；
 *   每个有 Worker 的小游戏平台用 `minigame.createWorker(path)`（微信 / 抖音 / 支付宝 / 百度 / 华为 /
 *   OPPO / vivo / 小米），两端都可用。
 * - `createWorker(fn: WorkerTask)` → **模式一**：从自包含函数构建 Worker（**仅 Web**）。
 *   小游戏平台与原生下会抛错，因为它们禁止用源码重建函数——请改用 [[runWorkerTask]] 或
 *   [[WorkerPool]]，它们在这些平台会自动降级为同步执行。
 *
 * 两者都返回 [[IWorker]]（`postMessage` / `onMessage` / `onError` / `terminate`）。若需要先知道平台
 * 到底有没有 Worker（淘宝小游戏与原生没有），请先查 [[getWorkerCapabilities]]。
 *
 * @example
 * ```ts
 * // Mode 2: your own packaged worker script (Web + all worker-capable mini-game platforms).
 * const worker = cc.createWorker('workers/my-worker/index.js');
 * worker.onMessage((res) => { console.log(res); });
 * worker.postMessage({ cmd: 'compute', data });
 * worker.terminate();
 * ```
 */
export function createWorker (path: string): IWorker;
export function createWorker (fn: WorkerTask): IWorker;
export function createWorker (pathOrFn: string | WorkerTask): IWorker {
    if (typeof pathOrFn === 'function') {
        const w = createWorkerFromFunction(pathOrFn);
        if (!w) {
            throw new Error('Function-based worker (mode 1) is not supported on this platform; '
                + 'use runWorkerTask/WorkerPool for an automatic synchronous fallback, '
                + 'or createWorker(path) with a packaged worker script (mode 2).');
        }
        return w;
    }
    return createWorkerFromPath(pathOrFn);
}

/**
 * @en
 * Run a pure, self-contained function inside a dedicated Web Worker and resolve with its return value.
 *
 * On platforms without function-worker support (native, every mini-game platform, Node.js server
 * mode), it automatically falls back to running the function synchronously on the main thread — the
 * promise still resolves, so callers can use the exact same code on every platform. (For a real worker
 * on a mini-game platform, use [[createWorker]]`(path)` with your own packaged worker script.)
 *
 * @zh
 * 在专用的 Web Worker 中运行一个纯函数，并用其返回值 resolve。
 *
 * 在不支持函数式 Worker 的平台（原生、全部小游戏平台、Node.js 服务端模式）上，会自动降级为在主线程同步执行——
 * promise 依然会 resolve，因此调用方在所有平台上都可以使用同一套代码。
 * （小游戏平台上若要真正的 Worker，请用 [[createWorker]]`(path)` 配合自己打包的 Worker 脚本。）
 *
 * @param fn The self-contained task function. 自包含的任务函数。
 * @param args Arguments passed to `fn`. 传给 `fn` 的参数。
 * @param options See [[WorkerRunOptions]]. 运行选项。
 * @returns A promise resolving to the function's return value. resolve 为函数返回值的 promise。
 *
 * @example
 * ```ts
 * const sum = await runWorkerTask((a: number, b: number) => a + b, [1, 2]);
 * ```
 */
// Unlike WorkerPool.run — whose `args` arrive later, through a queue, as an unrelated `unknown[]` —
// here `fn` and `args` are passed side by side in ONE call, so the type system genuinely CAN relate
// them. Inferring `TArgs` from `fn` therefore buys real safety: `runWorkerTask((a: number) => a, ['x'])`
// is correctly rejected. It also makes the concrete spelling above compile, which the previous
// `WorkerTask<unknown[], TResult>` parameter did not (contravariance rejects `(a: number) => number`).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function runWorkerTask<TArgs extends any[], TResult = unknown> (
    fn: (...args: TArgs) => TResult,
    args?: TArgs,
    options?: WorkerRunOptions,
): Promise<TResult> {
    // Normalise once. Spreading `args || []` directly yields the union `never[] | TArgs`, which is not
    // assignable to `TArgs`; and the cast is honest here — invoking a task that declares parameters with
    // no arguments is a caller error, surfaced at runtime exactly as the old `unknown[]` version did.
    const callArgs = args ?? ([] as unknown as TArgs);

    if (!isWorkerSupported()) {
        // Fallback: run synchronously on the main thread, keeping the promise contract intact.
        return new Promise<TResult>((resolve, reject) => {
            try {
                resolve(fn(...callArgs));
            } catch (err) {
                reject(err);
            }
        });
    }

    return new Promise<TResult>((resolve, reject) => {
        let worker: IWorker | null;
        try {
            worker = createWorkerFromFunction(fn as WorkerTask);
        } catch (err) {
            reject(err);
            return;
        }
        if (!worker) {
            // Defensive: the support flag said yes but the factory returned null → run synchronously.
            try {
                resolve(fn(...callArgs));
            } catch (err) {
                reject(err);
            }
            return;
        }

        const id = ++_taskId;
        let settled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const cleanup = (): void => {
            if (timer !== null) {
                clearTimeout(timer);
                timer = null;
            }
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            worker!.terminate();
        };

        worker.onMessage((msg: IWorkerReply): void => {
            if (settled) {
                return;
            }
            if (!msg || msg.id !== id) {
                return;
            }
            settled = true;
            cleanup();
            if (msg.ok) {
                resolve(msg.value as TResult);
            } else {
                reject(new Error(msg.error || 'Worker task failed'));
            }
        });

        worker.onError((e: any): void => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            reject(new Error(e && e.message ? String(e.message) : 'Worker error'));
        });

        const timeout = options && options.timeout;
        if (timeout && timeout > 0) {
            timer = setTimeout(() => {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                reject(new Error(`Worker task timed out after ${timeout}ms`));
            }, timeout);
        }

        try {
            worker.postMessage({ id, args: args || [] }, (options && options.transfer) || []);
        } catch (err) {
            // postMessage can throw synchronously (e.g. DataCloneError for a non-cloneable arg,
            // or a transfer list containing a non-transferable / already-detached buffer).
            // Settle the promise and tear the worker down so it never leaks.
            if (!settled) {
                settled = true;
            }
            cleanup();
            reject(err);
        }
    });
}

// Register the utilities on the `cc` namespace so developers can call `cc.runWorkerTask(...)` / `cc.createWorker(...)` / etc.
legacyCC.runWorkerTask = runWorkerTask;
legacyCC.createWorker = createWorker;
legacyCC.isWorkerSupported = isWorkerSupported;
legacyCC.isSupportStandardWorker = isSupportStandardWorker;
legacyCC.checkWorkerScript = checkWorkerScript;
legacyCC.getWorkerCapabilities = getWorkerCapabilities;
legacyCC.getOptimalWorkerCount = getOptimalWorkerCount;
legacyCC.getWorkerConcurrencyLimit = getWorkerConcurrencyLimit;

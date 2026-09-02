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
 */
export type WorkerTask<TArgs extends unknown[] = unknown[], TResult = unknown> = (...args: TArgs) => TResult;

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

// eslint-disable-next-line @typescript-eslint/naming-convention
let _WorkerCtor: typeof Worker | undefined | null;
let _workerSupport: boolean | undefined;

/**
 * @en
 * Detect whether the current environment supports spawning a Web Worker from a serialized function
 * (i.e. `Worker` constructor + `Blob` + `URL.createObjectURL` are all available).
 *
 * Native platforms run JavaScript inside an embedded engine (V8 / JavaScriptCore) without the browser
 * host API, so `Worker` is simply not defined there — such platforms report `false`.
 * @zh
 * 检测当前环境是否支持从序列化函数创建 Web Worker
 * （即 `Worker` 构造器 + `Blob` + `URL.createObjectURL` 三者齐全）。
 *
 * 原生平台在嵌入式 JS 引擎（V8 / JavaScriptCore）中运行，没有浏览器宿主 API，因此根本没有 `Worker`——这些平台返回 `false`。
 */
export function isWorkerSupported (): boolean {
    if (_workerSupport !== undefined) {
        return _workerSupport;
    }

    _workerSupport = false;
    _WorkerCtor = null;

    // `Worker` is a web host API; on native / minigame it is absent (minigame uses `wx.createWorker` instead).
    if (typeof Worker === 'undefined') {
        return _workerSupport;
    }
    if (typeof Blob === 'undefined') {
        return _workerSupport;
    }
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return _workerSupport;
    }

    _WorkerCtor = Worker;
    _workerSupport = true;
    return _workerSupport;
}

/**
 * @en
 * Suggest a sensible worker count for CPU-bound (compute-heavy) tasks.
 *
 * It returns `hardwareConcurrency - 1` (clamped to at least `1`), deliberately leaving one logical
 * core for the main thread (rendering + game logic). This is a *starting point*, not a universal answer:
 * I/O-bound tasks can benefit from more workers, and tiny per-frame tasks are often better off with `1`.
 *
 * On platforms without Web Worker support (or without `navigator.hardwareConcurrency`), it returns `1`.
 *
 * @zh
 * 为 CPU 密集型（重计算）任务推荐一个合理的 Worker 数量。
 *
 * 它返回 `hardwareConcurrency - 1`（至少为 `1`），刻意给主线程（渲染 + 游戏逻辑）留一个逻辑核。
 * 这是一个*起点*，不是普适答案：I/O 型任务可以开更多 Worker，而每帧的小任务往往用 `1` 个更合适。
 *
 * 在不支持 Web Worker（或没有 `navigator.hardwareConcurrency`）的平台上，返回 `1`。
 *
 * @example
 * ```ts
 * const pool = new WorkerPool(myPureFn, {
 *     maxWorkers: getOptimalWorkerCount(),
 * });
 * ```
 */
export function getOptimalWorkerCount (): number {
    if (!isWorkerSupported()) {
        return 1;
    }
    // eslint-disable-next-line no-restricted-globals
    const hc = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency)
        ? navigator.hardwareConcurrency
        : 1;
    return Math.max(1, Math.floor(hc) - 1);
}

/**
 * @en
 * Create a dedicated Web Worker from a serialized function, and wire its message protocol.
 * Used internally by [[runWorkerTask]] and [[WorkerPool]].
 * @zh
 * 从序列化函数创建一个专用 Web Worker，并接好消息协议。
 * 供 [[runWorkerTask]] 和 [[WorkerPool]] 内部使用。
 * @internal
 */
export function createWorker (fn: WorkerTask): Worker {
    if (typeof fn !== 'function') {
        throw new TypeError('WorkerTask must be a self-contained function');
    }
    if (!isWorkerSupported()) {
        throw new Error('Web Worker is not supported in the current environment');
    }
    return createWorkerFromFunction(fn);
}

function createWorkerFromFunction (fn: WorkerTask): Worker {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const WorkerCtor = _WorkerCtor!;
    const source = [
        // The serialized function is injected verbatim, then the worker simply
        // applies it to the transferred args and posts the result (or error) back.
        `'use strict';`,
        `const __fn = (${fn.toString()});`,
        `self.onmessage = function (e) {`,
        `    const msg = e.data || {};`,
        `    let reply;`,
        `    try {`,
        `        reply = { id: msg.id, ok: true, value: __fn.apply(null, msg.args || []) };`,
        `    } catch (err) {`,
        `        reply = { id: msg.id, ok: false, error: (err && (err.message || err.stack)) || String(err) };`,
        `    }`,
        `    try {`,
        `        self.postMessage(reply);`,
        `    } catch (err2) {`,
        // The result may not be structured-cloneable (e.g. it captured a function or a cyclic object).
        `        try {`,
        `            self.postMessage({ id: msg.id, ok: false, error: 'Worker result is not serializable: ' + (err2 && err2.message) });`,
        `        } catch (e3) { /* ignore */ }`,
        `    }`,
        `};`,
    ].join('\n');

    // eslint-disable-next-line no-restricted-globals
    const blob = new Blob([source], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new WorkerCtor(url);
    // The blob URL can be revoked immediately; the worker has already loaded its source synchronously.
    URL.revokeObjectURL(url);
    return worker;
}

/**
 * @en
 * Run a pure, self-contained function inside a dedicated Web Worker and resolve with its return value.
 *
 * On platforms without Web Worker support (native, minigame, Node.js server mode), it automatically
 * falls back to running the function synchronously on the main thread — the promise still resolves,
 * so callers can use the exact same code on every platform.
 *
 * @zh
 * 在专用的 Web Worker 中运行一个纯函数，并用其返回值 resolve。
 *
 * 在不支持 Web Worker 的平台（原生、小游戏、Node.js 服务端模式）上，会自动降级为在主线程同步执行——
 * promise 依然会 resolve，因此调用方在所有平台上都可以使用同一套代码。
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
export function runWorkerTask<TResult = unknown> (
    fn: WorkerTask<unknown[], TResult>,
    args?: unknown[],
    options?: WorkerRunOptions,
): Promise<TResult> {
    if (!isWorkerSupported()) {
        // Fallback: run synchronously on the main thread, keeping the promise contract intact.
        return new Promise<TResult>((resolve, reject) => {
            try {
                resolve(fn(...(args || [])));
            } catch (err) {
                reject(err);
            }
        });
    }

    return new Promise<TResult>((resolve, reject) => {
        let worker: Worker;
        try {
            worker = createWorkerFromFunction(fn as WorkerTask);
        } catch (err) {
            reject(err);
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
            worker.terminate();
        };

        worker.onmessage = (e: MessageEvent<IWorkerReply>): void => {
            if (settled) {
                return;
            }
            const msg = e.data;
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
        };

        worker.onerror = (e: ErrorEvent): void => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            reject(new Error(e.message || 'Worker error'));
        };

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

// Register the utility on the `cc` namespace so developers can call `cc.runWorkerTask(...)` / `cc.isWorkerSupported()`.
legacyCC.runWorkerTask = runWorkerTask;
legacyCC.createWorker = createWorker;
legacyCC.isWorkerSupported = isWorkerSupported;
legacyCC.getOptimalWorkerCount = getOptimalWorkerCount;

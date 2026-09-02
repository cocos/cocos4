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

import { isWorkerSupported, WorkerTask, createWorker } from './worker';
import { legacyCC } from '../core/global-exports';

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
}

/**
 * @en
 * A pool of Web Workers bound to a single self-contained task function.
 *
 * It is designed for *high-frequency* workloads (e.g. per-frame physics / crowd simulation / data processing):
 * instead of spawning and tearing down a worker for every call — which costs a Blob URL round-trip and
 * thread startup — the pool keeps a bounded set of workers alive and reuses them, releasing idle workers
 * after [[WorkerPoolOptions.idleReleaseAfter]].
 *
 * On platforms without Web Worker support, every task simply runs synchronously on the main thread,
 * so the pool is a transparent no-op wrapper.
 *
 * @zh
 * 绑定到单个自包含任务函数的 Web Worker 池。
 *
 * 它面向*高频*负载（如逐帧的物理模拟、人群模拟、数据处理）：与其每次调用都创建再销毁一个 Worker——
 * 那会付出 Blob URL 往返和线程启动的成本——池会保活一个有上限的 Worker 集合并复用，
 * 空闲超过 [[WorkerPoolOptions.idleReleaseAfter]] 的 Worker 会被释放。
 *
 * 在不支持 Web Worker 的平台上，每个任务直接在主线程同步执行，因此池是一个透明的空包装。
 *
 * @example
 * ```ts
 * const pool = new WorkerPool((n: number) => {
 *     let acc = 0;
 *     for (let i = 0; i < n; i++) acc += Math.sqrt(i);
 *     return acc;
 * }, { maxWorkers: 2, idleReleaseAfter: 1000 });
 *
 * const result = await pool.run(1_000_000);
 * // ...
 * pool.terminate();
 * ```
 */
export class WorkerPool {
    private readonly _fn: WorkerTask;
    private readonly _maxWorkers: number;
    private readonly _idleReleaseAfter: number;
    private _workers: PooledWorker[] = [];
    private _queue: PoolTask[] = [];
    private _released = false;
    private _taskId = 0;

    constructor (fn: WorkerTask, options?: WorkerPoolOptions) {
        this._fn = fn;
        this._maxWorkers = Math.max(1, (options && options.maxWorkers) || 1);
        this._idleReleaseAfter = (options && options.idleReleaseAfter) || 1000;
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
        if (this._released) {
            return;
        }
        while (this._queue.length > 0) {
            let worker = this._findIdleWorker();
            if (!worker && this._workers.length < this._maxWorkers) {
                worker = this._spawnWorker();
                this._workers.push(worker);
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
    }

    private _findIdleWorker (): PooledWorker | null {
        for (const w of this._workers) {
            if (!w.busy) {
                return w;
            }
        }
        return null;
    }

    private _spawnWorker (): PooledWorker {
        const worker = isWorkerSupported() ? createWorker(this._fn) : null;
        return new PooledWorker(worker, this._fn, this._idleReleaseAfter, this._onWorkerIdle.bind(this));
    }

    private _dispatch (worker: PooledWorker, task: PoolTask): void {
        worker.busy = true;
        worker.cancelIdleTimer();
        const id = ++this._taskId;
        worker.onComplete = (): void => {
            worker.busy = false;
            this._drain();
        };
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
    }
}

/**
 * @internal
 */
interface PoolTask {
    args: unknown[];
    transfer: Transferable[];
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
}

/**
 * @internal
 * A single pooled worker, either backed by a real Web Worker or an inline synchronous executor.
 */
class PooledWorker {
    public busy = false;
    public onComplete: (() => void) | null = null;

    private readonly _worker: Worker | null;
    private readonly _fn: WorkerTask;
    private readonly _idleReleaseAfter: number;
    private readonly _onIdle: (worker: PooledWorker) => void;
    private _current: PoolTask | null = null;
    private _idleTimer: ReturnType<typeof setTimeout> | null = null;
    private _disposed = false;

    constructor (
        worker: Worker | null,
        fn: WorkerTask,
        idleReleaseAfter: number,
        onIdle: (worker: PooledWorker) => void,
    ) {
        this._worker = worker;
        this._fn = fn;
        this._idleReleaseAfter = idleReleaseAfter;
        this._onIdle = onIdle;

        if (worker) {
            worker.onmessage = (e: MessageEvent<IWorkerReply>): void => {
                this._onMessage(e.data);
            };
            worker.onerror = (e: ErrorEvent): void => {
                this._settle(null, new Error(e.message || 'Worker error'));
            };
        }
    }

    public execute (id: number, task: PoolTask): void {
        this._current = task;
        if (!this._worker) {
            // Inline synchronous fallback (non-Worker platforms). This blocks the main thread,
            // which is the unavoidable behavior when no worker is available.
            try {
                const value = this._fn(...task.args);
                this._settle(value, null);
            } catch (err) {
                this._settle(null, err as Error);
            }
            return;
        }
        this._worker.postMessage({ id, args: task.args }, task.transfer);
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
        if (this._worker) {
            this._worker.terminate();
        }
        if (this._current) {
            this._current.reject(new Error('Worker has been disposed'));
            this._current = null;
        }
        this.onComplete = null;
    }

    private _onMessage (reply: IWorkerReply): void {
        if (!this._current) {
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

        if (error) {
            task.reject(error);
        } else {
            task.resolve(value);
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

// Register the pool on the `cc` namespace so developers can call `new cc.WorkerPool(...)`.
legacyCC.WorkerPool = WorkerPool;

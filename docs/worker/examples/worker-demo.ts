/**
 * WorkerPool 脚本模式示例：同时提交 4 个计算任务，并与主线程结果比较。
 *
 * 1. 在引擎功能配置中启用 worker-pool（会依赖 worker）。
 * 2. 将 prime-worker.js 打包为 workers/prime-worker.js；微信还需配置 game.json 的 workers 目录。
 * 3. 将此组件挂到场景节点，检查结果一致性、实际 pool.backend 和 pool.concurrency。
 *
 * Web 和标准小游戏 Worker 可按能力并发，其他小游戏 Worker 可能只有一个槽位。
 * 没有可用 Worker 或发生安全可恢复的故障时，显式 fallback 在主线程执行。
 * 计时包含 Worker 启动、消息传递和计算，设备、任务大小和预热都会影响结果；
 * 不能用单次加速比判断平台支持性，也不能把 sync fallback 当成 Worker 成功。
 */
import {
    _decorator, Component, WorkerPool, checkWorkerScript, getWorkerCapabilities,
} from 'cc';

const { ccclass } = _decorator;

const WORKER_PATH = 'workers/prime-worker.js';
const LIMIT = 200_000; // 计算小于该值的素数个数；单任务约 100~300ms，可按机器性能调整
const TASKS = 4;
// worker 收下消息却永不回复时的兜底（死锁 / 无限循环 / 平台静默丢消息）。
// 触发后 Worker 被驱逐，本示例通过 fallback 重算并降级。0 = 关闭。
const TIMEOUT = 10_000;

// 与 prime-worker.js 中 runTask(args) 完全一致的算法：
// 1) 作为串行基线计时；2) 作为无 worker 后端时的单线程降级（options.fallback）。
// 两处必须保持同步——demo 会对比二者结果来证明 worker 链路计算正确。
function countPrimes (limit: number): number {
    let count = 0;
    for (let n = 2; n < limit; n++) {
        let isPrime = true;
        for (let d = 2; d * d <= n; d++) {
            if (n % d === 0) { isPrime = false; break; }
        }
        if (isPrime) { count++; }
    }
    return count;
}

@ccclass('WorkerDemo')
export class WorkerDemo extends Component {
    public start (): void {
        this.benchmark().catch((e) => {
            console.error('[WorkerDemo] benchmark failed:', e);
        });
    }

    private async benchmark (): Promise<void> {
        // 0a) 平台能力快照——业务决定"要不要开这个特性"的正确依据。
        //     注意 parallel 与 available 的区别：7 个小游戏平台 available 为真但 parallel 为假。
        const caps = getWorkerCapabilities();
        console.log(`[WorkerDemo] capabilities: available=${caps.available} `
            + `parallel=${caps.parallel} concurrencyLimit=${caps.concurrencyLimit} `
            + `transfer=${caps.supportsTransfer} sab=${caps.supportsSharedArrayBuffer}`);
        console.log(`[WorkerDemo] capability reason: ${caps.reason}`);

        // 0b) 脚本路径预检：文件是否真的在代码包里、路径是否合法。
        //     引擎内部也做同样的检查来决定后端：平台 worker → Web Worker → fallback 单线程 → 报错。
        const status = checkWorkerScript(WORKER_PATH);
        console.log(`[WorkerDemo] checkWorkerScript: ready=${status.ready} `
            + `version=${status.version} reason="${status.reason}"`);

        // 1) 串行基线：主线程连续算 TASKS 次。
        const t0 = Date.now();
        let expected = 0;
        for (let i = 0; i < TASKS; i++) {
            expected = countPrimes(LIMIT);
        }
        const serialMs = Date.now() - t0;

        // 2) WorkerPool 并行：后端由引擎自动解析，池大小自动按平台 concurrencyLimit 封顶
        //    （7 个单 worker 平台 + 微信 V1 → 1；微信 V2 / Web → maxWorkers）。
        const pool = new WorkerPool(WORKER_PATH, {
            maxWorkers: TASKS,
            timeout: TIMEOUT,
            fallback: countPrimes, // 无任何 worker 后端时单线程兜底，保证 demo 总能跑通
        });
        console.log(`[WorkerDemo] resolved backend: ${pool.backend}`);

        const t1 = Date.now();
        let results: number[];
        try {
            results = await Promise.all(
                Array.from({ length: TASKS }, () => pool.run<number>([LIMIT])),
            );
        } finally {
            pool.terminate();
        }
        const poolMs = Date.now() - t1;

        // 3) 验证：所有任务结果必须与串行基线一致。
        const allMatch = results.every((r) => r === expected);
        console.log(`[WorkerDemo] primes below ${LIMIT} = ${expected}, results match: ${allMatch}`);

        const speedup = serialMs / Math.max(1, poolMs);
        console.log(`[WorkerDemo] serial: ${serialMs}ms | pool(${TASKS} tasks): ${poolMs}ms `
            + `| speedup: ${speedup.toFixed(2)}x`);

        // 启动和通信成本也在计时内。以结果和实际后端验收，不用加速比推断是否正确。
        if (pool.backend === 'sync') {
            console.warn('[WorkerDemo] 池已走 fallback 单线程执行，请检查平台能力、脚本打包和运行时降级日志。');
        } else if (pool.concurrency <= 1) {
            console.log('[WorkerDemo] 当前池只使用 1 个 Worker，任务可异步卸载，但不会并行执行。');
        } else {
            console.log('[WorkerDemo] 当前池支持多个 Worker；实际收益需在目标设备上重复测量。');
        }

        if (!allMatch) {
            throw new Error('[WorkerDemo] worker 脚本与 fallback 结果不一致，'
                + '请检查 prime-worker.js 与 countPrimes 算法是否同步！');
        }
    }
}

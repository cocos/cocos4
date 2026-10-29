# Worker 使用与维护

Worker 分为两个可选引擎功能：`worker` 提供 `createWorker`、`getWorkerCapabilities`、
`checkWorkerScript` 等基础 API；额外启用 `worker-pool` 才提供 `WorkerPool`。
它们不会自动把渲染、物理、音频或业务逻辑移到其他线程。

## 安装与构建

正式依赖是 `@cocos/engine-pal`，当前锁文件解析为 `1.0.5`，包含 Worker 平台实现。在 cocos4 根目录执行：

```sh
npm ci
npm run build
```

`npm run build` 先生成压缩 JS，再生成声明。日志中的 `Performance` 只统计模块分析和摇树，
后续压缩、source map 与写文件仍可能耗时数分钟，不能据此判断构建完成。
`build:min` 每 15 秒输出累计耗时，正常完成后输出完成提示，失败时退出码为 1。
是否成功仍以整个命令正常退出为准；进度提示不代表完成百分比。

`npm ci` 的 `postinstall` 会运行 `scripts/spread-pal.cjs`，将安装包的 `dist/` 复制到引擎 `pal/`。
`pal/.pal-source.json` 记录复制来源和版本。`pal/` 是生成目录，不提交，不直接修改。
仅拉取引擎代码、没有更新依赖，不等于已经安装新版 PAL。可检查：

```sh
node -p "require('./node_modules/@cocos/engine-pal/package.json').version"
```

本地修改 PAL 源码时，在 `cocos-pal` 构建后，从 cocos4 根目录同步：

```sh
node scripts/spread-pal.cjs --source ../cocos-pal/dist
npm run build
```

显式本地来源不会被构建检查自动换成 npm 包；恢复正式包时执行不带 `--source` 的
`node scripts/spread-pal.cjs`。

## 启用功能与选择模式

在 Creator 的引擎功能裁剪配置中展开 **Worker** 分组，按需要勾选子项（两项默认均关闭）：

| 功能 | ccbuild 的 features | 从 cc 可用的能力 |
| --- | --- | --- |
| 基础 Worker 功能 | `['worker']` | 创建 Worker、收发消息、查询能力，由开发者管理生命周期 |
| Worker Pool | `['worker-pool']` | 基础 Worker API，以及任务池、队列、超时和安全同步降级 |

分组标题的勾选框是全选/清空：只选基础 Worker 时显示半选；全选会同时启用 Worker Pool。
勾选 Worker Pool 会关联开启基础 Worker；取消基础 Worker 时也会取消 Worker Pool。
功能 ID 与项目已有配置保持兼容，无需迁移 `cache` 或 `includeModules`。

`worker-pool` 依赖 `worker`，Creator 会关联该依赖；直接调用 ccbuild 时，选择 `worker-pool`
也会包含两者的导出入口。`exports/worker.ts` 与 `exports/worker-pool.ts` 分别提供公开 API，
`cocos/misc/index.ts` 不导出它们。只启用 `worker` 的构建不包含线程池调度器；两项均不启用时，
也会裁掉基础 Worker API 及其 PAL Worker 依赖。完整引擎预构建仍会生成所有模块，项目构建时才按配置裁剪。

**迁移已有项目：** 之前只启用 `worker` 且使用了 `WorkerPool` 的项目，需要额外启用 `worker-pool`，
并重新构建。仅手动管理 Worker 的项目保留 `worker` 即可。`cc` 导入名称及运行时协议不变。

- **脚本模式**：`new WorkerPool('workers/task.js', options)`，适用于 Web 和提供 Worker 的小游戏环境。
- **函数模式**：`new WorkerPool(fn, options)`，Web 在具备 Worker、Blob、对象 URL 能力时创建真实 Worker；
  不支持时在主线程执行原函数。函数必须自包含，不能捕获外部变量。
- **自定义消息服务**：`createWorker(path)` 返回 `postMessage/onMessage/onError/terminate` 接口。
  它不提供任务池协议或自动同步 fallback。长期音频、网络等消息服务应自行管理消息和生命周期。

仅启用 `worker` 时可以这样自行管理：

```ts
import { createWorker, getWorkerCapabilities } from 'cc';

if (getWorkerCapabilities().available) {
    const worker = createWorker('workers/service.js');
    worker.onMessage(result => console.log(result));
    worker.onError(error => { console.error(error); worker.terminate(); });
    worker.postMessage({ command: 'compute', value: 21 });
    // 在服务结束或组件销毁时调用 worker.terminate()。
} else {
    // 由业务自行处理无 Worker 的情况。
}
```

原生和 Node.js 的 PAL Worker 入口报告不支持 JS Worker，不因宿主偶然存在全局 `Worker` 而创建它。
池可在主线程执行函数或显式 fallback；原生子系统自身的线程策略由原生实现决定。

## 脚本模式最小示例

复制 [`cc-worker-template.js`](./cc-worker-template.js) 到项目构建输出的 `workers/task.js`，
在其 `runTask(args)` 中实现计算逻辑。模板兼容 Web `self` 和小游戏 `worker` 消息入口。

```ts
import { WorkerPool } from 'cc';

const pool = new WorkerPool('workers/task.js', {
    maxWorkers: 4,
    timeout: 5000,
    fallback: (n: number) => n * 2, // 必须与脚本计算等价，并允许安全重试
});
try {
    const result = await pool.run<number>([21]);
    console.log(result, pool.backend, pool.concurrency);
} finally {
    pool.terminate();
}
```

对应脚本中的任务函数为：

```js
function runTask(args) {
    return args[0] * 2;
}
```

脚本接收 `{ id, args }`，回复 `{ id, ok: true, value }` 或 `{ id, ok: false, error }`。
自定义脚本必须保留该协议。主线程场景对象、DOM、闭包变量无法直接在 Worker 内使用。

引擎不会自动复制项目 Worker 脚本或修改小游戏打包配置。必须保证：

1. Web 的脚本路径能在最终部署地址访问，且满足同源和安全策略要求。
2. 小游戏脚本位于平台声明的 Worker 目录内。微信在构建产物 `game.json` 中配置
   `"workers": "workers"`；分包脚本需先下载分包。
3. 微信 Worker 的 `require` 依赖也在 Worker 目录内；该目录只放 JS 文件。

完整示例见 [`examples/worker-demo.ts`](./examples/worker-demo.ts) 和
[`examples/prime-worker.js`](./examples/prime-worker.js)。需启用 Worker Pool 功能并打包脚本。
示例耗时包含启动、消息传递和计算成本，加速比不是通过标准。

## 能力检测与微信 V1/V2

```ts
import { getWorkerCapabilities, checkWorkerScript } from 'cc';

console.log(getWorkerCapabilities());
console.log(checkWorkerScript('workers/task.js'));
```

`available` 表示平台报告存在 Worker 能力；`parallel` 表示并发上限大于 1。
它们不保证特定脚本可以运行。实际池状态应看 `pool.backend`（`worker / sync / none`），
实际池大小看 `pool.concurrency`。Web 的脚本加载和执行错误可能在创建后才异步报告。

PAL 1.0.5 对非标准小游戏 Worker 的并发上限保守设为 1，对标准 Worker 和 Web 不设固定平台上限；
实际创建数量仍受 `maxWorkers`、设备与运行时限制，创建可能失败。

微信 V1/V2 都使用 `wx.createWorker(path)`。PAL 以
`wx.env.isSupportStandardWorker === true` 判断标准 Worker 能力，未提供或为 false 时按单 Worker、
无 transfer 处理，不根据系统类型或版本号强行开启。`useExperimentalWorker` 不是 V2 开关。
基础库、客户端、灰度和开发者工具的当前支持范围，应查阅微信官方文档并在目标环境验证；
版本达标也不能代替能力检测。

标准 Worker 支持的 OffscreenCanvas、音频和网络能力不等于引擎会自动使用它们。
Canvas 需由主线程通过 `transferControlToOffscreen()` 转移；Worker 内平台 API 使用 `worker.xxx`。
SharedArrayBuffer 在消息中共享，不放入 transfer 列表；跨 realm 检测可用
`buffer?.constructor?.name === 'SharedArrayBuffer'`，避免依赖 `instanceof`。

## 失败恢复、transfer 与 recheck

脚本后端由 PAL 选择：优先平台 Worker；适用时再尝试全局 Web Worker；都不可用时使用显式
`options.fallback`。没有 fallback 则任务拒绝。函数模式不支持 Worker 时直接执行原函数。

- `timeout` 默认 0，表示关闭。生产脚本建议按最坏任务耗时设置超时，以处理永不回复的 Worker。
- 脚本创建失败、忙时错误、超时、畸形回复和发送异常属于基础设施失败。有 fallback 时，池降级为同步执行。
- 未移交所有权的失败任务可用 fallback 重算；已经 transfer 的任务拒绝，后续任务使用同步 fallback。
  业务必须保证 fallback 可安全重试。
- 同一次降级中，其他忙碌 Worker 完成后退役；它们随后失败时，未 transfer 的任务仍可恢复。
  `retired` 只表示不再复用，不能单独作为禁止 fallback 的依据。
- `recheck()` 刷新能力并选择新后端，推进后端代次；检查前的旧 Worker 失败只拒绝其原任务，
  不会再次熔断新后端。排队任务交给新后端，或在无后端且无 fallback 时拒绝。
- Worker 正常返回 `{ ok: false }` 属于任务计算错误，直接拒绝，不触发基础设施降级。
- 函数模式的运行时故障不自动在主线程重放原函数，避免将可能死锁的函数移到主线程。

`run(args, transfer)` 可能移交缓冲区所有权。需要恢复数据时应保留副本或能够重新生成参数。
脚本模板不自动 transfer 返回值；Web 函数模式 bootstrap 会递归收集可转移返回值，
处理循环引用、深层对象、自有属性和去重，SharedArrayBuffer 不参与 transfer。

正式构建使用错误编号，完整说明保留在 `EngineErrorMap.md` 的 16500—16516 条目；
调试构建保留详细消息。诊断参数、任务拒绝和降级行为在正式构建中仍然有效。

## 平台抽象与旧 PAL 兼容

`cocos/misc/worker-pool.ts` 只负责调度、队列、超时和恢复；`worker.ts` 管理能力快照及后端缓存。
平台 API、脚本检查、消息适配和函数 bootstrap 位于 `cocos-pal/src/worker`。
`cc.config.json` 将 `pal/worker` 映射到 web、minigame、native、nodejs 入口。

`@types/pal/worker.d.ts` 提供引擎侧独立类型契约，`tests/scripts/pal-worker-types.test.cjs`
校验其与已安装 PAL 的声明一致。它不依赖生成的兼容声明文件。

安装与各仓库构建入口调用统一的 `scripts/ensure-pal.cjs`：

1. npm 来源的 `pal/` 与已安装包版本不同：重新复制整个 PAL。
2. Worker 缺失或为引擎兼容实现，来源已有真实实现：恢复真实 Worker。
3. 来源完全没有 Worker：生成 JS 单线程兼容实现，支持未更新依赖的旧环境构建。
4. 已有真实 Worker 实现：不做局部覆盖；不完整的真实模块需要重新执行 spread 修复。

兼容实现共享文件为 `pal/worker/compat.js`，不生成根 `index.js`，避免绕过平台映射或留下解析缓存。
来源为 `--source` 的目录只从该来源恢复；不会混入 npm 的 Worker。整个 `pal/` 缺失时仍需先安装依赖。
这些检查不能代替安装新版本依赖；仅拉取引擎后继续使用旧 npm 包，仍可能使用同步兼容。
编辑器绕过仓库构建脚本时，应先完成安装和 spread。

新增 PAL 检查可在 `scripts/ensure-pal.cjs` 增加独立函数并注册到 `checks`。
检查必须幂等，修改返回 true，无需修改返回 false，无法继续构建时抛出错误。

## 测试与验收

在 cocos4 根目录执行：

```sh
npm run test:pal
npm test -- --runInBand
node scripts/test-worker-release.cjs
```

- `test:pal`：同步来源、旧 PAL 兼容、升级/降级、构建入口及类型契约。
- `tests/misc/worker-*.test.ts`：实际 PAL 产物上的平台能力、Web/微信路径、队列、生命周期、超时、
  代次隔离、并发降级、transfer 和函数 bootstrap。平台 API 为可控替身；旧 PAL 专项使用兼容模块。
- `test-worker-release.cjs`：实际编译仅 Worker、Worker Pool 及未启用两项功能的 HTML5 产物，
  检查导出、手动消息通信及 source map 模块清单，验证裁剪边界；同时保留正式错误编号、
  调度、消息协议、transfer 失败恢复及 recheck 检查。它要求安装带 Worker 的 PAL。

合入前还应在 cocos-test-projects 的 `assets/cases/scene/worker-test/worker.scene` 验收：

1. Web：对比主线程与 Worker 模式，确认结果一致、场景持续更新，池状态确为 `worker`；
   禁用 Worker API 后确认 fallback。反复切换模式和销毁场景，不应留下任务或线程。
2. 微信：检查最终 `game.json` 和脚本文件，分别验证非标准单 Worker 环境和有标准能力标志的环境；
   验证脚本缺失、未下载分包、创建失败、超时与 transfer 后失败。
3. 原生：确认不启动 JS Worker，函数或显式 fallback 在主线程运行。
4. 裁剪：在相同构建参数下对比开启/关闭 Worker，分别记录原始和压缩包体；不能用旧包或不同配置比较。

自动测试和 ccbuild 成功不代表浏览器、开发者工具或真机已通过。验收记录应包含引擎提交、PAL 版本、
平台/客户端环境、构建参数、池状态与结果；不得把 `sync` fallback 当成真实 Worker 成功。

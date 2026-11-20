# Creator Android 帧率控制落地方案

日期：2026-10-22。补充核对：2026-11-03。状态：第一批已实现实验路径并通过专项单测、Android 编译检查，待真机验收；第二至第四批待实施。

目标是修正 Android 下 `Engine::tick` 的软件限速和计时口径，并明确它与 GLES 垂直同步、Swappy 的职责边界。第一阶段只修改 Android 路径，不同时改变其他平台行为，也不直接删除全部 sleep。

分析基线：`H:\cocossolution\cocos3x` 的 `v3.8.7` 分支，提交 `6a204c1b6ca1cbe8d090d622d8697c3398def153`。设计章节中的代码为实施示意，当前 cocos4 第一批的实际改动及验证范围见下节。

2026-11-03 补充核对 `cocos4` 提交 `d0a696cfe63fd8d19c70d7913ba11aa641c2e3c7` 的 Engine、GLES3、DeviceAgent 和 ADPF 路径，纳入下述 ADPF 独立实施阶段。关联跟踪：[cocos/cocos4#372](https://github.com/cocos/cocos4/issues/372)。本次为源码核对，尚未完成真机验证。

## 第一批实施记录

第一批实现位于 `fix/android-frame-pacing-phase1` 分支，基于更新后的 `v4.0.0` 提交 `a69be8d0a7`。原始源码分析基线保留在文首，迁移时相关 Engine 计时代码无上游变更；以下为本批交付内容：

- 新增 [FramePacer.h](../native/cocos/engine/FramePacer.h)，以 Engine 实例持有时间状态，注入单调时钟和截止时间等待器；帧开始间隔、请求/实际等待、tick 墙钟耗时分别记录，超预算不补睡、晚唤醒不追赶。
- [Engine.cpp](../native/cocos/engine/Engine.cpp) 的 Android 非 XR 实验路径改用真实 start-to-start dt；`BeforeTick` 之前等待，`AfterTick` 之后记录 tick 墙钟耗时，不将该值直接用作 ADPF 样本。启动、窗口恢复/前台事件、pause/resume 和重启初始化触发下一帧重置，首帧 dt 为 0。
- FPS setter 将请求放入互斥保护的队列，在下一次 tick 的等待之前合并并应用最后一个有效请求；本轮回调内或等待期间发出的请求于下一轮生效。平台 `getFps()` 同样到该边界才更新，普通 FPS 修改保留真实 dt，以 `lastFrameStart + newInterval` 重建截止时间。0 保持忽略语义，负值和会产生不足 1 ns 周期的值不入队。
- 新增 CMake 开关 `USE_ANDROID_FRAME_PACER`，默认 `OFF`，映射为 `CC_USE_ANDROID_FRAME_PACER`。Android 非 XR 构建使用 `-DUSE_ANDROID_FRAME_PACER=ON` 启用；关闭即回到原策略。其他平台和 `CC_USE_XR=1` 构建保留旧路径。Swappy 是否接管仍由第二批实现，本批不会根据 Swappy 宏自动移除 Engine 等待。
- 新增 [frame_pacer_test.cpp](../native/tests/unit-test/src/frame_pacer_test.cpp) 的 12 项确定性测试；正常原生测试目标会包含该文件，也可独立运行，无需启动图形设备或 V8。

已执行验证：

```powershell
cmake -S native/tests/unit-test -B native/tests/unit-test/build-frame-pacer -G "Visual Studio 17 2022" -A x64 -DCC_FRAME_PACER_TESTS_ONLY=ON
cmake --build native/tests/unit-test/build-frame-pacer --config Debug --target frame_pacer_tests
ctest --test-dir native/tests/unit-test/build-frame-pacer -C Debug --output-on-failure -V
```

结果：MSVC 19.44 下 12/12 测试通过。Android NDK 26.0.10792818、arm64-v8a、API 24、Debug 下新路径的 `Engine.cpp` 对象编译通过；基于同一编译配置关闭实验开关以及启用 XR 宏的旧路径语法检查均通过。编译存在依赖库原有弃用警告。未执行全引擎链接、APK 构建、完整原生测试套件或真机测试。

边界：当前生产等待器为 `sleep_until`，无法在睡眠中处理 Looper 消息；低 FPS 下暂停、退出和 FPS 更新可能等待旧截止时间后才被处理。可中断等待需要后续与 Android 事件循环集成，本批不宣称解决此问题，也不默认启用新路径。生命周期单测验证的是计时重置契约，真实 Android 事件顺序仍须设备验收。ADPF 专项、Swappy/XR 接管及验收标准第 7 项仍属后续批次。

## 第一批诊断日志的启用与验证

在 Android 非 XR 构建的 CMake 配置中同时传入以下选项，并重新编译安装：

```text
-DUSE_ANDROID_FRAME_PACER=ON
-DUSE_ANDROID_FRAME_PACER_LOG=ON
```

`USE_ANDROID_FRAME_PACER_LOG` 默认关闭；日志开关不会单独启用新限速路径。原生日志级别须允许 INFO（`cc::LogLevel::INFO`）或 DEBUG。启用后每帧通过 `CC_LOG_INFO` 输出一行，以 `[FramePacer]` 为前缀。Windows PowerShell 可用：

```powershell
adb logcat -v threadtime | Select-String -SimpleMatch '[FramePacer]'
```

示例仅说明格式，不是真机结果：

```text
[FramePacer] frame=120 target_ms=16.666666 dt_ms=16.820000 wait_req_ms=11.600000 wait_actual_ms=11.753334 wait_overrun_ms=0.153334 tick_ms=5.100000 reset=0 fps_request=0
```

| 字段 | 含义 |
| --- | --- |
| `frame` | Engine 帧计数，用于关联相邻日志 |
| `target_ms` | 本帧生效的目标周期，毫秒 |
| `dt_ms` | 上一帧开始到本帧开始的实际间隔，毫秒；首次或重置帧为 0 |
| `wait_req_ms` | 本帧开始前按截止时间请求的等待，毫秒 |
| `wait_actual_ms` | 本帧开始前实际等待，毫秒；没有等待时为 0 |
| `wait_overrun_ms` | 实际等待减请求等待，毫秒，反映等待超时及少量测量开销 |
| `tick_ms` | 本帧实际开始到 `AfterTick` 完成的墙钟时间，包含区间内阻塞；不是纯 CPU 工作耗时或 ADPF actual |
| `reset` | 本帧是否消费了计时重置请求，1 表示启动、恢复或重启等重置边界 |
| `fps_request` | 本帧边界应用的最后一个 FPS 请求；0 表示没有应用新请求，不表示目标为 0 FPS |

验证时，`dt_ms[n]` 对应前一帧工作和本帧开始前的等待，不能将同一行的 `tick_ms + wait_actual_ms` 当成该行的 dt。连续且没有重置的样本中，可以近似使用：

```text
帧间开销[n] ≈ dt_ms[n] − tick_ms[n−1] − wait_actual_ms[n]
```

帧间开销包括上一行日志打印、平台消息处理、前置同步和计时边界的少量额外开销。60 FPS、前一帧工作约 5 ms、无显著帧间开销时，请求等待应约为 11.67 ms；如果工作及帧间开销已超过目标周期，请求和实际等待应为 0。系统晚唤醒应体现为实际等待和 dt 增大，后续帧不追赶；FPS 请求生效时 `target_ms` 更新，普通切换不清零 dt，重置帧则应显示 `reset=1 dt_ms=0`。

日志在 `endFrame()` 之后打印，因此打印耗时不包含在本行 `tick_ms` 中，但会影响下一帧间隔。逐帧日志只用于短时诊断；正式性能、功耗对照应关闭该开关。日志不拆分 VSync/GPU 等待，也不能代替 ADPF 专项或显示帧节奏验证。

## 现有实现的问题

### 平滑计算带来限速偏差

[Engine.cpp](../../cocos3x/native/cocos/engine/Engine.cpp) 中，`setPreferredFramesPerSecond` 计算目标周期，而 `tick` 使用以下逻辑：

```cpp
if (dtNS < target) {
    sleep_for(target - dtNS);
    dtNS = target;
}
// 执行帧内工作
dtNS = dtNS * 0.1 + workTime * 0.9;
```

假设目标为 60 FPS，周期为 16.667 ms；帧内工作固定 5 ms，忽略 VSync 阻塞和其他开销。稳定运行后：

```text
估算耗时 = 16.667 × 0.1 + 5 × 0.9 = 6.167 ms
下一次睡眠 = 16.667 − 6.167 = 10.5 ms
实际周期 = 10.5 + 5 = 15.5 ms
实际频率 ≈ 64.5 FPS
```

这是这些假设下的算法偏差，不是已测得的真机帧率。VSync 可能掩盖偏差，但不能修正公式本身。

### 计时范围不是完整帧周期

现有顺序为：`frameSync → sleep → BeforeTick → 开始计时 → 帧内任务 → 结束计时 → AfterTick`。

本轮实际睡眠、部分事件处理以及相邻 tick 之间的 Android 消息处理没有完整计入。计时区间内发生的提交阻塞会被计入，但不能据此认为所有 VSync 等待都在该区间内。下一轮还按历史平滑值等待，不能及时抵扣本轮已经经过的时间。

### 调度器时间与实际经过时间混用

`_scheduler->update(dt)` 和 `events::Tick::broadcast(dt)` 使用上一轮的平滑值。上述例子中，这个值约为 6.167 ms，而实际周期约为 15.5 ms。

Creator TS 层的 [Game._calculateDT](../../cocos3x/cocos/game/game.ts)另有基于 `performance.now()` 的计算，不能直接推导所有动画都会变慢。实施前须核对原生 Scheduler 和 Tick 监听器对时间参数的要求。

此外，函数内 `static` 时间状态不会随 Engine 实例重建自动清零。前台恢复、重启、FPS 修改和调度模式切换都应显式处理时间状态。

## sleep 与垂直同步的职责

| 机制 | 控制对象 | 不保证的事情 |
| --- | --- | --- |
| Engine 软件限速 | 游戏线程下一帧最早开始时间 | 精确对齐屏幕刷新相位 |
| EGL 交换间隔 | 画面交换相对于刷新周期的间隔 | CPU 每次调用都固定等待一个周期 |
| Swappy | 提交与显示之间的帧节奏 | 仅打开编译宏就一定成功接管 |

本地 [GLES3Swapchain.cpp](../../cocos3x/native/cocos/renderer/gfx-gles3/GLES3Swapchain.cpp) 将 ON 和 RELAXED 映射到间隔 1，HALF 映射到 2。间隔 1 不是固定 60 FPS：120 Hz 屏幕的一个刷新周期约为 8.33 ms。

[GLES3GPUContext.cpp](../../cocos3x/native/cocos/renderer/gfx-gles3/GLES3GPUContext.cpp) 在 Swappy 实际启用时优先调用 `SwappyGL_swap`，成功后返回，否则进入普通交换路径。不能仅凭配置名判断实际执行路径。

Android 的缓冲队列有空间时，交换调用可能较快返回；队列满时则可能等待可用缓冲区。因此，垂直同步不能直接替代游戏目标 FPS 限制。参考：[Android 游戏循环说明](https://developer.android.com/games/develop/gameloops)、[Khronos EGL 规范](https://registry.khronos.org/EGL/specs/eglspec.1.4.pdf)。

## 第一阶段 修正软件限速

### 分离时间状态

在 `Engine` 成员或独立 `FramePacer` 中维护以下状态，移除 Android 路径对函数内静态计时变量的依赖：

| 状态 | 作用 |
| --- | --- |
| `frameInterval` | 目标帧周期 |
| `nextFrameDeadline` | 下一帧允许开始的绝对时间点 |
| `lastFrameStart` | 上一帧实际开始时间 |
| `rawDt` | 两次实际开始时间之差 |
| `tickWallDuration` | tick 区间墙钟耗时，包含区间内的阻塞，仅用于诊断 |
| `adpfWorkDuration` | 完成所定义工作单元的耗时，排除已识别的纯节奏等待；独立于 rawDt 和限速预算 |
| 初始化标记及调度模式 | 控制首次运行、重置和模式切换 |

统一使用 `std::chrono::steady_clock`。目标周期使用明确的 chrono 类型或 `int64_t`，避免依赖平台相关的 `long` 宽度。

### 用绝对截止时间等待

保留重启检查等必要的前置流程，在正常帧工作和 `BeforeTick` 之前确定帧开始时间：

```cpp
using Clock = std::chrono::steady_clock;

auto now = Clock::now();
if (_softwarePacingEnabled && _pacingInitialized
    && now < _nextFrameDeadline) {
    std::this_thread::sleep_until(_nextFrameDeadline);
}

// 等待返回后必须重新读取实际时钟。
const auto frameStart = Clock::now();
const double rawDt = _hasLastFrameStart
    ? std::chrono::duration<double>(frameStart - _lastFrameStart).count()
    : 0.0;

_lastFrameStart = frameStart;
_hasLastFrameStart = true;
_nextFrameDeadline = frameStart + _frameInterval;
_pacingInitialized = true;

events::BeforeTick::broadcast();
_scheduler->update(simulationDt); // 由 rawDt 和明确的生命周期策略生成
events::Tick::broadcast(simulationDt);
// 保留原有其他帧内任务及 AfterTick。
```

删除 Android 路径原来的 `sleep_for(target - dtNS)` 和帧尾平滑公式。性能统计独立记录，不再回写逻辑时间。

这是一种基于实际帧开始时间的限速，不是固定相位锁定：每帧从实际开始时间安排下一帧，晚唤醒后不通过连跑补帧。它避免历史估算偏差，但唤醒延迟仍可能让平均 FPS 略低于目标，也不能保证长期固定显示相位。

### 抵扣已经发生的工作和等待

若目标周期为 16.667 ms：

- 已经过 12 ms，下一轮仅等待约 4.667 ms。
- 已经过 20 ms，截止时间已过，不再主动等待。
- 外部消息处理额外消耗 3 ms，会自然减少剩余等待。

这里的“已经过”以当前时钟和截止时间比较，不依赖上一帧工作耗时估算。

### 生命周期与逻辑时间

1. 首次启动不等待，首帧逻辑 dt 取 0。
2. 前台恢复和引擎重启重置时间状态，不把后台停留时间作为一次逻辑更新。
3. FPS 修改在游戏线程生效，同时重建截止时间；本轮及下一轮的使用规则应固定并测试。
4. 拒绝负 FPS；FPS 为 0 暂保持现有忽略行为，避免无意改变 API 契约。
5. 跨线程设置通过任务队列投递，不直接并发读写时间点。
6. 正常帧使用真实 `rawDt`。调试器暂停或异常长帧若需钳制，应设置单独、可测试的策略，并同时记录原始值与实际使用值；不要用平滑公式隐藏长帧。

长睡眠会影响同线程消息响应。低 FPS 或后台场景应评估可中断的截止时间等待；生命周期中断时返回循环处理事件，而不是提前执行一帧。第一阶段不新增忙等或高优先级线程策略。

## 第二阶段 统一帧节奏控制

### 调度状态

建议显式维护软件限速、Swappy 接管和 XR 接管三种模式。模式名称是新增设计，不是现有 API。

- 普通 EGL：保留垂直同步，使用修正后的软件限速。交换阻塞已经经过的时间自然抵扣后续等待。
- Swappy：成功初始化、目标间隔设置完成且当前持续提交画面时，停用 Engine 的软件目标 FPS 等待，保留真实帧时间统计。
- 无画面提交或 Swappy 不可用：进入明确的软件限速模式，不能只依赖不存在的交换阻塞。
- XR：遵循 XR Runtime 帧调度，单独处理，不直接套用普通 Android 窗口策略。

编译宏只能表示是否编入 Swappy。运行时状态还须涵盖初始化结果、Surface 有效性、提交模式和失败状态。提交线程向游戏线程报告状态时使用队列或受控同步；模式变化时重置截止时间。

### FPS 更新与失败处理

目标 FPS 改变时，同时更新 Engine 周期、实际启用的 Swappy 间隔和 ADPF 工作预算。不能只在 Swapchain 创建时读取一次 FPS。ADPF 工作预算须与所测工作单元对应，不能从实测等待时间反推；若 Swappy 自动调整节奏，应明确实际节奏与配置目标的对应策略。

单次 `SwappyGL_swap` 失败应记录并执行已有 EGL 回退；是否持续关闭 Swappy应有明确策略，避免逐帧反复切换。需要跨线程交接时，下个安全帧边界再应用新模式，不在提交中途修改时钟状态。

## 第三阶段 修正 ADPF 工作耗时反馈

### 当前实现与问题边界

当前 cocos4 的 [ADPFManager](../native/cocos/platform/android/adpf_manager.cpp) 在 `BeforeTick` 调用 `beginPerfHintSession()`，在 `AfterTick` 调用 `endPerfHintSession()`；后者把 `steady_clock::now() - perf_start_` 直接上报。因此 Engine 软件 sleep 当前位于计时区间外，但区间内的 `eglSwapBuffers` / `SwappyGL_swap` 阻塞可能被计入。仅完成第一阶段的软件限速改造不会自动修复此问题。

[DeviceAgent::present](../native/cocos/renderer/gfx-agent/DeviceAgent.cpp) 在渲染线程完成 `actor->present()` 后发出信号，游戏线程通过 `_frameBoundarySemaphore.wait()` 受到背压。当前 GLES 的 `frameSync()` 不承担这项等待，不能认为多线程模式已把交换等待移到 `BeforeTick` 之前。非 XR 模式允许 CPU 提前一帧，等待对应的完成信号不一定属于本次提交；渲染消费线程还会加入同一 hint session，必须同时核对工作边界和帧归属。

合理结论是：工作完成后用于限帧或等待显示节奏的纯等待不应计入 ADPF 工作耗时，而不是“开启 VSync 就固定扣掉一段时间”。GPU fence、缓冲队列背压和整个 swap 调用可能混合实际工作与等待，不能一律扣除。线程被抢占、等待必要工作线程完成也不能机械排除；ADPF actual duration 不是线程 CPU 占用时间的简单求和。

官方定义是线程组完成本次任务所用的时间，系统据此调整性能，使实际耗时接近目标。将纯节奏等待计入会掩盖工作余量，这是控制原理上的判断，不代表已验证必然升频或某个固定功耗增幅。参考：[Android Session API](https://developer.android.com/reference/android/os/PerformanceHintManager.Session#reportActualWorkDuration(long))、[AOSP Performance Hint API](https://source.android.com/docs/core/perf/performance-hint-api)。

### 实施步骤与约束

1. 先增加诊断记录：工作帧号、计时起止、渲染完成帧号、线程、swap 墙钟耗时、信号量等待以及可确认的纯节奏等待。各时间戳使用同一单调时钟；多线程结果通过队列交接，不直接并发修改 session 或计时状态。
2. 在实际执行路径定义工作单元的开始与完成边界，覆盖游戏及必要渲染线程工作。不能仅把游戏线程的 end 移到 `present()` 前面，否则可能漏算渲染线程尚未完成的工作；也不能用 `tickWallDuration - presentDuration` 作为通用实现。
3. 对可明确分离的纯节奏等待，在工作边界外计时或按同帧有效区间排除。跨线程并行和嵌套等待不能直接相加，不能扣掉与必要工作重叠的时间，也不能扣到相邻帧。无法可靠拆分的 EGL/Swappy 路径先保留诊断并标记尚未修复，不以估算或统一扣减代替正确测量；新上报策略在该路径验证前不启用。
4. `rawDt` 保留完整帧开始间隔，`tickWallDuration` 保留区间内阻塞，只有 `adpfWorkDuration` 按已验证边界排除纯节奏等待。ADPF 统计不得回写逻辑时间或软件限速预算，不通过额外 GPU 强制同步改变流水线以便计时。
5. FPS 更新在明确帧边界生效，使该帧 actual 与对应 target 配对。target 变化时更新 session 并保存 `last_target_`，重建 session 使用最新值；当前代码更新 target 后未保存该成员，重建时可能回到 16.67 ms。避免不必要的逐帧 target 更新，校验 FPS、正时长、session 有效性和返回结果。
6. 前后台、重启、Surface 失效和渲染模式切换时废弃未完成样本，清理帧关联状态；无工作时不提交零值或伪造样本。session 创建、重建、线程集合变更和上报需要受控串行化，防止跨线程生命周期竞争。

本阶段使用独立实验开关，与软件限速和 Swappy 接管分别验证、分别回退。新增 CPU/GPU 分项 API 的适配不作为本阶段默认前提，若采用须另列系统版本与能力检测方案。

与 issue #372 跨平台方案的交付顺序对应：本文件第三阶段作为独立 Android ADPF PR，安排在该 issue 的 PR 4（Swappy/XR 接管）之后、原 PR 5（默认启用与清理）之前；诊断字段及假时钟测试可以提前加入 PR 1。本文批次仅描述 Android 子方案，不替代 issue 中其他平台的适配顺序。Android ADPF 新策略通过专项验收后才能纳入默认启用，未验证后端保留旧策略及明确诊断。

## 修改范围与交付顺序

原方案在 `cocos3x/docs` 和 `cocos4/docs` 各有副本。本次补充更新 cocos4 文档，未同步修改 cocos3x 副本。原软件限速分析链接仍指向 cocos3x，新增 ADPF 分析链接指向本仓库；不得将两个版本实现视为相同。cocos4 的已核对范围见文首，完整生命周期及其他后端仍需实施时验证。

| 批次 | 文件或模块 | 交付内容 |
| --- | --- | --- |
| 第一批 | `native/cocos/engine/Engine.h`、`Engine.cpp`、`FramePacer.h`、配置与 CMake | Android 新计时成员、截止时间限速、生命周期重置、默认关闭的实验开关（本地已实现） |
| 第一批 | 原生单元测试 | 可注入时钟和等待器的算法测试 |
| 第二批 | GLES2/GLES3 Swapchain 和 GPUContext | Swappy 实际状态、FPS 更新、失败上报 |
| 第二批 | Engine 与 Android 生命周期流程 | 接管模式切换、无提交回退、前后台处理 |
| 第三批 | `platform/android/adpf_manager.h/.cpp`、Engine FPS/生命周期入口 | ADPF 工作口径、target 配对及保存、样本重置和 session 安全检查 |
| 第三批 | `gfx-agent/DeviceAgent`、`base/threading/MessageQueue`、GLES2/GLES3 执行路径 | 工作帧关联、完成边界、等待分类、跨线程结果交接；各后端分别验证 |
| 第三批 | 原生单元测试、诊断与实验开关 | 可注入计时的 ADPF 测试、独立启用和回退 |
| 第四批 | 性能统计及真机记录 | 限速、Swappy、ADPF 分别及组合对照，帧节奏与功耗分析 |

保留可切换旧实现的实验开关，默认策略在真机对照通过后确定。不要把 GLES2、XR 或其他系统后端视为 GLES3 普通 EGL 的等价路径。

## 验收标准

### 自动化测试

通过可注入的假时钟和等待器验证算法，不依赖测试机器真实睡眠精度：

1. 目标 16.667 ms、工作 5 ms，下一轮请求等待约 11.667 ms，不是 10.5 ms。
2. 目标 16.667 ms、工作 20 ms，不调用等待器。
3. 工作 5 ms、帧间消息处理 3 ms，剩余等待约 8.667 ms。
4. 模拟晚唤醒 2 ms，`rawDt` 包含这 2 ms；不连跑追赶丢失的周期。
5. 首帧、恢复前台、重启后首帧 dt 符合约定，不包含停留时间。
6. FPS 切换后不沿用旧截止时间；负值和 0 按约定处理。
7. Swappy 接管期间不调用 Engine 软件等待器，退出后重新初始化限速状态。

ADPF 补充测试（使用假时钟、模拟渲染完成事件和上报接口）：

1. 工作 5 ms、工作结束后纯节奏等待 11.667 ms：帧开始间隔约 16.667 ms，ADPF actual 约 5 ms，target 保持对应工作预算，不能以等待填满 actual。
2. 必要工作线程晚完成、线程被抢占和混合 GPU 等待：不因主线程处于阻塞状态就全部扣除，不把整个 swap 当作纯等待。
3. CPU 提前一帧、渲染完成延迟、等待嵌套或与必要工作重叠：样本与帧号正确关联，无跨帧扣减、重复扣减和漏算渲染工作。
4. FPS 切换和 session 重建：actual 与该帧 target 配对，`last_target_` 保持最新预算；前后台与模式切换丢弃未完成样本，不混入后台时间。
5. session 不可用、无工作或计时数据无效：不崩溃，不上报零/负时长或伪造数据，保留诊断原因。

### 真机对照

测试 60、90、120 Hz 屏幕上的 30、60 FPS 目标；区分普通 EGL 与实际启用 Swappy，分别覆盖轻负载、突发长帧、持续超预算、前后台切换和运行时 FPS 修改。

记录 `targetInterval`、`rawDt`、`tickWallDuration`、`adpfWorkDuration`、ADPF target、工作与完成帧号、请求睡眠、实际睡眠、唤醒超时、swap 墙钟耗时、信号量等待、已确认排除的纯节奏等待、当前模式及显示帧间隔。分析均值、P95/P99、长帧比例与 CPU 占用，不只看平均 FPS。

ADPF 额外覆盖单线程/多线程、普通 EGL/Swappy、VSync 开关（设备支持时）、CPU/GPU 瓶颈与无提交场景。通过系统 trace 核对线程执行、调度等待及 GPU/显示事件，确认只排除纯节奏等待；以相同设备、场景和热状态比较 ADPF 旧/新上报及关闭 ADPF 的行为，记录 CPU 频率、功耗和温度，不预设固定节能收益。不能证明正确拆分的路径不得宣称 ADPF 修复验收通过。

通过标准：无算法性重复补睡、无追赶连跑、生命周期时间正确；同设备同场景下帧节奏不因新策略恶化。真机误差阈值应依据设备基线确定，不预设所有机型都能达到固定的亚毫秒唤醒误差。90 Hz 屏幕上的 60 FPS 不具备整数刷新周期比，也不能要求每个显示帧间隔都相同。

## 回退与边界

第一批、第二批和第三批独立提交，分别可回退。发生输入响应变差、原生调度器行为变化、帧间隔恶化、Swappy 模式反复切换，或 ADPF 样本错配、频率/功耗回归时，保留统计信息并切回对应旧策略，不同时重构渲染路径。

“更精确”指时间测量正确、等待预算不依赖历史猜测、帧调度职责明确。`sleep_until` 不是实时调度保证；本方案不承诺纳秒级唤醒、零掉帧或仅凭软件 sleep 就能锁定显示相位。

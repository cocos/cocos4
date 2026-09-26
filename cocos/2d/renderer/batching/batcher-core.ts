/*
 Copyright (c) 2022-2023 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

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

import { JSB } from 'internal:constants';
import { Device, Sampler, Texture } from '../../../gfx';
import { Node } from '../../../scene-graph';
import { MeshBuffer as UIMeshBuffer } from '../mesh-buffer';
import { DrawBatch2D } from '../draw-batch';
import { Stage } from '../stencil-manager';
import { NativeBatcherCore } from './native-batcher-core';
import { WebBatcherCore } from './web-batcher-core';
import { BufferManager } from './buffer-manager';
import { BatchGenerator } from './batch-generator';
import type { MaskHandler } from './mask-handler';
import type { IBatcher } from '../i-batcher';

export { WebBatcherCore } from './web-batcher-core';
export { NativeBatcherCore } from './native-batcher-core';

// ══════════════════════════════════════════════════════════════════
// BatchMergeParams — decoupled parameters for batch merging
// ══════════════════════════════════════════════════════════════════

/**
 * @en
 * Parameters needed for batch merge, extracted from the rendering component
 * to avoid coupling BatchGenerator to UIRenderer directly.
 *
 * @zh
 * 批次合并所需的参数，从渲染组件中提取，避免 BatchGenerator 直接耦合 UIRenderer。
 */
export interface BatchMergeParams {
    /** Stencil stage of the current component. */
    stencilStage: Stage;
    /** Whether the component has a custom material assigned. */
    hasCustomMaterial: boolean;
    /** Node layer of the current component. */
    nodeLayer: number;
    /** Optional static batch root that owns the DrawBatch (for UIStaticBatch). */
    staticDrawBatchFn?: () => DrawBatch2D;
}

// ══════════════════════════════════════════════════════════════════
// IBatcherCore — unified platform abstraction
// ══════════════════════════════════════════════════════════════════

/**
 * @en Core batcher interface. Every rendering operation the facade needs is routed through
 * this interface. WebBatcherCore and NativeBatcherCore provide the two implementations.
 *
 * @zh 核心合批器接口。门面需要的每个渲染操作都通过此接口路由。
 * WebBatcherCore 和 NativeBatcherCore 提供两种实现。
 */
export interface IBatcherCore {
    // ── Lifecycle ─────────────────────────────────────────────────
    initialize (): boolean;
    update (): void;
    uploadBuffers (): void;
    reset (): void;
    destroy (): void;

    // ── Data sync ─────────────────────────────────────────────────
    syncRootNodes (rootNodes: Node[]): void;
    syncMeshBuffersToNative (accId: number, buffers: UIMeshBuffer[]): void;

    // ── Cache management ──────────────────────────────────────────
    releaseDescriptorSetCache (textureOrHash: number | Texture | null, sampler: Sampler | null): void;

    // ── Native injection (JSB path) ───────────────────────────────
    set nativeObj (value: any);

}

// ══════════════════════════════════════════════════════════════════
// Static: sorting2D count tracker
// ══════════════════════════════════════════════════════════════════

let sorting2DCount = 0;

export function setSorting2DCount (v: number): void {
    sorting2DCount = v;
}

export function getSorting2DCount (): number {
    return sorting2DCount;
}

// ══════════════════════════════════════════════════════════════════
// createBatcherCore — platform factory (tree-shaken by rollup)
// ══════════════════════════════════════════════════════════════════

/**
 * @en Creates the platform-appropriate {@link IBatcherCore} implementation.
 * At build time, rollup sees `JSB` as a compile-time constant:
 * - `JSB = false`: only WebBatcherCore + BatchGenerator are kept
 * - `JSB = true`:  only NativeBatcherCore is kept
 *
 * @zh 创建平台对应的 {@link IBatcherCore} 实现。
 * 构建时 rollup 将 `JSB` 视为编译期常量。
 */
export function createBatcherCore (
    batcher: IBatcher,
    device: Device,
    bufferManager: BufferManager,
    maskHandler: MaskHandler,
): IBatcherCore {
    if (JSB) {
        return new NativeBatcherCore();
    }
    return new WebBatcherCore(batcher, device, bufferManager, maskHandler);
}

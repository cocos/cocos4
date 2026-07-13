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

import { Sampler, Texture } from '../../../gfx';
import { Node } from '../../../scene-graph';
import { MeshBuffer as UIMeshBuffer } from '../mesh-buffer';
import type { NativeBatcher2d } from '../native-2d';
import type { BatchGenerator } from './batch-generator';
import type { IBatcherCore } from './batcher-core';

/**
 * @en Native implementation of {@link IBatcherCore}.
 * Every lifecycle method delegates to C++ {@link cc::Batcher2d} via JSB.
 * Commit/batch methods are no-ops since C++ handles the full render pipeline.
 *
 * @zh {@link IBatcherCore} 的原生实现。
 * 生命周期方法通过 JSB 委托给 C++ {@link cc::Batcher2d}。
 * Commit/批次方法是空操作，因为 C++ 处理完整的渲染管线。
 */
export class NativeBatcherCore implements IBatcherCore {
    private _nativeObj: NativeBatcher2d | null = null;

    /**
     * @en Injects the C++ Batcher2d JSB object. Called by Root._createBatcher2D()
     * after construction.
     *
     * @zh 注入 C++ Batcher2d JSB 对象。由 Root._createBatcher2D() 在构造后调用。
     */
    set nativeObj (value: any) {
        this._nativeObj = value;
    }

    // ── Lifecycle ─────────────────────────────────────────────────

    initialize (): boolean {
        return true;
    }

    update (): void {
        this._nativeObj!.update();
    }

    uploadBuffers (): void {
        this._nativeObj!.uploadBuffers();
    }

    reset (): void {
        this._nativeObj!.reset();
    }

    destroy (): void {}

    // ── Data sync ─────────────────────────────────────────────────

    syncRootNodes (rootNodes: Node[]): void {
        this._nativeObj!.syncRootNodesToNative(rootNodes);
    }

    syncMeshBuffersToNative (accId: number, buffers: UIMeshBuffer[]): void {
        // JSB boundary: UIMeshBuffer.nativeObj is untyped
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        const nativeBuffers = buffers.map((buf) => (buf as any).nativeObj);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this._nativeObj!.syncMeshBuffersToNative(accId, nativeBuffers);
    }

    // ── Cache management ──────────────────────────────────────────

    releaseDescriptorSetCache (textureOrHash: number | Texture | null, sampler: Sampler | null): void {
        if (typeof textureOrHash === 'number') {
            return;
        }
        this._nativeObj!.releaseDescriptorSetCache(textureOrHash as Texture, sampler as Sampler);
    }

    // ── Batch runtime — no-op: C++ handles the full pipeline ──────

    get generator (): BatchGenerator | null { return null; }

    autoMergeBatches (_staticRoot: any): void {}
    insertMaskBatch (_comp: any, _frameCount: number): void {}
    walk (_node: any): void {}
    forceMergeBatches (_material: any, _frame: any, _customMaterial: boolean, _stencil: any, _layer: number): void {}
    resetRenderStates (): void {}
    finishMergeBatches (): void {}
    flushMaterial (_mat: any): void {}
}

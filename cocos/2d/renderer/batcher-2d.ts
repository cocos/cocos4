/*
 Copyright (c) 2019-2023 Xiamen Yaji Software Co., Ltd.

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

import { Camera } from '../../render-scene/scene';
import { RenderRoot2D } from '../framework';
import {
    Texture, Device, Attribute, Sampler,
} from '../../gfx';
import { cclegacy } from '../../core';
import { Root } from '../../root';
import { Node } from '../../scene-graph';
import { StencilManager } from './stencil-manager';
import { IBatcher } from './i-batcher';
import { StaticVBAccessor } from './static-vb-accessor';
import { vfmtPosUvColor } from './vertex-format';
import { NativeBatcher2d } from './native-2d';
import { MeshBuffer } from './mesh-buffer';

import { IBatcherCore, createBatcherCore, setSorting2DCount } from './batching/batcher-core';
import { BufferManager } from './batching/buffer-manager';
import { MaskHandler } from './batching/mask-handler';

// Re-export for backward compatibility (sorting/sorting-2d.ts imports this).
export const _setSorting2DCount = setSorting2DCount;

/**
 * @en
 * UI rendering process.
 * Batcher2D acts as a FACADE: platform-agnostic methods delegate to the
 * {@link IBatcherCore} implementation.
 *
 * @zh
 * UI 渲染流程。
 * Batcher2D 作为门面：平台无关的方法委托给 {@link IBatcherCore} 实现。
 */
export class Batcher2D implements IBatcher {
    /** JSB bridge: C++ Batcher2d instance, injected by Root._createBatcher2D(). */
    private _nativeObj: NativeBatcher2d | null = null;
    /** Platform-specific core implementation (NativeBatcherCore | WebBatcherCore). */
    private _core: IBatcherCore;
    /** Shared / static vertex-buffer accessor pool. */
    private _bufferManager: BufferManager;
    /** Mask stencil batch handler. */
    private _maskHandler: MaskHandler;
    /** Managed Canvas list (render roots). */
    private _screens: RenderRoot2D[] = [];
    /** GFX device, injected from Root. */
    public declare device: Device;

    // ══════════════════════════════════════════════════════════════
    // Property accessors
    // ══════════════════════════════════════════════════════════════

    /** @en Returns the underlying native Batcher2d JSB object. */
    public get nativeObj (): NativeBatcher2d {
        return this._nativeObj!;
    }

    /**
     * @en Injects the C++ Batcher2d JSB object.
     * Called by Root._createBatcher2D() after construction.
     *
     * @zh 注入 C++ Batcher2d JSB 对象。由 Root._createBatcher2D() 在构造后调用。
     */
    public set nativeObj (value: NativeBatcher2d) {
        this._nativeObj = value;
        this._core.nativeObj = value;
    }

    // ══════════════════════════════════════════════════════════════
    // Platform-agnostic methods
    // ══════════════════════════════════════════════════════════════

    // ── Construction ─────────────────────────────────────────────

    constructor (private _root: Root) {
        this.device = _root.device;
        this._bufferManager = new BufferManager(this.device);
        this._maskHandler = new MaskHandler(StencilManager.sharedManager!);
        this._core = createBatcherCore(this, this.device, this._bufferManager, this._maskHandler);
    }

    /** @en Returns the underlying {@link IBatcherCore}. */
    public get core (): IBatcherCore {
        return this._core;
    }

    // ── Lifecycle ─────────────────────────────────────────────────

    public initialize (): boolean {
        return true;
    }

    public destroy (): void {
        this._core.destroy();
        this._bufferManager.destroy();
        this._maskHandler.destroy();
        StencilManager.sharedManager!.destroy();
    }

    // ── Screen management ────────────────────────────────────────

    /**
     * @en
     * Add the managed Canvas.
     *
     * @zh
     * 添加屏幕组件管理。
     *
     * @param comp @en The render root of 2d.
     *             @zh 2d 渲染入口组件。
     */
    public addScreen (comp: RenderRoot2D): void {
        this._screens.push(comp);
        this._screens.sort(this._screenSort);
        this._core.syncRootNodes(this._screens.map((s) => s.node));
    }

    /**
     * @zh
     * Removes the Canvas from the list.
     *
     * @param comp @en The target to removed.
     *             @zh 被移除的屏幕。
     */
    public removeScreen (comp: RenderRoot2D): void {
        const idx = this._screens.indexOf(comp);
        if (idx === -1) {
            return;
        }
        this._screens.splice(idx, 1);
        this._core.syncRootNodes(this._screens.map((s) => s.node));
    }

    public sortScreens (): void {
        this._screens.sort(this._screenSort);
        this._core.syncRootNodes(this._screens.map((s) => s.node));
    }

    public getFirstRenderCamera (node: Node): Camera | null {
        if (node.scene && node.scene.renderScene) {
            const cameras = node.scene.renderScene.cameras;
            for (let i = 0; i < cameras.length; i++) {
                const camera = cameras[i];
                if (camera.visibility & node.layer) {
                    return camera;
                }
            }
        }
        return null;
    }

    // ── Frame update ─────────────────────────────────────────────

    public update (): void {
        this._core.update();
    }

    public uploadBuffers (): void {
        this._core.uploadBuffers();
    }

    public reset (): void {
        this._core.reset();
    }

    // ── Buffer accessor (delegated to BufferManager) ─────────────

    /**
     * @zh 如果有必要，为相应的顶点布局切换网格缓冲区。
     * @en Switch the mesh buffer for corresponding vertex layout if necessary.
     */
    public switchBufferAccessor (attributes: Attribute[] = vfmtPosUvColor): StaticVBAccessor {
        return this._bufferManager.switchAccessor(attributes);
    }

    public registerBufferAccessor (key: number, accessor: StaticVBAccessor): void {
        this._bufferManager.registerAccessor(key, accessor);
    }

    // ── Descriptor cache release ─────────────────────────────────

    /**
     * @en Release the descriptor set cache associated with a texture.
     * @zh 释放与纹理关联的 descriptor set 缓存。
     */
    public releaseDescriptorSetCache (textureOrHash: number | Texture | null, sampler: Sampler | null = null): void {
        this._core.releaseDescriptorSetCache(textureOrHash, sampler);
    }

    // ── Mesh buffer sync ─────────────────────────────────────────

    public syncMeshBuffersToNative (accId: number, buffers: MeshBuffer[]): void {
        this._core.syncMeshBuffersToNative(accId, buffers);
    }

    // ── Helpers ──────────────────────────────────────────────────

    private _screenSort (a: RenderRoot2D, b: RenderRoot2D): number {
        return a.node.siblingIndex - b.node.siblingIndex;
    }
}

// Global registration
cclegacy.internal.Batcher2D = Batcher2D;

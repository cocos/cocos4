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

import { Camera, Model } from '../../render-scene/scene';
import type { UIStaticBatch } from '../components/ui-static-batch';
import { Material } from '../../asset/assets/material';
import { RenderRoot2D, UIRenderer } from '../framework';
import {
    Texture, Device, Attribute, Sampler,
    InputAssembler, DepthStencilState,
} from '../../gfx';
import { CachedArray, cclegacy } from '../../core';
import { Root } from '../../root';
import { Node } from '../../scene-graph';
import { Stage, StencilManager } from './stencil-manager';
import { DrawBatch2D } from './draw-batch';
import { TextureBase } from '../../asset/assets/texture-base';
import { IBatcher } from './i-batcher';
import { StaticVBAccessor } from './static-vb-accessor';
import { vfmtPosUvColor } from './vertex-format';
import { BaseRenderData, MeshRenderData } from './render-data';
import { UIMeshRenderer } from '../components/ui-mesh-renderer';
import { NativeBatcher2d } from './native-2d';
import { MeshBuffer } from './mesh-buffer';
import { IAssembler } from './base';
import type { Director } from '../../game/director';

import { IBatcherCore, createBatcherCore, setSorting2DCount } from './batching/batcher-core';
import { BufferManager } from './batching/buffer-manager';
import { MaskHandler } from './batching/mask-handler';

// Re-export for backward compatibility (sorting/sorting-2d.ts imports this).
export const _setSorting2DCount = setSorting2DCount;

/**
 * @en
 * UI rendering process.
 * Batcher2D acts as a FACADE: platform-agnostic methods delegate to the
 * {@link IBatcherCore} implementation. Web-only methods (Assembler interaction,
 * walk, commit) are grouped at the bottom with explicit guards.
 *
 * @zh
 * UI 渲染流程。
 * Batcher2D 作为门面：平台无关的方法委托给 {@link IBatcherCore} 实现。
 * 仅 Web 平台执行的方法（Assembler 交互、walk、commit）集中在底部并带有明确守卫。
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
    /** Current UIStaticBatch root, if batching into a static batch. */
    private _currStaticRoot: UIStaticBatch | null = null;
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

    // ── IBatcher accessors ───────────────────────────────────────

    get currBufferAccessor (): StaticVBAccessor {
        return this._bufferManager.activeAccessor;
    }

    get batches (): CachedArray<DrawBatch2D> {
        const gen = this._core.generator;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return gen ? gen.batches : new CachedArray(0);
    }

    set currStaticRoot (value: UIStaticBatch | null) {
        this._currStaticRoot = value;
    }

    /** @deprecated since v3.8.7 */
    set currIsStatic (value: boolean) {
    }

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

    public updateBuffer (attributes: Attribute[], bid: number): void {
        this._bufferManager.trackBuffer(attributes, bid);
    }

    // ── Static batch ─────────────────────────────────────────────

    public setupStaticBatch (staticComp: UIStaticBatch, bufferAccessor: StaticVBAccessor): void {
        this._core.finishMergeBatches();
        this._bufferManager.setActiveAccessor(bufferAccessor);
        this.currStaticRoot = staticComp;
    }

    public endStaticBatch (): void {
        this._core.finishMergeBatches();
        this.currStaticRoot = null;
        this._bufferManager.setActiveAccessor(null);
        this.switchBufferAccessor();
    }

    // ── Batch merging (delegated to core) ────────────────────────

    /**
     * @en End a section of render data and submit according to the batch condition.
     * @zh 根据合批条件，结束一段渲染数据并提交。
     */
    public autoMergeBatches (): void {
        this._core.autoMergeBatches(this._currStaticRoot);
    }

    public forceMergeBatches (material: Material, frame: TextureBase | null, renderComp: UIRenderer): void {
        this._core.forceMergeBatches(
            material,
            frame,
            renderComp.customMaterial !== null,
            renderComp.stencilStage,
            renderComp.node.layer,
        );
    }

    public resetRenderStates (): void { this._core.resetRenderStates(); }
    public finishMergeBatches (): void { this._core.finishMergeBatches(); }
    public flushMaterial (mat: Material): void { this._core.flushMaterial(mat); }

    // ── Descriptor cache release ─────────────────────────────────

    /**
     * @en Release the descriptor set cache associated with a texture.
     * @zh 释放与纹理关联的 descriptor set 缓存。
     */
    public releaseDescriptorSetCache (textureOrHash: number | Texture | null, sampler: Sampler | null = null): void {
        this._core.releaseDescriptorSetCache(textureOrHash, sampler);
    }

    // ── Mesh buffer sync ─────────────────────────────────────────

    public walk (node: Node, level = 0): void {
        const gen = this._core.generator;
        if (gen) {
            this._core.walk(node);
        }
    }

    public syncMeshBuffersToNative (accId: number, buffers: MeshBuffer[]): void {
        this._core.syncMeshBuffersToNative(accId, buffers);
    }

    // ══════════════════════════════════════════════════════════════
    // Web-only methods
    //
    // These methods are ONLY executed on the Web (non-JSB) platform.
    // On JSB, C++ Batcher2d handles the full render pipeline, and
    // the `if (!gen) return` guard at each entry returns immediately.
    // The guard reads `this._core.generator` which is null on JSB.
    // ══════════════════════════════════════════════════════════════

    // ── Static batch commit (web-only) ───────────────────────────

    /**
     * @en Submit separate render data. Web-only.
     * @zh 提交独立渲染数据。仅 Web 平台执行。
     */
    public commitStaticBatch (comp: UIStaticBatch): void {
        const gen = this._core.generator;
        if (!gen) return;
        gen.batches.concat(comp.drawBatchList);
        this._core.finishMergeBatches();
    }

    // ── Commit methods (Assembler callbacks, web-only) ────────────

    /**
     * @en
     * Render component data submission process of UI.
     * The submitted vertex data is the UI for world coordinates.
     * Web-only: JSB path never enters walk → commitComp.
     *
     * @zh
     * UI 渲染组件数据提交流程（针对提交的顶点数据是世界坐标的提交流程）。
     * 仅 Web 平台执行：JSB 路径不会进入 walk → commitComp。
     */
    public commitComp (
        comp: UIRenderer,
        renderData: BaseRenderData | null,
        frame: TextureBase | null,
        assembler: IAssembler,
        transform: Node | null,
    ): void {
        const gen = this._core.generator;
        if (!gen) return;

        let dataHash = 0;
        let mat;
        let bufferID = -1;
        if (renderData && renderData.chunk) {
            if (!renderData.isValid()) return;
            dataHash = renderData.dataHash;
            mat = renderData.material;
            bufferID = renderData.chunk.bufferId;
        }
        // Notice: A little hack, if it is for mask, not need update here, while control by stencilManger
        if (comp.stencilStage === Stage.ENTER_LEVEL || comp.stencilStage === Stage.ENTER_LEVEL_INVERTED) {
            this._core.insertMaskBatch(comp, (cclegacy.director as Director).getTotalFrames());
        } else {
            comp.stencilStage = StencilManager.sharedManager!.stage;
        }
        const depthStencilStateStage = comp.stencilStage;

        if (gen.currHash !== dataHash || dataHash === 0
            || gen.currMaterial !== mat
            || gen.currDepthStencilStateStage !== depthStencilStateStage) {
            this.autoMergeBatches();
            if (renderData && !renderData._isMeshBuffer) {
                this.updateBuffer(renderData.vertexFormat, bufferID);
            }

            gen.setBatchState(
                comp.customMaterial !== null,
                comp.getRenderMaterial(0)!,
                depthStencilStateStage,
                comp.node.layer,
                transform,
                renderData as MeshRenderData,
                frame,
            );
        }

        if (assembler.fillBuffers) assembler.fillBuffers(comp, this);
    }

    /**
     * @en
     * Render component data submission process for individual [[gfx.InputAssembler]].
     * Web-only. JSB path never enters this code.
     * @deprecated since v3.6.2, please use [[commitMiddleware]] instead.
     *
     * @zh
     * 渲染组件中针对独立 [[gfx.InputAssembler]] 的提交流程。仅 Web 平台执行。
     * @deprecated since v3.6.2, 请使用 [[commitMiddleware]]。
     */
    public commitIA (renderComp: UIRenderer, ia: InputAssembler, tex?: TextureBase, mat?: Material, transform?: Node): void {
        const gen = this._core.generator;
        if (!gen) return;

        if (gen.currMaterial !== null) {
            this.autoMergeBatches();
            this.resetRenderStates();
        }
        let depthStencil: DepthStencilState | null = null;
        let dssHash = 0;
        if (renderComp) {
            renderComp.stencilStage = StencilManager.sharedManager!.stage;
            if (renderComp.customMaterial !== null) {
                depthStencil = StencilManager.sharedManager!.getStencilStage(renderComp.stencilStage, mat);
            } else {
                depthStencil = StencilManager.sharedManager!.getStencilStage(renderComp.stencilStage);
            }
            dssHash = StencilManager.sharedManager!.getStencilHash(renderComp.stencilStage);
        }

        const curDrawBatch = this._currStaticRoot ? this._currStaticRoot._requireDrawBatch() : gen.drawBatchPool.alloc();
        curDrawBatch.visFlags = renderComp.node.layer;
        curDrawBatch.inputAssembler = ia;
        curDrawBatch.useLocalData = transform || null;
        if (tex) {
            curDrawBatch.texture = tex.getGFXTexture();
            curDrawBatch.sampler = tex.getGFXSampler();
            curDrawBatch.textureHash = tex.getHash();
            curDrawBatch.samplerHash = curDrawBatch.sampler.hash;
        }
        curDrawBatch.fillPasses(mat || null, depthStencil, dssHash, null);
        gen.batches.push(curDrawBatch);
    }

    /**
     * @en
     * Render component data submission process for middleware2d components.
     * Web-only. JSB path never enters this code.
     *
     * @zh
     * 渲染组件中针对2D中间件组件渲染数据的提交流程。仅 Web 平台执行。
     */
    public commitMiddleware (
        comp: UIRenderer,
        meshBuffer: MeshBuffer,
        indexOffset: number,
        indexCount: number,
        tex: TextureBase,
        mat: Material,
        enableBatch: boolean,
    ): void {
        const gen = this._core.generator;
        if (!gen) return;

        const texture = tex.getGFXTexture();

        if (enableBatch && gen.currIsMiddleware && gen.middlewareBuffer === meshBuffer
            && gen.currTexture === texture
            && (gen.currMaterial && gen.currMaterial.hash === mat.hash)
            && gen.middlewareIndexStart + gen.middlewareIndexCount === indexOffset
            && gen.currLayer === comp.node.layer) {
            gen.middlewareIndexCount += indexCount;
        } else {
            this.autoMergeBatches();
            this.resetRenderStates();

            gen.setBatchState(
                comp.customMaterial !== null,
                mat,
                comp.stencilStage,
                comp.node.layer,
                enableBatch ? null : comp.node,
                null,
                tex,
            );
            gen.setMiddlewareBatchState(meshBuffer, indexOffset, indexCount);
        }
    }

    /**
     * @en
     * Render component data submission process of UI (local coordinates).
     * For Graphics and UIModel. Web-only. JSB path never enters this code.
     *
     * @zh
     * UI 渲染组件数据提交流程（针对 Graphics 和 UIModel 等数据量较为庞大的 ui 组件）。
     * 仅 Web 平台执行。
     */
    public commitModel (comp: UIMeshRenderer | UIRenderer, model: Model | null, mat: Material | null): void {
        const gen = this._core.generator;
        if (!gen) return;

        if (gen.currMaterial !== null) {
            this.autoMergeBatches();
            this.resetRenderStates();
        }

        let depthStencil: DepthStencilState | null = null;
        let dssHash = 0;
        if (mat) {
            if (comp.stencilStage === Stage.ENTER_LEVEL || comp.stencilStage === Stage.ENTER_LEVEL_INVERTED) {
                this._core.insertMaskBatch(comp, (cclegacy.director as Director).getTotalFrames());
            } else {
                comp.stencilStage = StencilManager.sharedManager!.stage;
            }
            depthStencil = StencilManager.sharedManager!.getStencilStage(comp.stencilStage, mat);
            dssHash = StencilManager.sharedManager!.getStencilHash(comp.stencilStage);
        }

        const stamp: number = (cclegacy.director as Director).getTotalFrames();
        if (model) {
            model.updateTransform(stamp);
            model.updateUBOs(stamp);
        }

        for (let i = 0; i < model!.subModels.length; i++) {
            const curDrawBatch = gen.drawBatchPool.alloc();
            const subModel = model!.subModels[i];
            curDrawBatch.visFlags = comp.node.layer;
            curDrawBatch.model = model;
            curDrawBatch.texture = null;
            curDrawBatch.sampler = null;
            curDrawBatch.useLocalData = null;
            if (!depthStencil) { depthStencil = null; }
            curDrawBatch.fillPasses(mat, depthStencil, dssHash, subModel.patches);
            curDrawBatch.inputAssembler = subModel.inputAssembler;
            curDrawBatch.model!.visFlags = curDrawBatch.visFlags;
            curDrawBatch.descriptorSet = subModel.descriptorSet;
            gen.batches.push(curDrawBatch);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────

    private _screenSort (a: RenderRoot2D, b: RenderRoot2D): number {
        return a.node.siblingIndex - b.node.siblingIndex;
    }
}

// Global registration
cclegacy.internal.Batcher2D = Batcher2D;

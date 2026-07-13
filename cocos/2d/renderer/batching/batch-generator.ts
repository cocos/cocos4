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

import { DepthStencilState, Device, InputAssembler, Sampler, Texture } from '../../../gfx';
import { CachedArray, Pool } from '../../../core';
import { Node } from '../../../scene-graph';
import { Material } from '../../../asset/assets';
import { TextureBase } from '../../../asset/assets/texture-base';
import { DrawBatch2D } from '../draw-batch';
import { MeshRenderData } from '../render-data';
import { Stage, StencilManager } from '../stencil-manager';
import { DescriptorCache } from './descriptor-cache';
import { BufferManager } from './buffer-manager';
import type { BatchMergeParams } from './batcher-core';

export class BatchGenerator {
    // ── Batch output ────────────────────────────────────────────
    private _batches: CachedArray<DrawBatch2D>;
    private _drawBatchPool: Pool<DrawBatch2D>;
    private _meshDataArray: MeshRenderData[] = [];

    // ── Current batch state ─────────────────────────────────────
    private _currHash = 0;
    private _currHasCustomMaterial = false;
    private _currMaterial: Material | null = null;
    private _currRenderData: MeshRenderData | null = null;
    private _currTexture: Texture | null = null;
    private _currSampler: Sampler | null = null;
    private _currTextureHash = 0;
    private _currSamplerHash = 0;
    private _currLayer = 0;
    private _currDepthStencilStateStage: Stage | null = null;
    private _currTransform: Node | null = null;

    // Middleware batching
    private _currIsMiddleware = false;
    private _middlewareBuffer: any = null; // MeshBuffer reference
    private _middlewareIndexStart = 0;
    private _middlewareIndexCount = 0;

    // ── Dependencies ─────────────────────────────────────────────
    private _descriptorCache: DescriptorCache;
    private _bufferManager: BufferManager;

    constructor (
        private _device: Device,
        descriptorCache?: DescriptorCache,
        bufferManager?: BufferManager,
    ) {
        this._batches = new CachedArray(64);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this._drawBatchPool = new Pool(() => new DrawBatch2D(), 128, (obj) => obj.destroy(this as any));
        this._descriptorCache = descriptorCache || new DescriptorCache();
        this._bufferManager = bufferManager || new BufferManager(_device);
    }

    // ── Accessors ────────────────────────────────────────────────

    get batches (): CachedArray<DrawBatch2D> { return this._batches; }
    get drawBatchPool (): Pool<DrawBatch2D> { return this._drawBatchPool; }
    get descriptorCache (): DescriptorCache { return this._descriptorCache; }
    get bufferManager (): BufferManager { return this._bufferManager; }
    get meshDataArray (): MeshRenderData[] { return this._meshDataArray; }

    get currHash (): number { return this._currHash; }
    set currHash (h: number) { this._currHash = h; }

    get currHasCustomMaterial (): boolean { return this._currHasCustomMaterial; }
    set currHasCustomMaterial (v: boolean) { this._currHasCustomMaterial = v; }

    get currMaterial (): Material | null { return this._currMaterial; }
    set currMaterial (m: Material | null) { this._currMaterial = m; }

    get currRenderData (): MeshRenderData | null { return this._currRenderData; }
    set currRenderData (r: MeshRenderData | null) { this._currRenderData = r; }

    get currTexture (): Texture | null { return this._currTexture; }
    set currTexture (t: Texture | null) { this._currTexture = t; }

    get currSampler (): Sampler | null { return this._currSampler; }
    set currSampler (s: Sampler | null) { this._currSampler = s; }

    get currTextureHash (): number { return this._currTextureHash; }
    set currTextureHash (h: number) { this._currTextureHash = h; }

    get currSamplerHash (): number { return this._currSamplerHash; }
    set currSamplerHash (h: number) { this._currSamplerHash = h; }

    /**
     * @en
     * Atomically set all batch state for a new batch section.
     * Called when the 4-condition batch check triggers a break.
     * @zh
     * 原子性设置新批次段的所有状态。当 4 条件合批检查触发断批时调用。
     */
    setBatchState (
        hasCustomMaterial: boolean,
        material: Material,
        stencilStage: Stage,
        layer: number,
        transform: Node | null,
        renderData: MeshRenderData | null,
        frame: TextureBase | null,
    ): void {
        this._currHash = renderData ? renderData.dataHash : 0;
        this._currHasCustomMaterial = hasCustomMaterial;
        this._currMaterial = material;
        this._currDepthStencilStateStage = stencilStage;
        this._currLayer = layer;
        this._currTransform = transform;
        if (frame) {
            const sampler = frame.getGFXSampler();
            this._currTexture = frame.getGFXTexture();
            this._currSampler = sampler;
            this._currTextureHash = frame.getHash();
            this._currSamplerHash = sampler ? sampler.hash : 0;
        } else {
            this._currTexture = null;
            this._currSampler = null;
            this._currTextureHash = 0;
            this._currSamplerHash = 0;
        }
        if (renderData) {
            this._currRenderData = renderData;
        }
    }

    get currLayer (): number { return this._currLayer; }
    set currLayer (l: number) { this._currLayer = l; }

    get currTransform (): Node | null { return this._currTransform; }
    set currTransform (t: Node | null) { this._currTransform = t; }

    get currDepthStencilStateStage (): Stage | null { return this._currDepthStencilStateStage; }
    set currDepthStencilStateStage (s: Stage | null) { this._currDepthStencilStateStage = s; }

    /**
     * @en
     * Set middleware-specific batch state (MeshBuffer and index range).
     * Called together with {@link setBatchState} when a middleware component starts a new batch.
     * @zh
     * 设置中间件特有的批次状态（MeshBuffer 和索引范围）。
     * 中间件组件开新批次时与 {@link setBatchState} 一起调用。
     */
    setMiddlewareBatchState (
        meshBuffer: any,
        indexOffset: number,
        indexCount: number,
    ): void {
        this._currIsMiddleware = true;
        this._middlewareBuffer = meshBuffer;
        this._middlewareIndexStart = indexOffset;
        this._middlewareIndexCount = indexCount;
    }

    get currIsMiddleware (): boolean { return this._currIsMiddleware; }
    set currIsMiddleware (v: boolean) { this._currIsMiddleware = v; }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    get middlewareBuffer (): any { return this._middlewareBuffer; }
    set middlewareBuffer (b: any) { this._middlewareBuffer = b; }

    get middlewareIndexStart (): number { return this._middlewareIndexStart; }
    set middlewareIndexStart (v: number) { this._middlewareIndexStart = v; }

    get middlewareIndexCount (): number { return this._middlewareIndexCount; }
    set middlewareIndexCount (v: number) { this._middlewareIndexCount = v; }

    // ── Batch merging ────────────────────────────────────────────

    /**
     * @en
     * End a section of render data and submit according to the batch condition.
     * Decoupled from UIRenderer — accepts stencil stage and other params directly.
     *
     * @zh
     * 根据合批条件，结束一段渲染数据并提交。解耦自 UIRenderer。
     */
    mergeBatches (
        params: BatchMergeParams,
        bufferId: number,
        indexStart: number,
        staticBatchProvider: { _requireDrawBatch(): DrawBatch2D } | null,
    ): void {
        if (this._currIsMiddleware) {
            this.mergeBatchesForMiddleware(params, staticBatchProvider);
            return;
        }
        const mat = this._currMaterial;
        if (!mat) return;

        let ia: InputAssembler | undefined;
        const rd = this._currRenderData;

        // Previous batch using MeshRenderData (independent buffer)
        if (rd && rd._isMeshBuffer) {
            ia = rd.requestIA(this._device);
            if (this._meshDataArray.indexOf(rd) === -1) {
                this._meshDataArray.push(rd);
            }
        } else {
            // Previous batch using static VB buffer
            const accessor = this._bufferManager.activeAccessor;
            if (!accessor) return;
            const buf = accessor.getMeshBuffer(bufferId);
            if (!buf) return;
            const indexCount = buf.indexOffset - indexStart;
            if (indexCount <= 0) return;
            buf.setDirty();
            ia = buf.requireFreeIA(this._device);
            ia.firstIndex = indexStart;
            ia.indexCount = indexCount;
        }

        if (!ia || !this._currTexture) return;

        // Stencil state
        let depthStencil: DepthStencilState | null = null;
        let dssHash = 0;
        const stencilMgr = StencilManager.sharedManager!;
        if (params.hasCustomMaterial) {
            depthStencil = stencilMgr.getStencilStage(params.stencilStage, mat);
        } else {
            depthStencil = stencilMgr.getStencilStage(params.stencilStage);
        }
        dssHash = stencilMgr.getStencilHash(params.stencilStage);

        const curDrawBatch = (staticBatchProvider)
            ? staticBatchProvider._requireDrawBatch()
            : this._drawBatchPool.alloc();

        curDrawBatch.visFlags = this._currLayer;
        curDrawBatch.texture = this._currTexture;
        curDrawBatch.sampler = this._currSampler;
        curDrawBatch.inputAssembler = ia;
        curDrawBatch.useLocalData = this._currTransform;
        curDrawBatch.textureHash = this._currTextureHash;
        curDrawBatch.samplerHash = this._currSamplerHash;
        curDrawBatch.fillPasses(mat, depthStencil, dssHash, null);

        this._batches.push(curDrawBatch);
    }

    /**
     * @en
     * Merge batch for middleware (Spine, DragonBones) rendering.
     * @zh
     * 中间件（Spine、DragonBones）渲染的合批。
     */
    mergeBatchesForMiddleware (
        params: BatchMergeParams,
        staticBatchProvider: { _requireDrawBatch(): DrawBatch2D } | null,
    ): void {
        const stencilMgr = StencilManager.sharedManager!;
        let depthStencil: DepthStencilState | null = null;
        let dssHash = 0;

        const stage = stencilMgr.stage;
        if (params.hasCustomMaterial) {
            depthStencil = stencilMgr.getStencilStage(stage, this._currMaterial!);
        } else {
            depthStencil = stencilMgr.getStencilStage(stage);
        }
        dssHash = stencilMgr.getStencilHash(stage);

        const curDrawBatch = (staticBatchProvider)
            ? staticBatchProvider._requireDrawBatch()
            : this._drawBatchPool.alloc();

        curDrawBatch.visFlags = params.nodeLayer;
        const ia = this._middlewareBuffer.requireFreeIA(this._device);
        ia.firstIndex = this._middlewareIndexStart;
        ia.indexCount = this._middlewareIndexCount;

        curDrawBatch.inputAssembler = ia;
        curDrawBatch.useLocalData = this._currTransform;
        curDrawBatch.texture = this._currTexture;
        curDrawBatch.sampler = this._currSampler;
        curDrawBatch.textureHash = this._currTextureHash;
        curDrawBatch.samplerHash = this._currSamplerHash;
        curDrawBatch.fillPasses(this._currMaterial, depthStencil, dssHash, null);
        this._batches.push(curDrawBatch);

        this._currIsMiddleware = false;
        this._middlewareBuffer = null;
    }

    /**
     * @en
     * Reset all batch state — start a new batching section.
     * @zh
     * 重置所有批次状态——开始新的合批段。
     */
    resetBatchStates (): void {
        this._currHash = 0;
        this._currHasCustomMaterial = false;
        this._currMaterial = null;
        this._currRenderData = null;
        this._currTexture = null;
        this._currSampler = null;
        this._currTextureHash = 0;
        this._currSamplerHash = 0;
        this._currLayer = 0;
        this._currTransform = null;
        this._currDepthStencilStateStage = null;
        this._currIsMiddleware = false;
        this._middlewareBuffer = null;
        this._middlewareIndexStart = 0;
        this._middlewareIndexCount = 0;
    }

    // ── Lifecycle ────────────────────────────────────────────────

    uploadBuffers (): void {
        if (this._batches.length > 0) {
            const length = this._meshDataArray.length;
            for (let i = 0; i < length; i++) {
                this._meshDataArray[i].uploadBuffers();
            }
            this._bufferManager.uploadBuffers();
            this._descriptorCache.update();
        }
    }

    reset (): void {
        for (let i = 0; i < this._batches.length; ++i) {
            const batch = this._batches.array[i];
            if (batch && !batch.isStatic) {
                batch.clear();
                this._drawBatchPool.free(batch);
            }
        }
        const length = this._meshDataArray.length;
        for (let i = 0; i < length; i++) {
            this._meshDataArray[i].freeIAPool();
        }
        this._meshDataArray.length = 0;

        this._batches.clear();
        this._bufferManager.reset();
        this.resetBatchStates();
        StencilManager.sharedManager!.reset();
    }

    destroy (): void {
        for (let i = 0; i < this._batches.length; i++) {
            if (this._batches.array[i]) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                this._batches.array[i].destroy(this as any);
            }
        }
        this._batches.destroy();
        this._drawBatchPool.destroy();
        this._bufferManager.destroy();
        this._descriptorCache.destroy();
    }
}

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

import { DEBUG, USE_SORTING_2D } from 'internal:constants';
import { Device, Sampler, Texture, DepthStencilState } from '../../../gfx';
import { Node } from '../../../scene-graph';
import { MeshBuffer as UIMeshBuffer } from '../mesh-buffer';
import { DrawBatch2D } from '../draw-batch';
import { Stage, StencilManager } from '../stencil-manager';
import { DescriptorCache } from './descriptor-cache';
import { BufferManager } from './buffer-manager';
import { BatchGenerator } from './batch-generator';
import { getSorting2DCount } from './batcher-core';
import type { IBatcherCore } from './batcher-core';
import type { UIStaticBatch } from '../../components/ui-static-batch';
import type { IBatcher } from '../i-batcher';
import type { UIMeshRenderer } from '../../components/ui-mesh-renderer';
import { UIRenderer } from '../../framework';
import type { MaskHandler } from './mask-handler';
import type { Director } from '../../../game/director';

import { approx, EPSILON, RecyclePool, cclegacy, Mat4 } from '../../../core';
import { RenderEntityFillColorType, RenderEntityType } from '../render-entity';
import type { RenderEntity } from '../render-entity';
import { RenderDrawInfoType } from '../render-draw-info';
import type { RenderDrawInfo } from '../render-draw-info';
import type { RenderData, MeshRenderData } from '../render-data';

// ── RecordedRendererInfo ──────────────────────────────────────────

interface RecordedRendererInfo {
    uiRenderer: UIRenderer | null;
    finalOpacity: number;
    opacityDirty: boolean;
}

// ══════════════════════════════════════════════════════════════════
// WebBatcherCore — IBatcherCore for Web (non-JSB) platform
// ══════════════════════════════════════════════════════════════════

/**
 * @en Web-platform implementation of {@link IBatcherCore}.
 * Holds the full scene-graph walk and the per-frame update logic
 * (walk → commit → merge → scene dispatch).
 *
 * @zh {@link IBatcherCore} 的 Web 平台实现。
 * 持有完整的场景图遍历和逐帧更新逻辑（walk → commit → merge → scene dispatch）。
 */
export class WebBatcherCore implements IBatcherCore {
    // ── Dependencies ─────────────────────────────────────────────
    private _screens: Node[] = [];
    private _descriptorCache: DescriptorCache;
    private _generator: BatchGenerator;

    /** IBatcher reference (the facade) — needed by walk → Assembler callbacks. */
    private _batcher: IBatcher;

    /** Mask handler for stencil operations during walk. */
    private _maskHandler: MaskHandler;

    // ── Walk state ───────────────────────────────────────────────
    private _pOpacity = 1;
    private _opacityDirty = 0;

    // ── SORTING_2D state ────────────────────────────────────────
    private _recordedRendererInfoQueue: RecordedRendererInfo[] = [];
    private _recordedPool = new RecyclePool<RecordedRendererInfo>(() => ({
        uiRenderer: null,
        finalOpacity: 0,
        opacityDirty: false,
    }), 128);

    // ── Construction ─────────────────────────────────────────────

    constructor (
        batcher: IBatcher,
        device: Device,
        private _bufferManager: BufferManager,
        maskHandler: MaskHandler,
    ) {
        this._batcher = batcher;
        this._maskHandler = maskHandler;
        this._descriptorCache = new DescriptorCache();
        this._generator = new BatchGenerator(device, this._descriptorCache, _bufferManager);
    }

    // ── Native injection (no-op on Web) ───────────────────────────

    set nativeObj (_value: any) {}

    // ── Lifecycle ─────────────────────────────────────────────────

    public initialize (): boolean { return true; }

    /**
     * @en
     * Per-frame entry point for the 2D rendering pipeline (Web platform).
     * Executes the following phases for each registered screen (Canvas):
     *   1. **Walk** — depth-first traversal of the scene graph starting from
     *      the screen root node. For every active UIRenderer, cascaded opacity
     *      is computed, RenderDrawInfo entries are dispatched to type-specific
     *      handlers (COMP / MODEL / MIDDLEWARE / SUB_NODE), vertex/index data
     *      is filled, and batch-break conditions are evaluated.
     *   2. **Merge** — after the full walk, the last pending batch is flushed
     *      via `autoMergeBatches`, and batch states are reset for the next screen.
     *   3. **Assign** — each DrawBatch2D is given a descriptorSet (either from
     *      the shared DescriptorCache or from the model's own subModel) and
     *      a monotonically increasing priority for draw-order, then added to
     *      the RenderScene for the rendering pipeline to consume.
     *   4. (uploadBuffers / reset are called separately by the facade after
     *      all screens have been processed.)
     *
     * @zh
     * 2D 渲染管线的逐帧入口（Web 平台）。
     * 对每个已注册的屏幕（Canvas）执行以下阶段：
     *   1. **遍历（Walk）** — 从屏幕根节点开始深度优先遍历场景图。对每个
     *      活跃的 UIRenderer 计算级联透明度，将 RenderDrawInfo 分发到类型
     *      对应的处理器（COMP / MODEL / MIDDLEWARE / SUB_NODE），填充顶点/索引
     *      数据，并评估断批条件。
     *   2. **合批（Merge）** — 遍历完成后，通过 `autoMergeBatches` 刷新最后
     *      一个待处理批次，并重置批次状态以备下一个屏幕使用。
     *   3. **分配（Assign）** — 为每个 DrawBatch2D 分配 descriptorSet（来自
     *      共享的 DescriptorCache 或 model 自身的 subModel），设置单调递增的
     *      priority 以确定绘制顺序，然后添加到 RenderScene 供渲染管线消费。
     *   4. （uploadBuffers / reset 由门面在所有屏幕处理完后单独调用。）
     */
    public update (): void {
        const gen = this._generator;
        const screens = this._screens;
        let offset = 0;

        for (let i = 0; i < screens.length; ++i) {
            const screenNode = screens[i];
            // Skip inactive screen roots. A disabled RenderRoot2D already removes itself via
            // removeScreen; this also covers a root whose node went inactive (mirrors the old
            // enabledInHierarchy guard without coupling the core to RenderRoot2D).
            if (!screenNode.activeInHierarchy) continue;
            const scene = screenNode.scene ? screenNode.scene.renderScene : null;
            if (!scene) continue;

            this._pOpacity = 1;
            this._opacityDirty = 0;
            this.walk(screenNode);

            if (USE_SORTING_2D && getSorting2DCount() > 0) {
                this._flushRecordedUIRenderers();
                this._recordedPool.reset();
            }

            this.autoMergeBatches(null);
            this.resetRenderStates();

            let batchPriority = 0;
            if (gen.batches.length > offset) {
                for (; offset < gen.batches.length; ++offset) {
                    const batch = gen.batches.array[offset];
                    if (batch.model) {
                        const subModels = batch.model.subModels;
                        for (let j = 0; j < subModels.length; j++) {
                            subModels[j].priority = batchPriority++;
                        }
                    } else {
                        batch.descriptorSet = this._descriptorCache.getDescriptorSet(batch);
                    }
                    scene.addBatch(batch);
                }
            }
        }
    }

    public uploadBuffers (): void { this._generator.uploadBuffers(); }
    public reset (): void { this._generator.reset(); }
    public destroy (): void { this._generator.destroy(); }

    // ── Data sync ─────────────────────────────────────────────────

    public syncRootNodes (rootNodes: Node[]): void { this._screens = rootNodes; }
    public syncMeshBuffersToNative (_accId: number, _buffers: UIMeshBuffer[]): void {}

    // ── Cache ─────────────────────────────────────────────────────

    public releaseDescriptorSetCache (textureOrHash: number | Texture | null, _sampler: Sampler | null): void {
        if (typeof textureOrHash === 'number') {
            this._descriptorCache.releaseByTexture(textureOrHash);
        } else if (textureOrHash) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            this._descriptorCache.releaseByTexture((textureOrHash as any)._textureHash || 0);
        }
    }

    // ── Batch runtime ─────────────────────────────────────────────

    public autoMergeBatches (staticRoot: UIStaticBatch | null): void {
        const gen = this._generator;

        const params = {
            stencilStage: gen.currDepthStencilStateStage || Stage.DISABLED,
            hasCustomMaterial: gen.currHasCustomMaterial,
            nodeLayer: gen.currLayer,
            staticDrawBatchFn: undefined as (() => DrawBatch2D) | undefined,
        };

        if (staticRoot) {
            params.staticDrawBatchFn = (): DrawBatch2D => staticRoot._requireDrawBatch();
        }

        gen.mergeBatches(params, this._bufferManager.currentBufferId, this._bufferManager.indexStart, staticRoot);
    }

    public forceMergeBatches (material: any, frame: any, customMaterial: boolean, stencil: any, layer: number): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this._generator.setBatchState(customMaterial, material, stencil, layer, null, null, frame);
        this.autoMergeBatches(null);
    }

    public finishMergeBatches (): void {
        this.autoMergeBatches(null);
        this._generator.resetBatchStates();
    }

    public resetRenderStates (): void { this._generator.resetBatchStates(); }
    public flushMaterial (mat: any): void { this._generator.currMaterial = mat; }

    // ══════════════════════════════════════════════════════════════
    // Scene-graph walk (Web-only)
    //
    // The walk traverses the node tree depth-first, dispatching
    // each UIRenderer's RenderDrawInfo list to the appropriate
    // handler, calculating cascaded opacity, and handling
    // Mask stencil transitions.
    // ══════════════════════════════════════════════════════════════

    /**
     * @en Walk through the scene graph and update rendering data for each UI node.
     * @zh 遍历场景图并更新每个 UI 节点的渲染数据。
     */
    public walk (node: Node, level = 0): void {
        if (!node.activeInHierarchy) {
            return;
        }
        const children = node.children;
        const uiProps = node._uiProps;
        const render = uiProps.uiComp as UIRenderer | null;

        const parentOpacity = this._pOpacity;
        let opacity = parentOpacity;
        const selfOpacity = render && render.color ? render.color.a / 255 : 1;
        this._pOpacity = opacity *= selfOpacity * uiProps.localOpacity;
        uiProps.setOpacity(opacity);

        const visible = !approx(opacity, 0, EPSILON);
        if (visible) {
            if (uiProps.colorDirty) {
                this._opacityDirty++;
            }
            if (render) {
                if (USE_SORTING_2D && getSorting2DCount() > 0) {
                    if (render.stencilStage === Stage.ENTER_LEVEL || render.stencilStage === Stage.ENTER_LEVEL_INVERTED) {
                        this._flushRecordedUIRenderers();

                        this.autoMergeBatches(null);
                        this.resetRenderStates();
                    }
                    this._recordUIRenderer(render, opacity, !!this._opacityDirty);
                } else {
                    this._handleUIRenderer(render, opacity, !!this._opacityDirty);
                }
            }

            if (children.length > 0) {
                const entity = render ? render.renderEntity : null;
                const isCrossed = entity && entity.renderEntityType === RenderEntityType.CROSSED
                    && entity.getRenderDrawInfosSize() > 0;
                if (!isCrossed) {
                    for (let i = 0; i < children.length; ++i) {
                        const child = children[i];
                        this.walk(child, level);
                    }
                }
            }

            if (uiProps.colorDirty) {
                this._opacityDirty--;
                uiProps.colorDirty = false;
            }
        }
        this._pOpacity = parentOpacity;

        if (render && render.enabledInHierarchy) {
            if (!USE_SORTING_2D || getSorting2DCount() === 0) {
                render.postUpdateAssembler(this._batcher);
            }
            if (visible && (render.stencilStage === Stage.ENTER_LEVEL || render.stencilStage === Stage.ENTER_LEVEL_INVERTED)) {
                if (USE_SORTING_2D && getSorting2DCount() > 0) {
                    this._flushRecordedUIRenderers();
                }

                if (StencilManager.sharedManager!.getMaskStackSize() > 0) {
                    this.autoMergeBatches(null);
                    this.resetRenderStates();
                    StencilManager.sharedManager!.exitMask();
                }
            }
        }

        level += 1;
    }

    // ── Walk helpers ─────────────────────────────────────────────

    private _handleUIRenderer (render: UIRenderer, finalOpacity: number, opacityDirty: boolean): void {
        if (!render || !render.enabledInHierarchy) return;

        const entity: RenderEntity = render.renderEntity;
        const size = entity.getRenderDrawInfosSize();
        for (let i = 0; i < size; i++) {
            const drawInfo = entity.getRenderDrawInfoAt(i);
            this._handleDrawInfo(render, drawInfo, finalOpacity, opacityDirty);
        }
    }

    /**
     * @en Dispatch a single draw info by its type — the TS mirror of native `Batcher2d::handleDrawInfo`.
     * @zh 按类型分发单个 draw info —— 对应 native `Batcher2d::handleDrawInfo`。
     */
    private _handleDrawInfo (
        render: UIRenderer,
        drawInfo: RenderDrawInfo,
        finalOpacity: number,
        opacityDirty: boolean,
    ): void {
        switch (drawInfo.drawInfoType) {
        case RenderDrawInfoType.COMP:
            this._handleComponentDraw(render, drawInfo, finalOpacity, opacityDirty);
            break;
        case RenderDrawInfoType.MODEL:
            this._handleModelDraw(render, drawInfo);
            break;
        case RenderDrawInfoType.MIDDLEWARE:
            this._handleMiddlewareDraw(render, drawInfo);
            break;
        case RenderDrawInfoType.SUB_NODE:
            this._handleSubNode(drawInfo);
            break;
        default:
            break;
        }
    }

    /**
     * @en Inlined MODEL commit — the TS mirror of native `Batcher2d::handleModelDraw`.
     * Reads the model + material from the RenderDrawInfo and emits one
     * DrawBatch2D per subModel (MODEL draws never batch with anything, so the current batch is flushed
     * first). Used by Graphics and UIMeshRenderer.
     * @zh 内联的 MODEL 提交，对应 native `handleModelDraw`。从 RenderDrawInfo
     * 读取 model + material，为每个 subModel 产出一个 DrawBatch2D。
     */
    private _handleModelDraw (render: UIRenderer, drawInfo: RenderDrawInfo): void {
        const gen = this._generator;
        const model = drawInfo.model;
        const mat = drawInfo.material;

        // MODEL draws never merge — flush the pending batch first.
        if (gen.currMaterial !== null) {
            this.autoMergeBatches(null);
            this.resetRenderStates();
        }

        let depthStencil: DepthStencilState | null = null;
        let dssHash = 0;
        if (mat) {
            if (render.stencilStage === Stage.ENTER_LEVEL || render.stencilStage === Stage.ENTER_LEVEL_INVERTED) {
                this.insertMaskBatch(render, (cclegacy.director as Director).getTotalFrames());
            } else {
                render.stencilStage = StencilManager.sharedManager!.stage;
            }
            depthStencil = StencilManager.sharedManager!.getStencilStage(render.stencilStage, mat);
            dssHash = StencilManager.sharedManager!.getStencilHash(render.stencilStage);
        }

        if (!model) return;
        const stamp = (cclegacy.director as Director).getTotalFrames();
        model.updateTransform(stamp);
        model.updateUBOs(stamp);

        const subModels = model.subModels;
        for (let i = 0; i < subModels.length; i++) {
            const subModel = subModels[i];
            const curDrawBatch = gen.drawBatchPool.alloc();
            curDrawBatch.visFlags = render.node.layer;
            curDrawBatch.model = model;
            curDrawBatch.texture = null;
            curDrawBatch.sampler = null;
            curDrawBatch.useLocalData = null;
            curDrawBatch.fillPasses(mat, depthStencil, dssHash, subModel.patches);
            curDrawBatch.inputAssembler = subModel.inputAssembler;
            curDrawBatch.model!.visFlags = curDrawBatch.visFlags;
            curDrawBatch.descriptorSet = subModel.descriptorSet;
            gen.batches.push(curDrawBatch);
        }
    }

    /**
     * @en Inlined MIDDLEWARE commit — the TS mirror of native `Batcher2d::handleMiddlewareDraw`.
     * Reads material/texture/meshBuffer/indexOffset/ibCount from the RenderDrawInfo and merges
     * contiguous segments (same texture/material/meshBuffer/layer and adjacent index ranges).
     * Used by Spine, DragonBones, and TiledLayer (tile geometry).
     * @zh 内联的 MIDDLEWARE 提交，对应 native `handleMiddlewareDraw`。从 RenderDrawInfo 读取
     * material/texture/meshBuffer/indexOffset/ibCount，按索引连续性合并相邻段。
     */
    private _handleMiddlewareDraw (render: UIRenderer, drawInfo: RenderDrawInfo): void {
        const gen = this._generator;
        const entity = render.renderEntity;
        const texture = drawInfo.texture;
        const material = drawInfo.material;
        const meshBuffer = drawInfo.meshBuffer;
        const indexOffset = drawInfo.indexOffset;
        const ibCount = drawInfo.ibCount;

        const enableBatch = !entity.useLocal;

        if (enableBatch && gen.currIsMiddleware && gen.middlewareBuffer === meshBuffer
            && gen.currTexture === texture
            && (gen.currMaterial && gen.currMaterial.hash === material!.hash)
            && gen.middlewareIndexStart + gen.middlewareIndexCount === indexOffset
            && gen.currLayer === render.node.layer) {
            gen.middlewareIndexCount += ibCount;
        } else {
            this.autoMergeBatches(null);
            this.resetRenderStates();

            if (render.stencilStage === Stage.ENTER_LEVEL || render.stencilStage === Stage.ENTER_LEVEL_INVERTED) {
                this.insertMaskBatch(render, (cclegacy.director as Director).getTotalFrames());
            } else {
                render.stencilStage = StencilManager.sharedManager!.stage;
            }

            gen.currHash = 0;
            gen.currHasCustomMaterial = render.customMaterial !== null;
            gen.currMaterial = material;
            gen.currDepthStencilStateStage = render.stencilStage;
            gen.currLayer = render.node.layer;
            gen.currTransform = enableBatch ? null : render.node;
            gen.currTexture = texture;
            gen.currSampler = drawInfo.sampler;
            gen.currTextureHash = texture ? texture.objectID : 0;
            gen.currSamplerHash = drawInfo.sampler ? drawInfo.sampler.hash : 0;
            gen.setMiddlewareBatchState(meshBuffer, indexOffset, ibCount);
        }
    }

    /**
     * @en Inlined SUB_NODE dispatch — the TS mirror of native `Batcher2d::handleSubNode`.
     * Re-enters `walk` on the sub-node so its children are rendered at the correct z-order
     * position within the parent's draw info sequence (used by TiledLayer for embedded user nodes).
     * @zh 内联的 SUB_NODE 分发，对应 native `handleSubNode`。在子节点上重入 `walk`，使其在父节点
     * drawInfo 序列中的正确 z-order 位置渲染（TiledLayer 内嵌用户节点使用）。
     */
    private _handleSubNode (drawInfo: RenderDrawInfo): void {
        const subNode = drawInfo.subNode;
        if (subNode) {
            this.walk(subNode, 0);
        }
    }

    /**
     * @en Inlined COMP commit — the TS mirror of native `Batcher2d::handleComponentDraw`.
     * Reads the batch keys (dataHash / material / isMeshBuffer / bufferId)
     * from the RenderDrawInfo model; the universal vertex/color/index fill is handled by `_fillBuffers`.
     * @zh 内联的 COMP 提交，对应 native `handleComponentDraw`。批次关键字段
     * 读自 RenderDrawInfo；顶点/颜色/索引填充由 `_fillBuffers` 处理。
     */
    private _handleComponentDraw (
        render: UIRenderer,
        drawInfo: RenderDrawInfo,
        finalOpacity: number,
        opacityDirty: boolean,
    ): void {
        // isMeshBuffer branch (Particle2D): independent IA, no chunk-based fill.
        if (drawInfo.isMeshBuffer) {
            this._handleMeshBufferComp(render, drawInfo);
            return;
        }
        const rd = render.renderData;
        if (rd && rd.chunk && !rd.isValid()) {
            return;
        }

        const dataHash = drawInfo.dataHash;

        // Mask: entering a stencil level inserts the mask batch; otherwise adopt the current stage.
        if (render.stencilStage === Stage.ENTER_LEVEL || render.stencilStage === Stage.ENTER_LEVEL_INVERTED) {
            this.insertMaskBatch(render, (cclegacy.director as Director).getTotalFrames());
        } else {
            render.stencilStage = StencilManager.sharedManager!.stage;
        }
        const dss = render.stencilStage;

        // 4-condition batch-break test, keyed off the draw info.
        const gen = this._generator;
        if (gen.currHash !== dataHash || dataHash === 0
            || gen.currMaterial !== drawInfo.material
            || gen.currDepthStencilStateStage !== dss) {
            // Facade autoMergeBatches preserves UIStaticBatch static-root threading; trackBuffer is the
            // buffer-manager side of the old facade updateBuffer.
            this.autoMergeBatches(null);
            if (rd) {
                this._bufferManager.trackBuffer(rd.vertexFormat, drawInfo.bufferId);
            }
            gen.setBatchState(
                render.customMaterial !== null,
                drawInfo.material!,
                dss,
                render.node.layer,
                null,
                rd as unknown as MeshRenderData,
                rd ? rd.frame : null,
            );
        }

        // Universal vertex / color / index fill (unchanged; reads renderData, same bytes as the draw info).
        this._fillBuffers(render, drawInfo, finalOpacity, opacityDirty);
    }

    /**
     * @en isMeshBuffer COMP branch (Particle2D). Each batch has its own MeshRenderData with independent
     * VB/IB that are uploaded separately (not through the chunk system). Mirrors native
     * `generateBatch` for `isMeshBuffer=true` which calls `drawInfo->requestIA(device)`.
     * @zh isMeshBuffer COMP 分支（Particle2D）。每批有独立的 MeshRenderData，VB/IB 独立上传。
     */
    private _handleMeshBufferComp (render: UIRenderer, drawInfo: RenderDrawInfo): void {
        const gen = this._generator;
        const meshRD = drawInfo.meshRenderData;
        if (!meshRD) return;

        if (gen.currMaterial !== null) {
            this.autoMergeBatches(null);
            this.resetRenderStates();
        }

        if (render.stencilStage === Stage.ENTER_LEVEL || render.stencilStage === Stage.ENTER_LEVEL_INVERTED) {
            this.insertMaskBatch(render, (cclegacy.director as Director).getTotalFrames());
        } else {
            render.stencilStage = StencilManager.sharedManager!.stage;
        }

        gen.setBatchState(
            render.customMaterial !== null,
            drawInfo.material!,
            render.stencilStage,
            render.node.layer,
            render.renderEntity.useLocal ? render.renderEntity.renderTransform : null,
            meshRD,
            meshRD.frame,
        );
    }

    // ── Universal vertex / index / color filling ─────────────────

    /**
     * @en Fills vertex position, color and index data for a UIRenderer.
     * @zh 填充 UIRenderer 的顶点位置、颜色和索引数据。
     */
    private _fillBuffers (render: UIRenderer, drawInfo: RenderDrawInfo, finalOpacity: number, opacityDirty: boolean): void {
        const renderData = render.renderData;
        if (!renderData) return;
        const chunk = renderData.chunk;
        const node = render.node;

        // Components such as MotionStreak bake fully-transformed world-space vertices — with uv and
        // per-vertex color — straight into the chunk themselves, flagging the draw info with
        // isVertexPositionInWorld (mirrors native fillVertexBuffers honouring getIsVertexPositionInWorld).
        // For those we must never re-transform or recolor; just flag the chunk dirty so the
        // assembler-written data is uploaded, then write the index buffer below.
        const worldVerts = drawInfo.isVertexPositionInWorld;

        // ① Dirty check + world transform (skipped when the verts are already in world space)
        const transformDirty = !worldVerts
            && ((render as any)._flagChangedVersion !== node.flagChangedVersion || renderData.vertDirty);
        let bufferDirty = worldVerts;
        if (transformDirty) {
            this._transformVerts(renderData, node.worldMatrix);
            renderData.vertDirty = false;
            (render as any)._flagChangedVersion = node.flagChangedVersion;
            bufferDirty = true;
        }

        // ② Color fill (COLOR mode: write per-vertex color from render.color;
        //    VERTEX mode: skip, colors are baked into vertex data).
        //    Mirrors native Batcher2d::fillColor, which only runs when the entity's VB color
        //    is dirty and always writes the cascaded opacity:
        //    - Gate: opacityDirty (self/ancestor color or opacity changed this frame) OR
        //      transformDirty (geometry rebuilt into a fresh chunk region → color must be
        //      re-written). Without the gate, every static sprite rewrites its VB and forces
        //      a full re-upload every frame, defeating dirty tracking.
        //    - Alpha MUST be the cascaded finalOpacity (walk recomputes it every frame),
        //      never the local color.a — otherwise a faded parent's children snap back to
        //      full opacity on non-dirty frames.
        if (!worldVerts && (opacityDirty || transformDirty) && render.getFillColorType() === RenderEntityFillColorType.COLOR) {
            const color = render.color;
            const vData = renderData.chunk.vb;
            const stride = renderData.floatStride;
            const len = renderData.dataLength;
            const r = color.r / 255;
            const g = color.g / 255;
            const b = color.b / 255;
            const a = finalOpacity;
            let offset = 5;
            for (let i = 0; i < len; i++, offset += stride) {
                vData[offset + 0] = r;
                vData[offset + 1] = g;
                vData[offset + 2] = b;
                vData[offset + 3] = a;
            }
            bufferDirty = true;
        }

        if (bufferDirty && renderData.getMeshBuffer()) {
            renderData.getMeshBuffer()!.setDirty();
        }

        // ③ Index write
        const indices = renderData.indices;
        if (indices && indices.length > 0) {
            const vid = chunk.vertexOffset;
            const ib = chunk.meshBuffer.iData;
            let indexOffset = chunk.meshBuffer.indexOffset;
            for (let i = 0; i < indices.length; i++) {
                ib[indexOffset++] = vid + indices[i];
            }
            chunk.meshBuffer.indexOffset = indexOffset;
        } else if (DEBUG && renderData.indexCount > 0) {
            // Guard against silently dropping primitives: WebBatcherCore reads indices
            // exclusively from renderData.indices. An assembler that forgets to populate
            // it (see docs/batcher2d-issues-and-native-analysis.md §1.3 / §2.2) renders
            // nothing on Web. Warn so the regression surfaces instead of going silent.
            // eslint-disable-next-line no-console
            console.warn(`[Batcher2D] ${render.node.name ?? ''} has indexCount=${renderData.indexCount} but renderData.indices is empty; primitives dropped on Web.`);
        }
    }

    /**
     * @en Transforms local vertex positions to world space using the node's world matrix.
     * @zh 使用节点的世界矩阵将本地顶点位置转换到世界空间。
     */
    private _transformVerts (renderData: RenderData, worldMatrix: Mat4): void {
        const dataList = renderData.data;
        const vData = renderData.chunk.vb;
        const stride = renderData.floatStride;
        const len = dataList.length;

        const m00 = worldMatrix.m00, m01 = worldMatrix.m01, m02 = worldMatrix.m02, m03 = worldMatrix.m03;
        const m04 = worldMatrix.m04, m05 = worldMatrix.m05, m06 = worldMatrix.m06, m07 = worldMatrix.m07;
        const m08 = worldMatrix.m08, m09 = worldMatrix.m09, m10 = worldMatrix.m10, m11 = worldMatrix.m11;
        const m12 = worldMatrix.m12, m13 = worldMatrix.m13, m14 = worldMatrix.m14, m15 = worldMatrix.m15;

        const needPerspective = m03 !== 0 || m07 !== 0 || m11 !== 0 || m15 !== 1;

        let offset = 0;
        for (let i = 0; i < len; i++) {
            const vert = dataList[i];
            const x = vert.x;
            const y = vert.y;
            const z = vert.z ?? 0;

            let wx = m00 * x + m04 * y + m08 * z + m12;
            let wy = m01 * x + m05 * y + m09 * z + m13;
            let wz = m02 * x + m06 * y + m10 * z + m14;

            if (needPerspective) {
                let rhw = m03 * x + m07 * y + m11 * z + m15;
                rhw = rhw ? 1 / rhw : 1;
                wx *= rhw;
                wy *= rhw;
                wz *= rhw;
            }

            vData[offset]     = wx;
            vData[offset + 1] = wy;
            vData[offset + 2] = wz;
            offset += stride;
        }
    }

    private _recordUIRenderer (render: UIRenderer, finalOpacity: number, opacityDirty: boolean): RecordedRendererInfo {
        if (!USE_SORTING_2D) return null!;
        const info = this._recordedPool.add();
        info.uiRenderer = render;
        info.finalOpacity = finalOpacity;
        info.opacityDirty = opacityDirty;
        this._recordedRendererInfoQueue.push(info);
        return info;
    }

    private _flushRecordedUIRenderers (): void {
        if (!USE_SORTING_2D) return;
        const queue = this._recordedRendererInfoQueue;
        const length = queue.length;
        if (length === 0) return;

        queue.sort((a, b) => a.uiRenderer!.priority - b.uiRenderer!.priority);

        for (let i = 0; i < length; i++) {
            const info = queue[i];
            const render = info.uiRenderer;

            if (render) {
                this._handleUIRenderer(render, info.finalOpacity, info.opacityDirty);
                if (render.enabledInHierarchy) {
                    render.postUpdateAssembler(this._batcher);
                }
            }
            info.finalOpacity = 1;
            info.opacityDirty = false;
            info.uiRenderer = null;
        }
        queue.length = 0;
    }

    // ── Mask ─────────────────────────────────────────────────────

    public insertMaskBatch (comp: UIRenderer | UIMeshRenderer, frameCount: number): void {
        this.autoMergeBatches(null);
        this.resetRenderStates();

        const batches = this._maskHandler.createMaskBatches(
            comp.node,
            comp.stencilStage,
            this._generator.drawBatchPool,
            frameCount,
        );
        for (const batch of batches) {
            this._generator.batches.push(batch);
        }
    }
}

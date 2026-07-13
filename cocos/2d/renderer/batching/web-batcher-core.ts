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

import { USE_SORTING_2D } from 'internal:constants';
import { Device, Sampler, Texture } from '../../../gfx';
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

import { updateOpacity } from '../../assembler/utils';
import { approx, EPSILON, RecyclePool, cclegacy } from '../../../core';
import { RenderEntityFillColorType } from '../render-entity';

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

    initialize (): boolean { return true; }

    update (): void {
        const gen = this._generator;
        const screens = this._screens;
        let offset = 0;

        for (let i = 0; i < screens.length; ++i) {
            const screenNode = screens[i];
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

    uploadBuffers (): void { this._generator.uploadBuffers(); }
    reset (): void { this._generator.reset(); }
    destroy (): void { this._generator.destroy(); }

    // ── Data sync ─────────────────────────────────────────────────

    syncRootNodes (rootNodes: Node[]): void { this._screens = rootNodes; }
    syncMeshBuffersToNative (_accId: number, _buffers: UIMeshBuffer[]): void {}

    // ── Cache ─────────────────────────────────────────────────────

    releaseDescriptorSetCache (textureOrHash: number | Texture | null, _sampler: Sampler | null): void {
        if (typeof textureOrHash === 'number') {
            this._descriptorCache.releaseByTexture(textureOrHash);
        } else if (textureOrHash) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            this._descriptorCache.releaseByTexture((textureOrHash as any)._textureHash || 0);
        }
    }

    // ── Batch runtime ─────────────────────────────────────────────

    get generator (): BatchGenerator { return this._generator; }

    autoMergeBatches (staticRoot: UIStaticBatch | null): void {
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

    forceMergeBatches (material: any, frame: any, customMaterial: boolean, stencil: any, layer: number): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this._generator.setBatchState(customMaterial, material, stencil, layer, null, null, frame);
        this.autoMergeBatches(null);
    }

    finishMergeBatches (): void {
        this.autoMergeBatches(null);
        this._generator.resetBatchStates();
    }

    resetRenderStates (): void { this._generator.resetBatchStates(); }
    flushMaterial (mat: any): void { this._generator.currMaterial = mat; }

    // ══════════════════════════════════════════════════════════════
    // Scene-graph walk (Web-only)
    //
    // The walk traverses the node tree depth-first, triggering
    // Assembler.fillBuffers on each UIRenderer via the IBatcher
    // callbacks, calculating cascaded opacity, and handling
    // Mask stencil transitions.
    // ══════════════════════════════════════════════════════════════

    /**
     * @en Walk through the scene graph and update rendering data for each UI node.
     * @zh 遍历场景图并更新每个 UI 节点的渲染数据。
     */
    walk (node: Node, level = 0): void {
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

            if (children.length > 0 && !(node as any)._static) {
                for (let i = 0; i < children.length; ++i) {
                    const child = children[i];
                    this.walk(child, level);
                }
            }

            if (uiProps.colorDirty) {
                this._opacityDirty--;
                uiProps.colorDirty = false;
            }
        }
        this._pOpacity = parentOpacity;

        if (render && render.enabledInHierarchy) {
            if (!USE_SORTING_2D) {
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
        const renderData = render ? render.renderData : null;
        const vertexCount = renderData ? renderData.vertexCount : 0;

        if (render && render.enabledInHierarchy) {
            render.fillBuffers(this._batcher);
        }

        if (opacityDirty && vertexCount > 0) {
            switch (render.getFillColorType()) {
            case RenderEntityFillColorType.COLOR: {
                updateOpacity(renderData!, finalOpacity);
                break;
            }
            case RenderEntityFillColorType.VERTEX: {
                break;
            }
            default:
                break;
            }

            const buffer = renderData!.getMeshBuffer();
            if (buffer) {
                buffer.setDirty();
            }
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

    insertMaskBatch (comp: UIRenderer | UIMeshRenderer, frameCount: number): void {
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

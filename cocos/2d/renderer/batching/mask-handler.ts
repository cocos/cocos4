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

import { Material, RenderingSubMesh } from '../../../asset/assets';
import {
    BufferInfo, BufferUsageBit, DepthStencilState, Device, deviceManager,
    MemoryUsageBit, PrimitiveMode,
} from '../../../gfx';
import { Pool, cclegacy } from '../../../core';
import { Root } from '../../../root';
import { Node } from '../../../scene-graph';
import { scene } from '../../../render-scene';
import { Model } from '../../../render-scene/scene';
import { builtinResMgr } from '../../../asset/asset-manager';
import { getAttributeStride, vfmt } from '../vertex-format';
import { Stage, StencilManager } from '../stencil-manager';
import { DrawBatch2D } from '../draw-batch';

/**
 * @en
 * Handles Mask-related stencil batch generation.
 * Creates a full-screen quad model for stencil clear operations,
 * and generates the corresponding DrawBatch2D entries.
 *
 * @zh
 * 处理 Mask 相关的模板缓冲批次生成。
 * 创建用于 stencil clear 的全屏四边形 model，并生成对应的 DrawBatch2D 条目。
 */
export class MaskHandler {
    private _maskClearModel: Model | null = null;
    private _maskClearMtl: Material | null = null;
    private _maskModelMesh: RenderingSubMesh | null = null;

    constructor (
        private _stencilManager: StencilManager,
    ) {}

    /**
     * @en
     * Generates mask-clear DrawBatch2D entries.
     * Pushes the mask onto the stencil stack and returns the generated batches.
     *
     * @zh
     * 生成 mask-clear 的 DrawBatch2D 条目，将 mask 压入 stencil 栈并返回生成的批次。
     *
     * @param node              The Node the mask component is attached to.
     * @param stencilStage      Current stencil stage of the mask component.
     * @param drawBatchPool     Pool for allocating DrawBatch2D objects.
     * @param frameCount        Current total frame count from Director.
     * @returns Array of generated DrawBatch2D entries (to be appended to _batches).
     */
    createMaskBatches (
        node: Node,
        stencilStage: Stage,
        drawBatchPool: Pool<DrawBatch2D>,
        frameCount: number,
    ): DrawBatch2D[] {
        const batches: DrawBatch2D[] = [];

        this._createClearModel();

        this._maskClearModel!.node = this._maskClearModel!.transform = node;
        this._stencilManager.pushMask(1); // not need object, only use length

        const isInverted = stencilStage !== Stage.ENTER_LEVEL;
        const clearStage = isInverted ? Stage.CLEAR_INVERTED : Stage.CLEAR;

        const mat = this._maskClearMtl;
        let depthStencil: DepthStencilState | null = null;
        let dssHash = 0;
        if (mat) {
            depthStencil = this._stencilManager.getStencilStage(clearStage, mat);
            dssHash = this._stencilManager.getStencilHash(clearStage);
        }

        const model = this._maskClearModel!;
        model.updateTransform(frameCount);
        model.updateUBOs(frameCount);

        for (let i = 0; i < model.subModels.length; i++) {
            const curDrawBatch = drawBatchPool.alloc();
            const subModel = model.subModels[i];
            curDrawBatch.visFlags = node.layer;
            curDrawBatch.model = model;
            curDrawBatch.texture = null;
            curDrawBatch.sampler = null;
            curDrawBatch.useLocalData = null;
            if (!depthStencil) { depthStencil = null; }
            curDrawBatch.fillPasses(mat, depthStencil, dssHash, subModel.patches);
            curDrawBatch.inputAssembler = subModel.inputAssembler;
            curDrawBatch.model.visFlags = curDrawBatch.visFlags;
            curDrawBatch.descriptorSet = subModel.descriptorSet;
            batches.push(curDrawBatch);
        }

        this._stencilManager.enableMask();
        return batches;
    }

    /**
     * @en
     * Release all GPU resources held for mask clearing.
     * @zh
     * 释放 Mask Clear 持有的所有 GPU 资源。
     */
    destroy (): void {
        if (this._maskClearModel && this._maskModelMesh) {
            (cclegacy.director.root as Root).destroyModel(this._maskClearModel);
            this._maskModelMesh.destroy();
            this._maskModelMesh = null;
            this._maskClearModel = null;
        }
        if (this._maskClearMtl) {
            this._maskClearMtl.destroy();
            this._maskClearMtl = null;
        }
    }

    // ── Private helpers ──────────────────────────────────────────

    private _createClearModel (): void {
        if (this._maskClearModel) return;

        this._maskClearMtl = builtinResMgr.get<Material>('default-clear-stencil');

        this._maskClearModel = (cclegacy.director.root as Root).createModel(scene.Model);
        const stride = getAttributeStride(vfmt);
        const gfxDevice: Device = deviceManager.gfxDevice;
        const vertexBuffer = gfxDevice.createBuffer(new BufferInfo(
            BufferUsageBit.VERTEX | BufferUsageBit.TRANSFER_DST,
            MemoryUsageBit.DEVICE,
            4 * stride,
            stride,
        ));

        const vb = new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]);
        vertexBuffer.update(vb);
        const indexBuffer = gfxDevice.createBuffer(new BufferInfo(
            BufferUsageBit.INDEX | BufferUsageBit.TRANSFER_DST,
            MemoryUsageBit.DEVICE,
            6 * Uint16Array.BYTES_PER_ELEMENT,
            Uint16Array.BYTES_PER_ELEMENT,
        ));

        const ib = new Uint16Array([0, 1, 2, 2, 1, 3]);
        indexBuffer.update(ib);
        this._maskModelMesh = new RenderingSubMesh([vertexBuffer], vfmt, PrimitiveMode.TRIANGLE_LIST, indexBuffer);
        this._maskModelMesh.subMeshIdx = 0;

        this._maskClearModel.initSubModel(0, this._maskModelMesh, this._maskClearMtl);
    }
}

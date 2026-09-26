/*
 Copyright (c) 2026
 Generic 2D mesh data consumer. The plugin / user feeds pre-baked vertex, index
 and segment data through setMeshData; this component owns the vertex buffers,
 batching and submission (via the 2D batcher). Rendering internals (RenderData /
 StaticVBAccessor) stay engine-side, so extensions can render custom meshes
 without touching engine internals.
*/

import { ccclass, editable, serializable } from 'cc.decorator';
import { UIRenderer } from '../framework/ui-renderer';
import { RenderData } from '../renderer/render-data';
import { RenderDrawInfo, RenderDrawInfoType } from '../renderer/render-draw-info';
import { StaticVBAccessor } from '../renderer/static-vb-accessor';
import { vfmtPosUvColor4B, vfmtPosUvTwoColor4B } from '../renderer/vertex-format';
import { RenderEntity, RenderEntityType } from '../renderer/render-entity';
import { director } from '../../game';
import { Texture2D } from '../../asset/assets';
import { JSB } from 'internal:constants';
import type { MeshBuffer } from '../renderer/mesh-buffer';
import type { MaterialInstance } from '../../render-scene';

/**
 * @en A segment of the mesh: a range of indices drawn with one texture+material.
 * @zh 网格的一个片段：一段索引，用同一纹理+材质绘制。
 */
export interface UIMeshSegment {
    indexOffset: number;
    indexCount: number;
    texture: Texture2D | null;
    material: MaterialInstance | null;
}

/**
 * @en Pre-baked mesh data for one frame.
 * @zh 一帧的预烘焙网格数据。
 * vertexStride: 24 (single-color V3F_T2F_C4B) or 28 (two-color V3F_T2F_C4B_C4B).
 */
export interface UIMeshData {
    vertexCount: number;
    vertexStride: number;
    vertexData: Uint8Array;
    indexCount: number;
    indexData: Uint8Array;
    segments: UIMeshSegment[];
}

// Shared static vertex-buffer accessors. All UIMesh components share one
// accessor (per vertex format) so the 2D batcher resets its buffer each frame;
// per-component accessors registered under the same key would overwrite each
// other in the batcher's map and never get reset (indexOffset accumulates).
let _sharedAccessor: StaticVBAccessor | null = null;
let _sharedTintAccessor: StaticVBAccessor | null = null;

/**
 * @en A generic 2D mesh renderer that consumes pre-baked vertex/index data.
 * The data provider (e.g. a spine plugin) fills setMeshData every frame; this
 * component handles buffer allocation, batching and submission.
 * @zh 通用 2D 网格渲染器，消费预烘焙的顶点/索引数据。数据提供方（如 spine 插件）
 * 每帧调用 setMeshData，本组件负责缓冲分配、合批与提交。
 */
@ccclass('cc.UIMesh')
export class UIMesh extends UIRenderer {
    @serializable
    protected _enableBatch = false;

    protected _meshData: UIMeshData | null = null;
    protected _useTint = false;
    protected _accessor: StaticVBAccessor | null = null;
    protected _tintAccessor: StaticVBAccessor | null = null;
    private _drawInfoList: RenderDrawInfo[] = [];

    constructor () {
        super();
        this._useVertexOpacity = true;
    }

    /**
     * @en Feeds the pre-baked mesh data for the current frame.
     * @zh 喂入当前帧的预烘焙网格数据。
     */
    public setMeshData (data: UIMeshData): void {
        const useTint = data.vertexStride === 28;
        if (useTint !== this._useTint) {
            this.destroyRenderData();
            this._useTint = useTint;
            this._flushAssembler();
        }
        this._meshData = data;
        this._markForUpdateRenderData();
    }

    /**
     * @en Whether to enable sprite batching.
     * @zh 是否启用合批。
     */
    @editable
    get enableBatch (): boolean { return this._enableBatch; }
    set enableBatch (value: boolean) {
        this._enableBatch = value;
        this._renderEntity.setUseLocal(!value);
        this._markForUpdateRenderData();
    }

    protected _flushAssembler (): void {
        if (this._renderData === null) {
            const accessor = this.ensureAccessor(this._useTint);
            this._renderData = RenderData.add(this._useTint ? vfmtPosUvTwoColor4B : vfmtPosUvColor4B, accessor);
        }
    }

    public override updateRenderer (): void {
        super.updateRenderer();
        if (!JSB) return;
        if (this._renderFlag) {
            this._prepareNativeDrawInfos();
        } else {
            this._renderEntity.clearDynamicRenderDrawInfos();
        }
    }

    protected _render (batcher: any): void {
        const prepared = this._prepareBuffers();
        if (!prepared || !this._meshData) return;
        const { meshBuffer, startIndex } = prepared;
        const data = this._meshData;

        // Commit each segment with its texture + material.
        for (const seg of data.segments) {
            if (seg.texture && seg.material) {
                batcher.commitMiddleware(this, meshBuffer, startIndex + seg.indexOffset, seg.indexCount,
                                         seg.texture, seg.material, this._enableBatch);
            }
        }
    }

    private _prepareBuffers (): { meshBuffer: MeshBuffer, startIndex: number } | null {
        if (!this._renderData || !this._meshData) return null;
        const data = this._meshData;
        const rd = this._renderData;
        const vc = data.vertexCount;
        const ic = data.indexCount;
        if (vc < 1 || ic < 1) return null;
        const vLength = vc * data.vertexStride;

        // Ensure the render data buffers are large enough.
        if (rd.vertexCount !== vc || rd.indexCount !== ic) {
            if (!rd.chunk || rd.chunk.vb.byteLength < vLength || rd.chunk.indexCount < ic) {
                rd.resize(Math.ceil(vc * 1.1), Math.ceil(ic * 1.1));
            } else {
                rd.updateSize(vc, ic);
            }
        }
        if (!rd.chunk) return null;
        // Copy vertex data into the chunk's vertex view (a view of the shared
        // vData at the chunk's vertexOffset).
        const vbuf = rd.chunk.vb;
        const vU8 = new Uint8Array(vbuf.buffer, vbuf.byteOffset, vLength);
        vU8.set(data.vertexData.subarray(0, vLength));

        // Offset the indices by the chunk's vertexOffset and append them into
        // the shared index buffer. appendIndices grows the buffer as needed and
        // advances meshBuffer.indexOffset; commitMiddleware reads meshBuffer.iData.
        const meshBuffer = rd.getMeshBuffer()!;
        // The native batcher resets its mesh-buffer offset through the shared
        // memory view after uploading. Synchronize the JS-side cached value
        // before appending this frame's indices.
        if (JSB) meshBuffer.indexOffset = meshBuffer.sharedBuffer[2];
        const startIndex = meshBuffer.indexOffset;
        const chunkOffset = rd.chunk.vertexOffset;
        const offsetIndices = new Uint16Array(ic);
        new Uint8Array(offsetIndices.buffer).set(data.indexData.subarray(0, ic * 2));
        for (let i = 0; i < ic; i++) offsetIndices[i] += chunkOffset;
        rd.chunk.vertexAccessor.appendIndices(rd.chunk.bufferId, offsetIndices);

        if (vc > 0 || ic > 0) rd.chunk.vertexAccessor.getMeshBuffer(rd.chunk.bufferId).setDirty();
        return { meshBuffer, startIndex };
    }

    private _prepareNativeDrawInfos (): void {
        this._renderEntity.clearDynamicRenderDrawInfos();
        const prepared = this._prepareBuffers();
        const data = this._meshData;
        const rd = this._renderData;
        if (!prepared || !data || !rd?.chunk) return;

        const { startIndex } = prepared;
        let drawIndex = 0;
        for (const seg of data.segments) {
            if (!seg.texture || !seg.material) continue;
            let drawInfo = this._drawInfoList[drawIndex];
            if (!drawInfo) {
                drawInfo = new RenderDrawInfo();
                drawInfo.setDrawInfoType(RenderDrawInfoType.MIDDLEWARE);
                this._drawInfoList[drawIndex] = drawInfo;
            }
            drawInfo.setAccAndBuffer(rd.accessor.id, rd.chunk.bufferId);
            drawInfo.setIndexOffset(startIndex + seg.indexOffset);
            drawInfo.setIBCount(seg.indexCount);
            drawInfo.setTexture(seg.texture.getGFXTexture());
            drawInfo.setSampler(seg.texture.getGFXSampler());
            drawInfo.setMaterial(seg.material);
            this._renderEntity.setDynamicRenderDrawInfo(drawInfo, drawIndex);
            drawIndex++;
        }
    }

    protected createRenderEntity (): RenderEntity {
        const entity = new RenderEntity(RenderEntityType.DYNAMIC);
        entity.setUseLocal(true);
        return entity;
    }

    private ensureAccessor (useTint: boolean): StaticVBAccessor {
        let accessor = useTint ? this._tintAccessor : this._accessor;
        if (!accessor) {
            const device = director.root!.device;
            const batcher = director.root!.batcher2D;
            const attributes = useTint ? vfmtPosUvTwoColor4B : vfmtPosUvColor4B;
            if (useTint) {
                if (!_sharedTintAccessor) {
                    _sharedTintAccessor = new StaticVBAccessor(device, attributes, 32767);
                    batcher.registerBufferAccessor(Number.parseInt('UIMESHTINT', 36), _sharedTintAccessor);
                }
                accessor = _sharedTintAccessor;
            } else {
                if (!_sharedAccessor) {
                    _sharedAccessor = new StaticVBAccessor(device, attributes, 32767);
                    batcher.registerBufferAccessor(Number.parseInt('UIMESH', 36), _sharedAccessor);
                }
                accessor = _sharedAccessor;
            }
            if (useTint) {
                this._tintAccessor = accessor;
            } else {
                this._accessor = accessor;
            }
        }
        return accessor;
    }
}

/*
 Copyright (c) 2026
 Generic 2D mesh data consumer: the plugin feeds pre-baked vertex/index/segment
 data through setMeshData; this component owns buffer allocation, batching and
 submission through the 2D batcher, so extensions can render custom meshes
 without touching engine internals.

 Vertices are ALWAYS node-local; UIMesh owns the node transform:
   * not batched -- on the GPU, via USE_LOCAL + the per-draw cc-local UBO the
     batcher already maintains for middleware draws;
   * batched     -- the FULL world matrix baked into the chunk copy on the CPU
     (a merged batch carries no per-draw matrix), matching the GPU path, z /
     X-Y rotation included.
 USE_LOCAL / setUseLocal are derived internally; there is no world-baked
 input mode.

 Data is FillColorType.VERTEX, so the batcher applies no cascaded opacity:
 UIMesh folds it into the copied vertices itself, accumulated as Batcher2D.walk
 does for COLOR data (own color alpha x, per ancestor, UIOpacity localOpacity x
 that ancestor's color alpha). `premultipliedAlpha` declares the data format:
 alpha-byte-only vs RGBA + dark RGB fading.

 The batcher resets the shared index tail after every upload (vertex bytes
 survive), so indices are re-submitted EVERY frame (appendIndexBuffer) and only
 the vertex refresh is _vertexDirty-gated. A dirty-gated submission would leave
 a static mesh's draw range aliasing whichever sibling appends after the reset
 (two UIMeshes in one buffer, one paused: it would draw the other's triangles).
*/

import { JSB } from 'internal:constants';
import { ccclass, editable, serializable } from 'cc.decorator';
import { errorID } from '../../core';
import { Mat4 } from '../../core/math';
import { UIRenderer } from '../framework/ui-renderer';
import { RenderData } from '../renderer/render-data';
import { RenderDrawInfo, RenderDrawInfoType } from '../renderer/render-draw-info';
import { StaticVBAccessor } from '../renderer/static-vb-accessor';
import type { Batcher2D } from '../renderer/batcher-2d';
import { vfmtPosUvColor4B, vfmtPosUvTwoColor4B, getAttributeStride } from '../renderer/vertex-format';
import { RenderEntity, RenderEntityType } from '../renderer/render-entity';
import { director, DirectorEvent } from '../../game';
import { Texture2D } from '../../asset/assets';
import { builtinResMgr } from '../../asset/asset-manager';
import { BlendFactor } from '../../gfx';
import type { MeshBuffer } from '../renderer/mesh-buffer';
import type { MaterialInstance } from '../../render-scene';
import type { Material } from '../../asset/assets/material';
import type { Node } from '../../scene-graph';

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

// Shared static vertex-buffer accessors, keyed by the current Batcher2D: it
// destroys every accessor registered with it, so a rebuilt root must never
// reuse a cached (destroyed) accessor, and each new one must be registered
// with the current batcher or its buffers would never be uploaded or reset.
let _accessorBatcher: Batcher2D | null = null;
let _sharedAccessor: StaticVBAccessor | null = null;
let _sharedTintAccessor: StaticVBAccessor | null = null;

// Registration keys in the batcher's accessor map (base-36 namespaced, the
// same convention as the built-in middleware assemblers — spine/dragon-bones).
const UIMESH_ACCESSOR_KEY = Number.parseInt('UIMESH', 36);
const UIMESH_TINT_ACCESSOR_KEY = Number.parseInt('UIMESHTINT', 36);

// The two consumed vertex formats (24 / 28 bytes); strides derived from the
// definitions so the byte math always matches the chunk's format.
const MESH_STRIDE_BYTES = getAttributeStride(vfmtPosUvColor4B);
const MESH_STRIDE_TINT_BYTES = getAttributeStride(vfmtPosUvTwoColor4B);

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

    /**
     * @en Whether the incoming color data is premultiplied-alpha. Declares how
     * cascaded opacity is folded into the vertices (alpha byte only vs
     * RGBA + dark RGB) and the blend factors of the builtin material.
     * @zh 输入颜色数据是否为预乘 alpha 格式。决定级联不透明度折算方式
     * （仅 alpha 字节 vs RGBA + dark RGB）及内置材质混合因子。
     */
    @serializable
    protected _premultipliedAlpha = false;

    protected _meshData: UIMeshData | null = null;
    protected _useTint = false;
    private _drawInfoList: RenderDrawInfo[] = [];

    // Poll cache (see _onBeforeDraw): inputs captured by the last
    // updateVertexBuffer run; drift means the baked transform / folded opacity
    // no longer match. The full matrix is tracked — the bake applies all of it.
    private _pollOpacity = 1;
    private _pollWorldMatrix = new Mat4();

    // Vertex-staleness latch, consumed by _onBeforeDraw to pick a full refresh
    // vs an index-only resubmit. Starts dirty so the first frame prepares.
    private _vertexDirty = true;

    constructor () {
        super();
        this._useVertexOpacity = true;
    }

    /**
     * @en Feeds the pre-baked mesh data for the current frame.
     * @zh 喂入当前帧的预烘焙网格数据。
     */
    public setMeshData (data: UIMeshData): void {
        // Reject bad input at the call site; a rejected frame keeps the last
        // accepted mesh.
        if (!this._validateMeshData(data)) return;
        const useTint = data.vertexStride === MESH_STRIDE_TINT_BYTES;
        if (useTint !== this._useTint) {
            this.destroyRenderData();
            this._useTint = useTint;
            this._flushAssembler();
            // The builtin fallback material follows the stride (TWO_COLORED).
            this.updateMaterial();
        }
        this._meshData = data;
        this._vertexDirty = true;
    }

    private _validateMeshData (data: UIMeshData): boolean {
        const vc = data.vertexCount;
        const ic = data.indexCount;
        if (data.vertexStride !== MESH_STRIDE_BYTES && data.vertexStride !== MESH_STRIDE_TINT_BYTES) {
            errorID(9010, data.vertexStride, MESH_STRIDE_BYTES, MESH_STRIDE_TINT_BYTES);
            return false;
        }
        if (vc < 0 || ic < 0) {
            errorID(9011, vc, ic);
            return false;
        }
        // Capacity limits come from the accessor that will serve the data.
        const accessor = this.ensureAccessor(data.vertexStride === MESH_STRIDE_TINT_BYTES);
        if (vc > accessor.maxVertexCount || ic > accessor.maxIndexCount) {
            errorID(9016, vc, ic, accessor.maxVertexCount, accessor.maxIndexCount);
            return false;
        }
        if (!data.vertexData || data.vertexData.byteLength < vc * data.vertexStride) {
            errorID(9012, data.vertexData ? data.vertexData.byteLength : 0, vc, data.vertexStride);
            return false;
        }
        if (!data.indexData || data.indexData.byteOffset % 2 !== 0 || data.indexData.byteLength < ic * 2) {
            errorID(9013, data.indexData ? data.indexData.byteLength : 0,
                data.indexData ? data.indexData.byteOffset : 0, ic, ic * 2);
            return false;
        }
        // Indices are mesh-local; anything >= vertexCount would sample vertices
        // of other chunks in the shared buffer (silent geometry corruption).
        const indices = new Uint16Array(data.indexData.buffer, data.indexData.byteOffset, ic);
        for (let i = 0; i < ic; ++i) {
            if (indices[i] >= vc) {
                errorID(9014, i, indices[i], vc);
                return false;
            }
        }
        for (let i = 0; i < data.segments.length; ++i) {
            const seg = data.segments[i];
            if (seg.indexOffset < 0 || seg.indexCount < 0 || seg.indexOffset + seg.indexCount > ic) {
                errorID(9015, i, seg.indexOffset, seg.indexOffset + seg.indexCount, ic);
                return false;
            }
        }
        return true;
    }

    /**
     * @en Whether to enable sprite batching.
     * @zh 是否启用合批。
     */
    @editable
    get enableBatch (): boolean { return this._enableBatch; }
    set enableBatch (value: boolean) {
        this._enableBatch = value;
        this._syncTransformMode();
        this.updateMaterial();
    }

    /**
     * @en Whether the input color data is premultiplied-alpha.
     * @zh 输入颜色数据是否为预乘 alpha 格式。
     */
    @editable
    get premultipliedAlpha (): boolean { return this._premultipliedAlpha; }
    set premultipliedAlpha (value: boolean) {
        this._premultipliedAlpha = value;
        this.updateMaterial();
        this._vertexDirty = true;
        this.onPremultipliedAlphaChanged();
    }

    /**
     * Notifies subclasses the declared format changed. The property is owned
     * here (single source of truth); producers override this to forward it to
     * their baker instead of redeclaring the field.
     */
    protected onPremultipliedAlphaChanged (): void {}

    public onLoad (): void {
        super.onLoad();
        // Deserialization has applied _enableBatch by now; re-derive the
        // legacy switch state.
        this._syncTransformMode();
    }

    /**
     * useLocal == "vertices are still node-local at submit time". Batched data
     * is world-baked by updateVertexBuffer before submit, and native
     * middleware draws only merge when !useLocal — hence !enableBatch.
     */
    private _syncTransformMode (): void {
        this._renderEntity.setUseLocal(!this._enableBatch);
        this._vertexDirty = true;
    }

    protected _updateColor (): void {
        super._updateColor();
        // The opacity fold in updateVertexBuffer reads this._color, so a
        // change must re-prepare. Visibility (color.a 0 <-> !0) is recomputed
        // fresh by _onBeforeDraw.
        this._vertexDirty = true;
    }

    protected _onMaterialModified (idx: number, material: Material | null): void {
        super._onMaterialModified(idx, material);
        // Draw infos cache the material reference; a swap must rebuild them.
        // The base mark only re-syncs visibility (no updateRenderer override
        // anymore), and the passDirty self-heal path needs an assembler.
        this._vertexDirty = true;
    }

    public onEnable (): void {
        super.onEnable();
        // BEFORE_DRAW fires between the update and render phases, outside the
        // director.pause() gate — the render loop still redraws (and resets
        // shared buffers) while paused, so submission must keep running.
        if (JSB) director.on(DirectorEvent.BEFORE_DRAW, this._onBeforeDraw, this);
    }

    public onDisable (): void {
        if (JSB) director.off(DirectorEvent.BEFORE_DRAW, this._onBeforeDraw, this);
        super.onDisable();
    }

    /**
     * JSB per-frame driver (director BEFORE_DRAW); web is driven by fillBuffers
     * instead. Three jobs:
     *  * poll — transforms / UIOpacity never mark a middleware renderer, so
     *    compare the live values against the last updateVertexBuffer capture;
     *  * visibility — recomputed fresh (the base class' synchronous
     *    _updateColor recompute is assembler-gated, dead here); an invisible
     *    mesh submits nothing and its draw infos are cleared;
     *  * data — full refresh when the latch is set or the mesh just became
     *    visible again, else the frame-scoped appendIndexBuffer only.
     */
    private _onBeforeDraw (): void {
        if (!JSB || !this._renderData || !this._meshData) return;
        if (this._enableBatch && !this.node.worldMatrix.strictEquals(this._pollWorldMatrix)) {
            this._vertexDirty = true;
        }
        if (this._computeCascadedOpacity() !== this._pollOpacity) {
            this._vertexDirty = true;
        }
        const wasRenderable = this._renderFlag;
        const canRender = this._canRender();
        this._renderFlag = canRender;
        this._renderEntity.enabled = canRender;
        if (!canRender) {
            if (wasRenderable) this._renderEntity.clearDynamicRenderDrawInfos();
            return;
        }
        if (this._vertexDirty || !wasRenderable) {
            this._prepareNativeDrawInfos();
            this._vertexDirty = false;
        } else {
            this.appendIndexBuffer();
        }
    }

    protected _flushAssembler (): void {
        if (this._renderData === null) {
            const accessor = this.ensureAccessor(this._useTint);
            this._renderData = RenderData.add(this._useTint ? vfmtPosUvTwoColor4B : vfmtPosUvColor4B, accessor);
        }
    }

    protected _render (batcher: any): void {
        const prepared = this._prepareBuffers();
        if (!prepared || !this._meshData) return;
        const { meshBuffer, startIndex } = prepared;
        const data = this._meshData;

        // Segments without their own material fall back to the component
        // material (the builtin spine effect).
        for (const seg of data.segments) {
            const mat = seg.material || this.getRenderMaterial(0);
            if (seg.texture && mat) {
                batcher.commitMiddleware(this, meshBuffer, startIndex + seg.indexOffset, seg.indexCount,
                                         seg.texture, mat, this._enableBatch);
            }
        }
    }

    private _prepareBuffers (): { meshBuffer: MeshBuffer, startIndex: number } | null {
        // Full refresh: the dirty-gated vertex half + the frame-scoped index
        // half. Shared by the web walk (_render) and _prepareNativeDrawInfos.
        if (!this.updateVertexBuffer()) return null;
        return this.appendIndexBuffer();
    }

    /**
     * Vertex half of a refresh: grow the chunk, copy this frame's bytes, bake
     * the world matrix when batching, fold cascaded opacity, capture the poll
     * inputs. The expensive half — callers gate it (native: dirty only; web:
     * every frame). Returns whether the chunk holds this frame's vertices.
     */
    protected updateVertexBuffer (): boolean {
        if (!this._renderData || !this._meshData) return false;
        const data = this._meshData;
        const rd = this._renderData;
        const vc = data.vertexCount;
        const ic = data.indexCount;
        if (vc < 1 || ic < 1) return false;
        const vLength = vc * data.vertexStride;

        // ~10% head room, clamped to the accessor's per-chunk caps — an
        // unclamped reserve would permanently fail data that fits (30000 ->
        // 33000 requested > 32767). Per-frame counts live on the render data;
        // the reserve lives on the chunk.
        if (!rd.chunk || rd.chunk.vb.byteLength < vLength || rd.chunk.indexCount < ic) {
            rd.resize(
                Math.min(Math.ceil(vc * 1.1), rd.accessor.maxVertexCount),
                Math.min(Math.ceil(ic * 1.1), rd.accessor.maxIndexCount),
            );
            if (!rd.chunk) {
                errorID(9017, vc, ic, rd.accessor.maxVertexCount, rd.accessor.maxIndexCount);
                return false;
            }
            rd.updateSize(vc, ic);
        } else if (rd.vertexCount !== vc || rd.indexCount !== ic) {
            rd.updateSize(vc, ic);
        }
        if (!rd.chunk) return false;
        // Copy into the chunk's view of the shared vData.
        const vbuf = rd.chunk.vb;
        const vU8 = new Uint8Array(vbuf.buffer, vbuf.byteOffset, vLength);
        vU8.set(data.vertexData.subarray(0, vLength));

        // Batched: a merged batch carries no per-draw matrix, so bake the
        // world transform into the chunk copy (the incoming vertexData may be
        // a worker-shared view — never touch it).
        if (this._enableBatch) {
            this._bakeWorldTransform(vbuf, vLength, data.vertexStride);
        }

        // Cascaded opacity: VERTEX-type data gets no engine-side fade, UIMesh
        // applies it while copying (see the opacity contract in the header).
        const opacity = this._computeCascadedOpacity();
        if (opacity < 0.9999) {
            this._applyOpacity(vU8, vc, data.vertexStride, opacity);
        }

        // Capture the poll inputs (compared in _onBeforeDraw).
        this._pollOpacity = opacity;
        if (this._enableBatch) {
            this._pollWorldMatrix.set(this.node.worldMatrix);
        }
        return true;
    }

    /**
     * Index half: offset by the chunk's vertexOffset, append into the shared
     * index buffer, refresh the draw-info offsets. Must run EVERY frame for
     * every participating mesh — the batcher resets the index tail after each
     * upload while draw infos keep absolute offsets, so a mesh that skipped
     * would alias whichever sibling appends first (see the header contract).
     * Runs exactly once per frame (native pump / web fillBuffers);
     * commitMiddleware reads meshBuffer.iData.
     */
    protected appendIndexBuffer (): { meshBuffer: MeshBuffer, startIndex: number } | null {
        const data = this._meshData;
        const rd = this._renderData;
        if (!rd || !rd.chunk || !data || data.vertexCount < 1 || data.indexCount < 1) {
            return null;
        }
        const meshBuffer = rd.getMeshBuffer()!;
        // The native batcher resets indexOffset through shared memory after
        // uploading — sync the JS-side cache before appending.
        if (JSB) meshBuffer.indexOffset = meshBuffer.sharedBuffer[2];
        const startIndex = meshBuffer.indexOffset;
        const ic = data.indexCount;
        const chunkOffset = rd.chunk.vertexOffset;
        const offsetIndices = new Uint16Array(ic);
        new Uint8Array(offsetIndices.buffer).set(data.indexData.subarray(0, ic * 2));
        for (let i = 0; i < ic; i++) offsetIndices[i] += chunkOffset;
        rd.chunk.vertexAccessor.appendIndices(rd.chunk.bufferId, offsetIndices);
        rd.chunk.vertexAccessor.getMeshBuffer(rd.chunk.bufferId).setDirty();

        // Static frames never re-run _prepareNativeDrawInfos — keep the cached
        // draw infos' offsets in step (segment mapping mirrors it).
        this._refreshDrawInfoOffsets(startIndex);
        return { meshBuffer, startIndex };
    }

    private _refreshDrawInfoOffsets (startIndex: number): void {
        const data = this._meshData;
        if (!data || this._drawInfoList.length === 0) return;
        let drawIndex = 0;
        for (const seg of data.segments) {
            const mat = seg.material || this.getRenderMaterial(0);
            if (!seg.texture || !mat) continue;
            const drawInfo = this._drawInfoList[drawIndex++];
            if (drawInfo) drawInfo.setIndexOffset(startIndex + seg.indexOffset);
        }
    }

    /**
     * Bakes the FULL world matrix into the chunk copy's positions — exactly
     * what the USE_LOCAL GPU path applies (pos = cc_matWorld * pos), z and
     * X/Y-rotation included, so batched and unbatched renders agree. Identity
     * is skipped.
     */
    private _bakeWorldTransform (vbuf: Float32Array, byteLength: number, stride: number): void {
        const m = this.node.worldMatrix;
        const m00 = m.m00; const m01 = m.m01; const m02 = m.m02;
        const m04 = m.m04; const m05 = m.m05; const m06 = m.m06;
        const m08 = m.m08; const m09 = m.m09; const m10 = m.m10;
        const m12 = m.m12; const m13 = m.m13; const m14 = m.m14;
        if (m00 === 1 && m01 === 0 && m02 === 0
            && m04 === 0 && m05 === 1 && m06 === 0
            && m08 === 0 && m09 === 0 && m10 === 1
            && m12 === 0 && m13 === 0 && m14 === 0) return;
        const floats = new Float32Array(vbuf.buffer, vbuf.byteOffset, byteLength >> 2);
        const strideF = stride >> 2;
        const vertexCount = byteLength / stride;
        for (let i = 0; i < vertexCount; i++) {
            const o = i * strideF;
            const x = floats[o];
            const y = floats[o + 1];
            const z = floats[o + 2];
            floats[o] = m00 * x + m04 * y + m08 * z + m12;
            floats[o + 1] = m01 * x + m05 * y + m09 * z + m13;
            floats[o + 2] = m02 * x + m06 * y + m10 * z + m14;
        }
    }

    /**
     * Cascaded opacity as Batcher2D.walk accumulates it for COLOR data: own
     * color alpha x, per ancestor, localOpacity x that ancestor's color alpha.
     */
    private _computeCascadedOpacity (): number {
        let opacity = this._color.a / 255;
        for (let node: Node | null = this.node; node; node = node.parent) {
            opacity *= node._uiProps.localOpacity;
            if (node !== this.node) {
                const ancestor = node._uiProps.uiComp as UIRenderer | null;
                if (ancestor && ancestor.color) opacity *= ancestor.color.a / 255;
            }
        }
        return opacity;
    }

    /**
     * Folds opacity into the copied vertices. Light color sits at bytes
     * 20..23 (pos*3f + uv*2f), dark at 24..27 for two-color. Straight data
     * fades via the alpha byte only; PMA data scales light RGBA + dark RGB
     * (dark alpha is the sentinel, not a fade channel).
     */
    private _applyOpacity (vU8: Uint8Array, vc: number, stride: number, opacity: number): void {
        const pma = this._premultipliedAlpha;
        const darkRGB = (pma && stride === MESH_STRIDE_TINT_BYTES) ? 3 : 0;
        for (let i = 0; i < vc; i++) {
            const o = i * stride + 20;
            if (pma) {
                vU8[o]     = (vU8[o] * opacity + 0.5) | 0;
                vU8[o + 1] = (vU8[o + 1] * opacity + 0.5) | 0;
                vU8[o + 2] = (vU8[o + 2] * opacity + 0.5) | 0;
            }
            vU8[o + 3] = (vU8[o + 3] * opacity + 0.5) | 0;
            for (let j = 0; j < darkRGB; j++) {
                vU8[o + 4 + j] = (vU8[o + 4 + j] * opacity + 0.5) | 0;
            }
        }
    }

    private _prepareNativeDrawInfos (): void {
        this._renderEntity.clearDynamicRenderDrawInfos();
        // Vertex refresh + this frame's index submission; a null return means
        // there is nothing drawable this frame.
        const prepared = this._prepareBuffers();
        const data = this._meshData;
        const rd = this._renderData;
        if (!prepared || !data || !rd?.chunk) return;

        const { startIndex } = prepared;
        let drawIndex = 0;
        for (const seg of data.segments) {
            const mat = seg.material || this.getRenderMaterial(0);
            if (!seg.texture || !mat) continue;
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
            drawInfo.setMaterial(mat);
            this._renderEntity.setDynamicRenderDrawInfo(drawInfo, drawIndex);
            drawIndex++;
        }
    }

    /**
     * The spine effect (default-spine-material): ui-sprite-material has no
     * USE_LOCAL variant — node-local input through it would render stuck at
     * the origin.
     */
    protected _updateBuiltinMaterial (): Material {
        return builtinResMgr.get<Material>('default-spine-material');
    }

    /**
     * Keeps the builtin material instance in step with the declared vertex
     * space / data format: USE_LOCAL for the GPU take-over mode, TWO_COLORED
     * for two-color data, and blend factors matching the alpha format.
     */
    public updateMaterial (): void {
        // Align the legacy blend-factor fields first so _updateBlendFunc
        // (inside super) never fights the explicit patching below.
        this._srcBlendFactor = this._premultipliedAlpha ? BlendFactor.ONE : BlendFactor.SRC_ALPHA;
        this._dstBlendFactor = BlendFactor.ONE_MINUS_SRC_ALPHA;
        super.updateMaterial();
        if (this._customMaterial) return;   // custom materials are the user's contract
        const inst = this.getMaterialInstance(0);
        if (!inst) return;
        inst.recompileShaders({
            USE_LOCAL: !this._enableBatch,
            TWO_COLORED: this._useTint,
        });
        // Straight data: src_alpha / 1-src_alpha (the effect default);
        // premultiplied data: ONE / 1-src_alpha, color and alpha channels.
        const src = this._premultipliedAlpha ? BlendFactor.ONE : BlendFactor.SRC_ALPHA;
        const pass = inst.passes[0];
        const target = pass.blendState.targets[0];
        target.blend = true;
        target.blendSrc = src;
        target.blendSrcAlpha = src;
        target.blendDst = BlendFactor.ONE_MINUS_SRC_ALPHA;
        target.blendDstAlpha = BlendFactor.ONE_MINUS_SRC_ALPHA;
        pass.blendState.setTarget(0, target);
        pass._updatePassHash();
    }

    protected createRenderEntity (): RenderEntity {
        const entity = new RenderEntity(RenderEntityType.DYNAMIC);
        // useLocal is re-derived in _syncTransformMode once deserialization
        // has run.
        entity.setUseLocal(!this._enableBatch);
        return entity;
    }

    private ensureAccessor (useTint: boolean): StaticVBAccessor {
        const batcher = director.root!.batcher2D;
        // The previous batcher destroyed its accessors — invalidate the cache.
        if (_accessorBatcher !== batcher) {
            _accessorBatcher = batcher;
            _sharedAccessor = null;
            _sharedTintAccessor = null;
        }
        let accessor = useTint ? _sharedTintAccessor : _sharedAccessor;
        if (!accessor) {
            const device = director.root!.device;
            // Copy the format: the accessor empties its attributes array on
            // destroy, and the vfmt* constants are shared module-level state.
            const attributes = (useTint ? vfmtPosUvTwoColor4B : vfmtPosUvColor4B).slice();
            // 32767: the spine middleware assembler's per-chunk cap
            // (cocos/spine/assembler/simple.ts), half the Uint16 index space.
            accessor = new StaticVBAccessor(device, attributes, 32767);
            batcher.registerBufferAccessor(useTint ? UIMESH_TINT_ACCESSOR_KEY : UIMESH_ACCESSOR_KEY, accessor);
            if (useTint) {
                _sharedTintAccessor = accessor;
            } else {
                _sharedAccessor = accessor;
            }
        }
        return accessor;
    }
}

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
import { IRenderData } from './render-data';
import type { MeshRenderData } from './render-data';
import { NativeRenderDrawInfo } from './native-2d';
import { Node } from '../../scene-graph';
import { Sampler, Texture } from '../../gfx';
import { Model } from '../../render-scene/scene';
import { Material } from '../../asset/assets';
import type { MeshBuffer } from './mesh-buffer';

const bitIndexForIsMeshBuffer = 0;
const bitIndexForIsVertexPositionInWorld = 1;

export enum AttrUInt8ArrayView {
    DrawInfoType,
    VertDirty,
    BooleanValues, // 0 index bit: for IsMeshBuffer, 1 index bit: for isVertexPositionInWorld, remain 6 bits are reserved.
    Stride,
    Count
}

export enum AttrUInt16ArrayView {
    BufferID,
    AccessorID,
    Count
}

export enum AttrUInt32ArrayView {
    VertexOffset,
    IndexOffset,
    VBCount,
    IBCount,
    DataHash,
    Count
}

export enum RenderDrawInfoType {
    COMP,
    MODEL,
    MIDDLEWARE,
    SUB_NODE,
}

function setBitInTypedArray (arr: TypedArray, index: number, bitPosition: number): void {
    arr[index] |= (1 << bitPosition);
}

function clearBitInTypedArray (arr: TypedArray, index: number, bitPosition: number): void {
    arr[index] &= ~(1 << bitPosition);
}

/** @mangle */
export class RenderDrawInfo {
    protected _accId = -1;
    protected _bufferId = -1;
    protected _vertexOffset = 0;
    protected _indexOffset = 0;
    protected _vertDirty = false;
    protected _vbCount = 0;
    protected _ibCount = 0;
    protected _dataHash = 0;
    protected _isMeshBuffer = false;
    protected _isVertexPositionInWorld = false;
    protected _material: Material | null = null;
    protected _texture: Texture | null = null;
    protected _sampler: Sampler | null = null;
    protected _stride = 0;
    protected _useLocal = false;

    protected _model: Model | null = null;
    protected _drawInfoType: RenderDrawInfoType = RenderDrawInfoType.COMP;
    protected _subNode: Node | null = null;
    protected _meshBuffer: MeshBuffer | null = null;

    /**
     * @en (Web only) Back-reference to the owning MeshRenderData for isMeshBuffer COMP drawInfo
     * (Particle2D). WebBatcherCore delegates `uploadBuffers`/`requestIA` to this reference
     * rather than replicating native's self-contained GFX resource management on RenderDrawInfo.
     * @zh （仅 Web）对所属 MeshRenderData 的反向引用（isMeshBuffer COMP，如 Particle2D）。
     * @engineInternal
     * @mangle
     */
    public meshRenderData: MeshRenderData | null = null;

    protected declare _nativeObj: NativeRenderDrawInfo;
    protected declare _uint8SharedBuffer: Uint8Array;
    protected declare _uint16SharedBuffer: Uint16Array;
    protected declare _uint32SharedBuffer: Uint32Array;

    // SharedBuffer of pos/uv/color
    protected _render2dBuffer: Float32Array | null = null;

    constructor (nativeDrawInfo?: NativeRenderDrawInfo) {
        if (JSB) {
            this.init(nativeDrawInfo);
            const attrSharedBuffer = this._nativeObj.getAttrSharedBufferForJS();
            let offset = 0;
            this._uint8SharedBuffer = new Uint8Array(attrSharedBuffer, offset, AttrUInt8ArrayView.Count);
            offset += AttrUInt8ArrayView.Count * Uint8Array.BYTES_PER_ELEMENT;
            this._uint16SharedBuffer = new Uint16Array(attrSharedBuffer, offset, AttrUInt16ArrayView.Count);
            offset += AttrUInt16ArrayView.Count * Uint16Array.BYTES_PER_ELEMENT;
            this._uint32SharedBuffer = new Uint32Array(attrSharedBuffer, offset, AttrUInt32ArrayView.Count);
        }
    }

    get nativeObj (): NativeRenderDrawInfo {
        return this._nativeObj;
    }

    get render2dBuffer (): Float32Array | null {
        return this._render2dBuffer;
    }

    // ── Field accessors (read side for WebBatcherCore; JSB reads native shared buffers instead) ──
    get accId (): number { return this._accId; }
    get bufferId (): number { return this._bufferId; }
    get vertexOffset (): number { return this._vertexOffset; }
    get indexOffset (): number { return this._indexOffset; }
    get vertDirty (): boolean { return this._vertDirty; }
    get vbCount (): number { return this._vbCount; }
    get ibCount (): number { return this._ibCount; }
    get dataHash (): number { return this._dataHash; }
    get isMeshBuffer (): boolean { return this._isMeshBuffer; }
    get isVertexPositionInWorld (): boolean { return this._isVertexPositionInWorld; }
    get material (): Material | null { return this._material; }
    get texture (): Texture | null { return this._texture; }
    get sampler (): Sampler | null { return this._sampler; }
    get stride (): number { return this._stride; }
    get model (): Model | null { return this._model; }
    get drawInfoType (): RenderDrawInfoType { return this._drawInfoType; }
    get subNode (): Node | null { return this._subNode; }
    get meshBuffer (): MeshBuffer | null { return this._meshBuffer; }

    private init (nativeDrawInfo?: NativeRenderDrawInfo): void {
        if (JSB) {
            if (nativeDrawInfo) {
                this._nativeObj = nativeDrawInfo;
            }
            if (!this._nativeObj) {
                this._nativeObj = new NativeRenderDrawInfo();
            }
        }
    }

    public clear (): void {
        if (!JSB) return;
        this._bufferId = 0;
        this._vertexOffset = 0;
        this._indexOffset = 0;
        this._vertDirty = false;
    }

    public setAccId (accId: number): void {
        if (JSB) {
            if (this._accId !== accId) {
                this._uint16SharedBuffer[AttrUInt16ArrayView.AccessorID] = accId;
            }
        }
        this._accId = accId;
    }

    public setBufferId (bufferId: number): void {
        if (JSB) {
            if (this._bufferId !== bufferId) {
                this._uint16SharedBuffer[AttrUInt16ArrayView.BufferID] = bufferId;
                this._nativeObj.changeMeshBuffer();
            }
        }
        this._bufferId = bufferId;
    }

    public setAccAndBuffer (accId: number, bufferId: number): void {
        if (JSB) {
            if (this._accId !== accId || this._bufferId !== bufferId) {
                this._uint16SharedBuffer[AttrUInt16ArrayView.AccessorID] = accId;
                this._uint16SharedBuffer[AttrUInt16ArrayView.BufferID] = bufferId;
                this._nativeObj.changeMeshBuffer();
            }
        }
        this._bufferId = bufferId;
        this._accId = accId;
    }

    public setVertexOffset (vertexOffset: number): void {
        if (JSB) {
            this._uint32SharedBuffer[AttrUInt32ArrayView.VertexOffset] = vertexOffset;
        } else {
            this._vertexOffset = vertexOffset;
        }
    }

    public setIndexOffset (indexOffset: number): void {
        if (JSB) {
            this._uint32SharedBuffer[AttrUInt32ArrayView.IndexOffset] = indexOffset;
        } else {
            this._indexOffset = indexOffset;
        }
    }

    public setVB (vbBuffer: Float32Array): void {
        if (JSB) {
            this._nativeObj.vbBuffer = vbBuffer;
        }
    }

    public setIB (ibBuffer: Uint16Array): void {
        if (JSB) {
            this._nativeObj.ibBuffer = ibBuffer;
        }
    }

    public setVData (vDataBuffer: ArrayBufferLike): void {
        if (JSB) {
            this._nativeObj.vDataBuffer = vDataBuffer;
        }
    }

    public setIData (iDataBuffer: ArrayBufferLike): void {
        if (JSB) {
            this._nativeObj.iDataBuffer = iDataBuffer;
        }
    }

    public setVBCount (vbCount: number): void {
        if (JSB) {
            this._uint32SharedBuffer[AttrUInt32ArrayView.VBCount] = vbCount;
        } else {
            this._vbCount = vbCount;
        }
    }

    public setIBCount (ibCount: number): void {
        if (JSB) {
            this._uint32SharedBuffer[AttrUInt32ArrayView.IBCount] = ibCount;
        } else {
            this._ibCount = ibCount;
        }
    }

    public setVertDirty (val: boolean): void {
        if (JSB) {
            this._uint8SharedBuffer[AttrUInt8ArrayView.VertDirty] = val ? 1 : 0;
        } else {
            this._vertDirty = val;
        }
    }

    public setDataHash (dataHash: number): void {
        if (JSB) {
            this._uint32SharedBuffer[AttrUInt32ArrayView.DataHash] = dataHash;
        } else {
            this._dataHash = dataHash;
        }
    }

    public setIsMeshBuffer (isMeshBuffer: boolean): void {
        if (JSB) {
            if (isMeshBuffer) {
                setBitInTypedArray(this._uint8SharedBuffer, AttrUInt8ArrayView.BooleanValues, bitIndexForIsMeshBuffer);
            } else {
                clearBitInTypedArray(this._uint8SharedBuffer, AttrUInt8ArrayView.BooleanValues, bitIndexForIsMeshBuffer);
            }
        } else {
            this._isMeshBuffer = isMeshBuffer;
        }
    }

    public setVertexPositionInWorld (isVertexPositionInWorld: boolean): void {
        if (JSB) {
            if (isVertexPositionInWorld) {
                setBitInTypedArray(this._uint8SharedBuffer, AttrUInt8ArrayView.BooleanValues, bitIndexForIsVertexPositionInWorld);
            } else {
                clearBitInTypedArray(this._uint8SharedBuffer, AttrUInt8ArrayView.BooleanValues, bitIndexForIsVertexPositionInWorld);
            }
        } else {
            this._isVertexPositionInWorld = isVertexPositionInWorld;
        }
    }

    public setMaterial (material: Material): void {
        if (JSB) {
            if (this._material !== material) {
                this._nativeObj.material = material;
            }
        }
        this._material = material;
    }

    public setTexture (texture: Texture | null): void {
        if (JSB) {
            if (this._texture !== texture) {
                this._nativeObj.texture = texture;
            }
        }
        this._texture = texture;
    }

    public setSampler (sampler: Sampler | null): void {
        if (JSB) {
            if (this._sampler !== sampler) {
                this._nativeObj.sampler = sampler;
            }
        }
        this._sampler = sampler;
    }

    public setModel (model: Model): void {
        if (JSB) {
            if (this._model !== model) {
                this._nativeObj.model = model;
            }
        }
        this._model = model;
    }

    public setDrawInfoType (drawInfoType: RenderDrawInfoType): void {
        if (JSB) {
            if (this._drawInfoType !== drawInfoType) {
                this._uint8SharedBuffer[AttrUInt8ArrayView.DrawInfoType] = drawInfoType;
            }
        }
        this._drawInfoType = drawInfoType;
    }

    public setSubNode (node: Node): void {
        if (JSB) {
            if (this._subNode !== node) {
                this._nativeObj.subNode = node;
            }
        }
        this._subNode = node;
    }

    public setMeshBuffer (meshBuffer: MeshBuffer | null): void {
        if (JSB) {
            this._nativeObj.meshBuffer = meshBuffer;
        } else {
            this._meshBuffer = meshBuffer;
        }
    }

    public setStride (stride: number): void {
        if (JSB) {
            this._uint8SharedBuffer[AttrUInt8ArrayView.Stride] = stride;
        } else {
            this._stride = stride;
        }
    }

    public initRender2dBuffer (): void {
        if (JSB) {
            this._render2dBuffer = new Float32Array(this._vbCount * this._stride);
            this._nativeObj.setRender2dBufferToNative(this._render2dBuffer);
        }
    }

    public fillRender2dBuffer (vertexDataArr: IRenderData[]): void {
        if (JSB) {
            if (!this._render2dBuffer) {
                return;
            }
            const fillLength = Math.min(this._vbCount, vertexDataArr.length);
            let bufferOffset = 0;
            for (let i = 0; i < fillLength; i++) {
                const temp = vertexDataArr[i];
                this._render2dBuffer[bufferOffset] = temp.x;
                this._render2dBuffer[bufferOffset + 1] = temp.y;
                this._render2dBuffer[bufferOffset + 2] = temp.z;
                bufferOffset += this._stride;
            }
        }
    }
}

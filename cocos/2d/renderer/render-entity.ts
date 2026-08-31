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
import { NativeRenderEntity } from './native-2d';
import { RenderDrawInfo } from './render-draw-info';
import { Color } from '../../core';
import { Stage } from './stencil-manager';
import { Node } from '../../scene-graph';

export enum RenderEntityFillColorType {
    COLOR = 0,
    VERTEX
}

export enum RenderEntityType {
    STATIC,
    DYNAMIC,
    CROSSED,
}

enum RenderEntityUInt32SharedBufferView {
    priority,
    count,
}

enum RenderEntityUInt8SharedBufferView {
    colorR,
    colorG,
    colorB,
    colorA,
    maskMode,
    fillColorType,
    count,
}

enum RenderEntityBoolSharedBufferViewBitIndex {
    enabled,
    useLocal,
    count,
}

export enum MaskMode {
    NONE,
    MASK,
    MASK_INVERTED,
    MASK_NODE,
    MASK_NODE_INVERTED
}

/** @mangle */
export class RenderEntity {
    private _renderEntityType: RenderEntityType = RenderEntityType.STATIC;

    private _dynamicDrawInfoArr: RenderDrawInfo[] = [];

    protected _node: Node | null = null;
    protected _renderTransform: Node | null = null;
    protected _stencilStage: Stage = Stage.DISABLED;

    protected _colorDirty = true;
    protected _enabled = false;
    protected _useLocal = false;
    protected _maskMode = MaskMode.NONE;
    protected _fillColorType: RenderEntityFillColorType = RenderEntityFillColorType.COLOR;
    protected _priority = 0;

    protected declare _uint32SharedBuffer: Uint32Array;
    protected declare _uint8SharedBuffer: Uint8Array;
    protected declare _boolSharedBuffer: Uint8Array;

    private declare _nativeObj: NativeRenderEntity;
    get nativeObj (): NativeRenderEntity {
        return this._nativeObj;
    }

    get renderDrawInfoArr (): RenderDrawInfo[] {
        return this._dynamicDrawInfoArr;
    }

    // Uniform draw-info access used by WebBatcherCore (mirrors native getRenderDrawInfosSize /
    // getRenderDrawInfoAt). On Web every entity type stores its draw infos in _dynamicDrawInfoArr
    // (native's static/dynamic union is a native-memory optimization irrelevant to TS).
    getRenderDrawInfosSize (): number {
        return this._dynamicDrawInfoArr.length;
    }

    getRenderDrawInfoAt (index: number): RenderDrawInfo {
        return this._dynamicDrawInfoArr[index];
    }

    get fillColorType (): RenderEntityFillColorType {
        return this._fillColorType;
    }

    get priority (): number {
        return this._priority;
    }

    get renderEntityType (): RenderEntityType {
        return this._renderEntityType;
    }

    get useLocal (): boolean {
        return this._useLocal;
    }

    get renderTransform (): Node | null {
        return this._renderTransform;
    }
    // set renderEntityType (val:RenderEntityType) {
    //     this._renderEntityType = val;
    // }

    setPriority (val: number): void {
        if (JSB) {
            this._uint32SharedBuffer[RenderEntityUInt32SharedBufferView.priority] = val;
        } else {
            this._priority = val;
        }
    }

    protected _color: Color = Color.WHITE.clone();
    get color (): Color {
        return this._color;
    }
    set color (val: Color) {
        if (JSB) {
            this._uint8SharedBuffer[RenderEntityUInt8SharedBufferView.colorR] = val.r;
            this._uint8SharedBuffer[RenderEntityUInt8SharedBufferView.colorG] = val.g;
            this._uint8SharedBuffer[RenderEntityUInt8SharedBufferView.colorB] = val.b;
            this._uint8SharedBuffer[RenderEntityUInt8SharedBufferView.colorA] = val.a;
        } else {
            this._color = val;
        }
    }

    get colorDirty (): boolean {
        if (JSB && this._node) {
            this._colorDirty = (this._node as any)._colorDirty;
        }
        return this._colorDirty;
    }

    set colorDirty (val: boolean) {
        this._colorDirty = val;
        if (JSB && this._node) {
            (this._node as any)._colorDirty = val;
        }
    }

    get enabled (): boolean {
        return this._enabled;
    }

    set enabled (val: boolean) {
        if (JSB) {
            if (val) {
                this._boolSharedBuffer[0] |= (1 << RenderEntityBoolSharedBufferViewBitIndex.enabled);
            } else {
                this._boolSharedBuffer[0] &= ~(1 << RenderEntityBoolSharedBufferViewBitIndex.enabled);
            }
        } else {
            this._enabled = val;
        }
    }

    setUseLocal (useLocal: boolean): void {
        if (JSB) {
            if (useLocal) {
                this._boolSharedBuffer[0] |= (1 << RenderEntityBoolSharedBufferViewBitIndex.useLocal);
            } else {
                this._boolSharedBuffer[0] &= ~(1 << RenderEntityBoolSharedBufferViewBitIndex.useLocal);
            }
        } else {
            this._useLocal = useLocal;
        }
    }

    constructor (entityType: RenderEntityType) {
        if (JSB) {
            if (!this._nativeObj) {
                this._nativeObj = new NativeRenderEntity(entityType);
            }
            this._renderEntityType = entityType;
            this.initSharedBuffer();
        }
    }

    public addDynamicRenderDrawInfo (renderDrawInfo: RenderDrawInfo | null): void {
        if (!renderDrawInfo) return;
        this._dynamicDrawInfoArr.push(renderDrawInfo);
        if (JSB) {
            this._nativeObj.addDynamicRenderDrawInfo(renderDrawInfo.nativeObj);
        }
    }

    public removeDynamicRenderDrawInfo (): void {
        this._dynamicDrawInfoArr.pop();
        if (JSB) {
            this._nativeObj.removeDynamicRenderDrawInfo();
        }
    }

    public clearDynamicRenderDrawInfos (): void {
        this._dynamicDrawInfoArr.length = 0;
        if (JSB) {
            this._nativeObj.clearDynamicRenderDrawInfos();
        }
    }

    public clearStaticRenderDrawInfos (): void {
        if (JSB) {
            this._nativeObj.clearStaticRenderDrawInfos();
        } else {
            // Web: static draw infos share _dynamicDrawInfoArr (see getStaticRenderDrawInfo).
            this._dynamicDrawInfoArr.length = 0;
        }
    }

    public clearRenderDrawInfos (): void {
        if (JSB) {
            if (this._renderEntityType === RenderEntityType.DYNAMIC) {
                this.removeDynamicRenderDrawInfo();
            } else if (this._renderEntityType === RenderEntityType.STATIC) {
                this.clearStaticRenderDrawInfos();
            }
        }
    }

    public setDynamicRenderDrawInfo (renderDrawInfo: RenderDrawInfo | null, index: number): void {
        if (!renderDrawInfo) return;
        if (this._dynamicDrawInfoArr.length < index + 1) {
            this._dynamicDrawInfoArr.push(renderDrawInfo);
            if (JSB) {
                this._nativeObj.addDynamicRenderDrawInfo(renderDrawInfo.nativeObj);
            }
        } else {
            this._dynamicDrawInfoArr[index] = renderDrawInfo;
            if (JSB) {
                this._nativeObj.setDynamicRenderDrawInfo(renderDrawInfo.nativeObj, index);
            }
        }
    }

    public setMaskMode (mode: MaskMode): void {
        if (JSB) {
            this._uint8SharedBuffer[RenderEntityUInt8SharedBufferView.maskMode] = mode;
        } else {
            this._maskMode = mode;
        }
    }

    public setFillColorType (fillColorType: RenderEntityFillColorType): void {
        if (JSB) {
            this._uint8SharedBuffer[RenderEntityUInt8SharedBufferView.fillColorType] = fillColorType;
        } else {
            this._fillColorType = fillColorType;
        }
    }

    public getStaticRenderDrawInfo (): RenderDrawInfo | null {
        if (JSB) {
            const nativeDrawInfo = this._nativeObj.getStaticRenderDrawInfo(this._nativeObj.staticDrawInfoSize++);
            const drawInfo = new RenderDrawInfo(nativeDrawInfo);
            return drawInfo;
        }
        // Web: static draw infos live in the same _dynamicDrawInfoArr the batcher iterates, so the
        // walk sees them uniformly via getRenderDrawInfoAt. Called once per RenderData at init, not
        // per frame, so plain allocation here is fine.
        const drawInfo = new RenderDrawInfo();
        this._dynamicDrawInfoArr.push(drawInfo);
        return drawInfo;
    }

    setNode (node: Node | null): void {
        if (JSB) {
            if (this._node !== node) {
                this._nativeObj.node = node;
            }
        }
        this._node = node;
    }

    setRenderTransform (renderTransform: Node | null): void {
        if (JSB) {
            if (this._renderTransform !== renderTransform) {
                this._nativeObj.renderTransform = renderTransform;
            }
        }
        this._renderTransform = renderTransform;
    }

    setStencilStage (stage: Stage): void {
        if (JSB) {
            if (this._stencilStage !== stage) {
                this._nativeObj.stencilStage = stage;
            }
        }
        this._stencilStage = stage;
    }

    private initSharedBuffer (): void {
        if (JSB) {
            const buffer = this._nativeObj.getEntitySharedBufferForJS();
            let offset = 0;
            this._uint32SharedBuffer = new Uint32Array(buffer, offset, RenderEntityUInt32SharedBufferView.count);
            offset += RenderEntityUInt32SharedBufferView.count * 4;
            this._uint8SharedBuffer = new Uint8Array(buffer, offset, RenderEntityUInt8SharedBufferView.count);
            offset += RenderEntityUInt8SharedBufferView.count * 1;
            this._boolSharedBuffer = new Uint8Array(buffer, offset, 1); // Only use 1 bytes for at most 8 booleans
        }
    }
}

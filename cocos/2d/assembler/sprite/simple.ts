/*
 Copyright (c) 2017-2023 Xiamen Yaji Software Co., Ltd.

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

/**
 * @packageDocumentation
 * @module ui-assembler
 */

import type { IAssembler } from '../../renderer/base';
import type { IRenderData, RenderData } from '../../renderer/render-data';
import type { IBatcher } from '../../renderer/i-batcher';
import type { Sprite } from '../../components';
import { dynamicAtlasManager } from '../../utils/dynamic-atlas/atlas-manager';
import type { StaticVBChunk } from '../../renderer/static-vb-accessor';

const QUAD_INDICES = Uint16Array.from([0, 1, 2, 1, 3, 2]);

/**
 * simple 组装器
 * 可通过 `UI.simple` 获取该组装器。
 */
class Simple implements IAssembler {
    createData (sprite: Sprite): RenderData {
        const renderData = sprite.requestRenderData();
        renderData.dataLength = 4;
        renderData.resize(4, 6);
        renderData.chunk.setIndexBuffer(QUAD_INDICES);
        renderData.indices = QUAD_INDICES;
        return renderData;
    }

    updateRenderData (sprite: Sprite): void {
        const frame = sprite.spriteFrame;

        dynamicAtlasManager.packToDynamicAtlas(sprite, frame);
        this.updateUVs(sprite);// dirty need
        //this.updateColor(sprite);// dirty need

        const renderData = sprite.renderData;
        if (renderData && frame) {
            if (renderData.vertDirty) {
                this.updateVertexData(sprite);
            }
            renderData.updateRenderData(sprite, frame);
        }
    }

    private updateVertexData (sprite: Sprite): void {
        const renderData: RenderData | null = sprite.renderData;
        if (!renderData) {
            return;
        }

        const uiTrans = sprite.node._getUITransformComp()!;
        const dataList: IRenderData[] = renderData.data;
        const cw = uiTrans.width;
        const ch = uiTrans.height;
        const appX = uiTrans.anchorX * cw;
        const appY = uiTrans.anchorY * ch;
        let l = 0;
        let b = 0;
        let r = 0;
        let t = 0;
        if (sprite.trim) {
            l = -appX;
            b = -appY;
            r = cw - appX;
            t = ch - appY;
        } else {
            const frame = sprite.spriteFrame!;
            const originSize = frame.originalSize;
            const ow = originSize.width;
            const oh = originSize.height;
            const scaleX = cw / ow;
            const scaleY = ch / oh;
            const trimmedBorder = frame.trimmedBorder;
            l = trimmedBorder.x * scaleX - appX;
            b = trimmedBorder.z * scaleY - appY;
            r = cw + trimmedBorder.y * scaleX - appX;
            t = ch + trimmedBorder.w * scaleY - appY;
        }

        dataList[0].x = l;
        dataList[0].y = b;

        dataList[1].x = r;
        dataList[1].y = b;

        dataList[2].x = l;
        dataList[2].y = t;

        dataList[3].x = r;
        dataList[3].y = t;

        renderData.vertDirty = true;
    }

    updateUVs (sprite: Sprite): void {
        const renderData = sprite.renderData;
        if (!sprite.spriteFrame || !renderData) return;
        const vData = renderData.chunk.vb;
        const uv = sprite.spriteFrame.uv;
        const stride = renderData.floatStride;
        let uvOffset = 3;
        for (let i = 0; i < renderData.dataLength; ++i) {
            const index = i * 2;
            vData[uvOffset] = uv[index];
            vData[uvOffset + 1] = uv[index + 1];
            uvOffset += stride;
        }
    }

    updateColor (sprite: Sprite): void {
        const renderData = sprite.renderData;
        if (!renderData) return;
        const vData = renderData.chunk.vb;
        let colorOffset = 5;
        const color = sprite.color;
        const colorR = color.r / 255;
        const colorG = color.g / 255;
        const colorB = color.b / 255;
        const colorA = color.a / 255;
        for (let i = 0; i < 4; i++, colorOffset += renderData.floatStride) {
            vData[colorOffset] = colorR;
            vData[colorOffset + 1] = colorG;
            vData[colorOffset + 2] = colorB;
            vData[colorOffset + 3] = colorA;
        }
    }
}

export const simple = new Simple();

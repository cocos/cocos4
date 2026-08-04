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
import { ClearFlagBit, Texture, Framebuffer, RenderPass,
    ColorAttachment, DepthStencilAttachment, RenderPassInfo,
    TextureInfo, TextureType, TextureUsageBit, Format, LoadOp, StoreOp,
    FramebufferInfo } from '../../gfx';
import { SKYBOX_FLAG } from './camera';
import type { ReflectionProbe as JsbReflectionProbe } from './reflection-probe';
import { cclegacy } from '../../core';

declare const jsb: any;

export enum ProbeClearFlag {
    SKYBOX = SKYBOX_FLAG | ClearFlagBit.DEPTH_STENCIL,
    SOLID_COLOR = ClearFlagBit.ALL,
}

export enum ProbeType {
    CUBE = 0,
    PLANAR = 1,
}

export const ReflectionProbe: typeof JsbReflectionProbe = jsb.ReflectionProbe;
export type ReflectionProbe = JsbReflectionProbe;
const reflectionProbeProto: any = jsb.ReflectionProbe.prototype;
reflectionProbeProto._ctor = function (id:number) {
    this._probeId = id;
    this._supportTransparency = false;
    this.intermediateTextures = [];
    this.intermediateFramebuffers = [];
    this._intermediateRenderPass = null;
    this._intermediateDepthStencilTex = null;
};

Object.defineProperty(reflectionProbeProto, 'supportTransparency', {
    get (this: any): boolean {
        return this._supportTransparency;
    },
    set (this: any, value: boolean) {
        this._supportTransparency = value;
    },
});

reflectionProbeProto.useFloatIntermediateRT = function (this: any): boolean {
    return this._supportTransparency;
};

reflectionProbeProto.initIntermediateTextures = function (this: any, width: number, height: number, count: number): void {
    reflectionProbeProto._destroyIntermediateTextures.call(this);

    const root = cclegacy.director.root;
    const device = root.device;

    const colorAttachment = new ColorAttachment();
    colorAttachment.format = Format.RGBA16F;
    colorAttachment.loadOp = LoadOp.CLEAR;
    colorAttachment.storeOp = StoreOp.STORE;

    const depthStencilAttachment = new DepthStencilAttachment();
    depthStencilAttachment.format = Format.DEPTH_STENCIL;
    depthStencilAttachment.depthLoadOp = LoadOp.CLEAR;
    depthStencilAttachment.depthStoreOp = StoreOp.STORE;
    depthStencilAttachment.stencilLoadOp = LoadOp.CLEAR;
    depthStencilAttachment.stencilStoreOp = StoreOp.STORE;

    const renderPassInfo = new RenderPassInfo([colorAttachment], depthStencilAttachment);
    this._intermediateRenderPass = device.createRenderPass(renderPassInfo) as RenderPass;

    this._intermediateDepthStencilTex = device.createTexture(new TextureInfo(
        TextureType.TEX2D, TextureUsageBit.DEPTH_STENCIL_ATTACHMENT, Format.DEPTH_STENCIL, width, height,
    )) as Texture;

    for (let i = 0; i < count; i++) {
        const colorTex: Texture = device.createTexture(new TextureInfo(
            TextureType.TEX2D, TextureUsageBit.COLOR_ATTACHMENT | TextureUsageBit.SAMPLED, Format.RGBA16F, width, height,
        )) as Texture;
        this.intermediateTextures.push(colorTex);

        const fb: Framebuffer = device.createFramebuffer(new FramebufferInfo(
            this._intermediateRenderPass, [colorTex], this._intermediateDepthStencilTex,
        ));
        this.intermediateFramebuffers.push(fb);
    }
};

reflectionProbeProto._destroyIntermediateTextures = function (this: any): void {
    for (let i = 0; i < this.intermediateFramebuffers.length; i++) {
        this.intermediateFramebuffers[i].destroy();
    }
    this.intermediateFramebuffers.length = 0;

    for (let i = 0; i < this.intermediateTextures.length; i++) {
        this.intermediateTextures[i].destroy();
    }
    this.intermediateTextures.length = 0;

    if (this._intermediateDepthStencilTex) {
        this._intermediateDepthStencilTex.destroy();
        this._intermediateDepthStencilTex = null;
    }

    if (this._intermediateRenderPass) {
        this._intermediateRenderPass.destroy();
        this._intermediateRenderPass = null;
    }
};

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

import { ccclass } from 'cc.decorator';
import { Color, Rect, Framebuffer, ClearFlagBit, Device, CommandBuffer } from '../../gfx';
import { IRenderStageInfo, RenderStage } from '../render-stage';
import { ForwardStagePriority } from '../enum';
import { ForwardPipeline } from '../forward/forward-pipeline';
import { SetIndex } from '../define';
import { ReflectionProbeFlow } from './reflection-probe-flow';
import { Camera, ReflectionProbe } from '../../render-scene/scene';
import { RenderReflectionProbeQueue } from '../render-reflection-probe-queue';
import { Vec3 } from '../../core';
import { packRGBE } from '../../core/math/color';
import { Material } from '../../asset/assets/material';
import { PipelineStateManager } from '../pipeline-state-manager';

const colors: Color[] = [new Color(1, 1, 1, 1)];

/**
 * @en reflection probe render stage
 * @zh 反射探针渲染阶段。
 */
@ccclass('ReflectionProbeStage')
export class ReflectionProbeStage extends RenderStage {
    /**
     * @en A common initialization info for reflection probe render stage
     * @zh 一个通用的 reflection probe stage 的初始化信息对象
     */
    public static initInfo: IRenderStageInfo = {
        name: 'ReflectionProbeStage',
        priority: ForwardStagePriority.FORWARD,
        tag: 0,
    };

    private _frameBuffer: Framebuffer | null = null;
    private _outputFrameBuffer: Framebuffer | null = null;
    private _renderArea = new Rect();
    private _probe: ReflectionProbe | null = null;
    private _probeRenderQueue!: RenderReflectionProbeQueue;
    private _rgbeColor = new Vec3();
    private _convertMaterial: Material | null = null;

    constructor () {
        super();
    }

    /**
     * @en Sets the probe info
     * @zh 设置probe信息
     * @param probe
     * @param frameBuffer
     */
    public setUsageInfo (probe: ReflectionProbe, frameBuffer: Framebuffer, outputFrameBuffer: Framebuffer | null = null): void {
        this._probe = probe;
        this._frameBuffer = frameBuffer;
        this._outputFrameBuffer = outputFrameBuffer;
    }

    public destroy (): void {
        this._frameBuffer = null;
        this._probeRenderQueue?.clear();
    }

    public clearFramebuffer (camera: Camera): void {
        if (!this._frameBuffer) { return; }

        colors[0].w = camera.clearColor.w;
        const pipeline = this._pipeline as ForwardPipeline;
        const pipelineSceneData = pipeline.pipelineSceneData;
        const shadingScale = pipelineSceneData.shadingScale;
        const vp = camera.viewport;
        const size = this._probe!.resolution;
        this._renderArea.x = vp.x * size;
        this._renderArea.y = vp.y * size;
        this._renderArea.width = vp.width * size * shadingScale;
        this._renderArea.height = vp.height * size * shadingScale;
        const cmdBuff = pipeline.commandBuffers[0];
        const renderPass = this._frameBuffer.renderPass;

        cmdBuff.beginRenderPass(
            renderPass,
            this._frameBuffer,
            this._renderArea,
            colors,
            camera.clearDepth,
            camera.clearStencil,
        );
        cmdBuff.endRenderPass();
    }

    public render (camera: Camera): void {
        const pipeline = this._pipeline;
        const cmdBuff = pipeline.commandBuffers[0];
        this._probeRenderQueue.gatherRenderObjects(this._probe!, camera, cmdBuff);
        pipeline.pipelineUBO.updateCameraUBO(this._probe!.camera);

        this._renderArea.x = 0;
        this._renderArea.y = 0;
        this._renderArea.width = this._probe!.renderArea().x;
        this._renderArea.height = this._probe!.renderArea().y;

        const renderPass = this._frameBuffer!.renderPass;

        if (this._probe!.camera.clearFlag & ClearFlagBit.COLOR) {
            if (this._probe!.useFloatIntermediateRT()) {
                colors[0].x = this._probe!.camera.clearColor.x;
                colors[0].y = this._probe!.camera.clearColor.y;
                colors[0].z = this._probe!.camera.clearColor.z;
                colors[0].w = this._probe!.camera.clearColor.w;
            } else {
                this._rgbeColor.x = this._probe!.camera.clearColor.x;
                this._rgbeColor.y = this._probe!.camera.clearColor.y;
                this._rgbeColor.z = this._probe!.camera.clearColor.z;
                const rgbe = packRGBE(this._rgbeColor);
                colors[0].x = rgbe.x;
                colors[0].y = rgbe.y;
                colors[0].z = rgbe.z;
                colors[0].w = rgbe.w;
            }
        }
        const device = pipeline.device;
        cmdBuff.beginRenderPass(
            renderPass,
            this._frameBuffer!,
            this._renderArea,
            colors,
            this._probe!.camera.clearDepth,
            this._probe!.camera.clearStencil,
        );
        cmdBuff.bindDescriptorSet(SetIndex.GLOBAL, pipeline.descriptorSet);

        this._probeRenderQueue.recordCommandBuffer(device, renderPass, cmdBuff);
        cmdBuff.endRenderPass();

        if (this._outputFrameBuffer) {
            this._renderConvertPass(device, cmdBuff);
        }

        pipeline.pipelineUBO.updateCameraUBO(camera);
    }

    private _renderConvertPass (device: Device, cmdBuff: CommandBuffer): void {
        const mat = this._getConvertMaterial();
        if (!mat || !mat.passes.length) return;

        const pass = mat.passes[0];
        const shader = pass.getShaderVariant();
        if (!pass || !shader) return;

        const fwdPipeline = this._pipeline as ForwardPipeline;
        const inputAssembler = fwdPipeline.quadIAOffscreen;
        if (!inputAssembler) return;

        const intermediateColorTex = this._frameBuffer!.colorTextures[0]!;
        const binding = pass.getBinding('probeColorTex');
        if (binding < 0) return;

        const w = this._renderArea.width;
        const h = this._renderArea.height;
        const minX = this._renderArea.x / w;
        const maxX = (this._renderArea.x + w) / w;
        let minY = this._renderArea.y / h;
        let maxY = (this._renderArea.y + h) / h;
        if (device.capabilities.screenSpaceSignY > 0) {
            const temp = maxY;
            maxY = minY;
            minY = temp;
        }
        const vbData = new Float32Array(16);
        let n = 0;
        vbData[n++] = -1.0; vbData[n++] = -1.0; vbData[n++] = minX; vbData[n++] = maxY;
        vbData[n++] = 1.0; vbData[n++] = -1.0; vbData[n++] = maxX; vbData[n++] = maxY;
        vbData[n++] = -1.0; vbData[n++] = 1.0; vbData[n++] = minX; vbData[n++] = minY;
        vbData[n++] = 1.0; vbData[n++] = 1.0; vbData[n++] = maxX; vbData[n++] = minY;
        inputAssembler.vertexBuffers[0].update(vbData.buffer);

        const outputRenderPass = this._outputFrameBuffer!.renderPass;

        colors[0].x = 0;
        colors[0].y = 0;
        colors[0].z = 0;
        colors[0].w = 0;

        cmdBuff.beginRenderPass(outputRenderPass, this._outputFrameBuffer!, this._renderArea, colors, 1.0, 0);
        cmdBuff.bindDescriptorSet(SetIndex.GLOBAL, fwdPipeline.descriptorSet);

        const sampler = fwdPipeline.globalDSManager.linearSampler;
        pass.descriptorSet.bindTexture(binding, intermediateColorTex);
        pass.descriptorSet.bindSampler(binding, sampler);
        pass.descriptorSet.update();
        cmdBuff.bindDescriptorSet(SetIndex.MATERIAL, pass.descriptorSet);

        const pso = PipelineStateManager.getOrCreatePipelineState(device, pass, shader, outputRenderPass, inputAssembler);
        cmdBuff.bindPipelineState(pso);
        cmdBuff.bindInputAssembler(inputAssembler);
        cmdBuff.draw(inputAssembler);

        cmdBuff.endRenderPass();
    }

    private _getConvertMaterial (): Material {
        if (!this._convertMaterial) {
            this._convertMaterial = new Material();
            this._convertMaterial._uuid = 'reflection-probe-rgbe-convert-material';
            this._convertMaterial.initialize({ effectName: 'pipeline/probe-rgbe-convert' });
        }
        return this._convertMaterial;
    }

    public activate (pipeline: ForwardPipeline, flow: ReflectionProbeFlow): void {
        super.activate(pipeline, flow);
        this._probeRenderQueue = new RenderReflectionProbeQueue(pipeline);
    }
}

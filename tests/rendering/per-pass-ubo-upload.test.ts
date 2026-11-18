import { cclegacy, Vec4 } from '../../cocos/core';
import {
    Buffer,
    BufferInfo,
    BufferUsageBit,
    BufferViewInfo,
    Color,
    DescriptorType,
    Format,
    LoadOp,
    MemoryUsageBit,
    Rect,
    ShaderStageFlagBit,
    StoreOp,
    Type,
    Uniform,
    UniformBlock,
} from '../../cocos/gfx';
import { Executor } from '../../cocos/rendering/custom/executor';
import {
    DescriptorBlockData,
    DescriptorData,
    DescriptorSetData,
    DescriptorSetLayoutData,
    DescriptorTypeOrder,
    LayoutGraphData,
    LayoutGraphDataValue,
    PipelineLayoutData,
    RenderPhaseData,
    RenderStageData,
} from '../../cocos/rendering/custom/layout-graph';
import { QueueHint, ResourceResidency, UpdateFrequency } from '../../cocos/rendering/custom/types';
import { WebPipeline } from '../../cocos/rendering/custom/web-pipeline';

interface TrackedUBOStats {
    liveBytes: number;
    bufferWords: Map<Buffer, Uint32Array>;
    restore: () => void;
}

function trackUniformBuffers (): TrackedUBOStats {
    const device = cclegacy.director.root.device;
    const origCreateBuffer = device.createBuffer.bind(device);
    const bufferSizes = new Map<Buffer, number>();
    const bufferWords = new Map<Buffer, Uint32Array>();
    const stats: TrackedUBOStats = {
        liveBytes: 0,
        bufferWords,
        restore: (): void => {},
    };

    const spy = jest.spyOn(device, 'createBuffer').mockImplementation((info: BufferInfo | BufferViewInfo): Buffer => {
        const buf = origCreateBuffer(info as any);
        if (!('buffer' in info) && (info.usage & BufferUsageBit.UNIFORM)) {
            const byteSize = info.size;
            bufferSizes.set(buf, byteSize);
            bufferWords.set(buf, new Uint32Array(byteSize / 4));
            stats.liveBytes += byteSize;

            const origUpdate = buf.update.bind(buf);
            jest.spyOn(buf, 'update').mockImplementation((data: BufferSource, size?: number): void => {
                const view = ArrayBuffer.isView(data)
                    ? new Uint8Array(data.buffer, data.byteOffset, size ?? data.byteLength)
                    : new Uint8Array(data, 0, size ?? data.byteLength);
                const dst = new Uint8Array(bufferWords.get(buf)!.buffer);
                dst.set(view.subarray(0, dst.byteLength));
                origUpdate(data, size);
            });

            const origDestroy = buf.destroy.bind(buf);
            jest.spyOn(buf, 'destroy').mockImplementation((): void => {
                const trackedSize = bufferSizes.get(buf);
                if (trackedSize !== undefined) {
                    stats.liveBytes -= trackedSize;
                    bufferSizes.delete(buf);
                    bufferWords.delete(buf);
                }
                origDestroy();
            });
        }
        return buf;
    });

    stats.restore = (): void => {
        spy.mockRestore();
    };
    return stats;
}

function addStageWithUBOs (
    lg: LayoutGraphData,
    stageName: string,
    blocks: Array<{ blockId: number; binding: number; blockName: string; members: Uniform[] }>,
): number {
    const stageLayout = new PipelineLayoutData();
    const layoutData = new DescriptorSetLayoutData();
    const descBlock = new DescriptorBlockData(
        DescriptorTypeOrder.UNIFORM_BUFFER,
        ShaderStageFlagBit.ALL,
        blocks.length,
    );
    descBlock.offset = 0;
    for (const b of blocks) {
        descBlock.descriptors.push(new DescriptorData(b.blockId, Type.UNKNOWN, 1));
        layoutData.uniformBlocks.set(b.blockId, new UniformBlock(UpdateFrequency.PER_PASS, b.binding, b.blockName, b.members, 1));
        layoutData.bindingMap.set(b.blockId, b.binding);
    }
    layoutData.descriptorBlocks.push(descBlock);

    const setData = new DescriptorSetData(layoutData);
    stageLayout.getSets().set(UpdateFrequency.PER_PASS, setData);

    const stageId = lg.addVertex<LayoutGraphDataValue.RenderStage>(
        LayoutGraphDataValue.RenderStage,
        new RenderStageData(),
        stageName,
        UpdateFrequency.PER_PASS,
        stageLayout,
    );
    lg.addVertex<LayoutGraphDataValue.RenderPhase>(
        LayoutGraphDataValue.RenderPhase,
        new RenderPhaseData(),
        'default',
        UpdateFrequency.PER_PHASE,
        new PipelineLayoutData(),
        stageId,
    );
    return stageId;
}

function createUBOTestPipeline (twoVec4 = false, includeGlobalInCustomStages = true, suffix = ''): {
    ppl: WebPipeline;
    stageA: string;
    stageB: string;
    cleanup: () => void;
    getBoundBuffer: (layoutName: string, binding?: number) => Buffer;
} {
    const lg = new LayoutGraphData();
    const constantNames = ['cc_time', 'cc_screenSize', 'cc_nativeSize', 'cc_debug_view_mode', 'bugParam', 'bugExtra'];
    constantNames.forEach((name, idx) => {
        lg.constantIndex.set(name, idx);
    });
    const blockNames = ['CCGlobal', 'BugUBO'];
    blockNames.forEach((name, idx) => {
        lg.attributeIndex.set(name, idx);
    });

    const globalMembers = [
        new Uniform('cc_time', Type.FLOAT4, 1),
        new Uniform('cc_screenSize', Type.FLOAT4, 1),
        new Uniform('cc_nativeSize', Type.FLOAT4, 1),
        new Uniform('cc_debug_view_mode', Type.FLOAT4, 1),
    ];
    const bugMembers = twoVec4
        ? [new Uniform('bugParam', Type.FLOAT4, 1), new Uniform('bugExtra', Type.FLOAT4, 1)]
        : [new Uniform('bugParam', Type.FLOAT4, 1)];

    const bugBinding = includeGlobalInCustomStages ? 1 : 0;
    const customBlocks = includeGlobalInCustomStages
        ? [
            { blockId: 0, binding: 0, blockName: 'CCGlobal', members: globalMembers },
            { blockId: 1, binding: bugBinding, blockName: 'BugUBO', members: bugMembers },
        ]
        : [
            { blockId: 1, binding: bugBinding, blockName: 'BugUBO', members: bugMembers },
        ];

    const stageA = `ubo-bug-a${suffix}`;
    const stageB = `ubo-bug-b${suffix}`;

    const defaultStage = addStageWithUBOs(lg, 'default', [
        { blockId: 0, binding: 0, blockName: 'CCGlobal', members: globalMembers },
    ]);
    addStageWithUBOs(lg, stageA, customBlocks);
    addStageWithUBOs(lg, stageB, customBlocks);

    const ppl = new WebPipeline(lg);
    jest.spyOn(ppl as any, '_compileMaterial').mockImplementation(() => {});
    ppl.activate(null!);
    // Ensure EmptyDescriptorSetLayout has descriptorType / bindingIndices populated like WebGL2DescriptorSetLayout
    for (const v of lg.v()) {
        const set = lg.getLayout(v).getSet(UpdateFrequency.PER_PASS);
        if (set?.descriptorSetLayout) {
            const dsl = set.descriptorSetLayout;
            for (let i = 0; i < dsl.bindings.length; ++i) {
                dsl.bindings[i].descriptorType = DescriptorType.UNIFORM_BUFFER;
                const b = dsl.bindings[i].binding;
                dsl.bindingIndices[b] = i;
                dsl.descriptorIndices[b] = i;
            }
        }
    }
    (ppl as any)._width = 64;
    (ppl as any)._height = 64;

    const prevPipeline = cclegacy.director.root.pipeline;
    const prevRendering = cclegacy.rendering;
    cclegacy.director.root._pipeline = ppl;
    cclegacy.rendering = {
        getPassID: (name?: string): number => lg.locateChild(lg.N, name || 'default'),
        getPhaseID: (): number => defaultStage + 1,
    };

    ppl.addRenderTarget('Temp0', Format.RGBA8, 64, 64, ResourceResidency.PERSISTENT);
    ppl.addRenderTarget('Color0', Format.RGBA8, 64, 64, ResourceResidency.PERSISTENT);

    return {
        ppl,
        stageA,
        stageB,
        getBoundBuffer: (layoutName: string, binding = bugBinding): Buffer => {
            const stageId = lg.locateChild(lg.N, layoutName);
            const set = lg.getLayout(stageId).getSet(UpdateFrequency.PER_PASS)!;
            return set.descriptorSet!.getBuffer(binding);
        },
        cleanup: (): void => {
            cclegacy.director.root._pipeline = prevPipeline;
            cclegacy.rendering = prevRendering;
        },
    };
}

describe('Custom pipeline per-pass UBO upload', () => {
    test('uploads identical uniform values to both passes across 16 alternating frames after default layout warmup', () => {
        const tracker = trackUniformBuffers();
        const { ppl, stageA, stageB, cleanup, getBoundBuffer } = createUBOTestPipeline(false, true, '-1');
        const dummyCam = { viewport: new Rect(0, 0, 1, 1) } as any;
        const executor = new Executor(ppl, ppl.device, ppl.resourceGraph, ppl.layoutGraph, 64, 64);

        try {
            // Warm-up default layout frame
            ppl.beginSetup();
            const warmPass = ppl.addRenderPass(64, 64, 'default');
            warmPass.addRenderTarget('Color0', LoadOp.CLEAR, StoreOp.STORE, new Color(0, 0, 0, 1));
            warmPass.addQueue(QueueHint.NONE).addDraw3D(dummyCam, []);
            ppl.endSetup();
            ppl.compile();
            executor.execute(ppl.renderGraph!);
            ppl.endFrame();

            const val = new Vec4();
            for (let frame = 0; frame < 16; ++frame) {
                const input = frame & 1;
                val.set(input, 0, 0, 0);

                ppl.beginSetup();
                const passA = ppl.addRenderPass(64, 64, stageA);
                passA.addRenderTarget('Temp0', LoadOp.DISCARD, StoreOp.STORE);
                passA.setVec4('bugParam', val);
                passA.addQueue(QueueHint.NONE).addDraw3D(dummyCam, []);

                const passB = ppl.addRenderPass(64, 64, stageB);
                passB.addRenderTarget('Color0', LoadOp.DISCARD, StoreOp.STORE);
                passB.setVec4('bugParam', val);
                passB.addQueue(QueueHint.NONE).addDraw3D(dummyCam, []);
                ppl.endSetup();
                ppl.compile();

                executor.execute(ppl.renderGraph!);

                const wordsA = tracker.bufferWords.get(getBoundBuffer(stageA))!;
                const wordsB = tracker.bufferWords.get(getBoundBuffer(stageB))!;
                const expectedWord = input === 1 ? 0x3f800000 : 0x00000000;
                expect(wordsA[0]).toBe(expectedWord);
                expect(wordsB[0]).toBe(expectedWord);
                ppl.endFrame();
            }
        } finally {
            executor.release();
            ppl.destroy();
            cleanup();
            tracker.restore();
        }
    });

    test('preserves IEEE-754 negative zero sign bit (0x80000000 vs 0x00000000) across alternating frames', () => {
        const tracker = trackUniformBuffers();
        const { ppl, stageA, stageB, cleanup, getBoundBuffer } = createUBOTestPipeline(false, true, '-2');
        const dummyCam = { viewport: new Rect(0, 0, 1, 1) } as any;
        const executor = new Executor(ppl, ppl.device, ppl.resourceGraph, ppl.layoutGraph, 64, 64);

        try {
            const valA = new Vec4(1, 0, 0, 0);
            const valB = new Vec4(0, 0, 0, 0);
            const observedWordsB: number[] = [];

            for (let frame = 0; frame < 8; ++frame) {
                valB.x = (frame & 1) === 0 ? +0 : -0;

                ppl.beginSetup();
                const passA = ppl.addRenderPass(64, 64, stageA);
                passA.addRenderTarget('Temp0', LoadOp.DISCARD, StoreOp.STORE);
                passA.setVec4('bugParam', valA);
                passA.addQueue(QueueHint.NONE).addDraw3D(dummyCam, []);

                const passB = ppl.addRenderPass(64, 64, stageB);
                passB.addRenderTarget('Color0', LoadOp.DISCARD, StoreOp.STORE);
                passB.setVec4('bugParam', valB);
                passB.addQueue(QueueHint.NONE).addDraw3D(dummyCam, []);
                ppl.endSetup();
                ppl.compile();

                executor.execute(ppl.renderGraph!);
                const wordsB = tracker.bufferWords.get(getBoundBuffer(stageB))!;
                observedWordsB.push(wordsB[0]);
                ppl.endFrame();
            }

            expect(observedWordsB).toEqual([
                0x00000000,
                0x80000000,
                0x00000000,
                0x80000000,
                0x00000000,
                0x80000000,
                0x00000000,
                0x80000000,
            ]);
        } finally {
            executor.release();
            ppl.destroy();
            cleanup();
            tracker.restore();
        }
    });

    test('allows queue.setBuffer to override parent pass UBO binding across frames', () => {
        const tracker = trackUniformBuffers();
        const { ppl, stageA, cleanup, getBoundBuffer } = createUBOTestPipeline(false, true, '-3');
        const dummyCam = { viewport: new Rect(0, 0, 1, 1) } as any;
        const executor = new Executor(ppl, ppl.device, ppl.resourceGraph, ppl.layoutGraph, 64, 64);

        const extBuffer = ppl.device.createBuffer(new BufferInfo(
            BufferUsageBit.UNIFORM | BufferUsageBit.TRANSFER_DST,
            MemoryUsageBit.HOST | MemoryUsageBit.DEVICE,
            16,
            16,
        ));
        extBuffer.update(new Float32Array([1.0, 0.5, 0.0, 0.0]));

        try {
            for (let frame = 0; frame < 4; ++frame) {
                ppl.beginSetup();
                const pass = ppl.addRenderPass(64, 64, stageA);
                pass.addRenderTarget('Color0', LoadOp.CLEAR, StoreOp.STORE);
                if (frame >= 1) {
                    pass.setVec4('bugParam', new Vec4(0, 0, 0, 0));
                }
                const queue = pass.addQueue(QueueHint.NONE);
                queue.setBuffer('BugUBO', extBuffer);
                queue.addDraw3D(dummyCam, []);
                ppl.endSetup();
                ppl.compile();

                executor.execute(ppl.renderGraph!);
                const bound = getBoundBuffer(stageA);
                expect(bound).toBe(extBuffer);
                const words = tracker.bufferWords.get(bound)!;
                expect(words[0]).toBe(0x3f800000); // 1.0
                expect(words[1]).toBe(0x3f000000); // 0.5
                ppl.endFrame();
            }
        } finally {
            executor.release();
            ppl.destroy();
            expect(tracker.bufferWords.has(extBuffer)).toBe(true);
            extBuffer.destroy();
            cleanup();
            tracker.restore();
        }
    });

    test('isolates partial UBO member updates across layouts while preserving pass-to-queue inheritance', () => {
        const tracker = trackUniformBuffers();
        const { ppl, stageA, stageB, cleanup, getBoundBuffer } = createUBOTestPipeline(true, true, '-5');
        const dummyCam = { viewport: new Rect(0, 0, 1, 1) } as any;
        const executor = new Executor(ppl, ppl.device, ppl.resourceGraph, ppl.layoutGraph, 64, 64);

        try {
            for (let frame = 0; frame < 4; ++frame) {
                ppl.beginSetup();
                // Pass A (stageA): only sets bugParam (fieldX = 0); bugExtra (fieldY) must stay 0 across all frames
                const passA = ppl.addRenderPass(64, 64, stageA);
                passA.addRenderTarget('Temp0', LoadOp.DISCARD, StoreOp.STORE);
                passA.setVec4('bugParam', new Vec4(0, 0, 0, 0));
                passA.addQueue(QueueHint.NONE).addDraw3D(dummyCam, []);

                // Pass B (stageB): pass sets bugParam = 0.5, queue sets bugExtra = 1.0 (inherits bugParam = 0.5)
                const passB = ppl.addRenderPass(64, 64, stageB);
                passB.addRenderTarget('Color0', LoadOp.DISCARD, StoreOp.STORE);
                passB.setVec4('bugParam', new Vec4(0.5, 0, 0, 0));
                const queueB = passB.addQueue(QueueHint.NONE);
                queueB.setVec4('bugExtra', new Vec4(1.0, 0, 0, 0));
                queueB.addDraw3D(dummyCam, []);
                ppl.endSetup();
                ppl.compile();

                executor.execute(ppl.renderGraph!);

                const wordsA = tracker.bufferWords.get(getBoundBuffer(stageA))!;
                const wordsB = tracker.bufferWords.get(getBoundBuffer(stageB))!;
                // Pass A: bugParam.x = 0, bugExtra.x = 0 (not polluted by Pass B's bugExtra = 1.0)
                expect(wordsA[0]).toBe(0x00000000);
                expect(wordsA[4]).toBe(0x00000000);
                // Pass B: queue inherited bugParam.x = 0.5 (0x3f000000) and applied bugExtra.x = 1.0 (0x3f800000)
                expect(wordsB[0]).toBe(0x3f000000);
                expect(wordsB[4]).toBe(0x3f800000);
                ppl.endFrame();
            }
        } finally {
            executor.release();
            ppl.destroy();
            cleanup();
            tracker.restore();
        }
    });
});

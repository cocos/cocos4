import { Mat4, Vec3 } from '../../cocos/core';
import { Material } from '../../cocos/asset/assets/material';
import { Camera, LightType } from '../../cocos/render-scene/scene';
import { Pipeline, RenderPassBuilder } from '../../cocos/rendering/custom/pipeline';
import { AccessType } from '../../cocos/rendering/custom/types';
import { ForwardClusteredLighting, packClusterLights } from '../../cocos/rendering/custom/forward-clustered-lighting';

// 使用真实数学类型和打包函数，只替换 GPU 图构建接口；测试无需图形设备。
type TestCamera = Camera & { scene: {
    sphereLights: any[]; spotLights: any[]; pointLights: any[]; rangedDirLights: any[];
} };
function camera (): TestCamera {
    return {
        scene: { sphereLights: [], spotLights: [], pointLights: [], rangedDirLights: [] },
        exposure: 2, nearClip: 0.1, farClip: 100,
        matView: new Mat4(), matProj: new Mat4(), matProjInv: new Mat4(),
    } as unknown as TestCamera;
}

function light (type: LightType): any {
    return { type, position: new Vec3(1, 2, 3), color: new Vec3(1, 0.5, 0.25),
        finalColor: new Vec3(0.2, 0.3, 0.4), baked: false, luminance: 7, illuminance: 11,
        range: 5, size: 0.2, direction: new Vec3(0, 0, -1), right: new Vec3(1, 0, 0),
        scale: new Vec3(-2, 4, 6), spotAngle: 0.8, angleAttenuationStrength: 0.6 };
}

function pass (): any {
    return { addStorageBuffer: jest.fn(), setVec4: jest.fn(), setMat4: jest.fn(),
        addQueue: () => ({ addDispatch: jest.fn() }) };
}

function pipeline (): any {
    const resources = new Map<string, number>();
    return { device: { hasFeature: () => true, capabilities: {
        maxComputeWorkGroupInvocations: 128, maxComputeWorkGroupSize: { x: 16, y: 8, z: 1 },
        maxComputeWorkGroupCount: { x: 1, y: 1, z: 24 },
        maxShaderStorageBufferBindings: 5, maxShaderStorageBlockSize: 3072 * 200 * 4, clipSpaceMinZ: 0,
    } }, pipelineSceneData: { isHDR: true },
    containsResource: (name: string) => resources.has(name),
    addStorageBuffer: jest.fn((name, format, bytes) => resources.set(name, bytes)),
    addUploadPass: jest.fn(), addComputePass: jest.fn(() => pass()),
    };
}

test('四类光源使用五 vec4 布局，保留曝光、色温、聚光参数和范围方向光半尺寸', () => {
    const cam = camera();
    cam.scene!.sphereLights.push(light(LightType.SPHERE));
    cam.scene!.spotLights.push({ ...light(LightType.SPOT), useColorTemperature: true });
    cam.scene!.pointLights.push(light(LightType.POINT), { ...light(LightType.POINT), baked: true });
    cam.scene!.rangedDirLights.push(light(LightType.RANGED_DIRECTIONAL));
    const data = packClusterLights(cam, true);
    expect(data.length).toBe(80);
    expect(data[7]).toBe(140000);
    expect(data[47]).toBe(140000);
    expect(data[67]).toBe(22);
    expect(data[24]).toBeCloseTo(0.2);
    expect(data[39]).toBeCloseTo(0.6);
    expect(Array.from(data.slice(76, 79))).toEqual([1, 2, 3]);
    expect(packClusterLights(cam, false)[7]).toBe(7);
});

test('零灯绑定有效；全局超过上限明确报错而不静默丢灯', () => {
    const cam = camera();
    expect(packClusterLights(cam, false)).toEqual(new Float32Array(20));
    cam.scene!.pointLights.push(...Array.from({ length: 1001 }, () => light(LightType.POINT)));
    expect(() => packClusterLights(cam, false)).toThrow(/1000/);
});

test('上传与相机常量是快照，多相机资源隔离，重复帧不会重复注册资源', () => {
    const ppl = pipeline();
    const lighting = new ForwardClusteredLighting({} as Material, {} as Material, {} as Material);
    const cam = camera();
    cam.scene!.pointLights.push(light(LightType.POINT));
    const a = lighting.build(ppl as Pipeline, cam);
    const upload = ppl.addUploadPass.mock.calls[0][0][0].source;
    const savedUpload = new Uint8Array(upload);
    cam.matProj.m00 = 123;
    cam.nearClip = 3;
    (cam.scene!.pointLights[0].position as Vec3).x = 50;
    const b = lighting.build(ppl as Pipeline, camera());
    expect(b.prefix).not.toBe(a.prefix);
    expect(b.lightCount).toBe(0);
    expect(upload).toEqual(savedUpload);
    const renderPass = pass();
    lighting.bind(renderPass as RenderPassBuilder, ppl, a);
    expect(renderPass.setMat4.mock.calls.find(([name]) => name === 'cc_clusterProj')[1].m00).toBe(1);
    expect(renderPass.setVec4.mock.calls[0][1].x).toBe(0.1);
    expect(renderPass.addStorageBuffer).toHaveBeenCalledWith(a.prefix + 'Grid', AccessType.READ, 'b_clusterLightGrid');
    lighting.build(ppl, cam);
    expect(ppl.addStorageBuffer).toHaveBeenCalledTimes(10);
    const cull = ppl.addComputePass.mock.results[2].value;
    expect(cull.addStorageBuffer).toHaveBeenCalledWith(a.prefix + 'Counter', AccessType.READ_WRITE, 'b_globalIndex');
});

test('不满足存储和工作组限制时拒绝启用，非法投影不产生图节点', () => {
    const ppl = pipeline();
    expect(ForwardClusteredLighting.supported(ppl)).toBe(true);
    ppl.device.capabilities.maxShaderStorageBlockSize = 1024;
    expect(ForwardClusteredLighting.supported(ppl)).toBe(false);
    ppl.device.capabilities.maxShaderStorageBlockSize = 3072 * 200 * 4;
    const cam = camera();
    cam.farClip = Infinity;
    const lighting = new ForwardClusteredLighting({} as Material, {} as Material, {} as Material);
    expect(() => lighting.build(ppl, cam)).toThrow(/nearClip/);
    expect(ppl.addComputePass).not.toHaveBeenCalled();
});

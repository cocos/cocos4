import { Vec3, Vec4, Mat4 } from '../../core';
import { Material } from '../../asset/assets/material';
import * as gfx from '../../gfx';
import * as scene from '../../render-scene/scene';
import { BasicPipeline, Pipeline, RenderPassBuilder, Setter } from './pipeline';
import { AccessType, ResourceResidency, UploadPair } from './types';

export const CLUSTER_COUNT = 16 * 8 * 24;
export const MAX_CLUSTER_LIGHTS = 200;
export const MAX_LIGHTS = 1000;
export const FLOATS_PER_LIGHT = 20;
let nextClusterInstanceID = 0;

type LocalLight = scene.SphereLight | scene.SpotLight
    | scene.PointLight | scene.RangedDirectionalLight;

/**
 * 将实时局部灯打包为 std430 连续 vec4；每灯 80 字节，与 lights.chunk 一一对应。
 * 主方向光由标准表面着色处理，不进入列表；烘焙灯不重复计入直接光。
 * 返回独立数组：图在 setup 后执行，复用上传数组会使前一相机读到后一相机的数据。
 */
export function packClusterLights (camera: scene.Camera, isHDR: boolean): Float32Array {
    const cameraScene = camera.scene;
    if (!cameraScene) throw new Error('Clustered lighting 要求相机已关联场景。');
    const lights: LocalLight[] = [...cameraScene.sphereLights, ...cameraScene.spotLights,
        ...cameraScene.pointLights, ...cameraScene.rangedDirLights].filter((light) => !light.baked);
    if (lights.length > MAX_LIGHTS) {
        throw new Error(`Clustered lighting 最多支持 ${MAX_LIGHTS} 盏实时局部灯，当前为 ${lights.length}。`);
    }
    // 零灯也上传清零记录以保证 binding 非空；循环次数由 UBO 的 lightCount 决定。
    const data = new Float32Array(Math.max(1, lights.length) * FLOATS_PER_LIGHT);
    lights.forEach((light, index) => {
        const offset = index * FLOATS_PER_LIGHT;
        Vec3.toArray(data, light.position, offset);
        data[offset + 3] = light.type;
        Vec3.toArray(data, light.useColorTemperature ? light.finalColor : light.color, offset + 4);
        if (light.type === scene.LightType.RANGED_DIRECTIONAL) {
            const directional = light as scene.RangedDirectionalLight;
            data[offset + 7] = directional.illuminance * (isHDR ? camera.exposure : 1);
            Vec3.toArray(data, directional.right, offset + 8);
            Vec3.toArray(data, directional.direction, offset + 12);
            const scale = directional.scale;
            data[offset + 16] = Math.abs(scale.x) * 0.5;
            data[offset + 17] = Math.abs(scale.y) * 0.5;
            data[offset + 18] = Math.abs(scale.z) * 0.5;
        } else {
            // 与内建 forward-add 光度换算一致；范围方向光用 illuminance，不能套用这里的比例。
            const punctual = light as scene.SphereLight | scene.SpotLight | scene.PointLight;
            data[offset + 7] = punctual.luminance * (isHDR ? camera.exposure * 10000 : 1);
            data[offset + 8] = light.type === scene.LightType.POINT ? 0 : (light as scene.SphereLight).size;
            data[offset + 9] = punctual.range;
            if (light.type === scene.LightType.SPOT) {
                const spot = light as scene.SpotLight;
                data[offset + 10] = spot.spotAngle;
                Vec3.toArray(data, spot.direction, offset + 12);
                data[offset + 19] = spot.angleAttenuationStrength;
            }
        }
    });
    return data;
}

export interface ClusterFrame {
    /** 常量快照将 build/culling 与 raster 固定在同一投影下。 */
    readonly nearClip: number;
    readonly farClip: number;
    readonly view: Mat4;
    readonly projection: Mat4;
    readonly projectionInverse: Mat4;
    readonly prefix: string;
    readonly lightCount: number;
}

/**
 * 为 custom pipeline 构建 Upload → Build/Reset → Culling → Forward 资源依赖。
 * 调用者持有三个已加载的 compute 材质并负责生命周期，本类不销毁借入材质。
 * buffer 由资源图托管，每实例、每相机使用独立名字，避免多相机覆盖。
 * 同一相机每次 setup 调用 build 一次，然后将快照交给 bind。
 * 不自动修改场景材质或注册全局管线，避免影响其他 custom pipeline。
 */
export class ForwardClusteredLighting {
    private readonly resourcePrefix = `ForwardCluster${nextClusterInstanceID++}_`;
    private readonly cameraIDs = new WeakMap<scene.Camera, number>();
    private nextID = 0;
    private readonly constants = new Vec4();

    constructor (
private readonly buildMaterial: Material,
        private readonly resetMaterial: Material,
        private readonly cullingMaterial: Material,
    ) {}

    static supported (ppl: BasicPipeline): boolean {
        const caps = ppl.device.capabilities;
        return ppl.device.hasFeature(gfx.Feature.COMPUTE_SHADER)
            && caps.maxComputeWorkGroupInvocations >= 128
            && caps.maxComputeWorkGroupSize.x >= 16
            && caps.maxComputeWorkGroupSize.y >= 8
            && caps.maxComputeWorkGroupSize.z >= 1
            && caps.maxComputeWorkGroupCount.x >= 1
            && caps.maxComputeWorkGroupCount.y >= 1
            && caps.maxComputeWorkGroupCount.z >= 24
            && caps.maxShaderStorageBufferBindings >= 5
            && caps.maxShaderStorageBlockSize >= CLUSTER_COUNT * MAX_CLUSTER_LIGHTS * 4;
    }

    /** 在场景队列前调用，构造图节点，不进行立即 GPU 上传。 */
    build (ppl: Pipeline, camera: scene.Camera): ClusterFrame {
        if (!ForwardClusteredLighting.supported(ppl)) throw new Error('设备不满足 clustered compute 的工作组或存储缓冲区要求。');
        if (!(Number.isFinite(camera.farClip) && camera.nearClip > 0 && camera.farClip > camera.nearClip)) {
            throw new Error('Clustered lighting 要求有限的 0 < nearClip < farClip。');
        }
        // 先完成输入校验和打包，再登记资源；非法灯数不会留下半份计算图。
        const data = packClusterLights(camera, ppl.pipelineSceneData.isHDR);
        let id = this.cameraIDs.get(camera);
        if (id === undefined) {
            id = this.nextID++;
            this.cameraIDs.set(camera, id);
        }
        const prefix = `${this.resourcePrefix}${id}`;
        const cameraScene = camera.scene!;
        const lightCount = [...cameraScene.sphereLights, ...cameraScene.spotLights,
            ...cameraScene.pointLights, ...cameraScene.rangedDirLights].filter((light) => !light.baked).length;
        const sizes: [string, number][] = [
            ['AABB', CLUSTER_COUNT * 32], ['Lights', MAX_LIGHTS * FLOATS_PER_LIGHT * 4],
            ['Grid', CLUSTER_COUNT * 16], ['Indices', CLUSTER_COUNT * MAX_CLUSTER_LIGHTS * 4], ['Counter', 4],
        ];
        for (const [suffix, bytes] of sizes) {
            const name = prefix + suffix;
            if (!ppl.containsResource(name)) {
                ppl.addStorageBuffer(name, gfx.Format.UNKNOWN, bytes, ResourceResidency.MANAGED);
            }
        }
        // 上传也必须作为图节点声明，建立 transfer-write → compute-read 依赖。
        ppl.addUploadPass([new UploadPair(new Uint8Array(data.buffer), `${prefix}Lights`)]);
        const frame: ClusterFrame = {
            prefix,
            lightCount,
            nearClip: camera.nearClip,
            farClip: camera.farClip,
            view: Mat4.clone(camera.matView),
            projection: Mat4.clone(camera.matProj),
            projectionInverse: Mat4.clone(camera.matProjInv),
        };
        // MANAGED 内容不承诺跨帧保留，必须每帧重建，不能仅比较投影矩阵。
        // 每组 16×8×1 线程，dispatch 1×1×24 组，共 3072 个 cluster。
        const build = ppl.addComputePass('cluster-build');
        build.name = `${prefix}Build`;
        build.addStorageBuffer(`${prefix}AABB`, AccessType.WRITE, 'b_clusters');
        this.setConstants(build, ppl, frame);
        build.addQueue().addDispatch(1, 1, 24, this.buildMaterial, 0);

        const reset = ppl.addComputePass('cluster-reset');
        reset.name = `${prefix}Reset`;
        reset.addStorageBuffer(`${prefix}Counter`, AccessType.WRITE, 'b_globalIndex');
        reset.addQueue().addDispatch(1, 1, 1, this.resetMaterial, 0);

        const cull = ppl.addComputePass('cluster-culling');
        cull.name = `${prefix}Culling`;
        cull.addStorageBuffer(`${prefix}AABB`, AccessType.READ, 'b_clusters');
        cull.addStorageBuffer(`${prefix}Lights`, AccessType.READ, 'b_ccLights');
        cull.addStorageBuffer(`${prefix}Grid`, AccessType.WRITE, 'b_clusterLightGrid');
        cull.addStorageBuffer(`${prefix}Indices`, AccessType.WRITE, 'b_clusterLightIndices');
        // atomicAdd 读取旧 offset 并写入新值；READ_WRITE 保留对 reset 的依赖。
        cull.addStorageBuffer(`${prefix}Counter`, AccessType.READ_WRITE, 'b_globalIndex');
        this.setConstants(cull, ppl, frame);
        cull.addQueue().addDispatch(1, 1, 24, this.cullingMaterial, 0);
        return frame;
    }

    /** raster READ 声明既绑定 shader slot，也将 compute 输出连接到最终颜色输出。 */
    bind (pass: RenderPassBuilder, ppl: Pipeline, frame: ClusterFrame): void {
        pass.addStorageBuffer(`${frame.prefix}Lights`, AccessType.READ, 'b_ccLights');
        pass.addStorageBuffer(`${frame.prefix}Grid`, AccessType.READ, 'b_clusterLightGrid');
        pass.addStorageBuffer(`${frame.prefix}Indices`, AccessType.READ, 'b_clusterLightIndices');
        this.setConstants(pass, ppl, frame);
    }

    private setConstants (setter: Setter, ppl: Pipeline, frame: ClusterFrame): void {
        this.constants.set(frame.nearClip, frame.farClip, frame.lightCount, ppl.device.capabilities.clipSpaceMinZ);
        setter.setVec4('cc_clusterCamera', this.constants);
        setter.setMat4('cc_clusterView', frame.view);
        setter.setMat4('cc_clusterProj', frame.projection);
        setter.setMat4('cc_clusterProjInv', frame.projectionInverse);
    }
}

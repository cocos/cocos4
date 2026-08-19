/*
 Copyright (c) 2020-2023 Xiamen Yaji Software Co., Ltd.

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
import { EDITOR } from 'internal:constants';
import { Camera, CameraAperture, CameraFOVAxis, CameraISO, CameraProjection, CameraShutter, CameraType, SkyBoxFlagValue, TrackingType } from './camera';
import { Node } from '../../scene-graph/node';
import { Color, Quat, Rect, toRadian, Vec2, Vec3, geometry, cclegacy, Vec4, Size, v3, quat } from '../../core';
import { CAMERA_DEFAULT_MASK } from '../../rendering/define';
import {
    ClearFlagBit, Framebuffer,
    ColorAttachment, DepthStencilAttachment,
    Format, LoadOp, StoreOp,
    RenderPassInfo, RenderPass,
    Texture, TextureInfo, TextureType, TextureUsageBit,
    FramebufferInfo, FormatFeatureBit,
} from '../../gfx';
import { TextureCube } from '../../asset/assets/texture-cube';
import { RenderTexture } from '../../asset/assets/render-texture';

export enum ProbeClearFlag {
    SKYBOX = SkyBoxFlagValue.VALUE | ClearFlagBit.DEPTH_STENCIL,
    SOLID_COLOR = ClearFlagBit.ALL,
}

export enum ProbeType {
    CUBE = 0,
    PLANAR = 1,
}
// right left up down front back
const cameraDir: Vec3[] = [
    v3(0, -90, 0),
    v3(0, 90, 0),

    v3(90, 0, 0),
    v3(-90, 0, 0),

    v3(0, 0, 0),
    v3(0, 180, 0),
];

const tempVec3 = v3();

export class ReflectionProbe {
    public bakedCubeTextures: RenderTexture[] = [];

    public realtimePlanarTexture: RenderTexture | null = null;

    protected _resolution = 256;
    protected _clearFlag: number = ProbeClearFlag.SKYBOX;
    protected _backgroundColor = new Color(0, 0, 0, 255);
    protected _visibility = CAMERA_DEFAULT_MASK;
    protected _probeType = ProbeType.CUBE;
    protected _cubemap: TextureCube | null = null;
    protected readonly _size = v3(1, 1, 1);

    /**
     * @en Camera used for probe rendering (cubemap capture or planar reflection).
     * @zh 用于探针渲染的相机（cubemap 采集或平面反射）
     */
    private _camera: Camera | null = null;

    private _previewCamera: Camera | null = null;

    /**
     * @en Unique id of probe.
     * @zh probe的唯一id
     */
    private _probeId = 0;

    private _needRefresh = false;

    private _needRender = false;

    private _node: Node | null = null;

    private _cameraNode: Node | null = null;

    /**
     * @en The AABB bounding box and probe only render the objects inside the bounding box.
     * @zh AABB包围盒，probe只渲染包围盒内的物体
     */
    private _boundingBox: geometry.AABB | null = null;

    /**
     * @en The position of the camera in world space.
     * @zh 世界空间相机的位置
     */
    private _cameraWorldPos = v3();

    /**
     * @en The rotation of the camera in world space.
     * @zh 世界空间相机的旋转
     */
    private _cameraWorldRotation = quat();

    /**
     * @en The forward direction vertor of the camera in world space.
     * @zh 世界空间相机朝前的方向向量
     */
    private _forward = v3();
    /**
     * @en The up direction vertor of the camera in world space.
     * @zh 世界空间相机朝上的方向向量
     */
    private _up = v3();

    /**
     * @en Reflection probe cube pattern preview sphere
     * @zh 反射探针cube模式的预览小球
     */
    protected _previewSphere: Node | null = null;

    protected _previewPlane: Node | null = null;

    private _supportTransparency = false;
    private _intermediateRenderPass: RenderPass | null = null;
    private _intermediateDepthStencil: Texture | null = null;

    private _intermediateTextures: Texture[] = [];

    /**
     * @engineInternal
     * @mangle
     */
    public intermediateFramebuffers: Framebuffer[] = [];

    /**
     * @en Set probe type,cube or planar.
     * @zh 设置探针类型，cube或者planar
     */
    set probeType (value: ProbeType) {
        this._probeType = value;
    }
    get probeType (): ProbeType {
        return this._probeType;
    }

    get resolution (): number {
        return this._resolution;
    }

    /**
     * @en set render texture size
     * @zh 设置渲染纹理大小
     */
    set resolution (value: number) {
        if (value !== this._resolution) {
            this.bakedCubeTextures.forEach((rt, idx): void => {
                rt.resize(value, value);
            });
        }
        this._resolution = value;
    }

    /**
     * @en Clearing flags of the camera, specifies which part of the framebuffer will be actually cleared every frame.
     * @zh 相机的缓冲清除标志位，指定帧缓冲的哪部分要每帧清除。
     */
    set clearFlag (value: number) {
        this._clearFlag = value;
        this.camera.clearFlag = this._clearFlag;
    }
    get clearFlag (): number {
        return this._clearFlag;
    }

    /**
     * @en Clearing color of the camera.
     * @zh 相机的颜色缓冲默认值。
     */
    set backgroundColor (val: Color) {
        this._backgroundColor = val;
        this.camera.clearColor = this._backgroundColor;
    }
    get backgroundColor (): Color {
        return this._backgroundColor;
    }
    /**
     * @en Visibility mask, declaring a set of node layers that will be visible to this camera.
     * @zh 可见性掩码，声明在当前相机中可见的节点层级集合。
     */
    get visibility (): number {
        return this._visibility;
    }
    set visibility (val) {
        this._visibility = val;
        this._camera!.visibility = this._visibility;
        if (this._previewCamera) {
            this._previewCamera.visibility = this._visibility;
        }
    }

    /**
     * @en Gets or sets the size of the box, in local space.
     * @zh 获取或设置盒的大小。
     */
    set size (value) {
        this._size.set(value);

        this.node.getWorldPosition(tempVec3);
        geometry.AABB.set(this._boundingBox!, tempVec3.x, tempVec3.y, tempVec3.z, value.x, value.y, value.z);
    }
    get size (): Vec3 {
        return this._size;
    }

    set cubemap (val: TextureCube | null) {
        this._cubemap = val;
    }

    get cubemap (): TextureCube | null {
        return this._cubemap!;
    }

    /**
     * @en The node of the probe.
     * @zh probe绑定的节点
     */
    get node (): Node {
        return this._node!;
    }

    get camera (): Camera {
        return this._camera!;
    }

    /**
     * @en Refresh the objects that use this probe.
     * @zh 刷新使用该probe的物体
     */
    set needRefresh (value: boolean) {
        this._needRefresh = value;
    }

    get needRefresh (): boolean {
        return this._needRefresh;
    }

    set needRender (value: boolean) {
        this._needRender = value;
    }
    get needRender (): boolean {
        return this._needRender;
    }

    get boundingBox (): geometry.AABB | null {
        return this._boundingBox;
    }

    set cameraNode (node: Node) {
        this._cameraNode = node;
    }
    get cameraNode (): Node {
        return this._cameraNode!;
    }

    /**
     * @en Reflection probe cube mode preview sphere
     * @zh 反射探针cube模式的预览小球
     * @engineInternal
     */
    set previewSphere (val: Node | null) {
        this._previewSphere = val;
    }

    get previewSphere (): Node | null {
        return this._previewSphere!;
    }

    /**
     * @en Reflection probe planar mode preview plane
     * @zh 反射探针Planar模式的预览平面
     */
    set previewPlane (val: Node) {
        this._previewPlane = val;
    }

    get previewPlane (): Node {
        return this._previewPlane!;
    }

    /**
     * @engineInternal
     * @mangle
     */
    set supportTransparency (value: boolean) {
        this._supportTransparency = value;
    }
    /**
     * @engineInternal
     * @mangle
     */
    get supportTransparency (): boolean {
        return this._supportTransparency;
    }

    /**
     * @en Whether to use RGBA16F intermediate render target for transparency support.
     * @zh 是否使用 RGBA16F 中间渲染目标以支持半透明渲染。
     * @engineInternal
     * @mangle
     */
    public useFloatIntermediateRT (): boolean {
        if (!this._supportTransparency || this._probeType === ProbeType.PLANAR) { return false; }
        // Check device RGBA16F capability
        const device = cclegacy.director.root?.device;
        if (!device) { return false; }
        const features = device.getFormatFeatures(Format.RGBA16F);
        return (features & (FormatFeatureBit.RENDER_TARGET | FormatFeatureBit.SAMPLED_TEXTURE))
            === (FormatFeatureBit.RENDER_TARGET | FormatFeatureBit.SAMPLED_TEXTURE);
    }

    constructor (id: number) {
        this._probeId = id;
    }

    public initialize (node: Node, cameraNode: Node): void {
        this._node = node;
        this._cameraNode = cameraNode;
        this.node.getWorldPosition(tempVec3);
        const size = this._size;
        this._boundingBox = geometry.AABB.create(tempVec3.x, tempVec3.y, tempVec3.z, size.x, size.y, size.z);
        this._createCamera(cameraNode);
    }

    public initBakedTextures (): void {
        if (this.bakedCubeTextures.length === 0) {
            for (let i = 0; i < 6; i++) {
                const renderTexture = this._createTargetTexture(this._resolution, this._resolution);
                this.bakedCubeTextures.push(renderTexture);
            }
        }
        if (this.useFloatIntermediateRT() && this._intermediateTextures.length === 0) {
            this.initIntermediateTextures(this._resolution, this._resolution, 6);
        }
    }

    public captureCubemap (): void {
        this.initBakedTextures();
        this._resetCameraParams();
        this._needRender = true;
    }

    /**
     * @en Render real-time planar reflection textures
     * @zh 渲染实时平面反射贴图
     * @param sourceCamera render planar reflection for this camera
     */
    public renderPlanarReflection (sourceCamera: Camera): void {
        if (!sourceCamera) return;
        if (!this.realtimePlanarTexture) {
            const canvasSize = cclegacy.view.getDesignResolutionSize() as Size;
            this.realtimePlanarTexture = this._createTargetTexture(canvasSize.width, canvasSize.height);
            cclegacy.internal.reflectionProbeManager.updatePlanarMap(this, this.realtimePlanarTexture.getGFXTexture());
            if (this.useFloatIntermediateRT()) {
                this.initIntermediateTextures(canvasSize.width, canvasSize.height, 1);
            }
        }
        this._syncCameraParams(sourceCamera);
        this._transformReflectionCamera(sourceCamera);
        this._needRender = true;
    }

    /**
     * @engineInternal
     * @mangle
     */
    public renderPreviewPlanarReflection (sourceCamera: Camera): Camera {
        if (!this._previewCamera) {
            this._createCamera(new Node(`${this.cameraNode.name} Preview Reflection`), true);
        }
        const previewCamera = this._previewCamera!;
        this._syncCameraParams(sourceCamera, previewCamera);
        this._transformReflectionCamera(sourceCamera, previewCamera);
        this._needRender = true;
        return previewCamera;
    }

    public switchProbeType (type: ProbeType, sourceCamera: Camera | null): void {
        if (type === ProbeType.CUBE) {
            this._needRender = false;
        } else if (sourceCamera !== null) {
            this.renderPlanarReflection(sourceCamera);
        }
    }

    public getProbeId (): number {
        return this._probeId;
    }

    public updateProbeId (id): void {
        this._probeId = id;
    }

    public renderArea (): Vec2 {
        if (this._probeType === ProbeType.PLANAR) {
            return new Vec2(this.realtimePlanarTexture!.width, this.realtimePlanarTexture!.height);
        } else {
            return new Vec2(this.resolution, this.resolution);
        }
    }

    public isFinishedRendering (): boolean {
        return true;
    }

    public validate (): boolean {
        return this.cubemap !== null;
    }

    public destroy (): void {
        if (this._camera) {
            this._camera.destroy();
            this._camera = null;
        }
        if (this._previewCamera) {
            const cameraNode = this._previewCamera.node;
            this._previewCamera.destroy();
            this._previewCamera = null;
            cameraNode.destroy();
        }
        for (let i = 0; i < this.bakedCubeTextures.length; i++) {
            this.bakedCubeTextures[i].destroy();
        }
        this.bakedCubeTextures = [];

        if (this.realtimePlanarTexture) {
            this.realtimePlanarTexture.destroy();
            this.realtimePlanarTexture = null;
        }

        this._destroyIntermediateTextures();
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public enable (): void {
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public disable (): void {
    }

    public updateCameraDir (faceIdx: number): void {
        this.cameraNode.setRotationFromEuler(cameraDir[faceIdx]);
        this.camera.update(true);
    }

    public updateBoundingBox (): void {
        if (this.node) {
            this.node.getWorldPosition(tempVec3);
            const size = this._size;
            geometry.AABB.set(this._boundingBox!, tempVec3.x, tempVec3.y, tempVec3.z, size.x, size.y, size.z);
        }
    }

    public hasFrameBuffer (framebuffer: Framebuffer): boolean {
        if (this.probeType === ProbeType.PLANAR) {
            if (!this.realtimePlanarTexture) return false;
            if (this.realtimePlanarTexture.window?.framebuffer === framebuffer) {
                return true;
            }
        } else {
            if (this.bakedCubeTextures.length === 0) return false;
            for (let i = 0; i < this.bakedCubeTextures.length; i++) {
                const rt = this.bakedCubeTextures[i];
                if (rt.window?.framebuffer === framebuffer) {
                    return true;
                }
            }
        }
        return false;
    }

    public isRGBE (): boolean  {
        //todo: realtime do not use rgbe
        return true;
    }

    private _syncCameraParams (camera: Camera, targetCamera: Camera = this.camera): void {
        targetCamera.projectionType = camera.projectionType;
        targetCamera.orthoHeight = camera.orthoHeight;
        targetCamera.nearClip = camera.nearClip;
        targetCamera.farClip = camera.farClip;
        targetCamera.fov = camera.fov;
        targetCamera.clearFlag = camera.clearFlag;
        targetCamera.clearColor = camera.clearColor;
        targetCamera.priority = camera.priority - 1;
        targetCamera.resize(camera.width, camera.height);
    }

    private _createCamera (cameraNode: Node, preview = false): Camera | null {
        const root = cclegacy.director.root;
        let camera = preview ? this._previewCamera : this._camera;
        if (!camera) {
            camera = root.createCamera();
            if (!camera) return null;
            camera.initialize({
                name: cameraNode.name,
                node: cameraNode,
                projection: CameraProjection.PERSPECTIVE,
                window: preview || EDITOR ? root.mainWindow : root.tempWindow,
                priority: 0,
                cameraType: CameraType.DEFAULT,
                trackingType: TrackingType.NO_TRACKING,
            });
            if (preview) {
                this._previewCamera = camera;
            } else {
                this._camera = camera;
            }
        }
        camera.setViewportInOrientedSpace(new Rect(0, 0, 1, 1));
        camera.fovAxis = CameraFOVAxis.VERTICAL;
        camera.fov = toRadian(90);
        camera.orthoHeight = 10;
        camera.nearClip = 1;
        camera.farClip = 1000;
        camera.clearColor = this._backgroundColor;
        camera.clearDepth = 1.0;
        camera.clearStencil = 0.0;
        camera.clearFlag = this._clearFlag;
        camera.visibility = this._visibility;
        camera.aperture = CameraAperture.F16_0;
        camera.shutter = CameraShutter.D125;
        camera.iso = CameraISO.ISO100;
        return camera;
    }

    private _resetCameraParams (): void {
        this.camera.projectionType = CameraProjection.PERSPECTIVE;
        this.camera.orthoHeight = 10;
        this.camera.nearClip = 1;
        this.camera.farClip = 1000;
        this.camera.fov = toRadian(90);
        this.camera.priority = 0;
        this.camera.resize(this.resolution, this.resolution);

        this.camera.visibility = this._visibility;
        this.camera.clearFlag = this._clearFlag;
        this.camera.clearColor = this._backgroundColor;

        this.cameraNode.worldPosition = this.node.worldPosition;
        this.cameraNode.worldRotation = this.node.worldRotation;
        this.camera.update(true);
    }

    /**
     * @en Create RGBA16F intermediate textures and framebuffers using GFX API directly.
     * @zh 直接使用 GFX API 创建 RGBA16F 中间纹理和 Framebuffer。
     */
    private initIntermediateTextures (width: number, height: number, count: number): void {
        this._destroyIntermediateTextures();

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

        this._intermediateDepthStencil = device.createTexture(new TextureInfo(
            TextureType.TEX2D,
            TextureUsageBit.DEPTH_STENCIL_ATTACHMENT,
            Format.DEPTH_STENCIL,
            width,
            height,
        )) as Texture;

        for (let i = 0; i < count; i++) {
            const colorTex: Texture = device.createTexture(new TextureInfo(
                TextureType.TEX2D,
                TextureUsageBit.COLOR_ATTACHMENT | TextureUsageBit.SAMPLED,
                Format.RGBA16F,
                width,
                height,
            )) as Texture;
            this._intermediateTextures.push(colorTex);

            const fb: Framebuffer = device.createFramebuffer(new FramebufferInfo(
                this._intermediateRenderPass,
                [colorTex],
                this._intermediateDepthStencil,
            ));
            this.intermediateFramebuffers.push(fb);
        }
    }

    private _destroyIntermediateTextures (): void {
        for (let i = 0; i < this.intermediateFramebuffers.length; i++) {
            this.intermediateFramebuffers[i].destroy();
        }
        this.intermediateFramebuffers.length = 0;

        for (let i = 0; i < this._intermediateTextures.length; i++) {
            this._intermediateTextures[i].destroy();
        }
        this._intermediateTextures.length = 0;

        if (this._intermediateDepthStencil) {
            this._intermediateDepthStencil.destroy();
            this._intermediateDepthStencil = null;
        }

        if (this._intermediateRenderPass) {
            this._intermediateRenderPass.destroy();
            this._intermediateRenderPass = null;
        }
    }

    private _createTargetTexture (width: number, height: number): RenderTexture {
        const rt = new RenderTexture();
        rt.reset({ width, height });
        return rt;
    }

    private _transformReflectionCamera (sourceCamera: Camera, targetCamera: Camera = this.camera): void {
        const offset = Vec3.dot(this.node.worldPosition, this.node.up);
        this._reflect(this._cameraWorldPos, sourceCamera.node.worldPosition, this.node.up, offset);
        targetCamera.node.worldPosition = this._cameraWorldPos;

        Vec3.transformQuat(this._forward, Vec3.FORWARD, sourceCamera.node.worldRotation);
        this._reflect(this._forward, this._forward, this.node.up, 0);
        this._forward.normalize();
        this._forward.negative();

        Vec3.transformQuat(this._up, Vec3.UP, sourceCamera.node.worldRotation);
        this._reflect(this._up, this._up, this.node.up, 0);
        this._up.normalize();

        Quat.fromViewUp(this._cameraWorldRotation, this._forward, this._up);

        targetCamera.node.worldRotation = this._cameraWorldRotation;

        targetCamera.update(true);

        // Transform the plane from world space to reflection camera space use the inverse transpose matrix
        const viewSpaceProbe = new Vec4(this.node.up.x, this.node.up.y, this.node.up.z, -Vec3.dot(this.node.up, this.node.worldPosition));
        viewSpaceProbe.transformMat4(targetCamera.matView.clone().invert().transpose());
        targetCamera.calculateObliqueMat(viewSpaceProbe);
    }

    private _reflect (out: Vec3, point: Vec3, normal: Vec3, offset: number): Vec3 {
        const n = Vec3.clone(normal);
        n.normalize();
        const dist = Vec3.dot(n, point) - offset;
        n.multiplyScalar(2.0 * dist);
        Vec3.subtract(out, point, n);
        return out;
    }
}

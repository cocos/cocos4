/*
 Copyright (c) 2008-2010 Ricardo Quesada
 Copyright (c) 2011-2012 cocos2d-x.org
 Copyright (c) 2013-2016 Chukong Technologies Inc.
 Copyright (c) 2017-2023 Xiamen Yaji Software Co., Ltd.

 http://www.cocos2d-x.org

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
import { EDITOR, NODEJS, TEST, BUILD } from 'internal:constants';
import { Rect, Size, Vec2, Vec3, Vec4, cclegacy, errorID, warnID, js, v3, mat4, rect, v4, v2, size, isValid, warn } from '../../core';
import { Asset } from '../../asset/assets/asset';
import { TextureBase } from '../../asset/assets/texture-base';
import { GFX_TEXTURE_CHANGED } from '../../asset/assets/asset-enum';
import { ImageAsset, ImageSource } from '../../asset/assets/image-asset';
import { Texture2D } from '../../asset/assets/texture-2d';
import { dynamicAtlasManager } from '../utils/dynamic-atlas/atlas-manager';
import type { Atlas } from '../utils/dynamic-atlas/atlas';
import { Mesh } from '../../3d/assets/mesh';
import { createMesh } from '../../3d/misc';
import { Attribute, AttributeName, Format, PrimitiveMode, Sampler, SamplerInfo, Texture } from '../../gfx';
import { ccwindow } from '../../core/global-exports';

const INSET_LEFT = 0;
const INSET_TOP = 1;
const INSET_RIGHT = 2;
const INSET_BOTTOM = 3;
const temp_vec3 = v3();
const temp_matrix = mat4();

const vec3TransformMat4 = Vec3.transformMat4;
const vec3ToArray = Vec3.toArray;

function releaseCachedMesh (mesh: Mesh | null, texture?: TextureBase): void {
    if (mesh) {
        mesh.decRef(false);
        if (mesh.refCount === 0) {
            mesh.destroy();
        }
    }
    texture?.decRef(false);
}

enum MeshType {
    RECT = 0,
    POLYGON = 1, // Todo: Polygon mode need add
}

/**
 * @deprecated since v3.7.0, this is an engine private interface that will be removed in the future.
 */
export interface IUV {
    u: number;
    v: number;
}

interface IVertices {
    rawPosition: Vec3[]; // Original position of the vertex, pixel value
    positions: number[]; // The position of the vertex after being affected by the attribute
    indexes: number[]; // IB
    uv: number[]; // Pixel uv value
    nuv: number[]; // Normalized uv value
    minPos: Vec3;
    maxPos: Vec3;
}

interface IVerticesSerialize { // hack for format
    rawPosition: number[];
    indexes: number[];
    uv: number[];
    nuv: number[];
    minPos: Vec3;
    maxPos: Vec3;
}

interface ISpriteFramesSerializeData {
    name: string;
    base: string;
    image: string;
    atlas: string | undefined;
    rect: Rect;
    offset: Vec2;
    originalSize: Size;
    rotated: boolean;
    capInsets: number[];
    vertices: IVerticesSerialize;
    texture: string;
    packable: boolean;
    pixelsToUnit: number;
    pivot: Vec2;
    meshType: MeshType;
}

interface ISpriteFrameOriginal {
    spriteframe: SpriteFrame;
    x: number;
    y: number;
}

/**
 * @en Information object interface for initialize a [[SpriteFrame]] asset.
 * @zh 用于初始化 [[SpriteFrame]] 资源的对象接口描述。
 */
export interface ISpriteFrameInitInfo {
    /**
     * @en The texture of the sprite frame, could be `TextureBase`.
     * @zh 贴图对象资源，可以是 `TextureBase` 类型。
     */
    texture?: TextureBase;
    /**
     * @en The original size of the sprite frame.
     * @zh 精灵帧原始尺寸。
     */
    originalSize?: Size;
    /**
     * @en The rect of the sprite frame in atlas texture.
     * @zh 精灵帧裁切矩形。
     */
    rect?: Rect;
    /**
     * @en The offset of the sprite frame center from the original center of the original rect.
     * Sprite frame in an atlas texture could be trimmed for clipping the transparent pixels, so the trimmed rect is smaller than the original one,
     * the offset defines the distance from the original center to the trimmed center.
     * @zh 精灵帧偏移量。
     * 在图集中的精灵帧可能会被剔除透明像素以获得更高的空间利用李，剔除后的矩形尺寸比剪裁前更小，偏移量指的是从原始矩形的中心到剪裁后的矩形中心的距离。
     */
    offset?: Vec2;
    /**
     * @en Top side border for sliced 9 frame.
     * @zh 九宫格精灵帧的上边界。
     * @default 0
     */
    borderTop?: number;
    /**
     * @en Bottom side border for sliced 9 frame.
     * @zh 九宫格精灵帧的下边界。
     * @default 0
     */
    borderBottom?: number;
    /**
     * @en Left side border for sliced 9 frame.
     * @zh 九宫格精灵帧的左边界。
     * @default 0
     */
    borderLeft?: number;
    /**
     * @en Right side border for sliced 9 frame.
     * @zh 九宫格精灵帧的右边界。
     * @default 0
     */
    borderRight?: number;
    /**
     * @en Whether the content of sprite frame is rotated.
     * @zh 是否旋转。
     */
    isRotate?: boolean;
    /**
     * @en Whether the uv is flipped.
     * @zh 是否转置 UV。
     */
    isFlipUv?: boolean;
}

const temp_uvs: IUV[] = [{ u: 0, v: 0 }, { u: 0, v: 0 }, { u: 0, v: 0 }, { u: 0, v: 0 }];
// Scratch space for checking a cached mesh; never retained or exposed to a consumer.
const comparisonUVs: number[] = [];

function sameUVs (a: readonly number[], b: readonly number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

interface WorldGeometryInputs {
    width: number;
    height: number;
    pixelsToUnit: number;
    pivotX: number;
    pivotY: number;
    uvs: number[];
}

export enum SpriteFrameEvent {
    UV_UPDATED = 'uv_updated',
    /** @engineInternal The cached world mesh is invalid; consumers must rebind before the old mesh is released. */
    MESH_CHANGED = 'mesh_changed',
    /** @engineInternal The source view or sampler changed without changing geometry. */
    TEXTURE_CHANGED = 'world_texture_changed',
    BORDER_CHANGED = 'border_changed',
    /** @engineInternal Stop submitting and release world mesh references. */
    MESH_DESTROYED = 'mesh_destroyed',
}

/**
 * @en
 * A `SpriteFrame` support several types.
 *  1. Rectangle sprite frame
 *  2. Sliced 9 sprite frame
 *  3. Mesh sprite frame
 * It mainly contains:<br/>
 *  - texture: A `TextureBase` that will be used by render process.<br/>
 *  - rectangle: A rectangle of the texture.
 *  - Sliced 9 border insets: The distance of each side from the internal rect to the sprite frame rect.
 *  - vertices: Vertex list for the mesh type sprite frame.
 *  - uv: The quad uv.
 *  - uvSliced: The sliced 9 uv.
 *
 * @zh
 * 精灵帧资源。
 * 一个 SpriteFrame 支持多种类型
 *  1. 矩形精灵帧
 *  2. 九宫格精灵帧
 *  3. 网格精灵帧
 * 它主要包含下列数据：<br/>
 *  - 纹理：会被渲染流程使用的 `TextureBase` 资源。<br/>
 *  - 矩形：在纹理中的矩形区域。
 *  - 九宫格信息：九宫格的内部矩形四个边距离 SpriteFrame 外部矩形的距离。
 *  - 网格信息：网格类型精灵帧的所有顶点列表。
 *  - uv: 四边形 UV。
 *  - uvSliced: 九宫格 UV。
 * 可通过 `SpriteFrame` 获取该组件。
 *
 * @example
 * ```ts
 * import { resources } from 'cc';
 * // First way to use a SpriteFrame
 * const url = "assets/PurpleMonster/icon/spriteFrame";
 * resources.load(url, (err, spriteFrame) => {
 *   const node = new Node("New Sprite");
 *   const sprite = node.addComponent(Sprite);
 *   sprite.spriteFrame = spriteFrame;
 *   node.parent = self.node;
 * });
 *
 * // Second way to use a SpriteFrame
 * const self = this;
 * const url = "test_assets/PurpleMonster";
 * resources.load(url, (err, imageAsset) => {
 *  if(err){
 *    return;
 *  }
 *
 *  const node = new Node("New Sprite");
 *  const sprite = node.addComponent(Sprite);
 *  const spriteFrame = new SpriteFrame();
 *  const tex = imageAsset._texture;
 *  spriteFrame.texture = tex;
 *  sprite.spriteFrame = spriteFrame;
 *  node.parent = self.node;
 * });
 *
 * // Third way to use a SpriteFrame
 * const self = this;
 * const cameraComp = this.getComponent(Camera);
 * const renderTexture = new RenderTexture();
 * renderTexture.reset({
 *   width: 512,
 *   height: 512,
 *   depthStencilFormat: RenderTexture.DepthStencilFormat.DEPTH_24_STENCIL_8
 * });
 *
 * cameraComp.targetTexture = renderTexture;
 * const spriteFrame = new SpriteFrame();
 * spriteFrame.texture = renderTexture;
 * ```
 */
@ccclass('cc.SpriteFrame')
export class SpriteFrame extends Asset {
    /**
     * @en Create a SpriteFrame object by an image asset or an native image asset.
     * @zh 通过 Image 资源或者平台相关 Image 对象创建一个 SpriteFrame 资源。
     * @param imageSourceOrImageAsset @en ImageAsset or ImageSource, ImageSource could be HTMLCanvasElement, HTMLImageElement, IMemoryImageSource.
     *                                @zh 图像资源或图像原始图像源，图像原始图像源支持 HTMLCanvasElement HTMLImageElement IMemoryImageSource 三种资源。
     * @returns @en SpriteFrame asset. @zh 精灵资源。
     */
    public static createWithImage (imageSourceOrImageAsset: ImageSource | ImageAsset): SpriteFrame {
        const img = imageSourceOrImageAsset instanceof ImageAsset ? imageSourceOrImageAsset : new ImageAsset(imageSourceOrImageAsset);
        const tex = new Texture2D();
        tex.image = img;
        const spf = new SpriteFrame();
        spf.texture = tex;
        return spf;
    }

    /**
     * @en uv update event.
     * @zh uv 更新事件。
     */
    public static EVENT_UV_UPDATED = SpriteFrameEvent.UV_UPDATED;
    public static MeshType = MeshType;

    /**
     * @en Top border distance of sliced 9 rect.
     * @zh 九宫格内部矩形顶部边框距离 SpriteFrame 矩形的距离。
     */
    get insetTop (): number {
        return this._capInsets[INSET_TOP];
    }

    set insetTop (value) {
        if (this._setInset(INSET_TOP, value)) this._onBorderChange();
    }

    /**
     * @en Bottom border distance of sliced 9 rect.
     * @zh 九宫格内部矩形底部边框距离 SpriteFrame 矩形的距离。
     */
    get insetBottom (): number {
        return this._capInsets[INSET_BOTTOM];
    }

    set insetBottom (value) {
        if (this._setInset(INSET_BOTTOM, value)) this._onBorderChange();
    }

    /**
     * @en Left border distance of sliced 9 rect.
     * @zh 九宫格内部矩形左边框距离 SpriteFrame 矩形的距离。
     */
    get insetLeft (): number {
        return this._capInsets[INSET_LEFT];
    }

    set insetLeft (value) {
        if (this._setInset(INSET_LEFT, value)) this._onBorderChange();
    }

    /**
     * @en Right border distance of sliced 9 rect.
     * @zh 九宫格内部矩形右边框距离 SpriteFrame 矩形的距离。
     */
    get insetRight (): number {
        return this._capInsets[INSET_RIGHT];
    }

    set insetRight (value) {
        if (this._setInset(INSET_RIGHT, value)) this._onBorderChange();
    }

    private _setInset (side: number, value: number | undefined): boolean {
        if (value === undefined || this._capInsets[side] === value) return false;
        this._capInsets[side] = value;
        return true;
    }

    /**
     * @en Returns the rect of the sprite frame in the texture.
     * If it's an atlas texture, a transparent pixel area is proposed for the actual mapping of the current texture.
     * @zh 获取 SpriteFrame 的纹理矩形区域。
     * 如果是一个 atlas 的贴图，则为当前贴图的实际剔除透明像素区域。
     */
    get rect (): Rect {
        return this._rect;
    }

    set rect (value) {
        // Assigning the current placeholder (even 1x1) makes the rect explicit.
        this._cancelPendingFullRect();
        if (this._rect.equals(value)) {
            return;
        }

        if (this._original) {
            // Public rect coordinates remain relative to the current (possibly dynamic) texture.
            this._original._x += value.x - this._rect.x;
            this._original._y += value.y - this._rect.y;
        }
        this._rect.set(value);
        this._calcTrimmedBorder();
        if (this._texture) {
            this._calculateUV();
        }
    }

    /**
     * @en The original size before trimmed.
     * @zh 修剪前的原始大小。
     */
    get originalSize (): Size {
        return this._originalSize;
    }

    set originalSize (value) {
        if (this._pendingFullRect) this._pendingFullRect.useTextureOriginalSize = false;
        if (this._originalSize.equals(value)) {
            return;
        }

        this._originalSize.set(value);
        this._calcTrimmedBorder();
        if (this._texture) {
            this.emit(SpriteFrameEvent.UV_UPDATED, this);
        }
    }

    /**
     * @en The offset of the sprite frame center.
     * Sprite frame in an atlas texture could be trimmed for clipping the transparent pixels, so the trimmed rect is smaller than the original one,
     * the offset defines the distance from the original center to the trimmed center.
     * @zh 精灵帧偏移量。
     * 在图集中的精灵帧可能会被剔除透明像素以获得更高的空间利用李，剔除后的矩形尺寸比剪裁前更小，偏移量指的是从原始矩形的中心到剪裁后的矩形中心的距离。
     */
    get offset (): Vec2 {
        return this._offset;
    }

    set offset (value) {
        this._offset.set(value);
        this._calcTrimmedBorder();
    }

    /**
     * @en Whether the content of sprite frame is rotated.
     * @zh 是否旋转。
     */
    get rotated (): boolean {
        return this._rotated;
    }

    set rotated (rotated) {
        if (this._rotated === rotated) {
            return;
        }

        this._rotated = rotated;
        if (this._texture) {
            this._calculateUV();
        }
    }

    /**
     * @en The texture of the sprite frame, could be `TextureBase`.
     * @zh 贴图对象资源，可以是 `TextureBase` 类型。
     */
    get texture (): TextureBase {
        return this._texture;
    }

    set texture (value) {
        if (!value) {
            warnID(3122, this.name);
            return;
        }

        if (value === this._texture) {
            return;
        }

        this.reset({ texture: value }, true);
    }

    /**
     * @en The uuid of the atlas asset, if exists.
     * @zh 图集资源的 uuid。
     */
    get atlasUuid (): string {
        return this._atlasUuid;
    }

    set atlasUuid (value: string) {
        this._atlasUuid = value;
    }

    /**
     * @en The pixel width of the sprite frame.
     * @zh 精灵帧的像素宽度。
     */
    get width (): number {
        return this._texture.width;
    }

    /**
     * @en The pixel height of the sprite frame.
     * @zh 精灵帧的像素高度。
     */
    get height (): number {
        return this._texture.height;
    }

    /**
     * @deprecated since v3.7.0, this is an engine private interface that will be removed in the future.
     */
    set _textureSource (value: TextureBase) {
        if (value !== this._texture) this._cancelPendingFullRect();
        // Optimization for build
        if (globalThis.Build) {
            this._texture = value;
            return;
        }
        if (value) {
            const retired = this._detachFromDynamicAtlas(value);
            try {
                this._refreshTexture(value);
                this._calcTrimmedBorder();
                this._calculateUV();
            } finally {
                retired?.forEach((page) => page.destroy());
            }
        }
    }

    /**
     * @en Whether flip the uv in X direction.
     * @zh 沿 X 轴方向, 翻转 UV。
     */
    get flipUVX (): boolean {
        return this._isFlipUVX;
    }

    set flipUVX (value) {
        if (this._isFlipUVX === value) return;
        this._isFlipUVX = value;
        this._calculateUV();
    }

    /**
     * @en Whether flip the uv in Y direction.
     * @zh 沿 Y 轴方向, 翻转 UV。
     */
    get flipUVY (): boolean {
        return this._isFlipUVY;
    }

    set flipUVY (value) {
        if (this._isFlipUVY === value) return;
        this._isFlipUVY = value;
        this._calculateUV();
    }

    /**
     * @en Sets whether sprite can be packed into dynamic atlas.
     * @zh 设置精灵是否允许参与自动合图。
     */
    get packable (): boolean {
        return this._packable;
    }
    set packable (value: boolean) {
        this._packable = value;
    }

    /**
     * @en Original information before packed to dynamic atlas, includes texture, width, height. It's null before being packed to dynamic atlas.
     * @zh 精灵自动合图之前的原始 texture 和宽高信息。在参与自动合图之前此值为 null。
     */
    get original (): {
        _texture: TextureBase;
        _x: number;
        _y: number;
    } | null {
        return this._original;
    }

    /**
     * @en Number of pixels corresponding to unit size in world space (pixels per unit).
     * @zh 世界空间中的单位大小对应的像素数量（像素每单位）。
     */
    get pixelsToUnit (): number {
        return this._pixelsToUnit;
    }

    /**
     * @en Local origin position when generating the mesh.
     * @zh 生成 mesh 时本地坐标原点位置。
     */
    get pivot (): Vec2 {
        return this._pivot;
    }

    /**
     * @en mesh information, you should call the [[ensureMeshData]] function before using it.
     * Call addRef() to keep the mesh across frame changes or renderer detachment, and decRef() when finished.
     * @zh mesh 信息，你应该在使用它之前调用 [[ensureMeshData]] 函数来确保其可用。
     * 如需在帧变更或渲染组件解绑后继续使用该 Mesh，请先调用 addRef()，使用完后调用 decRef()。
     */
    get mesh (): Mesh | null {
        return this._mesh;
    }

    /**
     * @deprecated since v3.7.0, this is an engine private interface that will be removed in the future.
     */
    get trimmedBorder (): Vec4 {
        return this._trimmedBorder;
    }

    /**
     * @en Vertex list for the mesh type sprite frame.
     * @zh 网格类型精灵帧的所有顶点列表。
     */
    public vertices: IVertices | null = null;

    /**
     * @en UV for quad vertices.
     * @zh 矩形的顶点 UV。
     */
    public uv: number[] = [];

    /**
     * @deprecated since v3.7.0, this is an engine private interface that will be removed in the future.
     */
    public unbiasUV: number[] = [];

    /**
     * @en UV for sliced 9 vertices.
     * @zh 九宫格的顶点 UV。
     */
    public uvSliced: IUV[] = [];

    // the location of the sprite on rendering texture
    protected _rect = rect();

    protected _trimmedBorder = v4();

    // for trimming
    protected _offset = v2();

    // for trimming
    protected _originalSize = size();

    protected _rotated = false;

    protected _capInsets = [0, 0, 0, 0];

    protected _atlasUuid = '';
    // TODO: not initialized in constructor
    protected _texture!: TextureBase;

    protected _isFlipUVY = false;

    protected _isFlipUVX = false;

    // store original info before packed to dynamic atlas
    protected _original: {
        _texture: TextureBase,
        _x: number,
        _y: number,
    } | null = null;

    protected _packable = true;

    protected _pixelsToUnit = 100;

    protected _pivot = v2(0.5, 0.5); // center

    // Todo: Some features need add
    protected _meshType = MeshType.RECT;
    protected _extrude = 0; // when polygon type use
    protected _customOutLine = [];// MayBe later
    // Here you can generate polygons by polygon-separator, expecting the generated polygons to be pixel-standard vertex arrays,
    // and save this array in the file
    // that is, the mesh information of the original image
    // (two-dimensional mesh information, which needs to be serialized and is the basis for the polygon mesh generation)
    // In addition to the vertex array, a mesh should be generated based on the conditions
    // i.e., the mesh information generated by combining the above five conditions, which needs to be serialized
    // and at runtime, the actual mesh used is the generated mesh (static mesh)
    // (updated after attribute value changes in the editor, adjusting vertices/re-generation)

    // Mesh api
    protected _mesh: Mesh | null = null;
    // No per-frame bookkeeping is allocated until a world renderer actually uses this frame.
    private declare _meshUsers?: number;
    private declare _meshTexture?: TextureBase;
    // Only authored corners need a snapshot: UI packing rewrites the public arrays in page coordinates.
    private declare _relocatedSourceUV?: number[];
    private declare _worldGeometryInputs?: WorldGeometryInputs;
    private declare _observedTexture?: TextureBase;
    private declare _observedWidth?: number;
    private declare _observedHeight?: number;
    // Allocated only for a runtime texture assignment whose default rect cannot be resolved yet.
    private declare _pendingFullRect?: { width: number; height: number; useTextureOriginalSize: boolean };
    protected _minPos = v3();
    protected _maxPos = v3();

    constructor (name?: string) {
        super(name);

        if (EDITOR || NODEJS) {
            // Atlas asset uuid
            this._atlasUuid = '';
        }
    }

    /**
     * @en
     * Returns whether the texture have been loaded.
     * @zh
     * 返回是否已加载精灵帧。
     *
     * @deprecated since v3.3, Useless Code.
     */
    public textureLoaded (): boolean {
        return !!this.texture;
    }

    /**
     * @en
     * Returns whether the sprite frame is rotated in the texture.
     * @zh
     * 获取 SpriteFrame 是否旋转。
     * @deprecated since v1.2, please use [[rotated]] instead.
     */
    public isRotated (): boolean {
        return this._rotated;
    }

    /**
     * @en
     * Set whether the sprite frame is rotated in the texture.
     * @zh
     * 设置 SpriteFrame 是否旋转。
     * @param rotated @en rotated.  @zh 是否旋转。
     * @deprecated since v1.2, please use [[rotated]] instead.
     */
    public setRotated (rotated: boolean): void {
        this.rotated = rotated;
    }

    /**
     * @en Returns the rect of the sprite frame in the texture.
     * If it's an atlas texture, a transparent pixel area is proposed for the actual mapping of the current texture.
     * @zh 获取 SpriteFrame 的纹理矩形区域。
     * 如果是一个 atlas 的贴图，则为当前贴图的实际剔除透明像素区域。
     * @param out @en The output rect. @zh 输出的矩形区域。
     * @returns @en The rect. @zh 矩形区域。
     * @deprecated since v1.2, please use [[rect]].
     */
    public getRect (out?: Rect): Rect {
        if (out) {
            out.set(this._rect);
            return out;
        }

        return this._rect.clone();
    }

    /**
     * @en Sets the rect of the sprite frame in the texture.
     * @zh 设置 SpriteFrame 的纹理矩形区域。
     * @param rect @en The new rect. @zh 想要设置的 rect。
     * @deprecated since v1.2, please use [[rect]].
     */
    public setRect (rect: Rect): void {
        this.rect = rect;
    }

    /**
     * @en Returns the original size before trimmed.
     * @zh 获取修剪前的原始大小。
     * @param out @en The output original size. @zh 输出的原始大小。
     * @returns @en The original size. @zh 原始大小。
     * @deprecated since v1.2, please use [[originalSize]].
     */
    public getOriginalSize (out?: Size): Size {
        if (out) {
            out.set(this._originalSize);
            return out;
        }

        return this._originalSize.clone();
    }

    /**
     * @en Sets the original size before trimmed.
     * @zh 设置修剪前的原始大小。
     * @param size @en The new original size. @zh 新设置的原始大小。
     * @deprecated since v1.2, please use [[originalSize]].
     */
    public setOriginalSize (size: Size): void {
        this.originalSize = size;
    }

    /**
     * @en Gets the offset of the frame.
     * @zh 获取偏移量。
     * @param out @en The output offset object. @zh 输出的偏移量。
     * @returns @en The offset object. @zh 偏移量。
     * @deprecated since v1.2, please use [[offset]]
     */
    public getOffset (out?: Vec2): Vec2 {
        if (out) {
            out.set(this._offset);
            return out;
        }

        return this._offset.clone();
    }

    /**
     * @en Sets the offset of the frame.
     * @zh 设置偏移量。
     * @param offset @en The new offset. @zh 新设置的偏移量。
     * @deprecated since v1.2, please use [[offset]]
     */
    public setOffset (offset: Vec2): void {
        this.offset = offset;
    }

    /**
     * @en Gets the related GFX [[gfx.Texture]] resource.
     * @zh 获取渲染贴图的 GFX 资源。
     * @returns @en Gfx Texture resource. @zh GFX 贴图资源。
     */
    public getGFXTexture (): Texture | null {
        return this._texture.getGFXTexture();
    }

    /**
     * @en Gets the GFX sampler of its texture.
     * @zh 贴图资源的采样器。
     * @returns @en The GFX sampler resource. @zh GFX贴图采样器。
     */
    public getGFXSampler (): Sampler {
        return this._texture.getGFXSampler();
    }

    /**
     * @en Gets the hash of its texture.
     * @zh 贴图资源的哈希值。
     * @returns @en Texture`s hash. @zh 贴图哈希值。
     */
    public getHash (): number {
        return this._texture.getHash();
    }

    /**
     * @en Gets the sampler hash of its texture.
     * @zh 贴图资源的采样器哈希值。
     * @returns @en Sampler`s hash. @zh 采样器哈希值。
     */
    public getSamplerInfo (): Readonly<SamplerInfo> {
        return this._texture.getSamplerInfo();
    }

    /**
     * @en Resets the sprite frame data.
     * @zh 重置 SpriteFrame 数据。
     * @param info @en SpriteFrame initialization information. @zh SpriteFrame 初始化信息。
     * @param clearData @en Clear Data before initialization. @zh 是否在初始化前清空原有数据。
     */
    public reset (info?: ISpriteFrameInitInfo, clearData = false): void {
        const previousTexture = this._texture;
        const retired = clearData || info?.texture ? this._detachFromDynamicAtlas(info?.texture) : null;
        try {
            this._resetFrameData(info, clearData, previousTexture);
        } finally {
            // Page teardown can call user code. Its old registration has already been removed.
            retired?.forEach((page) => page.destroy());
        }
    }

    private _resetFrameData (info: ISpriteFrameInitInfo | undefined, clearData: boolean, previousTexture: TextureBase): void {
        const self = this;
        const pending = self._pendingFullRect;
        if (pending) {
            if (clearData || info?.texture || info?.rect) self._cancelPendingFullRect();
            else if (info?.originalSize) pending.useTextureOriginalSize = false;
        }
        const keepsPackedTexture = !!self._original && info?.texture === self._texture;
        const previousX = self._rect.x;
        const previousY = self._rect.y;
        const previousWidth = self._rect.width;
        const previousHeight = self._rect.height;
        const previousRotation = self._rotated;
        const previousFlip = self._isFlipUVY;
        let borderChanged = false;
        if (clearData) {
            self._originalSize.set(0, 0);
            self._rect.set(0, 0, 0, 0);
            self._offset.set(0, 0);
            self._capInsets = [0, 0, 0, 0];
            self._rotated = false;
        }

        if (info) {
            if (info.texture) {
                const useTextureOriginalSize = !info.originalSize && (pending && !clearData
                    ? pending.useTextureOriginalSize && self._originalSize.width === pending.width && self._originalSize.height === pending.height
                    : !self._originalSize.width || !self._originalSize.height);
                self._rect.set(0, 0, info.texture.width, info.texture.height);
                self._refreshTexture(info.texture);
                self.checkRect(self._texture);
                if (!info.rect && !self._original && !info.texture.getGFXTexture() && isValid(info.texture, true)) {
                    self._pendingFullRect = {
                        width: self._rect.width,
                        height: self._rect.height,
                        useTextureOriginalSize,
                    };
                    self._syncTextureObserver();
                }
            }

            if (info.originalSize) {
                self._originalSize.set(info.originalSize);
            }

            if (info.rect) {
                if (self._original) {
                    // reset may have changed _rect while reusing the packed texture.
                    self._original._x += info.rect.x - (keepsPackedTexture ? previousX : self._rect.x);
                    self._original._y += info.rect.y - (keepsPackedTexture ? previousY : self._rect.y);
                }
                self._rect.set(info.rect);
            }

            if (info.offset) {
                self._offset.set(info.offset);
            }

            const topChanged = self._setInset(INSET_TOP, info.borderTop);
            const bottomChanged = self._setInset(INSET_BOTTOM, info.borderBottom);
            const leftChanged = self._setInset(INSET_LEFT, info.borderLeft);
            const rightChanged = self._setInset(INSET_RIGHT, info.borderRight);
            borderChanged = topChanged || bottomChanged || leftChanged || rightChanged;

            if (info.isRotate !== undefined) {
                self._rotated = !!info.isRotate;
            }

            if (info.isFlipUv !== undefined) {
                self._isFlipUVY = !!info.isFlipUv;
            }
        }

        self._calcTrimmedBorder();
        if (info || clearData) {
            const mappingChanged = clearData || self._texture !== previousTexture || self._rect.x !== previousX || self._rect.y !== previousY
                || self._rect.width !== previousWidth || self._rect.height !== previousHeight
                || self._rotated !== previousRotation || self._isFlipUVY !== previousFlip;
            // A caller can mutate the public Rect and then pass the same object back to reset.
            const refreshMapping = mappingChanged || (!!self._texture && !!(info?.rect || info?.texture) && !self._matchesPublishedRectUVs());
            if (refreshMapping && self._texture) self._calculateUV();
            else if (borderChanged) self._onBorderChange();
            else if (self._texture) self.emit(SpriteFrameEvent.UV_UPDATED, self);
        }
    }

    /**
     * @en Check whether the rect of the sprite frame is out of the texture boundary.
     * @zh 判断精灵计算的矩形区域是否越界。
     * @param texture @en Texture resources for sprite frame. @zh SpriteFrame 的贴图资源。
     * @returns @en Out of the texture boundary or not. @zh 矩形区域是否越界。
     */
    public checkRect (texture: TextureBase): boolean {
        const rect = this._rect;
        let maxX = rect.x;
        let maxY = rect.y;
        if (this._rotated) {
            maxX += rect.height;
            maxY += rect.width;
        } else {
            maxX += rect.width;
            maxY += rect.height;
        }

        if (maxX > texture.width) {
            errorID(3300, `${this.name}/${texture.name}`, maxX, texture.width);
            return false;
        }

        if (maxY > texture.height) {
            errorID(3301, `${this.name}/${texture.name}`, maxY, texture.height);
            return false;
        }

        return true;
    }

    private _calcTrimmedBorder (): void {
        const self = this;
        const ow = self._originalSize.width;
        const oh = self._originalSize.height;
        const rw = self._rect.width;
        const rh = self._rect.height;
        const halfTrimmedWidth = (ow - rw) * 0.5;
        const halfTrimmedHeight = (oh - rh) * 0.5;
        const thisOffset = self._offset;
        const thisTrimmedBorder = self._trimmedBorder;
        // left
        thisTrimmedBorder.x = thisOffset.x + halfTrimmedWidth;
        // right
        thisTrimmedBorder.y = thisOffset.x - halfTrimmedWidth;
        // bottom
        thisTrimmedBorder.z = thisOffset.y + halfTrimmedHeight;
        // top
        thisTrimmedBorder.w = thisOffset.y - halfTrimmedHeight;
    }

    /**
     * @en Make sure the mesh is available, you should call it before using the mesh.
     * @zh 确保 mesh 可用，你应该在使用 mesh 之前调用它。
     */
    public ensureMeshData (): void {
        if (!isValid(this, true) || !this._texture) return;
        const hadUsers = !!this._meshUsers;
        this._validateWorldGeometry();
        if (hadUsers && !this._meshUsers) return;
        if (!this._mesh && isValid(this, true)) this._createMesh();
    }

    /** @engineInternal Check inputs that scripts can edit without calling a setter, before geometry is reused. */
    public _validateWorldGeometry (): void {
        const built = this._worldGeometryInputs;
        if (!built || !isValid(this._getSourceTexture(), true)) return;
        if (this._isRectMesh() && built.width === this._rect.width && built.height === this._rect.height
            && built.pixelsToUnit === this._pixelsToUnit && built.pivotX === this._pivot.x && built.pivotY === this._pivot.y) {
            const uvs = this._getSourceUVs(comparisonUVs);
            if (sameUVs(uvs, built.uvs)) return;
        }
        this._updateMesh();
    }

    /** @engineInternal Share one input snapshot between consumers of a frame. UI-only frames never allocate it. */
    public _recordWorldGeometry (uvs?: number[]): void {
        if (!this._worldGeometryInputs) {
            this._worldGeometryInputs = {
                width: this._rect.width,
                height: this._rect.height,
                pixelsToUnit: this._pixelsToUnit,
                pivotX: this._pivot.x,
                pivotY: this._pivot.y,
                uvs: uvs ?? this._getSourceUVs(),
            };
        }
    }

    /** @engineInternal Source texture before UI dynamic packing; may itself be a static atlas. */
    public _getSourceTexture (): TextureBase {
        return this._original ? this._original._texture : this._texture;
    }

    /** @engineInternal Whether rectangular world geometry is supported. */
    public _isRectMesh (): boolean {
        return this._meshType === MeshType.RECT;
    }

    /** @engineInternal Source corner UVs with the Sprite Effect V inversion; no cached UI data. */
    public _getSourceUVs (out: number[] = []): number[] {
        if (this._hasAuthoredUVs()) return this._decodePublicUVs(out);
        if (this._relocatedSourceUV) {
            out.length = this._relocatedSourceUV.length;
            for (let i = 0; i < out.length; ++i) out[i] = this._relocatedSourceUV[i];
            return out;
        }
        const original = this._original;
        out.length = 8;
        this._writeRectUVs(out, this._getSourceTexture(), original?._x ?? this._rect.x, original?._y ?? this._rect.y);
        for (let i = 1; i < 8; i += 2) out[i] = 1 - out[i];
        return out;
    }

    private _hasAuthoredUVs (): boolean {
        return !sameUVs(this.uv, this.unbiasUV);
    }

    private _matchesPublishedRectUVs (): boolean {
        comparisonUVs.length = 8;
        this._writeRectUVs(comparisonUVs, this._texture, this._rect.x, this._rect.y);
        return sameUVs(comparisonUVs, this.unbiasUV);
    }

    private _decodePublicUVs (out: number[] = []): number[] {
        const original = this._original;
        out.length = this.uv.length;
        for (let i = 0; i < out.length; ++i) {
            let v = this.uv[i];
            const vertical = i % 2 !== 0;
            if (original) {
                const source = original._texture;
                v = vertical
                    ? (v * this._texture.height - (this._rect.y - original._y)) / source.height
                    : (v * this._texture.width - (this._rect.x - original._x)) / source.width;
            }
            out[i] = vertical ? 1 - v : v;
        }
        return out;
    }

    private _preserveSourceUVsBeforeRelocation (): void {
        if (this._hasAuthoredUVs()) this._relocatedSourceUV = this._decodePublicUVs();
    }

    private _writeRectUVs (uv: number[], texture: TextureBase, x: number, y: number): void {
        const { width, height } = this._rect;
        const texWidth = texture.width;
        const texHeight = texture.height;
        const left = texWidth === 0 ? 0 : x / texWidth;
        const right = texWidth === 0 ? 1 : (x + (this._rotated ? height : width)) / texWidth;
        const top = texHeight === 0 ? 0 : y / texHeight;
        const bottom = texHeight === 0 ? 1 : (y + (this._rotated ? width : height)) / texHeight;
        const l = this._isFlipUVX ? right : left;
        const r = this._isFlipUVX ? left : right;
        const t = this._isFlipUVY ? bottom : top;
        const b = this._isFlipUVY ? top : bottom;
        if (this._rotated) js.array.fillItems(uv, l, t, l, b, r, t, r, b);
        else js.array.fillItems(uv, l, b, r, b, l, t, r, t);
    }

    private _detachFromDynamicAtlas (textureToKeep?: TextureBase): Atlas[] | undefined {
        if (!this._original || textureToKeep === this._texture) return undefined;
        const retired = dynamicAtlasManager?._unlinkAtlasSpriteFrame(this);
        this._restoreAtlasSource();
        return retired;
    }

    /** @engineInternal Retain derived geometry independently of the asset's UI users. */
    public _retainMesh (): void {
        this._meshUsers = (this._meshUsers || 0) + 1;
        if (this._meshUsers === 1) this._syncTextureObserver();
    }

    private _cancelPendingFullRect (): void {
        if (!this._pendingFullRect) return;
        delete this._pendingFullRect;
        this._syncTextureObserver();
    }

    private _syncTextureObserver (): void {
        const texture = this._pendingFullRect || this._meshUsers || this._mesh ? this._getSourceTexture() : undefined;
        const source = texture && isValid(texture, true) ? texture : undefined;
        if (source === this._observedTexture) return;
        this._observedTexture?.off(GFX_TEXTURE_CHANGED, this._onSourceTextureChanged, this);
        if (source) {
            this._observedTexture = source;
            this._observedWidth = source.width;
            this._observedHeight = source.height;
            source.on(GFX_TEXTURE_CHANGED, this._onSourceTextureChanged, this);
        } else {
            delete this._observedTexture;
            delete this._observedWidth;
            delete this._observedHeight;
        }
    }

    private _onSourceTextureChanged (): void {
        const source = this._observedTexture!;
        const pending = this._pendingFullRect;
        if (pending) {
            if (!isValid(source, true)) {
                this._cancelPendingFullRect();
                return;
            }
            if (!source.getGFXTexture()) return;
            // A caller can also edit the Rect/Size objects in place while the image is loading.
            const x = this._original?._x ?? this._rect.x;
            const y = this._original?._y ?? this._rect.y;
            if (x === 0 && y === 0 && this._rect.width === pending.width && this._rect.height === pending.height) {
                this._rect.width = source.width;
                this._rect.height = source.height;
            }
            if (pending.useTextureOriginalSize && this._originalSize.width === pending.width && this._originalSize.height === pending.height) {
                this._originalSize.set(source.width, source.height);
            }
            this._observedWidth = source.width;
            this._observedHeight = source.height;
            this._cancelPendingFullRect();
            this._calcTrimmedBorder();
            this._calculateUV(true, true);
            return;
        }
        if (source.width !== this._observedWidth || source.height !== this._observedHeight) {
            this._observedWidth = source.width;
            this._observedHeight = source.height;
            this._updateMesh();
        } else if (this._meshUsers) {
            this.emit(SpriteFrameEvent.TEXTURE_CHANGED);
        }
    }

    /** @engineInternal The caller must first detach its SubModels and unsubscribe. */
    public _releaseMesh (): void {
        if (!this._meshUsers) return;
        if (--this._meshUsers === 0) {
            delete this._meshUsers;
            releaseCachedMesh(this._mesh, this._meshTexture);
            this._mesh = null;
            delete this._meshTexture;
            delete this._worldGeometryInputs;
            this._syncTextureObserver();
        }
    }

    public destroy (): boolean {
        if (!super.destroy()) return false;
        delete this._pendingFullRect;
        if (this._meshUsers) {
            this.emit(SpriteFrameEvent.MESH_DESTROYED, this);
        }
        releaseCachedMesh(this._mesh, this._meshTexture);
        this._mesh = null;
        delete this._meshUsers;
        delete this._meshTexture;
        delete this._worldGeometryInputs;
        delete this._relocatedSourceUV;
        this._syncTextureObserver();
        if (this._packable && dynamicAtlasManager) {
            dynamicAtlasManager.deleteAtlasSpriteFrame(this);
        }
        return true;
    }

    /**
     * Calculate UV for sliced
     * @deprecated since v3.5.0, this is an engine private interface that will be removed in the future.
     * @engineInternal
     * @mangle
     */
    public _calculateSlicedUV (): void {
        this._writeSlicedUVs();
        this.emit(SpriteFrameEvent.UV_UPDATED, this);
    }

    private _onBorderChange (): void {
        if (this._texture) this._writeSlicedUVs();
        if (this._meshUsers) this.emit(SpriteFrameEvent.BORDER_CHANGED, this);
        if (this._texture) this.emit(SpriteFrameEvent.UV_UPDATED, this);
    }

    private _writeSlicedUVs (): void {
        const self = this;
        const rect = self._rect;
        // const texture = self._getCalculateTarget()!;
        const tex = self.texture;
        const capInsets = self._capInsets;
        const atlasWidth = tex.width;
        const atlasHeight = tex.height;
        const leftWidth = capInsets[INSET_LEFT];
        const rightWidth = capInsets[INSET_RIGHT];
        const centerWidth = rect.width - leftWidth - rightWidth;
        const topHeight = capInsets[INSET_TOP];
        const bottomHeight = capInsets[INSET_BOTTOM];
        const centerHeight = rect.height - topHeight - bottomHeight;

        const uvSliced = self.uvSliced;
        uvSliced.length = 0;
        if (self._rotated) {
            temp_uvs[0].u = rect.x / atlasWidth;
            temp_uvs[1].u = (rect.x + bottomHeight) / atlasWidth;
            temp_uvs[2].u = (rect.x + bottomHeight + centerHeight) / atlasWidth;
            temp_uvs[3].u = (rect.x + rect.height) / atlasWidth;
            temp_uvs[3].v = rect.y / atlasHeight;
            temp_uvs[2].v = (rect.y + leftWidth) / atlasHeight;
            temp_uvs[1].v = (rect.y + leftWidth + centerWidth) / atlasHeight;
            temp_uvs[0].v = (rect.y + rect.width) / atlasHeight;

            for (let row = 0; row < 4; ++row) {
                const rowD = temp_uvs[row];
                for (let col = 0; col < 4; ++col) {
                    const colD = temp_uvs[3 - col];
                    uvSliced.push({
                        u: rowD.u,
                        v: colD.v,
                    });
                }
            }
        } else {
            temp_uvs[0].u = rect.x / atlasWidth;
            temp_uvs[1].u = (rect.x + leftWidth) / atlasWidth;
            temp_uvs[2].u = (rect.x + leftWidth + centerWidth) / atlasWidth;
            temp_uvs[3].u = (rect.x + rect.width) / atlasWidth;
            temp_uvs[3].v = rect.y / atlasHeight;
            temp_uvs[2].v = (rect.y + topHeight) / atlasHeight;
            temp_uvs[1].v = (rect.y + topHeight + centerHeight) / atlasHeight;
            temp_uvs[0].v = (rect.y + rect.height) / atlasHeight;

            for (let row = 0; row < 4; ++row) {
                const rowD = temp_uvs[row];
                for (let col = 0; col < 4; ++col) {
                    const colD = temp_uvs[col];
                    uvSliced.push({
                        u: colD.u,
                        v: rowD.v,
                    });
                }
            }
        }
    }

    /**
     * Calculate UV
     * @deprecated since v3.5.0, this is an engine private interface that will be removed in the future.
     * @engineInternal
     * @mangle
     */
    public _calculateUV (sourceChanged = true, preserveAuthoredUV = false): void {
        const self = this;
        if (sourceChanged && !preserveAuthoredUV && self._relocatedSourceUV) delete self._relocatedSourceUV;
        if (preserveAuthoredUV && self._hasAuthoredUVs()) {
            self._writeRectUVs(self.unbiasUV, self.texture, self._rect.x, self._rect.y);
        } else {
            self._writeRectUVs(self.uv, self.texture, self._rect.x, self._rect.y);
            for (let i = 0; i < 8; ++i) self.unbiasUV[i] = self.uv[i];
        }

        // UI relocation changes the public mapping, not the source used by world geometry.
        self._writeSlicedUVs();
        if (sourceChanged && (self._mesh || self._meshUsers)) {
            self._syncTextureObserver();
            self._updateMesh();
        }
        self.emit(SpriteFrameEvent.UV_UPDATED, self);
    }

    /**
     * @deprecated since v3.5.0, this is an engine private interface that will be removed in the future.
     * @engineInternal
     * @mangle
     */
    public _setDynamicAtlasFrame (frame): void {
        if (!frame) return;
        this._preserveSourceUVsBeforeRelocation();
        this._original = {
            _texture: this._texture,
            _x: this._rect.x,
            _y: this._rect.y,
        };

        this._texture = frame.texture;
        this._rect.x = frame.x;
        this._rect.y = frame.y;
        this._calculateUV(false);
    }

    /**
     * @deprecated since v3.5.0, this is an engine private interface that will be removed in the future.
     * @engineInternal
     * @mangle
     */
    public _resetDynamicAtlasFrame (): void {
        if (!this._original) return;
        this._preserveSourceUVsBeforeRelocation();
        this._restoreAtlasSource();
        this._calculateUV(false);
    }

    private _restoreAtlasSource (): void {
        const original = this._original!;
        this._rect.x = original._x;
        this._rect.y = original._y;
        this._texture = original._texture;
        this._original = null;
    }

    /**
     * @deprecated since v3.5.0, this is an engine private interface that will be removed in the future.
     * @engineInternal
     * @mangle
     */
    public _checkPackable (): void {
        const dynamicAtlas = dynamicAtlasManager;
        if (!dynamicAtlas) return;
        const texture = this._texture;

        if (!(texture instanceof Texture2D) || texture.isCompressed) {
            this._packable = false;
            return;
        }

        const w = this.width;
        const h = this.height;
        if (!texture.image
            || w > dynamicAtlas.maxFrameSize || h > dynamicAtlas.maxFrameSize) {
            this._packable = false;
            return;
        }
        const CanvasElement = ccwindow.HTMLCanvasElement;

        if (texture.image && texture.image instanceof CanvasElement) {
            this._packable = true;
        }
    }

    /**
     * @deprecated since v3.5.0, this is an engine private interface that will be removed in the future.
     */
    public _serialize (ctxForExporting: any): any {
        if (EDITOR || TEST || NODEJS) {
            const rect = { x: this._rect.x, y: this._rect.y, width: this._rect.width, height: this._rect.height };
            const offset = { x: this._offset.x, y: this._offset.y };
            const originalSize = this._originalSize;
            let texture;
            if (this._texture) {
                texture = this._texture._uuid;
                if (ctxForExporting) {
                    ctxForExporting.dependsOn('_textureSource', texture);
                }
            }

            let vertices;
            if (this.vertices) {
                const posArray = [];
                for (let i = 0; i < this.vertices.rawPosition.length; i++) {
                    const pos = this.vertices.rawPosition[i];
                    vec3ToArray(posArray, pos, 3 * i);
                }
                vertices = {
                    rawPosition: posArray,
                    indexes: this.vertices.indexes,
                    uv: this.vertices.uv,
                    nuv: this.vertices.nuv,
                    minPos: { x: this.vertices.minPos.x, y: this.vertices.minPos.y, z: this.vertices.minPos.z },
                    maxPos: { x: this.vertices.maxPos.x, y: this.vertices.maxPos.y, z: this.vertices.maxPos.z },
                };
            }

            const serialize = {
                name: this._name,
                atlas: ctxForExporting ? undefined : this._atlasUuid,  // strip from json if exporting
                rect,
                offset,
                originalSize,
                rotated: this._rotated,
                capInsets: this._capInsets,
                vertices,
                texture: (!ctxForExporting && texture) || undefined,
                packable: this._packable,
                pixelsToUnit: this._pixelsToUnit,
                pivot: this._pivot,
                meshType: this._meshType,
            };

            // 为 underfined 的数据则不在序列化文件里显示
            return serialize;
        }
        return null;
    }

    /**
     * @deprecated since v3.5.0, this is an engine private interface that will be removed in the future.
     */
    public _deserialize (serializeData: any, handle: any): void {
        const self = this;
        self._cancelPendingFullRect();
        const data = serializeData as ISpriteFramesSerializeData;
        const rect = data.rect;
        if (rect) {
            self._rect = new Rect(rect.x, rect.y, rect.width, rect.height);
        }

        const offset = data.offset;
        if (data.offset) {
            self._offset = v2(offset.x, offset.y);
        }

        const originalSize = data.originalSize;
        if (data.originalSize) {
            self._originalSize = size(originalSize.width, originalSize.height);
        }
        self._rotated = !!data.rotated;
        self._name = data.name;
        self._packable = !!data.packable;

        self._pixelsToUnit = data.pixelsToUnit ?? 100;
        const pivot = data.pivot;
        if (pivot) {
            self._pivot = v2(pivot.x, pivot.y);
        }
        self._meshType = data.meshType ?? MeshType.RECT;

        const capInsets = data.capInsets;
        if (capInsets) {
            const thisCapInsets = self._capInsets;
            thisCapInsets[INSET_LEFT] = capInsets[INSET_LEFT];
            thisCapInsets[INSET_TOP] = capInsets[INSET_TOP];
            thisCapInsets[INSET_RIGHT] = capInsets[INSET_RIGHT];
            thisCapInsets[INSET_BOTTOM] = capInsets[INSET_BOTTOM];
        }

        if (!BUILD) {
            // manually load texture via _textureSetter
            if (data.texture) {
                handle.result.push(self, '_textureSource', data.texture, js.getClassId(Texture2D));
            }
        }

        if (EDITOR || NODEJS) {
            self._atlasUuid = data.atlas ? data.atlas : '';
        }

        const vertices = data.vertices;
        if (vertices) {
            if (!self.vertices) {
                self.vertices = {
                    rawPosition: [],
                    positions: [],
                    indexes: vertices.indexes,
                    uv: vertices.uv,
                    nuv: vertices.nuv,
                    minPos: v3(vertices.minPos.x, vertices.minPos.y, vertices.minPos.z),
                    maxPos: v3(vertices.maxPos.x, vertices.maxPos.y, vertices.maxPos.z),
                };
            }
            self.vertices.rawPosition.length = 0;
            const rawPosition = vertices.rawPosition;
            for (let i = 0; i < rawPosition.length; i += 3) {
                self.vertices.rawPosition.push(v3(rawPosition[i], rawPosition[i + 1], rawPosition[i + 2]));
            }
            self._updateMeshVertices();
        }
    }

    /**
     * @en clone a sprite frame.
     * @zh 克隆当前 sprite frame。
     */
    public clone (): SpriteFrame {
        const self = this;
        const sp = new SpriteFrame();
        const v = self.vertices;
        sp.vertices = v ? {
            rawPosition: v.rawPosition.map((position) => position.clone()),
            positions: v.positions.slice(0),
            indexes: v.indexes.slice(0),
            uv: v.uv.slice(0),
            nuv: v.nuv.slice(0),
            minPos: v.minPos.clone(),
            maxPos: v.maxPos.clone(),
        } : null as any;
        sp.uv.splice(0, sp.uv.length, ...self.uv);
        sp.unbiasUV.splice(0, sp.unbiasUV.length, ...self.unbiasUV);
        if (self._relocatedSourceUV) sp._relocatedSourceUV = self._relocatedSourceUV.slice();
        sp.uvSliced.splice(0, sp.uvSliced.length, ...self.uvSliced);
        sp._rect.set(self._rect);
        sp._trimmedBorder.set(self._trimmedBorder);
        sp._offset.set(self._offset);
        sp._originalSize.set(self._originalSize);
        sp._rotated = self._rotated;
        sp._capInsets.splice(0, sp._capInsets.length, ...self._capInsets);
        sp._atlasUuid = self._atlasUuid;
        sp._texture = self._texture;
        sp._isFlipUVX = self._isFlipUVX;
        sp._isFlipUVY = self._isFlipUVY;
        if (self._original) {
            sp._original = {
                _texture: self._original._texture,
                _x: self._original._x,
                _y: self._original._y,
            };
        } else {
            sp._original = null;
        }
        sp._packable = self._packable;
        sp._pixelsToUnit = self._pixelsToUnit;
        sp._pivot.set(self._pivot);
        sp._meshType = self._meshType;
        sp._extrude = self._extrude;
        sp._customOutLine.splice(0, sp._customOutLine.length, ...self._customOutLine);
        sp._minPos.set(self._minPos);
        sp._maxPos.set(self._maxPos);
        if (self._pendingFullRect) {
            sp._pendingFullRect = { ...self._pendingFullRect };
            sp._syncTextureObserver();
            if (sp._observedTexture?.getGFXTexture()) sp._onSourceTextureChanged();
        }
        // Derived world meshes are created by their consumers, never as a side effect of cloning an asset.
        return sp;
    }

    protected _refreshTexture (texture: TextureBase): void {
        const self = this;
        self._texture = texture;
        const resetRect = self._rect.width === 0 || self._rect.height === 0 || !self.checkRect(texture);
        if (resetRect) self._rect.set(0, 0, texture.width, texture.height);
        if (resetRect || self._originalSize.width === 0 || self._originalSize.height === 0) {
            self._originalSize.set(texture.width, texture.height);
        }

        // Reusing a packed texture must not derive source eligibility from the larger atlas page.
        if (!self._original) self._checkPackable();
        // reset/_textureSource calculate the final UVs after all texture/rect changes are applied.
    }

    /**
     * @en complete loading callback.
     * @zh 加载完成回调。
     * @deprecated since v3.7.0, this is an engine private interface that will be removed in the future.
     */
    public onLoaded (): void {
        this._calcTrimmedBorder();
    }

    /**
     * @en default init.
     * @zh 默认初始化。
     * @param uuid @en Asset uuid. @zh 资源 uuid。
     * @deprecated since v3.7.0, this is an engine private interface that will be removed in the future.
     */
    public initDefault (uuid?: string): void {
        super.initDefault(uuid);
        const texture = new Texture2D();
        texture.initDefault();
        this._refreshTexture(texture);
        this._calcTrimmedBorder();
        this._calculateUV();
    }

    /**
     * @en Check whether the sprite frame is validate.
     * @zh 检查当前 sprite frame 对象是否是有效的。
     * @returns @en validate or not. @zh 是否有效。
     * @deprecated since v3.7.0, this is an engine private interface that will be removed in the future.
     */
    public validate (): boolean {
        return this._texture && this._rect && this._rect.width !== 0 && this._rect.height !== 0;
    }

    protected _initVertices (): void {
        const self = this;
        if (!self.vertices) {
            self.vertices = {
                rawPosition: [],
                positions: [],
                indexes: [],
                uv: [],
                nuv: [],
                minPos: v3(),
                maxPos: v3(),
            };
        } else {
            const vertices = self.vertices;
            vertices.rawPosition.length = 0;
            vertices.positions.length = 0;
            vertices.indexes.length = 0;
            vertices.uv.length = 0;
            vertices.nuv.length = 0;
            vertices.minPos.set(0, 0, 0);
            vertices.maxPos.set(0, 0, 0);
        }

        const thisVertices = self.vertices;

        if (self._meshType === MeshType.POLYGON) {
            // Use Bayazit to generate vertices and assign values
        } else { // Rect mode
            // default center is 0.5，0.5
            const tex = self.texture;
            const texw = tex.width;
            const texh = tex.height;
            const rect = self.rect;
            const width = rect.width;
            const height = rect.height;
            const rectX = rect.x;
            const rectY = texh - rect.y - height;
            const halfWidth = width / 2;
            const halfHeight = height / 2;

            const l = texw === 0 ? 0 : rectX / texw;
            const r = texw === 0 ? 1 : (rectX + width) / texw;
            const t = texh === 0 ? 1 : (rectY + height) / texh;
            const b = texh === 0 ? 0 : rectY / texh;

            const uv = thisVertices.uv;
            const nuv = thisVertices.nuv;
            const rawPosition = thisVertices.rawPosition;
            const indexes = thisVertices.indexes;

            // left bottom
            temp_vec3.set(-halfWidth, -halfHeight, 0);
            rawPosition.push(temp_vec3.clone());
            uv.push(rectX, rectY + height);
            nuv.push(l, b);
            thisVertices.minPos.set(temp_vec3);
            // right bottom
            temp_vec3.set(halfWidth, -halfHeight, 0);
            rawPosition.push(temp_vec3.clone());
            uv.push(rectX + width, rectY + height);
            nuv.push(r, b);
            // left top
            temp_vec3.set(-halfWidth, halfHeight, 0);
            rawPosition.push(temp_vec3.clone());
            uv.push(rectX, rectY);
            nuv.push(l, t);
            // right top
            temp_vec3.set(halfWidth, halfHeight, 0);
            rawPosition.push(temp_vec3.clone());
            uv.push(rectX + width, rectY);
            nuv.push(r, t);
            thisVertices.maxPos.set(temp_vec3);

            indexes.push(0, 1, 2, 2, 1, 3);
        }
        this._updateMeshVertices();
    }

    // Combine vertex information, unit information, anchor points, extrude and even customOutline to generate the actual vertices used
    protected _updateMeshVertices (): void {
        // Start generating the Geometry information to generate the mesh
        temp_matrix.identity();
        const units = 1 / this._pixelsToUnit;
        const PosX = -(this._pivot.x - 0.5) * this.rect.width * units;
        const PosY = -(this._pivot.y - 0.5) * this.rect.height * units;
        const temp_vec3 = v3(PosX, PosY, 0);
        temp_matrix.transform(temp_vec3);
        temp_vec3.set(units, units, 1);
        temp_matrix.scale(temp_vec3);
        const vertices = this.vertices!;

        for (let i = 0; i < vertices.rawPosition.length; i++) {
            const pos = vertices.rawPosition[i];
            vec3TransformMat4(temp_vec3, pos, temp_matrix);
            vec3ToArray(vertices.positions, temp_vec3, 3 * i);
        }
        vec3TransformMat4(this._minPos, vertices.minPos, temp_matrix);
        vec3TransformMat4(this._maxPos, vertices.maxPos, temp_matrix);
    }

    protected _createMesh (): void {
        const { width, height } = this._rect;
        const ppu = this._pixelsToUnit;
        if (!Number.isFinite(ppu) || ppu <= 0 || !Number.isFinite(width) || !Number.isFinite(height)
            || !Number.isFinite(this._pivot.x) || !Number.isFinite(this._pivot.y)) {
            warn('SpriteFrame: world geometry requires a positive finite PPU and finite rectangle/pivot.');
            return;
        }
        if (width <= 0 || height <= 0 || this.uv.length !== 8) return;
        if (this._meshType !== MeshType.RECT) {
            warn('SpriteFrame: world SpriteRenderer currently supports Rect geometry only.');
            return;
        }

        // Keep the existing asset pivot interpretation until an equivalent importer migration is available.
        // These are derived data: never overwrite `vertices`, which may contain serialized/UI source geometry.
        const left = -this._pivot.x * width / ppu;
        const bottom = -this._pivot.y * height / ppu;
        const right = left + width / ppu;
        const top = bottom + height / ppu;
        if (![left, bottom, right, top].every((v) => Number.isFinite(Math.fround(v)))) return;
        const texture = this._getSourceTexture();
        if (!isValid(texture, true) || !texture.width || !texture.height) return;
        const uvs = this._getSourceUVs();
        if (uvs.length !== 8 || !uvs.every((v) => Number.isFinite(Math.fround(v)))) return;
        this._minPos.set(left, bottom, 0);
        this._maxPos.set(right, top, 0);
        this._mesh = createMesh({
            primitiveMode: PrimitiveMode.TRIANGLE_LIST,
            positions: [left, bottom, 0, right, bottom, 0, left, top, 0, right, top, 0],
            // Preserve the Sprite Effect's existing V inversion contract.
            uvs,
            indices: [0, 1, 2, 2, 1, 3],
            minPos: this._minPos,
            maxPos: this._maxPos,
            attributes: [
                new Attribute(AttributeName.ATTR_POSITION, Format.RGB32F),
                new Attribute(AttributeName.ATTR_TEX_COORD, Format.RG32F),
            ],
        });
        this._mesh.addRef();
        this._recordWorldGeometry(uvs);
        texture.addRef();
        this._meshTexture = texture;
        this._syncTextureObserver();
    }

    protected _updateMesh (): void {
        const previous = this._mesh;
        const previousTexture = this._meshTexture;
        this._mesh = null;
        delete this._meshTexture;
        delete this._worldGeometryInputs;
        try {
            // Active consumers lazily build the replacement once; inactive consumers only detach stale bindings.
            if (this._meshUsers) this.emit(SpriteFrameEvent.MESH_CHANGED, this);
        } finally {
            releaseCachedMesh(previous, previousTexture);
            if (!this._mesh && !this._meshUsers) this._syncTextureObserver();
        }
    }
}

cclegacy.SpriteFrame = SpriteFrame;

/*
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

import { ccclass, executeInEditMode, executionOrder, help, menu, serializable, type, visible, editable } from 'cc.decorator';
import { builtinResMgr } from '../../asset/asset-manager';
import { Material } from '../../asset/assets';
import { Color, Vec2, Vec3, Vec4, CCBoolean, CCFloat, cclegacy, isValid, warn } from '../../core';
import { ModelLocalBindings } from '../../rendering/define';
import { Model } from '../../render-scene/scene';
import type { Root } from '../../root';
import { TransformBit } from '../../scene-graph/node-enum';
import { SpriteFrame, SpriteFrameEvent } from '../assets/sprite-frame';
import { ModelRenderer } from '../../misc';
import type { Mesh } from '../../3d/assets/mesh';
import { MaterialInstance } from '../../render-scene/core/material-instance';
import type { TextureBase } from '../../asset/assets/texture-base';
import { createMesh } from '../../3d/misc/create-mesh';
import { generateSpriteGeometry, SpriteDrawMode, SpriteTileMode } from '../utils/sprite-renderer-geometry';

export { SpriteDrawMode, SpriteTileMode };

enum SpriteMode {
    SIMPLE = 0,
    SLICED = 1,
    TILED = 2,
}

/**
 * @en 2D rendering component that provides the ability to render sprite in 3D space.
 * @zh 2D 渲染基础组件，提供精灵渲染在 3D 空间中的能力。
 */
@ccclass('cc.SpriteRenderer')
@help('i18n:cc.SpriteRenderer')
@executionOrder(100)
@menu('2D/SpriteRenderer')
@executeInEditMode
export class SpriteRenderer extends ModelRenderer {
    public static DrawMode = SpriteDrawMode;
    public static TileMode = SpriteTileMode;
    constructor () {
        super();
    }

    /**
    * @en The spriteFrame that the component should render.
    * @zh 该组件应渲染的 spriteFrame。
    */
    @type(SpriteFrame)
    get spriteFrame (): SpriteFrame | null {
        return this._spriteFrame;
    }

    set spriteFrame (value) {
        if (this._spriteFrame === value) {
            return;
        }

        // SubModels must let go of the old mesh before the frame can release its last world user.
        this._destroyModel();
        this._releaseFrame();
        this._spriteFrame = value;
        this._updateModels();
    }

    /** @en Instance tint, multiplied by the material color. @zh 实例颜色，与材质颜色相乘。 */
    @type(Color)
    @editable
    get color (): Readonly<Color> { return this._instanceColor.clone(); }
    set color (value: Readonly<Color>) {
        if (this._instanceColor.equals(value)) return;
        this._instanceColor.set(value);
        this._updateInstanceParameters(true, false);
    }

    /** @en Mirror the rendered geometry around its local pivot. @zh 围绕局部原点水平翻转渲染内容。 */
    @type(CCBoolean)
    @editable
    get flipX (): boolean { return this._instanceFlipX; }
    set flipX (value: boolean) {
        if (this._instanceFlipX === value) return;
        this._instanceFlipX = value;
        this._updateInstanceParameters(false, true);
    }

    /** @en Mirror the rendered geometry around its local pivot. @zh 围绕局部原点垂直翻转渲染内容。 */
    @type(CCBoolean)
    @editable
    get flipY (): boolean { return this._instanceFlipY; }
    set flipY (value: boolean) {
        if (this._instanceFlipY === value) return;
        this._instanceFlipY = value;
        this._updateInstanceParameters(false, true);
    }

    /**
     * @en Rendering model of the component.
     * @zh 该组件的渲染模型。
     */
    get model (): Model | null {
        return this._model;
    }

    /** @en Geometry generation mode. @zh 几何生成模式。 */
    @type(SpriteDrawMode)
    @editable
    get drawMode (): SpriteDrawMode { return this._drawMode; }
    set drawMode (value: SpriteDrawMode) {
        if (this._drawMode === value) return;
        this._drawMode = value;
        this._destroyModel();
        this._releaseFrame();
        this._updateModels();
    }

    /** @en Target size in local world units; ignored in Simple mode. @zh 局部世界单位尺寸，Simple 模式忽略。 */
    @type(Vec2)
    @editable
    @visible(function sizeVisible (this: SpriteRenderer) { return this._drawMode !== SpriteDrawMode.SIMPLE; })
    get size (): Readonly<Vec2> {
        if (!this._renderSize) {
            const frame = this._spriteFrame;
            return new Vec2(frame ? frame.rect.width / frame.pixelsToUnit : 1, frame ? frame.rect.height / frame.pixelsToUnit : 1);
        }
        return new Vec2(this._renderSize);
    }
    set size (value: Readonly<Vec2>) {
        if (this._renderSize?.strictEquals(value)) return;
        this._renderSize = new Vec2(value);
        if (this._drawMode !== SpriteDrawMode.SIMPLE) this._invalidateGeometry();
    }

    /** @en Continuous or adaptive repetition. @zh 连续或自适应平铺。 */
    @type(SpriteTileMode)
    @editable
    @visible(function tileModeVisible (this: SpriteRenderer) { return this._drawMode === SpriteDrawMode.TILED; })
    get tileMode (): SpriteTileMode { return this._tileMode; }
    set tileMode (value: SpriteTileMode) {
        if (this._tileMode === value) return;
        this._tileMode = value;
        if (this._drawMode === SpriteDrawMode.TILED) this._invalidateGeometry();
    }

    /** @en Fraction of a repeat unit before adding a complete adaptive tile, in [0, 1]. @zh 增加完整平铺单元的阈值，范围 [0, 1]。 */
    @type(CCFloat)
    @editable
    @visible(function thresholdVisible (this: SpriteRenderer) {
        return this._drawMode === SpriteDrawMode.TILED && this._tileMode === SpriteTileMode.ADAPTIVE;
    })
    get adaptiveModeThreshold (): number { return this._adaptiveModeThreshold; }
    set adaptiveModeThreshold (value: number) {
        if (this._adaptiveModeThreshold === value) return;
        this._adaptiveModeThreshold = value;
        if (this._drawMode === SpriteDrawMode.TILED && this._tileMode === SpriteTileMode.ADAPTIVE) this._invalidateGeometry();
    }

    @serializable
    protected _spriteFrame: SpriteFrame | null = null;
    @serializable
    protected _mode = SpriteMode.SIMPLE;
    // Preserve legacy serialized placeholders without activating previously ignored scene values.
    // Effective instance properties have neutral defaults and separate serialized storage.
    @serializable
    protected _color: Color = Color.WHITE.clone();
    @serializable
    protected _flipX = false;
    @serializable
    protected _flipY = false;
    @serializable
    protected _instanceColor: Color = Color.WHITE.clone();
    @serializable
    protected _instanceFlipX = false;
    @serializable
    protected _instanceFlipY = false;
    @visible(false)
    @serializable
    protected _size: Vec2 = new Vec2(); // Legacy inactive placeholder, preserved for old scenes.
    @serializable
    protected _drawMode = SpriteDrawMode.SIMPLE;
    @serializable
    protected _renderSize: Vec2 | null = null; // null = natural size; explicit zero remains zero on reload.
    @serializable
    protected _tileMode = SpriteTileMode.CONTINUOUS;
    @serializable
    protected _adaptiveModeThreshold = 0.5;

    private _model: Model | null = null;
    private _retainedFrame: SpriteFrame | null = null;
    private _boundMesh: Mesh | null = null;
    private _ownedMesh: Mesh | null = null;
    private _ownedTexture: TextureBase | null = null;
    private _geometryWarning = '';
    private _applyingMaterial = false;
    private _warnedMaterial: Material | null = null;
    private _spriteFlip = new Vec4(1, 1, 1, 1);
    private _boundsMin = new Vec3();
    private _boundsMax = new Vec3();

    public onRestore (): void {
        // Deserialization/Undo can change backing fields without invoking their setters.
        this._destroyModel();
        if (this._retainedFrame !== this._spriteFrame) {
            this._releaseFrame();
        }
        this._updateModels();
    }

    public onEnable (): void {
        super.onEnable();
        this._updateModels();
    }

    public onDisable (): void {
        if (this._model) {
            this._detachFromScene();
        }
    }

    public onDestroy (): void {
        this._destroyModel();
        this._releaseFrame();
        for (const instance of this._materialInstances) {
            if (instance?.owner === this) instance.destroy();
        }
        this._materialInstances.length = 0;
    }

    public override getMaterialInstance (index: number): MaterialInstance | null {
        // A script may install an instance without assigning a shared material first.
        return this._materialInstances[index] || super.getMaterialInstance(index);
    }

    public override setSharedMaterial (material: Material | null, index: number, forceUpdate = false): void {
        if (!forceUpdate && material && this._materials[index] === material) return;
        const instance = this._materialInstances[index];
        if (instance && instance.owner !== this) {
            // The base renderer destroys the instance in this slot when replacing the material.
            this._materialInstances[index] = null;
            forceUpdate = true;
        }
        super.setSharedMaterial(material, index, forceUpdate || (!!instance && material === null));
    }

    public override setMaterialInstance (material: Material | MaterialInstance | null, index: number): void {
        const previous = this._materialInstances[index];
        if (material?.parent && index >= this._materials.length) {
            // The inherited array setters visit shared slots when clearing material instances.
            this._materials[index] = null;
        }
        super.setMaterialInstance(material, index);
        // Renderer releases owned instances when changing a shared material, but not when installing another instance.
        // Release our generated instance only after the replacement has reached the Model; never release a borrowed one.
        if (material?.parent && previous && previous !== this._materialInstances[index] && previous.owner === this) {
            previous.destroy();
        }
    }

    private _destroyModel (): void {
        this._detachFromScene();
        if (this._model) {
            this._model.enabled = false;
            (cclegacy.director.root as Root).destroyModel(this._model);
            this._model = null;
            this._models.length = 0;
        }
        this._boundMesh = null;
        this._ownedMesh?.destroy();
        this._ownedMesh = null;
        this._ownedTexture?.decRef(false);
        this._ownedTexture = null;
    }

    private _invalidateGeometry (): void {
        this._destroyModel();
        this._updateModels();
    }

    private _onBorderChanged (): void {
        if (this._drawMode !== SpriteDrawMode.SIMPLE) this._invalidateGeometry();
    }

    private _releaseFrame (): void {
        const frame = this._retainedFrame;
        if (!frame) return;
        this._retainedFrame = null;
        frame.off(SpriteFrameEvent.MESH_CHANGED, this._onFrameChanged, this);
        frame.off(SpriteFrameEvent.MESH_DESTROYED, this._onFrameDestroyed, this);
        frame.off(SpriteFrameEvent.BORDER_CHANGED, this._onBorderChanged, this);
        frame.off(SpriteFrameEvent.TEXTURE_CHANGED, this._onTextureChanged, this);
        frame._releaseMesh();
    }

    private _onFrameChanged (): void {
        if (this._drawMode !== SpriteDrawMode.SIMPLE) {
            this._invalidateGeometry();
            return;
        }
        // Inactive components retain ownership, but do not rebuild or upload on resource changes.
        if (!this.enabledInHierarchy) {
            this._destroyModel();
        } else {
            this._updateModels();
        }
    }

    private _onFrameDestroyed (): void {
        this._destroyModel();
        this._releaseFrame();
    }

    private _onTextureChanged (): void {
        if (!this.enabledInHierarchy) return;
        if (this._model && this._retainedFrame?._getSourceTexture()?.getGFXTexture()) {
            this._onUpdateLocalDescriptorSet();
        } else {
            this._updateModels();
        }
    }

    protected _updateModels (): void {
        if (!this.enabledInHierarchy) return;
        const frame = this._spriteFrame;
        if (!isValid(frame, true)) {
            this._destroyModel();
            this._releaseFrame();
            return;
        }
        if (this._retainedFrame !== frame) {
            this._destroyModel();
            this._releaseFrame();
            this._retainedFrame = frame;
            frame._retainMesh();
            frame.on(SpriteFrameEvent.MESH_CHANGED, this._onFrameChanged, this);
            frame.on(SpriteFrameEvent.MESH_DESTROYED, this._onFrameDestroyed, this);
            frame.on(SpriteFrameEvent.BORDER_CHANGED, this._onBorderChanged, this);
            frame.on(SpriteFrameEvent.TEXTURE_CHANGED, this._onTextureChanged, this);
        }
        const mode = this._drawMode;
        frame._validateWorldGeometry();
        // Validation may notify a listener that changes the frame, mode or underlying texture.
        if (this._retainedFrame !== frame || this._drawMode !== mode || !this.enabledInHierarchy) return;
        const sourceTexture = frame._getSourceTexture();
        if (!isValid(sourceTexture, true) || !sourceTexture.getGFXTexture()) {
            this._destroyModel();
            return;
        }
        let mesh: Mesh | null;
        if (mode === SpriteDrawMode.SIMPLE) {
            if (!frame.mesh) frame.ensureMeshData();
            mesh = frame.mesh;
        } else {
            if (!this._ownedMesh) {
                const size = this._renderSize ?? this.size;
                const result = generateSpriteGeometry(frame, size.x, size.y, this._drawMode, this._tileMode, this._adaptiveModeThreshold);
                if (result.error && result.error !== this._geometryWarning) warn(`SpriteRenderer: ${result.error}.`);
                this._geometryWarning = result.error || '';
                if (result.geometry) {
                    this._ownedMesh = createMesh(result.geometry);
                    frame._recordWorldGeometry();
                    sourceTexture.addRef();
                    this._ownedTexture = sourceTexture;
                }
            }
            mesh = this._ownedMesh;
        }
        if (!mesh) {
            this._destroyModel();
            return;
        }
        mesh.initialize();
        const model = this._model;
        const geometryChanged = !model || this._boundMesh !== mesh;
        if (model && this._boundMesh !== mesh) {
            model.destroy();
            model.initialize();
            model.node = model.transform = this.node;
        } else if (!model) {
            this._createModel();
        }
        this._boundMesh = mesh;
        if (this._model) {
            if (geometryChanged) {
                this._updateModelParams();
            } else {
                this._updateInstanceParameters();
            }
            this._onVisibilityChange(this.visibility);
            this._updatePriority();
            this._onUpdateLocalDescriptorSet();
            this._updateBounds();
            this._attachToScene();
        }
    }

    protected _createModel (): void {
        const model = this._model = (cclegacy.director.root as Root).createModel<Model>(Model);
        model.visFlags = this.visibility;
        model.node = model.transform = this.node;
        this._models.length = 0;
        this._models.push(this._model);
    }

    protected _updateModelParams (): void {
        if (!this._boundMesh || !this._model) { return; }
        const mesh = this._boundMesh;
        this.node.hasChangedFlags |= TransformBit.POSITION; // Same as model, Maybe a hack
        this._model.transform.hasChangedFlags |= TransformBit.POSITION;
        const renderingMesh = mesh ? mesh.renderingSubMeshes : null;
        if (renderingMesh) {
            const meshCount = renderingMesh.length;
            for (let i = 0; i < meshCount; ++i) {
                let material = this._applySpriteParameters(i);
                if (material && !material.isValid) {
                    material = null;
                }
                const subMeshData = renderingMesh[i];
                if (subMeshData) {
                    this._model.initSubModel(i, subMeshData, material || this._getBuiltinMaterial());
                }
            }
        }
        this._model.enabled = true;
    }

    protected _getBuiltinMaterial (): Material {
        // classic ugly pink indicating missing material
        return builtinResMgr.get<Material>('missing-material');
    }

    protected _onMaterialModified (idx: number, material: Material | null): void {
        super._onMaterialModified(idx, material);
        if (!this._applyingMaterial) this._updateInstanceParameters();
    }

    /**
     * @engineInternal
     */
    public override _onRebuildPSO (idx: number, material: Material): void {
        if (!this._model || !this._model.inited) { return; }
        this._model.setSubModelMaterial(idx, this._applySpriteParameters(idx) || this._getBuiltinMaterial());
        this._updateBounds();
        this._onUpdateLocalDescriptorSet();
    }

    private _applySpriteParameters (index: number, updateColor = true, updateFlip = true): Material | null {
        let material = this.getRenderMaterial(index);
        // A borrowed MaterialInstance can outlive its passes when its owner is destroyed.
        if (!material || !isValid(material, true) || !material.passes?.length) return null;
        const hasColor = material.passes.some((pass) => !!pass.getHandle('spriteColor'));
        const hasFlip = material.passes.some((pass) => !!pass.getHandle('spriteFlip'));
        const tinted = !this._instanceColor.equals(Color.WHITE);
        const flipped = this._instanceFlipX || this._instanceFlipY;
        if ((tinted && !hasColor) || (flipped && !hasFlip)) {
            if (this._warnedMaterial !== material) {
                warn('SpriteRenderer: the assigned Effect does not support spriteColor/spriteFlip.');
                this._warnedMaterial = material;
            }
        }
        if (!hasColor && !hasFlip) return material;
        if (!tinted && !flipped && !this._materialInstances[index]) return material;
        this._applyingMaterial = true;
        try {
            // An externally supplied instance may be shared by other renderers.
            const existing = this._materialInstances[index];
            if (existing && existing.owner !== this) {
                material = new MaterialInstance({ parent: material, owner: this, subModelIdx: index });
                this.setMaterialInstance(material, index);
            } else {
                material = this.getMaterialInstance(index);
            }
            if (material) {
                if (hasColor && (updateColor || material !== existing)) material.setProperty('spriteColor', this._instanceColor);
                if (hasFlip && (updateFlip || material !== existing)) {
                    this._spriteFlip.set(this._instanceFlipX ? -1 : 1, this._instanceFlipY ? -1 : 1, 1, 1);
                    material.setProperty('spriteFlip', this._spriteFlip);
                }
            }
        } finally {
            this._applyingMaterial = false;
        }
        return material;
    }

    private _updateInstanceParameters (updateColor = true, updateFlip = true): void {
        if (!this.enabledInHierarchy || !this._model?.inited) return;
        const subModels = this._model.subModels;
        let rebound = false;
        for (let i = 0; i < subModels.length; ++i) {
            const material = this._applySpriteParameters(i, updateColor, updateFlip) || this._getBuiltinMaterial();
            const bound = subModels[i].passes;
            const passes = material.passes;
            // JSB can return a new array containing the same passes.
            if (bound !== passes && (bound.length !== passes.length || bound.some((pass, j) => pass !== passes[j]))) {
                this._model.setSubModelMaterial(i, material);
                rebound = true;
            }
        }
        if (updateFlip || rebound) this._updateBounds();
        if (rebound) this._onUpdateLocalDescriptorSet();
    }

    private _updateBounds (): void {
        const min = this._boundMesh?.struct.minPosition;
        const max = this._boundMesh?.struct.maxPosition;
        if (!this._model || !min || !max) return;
        const supportsFlip = this._model.subModels[0]?.passes.some((pass) => !!pass.getHandle('spriteFlip'));
        const flipX = supportsFlip && this._instanceFlipX;
        const flipY = supportsFlip && this._instanceFlipY;
        this._boundsMin.set(flipX ? -max.x : min.x, flipY ? -max.y : min.y, min.z);
        this._boundsMax.set(flipX ? -min.x : max.x, flipY ? -min.y : max.y, max.z);
        this._model.createBoundingShape(this._boundsMin, this._boundsMax);
        this._model.updateWorldBound();
    }

    protected _onVisibilityChange (value: number): void {
        if (this._model) this._model.visFlags = value;
    }

    protected _onUpdateLocalDescriptorSet (): void {
        if (!this._spriteFrame || !this._model || !this._model.inited) {
            return;
        }

        const sourceTexture = this._spriteFrame._getSourceTexture();
        const texture = sourceTexture.getGFXTexture()!;
        const sampler = sourceTexture.getGFXSampler();
        // We need a api like updateLocalDescriptors(texture,sampler,binding) from model
        const subModels = this._model.subModels;
        const binding = ModelLocalBindings.SAMPLER_SPRITE;
        for (let i = 0; i < subModels.length; i++) {
            const { descriptorSet } = subModels[i];
            descriptorSet.bindTexture(binding, texture);
            descriptorSet.bindSampler(binding, sampler);
            descriptorSet.update();
        }
    }

    protected _attachToScene (): void {
        if (!this.enabledInHierarchy || !this.node.scene || !this._model || !this._boundMesh) {
            return;
        }
        const renderScene = this._getRenderScene();
        if (this._model.scene !== null) {
            this._detachFromScene();
        }
        renderScene.addModel(this._model);
    }

    /**
     * @engineInternal
     */
    public _detachFromScene (): void {
        if (this._model && this._model.scene) {
            this._model.scene.removeModel(this._model);
        }
    }
}

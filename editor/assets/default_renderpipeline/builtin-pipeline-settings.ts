/*
 Copyright (c) 2021-2024 Xiamen Yaji Software Co., Ltd.

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

import {
    _decorator, Camera, CCBoolean, CCFloat, CCInteger, Color, Component,
    Material, rendering, Texture2D,
} from 'cc';

import { EDITOR } from 'cc/env';

import {
    BloomType, LightShaftQuality,
    fillRequiredPipelineSettings, makePipelineSettings, PipelineSettings,
} from './builtin-pipeline-types';

const { ccclass, disallowMultiple, executeInEditMode, menu, property, requireComponent, type } = _decorator;

@ccclass('BuiltinPipelineSettings')
@menu('Rendering/BuiltinPipelineSettings')
@requireComponent(Camera)
@disallowMultiple
@executeInEditMode
export class BuiltinPipelineSettings extends Component {
    @property
    private readonly _settings: PipelineSettings = makePipelineSettings();

    getPipelineSettings(): PipelineSettings {
        return this._settings;
    }

    // Enable/Disable
    onEnable(): void {
        fillRequiredPipelineSettings(this._settings);
        const cameraComponent = this.getComponent(Camera)!;
        const camera = cameraComponent.camera;
        camera.pipelineSettings = this._settings;

        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    onDisable(): void {
        const cameraComponent = this.getComponent(Camera)!;
        const camera = cameraComponent.camera;
        if (camera) {
            camera.pipelineSettings = null;
        }
        if (EDITOR) {
            this._disableEditorPreview();
        }
    }

    // Editor Preview
    @property(CCBoolean)
    protected _editorPreview = false;

    @property({
        displayName: 'Editor Preview (Experimental)',
        type: CCBoolean,
    })
    get editorPreview(): boolean {
        return this._editorPreview;
    }
    set editorPreview(v: boolean) {
        this._editorPreview = v;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    public _tryEnableEditorPreview(): void {
        if (rendering === undefined) {
            return;
        }
        if (this._editorPreview) {
            rendering.setEditorPipelineSettings(this._settings);
        } else {
            this._disableEditorPreview();
        }
    }
    public _disableEditorPreview(): void {
        if (rendering === undefined) {
            return;
        }
        const current = rendering.getEditorPipelineSettings() as PipelineSettings | null;
        if (current === this._settings) {
            rendering.setEditorPipelineSettings(null);
        }
    }

    // MSAA
    @property({
        group: { id: 'MSAA', name: 'Multisample Anti-Aliasing' },
        type: CCBoolean,
    })
    get MsaaEnable(): boolean {
        return this._settings.msaa.enabled;
    }
    set MsaaEnable(value: boolean) {
        this._settings.msaa.enabled = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }

    @property({
        group: { id: 'MSAA', name: 'Multisample Anti-Aliasing', style: 'section' },
        type: CCInteger,
        range: [2, 4, 2],
    })
    set msaaSampleCount(value: number) {
        value = 2 ** Math.ceil(Math.log2(Math.max(value, 2)));
        value = Math.min(value, 4);
        this._settings.msaa.sampleCount = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get msaaSampleCount(): number {
        return this._settings.msaa.sampleCount;
    }

    // Shading Scale
    @property({
        group: { id: 'ShadingScale', name: 'ShadingScale', style: 'section' },
        type: CCBoolean,
    })
    set shadingScaleEnable(value: boolean) {
        this._settings.enableShadingScale = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get shadingScaleEnable(): boolean {
        return this._settings.enableShadingScale;
    }

    @property({
        tooltip: 'i18n:postprocess.shadingScale',
        group: { id: 'ShadingScale', name: 'ShadingScale' },
        type: CCFloat,
        range: [0.01, 4, 0.01],
        slide: true,
    })
    set shadingScale(value: number) {
        this._settings.shadingScale = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get shadingScale(): number {
        return this._settings.shadingScale;
    }

    // Bloom
    @property({
        group: { id: 'Bloom', name: 'Bloom (PostProcessing)', style: 'section' },
        type: CCBoolean,
    })
    set bloomEnable(value: boolean) {
        this._settings.bloom.enabled = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get bloomEnable(): boolean {
        return this._settings.bloom.enabled;
    }

    @type(BloomType)
    @property({
        group: { id: 'Bloom', name: 'Bloom (PostProcessing)', style: 'section' },
    })
    set bloomType(value: BloomType) {
        this._settings.bloom.type = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }

    get bloomType(): BloomType {
        return this._settings.bloom.type;
    }

    @property({
        group: { id: 'Bloom', name: 'Bloom (PostProcessing)', style: 'section' },
        type: Material,
    })
    set kawaseBloomMaterial(value: Material) {
        if (this._settings.bloom.kawaseFilterMaterial === value) {
            return;
        }
        this._settings.bloom.kawaseFilterMaterial = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get kawaseBloomMaterial(): Material {
        return this._settings.bloom.kawaseFilterMaterial!;
    }

    @property({
        group: { id: 'Bloom', name: 'Bloom (PostProcessing)', style: 'section' },
        type: Material,
    })
    set mipmapBloomMaterial(value: Material) {
        if (this._settings.bloom.mipmapFilterMaterial === value) {
            return;
        }
        this._settings.bloom.mipmapFilterMaterial = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get mipmapBloomMaterial(): Material {
        return this._settings.bloom.mipmapFilterMaterial!;
    }

    @property({
        tooltip: 'i18n:bloom.enableAlphaMask',
        group: { id: 'Bloom', name: 'Bloom (PostProcessing)', style: 'section' },
        type: CCBoolean,
    })
    set bloomEnableAlphaMask(value: boolean) {
        this._settings.bloom.enableAlphaMask = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get bloomEnableAlphaMask(): boolean {
        return this._settings.bloom.enableAlphaMask;
    }

    @property({
        tooltip: 'i18n:bloom.iterations',
        group: { id: 'Bloom', name: 'Bloom (PostProcessing)', style: 'section' },
        type: CCInteger,
        range: [1, 6, 1],
        slide: true,
    })
    set bloomIterations(value: number) {
        this._settings.bloom.iterations = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get bloomIterations(): number {
        return this._settings.bloom.iterations;
    }

    @property({
        tooltip: 'i18n:bloom.threshold',
        group: { id: 'Bloom', name: 'Bloom (PostProcessing)', style: 'section' },
        type: CCFloat,
        min: 0,
    })
    set bloomThreshold(value: number) {
        this._settings.bloom.threshold = value;
    }
    get bloomThreshold(): number {
        return this._settings.bloom.threshold;
    }

    @type(CCFloat)
    @property({
        group: { id: 'Bloom', name: 'Bloom (PostProcessing)', style: 'section' },
    })
    set bloomIntensity(value: number) {
        this._settings.bloom.intensity = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get bloomIntensity(): number {
        return this._settings.bloom.intensity;
    }

    // Light Shaft
    @property({
        tooltip: 'Screen-space bloom around bright sun regions from the main directional light. Off-screen or hidden regions cannot produce shafts. Use Builtin MSAA to preserve anti-aliasing when rendering off-screen.',
        group: { id: 'LightShaft', name: 'Light Shaft (Post Processing)', style: 'section' },
        type: CCBoolean,
    })
    set lightShaftEnable(value: boolean) {
        this._settings.lightShaft.enabled = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get lightShaftEnable(): boolean {
        return this._settings.lightShaft.enabled;
    }

    @property({
        tooltip: 'Select builtin-light-shaft-bloom.mtl or a compatible material. The effect is skipped when empty.',
        group: { id: 'LightShaft', name: 'Light Shaft (Post Processing)', style: 'section' },
        type: Material,
    })
    set lightShaftMaterial(value: Material | null) {
        if (this._settings.lightShaft.material === value) {
            return;
        }
        this._settings.lightShaft.material = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get lightShaftMaterial(): Material | null {
        return this._settings.lightShaft.material;
    }

    @property({
        tooltip: 'Brightness added by the light shafts.',
        group: { id: 'LightShaft', name: 'Light Shaft (Post Processing)', style: 'section' },
        type: CCFloat,
        min: 0,
    })
    set lightShaftIntensity(value: number) {
        this._settings.lightShaft.intensity = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get lightShaftIntensity(): number {
        return this._settings.lightShaft.intensity;
    }

    @property({
        tooltip: 'Minimum linear scene brightness included in the sun region.',
        group: { id: 'LightShaft', name: 'Light Shaft (Post Processing)', style: 'section' },
        type: CCFloat,
        min: 0,
    })
    set lightShaftThreshold(value: number) {
        this._settings.lightShaft.threshold = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get lightShaftThreshold(): number {
        return this._settings.lightShaft.threshold;
    }

    @property({
        tooltip: 'Radius of the bright region around the main directional light, relative to screen height.',
        group: { id: 'LightShaft', name: 'Light Shaft (Post Processing)', style: 'section' },
        type: CCFloat,
        range: [0.01, 1, 0.01],
        slide: true,
    })
    set lightShaftRadius(value: number) {
        this._settings.lightShaft.radius = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get lightShaftRadius(): number {
        return this._settings.lightShaft.radius;
    }

    @property({
        tooltip: 'Radial blur length toward the main directional light.',
        group: { id: 'LightShaft', name: 'Light Shaft (Post Processing)', style: 'section' },
        type: CCFloat,
        range: [0, 1, 0.01],
        slide: true,
    })
    set lightShaftLength(value: number) {
        this._settings.lightShaft.length = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get lightShaftLength(): number {
        return this._settings.lightShaft.length;
    }

    @property({
        tooltip: 'Color multiplier for the light shafts.',
        group: { id: 'LightShaft', name: 'Light Shaft (Post Processing)', style: 'section' },
        type: Color,
    })
    set lightShaftTint(value: Color) {
        this._settings.lightShaft.tint.set(value);
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get lightShaftTint(): Color {
        return this._settings.lightShaft.tint;
    }

    @type(LightShaftQuality)
    @property({
        tooltip: 'Two radial blurs. Low: 1/8 resolution, 2 x 4 samples. Medium: 1/4, 2 x 8. High: 1/2, 2 x 16.',
        group: { id: 'LightShaft', name: 'Light Shaft (Post Processing)', style: 'section' },
    })
    set lightShaftQuality(value: LightShaftQuality) {
        this._settings.lightShaft.quality = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get lightShaftQuality(): LightShaftQuality {
        return this._settings.lightShaft.quality;
    }

    // Color Grading (LDR)
    @property({
        group: { id: 'Color Grading', name: 'ColorGrading (LDR) (PostProcessing)', style: 'section' },
        type: CCBoolean,
    })
    set colorGradingEnable(value: boolean) {
        this._settings.colorGrading.enabled = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get colorGradingEnable(): boolean {
        return this._settings.colorGrading.enabled;
    }

    @property({
        group: { id: 'Color Grading', name: 'ColorGrading (LDR) (PostProcessing)', style: 'section' },
        type: Material,
    })
    set colorGradingMaterial(value: Material) {
        if (this._settings.colorGrading.material === value) {
            return;
        }
        this._settings.colorGrading.material = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get colorGradingMaterial(): Material {
        return this._settings.colorGrading.material!;
    }

    @property({
        tooltip: 'i18n:color_grading.contribute',
        group: { id: 'Color Grading', name: 'ColorGrading (LDR) (PostProcessing)', style: 'section' },
        type: CCFloat,
        range: [0, 1, 0.01],
        slide: true,
    })
    set colorGradingContribute(value: number) {
        this._settings.colorGrading.contribute = value;
    }
    get colorGradingContribute(): number {
        return this._settings.colorGrading.contribute;
    }

    @property({
        tooltip: 'i18n:color_grading.originalMap',
        group: { id: 'Color Grading', name: 'ColorGrading (LDR) (PostProcessing)', style: 'section' },
        type: Texture2D,
    })
    set colorGradingMap(val: Texture2D) {
        this._settings.colorGrading.colorGradingMap = val;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get colorGradingMap(): Texture2D {
        return this._settings.colorGrading.colorGradingMap!;
    }

    // FXAA
    @property({
        group: { id: 'FXAA', name: 'Fast Approximate Anti-Aliasing (PostProcessing)', style: 'section' },
        type: CCBoolean,
    })
    set fxaaEnable(value: boolean) {
        this._settings.fxaa.enabled = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get fxaaEnable(): boolean {
        return this._settings.fxaa.enabled;
    }

    @property({
        group: { id: 'FXAA', name: 'Fast Approximate Anti-Aliasing (PostProcessing)', style: 'section' },
        type: Material,
    })
    set fxaaMaterial(value: Material) {
        if (this._settings.fxaa.material === value) {
            return;
        }
        this._settings.fxaa.material = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get fxaaMaterial(): Material {
        return this._settings.fxaa.material!;
    }

    // FSR
    @property({
        group: { id: 'FSR', name: 'FidelityFX Super Resolution', style: 'section' },
        type: CCBoolean,
    })
    set fsrEnable(value: boolean) {
        this._settings.fsr.enabled = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get fsrEnable(): boolean {
        return this._settings.fsr.enabled;
    }

    @property({
        group: { id: 'FSR', name: 'FidelityFX Super Resolution', style: 'section' },
        type: Material,
    })
    set fsrMaterial(value: Material) {
        if (this._settings.fsr.material === value) {
            return;
        }
        this._settings.fsr.material = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get fsrMaterial(): Material {
        return this._settings.fsr.material!;
    }

    @property({
        group: { id: 'FSR', name: 'FidelityFX Super Resolution', style: 'section' },
        type: CCFloat,
        range: [0, 1, 0.01],
        slide: true,
    })
    set fsrSharpness(value: number) {
        this._settings.fsr.sharpness = value;
    }
    get fsrSharpness(): number {
        return this._settings.fsr.sharpness;
    }

    @property({
        group: { id: 'ToneMapping', name: 'ToneMapping', style: 'section' },
        type: Material,
    })
    set toneMappingMaterial(value: Material) {
        if (this._settings.toneMapping.material === value) {
            return;
        }
        this._settings.toneMapping.material = value;
        if (EDITOR) {
            this._tryEnableEditorPreview();
        }
    }
    get toneMappingMaterial(): Material {
        return this._settings.toneMapping.material!;
    }
}

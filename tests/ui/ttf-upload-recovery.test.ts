import { Texture2D } from '../../cocos/asset/assets/texture-2d';
import { ImageAsset } from '../../cocos/asset/assets/image-asset';
import { SpriteFrame } from '../../cocos/2d/assets/sprite-frame';
import { TextProcessing } from '../../cocos/2d/assembler/label/text-processing';
import { TextOutputLayoutData, TextOutputRenderData } from '../../cocos/2d/assembler/label/text-output-data';
import { TextStyle } from '../../cocos/2d/assembler/label/text-style';
import { TextLayout } from '../../cocos/2d/assembler/label/text-layout';
import { TTFUtils } from '../../cocos/2d/assembler/label/ttfUtils';
import { director } from '../../cocos/game';
import type { Label } from '../../cocos/2d/components/label';
import { DEFAULT_FONT_FAMILY } from '../../cocos/2d/utils/font-family';

describe('TTF upload failure and recovery', () => {
    afterEach(() => jest.restoreAllMocks());

    test('failed upload rebuilds texture storage on retry and only updates the frame after success', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 16;
        const texture = new Texture2D();
        texture.image = new ImageAsset(canvas);
        const frame = new SpriteFrame();
        frame.texture = texture;
        const output = new TextOutputRenderData();
        output.texture = frame;
        const processing = new TextProcessing();
        processing.setCanvasUsed(canvas, {} as CanvasRenderingContext2D);
        const upload = jest.spyOn(director.root!.device, 'copyTexImagesToTextureChecked').mockReturnValue(false);
        const reset = jest.spyOn(texture, 'reset');
        const firstGpu = (texture as any)._gfxTexture;
        const destroyFirst = jest.spyOn(firstGpu, 'destroy');
        const copy = () => (processing as any)._uploadTexture(output) as boolean;
        expect(copy()).toBe(false);
        expect(destroyFirst).toHaveBeenCalledTimes(1);
        const failedGpu = (texture as any)._gfxTexture;
        const destroyFailed = jest.spyOn(failedGpu, 'destroy');
        upload.mockReturnValue(true);
        expect(copy()).toBe(true);
        expect(reset).toHaveBeenCalledTimes(2);
        expect(destroyFailed).toHaveBeenCalledTimes(1);
        expect(frame.rect.width).toBe(32);
        expect(frame.rect.height).toBe(16);
        processing.destroy();
        frame.destroy();
        texture.destroy();
    });

    test('allocation exceptions return failure and permit a later successful upload', () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 8;
        const texture = new Texture2D();
        texture.reset({ width: 8, height: 8 });
        const output = new TextOutputRenderData();
        output.texture = texture;
        const processing = new TextProcessing();
        processing.setCanvasUsed(canvas, {} as CanvasRenderingContext2D);
        jest.spyOn(texture, 'reset').mockImplementationOnce(() => { throw new Error('allocation failed'); });
        jest.spyOn(director.root!.device, 'copyTexImagesToTextureChecked').mockReturnValue(true);
        expect((processing as any)._uploadTexture(output)).toBe(false);
        expect((processing as any)._uploadTexture(output)).toBe(true);
        processing.destroy();
        texture.destroy();
    });

    test('checked SimpleTexture upload reports a missing target and preserves the legacy native call shape', () => {
        const texture = new Texture2D();
        const canvas = document.createElement('canvas');
        expect(texture.uploadDataChecked(canvas)).toBe(false);
        texture.reset({ width: 8, height: 8 });
        const legacyUpload = jest.fn();
        jest.spyOn(texture as any, '_getGFXDevice').mockReturnValue({ copyTexImagesToTexture: legacyUpload });
        expect(texture.uploadDataChecked(canvas)).toBe(true);
        expect(legacyUpload.mock.calls[0]).toHaveLength(3);
        legacyUpload.mockImplementationOnce(() => { throw new Error('native upload failed'); });
        expect(texture.uploadDataChecked(canvas)).toBe(false);
        texture.destroy();
    });

    function rendererFixture () {
        const callbacks: (() => void)[] = [];
        const utils = new TTFUtils();
        jest.spyOn(utils, 'updateProcessingData').mockImplementation(() => {});
        jest.spyOn(utils, '_updateFontFamily').mockReturnValue(DEFAULT_FONT_FAMILY);
        jest.spyOn(utils, '_resetDynamicAtlas').mockImplementation(() => {});
        const pack = jest.spyOn(utils, '_calDynamicAtlas').mockImplementation(() => {});
        jest.spyOn(utils, 'updateUVs').mockImplementation(() => {});
        const processing = TextProcessing.instance;
        jest.spyOn(processing, 'processingString').mockImplementation(() => {});
        const output = new TextOutputRenderData();
        let success = false;
        const generate = jest.spyOn(processing, 'generateRenderInfo').mockImplementation(() => {
            output.textureReady = success;
        });
        const canvas = document.createElement('canvas');
        const label = {
            renderData: { vertDirty: true, data: [], textureDirty: false },
            node: { _getUITransformComp: () => ({ setContentSize: jest.fn() }) },
            textStyle: new TextStyle(), textLayout: new TextLayout(),
            textLayoutData: new TextOutputLayoutData(), textRenderData: output,
            assemblerData: { canvas, context: {} },
            string: 'text', spriteFrame: null, isValid: true,
            scheduleOnce: jest.fn((callback: () => void) => callbacks.push(callback)),
            _markForUpdateRenderData: jest.fn(),
        } as unknown as Label;
        return { utils, label, callbacks, pack, generate, succeed: () => { success = true; } };
    }

    test('failure stays dirty, deduplicates delayed retries, and completes after recovery', () => {
        const { utils, label, callbacks, pack, succeed } = rendererFixture();
        utils.updateRenderData(label);
        utils.updateRenderData(label);
        expect(label.renderData!.vertDirty).toBe(true);
        expect(label.textRenderData.textureReady).toBe(false);
        expect(pack).not.toHaveBeenCalled();
        expect(label.scheduleOnce).toHaveBeenCalledTimes(1);
        callbacks.shift()!();
        expect(label._markForUpdateRenderData).toHaveBeenCalledTimes(1);
        succeed();
        utils.updateRenderData(label);
        expect(label.renderData!.vertDirty).toBe(false);
        expect(label.textRenderData.textureReady).toBe(true);
        expect(pack).toHaveBeenCalledTimes(1);
    });

    test('a Canvas/font exception also retries instead of completing a failed build', () => {
        const { utils, label, callbacks, generate, succeed } = rendererFixture();
        generate.mockImplementationOnce(() => { throw new Error('font canvas failed'); });
        expect(() => utils.updateRenderData(label)).not.toThrow();
        expect(label.renderData!.vertDirty).toBe(true);
        expect(label.textRenderData.textureReady).toBe(false);
        expect(callbacks).toHaveLength(1);
        callbacks.shift()!();
        succeed();
        utils.updateRenderData(label);
        expect(label.textRenderData.textureReady).toBe(true);
    });

    test('a pending retry does not regenerate a Label that has already recovered', () => {
        const { utils, label, callbacks, succeed } = rendererFixture();
        utils.updateRenderData(label);
        succeed();
        utils.updateRenderData(label);
        callbacks.shift()!();
        expect(label._markForUpdateRenderData).not.toHaveBeenCalled();
    });

    test('a retry reacquires a previously unavailable Canvas 2D context', () => {
        const { utils, label, callbacks, succeed } = rendererFixture();
        label.assemblerData!.context = null;
        const context = {} as CanvasRenderingContext2D;
        let requests = 0;
        jest.spyOn(label.assemblerData!.canvas, 'getContext').mockImplementation(
            (() => (requests++ === 0 ? null : context)) as unknown as typeof HTMLCanvasElement.prototype.getContext,
        );
        utils.updateRenderData(label);
        expect(label.assemblerData!.context).toBeNull();
        callbacks.shift()!();
        succeed();
        utils.updateRenderData(label);
        expect(label.assemblerData!.context).toBe(context);
        expect(label.textRenderData.textureReady).toBe(true);
    });

    test('a missing Canvas upgrades a pending retry to initialize resources again', () => {
        const { utils, label, callbacks, succeed } = rendererFixture();
        utils.updateRenderData(label);
        const data = label.assemblerData;
        (label as any)._assemblerData = null;
        (label as any).assemblerData = null;
        const initialize = jest.fn(() => {
            (label as any).assemblerData = data;
            succeed();
            utils.updateRenderData(label);
        });
        label.updateRenderData = initialize;
        expect(() => utils.updateRenderData(label)).not.toThrow();
        expect(label.scheduleOnce).toHaveBeenCalledTimes(1);
        expect(callbacks).toHaveLength(1);
        callbacks.shift()!();
        expect(initialize).toHaveBeenCalledWith(true);
        expect(label.textRenderData.textureReady).toBe(true);
        expect(label.renderData!.vertDirty).toBe(false);
    });
});

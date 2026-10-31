import { CanvasPool, LetterAtlas, LetterRenderTexture, shareLabelInfo } from '../../cocos/2d/assembler/label/font-utils';
import { buildFontDesc, quoteFontFamily } from '../../cocos/2d/utils/font-family';
import { ImageAsset } from '../../cocos/asset/assets/image-asset';
import { macro } from '../../cocos/core';
import { director, DirectorEvent } from '../../cocos/game/director';
import type { Device } from '../../cocos/gfx/base/device';

describe('CHAR upload recovery and canvas pooling', () => {
    const pool = CanvasPool.getInstance();
    const atlases: LetterAtlas[] = [];
    let savedPool: typeof pool.pool;
    let canvas: HTMLCanvasElement;
    let context: CanvasRenderingContext2D;
    let sequence = 0;

    function createAtlas (): LetterAtlas {
        const atlas = new LetterAtlas(64, 64);
        atlases.push(atlas);
        return atlas;
    }

    function labelInfo () {
        const fontFamily = quoteFontFamily('UploadRecovery');
        return {
            ...shareLabelInfo,
            fontFamily,
            fontDesc: buildFontDesc(12, fontFamily),
            fontSize: 12,
            fontScale: 1,
            hash: `upload-recovery-${++sequence}`,
        };
    }

    beforeEach(() => {
        savedPool = pool.pool.slice();
        pool.pool.length = 0;
        canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 8;
        context = {
            font: '',
            measureText: jest.fn(() => ({ width: 8 } as TextMetrics)),
            clearRect: jest.fn(),
            fillRect: jest.fn(),
            fillText: jest.fn(),
            strokeText: jest.fn(),
        } as unknown as CanvasRenderingContext2D;
        pool.pool.push({ canvas, context });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        for (const atlas of atlases) {
            director.off(DirectorEvent.BEFORE_SCENE_LAUNCH, atlas.beforeSceneLoad, atlas);
            atlas.destroy();
        }
        atlases.length = 0;
        pool.pool.length = 0;
        pool.pool.push(...savedPool);
    });

    test('failed upload is not cached, consumes no placement, and the successful retry is cached', () => {
        const atlas = createAtlas();
        const info = labelInfo();
        const upload = jest.spyOn(director.root!.device, 'copyTexImagesToTextureChecked').mockReturnValue(false);

        expect(atlas.getLetterDefinitionForChar('X', info)).toBeNull();
        expect(atlas.textureUploadFailed).toBe(true);
        expect(Object.keys(atlas.fontDefDictionary.letterDefinitions)).toHaveLength(0);
        expect(context.fillText).toHaveBeenCalledTimes(1);
        expect(canvas.width).toBe(1);
        expect(canvas.height).toBe(1);

        upload.mockReturnValue(true);
        atlas.beginUpdate();
        const letter = atlas.getLetterDefinitionForChar('X', info)!;
        expect(letter.valid).toBe(true);
        expect(letter.u).toBe(1);
        expect(letter.v).toBe(1);
        expect(Object.keys(atlas.fontDefDictionary.letterDefinitions)).toHaveLength(1);
        expect(atlas.getLetterDefinitionForChar('X', info)).toBe(letter);
        expect(context.fillText).toHaveBeenCalledTimes(2);
        expect(upload).toHaveBeenCalledTimes(2);
    });

    test('a failed new glyph preserves cached glyphs and does not recreate populated storage', () => {
        const atlas = createAtlas();
        const info = labelInfo();
        const upload = jest.spyOn(director.root!.device, 'copyTexImagesToTextureChecked').mockReturnValue(true);
        const first = atlas.getLetterDefinitionForChar('X', info)!;
        const texture = atlas.getTexture() as LetterRenderTexture;
        const storage = texture.getGFXTexture();
        const reallocate = jest.spyOn(LetterRenderTexture.prototype, 'initWithSize');

        upload.mockReturnValue(false);
        expect(atlas.getLetterDefinitionForChar('Y', info)).toBeNull();
        expect(atlas.getLetterDefinitionForChar('X', info)).toBe(first);
        expect(Object.keys(atlas.fontDefDictionary.letterDefinitions)).toHaveLength(1);
        upload.mockReturnValue(true);
        atlas.beginUpdate();
        const second = atlas.getLetterDefinitionForChar('Y', info)!;
        expect(second.valid).toBe(true);
        expect(second.u).toBe(first.u + 10);
        expect(second.v).toBe(first.v);
        expect(atlas.getTexture()).toBe(texture);
        expect(texture.getGFXTexture()).toBe(storage);
        expect(atlas.getLetterDefinitionForChar('X', info)).toBe(first);
        expect(reallocate).not.toHaveBeenCalled();
        expect(upload).toHaveBeenCalledTimes(3);
    });

    test('initial storage allocation exceptions recover on a later update', () => {
        const allocate = jest.spyOn(LetterRenderTexture.prototype, 'initWithSize')
            .mockImplementationOnce(() => { throw new Error('initial allocation failed'); })
            .mockImplementationOnce(() => { throw new Error('retry allocation failed'); });
        const atlas = createAtlas();
        const info = labelInfo();
        jest.spyOn(director.root!.device, 'copyTexImagesToTextureChecked').mockReturnValue(true);
        expect(atlas.textureUploadFailed).toBe(true);
        expect(atlas.getLetterDefinitionForChar('X', info)).toBeNull();
        expect(() => atlas.beginUpdate()).not.toThrow();
        expect(atlas.textureUploadFailed).toBe(true);
        atlas.beginUpdate();
        expect(atlas.textureUploadFailed).toBe(false);
        expect(atlas.getLetterDefinitionForChar('X', info)!.valid).toBe(true);
        expect(allocate).toHaveBeenCalledTimes(3);
    });

    test('scene cache recreation exceptions leave an empty atlas that can recover', () => {
        const atlas = createAtlas();
        const info = labelInfo();
        jest.spyOn(director.root!.device, 'copyTexImagesToTextureChecked').mockReturnValue(true);
        expect(atlas.getLetterDefinitionForChar('X', info)!.valid).toBe(true);
        const oldTexture = atlas.getTexture();
        const allocate = jest.spyOn(LetterRenderTexture.prototype, 'initWithSize')
            .mockImplementationOnce(() => { throw new Error('scene allocation failed'); });

        expect(() => atlas.clearAllCache()).not.toThrow();
        expect(atlas.textureUploadFailed).toBe(true);
        expect(Object.keys(atlas.fontDefDictionary.letterDefinitions)).toHaveLength(0);
        atlas.beginUpdate();
        expect(atlas.textureUploadFailed).toBe(false);
        expect(atlas.getTexture()).not.toBe(oldTexture);
        expect(atlas.getLetterDefinitionForChar('X', info)!.valid).toBe(true);
        expect(allocate).toHaveBeenCalledTimes(2);
    });

    test('missing GPU texture or device reports upload failure', () => {
        const texture = new LetterRenderTexture();
        texture.initWithSize(16, 16);
        const image = new ImageAsset(canvas);
        const gpuTexture = jest.spyOn(texture, 'getGFXTexture').mockReturnValue(null);
        const checked = jest.spyOn(director.root!.device, 'copyTexImagesToTextureChecked');
        expect(texture.drawTextureAt(image, 0, 0)).toBe(false);
        expect(checked).not.toHaveBeenCalled();
        gpuTexture.mockRestore();
        const device = jest.spyOn(texture as unknown as { _getGFXDevice(): Device | null }, '_getGFXDevice').mockReturnValue(null);
        expect(texture.drawTextureAt(image, 0, 0)).toBe(false);
        expect(checked).not.toHaveBeenCalled();
        device.mockRestore();
        texture.destroy();
        image.destroy();
    });

    test('devices without the checked method keep the native upload ABI and catch exceptions', () => {
        const texture = new LetterRenderTexture();
        texture.initWithSize(16, 16);
        const image = new ImageAsset(canvas);
        const copy = jest.fn();
        const device = jest.spyOn(texture as unknown as { _getGFXDevice(): Device | null }, '_getGFXDevice')
            .mockReturnValue({ copyTexImagesToTexture: copy } as unknown as Device);
        expect(texture.drawTextureAt(image, 0, 0)).toBe(true);
        expect(copy.mock.calls[0]).toHaveLength(3);
        copy.mockImplementationOnce(() => { throw new Error('native upload failed'); });
        expect(texture.drawTextureAt(image, 0, 0)).toBe(false);
        device.mockRestore();
        texture.destroy();
        image.destroy();
    });

    test('returning a canvas shrinks its backing store before reuse', () => {
        const data = pool.get();
        data.canvas.width = 2048;
        data.canvas.height = 1024;
        pool.put(data);
        expect(data.canvas.width).toBe(1);
        expect(data.canvas.height).toBe(1);
        expect(pool.get()).toBe(data);
    });

    test('a pooled Canvas retries acquiring a previously unavailable 2D context', () => {
        const data = pool.get();
        data.context = null;
        let requests = 0;
        jest.spyOn(data.canvas, 'getContext').mockImplementation(
            (() => (requests++ === 0 ? null : context)) as unknown as typeof HTMLCanvasElement.prototype.getContext,
        );
        pool.put(data);
        expect(pool.get().context).toBeNull();
        pool.put(data);
        expect(pool.get().context).toBe(context);
        expect(requests).toBe(2);
    });

    test('a canvas discarded because the pool is full is also shrunk', () => {
        const data = pool.get();
        data.canvas.width = 2048;
        data.canvas.height = 2048;
        const previousLimit = macro.MAX_LABEL_CANVAS_POOL_SIZE;
        try {
            macro.MAX_LABEL_CANVAS_POOL_SIZE = 0;
            pool.put(data);
            expect(data.canvas.width).toBe(1);
            expect(data.canvas.height).toBe(1);
            expect(pool.pool).toHaveLength(0);
        } finally {
            macro.MAX_LABEL_CANVAS_POOL_SIZE = previousLimit;
        }
    });

    test('a Canvas resize exception does not interrupt cleanup or poison the pool', () => {
        pool.get();
        const unusable = {
            set width (_value: number) { throw new Error('Canvas backing store unavailable'); },
            height: 8,
        } as HTMLCanvasElement;
        expect(() => pool.put({ canvas: unusable, context: null })).not.toThrow();
        expect(pool.pool).toHaveLength(0);
    });
});

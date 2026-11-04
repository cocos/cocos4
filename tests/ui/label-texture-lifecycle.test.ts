import { Label, CacheMode } from '../../cocos/2d/components/label';
import { BitmapFont } from '../../cocos/2d/assets/bitmap-font';
import { SpriteFrame } from '../../cocos/2d/assets/sprite-frame';
import { TTFFont } from '../../cocos/2d/assets/ttf-font';
import { Texture2D } from '../../cocos/asset/assets/texture-2d';
import { CanvasPool, LetterRenderTexture } from '../../cocos/2d/assembler/label/font-utils';
import { TTFUtils } from '../../cocos/2d/assembler/label/ttfUtils';
import { TextProcessing } from '../../cocos/2d/assembler/label/text-processing';
import { UIRenderer } from '../../cocos/2d/framework/ui-renderer';
import { dynamicAtlasManager } from '../../cocos/2d/utils/dynamic-atlas/atlas-manager';
import { Node } from '../../cocos/scene-graph/node';
import { director } from '../../cocos/game';

// Exercise the real Label, SpriteFrame and Texture2D ownership paths on the
// headless GFX device. Rasterization and vertex buffers are outside these tests.
describe('Label text texture ownership', () => {
    const pool = CanvasPool.getInstance();
    const savedAssembler = Label.Assembler;
    let savedCanvases: typeof pool.pool;
    let savedAtlases: unknown;
    let savedAtlasIndex: number;
    let sharedCharTexture: LetterRenderTexture;
    let labels: Label[];
    let put: jest.SpyInstance;

    beforeEach(() => {
        labels = [];
        savedCanvases = pool.pool.splice(0);
        savedAtlases = (dynamicAtlasManager as any)._atlases;
        savedAtlasIndex = (dynamicAtlasManager as any)._atlasIndex;
        (dynamicAtlasManager as any)._atlases = [];
        (dynamicAtlasManager as any)._atlasIndex = -1;
        jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
            (() => ({})) as unknown as typeof HTMLCanvasElement.prototype.getContext,
        );
        put = jest.spyOn(pool, 'put');
        jest.spyOn(UIRenderer.prototype, 'destroyRenderData').mockImplementation(function (this: UIRenderer) {
            (this as any)._renderData = null;
        });
        jest.spyOn(Label.prototype as any, '_updateColor').mockImplementation(() => {});
        jest.spyOn(Label.prototype, '_markForUpdateRenderData').mockImplementation(() => {});
        jest.spyOn(Label.prototype as any, 'changeMaterialForDefine').mockImplementation(() => {});
        jest.spyOn(director.root!, 'batcher2D', 'get').mockReturnValue({
            _releaseDescriptorSetCache: jest.fn(),
        } as any);

        sharedCharTexture = new LetterRenderTexture();
        sharedCharTexture.initWithSize(64, 64);
        sharedCharTexture.addRef(); // The shared atlas owns its texture independently of each Label.
        const createData = () => ({ material: null, vertDirty: true });
        const ttf = {
            createData,
            getAssemblerData: () => TTFUtils.prototype.getAssemblerData.call(ttf),
            resetAssemblerData: TTFUtils.prototype.resetAssemblerData,
            updateRenderData: () => {},
        };
        const letter = { createData, getAssemblerData: () => sharedCharTexture, updateRenderData: () => {} };
        const bitmap = { createData, updateRenderData: () => {} };
        Label.Assembler = {
            getAssembler: (comp: Label) => (comp.font instanceof BitmapFont ? bitmap
                : comp.cacheMode === CacheMode.CHAR ? letter : ttf),
        } as unknown as typeof Label.Assembler;
    });

    afterEach(() => {
        labels.forEach((label) => label.onDestroy());
        sharedCharTexture.destroy();
        Label.Assembler = savedAssembler;
        (dynamicAtlasManager as any)._atlases = savedAtlases;
        (dynamicAtlasManager as any)._atlasIndex = savedAtlasIndex;
        pool.pool.length = 0;
        pool.pool.push(...savedCanvases);
        jest.restoreAllMocks();
    });

    function createLabel(mode = CacheMode.NONE): Label {
        const label = new Label();
        label.node = new Node();
        (label as any)._cacheMode = mode;
        label.updateRenderData(true);
        labels.push(label);
        return label;
    }

    test.each([CacheMode.NONE, CacheMode.BITMAP])('repeated %s -> CHAR -> TTF releases old textures and returns each Canvas once', (mode) => {
        const label = createLabel(mode);
        const release = jest.spyOn(director.root!.batcher2D, '_releaseDescriptorSetCache');
        const destroyShared = jest.spyOn(sharedCharTexture, 'destroy');
        for (let i = 0; i < 3; ++i) {
            const oldFrame = label.ttfSpriteFrame!;
            const oldTexture = oldFrame.texture as Texture2D;
            const oldData = label.assemblerData!;
            const destroyGpu = jest.spyOn((oldTexture as any)._gfxTexture, 'destroy');
            const destroyTexture = jest.spyOn(oldTexture, 'destroy');
            const destroyImage = jest.spyOn(oldTexture.image!, 'destroy');

            label.cacheMode = CacheMode.CHAR;
            expect(destroyTexture).toHaveBeenCalledTimes(1);
            expect(destroyGpu).toHaveBeenCalledTimes(1);
            expect(destroyImage).toHaveBeenCalledTimes(1);
            expect(release).toHaveBeenCalledWith(oldTexture.getHash());
            expect(label.ttfSpriteFrame).toBeNull();
            expect(label.assemblerData).toBeNull();
            expect(put.mock.calls.filter(([data]) => data === oldData)).toHaveLength(i + 1);

            label.cacheMode = mode;
            expect(label.ttfSpriteFrame).not.toBe(oldFrame);
            expect(label.assemblerData).toBe(oldData); // The returned Canvas is reused.
            expect(destroyShared).not.toHaveBeenCalled();
        }
        expect(put).toHaveBeenCalledTimes(3);
        label.onDestroy();
        expect(put).toHaveBeenCalledTimes(4);
    });

    test('changing TTF fonts and NONE/BITMAP modes reuses the owned texture', () => {
        const label = createLabel();
        const frame = label.ttfSpriteFrame!;
        const destroyTexture = jest.spyOn(frame.texture, 'destroy');
        label.font = new TTFFont();
        label.cacheMode = CacheMode.BITMAP;
        label.cacheMode = CacheMode.NONE;
        expect(label.ttfSpriteFrame).toBe(frame);
        expect(destroyTexture).not.toHaveBeenCalled();
        expect(put).not.toHaveBeenCalled();
    });

    test('switching to a BitmapFont releases TTF resources without destroying the font asset texture', () => {
        const label = createLabel();
        const oldTexture = label.ttfSpriteFrame!.texture;
        const destroyOld = jest.spyOn(oldTexture, 'destroy');
        const font = new BitmapFont();
        const bitmapTexture = new Texture2D();
        bitmapTexture.reset({ width: 8, height: 8 });
        font.spriteFrame = new SpriteFrame();
        font.spriteFrame.texture = bitmapTexture;
        const destroyBitmap = jest.spyOn(bitmapTexture, 'destroy');

        label.font = font;
        expect(destroyOld).toHaveBeenCalledTimes(1);
        expect(label.ttfSpriteFrame).toBeNull();
        expect(label.assemblerData).toBeNull();
        expect(put).toHaveBeenCalledTimes(1);
        label.onDestroy();
        expect(destroyBitmap).not.toHaveBeenCalled();
        font.spriteFrame.destroy();
        bitmapTexture.destroy();
    });

    test('destroying before onLoad releases the Canvas and GPU texture without returning the Canvas twice', () => {
        const label = createLabel();
        const destroyTexture = jest.spyOn(label.ttfSpriteFrame!.texture, 'destroy');
        label._onPreDestroy();
        label.onDestroy();
        expect(destroyTexture).toHaveBeenCalledTimes(1);
        expect(put).toHaveBeenCalledTimes(1);
        expect(label.assemblerData).toBeNull();
    });

    test('switching CHAR to BitmapFont drops only the Label reference to the shared character atlas', () => {
        const label = createLabel(CacheMode.CHAR);
        const destroyShared = jest.spyOn(sharedCharTexture, 'destroy');
        expect(sharedCharTexture.refCount).toBe(2);
        label.font = new BitmapFont();
        expect(sharedCharTexture.refCount).toBe(1);
        expect(destroyShared).not.toHaveBeenCalled();
        label.onDestroy();
        expect(sharedCharTexture.refCount).toBe(1);
    });

    test('an unsuccessful text upload prevents drawing until a retry succeeds', () => {
        const label = createLabel();
        label.string = 'pending upload';
        jest.spyOn(UIRenderer.prototype as any, '_canRender').mockReturnValue(true);
        label.textRenderData.textureReady = false;
        expect((label as any)._canRender()).toBe(false);
        label.textRenderData.textureReady = true;
        expect((label as any)._canRender()).toBe(true);
    });

    test('an initial image allocation exception keeps a texture attached so a later upload can rebuild it', () => {
        jest.spyOn(Texture2D.prototype as any, '_createTexture').mockImplementationOnce(() => {
            throw new Error('initial texture allocation failed');
        });
        const label = createLabel();
        const frame = label.ttfSpriteFrame!;
        const texture = frame.texture as Texture2D;
        expect(texture).toBeInstanceOf(Texture2D);
        expect(label.textRenderData.textureReady).toBe(false);
        expect(texture.getGFXTexture()).toBeNull();
        const data = label.assemblerData!;
        label.updateRenderData(true);
        expect(label.ttfSpriteFrame).toBe(frame);
        expect(frame.texture).toBe(texture);
        TextProcessing.instance.setCanvasUsed(data.canvas, data.context);
        expect((TextProcessing.instance as any)._uploadTexture({ texture: frame })).toBe(true);
        expect(texture.getGFXTexture()).not.toBeNull();
        expect(frame.rect.width).toBe(data.canvas.width);
        expect(frame.rect.height).toBe(data.canvas.height);
        expect(put).not.toHaveBeenCalled();
    });

    test('an initial Canvas creation exception retries initialization without retaining a partial frame', () => {
        const label = new Label();
        label.node = new Node();
        labels.push(label);
        const callbacks: (() => void)[] = [];
        jest.spyOn(label, 'scheduleOnce').mockImplementation((callback: () => void) => { callbacks.push(callback); });
        const createElement = document.createElement.bind(document);
        let failed = false;
        jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
            if (tag === 'canvas' && !failed) {
                failed = true;
                throw new Error('initial Canvas allocation failed');
            }
            return createElement(tag);
        }) as typeof document.createElement);

        expect(() => label.updateRenderData(true)).not.toThrow();
        expect(label.textRenderData.textureReady).toBe(false);
        expect(label.ttfSpriteFrame).toBeNull();
        expect(label.assemblerData).toBeNull();
        expect(callbacks).toHaveLength(1);
        expect(put).not.toHaveBeenCalled();

        callbacks.shift()!();
        const frame = label.ttfSpriteFrame!;
        expect(frame).toBeInstanceOf(SpriteFrame);
        const texture = frame.texture as Texture2D;
        expect(texture.getGFXTexture()).not.toBeNull();
        expect(label.assemblerData).not.toBeNull();
        const destroy = jest.spyOn(texture, 'destroy');
        label.onDestroy();
        expect(destroy).toHaveBeenCalledTimes(1);
        expect(put).toHaveBeenCalledTimes(1);
    });

    function packFrame(label: Label) {
        const frame = label.ttfSpriteFrame!;
        const source = frame.texture as Texture2D;
        const atlasTexture = new Texture2D();
        atlasTexture.reset({ width: 64, height: 64 });
        frame._setDynamicAtlasFrame({ texture: atlasTexture, x: 2, y: 2 });
        const events: string[] = [];
        (dynamicAtlasManager as any)._atlases = [{
            removeSpriteFrame: (removed: SpriteFrame) => {
                expect(removed.original!._texture).toBe(source);
                events.push('remove');
            },
            deleteInnerTexture: (texture: Texture2D) => {
                expect(texture).toBe(source);
                events.push('delete source');
            },
            isEmpty: () => false,
        }];
        const reset = frame._resetDynamicAtlasFrame.bind(frame);
        jest.spyOn(frame, '_resetDynamicAtlasFrame').mockImplementation(() => { events.push('reset'); reset(); });
        return { frame, source, atlasTexture, events };
    }

    test('destroying a packed TTF removes its atlas entry before restoring and destroying the source texture', () => {
        const label = createLabel(CacheMode.BITMAP);
        const { frame, source, atlasTexture, events } = packFrame(label);
        const destroySource = jest.spyOn(source, 'destroy');
        const destroyAtlas = jest.spyOn(atlasTexture, 'destroy');
        const destroyFrame = frame.destroy.bind(frame);
        jest.spyOn(frame, 'destroy').mockImplementation(() => { events.push('destroy frame'); return destroyFrame(); });
        label.onDestroy();
        expect(events).toEqual(['remove', 'delete source', 'reset', 'destroy frame']);
        expect(destroySource).toHaveBeenCalledTimes(1);
        expect(destroyAtlas).not.toHaveBeenCalled();
        atlasTexture.destroy();
    });

    test('leaving BITMAP unregisters the atlas entry while retaining the TTF texture for NONE', () => {
        const label = createLabel(CacheMode.BITMAP);
        const { frame, source, atlasTexture, events } = packFrame(label);
        const destroySource = jest.spyOn(source, 'destroy');
        label.cacheMode = CacheMode.NONE;
        expect(events).toEqual(['remove', 'delete source', 'reset']);
        expect(label.ttfSpriteFrame).toBe(frame);
        expect(frame.texture).toBe(source);
        expect(destroySource).not.toHaveBeenCalled();
        expect(put).not.toHaveBeenCalled();
        atlasTexture.destroy();
    });
});

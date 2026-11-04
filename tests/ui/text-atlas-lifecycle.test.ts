import { BitmapFont } from '../../cocos/2d/assets/bitmap-font';
import { SpriteFrame } from '../../cocos/2d/assets/sprite-frame';
import { Atlas, DynamicAtlasTexture } from '../../cocos/2d/utils/dynamic-atlas/atlas';
import { dynamicAtlasManager } from '../../cocos/2d/utils/dynamic-atlas/atlas-manager';
import { ImageAsset, Texture2D } from '../../cocos/asset/assets';
import { director } from '../../cocos/game';
import { assets } from '../../cocos/asset/asset-manager/shared';
import dependUtil from '../../cocos/asset/asset-manager/depend-util';
import { releaseManager } from '../../cocos/asset/asset-manager/release-manager';

function createFrame (width = 16, height = 16): SpriteFrame {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const texture = new Texture2D();
    texture.image = new ImageAsset(canvas);
    const frame = new SpriteFrame();
    frame.texture = texture;
    frame.packable = true;
    return frame;
}

describe('text atlas resource lifetime and upload failure', () => {
    let originalEnabled: boolean;
    let originalSize: number;
    let originalCount: number;
    let originalBleeding: boolean;
    let trackedAssets: Array<BitmapFont | SpriteFrame | Texture2D | ImageAsset>;
    let graphId = 0;

    beforeEach(() => {
        trackedAssets = [];
        originalEnabled = dynamicAtlasManager.enabled;
        originalSize = dynamicAtlasManager.textureSize;
        originalCount = dynamicAtlasManager.maxAtlasCount;
        originalBleeding = dynamicAtlasManager.textureBleeding;
        dynamicAtlasManager.reset();
        dynamicAtlasManager.enabled = true;
        dynamicAtlasManager.textureSize = 64;
        dynamicAtlasManager.maxAtlasCount = 2;
        dynamicAtlasManager.textureBleeding = false;
    });

    afterEach(() => {
        (releaseManager as any)._freeAssets();
        for (const asset of trackedAssets) {
            assets.remove(asset._uuid);
            dependUtil.remove(asset._uuid);
            asset.destroy();
        }
        jest.restoreAllMocks();
        dynamicAtlasManager.reset();
        dynamicAtlasManager.enabled = originalEnabled;
        dynamicAtlasManager.textureSize = originalSize;
        dynamicAtlasManager.maxAtlasCount = originalCount;
        dynamicAtlasManager.textureBleeding = originalBleeding;
    });

    test('BitmapFont releases its extra texture reference on every load/destroy cycle', () => {
        const frame = createFrame();
        const texture = frame.texture;
        texture.addRef(); // A separate owner must survive destruction of each font.
        const destroy = jest.spyOn(texture, 'destroy');
        for (let i = 0; i < 100; ++i) {
            const font = new BitmapFont();
            font.spriteFrame = frame;
            font.fntConfig = { fontDefDictionary: {} };
            font.onLoaded();
            expect(texture.refCount).toBe(2);
            font.destroy();
            expect(texture.refCount).toBe(1);
            (releaseManager as any)._freeAssets();
        }
        expect(destroy).not.toHaveBeenCalled();
        texture.decRef(false);
        texture.destroy();
        frame.destroy();
    });

    test('BitmapFont schedules its last texture reference for normal asset release', () => {
        const frame = createFrame();
        const texture = frame.texture;
        const destroy = jest.spyOn(texture, 'destroy');
        const font = new BitmapFont();
        font.spriteFrame = frame;
        font.fntConfig = { fontDefDictionary: {} };
        font.onLoaded();
        expect(texture.refCount).toBe(1);
        font.destroy();
        expect(texture.refCount).toBe(0);
        expect(destroy).not.toHaveBeenCalled();
        (releaseManager as any)._freeAssets();
        expect(destroy).toHaveBeenCalledTimes(1);
        frame.destroy();
    });

    function createLoadedFontGraph () {
        const frame = createFrame();
        const texture = frame.texture as Texture2D;
        const image = texture.image!;
        const font = new BitmapFont();
        const prefix = `bitmap-font-lifetime-${++graphId}`;
        font.spriteFrame = frame;
        font.fntConfig = { fontDefDictionary: {} };
        font.onLoaded();
        // Mirror dependency references added by the asset deserializer. The
        // FontAtlas's extra texture reference is separate from this graph.
        frame.addRef();
        texture.addRef();
        image.addRef();
        const graph = [font, frame, texture, image];
        graph.forEach((asset, index) => {
            asset._uuid = `${prefix}-${index}`;
            assets.add(asset._uuid, asset);
            trackedAssets.push(asset);
        });
        dependUtil._depends.add(font._uuid, { deps: [frame._uuid] });
        dependUtil._depends.add(frame._uuid, { deps: [texture._uuid] });
        dependUtil._depends.add(texture._uuid, { deps: [image._uuid] });
        dependUtil._depends.add(image._uuid, { deps: [] });
        return { font, frame, texture, image, graph };
    }

    test('releasing a loaded BitmapFont removes its texture and image from the asset cache and dependency graph', () => {
        const { font, texture, graph } = createLoadedFontGraph();
        const destroyTexture = jest.spyOn(texture, 'destroy');
        releaseManager.tryRelease(font, true);
        expect(texture.refCount).toBe(0);
        expect(texture.getGFXTexture()).not.toBeNull();
        expect(destroyTexture).not.toHaveBeenCalled();
        (releaseManager as any)._freeAssets();
        expect(destroyTexture).toHaveBeenCalledTimes(1);
        expect(texture.getGFXTexture()).toBeNull();
        for (const asset of graph) {
            expect(assets.has(asset._uuid)).toBe(false);
            expect(dependUtil._depends.has(asset._uuid)).toBe(false);
        }
    });

    test('releasing a loaded BitmapFont preserves another owner of its texture until that owner releases it', () => {
        const { font, texture, image, graph } = createLoadedFontGraph();
        texture.addRef();
        const destroyTexture = jest.spyOn(texture, 'destroy');
        releaseManager.tryRelease(font, true);
        (releaseManager as any)._freeAssets();
        expect(texture.refCount).toBe(1);
        expect(destroyTexture).not.toHaveBeenCalled();
        expect(texture.getGFXTexture()).not.toBeNull();
        expect(assets.get(texture._uuid)).toBe(texture);
        expect(assets.get(image._uuid)).toBe(image);
        texture.decRef();
        (releaseManager as any)._freeAssets();
        expect(destroyTexture).toHaveBeenCalledTimes(1);
        for (const asset of graph) {
            expect(assets.has(asset._uuid)).toBe(false);
            expect(dependUtil._depends.has(asset._uuid)).toBe(false);
        }
    });

    test('a BitmapFont loaded after its frame is packed owns the source texture and preserves the shared atlas', () => {
        const frame = createFrame();
        const otherFrame = createFrame();
        const source = frame.texture;
        const otherSource = otherFrame.texture;
        source.addRef(); // An existing source asset owner survives the font.
        jest.spyOn(director.root!.device, 'copyTexImagesToTextureChecked').mockReturnValue(true);
        dynamicAtlasManager.packToDynamicAtlas(null, frame);
        dynamicAtlasManager.packToDynamicAtlas(null, otherFrame);
        const packedTexture = frame.texture;
        expect(packedTexture).not.toBe(source);
        expect(otherFrame.texture).toBe(packedTexture);
        const storage = packedTexture.getGFXTexture();
        const destroyAtlas = jest.spyOn(packedTexture, 'destroy');
        const font = new BitmapFont();
        font.spriteFrame = frame;
        font.fntConfig = { fontDefDictionary: {} };
        font.onLoaded();
        expect(font.fontDefDictionary.texture).toBe(source);
        expect(source.refCount).toBe(2);

        font.destroy();
        (releaseManager as any)._freeAssets();
        expect(source.refCount).toBe(1);
        expect(destroyAtlas).not.toHaveBeenCalled();
        expect(packedTexture.getGFXTexture()).toBe(storage);
        expect(packedTexture.getGFXTexture()).not.toBeNull();
        expect(otherFrame.texture.getGFXTexture()).toBe(storage);
        expect(dynamicAtlasManager.atlasCount).toBe(1);

        dynamicAtlasManager.reset();
        source.decRef(false);
        source.destroy();
        otherSource.destroy();
        frame.destroy();
        otherFrame.destroy();
    });

    test('failed upload leaves space and cache available, then retries successfully', () => {
        const atlas = new Atlas(64, 64);
        const frame = createFrame();
        const upload = jest.spyOn(director.root!.device, 'copyTexImagesToTextureChecked').mockReturnValue(false);
        const reallocate = jest.spyOn(DynamicAtlasTexture.prototype, 'initWithSize');

        expect(atlas.insertSpriteFrame(frame)).toBeNull();
        expect(atlas.textureUploadFailed).toBe(true);
        expect(atlas.isEmpty()).toBe(true);

        upload.mockReturnValue(true);
        const packed = atlas.insertSpriteFrame(frame);
        expect(packed).not.toBeNull();
        expect(packed!.x).toBe(2);
        expect(packed!.y).toBe(2);
        expect(atlas.textureUploadFailed).toBe(false);
        expect(atlas.isEmpty()).toBe(false);
        expect(upload).toHaveBeenCalledTimes(2);
        expect(reallocate).toHaveBeenCalledTimes(1);
        atlas.destroy();
        frame.texture.destroy();
        frame.destroy();
    });

    test('allocation exceptions leave an empty atlas available for a later retry', () => {
        const allocate = jest.spyOn(DynamicAtlasTexture.prototype, 'initWithSize')
            .mockImplementationOnce(() => { throw new Error('allocation failed'); })
            .mockImplementationOnce(() => { throw new Error('allocation failed again'); });
        const atlas = new Atlas(64, 64);
        const frame = createFrame();
        jest.spyOn(director.root!.device, 'copyTexImagesToTextureChecked').mockReturnValue(true);
        expect(atlas.textureUploadFailed).toBe(true);
        expect(atlas.insertSpriteFrame(frame)).toBeNull();
        expect(atlas.textureUploadFailed).toBe(true);
        expect(atlas.isEmpty()).toBe(true);
        expect(atlas.insertSpriteFrame(frame)).not.toBeNull();
        expect(atlas.textureUploadFailed).toBe(false);
        expect(allocate).toHaveBeenCalledTimes(3);
        atlas.destroy();
        frame.texture.destroy();
        frame.destroy();
    });

    test('failure on a populated atlas preserves existing storage and does not consume placement', () => {
        const atlas = new Atlas(64, 64);
        const first = createFrame();
        const second = createFrame();
        const upload = jest.spyOn(director.root!.device, 'copyTexImagesToTextureChecked').mockReturnValue(true);
        const original = atlas.insertSpriteFrame(first)!;
        const reallocate = jest.spyOn(DynamicAtlasTexture.prototype, 'initWithSize');

        upload.mockReturnValue(false);
        expect(atlas.insertSpriteFrame(second)).toBeNull();
        upload.mockReturnValue(true);
        const retried = atlas.insertSpriteFrame(second)!;
        expect(retried.texture).toBe(original.texture);
        expect(retried.x).toBe(original.x + first.texture.width + 2);
        expect(retried.y).toBe(original.y);
        expect(reallocate).not.toHaveBeenCalled();
        atlas.destroy();
        first.texture.destroy();
        first.destroy();
        second.texture.destroy();
        second.destroy();
    });

    test('silent bleeding GL errors are detected by the final checked upload and leave the entry retryable', () => {
        dynamicAtlasManager.textureBleeding = true;
        const atlas = new Atlas(64, 64);
        const frame = createFrame(8, 8);
        let pendingError = false;
        const bleedingUpload = jest.spyOn(director.root!.device, 'copyTexImagesToTexture')
            .mockImplementationOnce(() => { pendingError = true; }).mockImplementation(() => {});
        const upload = jest.spyOn(director.root!.device, 'copyTexImagesToTextureChecked').mockImplementation(() => {
            const succeeded = !pendingError;
            pendingError = false;
            return succeeded;
        });

        expect(atlas.insertSpriteFrame(frame)).toBeNull();
        expect(atlas.isEmpty()).toBe(true);
        expect(bleedingUpload).toHaveBeenCalledTimes(8);
        expect(upload).toHaveBeenCalledTimes(1);
        const packed = atlas.insertSpriteFrame(frame)!;
        expect(packed.x).toBe(2);
        expect(packed.y).toBe(2);
        expect(bleedingUpload).toHaveBeenCalledTimes(16);
        expect(upload).toHaveBeenCalledTimes(2);
        atlas.destroy();
        frame.texture.destroy();
        frame.destroy();
    });

    test('successful bleeding uses one checked upload for the whole transaction', () => {
        dynamicAtlasManager.textureBleeding = true;
        const atlas = new Atlas(64, 64);
        const frame = createFrame(8, 8);
        const bleedingUpload = jest.spyOn(director.root!.device, 'copyTexImagesToTexture').mockImplementation(() => {});
        const checkedUpload = jest.spyOn(director.root!.device, 'copyTexImagesToTextureChecked').mockReturnValue(true);

        expect(atlas.insertSpriteFrame(frame)).not.toBeNull();
        expect(bleedingUpload).toHaveBeenCalledTimes(8);
        expect(checkedUpload).toHaveBeenCalledTimes(1);
        atlas.destroy();
        frame.texture.destroy();
        frame.destroy();
    });

    test('synchronous bleeding exceptions abort without committing placement or cache', () => {
        dynamicAtlasManager.textureBleeding = true;
        const atlas = new Atlas(64, 64);
        const frame = createFrame(8, 8);
        const bleedingUpload = jest.spyOn(director.root!.device, 'copyTexImagesToTexture')
            .mockImplementationOnce(() => {})
            .mockImplementationOnce(() => { throw new Error('bleeding upload failed'); })
            .mockImplementation(() => {});
        const checkedUpload = jest.spyOn(director.root!.device, 'copyTexImagesToTextureChecked').mockReturnValue(true);

        expect(atlas.insertSpriteFrame(frame)).toBeNull();
        expect(atlas.isEmpty()).toBe(true);
        expect(bleedingUpload).toHaveBeenCalledTimes(2);
        expect(checkedUpload).not.toHaveBeenCalled();
        const packed = atlas.insertSpriteFrame(frame)!;
        expect(packed.x).toBe(2);
        expect(packed.y).toBe(2);
        expect(bleedingUpload).toHaveBeenCalledTimes(10);
        expect(checkedUpload).toHaveBeenCalledTimes(1);
        atlas.destroy();
        frame.texture.destroy();
        frame.destroy();
    });

    test('upload failure does not open more pages or permanently exhaust the manager', () => {
        const frame = createFrame();
        const upload = jest.spyOn(director.root!.device, 'copyTexImagesToTextureChecked').mockReturnValue(false);
        for (let i = 0; i < 5; ++i) {
            dynamicAtlasManager.packToDynamicAtlas(null, frame);
            expect(dynamicAtlasManager.atlasCount).toBe(1);
            expect(frame.original).toBeNull();
        }
        upload.mockReturnValue(true);
        dynamicAtlasManager.packToDynamicAtlas(null, frame);
        expect(frame.original).not.toBeNull();
        dynamicAtlasManager.deleteAtlasSpriteFrame(frame);
        frame._resetDynamicAtlasFrame();
        frame.texture.destroy();
        frame.destroy();
    });

    test('reset clears occupancy and repeated insertion does not retain duplicate frame entries', () => {
        const atlas = new Atlas(64, 64);
        const frame = createFrame();
        jest.spyOn(director.root!.device, 'copyTexImagesToTextureChecked').mockReturnValue(true);
        atlas.insertSpriteFrame(frame);
        atlas.insertSpriteFrame(frame);
        atlas.removeSpriteFrame(frame);
        const resetFrame = jest.spyOn(frame, '_resetDynamicAtlasFrame');
        atlas.reset();
        expect(resetFrame).not.toHaveBeenCalled();
        expect(atlas.isEmpty()).toBe(true);
        atlas.destroy();
        frame.texture.destroy();
        frame.destroy();
    });
});

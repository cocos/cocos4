import { ImageAsset } from "../../cocos/asset/assets/image-asset";
import { Texture2D } from "../../cocos/asset/assets/texture-2d";
import { dependMap } from "../../cocos/asset/asset-manager/depend-maps";
import dependUtil from "../../cocos/asset/asset-manager/depend-util";
import { setProperties } from "../../cocos/asset/asset-manager/utilities";
import { macro } from "../../cocos/core";
import { Details } from "../../cocos/serialization/deserialize";

const textureUuid = 'f41e5c8f-0e9a-4c38-bb1d-texture2d';

function createImageAsset (uuid: string): ImageAsset {
    const image = new ImageAsset({
        _data: new Uint8Array(4),
        width: 1,
        height: 1,
    });
    image._uuid = uuid;
    return image;
}

function setTextureProperties (texture: Texture2D, images: ImageAsset[]): void {
    const depends = [];
    const assetsMap: Record<string, ImageAsset> = Object.create(null);
    texture._uuid = textureUuid;

    for (let i = 0; i < images.length; ++i) {
        const image = images[i];
        depends.push({ uuid: image._uuid, owner: texture, prop: '_textureSource' });
        depends.push({ uuid: image._uuid, owner: texture._mipmaps, prop: `${i}` });
        assetsMap[`${image._uuid}@import`] = image;
    }

    dependMap.set(texture, depends);
    dependUtil._depends.add(textureUuid, { deps: depends.map((depend) => depend.uuid) });
    setProperties(textureUuid, texture, assetsMap);
}

// issue: https://github.com/cocos/cocos-engine/issues/16693
test('Texture2D serialize', function () {
    const texture = new Texture2D();
    texture._mipmaps = [{ _uuid: '09f4f3e7-268b-478c-a7af-bbdf574ec3c6@6c48a' }];
    const ctxForExporting = {
        _depends: [] as string[],
        dependsOn(propName: string, uuid: string) {
            this._depends.push(propName, uuid);
        },
        _compressUuid: this.mustCompresseUuid,
    };
    texture._serialize(ctxForExporting);
    expect(ctxForExporting._depends).toEqual(['_textureSource', '09f4f3e7-268b-478c-a7af-bbdf574ec3c6@6c48a']);
});

test('Texture2D deserialize', function () {
    const data = { base: '2,2,2,2,0,0', mipmaps: ['09f4f3e7-268b-478c-a7af-bbdf574ec3c6'] };
    const result = new Details();
    result.init();
    const handle = { result };
    const texture = new Texture2D();
    texture._deserialize(data, handle);
    expect(handle.result.uuidList).toEqual(['09f4f3e7-268b-478c-a7af-bbdf574ec3c6']);
});

describe('Texture2D image dependency cleanup', () => {
    const originalCleanupImageCache = macro.CLEANUP_IMAGE_CACHE;

    afterEach(() => {
        macro.CLEANUP_IMAGE_CACHE = originalCleanupImageCache;
        dependUtil.remove(textureUuid);
    });

    test('releases every Texture2D dependency edge for the image after upload', () => {
        macro.CLEANUP_IMAGE_CACHE = true;
        const texture = new Texture2D();
        const image = createImageAsset('6d35c119-b763-4295-96e7-image');
        const addRefCounts: number[] = [];
        const decRefCounts: Array<{ autoRelease: boolean; refCount: number }> = [];
        const addRef = image.addRef;
        const decRef = image.decRef;

        jest.spyOn(image, 'addRef').mockImplementation(() => {
            const result = addRef.call(image);
            addRefCounts.push(image.refCount);
            return result;
        });
        jest.spyOn(image, 'decRef').mockImplementation((autoRelease = true) => {
            const result = decRef.call(image, autoRelease);
            decRefCounts.push({ autoRelease, refCount: image.refCount });
            return result;
        });

        setTextureProperties(texture, [image]);
        expect(addRefCounts).toEqual([1, 2]);

        texture.onLoaded();

        expect(decRefCounts).toEqual([
            { autoRelease: true, refCount: 1 },
            { autoRelease: true, refCount: 0 },
        ]);
        expect(dependUtil.getDeps(textureUuid)).toEqual([]);
    });

    test('balances repeated preload and mipmap edges for the same image', () => {
        macro.CLEANUP_IMAGE_CACHE = true;
        const texture = new Texture2D();
        const image = createImageAsset('3413ce1f-cf7c-41b2-a5f0-repeated');

        setTextureProperties(texture, [image, image]);
        expect(image.refCount).toBe(4);

        texture.onLoaded();

        expect(image.refCount).toBe(0);
        expect(dependUtil.getDeps(textureUuid)).toEqual([]);
    });

    test('preserves all dependencies when image cache cleanup is disabled', () => {
        macro.CLEANUP_IMAGE_CACHE = false;
        const texture = new Texture2D();
        const image = createImageAsset('b4f8763f-e42f-48b5-a2ee-disabled');

        setTextureProperties(texture, [image]);
        texture.onLoaded();

        expect(image.refCount).toBe(2);
        expect(dependUtil.getDeps(textureUuid)).toEqual([image._uuid, image._uuid]);
    });
});

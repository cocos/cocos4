import { SpriteFrame } from '../../cocos/2d/assets/sprite-frame';
import { Texture2D } from '../../cocos/asset/assets';
import { Rect, isValid } from '../../cocos/core';
import { CCObject } from '../../cocos/core/data/object';
import { AttributeName } from '../../cocos/gfx';
import { Atlas } from '../../cocos/2d/utils/dynamic-atlas/atlas';
import { dynamicAtlasManager } from '../../cocos/2d/utils/dynamic-atlas/atlas-manager';

describe('SpriteFrame dynamic atlas detachment', () => {
    let frames: SpriteFrame[];
    let textures: Texture2D[];
    function texture (): Texture2D {
        const value = new Texture2D();
        value.reset({ width: 256, height: 256 });
        textures.push(value);
        return value;
    }

    test('a UV callback cannot repack onto the page being reset', () => {
        const wasEnabled = dynamicAtlasManager.enabled;
        dynamicAtlasManager.enabled = true;
        try {
            const asset = frame(), source = asset.texture;
            const pack = () => dynamicAtlasManager.packToDynamicAtlas(null, asset);
            pack();
            const page = asset.texture;
            expect(page).not.toBe(source);
            asset.once('uv_updated', pack);
            dynamicAtlasManager.reset();
            expect(asset.original).toBeNull();
            expect(asset.texture).toBe(source);
            expect(isValid(page, true)).toBe(false);
            pack();
            expect(asset.original!._texture).toBe(source);
        } finally {
            dynamicAtlasManager.enabled = wasEnabled;
        }
    });
    function frame (source = texture()): SpriteFrame {
        const value = new SpriteFrame();
        value.texture = source;
        value.rect = new Rect(16, 32, 100, 60);
        value.packable = true;
        frames.push(value);
        return value;
    }
    function atlas (): Atlas {
        const value = new Atlas(1024, 1024);
        const manager = dynamicAtlasManager as any;
        manager._atlases.push(value);
        manager._atlasIndex = manager._atlases.length - 1;
        return value;
    }
    function pack (page: Atlas, value: SpriteFrame): Texture2D {
        const packed = page.insertSpriteFrame(value);
        expect(packed).not.toBeNull();
        value._setDynamicAtlasFrame(packed);
        return packed!.texture;
    }
    beforeEach(() => {
        dynamicAtlasManager.reset();
        frames = [];
        textures = [];
    });
    afterEach(() => {
        dynamicAtlasManager.reset();
        frames.forEach(value => { if (isValid(value, true)) value.destroy(); });
        textures.forEach(value => { if (isValid(value, true)) value.destroy(); });
        CCObject._deferredDestroy();
    });

    test('changing a frame preserves another frame sharing its packed source', () => {
        const page = atlas(), source = texture();
        const first = frame(source), second = frame(source);
        const packed = pack(page, first);
        pack(page, second);
        const secondUv = second.uv.slice();
        const changed = jest.fn();
        second.on('uv_updated', changed);
        const replacement = texture();
        first.texture = replacement;
        expect(first.original).toBeNull();
        expect(first.texture).toBe(replacement);
        expect(second.texture).toBe(packed);
        expect(second.uv).toEqual(secondUv);
        expect(second.original!._texture).toBe(source);
        expect(changed).not.toHaveBeenCalled();
        expect(dynamicAtlasManager.atlasCount).toBe(1);
        expect(isValid(packed, true)).toBe(true);
        second.texture = texture();
        expect(dynamicAtlasManager.atlasCount).toBe(0);
        expect(isValid(packed, true)).toBe(false);
        dynamicAtlasManager.reset();
        expect(first.texture).toBe(replacement);
    });

    test('removing one source preserves a different source on the same page', () => {
        const page = atlas(), first = frame(), second = frame();
        const packed = pack(page, first);
        pack(page, second);
        const changed = jest.fn();
        second.on('uv_updated', changed);
        first.texture = texture();
        expect(second.texture).toBe(packed);
        expect(changed).not.toHaveBeenCalled();
        expect(dynamicAtlasManager.atlasCount).toBe(1);
        expect(Object.keys((page as any)._innerTextureInfos)).toHaveLength(1);
    });

    test('UI-only removal does not inspect other frames and keeps a repacked source alive', () => {
        const page = atlas(), source = texture();
        const old = frame(source), sibling = frame(), replacement = frame(source);
        const packed = pack(page, old);
        pack(page, sibling);
        dynamicAtlasManager.deleteAtlasTexture(source);
        pack(page, replacement);
        const observed = jest.spyOn(replacement, 'original', 'get');
        old.destroy();
        sibling.destroy();
        expect(observed).not.toHaveBeenCalled();
        expect(replacement.texture).toBe(packed);
        expect(isValid(packed, true)).toBe(true);
        replacement.destroy();
        expect(dynamicAtlasManager.atlasCount).toBe(0);
        expect(isValid(packed, true)).toBe(false);
        observed.mockRestore();
    });

    test('removing a frame on one page does not delete the same source on another page', () => {
        const source = texture(), first = frame(source), second = frame(source);
        const firstPage = atlas(), secondPage = atlas();
        const firstPacked = pack(firstPage, first), secondPacked = pack(secondPage, second);
        first.texture = texture();
        expect(isValid(firstPacked, true)).toBe(false);
        expect(isValid(secondPacked, true)).toBe(true);
        expect(second.texture).toBe(secondPacked);
        expect(second.original!._texture).toBe(source);
        expect(dynamicAtlasManager.atlasCount).toBe(1);
    });

    test('authored source corners survive first world use after packing, cloning and unpacking', () => {
        const page = atlas(), asset = frame(), reference = frame(asset.texture as Texture2D);
        const ordinaryKeys = Object.keys(reference).sort();
        const authored = [0.5, 1, 1, 1, 0.5, 0, 0.75, 0.25];
        const expected = [0.5, 0, 1, 0, 0.5, 1, 0.75, 0.75];
        asset.uv.splice(0, 8, ...authored);
        pack(page, asset);
        pack(page, reference);
        // Both UI frames expose the same page-relative rect corners.
        expect(asset.uv).toEqual(reference.uv);
        expect(Object.keys(reference).sort()).toEqual(ordinaryKeys);
        expect(asset.mesh).toBeNull();
        const clone = asset.clone();
        frames.push(clone);
        for (const consumer of [asset, clone]) {
            consumer.ensureMeshData();
            expect(Array.from(consumer.mesh!.readAttribute(0, AttributeName.ATTR_TEX_COORD)!)).toEqual(expected);
        }
        const cached = asset.mesh;
        dynamicAtlasManager.reset();
        expect(asset.mesh).toBe(cached);
        expect(asset.uv).toEqual(reference.uv);
        expect(Object.keys(reference).sort()).toEqual(ordinaryKeys);
        expect(asset._getSourceUVs()).toEqual(expected);
        asset.texture = texture();
        expect(asset._getSourceUVs()).toEqual([0, 0, 1, 0, 0, 1, 1, 1]);
    });

    test('a retired page callback observes the committed replacement and its later write wins', () => {
        const page = atlas(), first = frame(), changing = frame();
        const firstSource = first.texture, replacement = texture(), latest = texture();
        const oldPage = pack(page, first);
        pack(page, changing);
        dynamicAtlasManager.deleteAtlasTexture(firstSource);
        const callback = jest.fn(() => {
            expect(changing.texture).toBe(replacement);
            expect(dynamicAtlasManager.atlasCount).toBe(0);
            changing.texture = latest;
        });
        first.once('uv_updated', callback);
        changing.texture = replacement;
        expect(callback).toHaveBeenCalledTimes(1);
        expect(changing.texture).toBe(latest);
        expect(isValid(oldPage, true)).toBe(false);
    });

    test('retiring a page leaves a sibling repacked by another frame on its new page', () => {
        const wasEnabled = dynamicAtlasManager.enabled;
        dynamicAtlasManager.enabled = true;
        try {
            const source = texture(), replacement = texture();
            const first = frame(source), sibling = frame(source);
            const packFrame = (asset: SpriteFrame): void => dynamicAtlasManager.packToDynamicAtlas(null, asset);
            packFrame(first);
            packFrame(sibling);
            const oldPage = first.texture;
            expect(oldPage).not.toBe(source);
            expect(sibling.texture).toBe(oldPage);

            let newPage = oldPage;
            first.once('uv_updated', () => {
                sibling.texture = replacement;
                sibling.packable = true;
                packFrame(sibling);
                newPage = sibling.texture;
            });
            dynamicAtlasManager.deleteAtlasTexture(source);

            expect(first.texture).toBe(source);
            expect(isValid(oldPage, true)).toBe(false);
            expect(newPage).not.toBe(replacement);
            expect(newPage).not.toBe(oldPage);
            expect(sibling.texture === newPage).toBe(true);
            expect(sibling.original?._texture).toBe(replacement);
            expect(isValid(newPage, true)).toBe(true);
            sibling.destroy();
            expect(dynamicAtlasManager.atlasCount).toBe(0);
            expect(isValid(newPage, true)).toBe(false);
        } finally {
            dynamicAtlasManager.enabled = wasEnabled;
        }
    });

    test('removing the last atlas texture allows synchronous requests to use a new page only', () => {
        const wasEnabled = dynamicAtlasManager.enabled;
        dynamicAtlasManager.enabled = true;
        try {
            const asset = frame();
            const source = asset.texture;
            const pack = () => dynamicAtlasManager.packToDynamicAtlas(null, asset);
            pack();
            const oldPage = asset.texture;
            asset.once('uv_updated', pack);
            dynamicAtlasManager.deleteAtlasTexture(source);
            expect(isValid(oldPage, true)).toBe(false);
            expect(dynamicAtlasManager.atlasCount).toBe(1);
            expect(asset.original!._texture).toBe(source);
            expect(asset.texture).not.toBe(oldPage);
            expect(isValid(asset.texture, true)).toBe(true);
        } finally {
            dynamicAtlasManager.enabled = wasEnabled;
        }
    });

    test('destroying one packed frame preserves its sibling and releases the last page', () => {
        const page = atlas(), source = texture();
        const first = frame(source), second = frame(source);
        const packed = pack(page, first); pack(page, second);
        first.destroy();
        expect(second.texture).toBe(packed);
        expect(isValid(packed, true)).toBe(true);
        second.destroy();
        expect(dynamicAtlasManager.atlasCount).toBe(0);
        expect(isValid(packed, true)).toBe(false);
    });

    test('detaching an unregistered clone does not evict the registered frame', () => {
        const page = atlas(), original = frame();
        const packed = pack(page, original);
        const clone = original.clone(); frames.push(clone);
        clone.texture = texture();
        expect(original.texture).toBe(packed);
        expect(original.original).not.toBeNull();
        expect(dynamicAtlasManager.atlasCount).toBe(1);
        expect(isValid(packed, true)).toBe(true);
    });

    test.each([false, true])('same packed texture reset preserves source mapping (clearData=%s)', clearData => {
        const page = atlas(), value = frame();
        const source = value.texture, sourceRect = value.rect.clone();
        value.rotated = true; value.flipUVX = true;
        const expectedUv = value.uv.map((v, i) => i % 2 ? 1 - v : v);
        const packed = pack(page, value), packedRect = value.rect.clone();
        for (let i = 0; i < 3; i++) {
            value.reset({ texture: packed, rect: packedRect.clone(), isRotate: true }, clearData);
            expect(value.texture).toBe(packed);
            expect(isValid(packed, true)).toBe(true);
            expect(packed.getGFXTexture()).not.toBeNull();
            expect(value.packable).toBe(true);
            expect(value.original!._x).toBe(sourceRect.x);
            expect(value.original!._y).toBe(sourceRect.y);
            value.ensureMeshData();
            expect(value._getSourceTexture()).toBe(source);
            const uv = value.mesh!.readAttribute(0, AttributeName.ATTR_TEX_COORD)!;
            Array.from(uv).forEach((v, j) => expect(v).toBeCloseTo(expectedUv[j]));
        }
        dynamicAtlasManager.reset();
        expect(value.texture).toBe(source);
        expect(value.rect).toEqual(sourceRect);
    });

    test('same packed texture reset applies rect displacement in the current texture coordinates', () => {
        const page = atlas(), value = frame();
        const sourceRect = value.rect.clone(), packed = pack(page, value), changed = value.rect.clone();
        changed.x += 4; changed.y += 7;
        value.reset({ texture: packed, rect: changed });
        expect(value.original!._x).toBe(sourceRect.x + 4);
        expect(value.original!._y).toBe(sourceRect.y + 7);
        dynamicAtlasManager.reset();
        expect(value.rect.x).toBe(sourceRect.x + 4);
        expect(value.rect.y).toBe(sourceRect.y + 7);
    });

    test.each([false, true])('same texture reset still releases the final atlas entry on destroy (clearData=%s)', clearData => {
        const page = atlas(), value = frame(), packed = pack(page, value);
        value.reset({ texture: packed, rect: value.rect.clone() }, clearData);
        value.destroy();
        expect(dynamicAtlasManager.atlasCount).toBe(0);
        expect(isValid(packed, true)).toBe(false);
    });

    test('reassigning the packed texture through the importer setter does not destroy it', () => {
        const page = atlas(), value = frame(), packed = pack(page, value);
        value._textureSource = packed;
        expect(value.texture).toBe(packed);
        expect(isValid(packed, true)).toBe(true);
        expect(packed.getGFXTexture()).not.toBeNull();
    });

    test('non-packed reset still resets the rectangle to the texture size', () => {
        const value = frame(), source = value.texture;
        value.reset({ texture: source });
        expect(value.rect).toEqual(new Rect(0, 0, 256, 256));
        expect(value.original).toBeNull();
        expect(isValid(source, true)).toBe(true);
    });
});

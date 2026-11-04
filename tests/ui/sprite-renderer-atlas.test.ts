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

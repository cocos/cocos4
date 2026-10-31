import { Sprite } from '../../cocos/2d/components/sprite';
import { SpriteFrame } from '../../cocos/2d/assets/sprite-frame';
import { dynamicAtlasManager } from '../../cocos/2d/utils/dynamic-atlas/atlas-manager';
import { ImageAsset, Texture2D } from '../../cocos/asset/assets';

function fillTexture (texture: Texture2D, width: number, height: number): void {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    texture.image = new ImageAsset(canvas);
}

test('Pack to DynamicAtlas', function () {

    dynamicAtlasManager.enabled = true;
    let sprite = new Sprite();
    dynamicAtlasManager.packToDynamicAtlas(sprite,null);
    expect(dynamicAtlasManager.atlasCount).toBe(0);

    let spriteFrame_0 = new SpriteFrame();
    dynamicAtlasManager.packToDynamicAtlas(sprite, spriteFrame_0);
    expect(dynamicAtlasManager.atlasCount).toBe(0);

    spriteFrame_0.packable = true;
    dynamicAtlasManager.packToDynamicAtlas(sprite, spriteFrame_0);
    expect(dynamicAtlasManager.atlasCount).toBe(0);

    let texture_0 = new Texture2D();
    spriteFrame_0.texture = texture_0;
    dynamicAtlasManager.packToDynamicAtlas(sprite, spriteFrame_0);
    expect(dynamicAtlasManager.atlasCount).toBe(0);

    fillTexture(texture_0, 1, 1);
    spriteFrame_0.packable = true;
    dynamicAtlasManager.packToDynamicAtlas(sprite, spriteFrame_0);
    expect(dynamicAtlasManager.atlasCount).toBe(1);
    expect(spriteFrame_0.original !== null);
});

test('Delete Atlas SpriteFrame', function () {

    dynamicAtlasManager.reset();

    let sprite = new Sprite();
    let spriteFrame_0 = new SpriteFrame();
    let texture_0 = new Texture2D();
    spriteFrame_0.texture = texture_0;
    fillTexture(texture_0, 1, 1);
    spriteFrame_0.packable = true;
    dynamicAtlasManager.packToDynamicAtlas(sprite, spriteFrame_0);
    expect(dynamicAtlasManager.atlasCount).toBe(1);
    expect(spriteFrame_0.original !== null);

    dynamicAtlasManager.deleteAtlasSpriteFrame(spriteFrame_0);
    spriteFrame_0._resetDynamicAtlasFrame();
    expect(dynamicAtlasManager.atlasCount).toBe(0);
    expect(spriteFrame_0.original === null);

    dynamicAtlasManager.packToDynamicAtlas(sprite, spriteFrame_0);
    expect(dynamicAtlasManager.atlasCount).toBe(1);
    expect(spriteFrame_0.original !== null);

});

test('DynamicAtlasManager-insertSpriteFrame' ,function(){
    dynamicAtlasManager.reset();
    dynamicAtlasManager.enabled = true;
    dynamicAtlasManager.maxAtlasCount = 2;
    dynamicAtlasManager.textureSize = 500;

    for(let i = 0; i < 2 * 4; ++i) {
        let spriteFrame = new SpriteFrame();
        let texture = new Texture2D();
        fillTexture(texture, 200, 200);
        spriteFrame.texture = texture;
        spriteFrame.packable = true;
        dynamicAtlasManager.insertSpriteFrame(spriteFrame);
    }
    {
        let spriteFrame = new SpriteFrame();
        let texture = new Texture2D();
        fillTexture(texture, 200, 200);
        spriteFrame.texture = texture;
        spriteFrame.packable = true;
        expect(dynamicAtlasManager.insertSpriteFrame(spriteFrame)).toEqual(null);
    }
    {
        let spriteFrame = new SpriteFrame();
        let texture = new Texture2D();
        fillTexture(texture, 200, 200);
        spriteFrame.texture = texture;
        spriteFrame.packable = true;
        expect(dynamicAtlasManager.insertSpriteFrame(spriteFrame)).toEqual(null);
    }

});

import { SpriteAtlas, SpriteFrame } from '../../cocos/2d';
import { Texture2D } from '../../cocos/asset/assets/texture-2d';
import { assetManager } from '../../cocos/asset/asset-manager';
import { dependMap } from '../../cocos/asset/asset-manager/depend-maps';
import dependUtil from '../../cocos/asset/asset-manager/depend-util';
import { setProperties } from '../../cocos/asset/asset-manager/utilities';
import { Details } from '../../cocos/serialization/deserialize';

// issue: https://github.com/cocos/cocos-engine/issues/16693
test('SpriteAtlas serialize', function () {
    const spriteAtlas = new SpriteAtlas();
    spriteAtlas.spriteFrames = {
        '09f4f3e7-268b-478c-a7af-bbdf574ec3c6@9941': { _uuid: '09f4f3e7-268b-478c-a7af-bbdf574ec3c6' },
        '19f4f3e7-268b-478c-a7af-bbdf574ec3c6@9941': { _uuid: '19f4f3e7-268b-478c-a7af-bbdf574ec3c6' },
    };
    const ctxForExporting = {
        _depends: [] as string[],
        dependsOn(propName: string, uuid: string) {
            this._depends.push(propName, uuid);
        },
        _compressUuid: this.mustCompresseUuid,
    };
    spriteAtlas._serialize(ctxForExporting);
    expect(ctxForExporting._depends).toEqual(['_textureSource', '09f4f3e7-268b-478c-a7af-bbdf574ec3c6', '_textureSource', '19f4f3e7-268b-478c-a7af-bbdf574ec3c6']);
});

test('SpriteAtlas deserialize', function () {
    const data = { name: 'avatar', spriteFrames: ['1', '09f4f3e7-268b-478c-a7af-bbdf574ec3c6', '2', '19f4f3e7-268b-478c-a7af-bbdf574ec3c6'] };
    const result = new Details();
    result.init();
    const handle = { result };
    const spriteAtlas = new SpriteAtlas();
    spriteAtlas._deserialize(data, handle);
    expect(handle.result.uuidList).toEqual(['09f4f3e7-268b-478c-a7af-bbdf574ec3c6', '19f4f3e7-268b-478c-a7af-bbdf574ec3c6']);
});

test('SpriteAtlas keeps preload and sprite-frame dependencies independent', () => {
    const atlasUuid = '1b1e8b28-d17c-4f5f-87c1-atlas';
    const frameUuid = '827e630d-e2ce-4bda-8577-frame';
    const spriteAtlas = new SpriteAtlas();
    const spriteFrame = new SpriteFrame();
    spriteAtlas._uuid = atlasUuid;
    spriteFrame._uuid = frameUuid;
    spriteAtlas.spriteFrames = { frame: null };
    const depends = [
        { uuid: frameUuid, owner: spriteAtlas, prop: '_textureSource' },
        { uuid: frameUuid, owner: spriteAtlas.spriteFrames, prop: 'frame' },
    ];
    dependMap.set(spriteAtlas, depends);
    dependUtil._depends.add(atlasUuid, { deps: [frameUuid, frameUuid] });
    assetManager.assets.add(atlasUuid, spriteAtlas);
    assetManager.assets.add(frameUuid, spriteFrame);

    try {
        setProperties(atlasUuid, spriteAtlas, { [`${frameUuid}@import`]: spriteFrame });

        expect(spriteFrame.refCount).toBe(2);
        expect(spriteAtlas.spriteFrames.frame).toBe(spriteFrame);
        expect((spriteAtlas as any)._textureSource).toBe(spriteFrame);
        expect(dependUtil.getDeps(atlasUuid)).toEqual([frameUuid, frameUuid]);

        assetManager.releaseAsset(spriteAtlas);

        expect(spriteFrame.refCount).toBe(0);
        expect(dependUtil.getDeps(atlasUuid)).toEqual([]);
        expect(assetManager.assets.has(atlasUuid)).toBe(false);
        expect(assetManager.assets.has(frameUuid)).toBe(false);
    } finally {
        assetManager.assets.remove(atlasUuid);
        assetManager.assets.remove(frameUuid);
        dependUtil.remove(atlasUuid);
    }
});

test('SpriteFrame _textureSource remains a real texture assignment', () => {
    const spriteFrame = new SpriteFrame();
    const texture = new Texture2D();

    spriteFrame._textureSource = texture;

    expect(spriteFrame.texture).toBe(texture);
});

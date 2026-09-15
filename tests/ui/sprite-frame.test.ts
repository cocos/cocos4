import { SpriteFrame } from "../../cocos/2d";
import { Texture2D } from "../../cocos/asset/assets";
import { Rect, Size, Vec2 } from "../../exports/base";
import { captureWarns } from "../utils/log-capture";

test('spritefrom.get',()=>{
    let sp = new SpriteFrame;
    sp.insetTop = 100;
    expect(sp.insetTop).toStrictEqual(100);
    sp.insetBottom = 200;
    expect(sp.insetBottom).toStrictEqual(200);
    sp.insetLeft = 300;
    expect(sp.insetLeft).toStrictEqual(300);
    sp.insetRight = 400;
    expect(sp.insetRight).toStrictEqual(400);

    let rc = new Rect(0, 0, 100, 100);
    sp.rect = rc;
    expect(sp.rect).toEqual(rc);

    let sz = new Size(100, 100);
    sp.originalSize = sz
    expect(sp.originalSize).toEqual(sz);

    let offset = new Vec2(100, 200);
    sp.offset = offset;
    expect(sp.offset).toEqual(offset);

    sp.rotated = true;
    expect(sp.rotated).toEqual(true);

    let tex = new Texture2D();
    sp.texture = tex;
    expect(sp.texture).toEqual(tex);

    let atlasUuid = '123456787abcd';
    sp.atlasUuid = atlasUuid;
    expect(sp.atlasUuid).toStrictEqual(atlasUuid);

    expect(sp.width).toEqual(tex.width);
    expect(sp.height).toEqual(tex.height);

    sp.flipUVX = true;
    sp.flipUVY = false;
    expect(sp.flipUVX).toEqual(true);
    expect(sp.flipUVY).toEqual(false);

    sp.packable = true;
    expect(sp.packable).toEqual(true);

    // default value
    expect(sp.pixelsToUnit).toEqual(100);
    expect(sp.pivot).toEqual(new Vec2(0.5, 0.5));
})

test('spriteframe.clone', () => {
    let sp = new SpriteFrame;
    sp.insetTop = 100;
    sp.insetBottom = 200;
    sp.insetLeft = 300;
    sp.insetRight = 400;
    sp.rect = new Rect(0, 0, 100, 100);
    sp.originalSize = new Size(100, 100);
    sp.offset = new Vec2(100, 200);
    sp.rotated = true;
    sp.texture = new Texture2D();
    sp.atlasUuid = '123456787abcd';
    sp.flipUVX = true;
    sp.flipUVY = false;
    sp.packable = true;
    // Make sure the mesh is created
    sp.ensureMeshData();
    
    let sp_clone = sp.clone();

    expect(sp_clone.rect).toEqual(sp.rect);
    sp_clone.rect.width = 100;
    expect(sp_clone.rect !== sp.rect).toEqual(true);

    expect(sp_clone.originalSize).toEqual(sp.originalSize);
    sp_clone.originalSize.width = 100;
    expect(sp_clone.originalSize !== sp.originalSize).toEqual(true);

    
    expect(sp_clone.offset).toEqual(sp.offset);
    sp_clone.offset.add2f(100, 200);
    expect(sp_clone.offset !== sp.offset).toEqual(true);

    expect(sp_clone.rotated).toEqual(sp.rotated);

    expect(sp_clone.atlasUuid).toStrictEqual(sp.atlasUuid);

    expect(sp_clone.width).toEqual(sp.width);
    expect(sp_clone.height).toEqual(sp.height);
    expect(sp_clone.flipUVX).toEqual(sp.flipUVX);
    expect(sp_clone.flipUVY).toEqual(sp.flipUVY);
    expect(sp_clone.packable).toEqual(sp.packable);

    expect(sp_clone.pixelsToUnit).toEqual(sp.pixelsToUnit);
    expect(sp_clone.pivot).toEqual(sp.pivot);
    sp_clone.pivot.add2f(100,200);
    expect(sp_clone.pivot !== sp.pivot).toEqual(true);

    expect(sp_clone.mesh).toEqual(sp.mesh);
    sp_clone.mesh?.destroy();
    expect(sp_clone.mesh !== sp.mesh).toEqual(true);
    
    expect(sp_clone.uv).toEqual(sp.uv);
    sp_clone.uv.splice(0, sp_clone.uv.length);
    expect(sp_clone.uv !== sp.uv).toEqual(true);

    expect(sp_clone.unbiasUV).toEqual(sp.unbiasUV);
    sp_clone.unbiasUV.splice(0, sp_clone.unbiasUV.length);
    expect(sp_clone.unbiasUV !== sp.unbiasUV).toEqual(true);

    expect(sp_clone.uvSliced).toEqual(sp.uvSliced);
    sp_clone.uvSliced.splice(0, sp_clone.uvSliced.length);
    expect(sp_clone.uvSliced !== sp.uvSliced).toEqual(true);

    expect(sp_clone.vertices).toEqual(sp.vertices);
    sp_clone.vertices?.rawPosition.splice(0,  sp_clone.vertices?.rawPosition.length);
    expect(sp_clone.vertices?.rawPosition !== sp.vertices?.rawPosition).toEqual(true)
    sp_clone.vertices?.positions.splice(0,  sp_clone.vertices?.positions.length);
    expect(sp_clone.vertices?.positions !== sp.vertices?.positions).toEqual(true);
    sp_clone.vertices?.indexes.splice(0,  sp_clone.vertices?.indexes.length);
    expect(sp_clone.vertices?.indexes !== sp.vertices?.indexes).toEqual(true);
    sp_clone.vertices?.uv.splice(0,  sp_clone.vertices?.uv.length);
    expect(sp_clone.vertices?.uv !== sp.vertices?.uv).toEqual(true);
    sp_clone.vertices?.nuv.splice(0,  sp_clone.vertices?.nuv.length);
    expect(sp_clone.vertices?.nuv !== sp.vertices?.nuv).toEqual(true);
    sp_clone.vertices?.minPos.add3f(100,200,300);
    expect(sp_clone.vertices?.minPos !== sp.vertices?.minPos).toEqual(true);
    sp_clone.vertices?.maxPos.add3f(100,200,300);
    expect(sp_clone.vertices?.maxPos !== sp.vertices?.maxPos).toEqual(true);;
    expect(sp_clone.original).toEqual(sp.original);

    expect(sp_clone.trimmedBorder).toEqual(sp.trimmedBorder);
    sp_clone.trimmedBorder.add4f(100,200,300,400);
    expect(sp_clone.trimmedBorder !== sp.trimmedBorder).toEqual(true);
    
    expect(sp_clone.insetTop).toStrictEqual(sp.insetTop);
    expect(sp_clone.insetBottom).toStrictEqual(sp.insetBottom);
    expect(sp_clone.insetLeft).toStrictEqual(sp.insetLeft);
    expect(sp_clone.insetRight).toStrictEqual(sp.insetRight);

    expect(sp_clone.texture).toEqual(sp.texture);
    sp_clone.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
    // Textures are not deep copies.
    expect(sp_clone.texture === sp.texture).toEqual(true);
});

describe('SpriteFrame.reset pixelsToUnit', () => {
    test('accepts pixelsToUnit', () => {
        /// @case
        /// 1. A runtime-created SpriteFrame is reset with a texture, rect, and pixelsToUnit.
        /// 2. Mesh data is requested from the SpriteFrame.
        /// @expect
        /// The SpriteFrame stores the requested pixelsToUnit and creates mesh bounds in world units.
        const texture = new Texture2D();
        texture.reset({ width: 200, height: 100 });

        const sp = new SpriteFrame();
        sp.reset({
            texture,
            rect: new Rect(0, 0, 200, 100),
            pixelsToUnit: 50,
        });
        sp.ensureMeshData();

        const minPosition = sp.mesh!.struct.minPosition!;
        const maxPosition = sp.mesh!.struct.maxPosition!;
        expect(sp.pixelsToUnit).toBe(50);
        expect(maxPosition.x - minPosition.x).toBeCloseTo(4);
        expect(maxPosition.y - minPosition.y).toBeCloseTo(2);
    });

    test('preserves pixelsToUnit when omitted', () => {
        /// @case
        /// 1. A SpriteFrame is reset with a custom pixelsToUnit.
        /// 2. The SpriteFrame is reset again without pixelsToUnit.
        /// @expect
        /// The existing pixelsToUnit is preserved for backwards-compatible partial resets.
        const sp = new SpriteFrame();
        sp.reset({ pixelsToUnit: 25 });
        sp.reset({ rect: new Rect(0, 0, 10, 10) });

        expect(sp.pixelsToUnit).toBe(25);
    });

    test('refreshes existing mesh when pixelsToUnit changes', () => {
        /// @case
        /// 1. A SpriteFrame creates mesh data with the default pixelsToUnit.
        /// 2. The SpriteFrame is reset with a different pixelsToUnit.
        /// @expect
        /// Existing mesh data reflects the new world-unit scale.
        const texture = new Texture2D();
        texture.reset({ width: 200, height: 100 });

        const sp = new SpriteFrame();
        sp.reset({
            texture,
            rect: new Rect(0, 0, 200, 100),
        });
        sp.ensureMeshData();
        expect(sp.mesh!.struct.maxPosition!.x - sp.mesh!.struct.minPosition!.x).toBeCloseTo(2);

        sp.reset({ pixelsToUnit: 50 });

        expect(sp.mesh!.struct.maxPosition!.x - sp.mesh!.struct.minPosition!.x).toBeCloseTo(4);
        expect(sp.mesh!.struct.maxPosition!.y - sp.mesh!.struct.minPosition!.y).toBeCloseTo(2);
    });

    test('rebuilds existing mesh when pixelsToUnit changes while clearing data', () => {
        /// @case
        /// 1. A SpriteFrame has existing mesh data.
        /// 2. It is reset with a new pixelsToUnit and clearData enabled.
        /// @expect
        /// The mesh is rebuilt from the cleared rect instead of scaling stale raw vertices.
        const texture = new Texture2D();
        texture.reset({ width: 200, height: 100 });

        const sp = new SpriteFrame();
        sp.reset({ texture });
        sp.ensureMeshData();

        sp.reset({ pixelsToUnit: 50 }, true);

        const minPosition = sp.mesh!.struct.minPosition!;
        const maxPosition = sp.mesh!.struct.maxPosition!;
        expect(sp.pixelsToUnit).toBe(50);
        expect(sp.rect.width).toBe(0);
        expect(sp.rect.height).toBe(0);
        expect(maxPosition.x - minPosition.x).toBe(0);
        expect(maxPosition.y - minPosition.y).toBe(0);
    });

    test('refreshes existing mesh from the final texture, rect, and pixelsToUnit state', () => {
        /// @case
        /// 1. A SpriteFrame has existing mesh data.
        /// 2. It is reset with a new texture, a sub-rect, and a new pixelsToUnit.
        /// @expect
        /// The refreshed mesh bounds use the final sub-rect and pixelsToUnit values.
        const initialTexture = new Texture2D();
        initialTexture.reset({ width: 64, height: 64 });
        const nextTexture = new Texture2D();
        nextTexture.reset({ width: 200, height: 100 });

        const sp = new SpriteFrame();
        sp.reset({ texture: initialTexture });
        sp.ensureMeshData();

        sp.reset({
            texture: nextTexture,
            rect: new Rect(10, 5, 50, 25),
            pixelsToUnit: 25,
        });

        const minPosition = sp.mesh!.struct.minPosition!;
        const maxPosition = sp.mesh!.struct.maxPosition!;
        expect(maxPosition.x - minPosition.x).toBeCloseTo(2);
        expect(maxPosition.y - minPosition.y).toBeCloseTo(1);
    });

    test('rebuilds existing mesh when rect and pixelsToUnit change', () => {
        /// @case
        /// 1. A SpriteFrame has existing mesh data for a full texture rect.
        /// 2. It is reset with a smaller rect and a new pixelsToUnit without changing texture.
        /// @expect
        /// The refreshed mesh bounds use the new rect instead of scaling stale raw vertices.
        const texture = new Texture2D();
        texture.reset({ width: 200, height: 100 });

        const sp = new SpriteFrame();
        sp.reset({ texture });
        sp.ensureMeshData();

        sp.reset({
            rect: new Rect(10, 5, 50, 25),
            pixelsToUnit: 25,
        });

        const minPosition = sp.mesh!.struct.minPosition!;
        const maxPosition = sp.mesh!.struct.maxPosition!;
        expect(maxPosition.x - minPosition.x).toBeCloseTo(2);
        expect(maxPosition.y - minPosition.y).toBeCloseTo(1);
    });

    test('warns and ignores invalid pixelsToUnit', () => {
        /// @case
        /// 1. A SpriteFrame has a valid pixelsToUnit.
        /// 2. It is reset with invalid pixelsToUnit values and another valid field.
        /// @expect
        /// Each invalid value warns, preserves pixelsToUnit, and does not interrupt the rest of reset.
        const sp = new SpriteFrame();
        sp.reset({ pixelsToUnit: 25 });
        const nextRect = new Rect(0, 0, 10, 10);
        const warnWatcher = captureWarns();
        const invalidPixelsToUnit = [0, -1, NaN, Infinity, -Infinity, '25' as unknown as number];

        invalidPixelsToUnit.forEach((pixelsToUnit, index) => {
            expect(() => sp.reset({
                pixelsToUnit,
                rect: index === 0 ? nextRect : undefined,
            })).not.toThrow();
            expect(sp.pixelsToUnit).toBe(25);
        });

        expect(sp.rect).toEqual(nextRect);
        expect(warnWatcher.captured).toHaveLength(invalidPixelsToUnit.length);
        warnWatcher.captured.forEach(([message]) => {
            expect(message).toBe('SpriteFrame pixelsToUnit must be a finite number greater than 0.');
        });
        warnWatcher.stop();
    });
});

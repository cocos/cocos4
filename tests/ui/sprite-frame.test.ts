import { SpriteFrame } from "../../cocos/2d";
import { Texture2D } from "../../cocos/asset/assets";
import { Rect, Size, Vec2, Vec3 } from "../../exports/base";

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
    // Imported/source geometry is distinct from the derived world quad and must survive cloning.
    sp.vertices = {
        rawPosition: [new Vec3(0, 0, 0), new Vec3(10, 0, 0), new Vec3(0, 10, 0)],
        positions: [0, 0, 0, 0.1, 0, 0, 0, 0.1, 0],
        indexes: [0, 1, 2],
        uv: [0, 0, 10, 0, 0, 10],
        nuv: [0, 0, 1, 0, 0, 1],
        minPos: new Vec3(),
        maxPos: new Vec3(10, 10, 0),
    };
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

    // Cloning resource metadata does not allocate a world mesh before a world consumer needs it.
    expect(sp_clone.mesh).toBeNull();
    sp_clone.ensureMeshData();
    expect(sp_clone.mesh).not.toBeNull();
    expect(sp_clone.mesh).not.toBe(sp.mesh);
    
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
    expect(sp_clone.vertices!.rawPosition[0]).not.toBe(sp.vertices!.rawPosition[0]);
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
    sp_clone.destroy();
    sp.destroy();
});

test('spriteframe legacy metadata defaults and source data are not replaced by derived geometry', () => {
    const sp = new SpriteFrame();
    sp._deserialize({ name: 'legacy', rect: { x: 0, y: 0, width: 20, height: 10 }, pivot: { x: 0.25, y: 0.75 } }, {});
    expect(sp.pixelsToUnit).toBe(100);
    expect(sp.pivot).toEqual(new Vec2(0.25, 0.75));
    sp._deserialize({ name: 'explicit-invalid', pixelsToUnit: 0 }, {});
    expect(sp.pixelsToUnit).toBe(0); // Preserve explicit data; geometry validation must reject it instead of rewriting the asset.
    sp.destroy();
});

import { UIMesh, UIMeshData } from '../../cocos/2d/components/ui-mesh';
import { UITransform } from '../../cocos/2d';
import { UIOpacity } from '../../cocos/2d/components/ui-opacity';
import { Node } from '../../cocos/scene-graph/node';
import { Scene, director } from '../../exports/base';
import { Batcher2D } from '../../cocos/2d/renderer/batcher-2d';
import { vfmtPosUvColor4B, vfmtPosUvTwoColor4B } from '../../cocos/2d/renderer/vertex-format';
import { Vec3 } from '../../cocos/core/math/vec3';
import { captureErrorIDs } from '../utils/log-capture';

// Mirrors sprite.test.ts: a headless batcher so UIMesh can create its shared
// StaticVBAccessor and allocate chunks from it.
// @ts-expect-error
director.root!._batcher = new Batcher2D(director.root!);
const scene = new Scene('uimesh-test');
director.runSceneImmediate(scene);

const ACCESSOR_VERTEX_COUNT = 32767;

function createUIMesh (parent: Node = scene): { mesh: UIMesh, anyMesh: any, node: Node } {
    const node = new Node('mesh');
    node.addComponent(UITransform);
    parent.addChild(node);
    const mesh = node.addComponent(UIMesh);
    return { mesh, anyMesh: mesh as any, node };
}

function makeMeshData (vc: number, stride = 24): UIMeshData {
    const quadCount = Math.floor(vc / 4);
    const ic = quadCount * 6;
    const vertexData = new Uint8Array(vc * stride);
    const indices = new Uint16Array(ic);
    for (let q = 0; q < quadCount; ++q) {
        const v = q * 4;
        const o = q * 6;
        indices[o] = v; indices[o + 1] = v + 1; indices[o + 2] = v + 2;
        indices[o + 3] = v + 2; indices[o + 4] = v + 1; indices[o + 5] = v + 3;
    }
    return {
        vertexCount: vc,
        vertexStride: stride,
        vertexData,
        indexCount: ic,
        indexData: new Uint8Array(indices.buffer),
        segments: [{ indexOffset: 0, indexCount: ic, texture: null, material: null }],
    };
}

describe('UIMesh: accessor capacity', () => {
    test('30000 vertices render — the 10% reserve is clamped to the accessor cap', () => {
        const { mesh, anyMesh } = createUIMesh();
        const data = makeMeshData(30000); // fits, but ceil(30000 * 1.1) > 32767
        mesh.setMeshData(data);
        expect(anyMesh._meshData).toBe(data);
        expect(anyMesh._prepareBuffers()).not.toBeNull();
        const rd = anyMesh._renderData;
        // Actual counts are tracked; the reserve lives in the chunk.
        expect(rd.vertexCount).toBe(30000);
        expect(rd.indexCount).toBe(data.indexCount);
        expect(rd.chunk).toBeTruthy();
        expect(rd.chunk.vb.byteLength).toBe(ACCESSOR_VERTEX_COUNT * 24);
    });

    test('32767 vertices (exact accessor cap) render', () => {
        const { mesh, anyMesh } = createUIMesh();
        mesh.setMeshData(makeMeshData(32767));
        expect(anyMesh._prepareBuffers()).not.toBeNull();
        const rd = anyMesh._renderData;
        expect(rd.vertexCount).toBe(32767);
        expect(rd.chunk.vb.byteLength).toBe(ACCESSOR_VERTEX_COUNT * 24);
    });

    test('data beyond the accessor cap is rejected with an error', () => {
        const { mesh, anyMesh } = createUIMesh();
        const watcher = captureErrorIDs();
        mesh.setMeshData(makeMeshData(32768));
        expect(watcher.captured).toHaveLength(1);
        expect(watcher.captured[0]).toEqual([9016, 32768, 49152, 32767, 131068]);
        watcher.clear();
        expect(anyMesh._meshData).toBeNull(); // rejected frame stores nothing
    });

    test('growth within the reserve does not reallocate the chunk', () => {
        const { mesh, anyMesh } = createUIMesh();
        mesh.setMeshData(makeMeshData(100));
        expect(anyMesh._prepareBuffers()).not.toBeNull();
        const chunk = anyMesh._renderData.chunk;
        mesh.setMeshData(makeMeshData(105)); // within the ~10% head room
        expect(anyMesh._prepareBuffers()).not.toBeNull();
        expect(anyMesh._renderData.chunk).toBe(chunk);
        expect(anyMesh._renderData.vertexCount).toBe(105);
    });
});

describe('UIMesh: setMeshData boundary validation', () => {
    let mesh: UIMesh;
    let anyMesh: any;
    let watcher: ReturnType<typeof captureErrorIDs>;

    beforeEach(() => {
        ({ mesh, anyMesh } = createUIMesh());
        watcher = captureErrorIDs();
    });

    // The watcher must be empty by test end (log-capture afterEach enforces it):
    // every test asserts its single errorID call and clears it. Entries are the
    // raw errorID arguments — [id, ...params]; the texts live in DebugInfos.json.
    afterEach(() => {
        watcher.clear();
    });

    test('rejects unsupported vertex stride', () => {
        mesh.setMeshData(makeMeshData(8, 32));
        expect(watcher.captured).toHaveLength(1);
        expect(watcher.captured[0]).toEqual([9010, 32, 24, 28]);
        expect(anyMesh._meshData).toBeNull();
    });

    test('rejects vertexData shorter than vertexCount * stride', () => {
        const data = makeMeshData(8);
        data.vertexData = data.vertexData.slice(0, data.vertexData.byteLength - 1);
        mesh.setMeshData(data);
        expect(watcher.captured).toHaveLength(1);
        expect(watcher.captured[0]).toEqual([9012, 191, 8, 24]);
        expect(anyMesh._meshData).toBeNull();
    });

    test('rejects indexData shorter than indexCount * 2', () => {
        const data = makeMeshData(8);
        data.indexData = data.indexData.slice(0, data.indexData.byteLength - 2);
        mesh.setMeshData(data);
        expect(watcher.captured).toHaveLength(1);
        expect(watcher.captured[0]).toEqual([9013, 22, 0, 12, 24]);
        expect(anyMesh._meshData).toBeNull();
    });

    test('rejects indices out of vertex range', () => {
        const data = makeMeshData(8);
        const indices = new Uint16Array(data.indexData.buffer, data.indexData.byteOffset, data.indexCount);
        indices[0] = data.vertexCount; // one past the last vertex
        mesh.setMeshData(data);
        expect(watcher.captured).toHaveLength(1);
        expect(watcher.captured[0]).toEqual([9014, 0, 8, 8]);
        expect(anyMesh._meshData).toBeNull();
    });

    test('rejects segment ranges beyond indexCount', () => {
        const data = makeMeshData(8);
        data.segments = [{ indexOffset: 0, indexCount: data.indexCount + 1, texture: null, material: null }];
        mesh.setMeshData(data);
        expect(watcher.captured).toHaveLength(1);
        expect(watcher.captured[0]).toEqual([9015, 0, 0, 13, 12]);
        expect(anyMesh._meshData).toBeNull();
    });

    test('a rejected frame keeps the last accepted mesh', () => {
        const good = makeMeshData(8);
        mesh.setMeshData(good);
        mesh.setMeshData(makeMeshData(32768)); // over cap, rejected
        expect(watcher.captured).toHaveLength(1);
        expect(watcher.captured[0]).toEqual([9016, 32768, 49152, 32767, 131068]);
        expect(anyMesh._meshData).toBe(good);
    });
});

describe('UIMesh: accessor lifetime follows the batcher', () => {
    test('a rebuilt root/batcher never reuses a destroyed accessor (single- and two-color)', () => {
        const UIMESH_KEY = Number.parseInt('UIMESH', 36);
        const UIMESH_TINT_KEY = Number.parseInt('UIMESHTINT', 36);

        // First root: a UIMesh creates its accessors and registers them with
        // the current batcher.
        const first = createUIMesh();
        first.mesh.setMeshData(makeMeshData(8));
        expect(first.anyMesh._prepareBuffers()).not.toBeNull();
        const oldAccessor = first.anyMesh._renderData.accessor;
        const oldMap: Map<number, any> = (director.root!.batcher2D as any)._bufferAccessors;
        expect(oldMap.get(UIMESH_KEY)).toBe(oldAccessor); // registered with its batcher

        // Root.destroy(): the batcher destroys every accessor it owns, is
        // dropped, and a rebuilt root creates a fresh batcher with an empty map
        // — all within the same JS context.
        const root: any = director.root!;
        const oldBatcher: Batcher2D = root.batcher2D;
        oldBatcher.destroy();
        expect(oldMap.size).toBe(0); // accessors released with the batcher
        expect((oldAccessor as any)._buffers.length).toBe(0); // buffers gone
        root._batcher = new Batcher2D(root);

        // UIMesh components under the new root must resolve fresh accessors
        // from the new batcher. A batcher-keyed cache that forgot to invalidate
        // would hand back the destroyed accessor and skip registration,
        // breaking upload/reset.
        const second = createUIMesh();
        second.mesh.setMeshData(makeMeshData(8));
        expect(second.anyMesh._prepareBuffers()).not.toBeNull();
        const newAccessor = second.anyMesh._renderData.accessor;
        expect(newAccessor).not.toBe(oldAccessor);
        expect((newAccessor as any)._buffers.length).toBeGreaterThan(0);

        const newMap: Map<number, any> = (director.root!.batcher2D as any)._bufferAccessors;
        expect(newMap.get(UIMESH_KEY)).toBe(newAccessor); // registered with the new batcher

        // Two-color branch: same guarantee for the tint accessor.
        const tinted = createUIMesh();
        tinted.mesh.setMeshData(makeMeshData(8, 28));
        expect(tinted.anyMesh._prepareBuffers()).not.toBeNull();
        const newTintAccessor = tinted.anyMesh._renderData.accessor;
        expect(newTintAccessor).not.toBe(oldAccessor);
        expect(newMap.get(UIMESH_TINT_KEY)).toBe(newTintAccessor);

        // The accessors hold copies of the vertex formats: destroying them with
        // the old batcher must not empty the shared module-level constants.
        expect(vfmtPosUvColor4B).toHaveLength(3);
        expect(vfmtPosUvTwoColor4B).toHaveLength(4);
    });
});

// A drawable segment: a texture is what makes _prepareNativeDrawInfos create a
// draw info (segments without texture are skipped). Only getGFXTexture /
// getGFXSampler are called headless.
const fakeTexture = (): any => ({ getGFXTexture: () => ({}), getGFXSampler: () => ({}) });

function makeDrawnData (vc: number): UIMeshData {
    const data = makeMeshData(vc);
    data.segments = [{ indexOffset: 0, indexCount: data.indexCount, texture: fakeTexture(), material: {} as any }];
    return data;
}

describe('UIMesh: per-frame index submission (native cross-frame)', () => {
    // The native batcher resets every mesh buffer's index tail after upload
    // (indexOffset = 0, synchronized through shared memory) while only dirty
    // renderers re-prepare. jest runs with JSB = false, so these tests drive
    // the JSB pump's two submit paths directly: appendIndexBuffer (static
    // frame) and _prepareNativeDrawInfos (dirty frame) -- each runs exactly
    // once per frame. The helper below performs the post-upload reset.
    const nextFrame = (buf: any): void => {
        buf.indexOffset = 0;   // the post-upload index-tail reset
    };

    test('a paused mesh keeps drawing its own triangles while a sibling updates', () => {
        const a = createUIMesh();
        const b = createUIMesh();
        a.mesh.setMeshData(makeDrawnData(4)); // ic = 6
        b.mesh.setMeshData(makeDrawnData(4));

        // Frame 1: both dirty -> both run the native draw-info refresh.
        a.anyMesh._prepareNativeDrawInfos();
        b.anyMesh._prepareNativeDrawInfos();
        const buf = a.anyMesh._renderData.getMeshBuffer();
        expect(b.anyMesh._renderData.getMeshBuffer()).toBe(buf); // one shared buffer
        const offsetA = a.anyMesh._renderData.chunk.vertexOffset;
        const offsetB = b.anyMesh._renderData.chunk.vertexOffset;
        expect(offsetB).toBeGreaterThan(offsetA);
        const quadOf = (o: number): Uint16Array => new Uint16Array([o, o + 1, o + 2, o + 2, o + 1, o + 3]);
        const startA = a.anyMesh._drawInfoList[0]._indexOffset;
        const startB = b.anyMesh._drawInfoList[0]._indexOffset;
        expect(startB - startA).toBe(6); // B appended right after A
        expect(buf.iData.slice(startA, startA + 6)).toEqual(quadOf(offsetA));
        expect(buf.iData.slice(startB, startB + 6)).toEqual(quadOf(offsetB));

        // Frame 2: A paused (no setMeshData), B advancing.
        nextFrame(buf);
        b.mesh.setMeshData(makeDrawnData(4));  // B's producer, update phase
        a.anyMesh.appendIndexBuffer();         // A's pump: static, index-only resubmit
        b.anyMesh._prepareNativeDrawInfos();   // B's pump: dirty, full refresh

        // A's cached draw info still points at a range holding A's OWN indices.
        // Without the per-frame resubmit, B would append at the reset offset 0
        // and A (start 0, never refreshed) would draw B's vertices.
        expect(a.anyMesh._drawInfoList[0]._indexOffset).toBe(0);
        expect(b.anyMesh._drawInfoList[0]._indexOffset).toBe(6);
        expect(buf.iData.slice(0, 6)).toEqual(quadOf(offsetA));
        expect(buf.iData.slice(6, 12)).toEqual(quadOf(offsetB));
        expect(buf.indexOffset).toBe(12); // one append per mesh — the pump is the single driver
    });

    test('each frame appends once; re-feeding the same object resubmits', () => {
        const { mesh, anyMesh } = createUIMesh();
        const data = makeMeshData(4);
        mesh.setMeshData(data);
        expect(anyMesh._prepareBuffers()).not.toBeNull(); // establishes the chunk
        const buf = anyMesh._renderData.getMeshBuffer();
        const offset = anyMesh._renderData.chunk.vertexOffset;
        const quadOf = (o: number): Uint16Array => new Uint16Array([o, o + 1, o + 2, o + 2, o + 1, o + 3]);

        nextFrame(buf);
        anyMesh.appendIndexBuffer();  // the pump's static-frame path
        expect(buf.indexOffset).toBe(6);
        expect(buf.iData.slice(0, 6)).toEqual(quadOf(offset));

        nextFrame(buf);
        mesh.setMeshData(data);    // SAME object, mutated in place by the producer
        anyMesh.appendIndexBuffer();
        expect(buf.indexOffset).toBe(6); // setMeshData latched a refresh; fresh append at the reset tail
        expect(buf.iData.slice(0, 6)).toEqual(quadOf(offset));
    });
});

describe('UIMesh: batched bake applies the full world matrix', () => {
    const writePositions = (data: UIMeshData, locals: Vec3[]): void => {
        const floats = new Float32Array(data.vertexData.buffer, data.vertexData.byteOffset, data.vertexData.byteLength >> 2);
        locals.forEach((v, i) => {
            floats[i * 6] = v.x; floats[i * 6 + 1] = v.y; floats[i * 6 + 2] = v.z;
        });
    };
    const chunkPosition = (anyMesh: any, i: number): Vec3 => {
        const vb = anyMesh._renderData.chunk.vb; // stride 24 = 6 floats
        return new Vec3(vb[i * 6], vb[i * 6 + 1], vb[i * 6 + 2]);
    };

    test('a parent Z translation reaches the batched vertices: local (1,2,3) + z+10 -> (1,2,13)', () => {
        const parent = new Node('parent');
        parent.addComponent(UITransform);
        scene.addChild(parent);
        parent.setPosition(0, 0, 10);
        const { mesh, anyMesh } = createUIMesh(parent); // node itself stays identity

        const data = makeMeshData(4);
        writePositions(data, [new Vec3(1, 2, 3), new Vec3(-1, 2, 3), new Vec3(1, -2, -3), new Vec3(-1, -2, -3)]);
        anyMesh._enableBatch = true; // direct: the public setter also recompiles materials
        mesh.setMeshData(data);
        expect(anyMesh._prepareBuffers()).not.toBeNull();

        // The old 2D-only bake kept z at 3; the GPU path (pos = cc_matWorld * pos)
        // produces 13, and so must the baked chunk.
        const got = chunkPosition(anyMesh, 0);
        expect(got.x).toBeCloseTo(1, 6);
        expect(got.y).toBeCloseTo(2, 6);
        expect(got.z).toBeCloseTo(13, 6);
    });

    test('batched chunk equals the full world matrix applied to the unbatched chunk (toggle consistency)', () => {
        const parent = new Node('parent');
        parent.addComponent(UITransform);
        scene.addChild(parent);
        parent.setPosition(1, 2, 10);
        parent.setRotationFromEuler(30, 0, 0); // X-axis rotation
        const { mesh, anyMesh, node } = createUIMesh(parent);
        node.setPosition(0.5, -0.25, 2);
        node.setRotationFromEuler(0, 45, 0);  // Y-axis rotation

        const locals = [new Vec3(1, 2, 3), new Vec3(-4, 5, -6), new Vec3(7, -8, 9), new Vec3(-10, -11, -12)];
        const data = makeMeshData(4);
        writePositions(data, locals);

        // Unbatched: the chunk stays node-local (the GPU applies cc_matWorld).
        anyMesh._enableBatch = false;
        mesh.setMeshData(data);
        expect(anyMesh._prepareBuffers()).not.toBeNull();
        const localChunk = [0, 1, 2, 3].map((i) => chunkPosition(anyMesh, i));

        // Batched: the chunk holds the world matrix baked on the CPU. What the
        // GPU would compute for the unbatched data and what the batched data
        // carries must agree component by component, z and X/Y rotation included.
        anyMesh._enableBatch = true;
        expect(anyMesh._prepareBuffers()).not.toBeNull();
        const wm = node.worldMatrix;
        for (let i = 0; i < 4; i++) {
            const expected = new Vec3();
            Vec3.transformMat4(expected, localChunk[i], wm);
            const got = chunkPosition(anyMesh, i);
            expect(got.x).toBeCloseTo(expected.x, 5);
            expect(got.y).toBeCloseTo(expected.y, 5);
            expect(got.z).toBeCloseTo(expected.z, 5);
        }

        // The JSB staleness poll must track the full matrix the bake consumes:
        // a paused mesh that moves in Z or rotates in X/Y still has to re-bake.
        // The capture after a batched prepare is exactly what _onBeforeDraw
        // compares against on the next frame.
        expect(Math.abs(wm.m02)).toBeGreaterThan(0.5); // the rotations are live
        expect(anyMesh._pollWorldMatrix.strictEquals(wm)).toBe(true);
    });
});

describe('UIMesh: cascaded opacity includes ancestor renderer color.a', () => {
    const makeParentWithRenderer = (alpha: number): { parent: Node, parentMesh: any } => {
        const parent = new Node('parent');
        parent.addComponent(UITransform);
        scene.addChild(parent);
        const parentMesh = parent.addComponent(UIMesh) as any;
        parentMesh._color.a = alpha; // direct write: the setter drags color-update machinery in
        return { parent, parentMesh };
    };

    test('a parent renderer at color.a 128 fades the child to ~0.502', () => {
        const { parent } = makeParentWithRenderer(128);
        const { anyMesh } = createUIMesh(parent);
        // Own alpha 255 x parent level (UIOpacity 1 x renderer 128/255). The old
        // computation stopped at localOpacity and returned 1 here.
        expect(anyMesh._computeCascadedOpacity()).toBeCloseTo(128 / 255, 6);
    });

    test('UIOpacity localOpacity and renderer alpha accumulate at every ancestor level', () => {
        const grand = new Node('grand');
        grand.addComponent(UITransform);
        scene.addChild(grand);
        grand.addComponent(UIOpacity).opacity = 204;               // localOpacity 0.8
        const parent = new Node('parent');
        parent.addComponent(UITransform);
        grand.addChild(parent);
        const parentMesh = parent.addComponent(UIMesh) as any;
        parentMesh._color.a = 128;
        parent.addComponent(UIOpacity).opacity = 128;               // localOpacity 128/255
        const { anyMesh } = createUIMesh(parent);

        expect(anyMesh._computeCascadedOpacity()).toBeCloseTo((204 / 255) * (128 / 255) * (128 / 255), 6);
    });

    test('a paused mesh picks up ancestor color.a changes (the JSB poll input)', () => {
        const { parent, parentMesh } = makeParentWithRenderer(128);
        const { mesh, anyMesh } = createUIMesh(parent);
        const data = makeMeshData(4);
        // vfmtPosUvColor4B: pos 12B + uv 8B puts the color attribute at bytes
        // 20..23 of the 24-byte vertex — alpha lives at 23.
        for (let i = 0; i < 4; i++) data.vertexData[i * 24 + 23] = 255; // opaque alpha bytes
        mesh.setMeshData(data);
        expect(anyMesh._prepareBuffers()).not.toBeNull();
        expect(anyMesh._pollOpacity).toBeCloseTo(128 / 255, 6); // captured by the last active frame

        // The ancestor fades while this mesh is paused: no engine event marks a
        // middleware renderer dirty -- the update() poll compares exactly this
        // value and re-marks on drift.
        parentMesh._color.a = 64;
        expect(anyMesh._computeCascadedOpacity()).not.toBe(anyMesh._pollOpacity);

        // The refresh the poll triggers re-folds the new opacity into the
        // copied vertices' alpha bytes.
        expect(anyMesh._prepareBuffers()).not.toBeNull();
        expect(anyMesh._pollOpacity).toBeCloseTo(64 / 255, 6);
        const vb = anyMesh._renderData.chunk.vb;
        const bytes = new Uint8Array(vb.buffer, vb.byteOffset, 4 * 24);
        for (let i = 0; i < 4; i++) {
            expect(bytes[i * 24 + 23]).toBe(64); // 255 * (64 / 255)
        }
    });
});

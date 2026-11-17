import { Canvas, UIOpacity } from '../../cocos/2d';
import { Batcher2D } from '../../cocos/2d/renderer/batcher-2d';
import { Color } from '../../cocos/core';
import type { Buffer } from '../../cocos/gfx';
import { EmptyBuffer } from '../../cocos/gfx/empty/empty-buffer';
import { Camera, Node, Scene, director, game } from '../../exports/base';
import { Graphics } from '../../exports/graphics';

// Graphics uploads position.xyz, color.rgba, and distance for each vertex.
const vertexStride = 8;
const alphaOffset = 6;

function vertices (graphics: Graphics, block = 0): Float32Array {
    const data = graphics.impl!.getRenderDataList()[block];
    return data.vData.slice(0, data.vertexStart * vertexStride);
}

function recordUploads () {
    const writes = new Map<Buffer, (Float32Array | Uint16Array)[]>();
    const update = EmptyBuffer.prototype.update;
    jest.spyOn(EmptyBuffer.prototype, 'update').mockImplementation(function (this: EmptyBuffer, data, size) {
        if (data instanceof Float32Array || data instanceof Uint16Array) {
            const calls = writes.get(this) ?? [];
            // The next upload can reuse the source array, including for another block in this frame.
            calls.push(data.slice(0, size === undefined ? data.length : size / data.BYTES_PER_ELEMENT));
            writes.set(this, calls);
        }
        update.call(this, data, size);
    });
    return writes;
}

function expectUpload (writes: ReturnType<typeof recordUploads>, graphics: Graphics, block: number,
    raw: Float32Array, opacity: number, geometryChanged: boolean): void {
    const input = graphics.model!.subModels[block].inputAssembler;
    const expected = raw.slice();
    for (let i = alphaOffset; i < expected.length; i += vertexStride) {
        expected[i] = raw[i] * opacity;
    }
    expect(writes.get(input.vertexBuffers[0])).toEqual([expected]);
    const data = graphics.impl!.getRenderDataList()[block];
    expect(writes.get(input.indexBuffer!)).toEqual(geometryChanged ? [data.iData.slice(0, data.indexStart)] : undefined);
    expect(vertices(graphics, block)).toEqual(raw);
}

describe('Graphics cascaded opacity', () => {
    let batcher: Batcher2D;
    let previousBatcher: Batcher2D | null;
    let parentOpacity: UIOpacity;
    let graphics: Graphics;
    const root = () => director.root as unknown as { _batcher: Batcher2D | null };

    beforeEach(() => {
        const scene = new Scene('Graphics opacity');
        director.runSceneImmediate(scene);
        previousBatcher = root()._batcher;
        batcher = new Batcher2D(director.root!);
        root()._batcher = batcher;
        batcher.initialize();
        const canvasNode = new Node('Canvas');
        scene.addChild(canvasNode);
        const canvas = canvasNode.addComponent(Canvas);
        const camera = new Node('Camera');
        canvasNode.addChild(camera);
        canvas.cameraComponent = camera.addComponent(Camera);
        const group = new Node('Fade group');
        canvasNode.addChild(group);
        parentOpacity = group.addComponent(UIOpacity);
        const node = new Node('Graphics');
        group.addChild(node);
        graphics = node.addComponent(Graphics);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        director.runSceneImmediate(new Scene('Cleanup'));
        batcher.destroy();
        root()._batcher = previousBatcher;
    });

    test('fades retained fills and strokes from their own alpha and restores them without redrawing', () => {
        graphics.fillColor = new Color(255, 0, 0, 64);
        graphics.fillRect(0, 0, 16, 16);
        graphics.strokeColor = new Color(0, 255, 0, 192);
        graphics.moveTo(20, 0);
        graphics.lineTo(20, 16);
        graphics.stroke();
        // Place a second fill in a separate draw buffer to verify both uploads on a fade.
        graphics.impl!.requestRenderData();
        graphics.impl!.dataOffset = 1;
        graphics.fillRect(32, 0, 8, 8);
        const raw = [vertices(graphics), vertices(graphics, 1)];
        const alpha = raw[0].filter((_, i) => i % vertexStride === alphaOffset);
        expect(alpha).toContain(Math.fround(64 / 255));
        expect(alpha).toContain(Math.fround(192 / 255));
        const writes = recordUploads();
        game.step();
        raw.forEach((original, block) => expectUpload(writes, graphics, block, original, 1, true));
        for (const value of [128, 64]) {
            writes.clear();
            parentOpacity.opacity = value;
            game.step();
            raw.forEach((original, block) => expectUpload(writes, graphics, block, original, value / 255, false));
        }

        writes.clear();
        game.step();
        for (const sub of graphics.model!.subModels) {
            expect(writes.has(sub.inputAssembler.vertexBuffers[0])).toBe(false);
            expect(writes.has(sub.inputAssembler.indexBuffer!)).toBe(false);
        }
        const commits = jest.spyOn(batcher, 'commitModel');
        parentOpacity.opacity = 0;
        game.step();
        expect(commits).not.toHaveBeenCalled();

        writes.clear();
        parentOpacity.opacity = 255;
        game.step();
        expect(commits).toHaveBeenCalledTimes(1);
        raw.forEach((original, block) => expectUpload(writes, graphics, block, original, 1, false));
    });

    test('applies current opacity when appending paint or replacing paint of the same size while hidden', () => {
        parentOpacity.opacity = 128;
        graphics.fillColor = new Color(10, 50, 150, 192);
        graphics.fillRect(0, 0, 8, 8);
        const writes = recordUploads();
        const first = vertices(graphics);
        game.step();
        expectUpload(writes, graphics, 0, first, 128 / 255, true);

        writes.clear();
        graphics.fillColor = new Color(180, 20, 5, 64);
        graphics.fillRect(10, 0, 8, 8);
        const appended = vertices(graphics);
        game.step();
        expectUpload(writes, graphics, 0, appended, 128 / 255, true);

        parentOpacity.opacity = 0;
        graphics.clear();
        graphics.fillColor = new Color(20, 220, 10, 48);
        graphics.fillRect(32, 0, 8, 8);
        graphics.fillRect(42, 0, 8, 8);
        const replacement = vertices(graphics);
        expect(replacement.length).toBe(appended.length);
        expect(replacement).not.toEqual(appended);
        game.step();
        writes.clear();
        parentOpacity.opacity = 128;
        game.step();
        expectUpload(writes, graphics, 0, replacement, 128 / 255, true);
    });
});

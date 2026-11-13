import { Canvas, UIOpacity } from '../../cocos/2d';
import { Batcher2D } from '../../cocos/2d/renderer/batcher-2d';
import { Stage } from '../../cocos/2d/renderer/stencil-manager';
import { Material } from '../../cocos/asset/assets';
import { Color } from '../../cocos/core';
import { EmptyBuffer } from '../../cocos/gfx/empty/empty-buffer';
import type { Buffer } from '../../cocos/gfx';
import { Camera, Node, Scene, director, game } from '../../exports/base';
import { Graphics } from '../../exports/graphics';
import { Mask } from '../../exports/mask';

function paint (parent: Node): Graphics {
    const node = new Node('Paint');
    parent.addChild(node);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(255, 0, 0, 64);
    graphics.fillRect(0, 0, 16, 16);
    graphics.strokeColor = new Color(0, 255, 0, 192);
    graphics.moveTo(20, 0);
    graphics.lineTo(20, 16);
    graphics.stroke();
    return graphics;
}

function rawVertices (graphics: Graphics, block: number): Float32Array {
    const data = graphics.impl!.getRenderDataList()[block];
    return data.vData.slice(0, data.vertexStart * 8);
}

// Snapshot the bytes at the device boundary while each write is made. The renderer can reuse
// the typed array on later frames, so keeping only the mock's argument would lose earlier states.
function trackUploads () {
    const writes = new Map<Buffer, (Float32Array | Uint16Array)[]>();
    const originalUpdate = EmptyBuffer.prototype.update;
    jest.spyOn(EmptyBuffer.prototype, 'update').mockImplementation(function (this: EmptyBuffer, data, size) {
        if (data instanceof Float32Array || data instanceof Uint16Array) {
            const calls = writes.get(this) || [];
            calls.push(data.slice(0, size === undefined ? data.length : size / data.BYTES_PER_ELEMENT));
            writes.set(this, calls);
        }
        originalUpdate.call(this, data, size);
    });
    return {
        clear: () => writes.clear(),
        count: (buffer: Buffer) => writes.get(buffer)?.length || 0,
        expectGeometry (graphics: Graphics, block: number, raw: Float32Array, factor: number, indexChanged: boolean) {
            const input = graphics.model!.subModels[block].inputAssembler;
            const expected = raw.slice();
            for (let alpha = 6; alpha < expected.length; alpha += 8) {
                expected[alpha] = raw[alpha] * factor;
            }
            expect(writes.get(input.vertexBuffers[0])).toEqual([expected]);
            const data = graphics.impl!.getRenderDataList()[block];
            if (indexChanged) {
                expect(writes.get(input.indexBuffer!)).toEqual([data.iData.slice(0, data.indexStart)]);
            } else {
                expect(writes.has(input.indexBuffer!)).toBe(false);
            }
            expect(rawVertices(graphics, block)).toEqual(raw);
        },
    };
}

describe('Graphics cascaded vertex opacity', () => {
    let canvasNode: Node;
    let batcher: Batcher2D;
    let previousBatcher: Batcher2D | null;

    function rootAccess () {
        return director.root as unknown as { _batcher: Batcher2D | null };
    }

    test('a failed reservation preserves retained paints and the next successful append', () => {
        const graphics = paint(canvasNode);
        const data = graphics.impl!.getRenderDataList()[0];
        const raw = rawVertices(graphics, 0);
        const indices = data.indexStart;
        const request = jest.spyOn(data, 'request').mockReturnValue(false);
        // Exhaust any spare capacity from the initial stroke's conservative estimate.
        for (let i = 0; i < data.vertexCount + 1; i++) graphics.rect(i, 0, 1, 1);
        graphics.fill();
        expect(request).toHaveBeenCalled();
        expect(rawVertices(graphics, 0)).toEqual(raw);
        expect(data.indexStart).toBe(indices);
        request.mockRestore();
        graphics.fillRect(0, 24, 8, 8);
        expect(data.vertexStart).toBeGreaterThan(raw.length / 8);
        game.step();
    });

    beforeEach(() => {
        const scene = new Scene('Graphics opacity');
        director.runSceneImmediate(scene);
        previousBatcher = rootAccess()._batcher;
        batcher = new Batcher2D(director.root!);
        rootAccess()._batcher = batcher;
        batcher.initialize();
        canvasNode = new Node('Canvas');
        scene.addChild(canvasNode);
        const canvas = canvasNode.addComponent(Canvas);
        const camera = new Node('Camera');
        canvasNode.addChild(camera);
        canvas.cameraComponent = camera.addComponent(Camera);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        director.runSceneImmediate(new Scene('Cleanup'));
        batcher.destroy();
        rootAccess()._batcher = previousBatcher;
    });

    test('fades all retained paint blocks from their original alpha and skips unchanged buffers', () => {
        const group = new Node('Fade group');
        canvasNode.addChild(group);
        const parentOpacity = group.addComponent(UIOpacity);
        const faded = paint(group);
        const selfOpacity = faded.node.addComponent(UIOpacity);
        const sibling = paint(canvasNode);
        // Exercise the same chunk allocation as the 64K split with a small second shape.
        faded.impl!.requestRenderData();
        faded.impl!.dataOffset = 1;
        faded.fillRect(32, 0, 8, 8);
        const raw = [rawVertices(faded, 0), rawVertices(faded, 1)];
        const alphas = raw[0].filter((_, i) => i % 8 === 6);
        expect(alphas).toContain(Math.fround(64 / 255));
        expect(alphas).toContain(Math.fround(192 / 255));
        const uploads = trackUploads();
        game.step();
        expect(faded.model!.subModels).toHaveLength(2);
        raw.forEach((vertices, block) => uploads.expectGeometry(faded, block, vertices, 1, true));
        const siblingVB = sibling.model!.subModels[0].inputAssembler.vertexBuffers[0];

        const custom = new Material();
        custom.initialize({ effectName: 'builtin-sprite' });
        try {
            faded.customMaterial = custom;
            const customPass = faded.getMaterialInstance(0)!.passes[0];
            expect(faded.model!.subModels.every(sub => sub.passes[0] === customPass)).toBe(true);
            parentOpacity.opacity = 128;
            selfOpacity.opacity = 192;
            faded.color = new Color(255, 255, 255, 128);
            const factor = (128 / 255) * ((128 / 255) * (192 / 255));
            uploads.clear();
            game.step();
            raw.forEach((vertices, block) => uploads.expectGeometry(faded, block, vertices, factor, false));
            expect(uploads.count(siblingVB)).toBe(0);

            uploads.clear();
            faded.customMaterial = null;
            game.step();
            const checkUnchanged = () => {
                for (const sub of faded.model!.subModels) {
                    expect(uploads.count(sub.inputAssembler.vertexBuffers[0])).toBe(0);
                    expect(uploads.count(sub.inputAssembler.indexBuffer!)).toBe(0);
                }
            };
            checkUnchanged();
            const tint = faded.color;
            tint.a = 0;
            faded.color = tint;
            game.step();
            expect(faded.node._uiProps.opacity).toBe(0);
            checkUnchanged();

            // Restore using the same mutable Color object. No stale or compounded alpha survives.
            tint.a = 255;
            faded.color = tint;
            selfOpacity.opacity = 255;
            parentOpacity.opacity = 255;
            game.step();
            raw.forEach((vertices, block) => uploads.expectGeometry(faded, block, vertices, 1, false));

            const maskNode = new Node('Mask');
            group.addChild(maskNode);
            const mask = maskNode.addComponent(Mask);
            const masked = paint(maskNode);
            const maskedRaw = rawVertices(masked, 0);
            parentOpacity.opacity = 128;
            uploads.clear();
            game.step();
            uploads.expectGeometry(masked, 0, maskedRaw, 128 / 255, true);
            const stencil = maskNode.getComponent(Graphics)!;
            const stencilRaw = rawVertices(stencil, 0);
            for (let i = 6; i < stencilRaw.length; i += 8) {
                expect(stencilRaw[i]).toBe(0);
            }
            mask.inverted = true;
            uploads.clear();
            game.step();
            expect(stencil.stencilStage).toBe(Stage.ENTER_LEVEL_INVERTED);
            expect(uploads.count(masked.model!.subModels[0].inputAssembler.vertexBuffers[0])).toBe(0);
        } finally {
            faded.customMaterial = null;
            custom.destroy();
        }
    });

    test('refreshes paint data on growth and on a same-size redraw while hidden', () => {
        const graphics = paint(canvasNode);
        const opacity = graphics.node.addComponent(UIOpacity);
        opacity.opacity = 128;
        const uploads = trackUploads();
        game.step();
        const input = graphics.model!.subModels[0].inputAssembler;
        const originalSize = input.vertexBuffers[0].size;
        const initialVertices = rawVertices(graphics, 0);
        uploads.expectGeometry(graphics, 0, initialVertices, 128 / 255, true);

        opacity.opacity = 255;
        uploads.clear();
        graphics.fillColor = new Color(10, 50, 150, 129);
        // Grow beyond the initial GPU capacity at full opacity.
        for (let i = 0; i < 24; i++) {
            graphics.fillRect(i * 5, 20, 4, 4);
        }
        const grown = rawVertices(graphics, 0);
        game.step();
        expect(input.vertexBuffers[0].size).toBeGreaterThan(originalSize);
        uploads.expectGeometry(graphics, 0, grown, 1, true);

        opacity.opacity = 128;
        uploads.clear();
        game.step();
        uploads.expectGeometry(graphics, 0, grown, 128 / 255, false);

        // Append to an existing faded block at the same opacity.
        uploads.clear();
        graphics.fillRect(0, 30, 8, 4);
        const appended = rawVertices(graphics, 0);
        game.step();
        uploads.expectGeometry(graphics, 0, appended, 128 / 255, true);

        graphics.clear();
        graphics.fillRect(0, 0, 8, 8);
        uploads.clear();
        game.step();
        const beforeClear = rawVertices(graphics, 0);
        uploads.expectGeometry(graphics, 0, beforeClear, 128 / 255, true);
        opacity.opacity = 0;
        graphics.clear();
        graphics.fillColor = new Color(12, 20, 220, 48);
        graphics.fillRect(32, 32, 8, 8);
        const replacement = rawVertices(graphics, 0);
        expect(replacement.length).toBe(beforeClear.length);
        expect(replacement).not.toEqual(beforeClear);
        uploads.clear();
        game.step();
        expect(uploads.count(input.vertexBuffers[0])).toBe(0);
        opacity.opacity = 128;
        game.step();
        uploads.expectGeometry(graphics, 0, replacement, 128 / 255, true);
    });
});

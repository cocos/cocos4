import { Node } from '../../cocos/scene-graph';
import { Graphics } from '../../cocos/2d/components/graphics';
import '../../cocos/2d/assembler/graphics';

function createGraphics (): Graphics {
    return new Node('Stroke capacity').addComponent(Graphics);
}

function line (graphics: Graphics, y: number): void {
    graphics.moveTo(0, y);
    graphics.lineTo(8, y);
}

function geometry (graphics: Graphics): number[][] {
    return graphics.impl!.getRenderDataList().map((data) => {
        expect(data.vertexStart).toBeLessThanOrEqual(data.vertexCount);
        expect(data.indexStart).toBeLessThanOrEqual(data.indexCount);
        const indices = data.iData.subarray(0, data.indexStart);
        expect(indices.every((index) => index < data.vertexStart)).toBe(true);
        return [data.vertexStart, data.indexStart];
    });
}

describe('Graphics stroke capacity', () => {
    test('wide two-point paths have two caps and no round joins', () => {
        const graphics = createGraphics();
        graphics.lineWidth = 2048;
        graphics.lineJoin = Graphics.LineJoin.ROUND;
        graphics.lineCap = Graphics.LineCap.BUTT;
        for (let i = 0; i < 256; i++) line(graphics, i);
        graphics.stroke();
        expect(geometry(graphics)).toEqual([[1024, 1536]]);
    });

    test('starts a new chunk at a subpath boundary after using Uint16 index 65535', () => {
        const graphics = createGraphics();
        graphics.lineCap = Graphics.LineCap.BUTT;
        for (let i = 0; i < 16385; i++) line(graphics, i);
        graphics.stroke();
        expect(geometry(graphics)).toEqual([[65536, 98304], [4, 6]]);
        const [first, second] = graphics.impl!.getRenderDataList();
        expect(first.iData[first.indexStart - 1]).toBe(65535);
        expect(Array.from(second.iData.subarray(0, 6))).toEqual([0, 1, 2, 1, 2, 3]);
    });

    test.each([
        [Graphics.LineJoin.MITER, 32768],
        [Graphics.LineJoin.BEVEL, 16385],
    ] as const)('counts only interior joins in a full-size open strip (join %s)', (join, points) => {
        const graphics = createGraphics();
        graphics.lineCap = Graphics.LineCap.BUTT;
        graphics.lineJoin = join;
        graphics.moveTo(0, 0);
        for (let i = 1; i < points; i++) graphics.lineTo(i, 0);
        graphics.stroke();
        expect(geometry(graphics)).toEqual([[65536, 196602]]);
    });

    test('retains a long path when its round join upper bound exceeds one chunk', () => {
        const graphics = createGraphics();
        graphics.lineWidth = 2048;
        graphics.lineJoin = Graphics.LineJoin.ROUND;
        graphics.lineCap = Graphics.LineCap.BUTT;
        graphics.moveTo(0, 0);
        for (let i = 1; i <= 1100; i++) graphics.lineTo(i, 0);
        graphics.stroke();
        // Each of the 1099 collinear joins emits four outer vertices and two pairs.
        const vertices = 4 + 1099 * 8;
        expect(geometry(graphics)).toEqual([[vertices, 3 * (vertices - 2)]]);
    });

    test('an oversized individual strip leaves both neighboring paths drawable', () => {
        const graphics = createGraphics();
        graphics.lineJoin = Graphics.LineJoin.MITER;
        graphics.lineCap = Graphics.LineCap.BUTT;
        line(graphics, 1);
        graphics.moveTo(0, 2);
        for (let i = 1; i <= 32768; i++) graphics.lineTo(i, 2);
        line(graphics, 3);
        graphics.stroke();
        expect(geometry(graphics)).toEqual([[8, 12]]);
        const data = graphics.impl!.getRenderDataList()[0];
        expect(Array.from(data.iData.subarray(6, 12))).toEqual([4, 5, 6, 5, 6, 7]);
    });
});
